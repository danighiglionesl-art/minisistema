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
  loggedProfName?: string | null;
  onOpenPatientPortal: () => void;
  onOpenProfPortal: () => void;
}

/**
 * Controles fijos en pantalla:
 * - Dos botones fijos estilo ReikiOnline (Acceso a Pacientes y Acceso a Profesionales)
 * - Botón redondo fijo de WhatsApp que cambia automáticamente entre CEMEP y CEMEP Plus
 */
export function CemepFloatingControls({
  activeTab,
  cemepWhatsappDigits,
  cemepWhatsappDisplay,
  plusWhatsappDigits,
  plusWhatsappDisplay,
  loggedPatientName,
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
    <>
      {/* Dos botones fijos de Acceso a Pacientes y Acceso a Profesionales (estilo ReikiOnline) */}
      <aside
        aria-label="Accesos rápidos a portales CEMEP"
        className="fixed bottom-4 left-3 z-40 flex flex-col gap-2 sm:bottom-6 sm:left-5"
      >
        <button
          type="button"
          onClick={onOpenPatientPortal}
          aria-label="Acceso a Pacientes"
          title="Acceso a Pacientes — Turnos, Estudios y Recetas"
          className="group flex cursor-pointer items-center gap-2 rounded-full border-2 border-[#A6CA0E] bg-[#1B335D] py-1.5 pr-3.5 pl-1.5 text-white shadow-xl shadow-[#1B335D]/35 transition-all duration-200 hover:scale-[1.03] hover:bg-[#142748] active:scale-[0.98]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#A6CA0E]/60 bg-[#0A74A6] text-white">
            <UserRound className="h-4.5 w-4.5" />
          </span>

          <span className="flex flex-col text-left leading-tight">
            <span className="whitespace-nowrap text-xs font-extrabold tracking-wide text-white sm:text-sm">
              Acceso a Pacientes
            </span>
            {loggedPatientName ? (
              <span className="max-w-[140px] truncate text-[10px] font-semibold text-[#A6CA0E]">
                ● {loggedPatientName}
              </span>
            ) : (
              <span className="hidden text-[10px] font-medium text-white/75 sm:inline">
                Estudios · Recetas · Turnos
              </span>
            )}
          </span>

          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#A6CA0E] text-[#1B335D] transition-transform duration-200 group-hover:translate-x-0.5">
            <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.6]" />
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenProfPortal}
          aria-label="Acceso a Profesionales"
          title="Acceso a Profesionales — Agenda, Historia Clínica y Carga de Estudios"
          className="group flex cursor-pointer items-center gap-2 rounded-full border-2 border-[#57B7B8] bg-[#0099D8] py-1.5 pr-3.5 pl-1.5 text-white shadow-xl shadow-[#0099D8]/35 transition-all duration-200 hover:scale-[1.03] hover:bg-[#0A74A6] active:scale-[0.98]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/50 bg-[#1B335D] text-[#57B7B8]">
            <Stethoscope className="h-4.5 w-4.5" />
          </span>

          <span className="flex flex-col text-left leading-tight">
            <span className="whitespace-nowrap text-xs font-extrabold tracking-wide text-white sm:text-sm">
              Acceso a Profesionales
            </span>
            {loggedProfName ? (
              <span className="max-w-[140px] truncate text-[10px] font-semibold text-[#E8FF99]">
                ● {loggedProfName}
              </span>
            ) : (
              <span className="hidden text-[10px] font-medium text-white/85 sm:inline">
                Turnos · Historia Clínica
              </span>
            )}
          </span>

          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[#1B335D] transition-transform duration-200 group-hover:translate-x-0.5">
            <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.6]" />
          </span>
        </button>
      </aside>

      {/* Botón redondo fijo de WhatsApp (dinámico según CEMEP o CEMEP Plus) */}
      <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-1.5 sm:right-6 sm:bottom-6">
        <span
          className={`hidden rounded-full px-2.5 py-1 text-[11px] font-extrabold shadow-md sm:inline-block ${
            isPlus
              ? "bg-[#009EE3] text-white"
              : "bg-[#1B335D] text-white"
          }`}
        >
          {isPlus ? "WhatsApp CEMEP Plus" : "WhatsApp CEMEP"}
        </span>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Contactar a ${isPlus ? "CEMEP Plus" : "CEMEP"} por WhatsApp (${waDisplay})`}
          title={`${isPlus ? "WhatsApp CEMEP Plus" : "WhatsApp CEMEP"} · ${waDisplay}`}
          className="group flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-[#25D366] text-white shadow-2xl shadow-[#1B335D]/40 transition-all duration-200 hover:scale-[1.07] hover:bg-[#1ebe5d] active:scale-[0.96]"
        >
          <WhatsAppIcon size={28} className="shrink-0 text-white" />
        </a>
      </div>
    </>
  );
}
