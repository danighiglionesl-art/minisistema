// ============================================================================
// MOTOR DE BÚSQUEDA EXTERNO DE DNI / CUIT ARGENTINO
// Fuentes públicas: CUITOnline (directo), BCRA Oficial (Central de Deudores)
// y Motores de Búsqueda Públicos (Bing / Yahoo AR) como respaldo en la nube.
// ============================================================================

export interface ExternalDniPersonResult {
  dni: string;
  cuit: string;
  formattedCuit: string;
  razonSocial: string;
  apellidos: string;
  nombres: string;
  nombreCompleto: string;
  genero?: string;
  domicilio?: string;
  localidad?: string;
  provincia?: string;
  source: "cuitonline" | "bcra_oficial" | "buscador_publico";
  sourceLabel: string;
}

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 horas en memoria del servidor
const lookupCache = new Map<
  string,
  { exp: number; data: ExternalDniPersonResult | null }
>();

const COMMON_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const INVALID_NAME_RE =
  /moment|just\s+a|cloudflare|challenge|turnstile|captcha|ray\s*id|attention|security|access\s*denied|forbidden|404|403|500|502|error|<|>|\{|\}|\[|\]|www\.|http|html|script|cuitonline|cuit\s*online|constancia\s+de|busca\s+cuit|buscador\s+afip|consulta\s+cuit|resultados\s+de/i;

const SURNAME_PARTICLES = new Set([
  "DE",
  "DEL",
  "LA",
  "LAS",
  "LOS",
  "SAN",
  "SANTA",
  "VAN",
  "VON",
  "DI",
  "DA",
  "DO",
  "DOS",
  "DAS",
  "MC",
  "MAC",
]);

function decodeHtmlEntities(str: string): string {
  return String(str || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&Aacute;/gi, "Á")
    .replace(/&Eacute;/gi, "É")
    .replace(/&Iacute;/gi, "Í")
    .replace(/&Oacute;/gi, "Ó")
    .replace(/&Uacute;/gi, "Ú")
    .replace(/&Ntilde;/gi, "Ñ")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleCaseEs(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, idx) => {
      if (idx > 0 && ["de", "del", "la", "las", "los", "y"].includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export function isValidPersonName(name: string): boolean {
  const clean = String(name || "").trim();
  if (clean.length < 4 || clean.length > 100) return false;
  if (INVALID_NAME_RE.test(clean)) return false;
  // Evitar sociedades (S.A., S.R.L., etc.) cuando buscamos una persona física por DNI
  if (/\b(?:S\.?A\.?I?\.?C?\.?|S\.?R\.?L\.?|S\.?A\.?S\.?|SOCIEDAD\s+ANONIMA|COOP(?:ERATIVA)?\.?)\b/i.test(clean)) {
    return false;
  }
  return /^[A-ZÁÉÍÓÚÑÜa-záéíóúñü\s.,'-]+$/u.test(clean) && /\s/.test(clean);
}

/**
 * En padrones argentinos (AFIP / ARCA / BCRA / CUITOnline) las personas físicas
 * figuran como "APELLIDO(S) NOMBRE(S)" (ej: "PAULUCCI EMILIANO" o "DE LA VEGA MARIA LAURA").
 */
export function splitArgentinePadronName(rawFull: string): {
  apellidos: string;
  nombres: string;
} {
  const clean = String(rawFull || "").replace(/\s+/g, " ").trim();
  if (!clean) return { apellidos: "", nombres: "" };
  if (clean.includes(",")) {
    const [ap, nom] = clean.split(",").map((s) => toTitleCaseEs(s));
    return { apellidos: ap || "", nombres: nom || "" };
  }
  const tokens = clean.split(" ").filter(Boolean);
  if (tokens.length === 1) return { apellidos: toTitleCaseEs(tokens[0]), nombres: "" };

  // Agrupar partículas iniciales del apellido ("DE LA CRUZ ...", "SAN MARTIN ...")
  let surnameEnd = 1;
  if (SURNAME_PARTICLES.has(tokens[0].toUpperCase()) && tokens.length >= 3) {
    surnameEnd = 2;
    if (
      SURNAME_PARTICLES.has(tokens[1].toUpperCase()) &&
      tokens.length >= 4
    ) {
      surnameEnd = 3;
    }
  }

  const apellidos = toTitleCaseEs(tokens.slice(0, surnameEnd).join(" "));
  const nombres = toTitleCaseEs(tokens.slice(surnameEnd).join(" "));
  return { apellidos, nombres };
}

export function computeCandidateCuitsForDni(dniDigits: string): string[] {
  const clean = dniDigits.replace(/\D/g, "").replace(/^0+/, "");
  if (clean.length < 6 || clean.length > 8) return [];
  const dni8 = clean.padStart(8, "0");
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

  const calc = (prefix: string): string | null => {
    const base = `${prefix}${dni8}`;
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += Number(base[i]) * mult[i];
    }
    const mod = sum % 11;
    let dv = 11 - mod;
    if (dv === 11) dv = 0;
    if (dv === 10) return null;
    return `${base}${dv}`;
  };

  const out: string[] = [];
  for (const p of ["20", "27", "23", "24"]) {
    const c = calc(p);
    if (c && !out.includes(c)) out.push(c);
  }
  // En Argentina, si 20/27 da resto 1 (dv=10), el CUIL real usa 23 con dv=9 (M) o dv=4 (F)
  for (const extra of [`23${dni8}9`, `23${dni8}4`]) {
    const base = extra.slice(0, 10);
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += Number(base[i]) * mult[i];
    const mod = sum % 11;
    const dv = mod === 0 ? 0 : 11 - mod;
    if (dv === Number(extra[10]) && !out.includes(extra)) {
      out.push(extra);
    }
  }
  return out;
}

export function formatCuit(cuit11: string): string {
  const c = cuit11.replace(/\D/g, "");
  if (c.length !== 11) return cuit11;
  return `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}`;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 4500,
  acceptJson = false
): Promise<{ ok: boolean; status: number; text: string; url: string }> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": COMMON_UA,
        Accept: acceptJson
          ? "application/json, text/plain, */*"
          : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, url: res.url || url };
  } catch {
    return { ok: false, status: 0, text: "", url };
  }
}

