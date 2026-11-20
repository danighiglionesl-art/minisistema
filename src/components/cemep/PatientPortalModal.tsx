"use client";

import React, { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Download,
  FileCheck2,
  FileHeart,
  FilePlus2,
  KeyRound,
  LogOut,
  Mail,
  Pill,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import type {
  CemepWebUserRecord,
  EstudioMedicoRecord,
  RecetaDigitalRecord,
} from "@/lib/erp/consultorios-types";
import type { TurnoRecord } from "@/lib/erp/turnos-types";

export type SafeWebUser = Omit<
  CemepWebUserRecord,
  "passwordHash" | "resetCode" | "resetCodeExpiresAt"
>;

export interface PatientBundleData {
  user: SafeWebUser;
  turnos: TurnoRecord[];
  estudios: EstudioMedicoRecord[];
  recetas: RecetaDigitalRecord[];
  resumenClinico?: {
    grupoSanguineo: string;
    alergias: string;
    obraSocialNombre: string;
    esAfiliadoCemepPlus: boolean;
  } | null;
}

interface PatientPortalModalProps {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  googleClientId: string;
  bundle: PatientBundleData | null;
  onBundleChange: (next: PatientBundleData | null) => void;
  onJumpToTurnero: () => void;
}

function recetaEstadoBadge(estado: RecetaDigitalRecord["estado"]) {
  if (estado === "emitida") {
    return {
      label: "Emitida · Lista para descargar",
      cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
    };
  }
  if (estado === "en_proceso") {
    return {
      label: "En proceso",
      cls: "bg-sky-100 text-sky-800 border-sky-200",
    };
  }
  if (estado === "rechazada") {
    return {
      label: "Observada / Rechazada",
      cls: "bg-rose-100 text-rose-800 border-rose-200",
    };
  }
  return {
    label: "Solicitada",
    cls: "bg-amber-100 text-amber-800 border-amber-200",
  };
}

export function PatientPortalModal({
  open,
  onClose,
  tenantSlug,
  googleClientId,
  bundle,
  onBundleChange,
  onJumpToTurnero,
}: PatientPortalModalProps) {
  const [authTab, setAuthTab] = useState<"login" | "register" | "recover">("login");
  const [dashTab, setDashTab] = useState<"estudios" | "recetas" | "turnos" | "perfil">("estudios");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; isErr: boolean } | null>(null);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showGoogleFallback, setShowGoogleFallback] = useState(false);
  const [googleEmailQuick, setGoogleEmailQuick] = useState("");
  const [googleNameQuick, setGoogleNameQuick] = useState("");

  // Register
  const [regApellidos, setRegApellidos] = useState("");
  const [regNombres, setRegNombres] = useState("");
  const [regDni, setRegDni] = useState("");
  const [regWhatsapp, setRegWhatsapp] = useState("");
  const [regObraSocial, setRegObraSocial] = useState("");
  const [regNroAfiliado, setRegNroAfiliado] = useState("");
  const [regPlus, setRegPlus] = useState(false);
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // Recover
  const [recEmail, setRecEmail] = useState("");
  const [recStep, setRecStep] = useState<1 | 2>(1);
  const [recCode, setRecCode] = useState("");
  const [recNewPass, setRecNewPass] = useState("");

  // Solicitud de receta
  const [recMeds, setRecMeds] = useState("");
  const [recProf, setRecProf] = useState("");
  const [recOs, setRecOs] = useState("");
  const [recAfiliado, setRecAfiliado] = useState("");
  const [recDiag, setRecDiag] = useState("");
  const [recNotas, setRecNotas] = useState("");

  // Perfil
  const [profDni, setProfDni] = useState("");
  const [profApellidos, setProfApellidos] = useState("");
  const [profNombres, setProfNombres] = useState("");
  const [profWhatsapp, setProfWhatsapp] = useState("");
  const [profObraSocial, setProfObraSocial] = useState("");
  const [profNroAfiliado, setProfNroAfiliado] = useState("");
  const [profPlus, setProfPlus] = useState(false);

  const apiUrl = `/api/cemep?tenant=${encodeURIComponent(tenantSlug)}`;

  useEffect(() => {
    if (!bundle?.user) return;
    const u = bundle.user;
    setProfDni(u.dni || "");
    setProfApellidos(u.apellidos || "");
    setProfNombres(u.nombres || "");
    setProfWhatsapp(u.whatsapp || "");
    setProfObraSocial(u.obraSocial || "");
    setProfNroAfiliado(u.nroAfiliado || "");
    setProfPlus(Boolean(u.esAfiliadoCemepPlus));
    setRecOs(u.obraSocial || (u.esAfiliadoCemepPlus ? "CEMEP Plus" : ""));
    setRecAfiliado(u.nroAfiliado || "");
  }, [bundle?.user]);

  // Google Identity Services
  useEffect(() => {
    if (!open || bundle || !googleClientId) return;
    const scriptId = "cemep-google-gsi";
    const initGsi = () => {
      const g = (window as unknown as { google?: any }).google;
      if (!g?.accounts?.id) return;
      g.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (resp: { credential?: string }) => {
          if (!resp?.credential) return;
          setBusy(true);
          setMsg(null);
          try {
            const res = await fetch(apiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "patient_google_login",
                credential: resp.credential,
              }),
            });
            const data = await res.json();
            if (res.ok && data.ok) {
              onBundleChange({
                user: data.user,
                turnos: data.turnos || [],
                estudios: data.estudios || [],
                recetas: data.recetas || [],
                resumenClinico: data.resumenClinico || null,
              });
              setMsg({ text: data.message || "Sesión iniciada con Google.", isErr: false });
            } else {
              setMsg({ text: data.message || "No se pudo ingresar con Google.", isErr: true });
            }
          } finally {
            setBusy(false);
          }
        },
      });
      const slot = document.getElementById("cemep-google-btn-slot");
      if (slot) {
        slot.innerHTML = "";
        g.accounts.id.renderButton(slot, {
          theme: "outline",
          size: "large",
          width: 320,
          text: "continue_with",
        });
      }
    };

    if (!document.getElementById(scriptId)) {
      const s = document.createElement("script");
      s.id = scriptId;
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = initGsi;
      document.head.appendChild(s);
    } else {
      setTimeout(initGsi, 120);
    }
  }, [open, bundle, googleClientId, apiUrl, onBundleChange]);

  if (!open) return null;

  async function postAction(payload: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg({ text: data.message || "Ocurrió un error. Intentá nuevamente.", isErr: true });
        return null;
      }
      if (data.user) {
        onBundleChange({
          user: data.user,
          turnos: data.turnos || [],
          estudios: data.estudios || [],
          recetas: data.recetas || [],
          resumenClinico: data.resumenClinico || null,
        });
      }
      if (data.message) setMsg({ text: data.message, isErr: false });
      return data;
    } catch {
      setMsg({ text: "Error de conexión con el servidor.", isErr: true });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await postAction({ action: "patient_logout" });
    onBundleChange(null);
    setMsg(null);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Portal de Pacientes CEMEP"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B335D]/70 p-3 backdrop-blur-sm sm:p-5"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Encabezado */}
        <div
          className="flex items-center justify-between gap-4 px-5 py-4 text-white sm:px-7"
          style={{
            background: "linear-gradient(135deg, #1B335D 0%, #0A74A6 65%, #0099D8 100%)",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
              <UserRound className="h-5 w-5 text-[#A6CA0E]" />
            </span>
            <div>
              <h2 className="text-lg font-black tracking-tight sm:text-xl">
                Portal de Pacientes · CEMEP
              </h2>
              <p className="text-xs text-white/80">
                {bundle
                  ? `${bundle.user.nombreCompleto} · ${bundle.user.email}`
                  : "Consultá tus estudios, solicitá recetas digitales y gestioná tus turnos"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {bundle && (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/25"
              >
                <LogOut className="h-3.5 w-3.5" />
                Salir
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar Portal de Pacientes"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {msg && (
            <div
              className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                msg.isErr
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {msg.text}
            </div>
          )}

          {!bundle ? (
            <div className="mx-auto max-w-xl">
              {/* Tabs auth */}
              <div className="mb-5 grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 p-1">
                {[
                  { id: "login", label: "Ingresar" },
                  { id: "register", label: "Registrarme" },
                  { id: "recover", label: "Recuperar Clave" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setAuthTab(t.id as "login" | "register" | "recover");
                      setMsg(null);
                    }}
                    className={`cursor-pointer rounded-xl py-2.5 text-xs font-extrabold transition sm:text-sm ${
                      authTab === t.id
                        ? "bg-[#1B335D] text-white shadow"
                        : "text-slate-600 hover:text-[#1B335D]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Bloque Google */}
              {authTab !== "recover" && (
                <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-center">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Acceso rápido con Google
                  </div>
                  {googleClientId ? (
                    <div id="cemep-google-btn-slot" className="flex justify-center" />
                  ) : !showGoogleFallback ? (
                    <button
                      type="button"
                      onClick={() => setShowGoogleFallback(true)}
                      className="inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4285F4] text-xs font-black text-white">
                        G
                      </span>
                      Continuar con Google
                    </button>
                  ) : (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await postAction({
                          action: "patient_google_login",
                          fallbackEmail: googleEmailQuick,
                          fallbackName: googleNameQuick,
                        });
                      }}
                      className="mt-2 grid gap-2 text-left sm:grid-cols-2"
                    >
                      <input
                        type="email"
                        required
                        value={googleEmailQuick}
                        onChange={(e) => setGoogleEmailQuick(e.target.value)}
                        placeholder="tu.correo@gmail.com"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        value={googleNameQuick}
                        onChange={(e) => setGoogleNameQuick(e.target.value)}
                        placeholder="Tu Nombre y Apellido"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="cursor-pointer rounded-xl bg-[#4285F4] py-2 text-sm font-bold text-white hover:bg-[#3367D6] sm:col-span-2"
                      >
                        {busy ? "Ingresando..." : "Ingresar con cuenta Google"}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {authTab === "login" && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await postAction({
                      action: "patient_login",
                      email: loginEmail,
                      password: loginPassword,
                    });
                  }}
                  className="space-y-3.5"
                >
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="paciente@correo.com"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0099D8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0099D8] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full cursor-pointer rounded-xl bg-[#1B335D] py-3 text-sm font-extrabold text-white shadow-md hover:bg-[#142748] disabled:opacity-60"
                  >
                    {busy ? "Verificando..." : "Ingresar al Portal de Pacientes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthTab("recover")}
                    className="w-full cursor-pointer text-center text-xs font-bold text-[#0099D8] hover:underline"
                  >
                    ¿Olvidaste tu contraseña? Recuperala automáticamente
                  </button>
                </form>
              )}

              {authTab === "register" && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await postAction({
                      action: "patient_register",
                      apellidos: regApellidos,
                      nombres: regNombres,
                      dni: regDni,
                      whatsapp: regWhatsapp,
                      obraSocial: regObraSocial,
                      nroAfiliado: regNroAfiliado,
                      esAfiliadoCemepPlus: regPlus,
                      email: regEmail,
                      password: regPassword,
                    });
                  }}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Apellido/s *</label>
                    <input
                      required
                      value={regApellidos}
                      onChange={(e) => setRegApellidos(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Nombre/s *</label>
                    <input
                      required
                      value={regNombres}
                      onChange={(e) => setRegNombres(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      DNI * (vincula tus estudios e historia)
                    </label>
                    <input
                      required
                      value={regDni}
                      onChange={(e) => setRegDni(e.target.value)}
                      placeholder="Ej. 35123456"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">WhatsApp</label>
                    <input
                      value={regWhatsapp}
                      onChange={(e) => setRegWhatsapp(e.target.value)}
                      placeholder="358..."
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Obra Social / Prepaga
                    </label>
                    <input
                      value={regObraSocial}
                      onChange={(e) => setRegObraSocial(e.target.value)}
                      placeholder="APROSS, OSDE, PAMI, Particular..."
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Nº de Afiliado
                    </label>
                    <input
                      value={regNroAfiliado}
                      onChange={(e) => setRegNroAfiliado(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#009EE3]/30 bg-[#EBF9FF] px-3 py-2.5 text-xs font-bold text-[#1B335D] sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={regPlus}
                      onChange={(e) => setRegPlus(e.target.checked)}
                    />
                    Soy afiliado/a a CEMEP Plus
                  </label>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Correo electrónico *
                    </label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Crear Contraseña *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-1 w-full cursor-pointer rounded-xl bg-[#0099D8] py-3 text-sm font-extrabold text-white shadow-md hover:bg-[#0A74A6] sm:col-span-2"
                  >
                    {busy ? "Creando cuenta..." : "Crear mi cuenta en CEMEP"}
                  </button>
                </form>
              )}

              {authTab === "recover" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3.5 text-xs text-sky-900">
                    <KeyRound className="mb-1 inline h-4 w-4 text-[#0099D8]" /> Ingresá tu correo
                    electrónico registrado y te generaremos un código automático de 6 dígitos para
                    restablecer tu contraseña.
                  </div>
                  {recStep === 1 ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const data = await postAction({
                          action: "patient_request_reset",
                          email: recEmail,
                        });
                        if (data?.ok) {
                          setRecStep(2);
                          if (data.devCodeHint) setRecCode(data.devCodeHint);
                        }
                      }}
                      className="space-y-3"
                    >
                      <input
                        type="email"
                        required
                        value={recEmail}
                        onChange={(e) => setRecEmail(e.target.value)}
                        placeholder="Tu correo registrado"
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full cursor-pointer rounded-xl bg-[#1B335D] py-2.5 text-sm font-extrabold text-white"
                      >
                        <Mail className="mr-1.5 inline h-4 w-4" />
                        Enviar código de recuperación
                      </button>
                    </form>
                  ) : (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const data = await postAction({
                          action: "patient_confirm_reset",
                          email: recEmail,
                          code: recCode,
                          newPassword: recNewPass,
                        });
                        if (data?.ok) {
                          setRecStep(1);
                          setLoginEmail(recEmail);
                          setAuthTab("login");
                        }
                      }}
                      className="space-y-3"
                    >
                      <input
                        required
                        value={recCode}
                        onChange={(e) => setRecCode(e.target.value)}
                        placeholder="Código de 6 dígitos"
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-center text-lg font-black tracking-widest"
                      />
                      <input
                        type="password"
                        required
                        minLength={4}
                        value={recNewPass}
                        onChange={(e) => setRecNewPass(e.target.value)}
                        placeholder="Nueva contraseña (mín. 4 caracteres)"
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full cursor-pointer rounded-xl bg-emerald-600 py-2.5 text-sm font-extrabold text-white"
                      >
                        Confirmar nueva contraseña
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Navegación interna del paciente */}
              <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                {[
                  {
                    id: "estudios",
                    label: `Mis Estudios (${bundle.estudios.length})`,
                    icon: FileHeart,
                  },
                  {
                    id: "recetas",
                    label: `Mis Recetas (${bundle.recetas.length})`,
                    icon: Pill,
                  },
                  {
                    id: "turnos",
                    label: `Mis Turnos (${bundle.turnos.length})`,
                    icon: Calendar,
                  },
                  { id: "perfil", label: "Mi Perfil", icon: ShieldCheck },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = dashTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDashTab(tab.id as any)}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition sm:text-sm ${
                        active
                          ? "bg-[#1B335D] text-white shadow"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: MIS ESTUDIOS */}
              {dashTab === "estudios" && (
                <div className="space-y-3">
                  {!bundle.user.dni && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-semibold text-amber-900">
                      Completá tu <strong>DNI</strong> en «Mi Perfil» para vincular automáticamente
                      todos tus estudios médicos e historial de turnos de CEMEP.
                    </div>
                  )}
                  {bundle.estudios.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                      <FileHeart className="mx-auto h-10 w-10 text-slate-300" />
                      <h3 className="mt-2 text-base font-extrabold text-[#1B335D]">
                        Aún no tenés estudios cargados
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Cuando tu profesional cargue ecografías, laboratorios, informes cardiológicos
                        o resultados de circuito, aparecerán aquí para ver y descargar.
                      </p>
                    </div>
                  ) : (
                    bundle.estudios.map((est) => (
                      <div
                        key={est.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-[#0099D8]/15 px-2.5 py-0.5 text-[11px] font-extrabold text-[#0A74A6]">
                                {est.tipoEstudio}
                              </span>
                              <span className="text-xs font-semibold text-slate-500">
                                {est.fechaEstudio}
                              </span>
                            </div>
                            <h4 className="mt-1 text-base font-extrabold text-[#1B335D]">
                              {est.titulo}
                            </h4>
                            <p className="text-xs text-slate-600">
                              Profesional: <strong>{est.profesionalNombre}</strong>
                              {est.especialidadNombre ? ` · ${est.especialidadNombre}` : ""}
                            </p>
                          </div>
                          {est.archivoDataUrl && (
                            <a
                              href={est.archivoDataUrl}
                              download={est.archivoNombre || `${est.titulo}.pdf`}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B335D] px-3.5 py-2 text-xs font-extrabold text-white hover:bg-[#0A74A6]"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Descargar estudio
                            </a>
                          )}
                        </div>
                        {est.descripcionInforme && (
                          <p className="mt-2.5 whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-relaxed text-slate-700">
                            {est.descripcionInforme}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: MIS RECETAS DIGITALES */}
              {dashTab === "recetas" && (
                <div className="grid gap-5 lg:grid-cols-5">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await postAction({
                        action: "patient_request_receta",
                        medicamentosSolicitados: recMeds,
                        profesionalNombre: recProf,
                        obraSocialNombre: recOs,
                        nroAfiliado: recAfiliado,
                        diagnosticoMotivo: recDiag,
                        notasPaciente: recNotas,
                      });
                      if (res?.ok) {
                        setRecMeds("");
                        setRecDiag("");
                        setRecNotas("");
                      }
                    }}
                    className="space-y-3 rounded-2xl border border-[#0099D8]/25 bg-[#F4FAFD] p-4 lg:col-span-2"
                  >
                    <h3 className="flex items-center gap-2 text-sm font-black text-[#1B335D]">
                      <FilePlus2 className="h-4 w-4 text-[#0099D8]" />
                      Solicitar Emisión de Receta
                    </h3>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        Medicamento/s y dosis *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={recMeds}
                        onChange={(e) => setRecMeds(e.target.value)}
                        placeholder="Ej: Enalapril 10mg x 30 comp., Metformina 850mg..."
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        Profesional tratante (opcional)
                      </label>
                      <input
                        value={recProf}
                        onChange={(e) => setRecProf(e.target.value)}
                        placeholder="Ej: Dra. Lucrecia Valdatta"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">
                          Obra Social
                        </label>
                        <input
                          value={recOs}
                          onChange={(e) => setRecOs(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">
                          Nº Afiliado
                        </label>
                        <input
                          value={recAfiliado}
                          onChange={(e) => setRecAfiliado(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        Diagnóstico / Observaciones
                      </label>
                      <input
                        value={recNotas}
                        onChange={(e) => setRecNotas(e.target.value)}
                        placeholder="Tratamiento habitual, renovación mensual..."
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full cursor-pointer rounded-xl bg-[#1B335D] py-2.5 text-xs font-extrabold text-white hover:bg-[#0A74A6]"
                    >
                      {busy ? "Enviando..." : "Enviar solicitud de receta"}
                    </button>
                  </form>

                  <div className="space-y-3 lg:col-span-3">
                    <h3 className="text-sm font-black text-[#1B335D]">
                      Historial de Recetas Digitales
                    </h3>
                    {bundle.recetas.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                        Todavía no solicitaste recetas digitales. Usá el formulario de la izquierda
                        para pedir una renovación o emisión.
                      </div>
                    ) : (
                      bundle.recetas.map((r) => {
                        const badge = recetaEstadoBadge(r.estado);
                        return (
                          <div
                            key={r.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-black text-[#1B335D]">{r.codigo}</span>
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${badge.cls}`}
                              >
                                {badge.label}
                              </span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-xs font-semibold text-slate-800">
                              {r.medicamentosSolicitados}
                            </p>
                            <div className="mt-1.5 text-[11px] text-slate-500">
                              {r.obraSocialNombre}
                              {r.profesionalNombre ? ` · ${r.profesionalNombre}` : ""} ·{" "}
                              {r.createdAt.slice(0, 10)}
                            </div>
                            {r.observacionesAdmin && (
                              <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                                <strong>Respuesta CEMEP:</strong> {r.observacionesAdmin}
                              </div>
                            )}
                            {r.recetaCodigoValidacion && (
                              <div className="mt-1.5 text-xs font-bold text-[#0A74A6]">
                                Código validación: {r.recetaCodigoValidacion}
                              </div>
                            )}
                            {r.recetaArchivoDataUrl && (
                              <a
                                href={r.recetaArchivoDataUrl}
                                download={r.recetaArchivoNombre || `${r.codigo}.pdf`}
                                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-emerald-700"
                              >
                                <FileCheck2 className="h-4 w-4" />
                                Descargar Receta Digital
                              </a>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: MIS TURNOS */}
              {dashTab === "turnos" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-600">
                      Turnos vinculados en tiempo real con el Turnero Web de CEMEP.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onJumpToTurnero();
                      }}
                      className="cursor-pointer rounded-xl bg-[#0099D8] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#0A74A6]"
                    >
                      + Sacar Nuevo Turno Online
                    </button>
                  </div>
                  {bundle.turnos.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                      No encontramos turnos asociados a tu DNI o correo todavía.
                    </div>
                  ) : (
                    bundle.turnos.map((t) => (
                      <div
                        key={t.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-[#1B335D] px-2 py-0.5 text-[11px] font-black text-white">
                              {t.fecha} · {t.horaInicio}
                            </span>
                            <span className="text-xs font-bold text-slate-500">{t.codigo}</span>
                          </div>
                          <div className="mt-1 text-sm font-extrabold text-[#1B335D]">
                            {t.especialidadNombre} — {t.profesionalNombre}
                          </div>
                          <div className="text-xs text-slate-600">
                            Modalidad: {t.modalidad === "videollamada" ? "Videollamada" : "Presencial"} ·{" "}
                            {t.coberturaTipo === "particular"
                              ? "Particular"
                              : t.obraSocialNombre || "Obra Social"}
                          </div>
                        </div>
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-extrabold uppercase text-[#1B335D]">
                          {t.estado}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: MI PERFIL */}
              {dashTab === "perfil" && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await postAction({
                      action: "patient_update_profile",
                      dni: profDni,
                      apellidos: profApellidos,
                      nombres: profNombres,
                      whatsapp: profWhatsapp,
                      obraSocial: profObraSocial,
                      nroAfiliado: profNroAfiliado,
                      esAfiliadoCemepPlus: profPlus,
                    });
                  }}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">DNI</label>
                    <input
                      value={profDni}
                      onChange={(e) => setProfDni(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">WhatsApp</label>
                    <input
                      value={profWhatsapp}
                      onChange={(e) => setProfWhatsapp(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Apellido/s</label>
                    <input
                      value={profApellidos}
                      onChange={(e) => setProfApellidos(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Nombre/s</label>
                    <input
                      value={profNombres}
                      onChange={(e) => setProfNombres(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Obra Social</label>
                    <input
                      value={profObraSocial}
                      onChange={(e) => setProfObraSocial(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Nº Afiliado</label>
                    <input
                      value={profNroAfiliado}
                      onChange={(e) => setProfNroAfiliado(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#009EE3]/30 bg-[#EBF9FF] px-3 py-2.5 text-xs font-bold text-[#1B335D] sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={profPlus}
                      onChange={(e) => setProfPlus(e.target.checked)}
                    />
                    <CheckCircle2 className="h-4 w-4 text-[#009EE3]" />
                    Soy afiliado/a a CEMEP Plus
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full cursor-pointer rounded-xl bg-[#1B335D] py-2.5 text-sm font-extrabold text-white hover:bg-[#0A74A6] sm:col-span-2"
                  >
                    {busy ? "Guardando..." : "Guardar cambios de perfil"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
