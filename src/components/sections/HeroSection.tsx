"use client";

import React from "react";
import { ArrowUpRight, Compass, CheckCircle2, Sparkles } from "lucide-react";
import { MultiDeviceShowcase } from "@/components/illustrations/MultiDeviceShowcase";
import { BrandWordmark, InverseDot } from "@/components/brand/BrandWordmark";

interface HeroSectionProps {
  onOpenConfigurator: () => void;
}

export function HeroSection({ onOpenConfigurator }: HeroSectionProps) {
  return (
    <section
      id="inicio"
      className="relative overflow-hidden bg-[var(--color-petroleo)] pt-8 pb-16 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28"
    >
      {/* Patrón geométrico arquitectónico sumamente sutil en blanco */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(var(--color-blanco) 1px, transparent 1px), radial-gradient(var(--color-blanco) 1px, var(--color-petroleo) 1px)",
          backgroundSize: "40px 40px",
          backgroundPosition: "0 0, 20px 20px",
        }}
      />

      {/* Iluminación arquitectónica verde menta sumamente sutil en la esquina superior derecha */}
      <div
        aria-hidden="true"
        className="ms-mint-halo pointer-events-none absolute -top-32 right-0 h-[520px] w-[520px] rounded-full opacity-60 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-12">
          {/* Columna de texto y conversión comercial */}
          <div className="lg:col-span-6 animate-fade-up-subtle">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>SISTEMAS A MEDIDA · TECNOLOGÍA QUE SE ADAPTA A VOS</span>
            </div>

            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-[var(--color-blanco)] sm:text-5xl lg:text-[3.35rem] lg:leading-[1.1]">
              Tu negocio es{" "}
              <span className="text-[var(--color-menta)]">
                único
                <InverseDot fromColor="menta" />
              </span>
              <span className="mt-1.5 block">
                Tu sistema{" "}
                <span className="text-[var(--color-menta)]">
                  también debería serlo
                  <InverseDot fromColor="menta" />
                </span>
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-[var(--color-blanco)]/85">
              Diseñamos sistemas digitales a medida para simplificar tu trabajo, organizar tu
              negocio y acompañarte en cada etapa de crecimiento
              <InverseDot fromColor="blanco" />
            </p>

            {/* Botones de acción principales */}
            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onOpenConfigurator}
                className="inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-[var(--color-menta)] px-7 py-4 text-sm sm:text-base font-extrabold tracking-wide text-[var(--color-petroleo)] shadow-xl shadow-[var(--color-petroleo)]/50 transition-all duration-200 hover:bg-[var(--color-blanco)] hover:text-[var(--color-petroleo)] hover:scale-[1.01] active:scale-[0.99]"
              >
                <span className="inline-flex items-center gap-2">
                  <span>QUIERO MI</span>
                  <BrandWordmark onMintSurface />
                </span>
                <ArrowUpRight className="h-5 w-5 stroke-[2.5]" />
              </button>

              <a
                href="#como-trabajamos"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-6 py-4 text-sm sm:text-base font-bold text-[var(--color-blanco)] transition-all duration-200 hover:border-[var(--color-menta)] hover:bg-[var(--color-blanco)]/10 hover:text-[var(--color-menta)]"
              >
                <Compass className="h-5 w-5 text-[var(--color-menta)]" />
                <span>DESCUBRÍ CÓMO TRABAJAMOS</span>
              </a>
            </div>

            {/* Pilares rápidos de confianza */}
            <div className="mt-9 grid grid-cols-1 gap-3 border-t border-[var(--color-blanco)]/10 pt-6 sm:grid-cols-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--color-blanco)]/85">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-menta)]" />
                <span>100% adaptado a tu actividad</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--color-blanco)]/85">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-menta)]" />
                <span>Sin conocimientos técnicos</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--color-blanco)]/85">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-menta)]" />
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
