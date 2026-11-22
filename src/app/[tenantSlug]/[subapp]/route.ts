import { NextRequest, NextResponse } from "next/server";
import { renderErpHtmlResponse } from "@/lib/erp/render-erp-app";
import { getTenantBySlug, isReservedAppSlug } from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ tenantSlug: string; subapp: string }> }
) {
  const { tenantSlug, subapp } = await context.params;
  const cleanSlug = tenantSlug.trim().toLowerCase();
  const cleanSub = subapp.trim().toLowerCase();

  if (isReservedAppSlug(cleanSlug)) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!["sistema", "carrito", "verificador"].includes(cleanSub)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const tenant = await getTenantBySlug(cleanSlug);
  if (!tenant) {
    return new NextResponse("Sistema no encontrado", { status: 404 });
  }

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "www.minisistema.com.ar";
  const proto =
    host.includes("localhost") || host.startsWith("127.") ? "http" : "https";

  return renderErpHtmlResponse({
    kind: cleanSub as "sistema" | "carrito" | "verificador",
    tenant,
    siteOrigin: `${proto}://${host}`,
    useSubpathRouting: true,
  });
}
