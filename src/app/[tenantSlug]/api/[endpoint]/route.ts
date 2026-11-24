import { NextRequest } from "next/server";
import { dispatchErpEndpoint } from "@/lib/erp/dispatch-endpoint";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ tenantSlug: string; endpoint: string }> }
) {
  const { tenantSlug, endpoint } = await context.params;
  return dispatchErpEndpoint(req, endpoint, tenantSlug);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ tenantSlug: string; endpoint: string }> }
) {
  const { tenantSlug, endpoint } = await context.params;
  return dispatchErpEndpoint(req, endpoint, tenantSlug);
}
