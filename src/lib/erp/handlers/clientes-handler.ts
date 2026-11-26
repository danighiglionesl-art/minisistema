import { NextRequest, NextResponse } from "next/server";
import { jsonResponseMaybeGzip } from "../json-response";
import { buildCleanTenantSeed } from "../seed-clean-tenant";
import {
  getTenantDoc,
  listCatalogDeltas,
  putTenantDoc,
  upsertCatalogDeltas,
} from "../supabase-server";
import type { ErpTenantRecord } from "../types";
import {
  applyCatalogDeltas,
  CATALOG_META_DELTA_ID,
} from "./catalog-handler";

type AnyObj = Record<string, any>;

function round2(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function toUpperUtf8(val: unknown): string {
  return String(val ?? "").trim().toUpperCase();
}

function cleanDocDigits(raw: unknown): string {
  return String(raw || "").replace(/\D/g, "");
}

function extractDocKeys(raw: unknown): string[] {
  const digits = cleanDocDigits(raw).replace(/^0+/, "");
  if (digits.length < 6) return [];
  const keys = new Set<string>([digits]);
  if (digits.length === 11 && /^(20|23|24|27|30|33|34)/.test(digits)) {
    const innerDni = digits.slice(2, 10).replace(/^0+/, "");
    if (innerDni.length >= 6) keys.add(innerDni);
  }
  return Array.from(keys);
}

function hasDocIntersection(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  return a.some((k) => b.includes(k));
}

function getArDateParts(dateInput?: Date | string | number): {
  iso: string;
  fmt: string;
  hora: string;
} {
  const dt = dateInput ? new Date(dateInput) : new Date();
  const safeDt = Number.isNaN(dt.getTime()) ? new Date() : dt;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(safeDt);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  const y = map.year || "2026";
  const m = map.month || "01";
  const d = map.day || "01";
  const hh = map.hour === "24" ? "00" : map.hour || "00";
  const mm = map.minute || "00";
  return {
    iso: `${y}-${m}-${d}`,
    fmt: `${d}/${m}/${y}`,
    hora: `${hh}:${mm}`,
  };
}

function addDaysToIso(baseIso: string, days: number): { iso: string; fmt: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(baseIso || "").trim());
  const baseMs = m
    ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 15, 0, 0)
    : Date.now();
  const target = new Date(baseMs + Math.max(1, days) * 86400_000);
  const { iso, fmt } = getArDateParts(target);
  return { iso, fmt };
}

function sanitizeStreetNumber(raw: unknown): string {
  let s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "S/N";
  const mPre = s.match(/^(?:S\/N|S\/D)\s*(.+)$/i);
  if (mPre && mPre[1].trim() && mPre[1].trim().toUpperCase() !== "S/N") {
    s = mPre[1].trim().toUpperCase();
  }
  const mSuf = s.match(/^(.+?)\s*(?:S\/N|S\/D)$/i);
  if (mSuf && mSuf[1].trim() && mSuf[1].trim().toUpperCase() !== "S/N") {
    s = mSuf[1].trim().toUpperCase();
  }
  return s || "S/N";
}

function decodeGoogleJwtPayload(credential: string): AnyObj | null {
  const trimmed = String(credential || "").trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3) return null;
  try {
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad > 0) b64 += "=".repeat(4 - pad);
    const jsonStr = Buffer.from(b64, "base64").toString("utf8");
    const parsed = JSON.parse(jsonStr);
    return parsed && typeof parsed === "object" ? (parsed as AnyObj) : null;
  } catch {
    return null;
  }
}

function resolveFidPctForRubroOnDate(
  fidCfg: AnyObj,
  rubroId: number,
  fechaIso: string
): number {
  let defaultPct = Number(fidCfg?.porcentajeCompra ?? fidCfg?.porcentajeSuma ?? 0.8);
  if (!Number.isFinite(defaultPct) || defaultPct <= 0) defaultPct = 0.8;
  const rules = Array.isArray(fidCfg?.reglasRubros) ? fidCfg.reglasRubros : [];
  if (!rules.length) return defaultPct;

  const fIso = /^\d{4}-\d{2}-\d{2}$/.test(fechaIso) ? fechaIso : getArDateParts().iso;
  const dt = new Date(`${fIso}T12:00:00-03:00`);
  const dow = Number.isNaN(dt.getTime()) ? new Date().getDay() : dt.getDay();

  let matchedSpecific: AnyObj | null = null;
  let matchedGeneral: AnyObj | null = null;
  for (const r of rules) {
    if (!r || typeof r !== "object") continue;
    if (r.activa === false || !r.usaPorcentaje) continue;
    const desde = String(r.fechaDesde || "");
    const hasta = String(r.fechaHasta || "");
    if (desde && fIso < desde) continue;
    if (hasta && fIso > hasta) continue;
    const dias = Array.isArray(r.diasSemana) ? r.diasSemana.map((x: unknown) => Number(x)) : [];
    if (dias.length > 0 && !dias.includes(dow)) continue;
    const rRub = Number(r.rubroId || 0);
    if (rubroId > 0 && rRub === rubroId) matchedSpecific = r;
    else if (rRub === 0) matchedGeneral = r;
  }
  const chosen = matchedSpecific ?? matchedGeneral;
  if (chosen) {
    const p = Number(chosen.porcentajeCompra ?? chosen.porcentajeSuma ?? defaultPct);
    if (Number.isFinite(p) && p > 0) return p;
  }
  return defaultPct;
}

function calcSaleFidPointsWithRubroRules(
  fidCfg: AnyObj,
  importe: number,
  items: AnyObj[],
  fechaIso: string
): { points: number; effectivePct: number } {
  let defaultPct = Number(fidCfg?.porcentajeCompra ?? fidCfg?.porcentajeSuma ?? 0.8);
  if (!Number.isFinite(defaultPct) || defaultPct <= 0) defaultPct = 0.8;
  if (importe <= 0) return { points: 0, effectivePct: defaultPct };

  const fIso = /^\d{4}-\d{2}-\d{2}$/.test(fechaIso) ? fechaIso : getArDateParts().iso;
  let lineSum = 0;
  const validLines: Array<{ rId: number; sub: number }> = [];
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || typeof it !== "object") continue;
    let sub = Number(it.subtotal || 0);
    if (sub <= 0) {
      const qty = Number(it.qty ?? it.cantidad ?? 0);
      const up = Number(it.unitPrice ?? it.precioFinal ?? 0);
      sub = qty * up;
    }
    if (sub > 0) {
      lineSum += sub;
      validLines.push({ rId: Number(it.rId ?? it.r ?? 0), sub });
    }
  }

  if (validLines.length > 0 && lineSum > 0) {
    const scale = importe / lineSum;
    let rawPoints = 0;
    for (const ln of validLines) {
      const adjSub = ln.sub * scale;
      const pctLine = resolveFidPctForRubroOnDate(fidCfg, ln.rId, fIso);
      rawPoints += adjSub * (pctLine / 100);
    }
    const pts = Math.max(0, Math.round(rawPoints));
    const effPct = importe > 0 ? round2((rawPoints / importe) * 100) : defaultPct;
    return { points: pts, effectivePct: effPct };
  }

  const pctGen = resolveFidPctForRubroOnDate(fidCfg, 0, fIso);
  const rawGen = importe * (pctGen / 100);
  return { points: Math.max(0, Math.round(rawGen)), effectivePct: round2(pctGen) };
}

function getfidMovClientId(m: AnyObj): number {
  return Number(m?.cId ?? m?.clienteId ?? m?.clientId ?? 0);
}

function recomputeClientFidTotals(db: AnyObj, clientIdx: number): {
  vigentes: number;
  acumulados: number;
  canjeados: number;
} {
  const cli = db.clientes[clientIdx];
  if (!cli) return { vigentes: 0, acumulados: 0, canjeados: 0 };
  const cId = Number(cli.id || 0);
  const cDoc = cleanDocDigits(cli.nroDoc);
  const { iso: todayIso } = getArDateParts();
  let vigentes = 0;
  let acumulados = 0;
  let canjeados = 0;

  for (const mRow of Array.isArray(db.movimientosFidelizacion) ? db.movimientosFidelizacion : []) {
    if (!mRow) continue;
    const mCid = getfidMovClientId(mRow);
    const mDoc = cleanDocDigits(mRow.dni);
    if (mCid !== cId && (!cDoc || cDoc.length < 6 || mDoc !== cDoc)) continue;
    const t = String(mRow.tipo || "");
    const p = Math.round(Number(mRow.puntos || 0));
    if (t === "SUMA" && p > 0) {
      acumulados += p;
      const rem = Math.round(Number(mRow.puntosRestantes ?? p));
      const vIso = String(mRow.fechaVencIso ?? mRow.fechaVencimientoIso ?? "2099-12-31");
      if (rem > 0 && (!vIso || vIso >= todayIso)) {
        vigentes += rem;
      }
    } else if (t === "CANJE") {
      canjeados += Math.abs(p);
    }
  }

  cli.puntosFidelizacion = vigentes;
  cli.puntosAcumuladosHist = acumulados;
  cli.puntosCanjeadosHist = canjeados;
  return { vigentes, acumulados, canjeados };
}

function grantClubFidelBonusPoints(
  db: AnyObj,
  clientIdx: number,
  pts: number,
  comprobante: string,
  obs: string,
  canal = "APP_WEB"
): AnyObj | null {
  if (clientIdx < 0 || !db.clientes[clientIdx] || pts <= 0) return null;
  if (!Array.isArray(db.movimientosFidelizacion)) db.movimientosFidelizacion = [];

  const cli = db.clientes[clientIdx];
  const cId = Number(cli.id || 0);
  const compUpper = toUpperUtf8(comprobante);

  for (const fm of db.movimientosFidelizacion) {
    const fmCid = getfidMovClientId(fm);
    const fmComp = toUpperUtf8(fm?.comprobante);
    if (fmComp === compUpper && (fmCid === cId || compUpper !== "")) {
      return fm;
    }
  }

  const maxFidId = db.movimientosFidelizacion.reduce(
    (mx: number, fm: AnyObj) => Math.max(mx, Number(fm?.id || 0)),
    0
  );
  const diasVigCfg = Math.max(1, Number(db.fidelizacionConfig?.diasVigencia ?? 365));
  const { iso: todayIso, fmt: todayFmt, hora } = getArDateParts();
  const { iso: vencIso, fmt: vencFmt } = addDaysToIso(todayIso, diasVigCfg);

  const newFidMov: AnyObj = {
    id: maxFidId + 1,
    cId,
    clienteId: cId,
    dni: cli.nroDoc || "",
    clienteNombre: cli.nombre || "",
    tipo: "SUMA",
    fechaEmision: todayFmt,
    fechaEmisionIso: todayIso,
    hora,
    fechaVencimiento: vencFmt,
    fechaVencIso: vencIso,
    montoCompra: 0,
    porcentajeAplicado: 0,
    puntos: pts,
    puntosConsumidos: 0,
    puntosRestantes: pts,
    comprobante: compUpper,
    canalEnviado: toUpperUtf8(canal),
    obs: toUpperUtf8(obs),
  };

  db.movimientosFidelizacion.push(newFidMov);
  recomputeClientFidTotals(db, clientIdx);
  cli.ultimoMovFidelizacion = todayFmt;
  return newFidMov;
}

