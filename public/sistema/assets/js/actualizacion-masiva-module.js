/* ============================================================================
 * MÓDULO: ACTUALIZACIÓN MASIVA DE PRECIOS (MiniSistema / Casa Nueva ERP)
 * Submódulos:
 *  1) Por Lista de Precios (PDF multipágina, Excel, CSV, TXT — ej. Borselli/ARCOR)
 *  2) Por Porcentaje y Secciones (Proveedor/Rubro/Marca + PDF Variaciones por Sección)
 *  3) Producto por Producto (Grilla rápida editable con guardado en lote)
 * ============================================================================ */
(function initActualizacionMasivaModule() {
  'use strict';

  const AM_STATE = {
    initialized: false,
    // Submódulo 1: Lista de precios
    listaRows: [],
    listaFileName: '',
    listaPagesCount: 0,
    // Submódulo 2: Porcentaje y secciones
    rules: [],
    pctPreviewRows: [],
    // Submódulo 3: Grilla producto por producto
    gridPage: 1,
    gridPageSize: 50,
    gridDrafts: new Map(), // artId -> { cn, cfn, p1n, p1f, p2n, p2f, m1, m2, iv, iva, pctInput }
    // Deshacer último lote aplicado (en memoria de sesión)
    lastUndoBatch: null // { label, at, snapshots: [{ id, cn, cfn, p1n, p1f, p2n, p2f, m1, m2, iv, iva, pfid }] }
  };

  function getBridge() {
    return window.__ERP_AM_BRIDGE__ || null;
  }

  function getState() {
    const b = getBridge();
    return b && typeof b.getState === 'function' ? b.getState() : { articulos: [], rubros: [], marcas: [], proveedores: [], configuracionesPrecios: [], configPreciosMap: new Map() };
  }

  function r2(v) {
    return Math.round((Number(v) || 0) * 100) / 100;
  }

  function fmtMoney(v) {
    const b = getBridge();
    if (b && typeof b.formatArs === 'function') return `$ ${b.formatArs(v)}`;
    return `$ ${(Number(v) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function esc(s) {
    const b = getBridge();
    if (b && typeof b.escapeHtml === 'function') return b.escapeHtml(s);
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normStr(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normCode(c) {
    const clean = String(c || '').trim().toUpperCase().replace(/^#/, '');
    if (!clean) return '';
    if (/^\d+$/.test(clean)) return String(parseInt(clean, 10));
    return clean;
  }

  function parseArNumber(raw) {
    const s = String(raw ?? '')
      .replace(/^\$\s*/, '')
      .replace(/%$/, '')
      .replace(/\s+/g, '')
      .trim();
    if (!s) return NaN;
    if (s.includes(',') && s.includes('.')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        return parseFloat(s.replace(/\./g, '').replace(',', '.'));
      }
      return parseFloat(s.replace(/,/g, ''));
    }
    if (s.includes(',')) {
      return parseFloat(s.replace(',', '.'));
    }
    if (/^\d{1,3}(?:\.\d{3}){2,}$/.test(s)) {
      return parseFloat(s.replace(/\./g, ''));
    }
    return parseFloat(s);
  }

  function applySaleRounding(val, step) {
    const n = Math.max(0, Number(val) || 0);
    const st = Number(step) || 0;
    if (st <= 0) return r2(n);
    return r2(Math.round(n / st) * st);
  }

  function resolveEffectiveIvaAndMargins(art) {
    const b = getBridge();
    const st = getState();
    const effIva = b && typeof b.resolveArticleEffectiveIva === 'function'
      ? b.resolveArticleEffectiveIva(art)
      : { id: Number(art?.iv) || 5, porcentaje: Number(art?.iva ?? 21) };
    const ivaPct = Number(effIva?.porcentaje ?? 21);
    const ivaId = Number(effIva?.id) || 5;

    let m1 = r2(art?.m1 ?? 49);
    let m2 = r2(art?.m2 ?? 18);
    if (Number(art?.ucp) === 1 && Number(art?.cp) > 0 && st.configPreciosMap && st.configPreciosMap.has(Number(art.cp))) {
      const cfg = st.configPreciosMap.get(Number(art.cp));
      if (cfg) {
        m1 = r2(cfg.margenMinorista);
        m2 = r2(cfg.margenMayorista);
      }
    }
    return { ivaId, ivaPct, ivaFrac: ivaPct / 100, m1, m2 };
  }

  function computeArticlePricingFromCost(art, rawCostVal, modoIva = 'neto', roundingStep = 0) {
    const { ivaId, ivaPct, ivaFrac, m1, m2 } = resolveEffectiveIvaAndMargins(art);
    const cost = Math.max(0, Number(rawCostVal) || 0);
    const cn = modoIva === 'neto' ? r2(cost) : r2(cost / (1 + ivaFrac));
    const cfn = modoIva === 'final' ? r2(cost) : r2(cn * (1 + ivaFrac));

    let p1n = r2(cn * (1 + m1 / 100));
    let p1f = applySaleRounding(p1n * (1 + ivaFrac), roundingStep);
    if (Number(roundingStep) > 0) {
      p1n = r2(p1f / (1 + ivaFrac));
    }

    let p2n = r2(cn * (1 + m2 / 100));
    let p2f = applySaleRounding(p2n * (1 + ivaFrac), roundingStep);
    if (Number(roundingStep) > 0) {
      p2n = r2(p2f / (1 + ivaFrac));
    }

    return { cn, cfn, p1n, p1f, p2n, p2f, m1, m2, iv: ivaId, iva: ivaPct };
  }

  function computeArticlePricingFromPercent(art, pct, baseMode = 'costo', roundingStep = 0) {
    const factor = 1 + (Number(pct) || 0) / 100;
    const { ivaId, ivaPct, ivaFrac, m1, m2 } = resolveEffectiveIvaAndMargins(art);
    const oldCn = r2(Number(art.cn) || 0);
    const oldCfn = r2(Number(art.cfn) || r2(oldCn * (1 + ivaFrac)));
    const oldP1n = r2(Number(art.p1n) || 0);
    const oldP1f = r2(Number(art.p1f) || 0);
    const oldP2n = r2(Number(art.p2n) || 0);
    const oldP2f = r2(Number(art.p2f) || 0);

    if (baseMode === 'costo') {
      const nextCn = oldCn > 0 ? r2(oldCn * factor) : r2((oldCfn / (1 + ivaFrac)) * factor);
      return computeArticlePricingFromCost(art, nextCn, 'neto', roundingStep);
    }

    let p1f = oldP1f;
    let p1n = oldP1n;
    let p2f = oldP2f;
    let p2n = oldP2n;
    let newM1 = m1;
    let newM2 = m2;

    if (baseMode === 'venta_ambas' || baseMode === 'venta_min') {
      p1f = applySaleRounding(oldP1f * factor, roundingStep);
      p1n = r2(p1f / (1 + ivaFrac));
      if (oldCn > 0 && Number(art.ucp) !== 1) {
        newM1 = r2(((p1n / oldCn) - 1) * 100);
      }
    }
    if (baseMode === 'venta_ambas' || baseMode === 'venta_may') {
      p2f = applySaleRounding(oldP2f * factor, roundingStep);
      p2n = r2(p2f / (1 + ivaFrac));
      if (oldCn > 0 && Number(art.ucp) !== 1) {
        newM2 = r2(((p2n / oldCn) - 1) * 100);
      }
    }

    return { cn: oldCn, cfn: oldCfn, p1n, p1f, p2n, p2f, m1: newM1, m2: newM2, iv: ivaId, iva: ivaPct };
  }

  // =========================================================================
  // PARSER 1: LISTAS DE PRECIOS DE PROVEEDORES (PDF MULTIPÁGINA / EXCEL / CSV / TEXTO)
  // Soporta formato Borselli/ARCOR:
  //   Rubro | Segmento | Código | Descripción | U x B | Precio
  // y formatos genéricos: Código | Descripción | [U x B] | Precio
  // =========================================================================
  const KNOWN_DIVISION_PREFIXES = [
    'COMESTIBLES LA CAMPAGNOLA',
    'CHOCOLATES ARCOR J.V.',
    'CHOCOLATES BAGLEY JV',
    'DIV.HARINAS BAGLEY',
    'DIV. HARINAS BAGLEY',
    'DIV. CHOCOLATES',
    'DIV.CHOCOLATES',
    'DIV. ALIMENTOS',
    'DIV.ALIMENTOS',
    'DIV. GOLOSINAS',
    'DIV.GOLOSINAS',
    'DIV. NUTRICION',
    'DIV.NUTRICION',
    'DIV. HARINAS',
    'DIV.HARINAS',
    'HELADOS'
  ];

  function splitDivisionAndSegment(prefix) {
    const clean = String(prefix || '').replace(/\s+/g, ' ').trim();
    if (!clean) return { rubroLista: '', segmentoLista: '' };
    const upper = normStr(clean);
    for (const div of KNOWN_DIVISION_PREFIXES) {
      if (upper === div) return { rubroLista: div, segmentoLista: '' };
      if (upper.startsWith(div + ' ')) {
        return {
          rubroLista: div,
          segmentoLista: clean.slice(div.length).trim().toUpperCase()
        };
      }
    }
    return { rubroLista: clean.toUpperCase(), segmentoLista: '' };
  }

  function parseSupplierPriceListLines(rawInput) {
    const lines = Array.isArray(rawInput)
      ? rawInput.map((l) => String(l || '').trim()).filter(Boolean)
      : String(rawInput || '')
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

    const parsed = [];
    const seenByKey = new Map();

    // Detectar columnas si hay cabecera tabulada / CSV (con \t o ;)
    let headerMap = null;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine || rawLine.length < 5) continue;

      // Ignorar títulos, cabeceras y pies de página
      if (
        /^(?:lista\s+de\s+precios|cliente\s*:|p[aá]gina\s+\d+|hoja\s+\d+|fecha\s*:|vigencia\s*:|promedio\s+de\s+variaciones)/i.test(rawLine)
      ) {
        continue;
      }

      // Detectar línea de encabezado de tabla
      if (
        /(?:c[oó]digo|cod\.?)\b/i.test(rawLine) &&
        /(?:descripci[oó]n|art[ií]culo|producto|detalle)/i.test(rawLine) &&
        /(?:precio|costo|importe|lista)/i.test(rawLine)
      ) {
        const sep = rawLine.includes('\t') ? '\t' : rawLine.includes(';') ? ';' : null;
        if (sep) {
          const cols = rawLine.split(sep).map((c) => normStr(c));
          const idxRubro = cols.findIndex((c) => /RUBRO|DIVISION|LINEA/.test(c));
          const idxSeg = cols.findIndex((c) => /SEGMENTO|SUBRUBRO|CATEGORIA|SECCION/.test(c));
          const idxCod = cols.findIndex((c) => /CODIGO|COD\.?|SKU|EAN|BARRA/.test(c));
          const idxDesc = cols.findIndex((c) => /DESCRIPCION|ARTICULO|PRODUCTO|DETALLE|NOMBRE/.test(c));
          const idxUxb = cols.findIndex((c) => /U\s*X\s*B|UXB|BULTO|PACK|UNID/.test(c));
          const idxPrice = cols.findIndex((c) => /PRECIO|COSTO|IMPORTE|NETO|FINAL|LISTA/.test(c));
          if (idxCod >= 0 && idxPrice >= 0) {
            headerMap = { sep, idxRubro, idxSeg, idxCod, idxDesc, idxUxb, idxPrice };
          }
        }
        continue;
      }

      let item = null;

      // Caso 1: Delimitado por tabulador o punto y coma (Excel / CSV / PDF.js con separadores de columna)
      const delim = rawLine.includes('\t') ? '\t' : (rawLine.includes(';') && rawLine.split(';').length >= 3 ? ';' : null);
      if (delim) {
        const cols = rawLine.split(delim).map((c) => c.trim()).filter((c, idx, arr) => c !== '' || (headerMap && idx < arr.length));
        if (headerMap && headerMap.sep === delim && cols.length >= 3) {
          const priceVal = parseArNumber(cols[headerMap.idxPrice]);
          const codeVal = String(cols[headerMap.idxCod] || '').trim();
          const descVal = headerMap.idxDesc >= 0 ? String(cols[headerMap.idxDesc] || '').trim() : '';
          const uxbVal = headerMap.idxUxb >= 0 ? parseInt(String(cols[headerMap.idxUxb] || '').replace(/\D/g, ''), 10) || 1 : 1;
          const rubVal = headerMap.idxRubro >= 0 ? String(cols[headerMap.idxRubro] || '').trim().toUpperCase() : '';
          const segVal = headerMap.idxSeg >= 0 ? String(cols[headerMap.idxSeg] || '').trim().toUpperCase() : '';
          if (isFinite(priceVal) && priceVal > 0 && (codeVal || descVal)) {
            item = {
              rubroLista: rubVal,
              segmentoLista: segVal,
              codigo: codeVal,
              descripcion: descVal.toUpperCase(),
              uxb: uxbVal > 0 ? uxbVal : 1,
              precioLista: r2(priceVal)
            };
          }
        } else {
          const nonEmpty = cols.filter(Boolean);
          // 6 columnas exactas (ej: Rubro \t Segmento \t Código \t Descripción \t UxB \t Precio)
          if (nonEmpty.length === 6) {
            const p = parseArNumber(nonEmpty[5]);
            const uxb = parseInt(nonEmpty[4].replace(/\D/g, ''), 10) || 1;
            if (isFinite(p) && p > 0 && /^\d{2,14}$/.test(nonEmpty[2].replace(/\s/g, ''))) {
              item = {
                rubroLista: nonEmpty[0].toUpperCase(),
                segmentoLista: nonEmpty[1].toUpperCase(),
                codigo: nonEmpty[2].trim(),
                descripcion: nonEmpty[3].toUpperCase(),
                uxb,
                precioLista: r2(p)
              };
            }
          }
          // 5 columnas (ej: Rubro+Segmento o Rubro \t Código \t Descripción \t UxB \t Precio, o PDF donde Descripción pegó UxB al final)
          else if (nonEmpty.length === 5) {
            const p = parseArNumber(nonEmpty[4]);
            if (isFinite(p) && p > 0) {
              if (/^\d{2,14}$/.test(nonEmpty[2]) && /[A-ZÁÉÍÓÚÑ]{2,}/i.test(nonEmpty[3])) {
                // Rubro \t Segmento \t Código \t "DESCRIPCION x 1 kg8" \t Precio
                let desc = nonEmpty[3].trim();
                let uxb = 1;
                const glued = desc.match(/^(.+?(?:kg|gr|g|cc|ml|lt|l|u|un|un\.))\s*(\d{1,3})$/i);
                if (glued) {
                  desc = glued[1].trim();
                  uxb = parseInt(glued[2], 10) || 1;
                }
                item = {
                  rubroLista: nonEmpty[0].toUpperCase(),
                  segmentoLista: nonEmpty[1].toUpperCase(),
                  codigo: nonEmpty[2].trim(),
                  descripcion: desc.toUpperCase(),
                  uxb,
                  precioLista: r2(p)
                };
              } else if (/^\d{2,14}$/.test(nonEmpty[1]) && /^\d{1,4}$/.test(nonEmpty[3])) {
                const { rubroLista, segmentoLista } = splitDivisionAndSegment(nonEmpty[0]);
                item = {
                  rubroLista,
                  segmentoLista,
                  codigo: nonEmpty[1].trim(),
                  descripcion: nonEmpty[2].toUpperCase(),
                  uxb: parseInt(nonEmpty[3], 10) || 1,
                  precioLista: r2(p)
                };
              }
            }
          }
          // 4 columnas: Código \t Descripción \t UxB \t Precio  o  Rubro \t Código \t Descripción \t Precio
          else if (nonEmpty.length === 4) {
            const p = parseArNumber(nonEmpty[3]);
            if (isFinite(p) && p > 0) {
              if (/^[A-Z0-9-]{2,16}$/i.test(nonEmpty[0]) && /\d/.test(nonEmpty[0]) && /^\d{1,4}$/.test(nonEmpty[2])) {
                item = {
                  rubroLista: '',
                  segmentoLista: '',
                  codigo: nonEmpty[0].trim(),
                  descripcion: nonEmpty[1].toUpperCase(),
                  uxb: parseInt(nonEmpty[2], 10) || 1,
                  precioLista: r2(p)
                };
              } else if (/^\d{2,14}$/.test(nonEmpty[1])) {
                const { rubroLista, segmentoLista } = splitDivisionAndSegment(nonEmpty[0]);
                item = {
                  rubroLista,
                  segmentoLista,
                  codigo: nonEmpty[1].trim(),
                  descripcion: nonEmpty[2].toUpperCase(),
                  uxb: 1,
                  precioLista: r2(p)
                };
              }
            }
          }
          // 3 columnas: Código \t Descripción \t Precio
          else if (nonEmpty.length === 3) {
            const p = parseArNumber(nonEmpty[2]);
            if (isFinite(p) && p > 0 && /[A-ZÁÉÍÓÚÑ]{2,}/i.test(nonEmpty[1])) {
              item = {
                rubroLista: '',
                segmentoLista: '',
                codigo: nonEmpty[0].trim(),
                descripcion: nonEmpty[1].toUpperCase(),
                uxb: 1,
                precioLista: r2(p)
              };
            }
          }
        }
      }

      // Caso 2: Línea plana separada por espacios (OCR / PDF texto plano / WhatsApp)
      if (!item) {
        const flat = rawLine.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim();
        // Patrón A: [RUBRO SEGMENTO] CODIGO DESCRIPCION [UxB] PRECIO
        const mBorselli = flat.match(
          /^(.+?)\s+(\d{3,14})\s+([A-ZÁÉÍÓÚÑ0-9].+?)\s+(?:(\d{1,4})\s+)?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})\s*$/i
        );
        if (mBorselli && /[A-ZÁÉÍÓÚÑ]{2,}/i.test(mBorselli[3])) {
          const p = parseArNumber(mBorselli[5]);
          if (isFinite(p) && p > 0) {
            const { rubroLista, segmentoLista } = splitDivisionAndSegment(mBorselli[1]);
            let desc = mBorselli[3].trim();
            let uxb = mBorselli[4] ? parseInt(mBorselli[4], 10) || 1 : 1;
            if (!mBorselli[4]) {
              const glued = desc.match(/^(.+?(?:kg|gr|g|cc|ml|lt|l|u|un|un\.))\s*(\d{1,3})$/i);
              if (glued) {
                desc = glued[1].trim();
                uxb = parseInt(glued[2], 10) || 1;
              }
            }
            item = {
              rubroLista,
              segmentoLista,
              codigo: mBorselli[2].trim(),
              descripcion: desc.toUpperCase(),
              uxb,
              precioLista: r2(p)
            };
          }
        }

        // Patrón B: CODIGO DESCRIPCION [UxB] PRECIO (sin rubro delante)
        if (!item) {
          const mSimple = flat.match(
            /^([A-Z0-9-]{2,14})\s+([A-ZÁÉÍÓÚÑ].+?)\s+(?:(\d{1,4})\s+)?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})\s*$/i
          );
          if (mSimple && /\d/.test(mSimple[1]) && /[A-ZÁÉÍÓÚÑ]{2,}/i.test(mSimple[2])) {
            const p = parseArNumber(mSimple[4]);
            if (isFinite(p) && p > 0) {
              item = {
                rubroLista: '',
                segmentoLista: '',
                codigo: mSimple[1].trim(),
                descripcion: mSimple[2].trim().toUpperCase(),
                uxb: mSimple[3] ? parseInt(mSimple[3], 10) || 1 : 1,
                precioLista: r2(p)
              };
            }
          }
        }
      }

      if (item && item.precioLista > 0) {
        const dedupKey = item.codigo ? normCode(item.codigo) : normStr(item.descripcion);
        if (seenByKey.has(dedupKey)) {
          parsed[seenByKey.get(dedupKey)] = item;
        } else {
          seenByKey.set(dedupKey, parsed.length);
          parsed.push(item);
        }
      }
    }

    return parsed;
  }

  // =========================================================================
  // PARSER 2: PLANILLA DE VARIACIONES POR SECCIÓN (PDF BORSELLI "PROMEDIO DE VARIACIONES")
  // Formato:
  //   CHOCOLATES ARCOR J.V.  6%  ALFAJORES  6%
  //   BARRAS DE CEREAL  5%
  //   DIV.HARINAS  9%  CEREALES PARA DESAYUNO  14%
  //   COOKIES  10%
  // =========================================================================
  const SEGMENT_KEYWORD_HINTS = {
    ALFAJORES: 'ALFAJOR|ALF\\.|MINITORTA|TATIN',
    'BARRAS DE CEREAL': 'BARRA|CEREAL MIX',
    ADEREZOS: 'MAYONESA|KETCHUP|BARBACOA|MOSTAZA|SALSA GOLF',
    'CONSERVAS DE PESCADO': 'ATUN|CABALLA|SARDINA',
    'CONSERVAS DE TOMATE': 'EXTRACTO|PURE TOMATE|PURE DE TOMATE',
    'CONSERVAS VEGETALES': 'ARVEJA|LENTEJA|CHOCLO|JARDINERA|GARBANZO',
    'DULCE DE LECHE': 'DULCE DE LECHE|DDL',
    'DULCES SOLIDOS': 'BATATA|MEMBRILLO',
    'JUGOS EN POLVO': 'JUGO.*POLVO|JUG\\.POLVO|JUGO BC|JUGO ARCOR',
    MERMELADAS: 'MERMELADA|MERM\\.|MER\\.',
    'PASTAS SECAS': 'FIDEO|SPAGHETTI|TALLARIN|TIRABUZON|CODITO|PENNE',
    SABORES: 'ESPECIA|OREGANO|PIMENTON|COMINO|PIMIENTA|PROVENZAL|CHIMICHURRI|ROMERO|TOMILLO|AJI MOLIDO',
    'TOMATES MASIVOS': 'TOMATE PERITA|TOMATE CUBET|PULPA DE TOMATE|PURE DE TOMATE|PURE TOMATE|SALSATI',
    'TOMATES PREMIUM': 'SALSA.*POMAROLA|SALSA.*BOLOGNESA|SALSA.*PORTUGUESA|SALSA.*ITALIANA|SALSA.*TUCO|SALSA.*FILETTO|SALSA.*PIZZA|SALSA LC|PASSATA',
    ACEITE: 'ACEITE',
    'CACAO EN POLVO': 'ARCOA|CACAO',
    POLENTA: 'PRESTOPRONTA|POLENTA',
    'PREMEZCLAS CHICAS': 'FLAN|POSTRE|GELATINA|GEL\\.',
    'PREMEZCLAS HORNEABLES': 'BIZCOCHUELO|BROWNIE|TORTA AGUILA',
    'PREMEZCLAS SIN GLUTEN': 'SIN TACC|S\\.TACC|SIN\\.TACC',
    RAMEN: 'RAMEN',
    'MAC AND CHEESE': 'MAC.*CHEESE',
    'BOCADITOS Y BOMBONES': 'BON O BON|BOMBON|CABSHA|COFLER CUPS|BOCADITO',
    'CANDY BAR': 'BARRA COFLER|BARRA ROCKLETS',
    'CONFITES Y MANI BANADO': 'ROCKLETS|MANI.*CHOC|MANI BANADO',
    'LINEA HOGAR': 'AGUILA|BANO DE REPOSTERIA|RELLENO UNTABLE|CHOCOLATE TAZA',
    'LINEA INFANTIL': 'ROCKLETON|HUEVO ARCOR|TABLETA ARCOR MILK',
    'OBLEAS BANADAS': 'OBLEA|CUBANITO|GRAFFITI',
    TABLETAS: 'COFLER|BLOCK|CHOCOLATE TOFI|CHOCOLATE C/LECHE|CHOCOLATE BLANCO',
    NUTRICION: 'SIMPLE FIBRA|SIMPLE VITALIDAD|SIMPLE CALCIO|SIMPLE DEFENSA|SIMPLE COLAGENO|WHEY PROTEIN|CREATINA|BARRA RAPTOR',
    'CARAMELOS DE GOMA': 'MOGUL|GOMAS MOGUL|JELLY BEANS|BOMBON DE FRUTA',
    'CARAMELOS DE LECHE': 'BUTTER TOFFEES|CHOCOMANI|VACA LECHERA|BOCADITO HOLANDA|CREMINO',
    'CARAMELOS DUROS': 'LOTZA|BASTON VIENA|SAQUITO FRUTA|MENTA CRISTAL|FRESH CRISTAL|GAJITOS|RODAJAS|RELLENO MIEL',
    'CHICLE GLOBO': 'POOSH|CHICLE',
    'CHICLES CONFITADOS': 'FLIC|TURBO TOP LINE',
    'CHICLES PLEGADOS': 'TOP LINE|TOPLINE',
    CHUPETINES: 'CHUPETIN|CHUP\\.|MR\\.? POPS|MISTER POP|TROMPITO',
    'DUROS AGRUPADOS': 'MENTHO PLUS',
    EXTRUDADOS: 'TUBITO|LADRILLO|TWIST MOGUL|MINI TUBO',
    MASTICABLES: 'MASTICABLE|MASTI|PALOTE',
    'TURRON OBLEA': 'TURRON',
    'CEREALES PARA DESAYUNO': 'CEREALES FORMIS',
    COOKIES: 'GALLETA COFLER|GALLETITAS ROCKLETS|GALLETITAS BLOCK|COOKIES',
    'CRACKERS AGUA': 'CRIOLLITAS|SERRANITAS',
    'CRACKERS SANDWICH': 'TRAVIATA|SERRANA',
    'DULCES RELLENAS': 'FORMIS|TORTITAS|MANA RELLENA|SONRISA|MERENGADA|RUMBA|AMOR|MELLIZA|CHOCOLINAS RELLENAS',
    'GALLETAS BANADAS': 'CHOCO COOKIES',
    'GALLETAS DULCES SECAS': 'CHOCOLINA|COQUITA|MELITA|PORTENITA|MANA|CEREAL MIX|PEPAS',
    'GALLETITAS CEREALES': 'HOGARENA|SALVADO BAGLEY',
    'SNACKS DE COPETIN': 'SALADIX PAPAS|SALADIX QUESITOS|SALADIX SNACK|SALADIX CROSS',
    'SNACKS HORNEADOS': 'SALADIX PIZZA|SALADIX JAMON|SALADIX CALABRESA|SALADIX DUO|SALADIX CHEDDAR|REX|KESITAS',
    SURTIDAS: 'SURTIDO',
    OBLEAS: 'OPERA',
    TOSTADAS: 'TOSTADA',
    'HELADOS HOGAR': 'GELATO|POSTRE HELADO|TORTA HELADA|HELADO TRES CREMAS|BOMBONCITO|ACAI BOWL|BARRITA AGUILA',
    'HELADOS IMPULSO': 'KOPA|CONO COFLER|CONO BON|PALITO|SLICE|HELADO ALFAJOR|HELADO CORAZON|HELADO MOGUL',
    'FRUTAS CON CHOCOLATE': 'FRAMBUESA'
  };

  function defaultKeywordsForSegment(segmento, rubroProv) {
    const cleanSeg = normStr(segmento).replace(/\?/g, 'N');
    if (SEGMENT_KEYWORD_HINTS[cleanSeg]) return SEGMENT_KEYWORD_HINTS[cleanSeg];
    // Quitar palabras vacías y singularizar levemente
    const words = cleanSeg
      .split(/[\s/,-]+/)
      .filter((w) => w.length >= 3 && !['DE', 'DEL', 'CON', 'SIN', 'PARA', 'LOS', 'LAS', 'DIV'].includes(w))
      .map((w) => (w.length > 5 && w.endsWith('ES') ? w.slice(0, -2) : w.length > 4 && w.endsWith('S') ? w.slice(0, -1) : w));
    if (words.length > 0) return words.join(' ');
    return normStr(rubroProv).replace(/^DIV\.?\s*/, '').trim();
  }

  function parseVariationScheduleLines(rawInput) {
    const lines = Array.isArray(rawInput)
      ? rawInput.map((l) => String(l || '').trim()).filter(Boolean)
      : String(rawInput || '')
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

    const rules = [];
    let currentRubro = '';
    let currentRubroPct = 0;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].replace(/\t+/g, '   ').replace(/\s+/g, ' ').trim();
      if (!raw || raw.length < 3) continue;
      if (/^(?:rubro|promedio\s*%|var\.|segmento|p[aá]gina\s+\d+|promedio\s+de\s+variaciones)/i.test(raw)) {
        continue;
      }

      // Caso 1: Línea completa con Rubro + % + Segmento + %
      // Ej: "CHOCOLATES ARCOR J.V. 6% ALFAJORES 6%"
      const mFull = raw.match(
        /^([A-ZÁÉÍÓÚÑ0-9.?/\s&-]{2,45}?)\s+([+-]?\d+(?:[.,]\d+)?)\s*%\s+([A-ZÁÉÍÓÚÑ0-9.?/\s&-]{2,45}?)\s+([+-]?\d+(?:[.,]\d+)?)\s*%$/i
      );
      if (mFull) {
        currentRubro = mFull[1].trim().toUpperCase().replace(/\?/g, 'Ñ');
        currentRubroPct = parseArNumber(mFull[2]) || 0;
        const segmento = mFull[3].trim().toUpperCase().replace(/\?/g, 'Ñ');
        const segPct = parseArNumber(mFull[4]);
        if (isFinite(segPct)) {
          rules.push({
            id: `r_${rules.length + 1}_${Date.now()}`,
            enabled: Math.abs(segPct) > 0.001,
            rubroProv: currentRubro,
            rubroPct: currentRubroPct,
            segmento,
            keywords: defaultKeywordsForSegment(segmento, currentRubro),
            rubroSysId: 0,
            pct: r2(segPct)
          });
        }
        continue;
      }

      // Caso 2: Línea con un solo Segmento + % (hereda currentRubro)
      // Ej: "BARRAS DE CEREAL 5%" o "TOSTADAS 18%"
      const mSingle = raw.match(/^([A-ZÁÉÍÓÚÑ0-9.?/\s&-]{2,55}?)\s+([+-]?\d+(?:[.,]\d+)?)\s*%$/i);
      if (mSingle) {
        const label = mSingle[1].trim().toUpperCase().replace(/\?/g, 'Ñ');
        const pctVal = parseArNumber(mSingle[2]);
        if (isFinite(pctVal)) {
          rules.push({
            id: `r_${rules.length + 1}_${Date.now()}`,
            enabled: Math.abs(pctVal) > 0.001,
            rubroProv: currentRubro || label,
            rubroPct: currentRubro ? currentRubroPct : r2(pctVal),
            segmento: label,
            keywords: defaultKeywordsForSegment(label, currentRubro),
            rubroSysId: 0,
            pct: r2(pctVal)
          });
        }
      }
    }

    return rules;
  }

  // Exponer parsers para pruebas automatizadas
  window.__ERP_AM_PARSERS__ = {
    parseSupplierPriceListLines,
    parseVariationScheduleLines,
    defaultKeywordsForSegment
  };

  // =========================================================================
  // EXTRACCIÓN DE ARCHIVOS (PDF MULTIPÁGINA, EXCEL XLSX/XLS, CSV, TXT, IMAGEN OCR)
  // =========================================================================
  async function ensurePdfJsLoaded() {
    if (window.pdfjsLib) return true;
    try {
      await Promise.race([
        new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('PDF.js timeout')), 15000))
      ]);
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        return true;
      }
    } catch {}
    return false;
  }

  async function ensureSheetJsLoaded() {
    if (window.XLSX) return true;
    try {
      await Promise.race([
        new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('XLSX timeout')), 15000))
      ]);
      return Boolean(window.XLSX);
    } catch {}
    return false;
  }

  async function extractTabularLinesFromFile(file, onProgress) {
    if (!file) return { lines: [], pages: 0 };
    const name = String(file.name || '').toLowerCase();
    const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(name);

    if (isPdf) {
      const okPdf = await ensurePdfJsLoaded();
      if (!okPdf) throw new Error('No se pudo cargar el lector de PDF (verificar conexión).');
      const buf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      const totalPages = Math.min(pdf.numPages, 120);
      const allLines = [];

      for (let p = 1; p <= totalPages; p++) {
        if (onProgress) onProgress(`Leyendo página ${p} de ${totalPages}...`);
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        const rawItems = [];
        textContent.items.forEach((it) => {
          const str = String(it.str || '').trim();
          if (!str) return;
          const x = it.transform ? Number(it.transform[4]) || 0 : 0;
          const y = it.transform ? Number(it.transform[5]) || 0 : 0;
          const width = Number(it.width) || 0;
          rawItems.push({ x, y, width, str });
        });

        rawItems.sort((a, b) => b.y - a.y || a.x - b.x);
        const rows = [];
        rawItems.forEach((it) => {
          const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
          if (lastRow && Math.abs(it.y - lastRow.anchorY) <= 3.8 && Math.abs(it.y - lastRow.avgY) <= 4.2) {
            lastRow.items.push(it);
            lastRow.avgY = lastRow.items.reduce((acc, el) => acc + el.y, 0) / lastRow.items.length;
          } else {
            rows.push({ anchorY: it.y, avgY: it.y, items: [it] });
          }
        });
        rows.sort((a, b) => b.avgY - a.avgY);
        rows.forEach((row) => {
          row.items.sort((a, b) => a.x - b.x);
          let lineStr = '';
          for (let k = 0; k < row.items.length; k++) {
            const cur = row.items[k];
            if (k === 0) {
              lineStr = cur.str;
            } else {
              const prev = row.items[k - 1];
              const gap = cur.x - (prev.x + prev.width);
              lineStr += (gap > 8 ? '\t' : ' ') + cur.str;
            }
          }
          if (lineStr.trim()) allLines.push(lineStr.trim());
        });
      }
      return { lines: allLines, pages: totalPages };
    }

    if (isExcel) {
      if (onProgress) onProgress('Leyendo planilla Excel...');
      const okXlsx = await ensureSheetJsLoaded();
      if (!okXlsx) throw new Error('No se pudo cargar el lector de Excel (verificar conexión).');
      const buf = await file.arrayBuffer();
      const wb = window.XLSX.read(buf, { type: 'array' });
      const allLines = [];
      wb.SheetNames.forEach((sheetName) => {
        const ws = wb.Sheets[sheetName];
        const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
        rows.forEach((r) => {
          if (!Array.isArray(r)) return;
          const cells = r.map((c) => String(c ?? '').trim());
          if (cells.some(Boolean)) allLines.push(cells.join('\t'));
        });
      });
      return { lines: allLines, pages: wb.SheetNames.length };
    }

    if (isImage) {
      if (onProgress) onProgress('Leyendo imagen con OCR...');
      if (!window.Tesseract) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const dataUrl = await new Promise((resolve) => {
        const rd = new FileReader();
        rd.onload = () => resolve(String(rd.result || ''));
        rd.onerror = () => resolve('');
        rd.readAsDataURL(file);
      });
      const res = await window.Tesseract.recognize(dataUrl, 'spa', { preserve_interword_spaces: '1' });
      const text = String(res?.data?.text || '');
      return { lines: text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean), pages: 1 };
    }

    // CSV / TXT
    if (onProgress) onProgress('Leyendo archivo de texto/CSV...');
    const txt = await file.text();
    return { lines: txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean), pages: 1 };
  }

  // =========================================================================
  // PERSISTENCIA EN LOTE + REGISTRO EN PRECIOS EN GÓNDOLA + DESHACER ÚLTIMO LOTE
  // =========================================================================
  function updateUndoButtonsVisibility() {
    const hasUndo = Boolean(AM_STATE.lastUndoBatch && AM_STATE.lastUndoBatch.snapshots.length > 0);
    ['btn-aml-undo-last', 'btn-amp-undo-last', 'btn-amg-undo-last'].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.hidden = !hasUndo;
      if (hasUndo) {
        btn.title = `Revertir último lote: ${AM_STATE.lastUndoBatch.label} (${AM_STATE.lastUndoBatch.snapshots.length} arts.)`;
      }
    });
  }

  async function persistBulkPriceUpdates(updatesList, origenLabel) {
    const b = getBridge();
    const st = getState();
    if (!Array.isArray(updatesList) || updatesList.length === 0) return { ok: false, count: 0 };

    const factorCanje = Number(st.fidelizacionConfig?.factorCanje) || 1.12;
    const undoSnapshots = [];
    const modifiedArticles = [];

    updatesList.forEach(({ art, pricing, linkProvId, linkSupplierCode }) => {
      if (!art || !pricing) return;
      undoSnapshots.push({
        id: Number(art.id),
        cn: r2(art.cn),
        cfn: r2(art.cfn),
        p1n: r2(art.p1n),
        p1f: r2(art.p1f),
        p2n: r2(art.p2n),
        p2f: r2(art.p2f),
        m1: r2(art.m1),
        m2: r2(art.m2),
        iv: Number(art.iv || 5),
        iva: Number(art.iva ?? 21),
        pfid: Number(art.pfid || 1)
      });

      const oldSnap = { p1f: art.p1f, p2f: art.p2f };
      art.cn = r2(pricing.cn);
      art.cfn = r2(pricing.cfn);
      art.p1n = r2(pricing.p1n);
      art.p1f = r2(pricing.p1f);
      art.p2n = r2(pricing.p2n);
      art.p2f = r2(pricing.p2f);
      art.m1 = r2(pricing.m1);
      art.m2 = r2(pricing.m2);
      if (pricing.iv) art.iv = Number(pricing.iv);
      if (pricing.iva !== undefined) art.iva = Number(pricing.iva);

      if (Number(art.pfidManual) !== 1) {
        art.pfid = Math.max(1, Math.round(art.p1f * factorCanje));
      }

      if (linkProvId > 0 && linkSupplierCode) {
        if (!Array.isArray(art.pr)) art.pr = [];
        const cleanCf = String(linkSupplierCode).trim();
        const hit = art.pr.find((x) => Number(x.p) === Number(linkProvId));
        if (hit) {
          if (!hit.cf) hit.cf = cleanCf;
        } else {
          art.pr.push({ p: Number(linkProvId), cf: cleanCf });
        }
        if (!art.cf) art.cf = cleanCf;
        if (!art.p) art.p = Number(linkProvId);
      }

      if (b && typeof b.registerGondolaPriceUpdate === 'function') {
        b.registerGondolaPriceUpdate(art, oldSnap, origenLabel);
      }
      modifiedArticles.push(art);
    });

    if (modifiedArticles.length === 0) return { ok: false, count: 0 };

    AM_STATE.lastUndoBatch = {
      label: origenLabel,
      at: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      snapshots: undoSnapshots
    };
    updateUndoButtonsVisibility();

    if (b) {
      b.saveLocalFacturaProveedorArticleOverrides(modifiedArticles);
      b.saveLocalFidelizacionStore();
      b.saveLocalGondolaQueue();
      b.updateGondolaMenuBadges();
    }

    // Enviar al servidor en bloques de 400 artículos para evitar payloads gigantes
    const CHUNK_SIZE = 400;
    let serverOk = true;
    for (let i = 0; i < modifiedArticles.length; i += CHUNK_SIZE) {
      const chunk = modifiedArticles.slice(i, i + CHUNK_SIZE).map((a) => ({
        id: Number(a.id),
        cn: r2(a.cn),
        cfn: r2(a.cfn),
        p1n: r2(a.p1n),
        p1f: r2(a.p1f),
        p2n: r2(a.p2n),
        p2f: r2(a.p2f),
        m1: r2(a.m1),
        m2: r2(a.m2),
        iv: Number(a.iv || 5),
        iva: Number(a.iva ?? 21),
        pfid: Number(a.pfid || 1),
        pr: Array.isArray(a.pr) ? a.pr : undefined,
        cf: a.cf,
        p: a.p
      }));
      try {
        const res = await fetch('api/catalog.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'bulk_update_from_invoice',
            articles: chunk
          })
        });
        if (!res.ok) serverOk = false;
      } catch {
        serverOk = false;
      }
    }

    // Sincronizar cola de Precios en Góndola al servidor para todas las terminales
    try {
      await fetch('api/catalog.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_gondola_queue',
          gondolaQueue: st.gondolaQueue || {}
        })
      });
    } catch {}

    if (b) {
      b.updateKpis();
      b.applyCatalogFilters(st.currentPage || 1);
    }

    return { ok: serverOk, count: modifiedArticles.length };
  }

  async function undoLastBulkUpdate() {
    const b = getBridge();
    const st = getState();
    const batch = AM_STATE.lastUndoBatch;
    if (!batch || !batch.snapshots.length) return;
    const confirmed = b && typeof b.showBrandConfirmDialog === 'function'
      ? await b.showBrandConfirmDialog(
          `¿Confirmás deshacer "${batch.label}" y restaurar los precios anteriores de ${batch.snapshots.length} artículo(s)?`
        )
      : window.confirm(`¿Deshacer ${batch.label} (${batch.snapshots.length} artículos)?`);
    if (!confirmed) return;

    const artMap = new Map((st.articulos || []).map((a) => [Number(a.id), a]));
    const restoreUpdates = [];
    batch.snapshots.forEach((snap) => {
      const art = artMap.get(Number(snap.id));
      if (!art) return;
      restoreUpdates.push({ art, pricing: snap });
    });

    AM_STATE.lastUndoBatch = null;
    updateUndoButtonsVisibility();
    const res = await persistBulkPriceUpdates(restoreUpdates, `Reversión: ${batch.label}`);
    // Limpiar el batch de reversión para no hacer doble-undo circular
    AM_STATE.lastUndoBatch = null;
    updateUndoButtonsVisibility();
    if (b && typeof b.showToast === 'function') {
      b.showToast(`↩️ Se restauraron ${res.count} artículo(s) a sus precios anteriores.`, 'success');
    }
    refreshAllSubmodulesAfterSave();
  }

  // =========================================================================
  // POBLACIÓN DE SELECTORES (PROVEEDORES, RUBROS, MARCAS, CONFIG PRECIOS)
  // =========================================================================
  function getActiveProvidersList() {
    const st = getState();
    const byId = new Map();
    (Array.isArray(st.proveedores) ? st.proveedores : []).forEach((p) => {
      if (Number(p.bl) === 1) return;
      const id = Number(p.id);
      if (id > 0) byId.set(id, { id, nombre: String(p.nombre || p.razonSocial || `PROVEEDOR #${id}`).toUpperCase() });
    });
    return Array.from(byId.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR'));
  }

  function populateSelectOptions(selId, items, defaultLabel) {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const prev = sel.value;
    sel.textContent = '';
    const opt0 = document.createElement('option');
    opt0.value = '0';
    opt0.textContent = defaultLabel;
    sel.appendChild(opt0);
    items.forEach((it) => {
      const opt = document.createElement('option');
      opt.value = String(it.id);
      opt.textContent = it.nombre;
      sel.appendChild(opt);
    });
    if (prev && Array.from(sel.options).some((o) => o.value === prev)) {
      sel.value = prev;
    }
  }

  function populateActualizacionMasivaSelects() {
    const st = getState();
    const provs = getActiveProvidersList();
    const rubros = (Array.isArray(st.rubros) ? st.rubros : [])
      .filter((r) => Number(r.bl) !== 1)
      .map((r) => ({ id: Number(r.id), nombre: String(r.nombre || '').toUpperCase() }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR'));
    const marcas = (Array.isArray(st.marcas) ? st.marcas : [])
      .filter((m) => Number(m.bl) !== 1)
      .map((m) => ({ id: Number(m.id), nombre: String(m.nombre || '').toUpperCase() }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR'));
    const cfgs = (Array.isArray(st.configuracionesPrecios) ? st.configuracionesPrecios : [])
      .map((c) => ({ id: Number(c.id), nombre: `${String(c.nombre || '').toUpperCase()} (Min ${c.margenMinorista}% / May ${c.margenMayorista}%)` }));

    populateSelectOptions('aml-proveedor-select', provs, 'Todos los proveedores (cruce general)');
    populateSelectOptions('amp-proveedor-select', provs, 'Todos los proveedores');
    populateSelectOptions('amg-proveedor-select', provs, 'Todos los proveedores');

    populateSelectOptions('amp-rubro-select', rubros, 'Todos los rubros');
    populateSelectOptions('amg-rubro-select', rubros, 'Todos los rubros');

    populateSelectOptions('amp-marca-select', marcas, 'Todas las marcas');
    populateSelectOptions('amg-marca-select', marcas, 'Todas las marcas');

    populateSelectOptions('amp-config-select', cfgs, 'Todas las configuraciones');
  }

  // =========================================================================
  // SUBMÓDULO 1: POR LISTA DE PRECIOS (PDF / EXCEL / CSV / TEXTO)
  // =========================================================================
  function buildCatalogLookupIndexes(provId) {
    const st = getState();
    const activeArts = (Array.isArray(st.articulos) ? st.articulos : []).filter((a) => Number(a.bl) !== 1);
    const byProvCf = new Map();
    const byAnyCf = new Map();
    const byEan = new Map();
    const bySysCode = new Map();

    activeArts.forEach((a) => {
      const sysKey = normCode(a.c);
      if (sysKey && !bySysCode.has(sysKey)) bySysCode.set(sysKey, a);

      if (Array.isArray(a.bc)) {
        a.bc.forEach((bc) => {
          const bk = String(bc?.c || '').trim().toUpperCase();
          if (bk && !byEan.has(bk)) byEan.set(bk, a);
        });
      }

      const mainCf = normCode(a.cf);
      if (mainCf) {
        if (provId > 0 && Number(a.p) === provId && !byProvCf.has(mainCf)) {
          byProvCf.set(mainCf, a);
        }
        if (!byAnyCf.has(mainCf)) byAnyCf.set(mainCf, a);
      }

      if (Array.isArray(a.pr)) {
        a.pr.forEach((rel) => {
          const rcf = normCode(rel?.cf);
          if (!rcf) return;
          if (provId > 0 && Number(rel.p) === provId && !byProvCf.has(rcf)) {
            byProvCf.set(rcf, a);
          }
          if (!byAnyCf.has(rcf)) byAnyCf.set(rcf, a);
        });
      }
    });

    return { byProvCf, byAnyCf, byEan, bySysCode };
  }

  function recalculateListaRows() {
    const provId = Number(document.getElementById('aml-proveedor-select')?.value) || 0;
    const modoIva = document.getElementById('aml-modo-iva')?.value || 'neto';
    const bonifPct = Number(document.getElementById('aml-bonif-pct')?.value) || 0;
    const roundingStep = Number(document.getElementById('aml-redondeo')?.value) || 0;
    const dividirUxb = Boolean(document.getElementById('aml-dividir-uxb')?.checked);
    const noBajar = Boolean(document.getElementById('aml-no-bajar-precios')?.checked);
    const soloConCambios = Boolean(document.getElementById('aml-solo-con-cambios')?.checked);
    const bonifFactor = 1 - bonifPct / 100;

    const indexes = buildCatalogLookupIndexes(provId);

    AM_STATE.listaRows.forEach((row) => {
      if (!row.manualArtId) {
        const codeKey = normCode(row.codigo);
        let art = null;
        let matchBy = '';
        if (codeKey) {
          if (provId > 0 && indexes.byProvCf.has(codeKey)) {
            art = indexes.byProvCf.get(codeKey);
            matchBy = 'Cód. Prov.';
          } else if (indexes.byAnyCf.has(codeKey)) {
            art = indexes.byAnyCf.get(codeKey);
            matchBy = 'Cód. Fab.';
          } else if (row.codigo.length >= 8 && indexes.byEan.has(row.codigo.toUpperCase())) {
            art = indexes.byEan.get(row.codigo.toUpperCase());
            matchBy = 'EAN';
          }
        }
        row.matchedArt = art;
        row.matchBy = matchBy;
      }

      const rawBasePrice = row.manualPriceOverride !== null && row.manualPriceOverride !== undefined
        ? Number(row.manualPriceOverride)
        : Number(row.precioLista) || 0;
      const unitBase = dividirUxb && row.uxb > 1 ? rawBasePrice / row.uxb : rawBasePrice;
      const effectiveCostInput = Math.max(0, r2(unitBase * bonifFactor));
      row.effectiveCostInput = effectiveCostInput;

      if (row.matchedArt) {
        const art = row.matchedArt;
        const pricing = computeArticlePricingFromCost(art, effectiveCostInput, modoIva, roundingStep);
        const oldCostRef = modoIva === 'neto' ? r2(art.cn) : r2(art.cfn);
        const newCostRef = modoIva === 'neto' ? pricing.cn : pricing.cfn;
        const diff = r2(newCostRef - oldCostRef);
        const pctVar = oldCostRef > 0 ? r2(((newCostRef - oldCostRef) / oldCostRef) * 100) : 0;

        row.pricing = pricing;
        row.oldCostRef = oldCostRef;
        row.newCostRef = newCostRef;
        row.diff = diff;
        row.pctVar = pctVar;
        row.isLower = oldCostRef > 0 && newCostRef < oldCostRef - 0.01;
        row.isChanged = Math.abs(diff) > 0.01 || Math.abs(pricing.p1f - r2(art.p1f)) > 0.01;

        if (!row.manualCheckTouched) {
          if (noBajar && row.isLower) {
            row.selected = false;
          } else if (soloConCambios && !row.isChanged) {
            row.selected = false;
          } else {
            row.selected = true;
          }
        }
      } else {
        row.pricing = null;
        row.oldCostRef = 0;
        row.newCostRef = effectiveCostInput;
        row.diff = 0;
        row.pctVar = 0;
        row.isLower = false;
        row.isChanged = false;
        row.selected = false;
      }
    });

    populateListaRubroFilter();
    renderListaTableAndKpis();
  }

  function populateListaRubroFilter() {
    const sel = document.getElementById('aml-filter-rubro-lista');
    if (!sel) return;
    const prev = sel.value;
    const sections = new Set();
    AM_STATE.listaRows.forEach((r) => {
      const label = [r.rubroLista, r.segmentoLista].filter(Boolean).join(' · ');
      if (label) sections.add(label);
    });
    sel.textContent = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = `Todas las secciones (${sections.size})`;
    sel.appendChild(opt0);
    Array.from(sections).sort().forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sel.appendChild(opt);
    });
    if (prev && Array.from(sel.options).some((o) => o.value === prev)) {
      sel.value = prev;
    }
  }

  function getFilteredListaRows() {
    const q = normStr(document.getElementById('aml-filter-q')?.value || '');
    const secFilter = document.getElementById('aml-filter-rubro-lista')?.value || '';
    const estFilter = document.getElementById('aml-filter-estado')?.value || 'matched';

    return AM_STATE.listaRows.filter((r) => {
      if (estFilter === 'matched' && !r.matchedArt) return false;
      if (estFilter === 'unmatched' && r.matchedArt) return false;
      if (estFilter === 'changed' && (!r.matchedArt || !r.isChanged)) return false;
      if (estFilter === 'lowered' && (!r.matchedArt || !r.isLower)) return false;

      if (secFilter) {
        const lbl = [r.rubroLista, r.segmentoLista].filter(Boolean).join(' · ');
        if (lbl !== secFilter) return false;
      }
      if (q) {
        const hay = normStr(
          `${r.codigo} ${r.descripcion} ${r.rubroLista} ${r.segmentoLista} ${r.matchedArt?.c || ''} ${r.matchedArt?.n || ''}`
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderListaTableAndKpis() {
    const total = AM_STATE.listaRows.length;
    const matched = AM_STATE.listaRows.filter((r) => Boolean(r.matchedArt));
    const upRows = matched.filter((r) => r.diff > 0.01);
    const downRows = matched.filter((r) => r.diff < -0.01);
    const selectedRows = matched.filter((r) => r.selected);
    const pctRows = matched.filter((r) => r.oldCostRef > 0 && Math.abs(r.pctVar) <= 500);
    const avgPct = pctRows.length > 0
      ? r2(pctRows.reduce((acc, r) => acc + r.pctVar, 0) / pctRows.length)
      : 0;

    const setEl = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    setEl('aml-kpi-total', total.toLocaleString('es-AR'));
    setEl('aml-kpi-pages', AM_STATE.listaFileName ? `${AM_STATE.listaFileName} (${AM_STATE.listaPagesCount || 1} pág.)` : 'Texto pegado / manual');
    setEl('aml-kpi-matched', matched.length.toLocaleString('es-AR'));
    setEl('aml-kpi-unmatched', `${(total - matched.length).toLocaleString('es-AR')} sin vincular`);
    setEl('aml-kpi-up-down', `${upRows.length} / ${downRows.length}`);
    setEl('aml-kpi-avg-var', `Variación prom.: ${avgPct >= 0 ? '+' : ''}${avgPct.toFixed(1)}%`);
    setEl('aml-kpi-selected', selectedRows.length.toLocaleString('es-AR'));

    const applyBtn = document.getElementById('btn-aml-apply');
    if (applyBtn) {
      applyBtn.disabled = selectedRows.length === 0;
      applyBtn.textContent = selectedRows.length > 0
        ? `💾 Aplicar Actualización Masiva (${selectedRows.length} arts.)`
        : '💾 Aplicar Actualización Masiva';
    }

    const tbody = document.getElementById('aml-tbody');
    if (!tbody) return;
    const visible = getFilteredListaRows();
    tbody.textContent = '';

    if (visible.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8;
      td.className = 'table-loading-cell';
      td.textContent = total === 0
        ? 'Subí una Lista de Precios en PDF, Excel, CSV o pegá el texto arriba para cruzar los artículos automáticamente.'
        : 'No hay renglones para el filtro seleccionado (probá cambiar "Mostrar" a "Todos").';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    const frag = document.createDocumentFragment();
    visible.slice(0, 350).forEach((row) => {
      const tr = document.createElement('tr');
      if (row.isLower) tr.style.background = 'rgba(239, 68, 68, 0.06)';
      else if (row.selected && row.isChanged) tr.style.background = 'rgba(22, 163, 74, 0.04)';

      const secLabel = [row.rubroLista, row.segmentoLista].filter(Boolean).join(' · ');
      const pctBadge = row.matchedArt
        ? `<span class="badge" style="background:${row.pctVar > 0.01 ? 'rgba(22,163,74,0.14);color:#15803d;' : row.pctVar < -0.01 ? 'rgba(220,38,38,0.14);color:#dc2626;' : 'rgba(100,116,139,0.14);color:#475569;'}">${row.pctVar > 0 ? '+' : ''}${row.pctVar.toFixed(1)}%</span>`
        : '<span class="price-neto-val">—</span>';

      tr.innerHTML = `
        <td style="text-align:center;">
          <input type="checkbox" class="aml-row-chk" data-row-idx="${row.idx}" ${row.selected ? 'checked' : ''} ${row.matchedArt ? '' : 'disabled'}>
        </td>
        <td>
          <div class="price-cell-stack">
            <span class="art-code-pill">${esc(row.codigo || 'S/C')}</span>
            ${secLabel ? `<span class="price-neto-val" style="font-size:0.72rem;">${esc(secLabel)}</span>` : ''}
            ${row.uxb > 1 ? `<span class="price-neto-val" style="font-size:0.7rem;">U×B: ${row.uxb}</span>` : ''}
          </div>
        </td>
        <td>
          <div class="price-cell-stack">
            <span style="font-size:0.78rem; color:var(--silver-muted);">${esc(row.descripcion)}</span>
            ${
              row.matchedArt
                ? `<strong>#${esc(row.matchedArt.c)} · ${esc(row.matchedArt.n)}</strong><span class="price-neto-val" style="color:#15803d;">✓ ${esc(row.matchBy || 'Vinculado')}</span>`
                : `<div style="display:flex; gap:0.35rem; align-items:center; margin-top:0.2rem;">
                     <span style="color:#dc2626; font-weight:700; font-size:0.76rem;">Sin vincular</span>
                     <button type="button" class="btn-secondary btn-sm aml-btn-link-art" data-row-idx="${row.idx}" style="width:auto; padding:0.15rem 0.45rem; font-size:0.72rem;">🔗 Vincular Cód. Sist.</button>
                   </div>`
            }
          </div>
        </td>
        <td class="num-col">${row.matchedArt ? fmtMoney(row.oldCostRef) : '—'}</td>
        <td class="num-col">
          <input type="number" class="form-input code-mono-input aml-row-cost-inp" data-row-idx="${row.idx}" step="0.01" min="0" value="${row.effectiveCostInput.toFixed(2)}" style="width:112px; text-align:right; font-weight:700; padding:0.28rem 0.45rem;">
        </td>
        <td class="num-col">${pctBadge}</td>
        <td class="num-col">
          ${
            row.matchedArt && row.pricing
              ? `<div class="price-cell-stack">
                   <span class="price-neto-val">${fmtMoney(row.matchedArt.p1f)}</span>
                   <strong class="price-final-val">${fmtMoney(row.pricing.p1f)}</strong>
                 </div>`
              : '—'
          }
        </td>
        <td class="num-col">
          ${
            row.matchedArt && row.pricing
              ? `<div class="price-cell-stack">
                   <span class="price-neto-val">${fmtMoney(row.matchedArt.p2f)}</span>
                   <strong style="color:var(--success);">${fmtMoney(row.pricing.p2f)}</strong>
                 </div>`
              : '—'
          }
        </td>
      `;
      frag.appendChild(tr);
    });

    if (visible.length > 350) {
      const trMore = document.createElement('tr');
      const tdMore = document.createElement('td');
      tdMore.colSpan = 8;
      tdMore.className = 'table-loading-cell';
      tdMore.textContent = `Mostrando primeros 350 de ${visible.length} renglones (usá los filtros de búsqueda o sección para ver otros). Al aplicar se actualizarán TODOS los ${selectedRows.length} seleccionados.`;
      trMore.appendChild(tdMore);
      frag.appendChild(trMore);
    }

    tbody.appendChild(frag);
  }

  function loadParsedPriceListItems(items, fileName, pagesCount) {
    AM_STATE.listaFileName = fileName || '';
    AM_STATE.listaPagesCount = pagesCount || 1;
    AM_STATE.listaRows = items.map((it, idx) => ({
      idx,
      rubroLista: it.rubroLista || '',
      segmentoLista: it.segmentoLista || '',
      codigo: it.codigo || '',
      descripcion: it.descripcion || '',
      uxb: it.uxb || 1,
      precioLista: r2(it.precioLista || 0),
      manualPriceOverride: null,
      manualArtId: null,
      manualCheckTouched: false,
      matchedArt: null,
      matchBy: '',
      selected: false
    }));
    recalculateListaRows();
  }

  // =========================================================================
  // SUBMÓDULO 2: POR PORCENTAJE Y SECCIONES (ESTILO BORSELLI VARIACIONES %)
  // =========================================================================
  function articleMatchesFilters(art, { provId = 0, rubroId = 0, marcaId = 0, cfgId = 0, keyword = '' }) {
    if (!art || Number(art.bl) === 1) return false;
    if (provId > 0) {
      const hasProv = Number(art.p) === provId || (Array.isArray(art.pr) && art.pr.some((x) => Number(x.p) === provId));
      if (!hasProv) return false;
    }
    if (rubroId > 0 && Number(art.r) !== rubroId) return false;
    if (marcaId > 0 && Number(art.mk ?? art.m) !== marcaId) return false;
    if (cfgId > 0 && (Number(art.ucp) !== 1 || Number(art.cp) !== cfgId)) return false;

    const kw = normStr(keyword);
    if (kw) {
      const hay = normStr(`${art.c || ''} ${art.n || ''}`);
      // Soporta OR separado por "|" (para sinónimos automáticos de segmentos Borselli/ARCOR)
      if (kw.includes('|')) {
        const parts = kw.split('|').map((p) => p.trim()).filter(Boolean);
        const ok = parts.some((p) => {
          try {
            return new RegExp(p, 'i').test(hay);
          } catch {
            return hay.includes(p);
          }
        });
        if (!ok) return false;
      } else {
        const tokens = kw.split(/\s+/).filter(Boolean);
        if (!tokens.every((t) => hay.includes(t))) return false;
      }
    }
    return true;
  }

  function countMatchesForRule(rule) {
    const st = getState();
    const provId = Number(document.getElementById('amp-proveedor-select')?.value) || 0;
    const marcaId = Number(document.getElementById('amp-marca-select')?.value) || 0;
    const cfgId = Number(document.getElementById('amp-config-select')?.value) || 0;
    let count = 0;
    (st.articulos || []).forEach((a) => {
      if (
        articleMatchesFilters(a, {
          provId,
          rubroId: Number(rule.rubroSysId) || 0,
          marcaId,
          cfgId,
          keyword: rule.keywords || ''
        })
      ) {
        count++;
      }
    });
    return count;
  }

  function renderAmpRulesTable() {
    const wrap = document.getElementById('amp-rules-wrap');
    const simBtn = document.getElementById('btn-amp-simulate-rules');
    const tbody = document.getElementById('amp-rules-tbody');
    if (!wrap || !tbody) return;

    if (AM_STATE.rules.length === 0) {
      wrap.hidden = true;
      if (simBtn) simBtn.hidden = true;
      tbody.textContent = '';
      return;
    }

    wrap.hidden = false;
    if (simBtn) simBtn.hidden = false;
    const st = getState();
    const rubros = (st.rubros || [])
      .filter((r) => Number(r.bl) !== 1)
      .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es-AR'));

    tbody.textContent = '';
    const frag = document.createDocumentFragment();
    AM_STATE.rules.forEach((rule, idx) => {
      const cnt = countMatchesForRule(rule);
      const tr = document.createElement('tr');
      const rubOptions =
        '<option value="0">(Por palabra clave)</option>' +
        rubros
          .map(
            (r) =>
              `<option value="${r.id}" ${Number(rule.rubroSysId) === Number(r.id) ? 'selected' : ''}>${esc(String(r.nombre || '').toUpperCase())}</option>`
          )
          .join('');

      tr.innerHTML = `
        <td style="text-align:center;">
          <input type="checkbox" class="amp-rule-chk" data-rule-idx="${idx}" ${rule.enabled ? 'checked' : ''}>
        </td>
        <td><strong>${esc(rule.rubroProv || 'GENERAL')}</strong></td>
        <td>
          <div class="price-cell-stack">
            <span style="font-size:0.75rem; font-weight:700;">${esc(rule.segmento || '')}</span>
            <input type="text" class="form-input amp-rule-kw" data-rule-idx="${idx}" value="${esc(rule.keywords || '')}" style="padding:0.2rem 0.45rem; font-size:0.76rem;" placeholder="PALABRAS CLAVE...">
          </div>
        </td>
        <td>
          <select class="form-select amp-rule-rubro" data-rule-idx="${idx}" style="padding:0.25rem 0.4rem; font-size:0.78rem;">
            ${rubOptions}
          </select>
        </td>
        <td class="num-col">
          <input type="number" class="form-input code-mono-input amp-rule-pct" data-rule-idx="${idx}" step="0.1" value="${rule.pct}" style="width:84px; text-align:center; font-weight:800; padding:0.25rem 0.35rem;">
        </td>
        <td class="num-col">
          <span class="badge ${cnt > 0 ? 'badge--gold' : ''}">${cnt} arts.</span>
        </td>
        <td style="text-align:center;">
          <button type="button" class="btn-secondary btn-sm amp-rule-del" data-rule-idx="${idx}" style="width:auto; padding:0.2rem 0.45rem;">✕</button>
        </td>
      `;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }

  function simulateDirectPercentUpdate() {
    const st = getState();
    const provId = Number(document.getElementById('amp-proveedor-select')?.value) || 0;
    const rubroId = Number(document.getElementById('amp-rubro-select')?.value) || 0;
    const marcaId = Number(document.getElementById('amp-marca-select')?.value) || 0;
    const cfgId = Number(document.getElementById('amp-config-select')?.value) || 0;
    const keyword = document.getElementById('amp-keyword-input')?.value || '';
    const pct = Number(document.getElementById('amp-pct-input')?.value) || 0;
    const baseMode = document.getElementById('amp-base-select')?.value || 'costo';
    const roundingStep = Number(document.getElementById('amp-redondeo')?.value) || 0;

    const fb = document.getElementById('amp-feedback');
    if (Math.abs(pct) < 0.001) {
      if (fb) {
        fb.textContent = '⚠️ Ingresá un porcentaje de variación distinto de 0 (ej: 7 para +7%, o -5 para -5%).';
        fb.hidden = false;
      }
      document.getElementById('amp-pct-input')?.focus();
      return;
    }

    const matched = (st.articulos || []).filter((a) =>
      articleMatchesFilters(a, { provId, rubroId, marcaId, cfgId, keyword })
    );

    AM_STATE.pctPreviewRows = matched.map((art) => ({
      art,
      pct,
      ruleLabel: keyword ? `Filtro: ${normStr(keyword)}` : 'Aumento Directo',
      pricing: computeArticlePricingFromPercent(art, pct, baseMode, roundingStep),
      selected: true
    }));

    if (fb) {
      fb.textContent = `👁️ Simulación lista: ${matched.length} artículo(s) encontrados con variación ${pct > 0 ? '+' : ''}${pct}%.`;
      fb.hidden = false;
    }
    renderAmpPreviewTable();
  }

  function simulateMultiSectionRules() {
    const st = getState();
    const provId = Number(document.getElementById('amp-proveedor-select')?.value) || 0;
    const marcaId = Number(document.getElementById('amp-marca-select')?.value) || 0;
    const cfgId = Number(document.getElementById('amp-config-select')?.value) || 0;
    const baseMode = document.getElementById('amp-base-select')?.value || 'costo';
    const roundingStep = Number(document.getElementById('amp-redondeo')?.value) || 0;

    const activeRules = AM_STATE.rules.filter((r) => r.enabled && Math.abs(Number(r.pct) || 0) >= 0.001);
    const fb = document.getElementById('amp-feedback');
    if (activeRules.length === 0) {
      if (fb) {
        fb.textContent = '⚠️ No hay secciones activas con porcentaje distinto de 0%.';
        fb.hidden = false;
      }
      return;
    }

    const byArtId = new Map();
    activeRules.forEach((rule) => {
      (st.articulos || []).forEach((art) => {
        const aid = Number(art.id);
        if (byArtId.has(aid)) return; // primera regla específica activa prevalece
        if (
          articleMatchesFilters(art, {
            provId,
            rubroId: Number(rule.rubroSysId) || 0,
            marcaId,
            cfgId,
            keyword: rule.keywords || ''
          })
        ) {
          byArtId.set(aid, {
            art,
            pct: Number(rule.pct),
            ruleLabel: `${rule.rubroProv ? rule.rubroProv + ' · ' : ''}${rule.segmento || 'SECCIÓN'} (${rule.pct > 0 ? '+' : ''}${rule.pct}%)`,
            pricing: computeArticlePricingFromPercent(art, Number(rule.pct), baseMode, roundingStep),
            selected: true
          });
        }
      });
    });

    AM_STATE.pctPreviewRows = Array.from(byArtId.values());
    if (fb) {
      fb.textContent = `⚡ Simulación multi-sección lista: ${AM_STATE.pctPreviewRows.length} artículo(s) impactados por ${activeRules.length} sección(es).`;
      fb.hidden = false;
    }
    renderAmpPreviewTable();
  }

  function renderAmpPreviewTable() {
    const tbody = document.getElementById('amp-preview-tbody');
    const counter = document.getElementById('amp-preview-counter');
    const applyBtn = document.getElementById('btn-amp-apply');
    if (!tbody) return;

    const st = getState();
    const rubMap = new Map((st.rubros || []).map((r) => [Number(r.id), r.nombre || '']));
    const marMap = new Map((st.marcas || []).map((m) => [Number(m.id), m.nombre || '']));
    const q = normStr(document.getElementById('amp-preview-filter-q')?.value || '');

    const selectedAll = AM_STATE.pctPreviewRows.filter((r) => r.selected);
    const visible = q
      ? AM_STATE.pctPreviewRows.filter((r) => normStr(`${r.art.c} ${r.art.n} ${r.ruleLabel}`).includes(q))
      : AM_STATE.pctPreviewRows;

    if (counter) counter.textContent = `${selectedAll.length} seleccionados / ${AM_STATE.pctPreviewRows.length} total`;
    if (applyBtn) {
      applyBtn.disabled = selectedAll.length === 0;
      applyBtn.textContent = selectedAll.length > 0
        ? `💾 Aplicar Actualización (${selectedAll.length} arts.)`
        : '💾 Aplicar Actualización por Porcentaje';
    }

    tbody.textContent = '';
    if (visible.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.className = 'table-loading-cell';
      td.textContent = AM_STATE.pctPreviewRows.length === 0
        ? 'Elegí los filtros y un porcentaje arriba (o subí un PDF de variaciones por sección) y presioná "Simular".'
        : 'Sin coincidencias en la vista previa.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    const frag = document.createDocumentFragment();
    visible.slice(0, 350).forEach((row) => {
      const idx = AM_STATE.pctPreviewRows.indexOf(row);
      const tr = document.createElement('tr');
      const rub = rubMap.get(Number(row.art.r)) || 'SIN RUBRO';
      const mar = marMap.get(Number(row.art.mk ?? row.art.m)) || 'SIN MARCA';
      tr.innerHTML = `
        <td style="text-align:center;">
          <input type="checkbox" class="amp-prev-chk" data-prev-idx="${idx}" ${row.selected ? 'checked' : ''}>
        </td>
        <td>
          <div class="price-cell-stack">
            <span class="art-code-pill">#${esc(row.art.c || '')}</span>
            <strong>${esc(row.art.n || '')}</strong>
          </div>
        </td>
        <td>
          <div class="price-cell-stack">
            <span>${esc(rub)} · <strong>${esc(mar)}</strong></span>
            <span class="price-neto-val" style="color:var(--gold-dark);">${esc(row.ruleLabel)}</span>
          </div>
        </td>
        <td class="num-col">
          <span class="badge" style="background:${row.pct >= 0 ? 'rgba(22,163,74,0.14);color:#15803d;' : 'rgba(220,38,38,0.14);color:#dc2626;'}">${row.pct > 0 ? '+' : ''}${row.pct}%</span>
        </td>
        <td class="num-col">
          <div class="price-cell-stack">
            <span class="price-neto-val">${fmtMoney(row.art.cfn)}</span>
            <strong>${fmtMoney(row.pricing.cfn)}</strong>
          </div>
        </td>
        <td class="num-col">
          <div class="price-cell-stack">
            <span class="price-neto-val">${fmtMoney(row.art.p1f)}</span>
            <strong class="price-final-val">${fmtMoney(row.pricing.p1f)}</strong>
          </div>
        </td>
        <td class="num-col">
          <div class="price-cell-stack">
            <span class="price-neto-val">${fmtMoney(row.art.p2f)}</span>
            <strong style="color:var(--success);">${fmtMoney(row.pricing.p2f)}</strong>
          </div>
        </td>
      `;
      frag.appendChild(tr);
    });

    if (visible.length > 350) {
      const trMore = document.createElement('tr');
      const tdMore = document.createElement('td');
      tdMore.colSpan = 7;
      tdMore.className = 'table-loading-cell';
      tdMore.textContent = `Mostrando primeros 350 de ${visible.length} artículos. Al confirmar se aplicará a TODOS los ${selectedAll.length} seleccionados.`;
      trMore.appendChild(tdMore);
      frag.appendChild(trMore);
    }

    tbody.appendChild(frag);
  }

  // =========================================================================
  // SUBMÓDULO 3: PRODUCTO POR PRODUCTO (GRILLA RÁPIDA EDITABLE)
  // =========================================================================
  function getFilteredGridArticles() {
    const st = getState();
    const q = normStr(document.getElementById('amg-search-input')?.value || '');
    const provId = Number(document.getElementById('amg-proveedor-select')?.value) || 0;
    const rubroId = Number(document.getElementById('amg-rubro-select')?.value) || 0;
    const marcaId = Number(document.getElementById('amg-marca-select')?.value) || 0;
    const soloMod = Boolean(document.getElementById('amg-solo-modificados')?.checked);

    return (st.articulos || []).filter((a) => {
      if (Number(a.bl) === 1) return false;
      if (soloMod && !AM_STATE.gridDrafts.has(Number(a.id))) return false;
      if (provId > 0) {
        const okP = Number(a.p) === provId || (Array.isArray(a.pr) && a.pr.some((x) => Number(x.p) === provId));
        if (!okP) return false;
      }
      if (rubroId > 0 && Number(a.r) !== rubroId) return false;
      if (marcaId > 0 && Number(a.mk ?? a.m) !== marcaId) return false;
      if (q) {
        const bcs = Array.isArray(a.bc) ? a.bc.map((b) => b.c).join(' ') : '';
        const cfs = [a.cf || '', ...(Array.isArray(a.pr) ? a.pr.map((x) => x.cf || '') : [])].join(' ');
        const hay = normStr(`${a.c || ''} ${a.n || ''} ${bcs} ${cfs}`);
        const tokens = q.split(/\s+/).filter(Boolean);
        if (!tokens.every((t) => hay.includes(t))) return false;
      }
      return true;
    });
  }

  function updateGridHeaderControls(totalMatched) {
    const modCount = AM_STATE.gridDrafts.size;
    const badge = document.getElementById('amg-status-badge');
    const info = document.getElementById('amg-count-info');
    const saveBtn = document.getElementById('btn-amg-save-all');
    const discBtn = document.getElementById('btn-amg-discard');
    const prevBtn = document.getElementById('btn-amg-prev');
    const nextBtn = document.getElementById('btn-amg-next');
    const pageInd = document.getElementById('amg-page-ind');

    const totalPages = Math.max(1, Math.ceil(totalMatched / AM_STATE.gridPageSize));
    if (AM_STATE.gridPage > totalPages) AM_STATE.gridPage = totalPages;

    if (badge) badge.textContent = `${modCount} modificado${modCount === 1 ? '' : 's'}`;
    if (info) info.textContent = `Mostrando ${totalMatched.toLocaleString('es-AR')} artículo(s)`;
    if (saveBtn) {
      saveBtn.disabled = modCount === 0;
      saveBtn.textContent = modCount > 0
        ? `💾 Guardar Cambios Modificados (${modCount})`
        : '💾 Guardar Cambios Modificados';
    }
    if (discBtn) discBtn.disabled = modCount === 0;
    if (prevBtn) prevBtn.disabled = AM_STATE.gridPage <= 1;
    if (nextBtn) nextBtn.disabled = AM_STATE.gridPage >= totalPages;
    if (pageInd) pageInd.textContent = `Página ${AM_STATE.gridPage} de ${totalPages}`;
  }

  function renderGridTable(page) {
    if (typeof page === 'number' && page >= 1) AM_STATE.gridPage = page;
    const tbody = document.getElementById('amg-tbody');
    if (!tbody) return;

    const filtered = getFilteredGridArticles();
    updateGridHeaderControls(filtered.length);

    const start = (AM_STATE.gridPage - 1) * AM_STATE.gridPageSize;
    const slice = filtered.slice(start, start + AM_STATE.gridPageSize);
    const st = getState();
    const rubMap = new Map((st.rubros || []).map((r) => [Number(r.id), r.nombre || '']));
    const marMap = new Map((st.marcas || []).map((m) => [Number(m.id), m.nombre || '']));

    tbody.textContent = '';
    if (slice.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8;
      td.className = 'table-loading-cell';
      td.textContent = 'No se encontraron artículos para los filtros aplicados.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    const frag = document.createDocumentFragment();
    slice.forEach((art) => {
      const aid = Number(art.id);
      const draft = AM_STATE.gridDrafts.get(aid) || null;
      const effCn = draft ? draft.cn : r2(art.cn);
      const effCfn = draft ? draft.cfn : r2(art.cfn);
      const effP1f = draft ? draft.p1f : r2(art.p1f);
      const effP2f = draft ? draft.p2f : r2(art.p2f);
      const rub = rubMap.get(Number(art.r)) || 'SIN RUBRO';
      const mar = marMap.get(Number(art.mk ?? art.m)) || 'SIN MARCA';
      const cfDisplay = art.cf || (Array.isArray(art.pr) && art.pr[0]?.cf ? art.pr[0].cf : '');

      const tr = document.createElement('tr');
      tr.dataset.artId = String(aid);
      if (draft) tr.style.background = 'rgba(212, 160, 23, 0.12)';

      tr.innerHTML = `
        <td>
          <div class="price-cell-stack">
            <div><span class="art-code-pill">#${esc(art.c || '')}</span>${cfDisplay ? ` <span class="price-neto-val">Cód.Prov: ${esc(cfDisplay)}</span>` : ''}</div>
            <strong>${esc(art.n || '')}</strong>
          </div>
        </td>
        <td>
          <div class="price-cell-stack">
            <span>${esc(rub)}</span>
            <span class="price-neto-val">${esc(mar)}</span>
          </div>
        </td>
        <td class="num-col">
          <input type="number" class="form-input code-mono-input amg-inp-cn" data-art-id="${aid}" step="0.01" min="0" value="${effCn.toFixed(2)}" style="width:112px; text-align:right; font-weight:700; padding:0.28rem 0.45rem;">
        </td>
        <td class="num-col">
          <input type="number" class="form-input code-mono-input amg-inp-cfn" data-art-id="${aid}" step="0.01" min="0" value="${effCfn.toFixed(2)}" style="width:112px; text-align:right; font-weight:700; padding:0.28rem 0.45rem;">
        </td>
        <td class="num-col">
          <input type="number" class="form-input code-mono-input amg-inp-pct" data-art-id="${aid}" step="0.5" value="${draft && draft.pctInput ? draft.pctInput : ''}" placeholder="+%" style="width:76px; text-align:center; font-weight:700; padding:0.28rem 0.35rem;">
        </td>
        <td class="num-col amg-cell-p1">
          <div class="price-cell-stack">
            ${draft ? `<span class="price-neto-val">${fmtMoney(art.p1f)}</span>` : ''}
            <strong class="price-final-val">${fmtMoney(effP1f)}</strong>
          </div>
        </td>
        <td class="num-col amg-cell-p2">
          <div class="price-cell-stack">
            ${draft ? `<span class="price-neto-val">${fmtMoney(art.p2f)}</span>` : ''}
            <strong style="color:var(--success);">${fmtMoney(effP2f)}</strong>
          </div>
        </td>
        <td style="text-align:center;">
          ${
            draft
              ? `<button type="button" class="btn-secondary btn-sm amg-btn-reset-row" data-art-id="${aid}" style="width:auto; padding:0.2rem 0.45rem;" title="Descartar cambio de esta fila">↩️</button>`
              : `<button type="button" class="btn-secondary btn-sm amg-btn-edit-modal" data-art-id="${aid}" style="width:auto; padding:0.2rem 0.45rem;" title="Abrir ficha completa">✏️</button>`
          }
        </td>
      `;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }

  function updateGridRowLive(tr, art, pricing, pctInputVal = '') {
    const aid = Number(art.id);
    AM_STATE.gridDrafts.set(aid, { ...pricing, pctInput: pctInputVal });
    tr.style.background = 'rgba(212, 160, 23, 0.12)';
    const cnEl = tr.querySelector('.amg-inp-cn');
    const cfnEl = tr.querySelector('.amg-inp-cfn');
    if (cnEl && document.activeElement !== cnEl) cnEl.value = pricing.cn.toFixed(2);
    if (cfnEl && document.activeElement !== cfnEl) cfnEl.value = pricing.cfn.toFixed(2);
    const p1Cell = tr.querySelector('.amg-cell-p1');
    const p2Cell = tr.querySelector('.amg-cell-p2');
    if (p1Cell) {
      p1Cell.innerHTML = `<div class="price-cell-stack"><span class="price-neto-val">${fmtMoney(art.p1f)}</span><strong class="price-final-val">${fmtMoney(pricing.p1f)}</strong></div>`;
    }
    if (p2Cell) {
      p2Cell.innerHTML = `<div class="price-cell-stack"><span class="price-neto-val">${fmtMoney(art.p2f)}</span><strong style="color:var(--success);">${fmtMoney(pricing.p2f)}</strong></div>`;
    }
    const actTd = tr.lastElementChild;
    if (actTd) {
      actTd.innerHTML = `<button type="button" class="btn-secondary btn-sm amg-btn-reset-row" data-art-id="${aid}" style="width:auto; padding:0.2rem 0.45rem;" title="Descartar cambio de esta fila">↩️</button>`;
    }
    updateGridHeaderControls(getFilteredGridArticles().length);
  }

  function refreshAllSubmodulesAfterSave() {
    if (AM_STATE.listaRows.length > 0) recalculateListaRows();
    if (AM_STATE.rules.length > 0) renderAmpRulesTable();
    if (!document.getElementById('sec-act-masiva-productos')?.hidden) {
      renderGridTable(AM_STATE.gridPage);
    }
  }

  // =========================================================================
  // EVENT LISTENERS E INICIALIZACIÓN
  // =========================================================================
  function bindEventsOnce() {
    if (AM_STATE.initialized) return;
    AM_STATE.initialized = true;

    // --- Deshacer en los 3 submódulos ---
    ['btn-aml-undo-last', 'btn-amp-undo-last', 'btn-amg-undo-last'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => undoLastBulkUpdate());
    });

    // --- SUBMÓDULO 1: LISTA DE PRECIOS ---
    const dropzone = document.getElementById('aml-dropzone');
    const fileInput = document.getElementById('aml-file-input');

    async function handleListaFile(file) {
      if (!file) return;
      const titleEl = document.getElementById('aml-file-title');
      const subEl = document.getElementById('aml-file-sub');
      const fb = document.getElementById('aml-feedback');
      if (titleEl) titleEl.textContent = `⏳ Procesando: ${file.name}...`;
      if (fb) fb.hidden = true;
      try {
        const { lines, pages } = await extractTabularLinesFromFile(file, (msg) => {
          if (subEl) subEl.textContent = msg;
        });
        const items = parseSupplierPriceListLines(lines);
        if (titleEl) titleEl.textContent = `✅ Archivo cargado: ${file.name} (${items.length} productos leídos)`;
        if (subEl) subEl.textContent = `Se procesaron ${pages} página(s). Podés subir otro archivo para reemplazar.`;
        loadParsedPriceListItems(items, file.name, pages);
        if (fb) {
          fb.textContent = items.length > 0
            ? `✅ Se detectaron ${items.length} artículos de la lista (${pages} pág.). Revisá los vinculados abajo y presioná "Aplicar Actualización Masiva".`
            : '⚠️ No se detectaron renglones con precio en el archivo. Probá pegar el texto en el cuadro derecho.';
          fb.hidden = false;
        }
      } catch (err) {
        if (titleEl) titleEl.textContent = 'Subir Lista de Precios del Proveedor (PDF multipágina, Excel, CSV o TXT)';
        if (fb) {
          fb.textContent = `❌ Error al leer archivo: ${err.message || err}`;
          fb.hidden = false;
        }
      }
    }

    dropzone?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#d4a017';
    });
    dropzone?.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'rgba(212,160,23,0.55)';
    });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'rgba(212,160,23,0.55)';
      const f = e.dataTransfer?.files?.[0];
      if (f) handleListaFile(f);
    });
    fileInput?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) handleListaFile(f);
      e.target.value = '';
    });

    document.getElementById('btn-aml-parse-paste')?.addEventListener('click', () => {
      const raw = document.getElementById('aml-paste-input')?.value || '';
      const items = parseSupplierPriceListLines(raw);
      const fb = document.getElementById('aml-feedback');
      loadParsedPriceListItems(items, 'Texto pegado', 1);
      if (fb) {
        fb.textContent = items.length > 0
          ? `✅ Se analizaron ${items.length} renglones del texto pegado.`
          : '⚠️ No se reconocieron filas con código y precio en el texto pegado.';
        fb.hidden = false;
      }
    });

    document.getElementById('btn-aml-clear')?.addEventListener('click', () => {
      AM_STATE.listaRows = [];
      AM_STATE.listaFileName = '';
      AM_STATE.listaPagesCount = 0;
      const paste = document.getElementById('aml-paste-input');
      if (paste) paste.value = '';
      const titleEl = document.getElementById('aml-file-title');
      if (titleEl) titleEl.textContent = 'Subir Lista de Precios del Proveedor (PDF multipágina, Excel, CSV o TXT)';
      const subEl = document.getElementById('aml-file-sub');
      if (subEl) subEl.textContent = 'Soporta listas completas de 10+ páginas (ej. Borselli / ARCOR: Rubro · Segmento · Código · Descripción · U×B · Precio)';
      const fb = document.getElementById('aml-feedback');
      if (fb) fb.hidden = true;
      populateListaRubroFilter();
      renderListaTableAndKpis();
    });

    ['aml-proveedor-select', 'aml-modo-iva', 'aml-bonif-pct', 'aml-redondeo', 'aml-dividir-uxb', 'aml-no-bajar-precios', 'aml-solo-con-cambios'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => {
        if (id === 'aml-proveedor-select') {
          AM_STATE.listaRows.forEach((r) => {
            if (!r.manualArtId) r.matchedArt = null;
          });
        }
        if (id === 'aml-no-bajar-precios' || id === 'aml-solo-con-cambios') {
          AM_STATE.listaRows.forEach((r) => { r.manualCheckTouched = false; });
        }
        recalculateListaRows();
      });
    });

    ['aml-filter-q', 'aml-filter-rubro-lista', 'aml-filter-estado'].forEach((id) => {
      const ev = id === 'aml-filter-q' ? 'input' : 'change';
      document.getElementById(id)?.addEventListener(ev, () => renderListaTableAndKpis());
    });

    document.getElementById('btn-aml-select-all')?.addEventListener('click', () => {
      getFilteredListaRows().forEach((r) => {
        if (r.matchedArt) {
          r.selected = true;
          r.manualCheckTouched = true;
        }
      });
      renderListaTableAndKpis();
    });
    document.getElementById('btn-aml-select-none')?.addEventListener('click', () => {
      getFilteredListaRows().forEach((r) => {
        r.selected = false;
        r.manualCheckTouched = true;
      });
      renderListaTableAndKpis();
    });
    document.getElementById('aml-check-header')?.addEventListener('change', (e) => {
      const checked = Boolean(e.target.checked);
      getFilteredListaRows().forEach((r) => {
        if (r.matchedArt) {
          r.selected = checked;
          r.manualCheckTouched = true;
        }
      });
      renderListaTableAndKpis();
    });

    document.getElementById('aml-tbody')?.addEventListener('change', (e) => {
      const chk = e.target.closest('.aml-row-chk');
      if (chk) {
        const idx = Number(chk.dataset.rowIdx);
        const row = AM_STATE.listaRows[idx];
        if (row && row.matchedArt) {
          row.selected = Boolean(chk.checked);
          row.manualCheckTouched = true;
          renderListaTableAndKpis();
        }
        return;
      }
      const inp = e.target.closest('.aml-row-cost-inp');
      if (inp) {
        const idx = Number(inp.dataset.rowIdx);
        const row = AM_STATE.listaRows[idx];
        const v = parseArNumber(inp.value);
        if (row && isFinite(v) && v >= 0) {
          row.manualPriceOverride = v;
          recalculateListaRows();
        }
      }
    });

    document.getElementById('aml-tbody')?.addEventListener('click', (e) => {
      const btnLink = e.target.closest('.aml-btn-link-art');
      if (!btnLink) return;
      const idx = Number(btnLink.dataset.rowIdx);
      const row = AM_STATE.listaRows[idx];
      if (!row) return;
      const rawSys = window.prompt(
        `Vincular "${row.descripcion}" (Cód. Prov: ${row.codigo})\nIngresá el Código de Sistema (ej: 00192) o EAN del artículo en tu padrón:`
      );
      if (!rawSys) return;
      const key = normCode(rawSys);
      const rawUp = rawSys.trim().toUpperCase();
      const st = getState();
      const hit = (st.articulos || []).find(
        (a) =>
          Number(a.bl) !== 1 &&
          (normCode(a.c) === key ||
            (Array.isArray(a.bc) && a.bc.some((b) => String(b?.c || '').trim().toUpperCase() === rawUp)))
      );
      if (!hit) {
        const b = getBridge();
        if (b && typeof b.showToast === 'function') {
          b.showToast(`No se encontró ningún artículo activo con código "${rawSys}".`, 'error');
        }
        return;
      }
      row.manualArtId = Number(hit.id);
      row.matchedArt = hit;
      row.matchBy = 'Vinculado manual';
      row.manualCheckTouched = false;
      recalculateListaRows();
    });

    document.getElementById('btn-aml-apply')?.addEventListener('click', async () => {
      const selected = AM_STATE.listaRows.filter((r) => r.selected && r.matchedArt && r.pricing);
      if (selected.length === 0) return;
      const provSel = document.getElementById('aml-proveedor-select');
      const provId = Number(provSel?.value) || 0;
      const provName = provId > 0 && provSel?.selectedOptions?.[0] ? provSel.selectedOptions[0].textContent : 'Lista Proveedor';
      const b = getBridge();
      const ok = b && typeof b.showBrandConfirmDialog === 'function'
        ? await b.showBrandConfirmDialog(
            `¿Confirmás actualizar precios de ${selected.length} artículo(s) según "${AM_STATE.listaFileName || provName}"?\nSe recalcularán Minorista, Mayorista y se enviarán los cambios a Precios en Góndola.`
          )
        : window.confirm(`¿Actualizar precios de ${selected.length} artículos?`);
      if (!ok) return;

      const btn = document.getElementById('btn-aml-apply');
      if (btn) btn.disabled = true;
      const res = await persistBulkPriceUpdates(
        selected.map((r) => ({
          art: r.matchedArt,
          pricing: r.pricing,
          linkProvId: provId,
          linkSupplierCode: r.manualArtId ? r.codigo : ''
        })),
        `Actualización Lista (${provName})`
      );
      if (btn) btn.disabled = false;

      const fb = document.getElementById('aml-feedback');
      if (fb) {
        fb.textContent = `✅ ¡Actualización Masiva aplicada! Se actualizaron ${res.count} artículo(s) y se cargaron las etiquetas en Precios en Góndola.`;
        fb.hidden = false;
      }
      if (b && typeof b.showToast === 'function') {
        b.showToast(`✅ ${res.count} artículo(s) actualizados correctamente.`, 'success');
      }
      recalculateListaRows();
    });

    // --- SUBMÓDULO 2: POR PORCENTAJE Y SECCIONES ---
    document.getElementById('btn-amp-preview')?.addEventListener('click', () => simulateDirectPercentUpdate());

    document.getElementById('btn-amp-add-rule')?.addEventListener('click', () => {
      const rubSel = document.getElementById('amp-rubro-select');
      const rubId = Number(rubSel?.value) || 0;
      const rubLabel = rubId > 0 && rubSel?.selectedOptions?.[0] ? rubSel.selectedOptions[0].textContent : 'GENERAL';
      const kw = normStr(document.getElementById('amp-keyword-input')?.value || '');
      const pct = Number(document.getElementById('amp-pct-input')?.value) || 0;
      AM_STATE.rules.push({
        id: `r_man_${Date.now()}`,
        enabled: true,
        rubroProv: rubLabel,
        rubroPct: pct,
        segmento: kw || rubLabel,
        keywords: kw,
        rubroSysId: rubId,
        pct: r2(pct)
      });
      renderAmpRulesTable();
    });

    const varFileInput = document.getElementById('amp-var-file-input');
    document.getElementById('btn-amp-upload-var-pdf')?.addEventListener('click', () => varFileInput?.click());
    varFileInput?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      const fb = document.getElementById('amp-feedback');
      if (fb) {
        fb.textContent = `⏳ Leyendo planilla de variaciones "${f.name}"...`;
        fb.hidden = false;
      }
      try {
        const { lines } = await extractTabularLinesFromFile(f);
        const parsedRules = parseVariationScheduleLines(lines);
        AM_STATE.rules = parsedRules;
        renderAmpRulesTable();
        if (fb) {
          fb.textContent = parsedRules.length > 0
            ? `✅ Se detectaron ${parsedRules.length} secciones con sus % de variación desde "${f.name}". Revisá el proveedor arriba y presioná "Simular Todas las Secciones Activas".`
            : '⚠️ No se detectaron filas con porcentajes (%) en el archivo. Probá pegar el texto manualmente.';
          fb.hidden = false;
        }
      } catch (err) {
        if (fb) {
          fb.textContent = `❌ Error al leer archivo: ${err.message || err}`;
          fb.hidden = false;
        }
      }
    });

    document.getElementById('btn-amp-toggle-paste')?.addEventListener('click', () => {
      const box = document.getElementById('amp-var-paste-box');
      if (box) box.hidden = !box.hidden;
    });
    document.getElementById('btn-amp-parse-var-paste')?.addEventListener('click', () => {
      const raw = document.getElementById('amp-var-paste-input')?.value || '';
      AM_STATE.rules = parseVariationScheduleLines(raw);
      renderAmpRulesTable();
      const fb = document.getElementById('amp-feedback');
      if (fb) {
        fb.textContent = `✅ Se leyeron ${AM_STATE.rules.length} sección(es) del texto pegado.`;
        fb.hidden = false;
      }
    });
    document.getElementById('btn-amp-clear-rules')?.addEventListener('click', () => {
      AM_STATE.rules = [];
      AM_STATE.pctPreviewRows = [];
      renderAmpRulesTable();
      renderAmpPreviewTable();
    });
    document.getElementById('btn-amp-simulate-rules')?.addEventListener('click', () => simulateMultiSectionRules());

    ['amp-proveedor-select', 'amp-marca-select', 'amp-config-select'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => {
        if (AM_STATE.rules.length > 0) renderAmpRulesTable();
      });
    });

    document.getElementById('amp-rules-tbody')?.addEventListener('change', (e) => {
      const el = e.target;
      const idx = Number(el.dataset.ruleIdx);
      const rule = AM_STATE.rules[idx];
      if (!rule) return;
      if (el.classList.contains('amp-rule-chk')) rule.enabled = Boolean(el.checked);
      else if (el.classList.contains('amp-rule-kw')) rule.keywords = el.value.trim().toUpperCase();
      else if (el.classList.contains('amp-rule-rubro')) rule.rubroSysId = Number(el.value) || 0;
      else if (el.classList.contains('amp-rule-pct')) rule.pct = r2(Number(el.value) || 0);
      renderAmpRulesTable();
    });
    document.getElementById('amp-rules-tbody')?.addEventListener('click', (e) => {
      const del = e.target.closest('.amp-rule-del');
      if (!del) return;
      const idx = Number(del.dataset.ruleIdx);
      AM_STATE.rules.splice(idx, 1);
      renderAmpRulesTable();
    });

    document.getElementById('amp-preview-filter-q')?.addEventListener('input', () => renderAmpPreviewTable());
    document.getElementById('btn-amp-select-all')?.addEventListener('click', () => {
      AM_STATE.pctPreviewRows.forEach((r) => { r.selected = true; });
      renderAmpPreviewTable();
    });
    document.getElementById('btn-amp-select-none')?.addEventListener('click', () => {
      AM_STATE.pctPreviewRows.forEach((r) => { r.selected = false; });
      renderAmpPreviewTable();
    });
    document.getElementById('amp-check-header')?.addEventListener('change', (e) => {
      const checked = Boolean(e.target.checked);
      AM_STATE.pctPreviewRows.forEach((r) => { r.selected = checked; });
      renderAmpPreviewTable();
    });
    document.getElementById('amp-preview-tbody')?.addEventListener('change', (e) => {
      const chk = e.target.closest('.amp-prev-chk');
      if (!chk) return;
      const idx = Number(chk.dataset.prevIdx);
      if (AM_STATE.pctPreviewRows[idx]) {
        AM_STATE.pctPreviewRows[idx].selected = Boolean(chk.checked);
        renderAmpPreviewTable();
      }
    });

    document.getElementById('btn-amp-apply')?.addEventListener('click', async () => {
      const selected = AM_STATE.pctPreviewRows.filter((r) => r.selected);
      if (selected.length === 0) return;
      const b = getBridge();
      const ok = b && typeof b.showBrandConfirmDialog === 'function'
        ? await b.showBrandConfirmDialog(
            `¿Confirmás aplicar la actualización por porcentaje a ${selected.length} artículo(s)?\nLos nuevos precios se guardarán en el padrón y pasarán a Precios en Góndola.`
          )
        : window.confirm(`¿Aplicar actualización a ${selected.length} artículos?`);
      if (!ok) return;

      const btn = document.getElementById('btn-amp-apply');
      if (btn) btn.disabled = true;
      const res = await persistBulkPriceUpdates(
        selected.map((r) => ({ art: r.art, pricing: r.pricing })),
        `Actualización por Porcentaje (${selected.length} arts.)`
      );
      if (btn) btn.disabled = false;

      const fb = document.getElementById('amp-feedback');
      if (fb) {
        fb.textContent = `✅ ¡Actualización por Porcentaje completada! Se actualizaron ${res.count} artículo(s) y se cargaron en Precios en Góndola.`;
        fb.hidden = false;
      }
      if (b && typeof b.showToast === 'function') {
        b.showToast(`✅ ${res.count} artículo(s) actualizados por porcentaje.`, 'success');
      }
      AM_STATE.pctPreviewRows = [];
      renderAmpPreviewTable();
    });

    // --- SUBMÓDULO 3: PRODUCTO POR PRODUCTO (GRILLA RÁPIDA) ---
    ['amg-search-input', 'amg-proveedor-select', 'amg-rubro-select', 'amg-marca-select', 'amg-solo-modificados'].forEach((id) => {
      const ev = id === 'amg-search-input' ? 'input' : 'change';
      document.getElementById(id)?.addEventListener(ev, () => renderGridTable(1));
    });
    document.getElementById('amg-redondeo')?.addEventListener('change', () => {
      const st = getState();
      const step = Number(document.getElementById('amg-redondeo')?.value) || 0;
      const artMap = new Map((st.articulos || []).map((a) => [Number(a.id), a]));
      AM_STATE.gridDrafts.forEach((draft, aid) => {
        const art = artMap.get(aid);
        if (!art) return;
        const next = computeArticlePricingFromCost(art, draft.cn, 'neto', step);
        AM_STATE.gridDrafts.set(aid, { ...next, pctInput: draft.pctInput || '' });
      });
      renderGridTable(AM_STATE.gridPage);
    });
    document.getElementById('btn-amg-prev')?.addEventListener('click', () => {
      if (AM_STATE.gridPage > 1) renderGridTable(AM_STATE.gridPage - 1);
    });
    document.getElementById('btn-amg-next')?.addEventListener('click', () => {
      renderGridTable(AM_STATE.gridPage + 1);
    });
    document.getElementById('btn-amg-discard')?.addEventListener('click', () => {
      AM_STATE.gridDrafts.clear();
      renderGridTable(AM_STATE.gridPage);
    });

    const amgTbody = document.getElementById('amg-tbody');
    amgTbody?.addEventListener('input', (e) => {
      const el = e.target;
      const aid = Number(el.dataset.artId);
      if (!aid) return;
      const st = getState();
      const art = (st.articulos || []).find((a) => Number(a.id) === aid);
      if (!art) return;
      const tr = el.closest('tr');
      const step = Number(document.getElementById('amg-redondeo')?.value) || 0;

      if (el.classList.contains('amg-inp-cn')) {
        const v = parseArNumber(el.value);
        if (isFinite(v) && v >= 0) {
          updateGridRowLive(tr, art, computeArticlePricingFromCost(art, v, 'neto', step));
        }
      } else if (el.classList.contains('amg-inp-cfn')) {
        const v = parseArNumber(el.value);
        if (isFinite(v) && v >= 0) {
          updateGridRowLive(tr, art, computeArticlePricingFromCost(art, v, 'final', step));
        }
      } else if (el.classList.contains('amg-inp-pct')) {
        const pct = parseArNumber(el.value);
        if (isFinite(pct) && Math.abs(pct) > 0) {
          updateGridRowLive(tr, art, computeArticlePricingFromPercent(art, pct, 'costo', step), el.value);
        }
      }
    });

    // Navegación rápida tipo planilla con Enter / Flecha Abajo
    amgTbody?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const el = e.target;
      if (!el.matches('.amg-inp-cn, .amg-inp-cfn, .amg-inp-pct')) return;
      e.preventDefault();
      const tr = el.closest('tr');
      const sibling = e.key === 'ArrowUp' ? tr?.previousElementSibling : tr?.nextElementSibling;
      const cls = el.classList.contains('amg-inp-cn')
        ? '.amg-inp-cn'
        : el.classList.contains('amg-inp-cfn')
          ? '.amg-inp-cfn'
          : '.amg-inp-pct';
      const targetInp = sibling?.querySelector(cls);
      if (targetInp) {
        targetInp.focus();
        targetInp.select();
      }
    });

    amgTbody?.addEventListener('click', (e) => {
      const btnReset = e.target.closest('.amg-btn-reset-row');
      if (btnReset) {
        AM_STATE.gridDrafts.delete(Number(btnReset.dataset.artId));
        renderGridTable(AM_STATE.gridPage);
        return;
      }
      const btnEdit = e.target.closest('.amg-btn-edit-modal');
      if (btnEdit) {
        const st = getState();
        const art = (st.articulos || []).find((a) => Number(a.id) === Number(btnEdit.dataset.artId));
        const b = getBridge();
        if (art && b && typeof b.openArticleModal === 'function') b.openArticleModal(art);
      }
    });

    document.getElementById('btn-amg-save-all')?.addEventListener('click', async () => {
      if (AM_STATE.gridDrafts.size === 0) return;
      const st = getState();
      const b = getBridge();
      const artMap = new Map((st.articulos || []).map((a) => [Number(a.id), a]));
      const list = [];
      AM_STATE.gridDrafts.forEach((pricing, aid) => {
        const art = artMap.get(aid);
        if (art) list.push({ art, pricing });
      });
      if (list.length === 0) return;

      const ok = b && typeof b.showBrandConfirmDialog === 'function'
        ? await b.showBrandConfirmDialog(`¿Confirmás guardar los nuevos precios de ${list.length} artículo(s) modificados?`)
        : window.confirm(`¿Guardar ${list.length} artículo(s) modificados?`);
      if (!ok) return;

      const btn = document.getElementById('btn-amg-save-all');
      if (btn) btn.disabled = true;
      const res = await persistBulkPriceUpdates(list, `Actualización Producto por Producto (${list.length} arts.)`);
      AM_STATE.gridDrafts.clear();
      if (btn) btn.disabled = false;

      const fb = document.getElementById('amg-feedback');
      if (fb) {
        fb.textContent = `✅ Se guardaron ${res.count} artículo(s) y se actualizaron en Precios en Góndola.`;
        fb.hidden = false;
      }
      if (b && typeof b.showToast === 'function') {
        b.showToast(`✅ ${res.count} artículo(s) guardados correctamente.`, 'success');
      }
      renderGridTable(AM_STATE.gridPage);
    });
  }

  window.initOrRefreshActualizacionMasivaSection = function initOrRefreshActualizacionMasivaSection(targetId) {
    bindEventsOnce();
    populateActualizacionMasivaSelects();
    updateUndoButtonsVisibility();
    if (targetId === 'sec-act-masiva-productos') {
      renderGridTable(AM_STATE.gridPage || 1);
    } else if (targetId === 'sec-act-masiva-lista') {
      renderListaTableAndKpis();
    } else if (targetId === 'sec-act-masiva-porcentaje') {
      renderAmpRulesTable();
      renderAmpPreviewTable();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEventsOnce);
  } else {
    bindEventsOnce();
  }
})();
