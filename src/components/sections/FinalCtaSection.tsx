"use client";

import React from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";

interface FinalCtaSectionProps {
  onOpenConfigurator: () => void;
}

export function FinalCtaSection({ onOpenConfigurator }: FinalCtaSectionProps) {
  return (
    <section className="relative overflow-hidden bg-[#56D7A1] py-20 sm:py-24 text-[#112D3A]">
      {/* Patrón decorativo sutil en azul petróleo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(#112D3A 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#112D3A]/25 bg-[#112D3A]/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[#112D3A]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Tecnología que se adapta a vos</span>
        </div>

        <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-[#112D3A] sm:text-5xl lg:text-6xl">
          Tu próximo gran paso puede empezar con un MiniSistema.
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-base sm:text-xl font-medium leading-relaxed text-[#112D3A]/90">
          Contanos qué necesitás. Diseñemos una solución que se adapte a tu negocio y pueda
          evolucionar con vos.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenConfigurator}
            className="inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-[#112D3A] px-8 py-4.5 text-sm sm:text-base font-extrabold tracking-wide text-[#FFFFFF] shadow-2xl shadow-[#112D3A]/30 transition-all duration-200 hover:bg-[#FFFFFF] hover:text-[#112D3A] hover:scale-[1.02] active:scale-[0.99]"
          >
            <span>HABLEMOS DE TU PROYECTO</span>
            <ArrowUpRight className="h-5 w-5 text-[#56D7A1]" />
          </button>

          <p className="mt-2 text-xs sm:text-sm font-bold text-[#112D3A]/85">
            Primera consulta sin costo ni compromiso.
          </p>
        </div>
      </div>
    </section>
  );
}
