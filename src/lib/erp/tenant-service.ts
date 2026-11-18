import { NextRequest } from "next/server";
import { buildCleanTenantSeed } from "./seed-clean-tenant";
import {
  getPlatformSupabase,
  provisionTenantSchemaInDb,
} from "./supabase-server";
import {
  ALL_ERP_MODULE_KEYS,
  type DiscountDurationType,
  ERP_COMMERCIAL_MODULES,
  type ErpModuleSelection,
  type ErpPricingConfigRecord,
  type ErpTenantBranding,
  type ErpTenantDeployment,
  type ErpTenantRecord,
  type ErpTenantSubscription,
  expandCommercialToErpModules,
  MINISISTEMA_OFFICIAL_COLORS,
  MINISISTEMA_OFFICIAL_LOGOS,
} from "./types";

const RESERVED_SLUGS = new Set([
  "sistema",
  "carrito",
  "verificador",
  "admin",
  "api",
  "privacidad",
  "brand",
  "photos",
  "projects",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

let baseBootstrapped = false;

export function isReservedAppSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}

export function sanitizeTenantSlug(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\.com\.ar.*$|\.ar.*$/g, "")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 44);
}

export function buildMiniSistemaBranding(
  overrides?: Partial<ErpTenantBranding>
): ErpTenantBranding {
  return {
    primaryHex: MINISISTEMA_OFFICIAL_COLORS.primaryHex,
    accentHex: MINISISTEMA_OFFICIAL_COLORS.accentHex,
    surfaceHex: MINISISTEMA_OFFICIAL_COLORS.surfaceHex,
    logo1x1Url: MINISISTEMA_OFFICIAL_LOGOS.logo1x1Url,
    logoHorizontalUrl: MINISISTEMA_OFFICIAL_LOGOS.logoHorizontalUrl,
    logoSymbolUrl: MINISISTEMA_OFFICIAL_LOGOS.logoSymbolUrl,
    clubName: overrides?.clubName || "Club MiniSistema",
    address: overrides?.address || "Río Cuarto, Córdoba, Argentina",
    localidad: overrides?.localidad || "RÍO CUARTO",
    provincia: overrides?.provincia || "CÓRDOBA",
    cp: overrides?.cp || "5800",
    whatsappDigits: overrides?.whatsappDigits || "5493585095475",
    whatsappDisplay: overrides?.whatsappDisplay || "+54 9 358 509-5475",
    emailInfo: overrides?.emailInfo || "contacto@minisistema.com.ar",
    cuitFmt: overrides?.cuitFmt || "A CONFIGURAR",
    condIva: overrides?.condIva || "IVA RESPONSABLE INSCRIPTO",
    iibb: overrides?.iibb || "—",
    inicioAct: overrides?.inicioAct || "—",
  };
}

export function enforceOptionBranding(
  optionType: 1 | 2,
  isBase: boolean,
  rawBranding?: Partial<ErpTenantBranding>
): ErpTenantBranding {
  const base = buildMiniSistemaBranding(rawBranding);
  if (isBase || optionType === 2) {
    // Opción 2 y base MiniSistema: siempre colores y logotipos oficiales de MiniSistema
    return {
      ...base,
      primaryHex: MINISISTEMA_OFFICIAL_COLORS.primaryHex,
      accentHex: MINISISTEMA_OFFICIAL_COLORS.accentHex,
      surfaceHex: MINISISTEMA_OFFICIAL_COLORS.surfaceHex,
      logo1x1Url: MINISISTEMA_OFFICIAL_LOGOS.logo1x1Url,
      logoHorizontalUrl: MINISISTEMA_OFFICIAL_LOGOS.logoHorizontalUrl,
      logoSymbolUrl: MINISISTEMA_OFFICIAL_LOGOS.logoSymbolUrl,
    };
  }
  // Opción 1: permite imagen corporativa propia (colores y logos propios)
  return {
    ...base,
    primaryHex: rawBranding?.primaryHex || MINISISTEMA_OFFICIAL_COLORS.primaryHex,
    accentHex: rawBranding?.accentHex || MINISISTEMA_OFFICIAL_COLORS.accentHex,
    surfaceHex: rawBranding?.surfaceHex || "#FFFFFF",
    logo1x1Url: rawBranding?.logo1x1Url || MINISISTEMA_OFFICIAL_LOGOS.logo1x1Url,
    logoHorizontalUrl:
      rawBranding?.logoHorizontalUrl || MINISISTEMA_OFFICIAL_LOGOS.logoHorizontalUrl,
    logoSymbolUrl:
      rawBranding?.logoSymbolUrl ||
      rawBranding?.logo1x1Url ||
      MINISISTEMA_OFFICIAL_LOGOS.logoSymbolUrl,
  };
}

