import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/server/crypto-auth";
import { extractErpSessionFromRequest } from "../erp-session";
import {
  getPlatformSupabase,
  getTenantDoc,
  listTenantUsersFromDb,
  putTenantDoc,
  softDeleteTenantUserInDb,
  upsertTenantUserInDb,
} from "../supabase-server";
import {
  calculateSubscriptionQuote,
  createOrUpdateMpPreapproval,
  enforceOptionBranding,
  ensureBaseMiniSistemaTenant,
  getPlatformSecretsMap,
  getPricingConfig,
  getTenantBySlug,
  provisionNewCommerceTenant,
  provisionOption1Deployment,
  savePlatformSecretsMap,
  savePricingConfig,
} from "../tenant-service";
import {
  DEFINED_USER_TYPES,
  type DefinedUserType,
  type GlobalManagedUserRecord,
  type GlobalUserStatus,
  INITIAL_ANTIGRAVITY_USERS,
} from "../global-users-seed";
import {
  type DiscountDurationType,
  ERP_COMMERCIAL_MODULES,
  type ErpTenantRecord,
  expandCommercialToErpModules,
  GENERAL_ADMIN_DEFAULT_PASS,
  GENERAL_ADMIN_USERNAME,
  normalizeErpRole,
} from "../types";

type AnyObj = Record<string, any>;

const GLOBAL_USERS_DOC_KEY = "global_users_directory_v1";

interface GlobalUsersDocPayload {
  updatedAt: string;
  items: GlobalManagedUserRecord[];
}

function normalizeDefinedUserType(raw: unknown, username = ""): DefinedUserType {
  if (String(username || "").trim().toLowerCase() === GENERAL_ADMIN_USERNAME) {
    return "Admin. Gral.";
  }
  const clean = String(raw || "").trim();
  const valid = DEFINED_USER_TYPES.find(
    (t) => t.key.toLowerCase() === clean.toLowerCase()
  );
  if (valid) return valid.key;
  if (clean.toLowerCase() === "administrador general") return "Admin. Gral.";
  return "Usuario";
}

function mapUserTypeToErpRole(
  userType: DefinedUserType,
  username: string
): "Administrador General" | "Administrador" | "Usuario" {
  if (username.toLowerCase() === GENERAL_ADMIN_USERNAME || userType === "Admin. Gral.") {
    return "Administrador General";
  }
  if (userType === "Administrador") return "Administrador";
  return "Usuario";
}

async function getAndEnsureVaultDoc(baseTenant: ErpTenantRecord): Promise<GlobalUsersDocPayload> {
  const { payload } = await getTenantDoc<GlobalUsersDocPayload>(
    baseTenant,
    GLOBAL_USERS_DOC_KEY,
    { updatedAt: new Date().toISOString(), items: [] }
  );
  const items = Array.isArray(payload?.items) ? [...payload.items] : [];
  const existingIds = new Set(items.map((x) => x.id));
  let changed = false;
  for (const seedItem of INITIAL_ANTIGRAVITY_USERS) {
    if (!existingIds.has(seedItem.id)) {
      items.push({ ...seedItem });
      existingIds.add(seedItem.id);
      changed = true;
    }
  }
  if (changed) {
    const nextDoc: GlobalUsersDocPayload = {
      updatedAt: new Date().toISOString(),
      items,
    };
    await putTenantDoc(
      baseTenant,
      GLOBAL_USERS_DOC_KEY,
      nextDoc,
      GENERAL_ADMIN_USERNAME,
      "seed_global_users_directory"
    );
    return nextDoc;
  }
  return { updatedAt: payload?.updatedAt || new Date().toISOString(), items };
}

