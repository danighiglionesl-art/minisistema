import zlib from "node:zlib";
import { NextRequest, NextResponse } from "next/server";
import { jsonResponseMaybeGzip } from "../json-response";
import { buildCleanTenantSeed } from "../seed-clean-tenant";
import {
  getTenantDoc,
  getTenantDocGzippedSnapshot,
  listPendingPosEvents,
  markPosEventsCompacted,
  patchCatalogArticles,
  patchTenantDocKeys,
  putTenantDoc,
  putTenantMediaInDb,
  type ErpPosEventRecord,
} from "../supabase-server";
import type { ErpTenantRecord } from "../types";

const storeGzipCache = new Map<string, { rev: number; maxEvId: number; gzBuf: Buffer }>();

type AnyObj = Record<string, any>;

function applyPendingStockDeltas(
  db: AnyObj,
  stockEvents: ErpPosEventRecord[],
  mutateInPlace = false
): AnyObj {
  if (!stockEvents.length || !Array.isArray(db.articulos)) return db;
  const deltaMap = new Map<number, number>();
  for (const ev of stockEvents) {
    const deltas = Array.isArray(ev.stock_deltas) ? ev.stock_deltas : [];
    for (const d of deltas) {
      const aid = Number(d?.artId || 0);
      const delta = Number(d?.delta || 0);
      if (aid > 0 && delta) {
        deltaMap.set(aid, (deltaMap.get(aid) || 0) + delta);
      }
    }
  }
  if (deltaMap.size === 0) return db;
  if (mutateInPlace) {
    for (const a of db.articulos) {
      const aid = Number(a?.id || 0);
      const delta = deltaMap.get(aid);
      if (delta) {
        a.sf = round3(Number(a.sf || 0) + delta);
      }
    }
    return db;
  }
  return {
    ...db,
    articulos: db.articulos.map((a: AnyObj) => {
      const aid = Number(a?.id || 0);
      const delta = deltaMap.get(aid);
      if (!delta) return a;
      return { ...a, sf: round3(Number(a.sf || 0) + delta) };
    }),
  };
}

function round2(n: unknown): number {
  const num = Number(n);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
}

function round3(n: unknown): number {
  const num = Number(n);
  return Number.isFinite(num) ? Math.round(num * 1000) / 1000 : 0;
}

