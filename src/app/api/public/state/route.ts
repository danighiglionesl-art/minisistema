import { NextResponse } from "next/server";
import { getPublicSiteState } from "@/lib/server/data-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = getPublicSiteState();
  return NextResponse.json(state);
}
