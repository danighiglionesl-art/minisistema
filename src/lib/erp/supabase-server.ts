import zlib from "node:zlib";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ErpTenantRecord, ErpUserRecord } from "./types";

const HEAVY_DOC_KEYS = new Set([
  "catalog_db",
  "clientes_db",
  "ventas_db",
  "arca_comprobantes_db",
]);
const DOC_CACHE_BUCKET = "erp-doc-cache";
const META_TRUST_MS = 15_000;
const STATUS_CACHE_MS = 8_000;

interface DocCacheEntry {
  payload?: unknown;
  gzBuf?: Buffer;
  rev: number;
  updatedAt: string;
  checkedAt: number;
}

const docMemoryCache = new Map<string, DocCacheEntry>();
const inFlightDocReads = new Map<
  string,
  Promise<{ payload?: unknown; gzBuf?: Buffer; rev: number; updatedAt: string }>
>();
const statusMemoryCache = new Map<
  string,
  { value: Record<string, any>; expiresAt: number }
>();
const inFlightStatusReads = new Map<string, Promise<Record<string, any>>>();

interface CachedAuthClient {
  client: SupabaseClient;
  expiresAtMs: number;
}

let cachedPrimaryClient: CachedAuthClient | null = null;
let pendingPrimaryAuth: Promise<SupabaseClient> | null = null;
const externalClientsCache = new Map<string, SupabaseClient>();

function cleanEnvStr(val: string | undefined | null): string {
  return String(val || "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF\r\n]/g, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function getSupabaseEnv() {
  const url =
    cleanEnvStr(process.env.SUPABASE_URL) || "https://ghrxmirhilrlveqyyscq.supabase.co";
  const serviceRoleKey =
    cleanEnvStr(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    cleanEnvStr(process.env.SUPABASE_SECRET_KEY) ||
    "";
  const key =
    cleanEnvStr(process.env.SUPABASE_PUBLISHABLE_KEY) ||
    "sb_publishable_ORbjp1JRY95Up_qfZ7atjw_SmcH6SYm";
  const email =
    cleanEnvStr(process.env.ERP_SUPABASE_SERVICE_EMAIL) ||
    "erp-backend-service@minisistema.com.ar";
  const password = cleanEnvStr(process.env.ERP_SUPABASE_SERVICE_PASSWORD);
  return { url, serviceRoleKey, key, email, password };
}

export async function getPlatformSupabase(): Promise<SupabaseClient> {
  const now = Date.now();
  if (cachedPrimaryClient && cachedPrimaryClient.expiresAtMs - now > 120_000) {
    return cachedPrimaryClient.client;
  }

  const env = getSupabaseEnv();
  // Si está configurada la clave service_role/secret, evita por completo signInWithPassword (GoTrue)
  if (env.serviceRoleKey) {
    const directClient = createClient(env.url, env.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal || AbortSignal.timeout(15_000),
          }),
      },
    });
    cachedPrimaryClient = {
      client: directClient,
      expiresAtMs: now + 24 * 60 * 60 * 1000,
    };
    return directClient;
  }

  if (pendingPrimaryAuth) {
    return pendingPrimaryAuth;
  }

  pendingPrimaryAuth = (async () => {
    const { url, key, email, password } = env;
    if (!password) {
      throw new Error(
        "Falta configurar ERP_SUPABASE_SERVICE_PASSWORD en las variables de entorno del servidor."
      );
    }

    const attemptSignIn = async (timeoutMs: number) => {
      const client = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              signal: init?.signal || AbortSignal.timeout(timeoutMs),
            }),
        },
      });
      return client.auth.signInWithPassword({ email, password });
    };

    let result = await attemptSignIn(8_000).catch((err) => ({
      data: { session: null },
      error: { message: err instanceof Error ? err.message : "timeout" },
    }));

    if (result.error || !result.data.session) {
      result = await attemptSignIn(10_000).catch((err) => ({
        data: { session: null },
        error: { message: err instanceof Error ? err.message : "timeout" },
      }));
    }

    if (result.error || !result.data.session) {
      throw new Error(
        `No se pudo autenticar el servicio backend en Supabase: ${result.error?.message || "sin sesión"}`
      );
    }

    const session = result.data.session;
    const authedClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal || AbortSignal.timeout(15_000),
          }),
      },
    });

    const expiresAtMs = session.expires_at
      ? session.expires_at * 1000
      : Date.now() + 50 * 60 * 1000;

    cachedPrimaryClient = {
      client: authedClient,
      expiresAtMs,
    };

    return authedClient;
  })();

  try {
    return await pendingPrimaryAuth;
  } finally {
    pendingPrimaryAuth = null;
  }
}

