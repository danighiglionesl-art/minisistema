"use client";

import React from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { BrandWordmark } from "@/components/brand/BrandWordmark";

interface FinalCtaSectionProps {
  onOpenConfigurator: () => void;
}

export function FinalCtaSection({ onOpenConfigurator }: FinalCtaSectionProps) {
  return (
    <section className="relative overflow-hidden border-t border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] py-20 sm:py-24 text-[var(--color-blanco)]">
      {/* Patrón decorativo sutil en blanco sobre azul petróleo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(var(--color-blanco) 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        {/* Ilustración tecnológica moderada y elegante de conexión y acompañamiento */}
        <div className="mx-auto mb-6 max-w-xs">
          <svg
            viewBox="0 0 280 56"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="w-full h-auto"
          >
            <path
              d="M20 28 H108 M172 28 H260"
              stroke="#56D7A1"
              strokeOpacity="0.45"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <circle cx="20" cy="28" r="4" fill="#FFFFFF" fillOpacity="0.5" />
            <circle cx="64" cy="28" r="5" fill="#56D7A1" />
            <rect
              x="110"
              y="10"
              width="60"
              height="36"
              rx="12"
              fill="#56D7A1"
              fillOpacity="0.16"
              stroke="#56D7A1"
              strokeWidth="2"
            />
            <path
              d="M132 28 L138 34 L150 22"
              stroke="#FFFFFF"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="216" cy="28" r="5" fill="#56D7A1" />
            <circle cx="260" cy="28" r="4" fill="#FFFFFF" fillOpacity="0.5" />
          </svg>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--color-menta)]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Tecnología que se adapta a vos</span>
        </div>

        <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-[var(--color-blanco)] sm:text-5xl lg:text-6xl">
          Tu próximo gran paso puede empezar con un{" "}
          <BrandWordmark className="mx-1 h-[0.95em]" />
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-base sm:text-xl font-medium leading-relaxed text-[var(--color-blanco)]/85">
          Contanos qué necesitás. Diseñemos una solución que se adapte a tu negocio y pueda
          evolucionar con vos.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenConfigurator}
            className="inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-[var(--color-menta)] px-8 py-4.5 text-sm sm:text-base font-extrabold tracking-wide text-[var(--color-petroleo)] shadow-2xl shadow-[var(--color-petroleo)]/50 transition-all duration-200 hover:bg-[var(--color-blanco)] hover:text-[var(--color-petroleo)] hover:scale-[1.02] active:scale-[0.99]"
          >
            <span>HABLEMOS DE TU PROYECTO</span>
            <ArrowUpRight className="h-5 w-5 text-[var(--color-petroleo)]" />
          </button>

          <p className="mt-2 text-xs sm:text-sm font-bold text-[var(--color-menta)]">
            Primera consulta sin costo ni compromiso.
          </p>
        </div>
      </div>
    </section>
  );
}
