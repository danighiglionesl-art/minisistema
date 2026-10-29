"use client";

import React from "react";
import { ArrowUpRight, Compass, CheckCircle2, Sparkles } from "lucide-react";
import { MultiDeviceShowcase } from "@/components/illustrations/MultiDeviceShowcase";

interface HeroSectionProps {
  onOpenConfigurator: () => void;
}

export function HeroSection({ onOpenConfigurator }: HeroSectionProps) {
  return (
    <section
      id="inicio"
      className="relative overflow-hidden bg-[#112D3A] pt-8 pb-16 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28"
    >
      {/* Patrón geométrico arquitectónico sumamente sutil en blanco/menta */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(#56D7A1 1px, transparent 1px), radial-gradient(#FFFFFF 1px, #112D3A 1px)",
          backgroundSize: "40px 40px",
          backgroundPosition: "0 0, 20px 20px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Columna de texto y conversión comercial */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#56D7A1]/40 bg-[#56D7A1]/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#56D7A1]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>SISTEMAS A MEDIDA · TECNOLOGÍA QUE SE ADAPTA A VOS</span>
            </div>

            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-[#FFFFFF] sm:text-5xl lg:text-[3.35rem] lg:leading-[1.1]">
              Tu negocio es <span className="text-[#56D7A1]">único</span>.
              <span className="mt-1.5 block">
                Tu sistema <span className="text-[#56D7A1]">también debería serlo</span>.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-[#FFFFFF]/85">
              Diseñamos sistemas digitales a medida para simplificar tu trabajo, organizar tu
              negocio y acompañarte en cada etapa de crecimiento.
            </p>

            {/* Botones de acción principales */}
            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onOpenConfigurator}
                className="inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-[#56D7A1] px-7 py-4 text-sm sm:text-base font-extrabold tracking-wide text-[#112D3A] shadow-xl shadow-[#56D7A1]/20 transition-all duration-200 hover:bg-[#FFFFFF] hover:text-[#112D3A] hover:scale-[1.01] active:scale-[0.99]"
              >
                <span>QUIERO MI MINISISTEMA</span>
                <ArrowUpRight className="h-5 w-5 stroke-[2.5]" />
              </button>

              <a
                href="#como-trabajamos"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#FFFFFF]/25 bg-[#FFFFFF]/5 px-6 py-4 text-sm sm:text-base font-bold text-[#FFFFFF] transition-all duration-200 hover:border-[#56D7A1] hover:bg-[#56D7A1]/10 hover:text-[#56D7A1]"
              >
                <Compass className="h-5 w-5 text-[#56D7A1]" />
                <span>DESCUBRÍ CÓMO TRABAJAMOS</span>
              </a>
            </div>

            {/* Pilares rápidos de confianza */}
            <div className="mt-9 grid grid-cols-1 gap-3 border-t border-[#FFFFFF]/10 pt-6 sm:grid-cols-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[#FFFFFF]/85">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#56D7A1]" />
                <span>100% adaptado a tu actividad</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[#FFFFFF]/85">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#56D7A1]" />
                <span>Sin conocimientos técnicos</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[#FFFFFF]/85">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#56D7A1]" />
                <span>Evoluciona con tu negocio</span>
              </div>
            </div>
          </div>

          {/* Elemento visual principal: Computadora, Tablet y Teléfono */}
          <div className="lg:col-span-6">
            <MultiDeviceShowcase />
          </div>
        </div>
      </div>
    </section>
  );
}
