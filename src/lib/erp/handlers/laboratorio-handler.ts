import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildInitialHistoriaClinicaDb, type HistoriaClinicaDbDoc } from "../consultorios-types";
import { extractErpSessionFromRequest } from "../erp-session";
import {
  DEFAULT_LAB_PROFILES,
  LAB_SECCIONES_LIST,
  mergeNomencladorWithOverrides,
} from "../laboratorio-nomenclador";
import type {
  LabBioquimicoSignature,
  LabConfig,
  LabObraSocialTarifa,
  LabOrderAnalyteResult,
  LabOrderPracticeItem,
  LabOrderRecord,
  LabPracticeCatalogItem,
  LabPracticeOverride,
  LabProfilePreset,
  LabQrCardRecord,
  LaboratorioDbDoc,
} from "../laboratorio-types";
import { getTenantDoc, putTenantDoc } from "../supabase-server";
import { normalizeDni } from "../turnos-types";
import { type ErpTenantRecord, GENERAL_ADMIN_USERNAME } from "../types";
import { HISTORIA_CLINICA_DOC_KEY } from "./consultorios-handler";
import { loadTurnosDb } from "./turnos-handler";

type AnyObj = Record<string, any>;

export const LABORATORIO_DOC_KEY = "laboratorio_db";

function buildDefaultObrasSocialesTarifas(): LabObraSocialTarifa[] {
  const now = new Date().toISOString();
  const presets: Array<{
    id: string;
    nombre: string;
    sigla: string;
    valorUbArs: number;
    coseguro: number;
    reqAut: boolean;
  }> = [
    { id: "os_apross", nombre: "APROSS Córdoba", sigla: "APROSS", valorUbArs: 1350, coseguro: 2500, reqAut: true },
    { id: "os_pami", nombre: "INSSJP - PAMI", sigla: "PAMI", valorUbArs: 1250, coseguro: 0, reqAut: true },
    { id: "os_osde", nombre: "OSDE Binario", sigla: "OSDE", valorUbArs: 1750, coseguro: 0, reqAut: false },
    { id: "os_swiss", nombre: "Swiss Medical", sigla: "SWISS", valorUbArs: 1700, coseguro: 0, reqAut: false },
    { id: "os_federada", nombre: "Federada Salud", sigla: "FEDERADA", valorUbArs: 1500, coseguro: 1500, reqAut: true },
    { id: "os_sancor", nombre: "Sancor Salud", sigla: "SANCOR", valorUbArs: 1550, coseguro: 0, reqAut: true },
    { id: "os_jerarquicos", nombre: "Jerárquicos Salud", sigla: "JERÁRQUICOS", valorUbArs: 1500, coseguro: 1500, reqAut: true },
    { id: "os_daspu", nombre: "DASPU Universitaria", sigla: "DASPU", valorUbArs: 1400, coseguro: 2000, reqAut: true },
    { id: "os_galeno", nombre: "Galeno Argentina", sigla: "GALENO", valorUbArs: 1680, coseguro: 0, reqAut: false },
    { id: "os_medife", nombre: "Medifé", sigla: "MEDIFÉ", valorUbArs: 1600, coseguro: 0, reqAut: false },
  ];

  return presets.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    sigla: p.sigla,
    modalidad: "por_ub",
    valorUbArs: p.valorUbArs,
    actoBioquimicoUb: 3,
    porcentajeSobreParticular: 80,
    preciosPorCodigo: {},
    coseguroDefaultArs: p.coseguro,
    requiereAutorizacion: p.reqAut,
    activa: true,
    updatedAt: now,
  }));
}

export function buildInitialLaboratorioDb(tenant: ErpTenantRecord): LaboratorioDbDoc {
  const now = new Date().toISOString();
  const brand = tenant.branding || ({} as AnyObj);
  const fantasy = tenant.fantasy_name || tenant.business_name || "Laboratorio Bioquímico";
  const labTitle = /laboratorio/i.test(fantasy)
    ? fantasy
    : `Laboratorio Clínico ${fantasy}`;
  const addressParts = [brand.address, brand.localidad].filter(Boolean).join(" - ");
  const phoneDisp = brand.whatsappDisplay || brand.whatsappDigits || "";

  return {
    version: 1,
    updatedAt: now,
    config: {
      nombreLaboratorio: labTitle,
      subtituloDirector: "Dirección Técnica Bioquímica",
      direccion: addressParts || "Consultorios Centrales",
      telefono: phoneDisp ? `Cel: ${phoneDisp}` : "",
      email: brand.emailInfo || "",
      logoUrl: brand.logo1x1Url || brand.logoSymbolUrl || "",
      bannerColorPrimary: brand.primaryHex || "#1e5aa8",
      bannerColorSecondary: "#cbd5e1",
      leyendaPiePagina:
        "Laboratorio autorizado por el Colegio de Bioquímicos - Informe validado electrónicamente",
      proximoProtocoloNro: 1001,
      valorUbBaseParticularArs: 1800,
      valorUbBaseObraSocialArs: 1350,
      incluirActoBioquimicoAuto: false,
      requerirDniEnPortalQr: false,
      mostrarQrVerificacionEnPdf: true,
      enviarEmailAlValidar: true,
      plantillaWhatsapp:
        "Hola {PACIENTE}, te informamos desde *{LABORATORIO}* que los resultados de tu estudio bioquímico (Protocolo N° *{PROTOCOLO}*) ya se encuentran disponibles. Podés verlos y descargar el informe firmado ingresando a: {LINK_QR}",
      updatedAt: now,
    },
    practiceOverrides: {},
    customProfiles: [],
    obrasSocialesTarifas: buildDefaultObrasSocialesTarifas(),
    firmasBioquimicos: [],
    qrCards: [],
    orders: [],
  };
}

export async function loadLaboratorioDb(tenant: ErpTenantRecord): Promise<LaboratorioDbDoc> {
  const fallback = buildInitialLaboratorioDb(tenant);
  const { payload } = await getTenantDoc<LaboratorioDbDoc>(
    tenant,
    LABORATORIO_DOC_KEY,
    fallback
  );
  const db = payload && typeof payload === "object" ? payload : fallback;
  if (!db.config) db.config = fallback.config;
  else db.config = { ...fallback.config, ...db.config };
  if (!db.practiceOverrides || typeof db.practiceOverrides !== "object") {
    db.practiceOverrides = {};
  }
  if (!Array.isArray(db.customProfiles)) db.customProfiles = [];
  if (!Array.isArray(db.obrasSocialesTarifas) || db.obrasSocialesTarifas.length === 0) {
    db.obrasSocialesTarifas = buildDefaultObrasSocialesTarifas();
  }
  if (!Array.isArray(db.firmasBioquimicos)) db.firmasBioquimicos = [];
  if (!Array.isArray(db.qrCards)) db.qrCards = [];
  if (!Array.isArray(db.orders)) db.orders = [];
  return db;
}

function generateUniqueQrToken(existingCodes: Set<string>): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  for (let attempt = 0; attempt < 100; attempt++) {
    let p1 = "";
    let p2 = "";
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 4; i++) p1 += alphabet[bytes[i] % alphabet.length];
    for (let i = 4; i < 8; i++) p2 += alphabet[bytes[i] % alphabet.length];
    const code = `LAB-${p1}-${p2}`;
    if (!existingCodes.has(code)) {
      existingCodes.add(code);
      return code;
    }
  }
  return `LAB-${Date.now().toString(36).toUpperCase()}`;
}

