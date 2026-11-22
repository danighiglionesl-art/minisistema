#!/usr/bin/env node
/**
 * Script idempotente de migración y sincronización:
 *   Casa Nueva ERP (cn.com.ar)  -->  tenant "casanueva" (erp_casanueva)
 *   PaseoAlberdi.ar             -->  tenant "paseoalberdi" (erp_paseoalberdi)
 *
 * Uso:
 *   node scripts/migrate-children-to-minisistema.mjs
 *   node scripts/migrate-children-to-minisistema.mjs --tenant=casanueva
 *   node scripts/migrate-children-to-minisistema.mjs --tenant=paseoalberdi
 *   node scripts/migrate-children-to-minisistema.mjs --skip-media
 *
 * Seguro para ejecutar en Etapa 1 (pruebas paralelas sin afectar producción)
 * y re-ejecutar en Etapa 2 (corte definitivo a las 00:00 hs).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { createClient } = require("@supabase/supabase-js");

// ---------------------------------------------------------------------------
// 1. Cargar variables de entorno desde .env.local
// ---------------------------------------------------------------------------
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://ghrxmirhilrlveqyyscq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_ORbjp1JRY95Up_qfZ7atjw_SmcH6SYm";
const SERVICE_EMAIL =
  process.env.ERP_SUPABASE_SERVICE_EMAIL ||
  "erp-backend-service@minisistema.com.ar";
const SERVICE_PASSWORD = process.env.ERP_SUPABASE_SERVICE_PASSWORD || "";

if (!SERVICE_PASSWORD) {
  console.error(
    "ERROR: Falta ERP_SUPABASE_SERVICE_PASSWORD en .env.local o variables de entorno."
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Helpers criptográficos y de red
// ---------------------------------------------------------------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derivedKey}`;
}

async function fetchJson(url, label) {
  const sep = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${sep}_mig=${Date.now()}`;
  const res = await fetch(fullUrl, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al descargar ${label} (${url})`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(
      `JSON inválido en ${label} (${url}): ${err.message} — inicio: ${text.slice(0, 120)}`
    );
  }
}

async function fetchBinaryAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} descargando media ${url}`);
  }
  const contentType = (
    res.headers.get("content-type") || "image/jpeg"
  )
    .split(";")[0]
    .trim()
    .toLowerCase();
  const ab = await res.arrayBuffer();
  return {
    mime_type: contentType.startsWith("image/") ? contentType : "image/jpeg",
    data_b64: Buffer.from(ab).toString("base64"),
    size: ab.byteLength,
  };
}

/**
 * Lee mp_point_secret.php del repo hermano local Casa Nueva ERP sin exponer credenciales en git.
 */
