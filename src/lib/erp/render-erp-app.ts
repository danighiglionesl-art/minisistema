import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { enforceOptionBranding } from "./tenant-service";
import {
  type ErpTenantRecord,
  MINISISTEMA_OFFICIAL_COLORS as MS_COLORS,
} from "./types";

const templateCache = new Map<string, string>();

function readTemplate(kind: "sistema" | "carrito" | "verificador"): string {
  const cached = templateCache.get(kind);
  if (cached && process.env.NODE_ENV === "production") return cached;
  const fullPath = path.join(
    process.cwd(),
    "src",
    "lib",
    "erp",
    "templates",
    `${kind}.html`
  );
  const raw = fs.readFileSync(fullPath, "utf8");
  templateCache.set(kind, raw);
  return raw;
}

function replaceVisibleCopy(str: string, tenant: ErpTenantRecord): string {
  if (!str) return str;
  const brand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );
  const fantasy = tenant.fantasy_name || tenant.business_name || "MiniSistema";
  const upperFantasy = fantasy.toUpperCase();
  const erpTitle = tenant.is_base ? "MiniSistema ERP" : `${fantasy} · ERP`;

  return str
    .replace(/CASA NUEVA SUPERMERCADO/g, upperFantasy)
    .replace(/Casa Nueva Supermercado/g, fantasy)
    .replace(/CASA NUEVA SUPER/g, upperFantasy)
    .replace(/Casa Nueva Super/g, fantasy)
    .replace(/CASA NUEVA ERP/g, erpTitle.toUpperCase())
    .replace(/Casa Nueva ERP/g, erpTitle)
    .replace(/Casa Nueva CN/g, fantasy)
    .replace(/CASA NUEVA/g, upperFantasy)
    .replace(/Casa Nueva/g, fantasy)
    .replace(/CLUB CACHITA/g, (brand.clubName || "CLUB MINISISTEMA").toUpperCase())
    .replace(/Club Cachita/g, brand.clubName || "Club MiniSistema")
    .replace(/Cachita/g, fantasy)
    .replace(/fidelizacion@cn\.com\.ar/gi, brand.emailInfo)
    .replace(/ventas@cn\.com\.ar/gi, brand.emailInfo)
    .replace(/\+54\s*9\s*3584\s*19-8605/g, brand.whatsappDisplay)
    .replace(/5493584198605/g, brand.whatsappDigits)
    .replace(/3584198605/g, brand.whatsappDigits)
    .replace(
      /Riveros Gigena N° 50 - Alcira Gigena \(Córdoba\)/g,
      brand.address
    )
    .replace(/www\.cn\.com\.ar/gi, tenant.custom_domain || "www.minisistema.com.ar")
    .replace(/https?:\/\/cn\.com\.ar/gi, "https://www.minisistema.com.ar")
    .replace(/\bcn\.com\.ar/gi, "minisistema.com.ar");
}

function transformHtmlOutsideScripts(
  html: string,
  tenant: ErpTenantRecord
): string {
  const blockRe =
    /(<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<!--[\s\S]*?-->)/gi;
  const parts = html.split(blockRe);
  for (let i = 0; i < parts.length; i += 2) {
    const tokens = parts[i].split(/(<[^>]+>)/g);
    for (let j = 0; j < tokens.length; j++) {
      if (j % 2 === 0) {
        tokens[j] = replaceVisibleCopy(tokens[j], tenant);
      } else {
        tokens[j] = tokens[j].replace(
          /\b(alt|title|placeholder|aria-label)="([^"]*)"/gi,
          (_m, attr, val) => `${attr}="${replaceVisibleCopy(val, tenant)}"`
        );
      }
    }
    parts[i] = tokens.join("");
  }
  return parts.join("");
}

