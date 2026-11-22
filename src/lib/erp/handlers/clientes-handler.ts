import { NextRequest, NextResponse } from "next/server";
import { jsonResponseMaybeGzip } from "../json-response";
import { buildCleanTenantSeed } from "../seed-clean-tenant";
import { getTenantDoc, putTenantDoc } from "../supabase-server";
import type { ErpTenantRecord } from "../types";

type AnyObj = Record<string, any>;

function round2(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function cleanDocDigits(raw: unknown): string {
  return String(raw || "").replace(/\D/g, "");
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
  const catFallback = buildCleanTenantSeed({ businessName: tenant.business_name }).docs
    .catalog_db as AnyObj;
  const { payload: catDb } = await getTenantDoc<AnyObj>(tenant, "catalog_db", catFallback);
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
  catDb.proveedores = list;
  catDb.updatedAt = new Date().toISOString();
  await putTenantDoc(tenant, "catalog_db", catDb, actor, "sync_proveedores");
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
    if (!Array.isArray(db.soyCajeroTickets)) db.soyCajeroTickets = [];

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
      const digits = cleanDocDigits(payload.nroDoc || payload.documento);
      const email = String(payload.email || "").trim().toUpperCase();
      const found = db.clientes.find((c: AnyObj) => {
        if (Number(c.codigo) === 1) return false;
        const cDigits = cleanDocDigits(c.nroDoc);
        if (digits.length >= 6 && cDigits && (cDigits === digits || cDigits.includes(digits))) {
          return true;
        }
        if (email && String(c.email || "").trim().toUpperCase() === email) {
          return true;
        }
        return false;
      });
      return NextResponse.json({ ok: true, found: Boolean(found), client: found || null });
    }

    if (
      postAction === "save_client" ||
      postAction === "save_proveedor" ||
      postAction === "register_online_client" ||
      postAction === "update_client_profile"
    ) {
      const incoming = (payload.client ||
        payload.cliente ||
        payload.proveedor ||
        payload) as AnyObj;
      const isProv = postAction === "save_proveedor" || Boolean(incoming.esProveedor);
      let id = Number(incoming.id || 0);
      let idx = db.clientes.findIndex((c: AnyObj) => id > 0 && Number(c.id) === id);

      if (idx < 0 && postAction === "register_online_client") {
        const d = cleanDocDigits(incoming.nroDoc || incoming.dni);
        if (d.length >= 6) {
          idx = db.clientes.findIndex(
            (c: AnyObj) => cleanDocDigits(c.nroDoc) === d && Number(c.codigo) !== 1
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

      if (id <= 0) id = maxId + 1;
      const prev = idx >= 0 ? db.clientes[idx] : {};
      const codigo = Number(incoming.codigo || prev.codigo || maxCod + 1);
      const nombre = String(incoming.nombre || prev.nombre || "")
        .trim()
        .toUpperCase();

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

      const merged: AnyObj = {
        ...prev,
        ...incoming,
        id,
        codigo,
        codigoProveedor: codigo,
        idProveedor: isProv ? Number(prev.idProveedor || 1000 + codigo) : Number(prev.idProveedor || 0),
        nombre,
        numero: cleanNum,
        numeroFiscal: cleanNumFiscal,
        razonSocial: String(incoming.razonSocial || prev.razonSocial || nombre).toUpperCase(),
        nombreFantasia: String(incoming.nombreFantasia || prev.nombreFantasia || nombre).toUpperCase(),
        pais: String(incoming.pais || prev.pais || "ARGENTINA").toUpperCase(),
        provincia: String(incoming.provincia || prev.provincia || tenant.branding.provincia || "CÓRDOBA").toUpperCase(),
        localidad: String(incoming.localidad || prev.localidad || tenant.branding.localidad || "RÍO CUARTO").toUpperCase(),
        cp: String(incoming.cp || prev.cp || tenant.branding.cp || "5800"),
        esCliente: incoming.esCliente !== undefined ? Boolean(incoming.esCliente) : prev.esCliente ?? !isProv,
        esProveedor: isProv || Boolean(prev.esProveedor),
        estado: incoming.bajaLogica ? "B" : "A",
        fechaAlta: prev.fechaAlta || new Date().toLocaleDateString("es-AR"),
        accesoWebHabilitado:
          postAction === "register_online_client"
            ? 1
            : Number(incoming.accesoWebHabilitado ?? prev.accesoWebHabilitado ?? 0),
      };

      if (idx >= 0) db.clientes[idx] = merged;
      else db.clientes.push(merged);

      if (merged.esProveedor) {
        await syncProveedoresToCatalog(tenant, db.clientes, actor);
      }

      return commit(postAction, { client: merged, cliente: merged, proveedor: merged });
    }

    if (postAction === "client_login") {
      const userOrDoc = String(payload.username || payload.usuario || payload.email || "")
        .trim()
        .toLowerCase();
      const pass = String(payload.password || payload.clave || "");
      const digits = cleanDocDigits(userOrDoc);

      const cli = db.clientes.find((c: AnyObj) => {
        if (Number(c.codigo) === 1 || c.bajaLogica) return false;
        const matchUser =
          (c.usuarioWeb && String(c.usuarioWeb).toLowerCase() === userOrDoc) ||
          (c.email && String(c.email).toLowerCase() === userOrDoc) ||
          (digits.length >= 6 && cleanDocDigits(c.nroDoc) === digits);
        if (!matchUser) return false;
        return String(c.claveWeb || "") === pass;
      });

      if (!cli) {
        return NextResponse.json(
          { ok: false, message: "Credenciales inválidas" },
          { status: 401 }
        );
      }
      return NextResponse.json({ ok: true, client: cli, cliente: cli });
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
      const fStr = String(movIn.f || movIn.fecha || payload.fecha || new Date().toLocaleDateString("es-AR"));
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
        fi: String(movIn.fi || movIn.fechaIso || payload.fechaIso || new Date().toISOString().slice(0, 10)),
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
      const updatedMov: AnyObj = {
        ...existing,
        cId: targetCid,
        f: String(movIn.f || existing.f || new Date().toLocaleDateString("es-AR")),
        fi: String(movIn.fi || existing.fi || new Date().toISOString().slice(0, 10)),
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
      const savedOrder = {
        id: `web_${Date.now()}_${nextNum}`,
        numero: `WEB-${String(nextNum).padStart(5, "0")}`,
        createdAt: new Date().toISOString(),
        estado: "PENDIENTE",
        ...orderIn,
      };
      db.pedidosWeb.unshift(savedOrder);
      return commit("create_web_order", { order: savedOrder, pedido: savedOrder });
    }

    if (postAction === "mark_web_order_dispatched") {
      const orderId = String(payload.id || payload.orderId || "");
      const found = db.pedidosWeb.find((o: AnyObj) => String(o.id) === orderId);
      if (found) {
        found.estado = String(payload.estado || "DESPACHADO");
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
      });
    }

    if (postAction === "save_google_oauth_config") {
      db.googleOAuthConfig = {
        enabled: Boolean(payload.enabled ?? true),
        clientId: String(payload.clientId || ""),
      };
      return commit("save_google_oauth_config", {
        googleOAuthConfig: db.googleOAuthConfig,
      });
    }

    if (postAction === "add_fidelizacion_points") {
      const cId = Number(payload.clienteId || payload.cId || 0);
      const cli = db.clientes.find((c: AnyObj) => Number(c.id) === cId);
      if (!cli) {
        return NextResponse.json(
          { ok: false, message: "Cliente no encontrado" },
          { status: 404 }
        );
      }
      const pts = Math.max(1, Math.round(Number(payload.puntos || 0)));
      const maxFid = db.movimientosFidelizacion.reduce(
        (m: number, x: AnyObj) => Math.max(m, Number(x.id || 0)),
        0
      );
      const mov = {
        id: maxFid + 1,
        clienteId: cId,
        clienteNombre: cli.nombre,
        tipo: "SUMA",
        puntos: pts,
        importeCompra: round2(payload.importe || 0),
        comprobante: String(payload.comprobante || "MANUAL"),
        fecha: new Date().toLocaleDateString("es-AR"),
        createdAt: new Date().toISOString(),
        usuario: actor,
      };
      db.movimientosFidelizacion.unshift(mov);
      cli.puntosFidelizacion = Number(cli.puntosFidelizacion || 0) + pts;
      return commit("add_fidelizacion_points", { movimiento: mov, client: cli });
    }

    if (
      postAction === "redeem_fidelizacion_product" ||
      postAction === "redeem_fidelizacion_cart" ||
      postAction === "deliver_fidelizacion_canje"
    ) {
      const cId = Number(payload.clienteId || payload.cId || 0);
      const cli = db.clientes.find((c: AnyObj) => Number(c.id) === cId);
      if (postAction === "deliver_fidelizacion_canje") {
        const movId = Number(payload.id || payload.canjeId || 0);
        const target = db.movimientosFidelizacion.find((x: AnyObj) => Number(x.id) === movId);
        if (target) {
          target.estadoEntrega = "ENTREGADO";
          target.entregadoAt = new Date().toISOString();
        }
        return commit("deliver_fidelizacion_canje", { canje: target });
      }
      if (!cli) {
        return NextResponse.json(
          { ok: false, message: "Cliente no encontrado" },
          { status: 404 }
        );
      }
      const pts = Math.max(1, Math.round(Number(payload.puntos || payload.totalPuntos || 0)));
      const maxFid = db.movimientosFidelizacion.reduce(
        (m: number, x: AnyObj) => Math.max(m, Number(x.id || 0)),
        0
      );
      const canje = {
        id: maxFid + 1,
        clienteId: cId,
        clienteNombre: cli.nombre,
        tipo: "CANJE",
        puntos: -pts,
        detalle: String(payload.detalle || payload.productoNombre || "Canje Club"),
        estadoEntrega: payload.entregado ? "ENTREGADO" : "PENDIENTE",
        fecha: new Date().toLocaleDateString("es-AR"),
        createdAt: new Date().toISOString(),
        usuario: actor,
      };
      db.movimientosFidelizacion.unshift(canje);
      cli.puntosFidelizacion = Math.max(0, Number(cli.puntosFidelizacion || 0) - pts);
      return commit(postAction, { canje, client: cli });
    }

    if (postAction === "get_client_portal_data") {
      const cId = Number(payload.clienteId || payload.id || 0);
      const cli = db.clientes.find((c: AnyObj) => Number(c.id) === cId);
      if (!cli) {
        return NextResponse.json(
          { ok: false, message: "Cliente no encontrado" },
          { status: 404 }
        );
      }
      const movsCta = db.movimientosCtaCte.filter((m: AnyObj) => Number(m.cId) === cId);
      const movsFid = db.movimientosFidelizacion.filter(
        (m: AnyObj) => Number(m.clienteId) === cId
      );
      const pedidos = db.pedidosWeb.filter((p: AnyObj) => Number(p.clienteId) === cId);
      return NextResponse.json({
        ok: true,
        client: cli,
        movimientosCtaCte: movsCta,
        movimientosFidelizacion: movsFid,
        pedidosWeb: pedidos,
      });
    }

    if (
      postAction === "peek_soy_cajero_next_code" ||
      postAction === "create_soy_cajero_ticket" ||
      postAction === "list_soy_cajero_tickets" ||
      postAction === "get_soy_cajero_ticket" ||
      postAction === "claim_soy_cajero_ticket" ||
      postAction === "cancel_soy_cajero_ticket"
    ) {
      if (postAction === "peek_soy_cajero_next_code") {
        const next = db.soyCajeroTickets.length + 1;
        return NextResponse.json({
          ok: true,
          nextCode: `SC-${String(next).padStart(4, "0")}`,
        });
      }
      if (postAction === "list_soy_cajero_tickets") {
        return NextResponse.json({ ok: true, tickets: db.soyCajeroTickets });
      }
      if (postAction === "create_soy_cajero_ticket") {
        const next = db.soyCajeroTickets.length + 1;
        const code = `SC-${String(next).padStart(4, "0")}`;
        const ticket = {
          id: `sc_${Date.now()}_${next}`,
          code,
          codigo: code,
          estado: "PENDIENTE",
          createdAt: new Date().toISOString(),
          ...(payload.ticket || payload),
        };
        db.soyCajeroTickets.unshift(ticket);
        return commit("create_soy_cajero_ticket", { ticket });
      }
      const rawCode = String(payload.code || payload.codigo || payload.id || "")
        .trim()
        .toUpperCase();
      const found = db.soyCajeroTickets.find(
        (t: AnyObj) =>
          String(t.code || "").toUpperCase() === rawCode ||
          String(t.id || "").toUpperCase() === rawCode
      );
      if (!found) {
        return NextResponse.json(
          { ok: false, message: "Ticket no encontrado." },
          { status: 404 }
        );
      }
      if (postAction === "claim_soy_cajero_ticket") found.estado = "FACTURADO";
      if (postAction === "cancel_soy_cajero_ticket") found.estado = "ANULADO";
      if (postAction === "get_soy_cajero_ticket") {
        return NextResponse.json({ ok: true, ticket: found });
      }
      return commit(postAction, { ticket: found });
    }

    return commit(postAction || "clientes_noop", {});
  }

  return NextResponse.json(
    { ok: false, message: "Método no permitido" },
    { status: 405 }
  );
}
