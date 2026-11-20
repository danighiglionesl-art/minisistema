import { NextRequest } from "next/server";
import {
  handlePublicInmobiliariaGet,
  handlePublicInmobiliariaPost,
} from "@/lib/erp/handlers/inmobiliaria-handler";
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
  return handlePublicInmobiliariaGet(req, tenant);
}

export async function POST(req: NextRequest) {
  const forcedSlug = req.nextUrl.searchParams.get("tenant") || "";
  const tenant = forcedSlug
    ? (await getTenantBySlug(forcedSlug)) ||
      (await resolveActiveTenantFromRequest(req))
    : await resolveActiveTenantFromRequest(req);
  return handlePublicInmobiliariaPost(req, tenant);
}
