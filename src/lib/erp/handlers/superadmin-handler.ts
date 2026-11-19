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
  type DiscountDurationType,
  ERP_COMMERCIAL_MODULES,
  type ErpTenantRecord,
  expandCommercialToErpModules,
  GENERAL_ADMIN_USERNAME,
  normalizeErpRole,
} from "../types";

type AnyObj = Record<string, any>;

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

  await ensureBaseMiniSistemaTenant();
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

    return NextResponse.json({
      ok: true,
      commercialModules: ERP_COMMERCIAL_MODULES,
      pricingConfig: pricing,
      tenants: tenants || [],
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

    return NextResponse.json(
      { ok: false, message: `Acción desconocida: ${action}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: false }, { status: 405 });
}
