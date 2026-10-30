"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CONFIGURATOR_STEP1_ACTIVITIES,
  CONFIGURATOR_STEP2_NEEDS,
  CONFIGURATOR_STEP3_CURRENT_SYSTEM,
  ARGENTINA_PROVINCES,
  buildWhatsAppLink,
} from "@/lib/site-data";
import { SolutionCategory } from "@/types/minisistema";
import { WhatsAppIcon } from "@/components/icons/SocialIcons";
import {
  X,
  Check,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  AlertCircle,
} from "lucide-react";

interface ProjectConfiguratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedCategory: SolutionCategory | null;
  preselectedServiceTitle: string | null;
}

export function ProjectConfiguratorModal({
  isOpen,
  onClose,
  preselectedCategory,
  preselectedServiceTitle,
}: ProjectConfiguratorModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [step, setStep] = useState<number>(1);
  const [activity, setActivity] = useState<string>("");
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);
  const [currentSystem, setCurrentSystem] = useState<string>("");
  const [projectDescription, setProjectDescription] = useState<string>("");

  // Paso 5 — Datos de contacto
  const [fullName, setFullName] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [province, setProvince] = useState<string>("Córdoba");
  const [whatsapp, setWhatsapp] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [privacyConsent, setPrivacyConsent] = useState<boolean>(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissionCode, setSubmissionCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [honeypot, setHoneypot] = useState<string>("");

  // Preselección cuando el usuario abre desde una tarjeta de "Qué desarrollamos" o "Nuestros tres servicios"
  useEffect(() => {
    if (preselectedCategory) {
      setSelectedNeeds(preselectedCategory.defaultNeedPreselect);
    }
  }, [preselectedCategory]);

  // Apertura y cierre mediante <dialog>.showModal() nativo + fallback de closedby="any" (light-dismiss-a-dialog)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      dialog.returnValue = "";
      onClose();
    };

    dialog.addEventListener("close", handleNativeClose);

    // Fallback obligatorio para navegadores sin soporte nativo de closedBy (light-dismiss-a-dialog)
    let removeClickFallback: (() => void) | undefined;
    if (typeof HTMLDialogElement !== "undefined" && !("closedBy" in HTMLDialogElement.prototype)) {
      const onBackdropClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      };
      dialog.addEventListener("click", onBackdropClick);
      removeClickFallback = () => dialog.removeEventListener("click", onBackdropClick);
    }

    return () => {
      dialog.removeEventListener("close", handleNativeClose);
      if (removeClickFallback) removeClickFallback();
    };
  }, [onClose]);

  const toggleNeed = (need: string) => {
    setSelectedNeeds((prev) =>
      prev.includes(need) ? prev.filter((item) => item !== need) : [...prev, need]
    );
  };

  const validateCurrentStep = (): boolean => {
    setErrorMessage(null);
    if (step === 1 && !activity) {
      setErrorMessage("Seleccioná a qué se dedica tu negocio para continuar.");
      return false;
    }
    if (step === 2 && selectedNeeds.length === 0) {
      setErrorMessage("Seleccioná al menos una necesidad o función para tu MiniSistema.");
      return false;
    }
    if (step === 3 && !currentSystem) {
      setErrorMessage("Indicá si actualmente utilizan algún sistema.");
      return false;
    }
    if (step === 4 && projectDescription.trim().length < 10) {
      setErrorMessage("Contanos brevemente qué te gustaría que hiciera tu MiniSistema.");
      return false;
    }
    if (step === 5) {
      if (
        !fullName.trim() ||
        !businessName.trim() ||
        !city.trim() ||
        !province.trim() ||
        !whatsapp.trim() ||
        !email.trim()
      ) {
        setErrorMessage("Por favor completá todos los datos de contacto solicitados.");
        return false;
      }
      if (!privacyConsent) {
        setErrorMessage(
          "Debés aceptar el consentimiento de tratamiento de datos personales para enviar tu proyecto."
        );
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setStep((prev) => Math.min(6, prev + 1));
  };

  const handleBack = () => {
    setErrorMessage(null);
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleFinalSubmit = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "configurador",
          businessActivity: activity,
          selectedNeeds,
          currentSystemStatus: currentSystem,
          projectDescription,
          preselectedCategory: preselectedCategory?.title || null,
          preselectedService: preselectedServiceTitle || null,
          honeypot,
          contact: {
            fullName,
            businessName,
            city,
            province,
            whatsapp,
            email,
            privacyConsent,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.inquiry?.id) {
        setErrorMessage(
          data?.error || "No se pudo registrar la solicitud. Verificá los datos e intentá nuevamente."
        );
        setIsSubmitting(false);
        return;
      }

      setSubmissionCode(data.inquiry.id);
    } catch {
      setErrorMessage("Ocurrió un error de conexión al registrar tu proyecto. Intentá nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setSubmissionCode(null);
    setStep(1);
    onClose();
  };

  const personalizedWhatsAppMessage = submissionCode
    ? [
        `¡Hola MiniSistema! Completé el configurador web (Solicitud *${submissionCode}*).`,
        `• Nombre: ${fullName} (${businessName})`,
        `• Localidad: ${city}, ${province}`,
        `• Actividad: ${activity}`,
        `• Necesidades: ${selectedNeeds.join(", ")}`,
        `• Situación actual: ${currentSystem}`,
        `• Idea del proyecto: ${projectDescription}`,
      ].join("\n")
    : undefined;

  return (
    <dialog
      ref={dialogRef}
      id="configurador-minisistema"
      {...({ closedby: "any" } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      aria-labelledby="configurator-dialog-title"
      className="m-auto w-[calc(100%-1.5rem)] max-w-3xl rounded-3xl border-2 border-[var(--color-menta)] bg-[var(--color-petroleo)] p-0 text-[var(--color-blanco)] shadow-2xl open:flex open:flex-col max-h-[92dvh]"
    >
      {/* Cabecera fija del modal */}
      <div className="flex items-center justify-between border-b border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] px-5 py-4 sm:px-7">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--color-menta)]" />
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-menta)]">
              Configurador Interactivo · Paso {step} de 6
            </span>
          </div>
          <h2
            id="configurator-dialog-title"
            className="mt-0.5 text-lg sm:text-xl font-extrabold text-[var(--color-blanco)]"
          >
            Contanos cómo imaginás tu MiniSistema.
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar configurador de proyectos"
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/5 text-[var(--color-blanco)] transition-colors hover:border-[var(--color-menta)] hover:text-[var(--color-menta)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Barra de progreso de los 6 pasos */}
      <div className="bg-[var(--color-blanco)]/5 px-5 py-2.5 sm:px-7">
        <div className="flex items-center justify-between text-[11px] text-[var(--color-blanco)]/75 mb-1.5">
          <span>
            No necesitás saber de programación. Nosotros te ayudamos a transformar tu idea en una
            solución digital.
          </span>
          <span className="font-bold text-[var(--color-menta)] shrink-0 ml-2">
            {Math.round((step / 6) * 100)}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-blanco)]/10">
          <div
            className="h-full rounded-full bg-[var(--color-menta)] transition-all duration-300"
            style={{ width: `${(step / 6) * 100}%` }}
          />
        </div>
      </div>

      {/* Cuerpo scrollable del modal */}
      <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
        {(preselectedCategory || preselectedServiceTitle) && !submissionCode && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-3.5 py-2 text-xs text-[var(--color-blanco)]">
            <span>
              Interés preseleccionado:{" "}
              <strong className="font-extrabold text-[var(--color-menta)]">
                {preselectedCategory?.title || preselectedServiceTitle}
              </strong>
            </span>
            <span className="text-[11px] text-[var(--color-blanco)]/75">Podés ajustar todas las opciones</span>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 flex items-center gap-2.5 rounded-xl border border-[var(--color-blanco)] bg-[var(--color-blanco)]/10 px-4 py-3 text-xs sm:text-sm font-semibold text-[var(--color-blanco)]"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-[var(--color-menta)]" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* PASO 1 — ¿A qué se dedica tu negocio? */}
        {step === 1 && (
          <div>
            <h3 className="text-lg font-extrabold text-[var(--color-blanco)]">
              PASO 1 — ¿A qué se dedica tu negocio?
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-[var(--color-blanco)]/75">
              Seleccioná la opción que mejor represente tu actividad principal:
            </p>

            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {CONFIGURATOR_STEP1_ACTIVITIES.map((option) => {
                const selected = activity === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setActivity(option);
                      setErrorMessage(null);
                    }}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 text-left text-xs sm:text-sm font-bold transition-all ${
                      selected
                        ? "border-2 border-[var(--color-menta)] bg-[var(--color-menta)] text-[var(--color-petroleo)]"
                        : "border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] text-[var(--color-blanco)] hover:border-[var(--color-menta)]"
                    }`}
                  >
                    <span>{option}</span>
                    {selected && <Check className="h-4 w-4 shrink-0 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* PASO 2 — ¿Qué necesitás? (Selección múltiple) */}
        {step === 2 && (
          <div>
            <h3 className="text-lg font-extrabold text-[var(--color-blanco)]">
              PASO 2 — ¿Qué necesitás?
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-[var(--color-blanco)]/75">
              Podés seleccionar todas las opciones que te gustaría incluir:
            </p>

            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {CONFIGURATOR_STEP2_NEEDS.map((need) => {
                const selected = selectedNeeds.includes(need);
                return (
                  <button
                    key={need}
                    type="button"
                    onClick={() => {
                      toggleNeed(need);
                      setErrorMessage(null);
                    }}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3.5 text-left text-xs sm:text-sm font-bold transition-all ${
                      selected
                        ? "border-2 border-[var(--color-menta)] bg-[var(--color-blanco)]/10 text-[var(--color-blanco)]"
                        : "border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] text-[var(--color-blanco)]/85 hover:border-[var(--color-menta)]"
                    }`}
                  >
                    <span>{need}</span>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        selected
                          ? "border-[var(--color-menta)] bg-[var(--color-menta)] text-[var(--color-petroleo)]"
                          : "border-[var(--color-blanco)]/30"
                      }`}
                    >
                      {selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* PASO 3 — ¿Ya utilizás algún sistema? */}
        {step === 3 && (
          <div>
            <h3 className="text-lg font-extrabold text-[var(--color-blanco)]">
              PASO 3 — ¿Ya utilizás algún sistema?
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-[var(--color-blanco)]/75">
              Contanos desde qué punto partimos:
            </p>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CONFIGURATOR_STEP3_CURRENT_SYSTEM.map((option) => {
                const selected = currentSystem === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setCurrentSystem(option);
                      setErrorMessage(null);
                    }}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 text-left text-sm font-bold transition-all ${
                      selected
                        ? "border-2 border-[var(--color-menta)] bg-[var(--color-menta)] text-[var(--color-petroleo)]"
                        : "border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] text-[var(--color-blanco)] hover:border-[var(--color-menta)]"
                    }`}
                  >
                    <span>{option}</span>
                    {selected && <Check className="h-4 w-4 shrink-0 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* PASO 4 — Contanos tu proyecto */}
        {step === 4 && (
          <div>
            <h3 className="text-lg font-extrabold text-[var(--color-blanco)]">
              PASO 4 — Contanos tu proyecto
            </h3>
            <label
              htmlFor="configurator-project-desc"
              className="mt-2 block text-sm font-bold text-[var(--color-menta)]"
            >
              ¿Qué te gustaría que pudiera hacer tu MiniSistema?
            </label>
            <p id="configurator-desc-help" className="mt-1 text-xs sm:text-sm text-[var(--color-blanco)]/75">
              Contanos cómo trabajás actualmente, qué dificultades encontrás y qué te gustaría
              mejorar.
            </p>

            <textarea
              id="configurator-project-desc"
              rows={5}
              aria-describedby="configurator-desc-help"
              value={projectDescription}
              onChange={(e) => {
                setProjectDescription(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="Ej: Hoy anotamos los pedidos por WhatsApp y en una planilla, y nos gustaría organizar el stock, las cuentas corrientes de clientes y que los vendedores puedan cargar pedidos desde el celular..."
              className="mt-4 w-full rounded-2xl border border-[var(--color-blanco)]/25 bg-[var(--color-blanco)]/[0.04] p-4 text-sm text-[var(--color-blanco)] placeholder:text-[var(--color-blanco)]/40 focus:border-[var(--color-menta)] focus:outline-none"
            />
          </div>
        )}

        {/* PASO 5 — Datos de contacto */}
        {step === 5 && (
          <div>
            <h3 className="text-lg font-extrabold text-[var(--color-blanco)]">
              PASO 5 — Datos de contacto
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-[var(--color-blanco)]/75">
              Dejanos tus datos para analizar tu solicitud y comunicarnos con vos.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-blanco)]">
                  Nombre y apellido *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu nombre y apellido"
                  className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-blanco)]/[0.04] px-3.5 py-2.5 text-sm text-[var(--color-blanco)] focus:border-[var(--color-menta)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-blanco)]">
                  Nombre comercial o institución *
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Nombre de tu negocio u organización"
                  className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-blanco)]/[0.04] px-3.5 py-2.5 text-sm text-[var(--color-blanco)] focus:border-[var(--color-menta)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-blanco)]">
                  Localidad *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ej: Río Cuarto"
                  className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-blanco)]/[0.04] px-3.5 py-2.5 text-sm text-[var(--color-blanco)] focus:border-[var(--color-menta)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-blanco)]">
                  Provincia *
                </label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3.5 py-2.5 text-sm text-[var(--color-blanco)] focus:border-[var(--color-menta)] focus:outline-none"
                >
                  {ARGENTINA_PROVINCES.map((prov) => (
                    <option key={prov} value={prov}>
                      {prov}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-blanco)]">
                  Número de WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ej: +54 9 358 ..."
                  className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-blanco)]/[0.04] px-3.5 py-2.5 text-sm text-[var(--color-blanco)] focus:border-[var(--color-menta)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-blanco)]">
                  Correo electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vos@tunegocio.com.ar"
                  className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-blanco)]/[0.04] px-3.5 py-2.5 text-sm text-[var(--color-blanco)] focus:border-[var(--color-menta)] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-3.5">
              <input
                id="configurator-privacy-consent"
                type="checkbox"
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-menta)]"
              />
              <label
                htmlFor="configurator-privacy-consent"
                className="text-xs leading-relaxed text-[var(--color-blanco)]/85"
              >
                Presto mi consentimiento para el tratamiento de mis datos personales con la
                finalidad de analizar mi solicitud comercial y contactarme, de acuerdo con la{" "}
                <Link
                  href="/privacidad"
                  onClick={onClose}
                  className="font-bold text-[var(--color-menta)] underline"
                >
                  Política de Privacidad
                </Link>
                .
              </label>
            </div>
          </div>
        )}

        {/* PASO 6 — CONFIRMACIÓN Y ENVÍO */}
        {step === 6 && !submissionCode && (
          <div>
            <h3 className="text-lg font-extrabold text-[var(--color-blanco)]">
              PASO 6 — Revisá y confirmá tu solicitud
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-[var(--color-blanco)]/75">
              Verificá que el resumen de tu proyecto esté completo antes de enviarlo:
            </p>

            <div className="mt-4 space-y-3 rounded-2xl border border-[var(--color-menta)] bg-[var(--color-blanco)]/[0.03] p-4 sm:p-5 text-xs sm:text-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-[var(--color-menta)] font-bold">Actividad:</span>{" "}
                  <span>{activity}</span>
                </div>
                <div>
                  <span className="text-[var(--color-menta)] font-bold">Situación actual:</span>{" "}
                  <span>{currentSystem}</span>
                </div>
                <div>
                  <span className="text-[var(--color-menta)] font-bold">Contacto:</span>{" "}
                  <span>
                    {fullName} ({businessName})
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-menta)] font-bold">Ubicación:</span>{" "}
                  <span>
                    {city}, {province}
                  </span>
                </div>
              </div>

              <div className="border-t border-[var(--color-blanco)]/10 pt-2.5">
                <span className="text-[var(--color-menta)] font-bold">Necesidades seleccionadas:</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {selectedNeeds.map((n) => (
                    <span
                      key={n}
                      className="rounded-lg border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-menta)]"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-[var(--color-blanco)]/10 pt-2.5">
                <span className="text-[var(--color-menta)] font-bold">Descripción del proyecto:</span>
                <p className="mt-1 text-[var(--color-blanco)]/85 whitespace-pre-line">{projectDescription}</p>
              </div>
            </div>

            <div className="mt-5">
              {/* Campo honeypot anti-spam invisible para usuarios reales */}
              <input
                type="text"
                name="website_url"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className="sr-only"
                aria-hidden="true"
              />
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--color-menta)] px-6 py-4 text-sm sm:text-base font-extrabold tracking-wide text-[var(--color-petroleo)] shadow-xl transition-all hover:bg-[var(--color-blanco)] disabled:opacity-60"
              >
                <CheckCircle2 className="h-5 w-5 stroke-[2.5]" />
                <span>{isSubmitting ? "REGISTRANDO SOLICITUD..." : "ENVIAR MI PROYECTO"}</span>
              </button>
            </div>
          </div>
        )}

        {/* PANTALLA DE CONFIRMACIÓN TRAS ENVIAR */}
        {step === 6 && submissionCode && (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-menta)] text-[var(--color-petroleo)]">
              <CheckCircle2 className="h-9 w-9 stroke-[2.5]" />
            </div>

            <span className="mt-4 inline-block rounded-full border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-4 py-1 text-xs font-extrabold text-[var(--color-menta)]">
              Identificador de solicitud: {submissionCode}
            </span>

            <h3 className="mt-3 text-2xl font-extrabold text-[var(--color-blanco)]">
              ¡Tu proyecto fue registrado con éxito!
            </h3>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[var(--color-blanco)]/85">
              Ya registramos los datos de tu consulta para analizar tu necesidad y preparar una
              propuesta personalizada. Si querés conversar ahora mismo, podés enviarnos el resumen
              directo a nuestro WhatsApp comercial.
            </p>

            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={buildWhatsAppLink(personalizedWhatsAppMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-2xl bg-[var(--color-menta)] px-6 py-4 text-sm font-extrabold text-[var(--color-petroleo)] shadow-lg transition-all hover:bg-[var(--color-blanco)]"
              >
                <WhatsAppIcon size={20} />
                <span>CONTINUAR POR WHATSAPP</span>
              </a>

              <button
                type="button"
                onClick={resetAndClose}
                className="w-full sm:w-auto cursor-pointer rounded-2xl border border-[var(--color-blanco)]/25 px-6 py-4 text-sm font-bold text-[var(--color-blanco)] transition-colors hover:border-[var(--color-menta)]"
              >
                Volver al sitio
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pie de navegación del modal (Pasos 1 a 6 antes de enviar) */}
      {!submissionCode && (
        <div className="flex items-center justify-between border-t border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] px-5 py-4 sm:px-7">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--color-blanco)]/20 px-4 py-2.5 text-xs sm:text-sm font-bold text-[var(--color-blanco)] transition-colors hover:border-[var(--color-menta)]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Anterior</span>
            </button>
          ) : (
            <span className="text-xs text-[var(--color-blanco)]/60">Primera consulta sin compromiso</span>
          )}

          {step < 6 && (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-menta)] px-5 py-2.5 text-xs sm:text-sm font-extrabold text-[var(--color-petroleo)] transition-colors hover:bg-[var(--color-blanco)]"
            >
              <span>Siguiente paso</span>
              <ArrowRight className="h-4 w-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      )}
    </dialog>
  );
}
