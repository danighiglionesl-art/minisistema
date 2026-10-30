"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { INITIAL_SITE_CONFIG, buildWhatsAppLink } from "@/lib/site-data";
import { WhatsAppIcon, InstagramIcon, FacebookIcon } from "@/components/icons/SocialIcons";
import { BrandWordmark, InverseDot } from "@/components/brand/BrandWordmark";
import { HumanVerificationCheck } from "@/components/ui/HumanVerificationCheck";
import { Send, CheckCircle2, ArrowUpRight, AlertCircle, Sliders } from "lucide-react";

interface ContactSectionProps {
  onOpenConfigurator: () => void;
}

export function ContactSection({ onOpenConfigurator }: ContactSectionProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");

  // Sincronización de aria-invalid y fallback WeakMap (validate-input-after-interaction)
  useEffect(() => {
    const root = formRef.current;
    if (!root) return;

    const dirtyState = new WeakMap<Element, { hasInteracted: boolean; hasBlurred: boolean }>();
    const supportsUserInvalid =
      typeof CSS !== "undefined" && CSS.supports("selector(:user-invalid)");

    const syncAria = (el: Element) => {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
      if (supportsUserInvalid) {
        el.setAttribute("aria-invalid", el.matches(":user-invalid") ? "true" : "false");
      } else {
        const isValid = el.checkValidity();
        el.classList.toggle("user-invalid-fallback", !isValid);
        el.classList.toggle("user-valid-fallback", isValid);
        el.setAttribute("aria-invalid", !isValid ? "true" : "false");
      }
    };

    const onBlur = (e: Event) => {
      const target = e.target as Element;
      if (!target) return;
      const state = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
      state.hasBlurred = true;
      dirtyState.set(target, state);
      if (state.hasInteracted || supportsUserInvalid) {
        syncAria(target);
      }
    };

    const onInput = (e: Event) => {
      const target = e.target as Element;
      if (!target) return;
      const state = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
      state.hasInteracted = true;
      dirtyState.set(target, state);
      if (state.hasBlurred || target.hasAttribute("aria-invalid")) {
        syncAria(target);
      }
    };

    root.addEventListener("blur", onBlur, true);
    root.addEventListener("input", onInput);
    return () => {
      root.removeEventListener("blur", onBlur, true);
      root.removeEventListener("input", onInput);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !whatsapp.trim() || !message.trim() || !consent) return;
    if (!captchaVerified || !captchaToken) {
      setSubmitError("Por favor tildá la casilla 'No soy un robot' para confirmar el envío.");
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "contacto",
          businessActivity: "Consulta de contacto directo",
          selectedNeeds: ["Consulta general"],
          currentSystemStatus: "No especificado",
          projectDescription: message,
          honeypot,
          captchaToken,
          contact: {
            fullName,
            businessName: businessName || "Consulta particular",
            city: "Argentina",
            province: "Argentina",
            whatsapp,
            email,
            privacyConsent: consent,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.inquiry?.id) {
        setSubmitError(data?.error || "No se pudo registrar la consulta.");
        setIsSubmitting(false);
        return;
      }
      setSubmittedId(data.inquiry.id);
    } catch {
      setSubmitError("Error de conexión al enviar tu consulta. Intentá nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const customWhatsAppText = submittedId
    ? `¡Hola! Soy ${fullName}${businessName ? ` (${businessName})` : ""}. Envié la consulta ${submittedId} desde la web de MiniSistema: "${message}".`
    : undefined;

  return (
    <section
      id="contacto"
      className="relative border-t border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Columna Izquierda: Canales Oficiales */}
          <div className="lg:col-span-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
              <span>Contacto y redes sociales</span>
            </span>

            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[var(--color-blanco)] sm:text-4xl">
              Estamos listos para{" "}
              <span className="text-[var(--color-menta)]">
                escucharte
                <InverseDot fromColor="menta" />
              </span>
            </h2>

            <p className="mt-4 text-sm sm:text-base leading-relaxed text-[var(--color-blanco)]/80">
              Elegí el canal que te quede más cómodo o utilizá nuestro configurador interactivo para
              contarnos cómo imaginás tu <BrandWordmark className="mx-0.5" />
            </p>

            {/* Recurso visual tecnológico de cierre: Confianza, Cercanía, Innovación y Acompañamiento */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--color-menta)]/35 bg-[var(--color-blanco)]/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {["Confianza", "Cercanía", "Profesionalismo", "Innovación", "Acompañamiento"].map(
                    (val) => (
                      <span
                        key={val}
                        className="rounded-md border border-[var(--color-menta)]/40 bg-[var(--color-petroleo)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-menta)]"
                      >
                        {val}
                      </span>
                    )
                  )}
                </div>
              </div>
              <svg
                viewBox="0 0 340 54"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                className="mt-3 w-full h-auto"
              >
                <rect x="6" y="10" width="90" height="34" rx="8" fill="#FFFFFF" fillOpacity="0.06" stroke="#FFFFFF" strokeOpacity="0.25" />
                <text x="20" y="31" fill="#FFFFFF" fontSize="10" fontWeight="700">Tu Negocio</text>

                <path d="M98 27 H124" stroke="#56D7A1" strokeWidth="2" strokeDasharray="3 3" />

                <rect x="126" y="6" width="92" height="42" rx="10" fill="#56D7A1" fillOpacity="0.18" stroke="#56D7A1" strokeWidth="1.5" />
                <text x="140" y="25" fill="#56D7A1" fontSize="9.5" fontWeight="800">DIÁLOGO Y</text>
                <text x="139" y="38" fill="#FFFFFF" fontSize="9.5" fontWeight="700">PROPUESTA</text>

                <path d="M220 27 H240" stroke="#56D7A1" strokeWidth="2" />

                <rect x="242" y="8" width="92" height="38" rx="8" fill="#112D3A" stroke="#56D7A1" strokeWidth="2" />
                <image
                  href="/brand/logotipo-minisistema.png"
                  x="249"
                  y="19"
                  width="78"
                  height="16"
                  preserveAspectRatio="xMidYMid meet"
                />
              </svg>
            </div>

            {/* Tarjetas de canales oficiales */}
            <div className="mt-8 space-y-4">
              {/* WhatsApp Comercial */}
              <a
                href={buildWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between rounded-2xl border-2 border-[var(--color-menta)] bg-[var(--color-blanco)]/5 p-5 transition-all hover:border-[var(--color-menta)] hover:bg-[var(--color-blanco)]/10"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-menta)] text-[var(--color-petroleo)]">
                    <WhatsAppIcon size={24} />
                  </div>
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
                      WhatsApp Comercial Oficial
                    </span>
                    <span className="mt-0.5 block text-lg font-extrabold text-[var(--color-blanco)]">
                      {INITIAL_SITE_CONFIG.whatsappDisplay}
                    </span>
                    <span className="text-xs text-[var(--color-blanco)]/75">
                      Atención directa y personalizada
                    </span>
                  </div>
                </div>
                <ArrowUpRight className="h-5 w-5 text-[var(--color-menta)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>

              {/* Redes Sociales Oficiales (Instagram + Facebook) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <a
                  href={INITIAL_SITE_CONFIG.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-4 transition-all hover:border-[var(--color-menta)] hover:bg-[var(--color-blanco)]/[0.06]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 text-[var(--color-menta)]">
                      <InstagramIcon size={20} />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-[var(--color-blanco)]">Instagram</span>
                      <span className="text-xs text-[var(--color-menta)]">@mini.sistema</span>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-[var(--color-menta)]" />
                </a>

                <a
                  href={INITIAL_SITE_CONFIG.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-4 transition-all hover:border-[var(--color-menta)] hover:bg-[var(--color-blanco)]/[0.06]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 text-[var(--color-menta)]">
                      <FacebookIcon size={20} />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-[var(--color-blanco)]">Facebook</span>
                      <span className="text-xs text-[var(--color-menta)]">/mini.sistema</span>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-[var(--color-menta)]" />
                </a>
              </div>

              {/* Acceso al Configurador Comercial */}
              <div className="rounded-2xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
                  <Sliders className="h-4 w-4" />
                  <span>¿Preferís describir tu proyecto paso a paso?</span>
                </div>
                <p className="mt-1.5 text-xs sm:text-sm text-[var(--color-blanco)]/80">
                  Usá nuestro configurador interactivo para elegir tu rubro y las funciones que te
                  gustaría incluir
                  <InverseDot fromColor="blanco" />
                </p>
                <button
                  type="button"
                  onClick={onOpenConfigurator}
                  className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-menta)] px-4 py-2.5 text-xs font-extrabold text-[var(--color-petroleo)] transition-colors hover:bg-[var(--color-blanco)]"
                >
                  <span>ABRIR CONFIGURADOR DE PROYECTOS</span>
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Formulario de Contacto Directo */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-6 sm:p-8">
              <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--color-blanco)]">
                Envianos tu consulta
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-[var(--color-blanco)]/75">
                Completá el formulario y te responderemos a la brevedad
                <InverseDot fromColor="blanco" />
              </p>

              {submittedId ? (
                <div className="mt-6 rounded-2xl border-2 border-[var(--color-menta)] bg-[var(--color-blanco)]/5 p-6 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--color-menta)]" />
                  <h4 className="mt-3 text-xl font-extrabold text-[var(--color-blanco)]">
                    ¡Recibimos tu consulta ({submittedId})!
                  </h4>
                  <p className="mt-2 text-sm text-[var(--color-blanco)]/85">
                    Tus datos quedaron registrados correctamente
                    <InverseDot fromColor="blanco" /> Nos pondremos en contacto con vos a la
                    brevedad
                    <InverseDot fromColor="blanco" />
                  </p>
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSubmittedId(null);
                        setMessage("");
                        setCaptchaVerified(false);
                        setCaptchaToken("");
                      }}
                      className="cursor-pointer rounded-xl bg-[var(--color-menta)] px-6 py-3.5 text-xs font-extrabold text-[var(--color-petroleo)] transition-colors hover:bg-[var(--color-blanco)]"
                    >
                      Enviar otra consulta
                    </button>
                  </div>
                </div>
              ) : (
                <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="contact-name"
                        className="block text-xs font-bold uppercase tracking-wider text-[var(--color-blanco)]"
                      >
                        Nombre y apellido *
                      </label>
                      <span
                        id="contact-name-hint"
                        className="mt-0.5 mb-1.5 block text-[11px] text-[var(--color-blanco)]/65"
                      >
                        Cómo te llamás
                      </span>
                      <input
                        id="contact-name"
                        name="fullName"
                        type="text"
                        required
                        autoComplete="name"
                        aria-describedby="contact-name-hint"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ej: Martín Gómez"
                        className="ms-input w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-4 py-3 text-sm text-[var(--color-blanco)] placeholder:text-[var(--color-blanco)]/40 focus:border-[var(--color-menta)] focus:outline-none"
                      />
                      <div className="ms-error-msg mt-1.5 hidden items-center gap-1.5 text-xs font-semibold text-[var(--color-menta)]">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Por favor ingresá tu nombre y apellido
                          <InverseDot fromColor="menta" />
                        </span>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="contact-business"
                        className="block text-xs font-bold uppercase tracking-wider text-[var(--color-blanco)]"
                      >
                        Comercio, empresa o institución
                      </label>
                      <span
                        id="contact-business-hint"
                        className="mt-0.5 mb-1.5 block text-[11px] text-[var(--color-blanco)]/65"
                      >
                        Opcional si es un emprendimiento nuevo
                      </span>
                      <input
                        id="contact-business"
                        name="businessName"
                        type="text"
                        autoComplete="organization"
                        aria-describedby="contact-business-hint"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Ej: Distribuidora del Sur"
                        className="ms-input w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-4 py-3 text-sm text-[var(--color-blanco)] placeholder:text-[var(--color-blanco)]/40 focus:border-[var(--color-menta)] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="contact-whatsapp"
                        className="block text-xs font-bold uppercase tracking-wider text-[var(--color-blanco)]"
                      >
                        Número de WhatsApp *
                      </label>
                      <span
                        id="contact-wa-hint"
                        className="mt-0.5 mb-1.5 block text-[11px] text-[var(--color-blanco)]/65"
                      >
                        Con característica (ej: 358 5095475)
                      </span>
                      <input
                        id="contact-whatsapp"
                        name="whatsapp"
                        type="tel"
                        required
                        autoComplete="tel"
                        aria-describedby="contact-wa-hint"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="Ej: +54 9 358 ..."
                        className="ms-input w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-4 py-3 text-sm text-[var(--color-blanco)] placeholder:text-[var(--color-blanco)]/40 focus:border-[var(--color-menta)] focus:outline-none"
                      />
                      <div className="ms-error-msg mt-1.5 hidden items-center gap-1.5 text-xs font-semibold text-[var(--color-menta)]">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Ingresá un número de WhatsApp de contacto
                          <InverseDot fromColor="menta" />
                        </span>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="contact-email"
                        className="block text-xs font-bold uppercase tracking-wider text-[var(--color-blanco)]"
                      >
                        Correo electrónico *
                      </label>
                      <span
                        id="contact-email-hint"
                        className="mt-0.5 mb-1.5 block text-[11px] text-[var(--color-blanco)]/65"
                      >
                        Formato: nombre@dominio.com
                      </span>
                      <input
                        id="contact-email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        aria-describedby="contact-email-hint"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vos@tunegocio.com.ar"
                        className="ms-input w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-4 py-3 text-sm text-[var(--color-blanco)] placeholder:text-[var(--color-blanco)]/40 focus:border-[var(--color-menta)] focus:outline-none"
                      />
                      <div className="ms-error-msg mt-1.5 hidden items-center gap-1.5 text-xs font-semibold text-[var(--color-menta)]">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Ingresá una dirección de correo válida
                          <InverseDot fromColor="menta" />
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="contact-message"
                      className="block text-xs font-bold uppercase tracking-wider text-[var(--color-blanco)]"
                    >
                      ¿En qué podemos ayudarte? *
                    </label>
                    <span
                      id="contact-msg-hint"
                      className="mt-0.5 mb-1.5 block text-[11px] text-[var(--color-blanco)]/65"
                    >
                      Contanos brevemente tu consulta o necesidad
                    </span>
                    <textarea
                      id="contact-message"
                      name="message"
                      rows={4}
                      required
                      aria-describedby="contact-msg-hint"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Hola, me gustaría consultar por un sistema a medida para..."
                      className="ms-input w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-4 py-3 text-sm text-[var(--color-blanco)] placeholder:text-[var(--color-blanco)]/40 focus:border-[var(--color-menta)] focus:outline-none"
                    />
                    <div className="ms-error-msg mt-1.5 hidden items-center gap-1.5 text-xs font-semibold text-[var(--color-menta)]">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Por favor escribí tu consulta
                        <InverseDot fromColor="menta" />
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 pt-1">
                    <input
                      id="contact-consent"
                      type="checkbox"
                      required
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-menta)]"
                    />
                    <label
                      htmlFor="contact-consent"
                      className="text-xs leading-relaxed text-[var(--color-blanco)]/80"
                    >
                      Acepto el tratamiento de mis datos personales para que{" "}
                      <BrandWordmark className="mx-0.5" /> se ponga en contacto conmigo en relación
                      con esta consulta comercial, conforme a la{" "}
                      <Link
                        href="/privacidad"
                        className="font-semibold text-[var(--color-menta)] underline underline-offset-2"
                      >
                        Política de Privacidad
                      </Link>
                      <InverseDot fromColor="blanco" />
                    </label>
                  </div>

                  <HumanVerificationCheck
                    id="contact-human-captcha"
                    verified={captchaVerified}
                    onChange={(isVerified, token) => {
                      setCaptchaVerified(isVerified);
                      setCaptchaToken(token);
                      if (isVerified) setSubmitError(null);
                    }}
                  />

                  {submitError && (
                    <div
                      role="alert"
                      className="flex items-center gap-2 rounded-xl border border-[var(--color-blanco)] bg-[var(--color-blanco)]/10 px-4 py-3 text-xs font-semibold text-[var(--color-blanco)]"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 text-[var(--color-menta)]" />
                      <span>{submitError}</span>
                    </div>
                  )}

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
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--color-menta)] px-6 py-4 text-sm font-extrabold tracking-wide text-[var(--color-petroleo)] transition-all hover:bg-[var(--color-blanco)] disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    <span>{isSubmitting ? "ENVIANDO CONSULTA..." : "ENVIAR CONSULTA"}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
