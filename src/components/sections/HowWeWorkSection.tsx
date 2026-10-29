"use client";

import React from "react";
import { WORKFLOW_STEPS } from "@/lib/site-data";
import { ArrowRight, CheckCircle2 } from "lucide-react";

interface HowWeWorkSectionProps {
  onOpenConfigurator: () => void;
}

export function HowWeWorkSection({ onOpenConfigurator }: HowWeWorkSectionProps) {
  return (
    <section
      id="como-trabajamos"
      className="relative border-t border-[#FFFFFF]/10 bg-[#112D3A] py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#56D7A1]/35 bg-[#56D7A1]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#56D7A1]">
            <span>Cómo trabajamos</span>
          </span>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#FFFFFF] sm:text-4xl lg:text-5xl">
            De tu idea a <span className="text-[#56D7A1]">tu propio sistema</span>.
          </h2>

          <p className="mt-4 text-base sm:text-lg leading-relaxed text-[#FFFFFF]/80">
            No necesitás conocimientos técnicos. Nosotros nos ocupamos de transformar tus
            necesidades en una solución digital.
          </p>
        </div>

        {/* Línea de tiempo visual con 6 etapas */}
        <div className="relative mt-16">
          {/* Línea conectora visible en desktop */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-12 left-8 right-8 h-0.5 bg-[#56D7A1]/25"
          />

          <ol className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW_STEPS.map((step, index) => (
              <li
                key={step.number}
                className="relative flex flex-col justify-between rounded-3xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/[0.03] p-6 sm:p-7 transition-all hover:border-[#56D7A1]/60 hover:bg-[#FFFFFF]/[0.05]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#56D7A1] text-base font-extrabold text-[#112D3A] shadow-md">
                      {step.number}
                    </span>
                    <span className="rounded-full border border-[#56D7A1]/30 bg-[#56D7A1]/10 px-3 py-1 text-[11px] font-bold text-[#56D7A1]">
                      Etapa {index + 1} de 6
                    </span>
                  </div>

                  <h3 className="mt-6 text-xl font-extrabold text-[#FFFFFF]">
                    {step.number} — {step.title}
                  </h3>

                  <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-[#FFFFFF]/80">
                    {step.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center gap-2 border-t border-[#FFFFFF]/10 pt-4 text-xs font-semibold text-[#56D7A1]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{step.highlight}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Llamado intermedio a iniciar el paso 01 */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 rounded-3xl border border-[#56D7A1]/35 bg-[#56D7A1]/10 p-6 sm:flex-row sm:px-8">
          <div>
            <p className="text-base sm:text-lg font-extrabold text-[#FFFFFF]">
              ¿Empezamos por el Paso 01 — Escuchamos?
            </p>
            <p className="mt-1 text-sm text-[#FFFFFF]/80">
              Completá el configurador en menos de 2 minutos y contanos cómo trabaja tu negocio.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenConfigurator}
            className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-[#56D7A1] px-6 py-3.5 text-sm font-extrabold text-[#112D3A] transition-all hover:bg-[#FFFFFF]"
          >
            <span>CONTANOS TU IDEA</span>
            <ArrowRight className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </section>
  );
}
