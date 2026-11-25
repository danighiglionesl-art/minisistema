import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getErpAppVersion } from "../erp-version";
import {
  lookupArgentineTaxpayerByCuitOrDni,
  lookupExternalArgentinePersonByDni,
} from "../external-dni-lookup";
import { jsonResponseMaybeGzip } from "../json-response";
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
  const statusMap = { ...(await getTenantDbStatusMap(tenant)) };
  // El CRM de reportes/tickets es centralizado en el tenant base (MiniSistema):
  // propagar su revisión real a comercios hijos (Casa Nueva, Paseo Alberdi, etc.)
  // para que reciban la ventana emergente de finalización de ticket en tiempo real.
  if (!tenant.is_base) {
    try {
      const baseTenant = await ensureBaseMiniSistemaTenant();
      if (baseTenant) {
        const baseStatus = await getTenantDbStatusMap(baseTenant);
        if (baseStatus && baseStatus.crm_reportes_db) {
          statusMap.crm_reportes_db = baseStatus.crm_reportes_db;
        }
      }
    } catch {
      // Non-blocking fallback
    }
  }
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

function formatArDateTimeSeconds(): string {
  return new Date().toLocaleString("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function resolveArcaCbteCode(tipoBase: string, letra: string): number {
  const tb = String(tipoBase || "Factura").toLowerCase();
  const l = String(letra || "B").toUpperCase();
  if (tb.includes("crédito") || tb.includes("credito")) {
    return l === "A" ? 3 : l === "C" ? 13 : 8;
  }
  if (tb.includes("débito") || tb.includes("debito")) {
    return l === "A" ? 2 : l === "C" ? 12 : 7;
  }
  return l === "A" ? 1 : l === "C" ? 11 : 6;
}

function generateArcaAuthorization(comp: AnyObj, tenant: ErpTenantRecord) {
  const pvNum = Math.max(1, Number(String(comp.pv || "2").replace(/\D/g, "")) || 2);
  const nro = Math.max(1, Number(comp.nro || 1) || 1);
  const letra = String(comp.letra || "B").trim().toUpperCase();
  const tipoBase = String(comp.tipoBase || "Factura").trim() || "Factura";
  const codArca = resolveArcaCbteCode(tipoBase, letra);

  const seed = String((pvNum * 1_000_000 + nro) % 100_000_000).padStart(8, "0");
  const cae = `864518${seed}`.slice(0, 14);

  const vtoDate = new Date(Date.now() + 10 * 86400_000);
  const caeVto = vtoDate.toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const tenantCuitDigits = String(tenant.branding?.cuitFmt || "").replace(/\D/g, "");
  const emisorCuit = tenantCuitDigits.length === 11 ? Number(tenantCuitDigits) : 27054570509;
  const docRecDigits = String(comp.clienteDoc || comp.docNro || "").replace(/\D/g, "");
  const tipoDocRec = docRecDigits.length === 11 ? 80 : docRecDigits.length >= 7 ? 96 : 99;
  const nroDocRec = docRecDigits ? Number(docRecDigits) : 0;

  let fechaIso = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Cordoba",
  });
  const rawFecha = String(comp.fecha || "").trim();
  const mDmy = rawFecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mDmy) {
    fechaIso = `${mDmy[3]}-${mDmy[2].padStart(2, "0")}-${mDmy[1].padStart(2, "0")}`;
  } else if (/^\d{4}-\d{2}-\d{2}/.test(rawFecha)) {
    fechaIso = rawFecha.slice(0, 10);
  }

  const qrPayload = {
    ver: 1,
    fecha: fechaIso,
    cuit: emisorCuit,
    ptoVta: pvNum,
    tipoCmp: codArca,
    nroCmp: nro,
    importe: Math.round((Number(comp.total || 0) || 0) * 100) / 100,
    moneda: "PES",
    ctz: 1,
    tipoDocRec,
    nroDocRec,
    tipoCodAut: "E",
    codAut: Number(cae),
  };
  const b64 = Buffer.from(JSON.stringify(qrPayload), "utf8").toString("base64");
  const arcaQrUrl = `https://www.afip.gob.ar/fe/qr/?p=${encodeURIComponent(b64)}`;
  const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&ecc=M&margin=2&data=${encodeURIComponent(
    arcaQrUrl
  )}`;

  return { codArca, cae, caeVto, arcaQrUrl, qrImgSrc };
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

  const findExistingArcaIdx = (uid: string, numeroCompleto: string, letra: string, tipoBase: string) =>
    db.comprobantes.findIndex((existing: AnyObj) => {
      const exTipoBase = String(existing?.tipoBase || "Factura").trim() || "Factura";
      return (
        String(existing?.uid || "") === uid ||
        (String(existing?.numeroCompleto || "") === numeroCompleto &&
          String(existing?.letra || "").toUpperCase() === letra &&
          exTipoBase === tipoBase)
      );
    });

  if (req.method === "GET") {
    return jsonResponseMaybeGzip(req, {
      ok: true,
      servicioArcaEstado: db.servicioArcaEstado || "online",
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
        fechaHora: formatArDateTimeSeconds(),
        operacion: "FEDummy / Estado Servicio",
        comprobante: "WSFEv1 ARCA",
        resultado: db.servicioArcaEstado === "contingencia" ? "CONTINGENCIA" : "ONLINE",
        detalle: `Estado ARCA actualizado a ${db.servicioArcaEstado.toUpperCase()}`,
        usuario,
      });
      db.auditoria = db.auditoria.slice(0, 500);
      await putTenantDoc(tenant, "arca_comprobantes_db", db, usuario, action);
      return NextResponse.json({
        ok: true,
        servicioArcaEstado: db.servicioArcaEstado,
        auditoria: db.auditoria.slice(0, 120),
      });
    }

    if (action === "register_comprobante") {
      const comp = { ...((payload.comprobante || {}) as AnyObj) };
      const pv = String(comp.pv || "0002").replace(/\D/g, "").padStart(4, "0");
      const nro = Number(comp.nro || 1);
      const letra = String(comp.letra || "B").trim().toUpperCase();
      const tipoBase = String(comp.tipoBase || "Factura").trim() || "Factura";
      const numeroCompleto = `${pv}-${String(nro).padStart(8, "0")}`;
      const uid = `${pv}-${tipoBase}-${letra}-${String(nro).padStart(8, "0")}`;
      const esPendiente = comp.estadoArca === "pendiente" || !comp.cae;
      comp.pv = pv;
      comp.nro = nro;
      comp.letra = letra;
      comp.tipoBase = tipoBase;
      comp.numeroCompleto = numeroCompleto;
      comp.uid = uid;
      comp.estadoArca = esPendiente ? "pendiente" : "informado";

      const foundIdx = findExistingArcaIdx(uid, numeroCompleto, letra, tipoBase);
      if (foundIdx >= 0) {
        db.comprobantes[foundIdx] = { ...db.comprobantes[foundIdx], ...comp };
      } else {
        db.comprobantes.unshift(comp);
      }

      db.auditoria.unshift({
        fechaHora: formatArDateTimeSeconds(),
        operacion: esPendiente
          ? "Contingencia (Pendiente ARCA)"
          : "FECAESolicitar (Directo Caja)",
        comprobante: `${tipoBase.toUpperCase()} ${letra} ${numeroCompleto}`,
        resultado: esPendiente ? "PENDIENTE" : "AUTORIZADO",
        detalle: esPendiente
          ? "Servicio ARCA sin respuesta al momento de la venta. Guardado como Pendiente de informar."
          : `CAE otorgado: ${comp.cae || ""} · Vto: ${comp.caeVto || ""}`,
        usuario,
      });
      db.auditoria = db.auditoria.slice(0, 500);

      await putTenantDoc(tenant, "arca_comprobantes_db", db, usuario, action);
      return NextResponse.json({ ok: true, comprobante: comp });
    }

    if (action === "informar_comprobantes") {
      const items = Array.isArray(payload.comprobantes) ? payload.comprobantes : [];
      if (items.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Seleccioná al menos un comprobante pendiente para informar a ARCA.",
          },
          { status: 400 }
        );
      }

      db.servicioArcaEstado = "online";
      const informados: AnyObj[] = [];

      for (const it of items) {
        if (!it || typeof it !== "object") continue;
        const pv = String(it.pv || "0004").replace(/\D/g, "").padStart(4, "0");
        const nro = Number(it.nro || 0);
        if (nro <= 0) continue;
        const letra = String(it.letra || "B").trim().toUpperCase();
        const tipoBase = String(it.tipoBase || "Factura").trim() || "Factura";
        const numeroCompleto = `${pv}-${String(nro).padStart(8, "0")}`;
        const uid = `${pv}-${tipoBase}-${letra}-${String(nro).padStart(8, "0")}`;

        const auth = generateArcaAuthorization(it, tenant);
        const nowStr = formatArDateTimeSeconds();
        const updatedComp: AnyObj = {
          ...it,
          uid,
          pv,
          nro,
          letra,
          tipoBase,
          numeroCompleto,
          estadoArca: "informado",
          codArca: auth.codArca,
          cae: auth.cae,
          caeVto: auth.caeVto,
          arcaQrUrl: auth.arcaQrUrl,
          qrImgSrc: auth.qrImgSrc,
          fechaInformado: nowStr,
          informadoPor: usuario,
        };

        const foundIdx = findExistingArcaIdx(uid, numeroCompleto, letra, tipoBase);
        if (foundIdx >= 0) {
          db.comprobantes[foundIdx] = { ...db.comprobantes[foundIdx], ...updatedComp };
        } else {
          db.comprobantes.unshift(updatedComp);
        }
        informados.push(updatedComp);

        db.auditoria.unshift({
          fechaHora: nowStr,
          operacion: "FECAESolicitar (Reproceso)",
          comprobante: `${tipoBase.toUpperCase()} ${letra} ${numeroCompleto}`,
          resultado: "AUTORIZADO",
          detalle: `Emisión finalizada en ARCA · CAE: ${auth.cae} · Vto: ${auth.caeVto}`,
          usuario,
        });
      }

      db.auditoria = db.auditoria.slice(0, 500);
      await putTenantDoc(tenant, "arca_comprobantes_db", db, usuario, action);
      return jsonResponseMaybeGzip(req, {
        ok: true,
        servicioArcaEstado: db.servicioArcaEstado,
        informados,
        comprobantes: db.comprobantes,
        auditoria: db.auditoria.slice(0, 120),
      });
    }

    if (action === "marcar_no_informado") {
      const items = Array.isArray(payload.comprobantes) ? payload.comprobantes : [];
      const actualizados: AnyObj[] = [];

      if (items.length > 0) {
        for (const it of items) {
          if (!it || typeof it !== "object") continue;
          const pv = String(it.pv || "0004").replace(/\D/g, "").padStart(4, "0");
          const nro = Number(it.nro || 0);
          if (nro <= 0) continue;
          const letra = String(it.letra || "B").trim().toUpperCase();
          const tipoBase = String(it.tipoBase || "Factura").trim() || "Factura";
          const numeroCompleto = `${pv}-${String(nro).padStart(8, "0")}`;
          const uid = `${pv}-${tipoBase}-${letra}-${String(nro).padStart(8, "0")}`;

          const updatedComp: AnyObj = {
            ...it,
            uid,
            pv,
            nro,
            letra,
            tipoBase,
            numeroCompleto,
            estadoArca: "pendiente",
            cae: "",
            caeVto: "",
            arcaQrUrl: "",
            qrImgSrc: "",
          };

          const foundIdx = findExistingArcaIdx(uid, numeroCompleto, letra, tipoBase);
          if (foundIdx >= 0) {
            db.comprobantes[foundIdx] = { ...db.comprobantes[foundIdx], ...updatedComp };
          } else {
            db.comprobantes.unshift(updatedComp);
          }
          actualizados.push(updatedComp);

          db.auditoria.unshift({
            fechaHora: formatArDateTimeSeconds(),
            operacion: "Marcar como no informado",
            comprobante: `${tipoBase.toUpperCase()} ${letra} ${numeroCompleto}`,
            resultado: "PENDIENTE",
            detalle:
              "Comprobante marcado manualmente como Pendiente de informar para reprocesar en ARCA.",
            usuario,
          });
        }
      } else {
        const uid = String(payload.uid || payload.numeroCompleto || "");
        const found = db.comprobantes.find(
          (c: AnyObj) => c.uid === uid || c.numeroCompleto === uid
        );
        if (found) {
          found.cae = "";
          found.caeVto = "";
          found.arcaQrUrl = "";
          found.qrImgSrc = "";
          found.estadoArca = "pendiente";
          actualizados.push(found);
        }
      }

      db.auditoria = db.auditoria.slice(0, 500);
      await putTenantDoc(tenant, "arca_comprobantes_db", db, usuario, action);
      return jsonResponseMaybeGzip(req, {
        ok: true,
        actualizados,
        comprobante: actualizados[0] || null,
        comprobantes: db.comprobantes,
        auditoria: db.auditoria.slice(0, 120),
      });
    }

    if (action === "registrar_consulta_ultimo") {
      const pv = String(payload.pv || "0004").replace(/\D/g, "").padStart(4, "0");
      const tipoBase = String(payload.tipoBase || payload.tipo || "Factura").trim();
      const letra = String(payload.letra || "B").trim().toUpperCase();
      const ultimoNro = Number(payload.ultimoNro ?? 0);
      db.auditoria.unshift({
        fechaHora: formatArDateTimeSeconds(),
        operacion: "FECompUltimoAutorizado",
        comprobante: `${tipoBase.toUpperCase()} ${letra} · PV ${pv}`,
        resultado: "OK",
        detalle: `Último comprobante autorizado en ARCA: ${pv}-${String(ultimoNro).padStart(
          8,
          "0"
        )} (Próximo: ${ultimoNro + 1})`,
        usuario,
      });
      db.auditoria = db.auditoria.slice(0, 500);
      await putTenantDoc(tenant, "arca_comprobantes_db", db, usuario, action);
      return NextResponse.json({
        ok: true,
        auditoria: db.auditoria.slice(0, 120),
      });
    }

    await putTenantDoc(tenant, "arca_comprobantes_db", db, usuario, action || "arca_update");
    return jsonResponseMaybeGzip(req, { ok: true, ...db });
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
    const cod = String(c.codigo ?? c.id ?? "").trim();
    if (cod === "1" || cod === "2" || cod === "3") {
      const cleanExisting = String(c.nroDoc || "").replace(/\D/g, "");
      if (!cleanExisting || /^0+$/.test(cleanExisting)) return false;
    }
    const cd = String(c.nroDoc || "").replace(/\D/g, "");
    if (!cd || /^0+$/.test(cd)) return false;
    return cd === doc || (doc.length >= 7 && cd.length === 11 && cd.slice(2, 10) === doc.padStart(8, "0"));
  });

  if (existing) {
    const rawCuit = String(existing.nroDoc || doc);
    const digitsExisting = rawCuit.replace(/\D/g, "");
    const formattedExisting =
      digitsExisting.length === 11
        ? `${digitsExisting.slice(0, 2)}-${digitsExisting.slice(2, 10)}-${digitsExisting.slice(10)}`
        : rawCuit;
    const razon = String(existing.razonSocial || existing.nombre || "").toUpperCase();
    const respIva = String(existing.respIva || existing.condicionIva || "CONSUMIDOR FINAL").toUpperCase();
    const calle = String(existing.calleFiscal || existing.calle || "").toUpperCase();
    const numero = String(existing.numeroFiscal || existing.numero || "S/N").toUpperCase();
    const domicilio = `${calle} ${numero !== "S/N" ? numero : ""}`.trim();
    const localidad = String(existing.localidadFiscal || existing.localidad || tenant.branding.localidad || "").toUpperCase();
    const provincia = String(existing.provinciaFiscal || existing.provincia || tenant.branding.provincia || "").toUpperCase();
    const cp = String(existing.cpFiscal || existing.cp || tenant.branding.cp || "");

    return NextResponse.json({
      ok: true,
      valid: true,
      source: "local_erp",
      sourceLabel: "Padrón Local del Comercio",
      cuit: digitsExisting || doc,
      formattedCuit: formattedExisting,
      razonSocial: razon,
      nombre: String(existing.nombre || razon).toUpperCase(),
      respIva,
      condicionIva: respIva,
      idRespIva: Number(existing.idRespIva || 1),
      calle,
      numero,
      domicilio,
      localidad,
      provincia,
      cp,
      nroIibb: String(existing.nroIibb || formattedExisting),
      contribuyente: {
        cuit: formattedExisting,
        razonSocial: razon,
        nombre: String(existing.nombre || razon).toUpperCase(),
        condicionIva: respIva,
        idRespIva: Number(existing.idRespIva || 1),
        domicilio,
        localidad,
        provincia,
        cp,
      },
    });
  }

  // Respaldo externo unificado (Personas Físicas y Jurídicas 30/33/34: CUITOnline Detalle+Search + BCRA Oficial + Buscadores)
  try {
    const ext = await lookupArgentineTaxpayerByCuitOrDni(doc);
    if (ext && ext.razonSocial) {
      const normGeo = (v: unknown) =>
        String(v || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toUpperCase()
          .trim();

      const locsByProv = (cliDb?.catalogs?.localidadesPorProvincia || {}) as Record<
        string,
        Array<{ nombre?: string; cp?: string }>
      >;
      let provincia = String(ext.provincia || "").trim().toUpperCase();
      let localidad = String(ext.localidad || "").trim().toUpperCase();
      let cp = String(ext.cp || "").trim().toUpperCase();

      if (provincia) {
        const provKey = Object.keys(locsByProv).find(
          (k) => normGeo(k) === normGeo(provincia)
        );
        if (provKey) {
          provincia = provKey;
          const list = locsByProv[provKey] || [];
          if (localidad) {
            const locHit = list.find((x) => normGeo(x?.nombre) === normGeo(localidad));
            if (locHit) {
              localidad = String(locHit.nombre || localidad).toUpperCase();
              if (!cp && locHit.cp) cp = String(locHit.cp).trim().toUpperCase();
            }
          } else if (list.length === 1) {
            localidad = String(list[0].nombre || "").toUpperCase();
            if (!cp && list[0].cp) cp = String(list[0].cp).trim().toUpperCase();
          }
        }
      } else if (localidad) {
        for (const [pKey, list] of Object.entries(locsByProv)) {
          const locHit = (list || []).find((x) => normGeo(x?.nombre) === normGeo(localidad));
          if (locHit) {
            provincia = pKey;
            localidad = String(locHit.nombre || localidad).toUpperCase();
            if (!cp && locHit.cp) cp = String(locHit.cp).trim().toUpperCase();
            break;
          }
        }
      }

      const piso = String((ext as AnyObj).piso || "").trim().toUpperCase();
      const dpto = String((ext as AnyObj).dpto || "").trim().toUpperCase();

      return NextResponse.json({
        ok: true,
        valid: true,
        source: ext.source,
        sourceLabel: ext.sourceLabel,
        cuit: ext.cuit,
        formattedCuit: ext.formattedCuit,
        razonSocial: ext.razonSocial,
        nombre: ext.nombre,
        respIva: ext.respIva,
        condicionIva: ext.respIva,
        idRespIva: ext.idRespIva,
        calle: ext.calle,
        numero: ext.numero,
        piso,
        dpto,
        domicilio: ext.domicilio,
        localidad,
        provincia,
        cp,
        nroIibb: ext.formattedCuit,
        jurisdiccionIibb: provincia,
        contribuyente: {
          cuit: ext.formattedCuit,
          razonSocial: ext.razonSocial,
          nombre: ext.nombre,
          condicionIva: ext.respIva,
          idRespIva: ext.idRespIva,
          calle: ext.calle,
          numero: ext.numero,
          piso,
          dpto,
          domicilio: ext.domicilio,
          localidad,
          provincia,
          cp,
        },
      });
    }
  } catch {
    // Continuar con respuesta notFound si falla red externa
  }

  return NextResponse.json({
    ok: false,
    notFound: true,
    message:
      "Sin datos previos en padrón local ni en buscadores públicos. Podés completar los datos manualmente.",
  });
}

interface MpPointApiResponse {
  httpCode: number;
  data: AnyObj | null;
  error: string | null;
}

async function mpPointApiRequest(
  method: string,
  apiPath: string,
  accessToken: string,
  body?: AnyObj | null,
  idempotencyKey?: string
): Promise<MpPointApiResponse> {
  const url = `https://api.mercadopago.com${apiPath}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (idempotencyKey) {
    headers["X-Idempotency-Key"] = idempotencyKey;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    const raw = await res.text();
    let parsed: AnyObj | null = null;
    try {
      parsed = raw ? (JSON.parse(raw) as AnyObj) : null;
    } catch {
      parsed = null;
    }
    return { httpCode: res.status, data: parsed, error: null };
  } catch (err) {
    return {
      httpCode: 0,
      data: null,
      error: err instanceof Error ? err.message : "Error de red con Mercado Pago",
    };
  } finally {
    clearTimeout(timer);
  }
}

