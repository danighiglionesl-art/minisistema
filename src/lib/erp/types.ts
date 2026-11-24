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
  selectedSubmodules?: string[];
  basePrice: number;
  discountPct: number;
  discountFixed: number;
  finalPrice: number;
}

export interface ErpTenantSubscription {
  optionType: 1 | 2;
  optionBasePrice: number;
  optionDiscountPct?: number;
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

export interface ErpTenantTrialInfo {
  isTrial: boolean;
  status: "active_trial" | "expired_trial" | "confirmed_plan" | "cancelled_baja";
  trialHours: number;
  startedAt: string;
  endsAt: string;
  autoCancelAt: string;
  demoUsername: string;
  demoPassword?: string;
  quoteId?: string | null;
  quoteNumber?: string | null;
  extendedCount?: number;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
}

export interface ErpTenantDeployment {
  mode: "minisistema_subpath" | "custom_domain_vercel_github";
  actividadNegocio?: "comercial" | "servicios" | "mixta";
  publicErpUrl: string;
  publicCarritoUrl: string;
  publicVerificadorUrl: string;
  publicTurnosUrl?: string;
  publicInmobiliariaUrl?: string;
  githubRepoUrl: string | null;
  vercelProjectId: string | null;
  vercelDomainVerified: boolean;
  dnsInstructions: Array<{ type: string; name: string; value: string }>;
  provisionedAt: string;
  notes: string;
  trial?: ErpTenantTrialInfo | null;
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

export interface CommercialSubmoduleDef {
  key: string;
  name: string;
  defaultMonthlyArs: number;
}

export interface CommercialModuleDef {
  key: string;
  name: string;
  description: string;
  defaultMonthlyArs: number;
  erpModuleKeys: string[];
  submodules: CommercialSubmoduleDef[];
}

export type SuperAdminQuoteStatus =
  | "BORRADOR"
  | "ENVIADO"
  | "ACEPTADO"
  | "EN_PRUEBA"
  | "CONFIRMADO"
  | "RECHAZADO"
  | "BAJA_DEMO";

export interface SuperAdminQuoteRecord {
  id: string;
  seq: number;
  numero: string;
  estado: SuperAdminQuoteStatus;
  createdAt: string;
  updatedAt: string;
  validDays: number;
  slug: string;
  fantasyName: string;
  businessName: string;
  cuit: string;
  contactName: string;
  payerEmail: string;
  whatsappDigits: string;
  localidad: string;
  optionType: 1 | 2;
  customDomain: string;
  actividadNegocio: "comercial" | "servicios" | "mixta";
  primaryHex: string;
  accentHex: string;
  logo1x1Url: string;
  logoHorizontalUrl: string;
  selectedModuleKeys: string[];
  selectedSubmoduleKeys: string[];
  optionBasePrice: number;
  optionDiscountPct: number;
  moduleDiscountsPct: Record<string, number>;
  submodulePricesSnapshot: Record<string, number>;
  globalDiscountType: DiscountDurationType;
  globalDiscountPct: number;
  globalDiscountFixed: number;
  temporaryMonths: number;
  optionNet: number;
  modulesNet: number;
  subtotalMensual: number;
  totalPromoMensual: number;
  totalRegularMensual: number;
  trialHours: number;
  demoUsername: string;
  demoPassword: string;
  adminUsername: string;
  adminPassword: string;
  adminName: string;
  notas: string;
  linkedTenantSlug: string | null;
  historial: Array<{
    fecha: string;
    accion: string;
    detalle: string;
  }>;
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
  "estadisticas:dashboard",
  "estadisticas:facturacion",
  "estadisticas:ranking",
  "estadisticas:medios",
  "estadisticas:margenes",
  "estadisticas:ganancia_bruta",
  "estadisticas:ganancia_neta",
  "estadisticas:art_generico",
  "tema",
  "verificador",
  "administracion_personal",
  "cv",
  "cv:recibidos",
  "cv:previsualizados",
  "personal:asistencias",
  "gestion_consultorios",
  "turnos",
  "turnos:profesionales",
  "turnos:obras_sociales",
  "turnos:planes",
  "turnos:especialidades",
  "turnos:gestion_profesionales",
  "turnos:pacientes",
  "turnos:gestion_turnos",
  "turnos:pagos_split",
  "turnos:portal",
  "historia_clinica",
  "historia_clinica:fichas",
  "historia_clinica:evoluciones",
  "historia_clinica:estudios",
  "historia_clinica:recetas",
  "gestion_web",
  "gestion_web:usuarios",
  "gestion_web:editor",
  "gestion_web:recetas",
  "gestion_web:profesionales",
  "inmobiliaria",
  "inmobiliaria:banners",
  "inmobiliaria:propiedades",
  "inmobiliaria:clientes",
  "inmobiliaria:contratos",
  "inmobiliaria:plantillas",
  "inmobiliaria:pagos_split",
  "inmobiliaria:consultas",
  "inmobiliaria:portal",
  "mi_contador",
  "mi_contador:ia",
  "mi_contador:arca_ri",
  "mi_contador:monotributo",
  "mi_contador:gastos_retiros",
  "mi_contador:finanzas_stock",
  "mi_contador:config",
  "servicios",
  "servicios:panel",
  "servicios:catalogo",
  "servicios:presupuestos",
  "servicios:ordenes",
  "servicios:partes",
  "servicios:documentos",
  "servicios:agenda",
  "servicios:abonos",
  "servicios:informes",
  "perfil",
  "atajos",
  "manual_usuario",
  "ayuda",
  "ayuda:atajos",
  "ayuda:manual_usuario",
  "ayuda:reporte_mejoras",
];

export const ERP_COMMERCIAL_MODULES: CommercialModuleDef[] = [
  {
    key: "facturacion",
    name: "Facturación Electrónica ARCA",
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
    submodules: [
      { key: "facturacion:caja1", name: "Caja 1 (POS)", defaultMonthlyArs: 2000 },
      { key: "facturacion:caja2", name: "Caja 2 (POS)", defaultMonthlyArs: 2000 },
      { key: "facturacion:caja3", name: "Caja 3 (POS)", defaultMonthlyArs: 2000 },
      { key: "facturacion:facturador", name: "Facturador A4 / Directo", defaultMonthlyArs: 2000 },
      { key: "facturacion:recibo", name: "Emisión de Recibos", defaultMonthlyArs: 2000 },
      { key: "facturacion:apertura", name: "Apertura de Caja", defaultMonthlyArs: 2000 },
      { key: "facturacion:retiro", name: "Retiro de Efectivo", defaultMonthlyArs: 2000 },
      { key: "facturacion:cierre", name: "Cierre y Arqueo de Turno", defaultMonthlyArs: 2000 },
      { key: "facturacion:movil", name: "Facturador Móvil / Soy Cajero", defaultMonthlyArs: 2000 },
      { key: "facturacion:comprobantes", name: "Comprobantes Emitidos", defaultMonthlyArs: 2000 },
      { key: "facturacion:admin_arca", name: "Administración Comprobantes ARCA", defaultMonthlyArs: 2000 },
    ],
  },
  {
    key: "articulos",
    name: "Artículos, Stock y Precios",
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
    submodules: [
      { key: "articulos:listado", name: "Listado y Padrón de Artículos", defaultMonthlyArs: 2000 },
      { key: "articulos:nuevo", name: "Nuevo Artículo", defaultMonthlyArs: 1000 },
      { key: "articulos:duplicar", name: "Duplicar Artículo", defaultMonthlyArs: 1000 },
      { key: "articulos:config_precios", name: "Configuración de Listas y Precios", defaultMonthlyArs: 1500 },
      { key: "articulos:abm_marcas", name: "ABM Marcas", defaultMonthlyArs: 1000 },
      { key: "articulos:abm_rubros", name: "ABM Rubros", defaultMonthlyArs: 1000 },
      { key: "articulos:factura_prov", name: "Lectura Factura Proveedor", defaultMonthlyArs: 1500 },
      { key: "articulos:carga_rapida", name: "Carga Rápida de Stock y Precios", defaultMonthlyArs: 1500 },
      { key: "articulos:control_stock", name: "Control e Inventario de Stock", defaultMonthlyArs: 1500 },
      { key: "articulos:stock_negativo", name: "Control de Stock Negativo", defaultMonthlyArs: 1000 },
      { key: "articulos:precios_gondola", name: "Etiquetas y Precios de Góndola", defaultMonthlyArs: 1000 },
      { key: "articulos:ofertas", name: "Ofertas y Promociones", defaultMonthlyArs: 1000 },
      { key: "articulos:pedidos", name: "Pedidos de Reposición", defaultMonthlyArs: 1000 },
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
    submodules: [
      { key: "clientes:padron", name: "Padrón de Clientes", defaultMonthlyArs: 3000 },
      { key: "clientes:nuevo", name: "Alta y Edición de Cliente", defaultMonthlyArs: 3000 },
      { key: "clientes:ctacte", name: "Resumen de Cuentas Corrientes", defaultMonthlyArs: 3000 },
      { key: "clientes:detalle_ctacte", name: "Detalle e Imputación de Cta. Cte.", defaultMonthlyArs: 3000 },
    ],
  },
  {
    key: "proveedores",
    name: "Proveedores y Ventas",
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
    submodules: [
      { key: "proveedores:padron", name: "Padrón de Proveedores", defaultMonthlyArs: 1500 },
      { key: "proveedores:nuevo", name: "Alta y Edición de Proveedor", defaultMonthlyArs: 1500 },
      { key: "proveedores:ctacte", name: "Cuentas Corrientes Proveedores", defaultMonthlyArs: 2000 },
      { key: "proveedores:duales", name: "Titulares Duales (Cliente / Proveedor)", defaultMonthlyArs: 1500 },
      { key: "proveedores:factura_prov", name: "Carga Facturas de Compra", defaultMonthlyArs: 2000 },
      { key: "proveedores:carga_rapida", name: "Actualización Rápida por Proveedor", defaultMonthlyArs: 1500 },
      { key: "proveedores:control_stock", name: "Control de Stock por Proveedor", defaultMonthlyArs: 1000 },
      { key: "proveedores:stock_negativo", name: "Stock Negativo por Proveedor", defaultMonthlyArs: 1000 },
      { key: "proveedores:precios_gondola", name: "Etiquetas Góndola por Proveedor", defaultMonthlyArs: 1000 },
      { key: "proveedores:pedidos", name: "Pedidos a Proveedores", defaultMonthlyArs: 1000 },
    ],
  },
  {
    key: "fondos",
    name: "Fondos",
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
    submodules: [
      { key: "fondos:caja_central", name: "Caja Central y Recepción de Cierres", defaultMonthlyArs: 3000 },
      { key: "fondos:caja", name: "Movimientos de Tesorería / Caja", defaultMonthlyArs: 2500 },
      { key: "fondos:recibo_pago", name: "Recibo de Cobro", defaultMonthlyArs: 2000 },
      { key: "fondos:orden_pago", name: "Orden de Pago", defaultMonthlyArs: 2000 },
      { key: "fondos:bancos", name: "Cuentas Bancarias y Conciliación", defaultMonthlyArs: 2500 },
      { key: "fondos:stock_valorizado", name: "Stock Valorizado", defaultMonthlyArs: 2000 },
    ],
  },
  {
    key: "carrito",
    name: "Carrito Web",
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
    submodules: [
      { key: "carrito:abrir_tienda", name: "Tienda Online y Pedidos Web (/carrito)", defaultMonthlyArs: 5000 },
      { key: "carrito:usuarios", name: "App de Clientes y Usuarios Registrados", defaultMonthlyArs: 4000 },
      { key: "carrito:articulos", name: "Catálogo Web y Visibilidad", defaultMonthlyArs: 3500 },
      { key: "carrito:banners", name: "Banners Promocionales y Carrusel", defaultMonthlyArs: 2500 },
      { key: "carrito:ventana_emergente", name: "Popups y Avisos Emergentes", defaultMonthlyArs: 2500 },
      { key: "carrito:reg_online", name: "Alta Online y Login con Google", defaultMonthlyArs: 2500 },
    ],
  },
  {
    key: "fidelizacion",
    name: "Fidelización de Clientes",
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
    submodules: [
      { key: "fidelizacion:operaciones", name: "Suma y Operaciones de Puntos", defaultMonthlyArs: 2000 },
      { key: "fidelizacion:catalogo", name: "Catálogo de Premios", defaultMonthlyArs: 2000 },
      { key: "fidelizacion:clientes", name: "Padrón de Socios Fidelizados", defaultMonthlyArs: 2000 },
      { key: "fidelizacion:config", name: "Reglas de Puntos y Factor Canje", defaultMonthlyArs: 2000 },
      { key: "fidelizacion:config_notif", name: "Notificaciones WhatsApp y Email", defaultMonthlyArs: 2000 },
      { key: "fidelizacion:canjes", name: "Entrega de Canjes Efectuados", defaultMonthlyArs: 2000 },
    ],
  },
  {
    key: "whatsapp",
    name: "WhatsApp Oficial",
    description: "Envío de comprobantes, avisos automáticos y campañas segmentadas por WhatsApp.",
    defaultMonthlyArs: 12000,
    erpModuleKeys: ["whatsapp"],
    submodules: [
      { key: "whatsapp", name: "Envío de Comprobantes, Avisos y Campañas WhatsApp", defaultMonthlyArs: 12000 },
    ],
  },
  {
    key: "estadisticas",
    name: "Estadísticas",
    description: "Evolución de facturación, ranking de productos, medios de cobro, márgenes netos y listado artículo genérico.",
    defaultMonthlyArs: 12000,
    erpModuleKeys: [
      "estadisticas",
      "estadisticas:dashboard",
      "estadisticas:facturacion",
      "estadisticas:ranking",
      "estadisticas:medios",
      "estadisticas:margenes",
      "estadisticas:ganancia_bruta",
      "estadisticas:ganancia_neta",
      "estadisticas:art_generico",
    ],
    submodules: [
      { key: "estadisticas:dashboard", name: "Tablero Ejecutivo", defaultMonthlyArs: 1500 },
      { key: "estadisticas:facturacion", name: "Evolución de Facturación y PVs", defaultMonthlyArs: 1500 },
      { key: "estadisticas:ranking", name: "Ranking de Artículos y Rubros", defaultMonthlyArs: 1500 },
      { key: "estadisticas:medios", name: "Medios de Cobro", defaultMonthlyArs: 1500 },
      { key: "estadisticas:margenes", name: "Márgenes de Rentabilidad", defaultMonthlyArs: 1500 },
      { key: "estadisticas:ganancia_bruta", name: "Ganancia Bruta", defaultMonthlyArs: 1500 },
      { key: "estadisticas:ganancia_neta", name: "Ganancia Neta", defaultMonthlyArs: 1500 },
      { key: "estadisticas:art_generico", name: "Control Artículo Genérico", defaultMonthlyArs: 1500 },
    ],
  },
  {
    key: "tema",
    name: "Fondo Claro / Fondo Oscuro",
    description: "Selector de tema claro y oscuro en la pantalla principal del ERP (disponible sin costo).",
    defaultMonthlyArs: 0,
    erpModuleKeys: ["tema"],
    submodules: [
      { key: "tema", name: "Selector de Modo Claro / Oscuro", defaultMonthlyArs: 0 },
    ],
  },
  {
    key: "verificador",
    name: "Verificador de Precios",
    description: "Pantalla interactiva para lectores de código de barras en góndola / salón comercial.",
    defaultMonthlyArs: 8000,
    erpModuleKeys: ["verificador"],
    submodules: [
      { key: "verificador", name: "Terminal Interactiva Verificador de Góndola (/verificador)", defaultMonthlyArs: 8000 },
    ],
  },
  {
    key: "cv",
    name: "Administración de Personal",
    description: "Módulo integral de Administración de Personal: Curriculum Vitae (portal público /cv con foto y PDF, bandeja recibidos/previsualizados y valoración 1 a 10) + Control de Asistencias.",
    defaultMonthlyArs: 12000,
    erpModuleKeys: [
      "administracion_personal",
      "cv",
      "cv:recibidos",
      "cv:previsualizados",
      "personal:asistencias",
    ],
    submodules: [
      { key: "cv:recibidos", name: "Portal Público /cv y Bandeja Recibidos", defaultMonthlyArs: 4000 },
      { key: "cv:previsualizados", name: "CV Previsualizados y Valoración 1 a 10", defaultMonthlyArs: 4000 },
      { key: "personal:asistencias", name: "Control de Asistencias y Horarios", defaultMonthlyArs: 4000 },
    ],
  },
  {
    key: "turnos",
    name: "Gestión Consultorios",
    description:
      "Módulo unificado Gestión Consultorios: Turnero Web 24 hs con Videollamada y Split Mercado Pago + Sistema integral de Historia Clínica (fichas médicas, evoluciones SOAP, signos vitales, estudios adjuntos y recetas digitales).",
    defaultMonthlyArs: 28000,
    erpModuleKeys: [
      "gestion_consultorios",
      "turnos",
      "turnos:profesionales",
      "turnos:obras_sociales",
      "turnos:planes",
      "turnos:especialidades",
      "turnos:gestion_profesionales",
      "turnos:pacientes",
      "turnos:gestion_turnos",
      "turnos:pagos_split",
      "turnos:portal",
      "historia_clinica",
      "historia_clinica:fichas",
      "historia_clinica:evoluciones",
      "historia_clinica:estudios",
      "historia_clinica:recetas",
    ],
    submodules: [
      { key: "turnos:profesionales", name: "ABM Profesionales", defaultMonthlyArs: 2000 },
      { key: "turnos:obras_sociales", name: "ABM Obras Sociales y Prepagas", defaultMonthlyArs: 2000 },
      { key: "turnos:planes", name: "ABM Planes de Obras Sociales", defaultMonthlyArs: 1500 },
      { key: "turnos:especialidades", name: "ABM Especialidades y Duración", defaultMonthlyArs: 1500 },
      { key: "turnos:gestion_profesionales", name: "Agendas y Horarios de Profesionales", defaultMonthlyArs: 2500 },
      { key: "turnos:pacientes", name: "Gestión y Padrón de Pacientes", defaultMonthlyArs: 2000 },
      { key: "turnos:gestion_turnos", name: "Gestión de Turnos y Videollamadas", defaultMonthlyArs: 3000 },
      { key: "turnos:pagos_split", name: "Cobros Online y Split Mercado Pago", defaultMonthlyArs: 2500 },
      { key: "turnos:portal", name: "Portal Público /turnos 24 hs", defaultMonthlyArs: 3000 },
      { key: "historia_clinica:fichas", name: "Historia Clínica · Fichas Médicas", defaultMonthlyArs: 2000 },
      { key: "historia_clinica:evoluciones", name: "Historia Clínica · Evoluciones SOAP", defaultMonthlyArs: 2500 },
      { key: "historia_clinica:estudios", name: "Historia Clínica · Estudios Adjuntos", defaultMonthlyArs: 1500 },
      { key: "historia_clinica:recetas", name: "Historia Clínica · Recetas Digitales", defaultMonthlyArs: 2000 },
    ],
  },
  {
    key: "gestion_web",
    name: "Gestión Web",
    description:
      "Administración del portal web institucional (/cemep), listado de usuarios registrados (Google/Email), editor de contenidos publicables en vivo, accesos de profesionales y carga de recetas digitales.",
    defaultMonthlyArs: 18000,
    erpModuleKeys: [
      "gestion_web",
      "gestion_web:usuarios",
      "gestion_web:editor",
      "gestion_web:recetas",
      "gestion_web:profesionales",
    ],
    submodules: [
      { key: "gestion_web:usuarios", name: "Usuarios Registrados del Portal", defaultMonthlyArs: 4500 },
      { key: "gestion_web:editor", name: "Editor de Contenidos Web en Vivo", defaultMonthlyArs: 4500 },
      { key: "gestion_web:recetas", name: "Solicitud y Carga de Recetas Digitales", defaultMonthlyArs: 4500 },
      { key: "gestion_web:profesionales", name: "Accesos y Perfiles de Profesionales", defaultMonthlyArs: 4500 },
    ],
  },
  {
    key: "mi_contador",
    name: "Mi Contador",
    description: "Pre-liquidación asistida de IVA Simple F.2051, Libro IVA Digital F.2083 (TXT ARCA), IIBB Córdoba F.5663, Monitor Monotributo, Control de Gastos/Retiros, Stock Muerto, Rotación ABC y Asesor Empresarial con IA.",
    defaultMonthlyArs: 22000,
    erpModuleKeys: [
      "mi_contador",
      "mi_contador:ia",
      "mi_contador:arca_ri",
      "mi_contador:monotributo",
      "mi_contador:gastos_retiros",
      "mi_contador:finanzas_stock",
      "mi_contador:config",
    ],
    submodules: [
      { key: "mi_contador:ia", name: "Asesor Impositivo y Empresarial IA", defaultMonthlyArs: 4500 },
      { key: "mi_contador:arca_ri", name: "Pre-liquidación IVA Simple y Libro IVA Digital", defaultMonthlyArs: 4500 },
      { key: "mi_contador:monotributo", name: "Monitor de Categorías Monotributo", defaultMonthlyArs: 3500 },
      { key: "mi_contador:gastos_retiros", name: "Control de Gastos y Retiros", defaultMonthlyArs: 3500 },
      { key: "mi_contador:finanzas_stock", name: "Stock Muerto y Rotación ABC", defaultMonthlyArs: 3500 },
      { key: "mi_contador:config", name: "Configuración Fiscal y Parámetros", defaultMonthlyArs: 2500 },
    ],
  },
  {
    key: "inmobiliaria",
    name: "Inmobiliaria",
    description:
      "Portal público /inmobiliaria con banners 1530×370, destacadas, pestañas Ventas/Alquileres/Temporarios, Google Maps, carteles cruzados, buscador rápido e IA, Portal de Clientes (Google/Email) con PDFs, cuenta corriente y Split Propietario/Inmobiliaria.",
    defaultMonthlyArs: 28000,
    erpModuleKeys: [
      "inmobiliaria",
      "inmobiliaria:banners",
      "inmobiliaria:propiedades",
      "inmobiliaria:clientes",
      "inmobiliaria:contratos",
      "inmobiliaria:plantillas",
      "inmobiliaria:pagos_split",
      "inmobiliaria:consultas",
      "inmobiliaria:portal",
    ],
    submodules: [
      { key: "inmobiliaria:banners", name: "Banners y Destacadas del Portal", defaultMonthlyArs: 3500 },
      { key: "inmobiliaria:propiedades", name: "ABM Propiedades y Mapa Satelital", defaultMonthlyArs: 3500 },
      { key: "inmobiliaria:clientes", name: "Propietarios, Inquilinos y Cta. Cte.", defaultMonthlyArs: 3500 },
      { key: "inmobiliaria:contratos", name: "Contratos de Alquiler y Actualizaciones", defaultMonthlyArs: 3500 },
      { key: "inmobiliaria:plantillas", name: "Plantillas Documentales", defaultMonthlyArs: 3500 },
      { key: "inmobiliaria:pagos_split", name: "Liquidaciones y Split Mercado Pago", defaultMonthlyArs: 3500 },
      { key: "inmobiliaria:consultas", name: "Bandeja de Consultas Web / WhatsApp", defaultMonthlyArs: 3500 },
      { key: "inmobiliaria:portal", name: "Portal Público /inmobiliaria y Acceso Clientes", defaultMonthlyArs: 3500 },
    ],
  },
  {
    key: "servicios",
    name: "Gestión de Servicios",
    description:
      "Módulo integral de servicios integrado a Clientes, Facturación ARCA (individual, parcial, lote y mixta) y Cuenta Corriente única: catálogo configurable, presupuestos PDF, órdenes de trabajo, partes con conformidad, documentación técnica, agenda/personal, abonos recurrentes e informes.",
    defaultMonthlyArs: 26000,
    erpModuleKeys: [
      "servicios",
      "servicios:panel",
      "servicios:catalogo",
      "servicios:presupuestos",
      "servicios:ordenes",
      "servicios:partes",
      "servicios:documentos",
      "servicios:agenda",
      "servicios:abonos",
      "servicios:informes",
    ],
    submodules: [
      { key: "servicios:panel", name: "Tablero Operativo de Servicios", defaultMonthlyArs: 3000 },
      { key: "servicios:catalogo", name: "Catálogo de Servicios y Tarifas", defaultMonthlyArs: 3000 },
      { key: "servicios:presupuestos", name: "Presupuestos de Servicios PDF", defaultMonthlyArs: 3500 },
      { key: "servicios:ordenes", name: "Órdenes de Trabajo", defaultMonthlyArs: 3500 },
      { key: "servicios:partes", name: "Partes Técnicos con Conformidad", defaultMonthlyArs: 3000 },
      { key: "servicios:documentos", name: "Documentación Técnica Adjunta", defaultMonthlyArs: 2500 },
      { key: "servicios:agenda", name: "Agenda y Asignación de Personal", defaultMonthlyArs: 2500 },
      { key: "servicios:abonos", name: "Abonos Recurrentes", defaultMonthlyArs: 2500 },
      { key: "servicios:informes", name: "Informes y Facturación Lote / Mixta", defaultMonthlyArs: 2500 },
    ],
  },
  {
    key: "manual_usuario",
    name: "Ayuda",
    description: "Guía interactiva paso a paso por rol, asistente con Inteligencia Artificial, registro de actualizaciones y exportación PDF.",
    defaultMonthlyArs: 0,
    erpModuleKeys: ["ayuda", "ayuda:atajos", "ayuda:manual_usuario", "ayuda:reporte_mejoras", "manual_usuario"],
    submodules: [
      { key: "ayuda:atajos", name: "Atajos Rápidos de Teclado", defaultMonthlyArs: 0 },
      { key: "ayuda:manual_usuario", name: "Manual Interactivo e IA", defaultMonthlyArs: 0 },
      { key: "ayuda:reporte_mejoras", name: "Reporte de Mejoras y Soporte CRM", defaultMonthlyArs: 0 },
    ],
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
      submodulePrices?: Record<string, number>;
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
    cleanRole === "superadmin" ||
    cleanRole === "administrador" ||
    cleanRole === "admin"
  ) {
    return "Administrador";
  }
  return "Usuario";
}

/**
 * Expands either top-level commercial module keys OR granular submodule keys into
 * the exact set of ERP module/submodule keys enabled for the tenant.
 * - If granular submodule keys (`mod:sub`) are provided for a module, ONLY those
 *   submodules (plus their required parent container key) are enabled!
 * - If only a top-level module key (`mod`) is provided with no child keys, all of its
 *   submodules are enabled (backward compatible).
 */
export function expandCommercialToErpModules(
  commercialKeys: string[],
  explicitSubmoduleKeys?: string[]
): string[] {
  const out = new Set<string>([
    "tema",
    "perfil",
    "atajos",
    "ayuda",
    "ayuda:atajos",
    "ayuda:manual_usuario",
    "ayuda:reporte_mejoras",
    "manual_usuario",
  ]);

  if (Array.isArray(explicitSubmoduleKeys) && explicitSubmoduleKeys.length > 0) {
    const subSet = new Set(
      explicitSubmoduleKeys.map((k) => String(k || "").trim().toLowerCase())
    );
    for (const mod of ERP_COMMERCIAL_MODULES) {
      const matchedSubs = mod.submodules.filter((s) =>
        subSet.has(s.key.toLowerCase())
      );
      if (matchedSubs.length > 0) {
        out.add(mod.key);
        if (mod.key === "cv") out.add("administracion_personal");
        if (mod.key === "turnos") {
          out.add("gestion_consultorios");
          if (matchedSubs.some((s) => s.key.startsWith("historia_clinica:"))) {
            out.add("historia_clinica");
          }
          if (matchedSubs.some((s) => s.key.startsWith("turnos:"))) {
            out.add("turnos");
          }
        }
        for (const s of matchedSubs) {
          out.add(s.key);
        }
      }
    }
    return Array.from(out);
  }

  const rawCleaned = commercialKeys.map((k) => String(k || "").trim().toLowerCase());
  const keySet = new Set(rawCleaned);

  for (const mod of ERP_COMMERCIAL_MODULES) {
    const childMatches = mod.submodules.filter((s) =>
      keySet.has(s.key.toLowerCase())
    );
    if (childMatches.length > 0) {
      out.add(mod.key);
      if (mod.key === "cv") out.add("administracion_personal");
      if (mod.key === "turnos") {
        out.add("gestion_consultorios");
        if (childMatches.some((s) => s.key.startsWith("historia_clinica:"))) {
          out.add("historia_clinica");
        }
      }
      for (const s of childMatches) {
        out.add(s.key);
      }
    } else if (keySet.has(mod.key)) {
      for (const sub of mod.erpModuleKeys) {
        out.add(sub);
      }
    }
  }

  for (const raw of rawCleaned) {
    if (ALL_ERP_MODULE_KEYS.includes(raw)) {
      out.add(raw);
    }
  }
  return Array.from(out);
}
