import { NextRequest, NextResponse } from "next/server";
import {
  enforceOptionBranding,
  resolveActiveTenantFromRequest,
} from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tenant = await resolveActiveTenantFromRequest(req);
  const brand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );
  const isSubpathTenant = tenant.option_type === 2 && !tenant.is_base;
  const startUrl = isSubpathTenant ? `/${tenant.slug}` : "/sistema";
  const scopeUrl = isSubpathTenant ? `/${tenant.slug}` : "/";

  const manifest = {
    id: startUrl,
    name: `${tenant.fantasy_name} · Sistema ERP`,
    short_name: tenant.fantasy_name,
    description: `Sistema ERP en Línea — ${tenant.business_name}`,
    start_url: startUrl,
    scope: scopeUrl,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: brand.primaryHex,
    theme_color: brand.primaryHex,
    lang: "es-AR",
    icons: [
      {
        src: brand.logoSymbolUrl,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: brand.logoSymbolUrl,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
