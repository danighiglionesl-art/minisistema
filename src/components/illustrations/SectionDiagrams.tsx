"use client";

import React from "react";
import { BrandWordmark } from "@/components/brand/BrandWordmark";

/**
 * 1. Diagramas comparativos para la Sección 3 ("Nuestra Diferencia")
 * Contrastan visualmente una estructura rígida/desconectada frente a un núcleo MiniSistema integrado.
 */
export function ComparisonDiagram({ variant }: { variant: "generic" | "minisistema" }) {
  if (variant === "generic") {
    return (
      <div className="mb-5 overflow-hidden rounded-2xl border border-[#FFFFFF]/15 bg-[#112D3A]/90 p-4">
        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-[#FFFFFF]/60">
          <span>ESQUEMA FRAGMENTADO</span>
          <span>Múltiples planillas y pasos rígidos</span>
        </div>
        <svg
          viewBox="0 0 360 110"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="w-full h-auto"
        >
          {/* Bloques desconectados */}
          <rect
            x="12"
            y="14"
            width="84"
            height="36"
            rx="6"
            fill="#FFFFFF"
            fillOpacity="0.05"
            stroke="#FFFFFF"
            strokeOpacity="0.25"
          />
          <text x="24" y="36" fill="#FFFFFF" fillOpacity="0.7" fontSize="10" fontWeight="600">
            Planillas
          </text>

          <rect
            x="138"
            y="10"
            width="88"
            height="36"
            rx="6"
            fill="#FFFFFF"
            fillOpacity="0.05"
            stroke="#FFFFFF"
            strokeOpacity="0.25"
          />
          <text x="152" y="32" fill="#FFFFFF" fillOpacity="0.7" fontSize="10" fontWeight="600">
            Mensajes
          </text>

          <rect
            x="264"
            y="18"
            width="84"
            height="36"
            rx="6"
            fill="#FFFFFF"
            fillOpacity="0.05"
            stroke="#FFFFFF"
            strokeOpacity="0.25"
          />
          <text x="276" y="40" fill="#FFFFFF" fillOpacity="0.7" fontSize="10" fontWeight="600">
            Caja fija
          </text>

          {/* Conectores cortados / sin sincronización */}
          <line
            x1="96"
            y1="32"
            x2="134"
            y2="28"
            stroke="#FFFFFF"
            strokeOpacity="0.3"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <line
            x1="226"
            y1="28"
            x2="260"
            y2="36"
            stroke="#FFFFFF"
            strokeOpacity="0.3"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Barra inferior de funciones rígidas no utilizadas */}
          <rect
            x="12"
            y="66"
            width="336"
            height="32"
            rx="8"
            fill="#FFFFFF"
            fillOpacity="0.03"
            stroke="#FFFFFF"
            strokeOpacity="0.15"
          />
          <rect x="22" y="76" width="56" height="12" rx="4" fill="#FFFFFF" fillOpacity="0.12" />
          <rect x="86" y="76" width="72" height="12" rx="4" fill="#FFFFFF" fillOpacity="0.12" />
          <rect x="166" y="76" width="64" height="12" rx="4" fill="#FFFFFF" fillOpacity="0.12" />
          <rect x="238" y="76" width="98" height="12" rx="4" fill="#FFFFFF" fillOpacity="0.12" />
        </svg>
      </div>
    );
  }

  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-[#56D7A1]/45 bg-[#112D3A] p-4 shadow-inner">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-[#56D7A1]">
        <span className="inline-flex items-center gap-1.5">
          <span>ARQUITECTURA INTEGRADA</span>
          <BrandWordmark className="h-3.5" />
        </span>
        <span>Todo conectado a tu forma de trabajar</span>
      </div>
      <svg
        viewBox="0 0 360 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="w-full h-auto"
      >
        {/* Conectores continuos en verde menta */}
        <path
          d="M88 30 H126 M88 80 H126 M234 30 H272 M234 80 H272"
          stroke="#56D7A1"
          strokeWidth="2"
        />

        {/* Módulos izquierdos */}
        <rect
          x="12"
          y="14"
          width="76"
          height="32"
          rx="8"
          fill="#56D7A1"
          fillOpacity="0.15"
          stroke="#56D7A1"
        />
        <text x="27" y="34" fill="#FFFFFF" fontSize="10" fontWeight="700">
          Clientes
        </text>

        <rect
          x="12"
          y="64"
          width="76"
          height="32"
          rx="8"
          fill="#56D7A1"
          fillOpacity="0.15"
          stroke="#56D7A1"
        />
        <text x="31" y="84" fill="#FFFFFF" fontSize="10" fontWeight="700">
          Stock
        </text>

        {/* Núcleo central con el logotipo oficial minisistema. */}
        <rect
          x="124"
          y="20"
          width="112"
          height="70"
          rx="14"
          fill="#112D3A"
          stroke="#56D7A1"
          strokeWidth="2.5"
        />
        <image
          href="/brand/logotipo-minisistema.png"
          x="133"
          y="34"
          width="94"
          height="20"
          preserveAspectRatio="xMidYMid meet"
        />
        <text x="155" y="72" fill="#56D7A1" fontSize="9" fontWeight="800">
          A MEDIDA
        </text>

        {/* Módulos derechos */}
        <rect
          x="272"
          y="14"
          width="76"
          height="32"
          rx="8"
          fill="#56D7A1"
          fillOpacity="0.15"
          stroke="#56D7A1"
        />
        <text x="289" y="34" fill="#FFFFFF" fontSize="10" fontWeight="700">
          Ventas
        </text>

        <rect
          x="272"
          y="64"
          width="76"
          height="32"
          rx="8"
          fill="#56D7A1"
          fillOpacity="0.15"
          stroke="#56D7A1"
        />
        <text x="285" y="84" fill="#FFFFFF" fontSize="10" fontWeight="700">
          Reportes
        </text>
      </svg>
    </div>
  );
}

