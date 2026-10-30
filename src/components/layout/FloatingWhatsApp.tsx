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
        className="group flex items-center gap-2.5 rounded-full border-2 border-[var(--color-petroleo)] bg-[var(--color-menta)] px-4 py-3 text-[var(--color-petroleo)] shadow-xl shadow-[var(--color-petroleo)]/70 transition-all duration-200 hover:bg-[var(--color-blanco)] hover:scale-[1.03] active:scale-[0.98]"
      >
        <WhatsAppIcon size={22} className="text-[var(--color-petroleo)] shrink-0" />
        <span className="hidden sm:inline text-xs font-extrabold tracking-wide uppercase">
          WhatsApp
        </span>
      </a>
    </div>
  );
}
