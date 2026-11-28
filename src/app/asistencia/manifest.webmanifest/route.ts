import { NextRequest, NextResponse } from "next/server";
import {
  enforceOptionBranding,
  getTenantBySlug,
  resolveActiveTenantFromRequest,
} from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const forcedSlug = req.nextUrl.searchParams.get("tenant") || "";
  const tenant = forcedSlug
    ? (await getTenantBySlug(forcedSlug)) ||
      (await resolveActiveTenantFromRequest(req))
    : await resolveActiveTenantFromRequest(req);

  const brand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );

  const startUrl =
    tenant.option_type === 2 && !tenant.is_base
      ? `/${tenant.slug}/asistencia`
      : "/asistencia";

  const manifest = {
    id: `asistencia-${tenant.slug}`,
    name: `${tenant.fantasy_name} · Control de Asistencia`,
    short_name: "Asistencia",
    description: `App PWA de Control de Asistencia biométrica y geoposición satelital — ${tenant.business_name}`,
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: tenant.is_base ? "#01344c" : brand.primaryHex,
    theme_color: tenant.is_base ? "#01344c" : brand.primaryHex,
    lang: "es-AR",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/sistema/assets/img/minisistema/icon-192.png?v=4",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/sistema/assets/img/minisistema/icon-512.png?v=4",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/sistema/assets/img/minisistema/icon-maskable-192.png?v=4",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/sistema/assets/img/minisistema/icon-maskable-512.png?v=4",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
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
