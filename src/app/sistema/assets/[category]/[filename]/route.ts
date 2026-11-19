import { NextRequest, NextResponse } from "next/server";
import { getTenantMediaFromDb } from "@/lib/erp/supabase-server";
import { resolveActiveTenantFromRequest } from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ category: string; filename: string }> }
) {
  const { filename } = await context.params;
  const tenant = await resolveActiveTenantFromRequest(req);
  const media = await getTenantMediaFromDb(tenant, filename);

  if (!media || !media.data_b64) {
    return new NextResponse("Not found", { status: 404 });
  }

  const bytes = Buffer.from(media.data_b64, "base64");
  const isPdf = (media.mime_type || "").toLowerCase().includes("pdf") || filename.toLowerCase().endsWith(".pdf");
  const download = req.nextUrl.searchParams.get("download") === "1";
  const headers: Record<string, string> = {
    "Content-Type": media.mime_type || (isPdf ? "application/pdf" : "image/jpeg"),
    "Cache-Control": "public, max-age=86400",
  };
  if (isPdf) {
    headers["Content-Disposition"] = `${download ? "attachment" : "inline"}; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`;
  }
  return new NextResponse(bytes, {
    status: 200,
    headers,
  });
}
