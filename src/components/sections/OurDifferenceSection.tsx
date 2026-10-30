"use client";

import React, { useState } from "react";
import { Check, Minus, Layers, Sparkles, SlidersHorizontal } from "lucide-react";
import { COMPARISON_DATA } from "@/lib/site-data";
import { ComparisonDiagram } from "@/components/illustrations/SectionDiagrams";
import { BrandWordmark, InverseDot, renderWithBrandWordmark } from "@/components/brand/BrandWordmark";

export function OurDifferenceSection() {
  const [selectedRow, setSelectedRow] = useState<number>(0);

  return (
    <section className="relative border-t border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado de sección */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Nuestra diferencia</span>
          </span>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[var(--color-blanco)] sm:text-4xl lg:text-5xl">
            ¿Tu negocio se adapta al sistema{" "}
            <span className="text-[var(--color-menta)]">o el sistema a tu negocio?</span>
          </h2>

          <div className="mt-6 space-y-3 text-base sm:text-lg leading-relaxed text-[var(--color-blanco)]/80">
            <p>
              Cada negocio tiene su propia forma de trabajar
              <InverseDot fromColor="blanco" /> Sin embargo, muchas veces termina utilizando
              herramientas que no fueron pensadas para sus necesidades
              <InverseDot fromColor="blanco" />
            </p>
            <p>
              En <BrandWordmark className="mx-0.5" /> creemos que la tecnología debe adaptarse a las
              personas y a sus actividades,{" "}
              <span className="font-semibold text-[var(--color-menta)]">
                no al revés
                <InverseDot fromColor="menta" />
              </span>{" "}
              Por eso escuchamos, analizamos y desarrollamos soluciones específicas para cada cliente
              <InverseDot fromColor="blanco" />
            </p>
          </div>
        </div>

        {/* Comparación visual interactiva */}
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
          {/* Columna Izquierda: Sistemas Genéricos */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-6 sm:p-8">
            <div>
              <div className="flex items-center justify-between border-b border-[var(--color-blanco)]/10 pb-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-blanco)]/60">
                    Enfoque estándar
                  </span>
                  <h3 className="mt-1 text-xl sm:text-2xl font-bold text-[var(--color-blanco)]/90">
                    {COMPARISON_DATA.generic.title}
                  </h3>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/5 text-[var(--color-blanco)]/70">
                  <Layers className="h-5 w-5" />
                </span>
              </div>

              <p className="mt-3 text-xs sm:text-sm text-[var(--color-blanco)]/65">
                Cuando una herramienta enlatada no contempla las particularidades de tu actividad,
                suelen aparecer estas dificultades:
              </p>

              {/* Diagrama comparativo visual: Sistema genérico fragmentado */}
              <div className="mt-5">
                <ComparisonDiagram variant="generic" />
              </div>

              <ul className="mt-5 space-y-3">
                {COMPARISON_DATA.generic.points.map((item, idx) => {
                  const isActive = selectedRow === idx;
                  return (
                    <li key={item.label}>
                      <button
                        type="button"
                        onClick={() => setSelectedRow(idx)}
                        className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition-all ${
                          isActive
                            ? "border-[var(--color-blanco)]/35 bg-[var(--color-blanco)]/10"
                            : "border-[var(--color-blanco)]/10 bg-[var(--color-blanco)]/[0.02] hover:border-[var(--color-blanco)]/25"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-blanco)]/25 bg-[var(--color-blanco)]/10 text-[var(--color-blanco)]/75">
                            <Minus className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-bold text-sm sm:text-base text-[var(--color-blanco)]/90">
                            {item.label}
                          </span>
                        </div>
                        <p className="mt-2 pl-9 text-xs sm:text-sm leading-relaxed text-[var(--color-blanco)]/70">
                          {renderWithBrandWordmark(item.detail)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <p className="mt-6 border-t border-[var(--color-blanco)]/10 pt-4 text-[11px] leading-relaxed text-[var(--color-blanco)]/60">
              * Nota: Las plataformas estándar pueden resultar útiles en escenarios generales, pero
              frecuentemente presentan estas limitaciones cuando el negocio requiere procesos propios
              <InverseDot fromColor="blanco" />
            </p>
          </div>

          {/* Columna Derecha: MiniSistema (Destacada) */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl border-2 border-[var(--color-menta)] bg-[var(--color-blanco)]/[0.05] p-6 sm:p-8 shadow-2xl shadow-[var(--color-petroleo)]">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-blanco)]/15 pb-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--color-menta)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Enfoque a medida
                  </span>
                  <h3 className="mt-2 text-2xl sm:text-3xl font-extrabold text-[var(--color-blanco)] flex items-center">
                    <BrandWordmark className="h-7 sm:h-8" />
                  </h3>
                </div>
                <span className="rounded-xl bg-[var(--color-menta)] px-3.5 py-1.5 text-xs font-extrabold text-[var(--color-petroleo)]">
                  Hecho para tu negocio
                </span>
              </div>

              <p className="mt-3 text-sm sm:text-base text-[var(--color-blanco)]/85">
                Diseñamos cada pantalla y cada flujo a partir de cómo trabaja tu organización hoy y
                hacia dónde quiere crecer:
              </p>

              {/* Diagrama comparativo visual: Arquitectura centralizada MiniSistema */}
              <div className="mt-5">
                <ComparisonDiagram variant="minisistema" />
              </div>

              <ul className="mt-5 space-y-3">
                {COMPARISON_DATA.minisistema.points.map((item, idx) => {
                  const isActive = selectedRow === idx;
                  return (
                    <li key={item.label}>
                      <button
                        type="button"
                        onClick={() => setSelectedRow(idx)}
                        className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition-all ${
                          isActive
                            ? "border-[var(--color-menta)] bg-[var(--color-blanco)]/10 shadow-md"
                            : "border-[var(--color-blanco)]/15 bg-[var(--color-petroleo)]/70 hover:border-[var(--color-menta)]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-menta)] text-[var(--color-petroleo)]">
                              <Check className="h-4 w-4 stroke-[3]" />
                            </span>
                            <span className="font-extrabold text-sm sm:text-base text-[var(--color-blanco)]">
                              {item.label}
                            </span>
                          </div>
                          <span className="hidden sm:inline-block rounded-md border border-[var(--color-menta)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--color-menta)]">
                            Ventaja #{idx + 1}
                          </span>
                        </div>
                        <p className="mt-2 pl-9 text-xs sm:text-sm leading-relaxed text-[var(--color-blanco)]/85">
                          {renderWithBrandWordmark(item.detail)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-[var(--color-menta)] bg-[var(--color-petroleo)]/90 px-4 py-3.5">
              <p className="text-xs sm:text-sm font-semibold text-[var(--color-blanco)]">
                Concepto comercial:{" "}
                <span className="text-[var(--color-menta)]">
                  Tecnología que se adapta a vos, y no al revés
                  <InverseDot fromColor="menta" />
                </span>
              </p>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-menta)]">
                Seleccioná cada punto para comparar
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