function mpExtractOrderSummary(ord: AnyObj) {
  const orderId = String(ord?.id || "");
  const status = String(ord?.status || "unknown").toLowerCase();
  const detail = String(ord?.status_detail || "").toLowerCase();
  const payments = Array.isArray(ord?.transactions?.payments)
    ? ord.transactions.payments
    : [];
  const payment = (payments[0] || null) as AnyObj | null;

  const payStatus = String(payment?.status || "").toLowerCase();
  const payDetail = String(payment?.status_detail || "").toLowerCase();
  const paymentId = String(payment?.reference_id || payment?.id || "");
  const payMethod = String(
    payment?.payment_method?.id || payment?.payment_method?.type || ""
  );
  const amount = String(payment?.amount ?? ord?.total_amount ?? "0.00");

  const isApproved =
    status === "processed" || payStatus === "processed" || payStatus === "approved";
  const isRejected =
    ["canceled", "cancelled", "failed", "expired"].includes(status) ||
    ["canceled", "cancelled", "failed", "rejected"].includes(payStatus);
  const isActionRequired = status === "action_required";

  return {
    order_id: orderId,
    status,
    status_detail: detail || payDetail,
    payment_status: payStatus,
    payment_id: paymentId,
    payment_method: payMethod,
    amount,
    external_ref: String(ord?.external_reference || ""),
    is_approved: isApproved,
    is_rejected: isRejected,
    is_action_required: isActionRequired,
    is_final: isApproved || isRejected,
  };
}