export async function getTenantDataSupabase(
  tenant: Pick<ErpTenantRecord, "external_supabase_url" | "external_supabase_key">
): Promise<SupabaseClient> {
  const extUrl = cleanEnvStr(tenant.external_supabase_url);
  const extKey = cleanEnvStr(tenant.external_supabase_key);
  if (extUrl && extKey) {
    const cacheKey = `${extUrl}::${extKey.slice(0, 16)}`;
    const existing = externalClientsCache.get(cacheKey);
    if (existing) return existing;
    const ext = createClient(extUrl, extKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    externalClientsCache.set(cacheKey, ext);
    return ext;
  }
  return getPlatformSupabase();
}

export async function provisionTenantSchemaInDb(
  tenant: Pick<ErpTenantRecord, "db_schema" | "external_supabase_url" | "external_supabase_key">,
  seedDocs: Record<string, unknown>,
  seedUsers: Array<Record<string, unknown>>
): Promise<void> {
  const sb = await getTenantDataSupabase(tenant);
  const { error } = await sb.rpc("erp_provision_tenant_schema", {
    p_schema: tenant.db_schema,
    p_seed_docs: seedDocs,
    p_seed_users: seedUsers,
  });
  if (error) {
    throw new Error(`Error aprovisionando esquema ${tenant.db_schema}: ${error.message}`);
  }
}

function isUsingPlatformStorage(
  tenant: Pick<ErpTenantRecord, "external_supabase_url" | "external_supabase_key">
): boolean {
  return !(tenant.external_supabase_url && tenant.external_supabase_key);
}

function storageDocPath(schema: string, docKey: string, rev: number): string {
  return `${schema}/${docKey}_r${rev}.json.gz`;
}

function storageLatestDocPath(schema: string, docKey: string): string {
  return `${schema}/${docKey}_latest.json.gz`;
}

async function fetchDocMetaFromDb(
  sb: SupabaseClient,
  schema: string,
  docKey: string
): Promise<{ ok: true; meta: { rev: number; updatedAt: string; sizeBytes: number } | null } | { ok: false }> {
  try {
    const { data, error } = await sb.rpc("erp_get_doc_meta", {
      p_schema: schema,
      p_doc_key: docKey,
    });
    if (error) {
      return { ok: false };
    }
    if (!data || typeof data !== "object" || !("rev" in data)) {
      return { ok: true, meta: null };
    }
    const row = data as { rev?: number; updated_at?: string; size_bytes?: number };
    return {
      ok: true,
      meta: {
        rev: Number(row.rev || 1),
        updatedAt: String(row.updated_at || new Date().toISOString()),
        sizeBytes: Number(row.size_bytes || 0),
      },
    };
  } catch {
    return { ok: false };
  }
}

async function downloadStoragePathBuffer(
  sb: SupabaseClient,
  path: string
): Promise<Buffer | null> {
  try {
    const { data, error } = await sb.storage.from(DOC_CACHE_BUCKET).download(path);
    if (error || !data) return null;
    const ab = await data.arrayBuffer();
    if (!ab || ab.byteLength < 20) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

async function downloadGzipFromStorage(
  sb: SupabaseClient,
  schema: string,
  docKey: string,
  rev: number
): Promise<Buffer | null> {
  return downloadStoragePathBuffer(sb, storageDocPath(schema, docKey, rev));
}

async function downloadLatestGzipFromStorage(
  sb: SupabaseClient,
  schema: string,
  docKey: string
): Promise<{ gzBuf: Buffer; rev: number } | null> {
  const latestBuf = await downloadStoragePathBuffer(sb, storageLatestDocPath(schema, docKey));
  if (latestBuf) {
    return { gzBuf: latestBuf, rev: 0 };
  }
  try {
    const { data: files, error } = await sb.storage
      .from(DOC_CACHE_BUCKET)
      .list(schema, { search: `${docKey}_r`, limit: 25 });
    if (error || !Array.isArray(files) || files.length === 0) return null;
    const rx = new RegExp(`^${docKey}_r(\\d+)\\.json\\.gz$`);
    let bestName = "";
    let bestRev = -1;
    for (const f of files) {
      const m = rx.exec(String(f.name || ""));
      if (!m) continue;
      const r = Number(m[1]);
      if (r > bestRev) {
        bestRev = r;
        bestName = f.name;
      }
    }
    if (!bestName) return null;
    const buf = await downloadStoragePathBuffer(sb, `${schema}/${bestName}`);
    return buf ? { gzBuf: buf, rev: bestRev } : null;
  } catch {
    return null;
  }
}

async function uploadGzipToStorage(
  sb: SupabaseClient,
  schema: string,
  docKey: string,
  rev: number,
  gzBuf: Buffer
): Promise<void> {
  try {
    await Promise.all([
      sb.storage.from(DOC_CACHE_BUCKET).upload(storageDocPath(schema, docKey, rev), gzBuf, {
        contentType: "application/gzip",
        upsert: true,
      }),
      sb.storage.from(DOC_CACHE_BUCKET).upload(storageLatestDocPath(schema, docKey), gzBuf, {
        contentType: "application/gzip",
        upsert: true,
      }),
    ]);
    // Limpiar revisiones viejas (rev - 2) en segundo plano para no acumular cientos de snapshots
    if (rev >= 3) {
      sb.storage
        .from(DOC_CACHE_BUCKET)
        .remove([storageDocPath(schema, docKey, rev - 2)])
        .catch(() => {});
    }
  } catch {
    // Non-fatal: L2 cache is best-effort
  }
}

async function fetchDocRowFastFromDb<T>(
  sb: SupabaseClient,
  schema: string,
  docKey: string
): Promise<{ payload: T; rev: number; updatedAt: string } | null> {
  let { data, error } = await sb.rpc("erp_get_doc_fast", {
    p_schema: schema,
    p_doc_key: docKey,
  });

  if (error && error.message && error.message.includes("erp_get_doc_fast")) {
    const fallbackRpc = await sb.rpc("erp_get_doc", {
      p_schema: schema,
      p_doc_key: docKey,
    });
    data = fallbackRpc.data;
    error = fallbackRpc.error;
  }

  if (error) {
    throw new Error(`Error leyendo ${docKey} (${schema}): ${error.message}`);
  }

  if (!data || typeof data !== "object" || !("payload" in data)) {
    return null;
  }

  const row = data as { payload: T; rev?: number; updated_at?: string };
  return {
    payload: row.payload as T,
    rev: Number(row.rev || 1),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

/**
 * Obtiene directamente el Buffer gzip de un documento pesado (ej. catalog_db de 8 MB)
 * usando L1 RAM -> L2 Supabase Storage CDN -> L3 Postgres erp_get_doc_fast,
 * evitando descomprimir/parsear/re-serializar JSON en lecturas puras.
 */
export async function getTenantDocGzippedSnapshot(
  tenant: Pick<ErpTenantRecord, "db_schema" | "external_supabase_url" | "external_supabase_key">,
  docKey: string,
  fallback: unknown
): Promise<{ gzBuf: Buffer; rev: number; updatedAt: string }> {
  const cacheKey = `${tenant.db_schema}:${docKey}`;
  const now = Date.now();
  const cached = docMemoryCache.get(cacheKey);
  if (cached && cached.gzBuf && now - cached.checkedAt < META_TRUST_MS) {
    return { gzBuf: cached.gzBuf, rev: cached.rev, updatedAt: cached.updatedAt };
  }

  const inFlightKey = `gz:${cacheKey}`;
  const existingPromise = inFlightDocReads.get(inFlightKey);
  if (existingPromise) {
    const res = await existingPromise;
    if (res.gzBuf) {
      return { gzBuf: res.gzBuf, rev: res.rev, updatedAt: res.updatedAt };
    }
  }

  const work = (async () => {
    const sb = await getTenantDataSupabase(tenant);
    const useL2 = HEAVY_DOC_KEYS.has(docKey) && isUsingPlatformStorage(tenant);

    if (useL2) {
      const metaRes = await fetchDocMetaFromDb(sb, tenant.db_schema, docKey);
      if (metaRes.ok && metaRes.meta) {
        const meta = metaRes.meta;
        if (cached && cached.rev === meta.rev && cached.gzBuf) {
          cached.checkedAt = Date.now();
          return { gzBuf: cached.gzBuf, rev: cached.rev, updatedAt: cached.updatedAt };
        }
        const l2Buf = await downloadGzipFromStorage(sb, tenant.db_schema, docKey, meta.rev);
        if (l2Buf) {
          docMemoryCache.set(cacheKey, {
            gzBuf: l2Buf,
            rev: meta.rev,
            updatedAt: meta.updatedAt,
            checkedAt: Date.now(),
          });
          return { gzBuf: l2Buf, rev: meta.rev, updatedAt: meta.updatedAt };
        }
      } else if (!metaRes.ok) {
        // Postgres saturado/timeout: servir desde L1 RAM o último snapshot en Storage sin golpear Postgres con 12 MB
        if (cached && cached.gzBuf) {
          return { gzBuf: cached.gzBuf, rev: cached.rev, updatedAt: cached.updatedAt };
        }
        const fallbackL2 = await downloadLatestGzipFromStorage(sb, tenant.db_schema, docKey);
        if (fallbackL2) {
          const nowIso = new Date().toISOString();
          docMemoryCache.set(cacheKey, {
            gzBuf: fallbackL2.gzBuf,
            rev: fallbackL2.rev || 1,
            updatedAt: nowIso,
            checkedAt: Date.now(),
          });
          return { gzBuf: fallbackL2.gzBuf, rev: fallbackL2.rev || 1, updatedAt: nowIso };
        }
      }
    }

    const row = await fetchDocRowFastFromDb(sb, tenant.db_schema, docKey);
    const finalPayload = row ? (row.payload ?? fallback) : fallback;
    const rev = row ? row.rev : 1;
    const updatedAt = row ? row.updatedAt : new Date().toISOString();
    const rawBuf = Buffer.from(JSON.stringify(finalPayload), "utf8");
    const gzBuf = zlib.gzipSync(rawBuf, { level: 4 });

    docMemoryCache.set(cacheKey, {
      payload: finalPayload,
      gzBuf,
      rev,
      updatedAt,
      checkedAt: Date.now(),
    });

    if (useL2 && row) {
      await uploadGzipToStorage(sb, tenant.db_schema, docKey, rev, gzBuf);
    }

    return { payload: finalPayload, gzBuf, rev, updatedAt };
  })();

  inFlightDocReads.set(inFlightKey, work);
  try {
    const res = await work;
    return { gzBuf: res.gzBuf!, rev: res.rev, updatedAt: res.updatedAt };
  } finally {
    inFlightDocReads.delete(inFlightKey);
  }
}

export async function getTenantDoc<T = Record<string, unknown>>(
  tenant: Pick<ErpTenantRecord, "db_schema" | "external_supabase_url" | "external_supabase_key">,
  docKey: string,
  fallback: T
): Promise<{ payload: T; rev: number; updatedAt: string }> {
  const isHeavy = HEAVY_DOC_KEYS.has(docKey);
  const cacheKey = `${tenant.db_schema}:${docKey}`;

  if (isHeavy) {
    const cached = docMemoryCache.get(cacheKey);
    if (cached && cached.payload !== undefined && Date.now() - cached.checkedAt < META_TRUST_MS) {
      return {
        payload: cached.payload as T,
        rev: cached.rev,
        updatedAt: cached.updatedAt,
      };
    }

    const existingPromise = inFlightDocReads.get(cacheKey);
    if (existingPromise) {
      const res = await existingPromise;
      if (res.payload !== undefined) {
        return { payload: res.payload as T, rev: res.rev, updatedAt: res.updatedAt };
      }
    }

    const work = (async () => {
      const sb = await getTenantDataSupabase(tenant);
      const useL2 = isUsingPlatformStorage(tenant);

      if (useL2) {
        const metaRes = await fetchDocMetaFromDb(sb, tenant.db_schema, docKey);
        if (metaRes.ok && metaRes.meta) {
          const meta = metaRes.meta;
          if (cached && cached.rev === meta.rev && cached.payload !== undefined) {
            cached.checkedAt = Date.now();
            return { payload: cached.payload, rev: cached.rev, updatedAt: cached.updatedAt };
          }
          const l2Buf = await downloadGzipFromStorage(sb, tenant.db_schema, docKey, meta.rev);
          if (l2Buf) {
            try {
              const parsed = JSON.parse(zlib.gunzipSync(l2Buf).toString("utf8")) as T;
              docMemoryCache.set(cacheKey, {
                payload: parsed,
                gzBuf: l2Buf,
                rev: meta.rev,
                updatedAt: meta.updatedAt,
                checkedAt: Date.now(),
              });
              return { payload: parsed, gzBuf: l2Buf, rev: meta.rev, updatedAt: meta.updatedAt };
            } catch {
              // Fall through to DB if corrupt snapshot
            }
          }
        } else if (!metaRes.ok) {
          if (cached && cached.payload !== undefined) {
            return { payload: cached.payload, rev: cached.rev, updatedAt: cached.updatedAt };
          }
          const fallbackL2 = await downloadLatestGzipFromStorage(sb, tenant.db_schema, docKey);
          if (fallbackL2) {
            try {
              const parsed = JSON.parse(zlib.gunzipSync(fallbackL2.gzBuf).toString("utf8")) as T;
              const nowIso = new Date().toISOString();
              docMemoryCache.set(cacheKey, {
                payload: parsed,
                gzBuf: fallbackL2.gzBuf,
                rev: fallbackL2.rev || 1,
                updatedAt: nowIso,
                checkedAt: Date.now(),
              });
              return { payload: parsed, gzBuf: fallbackL2.gzBuf, rev: fallbackL2.rev || 1, updatedAt: nowIso };
            } catch {
              // Fall through to DB if corrupt snapshot
            }
          }
        }
      }

      const row = await fetchDocRowFastFromDb<T>(sb, tenant.db_schema, docKey);
      if (!row) {
        return {
          payload: fallback,
          rev: 1,
          updatedAt: new Date().toISOString(),
        };
      }
      const payload = (row.payload ?? fallback) as T;
      const gzBuf = useL2
        ? zlib.gzipSync(Buffer.from(JSON.stringify(payload), "utf8"), { level: 4 })
        : undefined;

      docMemoryCache.set(cacheKey, {
        payload,
        gzBuf,
        rev: row.rev,
        updatedAt: row.updatedAt,
        checkedAt: Date.now(),
      });

      if (useL2 && gzBuf) {
        await uploadGzipToStorage(sb, tenant.db_schema, docKey, row.rev, gzBuf);
      }

      return { payload, gzBuf, rev: row.rev, updatedAt: row.updatedAt };
    })();

    inFlightDocReads.set(cacheKey, work);
    try {
      const res = await work;
      return {
        payload: (res.payload ?? fallback) as T,
        rev: res.rev,
        updatedAt: res.updatedAt,
      };
    } finally {
      inFlightDocReads.delete(cacheKey);
    }
  }

  const sb = await getTenantDataSupabase(tenant);
  const row = await fetchDocRowFastFromDb<T>(sb, tenant.db_schema, docKey);
  if (!row) {
    return {
      payload: fallback,
      rev: 1,
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    payload: (row.payload ?? fallback) as T,
    rev: row.rev,
    updatedAt: row.updatedAt,
  };
}

export async function putTenantDoc(
  tenant: Pick<ErpTenantRecord, "db_schema" | "external_supabase_url" | "external_supabase_key">,
  docKey: string,
  payload: unknown,
  actor = "system",
  action = "update"
): Promise<{ rev: number; updatedAt: string }> {
  const sb = await getTenantDataSupabase(tenant);
  const { data, error } = await sb.rpc("erp_put_doc", {
    p_schema: tenant.db_schema,
    p_doc_key: docKey,
    p_payload: payload,
    p_actor: actor,
    p_action: action,
  });

  if (error) {
    throw new Error(`Error guardando ${docKey} (${tenant.db_schema}): ${error.message}`);
  }

  const res = (data || {}) as { rev?: number; updated_at?: string };
  const rev = Number(res.rev || 1);
  const updatedAt = String(res.updated_at || new Date().toISOString());

  statusMemoryCache.delete(tenant.db_schema);

  if (HEAVY_DOC_KEYS.has(docKey)) {
    const cacheKey = `${tenant.db_schema}:${docKey}`;
    const useL2 = isUsingPlatformStorage(tenant);
    const gzBuf = useL2
      ? zlib.gzipSync(Buffer.from(JSON.stringify(payload), "utf8"), { level: 4 })
      : undefined;
    docMemoryCache.set(cacheKey, {
      payload,
      gzBuf,
      rev,
      updatedAt,
      checkedAt: Date.now(),
    });
    if (useL2 && gzBuf) {
      await uploadGzipToStorage(sb, tenant.db_schema, docKey, rev, gzBuf);
    }
  }

  return { rev, updatedAt };
}

export async function getTenantDbStatusMap(
  tenant: Pick<ErpTenantRecord, "db_schema" | "external_supabase_url" | "external_supabase_key">
): Promise<
  Record<
    string,
    {
      rev: number;
      mtime: number;
      size: number;
      updatedAt: string;
      actor: string;
      action: string;
    }
  >
> {
  const cached = statusMemoryCache.get(tenant.db_schema);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pending = inFlightStatusReads.get(tenant.db_schema);
  if (pending) {
    return pending;
  }

  const work = (async () => {
    const sb = await getTenantDataSupabase(tenant);
    const { data, error } = await sb.rpc("erp_get_status", {
      p_schema: tenant.db_schema,
    });
    if (error || !data || typeof data !== "object") {
      return {};
    }
    const result = data as Record<
      string,
      {
        rev: number;
        mtime: number;
        size: number;
        updatedAt: string;
        actor: string;
        action: string;
      }
    >;
    statusMemoryCache.set(tenant.db_schema, {
      value: result,
      expiresAt: Date.now() + STATUS_CACHE_MS,
    });
    return result;
  })();

  inFlightStatusReads.set(tenant.db_schema, work);
  try {
    return await work;
  } finally {
    inFlightStatusReads.delete(tenant.db_schema);
  }
}

export async function listTenantUsersFromDb(
  tenant: Pick<ErpTenantRecord, "db_schema" | "external_supabase_url" | "external_supabase_key">
): Promise<ErpUserRecord[]> {
  const sb = await getTenantDataSupabase(tenant);
  const { data, error } = await sb.rpc("erp_users_op", {
    p_schema: tenant.db_schema,
    p_op: "list",
    p_payload: {},
  });
  if (error) {
    throw new Error(`Error listando usuarios (${tenant.db_schema}): ${error.message}`);
  }
  return Array.isArray(data) ? (data as ErpUserRecord[]) : [];
}

export async function upsertTenantUserInDb(
  tenant: Pick<ErpTenantRecord, "db_schema" | "external_supabase_url" | "external_supabase_key">,
  payload: Record<string, unknown>
): Promise<ErpUserRecord> {
  const sb = await getTenantDataSupabase(tenant);
  const { data, error } = await sb.rpc("erp_users_op", {
    p_schema: tenant.db_schema,
    p_op: "upsert",
    p_payload: payload,
  });
  if (error) {
    throw new Error(`Error guardando usuario (${tenant.db_schema}): ${error.message}`);
  }
  return data as ErpUserRecord;
}

export async function softDeleteTenantUserInDb(
  tenant: Pick<ErpTenantRecord, "db_schema" | "external_supabase_url" | "external_supabase_key">,
  username: string
): Promise<void> {
  const sb = await getTenantDataSupabase(tenant);
  const { error } = await sb.rpc("erp_users_op", {
    p_schema: tenant.db_schema,
    p_op: "soft_delete",
    p_payload: { username },
  });
  if (error) {
    throw new Error(`Error dando de baja usuario (${tenant.db_schema}): ${error.message}`);
  }
}

export async function putTenantMediaInDb(
  tenant: Pick<ErpTenantRecord, "db_schema" | "external_supabase_url" | "external_supabase_key">,
  media: {
    media_key: string;
    category: "products" | "banners" | "brand";
    mime_type: string;
    data_b64: string;
    width?: number;
    height?: number;
  }
): Promise<void> {
  const sb = await getTenantDataSupabase(tenant);
  const { error } = await sb.rpc("erp_media_op", {
    p_schema: tenant.db_schema,
    p_op: "put",
    p_payload: media,
  });
  if (error) {
    throw new Error(`Error guardando imagen (${tenant.db_schema}): ${error.message}`);
  }
}

export async function getTenantMediaFromDb(
  tenant: Pick<ErpTenantRecord, "db_schema" | "external_supabase_url" | "external_supabase_key">,
  mediaKey: string
): Promise<{
  media_key: string;
  category: string;
  mime_type: string;
  data_b64: string;
  width: number;
  height: number;
} | null> {
  const sb = await getTenantDataSupabase(tenant);
  const { data, error } = await sb.rpc("erp_media_op", {
    p_schema: tenant.db_schema,
    p_op: "get",
    p_payload: { media_key: mediaKey },
  });
  if (error || !data) return null;
  return data as {
    media_key: string;
    category: string;
    mime_type: string;
    data_b64: string;
    width: number;
    height: number;
  };
}
