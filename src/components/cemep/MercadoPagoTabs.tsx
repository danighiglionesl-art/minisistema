"use client";

import React from "react";

export type CemepSectionTab = "cemep" | "cemep_plus";

interface MercadoPagoTabsProps {
  activeTab: CemepSectionTab;
  onChangeTab: (tab: CemepSectionTab) => void;
  children: React.ReactNode;
}

/**
 * Pestañas estilo Mercado Pago con bordes superiores redondeados y
 * curvas cóncavas invertidas en la base que funden la pestaña activa
 * directamente con el contenedor blanco inferior.
 *
 * Nota: MiniSistema usa `@theme { --color-*: initial; }` en globals.css,
 * por lo que todos los colores se declaran con hex explícitos (`bg-[#FFFFFF]`, `text-[#FFFFFF]`, etc.).
 */
export function MercadoPagoTabs({
  activeTab,
  onChangeTab,
  children,
}: MercadoPagoTabsProps) {
  const isCemep = activeTab === "cemep";
  const isPlus = activeTab === "cemep_plus";

  // Banda superior con la paleta oficial de cada marca
  const headerBg = isCemep
    ? "linear-gradient(135deg, #1B335D 0%, #0A5E8A 55%, #0099D8 100%)"
    : "linear-gradient(135deg, #27AE88 0%, #1CA9B3 48%, #009EE3 100%)";

  const lowerUnderlay = isCemep
    ? "linear-gradient(180deg, #0A6E9E 0px, #0A6E9E 48px, #F4F8FB 48px, #F4F8FB 100%)"
    : "linear-gradient(180deg, #17A5BA 0px, #17A5BA 48px, #F2FBF9 48px, #F2FBF9 100%)";

  return (
    <div className="w-full">
      {/* Franja superior donde descansan las pestañas estilo carpeta / Mercado Pago */}
      <div
        className="w-full pt-4 transition-all duration-300 sm:pt-6"
        style={{ background: headerBg }}
      >
        <div className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-8">
          <div
            role="tablist"
            aria-label="Secciones institucionales CEMEP"
            className="relative flex items-end gap-1 sm:gap-2"
          >
            {/* PESTAÑA 1: CEMEP */}
            <button
              type="button"
              role="tab"
              id="tab-cemep"
              aria-selected={isCemep}
              aria-controls="panel-cemep"
              onClick={() => onChangeTab("cemep")}
              style={{
                backgroundColor: isCemep ? "#FFFFFF" : "transparent",
                color: isCemep ? "#1B335D" : "#FFFFFF",
              }}
              className={`relative flex cursor-pointer items-center gap-2.5 px-5 py-3.5 text-sm font-black tracking-tight transition-all duration-200 focus:outline-none sm:px-8 sm:py-4 sm:text-base ${
                isCemep
                  ? "z-20 rounded-t-[22px]"
                  : "z-10 rounded-t-[20px] hover:bg-[#FFFFFF]/15"
              }`}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border p-0.5"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: isCemep ? "rgba(27,51,93,0.16)" : "rgba(255,255,255,0.55)",
                }}
              >
                <img
                  src="/cemep/cemep-logo-horizontal.png"
                  alt=""
                  className="h-full w-full object-contain"
                />
              </span>

              <span className="whitespace-nowrap">CEMEP</span>

              <span
                className="hidden rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider sm:inline-block"
                style={{
                  backgroundColor: isCemep ? "#E8F3FA" : "rgba(255,255,255,0.22)",
                  color: isCemep ? "#1B335D" : "#FFFFFF",
                }}
              >
                Centro Médico
              </span>

              {/* Curva cóncava invertida inferior derecha cuando CEMEP está activa */}
              {isCemep && (
                <svg
                  aria-hidden="true"
                  width="22"
                  height="22"
                  viewBox="0 0 22 22"
                  className="pointer-events-none absolute -right-[22px] bottom-0 block h-[22px] w-[22px]"
                >
                  <path d="M0 0 L0 22 L22 22 A22 22 0 0 1 0 0 Z" fill="#FFFFFF" />
                </svg>
              )}
            </button>

            {/* PESTAÑA 2: CEMEP PLUS */}
            <button
              type="button"
              role="tab"
              id="tab-cemep-plus"
              aria-selected={isPlus}
              aria-controls="panel-cemep-plus"
              onClick={() => onChangeTab("cemep_plus")}
              style={{
                backgroundColor: isPlus ? "#FFFFFF" : "transparent",
                color: isPlus ? "#1B335D" : "#FFFFFF",
              }}
              className={`relative flex cursor-pointer items-center gap-2.5 px-5 py-3.5 text-sm font-black tracking-tight transition-all duration-200 focus:outline-none sm:px-8 sm:py-4 sm:text-base ${
                isPlus
                  ? "z-20 rounded-t-[22px]"
                  : "z-10 rounded-t-[20px] hover:bg-[#FFFFFF]/15"
              }`}
            >
              {/* Curva cóncava invertida inferior izquierda cuando CEMEP Plus está activa */}
              {isPlus && (
                <svg
                  aria-hidden="true"
                  width="22"
                  height="22"
                  viewBox="0 0 22 22"
                  className="pointer-events-none absolute -left-[22px] bottom-0 block h-[22px] w-[22px]"
                >
                  <path d="M22 0 L22 22 L0 22 A22 22 0 0 0 22 0 Z" fill="#FFFFFF" />
                </svg>
              )}

              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: isPlus ? "rgba(0,158,227,0.35)" : "rgba(255,255,255,0.55)",
                }}
              >
                <img
                  src="/cemep/cemep-plus-logo.jpeg"
                  alt=""
                  className="h-full w-full object-cover"
                />
              </span>

              <span className="whitespace-nowrap">
                CEMEP{" "}
                <span
                  className="font-black italic"
                  style={{ color: isPlus ? "#009EE3" : "#D9F7FF" }}
                >
                  Plus
                </span>
              </span>

              <span
                className="hidden rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider sm:inline-block"
                style={{
                  backgroundColor: isPlus ? "#DFF8F0" : "rgba(255,255,255,0.22)",
                  color: isPlus ? "#0B6E5B" : "#FFFFFF",
                }}
              >
                Cobertura
              </span>

              {/* Curva cóncava invertida inferior derecha cuando CEMEP Plus está activa */}
              {isPlus && (
                <svg
                  aria-hidden="true"
                  width="22"
                  height="22"
                  viewBox="0 0 22 22"
                  className="pointer-events-none absolute -right-[22px] bottom-0 block h-[22px] w-[22px]"
                >
                  <path d="M0 0 L0 22 L22 22 A22 22 0 0 1 0 0 Z" fill="#FFFFFF" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Cuerpo principal blanco que se funde sin corte con la pestaña activa */}
      <div className="w-full pb-12" style={{ background: lowerUnderlay }}>
        <div className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-8">
          <div
            role="tabpanel"
            id={isCemep ? "panel-cemep" : "panel-cemep-plus"}
            aria-labelledby={isCemep ? "tab-cemep" : "tab-cemep-plus"}
            style={{ backgroundColor: "#FFFFFF" }}
            className={`relative z-10 min-h-[60vh] bg-[#FFFFFF] shadow-xl shadow-[#1B335D]/10 transition-all duration-200 ${
              isCemep
                ? "rounded-tr-[26px] rounded-b-[26px] rounded-tl-none"
                : "rounded-[26px]"
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
