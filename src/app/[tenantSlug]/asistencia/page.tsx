import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AsistenciaPwaClient from "@/components/asistencia/AsistenciaPwaClient";
import referenceCatalogs from "@/lib/erp/reference-catalogs.json";
import {
  enforceOptionBranding,
  getTenantBySlug,
  isReservedAppSlug,
} from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export async function generateMetadata(context: {
  params: Promise<{ tenantSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug } = await context.params;
  const clean = tenantSlug.trim().toLowerCase();
  const tenant = !isReservedAppSlug(clean) ? await getTenantBySlug(clean) : null;
  const name = tenant?.fantasy_name || "MiniSistema";

  return {
    title: `Control de Asistencia · ${name}`,
    description: `App PWA de Control de Asistencia con verificación biométrica y seguimiento satelital para ${name}.`,
    manifest: `/asistencia/manifest.webmanifest?tenant=${encodeURIComponent(clean)}`,
    appleWebApp: {
      capable: true,
      title: "Asistencia",
      statusBarStyle: "black-translucent",
    },
  };
}

export default async function TenantAsistenciaPage(context: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await context.params;
  const clean = tenantSlug.trim().toLowerCase();
  if (isReservedAppSlug(clean)) notFound();

  const tenant = await getTenantBySlug(clean);
  if (!tenant) notFound();

  const brand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );

  const cats = referenceCatalogs.catalogs as {
    provincias?: string[];
    localidadesPorProvincia?: Record<
      string,
      Array<{ nombre: string; cp?: string }>
    >;
  };

  return (
    <AsistenciaPwaClient
      tenantSlug={tenant.slug}
      fantasyName={tenant.fantasy_name}
      businessName={tenant.business_name}
      primaryHex={brand.primaryHex}
      accentHex={brand.accentHex}
      logoHorizontalUrl={brand.logoHorizontalUrl}
      defaultProvincia={brand.provincia || "CÓRDOBA"}
      defaultLocalidad={brand.localidad || "RÍO CUARTO"}
      provincias={cats.provincias || []}
      localidadesPorProvincia={cats.localidadesPorProvincia || {}}
    />
  );
}
