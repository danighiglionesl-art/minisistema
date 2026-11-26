import { NextRequest } from "next/server";
import { handlePublicLaboratorioLookup } from "@/lib/erp/handlers/laboratorio-handler";
import {
  getTenantBySlug,
  resolveActiveTenantFromRequest,
} from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slugParam = String(url.searchParams.get("tenant") || "")
    .trim()
    .toLowerCase();
  const tenant = slugParam
    ? (await getTenantBySlug(slugParam)) ||
      (await resolveActiveTenantFromRequest(req))
    : await resolveActiveTenantFromRequest(req);

  return handlePublicLaboratorioLookup(req, tenant);
}