async function buildGlobalUsersInventory(
  baseTenant: ErpTenantRecord,
  tenants: ErpTenantRecord[]
): Promise<GlobalManagedUserRecord[]> {
  const vaultDoc = await getAndEnsureVaultDoc(baseTenant);
  const vaultById = new Map<string, GlobalManagedUserRecord>();
  for (const v of vaultDoc.items) {
    vaultById.set(v.id, v);
  }

  const erpResults: GlobalManagedUserRecord[] = [];
  await Promise.all(
    tenants.map(async (t) => {
      try {
        const [tUsers, { payload: suspDb }] = await Promise.all([
          listTenantUsersFromDb(t),
          getTenantDoc<Record<string, { reason?: string; note?: string; userType?: DefinedUserType }>>(
            t,
            "users_suspension_meta",
            {}
          ),
        ]);
        const projLabel = t.is_base
          ? "MiniSistema ERP (/sistema)"
          : `MiniSistema ERP — ${t.fantasy_name}`;
        const projUrl =
          t.deployment?.publicErpUrl ||
          (t.is_base
            ? "https://www.minisistema.com.ar/sistema"
            : `https://www.minisistema.com.ar/${t.slug}`);

        const hasDaniel = tUsers.some(
          (u) => u.username.toLowerCase() === GENERAL_ADMIN_USERNAME
        );
        const fullList = hasDaniel
          ? tUsers
          : [
              {
                username: GENERAL_ADMIN_USERNAME,
                plain_compat: GENERAL_ADMIN_DEFAULT_PASS,
                name: "Daniel G.",
                role: "Administrador General" as const,
                branch: t.fantasy_name || "Casa Central",
                whatsapp: "+5493585095475",
                active: true,
              },
              ...tUsers,
            ];

        for (const u of fullList) {
          const uLower = u.username.toLowerCase();
          const rowId = `erp__${t.slug}__${uLower}`;
          const meta = suspDb?.[uLower] || {};
          const vaultOverride = vaultById.get(rowId);
          const normRole = normalizeErpRole(u.role, uLower);
          const resolvedType: DefinedUserType =
            uLower === GENERAL_ADMIN_USERNAME
              ? "Admin. Gral."
              : meta.userType
                ? normalizeDefinedUserType(meta.userType, uLower)
                : normRole === "Administrador"
                  ? "Administrador"
                  : "Usuario";

          let status: GlobalUserStatus = "active";
          let suspendedReason = "";
          if (uLower !== GENERAL_ADMIN_USERNAME) {
            if (u.active === false) {
              if (meta.reason === "falta_pago") {
                status = "suspended_nonpayment";
                suspendedReason = meta.note || "Deshabilitado transitoriamente por falta de pago";
              } else {
                status = "disabled";
                suspendedReason = meta.note || "Usuario deshabilitado manualmente";
              }
            } else if (t.status === "suspended") {
              status = "suspended_nonpayment";
              suspendedReason = "Sistema del comercio suspendido por falta de pago";
            }
          }

          erpResults.push({
            id: rowId,
            source: "erp_tenant",
            tenantSlug: t.slug,
            project: projLabel,
            projectUrl: projUrl,
            name: u.name || u.username,
            username: u.username,
            email: vaultOverride?.email || "",
            password:
              u.plain_compat ||
              vaultOverride?.password ||
              (uLower === GENERAL_ADMIN_USERNAME ? GENERAL_ADMIN_DEFAULT_PASS : ""),
            altPasswordNote: "",
            userType: resolvedType,
            status,
            suspendedReason,
            whatsapp: u.whatsapp || "",
            notes:
              meta.note ||
              vaultOverride?.notes ||
              (t.is_base
                ? "Base limpia oficial MiniSistema (Supabase erp_minisistema)"
                : `Comercio ${t.option_type === 1 ? "Opción 1" : "Opción 2"} (${t.db_schema})`),
            deleted: false,
            createdAt: t.created_at || new Date().toISOString(),
            updatedAt: t.updated_at || new Date().toISOString(),
          });
        }
      } catch {
        // Ignore isolated tenant read errors so global directory always loads
      }
    })
  );

  const vaultOnly = vaultDoc.items.filter(
    (x) => !x.deleted && x.source !== "erp_tenant"
  );

  return [...erpResults, ...vaultOnly];
}

function requireGeneralAdmin(req: NextRequest, activeTenantSlug: string) {
  const sess =
    extractErpSessionFromRequest(req, activeTenantSlug) ||
    extractErpSessionFromRequest(req, "minisistema");
  if (
    !sess ||
    sess.username.toLowerCase() !== GENERAL_ADMIN_USERNAME ||
    sess.role !== "Administrador General"
  ) {
    return null;
  }
  return sess;
}

function maskSecret(val: string): string {
  if (!val) return "";
  if (val.length <= 8) return "••••••••";
  return `${val.slice(0, 6)}••••••••${val.slice(-4)}`;
}

