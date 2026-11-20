import type { Metadata } from "next";
import { headers } from "next/headers";
import PublicInmobiliariaPortal from "@/components/inmobiliaria/PublicInmobiliariaPortal";
import { loadInmobiliariaDb } from "@/lib/erp/handlers/inmobiliaria-handler";
import { isPropertyExpired } from "@/lib/erp/inmobiliaria-types";
import referenceCatalogs from "@/lib/erp/reference-catalogs.json";
import {
  enforceOptionBranding,
  ensureBaseMiniSistemaTenant,
  getTenantByHost,
} from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inmobiliaria Degiovanni | Propiedades en Venta, Alquiler y Temporarios",
  description:
    "Inmobiliaria Degiovanni — Alcira Gigena, Córdoba. Propiedades urbanas y rurales en Venta, Alquiler y Alquiler Temporario con ubicación satelital, buscador con IA y Portal de Clientes.",
};

export default async function PublicInmobiliariaPage() {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "";
  const tenant =
    (await getTenantByHost(host)) || (await ensureBaseMiniSistemaTenant());

  if (
    !tenant.is_base &&
    Array.isArray(tenant.enabled_modules) &&
    !tenant.enabled_modules.includes("inmobiliaria")
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#112D3A] p-8 text-center text-[#FFFFFF]">
        <div>
          <h1 className="text-2xl font-extrabold text-[#56D7A1]">
            Marketplace Inmobiliario no habilitado
          </h1>
          <p className="mt-2 text-sm text-[#FFFFFF]/80">
            Esta organización no tiene activo el módulo Inmobiliaria en su plan actual.
          </p>
        </div>
      </div>
    );
  }

  const brand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );
  const db = await loadInmobiliariaDb(tenant);
  const activeBanners = db.banners
    .filter((b) => b.activo !== false)
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
  const activeProps = db.propiedades.filter(
    (p) => p.activa !== false && !isPropertyExpired(p)
  );

  const isDegiovanniDefault =
    tenant.is_base ||
    tenant.option_type !== 1 ||
    /^minisistema\.?$/i.test((tenant.fantasy_name || "").trim());

  const resolvedFantasyName = isDegiovanniDefault
    ? "Inmobiliaria Degiovanni"
    : tenant.fantasy_name;
  const resolvedBusinessName = isDegiovanniDefault
    ? "Inmobiliaria Degiovanni"
    : tenant.business_name;
  const resolvedPrimaryHex = isDegiovanniDefault ? "#1F1F1F" : brand.primaryHex;
  const resolvedAccentHex = isDegiovanniDefault ? "#FC8006" : brand.accentHex;
  const resolvedLogoHoriz = isDegiovanniDefault
    ? "/inmobiliaria/degiovanni-logo-horizontal.png"
    : brand.logoHorizontalUrl;
  const resolvedLogoSymbol = isDegiovanniDefault
    ? "/inmobiliaria/degiovanni-logo-symbol.png"
    : brand.logo1x1Url;

  const cats = referenceCatalogs.catalogs as {
    paises?: Array<{ id: number; nombre: string }>;
    provincias?: string[];
    localidadesPorProvincia?: Record<string, Array<{ nombre: string; cp?: string }>>;
  };

  return (
    <PublicInmobiliariaPortal
      tenantSlug={tenant.slug}
      fantasyName={resolvedFantasyName}
      businessName={resolvedBusinessName}
      primaryHex={resolvedPrimaryHex}
      accentHex={resolvedAccentHex}
      logoHorizontalUrl={resolvedLogoHoriz}
      logo1x1Url={resolvedLogoSymbol}
      isMiniSistemaBrand={false}
      defaultProvincia={brand.provincia || "CÓRDOBA"}
      defaultLocalidad={isDegiovanniDefault ? "ALCIRA GIGENA" : brand.localidad || "RÍO CUARTO"}
      defaultCp={isDegiovanniDefault ? "5813" : brand.cp || "5800"}
      initialConfig={db.portalConfig}
      initialBanners={activeBanners}
      initialPropiedades={activeProps}
      catalogs={{
        paises: cats.paises || [],
        provincias: cats.provincias || [],
        localidadesPorProvincia: cats.localidadesPorProvincia || {},
      }}
    />
  );
}