export function buildDefaultPricingConfig(): ErpPricingConfigRecord {
  const modulePrices: ErpPricingConfigRecord["module_prices"] = {};
  for (const m of ERP_COMMERCIAL_MODULES) {
    modulePrices[m.key] = {
      price: m.defaultMonthlyArs,
      defaultDiscountPct: 0,
    };
  }
  return {
    id: "default",
    option_1_base: 35000,
    option_2_base: 15000,
    module_prices: modulePrices,
    discount_presets: [
      {
        id: "promo_3m_20",
        label: "Lanzamiento 20% OFF por 3 meses",
        durationType: "temporary",
        months: 3,
        discountPct: 20,
      },
      {
        id: "promo_6m_15",
        label: "Bienvenida 15% OFF por 6 meses",
        durationType: "temporary",
        months: 6,
        discountPct: 15,
      },
      {
        id: "perm_10",
        label: "Convenio Permanente 10% OFF",
        durationType: "permanent",
        months: 0,
        discountPct: 10,
      },
    ],
    currency: "ARS",
  };
}

export function calculateSubscriptionQuote(params: {
  optionType: 1 | 2;
  pricingConfig: ErpPricingConfigRecord;
  customOptionBasePrice?: number | null;
  moduleOverrides: Array<{
    moduleKey: string;
    customPrice?: number | null;
    discountPct?: number;
    discountFixed?: number;
  }>;
  globalDiscountType: DiscountDurationType;
  globalDiscountPct?: number;
  globalDiscountFixed?: number;
  temporaryMonths?: number;
  payerEmail?: string;
  promoStartsAt?: string | null;
}): ErpTenantSubscription {
  const optionBasePrice = Math.max(
    0,
    Math.round(
      params.customOptionBasePrice !== undefined && params.customOptionBasePrice !== null
        ? Number(params.customOptionBasePrice)
        : params.optionType === 1
          ? Number(params.pricingConfig.option_1_base || 0)
          : Number(params.pricingConfig.option_2_base || 0)
    )
  );

  const selectedModules: ErpModuleSelection[] = [];
  let modulesNetSum = 0;

  for (const item of params.moduleOverrides) {
    const def = ERP_COMMERCIAL_MODULES.find((m) => m.key === item.moduleKey);
    if (!def) continue;
    const cfgEntry = params.pricingConfig.module_prices?.[def.key];
    const basePrice = Math.max(
      0,
      Math.round(
        item.customPrice !== undefined && item.customPrice !== null
          ? Number(item.customPrice)
          : Number(cfgEntry?.price ?? def.defaultMonthlyArs)
      )
    );
    const discountPct = Math.min(
      100,
      Math.max(
        0,
        Number(
          item.discountPct !== undefined
            ? item.discountPct
            : (cfgEntry?.defaultDiscountPct ?? 0)
        )
      )
    );
    const discountFixed = Math.max(0, Math.round(Number(item.discountFixed || 0)));
    const afterPct = basePrice * (1 - discountPct / 100);
    const finalPrice = Math.max(0, Math.round(afterPct - discountFixed));
    selectedModules.push({
      moduleKey: def.key,
      basePrice,
      discountPct,
      discountFixed,
      finalPrice,
    });
    modulesNetSum += finalPrice;
  }

  const regularSubtotal = Math.max(0, Math.round(optionBasePrice + modulesNetSum));
  const globalPct = Math.min(100, Math.max(0, Number(params.globalDiscountPct || 0)));
  const globalFixed = Math.max(0, Math.round(Number(params.globalDiscountFixed || 0)));
  const discountedTotal = Math.max(
    0,
    Math.round(regularSubtotal * (1 - globalPct / 100) - globalFixed)
  );

  const durationType = params.globalDiscountType || "none";
  const tempMonths =
    durationType === "temporary"
      ? Math.max(1, Math.min(60, Math.round(Number(params.temporaryMonths || 3))))
      : 0;

  let promoStartsAt: string | null = null;
  let promoEndsAt: string | null = null;
  let monthlyPromoAmount = regularSubtotal;
  let monthlyRegularAmount = regularSubtotal;
  let activeMonthlyAmount = regularSubtotal;

  if (durationType === "permanent") {
    monthlyPromoAmount = discountedTotal;
    monthlyRegularAmount = discountedTotal;
    activeMonthlyAmount = discountedTotal;
  } else if (durationType === "temporary") {
    const startDate = params.promoStartsAt ? new Date(params.promoStartsAt) : new Date();
    const endDate = new Date(startDate.getTime());
    endDate.setMonth(endDate.getMonth() + tempMonths);
    promoStartsAt = startDate.toISOString();
    promoEndsAt = endDate.toISOString();
    monthlyPromoAmount = discountedTotal;
    monthlyRegularAmount = regularSubtotal;
    activeMonthlyAmount =
      Date.now() <= endDate.getTime() ? monthlyPromoAmount : monthlyRegularAmount;
  }

  return {
    optionType: params.optionType,
    optionBasePrice,
    selectedModules,
    globalDiscountType: durationType,
    globalDiscountPct: globalPct,
    globalDiscountFixed: globalFixed,
    temporaryMonths: tempMonths,
    promoStartsAt,
    promoEndsAt,
    monthlyPromoAmount,
    monthlyRegularAmount,
    activeMonthlyAmount,
    currency: "ARS",
    payerEmail: String(params.payerEmail || "").trim(),
    mpPreapprovalId: null,
    mpInitPoint: null,
    mpStatus: "pending",
    lastSyncAt: null,
  };
}

