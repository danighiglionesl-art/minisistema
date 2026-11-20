"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Award,
  BadgePercent,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  HeartPulse,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import { InstagramIcon } from "@/components/icons/SocialIcons";
import PublicTurnosPortal from "@/components/turnos/PublicTurnosPortal";
import type { CemepWebContentConfig } from "@/lib/erp/consultorios-types";
import { CemepFloatingControls } from "./CemepFloatingControls";
import { type CemepSectionTab, MercadoPagoTabs } from "./MercadoPagoTabs";
import { type PatientBundleData, PatientPortalModal } from "./PatientPortalModal";
import { type ProfBundleData, ProfessionalPortalModal } from "./ProfessionalPortalModal";

interface CemepPublicPortalProps {
  tenantSlug: string;
  initialContent: CemepWebContentConfig;
  googleClientId: string;
  initialTab?: CemepSectionTab;
}

export function CemepPublicPortal({
  tenantSlug,
  initialContent,
  googleClientId,
  initialTab = "cemep",
}: CemepPublicPortalProps) {
  const [activeTab, setActiveTab] = useState<CemepSectionTab>(initialTab);
  const [content] = useState<CemepWebContentConfig>(initialContent);

  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [profModalOpen, setProfModalOpen] = useState(false);
  const [patientBundle, setPatientBundle] = useState<PatientBundleData | null>(null);
  const [profBundle, setProfBundle] = useState<ProfBundleData | null>(null);

  const isPlus = activeTab === "cemep_plus";

  // Restaurar sesiones activas si existen
  useEffect(() => {
    const base = `/api/cemep?tenant=${encodeURIComponent(tenantSlug)}`;
    fetch(`${base}&action=patient_me`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d.authenticated && d.user) {
          setPatientBundle({
            user: d.user,
            turnos: d.turnos || [],
            estudios: d.estudios || [],
            recetas: d.recetas || [],
            resumenClinico: d.resumenClinico || null,
          });
        }
      })
      .catch(() => {});

    fetch(`${base}&action=prof_me`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d.authenticated && d.profesional) {
          setProfBundle({
            profesional: d.profesional,
            turnos: d.turnos || [],
            pacientes: d.pacientes || [],
            fichas: d.fichas || [],
            evoluciones: d.evoluciones || [],
            estudios: d.estudios || [],
            recetas: d.recetas || [],
            especialidades: d.especialidades || [],
          });
        }
      })
      .catch(() => {});
  }, [tenantSlug]);

  function scrollToTurnero() {
    setActiveTab("cemep");
    setTimeout(() => {
      const el = document.getElementById("turnero-cemep");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 90);
  }

  const plusWaHref = `https://wa.me/${content.cemepPlus.whatsappDigits.replace(/\D/g, "")}?text=${encodeURIComponent(
    "Hola CEMEP Plus! Quiero información para asociarme junto a mi familia."
  )}`;
  const cemepWaHref = `https://wa.me/${content.cemep.whatsappDigits.replace(/\D/g, "")}?text=${encodeURIComponent(
    "Hola CEMEP! Quiero consultar por turnos o estudios médicos."
  )}`;

  return (
    <div className="min-h-screen bg-[#F4F8FB] pb-24 text-[#1B335D]">
      {/* Cinta superior de aviso editable desde Gestión Web */}
      {content.general.avisoSuperiorActivo && content.general.avisoSuperiorTexto && (
        <div className="bg-[#1B335D] px-4 py-2 text-center text-xs font-bold text-white sm:text-sm">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2">
            <span>{content.general.avisoSuperiorTexto}</span>
            <button
              type="button"
              onClick={scrollToTurnero}
              className="cursor-pointer rounded-full bg-[#A6CA0E] px-2.5 py-0.5 text-[11px] font-black text-[#1B335D] hover:bg-white"
            >
              Reservar turno →
            </button>
          </div>
        </div>
      )}

      {/* Header institucional limpio */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <a
            href="#inicio-cemep"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-3"
          >
            <img
              src={isPlus ? "/cemep/cemep-plus-logo.jpeg" : "/cemep/cemep-logo.jpg"}
              alt={isPlus ? "CEMEP Plus" : "CEMEP Centro Médico Paulucci"}
              className={`object-contain transition-all ${
                isPlus
                  ? "h-12 w-12 rounded-xl border border-[#009EE3]/25 object-cover"
                  : "h-12 w-auto"
              }`}
            />
            <div className="hidden sm:block">
              <div className="text-sm font-black leading-tight text-[#1B335D]">
                {isPlus ? "CEMEP Plus" : "CEMEP · Centro Médico Paulucci"}
              </div>
              <div className="text-[11px] font-semibold text-slate-500">
                {content.general.direccion} · {content.general.localidad}
              </div>
            </div>
          </a>

          <nav aria-label="Navegación CEMEP" className="hidden items-center gap-1 lg:flex">
            {!isPlus ? (
              <>
                <a
                  href="#turnero-cemep"
                  className="rounded-xl px-3 py-2 text-xs font-extrabold text-[#1B335D] hover:bg-slate-100"
                >
                  Turnos Online
                </a>
                <a
                  href="#profesionales-cemep"
                  className="rounded-xl px-3 py-2 text-xs font-extrabold text-[#1B335D] hover:bg-slate-100"
                >
                  Profesionales
                </a>
                <a
                  href="#circuitos-cemep"
                  className="rounded-xl px-3 py-2 text-xs font-extrabold text-[#1B335D] hover:bg-slate-100"
                >
                  Circuito & EMMAC
                </a>
                <a
                  href="#tips-cemep"
                  className="rounded-xl px-3 py-2 text-xs font-extrabold text-[#1B335D] hover:bg-slate-100"
                >
                  Tips de Salud
                </a>
              </>
            ) : (
              <>
                <a
                  href="#pilares-plus"
                  className="rounded-xl px-3 py-2 text-xs font-extrabold text-[#1B335D] hover:bg-slate-100"
                >
                  Cobertura
                </a>
                <a
                  href="#campanas-plus"
                  className="rounded-xl px-3 py-2 text-xs font-extrabold text-[#1B335D] hover:bg-slate-100"
                >
                  Programas
                </a>
                <a
                  href="#comercios-plus"
                  className="rounded-xl px-3 py-2 text-xs font-extrabold text-[#1B335D] hover:bg-slate-100"
                >
                  Comercios Adheridos
                </a>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={scrollToTurnero}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#0099D8] px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#0A74A6]"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Solicitá tu turno</span>
            </button>
          </div>
        </div>
      </header>

      {/* PESTAÑAS ESTILO MERCADO PAGO (CEMEP / CEMEP Plus) */}
      <main id="inicio-cemep">
        <MercadoPagoTabs activeTab={activeTab} onChangeTab={setActiveTab}>
          {!isPlus ? (
            /* ================================================================
               PESTAÑA 1: CEMEP — CENTRO MÉDICO PAULUCCI
               ================================================================ */
            <div className="p-5 sm:p-8 lg:p-10">
              {/* HERO CEMEP */}
              <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-[#F8FCFF] via-white to-[#EEF7FA] p-6 sm:p-9">
                <div className="grid items-center gap-8 lg:grid-cols-12">
                  <div className="lg:col-span-7">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1B335D]/8 px-3.5 py-1.5 text-xs font-extrabold text-[#1B335D]">
                      <HeartPulse className="h-3.5 w-3.5 text-[#0099D8]" />
                      {content.cemep.heroBadge}
                    </span>
                    <h1 className="mt-4 text-3xl font-black leading-[1.1] tracking-tight text-[#1B335D] sm:text-4xl lg:text-[2.75rem]">
                      {content.cemep.heroTitle}
                    </h1>
                    <p className="mt-3.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                      {content.cemep.heroSubtitle}
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={scrollToTurnero}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-[#1B335D] px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-[#1B335D]/20 transition hover:bg-[#0A74A6]"
                      >
                        <Calendar className="h-4 w-4 text-[#A6CA0E]" />
                        Solicitá tu turno online
                      </button>
                      <button
                        type="button"
                        onClick={() => setPatientModalOpen(true)}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-[#0099D8] bg-white px-5 py-3 text-sm font-extrabold text-[#1B335D] transition hover:bg-[#EBF7FD]"
                      >
                        <UserRound className="h-4 w-4 text-[#0099D8]" />
                        Estudios y Recetas Digitales
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("cemep_plus")}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-2xl bg-[#48C19F]/15 px-4 py-3 text-sm font-extrabold text-[#0B6E5B] transition hover:bg-[#48C19F]/25"
                      >
                        Conocé CEMEP Plus
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Tarjeta visual de marca + cifras institucionales del feed de Instagram */}
                  <div className="lg:col-span-5">
                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-[#1B335D]/8">
                      <div className="flex items-center justify-center bg-white px-6 pt-7 pb-5">
                        <img
                          src="/cemep/cemep-logo.jpg"
                          alt="CEMEP Centro Médico Paulucci"
                          className="h-24 w-auto object-contain sm:h-28"
                        />
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 bg-[#1B335D] px-2 py-4 text-center text-white">
                        <div className="px-2">
                          <div className="text-2xl font-black text-[#A6CA0E]">
                            {content.cemep.statProfesionalesNum}
                          </div>
                          <div className="mt-0.5 text-[10px] font-semibold leading-tight text-white/85">
                            {content.cemep.statProfesionalesLabel}
                          </div>
                        </div>
                        <div className="px-2">
                          <div className="text-2xl font-black text-[#3AB7E8]">
                            {content.cemep.statRedNum}
                          </div>
                          <div className="mt-0.5 text-[10px] font-semibold leading-tight text-white/85">
                            {content.cemep.statRedLabel}
                          </div>
                        </div>
                        <div className="px-2">
                          <div className="text-2xl font-black text-[#57B7B8]">
                            {content.cemep.statTrayectoriaNum}
                          </div>
                          <div className="mt-0.5 text-[10px] font-semibold leading-tight text-white/85">
                            {content.cemep.statTrayectoriaLabel}
                          </div>
                        </div>
                      </div>
                      {/* Franja inferior de 4 colores del isotipo CEMEP (firma visual de Instagram) */}
                      <div className="grid h-2.5 grid-cols-4">
                        <div className="bg-[#0A74A6]" />
                        <div className="bg-[#3AB7E8]" />
                        <div className="bg-[#57B7B8]" />
                        <div className="bg-[#A6CA0E]" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* TURNERO WEB INTEGRADO EN VIVO */}
              <section id="turnero-cemep" className="mt-10 scroll-mt-24">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0099D8]/12 px-3 py-1 text-xs font-extrabold text-[#0A74A6]">
                      <Calendar className="h-3.5 w-3.5" />
                      Turnero Web Online · 24 hs
                    </span>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-[#1B335D] sm:text-3xl">
                      Reservá tu turno en CEMEP
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Elegí especialidad, profesional, día y horario disponible en tiempo real. Si
                      preferís, también podés escribirnos al{" "}
                      <a
                        href={cemepWaHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-extrabold text-[#0099D8] underline"
                      >
                        {content.cemep.whatsappDisplay}
                      </a>
                      .
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-[#F7FBFD] p-3 sm:p-5">
                  <PublicTurnosPortal
                    tenantSlug={tenantSlug}
                    fantasyName="CEMEP · Centro Médico Paulucci"
                    primaryHex="#1B335D"
                    accentHex="#57B7B8"
                    logoHorizontalUrl="/cemep/cemep-logo.jpg"
                    logoSymbolUrl="/cemep/cemep-logo.jpg"
                  />
                </div>
              </section>

              {/* GRILLA DE ESPECIALIDADES Y PROFESIONALES DESTACADOS */}
              <section id="profesionales-cemep" className="mt-12 scroll-mt-24">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#A6CA0E]/20 px-3 py-1 text-xs font-extrabold text-[#4E6400]">
                      <Stethoscope className="h-3.5 w-3.5" />
                      +30 Profesionales · Un mismo compromiso
                    </span>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-[#1B335D] sm:text-3xl">
                      Especialidades y Equipo Médico
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={scrollToTurnero}
                    className="cursor-pointer text-xs font-extrabold text-[#0099D8] hover:underline sm:text-sm"
                  >
                    Conocé la grilla y solicitá tu cita →
                  </button>
                </div>

                {/* Chips de especialidades */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {content.cemep.especialidadesDestacadas.map((esp) => (
                    <span
                      key={esp}
                      className="rounded-full border border-[#1B335D]/15 bg-[#F4FAFD] px-3.5 py-1.5 text-xs font-bold text-[#1B335D]"
                    >
                      🩺 {esp}
                    </span>
                  ))}
                </div>

                {/* Cards de profesionales destacados */}
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {content.cemep.profesionalesDestacados.map((prof) => (
                    <article
                      key={prof.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div>
                        {prof.badge && (
                          <span className="inline-block rounded-full bg-[#0099D8]/12 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#0A74A6]">
                            {prof.badge}
                          </span>
                        )}
                        <h3 className="mt-2.5 text-base font-black text-[#1B335D]">
                          {prof.nombre}
                        </h3>
                        <p className="text-xs font-bold text-[#0099D8]">{prof.especialidad}</p>
                        <p className="mt-2.5 text-xs leading-relaxed text-slate-600">
                          {prof.detalle}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-600">
                          <Clock className="h-3.5 w-3.5 text-[#57B7B8]" />
                          {prof.diasAtencion}
                        </span>
                        <button
                          type="button"
                          onClick={scrollToTurnero}
                          className="cursor-pointer text-xs font-extrabold text-[#1B335D] hover:text-[#0099D8]"
                        >
                          Pedir turno →
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              {/* CIRCUITO INTEGRAL DE SALUD & EMMAC (con sello circular CEMEP PLUS 50% DTO) */}
              <section id="circuitos-cemep" className="mt-12 grid gap-5 scroll-mt-24 lg:grid-cols-2">
                <div className="relative overflow-hidden rounded-3xl bg-[#1B335D] p-6 text-white shadow-xl sm:p-8">
                  {/* Sello circular azul estilo Reels de CEMEP */}
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#0099D8] px-4 py-1.5 text-xs font-black tracking-wide text-white shadow">
                    <BadgePercent className="h-4 w-4 text-[#A6CA0E]" />
                    {content.cemep.circuitoBeneficioPlus}
                  </div>
                  <h3 className="text-2xl font-black leading-tight sm:text-3xl">
                    {content.cemep.circuitoTitulo}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-white/85">
                    {content.cemep.circuitoSubtitulo}
                  </p>
                  <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-3.5 text-xs font-semibold text-[#E0F7FF]">
                    📅 {content.cemep.circuitoFechaTexto}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <a
                      href={cemepWaHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#A6CA0E] px-4 py-2.5 text-xs font-black text-[#1B335D] hover:bg-white"
                    >
                      Consultar próximo cupo
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setActiveTab("cemep_plus")}
                      className="cursor-pointer rounded-xl border border-white/30 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10"
                    >
                      Ver beneficio CEMEP Plus
                    </button>
                  </div>
                </div>

                <div className="flex flex-col justify-between rounded-3xl border-2 border-[#57B7B8]/40 bg-gradient-to-br from-[#F1FBF9] to-white p-6 sm:p-8">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#57B7B8]/20 px-3 py-1 text-xs font-extrabold text-[#0A5E63]">
                      <Award className="h-3.5 w-3.5" />
                      Deporte Seguro · Córdoba
                    </span>
                    <h3 className="mt-3 text-2xl font-black text-[#1B335D]">
                      {content.cemep.emmacTitulo}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                      {content.cemep.emmacDescripcion}
                    </p>
                    <ul className="mt-4 space-y-2 text-xs font-semibold text-slate-700">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#57B7B8]" />
                        Electrocardiograma, evaluación cardiológica y clínica en el mismo centro
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#A6CA0E]" />
                        50% DTO para afiliados CEMEP Plus en Circuito EMMAC
                      </li>
                    </ul>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={scrollToTurnero}
                      className="cursor-pointer rounded-xl bg-[#1B335D] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-[#0A74A6]"
                    >
                      Reservar turno EMMAC
                    </button>
                    <a
                      href="https://deportes.cba.gov.ar"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-[#1B335D] hover:bg-slate-50"
                    >
                      Web Agencia Córdoba Deportes ↗
                    </a>
                  </div>
                </div>
              </section>

              {/* TIPS DEL COMMUNITY MANAGER & EDUCACIÓN PREVENTIVA */}
              <section id="tips-cemep" className="mt-12 scroll-mt-24">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0099D8]/12 px-3 py-1 text-xs font-extrabold text-[#0A74A6]">
                      <Sparkles className="h-3.5 w-3.5" />
                      Consejos de nuestros profesionales
                    </span>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-[#1B335D] sm:text-3xl">
                      Tips de Salud para cuidarte todos los días
                    </h2>
                  </div>
                  <a
                    href={content.general.instagramCemepUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1B335D] hover:text-[#0099D8]"
                  >
                    <InstagramIcon className="h-4 w-4 text-[#0099D8]" />
                    Seguinos en @centromedicopaulucci
                  </a>
                </div>

                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  {content.cemep.tipsSalud.map((tip) => (
                    <article
                      key={tip.id}
                      className="flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div>
                        <div
                          className="h-2 w-full"
                          style={{ backgroundColor: tip.acentoHex || "#0099D8" }}
                        />
                        <div className="p-6">
                          <span className="text-[11px] font-black uppercase tracking-wider text-[#0099D8]">
                            {tip.categoria}
                          </span>
                          <h3 className="mt-1.5 text-lg font-black leading-snug text-[#1B335D]">
                            {tip.titulo}
                          </h3>
                          <p className="mt-2 text-xs leading-relaxed text-slate-600">
                            {tip.resumen}
                          </p>
                          <ul className="mt-4 space-y-2">
                            {tip.bullets.map((b, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2 text-xs font-medium text-slate-700"
                              >
                                <span
                                  className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                                  style={{ backgroundColor: tip.acentoHex || "#0099D8" }}
                                >
                                  {idx + 1}
                                </span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-3.5">
                        <span className="text-xs font-extrabold text-[#1B335D]">
                          {tip.tagCta || "Cuidarte hoy es prevenir mañana"}
                        </span>
                        <button
                          type="button"
                          onClick={scrollToTurnero}
                          className="cursor-pointer text-xs font-black text-[#0099D8] hover:underline"
                        >
                          Solicitar turno →
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              {/* RED DE SALUD EN ALCIRA GIGENA */}
              <section className="mt-12 rounded-3xl border border-slate-200 bg-gradient-to-r from-[#F4FAFD] via-white to-[#F2FBF9] p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="max-w-2xl">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#0099D8]">
                      <Users className="h-4 w-4" />
                      Trabajando en red por la salud
                    </span>
                    <h3 className="mt-1 text-xl font-black text-[#1B335D] sm:text-2xl">
                      CEMEP + CEMEP Plus + {content.general.farmaciaRedNombre}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 sm:text-sm">
                      Un ecosistema de salud cercano en Alcira Gigena para acompañar a cada familia
                      desde la consulta y los estudios hasta la dispensa farmacéutica.
                    </p>
                  </div>
                  <div className="grid gap-2 text-xs font-semibold text-slate-700">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#0099D8]" />
                      <span>
                        <strong>CEMEP:</strong> {content.general.direccion} —{" "}
                        {content.general.localidad}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-[#57B7B8]" />
                      <span>
                        <strong>Turnos CEMEP:</strong> {content.cemep.whatsappDisplay}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[#A6CA0E]" />
                      <span>
                        <strong>{content.general.farmaciaRedNombre}:</strong>{" "}
                        {content.general.farmaciaRedDireccion} · {content.general.farmaciaRedWhatsapp}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            /* ================================================================
               PESTAÑA 2: CEMEP PLUS — COBERTURA MÉDICA FAMILIAR
               ================================================================ */
            <div className="p-5 sm:p-8 lg:p-10">
              {/* HERO CEMEP PLUS (degradado menta/aguamarina -> blanco -> celeste como el logo oficial) */}
              <section
                className="relative overflow-hidden rounded-3xl border border-[#009EE3]/20 p-6 sm:p-10"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(72,193,159,0.22) 0%, rgba(255,255,255,0.98) 48%, rgba(0,174,240,0.20) 100%)",
                }}
              >
                {/* Signo "+" en recuadro esquina superior derecha (motivo visual oficial de @cemepplus) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-5 right-5 hidden flex-col items-end sm:flex"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#48C19F] bg-white/80 text-[#009EE3] shadow-sm">
                    <Plus className="h-6 w-6 stroke-[3]" />
                  </div>
                  <div className="mt-1.5 h-1 w-14 rounded-full bg-gradient-to-r from-[#48C19F] to-[#009EE3]" />
                </div>

                <div className="grid items-center gap-8 lg:grid-cols-12">
                  <div className="lg:col-span-7">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-extrabold text-[#0B6E5B] shadow-sm">
                      <ShieldCheck className="h-4 w-4 text-[#009EE3]" />
                      {content.cemepPlus.heroBadge}
                    </span>
                    <h1 className="mt-4 text-3xl font-black leading-[1.1] tracking-tight text-[#1B335D] sm:text-4xl lg:text-[2.75rem]">
                      {content.cemepPlus.heroTitle}
                    </h1>
                    <div className="mt-2 text-lg font-black italic text-[#009EE3] sm:text-xl">
                      {content.cemepPlus.sloganCorto}
                    </div>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-700 sm:text-base">
                      {content.cemepPlus.heroSubtitle}
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <a
                        href={plusWaHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl bg-[#009EE3] px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-[#009EE3]/25 transition hover:bg-[#0A74A6]"
                      >
                        Asociate por WhatsApp
                        <ArrowRight className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={scrollToTurnero}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-[#1B335D] bg-white px-5 py-3 text-sm font-extrabold text-[#1B335D] transition hover:bg-slate-50"
                      >
                        <Calendar className="h-4 w-4 text-[#009EE3]" />
                        Sacar turno en CEMEP
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="overflow-hidden rounded-3xl border border-white bg-white/95 p-4 shadow-xl shadow-[#009EE3]/15">
                      <img
                        src="/cemep/cemep-plus-logo.jpeg"
                        alt="CEMEP Plus"
                        className="mx-auto aspect-square w-full max-w-[270px] rounded-2xl object-cover"
                      />
                      <div className="mt-4 rounded-2xl bg-[#1B335D] p-4 text-center text-white">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-[#48C19F]">
                          Beneficio Destacado
                        </div>
                        <div className="mt-1 text-base font-black">
                          {content.cemepPlus.beneficioEstrellaTitulo}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3 PILARES DE COBERTURA (Una cobertura, muchas formas de cuidarte) */}
              <section id="pilares-plus" className="mt-12 scroll-mt-24">
                <div className="text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#48C19F]/15 px-3.5 py-1 text-xs font-extrabold text-[#0B6E5B]">
                    + Una cobertura, muchas formas de cuidarte
                  </span>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-[#1B335D] sm:text-3xl">
                    Consultas médicas, Estudios y Diagnóstico
                  </h2>
                </div>

                <div className="mt-7 grid gap-5 md:grid-cols-3">
                  {content.cemepPlus.pilares.map((pilar, idx) => (
                    <div
                      key={pilar.id}
                      className="flex flex-col rounded-3xl border border-[#009EE3]/25 bg-white p-6 shadow-sm transition hover:border-[#009EE3]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#48C19F] to-[#009EE3] text-sm font-black text-white">
                          0{idx + 1}
                        </span>
                        <Plus className="h-5 w-5 text-[#48C19F]" />
                      </div>
                      <h3 className="mt-4 text-lg font-black text-[#1B335D]">{pilar.titulo}</h3>
                      <p className="mt-1 text-xs font-semibold text-[#009EE3]">{pilar.subtitulo}</p>
                      <ul className="mt-4 space-y-2.5">
                        {pilar.items.map((it, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-xs font-medium text-slate-700"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#48C19F]" />
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

              {/* CAMPAÑAS DE CUIDADO FAMILIAR (@cemepplus) */}
              <section id="campanas-plus" className="mt-12 scroll-mt-24">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-[#009EE3]">
                      Acompañamos cada etapa
                    </span>
                    <h2 className="mt-1 text-2xl font-black text-[#1B335D]">
                      Cobertura pensada para vos y tu familia
                    </h2>
                  </div>
                  <a
                    href={content.general.instagramPlusUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1B335D] hover:text-[#009EE3]"
                  >
                    <InstagramIcon className="h-4 w-4 text-[#009EE3]" />
                    Seguinos en @cemepplus
                  </a>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {content.cemepPlus.campanasDestacadas.map((c) => (
                    <article
                      key={c.id}
                      className="rounded-3xl border border-slate-200 bg-gradient-to-b from-[#F5FCFF] to-white p-6"
                    >
                      <span className="inline-block rounded-full bg-[#009EE3]/15 px-3 py-1 text-[11px] font-black text-[#0A74A6]">
                        {c.etiqueta}
                      </span>
                      <h3 className="mt-3 text-lg font-black text-[#1B335D]">{c.titulo}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">{c.descripcion}</p>
                    </article>
                  ))}
                </div>

                {/* Banner 50% DTO Circuitos */}
                <div className="mt-6 rounded-3xl bg-gradient-to-r from-[#1B335D] via-[#0A6E9E] to-[#009EE3] p-6 text-white sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="max-w-2xl">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold text-[#A6CA0E]">
                        <BadgePercent className="h-4 w-4" />
                        Exclusivo Afiliados CEMEP Plus
                      </span>
                      <h3 className="mt-2 text-xl font-black sm:text-2xl">
                        {content.cemepPlus.beneficioEstrellaTitulo}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-white/90 sm:text-sm">
                        {content.cemepPlus.beneficioEstrellaTexto}
                      </p>
                    </div>
                    <a
                      href={plusWaHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-black text-[#1B335D] shadow-lg hover:bg-[#E0F7FF] sm:text-sm"
                    >
                      Quiero asociarme
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </section>

              {/* COMERCIOS ADHERIDOS */}
              <section id="comercios-plus" className="mt-12 scroll-mt-24">
                <div className="mb-5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#48C19F]/15 px-3 py-1 text-xs font-extrabold text-[#0B6E5B]">
                    <Store className="h-3.5 w-3.5" />
                    Beneficios en Alcira Gigena
                  </span>
                  <h2 className="mt-2 text-2xl font-black text-[#1B335D]">
                    Comercios Adheridos CEMEP Plus
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                    Presentando tu credencial CEMEP Plus accedés a descuentos directos en nuestra
                    red local.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {content.cemepPlus.comerciosAdheridos.map((com) => (
                    <div
                      key={com.id}
                      className="rounded-3xl border border-[#48C19F]/35 bg-[#F6FDFA] p-6"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-black text-[#1B335D]">{com.nombre}</h3>
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-[#0B6E5B] shadow-xs">
                          {com.rubro}
                        </span>
                      </div>
                      <p className="mt-2.5 text-sm font-semibold text-slate-700">{com.beneficio}</p>
                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {com.direccion && <span>📍 {com.direccion}</span>}
                        {com.diasVigencia && <span>🗓️ {com.diasVigencia}</span>}
                        {com.instagram && (
                          <span className="font-bold text-[#009EE3]">{com.instagram}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* CTA FINAL DE AFILIACIÓN */}
              <section className="mt-12 rounded-3xl border-2 border-[#009EE3]/25 bg-white p-7 text-center shadow-sm sm:p-10">
                <h2 className="text-2xl font-black text-[#1B335D] sm:text-3xl">
                  {content.cemepPlus.ctaAfiliacionTitulo}
                </h2>
                <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
                  {content.cemepPlus.ctaAfiliacionTexto}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <a
                    href={plusWaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-6 py-3.5 text-sm font-black text-white shadow-lg transition hover:bg-[#1ebe5d]"
                  >
                    Escribir al {content.cemepPlus.whatsappDisplay}
                  </a>
                  <button
                    type="button"
                    onClick={() => setPatientModalOpen(true)}
                    className="cursor-pointer rounded-2xl border-2 border-[#1B335D] px-5 py-3 text-sm font-extrabold text-[#1B335D] hover:bg-slate-50"
                  >
                    Ingresar al Portal de Pacientes
                  </button>
                </div>
              </section>
            </div>
          )}
        </MercadoPagoTabs>
      </main>

      {/* Footer institucional */}
      <footer className="border-t border-slate-200 bg-[#1B335D] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-8 sm:px-6 lg:px-8">
          <div>
            <div className="text-base font-black">{content.general.nombreInstitucion}</div>
            <div className="mt-1 text-xs text-white/80">
              📍 {content.general.direccion} — {content.general.localidad} · ✉️{" "}
              {content.general.emailInstitucional}
            </div>
            <div className="mt-1 text-xs text-white/75">
              WhatsApp CEMEP: {content.cemep.whatsappDisplay} · WhatsApp CEMEP Plus:{" "}
              {content.cemepPlus.whatsappDisplay}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
            <a
              href={content.general.instagramCemepUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-white/10 px-3.5 py-2 hover:bg-white/20"
            >
              @centromedicopaulucci
            </a>
            <a
              href={content.general.instagramPlusUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-white/10 px-3.5 py-2 hover:bg-white/20"
            >
              @cemepplus
            </a>
            <a
              href="/sistema"
              className="rounded-xl bg-[#A6CA0E] px-3.5 py-2 font-black text-[#1B335D] hover:bg-white"
            >
              Acceso MiniSistema ERP
            </a>
          </div>
        </div>
        {/* Franja inferior multicolor CEMEP */}
        <div className="grid h-2 grid-cols-4">
          <div className="bg-[#0A74A6]" />
          <div className="bg-[#3AB7E8]" />
          <div className="bg-[#57B7B8]" />
          <div className="bg-[#A6CA0E]" />
        </div>
      </footer>

      {/* CONTROLES FIJOS: WhatsApp dinámico + Acceso a Pacientes + Acceso a Profesionales */}
      <CemepFloatingControls
        activeTab={activeTab}
        cemepWhatsappDigits={content.cemep.whatsappDigits}
        cemepWhatsappDisplay={content.cemep.whatsappDisplay}
        plusWhatsappDigits={content.cemepPlus.whatsappDigits}
        plusWhatsappDisplay={content.cemepPlus.whatsappDisplay}
        loggedPatientName={patientBundle?.user?.nombres || null}
        loggedProfName={profBundle?.profesional?.nombre || null}
        onOpenPatientPortal={() => setPatientModalOpen(true)}
        onOpenProfPortal={() => setProfModalOpen(true)}
      />

      {/* MODAL PORTAL PACIENTES */}
      <PatientPortalModal
        open={patientModalOpen}
        onClose={() => setPatientModalOpen(false)}
        tenantSlug={tenantSlug}
        googleClientId={googleClientId}
        bundle={patientBundle}
        onBundleChange={setPatientBundle}
        onJumpToTurnero={scrollToTurnero}
      />

      {/* MODAL PORTAL PROFESIONALES */}
      <ProfessionalPortalModal
        open={profModalOpen}
        onClose={() => setProfModalOpen(false)}
        tenantSlug={tenantSlug}
        bundle={profBundle}
        onBundleChange={setProfBundle}
      />
    </div>
  );
}
