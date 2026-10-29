"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { INITIAL_SITE_CONFIG, buildWhatsAppLink } from "@/lib/site-data";
import { WhatsAppIcon, InstagramIcon, FacebookIcon } from "@/components/icons/SocialIcons";
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
      className="relative border-t border-[#FFFFFF]/10 bg-[#112D3A] py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Columna Izquierda: Canales Oficiales */}
          <div className="lg:col-span-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#56D7A1]/35 bg-[#56D7A1]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#56D7A1]">
              <span>Contacto y redes sociales</span>
            </span>

            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#FFFFFF] sm:text-4xl">
              Estamos listos para <span className="text-[#56D7A1]">escucharte</span>.
            </h2>

            <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#FFFFFF]/80">
              Elegí el canal que te quede más cómodo o utilizá nuestro configurador interactivo para
              contarnos cómo imaginás tu MiniSistema.
            </p>

            {/* Tarjetas de canales oficiales */}
            <div className="mt-8 space-y-4">
              {/* WhatsApp Comercial */}
              <a
                href={buildWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between rounded-2xl border-2 border-[#56D7A1]/50 bg-[#56D7A1]/10 p-5 transition-all hover:border-[#56D7A1] hover:bg-[#56D7A1]/20"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#56D7A1] text-[#112D3A]">
                    <WhatsAppIcon size={24} />
                  </div>
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-[#56D7A1]">
                      WhatsApp Comercial Oficial
                    </span>
                    <span className="mt-0.5 block text-lg font-extrabold text-[#FFFFFF]">
                      {INITIAL_SITE_CONFIG.whatsappDisplay}
                    </span>
                    <span className="text-xs text-[#FFFFFF]/75">
                      Atención directa y personalizada
                    </span>
                  </div>
                </div>
                <ArrowUpRight className="h-5 w-5 text-[#56D7A1] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>

              {/* Redes Sociales Oficiales (Instagram + Facebook) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <a
                  href={INITIAL_SITE_CONFIG.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/[0.03] p-4 transition-all hover:border-[#56D7A1] hover:bg-[#FFFFFF]/[0.06]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#56D7A1]/35 bg-[#56D7A1]/15 text-[#56D7A1]">
                      <InstagramIcon size={20} />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-[#FFFFFF]">Instagram</span>
                      <span className="text-xs text-[#56D7A1]">@mini.sistema</span>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-[#56D7A1]" />
                </a>

                <a
                  href={INITIAL_SITE_CONFIG.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/[0.03] p-4 transition-all hover:border-[#56D7A1] hover:bg-[#FFFFFF]/[0.06]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#56D7A1]/35 bg-[#56D7A1]/15 text-[#56D7A1]">
                      <FacebookIcon size={20} />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-[#FFFFFF]">Facebook</span>
                      <span className="text-xs text-[#56D7A1]">/mini.sistema</span>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-[#56D7A1]" />
                </a>
              </div>

              {/* Acceso al Configurador Comercial */}
              <div className="rounded-2xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/[0.03] p-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#56D7A1]">
                  <Sliders className="h-4 w-4" />
                  <span>¿Preferís describir tu proyecto paso a paso?</span>
                </div>
                <p className="mt-1.5 text-xs sm:text-sm text-[#FFFFFF]/80">
                  Usá nuestro configurador interactivo para elegir tu rubro y las funciones que te
                  gustaría incluir.
                </p>
                <button
                  type="button"
                  onClick={onOpenConfigurator}
                  className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#56D7A1] px-4 py-2.5 text-xs font-extrabold text-[#112D3A] transition-colors hover:bg-[#FFFFFF]"
                >
                  <span>ABRIR CONFIGURADOR DE PROYECTOS</span>
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Formulario de Contacto Directo */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/[0.03] p-6 sm:p-8">
              <h3 className="text-xl sm:text-2xl font-extrabold text-[#FFFFFF]">
                Envianos tu consulta
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-[#FFFFFF]/75">
                Completá el formulario y te responderemos a la brevedad.
              </p>

              {submittedId ? (
                <div className="mt-6 rounded-2xl border-2 border-[#56D7A1] bg-[#56D7A1]/10 p-6 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-[#56D7A1]" />
                  <h4 className="mt-3 text-xl font-extrabold text-[#FFFFFF]">
                    ¡Recibimos tu consulta ({submittedId})!
                  </h4>
                  <p className="mt-2 text-sm text-[#FFFFFF]/85">
                    Tus datos quedaron registrados correctamente. Si querés agilizar la conversación
                    ahora mismo, podés continuar por WhatsApp con tu mensaje ya preparado.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <a
                      href={buildWhatsAppLink(customWhatsAppText)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#56D7A1] px-6 py-3.5 text-sm font-extrabold text-[#112D3A] transition-colors hover:bg-[#FFFFFF]"
                    >
                      <WhatsAppIcon size={18} />
                      <span>Continuar en WhatsApp</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setSubmittedId(null);
                        setMessage("");
                      }}
                      className="rounded-xl border border-[#FFFFFF]/25 px-5 py-3.5 text-xs font-bold text-[#FFFFFF] hover:border-[#56D7A1]"
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
                        className="block text-xs font-bold uppercase tracking-wider text-[#FFFFFF]"
                      >
                        Nombre y apellido *
                      </label>
                      <span
                        id="contact-name-hint"
                        className="mt-0.5 mb-1.5 block text-[11px] text-[#FFFFFF]/65"
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
                        className="ms-input w-full rounded-xl border border-[#FFFFFF]/20 bg-[#112D3A] px-4 py-3 text-sm text-[#FFFFFF] placeholder:text-[#FFFFFF]/40 focus:border-[#56D7A1] focus:outline-none"
                      />
                      <div className="ms-error-msg mt-1.5 hidden items-center gap-1.5 text-xs font-semibold text-[#56D7A1]">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Por favor ingresá tu nombre y apellido.</span>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="contact-business"
                        className="block text-xs font-bold uppercase tracking-wider text-[#FFFFFF]"
                      >
                        Comercio, empresa o institución
                      </label>
                      <span
                        id="contact-business-hint"
                        className="mt-0.5 mb-1.5 block text-[11px] text-[#FFFFFF]/65"
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
                        className="ms-input w-full rounded-xl border border-[#FFFFFF]/20 bg-[#112D3A] px-4 py-3 text-sm text-[#FFFFFF] placeholder:text-[#FFFFFF]/40 focus:border-[#56D7A1] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="contact-whatsapp"
                        className="block text-xs font-bold uppercase tracking-wider text-[#FFFFFF]"
                      >
                        Número de WhatsApp *
                      </label>
                      <span
                        id="contact-wa-hint"
                        className="mt-0.5 mb-1.5 block text-[11px] text-[#FFFFFF]/65"
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
                        className="ms-input w-full rounded-xl border border-[#FFFFFF]/20 bg-[#112D3A] px-4 py-3 text-sm text-[#FFFFFF] placeholder:text-[#FFFFFF]/40 focus:border-[#56D7A1] focus:outline-none"
                      />
                      <div className="ms-error-msg mt-1.5 hidden items-center gap-1.5 text-xs font-semibold text-[#56D7A1]">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Ingresá un número de WhatsApp de contacto.</span>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="contact-email"
                        className="block text-xs font-bold uppercase tracking-wider text-[#FFFFFF]"
                      >
                        Correo electrónico *
                      </label>
                      <span
                        id="contact-email-hint"
                        className="mt-0.5 mb-1.5 block text-[11px] text-[#FFFFFF]/65"
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
                        className="ms-input w-full rounded-xl border border-[#FFFFFF]/20 bg-[#112D3A] px-4 py-3 text-sm text-[#FFFFFF] placeholder:text-[#FFFFFF]/40 focus:border-[#56D7A1] focus:outline-none"
                      />
                      <div className="ms-error-msg mt-1.5 hidden items-center gap-1.5 text-xs font-semibold text-[#56D7A1]">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Ingresá una dirección de correo válida.</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="contact-message"
                      className="block text-xs font-bold uppercase tracking-wider text-[#FFFFFF]"
                    >
                      ¿En qué podemos ayudarte? *
                    </label>
                    <span
                      id="contact-msg-hint"
                      className="mt-0.5 mb-1.5 block text-[11px] text-[#FFFFFF]/65"
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
                      className="ms-input w-full rounded-xl border border-[#FFFFFF]/20 bg-[#112D3A] px-4 py-3 text-sm text-[#FFFFFF] placeholder:text-[#FFFFFF]/40 focus:border-[#56D7A1] focus:outline-none"
                    />
                    <div className="ms-error-msg mt-1.5 hidden items-center gap-1.5 text-xs font-semibold text-[#56D7A1]">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>Por favor escribí tu consulta.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 pt-1">
                    <input
                      id="contact-consent"
                      type="checkbox"
                      required
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#56D7A1]"
                    />
                    <label
                      htmlFor="contact-consent"
                      className="text-xs leading-relaxed text-[#FFFFFF]/80"
                    >
                      Acepto el tratamiento de mis datos personales para que MiniSistema se ponga en
                      contacto conmigo en relación con esta consulta comercial, conforme a la{" "}
                      <Link
                        href="/privacidad"
                        className="font-semibold text-[#56D7A1] underline underline-offset-2"
                      >
                        Política de Privacidad
                      </Link>
                      .
                    </label>
                  </div>

                  {submitError && (
                    <div
                      role="alert"
                      className="flex items-center gap-2 rounded-xl border border-[#FFFFFF] bg-[#FFFFFF]/10 px-4 py-3 text-xs font-semibold text-[#FFFFFF]"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 text-[#56D7A1]" />
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
                    className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#56D7A1] px-6 py-4 text-sm font-extrabold tracking-wide text-[#112D3A] transition-all hover:bg-[#FFFFFF] disabled:opacity-60"
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