export async function handleErpSuperAdmin(
  req: NextRequest,
  activeTenant: ErpTenantRecord
): Promise<NextResponse> {
  const sess = requireGeneralAdmin(req, activeTenant.slug);
  if (!sess) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Acceso restringido exclusivamente al Administrador General (@danielg).",
      },
      { status: 403 }
    );
  }

  const baseTenant = await ensureBaseMiniSistemaTenant();
  const sb = await getPlatformSupabase();

  if (req.method === "GET") {
    const action = req.nextUrl.searchParams.get("action") || "dashboard";

    if (action === "tenant_users") {
      const targetSlug = req.nextUrl.searchParams.get("slug") || "minisistema";
      const targetTenant = await getTenantBySlug(targetSlug);
      if (!targetTenant) {
        return NextResponse.json(
          { ok: false, message: "Comercio no encontrado." },
          { status: 404 }
        );
      }
      const users = await listTenantUsersFromDb(targetTenant);
      return NextResponse.json({
        ok: true,
        tenant: targetTenant,
        users: users.map((u) => ({
          ...u,
          pass: u.plain_compat || "",
          role: normalizeErpRole(u.role, u.username),
        })),
      });
    }

    if (action === "tenant_afip") {
      const targetSlug = req.nextUrl.searchParams.get("slug") || "minisistema";
      const targetTenant = await getTenantBySlug(targetSlug);
      if (!targetTenant) {
        return NextResponse.json(
          { ok: false, message: "Comercio no encontrado." },
          { status: 404 }
        );
      }
      const { payload: arcaDb } = await getTenantDoc<AnyObj>(
        targetTenant,
        "arca_comprobantes_db",
        {}
      );
      const cert = (arcaDb?.certificado || {}) as AnyObj;
      return NextResponse.json({
        ok: true,
        slug: targetTenant.slug,
        fantasyName: targetTenant.fantasy_name,
        cuit: String(cert.cuit || targetTenant.branding?.cuitFmt || ""),
        titular: String(cert.titular || targetTenant.business_name || ""),
        ptoVta: String(cert.ptoVta || "0002"),
        entorno: String(cert.entornoMode || "produccion"),
        emision: String(cert.emision || "—"),
        vencimiento: String(cert.vencimiento || "—"),
        hasCertPem: Boolean(cert.certPem),
        hasKeyPem: Boolean(cert.keyPem),
        certMasked: maskSecret(String(cert.certPem || "")),
        keyMasked: maskSecret(String(cert.keyPem || "")),
      });
    }

    const [{ data: tenants }, pricing, secrets, { data: events }] =
      await Promise.all([
        sb
          .from("erp_tenants")
          .select("*")
          .order("is_base", { ascending: false })
          .order("created_at", { ascending: false }),
        getPricingConfig(),
        getPlatformSecretsMap(),
        sb
          .from("erp_subscription_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

    const tenantsList = (tenants || []) as ErpTenantRecord[];
    const globalUsers = await buildGlobalUsersInventory(baseTenant, tenantsList);

    if (action === "global_users") {
      return NextResponse.json({
        ok: true,
        definedUserTypes: DEFINED_USER_TYPES,
        globalUsers,
      });
    }

    return NextResponse.json({
      ok: true,
      commercialModules: ERP_COMMERCIAL_MODULES,
      definedUserTypes: DEFINED_USER_TYPES,
      globalUsers,
      pricingConfig: pricing,
      tenants: tenantsList,
      recentEvents: events || [],
      credentialsStatus: {
        mpConfigured: Boolean(secrets.mp_access_token),
        mpAccessTokenMasked: maskSecret(secrets.mp_access_token),
        mpPublicKey: secrets.mp_public_key || "",
        mpWebhookSecretMasked: maskSecret(secrets.mp_webhook_secret),
        githubConfigured: Boolean(secrets.github_token),
        githubTokenMasked: maskSecret(secrets.github_token),
        githubOwner: secrets.github_owner || "danighiglionesl-art",
        vercelConfigured: Boolean(secrets.vercel_token),
        vercelTokenMasked: maskSecret(secrets.vercel_token),
        vercelTeamId: secrets.vercel_team_id || "",
        afipConfigured: Boolean(secrets.afip_cuit && secrets.afip_cert_pem && secrets.afip_key_pem),
        afipCuit: secrets.afip_cuit || "",
        afipEntorno: secrets.afip_entorno || "produccion",
        afipPtoVta: secrets.afip_pto_vta || "0002",
        afipCertMasked: maskSecret(secrets.afip_cert_pem),
        afipKeyMasked: maskSecret(secrets.afip_key_pem),
      },
    });
  }

  if (req.method === "POST") {
    const body = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
    const action = String(body.action || "");
    const siteOrigin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    if (action === "calculate_quote") {
      const pricingConfig = await getPricingConfig();
      const quote = calculateSubscriptionQuote({
        optionType: Number(body.optionType) === 1 ? 1 : 2,
        pricingConfig,
        customOptionBasePrice:
          body.customOptionBasePrice !== undefined
            ? Number(body.customOptionBasePrice)
            : null,
        moduleOverrides: Array.isArray(body.moduleOverrides)
          ? body.moduleOverrides
          : [],
        globalDiscountType: (body.globalDiscountType ||
          "none") as DiscountDurationType,
        globalDiscountPct: Number(body.globalDiscountPct || 0),
        globalDiscountFixed: Number(body.globalDiscountFixed || 0),
        temporaryMonths: Number(body.temporaryMonths || 3),
        payerEmail: String(body.payerEmail || ""),
      });
      return NextResponse.json({ ok: true, quote });
    }

    if (action === "save_pricing_config") {
      const updated = await savePricingConfig(body.pricingConfig || body);
      return NextResponse.json({
        ok: true,
        message: "Valores mensuales por módulo y opción actualizados.",
        pricingConfig: updated,
      });
    }

    if (action === "save_platform_secrets") {
      await savePlatformSecretsMap(body.secrets || {});
      return NextResponse.json({
        ok: true,
        message:
          "Credenciales de AFIP / ARCA, Mercado Pago, GitHub y Vercel guardadas de forma segura.",
      });
    }

    if (action === "save_tenant_afip_credentials") {
      const slug = String(body.slug || "minisistema").trim().toLowerCase();
      const targetTenant = await getTenantBySlug(slug);
      if (!targetTenant) {
        return NextResponse.json(
          { ok: false, message: "Comercio no encontrado." },
          { status: 404 }
        );
      }

      const cuitRaw = String(body.cuit || "").trim();
      const titular = String(
        body.titular || targetTenant.business_name || targetTenant.fantasy_name
      )
        .trim()
        .toUpperCase();
      const ptoVta = String(body.ptoVta || "0002")
        .replace(/\D/g, "")
        .padStart(4, "0");
      const entornoMode =
        String(body.entorno || "produccion").toLowerCase() === "homologacion"
          ? "homologacion"
          : "produccion";
      const vencimiento = String(body.vencimiento || "Vigencia 2 años (X.509)").trim();

      const { payload: arcaDb } = await getTenantDoc<AnyObj>(
        targetTenant,
        "arca_comprobantes_db",
        {
          updatedAt: new Date().toISOString(),
          servicioArcaEstado: "online",
          certificado: {},
          comprobantes: [],
          auditoria: [],
        }
      );

      const prevCert = (arcaDb.certificado || {}) as AnyObj;
      const certPem =
        body.certPem && String(body.certPem).trim() !== ""
          ? String(body.certPem).trim()
          : String(prevCert.certPem || "");
      const keyPem =
        body.keyPem && String(body.keyPem).trim() !== ""
          ? String(body.keyPem).trim()
          : String(prevCert.keyPem || "");

      const hasBoth = Boolean(certPem && keyPem && cuitRaw);
      arcaDb.servicioArcaEstado = hasBoth ? "online" : "contingencia";
      arcaDb.certificado = {
        ...prevCert,
        cuit: cuitRaw || prevCert.cuit || "00-00000000-0",
        titular,
        ptoVta,
        entornoMode,
        entorno:
          entornoMode === "produccion"
            ? "Producción WSFEv1 ARCA (Activo)"
            : "Homologación / Testing WSFEv1",
        emision: prevCert.emision && prevCert.emision !== "—"
          ? prevCert.emision
          : new Date().toLocaleDateString("es-AR"),
        vencimiento,
        certPem,
        keyPem,
        updatedAt: new Date().toISOString(),
      };

      if (!Array.isArray(arcaDb.auditoria)) arcaDb.auditoria = [];
      arcaDb.auditoria.unshift({
        fechaHora: new Date().toLocaleString("es-AR"),
        operacion: "WSAA / Certificado Digital X.509",
        comprobante: `PV ${ptoVta} · CUIT ${cuitRaw}`,
        resultado: hasBoth ? "VINCULADO OK" : "ACTUALIZADO",
        detalle: `Credenciales AFIP/ARCA configuradas para ${targetTenant.fantasy_name}`,
        usuario: GENERAL_ADMIN_USERNAME,
      });

      await putTenantDoc(
        targetTenant,
        "arca_comprobantes_db",
        arcaDb,
        GENERAL_ADMIN_USERNAME,
        "save_tenant_afip_credentials"
      );

      // Actualizar CUIT en el branding del comercio
      if (cuitRaw) {
        const nextBranding = {
          ...targetTenant.branding,
          cuitFmt: cuitRaw,
        };
        await sb
          .from("erp_tenants")
          .update({
            branding: nextBranding,
            updated_at: new Date().toISOString(),
          })
          .eq("slug", targetTenant.slug);
      }

      // Si es el sistema base MiniSistema, sincronizar también en secretos globales
      if (targetTenant.is_base) {
        await savePlatformSecretsMap({
          afip_cuit: cuitRaw,
          afip_entorno: entornoMode,
          afip_pto_vta: ptoVta,
          ...(certPem ? { afip_cert_pem: certPem } : {}),
          ...(keyPem ? { afip_key_pem: keyPem } : {}),
        });
      }

      return NextResponse.json({
        ok: true,
        message: `Credenciales AFIP / ARCA vinculadas correctamente para "${targetTenant.fantasy_name}" (CUIT ${cuitRaw || "actualizado"}).`,
      });
    }

    if (action === "provision_tenant") {
      try {
        const created = await provisionNewCommerceTenant({
          slug: String(body.slug || ""),
          optionType: Number(body.optionType) === 1 ? 1 : 2,
          actividadNegocio:
            body.actividadNegocio === "servicios" || body.actividadNegocio === "mixta"
              ? body.actividadNegocio
              : "comercial",
          businessName: String(body.businessName || ""),
          fantasyName: String(body.fantasyName || body.businessName || ""),
          customDomain: String(body.customDomain || ""),
          branding: body.branding || {},
          commercialModuleKeys: Array.isArray(body.commercialModuleKeys)
            ? body.commercialModuleKeys
            : [],
          moduleOverrides: Array.isArray(body.moduleOverrides)
            ? body.moduleOverrides
            : undefined,
          customOptionBasePrice:
            body.customOptionBasePrice !== undefined &&
            body.customOptionBasePrice !== ""
              ? Number(body.customOptionBasePrice)
              : null,
          globalDiscountType: (body.globalDiscountType ||
            "none") as DiscountDurationType,
          globalDiscountPct: Number(body.globalDiscountPct || 0),
          globalDiscountFixed: Number(body.globalDiscountFixed || 0),
          temporaryMonths: Number(body.temporaryMonths || 3),
          payerEmail: String(body.payerEmail || ""),
          createMpSubscription: body.createMpSubscription !== false,
          externalSupabaseUrl: body.externalSupabaseUrl
            ? String(body.externalSupabaseUrl).trim()
            : null,
          externalSupabaseKey: body.externalSupabaseKey
            ? String(body.externalSupabaseKey).trim()
            : null,
          initialAdmin: body.initialAdmin || null,
          siteOrigin,
        });

        await sb.from("erp_subscription_events").insert({
          tenant_slug: created.slug,
          event_type: "TENANT_PROVISIONED",
          mp_preapproval_id: created.subscription.mpPreapprovalId,
          amount: created.subscription.activeMonthlyAmount,
          payload: {
            optionType: created.option_type,
            schema: created.db_schema,
            publicErpUrl: created.deployment.publicErpUrl,
          },
        });

        return NextResponse.json({
          ok: true,
          message: `¡Sistema "${created.fantasy_name}" creado con base de datos aislada (${created.db_schema}) limpia!`,
          tenant: created,
        });
      } catch (err) {
        return NextResponse.json(
          {
            ok: false,
            message:
              err instanceof Error
                ? err.message
                : "No se pudo habilitar el nuevo sistema.",
          },
          { status: 400 }
        );
      }
    }

    if (action === "update_tenant") {
      const slug = String(body.slug || "").trim().toLowerCase();
      const existing = await getTenantBySlug(slug);
      if (!existing) {
        return NextResponse.json(
          { ok: false, message: "Comercio no encontrado." },
          { status: 404 }
        );
      }

      const nextOptionType: 1 | 2 = existing.is_base
        ? 1
        : body.optionType !== undefined
          ? Number(body.optionType) === 1
            ? 1
            : 2
          : existing.option_type;

      const nextBranding = enforceOptionBranding(
        nextOptionType,
        existing.is_base,
        {
          ...existing.branding,
          ...(body.branding || {}),
        }
      );

      let nextEnabledModules = existing.enabled_modules;
      if (Array.isArray(body.commercialModuleKeys)) {
        nextEnabledModules = expandCommercialToErpModules(
          body.commercialModuleKeys
        );
      }

      let nextSubscription = existing.subscription;
      if (body.recalculateSubscription) {
        const pricingConfig = await getPricingConfig();
        const recalc = calculateSubscriptionQuote({
          optionType: nextOptionType,
          pricingConfig,
          customOptionBasePrice:
            body.customOptionBasePrice !== undefined
              ? Number(body.customOptionBasePrice)
              : existing.subscription.optionBasePrice,
          moduleOverrides: Array.isArray(body.moduleOverrides)
            ? body.moduleOverrides
            : existing.subscription.selectedModules.map((m) => ({
                moduleKey: m.moduleKey,
                customPrice: m.basePrice,
                discountPct: m.discountPct,
                discountFixed: m.discountFixed,
              })),
          globalDiscountType: (body.globalDiscountType ||
            existing.subscription.globalDiscountType ||
            "none") as DiscountDurationType,
          globalDiscountPct:
            body.globalDiscountPct !== undefined
              ? Number(body.globalDiscountPct)
              : existing.subscription.globalDiscountPct,
          globalDiscountFixed:
            body.globalDiscountFixed !== undefined
              ? Number(body.globalDiscountFixed)
              : existing.subscription.globalDiscountFixed,
          temporaryMonths:
            body.temporaryMonths !== undefined
              ? Number(body.temporaryMonths)
              : existing.subscription.temporaryMonths,
          payerEmail: String(
            body.payerEmail ?? existing.subscription.payerEmail ?? ""
          ),
        });
        nextSubscription = {
          ...recalc,
          mpPreapprovalId: existing.subscription.mpPreapprovalId,
          mpInitPoint: existing.subscription.mpInitPoint,
          mpStatus: existing.subscription.mpStatus,
        };
      }

      const nextStatus = existing.is_base
        ? "active"
        : body.status || existing.status;

      const requestedActividad =
        body.actividadNegocio === "comercial" ||
        body.actividadNegocio === "servicios" ||
        body.actividadNegocio === "mixta"
          ? body.actividadNegocio
          : undefined;
      const nextDeployment = requestedActividad
        ? {
            ...(existing.deployment || {}),
            actividadNegocio: requestedActividad,
          }
        : existing.deployment;

      const patch: Partial<ErpTenantRecord> = {
        option_type: nextOptionType,
        business_name: String(
          body.businessName || existing.business_name
        ).trim(),
        fantasy_name: String(body.fantasyName || existing.fantasy_name).trim(),
        custom_domain:
          nextOptionType === 1
            ? body.customDomain
              ? String(body.customDomain).trim().toLowerCase()
              : existing.custom_domain
            : null,
        status: nextStatus,
        branding: nextBranding,
        enabled_modules: nextEnabledModules,
        subscription: nextSubscription,
        ...(requestedActividad ? { deployment: nextDeployment } : {}),
        updated_at: new Date().toISOString(),
      };

      const { data: updated, error } = await sb
        .from("erp_tenants")
        .update(patch)
        .eq("slug", slug)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json(
          { ok: false, message: error.message },
          { status: 400 }
        );
      }

      if (requestedActividad && updated) {
        try {
          const { payload: srvDoc } = await getTenantDoc<AnyObj>(
            updated as ErpTenantRecord,
            "servicios_db",
            {}
          );
          if (srvDoc && typeof srvDoc === "object") {
            const nextCfg = {
              ...(srvDoc.config || {}),
              actividadNegocio: requestedActividad,
              updatedAt: new Date().toISOString(),
              updatedBy: GENERAL_ADMIN_USERNAME,
            };
            await putTenantDoc(
              updated as ErpTenantRecord,
              "servicios_db",
              { ...srvDoc, config: nextCfg },
              GENERAL_ADMIN_USERNAME,
              "sync_actividad_negocio"
            );
          }
        } catch {
          // Non-fatal: tenant record already holds deployment.actividadNegocio
        }
      }

      return NextResponse.json({
        ok: true,
        message: `Comercio "${updated.fantasy_name}" actualizado.`,
        tenant: updated,
      });
    }

    if (action === "generate_mp_link") {
      const slug = String(body.slug || "").trim().toLowerCase();
      const tenant = await getTenantBySlug(slug);
      if (!tenant) {
        return NextResponse.json(
          { ok: false, message: "Comercio no encontrado." },
          { status: 404 }
        );
      }
      if (body.payerEmail) {
        tenant.subscription.payerEmail = String(body.payerEmail).trim();
      }
      try {
        const sub = await createOrUpdateMpPreapproval(tenant, siteOrigin);
        const { data: updated } = await sb
          .from("erp_tenants")
          .update({
            subscription: sub,
            updated_at: new Date().toISOString(),
          })
          .eq("slug", slug)
          .select("*")
          .single();

        await sb.from("erp_subscription_events").insert({
          tenant_slug: slug,
          event_type: "MP_PREAPPROVAL_CREATED",
          mp_preapproval_id: sub.mpPreapprovalId,
          amount: sub.activeMonthlyAmount,
          payload: { initPoint: sub.mpInitPoint, status: sub.mpStatus },
        });

        return NextResponse.json({
          ok: true,
          message:
            sub.mpStatus === "sandbox_ready"
              ? "Link de adhesión en Modo Prueba generado (cargá tu Access Token de Mercado Pago en Credenciales API para cobro real)."
              : "Suscripción de Débito Automático generada en Mercado Pago.",
          subscription: sub,
          tenant: updated,
        });
      } catch (err) {
        return NextResponse.json(
          {
            ok: false,
            message:
              err instanceof Error
                ? err.message
                : "Error al conectar con Mercado Pago",
          },
          { status: 400 }
        );
      }
    }

    if (action === "reprovision_option1_domain") {
      const slug = String(body.slug || "").trim().toLowerCase();
      const tenant = await getTenantBySlug(slug);
      if (!tenant || tenant.option_type !== 1 || !tenant.custom_domain) {
        return NextResponse.json(
          {
            ok: false,
            message: "El comercio debe ser Opción 1 con dominio propio asignado.",
          },
          { status: 400 }
        );
      }
      const deployment = await provisionOption1Deployment({
        slug: tenant.slug,
        businessName: tenant.business_name,
        customDomain: tenant.custom_domain,
      });
      const { data: updated } = await sb
        .from("erp_tenants")
        .update({ deployment, updated_at: new Date().toISOString() })
        .eq("slug", slug)
        .select("*")
        .single();
      return NextResponse.json({
        ok: true,
        message: deployment.notes || "Aprovisionamiento GitHub + Vercel ejecutado.",
        tenant: updated,
      });
    }

    if (action === "save_tenant_user") {
      const slug = String(body.slug || "").trim().toLowerCase();
      const targetTenant = await getTenantBySlug(slug);
      if (!targetTenant) {
        return NextResponse.json(
          { ok: false, message: "Comercio no encontrado." },
          { status: 404 }
        );
      }
      const username = String(body.username || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "");
      if (!username || username.length < 3) {
        return NextResponse.json(
          { ok: false, message: "Usuario inválido (mínimo 3 caracteres)." },
          { status: 400 }
        );
      }
      const role =
        username === GENERAL_ADMIN_USERNAME
          ? "Administrador General"
          : String(body.role || "Usuario") === "Administrador"
            ? "Administrador"
            : "Usuario";
      const pass = String(body.password || "").trim();
      const name = String(body.name || username).trim();
      const saved = await upsertTenantUserInDb(targetTenant, {
        username,
        password_hash: pass.length >= 4 ? hashPassword(pass) : "",
        plain_compat: pass.length >= 4 ? pass : "",
        name,
        vendedor: name.toUpperCase(),
        role,
        branch: String(body.branch || targetTenant.fantasy_name || "Casa Central"),
        whatsapp: String(body.whatsapp || ""),
        avatar: "",
        modules:
          Array.isArray(body.modules) && body.modules.length > 0
            ? body.modules
            : targetTenant.enabled_modules,
        active: body.active !== false,
        actor: GENERAL_ADMIN_USERNAME,
      });
      return NextResponse.json({
        ok: true,
        message: `Usuario @${saved.username} (${role}) actualizado en ${targetTenant.fantasy_name}.`,
        user: saved,
      });
    }

    if (action === "delete_tenant_user") {
      const slug = String(body.slug || "").trim().toLowerCase();
      const targetTenant = await getTenantBySlug(slug);
      const username = String(body.username || "").trim().toLowerCase();
      if (!targetTenant || !username || username === GENERAL_ADMIN_USERNAME) {
        return NextResponse.json(
          { ok: false, message: "Operación no permitida." },
          { status: 400 }
        );
      }
      await softDeleteTenantUserInDb(targetTenant, username);
      return NextResponse.json({
        ok: true,
        message: `Usuario @${username} dado de baja.`,
      });
    }

    if (action === "save_global_user") {
      const targetSlug = String(body.tenantSlug || "").trim().toLowerCase();
      const rawUsername = String(body.username || "").trim();
      const password = String(body.password || "").trim();
      const name = String(body.name || rawUsername).trim();
      const email = String(body.email || "").trim();
      const whatsapp = String(body.whatsapp || "").trim();
      const notes = String(body.notes || "").trim();
      const rawStatus = String(body.status || "active") as GlobalUserStatus;
      const status: GlobalUserStatus =
        rawStatus === "suspended_nonpayment" || rawStatus === "disabled"
          ? rawStatus
          : "active";
      const userType = normalizeDefinedUserType(body.userType, rawUsername);

      if (!rawUsername || rawUsername.length < 2) {
        return NextResponse.json(
          { ok: false, message: "Ingresá un usuario o correo válido." },
          { status: 400 }
        );
      }

      if (targetSlug) {
        const targetTenant = await getTenantBySlug(targetSlug);
        if (!targetTenant) {
          return NextResponse.json(
            { ok: false, message: "El sistema / comercio seleccionado no existe." },
            { status: 404 }
          );
        }
        const cleanErpUser = rawUsername
          .toLowerCase()
          .replace(/[^a-z0-9._@-]/g, "");
        const isProtectedDaniel =
          cleanErpUser === GENERAL_ADMIN_USERNAME && targetTenant.is_base;
        const effectiveStatus: GlobalUserStatus = isProtectedDaniel ? "active" : status;
        const erpRole = mapUserTypeToErpRole(userType, cleanErpUser);

        await upsertTenantUserInDb(targetTenant, {
          username: cleanErpUser,
          password_hash: password.length >= 3 ? hashPassword(password) : "",
          plain_compat: password.length >= 3 ? password : "",
          name,
          vendedor: name.toUpperCase(),
          role: erpRole,
          branch: targetTenant.fantasy_name || "Casa Central",
          whatsapp,
          avatar: "",
          modules: targetTenant.enabled_modules,
          active: effectiveStatus === "active",
          actor: GENERAL_ADMIN_USERNAME,
        });

        const { payload: suspDb } = await getTenantDoc<
          Record<string, { reason?: string; note?: string; userType?: DefinedUserType }>
        >(targetTenant, "users_suspension_meta", {});
        suspDb[cleanErpUser] = {
          reason:
            effectiveStatus === "suspended_nonpayment"
              ? "falta_pago"
              : effectiveStatus === "disabled"
                ? "manual"
                : "",
          note: notes,
          userType,
        };
        await putTenantDoc(
          targetTenant,
          "users_suspension_meta",
          suspDb,
          GENERAL_ADMIN_USERNAME,
          "save_global_user_meta"
        );

        return NextResponse.json({
          ok: true,
          message: `Usuario @${cleanErpUser} (${userType}) guardado y sincronizado en ${targetTenant.fantasy_name}.`,
        });
      }

      // Usuario de Proyecto Externo / Bóveda Maestra
      const project = String(body.project || "").trim() || "Proyecto Externo";
      const projectUrl = String(body.projectUrl || "").trim();
      const vaultDoc = await getAndEnsureVaultDoc(baseTenant);
      const nowIso = new Date().toISOString();
      const reqId = String(body.id || "").trim();
      const idx = reqId
        ? vaultDoc.items.findIndex((x) => x.id === reqId)
        : -1;

      if (idx >= 0) {
        vaultDoc.items[idx] = {
          ...vaultDoc.items[idx],
          source: "project_vault",
          tenantSlug: null,
          project,
          projectUrl,
          name,
          username: rawUsername,
          email,
          password: password || vaultDoc.items[idx].password,
          userType,
          status,
          suspendedReason:
            status === "suspended_nonpayment"
              ? notes || "Deshabilitado transitoriamente por falta de pago"
              : status === "disabled"
                ? notes || "Deshabilitado manualmente"
                : "",
          whatsapp,
          notes,
          deleted: false,
          updatedAt: nowIso,
        };
      } else {
        const newId = `vault_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        vaultDoc.items.unshift({
          id: newId,
          source: "project_vault",
          tenantSlug: null,
          project,
          projectUrl,
          name,
          username: rawUsername,
          email,
          password,
          userType,
          status,
          suspendedReason:
            status === "suspended_nonpayment"
              ? notes || "Deshabilitado transitoriamente por falta de pago"
              : "",
          whatsapp,
          notes,
          deleted: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      vaultDoc.updatedAt = nowIso;
      await putTenantDoc(
        baseTenant,
        GLOBAL_USERS_DOC_KEY,
        vaultDoc,
        GENERAL_ADMIN_USERNAME,
        "save_vault_user"
      );

      return NextResponse.json({
        ok: true,
        message: `Usuario "${rawUsername}" guardado en el proyecto "${project}".`,
      });
    }

    if (action === "toggle_global_user_status") {
      const rowId = String(body.id || "").trim();
      const targetSlug = String(body.tenantSlug || "").trim().toLowerCase();
      const username = String(body.username || "").trim().toLowerCase();
      const nextStatus = String(body.status || "active") as GlobalUserStatus;
      const reasonNote = String(body.note || "").trim();

      if (targetSlug) {
        const targetTenant = await getTenantBySlug(targetSlug);
        if (!targetTenant) {
          return NextResponse.json(
            { ok: false, message: "Comercio no encontrado." },
            { status: 404 }
          );
        }
        if (username === GENERAL_ADMIN_USERNAME) {
          return NextResponse.json(
            {
              ok: false,
              message: "El usuario Admin. Gral. (@danielg) nunca puede deshabilitarse.",
            },
            { status: 400 }
          );
        }
        const existingUsers = await listTenantUsersFromDb(targetTenant);
        const uRec = existingUsers.find(
          (u) => u.username.toLowerCase() === username
        );
        if (!uRec) {
          return NextResponse.json(
            { ok: false, message: "Usuario no encontrado en el comercio." },
            { status: 404 }
          );
        }

        await upsertTenantUserInDb(targetTenant, {
          ...uRec,
          active: nextStatus === "active",
          actor: GENERAL_ADMIN_USERNAME,
        });

        const { payload: suspDb } = await getTenantDoc<
          Record<string, { reason?: string; note?: string; userType?: DefinedUserType }>
        >(targetTenant, "users_suspension_meta", {});
        suspDb[username] = {
          ...(suspDb[username] || {}),
          reason:
            nextStatus === "suspended_nonpayment"
              ? "falta_pago"
              : nextStatus === "disabled"
                ? "manual"
                : "",
          note:
            reasonNote ||
            (nextStatus === "suspended_nonpayment"
              ? "Deshabilitado transitoriamente por falta de pago"
              : ""),
        };
        await putTenantDoc(
          targetTenant,
          "users_suspension_meta",
          suspDb,
          GENERAL_ADMIN_USERNAME,
          "toggle_global_user_status"
        );

        return NextResponse.json({
          ok: true,
          message:
            nextStatus === "suspended_nonpayment"
              ? `⏸️ Usuario @${username} (${targetTenant.fantasy_name}) deshabilitado transitoriamente por falta de pago.`
              : nextStatus === "active"
                ? `✅ Usuario @${username} (${targetTenant.fantasy_name}) rehabilitado.`
                : `⛔ Usuario @${username} deshabilitado.`,
        });
      }

      const vaultDoc = await getAndEnsureVaultDoc(baseTenant);
      const idx = vaultDoc.items.findIndex((x) => x.id === rowId);
      if (idx < 0) {
        return NextResponse.json(
          { ok: false, message: "Registro de usuario no encontrado." },
          { status: 404 }
        );
      }
      vaultDoc.items[idx].status = nextStatus;
      vaultDoc.items[idx].suspendedReason =
        nextStatus === "suspended_nonpayment"
          ? reasonNote || "Deshabilitado transitoriamente por falta de pago"
          : nextStatus === "disabled"
            ? reasonNote || "Deshabilitado manualmente"
            : "";
      vaultDoc.items[idx].updatedAt = new Date().toISOString();
      vaultDoc.updatedAt = new Date().toISOString();
      await putTenantDoc(
        baseTenant,
        GLOBAL_USERS_DOC_KEY,
        vaultDoc,
        GENERAL_ADMIN_USERNAME,
        "toggle_vault_user_status"
      );

      return NextResponse.json({
        ok: true,
        message:
          nextStatus === "suspended_nonpayment"
            ? `⏸️ Usuario "${vaultDoc.items[idx].username}" marcado como suspendido por falta de pago.`
            : nextStatus === "active"
              ? `✅ Usuario "${vaultDoc.items[idx].username}" rehabilitado.`
              : `⛔ Usuario "${vaultDoc.items[idx].username}" deshabilitado.`,
      });
    }

    if (action === "toggle_project_nonpayment") {
      const project = String(body.project || "").trim();
      const targetSlug = String(body.tenantSlug || "").trim().toLowerCase();
      const suspend = Boolean(body.suspend);

      if (targetSlug) {
        const targetTenant = await getTenantBySlug(targetSlug);
        if (!targetTenant || targetTenant.is_base) {
          return NextResponse.json(
            {
              ok: false,
              message: "El sistema base de MiniSistema no puede suspenderse.",
            },
            { status: 400 }
          );
        }
        await sb
          .from("erp_tenants")
          .update({
            status: suspend ? "suspended" : "active",
            updated_at: new Date().toISOString(),
          })
          .eq("slug", targetTenant.slug);

        const tUsers = await listTenantUsersFromDb(targetTenant);
        const { payload: suspDb } = await getTenantDoc<
          Record<string, { reason?: string; note?: string; userType?: DefinedUserType }>
        >(targetTenant, "users_suspension_meta", {});
        for (const u of tUsers) {
          if (u.username.toLowerCase() === GENERAL_ADMIN_USERNAME) continue;
          await upsertTenantUserInDb(targetTenant, {
            ...u,
            active: !suspend,
            actor: GENERAL_ADMIN_USERNAME,
          });
          suspDb[u.username.toLowerCase()] = {
            ...(suspDb[u.username.toLowerCase()] || {}),
            reason: suspend ? "falta_pago" : "",
            note: suspend ? "Suspensión transitoria por falta de pago" : "",
          };
        }
        await putTenantDoc(
          targetTenant,
          "users_suspension_meta",
          suspDb,
          GENERAL_ADMIN_USERNAME,
          "toggle_project_nonpayment"
        );
        return NextResponse.json({
          ok: true,
          message: suspend
            ? `⏸️ Todos los usuarios de "${targetTenant.fantasy_name}" fueron suspendidos transitoriamente por falta de pago.`
            : `✅ Todos los usuarios de "${targetTenant.fantasy_name}" fueron rehabilitados.`,
        });
      }

      if (!project) {
        return NextResponse.json(
          { ok: false, message: "Seleccioná un proyecto válido." },
          { status: 400 }
        );
      }
      const vaultDoc = await getAndEnsureVaultDoc(baseTenant);
      let count = 0;
      for (const item of vaultDoc.items) {
        if (!item.deleted && item.project === project) {
          item.status = suspend ? "suspended_nonpayment" : "active";
          item.suspendedReason = suspend
            ? "Deshabilitado transitoriamente por falta de pago"
            : "";
          item.updatedAt = new Date().toISOString();
          count++;
        }
      }
      vaultDoc.updatedAt = new Date().toISOString();
      await putTenantDoc(
        baseTenant,
        GLOBAL_USERS_DOC_KEY,
        vaultDoc,
        GENERAL_ADMIN_USERNAME,
        "toggle_project_nonpayment"
      );
      return NextResponse.json({
        ok: true,
        message: suspend
          ? `⏸️ ${count} usuario(s) de "${project}" marcados en suspensión transitoria por falta de pago.`
          : `✅ ${count} usuario(s) de "${project}" rehabilitados.`,
      });
    }

    if (action === "delete_global_user") {
      const rowId = String(body.id || "").trim();
      const targetSlug = String(body.tenantSlug || "").trim().toLowerCase();
      const username = String(body.username || "").trim().toLowerCase();

      if (targetSlug) {
        const targetTenant = await getTenantBySlug(targetSlug);
        if (!targetTenant || !username || username === GENERAL_ADMIN_USERNAME) {
          return NextResponse.json(
            {
              ok: false,
              message: "No se puede dar de baja al Admin. Gral. (@danielg).",
            },
            { status: 400 }
          );
        }
        await softDeleteTenantUserInDb(targetTenant, username);
        return NextResponse.json({
          ok: true,
          message: `🗑️ Usuario @${username} eliminado de ${targetTenant.fantasy_name}.`,
        });
      }

      const vaultDoc = await getAndEnsureVaultDoc(baseTenant);
      const idx = vaultDoc.items.findIndex((x) => x.id === rowId);
      if (idx < 0) {
        return NextResponse.json(
          { ok: false, message: "Usuario no encontrado." },
          { status: 404 }
        );
      }
      vaultDoc.items[idx].deleted = true;
      vaultDoc.items[idx].updatedAt = new Date().toISOString();
      vaultDoc.updatedAt = new Date().toISOString();
      await putTenantDoc(
        baseTenant,
        GLOBAL_USERS_DOC_KEY,
        vaultDoc,
        GENERAL_ADMIN_USERNAME,
        "delete_vault_user"
      );
      return NextResponse.json({
        ok: true,
        message: `🗑️ Usuario "${vaultDoc.items[idx].username}" dado de baja del directorio.`,
      });
    }

    return NextResponse.json(
      { ok: false, message: `Acción desconocida: ${action}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: false }, { status: 405 });
}
