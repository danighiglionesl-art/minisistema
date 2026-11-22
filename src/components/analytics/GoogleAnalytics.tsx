"use client";

import React, { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { normalizeGaMeasurementId, trackGaEvent } from "@/lib/analytics";

interface GoogleAnalyticsProps {
  envMeasurementId?: string;
}

export function GoogleAnalytics({ envMeasurementId = "" }: GoogleAnalyticsProps) {
  const initialId = normalizeGaMeasurementId(envMeasurementId);
  const [measurementId, setMeasurementId] = useState<string>(initialId);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedUrlRef = useRef<string>("");

  // Si no vino por NEXT_PUBLIC_GA_MEASUREMENT_ID en build-time, consultar configuración dinámica (Vercel / Credenciales API)
  useEffect(() => {
    if (initialId) return;
    let cancelled = false;
    fetch("/api/public/analytics", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const resolved = normalizeGaMeasurementId(data?.measurementId);
        if (resolved) {
          setMeasurementId(resolved);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialId]);

  // Sincronizar ID activo en window y registrar page_view en navegaciones SPA
  useEffect(() => {
    if (!measurementId) return;
    window.__MS_GA_ID__ = measurementId;

    const qs = searchParams?.toString();
    const pagePath = qs ? `${pathname}?${qs}` : pathname || "/";
    if (lastTrackedUrlRef.current === pagePath) return;
    lastTrackedUrlRef.current = pagePath;

    if (typeof window.gtag === "function") {
      window.gtag("config", measurementId, {
        page_path: pagePath,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  }, [measurementId, pathname, searchParams]);

  // Delegación global para medir automáticamente clics de consulta por WhatsApp, teléfono y correo en todo minisistema.com.ar
  useEffect(() => {
    if (!measurementId) return;

    const handleDocumentClick = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = String(anchor.getAttribute("href") || "").trim();
      if (!href) return;

      const lower = href.toLowerCase();
      const label = (
        anchor.getAttribute("aria-label") ||
        anchor.getAttribute("title") ||
        anchor.textContent ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 100);
      const currentPath = window.location.pathname || "/";

      if (
        lower.includes("wa.me/") ||
        lower.includes("api.whatsapp.com/") ||
        lower.startsWith("whatsapp://")
      ) {
        trackGaEvent("consulta_whatsapp", {
          method: "whatsapp",
          page_path: currentPath,
          button_label: label || "Boton WhatsApp",
        });
        trackGaEvent("contact", {
          method: "whatsapp",
          page_path: currentPath,
          link_text: label || "WhatsApp",
        });
      } else if (lower.startsWith("mailto:")) {
        trackGaEvent("contact", {
          method: "email",
          page_path: currentPath,
          link_text: label || href.replace(/^mailto:/i, ""),
        });
      } else if (lower.startsWith("tel:")) {
        trackGaEvent("contact", {
          method: "phone",
          page_path: currentPath,
          link_text: label || href.replace(/^tel:/i, ""),
        });
      }
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [measurementId]);

  if (!measurementId) return null;

  return (
    <>
      <Script
        id="ms-ga4-src"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ms-ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}', {
            page_path: window.location.pathname + window.location.search,
            anonymize_ip: true
          });
        `}
      </Script>
    </>
  );
}
