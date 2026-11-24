import { NextRequest, NextResponse } from "next/server";
import { jsonResponseMaybeGzip } from "../json-response";
import { buildCleanTenantSeed } from "../seed-clean-tenant";
import {
  appendPosEvent,
  getTenantDoc,
  listPendingPosEvents,
  listTenantUsersFromDb,
  patchTenantDocKeys,
  putTenantDoc,
  upsertTenantUserInDb,
  type ErpPosEventRecord,
} from "../supabase-server";
import type { ErpTenantRecord } from "../types";

type AnyObj = Record<string, any>;

function round2(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function round3(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
}

function applyPendingVentasEvents(
  rawDb: AnyObj,
  events: ErpPosEventRecord[]
): AnyObj {
  if (!events.length) return rawDb;

  const baseComp =
    rawDb.comprobantesPorCaja && typeof rawDb.comprobantesPorCaja === "object"
      ? rawDb.comprobantesPorCaja
      : {};
  const db: AnyObj = {
    ...rawDb,
    comprobantesPorCaja: {
      caja1: Array.isArray(baseComp.caja1) ? [...baseComp.caja1] : [],
      caja2: Array.isArray(baseComp.caja2) ? [...baseComp.caja2] : [],
      caja3: Array.isArray(baseComp.caja3) ? [...baseComp.caja3] : [],
    },
    nextCorrelativos: {
      ...(rawDb.nextCorrelativos && typeof rawDb.nextCorrelativos === "object"
        ? rawDb.nextCorrelativos
        : {}),
    },
    lastEmitidosDetalle: {
      ...(rawDb.lastEmitidosDetalle &&
      typeof rawDb.lastEmitidosDetalle === "object"
        ? rawDb.lastEmitidosDetalle
        : {}),
    },
    dailyRecords: Array.isArray(rawDb.dailyRecords)
      ? [...rawDb.dailyRecords]
      : [],
    artRecentDaily: Array.isArray(rawDb.artRecentDaily)
      ? [...rawDb.artRecentDaily]
      : [],
    artMonthly: Array.isArray(rawDb.artMonthly)
      ? rawDb.artMonthly.map((m: AnyObj) => (m && typeof m === "object" ? { ...m } : m))
      : [],
    cierresCajaCentral: Array.isArray(rawDb.cierresCajaCentral)
      ? [...rawDb.cierresCajaCentral]
      : [],
    aperturasCajaCentral: Array.isArray(rawDb.aperturasCajaCentral)
      ? rawDb.aperturasCajaCentral.map((a: AnyObj) =>
          a && typeof a === "object" ? { ...a } : a
        )
      : [],
    efectivoInicialPorCaja: {
      caja1: round2(rawDb.efectivoInicialPorCaja?.caja1 || 0),
      caja2: round2(rawDb.efectivoInicialPorCaja?.caja2 || 0),
      caja3: round2(rawDb.efectivoInicialPorCaja?.caja3 || 0),
    },
  };

  for (const ev of events) {
    const p = ev.payload && typeof ev.payload === "object" ? ev.payload : {};
    if (ev.event_type === "record_pos_sale") {
      const cajaId = ["caja1", "caja2", "caja3"].includes(String(p.cajaId))
        ? String(p.cajaId)
        : "caja1";
      const saleRecord = p.saleRecord as AnyObj | undefined;
      if (!saleRecord || typeof saleRecord !== "object") continue;

      const corrKey = String(p.corrKey || "");
      const assignedNro = Number(p.assignedNro || saleRecord.nro || 0);
      if (corrKey && assignedNro > 0) {
        db.nextCorrelativos[corrKey] = Math.max(
          Number(db.nextCorrelativos[corrKey] || 1),
          assignedNro + 1
        );
      }

      const incomingUid = String(saleRecord.uid || "").trim();
      const numeroCompleto = String(saleRecord.numeroCompleto || "");
      const tipoBase = String(saleRecord.tipoBase || "Factura").trim().toLowerCase();
      const letra = String(saleRecord.letra || "B").trim().toUpperCase();
      const fechaIso = String(saleRecord.fechaIso || "");

      const alreadyInComps = db.comprobantesPorCaja[cajaId].some((r: AnyObj) => {
        if (!r || typeof r !== "object") return false;
        if (incomingUid && String(r.uid || "").trim() === incomingUid) return true;
        return (
          String(r.numeroCompleto || "") === numeroCompleto &&
          String(r.tipoBase || "Factura").trim().toLowerCase() === tipoBase &&
          String(r.letra || "B").trim().toUpperCase() === letra &&
          String(r.fechaIso || "") === fechaIso
        );
      });

      if (!alreadyInComps) {
        db.comprobantesPorCaja[cajaId].unshift(saleRecord);
        if (corrKey) {
          db.lastEmitidosDetalle[corrKey] = saleRecord;
        }
        if (p.dailyRecord && typeof p.dailyRecord === "object") {
          db.dailyRecords.push(p.dailyRecord);
        }
      }

      // Estadísticas por artículo: aplicar solo si no fue compactado aún en artMonthly/artRecentDaily
      if (Array.isArray(p.artDeltas)) {
        for (const ad of p.artDeltas) {
          if (!ad || !ad.a) continue;
          const artId = Number(ad.a);
          const ym = String(ad.ym || "");
          const mRow = db.artMonthly.find(
            (m: AnyObj) => m && m.ym === ym && Number(m.a) === artId
          );
          if (mRow) {
            mRow.q = round3(Number(mRow.q || 0) + Number(ad.q || 0));
            mRow.v = round2(Number(mRow.v || 0) + Number(ad.v || 0));
            mRow.c = round2(Number(mRow.c || 0) + Number(ad.c || 0));
          } else if (ym) {
            db.artMonthly.push({
              ym,
              a: artId,
              q: round3(Number(ad.q || 0)),
              v: round2(Number(ad.v || 0)),
              c: round2(Number(ad.c || 0)),
            });
          }
          if (ad.d) {
            db.artRecentDaily.push({
              d: ad.d,
              a: artId,
              q: round3(Number(ad.q || 0)),
              v: round2(Number(ad.v || 0)),
              c: round2(Number(ad.c || 0)),
            });
          }
        }
      }
    } else if (
      ev.event_type === "record_caja_movement" ||
      ev.event_type === "record_caja_retiro" ||
      ev.event_type === "record_caja_recibo"
    ) {
      const cajaId = ["caja1", "caja2", "caja3"].includes(String(p.cajaId))
        ? String(p.cajaId)
        : "caja1";
      const mov = p.movement as AnyObj | undefined;
      if (!mov || typeof mov !== "object") continue;
      const movUid = String(mov.uid || "").trim();
      const movNum = String(mov.numeroCompleto || "").trim();
      const movFechaIso = String(mov.fechaIso || "").trim();
      const already = db.comprobantesPorCaja[cajaId].some((r: AnyObj) => {
        if (!r || typeof r !== "object") return false;
        if (movUid && String(r.uid || "").trim() === movUid) return true;
        if (mov.id && String(r.id || "") === String(mov.id)) return true;
        if (
          movNum &&
          movFechaIso &&
          String(r.numeroCompleto || "") === movNum &&
          String(r.entryType || "") === String(mov.entryType || "") &&
          String(r.fechaIso || "") === movFechaIso
        ) {
          return true;
        }
        return false;
      });
      if (!already) {
        db.comprobantesPorCaja[cajaId].unshift(mov);
      }
    } else if (ev.event_type === "annul_caja_movement") {
      const id = String(p.id || "");
      if (!id) continue;
      for (const cKey of ["caja1", "caja2", "caja3"]) {
        const idx = db.comprobantesPorCaja[cKey].findIndex(
          (x: AnyObj) => x && String(x.id) === id
        );
        if (idx >= 0) {
          db.comprobantesPorCaja[cKey][idx] = {
            ...db.comprobantesPorCaja[cKey][idx],
            anulado: true,
          };
        }
      }
    } else if (ev.event_type === "update_comprobante_medio_pago") {
      const id = String(p.id || "");
      const num = String(p.numeroCompleto || "");
      for (const cKey of ["caja1", "caja2", "caja3"]) {
        db.comprobantesPorCaja[cKey] = db.comprobantesPorCaja[cKey].map((row: AnyObj) => {
          if (
            row &&
            ((id && String(row.id) === id) ||
              (num && String(row.numeroCompleto) === num))
          ) {
            return {
              ...row,
              medioPago: p.medioPago ?? row.medioPago,
              ...(p.pagos ? { pagos: p.pagos } : {}),
            };
          }
          return row;
        });
      }
    } else if (
      ev.event_type === "save_cierre" ||
      ev.event_type === "close_caja_turno"
    ) {
      const cierre = p.cierre as AnyObj | undefined;
      if (!cierre || typeof cierre !== "object") continue;
      const cUid = String(cierre.uid || "").trim();
      const alreadyCierre = db.cierresCajaCentral.some(
        (c: AnyObj) =>
          c &&
          ((cUid && String(c.uid || "").trim() === cUid) ||
            (!cUid && String(c.id || "") === String(cierre.id || "")))
      );
      if (!alreadyCierre) {
        db.cierresCajaCentral.unshift(cierre);
      }
      const cKey = String(p.cajaId || cierre.cajaId || "").trim();
      const isFullClose = p.isFullClose !== false;
      const isHistoricalSync = Boolean(p.isHistoricalSync);
      const closedMs =
        Date.parse(String(cierre.closedAtIso || cierre.createdAt || "")) || 0;

      if (isFullClose && cKey) {
        if (!isHistoricalSync) {
          db.efectivoInicialPorCaja[cKey] = round2(cierre.efectivoCambio || 0);
        }
        for (const ap of db.aperturasCajaCentral) {
          if (ap && String(ap.cajaId || "") === cKey && ap.cerradaEnTurno !== true) {
            if (isHistoricalSync && closedMs > 0) {
              const apMs =
                Date.parse(String(ap.createdAt || ap.openedAtIso || "")) || 0;
              if (apMs > closedMs + 60_000) continue;
            }
            ap.cerradaEnTurno = true;
            if (!ap.cerradaPorPlanilla) {
              ap.cerradaPorPlanilla = cierre.numeroPlanilla;
            }
            if (!ap.closedAtIso) {
              ap.closedAtIso = cierre.closedAtIso || cierre.createdAt;
            }
          }
        }
        if (Array.isArray(db.comprobantesPorCaja?.[cKey])) {
          db.comprobantesPorCaja[cKey] = db.comprobantesPorCaja[cKey].map(
            (comp: AnyObj) => {
              if (!comp || comp.cerradoEnTurno) return comp;
              if (isHistoricalSync && closedMs > 0) {
                const compMs = Date.parse(String(comp.createdAt || "")) || 0;
                if (compMs > closedMs + 60_000) return comp;
              }
              return {
                ...comp,
                cerradoEnTurno: true,
                cerradoPorPlanilla: comp.cerradoPorPlanilla || cierre.numeroPlanilla,
              };
            }
          );
        }
      }
    }
  }

  return db;
}

export async function handleErpVentas(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const seedDocs = buildCleanTenantSeed({ businessName: tenant.business_name }).docs;
  const fallback = seedDocs.ventas_db as AnyObj;

  if (req.method === "GET") {
    const getAction = (req.nextUrl.searchParams.get("action") || "").trim();
    const [docRes, pendingEvents] = await Promise.all([
      getTenantDoc<AnyObj>(tenant, "ventas_db", fallback),
      listPendingPosEvents(tenant, "ventas"),
    ]);
    const db = applyPendingVentasEvents(docRes.payload, pendingEvents);

    if (getAction === "cierres" || getAction === "fondos") {
      const cierresList = Array.isArray(db.cierresCajaCentral)
        ? db.cierresCajaCentral
        : Array.isArray(db.cierresCaja)
          ? db.cierresCaja
          : [];
      const maxPlanilla = cierresList.reduce(
        (mx: number, c: AnyObj) => Math.max(mx, Number(c?.numeroPlanilla || 0)),
        0
      );
      return jsonResponseMaybeGzip(req, {
        ok: true,
        nextNumero: maxPlanilla > 0 ? maxPlanilla + 1 : 1,
        nextCorrelativos: db.nextCorrelativos || {},
        cierres: cierresList,
        cierresCajaCentral: cierresList,
        aperturasCajaCentral: Array.isArray(db.aperturasCajaCentral)
          ? db.aperturasCajaCentral
          : [],
        efectivoInicialPorCaja: db.efectivoInicialPorCaja || {
          caja1: 0,
          caja2: 0,
          caja3: 0,
        },
        fondosDb: db.fondosDb || null,
      });
    }

    return jsonResponseMaybeGzip(req, db);
  }

  if (req.method === "POST") {
    const payload = ((await req.json().catch(() => null)) || null) as AnyObj | null;
    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { ok: false, message: "JSON inválido" },
        { status: 400 }
      );
    }

    const action = String(payload.action || "").trim();
    const actor = String(
      payload.usuario || payload.actor || req.headers.get("x-erp-user") || "sistema"
    );

    const [docRes, pendingEvents] = await Promise.all([
      getTenantDoc<AnyObj>(tenant, "ventas_db", fallback),
      listPendingPosEvents(tenant, "ventas"),
    ]);
    const db = applyPendingVentasEvents(docRes.payload, pendingEvents);
    if (!db.comprobantesPorCaja || typeof db.comprobantesPorCaja !== "object") {
      db.comprobantesPorCaja = { caja1: [], caja2: [], caja3: [] };
    }
    if (!db.nextCorrelativos || typeof db.nextCorrelativos !== "object") {
      db.nextCorrelativos = {};
    }
    if (!Array.isArray(db.dailyRecords)) db.dailyRecords = [];
    if (!Array.isArray(db.artMonthly)) db.artMonthly = [];
    if (!Array.isArray(db.artRecentDaily)) db.artRecentDaily = [];
    if (!Array.isArray(db.cierresCajaCentral)) db.cierresCajaCentral = [];
    if (!Array.isArray(db.aperturasCajaCentral)) db.aperturasCajaCentral = [];

    const commitVentas = async (
      tag: string,
      extra: AnyObj = {},
      changedKeys?: string[]
    ) => {
      db.updatedAt = new Date().toISOString();
      db.todayIso = db.updatedAt.slice(0, 10);
      let saved: { rev: number; updatedAt: string };
      if (Array.isArray(changedKeys) && changedKeys.length > 0) {
        const patchObj: Record<string, unknown> = {
          updatedAt: db.updatedAt,
          todayIso: db.todayIso,
        };
        for (const k of changedKeys) {
          patchObj[k] = db[k];
        }
        saved = await patchTenantDocKeys(
          tenant,
          "ventas_db",
          patchObj,
          db,
          actor,
          tag
        );
      } else {
        saved = await putTenantDoc(tenant, "ventas_db", db, actor, tag);
      }
      return NextResponse.json({ ok: true, rev: saved.rev, ...extra });
    };

    if (action === "record_pos_sale") {
      const src = (payload.sale && typeof payload.sale === "object"
        ? payload.sale
        : payload) as AnyObj;
      const cajaId = ["caja1", "caja2", "caja3"].includes(String(src.cajaId || payload.cajaId))
        ? String(src.cajaId || payload.cajaId)
        : "caja1";

      const pv = String(src.pv || (cajaId === "caja2" ? "0003" : cajaId === "caja3" ? "0004" : "0002")).padStart(4, "0");
      const letra = String(src.letra || "B").trim().toUpperCase();
      const tipoBase = String(src.tipoBase || "Factura").trim();
      const isNC = /cr[eé]dito/i.test(tipoBase);
      const isND = /d[eé]bito/i.test(tipoBase);

      const corrKey = isNC
        ? `${pv}-NC-${letra}`
        : isND
          ? `${pv}-ND-${letra}`
          : letra === "A"
            ? `${pv}-A`
            : pv;

      const assignedNro = Number(src.nro || db.nextCorrelativos[corrKey] || 1);
      const numeroCompleto = `${pv}-${String(assignedNro).padStart(8, "0")}`;
      const nowIso = new Date().toISOString();
      const fechaIso = String(src.fechaIso || nowIso.slice(0, 10));
      const incomingUid = String(src.uid || "").trim();

      // Protección: ignorar reenvíos históricos antiguos (>2 días ya cerrados) provenientes de cachés ARCA viejas
      if (Boolean(src.cerradoEnTurno) && fechaIso < "2026-11-23") {
        return NextResponse.json({
          ok: true,
          alreadyExists: true,
          ignoredHistorical: true,
          nro: assignedNro,
          numeroCompleto,
          nextCorrelativos: db.nextCorrelativos,
        });
      }

      if (!Array.isArray(db.comprobantesPorCaja[cajaId])) {
        db.comprobantesPorCaja[cajaId] = [];
      }

      // Idempotencia: evitar duplicar ventas/stock cuando el cliente reintenta desde la cola offline
      const existingSale = db.comprobantesPorCaja[cajaId].find((r: AnyObj) => {
        if (!r || typeof r !== "object") return false;
        if (incomingUid && String(r.uid || "").trim() === incomingUid) return true;
        return (
          String(r.numeroCompleto || "") === numeroCompleto &&
          String(r.tipoBase || "Factura").trim().toLowerCase() === tipoBase.toLowerCase() &&
          String(r.letra || "B").trim().toUpperCase() === letra &&
          String(r.fechaIso || "") === fechaIso
        );
      });
      if (existingSale) {
        return NextResponse.json({
          ok: true,
          alreadyExists: true,
          sale: existingSale,
          nro: Number(existingSale.nro || assignedNro),
          numeroCompleto: String(existingSale.numeroCompleto || numeroCompleto),
          nextCorrelativos: db.nextCorrelativos,
        });
      }

      const nextCorrelativosOut = {
        ...(db.nextCorrelativos || {}),
        [corrKey]: Math.max(
          Number(db.nextCorrelativos[corrKey] || 1),
          assignedNro + 1
        ),
      };

      const importe = round2(src.importe ?? src.total ?? 0);
      const skipStock = Boolean(payload.skipStock || src.skipStock);

      const saleRecord: AnyObj = {
        ...src,
        id: src.id || `sale_${Date.now()}_${assignedNro}`,
        entryType: "venta",
        cajaId,
        pv,
        nro: assignedNro,
        numeroCompleto,
        letra,
        tipoBase,
        importe,
        fechaIso,
        fechaHora: src.fechaHora || new Date().toLocaleString("es-AR"),
        createdAt: src.createdAt || nowIso,
        usuario: src.usuario || actor,
      };
      delete saleRecord.qrImgSrc;
      delete saleRecord.skipStock;

      const items = Array.isArray(src.items) ? src.items : [];
      let costoTotal = 0;
      const artDeltas: Array<{
        ym: string;
        d: string;
        a: number;
        q: number;
        v: number;
        c: number;
      }> = [];
      const stockDeltas: Array<{ artId: number; delta: number }> = [];
      const updatedStocks: Record<string, number> = {};

      if (items.length > 0) {
        const catFallback = seedDocs.catalog_db as AnyObj;
        const [catRes, pendingStockEvents] = await Promise.all([
          getTenantDoc<AnyObj>(tenant, "catalog_db", catFallback),
          listPendingPosEvents(tenant, "catalog"),
        ]);
        const catDb = catRes.payload;
        const pendingDeltaByArt = new Map<number, number>();
        for (const ev of pendingStockEvents) {
          for (const sd of Array.isArray(ev.stock_deltas) ? ev.stock_deltas : []) {
            const aid = Number(sd?.artId || 0);
            const delta = Number(sd?.delta || 0);
            if (aid > 0 && delta) {
              pendingDeltaByArt.set(aid, (pendingDeltaByArt.get(aid) || 0) + delta);
            }
          }
        }
        if (Array.isArray(catDb.articulos)) {
          const ym = fechaIso.slice(0, 7);
          for (const it of items) {
            if (it.isService || it.itemType === "service") continue;
            const artId = Number(it.artId || it.id || 0);
            const qty = Number(it.cantidad || it.qty || 0);
            if (!qty || artId === 4407) continue;
            const art = catDb.articulos.find((a: AnyObj) => Number(a.id) === artId);
            if (art) {
              if (!skipStock) {
                const delta = isNC ? qty : -qty;
                stockDeltas.push({ artId, delta });
                const prevSf =
                  Number(art.sf || 0) + (pendingDeltaByArt.get(artId) || 0);
                const newSf = round3(prevSf + delta);
                pendingDeltaByArt.set(
                  artId,
                  (pendingDeltaByArt.get(artId) || 0) + delta
                );
                updatedStocks[String(artId)] = newSf;
              }
              const unitCost = Number(art.cfn || art.cn || 0);
              costoTotal += unitCost * qty;

              const sign = isNC ? -1 : 1;
              const subImp = round2(
                Number(it.subtotal ?? Number(it.precio || 0) * qty) * sign
              );
              const subCost = round2(unitCost * qty * sign);

              artDeltas.push({
                ym,
                d: fechaIso,
                a: artId,
                q: round3(qty * sign),
                v: subImp,
                c: subCost,
              });
            }
          }
        }
      }

      const dailyRecord =
        letra !== "X"
          ? {
              d: fechaIso,
              pv: Number(pv),
              tc: isNC ? 6 : 1,
              l: letra,
              m: String(src.medioPago || "EFECTIVO").toUpperCase(),
              v: isNC ? -Math.abs(importe) : importe,
              c: isNC ? -Math.abs(round2(costoTotal)) : round2(costoTotal),
              n: 1,
            }
          : null;

      const dedupeKey = `sale:${cajaId}:${
        incomingUid || `${numeroCompleto}:${tipoBase.toLowerCase()}:${letra}:${fechaIso}`
      }`;

      // Escritura atómica ultrarrápida (~2 KB / ~20 ms) en tabla append-only erp_pos_events:
      // elimina la reescritura de 22.4 MB (ventas_db + catalog_db) por cada ticket en el POS.
      const evRes = await appendPosEvent(
        tenant,
        "record_pos_sale",
        dedupeKey,
        {
          cajaId,
          corrKey,
          assignedNro,
          saleRecord,
          dailyRecord,
          artDeltas,
          stockDeltas,
        },
        actor,
        stockDeltas.length > 0
      );

      return NextResponse.json({
        ok: true,
        eventId: evRes.id,
        alreadyExists: !evRes.inserted,
        sale: evRes.inserted
          ? saleRecord
          : evRes.payload?.saleRecord || saleRecord,
        nro: assignedNro,
        numeroCompleto,
        nextCorrelativos: nextCorrelativosOut,
        updatedStocks,
      });
    }

    if (
      action === "record_caja_movement" ||
      action === "record_caja_retiro" ||
      action === "record_caja_recibo"
    ) {
      const cajaId = ["caja1", "caja2", "caja3"].includes(String(payload.cajaId))
        ? String(payload.cajaId)
        : "caja1";
      const rawMov = (payload.movement && typeof payload.movement === "object"
        ? payload.movement
        : payload) as AnyObj;
      const mov: AnyObj = {
        id: rawMov.id || payload.id || `mov_${Date.now()}`,
        entryType:
          action === "record_caja_retiro"
            ? "retiro"
            : action === "record_caja_recibo"
              ? "recibo"
              : String(rawMov.entryType || payload.entryType || "movimiento"),
        createdAt: rawMov.createdAt || new Date().toISOString(),
        usuario: rawMov.usuario || actor,
        ...rawMov,
      };
      if (!Array.isArray(db.comprobantesPorCaja[cajaId])) {
        db.comprobantesPorCaja[cajaId] = [];
      }
      const movUid = String(mov.uid || "").trim();
      const movNum = String(mov.numeroCompleto || "").trim();
      const movFechaIso = String(mov.fechaIso || "").trim();
      const existingMov = db.comprobantesPorCaja[cajaId].find((r: AnyObj) => {
        if (!r || typeof r !== "object") return false;
        if (movUid && String(r.uid || "").trim() === movUid) return true;
        if (rawMov.id && String(r.id || "") === String(rawMov.id)) return true;
        if (movNum && movFechaIso && String(r.numeroCompleto || "") === movNum && String(r.entryType || "") === String(mov.entryType || "") && String(r.fechaIso || "") === movFechaIso) return true;
        return false;
      });
      if (existingMov) {
        return NextResponse.json({ ok: true, alreadyExists: true, movement: existingMov });
      }
      const movDedupe = `mov:${cajaId}:${movUid || mov.id || `${mov.entryType}:${movNum}:${movFechaIso}`}`;
      const evRes = await appendPosEvent(
        tenant,
        action,
        movDedupe,
        { cajaId, movement: mov },
        actor,
        false
      );
      return NextResponse.json({
        ok: true,
        eventId: evRes.id,
        alreadyExists: !evRes.inserted,
        movement: evRes.inserted ? mov : evRes.payload?.movement || mov,
      });
    }

    if (action === "annul_caja_movement") {
      const id = String(payload.id || payload.movId || "");
      await appendPosEvent(
        tenant,
        "annul_caja_movement",
        `annul:${id}`,
        { id },
        actor,
        false
      );
      return NextResponse.json({ ok: true, id });
    }

    if (action === "update_comprobante_medio_pago") {
      const id = String(payload.id || "");
      const numeroCompleto = String(payload.numeroCompleto || "");
      let updated: AnyObj | null = null;
      for (const cKey of ["caja1", "caja2", "caja3"]) {
        for (const row of db.comprobantesPorCaja[cKey] || []) {
          if (String(row.id) === id || (numeroCompleto && String(row.numeroCompleto) === numeroCompleto)) {
            updated = {
              ...row,
              medioPago: payload.medioPago ?? row.medioPago,
              ...(payload.pagos ? { pagos: payload.pagos } : {}),
            };
          }
        }
      }
      await appendPosEvent(
        tenant,
        "update_comprobante_medio_pago",
        `mp:${id || numeroCompleto}:${Date.now()}`,
        {
          id,
          numeroCompleto,
          medioPago: payload.medioPago,
          pagos: payload.pagos,
        },
        actor,
        false
      );
      return NextResponse.json({ ok: true, comprobante: updated });
    }

    if (action === "close_caja_turno" || action === "save_cierre") {
      const cierreIn = (payload.cierre || payload) as AnyObj;
      const incomingUid = String(cierreIn.uid || "").trim();
      const existingByUid = incomingUid
        ? db.cierresCajaCentral.find((c: AnyObj) => c && String(c.uid || "") === incomingUid)
        : null;

      if (existingByUid) {
        const nextMaxPlanilla = db.cierresCajaCentral.reduce(
          (mx: number, c: AnyObj) => Math.max(mx, Number(c?.numeroPlanilla || 0)),
          0
        );
        return NextResponse.json({
          ok: true,
          alreadyExists: true,
          cierre: existingByUid,
          nextNumero: nextMaxPlanilla + 1,
          cierresCajaCentral: db.cierresCajaCentral,
          aperturasCajaCentral: db.aperturasCajaCentral,
          efectivoInicialPorCaja: db.efectivoInicialPorCaja,
        });
      }

      const maxPlanilla = db.cierresCajaCentral.reduce(
        (mx: number, c: AnyObj) => Math.max(mx, Number(c?.numeroPlanilla || 0)),
        0
      );
      const nowIso = new Date().toISOString();
      const savedCierre: AnyObj = {
        ...cierreIn,
        id: cierreIn.id || `cierre_${Date.now()}`,
        numeroPlanilla: Math.max(
          Number(cierreIn.numeroPlanilla || 0),
          maxPlanilla + 1
        ),
        createdAt: cierreIn.createdAt || nowIso,
        closedAtIso: cierreIn.closedAtIso || nowIso,
        estadoCentral: cierreIn.estadoCentral || "PENDIENTE",
      };
      delete savedCierre.historicalSync;
      db.cierresCajaCentral.unshift(savedCierre);

      const cKey = String(cierreIn.cajaId || payload.cajaId || "").trim();
      const tipoNorm = String(savedCierre.tipoRendicion || "Cierre de caja")
        .trim()
        .toLowerCase();
      const isFullClose =
        tipoNorm !== "rendición parcial" && tipoNorm !== "rendicion parcial";

      if (!db.efectivoInicialPorCaja || typeof db.efectivoInicialPorCaja !== "object") {
        db.efectivoInicialPorCaja = { caja1: 0, caja2: 0, caja3: 0 };
      }

      const closedMs = Date.parse(String(savedCierre.closedAtIso || "")) || Date.now();
      const hasNewerOpenApertura =
        cKey &&
        db.aperturasCajaCentral.some((ap: AnyObj) => {
          if (!ap || String(ap.cajaId || "") !== cKey || ap.cerradaEnTurno === true) return false;
          const apMs = Date.parse(String(ap.createdAt || ap.openedAtIso || "")) || 0;
          return apMs > closedMs + 60_000;
        });
      const isHistoricalSync = Boolean(
        payload.historicalSync ||
          cierreIn.historicalSync ||
          hasNewerOpenApertura
      );

      if (isFullClose && cKey) {
        if (!isHistoricalSync) {
          db.efectivoInicialPorCaja[cKey] = round2(cierreIn.efectivoCambio || 0);
        }

        // Marcar aperturas de esa caja como cerradas (si es sync histórico, solo las anteriores al cierre)
        for (const ap of db.aperturasCajaCentral) {
          if (ap && String(ap.cajaId || "") === cKey && ap.cerradaEnTurno !== true) {
            if (isHistoricalSync) {
              const apMs = Date.parse(String(ap.createdAt || ap.openedAtIso || "")) || 0;
              if (apMs > closedMs + 60_000) continue;
            }
            ap.cerradaEnTurno = true;
            if (!ap.cerradaPorPlanilla) {
              ap.cerradaPorPlanilla = savedCierre.numeroPlanilla;
            }
            if (!ap.closedAtIso) {
              ap.closedAtIso = savedCierre.closedAtIso || nowIso;
            }
          }
        }

        // Marcar comprobantes del turno de esa caja como cerrados (si es sync histórico, solo anteriores al cierre)
        if (Array.isArray(db.comprobantesPorCaja?.[cKey])) {
          for (const comp of db.comprobantesPorCaja[cKey]) {
            if (comp && !comp.cerradoEnTurno) {
              if (isHistoricalSync) {
                const compMs = Date.parse(String(comp.createdAt || "")) || 0;
                if (compMs > closedMs + 60_000) continue;
              }
              comp.cerradoEnTurno = true;
              if (!comp.cerradoPorPlanilla) {
                comp.cerradoPorPlanilla = savedCierre.numeroPlanilla;
              }
            }
          }
        }

        // Liberar en la tabla users solo si no es un rescate histórico de un turno pasado
        if (!isHistoricalSync) {
          try {
            const closingUser = String(cierreIn.username || actor || "")
              .trim()
              .toLowerCase();
            const allUsers = await listTenantUsersFromDb(tenant);
            for (const u of allUsers) {
              const uKey = String(u.username || "").trim().toLowerCase();
              if (u.cajaAbierta === cKey || (closingUser && uKey === closingUser && u.cajaAbierta === cKey)) {
                await upsertTenantUserInDb(tenant, {
                  ...u,
                  cajaAbierta: null,
                  cajaAbiertaAt: null,
                  actor: closingUser || actor || "sistema",
                });
              }
            }
          } catch {
            // Non-blocking fallback
          }
        }
      }

      const nextMaxPlanilla = db.cierresCajaCentral.reduce(
        (mx: number, c: AnyObj) => Math.max(mx, Number(c?.numeroPlanilla || 0)),
        0
      );

      // Escritura atómica ultrarrápida (~3 KB / ~20 ms) en erp_pos_events:
      // evita reescribir la fila TOAST de 10.4 MB de ventas_db al cerrar turno o rescatar cierres.
      const cierreDedupeKey = `cierre:${
        incomingUid || savedCierre.id || `NP-${savedCierre.numeroPlanilla}`
      }`;
      const evRes = await appendPosEvent(
        tenant,
        "save_cierre",
        cierreDedupeKey,
        {
          cajaId: cKey,
          cierre: savedCierre,
          isFullClose,
          isHistoricalSync,
        },
        actor,
        false
      );

      return NextResponse.json({
        ok: true,
        eventId: evRes.id,
        alreadyExists: !evRes.inserted,
        cierre: evRes.inserted
          ? savedCierre
          : evRes.payload?.cierre || savedCierre,
        historicalSync: isHistoricalSync,
        nextNumero: nextMaxPlanilla + 1,
        cierresCajaCentral: db.cierresCajaCentral,
        aperturasCajaCentral: db.aperturasCajaCentral,
        efectivoInicialPorCaja: db.efectivoInicialPorCaja,
      });
    }

    if (action === "force_close_apertura_caja") {
      const cKey = String(payload.cajaId || "").trim();
      if (!cKey) {
        return NextResponse.json(
          { ok: false, message: "Falta indicar la caja a liberar." },
          { status: 400 }
        );
      }
      const nowIso = new Date().toISOString();
      let closedCount = 0;
      for (const ap of db.aperturasCajaCentral) {
        if (ap && String(ap.cajaId || "") === cKey && ap.cerradaEnTurno !== true) {
          ap.cerradaEnTurno = true;
          ap.closedAtIso = nowIso;
          ap.closedByAdmin = actor;
          closedCount++;
        }
      }
      try {
        const allUsers = await listTenantUsersFromDb(tenant);
        for (const u of allUsers) {
          if (u.cajaAbierta === cKey) {
            await upsertTenantUserInDb(tenant, {
              ...u,
              cajaAbierta: null,
              cajaAbiertaAt: null,
              actor: actor || "sistema",
            });
          }
        }
      } catch {}
      return commitVentas(
        "force_close_apertura_caja",
        {
          cajaId: cKey,
          closedCount,
          aperturasCajaCentral: db.aperturasCajaCentral,
          efectivoInicialPorCaja: db.efectivoInicialPorCaja,
        },
        ["aperturasCajaCentral"]
      );
    }

    if (action === "save_apertura_caja" || action === "open_caja_turno") {
      const apIn = (payload.apertura || payload) as AnyObj;
      const cKey = String(apIn.cajaId || payload.cajaId || "caja1").trim();
      const apUser = String(apIn.username || actor || "").trim().toLowerCase();

      // Auto-sanear aperturas viejas anteriores al último Cierre de Caja de esa terminal
      const lastFullCierre = db.cierresCajaCentral.find(
        (c: AnyObj) =>
          c &&
          String(c.cajaId || "") === cKey &&
          String(c.tipoRendicion || "Cierre de caja").toLowerCase() !== "rendición parcial" &&
          String(c.tipoRendicion || "Cierre de caja").toLowerCase() !== "rendicion parcial"
      );
      const lastCloseMs = lastFullCierre
        ? Date.parse(String(lastFullCierre.closedAtIso || lastFullCierre.createdAt || "")) || 0
        : 0;
      for (const ap of db.aperturasCajaCentral) {
        if (ap && String(ap.cajaId || "") === cKey && ap.cerradaEnTurno !== true && lastCloseMs > 0) {
          const apMs = Date.parse(String(ap.openedAtIso || ap.createdAt || "")) || 0;
          if (apMs > 0 && apMs <= lastCloseMs) {
            ap.cerradaEnTurno = true;
          }
        }
      }

      const activeExisting = db.aperturasCajaCentral.find(
        (a: AnyObj) => a && String(a.cajaId || "") === cKey && a.cerradaEnTurno !== true
      );
      if (activeExisting) {
        const existingOwner = String(activeExisting.username || "").trim().toLowerCase();
        if (existingOwner && apUser && existingOwner !== apUser) {
          return NextResponse.json({
            ok: false,
            alreadyOpened: true,
            apertura: activeExisting,
            aperturasCajaCentral: db.aperturasCajaCentral,
            efectivoInicialPorCaja: db.efectivoInicialPorCaja,
          });
        }
        // Si es doble click del mismo usuario en el mismo turno, actualizar sin duplicar fila
        Object.assign(activeExisting, {
          ...apIn,
          id: activeExisting.id,
          uid: activeExisting.uid || apIn.uid,
          cajaId: cKey,
          cerradaEnTurno: false,
        });
        if (!db.efectivoInicialPorCaja) {
          db.efectivoInicialPorCaja = { caja1: 0, caja2: 0, caja3: 0 };
        }
        db.efectivoInicialPorCaja[cKey] = round2(
          apIn.efectivoConfirmado ?? apIn.efectivoInicial ?? apIn.importe ?? 0
        );
        return commitVentas(
          action,
          {
            apertura: activeExisting,
            aperturasCajaCentral: db.aperturasCajaCentral,
            efectivoInicialPorCaja: db.efectivoInicialPorCaja,
          },
          ["aperturasCajaCentral", "efectivoInicialPorCaja"]
        );
      }

      const savedAp: AnyObj = {
        ...apIn,
        id: apIn.id || `ap_${Date.now()}`,
        cajaId: cKey,
        cerradaEnTurno: false,
        createdAt: new Date().toISOString(),
      };
      db.aperturasCajaCentral.unshift(savedAp);
      if (!db.efectivoInicialPorCaja) {
        db.efectivoInicialPorCaja = { caja1: 0, caja2: 0, caja3: 0 };
      }
      db.efectivoInicialPorCaja[cKey] = round2(
        apIn.efectivoConfirmado ?? apIn.efectivoInicial ?? apIn.importe ?? 0
      );

      // Sincronizar también en la tabla users qué usuario abrió esta caja
      if (apUser) {
        try {
          const allUsers = await listTenantUsersFromDb(tenant);
          for (const u of allUsers) {
            const uKey = String(u.username || "").trim().toLowerCase();
            if (uKey === apUser) {
              await upsertTenantUserInDb(tenant, {
                ...u,
                cajaAbierta: cKey,
                cajaAbiertaAt: savedAp.openedAtIso || savedAp.createdAt,
                actor: apUser,
              });
            } else if (u.cajaAbierta === cKey) {
              await upsertTenantUserInDb(tenant, {
                ...u,
                cajaAbierta: null,
                cajaAbiertaAt: null,
                actor: apUser,
              });
            }
          }
        } catch {}
      }

      return commitVentas(
        action,
        {
          apertura: savedAp,
          aperturasCajaCentral: db.aperturasCajaCentral,
          efectivoInicialPorCaja: db.efectivoInicialPorCaja,
        },
        ["aperturasCajaCentral", "efectivoInicialPorCaja"]
      );
    }

    if (action === "update_apertura_caja") {
      const id = String(payload.id || payload.aperturaId || "");
      const target = db.aperturasCajaCentral.find(
        (a: AnyObj) => String(a.id) === id
      );
      if (target) {
        Object.assign(target, payload.patch || payload.apertura || {});
        if (payload.efectivoInicial !== undefined) {
          target.efectivoInicial = round2(payload.efectivoInicial);
          const cKey = String(target.cajaId || "caja1");
          if (!db.efectivoInicialPorCaja) {
            db.efectivoInicialPorCaja = { caja1: 0, caja2: 0, caja3: 0 };
          }
          db.efectivoInicialPorCaja[cKey] = target.efectivoInicial;
        }
      }
      return commitVentas(
        "update_apertura_caja",
        {
          apertura: target || null,
          aperturasCajaCentral: db.aperturasCajaCentral,
          efectivoInicialPorCaja: db.efectivoInicialPorCaja,
        },
        ["aperturasCajaCentral", "efectivoInicialPorCaja"]
      );
    }

    if (action === "save_fondos_state") {
      db.fondosDb = payload.fondosDb ?? payload.fondos ?? payload;
      return commitVentas("save_fondos_state", { fondosDb: db.fondosDb }, ["fondosDb"]);
    }

    if (action === "confirm_cierre_central" || action === "update_cierre_central") {
      const id = String(payload.id || payload.cierreId || "");
      const target = db.cierresCajaCentral.find(
        (c: AnyObj) =>
          String(c.id) === id ||
          Number(c.numeroPlanilla) === Number(payload.numeroPlanilla || -1)
      );
      if (target) {
        Object.assign(target, payload.patch || payload.cierre || {});
        if (action === "confirm_cierre_central" || payload.confirmar) {
          target.estadoCentral = "CONFIRMADO";
          target.confirmadoAt = new Date().toISOString();
          target.confirmadoPor = actor;
        }
      }
      return commitVentas(
        action,
        {
          cierre: target || null,
          cierresCajaCentral: db.cierresCajaCentral,
        },
        ["cierresCajaCentral"]
      );
    }

    return commitVentas(action || "ventas_update", {});
  }

  return NextResponse.json(
    { ok: false, message: "Método no permitido" },
    { status: 405 }
  );
}
