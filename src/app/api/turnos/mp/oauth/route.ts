import { NextRequest, NextResponse } from "next/server";
import { loadTurnosDb, TURNOS_DOC_KEY } from "@/lib/erp/handlers/turnos-handler";
import { putTenantDoc } from "@/lib/erp/supabase-server";
import {
  getTenantBySlug,
  resolveActiveTenantFromRequest,
} from "@/lib/erp/tenant-service";
import {
  encryptProfesionalMpTokens,
  getMpMarketplaceConfig,
} from "@/lib/erp/turnos-mp-server";

export const dynamic = "force-dynamic";

/**
 * Callback OAuth 2.0 de Mercado Pago Marketplace para vincular la cuenta de un Profesional
 * y permitir el Split automático 1:1 (marketplace_fee) en consultas Particulares.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateRaw = req.nextUrl.searchParams.get("state") || "";
  const [tenantSlug, profesionalId] = stateRaw.includes("::")
    ? stateRaw.split("::")
    : [req.nextUrl.searchParams.get("tenant") || "minisistema", req.nextUrl.searchParams.get("profesionalId") || ""];

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "www.minisistema.com.ar";
  const proto = host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
  const redirectUri = `${proto}://${host}/api/turnos/mp/oauth`;

  const mpCfg = await getMpMarketplaceConfig();

  // Intercambio de authorization_code por access_token del profesional
  if (code && profesionalId && mpCfg.clientId && mpCfg.clientSecret) {
    try {
      const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_secret: mpCfg.clientSecret,
          client_id: mpCfg.clientId,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      });
      const tokenData = (await tokenRes.json().catch(() => ({}))) as Record<string, any>;
      if (tokenRes.ok && tokenData.access_token) {
        const tenant =
          (await getTenantBySlug(tenantSlug)) ||
          (await resolveActiveTenantFromRequest(req));
        const db = await loadTurnosDb(tenant);
        const prof = db.profesionales.find((p) => p.id === profesionalId);
        if (prof) {
          const bundle = encryptProfesionalMpTokens(
            String(tokenData.access_token),
            String(tokenData.refresh_token || ""),
            Number(tokenData.expires_in || 15552000)
          );
          const nowIso = new Date().toISOString();
          prof.mpAccount = {
            linked: true,
            mpUserId: String(tokenData.user_id || ""),
            mpPublicKey: String(tokenData.public_key || ""),
            mpAccountAlias: prof.mpAccount?.mpAccountAlias || null,
            tokenStatus: "active",
            tokenExpiresAt: bundle.expiresAt,
            linkedAt: nowIso,
            lastRefreshedAt: nowIso,
            encryptedTokenPayload: bundle.encryptedTokenPayload,
            ivHex: bundle.ivHex,
            authTagHex: bundle.authTagHex,
          };
          prof.updatedAt = nowIso;
          db.updatedAt = nowIso;
          await putTenantDoc(tenant, TURNOS_DOC_KEY, db, "mp_oauth", "oauth_prof_linked");
        }
        return NextResponse.redirect(new URL("/sistema?turnos_mp_oauth=connected", req.url));
      }
    } catch (err) {
      console.error("[Turnos MP OAuth Callback Error]", err);
      return NextResponse.redirect(new URL("/sistema?turnos_mp_oauth=error", req.url));
    }
  }

  const stateParam = `${tenantSlug || "minisistema"}::${profesionalId}`;
  const authUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${encodeURIComponent(
    mpCfg.clientId || "MP_MARKETPLACE_APP_ID"
  )}&response_type=code&platform_id=mp&state=${encodeURIComponent(
    stateParam
  )}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.json({
    ok: true,
    configured: mpCfg.configured,
    authorizationUrl: authUrl,
    redirectUri,
  });
}
