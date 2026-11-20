// ============================================================================
// MINISISTEMA — MÓDULO "MI CONTADOR" (ARCA F.2051 / F.2083 / F.5663 + CFO IA)
// ============================================================================

export type CondicionFiscalTipo = "RI" | "MONOTRIBUTO" | "EXENTO";
export type MonotributoActividadTipo = "VENTA_COSAS_MUEBLES" | "SERVICIOS";

export interface MonotributoEscalaItem {
  categoria: string; // "A".."K"
  topeIngresosAnualArs: number;
  cuotaMensualServiciosArs: number;
  cuotaMensualBienesArs: number;
}

export interface MiContadorFiscalConfig {
  condicionFiscal: CondicionFiscalTipo;
  cuit: string;
  razonSocial: string;
  actividadPrincipal: string;
  jurisdiccionIibb: string; // Default: "CÓRDOBA"
  alicuotaIibbPct: number; // Ej: 3.0 o 4.75 para comercio minorista Córdoba
  alicuotaIibbServiciosPct: number;
  categoriaMonotributoActual: string; // "A".."K"
  tipoActividadMonotributo: MonotributoActividadTipo;
  saldoTecnicoIvaAnterior: number;
  saldoLibreDispIvaAnterior: number;
  saldoFavorIibbAnterior: number;
  gastosFijosMensualesBase: number;
  // Delegación oficial de servicios ARCA (NUNCA se guarda Clave Fiscal)
  cuitDelegadoArca: string;
  delegacionPortalIvaActiva: boolean;
  delegacionSifereActiva: boolean;
  updatedAt: string;
}

export interface CompraFiscalRecord {
  id: string;
  fecha: string; // YYYY-MM-DD
  periodo: string; // YYYY-MM
  tipoComprobante: "FA" | "FB" | "FC" | "NCA" | "NCB" | "NDA" | "NDB" | "TICKET_A";
  puntoVenta: string;
  numero: string;
  cuitProveedor: string;
  razonSocialProveedor: string;
  netoGravado21: number;
  netoGravado105: number;
  netoGravado27: number;
  exentoNoGravado: number;
  iva21: number;
  iva105: number;
  iva27: number;
  ivaTotal: number;
  percepcionIva: number;
  percepcionIibb: number;
  otrosImpuestos: number;
  total: number;
  observaciones?: string;
  createdAt: string;
}

export interface GastoRetiroRecord {
  id: string;
  fecha: string; // YYYY-MM-DD
  periodo: string; // YYYY-MM
  tipo: "GASTO" | "RETIRO_TITULAR";
  categoria: string;
  descripcion: string;
  medioPago: "EFECTIVO" | "TRANSFERENCIA" | "DEBITO" | "CREDITO" | "QR_MP" | "CHEQUE";
  monto: number;
  esFijo: boolean;
  createdAt: string;
}

export interface RetencionPercepcionRecord {
  id: string;
  fecha: string; // YYYY-MM-DD
  periodo: string; // YYYY-MM
  impuesto: "IVA" | "IIBB_CORDOBA";
  origen: "SIRCREB" | "TARJETAS" | "PROVEEDOR" | "CLIENTE" | "MERCADO_PAGO" | "OTRO";
  comprobanteRef: string;
  cuitAgente?: string;
  monto: number;
  observaciones?: string;
  createdAt: string;
}

export interface PresentacionArcaRecord {
  id: string;
  periodo: string; // YYYY-MM
  formulario: "F2051" | "F2083" | "F5663" | "MONOTRIBUTO_RECATEG";
  estado: "BORRADOR" | "LISTA_PARA_ARCA" | "PRESENTADA" | "PAGADA";
  montoDeterminado: number;
  nroTransaccionArca?: string;
  fechaPresentacion?: string;
  observaciones?: string;
  updatedBy?: string;
  updatedAt: string;
}

export interface MiContadorDbDoc {
  updatedAt: string;
  fiscalConfig: MiContadorFiscalConfig;
  monotributoEscalas: MonotributoEscalaItem[];
  compras: CompraFiscalRecord[];
  gastosRetiros: GastoRetiroRecord[];
  retenciones: RetencionPercepcionRecord[];
  presentaciones: PresentacionArcaRecord[];
}

