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
      className="relative border-t border-[#FFFFFF]/10 bg-[#112D3A] py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#56D7A1]/35 bg-[#56D7A1]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#56D7A1]">
            <FolderKanban className="h-3.5 w-3.5" />
            <span>Nuestros proyectos y soluciones</span>
          </span>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#FFFFFF] sm:text-4xl lg:text-5xl">
            Ideas que se convierten <span className="text-[#56D7A1]">en soluciones</span>.
          </h2>

          <p className="mt-4 text-base sm:text-lg leading-relaxed text-[#FFFFFF]/80">
            Cada proyecto es diferente. Cada solución también.
          </p>
        </div>

        {/* Proyectos publicados (cuando estén aprobados en el administrador) */}
        {publishedProjects.length > 0 && (
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {publishedProjects.map((project) => (
              <article
                key={project.id}
                className="rounded-3xl border border-[#56D7A1]/40 bg-[#FFFFFF]/[0.04] p-6"
              >
                <span className="text-xs font-bold text-[#56D7A1]">{project.activity}</span>
                <h3 className="mt-2 text-xl font-extrabold text-[#FFFFFF]">{project.name}</h3>
                <p className="mt-2 text-sm text-[#FFFFFF]/80">{project.description}</p>
              </article>
            ))}
          </div>
        )}

        {/* Demostraciones visuales ilustrativas (identificadas explícitamente como ejemplos según Sección 5) */}
        <div className="mt-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[#56D7A1]">
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
                      ? "bg-[#56D7A1] text-[#112D3A]"
                      : "border border-[#FFFFFF]/15 bg-[#FFFFFF]/5 text-[#FFFFFF]/80 hover:border-[#56D7A1]/50"
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
              <div className="mt-5 grid grid-cols-1 gap-8 rounded-3xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/[0.03] p-6 sm:p-8 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-6">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#56D7A1]/40 bg-[#56D7A1]/15 px-3 py-1 text-[11px] font-bold text-[#56D7A1]">
                    <Monitor className="h-3.5 w-3.5" />
                    {active.badge}
                  </span>

                  <h3 className="mt-4 text-2xl sm:text-3xl font-extrabold text-[#FFFFFF]">
                    {active.title}
                  </h3>

                  <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#56D7A1]">
                    Rubro de referencia: {active.activity}
                  </p>

                  <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#FFFFFF]/80">
                    {active.problemSolved}
                  </p>

                  <ul className="mt-5 space-y-2">
                    {active.features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-center gap-2.5 text-xs sm:text-sm text-[#FFFFFF]/90"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#56D7A1]" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7">
                    <button
                      type="button"
                      onClick={onOpenConfigurator}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#56D7A1] px-5 py-3 text-xs sm:text-sm font-extrabold text-[#112D3A] transition-all hover:bg-[#FFFFFF]"
                    >
                      <span>Quiero una solución así para mi actividad</span>
                      <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* Simulación realista de pantalla administrativa */}
                <div className="lg:col-span-6">
                  <div className="rounded-2xl border border-[#FFFFFF]/20 bg-[#112D3A] p-4 sm:p-5 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-[#FFFFFF]/10 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#56D7A1] text-[#112D3A]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#FFFFFF]">{active.title}</p>
                          <p className="text-[10px] text-[#56D7A1]">
                            Interfaz ilustrativa · Diseño limpio y adaptable
                          </p>
                        </div>
                      </div>
                      <span className="rounded border border-[#FFFFFF]/20 px-2 py-0.5 text-[10px] text-[#FFFFFF]/70">
                        Ejemplo visual
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {active.mockupMetrics.map((m) => (
                        <div
                          key={m.label}
                          className="rounded-xl border border-[#FFFFFF]/10 bg-[#FFFFFF]/[0.04] p-3"
                        >
                          <span className="block text-[10px] text-[#FFFFFF]/65">{m.label}</span>
                          <span className="mt-1 block text-xs sm:text-sm font-extrabold text-[#56D7A1]">
                            {m.val}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 space-y-2 rounded-xl border border-[#FFFFFF]/10 bg-[#FFFFFF]/[0.02] p-3">
                      {active.features.slice(0, 3).map((f, i) => (
                        <div
                          key={f}
                          className="flex items-center justify-between rounded-lg bg-[#112D3A] px-3 py-2 text-xs"
                        >
                          <span className="font-medium text-[#FFFFFF]/90">
                            Módulo #{i + 1}: {f}
                          </span>
                          <span className="text-[10px] font-bold text-[#56D7A1]">Activo</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Estructura preparada para el portafolio administrable (Casa Nueva, Campo Directo, Biblioteca Roncedo) */}
        <div className="mt-10 rounded-3xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/[0.02] p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#FFFFFF]/10 pb-4">
            <div className="flex items-center gap-2.5">
              <Lock className="h-4 w-4 text-[#56D7A1]" />
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#FFFFFF]">
                Estructura de Portafolio Administrable Preparada
              </h3>
            </div>
            <span className="text-xs text-[#56D7A1] font-semibold">
              Publicación controlada desde el Panel Administrativo
            </span>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-[#FFFFFF]/70">
            El sistema cuenta con las fichas estructuradas (Nombre, Logo, Descripción, Actividad,
            Problema que resuelve, Funcionalidades, Capturas, Estado y Enlace) preparadas para
            incorporar casos como <strong className="text-[#FFFFFF]">Casa Nueva</strong>,{" "}
            <strong className="text-[#FFFFFF]">Campo Directo</strong> y{" "}
            <strong className="text-[#FFFFFF]">Biblioteca Roncedo</strong>, los cuales permanecen
            despublicados hasta contar con la validación formal de su información e imágenes.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {allProjects.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border border-[#FFFFFF]/10 bg-[#112D3A]/70 px-4 py-3"
              >
                <div>
                  <p className="text-xs font-extrabold text-[#FFFFFF]">{item.name}</p>
                  <p className="text-[11px] text-[#FFFFFF]/65">{item.activity}</p>
                </div>
                <span className="rounded-md border border-[#56D7A1]/35 bg-[#56D7A1]/10 px-2 py-0.5 text-[10px] font-bold text-[#56D7A1]">
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
