"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { INITIAL_SITE_CONFIG, NAV_ITEMS, buildWhatsAppLink } from "@/lib/site-data";
import { WhatsAppIcon, InstagramIcon, FacebookIcon } from "@/components/icons/SocialIcons";
import { BrandWordmark } from "@/components/brand/BrandWordmark";

interface FooterProps {
  onOpenConfigurator: () => void;
}

export function Footer({ onOpenConfigurator }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] text-[var(--color-blanco)]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Columna 1: Identidad de marca */}
          <div className="lg:col-span-5 flex flex-col items-start">
            <a href="#inicio" className="inline-block focus:outline-none">
              <img
                src="/brand/footer-isologotipo.png"
                alt="minisistema. SISTEMAS A MEDIDA"
                width={220}
                height={140}
                loading="lazy"
                className="h-24 w-auto object-contain"
              />
            </a>

            <p className="mt-4 max-w-md text-base font-semibold text-[var(--color-blanco)]">
              Tu negocio es único.{" "}
              <span className="text-[var(--color-menta)]">Tu sistema también debería serlo.</span>
            </p>

            <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--color-blanco)]/75">
              Diseñamos, desarrollamos y acompañamos soluciones digitales pensadas para cada
              negocio. Porque sabemos que las necesidades cambian, creamos sistemas que pueden
              evolucionar con vos.
            </p>

            <p className="mt-3 text-xs font-bold uppercase tracking-widest text-[var(--color-menta)]">
              Tu negocio evoluciona. Tu <BrandWordmark className="mx-0.5 h-3.5" /> también.
            </p>
          </div>

          {/* Columna 2: Navegación rápida */}
          <div className="lg:col-span-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
              Secciones del sitio
            </h3>
            <ul className="mt-4 space-y-2.5">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-sm text-[var(--color-blanco)]/80 transition-colors hover:text-[var(--color-menta)]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={onOpenConfigurator}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[var(--color-menta)] transition-colors hover:text-[var(--color-blanco)]"
                >
                  <span>Configurador de proyectos</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </li>
            </ul>
          </div>

          {/* Columna 3: Canales oficiales y contacto */}
          <div className="lg:col-span-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
              Canales oficiales de contacto
            </h3>
            <p className="mt-3 text-sm text-[var(--color-blanco)]/75">
              Contanos qué necesitás y conversemos sobre cómo crear una solución a medida para tu
              actividad.
            </p>

            <div className="mt-5 flex flex-col gap-3">
              <a
                href={buildWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between rounded-xl border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-4 py-3 text-sm font-semibold text-[var(--color-blanco)] transition-all hover:border-[var(--color-menta)] hover:bg-[var(--color-blanco)]/10"
              >
                <span className="flex items-center gap-2.5">
                  <WhatsAppIcon size={18} className="text-[var(--color-menta)]" />
                  <span>WhatsApp: {INITIAL_SITE_CONFIG.whatsappDisplay}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-[var(--color-menta)]" />
              </a>

              <div className="flex items-center gap-3 pt-1">
                <a
                  href={INITIAL_SITE_CONFIG.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram oficial de MiniSistema (@mini.sistema)"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/5 px-4 py-2.5 text-xs font-semibold text-[var(--color-blanco)] transition-all hover:border-[var(--color-menta)] hover:bg-[var(--color-blanco)]/10 hover:text-[var(--color-menta)]"
                >
                  <InstagramIcon size={17} className="text-[var(--color-menta)]" />
                  <span>Instagram</span>
                </a>

                <a
                  href={INITIAL_SITE_CONFIG.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook oficial de MiniSistema (mini.sistema)"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/5 px-4 py-2.5 text-xs font-semibold text-[var(--color-blanco)] transition-all hover:border-[var(--color-menta)] hover:bg-[var(--color-blanco)]/10 hover:text-[var(--color-menta)]"
                >
                  <FacebookIcon size={17} className="text-[var(--color-menta)]" />
                  <span>Facebook</span>
                </a>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-[var(--color-blanco)]/10 bg-[var(--color-blanco)]/[0.03] p-3.5 text-xs text-[var(--color-blanco)]/70">
              <div className="flex items-center gap-2 font-semibold text-[var(--color-blanco)]">
                <ShieldCheck className="h-4 w-4 text-[var(--color-menta)]" />
                <span>Protección de datos y transparencia comercial</span>
              </div>
              <p className="mt-1 leading-relaxed">
                Los servicios, alcances, tiempos de respuesta, mantenimiento y evolución se definen
                en cada propuesta comercial acordada.
              </p>
            </div>
          </div>
        </div>

        {/* Barra inferior */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[var(--color-blanco)]/10 pt-8 text-xs text-[var(--color-blanco)]/65 sm:flex-row">
          <p className="inline-flex flex-wrap items-center gap-1.5">
            <span>© {currentYear}</span>
            <BrandWordmark className="h-3.5" />
            <span>— SISTEMAS A MEDIDA. Todos los derechos reservados.</span>
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <Link
              href="/privacidad"
              className="transition-colors hover:text-[var(--color-menta)] underline underline-offset-4"
            >
              Política de Privacidad y Protección de Datos
            </Link>
            <a
              href="https://www.minisistema.com.ar"
              className="transition-colors hover:text-[var(--color-menta)]"
            >
              www.minisistema.com.ar
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
