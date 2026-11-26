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
  type ErpTenantTrialInfo,
  expandCommercialToErpModules,
  MINISISTEMA_OFFICIAL_COLORS,
  MINISISTEMA_OFFICIAL_LOGOS,
} from "./types";

const RESERVED_SLUGS = new Set([
  "sistema",
  "carrito",
  "verificador",
  "cv",
  "asistencia",
  "turnos",
  "laboratorio",
  "cemep",
  "inmobiliaria",
  "academias",
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

const TENANT_CACHE_TTL_MS = 300_000;
const tenantBySlugCache = new Map<
  string,
  { value: ErpTenantRecord | null; expiresAt: number }
>();
const tenantByHostCache = new Map<
  string,
  { value: ErpTenantRecord | null; expiresAt: number }
>();
let baseTenantPromise: Promise<ErpTenantRecord> | null = null;
let pricingChecked = false;

const KNOWN_HOST_SLUGS: Record<string, string> = {
  "cn.com.ar": "casanueva",
  "www.cn.com.ar": "casanueva",
  "paseoalberdi.ar": "paseoalberdi",
  "www.paseoalberdi.ar": "paseoalberdi",
};

const CORE_RETAIL_MODULES: string[] = [
  "facturacion",
  "facturacion:caja1",
  "facturacion:caja2",
  "facturacion:caja3",
  "facturacion:facturador",
  "facturacion:recibo",
  "facturacion:apertura",
  "facturacion:retiro",
  "facturacion:cierre",
  "facturacion:movil",
  "facturacion:comprobantes",
  "facturacion:admin_arca",
  "articulos",
  "articulos:listado",
  "articulos:nuevo",
  "articulos:duplicar",
  "articulos:config_precios",
  "articulos:abm_marcas",
  "articulos:abm_rubros",
  "articulos:factura_prov",
  "articulos:carga_rapida",
  "articulos:control_stock",
  "articulos:precios_gondola",
  "articulos:ofertas",
  "articulos:pedidos",
  "clientes",
  "clientes:padron",
  "clientes:nuevo",
  "clientes:ctacte",
  "clientes:detalle_ctacte",
  "proveedores",
  "proveedores:padron",
  "proveedores:nuevo",
  "proveedores:ctacte",
  "proveedores:duales",
  "proveedores:factura_prov",
  "proveedores:carga_rapida",
  "proveedores:control_stock",
  "proveedores:precios_gondola",
  "proveedores:pedidos",
  "fondos",
  "fondos:caja_central",
  "fondos:caja",
  "fondos:bancos",
  "fondos:stock_valorizado",
  "carrito",
  "carrito:usuarios",
  "carrito:articulos",
  "carrito:banners",
  "carrito:reg_online",
  "carrito:abrir_tienda",
  "fidelizacion",
  "fidelizacion:operaciones",
  "fidelizacion:catalogo",
  "fidelizacion:clientes",
  "fidelizacion:config",
  "whatsapp",
  "estadisticas",
  "estadisticas:facturacion",
  "estadisticas:ranking",
  "estadisticas:medios",
  "estadisticas:margenes",
  "mi_contador",
  "verificador",
  "personal",
  "personal:cv",
  "personal:asistencia",
  "cv",
  "asistencia",
  "tema",
  "perfil",
  "atajos",
  "manual_usuario",
];

function buildCoreFallbackTenant(slug: string): ErpTenantRecord | null {
  const clean = slug.trim().toLowerCase();
  const nowIso = new Date().toISOString();
  const emptySub: ErpTenantSubscription = {
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
    payerEmail: "",
    mpPreapprovalId: null,
    mpInitPoint: null,
    mpStatus: "authorized",
    lastSyncAt: nowIso,
  };

  if (clean === "casanueva") {
    return {
      id: "fallback-casanueva",
      slug: "casanueva",
      option_type: 1,
      is_base: false,
      business_name: "BIANCHI MARIA ESTHER",
      fantasy_name: "Casa Nueva Supermercado",
      custom_domain: "www.cn.com.ar",
      db_schema: "erp_casanueva",
      external_supabase_url: null,
      external_supabase_key: null,
      status: "active",
      branding: {
        primaryHex: "#202020",
        accentHex: "#d4a017",
        surfaceHex: "#FFFFFF",
        logo1x1Url: "/sistema/assets/img/casanueva/logo-full.png",
        logoHorizontalUrl: "/sistema/assets/img/casanueva/logo-full.png",
        logoSymbolUrl: "/sistema/assets/img/casanueva/icon-192.png",
        clubName: "Club Fidel",
        address: "Riveros Gigena N° 50 - Alcira Gigena (Córdoba)",
        localidad: "ALCIRA GIGENA",
        provincia: "CÓRDOBA",
        cp: "5813",
        whatsappDigits: "5493584198605",
        whatsappDisplay: "+54 9 3584 19-8605",
        emailInfo: "ventas@cn.com.ar",
        cuitFmt: "27-05457050-9",
        condIva: "IVA RESPONSABLE INSCRIPTO",
        iibb: "288462551",
        inicioAct: "02/03/2026",
      },
      enabled_modules: CORE_RETAIL_MODULES,
      subscription: { ...emptySub, payerEmail: "ventas@cn.com.ar" },
      deployment: {
        mode: "custom_domain_vercel_github",
        actividadNegocio: "comercial",
        publicErpUrl: "https://www.cn.com.ar/sistema",
        publicCarritoUrl: "https://www.cn.com.ar/carrito",
        publicVerificadorUrl: "https://www.cn.com.ar/verificador",
        githubRepoUrl: null,
        vercelProjectId: "prj_DwQTRgpPgTyuhHGbsAlezTNTvcFE",
        vercelDomainVerified: true,
        dnsInstructions: [],
        provisionedAt: nowIso,
        notes: "Fallback resiliente Casa Nueva Supermercado",
      },
      created_at: nowIso,
      updated_at: nowIso,
    };
  }

  if (clean === "paseoalberdi") {
    return {
      id: "fallback-paseoalberdi",
      slug: "paseoalberdi",
      option_type: 1,
      is_base: false,
      business_name: "Paseo Alberdi Supermercado",
      fantasy_name: "Paseo Alberdi",
      custom_domain: "www.paseoalberdi.ar",
      db_schema: "erp_paseoalberdi",
      external_supabase_url: null,
      external_supabase_key: null,
      status: "active",
      branding: {
        primaryHex: "#1C1B1E",
        accentHex: "#BDF200",
        surfaceHex: "#FFFFFF",
        logo1x1Url: "/sistema/assets/img/paseo-alberdi/logo-1x1.png",
        logoHorizontalUrl: "/sistema/assets/img/paseo-alberdi/logo-horizontal.png",
        logoSymbolUrl: "/sistema/assets/img/paseo-alberdi/logo-symbol.png",
        clubName: "Club Fidel",
        address: "Ignacio Pirovano 193, Barrio Alberdi, Río Cuarto",
        localidad: "RÍO CUARTO",
        provincia: "CÓRDOBA",
        cp: "5800",
        whatsappDigits: "5493584292027",
        whatsappDisplay: "+54 9 3584 29-2027",
        emailInfo: "ventas@paseoalberdi.ar",
        cuitFmt: "A CONFIGURAR",
        condIva: "IVA RESPONSABLE INSCRIPTO",
        iibb: "—",
        inicioAct: "—",
      },
      enabled_modules: CORE_RETAIL_MODULES,
      subscription: { ...emptySub, payerEmail: "ventas@paseoalberdi.ar" },
      deployment: {
        mode: "custom_domain_vercel_github",
        actividadNegocio: "comercial",
        publicErpUrl: "https://www.paseoalberdi.ar/sistema",
        publicCarritoUrl: "https://www.paseoalberdi.ar/carrito",
        publicVerificadorUrl: "https://www.paseoalberdi.ar/verificador",
        githubRepoUrl: null,
        vercelProjectId: "prj_DwQTRgpPgTyuhHGbsAlezTNTvcFE",
        vercelDomainVerified: true,
        dnsInstructions: [],
        provisionedAt: nowIso,
        notes: "Fallback resiliente Paseo Alberdi",
      },
      created_at: nowIso,
      updated_at: nowIso,
    };
  }

  if (clean === "minisistema") {
    return {
      id: "fallback-minisistema",
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
      branding: buildMiniSistemaBranding(),
      enabled_modules: ALL_ERP_MODULE_KEYS,
      subscription: { ...emptySub, payerEmail: "admin@minisistema.com.ar" },
      deployment: {
        mode: "custom_domain_vercel_github",
        actividadNegocio: "comercial",
        publicErpUrl: "https://www.minisistema.com.ar/sistema",
        publicCarritoUrl: "https://www.minisistema.com.ar/carrito",
        publicVerificadorUrl: "https://www.minisistema.com.ar/verificador",
        publicTurnosUrl: "https://www.minisistema.com.ar/turnos",
        publicInmobiliariaUrl: "https://www.minisistema.com.ar/inmobiliaria",
        githubRepoUrl: "https://github.com/danighiglionesl-art/minisistema",
        vercelProjectId: "prj_DwQTRgpPgTyuhHGbsAlezTNTvcFE",
        vercelDomainVerified: true,
        dnsInstructions: [],
        provisionedAt: nowIso,
        notes: "Fallback resiliente MiniSistema",
      },
      created_at: nowIso,
      updated_at: nowIso,
    };
  }

  return null;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout (${ms}ms) en ${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function invalidateTenantCache(slug?: string): void {
  if (slug) {
    const clean = slug.trim().toLowerCase();
    tenantBySlugCache.delete(clean);
  } else {
    tenantBySlugCache.clear();
  }
  tenantByHostCache.clear();
}

function cacheTenantRecord(tenant: ErpTenantRecord | null, slugKey?: string, hostKey?: string): void {
  const expiresAt = Date.now() + TENANT_CACHE_TTL_MS;
  if (tenant) {
    tenantBySlugCache.set(tenant.slug.toLowerCase(), { value: tenant, expiresAt });
    if (tenant.custom_domain) {
      const dom = tenant.custom_domain.trim().toLowerCase();
      const bare = dom.replace(/^www\./, "");
      tenantByHostCache.set(dom, { value: tenant, expiresAt });
      tenantByHostCache.set(bare, { value: tenant, expiresAt });
      tenantByHostCache.set(`www.${bare}`, { value: tenant, expiresAt });
    }
  } else {
    if (slugKey) tenantBySlugCache.set(slugKey, { value: null, expiresAt: Date.now() + 15_000 });
    if (hostKey) tenantByHostCache.set(hostKey, { value: null, expiresAt: Date.now() + 15_000 });
  }
}

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
    const subMap: Record<string, number> = {};
    let sum = 0;
    for (const s of m.submodules) {
      subMap[s.key] = s.defaultMonthlyArs;
      sum += s.defaultMonthlyArs;
    }
    modulePrices[m.key] = {
      price: sum,
      defaultDiscountPct: 0,
      submodulePrices: subMap,
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
  optionDiscountPct?: number;
  moduleOverrides: Array<{
    moduleKey: string;
    selectedSubmodules?: string[];
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
  const rawOptBase = Math.max(
    0,
    Math.round(
      params.customOptionBasePrice !== undefined && params.customOptionBasePrice !== null
        ? Number(params.customOptionBasePrice)
        : params.optionType === 1
          ? Number(params.pricingConfig.option_1_base || 0)
          : Number(params.pricingConfig.option_2_base || 0)
    )
  );
  const optDiscPct = Math.min(100, Math.max(0, Number(params.optionDiscountPct || 0)));
  const optionBasePrice = Math.max(0, Math.round(rawOptBase * (1 - optDiscPct / 100)));

  const selectedModules: ErpModuleSelection[] = [];
  let modulesNetSum = 0;

  for (const item of params.moduleOverrides) {
    const def = ERP_COMMERCIAL_MODULES.find((m) => m.key === item.moduleKey);
    if (!def) continue;
    const cfgEntry = params.pricingConfig.module_prices?.[def.key];
    const subPricesCfg = cfgEntry?.submodulePrices || {};

    const activeSubs =
      Array.isArray(item.selectedSubmodules) && item.selectedSubmodules.length > 0
        ? def.submodules.filter((s) => item.selectedSubmodules!.includes(s.key))
        : def.submodules;
    if (activeSubs.length === 0) continue;

    const sumFromSubmodules = activeSubs.reduce((acc, s) => {
      const sp =
        subPricesCfg[s.key] !== undefined
          ? Number(subPricesCfg[s.key])
          : s.defaultMonthlyArs;
      return acc + Math.max(0, Math.round(sp));
    }, 0);

    const basePrice = Math.max(
      0,
      Math.round(
        item.customPrice !== undefined && item.customPrice !== null
          ? Number(item.customPrice)
          : sumFromSubmodules
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
      selectedSubmodules: activeSubs.map((s) => s.key),
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
    optionDiscountPct: optDiscPct,
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
  const cached = tenantBySlugCache.get("minisistema");
  if (cached && cached.value && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (baseTenantPromise) {
    return baseTenantPromise;
  }

  baseTenantPromise = (async () => {
    const sb = await getPlatformSupabase();

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
      // IMPORTANTE: No ejecutar DDL (erp_provision_tenant_schema) cuando el tenant base ya existe;
      // ejecutar ALTER TABLE en cold starts bloquea tablas y dispara recargas masivas de PostgREST.
      const rec = existing as ErpTenantRecord;
      cacheTenantRecord(rec);
      return rec;
    }

    if (!pricingChecked) {
      const { data: existingPricing } = await sb
        .from("erp_pricing_config")
        .select("id")
        .eq("id", "default")
        .maybeSingle();
      if (!existingPricing) {
        await sb.from("erp_pricing_config").insert(buildDefaultPricingConfig());
      }
      pricingChecked = true;
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
        publicTurnosUrl: "https://www.minisistema.com.ar/turnos",
        publicInmobiliariaUrl: "https://www.minisistema.com.ar/inmobiliaria",
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

    const rec = inserted as ErpTenantRecord;
    cacheTenantRecord(rec);
    return rec;
  })();

  try {
    return await withTimeout(baseTenantPromise, 3_500, "ensureBaseMiniSistemaTenant");
  } catch (err) {
    console.warn("[TenantService] Fallback resiliente para minisistema:", err instanceof Error ? err.message : err);
    if (cached?.value) return cached.value;
    const fb = buildCoreFallbackTenant("minisistema");
    if (fb) {
      tenantBySlugCache.set("minisistema", { value: fb, expiresAt: Date.now() + 20_000 });
      return fb;
    }
    throw err;
  } finally {
    baseTenantPromise = null;
  }
}

export async function getTenantBySlug(slug: string): Promise<ErpTenantRecord | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  if (clean === "minisistema") {
    return ensureBaseMiniSistemaTenant();
  }

  const cached = tenantBySlugCache.get(clean);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const rec = await withTimeout(
      (async () => {
        const sb = await getPlatformSupabase();
        const { data, error } = await sb
          .from("erp_tenants")
          .select("*")
          .eq("slug", clean)
          .maybeSingle();

        if (error) {
          throw new Error(`Error consultando comercio "${clean}": ${error.message}`);
        }
        return (data as ErpTenantRecord | null) || null;
      })(),
      3_500,
      `getTenantBySlug(${clean})`
    );
    cacheTenantRecord(rec, clean);
    return rec;
  } catch (err) {
    console.warn(`[TenantService] Fallback resiliente para slug=${clean}:`, err instanceof Error ? err.message : err);
    if (cached?.value) return cached.value;
    const fb = buildCoreFallbackTenant(clean);
    if (fb) {
      tenantBySlugCache.set(clean, { value: fb, expiresAt: Date.now() + 20_000 });
      return fb;
    }
    throw err;
  }
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

  const cached = tenantByHostCache.get(host);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const knownSlug = KNOWN_HOST_SLUGS[host];
  if (knownSlug) {
    const byKnown = await getTenantBySlug(knownSlug);
    if (byKnown) {
      cacheTenantRecord(byKnown, knownSlug, host);
      return byKnown;
    }
  }

  try {
    const rec = await withTimeout(
      (async () => {
        const sb = await getPlatformSupabase();
        const bare = host.replace(/^www\./, "");
        const candidates = [host, `www.${bare}`, bare];
        const { data, error } = await sb
          .from("erp_tenants")
          .select("*")
          .in("custom_domain", candidates)
          .limit(1)
          .maybeSingle();

        if (error) {
          throw new Error(`Error resolviendo dominio "${host}": ${error.message}`);
        }
        return (data as ErpTenantRecord | null) || null;
      })(),
      6_000,
      `getTenantByHost(${host})`
    );
    cacheTenantRecord(rec, undefined, host);
    return rec;
  } catch (err) {
    console.warn(`[TenantService] Fallback resiliente para host=${host}:`, err instanceof Error ? err.message : err);
    if (cached?.value) return cached.value;
    throw err;
  }
}

export async function resolveActiveTenantFromRequest(
  req: NextRequest
): Promise<ErpTenantRecord> {
  // 1. Explicit header or query param (sin consultar el tenant base innecesariamente)
  const explicitSlug = (
    req.headers.get("x-erp-tenant") ||
    req.nextUrl.searchParams.get("tenant") ||
    ""
  )
    .trim()
    .toLowerCase();
  if (explicitSlug && explicitSlug !== "minisistema") {
    const found = await getTenantBySlug(explicitSlug);
    if (found) return found;
  }

  // 2. Custom domain (Option 1: ej. www.cn.com.ar, www.paseoalberdi.ar)
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const byHost = await getTenantByHost(host);
  if (byHost) return byHost;

  // 3. Referer subpath (Option 2 o pruebas paralelas: www.minisistema.com.ar/<slug>)
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

  return ensureBaseMiniSistemaTenant();
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
    afip_cuit: process.env.AFIP_CUIT || "",
    afip_entorno: process.env.AFIP_ENTORNO || "produccion",
    afip_pto_vta: process.env.AFIP_PTO_VTA || "0002",
    afip_cert_pem: process.env.AFIP_CERT_PEM || "",
    afip_key_pem: process.env.AFIP_KEY_PEM || "",
    ga_measurement_id:
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
      process.env.GA_MEASUREMENT_ID ||
      "",
    clubfidel_api_url:
      process.env.CLUBFIDEL_API_URL || "https://www.clubfidel.com.ar",
    clubfidel_admin_secret: process.env.CLUBFIDEL_ADMIN_SECRET || "",
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
    "afip_cuit",
    "afip_entorno",
    "afip_pto_vta",
    "afip_cert_pem",
    "afip_key_pem",
    "ga_measurement_id",
    "clubfidel_api_url",
    "clubfidel_admin_secret",
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

function normalizePricingConfigWithSubmodules(
  raw: ErpPricingConfigRecord
): ErpPricingConfigRecord {
  const nextModPrices: ErpPricingConfigRecord["module_prices"] = {
    ...(raw.module_prices || {}),
  };
  for (const m of ERP_COMMERCIAL_MODULES) {
    const existing = nextModPrices[m.key];
    const existingSubs = existing?.submodulePrices || {};
    const subMap: Record<string, number> = {};
    let hasAllSubs = m.submodules.every(
      (s) => existingSubs[s.key] !== undefined && Number.isFinite(Number(existingSubs[s.key]))
    );

    if (hasAllSubs) {
      let sum = 0;
      for (const s of m.submodules) {
        const val = Math.max(0, Math.round(Number(existingSubs[s.key] || 0)));
        subMap[s.key] = val;
        sum += val;
      }
      nextModPrices[m.key] = {
        price: sum,
        defaultDiscountPct: Number(existing?.defaultDiscountPct || 0),
        submodulePrices: subMap,
      };
    } else {
      const targetModPrice =
        existing?.price !== undefined
          ? Math.max(0, Math.round(Number(existing.price)))
          : m.defaultMonthlyArs;
      const defaultSum = m.submodules.reduce((a, s) => a + s.defaultMonthlyArs, 0);
      let running = 0;
      m.submodules.forEach((s, idx) => {
        if (existingSubs[s.key] !== undefined) {
          const v = Math.max(0, Math.round(Number(existingSubs[s.key])));
          subMap[s.key] = v;
          running += v;
        } else if (targetModPrice === defaultSum) {
          subMap[s.key] = s.defaultMonthlyArs;
          running += s.defaultMonthlyArs;
        } else if (idx === m.submodules.length - 1) {
          subMap[s.key] = Math.max(0, targetModPrice - running);
        } else {
          const share =
            defaultSum > 0
              ? Math.round((targetModPrice * s.defaultMonthlyArs) / defaultSum)
              : Math.round(targetModPrice / Math.max(1, m.submodules.length));
          subMap[s.key] = share;
          running += share;
        }
      });
      const finalSum = Object.values(subMap).reduce((a, b) => a + b, 0);
      nextModPrices[m.key] = {
        price: finalSum,
        defaultDiscountPct: Number(existing?.defaultDiscountPct || 0),
        submodulePrices: subMap,
      };
    }
  }
  return {
    ...raw,
    module_prices: nextModPrices,
  };
}

export async function getPricingConfig(): Promise<ErpPricingConfigRecord> {
  await ensureBaseMiniSistemaTenant();
  const sb = await getPlatformSupabase();
  const { data } = await sb
    .from("erp_pricing_config")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  return normalizePricingConfigWithSubmodules(
    (data as ErpPricingConfigRecord | null) || buildDefaultPricingConfig()
  );
}

export async function savePricingConfig(
  nextCfg: Partial<ErpPricingConfigRecord>
): Promise<ErpPricingConfigRecord> {
  const current = await getPricingConfig();
  const rawMerged: ErpPricingConfigRecord = {
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
  const merged = normalizePricingConfigWithSubmodules(rawMerged);
  const sb = await getPlatformSupabase();
  const { data, error } = await sb
    .from("erp_pricing_config")
    .upsert(merged, { onConflict: "id" })
    .select("*")
    .single();
  if (error) {
    throw new Error(`Error guardando lista de precios: ${error.message}`);
  }
  return normalizePricingConfigWithSubmodules(data as ErpPricingConfigRecord);
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
    publicTurnosUrl: `https://${wwwDomain}/turnos`,
    publicInmobiliariaUrl: `https://${wwwDomain}/inmobiliaria`,
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
  actividadNegocio?: "comercial" | "servicios" | "mixta";
  businessName: string;
  fantasyName?: string;
  customDomain?: string;
  branding?: Partial<ErpTenantBranding>;
  commercialModuleKeys: string[];
  selectedSubmoduleKeys?: string[];
  moduleOverrides?: Array<{
    moduleKey: string;
    selectedSubmodules?: string[];
    customPrice?: number | null;
    discountPct?: number;
    discountFixed?: number;
  }>;
  customOptionBasePrice?: number | null;
  optionDiscountPct?: number;
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
  trialConfig?: {
    enabled: boolean;
    trialHours: number;
    demoUsername: string;
    demoPassword: string;
    quoteId?: string | null;
    quoteNumber?: string | null;
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

  const explicitSubs = Array.isArray(input.selectedSubmoduleKeys)
    ? input.selectedSubmoduleKeys.filter(Boolean)
    : [];
  const selectedCommKeys =
    input.commercialModuleKeys.length > 0
      ? input.commercialModuleKeys
      : explicitSubs.length > 0
        ? Array.from(
            new Set(
              ERP_COMMERCIAL_MODULES.filter((m) =>
                m.submodules.some((s) => explicitSubs.includes(s.key))
              ).map((m) => m.key)
            )
          )
        : ["facturacion", "articulos", "clientes"];

  const enabledErpModules = expandCommercialToErpModules(
    selectedCommKeys,
    explicitSubs.length > 0 ? explicitSubs : undefined
  );

  const pricingConfig = await getPricingConfig();
  const moduleOverrides =
    input.moduleOverrides && input.moduleOverrides.length > 0
      ? input.moduleOverrides
      : selectedCommKeys.map((k) => {
          const def = ERP_COMMERCIAL_MODULES.find((m) => m.key === k);
          const selSubs =
            explicitSubs.length > 0 && def
              ? def.submodules
                  .filter((s) => explicitSubs.includes(s.key))
                  .map((s) => s.key)
              : undefined;
          return { moduleKey: k, selectedSubmodules: selSubs };
        });

  const subscription = calculateSubscriptionQuote({
    optionType,
    pricingConfig,
    customOptionBasePrice: input.customOptionBasePrice,
    optionDiscountPct: input.optionDiscountPct,
    moduleOverrides,
    globalDiscountType: input.globalDiscountType || "none",
    globalDiscountPct: input.globalDiscountPct,
    globalDiscountFixed: input.globalDiscountFixed,
    temporaryMonths: input.temporaryMonths,
    payerEmail: input.payerEmail || branding.emailInfo,
  });

  const actividadNegocio: "comercial" | "servicios" | "mixta" =
    input.actividadNegocio === "servicios" || input.actividadNegocio === "mixta"
      ? input.actividadNegocio
      : "comercial";

  const isTrialMode = Boolean(input.trialConfig?.enabled);
  const trialHours = Math.max(
    1,
    Math.min(24 * 90, Math.round(Number(input.trialConfig?.trialHours || 72)))
  );
  const nowMs = Date.now();
  const startedAtIso = new Date(nowMs).toISOString();
  const endsAtIso = new Date(nowMs + trialHours * 3600_000).toISOString();
  const autoCancelAtIso = new Date(
    nowMs + trialHours * 3600_000 + 10 * 24 * 3600_000
  ).toISOString();

  const demoUserClean = String(
    input.trialConfig?.demoUsername ||
      input.initialAdmin?.username ||
      `demo_${cleanSlug.slice(0, 12)}`
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  const demoPassClean =
    String(
      input.trialConfig?.demoPassword ||
        input.initialAdmin?.password ||
        "Demo2026"
    ).trim() || "Demo2026";

  const trialMeta: ErpTenantTrialInfo | null = isTrialMode
    ? {
        isTrial: true,
        status: "active_trial",
        trialHours,
        startedAt: startedAtIso,
        endsAt: endsAtIso,
        autoCancelAt: autoCancelAtIso,
        demoUsername: demoUserClean,
        demoPassword: demoPassClean,
        quoteId: input.trialConfig?.quoteId || null,
        quoteNumber: input.trialConfig?.quoteNumber || null,
        extendedCount: 0,
        confirmedAt: null,
        cancelledAt: null,
        cancelReason: null,
      }
    : null;

  const siteOrigin = input.siteOrigin || "https://www.minisistema.com.ar";
  const deployment: ErpTenantDeployment =
    optionType === 1 && cleanCustomDomain
      ? {
          ...(await provisionOption1Deployment({
            slug: cleanSlug,
            businessName,
            customDomain: cleanCustomDomain,
          })),
          actividadNegocio,
          trial: trialMeta,
        }
      : {
          mode: "minisistema_subpath",
          actividadNegocio,
          publicErpUrl: `${siteOrigin}/${cleanSlug}`,
          publicCarritoUrl: `${siteOrigin}/${cleanSlug}/carrito`,
          publicVerificadorUrl: `${siteOrigin}/${cleanSlug}/verificador`,
          publicTurnosUrl: `${siteOrigin}/${cleanSlug}/turnos`,
          publicInmobiliariaUrl: `${siteOrigin}/${cleanSlug}/inmobiliaria`,
          githubRepoUrl: null,
          vercelProjectId: "prj_DwQTRgpPgTyuhHGbsAlezTNTvcFE",
          vercelDomainVerified: true,
          dnsInstructions: [],
          provisionedAt: new Date().toISOString(),
          notes: isTrialMode
            ? `Período de prueba (${trialHours} hs) activo con base limpia.`
            : "Opción 2 activa bajo dominio e identidad visual oficial de MiniSistema.",
          trial: trialMeta,
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

  const effectiveInitialAdmin = isTrialMode
    ? {
        username: demoUserClean,
        password: demoPassClean,
        name: input.initialAdmin?.name || `Demo ${fantasyName}`,
        whatsapp: input.initialAdmin?.whatsapp || branding.whatsappDigits,
        branch: fantasyName,
      }
    : input.initialAdmin || null;

  const cleanSeed = buildCleanTenantSeed({
    businessName,
    actividadNegocio,
    localidad: branding.localidad,
    provincia: branding.provincia,
    cp: branding.cp,
    whatsappComercio: `+${branding.whatsappDigits.replace(/\D/g, "")}`,
    emailInfo: branding.emailInfo,
    enabledModules: enabledErpModules,
    initialAdmin: effectiveInitialAdmin,
  });

  await provisionTenantSchemaInDb(draftTenant, cleanSeed.docs, cleanSeed.users);

  if (!isTrialMode && input.createMpSubscription !== false) {
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

  invalidateTenantCache(cleanSlug);
  return created as ErpTenantRecord;
}

/**
 * Evalúa el estado del período de prueba de un comercio y ejecuta automáticamente:
 * - Paso a `expired_trial` al cumplirse las horas habilitadas.
 * - Baja automática (`status: "cancelled"`, `trial.status: "cancelled_baja"`) a los 10 días posteriores
 *   al vencimiento si no se confirmó la habilitación del Plan.
 */
export async function evaluateAndSyncTenantTrial(
  tenant: ErpTenantRecord
): Promise<{
  tenant: ErpTenantRecord;
  changed: boolean;
  autoCancelledNow: boolean;
}> {
  const trial = tenant.deployment?.trial;
  if (!trial || !trial.isTrial || tenant.is_base) {
    return { tenant, changed: false, autoCancelledNow: false };
  }
  if (trial.status === "confirmed_plan" || trial.status === "cancelled_baja") {
    return { tenant, changed: false, autoCancelledNow: false };
  }

  const nowMs = Date.now();
  const endsMs = Date.parse(trial.endsAt || "");
  const autoCancelMs = Date.parse(trial.autoCancelAt || "");
  const sb = await getPlatformSupabase();

  // 1) Si ya pasaron 10 días desde el fin del período de prueba sin confirmar Plan -> Baja Automática
  if (Number.isFinite(autoCancelMs) && nowMs >= autoCancelMs) {
    const nextTrial: ErpTenantTrialInfo = {
      ...trial,
      isTrial: true,
      status: "cancelled_baja",
      cancelledAt: new Date(nowMs).toISOString(),
      cancelReason:
        "Baja automática tras cumplirse 10 días desde el fin del período de prueba sin confirmación del Plan.",
    };
    const nextDep: ErpTenantDeployment = {
      ...tenant.deployment,
      trial: nextTrial,
    };
    const { data: updated } = await sb
      .from("erp_tenants")
      .update({
        status: "cancelled",
        deployment: nextDep,
        updated_at: new Date(nowMs).toISOString(),
      })
      .eq("slug", tenant.slug)
      .select("*")
      .maybeSingle();

    await sb.from("erp_subscription_events").insert({
      tenant_slug: tenant.slug,
      event_type: "TRIAL_AUTO_CANCELLED_10D",
      mp_preapproval_id: null,
      amount: 0,
      payload: {
        startedAt: trial.startedAt,
        endsAt: trial.endsAt,
        autoCancelAt: trial.autoCancelAt,
        quoteNumber: trial.quoteNumber || null,
      },
    });

    invalidateTenantCache(tenant.slug);
    return {
      tenant: (updated as ErpTenantRecord) || {
        ...tenant,
        status: "cancelled",
        deployment: nextDep,
      },
      changed: true,
      autoCancelledNow: true,
    };
  }

  // 2) Si finalizaron las horas de prueba pero aún está dentro de los 10 días de margen
  if (
    Number.isFinite(endsMs) &&
    nowMs >= endsMs &&
    trial.status === "active_trial"
  ) {
    const nextTrial: ErpTenantTrialInfo = {
      ...trial,
      status: "expired_trial",
    };
    const nextDep: ErpTenantDeployment = {
      ...tenant.deployment,
      trial: nextTrial,
    };
    const { data: updated } = await sb
      .from("erp_tenants")
      .update({
        deployment: nextDep,
        updated_at: new Date(nowMs).toISOString(),
      })
      .eq("slug", tenant.slug)
      .select("*")
      .maybeSingle();

    invalidateTenantCache(tenant.slug);
    return {
      tenant: (updated as ErpTenantRecord) || {
        ...tenant,
        deployment: nextDep,
      },
      changed: true,
      autoCancelledNow: false,
    };
  }

  return { tenant, changed: false, autoCancelledNow: false };
}
