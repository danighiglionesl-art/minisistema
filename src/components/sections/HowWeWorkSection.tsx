"use client";

import React, { useState } from "react";
import { WORKFLOW_STEPS } from "@/lib/site-data";
import { renderWithBrandWordmark } from "@/components/brand/BrandWordmark";
import {
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  Search,
  FileCheck2,
  Code2,
  Rocket,
  Handshake,
} from "lucide-react";

interface HowWeWorkSectionProps {
  onOpenConfigurator: () => void;
}

const STEP_ICONS = [
  MessageSquare,
  Search,
  FileCheck2,
  Code2,
  Rocket,
  Handshake,
];

export function HowWeWorkSection({ onOpenConfigurator }: HowWeWorkSectionProps) {
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

  return (
    <section
      id="como-trabajamos"
      className="relative border-t border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
            <span>Cómo trabajamos</span>
          </span>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[var(--color-blanco)] sm:text-4xl lg:text-5xl">
            De tu idea a <span className="text-[var(--color-menta)]">tu propio sistema</span>.
          </h2>

          <p className="mt-4 text-base sm:text-lg leading-relaxed text-[var(--color-blanco)]/80">
            No necesitás conocimientos técnicos. Nosotros nos ocupamos de transformar tus
            necesidades en una solución digital.
          </p>
        </div>

        {/* Barra de línea de tiempo horizontal interactiva (Computadoras) */}
        <div
          className="mt-14 hidden lg:block"
          onMouseLeave={() => setActiveStepIndex(null)}
        >
          <div className="relative mx-auto max-w-6xl px-6">
            {/* Conector base */}
            <div
              aria-hidden="true"
              className="absolute top-8 left-16 right-16 h-0.5 bg-[var(--color-blanco)]/15"
            />
            {/* Conector de progreso activo en verde menta */}
            <div
              aria-hidden="true"
              className="absolute top-8 left-16 h-0.5 bg-[var(--color-menta)] transition-all duration-300"
              style={{
                width:
                  activeStepIndex !== null
                    ? `calc(${(activeStepIndex / (WORKFLOW_STEPS.length - 1)) * 100}% - 4rem)`
                    : "0%",
              }}
            />

            <div className="relative grid grid-cols-6 gap-4">
              {WORKFLOW_STEPS.map((step, idx) => {
                const StepIcon = STEP_ICONS[idx] || MessageSquare;
                const isCurrent = idx === activeStepIndex;
                const isCompleted = activeStepIndex !== null && idx <= activeStepIndex;
                return (
                  <button
                    key={step.number}
                    type="button"
                    onClick={() => setActiveStepIndex(idx)}
                    onMouseEnter={() => setActiveStepIndex(idx)}
                    className="group flex cursor-pointer flex-col items-center text-center focus:outline-none"
                  >
                    <div
                      className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border-2 transition-all duration-200 ${
                        isCurrent
                          ? "scale-105 border-[var(--color-menta)] bg-[var(--color-menta)] text-[var(--color-petroleo)] shadow-[0_0_24px_rgba(86,215,161,0.35)]"
                          : isCompleted
                          ? "border-[var(--color-menta)] bg-[var(--color-petroleo)] text-[var(--color-menta)]"
                          : "border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] text-[var(--color-blanco)]/70 group-hover:border-[var(--color-menta)]/60 group-hover:text-[var(--color-blanco)]"
                      }`}
                    >
                      <StepIcon className="h-6 w-6" />
                      <span
                        className={`absolute -top-2 -right-2 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                          isCurrent
                            ? "bg-[var(--color-petroleo)] text-[var(--color-menta)] border border-[var(--color-menta)]"
                            : "bg-[var(--color-menta)] text-[var(--color-petroleo)]"
                        }`}
                      >
                        {index + 1}
                      </span>
                    </div>
                    <span
                      className={`mt-3 text-sm font-extrabold transition-colors ${
                        isCurrent ? "text-[var(--color-menta)]" : "text-[var(--color-blanco)]/85"
                      }`}
                    >
                      {step.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Línea de tiempo visual con 6 etapas (Vertical conectada en móvil / Grilla interactiva en desktop) */}
        <div
          className="relative mt-10 lg:mt-12"
          onMouseLeave={() => setActiveStepIndex(null)}
        >
          {/* Línea conectora vertical en dispositivos móviles */}
          <div
            aria-hidden="true"
            className="absolute top-6 bottom-6 left-6 w-0.5 bg-[var(--color-menta)]/35 md:hidden"
          />

          <ol className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW_STEPS.map((step, index) => {
              const StepIcon = STEP_ICONS[index] || MessageSquare;
              const isSelected = activeStepIndex === index;

              return (
                <li
                  key={step.number}
                  onMouseEnter={() => setActiveStepIndex(index)}
                  onClick={() => setActiveStepIndex(index)}
                  className={`group relative flex cursor-pointer flex-col justify-between rounded-3xl border p-6 sm:p-7 transition-all duration-200 ${
                    isSelected
                      ? "border-[var(--color-menta)] bg-[var(--color-blanco)]/[0.06] shadow-xl"
                      : "border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] hover:border-[var(--color-menta)] hover:bg-[var(--color-blanco)]/[0.06] active:border-[var(--color-menta)] active:bg-[var(--color-blanco)]/[0.06]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                          isSelected
                            ? "bg-[var(--color-menta)] text-[var(--color-petroleo)] shadow-md"
                            : "border border-[var(--color-menta)] bg-[var(--color-petroleo)] text-[var(--color-menta)] group-hover:bg-[var(--color-menta)] group-hover:text-[var(--color-petroleo)]"
                        }`}
                      >
                        <StepIcon className="h-5 w-5" />
                      </span>
                      <span className="rounded-full border border-[var(--color-menta)]/60 bg-[var(--color-blanco)]/5 px-3 py-1 text-[11px] font-bold text-[var(--color-menta)]">
                        Etapa {index + 1} de 6
                      </span>
                    </div>

                    <h3 className="mt-5 text-xl font-extrabold text-[var(--color-blanco)]">
                      {step.title}
                    </h3>

                    <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-[var(--color-blanco)]/80">
                      {renderWithBrandWordmark(step.description)}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center gap-2 border-t border-[var(--color-blanco)]/10 pt-4 text-xs font-semibold text-[var(--color-menta)]">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{step.highlight}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Llamado intermedio a iniciar la Etapa 1 */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 rounded-3xl border border-[var(--color-menta)] bg-[var(--color-blanco)]/[0.04] p-6 sm:flex-row sm:px-8">
          <div>
            <p className="text-base sm:text-lg font-extrabold text-[var(--color-blanco)]">
              ¿Empezamos por la Etapa 1 — Escuchamos?
            </p>
            <p className="mt-1 text-sm text-[var(--color-blanco)]/80">
              Completá el configurador en menos de 2 minutos y contanos cómo trabaja tu negocio.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenConfigurator}
            className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-menta)] px-6 py-3.5 text-sm font-extrabold text-[var(--color-petroleo)] transition-all hover:bg-[var(--color-blanco)]"
          >
            <span>CONTANOS TU IDEA</span>
            <ArrowRight className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </section>
  );
}
