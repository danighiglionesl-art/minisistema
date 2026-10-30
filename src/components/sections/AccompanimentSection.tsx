"use client";

import React, { useState } from "react";
import { ACCOMPANIMENT_PILLARS } from "@/lib/site-data";
import { Layers, PlusCircle, CheckCircle2 } from "lucide-react";
import { BrandWordmark, renderWithBrandWordmark } from "@/components/brand/BrandWordmark";

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
      className="relative border-t border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
          {/* Columna Narrativa y 4 Pilares */}
          <div className="lg:col-span-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
              <span>Acompañamiento permanente</span>
            </span>

            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[var(--color-blanco)] sm:text-4xl lg:text-5xl">
              No entregamos un sistema.{" "}
              <span className="text-[var(--color-menta)]">Construimos una relación.</span>
            </h2>

            <p className="mt-3 text-lg font-bold text-[var(--color-menta)]">
              Tu negocio cambia. Nosotros podemos acompañar cada nueva etapa.
            </p>

            <div className="mt-5 space-y-3 text-sm sm:text-base leading-relaxed text-[var(--color-blanco)]/80">
              <p>
                Sabemos que las necesidades de hoy pueden ser diferentes a las de mañana. Tal vez
                incorporás nuevos productos, contratás empleados, abrís otra sucursal o necesitás
                nuevas funcionalidades.
              </p>
              <p>
                Por eso desarrollamos soluciones pensadas para poder evolucionar. No queremos ser
                solamente quienes construyen tu sistema:{" "}
                <strong className="font-bold text-[var(--color-blanco)]">
                  queremos ser tu aliado tecnológico a largo plazo.
                </strong>
              </p>
            </div>

            {/* Cuatro pilares */}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {ACCOMPANIMENT_PILLARS.map((pillar, idx) => (
                <div
                  key={pillar.id}
                  className="rounded-2xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-5 transition-colors hover:border-[var(--color-menta)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold tracking-widest text-[var(--color-menta)]">
                      PILAR 0{idx + 1}
                    </span>
                    <span className="h-2 w-2 rounded-full bg-[var(--color-menta)]" />
                  </div>
                  <h3 className="mt-2 text-lg font-extrabold text-[var(--color-blanco)]">
                    {pillar.title}
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[var(--color-blanco)]/75">
                    {pillar.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Representación visual interactiva: Plataforma sumando módulos */}
          <div className="lg:col-span-6">
            <div className="rounded-3xl border-2 border-[var(--color-menta)] bg-[var(--color-blanco)]/[0.03] p-6 sm:p-8 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-blanco)]/10 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
                    Representación interactiva de evolución
                  </span>
                  <h3 className="mt-1 text-xl font-extrabold text-[var(--color-blanco)]">
                    Tu negocio evoluciona. Tu <BrandWordmark className="mx-0.5" /> también.
                  </h3>
                </div>
                <Layers className="h-6 w-6 text-[var(--color-menta)]" />
              </div>

              {/* Selector de etapa de crecimiento */}
              <div className="mt-5">
                <p className="text-xs font-semibold text-[var(--color-blanco)]/75 mb-2.5">
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
                            ? "border-[var(--color-menta)] bg-[var(--color-menta)] text-[var(--color-petroleo)] font-extrabold"
                            : "border-[var(--color-blanco)]/15 bg-[var(--color-petroleo)] text-[var(--color-blanco)]/80 hover:border-[var(--color-menta)]"
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

              {/* Diagrama tecnológico SVG de crecimiento progresivo sin cambiar de plataforma */}
              <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--color-blanco)]/15 bg-[var(--color-petroleo)] p-3.5">
                <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-[var(--color-menta)]">
                  <span>ARQUITECTURA MODULAR EVOLUTIVA</span>
                  <span>El mismo sistema suma capacidades sin reemplazarse</span>
                </div>
                <svg
                  viewBox="0 0 420 140"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  className="w-full h-auto"
                >
                  {/* Conectores desde el núcleo central hacia los módulos */}
                  <line x1="210" y1="70" x2="72" y2="30" stroke="#56D7A1" strokeWidth="2" />
                  <line x1="210" y1="70" x2="72" y2="70" stroke="#56D7A1" strokeWidth="2" />
                  <line x1="210" y1="70" x2="72" y2="110" stroke="#56D7A1" strokeWidth="2" />

                  <line
                    x1="210"
                    y1="70"
                    x2="348"
                    y2="24"
                    stroke={growthStage >= 2 ? "#56D7A1" : "#FFFFFF"}
                    strokeOpacity={growthStage >= 2 ? "1" : "0.2"}
                    strokeWidth="2"
                    strokeDasharray={growthStage >= 2 ? undefined : "4 4"}
                  />
                  <line
                    x1="210"
                    y1="70"
                    x2="348"
                    y2="56"
                    stroke={growthStage >= 2 ? "#56D7A1" : "#FFFFFF"}
                    strokeOpacity={growthStage >= 2 ? "1" : "0.2"}
                    strokeWidth="2"
                    strokeDasharray={growthStage >= 2 ? undefined : "4 4"}
                  />
                  <line
                    x1="210"
                    y1="70"
                    x2="348"
                    y2="88"
                    stroke={growthStage >= 3 ? "#56D7A1" : "#FFFFFF"}
                    strokeOpacity={growthStage >= 3 ? "1" : "0.2"}
                    strokeWidth="2"
                    strokeDasharray={growthStage >= 3 ? undefined : "4 4"}
                  />
                  <line
                    x1="210"
                    y1="70"
                    x2="348"
                    y2="120"
                    stroke={growthStage >= 3 ? "#56D7A1" : "#FFFFFF"}
                    strokeOpacity={growthStage >= 3 ? "1" : "0.2"}
                    strokeWidth="2"
                    strokeDasharray={growthStage >= 3 ? undefined : "4 4"}
                  />

                  {/* Módulos Base (Etapa 1: Clientes, Ventas, Inventario) */}
                  <rect x="12" y="16" width="96" height="26" rx="7" fill="#56D7A1" fillOpacity="0.18" stroke="#56D7A1" />
                  <text x="28" y="33" fill="#FFFFFF" fontSize="10" fontWeight="700">Clientes</text>

                  <rect x="12" y="56" width="96" height="26" rx="7" fill="#56D7A1" fillOpacity="0.18" stroke="#56D7A1" />
                  <text x="32" y="73" fill="#FFFFFF" fontSize="10" fontWeight="700">Ventas</text>

                  <rect x="12" y="96" width="96" height="26" rx="7" fill="#56D7A1" fillOpacity="0.18" stroke="#56D7A1" />
                  <text x="24" y="113" fill="#FFFFFF" fontSize="10" fontWeight="700">Inventario</text>

                  {/* Núcleo Permanente con el logotipo oficial minisistema. */}
                  <rect
                    x="144"
                    y="36"
                    width="132"
                    height="68"
                    rx="14"
                    fill="#112D3A"
                    stroke="#56D7A1"
                    strokeWidth="2.5"
                  />
                  <text x="172" y="58" fill="#56D7A1" fontSize="10" fontWeight="800">NÚCLEO BASE</text>
                  <image
                    href="/brand/logotipo-minisistema.png"
                    x="156"
                    y="66"
                    width="108"
                    height="22"
                    preserveAspectRatio="xMidYMid meet"
                  />

                  {/* Módulos Evolutivos (Etapa 2 y Etapa 3) */}
                  <rect
                    x="306"
                    y="10"
                    width="102"
                    height="24"
                    rx="6"
                    fill={growthStage >= 2 ? "#56D7A1" : "#FFFFFF"}
                    fillOpacity={growthStage >= 2 ? "0.2" : "0.04"}
                    stroke={growthStage >= 2 ? "#56D7A1" : "#FFFFFF"}
                    strokeOpacity={growthStage >= 2 ? "1" : "0.2"}
                  />
                  <text x="326" y="26" fill="#FFFFFF" fillOpacity={growthStage >= 2 ? "1" : "0.45"} fontSize="9.5" fontWeight="700">
                    + Usuarios
                  </text>

                  <rect
                    x="306"
                    y="42"
                    width="102"
                    height="24"
                    rx="6"
                    fill={growthStage >= 2 ? "#56D7A1" : "#FFFFFF"}
                    fillOpacity={growthStage >= 2 ? "0.2" : "0.04"}
                    stroke={growthStage >= 2 ? "#56D7A1" : "#FFFFFF"}
                    strokeOpacity={growthStage >= 2 ? "1" : "0.2"}
                  />
                  <text x="326" y="58" fill="#FFFFFF" fillOpacity={growthStage >= 2 ? "1" : "0.45"} fontSize="9.5" fontWeight="700">
                    + Reportes
                  </text>

                  <rect
                    x="306"
                    y="74"
                    width="102"
                    height="24"
                    rx="6"
                    fill={growthStage >= 3 ? "#56D7A1" : "#FFFFFF"}
                    fillOpacity={growthStage >= 3 ? "0.2" : "0.04"}
                    stroke={growthStage >= 3 ? "#56D7A1" : "#FFFFFF"}
                    strokeOpacity={growthStage >= 3 ? "1" : "0.2"}
                  />
                  <text x="316" y="90" fill="#FFFFFF" fillOpacity={growthStage >= 3 ? "1" : "0.45"} fontSize="9.5" fontWeight="700">
                    + Integraciones
                  </text>

                  <rect
                    x="306"
                    y="106"
                    width="102"
                    height="24"
                    rx="6"
                    fill={growthStage >= 3 ? "#56D7A1" : "#FFFFFF"}
                    fillOpacity={growthStage >= 3 ? "0.2" : "0.04"}
                    stroke={growthStage >= 3 ? "#56D7A1" : "#FFFFFF"}
                    strokeOpacity={growthStage >= 3 ? "1" : "0.2"}
                  />
                  <text x="312" y="122" fill="#FFFFFF" fillOpacity={growthStage >= 3 ? "1" : "0.45"} fontSize="9.5" fontWeight="700">
                    + Nuevos canales
                  </text>
                </svg>
              </div>

              {/* Detalle de la etapa seleccionada */}
              <div className="mt-4 rounded-2xl border border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-[var(--color-menta)]">
                    {currentStage.label}
                  </span>
                  <span className="rounded-full border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-menta)]">
                    {currentStage.activeModules.length} módulos activos
                  </span>
                </div>
                <p className="mt-1.5 text-xs sm:text-sm text-[var(--color-blanco)]/80">
                  {renderWithBrandWordmark(currentStage.description)}
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
                            ? "border-[var(--color-menta)] bg-[var(--color-blanco)]/10 text-[var(--color-blanco)]"
                            : "border-[var(--color-blanco)]/10 bg-[var(--color-blanco)]/[0.04] text-[var(--color-blanco)]/90"
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          {isNewlyAdded ? (
                            <PlusCircle className="h-4 w-4 shrink-0 text-[var(--color-menta)]" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-menta)]" />
                          )}
                          <span className="truncate">{mod}</span>
                        </span>
                        {isNewlyAdded && (
                          <span className="ml-1 shrink-0 rounded bg-[var(--color-menta)] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[var(--color-petroleo)]">
                            Nuevo
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="mt-4 text-[11px] text-[var(--color-blanco)]/60">
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
