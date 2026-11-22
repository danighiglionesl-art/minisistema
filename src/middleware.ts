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

  // En dominios propios de Opción 1, la raíz "/" redirige al Carrito (si es tienda) o a /sistema
  if (!isMiniSistemaHost && req.nextUrl.pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = isStorefrontRootHost ? "/carrito" : "/sistema";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/sistema/:path*",
    "/carrito/:path*",
    "/verificador/:path*",
    "/cv/:path*",
    "/asistencia/:path*",
    "/turnos/:path*",
    "/cemep/:path*",
    "/inmobiliaria/:path*",
  ],
};