function inferGeneroFromCuit(cuit: string): string {
  if (cuit.startsWith("20")) return "Masculino";
  if (cuit.startsWith("27")) return "Femenino";
  return "";
}

/**
 * Fuente 1: CUITOnline público (búsqueda directa por DNI + detalle de constancia)
 */
async function queryCuitOnlineByDni(
  dniClean: string,
  candidateCuits: string[]
): Promise<ExternalDniPersonResult | null> {
  const dni8 = dniClean.padStart(8, "0");
  const searchRes = await fetchWithTimeout(
    `https://www.cuitonline.com/search.php?q=${encodeURIComponent(dniClean)}`,
    4500,
    false
  );

  if (searchRes.ok && searchRes.text.length > 500) {
    const html = searchRes.text;

    // Extraer bloques hit / personas en search.php
    const blockMatches = html.match(/<div[^>]*class="[^"]*hit[^"]*"[\s\S]*?(?=<div[^>]*class="[^"]*hit[^"]*"|<\/section|<footer|$)/gi) || [html];

    for (const block of blockMatches) {
      // Verificar que este bloque corresponda al DNI exacto (ej: 20-05457050-4 o 27-05457050-9)
      const cuitMatch = block.match(/\b(20|23|24|27)-?(\d{8})-?(\d)\b/);
      if (!cuitMatch) continue;
      const foundDni8 = cuitMatch[2];
      if (foundDni8 !== dni8) continue;

      const cuit11 = `${cuitMatch[1]}${cuitMatch[2]}${cuitMatch[3]}`;

      // Nombre en <h2 class="denominacion"> o itemprop="name" o title="Constancia de Inscripción de ..."
      let rawName = "";
      const mDenom =
        block.match(/class="[^"]*denominacion[^"]*"[^>]*>([\s\S]*?)<\//i) ||
        block.match(/itemprop="name"[^>]*>([\s\S]*?)<\//i) ||
        block.match(/title="Constancia de Inscripci[óo]n de ([^"]+)"/i) ||
        block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
      if (mDenom) {
        rawName = decodeHtmlEntities(mDenom[1].replace(/<[^>]+>/g, " "));
      }

      if (!isValidPersonName(rawName)) continue;

      let localidad = "";
      let provincia = "";
      const mLoc = block.match(/Localidad\s*:\s*([^<\n·•]+)/i);
      if (mLoc) localidad = decodeHtmlEntities(mLoc[1]).toUpperCase();
      const mProv = block.match(/Provincia\s*:\s*([^<\n·•]+)/i);
      if (mProv) provincia = decodeHtmlEntities(mProv[1]).toUpperCase();

      const { apellidos, nombres } = splitArgentinePadronName(rawName);
      return {
        dni: dniClean,
        cuit: cuit11,
        formattedCuit: formatCuit(cuit11),
        razonSocial: rawName.toUpperCase(),
        apellidos,
        nombres,
        nombreCompleto: `${apellidos.toUpperCase()}, ${nombres}`.trim(),
        genero: inferGeneroFromCuit(cuit11),
        localidad,
        provincia,
        source: "cuitonline",
        sourceLabel: "Padrón Público (CUITOnline / ARCA)",
      };
    }

    // Fallback: regex global sobre constancia-inscripcion o enlaces /detalle/<cuit>/slug.html
    for (const cuit of candidateCuits) {
      const reLink = new RegExp(
        `href="[^"]*/detalle/${cuit}/([^./"]+)\\.html"[^>]*>`,
        "i"
      );
      const mLink = html.match(reLink);
      if (mLink && mLink[1]) {
        const slugName = decodeHtmlEntities(mLink[1].replace(/-/g, " "));
        if (isValidPersonName(slugName)) {
          const { apellidos, nombres } = splitArgentinePadronName(slugName);
          return {
            dni: dniClean,
            cuit,
            formattedCuit: formatCuit(cuit),
            razonSocial: slugName.toUpperCase(),
            apellidos,
            nombres,
            nombreCompleto: `${apellidos.toUpperCase()}, ${nombres}`.trim(),
            genero: inferGeneroFromCuit(cuit),
            source: "cuitonline",
            sourceLabel: "Padrón Público (CUITOnline / ARCA)",
          };
        }
      }
    }
  }

  // Intentar detalle directo para los primeros 2 CUITs candidatos (20 y 27)
  const detailResults = await Promise.all(
    candidateCuits.slice(0, 2).map(async (cuit) => {
      const det = await fetchWithTimeout(
        `https://www.cuitonline.com/detalle/${cuit}/`,
        4000,
        false
      );
      if (!det.ok || !det.text) return null;
      const mTitle = det.text.match(
        /<title>\s*(.+?)\s*\(\d{2}-\d{8}-\d\)(?:\s*,\s*([^<(]+?)\s*(?:\(([^)]+)\))?)?\s*-\s*Cuit\s*Online/i
      );
      let rawName = mTitle ? decodeHtmlEntities(mTitle[1]) : "";
      if (!rawName) {
        const mSpan = det.text.match(/<span[^>]*itemprop="name"[^>]*>([\s\S]*?)<\/span>/i);
        if (mSpan) rawName = decodeHtmlEntities(mSpan[1].replace(/<[^>]+>/g, " "));
      }
      if (!isValidPersonName(rawName)) return null;
      const localidad = mTitle?.[2] ? decodeHtmlEntities(mTitle[2]).toUpperCase() : "";
      const provincia = mTitle?.[3] ? decodeHtmlEntities(mTitle[3]).toUpperCase() : "";
      const { apellidos, nombres } = splitArgentinePadronName(rawName);
      return {
        dni: dniClean,
        cuit,
        formattedCuit: formatCuit(cuit),
        razonSocial: rawName.toUpperCase(),
        apellidos,
        nombres,
        nombreCompleto: `${apellidos.toUpperCase()}, ${nombres}`.trim(),
        genero: inferGeneroFromCuit(cuit),
        localidad,
        provincia,
        source: "cuitonline" as const,
        sourceLabel: "Padrón Público (CUITOnline / ARCA)",
      };
    })
  );

  return detailResults.find(Boolean) || null;
}

/**
 * Fuente 2: API Oficial del Banco Central (BCRA — Central de Deudores)
 */
async function queryBcraByCandidateCuits(
  dniClean: string,
  candidateCuits: string[]
): Promise<ExternalDniPersonResult | null> {
  const attempts = candidateCuits.slice(0, 3).flatMap((cuit) => [
    { cuit, url: `https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/${cuit}` },
    { cuit, url: `https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/Historicas/${cuit}` },
  ]);

  const responses = await Promise.all(
    attempts.map(async ({ cuit, url }) => {
      const res = await fetchWithTimeout(url, 3800, true);
      if (!res.ok || !res.text) return null;
      try {
        const json = JSON.parse(res.text) as { results?: { denominacion?: string } };
        const rawName = String(json?.results?.denominacion || "").trim();
        if (!isValidPersonName(rawName)) return null;
        const { apellidos, nombres } = splitArgentinePadronName(rawName);
        return {
          dni: dniClean,
          cuit,
          formattedCuit: formatCuit(cuit),
          razonSocial: rawName.toUpperCase(),
          apellidos,
          nombres,
          nombreCompleto: `${apellidos.toUpperCase()}, ${nombres}`.trim(),
          genero: inferGeneroFromCuit(cuit),
          source: "bcra_oficial" as const,
          sourceLabel: "Padrón Oficial BCRA",
        };
      } catch {
        return null;
      }
    })
  );

  return responses.find(Boolean) || null;
}

/**
 * Fuente 3: Respaldo mediante Motores de Búsqueda Públicos (Bing / Yahoo AR)
 * Útil en servidores cloud (Vercel) si cuitonline bloquea IPs de datacenter.
 */
async function queryPublicSearchEnginesByCuits(
  dniClean: string,
  candidateCuits: string[]
): Promise<ExternalDniPersonResult | null> {
  const queries = candidateCuits.slice(0, 2).flatMap((cuit) => [
    { cuit, url: `https://www.bing.com/search?q=${cuit}+cuitonline` },
    { cuit, url: `https://ar.search.yahoo.com/search?p=${cuit}+cuitonline` },
  ]);

  const results = await Promise.all(
    queries.map(async ({ cuit, url }) => {
      const res = await fetchWithTimeout(url, 4500, false);
      if (!res.ok || !res.text) return null;
      const fmt = formatCuit(cuit);
      const qFmt = fmt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const cleaned = res.text
        .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "\n")
        .replace(/<\/?(?:b|strong|em|i|mark|wbr)\b[^>]*>/gi, "")
        .replace(/<[^>]+>/g, "\n");

      const lines = cleaned
        .split(/\r?\n+/)
        .map((l) => decodeHtmlEntities(l))
        .filter((l) => l.includes(fmt) || l.includes(cuit));

      for (const line of lines) {
        // Patrón título: "APELLIDO NOMBRE (20-05457050-4), Localidad (Provincia) - Cuit Online"
        const reTitle = new RegExp(
          `^(.+?)\\s*\\(\\s*${qFmt}\\s*\\)(?:\\s*,\\s*([^(\\-·•…]+?)(?:\\s*\\(([^)\\-·•…]+)\\s*\\)?)?)?(?:\\s*-\\s*Cuit\\s*Online|\\s*\\.\\.\\.|\\s*…|$)`,
          "i"
        );
        const mT = line.match(reTitle);
        if (mT) {
          const cand = mT[1].replace(/^[›|·•\-\s]+|[›|·•\-\s]+$/g, "").trim();
          if (isValidPersonName(cand)) {
            const { apellidos, nombres } = splitArgentinePadronName(cand);
            return {
              dni: dniClean,
              cuit,
              formattedCuit: fmt,
              razonSocial: cand.toUpperCase(),
              apellidos,
              nombres,
              nombreCompleto: `${apellidos.toUpperCase()}, ${nombres}`.trim(),
              genero: inferGeneroFromCuit(cuit),
              localidad: mT[2] ? mT[2].replace(/[ ,.\-…]+$/g, "").toUpperCase() : "",
              provincia: mT[3] ? mT[3].replace(/[ ,.\-…]+$/g, "").toUpperCase() : "",
              source: "buscador_publico" as const,
              sourceLabel: "Buscador Público (Constancia ARCA)",
            };
          }
        }

        // Patrón snippet: "APELLIDO NOMBRE CUIT: 20054570504 ..."
        const reSnip = new RegExp(`^(.*?)\\bCUIT\\s*:\\s*${cuit}\\b`, "i");
        const mS = line.match(reSnip);
        if (mS) {
          const cand = mS[1].replace(/^[›|·•\-\s]+|[›|·•\-\s]+$/g, "").trim();
          if (isValidPersonName(cand)) {
            const { apellidos, nombres } = splitArgentinePadronName(cand);
            return {
              dni: dniClean,
              cuit,
              formattedCuit: fmt,
              razonSocial: cand.toUpperCase(),
              apellidos,
              nombres,
              nombreCompleto: `${apellidos.toUpperCase()}, ${nombres}`.trim(),
              genero: inferGeneroFromCuit(cuit),
              source: "buscador_publico" as const,
              sourceLabel: "Buscador Público (Constancia ARCA)",
            };
          }
        }
      }
      return null;
    })
  );

  return results.find(Boolean) || null;
}

