import { LeadStatus } from "@/types/minisistema";

export const VALID_LEAD_STATUSES: LeadStatus[] = [
  "Nueva",
  "Contactada",
  "En análisis",
  "Propuesta enviada",
  "Aprobada",
  "No concretada",
];

export interface InquiryValidationInput {
  source?: "configurador" | "contacto";
  businessActivity?: string;
  selectedNeeds?: string[];
  currentSystemStatus?: string;
  projectDescription?: string;
  preselectedCategory?: string | null;
  preselectedService?: string | null;
  contact?: {
    fullName?: string;
    businessName?: string;
    city?: string;
    province?: string;
    whatsapp?: string;
    email?: string;
    privacyConsent?: boolean;
  };
  honeypot?: string;
  captchaToken?: string;
}

export function sanitizeText(value: unknown, maxLength = 1500): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[<>]/g, "").slice(0, maxLength);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 16;
}

export function validateInquiryPayload(input: InquiryValidationInput): {
  valid: boolean;
  error?: string;
} {
  // Protección anti-spam (honeypot oculto)
  if (input.honeypot && input.honeypot.trim().length > 0) {
    return { valid: false, error: "Solicitud rechazada por filtro anti-spam." };
  }

  if (!input.captchaToken || !input.captchaToken.startsWith("ms-human-")) {
    return {
      valid: false,
      error: "Por favor tildá la casilla 'No soy un robot' para confirmar el envío.",
    };
  }

  const source = input.source || "configurador";
  const fullName = sanitizeText(input.contact?.fullName, 140);
  const businessName = sanitizeText(input.contact?.businessName, 160);
  const city = sanitizeText(input.contact?.city, 120);
  const province = sanitizeText(input.contact?.province, 120);
  const whatsapp = sanitizeText(input.contact?.whatsapp, 50);
  const email = sanitizeText(input.contact?.email, 200);
  const privacyConsent = Boolean(input.contact?.privacyConsent);
  const projectDescription = sanitizeText(input.projectDescription, 3000);

  if (!fullName || fullName.length < 2) {
    return { valid: false, error: "Por favor ingresá tu nombre y apellido." };
  }
  if (!isValidPhone(whatsapp)) {
    return { valid: false, error: "Por favor ingresá un número de WhatsApp válido." };
  }
  if (!isValidEmail(email)) {
    return { valid: false, error: "Por favor ingresá un correo electrónico válido." };
  }
  if (!privacyConsent) {
    return {
      valid: false,
      error: "Es necesario aceptar el consentimiento de tratamiento de datos personales.",
    };
  }
  if (!projectDescription || projectDescription.length < 5) {
    return {
      valid: false,
      error: "Por favor describí brevemente tu consulta o proyecto.",
    };
  }

  if (source === "configurador") {
    if (!sanitizeText(input.businessActivity, 100)) {
      return { valid: false, error: "Seleccioná la actividad principal de tu negocio." };
    }
    if (!Array.isArray(input.selectedNeeds) || input.selectedNeeds.length === 0) {
      return { valid: false, error: "Seleccioná al menos una necesidad para tu MiniSistema." };
    }
    if (!sanitizeText(input.currentSystemStatus, 140)) {
      return { valid: false, error: "Indicá si actualmente utilizan algún sistema." };
    }
    if (!businessName) {
      return { valid: false, error: "Ingresá el nombre comercial o institución." };
    }
    if (!city || !province) {
      return { valid: false, error: "Ingresá tu localidad y provincia." };
    }
  }

  return { valid: true };
}
