import { NextResponse } from "next/server";
import { getPlatformSecretsMap } from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const gtmId = (process.env.NEXT_PUBLIC_GTM_ID || "GTM-T3QW98PK")
    .trim()
    .toUpperCase();

  const envId = (
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
    process.env.GA_MEASUREMENT_ID ||
    ""
  )
    .trim()
    .toUpperCase();

  if (/^(G|GT|AW)-[A-Z0-9]{4,16}$/.test(envId)) {
    return NextResponse.json(
      { ok: true, gtmId, measurementId: envId, source: "env" },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } }
    );
  }

  try {
    const secrets = await getPlatformSecretsMap();
    const dbId = String(secrets.ga_measurement_id || "")
      .trim()
      .toUpperCase();
    if (/^(G|GT|AW)-[A-Z0-9]{4,16}$/.test(dbId)) {
      return NextResponse.json(
        { ok: true, gtmId, measurementId: dbId, source: "platform_secrets" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
  } catch {
    // Retornar contenedor GTM activo sin bloquear
  }

  return NextResponse.json(
    { ok: true, gtmId, measurementId: "", source: "gtm_active" },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } }
  );
}
