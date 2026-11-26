import { NextRequest } from "next/server";
import {
  handleCampoDirectoGet,
  handleCampoDirectoPost,
} from "@/lib/erp/handlers/campo-directo-handler";
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
  return handleCampoDirectoGet(req, tenant);
}

export async function POST(req: NextRequest) {
  const forcedSlug = req.nextUrl.searchParams.get("tenant") || "";
  const tenant = forcedSlug
    ? (await getTenantBySlug(forcedSlug)) ||
      (await resolveActiveTenantFromRequest(req))
    : await resolveActiveTenantFromRequest(req);
  return handleCampoDirectoPost(req, tenant);
}
