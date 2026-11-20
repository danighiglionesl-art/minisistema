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
 */
export function MercadoPagoTabs({
  activeTab,
  onChangeTab,
  children,
}: MercadoPagoTabsProps) {
  const isCemep = activeTab === "cemep";
  const isPlus = activeTab === "cemep_plus";

  // Banda superior con la paleta oficial de cada marca
  const headerStripStyle: React.CSSProperties = isCemep
    ? {
        background:
          "linear-gradient(135deg, #1B335D 0%, #0A5E8A 58%, #0099D8 100%)",
      }
    : {
        background:
          "linear-gradient(135deg, #32B892 0%, #24B3B8 48%, #009EE3 100%)",
      };

  return (
    <div className="w-full">
      {/* Franja superior donde descansan las pestañas estilo carpeta / Mercado Pago */}
      <div
        className="w-full pt-4 transition-all duration-300 sm:pt-6"
        style={headerStripStyle}
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
              className={`relative flex cursor-pointer items-center gap-2.5 px-5 py-3.5 text-sm font-extrabold tracking-tight transition-colors duration-200 focus:outline-none sm:px-8 sm:py-4 sm:text-base ${
                isCemep
                  ? "z-20 rounded-t-[22px] bg-white text-[#1B335D]"
                  : "z-10 rounded-t-[20px] bg-transparent text-white/90 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border ${
                  isCemep
                    ? "border-[#1B335D]/15 bg-white"
                    : "border-white/40 bg-white/95"
                }`}
              >
                <img
                  src="/cemep/cemep-logo.jpg"
                  alt=""
                  className="h-full w-full object-contain p-0.5"
                />
              </span>
              <span className="whitespace-nowrap">CEMEP</span>
              <span
                className={`hidden rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:inline-block ${
                  isCemep
                    ? "bg-[#1B335D]/10 text-[#1B335D]"
                    : "bg-white/20 text-white"
                }`}
              >
                Centro Médico
              </span>

              {/* Curva cóncava invertida inferior derecha cuando CEMEP está activa */}
              {isCemep && (
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  className="pointer-events-none absolute -right-[20px] bottom-0 block h-5 w-5"
                >
                  <path d="M0 0 L0 20 L20 20 A20 20 0 0 1 0 0 Z" fill="#FFFFFF" />
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
              className={`relative flex cursor-pointer items-center gap-2.5 px-5 py-3.5 text-sm font-extrabold tracking-tight transition-colors duration-200 focus:outline-none sm:px-8 sm:py-4 sm:text-base ${
                isPlus
                  ? "z-20 rounded-t-[22px] bg-white text-[#1B335D]"
                  : "z-10 rounded-t-[20px] bg-transparent text-white/90 hover:bg-white/10 hover:text-white"
              }`}
            >
              {/* Curva cóncava invertida inferior izquierda cuando CEMEP Plus está activa */}
              {isPlus && (
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  className="pointer-events-none absolute -left-[20px] bottom-0 block h-5 w-5"
                >
                  <path d="M20 0 L20 20 L0 20 A20 20 0 0 0 20 0 Z" fill="#FFFFFF" />
                </svg>
              )}

              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border ${
                  isPlus
                    ? "border-[#009EE3]/30 bg-white"
                    : "border-white/40 bg-white/95"
                }`}
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
                  className={
                    isPlus
                      ? "font-black italic text-[#009EE3]"
                      : "font-black italic text-[#E0F7FF]"
                  }
                >
                  Plus
                </span>
              </span>
              <span
                className={`hidden rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:inline-block ${
                  isPlus
                    ? "bg-[#48C19F]/20 text-[#0B6E5B]"
                    : "bg-white/20 text-white"
                }`}
              >
                Cobertura
              </span>

              {/* Curva cóncava invertida inferior derecha cuando CEMEP Plus está activa */}
              {isPlus && (
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  className="pointer-events-none absolute -right-[20px] bottom-0 block h-5 w-5"
                >
                  <path d="M0 0 L0 20 L20 20 A20 20 0 0 1 0 0 Z" fill="#FFFFFF" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Cuerpo principal blanco que se funde sin costuras con la pestaña activa */}
      <div
        className="w-full pb-12"
        style={{
          background: isCemep
            ? "linear-gradient(180deg, #0099D8 0px, #0099D8 56px, #F4F8FB 56px, #F4F8FB 100%)"
            : "linear-gradient(180deg, #009EE3 0px, #009EE3 56px, #F2FBF9 56px, #F2FBF9 100%)",
        }}
      >
        <div className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-8">
          <div
            role="tabpanel"
            id={isCemep ? "panel-cemep" : "panel-cemep-plus"}
            aria-labelledby={isCemep ? "tab-cemep" : "tab-cemep-plus"}
            className={`relative z-10 min-h-[60vh] bg-white shadow-xl shadow-[#1B335D]/8 transition-all duration-200 ${
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
