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
import { CategoryIllustration } from "@/components/illustrations/CategoryIllustrations";

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
      className="relative border-t border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
            <span>Qué desarrollamos</span>
          </span>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[var(--color-blanco)] sm:text-4xl lg:text-5xl">
            Una solución <span className="text-[var(--color-menta)]">para cada necesidad</span>.
          </h2>

          <p className="mt-4 text-base sm:text-lg leading-relaxed text-[var(--color-blanco)]/80">
            Desde una herramienta sencilla hasta una plataforma integral. Diseñamos lo que tu
            actividad realmente necesita.
          </p>
        </div>

        {/* Grilla de 8 tarjetas visuales: todas iguales en reposo, se destacan solo al pasar el mouse o el dedo */}
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SOLUTION_CATEGORIES.map((category) => {
            const IconComponent = ICON_MAP[category.iconName] || Sparkles;

            return (
              <article
                key={category.id}
                className="group flex flex-col justify-between rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-6 transition-all duration-200 hover:border-[var(--color-menta)] hover:bg-[var(--color-blanco)]/[0.06] hover:shadow-xl active:border-[var(--color-menta)] active:bg-[var(--color-blanco)]/[0.06] focus-within:border-[var(--color-menta)] focus-within:bg-[var(--color-blanco)]/[0.06]"
              >
                <div>
                  {/* Ilustración tecnológica uniforme de la categoría */}
                  <div className="mb-5 overflow-hidden rounded-2xl transition-transform duration-300 group-hover:scale-[1.01] group-active:scale-[1.01]">
                    <CategoryIllustration categoryId={category.id} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 text-[var(--color-menta)] transition-colors group-hover:bg-[var(--color-menta)] group-hover:text-[var(--color-petroleo)] group-active:bg-[var(--color-menta)] group-active:text-[var(--color-petroleo)] group-focus-within:bg-[var(--color-menta)] group-focus-within:text-[var(--color-petroleo)]">
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs font-bold text-[var(--color-menta)]">
                      {category.number}
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl font-extrabold text-[var(--color-blanco)]">
                    {category.title}
                  </h3>

                  <p className="mt-2.5 text-sm leading-relaxed text-[var(--color-blanco)]/80">
                    {category.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--color-blanco)]/10">
                  <p className="mb-3 text-[11px] font-medium text-[var(--color-menta)]">
                    {category.previewLabel}
                  </p>

                  <button
                    type="button"
                    onClick={() => onSelectCategory(category)}
                    className="inline-flex w-full cursor-pointer items-center justify-between rounded-xl border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-[var(--color-blanco)] transition-all group-hover:bg-[var(--color-menta)] group-hover:text-[var(--color-petroleo)] group-active:bg-[var(--color-menta)] group-active:text-[var(--color-petroleo)] group-focus-within:bg-[var(--color-menta)] group-focus-within:text-[var(--color-petroleo)] hover:bg-[var(--color-menta)] hover:text-[var(--color-petroleo)] active:bg-[var(--color-menta)] active:text-[var(--color-petroleo)]"
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
        <p className="mt-8 text-center text-xs text-[var(--color-blanco)]/65">
          * Estas categorías representan tipos de soluciones que podemos analizar y desarrollar. El
          alcance y las funcionalidades específicas se definen mediante evaluación previa de cada
          proyecto.
        </p>
      </div>
    </section>
  );
}
