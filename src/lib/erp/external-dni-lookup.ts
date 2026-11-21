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
