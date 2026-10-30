"use client";

import React from "react";
import { ArrowUpRight, Compass, CheckCircle2, Sparkles } from "lucide-react";
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
            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap xl:flex-nowrap sm:items-center">
              <button
                type="button"
                onClick={onOpenConfigurator}
                className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[var(--color-menta)] px-5 py-4 text-sm sm:text-[15px] font-extrabold tracking-wide text-[var(--color-blanco)] shadow-xl shadow-[var(--color-petroleo)]/50 transition-all duration-200 hover:bg-[var(--color-blanco)] hover:text-[var(--color-petroleo)] hover:scale-[1.01] active:scale-[0.99]"
              >
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className="whitespace-nowrap">QUIERO MI</span>
                  <BrandWordmark onMintSurface />
                </span>
                <ArrowUpRight className="h-5 w-5 shrink-0 stroke-[2.5]" />
              </button>

              <a
                href="#como-trabajamos"
                className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-5 py-4 text-sm sm:text-[15px] font-bold text-[var(--color-blanco)] transition-all duration-200 hover:border-[var(--color-menta)] hover:bg-[var(--color-blanco)]/10 hover:text-[var(--color-menta)]"
              >
                <Compass className="h-5 w-5 shrink-0 text-[var(--color-menta)]" />
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

          {/* Isologotipo Oficial de MiniSistema con gran presencia visual y animación de menor a mayor */}
          <div className="lg:col-span-6 flex items-center justify-center">
            <div className="relative flex w-full max-w-[540px] items-center justify-center py-6 sm:py-10">
              {/* Halo de iluminación verde menta con respiración detrás del isologotipo */}
              <div
                aria-hidden="true"
                className="ms-mint-halo animate-pulse-glow pointer-events-none absolute inset-0 rounded-full opacity-95 blur-2xl"
              />

              {/* Anillos concéntricos sutiles que acompañan el crecimiento del isologotipo */}
              <div
                aria-hidden="true"
                className="animate-hero-ring pointer-events-none absolute h-[290px] w-[290px] sm:h-[380px] sm:w-[380px] lg:h-[430px] lg:w-[430px] rounded-full border border-[var(--color-menta)]/25"
              />
              <div
                aria-hidden="true"
                style={{ animationDelay: "1.2s" }}
                className="animate-hero-ring pointer-events-none absolute h-[340px] w-[340px] sm:h-[440px] sm:w-[440px] lg:h-[495px] lg:w-[495px] rounded-full border border-dashed border-[var(--color-blanco)]/15"
              />

              <div className="animate-hero-logo-entrance relative z-10 w-full max-w-[380px] sm:max-w-[460px] lg:max-w-[500px]">
                <img
                  src="/brand/hero-isologotipo.png"
                  alt="minisistema. SISTEMAS A MEDIDA"
                  width={736}
                  height={458}
                  fetchPriority="high"
                  className="w-full h-auto object-contain drop-shadow-[0_24px_48px_rgba(17,45,58,0.85)] transition-transform duration-500 hover:scale-105"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bloque Personas + Tecnología (55% texto / 45% imagen en escritorio) */}
        <div className="mt-12 lg:mt-16 rounded-3xl border border-[var(--color-menta)]/35 bg-[var(--color-blanco)]/[0.03] p-6 sm:p-8 lg:p-10">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            {/* 55% Texto (7 columnas de 12) */}
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-menta)]/60 bg-[var(--color-petroleo)] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
                <span>Personas + Tecnología</span>
              </span>
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-[var(--color-blanco)] sm:text-3xl">
                Tecnología pensada para personas reales,{" "}
                <span className="text-[var(--color-menta)]">
                  en el trabajo diario
                  <InverseDot fromColor="menta" />
                </span>
              </h2>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-[var(--color-blanco)]/85">
                Detrás de cada <BrandWordmark className="mx-0.5" /> hay profesionales, comercios y
                equipos que necesitan resolver su día a día de forma simple y ágil, tanto desde la
                computadora como desde el celular
                <InverseDot fromColor="blanco" />
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <span className="rounded-xl border border-[var(--color-menta)]/40 bg-[var(--color-petroleo)] px-3 py-1.5 text-xs font-bold text-[var(--color-menta)]">
                  Uso real en notebook y celular
                </span>
                <span className="rounded-xl border border-[var(--color-blanco)]/15 bg-[var(--color-petroleo)] px-3 py-1.5 text-xs font-semibold text-[var(--color-blanco)]/85">
                  Interfaces claras y rápidas
                </span>
                <span className="rounded-xl border border-[var(--color-blanco)]/15 bg-[var(--color-petroleo)] px-3 py-1.5 text-xs font-semibold text-[var(--color-blanco)]/85">
                  Acompañamiento humano
                </span>
              </div>
            </div>

            {/* 45% Imagen Referencia 01 (5 columnas de 12) */}
            <div className="lg:col-span-5">
              <div className="group relative overflow-hidden rounded-2xl border border-[var(--color-menta)]/45 bg-[var(--color-petroleo)] shadow-2xl">
                <div className="aspect-[16/11] sm:aspect-[16/10] lg:aspect-[4/3] w-full overflow-hidden">
                  <img
                    src="/photos/ref-01.png"
                    alt="Profesional utilizando notebook y celular en su actividad diaria con un sistema a medida"
                    width={500}
                    height={500}
                    loading="eager"
                    className="h-full w-full scale-[1.03] object-cover object-top transition-transform duration-500 group-hover:scale-[1.06]"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)]/95 px-4 py-2.5">
                  <span className="text-xs font-bold text-[var(--color-blanco)]">
                    Gestión sincronizada en todos tus dispositivos
                  </span>
                  <BrandWordmark className="text-xs shrink-0" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
