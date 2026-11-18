export type ErpUserRole = "Administrador General" | "Administrador" | "Usuario";

export interface ErpUserRecord {
  username: string;
  password_hash?: string;
  plain_compat?: string;
  name: string;
  vendedor: string;
  role: ErpUserRole;
  branch: string;
  whatsapp: string;
  avatar: string;
  modules: string[];
  active: boolean;
  cajaAbierta: string | null;
  cajaAbiertaAt: string | null;
  createdBy?: string;
  updatedAt?: string;
}

export interface ErpTenantBranding {
  primaryHex: string;
  accentHex: string;
  surfaceHex: string;
  logo1x1Url: string;
  logoHorizontalUrl: string;
  logoSymbolUrl: string;
  clubName: string;
  address: string;
  localidad: string;
  provincia: string;
  cp: string;
  whatsappDigits: string;
  whatsappDisplay: string;
  emailInfo: string;
  cuitFmt: string;
  condIva: string;
  iibb: string;
  inicioAct: string;
}

export type DiscountDurationType = "none" | "temporary" | "permanent";

export interface ErpModuleSelection {
  moduleKey: string;
  basePrice: number;
  discountPct: number;
  discountFixed: number;
  finalPrice: number;
}

export interface ErpTenantSubscription {
  optionType: 1 | 2;
  optionBasePrice: number;
  selectedModules: ErpModuleSelection[];
  globalDiscountType: DiscountDurationType;
  globalDiscountPct: number;
  globalDiscountFixed: number;
  temporaryMonths: number;
  promoStartsAt: string | null;
  promoEndsAt: string | null;
  monthlyPromoAmount: number;
  monthlyRegularAmount: number;
  activeMonthlyAmount: number;
  currency: "ARS";
  payerEmail: string;
  mpPreapprovalId: string | null;
  mpInitPoint: string | null;
  mpStatus: "pending" | "authorized" | "paused" | "cancelled" | "sandbox_ready";
  lastSyncAt: string | null;
}

export interface ErpTenantDeployment {
  mode: "minisistema_subpath" | "custom_domain_vercel_github";
  publicErpUrl: string;
  publicCarritoUrl: string;
  publicVerificadorUrl: string;
  githubRepoUrl: string | null;
  vercelProjectId: string | null;
  vercelDomainVerified: boolean;
  dnsInstructions: Array<{ type: string; name: string; value: string }>;
  provisionedAt: string;
  notes: string;
}

export interface ErpTenantRecord {
  id?: string;
  slug: string;
  option_type: 1 | 2;
  is_base: boolean;
  business_name: string;
  fantasy_name: string;
  custom_domain: string | null;
  db_schema: string;
  external_supabase_url?: string | null;
  external_supabase_key?: string | null;
  status: "active" | "suspended" | "provisioning" | "cancelled";
  branding: ErpTenantBranding;
  enabled_modules: string[];
  subscription: ErpTenantSubscription;
  deployment: ErpTenantDeployment;
  created_at?: string;
  updated_at?: string;
}

export interface CommercialModuleDef {
  key: string;
  name: string;
  description: string;
  defaultMonthlyArs: number;
  erpModuleKeys: string[];
}

export const MINISISTEMA_OFFICIAL_COLORS = {
  primaryHex: "#112D3A", // Azul petróleo oscuro oficial
  accentHex: "#56D7A1",  // Verde menta oficial
  surfaceHex: "#FFFFFF", // Blanco oficial
} as const;

export const MINISISTEMA_OFFICIAL_LOGOS = {
  logo1x1Url: "/sistema/assets/img/minisistema/logo-1x1.png?v=2",
  logoHorizontalUrl: "/sistema/assets/img/minisistema/logo-horizontal.png?v=2",
  logoSymbolUrl: "/sistema/assets/img/minisistema/logo-symbol.png?v=2",
} as const;

export const GENERAL_ADMIN_USERNAME = "danielg";
export const GENERAL_ADMIN_DEFAULT_PASS = "Dani1926";

