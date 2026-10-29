"use client";

import React, { useState } from "react";
import { ACCOMPANIMENT_PILLARS } from "@/lib/site-data";
import { Layers, PlusCircle, CheckCircle2, ArrowUpRight } from "lucide-react";

const MODULAR_GROWTH_STAGES = [
  {
    step: 1,
    label: "1. Inicio · Núcleo a medida",
    description: "Comenzás con las herramientas esenciales para ordenar tu operación diaria.",
    activeModules: ["Clientes y Contactos", "Productos / Servicios", "Caja y Movimientos"],
  },
  {
    step: 2,
    label: "2. Crecimiento · Nuevos equipos y canales",
    description: "Tu actividad suma personal, control de inventario o atención digital.",
    activeModules: [
      "Clientes y Contactos",
      "Productos / Servicios",
      "Caja y Movimientos",
      "Control de Stock Multi-depósito",
      "Usuarios y Roles por Permisos",
    ],
  },
  {
    step: 3,
    label: "3. Expansión · Integración y nuevas sucursales",
    description: "Tu MiniSistema evoluciona con nuevas sucursales, ventas web y reportes avanzados.",
    activeModules: [
      "Clientes y Contactos",
      "Productos / Servicios",
      "Caja y Movimientos",
      "Control de Stock Multi-depósito",
      "Usuarios y Roles por Permisos",
      "Tienda Online / Pedidos Web",
      "Sucursales Conectadas",
      "Reportes y Automatizaciones",
    ],
  },
];

export function AccompanimentSection() {
  const [growthStage, setGrowthStage] = useState<number>(2);
  const currentStage =
    MODULAR_GROWTH_STAGES.find((s) => s.step === growthStage) ||
    MODULAR_GROWTH_STAGES[2];

  return (
    <section
      id="acompanamiento"
      className="relative border-t border-[#FFFFFF]/10 bg-[#112D3A] py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
          {/* Columna Narrativa y 4 Pilares */}
          <div className="lg:col-span-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#56D7A1]/35 bg-[#56D7A1]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#56D7A1]">
              <span>Acompañamiento permanente</span>
            </span>

            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#FFFFFF] sm:text-4xl lg:text-5xl">
              No entregamos un sistema.{" "}
              <span className="text-[#56D7A1]">Construimos una relación.</span>
            </h2>

            <p className="mt-3 text-lg font-bold text-[#56D7A1]">
              Tu negocio cambia. Nosotros podemos acompañar cada nueva etapa.
            </p>

            <div className="mt-5 space-y-3 text-sm sm:text-base leading-relaxed text-[#FFFFFF]/80">
              <p>
                Sabemos que las necesidades de hoy pueden ser diferentes a las de mañana. Tal vez
                incorporás nuevos productos, contratás empleados, abrís otra sucursal o necesitás
                nuevas funcionalidades.
              </p>
              <p>
                Por eso desarrollamos soluciones pensadas para poder evolucionar. No queremos ser
                solamente quienes construyen tu sistema:{" "}
                <strong className="font-bold text-[#FFFFFF]">
                  queremos ser tu aliado tecnológico a largo plazo.
                </strong>
              </p>
            </div>

            {/* Cuatro pilares */}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {ACCOMPANIMENT_PILLARS.map((pillar, idx) => (
                <div
                  key={pillar.id}
                  className="rounded-2xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/[0.03] p-5 transition-colors hover:border-[#56D7A1]/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold tracking-widest text-[#56D7A1]">
                      PILAR 0{idx + 1}
                    </span>
                    <span className="h-2 w-2 rounded-full bg-[#56D7A1]" />
                  </div>
                  <h3 className="mt-2 text-lg font-extrabold text-[#FFFFFF]">
                    {pillar.title}
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[#FFFFFF]/75">
                    {pillar.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Representación visual interactiva: Plataforma sumando módulos */}
          <div className="lg:col-span-6">
            <div className="rounded-3xl border-2 border-[#56D7A1]/40 bg-[#FFFFFF]/[0.03] p-6 sm:p-8 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#FFFFFF]/10 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#56D7A1]">
                    Representación interactiva de evolución
                  </span>
                  <h3 className="mt-1 text-xl font-extrabold text-[#FFFFFF]">
                    Tu negocio evoluciona. Tu MiniSistema también.
                  </h3>
                </div>
                <Layers className="h-6 w-6 text-[#56D7A1]" />
              </div>

              {/* Selector de etapa de crecimiento */}
              <div className="mt-5">
                <p className="text-xs font-semibold text-[#FFFFFF]/75 mb-2.5">
                  Explorá cómo una plataforma puede ir sumando módulos a medida que crece tu actividad:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {MODULAR_GROWTH_STAGES.map((stage) => {
                    const active = growthStage === stage.step;
                    return (
                      <button
                        key={stage.step}
                        type="button"
                        onClick={() => setGrowthStage(stage.step)}
                        className={`cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-all ${
                          active
                            ? "border-[#56D7A1] bg-[#56D7A1] text-[#112D3A] font-extrabold"
                            : "border-[#FFFFFF]/15 bg-[#112D3A] text-[#FFFFFF]/80 hover:border-[#56D7A1]/50"
                        }`}
                      >
                        <span className="block text-[10px] uppercase tracking-wider opacity-80">
                          Etapa {stage.step}
                        </span>
                        <span className="text-xs font-bold">
                          {stage.step === 1
                            ? "Base Inicial"
                            : stage.step === 2
                            ? "Crecimiento"
                            : "Expansión"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detalle de la etapa seleccionada */}
              <div className="mt-5 rounded-2xl border border-[#FFFFFF]/10 bg-[#112D3A] p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-[#56D7A1]">
                    {currentStage.label}
                  </span>
                  <span className="rounded-full border border-[#56D7A1]/40 bg-[#56D7A1]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#56D7A1]">
                    {currentStage.activeModules.length} módulos activos
                  </span>
                </div>
                <p className="mt-1.5 text-xs sm:text-sm text-[#FFFFFF]/80">
                  {currentStage.description}
                </p>

                {/* Módulos activos en la plataforma */}
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {currentStage.activeModules.map((mod, idx) => {
                    const isNewlyAdded =
                      (growthStage === 2 && idx >= 3) || (growthStage === 3 && idx >= 5);
                    return (
                      <div
                        key={mod}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
                          isNewlyAdded
                            ? "border-[#56D7A1] bg-[#56D7A1]/15 text-[#FFFFFF]"
                            : "border-[#FFFFFF]/10 bg-[#FFFFFF]/[0.04] text-[#FFFFFF]/90"
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          {isNewlyAdded ? (
                            <PlusCircle className="h-4 w-4 shrink-0 text-[#56D7A1]" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#56D7A1]" />
                          )}
                          <span className="truncate">{mod}</span>
                        </span>
                        {isNewlyAdded && (
                          <span className="ml-1 shrink-0 rounded bg-[#56D7A1] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#112D3A]">
                            Nuevo
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="mt-4 text-[11px] text-[#FFFFFF]/60">
                * Ejemplo ilustrativo de arquitectura modular. Cada ampliación se planifica y
                presupuesta de acuerdo con las necesidades reales del cliente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
