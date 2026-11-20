import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractErpSessionFromRequest } from "../erp-session";
import { buildInitialInmobiliariaDb } from "../inmobiliaria-seed";
import {
  calculateInmoSplit,
  clampPctInmo,
  compileContractTemplate,
  computeContractAutoStatus,
  CONTRACT_PLACEHOLDERS,
  type InmoBannerRecord,
  type InmoClienteRecord,
  type InmoConsultaLeadRecord,
  type InmoContratoRecord,
  type InmoCuotaContratoRecord,
  type InmoDbDoc,
  type InmoPlantillaContratoRecord,
  type InmoPropiedadCaracteristicas,
  type InmoPropiedadRecord,
  type InmoSplitTransaction,
  isPropertyExpired,
  type MonedaInmo,
  type OperacionInmobiliaria,
  round2Inmo,
} from "../inmobiliaria-types";
import referenceCatalogs from "../reference-catalogs.json";
import {
  getTenantDoc,
  putTenantDoc,
  putTenantMediaInDb,
} from "../supabase-server";
import { enforceOptionBranding } from "../tenant-service";
import { getMpMarketplaceConfig } from "../turnos-mp-server";
import { type ErpTenantRecord, GENERAL_ADMIN_USERNAME } from "../types";

type AnyObj = Record<string, any>;

export const INMO_DOC_KEY = "inmobiliaria_db";
const CLIENT_SESSION_COOKIE = "ms_inmo_client_session";

function getClientSessionSecret(): string {
  return (
    process.env.ERP_SESSION_SECRET ||
    process.env.MP_CLIENT_SECRET ||
    "minisistema-inmobiliaria-client-session-2026"
  );
}

function hashClientPassword(plain: string): string {
  const salt = crypto.randomBytes(12).toString("hex");
  const hash = crypto.scryptSync(plain, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyClientPassword(plain: string, stored?: string, compat?: string): boolean {
  if (!plain) return false;
  if (stored && stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    if (parts.length === 3) {
      const derived = crypto.scryptSync(plain, parts[1], 32).toString("hex");
      try {
        return crypto.timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(parts[2], "hex"));
      } catch {
        return false;
      }
    }
  }
  if (compat && plain === compat) return true;
  return false;
}

function signClientToken(payload: { clientId: string; tenantSlug: string; email: string }): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 14; // 14 días
  const data = Buffer.from(JSON.stringify({ ...payload, exp }), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getClientSessionSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

function verifyClientToken(
  token: string | undefined | null
): { clientId: string; tenantSlug: string; email: string } | null {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  const expected = crypto
    .createHmac("sha256", getClientSessionSecret())
    .update(data)
    .digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (!parsed?.clientId || Number(parsed.exp || 0) < Date.now()) return null;
    return {
      clientId: String(parsed.clientId),
      tenantSlug: String(parsed.tenantSlug || ""),
      email: String(parsed.email || ""),
    };
  } catch {
    return null;
  }
}

function extractClientSession(
  req: NextRequest,
  tenantSlug: string
): { clientId: string; tenantSlug: string; email: string } | null {
  const raw =
    req.cookies.get(CLIENT_SESSION_COOKIE)?.value ||
    req.headers.get("x-inmo-client-token") ||
    "";
  const parsed = verifyClientToken(raw);
  if (!parsed) return null;
  if (parsed.tenantSlug && parsed.tenantSlug !== tenantSlug) return null;
  return parsed;
}

function sanitizeClientForPublic(c: InmoClienteRecord): Omit<
  InmoClienteRecord,
  "passwordHash" | "passwordPlainCompat" | "resetCode" | "resetCodeExpiresAt"
> {
  const {
    passwordHash: _ph,
    passwordPlainCompat: _pc,
    resetCode: _rc,
    resetCodeExpiresAt: _re,
    ...rest
  } = c;
  return {
    ...rest,
    mpAccount: rest.mpAccount
      ? {
          connected: Boolean(rest.mpAccount.connected),
          mpUserId: rest.mpAccount.mpUserId || "",
          connectedAt: rest.mpAccount.connectedAt,
        }
      : undefined,
  };
}

function normalizeDoc(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length >= 6 ? digits : String(raw || "").trim().toUpperCase();
}

export async function loadInmobiliariaDb(tenant: ErpTenantRecord): Promise<InmoDbDoc> {
  const initial = buildInitialInmobiliariaDb(tenant);
  const { payload } = await getTenantDoc<Partial<InmoDbDoc>>(
    tenant,
    INMO_DOC_KEY,
    initial
  );

  const db: InmoDbDoc = {
    updatedAt: payload?.updatedAt || initial.updatedAt,
    lastPropSeq: Number(payload?.lastPropSeq ?? initial.lastPropSeq),
    lastContratoSeq: Number(payload?.lastContratoSeq ?? 0),
    portalConfig: {
      ...initial.portalConfig,
      ...(payload?.portalConfig || {}),
      etiquetasPersonalizadas: Array.isArray(payload?.portalConfig?.etiquetasPersonalizadas)
        ? payload!.portalConfig!.etiquetasPersonalizadas!
        : initial.portalConfig.etiquetasPersonalizadas,
    },
    banners: Array.isArray(payload?.banners) ? payload.banners : initial.banners,
    propiedades: Array.isArray(payload?.propiedades)
      ? payload.propiedades
      : initial.propiedades,
    clientes: Array.isArray(payload?.clientes) ? payload.clientes : [],
    plantillasContrato:
      Array.isArray(payload?.plantillasContrato) && payload.plantillasContrato.length > 0
        ? payload.plantillasContrato
        : initial.plantillasContrato,
    contratos: Array.isArray(payload?.contratos) ? payload.contratos : [],
    transaccionesSplit: Array.isArray(payload?.transaccionesSplit)
      ? payload.transaccionesSplit
      : [],
    consultas: Array.isArray(payload?.consultas) ? payload.consultas : [],
  };

  // Recalcular estado automático (vigente / pasado / futuro) de contratos
  for (const ctr of db.contratos) {
    ctr.estado = computeContractAutoStatus(ctr.fechaInicio, ctr.fechaFin, ctr.estado);
  }

  return db;
}

async function uploadMediaIfBase64(
  tenant: ErpTenantRecord,
  raw: string,
  prefix: string,
  category: "banners" | "products" = "products"
): Promise<string> {
  const str = String(raw || "").trim();
  if (!str) return "";
  const mImg = str.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);
  if (mImg) {
    const ext = mImg[1].includes("png") ? "png" : mImg[1].includes("webp") ? "webp" : "jpg";
    const key = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    await putTenantMediaInDb(tenant, {
      media_key: key,
      category,
      mime_type: mImg[1].toLowerCase(),
      data_b64: mImg[2],
    });
    return `/sistema/assets/${category}/${key}?tenant=${encodeURIComponent(tenant.slug)}`;
  }
  const mPdf = str.match(/^data:(application\/pdf);base64,(.+)$/i);
  if (mPdf) {
    if (mPdf[2].length > 5_400_000) {
      throw new Error("El archivo PDF supera el límite máximo permitido (4 MB).");
    }
    const key = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.pdf`;
    await putTenantMediaInDb(tenant, {
      media_key: key,
      category: "banners",
      mime_type: "application/pdf",
      data_b64: mPdf[2],
    });
    return `/sistema/assets/banners/${key}?tenant=${encodeURIComponent(tenant.slug)}`;
  }
  return str;
}

async function trySendEmail(params: {
  to: string;
  subject: string;
  html: string;
  fromName: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !params.to.includes("@")) return false;
  try {
    const fromAddress =
      process.env.SMTP_FROM?.trim() || `${params.fromName} <onboarding@resend.dev>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildDefaultCaracteristicas(raw?: AnyObj): InmoPropiedadCaracteristicas {
  const c = raw || {};
  return {
    superficieTotalM2:
      c.superficieTotalM2 !== "" && c.superficieTotalM2 != null
        ? Number(c.superficieTotalM2)
        : null,
    superficieCubiertaM2:
      c.superficieCubiertaM2 !== "" && c.superficieCubiertaM2 != null
        ? Number(c.superficieCubiertaM2)
        : null,
    superficieHectareas:
      c.superficieHectareas !== "" && c.superficieHectareas != null
        ? Number(c.superficieHectareas)
        : null,
    antiguedadAnios: String(c.antiguedadAnios || "").trim(),
    orientacion: String(c.orientacion || "Norte").trim(),
    disposicion: String(c.disposicion || "Frente").trim(),
    tieneGarage: Boolean(c.tieneGarage),
    cantidadVehiculosGarage: Math.max(0, Number(c.cantidadVehiculosGarage || 0)),
    garageCubierto: Boolean(c.garageCubierto),
    tienePileta: Boolean(c.tienePileta),
    tieneQuincho: Boolean(c.tieneQuincho),
    cantidadBanos: Math.max(0, Number(c.cantidadBanos || 0)),
    cantidadToilettes: Math.max(0, Number(c.cantidadToilettes || 0)),
    cantidadHabitaciones: Math.max(0, Number(c.cantidadHabitaciones || 0)),
    tieneCocina: Boolean(c.tieneCocina),
    tieneCocinaComedor: Boolean(c.tieneCocinaComedor),
    tieneLavadero: Boolean(c.tieneLavadero),
    tieneDependencias: Boolean(c.tieneDependencias),
    tieneLiving: Boolean(c.tieneLiving),
    tieneLivingComedor: Boolean(c.tieneLivingComedor),
    tienePlacares: Boolean(c.tienePlacares),
    tipoCalefaccion: String(c.tipoCalefaccion || "Sin calefacción").trim(),
    tipoRefrigeracion: String(c.tipoRefrigeracion || "Sin refrigeración").trim(),
    esDepartamento: Boolean(c.esDepartamento),
    esInterno: Boolean(c.esInterno),
    tieneBalcon: Boolean(c.tieneBalcon),
    pisoDepartamento: String(c.pisoDepartamento || "").trim(),
    tieneAscensor: Boolean(c.tieneAscensor),
    expensasMensualesArs:
      c.expensasMensualesArs !== "" && c.expensasMensualesArs != null
        ? Number(c.expensasMensualesArs)
        : null,
    aguaCorriente: Boolean(c.aguaCorriente),
    gasNatural: Boolean(c.gasNatural),
    cloacas: Boolean(c.cloacas),
    pavimento: Boolean(c.pavimento),
    internetFibra: Boolean(c.internetFibra),
    permiteMascotas: Boolean(c.permiteMascotas),
    aptoCredito: Boolean(c.aptoCredito),
    amoblado: Boolean(c.amoblado),
    seguridad24hs: Boolean(c.seguridad24hs),
    parrilla: Boolean(c.parrilla),
    jardinPatio: Boolean(c.jardinPatio),
    garantiasSolicitadas: String(c.garantiasSolicitadas || "").trim(),
    mesDeposito: String(c.mesDeposito || "").trim(),
    ajusteContrato: String(c.ajusteContrato || "").trim(),
    plazoMinimo: String(c.plazoMinimo || "").trim(),
  };
}

function generateMonthlyCuotas(params: {
  fechaInicio: string;
  duracionMeses: number;
  moneda: MonedaInmo;
  valorMensual: number;
  inmobiliariaPct: number;
  existingCuotas?: InmoCuotaContratoRecord[];
}): InmoCuotaContratoRecord[] {
  const count = Math.max(1, Math.min(60, Number(params.duracionMeses || 12)));
  const start = params.fechaInicio
    ? new Date(`${params.fechaInicio}T12:00:00Z`)
    : new Date();
  const split = calculateInmoSplit(params.valorMensual, params.inmobiliariaPct);
  const mesesEs = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const existingMap = new Map<number, InmoCuotaContratoRecord>();
  for (const ex of params.existingCuotas || []) {
    existingMap.set(ex.numeroCuota, ex);
  }

  const out: InmoCuotaContratoRecord[] = [];
  const todayIso = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < count; i++) {
    const num = i + 1;
    const prev = existingMap.get(num);
    if (prev && prev.estado === "pagado") {
      out.push(prev);
      continue;
    }
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 10));
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const periodo = `${yyyy}-${mm}`;
    const vencimiento = `${yyyy}-${mm}-10`;
    const isPastDue = vencimiento < todayIso;

    out.push({
      id: prev?.id || `cuota_${Date.now()}_${num}`,
      numeroCuota: num,
      periodo,
      concepto: `Canon Locativo ${mesesEs[d.getUTCMonth()]} ${yyyy}`,
      vencimiento,
      moneda: params.moneda,
      montoBase: split.montoTotal,
      expensas: Number(prev?.expensas || 0),
      impuestosServicios: Number(prev?.impuestosServicios || 0),
      punitorios: Number(prev?.punitorios || 0),
      descuentos: Number(prev?.descuentos || 0),
      montoTotal: split.montoTotal,
      propietarioPct: split.propietarioPct,
      inmobiliariaPct: split.inmobiliariaPct,
      montoPropietario: split.montoPropietario,
      montoInmobiliaria: split.montoInmobiliaria,
      estado: prev?.estado === "parcial" ? "parcial" : isPastDue ? "vencido" : "pendiente",
      fechaPago: prev?.fechaPago || null,
      medioPago: prev?.medioPago || "",
      comprobanteRef: prev?.comprobanteRef || "",
    });
  }
  return out;
}

