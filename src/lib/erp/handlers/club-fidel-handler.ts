import { NextRequest, NextResponse } from "next/server";
import { extractErpSessionFromRequest } from "../erp-session";
import {
  getPlatformSupabase,
  getTenantDoc,
  putTenantDoc,
} from "../supabase-server";
import {
  getPlatformSecretsMap,
  savePlatformSecretsMap,
} from "../tenant-service";
import {
  type ErpTenantRecord,
  GENERAL_ADMIN_USERNAME,
  normalizeErpRole,
} from "../types";

type AnyObj = Record<string, unknown>;

interface TenantClubFidelErpConfig {
  updatedAt: string;
  merchantId?: string | null;
  merchantSlug?: string | null;
  cuit?: string | null;
  erpApiKey?: string | null;
  erpApiKeyPrefix?: string | null;
  defaultBranchCode?: string | null;
  defaultProgramCode?: string | null;
  autoEmitOnPosSale?: boolean;
}

const TENANT_CF_CONFIG_DOC = "club_fidel_erp_config_v1";

function isGeneralAdmin(
  session: { username: string; role: string } | null
): boolean {
  if (!session) return false;
  const user = String(session.username || "").trim().toLowerCase();
  if (user === GENERAL_ADMIN_USERNAME) return true;
  return normalizeErpRole(session.role, user) === "Administrador General";
}

function hasTenantClubFidelPermission(
  tenant: ErpTenantRecord,
  session: { username: string; role: string } | null
): boolean {
  if (!session) return false;
  if (isGeneralAdmin(session)) return true;
  const enabled = Array.isArray(tenant.enabled_modules)
    ? tenant.enabled_modules
    : [];
  return enabled.some(
    (k) => k === "club_fidel" || String(k).startsWith("club_fidel:")
  );
}

function maskKey(val: string | undefined | null): string {
  const s = String(val || "").trim();
  if (!s) return "";
  if (s.length <= 12) return "••••••••";
  return `${s.slice(0, 12)}••••••••${s.slice(-4)}`;
}

async function resolveClubFidelConnection() {
  const secrets = await getPlatformSecretsMap();
  const baseUrl = String(
    secrets.clubfidel_api_url ||
      process.env.CLUBFIDEL_API_URL ||
      "https://www.clubfidel.com.ar"
  )
    .trim()
    .replace(/\/+$/, "");
  const adminSecret = String(
    secrets.clubfidel_admin_secret || process.env.CLUBFIDEL_ADMIN_SECRET || ""
  ).trim();
  return { baseUrl, adminSecret };
}

