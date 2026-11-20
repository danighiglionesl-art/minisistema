import { NextRequest } from "next/server";
import {
  handlePublicCemepGet,
  handlePublicCemepPost,
} from "@/lib/erp/handlers/consultorios-handler";
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
  return handlePublicCemepGet(req, tenant);
}

export async function POST(req: NextRequest) {
  const forcedSlug = req.nextUrl.searchParams.get("tenant") || "";
  const tenant = forcedSlug
    ? (await getTenantBySlug(forcedSlug)) ||
      (await resolveActiveTenantFromRequest(req))
    : await resolveActiveTenantFromRequest(req);
  return handlePublicCemepPost(req, tenant);
}
