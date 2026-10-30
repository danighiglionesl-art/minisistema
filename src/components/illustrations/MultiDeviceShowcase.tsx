"use client";

import React, { useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  CalendarCheck,
  CheckCircle2,
  BarChart3,
  PackageCheck,
  Users,
  Bell,
  ArrowUpRight,
  RefreshCw,
  Sliders,
} from "lucide-react";

type DemoScenarioKey = "comercio" | "turnos" | "distribucion";

interface DemoScenario {
  id: DemoScenarioKey;
  tabLabel: string;
  systemTitle: string;
  businessType: string;
  kpis: { label: string; value: string; note: string }[];
  recentItemsTitle: string;
  recentItems: { title: string; subtitle: string; badge: string }[];
  tabletTitle: string;
  tabletItems: { name: string; meta: string; status: string }[];
  mobileTitle: string;
  mobileAction: string;
  mobileStatus: string;
}

const SCENARIOS: Record<DemoScenarioKey, DemoScenario> = {
  comercio: {
    id: "comercio",
    tabLabel: "Gestión y Ventas",
    systemTitle: "Panel Central · Comercio & Stock",
    businessType: "Ejemplo ilustrativo: Comercio minorista y mayorista",
    kpis: [
      { label: "Pedidos del día", value: "28", note: "Sincronizados en mostrador y web" },
      { label: "Stock crítico", value: "3 ítems", note: "Aviso automático a reposición" },
      { label: "Caja y cobros", value: "Al día", note: "Medios de pago conciliados" },
    ],
    recentItemsTitle: "Operaciones recientes en tiempo real",
    recentItems: [
      { title: "Pedido #1048 · Mostrador Principal", subtitle: "Facturación + Descuento de stock automático", badge: "Completado" },
      { title: "Pedido Online #1049 · Retiro en local", subtitle: "Pago confirmado · Preparación asignada", badge: "En curso" },
      { title: "Actualización de lista de proveedores", subtitle: "Precios y márgenes actualizados en 1 clic", badge: "Sincronizado" },
    ],
    tabletTitle: "Vista Tablet · Control de Stock",
    tabletItems: [
      { name: "Línea Hogar & Equipamiento", meta: "142 artículos activos", status: "Stock OK" },
      { name: "Ingreso de mercadería", meta: "Remito #482 verificado", status: "Validado" },
    ],
    mobileTitle: "Vista Celular · Acceso Rápido",
    mobileAction: "Consulta de precios y ventas desde el celular",
    mobileStatus: "Sincronizado al instante",
  },
  turnos: {
    id: "turnos",
    tabLabel: "Reservas y Turnos",
    systemTitle: "Panel Central · Agenda & Pacientes/Clientes",
    businessType: "Ejemplo ilustrativo: Profesionales, centros e instituciones",
    kpis: [
      { label: "Turnos de hoy", value: "19", note: "Confirmados por recordatorio" },
      { label: "Disponibilidad", value: "4 cupos", note: "Reserva online habilitada" },
      { label: "Fichas activas", value: "100%", note: "Historial centralizado" },
    ],
    recentItemsTitle: "Agenda organizada por profesional o espacio",
    recentItems: [
      { title: "15:30 hs · Consulta / Atención personalizada", subtitle: "Ficha histórica + observaciones al instante", badge: "En sala" },
      { title: "16:15 hs · Reserva confirmada desde la web", subtitle: "Recordatorio automático enviado", badge: "Confirmado" },
      { title: "17:00 hs · Inscripción grupal / Actividad", subtitle: "Control de cupos y asistencia", badge: "Cupo activo" },
    ],
    tabletTitle: "Vista Tablet · Recepción y Fichas",
    tabletItems: [
      { name: "Recepción ágil sin planillas", meta: "Búsqueda por DNI o nombre", status: "Activo" },
      { name: "Liquidación diaria", meta: "Resumen por profesional", status: "Al día" },
    ],
    mobileTitle: "Vista Celular · Reserva Online",
    mobileAction: "Tus clientes reservan en 3 pasos simples",
    mobileStatus: "Disponible 24/7",
  },
  distribucion: {
    id: "distribucion",
    tabLabel: "Logística y Pedidos",
    systemTitle: "Panel Central · Pedidos, Rutas y Cuentas",
    businessType: "Ejemplo ilustrativo: Distribuidoras, agro e industria",
    kpis: [
      { label: "Hojas de ruta", value: "6 zonas", note: "Entregas asignadas del día" },
      { label: "Preventa móvil", value: "42 notas", note: "Cargadas por vendedores" },
      { label: "Cuentas corrientes", value: "Claras", note: "Saldos y comprobantes" },
    ],
    recentItemsTitle: "Trazabilidad desde el pedido hasta la entrega",
    recentItems: [
      { title: "Nota de pedido #892 · Zona Sur", subtitle: "Cargada desde celular del vendedor", badge: "En armado" },
      { title: "Despacho #310 · Control de carga", subtitle: "Remito digital y actualización de lote", badge: "En reparto" },
      { title: "Cobranza registrada en cliente", subtitle: "Recibo emitido e imputado en cuenta corriente", badge: "Imputado" },
    ],
    tabletTitle: "Vista Tablet · Depósito y Despacho",
    tabletItems: [
      { name: "Preparación de pedidos", meta: "Lectura rápida sin errores", status: "En orden" },
      { name: "Control de lotes", meta: "Trazabilidad completa", status: "Verificado" },
    ],
    mobileTitle: "Vista Celular · Preventa en Calle",
    mobileAction: "Toma de pedidos y consulta de saldo en cliente",
    mobileStatus: "App Web / PWA",
  },
};

