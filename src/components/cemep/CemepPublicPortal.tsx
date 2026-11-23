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
import type { CemepWebContentConfig } from "@/lib/erp/consultorios-types";
import { CemepFloatingControls } from "./CemepFloatingControls";
import { type CemepSectionTab, MercadoPagoTabs } from "./MercadoPagoTabs";
import { type PatientBundleData, PatientPortalModal } from "./PatientPortalModal";
import { type ProfBundleData, ProfessionalPortalModal } from "./ProfessionalPortalModal";
import { TurneroOnlineModal } from "./TurneroOnlineModal";

interface CemepPublicPortalProps {
  tenantSlug: string;
  initialContent: CemepWebContentConfig;
  googleClientId: string;
  initialTab?: CemepSectionTab;
}

const DEFAULT_PROF_PHOTOS: Record<string, string> = {
  "prof-miragaya": "/cemep/photos/prof-miragaya.webp",
  "prof-nunez": "/cemep/photos/prof-nunez.webp",
  "prof-valdatta": "/cemep/photos/prof-valdatta.webp",
  "prof-carabajal": "/cemep/photos/prof-carabajal.webp",
};

const DEFAULT_TIP_PHOTOS: Record<string, string> = {
  "tip-cervical": "/cemep/photos/prof-nunez.webp",
  "tip-postura": "/cemep/photos/prof-kinesiologia.webp",
  "tip-cardio": "/cemep/photos/prof-miragaya.webp",
  "tip-diabetes": "/cemep/photos/prof-valdatta.webp",
};

const DEFAULT_PILAR_PHOTOS: Record<string, { src: string; alt: string; pos?: string }> = {
  "pilar-consultas": {
    src: "/cemep/photos/hero-doctor-paciente.webp",
    alt: "Profesional de CEMEP conversando con un paciente",
    pos: "object-[50%_20%]",
  },
  "pilar-estudios": {
    src: "/cemep/photos/prof-miragaya.webp",
    alt: "Estudios cardiológicos especializados en CEMEP",
    pos: "object-top",
  },
  "pilar-diagnostico": {
    src: "/cemep/photos/prof-carabajal.webp",
    alt: "Diagnóstico por imágenes con nuevo ecógrafo en CEMEP",
    pos: "object-top",
  },
};

const DEFAULT_CAMPANA_PHOTOS: Record<string, { src: string; alt: string; pos?: string }> = {
  "camp-embarazo": {
    src: "/cemep/photos/plus-camp-embarazo.webp",
    alt: "Campaña CEMEP Plus: Tu embarazo, nuestra cobertura",
    pos: "object-center",
  },
  "camp-corazon": {
    src: "/cemep/photos/plus-camp-corazon.webp",
    alt: "Campaña CEMEP Plus: Cobertura que llega al corazón",
    pos: "object-center",
  },
  "camp-prevencion": {
    src: "/cemep/photos/prof-dermatologa.webp",
    alt: "Prevención y controles médicos anuales en CEMEP",
    pos: "object-top",
  },
};

const DEFAULT_COMERCIO_PHOTOS: Record<string, { src: string; alt: string }> = {
  "com-ferrocchio": {
    src: "/cemep/photos/red-farmacia-atencion.webp",
    alt: "Atención personalizada en Farmacia Ferrocchio",
  },
  "com-mimitos": {
    src: "/cemep/photos/plus-comercio-clientes.webp",
    alt: "Afiliadas aprovechando descuentos en comercios adheridos CEMEP Plus",
  },
};

const HERO_AVATAR_STRIP = [
  { src: "/cemep/photos/prof-miragaya.webp", alt: "Dra. Ma. Agustina Miragaya" },
  { src: "/cemep/photos/prof-nunez.webp", alt: "Dr. Franco Núñez" },
  { src: "/cemep/photos/prof-valdatta.webp", alt: "Dra. Lucrecia Valdatta" },
  { src: "/cemep/photos/prof-carabajal.webp", alt: "Dra. María Elena Carabajal" },
  { src: "/cemep/photos/prof-kinesiologia.webp", alt: "Equipo de Kinesiología CEMEP" },
];

const EXTRA_TEAM_HIGHLIGHTS = [
  {
    id: "ext-kine",
    area: "Kinesiología",
    detalle: "Rehabilitación postural y funcional",
    src: "/cemep/photos/prof-kinesiologia.webp",
  },
  {
    id: "ext-fisio",
    area: "Fisioterapia",
    detalle: "Recuperación física y bienestar",
    src: "/cemep/photos/prof-fisioterapia.webp",
  },
  {
    id: "ext-derma",
    area: "Dermatología",
    detalle: "Cuidado clínico de la piel",
    src: "/cemep/photos/prof-dermatologa.webp",
  },
  {
    id: "ext-nutri",
    area: "Nutrición y Clínica",
    detalle: "Hábitos saludables y seguimiento",
    src: "/cemep/photos/prof-nutricion.webp",
  },
];

