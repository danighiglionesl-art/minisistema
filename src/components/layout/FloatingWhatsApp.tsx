"use client";

import React from "react";
import { buildWhatsAppLink, INITIAL_SITE_CONFIG } from "@/lib/site-data";
import { WhatsAppIcon } from "@/components/icons/SocialIcons";

export function FloatingWhatsApp() {
  return (
    <div className="fixed right-4 bottom-4 z-30 sm:right-6 sm:bottom-6">
      <a
        href={buildWhatsAppLink()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Contactar a MiniSistema por WhatsApp (${INITIAL_SITE_CONFIG.whatsappDisplay})`}
        title="Consultar por WhatsApp"
        className="group flex h-13 w-13 items-center justify-center rounded-full border-2 border-[var(--color-petroleo)] bg-[var(--color-menta)] text-[var(--color-petroleo)] shadow-xl shadow-[var(--color-petroleo)]/70 transition-all duration-200 hover:bg-[var(--color-blanco)] hover:scale-[1.05] active:scale-[0.98]"
      >
        <WhatsAppIcon size={26} className="text-[var(--color-petroleo)] shrink-0" />
      </a>
    </div>
  );
}
