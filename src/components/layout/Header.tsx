"use client";

import React, { useState, useEffect } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { NAV_ITEMS } from "@/lib/site-data";
import { BrandWordmark } from "@/components/brand/BrandWordmark";

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
          ? "bg-[var(--color-petroleo)]/95 backdrop-blur-md border-b border-[var(--color-blanco)]/10 py-2.5 shadow-lg shadow-[var(--color-petroleo)]/50"
          : "bg-[var(--color-petroleo)]/85 backdrop-blur-sm border-b border-[var(--color-blanco)]/5 py-3.5"
      }`}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-2 px-4 sm:px-6 lg:flex-nowrap lg:px-6 xl:px-8">
        {/* Isologotipo Oficial (Encabezado) */}
        <a
          href="#inicio"
          className="group flex shrink-0 items-center gap-3 focus:outline-none"
          aria-label="MiniSistema — Sistemas a Medida (Ir al inicio)"
        >
          <img
            src="/brand/header-isologotipo.png"
            alt="minisistema. SISTEMAS A MEDIDA"
            width={220}
            height={52}
            fetchPriority="high"
            className="h-9 w-auto xl:h-11 object-contain transition-transform duration-200 group-hover:scale-[1.01]"
          />
        </a>

        {/* Navegación Desktop */}
        <nav
          aria-label="Navegación principal"
          className="order-3 hidden w-full flex-wrap items-center justify-center gap-1 border-t border-[var(--color-blanco)]/10 pt-2 mt-1 md:flex lg:order-none lg:mt-0 lg:w-auto lg:flex-nowrap lg:border-0 lg:pt-0 lg:gap-1 xl:gap-2"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-2.5 xl:px-3 py-1.5 xl:py-2 text-xs xl:text-sm font-medium text-[var(--color-blanco)] transition-colors hover:bg-[var(--color-blanco)]/5 hover:text-[var(--color-menta)]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Acción Principal Desktop */}
        <div className="hidden md:flex shrink-0 items-center">
          <button
            type="button"
            onClick={onOpenConfigurator}
            className="inline-flex cursor-pointer items-center gap-1.5 xl:gap-2 whitespace-nowrap rounded-xl bg-[var(--color-menta)] px-3.5 xl:px-4 py-2 xl:py-2.5 text-xs xl:text-sm font-bold tracking-wide text-[var(--color-blanco)] shadow-md shadow-[var(--color-petroleo)]/50 transition-all hover:bg-[var(--color-blanco)] hover:text-[var(--color-petroleo)] active:scale-[0.99]"
          >
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span>QUIERO MI</span>
              <BrandWordmark onMintSurface />
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 stroke-[2.5]" />
          </button>
        </div>

        {/* Botón Menú Móvil */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={onOpenConfigurator}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--color-menta)] px-2.5 py-1.5 text-xs font-extrabold text-[var(--color-blanco)] transition-colors hover:bg-[var(--color-blanco)] hover:text-[var(--color-petroleo)]"
          >
            <span>QUIERO MI</span>
            <BrandWordmark onMintSurface />
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={mobileMenuOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
            className="inline-flex items-center justify-center rounded-xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/5 p-2.5 text-[var(--color-blanco)] transition-colors hover:border-[var(--color-menta)] hover:text-[var(--color-menta)]"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menú desplegable simple en móviles */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-menu"
          className="border-t border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] px-4 pt-3 pb-6 shadow-2xl md:hidden"
        >
          <nav aria-label="Menú móvil" className="flex flex-col space-y-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className="flex items-center justify-between rounded-xl px-3.5 py-3 text-base font-medium text-[var(--color-blanco)]/90 transition-colors hover:bg-[var(--color-blanco)]/5 hover:text-[var(--color-menta)]"
              >
                <span>{item.label}</span>
                <span className="text-xs text-[var(--color-menta)]">→</span>
              </a>
            ))}
          </nav>

          <div className="mt-4 flex flex-col gap-2.5 border-t border-[var(--color-blanco)]/10 pt-4">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenConfigurator();
              }}
              className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[var(--color-menta)] px-4 py-3.5 text-sm font-extrabold text-[var(--color-blanco)] transition-colors hover:bg-[var(--color-blanco)] hover:text-[var(--color-petroleo)]"
            >
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span>QUIERO MI</span>
                <BrandWordmark onMintSurface />
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 stroke-[2.5]" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
