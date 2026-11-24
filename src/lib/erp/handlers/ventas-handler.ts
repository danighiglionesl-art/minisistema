import { NextRequest, NextResponse } from "next/server";
import { jsonResponseMaybeGzip } from "../json-response";
import { buildCleanTenantSeed } from "../seed-clean-tenant";
import {
  getTenantDoc,
  listTenantUsersFromDb,
  patchTenantDocKeys,
  putTenantDoc,
  upsertTenantUserInDb,
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

export async function handleErpVentas(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const seedDocs = buildCleanTenantSeed({ businessName: tenant.business_name }).docs;
  const fallback = seedDocs.ventas_db as AnyObj;

  if (req.method === "GET") {
    const getAction = (req.nextUrl.searchParams.get("action") || "").trim();
    const { payload: db } = await getTenantDoc<AnyObj>(tenant, "ventas_db", fallback);

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

    const { payload: db } = await getTenantDoc<AnyObj>(tenant, "ventas_db", fallback);
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
      db.nextCorrelativos[corrKey] = Math.max(
        Number(db.nextCorrelativos[corrKey] || 1),
        assignedNro + 1
      );

      const numeroCompleto = `${pv}-${String(assignedNro).padStart(8, "0")}`;
      const nowIso = new Date().toISOString();
      const fechaIso = String(src.fechaIso || nowIso.slice(0, 10));
      const importe = round2(src.importe ?? src.total ?? 0);

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
        createdAt: nowIso,
        usuario: src.usuario || actor,
      };
      delete saleRecord.qrImgSrc;

      if (!Array.isArray(db.comprobantesPorCaja[cajaId])) {
        db.comprobantesPorCaja[cajaId] = [];
      }
      db.comprobantesPorCaja[cajaId].unshift(saleRecord);

      if (!db.lastEmitidosDetalle || typeof db.lastEmitidosDetalle !== "object") {
        db.lastEmitidosDetalle = {};
      }
      db.lastEmitidosDetalle[corrKey] = saleRecord;

      // Estadísticas diarias y descuento de stock (excluyendo Artículo Genérico 4407)
      const items = Array.isArray(src.items) ? src.items : [];
      let costoTotal = 0;

      if (items.length > 0) {
        const catFallback = seedDocs.catalog_db as AnyObj;
        const { payload: catDb } = await getTenantDoc<AnyObj>(tenant, "catalog_db", catFallback);
        if (Array.isArray(catDb.articulos)) {
          let stockChanged = false;
          const ym = fechaIso.slice(0, 7);
          for (const it of items) {
            if (it.isService || it.itemType === "service") continue;
            const artId = Number(it.artId || it.id || 0);
            const qty = Number(it.cantidad || it.qty || 0);
            if (!qty || artId === 4407) continue;
            const art = catDb.articulos.find((a: AnyObj) => Number(a.id) === artId);
            if (art) {
              const delta = isNC ? qty : -qty;
              art.sf = round3(Number(art.sf || 0) + delta);
              stockChanged = true;
              const unitCost = Number(art.cfn || art.cn || 0);
              costoTotal += unitCost * qty;

              const sign = isNC ? -1 : 1;
              const subImp = round2(Number(it.subtotal ?? Number(it.precio || 0) * qty) * sign);
              const subCost = round2(unitCost * qty * sign);

              const mRow = db.artMonthly.find(
                (m: AnyObj) => m.ym === ym && Number(m.a) === artId
              );
              if (mRow) {
                mRow.q = round3(Number(mRow.q || 0) + qty * sign);
                mRow.v = round2(Number(mRow.v || 0) + subImp);
                mRow.c = round2(Number(mRow.c || 0) + subCost);
              } else {
                db.artMonthly.push({
                  ym,
                  a: artId,
                  q: round3(qty * sign),
                  v: subImp,
                  c: subCost,
                });
              }

              db.artRecentDaily.push({
                d: fechaIso,
                a: artId,
                q: round3(qty * sign),
                v: subImp,
                c: subCost,
              });
            }
          }
          if (stockChanged) {
            catDb.updatedAt = nowIso;
            await putTenantDoc(tenant, "catalog_db", catDb, actor, "pos_sale_stock");
          }
        }
      }

      if (letra !== "X") {
        db.dailyRecords.push({
          d: fechaIso,
          pv: Number(pv),
          tc: isNC ? 6 : 1,
          l: letra,
          m: String(src.medioPago || "EFECTIVO").toUpperCase(),
          v: isNC ? -Math.abs(importe) : importe,
          c: isNC ? -Math.abs(round2(costoTotal)) : round2(costoTotal),
          n: 1,
        });
      }

      return commitVentas("record_pos_sale", {
        sale: saleRecord,
        nro: assignedNro,
        numeroCompleto,
        nextCorrelativos: db.nextCorrelativos,
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
      const mov = {
        id: payload.id || `mov_${Date.now()}`,
        entryType:
          action === "record_caja_retiro"
            ? "retiro"
            : action === "record_caja_recibo"
              ? "recibo"
              : String(payload.entryType || "movimiento"),
        createdAt: new Date().toISOString(),
        usuario: actor,
        ...(payload.movement || payload),
      };
      if (!Array.isArray(db.comprobantesPorCaja[cajaId])) {
        db.comprobantesPorCaja[cajaId] = [];
      }
      db.comprobantesPorCaja[cajaId].unshift(mov);
      return commitVentas(action, { movement: mov }, ["comprobantesPorCaja"]);
    }

    if (action === "annul_caja_movement") {
      const id = String(payload.id || payload.movId || "");
      for (const cKey of ["caja1", "caja2", "caja3"]) {
        if (Array.isArray(db.comprobantesPorCaja[cKey])) {
          const item = db.comprobantesPorCaja[cKey].find(
            (x: AnyObj) => String(x.id) === id
          );
          if (item) item.anulado = true;
        }
      }
      return commitVentas("annul_caja_movement", { id }, ["comprobantesPorCaja"]);
    }

    if (action === "update_comprobante_medio_pago") {
      const id = String(payload.id || "");
      let updated: AnyObj | null = null;
      for (const cKey of ["caja1", "caja2", "caja3"]) {
        for (const row of db.comprobantesPorCaja[cKey] || []) {
          if (String(row.id) === id || String(row.numeroCompleto) === String(payload.numeroCompleto || "")) {
            row.medioPago = payload.medioPago ?? row.medioPago;
            if (payload.pagos) row.pagos = payload.pagos;
            updated = row;
          }
        }
      }
      return commitVentas(
        "update_comprobante_medio_pago",
        { comprobante: updated },
        ["comprobantesPorCaja"]
      );
    }

    if (action === "close_caja_turno" || action === "save_cierre") {
      const cierreIn = (payload.cierre || payload) as AnyObj;
      const incomingUid = String(cierreIn.uid || "").trim();
      const existingByUid = incomingUid
        ? db.cierresCajaCentral.find((c: AnyObj) => c && String(c.uid || "") === incomingUid)
        : null;

      const maxPlanilla = db.cierresCajaCentral.reduce(
        (mx: number, c: AnyObj) => Math.max(mx, Number(c?.numeroPlanilla || 0)),
        0
      );
      const nowIso = new Date().toISOString();
      const savedCierre = existingByUid || {
        ...cierreIn,
        id: cierreIn.id || `cierre_${Date.now()}`,
        numeroPlanilla: Math.max(
          Number(cierreIn.numeroPlanilla || 0),
          maxPlanilla + 1
        ),
        createdAt: nowIso,
        closedAtIso: cierreIn.closedAtIso || nowIso,
        estadoCentral: cierreIn.estadoCentral || "PENDIENTE",
      };
      if (!existingByUid) {
        db.cierresCajaCentral.unshift(savedCierre);
      }

      const cKey = String(cierreIn.cajaId || payload.cajaId || "").trim();
      const tipoNorm = String(savedCierre.tipoRendicion || "Cierre de caja")
        .trim()
        .toLowerCase();
      const isFullClose =
        tipoNorm !== "rendición parcial" && tipoNorm !== "rendicion parcial";

      if (!db.efectivoInicialPorCaja || typeof db.efectivoInicialPorCaja !== "object") {
        db.efectivoInicialPorCaja = { caja1: 0, caja2: 0, caja3: 0 };
      }

      if (isFullClose && cKey) {
        db.efectivoInicialPorCaja[cKey] = round2(cierreIn.efectivoCambio || 0);

        // Marcar todas las aperturas de esa caja como cerradas en este turno
        for (const ap of db.aperturasCajaCentral) {
          if (ap && String(ap.cajaId || "") === cKey && ap.cerradaEnTurno !== true) {
            ap.cerradaEnTurno = true;
            if (!ap.cerradaPorPlanilla) {
              ap.cerradaPorPlanilla = savedCierre.numeroPlanilla;
            }
            if (!ap.closedAtIso) {
              ap.closedAtIso = savedCierre.closedAtIso || nowIso;
            }
          }
        }

        // Marcar comprobantes del turno de esa caja como cerrados (conservando el historial)
        if (Array.isArray(db.comprobantesPorCaja?.[cKey])) {
          for (const comp of db.comprobantesPorCaja[cKey]) {
            if (comp && !comp.cerradoEnTurno) {
              comp.cerradoEnTurno = true;
              if (!comp.cerradoPorPlanilla) {
                comp.cerradoPorPlanilla = savedCierre.numeroPlanilla;
              }
            }
          }
        }

        // Liberar en la tabla users de forma atómica a cualquier usuario que tuviera abierta esta caja
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

      const nextMaxPlanilla = db.cierresCajaCentral.reduce(
        (mx: number, c: AnyObj) => Math.max(mx, Number(c?.numeroPlanilla || 0)),
        0
      );
      return commitVentas(
        action,
        {
          cierre: savedCierre,
          nextNumero: nextMaxPlanilla + 1,
          cierresCajaCentral: db.cierresCajaCentral,
          aperturasCajaCentral: db.aperturasCajaCentral,
          efectivoInicialPorCaja: db.efectivoInicialPorCaja,
        },
        [
          "cierresCajaCentral",
          "aperturasCajaCentral",
          "comprobantesPorCaja",
          "efectivoInicialPorCaja",
        ]
      );
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
