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
  const startUrl =
    tenant.option_type === 2 && !tenant.is_base
      ? `/${tenant.slug}/carrito`
      : "/carrito";

  const manifest = {
    name: `${tenant.fantasy_name} · Tienda Online`,
    short_name: tenant.fantasy_name,
    description: `Tienda Online y Catálogo Digital — ${tenant.business_name}`,
    start_url: startUrl,
    scope: startUrl,
    display: "standalone",
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