function buildContractVars(params: {
  tenant: ErpTenantRecord;
  db: InmoDbDoc;
  contrato: Partial<InmoContratoRecord>;
  inquilino?: InmoClienteRecord | null;
  propietario?: InmoClienteRecord | null;
  propiedad?: InmoPropiedadRecord | null;
  customFields?: Record<string, string>;
}): Record<string, string> {
  const brand = enforceOptionBranding(
    params.tenant.option_type,
    params.tenant.is_base,
    params.tenant.branding
  );
  const nowStr = new Date().toLocaleDateString("es-AR");
  const moneda = params.contrato.moneda || "ARS";
  const valorFmt = `${moneda === "USD" ? "USD" : "$"} ${Number(
    params.contrato.valorMensualActual || 0
  ).toLocaleString("es-AR")}`;

  const inq = params.inquilino;
  const propCli = params.propietario;
  const inm = params.propiedad;

  return {
    FECHA_HOY: nowStr,
    INMOBILIARIA_NOMBRE: params.tenant.fantasy_name || "MiniSistema Inmobiliaria",
    INMOBILIARIA_RAZON_SOCIAL: params.tenant.business_name || params.tenant.fantasy_name || "",
    INMOBILIARIA_CUIT: brand.cuitFmt || "",
    INMOBILIARIA_MATRICULA: params.db.portalConfig.matriculaCorredor || "",
    INMOBILIARIA_DOMICILIO: params.db.portalConfig.direccionOficina || brand.address || "",
    CLIENTE_NOMBRE_COMPLETO: inq?.nombreCompleto || params.contrato.inquilinoNombre || "",
    CLIENTE_APELLIDOS: inq?.apellidos || "",
    CLIENTE_NOMBRES: inq?.nombres || "",
    CLIENTE_TIPO_DOC: inq?.tipoDoc || "DNI",
    CLIENTE_DNI: inq?.nroDoc || params.contrato.inquilinoDni || "",
    CLIENTE_CUIT: inq?.cuitCuil || "",
    CLIENTE_DOMICILIO: inq?.domicilio || "",
    CLIENTE_LOCALIDAD: inq?.localidad || "",
    CLIENTE_PROVINCIA: inq?.provincia || "",
    CLIENTE_EMAIL: inq?.email || params.contrato.inquilinoEmail || "",
    CLIENTE_WHATSAPP: inq?.whatsappCompleto || "",
    CLIENTE_ESTADO_CIVIL: inq?.estadoCivil || "",
    CLIENTE_NACIONALIDAD: inq?.nacionalidad || "ARGENTINA",
    PROPIETARIO_NOMBRE_COMPLETO:
      propCli?.nombreCompleto || params.contrato.propietarioNombre || "",
    PROPIETARIO_DNI: propCli?.nroDoc || params.contrato.propietarioDni || "",
    PROPIETARIO_DOMICILIO: propCli?.domicilio || "",
    PROPIETARIO_CBU: propCli?.cbuAlias || "",
    PROPIEDAD_CODIGO: inm?.codigo || params.contrato.propiedadCodigo || "",
    PROPIEDAD_TITULO: inm?.titulo || params.contrato.propiedadTitulo || "",
    PROPIEDAD_TIPO: inm?.tipoPropiedad || "",
    PROPIEDAD_DIRECCION: inm?.direccion || params.contrato.propiedadDireccion || "",
    PROPIEDAD_BARRIO: inm?.barrio || "",
    PROPIEDAD_LOCALIDAD: inm?.localidad || brand.localidad || "",
    PROPIEDAD_PROVINCIA: inm?.provincia || brand.provincia || "",
    CONTRATO_CODIGO: params.contrato.codigo || "BORRADOR",
    CONTRATO_FECHA_INICIO: params.contrato.fechaInicio || "",
    CONTRATO_FECHA_FIN: params.contrato.fechaFin || "",
    CONTRATO_DURACION_MESES: String(params.contrato.duracionMeses || 24),
    CONTRATO_VALOR_MENSUAL: valorFmt,
    CONTRATO_INDICE_AJUSTE: params.contrato.indiceAjuste || "Trimestral por ICL",
    CONTRATO_DEPOSITO: params.contrato.mesDeposito || "1 mes de depósito",
    CONTRATO_GARANTIAS: params.contrato.garantiasDetalle || "A convenir",
    SPLIT_PROPIETARIO_PCT: String(params.contrato.propietarioPct ?? 90),
    SPLIT_INMOBILIARIA_PCT: String(params.contrato.inmobiliariaPct ?? 10),
    ...(params.customFields || {}),
  };
}

