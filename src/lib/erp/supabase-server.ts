import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ErpTenantRecord, ErpUserRecord } from "./types";

interface CachedAuthClient {
  client: SupabaseClient;
  expiresAtMs: number;
}

let cachedPrimaryClient: CachedAuthClient | null = null;
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
    : now + 50 * 60 * 1000;

  cachedPrimaryClient = {
    client: authedClient,
    expiresAtMs,
  };

  return authedClient;
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

export async function getTenantDoc<T = Record<string, unknown>>(
  tenant: Pick<ErpTenantRecord, "db_schema" | "external_supabase_url" | "external_supabase_key">,
  docKey: string,
  fallback: T
): Promise<{ payload: T; rev: number; updatedAt: string }> {
  const sb = await getTenantDataSupabase(tenant);
  const { data, error } = await sb.rpc("erp_get_doc", {
    p_schema: tenant.db_schema,
    p_doc_key: docKey,
  });

  if (error) {
    throw new Error(`Error leyendo ${docKey} (${tenant.db_schema}): ${error.message}`);
  }

  if (!data || typeof data !== "object" || !("payload" in data)) {
    return {
      payload: fallback,
      rev: 1,
      updatedAt: new Date().toISOString(),
    };
  }

  const row = data as { payload: T; rev?: number; updated_at?: string };
  return {
    payload: (row.payload ?? fallback) as T,
    rev: Number(row.rev || 1),
    updatedAt: String(row.updated_at || new Date().toISOString()),
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
  return {
    rev: Number(res.rev || 1),
    updatedAt: String(res.updated_at || new Date().toISOString()),
  };
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
  const sb = await getTenantDataSupabase(tenant);
  const { data, error } = await sb.rpc("erp_get_status", {
    p_schema: tenant.db_schema,
  });
  if (error || !data || typeof data !== "object") {
    return {};
  }
  return data as Record<
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