function parseLabNumber(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Soporta formato argentino "2.491" (miles) o "88,24" (decimales)
  let normalized = s.replace(/\s+/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  } else if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatArDecimal(n: number, decimals = 2): string {
  return n.toFixed(decimals).replace(".", ",");
}

function formatArInt(n: number): string {
  return Math.round(n).toLocaleString("es-AR");
}

/**
 * Recalcula automáticamente índices derivados (VCM, HCM, CHCM, recuentos leucocitarios absolutos,
 * HOMA, TyG, Riesgo CV, Colesterol No-HDL, Índice Aterógeno, Bilirrubina Indirecta) y banderas fuera de rango.
 */
export function recalculateOrderFormulas(
  practicas: LabOrderPracticeItem[],
  sexo: "M" | "F" | "X",
  catalogMap: Map<string, LabPracticeCatalogItem>
): LabOrderPracticeItem[] {
  const valMap = new Map<string, number>();

  for (const p of practicas) {
    for (const r of p.resultados || []) {
      const num = parseLabNumber(r.valor);
      if (num != null) {
        valMap.set(r.analyteId, num);
      }
    }
  }

  for (const p of practicas) {
    const catItem = catalogMap.get(p.codigo);
    const defMap = new Map(
      (catItem?.determinaciones || []).map((d) => [d.id, d])
    );

    for (const r of p.resultados || []) {
      const def = defMap.get(r.analyteId);
      const formula = def?.formulaAuto;

      if (formula === "vcm") {
        const hto = valMap.get("hematocrito");
        const eri = valMap.get("eritrocitos");
        if (hto != null && eri != null && eri > 0 && !String(r.valor || "").trim()) {
          const v = (hto * 10) / eri;
          r.valor = formatArDecimal(v, 2);
          valMap.set(r.analyteId, v);
        }
      } else if (formula === "hcm") {
        const hb = valMap.get("hemoglobina");
        const eri = valMap.get("eritrocitos");
        if (hb != null && eri != null && eri > 0 && !String(r.valor || "").trim()) {
          const v = (hb * 10) / eri;
          r.valor = formatArDecimal(v, 2);
          valMap.set(r.analyteId, v);
        }
      } else if (formula === "chcm") {
        const hb = valMap.get("hemoglobina");
        const hto = valMap.get("hematocrito");
        if (hb != null && hto != null && hto > 0 && !String(r.valor || "").trim()) {
          const v = (hb * 100) / hto;
          r.valor = formatArDecimal(v, 2);
          valMap.set(r.analyteId, v);
        }
      } else if (formula === "leuco_abs") {
        const pct = parseLabNumber(r.valor);
        const leuco = valMap.get("leucocitos");
        if (pct != null && leuco != null && leuco > 0) {
          const abs = Math.round((pct * leuco) / 100);
          r.valorSecundario = `${formatArInt(abs)} /mm3`;
        } else if (pct === 0) {
          r.valorSecundario = "0 /mm3";
        }
      } else if (formula === "homa") {
        const glu = valMap.get("glucemia");
        const ins = valMap.get("insulina_basal");
        if (glu != null && ins != null && glu > 0 && ins > 0) {
          const homa = (glu * ins) / 405;
          r.valor = formatArDecimal(homa, 2);
          valMap.set(r.analyteId, homa);
        }
      } else if (formula === "tyg") {
        const tg = valMap.get("trigliceridos");
        const glu = valMap.get("glucemia");
        if (tg != null && glu != null && tg > 0 && glu > 0) {
          const tyg = Math.log((tg * glu) / 2);
          r.valor = formatArDecimal(tyg, 1);
          valMap.set(r.analyteId, tyg);
        }
      } else if (formula === "riesgo_cv") {
        const col = valMap.get("colesterol_total");
        const hdl = valMap.get("colesterol_hdl");
        if (col != null && hdl != null && hdl > 0) {
          const idx = col / hdl;
          r.valor = formatArDecimal(idx, 1);
          valMap.set(r.analyteId, idx);
        }
      } else if (formula === "no_hdl") {
        const col = valMap.get("colesterol_total");
        const hdl = valMap.get("colesterol_hdl");
        if (col != null && hdl != null && col >= hdl) {
          const nhdl = Math.round(col - hdl);
          r.valor = String(nhdl);
          valMap.set(r.analyteId, nhdl);
        }
      } else if (formula === "aterogeno") {
        const ldl = valMap.get("colesterol_ldl");
        const hdl = valMap.get("colesterol_hdl");
        if (ldl != null && hdl != null && hdl > 0) {
          const at = ldl / hdl;
          r.valor = formatArDecimal(at, 1);
          valMap.set(r.analyteId, at);
        }
      } else if (formula === "bilirrubina_ind") {
        const bt = valMap.get("bili_total");
        const bd = valMap.get("bili_directa");
        if (bt != null && bd != null && bt >= bd) {
          const bi = bt - bd;
          r.valor = formatArDecimal(bi, 2);
          valMap.set(r.analyteId, bi);
        }
      }

      // Evaluar bandera BAJO / ALTO si tiene rangos numéricos configurados
      const curNum = parseLabNumber(r.valor);
      if (curNum != null && def) {
        const minRef = sexo === "F" ? (def.refMinFem ?? def.refMinMasc) : (def.refMinMasc ?? def.refMinFem);
        const maxRef = sexo === "F" ? (def.refMaxFem ?? def.refMaxMasc) : (def.refMaxMasc ?? def.refMaxFem);
        if (minRef != null && curNum < minRef) {
          r.flag = "BAJO";
        } else if (maxRef != null && curNum > maxRef) {
          r.flag = "ALTO";
        } else {
          r.flag = "";
        }
      }
    }
  }

  return practicas;
}

function buildPublicLabPortalUrl(req: NextRequest, tenant: ErpTenantRecord, qrCode?: string): string {
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "www.minisistema.com.ar";
  const proto = host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
  const isMiniHost =
    host.includes("minisistema.com.ar") ||
    host.includes("localhost") ||
    host.endsWith(".vercel.app");
  const subpath = !tenant.is_base && (tenant.option_type === 2 || isMiniHost);
  const basePath = subpath ? `/${tenant.slug}/laboratorio` : `/laboratorio`;
  const url = `${proto}://${host}${basePath}`;
  return qrCode ? `${url}?qr=${encodeURIComponent(qrCode)}` : url;
}

async function trySendLabEmail(params: {
  to: string;
  labName: string;
  pacienteNombre: string;
  protocoloNro: number;
  qrCode: string;
  portalUrl: string;
  primaryHex: string;
}): Promise<boolean> {
  const resendKey = (process.env.RESEND_API_KEY || "").trim();
  if (!resendKey || !params.to) return false;
  try {
    const fromEmail =
      process.env.RESEND_FROM_EMAIL ||
      process.env.NOTIFICATION_FROM_EMAIL ||
      "no-reply@minisistema.com.ar";
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#ffffff;">
        <div style="background:${params.primaryHex || "#112D3A"};color:#ffffff;padding:24px;">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:0.85;">Informe Bioquímico Validado</div>
          <h2 style="margin:6px 0 0;font-size:22px;">${params.labName}</h2>
        </div>
        <div style="padding:24px;color:#1e293b;line-height:1.6;">
          <p style="margin-top:0;">Hola <strong>${params.pacienteNombre}</strong>,</p>
          <p>Te informamos que los resultados de tu estudio bioquímico correspondiente al <strong>Protocolo N° ${params.protocoloNro}</strong> (Código QR: <code>${params.qrCode}</code>) ya fueron validados y firmados digitalmente.</p>
          <div style="margin:26px 0;text-align:center;">
            <a href="${params.portalUrl}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:10px;font-size:15px;">
              📄 Ver y Descargar Resultados PDF
            </a>
          </div>
          <p style="font-size:13px;color:#64748b;">Si tenés tu tarjeta QR entregada en el laboratorio, también podés escanearla en cualquier momento con la cámara de tu celular.</p>
        </div>
      </div>
    `;
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${params.labName} <${fromEmail}>`,
        to: [params.to],
        subject: `Resultados disponibles · Protocolo N° ${params.protocoloNro} — ${params.labName}`,
        html,
      }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function trySendWhatsAppCloud(
  tenant: ErpTenantRecord,
  toPhoneRaw: string,
  messageText: string
): Promise<boolean> {
  const digits = String(toPhoneRaw || "").replace(/\D/g, "");
  if (digits.length < 8) return false;
  try {
    const { payload: waDb } = await getTenantDoc<AnyObj>(tenant, "whatsapp_cloud_db", {});
    const phoneNumberId = String(waDb?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
    const accessToken = String(waDb?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
    if (!phoneNumberId || !accessToken) return false;

    const intlPhone = digits.startsWith("54") ? digits : `549${digits.replace(/^0+/, "")}`;
    const resp = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: intlPhone,
          type: "text",
          text: { preview_url: true, body: messageText },
        }),
      }
    );
    return resp.ok;
  } catch {
    return false;
  }
}

function buildWhatsAppClickUrl(phoneRaw: string, messageText: string): string {
  const digits = String(phoneRaw || "").replace(/\D/g, "");
  const intl = digits
    ? digits.startsWith("54")
      ? digits
      : `549${digits.replace(/^0+/, "")}`
    : "";
  const base = intl ? `https://wa.me/${intl}` : `https://wa.me/`;
  return `${base}?text=${encodeURIComponent(messageText)}`;
}

async function syncValidatedOrderToHistoriaClinica(
  tenant: ErpTenantRecord,
  order: LabOrderRecord,
  portalUrl: string,
  actor: string
): Promise<void> {
  try {
    const cleanDni = normalizeDni(order.pacienteDni);
    if (!cleanDni) return;
    const fallbackHc = buildInitialHistoriaClinicaDb();
    const { payload: hcDb } = await getTenantDoc<HistoriaClinicaDbDoc>(
      tenant,
      HISTORIA_CLINICA_DOC_KEY,
      fallbackHc
    );
    if (!hcDb || !Array.isArray(hcDb.estudios)) return;

    const studyId = `est_lab_${order.id}`;
    const pracSummary = order.practicas.map((p) => p.nombre).join(", ");
    const nowIso = new Date().toISOString();
    const studyRecord = {
      id: studyId,
      pacienteId: order.pacienteId || `pac_${cleanDni}`,
      pacienteNombre: order.pacienteNombreCompleto,
      pacienteDni: cleanDni,
      profesionalId: "prof_laboratorio",
      profesionalNombre: order.validadoPorNombre || "Laboratorio Bioquímico",
      especialidadNombre: "Bioquímica Clínica",
      tipoEstudio: "Laboratorio" as const,
      titulo: `Protocolo Bioquímico N° ${order.protocoloNro} (QR: ${order.qrCode})`,
      fechaEstudio: order.fecha,
      descripcionInforme: `Prácticas validadas: ${pracSummary}. Link directo al informe firmado: ${portalUrl}`,
      visibleParaPaciente: true,
      createdBy: actor,
      createdAt: order.validadoAt || nowIso,
      updatedAt: nowIso,
    };

    const existingIdx = hcDb.estudios.findIndex((e) => e.id === studyId);
    if (existingIdx >= 0) hcDb.estudios[existingIdx] = studyRecord;
    else hcDb.estudios.unshift(studyRecord);
    hcDb.updatedAt = new Date().toISOString();
    await putTenantDoc(tenant, HISTORIA_CLINICA_DOC_KEY, hcDb, actor, "sync_lab_estudio");
  } catch {
    // Non-blocking sync with Historia Clínica
  }
}