export async function ensureBaseMiniSistemaTenant(): Promise<ErpTenantRecord> {
  const sb = await getPlatformSupabase();

  if (!baseBootstrapped) {
    // Ensure default pricing config exists
    const { data: existingPricing } = await sb
      .from("erp_pricing_config")
      .select("*")
      .eq("id", "default")
      .maybeSingle();

    if (!existingPricing) {
      await sb.from("erp_pricing_config").insert(buildDefaultPricingConfig());
    }
  }

  const { data: existing } = await sb
    .from("erp_tenants")
    .select("*")
    .eq("slug", "minisistema")
    .maybeSingle();

  if (existing) {
    const existingMods = Array.isArray(existing.enabled_modules)
      ? existing.enabled_modules
      : [];
    const missingAnyKey = ALL_ERP_MODULE_KEYS.some(
      (k) => !existingMods.includes(k)
    );
    if (missingAnyKey) {
      existing.enabled_modules = ALL_ERP_MODULE_KEYS;
      await sb
        .from("erp_tenants")
        .update({
          enabled_modules: ALL_ERP_MODULE_KEYS,
          updated_at: new Date().toISOString(),
        })
        .eq("slug", "minisistema");
    }
    if (!baseBootstrapped) {
      const cleanSeed = buildCleanTenantSeed({
        businessName: "MiniSistema",
        localidad: "RÍO CUARTO",
        provincia: "CÓRDOBA",
        cp: "5800",
        whatsappComercio: "+5493585095475",
        emailInfo: "contacto@minisistema.com.ar",
        enabledModules: ALL_ERP_MODULE_KEYS,
      });
      await provisionTenantSchemaInDb(
        existing as ErpTenantRecord,
        cleanSeed.docs,
        cleanSeed.users
      );
      baseBootstrapped = true;
    }
    return existing as ErpTenantRecord;
  }

  const branding = buildMiniSistemaBranding({
    clubName: "Club MiniSistema",
    address: "Río Cuarto, Córdoba, Argentina",
    localidad: "RÍO CUARTO",
    provincia: "CÓRDOBA",
    cp: "5800",
  });

  const baseRecord: Omit<ErpTenantRecord, "id" | "created_at" | "updated_at"> = {
    slug: "minisistema",
    option_type: 1,
    is_base: true,
    business_name: "MiniSistema",
    fantasy_name: "MiniSistema",
    custom_domain: "www.minisistema.com.ar",
    db_schema: "erp_minisistema",
    external_supabase_url: null,
    external_supabase_key: null,
    status: "active",
    branding,
    enabled_modules: ALL_ERP_MODULE_KEYS,
    subscription: {
      optionType: 1,
      optionBasePrice: 0,
      selectedModules: [],
      globalDiscountType: "permanent",
      globalDiscountPct: 100,
      globalDiscountFixed: 0,
      temporaryMonths: 0,
      promoStartsAt: null,
      promoEndsAt: null,
      monthlyPromoAmount: 0,
      monthlyRegularAmount: 0,
      activeMonthlyAmount: 0,
      currency: "ARS",
      payerEmail: "admin@minisistema.com.ar",
      mpPreapprovalId: null,
      mpInitPoint: null,
      mpStatus: "authorized",
      lastSyncAt: new Date().toISOString(),
    },
    deployment: {
      mode: "custom_domain_vercel_github",
      publicErpUrl: "https://www.minisistema.com.ar/sistema",
      publicCarritoUrl: "https://www.minisistema.com.ar/carrito",
      publicVerificadorUrl: "https://www.minisistema.com.ar/verificador",
      githubRepoUrl: "https://github.com/danighiglionesl-art/minisistema",
      vercelProjectId: "prj_DwQTRgpPgTyuhHGbsAlezTNTvcFE",
      vercelDomainVerified: true,
      dnsInstructions: [],
      provisionedAt: new Date().toISOString(),
      notes: "Sistema ERP Base Oficial de MiniSistema",
    },
  };

  const { data: inserted, error } = await sb
    .from("erp_tenants")
    .upsert(baseRecord, { onConflict: "slug" })
    .select("*")
    .single();

  if (error || !inserted) {
    throw new Error(`No se pudo inicializar el sistema base: ${error?.message || ""}`);
  }

  const cleanSeed = buildCleanTenantSeed({
    businessName: "MiniSistema",
    localidad: "RÍO CUARTO",
    provincia: "CÓRDOBA",
    cp: "5800",
    whatsappComercio: "+5493585095475",
    emailInfo: "contacto@minisistema.com.ar",
    enabledModules: ALL_ERP_MODULE_KEYS,
  });

  await provisionTenantSchemaInDb(
    inserted as ErpTenantRecord,
    cleanSeed.docs,
    cleanSeed.users
  );
  baseBootstrapped = true;

  return inserted as ErpTenantRecord;
}

