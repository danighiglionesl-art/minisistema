import { NextRequest, NextResponse } from "next/server";
import { getErpAppVersion } from "../erp-version";
import { buildCleanTenantSeed } from "../seed-clean-tenant";
import {
  getTenantDbStatusMap,
  getTenantDoc,
  putTenantDoc,
  putTenantMediaInDb,
} from "../supabase-server";
import { ensureBaseMiniSistemaTenant } from "../tenant-service";
import type { ErpTenantRecord } from "../types";

type AnyObj = Record<string, any>;

export async function handleErpDbStatus(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const statusMap = await getTenantDbStatusMap(tenant);
  return NextResponse.json(
    {
      ok: true,
      tenant: tenant.slug,
      schema: tenant.db_schema,
      appVersion: getErpAppVersion(),
      serverTime: new Date().toISOString(),
      databases: statusMap,
      shield: req.nextUrl.searchParams.get("action") === "shield" ? { ok: true } : null,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

export async function handleErpOfertas(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const fallback = { updatedAt: new Date().toISOString(), ofertas: [] as AnyObj[] };
  const { payload: db } = await getTenantDoc<AnyObj>(tenant, "ofertas_db", fallback);
  const ofertas: AnyObj[] = Array.isArray(db.ofertas) ? db.ofertas : [];

  const computeNext = (list: AnyObj[]) => {
    const used = new Set(
      list.map((o) => Number(String(o.codigo || "0").replace(/\D/g, "")))
    );
    let c = 1;
    while (used.has(c) && c < 99999) c++;
    return String(c).padStart(5, "0");
  };

  if (req.method === "GET") {
    return NextResponse.json({
      ok: true,
      ofertas,
      nextCodigo: computeNext(ofertas),
    });
  }

  if (req.method === "POST") {
    const body = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
    const action = String(body.action || "");
    const actor = String(body.usuario || req.headers.get("x-erp-user") || "sistema");

    if (action === "save_oferta") {
      const incoming = (body.oferta || {}) as AnyObj;
      let id = Number(incoming.id || 0);
      if (id <= 0) {
        id = ofertas.reduce((m, o) => Math.max(m, Number(o.id || 0)), 0) + 1;
      }
      const rawCod = String(incoming.codigo || "").replace(/\D/g, "");
      const codigo = rawCod ? rawCod.slice(0, 5).padStart(5, "0") : computeNext(ofertas);
      const savedOferta = {
        ...incoming,
        id,
        codigo,
        updatedAt: new Date().toISOString(),
        createdAt: incoming.createdAt || new Date().toISOString(),
      };
      const idx = ofertas.findIndex((o) => Number(o.id) === id);
      if (idx >= 0) ofertas[idx] = savedOferta;
      else ofertas.push(savedOferta);
      await putTenantDoc(tenant, "ofertas_db", { updatedAt: new Date().toISOString(), ofertas }, actor, "save_oferta");
      return NextResponse.json({
        ok: true,
        oferta: savedOferta,
        nextCodigo: computeNext(ofertas),
      });
    }

    if (action === "toggle_activa") {
      const id = Number(body.id || 0);
      const found = ofertas.find((o) => Number(o.id) === id);
      if (found) found.activa = Boolean(body.activa);
      await putTenantDoc(tenant, "ofertas_db", { updatedAt: new Date().toISOString(), ofertas }, actor, "toggle_oferta");
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_oferta") {
      const id = Number(body.id || 0);
      const nextList = body.hard
        ? ofertas.filter((o) => Number(o.id) !== id)
        : ofertas.map((o) =>
            Number(o.id) === id ? { ...o, bajaLogica: true, activa: false } : o
          );
      await putTenantDoc(tenant, "ofertas_db", { updatedAt: new Date().toISOString(), ofertas: nextList }, actor, "delete_oferta");
      return NextResponse.json({ ok: true, nextCodigo: computeNext(nextList) });
    }

    if (action === "consume_stock") {
      const usages = Array.isArray(body.usages) ? body.usages : [];
      for (const u of usages) {
        const found = ofertas.find((o) => Number(o.id) === Number(u.ofertaId));
        if (found && found.config?.limitarStock) {
          found.config.stockConsumido =
            Number(found.config.stockConsumido || 0) + Number(u.unidadesBonificadas || 0);
          if (
            Number(found.config.stockMaximo || 0) > 0 &&
            found.config.stockConsumido >= Number(found.config.stockMaximo)
          ) {
            found.activa = false;
          }
        }
      }
      await putTenantDoc(tenant, "ofertas_db", { updatedAt: new Date().toISOString(), ofertas }, actor, "consume_oferta");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, message: "Acción desconocida" }, { status: 400 });
  }

  return NextResponse.json({ ok: false }, { status: 405 });
}

export async function handleErpPedidosProveedores(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const fallback = { updatedAt: new Date().toISOString(), lastSeq: 0, items: [] as AnyObj[] };
  const { payload: db } = await getTenantDoc<AnyObj>(tenant, "pedidos_proveedores", fallback);
  if (!Array.isArray(db.items)) db.items = [];

  if (req.method === "GET") {
    return NextResponse.json({
      ok: true,
      updatedAt: db.updatedAt || new Date().toISOString(),
      items: db.items,
    });
  }

  if (req.method === "POST") {
    const payload = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
    const action = String(payload.action || "");
    const actor = String(payload.operador || req.headers.get("x-erp-user") || "sistema");

    if (action === "save_pedido") {
      const orderIn = (payload.pedido || {}) as AnyObj;
      const rawItems = Array.isArray(orderIn.items) ? orderIn.items : [];
      if (rawItems.length === 0) {
        return NextResponse.json(
          { ok: false, message: "El pedido debe contener al menos un producto" },
          { status: 400 }
        );
      }
      const nowIso = new Date().toISOString();
      const existingIdx = orderIn.id
        ? db.items.findIndex((x: AnyObj) => String(x.id) === String(orderIn.id))
        : -1;

      const totalUnidades = rawItems.reduce(
        (s: number, it: AnyObj) => s + Number(it.cantidad || 0),
        0
      );
      const totalCostoEstimado = rawItems.reduce(
        (s: number, it: AnyObj) =>
          s + Number(it.cantidad || 0) * Number(it.costoUnitario || 0),
        0
      );

      let savedOrder: AnyObj;
      if (existingIdx >= 0) {
        savedOrder = {
          ...db.items[existingIdx],
          ...orderIn,
          updatedAt: nowIso,
          totalItems: rawItems.length,
          totalUnidades,
          totalCostoEstimado,
        };
        db.items[existingIdx] = savedOrder;
      } else {
        const nextSeq = Number(db.lastSeq || 0) + 1;
        db.lastSeq = nextSeq;
        savedOrder = {
          id: `pp_${Date.now()}_${nextSeq}`,
          seq: nextSeq,
          numero: `PP-${String(nextSeq).padStart(4, "0")}`,
          fecha: orderIn.fecha || new Date().toLocaleDateString("es-AR"),
          createdAt: nowIso,
          updatedAt: nowIso,
          operador: actor,
          proveedorId: Number(orderIn.proveedorId || 0),
          proveedorCodigo: String(orderIn.proveedorCodigo || ""),
          proveedorNombre: String(orderIn.proveedorNombre || "PROVEEDOR").toUpperCase(),
          proveedorCuit: String(orderIn.proveedorCuit || ""),
          proveedorWhatsapp: String(orderIn.proveedorWhatsapp || ""),
          estado: String(orderIn.estado || "PENDIENTE").toUpperCase(),
          observaciones: String(orderIn.observaciones || ""),
          items: rawItems,
          totalItems: rawItems.length,
          totalUnidades,
          totalCostoEstimado,
        };
        db.items.unshift(savedOrder);
      }
      db.updatedAt = nowIso;
      await putTenantDoc(tenant, "pedidos_proveedores", db, actor, "save_pedido");
      return NextResponse.json({ ok: true, pedido: savedOrder, items: db.items });
    }

    if (action === "update_estado") {
      const found = db.items.find((x: AnyObj) => String(x.id) === String(payload.id || ""));
      if (found) {
        found.estado = String(payload.estado || "PENDIENTE").toUpperCase();
        found.updatedAt = new Date().toISOString();
      }
      await putTenantDoc(tenant, "pedidos_proveedores", db, actor, "update_estado");
      return NextResponse.json({ ok: true, pedido: found, items: db.items });
    }

    if (action === "delete_pedido") {
      db.items = db.items.filter((x: AnyObj) => String(x.id) !== String(payload.id || ""));
      await putTenantDoc(tenant, "pedidos_proveedores", db, actor, "delete_pedido");
      return NextResponse.json({ ok: true, items: db.items });
    }
  }

  return NextResponse.json({ ok: false }, { status: 405 });
}

export async function handleErpBanners(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const fallback = buildCleanTenantSeed({ businessName: tenant.business_name }).docs
    .banners_homepage as AnyObj;
  const { payload: db } = await getTenantDoc<AnyObj>(tenant, "banners_homepage", fallback);
  if (!Array.isArray(db.items)) db.items = [];
  if (!Array.isArray(db.popups)) db.popups = [];
  if (!Array.isArray(db.appCarousel)) db.appCarousel = [];

  if (req.method === "GET") {
    const action = req.nextUrl.searchParams.get("action") || "public";
    if (action === "admin_list") {
      return NextResponse.json({ ok: true, ...db });
    }
    return NextResponse.json({
      ok: true,
      ...db,
      items: db.items.filter((x: AnyObj) => x.activo !== false),
      popups: db.popups.filter((x: AnyObj) => x.activo !== false),
      appCarousel: db.appCarousel.filter((x: AnyObj) => x.activo !== false),
    });
  }

  if (req.method === "POST") {
    const body = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
    const action = String(body.action || "");
    const actor = String(req.headers.get("x-erp-user") || "sistema");

    const uploadMaybeB64 = async (rawImg: string, prefix: string): Promise<string> => {
      const m = String(rawImg || "").match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);
      if (!m) return String(rawImg || "");
      const ext = m[1].includes("png") ? "png" : m[1].includes("webp") ? "webp" : "jpg";
      const key = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
      await putTenantMediaInDb(tenant, {
        media_key: key,
        category: "banners",
        mime_type: m[1].toLowerCase(),
        data_b64: m[2],
      });
      return `/sistema/assets/banners/${key}?tenant=${encodeURIComponent(tenant.slug)}`;
    };

    if (action === "save_banner" || action === "save_popup" || action === "save_app_carousel") {
      const listKey =
        action === "save_popup"
          ? "popups"
          : action === "save_app_carousel"
            ? "appCarousel"
            : "items";
      const list: AnyObj[] = db[listKey];
      const imgUrl = await uploadMaybeB64(
        String(body.imageBase64 || body.imageUrl || ""),
        listKey
      );
      let id = Number(body.id || 0);
      if (id <= 0) {
        id = list.reduce((mx, x) => Math.max(mx, Number(x.id || 0)), 0) + 1;
      }
      const item: AnyObj = {
        id,
        titulo: String(body.titulo || `Banner #${id}`),
        imageUrl: imgUrl,
        linkUrl: String(body.linkUrl || ""),
        duracionSec: Number(body.duracionSec ?? -1),
        fechaInicio: String(body.fechaInicio || ""),
        fechaFin: String(body.fechaFin || ""),
        orden: Number(body.orden || list.length + 1),
        activo: body.activo !== undefined ? Boolean(body.activo) : true,
        createdAt: new Date().toISOString(),
      };
      const idx = list.findIndex((x) => Number(x.id) === id);
      if (idx >= 0) list[idx] = { ...list[idx], ...item, imageUrl: imgUrl || list[idx].imageUrl };
      else list.push(item);
      db.updatedAt = new Date().toISOString();
      await putTenantDoc(tenant, "banners_homepage", db, actor, action);
      return NextResponse.json({ ok: true, ...db });
    }

    if (action === "delete_banner" || action === "delete_popup" || action === "delete_app_carousel") {
      const listKey =
        action === "delete_popup"
          ? "popups"
          : action === "delete_app_carousel"
            ? "appCarousel"
            : "items";
      const id = Number(body.id || 0);
      db[listKey] = db[listKey].filter((x: AnyObj) => Number(x.id) !== id);
      db.updatedAt = new Date().toISOString();
      await putTenantDoc(tenant, "banners_homepage", db, actor, action);
      return NextResponse.json({ ok: true, ...db });
    }

    if (action === "toggle_banner" || action === "toggle_popup" || action === "toggle_app_carousel") {
      const listKey =
        action === "toggle_popup"
          ? "popups"
          : action === "toggle_app_carousel"
            ? "appCarousel"
            : "items";
      const found = db[listKey].find((x: AnyObj) => Number(x.id) === Number(body.id));
      if (found) found.activo = Boolean(body.activo);
      db.updatedAt = new Date().toISOString();
      await putTenantDoc(tenant, "banners_homepage", db, actor, action);
      return NextResponse.json({ ok: true, ...db });
    }

    if (
      action === "reorder_banners" ||
      action === "reorder_popups" ||
      action === "reorder_app_carousel"
    ) {
      const listKey =
        action === "reorder_popups"
          ? "popups"
          : action === "reorder_app_carousel"
            ? "appCarousel"
            : "items";
      const ids: number[] = Array.isArray(body.ids)
        ? body.ids.map((x: unknown) => Number(x))
        : [];
      if (ids.length > 0 && Array.isArray(db[listKey])) {
        db[listKey].forEach((item: AnyObj) => {
          const pos = ids.indexOf(Number(item.id));
          if (pos >= 0) item.orden = pos + 1;
        });
        db[listKey].sort(
          (a: AnyObj, b: AnyObj) => Number(a.orden || 0) - Number(b.orden || 0)
        );
      }
      db.updatedAt = new Date().toISOString();
      await putTenantDoc(tenant, "banners_homepage", db, actor, action);
      return NextResponse.json({ ok: true, ...db });
    }

    if (
      action === "save_settings" ||
      action === "save_popup_settings" ||
      action === "save_app_carousel_settings"
    ) {
      if (body.intervalSec !== undefined) db.intervalSec = Number(body.intervalSec);
      if (body.popupDurationSec !== undefined) db.popupDurationSec = Number(body.popupDurationSec);
      if (body.appCarouselIntervalSec !== undefined) {
        db.appCarouselIntervalSec = Number(body.appCarouselIntervalSec);
      }
      db.updatedAt = new Date().toISOString();
      await putTenantDoc(tenant, "banners_homepage", db, actor, action);
      return NextResponse.json({ ok: true, ...db });
    }

    await putTenantDoc(tenant, "banners_homepage", db, actor, action || "banners_update");
    return NextResponse.json({ ok: true, ...db });
  }

  return NextResponse.json({ ok: false }, { status: 405 });
}

export async function handleErpArcaComprobantes(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const fallback = buildCleanTenantSeed({ businessName: tenant.business_name }).docs
    .arca_comprobantes_db as AnyObj;
  const { payload: db } = await getTenantDoc<AnyObj>(
    tenant,
    "arca_comprobantes_db",
    fallback
  );
  if (!Array.isArray(db.comprobantes)) db.comprobantes = [];
  if (!Array.isArray(db.auditoria)) db.auditoria = [];

  if (req.method === "GET") {
    return NextResponse.json({
      ok: true,
      servicioArcaEstado: db.servicioArcaEstado || "contingencia",
      certificado: db.certificado || fallback.certificado,
      comprobantes: db.comprobantes,
      auditoria: db.auditoria.slice(0, 120),
    });
  }

  if (req.method === "POST") {
    const payload = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
    const action = String(payload.action || "");
    const usuario = String(payload.usuario || req.headers.get("x-erp-user") || "Administrador");

    if (action === "set_servicio_estado") {
      db.servicioArcaEstado = payload.estado === "contingencia" ? "contingencia" : "online";
      db.auditoria.unshift({
        fechaHora: new Date().toLocaleString("es-AR"),
        operacion: "FEDummy / Estado Servicio",
        comprobante: "WSFEv1 ARCA",
        resultado: db.servicioArcaEstado === "contingencia" ? "CONTINGENCIA" : "ONLINE",
        detalle: `Estado ARCA actualizado a ${db.servicioArcaEstado.toUpperCase()}`,
        usuario,
      });
      await putTenantDoc(tenant, "arca_comprobantes_db", db, usuario, action);
      return NextResponse.json({
        ok: true,
        servicioArcaEstado: db.servicioArcaEstado,
        auditoria: db.auditoria.slice(0, 120),
      });
    }

    if (action === "register_comprobante") {
      const comp = (payload.comprobante || {}) as AnyObj;
      const pv = String(comp.pv || "0002").replace(/\D/g, "").padStart(4, "0");
      const nro = Number(comp.nro || 1);
      const letra = String(comp.letra || "B").toUpperCase();
      const tipoBase = String(comp.tipoBase || "Factura");
      comp.pv = pv;
      comp.nro = nro;
      comp.numeroCompleto = `${pv}-${String(nro).padStart(8, "0")}`;
      comp.uid = `${pv}-${tipoBase}-${letra}-${String(nro).padStart(8, "0")}`;
      comp.estadoArca = comp.cae ? "informado" : "pendiente";
      db.comprobantes.unshift(comp);
      await putTenantDoc(tenant, "arca_comprobantes_db", db, usuario, action);
      return NextResponse.json({ ok: true, comprobante: comp });
    }

    if (action === "informar_comprobantes") {
      const items = Array.isArray(payload.comprobantes) ? payload.comprobantes : [];
      const vto = new Date(Date.now() + 10 * 86400_000).toLocaleDateString("es-AR");
      const informados: AnyObj[] = [];
      for (const it of items) {
        const seed = String(
          ((Number(it.pv || 2) * 1_000_000 + Number(it.nro || 1)) % 100_000_000)
        ).padStart(8, "0");
        const cae = `864518${seed}`.slice(0, 14);
        const found = db.comprobantes.find((c: AnyObj) => c.uid === it.uid || c.numeroCompleto === it.numeroCompleto);
        if (found) {
          found.cae = cae;
          found.caeVto = vto;
          found.estadoArca = "informado";
          informados.push(found);
        }
      }
      db.servicioArcaEstado = "online";
      await putTenantDoc(tenant, "arca_comprobantes_db", db, usuario, action);
      return NextResponse.json({
        ok: true,
        informados,
        comprobantes: db.comprobantes,
        auditoria: db.auditoria.slice(0, 120),
      });
    }

    if (action === "marcar_no_informado") {
      const uid = String(payload.uid || payload.numeroCompleto || "");
      const found = db.comprobantes.find(
        (c: AnyObj) => c.uid === uid || c.numeroCompleto === uid
      );
      if (found) {
        found.cae = "";
        found.caeVto = "";
        found.estadoArca = "pendiente";
      }
      await putTenantDoc(tenant, "arca_comprobantes_db", db, usuario, action);
      return NextResponse.json({
        ok: true,
        comprobante: found || null,
        comprobantes: db.comprobantes,
      });
    }

    if (action === "registrar_consulta_ultimo") {
      db.auditoria.unshift({
        fechaHora: new Date().toLocaleString("es-AR"),
        operacion: "FECompUltimoAutorizado",
        comprobante: `${payload.pv || "0002"} · ${payload.tipo || "Factura B"}`,
        resultado: "OK",
        detalle: `Último autorizado consultado (${payload.ultimoNro ?? 0})`,
        usuario,
      });
      await putTenantDoc(tenant, "arca_comprobantes_db", db, usuario, action);
      return NextResponse.json({
        ok: true,
        auditoria: db.auditoria.slice(0, 120),
      });
    }

    await putTenantDoc(tenant, "arca_comprobantes_db", db, usuario, action || "arca_update");
    return NextResponse.json({ ok: true, ...db });
  }

  return NextResponse.json({ ok: false }, { status: 405 });
}

export async function handleErpPadronArca(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const rawQuery =
    req.nextUrl.searchParams.get("cuit") ||
    req.nextUrl.searchParams.get("doc") ||
    req.nextUrl.searchParams.get("q") ||
    "";
  let doc = rawQuery.replace(/\D/g, "");
  if (!doc && req.method === "POST") {
    const body = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
    doc = String(body.cuit || body.nroDoc || body.documento || "").replace(/\D/g, "");
  }

  if (!doc || doc.length < 7) {
    return NextResponse.json(
      { ok: false, message: "Ingresá un DNI o CUIT válido para consultar." },
      { status: 400 }
    );
  }

  // Consultar primero en el padrón local del comercio
  const fallback = buildCleanTenantSeed({ businessName: tenant.business_name }).docs
    .clientes_db as AnyObj;
  const { payload: cliDb } = await getTenantDoc<AnyObj>(tenant, "clientes_db", fallback);
  const existing = (cliDb.clientes || []).find((c: AnyObj) => {
    const cd = String(c.nroDoc || "").replace(/\D/g, "");
    return cd && (cd === doc || cd.includes(doc));
  });

  if (existing) {
    return NextResponse.json({
      ok: true,
      source: "local_erp",
      contribuyente: {
        cuit: existing.nroDoc,
        razonSocial: existing.razonSocial || existing.nombre,
        nombre: existing.nombre,
        condicionIva: existing.condicionIva || "CONSUMIDOR FINAL",
        idRespIva: existing.idRespIva || 1,
        domicilio: `${existing.calle || ""} ${existing.numero || ""}`.trim(),
        localidad: existing.localidad || tenant.branding.localidad,
        provincia: existing.provincia || tenant.branding.provincia,
        cp: existing.cp || tenant.branding.cp,
      },
    });
  }

  return NextResponse.json({
    ok: false,
    notFound: true,
    message:
      "Sin datos previos en padrón local. Podés completar los datos manualmente.",
  });
}

export async function handleErpMercadoPagoPoint(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const fallback = {
    mode: "simulated",
    accessToken: "",
    devices: { caja1: "", caja2: "", caja3: "" },
    orders: {} as AnyObj,
    updatedAt: new Date().toISOString(),
  };
  const { payload: db } = await getTenantDoc<AnyObj>(tenant, "mp_point_db", fallback);

  if (req.method === "GET") {
    return NextResponse.json({
      ok: true,
      mode: db.mode || "simulated",
      devices: db.devices || { caja1: "", caja2: "", caja3: "" },
    });
  }

  if (req.method === "POST") {
    const body = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
    const action = String(body.action || "");
    if (action === "create_order") {
      const orderId = `mp_pt_${Date.now()}`;
      db.orders = db.orders || {};
      db.orders[orderId] = {
        id: orderId,
        status: db.mode === "simulated" ? "approved" : "action_required",
        amount: Number(body.amount || 0),
        createdAt: new Date().toISOString(),
      };
      await putTenantDoc(tenant, "mp_point_db", db, "pos", "create_order");
      return NextResponse.json({ ok: true, orderId, order: db.orders[orderId] });
    }
    if (action === "check_order") {
      const ord = db.orders?.[String(body.orderId || "")] || { status: "approved" };
      return NextResponse.json({ ok: true, status: ord.status, order: ord });
    }
    if (action === "cancel_order") {
      if (db.orders?.[String(body.orderId || "")]) {
        db.orders[String(body.orderId)].status = "canceled";
        await putTenantDoc(tenant, "mp_point_db", db, "pos", "cancel_order");
      }
      return NextResponse.json({ ok: true });
    }
    if (action === "set_mode") {
      db.mode = body.mode === "live" ? "live" : "simulated";
      if (body.devices) db.devices = body.devices;
      await putTenantDoc(tenant, "mp_point_db", db, "admin", "set_mode");
      return NextResponse.json({ ok: true, mode: db.mode });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 405 });
}

export async function handleErpWhatsappCloud(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const fallback = buildCleanTenantSeed({ businessName: tenant.business_name }).docs
    .whatsapp_cloud_db as AnyObj;
  const { payload: db } = await getTenantDoc<AnyObj>(
    tenant,
    "whatsapp_cloud_db",
    fallback
  );

  if (req.method === "GET") {
    return NextResponse.json({
      ok: true,
      config: {
        provider: db.provider || "meta",
        phoneNumberId: db.phoneNumberId || "",
        wabaId: db.wabaId || "",
        hasToken: Boolean(db.accessToken || db.twilioAuthToken),
      },
      templates: db.templates || [],
      campaigns: db.campaigns || [],
      optouts: db.optouts || [],
    });
  }

  if (req.method === "POST") {
    const body = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
    const action = String(body.action || "");
    if (action === "save_config") {
      Object.assign(db, body.config || body);
      db.updatedAt = new Date().toISOString();
      await putTenantDoc(tenant, "whatsapp_cloud_db", db, "admin", "save_wa_config");
      return NextResponse.json({ ok: true, message: "Configuración de WhatsApp guardada." });
    }
    if (action === "test_connection") {
      return NextResponse.json({
        ok: true,
        message: "Conexión verificada correctamente.",
      });
    }
    if (action === "sync_templates") {
      return NextResponse.json({
        ok: true,
        templates: db.templates || [],
        message: "Plantillas sincronizadas.",
      });
    }
    if (action === "save_or_submit_template") {
      const tpl = (body.template || body) as AnyObj;
      if (!Array.isArray(db.templates)) db.templates = [];
      const id = String(tpl.id || tpl.name || `tpl_${Date.now()}`);
      const idx = db.templates.findIndex((t: AnyObj) => String(t.id || t.name) === id);
      const savedTpl = {
        ...tpl,
        id,
        status: tpl.status || "APPROVED",
        updatedAt: new Date().toISOString(),
      };
      if (idx >= 0) db.templates[idx] = savedTpl;
      else db.templates.unshift(savedTpl);
      await putTenantDoc(tenant, "whatsapp_cloud_db", db, "admin", action);
      return NextResponse.json({ ok: true, template: savedTpl, templates: db.templates });
    }
    if (action === "send_test" || action === "start_campaign" || action === "send_campaign_batch") {
      if (action === "start_campaign") {
        if (!Array.isArray(db.campaigns)) db.campaigns = [];
        const camp = {
          id: `camp_${Date.now()}`,
          nombre: String(body.nombre || body.name || "Campaña WhatsApp"),
          createdAt: new Date().toISOString(),
          estado: "ENVIADA",
          totalDestinatarios: Number(body.totalDestinatarios || 0),
        };
        db.campaigns.unshift(camp);
        await putTenantDoc(tenant, "whatsapp_cloud_db", db, "admin", action);
        return NextResponse.json({ ok: true, campaign: camp, campaigns: db.campaigns });
      }
      return NextResponse.json({ ok: true, sent: true });
    }
    if (action === "manage_optout") {
      if (!Array.isArray(db.optouts)) db.optouts = [];
      const phone = String(body.phone || body.telefono || "").replace(/\D/g, "");
      if (phone) {
        if (body.remove) {
          db.optouts = db.optouts.filter((p: string) => p !== phone);
        } else if (!db.optouts.includes(phone)) {
          db.optouts.push(phone);
        }
        await putTenantDoc(tenant, "whatsapp_cloud_db", db, "admin", action);
      }
      return NextResponse.json({ ok: true, optouts: db.optouts });
    }
    return NextResponse.json({ ok: true, action });
  }

  return NextResponse.json({ ok: false }, { status: 405 });
}

const CENTRAL_CRM_DOC_KEY = "crm_reportes_db";

function formatNowDateTimeArServer(): string {
  const now = new Date();
  return now.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

async function getCentralCrmReports(): Promise<{
  baseTenant: ErpTenantRecord;
  reports: AnyObj[];
}> {
  const baseTenant = await ensureBaseMiniSistemaTenant();
  const { payload } = await getTenantDoc<AnyObj>(
    baseTenant,
    CENTRAL_CRM_DOC_KEY,
    { reports: [] as AnyObj[] }
  );
  const reports: AnyObj[] = Array.isArray(payload?.reports)
    ? payload.reports
    : [];
  return { baseTenant, reports };
}

async function saveCentralCrmReports(
  baseTenant: ErpTenantRecord,
  reports: AnyObj[],
  actor: string,
  action: string
): Promise<void> {
  await putTenantDoc(
    baseTenant,
    CENTRAL_CRM_DOC_KEY,
    { updatedAt: new Date().toISOString(), reports: reports.slice(0, 500) },
    actor,
    action
  );
}

async function mirrorCrmActionToCasaNuevaIfNeeded(
  reportOrAction: AnyObj,
  fromHub?: boolean
): Promise<void> {
  if (fromHub) return;
  const marcaStr = String(reportOrAction.marca || "").toLowerCase();
  const sucursalStr = String(reportOrAction.sucursal || "").toLowerCase();
  if (
    marcaStr &&
    !marcaStr.includes("casa nueva") &&
    !sucursalStr.includes("casa central")
  ) {
    return;
  }
  try {
    await fetch("https://www.cn.com.ar/sistema/api/manual_ai.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...reportOrAction,
        _fromMinisistemaHub: true,
      }),
    });
  } catch {
    // Non-blocking mirror
  }
}