export const ALL_ERP_MODULE_KEYS: string[] = [
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
  "articulos:stock_negativo",
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
  "proveedores:stock_negativo",
  "proveedores:precios_gondola",
  "proveedores:pedidos",
  "fondos",
  "fondos:caja_central",
  "fondos:caja",
  "fondos:recibo_pago",
  "fondos:orden_pago",
  "fondos:bancos",
  "fondos:stock_valorizado",
  "carrito",
  "carrito:usuarios",
  "carrito:articulos",
  "carrito:banners",
  "carrito:ventana_emergente",
  "carrito:reg_online",
  "carrito:abrir_tienda",
  "fidelizacion",
  "fidelizacion:operaciones",
  "fidelizacion:catalogo",
  "fidelizacion:clientes",
  "fidelizacion:config",
  "fidelizacion:config_notif",
  "fidelizacion:canjes",
  "whatsapp",
  "estadisticas",
  "estadisticas:facturacion",
  "estadisticas:ranking",
  "estadisticas:medios",
  "estadisticas:margenes",
  "estadisticas:ganancia_bruta",
  "estadisticas:ganancia_neta",
  "estadisticas:art_generico",
  "tema",
  "verificador",
  "perfil",
  "ayuda",
  "ayuda:atajos",
  "ayuda:manual_usuario",
  "ayuda:reporte_mejoras",
];

export const ERP_COMMERCIAL_MODULES: CommercialModuleDef[] = [
  {
    key: "facturacion",
    name: "Facturación POS y Electrónica ARCA",
    description: "Cajas 1, 2 y 3, Facturador A4, Recibos, Apertura/Retiro/Cierre de turno, POS Móvil y WSFEv1 ARCA.",
    defaultMonthlyArs: 22000,
    erpModuleKeys: [
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
    ],
  },
  {
    key: "articulos",
    name: "Artículos, Listas de Precios y Ofertas",
    description: "Padrón de artículos, listas minorista/mayorista, etiquetas de góndola, stock negativo, ofertas y carga rápida.",
    defaultMonthlyArs: 16000,
    erpModuleKeys: [
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
      "articulos:stock_negativo",
      "articulos:precios_gondola",
      "articulos:ofertas",
      "articulos:pedidos",
    ],
  },
  {
    key: "clientes",
    name: "Clientes y Cuentas Corrientes",
    description: "Padrón de clientes con consulta ARCA, saldos, imputación e historial de cuenta corriente.",
    defaultMonthlyArs: 12000,
    erpModuleKeys: [
      "clientes",
      "clientes:padron",
      "clientes:nuevo",
      "clientes:ctacte",
      "clientes:detalle_ctacte",
    ],
  },
  {
    key: "proveedores",
    name: "Proveedores, Compras y Pedidos",
    description: "Cuentas corrientes de proveedores, lectura de facturas de compra, reposición, stock negativo y pedidos.",
    defaultMonthlyArs: 14000,
    erpModuleKeys: [
      "proveedores",
      "proveedores:padron",
      "proveedores:nuevo",
      "proveedores:ctacte",
      "proveedores:duales",
      "proveedores:factura_prov",
      "proveedores:carga_rapida",
      "proveedores:control_stock",
      "proveedores:stock_negativo",
      "proveedores:precios_gondola",
      "proveedores:pedidos",
    ],
  },
  {
    key: "fondos",
    name: "Fondos, Tesorería y Bancos",
    description: "Caja Central, Tesorería, Recibo de Pago, Orden de Pago, cuentas bancarias, conciliación de cierres y stock valorizado.",
    defaultMonthlyArs: 14000,
    erpModuleKeys: [
      "fondos",
      "fondos:caja_central",
      "fondos:caja",
      "fondos:recibo_pago",
      "fondos:orden_pago",
      "fondos:bancos",
      "fondos:stock_valorizado",
    ],
  },
  {
    key: "carrito",
    name: "Tienda Online / Carrito Web",
    description: "Catálogo público autogestionable, pedidos web, banners promocionales y popups.",
    defaultMonthlyArs: 20000,
    erpModuleKeys: [
      "carrito",
      "carrito:usuarios",
      "carrito:articulos",
      "carrito:banners",
      "carrito:ventana_emergente",
      "carrito:reg_online",
      "carrito:abrir_tienda",
    ],
  },
  {
    key: "fidelizacion",
    name: "Club de Fidelización y Puntos",
    description: "Suma automática de puntos por compra, catálogo de canjes, notificaciones WhatsApp/Email, canjes efectuados y QR.",
    defaultMonthlyArs: 12000,
    erpModuleKeys: [
      "fidelizacion",
      "fidelizacion:operaciones",
      "fidelizacion:catalogo",
      "fidelizacion:clientes",
      "fidelizacion:config",
      "fidelizacion:config_notif",
      "fidelizacion:canjes",
    ],
  },
  {
    key: "whatsapp",
    name: "WhatsApp Cloud & Campañas",
    description: "Envío de comprobantes, avisos automáticos y campañas segmentadas por WhatsApp.",
    defaultMonthlyArs: 12000,
    erpModuleKeys: ["whatsapp"],
  },
  {
    key: "estadisticas",
    name: "Estadísticas y Rentabilidad Gerencial",
    description: "Evolución de facturación, ranking de productos, medios de cobro, márgenes netos y listado artículo genérico.",
    defaultMonthlyArs: 12000,
    erpModuleKeys: [
      "estadisticas",
      "estadisticas:facturacion",
      "estadisticas:ranking",
      "estadisticas:medios",
      "estadisticas:margenes",
      "estadisticas:ganancia_bruta",
      "estadisticas:ganancia_neta",
      "estadisticas:art_generico",
    ],
  },
  {
    key: "verificador",
    name: "Verificador de Precios en Salón",
    description: "Pantalla interactiva para lectores de código de barras en góndola / salón comercial.",
    defaultMonthlyArs: 8000,
    erpModuleKeys: ["verificador"],
  },
  {
    key: "manual_usuario",
    name: "Manual del Usuario (Procesos, IA y PDF)",
    description: "Guía interactiva paso a paso por rol, asistente con Inteligencia Artificial, registro de actualizaciones y exportación PDF.",
    defaultMonthlyArs: 0,
    erpModuleKeys: ["manual_usuario"],
  },
];