export async function getTenantBySlug(slug: string): Promise<ErpTenantRecord | null> {
  await ensureBaseMiniSistemaTenant();
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  const sb = await getPlatformSupabase();
  const { data } = await sb
    .from("erp_tenants")
    .select("*")
    .eq("slug", clean)
    .maybeSingle();
  return (data as ErpTenantRecord | null) || null;
}

export async function getTenantByHost(rawHost: string): Promise<ErpTenantRecord | null> {
  const host = String(rawHost || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  if (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "minisistema.com.ar" ||
    host === "www.minisistema.com.ar" ||
    host.endsWith(".vercel.app")
  ) {
    return null;
  }

  await ensureBaseMiniSistemaTenant();
  const sb = await getPlatformSupabase();
  const bare = host.replace(/^www\./, "");
  const candidates = [host, `www.${bare}`, bare];
  const { data } = await sb
    .from("erp_tenants")
    .select("*")
    .in("custom_domain", candidates)
    .limit(1)
    .maybeSingle();
  return (data as ErpTenantRecord | null) || null;
}

export async function resolveActiveTenantFromRequest(
  req: NextRequest
): Promise<ErpTenantRecord> {
  const baseTenant = await ensureBaseMiniSistemaTenant();

  // 1. Explicit header or query param
  const explicitSlug =
    req.headers.get("x-erp-tenant") ||
    req.nextUrl.searchParams.get("tenant") ||
    "";
  if (explicitSlug && explicitSlug !== "minisistema") {
    const found = await getTenantBySlug(explicitSlug);
    if (found) return found;
  }

  // 2. Custom domain (Option 1)
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const byHost = await getTenantByHost(host);
  if (byHost) return byHost;

  // 3. Referer subpath (Option 2: www.minisistema.com.ar/<nuevosistema>)
  const referer = req.headers.get("referer") || "";
  if (referer) {
    try {
      const refUrl = new URL(referer);
      const firstSeg = refUrl.pathname.split("/").filter(Boolean)[0] || "";
      if (firstSeg && !isReservedAppSlug(firstSeg)) {
        const byRef = await getTenantBySlug(firstSeg);
        if (byRef) return byRef;
      }
    } catch {
      // ignore invalid referer
    }
  }

  return baseTenant;
}

export async function getPlatformSecretsMap(): Promise<Record<string, string>> {
  const sb = await getPlatformSupabase();
  const { data } = await sb.from("erp_platform_secrets").select("key, value");
  const out: Record<string, string> = {
    mp_access_token: process.env.MP_ACCESS_TOKEN || "",
    mp_public_key: process.env.MP_PUBLIC_KEY || "",
    mp_webhook_secret: process.env.MP_WEBHOOK_SECRET || "",
    github_token: process.env.GITHUB_TOKEN || "",
    github_owner: process.env.GITHUB_OWNER || "danighiglionesl-art",
    vercel_token: process.env.VERCEL_API_TOKEN || "",
    vercel_team_id: process.env.VERCEL_TEAM_ID || "team_1f6KbeTsFojraSVnPEOlhkBg",
  };
  if (Array.isArray(data)) {
    for (const row of data) {
      if (row && typeof row.key === "string" && row.value) {
        out[row.key] = String(row.value);
      }
    }
  }
  return out;
}

export async function savePlatformSecretsMap(
  updates: Record<string, string>
): Promise<void> {
  const sb = await getPlatformSupabase();
  const allowedKeys = [
    "mp_access_token",
    "mp_public_key",
    "mp_webhook_secret",
    "github_token",
    "github_owner",
    "vercel_token",
    "vercel_team_id",
  ];
  const rows = [];
  for (const key of allowedKeys) {
    if (key in updates && updates[key] !== "••••••••") {
      rows.push({
        key,
        value: String(updates[key] || "").trim(),
        updated_at: new Date().toISOString(),
      });
    }
  }
  if (rows.length > 0) {
    const { error } = await sb
      .from("erp_platform_secrets")
      .upsert(rows, { onConflict: "key" });
    if (error) {
      throw new Error(`No se pudieron guardar las credenciales: ${error.message}`);
    }
  }
}

export async function getPricingConfig(): Promise<ErpPricingConfigRecord> {
  await ensureBaseMiniSistemaTenant();
  const sb = await getPlatformSupabase();
  const { data } = await sb
    .from("erp_pricing_config")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  return (data as ErpPricingConfigRecord | null) || buildDefaultPricingConfig();
}

export async function savePricingConfig(
  nextCfg: Partial<ErpPricingConfigRecord>
): Promise<ErpPricingConfigRecord> {
  const current = await getPricingConfig();
  const merged: ErpPricingConfigRecord = {
    ...current,
    option_1_base:
      nextCfg.option_1_base !== undefined
        ? Math.max(0, Math.round(Number(nextCfg.option_1_base)))
        : current.option_1_base,
    option_2_base:
      nextCfg.option_2_base !== undefined
        ? Math.max(0, Math.round(Number(nextCfg.option_2_base)))
        : current.option_2_base,
    module_prices: nextCfg.module_prices || current.module_prices,
    discount_presets: nextCfg.discount_presets || current.discount_presets,
    currency: "ARS",
    updated_at: new Date().toISOString(),
  };
  const sb = await getPlatformSupabase();
  const { data, error } = await sb
    .from("erp_pricing_config")
    .upsert(merged, { onConflict: "id" })
    .select("*")
    .single();
  if (error) {
    throw new Error(`Error guardando lista de precios: ${error.message}`);
  }
  return data as ErpPricingConfigRecord;
}

export async function createOrUpdateMpPreapproval(
  tenant: ErpTenantRecord,
  siteOrigin = "https://www.minisistema.com.ar"
): Promise<ErpTenantSubscription> {
  const secrets = await getPlatformSecretsMap();
  const mpToken = (secrets.mp_access_token || "").trim();
  const sub = { ...tenant.subscription };
  const amount = Math.max(0, Number(sub.activeMonthlyAmount || 0));

  if (amount <= 0) {
    sub.mpStatus = "authorized";
    sub.mpInitPoint = null;
    sub.lastSyncAt = new Date().toISOString();
    return sub;
  }

  if (!mpToken) {
    // Modo prueba listo hasta que @danielg cargue su Access Token de Mercado Pago
    sub.mpPreapprovalId = `sandbox_mp_${tenant.slug}_${Date.now()}`;
    sub.mpInitPoint = `${siteOrigin}/api/mercadopago/sandbox?tenant=${encodeURIComponent(tenant.slug)}`;
    sub.mpStatus = "sandbox_ready";
    sub.lastSyncAt = new Date().toISOString();
    return sub;
  }

  const payerEmail = sub.payerEmail || tenant.branding.emailInfo || "cliente@comercio.com.ar";
  const body = {
    reason: `Abono Mensual MiniSistema ERP — ${tenant.fantasy_name}`,
    external_reference: tenant.slug,
    payer_email: payerEmail,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: amount,
      currency_id: "ARS",
    },
    back_url: `${siteOrigin}/sistema?mp_adhesion=${encodeURIComponent(tenant.slug)}`,
    status: "pending",
  };

  const res = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mpToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !data.id) {
    throw new Error(
      `Mercado Pago rechazó la creación de la suscripción: ${String(
        data.message || data.error || res.statusText
      )}`
    );
  }

  sub.mpPreapprovalId = String(data.id);
  sub.mpInitPoint = String(data.init_point || data.sandbox_init_point || "");
  sub.mpStatus =
    data.status === "authorized"
      ? "authorized"
      : data.status === "paused"
        ? "paused"
        : "pending";
  sub.lastSyncAt = new Date().toISOString();
  return sub;
}

