import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getErpAppVersion, getErpAssetVersion } from "./erp-version";
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
  const rawBrand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );
  // Resguardo: si el tenant casanueva aún apunta a las rutas viejas pisadas por MiniSistema, mapear a /assets/img/casanueva/
  const brand =
    tenant.slug === "casanueva"
      ? {
          ...rawBrand,
          logo1x1Url:
            rawBrand.logo1x1Url === "/sistema/assets/img/logo-full.png"
              ? "/sistema/assets/img/casanueva/logo-full.png"
              : rawBrand.logo1x1Url,
          logoHorizontalUrl:
            rawBrand.logoHorizontalUrl === "/sistema/assets/img/logo-full.png"
              ? "/sistema/assets/img/casanueva/logo-full.png"
              : rawBrand.logoHorizontalUrl,
          logoSymbolUrl:
            rawBrand.logoSymbolUrl === "/sistema/assets/img/icon-192.png"
              ? "/sistema/assets/img/casanueva/icon-192.png"
              : rawBrand.logoSymbolUrl,
        }
      : rawBrand;
  const fantasy = tenant.fantasy_name || tenant.business_name || "MiniSistema";
  const upperFantasy = fantasy.toUpperCase();
  const erpTitle = tenant.is_base ? "MiniSistema ERP" : `${fantasy} · ERP`;

  const cleanDomain = (tenant.custom_domain || "www.minisistema.com.ar")
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  const bareDomain = cleanDomain.replace(/^www\./i, "");

  // Para Casa Nueva la plantilla ya lleva su propia copia oficial; evitar doble reemplazo ("Supermercadomercado")
  if (tenant.slug === "casanueva") {
    return str
      .replace(/CLUB CACHITA/g, (brand.clubName || "CLUB FIDEL").toUpperCase())
      .replace(/Club Cachita/g, brand.clubName || "Club Fidel");
  }

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
    .replace(/Cachita/g, tenant.slug === "casanueva" ? "Cachita" : fantasy)
    .replace(/fidelizacion@cn\.com\.ar/gi, brand.emailInfo)
    .replace(/ventas@cn\.com\.ar/gi, brand.emailInfo)
    .replace(/\+54\s*9\s*3584\s*19-8605/g, brand.whatsappDisplay)
    .replace(/5493584198605/g, brand.whatsappDigits)
    .replace(/3584198605/g, brand.whatsappDigits)
    .replace(
      /Riveros Gigena N° 50 - Alcira Gigena \(Córdoba\)/g,
      brand.address
    )
    .replace(/www\.cn\.com\.ar/gi, cleanDomain)
    .replace(/https?:\/\/cn\.com\.ar/gi, `https://${cleanDomain}`)
    .replace(/\bcn\.com\.ar/gi, bareDomain);
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
  useSubpathRouting?: boolean;
}): NextResponse {
  const { kind, tenant, siteOrigin, useSubpathRouting = false } = params;

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
  const rawBrand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );
  // Resguardo: si el tenant casanueva aún apunta a las rutas viejas pisadas por MiniSistema, mapear a /assets/img/casanueva/
  const brand =
    tenant.slug === "casanueva"
      ? {
          ...rawBrand,
          logo1x1Url:
            rawBrand.logo1x1Url === "/sistema/assets/img/logo-full.png"
              ? "/sistema/assets/img/casanueva/logo-full.png"
              : rawBrand.logo1x1Url,
          logoHorizontalUrl:
            rawBrand.logoHorizontalUrl === "/sistema/assets/img/logo-full.png"
              ? "/sistema/assets/img/casanueva/logo-full.png"
              : rawBrand.logoHorizontalUrl,
          logoSymbolUrl:
            rawBrand.logoSymbolUrl === "/sistema/assets/img/icon-192.png"
              ? "/sistema/assets/img/casanueva/icon-192.png"
              : rawBrand.logoSymbolUrl,
        }
      : rawBrand;

  const primaryHex = brand.primaryHex || MS_COLORS.primaryHex;
  const accentHex = brand.accentHex || MS_COLORS.accentHex;
  const baseHref = kind === "carrito" ? "/carrito/" : "/sistema/";

  const subpathMode = !tenant.is_base && (tenant.option_type === 2 || useSubpathRouting);
  const erpPath = subpathMode ? `/${tenant.slug}` : "/sistema";
  const carritoPath = subpathMode ? `/${tenant.slug}/carrito` : "/carrito";
  const verificadorPath = subpathMode ? `/${tenant.slug}/verificador` : "/verificador";
  const turnosPath = subpathMode ? `/${tenant.slug}/turnos` : "/turnos";
  const cemepPath = subpathMode ? `/${tenant.slug}/cemep` : "/cemep";
  const inmobiliariaPath = subpathMode ? `/${tenant.slug}/inmobiliaria` : "/inmobiliaria";
  const asistenciaPath = subpathMode ? `/${tenant.slug}/asistencia` : "/asistencia";

  const assetVer = getErpAssetVersion();
  const appVersion = getErpAppVersion();
  const actividadNegocio =
    tenant.deployment?.actividadNegocio === "servicios" ||
    tenant.deployment?.actividadNegocio === "mixta"
      ? tenant.deployment.actividadNegocio
      : "comercial";

  const bootPayload = {
    slug: tenant.slug,
    isBase: tenant.is_base,
    optionType: tenant.option_type,
    actividadNegocio,
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
    turnosUrl: `${siteOrigin}${turnosPath}`,
    cemepUrl: `${siteOrigin}${cemepPath}`,
    inmobiliariaUrl: `${siteOrigin}${inmobiliariaPath}`,
    asistenciaUrl: `${siteOrigin}${asistenciaPath}`,
    enabledModules: tenant.enabled_modules,
    appVersion,
  };

  const headBootInjection = `
  <base href="${baseHref}">
  <script>window.__ERP_TENANT_BOOT__ = ${JSON.stringify(bootPayload)};</script>`;

  const headStyleInjection =
    kind === "carrito" && tenant.slug === "casanueva"
      ? ""
      : `
  <link rel="stylesheet" id="ms-brand-stylesheet" href="/sistema/assets/css/brand-minisistema.css?v=${assetVer}">
  <style id="ms-tenant-tokens">
    :root, html[data-brand="minisistema"], html[data-tenant="${tenant.slug}"] {
      --ms-primary: ${primaryHex};
      --ms-accent: ${accentHex};
      --ms-surface: #FFFFFF;
    }
  </style>`;

  // 1. Marcar data-brand y data-tenant desde el byte 0 en <html>
  if (kind === "carrito") {
    if (tenant.slug === "casanueva") {
      html = html.replace(
        /<html\b[^>]*>/i,
        `<html lang="es-AR" data-tenant="casanueva" data-theme="black-bg">`
      );
    } else {
      html = html.replace(
        /<html\b[^>]*>/i,
        `<html lang="es-AR" data-brand="minisistema" data-tenant="${tenant.slug}" data-theme="light">`
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
    }
    html = html.replace(
      /href="assets\/css\/carrito\.css(?:\?v=[^"]*)?"/gi,
      `href="assets/css/carrito.css?v=${assetVer}"`
    );
    html = html.replace(
      /src="assets\/js\/carrito\.js(?:\?v=[^"]*)?"/gi,
      `src="assets/js/carrito.js?v=${assetVer}"`
    );
  } else {
    html = html.replace(
      /<html\b[^>]*>/i,
      `<html lang="es-AR" data-brand="minisistema" data-tenant="${tenant.slug}" data-actividad="${actividadNegocio}">`
    );
  }

  // 2. Inyectar <base> y boot justo después de <meta charset...>, y hoja brand-minisistema.css antes de </head>
  html = html.replace(/(<meta\s+charset="[^"]*"\s*\/?>)/i, `$1${headBootInjection}`);
  html = html.replace(/<\/head>/i, `${headStyleInjection}\n</head>`);

  // 3. Meta theme-color, favicons y manifest dinámico
  html = html.replace(
    /<meta\s+name="theme-color"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="theme-color" content="${primaryHex}">`
  );
  html = html.replace(
    /<link\s+rel="icon"[^>]*>/gi,
    `<link rel="icon" type="image/png" sizes="64x64" href="${brand.logoSymbolUrl}?v=${assetVer}">`
  );
  html = html.replace(
    /<link\s+rel="apple-touch-icon"[^>]*>/gi,
    `<link rel="apple-touch-icon" sizes="180x180" href="${brand.logoSymbolUrl}?v=${assetVer}">`
  );
  html = html.replace(
    /<link\s+rel="manifest"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="manifest" href="/${kind === "carrito" ? "carrito" : "sistema"}/manifest.webmanifest?tenant=${encodeURIComponent(tenant.slug)}">`
  );

  // 4. Reemplazar logos estáticos iniciales por la identidad oficial activa (MiniSistema u Opción 1)
  const topbarLogoUrl =
    tenant.slug === "casanueva" ? brand.logoSymbolUrl : brand.logoHorizontalUrl;
  html = html.replace(
    /<img([^>]*class="[^"]*topbar-icon[^"]*"[^>]*)>/gi,
    (tag) =>
      tag
        .replace(/src="[^"]*"/i, `src="${topbarLogoUrl}"`)
        .replace(/alt="[^"]*"/i, `alt="${tenant.fantasy_name}"`)
  );
  html = html.replace(
    /<img([^>]*class="[^"]*store-brand-logo[^"]*"[^>]*)>/gi,
    (tag) =>
      tag
        .replace(/src="[^"]*"/i, `src="${brand.logoHorizontalUrl}"`)
        .replace(/alt="[^"]*"/i, `alt="${tenant.fantasy_name}"`)
  );
  const verificadorMascotUrl =
    tenant.slug === "casanueva"
      ? `/sistema/assets/img/casanueva/cachita.jpg?v=${assetVer}`
      : brand.logo1x1Url;
  const clubMascotUrl =
    tenant.slug === "casanueva"
      ? `/sistema/assets/img/casanueva/cachita-club.jpg?v=${assetVer}`
      : brand.logo1x1Url;
  html = html.replace(
    /<img([^>]*class="[^"]*brand-emblem[^"]*"[^>]*)>/gi,
    (tag) =>
      tag
        .replace(/src="[^"]*"/i, `src="${brand.logo1x1Url}"`)
        .replace(/alt="[^"]*"/i, `alt="${tenant.fantasy_name}"`)
  );
  html = html.replace(
    /<img([^>]*class="[^"]*verificador-cachita-img[^"]*"[^>]*)>/gi,
    (tag) =>
      tag
        .replace(/src="[^"]*"/i, `src="${verificadorMascotUrl}"`)
        .replace(
          /alt="[^"]*"/i,
          tenant.slug === "casanueva"
            ? 'alt="Cachita - Mascota de Casa Nueva"'
            : `alt="${tenant.fantasy_name}"`
        )
  );
  html = html.replace(
    /<img([^>]*class="[^"]*club-previo-mascot[^"]*"[^>]*)>/gi,
    (tag) =>
      tag
        .replace(/src="[^"]*"/i, `src="${clubMascotUrl}"`)
        .replace(
          /alt="[^"]*"/i,
          tenant.slug === "casanueva"
            ? 'alt="Fidel - Mascota de Club Fidel"'
            : `alt="${tenant.fantasy_name}"`
        )
  );
  html = html.replace(
    /(<div class="footer-brand-row">\s*<img\s+)src="[^"]*"(\s+alt=")[^"]*(")/i,
    `$1src="${brand.logoHorizontalUrl}"$2${tenant.fantasy_name}$3`
  );
  html = html.replace(
    /(<(?:div|span)\s+class="(?:reiki-brand-badge|floating-login-brand|nx-avatar-badge)"[^>]*>\s*<img\s+)src="[^"]*"/gi,
    `$1src="${brand.logoSymbolUrl}"`
  );

  // 5. Asegurar carga de brand.js, offline-pos.js (Capa 3 Contingencia) y superadmin-panel.js con la versión sincronizada del ERP
  html = html.replace(
    /src="(?:\.\.\/sistema\/)?assets\/js\/brand\.js[^"]*"/gi,
    `src="/sistema/assets/js/brand.js?v=${assetVer}"`
  );

  if (kind === "sistema") {
    html = html.replace(
      /(<script\s+src="\/sistema\/assets\/js\/brand\.js[^"]*"[^>]*><\/script>)/i,
      `$1\n  <script src="/sistema/assets/js/offline-pos.js?v=${assetVer}"></script>`
    );
    html = html.replace(
      /href="assets\/css\/styles\.css(?:\?v=[^"]*)?"/gi,
      `href="assets/css/styles.css?v=${assetVer}"`
    );
    html = html.replace(
      /src="assets\/js\/app\.js(?:\?v=[^"]*)?"/gi,
      `src="assets/js/app.js?v=${assetVer}"`
    );
    html = html.replace(
      /\s*<script\s+src="assets\/js\/mi-contador-module\.js[^"]*"[^>]*><\/script>/gi,
      ""
    );

    const enabledList = Array.isArray(tenant.enabled_modules)
      ? tenant.enabled_modules
      : [];
    const hasMod = (prefix: string) =>
      tenant.is_base ||
      enabledList.some((k) => k === prefix || String(k).startsWith(`${prefix}:`));

    const extraScripts: string[] = [];
    // Panel Maestro Único y productos globales exclusivos de MiniSistema Base (www.minisistema.com.ar/sistema)
    if (tenant.is_base) {
      extraScripts.push(`/sistema/assets/js/superadmin-panel.js?v=${assetVer}`);
      extraScripts.push(`/sistema/assets/js/feriarte-module.js?v=${assetVer}`);
      extraScripts.push(`/sistema/assets/js/don-contador-module.js?v=${assetVer}`);
      extraScripts.push(`/sistema/assets/js/reiki-online-module.js?v=${assetVer}`);
      extraScripts.push(`/sistema/assets/js/biblioteca-roncedo-module.js?v=${assetVer}`);
      extraScripts.push(`/sistema/assets/js/minisistemas-medida-module.js?v=${assetVer}`);
      extraScripts.push(`/sistema/assets/js/appcadi-module.js?v=${assetVer}`);
      extraScripts.push(`/sistema/assets/js/campo-directo-module.js?v=${assetVer}`);
    }
    if (hasMod("campo_directo") || hasMod("campodirecto")) {
      extraScripts.push(`/sistema/assets/js/campo-directo-module.js?v=${assetVer}`);
    }
    if (hasMod("appcadi") || hasMod("cadi")) {
      extraScripts.push(`/sistema/assets/js/appcadi-module.js?v=${assetVer}`);
    }
    if (hasMod("minisistema_medida")) {
      extraScripts.push(`/sistema/assets/js/minisistemas-medida-module.js?v=${assetVer}`);
    }
    if (hasMod("biblioteca_roncedo") || hasMod("roncedo")) {
      extraScripts.push(`/sistema/assets/js/biblioteca-roncedo-module.js?v=${assetVer}`);
    }
    if (hasMod("cv") || hasMod("personal")) {
      extraScripts.push(`/sistema/assets/js/cv-module.js?v=${assetVer}`);
    }
    if (hasMod("asistencia") || hasMod("personal")) {
      extraScripts.push(`/sistema/assets/js/asistencia-module.js?v=${assetVer}`);
    }
    if (hasMod("personal") || hasMod("cv") || hasMod("asistencia")) {
      extraScripts.push(`/sistema/assets/js/personal-module.js?v=${assetVer}`);
    }
    if (hasMod("turnos")) {
      extraScripts.push(`/sistema/assets/js/turnos-module.js?v=${assetVer}`);
    }
    if (hasMod("consultorios")) {
      extraScripts.push(`/sistema/assets/js/gestion-consultorios-module.js?v=${assetVer}`);
    }
    if (hasMod("gestion_web")) {
      extraScripts.push(`/sistema/assets/js/gestion-web-module.js?v=${assetVer}`);
    }
    if (hasMod("inmobiliaria")) {
      extraScripts.push(`/sistema/assets/js/inmobiliaria-module.js?v=${assetVer}`);
    }
    if (hasMod("mi_contador")) {
      extraScripts.push(`/sistema/assets/js/mi-contador-module.js?v=${assetVer}`);
    }
    if (hasMod("servicios")) {
      extraScripts.push(`/sistema/assets/js/servicios-module.js?v=${assetVer}`);
    }

    const scriptsBlock = extraScripts
      .map((src) => `  <script src="${src}"></script>`)
      .join("\n");
    html = html.replace("</body>", `${scriptsBlock}\n</body>`);
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
