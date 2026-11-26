// ============================================================================
// CLIENTE OFICIAL ARCA (EX-AFIP) — WSAA + PADRÓN A5 (CONSTANCIA) + PADRÓN A13
// Pure Node.js (sin dependencia del binario openssl — funciona en Vercel Lambda).
// Usa un único certificado plataforma MiniSistema (ARCA_PADRON_CERT_B64 /
// ARCA_PADRON_KEY_B64 / ARCA_PADRON_CUIT) compartido por todos los comercios.
// ============================================================================

import crypto from "node:crypto";
import { getPlatformSupabase } from "./supabase-server";
import {
  formatCuit,
  parseArgentineStreetAddress,
  type ExternalTaxpayerResult,
} from "./external-dni-lookup";

const WSAA_PROD_URL = "https://wsaa.afip.gov.ar/ws/services/LoginCms";
const PADRON_A5_PROD_URL =
  "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5";
const PADRON_A13_PROD_URL =
  "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA13";

type ArcaServiceName = "ws_sr_constancia_inscripcion" | "ws_sr_padron_a13";

interface WsaaTicket {
  token: string;
  sign: string;
  expirationTime: string;
  expiresAtMs: number;
}

const memoryTaCache = new Map<ArcaServiceName, WsaaTicket>();
const inFlightTa = new Map<ArcaServiceName, Promise<WsaaTicket | null>>();

