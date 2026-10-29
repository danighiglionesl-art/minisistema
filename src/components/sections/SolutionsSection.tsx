"use client";

import React from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Smartphone,
  CalendarCheck,
  Building2,
  Workflow,
  Factory,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { SOLUTION_CATEGORIES } from "@/lib/site-data";
import { SolutionCategory } from "@/types/minisistema";

interface SolutionsSectionProps {
  onSelectCategory: (category: SolutionCategory) => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  ShoppingBag,
  Smartphone,
  CalendarCheck,
  Building2,
  Workflow,
  Factory,
  Sparkles,
};

export function SolutionsSection({ onSelectCategory }: SolutionsSectionProps) {
  return (
    <section
      id="soluciones"
      className="relative border-t border-[#FFFFFF]/10 bg-[#112D3A] py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#56D7A1]/35 bg-[#56D7A1]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#56D7A1]">
            <span>Qué desarrollamos</span>
          </span>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#FFFFFF] sm:text-4xl lg:text-5xl">
            Una solución <span className="text-[#56D7A1]">para cada necesidad</span>.
          </h2>

          <p className="mt-4 text-base sm:text-lg leading-relaxed text-[#FFFFFF]/80">
            Desde una herramienta sencilla hasta una plataforma integral. Diseñamos lo que tu
            actividad realmente necesita.
          </p>
        </div>

        {/* Grilla de 8 tarjetas visuales */}
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SOLUTION_CATEGORIES.map((category) => {
            const IconComponent = ICON_MAP[category.iconName] || Sparkles;
            const isCustomIdea = category.id === "idea-propia";

            return (
              <article
                key={category.id}
                className={`group flex flex-col justify-between rounded-3xl border p-6 transition-all duration-200 ${
                  isCustomIdea
                    ? "border-2 border-[#56D7A1] bg-[#56D7A1]/10 shadow-xl"
                    : "border-[#FFFFFF]/15 bg-[#FFFFFF]/[0.03] hover:border-[#56D7A1]/60 hover:bg-[#FFFFFF]/[0.06]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-colors ${
                        isCustomIdea
                          ? "border-[#56D7A1] bg-[#56D7A1] text-[#112D3A]"
                          : "border-[#56D7A1]/35 bg-[#56D7A1]/15 text-[#56D7A1] group-hover:bg-[#56D7A1] group-hover:text-[#112D3A]"
                      }`}
                    >
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <span className="font-mono text-xs font-bold text-[#56D7A1]/80">
                      {category.number}
                    </span>
                  </div>

                  <h3 className="mt-5 text-xl font-extrabold text-[#FFFFFF]">
                    {category.title}
                  </h3>

                  <p className="mt-2.5 text-sm leading-relaxed text-[#FFFFFF]/80">
                    {category.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#FFFFFF]/10">
                  <p className="mb-3 text-[11px] font-medium text-[#56D7A1]">
                    {category.previewLabel}
                  </p>

                  <button
                    type="button"
                    onClick={() => onSelectCategory(category)}
                    className={`inline-flex w-full cursor-pointer items-center justify-between rounded-xl px-4 py-2.5 text-xs sm:text-sm font-extrabold transition-all ${
                      isCustomIdea
                        ? "bg-[#56D7A1] text-[#112D3A] hover:bg-[#FFFFFF]"
                        : "border border-[#56D7A1]/40 bg-[#56D7A1]/10 text-[#FFFFFF] group-hover:bg-[#56D7A1] group-hover:text-[#112D3A]"
                    }`}
                  >
                    <span>Quiero saber más</span>
                    <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Nota de alcance comercial */}
        <p className="mt-8 text-center text-xs text-[#FFFFFF]/65">
          * Estas categorías representan tipos de soluciones que podemos analizar y desarrollar. El
          alcance y las funcionalidades específicas se definen mediante evaluación previa de cada
          proyecto.
        </p>
      </div>
    </section>
  );
}
