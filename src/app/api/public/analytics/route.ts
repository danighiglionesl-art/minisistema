import { NextResponse } from "next/server";
import { getPlatformSecretsMap } from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const envId = (
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
    process.env.GA_MEASUREMENT_ID ||
    ""
  )
    .trim()
    .toUpperCase();

  if (/^G-[A-Z0-9]{4,16}$/.test(envId)) {
    return NextResponse.json(
      { ok: true, measurementId: envId, source: "env" },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } }
    );
  }

  try {
    const secrets = await getPlatformSecretsMap();
    const dbId = String(secrets.ga_measurement_id || "")
      .trim()
      .toUpperCase();
    if (/^G-[A-Z0-9]{4,16}$/.test(dbId)) {
      return NextResponse.json(
        { ok: true, measurementId: dbId, source: "platform_secrets" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
  } catch {
    // Si aún no está configurado en Supabase, retornar vacío sin bloquear la página
  }

  return NextResponse.json(
    { ok: true, measurementId: "", source: "unconfigured" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