function resolveReferrerClientIndex(
  db: AnyObj,
  rawRefCode: string,
  excludeClientIdx = -1
): number {
  const clean = toUpperUtf8(rawRefCode);
  if (!clean) return -1;
  let refNum = 0;
  const m = clean.match(/^(?:CF[\s\-_#]*|SOCIO[\s\-_#]*|#)?(\d+)$/i);
  if (m) {
    refNum = Number(m[1]);
  } else {
    const d = cleanDocDigits(clean);
    if (d) refNum = Number(d);
  }
  if (!Number.isFinite(refNum) || refNum <= 3) return -1;

  for (let idx = 0; idx < db.clientes.length; idx++) {
    if (idx === excludeClientIdx) continue;
    const c = db.clientes[idx];
    const cod = Number(c?.codigo || 0);
    const aliasCods = Array.isArray(c?.aliasCodigos)
      ? c.aliasCodigos.map((x: unknown) => Number(x))
      : [];
    if (cod === refNum || aliasCods.includes(refNum)) return idx;
  }
  return -1;
}

function processReferralDualBonus(
  db: AnyObj,
  newClientIdx: number,
  rawRefCode: string
): AnyObj {
  if (newClientIdx < 0 || !db.clientes[newClientIdx]) return { granted: false };
  const cleanRef = String(rawRefCode || "").trim();
  if (!cleanRef) return { granted: false };

  const newCli = db.clientes[newClientIdx];
  if (newCli.bonoReferidoBienvenidaOtorgado) {
    return { granted: false, alreadyGranted: true };
  }
  const newCod = Number(newCli.codigo || 0);
  if (newCod > 0 && newCod <= 3) return { granted: false };

  const refIdx = resolveReferrerClientIndex(db, cleanRef, newClientIdx);
  if (refIdx < 0 || !db.clientes[refIdx]) {
    return { granted: false, invalidCode: true };
  }

  const refCli = db.clientes[refIdx];
  const newId = Number(newCli.id || 0);
  const refId = Number(refCli.id || 0);
  if (newId <= 0 || refId <= 0 || newId === refId) return { granted: false };

  const newDocKeys = extractDocKeys(newCli.nroDoc);
  const refDocKeys = extractDocKeys(refCli.nroDoc);
  if (hasDocIntersection(newDocKeys, refDocKeys)) {
    return { granted: false, selfReferral: true };
  }
  const newEmail = toUpperUtf8(newCli.email);
  const refEmail = toUpperUtf8(refCli.email);
  if (newEmail && newEmail === refEmail) {
    return { granted: false, selfReferral: true };
  }

  if (newDocKeys.length > 0) {
    for (let i = 0; i < db.clientes.length; i++) {
      if (i === newClientIdx) continue;
      const other = db.clientes[i];
      if (other?.bonoReferidoBienvenidaOtorgado) {
        const oKeys = extractDocKeys(other.nroDoc);
        if (hasDocIntersection(newDocKeys, oKeys)) {
          return { granted: false, alreadyGranted: true };
        }
      }
    }
  }

  const bonoRefPts = Math.max(1, Math.round(Number(db.fidelizacionConfig?.bonoReferido ?? 1000)));
  const refCodigo = Number(refCli.codigo || refId);
  const refNombre = String(refCli.nombre || "SOCIO CLUB FIDEL");
  const newNombre = String(newCli.nombre || "NUEVO SOCIO");
  const { fmt, hora } = getArDateParts();

  const movAmigo = grantClubFidelBonusPoints(
    db,
    newClientIdx,
    bonoRefPts,
    `BONO-BIENV-REF-${newId}`,
    `BONO BIENVENIDA (+${bonoRefPts} PTS) · INVITADO POR ${refNombre} (CF-${refCodigo})`,
    "REFERIDO_WHATSAPP"
  );
  const movRef = grantClubFidelBonusPoints(
    db,
    refIdx,
    bonoRefPts,
    `BONO-AMIGO-REF-${newId}`,
    `BONO POR RECOMENDAR AMIGO (+${bonoRefPts} PTS): ${newNombre} (#${newCod})`,
    "REFERIDO_WHATSAPP"
  );

  db.clientes[newClientIdx].bonoReferidoBienvenidaOtorgado = true;
  db.clientes[newClientIdx].bonoReferidoFecha = `${fmt} ${hora}`;
  db.clientes[newClientIdx].referidoPorId = refId;
  db.clientes[newClientIdx].referidoPorCodigo = `CF-${refCodigo}`;
  db.clientes[newClientIdx].referidoPorNombre = refNombre;

  db.clientes[refIdx].amigosReferidosCount =
    Number(db.clientes[refIdx].amigosReferidosCount || 0) + 1;
  db.clientes[refIdx].puntosPorReferidosHist =
    Number(db.clientes[refIdx].puntosPorReferidosHist || 0) + bonoRefPts;

  return {
    granted: true,
    puntosOtorgados: bonoRefPts,
    referrerId: refId,
    referrerCodigo: `CF-${refCodigo}`,
    referrerNombre: refNombre,
    movimientoAmigo: movAmigo,
    movimientoRef: movRef,
  };
}

function recomputeEntityCtaCteStats(db: AnyObj, cId: number) {
  const movs = (Array.isArray(db.movimientosCtaCte) ? db.movimientosCtaCte : []).filter(
    (m: AnyObj) => Number(m.cId) === cId && !m.anulado
  );
  let totalDebe = 0;
  let totalHaber = 0;
  let lastFecha = "";
  for (const m of movs) {
    totalDebe = round2(totalDebe + Number(m.d || 0));
    totalHaber = round2(totalHaber + Number(m.h || 0));
    if (m.f) lastFecha = String(m.f);
  }
  const ent = (db.clientes || []).find((c: AnyObj) => Number(c.id) === cId);
  if (ent) {
    ent.cantMovs = movs.length;
    ent.totalDebe = totalDebe;
    ent.totalHaber = totalHaber;
    ent.saldoActual = round2(totalDebe - totalHaber);
    ent.ultimoMovFecha = lastFecha;
  }
}

async function syncProveedoresToCatalog(tenant: ErpTenantRecord, clientes: AnyObj[], actor: string) {
  const list: AnyObj[] = [];
  for (const ent of clientes) {
    if (!ent.esProveedor || ent.bajaLogica) continue;
    const unifiedCode = Number(ent.codigo || ent.codigoProveedor || ent.id || 0);
    const pId = Number(ent.idProveedor || 1000 + unifiedCode);
    list.push({
      id: pId,
      codigo: unifiedCode,
      nombre: String(ent.nombre || ""),
      cuit: String(ent.nroDoc || ""),
      entityId: Number(ent.id || 0),
      esCliente: ent.esCliente !== false,
    });
  }
  list.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
  await upsertCatalogDeltas(tenant, {
    upserts: [{ id: CATALOG_META_DELTA_ID, proveedores: list }],
    actor,
    action: "sync_proveedores",
  });
}

async function deductCatalogStockForCanje(
  tenant: ErpTenantRecord,
  itemsToDeduct: Array<{ artId: number; artCodigo: string; cantidad: number }>,
  actor: string,
  tag: string
): Promise<AnyObj[]> {
  if (!itemsToDeduct.length) return [];
  const catFallback = buildCleanTenantSeed({ businessName: tenant.business_name }).docs
    .catalog_db as AnyObj;
  const [{ payload: rawCatDb }, deltas] = await Promise.all([
    getTenantDoc<AnyObj>(tenant, "catalog_db", catFallback),
    listCatalogDeltas(tenant),
  ]);
  const catDb = applyCatalogDeltas(rawCatDb, deltas);
  if (!catDb || !Array.isArray(catDb.articulos)) return [];

  const updatedArticles: AnyObj[] = [];
  const modifiedDeltaArts: AnyObj[] = [];
  for (const item of itemsToDeduct) {
    const tArtId = Number(item.artId || 0);
    const tCode = toUpperUtf8(item.artCodigo);
    const tQty = Number(item.cantidad || 1);
    if (tQty <= 0) continue;

    for (const aRef of catDb.articulos) {
      if (!aRef) continue;
      const aId = Number(aRef.id || 0);
      const aCode = toUpperUtf8(aRef.c);
      if ((tArtId > 0 && aId === tArtId) || (tArtId <= 0 && tCode && aCode === tCode)) {
        const prevSf = round2(aRef.sf ?? 0);
        const newSf = round2(prevSf - tQty);
        aRef.sf = newSf;
        aRef.sc = round2(newSf - Number(aRef.si || 0));
        modifiedDeltaArts.push({ id: aId, sf: aRef.sf, sc: aRef.sc });
        updatedArticles.push({
          id: aId,
          c: aCode,
          n: String(aRef.n || ""),
          stockAnterior: prevSf,
          sf: newSf,
          descontado: tQty,
        });
        break;
      }
    }
  }
  if (modifiedDeltaArts.length > 0) {
    await upsertCatalogDeltas(tenant, {
      upserts: modifiedDeltaArts,
      actor,
      action: tag,
    });
  }
  return updatedArticles;
}

export async function handleErpClientes(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const fallback = buildCleanTenantSeed({
    businessName: tenant.business_name,
    localidad: tenant.branding.localidad,
    provincia: tenant.branding.provincia,
    cp: tenant.branding.cp,
  }).docs.clientes_db as AnyObj;

  if (req.method === "GET") {
    const action = req.nextUrl.searchParams.get("action") || "all";
    const { payload: db } = await getTenantDoc<AnyObj>(tenant, "clientes_db", fallback);

    if (action === "all") {
      return jsonResponseMaybeGzip(req, db);
    }

    if (action === "movimientos") {
      const targetId = Number(
        req.nextUrl.searchParams.get("id") || req.nextUrl.searchParams.get("cId") || 0
      );
      const origenFilter = (req.nextUrl.searchParams.get("origen") || "")
        .trim()
        .toUpperCase();
      const movs = (Array.isArray(db.movimientosCtaCte) ? db.movimientosCtaCte : [])
        .filter((m: AnyObj) => {
          if (!m || Number(m.cId) !== targetId) return false;
          const orig = String(m.origen || "VENTA").toUpperCase();
          if (origenFilter && origenFilter !== "TODOS" && orig !== origenFilter) {
            return false;
          }
          return true;
        })
        .map((m: AnyObj) => ({
          id: m.id ?? 0,
          cId: targetId,
          fecha: m.fi || m.f || "",
          f: m.f || "",
          fi: m.fi || "",
          tipo: m.tcn || "COMPROBANTE",
          tcn: m.tcn || "COMPROBANTE",
          tca: m.tca || "",
          l: m.l || "",
          numero: `${m.tca || ""} ${m.l || ""} ${m.n || ""}`.trim(),
          n: m.n || "",
          dh: Number(m.dh ?? -1),
          importe: round2(m.imp ?? Math.max(Number(m.d || 0), Number(m.h || 0))),
          d: round2(m.d || 0),
          h: round2(m.h || 0),
          canc: round2(m.canc || 0),
          pend: round2(m.pend || 0),
          s: round2(m.s || 0),
          obs: m.obs || "",
          origen: String(m.origen || "VENTA").toUpperCase(),
        }));
      return NextResponse.json({ ok: true, movimientos: movs });
    }

    if (action === "google_config") {
      return NextResponse.json({
        ok: true,
        googleClientId: String(db.googleOAuthConfig?.clientId || ""),
      });
    }

    return NextResponse.json({ ok: true });
  }

  if (req.method === "POST") {
    const payload = ((await req.json().catch(() => null)) || null) as AnyObj | null;
    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { ok: false, message: "JSON inválido" },
        { status: 400 }
      );
    }

    const postAction = String(payload.action || "").trim();
    const actor = String(
      payload.usuario || payload.actor || req.headers.get("x-erp-user") || "sistema"
    );

    const { payload: db } = await getTenantDoc<AnyObj>(tenant, "clientes_db", fallback);
    if (!Array.isArray(db.clientes)) db.clientes = [];
    if (!Array.isArray(db.movimientosCtaCte)) db.movimientosCtaCte = [];
    if (!Array.isArray(db.movimientosFidelizacion)) db.movimientosFidelizacion = [];
    if (!Array.isArray(db.pedidosWeb)) db.pedidosWeb = [];
    if (!Array.isArray(db.ticketsSoyCajero)) {
      db.ticketsSoyCajero = Array.isArray(db.soyCajeroTickets) ? [...db.soyCajeroTickets] : [];
    }

    const defaultLoc = toUpperUtf8(tenant.branding.localidad || (tenant.slug === "casanueva" ? "ALCIRA GIGENA" : "RÍO CUARTO"));
    const defaultProv = toUpperUtf8(tenant.branding.provincia || "CÓRDOBA");
    const defaultCp = String(tenant.branding.cp || (tenant.slug === "casanueva" ? "5813" : "5800"));

    const commit = async (tag: string, extra: AnyObj = {}) => {
      db.updatedAt = new Date().toISOString();
      db.totalClientes = db.clientes.length;
      db.totalProveedores = db.clientes.filter((c: AnyObj) => c.esProveedor && !c.bajaLogica).length;
      db.totalMovimientosCtaCte = db.movimientosCtaCte.length;
      db.lastModifiedBy = actor;
      db.lastAction = tag;
      const saved = await putTenantDoc(tenant, "clientes_db", db, actor, tag);
      return NextResponse.json({ ok: true, rev: saved.rev, ...extra });
    };

    if (postAction === "lookup_client_by_doc") {
      const targetKeys = extractDocKeys(payload.nroDoc || payload.documento);
      const email = toUpperUtf8(payload.email);
      const found = db.clientes.find((c: AnyObj) => {
        if (Number(c.codigo) === 1) return false;
        const cKeys = extractDocKeys(c.nroDoc);
        if (hasDocIntersection(targetKeys, cKeys)) return true;
        if (email && toUpperUtf8(c.email) === email) return true;
        return false;
      });
      return NextResponse.json({ ok: true, found: Boolean(found), client: found || null });
    }

    // Actualizar Mi Perfil o Contacto de Fidelización desde la App de Clientes
    if (
      postAction === "update_client_profile" ||
      postAction === "update_client_fidelizacion_contact"
    ) {
      const data =
        payload.profile && typeof payload.profile === "object"
          ? (payload.profile as AnyObj)
          : payload;
      const cId = Number(payload.cId ?? payload.id ?? data.id ?? 0);
      const clientIdx = db.clientes.findIndex(
        (c: AnyObj) => cId > 0 && Number(c.id || 0) === cId
      );
      if (clientIdx < 0) {
        return NextResponse.json(
          { ok: false, message: "Cliente no encontrado en el padrón." },
          { status: 404 }
        );
      }

      const cliRef = db.clientes[clientIdx];
      const allowedUpper = [
        "nombre",
        "nombrePila",
        "apellido",
        "contacto",
        "calle",
        "numero",
        "piso",
        "depto",
        "dpto",
        "torre",
        "barrio",
        "pais",
        "localidad",
        "provincia",
        "cp",
        "celular",
        "telefono",
        "email",
        "observacion",
        "razonSocial",
        "calleFiscal",
        "numeroFiscal",
        "pisoFiscal",
        "deptoFiscal",
        "dptoFiscal",
        "torreFiscal",
        "barrioFiscal",
        "paisFiscal",
        "provinciaFiscal",
        "localidadFiscal",
        "cpFiscal",
        "respIva",
        "tipoDoc",
        "nroDoc",
        "usuarioWeb",
        "canalFidelizacion",
      ];
      for (const field of allowedUpper) {
        if (Object.prototype.hasOwnProperty.call(data, field)) {
          const val = toUpperUtf8(data[field]);
          if (field === "nombre" && !val) continue;
          if (field === "nroDoc" && !val && postAction === "update_client_fidelizacion_contact") {
            continue;
          }
          cliRef[field] =
            field === "numero" || field === "numeroFiscal"
              ? sanitizeStreetNumber(val)
              : val;
        }
      }
      if (cliRef.apellido && cliRef.nombrePila) {
        cliRef.nombre = `${cliRef.apellido}, ${cliRef.nombrePila}`;
      }
      if (Object.prototype.hasOwnProperty.call(data, "dpto")) {
        cliRef.depto = toUpperUtf8(data.dpto);
      }
      if (Object.prototype.hasOwnProperty.call(data, "depto")) {
        cliRef.dpto = toUpperUtf8(data.depto);
      }
      if (Object.prototype.hasOwnProperty.call(data, "dptoFiscal")) {
        cliRef.deptoFiscal = toUpperUtf8(data.dptoFiscal);
      }
      if (data.fotoUrl) {
        cliRef.fotoUrl = String(data.fotoUrl).trim();
      }
      if (data.whatsappRegistrado !== undefined) {
        cliRef.whatsappRegistrado = Boolean(data.whatsappRegistrado);
      }
      if (data.googleSub) {
        cliRef.googleSub = String(data.googleSub).trim();
      }
      if (data.claveWeb) {
        cliRef.claveWeb = String(data.claveWeb).trim();
      }
      if (Object.prototype.hasOwnProperty.call(data, "fechaNacimiento")) {
        const fnVal = String(data.fechaNacimiento || "").trim();
        if (fnVal) cliRef.fechaNacimiento = fnVal;
      }
      if (cliRef.nombre) {
        cliRef.razonSocial = cliRef.razonSocial || cliRef.nombre;
        cliRef.nombreFantasia = cliRef.nombre;
      }

      return commit(`${postAction}:${cId}`, { client: cliRef, cliente: cliRef });
    }

    if (
      postAction === "save_client" ||
      postAction === "save_proveedor" ||
      postAction === "register_online_client"
    ) {
      const incoming = (payload.client ||
        payload.cliente ||
        payload.proveedor ||
        payload) as AnyObj;
      const isProv = postAction === "save_proveedor" || Boolean(incoming.esProveedor);
      let id = Number(incoming.id || 0);
      let idx = db.clientes.findIndex((c: AnyObj) => id > 0 && Number(c.id) === id);
      const isNewOnlineReg = postAction === "register_online_client";

      if (idx < 0 && isNewOnlineReg) {
        const docKeys = extractDocKeys(incoming.nroDoc || incoming.dni);
        if (docKeys.length > 0) {
          idx = db.clientes.findIndex(
            (c: AnyObj) =>
              Number(c.codigo) !== 1 && hasDocIntersection(docKeys, extractDocKeys(c.nroDoc))
          );
          if (idx >= 0) id = Number(db.clientes[idx].id);
        }
      }

      const maxId = db.clientes.reduce(
        (mx: number, c: AnyObj) => Math.max(mx, Number(c.id || 0)),
        1
      );
      const maxCod = db.clientes.reduce(
        (mx: number, c: AnyObj) =>
          Math.max(mx, Number(c.codigo || 0), Number(c.codigoProveedor || 0)),
        1
      );

      const wasExisting = idx >= 0;
      if (id <= 0) id = maxId + 1;
      const prev = wasExisting ? db.clientes[idx] : {};
      const codigo = Number(incoming.codigo || prev.codigo || maxCod + 1);
      const nombre = toUpperUtf8(
        incoming.nombre ||
          (incoming.apellido && incoming.nombrePila
            ? `${incoming.apellido}, ${incoming.nombrePila}`
            : "") ||
          prev.nombre ||
          ""
      );

      if (!nombre) {
        return NextResponse.json(
          { ok: false, message: "El Nombre o Razón Social es obligatorio." },
          { status: 400 }
        );
      }

      const cleanNum = sanitizeStreetNumber(incoming.numero ?? prev.numero ?? "S/N");
      const cleanNumFiscal = sanitizeStreetNumber(
        incoming.numeroFiscal ?? prev.numeroFiscal ?? cleanNum
      );
      const { fmt: todayFmt } = getArDateParts();

      let claveWeb = String(incoming.claveWeb ?? prev.claveWeb ?? "").trim();
      if (isNewOnlineReg && !claveWeb) {
        const dDigits = cleanDocDigits(incoming.nroDoc || prev.nroDoc);
        claveWeb =
          dDigits.length >= 4
            ? dDigits.slice(-4)
            : `CN${String(codigo).padStart(4, "0")}`;
      }

      const merged: AnyObj = {
        ...prev,
        ...incoming,
        id,
        codigo,
        codigoProveedor: codigo,
        idProveedor: isProv
          ? Number(prev.idProveedor || 1000 + codigo)
          : Number(prev.idProveedor || 0),
        nombre,
        numero: cleanNum,
        numeroFiscal: cleanNumFiscal,
        razonSocial: toUpperUtf8(incoming.razonSocial || prev.razonSocial || nombre),
        nombreFantasia: toUpperUtf8(incoming.nombreFantasia || prev.nombreFantasia || nombre),
        pais: toUpperUtf8(incoming.pais || prev.pais || "ARGENTINA"),
        provincia: toUpperUtf8(incoming.provincia || prev.provincia || defaultProv),
        localidad: toUpperUtf8(incoming.localidad || prev.localidad || defaultLoc),
        cp: String(incoming.cp || prev.cp || defaultCp),
        listaPrecio: toUpperUtf8(incoming.listaPrecio || prev.listaPrecio || "MINORISTA"),
        esCliente:
          incoming.esCliente !== undefined
            ? Boolean(incoming.esCliente)
            : prev.esCliente ?? !isProv,
        esProveedor: isProv || Boolean(prev.esProveedor),
        estado: incoming.bajaLogica ? "B" : "A",
        fechaAlta: prev.fechaAlta || todayFmt,
        ...(claveWeb ? { claveWeb } : {}),
        accesoWebHabilitado: isNewOnlineReg
          ? 1
          : Number(incoming.accesoWebHabilitado ?? prev.accesoWebHabilitado ?? 0),
      };

      let targetIdx = idx;
      if (idx >= 0) {
        db.clientes[idx] = merged;
      } else {
        db.clientes.push(merged);
        targetIdx = db.clientes.length - 1;
      }

      let referralBonus: AnyObj = { granted: false };
      if (isNewOnlineReg) {
        const rawRef = String(
          incoming.codigoReferido ?? payload.codigoReferido ?? payload.refCode ?? ""
        ).trim();
        if (rawRef) {
          referralBonus = processReferralDualBonus(db, targetIdx, rawRef);
        }
      }

      if (merged.esProveedor) {
        await syncProveedoresToCatalog(tenant, db.clientes, actor);
      }

      const finalClient = db.clientes[targetIdx];
      return commit(postAction, {
        isNew: !wasExisting,
        referralBonus,
        client: finalClient,
        cliente: finalClient,
        proveedor: finalClient,
      });
    }

    if (postAction === "client_login") {
      const userOrDoc = toUpperUtf8(
        payload.username ?? payload.usuario ?? payload.email ?? ""
      );
      const pass = String(payload.password ?? payload.clave ?? "").trim();
      const passUpper = toUpperUtf8(pass);
      const inputDocKeys = extractDocKeys(userOrDoc);

      const cli = db.clientes.find((c: AnyObj) => {
        if (Number(c.codigo) === 1 || c.bajaLogica) return false;
        const uWeb = toUpperUtf8(c.usuarioWeb);
        const email = toUpperUtf8(c.email);
        const matchUser =
          (uWeb !== "" && uWeb === userOrDoc) ||
          (email !== "" && email === userOrDoc) ||
          hasDocIntersection(inputDocKeys, extractDocKeys(c.nroDoc));
        if (!matchUser) return false;
        const cPassRaw = String(c.claveWeb ?? "").trim();
        const cPassUpper = toUpperUtf8(cPassRaw);
        return (
          cPassUpper !== "" &&
          (cPassUpper === passUpper || cPassRaw === pass)
        );
      });

      if (!cli) {
        return NextResponse.json(
          { ok: false, message: "USUARIO O CONTRASEÑA DE CLIENTE INCORRECTOS." },
          { status: 401 }
        );
      }
      return NextResponse.json({ ok: true, client: cli, cliente: cli });
    }

    if (postAction === "recover_client_password") {
      const emailOrUser = toUpperUtf8(payload.email ?? payload.username ?? "");
      if (!emailOrUser) {
        return NextResponse.json(
          { ok: false, message: "Ingresá tu correo electrónico o DNI." },
          { status: 400 }
        );
      }
      const inputDocKeys = extractDocKeys(emailOrUser);
      const foundIdx = db.clientes.findIndex((c: AnyObj) => {
        if (Number(c.codigo) === 1 || c.bajaLogica) return false;
        const em = toUpperUtf8(c.email);
        const uWeb = toUpperUtf8(c.usuarioWeb);
        return (
          (em !== "" && em === emailOrUser) ||
          (uWeb !== "" && uWeb === emailOrUser) ||
          hasDocIntersection(inputDocKeys, extractDocKeys(c.nroDoc))
        );
      });

      if (foundIdx < 0) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "No encontramos una cuenta registrada con ese correo electrónico o DNI.",
          },
          { status: 404 }
        );
      }

      const cli = db.clientes[foundIdx];
      let claveActual = String(cli.claveWeb || "").trim();
      let stateChanged = false;
      if (!claveActual) {
        const docDigits = cleanDocDigits(cli.nroDoc);
        const codCli = Number(cli.codigo || cli.id || 1);
        claveActual =
          docDigits.length >= 4
            ? docDigits.slice(-4)
            : `CN${String(codCli).padStart(4, "0")}`;
        cli.claveWeb = claveActual;
        stateChanged = true;
      }
      if (!cli.usuarioWeb && cli.email) {
        cli.usuarioWeb = toUpperUtf8(cli.email);
        stateChanged = true;
      }

      const targetEmail = String(cli.email || "").trim().toLowerCase();
      const targetPhone = String(cli.celular || "").trim();
      const isGoogleAcc =
        Boolean(cli.googleSub) || toUpperUtf8(cli.origenRegistro) === "GOOGLE";

      if (stateChanged) {
        await commit("recover_client_password");
      }

      return NextResponse.json({
        ok: true,
        email: targetEmail,
        emailSent: false,
        isGoogleAcc,
        hasPhone: targetPhone !== "",
        message: targetEmail
          ? `Se procesó el recordatorio de acceso para ${targetEmail}.`
          : "Se verificó tu cuenta de cliente.",
      });
    }

    if (postAction === "client_google_auth") {
      const credential = String(payload.credential || "").trim();
      const googleProfile =
        payload.googleProfile && typeof payload.googleProfile === "object"
          ? (payload.googleProfile as AnyObj)
          : {};

      let emailRaw = String(googleProfile.email || "").trim();
      let nombreRaw = String(googleProfile.nombre || googleProfile.name || "").trim();
      let googleSub = String(googleProfile.sub || googleProfile.googleSub || "").trim();
      let picture = String(googleProfile.picture || "").trim();

      const jwtData = credential ? decodeGoogleJwtPayload(credential) : null;
      if (jwtData) {
        if (jwtData.email) emailRaw = String(jwtData.email).trim();
        if (jwtData.name) {
          nombreRaw = String(jwtData.name).trim();
        } else if (jwtData.given_name || jwtData.family_name) {
          nombreRaw = `${jwtData.given_name || ""} ${jwtData.family_name || ""}`.trim();
        }
        if (jwtData.sub) googleSub = String(jwtData.sub).trim();
        if (jwtData.picture) picture = String(jwtData.picture).trim();
      }

      const emailUpper = toUpperUtf8(emailRaw);
      let nombreUpper = toUpperUtf8(nombreRaw);
      const nroDocRaw = toUpperUtf8(googleProfile.nroDoc ?? payload.nroDoc ?? "");
      const tipoDocRaw = toUpperUtf8(googleProfile.tipoDoc ?? payload.tipoDoc ?? "DNI");
      const celularRaw = toUpperUtf8(googleProfile.celular ?? payload.celular ?? "");
      const calleRaw = toUpperUtf8(googleProfile.calle ?? payload.calle ?? "");
      const numeroRaw = toUpperUtf8(googleProfile.numero ?? payload.numero ?? "");
      const localidadRaw = toUpperUtf8(
        googleProfile.localidad ?? payload.localidad ?? defaultLoc
      );
      const provinciaRaw = toUpperUtf8(
        googleProfile.provincia ?? payload.provincia ?? defaultProv
      );
      const cpRaw = String(googleProfile.cp ?? payload.cp ?? defaultCp).trim();

      if (!emailUpper || !emailUpper.includes("@")) {
        return NextResponse.json(
          {
            ok: false,
            message: "NO SE RECIBIÓ UN CORREO ELECTRÓNICO DE GOOGLE VÁLIDO.",
          },
          { status: 400 }
        );
      }

      const incomingDocKeys = extractDocKeys(nroDocRaw);
      let foundIndex = -1;
      for (let idx = 0; idx < db.clientes.length; idx++) {
        const existing = db.clientes[idx];
        if (!existing || Number(existing.codigo) === 1) continue;
        const exSub = String(existing.googleSub || "").trim();
        const exEmail = toUpperUtf8(existing.email);
        const exEmailSec = toUpperUtf8(existing.emailSecundario);
        if (googleSub && exSub && exSub === googleSub) {
          foundIndex = idx;
          break;
        }
        if (
          exEmail &&
          (exEmail === emailUpper || (exEmailSec && exEmailSec === emailUpper))
        ) {
          foundIndex = idx;
          break;
        }
        if (
          incomingDocKeys.length > 0 &&
          hasDocIntersection(incomingDocKeys, extractDocKeys(existing.nroDoc))
        ) {
          foundIndex = idx;
          break;
        }
      }

      const reviewData = Boolean(payload.reviewData);
      const requireDniStep = Boolean(payload.requireDniStep);

      if (foundIndex >= 0) {
        const cli = db.clientes[foundIndex];
        if (googleSub) cli.googleSub = googleSub;
        if (picture) cli.fotoUrl = picture;
        if (!cli.email) cli.email = emailUpper;
        if (celularRaw && !cli.celular) cli.celular = celularRaw;
        if (nroDocRaw && extractDocKeys(cli.nroDoc).length === 0) {
          cli.nroDoc = nroDocRaw;
          cli.tipoDoc = tipoDocRaw || "DNI";
        }
        if (!cli.usuarioWeb) {
          const baseUser = (emailUpper.split("@")[0] || "CLIENTE").replace(
            /[^A-Z0-9]/g,
            ""
          );
          cli.usuarioWeb = baseUser || `CLI${cli.codigo}`;
        }
        cli.accesoWebHabilitado = 1;

        return commit("client_google_auth", {
          isNew: false,
          client: cli,
          existingClient: cli,
          googleProfile: {
            email: emailUpper,
            nombre: nombreUpper || cli.nombre || "",
            googleSub,
            picture: picture || cli.fotoUrl || "",
          },
        });
      }

      if ((requireDniStep || reviewData) && incomingDocKeys.length === 0) {
        return NextResponse.json({
          ok: true,
          needsRegistration: true,
          googleProfile: {
            email: emailUpper,
            nombre: nombreUpper || emailUpper.split("@")[0],
            googleSub,
            picture,
          },
        });
      }

      if (!nombreUpper) {
        nombreUpper = toUpperUtf8(emailUpper.split("@")[0] || "CLIENTE GOOGLE");
      }

      const usedCodes = new Set<number>();
      const usedWebUsers = new Set<string>();
      let maxId = 0;
      for (const existing of db.clientes) {
        const eId = Number(existing?.id || 0);
        if (eId > maxId) maxId = eId;
        const eCod = Number(existing?.codigo || 0);
        if (eCod > 0) usedCodes.add(eCod);
        const eCodProv = Number(existing?.codigoProveedor || 0);
        if (eCodProv > 0) usedCodes.add(eCodProv);
        const u = toUpperUtf8(existing?.usuarioWeb);
        if (u) usedWebUsers.add(u);
      }

      let nextCodigo = 2;
      while (usedCodes.has(nextCodigo)) nextCodigo++;

      let baseUser = (emailUpper.split("@")[0] || "GOOGLE").replace(/[^A-Z0-9]/g, "");
      if (!baseUser) baseUser = `SOCIO${nextCodigo}`;
      let candidateUser = baseUser;
      let suffix = 1;
      while (usedWebUsers.has(candidateUser)) {
        candidateUser = `${baseUser}${suffix}`;
        suffix++;
      }

      let claveWeb = toUpperUtf8(googleProfile.claveWeb ?? payload.claveWeb ?? "");
      if (!claveWeb) {
        const docDigits = cleanDocDigits(nroDocRaw);
        claveWeb =
          docDigits.length >= 4
            ? docDigits.slice(-4)
            : `CN${String(nextCodigo).padStart(4, "0")}`;
      }

      const { fmt: todayFmt } = getArDateParts();
      const cleanStreetNum = sanitizeStreetNumber(numeroRaw || "S/N");
      const newCli: AnyObj = {
        id: maxId + 1,
        codigo: nextCodigo,
        codigoProveedor: nextCodigo,
        esCliente: true,
        esProveedor: false,
        estado: "ACTIVO",
        bajaLogica: 0,
        accesoWebHabilitado: 1,
        fechaAlta: todayFmt,
        nombre: nombreUpper,
        razonSocial: nombreUpper,
        nombreFantasia: nombreUpper,
        contacto: nombreUpper,
        calle: calleRaw || "S/D",
        numero: cleanStreetNum,
        barrio: "",
        pais: "ARGENTINA",
        provincia: provinciaRaw || defaultProv,
        localidad: localidadRaw || defaultLoc,
        cp: cpRaw || defaultCp,
        calleFiscal: calleRaw || "S/D",
        numeroFiscal: cleanStreetNum,
        barrioFiscal: "",
        paisFiscal: "ARGENTINA",
        provinciaFiscal: provinciaRaw || defaultProv,
        localidadFiscal: localidadRaw || defaultLoc,
        cpFiscal: cpRaw || defaultCp,
        celular: celularRaw,
        telefono: "",
        email: emailUpper,
        respIva: "CONSUMIDOR FINAL",
        tipoDoc: tipoDocRaw || "DNI",
        nroDoc: nroDocRaw,
        regimenIibb: "NO INSCRIPTO",
        nroIibb: "",
        listaPrecio: "MINORISTA",
        listaPrecioId: 1,
        usuarioWeb: candidateUser,
        claveWeb,
        googleSub,
        fotoUrl: picture,
        origenRegistro: "GOOGLE",
        observacion: `ALTA ONLINE CON GOOGLE (${emailUpper})`,
        cantMovs: 0,
        totalDebe: 0,
        totalHaber: 0,
        saldoActual: 0,
        ultimoMovFecha: "",
        puntosFidelizacion: 0,
        puntosAcumuladosHist: 0,
        puntosCanjeadosHist: 0,
        canalFidelizacion: "WHATSAPP",
      };

      db.clientes.push(newCli);
      const newCliIdx = db.clientes.length - 1;
      const rawRefGoogle = String(
        googleProfile.codigoReferido ?? payload.codigoReferido ?? payload.refCode ?? ""
      ).trim();
      let referralBonusGoogle: AnyObj = { granted: false };
      if (rawRefGoogle) {
        referralBonusGoogle = processReferralDualBonus(db, newCliIdx, rawRefGoogle);
      }

      return commit("client_google_auth", {
        isNew: true,
        referralBonus: referralBonusGoogle,
        client: db.clientes[newCliIdx],
      });
    }

    if (postAction === "add_ctacte_movement") {
      const movIn = (payload.movement || payload) as AnyObj;
      const cId = Number(payload.idCliente || payload.cId || payload.clienteId || movIn.cId || 0);
      const ent = db.clientes.find((c: AnyObj) => Number(c.id) === cId);
      if (!ent) {
        return NextResponse.json(
          { ok: false, message: "Titular no encontrado." },
          { status: 404 }
        );
      }
      const maxMovId = db.movimientosCtaCte.reduce(
        (mx: number, m: AnyObj) => Math.max(mx, Number(m.id || 0)),
        0
      );
      const imp = round2(movIn.imp ?? movIn.importe ?? payload.importe ?? payload.imp ?? 0);
      const isDebe =
        movIn.tipoMov === "DEBE" ||
        payload.tipoMov === "DEBE" ||
        Number(movIn.dh ?? payload.dh) === 1 ||
        Number(movIn.d ?? payload.d ?? 0) > 0;
      const { iso: todayIso, fmt: todayFmt } = getArDateParts();
      const fStr = String(movIn.f || movIn.fecha || payload.fecha || todayFmt);
      const letraStr = String(movIn.l || movIn.letra || payload.letra || "B").trim().toUpperCase();
      const nroStr = String(movIn.n || movIn.numero || payload.numero || String(maxMovId + 1).padStart(8, "0")).trim().toUpperCase();
      const origenStr = String(movIn.origen || payload.origen || (ent.esProveedor && !ent.esCliente ? "COMPRA" : "VENTA")).trim().toUpperCase();
      const dhVal = isDebe ? 1 : -1;

      if (/\d{4}-\d{6,8}/.test(nroStr) && imp > 0.009) {
        const existingDup = db.movimientosCtaCte.find(
          (m: AnyObj) =>
            Number(m.cId) === cId &&
            Number(m.dh) === dhVal &&
            String(m.origen || "VENTA").trim().toUpperCase() === origenStr &&
            String(m.l || "B").trim().toUpperCase() === letraStr &&
            String(m.n || "").trim().toUpperCase() === nroStr &&
            Math.abs(Number(m.imp || 0) - imp) < 0.01
        );
        if (existingDup) {
          const clientMovs = db.movimientosCtaCte.filter((m: AnyObj) => Number(m.cId) === cId);
          return NextResponse.json({
            ok: true,
            movimiento: existingDup,
            movement: existingDup,
            client: ent,
            movimientos: clientMovs,
          });
        }
      }

      const mov: AnyObj = {
        id: maxMovId + 1,
        cId,
        f: fStr,
        fi: String(movIn.fi || movIn.fechaIso || payload.fechaIso || todayIso),
        v: String(movIn.v || payload.v || ""),
        tc: Number(movIn.tc ?? payload.tc ?? (isDebe ? 20 : 21)),
        tcn: String(movIn.tcn || movIn.tipoComprobante || payload.tipoComprobante || (isDebe ? "FACTURA" : "RECIBO")),
        tca: String(movIn.tca || payload.tca || (isDebe ? "FC" : "RC")),
        l: letraStr,
        n: nroStr,
        dh: dhVal,
        imp,
        d: isDebe ? imp : 0,
        h: isDebe ? 0 : imp,
        canc: 0,
        pend: imp,
        obs: String(movIn.obs || movIn.observacion || payload.observacion || ""),
        origen: origenStr,
        ...(Array.isArray(movIn.items) ? { items: movIn.items } : {}),
        ...(Array.isArray(movIn.fcrItems) ? { fcrItems: movIn.fcrItems } : {}),
        ...(movIn.fcrModoIva === "neto" || movIn.fcrModoIva === "final"
          ? { fcrModoIva: movIn.fcrModoIva }
          : {}),
        createdAt: new Date().toISOString(),
        usuario: actor,
      };
      db.movimientosCtaCte.push(mov);
      recomputeEntityCtaCteStats(db, cId);
      const clientMovs = db.movimientosCtaCte.filter((m: AnyObj) => Number(m.cId) === cId);
      return commit("add_ctacte_movement", {
        movimiento: mov,
        movement: mov,
        client: ent,
        movimientos: clientMovs,
      });
    }

    if (postAction === "update_ctacte_movement") {
      const movIn = (payload.movement || payload) as AnyObj;
      const movId = Number(payload.movId || movIn.id || payload.id || 0);
      const newCid = Number(payload.idCliente || movIn.cId || payload.cId || 0);
      const oldCid = Number(payload.oldClientId || 0);
      const movIdx = db.movimientosCtaCte.findIndex((m: AnyObj) => Number(m.id) === movId);
      if (movIdx < 0) {
        return NextResponse.json(
          { ok: false, message: "Movimiento no encontrado para editar." },
          { status: 404 }
        );
      }
      const existing = db.movimientosCtaCte[movIdx];
      const targetCid = newCid > 0 ? newCid : Number(existing.cId || 0);
      const ent = db.clientes.find((c: AnyObj) => Number(c.id) === targetCid);
      if (!ent) {
        return NextResponse.json(
          { ok: false, message: "Titular no encontrado." },
          { status: 404 }
        );
      }
      const prevCid = oldCid > 0 ? oldCid : Number(existing.cId || 0);
      const imp = round2(movIn.imp ?? movIn.importe ?? existing.imp ?? 0);
      const isDebe = Number(movIn.dh ?? existing.dh ?? 1) === 1;
      const { iso: todayIso, fmt: todayFmt } = getArDateParts();
      const updatedMov: AnyObj = {
        ...existing,
        cId: targetCid,
        f: String(movIn.f || existing.f || todayFmt),
        fi: String(movIn.fi || existing.fi || todayIso),
        v: String(movIn.v ?? existing.v ?? ""),
        tc: Number(movIn.tc ?? existing.tc ?? (isDebe ? 20 : 21)),
        tcn: String(movIn.tcn || existing.tcn || "FACTURA"),
        tca: String(movIn.tca || existing.tca || "FC"),
        l: String(movIn.l || existing.l || "B"),
        n: String(movIn.n || existing.n || ""),
        dh: isDebe ? 1 : -1,
        imp,
        d: isDebe ? imp : 0,
        h: isDebe ? 0 : imp,
        pend: Math.max(0, round2(imp - Number(existing.canc || 0))),
        obs: String(movIn.obs ?? existing.obs ?? ""),
        origen: String(movIn.origen || existing.origen || "COMPRA"),
        ...(Array.isArray(movIn.items) ? { items: movIn.items } : {}),
        ...(Array.isArray(movIn.fcrItems) ? { fcrItems: movIn.fcrItems } : {}),
        ...(movIn.fcrModoIva === "neto" || movIn.fcrModoIva === "final"
          ? { fcrModoIva: movIn.fcrModoIva }
          : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: actor,
      };
      db.movimientosCtaCte[movIdx] = updatedMov;
      recomputeEntityCtaCteStats(db, targetCid);
      let oldClient: AnyObj | undefined;
      let oldMovimientos: AnyObj[] | undefined;
      if (prevCid > 0 && prevCid !== targetCid) {
        recomputeEntityCtaCteStats(db, prevCid);
        oldClient = db.clientes.find((c: AnyObj) => Number(c.id) === prevCid);
        oldMovimientos = db.movimientosCtaCte.filter((m: AnyObj) => Number(m.cId) === prevCid);
      }
      const clientMovs = db.movimientosCtaCte.filter((m: AnyObj) => Number(m.cId) === targetCid);
      return commit("update_ctacte_movement", {
        movimiento: updatedMov,
        movement: updatedMov,
        client: ent,
        movimientos: clientMovs,
        ...(oldClient ? { oldClient, oldMovimientos } : {}),
      });
    }

    if (postAction === "annul_ctacte_movement") {
      const movId = Number(payload.movId || payload.id || 0);
      const cId = Number(payload.cId || 0);
      const mov = db.movimientosCtaCte.find(
        (m: AnyObj) => Number(m.id) === movId && (!cId || Number(m.cId) === cId)
      );
      if (!mov) {
        return NextResponse.json(
          { ok: false, message: "Movimiento no encontrado o ya anulado" },
          { status: 404 }
        );
      }
      mov.anulado = true;
      db.movimientosCtaCte = db.movimientosCtaCte.filter((m: AnyObj) => Number(m.id) !== movId);
      recomputeEntityCtaCteStats(db, Number(mov.cId));
      return commit("annul_ctacte_movement", { movId });
    }

    if (
      postAction === "impute_existing_credits" ||
      postAction === "compensar_saldos_ctacte" ||
      postAction === "unify_clientes_proveedores_codes"
    ) {
      if (payload.cId) recomputeEntityCtaCteStats(db, Number(payload.cId));
      return commit(postAction, {});
    }

    if (postAction === "create_web_order") {
      const orderIn = (payload.order || payload.pedido || payload) as AnyObj;
      const nextNum = db.pedidosWeb.length + 1;
      const { iso: todayIso, fmt: todayFmt, hora } = getArDateParts();
      const savedOrder: AnyObj = {
        ...orderIn,
        id: orderIn.id ?? nextNum,
        nroPedido: nextNum,
        numero: `WEB-${String(nextNum).padStart(5, "0")}`,
        fecha: orderIn.fecha || todayFmt,
        fechaIso: orderIn.fechaIso || todayIso,
        hora: orderIn.hora || hora,
        fechaHora: `${todayFmt} ${hora}`,
        createdAt: new Date().toISOString(),
        createdAtIso: new Date().toISOString(),
        estado: orderIn.estado || "PENDIENTE",
        estadoDespacho: "PENDIENTE",
      };
      db.pedidosWeb.unshift(savedOrder);
      return commit("create_web_order", { order: savedOrder, pedido: savedOrder });
    }

    if (postAction === "mark_web_order_dispatched") {
      const orderId = String(payload.id || payload.orderId || "");
      const found = db.pedidosWeb.find((o: AnyObj) => String(o.id) === orderId);
      if (found) {
        found.estado = String(payload.estado || "DESPACHADO");
        found.estadoDespacho = String(payload.estado || "DESPACHADO");
        found.dispatchedAt = new Date().toISOString();
      }
      return commit("mark_web_order_dispatched", { order: found });
    }

    if (postAction === "save_fidelizacion_config") {
      db.fidelizacionConfig = {
        ...(db.fidelizacionConfig || {}),
        ...(payload.config || payload),
      };
      return commit("save_fidelizacion_config", {
        fidelizacionConfig: db.fidelizacionConfig,
        config: db.fidelizacionConfig,
      });
    }

    if (postAction === "save_google_oauth_config") {
      const clientId = String(
        payload.googleClientId ?? payload.clientId ?? payload.config?.clientId ?? ""
      ).trim();
      db.googleOAuthConfig = {
        ...(db.googleOAuthConfig || {}),
        enabled: Boolean(payload.enabled ?? true),
        clientId,
        updatedAt: new Date().toISOString(),
      };
      return commit("save_google_oauth_config", {
        googleClientId: clientId,
        googleOAuthConfig: db.googleOAuthConfig,
      });
    }

    // OTP / WhatsApp verification
    if (
      postAction === "send_whatsapp_twilio" ||
      postAction === "request_whatsapp_otp" ||
      postAction === "test_twilio_whatsapp"
    ) {
      let cId = Number(payload.cId || 0);
      const rawPhone = String(
        payload.phone ?? payload.toPhone ?? payload.celular ?? ""
      ).trim();
      const digitsOnly = cleanDocDigits(rawPhone);
      const generateOtp =
        Boolean(payload.generateOtp) || postAction === "request_whatsapp_otp";

      if (!db.fidelizacionConfig || typeof db.fidelizacionConfig !== "object") {
        db.fidelizacionConfig = {};
      }
      if (payload.twilioAccountSid) {
        db.fidelizacionConfig.twilioAccountSid = String(payload.twilioAccountSid).trim();
      }
      if (
        payload.twilioAuthToken &&
        !String(payload.twilioAuthToken).includes("••••")
      ) {
        db.fidelizacionConfig.twilioAuthToken = String(payload.twilioAuthToken).trim();
      }
      if (payload.twilioFromNumber) {
        db.fidelizacionConfig.twilioFromNumber = String(payload.twilioFromNumber).trim();
      }

      let targetCliIdx = -1;
      if (cId > 0) {
        targetCliIdx = db.clientes.findIndex((c: AnyObj) => Number(c.id || 0) === cId);
      }
      if (targetCliIdx < 0) {
        const inDocKeys = extractDocKeys(payload.nroDoc);
        const inEmail = toUpperUtf8(payload.email);
        targetCliIdx = db.clientes.findIndex((c: AnyObj) => {
          if (hasDocIntersection(inDocKeys, extractDocKeys(c.nroDoc))) return true;
          if (inEmail && inEmail.includes("@") && toUpperUtf8(c.email) === inEmail) {
            return true;
          }
          return false;
        });
      }

      let otpCode = "";
      let stateChanged = false;
      let updatedCli: AnyObj | null = null;
      const brandFull = tenant.business_name || "Casa Nueva Supermercado";
      let customMsg = String(payload.message || "").trim();

      if (generateOtp) {
        otpCode = String(Math.floor(100000 + Math.random() * 900000));
        if (!db.whatsappOtps || typeof db.whatsappOtps !== "object") {
          db.whatsappOtps = {};
        }
        const expSec = Math.floor(Date.now() / 1000) + 900;
        if (digitsOnly) {
          db.whatsappOtps[digitsOnly] = {
            code: otpCode,
            phone: rawPhone,
            expires: expSec,
          };
          stateChanged = true;
        }
        if (targetCliIdx >= 0) {
          if (rawPhone) db.clientes[targetCliIdx].celular = toUpperUtf8(rawPhone);
          db.clientes[targetCliIdx].whatsappOtpCode = otpCode;
          db.clientes[targetCliIdx].whatsappOtpExpires = expSec;
          updatedCli = db.clientes[targetCliIdx];
          cId = Number(updatedCli?.id || cId);
          stateChanged = true;
        }
        customMsg = `🔐 *CLUB FIDEL — ${toUpperUtf8(brandFull)}*\nTu código numérico para verificar tu WhatsApp es:\n\n👉 *${otpCode}*\n\nIngresá este código de 6 dígitos en la App para confirmar tu número.`;
      } else {
        if (targetCliIdx >= 0) {
          if (rawPhone) db.clientes[targetCliIdx].celular = toUpperUtf8(rawPhone);
          db.clientes[targetCliIdx].whatsappRegistrado = true;
          db.clientes[targetCliIdx].canalFidelizacion = "WHATSAPP";
          updatedCli = db.clientes[targetCliIdx];
          cId = Number(updatedCli?.id || cId);
          stateChanged = true;
        }
        if (!customMsg) {
          customMsg = `✅ *CLUB FIDEL — ${toUpperUtf8(brandFull)}*\nTu número de WhatsApp (${rawPhone}) fue vinculado exitosamente.`;
        }
      }

      let webhookSent = false;
      const webhookUrl = String(db.fidelizacionConfig?.webhookWhatsappUrl || "").trim();
      if (webhookUrl && rawPhone) {
        try {
          const whRes = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: digitsOnly,
              message: customMsg,
              otpCode,
              cId,
            }),
          });
          webhookSent = whRes.ok;
        } catch {
          webhookSent = false;
        }
      }

      if (stateChanged) {
        return commit(`send_whatsapp_twilio:${cId}`, {
          otpGenerated: generateOtp,
          otpCode,
          whatsappRegistrado: !generateOtp,
          twilioSent: false,
          webhookSent,
          emailSent: false,
          client: updatedCli,
        });
      }

      return NextResponse.json({
        ok: true,
        otpGenerated: generateOtp,
        otpCode,
        whatsappRegistrado: !generateOtp,
        twilioSent: false,
        webhookSent,
        emailSent: false,
        client: updatedCli,
      });
    }

    if (postAction === "verify_whatsapp_otp") {
      let cId = Number(payload.cId || 0);
      const rawPhone = String(payload.phone ?? payload.celular ?? "").trim();
      const digitsOnly = cleanDocDigits(rawPhone);
      const inputCode = cleanDocDigits(payload.code ?? payload.otpCode ?? "");

      if (!inputCode || inputCode.length < 4) {
        return NextResponse.json(
          { ok: false, message: "Ingresá el código numérico de 6 dígitos." },
          { status: 400 }
        );
      }

      let targetCliIdx = -1;
      if (cId > 0) {
        targetCliIdx = db.clientes.findIndex((c: AnyObj) => Number(c.id || 0) === cId);
      }
      if (targetCliIdx < 0) {
        const inDocKeys = extractDocKeys(payload.nroDoc);
        const inEmail = toUpperUtf8(payload.email);
        targetCliIdx = db.clientes.findIndex((c: AnyObj) => {
          if (hasDocIntersection(inDocKeys, extractDocKeys(c.nroDoc))) return true;
          if (inEmail && inEmail.includes("@") && toUpperUtf8(c.email) === inEmail) {
            return true;
          }
          return false;
        });
      }

      let expectedCode = "";
      if (targetCliIdx >= 0 && db.clientes[targetCliIdx].whatsappOtpCode) {
        expectedCode = String(db.clientes[targetCliIdx].whatsappOtpCode);
      }
      if (
        !expectedCode &&
        digitsOnly &&
        db.whatsappOtps &&
        db.whatsappOtps[digitsOnly]?.code
      ) {
        expectedCode = String(db.whatsappOtps[digitsOnly].code);
      }

      if (expectedCode && inputCode !== expectedCode) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "El código ingresado es incorrecto. Verificá los 6 dígitos e intentá nuevamente.",
          },
          { status: 400 }
        );
      }

      let updatedCli: AnyObj | null = null;
      if (targetCliIdx >= 0) {
        if (rawPhone) db.clientes[targetCliIdx].celular = toUpperUtf8(rawPhone);
        db.clientes[targetCliIdx].whatsappRegistrado = true;
        db.clientes[targetCliIdx].canalFidelizacion = "WHATSAPP";
        delete db.clientes[targetCliIdx].whatsappOtpCode;
        delete db.clientes[targetCliIdx].whatsappOtpExpires;
        updatedCli = db.clientes[targetCliIdx];
        cId = Number(updatedCli?.id || cId);
      }
      if (digitsOnly && db.whatsappOtps && db.whatsappOtps[digitsOnly]) {
        delete db.whatsappOtps[digitsOnly];
      }

      return commit(`verify_whatsapp_otp:${cId}`, {
        whatsappRegistrado: true,
        client: updatedCli,
      });
    }

    if (postAction === "add_fidelizacion_points") {
      let cId = Number(
        payload.cId ?? payload.idCliente ?? payload.clienteId ?? payload.clientId ?? 0
      );
      const clienteCodigo = String(payload.clienteCodigo ?? payload.codigo ?? "").trim();
      const dniRaw = String(
        payload.dni ?? payload.nroDoc ?? payload.clienteDoc ?? ""
      ).trim();
      const montoCompra = round2(payload.montoCompra ?? payload.importe ?? 0);
      const porcentaje =
        Number(payload.porcentaje || 0) > 0
          ? Number(payload.porcentaje)
          : Number(payload.porcentajeAplicado || 0) > 0
            ? Number(payload.porcentajeAplicado)
            : Number(db.fidelizacionConfig?.porcentajeCompra ?? 0.8);
      const diasVigencia =
        Number(payload.diasVigencia || 0) > 0
          ? Math.round(Number(payload.diasVigencia))
          : Math.max(1, Math.round(Number(db.fidelizacionConfig?.diasVigencia ?? 365)));

      const puntosManual =
        payload.puntosManual !== undefined || payload.puntos !== undefined
          ? Math.round(Number(payload.puntosManual ?? payload.puntos ?? 0))
          : 0;
      const puntosSumados =
        puntosManual > 0
          ? puntosManual
          : Math.round(montoCompra * (porcentaje / 100));

      if (puntosSumados <= 0) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "El monto ingresado no alcanza para generar al menos 1 punto entero.",
          },
          { status: 400 }
        );
      }

      let clientIdx = -1;
      if (cId > 0) {
        clientIdx = db.clientes.findIndex((c: AnyObj) => {
          const aliasIds = Array.isArray(c.aliasIds)
            ? c.aliasIds.map((x: unknown) => Number(x))
            : [];
          return Number(c.id || 0) === cId || aliasIds.includes(cId);
        });
      }
      if (clientIdx < 0 && clienteCodigo && clienteCodigo !== "1") {
        clientIdx = db.clientes.findIndex((c: AnyObj) => {
          const aliasCods = Array.isArray(c.aliasCodigos)
            ? c.aliasCodigos.map((x: unknown) => String(x))
            : [];
          return String(c.codigo || "") === clienteCodigo || aliasCods.includes(clienteCodigo);
        });
      }
      if (clientIdx < 0 && dniRaw) {
        const tKeys = extractDocKeys(dniRaw);
        clientIdx = db.clientes.findIndex((c: AnyObj) =>
          hasDocIntersection(tKeys, extractDocKeys(c.nroDoc))
        );
      }

      if (clientIdx < 0) {
        return NextResponse.json(
          { ok: false, message: "Cliente no encontrado. Dalo de alta primero." },
          { status: 404 }
        );
      }

      const cliRef = db.clientes[clientIdx];
      cId = Number(cliRef.id);
      if (payload.celular) cliRef.celular = toUpperUtf8(payload.celular);
      if (payload.email) cliRef.email = toUpperUtf8(payload.email);
      if (payload.canalFidelizacion) {
        cliRef.canalFidelizacion = toUpperUtf8(payload.canalFidelizacion);
      }

      const { iso: todayIso, fmt: todayFmt, hora } = getArDateParts();
      const { iso: vencIso, fmt: vencFmt } = addDaysToIso(todayIso, diasVigencia);
      const compUpper = toUpperUtf8(payload.comprobante || "COMPRA MOSTRADOR");
      const mComp = /(\d{4}-\d{8})/.exec(compUpper);
      const compNormMatch = mComp ? mComp[1] : "";

      if (compNormMatch) {
        const existingMov = db.movimientosFidelizacion.find(
          (fm: AnyObj) =>
            getfidMovClientId(fm) === cId &&
            fm.tipo === "SUMA" &&
            String(fm.comprobante || "").includes(compNormMatch)
        );
        if (existingMov) {
          return NextResponse.json({
            ok: true,
            alreadyExists: true,
            movement: existingMov,
            movimiento: existingMov,
            client: cliRef,
          });
        }
      }

      const maxFid = db.movimientosFidelizacion.reduce(
        (m: number, x: AnyObj) => Math.max(m, Number(x.id || 0)),
        0
      );
      const newFidMov: AnyObj = {
        id: maxFid + 1,
        cId,
        clienteId: cId,
        dni: cliRef.nroDoc || dniRaw,
        clienteNombre: cliRef.nombre || "",
        tipo: "SUMA",
        fechaEmision: todayFmt,
        fechaEmisionIso: todayIso,
        hora,
        fechaVencimiento: vencFmt,
        fechaVencIso: vencIso,
        montoCompra,
        importeCompra: montoCompra,
        porcentajeAplicado: porcentaje,
        puntos: puntosSumados,
        puntosConsumidos: 0,
        puntosRestantes: puntosSumados,
        comprobante: compUpper,
        canalEnviado: toUpperUtf8(
          payload.canalEnviado ??
            payload.canalNotificacion ??
            cliRef.canalFidelizacion ??
            "WHATSAPP"
        ),
        obs: toUpperUtf8(payload.obs ?? payload.observacion ?? ""),
        usuario: actor,
      };

      db.movimientosFidelizacion.push(newFidMov);
      recomputeClientFidTotals(db, clientIdx);
      cliRef.ultimoMovFidelizacion = todayFmt;

      return commit("add_fidelizacion_points", {
        movement: newFidMov,
        movimiento: newFidMov,
        client: cliRef,
      });
    }

    if (postAction === "deliver_fidelizacion_canje") {
      const targetMovId = Number(payload.movId ?? payload.id ?? payload.canjeId ?? 0);
      const targetMovIds = Array.isArray(payload.movIds)
        ? payload.movIds.map((x: unknown) => Number(x)).filter((n: number) => n > 0)
        : [];
      if (targetMovId > 0 && !targetMovIds.includes(targetMovId)) {
        targetMovIds.push(targetMovId);
      }
      const targetTicket = toUpperUtf8(payload.nroTicketCanje);

      if (!targetMovIds.length && !targetTicket) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Indicá el ID del canje o el N° de Ticket para registrar la entrega.",
          },
          { status: 400 }
        );
      }

      const { fmt: todayFmt, hora } = getArDateParts();
      const fechaEntregaStr = `${todayFmt} ${hora}`;
      const deliveredMovs: AnyObj[] = [];
      const itemsToDeduct: Array<{
        artId: number;
        artCodigo: string;
        cantidad: number;
      }> = [];

      for (const mRef of db.movimientosFidelizacion) {
        if (!mRef || mRef.tipo !== "CANJE") continue;
        const mId = Number(mRef.id || 0);
        const mTk = toUpperUtf8(mRef.nroTicketCanje);
        const matches =
          (targetMovIds.length > 0 && targetMovIds.includes(mId)) ||
          (targetTicket !== "" && mTk !== "" && mTk === targetTicket);
        if (!matches) continue;
        if (toUpperUtf8(mRef.estadoEntrega || "PENDIENTE") === "ENTREGADO") {
          continue;
        }
        if (!mRef.nroTicketCanje) {
          mRef.nroTicketCanje = `CJ-${String(mId).padStart(5, "0")}`;
        }
        mRef.estadoEntrega = "ENTREGADO";
        mRef.stockDescontado = true;
        mRef.fechaEntrega = fechaEntregaStr;
        mRef.entregadoAt = new Date().toISOString();
        mRef.entregadoPor = actor;
        deliveredMovs.push(mRef);
        itemsToDeduct.push({
          artId: Number(mRef.artId ?? mRef.articuloId ?? 0),
          artCodigo: toUpperUtf8(mRef.artCodigo ?? mRef.articuloCodigo ?? ""),
          cantidad: Math.max(1, Number(mRef.cantidad || 1)),
        });
      }

      if (!deliveredMovs.length) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Este canje ya figura como ENTREGADO o no fue encontrado.",
          },
          { status: 400 }
        );
      }

      const updatedArticles = await deductCatalogStockForCanje(
        tenant,
        itemsToDeduct,
        actor,
        "deliver_canje_stock_deduct"
      );

      return commit("deliver_fidelizacion_canje", {
        canje: deliveredMovs[0],
        deliveredMovements: deliveredMovs,
        updatedArticles,
        fechaEntrega: fechaEntregaStr,
        entregadoPor: actor,
      });
    }

    if (
      postAction === "redeem_fidelizacion_product" ||
      postAction === "redeem_fidelizacion_cart"
    ) {
      const cId = Number(
        payload.cId ?? payload.idCliente ?? payload.clienteId ?? payload.clientId ?? 0
      );
      const clientIdx = db.clientes.findIndex(
        (c: AnyObj) => cId > 0 && Number(c.id || 0) === cId
      );
      if (clientIdx < 0) {
        return NextResponse.json(
          { ok: false, message: "Cliente no encontrado" },
          { status: 404 }
        );
      }

      const isCart = postAction === "redeem_fidelizacion_cart";
      const rawItems: AnyObj[] = isCart
        ? Array.isArray(payload.items)
          ? payload.items
          : []
        : [
            {
              artId: Number(payload.artId ?? payload.idArticulo ?? 0),
              artCodigo: payload.artCodigo ?? payload.codigoArticulo ?? "",
              artNombre:
                payload.artNombre ??
                payload.nombreArticulo ??
                payload.productoNombre ??
                payload.detalle ??
                "PRODUCTO DE CANJE",
              cantidad: Math.max(1, Number(payload.cantidad || 1)),
              puntosSub: Math.max(
                1,
                Math.round(
                  Number(
                    payload.puntosRequeridos ??
                      payload.puntos ??
                      payload.totalPuntos ??
                      0
                  )
                )
              ),
            },
          ];

      if (!rawItems.length) {
        return NextResponse.json(
          {
            ok: false,
            message: "Seleccioná al menos un premio del catálogo para canjear.",
          },
          { status: 400 }
        );
      }

      let puntosRequeridos = 0;
      const cleanItems: AnyObj[] = [];
      for (const it of rawItems) {
        const qty = Math.max(1, Math.round(Number(it.cantidad ?? it.qty ?? 1)));
        const ptsSubRaw = Number(it.puntosSub || 0);
        const ptsUnit =
          ptsSubRaw > 0
            ? Math.max(1, Math.round(ptsSubRaw / qty))
            : Math.max(1, Math.round(Number(it.puntosUnit ?? it.puntos ?? 0)));
        const ptsSub = ptsSubRaw > 0 ? Math.round(ptsSubRaw) : qty * ptsUnit;
        puntosRequeridos += ptsSub;
        cleanItems.push({
          artId: Number(it.artId ?? it.id ?? 0),
          artCodigo: toUpperUtf8(it.artCodigo ?? it.c ?? ""),
          artNombre: toUpperUtf8(it.artNombre ?? it.n ?? "PREMIO CLUB FIDEL"),
          cantidad: qty,
          puntosUnit: ptsUnit,
          puntosSub: ptsSub,
        });
      }

      if (puntosRequeridos <= 0) {
        return NextResponse.json(
          { ok: false, message: "Datos de canje inválidos." },
          { status: 400 }
        );
      }

      const { iso: todayIso, fmt: todayFmt, hora: horaNow } = getArDateParts();
      let puntosDisponibles = 0;
      for (const m of db.movimientosFidelizacion) {
        if (getfidMovClientId(m) === cId && m.tipo === "SUMA") {
          const rem = Math.round(Number(m.puntosRestantes ?? m.puntos ?? 0));
          const vIso = String(m.fechaVencIso ?? m.fechaVencimientoIso ?? "2099-12-31");
          if (rem > 0 && vIso >= todayIso) puntosDisponibles += rem;
        }
      }
      const cliRef = db.clientes[clientIdx];
      const cliPtsField = Math.round(Number(cliRef.puntosFidelizacion || 0));
      if (puntosDisponibles <= 0 && cliPtsField > 0) {
        puntosDisponibles = cliPtsField;
      }

      if (puntosDisponibles < puntosRequeridos) {
        return NextResponse.json(
          {
            ok: false,
            message: `Puntos vigentes insuficientes. Disponibles: ${puntosDisponibles} pts · Requeridos: ${puntosRequeridos} pts.`,
          },
          { status: 400 }
        );
      }

      // Consumo FIFO
      let porConsumir = puntosRequeridos;
      for (const mRef of db.movimientosFidelizacion) {
        if (porConsumir <= 0) break;
        if (getfidMovClientId(mRef) === cId && mRef.tipo === "SUMA") {
          const rem = Math.round(Number(mRef.puntosRestantes ?? mRef.puntos ?? 0));
          const vIso = String(
            mRef.fechaVencIso ?? mRef.fechaVencimientoIso ?? "2099-12-31"
          );
          if (rem > 0 && vIso >= todayIso) {
            const usar = Math.min(rem, porConsumir);
            mRef.puntosConsumidos = Math.round(Number(mRef.puntosConsumidos || 0)) + usar;
            mRef.puntosRestantes = rem - usar;
            porConsumir -= usar;
          }
        }
      }

      let maxFidId = 0;
      let maxTicketNum = 0;
      let canjeCount = 0;
      for (const fm of db.movimientosFidelizacion) {
        const fid = Number(fm?.id || 0);
        if (fid > maxFidId) maxFidId = fid;
        if (fm?.tipo === "CANJE") {
          canjeCount++;
          const mTk = /(\d+)/.exec(String(fm.nroTicketCanje || ""));
          if (mTk) {
            const tkNum = Number(mTk[1]);
            if (tkNum > maxTicketNum) maxTicketNum = tkNum;
          }
        }
      }
      const nextTicketNum = Math.max(maxTicketNum + 1, canjeCount + 1);
      const nroTicketCanje = `CJ-${String(nextTicketNum).padStart(5, "0")}`;
      const entregarAhora = !isCart && Boolean(payload.entregarAhora || payload.entregado);

      const createdMovs: AnyObj[] = [];
      const summaryParts: string[] = [];
      for (const ci of cleanItems) {
        maxFidId++;
        summaryParts.push(`${ci.cantidad}x ${ci.artNombre}`);
        const mov: AnyObj = {
          id: maxFidId,
          cId,
          clientId: cId,
          clienteId: cId,
          clienteCodigo: String(cliRef.codigo ?? cId),
          dni: cliRef.nroDoc || "",
          clienteNombre: cliRef.nombre || "",
          tipo: "CANJE",
          nroTicketCanje,
          fechaEmision: todayFmt,
          fechaEmisionIso: todayIso,
          hora: horaNow,
          fechaVencimiento: "-",
          fechaVencIso: "",
          fechaVencimientoIso: null,
          montoCompra: 0,
          puntos: -ci.puntosSub,
          puntosConsumidos: 0,
          puntosRestantes: 0,
          artId: ci.artId,
          articuloId: ci.artId,
          artCodigo: ci.artCodigo,
          articuloCodigo: ci.artCodigo,
          artNombre: ci.artNombre,
          productoNombre: ci.artNombre,
          detalle: `${ci.cantidad}x ${ci.artNombre}`,
          cantidad: ci.cantidad,
          estadoEntrega: entregarAhora ? "ENTREGADO" : "PENDIENTE",
          stockDescontado: entregarAhora,
          fechaEntrega: entregarAhora ? `${todayFmt} ${horaNow}` : "",
          entregadoPor: entregarAhora ? actor : "",
          origenCanje: isCart ? "WEB" : "ERP",
          comprobante: toUpperUtf8(
            payload.comprobante ||
              `TICKET ${nroTicketCanje} · CANJE ${isCart ? "WEB " : ""}#${ci.artCodigo} (${ci.artNombre})`
          ),
          canalEnviado: toUpperUtf8(
            payload.canalEnviado ??
              payload.canalNotificacion ??
              cliRef.canalFidelizacion ??
              (isCart ? "WEB" : "WHATSAPP")
          ),
          obs: toUpperUtf8(
            payload.obs ||
              `TICKET ${nroTicketCanje} · CANJE: ${ci.cantidad}x ${ci.artNombre}`
          ),
          observacion: toUpperUtf8(
            payload.obs ||
              `TICKET ${nroTicketCanje} · CANJE: ${ci.cantidad}x ${ci.artNombre}`
          ),
          estado: "APLICADO",
          usuario: actor,
        };
        db.movimientosFidelizacion.push(mov);
        createdMovs.push(mov);
      }

      const nuevoSaldoPuntos = Math.max(0, puntosDisponibles - puntosRequeridos);
      cliRef.puntosFidelizacion = nuevoSaldoPuntos;
      cliRef.puntosCanjeadosHist =
        Math.round(Number(cliRef.puntosCanjeadosHist || 0)) + puntosRequeridos;
      cliRef.ultimoMovFidelizacion = todayFmt;

      if (entregarAhora) {
        await deductCatalogStockForCanje(
          tenant,
          cleanItems.map((ci) => ({
            artId: ci.artId,
            artCodigo: ci.artCodigo,
            cantidad: ci.cantidad,
          })),
          actor,
          `canje_stock_deduct:${nroTicketCanje}`
        );
      }

      const ticketObj = {
        nroTicketCanje,
        fechaEmision: todayFmt,
        hora: horaNow,
        cId,
        clienteCodigo: String(cliRef.codigo ?? cId),
        clienteNombre: String(cliRef.nombre || ""),
        dni: String(cliRef.nroDoc || ""),
        items: cleanItems,
        puntosTotales: puntosRequeridos,
        saldoRestante: nuevoSaldoPuntos,
        estadoEntrega: entregarAhora ? "ENTREGADO" : "PENDIENTE",
      };

      return commit(postAction, {
        nroTicketCanje,
        canje: createdMovs[0],
        movement: createdMovs[0],
        movements: createdMovs,
        client: cliRef,
        summary: summaryParts.join(" · "),
        ticket: ticketObj,
      });
    }

    if (postAction === "get_referrer_info") {
      const rawRef = String(
        payload.ref ?? payload.codigoReferido ?? payload.refCode ?? ""
      ).trim();
      const refIdx = resolveReferrerClientIndex(db, rawRef, -1);
      const bonoPts = Math.max(
        1,
        Math.round(Number(db.fidelizacionConfig?.bonoReferido ?? 1000))
      );
      if (refIdx < 0 || !db.clientes[refIdx]) {
        return NextResponse.json({ ok: true, found: false });
      }
      const refCli = db.clientes[refIdx];
      const refCod = Number(refCli.codigo || refCli.id || 0);
      return NextResponse.json({
        ok: true,
        found: true,
        codigoReferido: `CF-${refCod}`,
        referrerCodigo: refCod,
        referrerNombre: String(refCli.nombre || "SOCIO CLUB FIDEL"),
        bonoPuntos: bonoPts,
      });
    }

    if (postAction === "claim_pwa_install_bonus") {
      const cId = Number(payload.cId || 0);
      const cCodigo = Number(payload.codigo || 0);
      const cDocKeys = extractDocKeys(payload.nroDoc);
      const cEmail = toUpperUtf8(payload.email);

      let clientIdx = -1;
      for (let i = 0; i < db.clientes.length; i++) {
        const c = db.clientes[i];
        const aliasIds = Array.isArray(c.aliasIds)
          ? c.aliasIds.map((x: unknown) => Number(x))
          : [];
        const aliasCods = Array.isArray(c.aliasCodigos)
          ? c.aliasCodigos.map((x: unknown) => Number(x))
          : [];
        if (cId > 0 && (Number(c.id || 0) === cId || aliasIds.includes(cId))) {
          clientIdx = i;
          break;
        }
        if (
          cCodigo > 0 &&
          (Number(c.codigo || 0) === cCodigo || aliasCods.includes(cCodigo))
        ) {
          clientIdx = i;
          break;
        }
      }
      if (clientIdx < 0 && cDocKeys.length > 0) {
        clientIdx = db.clientes.findIndex((c: AnyObj) =>
          hasDocIntersection(cDocKeys, extractDocKeys(c.nroDoc))
        );
      }
      if (clientIdx < 0 && cEmail && cEmail.includes("@")) {
        clientIdx = db.clientes.findIndex(
          (c: AnyObj) => toUpperUtf8(c.email) === cEmail
        );
      }

      if (clientIdx < 0 || !db.clientes[clientIdx]) {
        return NextResponse.json(
          { ok: false, message: "Socio no encontrado en el padrón." },
          { status: 404 }
        );
      }

      const cli = db.clientes[clientIdx];
      const targetId = Number(cli.id || 0);
      const targetCod = Number(cli.codigo || 0);
      if (targetCod > 0 && targetCod <= 3) {
        return NextResponse.json({
          ok: false,
          message:
            "Los clientes genéricos de mostrador no participan de la promoción.",
        });
      }

      const compKey = `BONO-APP-${targetId}`;
      const alreadyHasMov = db.movimientosFidelizacion.some(
        (fm: AnyObj) =>
          getfidMovClientId(fm) === targetId &&
          toUpperUtf8(fm.comprobante) === compKey
      );

      if (cli.bonoAppInstaladaOtorgado || alreadyHasMov) {
        if (!cli.bonoAppInstaladaOtorgado) {
          cli.bonoAppInstaladaOtorgado = true;
          return commit(`sync_bono_app_flag:${targetId}`, {
            granted: false,
            alreadyGranted: true,
            client: cli,
          });
        }
        return NextResponse.json({
          ok: true,
          granted: false,
          alreadyGranted: true,
          client: cli,
        });
      }

      const bonoAppPts = Math.max(
        1,
        Math.round(Number(db.fidelizacionConfig?.bonoInstalarApp ?? 1000))
      );
      const brandLabel = toUpperUtf8(tenant.business_name || "CASA NUEVA");
      const mov = grantClubFidelBonusPoints(
        db,
        clientIdx,
        bonoAppPts,
        compKey,
        `BONO POR INSTALAR APP OFICIAL ${brandLabel} (+${bonoAppPts} PTS)`,
        "APP_PWA"
      );

      const { fmt, hora } = getArDateParts();
      cli.bonoAppInstaladaOtorgado = true;
      cli.bonoAppInstaladaFecha = `${fmt} ${hora}`;

      return commit(`claim_pwa_install_bonus:${targetId}`, {
        granted: true,
        puntosOtorgados: bonoAppPts,
        movement: mov,
        client: cli,
      });
    }

    if (postAction === "apply_referral_code") {
      const cId = Number(payload.cId || 0);
      const rawRef = String(
        payload.codigoReferido ?? payload.refCode ?? payload.ref ?? ""
      ).trim();
      if (cId <= 0 || !rawRef) {
        return NextResponse.json(
          {
            ok: false,
            message: "Ingresá un código de invitación válido (Ej: CF-106).",
          },
          { status: 400 }
        );
      }

      const clientIdx = db.clientes.findIndex(
        (c: AnyObj) => Number(c.id || 0) === cId
      );
      if (clientIdx < 0) {
        return NextResponse.json(
          { ok: false, message: "Socio no encontrado." },
          { status: 404 }
        );
      }

      const resBonus = processReferralDualBonus(db, clientIdx, rawRef);
      if (!resBonus.granted) {
        const msg = resBonus.alreadyGranted
          ? "Ya utilizaste un código de invitación de bienvenida anteriormente."
          : resBonus.selfReferral
            ? "No podés utilizar tu propio código de invitación."
            : "El código de invitación ingresado no corresponde a un socio activo.";
        return NextResponse.json(
          { ok: false, message: msg, detail: resBonus },
          { status: 400 }
        );
      }

      return commit(`apply_referral_code:${cId}`, {
        granted: true,
        referralBonus: resBonus,
        client: db.clientes[clientIdx],
      });
    }

    if (postAction === "get_client_portal_data") {
      const cId = Number(payload.cId ?? payload.clienteId ?? payload.id ?? 0);
      const cCodigo = Number(payload.codigo || 0);
      const cDocKeys = extractDocKeys(payload.nroDoc);
      const cSub = String(payload.googleSub || "").trim();
      const cEmail = toUpperUtf8(payload.email);

      let clientIndex = -1;
      for (let idx = 0; idx < db.clientes.length; idx++) {
        const c = db.clientes[idx];
        const aliasIds = Array.isArray(c.aliasIds)
          ? c.aliasIds.map((x: unknown) => Number(x))
          : [];
        const aliasCods = Array.isArray(c.aliasCodigos)
          ? c.aliasCodigos.map((x: unknown) => Number(x))
          : [];
        if (cId > 0 && (Number(c.id || 0) === cId || aliasIds.includes(cId))) {
          clientIndex = idx;
          break;
        }
        if (
          cCodigo > 0 &&
          (Number(c.codigo || 0) === cCodigo || aliasCods.includes(cCodigo))
        ) {
          clientIndex = idx;
          break;
        }
      }
      if (clientIndex < 0 && cSub) {
        clientIndex = db.clientes.findIndex(
          (c: AnyObj) => String(c.googleSub || "").trim() === cSub
        );
      }
      if (clientIndex < 0 && cEmail && cEmail.includes("@")) {
        clientIndex = db.clientes.findIndex(
          (c: AnyObj) =>
            toUpperUtf8(c.email) === cEmail ||
            toUpperUtf8(c.emailSecundario) === cEmail
        );
      }
      if (clientIndex < 0 && cDocKeys.length > 0) {
        clientIndex = db.clientes.findIndex((c: AnyObj) =>
          hasDocIntersection(cDocKeys, extractDocKeys(c.nroDoc))
        );
      }

      if (clientIndex < 0 || !db.clientes[clientIndex]) {
        return NextResponse.json(
          { ok: false, message: "Cliente no encontrado" },
          { status: 404 }
        );
      }

      const clientObj = db.clientes[clientIndex];
      const targetId = Number(clientObj.id || 0);
      const targetCodigo = String(clientObj.codigo || "");
      const targetDocKeys = extractDocKeys(clientObj.nroDoc);
      const targetDoc = cleanDocDigits(clientObj.nroDoc);
      const targetNombre = toUpperUtf8(clientObj.nombre);

      const accreditedPvNros = new Set<string>();
      let maxFidId = 0;
      for (const mf of db.movimientosFidelizacion) {
        const fid = Number(mf?.id || 0);
        if (fid > maxFidId) maxFidId = fid;
        const mfCid = getfidMovClientId(mf);
        const mfDoc = cleanDocDigits(mf?.dni);
        if (
          mfCid === targetId ||
          (targetDoc.length >= 6 && mfDoc === targetDoc)
        ) {
          if (mf?.tipo === "SUMA") {
            const mC = /(\d{4}-\d{8})/.exec(String(mf.comprobante || ""));
            if (mC) accreditedPvNros.add(mC[1]);
          }
        }
      }

      const misCompras: AnyObj[] = [];
      const seenCompKeys = new Set<string>();
      const seenPvNros = new Set<string>();
      let reconciledNewPoints = false;

      const diasVigCfg = Math.max(
        1,
        Math.round(Number(db.fidelizacionConfig?.diasVigencia ?? 365))
      );

      // Ventas POS desde ventas_db
      try {
        const ventasFallback = buildCleanTenantSeed({
          businessName: tenant.business_name,
        }).docs.ventas_db as AnyObj;
        const { payload: vDb } = await getTenantDoc<AnyObj>(
          tenant,
          "ventas_db",
          ventasFallback
        );
        if (vDb && typeof vDb === "object") {
          const allSales: AnyObj[] = [];
          if (vDb.comprobantesPorCaja && typeof vDb.comprobantesPorCaja === "object") {
            for (const cKey of ["caja1", "caja2", "caja3"]) {
              const arr = vDb.comprobantesPorCaja[cKey];
              if (Array.isArray(arr)) {
                for (const s of arr) if (s && typeof s === "object") allSales.push(s);
              }
            }
          }
          if (vDb.turnosCajas && typeof vDb.turnosCajas === "object") {
            for (const cajaArr of Object.values(vDb.turnosCajas)) {
              if (Array.isArray(cajaArr)) {
                for (const s of cajaArr) if (s && typeof s === "object") allSales.push(s);
              }
            }
          }
          if (Array.isArray(vDb.cajaCentral)) {
            for (const s of vDb.cajaCentral) if (s && typeof s === "object") allSales.push(s);
          }
          if (Array.isArray(vDb.comprobantesEmitidos)) {
            for (const s of vDb.comprobantesEmitidos) {
              if (s && typeof s === "object") allSales.push(s);
            }
          }

          for (const sale of allSales) {
            if ((sale.entryType || "venta") !== "venta") continue;
            const sCod = String(sale.clienteCodigo || "");
            const sDocKeys = extractDocKeys(sale.clienteDoc);
            const sNom = toUpperUtf8(sale.cliente);

            let matches = false;
            if (targetCodigo && targetCodigo !== "1" && sCod === targetCodigo) {
              matches = true;
            } else if (hasDocIntersection(targetDocKeys, sDocKeys)) {
              matches = true;
            } else if (
              targetNombre &&
              targetNombre !== "CONSUMIDOR FINAL" &&
              sNom === targetNombre
            ) {
              matches = true;
            }

            if (!matches) continue;

            const pv = cleanDocDigits(sale.pv || "0002").padStart(4, "0").slice(-4);
            const nroNum = Number(sale.nro || 0);
            const nro = String(nroNum).padStart(8, "0");
            const pvNro = `${pv}-${nro}`;
            const compKey = String(sale.uid || pvNro);
            if (seenCompKeys.has(compKey) || seenPvNros.has(pvNro)) continue;
            seenCompKeys.add(compKey);
            seenPvNros.add(pvNro);

            const importeVenta = round2(sale.importe || 0);
            const tipoBaseVenta = String(sale.tipoBase || "Factura");
            const letraVenta = toUpperUtf8(sale.letra || "B") || "B";
            const cajaIdVenta = toUpperUtf8(sale.cajaId || "caja1");
            const cajaLabel =
              cajaIdVenta === "CAJA3"
                ? "CAJA 3"
                : cajaIdVenta === "CAJA2"
                  ? "CAJA 2"
                  : "CAJA 1";

            const isNotaCredito = /cr[eé]dito/i.test(tipoBaseVenta);
            if (
              targetCodigo !== "1" &&
              !isNotaCredito &&
              !sale.origenOliver &&
              importeVenta > 0 &&
              !accreditedPvNros.has(pvNro)
            ) {
              const { iso: todayIso, fmt: todayFmt, hora } = getArDateParts();
              const fEmisionIso = String(sale.fechaIso || todayIso);
              const calcPortalPts = calcSaleFidPointsWithRubroRules(
                db.fidelizacionConfig || {},
                importeVenta,
                Array.isArray(sale.items) ? sale.items : [],
                fEmisionIso
              );
              if (calcPortalPts.points > 0) {
                maxFidId++;
                const fhParts = String(sale.fechaHora || "").split(" ");
                const fEmisionFmt = fhParts[0] || todayFmt;
                const horaEmision = fhParts[1] || hora;
                const { iso: vIso, fmt: vFmt } = addDaysToIso(fEmisionIso, diasVigCfg);
                const prefixComp = /interno/i.test(tipoBaseVenta) ? "CI" : "FA";
                const compLabelFid = `${prefixComp} ${letraVenta} ${pvNro}`;

                db.movimientosFidelizacion.push({
                  id: maxFidId,
                  cId: targetId,
                  clienteId: targetId,
                  dni: clientObj.nroDoc || sale.clienteDoc || "",
                  clienteNombre: clientObj.nombre || sale.cliente || "",
                  tipo: "SUMA",
                  fechaEmision: fEmisionFmt,
                  fechaEmisionIso: fEmisionIso,
                  hora: horaEmision,
                  fechaVencimiento: vFmt,
                  fechaVencIso: vIso,
                  montoCompra: importeVenta,
                  porcentajeAplicado: calcPortalPts.effectivePct,
                  puntos: calcPortalPts.points,
                  puntosConsumidos: 0,
                  puntosRestantes: calcPortalPts.points,
                  comprobante: compLabelFid,
                  canalEnviado: toUpperUtf8(clientObj.canalFidelizacion || "WHATSAPP"),
                  obs: `VENTA POS ${cajaLabel} ($ ${importeVenta.toLocaleString("es-AR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })})`,
                });
                accreditedPvNros.add(pvNro);
                reconciledNewPoints = true;
              }
            }

            misCompras.push({
              uid: sale.uid || compKey,
              origen: cajaLabel,
              cajaId: String(sale.cajaId || "caja1").toLowerCase(),
              fechaHora: sale.fechaHora || sale.fechaIso || "",
              fechaIso: sale.fechaIso || "",
              isFiscal: Boolean(sale.isFiscal),
              estadoArca: sale.estadoArca || "interno",
              tipoBase: tipoBaseVenta,
              letra: letraVenta,
              tipo: sale.tipo || `${tipoBaseVenta} ${letraVenta}`,
              pv,
              nro: nroNum,
              numero: pvNro,
              codArca: sale.codArca || (sale.isFiscal ? "06" : "99"),
              cae: sale.cae || "",
              caeVto: sale.caeVto || "",
              qrImgSrc: sale.qrImgSrc || "",
              cliente: sale.cliente || clientObj.nombre || "CONSUMIDOR FINAL",
              clienteCodigo: sale.clienteCodigo || targetCodigo,
              clienteDoc: sale.clienteDoc || clientObj.nroDoc || "00.000.000",
              clienteRespIva:
                sale.clienteRespIva || clientObj.respIva || "Consumidor Final",
              clienteDomicilio:
                sale.clienteDomicilio ||
                `${clientObj.calle || ""} ${clientObj.numero || ""}`.trim(),
              clienteLocalidad:
                sale.clienteLocalidad || clientObj.localidad || defaultLoc,
              clienteTel:
                sale.clienteTel || clientObj.celular || clientObj.telefono || "",
              clienteIibb: sale.clienteIibb || clientObj.nroIibb || "",
              medioPago: sale.medioPago || "Contado",
              importe: importeVenta,
              subTotalBruto: round2(sale.subTotalBruto ?? importeVenta),
              dtoPje: Number(sale.dtoPje || 0),
              dtoImp: round2(sale.dtoImp || 0),
              totalGravado: round2(sale.totalGravado ?? importeVenta / 1.21),
              totalIva: round2(sale.totalIva ?? importeVenta - importeVenta / 1.21),
              itemsCount: Number(
                sale.itemsCount ?? (Array.isArray(sale.items) ? sale.items.length : 0)
              ),
              items: Array.isArray(sale.items) ? sale.items : [],
              payment: sale.payment || [],
              estado: "EMITIDO",
            });
          }
        }
      } catch {
        // Non-fatal if ventas_db unavailable
      }

      // Movimientos Fidelización del socio
      const { iso: todayIso, fmt: todayFmt } = getArDateParts();
      const movsFid: AnyObj[] = [];
      let puntosVigentes = 0;
      let puntosAcumHist = 0;
      let puntosCanjeHist = 0;

      for (const mf of db.movimientosFidelizacion) {
        if (!mf) continue;
        const mfCid = getfidMovClientId(mf);
        const mfDoc = cleanDocDigits(mf.dni);
        if (
          mfCid === targetId ||
          (targetDoc.length >= 6 && mfDoc === targetDoc)
        ) {
          movsFid.push(mf);
          const tipo = String(mf.tipo || "");
          const pts = Math.round(Number(mf.puntos || 0));
          if (tipo === "SUMA" && pts > 0) {
            puntosAcumHist += pts;
            const rem = Math.round(Number(mf.puntosRestantes ?? pts));
            const vIso = String(mf.fechaVencIso ?? "2099-12-31");
            if (rem > 0 && (!vIso || vIso >= todayIso)) {
              puntosVigentes += rem;
            }
          } else if (tipo === "CANJE") {
            puntosCanjeHist += Math.abs(pts);
          }
        }
      }
      movsFid.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

      if (!movsFid.length && Number(clientObj.puntosFidelizacion || 0) > 0) {
        puntosVigentes = Math.round(Number(clientObj.puntosFidelizacion));
        puntosAcumHist = Math.max(
          puntosVigentes,
          Math.round(Number(clientObj.puntosAcumuladosHist || puntosVigentes))
        );
      }
      clientObj.puntosFidelizacion = puntosVigentes;
      clientObj.puntosAcumuladosHist = puntosAcumHist;
      clientObj.puntosCanjeadosHist = puntosCanjeHist;

      if (reconciledNewPoints) {
        clientObj.ultimoMovFidelizacion = todayFmt;
        db.updatedAt = new Date().toISOString();
        await putTenantDoc(
          tenant,
          "clientes_db",
          db,
          actor,
          `auto_reconcile_fidelizacion:${targetId}`
        );
      }

      // Movimientos de Cuenta Corriente
      const movsCtaList = db.movimientosCtaCte.filter(
        (mc: AnyObj) => mc && Number(mc.cId) === targetId && !mc.anulado
      );
      for (let i = movsCtaList.length - 1; i >= 0; i--) {
        const mc = movsCtaList[i];
        const debe = round2(mc.d ?? mc.debe ?? 0);
        if (debe <= 0) continue;
        const compParts = [mc.tca, mc.l, mc.n]
          .map((x) => String(x || "").trim())
          .filter(Boolean);
        const compName =
          String(mc.comp || mc.comprobante || compParts.join(" ")).trim() ||
          String(mc.tcn || "COMPROBANTE").trim();
        const mPvNro = /(\d{4}-\d{8})/.exec(compName);
        const pvNroExtract = mPvNro ? mPvNro[1] : "";
        if (
          seenCompKeys.has(compName) ||
          (pvNroExtract && seenPvNros.has(pvNroExtract))
        ) {
          continue;
        }
        seenCompKeys.add(compName);
        if (pvNroExtract) seenPvNros.add(pvNroExtract);

        let pvMc = "0099";
        let nroMc = 1;
        if (pvNroExtract) {
          const partsPn = pvNroExtract.split("-");
          pvMc = partsPn[0];
          nroMc = Number(partsPn[1] || 1);
        }
        const letraMc = toUpperUtf8(mc.l || "B") || "B";
        const tipoBaseMc = String(mc.tcn || "FACTURA").trim();
        const pendVal = Number(mc.pend ?? mc.pendiente ?? 0);
        const mcItems =
          Array.isArray(mc.items) && mc.items.length > 0
            ? mc.items
            : [
                {
                  c: "00001",
                  n: `SEGÚN COMPROBANTE ${compName}`,
                  qty: 1,
                  ivaPct: 21,
                  unitPrice: debe,
                  subtotal: debe,
                },
              ];

        misCompras.push({
          uid: `CTACTE-${mc.id ?? compName}`,
          origen: "CUENTA CORRIENTE",
          fechaHora: mc.f || mc.fecha || "",
          fechaIso: mc.fi || "",
          isFiscal: false,
          estadoArca: "interno",
          tipoBase: tipoBaseMc,
          letra: letraMc,
          tipo: `${tipoBaseMc} ${letraMc}`,
          pv: pvMc,
          nro: nroMc,
          numero: pvNroExtract || compName,
          codArca: "99",
          cae: "",
          caeVto: "",
          qrImgSrc: "",
          cliente: clientObj.nombre || "CONSUMIDOR FINAL",
          clienteCodigo: targetCodigo,
          clienteDoc: clientObj.nroDoc || "00.000.000",
          clienteRespIva: clientObj.respIva || "Consumidor Final",
          clienteDomicilio: `${clientObj.calle || ""} ${clientObj.numero || ""}`.trim(),
          clienteLocalidad: clientObj.localidad || defaultLoc,
          clienteTel: clientObj.celular || clientObj.telefono || "",
          clienteIibb: clientObj.nroIibb || "",
          medioPago: "Cuenta Corriente",
          importe: debe,
          subTotalBruto: debe,
          dtoPje: 0,
          dtoImp: 0,
          totalGravado: round2(debe / 1.21),
          totalIva: round2(debe - debe / 1.21),
          itemsCount: mcItems.length,
          items: mcItems,
          payment: { method: "ctacte" },
          estado: pendVal <= 0.01 ? "CANCELADO" : "PENDIENTE CTA. CTE.",
        });
      }

      // Pedidos Web del cliente
      const pedidosCliente: AnyObj[] = [];
      for (const pw of db.pedidosWeb) {
        if (!pw) continue;
        const pwCid = Number(pw.cId ?? pw.clienteId ?? 0);
        const pwCod = String(pw.clienteCodigo || "");
        if (pwCid === targetId || (targetCodigo && pwCod === targetCodigo)) {
          pedidosCliente.push(pw);
          const pwImp = round2(pw.total || 0);
          const pwNro = Number(pw.nroPedido ?? pw.id ?? 1) || 1;
          misCompras.push({
            uid: `WEB-${pw.id ?? pwNro}`,
            origen: "COMPRA WEB",
            fechaHora: `${pw.fecha || ""}${pw.hora ? ` ${pw.hora}` : ""}`.trim() || pw.fechaHora || "",
            fechaIso: pw.fechaIso || "",
            isFiscal: false,
            estadoArca: "interno",
            tipoBase: "Pedido Web",
            letra: "X",
            tipo: `PEDIDO WEB #${pwNro}`,
            pv: "0000",
            nro: pwNro,
            numero: `#${pwNro}`,
            codArca: "99",
            cae: "",
            caeVto: "",
            qrImgSrc: "",
            cliente: clientObj.nombre || "CONSUMIDOR FINAL",
            clienteCodigo: targetCodigo,
            clienteDoc: clientObj.nroDoc || "00.000.000",
            clienteRespIva: clientObj.respIva || "Consumidor Final",
            clienteDomicilio: `${clientObj.calle || ""} ${clientObj.numero || ""}`.trim(),
            clienteLocalidad: clientObj.localidad || defaultLoc,
            clienteTel: clientObj.celular || clientObj.telefono || "",
            clienteIibb: "",
            medioPago: pw.medioPago || "A coordinar",
            importe: pwImp,
            subTotalBruto: pwImp,
            dtoPje: 0,
            dtoImp: 0,
            totalGravado: round2(pwImp / 1.21),
            totalIva: round2(pwImp - pwImp / 1.21),
            itemsCount: Array.isArray(pw.items) ? pw.items.length : 0,
            items: Array.isArray(pw.items) ? pw.items : [],
            payment: [],
            estado: pw.estado || "RECIBIDO",
          });
        }
      }

      misCompras.sort((a, b) => {
        const isoA = String(a.fechaIso || "");
        const isoB = String(b.fechaIso || "");
        if (isoA && isoB && isoA !== isoB) return isoB.localeCompare(isoA);
        return Number(b.nro || 0) - Number(a.nro || 0);
      });

      const misSoyCajero = db.ticketsSoyCajero
        .filter(
          (tk: AnyObj) =>
            tk &&
            (Number(tk.cId || 0) === targetId ||
              (targetCodigo && String(tk.clienteCodigo || "") === targetCodigo))
        )
        .sort((a: AnyObj, b: AnyObj) => Number(b.id || 0) - Number(a.id || 0));

      let maxScCodigoNum = 1000;
      for (const tSc of db.ticketsSoyCajero) {
        const numPartSc = Number(cleanDocDigits(tSc?.codigoInterno || tSc?.code || ""));
        if (numPartSc > maxScCodigoNum) maxScCodigoNum = numPartSc;
      }
      const nextSoyCajeroCode = String(maxScCodigoNum + 1);

      return NextResponse.json({
        ok: true,
        client: clientObj,
        fidelizacionConfig: db.fidelizacionConfig || {
          pesosPorPunto: 1000,
          diasVencimiento: 365,
          factorCanje: 1.12,
          nombrePrograma: "CLUB FIDEL",
        },
        puntosResumen: {
          vigentes: puntosVigentes,
          acumulados: puntosAcumHist,
          canjeados: puntosCanjeHist,
        },
        movimientosCtaCte: movsCtaList,
        movimientosFidelizacion: movsFid.slice(0, 100),
        pedidosWeb: pedidosCliente,
        misCompras,
        ticketsSoyCajero: misSoyCajero.slice(0, 30),
        nextSoyCajeroCode,
        nextSoyCajeroFormatted: `FM-${nextSoyCajeroCode}`,
      });
    }

    // Soy Cajero / Facturador Móvil
    if (
      postAction === "peek_soy_cajero_next_code" ||
      postAction === "create_soy_cajero_ticket" ||
      postAction === "list_soy_cajero_tickets" ||
      postAction === "get_soy_cajero_ticket" ||
      postAction === "claim_soy_cajero_ticket" ||
      postAction === "cancel_soy_cajero_ticket"
    ) {
      let maxId = 0;
      let maxCodigoNum = 1000;
      for (const t of db.ticketsSoyCajero) {
        const tid = Number(t?.id || 0);
        if (tid > maxId) maxId = tid;
        const numPart = Number(cleanDocDigits(t?.codigoInterno || t?.code || ""));
        if (numPart > maxCodigoNum) maxCodigoNum = numPart;
      }

      if (postAction === "peek_soy_cajero_next_code") {
        const nextCode = String(maxCodigoNum + 1);
        return NextResponse.json({
          ok: true,
          nextCode: `FM-${nextCode}`,
          nextSoyCajeroCode: nextCode,
          nextSoyCajeroFormatted: `FM-${nextCode}`,
        });
      }

      if (postAction === "create_soy_cajero_ticket") {
        const rawItems = Array.isArray(payload.items) ? payload.items : [];
        if (!rawItems.length) {
          return NextResponse.json(
            {
              ok: false,
              message:
                "Agregá al menos un producto en Soy Cajero para generar el código.",
            },
            { status: 400 }
          );
        }

        const expectedCode = cleanDocDigits(payload.expectedCode || "");
        const nextNum = maxCodigoNum + 1;
        const codigoInterno = String(nextNum);
        const codigoFormateado = `FM-${codigoInterno}`;
        const wasReassigned = expectedCode !== "" && expectedCode !== codigoInterno;
        const nextCodeAfterThis = String(nextNum + 1);

        const cleanItems: AnyObj[] = [];
        let totalEstimado = 0;
        let totalUnidades = 0;

        for (const it of rawItems) {
          const qty = Math.round(Number(it.cantidad ?? it.qty ?? 1) * 1000) / 1000;
          if (qty <= 0) continue;
          const unitPrice = round2(it.precioUnit ?? it.unitPrice ?? it.p1f ?? 0);
          const sub = round2(qty * unitPrice);
          totalEstimado = round2(totalEstimado + sub);
          totalUnidades += qty;
          cleanItems.push({
            artId: Number(it.artId ?? it.id ?? 0),
            c: toUpperUtf8(it.c ?? it.codigo ?? ""),
            n: toUpperUtf8(it.n ?? it.nombre ?? "ARTÍCULO"),
            bc: String(it.bc || "").trim(),
            cantidad: qty,
            precioUnit: unitPrice,
            subtotal: sub,
            isScaleTicket: Boolean(it.isScaleTicket),
            scaleBarcode: String(it.scaleBarcode || "").trim(),
          });
        }

        const { iso: todayIso, fmt: todayFmt, hora } = getArDateParts();
        const newTicket: AnyObj = {
          id: maxId + 1,
          codigoInterno,
          codigoFormateado,
          code: codigoFormateado,
          codigo: codigoFormateado,
          cId: Number(payload.cId || 0),
          clienteCodigo: String(payload.clienteCodigo || "1"),
          clienteNombre: toUpperUtf8(payload.clienteNombre || "CONSUMIDOR FINAL"),
          clienteDoc: toUpperUtf8(payload.clienteDoc || "00.000.000"),
          listaPrecio: toUpperUtf8(payload.listaPrecio || "MINORISTA"),
          fecha: todayFmt,
          fechaIso: todayIso,
          hora,
          createdAt: new Date().toISOString(),
          estado: "PENDIENTE",
          itemsCount: cleanItems.length,
          totalUnidades: Math.round(totalUnidades * 1000) / 1000,
          totalEstimado,
          items: cleanItems,
        };

        db.ticketsSoyCajero.push(newTicket);
        return commit(`create_soy_cajero_ticket:${codigoInterno}`, {
          ticket: newTicket,
          wasReassigned,
          previousExpectedCode: expectedCode,
          nextSoyCajeroCode: nextCodeAfterThis,
          nextSoyCajeroFormatted: `FM-${nextCodeAfterThis}`,
        });
      }

      const normalizeTicketTz = (tk: AnyObj): AnyObj => {
        if (tk?.createdAt) {
          const { iso, fmt, hora } = getArDateParts(tk.createdAt);
          return { ...tk, fecha: fmt, fechaIso: iso, hora };
        }
        return tk;
      };

      if (postAction === "get_soy_cajero_ticket") {
        const rawCode = toUpperUtf8(
          payload.codigo ?? payload.codigoInterno ?? payload.code ?? ""
        );
        const digitsOnly = cleanDocDigits(rawCode);
        let found: AnyObj | null = null;
        for (let i = db.ticketsSoyCajero.length - 1; i >= 0; i--) {
          const tk = db.ticketsSoyCajero[i];
          const tkCode = toUpperUtf8(tk?.codigoInterno);
          const tkFmt = toUpperUtf8(tk?.codigoFormateado || tk?.code);
          if (
            rawCode &&
            (tkCode === rawCode ||
              tkFmt === rawCode ||
              (digitsOnly && tkCode === digitsOnly))
          ) {
            found = normalizeTicketTz(tk);
            break;
          }
        }
        if (!found) {
          return NextResponse.json(
            {
              ok: false,
              message: `No se encontró ningún ticket de Soy Cajero con el código "${rawCode}".`,
            },
            { status: 404 }
          );
        }
        return NextResponse.json({ ok: true, ticket: found });
      }

      if (postAction === "list_soy_cajero_tickets") {
        const estadoFiltro = toUpperUtf8(payload.estado || "ALL");
        const soloHoy = Boolean(payload.soloHoy);
        const { iso: todayIsoAr, fmt: todayFmtAr } = getArDateParts();
        const filtered: AnyObj[] = [];

        for (let i = db.ticketsSoyCajero.length - 1; i >= 0; i--) {
          const tk = normalizeTicketTz(db.ticketsSoyCajero[i]);
          if (
            estadoFiltro !== "ALL" &&
            estadoFiltro !== "" &&
            toUpperUtf8(tk.estado || "PENDIENTE") !== estadoFiltro
          ) {
            continue;
          }
          if (soloHoy) {
            const tkIso = String(tk.fechaIso || "").trim();
            const tkFecha = String(tk.fecha || "").trim();
            if (tkIso !== todayIsoAr && tkFecha !== todayFmtAr) continue;
          }
          filtered.push(tk);
        }

        filtered.sort((a, b) => {
          const idA =
            Number(a.id || 0) || Number(cleanDocDigits(a.codigoInterno || 0));
          const idB =
            Number(b.id || 0) || Number(cleanDocDigits(b.codigoInterno || 0));
          return idB - idA;
        });

        return NextResponse.json({
          ok: true,
          todayIso: todayIsoAr,
          todayFmt: todayFmtAr,
          tickets: filtered.slice(0, 100),
        });
      }

      const tkId = Number(payload.id || 0);
      const rawCode = toUpperUtf8(
        payload.codigo ?? payload.codigoInterno ?? payload.code ?? ""
      );
      const digitsOnly = cleanDocDigits(rawCode);
      let foundIdx = -1;

      for (let i = db.ticketsSoyCajero.length - 1; i >= 0; i--) {
        const tk = db.ticketsSoyCajero[i];
        if (tkId > 0 && Number(tk?.id || 0) === tkId) {
          foundIdx = i;
          break;
        }
        const tkCode = toUpperUtf8(tk?.codigoInterno);
        const tkFmt = toUpperUtf8(tk?.codigoFormateado || tk?.code);
        if (
          rawCode &&
          (tkCode === rawCode ||
            tkFmt === rawCode ||
            (digitsOnly && tkCode === digitsOnly))
        ) {
          foundIdx = i;
          break;
        }
      }

      if (foundIdx < 0) {
        return NextResponse.json(
          { ok: false, message: "Ticket de Facturador Móvil no encontrado." },
          { status: 404 }
        );
      }

      const { fmt, hora } = getArDateParts();
      if (postAction === "cancel_soy_cajero_ticket") {
        db.ticketsSoyCajero[foundIdx].estado = "ANULADO";
        db.ticketsSoyCajero[foundIdx].anuladoAt = `${fmt} ${hora}`;
      } else {
        db.ticketsSoyCajero[foundIdx].estado = "TOMADO EN CAJA";
        db.ticketsSoyCajero[foundIdx].cajaId = toUpperUtf8(
          payload.cajaId || "CAJA 1"
        );
        db.ticketsSoyCajero[foundIdx].cajero = toUpperUtf8(
          payload.cajero || actor
        );
        db.ticketsSoyCajero[foundIdx].tomadoAt = `${fmt} ${hora}`;
      }

      const updatedTicket = db.ticketsSoyCajero[foundIdx];
      return commit(
        `${postAction}:${updatedTicket.codigoInterno || tkId}`,
        { ticket: updatedTicket }
      );
    }

    return commit(postAction || "clientes_noop", {});
  }

  return NextResponse.json(
    { ok: false, message: "Método no permitido" },
    { status: 405 }
  );
}
