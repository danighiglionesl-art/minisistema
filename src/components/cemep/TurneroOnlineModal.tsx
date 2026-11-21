"use client";

import React, { useEffect, useRef } from "react";
import { Calendar, MessageCircle, X } from "lucide-react";
import PublicTurnosPortal from "@/components/turnos/PublicTurnosPortal";

interface TurneroOnlineModalProps {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  whatsappHref: string;
  whatsappDisplay: string;
}

export function TurneroOnlineModal({
  open,
  onClose,
  tenantSlug,
  whatsappHref,
  whatsappDisplay,
}: TurneroOnlineModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;

    if (open) {
      if (!dlg.open) {
        dlg.showModal();
      }
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    } else if (dlg.open) {
      dlg.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={open ? "turnero-modal-title" : undefined}
      aria-label={open ? undefined : "Turnero Web Online CEMEP"}
      {...({ closedby: "any" } as Record<string, string>)}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        // Fallback light-dismiss cuando se hace clic en el backdrop fuera del panel
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
      className="m-auto max-h-[92vh] w-[calc(100vw-1.25rem)] max-w-5xl overflow-hidden rounded-3xl border-0 bg-transparent p-0 text-[#1B335D] shadow-2xl sm:w-[calc(100vw-2.5rem)]"
    >
      {open && (
        <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-3xl bg-[#FFFFFF]">
          {/* Encabezado institucional CEMEP */}
          <div
            className="flex items-center justify-between gap-4 px-5 py-4 text-[#FFFFFF] sm:px-7"
            style={{
              background: "linear-gradient(135deg, #1B335D 0%, #0A74A6 65%, #0099D8 100%)",
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFFFFF]/15">
                <Calendar className="h-5 w-5 text-[#A6CA0E]" />
              </span>
              <div className="min-w-0">
                <h2
                  id="turnero-modal-title"
                  className="truncate text-lg font-black tracking-tight sm:text-xl"
                >
                  Turnero Web Online · CEMEP
                </h2>
                <p className="text-xs text-[#FFFFFF]/85">
                  Elegí especialidad, profesional, día y horario disponible las 24 hs.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {whatsappDisplay && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden items-center gap-1.5 rounded-xl bg-[#FFFFFF]/15 px-3 py-2 text-xs font-bold text-[#FFFFFF] transition hover:bg-[#FFFFFF]/25 sm:inline-flex"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-[#A6CA0E]" />
                  <span>{whatsappDisplay}</span>
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar Turnero Online"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-[#FFFFFF]/15 text-[#FFFFFF] transition hover:bg-[#FFFFFF]/25"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Contenido scrollable del Turnero Web */}
          <div className="flex-1 overflow-y-auto overscroll-contain bg-[#F7FBFD] p-4 sm:p-6">
            <PublicTurnosPortal
              tenantSlug={tenantSlug}
              fantasyName="CEMEP · Centro Médico Paulucci"
              primaryHex="#1B335D"
              accentHex="#57B7B8"
              logoHorizontalUrl="/cemep/cemep-logo-horizontal.png"
              logoSymbolUrl="/cemep/cemep-logo-horizontal.png"
            />
          </div>
        </div>
      )}
    </dialog>
  );
}