export interface ExternalTaxpayerResult {
  cuit: string;
  formattedCuit: string;
  razonSocial: string;
  nombre: string;
  respIva:
    | "INSCRIPTO"
    | "MONOTRIBUTO"
    | "EXENTO"
    | "CONSUMIDOR FINAL"
    | "IVA NO ALCANZADO"
    | "NO INSCRIPTO";
  idRespIva: number;
  calle: string;
  numero: string;
  piso?: string;
  dpto?: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  cp: string;
  tipoPersona: "FISICA" | "JURIDICA";
  source: "arca_oficial" | "cuitonline" | "bcra_oficial" | "buscador_publico";
  sourceLabel: string;
}

const taxpayerCache = new Map<
  string,
  { exp: number; data: ExternalTaxpayerResult | null }
>();

function isValidTaxpayerEntityName(name: string): boolean {
  const clean = String(name || "").trim();
  if (clean.length < 3 || clean.length > 140) return false;
  if (INVALID_NAME_RE.test(clean)) return false;
  return /^[A-ZÁÉÍÓÚÑÜa-záéíóúñü0-9\s.,'&()/\-°º]+$/u.test(clean);
}

function inferRespIvaFromTextAndCuit(
  cuit11: string,
  razonSocial: string,
  rawHtmlOrSnippet = ""
): { respIva: ExternalTaxpayerResult["respIva"]; idRespIva: number } {
  const text = String(rawHtmlOrSnippet || "");
  const upperName = String(razonSocial || "").toUpperCase();

  if (
    /IVA\s*:\s*Exento|Sujeto\s+Exento|IVA\s+Exento/i.test(text) ||
    (/\b(?:ASOCIACION|ASOC\.|FUNDACION|BIBLIOTECA|MUNICIPALIDAD|COMUNA|MINISTERIO|GOBIERNO|OBISPADO|PARROQUIA|IGLESIA|UNIVERSIDAD|ESCUELA|COLEGIO|MUTUAL|SINDICATO|BOMBEROS)\b/i.test(
      upperName
    ) &&
      !/\b(?:S\.?A\.?|S\.?R\.?L\.?|S\.?A\.?S\.?)\b/i.test(upperName))
  ) {
    return { respIva: "EXENTO", idRespIva: 5 };
  }

  if (
    /Monotributo\s*:\s*[A-Z0-9]|Responsable\s+Monotributo|Categor[ií]a\s+Monotributo|Adherido\s+al\s+Monotributo/i.test(
      text
    )
  ) {
    return { respIva: "MONOTRIBUTO", idRespIva: 2 };
  }

  if (
    /IVA\s*:\s*(?:Responsable\s+)?Inscripto|IVA\s+Responsable\s+Inscripto/i.test(
      text
    )
  ) {
    return { respIva: "INSCRIPTO", idRespIva: 4 };
  }

  // Personas jurídicas comerciales (prefijos 30, 33, 34: S.A., S.R.L., S.A.S., Cooperativas, etc.)
  if (/^(30|33|34)/.test(cuit11)) {
    return { respIva: "INSCRIPTO", idRespIva: 4 };
  }

  return { respIva: "CONSUMIDOR FINAL", idRespIva: 1 };
}

function splitStreetAndNumber(rawAddress: string): {
  calle: string;
  numero: string;
  domicilio: string;
} {
  const clean = String(rawAddress || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  if (!clean) return { calle: "", numero: "", domicilio: "" };
  const m = clean.match(/^(.+?)\s+(\d{1,6})\b(.*)$/);
  if (m) {
    const rest = m[3] ? ` ${m[3].trim()}` : "";
    return {
      calle: `${m[1].trim()}${rest}`,
      numero: m[2],
      domicilio: clean,
    };
  }
  return { calle: clean, numero: "S/N", domicilio: clean };
}

async function queryCuitOnlineTaxpayer(
  candidateCuits: string[]
): Promise<ExternalTaxpayerResult | null> {
  const detailResults = await Promise.all(
    candidateCuits.slice(0, 2).map(async (cuit) => {
      const [detHit, searchHit] = await Promise.all([
        queryCuitOnlineDetailForCuit(cuit).catch(() => null),
        queryCuitOnlineSearchForCuit(cuit).catch(() => null),
      ]);
      const upperRazon = detHit?.razonSocial || searchHit?.razonSocial || "";
      if (!upperRazon) return null;

      const addr = parseArgentineStreetAddress(detHit?.domicilioRaw || "");
      const { respIva, idRespIva } = mapIvaTextToErp(
        searchHit?.ivaRaw || "",
        searchHit?.monoRaw || "",
        cuit
      );
      const tipoPersona: "FISICA" | "JURIDICA" =
        detHit?.tipoPersona === "JURIDICA" || searchHit?.tipoPersona === "JURIDICA"
          ? "JURIDICA"
          : detHit?.tipoPersona === "FISICA" || searchHit?.tipoPersona === "FISICA"
            ? "FISICA"
            : /^(30|33|34)/.test(cuit)
              ? "JURIDICA"
              : "FISICA";

      return {
        cuit,
        formattedCuit: formatCuit(cuit),
        razonSocial: upperRazon,
        nombre: upperRazon,
        respIva,
        idRespIva,
        calle: addr.calle,
        numero: addr.calle ? addr.numero || "S/N" : "",
        piso: addr.piso,
        dpto: addr.dpto,
        domicilio: detHit?.domicilioRaw ? detHit.domicilioRaw.toUpperCase() : "",
        localidad: detHit?.localidad || "",
        provincia: detHit?.provincia || "",
        cp: addr.cp,
        tipoPersona,
        source: "cuitonline" as const,
        sourceLabel: "Constancia Padrón ARCA (CUITOnline)",
      };
    })
  );

  return detailResults.find(Boolean) || null;
}

async function queryBcraTaxpayer(
  candidateCuits: string[]
): Promise<ExternalTaxpayerResult | null> {
  const attempts = candidateCuits.slice(0, 3).flatMap((cuit) => [
    { cuit, url: `https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/${cuit}` },
    {
      cuit,
      url: `https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/Historicas/${cuit}`,
    },
  ]);

  const responses = await Promise.all(
    attempts.map(async ({ cuit, url }) => {
      const res = await fetchWithTimeout(url, 3800, true);
      if (!res.ok || !res.text) return null;
      try {
        const json = JSON.parse(res.text) as {
          results?: { denominacion?: string };
        };
        const rawName = String(json?.results?.denominacion || "").trim();
        if (!isValidTaxpayerEntityName(rawName)) return null;
        const upperRazon = rawName.toUpperCase();
        const { respIva, idRespIva } = inferRespIvaFromTextAndCuit(
          cuit,
          upperRazon,
          ""
        );
        return {
          cuit,
          formattedCuit: formatCuit(cuit),
          razonSocial: upperRazon,
          nombre: upperRazon,
          respIva,
          idRespIva,
          calle: "",
          numero: "",
          domicilio: "",
          localidad: "",
          provincia: "",
          cp: "",
          tipoPersona: /^(30|33|34)/.test(cuit)
            ? ("JURIDICA" as const)
            : ("FISICA" as const),
          source: "bcra_oficial" as const,
          sourceLabel: "Padrón Oficial BCRA / ARCA",
        };
      } catch {
        return null;
      }
    })
  );

  return responses.find(Boolean) || null;
}

async function querySearchEnginesTaxpayer(
  candidateCuits: string[]
): Promise<ExternalTaxpayerResult | null> {
  const queries = candidateCuits.slice(0, 2).flatMap((cuit) => [
    { cuit, url: `https://www.bing.com/search?q=${cuit}+cuitonline` },
    { cuit, url: `https://ar.search.yahoo.com/search?p=${cuit}+cuitonline` },
  ]);

  const results = await Promise.all(
    queries.map(async ({ cuit, url }) => {
      const res = await fetchWithTimeout(url, 4500, false);
      if (!res.ok || !res.text) return null;
      const fmt = formatCuit(cuit);
      const qFmt = fmt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const cleaned = res.text
        .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "\n")
        .replace(/<\/?(?:b|strong|em|i|mark|wbr)\b[^>]*>/gi, "")
        .replace(/<[^>]+>/g, "\n");

      const lines = cleaned
        .split(/\r?\n+/)
        .map((l) => decodeHtmlEntities(l))
        .filter((l) => l.includes(fmt) || l.includes(cuit));

      const fullSnippet = lines.join(" · ");

      for (const line of lines) {
        const reTitle = new RegExp(
          `^(.+?)\\s*\\(\\s*${qFmt}\\s*\\)(?:\\s*,\\s*([^(\\-·•…]+?)(?:\\s*\\(([^)\\-·•…]+)\\s*\\)?)?)?(?:\\s*-\\s*Cuit\\s*Online|\\s*\\.\\.\\.|\\s*…|$)`,
          "i"
        );
        const mT = line.match(reTitle);
        if (mT) {
          const cand = mT[1].replace(/^[›|·•\-\s]+|[›|·•\-\s]+$/g, "").trim();
          if (isValidTaxpayerEntityName(cand)) {
            const upperRazon = cand.toUpperCase();
            const { respIva, idRespIva } = inferRespIvaFromTextAndCuit(
              cuit,
              upperRazon,
              fullSnippet
            );
            return {
              cuit,
              formattedCuit: fmt,
              razonSocial: upperRazon,
              nombre: upperRazon,
              respIva,
              idRespIva,
              calle: "",
              numero: "",
              domicilio: "",
              localidad: mT[2] ? mT[2].replace(/[ ,.\-…]+$/g, "").toUpperCase() : "",
              provincia: mT[3] ? mT[3].replace(/[ ,.\-…]+$/g, "").toUpperCase() : "",
              cp: "",
              tipoPersona: /^(30|33|34)/.test(cuit)
                ? ("JURIDICA" as const)
                : ("FISICA" as const),
              source: "buscador_publico" as const,
              sourceLabel: "Constancia Pública ARCA",
            };
          }
        }
      }
      return null;
    })
  );

  return results.find(Boolean) || null;
}

/**
 * Consulta unificada de Contribuyente (Persona Física o Jurídica 30/33/34) por CUIT o DNI
 * para facturación rápida a "Cliente Ocasional" y alta de fichas en el ERP.
 */
export async function lookupArgentineTaxpayerByCuitOrDni(
  cuitOrDniRaw: string
): Promise<ExternalTaxpayerResult | null> {
  const digits = String(cuitOrDniRaw || "").replace(/\D/g, "");
  if (digits.length < 7) return null;

  let candidateCuits: string[] = [];
  if (digits.length === 11) {
    candidateCuits = [digits];
  } else {
    candidateCuits = computeCandidateCuitsForDni(digits);
  }
  if (candidateCuits.length === 0) return null;

  const cacheKey = `tax:${digits}`;
  const cached = taxpayerCache.get(cacheKey);
  if (cached && cached.exp > Date.now()) {
    return cached.data;
  }

  const [cuitOnlineHit, bcraHit] = await Promise.all([
    queryCuitOnlineTaxpayer(candidateCuits),
    queryBcraTaxpayer(candidateCuits),
  ]);

  let resolved: ExternalTaxpayerResult | null = cuitOnlineHit || bcraHit;
  // Si BCRA respondió primero pero CUITOnline trajo localidad/domicilio, enriquecer
  if (cuitOnlineHit && bcraHit) {
    resolved = {
      ...bcraHit,
      ...cuitOnlineHit,
      localidad: cuitOnlineHit.localidad || bcraHit.localidad,
      provincia: cuitOnlineHit.provincia || bcraHit.provincia,
      domicilio: cuitOnlineHit.domicilio || bcraHit.domicilio,
      calle: cuitOnlineHit.calle || bcraHit.calle,
      numero: cuitOnlineHit.numero || bcraHit.numero,
    };
  }

  if (!resolved) {
    resolved = await querySearchEnginesTaxpayer(candidateCuits);
  }

  taxpayerCache.set(cacheKey, {
    exp: Date.now() + (resolved ? CACHE_TTL_MS : 1000 * 60 * 5),
    data: resolved,
  });

  return resolved;
}

/**
 * Consulta externa unificada por DNI o CUIT argentino:
 * Corre en paralelo CUITOnline + BCRA Oficial, y si ninguno responde (ej. IP cloud),
 * recurre automáticamente a motores de búsqueda públicos (Bing / Yahoo AR).
 */
export async function lookupExternalArgentinePersonByDni(
  dniOrCuitRaw: string
): Promise<ExternalDniPersonResult | null> {
  const digits = String(dniOrCuitRaw || "").replace(/\D/g, "");
  if (digits.length < 6) return null;

  let dniClean = digits;
  let candidateCuits: string[] = [];

  if (digits.length === 11) {
    candidateCuits = [digits];
    dniClean = digits.slice(2, 10).replace(/^0+/, "");
  } else {
    dniClean = digits.replace(/^0+/, "");
    candidateCuits = computeCandidateCuitsForDni(dniClean);
  }

  if (!dniClean || candidateCuits.length === 0) return null;

  const cacheKey = `dni:${dniClean}`;
  const cached = lookupCache.get(cacheKey);
  if (cached && cached.exp > Date.now()) {
    return cached.data;
  }

  // Etapa 1: Consultar en paralelo CUITOnline directo + BCRA Oficial
  const [cuitOnlineHit, bcraHit] = await Promise.all([
    queryCuitOnlineByDni(dniClean, candidateCuits),
    queryBcraByCandidateCuits(dniClean, candidateCuits),
  ]);

  let resolved: ExternalDniPersonResult | null = cuitOnlineHit || bcraHit;

  // Etapa 2: Respaldo con motores de búsqueda públicos (Bing / Yahoo AR)
  if (!resolved) {
    resolved = await queryPublicSearchEnginesByCuits(dniClean, candidateCuits);
  }

  // Guardar en caché (positivo 24h, negativo 5 min para permitir reintentos)
  lookupCache.set(cacheKey, {
    exp: Date.now() + (resolved ? CACHE_TTL_MS : 1000 * 60 * 5),
    data: resolved,
  });

  return resolved;
}

// ============================================================================
// MOTOR DE BÚSQUEDA COMPLETO DE CUIT (PERSONAS FÍSICAS Y JURÍDICAS)
// Extrae Razón Social, Condición frente al IVA, Domicilio Fiscal (Calle, Altura,
// Piso, Depto), Localidad, Provincia y C.P. desde fuentes públicas + BCRA.
// ============================================================================

export interface ExternalCuitTaxpayerResult {
  cuit: string;
  formattedCuit: string;
  razonSocial: string;
  tipoPersona: "JURIDICA" | "FISICA" | "";
  respIva: string;
  idRespIva: number;
  calle: string;
  numero: string;
  piso: string;
  dpto: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  cp: string;
  nroIibb: string;
  jurisdiccionIibb: string;
  source: string;
  sourceLabel: string;
}

const cuitLookupCache = new Map<
  string,
  { exp: number; data: ExternalCuitTaxpayerResult | null }
>();

export function validateCuitMod11(cuitRaw: string): boolean {
  const c = String(cuitRaw || "").replace(/\D/g, "");
  if (c.length !== 11 || /^0+$/.test(c)) return false;
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(c[i]) * mult[i];
  }
  const mod = sum % 11;
  let dv = 11 - mod;
  if (dv === 11) dv = 0;
  if (dv === 10) dv = 9;
  return dv === Number(c[10]);
}