export async function handleErpCatalog(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const fallback = buildCleanTenantSeed({ businessName: tenant.business_name })
    .docs.catalog_db as AnyObj;

  if (req.method === "GET") {
    const action = req.nextUrl.searchParams.get("action") || "summary";

    if (action === "fcr_drafts") {
      const { payload: draftsDoc } = await getTenantDoc<AnyObj>(
        tenant,
        "fcr_drafts_db",
        { drafts: [], updatedAt: "" }
      );
      const drafts = Array.isArray(draftsDoc?.drafts) ? draftsDoc.drafts : [];
      return NextResponse.json(
        {
          ok: true,
          drafts,
          updatedAt: draftsDoc?.updatedAt || "",
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    if (action === "smart_images") {
      const q = (req.nextUrl.searchParams.get("q") || "").trim();
      const candidates = q
        ? [
            `https://tse2.mm.bing.net/th?q=${encodeURIComponent(
              `${q} producto fondo blanco`
            )}&w=400&h=400&c=7&rs=1&p=0`,
            `https://tse4.mm.bing.net/th?q=${encodeURIComponent(
              `${q} envase supermercado argentina`
            )}&w=400&h=400&c=7&rs=1&p=0`,
          ]
        : [];
      return NextResponse.json({ ok: true, candidates });
    }

    const acceptEnc = (req.headers.get("accept-encoding") || "").toLowerCase();
    const pendingStockEvents = await listPendingPosEvents(tenant, "catalog");
    const maxStockEvId = pendingStockEvents.reduce(
      (mx, ev) => Math.max(mx, Number(ev.id || 0)),
      0
    );

    if (action !== "store") {
      if (acceptEnc.includes("gzip") && pendingStockEvents.length === 0) {
        const snap = await getTenantDocGzippedSnapshot(tenant, "catalog_db", fallback);
        return new NextResponse(new Uint8Array(snap.gzBuf), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Encoding": "gzip",
            "Content-Length": String(snap.gzBuf.byteLength),
            Vary: "Accept-Encoding",
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      }
      const { payload: rawDb } = await getTenantDoc<AnyObj>(
        tenant,
        "catalog_db",
        fallback
      );
      const db = applyPendingStockDeltas(rawDb, pendingStockEvents, false);
      return jsonResponseMaybeGzip(req, db);
    }

    const { payload: rawDb, rev } = await getTenantDoc<AnyObj>(
      tenant,
      "catalog_db",
      fallback
    );

    const storeCacheKey = tenant.db_schema;
    const cachedStore = storeGzipCache.get(storeCacheKey);
    if (
      acceptEnc.includes("gzip") &&
      cachedStore &&
      cachedStore.rev === rev &&
      cachedStore.maxEvId === maxStockEvId
    ) {
      return new NextResponse(new Uint8Array(cachedStore.gzBuf), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Encoding": "gzip",
          "Content-Length": String(cachedStore.gzBuf.byteLength),
          Vary: "Accept-Encoding",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    const db = applyPendingStockDeltas(rawDb, pendingStockEvents, false);

    const arts = Array.isArray(db.articulos) ? db.articulos : [];
    const storeArts = arts
      .filter((a: AnyObj) => {
        if (!a || typeof a !== "object") return false;
        const bl = Number(a.bl ?? 0);
        const cw =
          a.cw === 0 || a.cw === false || a.cw === "0" ? 0 : 1;
        return bl !== 1 && cw === 1 && Number(a.id) !== 4407;
      })
      .map((a: AnyObj) => ({
        id: Number(a.id || 0),
        c: String(a.c ?? a.co ?? ""),
        n: String(a.n ?? a.no ?? ""),
        r: Number(a.r ?? a.ru ?? 0),
        mk: Number(a.mk ?? a.ma ?? 0),
        bc: Array.isArray(a.bc) ? a.bc : [],
        bl: 0,
        cw: 1,
        sf: round3(a.sf ?? 0),
        al: Number.isFinite(Number(a.iva)) ? Number(a.iva) : 21,
        p1f: round2(a.p1f ?? 0),
        p2f: round2(a.p2f ?? 0),
        im: String(a.im ?? ""),
        cfid: Number(a.cfid ?? 0),
        ptsCanje: Number(a.ptsCanje ?? a.pfid ?? 0),
      }));

    const storePayload = {
      ok: true,
      updatedAt: db.updatedAt || new Date().toISOString(),
      totalArticulos: storeArts.length,
      rubros: Array.isArray(db.rubros) ? db.rubros : [],
      marcas: Array.isArray(db.marcas) ? db.marcas : [],
      articulos: storeArts,
    };

    if (acceptEnc.includes("gzip")) {
      const gzBuf = zlib.gzipSync(Buffer.from(JSON.stringify(storePayload), "utf8"), {
        level: 4,
      });
      storeGzipCache.set(storeCacheKey, { rev, maxEvId: maxStockEvId, gzBuf });
      return new NextResponse(new Uint8Array(gzBuf), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Encoding": "gzip",
          "Content-Length": String(gzBuf.byteLength),
          Vary: "Accept-Encoding",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    return jsonResponseMaybeGzip(req, storePayload);
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

    if (postAction === "save_fcr_draft") {
      const incoming = payload.draft;
      if (!incoming || typeof incoming !== "object" || !incoming.prov) {
        return NextResponse.json(
          { ok: false, message: "Borrador de factura inválido" },
          { status: 400 }
        );
      }
      const { payload: draftsDoc } = await getTenantDoc<AnyObj>(
        tenant,
        "fcr_drafts_db",
        { drafts: [], updatedAt: "" }
      );
      const list: AnyObj[] = Array.isArray(draftsDoc?.drafts)
        ? draftsDoc.drafts.filter((d: AnyObj) => d && typeof d === "object")
        : [];

      const draftId = String(
        incoming.id || `FCR-DRAFT-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      ).trim();
      const nroUpper = String(incoming.nroFactura || "").trim().toUpperCase();
      const clientId = Number(incoming.prov?.clientId || 0);

      let existingIdx = list.findIndex((d) => String(d.id || "") === draftId);
      if (existingIdx < 0 && nroUpper && nroUpper !== "0" && nroUpper !== "S/N" && clientId > 0) {
        existingIdx = list.findIndex(
          (d) =>
            Number(d.prov?.clientId || 0) === clientId &&
            String(d.nroFactura || "").trim().toUpperCase() === nroUpper
        );
      }

      const finalId = existingIdx >= 0 ? String(list[existingIdx].id || draftId) : draftId;
      const savedDraft: AnyObj = {
        ...incoming,
        id: finalId,
        savedAtIso: String(incoming.savedAtIso || new Date().toISOString()),
        usuario: String(incoming.usuario || actor || "OPERADOR"),
        syncedServer: true,
      };

      if (existingIdx >= 0) {
        list[existingIdx] = savedDraft;
      } else {
        list.unshift(savedDraft);
      }

      list.sort((a, b) =>
        String(b.savedAtIso || "").localeCompare(String(a.savedAtIso || ""))
      );
      const trimmed = list.slice(0, 50);
      const nextDoc = {
        drafts: trimmed,
        updatedAt: new Date().toISOString(),
        lastModifiedBy: actor,
      };
      await putTenantDoc(tenant, "fcr_drafts_db", nextDoc, actor, "save_fcr_draft");
      return NextResponse.json({
        ok: true,
        draft: savedDraft,
        drafts: trimmed,
        updatedAt: nextDoc.updatedAt,
      });
    }

    if (postAction === "delete_fcr_draft") {
      const targetId = String(payload.id || payload.draftId || "").trim();
      const clientId = Number(payload.clientId || 0);
      const nroUpper = String(payload.nroFactura || "").trim().toUpperCase();
      const { payload: draftsDoc } = await getTenantDoc<AnyObj>(
        tenant,
        "fcr_drafts_db",
        { drafts: [], updatedAt: "" }
      );
      const list: AnyObj[] = Array.isArray(draftsDoc?.drafts)
        ? draftsDoc.drafts.filter((d: AnyObj) => d && typeof d === "object")
        : [];
      const filtered = list.filter((d) => {
        if (targetId && String(d.id || "") === targetId) return false;
        if (
          nroUpper &&
          nroUpper !== "0" &&
          nroUpper !== "S/N" &&
          clientId > 0 &&
          Number(d.prov?.clientId || 0) === clientId &&
          String(d.nroFactura || "").trim().toUpperCase() === nroUpper
        ) {
          return false;
        }
        return true;
      });
      const nextDoc = {
        drafts: filtered,
        updatedAt: new Date().toISOString(),
        lastModifiedBy: actor,
      };
      await putTenantDoc(tenant, "fcr_drafts_db", nextDoc, actor, "delete_fcr_draft");
      return NextResponse.json({
        ok: true,
        drafts: filtered,
        updatedAt: nextDoc.updatedAt,
      });
    }

    if (postAction === "upload_image") {
      const b64Raw = String(payload.imageBase64 || payload.dataUrl || "");
      const m = b64Raw.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);
      if (!m) {
        return NextResponse.json(
          { ok: false, message: "Formato de imagen no válido" },
          { status: 400 }
        );
      }
      const mimeType = m[1].toLowerCase();
      const ext = mimeType.includes("png")
        ? "png"
        : mimeType.includes("webp")
          ? "webp"
          : "jpg";
      const fileKey = `prod_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}.${ext}`;

      await putTenantMediaInDb(tenant, {
        media_key: fileKey,
        category: "products",
        mime_type: mimeType,
        data_b64: m[2],
      });

      const publicUrl = `/sistema/assets/products/${fileKey}?tenant=${encodeURIComponent(
        tenant.slug
      )}`;
      return NextResponse.json({
        ok: true,
        filename: fileKey,
        imageUrl: publicUrl,
        im: publicUrl,
        ims: "web",
      });
    }

    const [docRes, pendingStockEvents] = await Promise.all([
      getTenantDoc<AnyObj>(tenant, "catalog_db", fallback),
      listPendingPosEvents(tenant, "catalog"),
    ]);
    const db = applyPendingStockDeltas(docRes.payload, pendingStockEvents, false);
    const maxStockEvId = pendingStockEvents.reduce(
      (mx, ev) => Math.max(mx, Number(ev.id || 0)),
      0
    );
    if (!Array.isArray(db.articulos)) db.articulos = [];
    if (!Array.isArray(db.rubros)) db.rubros = [];
    if (!Array.isArray(db.marcas)) db.marcas = [];
    if (!Array.isArray(db.configuracionesPrecios)) db.configuracionesPrecios = [];

    const deltaArtIds = new Set<number>();
    for (const ev of pendingStockEvents) {
      const deltas = Array.isArray(ev.stock_deltas) ? ev.stock_deltas : [];
      for (const d of deltas) {
        const aid = Number(d?.artId || 0);
        if (aid > 0 && Number(d?.delta || 0) !== 0) deltaArtIds.add(aid);
      }
    }

    const buildCatalogMeta = (actionTag: string) => {
      db.updatedAt = new Date().toISOString();
      db.totalArticulos = db.articulos.length;
      db.totalActivos = db.articulos.filter((a: AnyObj) => !a.bl).length;
      db.totalCarritoWeb = db.articulos.filter(
        (a: AnyObj) => !a.bl && Number(a.cw ?? 1) === 1
      ).length;
      db.lastModifiedBy = actor;
      db.lastAction = actionTag;
      return {
        updatedAt: db.updatedAt,
        totalArticulos: db.totalArticulos,
        totalActivos: db.totalActivos,
        totalCarritoWeb: db.totalCarritoWeb,
        lastModifiedBy: db.lastModifiedBy,
        lastAction: db.lastAction,
      };
    };

    const saveArticlesAndReply = async (
      actionTag: string,
      responseObj: AnyObj,
      opts: {
        upserts?: AnyObj[];
        deleteIds?: Array<number | string>;
        extraMeta?: Record<string, unknown>;
      }
    ) => {
      const metaPatch = {
        ...buildCatalogMeta(actionTag),
        ...(opts.extraMeta || {}),
      };
      // Incluir artículos con deltas pendientes de POS para compactar de forma atómica
      const deleteSet = new Set((opts.deleteIds || []).map((x) => String(x)));
      const upsertMap = new Map<string, AnyObj>();
      for (const u of opts.upserts || []) {
        if (u && u.id !== undefined) upsertMap.set(String(u.id), u);
      }
      if (deltaArtIds.size > 0) {
        for (const a of db.articulos) {
          const aid = Number(a?.id || 0);
          if (deltaArtIds.has(aid) && !deleteSet.has(String(aid)) && !upsertMap.has(String(aid))) {
            upsertMap.set(String(aid), a);
          }
        }
      }
      const saved = await patchCatalogArticles(tenant, {
        upserts: Array.from(upsertMap.values()),
        deleteIds: opts.deleteIds || [],
        metaPatch,
        fullMergedPayload: db,
        actor,
        action: actionTag,
      });
      if (maxStockEvId > 0) {
        await markPosEventsCompacted(tenant, maxStockEvId, "catalog");
      }
      return NextResponse.json({ ok: true, rev: saved.rev, ...responseObj });
    };

    const saveMetaKeysAndReply = async (
      actionTag: string,
      responseObj: AnyObj,
      keysPatch: Record<string, unknown>
    ) => {
      const metaPatch = {
        ...buildCatalogMeta(actionTag),
        ...keysPatch,
      };
      const saved = await patchTenantDocKeys(
        tenant,
        "catalog_db",
        metaPatch,
        db,
        actor,
        actionTag
      );
      // No compactamos pos_events de stock aquí porque solo modificamos metadatos (rubros/marcas/góndola)
      return NextResponse.json({ ok: true, rev: saved.rev, ...responseObj });
    };

    const saveAndReply = async (actionTag: string, responseObj: AnyObj) => {
      buildCatalogMeta(actionTag);
      const saved = await putTenantDoc(tenant, "catalog_db", db, actor, actionTag);
      if (maxStockEvId > 0) {
        await markPosEventsCompacted(tenant, maxStockEvId, "catalog");
      }
      return NextResponse.json({ ok: true, rev: saved.rev, ...responseObj });
    };

    if (postAction === "save_article" || postAction === "") {
      const artIn = (payload.article || payload.articulo || payload) as AnyObj;
      const rawCode = String(artIn.c ?? artIn.codigo ?? "").trim();
      const rawName = String(artIn.n ?? artIn.nombre ?? "")
        .trim()
        .toUpperCase();
      if (!rawCode || !rawName) {
        return NextResponse.json(
          { ok: false, message: "Código y Nombre son obligatorios" },
          { status: 400 }
        );
      }

      let id = Number(artIn.id || 0);
      const code5 = /^\d+$/.test(rawCode) ? rawCode.padStart(5, "0") : rawCode;
      let idx = db.articulos.findIndex(
        (a: AnyObj) =>
          (id > 0 && Number(a.id) === id) ||
          (id <= 0 && String(a.c) === code5)
      );

      if (id <= 0) {
        if (idx >= 0) {
          id = Number(db.articulos[idx].id);
        } else {
          const maxId = db.articulos.reduce(
            (mx: number, a: AnyObj) =>
              Number(a.id) !== 4407 && Number(a.id) > mx ? Number(a.id) : mx,
            0
          );
          id = maxId + 1;
        }
      }

      const prev = idx >= 0 ? db.articulos[idx] : {};
      const merged: AnyObj = {
        ...prev,
        ...artIn,
        id,
        c: code5,
        n: rawName,
        r: Number(artIn.r ?? prev.r ?? 3),
        mk: Number(artIn.mk ?? prev.mk ?? 0),
        p: Number(artIn.p ?? prev.p ?? 0),
        pr: Array.isArray(artIn.pr) ? artIn.pr : prev.pr || [],
        bc: Array.isArray(artIn.bc) ? artIn.bc : prev.bc || [],
        bl: Number(artIn.bl ?? prev.bl ?? 0),
        fr: Number(artIn.fr ?? prev.fr ?? 0),
        iv: Number(artIn.iv ?? prev.iv ?? 5),
        iva: Number.isFinite(Number(artIn.iva))
          ? Number(artIn.iva)
          : Number(prev.iva ?? 21),
        cn: round2(artIn.cn ?? prev.cn ?? 0),
        cfn: round2(artIn.cfn ?? prev.cfn ?? 0),
        cp: Number(artIn.cp ?? prev.cp ?? 0),
        ucp: Number(artIn.ucp ?? prev.ucp ?? 0),
        m1: round2(artIn.m1 ?? prev.m1 ?? 0),
        m2: round2(artIn.m2 ?? prev.m2 ?? 0),
        p1n: round2(artIn.p1n ?? prev.p1n ?? 0),
        p1f: round2(artIn.p1f ?? prev.p1f ?? 0),
        p2n: round2(artIn.p2n ?? prev.p2n ?? 0),
        p2f: round2(artIn.p2f ?? prev.p2f ?? 0),
        sf: round3(artIn.sf ?? prev.sf ?? 0),
        sm: round2(artIn.sm ?? prev.sm ?? 6),
        cw: artIn.cw !== undefined ? Number(artIn.cw ? 1 : 0) : Number(prev.cw ?? 1),
        im: String(artIn.im ?? prev.im ?? ""),
        ims: String(artIn.ims ?? prev.ims ?? (String(artIn.im || "").startsWith("http") || String(artIn.im || "").startsWith("/") ? "web" : "sis")),
      };

      if (idx >= 0) {
        db.articulos[idx] = merged;
      } else {
        db.articulos.push(merged);
      }
      return saveArticlesAndReply("save_article", { article: merged }, { upserts: [merged] });
    }

    if (postAction === "delete") {
      const id = Number(payload.id || 0);
      if (id === 4407) {
        return NextResponse.json(
          { ok: false, message: "El Artículo Genérico 00020 no puede eliminarse." },
          { status: 400 }
        );
      }
      const idx = db.articulos.findIndex((a: AnyObj) => Number(a.id) === id);
      if (idx < 0) {
        return NextResponse.json(
          { ok: false, message: "Artículo no encontrado" },
          { status: 404 }
        );
      }
      if (payload.hard) {
        db.articulos.splice(idx, 1);
        return saveArticlesAndReply("delete_article", { id }, { deleteIds: [id] });
      }
      db.articulos[idx].bl = 1;
      db.articulos[idx].fb = new Date().toLocaleDateString("es-AR");
      return saveArticlesAndReply("delete_article", { id }, { upserts: [db.articulos[idx]] });
    }

    if (postAction === "update_article_stock_minimo") {
      const id = Number(payload.id || payload.artId || 0);
      const sm = round2(payload.sm ?? payload.stockMinimo ?? 0);
      const art = db.articulos.find((a: AnyObj) => Number(a.id) === id);
      if (!art) {
        return NextResponse.json(
          { ok: false, message: "Artículo no encontrado" },
          { status: 404 }
        );
      }
      art.sm = sm;
      return saveArticlesAndReply("update_sm", { article: art }, { upserts: [art] });
    }

    if (postAction === "toggle_envase_retornable") {
      const id = Number(payload.id || payload.artId || 0);
      const art = db.articulos.find((a: AnyObj) => Number(a.id) === id);
      if (!art) {
        return NextResponse.json(
          { ok: false, message: "Artículo no encontrado" },
          { status: 404 }
        );
      }
      art.env = payload.env ? 1 : 0;
      return saveArticlesAndReply("toggle_envase", { article: art }, { upserts: [art] });
    }

    if (postAction === "save_fp_supplier_config") {
      const provId = String(payload.proveedorId || payload.id || "");
      if (!db.fpSupplierConfigs || typeof db.fpSupplierConfigs !== "object") {
        db.fpSupplierConfigs = {};
      }
      db.fpSupplierConfigs[provId] = payload.config || payload;
      return saveMetaKeysAndReply(
        "save_fp_supplier_config",
        { config: db.fpSupplierConfigs[provId] },
        { fpSupplierConfigs: db.fpSupplierConfigs }
      );
    }

    if (postAction === "bulk_update_from_invoice") {
      const onlyStock = Boolean(payload.onlyStock);
      const items = Array.isArray(payload.articles)
        ? payload.articles
        : Array.isArray(payload.items)
          ? payload.items
          : [];
      let updatedCount = 0;
      const modifiedArts: AnyObj[] = [];
      for (const it of items) {
        if (!it || typeof it !== "object") continue;
        const id = Number(it.id || it.artId || 0);
        const art = db.articulos.find((a: AnyObj) => Number(a.id) === id);
        if (!art) continue;
        if (it.addStock !== undefined) {
          art.sc = round3(Number(art.sc || 0) + Number(it.addStock || 0));
          art.sf = round3(Number(art.sf || 0) + Number(it.addStock || 0));
        } else {
          if (it.sc !== undefined) art.sc = round3(it.sc);
          if (it.sf !== undefined) art.sf = round3(it.sf);
        }
        if (!onlyStock) {
          if (it.cn !== undefined) art.cn = round2(it.cn);
          if (it.cfn !== undefined) art.cfn = round2(it.cfn);
          if (it.p1n !== undefined) art.p1n = round2(it.p1n);
          if (it.p1f !== undefined) art.p1f = round2(it.p1f);
          if (it.p2n !== undefined) art.p2n = round2(it.p2n);
          if (it.p2f !== undefined) art.p2f = round2(it.p2f);
          if (it.iv !== undefined) art.iv = Number(it.iv);
          if (it.iva !== undefined) art.iva = Number(it.iva);
          if (it.m1 !== undefined) art.m1 = round2(it.m1);
          if (it.m2 !== undefined) art.m2 = round2(it.m2);
          if (it.pfid !== undefined) art.pfid = Math.max(1, Math.round(Number(it.pfid)));
        }
        if (Array.isArray(it.pr)) art.pr = it.pr;
        if (it.cf !== undefined) art.cf = String(it.cf || "");
        if (it.p !== undefined) art.p = Number(it.p);
        modifiedArts.push(art);
        updatedCount++;
      }
      const extraMeta: Record<string, unknown> = {};
      if (payload.supplierConfig && typeof payload.supplierConfig === "object") {
        const scProvId = String(payload.supplierConfig.proveedorId || "");
        if (scProvId) {
          if (!db.fpSupplierConfigs || typeof db.fpSupplierConfigs !== "object") {
            db.fpSupplierConfigs = {};
          }
          db.fpSupplierConfigs[scProvId] = payload.supplierConfig;
          extraMeta.fpSupplierConfigs = db.fpSupplierConfigs;
        }
      }
      return saveArticlesAndReply(
        "bulk_update_from_invoice",
        { updatedCount },
        { upserts: modifiedArts, extraMeta }
      );
    }

    if (postAction === "bulk_fix_negative_stock") {
      const items = Array.isArray(payload.items) ? payload.items : [];
      let fixed = 0;
      const modifiedArts: AnyObj[] = [];
      if (items.length > 0) {
        for (const it of items) {
          const art = db.articulos.find(
            (a: AnyObj) => Number(a.id) === Number(it.id || it.artId)
          );
          if (art) {
            art.sf = round3(it.sf ?? 0);
            modifiedArts.push(art);
            fixed++;
          }
        }
      } else {
        for (const art of db.articulos) {
          if (Number(art.sf || 0) < 0) {
            art.sf = 0;
            modifiedArts.push(art);
            fixed++;
          }
        }
      }
      return saveArticlesAndReply(
        "bulk_fix_negative_stock",
        { fixed },
        { upserts: modifiedArts }
      );
    }

    if (postAction === "save_article_supplier_code") {
      const id = Number(payload.articleId || payload.artId || payload.id || 0);
      const provId = Number(payload.proveedorId || 0);
      const codFab = String(payload.codProveedor || payload.cf || "")
        .trim()
        .toUpperCase();
      const art = db.articulos.find((a: AnyObj) => Number(a.id) === id);
      if (!art) {
        return NextResponse.json(
          { ok: false, message: "Artículo no encontrado" },
          { status: 404 }
        );
      }
      if (!Array.isArray(art.pr)) art.pr = [];
      const existing = art.pr.find((p: AnyObj) => Number(p.p) === provId);
      if (existing) existing.cf = codFab;
      else if (provId > 0) art.pr.push({ p: provId, cf: codFab });
      art.cf = codFab;
      return saveArticlesAndReply("save_article_supplier_code", { article: art }, { upserts: [art] });
    }

    if (postAction === "unlink_article_supplier_code") {
      const artId = Number(payload.articleId || payload.artId || payload.id || 0);
      const provId = Number(payload.proveedorId || 0);
      const codProv = String(payload.codProveedor || payload.cf || "")
        .trim()
        .toUpperCase();
      const unlinkedIds: number[] = [];
      const modifiedArts: AnyObj[] = [];
      for (const art of db.articulos) {
        const eId = Number(art.id || 0);
        const isTargetArt = artId > 0 && eId === artId;
        const eCf = String(art.cf || "").trim().toUpperCase();
        const prList: AnyObj[] = Array.isArray(art.pr) ? art.pr : [];
        let changed = false;

        if (isTargetArt) {
          if (!codProv || eCf === codProv || (provId > 0 && Number(art.p || 0) === provId)) {
            if (art.cf) {
              art.cf = "";
              changed = true;
            }
          }
          for (const prItem of prList) {
            const prCf = String(prItem.cf || "").trim().toUpperCase();
            const prP = Number(prItem.p || 0);
            if ((codProv && prCf === codProv) || (provId > 0 && prP === provId)) {
              if (prItem.cf) {
                prItem.cf = "";
                changed = true;
              }
            }
          }
        } else if (codProv) {
          if (eCf === codProv && (provId <= 0 || Number(art.p || 0) === provId)) {
            art.cf = "";
            changed = true;
          }
          for (const prItem of prList) {
            const prCf = String(prItem.cf || "").trim().toUpperCase();
            const prP = Number(prItem.p || 0);
            if (prCf === codProv && (provId <= 0 || prP === provId)) {
              prItem.cf = "";
              changed = true;
            }
          }
        }
        if (changed) {
          art.pr = prList;
          unlinkedIds.push(eId);
          modifiedArts.push(art);
        }
      }
      return saveArticlesAndReply(
        "unlink_article_supplier_code",
        { unlinkedIds },
        { upserts: modifiedArts }
      );
    }

    if (postAction === "create_rubro" || postAction === "save_rubro") {
      const nombre = String(payload.nombre || "")
        .trim()
        .toUpperCase();
      if (!nombre) {
        return NextResponse.json(
          { ok: false, message: "El nombre del rubro es obligatorio." },
          { status: 400 }
        );
      }
      const id = Number(payload.id || 0);
      if (id > 0) {
        const found = db.rubros.find((r: AnyObj) => Number(r.id) === id);
        if (found) {
          found.nombre = nombre;
          if (payload.codigo !== undefined) found.codigo = Number(payload.codigo);
          found.bl = payload.bl ? 1 : 0;
          return saveMetaKeysAndReply("save_rubro", { rubro: found }, { rubros: db.rubros });
        }
      }
      const dup = db.rubros.find(
        (r: AnyObj) => String(r.nombre || "").toUpperCase() === nombre
      );
      if (dup) {
        dup.bl = 0;
        return saveMetaKeysAndReply(
          "reactivate_rubro",
          { rubro: dup, alreadyExists: true },
          { rubros: db.rubros }
        );
      }
      const maxId = db.rubros.reduce(
        (m: number, r: AnyObj) => Math.max(m, Number(r.id || 0)),
        3
      );
      const maxCod = db.rubros.reduce(
        (m: number, r: AnyObj) => Math.max(m, Number(r.codigo || 0)),
        1
      );
      const newRubro = {
        id: maxId + 1,
        codigo: Number(payload.codigo || maxCod + 1),
        nombre,
        bl: 0,
      };
      db.rubros.push(newRubro);
      return saveMetaKeysAndReply("create_rubro", { rubro: newRubro }, { rubros: db.rubros });
    }

    if (postAction === "delete_rubro") {
      const id = Number(payload.id || 0);
      db.rubros = db.rubros.filter((r: AnyObj) => Number(r.id) !== id);
      return saveMetaKeysAndReply("delete_rubro", { deleted: true, id }, { rubros: db.rubros });
    }

    if (postAction === "create_marca" || postAction === "save_marca") {
      const nombre = String(payload.nombre || "")
        .trim()
        .toUpperCase();
      if (!nombre) {
        return NextResponse.json(
          { ok: false, message: "El nombre de la marca es obligatorio." },
          { status: 400 }
        );
      }
      const id = Number(payload.id || 0);
      if (id > 0) {
        const found = db.marcas.find((m: AnyObj) => Number(m.id) === id);
        if (found) {
          found.nombre = nombre;
          if (payload.codigo !== undefined) found.codigo = Number(payload.codigo);
          found.bl = payload.bl ? 1 : 0;
          return saveMetaKeysAndReply("save_marca", { marca: found }, { marcas: db.marcas });
        }
      }
      const dup = db.marcas.find(
        (m: AnyObj) => String(m.nombre || "").toUpperCase() === nombre
      );
      if (dup) {
        dup.bl = 0;
        return saveMetaKeysAndReply(
          "reactivate_marca",
          { marca: dup, alreadyExists: true },
          { marcas: db.marcas }
        );
      }
      const maxId = db.marcas.reduce(
        (mx: number, m: AnyObj) => Math.max(mx, Number(m.id || 0)),
        0
      );
      const newMarca = {
        id: maxId + 1,
        codigo: Number(payload.codigo || maxId + 1),
        nombre,
        bl: 0,
      };
      db.marcas.push(newMarca);
      return saveMetaKeysAndReply("create_marca", { marca: newMarca }, { marcas: db.marcas });
    }

    if (postAction === "delete_marca") {
      const id = Number(payload.id || 0);
      db.marcas = db.marcas.filter((m: AnyObj) => Number(m.id) !== id);
      return saveMetaKeysAndReply("delete_marca", { deleted: true, id }, { marcas: db.marcas });
    }

    if (postAction === "save_price_configs") {
      if (Array.isArray(payload.configuracionesPrecios)) {
        db.configuracionesPrecios = payload.configuracionesPrecios;
      }
      return saveMetaKeysAndReply(
        "save_price_configs",
        { configuracionesPrecios: db.configuracionesPrecios },
        { configuracionesPrecios: db.configuracionesPrecios }
      );
    }

    if (postAction === "save_gondola_queue") {
      db.gondolaQueue = payload.gondolaQueue ?? [];
      return saveMetaKeysAndReply(
        "save_gondola_queue",
        { gondolaQueue: db.gondolaQueue },
        { gondolaQueue: db.gondolaQueue }
      );
    }

    if (postAction === "bulk_set_carrito_web") {
      const ids = new Set(
        (Array.isArray(payload.ids) ? payload.ids : []).map((x: unknown) =>
          Number(x)
        )
      );
      const val = payload.cw ? 1 : 0;
      const modifiedArts: AnyObj[] = [];
      for (const art of db.articulos) {
        if (ids.has(Number(art.id))) {
          art.cw = val;
          modifiedArts.push(art);
        }
      }
      return saveArticlesAndReply(
        "bulk_set_carrito_web",
        { updated: ids.size },
        { upserts: modifiedArts }
      );
    }

    if (
      postAction === "bulk_set_canje_fidelizacion" ||
      postAction === "update_article_canje" ||
      postAction === "set_fidelizacion_catalog_config" ||
      postAction === "recalc_all_canje_points"
    ) {
      if (postAction === "update_article_canje") {
        const art = db.articulos.find(
          (a: AnyObj) => Number(a.id) === Number(payload.id || payload.artId)
        );
        if (art) {
          art.cfid = payload.cfid ? 1 : 0;
          if (payload.ptsCanje !== undefined) {
            art.pfid = Number(payload.ptsCanje);
            art.ptsCanje = Number(payload.ptsCanje);
          }
          return saveArticlesAndReply(
            "update_article_canje",
            { article: art },
            { upserts: [art] }
          );
        }
      }
      if (postAction === "bulk_set_canje_fidelizacion") {
        const ids = new Set(
          (Array.isArray(payload.ids) ? payload.ids : []).map((x: unknown) =>
            Number(x)
          )
        );
        const cfid = payload.cfid ? 1 : 0;
        const modifiedArts: AnyObj[] = [];
        for (const art of db.articulos) {
          if (ids.has(Number(art.id))) {
            art.cfid = cfid;
            modifiedArts.push(art);
          }
        }
        return saveArticlesAndReply(
          "bulk_set_canje_fidelizacion",
          {},
          { upserts: modifiedArts }
        );
      }
      if (postAction === "recalc_all_canje_points") {
        const factor = Number(payload.factorCanje || 1.12);
        for (const art of db.articulos) {
          if (Number(art.p1f || 0) > 0 && !art.pfidManual) {
            art.pfid = Math.max(1, Math.round(Number(art.p1f) * factor));
            art.ptsCanje = art.pfid;
          }
        }
      }
      return saveAndReply(postAction, {});
    }

    return NextResponse.json(
      { ok: false, message: `Acción desconocida: ${postAction}` },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { ok: false, message: "Método no permitido" },
    { status: 405 }
  );
}
