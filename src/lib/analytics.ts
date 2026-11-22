"use client";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __MS_GA_ID__?: string;
  }
}

export function normalizeGaMeasurementId(raw?: string | null): string {
  const clean = String(raw || "").trim().toUpperCase();
  if (/^G-[A-Z0-9]{4,16}$/.test(clean)) {
    return clean;
  }
  return "";
}

export function trackGaEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | null | undefined>
): void {
  if (typeof window === "undefined") return;
  const cleanParams: Record<string, string | number | boolean> = {};
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        cleanParams[k] = v;
      }
    }
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, cleanParams);
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(["event", eventName, cleanParams]);
}

export function trackConsultaConversion(params: {
  lead_source: string;
  inquiry_id?: string;
  business_activity?: string;
  property_code?: string;
  property_operation?: string;
  page_path?: string;
  needs_count?: number;
}): void {
  const path =
    params.page_path ||
    (typeof window !== "undefined" ? window.location.pathname : "/");

  // Evento estándar oficial de Google Analytics 4 para conversiones de consultas/leads
  trackGaEvent("generate_lead", {
    lead_source: params.lead_source,
    inquiry_id: params.inquiry_id,
    business_activity: params.business_activity,
    property_code: params.property_code,
    property_operation: params.property_operation,
    needs_count: params.needs_count,
    page_path: path,
    currency: "ARS",
    value: 1,
  });

  // Evento descriptivo en español para lectura directa en paneles de GA4
  trackGaEvent("consulta_recibida", {
    origen_consulta: params.lead_source,
    comprobante_id: params.inquiry_id,
    rubro: params.business_activity,
    propiedad: params.property_code,
    pagina: path,
  });
}