export async function provisionOption1Deployment(params: {
  slug: string;
  businessName: string;
  customDomain: string;
}): Promise<ErpTenantDeployment> {
  const secrets = await getPlatformSecretsMap();
  const cleanDomain = params.customDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  const wwwDomain = cleanDomain.startsWith("www.") ? cleanDomain : `www.${cleanDomain}`;
  const apexDomain = wwwDomain.replace(/^www\./, "");

  const deployment: ErpTenantDeployment = {
    mode: "custom_domain_vercel_github",
    publicErpUrl: `https://${wwwDomain}/sistema`,
    publicCarritoUrl: `https://${wwwDomain}/carrito`,
    publicVerificadorUrl: `https://${wwwDomain}/verificador`,
    githubRepoUrl: null,
    vercelProjectId: "prj_DwQTRgpPgTyuhHGbsAlezTNTvcFE",
    vercelDomainVerified: false,
    dnsInstructions: [
      { type: "A", name: "@", value: "76.76.21.21" },
      { type: "CNAME", name: "www", value: "cname.vercel-dns.com" },
    ],
    provisionedAt: new Date().toISOString(),
    notes: "",
  };

  const notes: string[] = [];

  // 1. Optional GitHub repository creation for Option 1 client tracking/config
  if (secrets.github_token) {
    try {
      const repoName = `${params.slug}-erp`;
      const ghRes = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secrets.github_token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: repoName,
          description: `Sistema ERP Corporativo (${params.businessName}) — Motor MiniSistema (${wwwDomain})`,
          private: true,
          auto_init: true,
        }),
      });
      const ghData = (await ghRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (ghRes.ok && ghData.html_url) {
        deployment.githubRepoUrl = String(ghData.html_url);
        notes.push(`Repositorio GitHub privado creado: ${deployment.githubRepoUrl}`);
      } else if (ghData.message) {
        notes.push(`GitHub aviso: ${String(ghData.message)}`);
      }
    } catch (err) {
      notes.push(
        `GitHub pendiente: ${err instanceof Error ? err.message : "error de red"}`
      );
    }
  } else {
    notes.push(
      "Token de GitHub aún no cargado (podés cargarlo en Credenciales API para crear el repositorio privado automáticamente)."
    );
  }

  // 2. Attach custom domain to Vercel project so https://www.nuevoerp.com.ar/sistema serves immediately
  if (secrets.vercel_token) {
    try {
      const teamQuery = secrets.vercel_team_id
        ? `?teamId=${encodeURIComponent(secrets.vercel_team_id)}`
        : "";
      const projectId = "prj_DwQTRgpPgTyuhHGbsAlezTNTvcFE";
      for (const dom of [apexDomain, wwwDomain]) {
        const vcRes = await fetch(
          `https://api.vercel.com/v10/projects/${projectId}/domains${teamQuery}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${secrets.vercel_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: dom }),
          }
        );
        const vcData = (await vcRes.json().catch(() => ({}))) as Record<string, unknown>;
        if (vcRes.ok || vcData.verified) {
          deployment.vercelDomainVerified = Boolean(vcData.verified);
        }
      }
      notes.push(`Dominio ${wwwDomain} vinculado en Vercel.`);
    } catch (err) {
      notes.push(
        `Vercel pendiente: ${err instanceof Error ? err.message : "error de red"}`
      );
    }
  } else {
    notes.push(
      "Token API de Vercel aún no cargado: configurá los registros DNS (A 76.76.21.21 y CNAME cname.vercel-dns.com) y vinculá el dominio con 1 clic cuando cargues tu VERCEL_API_TOKEN."
    );
  }

  deployment.notes = notes.join(" · ");
  return deployment;
}

export async function provisionNewCommerceTenant(input: {
  slug: string;
  optionType: 1 | 2;
  businessName: string;
  fantasyName?: string;
  customDomain?: string;
  branding?: Partial<ErpTenantBranding>;
  commercialModuleKeys: string[];
  moduleOverrides?: Array<{
    moduleKey: string;
    customPrice?: number | null;
    discountPct?: number;
    discountFixed?: number;
  }>;
  customOptionBasePrice?: number | null;
  globalDiscountType?: DiscountDurationType;
  globalDiscountPct?: number;
  globalDiscountFixed?: number;
  temporaryMonths?: number;
  payerEmail?: string;
  createMpSubscription?: boolean;
  externalSupabaseUrl?: string | null;
  externalSupabaseKey?: string | null;
  initialAdmin?: {
    username: string;
    password: string;
    name: string;
    whatsapp?: string;
    branch?: string;
  } | null;
  siteOrigin?: string;
}): Promise<ErpTenantRecord> {
  await ensureBaseMiniSistemaTenant();
  const sb = await getPlatformSupabase();

  const cleanSlug = sanitizeTenantSlug(input.slug);
  if (!cleanSlug || cleanSlug.length < 2 || isReservedAppSlug(cleanSlug) || cleanSlug === "minisistema") {
    throw new Error(
      `El identificador "${input.slug}" no está disponible o es una ruta reservada del sistema.`
    );
  }

  const { data: dup } = await sb
    .from("erp_tenants")
    .select("slug")
    .eq("slug", cleanSlug)
    .maybeSingle();
  if (dup) {
    throw new Error(`Ya existe un comercio registrado con el identificador "${cleanSlug}".`);
  }

  const dbSchema = `erp_${cleanSlug.replace(/-/g, "_")}`;
  const optionType: 1 | 2 = input.optionType === 1 ? 1 : 2;

  let cleanCustomDomain: string | null = null;
  if (optionType === 1) {
    const rawDom = String(input.customDomain || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (!rawDom || !rawDom.includes(".")) {
      throw new Error(
        "Para la Opción 1 debés indicar el dominio propio del comercio (ej: www.nuevoerp.com.ar)."
      );
    }
    cleanCustomDomain = rawDom.startsWith("www.") ? rawDom : `www.${rawDom}`;
  }

  const businessName = input.businessName.trim();
  const fantasyName = (input.fantasyName || businessName).trim();
  const branding = enforceOptionBranding(optionType, false, input.branding);

  const selectedCommKeys =
    input.commercialModuleKeys.length > 0
      ? input.commercialModuleKeys
      : ["facturacion", "articulos", "clientes"];
  const enabledErpModules = expandCommercialToErpModules(selectedCommKeys);

  const pricingConfig = await getPricingConfig();
  const moduleOverrides =
    input.moduleOverrides && input.moduleOverrides.length > 0
      ? input.moduleOverrides
      : selectedCommKeys.map((k) => ({ moduleKey: k }));

  const subscription = calculateSubscriptionQuote({
    optionType,
    pricingConfig,
    customOptionBasePrice: input.customOptionBasePrice,
    moduleOverrides,
    globalDiscountType: input.globalDiscountType || "none",
    globalDiscountPct: input.globalDiscountPct,
    globalDiscountFixed: input.globalDiscountFixed,
    temporaryMonths: input.temporaryMonths,
    payerEmail: input.payerEmail || branding.emailInfo,
  });

  const siteOrigin = input.siteOrigin || "https://www.minisistema.com.ar";
  const deployment: ErpTenantDeployment =
    optionType === 1 && cleanCustomDomain
      ? await provisionOption1Deployment({
          slug: cleanSlug,
          businessName,
          customDomain: cleanCustomDomain,
        })
      : {
          mode: "minisistema_subpath",
          publicErpUrl: `${siteOrigin}/${cleanSlug}`,
          publicCarritoUrl: `${siteOrigin}/${cleanSlug}/carrito`,
          publicVerificadorUrl: `${siteOrigin}/${cleanSlug}/verificador`,
          githubRepoUrl: null,
          vercelProjectId: "prj_DwQTRgpPgTyuhHGbsAlezTNTvcFE",
          vercelDomainVerified: true,
          dnsInstructions: [],
          provisionedAt: new Date().toISOString(),
          notes:
            "Opción 2 activa bajo dominio e identidad visual oficial de MiniSistema.",
        };

  const draftTenant: Omit<ErpTenantRecord, "id" | "created_at" | "updated_at"> = {
    slug: cleanSlug,
    option_type: optionType,
    is_base: false,
    business_name: businessName,
    fantasy_name: fantasyName,
    custom_domain: cleanCustomDomain,
    db_schema: dbSchema,
    external_supabase_url: input.externalSupabaseUrl || null,
    external_supabase_key: input.externalSupabaseKey || null,
    status: "active",
    branding,
    enabled_modules: enabledErpModules,
    subscription,
    deployment,
  };

  // Provision isolated PostgreSQL schema + clean seed (Art 20 + Consumidor Final + @danielg + optional Admin)
  const cleanSeed = buildCleanTenantSeed({
    businessName,
    localidad: branding.localidad,
    provincia: branding.provincia,
    cp: branding.cp,
    whatsappComercio: `+${branding.whatsappDigits.replace(/\D/g, "")}`,
    emailInfo: branding.emailInfo,
    enabledModules: enabledErpModules,
    initialAdmin: input.initialAdmin || null,
  });

  await provisionTenantSchemaInDb(draftTenant, cleanSeed.docs, cleanSeed.users);

  if (input.createMpSubscription !== false) {
    try {
      draftTenant.subscription = await createOrUpdateMpPreapproval(
        draftTenant as ErpTenantRecord,
        siteOrigin
      );
    } catch {
      // Keep pending if MP fails so tenant creation still succeeds cleanly
    }
  }

  const { data: created, error } = await sb
    .from("erp_tenants")
    .insert(draftTenant)
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(`No se pudo registrar el comercio en Supabase: ${error?.message || ""}`);
  }

  return created as ErpTenantRecord;
}
