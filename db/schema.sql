-- =============================================================================
-- MINISISTEMA — ESQUEMA DE BASE DE DATOS POSTGRESQL (ETAPA 3 & 4)
-- Dominio: https://www.minisistema.com.ar
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Administradores (sin registro público, contraseñas con hash scrypt)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- 2. Consultas Comerciales (Configurador de 6 pasos y Formulario de Contacto)
CREATE TABLE IF NOT EXISTS commercial_inquiries (
  id VARCHAR(32) PRIMARY KEY, -- Ej: MS-2026-4821
  source VARCHAR(30) NOT NULL DEFAULT 'configurador', -- 'configurador' | 'contacto'
  status VARCHAR(40) NOT NULL DEFAULT 'Nueva'
    CHECK (status IN ('Nueva', 'Contactada', 'En análisis', 'Propuesta enviada', 'Aprobada', 'No concretada')),
  business_activity VARCHAR(120) NOT NULL,
  selected_needs JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_system_status VARCHAR(160) NOT NULL DEFAULT '',
  project_description TEXT NOT NULL,
  preselected_category VARCHAR(120),
  preselected_service VARCHAR(120),
  full_name VARCHAR(160) NOT NULL,
  business_name VARCHAR(180) NOT NULL DEFAULT '',
  city VARCHAR(120) NOT NULL DEFAULT '',
  province VARCHAR(120) NOT NULL DEFAULT '',
  whatsapp VARCHAR(60) NOT NULL,
  email VARCHAR(255) NOT NULL,
  privacy_consent BOOLEAN NOT NULL DEFAULT TRUE,
  observations JSONB NOT NULL DEFAULT '[]'::jsonb,
  change_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_status ON commercial_inquiries (status);
CREATE INDEX IF NOT EXISTS idx_inquiries_activity ON commercial_inquiries (business_activity);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON commercial_inquiries (created_at DESC);

-- 3. Portafolio Administrable de Proyectos (Sección 14)
CREATE TABLE IF NOT EXISTS portfolio_projects (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  logo_url TEXT,
  description TEXT NOT NULL,
  activity VARCHAR(160) NOT NULL,
  problem_solved TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  screenshots JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(80) NOT NULL DEFAULT 'En preparación de caso',
  public_url TEXT,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Contenidos Administrables y Preguntas Frecuentes (Sección 16 y 19)
CREATE TABLE IF NOT EXISTS faq_items (
  id VARCHAR(80) PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Configuración Institucional y Canales Oficiales (Sección 18 y 19)
CREATE TABLE IF NOT EXISTS site_settings (
  key VARCHAR(80) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