function buildDemoProtocol19928(
  catalogMap: Map<string, LabPracticeCatalogItem>,
  qrCode: string,
  firma?: LabBioquimicoSignature
): LabOrderRecord {
  const now = new Date().toISOString();
  const sampleValues: Record<string, Record<string, string>> = {
    "660475": {
      eritrocitos: "5,10",
      hematocrito: "45",
      hemoglobina: "15,5",
      vcm: "88,24",
      hcm: "30,39",
      chcm: "34,44",
      rdw: "13,0",
      plaquetas: "204.000",
      leucocitos: "5.300",
      mielocitos: "0",
      metamielocitos: "0",
      neutrofilos_cayado: "0",
      neutrofilos_seg: "47",
      eosinofilos: "3",
      basofilos: "0",
      linfocitos: "42",
      monocitos: "8",
      linfocitos_reactivos: "0",
    },
    "660297": { vsg_1ra: "4" },
    "660412": { glucemia: "96" },
    "660536": { insulina_basal: "21,0", indice_homa: "4,98" },
    "661070": { hba1c: "5,0" },
    "660902": { uremia: "41" },
    "660192": { creatinina: "1,26" },
    "660904": { uricemia: "9,0" },
    "660174": { colesterol_total: "189" },
    "660876": { trigliceridos: "211", indice_tyg: "9,2" },
    "661035": { colesterol_hdl: "29", indice_riesgo_cv: "6,5", colesterol_no_hdl: "160" },
    "661040": { colesterol_ldl: "117", indice_aterogeno: "4,0" },
    "660873": { got: "16" },
    "660874": { gpt: "25" },
    "660357": { fal: "239" },
    "660420": { ggt: "29" },
    "660133": { calcemia: "9,8" },
    "660362": { fosfatemia: "2,7" },
    "660653": { magnesio: "2,1" },
    "660546": { sodio: "138", potasio: "3,7" },
    "660375": { ferremia: "84" },
    "661065": { ferritina: "87,00" },
    "660190": { cpk: "200" },
    "661015": { apo_b: "99" },
    "662140": { lpa: "124,32" },
    "660865": { tsh: "3,180" },
    "660866": { t4_total: "8,10" },
    "660879": { t3: "95" },
    "660934": { vit_b12: "268" },
    "662318": { vit_d25: "31,4" },
    "661005": { psa_total: "0,65" },
    "660711": {
      orina_color: "Amarillo ámbar",
      orina_aspecto: "Límpido",
      orina_sedimento: "Escaso",
      orina_densidad: "1025",
      orina_ph: "5",
      orina_proteinas: "No contiene",
      orina_cetonas: "No contiene",
      orina_glucosa: "No contiene",
      orina_hb: "No contiene",
      orina_urobilinogeno: "Normal",
      orina_nitritos: "Negativo",
      orina_bilirrubina: "No contiene",
      sed_epiteliales: "1 cada 10 campos",
      sed_redondas: "No se observan",
      sed_leucocitos: "1 por campo",
      sed_hematies: "1 cada 10 campos",
      sed_cristales: "10 por campo (Oxalato de Calcio)",
      sed_mucus: "Moderada cantidad",
      sed_cilindros: "1 cada 5 campos",
    },
  };

  const orderedCodes = Object.keys(sampleValues);
  const practicas: LabOrderPracticeItem[] = [];

  for (const code of orderedCodes) {
    const cat = catalogMap.get(code);
    if (!cat) continue;
    const vals = sampleValues[code] || {};
    const resultados: LabOrderAnalyteResult[] = cat.determinaciones
      .filter((d) => !(code === "660546" && d.id === "cloro"))
      .map((d) => ({
        analyteId: d.id,
        label: d.label,
        subgrupo: d.subgrupo,
        valor: vals[d.id] ?? "",
        unidad: d.unidad,
        rangoReferencia: d.rangoReferencia,
      }));
    practicas.push({
      codigo: cat.codigo,
      nombre: cat.nombre,
      seccion: cat.seccion,
      metodo: cat.metodoDefault,
      muestra: cat.muestra,
      ub: cat.ub,
      valorParticularRefArs: cat.valorParticularArs,
      valorObraSocialRefArs: cat.valorObraSocialBaseArs,
      precioUnitarioArs: cat.valorObraSocialBaseArs,
      aCargoObraSocialArs: cat.valorObraSocialBaseArs,
      coseguroPacienteArs: 0,
      notaPractica: cat.notaDefault || "",
      resultados,
    });
  }

  recalculateOrderFormulas(practicas, "M", catalogMap);
  const totalOs = practicas.reduce((acc, p) => acc + p.aCargoObraSocialArs, 0);

  return {
    id: `ord_demo_19928`,
    protocoloNro: 19928,
    fecha: new Date().toISOString().slice(0, 10),
    hora: "08:30",
    pacienteApellido: "GHIGLIONE",
    pacienteNombres: "Daniel Alejandro",
    pacienteNombreCompleto: "GHIGLIONE, Daniel Alejandro",
    pacienteDni: "22523947",
    pacienteSexo: "M",
    pacienteEdad: 54,
    pacienteTelefono: "",
    pacienteEmail: "",
    medicoSolicitante: "MINARDI, Miguel M.",
    diagnosticoPresuntivo: "Control clínico cardiometabólico integral",
    ayunoHoras: "12 hs",
    coberturaTipo: "obra_social",
    obraSocialId: "os_apross",
    obraSocialNombre: "APROSS Córdoba",
    nroAfiliado: "22523947/00",
    qrCode,
    estado: "VALIDADO",
    practicas,
    subtotalParticularArs: practicas.reduce((a, p) => a + p.valorParticularRefArs, 0),
    totalObraSocialArs: totalOs,
    totalPacienteArs: 0,
    totalGeneralArs: totalOs,
    pagadoPaciente: true,
    facturadoPos: false,
    validadoPorUsername: firma?.username || "danielg",
    validadoPorNombre: firma?.nombreCompleto || "Director Técnico Bioquímico",
    validadoPorTitulo: firma?.tituloProfesional || "Bioquímico",
    validadoPorMatricula: firma?.matricula || "M.P. 5504",
    validadoFirmaDataUrl: firma?.firmaDataUrl || "",
    validadoAt: now,
    createdBy: "danielg",
    createdAt: now,
    updatedAt: now,
  };
}

function buildResponsePayload(
  req: NextRequest,
  tenant: ErpTenantRecord,
  db: LaboratorioDbDoc,
  turnosObrasSociales: AnyObj[] = [],
  turnosPacientes: AnyObj[] = [],
  turnosProfesionales: AnyObj[] = [],
  extra: AnyObj = {}
) {
  const catalog = mergeNomencladorWithOverrides(
    db.practiceOverrides,
    db.config.valorUbBaseParticularArs,
    db.config.valorUbBaseObraSocialArs
  );
  const profiles: LabProfilePreset[] = [
    ...DEFAULT_LAB_PROFILES,
    ...(db.customProfiles || []),
  ];

  const stats = {
    totalPracticasNomenclador: catalog.length,
    practicasActivas: catalog.filter((c) => c.activa).length,
    totalOrdenes: db.orders.length,
    ordenesPendientes: db.orders.filter(
      (o) => o.estado === "PENDIENTE_MUESTRA" || o.estado === "EN_PROCESO"
    ).length,
    ordenesValidadas: db.orders.filter(
      (o) => o.estado === "VALIDADO" || o.estado === "ENTREGADO"
    ).length,
    qrDisponibles: db.qrCards.filter((q) => q.status === "DISPONIBLE").length,
    qrAsignados: db.qrCards.filter(
      (q) => q.status === "ASIGNADO" || q.status === "PUBLICADO"
    ).length,
    obrasSocialesActivas: db.obrasSocialesTarifas.filter((o) => o.activa).length,
  };

  return {
    ok: true,
    portalBaseUrl: buildPublicLabPortalUrl(req, tenant),
    secciones: LAB_SECCIONES_LIST,
    config: db.config,
    catalog,
    profiles,
    obrasSocialesTarifas: db.obrasSocialesTarifas,
    firmasBioquimicos: db.firmasBioquimicos,
    qrCards: db.qrCards,
    orders: db.orders,
    turnosRef: {
      obrasSociales: turnosObrasSociales,
      pacientes: turnosPacientes.slice(0, 300),
      profesionales: turnosProfesionales,
    },
    stats,
    ...extra,
  };
}

