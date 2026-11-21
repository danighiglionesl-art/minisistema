import type { Metadata } from "next";
import { headers } from "next/headers";
import AsistenciaPwaClient from "@/components/asistencia/AsistenciaPwaClient";
import referenceCatalogs from "@/lib/erp/reference-catalogs.json";
import {
  enforceOptionBranding,
  ensureBaseMiniSistemaTenant,
  getTenantByHost,
} from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Control de Asistencia | App PWA",
  description:
    "App PWA de Control de Asistencia con verificación biométrica, geoposición satelital y seguimiento de jornada laboral.",
  manifest: "/asistencia/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Asistencia",
    statusBarStyle: "black-translucent",
  },
};

export default async function PublicAsistenciaPage() {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "";
  const tenant =
    (await getTenantByHost(host)) || (await ensureBaseMiniSistemaTenant());

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
