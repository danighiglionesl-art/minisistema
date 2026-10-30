"use client";

import React, { useState } from "react";
import { PORTFOLIO_PROJECTS } from "@/lib/site-data";
import { PortfolioProject } from "@/types/minisistema";
import {
  FolderKanban,
  Monitor,
  Calendar,
  ShoppingBag,
  Building2,
  ArrowUpRight,
  Lock,
  CheckCircle2,
} from "lucide-react";

interface ProjectsSectionProps {
  onOpenConfigurator: () => void;
  projects?: PortfolioProject[];
}

const ILLUSTRATIVE_SHOWCASES = [
  {
    id: "ejemplo-gestion-comercial",
    badge: "Ejemplo ilustrativo de interfaz",
    title: "Panel de Gestión Comercial, Stock y Cuentas",
    activity: "Comercios y Distribuidoras",
    problemSolved:
      "Centraliza ventas de mostrador, control de inventario por depósito, listas de precios y estado de cuenta de clientes sin depender de planillas dispersas.",
    features: [
      "Control de stock con alertas de reposición",
      "Comprobantes, remitos y presupuestos rápidos",
      "Historial de compras y saldos por cliente",
      "Reportes diarios de caja y rentabilidad",
    ],
    icon: ShoppingBag,
    mockupMetrics: [
      { label: "Artículos sincronizados", val: "2.450" },
      { label: "Listas de precios", val: "Mayorista / Minorista" },
      { label: "Acceso", val: "PC, Tablet y Celular" },
    ],
  },
  {
    id: "ejemplo-plataforma-institucional",
    badge: "Ejemplo ilustrativo de interfaz",
    title: "Plataforma de Gestión Institucional y Socios",
    activity: "Bibliotecas, Clubes y Asociaciones",
    problemSolved:
      "Organiza el padrón de socios, cobro de cuotas, préstamos o reservas de espacios y comunicación institucional desde un entorno simple.",
    features: [
      "Padrón digital de socios con estado de cuota",
      "Catálogo online y control de préstamos / devoluciones",
      "Inscripción a talleres, eventos o turnos",
      "Carnets digitales y panel administrativo",
    ],
    icon: Building2,
    mockupMetrics: [
      { label: "Padrón centralizado", val: "Socios y familias" },
      { label: "Catálogo y reservas", val: "Consulta online" },
      { label: "Seguimiento", val: "Cuotas y vencimientos" },
    ],
  },
  {
    id: "ejemplo-operaciones-agro-servicios",
    badge: "Ejemplo ilustrativo de interfaz",
    title: "Sistema de Pedidos, Turnos y Operaciones a Medida",
    activity: "Servicios Profesionales y Productores",
    problemSolved:
      "Facilita la recepción de solicitudes, asignación de agendas o logística y seguimiento del estado de cada operación en tiempo real.",
    features: [
      "Agenda dinámica con confirmaciones",
      "Registro de operaciones desde dispositivos móviles",
      "Panel de seguimiento por etapas",
      "Exportación de resúmenes operativos",
    ],
    icon: Calendar,
    mockupMetrics: [
      { label: "Agenda / Operaciones", val: "Tiempo real" },
      { label: "Notificaciones", val: "WhatsApp / Email" },
      { label: "Diseño", val: "100% personalizado" },
    ],
  },
];

