#!/usr/bin/env node
/**
 * Migra de forma concurrente, idempotente y reanudable todas las imágenes
 * históricas de productos alojadas en https://apisinergial.cn.com.ar/Imagenes/
 * hacia el bucket público CDN de Supabase Storage: "erp-product-images".
 *
 * Uso:
 *   node scripts/migrate-sinergial-images.mjs
 *   node scripts/migrate-sinergial-images.mjs --concurrency=24
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { createClient } = require("@supabase/supabase-js");

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
    if (!process.env[key]) process.env[key] = val;
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
const BUCKET = "erp-product-images";
const SOURCE_BASE = "https://apisinergial.cn.com.ar/Imagenes/";

if (!SERVICE_PASSWORD) {
  console.error("ERROR: Falta ERP_SUPABASE_SERVICE_PASSWORD en .env.local.");
  process.exit(1);
}

let cachedSb = null;
let tokenExpiresAt = 0;

async function getSupabase() {
  if (cachedSb && Date.now() < tokenExpiresAt - 180_000) {
    return cachedSb;
  }
  const base = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await base.auth.signInWithPassword({
    email: SERVICE_EMAIL,
    password: SERVICE_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`Error autenticando en Supabase: ${error?.message || "sin sesión"}`);
  }
  tokenExpiresAt = data.session.expires_at
    ? data.session.expires_at * 1000
    : Date.now() + 50 * 60 * 1000;
  cachedSb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    },
  });
  return cachedSb;
}

async function listExistingObjects(sb) {
  const existing = new Set();
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await sb.storage.from(BUCKET).list("", {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      throw new Error(`Error listando bucket ${BUCKET}: ${error.message}`);
    }
    if (!Array.isArray(data) || data.length === 0) break;
    for (const item of data) {
      if (item?.name) existing.add(item.name);
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return existing;
}

function extractSinergialFilename(rawIm) {
  const s = String(rawIm || "").trim();
  if (!s) return null;
  if (/^https?:\/\/apisinergial\.cn\.com\.ar\/Imagenes\//i.test(s)) {
    return s.replace(/^https?:\/\/apisinergial\.cn\.com\.ar\/Imagenes\//i, "").split("?")[0].trim() || null;
  }
  if (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("/") ||
    s.startsWith("data:") ||
    s.startsWith("assets/")
  ) {
    return null;
  }
  return s.split("?")[0].trim() || null;
}

async function collectAllSinergialFilenames(sb) {
  const unique = new Set();
  const schemas = ["erp_casanueva", "erp_paseoalberdi"];
  for (const schema of schemas) {
    const { data, error } = await sb.rpc("erp_get_doc", {
      p_schema: schema,
      p_doc_key: "catalog_db",
    });
    if (error || !data?.payload) {
      console.warn(`  [WARN] No se pudo leer catalog_db de ${schema}: ${error?.message || "vacío"}`);
      continue;
    }
    const arts = Array.isArray(data.payload.articulos) ? data.payload.articulos : [];
    let count = 0;
    for (const a of arts) {
      const fn = extractSinergialFilename(a?.im);
      if (fn) {
        unique.add(fn);
        count++;
      }
    }
    console.log(`  [OK] ${schema}: ${arts.length} artículos analizados -> ${count} refs Sinergial`);
  }
  return Array.from(unique).sort();
}

async function downloadWithRetry(filename, retries = 2) {
  const url = `${SOURCE_BASE}${encodeURIComponent(filename)}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 404) {
        return { status: 404, buf: null, contentType: "" };
      }
      if (!res.ok) {
        if (attempt === retries) {
          return { status: res.status, buf: null, contentType: "", error: `HTTP ${res.status}` };
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      const ab = await res.arrayBuffer();
      let ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!ct.startsWith("image/")) {
        const lower = filename.toLowerCase();
        ct = lower.endsWith(".png")
          ? "image/png"
          : lower.endsWith(".webp")
            ? "image/webp"
            : lower.endsWith(".gif")
              ? "image/gif"
              : "image/jpeg";
      }
      return { status: 200, buf: Buffer.from(ab), contentType: ct };
    } catch (err) {
      if (attempt === retries) {
        return {
          status: 0,
          buf: null,
          contentType: "",
          error: err instanceof Error ? err.message : "network error",
        };
      }
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return { status: 0, buf: null, contentType: "", error: "exhausted retries" };
}

async function uploadWithRetry(filename, buf, contentType, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const sb = await getSupabase();
      const { error } = await sb.storage.from(BUCKET).upload(filename, buf, {
        contentType,
        cacheControl: "31536000",
        upsert: true,
      });
      if (!error) return { ok: true };
      if (attempt === retries) return { ok: false, error: error.message };
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    } catch (err) {
      if (attempt === retries) {
        return { ok: false, error: err instanceof Error ? err.message : "upload error" };
      }
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return { ok: false, error: "exhausted upload retries" };
}

async function main() {
  const t0 = Date.now();
  const concArg = process.argv.find((a) => a.startsWith("--concurrency="));
  const concurrency = Math.max(1, Math.min(32, Number(concArg?.split("=")[1] || 20)));

  console.log("============================================================");
  console.log(`MIGRACIÓN DE IMÁGENES SINERGIAL -> SUPABASE STORAGE (${BUCKET})`);
  console.log(`Concurrencia: ${concurrency} workers`);
  console.log("============================================================");

  const sb = await getSupabase();
  const allFiles = await collectAllSinergialFilenames(sb);
  const existing = await listExistingObjects(sb);

  const pending = allFiles.filter((f) => !existing.has(f));
  console.log(
    `Total únicas: ${allFiles.length} | Ya migradas: ${existing.size} | Pendientes: ${pending.length}`
  );

  if (pending.length === 0) {
    console.log("¡Todas las imágenes ya estaban migradas en Supabase Storage!");
    return;
  }

  let cursor = 0;
  let processed = 0;
  let uploaded = 0;
  let notFound404 = 0;
  let failed = 0;
  let totalBytes = 0;
  const failedList = [];

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= pending.length) return;
      const filename = pending[idx];

      const dl = await downloadWithRetry(filename);
      if (dl.status === 404) {
        notFound404++;
      } else if (!dl.buf || dl.buf.byteLength === 0) {
        failed++;
        if (failedList.length < 30) failedList.push(`${filename}: ${dl.error || "empty"}`);
      } else {
        const up = await uploadWithRetry(filename, dl.buf, dl.contentType);
        if (up.ok) {
          uploaded++;
          totalBytes += dl.buf.byteLength;
        } else {
          failed++;
          if (failedList.length < 30) failedList.push(`${filename}: ${up.error}`);
        }
      }

      processed++;
      if (processed % 250 === 0 || processed === pending.length) {
        const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
        const mb = (totalBytes / (1024 * 1024)).toFixed(1);
        const pct = ((processed / pending.length) * 100).toFixed(1);
        console.log(
          `  [${pct}%] ${processed}/${pending.length} | OK: ${uploaded} (${mb} MB) | 404: ${notFound404} | Err: ${failed} | ${elapsedSec}s`
        );
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n==================== RESUMEN IMÁGENES ====================");
  console.log(
    JSON.stringify(
      {
        bucket: BUCKET,
        publicBaseUrl: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`,
        totalUnique: allFiles.length,
        alreadyExisted: existing.size,
        uploadedNow: uploaded,
        notFound404,
        failed,
        uploadedMb: Number((totalBytes / (1024 * 1024)).toFixed(2)),
        elapsedSec: Number(totalSec),
        sampleErrors: failedList.slice(0, 10),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("[ERROR FATAL]", err);
  process.exit(1);
});
