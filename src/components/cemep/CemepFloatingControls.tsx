"use client";

import React from "react";
import { ArrowUpRight, Stethoscope, UserRound } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/SocialIcons";
import type { CemepSectionTab } from "./MercadoPagoTabs";

interface CemepFloatingControlsProps {
  activeTab: CemepSectionTab;
  cemepWhatsappDigits: string;
  cemepWhatsappDisplay: string;
  plusWhatsappDigits: string;
  plusWhatsappDisplay: string;
  loggedPatientName?: string | null;
  loggedPatientPhoto?: string | null;
  loggedProfName?: string | null;
  onOpenPatientPortal: () => void;
  onOpenProfPortal: () => void;
}

/**
 * Barra fija inferior derecha:
 * [ Acceso a Pacientes ] [ Acceso a Profesionales ] ( Botón redondo WhatsApp )
 * Los dos botones de acceso (estilo ReikiOnline) quedan fijos uno al lado del otro,
 * inmediatamente a la izquierda del botón redondo de WhatsApp.
 */
export function CemepFloatingControls({
  activeTab,
  cemepWhatsappDigits,
  cemepWhatsappDisplay,
  plusWhatsappDigits,
  plusWhatsappDisplay,
  loggedPatientName,
  loggedPatientPhoto,
  loggedProfName,
  onOpenPatientPortal,
  onOpenProfPortal,
}: CemepFloatingControlsProps) {
  const isPlus = activeTab === "cemep_plus";
  const waDigits = (isPlus ? plusWhatsappDigits : cemepWhatsappDigits).replace(/\D/g, "");
  const waDisplay = isPlus ? plusWhatsappDisplay : cemepWhatsappDisplay;
  const waText = isPlus
    ? "Hola CEMEP Plus! Quiero consultar por afiliación, cobertura familiar y beneficios."
    : "Hola CEMEP! Quiero consultar por turnos médicos o estudios en Centro Médico Paulucci.";
  const waHref = `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}`;

  return (
    <aside
      aria-label="Accesos rápidos y WhatsApp CEMEP"
      className="fixed right-3 bottom-3 z-40 flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-end gap-2 sm:right-5 sm:bottom-5 sm:flex-nowrap sm:gap-2.5"
    >
      {/* Botón 1: Acceso a Pacientes (estilo ReikiOnline, legible con blanco puro sobre azul marino CEMEP) */}
      <button
        type="button"
        onClick={onOpenPatientPortal}
        aria-label="Acceso a Pacientes"
        title={
          loggedPatientName
            ? `Acceso a Pacientes (${loggedPatientName})`
            : "Acceso a Pacientes"
        }
        style={{
          backgroundColor: "#1B335D",
          color: "#FFFFFF",
          borderColor: "#A6CA0E",
        }}
        className="group flex cursor-pointer items-center gap-2 rounded-full border-2 py-1.5 pr-3 pl-1.5 shadow-xl shadow-[#1B335D]/35 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] sm:pr-3.5"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border sm:h-9 sm:w-9"
          style={{
            backgroundColor: "#0A74A6",
            borderColor: "rgba(166,202,14,0.65)",
            color: "#FFFFFF",
          }}
        >
          {loggedPatientPhoto ? (
            <img
              src={loggedPatientPhoto}
              alt={loggedPatientName || "Paciente"}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <UserRound className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
          )}
        </span>

        <span
          className="whitespace-nowrap text-xs font-extrabold tracking-wide sm:text-sm"
          style={{ color: "#FFFFFF" }}
        >
          Acceso a Pacientes
        </span>

        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-0.5"
          style={{ backgroundColor: "#A6CA0E", color: "#1B335D" }}
        >
          <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.6]" />
        </span>
      </button>

      {/* Botón 2: Acceso a Profesionales (al lado del de Pacientes, a la izquierda del WhatsApp) */}
      <button
        type="button"
        onClick={onOpenProfPortal}
        aria-label="Acceso a Profesionales"
        title={
          loggedProfName
            ? `Acceso a Profesionales (${loggedProfName})`
            : "Acceso a Profesionales"
        }
        style={{
          backgroundColor: "#0099D8",
          color: "#FFFFFF",
          borderColor: "#FFFFFF",
        }}
        className="group flex cursor-pointer items-center gap-2 rounded-full border-2 py-1.5 pr-3 pl-1.5 shadow-xl shadow-[#0099D8]/35 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] sm:pr-3.5"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border sm:h-9 sm:w-9"
          style={{
            backgroundColor: "#1B335D",
            borderColor: "rgba(255,255,255,0.5)",
            color: "#57B7B8",
          }}
        >
          <Stethoscope className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
        </span>

        <span
          className="whitespace-nowrap text-xs font-extrabold tracking-wide sm:text-sm"
          style={{ color: "#FFFFFF" }}
        >
          Acceso a Profesionales
        </span>

        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-0.5"
          style={{ backgroundColor: "#FFFFFF", color: "#1B335D" }}
        >
          <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.6]" />
        </span>
      </button>

      {/* Botón 3: Redondo fijo de WhatsApp (dinámico según CEMEP o CEMEP Plus) */}
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Contactar a ${isPlus ? "CEMEP Plus" : "CEMEP"} por WhatsApp (${waDisplay})`}
        title={`${isPlus ? "WhatsApp CEMEP Plus" : "WhatsApp CEMEP"} · ${waDisplay}`}
        style={{
          backgroundColor: "#25D366",
          color: "#FFFFFF",
          borderColor: "#FFFFFF",
        }}
        className="group flex h-13 w-13 shrink-0 items-center justify-center rounded-full border-2 shadow-2xl shadow-[#1B335D]/40 transition-all duration-200 hover:scale-[1.07] active:scale-[0.96] sm:h-14 sm:w-14"
      >
        <WhatsAppIcon size={28} className="shrink-0" style={{ color: "#FFFFFF" }} />
      </a>
    </aside>
  );
}
