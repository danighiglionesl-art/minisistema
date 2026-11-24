import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const rawHost = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    ""
  )
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");

  const isMiniSistemaHost =
    !rawHost ||
    rawHost === "localhost" ||
    rawHost === "127.0.0.1" ||
    rawHost === "minisistema.com.ar" ||
    rawHost === "www.minisistema.com.ar" ||
    rawHost.endsWith(".vercel.app");

  // Dominios de tiendas/supermercados cuya portada raíz "/" es el Carrito Online
  const isStorefrontRootHost =
    rawHost === "cn.com.ar" ||
    rawHost === "www.cn.com.ar" ||
    rawHost === "paseoalberdi.ar" ||
    rawHost === "www.paseoalberdi.ar";

  // Reescribir rutas PWA con barra final (/sistema/, /carrito/, /verificador/) sin 308 redirect
  // para mantener apps de escritorio ya instaladas con scope "/sistema/" dentro de su alcance sin barra URL superior.
  if (
    req.nextUrl.pathname === "/sistema/" ||
    req.nextUrl.pathname === "/carrito/" ||
    req.nextUrl.pathname === "/verificador/"
  ) {
    const url = req.nextUrl.clone();
    url.pathname = req.nextUrl.pathname.slice(0, -1);
    return NextResponse.rewrite(url);
  }

  // En dominios propios de Opción 1, la raíz "/" redirige al Carrito (si es tienda) o a /sistema
  if (!isMiniSistemaHost && req.nextUrl.pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = isStorefrontRootHost ? "/carrito" : "/sistema";
    return NextResponse.redirect(url);
  }

  // Alias directos a la App de Clientes / Panel del Usuario Registrado en dominios de supermercado
  if (
    isStorefrontRootHost &&
    (req.nextUrl.pathname === "/app" ||
      req.nextUrl.pathname === "/clientes" ||
      req.nextUrl.pathname === "/club" ||
      req.nextUrl.pathname === "/mi-cuenta")
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/carrito";
    url.searchParams.set("panel", "1");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/app",
    "/clientes",
    "/club",
    "/mi-cuenta",
    "/sistema",
    "/sistema/",
    "/sistema/:path*",
    "/carrito",
    "/carrito/",
    "/carrito/:path*",
    "/verificador",
    "/verificador/",
    "/verificador/:path*",
    "/cv/:path*",
    "/asistencia/:path*",
    "/turnos/:path*",
    "/cemep/:path*",
    "/inmobiliaria/:path*",
  ],
};