export function ProjectsSection({ onOpenConfigurator, projects }: ProjectsSectionProps) {
  const [selectedExample, setSelectedExample] = useState(0);
  const allProjects = projects && projects.length > 0 ? projects : PORTFOLIO_PROJECTS;
  const publishedProjects = allProjects.filter((p) => p.published);

  return (
    <section
      id="nuestros-proyectos"
      className="relative border-t border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
            <FolderKanban className="h-3.5 w-3.5" />
            <span>Nuestros proyectos y soluciones</span>
          </span>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[var(--color-blanco)] sm:text-4xl lg:text-5xl">
            Ideas que se convierten <span className="text-[var(--color-menta)]">en soluciones</span>.
          </h2>

          <p className="mt-4 text-base sm:text-lg leading-relaxed text-[var(--color-blanco)]/80">
            Cada proyecto es diferente. Cada solución también.
          </p>
        </div>

        {/* Proyectos publicados (cuando estén aprobados en el administrador) */}
        {publishedProjects.length > 0 && (
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {publishedProjects.map((project) => (
              <article
                key={project.id}
                className="rounded-3xl border border-[var(--color-menta)] bg-[var(--color-blanco)]/[0.04] p-6"
              >
                <span className="text-xs font-bold text-[var(--color-menta)]">{project.activity}</span>
                <h3 className="mt-2 text-xl font-extrabold text-[var(--color-blanco)]">{project.name}</h3>
                <p className="mt-2 text-sm text-[var(--color-blanco)]/80">{project.description}</p>
              </article>
            ))}
          </div>
        )}

        {/* Demostraciones visuales ilustrativas (identificadas explícitamente como ejemplos según Sección 5) */}
        <div className="mt-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
              Ejemplos ilustrativos de soluciones digitales en funcionamiento
            </p>
            <div className="flex flex-wrap gap-2">
              {ILLUSTRATIVE_SHOWCASES.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedExample(idx)}
                  className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                    selectedExample === idx
                      ? "bg-[var(--color-menta)] text-[var(--color-petroleo)]"
                      : "border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/5 text-[var(--color-blanco)]/80 hover:border-[var(--color-menta)]"
                  }`}
                >
                  {item.activity}
                </button>
              ))}
            </div>
          </div>

          {/* Vista detallada del ejemplo seleccionado */}
          {(() => {
            const active = ILLUSTRATIVE_SHOWCASES[selectedExample];
            const Icon = active.icon;
            return (
              <div className="mt-5 grid grid-cols-1 gap-8 rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-6 sm:p-8 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-6">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-3 py-1 text-[11px] font-bold text-[var(--color-menta)]">
                    <Monitor className="h-3.5 w-3.5" />
                    {active.badge}
                  </span>

                  <h3 className="mt-4 text-2xl sm:text-3xl font-extrabold text-[var(--color-blanco)]">
                    {active.title}
                  </h3>

                  <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
                    Rubro de referencia: {active.activity}
                  </p>

                  <p className="mt-4 text-sm sm:text-base leading-relaxed text-[var(--color-blanco)]/80">
                    {active.problemSolved}
                  </p>

                  <ul className="mt-5 space-y-2">
                    {active.features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-center gap-2.5 text-xs sm:text-sm text-[var(--color-blanco)]/90"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-menta)]" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7">
                    <button
                      type="button"
                      onClick={onOpenConfigurator}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-menta)] px-5 py-3 text-xs sm:text-sm font-extrabold text-[var(--color-petroleo)] transition-all hover:bg-[var(--color-blanco)]"
                    >
                      <span>Quiero una solución así para mi actividad</span>
                      <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* Mockup realista multi-dispositivo (Escritorio + Celular superpuesto) */}
                <div key={active.id} className="lg:col-span-6 animate-fade-up-subtle">
                  <div className="relative">
                    {/* Ventana Principal de Escritorio */}
                    <div className="ms-depth-card rounded-2xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] p-4 sm:p-5">
                      {/* Barra superior de aplicación */}
                      <div className="flex items-center justify-between border-b border-[var(--color-blanco)]/10 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center gap-1">
                            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-blanco)]/25" />
                            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-blanco)]/45" />
                            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-menta)]" />
                          </div>
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-menta)] text-[var(--color-petroleo)]">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[var(--color-blanco)]">
                              {active.title}
                            </p>
                            <p className="text-[10px] text-[var(--color-menta)]">
                              Vista Escritorio · Ejemplo ilustrativo de interfaz
                            </p>
                          </div>
                        </div>
                        <span className="hidden sm:inline-block rounded-md border border-[var(--color-menta)]/60 bg-[var(--color-menta)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--color-menta)]">
                          Demo visual
                        </span>
                      </div>

                      {/* Métricas + Mini Gráfico de actividad en SVG */}
                      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        {active.mockupMetrics.map((m) => (
                          <div
                            key={m.label}
                            className="rounded-xl border border-[var(--color-blanco)]/12 bg-[var(--color-blanco)]/[0.04] p-3"
                          >
                            <span className="block text-[10px] text-[var(--color-blanco)]/65">
                              {m.label}
                            </span>
                            <span className="mt-1 block text-xs sm:text-sm font-extrabold text-[var(--color-menta)]">
                              {m.val}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Representación gráfica de interfaz en funcionamiento (SVG) */}
                      <div className="mt-3.5 overflow-hidden rounded-xl border border-[var(--color-blanco)]/10 bg-[var(--color-blanco)]/[0.03] p-3">
                        <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-[var(--color-blanco)]/75">
                          <span>PANEL OPERATIVO PERSONALIZADO</span>
                          <span className="text-[var(--color-menta)]">Sincronizado</span>
                        </div>
                        <svg
                          viewBox="0 0 380 86"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                          className="w-full h-auto"
                        >
                          {/* Panel izquierdo: curva/gráfico de actividad */}
                          <rect
                            x="4"
                            y="6"
                            width="210"
                            height="74"
                            rx="8"
                            fill="#112D3A"
                            stroke="#FFFFFF"
                            strokeOpacity="0.15"
                          />
                          <path
                            d={
                              selectedExample === 0
                                ? "M18 62 L56 46 L94 52 L132 28 L170 34 L198 18"
                                : selectedExample === 1
                                ? "M18 58 L56 42 L94 38 L132 44 L170 24 L198 20"
                                : "M18 64 L56 50 L94 34 L132 38 L170 22 L198 16"
                            }
                            stroke="#56D7A1"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx="132" cy="28" r="3.5" fill="#FFFFFF" />
                          <circle cx="198" cy="18" r="4" fill="#56D7A1" />

                          {/* Panel derecho: indicadores de módulos */}
                          <rect
                            x="224"
                            y="6"
                            width="152"
                            height="34"
                            rx="7"
                            fill="#56D7A1"
                            fillOpacity="0.16"
                            stroke="#56D7A1"
                          />
                          <rect x="234" y="15" width="76" height="6" rx="3" fill="#FFFFFF" />
                          <rect x="234" y="26" width="118" height="6" rx="3" fill="#56D7A1" />

                          <rect
                            x="224"
                            y="46"
                            width="152"
                            height="34"
                            rx="7"
                            fill="#FFFFFF"
                            fillOpacity="0.05"
                            stroke="#FFFFFF"
                            strokeOpacity="0.2"
                          />
                          <rect x="234" y="55" width="90" height="6" rx="3" fill="#FFFFFF" fillOpacity="0.85" />
                          <rect x="234" y="66" width="64" height="6" rx="3" fill="#56D7A1" />
                        </svg>
                      </div>

                      {/* Módulos activos y vista móvil acoplada */}
                      <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-12">
                        <div className="sm:col-span-7 space-y-2 rounded-xl border border-[var(--color-blanco)]/10 bg-[var(--color-blanco)]/[0.02] p-3">
                          {active.features.slice(0, 3).map((f, i) => (
                            <div
                              key={f}
                              className="flex items-center justify-between rounded-lg bg-[var(--color-petroleo)] px-3 py-2 text-xs"
                            >
                              <span className="truncate font-medium text-[var(--color-blanco)]/90">
                                {i + 1}. {f}
                              </span>
                              <span className="ml-2 shrink-0 text-[10px] font-bold text-[var(--color-menta)]">
                                Activo
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Mockup de Celular en primer plano */}
                        <div className="sm:col-span-5 flex flex-col justify-between rounded-2xl border-2 border-[var(--color-menta)] bg-[var(--color-petroleo)] p-3 shadow-xl">
                          <div>
                            <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-[var(--color-blanco)]/30" />
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-menta)]">
                                Vista Celular
                              </span>
                              <span className="h-2 w-2 rounded-full bg-[var(--color-menta)]" />
                            </div>
                            <p className="mt-1.5 text-xs font-bold text-[var(--color-blanco)]">
                              {active.activity}
                            </p>
                            <p className="mt-1 text-[11px] leading-snug text-[var(--color-blanco)]/75">
                              {active.features[3] || active.features[0]}
                            </p>
                          </div>
                          <div className="mt-2.5 rounded-lg bg-[var(--color-menta)] px-2.5 py-1.5 text-center text-[10px] font-extrabold text-[var(--color-petroleo)]">
                            Acceso móvil sincronizado
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Estructura preparada para el portafolio administrable (Casa Nueva, Campo Directo, Biblioteca Roncedo) */}
        <div className="mt-10 rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.02] p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-blanco)]/10 pb-4">
            <div className="flex items-center gap-2.5">
              <Lock className="h-4 w-4 text-[var(--color-menta)]" />
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-blanco)]">
                Estructura de Portafolio Administrable Preparada
              </h3>
            </div>
            <span className="text-xs text-[var(--color-menta)] font-semibold">
              Publicación controlada desde el Panel Administrativo
            </span>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-[var(--color-blanco)]/70">
            El sistema cuenta con las fichas estructuradas (Nombre, Logo, Descripción, Actividad,
            Problema que resuelve, Funcionalidades, Capturas, Estado y Enlace) preparadas para
            incorporar casos como <strong className="text-[var(--color-blanco)]">Casa Nueva</strong>,{" "}
            <strong className="text-[var(--color-blanco)]">Campo Directo</strong> y{" "}
            <strong className="text-[var(--color-blanco)]">Biblioteca Roncedo</strong>, los cuales permanecen
            despublicados hasta contar con la validación formal de su información e imágenes.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {allProjects.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)]/70 px-4 py-3"
              >
                <div>
                  <p className="text-xs font-extrabold text-[var(--color-blanco)]">{item.name}</p>
                  <p className="text-[11px] text-[var(--color-blanco)]/65">{item.activity}</p>
                </div>
                <span className="rounded-md border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-2 py-0.5 text-[10px] font-bold text-[var(--color-menta)]">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
