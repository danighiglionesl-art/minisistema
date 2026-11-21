import { NextRequest } from "next/server";
import {
  handlePublicAsistenciaGet,
  handlePublicAsistenciaPost,
} from "@/lib/erp/handlers/asistencia-handler";
import {
  getTenantBySlug,
  resolveActiveTenantFromRequest,
} from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const forcedSlug = req.nextUrl.searchParams.get("tenant") || "";
  const tenant = forcedSlug
    ? (await getTenantBySlug(forcedSlug)) ||
      (await resolveActiveTenantFromRequest(req))
    : await resolveActiveTenantFromRequest(req);
  const res = await handlePublicAsistenciaGet(req, tenant);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  return res;
}

export async function POST(req: NextRequest) {
  const forcedSlug = req.nextUrl.searchParams.get("tenant") || "";
  const tenant = forcedSlug
    ? (await getTenantBySlug(forcedSlug)) ||
      (await resolveActiveTenantFromRequest(req))
    : await resolveActiveTenantFromRequest(req);
  const res = await handlePublicAsistenciaPost(req, tenant);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  return res;
}
