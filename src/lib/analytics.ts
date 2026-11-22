"use client";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown> | unknown>;
    gtag?: (...args: unknown[]) => void;
    __MS_GA_ID__?: string;
    __MS_GTM_ID__?: string;
  }
}

export const DEFAULT_GTM_ID = "GTM-T3QW98PK";

export function normalizeGaMeasurementId(raw?: string | null): string {
  const clean = String(raw || "").trim().toUpperCase();
  if (/^(G|GT|AW)-[A-Z0-9]{4,16}$/.test(clean)) {
    return clean;
  }
  return "";
}

export function normalizeGtmId(raw?: string | null): string {
  const clean = String(raw || "").trim().toUpperCase();
  if (/^GTM-[A-Z0-9]{4,16}$/.test(clean)) {
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

  window.dataLayer = window.dataLayer || [];
  // Formato nativo de Google Tag Manager (dataLayer event object) para disparadores de GTM / GA4 / Google Ads
  window.dataLayer.push({
    event: eventName,
    ...cleanParams,
  });

  // Si además existe un ID directo G-... configurado vía gtag.js, enviar también por gtag()
  if (window.__MS_GA_ID__ && typeof window.gtag === "function") {
    window.gtag("event", eventName, cleanParams);
  }
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

  // Evento estándar oficial de Google Analytics 4 / GTM para conversiones de consultas y leads
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

  // Evento descriptivo en español para lectura y activación rápida de conversiones en GTM / GA4 / Google Ads
  trackGaEvent("consulta_recibida", {
    origen_consulta: params.lead_source,
    comprobante_id: params.inquiry_id,
    rubro: params.business_activity,
    propiedad: params.property_code,
    pagina: path,
  });
}
