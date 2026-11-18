import { NextRequest } from "next/server";
import { renderErpHtmlResponse } from "@/lib/erp/render-erp-app";
import { resolveActiveTenantFromRequest } from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tenant = await resolveActiveTenantFromRequest(req);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "www.minisistema.com.ar";
  const proto = host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
  return renderErpHtmlResponse({
    kind: "sistema",
    tenant,
    siteOrigin: `${proto}://${host}`,
  });
}
