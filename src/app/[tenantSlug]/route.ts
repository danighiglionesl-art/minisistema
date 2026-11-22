import { NextRequest, NextResponse } from "next/server";
import { renderErpHtmlResponse } from "@/lib/erp/render-erp-app";
import { getTenantBySlug, isReservedAppSlug } from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await context.params;
  const clean = tenantSlug.trim().toLowerCase();

  if (isReservedAppSlug(clean)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const tenant = await getTenantBySlug(clean);
  if (!tenant) {
    return new NextResponse(
      `<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8"><title>Sistema no encontrado | MiniSistema</title></head><body style="margin:0;font-family:system-ui;background:#112D3A;color:#FFFFFF;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:2rem;"><div><img src="/brand/isotipo-m.png" alt="MiniSistema" style="width:72px;height:72px;object-fit:contain;margin-bottom:1rem;"><h1 style="margin:0 0 0.5rem;color:#56D7A1;">Sistema no registrado</h1><p style="color:rgba(255,255,255,0.78);max-width:420px;">El comercio <strong>/${clean}</strong> aún no fue habilitado por el Administrador General de MiniSistema.</p><a href="/" style="display:inline-block;margin-top:1.25rem;padding:0.75rem 1.4rem;border-radius:10px;background:#56D7A1;color:#112D3A;font-weight:800;text-decoration:none;">Volver a MiniSistema</a></div></body></html>`,
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "www.minisistema.com.ar";
  const proto =
    host.includes("localhost") || host.startsWith("127.") ? "http" : "https";

  return renderErpHtmlResponse({
    kind: "sistema",
    tenant,
    siteOrigin: `${proto}://${host}`,
    useSubpathRouting: true,
  });
}