// Escalas de referencia Monotributo ARCA (100% editables desde el módulo cuando ARCA actualiza semestralmente)
export const DEFAULT_MONOTRIBUTO_ESCALAS: MonotributoEscalaItem[] = [
  { categoria: "A", topeIngresosAnualArs: 8992597, cuotaMensualServiciosArs: 37085, cuotaMensualBienesArs: 37085 },
  { categoria: "B", topeIngresosAnualArs: 13175201, cuotaMensualServiciosArs: 42216, cuotaMensualBienesArs: 42216 },
  { categoria: "C", topeIngresosAnualArs: 18473166, cuotaMensualServiciosArs: 49435, cuotaMensualBienesArs: 48320 },
  { categoria: "D", topeIngresosAnualArs: 22934610, cuotaMensualServiciosArs: 63357, cuotaMensualBienesArs: 61824 },
  { categoria: "E", topeIngresosAnualArs: 26977793, cuotaMensualServiciosArs: 89714, cuotaMensualBienesArs: 81070 },
  { categoria: "F", topeIngresosAnualArs: 33809379, cuotaMensualServiciosArs: 112906, cuotaMensualBienesArs: 97291 },
  { categoria: "G", topeIngresosAnualArs: 40431835, cuotaMensualServiciosArs: 172457, cuotaMensualBienesArs: 118920 },
  { categoria: "H", topeIngresosAnualArs: 61344853, cuotaMensualServiciosArs: 391400, cuotaMensualBienesArs: 238038 },
  { categoria: "I", topeIngresosAnualArs: 68664410, cuotaMensualServiciosArs: 721650, cuotaMensualBienesArs: 355672 },
  { categoria: "J", topeIngresosAnualArs: 78632948, cuotaMensualServiciosArs: 874069, cuotaMensualBienesArs: 434895 },
  { categoria: "K", topeIngresosAnualArs: 94805682, cuotaMensualServiciosArs: 1208890, cuotaMensualBienesArs: 525732 },
];

export const GASTOS_CATEGORIAS = [
  "Alquiler / Expensas",
  "Energía Eléctrica / Gas / Agua / Internet",
  "Sueldos y Cargas Sociales",
  "Impuestos y Tasas Municipales",
  "Fletes y Logística",
  "Mantenimiento y Reparaciones",
  "Publicidad y Marketing",
  "Honorarios Profesionales",
  "Insumos y Papelería",
  "Comisiones Bancarias / Posnet / MP",
  "Retiro Diario / Titular",
  "Otros Gastos Operativos",
] as const;

export function r2(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
}

export function padLeftNum(val: number | string, len: number): string {
  return String(val ?? "0").replace(/\D/g, "").slice(0, len).padStart(len, "0");
}

export function formatArcaAmount15(val: number): string {
  const cents = Math.round(Math.abs(Number(val || 0)) * 100);
  return String(cents).padStart(15, "0").slice(-15);
}

/**
 * Mapea tipo/letra al código oficial AFIP/ARCA (RG 4597 / F.2083 Libro IVA Digital)
 */
export function mapArcaCbteTipoCode(tipoRaw: string, letraRaw: string): string {
  const t = String(tipoRaw || "FA").toUpperCase();
  const l = String(letraRaw || "B").toUpperCase();
  if (t === "FA" || (t.includes("FACT") && l === "A")) return "001";
  if (t === "NDA" || (t.includes("DEB") && l === "A")) return "002";
  if (t === "NCA" || (t.includes("CRED") && l === "A")) return "003";
  if (t === "FB" || (t.includes("FACT") && l === "B")) return "006";
  if (t === "NDB" || (t.includes("DEB") && l === "B")) return "007";
  if (t === "NCB" || (t.includes("CRED") && l === "B")) return "008";
  if (t === "FC" || (t.includes("FACT") && l === "C")) return "011";
  if (t === "TICKET_A") return "081";
  return l === "A" ? "001" : l === "C" ? "011" : "006";
}
