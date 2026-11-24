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
  const paths = ["/sistema", "/sistema/", "/carrito?panel=1", "/carrito"];

  const webApps: Array<{ web_app_identity: string }> = [];
  for (const origin of origins) {
    for (const p of paths) {
      webApps.push({ web_app_identity: `${origin}${p}` });
    }
  }

  return NextResponse.json(
    { web_apps: webApps },
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    }
  );
}