export async function handleErpLaboratorio(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const session = extractErpSessionFromRequest(req, tenant.slug);
  const actor = session?.username || req.headers.get("x-erp-user") || GENERAL_ADMIN_USERNAME;

  const db = await loadLaboratorioDb(tenant);
  let turnosOs: AnyObj[] = [];
  let turnosPac: AnyObj[] = [];
  let turnosProf: AnyObj[] = [];

  try {
    const tDb = await loadTurnosDb(tenant);
    turnosOs = Array.isArray(tDb?.obrasSociales) ? tDb.obrasSociales : [];
    turnosPac = Array.isArray(tDb?.pacientes) ? tDb.pacientes : [];
    turnosProf = Array.isArray(tDb?.profesionales) ? tDb.profesionales : [];

    // Sincronizar automáticamente Obras Sociales nuevas cargadas en Turnero Web
    let syncedOs = false;
    for (const os of turnosOs) {
      if (!os?.nombre) continue;
      const exists = db.obrasSocialesTarifas.some(
        (t) =>
          t.obraSocialId === os.id ||
          t.nombre.trim().toLowerCase() === String(os.nombre).trim().toLowerCase() ||
          (os.sigla && t.sigla.trim().toLowerCase() === String(os.sigla).trim().toLowerCase())
      );
      if (!exists) {
        db.obrasSocialesTarifas.push({
          id: `os_${os.id}`,
          obraSocialId: os.id,
          nombre: os.nombre,
          sigla: os.sigla || os.nombre.slice(0, 10).toUpperCase(),
          modalidad: "por_ub",
          valorUbArs: db.config.valorUbBaseObraSocialArs || 1350,
          actoBioquimicoUb: 3,
          porcentajeSobreParticular: 80,
          preciosPorCodigo: {},
          coseguroDefaultArs: Number(os.coseguroDefault || 0),
          requiereAutorizacion: Boolean(os.requiereOrden),
          activa: Boolean(os.activo !== false),
          updatedAt: new Date().toISOString(),
        });
        syncedOs = true;
      }
    }
    if (syncedOs) {
      await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "sync_os_turnos");
    }
  } catch {
    // Turnos DB optional
  }

  if (req.method === "GET") {
    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf)
    );
  }

  if (req.method !== "POST") {
    return NextResponse.json({ ok: false, message: "Método no permitido." }, { status: 405 });
  }

  const body = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
  const action = String(body.action || "").trim();
  const now = new Date().toISOString();

  // 1. Configuración general y membrete del reporte PDF
  if (action === "save_config") {
    const incoming = (body.config || body) as Partial<LabConfig>;
    db.config = {
      ...db.config,
      nombreLaboratorio: String(incoming.nombreLaboratorio ?? db.config.nombreLaboratorio).trim(),
      subtituloDirector: String(incoming.subtituloDirector ?? db.config.subtituloDirector).trim(),
      direccion: String(incoming.direccion ?? db.config.direccion).trim(),
      telefono: String(incoming.telefono ?? db.config.telefono).trim(),
      email: String(incoming.email ?? db.config.email).trim(),
      logoUrl: String(incoming.logoUrl ?? db.config.logoUrl).trim(),
      bannerColorPrimary: String(incoming.bannerColorPrimary ?? db.config.bannerColorPrimary).trim(),
      bannerColorSecondary: String(incoming.bannerColorSecondary ?? db.config.bannerColorSecondary).trim(),
      leyendaPiePagina: String(incoming.leyendaPiePagina ?? db.config.leyendaPiePagina).trim(),
      proximoProtocoloNro: Math.max(
        1,
        Number(incoming.proximoProtocoloNro ?? db.config.proximoProtocoloNro) || 1001
      ),
      valorUbBaseParticularArs: Math.max(
        1,
        Number(incoming.valorUbBaseParticularArs ?? db.config.valorUbBaseParticularArs) || 1800
      ),
      valorUbBaseObraSocialArs: Math.max(
        1,
        Number(incoming.valorUbBaseObraSocialArs ?? db.config.valorUbBaseObraSocialArs) || 1350
      ),
      incluirActoBioquimicoAuto: Boolean(
        incoming.incluirActoBioquimicoAuto ?? db.config.incluirActoBioquimicoAuto
      ),
      requerirDniEnPortalQr: Boolean(
        incoming.requerirDniEnPortalQr ?? db.config.requerirDniEnPortalQr
      ),
      mostrarQrVerificacionEnPdf: Boolean(
        incoming.mostrarQrVerificacionEnPdf ?? db.config.mostrarQrVerificacionEnPdf
      ),
      enviarEmailAlValidar: Boolean(
        incoming.enviarEmailAlValidar ?? db.config.enviarEmailAlValidar
      ),
      plantillaWhatsapp: String(
        incoming.plantillaWhatsapp ?? db.config.plantillaWhatsapp
      ).trim(),
      updatedAt: now,
    };
    db.updatedAt = now;
    await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "save_lab_config");
    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        message: "Configuración y membrete del laboratorio actualizados.",
      })
    );
  }

  // 2. Firma digital del Bioquímico gestionable por usuario
  if (action === "save_signature") {
    const sig = (body.signature || body) as Partial<LabBioquimicoSignature>;
    const username = String(sig.username || actor).trim().toLowerCase();
    const nombreCompleto = String(sig.nombreCompleto || "").trim();
    const matricula = String(sig.matricula || "").trim();
    if (!nombreCompleto || !matricula) {
      return NextResponse.json(
        { ok: false, message: "Ingresá el nombre profesional y matrícula (M.P. / M.N.)." },
        { status: 400 }
      );
    }
    const savedSig: LabBioquimicoSignature = {
      username,
      nombreCompleto,
      tituloProfesional: String(sig.tituloProfesional || "Bioquímico").trim(),
      matricula,
      especialidad: String(sig.especialidad || "").trim(),
      resolucionPie: String(sig.resolucionPie || "").trim(),
      firmaDataUrl: String(sig.firmaDataUrl || "").trim(),
      activoPorDefecto: Boolean(sig.activoPorDefecto ?? true),
      updatedAt: now,
    };
    const idx = db.firmasBioquimicos.findIndex(
      (f) => f.username.toLowerCase() === username
    );
    if (idx >= 0) db.firmasBioquimicos[idx] = savedSig;
    else db.firmasBioquimicos.push(savedSig);
    db.updatedAt = now;
    await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "save_bioq_signature");
    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        message: `Firma digital de ${nombreCompleto} (${matricula}) guardada correctamente.`,
      })
    );
  }

  if (action === "delete_signature") {
    const username = String(body.username || "").trim().toLowerCase();
    db.firmasBioquimicos = db.firmasBioquimicos.filter(
      (f) => f.username.toLowerCase() !== username
    );
    db.updatedAt = now;
    await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "delete_bioq_signature");
    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        message: "Firma digital eliminada.",
      })
    );
  }

  // 3. ABM de Prestaciones Bioquímicas y Tabla de Valores de Referencia
  if (action === "save_practice") {
    const p = (body.practice || body) as AnyObj;
    const codigo = String(p.codigo || "").trim().toUpperCase();
    const nombre = String(p.nombre || "").trim().toUpperCase();
    if (!codigo || !nombre) {
      return NextResponse.json(
        { ok: false, message: "Código y nombre de la prestación son obligatorios." },
        { status: 400 }
      );
    }
    const determinaciones = Array.isArray(p.determinaciones)
      ? p.determinaciones
          .map((d: AnyObj, i: number) => ({
            id: String(d.id || `det_${codigo}_${i + 1}`).trim(),
            label: String(d.label || "Resultado").trim(),
            subgrupo: d.subgrupo ? String(d.subgrupo).trim() : undefined,
            unidad: String(d.unidad || "").trim(),
            rangoReferencia: String(d.rangoReferencia || ""),
            formulaAuto: d.formulaAuto || undefined,
            tipoInput: d.tipoInput || "texto",
            refMinMasc: d.refMinMasc != null && d.refMinMasc !== "" ? Number(d.refMinMasc) : null,
            refMaxMasc: d.refMaxMasc != null && d.refMaxMasc !== "" ? Number(d.refMaxMasc) : null,
            refMinFem: d.refMinFem != null && d.refMinFem !== "" ? Number(d.refMinFem) : null,
            refMaxFem: d.refMaxFem != null && d.refMaxFem !== "" ? Number(d.refMaxFem) : null,
          }))
          .filter((d: AnyObj) => d.label)
      : undefined;

    const override: LabPracticeOverride = {
      ...(db.practiceOverrides[codigo] || {}),
      codigo,
      nombre,
      seccion: String(p.seccion || "Química Clínica").trim(),
      metodoDefault: String(p.metodoDefault || "Automatizado").trim(),
      muestra: String(p.muestra || "Suero").trim(),
      ub: Math.max(0.5, Number(p.ub || 1)),
      valorParticularArs: Math.max(0, Number(p.valorParticularArs || 0)),
      valorObraSocialBaseArs: Math.max(0, Number(p.valorObraSocialBaseArs || 0)),
      notaDefault: String(p.notaDefault || ""),
      activa: p.activa !== false,
      bajaLogica: false,
      determinaciones,
      updatedAt: now,
    };
    db.practiceOverrides[codigo] = override;
    db.updatedAt = now;
    await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "save_lab_practice");
    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        message: `Prestación ${codigo} — ${nombre} guardada en el Nomenclador.`,
      })
    );
  }

  if (action === "delete_practice") {
    const codigo = String(body.codigo || "").trim().toUpperCase();
    if (codigo) {
      if (body.restoreDefault) {
        delete db.practiceOverrides[codigo];
      } else {
        db.practiceOverrides[codigo] = {
          ...(db.practiceOverrides[codigo] || { codigo }),
          activa: false,
          bajaLogica: Boolean(body.hardDelete),
          updatedAt: now,
        };
      }
      db.updatedAt = now;
      await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "delete_lab_practice");
    }
    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        message: body.restoreDefault
          ? `Prestación ${codigo} restaurada a valores oficiales del Nomenclador.`
          : `Estado de prestación ${codigo} actualizado.`,
      })
    );
  }

  // 4. Listas de Costos por Obra Social
  if (action === "save_os_tarifa") {
    const raw = (body.tarifa || body) as Partial<LabObraSocialTarifa>;
    const nombre = String(raw.nombre || "").trim();
    if (!nombre) {
      return NextResponse.json(
        { ok: false, message: "Ingresá el nombre de la Obra Social / Prepaga." },
        { status: 400 }
      );
    }
    const id = String(raw.id || `os_${Date.now()}`).trim();
    const prev = db.obrasSocialesTarifas.find((t) => t.id === id);
    const saved: LabObraSocialTarifa = {
      id,
      obraSocialId: raw.obraSocialId || prev?.obraSocialId,
      nombre,
      sigla: String(raw.sigla || nombre.slice(0, 12)).trim().toUpperCase(),
      cuit: String(raw.cuit || prev?.cuit || "").trim(),
      modalidad:
        raw.modalidad === "porcentaje_particular" || raw.modalidad === "lista_fija"
          ? raw.modalidad
          : "por_ub",
      valorUbArs: Math.max(0, Number(raw.valorUbArs ?? prev?.valorUbArs ?? 1350)),
      actoBioquimicoUb: Math.max(0, Number(raw.actoBioquimicoUb ?? prev?.actoBioquimicoUb ?? 3)),
      porcentajeSobreParticular: Math.max(
        0,
        Number(raw.porcentajeSobreParticular ?? prev?.porcentajeSobreParticular ?? 80)
      ),
      preciosPorCodigo:
        raw.preciosPorCodigo && typeof raw.preciosPorCodigo === "object"
          ? raw.preciosPorCodigo
          : prev?.preciosPorCodigo || {},
      coseguroDefaultArs: Math.max(
        0,
        Number(raw.coseguroDefaultArs ?? prev?.coseguroDefaultArs ?? 0)
      ),
      requiereAutorizacion: Boolean(
        raw.requiereAutorizacion ?? prev?.requiereAutorizacion ?? false
      ),
      observaciones: String(raw.observaciones ?? prev?.observaciones ?? "").trim(),
      activa: raw.activa !== false,
      updatedAt: now,
    };
    const idx = db.obrasSocialesTarifas.findIndex((t) => t.id === id);
    if (idx >= 0) db.obrasSocialesTarifas[idx] = saved;
    else db.obrasSocialesTarifas.push(saved);
    db.updatedAt = now;
    await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "save_os_tarifa");
    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        message: `Convenio y lista de valores de ${saved.nombre} actualizados.`,
      })
    );
  }

  if (action === "set_os_practice_price") {
    const osId = String(body.obraSocialId || "").trim();
    const codigo = String(body.codigo || "").trim();
    const precio = body.precioArs;
    const os = db.obrasSocialesTarifas.find((t) => t.id === osId);
    if (!os || !codigo) {
      return NextResponse.json(
        { ok: false, message: "Obra Social o código inválido." },
        { status: 400 }
      );
    }
    if (!os.preciosPorCodigo) os.preciosPorCodigo = {};
    if (precio === null || precio === "" || Number(precio) < 0) {
      delete os.preciosPorCodigo[codigo];
    } else {
      os.preciosPorCodigo[codigo] = Math.round(Number(precio) * 100) / 100;
    }
    os.updatedAt = now;
    db.updatedAt = now;
    await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "set_os_practice_price");
    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        message: `Valor específico del código ${codigo} actualizado para ${os.sigla}.`,
      })
    );
  }

  if (action === "delete_os_tarifa") {
    const id = String(body.id || "").trim();
    db.obrasSocialesTarifas = db.obrasSocialesTarifas.filter((t) => t.id !== id);
    db.updatedAt = now;
    await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "delete_os_tarifa");
    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        message: "Convenio de Obra Social eliminado.",
      })
    );
  }

  // 5. Generación de Lotes de Tarjetas QR Pre-impresas para entregar a pacientes
  if (action === "generate_qr_batch") {
    const count = Math.min(120, Math.max(1, Number(body.cantidad || 24)));
    const batchLabel =
      String(body.batchLabel || "").trim() ||
      `Lote ${new Date().toLocaleDateString("es-AR")}`;
    const batchId = `batch_${Date.now()}`;
    const existingCodes = new Set(db.qrCards.map((c) => c.code.toUpperCase()));
    const createdCards: LabQrCardRecord[] = [];

    for (let i = 0; i < count; i++) {
      const code = generateUniqueQrToken(existingCodes);
      const pinSeguridad = String(crypto.randomInt(1000, 10000));
      const card: LabQrCardRecord = {
        code,
        batchId,
        batchLabel,
        seqInBatch: i + 1,
        pinSeguridad,
        status: "DISPONIBLE",
        createdAt: now,
      };
      createdCards.push(card);
    }

    db.qrCards = [...createdCards, ...db.qrCards].slice(0, 3000);
    db.updatedAt = now;
    await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "generate_qr_batch");
    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        createdBatchId: batchId,
        createdCards,
        message: `Se generaron ${count} tarjetas QR pre-impresas listas para imprimir y entregar.`,
      })
    );
  }

  if (action === "annul_qr") {
    const code = String(body.code || "").trim().toUpperCase();
    const card = db.qrCards.find((c) => c.code.toUpperCase() === code);
    if (card) {
      card.status = "ANULADO";
      db.updatedAt = now;
      await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "annul_qr");
    }
    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        message: `Código QR ${code} anulado.`,
      })
    );
  }

  // 6. Guardar Pedido Médico / Protocolo y asociar QR
  if (action === "save_order") {
    const raw = (body.order || body) as AnyObj;
    const catalog = mergeNomencladorWithOverrides(
      db.practiceOverrides,
      db.config.valorUbBaseParticularArs,
      db.config.valorUbBaseObraSocialArs
    );
    const catalogMap = new Map(catalog.map((c) => [c.codigo, c]));

    const isEdit = Boolean(raw.id) && db.orders.some((o) => o.id === raw.id);
    const prevOrd = isEdit ? db.orders.find((o) => o.id === raw.id)! : null;

    const apellido = String(raw.pacienteApellido || "").trim().toUpperCase();
    const nombres = String(raw.pacienteNombres || "").trim();
    const nombreCompleto =
      String(raw.pacienteNombreCompleto || "").trim() ||
      (apellido && nombres ? `${apellido}, ${nombres}` : apellido || nombres);
    const dni = normalizeDni(String(raw.pacienteDni || ""));

    if (!nombreCompleto || !dni) {
      return NextResponse.json(
        { ok: false, message: "Completá Apellido/Nombre y DNI del paciente." },
        { status: 400 }
      );
    }

    const rawPracticas = Array.isArray(raw.practicas) ? raw.practicas : [];
    if (rawPracticas.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Agregá al menos una prestación bioquímica al pedido." },
        { status: 400 }
      );
    }

    // Número de protocolo correlativo
    let protocoloNro = Number(raw.protocoloNro || prevOrd?.protocoloNro || 0);
    if (!protocoloNro || protocoloNro <= 0) {
      const maxExisting = db.orders.reduce(
        (mx, o) => Math.max(mx, Number(o.protocoloNro || 0)),
        0
      );
      protocoloNro = Math.max(db.config.proximoProtocoloNro || 1001, maxExisting + 1);
    }
    if (protocoloNro >= (db.config.proximoProtocoloNro || 1001)) {
      db.config.proximoProtocoloNro = protocoloNro + 1;
    }

    // Asociación de QR (pre-impreso escaneado/seleccionado o autogenerado en el acto)
    const existingCodes = new Set(db.qrCards.map((c) => c.code.toUpperCase()));
    let qrCode = String(raw.qrCode || prevOrd?.qrCode || "")
      .trim()
      .toUpperCase();
    // Si pegaron la URL completa del lector QR, extraer ?qr=LAB-...
    if (qrCode.includes("QR=")) {
      const m = qrCode.match(/QR=(LAB-[A-Z0-9-]+)/i);
      if (m) qrCode = m[1].toUpperCase();
    }
    if (!qrCode) {
      qrCode = generateUniqueQrToken(existingCodes);
    }

    // Liberar tarjeta anterior si cambió el QR en una edición
    if (prevOrd?.qrCode && prevOrd.qrCode !== qrCode) {
      const oldCard = db.qrCards.find((c) => c.code.toUpperCase() === prevOrd.qrCode.toUpperCase());
      if (oldCard) {
        oldCard.status = "DISPONIBLE";
        delete oldCard.orderId;
        delete oldCard.protocoloNro;
        delete oldCard.pacienteNombre;
        delete oldCard.pacienteDni;
      }
    }

    const orderId = prevOrd?.id || `ord_${Date.now()}`;
    let qrCard = db.qrCards.find((c) => c.code.toUpperCase() === qrCode);
    if (
      qrCard &&
      qrCard.orderId &&
      qrCard.orderId !== orderId &&
      qrCard.status !== "DISPONIBLE"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: `El código QR ${qrCode} ya está asignado al Protocolo N° ${qrCard.protocoloNro} (${qrCard.pacienteNombre}). Elegí otro QR disponible.`,
        },
        { status: 400 }
      );
    }

    const coberturaTipo = raw.coberturaTipo === "obra_social" ? "obra_social" : "particular";
    const sexo: "M" | "F" | "X" =
      raw.pacienteSexo === "F" ? "F" : raw.pacienteSexo === "X" ? "X" : "M";

    const prevPracMap = new Map(
      (prevOrd?.practicas || []).map((p) => [p.codigo, p])
    );

    const practicasBuilt: LabOrderPracticeItem[] = rawPracticas.map((rp: AnyObj) => {
      const code = String(rp.codigo || "").trim().toUpperCase();
      const cat = catalogMap.get(code);
      const prevP = prevPracMap.get(code);
      const prevResMap = new Map(
        (prevP?.resultados || []).map((r) => [r.analyteId, r])
      );
      const incomingResMap = new Map(
        (Array.isArray(rp.resultados) ? rp.resultados : []).map((r: AnyObj) => [
          String(r.analyteId || ""),
          r,
        ])
      );

      const defs = cat?.determinaciones || [
        {
          id: `det_${code}`,
          label: "Resultado",
          unidad: "",
          rangoReferencia: "",
        },
      ];

      const resultados: LabOrderAnalyteResult[] = defs.map((d) => {
        const inc = incomingResMap.get(d.id) as AnyObj | undefined;
        const prv = prevResMap.get(d.id);
        return {
          analyteId: d.id,
          label: inc?.label || prv?.label || d.label,
          subgrupo: d.subgrupo,
          valor: String(inc?.valor ?? prv?.valor ?? ""),
          valorSecundario: String(inc?.valorSecundario ?? prv?.valorSecundario ?? ""),
          unidad: inc?.unidad ?? prv?.unidad ?? d.unidad,
          rangoReferencia: inc?.rangoReferencia ?? prv?.rangoReferencia ?? d.rangoReferencia,
          flag: inc?.flag ?? prv?.flag ?? "",
        };
      });

      const unitPrice = Math.max(
        0,
        Number(
          rp.precioUnitarioArs ??
            (coberturaTipo === "obra_social"
              ? cat?.valorObraSocialBaseArs
              : cat?.valorParticularArs) ??
            0
        )
      );
      const coseguro = Math.max(0, Number(rp.coseguroPacienteArs || 0));
      const aCargoOs = coberturaTipo === "obra_social" ? unitPrice : 0;

      return {
        codigo: code,
        nombre: String(rp.nombre || cat?.nombre || code),
        seccion: String(rp.seccion || cat?.seccion || "Química Clínica"),
        metodo: String(rp.metodo || prevP?.metodo || cat?.metodoDefault || ""),
        muestra: String(rp.muestra || cat?.muestra || "Suero"),
        ub: Number(rp.ub ?? cat?.ub ?? 1),
        valorParticularRefArs: Number(cat?.valorParticularArs || unitPrice),
        valorObraSocialRefArs: Number(cat?.valorObraSocialBaseArs || unitPrice),
        precioUnitarioArs: unitPrice,
        aCargoObraSocialArs: aCargoOs,
        coseguroPacienteArs: coberturaTipo === "obra_social" ? coseguro : unitPrice,
        notaPractica: String(rp.notaPractica ?? prevP?.notaPractica ?? cat?.notaDefault ?? ""),
        resultados,
      };
    });

    recalculateOrderFormulas(practicasBuilt, sexo, catalogMap);

    const subtotalParticularArs = practicasBuilt.reduce(
      (a, p) => a + p.valorParticularRefArs,
      0
    );
    const totalObraSocialArs =
      coberturaTipo === "obra_social"
        ? practicasBuilt.reduce((a, p) => a + p.aCargoObraSocialArs, 0)
        : 0;
    const coseguroExtraOrden = Math.max(0, Number(raw.coseguroOrdenArs || 0));
    const totalPacienteArs =
      coberturaTipo === "obra_social"
        ? practicasBuilt.reduce((a, p) => a + p.coseguroPacienteArs, 0) + coseguroExtraOrden
        : practicasBuilt.reduce((a, p) => a + p.precioUnitarioArs, 0);
    const totalGeneralArs = totalObraSocialArs + totalPacienteArs;

    const savedOrder: LabOrderRecord = {
      id: orderId,
      protocoloNro,
      fecha: String(raw.fecha || prevOrd?.fecha || now.slice(0, 10)),
      hora: String(raw.hora || prevOrd?.hora || new Date().toTimeString().slice(0, 5)),
      fechaEntregaEstimada: String(raw.fechaEntregaEstimada || prevOrd?.fechaEntregaEstimada || ""),
      pacienteId: raw.pacienteId || prevOrd?.pacienteId,
      pacienteApellido: apellido,
      pacienteNombres: nombres,
      pacienteNombreCompleto: nombreCompleto,
      pacienteDni: dni,
      pacienteCuit: String(raw.pacienteCuit || prevOrd?.pacienteCuit || ""),
      pacienteSexo: sexo,
      pacienteFechaNac: String(raw.pacienteFechaNac || prevOrd?.pacienteFechaNac || ""),
      pacienteEdad:
        raw.pacienteEdad !== undefined && raw.pacienteEdad !== ""
          ? Number(raw.pacienteEdad)
          : prevOrd?.pacienteEdad ?? null,
      pacienteTelefono: String(raw.pacienteTelefono ?? prevOrd?.pacienteTelefono ?? "").trim(),
      pacienteEmail: String(raw.pacienteEmail ?? prevOrd?.pacienteEmail ?? "").trim(),
      medicoSolicitante: String(raw.medicoSolicitante || prevOrd?.medicoSolicitante || "S/D").trim(),
      matriculaMedico: String(raw.matriculaMedico || prevOrd?.matriculaMedico || "").trim(),
      diagnosticoPresuntivo: String(
        raw.diagnosticoPresuntivo ?? prevOrd?.diagnosticoPresuntivo ?? ""
      ).trim(),
      ayunoHoras: String(raw.ayunoHoras ?? prevOrd?.ayunoHoras ?? "8 a 12 hs").trim(),
      observacionesInternas: String(
        raw.observacionesInternas ?? prevOrd?.observacionesInternas ?? ""
      ).trim(),
      coberturaTipo,
      obraSocialId: String(raw.obraSocialId || prevOrd?.obraSocialId || ""),
      obraSocialNombre:
        coberturaTipo === "obra_social"
          ? String(raw.obraSocialNombre || prevOrd?.obraSocialNombre || "Obra Social")
          : "Particular",
      planObraSocial: String(raw.planObraSocial || prevOrd?.planObraSocial || ""),
      nroAfiliado: String(raw.nroAfiliado || prevOrd?.nroAfiliado || ""),
      nroAutorizacion: String(raw.nroAutorizacion || prevOrd?.nroAutorizacion || ""),
      qrCode,
      estado: prevOrd?.estado || "EN_PROCESO",
      practicas: practicasBuilt,
      subtotalParticularArs,
      totalObraSocialArs,
      totalPacienteArs,
      totalGeneralArs,
      pagadoPaciente: Boolean(raw.pagadoPaciente ?? prevOrd?.pagadoPaciente ?? false),
      facturadoPos: Boolean(raw.facturadoPos ?? prevOrd?.facturadoPos ?? false),
      comprobantePosRef: prevOrd?.comprobantePosRef,
      validadoPorUsername: prevOrd?.validadoPorUsername,
      validadoPorNombre: prevOrd?.validadoPorNombre,
      validadoPorTitulo: prevOrd?.validadoPorTitulo,
      validadoPorMatricula: prevOrd?.validadoPorMatricula,
      validadoFirmaDataUrl: prevOrd?.validadoFirmaDataUrl,
      validadoAt: prevOrd?.validadoAt,
      notificadoEmailAt: prevOrd?.notificadoEmailAt,
      notificadoWhatsappAt: prevOrd?.notificadoWhatsappAt,
      createdBy: prevOrd?.createdBy || actor,
      createdAt: prevOrd?.createdAt || now,
      updatedAt: now,
    };

    if (!qrCard) {
      qrCard = {
        code: qrCode,
        batchId: "adhoc",
        batchLabel: "Generado en recepción",
        seqInBatch: 1,
        pinSeguridad: dni.slice(-4).padStart(4, "0"),
        status:
          savedOrder.estado === "VALIDADO" || savedOrder.estado === "ENTREGADO"
            ? "PUBLICADO"
            : "ASIGNADO",
        orderId: savedOrder.id,
        protocoloNro: savedOrder.protocoloNro,
        pacienteNombre: savedOrder.pacienteNombreCompleto,
        pacienteDni: savedOrder.pacienteDni,
        createdAt: now,
        assignedAt: now,
      };
      db.qrCards.unshift(qrCard);
    } else {
      qrCard.status =
        savedOrder.estado === "VALIDADO" || savedOrder.estado === "ENTREGADO"
          ? "PUBLICADO"
          : "ASIGNADO";
      qrCard.orderId = savedOrder.id;
      qrCard.protocoloNro = savedOrder.protocoloNro;
      qrCard.pacienteNombre = savedOrder.pacienteNombreCompleto;
      qrCard.pacienteDni = savedOrder.pacienteDni;
      qrCard.assignedAt = qrCard.assignedAt || now;
    }

    const ordIdx = db.orders.findIndex((o) => o.id === orderId);
    if (ordIdx >= 0) db.orders[ordIdx] = savedOrder;
    else db.orders.unshift(savedOrder);

    db.updatedAt = now;
    await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "save_lab_order");

    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        savedOrder,
        message: `Protocolo N° ${savedOrder.protocoloNro} guardado y asociado al QR ${savedOrder.qrCode}.`,
      })
    );
  }

  // 7. Carga de resultados, validación con Firma Digital y envío WhatsApp / Email
  if (action === "save_results") {
    const orderId = String(body.orderId || "").trim();
    const ord = db.orders.find((o) => o.id === orderId);
    if (!ord) {
      return NextResponse.json(
        { ok: false, message: "No se encontró el protocolo solicitado." },
        { status: 404 }
      );
    }

    const catalog = mergeNomencladorWithOverrides(
      db.practiceOverrides,
      db.config.valorUbBaseParticularArs,
      db.config.valorUbBaseObraSocialArs
    );
    const catalogMap = new Map(catalog.map((c) => [c.codigo, c]));

    if (Array.isArray(body.practicas)) {
      const incomingByCode = new Map<string, AnyObj>(
        body.practicas.map((p: AnyObj) => [String(p.codigo || ""), p])
      );
      for (const prac of ord.practicas) {
        const incP = incomingByCode.get(prac.codigo);
        if (!incP) continue;
        if (incP.metodo !== undefined) prac.metodo = String(incP.metodo);
        if (incP.notaPractica !== undefined) prac.notaPractica = String(incP.notaPractica);
        if (Array.isArray(incP.resultados)) {
          const resById = new Map<string, AnyObj>(
            incP.resultados.map((r: AnyObj) => [String(r.analyteId || ""), r])
          );
          for (const r of prac.resultados) {
            const incR = resById.get(r.analyteId);
            if (incR) {
              r.valor = String(incR.valor ?? "");
              if (incR.valorSecundario !== undefined) {
                r.valorSecundario = String(incR.valorSecundario);
              }
              if (incR.rangoReferencia !== undefined) {
                r.rangoReferencia = String(incR.rangoReferencia);
              }
            }
          }
        }
      }
    }

    recalculateOrderFormulas(ord.practicas, ord.pacienteSexo, catalogMap);

    let emailSent = false;
    let waCloudSent = false;
    let whatsappUrl = "";
    const portalUrl = buildPublicLabPortalUrl(req, tenant, ord.qrCode);

    if (body.validate) {
      const signerUsername = String(body.signerUsername || actor).trim().toLowerCase();
      const sig =
        db.firmasBioquimicos.find((f) => f.username.toLowerCase() === signerUsername) ||
        db.firmasBioquimicos[0] ||
        null;

      ord.estado = body.markDelivered ? "ENTREGADO" : "VALIDADO";
      ord.validadoPorUsername = sig?.username || actor;
      ord.validadoPorNombre = sig?.nombreCompleto || String(body.signerName || actor);
      ord.validadoPorTitulo = sig?.tituloProfesional || "Bioquímico";
      ord.validadoPorMatricula = sig?.matricula || "";
      ord.validadoFirmaDataUrl = sig?.firmaDataUrl || "";
      ord.validadoAt = now;

      const qrCard = db.qrCards.find(
        (c) => c.code.toUpperCase() === ord.qrCode.toUpperCase()
      );
      if (qrCard) {
        qrCard.status = "PUBLICADO";
        qrCard.publishedAt = now;
      }

      await syncValidatedOrderToHistoriaClinica(tenant, ord, portalUrl, actor);

      const waMsg = (db.config.plantillaWhatsapp || "")
        .replace(/\{PACIENTE\}/g, ord.pacienteNombreCompleto)
        .replace(/\{LABORATORIO\}/g, db.config.nombreLaboratorio)
        .replace(/\{PROTOCOLO\}/g, String(ord.protocoloNro))
        .replace(/\{QR\}/g, ord.qrCode)
        .replace(/\{LINK_QR\}/g, portalUrl);

      whatsappUrl = buildWhatsAppClickUrl(ord.pacienteTelefono, waMsg);

      if (body.sendNotifications !== false) {
        if (ord.pacienteEmail && db.config.enviarEmailAlValidar) {
          emailSent = await trySendLabEmail({
            to: ord.pacienteEmail,
            labName: db.config.nombreLaboratorio,
            pacienteNombre: ord.pacienteNombreCompleto,
            protocoloNro: ord.protocoloNro,
            qrCode: ord.qrCode,
            portalUrl,
            primaryHex: db.config.bannerColorPrimary,
          });
          if (emailSent) ord.notificadoEmailAt = now;
        }
        if (ord.pacienteTelefono) {
          waCloudSent = await trySendWhatsAppCloud(
            tenant,
            ord.pacienteTelefono,
            waMsg
          );
          ord.notificadoWhatsappAt = now;
        }
      }
    } else {
      if (ord.estado === "PENDIENTE_MUESTRA") ord.estado = "EN_PROCESO";
    }

    ord.updatedAt = now;
    db.updatedAt = now;
    await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "save_lab_results");

    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        savedOrder: ord,
        portalUrl,
        whatsappUrl,
        emailSent,
        waCloudSent,
        message: body.validate
          ? `Protocolo N° ${ord.protocoloNro} validado con firma digital y habilitado en el QR ${ord.qrCode}.${emailSent ? " Email enviado." : ""}${waCloudSent ? " WhatsApp automático enviado." : ""}`
          : `Resultados parciales del Protocolo N° ${ord.protocoloNro} guardados en borrador.`,
      })
    );
  }

  // 8. Reenviar notificación Email / WhatsApp de un protocolo validado
  if (action === "notify_patient") {
    const orderId = String(body.orderId || "").trim();
    const ord = db.orders.find((o) => o.id === orderId);
    if (!ord) {
      return NextResponse.json(
        { ok: false, message: "Protocolo no encontrado." },
        { status: 404 }
      );
    }
    const portalUrl = buildPublicLabPortalUrl(req, tenant, ord.qrCode);
    const waMsg = (db.config.plantillaWhatsapp || "")
      .replace(/\{PACIENTE\}/g, ord.pacienteNombreCompleto)
      .replace(/\{LABORATORIO\}/g, db.config.nombreLaboratorio)
      .replace(/\{PROTOCOLO\}/g, String(ord.protocoloNro))
      .replace(/\{QR\}/g, ord.qrCode)
      .replace(/\{LINK_QR\}/g, portalUrl);

    const whatsappUrl = buildWhatsAppClickUrl(ord.pacienteTelefono, waMsg);
    let emailSent = false;
    let waCloudSent = false;

    if (ord.pacienteEmail) {
      emailSent = await trySendLabEmail({
        to: ord.pacienteEmail,
        labName: db.config.nombreLaboratorio,
        pacienteNombre: ord.pacienteNombreCompleto,
        protocoloNro: ord.protocoloNro,
        qrCode: ord.qrCode,
        portalUrl,
        primaryHex: db.config.bannerColorPrimary,
      });
      if (emailSent) ord.notificadoEmailAt = now;
    }
    if (ord.pacienteTelefono) {
      waCloudSent = await trySendWhatsAppCloud(tenant, ord.pacienteTelefono, waMsg);
      ord.notificadoWhatsappAt = now;
    }
    db.updatedAt = now;
    await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "notify_lab_patient");

    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        portalUrl,
        whatsappUrl,
        emailSent,
        waCloudSent,
        message: `Confirmación preparada para ${ord.pacienteNombreCompleto}.${emailSent ? " Email enviado correctamente." : ""}`,
      })
    );
  }

  if (action === "delete_order") {
    const orderId = String(body.orderId || "").trim();
    const ord = db.orders.find((o) => o.id === orderId);
    if (ord) {
      const card = db.qrCards.find(
        (c) => c.code.toUpperCase() === ord.qrCode.toUpperCase()
      );
      if (card) {
        card.status = "DISPONIBLE";
        delete card.orderId;
        delete card.protocoloNro;
        delete card.pacienteNombre;
        delete card.pacienteDni;
      }
      db.orders = db.orders.filter((o) => o.id !== orderId);
      db.updatedAt = now;
      await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "delete_lab_order");
    }
    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        message: "Protocolo eliminado y tarjeta QR liberada.",
      })
    );
  }

  if (action === "mark_invoiced") {
    const orderId = String(body.orderId || "").trim();
    const ord = db.orders.find((o) => o.id === orderId);
    if (ord) {
      ord.facturadoPos = true;
      ord.pagadoPaciente = true;
      if (body.comprobantePosRef) {
        ord.comprobantePosRef = String(body.comprobantePosRef);
      }
      ord.updatedAt = now;
      db.updatedAt = now;
      await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "mark_lab_invoiced");
    }
    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        message: "Protocolo marcado como facturado / cobrado.",
      })
    );
  }

  // 9. Cargar Protocolo Modelo completo (#19928) de prueba en 1 clic
  if (action === "load_demo_protocol") {
    const catalog = mergeNomencladorWithOverrides(
      db.practiceOverrides,
      db.config.valorUbBaseParticularArs,
      db.config.valorUbBaseObraSocialArs
    );
    const catalogMap = new Map(catalog.map((c) => [c.codigo, c]));
    const existingCodes = new Set(db.qrCards.map((c) => c.code.toUpperCase()));
    const prevDemo = db.orders.find((o) => o.id === "ord_demo_19928");
    const qrCode = prevDemo?.qrCode || generateUniqueQrToken(existingCodes);
    const sig = db.firmasBioquimicos[0];
    const demoOrd = buildDemoProtocol19928(catalogMap, qrCode, sig);

    const idx = db.orders.findIndex((o) => o.id === "ord_demo_19928");
    if (idx >= 0) db.orders[idx] = demoOrd;
    else db.orders.unshift(demoOrd);

    if (!db.qrCards.some((c) => c.code === qrCode)) {
      db.qrCards.unshift({
        code: qrCode,
        batchId: "demo",
        batchLabel: "Protocolo Modelo",
        seqInBatch: 1,
        pinSeguridad: "3947",
        status: "PUBLICADO",
        orderId: demoOrd.id,
        protocoloNro: demoOrd.protocoloNro,
        pacienteNombre: demoOrd.pacienteNombreCompleto,
        pacienteDni: demoOrd.pacienteDni,
        createdAt: now,
        assignedAt: now,
        publishedAt: now,
      });
    }

    db.updatedAt = now;
    await putTenantDoc(tenant, LABORATORIO_DOC_KEY, db, actor, "load_demo_protocol");
    return NextResponse.json(
      buildResponsePayload(req, tenant, db, turnosOs, turnosPac, turnosProf, {
        savedOrder: demoOrd,
        message: `Protocolo Modelo N° 19928 cargado con 26 prestaciones y QR ${qrCode}.`,
      })
    );
  }

  return NextResponse.json(
    { ok: false, message: `Acción desconocida en Laboratorio: ${action}` },
    { status: 400 }
  );
}

