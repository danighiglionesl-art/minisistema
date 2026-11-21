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
 * directamente con el contenedor blanco inferior sin líneas sub-píxel.
 */
export function MercadoPagoTabs({
  activeTab,
  onChangeTab,
  children,
}: MercadoPagoTabsProps) {
  const isCemep = activeTab === "cemep";
  const isPlus = activeTab === "cemep_plus";

  const headerBg = isCemep
    ? "linear-gradient(135deg, #1B335D 0%, #0A5E8A 55%, #0099D8 100%)"
    : "linear-gradient(135deg, #27AE88 0%, #1CA9B3 48%, #009EE3 100%)";

  const pageBg = isCemep ? "#F4F8FB" : "#F2FBF9";

  return (
    <div
      className="relative w-full pb-12"
      style={{ backgroundColor: pageBg }}
    >
      {/* Fondo superior unificado (cubre las pestañas y la parte alta de la tarjeta sin corte entre bloques) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-36 transition-all duration-300 sm:h-40"
        style={{ background: headerBg }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-3 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        {/* Barra de pestañas */}
        <div
          role="tablist"
          aria-label="Secciones institucionales CEMEP"
          className="relative z-30 flex items-end gap-1 sm:gap-2"
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
            className={`relative flex cursor-pointer items-center gap-2.5 px-5 py-3.5 text-sm font-black tracking-tight transition-colors duration-200 focus:outline-none sm:px-8 sm:py-4 sm:text-base ${
              isCemep
                ? "z-30 -mb-[2px] rounded-t-[22px] pb-[16px] sm:pb-[18px]"
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

            {/* Curva cóncava invertida inferior derecha (solapa 1px al costado y 2px hacia abajo para eliminar cualquier rayita sub-píxel) */}
            {isCemep && (
              <svg
                aria-hidden="true"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                shapeRendering="geometricPrecision"
                className="pointer-events-none absolute -right-[22px] bottom-0 block h-[24px] w-[24px]"
              >
                <path
                  d="M0 0 L2 0 A22 22 0 0 0 24 22 L24 24 L0 24 Z"
                  fill="#FFFFFF"
                />
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
            className={`relative flex cursor-pointer items-center gap-2.5 px-5 py-3.5 text-sm font-black tracking-tight transition-colors duration-200 focus:outline-none sm:px-8 sm:py-4 sm:text-base ${
              isPlus
                ? "z-30 -mb-[2px] rounded-t-[22px] pb-[16px] sm:pb-[18px]"
                : "z-10 rounded-t-[20px] hover:bg-[#FFFFFF]/15"
            }`}
          >
            {/* Curva cóncava invertida inferior izquierda */}
            {isPlus && (
              <svg
                aria-hidden="true"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                shapeRendering="geometricPrecision"
                className="pointer-events-none absolute -left-[22px] bottom-0 block h-[24px] w-[24px]"
              >
                <path
                  d="M24 0 L22 0 A22 22 0 0 1 0 22 L0 24 L24 24 Z"
                  fill="#FFFFFF"
                />
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

            {/* Curva cóncava invertida inferior derecha */}
            {isPlus && (
              <svg
                aria-hidden="true"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                shapeRendering="geometricPrecision"
                className="pointer-events-none absolute -right-[22px] bottom-0 block h-[24px] w-[24px]"
              >
                <path
                  d="M0 0 L2 0 A22 22 0 0 0 24 22 L24 24 L0 24 Z"
                  fill="#FFFFFF"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Cuerpo principal blanco fundido sin costuras con la pestaña activa */}
        <div
          role="tabpanel"
          id={isCemep ? "panel-cemep" : "panel-cemep-plus"}
          aria-labelledby={isCemep ? "tab-cemep" : "tab-cemep-plus"}
          style={{ backgroundColor: "#FFFFFF" }}
          className={`relative z-20 min-h-[60vh] bg-[#FFFFFF] shadow-xl shadow-[#1B335D]/10 transition-all duration-200 ${
            isCemep
              ? "rounded-tr-[26px] rounded-b-[26px] rounded-tl-none"
              : "rounded-[26px]"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