/**
 * 2. Ilustraciones distintivas para las 3 tarjetas de la Sección 12 ("Nuestros Tres Servicios")
 */
export function ServiceHeaderIllustration({ serviceId }: { serviceId: string }) {
  if (serviceId === "desarrollo-inicial") {
    return (
      <svg
        viewBox="0 0 300 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="w-full h-auto rounded-2xl border border-[#56D7A1]/30 bg-[#112D3A] p-2"
      >
        {/* Ventana de diseño e interfaz en construcción */}
        <rect
          x="14"
          y="12"
          width="170"
          height="72"
          rx="8"
          fill="#FFFFFF"
          fillOpacity="0.04"
          stroke="#56D7A1"
          strokeOpacity="0.6"
        />
        <rect x="24" y="22" width="60" height="8" rx="4" fill="#56D7A1" />
        <rect x="24" y="36" width="90" height="16" rx="4" fill="#FFFFFF" fillOpacity="0.12" />
        <rect x="24" y="58" width="146" height="16" rx="4" fill="#56D7A1" fillOpacity="0.2" />

        {/* Bloque de componente acoplándose */}
        <rect
          x="198"
          y="20"
          width="86"
          height="56"
          rx="8"
          fill="#56D7A1"
        />
        <rect x="210" y="34" width="62" height="7" rx="3.5" fill="#112D3A" />
        <rect x="210" y="48" width="44" height="7" rx="3.5" fill="#112D3A" fillOpacity="0.7" />
        <path d="M186 48 H196" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="3 3" />
      </svg>
    );
  }

  if (serviceId === "mantenimiento-soporte") {
    return (
      <svg
        viewBox="0 0 300 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="w-full h-auto rounded-2xl border border-[#FFFFFF]/15 bg-[#112D3A] p-2"
      >
        {/* Pulso de monitoreo y continuidad operativa */}
        <rect
          x="14"
          y="14"
          width="186"
          height="68"
          rx="8"
          fill="#FFFFFF"
          fillOpacity="0.04"
        />
        <path
          d="M26 52 H64 L78 28 L94 68 L110 40 L124 52 H186"
          stroke="#56D7A1"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Escudo de protección y soporte */}
        <path
          d="M244 18 L274 30 V48 C274 64 261 75 244 80 C227 75 214 64 214 48 V30 L244 18 Z"
          fill="#56D7A1"
          fillOpacity="0.18"
          stroke="#56D7A1"
          strokeWidth="2"
        />
        <path
          d="M235 49 L241 55 L254 42"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 300 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="w-full h-auto rounded-2xl border border-[#FFFFFF]/15 bg-[#112D3A] p-2"
    >
      {/* Escalera de módulos evolutivos */}
      <rect
        x="18"
        y="48"
        width="68"
        height="34"
        rx="7"
        fill="#FFFFFF"
        fillOpacity="0.08"
        stroke="#FFFFFF"
        strokeOpacity="0.3"
      />
      <rect x="30" y="62" width="44" height="6" rx="3" fill="#FFFFFF" />

      <path d="M90 65 H112" stroke="#56D7A1" strokeWidth="2" />

      <rect
        x="116"
        y="32"
        width="68"
        height="50"
        rx="7"
        fill="#56D7A1"
        fillOpacity="0.18"
        stroke="#56D7A1"
      />
      <rect x="128" y="46" width="44" height="6" rx="3" fill="#56D7A1" />
      <rect x="128" y="58" width="32" height="6" rx="3" fill="#FFFFFF" />

      <path d="M188 52 H210" stroke="#56D7A1" strokeWidth="2" />

      <rect
        x="214"
        y="16"
        width="68"
        height="66"
        rx="7"
        fill="#56D7A1"
      />
      <rect x="226" y="30" width="44" height="6" rx="3" fill="#112D3A" />
      <rect x="226" y="44" width="36" height="6" rx="3" fill="#112D3A" />
      <rect x="226" y="58" width="44" height="8" rx="4" fill="#FFFFFF" />
    </svg>
  );
}