export function MultiDeviceShowcase() {
  const [activeScenario, setActiveScenario] = useState<DemoScenarioKey>("comercio");
  const current = SCENARIOS[activeScenario];

  return (
    <div className="relative w-full isolate">
      {/* Iluminación ambiental verde menta sutil detrás del ecosistema de pantallas */}
      <div
        aria-hidden="true"
        className="ms-mint-halo pointer-events-none absolute -inset-8 rounded-full blur-2xl animate-pulse-glow"
      />

      {/* Contenedor general de la composición multi-dispositivo con profundidad en capas */}
      <div className="ms-depth-card relative rounded-3xl border border-[var(--color-menta)]/35 bg-[var(--color-petroleo)]/95 p-4 sm:p-6 backdrop-blur-md">
        {/* Barra superior de selección de ejemplo ilustrativo */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-blanco)]/10 pb-3.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-menta)] shadow-[0_0_8px_var(--color-menta)]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-menta)]">
              Ejemplo ilustrativo · Un mismo sistema en todas tus pantallas
            </span>
          </div>

          <div
            role="tablist"
            aria-label="Ejemplos ilustrativos de soluciones a medida"
            className="flex flex-wrap gap-1.5"
          >
            {(Object.keys(SCENARIOS) as DemoScenarioKey[]).map((key) => {
              const item = SCENARIOS[key];
              const isSelected = activeScenario === key;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveScenario(item.id)}
                  className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                    isSelected
                      ? "bg-[var(--color-menta)] text-[var(--color-petroleo)] shadow-sm"
                      : "bg-[var(--color-blanco)]/5 text-[var(--color-blanco)]/80 hover:bg-[var(--color-blanco)]/10 hover:text-[var(--color-blanco)]"
                  }`}
                >
                  {item.tabLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* 1. COMPUTADORA DE ESCRITORIO (Pantalla Principal con mini gráfico tecnológico) */}
        <div
          key={current.id}
          className="animate-fade-up-subtle rounded-2xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] p-3.5 sm:p-4 shadow-2xl"
        >
          {/* Barra ventana navegador */}
          <div className="flex items-center justify-between border-b border-[var(--color-blanco)]/10 pb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-blanco)]/25" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-blanco)]/45" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-menta)]" />
              <span className="ml-2 text-xs font-bold text-[var(--color-blanco)]">
                {current.systemTitle}
              </span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-[var(--color-menta)] bg-[var(--color-menta)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-menta)]">
              <Sliders className="h-3 w-3" />
              100% Personalizado
            </span>
          </div>

          {/* Subtítulo del rubro ilustrativo + curva tecnológica SVG */}
          <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-[var(--color-blanco)]/75">
            <span>{current.businessType}</span>
            <span className="inline-flex items-center gap-1.5 text-[var(--color-menta)] font-semibold">
              <RefreshCw className="h-3 w-3" /> En línea
            </span>
          </div>

          {/* Tarjetas KPI de la interfaz con mini barra de progreso visual */}
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            {current.kpis.map((kpi, idx) => (
              <div
                key={kpi.label}
                className="relative overflow-hidden rounded-xl border border-[var(--color-blanco)]/12 bg-[var(--color-blanco)]/[0.04] p-2.5 sm:p-3"
              >
                <p className="text-[10px] sm:text-xs text-[var(--color-blanco)]/70 truncate">
                  {kpi.label}
                </p>
                <div className="mt-1 flex items-end justify-between gap-1">
                  <p className="text-sm sm:text-lg font-extrabold text-[var(--color-menta)]">
                    {kpi.value}
                  </p>
                  {/* Mini indicador gráfico tecnológico en SVG */}
                  <svg
                    viewBox="0 0 36 16"
                    className="hidden sm:block h-4 w-9 shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      d={
                        idx === 0
                          ? "M2 13 L10 9 L18 11 L26 5 L34 3"
                          : idx === 1
                          ? "M2 12 L10 10 L18 6 L26 8 L34 4"
                          : "M2 11 L12 11 L20 7 L28 7 L34 3"
                      }
                      fill="none"
                      stroke="#56D7A1"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="mt-1 hidden sm:block text-[10px] text-[var(--color-blanco)]/60 truncate">
                  {kpi.note}
                </p>
              </div>
            ))}
          </div>

          {/* Lista de actividad organizada + gráfico de actividad en vivo */}
          <div className="mt-3 rounded-xl border border-[var(--color-blanco)]/10 bg-[var(--color-blanco)]/[0.03] p-3">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-[var(--color-blanco)]/95 flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-[var(--color-menta)]" />
                {current.recentItemsTitle}
              </span>
              <span className="rounded bg-[var(--color-menta)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--color-menta)]">
                Vista Computadora
              </span>
            </div>
            <div className="space-y-2">
              {current.recentItems.map((item) => (
                <div
                  key={item.title}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)]/90 px-3 py-2 transition-colors hover:border-[var(--color-menta)]/50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-menta)]" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--color-blanco)]">
                        {item.title}
                      </p>
                      <p className="truncate text-[11px] text-[var(--color-blanco)]/65">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md border border-[var(--color-menta)]/60 bg-[var(--color-menta)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--color-menta)]">
                    {item.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. TABLET Y 3. TELÉFONO MÓVIL (Capas con profundidad espacial) */}
        <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-12">
          {/* TABLET */}
          <div className="sm:col-span-7 rounded-2xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] p-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--color-blanco)]/10 pb-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-blanco)]">
                <LayoutDashboard className="h-3.5 w-3.5 text-[var(--color-menta)]" />
                {current.tabletTitle}
              </span>
              <span className="rounded border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/5 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-blanco)]/85">
                Tablet
              </span>
            </div>
            <div className="mt-2.5 space-y-2">
              {current.tabletItems.map((tItem) => (
                <div
                  key={tItem.name}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-blanco)]/5 bg-[var(--color-blanco)]/[0.04] px-2.5 py-2 text-xs"
                >
                  <div>
                    <p className="font-semibold text-[var(--color-blanco)]">{tItem.name}</p>
                    <p className="text-[11px] text-[var(--color-blanco)]/65">{tItem.meta}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-menta)]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {tItem.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* TELÉFONO CELULAR */}
          <div className="sm:col-span-5 rounded-2xl border-2 border-[var(--color-menta)] bg-[var(--color-petroleo)] p-3.5 shadow-[0_10px_28px_rgba(17,45,58,0.9)] animate-float-gentle">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--color-blanco)]/30" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-menta)]">
                {current.mobileTitle}
              </span>
              <Bell className="h-3.5 w-3.5 text-[var(--color-menta)]" />
            </div>
            <p className="mt-2 text-xs font-medium leading-snug text-[var(--color-blanco)]">
              {current.mobileAction}
            </p>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-[var(--color-menta)] px-2.5 py-1.5 text-[11px] font-extrabold text-[var(--color-petroleo)]">
              <span>{current.mobileStatus}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        {/* Etiqueta de transparencia (Sección 5) */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[var(--color-blanco)]/65">
          <span>
            * Representación ilustrativa de interfaz adaptada a computadora, tablet y celular.
          </span>
          <span className="font-semibold text-[var(--color-menta)]">
            Organización · Integración · Disponibilidad
          </span>
        </div>
      </div>
    </div>
  );
}
