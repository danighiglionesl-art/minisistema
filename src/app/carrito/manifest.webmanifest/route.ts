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
  const isCasaNueva = tenant.slug === "casanueva";
  const basePath =
    tenant.option_type === 2 && !tenant.is_base
      ? `/${tenant.slug}/carrito`
      : "/carrito";
  const startUrl = `${basePath}?panel=1`;
  const scopeUrl =
    tenant.option_type === 2 && !tenant.is_base ? `/${tenant.slug}/` : "/";

  const icons = isCasaNueva
    ? [
        {
          src: "/carrito/assets/img/icon-192.png?v=25",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/carrito/assets/img/icon-512.png?v=25",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/carrito/assets/img/icon-maskable-192.png?v=25",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable",
        },
        {
          src: "/carrito/assets/img/icon-maskable-512.png?v=25",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ]
    : [
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
        {
          src: brand.logoSymbolUrl,
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable",
        },
        {
          src: brand.logoSymbolUrl,
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ];

  const shortcutIconSrc = isCasaNueva
    ? "/carrito/assets/img/icon-192.png?v=25"
    : brand.logoSymbolUrl;

  const manifest = {
    id: startUrl,
    name: `${tenant.fantasy_name} · Usuario Registrado`,
    short_name: isCasaNueva ? "Casa Nueva" : tenant.fantasy_name,
    description: `App de Clientes y Tienda Online de ${tenant.business_name}: Puntos ${brand.clubName || "Club Fidel"}, Soy Cajero, Consultador de Precios y Compra Web.`,
    start_url: startUrl,
    scope: scopeUrl,
    display: "standalone",
    orientation: "portrait-primary",
    background_color: isCasaNueva ? "#ffffff" : brand.primaryHex,
    theme_color: isCasaNueva ? "#d4a41e" : brand.primaryHex,
    categories: ["shopping", "food", "lifestyle"],
    lang: "es-AR",
    dir: "ltr",
    icons,
    shortcuts: [
      {
        name: "Mi Panel · Usuario Registrado",
        short_name: "Mi Panel",
        description: "Abrir el Panel del Usuario Registrado",
        url: `${basePath}?panel=1`,
        icons: [{ src: shortcutIconSrc, sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Soy Cajero · Autogestión",
        short_name: "Soy Cajero",
        description: "Escaneá productos y generá tu código para caja",
        url: `${basePath}?panel=1&sec=soy-cajero`,
        icons: [{ src: shortcutIconSrc, sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Consultador de Precios",
        short_name: "Precios",
        description: "Consultá precios al instante",
        url: `${basePath}?panel=1&sec=consultador`,
        icons: [{ src: shortcutIconSrc, sizes: "192x192", type: "image/png" }],
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
