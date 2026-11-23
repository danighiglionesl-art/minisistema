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
const META_TRUST_MS = 3_000;
const STATUS_CACHE_MS = 2_000;

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

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL || "https://ghrxmirhilrlveqyyscq.supabase.co";
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_ORbjp1JRY95Up_qfZ7atjw_SmcH6SYm";
  const email =
    process.env.ERP_SUPABASE_SERVICE_EMAIL ||
    "erp-backend-service@minisistema.com.ar";
  const password = process.env.ERP_SUPABASE_SERVICE_PASSWORD || "";
  return { url, key, email, password };
}

export async function getPlatformSupabase(): Promise<SupabaseClient> {
  const now = Date.now();
  if (cachedPrimaryClient && cachedPrimaryClient.expiresAtMs - now > 120_000) {
    return cachedPrimaryClient.client;
  }

  if (pendingPrimaryAuth) {
    return pendingPrimaryAuth;
  }

  pendingPrimaryAuth = (async () => {
    const { url, key, email, password } = getSupabaseEnv();
    const client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    if (!password) {
      throw new Error(
        "Falta configurar ERP_SUPABASE_SERVICE_PASSWORD en las variables de entorno del servidor."
      );
    }

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      throw new Error(
        `No se pudo autenticar el servicio backend en Supabase: ${error?.message || "sin sesión"}`
      );
    }

    const authedClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      },
    });

    const expiresAtMs = data.session.expires_at
      ? data.session.expires_at * 1000
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
  if (tenant.external_supabase_url && tenant.external_supabase_key) {
    const cacheKey = `${tenant.external_supabase_url}::${tenant.external_supabase_key.slice(0, 16)}`;
    const existing = externalClientsCache.get(cacheKey);
    if (existing) return existing;
    const ext = createClient(tenant.external_supabase_url, tenant.external_supabase_key, {
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

async function fetchDocMetaFromDb(
  sb: SupabaseClient,
  schema: string,
  docKey: string
): Promise<{ rev: number; updatedAt: string; sizeBytes: number } | null> {
  const { data, error } = await sb.rpc("erp_get_doc_meta", {
    p_schema: schema,
    p_doc_key: docKey,
  });
  if (error || !data || typeof data !== "object" || !("rev" in data)) {
    return null;
  }
  const row = data as { rev?: number; updated_at?: string; size_bytes?: number };
  return {
    rev: Number(row.rev || 1),
    updatedAt: String(row.updated_at || new Date().toISOString()),
    sizeBytes: Number(row.size_bytes || 0),
  };
}

async function downloadGzipFromStorage(
  sb: SupabaseClient,
  schema: string,
  docKey: string,
  rev: number
): Promise<Buffer | null> {
  try {
    const { data, error } = await sb.storage
      .from(DOC_CACHE_BUCKET)
      .download(storageDocPath(schema, docKey, rev));
    if (error || !data) return null;
    const ab = await data.arrayBuffer();
    if (!ab || ab.byteLength < 20) return null;
    return Buffer.from(ab);
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
    await sb.storage
      .from(DOC_CACHE_BUCKET)
      .upload(storageDocPath(schema, docKey, rev), gzBuf, {
        contentType: "application/gzip",
        upsert: true,
      });
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
      const meta = await fetchDocMetaFromDb(sb, tenant.db_schema, docKey);
      if (meta) {
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
        const meta = await fetchDocMetaFromDb(sb, tenant.db_schema, docKey);
        if (meta) {
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