// ============================================================================
// MOTOR DE BÚSQUEDA INTELIGENTE POR IA (Gemini + Parser Semántico Local)
// ============================================================================
async function runAiPropertySearch(
  query: string,
  propiedades: InmoPropiedadRecord[],
  fantasyName: string
): Promise<{
  summary: string;
  matchedIds: string[];
  extractedFilters: Record<string, any>;
  source: "gemini-ai" | "smart-nlp-local";
}> {
  const qNorm = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // 1. Extracción heurística instantánea (fallback ultra-confiable sin latencia)
  const extracted: Record<string, any> = {};
  if (/\b(temporar|noche|quincena|vacacion|cabana|quinta)\b/.test(qNorm)) {
    extracted.operacion = "alquiler_temporario";
  } else if (/\b(alquil|locacion|arrend)\b/.test(qNorm)) {
    extracted.operacion = "alquiler";
  } else if (/\b(vent|compr|invert|terreno|lote|campo)\b/.test(qNorm)) {
    extracted.operacion = "venta";
  }
  if (/\b(rural|campo|hectarea|chacra|estancia)\b/.test(qNorm)) extracted.ambito = "rural";
  if (/\b(urban|ciudad|centro|barrio)\b/.test(qNorm)) extracted.ambito = "urbana";
  if (/\b(pileta|piscina)\b/.test(qNorm)) extracted.tienePileta = true;
  if (/\b(quincho|asador|parrilla)\b/.test(qNorm)) extracted.tieneQuincho = true;
  if (/\b(garage|cochera|auto|vehiculo)\b/.test(qNorm)) extracted.tieneGarage = true;
  if (/\b(balcon)\b/.test(qNorm)) extracted.tieneBalcon = true;
  if (/\b(depto|departamento|piso)\b/.test(qNorm)) extracted.esDepartamento = true;
  if (/\b(mascota|perro|gato|pet)\b/.test(qNorm)) extracted.permiteMascotas = true;
  if (/\b(credito|hipotec)\b/.test(qNorm)) extracted.aptoCredito = true;
  if (/\b(amoblad)\b/.test(qNorm)) extracted.amoblado = true;
  if (/\b(placard|placares)\b/.test(qNorm)) extracted.tienePlacares = true;
  if (/\b(lavadero)\b/.test(qNorm)) extracted.tieneLavadero = true;
  if (/\b(sin construccion|baldio|terreno|lote)\b/.test(qNorm)) {
    extracted.estadoConstruccion = "sin_construccion";
  }

  const dormMatch = qNorm.match(/(\d+)\s*(dorm|hab|cuart|pieza)/);
  if (dormMatch) extracted.minHabitaciones = Number(dormMatch[1]);
  const banoMatch = qNorm.match(/(\d+)\s*(bano)/);
  if (banoMatch) extracted.minBanos = Number(banoMatch[1]);
  const vehMatch = qNorm.match(/(\d+)\s*(auto|vehiculo|cochera)/);
  if (vehMatch) extracted.minVehiculos = Number(vehMatch[1]);

  // Puntaje local
  const scored = propiedades.map((p) => {
    let score = 0;
    const c = p.caracteristicas;
    const hay = [
      p.codigo,
      p.titulo,
      p.descripcion,
      p.tipoPropiedad,
      p.operacion,
      p.ambito,
      p.regimen,
      p.localidad,
      p.provincia,
      p.barrio,
      p.direccion,
      p.cartelCruzado,
      c.tipoCalefaccion,
      c.tipoRefrigeracion,
      c.garantiasSolicitadas,
    ]
      .join(" ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (extracted.operacion && p.operacion === extracted.operacion) score += 25;
    if (extracted.ambito && p.ambito === extracted.ambito) score += 18;
    if (extracted.tienePileta && c.tienePileta) score += 20;
    if (extracted.tieneQuincho && (c.tieneQuincho || c.parrilla)) score += 16;
    if (extracted.tieneGarage && c.tieneGarage) score += 16;
    if (extracted.tieneBalcon && c.tieneBalcon) score += 14;
    if (extracted.esDepartamento && (c.esDepartamento || p.tipoPropiedad === "Departamento")) score += 18;
    if (extracted.permiteMascotas && c.permiteMascotas) score += 14;
    if (extracted.aptoCredito && c.aptoCredito) score += 14;
    if (extracted.amoblado && c.amoblado) score += 12;
    if (extracted.tienePlacares && c.tienePlacares) score += 10;
    if (extracted.tieneLavadero && c.tieneLavadero) score += 10;
    if (extracted.estadoConstruccion && p.estadoConstruccion === extracted.estadoConstruccion) score += 18;
    if (extracted.minHabitaciones && c.cantidadHabitaciones >= extracted.minHabitaciones) score += 20;
    if (extracted.minBanos && c.cantidadBanos >= extracted.minBanos) score += 14;
    if (extracted.minVehiculos && c.cantidadVehiculosGarage >= extracted.minVehiculos) score += 14;

    const tokens = qNorm.split(/\s+/).filter((t) => t.length >= 3);
    for (const tk of tokens) {
      if (hay.includes(tk)) score += 6;
    }
    return { p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const localMatched = scored
    .filter((x) => x.score > 0)
    .slice(0, 12)
    .map((x) => x.p.id);

  // 2. Si existe GEMINI_API_KEY, enriquecer recomendación y selección semántica con Gemini
  const geminiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (geminiKey && propiedades.length > 0) {
    try {
      const compactCatalog = propiedades.slice(0, 60).map((p) => ({
        id: p.id,
        codigo: p.codigo,
        titulo: p.titulo,
        operacion: p.operacion,
        tipo: p.tipoPropiedad,
        ambito: p.ambito,
        regimen: p.regimen,
        construccion: p.estadoConstruccion,
        precio: p.mostrarPrecio ? `${p.moneda} ${p.precio}` : p.textoConsulta,
        ubicacion: `${p.barrio}, ${p.localidad}, ${p.provincia}`,
        hab: p.caracteristicas.cantidadHabitaciones,
        banos: p.caracteristicas.cantidadBanos,
        garage: p.caracteristicas.tieneGarage
          ? `${p.caracteristicas.cantidadVehiculosGarage} veh.`
          : "no",
        pileta: p.caracteristicas.tienePileta,
        quincho: p.caracteristicas.tieneQuincho,
        balcon: p.caracteristicas.tieneBalcon,
        deptoInterno: p.caracteristicas.esDepartamento
          ? p.caracteristicas.esInterno
            ? "interno"
            : "externo"
          : "n/a",
        calefaccion: p.caracteristicas.tipoCalefaccion,
        refrigeracion: p.caracteristicas.tipoRefrigeracion,
        mascotas: p.caracteristicas.permiteMascotas,
        aptoCredito: p.caracteristicas.aptoCredito,
        cartel: p.cartelCruzado,
      }));

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        geminiKey
      )}`;
      const aiRes = await fetch(apiUrl, {
        method: "POST",
        signal: AbortSignal.timeout(7000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `Sos el Asesor Inmobiliario IA de ${fantasyName}. Analizá la búsqueda en lenguaje natural del visitante y devolvé SOLO un JSON válido con el formato {"summary": "explicación breve y cálida en español argentino de las opciones encontradas", "matchedIds": ["id1", "id2"]}. Ordená matchedIds de mayor a menor relevancia.`,
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `BÚSQUEDA DEL USUARIO: "${query}"\n\nCATÁLOGO ACTIVO:\n${JSON.stringify(
                    compactCatalog
                  )}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            maxOutputTokens: 512,
          },
        }),
      });
      if (aiRes.ok) {
        const json = (await aiRes.json().catch(() => null)) as AnyObj | null;
        const txt = String(json?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        if (txt) {
          const parsed = JSON.parse(txt);
          const validIds = new Set(propiedades.map((x) => x.id));
          const aiIds = Array.isArray(parsed.matchedIds)
            ? parsed.matchedIds.filter((id: string) => validIds.has(id))
            : [];
          return {
            summary:
              String(parsed.summary || "").trim() ||
              `Encontramos ${aiIds.length} propiedad(es) acordes a tu búsqueda.`,
            matchedIds: aiIds.length > 0 ? aiIds : localMatched,
            extractedFilters: extracted,
            source: "gemini-ai",
          };
        }
      }
    } catch {
      // Fallback silencioso a motor local
    }
  }

  return {
    summary:
      localMatched.length > 0
        ? `Motor Inteligente: encontramos ${localMatched.length} propiedad(es) que coinciden con "${query}".`
        : `No encontramos coincidencias exactas para "${query}", pero podés ajustar los filtros o consultarnos por WhatsApp para que busquemos a medida.`,
    matchedIds: localMatched,
    extractedFilters: extracted,
    source: "smart-nlp-local",
  };
}

// ============================================================================
// API PÚBLICA: /api/inmobiliaria (GET y POST)
// ============================================================================
export async function handlePublicInmobiliariaGet(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const db = await loadInmobiliariaDb(tenant);
  const action = String(req.nextUrl.searchParams.get("action") || "bootstrap").trim();
  const brand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );

  // Propiedades activas y NO caducadas para el público
  const activeProps = db.propiedades.filter((p) => p.activa !== false && !isPropertyExpired(p));
  const activeBanners = db.banners
    .filter((b) => b.activo !== false)
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));

  if (action === "client_me") {
    const sess = extractClientSession(req, tenant.slug);
    if (!sess) {
      return NextResponse.json({ ok: true, authenticated: false, client: null, contratos: [] });
    }
    const client = db.clientes.find((c) => c.id === sess.clientId && c.activo !== false);
    if (!client) {
      return NextResponse.json({ ok: true, authenticated: false, client: null, contratos: [] });
    }
    const misContratos = db.contratos.filter(
      (ctr) =>
        ctr.inquilinoId === client.id ||
        ctr.propietarioId === client.id ||
        (ctr.inquilinoEmail &&
          client.email &&
          ctr.inquilinoEmail.toLowerCase() === client.email.toLowerCase()) ||
        (ctr.inquilinoDni &&
          client.nroDoc &&
          normalizeDoc(ctr.inquilinoDni) === normalizeDoc(client.nroDoc))
    );
    return NextResponse.json({
      ok: true,
      authenticated: true,
      client: sanitizeClientForPublic(client),
      contratos: misContratos,
    });
  }

  const sess = extractClientSession(req, tenant.slug);
  const loggedClient = sess
    ? db.clientes.find((c) => c.id === sess.clientId && c.activo !== false) || null
    : null;
  const loggedContracts = loggedClient
    ? db.contratos.filter(
        (ctr) =>
          ctr.inquilinoId === loggedClient.id ||
          ctr.propietarioId === loggedClient.id ||
          (ctr.inquilinoEmail &&
            loggedClient.email &&
            ctr.inquilinoEmail.toLowerCase() === loggedClient.email.toLowerCase())
      )
    : [];

  return NextResponse.json({
    ok: true,
    tenant: {
      slug: tenant.slug,
      isBase: tenant.is_base,
      optionType: tenant.option_type,
      fantasyName: tenant.fantasy_name,
      businessName: tenant.business_name,
      primaryHex: brand.primaryHex,
      accentHex: brand.accentHex,
      logoHorizontalUrl: brand.logoHorizontalUrl,
      logo1x1Url: brand.logo1x1Url,
      defaultProvincia: brand.provincia || "CÓRDOBA",
      defaultLocalidad: brand.localidad || "RÍO CUARTO",
      defaultCp: brand.cp || "5800",
    },
    portalConfig: db.portalConfig,
    banners: activeBanners,
    destacadas: activeProps.filter((p) => p.destacada),
    propiedades: activeProps,
    catalogs: {
      paises: (referenceCatalogs.catalogs as AnyObj).paises || [],
      provincias: (referenceCatalogs.catalogs as AnyObj).provincias || [],
      localidadesPorProvincia:
        (referenceCatalogs.catalogs as AnyObj).localidadesPorProvincia || {},
    },
    clientSession: loggedClient
      ? {
          authenticated: true,
          client: sanitizeClientForPublic(loggedClient),
          contratos: loggedContracts,
        }
      : { authenticated: false, client: null, contratos: [] },
  });
}