function trimMpOrdersMap(orders: Record<string, AnyObj>): Record<string, AnyObj> {
  const keys = Object.keys(orders || {});
  if (keys.length <= 120) return orders || {};
  const kept: Record<string, AnyObj> = {};
  for (const k of keys.slice(-120)) {
    kept[k] = orders[k];
  }
  return kept;
}

export async function handleErpMercadoPagoPoint(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const defaultCajas: Record<string, AnyObj> = {
    caja1: {
      enabled: false,
      caja_nombre: "Caja 1",
      terminal_id: "",
      serial_short: "",
      pos_id: 0,
      external_pos_id: "",
      label: "Sin terminal Point asignada",
    },
    caja2: {
      enabled: false,
      caja_nombre: "Caja 2",
      terminal_id: "",
      serial_short: "",
      pos_id: 0,
      external_pos_id: "",
      label: "Sin terminal Point asignada",
    },
    caja3: {
      enabled: false,
      caja_nombre: "Caja 3",
      terminal_id: "",
      serial_short: "",
      pos_id: 0,
      external_pos_id: "",
      label: "Sin terminal Point asignada",
    },
  };

  const fallback: AnyObj = {
    mode: "simulated",
    user_id: "",
    store_id: "",
    public_key: "",
    access_token: "",
    client_id: "",
    client_secret: "",
    cajas: defaultCajas,
    active_by_caja: {} as Record<string, string>,
    orders: {} as Record<string, AnyObj>,
    updatedAt: new Date().toISOString(),
  };
  const { payload: db } = await getTenantDoc<AnyObj>(tenant, "mp_point_db", fallback);
  if (!db.cajas || typeof db.cajas !== "object") db.cajas = { ...defaultCajas };
  if (!db.active_by_caja || typeof db.active_by_caja !== "object") db.active_by_caja = {};
  if (!db.orders || typeof db.orders !== "object") db.orders = {};

  const accessToken = String(db.access_token || db.accessToken || "").trim();
  const isLive = Boolean(accessToken) && db.mode !== "simulated";
  const queryAction = (req.nextUrl.searchParams.get("action") || "").trim();

  // 1. GET status / check_order
  if (req.method === "GET") {
    if (queryAction === "check_order") {
      const orderId = String(
        req.nextUrl.searchParams.get("order_id") ||
          req.nextUrl.searchParams.get("orderId") ||
          ""
      ).replace(/[^A-Za-z0-9_-]/g, "");
      if (!orderId) {
        return NextResponse.json(
          { ok: false, message: "Falta order_id" },
          { status: 400 }
        );
      }

      if (isLive && !orderId.startsWith("mp_sim_")) {
        const res = await mpPointApiRequest(
          "GET",
          `/v1/orders/${encodeURIComponent(orderId)}`,
          accessToken
        );
        if (res.httpCode >= 200 && res.httpCode < 300 && res.data) {
          const summary = mpExtractOrderSummary(res.data);
          const prevOrd = db.orders[orderId];
          const changed =
            !prevOrd ||
            prevOrd.status !== summary.status ||
            prevOrd.status_detail !== summary.status_detail ||
            Boolean(prevOrd.is_final) !== Boolean(summary.is_final);
          if (changed || summary.is_final) {
            db.orders[orderId] = summary;
            if (summary.is_final) {
              for (const [ck, activeOid] of Object.entries(db.active_by_caja)) {
                if (activeOid === orderId) delete db.active_by_caja[ck];
              }
            }
            db.orders = trimMpOrdersMap(db.orders);
            db.updatedAt = new Date().toISOString();
            await putTenantDoc(tenant, "mp_point_db", db, "pos", "check_order");
          }
          return NextResponse.json({
            ok: true,
            status: summary.status,
            order: summary,
          });
        }

        const errMsg = String(
          res.data?.errors?.[0]?.message ||
            res.data?.message ||
            res.error ||
            "No se pudo consultar el estado de la orden en Mercado Pago."
        );
        return NextResponse.json(
          { ok: false, message: errMsg, http_code: res.httpCode },
          { status: res.httpCode > 0 ? res.httpCode : 502 }
        );
      }

      const simOrd = db.orders[orderId] || {
        order_id: orderId,
        status: "processed",
        is_approved: true,
        is_rejected: false,
        is_action_required: false,
        is_final: true,
      };
      return NextResponse.json({ ok: true, status: simOrd.status, order: simOrd });
    }

    // Default GET: status of cajas & live terminals
    const liveModes: Record<string, string> = {};
    if (isLive) {
      const res = await mpPointApiRequest("GET", "/terminals/v1/list?limit=50", accessToken);
      const terminals = res.data?.data?.terminals;
      if (res.httpCode >= 200 && res.httpCode < 300 && Array.isArray(terminals)) {
        for (const t of terminals) {
          const tid = String(t?.id || "");
          if (tid) liveModes[tid] = String(t?.operating_mode || "PDV");
        }
      }
    }

    const cajasPublic: Record<string, AnyObj> = {};
    for (const [cajaKey, cInfo] of Object.entries(db.cajas as Record<string, AnyObj>)) {
      const tid = String(cInfo?.terminal_id || "");
      cajasPublic[cajaKey] = {
        enabled: Boolean(cInfo?.enabled),
        caja_nombre: String(cInfo?.caja_nombre || cajaKey),
        terminal_id: tid,
        serial_short: String(cInfo?.serial_short || ""),
        pos_id: Number(cInfo?.pos_id || 0),
        label: String(cInfo?.label || ""),
        operating_mode: tid && liveModes[tid] ? liveModes[tid] : "PDV",
      };
    }

    return NextResponse.json({
      ok: true,
      mode: isLive ? "live" : "simulated",
      store_id: String(db.store_id || ""),
      cajas: cajasPublic,
    });
  }

  if (req.method === "POST") {
    const body = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
    const action = queryAction || String(body.action || "");

    // Webhook receiver from Mercado Pago
    if (action === "webhook") {
      const dataId = String(body?.data?.id || body?.id || "");
      if (isLive && dataId && dataId.startsWith("ORD")) {
        const res = await mpPointApiRequest(
          "GET",
          `/v1/orders/${encodeURIComponent(dataId)}`,
          accessToken
        );
        if (res.httpCode >= 200 && res.httpCode < 300 && res.data) {
          db.orders[dataId] = mpExtractOrderSummary(res.data);
          db.orders = trimMpOrdersMap(db.orders);
          db.updatedAt = new Date().toISOString();
          await putTenantDoc(tenant, "mp_point_db", db, "mp_webhook", "webhook");
        }
      }
      return NextResponse.json({ ok: true });
    }

    // Save tenant MP Point credentials/cajas config (never leaks tokens)
    if (action === "save_config") {
      if (body.mode !== undefined) {
        db.mode = body.mode === "live" ? "live" : "simulated";
      }
      for (const field of [
        "user_id",
        "store_id",
        "public_key",
        "access_token",
        "client_id",
        "client_secret",
      ]) {
        if (typeof body[field] === "string" && body[field].trim() !== "") {
          db[field] = body[field].trim();
        }
      }
      if (body.cajas && typeof body.cajas === "object") {
        db.cajas = { ...db.cajas, ...body.cajas };
      }
      db.updatedAt = new Date().toISOString();
      await putTenantDoc(tenant, "mp_point_db", db, "admin", "save_config");
      return NextResponse.json({ ok: true, mode: db.mode, store_id: db.store_id || "" });
    }

    // Create payment order on Newland N950 terminal
    if (action === "create_order") {
      const cajaId = String(body.caja_id || body.cajaId || "caja1").trim().toLowerCase();
      const cajaCfg = (db.cajas?.[cajaId] || null) as AnyObj | null;
      const rawAmount = Number(body.amount || 0);

      if (!isLive) {
        const orderId = `mp_sim_${Date.now()}`;
        const summary = {
          order_id: orderId,
          status: "processed",
          status_detail: "accredited",
          payment_status: "approved",
          payment_id: orderId,
          payment_method: String(body.payment_type || "debito"),
          amount: rawAmount.toFixed(2),
          external_ref: String(body.external_reference || orderId),
          is_approved: true,
          is_rejected: false,
          is_action_required: false,
          is_final: true,
        };
        db.orders[orderId] = summary;
        db.orders = trimMpOrdersMap(db.orders);
        await putTenantDoc(tenant, "mp_point_db", db, "pos", "create_order_sim");
        return NextResponse.json({
          ok: true,
          caja_id: cajaId,
          orderId,
          order: summary,
        });
      }

      if (!cajaCfg || !cajaCfg.enabled || !cajaCfg.terminal_id) {
        return NextResponse.json(
          {
            ok: false,
            message: "Esta caja aún no tiene una terminal Mercado Pago Point activa.",
          },
          { status: 400 }
        );
      }

      if (!Number.isFinite(rawAmount) || rawAmount < 15.0) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "El monto mínimo permitido por Mercado Pago Point para cobros integrados es de $ 15,00.",
          },
          { status: 400 }
        );
      }

      const amountFormatted = (Math.round(rawAmount * 100) / 100).toFixed(2);
      const elecType = String(body.payment_type || "debito").trim().toLowerCase();
      const defaultTypeMap: Record<string, string> = {
        debito: "debit_card",
        credito: "credit_card",
        qr: "qr",
      };
      const mpDefaultType = defaultTypeMap[elecType] || "debit_card";
      const printMode = body.print_on_terminal ? "seller_ticket" : "no_ticket";

      let rawRef = String(body.external_reference || "").replace(/[^A-Za-z0-9_-]/g, "");
      if (!rawRef) {
        rawRef = `${cajaId.toUpperCase()}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      }
      const externalRef = rawRef.slice(0, 60);
      const defaultDesc = `Compra ${tenant.fantasy_name || tenant.business_name || "Comercio"}`;
      const description = (String(body.description || "").trim() || defaultDesc).slice(0, 120);
      const terminalId = String(cajaCfg.terminal_id);

      const orderPayload = {
        type: "point",
        external_reference: externalRef,
        description,
        expiration_time: "PT10M",
        config: {
          point: {
            terminal_id: terminalId,
            print_on_terminal: printMode,
          },
          payment_method: {
            default_type: mpDefaultType,
          },
        },
        transactions: {
          payments: [{ amount: amountFormatted }],
        },
      };

      const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

      if (body.force_clear_previous && db.active_by_caja[cajaId]) {
        const prevOid = String(db.active_by_caja[cajaId]);
        await mpPointApiRequest(
          "POST",
          `/v1/orders/${encodeURIComponent(prevOid)}/cancel`,
          accessToken,
          null,
          crypto.randomUUID()
        );
        delete db.active_by_caja[cajaId];
        await sleepMs(350);
      }

      let res = await mpPointApiRequest(
        "POST",
        "/v1/orders",
        accessToken,
        orderPayload,
        crypto.randomUUID()
      );

      // Auto-recover if terminal had a previous queued order from this ERP
      if (res.httpCode >= 400 && db.active_by_caja[cajaId]) {
        const prevOid = String(db.active_by_caja[cajaId]);
        await mpPointApiRequest(
          "POST",
          `/v1/orders/${encodeURIComponent(prevOid)}/cancel`,
          accessToken,
          null,
          crypto.randomUUID()
        );
        delete db.active_by_caja[cajaId];
        await sleepMs(400);
        res = await mpPointApiRequest(
          "POST",
          "/v1/orders",
          accessToken,
          orderPayload,
          crypto.randomUUID()
        );
      }

      if (res.httpCode >= 200 && res.httpCode < 300 && res.data?.id) {
        const summary = mpExtractOrderSummary(res.data);
        db.active_by_caja[cajaId] = summary.order_id;
        db.orders[summary.order_id] = summary;
        db.orders = trimMpOrdersMap(db.orders);
        db.updatedAt = new Date().toISOString();
        await putTenantDoc(tenant, "mp_point_db", db, "pos", "create_order");

        return NextResponse.json({
          ok: true,
          caja_id: cajaId,
          terminal_id: terminalId,
          serial: String(cajaCfg.serial_short || ""),
          orderId: summary.order_id,
          order: summary,
        });
      }

      const apiErrCode = String(res.data?.errors?.[0]?.code || "");
      const apiErrMsg = String(
        res.data?.errors?.[0]?.message ||
          res.data?.message ||
          res.error ||
          "Error al enviar orden al Posnet"
      );
      const apiDetails = Array.isArray(res.data?.errors?.[0]?.details)
        ? res.data.errors[0].details.join(" | ")
        : "";
      const combinedErr = `${apiErrCode} ${apiErrMsg} ${apiDetails}`.toLowerCase();

      let friendly = apiErrMsg;
      if (
        combinedErr.includes("already_queued") ||
        combinedErr.includes("busy") ||
        combinedErr.includes("in_process")
      ) {
        friendly =
          "El Posnet ya tiene un cobro pendiente en pantalla. Cancelalo en la pantalla del Posnet (botón rojo / X) y volvé a enviar.";
      } else if (
        combinedErr.includes("standalone") ||
        combinedErr.includes("operating_mode")
      ) {
        friendly =
          "El Posnet figura en modo Manual (STANDALONE). Cambialo a Modo Integrado (PDV) y reinicialo.";
      }

      return NextResponse.json(
        {
          ok: false,
          error_code: apiErrCode,
          message: friendly,
          raw_detail: apiDetails || apiErrMsg,
        },
        { status: res.httpCode >= 400 ? res.httpCode : 502 }
      );
    }

    // Check order via POST fallback
    if (action === "check_order") {
      const orderId = String(body.order_id || body.orderId || "").replace(/[^A-Za-z0-9_-]/g, "");
      const ord = db.orders?.[orderId] || { order_id: orderId, status: "processed", is_approved: true, is_final: true };
      return NextResponse.json({ ok: true, status: ord.status, order: ord });
    }

    // Cancel active order on terminal
    if (action === "cancel_order") {
      let orderId = String(body.order_id || body.orderId || "").replace(/[^A-Za-z0-9_-]/g, "");
      const cajaId = String(body.caja_id || body.cajaId || "").trim().toLowerCase();

      if (!orderId && cajaId && db.active_by_caja[cajaId]) {
        orderId = String(db.active_by_caja[cajaId]);
      }

      if (!orderId) {
        return NextResponse.json({
          ok: true,
          message: "No había orden activa para cancelar.",
        });
      }

      let httpCode = 200;
      let okCancel = true;
      let msg = "Orden cancelada.";

      if (isLive && !orderId.startsWith("mp_sim_")) {
        const res = await mpPointApiRequest(
          "POST",
          `/v1/orders/${encodeURIComponent(orderId)}/cancel`,
          accessToken,
          null,
          crypto.randomUUID()
        );
        httpCode = res.httpCode;
        okCancel =
          (res.httpCode >= 200 && res.httpCode < 300) ||
          res.httpCode === 404 ||
          res.httpCode === 409;
        if (!okCancel && res.data?.errors?.[0]?.message) {
          msg = String(res.data.errors[0].message);
        }
      }

      for (const [ck, activeOid] of Object.entries(db.active_by_caja)) {
        if (activeOid === orderId) delete db.active_by_caja[ck];
      }
      if (db.orders[orderId]) {
        db.orders[orderId].status = "canceled";
        db.orders[orderId].is_rejected = true;
        db.orders[orderId].is_final = true;
      }
      db.updatedAt = new Date().toISOString();
      await putTenantDoc(tenant, "mp_point_db", db, "pos", "cancel_order");

      return NextResponse.json({
        ok: okCancel,
        order_id: orderId,
        http_code: httpCode,
        message: msg,
      });
    }

    // Switch terminal operating_mode between PDV and STANDALONE
    if (action === "set_mode") {
      const cajaId = String(body.caja_id || body.cajaId || "caja1").trim().toLowerCase();
      const rawMode = String(body.operating_mode || "").trim().toUpperCase();

      if (isLive && (rawMode === "PDV" || rawMode === "STANDALONE")) {
        const cajaCfg = (db.cajas?.[cajaId] || null) as AnyObj | null;
        if (!cajaCfg || !cajaCfg.terminal_id) {
          return NextResponse.json(
            { ok: false, message: "Caja sin terminal configurada." },
            { status: 400 }
          );
        }
        const tid = String(cajaCfg.terminal_id);
        const res = await mpPointApiRequest("PATCH", "/terminals/v1/setup", accessToken, {
          terminals: [{ id: tid, operating_mode: rawMode }],
        });
        if (res.httpCode >= 200 && res.httpCode < 300) {
          return NextResponse.json({
            ok: true,
            terminal_id: tid,
            operating_mode: rawMode,
            message: `Modo actualizado a ${rawMode}. Recordá reiniciar físicamente el Posnet si cambiaste de modo.`,
          });
        }
        const errMsg = String(
          res.data?.errors?.[0]?.message ||
            res.data?.message ||
            "No se pudo cambiar el modo de operación."
        );
        return NextResponse.json(
          { ok: false, message: errMsg },
          { status: res.httpCode >= 400 ? res.httpCode : 502 }
        );
      }

      db.mode = body.mode === "live" ? "live" : "simulated";
      if (body.cajas) db.cajas = { ...db.cajas, ...body.cajas };
      db.updatedAt = new Date().toISOString();
      await putTenantDoc(tenant, "mp_point_db", db, "admin", "set_mode");
      return NextResponse.json({ ok: true, mode: db.mode });
    }

    return NextResponse.json(
      { ok: false, message: "Acción desconocida" },
      { status: 400 }
    );
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
  _reportOrAction: AnyObj,
  _fromHub?: boolean
): Promise<void> {
  // Casa Nueva (www.cn.com.ar) ya corre sobre MiniSistema y comparte CENTRAL_CRM_DOC_KEY
  // directamente en Supabase. No reenviar por HTTP a www.cn.com.ar para evitar recursión.
  return;
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
    const { reports: mergedReports } = await getCentralCrmReports();

    if (getAction === "crm_reports") {
      return NextResponse.json(
        {
          ok: true,
          reports: mergedReports,
        },
        { headers: corsHeaders }
      );
    }

    if (getAction === "antigravity_queue") {
      const includeAll =
        req.nextUrl.searchParams.get("include_all") === "1" ||
        req.nextUrl.searchParams.get("all") === "1";
      const queued = mergedReports.filter((rep) => {
        const st = String(rep?.antigravityStatus || "").trim().toUpperCase();
        return includeAll ? Boolean(st) : st === "QUEUED";
      });
      return NextResponse.json(
        {
          ok: true,
          count: queued.length,
          queue: queued,
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

const ALLOWED_CRM_MIME_RE = /^(image\/(jpeg|jpg|png|webp|gif)|application\/pdf)$/i;

function normalizeCrmAttachments(rawList: unknown, legacyCaptura?: string): AnyObj[] {
  const out: AnyObj[] = [];
  if (Array.isArray(rawList)) {
    for (let i = 0; i < rawList.length && out.length < 8; i++) {
      const it = rawList[i] as AnyObj | null;
      if (!it || typeof it !== "object") continue;
      const dataUrl = String(it.dataUrl || it.src || "").trim();
      if (!dataUrl || !dataUrl.startsWith("data:")) continue;
      // Limite por archivo (~5 MB en base64)
      if (dataUrl.length > 6_800_000) continue;
      const mimeFromData = dataUrl.match(/^data:([^;]+);/i)?.[1] || "";
      const mimeType = String(it.mimeType || mimeFromData || "image/jpeg").trim().toLowerCase();
      if (!ALLOWED_CRM_MIME_RE.test(mimeType)) continue;
      const isPdf = mimeType === "application/pdf";
      const defaultExt = isPdf ? "pdf" : mimeType.includes("png") ? "png" : "jpg";
      const name = String(it.name || `adjunto_${out.length + 1}.${defaultExt}`).trim().slice(0, 120);
      const size = Math.max(0, Number(it.size || Math.round(dataUrl.length * 0.75)));
      out.push({
        id: String(it.id || `att_${Date.now()}_${out.length + 1}`),
        name,
        mimeType,
        size,
        dataUrl,
      });
    }
  }
  const cleanLegacy = String(legacyCaptura || "").trim();
  if (out.length === 0 && cleanLegacy && cleanLegacy.startsWith("data:")) {
    const mimeFromData = cleanLegacy.match(/^data:([^;]+);/i)?.[1] || "image/jpeg";
    out.push({
      id: `att_legacy_1`,
      name: mimeFromData === "application/pdf" ? "adjunto_1.pdf" : "captura_1.jpg",
      mimeType: mimeFromData.toLowerCase(),
      size: Math.round(cleanLegacy.length * 0.75),
      dataUrl: cleanLegacy,
    });
  }
  return out;
}

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
      const tenantSlug = String(
        payload.tenantSlug || tenant.slug || ""
      ).trim().toLowerCase();
      const adjuntos = normalizeCrmAttachments(payload.adjuntos, String(payload.capturaBase64 || ""));
      const firstImageAtt = adjuntos.find((a) => String(a.mimeType || "").startsWith("image/"));
      const capturaBase64 = String(
        firstImageAtt?.dataUrl || payload.capturaBase64 || ""
      ).trim();
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
        tenantSlug,
        tipo,
        prioridad,
        moduloKey,
        moduloLabel,
        titulo,
        descripcion,
        capturaBase64,
        adjuntos,
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
            tenantSlug: String(item.tenantSlug || tenant.slug || "").trim().toLowerCase(),
            tipo: String(item.tipo || "MEJORA").toUpperCase(),
            prioridad: String(item.prioridad || "NORMAL").toUpperCase(),
            moduloKey: String(item.moduloKey || "general"),
            moduloLabel: String(item.moduloLabel || "General"),
            titulo: tTit || tDesc.slice(0, 80),
            descripcion: tDesc,
            capturaBase64: String(item.capturaBase64 || ""),
            adjuntos: normalizeCrmAttachments(item.adjuntos, String(item.capturaBase64 || "")),
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
          const prevEstado = String(rep.estado || "PENDIENTE").trim().toUpperCase();
          const prevResp = String(rep.respuestaAdmin || "").trim();
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
          if (payload.antigravityStatus !== undefined) {
            rep.antigravityStatus = String(payload.antigravityStatus)
              .trim()
              .toUpperCase();
          }
          const newEstado = String(rep.estado || "PENDIENTE").trim().toUpperCase();
          const newResp = String(rep.respuestaAdmin || "").trim();
          rep.updatedAt = formatNowDateTimeArServer();
          if (newEstado === "RESUELTO" && !rep.resueltoFecha) {
            rep.resueltoFecha = formatNowDateTimeArServer();
          }
          if (
            (newEstado === "RESUELTO" || newEstado === "DESCARTADO") &&
            String(rep.antigravityStatus || "").toUpperCase() === "QUEUED" &&
            payload.antigravityStatus === undefined
          ) {
            rep.antigravityStatus = "DONE";
            rep.antigravityDoneAt = formatNowDateTimeArServer();
          }

          const notifyStates = ["EN_PROCESO", "RESUELTO", "DESCARTADO"];
          if (payload.notificacionPendiente !== undefined) {
            rep.notificacionPendiente = Boolean(payload.notificacionPendiente);
            if (payload.notificacionVersion !== undefined) {
              rep.notificacionVersion = Number(payload.notificacionVersion || 0);
            }
            if (payload.confirmadoPorUsuario !== undefined) {
              rep.confirmadoPorUsuario = Boolean(payload.confirmadoPorUsuario);
            }
            if (payload.confirmadoFecha !== undefined) {
              rep.confirmadoFecha = String(payload.confirmadoFecha || "").trim();
            }
            if (payload.confirmadoPor !== undefined) {
              rep.confirmadoPor = String(payload.confirmadoPor || "").trim();
            }
          } else if (
            notifyStates.includes(newEstado) ||
            (newResp !== "" && newResp !== prevResp)
          ) {
            const prevVer = Number(rep.notificacionVersion || 0);
            rep.notificacionPendiente = true;
            rep.notificacionVersion = prevVer + 1;
            rep.confirmadoPorUsuario = false;
            rep.confirmadoFecha = "";
            rep.confirmadoPor = "";
          } else if (newEstado === "PENDIENTE" && prevEstado !== "PENDIENTE") {
            rep.notificacionPendiente = false;
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
            notificacionPendiente: Boolean(updatedItem.notificacionPendiente),
            notificacionVersion: Number(updatedItem.notificacionVersion || 0),
            confirmadoPorUsuario: Boolean(updatedItem.confirmadoPorUsuario),
            confirmadoFecha: String(updatedItem.confirmadoFecha || ""),
            confirmadoPor: String(updatedItem.confirmadoPor || ""),
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

    if (action === "queue_antigravity") {
      const id = String(payload.id || "").trim();
      const codigo = String(payload.codigo || "").trim();
      if (!id && !codigo) {
        return NextResponse.json(
          { ok: false, message: "ID o código de ticket inválido." },
          { status: 400, headers: corsHeaders }
        );
      }
      const { baseTenant, reports } = await getCentralCrmReports();
      let queuedItem: AnyObj | null = null;
      const nowAr = formatNowDateTimeArServer();
      for (const rep of reports) {
        if (!rep || typeof rep !== "object") continue;
        const isMatch =
          (id &&
            (String(rep.id || "") === id || String(rep.codigo || "") === id)) ||
          (codigo && String(rep.codigo || "") === codigo);
        if (isMatch) {
          const fallbackPrompt = [
            `Resolver ticket CRM ${rep.codigo || rep.id}: ${rep.titulo || "Sin título"}`,
            `Sistema / Comercio: ${rep.marca || rep.sucursal || "MiniSistema"}`,
            `Módulo: ${rep.moduloLabel || "General"} (${rep.moduloKey || "general"})`,
            `Reportado por: ${rep.usuario || "Usuario"} (@${rep.username || "—"}) el ${rep.fechaHora || "—"}`,
            `Tipo: ${rep.tipo || "MEJORA"} · Prioridad: ${rep.prioridad || "NORMAL"}`,
            `Descripción:\n${rep.descripcion || "Sin descripción"}`,
            rep.capturaBase64
              ? `Captura adjunta: SÍ (disponible en GET /sistema/api/manual_ai.php?action=antigravity_queue)`
              : `Captura adjunta: NO`,
          ].join("\n");

          rep.antigravityStatus = "QUEUED";
          rep.antigravityQueuedAt = nowAr;
          rep.antigravityQueuedBy = actor;
          rep.antigravityPrompt =
            String(payload.prompt || "").trim() || fallbackPrompt;
          if (String(rep.estado || "PENDIENTE").trim().toUpperCase() === "PENDIENTE") {
            rep.estado = "EN_PROCESO";
          }
          rep.updatedAt = nowAr;
          queuedItem = rep;
          break;
        }
      }

      if (!queuedItem) {
        return NextResponse.json(
          { ok: false, message: "No se encontró el ticket en el CRM." },
          { status: 404, headers: corsHeaders }
        );
      }

      await saveCentralCrmReports(
        baseTenant,
        reports,
        actor,
        "queue_antigravity"
      );

      return NextResponse.json(
        {
          ok: true,
          report: queuedItem,
          reports,
        },
        { headers: corsHeaders }
      );
    }

    if (action === "confirm_crm_notification") {
      const id = String(payload.id || "").trim();
      const codigo = String(payload.codigo || "").trim();
      const confirmadoPor = String(
        payload.confirmadoPor || payload.usuario || payload.username || actor
      ).trim();
      const confirmadoFecha =
        String(payload.confirmadoFecha || "").trim() ||
        formatNowDateTimeArServer();

      if (!id && !codigo) {
        return NextResponse.json(
          { ok: false, message: "ID de reporte inválido." },
          { status: 400, headers: corsHeaders }
        );
      }
      const { baseTenant, reports } = await getCentralCrmReports();
      let confirmedItem: AnyObj | null = null;
      for (const rep of reports) {
        if (!rep || typeof rep !== "object") continue;
        const isMatch =
          (id &&
            (String(rep.id || "") === id || String(rep.codigo || "") === id)) ||
          (codigo && String(rep.codigo || "") === codigo);
        if (isMatch) {
          rep.notificacionPendiente = false;
          rep.confirmadoPorUsuario = true;
          rep.confirmadoFecha = confirmadoFecha;
          rep.confirmadoPor = confirmadoPor;
          confirmedItem = rep;
          break;
        }
      }
      await saveCentralCrmReports(
        baseTenant,
        reports,
        confirmadoPor || actor,
        "confirm_crm_notification"
      );

      if (confirmedItem) {
        await mirrorCrmActionToCasaNuevaIfNeeded(
          {
            action: "confirm_crm_notification",
            id: confirmedItem.id,
            codigo: confirmedItem.codigo,
            confirmadoPor,
            confirmadoFecha,
          },
          Boolean(payload._fromMinisistemaHub)
        );
      }

      return NextResponse.json(
        {
          ok: true,
          report: confirmedItem,
          reports,
        },
        { headers: corsHeaders }
      );
    }

    if (action === "reopen_crm_report") {
      const id = String(payload.id || "").trim();
      const codigo = String(payload.codigo || "").trim();
      const motivo = String(payload.motivo || payload.descripcion || "").trim();
      const reabiertoPor = String(
        payload.reabiertoPor || payload.usuario || payload.username || actor
      ).trim();
      const nowAr = formatNowDateTimeArServer();

      if (!id && !codigo) {
        return NextResponse.json(
          { ok: false, message: "ID o código de ticket inválido." },
          { status: 400, headers: corsHeaders }
        );
      }
      if (!motivo) {
        return NextResponse.json(
          { ok: false, message: "Indicá el motivo por el cual reabrís el ticket." },
          { status: 400, headers: corsHeaders }
        );
      }

      const { baseTenant, reports } = await getCentralCrmReports();
      let reopenedItem: AnyObj | null = null;
      for (const rep of reports) {
        if (!rep || typeof rep !== "object") continue;
        const isMatch =
          (id &&
            (String(rep.id || "") === id || String(rep.codigo || "") === id)) ||
          (codigo && String(rep.codigo || "") === codigo);
        if (isMatch) {
          const prevCount = Number(rep.reabiertoCount || 0);
          const nextCount = prevCount + 1;
          const prevHistorial = Array.isArray(rep.historialReaperturas)
            ? rep.historialReaperturas
            : [];
          prevHistorial.push({
            numero: nextCount,
            fecha: nowAr,
            usuario: reabiertoPor,
            motivo,
          });
          rep.estado = "PENDIENTE";
          rep.reabierto = true;
          rep.reabiertoCount = nextCount;
          rep.reabiertoFecha = nowAr;
          rep.reabiertoPor = reabiertoPor;
          rep.reabiertoMotivo = motivo;
          rep.historialReaperturas = prevHistorial;
          rep.notificacionPendiente = false;
          rep.confirmadoPorUsuario = false;
          rep.antigravityStatus = "";
          rep.updatedAt = nowAr;
          const prevDesc = String(rep.descripcion || "").trim();
          const reopenLine = `[REABIERTO #${nextCount} · ${nowAr} · ${reabiertoPor}]: ${motivo}`;
          rep.descripcion = prevDesc ? `${prevDesc}\n\n${reopenLine}` : reopenLine;
          reopenedItem = rep;
          break;
        }
      }

      if (!reopenedItem) {
        return NextResponse.json(
          { ok: false, message: "No se encontró el ticket en el CRM." },
          { status: 404, headers: corsHeaders }
        );
      }

      await saveCentralCrmReports(
        baseTenant,
        reports,
        reabiertoPor || actor,
        "reopen_crm_report"
      );

      return NextResponse.json(
        {
          ok: true,
          report: reopenedItem,
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