/**
 * Endpoint público de sólo lectura para consulta de resultados por QR del paciente (/api/laboratorio?qr=...).
 */
export async function handlePublicLaboratorioLookup(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const url = new URL(req.url);
  const rawQr = String(url.searchParams.get("qr") || "").trim().toUpperCase();
  const rawDni = normalizeDni(String(url.searchParams.get("dni") || ""));
  const rawProto = Number(url.searchParams.get("protocolo") || 0);

  const db = await loadLaboratorioDb(tenant);

  if (!rawQr && (!rawProto || !rawDni)) {
    return NextResponse.json({
      ok: true,
      found: false,
      requerirDni: db.config.requerirDniEnPortalQr,
      labInfo: {
        nombreLaboratorio: db.config.nombreLaboratorio,
        subtituloDirector: db.config.subtituloDirector,
        direccion: db.config.direccion,
        telefono: db.config.telefono,
        logoUrl: db.config.logoUrl,
      },
    });
  }

  let ord: LabOrderRecord | undefined;
  if (rawQr) {
    ord = db.orders.find((o) => o.qrCode.toUpperCase() === rawQr);
    if (!ord) {
      const card = db.qrCards.find((c) => c.code.toUpperCase() === rawQr);
      if (card) {
        return NextResponse.json({
          ok: true,
          found: true,
          cardOnly: true,
          status: card.status,
          qrCode: card.code,
          message:
            card.status === "DISPONIBLE"
              ? "Esta tarjeta QR aún no fue vinculada a una orden médica en recepción."
              : "Tarjeta QR registrada. Tus estudios se encuentran en etapa pre-analítica.",
          labInfo: {
            nombreLaboratorio: db.config.nombreLaboratorio,
            subtituloDirector: db.config.subtituloDirector,
            direccion: db.config.direccion,
            telefono: db.config.telefono,
            logoUrl: db.config.logoUrl,
          },
        });
      }
    }
  } else if (rawProto > 0 && rawDni) {
    ord = db.orders.find(
      (o) =>
        Number(o.protocoloNro) === rawProto &&
        normalizeDni(o.pacienteDni) === rawDni
    );
  }

  if (!ord) {
    return NextResponse.json(
      {
        ok: false,
        found: false,
        message: "No encontramos un protocolo asociado a los datos ingresados. Verificá el código de tu tarjeta QR.",
      },
      { status: 404 }
    );
  }

  if (db.config.requerirDniEnPortalQr && rawQr) {
    const cleanOrdDni = normalizeDni(ord.pacienteDni);
    if (!rawDni || (rawDni !== cleanOrdDni && rawDni !== cleanOrdDni.slice(-4))) {
      return NextResponse.json({
        ok: true,
        found: true,
        requiresDniVerification: true,
        protocoloNro: ord.protocoloNro,
        qrCode: ord.qrCode,
        labInfo: {
          nombreLaboratorio: db.config.nombreLaboratorio,
          subtituloDirector: db.config.subtituloDirector,
          direccion: db.config.direccion,
          telefono: db.config.telefono,
          logoUrl: db.config.logoUrl,
        },
      });
    }
  }

  const isValidated = ord.estado === "VALIDADO" || ord.estado === "ENTREGADO";
  const portalUrl = buildPublicLabPortalUrl(req, tenant, ord.qrCode);

  return NextResponse.json({
    ok: true,
    found: true,
    isValidated,
    portalUrl,
    labConfig: {
      nombreLaboratorio: db.config.nombreLaboratorio,
      subtituloDirector: db.config.subtituloDirector,
      direccion: db.config.direccion,
      telefono: db.config.telefono,
      email: db.config.email,
      logoUrl: db.config.logoUrl,
      bannerColorPrimary: db.config.bannerColorPrimary,
      bannerColorSecondary: db.config.bannerColorSecondary,
      leyendaPiePagina: db.config.leyendaPiePagina,
      mostrarQrVerificacionEnPdf: db.config.mostrarQrVerificacionEnPdf,
    },
    order: {
      protocoloNro: ord.protocoloNro,
      fecha: ord.fecha,
      pacienteNombreCompleto: ord.pacienteNombreCompleto,
      pacienteDni: ord.pacienteDni,
      pacienteSexo: ord.pacienteSexo,
      pacienteEdad: ord.pacienteEdad,
      medicoSolicitante: ord.medicoSolicitante,
      obraSocialNombre: ord.obraSocialNombre,
      qrCode: ord.qrCode,
      estado: ord.estado,
      validadoPorNombre: ord.validadoPorNombre || "",
      validadoPorTitulo: ord.validadoPorTitulo || "Bioquímico",
      validadoPorMatricula: ord.validadoPorMatricula || "",
      validadoFirmaDataUrl: isValidated ? ord.validadoFirmaDataUrl || "" : "",
      validadoAt: ord.validadoAt || "",
      practicas: isValidated
        ? ord.practicas.map((p) => ({
            codigo: p.codigo,
            nombre: p.nombre,
            seccion: p.seccion,
            metodo: p.metodo,
            notaPractica: p.notaPractica,
            resultados: p.resultados,
          }))
        : ord.practicas.map((p) => ({
            codigo: p.codigo,
            nombre: p.nombre,
            seccion: p.seccion,
            metodo: p.metodo,
            resultados: [],
          })),
    },
  });
}
