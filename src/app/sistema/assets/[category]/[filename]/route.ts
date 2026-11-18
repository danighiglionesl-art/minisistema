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
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": media.mime_type || "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