export interface ErpPricingConfigRecord {
  id: string;
  option_1_base: number;
  option_2_base: number;
  module_prices: Record<
    string,
    {
      price: number;
      defaultDiscountPct: number;
    }
  >;
  discount_presets: Array<{
    id: string;
    label: string;
    durationType: DiscountDurationType;
    months: number;
    discountPct: number;
  }>;
  currency: "ARS";
  updated_at?: string;
}

export function normalizeErpRole(rawRole: unknown, username = ""): ErpUserRole {
  const cleanUser = String(username || "").trim().toLowerCase();
  if (cleanUser === GENERAL_ADMIN_USERNAME) {
    return "Administrador General";
  }
  const cleanRole = String(rawRole || "").trim().toLowerCase();
  if (
    cleanRole === "administrador general" ||
    cleanRole === "admin_general" ||
    cleanRole === "superadmin"
  ) {
    return "Administrador General";
  }
  if (cleanRole === "administrador" || cleanRole === "admin") {
    return "Administrador";
  }
  return "Usuario";
}

export function expandCommercialToErpModules(commercialKeys: string[]): string[] {
  const out = new Set<string>(["tema", "perfil", "atajos", "manual_usuario"]);
  const keySet = new Set(commercialKeys.map((k) => String(k || "").trim().toLowerCase()));
  for (const mod of ERP_COMMERCIAL_MODULES) {
    if (keySet.has(mod.key)) {
      for (const sub of mod.erpModuleKeys) {
        out.add(sub);
      }
    }
  }
  // Also preserve any fine-grained module keys passed directly
  for (const raw of commercialKeys) {
    if (ALL_ERP_MODULE_KEYS.includes(raw)) {
      out.add(raw);
    }
  }
  return Array.from(out);
}
