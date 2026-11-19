import { NextRequest } from "next/server";
import {
  handlePublicCvCatalogs,
  handlePublicCvSubmission,
} from "@/lib/erp/handlers/cv-handler";
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
  return handlePublicCvCatalogs(req, tenant);
}

export async function POST(req: NextRequest) {
  const forcedSlug = req.nextUrl.searchParams.get("tenant") || "";
  const tenant = forcedSlug
    ? (await getTenantBySlug(forcedSlug)) ||
      (await resolveActiveTenantFromRequest(req))
    : await resolveActiveTenantFromRequest(req);
  return handlePublicCvSubmission(req, tenant);
}
