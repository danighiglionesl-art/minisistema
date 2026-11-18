-- =============================================================================
-- MINISISTEMA ERP MULTI-SISTEMA — ARQUITECTURA SUPABASE (ESQUEMAS AISLADOS)
-- Proyecto Supabase: ghrxmirhilrlveqyyscq (minisistema-erp · sa-east-1)
-- =============================================================================
-- Cada sistema habilitado por el Administrador General (@danielg) posee su
-- propio esquema PostgreSQL independiente (ej. erp_minisistema, erp_comercio1),
-- con tablas aisladas (documents, users, media) y Row Level Security (RLS)
-- forzado tanto en el plano de control (public) como en cada esquema tenant.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.erp_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9_-]{1,48}$'),
  option_type smallint NOT NULL DEFAULT 2 CHECK (option_type IN (1, 2)),
  is_base boolean NOT NULL DEFAULT false,
  business_name text NOT NULL,
  fantasy_name text NOT NULL,
  custom_domain text UNIQUE,
  db_schema text UNIQUE NOT NULL CHECK (db_schema ~ '^erp_[a-z0-9_]{2,54}$'),
  external_supabase_url text,
  external_supabase_key text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'provisioning', 'cancelled')),
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  subscription jsonb NOT NULL DEFAULT '{}'::jsonb,
  deployment jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.erp_pricing_config (
  id text PRIMARY KEY DEFAULT 'default',
  option_1_base numeric(12, 2) NOT NULL DEFAULT 35000,
  option_2_base numeric(12, 2) NOT NULL DEFAULT 15000,
  module_prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  discount_presets jsonb NOT NULL DEFAULT '[]'::jsonb,
  currency text NOT NULL DEFAULT 'ARS',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.erp_platform_secrets (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.erp_subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL REFERENCES public.erp_tenants(slug),
  event_type text NOT NULL,
  mp_preapproval_id text,
  amount numeric(12, 2),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
