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

  // En dominios propios de Opción 1 (ej: www.nuevoerp.com.ar), la raíz "/" redirige a /sistema
  if (!isMiniSistemaHost && req.nextUrl.pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/sistema";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/sistema/:path*", "/carrito/:path*", "/verificador/:path*"],
};
