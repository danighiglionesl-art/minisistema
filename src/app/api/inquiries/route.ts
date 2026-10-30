import { NextRequest, NextResponse } from "next/server";
import { createInquiry, getAdminSiteConfig } from "@/lib/server/data-store";
import { sendHiddenInquiryEmail } from "@/lib/server/email-notifier";
import { sanitizeText, validateInquiryPayload, InquiryValidationInput } from "@/lib/validation";

// Control simple de frecuencia en memoria por IP para prevenir spam automatizado (Sección 26)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minuto
  const maxRequests = 8;
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "local-client";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        {
          error:
            "Demasiadas solicitudes en poco tiempo. Por favor aguardá un minuto e intentá nuevamente.",
        },
        { status: 429 }
      );
    }

    const body = (await request.json()) as InquiryValidationInput;
    const validation = validateInquiryPayload(body);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Datos de consulta inválidos." },
        { status: 400 }
      );
    }

    const source = body.source === "contacto" ? "contacto" : "configurador";
    const created = createInquiry({
      source,
      businessActivity: sanitizeText(body.businessActivity || "Consulta general", 120),
      selectedNeeds: Array.isArray(body.selectedNeeds)
        ? body.selectedNeeds.map((item) => sanitizeText(item, 100)).filter(Boolean)
        : [],
      currentSystemStatus: sanitizeText(body.currentSystemStatus || "No especificado", 150),
      projectDescription: sanitizeText(body.projectDescription, 3000),
      preselectedCategory: body.preselectedCategory
        ? sanitizeText(body.preselectedCategory, 120)
        : null,
      preselectedService: body.preselectedService
        ? sanitizeText(body.preselectedService, 120)
        : null,
      contact: {
        fullName: sanitizeText(body.contact?.fullName, 140),
        businessName: sanitizeText(body.contact?.businessName, 160),
        city: sanitizeText(body.contact?.city, 120),
        province: sanitizeText(body.contact?.province, 120),
        whatsapp: sanitizeText(body.contact?.whatsapp, 50),
        email: sanitizeText(body.contact?.email, 200),
        privacyConsent: Boolean(body.contact?.privacyConsent),
      },
    });

    // Envío en segundo plano desde el servidor al correo destinatario oculto (nunca expuesto en el cliente)
    try {
      const adminConfig = getAdminSiteConfig();
      await sendHiddenInquiryEmail(created, adminConfig.notificationRecipients);
    } catch {
      // No interrumpir el registro de la solicitud si el proveedor de correo externo demora
    }

    return NextResponse.json(
      {
        ok: true,
        inquiry: {
          id: created.id,
          createdAt: created.createdAt,
          status: created.status,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudo procesar la solicitud en este momento." },
      { status: 500 }
    );
  }
}
