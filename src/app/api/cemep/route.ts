import { NextRequest, NextResponse } from "next/server";
import {
  handlePublicCemepGet,
  handlePublicCemepPost,
} from "@/lib/erp/handlers/consultorios-handler";
import {
  getTenantBySlug,
  resolveActiveTenantFromRequest,
} from "@/lib/erp/tenant-service";
import { ARGENTINA_OBRAS_SOCIALES_CATALOG } from "@/lib/erp/turnos-catalogs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const forcedSlug = req.nextUrl.searchParams.get("tenant") || "";
    const tenant = forcedSlug
      ? (await getTenantBySlug(forcedSlug)) ||
        (await resolveActiveTenantFromRequest(req))
      : await resolveActiveTenantFromRequest(req);
    return await handlePublicCemepGet(req, tenant);
  } catch (err) {
    const action = req.nextUrl.searchParams.get("action") || "";
    if (action === "obras_sociales") {
      return NextResponse.json({
        ok: true,
        fallback: true,
        obrasSociales: ARGENTINA_OBRAS_SOCIALES_CATALOG.map((os) => ({
          id: os.id,
          nombre: os.nombre,
          sigla: os.sigla || "",
          tipo: os.tipo || "",
        })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      });
    }
    if (action === "patient_me" || action === "prof_me") {
      return NextResponse.json({ ok: true, authenticated: false, transientError: true });
    }
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error
            ? `Demora temporal en base de datos: ${err.message}`
            : "Demora temporal en el servidor. Intentá nuevamente.",
      },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const forcedSlug = req.nextUrl.searchParams.get("tenant") || "";
    const tenant = forcedSlug
      ? (await getTenantBySlug(forcedSlug)) ||
        (await resolveActiveTenantFromRequest(req))
      : await resolveActiveTenantFromRequest(req);
    return await handlePublicCemepPost(req, tenant);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error
            ? `Demora temporal en base de datos: ${err.message}`
            : "Demora temporal en el servidor. Intentá nuevamente en unos segundos.",
      },
      { status: 503 }
    );
  }
}