function isValidTaxpayerName(name: string): boolean {
  const clean = String(name || "").trim();
  if (clean.length < 3 || clean.length > 140) return false;
  if (INVALID_NAME_RE.test(clean)) return false;
  // Rechazar cadenas ofuscadas sin vocales o con demasiadas consonantes seguidas
  const letters = clean.replace(/[^A-ZÁÉÍÓÚÑÜa-záéíóúñü]/g, "");
  if (letters.length < 3) return false;
  const vowels = letters.match(/[AEIOUÁÉÍÓÚÜaeiouáéíóúü]/g) || [];
  if (vowels.length === 0) return false;
  if (/[BCDFGHJKLMNPQRSTVWXYZ]{6,}/i.test(clean)) return false;
  return /^[A-ZÁÉÍÓÚÑÜa-záéíóúñü0-9\s.,&'"()\/-]+$/u.test(clean);
}

function normalizeProvinceName(raw: string): string {
  const clean = String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  if (
    clean === "CABA" ||
    clean === "CAPITAL FEDERAL" ||
    clean === "CIUDAD AUTONOMA DE BUENOS AIRES" ||
    clean === "CIUDAD DE BUENOS AIRES" ||
    clean === "AUTONOMA DE BUENOS AIRES"
  ) {
    return "CIUDAD AUTÓNOMA DE BUENOS AIRES";
  }
  const map: Record<string, string> = {
    "BUENOS AIRES": "BUENOS AIRES",
    "PROVINCIA DE BUENOS AIRES": "BUENOS AIRES",
    "BS AS": "BUENOS AIRES",
    "PCIA BS AS": "BUENOS AIRES",
    CORDOBA: "CÓRDOBA",
    "SANTA FE": "SANTA FE",
    "ENTRE RIOS": "ENTRE RÍOS",
    "LA PAMPA": "LA PAMPA",
    "SANTIAGO DEL ESTERO": "SANTIAGO DEL ESTERO",
    CHACO: "CHACO",
    SALTA: "SALTA",
    TUCUMAN: "TUCUMÁN",
    "SAN LUIS": "SAN LUIS",
    CORRIENTES: "CORRIENTES",
    MISIONES: "MISIONES",
    MENDOZA: "MENDOZA",
    "SAN JUAN": "SAN JUAN",
    "LA RIOJA": "LA RIOJA",
    CATAMARCA: "CATAMARCA",
    JUJUY: "JUJUY",
    FORMOSA: "FORMOSA",
    NEUQUEN: "NEUQUÉN",
    "RIO NEGRO": "RÍO NEGRO",
    CHUBUT: "CHUBUT",
    "SANTA CRUZ": "SANTA CRUZ",
    "TIERRA DEL FUEGO": "TIERRA DEL FUEGO",
  };
  return map[clean] || String(raw || "").trim().toUpperCase();
}

export function parseArgentineStreetAddress(rawDom: string): {
  calle: string;
  numero: string;
  piso: string;
  dpto: string;
  cp: string;
} {
  let work = String(rawDom || "").replace(/\s+/g, " ").trim();
  if (!work) return { calle: "", numero: "", piso: "", dpto: "", cp: "" };

  let cp = "";
  const mCp = work.match(/\b(?:C\.?P\.?|CP)\s*:?\s*([A-Z]?\d{4}[A-Z]{0,3})\b/i);
  if (mCp) {
    cp = mCp[1].replace(/\D/g, "").slice(0, 4);
    work = work.replace(mCp[0], " ").trim();
  }

  let piso = "";
  const mPiso = work.match(/\b(?:PISO\s*:?\s*|P\.\s*:\s*|P\.\s*)(\d{1,3}|PB|SS|EP)\b/i);
  if (mPiso) {
    piso = mPiso[1].toUpperCase();
    work = work.replace(mPiso[0], " ").trim();
  }

  let dpto = "";
  const mDpto = work.match(
    /\b(?:DPTO\.?|DEPTO\.?|DTO\.?|OFICINA|OF\.?|LOCAL|LOC\.)\s*:?\s*([0-9A-Z]{1,6})\b/i
  );
  if (mDpto) {
    dpto = mDpto[1].toUpperCase();
    work = work.replace(mDpto[0], " ").trim();
  }

  work = work.replace(/[,\-\s]+$/g, "").replace(/\s+/g, " ").trim();

  let calle = work.toUpperCase();
  let numero = "S/N";

  // Patrón típico argentino: "ARROYO 894", "AV. SANTA FE 1234", "25 DE MAYO 450", "SAN MARTIN S/N"
  const mNumEnd = work.match(/^(.+?)\s+(?:N[°º.]?\s*)?(\d{1,6}|S\/N)$/i);
  if (mNumEnd) {
    calle = mNumEnd[1].replace(/[,\-\s]+$/g, "").trim().toUpperCase();
    numero = mNumEnd[2].toUpperCase();
  } else {
    const mNumMid = work.match(/^(.+?)\s+(\d{1,6})\b(.*)$/);
    if (mNumMid && mNumMid[1].trim().length >= 2) {
      calle = mNumMid[1].replace(/[,\-\s]+$/g, "").trim().toUpperCase();
      numero = mNumMid[2];
    }
  }

  return { calle, numero, piso, dpto, cp };
}

function mapIvaTextToErp(ivaRaw: string, monoRaw: string, cuit11: string): {
  respIva: ExternalTaxpayerResult["respIva"];
  idRespIva: number;
} {
  const iva = String(ivaRaw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
  const mono = String(monoRaw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

  if (mono && !/\b(NO|BAJA|INACTIVO)\b/.test(mono)) {
    return { respIva: "MONOTRIBUTO", idRespIva: 2 };
  }
  if (iva) {
    if (/EXENTO/.test(iva)) return { respIva: "EXENTO", idRespIva: 5 };
    if (/NO\s+ALCANZADO/.test(iva)) return { respIva: "IVA NO ALCANZADO", idRespIva: 3 };
    if (/NO\s+INSCRIPTO/.test(iva)) return { respIva: "NO INSCRIPTO", idRespIva: 7 };
    if (/MONOTRIB/.test(iva)) return { respIva: "MONOTRIBUTO", idRespIva: 2 };
    if (/INSCRIPTO/.test(iva)) return { respIva: "INSCRIPTO", idRespIva: 4 };
    if (/CONSUMIDOR\s+FINAL/.test(iva)) return { respIva: "CONSUMIDOR FINAL", idRespIva: 1 };
  }
  // Sociedades (30/33/34) por defecto suelen ser Responsable Inscripto
  if (/^(30|33|34)/.test(cuit11)) {
    return { respIva: "INSCRIPTO", idRespIva: 4 };
  }
  return { respIva: "CONSUMIDOR FINAL", idRespIva: 1 };
}

async function queryCuitOnlineDetailForCuit(cuit11: string): Promise<{
  razonSocial: string;
  tipoPersona: "JURIDICA" | "FISICA" | "";
  domicilioRaw: string;
  localidad: string;
  provincia: string;
} | null> {
  const det = await fetchWithTimeout(
    `https://www.cuitonline.com/detalle/${cuit11}/`,
    4800,
    false
  );
  if (!det.ok || !det.text) return null;
  const html = det.text;

  let razonSocial = "";
  let tipoPersona: "JURIDICA" | "FISICA" | "" = "";
  let domicilioRaw = "";
  let localidad = "";
  let provincia = "";

  // 1) Parsear <title>: "TALENTUM STRATEGIC PARTNERS S.A. (30-70832641-7), C.A.B.A. - Cuit Online"
  //    o "BIANCHI MARIA ESTHER (27-05457050-9), Alcira Gigena (Córdoba) - Cuit Online"
  const mTitle = html.match(
    /<title>\s*(.+?)\s*\(\d{2}-\d{8}-\d\)(?:\s*,\s*([^<(]+?)(?:\s*\(([^)]+)\))?)?\s*-\s*Cuit\s*Online/i
  );
  if (mTitle) {
    const cand = decodeHtmlEntities(mTitle[1]);
    if (isValidTaxpayerName(cand)) razonSocial = cand.toUpperCase();
    const locOrProv = mTitle[2] ? decodeHtmlEntities(mTitle[2]).trim() : "";
    const parenProv = mTitle[3] ? decodeHtmlEntities(mTitle[3]).trim() : "";
    if (parenProv) {
      localidad = locOrProv.toUpperCase();
      provincia = normalizeProvinceName(parenProv);
    } else if (locOrProv) {
      const normP = normalizeProvinceName(locOrProv);
      if (normP === "CIUDAD AUTÓNOMA DE BUENOS AIRES") {
        provincia = normP;
        localidad = normP;
      } else {
        localidad = locOrProv.toUpperCase();
      }
    }
  }

  // 2) Parsear <meta name="description" content="TALENTUM STRATEGIC PARTNERS SA · CUIT: 30708326417 · Persona Jurídica · arroyo 894 · Localidad: Ciudad Autónoma de Buenos Aires" />
  const mDesc =
    html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i) ||
    html.match(/<meta[^>]+content="([^"]*)"[^>]+name="description"/i);
  if (mDesc && mDesc[1]) {
    const desc = decodeHtmlEntities(mDesc[1]);
    const parts = desc
      .split(/\s*(?:·|\u00b7|\|)\s*/)
      .map((p) => p.trim())
      .filter(Boolean);

    parts.forEach((seg, idx) => {
      if (idx === 0 && !razonSocial && isValidTaxpayerName(seg)) {
        razonSocial = seg.toUpperCase();
        return;
      }
      if (/^CUIT\s*:/i.test(seg)) return;
      if (/Persona\s+Jur[íi]dica/i.test(seg)) {
        tipoPersona = "JURIDICA";
        return;
      }
      if (/Persona\s+F[íi]sica/i.test(seg)) {
        tipoPersona = "FISICA";
        return;
      }
      const mLoc = seg.match(/^Localidad\s*:\s*(.+)$/i);
      if (mLoc) {
        const locVal = mLoc[1].trim();
        const normProv = normalizeProvinceName(locVal);
        if (normProv === "CIUDAD AUTÓNOMA DE BUENOS AIRES") {
          provincia = normProv;
          localidad = normProv;
        } else {
          localidad = locVal.toUpperCase();
        }
        return;
      }
      const mProv = seg.match(/^Provincia\s*:\s*(.+)$/i);
      if (mProv) {
        provincia = normalizeProvinceName(mProv[1]);
        return;
      }
      // Segmento de dirección fiscal (ej: "arroyo 894", "av. san martin 450", "bv. roca 1200 piso 2")
      if (
        idx > 0 &&
        !domicilioRaw &&
        !/^(Actividad|Ganancias|IVA|Monotributo|Empleador|Constancia|Ver\s)/i.test(seg) &&
        seg.length >= 3 &&
        seg.length <= 120
      ) {
        domicilioRaw = seg;
      }
    });
  }

  if (!razonSocial) return null;
  return { razonSocial, tipoPersona, domicilioRaw, localidad, provincia };
}

async function queryCuitOnlineSearchForCuit(cuit11: string): Promise<{
  razonSocial: string;
  tipoPersona: "JURIDICA" | "FISICA" | "";
  ivaRaw: string;
  monoRaw: string;
} | null> {
  const res = await fetchWithTimeout(
    `https://www.cuitonline.com/search.php?q=${encodeURIComponent(cuit11)}`,
    4800,
    false
  );
  if (!res.ok || !res.text) return null;
  const html = res.text;
  const fmt = formatCuit(cuit11);
  const idx = html.indexOf(fmt);
  if (idx < 0) return null;

  const block = html.slice(Math.max(0, idx - 300), idx + 1500);

  let razonSocial = "";
  const mConstTitle = block.match(/title="Constancia de Inscripci[óo]n de ([^"]+)"/i);
  if (mConstTitle && mConstTitle[1]) {
    const cand = decodeHtmlEntities(mConstTitle[1]);
    if (isValidTaxpayerName(cand)) razonSocial = cand.toUpperCase();
  }

  const plainBlock = decodeHtmlEntities(block.replace(/<[^>]+>/g, "\n"));
  let tipoPersona: "JURIDICA" | "FISICA" | "" = "";
  if (/Persona\s+Jur[íi]dica/i.test(plainBlock)) tipoPersona = "JURIDICA";
  else if (/Persona\s+F[íi]sica/i.test(plainBlock)) tipoPersona = "FISICA";

  const mIva = plainBlock.match(/IVA\s*:\s*([^\n]+)/i);
  const mMono = plainBlock.match(/Monotributo[^\n]*/i);

  return {
    razonSocial,
    tipoPersona,
    ivaRaw: mIva ? mIva[1].trim() : "",
    monoRaw: mMono ? mMono[0].trim() : "",
  };
}

