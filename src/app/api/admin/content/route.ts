import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/server/crypto-auth";
import {
  CommercialContentSettings,
  updateContentAndFaqs,
} from "@/lib/server/data-store";
import { FaqItem } from "@/types/minisistema";
import { sanitizeText } from "@/lib/validation";

export async function PUT(request: NextRequest) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      faqs?: FaqItem[];
      commercialContent?: Partial<CommercialContentSettings>;
    };

    let cleanFaqs: FaqItem[] | undefined;
    if (Array.isArray(body.faqs)) {
      cleanFaqs = body.faqs
        .map((f, index) => ({
          id: sanitizeText(f.id, 60) || `faq-${index + 1}`,
          question: sanitizeText(f.question, 300),
          answer: sanitizeText(f.answer, 1500),
        }))
        .filter((f) => f.question.length > 0 && f.answer.length > 0);
    }

    let cleanContent: CommercialContentSettings | undefined;
    if (body.commercialContent) {
      const c = body.commercialContent;
      cleanContent = {
        heroTitleLine1: sanitizeText(c.heroTitleLine1 || "Tu negocio es", 120),
        heroTitleHighlight1: sanitizeText(c.heroTitleHighlight1 || "único", 80),
        heroTitleLine2: sanitizeText(c.heroTitleLine2 || "Tu sistema", 120),
        heroTitleHighlight2: sanitizeText(
          c.heroTitleHighlight2 || "también debería serlo",
          120
        ),
        heroSubtitle: sanitizeText(c.heroSubtitle, 400),
        evolutionSlogan: sanitizeText(c.evolutionSlogan, 200),
        finalCtaTitle: sanitizeText(c.finalCtaTitle, 200),
        finalCtaSubtitle: sanitizeText(c.finalCtaSubtitle, 400),
      };
    }

    const updated = updateContentAndFaqs({
      faqs: cleanFaqs,
      commercialContent: cleanContent,
    });

    return NextResponse.json({ ok: true, ...updated });
  } catch {
    return NextResponse.json(
      { error: "No se pudieron actualizar los contenidos." },
      { status: 500 }
    );
  }
}