export async function handlePublicInmobiliariaPost(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const body = ((await req.json().catch(() => null)) || null) as AnyObj | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, message: "Solicitud inválida." }, { status: 400 });
  }
  const action = String(body.action || "").trim();
  const db = await loadInmobiliariaDb(tenant);
  const nowIso = new Date().toISOString();

  // 1. Búsqueda IA en lenguaje natural
  if (action === "ai_search") {
    const query = String(body.query || "").trim();
    if (!query) {
      return NextResponse.json({ ok: false, message: "Escribí qué propiedad estás buscando." }, { status: 400 });
    }
    const activeProps = db.propiedades.filter((p) => p.activa !== false && !isPropertyExpired(p));
    const result = await runAiPropertySearch(
      query,
      activeProps,
      tenant.fantasy_name || "MiniSistema Inmobiliaria"
    );
    return NextResponse.json({ ok: true, ...result });
  }

  // 2. Registrar consulta / visita / alerta de búsqueda / tasación
  if (action === "submit_inquiry") {
    const nombre = String(body.nombre || "").trim();
    const whatsapp = String(body.whatsapp || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const mensaje = String(body.mensaje || "").trim();
    if (!nombre || (!whatsapp && !email)) {
      return NextResponse.json(
        { ok: false, message: "Completá tu nombre y WhatsApp o correo electrónico." },
        { status: 400 }
      );
    }
    const propId = String(body.propiedadId || "").trim() || null;
    const prop = propId ? db.propiedades.find((x) => x.id === propId) : null;
    if (prop) {
      prop.consultasWhatsapp = Number(prop.consultasWhatsapp || 0) + 1;
    }
    const lead: InmoConsultaLeadRecord = {
      id: `lead_${Date.now()}`,
      propiedadId: prop?.id || null,
      propiedadCodigo: prop?.codigo || "",
      propiedadTitulo: prop?.titulo || String(body.propiedadTitulo || ""),
      nombre,
      whatsapp,
      email,
      mensaje,
      tipo: (body.tipo as any) || "consulta_propiedad",
      fechaVisitaDeseada: String(body.fechaVisitaDeseada || "").trim(),
      estado: "nueva",
      createdAt: nowIso,
    };
    db.consultas.unshift(lead);
    db.updatedAt = nowIso;
    await putTenantDoc(tenant, INMO_DOC_KEY, db, "visitante_web", "inmo_submit_inquiry");
    return NextResponse.json({
      ok: true,
      lead,
      message: "¡Tu consulta fue registrada! Un asesor se pondrá en contacto a la brevedad.",
    });
  }

  // 3. Incrementar vista de propiedad
  if (action === "track_view") {
    const propId = String(body.propiedadId || "").trim();
    const prop = db.propiedades.find((x) => x.id === propId);
    if (prop) {
      prop.visitas = Number(prop.visitas || 0) + 1;
      await putTenantDoc(tenant, INMO_DOC_KEY, db, "visitante_web", "inmo_track_view");
    }
    return NextResponse.json({ ok: true });
  }

  // 4. Registro de Cliente desde Acceso a Clientes (con todos los datos + localidades/provincias/país WA)
  if (action === "client_register") {
    const apellidos = String(body.apellidos || "").trim();
    const nombres = String(body.nombres || "").trim();
    const nroDoc = String(body.nroDoc || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const whatsappNumero = String(body.whatsappNumero || "").replace(/[^\d]/g, "");

    if (!apellidos || !nombres || !nroDoc || !email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, message: "Completá Apellidos, Nombres, DNI y Correo Electrónico válido." },
        { status: 400 }
      );
    }
    if (password.length < 4) {
      return NextResponse.json(
        { ok: false, message: "La contraseña debe tener al menos 4 caracteres." },
        { status: 400 }
      );
    }

    const docNorm = normalizeDoc(nroDoc);
    let existing = db.clientes.find(
      (c) =>
        (c.email && c.email.toLowerCase() === email) ||
        (c.nroDoc && normalizeDoc(c.nroDoc) === docNorm)
    );

    const whatsappPrefijo = String(body.whatsappPrefijo || "+549").trim();
    const whatsappPais = String(body.whatsappPais || "Argentina").trim();
    const domicilioCalle = String(body.domicilioCalle || "").trim();
    const domicilioNumero = String(body.domicilioNumero || "").trim();
    const domicilioPiso = String(body.domicilioPiso || "").trim();
    const domicilioDpto = String(body.domicilioDpto || "").trim();
    const domicilioBarrio = String(body.domicilioBarrio || "").trim();
    const domicilioComposed = [
      `${domicilioCalle} ${domicilioNumero}`.trim(),
      domicilioPiso ? `Piso ${domicilioPiso}` : "",
      domicilioDpto ? `Dpto. ${domicilioDpto}` : "",
      domicilioBarrio ? `B° ${domicilioBarrio}` : "",
    ]
      .filter(Boolean)
      .join(", ");

    if (existing) {
      // Si ya fue creado por el administrador sin contraseña, o actualiza sus datos
      if (existing.passwordHash && existing.origen === "web") {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Ya existe una cuenta registrada con ese correo o DNI. Iniciá sesión o usá 'Recuperar contraseña'.",
          },
          { status: 409 }
        );
      }
      existing.apellidos = apellidos;
      existing.nombres = nombres;
      existing.nombreCompleto = `${apellidos.toUpperCase()}, ${nombres}`;
      existing.tipoDoc = String(body.tipoDoc || existing.tipoDoc || "DNI").trim();
      existing.nroDoc = nroDoc;
      existing.cuitCuil = String(body.cuitCuil || existing.cuitCuil || "").trim();
      existing.fechaNacimiento = String(body.fechaNacimiento || existing.fechaNacimiento || "").trim();
      existing.estadoCivil = String(body.estadoCivil || existing.estadoCivil || "").trim();
      existing.nacionalidad = String(body.nacionalidad || existing.nacionalidad || "ARGENTINA").trim();
      existing.pais = String(body.pais || existing.pais || "ARGENTINA").trim();
      existing.provincia = String(body.provincia || existing.provincia || "").trim();
      existing.localidad = String(body.localidad || existing.localidad || "").trim();
      existing.cp = String(body.cp || existing.cp || "").trim();
      existing.domicilioCalle = domicilioCalle || existing.domicilioCalle;
      existing.domicilioNumero = domicilioNumero || existing.domicilioNumero;
      existing.domicilioPiso = domicilioPiso || existing.domicilioPiso;
      existing.domicilioDpto = domicilioDpto || existing.domicilioDpto;
      existing.domicilioBarrio = domicilioBarrio || existing.domicilioBarrio;
      existing.domicilio = domicilioComposed || existing.domicilio;
      existing.whatsappPais = whatsappPais;
      existing.whatsappPrefijo = whatsappPrefijo;
      existing.whatsappNumero = whatsappNumero || existing.whatsappNumero;
      existing.whatsappCompleto = `${whatsappPrefijo.replace(/[^\d+]/g, "")}${existing.whatsappNumero}`;
      existing.telefonoAlternativo = String(body.telefonoAlternativo || existing.telefonoAlternativo || "").trim();
      existing.email = email;
      existing.passwordHash = hashClientPassword(password);
      existing.passwordPlainCompat = "";
      existing.updatedAt = nowIso;
    } else {
      existing = {
        id: `inmocli_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        rol: (body.rol as any) || "inquilino",
        apellidos,
        nombres,
        nombreCompleto: `${apellidos.toUpperCase()}, ${nombres}`,
        tipoDoc: String(body.tipoDoc || "DNI").trim(),
        nroDoc,
        cuitCuil: String(body.cuitCuil || "").trim(),
        fechaNacimiento: String(body.fechaNacimiento || "").trim(),
        estadoCivil: String(body.estadoCivil || "").trim(),
        nacionalidad: String(body.nacionalidad || "ARGENTINA").trim(),
        pais: String(body.pais || "ARGENTINA").trim(),
        provincia: String(body.provincia || "").trim(),
        localidad: String(body.localidad || "").trim(),
        cp: String(body.cp || "").trim(),
        domicilioCalle,
        domicilioNumero,
        domicilioPiso,
        domicilioDpto,
        domicilioBarrio,
        domicilio: domicilioComposed,
        whatsappPais,
        whatsappPrefijo,
        whatsappNumero,
        whatsappCompleto: `${whatsappPrefijo.replace(/[^\d+]/g, "")}${whatsappNumero}`,
        telefonoAlternativo: String(body.telefonoAlternativo || "").trim(),
        email,
        passwordHash: hashClientPassword(password),
        activo: true,
        origen: "web",
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.clientes.unshift(existing);
    }

    db.updatedAt = nowIso;
    await putTenantDoc(tenant, INMO_DOC_KEY, db, email, "inmo_client_register");

    const token = signClientToken({
      clientId: existing.id,
      tenantSlug: tenant.slug,
      email: existing.email,
    });
    const misContratos = db.contratos.filter(
      (ctr) =>
        ctr.inquilinoId === existing!.id ||
        ctr.propietarioId === existing!.id ||
        (ctr.inquilinoDni && normalizeDoc(ctr.inquilinoDni) === docNorm)
    );
    const res = NextResponse.json({
      ok: true,
      token,
      client: sanitizeClientForPublic(existing),
      contratos: misContratos,
      message: "¡Registro completado! Bienvenido/a al Portal de Clientes.",
    });
    res.cookies.set(CLIENT_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  }

  // 5. Login por correo electrónico y contraseña
  if (action === "client_login") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const client = db.clientes.find(
      (c) =>
        c.activo !== false &&
        (c.email.toLowerCase() === email ||
          (email && normalizeDoc(c.nroDoc) === normalizeDoc(email)))
    );
    if (!client || !verifyClientPassword(password, client.passwordHash, client.passwordPlainCompat)) {
      return NextResponse.json(
        { ok: false, message: "Correo electrónico o contraseña incorrectos." },
        { status: 401 }
      );
    }
    const token = signClientToken({
      clientId: client.id,
      tenantSlug: tenant.slug,
      email: client.email,
    });
    const misContratos = db.contratos.filter(
      (ctr) =>
        ctr.inquilinoId === client.id ||
        ctr.propietarioId === client.id ||
        (ctr.inquilinoEmail && ctr.inquilinoEmail.toLowerCase() === client.email.toLowerCase())
    );
    const res = NextResponse.json({
      ok: true,
      token,
      client: sanitizeClientForPublic(client),
      contratos: misContratos,
    });
    res.cookies.set(CLIENT_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  }

  // 6. Login automático con Google (ID Token verificado contra Google tokeninfo o acceso directo con correo Google verificado)
  if (action === "client_google_login") {
    const idToken = String(body.credential || "").trim();
    let googleEmail = "";
    let googleName = "";

    if (idToken) {
      try {
        const gRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (!gRes.ok) {
          return NextResponse.json(
            { ok: false, message: "No se pudo verificar tu sesión de Google. Intentá nuevamente." },
            { status: 401 }
          );
        }
        const gData = (await gRes.json()) as AnyObj;
        googleEmail = String(gData.email || "").trim().toLowerCase();
        googleName = String(gData.name || "").trim();
      } catch {
        return NextResponse.json(
          { ok: false, message: "Error al contactar con Google Identity." },
          { status: 502 }
        );
      }
    } else if (body.googleEmail && String(body.googleEmail).includes("@")) {
      // Modo asistido si aún no se cargó GOOGLE_CLIENT_ID: permite vinculación de cuenta Google por correo existente o registro rápido
      googleEmail = String(body.googleEmail).trim().toLowerCase();
      googleName = String(body.googleName || "").trim();
    }

    if (!googleEmail) {
      return NextResponse.json(
        { ok: false, message: "No se recibió un correo de Google válido." },
        { status: 400 }
      );
    }

    let client = db.clientes.find(
      (c) =>
        c.activo !== false &&
        (c.email.toLowerCase() === googleEmail ||
          (c.googleEmail && c.googleEmail.toLowerCase() === googleEmail))
    );

    if (!client) {
      const parts = googleName.split(/\s+/).filter(Boolean);
      const nombres = parts.slice(0, Math.max(1, parts.length - 1)).join(" ") || "Cliente";
      const apellidos = parts.length > 1 ? parts[parts.length - 1] : "Google";
      client = {
        id: `inmocli_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        rol: "inquilino",
        apellidos,
        nombres,
        nombreCompleto: `${apellidos.toUpperCase()}, ${nombres}`,
        tipoDoc: "DNI",
        nroDoc: "",
        cuitCuil: "",
        fechaNacimiento: "",
        estadoCivil: "",
        nacionalidad: "ARGENTINA",
        pais: "ARGENTINA",
        provincia: tenant.branding?.provincia || "CÓRDOBA",
        localidad: tenant.branding?.localidad || "RÍO CUARTO",
        cp: tenant.branding?.cp || "5800",
        domicilioCalle: "",
        domicilioNumero: "",
        domicilioPiso: "",
        domicilioDpto: "",
        domicilioBarrio: "",
        domicilio: "",
        whatsappPais: "Argentina",
        whatsappPrefijo: "+549",
        whatsappNumero: "",
        whatsappCompleto: "",
        telefonoAlternativo: "",
        email: googleEmail,
        googleLinked: true,
        googleEmail,
        activo: true,
        origen: "web",
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.clientes.unshift(client);
    } else {
      client.googleLinked = true;
      client.googleEmail = googleEmail;
      client.updatedAt = nowIso;
    }

    db.updatedAt = nowIso;
    await putTenantDoc(tenant, INMO_DOC_KEY, db, googleEmail, "inmo_client_google_login");

    const token = signClientToken({
      clientId: client.id,
      tenantSlug: tenant.slug,
      email: client.email,
    });
    const misContratos = db.contratos.filter(
      (ctr) =>
        ctr.inquilinoId === client!.id ||
        ctr.propietarioId === client!.id ||
        (ctr.inquilinoEmail && ctr.inquilinoEmail.toLowerCase() === client!.email.toLowerCase())
    );
    const res = NextResponse.json({
      ok: true,
      token,
      client: sanitizeClientForPublic(client),
      contratos: misContratos,
      message: `Sesión iniciada con Google (${googleEmail}).`,
    });
    res.cookies.set(CLIENT_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  }

  // 7. Recupero de contraseña (Paso 1: solicitar código; Paso 2: restablecer con código)
  if (action === "client_request_reset") {
    const email = String(body.email || "").trim().toLowerCase();
    const client = db.clientes.find((c) => c.activo !== false && c.email.toLowerCase() === email);
    if (!client) {
      return NextResponse.json(
        { ok: false, message: "No encontramos una cuenta registrada con ese correo electrónico." },
        { status: 404 }
      );
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    client.resetCode = code;
    client.resetCodeExpiresAt = new Date(Date.now() + 1000 * 60 * 20).toISOString(); // 20 min
    client.updatedAt = nowIso;
    await putTenantDoc(tenant, INMO_DOC_KEY, db, email, "inmo_client_request_reset");

    const sent = await trySendEmail({
      to: client.email,
      fromName: tenant.fantasy_name || "MiniSistema Inmobiliaria",
      subject: `Código de recuperación de contraseña — ${tenant.fantasy_name || "Inmobiliaria"}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#112D3A;color:#fff;border-radius:16px;border:2px solid #56D7A1;">
        <h2 style="margin:0 0 8px;color:#56D7A1;">Recuperación de Contraseña</h2>
        <p>Hola ${client.nombres}, solicitaste restablecer tu clave del Portal de Clientes de <strong>${tenant.fantasy_name}</strong>.</p>
        <div style="font-size:28px;font-weight:900;letter-spacing:6px;background:#fff;color:#112D3A;padding:14px;border-radius:12px;text-align:center;margin:16px 0;">${code}</div>
        <p style="font-size:12px;opacity:0.8;">Este código vence en 20 minutos.</p>
      </div>`,
    });

    return NextResponse.json({
      ok: true,
      emailSent: sent,
      // Si el servidor no tiene RESEND_API_KEY configurado, devolvemos pista controlada para demo/pruebas
      devCodeHint: sent ? undefined : code,
      message: sent
        ? `Enviamos un código de 6 dígitos a ${client.email}. Ingresalo para crear tu nueva contraseña.`
        : `Código de recuperación generado (${code}). Ingresalo junto con tu nueva contraseña (configurá RESEND_API_KEY para envío automático por email).`,
    });
  }

  if (action === "client_confirm_reset") {
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    const newPassword = String(body.newPassword || "").trim();
    if (newPassword.length < 4) {
      return NextResponse.json(
        { ok: false, message: "La nueva contraseña debe tener al menos 4 caracteres." },
        { status: 400 }
      );
    }
    const client = db.clientes.find((c) => c.activo !== false && c.email.toLowerCase() === email);
    if (
      !client ||
      !client.resetCode ||
      client.resetCode !== code ||
      !client.resetCodeExpiresAt ||
      new Date(client.resetCodeExpiresAt).getTime() < Date.now()
    ) {
      return NextResponse.json(
        { ok: false, message: "El código ingresado es inválido o ya expiró." },
        { status: 400 }
      );
    }
    client.passwordHash = hashClientPassword(newPassword);
    client.passwordPlainCompat = "";
    client.resetCode = null;
    client.resetCodeExpiresAt = null;
    client.updatedAt = nowIso;
    await putTenantDoc(tenant, INMO_DOC_KEY, db, email, "inmo_client_confirm_reset");
    return NextResponse.json({
      ok: true,
      message: "¡Contraseña actualizada con éxito! Ya podés iniciar sesión.",
    });
  }

  // 8. Logout cliente
  if (action === "client_logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(CLIENT_SESSION_COOKIE);
    return res;
  }

  // 9. Actualizar perfil propio del cliente logueado
  if (action === "client_update_profile") {
    const sess = extractClientSession(req, tenant.slug);
    if (!sess) {
      return NextResponse.json({ ok: false, message: "Iniciá sesión para actualizar tus datos." }, { status: 401 });
    }
    const client = db.clientes.find((c) => c.id === sess.clientId);
    if (!client) {
      return NextResponse.json({ ok: false, message: "Cliente no encontrado." }, { status: 404 });
    }
    const fields = [
      "apellidos",
      "nombres",
      "tipoDoc",
      "nroDoc",
      "cuitCuil",
      "fechaNacimiento",
      "estadoCivil",
      "nacionalidad",
      "pais",
      "provincia",
      "localidad",
      "cp",
      "domicilioCalle",
      "domicilioNumero",
      "domicilioPiso",
      "domicilioDpto",
      "domicilioBarrio",
      "whatsappPais",
      "whatsappPrefijo",
      "whatsappNumero",
      "telefonoAlternativo",
    ] as const;
    for (const f of fields) {
      if (body[f] !== undefined) {
        (client as AnyObj)[f] = String(body[f] || "").trim();
      }
    }
    client.nombreCompleto = `${client.apellidos.toUpperCase()}, ${client.nombres}`;
    client.domicilio = [
      `${client.domicilioCalle} ${client.domicilioNumero}`.trim(),
      client.domicilioPiso ? `Piso ${client.domicilioPiso}` : "",
      client.domicilioDpto ? `Dpto. ${client.domicilioDpto}` : "",
      client.domicilioBarrio ? `B° ${client.domicilioBarrio}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    client.whatsappCompleto = `${client.whatsappPrefijo.replace(/[^\d+]/g, "")}${client.whatsappNumero.replace(/\D/g, "")}`;
    client.updatedAt = nowIso;
    await putTenantDoc(tenant, INMO_DOC_KEY, db, client.email, "inmo_client_update_profile");
    return NextResponse.json({ ok: true, client: sanitizeClientForPublic(client), message: "Datos actualizados." });
  }

  // 10. Pago online de cuota con Split modalidad ReikiOnline (% Propietario / % Inmobiliaria)
  if (action === "client_pay_cuota_split") {
    const sess = extractClientSession(req, tenant.slug);
    if (!sess) {
      return NextResponse.json({ ok: false, message: "Iniciá sesión para abonar tu alquiler." }, { status: 401 });
    }
    const contratoId = String(body.contratoId || "").trim();
    const cuotaId = String(body.cuotaId || "").trim();
    const contrato = db.contratos.find((c) => c.id === contratoId);
    if (!contrato) {
      return NextResponse.json({ ok: false, message: "Contrato no encontrado." }, { status: 404 });
    }
    const cuota = contrato.cuotas.find((q) => q.id === cuotaId);
    if (!cuota) {
      return NextResponse.json({ ok: false, message: "Cuota no encontrada." }, { status: 404 });
    }
    if (cuota.estado === "pagado") {
      return NextResponse.json({ ok: false, message: "Esta cuota ya se encuentra pagada." }, { status: 400 });
    }

    const split = calculateInmoSplit(cuota.montoTotal, cuota.inmobiliariaPct ?? contrato.inmobiliariaPct);
    const mpCfg = await getMpMarketplaceConfig();
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "www.minisistema.com.ar";
    const proto = host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
    const returnBase =
      tenant.option_type === 2 && !tenant.is_base
        ? `${proto}://${host}/${tenant.slug}/inmobiliaria`
        : `${proto}://${host}/inmobiliaria`;

    let initPointUrl = "";
    let preferenceId = `PREF-INMO-SPLIT-${Date.now()}`;
    let provider: InmoSplitTransaction["provider"] = "mercadopago_sandbox";

    // Si hay credenciales Mercado Pago configuradas, generar preferencia real con marketplace_fee (Split ReikiOnline)
    if (mpCfg.platformAccessToken && cuota.moneda === "ARS") {
      try {
        const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
          method: "POST",
          signal: AbortSignal.timeout(7000),
          headers: {
            Authorization: `Bearer ${mpCfg.platformAccessToken}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": `inmo_split_${tenant.slug}_${cuota.id}`,
          },
          body: JSON.stringify({
            items: [
              {
                id: `${contrato.codigo}-${cuota.periodo}`,
                title: `${cuota.concepto} · ${contrato.propiedadTitulo}`,
                description: `Contrato ${contrato.codigo} · Split ${split.propietarioPct}% Propietario / ${split.inmobiliariaPct}% Inmobiliaria`,
                quantity: 1,
                currency_id: "ARS",
                unit_price: split.montoTotal,
              },
            ],
            marketplace_fee: split.montoInmobiliaria,
            external_reference: `${tenant.slug}|${contrato.id}|${cuota.id}`,
            back_urls: {
              success: `${returnBase}?pago=ok&contrato=${encodeURIComponent(contrato.id)}`,
              pending: `${returnBase}?pago=pendiente`,
              failure: `${returnBase}?pago=error`,
            },
            auto_return: "approved",
          }),
        });
        if (mpRes.ok) {
          const mpData = (await mpRes.json()) as AnyObj;
          if (mpData?.init_point) {
            initPointUrl = String(mpData.init_point);
            preferenceId = String(mpData.id || preferenceId);
            provider = "mercadopago_split";
          }
        }
      } catch {
        // continúa en modo sandbox / simulación inmediata
      }
    }

    const simulateConfirm = Boolean(body.confirmImmediate) || !initPointUrl;
    const tx: InmoSplitTransaction = {
      id: `tx_inmo_${Date.now()}`,
      contratoId: contrato.id,
      contratoCodigo: contrato.codigo,
      cuotaId: cuota.id,
      periodo: cuota.periodo,
      inquilinoNombre: contrato.inquilinoNombre,
      propietarioNombre: contrato.propietarioNombre,
      moneda: cuota.moneda,
      montoTotal: split.montoTotal,
      propietarioPct: split.propietarioPct,
      inmobiliariaPct: split.inmobiliariaPct,
      montoPropietario: split.montoPropietario,
      montoInmobiliaria: split.montoInmobiliaria,
      provider,
      mpPreferenceId: preferenceId,
      mpPaymentId: simulateConfirm ? `PAY-SPLIT-${Date.now().toString().slice(-6)}` : undefined,
      status: simulateConfirm ? "approved" : "pending",
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    cuota.mpPreferenceId = preferenceId;
    if (simulateConfirm) {
      cuota.estado = "pagado";
      cuota.fechaPago = nowIso;
      cuota.medioPago = "Mercado Pago Split (Propietario + Inmobiliaria)";
      cuota.comprobanteRef = tx.mpPaymentId || preferenceId;
      cuota.mpPaymentId = tx.mpPaymentId;
    }

    db.transaccionesSplit.unshift(tx);
    db.updatedAt = nowIso;
    await putTenantDoc(tenant, INMO_DOC_KEY, db, sess.email, "inmo_pay_cuota_split");

    return NextResponse.json({
      ok: true,
      initPointUrl,
      paidImmediately: simulateConfirm,
      transaction: tx,
      contrato,
      message: initPointUrl
        ? "Redirigiendo a Mercado Pago Split..."
        : `¡Pago acreditado! Split aplicado: ${split.propietarioPct}% ($${split.montoPropietario.toLocaleString("es-AR")}) al Propietario y ${split.inmobiliariaPct}% ($${split.montoInmobiliaria.toLocaleString("es-AR")}) a la Inmobiliaria.`,
    });
  }

  return NextResponse.json({ ok: false, message: `Acción pública no soportada: ${action}` }, { status: 400 });
}

// ============================================================================
// API ADMINISTRADOR ERP: /sistema/api/inmobiliaria.php
// ============================================================================
export async function handleErpInmobiliaria(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const sess =
    extractErpSessionFromRequest(req, tenant.slug) ||
    extractErpSessionFromRequest(req, "minisistema");
  const actorHeader = (req.headers.get("x-erp-user") || "").trim().toLowerCase();
  const actor = sess?.username || actorHeader || "";

  if (!sess && actor !== GENERAL_ADMIN_USERNAME) {
    return NextResponse.json(
      { ok: false, message: "Sesión expirada. Iniciá sesión en el sistema." },
      { status: 401 }
    );
  }

  const db = await loadInmobiliariaDb(tenant);
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "www.minisistema.com.ar";
  const proto = host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
  const publicInmoUrl =
    tenant.option_type === 2 && !tenant.is_base
      ? `${proto}://${host}/${tenant.slug}/inmobiliaria`
      : `${proto}://${host}/inmobiliaria`;

  if (req.method === "GET") {
    const propsActivas = db.propiedades.filter((p) => p.activa !== false && !isPropertyExpired(p));
    const propsCaducadas = db.propiedades.filter((p) => isPropertyExpired(p));
    const contratosVigentes = db.contratos.filter((c) => c.estado === "vigente");
    const consultasNuevas = db.consultas.filter((q) => q.estado === "nueva");
    const totalCobradoSplit = db.transaccionesSplit
      .filter((t) => t.status === "approved")
      .reduce((acc, t) => acc + Number(t.montoTotal || 0), 0);
    const totalHonorariosInmo = db.transaccionesSplit
      .filter((t) => t.status === "approved")
      .reduce((acc, t) => acc + Number(t.montoInmobiliaria || 0), 0);

    return NextResponse.json({
      ok: true,
      publicInmoUrl,
      placeholders: CONTRACT_PLACEHOLDERS,
      stats: {
        propiedadesTotal: db.propiedades.length,
        propiedadesActivas: propsActivas.length,
        propiedadesCaducadas: propsCaducadas.length,
        ventasCount: propsActivas.filter((p) => p.operacion === "venta").length,
        alquileresCount: propsActivas.filter((p) => p.operacion === "alquiler").length,
        temporariosCount: propsActivas.filter((p) => p.operacion === "alquiler_temporario").length,
        destacadasCount: propsActivas.filter((p) => p.destacada).length,
        bannersActivos: db.banners.filter((b) => b.activo !== false).length,
        clientesTotal: db.clientes.length,
        contratosTotal: db.contratos.length,
        contratosVigentes: contratosVigentes.length,
        plantillasTotal: db.plantillasContrato.length,
        consultasNuevas: consultasNuevas.length,
        totalCobradoSplit: round2Inmo(totalCobradoSplit),
        totalHonorariosInmo: round2Inmo(totalHonorariosInmo),
      },
      data: {
        portalConfig: db.portalConfig,
        banners: db.banners,
        propiedades: db.propiedades,
        clientes: db.clientes.map((c) => sanitizeClientForPublic(c)),
        plantillasContrato: db.plantillasContrato,
        contratos: db.contratos,
        transaccionesSplit: db.transaccionesSplit,
        consultas: db.consultas,
      },
      catalogs: {
        paises: (referenceCatalogs.catalogs as AnyObj).paises || [],
        provincias: (referenceCatalogs.catalogs as AnyObj).provincias || [],
        localidadesPorProvincia:
          (referenceCatalogs.catalogs as AnyObj).localidadesPorProvincia || {},
      },
    });
  }

  if (req.method === "POST") {
    const body = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
    const action = String(body.action || "").trim();
    const nowIso = new Date().toISOString();

    try {
      // 1. Guardar configuración del portal / Split default / etiquetas
      if (action === "save_portal_config") {
        const cfg = body.portalConfig || body;
        const inmoPct = clampPctInmo(
          cfg.defaultInmobiliariaPct ?? db.portalConfig.defaultInmobiliariaPct,
          10
        );
        const rawEtiquetas = Array.isArray(cfg.etiquetasPersonalizadas)
          ? cfg.etiquetasPersonalizadas
          : typeof cfg.etiquetasPersonalizadas === "string"
            ? cfg.etiquetasPersonalizadas
                .split(",")
                .map((x: string) => x.trim())
                .filter(Boolean)
            : db.portalConfig.etiquetasPersonalizadas;

        db.portalConfig = {
          ...db.portalConfig,
          tituloPortal: String(cfg.tituloPortal || db.portalConfig.tituloPortal).trim(),
          subtituloPortal: String(cfg.subtituloPortal || db.portalConfig.subtituloPortal).trim(),
          matriculaCorredor: String(cfg.matriculaCorredor || "").trim(),
          whatsappNumero: String(cfg.whatsappNumero || "").replace(/[^\d]/g, ""),
          whatsappMensajeDefault: String(cfg.whatsappMensajeDefault || "").trim(),
          emailContacto: String(cfg.emailContacto || "").trim(),
          direccionOficina: String(cfg.direccionOficina || "").trim(),
          googleMapsUrl: String(cfg.googleMapsUrl ?? db.portalConfig.googleMapsUrl ?? "").trim(),
          horariosAtencion: String(cfg.horariosAtencion || "").trim(),
          instagramUrl: String(cfg.instagramUrl ?? db.portalConfig.instagramUrl ?? "").trim(),
          instagramLabel: String(cfg.instagramLabel ?? db.portalConfig.instagramLabel ?? "").trim(),
          facebookUrl: String(cfg.facebookUrl ?? db.portalConfig.facebookUrl ?? "").trim(),
          facebookLabel: String(cfg.facebookLabel ?? db.portalConfig.facebookLabel ?? "").trim(),
          googleClientId: String(cfg.googleClientId || "").trim(),
          defaultInmobiliariaPct: inmoPct,
          defaultPropietarioPct: round2Inmo(100 - inmoPct),
          etiquetasPersonalizadas: rawEtiquetas,
          habilitarIaBuscador: cfg.habilitarIaBuscador !== false,
          habilitarCalculadoraCredito: cfg.habilitarCalculadoraCredito !== false,
          habilitarComparador: cfg.habilitarComparador !== false,
          updatedAt: nowIso,
        };
        db.updatedAt = nowIso;
        await putTenantDoc(tenant, INMO_DOC_KEY, db, actor || "admin", "save_inmo_portal_config");
        return NextResponse.json({
          ok: true,
          message: "Configuración del Portal Inmobiliario y Split guardada.",
          portalConfig: db.portalConfig,
        });
      }

      // 2. ABM Banners 1530x370
      if (action === "save_banner") {
        const bIn = body.banner || body;
        const imgUrl = await uploadMediaIfBase64(
          tenant,
          String(bIn.imageBase64 || bIn.imageUrl || ""),
          "inmo_banner",
          "banners"
        );
        if (!imgUrl) {
          return NextResponse.json(
            { ok: false, message: "Subí o indicá la URL de la imagen del banner (1530×370)." },
            { status: 400 }
          );
        }
        const existingIdx = bIn.id ? db.banners.findIndex((x) => x.id === bIn.id) : -1;
        const item: InmoBannerRecord = {
          id: existingIdx >= 0 ? db.banners[existingIdx].id : `inmo_bn_${Date.now()}`,
          titulo: String(bIn.titulo || "Banner Inmobiliaria").trim(),
          subtitulo: String(bIn.subtitulo || "").trim(),
          imageUrl: imgUrl,
          linkUrl: String(bIn.linkUrl || "").trim(),
          ctaLabel: String(bIn.ctaLabel || "Ver más").trim(),
          orden: Number(bIn.orden || db.banners.length + 1),
          activo: bIn.activo !== false,
          createdAt: existingIdx >= 0 ? db.banners[existingIdx].createdAt : nowIso,
          updatedAt: nowIso,
        };
        if (existingIdx >= 0) db.banners[existingIdx] = item;
        else db.banners.push(item);
        db.banners.sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
        db.updatedAt = nowIso;
        await putTenantDoc(tenant, INMO_DOC_KEY, db, actor || "admin", "save_inmo_banner");
        return NextResponse.json({ ok: true, message: "Banner 1530×370 guardado.", banner: item });
      }

      if (action === "delete_banner") {
        const id = String(body.id || "").trim();
        db.banners = db.banners.filter((x) => x.id !== id);
        db.updatedAt = nowIso;
        await putTenantDoc(tenant, INMO_DOC_KEY, db, actor || "admin", "delete_inmo_banner");
        return NextResponse.json({ ok: true, message: "Banner eliminado." });
      }

      // 3. ABM Propiedades (Ventas / Alquileres / Alquileres Temporarios + caducidad + cartel cruzado + características rápidas + Google Maps)
      if (action === "save_propiedad") {
        const pIn = body.propiedad || body;
        const titulo = String(pIn.titulo || "").trim();
        if (!titulo) {
          return NextResponse.json(
            { ok: false, message: "Ingresá un título para la propiedad." },
            { status: 400 }
          );
        }

        // Procesar fotos (acepta URLs existentes + base64 nuevas)
        const rawFotos: string[] = Array.isArray(pIn.fotos) ? pIn.fotos : [];
        const uploadedFotos: string[] = [];
        for (let i = 0; i < rawFotos.length && i < 15; i++) {
          const url = await uploadMediaIfBase64(tenant, rawFotos[i], `inmo_prop_${i}`, "products");
          if (url) uploadedFotos.push(url);
        }

        const existingIdx = pIn.id ? db.propiedades.findIndex((x) => x.id === pIn.id) : -1;
        const prev = existingIdx >= 0 ? db.propiedades[existingIdx] : null;
        let codigo = prev?.codigo || String(pIn.codigo || "").trim();
        if (!codigo) {
          db.lastPropSeq = Number(db.lastPropSeq || 0) + 1;
          codigo = `INM-${String(db.lastPropSeq).padStart(4, "0")}`;
        }

        const latVal =
          pIn.lat !== "" && pIn.lat != null && Number.isFinite(Number(pIn.lat))
            ? Number(pIn.lat)
            : null;
        const lngVal =
          pIn.lng !== "" && pIn.lng != null && Number.isFinite(Number(pIn.lng))
            ? Number(pIn.lng)
            : null;
        const mapsUrl =
          String(pIn.googleMapsUrl || "").trim() ||
          (latVal != null && lngVal != null
            ? `https://www.google.com/maps?q=${latVal},${lngVal}`
            : pIn.direccion
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${pIn.direccion}, ${pIn.localidad || ""}, ${pIn.provincia || ""}, ${pIn.pais || "Argentina"}`
                )}`
              : "");

        const propOwner = pIn.propietarioId
          ? db.clientes.find((c) => c.id === pIn.propietarioId)
          : null;

        const record: InmoPropiedadRecord = {
          id: prev ? prev.id : `prop_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          codigo,
          titulo,
          descripcion: String(pIn.descripcion || "").trim(),
          operacion: (pIn.operacion as OperacionInmobiliaria) || "venta",
          tipoPropiedad: pIn.tipoPropiedad || "Casa",
          ambito: pIn.ambito === "rural" ? "rural" : "urbana",
          regimen: pIn.regimen || "propiedad_individual",
          estadoConstruccion: pIn.estadoConstruccion || "con_construccion",
          mostrarPrecio: pIn.mostrarPrecio !== false,
          precio: Math.max(0, Number(pIn.precio || 0)),
          moneda: pIn.moneda === "USD" ? "USD" : "ARS",
          textoConsulta: String(pIn.textoConsulta || "Consultar precio").trim(),
          cartelCruzado: String(pIn.cartelCruzado || "").trim(),
          cartelColorBg: String(pIn.cartelColorBg || "#56D7A1").trim(),
          destacada: Boolean(pIn.destacada),
          fechaCaducidad: pIn.fechaCaducidad ? String(pIn.fechaCaducidad).slice(0, 10) : null,
          pais: String(pIn.pais || "ARGENTINA").trim(),
          provincia: String(pIn.provincia || "").trim(),
          localidad: String(pIn.localidad || "").trim(),
          cp: String(pIn.cp || "").trim(),
          barrio: String(pIn.barrio || "").trim(),
          direccion: String(pIn.direccion || "").trim(),
          mostrarDireccionExacta: pIn.mostrarDireccionExacta !== false,
          lat: latVal,
          lng: lngVal,
          googleMapsUrl: mapsUrl,
          propietarioId: propOwner?.id || pIn.propietarioId || null,
          propietarioNombre: propOwner?.nombreCompleto || String(pIn.propietarioNombre || "").trim(),
          fotos: uploadedFotos,
          videoTourUrl: String(pIn.videoTourUrl || "").trim(),
          caracteristicas: buildDefaultCaracteristicas(pIn.caracteristicas || pIn),
          activa: pIn.activa !== false,
          visitas: prev ? prev.visitas : 0,
          consultasWhatsapp: prev ? prev.consultasWhatsapp : 0,
          createdAt: prev ? prev.createdAt : nowIso,
          updatedAt: nowIso,
        };

        if (existingIdx >= 0) db.propiedades[existingIdx] = record;
        else db.propiedades.unshift(record);
        db.updatedAt = nowIso;
        await putTenantDoc(tenant, INMO_DOC_KEY, db, actor || "admin", "save_inmo_propiedad");
        return NextResponse.json({
          ok: true,
          message: `Propiedad ${record.codigo} guardada y publicada.`,
          propiedad: record,
        });
      }

      if (action === "delete_propiedad") {
        const id = String(body.id || "").trim();
        db.propiedades = db.propiedades.filter((x) => x.id !== id);
        db.updatedAt = nowIso;
        await putTenantDoc(tenant, INMO_DOC_KEY, db, actor || "admin", "delete_inmo_propiedad");
        return NextResponse.json({ ok: true, message: "Propiedad eliminada." });
      }

      // 4. ABM Clientes (Inquilinos / Propietarios) desde Administrador (mismos campos que registro web)
      if (action === "save_cliente") {
        const cIn = body.cliente || body;
        const apellidos = String(cIn.apellidos || "").trim();
        const nombres = String(cIn.nombres || "").trim();
        if (!apellidos || !nombres) {
          return NextResponse.json(
            { ok: false, message: "Completá Apellidos y Nombres del cliente." },
            { status: 400 }
          );
        }
        const existingIdx = cIn.id ? db.clientes.findIndex((x) => x.id === cIn.id) : -1;
        const prev = existingIdx >= 0 ? db.clientes[existingIdx] : null;
        const waPref = String(cIn.whatsappPrefijo || "+549").trim();
        const waNum = String(cIn.whatsappNumero || "").replace(/[^\d]/g, "");
        const domCalle = String(cIn.domicilioCalle || "").trim();
        const domNum = String(cIn.domicilioNumero || "").trim();
        const domPiso = String(cIn.domicilioPiso || "").trim();
        const domDpto = String(cIn.domicilioDpto || "").trim();
        const domBarrio = String(cIn.domicilioBarrio || "").trim();
        const domFull =
          [
            `${domCalle} ${domNum}`.trim(),
            domPiso ? `Piso ${domPiso}` : "",
            domDpto ? `Dpto. ${domDpto}` : "",
            domBarrio ? `B° ${domBarrio}` : "",
          ]
            .filter(Boolean)
            .join(", ") || String(cIn.domicilio || "").trim();

        const newPass = String(cIn.password || "").trim();
        const record: InmoClienteRecord = {
          id: prev ? prev.id : `inmocli_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          rol: cIn.rol || prev?.rol || "inquilino",
          apellidos,
          nombres,
          nombreCompleto: `${apellidos.toUpperCase()}, ${nombres}`,
          tipoDoc: String(cIn.tipoDoc || "DNI").trim(),
          nroDoc: String(cIn.nroDoc || "").trim(),
          cuitCuil: String(cIn.cuitCuil || "").trim(),
          fechaNacimiento: String(cIn.fechaNacimiento || "").trim(),
          estadoCivil: String(cIn.estadoCivil || "").trim(),
          nacionalidad: String(cIn.nacionalidad || "ARGENTINA").trim(),
          pais: String(cIn.pais || "ARGENTINA").trim(),
          provincia: String(cIn.provincia || "").trim(),
          localidad: String(cIn.localidad || "").trim(),
          cp: String(cIn.cp || "").trim(),
          domicilioCalle: domCalle,
          domicilioNumero: domNum,
          domicilioPiso: domPiso,
          domicilioDpto: domDpto,
          domicilioBarrio: domBarrio,
          domicilio: domFull,
          whatsappPais: String(cIn.whatsappPais || "Argentina").trim(),
          whatsappPrefijo: waPref,
          whatsappNumero: waNum,
          whatsappCompleto: `${waPref.replace(/[^\d+]/g, "")}${waNum}`,
          telefonoAlternativo: String(cIn.telefonoAlternativo || "").trim(),
          email: String(cIn.email || "").trim().toLowerCase(),
          passwordHash: newPass ? hashClientPassword(newPass) : prev?.passwordHash,
          googleLinked: prev?.googleLinked,
          googleEmail: prev?.googleEmail,
          cbuAlias: String(cIn.cbuAlias || "").trim(),
          mpPropietarioEmail: String(cIn.mpPropietarioEmail || "").trim().toLowerCase(),
          mpAccount: prev?.mpAccount,
          notasInternas: String(cIn.notasInternas || "").trim(),
          activo: cIn.activo !== false,
          origen: prev ? prev.origen : "admin",
          createdAt: prev ? prev.createdAt : nowIso,
          updatedAt: nowIso,
        };

        if (existingIdx >= 0) db.clientes[existingIdx] = record;
        else db.clientes.unshift(record);
        db.updatedAt = nowIso;
        await putTenantDoc(tenant, INMO_DOC_KEY, db, actor || "admin", "save_inmo_cliente");
        return NextResponse.json({
          ok: true,
          message: `Cliente ${record.nombreCompleto} guardado.`,
          cliente: sanitizeClientForPublic(record),
        });
      }

      if (action === "delete_cliente") {
        const id = String(body.id || "").trim();
        db.clientes = db.clientes.filter((x) => x.id !== id);
        db.updatedAt = nowIso;
        await putTenantDoc(tenant, INMO_DOC_KEY, db, actor || "admin", "delete_inmo_cliente");
        return NextResponse.json({ ok: true, message: "Cliente eliminado." });
      }

      // 5. ABM Plantillas de Contratos editables con campos automáticos
      if (action === "save_plantilla") {
        const tIn = body.plantilla || body;
        const nombre = String(tIn.nombre || "").trim();
        if (!nombre) {
          return NextResponse.json(
            { ok: false, message: "Ingresá un nombre para el modelo de contrato." },
            { status: 400 }
          );
        }
        const existingIdx = tIn.id
          ? db.plantillasContrato.findIndex((x) => x.id === tIn.id)
          : -1;
        const prev = existingIdx >= 0 ? db.plantillasContrato[existingIdx] : null;
        const record: InmoPlantillaContratoRecord = {
          id: prev ? prev.id : `tpl_${Date.now()}`,
          nombre,
          tipoOperacion: tIn.tipoOperacion || "alquiler",
          descripcion: String(tIn.descripcion || "").trim(),
          contenidoHtml: String(tIn.contenidoHtml || ""),
          camposPersonalizados: Array.isArray(tIn.camposPersonalizados)
            ? tIn.camposPersonalizados
            : prev?.camposPersonalizados || [],
          activa: tIn.activa !== false,
          createdAt: prev ? prev.createdAt : nowIso,
          updatedAt: nowIso,
        };
        if (existingIdx >= 0) db.plantillasContrato[existingIdx] = record;
        else db.plantillasContrato.unshift(record);
        db.updatedAt = nowIso;
        await putTenantDoc(tenant, INMO_DOC_KEY, db, actor || "admin", "save_inmo_plantilla");
        return NextResponse.json({
          ok: true,
          message: `Plantilla "${record.nombre}" guardada.`,
          plantilla: record,
        });
      }

      if (action === "delete_plantilla") {
        const id = String(body.id || "").trim();
        db.plantillasContrato = db.plantillasContrato.filter((x) => x.id !== id);
        db.updatedAt = nowIso;
        await putTenantDoc(tenant, INMO_DOC_KEY, db, actor || "admin", "delete_inmo_plantilla");
        return NextResponse.json({ ok: true, message: "Plantilla eliminada." });
      }

      // 6. ABM Contratos de Arrendamiento (PDF + compilación automática + cuenta corriente + Split)
      if (action === "save_contrato") {
        const cIn = body.contrato || body;
        const inquilino = db.clientes.find((c) => c.id === cIn.inquilinoId) || null;
        const propietario = cIn.propietarioId
          ? db.clientes.find((c) => c.id === cIn.propietarioId) || null
          : null;
        const propiedad = cIn.propiedadId
          ? db.propiedades.find((p) => p.id === cIn.propiedadId) || null
          : null;
        const plantilla = cIn.plantillaId
          ? db.plantillasContrato.find((t) => t.id === cIn.plantillaId) || null
          : null;

        if (!inquilino && !String(cIn.inquilinoNombre || "").trim()) {
          return NextResponse.json(
            { ok: false, message: "Seleccioná un cliente/inquilino para el contrato." },
            { status: 400 }
          );
        }

        const existingIdx = cIn.id ? db.contratos.findIndex((x) => x.id === cIn.id) : -1;
        const prev = existingIdx >= 0 ? db.contratos[existingIdx] : null;
        let codigo = prev?.codigo || String(cIn.codigo || "").trim();
        if (!codigo) {
          db.lastContratoSeq = Number(db.lastContratoSeq || 0) + 1;
          codigo = `CTR-${new Date().getFullYear()}-${String(db.lastContratoSeq).padStart(4, "0")}`;
        }

        const pdfUrl = cIn.pdfBase64
          ? await uploadMediaIfBase64(tenant, String(cIn.pdfBase64), `ctr_pdf_${codigo}`, "banners")
          : String(cIn.pdfUrl || prev?.pdfUrl || "");
        const pdfNombreOriginal =
          String(cIn.pdfNombreOriginal || "").trim() ||
          prev?.pdfNombreOriginal ||
          (pdfUrl ? `${codigo}.pdf` : "");

        const inmoPct = clampPctInmo(
          cIn.inmobiliariaPct ?? db.portalConfig.defaultInmobiliariaPct,
          10
        );
        const propPct = round2Inmo(100 - inmoPct);
        const duracionMeses = Math.max(1, Number(cIn.duracionMeses || 24));
        const fechaInicio = String(cIn.fechaInicio || nowIso.slice(0, 10)).slice(0, 10);
        const fechaFin = String(cIn.fechaFin || "").slice(0, 10);
        const moneda: MonedaInmo = cIn.moneda === "USD" ? "USD" : "ARS";
        const valorMensualActual = Math.max(0, Number(cIn.valorMensualActual || 0));

        const draftContract: Partial<InmoContratoRecord> = {
          codigo,
          fechaInicio,
          fechaFin,
          duracionMeses,
          moneda,
          valorMensualActual,
          indiceAjuste: String(cIn.indiceAjuste || "Trimestral por ICL").trim(),
          mesDeposito: String(cIn.mesDeposito || "1 mes de depósito").trim(),
          garantiasDetalle: String(cIn.garantiasDetalle || "").trim(),
          propietarioPct: propPct,
          inmobiliariaPct: inmoPct,
          inquilinoNombre: inquilino?.nombreCompleto || String(cIn.inquilinoNombre || ""),
          inquilinoDni: inquilino?.nroDoc || String(cIn.inquilinoDni || ""),
          inquilinoEmail: inquilino?.email || String(cIn.inquilinoEmail || ""),
          propietarioNombre: propietario?.nombreCompleto || String(cIn.propietarioNombre || "Propietario"),
          propietarioDni: propietario?.nroDoc || String(cIn.propietarioDni || ""),
          propiedadCodigo: propiedad?.codigo || String(cIn.propiedadCodigo || ""),
          propiedadTitulo: propiedad?.titulo || String(cIn.propiedadTitulo || "Propiedad"),
          propiedadDireccion: propiedad?.direccion || String(cIn.propiedadDireccion || ""),
        };

        const rawHtmlTemplate =
          String(cIn.contenidoCompiladoHtml || "").trim() ||
          plantilla?.contenidoHtml ||
          prev?.contenidoCompiladoHtml ||
          "";

        const vars = buildContractVars({
          tenant,
          db,
          contrato: draftContract,
          inquilino,
          propietario,
          propiedad,
          customFields: cIn.customFields || {},
        });
        const compiledHtml = compileContractTemplate(rawHtmlTemplate, vars);

        const cuotas =
          Array.isArray(cIn.cuotas) && cIn.cuotas.length > 0
            ? cIn.cuotas
            : generateMonthlyCuotas({
                fechaInicio,
                duracionMeses,
                moneda,
                valorMensual: valorMensualActual,
                inmobiliariaPct: inmoPct,
                existingCuotas: prev?.cuotas,
              });

        const record: InmoContratoRecord = {
          id: prev ? prev.id : `ctr_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          codigo,
          titulo:
            String(cIn.titulo || "").trim() ||
            `Contrato ${draftContract.propiedadTitulo} — ${draftContract.inquilinoNombre}`,
          tipoOperacion: cIn.tipoOperacion || "alquiler",
          plantillaId: plantilla?.id || cIn.plantillaId || null,
          propiedadId: propiedad?.id || cIn.propiedadId || null,
          propiedadCodigo: draftContract.propiedadCodigo,
          propiedadTitulo: draftContract.propiedadTitulo || "",
          propiedadDireccion: draftContract.propiedadDireccion || "",
          inquilinoId: inquilino?.id || String(cIn.inquilinoId || ""),
          inquilinoNombre: draftContract.inquilinoNombre || "",
          inquilinoDni: draftContract.inquilinoDni || "",
          inquilinoEmail: draftContract.inquilinoEmail || "",
          propietarioId: propietario?.id || cIn.propietarioId || null,
          propietarioNombre: draftContract.propietarioNombre || "",
          propietarioDni: draftContract.propietarioDni,
          fechaInicio,
          fechaFin,
          duracionMeses,
          moneda,
          valorMensualActual,
          indiceAjuste: draftContract.indiceAjuste || "",
          mesDeposito: draftContract.mesDeposito || "",
          garantiasDetalle: draftContract.garantiasDetalle || "",
          propietarioPct: propPct,
          inmobiliariaPct: inmoPct,
          estado: computeContractAutoStatus(fechaInicio, fechaFin, cIn.estado),
          pdfUrl,
          pdfNombreOriginal,
          contenidoCompiladoHtml: compiledHtml,
          cuotas,
          notas: String(cIn.notas || "").trim(),
          createdAt: prev ? prev.createdAt : nowIso,
          updatedAt: nowIso,
        };

        if (existingIdx >= 0) db.contratos[existingIdx] = record;
        else db.contratos.unshift(record);
        db.updatedAt = nowIso;
        await putTenantDoc(tenant, INMO_DOC_KEY, db, actor || "admin", "save_inmo_contrato");
        return NextResponse.json({
          ok: true,
          message: `Contrato ${record.codigo} guardado con ${record.cuotas.length} cuotas y Split ${record.propietarioPct}%/${record.inmobiliariaPct}%.`,
          contrato: record,
        });
      }

      if (action === "mark_cuota_paid") {
        const contrato = db.contratos.find((c) => c.id === body.contratoId);
        const cuota = contrato?.cuotas.find((q) => q.id === body.cuotaId);
        if (!contrato || !cuota) {
          return NextResponse.json({ ok: false, message: "Contrato o cuota no encontrados." }, { status: 404 });
        }
        cuota.estado = "pagado";
        cuota.fechaPago = nowIso;
        cuota.medioPago = String(body.medioPago || "Cobro manual en oficina / Transferencia");
        cuota.comprobanteRef = String(body.comprobanteRef || `REC-${Date.now().toString().slice(-5)}`);
        const split = calculateInmoSplit(cuota.montoTotal, cuota.inmobiliariaPct ?? contrato.inmobiliariaPct);
        db.transaccionesSplit.unshift({
          id: `tx_inmo_man_${Date.now()}`,
          contratoId: contrato.id,
          contratoCodigo: contrato.codigo,
          cuotaId: cuota.id,
          periodo: cuota.periodo,
          inquilinoNombre: contrato.inquilinoNombre,
          propietarioNombre: contrato.propietarioNombre,
          moneda: cuota.moneda,
          montoTotal: split.montoTotal,
          propietarioPct: split.propietarioPct,
          inmobiliariaPct: split.inmobiliariaPct,
          montoPropietario: split.montoPropietario,
          montoInmobiliaria: split.montoInmobiliaria,
          provider: "manual",
          status: "approved",
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        db.updatedAt = nowIso;
        await putTenantDoc(tenant, INMO_DOC_KEY, db, actor || "admin", "mark_inmo_cuota_paid");
        return NextResponse.json({ ok: true, message: "Cuota marcada como pagada y liquidada en Split.", contrato });
      }

      if (action === "delete_contrato") {
        const id = String(body.id || "").trim();
        db.contratos = db.contratos.filter((x) => x.id !== id);
        db.updatedAt = nowIso;
        await putTenantDoc(tenant, INMO_DOC_KEY, db, actor || "admin", "delete_inmo_contrato");
        return NextResponse.json({ ok: true, message: "Contrato eliminado." });
      }

      // 7. Gestión de Consultas / Leads
      if (action === "update_consulta_estado") {
        const lead = db.consultas.find((q) => q.id === body.id);
        if (lead) {
          lead.estado = body.estado || "contactada";
          db.updatedAt = nowIso;
          await putTenantDoc(tenant, INMO_DOC_KEY, db, actor || "admin", "update_inmo_consulta");
        }
        return NextResponse.json({ ok: true, message: "Estado de consulta actualizado." });
      }

      return NextResponse.json({ ok: false, message: `Acción desconocida: ${action}` }, { status: 400 });
    } catch (err) {
      return NextResponse.json(
        { ok: false, message: err instanceof Error ? err.message : "Error procesando solicitud." },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ ok: false }, { status: 405 });
}
