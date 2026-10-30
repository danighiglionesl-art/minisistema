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
import {
  BrandWordmark,
  InverseDot,
  renderWithBrandWordmark,
} from "@/components/brand/BrandWordmark";

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
            Una solución{" "}
            <span className="text-[var(--color-menta)]">
              para cada necesidad
              <InverseDot fromColor="menta" />
            </span>
          </h2>

          <p className="mt-4 text-base sm:text-lg leading-relaxed text-[var(--color-blanco)]/80">
            Desde una herramienta sencilla hasta una plataforma integral
            <InverseDot fromColor="blanco" /> Diseñamos lo que tu actividad realmente necesita
            <InverseDot fromColor="blanco" />
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

                  <div className="flex items-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 text-[var(--color-menta)] transition-colors group-hover:bg-[var(--color-menta)] group-hover:text-[var(--color-petroleo)] group-active:bg-[var(--color-menta)] group-active:text-[var(--color-petroleo)] group-focus-within:bg-[var(--color-menta)] group-focus-within:text-[var(--color-petroleo)]">
                      <IconComponent className="h-5 w-5" />
                    </div>
                  </div>

                  <h3 className="mt-4 text-xl font-extrabold text-[var(--color-blanco)]">
                    {category.title}
                  </h3>

                  <p className="mt-2.5 text-sm leading-relaxed text-[var(--color-blanco)]/80">
                    {renderWithBrandWordmark(category.description)}
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

        {/* Bloques Personas + Tecnología en Soluciones (Composiciones 55/45 alternando lados en escritorio) */}
        <div className="mt-16 space-y-8">
          {/* Escena 1: Comercio y atención en local (Referencia 02 — Imagen a la izquierda 45% / Texto a la derecha 55%) */}
          <div className="rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-6 sm:p-8 lg:p-10 transition-colors hover:border-[var(--color-menta)]/60">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <div className="group relative overflow-hidden rounded-2xl border border-[var(--color-menta)]/40 bg-[var(--color-petroleo)] shadow-xl">
                  <div className="aspect-[16/11] sm:aspect-[16/10] lg:aspect-[4/3] w-full overflow-hidden">
                    <img
                      src="/photos/ref-02.png"
                      alt="Comerciante trabajando con una tablet en su local para gestionar ventas, pedidos y stock"
                      width={500}
                      height={500}
                      loading="lazy"
                      className="h-full w-full scale-[1.03] object-cover object-top transition-transform duration-500 group-hover:scale-[1.06]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)]/95 px-4 py-2.5">
                    <span className="text-xs font-bold text-[var(--color-menta)]">
                      Comercios · Ventas, pedidos y atención ágil
                    </span>
                    <BrandWordmark className="text-xs shrink-0" />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-menta)]/60 bg-[var(--color-petroleo)] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
                  <span>Gestión comercial en el mostrador o salón</span>
                </span>
                <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-[var(--color-blanco)] sm:text-3xl">
                  Agilidad para vender, cobrar y controlar{" "}
                  <span className="text-[var(--color-menta)]">
                    tu negocio en tiempo real
                    <InverseDot fromColor="menta" />
                  </span>
                </h3>
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-[var(--color-blanco)]/85">
                  Ya sea en un local comercial, gastronomía, tienda minorista o servicio al cliente,
                  tu <BrandWordmark className="mx-0.5" /> te permite consultar precios, registrar
                  ventas, controlar caja y actualizar el stock desde una tablet, notebook o celular
                  sin demoras
                  <InverseDot fromColor="blanco" />
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["Ventas y Caja", "Listas de precios", "Stock al instante", "Clientes y Cuentas"].map(
                    (tag) => (
                      <span
                        key={tag}
                        className="rounded-xl border border-[var(--color-menta)]/35 bg-[var(--color-petroleo)] px-3 py-1.5 text-xs font-bold text-[var(--color-blanco)]"
                      >
                        {tag}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Escena 2: Operación, depósito y logística (Referencia 05 — Texto a la izquierda 55% / Imagen a la derecha 45%) */}
          <div className="rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-6 sm:p-8 lg:p-10 transition-colors hover:border-[var(--color-menta)]/60">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
              <div className="order-2 lg:order-1 lg:col-span-7">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-menta)]/60 bg-[var(--color-petroleo)] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
                  <span>Inventario, logística y procesos operativos</span>
                </span>
                <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-[var(--color-blanco)] sm:text-3xl">
                  Orden y trazabilidad donde ocurre{" "}
                  <span className="text-[var(--color-menta)]">
                    la operación real
                    <InverseDot fromColor="menta" />
                  </span>
                </h3>
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-[var(--color-blanco)]/85">
                  Para distribuidoras, depósitos, talleres y empresas con procesos propios,
                  desarrollamos herramientas que acompañan al equipo en movimiento: preparación de
                  pedidos, control de mercadería, ingreso de insumos y seguimiento por etapas con tu{" "}
                  <BrandWordmark className="mx-0.5" />
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    "Control de inventario",
                    "Depósitos y sucursales",
                    "Preparación de pedidos",
                    "Procesos a medida",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-xl border border-[var(--color-menta)]/35 bg-[var(--color-petroleo)] px-3 py-1.5 text-xs font-bold text-[var(--color-blanco)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="order-1 lg:order-2 lg:col-span-5">
                <div className="group relative overflow-hidden rounded-2xl border border-[var(--color-menta)]/40 bg-[var(--color-petroleo)] shadow-xl">
                  <div className="aspect-[16/11] sm:aspect-[16/10] lg:aspect-[4/3] w-full overflow-hidden">
                    <img
                      src="/photos/ref-05.png"
                      alt="Persona utilizando una tablet en depósito para control de inventario, logística y procesos"
                      width={500}
                      height={500}
                      loading="lazy"
                      className="h-full w-full scale-[1.03] object-cover object-top transition-transform duration-500 group-hover:scale-[1.06]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)]/95 px-4 py-2.5">
                    <span className="text-xs font-bold text-[var(--color-menta)]">
                      Operaciones · Inventario, depósito y logística
                    </span>
                    <BrandWordmark className="text-xs shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Nota de alcance comercial */}
        <p className="mt-8 text-center text-xs text-[var(--color-blanco)]/65">
          * Estas categorías representan tipos de soluciones que podemos analizar y desarrollar
          <InverseDot fromColor="blanco" /> El alcance y las funcionalidades específicas se definen
          mediante evaluación previa de cada proyecto
          <InverseDot fromColor="blanco" />
        </p>
      </div>
    </section>
  );
}