export function renderErpHtmlResponse(params: {
  kind: "sistema" | "carrito" | "verificador";
  tenant: ErpTenantRecord;
  siteOrigin: string;
}): NextResponse {
  const { kind, tenant, siteOrigin } = params;

  // Validar si el módulo carrito / verificador está contratado en este comercio
  if (
    !tenant.is_base &&
    kind === "carrito" &&
    Array.isArray(tenant.enabled_modules) &&
    !tenant.enabled_modules.includes("carrito")
  ) {
    return new NextResponse(
      `<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8"><title>Módulo no habilitado</title></head><body style="font-family:system-ui;background:#112D3A;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:2rem;"><div><h1 style="color:#56D7A1;">Tienda Online / Carrito no contratado</h1><p>Este módulo no se encuentra activo en el plan actual de <strong>${tenant.fantasy_name}</strong>.</p><a href="${tenant.deployment.publicErpUrl}" style="color:#56D7A1;font-weight:700;">Ir al Sistema ERP</a></div></body></html>`,
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (
    !tenant.is_base &&
    kind === "verificador" &&
    Array.isArray(tenant.enabled_modules) &&
    !tenant.enabled_modules.includes("verificador")
  ) {
    return new NextResponse(
      `<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8"><title>Módulo no habilitado</title></head><body style="font-family:system-ui;background:#112D3A;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:2rem;"><div><h1 style="color:#56D7A1;">Verificador de Precios no contratado</h1><p>Este módulo no se encuentra activo en el plan actual de <strong>${tenant.fantasy_name}</strong>.</p></div></body></html>`,
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  let html = readTemplate(kind);
  const brand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );

  const primaryHex = brand.primaryHex || MS_COLORS.primaryHex;
  const accentHex = brand.accentHex || MS_COLORS.accentHex;
  const baseHref = kind === "carrito" ? "/carrito/" : "/sistema/";

  const erpPath =
    tenant.option_type === 2 && !tenant.is_base
      ? `/${tenant.slug}`
      : "/sistema";
  const carritoPath =
    tenant.option_type === 2 && !tenant.is_base
      ? `/${tenant.slug}/carrito`
      : "/carrito";
  const verificadorPath =
    tenant.option_type === 2 && !tenant.is_base
      ? `/${tenant.slug}/verificador`
      : "/verificador";

  const bootPayload = {
    slug: tenant.slug,
    isBase: tenant.is_base,
    optionType: tenant.option_type,
    businessName: tenant.business_name,
    fantasyName: tenant.fantasy_name,
    status: tenant.status,
    primaryHex,
    accentHex,
    logo1x1Url: brand.logo1x1Url,
    logoHorizontalUrl: brand.logoHorizontalUrl,
    logoSymbolUrl: brand.logoSymbolUrl,
    clubName: brand.clubName,
    address: brand.address,
    localidad: brand.localidad,
    provincia: brand.provincia,
    cp: brand.cp,
    whatsappDigits: brand.whatsappDigits,
    whatsappDisplay: brand.whatsappDisplay,
    emailInfo: brand.emailInfo,
    cuitFmt: brand.cuitFmt,
    condIva: brand.condIva,
    iibb: brand.iibb,
    inicioAct: brand.inicioAct,
    erpUrl: `${siteOrigin}${erpPath}`,
    carritoUrl: `${siteOrigin}${carritoPath}`,
    verificadorUrl: `${siteOrigin}${verificadorPath}`,
    enabledModules: tenant.enabled_modules,
  };

  const headInjection = `
  <base href="${baseHref}">
  <script>window.__ERP_TENANT_BOOT__ = ${JSON.stringify(bootPayload)};</script>
  <style id="ms-tenant-tokens">
    :root, html[data-brand="minisistema"] {
      --ms-primary: ${primaryHex};
      --ms-accent: ${accentHex};
      --ms-surface: #FFFFFF;
    }
  </style>
  <link rel="stylesheet" id="ms-brand-stylesheet" href="/sistema/assets/css/brand-minisistema.css?v=2">`;

  // 1. Marcar data-brand="minisistema" desde el byte 0 en <html>
  if (kind === "carrito") {
    html = html.replace(
      /<html\b[^>]*>/i,
      '<html lang="es-AR" data-brand="minisistema" data-theme="light">'
    );
    // Ocultar banner estático residual de Casa Nueva hasta cargar banners propios del tenant
    html = html.replace(
      /<div class="productos-hero-wrap" id="productos-hero-wrap">/i,
      '<div class="productos-hero-wrap" id="productos-hero-wrap" hidden>'
    );
    html = html.replace(
      /<div class="hero-carousel-track" id="hero-carousel-track">[\s\S]*?<\/div>\s*(?=<button type="button" class="hero-carousel-nav)/i,
      '<div class="hero-carousel-track" id="hero-carousel-track"></div>\n          '
    );
  } else {
    html = html.replace(
      /<html\b[^>]*>/i,
      '<html lang="es-AR" data-brand="minisistema">'
    );
  }

  // 2. Inyectar <base>, tokens de color y hoja brand-minisistema.css justo después de <meta charset...>
  html = html.replace(/(<meta\s+charset="[^"]*"\s*\/?>)/i, `$1${headInjection}`);

  // 3. Meta theme-color, favicons y manifest dinámico
  html = html.replace(
    /<meta\s+name="theme-color"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="theme-color" content="${primaryHex}">`
  );
  html = html.replace(
    /<link\s+rel="icon"[^>]*>/gi,
    `<link rel="icon" type="image/png" sizes="64x64" href="${brand.logoSymbolUrl}">`
  );
  html = html.replace(
    /<link\s+rel="apple-touch-icon"[^>]*>/gi,
    `<link rel="apple-touch-icon" sizes="180x180" href="${brand.logoSymbolUrl}">`
  );
  html = html.replace(
    /<link\s+rel="manifest"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="manifest" href="/${kind === "carrito" ? "carrito" : "sistema"}/manifest.webmanifest?tenant=${encodeURIComponent(tenant.slug)}">`
  );

  // 4. Reemplazar logos estáticos iniciales por la identidad oficial activa (MiniSistema u Opción 1)
  html = html.replace(
    /<img([^>]*class="[^"]*(?:store-brand-logo|topbar-icon)[^"]*"[^>]*)>/gi,
    (tag) =>
      tag
        .replace(/src="[^"]*"/i, `src="${brand.logoHorizontalUrl}"`)
        .replace(/alt="[^"]*"/i, `alt="${tenant.fantasy_name}"`)
  );
  html = html.replace(
    /<img([^>]*class="[^"]*(?:brand-emblem|club-previo-mascot|verificador-cachita-img)[^"]*"[^>]*)>/gi,
    (tag) =>
      tag
        .replace(/src="[^"]*"/i, `src="${brand.logo1x1Url}"`)
        .replace(/alt="[^"]*"/i, `alt="${tenant.fantasy_name}"`)
  );
  html = html.replace(
    /(<div class="footer-brand-row">\s*<img\s+)src="[^"]*"(\s+alt=")[^"]*(")/i,
    `$1src="${brand.logoHorizontalUrl}"$2${tenant.fantasy_name}$3`
  );
  html = html.replace(
    /(<(?:div|span)\s+class="(?:reiki-brand-badge|floating-login-brand|nx-avatar-badge)"[^>]*>\s*<img\s+)src="[^"]*"/gi,
    `$1src="${brand.logoSymbolUrl}"`
  );

  // 5. Asegurar carga de brand.js actualizado y superadmin-panel.js en /sistema
  html = html.replace(
    /src="(?:\.\.\/sistema\/)?assets\/js\/brand\.js[^"]*"/gi,
    'src="/sistema/assets/js/brand.js?v=2"'
  );

  if (kind === "sistema") {
    html = html.replace(
      "</body>",
      '  <script src="/sistema/assets/js/superadmin-panel.js?v=2"></script>\n</body>'
    );
  }

  // 6. Reemplazar textos visibles fuera de <script>/<style>
  html = transformHtmlOutsideScripts(html, tenant);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
