import { NextRequest, NextResponse } from "next/server";
import {
  enforceOptionBranding,
  resolveActiveTenantFromRequest,
} from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

function getScopeExtensions(req: NextRequest, customDomain: string | null) {
  const rawHost = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    customDomain ||
    ""
  )
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");

  if (
    !rawHost ||
    rawHost === "localhost" ||
    rawHost === "127.0.0.1" ||
    rawHost.endsWith(".vercel.app")
  ) {
    return undefined;
  }

  const apex = rawHost.replace(/^www\./, "");
  return [
    { type: "origin", origin: `https://${apex}` },
    { type: "origin", origin: `https://www.${apex}` },
  ];
}

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
  const scopeExtensions = !isSubpathTenant
    ? getScopeExtensions(req, tenant.custom_domain)
    : undefined;

  let icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose: string;
  }>;

  if (tenant.slug === "casanueva") {
    icons = [
      {
        src: "/sistema/assets/img/casanueva/favicon-64.png",
        sizes: "64x64",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/sistema/assets/img/casanueva/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/sistema/assets/img/casanueva/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/sistema/assets/img/casanueva/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ];
  } else if (tenant.slug === "paseoalberdi") {
    icons = [
      {
        src: "/sistema/assets/img/paseo-alberdi/favicon-64.png",
        sizes: "64x64",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/sistema/assets/img/paseo-alberdi/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/sistema/assets/img/paseo-alberdi/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/sistema/assets/img/paseo-alberdi/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ];
  } else if (tenant.is_base) {
    icons = [
      {
        src: "/sistema/assets/img/minisistema/favicon-64.png?v=3",
        sizes: "64x64",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/sistema/assets/img/minisistema/icon-192.png?v=3",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/sistema/assets/img/minisistema/icon-512.png?v=3",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/sistema/assets/img/minisistema/icon-maskable-192.png?v=3",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/sistema/assets/img/minisistema/icon-maskable-512.png?v=3",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ];
  } else {
    icons = [
      {
        src: brand.logoSymbolUrl,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: brand.logoSymbolUrl,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ];
  }

  const manifest: Record<string, unknown> = {
    id: startUrl,
    name:
      tenant.slug === "casanueva"
        ? "Casa Nueva Supermercado - ERP"
        : `${tenant.fantasy_name} · Sistema ERP`,
    short_name:
      tenant.slug === "casanueva" ? "Casa Nueva ERP" : tenant.fantasy_name,
    description: `Sistema ERP en Línea — ${tenant.business_name}`,
    start_url: startUrl,
    scope: scopeUrl,
    ...(scopeExtensions ? { scope_extensions: scopeExtensions } : {}),
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: tenant.slug === "casanueva" ? "#f8f9fa" : brand.primaryHex,
    theme_color: tenant.slug === "casanueva" ? "#202020" : brand.primaryHex,
    lang: "es-AR",
    dir: "ltr",
    categories: ["business", "finance", "productivity"],
    icons,
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