async function queryBcraForCuit(cuit11: string): Promise<string> {
  const urls = [
    `https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/${cuit11}`,
    `https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/Historicas/${cuit11}`,
  ];
  const resList = await Promise.all(
    urls.map(async (url) => {
      const r = await fetchWithTimeout(url, 4000, true);
      if (!r.ok || !r.text) return "";
      try {
        const json = JSON.parse(r.text) as { results?: { denominacion?: string } };
        const name = String(json?.results?.denominacion || "").trim();
        return isValidTaxpayerName(name) ? name.toUpperCase() : "";
      } catch {
        return "";
      }
    })
  );
  return resList.find(Boolean) || "";
}

/**
 * Consulta externa unificada de CUIT (Personas Físicas y Jurídicas: 20/23/24/27/30/33/34).
 * Combina en paralelo CUITOnline Detalle (Razón Social + Domicilio + Localidad + Provincia),
 * CUITOnline Búsqueda (Condición frente al IVA / Monotributo) y BCRA Oficial (Razón Social oficial).
 */
export async function lookupExternalArgentineCuit(
  cuitRaw: string
): Promise<ExternalCuitTaxpayerResult | null> {
  const cuit11 = String(cuitRaw || "").replace(/\D/g, "");
  if (cuit11.length !== 11 || !validateCuitMod11(cuit11)) return null;

  const cacheKey = `cuit:${cuit11}`;
  const cached = cuitLookupCache.get(cacheKey);
  if (cached && cached.exp > Date.now()) {
    return cached.data;
  }

  const [detHit, searchHit, bcraName] = await Promise.all([
    queryCuitOnlineDetailForCuit(cuit11).catch(() => null),
    queryCuitOnlineSearchForCuit(cuit11).catch(() => null),
    queryBcraForCuit(cuit11).catch(() => ""),
  ]);

  const razonSocial =
    detHit?.razonSocial || searchHit?.razonSocial || bcraName || "";

  if (!razonSocial) {
    cuitLookupCache.set(cacheKey, {
      exp: Date.now() + 1000 * 60 * 2,
      data: null,
    });
    return null;
  }

  const tipoPersona: "JURIDICA" | "FISICA" | "" =
    detHit?.tipoPersona ||
    searchHit?.tipoPersona ||
    (/^(30|33|34)/.test(cuit11) ? "JURIDICA" : "FISICA");

  const { respIva, idRespIva } = mapIvaTextToErp(
    searchHit?.ivaRaw || "",
    searchHit?.monoRaw || "",
    cuit11
  );

  const addr = parseArgentineStreetAddress(detHit?.domicilioRaw || "");
  const formattedCuit = formatCuit(cuit11);
  const provincia = detHit?.provincia || "";
  const localidad = detHit?.localidad || "";

  const sourceParts: string[] = [];
  if (detHit) sourceParts.push("Padrón ARCA / CUITOnline");
  else if (searchHit) sourceParts.push("Constancia ARCA");
  if (bcraName && !detHit) sourceParts.push("BCRA Oficial");

  const result: ExternalCuitTaxpayerResult = {
    cuit: cuit11,
    formattedCuit,
    razonSocial: razonSocial.toUpperCase(),
    tipoPersona,
    respIva,
    idRespIva,
    calle: addr.calle,
    numero: addr.calle ? addr.numero || "S/N" : "",
    piso: addr.piso,
    dpto: addr.dpto,
    domicilio: detHit?.domicilioRaw ? detHit.domicilioRaw.toUpperCase() : "",
    localidad,
    provincia,
    cp: addr.cp,
    nroIibb: formattedCuit,
    jurisdiccionIibb: provincia,
    source: detHit || searchHit ? "padron_arca_publico" : "bcra_oficial",
    sourceLabel: sourceParts.join(" + ") || "Padrón Público ARCA",
  };

  cuitLookupCache.set(cacheKey, {
    exp: Date.now() + CACHE_TTL_MS,
    data: result,
  });

  return result;
}
