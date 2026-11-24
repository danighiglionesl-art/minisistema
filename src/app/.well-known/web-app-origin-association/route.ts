import { NextRequest, NextResponse } from "next/server";
import { resolveActiveTenantFromRequest } from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

function resolveDomainOrigins(req: NextRequest, customDomain: string | null): string[] {
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
    return rawHost ? [`https://${rawHost}`] : [];
  }

  const apex = rawHost.replace(/^www\./, "");
  return [`https://${apex}`, `https://www.${apex}`];
}

export async function GET(req: NextRequest) {
  const tenant = await resolveActiveTenantFromRequest(req);
  const origins = resolveDomainOrigins(req, tenant.custom_domain);
  const paths = ["/sistema", "/sistema/", "/carrito?panel=1", "/carrito", "/carrito/"];

  const webApps: Array<{ web_app_identity: string }> = [];
  const associationBody: Record<string, unknown> = {};
  for (const origin of origins) {
    for (const p of paths) {
      const identity = `${origin}${p}`;
      webApps.push({ web_app_identity: identity });
      // Formato estándar W3C / Chromium 127+ (clave = manifest id / start_url)
      associationBody[identity] = { scope: "/" };
    }
  }
  // Compatibilidad adicional con formato web_apps (origin trials anteriores)
  associationBody.web_apps = webApps;

  return NextResponse.json(
    associationBody,
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    }
  );
}
