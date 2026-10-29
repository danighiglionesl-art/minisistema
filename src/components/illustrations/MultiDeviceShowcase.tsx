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
    <div className="relative w-full">
      {/* Resplandor decorativo sutil en verde menta (solo colores institucionales) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 rounded-3xl bg-[#56D7A1]/10 blur-2xl animate-pulse-glow"
      />

      {/* Contenedor general de la composición multi-dispositivo */}
      <div className="relative rounded-3xl border border-[#FFFFFF]/15 bg-[#112D3A]/90 p-4 sm:p-6 shadow-2xl backdrop-blur-md">
        {/* Barra superior de selección de ejemplo ilustrativo */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#FFFFFF]/10 pb-3.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#56D7A1]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#56D7A1]">
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
                      ? "bg-[#56D7A1] text-[#112D3A] shadow-sm"
                      : "bg-[#FFFFFF]/5 text-[#FFFFFF]/80 hover:bg-[#FFFFFF]/10 hover:text-[#FFFFFF]"
                  }`}
                >
                  {item.tabLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* 1. COMPUTADORA DE ESCRITORIO (Pantalla Principal) */}
        <div className="rounded-2xl border border-[#FFFFFF]/20 bg-[#112D3A] p-3 sm:p-4 shadow-xl">
          {/* Barra ventana navegador */}
          <div className="flex items-center justify-between border-b border-[#FFFFFF]/10 pb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FFFFFF]/25" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FFFFFF]/45" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#56D7A1]" />
              <span className="ml-2 text-xs font-bold text-[#FFFFFF]">
                {current.systemTitle}
              </span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-[#56D7A1]/30 bg-[#56D7A1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#56D7A1]">
              <Sliders className="h-3 w-3" />
              100% Personalizado
            </span>
          </div>

          {/* Subtítulo del rubro ilustrativo */}
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#FFFFFF]/70">
            <span>{current.businessType}</span>
            <span className="inline-flex items-center gap-1 text-[#56D7A1] font-medium">
              <RefreshCw className="h-3 w-3" /> En línea
            </span>
          </div>

          {/* Tarjetas KPI de la interfaz */}
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            {current.kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-[#FFFFFF]/10 bg-[#FFFFFF]/[0.04] p-2.5 sm:p-3"
              >
                <p className="text-[10px] sm:text-xs text-[#FFFFFF]/70 truncate">
                  {kpi.label}
                </p>
                <p className="mt-0.5 text-sm sm:text-lg font-extrabold text-[#56D7A1]">
                  {kpi.value}
                </p>
                <p className="mt-0.5 hidden sm:block text-[10px] text-[#FFFFFF]/60 truncate">
                  {kpi.note}
                </p>
              </div>
            ))}
          </div>

          {/* Lista de actividad organizada */}
          <div className="mt-3 rounded-xl border border-[#FFFFFF]/10 bg-[#FFFFFF]/[0.02] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#FFFFFF]/90 flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-[#56D7A1]" />
                {current.recentItemsTitle}
              </span>
              <span className="text-[10px] font-semibold text-[#56D7A1]">
                Vista Desktop
              </span>
            </div>
            <div className="space-y-2">
              {current.recentItems.map((item) => (
                <div
                  key={item.title}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[#FFFFFF]/5 bg-[#112D3A]/80 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#FFFFFF]">
                      {item.title}
                    </p>
                    <p className="truncate text-[11px] text-[#FFFFFF]/65">
                      {item.subtitle}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md border border-[#56D7A1]/40 bg-[#56D7A1]/15 px-2 py-0.5 text-[10px] font-bold text-[#56D7A1]">
                    {item.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. TABLET Y 3. TELÉFONO MÓVIL (Adaptación simultánea) */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12">
          {/* TABLET */}
          <div className="sm:col-span-7 rounded-2xl border border-[#FFFFFF]/20 bg-[#112D3A] p-3.5 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#FFFFFF]/10 pb-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#FFFFFF]">
                <LayoutDashboard className="h-3.5 w-3.5 text-[#56D7A1]" />
                {current.tabletTitle}
              </span>
              <span className="rounded bg-[#FFFFFF]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#FFFFFF]/80">
                Tablet
              </span>
            </div>
            <div className="mt-2.5 space-y-2">
              {current.tabletItems.map((tItem) => (
                <div
                  key={tItem.name}
                  className="flex items-center justify-between rounded-lg bg-[#FFFFFF]/[0.04] px-2.5 py-2 text-xs"
                >
                  <div>
                    <p className="font-semibold text-[#FFFFFF]">{tItem.name}</p>
                    <p className="text-[11px] text-[#FFFFFF]/65">{tItem.meta}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#56D7A1]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {tItem.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* TELÉFONO CELULAR */}
          <div className="sm:col-span-5 rounded-2xl border-2 border-[#56D7A1]/50 bg-[#112D3A] p-3.5 shadow-lg animate-float-gentle">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[#FFFFFF]/25" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#56D7A1]">
                {current.mobileTitle}
              </span>
              <Bell className="h-3.5 w-3.5 text-[#56D7A1]" />
            </div>
            <p className="mt-2 text-xs font-medium leading-snug text-[#FFFFFF]">
              {current.mobileAction}
            </p>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-[#56D7A1] px-2.5 py-1.5 text-[11px] font-extrabold text-[#112D3A]">
              <span>{current.mobileStatus}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        {/* Etiqueta de transparencia (Sección 5) */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#FFFFFF]/65">
          <span>
            * Representación ilustrativa de interfaz adaptada a computadora, tablet y celular.
          </span>
          <span className="font-semibold text-[#56D7A1]">
            Organización · Integración · Disponibilidad
          </span>
        </div>
      </div>
    </div>
  );
}