const RED_GALERIA_PHOTOS = [
  {
    id: "gal-espera",
    src: "/cemep/photos/red-sala-espera.webp",
    label: "Sala de espera · 9 de Julio 160",
    sub: "Espacios luminosos y cálidos",
    pos: "object-center",
  },
  {
    id: "gal-rehab",
    src: "/cemep/photos/rehab-consulta.webp",
    label: "Consultorio y Rehabilitación",
    sub: "Acompañamiento personalizado",
    pos: "object-top",
  },
  {
    id: "gal-farmacia",
    src: "/cemep/photos/red-farmacia-atencion.webp",
    label: "Farmacia Ferrocchio en red",
    sub: "Atención cercana cada día",
    pos: "object-top",
  },
  {
    id: "gal-alexis",
    src: "/cemep/photos/red-farmacia-alexis.webp",
    label: "Equipo farmacéutico",
    sub: "Seguimiento integral de tu receta",
    pos: "object-top",
  },
];

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
  const [turneroModalOpen, setTurneroModalOpen] = useState(false);
  const [patientBundle, setPatientBundle] = useState<PatientBundleData | null>(null);
  const [profBundle, setProfBundle] = useState<ProfBundleData | null>(null);

  const isPlus = activeTab === "cemep_plus";

  // Asegurar que Chrome muestre el isotipo de CEMEP en la pestaña (sobreescribiendo el /icon.png heredado de MiniSistema)
  useEffect(() => {
    const href = "/cemep/cemep-favicon.png?v=2";
    document.querySelectorAll("link[rel*='icon']").forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";
    link.href = href;
    document.head.appendChild(link);
    const shortcut = document.createElement("link");
    shortcut.rel = "shortcut icon";
    shortcut.type = "image/png";
    shortcut.href = href;
    document.head.appendChild(shortcut);
  }, []);

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

  // Abrir el Turnero Online si llega un enlace directo con #turnero-cemep o ?turnero=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (window.location.hash === "#turnero-cemep" || params.get("turnero") === "1") {
      setTurneroModalOpen(true);
    }
  }, []);

  function openTurneroModal() {
    setTurneroModalOpen(true);
  }

  const plusWaHref = `https://wa.me/${content.cemepPlus.whatsappDigits.replace(/\D/g, "")}?text=${encodeURIComponent(
    "Hola CEMEP Plus! Quiero información para asociarme junto a mi familia."
  )}`;
  const cemepWaHref = `https://wa.me/${content.cemep.whatsappDigits.replace(/\D/g, "")}?text=${encodeURIComponent(
    "Hola CEMEP! Quiero consultar por turnos o estudios médicos."
  )}`;

  return (
    <div className="min-h-screen bg-[#F4F8FB] pb-24 text-[#1B335D]">
      {/* Header institucional limpio */}
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0]/80 bg-[#FFFFFF]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <a
            href="#inicio-cemep"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex shrink-0 items-center gap-3.5 py-0.5"
          >
            {isPlus ? (
              <>
                <img
                  src="/cemep/cemep-plus-logo.jpeg"
                  alt="CEMEP Plus"
                  className="h-12 w-12 rounded-2xl border-2 border-[#009EE3]/30 object-cover shadow-sm sm:h-14 sm:w-14"
                />
                <div>
                  <div className="text-base font-black leading-tight text-[#1B335D] sm:text-lg">
                    CEMEP <span className="italic text-[#009EE3]">Plus</span>
                  </div>
                  <div className="text-[11px] font-semibold text-[#64748B]">
                    Cobertura médica familiar · {content.general.localidad}
                  </div>
                </div>
              </>
            ) : (
              <>
                <img
                  src="/cemep/cemep-logo-horizontal.png"
                  alt="CEMEP — Centro Médico Paulucci"
                  className="h-11 w-auto object-contain sm:h-14"
                />
                <div className="hidden border-l border-[#CBD5E1] pl-3 md:block">
                  <div className="text-xs font-extrabold text-[#0A74A6]">
                    {content.general.direccion}
                  </div>
                  <div className="text-[11px] font-semibold text-[#64748B]">
                    {content.general.localidad}
                  </div>
                </div>
              </>
            )}
          </a>

          <nav aria-label="Navegación CEMEP" className="hidden items-center gap-1 lg:flex">
            {!isPlus ? (
              <>
                <button
                  type="button"
                  onClick={openTurneroModal}
                  className="cursor-pointer rounded-xl px-3 py-2 text-xs font-extrabold text-[#1B335D] hover:bg-[#F1F5F9]"
                >
                  Turnos Online
                </button>
                <a
                  href="#profesionales-cemep"
                  className="rounded-xl px-3 py-2 text-xs font-extrabold text-[#1B335D] hover:bg-[#F1F5F9]"
                >
                  Profesionales
                </a>
                <a
                  href="#circuitos-cemep"
                  className="rounded-xl px-3 py-2 text-xs font-extrabold text-[#1B335D] hover:bg-[#F1F5F9]"
                >
                  Circuito & EMMAC
                </a>
                <a
                  href="#tips-cemep"
                  className="rounded-xl px-3 py-2 text-xs font-extrabold text-[#1B335D] hover:bg-[#F1F5F9]"
                >
                  Tips de Salud
                </a>
              </>
            ) : (
              <>
                <a
                  href="#pilares-plus"
                  className="rounded-xl px-3 py-2 text-xs font-extrabold text-[#1B335D] hover:bg-[#F1F5F9]"
                >
                  Cobertura
                </a>
                <a
                  href="#campanas-plus"
                  className="rounded-xl px-3 py-2 text-xs font-extrabold text-[#1B335D] hover:bg-[#F1F5F9]"
                >
                  Programas
                </a>
                <a
                  href="#comercios-plus"
                  className="rounded-xl px-3 py-2 text-xs font-extrabold text-[#1B335D] hover:bg-[#F1F5F9]"
                >
                  Comercios Adheridos
                </a>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openTurneroModal}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#0099D8] px-3.5 py-2 text-xs font-extrabold text-[#FFFFFF] shadow-sm transition hover:bg-[#0A74A6]"
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
              <section className="relative overflow-hidden rounded-3xl border border-[#E2E8F0]/90 bg-gradient-to-br from-[#F8FCFF] via-[#FFFFFF] to-[#EEF7FA] p-6 sm:p-9">
                <div className="grid items-center gap-8 lg:grid-cols-12">
                  <div className="lg:col-span-7">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1B335D]/8 px-3.5 py-1.5 text-xs font-extrabold text-[#1B335D]">
                      <HeartPulse className="h-3.5 w-3.5 text-[#0099D8]" />
                      {content.cemep.heroBadge}
                    </span>
                    <h1 className="mt-4 text-3xl font-black leading-[1.1] tracking-tight text-[#1B335D] sm:text-4xl lg:text-[2.75rem]">
                      {content.cemep.heroTitle}
                    </h1>
                    <p className="mt-3.5 max-w-2xl text-sm leading-relaxed text-[#475569] sm:text-base">
                      {content.cemep.heroSubtitle}
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={openTurneroModal}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-[#1B335D] px-6 py-3.5 text-sm font-extrabold text-[#FFFFFF] shadow-lg shadow-[#1B335D]/20 transition hover:bg-[#0A74A6]"
                      >
                        <Calendar className="h-4 w-4 text-[#A6CA0E]" />
                        Solicitá tu turno online
                      </button>
                      <button
                        type="button"
                        onClick={() => setPatientModalOpen(true)}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-[#0099D8] bg-[#FFFFFF] px-5 py-3 text-sm font-extrabold text-[#1B335D] transition hover:bg-[#EBF7FD]"
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

                    {/* Prueba social humana: rostros reales del equipo CEMEP */}
                    <div className="mt-6 flex flex-wrap items-center gap-3 pt-1">
                      <div className="flex -space-x-2.5">
                        {HERO_AVATAR_STRIP.map((av) => (
                          <img
                            key={av.src}
                            src={av.src}
                            alt={av.alt}
                            width={40}
                            height={40}
                            decoding="async"
                            className="h-10 w-10 rounded-full border-2 border-[#FFFFFF] object-cover object-top shadow-sm"
                          />
                        ))}
                      </div>
                      <div className="text-xs leading-snug text-[#475569]">
                        <span className="font-black text-[#1B335D]">
                          Atención humana y cercana
                        </span>{" "}
                        con especialistas reales en {content.general.direccion},{" "}
                        {content.general.localidad}.
                      </div>
                    </div>
                  </div>

                  {/* Mosaico fotográfico real de personas + cifras institucionales CEMEP */}
                  <div className="lg:col-span-5">
                    <div className="overflow-hidden rounded-3xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-xl shadow-[#1B335D]/10">
                      <div className="relative grid grid-cols-12 gap-1.5 bg-[#FFFFFF] p-2">
                        {/* Foto principal: médico y paciente conversando en CEMEP */}
                        <div className="relative col-span-7 overflow-hidden rounded-2xl bg-[#E8F3FA]">
                          <img
                            src="/cemep/photos/hero-doctor-paciente.webp"
                            alt="Médico de CEMEP dialogando con un paciente en el centro médico"
                            width={720}
                            height={746}
                            fetchPriority="high"
                            decoding="async"
                            className="h-56 w-full object-cover object-[50%_18%] sm:h-64"
                          />
                          <div
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
                            style={{
                              background:
                                "linear-gradient(180deg, rgba(27,51,93,0) 0%, rgba(27,51,93,0.78) 100%)",
                            }}
                          />
                          <div className="absolute right-2.5 bottom-2.5 left-2.5">
                            <span className="text-[11px] font-extrabold leading-tight text-[#FFFFFF]">
                              Trato cercano en cada consulta
                            </span>
                          </div>
                        </div>

                        {/* Columna derecha: 2 retratos reales del equipo */}
                        <div className="col-span-5 flex flex-col gap-1.5">
                          <div className="relative flex-1 overflow-hidden rounded-2xl bg-[#E8F3FA]">
                            <img
                              src="/cemep/photos/hero-fundadores.webp"
                              alt="Directores médicos de CEMEP Centro Médico Paulucci"
                              width={720}
                              height={794}
                              fetchPriority="high"
                              decoding="async"
                              className="h-[109px] w-full object-cover object-top sm:h-[125px]"
                            />
                          </div>
                          <div className="relative flex-1 overflow-hidden rounded-2xl bg-[#E8F3FA]">
                            <img
                              src="/cemep/photos/prof-dermatologa.webp"
                              alt="Profesional médica de CEMEP atendiendo en consultorio"
                              width={640}
                              height={614}
                              fetchPriority="high"
                              decoding="async"
                              className="h-[109px] w-full object-cover object-top sm:h-[125px]"
                            />
                          </div>
                        </div>

                        {/* Sello institucional discreto sobre el mosaico */}
                        <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 rounded-full border border-[#FFFFFF]/80 bg-[#FFFFFF]/95 px-2.5 py-1 shadow-md backdrop-blur-sm">
                          <img
                            src="/cemep/cemep-logo-horizontal.png"
                            alt="CEMEP"
                            className="h-5 w-auto object-contain"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 divide-x divide-[#FFFFFF]/15 border-t border-[#F1F5F9] bg-[#1B335D] px-2 py-4 text-center text-[#FFFFFF]">
                        <div className="px-2">
                          <div className="text-2xl font-black text-[#A6CA0E]">
                            {content.cemep.statProfesionalesNum}
                          </div>
                          <div className="mt-0.5 text-[10px] font-semibold leading-tight text-[#FFFFFF]/85">
                            {content.cemep.statProfesionalesLabel}
                          </div>
                        </div>
                        <div className="px-2">
                          <div className="text-2xl font-black text-[#3AB7E8]">
                            {content.cemep.statRedNum}
                          </div>
                          <div className="mt-0.5 text-[10px] font-semibold leading-tight text-[#FFFFFF]/85">
                            {content.cemep.statRedLabel}
                          </div>
                        </div>
                        <div className="px-2">
                          <div className="text-2xl font-black text-[#57B7B8]">
                            {content.cemep.statTrayectoriaNum}
                          </div>
                          <div className="mt-0.5 text-[10px] font-semibold leading-tight text-[#FFFFFF]/85">
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
                    onClick={openTurneroModal}
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

                {/* Cards de profesionales destacados con retratos reales de Instagram */}
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {content.cemep.profesionalesDestacados.map((prof) => {
                    const profPhoto = prof.fotoUrl || DEFAULT_PROF_PHOTOS[prof.id] || "";
                    return (
                      <article
                        key={prof.id}
                        className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        <div>
                          {profPhoto && (
                            <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#E8F3FA]">
                              <img
                                src={profPhoto}
                                alt={`${prof.nombre} — ${prof.especialidad}`}
                                width={640}
                                height={480}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.04]"
                              />
                              <div
                                className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
                                style={{
                                  background:
                                    "linear-gradient(180deg, rgba(27,51,93,0) 0%, rgba(27,51,93,0.45) 100%)",
                                }}
                              />
                              {prof.badge && (
                                <span className="absolute top-3 left-3 inline-block rounded-full bg-[#FFFFFF]/95 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#0A74A6] shadow-sm backdrop-blur-xs">
                                  {prof.badge}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="p-5 pb-3">
                            {!profPhoto && prof.badge && (
                              <span className="mb-2 inline-block rounded-full bg-[#0099D8]/12 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#0A74A6]">
                                {prof.badge}
                              </span>
                            )}
                            <h3 className="text-base font-black text-[#1B335D]">{prof.nombre}</h3>
                            <p className="mt-0.5 text-xs font-bold text-[#0099D8]">
                              {prof.especialidad}
                            </p>
                            <p className="mt-2.5 text-xs leading-relaxed text-[#475569]">
                              {prof.detalle}
                            </p>
                          </div>
                        </div>
                        <div className="mx-5 mb-4 mt-2 flex items-center justify-between border-t border-[#F1F5F9] pt-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#475569]">
                            <Clock className="h-3.5 w-3.5 text-[#57B7B8]" />
                            {prof.diasAtencion}
                          </span>
                          <button
                            type="button"
                            onClick={openTurneroModal}
                            className="cursor-pointer text-xs font-extrabold text-[#1B335D] hover:text-[#0099D8]"
                          >
                            Pedir turno →
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Franja humana adicional: más áreas y rostros reales del equipo CEMEP */}
                <div className="mt-5 rounded-3xl border border-[#E2E8F0] bg-[#F8FCFF] p-4 sm:p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-[#0A74A6]">
                      Más áreas con atención presencial en CEMEP
                    </span>
                    <button
                      type="button"
                      onClick={openTurneroModal}
                      className="cursor-pointer text-xs font-extrabold text-[#1B335D] hover:text-[#0099D8]"
                    >
                      Ver agenda completa →
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {EXTRA_TEAM_HIGHLIGHTS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={openTurneroModal}
                        className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-2.5 text-left transition hover:border-[#0099D8] hover:shadow-sm"
                      >
                        <img
                          src={item.src}
                          alt={`Profesional de ${item.area} en CEMEP`}
                          width={56}
                          height={56}
                          loading="lazy"
                          decoding="async"
                          className="h-14 w-14 shrink-0 rounded-xl object-cover object-top transition duration-300 group-hover:scale-105"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-black text-[#1B335D]">
                            {item.area}
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#64748B]">
                            {item.detalle}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* CIRCUITO INTEGRAL DE SALUD & EMMAC (con fotos reales de pacientes y deportistas) */}
              <section id="circuitos-cemep" className="mt-12 grid gap-5 scroll-mt-24 lg:grid-cols-2">
                <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-[#1B335D] text-[#FFFFFF] shadow-xl">
                  <div className="relative h-52 w-full overflow-hidden sm:h-56">
                    <img
                      src="/cemep/photos/circuito-integral.webp"
                      alt="Paciente llegando a CEMEP para realizar el Circuito Integral de Salud"
                      width={640}
                      height={694}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-[50%_22%] transition duration-500 group-hover:scale-[1.03]"
                    />
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(27,51,93,0.18) 0%, rgba(27,51,93,0.45) 55%, #1B335D 100%)",
                      }}
                    />
                    {/* Sello azul estilo Reels de CEMEP */}
                    <div className="absolute top-4 left-5 inline-flex items-center gap-2 rounded-full bg-[#0099D8] px-4 py-1.5 text-xs font-black tracking-wide text-[#FFFFFF] shadow-md">
                      <BadgePercent className="h-4 w-4 text-[#A6CA0E]" />
                      {content.cemep.circuitoBeneficioPlus}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col justify-between px-6 pt-2 pb-6 sm:px-8 sm:pb-8">
                    <div>
                      <h3 className="text-2xl font-black leading-tight sm:text-3xl">
                        {content.cemep.circuitoTitulo}
                      </h3>
                      <p className="mt-2.5 text-sm leading-relaxed text-[#FFFFFF]/85">
                        {content.cemep.circuitoSubtitulo}
                      </p>
                      <div className="mt-4 rounded-2xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/10 p-3.5 text-xs font-semibold text-[#E0F7FF]">
                        📅 {content.cemep.circuitoFechaTexto}
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2.5">
                      <a
                        href={cemepWaHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#A6CA0E] px-4 py-2.5 text-xs font-black text-[#1B335D] hover:bg-[#FFFFFF]"
                      >
                        Consultar próximo cupo
                        <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setActiveTab("cemep_plus")}
                        className="cursor-pointer rounded-xl border border-[#FFFFFF]/30 px-4 py-2.5 text-xs font-bold text-[#FFFFFF] hover:bg-[#FFFFFF]/10"
                      >
                        Ver beneficio CEMEP Plus
                      </button>
                    </div>
                  </div>
                </div>

                <div className="group flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-[#57B7B8]/40 bg-gradient-to-br from-[#F1FBF9] to-[#FFFFFF] shadow-sm">
                  <div className="relative h-52 w-full overflow-hidden sm:h-56">
                    <img
                      src="/cemep/photos/emmac-deporte.webp"
                      alt="Evaluación médica y deportiva supervisada en CEMEP para renovación EMMAC"
                      width={760}
                      height={662}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-[50%_24%] transition duration-500 group-hover:scale-[1.03]"
                    />
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(10,94,99,0.08) 0%, rgba(241,251,249,0.15) 60%, #F1FBF9 100%)",
                      }}
                    />
                    <span className="absolute top-4 left-5 inline-flex items-center gap-1.5 rounded-full bg-[#FFFFFF]/95 px-3.5 py-1.5 text-xs font-extrabold text-[#0A5E63] shadow-sm backdrop-blur-xs">
                      <Award className="h-3.5 w-3.5 text-[#57B7B8]" />
                      Deporte Seguro · Córdoba
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col justify-between px-6 pt-2 pb-6 sm:px-8 sm:pb-8">
                    <div>
                      <h3 className="text-2xl font-black text-[#1B335D]">
                        {content.cemep.emmacTitulo}
                      </h3>
                      <p className="mt-2.5 text-sm leading-relaxed text-[#475569]">
                        {content.cemep.emmacDescripcion}
                      </p>
                      <ul className="mt-4 space-y-2 text-xs font-semibold text-[#334155]">
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
                        onClick={openTurneroModal}
                        className="cursor-pointer rounded-xl bg-[#1B335D] px-4 py-2.5 text-xs font-extrabold text-[#FFFFFF] hover:bg-[#0A74A6]"
                      >
                        Reservar turno EMMAC
                      </button>
                      <a
                        href="https://deportes.cba.gov.ar"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-4 py-2.5 text-xs font-bold text-[#1B335D] hover:bg-[#F8FAFC]"
                      >
                        Web Agencia Córdoba Deportes ↗
                      </a>
                    </div>
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
                  {content.cemep.tipsSalud.map((tip) => {
                    const tipPhoto = tip.fotoUrl || DEFAULT_TIP_PHOTOS[tip.id] || "";
                    return (
                      <article
                        key={tip.id}
                        className="flex flex-col justify-between overflow-hidden rounded-3xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-sm transition hover:shadow-md"
                      >
                        <div>
                          <div
                            className="h-2 w-full"
                            style={{ backgroundColor: tip.acentoHex || "#0099D8" }}
                          />
                          <div className="p-6">
                            <div className="flex items-start gap-3.5">
                              {tipPhoto && (
                                <img
                                  src={tipPhoto}
                                  alt={tip.autor || tip.categoria}
                                  width={64}
                                  height={64}
                                  loading="lazy"
                                  decoding="async"
                                  className="h-16 w-16 shrink-0 rounded-2xl border-2 border-[#E2E8F0] object-cover object-top shadow-xs"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <span className="text-[11px] font-black uppercase tracking-wider text-[#0099D8]">
                                  {tip.categoria}
                                </span>
                                <h3 className="mt-1 text-lg font-black leading-snug text-[#1B335D]">
                                  {tip.titulo}
                                </h3>
                              </div>
                            </div>
                            <p className="mt-3 text-xs leading-relaxed text-[#475569]">
                              {tip.resumen}
                            </p>
                            <ul className="mt-4 space-y-2">
                              {tip.bullets.map((b, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-start gap-2 text-xs font-medium text-[#334155]"
                                >
                                  <span
                                    className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-[#FFFFFF]"
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
                        <div className="flex items-center justify-between border-t border-[#F1F5F9] bg-[#F8FAFC]/80 px-6 py-3.5">
                          <span className="text-xs font-extrabold text-[#1B335D]">
                            {tip.tagCta || "Cuidarte hoy es prevenir mañana"}
                          </span>
                          <button
                            type="button"
                            onClick={openTurneroModal}
                            className="cursor-pointer text-xs font-black text-[#0099D8] hover:underline"
                          >
                            Solicitar turno →
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              {/* RED DE SALUD EN ALCIRA GIGENA + GALERÍA REAL DE PERSONAS */}
              <section className="mt-12 rounded-3xl border border-[#E2E8F0] bg-gradient-to-r from-[#F4FAFD] via-[#FFFFFF] to-[#F2FBF9] p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="max-w-2xl">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#0099D8]">
                      <Users className="h-4 w-4" />
                      +45 personas trabajando en red por la salud
                    </span>
                    <h3 className="mt-1 text-xl font-black text-[#1B335D] sm:text-2xl">
                      CEMEP + CEMEP Plus + {content.general.farmaciaRedNombre}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-[#475569] sm:text-sm">
                      Un ecosistema de salud cercano en Alcira Gigena para acompañar a cada familia
                      desde la consulta y los estudios hasta la dispensa farmacéutica.
                    </p>
                  </div>
                  <div className="grid gap-2 text-xs font-semibold text-[#334155]">
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

                {/* Galería real de vida cotidiana en CEMEP y Farmacia Ferrocchio */}
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {RED_GALERIA_PHOTOS.map((foto) => (
                    <figure
                      key={foto.id}
                      className="group relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-xs"
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden bg-[#E8F3FA]">
                        <img
                          src={foto.src}
                          alt={`${foto.label} — ${foto.sub}`}
                          width={720}
                          height={540}
                          loading="lazy"
                          decoding="async"
                          className={`h-full w-full object-cover ${foto.pos} transition duration-500 group-hover:scale-105`}
                        />
                      </div>
                      <figcaption className="px-3.5 py-2.5">
                        <div className="text-xs font-black text-[#1B335D]">{foto.label}</div>
                        <div className="text-[11px] font-medium text-[#64748B]">{foto.sub}</div>
                      </figcaption>
                    </figure>
                  ))}
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
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#48C19F] bg-[#FFFFFF]/80 text-[#009EE3] shadow-sm">
                    <Plus className="h-6 w-6 stroke-[3]" />
                  </div>
                  <div className="mt-1.5 h-1 w-14 rounded-full bg-gradient-to-r from-[#48C19F] to-[#009EE3]" />
                </div>

                <div className="grid items-center gap-8 lg:grid-cols-12">
                  <div className="lg:col-span-7">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFFFF]/90 px-3.5 py-1.5 text-xs font-extrabold text-[#0B6E5B] shadow-sm">
                      <ShieldCheck className="h-4 w-4 text-[#009EE3]" />
                      {content.cemepPlus.heroBadge}
                    </span>
                    <h1 className="mt-4 text-3xl font-black leading-[1.1] tracking-tight text-[#1B335D] sm:text-4xl lg:text-[2.75rem]">
                      {content.cemepPlus.heroTitle}
                    </h1>
                    <div className="mt-2 text-lg font-black italic text-[#009EE3] sm:text-xl">
                      {content.cemepPlus.sloganCorto}
                    </div>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#334155] sm:text-base">
                      {content.cemepPlus.heroSubtitle}
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <a
                        href={plusWaHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl bg-[#009EE3] px-6 py-3.5 text-sm font-extrabold text-[#FFFFFF] shadow-lg shadow-[#009EE3]/25 transition hover:bg-[#0A74A6]"
                      >
                        Asociate por WhatsApp
                        <ArrowRight className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={openTurneroModal}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-[#1B335D] bg-[#FFFFFF] px-5 py-3 text-sm font-extrabold text-[#1B335D] transition hover:bg-[#F8FAFC]"
                      >
                        <Calendar className="h-4 w-4 text-[#009EE3]" />
                        Sacar turno en CEMEP
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="overflow-hidden rounded-3xl border border-[#FFFFFF] bg-[#FFFFFF]/95 p-2.5 shadow-xl shadow-[#009EE3]/18">
                      {/* Foto principal familiar de @cemepplus */}
                      <div className="relative overflow-hidden rounded-2xl bg-[#E8F7FD]">
                        <img
                          src="/cemep/photos/plus-hero-familia.webp"
                          alt="Familia cuidada por CEMEP Plus — Nos inspira cuidar así"
                          width={720}
                          height={720}
                          fetchPriority="high"
                          decoding="async"
                          className="h-56 w-full object-cover object-center sm:h-60"
                        />
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full border border-[#FFFFFF]/80 bg-[#FFFFFF]/95 p-1 pr-3 shadow-md backdrop-blur-xs">
                          <img
                            src="/cemep/cemep-plus-logo.jpeg"
                            alt="CEMEP Plus"
                            className="h-7 w-7 rounded-full object-cover"
                          />
                          <span className="text-[11px] font-black text-[#1B335D]">
                            CEMEP <span className="italic text-[#009EE3]">Plus</span>
                          </span>
                        </div>
                      </div>

                      {/* Dos escenas reales de cercanía y red local */}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="relative overflow-hidden rounded-xl bg-[#E8F7FD]">
                          <img
                            src="/cemep/photos/red-recepcion.webp"
                            alt="Recepción y bienvenida en CEMEP"
                            width={640}
                            height={770}
                            loading="lazy"
                            decoding="async"
                            className="h-24 w-full object-cover object-[50%_28%]"
                          />
                          <div
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
                            style={{
                              background:
                                "linear-gradient(180deg, rgba(27,51,93,0) 0%, rgba(27,51,93,0.78) 100%)",
                            }}
                          />
                          <span className="absolute bottom-1.5 left-2 text-[10px] font-extrabold text-[#FFFFFF]">
                            Bienvenida cálida
                          </span>
                        </div>
                        <div className="relative overflow-hidden rounded-xl bg-[#E8F7FD]">
                          <img
                            src="/cemep/photos/plus-comercio-clientes.webp"
                            alt="Afiliados disfrutando beneficios en comercios adheridos"
                            width={640}
                            height={589}
                            loading="lazy"
                            decoding="async"
                            className="h-24 w-full object-cover object-top"
                          />
                          <div
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
                            style={{
                              background:
                                "linear-gradient(180deg, rgba(27,51,93,0) 0%, rgba(27,51,93,0.78) 100%)",
                            }}
                          />
                          <span className="absolute bottom-1.5 left-2 text-[10px] font-extrabold text-[#FFFFFF]">
                            Beneficios locales
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 rounded-2xl bg-[#1B335D] p-4 text-center text-[#FFFFFF]">
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
                  {content.cemepPlus.pilares.map((pilar, idx) => {
                    const fallbackPilar = DEFAULT_PILAR_PHOTOS[pilar.id];
                    const pilarPhoto = pilar.fotoUrl || fallbackPilar?.src || "";
                    const pilarPos = fallbackPilar?.pos || "object-top";
                    return (
                      <div
                        key={pilar.id}
                        className="group flex flex-col overflow-hidden rounded-3xl border border-[#009EE3]/25 bg-[#FFFFFF] shadow-sm transition hover:border-[#009EE3] hover:shadow-md"
                      >
                        {pilarPhoto && (
                          <div className="relative h-44 w-full overflow-hidden bg-[#E8F7FD]">
                            <img
                              src={pilarPhoto}
                              alt={fallbackPilar?.alt || pilar.titulo}
                              width={640}
                              height={440}
                              loading="lazy"
                              decoding="async"
                              className={`h-full w-full object-cover ${pilarPos} transition duration-500 group-hover:scale-[1.04]`}
                            />
                            <div
                              className="pointer-events-none absolute inset-x-0 bottom-0 h-14"
                              style={{
                                background:
                                  "linear-gradient(180deg, rgba(27,51,93,0) 0%, rgba(27,51,93,0.45) 100%)",
                              }}
                            />
                            <span className="absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#48C19F] to-[#009EE3] text-xs font-black text-[#FFFFFF] shadow-md">
                              0{idx + 1}
                            </span>
                            <span className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFFFFF]/90 text-[#009EE3] shadow-xs">
                              <Plus className="h-4 w-4 stroke-[2.8]" />
                            </span>
                          </div>
                        )}
                        <div className="flex flex-1 flex-col p-6">
                          {!pilarPhoto && (
                            <div className="mb-3 flex items-center justify-between">
                              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#48C19F] to-[#009EE3] text-sm font-black text-[#FFFFFF]">
                                0{idx + 1}
                              </span>
                              <Plus className="h-5 w-5 text-[#48C19F]" />
                            </div>
                          )}
                          <h3 className="text-lg font-black text-[#1B335D]">{pilar.titulo}</h3>
                          <p className="mt-1 text-xs font-semibold text-[#009EE3]">
                            {pilar.subtitulo}
                          </p>
                          <ul className="mt-4 space-y-2.5">
                            {pilar.items.map((it, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-xs font-medium text-[#334155]"
                              >
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#48C19F]" />
                                <span>{it}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
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

                <div className="grid gap-5 md:grid-cols-3">
                  {content.cemepPlus.campanasDestacadas.map((c) => {
                    const fallbackCamp = DEFAULT_CAMPANA_PHOTOS[c.id];
                    const campPhoto = c.fotoUrl || fallbackCamp?.src || "";
                    const campPos = fallbackCamp?.pos || "object-center";
                    return (
                      <article
                        key={c.id}
                        className="group overflow-hidden rounded-3xl border border-[#E2E8F0] bg-gradient-to-b from-[#F5FCFF] to-[#FFFFFF] shadow-sm transition hover:shadow-md"
                      >
                        {campPhoto && (
                          <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#E8F7FD]">
                            <img
                              src={campPhoto}
                              alt={fallbackCamp?.alt || c.titulo}
                              width={720}
                              height={540}
                              loading="lazy"
                              decoding="async"
                              className={`h-full w-full object-cover ${campPos} transition duration-500 group-hover:scale-[1.03]`}
                            />
                            <span className="absolute top-3 left-3 inline-block rounded-full bg-[#FFFFFF]/95 px-3 py-1 text-[11px] font-black text-[#0A74A6] shadow-sm">
                              {c.etiqueta}
                            </span>
                          </div>
                        )}
                        <div className="p-6">
                          {!campPhoto && (
                            <span className="inline-block rounded-full bg-[#009EE3]/15 px-3 py-1 text-[11px] font-black text-[#0A74A6]">
                              {c.etiqueta}
                            </span>
                          )}
                          <h3 className="text-lg font-black text-[#1B335D]">{c.titulo}</h3>
                          <p className="mt-2 text-xs leading-relaxed text-[#475569]">
                            {c.descripcion}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Banner 50% DTO Circuitos */}
                <div className="mt-6 rounded-3xl bg-gradient-to-r from-[#1B335D] via-[#0A6E9E] to-[#009EE3] p-6 text-[#FFFFFF] sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="max-w-2xl">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFFFF]/15 px-3 py-1 text-xs font-extrabold text-[#A6CA0E]">
                        <BadgePercent className="h-4 w-4" />
                        Exclusivo Afiliados CEMEP Plus
                      </span>
                      <h3 className="mt-2 text-xl font-black sm:text-2xl">
                        {content.cemepPlus.beneficioEstrellaTitulo}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#FFFFFF]/90 sm:text-sm">
                        {content.cemepPlus.beneficioEstrellaTexto}
                      </p>
                    </div>
                    <a
                      href={plusWaHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#FFFFFF] px-5 py-3 text-xs font-black text-[#1B335D] shadow-lg hover:bg-[#E0F7FF] sm:text-sm"
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
                  <p className="mt-1 text-xs text-[#475569] sm:text-sm">
                    Presentando tu credencial CEMEP Plus accedés a descuentos directos en nuestra
                    red local.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  {content.cemepPlus.comerciosAdheridos.map((com, idx) => {
                    const fallbackCom = DEFAULT_COMERCIO_PHOTOS[com.id];
                    const comPhoto =
                      com.fotoUrl ||
                      fallbackCom?.src ||
                      (idx % 2 === 0
                        ? "/cemep/photos/plus-comercio-local.webp"
                        : "/cemep/photos/plus-comercio-clientes.webp");
                    return (
                      <div
                        key={com.id}
                        className="group overflow-hidden rounded-3xl border border-[#48C19F]/35 bg-[#F6FDFA] shadow-sm transition hover:shadow-md"
                      >
                        <div className="grid h-full sm:grid-cols-12">
                          <div className="relative h-48 overflow-hidden bg-[#DFF8F0] sm:col-span-5 sm:h-full">
                            <img
                              src={comPhoto}
                              alt={fallbackCom?.alt || com.nombre}
                              width={640}
                              height={540}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.04]"
                            />
                          </div>
                          <div className="flex flex-col justify-between p-5 sm:col-span-7 sm:p-6">
                            <div>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-lg font-black text-[#1B335D]">{com.nombre}</h3>
                                <span className="rounded-full bg-[#FFFFFF] px-3 py-1 text-[11px] font-extrabold text-[#0B6E5B] shadow-xs">
                                  {com.rubro}
                                </span>
                              </div>
                              <p className="mt-2.5 text-sm font-semibold text-[#334155]">
                                {com.beneficio}
                              </p>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#64748B]">
                              {com.direccion && <span>📍 {com.direccion}</span>}
                              {com.diasVigencia && <span>🗓️ {com.diasVigencia}</span>}
                              {com.instagram && (
                                <span className="font-bold text-[#009EE3]">{com.instagram}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* CTA FINAL DE AFILIACIÓN */}
              <section className="mt-12 rounded-3xl border-2 border-[#009EE3]/25 bg-[#FFFFFF] p-7 text-center shadow-sm sm:p-10">
                <div className="mb-4 flex justify-center -space-x-2.5">
                  {[
                    { src: "/cemep/photos/plus-hero-familia.webp", alt: "Familia CEMEP Plus" },
                    { src: "/cemep/photos/hero-doctor-paciente.webp", alt: "Atención en CEMEP" },
                    { src: "/cemep/photos/red-farmacia-atencion.webp", alt: "Farmacia en red" },
                    { src: "/cemep/photos/plus-comercio-local.webp", alt: "Comercio adherido" },
                  ].map((av) => (
                    <img
                      key={av.src}
                      src={av.src}
                      alt={av.alt}
                      width={48}
                      height={48}
                      loading="lazy"
                      decoding="async"
                      className="h-12 w-12 rounded-full border-2 border-[#FFFFFF] object-cover object-top shadow-md"
                    />
                  ))}
                </div>
                <h2 className="text-2xl font-black text-[#1B335D] sm:text-3xl">
                  {content.cemepPlus.ctaAfiliacionTitulo}
                </h2>
                <p className="mx-auto mt-2 max-w-2xl text-sm text-[#475569]">
                  {content.cemepPlus.ctaAfiliacionTexto}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <a
                    href={plusWaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-6 py-3.5 text-sm font-black text-[#FFFFFF] shadow-lg transition hover:bg-[#1ebe5d]"
                  >
                    Escribir al {content.cemepPlus.whatsappDisplay}
                  </a>
                  <button
                    type="button"
                    onClick={() => setPatientModalOpen(true)}
                    className="cursor-pointer rounded-2xl border-2 border-[#1B335D] px-5 py-3 text-sm font-extrabold text-[#1B335D] hover:bg-[#F8FAFC]"
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
      <footer className="border-t border-[#E2E8F0] bg-[#1B335D] text-[#FFFFFF]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-8 sm:px-6 lg:px-8">
          <div>
            <div className="text-base font-black">{content.general.nombreInstitucion}</div>
            <div className="mt-1 text-xs text-[#FFFFFF]/80">
              📍 {content.general.direccion} — {content.general.localidad} · ✉️{" "}
              {content.general.emailInstitucional}
            </div>
            <div className="mt-1 text-xs text-[#FFFFFF]/75">
              WhatsApp CEMEP: {content.cemep.whatsappDisplay} · WhatsApp CEMEP Plus:{" "}
              {content.cemepPlus.whatsappDisplay}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
            <a
              href={content.general.instagramCemepUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-[#FFFFFF]/10 px-3.5 py-2 hover:bg-[#FFFFFF]/20"
            >
              @centromedicopaulucci
            </a>
            <a
              href={content.general.instagramPlusUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-[#FFFFFF]/10 px-3.5 py-2 hover:bg-[#FFFFFF]/20"
            >
              @cemepplus
            </a>
            <a
              href="/sistema"
              className="rounded-xl bg-[#A6CA0E] px-3.5 py-2 font-black text-[#1B335D] hover:bg-[#FFFFFF]"
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
        loggedPatientPhoto={patientBundle?.user?.fotoUrl || null}
        loggedProfName={profBundle?.profesional?.nombre || null}
        onOpenPatientPortal={() => setPatientModalOpen(true)}
        onOpenProfPortal={() => setProfModalOpen(true)}
      />

      {/* MODAL TURNERO ONLINE */}
      <TurneroOnlineModal
        open={turneroModalOpen}
        onClose={() => setTurneroModalOpen(false)}
        tenantSlug={tenantSlug}
        whatsappHref={cemepWaHref}
        whatsappDisplay={content.cemep.whatsappDisplay}
      />

      {/* MODAL PORTAL PACIENTES */}
      <PatientPortalModal
        open={patientModalOpen}
        onClose={() => setPatientModalOpen(false)}
        tenantSlug={tenantSlug}
        googleClientId={googleClientId}
        bundle={patientBundle}
        onBundleChange={setPatientBundle}
        onJumpToTurnero={openTurneroModal}
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
