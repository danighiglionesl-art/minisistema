"use client";

import React, { useState, useEffect } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { NAV_ITEMS, buildWhatsAppLink, INITIAL_SITE_CONFIG } from "@/lib/site-data";
import { WhatsAppIcon } from "@/components/icons/SocialIcons";

interface HeaderProps {
  onOpenConfigurator: () => void;
}

export function Header({ onOpenConfigurator }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-all duration-300 ${
        scrolled
          ? "bg-[#112D3A]/95 backdrop-blur-md border-b border-[#FFFFFF]/10 py-2.5 shadow-lg shadow-[#112D3A]/50"
          : "bg-[#112D3A]/85 backdrop-blur-sm border-b border-[#FFFFFF]/5 py-3.5"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Isologotipo Oficial (Encabezado) */}
        <a
          href="#inicio"
          className="group flex items-center gap-3 focus:outline-none"
          aria-label="MiniSistema — Sistemas a Medida (Ir al inicio)"
        >
          {/* Versión móvil compacta + versión horizontal oficial */}
          <img
            src="/brand/header-isologotipo.png"
            alt="minisistema. SISTEMAS A MEDIDA"
            width={220}
            height={52}
            fetchPriority="high"
            className="h-9 w-auto sm:h-11 object-contain transition-transform duration-200 group-hover:scale-[1.01]"
          />
        </a>

        {/* Navegación Desktop */}
        <nav
          aria-label="Navegación principal"
          className="hidden xl:flex items-center gap-1 lg:gap-1.5"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-2.5 py-2 text-sm font-medium text-[#FFFFFF]/85 transition-colors hover:bg-[#FFFFFF]/5 hover:text-[#56D7A1]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Acciones Principales Desktop */}
        <div className="hidden md:flex items-center gap-2.5">
          <a
            href={buildWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Consultar por WhatsApp al ${INITIAL_SITE_CONFIG.whatsappDisplay}`}
            title="Hablar por WhatsApp"
            className="inline-flex items-center gap-2 rounded-xl border border-[#56D7A1]/35 bg-[#FFFFFF]/5 px-3.5 py-2.5 text-xs font-semibold text-[#FFFFFF] transition-all hover:border-[#56D7A1] hover:bg-[#56D7A1]/15"
          >
            <WhatsAppIcon size={16} className="text-[#56D7A1]" />
            <span className="hidden lg:inline">WhatsApp</span>
          </a>

          <button
            type="button"
            onClick={onOpenConfigurator}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#56D7A1] px-4 py-2.5 text-xs sm:text-sm font-bold tracking-wide text-[#112D3A] shadow-md shadow-[#56D7A1]/15 transition-all hover:bg-[#FFFFFF] hover:text-[#112D3A] active:scale-[0.99]"
          >
            <span>QUIERO MI MINISISTEMA</span>
            <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Botón Menú Móvil */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={onOpenConfigurator}
            className="rounded-lg bg-[#56D7A1] px-3 py-2 text-xs font-extrabold text-[#112D3A] transition-colors hover:bg-[#FFFFFF]"
          >
            QUIERO MI MINISISTEMA
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={mobileMenuOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
            className="inline-flex items-center justify-center rounded-xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/5 p-2.5 text-[#FFFFFF] transition-colors hover:border-[#56D7A1] hover:text-[#56D7A1]"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menú desplegable simple en móviles */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-menu"
          className="border-t border-[#FFFFFF]/10 bg-[#112D3A] px-4 pt-3 pb-6 shadow-2xl xl:hidden"
        >
          <nav aria-label="Menú móvil" className="flex flex-col space-y-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className="flex items-center justify-between rounded-xl px-3.5 py-3 text-base font-medium text-[#FFFFFF]/90 transition-colors hover:bg-[#FFFFFF]/5 hover:text-[#56D7A1]"
              >
                <span>{item.label}</span>
                <span className="text-xs text-[#56D7A1]">→</span>
              </a>
            ))}
          </nav>

          <div className="mt-4 flex flex-col gap-2.5 border-t border-[#FFFFFF]/10 pt-4">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenConfigurator();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#56D7A1] px-4 py-3.5 text-sm font-extrabold text-[#112D3A] transition-colors hover:bg-[#FFFFFF]"
            >
              <span>QUIERO MI MINISISTEMA</span>
              <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
            </button>

            <a
              href={buildWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleNavClick}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#56D7A1]/40 bg-[#FFFFFF]/5 px-4 py-3 text-sm font-semibold text-[#FFFFFF] transition-colors hover:bg-[#56D7A1]/15"
            >
              <WhatsAppIcon size={18} className="text-[#56D7A1]" />
              <span>Consultar por WhatsApp ({INITIAL_SITE_CONFIG.whatsappDisplay})</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
