import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/server/crypto-auth";
import {
  ExtendedSiteConfig,
  updateSiteConfiguration,
} from "@/lib/server/data-store";
import { isValidEmail, isValidPhone, sanitizeText } from "@/lib/validation";

export async function PUT(request: NextRequest) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<ExtendedSiteConfig>;

    const whatsappNumber = (body.whatsappNumber || "").replace(/\D/g, "");
    if (!isValidPhone(whatsappNumber)) {
      return NextResponse.json(
        { error: "El número de WhatsApp comercial no tiene un formato válido." },
        { status: 400 }
      );
    }

    const commercialEmail = body.commercialEmail
      ? sanitizeText(body.commercialEmail, 200)
      : null;

    if (commercialEmail && !isValidEmail(commercialEmail)) {
      return NextResponse.json(
        { error: "El correo electrónico comercial ingresado no es válido." },
        { status: 400 }
      );
    }

    const instagramUrl = sanitizeText(body.instagramUrl, 300);
    const facebookUrl = sanitizeText(body.facebookUrl, 300);
    if (
      (instagramUrl && !instagramUrl.startsWith("https://")) ||
      (facebookUrl && !facebookUrl.startsWith("https://"))
    ) {
      return NextResponse.json(
        { error: "Los enlaces de redes sociales deben comenzar con https://." },
        { status: 400 }
      );
    }

    const recipients = Array.isArray(body.notificationRecipients)
      ? body.notificationRecipients
          .map((e) => sanitizeText(e, 200))
          .filter((e) => isValidEmail(e))
      : [];

    const updated = updateSiteConfiguration({
      whatsappNumber,
      whatsappDisplay: sanitizeText(body.whatsappDisplay || `+${whatsappNumber}`, 60),
      whatsappUrl: `https://wa.me/${whatsappNumber}`,
      defaultWhatsappMessage: sanitizeText(body.defaultWhatsappMessage, 500),
      instagramUrl,
      facebookUrl,
      commercialEmail,
      physicalAddress: body.physicalAddress
        ? sanitizeText(body.physicalAddress, 250)
        : null,
      institutionalDescriptor: sanitizeText(
        body.institutionalDescriptor || "SISTEMAS A MEDIDA",
        100
      ),
      notificationRecipients: recipients,
    });

    return NextResponse.json({ ok: true, siteConfig: updated });
  } catch {
    return NextResponse.json(
      { error: "No se pudo guardar la configuración." },
      { status: 500 }
    );
  }
}
