"use client";

import React from "react";
import { SolutionCategoryId } from "@/types/minisistema";

interface CategoryIllustrationProps {
  categoryId: SolutionCategoryId;
  className?: string;
}

/**
 * Familia uniforme de ilustraciones tecnológicas y mini-mockups SVG
 * utilizando exclusivamente la paleta oficial: #112D3A, #56D7A1 y #FFFFFF.
 */
export function CategoryIllustration({
  categoryId,
  className = "",
}: CategoryIllustrationProps) {
  switch (categoryId) {
    case "gestion":
      return (
        <svg
          viewBox="0 0 280 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className={`w-full h-auto ${className}`}
        >
          {/* Marco de ventana de gestión */}
          <rect
            x="6"
            y="6"
            width="268"
            height="108"
            rx="12"
            fill="#112D3A"
            stroke="#FFFFFF"
            strokeOpacity="0.18"
          />
          <line
            x1="6"
            y1="24"
            x2="274"
            y2="24"
            stroke="#FFFFFF"
            strokeOpacity="0.12"
          />
          <circle cx="18" cy="15" r="2.5" fill="#FFFFFF" fillOpacity="0.35" />
          <circle cx="26" cy="15" r="2.5" fill="#FFFFFF" fillOpacity="0.55" />
          <circle cx="34" cy="15" r="2.5" fill="#56D7A1" />
          <rect
            x="210"
            y="11"
            width="52"
            height="8"
            rx="4"
            fill="#56D7A1"
            fillOpacity="0.2"
          />

          {/* Panel lateral izquierdo */}
          <rect
            x="14"
            y="32"
            width="46"
            height="72"
            rx="6"
            fill="#FFFFFF"
            fillOpacity="0.04"
          />
          <rect x="20" y="40" width="34" height="5" rx="2.5" fill="#56D7A1" />
          <rect
            x="20"
            y="51"
            width="28"
            height="4"
            rx="2"
            fill="#FFFFFF"
            fillOpacity="0.35"
          />
          <rect
            x="20"
            y="60"
            width="32"
            height="4"
            rx="2"
            fill="#FFFFFF"
            fillOpacity="0.35"
          />
          <rect
            x="20"
            y="69"
            width="24"
            height="4"
            rx="2"
            fill="#FFFFFF"
            fillOpacity="0.35"
          />

          {/* Gráfico de ventas e inventario */}
          <rect
            x="68"
            y="32"
            width="118"
            height="72"
            rx="6"
            fill="#FFFFFF"
            fillOpacity="0.04"
            stroke="#56D7A1"
            strokeOpacity="0.25"
          />
          <rect x="78" y="76" width="12" height="18" rx="3" fill="#56D7A1" fillOpacity="0.4" />
          <rect x="96" y="66" width="12" height="28" rx="3" fill="#56D7A1" fillOpacity="0.6" />
          <rect x="114" y="56" width="12" height="38" rx="3" fill="#56D7A1" fillOpacity="0.8" />
          <rect x="132" y="44" width="12" height="50" rx="3" fill="#56D7A1" />
          <rect x="150" y="50" width="12" height="44" rx="3" fill="#FFFFFF" fillOpacity="0.7" />
          <path
            d="M84 70 L102 60 L120 50 L138 38 L156 43"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Indicadores de clientes y stock */}
          <rect
            x="194"
            y="32"
            width="72"
            height="33"
            rx="6"
            fill="#56D7A1"
            fillOpacity="0.14"
            stroke="#56D7A1"
            strokeOpacity="0.45"
          />
          <rect x="202" y="40" width="32" height="5" rx="2.5" fill="#56D7A1" />
          <rect x="202" y="50" width="48" height="7" rx="3" fill="#FFFFFF" />

          <rect
            x="194"
            y="71"
            width="72"
            height="33"
            rx="6"
            fill="#FFFFFF"
            fillOpacity="0.05"
          />
          <rect
            x="202"
            y="79"
            width="40"
            height="4"
            rx="2"
            fill="#FFFFFF"
            fillOpacity="0.6"
          />
          <rect x="202" y="89" width="54" height="6" rx="3" fill="#56D7A1" fillOpacity="0.75" />
        </svg>
      );

    case "tiendas":
      return (
        <svg
          viewBox="0 0 280 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className={`w-full h-auto ${className}`}
        >
          <rect
            x="6"
            y="6"
            width="268"
            height="108"
            rx="12"
            fill="#112D3A"
            stroke="#FFFFFF"
            strokeOpacity="0.18"
          />
          {/* Barra superior tienda con carrito */}
          <rect
            x="16"
            y="14"
            width="70"
            height="8"
            rx="4"
            fill="#FFFFFF"
            fillOpacity="0.7"
          />
          <rect x="208" y="12" width="54" height="14" rx="7" fill="#56D7A1" />
          <circle cx="220" cy="19" r="3" fill="#112D3A" />
          <rect x="227" y="17" width="26" height="4" rx="2" fill="#112D3A" />

          {/* 3 Tarjetas de catálogo de productos */}
          {[16, 98, 180].map((xPos, i) => (
            <g key={xPos}>
              <rect
                x={xPos}
                y="34"
                width="74"
                height="70"
                rx="8"
                fill="#FFFFFF"
                fillOpacity="0.04"
                stroke={i === 1 ? "#56D7A1" : "#FFFFFF"}
                strokeOpacity={i === 1 ? "0.7" : "0.15"}
              />
              <rect
                x={xPos + 7}
                y="41"
                width="60"
                height="30"
                rx="5"
                fill="#56D7A1"
                fillOpacity={i === 1 ? "0.28" : "0.12"}
              />
              <rect
                x={xPos + 7}
                y="77"
                width="42"
                height="5"
                rx="2.5"
                fill="#FFFFFF"
                fillOpacity="0.85"
              />
              <rect
                x={xPos + 7}
                y="87"
                width="32"
                height="10"
                rx="4"
                fill="#56D7A1"
              />
              <circle
                cx={xPos + 59}
                cy="92"
                r="6"
                fill="#FFFFFF"
                fillOpacity="0.18"
              />
            </g>
          ))}
        </svg>
      );

    case "pwa":
      return (
        <svg
          viewBox="0 0 280 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className={`w-full h-auto ${className}`}
        >
          {/* Computadora de fondo */}
          <rect
            x="16"
            y="12"
            width="156"
            height="88"
            rx="10"
            fill="#112D3A"
            stroke="#FFFFFF"
            strokeOpacity="0.25"
          />
          <rect
            x="26"
            y="24"
            width="136"
            height="14"
            rx="4"
            fill="#56D7A1"
            fillOpacity="0.18"
          />
          <rect
            x="26"
            y="44"
            width="64"
            height="44"
            rx="6"
            fill="#FFFFFF"
            fillOpacity="0.06"
          />
          <rect
            x="96"
            y="44"
            width="66"
            height="44"
            rx="6"
            fill="#FFFFFF"
            fillOpacity="0.06"
          />

          {/* Tablet superpuesta */}
          <rect
            x="146"
            y="26"
            width="76"
            height="82"
            rx="10"
            fill="#112D3A"
            stroke="#56D7A1"
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />
          <rect x="156" y="38" width="56" height="8" rx="4" fill="#56D7A1" />
          <rect
            x="156"
            y="52"
            width="56"
            height="20"
            rx="4"
            fill="#FFFFFF"
            fillOpacity="0.1"
          />
          <rect
            x="156"
            y="78"
            width="56"
            height="18"
            rx="4"
            fill="#FFFFFF"
            fillOpacity="0.06"
          />

          {/* Smartphone PWA en primer plano */}
          <rect
            x="208"
            y="38"
            width="52"
            height="74"
            rx="10"
            fill="#112D3A"
            stroke="#56D7A1"
            strokeWidth="2"
          />
          <line
            x1="226"
            y1="45"
            x2="242"
            y2="45"
            stroke="#FFFFFF"
            strokeOpacity="0.4"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect
            x="216"
            y="53"
            width="36"
            height="24"
            rx="5"
            fill="#56D7A1"
            fillOpacity="0.22"
          />
          <rect x="216" y="84" width="36" height="14" rx="5" fill="#56D7A1" />
        </svg>
      );

    case "reservas":
      return (
        <svg
          viewBox="0 0 280 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className={`w-full h-auto ${className}`}
        >
          <rect
            x="6"
            y="6"
            width="268"
            height="108"
            rx="12"
            fill="#112D3A"
            stroke="#FFFFFF"
            strokeOpacity="0.18"
          />
          {/* Grilla de calendario a la izquierda */}
          <rect
            x="16"
            y="18"
            width="150"
            height="84"
            rx="8"
            fill="#FFFFFF"
            fillOpacity="0.04"
          />
          {[0, 1, 2, 3].map((col) =>
            [0, 1, 2].map((row) => {
              const active = (col === 1 && row === 1) || (col === 2 && row === 0);
              return (
                <rect
                  key={`${col}-${row}`}
                  x={26 + col * 34}
                  y={28 + row * 22}
                  width="28"
                  height="16"
                  rx="4"
                  fill={active ? "#56D7A1" : "#FFFFFF"}
                  fillOpacity={active ? "1" : "0.1"}
                />
              );
            })
          )}

          {/* Tarjeta de confirmación de turno a la derecha */}
          <rect
            x="176"
            y="18"
            width="88"
            height="84"
            rx="8"
            fill="#56D7A1"
            fillOpacity="0.14"
            stroke="#56D7A1"
            strokeOpacity="0.6"
          />
          <circle cx="220" cy="42" r="12" fill="#56D7A1" />
          <path
            d="M215 42 L218.5 45.5 L226 38"
            stroke="#112D3A"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="190"
            y="62"
            width="60"
            height="6"
            rx="3"
            fill="#FFFFFF"
            fillOpacity="0.9"
          />
          <rect
            x="198"
            y="74"
            width="44"
            height="5"
            rx="2.5"
            fill="#56D7A1"
          />
          <rect
            x="188"
            y="86"
            width="64"
            height="8"
            rx="4"
            fill="#FFFFFF"
            fillOpacity="0.2"
          />
        </svg>
      );

    case "institucional":
      return (
        <svg
          viewBox="0 0 280 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className={`w-full h-auto ${className}`}
        >
          <rect
            x="6"
            y="6"
            width="268"
            height="108"
            rx="12"
            fill="#112D3A"
            stroke="#FFFFFF"
            strokeOpacity="0.18"
          />
          {/* Carnet digital de socio / institución */}
          <rect
            x="18"
            y="20"
            width="124"
            height="80"
            rx="10"
            fill="#FFFFFF"
            fillOpacity="0.05"
            stroke="#56D7A1"
            strokeOpacity="0.55"
          />
          <circle cx="46" cy="50" r="14" fill="#56D7A1" fillOpacity="0.25" stroke="#56D7A1" strokeWidth="1.5" />
          <circle cx="46" cy="46" r="5" fill="#FFFFFF" />
          <path d="M36 60 C38 54 54 54 56 60" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          <rect x="68" y="38" width="58" height="6" rx="3" fill="#FFFFFF" />
          <rect x="68" y="50" width="44" height="5" rx="2.5" fill="#56D7A1" />
          <rect x="30" y="76" width="100" height="12" rx="6" fill="#56D7A1" />

          {/* Padrón, biblioteca y cuotas */}
          <rect
            x="154"
            y="20"
            width="108"
            height="23"
            rx="6"
            fill="#FFFFFF"
            fillOpacity="0.05"
          />
          <circle cx="168" cy="31.5" r="4" fill="#56D7A1" />
          <rect x="178" y="29" width="70" height="5" rx="2.5" fill="#FFFFFF" fillOpacity="0.8" />

          <rect
            x="154"
            y="49"
            width="108"
            height="23"
            rx="6"
            fill="#FFFFFF"
            fillOpacity="0.05"
          />
          <circle cx="168" cy="60.5" r="4" fill="#56D7A1" />
          <rect x="178" y="58" width="62" height="5" rx="2.5" fill="#FFFFFF" fillOpacity="0.8" />

          <rect
            x="154"
            y="78"
            width="108"
            height="22"
            rx="6"
            fill="#56D7A1"
            fillOpacity="0.16"
          />
          <circle cx="168" cy="89" r="4" fill="#56D7A1" />
          <rect x="178" y="86.5" width="74" height="5" rx="2.5" fill="#56D7A1" />
        </svg>
      );

    case "automatizaciones":
      return (
        <svg
          viewBox="0 0 280 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className={`w-full h-auto ${className}`}
        >
          <rect
            x="6"
            y="6"
            width="268"
            height="108"
            rx="12"
            fill="#112D3A"
            stroke="#FFFFFF"
            strokeOpacity="0.18"
          />
          {/* Conectores de flujo automático */}
          <path
            d="M72 36 H118 L140 60 L118 84 H72"
            stroke="#56D7A1"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          <path
            d="M140 60 H208"
            stroke="#56D7A1"
            strokeWidth="2.5"
          />

          {/* Nodos de entrada */}
          <rect
            x="22"
            y="22"
            width="52"
            height="28"
            rx="7"
            fill="#FFFFFF"
            fillOpacity="0.07"
            stroke="#FFFFFF"
            strokeOpacity="0.3"
          />
          <rect x="32" y="33" width="32" height="6" rx="3" fill="#FFFFFF" />

          <rect
            x="22"
            y="70"
            width="52"
            height="28"
            rx="7"
            fill="#FFFFFF"
            fillOpacity="0.07"
            stroke="#FFFFFF"
            strokeOpacity="0.3"
          />
          <rect x="32" y="81" width="32" height="6" rx="3" fill="#FFFFFF" />

          {/* Nodo central automatizador */}
          <circle
            cx="140"
            cy="60"
            r="24"
            fill="#56D7A1"
            fillOpacity="0.2"
            stroke="#56D7A1"
            strokeWidth="2"
          />
          <circle cx="140" cy="60" r="12" fill="#56D7A1" />

          {/* Nodo destino integrado */}
          <rect
            x="206"
            y="36"
            width="54"
            height="48"
            rx="10"
            fill="#56D7A1"
            fillOpacity="0.16"
            stroke="#56D7A1"
            strokeWidth="1.5"
          />
          <rect x="218" y="50" width="30" height="6" rx="3" fill="#FFFFFF" />
          <rect x="218" y="62" width="22" height="6" rx="3" fill="#56D7A1" />
        </svg>
      );

    case "especializadas":
      return (
        <svg
          viewBox="0 0 280 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className={`w-full h-auto ${className}`}
        >
          <rect
            x="6"
            y="6"
            width="268"
            height="108"
            rx="12"
            fill="#112D3A"
            stroke="#FFFFFF"
            strokeOpacity="0.18"
          />
          {/* Ruta de trazabilidad y logística */}
          <rect
            x="18"
            y="20"
            width="148"
            height="80"
            rx="8"
            fill="#FFFFFF"
            fillOpacity="0.04"
          />
          <path
            d="M34 76 C58 40, 92 84, 146 38"
            stroke="#56D7A1"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="34" cy="76" r="5" fill="#FFFFFF" />
          <circle cx="88" cy="60" r="5" fill="#56D7A1" />
          <circle cx="146" cy="38" r="6" fill="#56D7A1" stroke="#FFFFFF" strokeWidth="2" />

          {/* Panel de lotes y producción */}
          <rect
            x="176"
            y="20"
            width="86"
            height="80"
            rx="8"
            fill="#FFFFFF"
            fillOpacity="0.05"
            stroke="#56D7A1"
            strokeOpacity="0.4"
          />
          <rect x="186" y="32" width="66" height="8" rx="4" fill="#56D7A1" />
          <rect x="186" y="48" width="50" height="6" rx="3" fill="#FFFFFF" fillOpacity="0.7" />
          <rect x="186" y="62" width="66" height="6" rx="3" fill="#FFFFFF" fillOpacity="0.4" />
          <rect x="186" y="76" width="42" height="10" rx="4" fill="#56D7A1" fillOpacity="0.3" />
        </svg>
      );

    case "idea-propia":
    default:
      return (
        <svg
          viewBox="0 0 280 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className={`w-full h-auto ${className}`}
        >
          <rect
            x="6"
            y="6"
            width="268"
            height="108"
            rx="12"
            fill="#112D3A"
            stroke="#56D7A1"
            strokeOpacity="0.5"
          />
          {/* Idea / chispa inicial a la izquierda */}
          <circle
            cx="62"
            cy="60"
            r="28"
            fill="#56D7A1"
            fillOpacity="0.18"
            stroke="#56D7A1"
            strokeWidth="1.75"
          />
          <path
            d="M62 42 L66 54 L78 58 L66 62 L62 74 L58 62 L46 58 L58 54 Z"
            fill="#56D7A1"
          />

          {/* Conector de transformación */}
          <path
            d="M98 60 H148"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <polygon points="148,55 158,60 148,65" fill="#56D7A1" />

          {/* Pantalla digital resultante a la derecha */}
          <rect
            x="166"
            y="24"
            width="92"
            height="72"
            rx="10"
            fill="#112D3A"
            stroke="#FFFFFF"
            strokeWidth="1.75"
          />
          <rect x="178" y="36" width="68" height="10" rx="4" fill="#56D7A1" />
          <rect
            x="178"
            y="52"
            width="42"
            height="8"
            rx="3"
            fill="#FFFFFF"
            fillOpacity="0.8"
          />
          <rect
            x="178"
            y="66"
            width="68"
            height="16"
            rx="5"
            fill="#56D7A1"
            fillOpacity="0.25"
          />
        </svg>
      );
  }
}
