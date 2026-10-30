import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/server/crypto-auth";
import {
  getAdminSiteConfig,
  getPublicSiteState,
  listInquiries,
  updateInquiryAdmin,
} from "@/lib/server/data-store";
import { VALID_LEAD_STATUSES, sanitizeText } from "@/lib/validation";
import { LeadStatus } from "@/types/minisistema";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const inquiries = listInquiries();
  const state = getPublicSiteState();
  const siteConfig = getAdminSiteConfig();
  return NextResponse.json({
    inquiries,
    projects: state.projects,
    faqs: state.faqs,
    commercialContent: state.commercialContent,
    siteConfig,
  });
}

export async function PATCH(request: NextRequest) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      status?: LeadStatus;
      observation?: string;
    };

    if (!body.id) {
      return NextResponse.json({ error: "Falta el identificador de la consulta." }, { status: 400 });
    }

    if (body.status && !VALID_LEAD_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Estado comercial inválido." }, { status: 400 });
    }

    const updated = updateInquiryAdmin(body.id, {
      status: body.status,
      newObservation: body.observation ? sanitizeText(body.observation, 1500) : undefined,
      actorEmail: admin.email,
    });

    if (!updated) {
      return NextResponse.json({ error: "Consulta no encontrada." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, inquiry: updated });
  } catch {
    return NextResponse.json(
      { error: "No se pudo actualizar la consulta." },
      { status: 500 }
    );
  }
}