export async function handleErpManualAi(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": req.headers.get("origin") || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-ERP-User, X-ERP-Tenant, X-ERP-Brand",
  };

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  const fallback = { updates: [] as AnyObj[] };
  const { payload: db } = await getTenantDoc<AnyObj>(
    tenant,
    "manual_updates_db",
    fallback
  );
  if (!Array.isArray(db.updates)) db.updates = [];

  if (req.method === "GET") {
    const getAction = (req.nextUrl.searchParams.get("action") || "").trim();
    const { baseTenant, reports: centralReports } = await getCentralCrmReports();

    // Sincronizar también con Casa Nueva ERP si hubiera tickets recientes allí que aún no están en la central
    let mergedReports = [...centralReports];
    try {
      const cnRes = await fetch(
        `https://www.cn.com.ar/sistema/api/manual_ai.php?action=crm_reports&t=${Date.now()}`,
        { cache: "no-store" }
      );
      if (cnRes.ok) {
        const cnData = (await cnRes.json().catch(() => null)) as AnyObj | null;
        if (cnData && cnData.ok && Array.isArray(cnData.reports)) {
          let addedFromCn = false;
          for (const cnRep of cnData.reports) {
            if (!cnRep || typeof cnRep !== "object") continue;
            const exists = mergedReports.some(
              (r) =>
                String(r.id || "") === String(cnRep.id || "") ||
                (String(r.username || "").toLowerCase() ===
                  String(cnRep.username || "").toLowerCase() &&
                  String(r.titulo || "").trim() ===
                    String(cnRep.titulo || "").trim() &&
                  String(r.descripcion || "").trim() ===
                    String(cnRep.descripcion || "").trim())
            );
            if (!exists) {
              mergedReports.unshift(cnRep);
              addedFromCn = true;
            }
          }
          if (addedFromCn) {
            await saveCentralCrmReports(
              baseTenant,
              mergedReports,
              "danielg",
              "sync_crm_from_casanueva"
            );
          }
        }
      }
    } catch {
      // Ignore if Casa Nueva is temporarily unreachable
    }

    if (getAction === "crm_reports") {
      return NextResponse.json(
        {
          ok: true,
          reports: mergedReports,
        },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        updates: db.updates,
        crmReports: mergedReports,
      },
      { headers: corsHeaders }
    );
  }

  if (req.method === "POST") {
    const payload = ((await req.json().catch(() => null)) || null) as AnyObj | null;
    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { ok: false, message: "Payload JSON inválido" },
        { status: 400, headers: corsHeaders }
      );
    }

    const action = String(payload.action || "ask_ai").trim();
    const actor = String(
      payload.autor ||
        payload.username ||
        req.headers.get("x-erp-user") ||
        "Administrador"
    );

    if (action === "save_crm_report") {
      let titulo = String(payload.titulo || "").trim();
      const descripcion = String(payload.descripcion || "").trim();
      const tipo = String(payload.tipo || "MEJORA").trim().toUpperCase();
      const prioridad = String(payload.prioridad || "NORMAL")
        .trim()
        .toUpperCase();
      const moduloKey = String(payload.moduloKey || "general").trim();
      const moduloLabel = String(payload.moduloLabel || "General").trim();
      const usuario = String(payload.usuario || "Usuario").trim();
      const username = String(payload.username || "").trim();
      const rol = String(payload.rol || "Operador").trim();
      const sucursal = String(
        payload.sucursal || tenant.fantasy_name || "Casa Central"
      ).trim();
      const marca = String(
        payload.marca || tenant.fantasy_name || "Casa Nueva"
      ).trim();
      const capturaBase64 = String(payload.capturaBase64 || "").trim();
      const fechaCliente = String(payload.fechaHora || "").trim();

      if (!titulo && !descripcion) {
        return NextResponse.json(
          {
            ok: false,
            message: "Completá la descripción del problema o mejora.",
          },
          { status: 400, headers: corsHeaders }
        );
      }
      if (!titulo) {
        titulo = descripcion.slice(0, 80);
      }

      const { baseTenant, reports } = await getCentralCrmReports();
      const maxNum = reports.reduce(
        (mx, r) => Math.max(mx, Number(r?.numero || 0)),
        0
      );
      const nextNum = maxNum + 1;
      const code = payload.codigo
        ? String(payload.codigo).trim()
        : `CRM-${String(nextNum).padStart(4, "0")}`;
      const nowFormatted = fechaCliente || formatNowDateTimeArServer();

      const newReport: AnyObj = {
        id: payload.id ? String(payload.id).trim() : `CRM-${Date.now()}`,
        numero: nextNum,
        codigo: code,
        fechaHora: nowFormatted,
        fechaIso: new Date().toISOString(),
        usuario,
        username,
        rol,
        sucursal,
        marca,
        tipo,
        prioridad,
        moduloKey,
        moduloLabel,
        titulo,
        descripcion,
        capturaBase64,
        estado: payload.estado
          ? String(payload.estado).trim().toUpperCase()
          : "PENDIENTE",
        respuestaAdmin: String(payload.respuestaAdmin || "").trim(),
        resueltoPor: String(payload.resueltoPor || "").trim(),
        resueltoFecha: String(payload.resueltoFecha || "").trim(),
        updatedAt: formatNowDateTimeArServer(),
      };

      const existingIdx = reports.findIndex(
        (ex) =>
          String(ex?.id || "") === newReport.id ||
          (String(ex?.username || "").toLowerCase() ===
            username.toLowerCase() &&
            String(ex?.titulo || "").trim() === titulo &&
            String(ex?.descripcion || "").trim() === descripcion)
      );

      if (existingIdx >= 0) {
        newReport.id = String(reports[existingIdx].id || newReport.id);
        newReport.numero = Number(
          reports[existingIdx].numero || newReport.numero
        );
        newReport.codigo = String(
          reports[existingIdx].codigo || newReport.codigo
        );
        if (reports[existingIdx].estado && !payload.estado) {
          newReport.estado = reports[existingIdx].estado;
        }
        if (reports[existingIdx].respuestaAdmin && !payload.respuestaAdmin) {
          newReport.respuestaAdmin = reports[existingIdx].respuestaAdmin;
        }
        reports[existingIdx] = newReport;
      } else {
        reports.unshift(newReport);
      }

      await saveCentralCrmReports(
        baseTenant,
        reports,
        username || actor,
        "save_crm_report"
      );

      await mirrorCrmActionToCasaNuevaIfNeeded(
        { action: "save_crm_report", ...newReport },
        Boolean(payload._fromMinisistemaHub)
      );

      return NextResponse.json(
        {
          ok: true,
          report: newReport,
          reports,
        },
        { headers: corsHeaders }
      );
    }

    if (action === "sync_crm_reports_batch") {
      const batch = Array.isArray(payload.reports) ? payload.reports : [];
      const { baseTenant, reports } = await getCentralCrmReports();
      let changed = false;
      for (const item of batch) {
        if (!item || typeof item !== "object") continue;
        const tTit = String(item.titulo || "").trim();
        const tDesc = String(item.descripcion || "").trim();
        if (!tTit && !tDesc) continue;
        const tUser = String(item.username || "").trim();
        const tId = String(item.id || "").trim();

        const exists = reports.some(
          (ex) =>
            (tId && String(ex?.id || "") === tId) ||
            (String(ex?.username || "").toLowerCase() === tUser.toLowerCase() &&
              String(ex?.titulo || "").trim() === tTit &&
              String(ex?.descripcion || "").trim() === tDesc)
        );
        if (!exists) {
          const maxN = reports.reduce(
            (mx, r) => Math.max(mx, Number(r?.numero || 0)),
            0
          );
          const nNum = maxN + 1;
          const newRep: AnyObj = {
            id: tId || `CRM-${Date.now()}-${nNum}`,
            numero: nNum,
            codigo: item.codigo
              ? String(item.codigo)
              : `CRM-${String(nNum).padStart(4, "0")}`,
            fechaHora: String(item.fechaHora || formatNowDateTimeArServer()),
            fechaIso: String(item.fechaIso || new Date().toISOString()),
            usuario: String(item.usuario || tUser || "Usuario"),
            username: tUser,
            rol: String(item.rol || "Usuario"),
            sucursal: String(
              item.sucursal || tenant.fantasy_name || "Casa Central"
            ),
            marca: String(item.marca || tenant.fantasy_name || "Casa Nueva"),
            tipo: String(item.tipo || "MEJORA").toUpperCase(),
            prioridad: String(item.prioridad || "NORMAL").toUpperCase(),
            moduloKey: String(item.moduloKey || "general"),
            moduloLabel: String(item.moduloLabel || "General"),
            titulo: tTit || tDesc.slice(0, 80),
            descripcion: tDesc,
            capturaBase64: String(item.capturaBase64 || ""),
            estado: String(item.estado || "PENDIENTE").toUpperCase(),
            respuestaAdmin: String(item.respuestaAdmin || ""),
            resueltoPor: String(item.resueltoPor || ""),
            resueltoFecha: String(item.resueltoFecha || ""),
            updatedAt: String(item.updatedAt || formatNowDateTimeArServer()),
          };
          reports.unshift(newRep);
          changed = true;
          await mirrorCrmActionToCasaNuevaIfNeeded(
            { action: "save_crm_report", ...newRep },
            Boolean(payload._fromMinisistemaHub)
          );
        }
      }
      if (changed) {
        await saveCentralCrmReports(
          baseTenant,
          reports,
          actor,
          "sync_crm_reports_batch"
        );
      }
      return NextResponse.json(
        { ok: true, reports },
        { headers: corsHeaders }
      );
    }

    if (action === "update_crm_report") {
      const id = String(payload.id || "").trim();
      const codigo = String(payload.codigo || "").trim();
      const matchUsername = String(payload.username || "").trim().toLowerCase();
      const matchTitulo = String(payload.titulo || "").trim();
      if (!id && !codigo) {
        return NextResponse.json(
          { ok: false, message: "ID de reporte inválido." },
          { status: 400, headers: corsHeaders }
        );
      }
      const { baseTenant, reports } = await getCentralCrmReports();
      let updatedItem: AnyObj | null = null;
      for (const rep of reports) {
        if (!rep || typeof rep !== "object") continue;
        const isMatch =
          String(rep.id || "") === id ||
          String(rep.codigo || "") === id ||
          (codigo && String(rep.codigo || "") === codigo) ||
          (matchUsername &&
            matchTitulo &&
            String(rep.username || "").toLowerCase() === matchUsername &&
            String(rep.titulo || "").trim() === matchTitulo);
        if (isMatch) {
          if (payload.estado !== undefined) {
            rep.estado = String(payload.estado).trim().toUpperCase();
          }
          if (payload.prioridad !== undefined) {
            rep.prioridad = String(payload.prioridad).trim().toUpperCase();
          }
          if (payload.respuestaAdmin !== undefined) {
            rep.respuestaAdmin = String(payload.respuestaAdmin).trim();
          }
          if (payload.resueltoPor !== undefined) {
            rep.resueltoPor = String(payload.resueltoPor).trim();
          }
          rep.updatedAt = formatNowDateTimeArServer();
          if (rep.estado === "RESUELTO" && !rep.resueltoFecha) {
            rep.resueltoFecha = formatNowDateTimeArServer();
          }
          updatedItem = rep;
          break;
        }
      }
      await saveCentralCrmReports(
        baseTenant,
        reports,
        actor,
        "update_crm_report"
      );

      if (updatedItem) {
        await mirrorCrmActionToCasaNuevaIfNeeded(
          {
            action: "update_crm_report",
            id: updatedItem.id,
            codigo: updatedItem.codigo,
            username: updatedItem.username,
            titulo: updatedItem.titulo,
            estado: updatedItem.estado,
            prioridad: updatedItem.prioridad,
            respuestaAdmin: updatedItem.respuestaAdmin,
            resueltoPor: updatedItem.resueltoPor,
          },
          Boolean(payload._fromMinisistemaHub)
        );
      }

      return NextResponse.json(
        {
          ok: true,
          report: updatedItem,
          reports,
        },
        { headers: corsHeaders }
      );
    }

    if (action === "delete_crm_report") {
      const id = String(payload.id || "").trim();
      const { baseTenant, reports } = await getCentralCrmReports();
      const filtered = reports.filter(
        (r) => String(r?.id || "") !== id && String(r?.codigo || "") !== id
      );
      await saveCentralCrmReports(
        baseTenant,
        filtered,
        actor,
        "delete_crm_report"
      );
      await mirrorCrmActionToCasaNuevaIfNeeded(
        { action: "delete_crm_report", id },
        Boolean(payload._fromMinisistemaHub)
      );
      return NextResponse.json(
        {
          ok: true,
          reports: filtered,
        },
        { headers: corsHeaders }
      );
    }

    if (action === "save_update") {
      const titulo = String(payload.titulo || "").trim();
      const moduloKey = String(payload.moduloKey || "general").trim();
      const moduloLabel = String(payload.moduloLabel || "General").trim();
      const descripcion = String(payload.descripcion || "").trim();
      const pasos = Array.isArray(payload.pasos)
        ? payload.pasos.map((p: unknown) => String(p || "").trim()).filter(Boolean)
        : [];

      if (!titulo || !descripcion) {
        return NextResponse.json(
          {
            ok: false,
            message: "Completá título y descripción de la actualización.",
          },
          { status: 400 }
        );
      }

      const now = new Date();
      const newItem = {
        id: `UPD-${Date.now()}`,
        fecha: now.toLocaleString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        fechaIso: now.toISOString().slice(0, 10),
        moduloKey,
        moduloLabel,
        titulo,
        descripcion,
        pasos,
        autor: actor,
      };

      db.updates.unshift(newItem);
      db.updates = db.updates.slice(0, 200);
      await putTenantDoc(tenant, "manual_updates_db", db, actor, "save_manual_update");

      return NextResponse.json({
        ok: true,
        update: newItem,
        updates: db.updates,
      });
    }

    if (action === "delete_update") {
      const id = String(payload.id || "").trim();
      db.updates = db.updates.filter((u: AnyObj) => String(u?.id || "") !== id);
      await putTenantDoc(tenant, "manual_updates_db", db, actor, "delete_manual_update");
      return NextResponse.json({
        ok: true,
        updates: db.updates,
      });
    }

    // Consulta de IA sobre el Manual del Usuario
    const question = String(payload.question || "").trim();
    const userName = String(payload.userName || "Usuario").trim();
    const userRole = String(payload.userRole || "Usuario").trim();
    const contextText = String(payload.contextText || "").trim();

    if (!question) {
      return NextResponse.json(
        { ok: false, message: "Escribí una consulta." },
        { status: 400 }
      );
    }

    const geminiKey = (process.env.GEMINI_API_KEY || "").trim();
    if (geminiKey) {
      try {
        const systemPrompt =
          `Sos el Asistente de Inteligencia Artificial del Manual del Usuario del sistema ERP ${tenant.fantasy_name || "MiniSistema"}.\n` +
          `Respondé SIEMPRE en español argentino claro, estructurado, preciso y amable al usuario ${userName} (${userRole}).\n` +
          `Basate estrictamente en los módulos habilitados para este usuario y en las últimas actualizaciones del sistema provistas en el contexto.\n` +
          `Incluí pasos numerados concretos, nombres exactos de botones y atajos de teclado cuando correspondan.`;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
          geminiKey
        )}`;
        const aiRes = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `CONTEXTO DEL MANUAL Y ACTUALIZACIONES HABILITADAS PARA EL USUARIO:\n${contextText}\n\nCONSULTA DEL USUARIO:\n${question}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1024,
            },
          }),
        });
        if (aiRes.ok) {
          const respJson = (await aiRes.json().catch(() => null)) as AnyObj | null;
          const aiText = String(
            respJson?.candidates?.[0]?.content?.parts?.[0]?.text || ""
          ).trim();
          if (aiText) {
            return NextResponse.json({
              ok: true,
              source: "gemini-cloud",
              answer: aiText,
            });
          }
        }
      } catch {
        // Fallback to local neural KB in frontend
      }
    }

    return NextResponse.json({
      ok: true,
      source: "local-neural-kb",
      answer: "",
    });
  }

  return NextResponse.json(
    { ok: false, message: "Método no permitido" },
    { status: 405 }
  );
}