function readLocalCasaNuevaMpPointConfig() {
  const secretPath = path.resolve(
    process.cwd(),
    "..",
    "Casa Nueva ERP",
    "sistema",
    "api",
    "mp_point_secret.php"
  );
  if (!fs.existsSync(secretPath)) {
    return null;
  }
  const php = fs.readFileSync(secretPath, "utf8");
  const tailIdx = php.indexOf("'user_id'       => '3");
  const slice = tailIdx >= 0 ? php.slice(tailIdx) : php;
  const pickStr = (key, src = slice) => {
    const m = src.match(new RegExp(`'${key}'\\s*=>\\s*'([^']*)'`));
    return m ? m[1] : "";
  };
  const pickCaja = (cajaKey) => {
    const re = new RegExp(`'${cajaKey}'\\s*=>\\s*\\[([\\s\\S]*?)\\]`);
    const m = slice.match(re);
    if (!m) {
      return {
        enabled: false,
        caja_nombre: cajaKey,
        terminal_id: "",
        serial_short: "",
        pos_id: 0,
        external_pos_id: "",
        label: "Sin terminal Point asignada",
      };
    }
    const block = m[1];
    const enabledM = block.match(/'enabled'\s*=>\s*(true|false)/);
    const posM = block.match(/'pos_id'\s*=>\s*(\d+)/);
    return {
      enabled: enabledM ? enabledM[1] === "true" : false,
      caja_nombre: pickStr("caja_nombre", block) || cajaKey,
      terminal_id: pickStr("terminal_id", block),
      serial_short: pickStr("serial_short", block),
      pos_id: posM ? Number(posM[1]) : 0,
      external_pos_id: pickStr("external_pos_id", block),
      label: pickStr("label", block),
    };
  };

  const accessToken = pickStr("access_token");
  if (!accessToken) return null;

  return {
    mode: "live",
    user_id: pickStr("user_id"),
    store_id: pickStr("store_id"),
    public_key: pickStr("public_key"),
    access_token: accessToken,
    client_id: pickStr("client_id"),
    client_secret: pickStr("client_secret"),
    cajas: {
      caja1: pickCaja("caja1"),
      caja2: pickCaja("caja2"),
      caja3: pickCaja("caja3"),
    },
    active_by_caja: {},
    orders: {},
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Lee los usuarios base de Casa Nueva / Paseo Alberdi desde auth.php hermano local
 * para conservar las contraseñas reales cuando la API pública list_users las oculta.
 */
function readLocalDefaultUsersMap(isPaseo) {
  const authPath = path.resolve(
    process.cwd(),
    "..",
    "Casa Nueva ERP",
    "sistema",
    "api",
    "auth.php"
  );
  if (!fs.existsSync(authPath)) return {};
  const php = fs.readFileSync(authPath, "utf8");
  const startMarker = isPaseo
    ? "$admins = $isPaseoBrand ? ["
    : "] : [";
  const startIdx = php.indexOf(startMarker);
  if (startIdx < 0) return {};
  const endIdx = isPaseo
    ? php.indexOf("] : [", startIdx)
    : php.indexOf("$customFile =", startIdx);
  const block = php.slice(startIdx, endIdx > startIdx ? endIdx : undefined);

  const map = {};
  const userRegex = /'([a-z0-9_.-]+)'\s*=>\s*\[([\s\S]*?)\n\s*\],/gi;
  let m;
  while ((m = userRegex.exec(block)) !== null) {
    const key = m[1].toLowerCase();
    const body = m[2];
    const pick = (k) => {
      const mm = body.match(new RegExp(`'${k}'\\s*=>\\s*'([^']*)'`));
      return mm ? mm[1] : "";
    };
    const pass = pick("pass");
    if (!pass) continue;
    map[key] = {
      username: key,
      pass,
      name: pick("name") || key,
      vendedor: pick("vendedor") || key.toUpperCase(),
      role: pick("role") || "Usuario",
      branch: pick("branch") || (isPaseo ? "Paseo Alberdi" : "Casa Central"),
      whatsapp: pick("whatsapp") || "",
    };
  }
  return map;
}

// ---------------------------------------------------------------------------
// 3. Definición de tenants hijos (Opción 1: Marca y Dominio Propios)
// ---------------------------------------------------------------------------
const RETAIL_ERP_MODULES = [
  "facturacion",
  "facturacion:caja1",
  "facturacion:caja2",
  "facturacion:caja3",
  "facturacion:facturador",
  "facturacion:recibo",
  "facturacion:apertura",
  "facturacion:retiro",
  "facturacion:cierre",
  "facturacion:movil",
  "facturacion:comprobantes",
  "facturacion:admin_arca",
  "articulos",
  "articulos:listado",
  "articulos:nuevo",
  "articulos:duplicar",
  "articulos:config_precios",
  "articulos:abm_marcas",
  "articulos:abm_rubros",
  "articulos:factura_prov",
  "articulos:carga_rapida",
  "articulos:control_stock",
  "articulos:precios_gondola",
  "articulos:ofertas",
  "articulos:pedidos",
  "clientes",
  "clientes:padron",
  "clientes:nuevo",
  "clientes:ctacte",
  "clientes:detalle_ctacte",
  "proveedores",
  "proveedores:padron",
  "proveedores:nuevo",
  "proveedores:ctacte",
  "proveedores:duales",
  "proveedores:factura_prov",
  "proveedores:carga_rapida",
  "proveedores:control_stock",
  "proveedores:precios_gondola",
  "proveedores:pedidos",
  "fondos",
  "fondos:caja_central",
  "fondos:caja",
  "fondos:bancos",
  "fondos:stock_valorizado",
  "carrito",
  "carrito:usuarios",
  "carrito:articulos",
  "carrito:banners",
  "carrito:reg_online",
  "carrito:abrir_tienda",
  "fidelizacion",
  "fidelizacion:operaciones",
  "fidelizacion:catalogo",
  "fidelizacion:clientes",
  "fidelizacion:config",
  "whatsapp",
  "estadisticas",
  "estadisticas:facturacion",
  "estadisticas:ranking",
  "estadisticas:medios",
  "estadisticas:margenes",
  "mi_contador",
  "mi_contador:dashboard",
  "mi_contador:calendario",
  "mi_contador:ventas_iva",
  "mi_contador:compras_iva",
  "mi_contador:gastos_retiros",
  "mi_contador:retenciones",
  "mi_contador:posiciones",
  "mi_contador:monotributo",
  "mi_contador:exportacion_arca",
  "mi_contador:alertas",
  "mi_contador:rentabilidad",
  "mi_contador:config",
  "verificador",
  "personal",
  "personal:cv",
  "personal:asistencia",
  "cv",
  "cv:postulaciones",
  "cv:config_tablas",
  "cv:portal",
  "asistencia",
  "tema",
  "perfil",
  "atajos",
  "manual_usuario",
];

const TENANT_SPECS = {
  casanueva: {
    slug: "casanueva",
    db_schema: "erp_casanueva",
    sourceOrigin: "https://www.cn.com.ar",
    sourcePrefix: "",
    apiBase: "https://www.cn.com.ar/sistema/api",
    isPaseo: false,
    record: {
      slug: "casanueva",
      option_type: 1,
      is_base: false,
      business_name: "BIANCHI MARIA ESTHER",
      fantasy_name: "Casa Nueva Supermercado",
      custom_domain: "www.cn.com.ar",
      db_schema: "erp_casanueva",
      external_supabase_url: null,
      external_supabase_key: null,
      status: "active",
      branding: {
        primaryHex: "#202020",
        accentHex: "#d4a017",
        surfaceHex: "#FFFFFF",
        logo1x1Url: "/sistema/assets/img/logo-full.png",
        logoHorizontalUrl: "/sistema/assets/img/logo-full.png",
        logoSymbolUrl: "/sistema/assets/img/icon-192.png",
        clubName: "Club Fidel",
        address: "Riveros Gigena N° 50 - Alcira Gigena (Córdoba)",
        localidad: "ALCIRA GIGENA",
        provincia: "CÓRDOBA",
        cp: "5813",
        whatsappDigits: "5493584198605",
        whatsappDisplay: "+54 9 3584 19-8605",
        emailInfo: "ventas@cn.com.ar",
        cuitFmt: "27-05457050-9",
        condIva: "IVA RESPONSABLE INSCRIPTO",
        iibb: "288462551",
        inicioAct: "02/03/2026",
      },
      enabled_modules: RETAIL_ERP_MODULES,
      subscription: {
        optionBasePrice: 0,
        selectedModules: [],
        globalDiscountType: "permanent",
        globalDiscountPct: 100,
        globalDiscountFixed: 0,
        temporaryMonths: 0,
        promoStartsAt: null,
        promoEndsAt: null,
        monthlyRegularAmount: 0,
        monthlyPromoAmount: 0,
        activeMonthlyAmount: 0,
        currency: "ARS",
        mpStatus: "authorized",
        mpPreapprovalId: null,
        mpInitPoint: null,
        payerEmail: "ventas@cn.com.ar",
        lastSyncAt: new Date().toISOString(),
      },
      deployment: {
        mode: "custom_domain",
        actividadNegocio: "comercial",
        publicErpUrl: "https://www.cn.com.ar/sistema",
        publicCarritoUrl: "https://www.cn.com.ar/carrito",
        publicVerificadorUrl: "https://www.cn.com.ar/verificador",
        githubRepoUrl: null,
        vercelProjectId: "prj_DwQTRgpPgTyuhHGbsAlezTNTvcFE",
        vercelDomainVerified: false,
        dnsInstructions: [
          { type: "A", host: "@", value: "76.76.21.21" },
          { type: "CNAME", host: "www", value: "cname.vercel-dns.com" },
        ],
        provisionedAt: new Date().toISOString(),
        notes:
          "Instancia hija oficial del ecosistema MiniSistema (Opción 1). URL de pruebas paralelas: https://www.minisistema.com.ar/casanueva",
      },
    },
  },
  paseoalberdi: {
    slug: "paseoalberdi",
    db_schema: "erp_paseoalberdi",
    sourceOrigin: "https://www.cn.com.ar",
    sourcePrefix: "/_paseoalberdi",
    apiBase: "https://www.cn.com.ar/_paseoalberdi/sistema/api",
    isPaseo: true,
    record: {
      slug: "paseoalberdi",
      option_type: 1,
      is_base: false,
      business_name: "Paseo Alberdi Supermercado",
      fantasy_name: "Paseo Alberdi",
      custom_domain: "www.paseoalberdi.ar",
      db_schema: "erp_paseoalberdi",
      external_supabase_url: null,
      external_supabase_key: null,
      status: "active",
      branding: {
        primaryHex: "#1C1B1E",
        accentHex: "#BDF200",
        surfaceHex: "#FFFFFF",
        logo1x1Url: "/sistema/assets/img/paseo-alberdi/logo-1x1.png",
        logoHorizontalUrl: "/sistema/assets/img/paseo-alberdi/logo-horizontal.png",
        logoSymbolUrl: "/sistema/assets/img/paseo-alberdi/logo-symbol.png",
        clubName: "Club Fidel",
        address: "Ignacio Pirovano 193, Barrio Alberdi, Río Cuarto",
        localidad: "RÍO CUARTO",
        provincia: "CÓRDOBA",
        cp: "5800",
        whatsappDigits: "5493584292027",
        whatsappDisplay: "+54 9 3584 29-2027",
        emailInfo: "ventas@paseoalberdi.ar",
        cuitFmt: "A CONFIGURAR",
        condIva: "IVA RESPONSABLE INSCRIPTO",
        iibb: "—",
        inicioAct: "—",
      },
      enabled_modules: RETAIL_ERP_MODULES,
      subscription: {
        optionBasePrice: 0,
        selectedModules: [],
        globalDiscountType: "permanent",
        globalDiscountPct: 100,
        globalDiscountFixed: 0,
        temporaryMonths: 0,
        promoStartsAt: null,
        promoEndsAt: null,
        monthlyRegularAmount: 0,
        monthlyPromoAmount: 0,
        activeMonthlyAmount: 0,
        currency: "ARS",
        mpStatus: "authorized",
        mpPreapprovalId: null,
        mpInitPoint: null,
        payerEmail: "ventas@paseoalberdi.ar",
        lastSyncAt: new Date().toISOString(),
      },
      deployment: {
        mode: "custom_domain",
        actividadNegocio: "comercial",
        publicErpUrl: "https://www.paseoalberdi.ar/sistema",
        publicCarritoUrl: "https://www.paseoalberdi.ar/carrito",
        publicVerificadorUrl: "https://www.paseoalberdi.ar/verificador",
        githubRepoUrl: null,
        vercelProjectId: "prj_DwQTRgpPgTyuhHGbsAlezTNTvcFE",
        vercelDomainVerified: false,
        dnsInstructions: [
          { type: "A", host: "@", value: "76.76.21.21" },
          { type: "CNAME", host: "www", value: "cname.vercel-dns.com" },
        ],
        provisionedAt: new Date().toISOString(),
        notes:
          "Instancia hija oficial del ecosistema MiniSistema (Opción 1). URL de pruebas paralelas: https://www.minisistema.com.ar/paseoalberdi",
      },
    },
  },
};

// ---------------------------------------------------------------------------
// 4. Conexión autenticada con Supabase
// ---------------------------------------------------------------------------
async function createAuthedSupabase() {
  const baseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await baseClient.auth.signInWithPassword({
    email: SERVICE_EMAIL,
    password: SERVICE_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(
      `No se pudo autenticar en Supabase (${SERVICE_EMAIL}): ${error?.message || "sin sesión"}`
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    },
  });
}

async function putDoc(sb, schema, docKey, payload, action = "migrate_sync") {
  const { data, error } = await sb.rpc("erp_put_doc", {
    p_schema: schema,
    p_doc_key: docKey,
    p_payload: payload,
    p_actor: "danielg",
    p_action: action,
  });
  if (error) {
    throw new Error(`erp_put_doc(${schema}, ${docKey}) falló: ${error.message}`);
  }
  return data;
}

async function putMedia(sb, schema, media) {
  const { error } = await sb.rpc("erp_media_op", {
    p_schema: schema,
    p_op: "put",
    p_payload: media,
  });
  if (error) {
    throw new Error(
      `erp_media_op(${schema}, ${media.media_key}) falló: ${error.message}`
    );
  }
}

async function upsertUser(sb, schema, userPayload) {
  const { error } = await sb.rpc("erp_users_op", {
    p_schema: schema,
    p_op: "upsert",
    p_payload: userPayload,
  });
  if (error) {
    throw new Error(
      `erp_users_op(${schema}, ${userPayload.username}) falló: ${error.message}`
    );
  }
}

// ---------------------------------------------------------------------------
// 5. Migración de un tenant completo
// ---------------------------------------------------------------------------
async function migrateTenant(sb, spec, options) {
  const t0 = Date.now();
  const { slug, db_schema, apiBase, sourceOrigin, sourcePrefix, isPaseo } = spec;
  console.log(`\n============================================================`);
  console.log(`MIGRANDO TENANT: ${slug.toUpperCase()} (${db_schema})`);
  console.log(`Origen vivo: ${apiBase}`);
  console.log(`============================================================`);

  // A. Upsert registro en erp_tenants
  const { error: upsertTenantErr } = await sb
    .from("erp_tenants")
    .upsert(spec.record, { onConflict: "slug" });
  if (upsertTenantErr) {
    throw new Error(
      `Error registrando tenant ${slug} en erp_tenants: ${upsertTenantErr.message}`
    );
  }
  console.log(`  [OK] Registro erp_tenants actualizado (${slug} -> ${spec.record.custom_domain})`);

  // B. Aprovisionar esquema PostgreSQL aislado (idempotente)
  const { error: provErr } = await sb.rpc("erp_provision_tenant_schema", {
    p_schema: db_schema,
    p_seed_docs: {},
    p_seed_users: [],
  });
  if (provErr) {
    throw new Error(`Error aprovisionando esquema ${db_schema}: ${provErr.message}`);
  }
  console.log(`  [OK] Esquema aislado ${db_schema} verificado`);

  // C. Descargar snapshot en vivo de las APIs de producción
  console.log(`  [..] Descargando bases de datos en vivo...`);
  const [
    catalogDb,
    clientesDb,
    ventasDb,
    ofertasRaw,
    pedidosRaw,
    bannersRaw,
    arcaRaw,
    usersRaw,
    atajosRaw,
  ] = await Promise.all([
    fetchJson(`${apiBase}/catalog.php`, `${slug}/catalog_db`),
    fetchJson(`${apiBase}/clientes.php?action=all`, `${slug}/clientes_db`),
    fetchJson(`${apiBase}/ventas.php`, `${slug}/ventas_db`),
    fetchJson(`${apiBase}/ofertas.php`, `${slug}/ofertas_db`).catch(() => ({ ofertas: [] })),
    fetchJson(`${apiBase}/pedidos_proveedores.php`, `${slug}/pedidos_proveedores`).catch(() => ({ items: [] })),
    fetchJson(`${apiBase}/banners.php?action=admin_list`, `${slug}/banners_homepage`).catch(() => ({ items: [], popups: [], appCarousel: [] })),
    fetchJson(`${apiBase}/arca_comprobantes.php`, `${slug}/arca_comprobantes_db`).catch(() => ({ comprobantes: [], auditoria: [] })),
    fetchJson(`${apiBase}/auth.php?action=list_users`, `${slug}/users`).catch(() => ({ users: {} })),
    fetchJson(`${apiBase}/auth.php?action=get_global_atajos`, `${slug}/atajos`).catch(() => ({ atajos: {} })),
  ]);

  const stats = {
    articulos: Array.isArray(catalogDb?.articulos) ? catalogDb.articulos.length : 0,
    rubros: Array.isArray(catalogDb?.rubros) ? catalogDb.rubros.length : 0,
    marcas: Array.isArray(catalogDb?.marcas) ? catalogDb.marcas.length : 0,
    clientes: Array.isArray(clientesDb?.clientes) ? clientesDb.clientes.length : 0,
    movsCtaCte: Array.isArray(clientesDb?.movimientosCtaCte) ? clientesDb.movimientosCtaCte.length : 0,
    dailySales: Array.isArray(ventasDb?.dailyRecords) ? ventasDb.dailyRecords.length : 0,
    cierresCaja: Array.isArray(ventasDb?.cierresCajaCentral) ? ventasDb.cierresCajaCentral.length : 0,
    arcaComprobantes: Array.isArray(arcaRaw?.comprobantes) ? arcaRaw.comprobantes.length : 0,
    ofertas: Array.isArray(ofertasRaw?.ofertas) ? ofertasRaw.ofertas.length : 0,
    pedidosProv: Array.isArray(pedidosRaw?.items) ? pedidosRaw.items.length : 0,
    banners: Array.isArray(bannersRaw?.items) ? bannersRaw.items.length : 0,
    popups: Array.isArray(bannersRaw?.popups) ? bannersRaw.popups.length : 0,
    mediaMigrated: 0,
    usersMigrated: 0,
    mpTerminals: 0,
  };

  console.log(
    `  [OK] Snapshot descargado: ${stats.articulos} arts, ${stats.clientes} clientes, ` +
      `${stats.dailySales} días ventas, ${stats.arcaComprobantes} comprobantes ARCA, ` +
      `${stats.ofertas} ofertas, ${stats.banners} banners, ${stats.popups} popups`
  );

  // D. Migrar imágenes de banners, popups y productos locales a Supabase Media
  const mediaUploaded = new Set();
  const migrateImageUrl = async (rawUrl, category, fallbackName) => {
    const u = String(rawUrl || "").trim();
    if (!u || options.skipMedia) return u;

    let downloadUrl = "";
    let mediaKey = "";

    if (u.includes("/sistema/assets/banners/")) {
      const cleanPath = u.split("?")[0];
      mediaKey = path.basename(cleanPath);
      downloadUrl = `${sourceOrigin}${sourcePrefix}/sistema/assets/banners/${encodeURIComponent(mediaKey)}`;
    } else if (u.includes("cn.com.ar/backend/public/storage/images/productos/")) {
      const cleanPath = u.split("?")[0];
      const base = path.basename(cleanPath).replace(/[^a-zA-Z0-9._-]/g, "_");
      mediaKey = `cn_hero_${base}`;
      downloadUrl = u;
    } else if (u.startsWith("assets/products/") || u.includes("/sistema/assets/products/")) {
      const cleanPath = u.split("?")[0];
      mediaKey = path.basename(cleanPath);
      downloadUrl = `${sourceOrigin}${sourcePrefix}/sistema/assets/products/${encodeURIComponent(mediaKey)}`;
    } else {
      return u;
    }

    if (!mediaKey) mediaKey = fallbackName;

    try {
      if (!mediaUploaded.has(mediaKey)) {
        const bin = await fetchBinaryAsBase64(downloadUrl);
        await putMedia(sb, db_schema, {
          media_key: mediaKey,
          category,
          mime_type: bin.mime_type,
          data_b64: bin.data_b64,
        });
        mediaUploaded.add(mediaKey);
        stats.mediaMigrated++;
      }
      return `/sistema/assets/${category}/${mediaKey}?tenant=${encodeURIComponent(slug)}`;
    } catch (err) {
      console.warn(`    [WARN] No se pudo migrar media ${u}: ${err.message}`);
      return u;
    }
  };

  if (!options.skipMedia) {
    for (const listKey of ["items", "popups", "appCarousel"]) {
      const list = Array.isArray(bannersRaw?.[listKey]) ? bannersRaw[listKey] : [];
      for (const item of list) {
        if (item?.imageUrl) {
          item.imageUrl = await migrateImageUrl(
            item.imageUrl,
            "banners",
            `${listKey}_${item.id || Date.now()}.png`
          );
        }
      }
    }

    if (Array.isArray(catalogDb?.articulos)) {
      for (const art of catalogDb.articulos) {
        const im = String(art?.im || "").trim();
        if (im && (im.startsWith("assets/products/") || im.includes("/sistema/assets/products/"))) {
          art.im = await migrateImageUrl(im, "products", `prod_${art.id || Date.now()}.jpg`);
        }
      }
    }
    console.log(`  [OK] Media migrada a Supabase (${stats.mediaMigrated} archivos)`);
  }

  // E. Guardar documentos JSON en el esquema aislado de Supabase
  const docsToSave = [
    ["catalog_db", catalogDb],
    ["clientes_db", clientesDb],
    ["ventas_db", ventasDb],
    [
      "ofertas_db",
      {
        updatedAt: ofertasRaw?.updatedAt || new Date().toISOString(),
        ofertas: Array.isArray(ofertasRaw?.ofertas) ? ofertasRaw.ofertas : [],
      },
    ],
    [
      "pedidos_proveedores",
      {
        updatedAt: pedidosRaw?.updatedAt || new Date().toISOString(),
        lastSeq: Number(pedidosRaw?.lastSeq || 0),
        items: Array.isArray(pedidosRaw?.items) ? pedidosRaw.items : [],
      },
    ],
    [
      "banners_homepage",
      {
        intervalSec: Number(bannersRaw?.intervalSec || 5),
        recommendedSize: bannersRaw?.recommendedSize || "1530x370",
        popupDurationSec: Number(bannersRaw?.popupDurationSec || 6),
        popupRecommendedSize: bannersRaw?.popupRecommendedSize || "1080x1350",
        appCarouselIntervalSec: Number(bannersRaw?.appCarouselIntervalSec || 4),
        appCarouselRecommendedSize: bannersRaw?.appCarouselRecommendedSize || "1080x360",
        appCarouselMaxItems: Number(bannersRaw?.appCarouselMaxItems || 10),
        updatedAt: bannersRaw?.updatedAt || new Date().toISOString(),
        items: Array.isArray(bannersRaw?.items) ? bannersRaw.items : [],
        popups: Array.isArray(bannersRaw?.popups) ? bannersRaw.popups : [],
        appCarousel: Array.isArray(bannersRaw?.appCarousel) ? bannersRaw.appCarousel : [],
      },
    ],
    [
      "arca_comprobantes_db",
      {
        updatedAt: new Date().toISOString(),
        servicioArcaEstado: arcaRaw?.servicioArcaEstado || "online",
        certificado: arcaRaw?.certificado || null,
        comprobantes: Array.isArray(arcaRaw?.comprobantes) ? arcaRaw.comprobantes : [],
        auditoria: Array.isArray(arcaRaw?.auditoria) ? arcaRaw.auditoria : [],
      },
    ],
  ];

  // Atajos globales en users_custom
  if (atajosRaw?.atajos && Object.keys(atajosRaw.atajos).length > 0) {
    docsToSave.push([
      "users_custom",
      {
        _global_atajos: {
          map: atajosRaw.atajos,
          updatedBy: atajosRaw.updatedBy || "danielg",
          updatedAt: atajosRaw.updatedAt || new Date().toISOString(),
        },
      },
    ]);
  }

  // Configuración real de Mercado Pago Point para Casa Nueva (desde secreto local, nunca en git)
  if (slug === "casanueva") {
    const mpCfg = readLocalCasaNuevaMpPointConfig();
    if (mpCfg) {
      docsToSave.push(["mp_point_db", mpCfg]);
      stats.mpTerminals = Object.values(mpCfg.cajas).filter((c) => c.enabled && c.terminal_id).length;
      console.log(
        `  [OK] Credenciales reales Mercado Pago Point cargadas (${stats.mpTerminals} terminales Newland N950 activas)`
      );
    } else {
      console.warn(`  [WARN] No se encontró mp_point_secret.php local; mp_point_db queda sin cambios.`);
    }
  }

  for (const [docKey, payload] of docsToSave) {
    const sizeKb = Math.round(Buffer.byteLength(JSON.stringify(payload), "utf8") / 1024);
    process.stdout.write(`  [..] Guardando ${docKey} (${sizeKb} KB)... `);
    const res = await putDoc(sb, db_schema, docKey, payload, "migrate_etapa1");
    console.log(`OK (rev ${res?.rev ?? "?"})`);
  }

  // F. Migrar usuarios ERP (conservando hashes, roles, módulos y asegurando @danielg como Admin General)
  const localDefaults = readLocalDefaultUsersMap(isPaseo);
  const liveUsersObj =
    usersRaw?.users && typeof usersRaw.users === "object" ? usersRaw.users : {};
  const mergedUsers = new Map();

  // 1) Base desde defaults locales (tiene las contraseñas originales reales)
  for (const [uKey, u] of Object.entries(localDefaults)) {
    mergedUsers.set(uKey.toLowerCase(), { ...u });
  }
  // 2) Sobreescribir con usuarios vivos de producción (módulos actualizados, avatares, usuarios nuevos)
  for (const [rawKey, u] of Object.entries(liveUsersObj)) {
    if (!u || typeof u !== "object") continue;
    const uKey = String(u.username || rawKey).trim().toLowerCase();
    if (!uKey) continue;
    const prev = mergedUsers.get(uKey) || {};
    mergedUsers.set(uKey, {
      ...prev,
      ...u,
      username: uKey,
      pass: (u.pass && String(u.pass).trim()) || prev.pass || "Casa1234",
    });
  }

  // 3) Garantizar siempre @danielg como Administrador General en todos los tenants hijos
  const existingDaniel = mergedUsers.get("danielg") || {};
  mergedUsers.set("danielg", {
    ...existingDaniel,
    username: "danielg",
    pass: existingDaniel.pass || "Dani1926",
    name: "Daniel G.",
    vendedor: "GHIGLIONE DANIEL ALEJANDRO",
    role: "Administrador General",
    branch: spec.record.fantasy_name,
    whatsapp: existingDaniel.whatsapp || "+5493585095475",
    avatar: existingDaniel.avatar || "",
    modules: RETAIL_ERP_MODULES,
    active: true,
  });

  for (const [uKey, u] of mergedUsers.entries()) {
    const role =
      uKey === "danielg"
        ? "Administrador General"
        : String(u.role || "").toLowerCase().includes("admin")
          ? "Administrador"
          : "Usuario";
    const passPlain = String(u.pass || "Casa1234");
    const mods =
      Array.isArray(u.modules) && u.modules.length > 0
        ? Array.from(new Set([...u.modules, "perfil", "tema", "atajos", "manual_usuario"]))
        : RETAIL_ERP_MODULES;

    await upsertUser(sb, db_schema, {
      username: uKey,
      password_hash: hashPassword(passPlain),
      plain_compat: passPlain,
      name: String(u.name || uKey),
      vendedor: String(u.vendedor || u.name || uKey).toUpperCase(),
      role,
      branch: String(u.branch || spec.record.fantasy_name),
      whatsapp: String(u.whatsapp || ""),
      avatar: String(u.avatar || ""),
      modules: mods,
      active: u.active !== false,
      cajaAbierta: null,
      cajaAbiertaAt: null,
      actor: "danielg",
    });
    stats.usersMigrated++;
  }
  console.log(`  [OK] ${stats.usersMigrated} usuarios migrados (${Array.from(mergedUsers.keys()).join(", ")})`);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  [LISTO] ${slug} completado en ${elapsed}s`);
  return { slug, elapsedSec: Number(elapsed), ...stats };
}

// ---------------------------------------------------------------------------
// 6. Main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const tenantArg =
    args.find((a) => a.startsWith("--tenant="))?.split("=")[1]?.toLowerCase() || "all";
  const skipMedia = args.includes("--skip-media");

  const targets =
    tenantArg === "all"
      ? [TENANT_SPECS.casanueva, TENANT_SPECS.paseoalberdi]
      : TENANT_SPECS[tenantArg]
        ? [TENANT_SPECS[tenantArg]]
        : null;

  if (!targets) {
    console.error(`Tenant desconocido: "${tenantArg}". Usá casanueva, paseoalberdi o all.`);
    process.exit(1);
  }

  const sb = await createAuthedSupabase();
  const report = [];
  for (const spec of targets) {
    const res = await migrateTenant(sb, spec, { skipMedia });
    report.push(res);
  }

  console.log(`\n==================== RESUMEN FINAL ====================`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error("\n[ERROR FATAL MIGRACIÓN]", err);
  process.exit(1);
});