// ----------------------------------------------------------------------------
// Utilidades ASN.1 DER mínimas (RFC 5652 CMS SignedData sin dependencias)
// ----------------------------------------------------------------------------
function derEncodeLen(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derTag(tag: number, content: Buffer | Buffer[]): Buffer {
  const buf = Buffer.isBuffer(content) ? content : Buffer.concat(content);
  return Buffer.concat([Buffer.from([tag]), derEncodeLen(buf.length), buf]);
}

function derSeq(items: Buffer[]): Buffer {
  return derTag(0x30, items);
}

function derSet(items: Buffer[]): Buffer {
  return derTag(0x31, items);
}

function derIntSmall(val: number): Buffer {
  return derTag(0x02, Buffer.from([val]));
}

function derOid(oidStr: string): Buffer {
  const parts = oidStr.split(".").map(Number);
  const out: number[] = [parts[0] * 40 + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    if (v === 0) {
      out.push(0);
      continue;
    }
    const tmp: number[] = [];
    while (v > 0) {
      tmp.unshift(v & 0x7f);
      v >>= 7;
    }
    for (let j = 0; j < tmp.length - 1; j++) tmp[j] |= 0x80;
    out.push(...tmp);
  }
  return derTag(0x06, Buffer.from(out));
}

function derNull(): Buffer {
  return Buffer.from([0x05, 0x00]);
}

function derOctetString(buf: Buffer): Buffer {
  return derTag(0x04, buf);
}

interface DerTlv {
  tag: number;
  headerLen: number;
  valueStart: number;
  valueEnd: number;
  raw: Buffer;
}

function readDerTlv(buf: Buffer, offset: number): DerTlv {
  const tag = buf[offset];
  let lenByte = buf[offset + 1];
  let headerLen = 2;
  let valueLen = lenByte;
  if (lenByte & 0x80) {
    const numBytes = lenByte & 0x7f;
    valueLen = 0;
    for (let i = 0; i < numBytes; i++) {
      valueLen = (valueLen << 8) | buf[offset + 2 + i];
    }
    headerLen = 2 + numBytes;
  }
  const valueStart = offset + headerLen;
  const valueEnd = valueStart + valueLen;
  return {
    tag,
    headerLen,
    valueStart,
    valueEnd,
    raw: buf.subarray(offset, valueEnd),
  };
}

function extractCertSerialAndIssuerDer(certDer: Buffer): {
  serialDer: Buffer;
  issuerDer: Buffer;
} {
  // Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }
  const certSeq = readDerTlv(certDer, 0);
  const tbsSeq = readDerTlv(certDer, certSeq.valueStart);
  let pos = tbsSeq.valueStart;

  // Optional [0] EXPLICIT version
  const first = readDerTlv(certDer, pos);
  if (first.tag === 0xa0) {
    pos = first.valueEnd;
  }

  // serialNumber INTEGER
  const serial = readDerTlv(certDer, pos);
  pos = serial.valueEnd;

  // signature AlgorithmIdentifier
  const sigAlg = readDerTlv(certDer, pos);
  pos = sigAlg.valueEnd;

  // issuer Name (exact DER SEQUENCE)
  const issuer = readDerTlv(certDer, pos);

  return {
    serialDer: Buffer.from(serial.raw),
    issuerDer: Buffer.from(issuer.raw),
  };
}

function pemToDer(pem: string): Buffer {
  const clean = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  return Buffer.from(clean, "base64");
}

function buildCmsSignedDataBase64(
  xmlData: string,
  certPem: string,
  keyPem: string
): string {
  const dataBuf = Buffer.from(xmlData, "utf8");
  const certDer = pemToDer(certPem);
  const { serialDer, issuerDer } = extractCertSerialAndIssuerDer(certDer);

  // Firma RSA-SHA256 directa sobre los bytes del TRA XML
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(dataBuf);
  const signatureBytes = signer.sign(keyPem);

  const oidSignedData = derOid("1.2.840.113549.1.7.2");
  const oidData = derOid("1.2.840.113549.1.7.1");
  const algSha256 = derSeq([derOid("2.16.840.1.101.3.4.2.1"), derNull()]);
  const algRsa = derSeq([derOid("1.2.840.113549.1.1.1"), derNull()]);

  const encapContentInfo = derSeq([
    oidData,
    derTag(0xa0, derOctetString(dataBuf)),
  ]);

  const issuerAndSerial = derSeq([issuerDer, serialDer]);

  const signerInfo = derSeq([
    derIntSmall(1),
    issuerAndSerial,
    algSha256,
    algRsa,
    derOctetString(signatureBytes),
  ]);

  const signedData = derSeq([
    derIntSmall(1),
    derSet([algSha256]),
    encapContentInfo,
    derTag(0xa0, certDer), // certificates [0] IMPLICIT
    derSet([signerInfo]),
  ]);

  const contentInfo = derSeq([oidSignedData, derTag(0xa0, signedData)]);
  return contentInfo.toString("base64");
}

// ----------------------------------------------------------------------------
// Configuración de credenciales plataforma ARCA
// ----------------------------------------------------------------------------
function getArcaPadronConfig(): {
  cuit: string;
  certPem: string;
  keyPem: string;
} | null {
  const cuit = String(process.env.ARCA_PADRON_CUIT || "").replace(/\D/g, "");
  const certB64 = String(process.env.ARCA_PADRON_CERT_B64 || "").trim();
  const keyB64 = String(process.env.ARCA_PADRON_KEY_B64 || "").trim();

  if (!cuit || cuit.length !== 11 || !certB64 || !keyB64) {
    return null;
  }

  try {
    const certPem = Buffer.from(certB64, "base64").toString("utf8").trim();
    const keyPem = Buffer.from(keyB64, "base64").toString("utf8").trim();
    if (
      !certPem.includes("BEGIN CERTIFICATE") ||
      !keyPem.includes("PRIVATE KEY")
    ) {
      return null;
    }
    return { cuit, certPem, keyPem };
  } catch {
    return null;
  }
}

export function isArcaPadronConfigured(): boolean {
  return getArcaPadronConfig() !== null;
}

// ----------------------------------------------------------------------------
// Caché persistente de Ticket de Acceso (TA) en Supabase (evita alreadyAuthenticated)
// ----------------------------------------------------------------------------
async function readPersistedTa(
  service: ArcaServiceName
): Promise<WsaaTicket | null> {
  try {
    const sb = await getPlatformSupabase();
    const { data, error } = await sb
      .from("erp_platform_secrets")
      .select("value")
      .eq("key", `arca_wsaa_ta_${service}`)
      .maybeSingle();
    if (error || !data?.value) return null;
    const parsed = JSON.parse(String(data.value)) as WsaaTicket;
    if (
      parsed &&
      parsed.token &&
      parsed.sign &&
      parsed.expiresAtMs > Date.now() + 120_000
    ) {
      return parsed;
    }
  } catch {
    // Ignorar si no hay DB disponible en test aislado
  }
  return null;
}

async function persistTa(
  service: ArcaServiceName,
  ta: WsaaTicket
): Promise<void> {
  try {
    const sb = await getPlatformSupabase();
    await sb.from("erp_platform_secrets").upsert(
      {
        key: `arca_wsaa_ta_${service}`,
        value: JSON.stringify(ta),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  } catch {
    // No bloquear consulta si falla guardado de caché
  }
}

// ----------------------------------------------------------------------------
// WSAA — Obtener Token & Sign (vigencia ~12 horas)
// ----------------------------------------------------------------------------
function formatArcaIsoUtc(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function unescapeXmlEntities(str: string): string {
  return String(str || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function getXmlTagText(xml: string, tagName: string): string {
  const re = new RegExp(
    `<(?:[a-zA-Z0-9_-]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tagName}>`,
    "i"
  );
  const m = xml.match(re);
  return m ? unescapeXmlEntities(m[1]).trim() : "";
}

function getAllXmlBlocks(xml: string, tagName: string): string[] {
  const re = new RegExp(
    `<(?:[a-zA-Z0-9_-]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tagName}>`,
    "gi"
  );
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1]);
  }
  return out;
}

async function getWsaaTicket(
  service: ArcaServiceName
): Promise<WsaaTicket | null> {
  const cfg = getArcaPadronConfig();
  if (!cfg) return null;

  const mem = memoryTaCache.get(service);
  if (mem && mem.expiresAtMs > Date.now() + 120_000) {
    return mem;
  }

  const pending = inFlightTa.get(service);
  if (pending) return pending;

  const work = (async (): Promise<WsaaTicket | null> => {
    // 1) Verificar caché compartida en Supabase (otros lambdas Vercel)
    const persisted = await readPersistedTa(service);
    if (persisted) {
      memoryTaCache.set(service, persisted);
      return persisted;
    }

    // 2) Solicitar nuevo LoginTicketRequest a WSAA Producción
    const now = Date.now();
    const uniqueId = Math.floor(now / 1000);
    const generationTime = formatArcaIsoUtc(now - 5 * 60 * 1000);
    const expirationTime = formatArcaIsoUtc(now + 11 * 60 * 60 * 1000);

    const traXml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<loginTicketRequest version="1.0">` +
      `<header>` +
      `<uniqueId>${uniqueId}</uniqueId>` +
      `<generationTime>${generationTime}</generationTime>` +
      `<expirationTime>${expirationTime}</expirationTime>` +
      `</header>` +
      `<service>${service}</service>` +
      `</loginTicketRequest>`;

    const cmsB64 = buildCmsSignedDataBase64(traXml, cfg.certPem, cfg.keyPem);

    const soapEnvelope =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">` +
      `<soapenv:Header/>` +
      `<soapenv:Body>` +
      `<wsaa:loginCms><wsaa:in0>${cmsB64}</wsaa:in0></wsaa:loginCms>` +
      `</soapenv:Body>` +
      `</soapenv:Envelope>`;

    const res = await fetch(WSAA_PROD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: '""',
      },
      body: soapEnvelope,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    const respText = await res.text();
    if (!res.ok) {
      const fault = getXmlTagText(respText, "faultstring");
      console.error("[ARCA WSAA Error]", service, res.status, fault || respText.slice(0, 300));
      return null;
    }

    const loginCmsReturn = getXmlTagText(respText, "loginCmsReturn");
    if (!loginCmsReturn) return null;

    const token = getXmlTagText(loginCmsReturn, "token");
    const sign = getXmlTagText(loginCmsReturn, "sign");
    const expStr = getXmlTagText(loginCmsReturn, "expirationTime");
    if (!token || !sign) return null;

    const parsedExpMs = Date.parse(expStr);
    const ta: WsaaTicket = {
      token,
      sign,
      expirationTime: expStr,
      expiresAtMs: Number.isFinite(parsedExpMs)
        ? parsedExpMs
        : now + 10 * 60 * 60 * 1000,
    };

    memoryTaCache.set(service, ta);
    await persistTa(service, ta);
    return ta;
  })();

  inFlightTa.set(service, work);
  try {
    return await work;
  } finally {
    inFlightTa.delete(service);
  }
}

// ----------------------------------------------------------------------------
// Mapeo de Provincias Oficiales ARCA (idProvincia 0..24) → Catálogo ERP
// ----------------------------------------------------------------------------
const ARCA_PROVINCE_BY_ID: Record<number, string> = {
  0: "CIUDAD AUTÓNOMA DE BUENOS AIRES",
  1: "BUENOS AIRES",
  2: "CATAMARCA",
  3: "CÓRDOBA",
  4: "CORRIENTES",
  5: "ENTRE RÍOS",
  6: "JUJUY",
  7: "MENDOZA",
  8: "LA RIOJA",
  9: "SALTA",
  10: "SAN JUAN",
  11: "SAN LUIS",
  12: "SANTA FE",
  13: "SANTIAGO DEL ESTERO",
  14: "TUCUMÁN",
  16: "CHACO",
  17: "CHUBUT",
  18: "FORMOSA",
  19: "MISIONES",
  20: "NEUQUÉN",
  21: "LA PAMPA",
  22: "RÍO NEGRO",
  23: "SANTA CRUZ",
  24: "TIERRA DEL FUEGO",
};

function normalizeArcaProvince(idProvRaw: string, descProvRaw: string): string {
  const idNum = Number(idProvRaw);
  if (idProvRaw !== "" && Number.isFinite(idNum) && ARCA_PROVINCE_BY_ID[idNum]) {
    return ARCA_PROVINCE_BY_ID[idNum];
  }
  const norm = String(descProvRaw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
  if (!norm) return "";
  if (norm.includes("AUTONOMA") || norm.includes("CAPITAL FEDERAL") || norm === "CABA") {
    return "CIUDAD AUTÓNOMA DE BUENOS AIRES";
  }
  for (const val of Object.values(ARCA_PROVINCE_BY_ID)) {
    const vNorm = val
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    if (vNorm === norm) return val;
  }
  return String(descProvRaw || "").trim().toUpperCase();
}

function mapArcaTaxesToRespIva(
  xml: string,
  cuit11: string
): { respIva: ExternalTaxpayerResult["respIva"]; idRespIva: number } {
  const hasMonotributoBlock = /<datosMonotributo\b/i.test(xml);
  const taxBlocks = getAllXmlBlocks(xml, "impuesto");
  const taxIds = new Set<number>();
  for (const blk of taxBlocks) {
    const estado = getXmlTagText(blk, "estadoImpuesto").toUpperCase();
    if (estado && estado !== "ACTIVO" && estado !== "AC") continue;
    const id = Number(getXmlTagText(blk, "idImpuesto"));
    if (Number.isFinite(id) && id > 0) taxIds.add(id);
  }

  // Impuestos oficiales ARCA:
  // 20 / 21 / 22 / 23 / 24 / 5095 = Monotributo
  // 30 = IVA (Responsable Inscripto)
  // 32 = IVA Exento
  // 33 = IVA Responsable No Inscripto
  // 34 = IVA No Alcanzado
  if (
    hasMonotributoBlock ||
    taxIds.has(20) ||
    taxIds.has(5095)
  ) {
    return { respIva: "MONOTRIBUTO", idRespIva: 2 };
  }
  if (taxIds.has(30)) {
    return { respIva: "INSCRIPTO", idRespIva: 4 };
  }
  if (taxIds.has(32)) {
    return { respIva: "EXENTO", idRespIva: 5 };
  }
  if (taxIds.has(34)) {
    return { respIva: "IVA NO ALCANZADO", idRespIva: 3 };
  }
  if (taxIds.has(33)) {
    return { respIva: "NO INSCRIPTO", idRespIva: 7 };
  }
  if (/^(30|33|34)/.test(cuit11)) {
    return { respIva: "INSCRIPTO", idRespIva: 4 };
  }
  return { respIva: "CONSUMIDOR FINAL", idRespIva: 1 };
}

function parsePersonaXmlToTaxpayer(
  xml: string,
  cuit11: string,
  sourceLabel: string
): ExternalTaxpayerResult | null {
  const datosGen = getXmlTagText(xml, "datosGenerales") || getXmlTagText(xml, "persona");
  if (!datosGen) return null;

  const razonSocialRaw = getXmlTagText(datosGen, "razonSocial");
  const apellidoRaw = getXmlTagText(datosGen, "apellido");
  const nombreRaw = getXmlTagText(datosGen, "nombre");
  const tipoPersonaRaw = getXmlTagText(datosGen, "tipoPersona").toUpperCase();

  let razonSocial = razonSocialRaw
    ? razonSocialRaw.toUpperCase()
    : [apellidoRaw, nombreRaw].filter(Boolean).join(" ").toUpperCase();
  razonSocial = razonSocial.replace(/\s+/g, " ").trim();
  if (!razonSocial) return null;

  const tipoPersona: "FISICA" | "JURIDICA" =
    tipoPersonaRaw.includes("JURID") || /^(30|33|34)/.test(cuit11)
      ? "JURIDICA"
      : "FISICA";

  // Elegir domicilio FISCAL (o el primero disponible)
  const domBlocks = [
    ...getAllXmlBlocks(datosGen, "domicilioFiscal"),
    ...getAllXmlBlocks(datosGen, "domicilio"),
  ];
  const fiscalDom =
    domBlocks.find((b) => /FISCAL/i.test(getXmlTagText(b, "tipoDomicilio"))) ||
    domBlocks[0] ||
    "";

  const direccionRaw = getXmlTagText(fiscalDom, "direccion");
  const calleDirect = getXmlTagText(fiscalDom, "calle");
  const numeroDirect = getXmlTagText(fiscalDom, "numero");
  const pisoDirect = getXmlTagText(fiscalDom, "piso");
  const dptoDirect = getXmlTagText(fiscalDom, "oficinaDptoLocal");
  const localidadRaw = getXmlTagText(fiscalDom, "localidad");
  const idProvRaw = getXmlTagText(fiscalDom, "idProvincia");
  const descProvRaw = getXmlTagText(fiscalDom, "descripcionProvincia");
  const codPostalRaw = getXmlTagText(fiscalDom, "codPostal") || getXmlTagText(fiscalDom, "codigoPostal");

  const parsedAddr = parseArgentineStreetAddress(direccionRaw);
  const calle = (calleDirect || parsedAddr.calle || "").trim().toUpperCase();
  const numero = (numeroDirect || (calle ? parsedAddr.numero || "S/N" : "")).trim().toUpperCase();
  const piso = (pisoDirect || parsedAddr.piso || "").trim().toUpperCase();
  const dpto = (dptoDirect || parsedAddr.dpto || "").trim().toUpperCase();
  const cp = (codPostalRaw || parsedAddr.cp || "").trim().toUpperCase();

  const provincia = normalizeArcaProvince(idProvRaw, descProvRaw);
  let localidad = localidadRaw.trim().toUpperCase();
  if (!localidad && provincia === "CIUDAD AUTÓNOMA DE BUENOS AIRES") {
    localidad = "CIUDAD AUTÓNOMA DE BUENOS AIRES";
  }

  const domicilioFull =
    direccionRaw.trim().toUpperCase() ||
    [calle, numero && numero !== "S/N" ? numero : "", piso ? `PISO ${piso}` : "", dpto ? `DPTO ${dpto}` : ""]
      .filter(Boolean)
      .join(" ");

  const { respIva, idRespIva } = mapArcaTaxesToRespIva(xml, cuit11);

  return {
    cuit: cuit11,
    formattedCuit: formatCuit(cuit11),
    razonSocial,
    nombre: razonSocial,
    respIva,
    idRespIva,
    calle,
    numero,
    piso,
    dpto,
    domicilio: domicilioFull,
    localidad,
    provincia,
    cp,
    tipoPersona,
    source: "arca_oficial",
    sourceLabel,
  };
}

// ----------------------------------------------------------------------------
// Consulta Padrón A5 (Constancia de Inscripción) — Razón Social + Domicilio + IVA
// ----------------------------------------------------------------------------
export async function queryArcaPadronA5ByCuit(
  cuit11: string
): Promise<ExternalTaxpayerResult | null> {
  const cfg = getArcaPadronConfig();
  if (!cfg) return null;
  const ta = await getWsaaTicket("ws_sr_constancia_inscripcion");
  if (!ta) return null;

  const soapBody =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="http://a5.soap.ws.server.puc.sr/">` +
    `<soapenv:Header/>` +
    `<soapenv:Body>` +
    `<a5:getPersona_v2>` +
    `<token>${ta.token}</token>` +
    `<sign>${ta.sign}</sign>` +
    `<cuitRepresentada>${cfg.cuit}</cuitRepresentada>` +
    `<idPersona>${cuit11}</idPersona>` +
    `</a5:getPersona_v2>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`;

  const res = await fetch(PADRON_A5_PROD_URL, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: soapBody,
    signal: AbortSignal.timeout(9_000),
    cache: "no-store",
  });
  const xml = await res.text();
  if (!res.ok) {
    const fault = getXmlTagText(xml, "faultstring");
    console.error("[ARCA A5 Error]", cuit11, res.status, fault || xml.slice(0, 260));
    return null;
  }

  return parsePersonaXmlToTaxpayer(
    xml,
    cuit11,
    "ARCA Oficial (Constancia de Inscripción A5)"
  );
}

// ----------------------------------------------------------------------------
// Consulta Padrón A13 — Buscar CUIT por DNI + Datos de Persona
// ----------------------------------------------------------------------------
export async function queryArcaPadronA13ByCuit(
  cuit11: string
): Promise<ExternalTaxpayerResult | null> {
  const cfg = getArcaPadronConfig();
  if (!cfg) return null;
  const ta = await getWsaaTicket("ws_sr_padron_a13");
  if (!ta) return null;

  const soapBody =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a13="http://a13.soap.ws.server.puc.sr/">` +
    `<soapenv:Header/>` +
    `<soapenv:Body>` +
    `<a13:getPersona>` +
    `<token>${ta.token}</token>` +
    `<sign>${ta.sign}</sign>` +
    `<cuitRepresentada>${cfg.cuit}</cuitRepresentada>` +
    `<idPersona>${cuit11}</idPersona>` +
    `</a13:getPersona>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`;

  const res = await fetch(PADRON_A13_PROD_URL, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: soapBody,
    signal: AbortSignal.timeout(9_000),
    cache: "no-store",
  });
  const xml = await res.text();
  if (!res.ok) {
    const fault = getXmlTagText(xml, "faultstring");
    console.error("[ARCA A13 Error]", cuit11, res.status, fault || xml.slice(0, 260));
    return null;
  }

  return parsePersonaXmlToTaxpayer(xml, cuit11, "ARCA Oficial (Padrón A13)");
}

export async function queryArcaCuitsByDni(dniDigits: string): Promise<string[]> {
  const cfg = getArcaPadronConfig();
  if (!cfg) return [];
  const cleanDni = String(dniDigits || "").replace(/\D/g, "").replace(/^0+/, "");
  if (cleanDni.length < 6 || cleanDni.length > 8) return [];

  const ta = await getWsaaTicket("ws_sr_padron_a13");
  if (!ta) return [];

  const soapBody =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a13="http://a13.soap.ws.server.puc.sr/">` +
    `<soapenv:Header/>` +
    `<soapenv:Body>` +
    `<a13:getIdPersonaListByDocumento>` +
    `<token>${ta.token}</token>` +
    `<sign>${ta.sign}</sign>` +
    `<cuitRepresentada>${cfg.cuit}</cuitRepresentada>` +
    `<documento>${cleanDni}</documento>` +
    `</a13:getIdPersonaListByDocumento>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`;

  const res = await fetch(PADRON_A13_PROD_URL, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: soapBody,
    signal: AbortSignal.timeout(9_000),
    cache: "no-store",
  });
  const xml = await res.text();
  if (!res.ok) return [];

  const ids = getAllXmlBlocks(xml, "idPersona")
    .map((s) => s.replace(/\D/g, ""))
    .filter((s) => s.length === 11);
  return Array.from(new Set(ids));
}

/**
 * Consulta unificada oficial en ARCA (Constancia A5 + Padrón A13).
 * - Si recibe CUIT (11 dígitos): consulta A5 (Razón Social + Domicilio + IVA/Monotributo) y cae a A13 si A5 no devuelve constancia (ej. Consumidor Final sin impuestos activos).
 * - Si recibe DNI (7-8 dígitos): busca el CUIT real en A13 y luego enriquece con A5 (o A13).
 */
export async function lookupOfficialArcaByCuitOrDni(
  docRaw: string
): Promise<ExternalTaxpayerResult | null> {
  if (!isArcaPadronConfigured()) return null;
  const digits = String(docRaw || "").replace(/\D/g, "");
  if (digits.length < 6) return null;

  let targetCuit = "";
  if (digits.length === 11) {
    targetCuit = digits;
  } else if (digits.length >= 6 && digits.length <= 8) {
    const foundCuits = await queryArcaCuitsByDni(digits).catch(() => []);
    targetCuit = foundCuits[0] || "";
    if (!targetCuit) return null;
  } else {
    return null;
  }

  // 1) Intentar Constancia de Inscripción (A5) — devuelve IVA/Monotributo + Domicilio Fiscal
  const a5 = await queryArcaPadronA5ByCuit(targetCuit).catch(() => null);
  if (a5 && a5.razonSocial) {
    // Si A5 vino sin calle pero A13 tiene domicilio, enriquecer con A13
    if (!a5.calle) {
      const a13 = await queryArcaPadronA13ByCuit(targetCuit).catch(() => null);
      if (a13) {
        return {
          ...a5,
          calle: a5.calle || a13.calle,
          numero: a5.numero || a13.numero,
          piso: a5.piso || a13.piso,
          dpto: a5.dpto || a13.dpto,
          domicilio: a5.domicilio || a13.domicilio,
          localidad: a5.localidad || a13.localidad,
          provincia: a5.provincia || a13.provincia,
          cp: a5.cp || a13.cp,
        };
      }
    }
    return a5;
  }

  // 2) Fallback oficial a Padrón A13 (ej: Consumidores Finales / monotributo dado de baja que no tienen constancia A5)
  const a13 = await queryArcaPadronA13ByCuit(targetCuit).catch(() => null);
  return a13 && a13.razonSocial ? a13 : null;
}