async function callClubFidelAdminApi(
  method: "GET" | "POST",
  queryOrBody?: Record<string, unknown>
): Promise<{ status: number; data: AnyObj }> {
  const { baseUrl, adminSecret } = await resolveClubFidelConnection();

  if (!adminSecret) {
    return {
      status: 200,
      data: {
        ok: true,
        needsSecretConfig: true,
        publicAppUrl: baseUrl,
        message:
          "Falta configurar la clave de sincronización (clubfidel_admin_secret) para conectar en tiempo real con Club Fidel.",
      },
    };
  }

  let targetUrl = `${baseUrl}/api/v1/minisistema/admin`;
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-MiniSistema-Secret": adminSecret,
      Authorization: `Bearer ${adminSecret}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(35_000),
  };

  if (method === "GET" && queryOrBody) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(queryOrBody)) {
      if (v !== undefined && v !== null && String(v) !== "") {
        qs.set(k, String(v));
      }
    }
    const qsStr = qs.toString();
    if (qsStr) targetUrl += `?${qsStr}`;
  } else if (method === "POST") {
    init.body = JSON.stringify(queryOrBody || {});
  }

  const res = await fetch(targetUrl, init);
  const json = (await res.json().catch(() => ({}))) as AnyObj;
  return { status: res.status, data: json };
}

export async function handleErpClubFidel(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const session =
    extractErpSessionFromRequest(req, tenant.slug) ||
    extractErpSessionFromRequest(req, "minisistema");

  const isGlobalSuperAdmin = tenant.is_base && isGeneralAdmin(session);

  if (!isGlobalSuperAdmin && !hasTenantClubFidelPermission(tenant, session)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "No tenés permisos habilitados para acceder al módulo Club Fidel.",
      },
      { status: 403 }
    );
  }

  const actor = session?.username || GENERAL_ADMIN_USERNAME;

  // =========================================================================
  // MODO 1: SUPERADMIN GENERAL (@danielg en MiniSistema Base)
  // =========================================================================
  if (isGlobalSuperAdmin) {
    const sb = await getPlatformSupabase();

    if (req.method === "GET") {
      const [{ data: msTenants }, cfRes, conn] = await Promise.all([
        sb
          .from("erp_tenants")
          .select(
            "slug, is_base, option_type, business_name, fantasy_name, custom_domain, status, branding, enabled_modules"
          )
          .order("is_base", { ascending: false })
          .order("created_at", { ascending: false }),
        callClubFidelAdminApi("GET", { scope: "admin" }),
        resolveClubFidelConnection(),
      ]);

      return NextResponse.json({
        ...cfRes.data,
        ok: cfRes.data.ok !== false,
        mode: "superadmin",
        connection: {
          apiUrl: conn.baseUrl,
          secretConfigured: Boolean(conn.adminSecret),
          secretMasked: maskKey(conn.adminSecret),
        },
        minisistemaTenants: (msTenants || []).filter(
          (t: { is_base?: boolean }) => !t.is_base
        ),
      });
    }

    if (req.method === "POST") {
      const body = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
      const action = String(body.action || "").trim();

      if (action === "save_connection_config") {
        const updates: Record<string, string> = {};
        if (typeof body.apiUrl === "string" && body.apiUrl.trim()) {
          updates.clubfidel_api_url = body.apiUrl.trim().replace(/\/+$/, "");
        }
        if (
          typeof body.adminSecret === "string" &&
          body.adminSecret.trim() &&
          !body.adminSecret.includes("••••")
        ) {
          updates.clubfidel_admin_secret = body.adminSecret.trim();
        }
        await savePlatformSecretsMap(updates);
        return NextResponse.json({
          ok: true,
          message:
            "Conexión administrativa entre MiniSistema y Club Fidel guardada correctamente.",
        });
      }

      if (action === "link_minisistema_tenant") {
        const targetSlug = String(body.tenantSlug || "")
          .trim()
          .toLowerCase();
        const { data: targetRow } = await sb
          .from("erp_tenants")
          .select("*")
          .eq("slug", targetSlug)
          .maybeSingle();

        if (!targetRow) {
          return NextResponse.json(
            { ok: false, message: "Comercio de MiniSistema no encontrado." },
            { status: 404 }
          );
        }

        const tRec = targetRow as ErpTenantRecord;
        const rawCuit = String(
          body.cuit || tRec.branding?.cuitFmt || ""
        ).replace(/\D/g, "");
        const email = String(
          body.email ||
            tRec.subscription?.payerEmail ||
            tRec.branding?.emailInfo ||
            `${tRec.slug}@minisistema.com.ar`
        )
          .trim()
          .toLowerCase();

        const cfOnboard = await callClubFidelAdminApi("POST", {
          action: "onboard_merchant",
          actorEmail: `${actor}@minisistema.com.ar`,
          tradeName: tRec.fantasy_name || tRec.business_name,
          legalName: tRec.business_name || tRec.fantasy_name,
          cuit: rawCuit,
          rubro: String(body.rubro || "Comercio Adherido MiniSistema"),
          email,
          phone: tRec.branding?.whatsappDisplay || tRec.branding?.whatsappDigits || "",
          address: tRec.branding?.address || "Casa Central",
          locality: tRec.branding?.localidad || "Río Cuarto",
          province: tRec.branding?.provincia || "Córdoba",
          planCode: String(body.planCode || "PROFESIONAL"),
          initialPoints: Number(body.initialPoints || 0),
          createErpKey: true,
        });

        if (!cfOnboard.data.ok) {
          return NextResponse.json(
            {
              ok: false,
              message: String(
                cfOnboard.data.error ||
                  cfOnboard.data.message ||
                  "No se pudo dar de alta en Club Fidel."
              ),
            },
            { status: 422 }
          );
        }

        const createdMerchant = (cfOnboard.data.merchant || {}) as AnyObj;
        const rawErpApiKey = String(cfOnboard.data.rawErpApiKey || "");

        // Guardar credencial ERP en el documento aislado del tenant en MiniSistema
        const nextTenantCfg: TenantClubFidelErpConfig = {
          updatedAt: new Date().toISOString(),
          merchantId: String(createdMerchant.id || ""),
          merchantSlug: String(createdMerchant.slug || ""),
          cuit: rawCuit,
          erpApiKey: rawErpApiKey || null,
          erpApiKeyPrefix: rawErpApiKey ? rawErpApiKey.slice(0, 14) : null,
          defaultBranchCode: "CENTRAL",
          autoEmitOnPosSale: true,
        };
        await putTenantDoc(
          tRec,
          TENANT_CF_CONFIG_DOC,
          nextTenantCfg,
          actor,
          "link_club_fidel_merchant"
        );

        // Asegurar que el módulo club_fidel quede habilitado en enabled_modules del comercio
        const currentMods = new Set(
          Array.isArray(tRec.enabled_modules) ? tRec.enabled_modules : []
        );
        currentMods.add("club_fidel");
        currentMods.add("club_fidel:panel");
        currentMods.add("club_fidel:emision_pos");
        currentMods.add("club_fidel:programa_campanas");
        currentMods.add("club_fidel:catalogo_ordenes");
        currentMods.add("club_fidel:puntos_respaldo");
        currentMods.add("club_fidel:red_abierta");

        await sb
          .from("erp_tenants")
          .update({
            enabled_modules: Array.from(currentMods),
            updated_at: new Date().toISOString(),
          })
          .eq("slug", tRec.slug);

        return NextResponse.json({
          ok: true,
          message: `Comercio "${tRec.fantasy_name}" vinculado a Club Fidel, módulo habilitado y API Key ERP sincronizada automáticamente.`,
          merchant: createdMerchant,
          rawErpApiKey,
        });
      }

      const forwarded = await callClubFidelAdminApi("POST", {
        ...body,
        actorEmail: `${actor}@minisistema.com.ar`,
      });
      return NextResponse.json(
        {
          ...forwarded.data,
          message: String(
            forwarded.data.message ||
              forwarded.data.error ||
              "Operación procesada."
          ),
        },
        { status: forwarded.status }
      );
    }
  }

  // =========================================================================
  // MODO 2: COMERCIO HIJO EN MINISISTEMA CON MÓDULO CLUB FIDEL HABILITADO
  // =========================================================================
  const { payload: localCfg } = await getTenantDoc<TenantClubFidelErpConfig>(
    tenant,
    TENANT_CF_CONFIG_DOC,
    { updatedAt: new Date().toISOString(), autoEmitOnPosSale: true }
  );
  const { baseUrl } = await resolveClubFidelConnection();

  if (req.method === "GET") {
    const cuit = String(
      localCfg?.cuit || tenant.branding?.cuitFmt || ""
    ).replace(/\D/g, "");
    const cfRes = await callClubFidelAdminApi("GET", {
      scope: "merchant",
      merchantId: localCfg?.merchantId || "",
      cuit,
      slug: tenant.slug,
    });

    return NextResponse.json({
      ...cfRes.data,
      ok: true,
      mode: "tenant",
      publicAppUrl: baseUrl,
      tenantConfig: {
        merchantId: localCfg?.merchantId || null,
        cuit,
        hasErpApiKey: Boolean(localCfg?.erpApiKey),
        erpApiKeyMasked: maskKey(localCfg?.erpApiKey),
        defaultBranchCode: localCfg?.defaultBranchCode || "CENTRAL",
        defaultProgramCode: localCfg?.defaultProgramCode || "",
        autoEmitOnPosSale: localCfg?.autoEmitOnPosSale !== false,
      },
    });
  }

  if (req.method === "POST") {
    const body = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
    const action = String(body.action || "").trim();

    if (action === "save_tenant_erp_key") {
      const nextCfg: TenantClubFidelErpConfig = {
        ...localCfg,
        updatedAt: new Date().toISOString(),
        cuit: String(body.cuit ?? localCfg?.cuit ?? tenant.branding?.cuitFmt ?? ""),
        defaultBranchCode: String(
          body.defaultBranchCode ?? localCfg?.defaultBranchCode ?? "CENTRAL"
        ).trim(),
        defaultProgramCode: String(
          body.defaultProgramCode ?? localCfg?.defaultProgramCode ?? ""
        ).trim(),
        autoEmitOnPosSale: body.autoEmitOnPosSale !== false,
      };
      if (
        typeof body.erpApiKey === "string" &&
        body.erpApiKey.trim() &&
        !body.erpApiKey.includes("••••")
      ) {
        nextCfg.erpApiKey = body.erpApiKey.trim();
        nextCfg.erpApiKeyPrefix = nextCfg.erpApiKey.slice(0, 14);
      }

      await putTenantDoc(
        tenant,
        TENANT_CF_CONFIG_DOC,
        nextCfg,
        actor,
        "save_tenant_club_fidel_config"
      );

      return NextResponse.json({
        ok: true,
        message: "Configuración ERP de Club Fidel guardada para este comercio.",
      });
    }

    if (action === "register_erp_purchase") {
      if (!localCfg?.erpApiKey) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Este comercio aún no tiene una API Key ERP (cf_live_...) configurada.",
          },
          { status: 400 }
        );
      }

      const purchaseRes = await fetch(`${baseUrl}/api/v1/erp/purchases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": localCfg.erpApiKey,
        },
        body: JSON.stringify({
          externalTxId: String(
            body.externalTxId || `MS-${tenant.slug.toUpperCase()}-${Date.now()}`
          ),
          invoiceNumber: body.invoiceNumber
            ? String(body.invoiceNumber)
            : undefined,
          branchCode: String(
            body.branchCode || localCfg.defaultBranchCode || "CENTRAL"
          ),
          programCode: body.programCode
            ? String(body.programCode)
            : localCfg.defaultProgramCode || undefined,
          customerIdentifier: String(body.customerIdentifier || "").trim(),
          amountArs: Number(body.amountArs || 0),
          paymentMethod: body.paymentMethod
            ? String(body.paymentMethod)
            : "MOSTRADOR",
        }),
      });
      const data = (await purchaseRes.json().catch(() => ({}))) as AnyObj;
      return NextResponse.json(
        {
          ...data,
          message: data.ok
            ? `¡Puntos acreditados! +${data.pointsGranted} pts otorgados al socio.`
            : String(data.error || "No se pudo acreditar la compra."),
        },
        { status: purchaseRes.status }
      );
    }

    if (action === "reverse_erp_purchase") {
      if (!localCfg?.erpApiKey) {
        return NextResponse.json(
          {
            ok: false,
            message: "Este comercio no tiene API Key ERP configurada.",
          },
          { status: 400 }
        );
      }

      const revRes = await fetch(`${baseUrl}/api/v1/erp/reversals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": localCfg.erpApiKey,
        },
        body: JSON.stringify({
          externalTxId: String(body.externalTxId || "").trim(),
          reason: String(
            body.reason || `Anulación solicitada desde MiniSistema (${actor})`
          ).trim(),
        }),
      });
      const data = (await revRes.json().catch(() => ({}))) as AnyObj;
      return NextResponse.json(
        {
          ...data,
          message: data.ok
            ? `Operación revertida (-${data.pointsReversed} pts).`
            : String(data.error || "No se pudo revertir el comprobante."),
        },
        { status: revRes.status }
      );
    }
  }

  return NextResponse.json(
    { ok: false, message: "Acción no soportada." },
    { status: 400 }
  );
}
