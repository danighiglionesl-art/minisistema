"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
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
      cls: "bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]",
    };
  }
  if (estado === "en_proceso") {
    return {
      label: "En proceso",
      cls: "bg-[#E0F2FE] text-[#075985] border-[#BAE6FD]",
    };
  }
  if (estado === "rechazada") {
    return {
      label: "Observada / Rechazada",
      cls: "bg-[#FFE4E6] text-[#9F1239] border-[#FECDD3]",
    };
  }
  return {
    label: "Solicitada",
    cls: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]",
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
  const [showPassword, setShowPassword] = useState(false);
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
  }, [open, bundle, googleClientId, showGoogleFallback, apiUrl, onBundleChange]);

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function handleGoogleContinueClick() {
    setMsg(null);
    if (googleClientId) {
      const g = (window as unknown as { google?: any }).google;
      if (g?.accounts?.id) {
        try {
          g.accounts.id.prompt();
        } catch {
          // Mostrar botón oficial de Google como respaldo
        }
      }
      setShowGoogleFallback(true);
      return;
    }
    setShowGoogleFallback((prev) => !prev);
  }

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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B335D]/70 p-3 backdrop-blur-sm sm:p-5"
    >
      <div
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-3xl border border-[#0099D8]/25 bg-[#FFFFFF] text-[#1B335D] shadow-2xl ${
          bundle ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        {/* Encabezado: formato limpio estilo ReikiOnline en modo acceso, cabecera institucional completa en sesión iniciada */}
        {!bundle ? (
          <div className="flex items-center justify-between gap-3 border-b border-[#1B335D]/12 bg-[#FFFFFF] px-6 py-4 sm:px-8 sm:py-5">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#0099D8]/30 bg-[#FFFFFF] p-1 shadow-sm">
                <img
                  src="/cemep/cemep-favicon.png"
                  alt="CEMEP"
                  width={36}
                  height={36}
                  className="h-9 w-9 object-contain"
                />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-[#1B335D] sm:text-xl">
                {authTab === "register"
                  ? "Registrarme"
                  : authTab === "recover"
                    ? "Recuperar contraseña"
                    : "Ingresar"}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar Portal de Pacientes"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#F1F5F9] text-[#1B335D] transition-colors hover:bg-[#E2E8F0]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            className="flex items-center justify-between gap-4 px-5 py-4 text-[#FFFFFF] sm:px-7"
            style={{
              background: "linear-gradient(135deg, #1B335D 0%, #0A74A6 65%, #0099D8 100%)",
            }}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFFFFF]/15">
                <UserRound className="h-5 w-5 text-[#A6CA0E]" />
              </span>
              <div>
                <h2 className="text-lg font-black tracking-tight sm:text-xl">
                  Portal de Pacientes · CEMEP
                </h2>
                <p className="text-xs text-[#FFFFFF]/80">
                  {bundle.user.nombreCompleto} · {bundle.user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#FFFFFF]/15 px-3 py-2 text-xs font-bold text-[#FFFFFF] hover:bg-[#FFFFFF]/25"
              >
                <LogOut className="h-3.5 w-3.5" />
                Salir
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar Portal de Pacientes"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-[#FFFFFF]/15 text-[#FFFFFF] hover:bg-[#FFFFFF]/25"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Contenido */}
        <div
          className={`flex-1 overflow-y-auto overscroll-contain ${
            bundle ? "p-5 sm:p-7" : "px-6 py-5 sm:px-8 sm:py-6"
          }`}
        >
          {msg && (
            <div
              role="alert"
              className={`mb-4 rounded-xl border px-4 py-3 text-xs font-semibold sm:text-sm ${
                msg.isErr
                  ? "border-[#FECDD3] bg-[#FFF1F2] text-[#9F1239]"
                  : "border-[#57B7B8]/40 bg-[#EFFCF9] text-[#0A5E63]"
              }`}
            >
              {msg.text}
            </div>
          )}

          {!bundle ? (
            <div>
              {/* 1. MODO INGRESAR (Formato ReikiOnline en paleta CEMEP) */}
              {authTab === "login" && (
                <div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await postAction({
                        action: "patient_login",
                        email: loginEmail,
                        password: loginPassword,
                      });
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label
                        htmlFor="cemep-patient-login-email"
                        className="block text-xs font-semibold text-[#1B335D] sm:text-sm"
                      >
                        Correo electrónico
                      </label>
                      <input
                        id="cemep-patient-login-email"
                        type="email"
                        required
                        autoComplete="username"
                        spellCheck={false}
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="tucorreo@ejemplo.com"
                        className="mt-1.5 w-full rounded-xl border border-[#0099D8]/30 bg-[#F4F9FC] px-4 py-3 text-base text-[#1B335D] placeholder:text-[#1B335D]/40 transition-colors focus:border-[#0099D8] focus:bg-[#FFFFFF] focus:outline-none sm:text-sm"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="cemep-patient-login-pass"
                          className="block text-xs font-semibold text-[#1B335D] sm:text-sm"
                        >
                          Contraseña
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setMsg(null);
                            setRecStep(1);
                            setAuthTab("recover");
                          }}
                          className="cursor-pointer text-xs font-semibold text-[#0099D8] underline underline-offset-4 hover:text-[#0A74A6]"
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                      </div>
                      <div className="relative mt-1.5">
                        <input
                          id="cemep-patient-login-pass"
                          type={showPassword ? "text" : "password"}
                          required
                          autoComplete="current-password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-xl border border-[#0099D8]/30 bg-[#F4F9FC] py-3 pr-24 pl-4 text-base text-[#1B335D] placeholder:text-[#1B335D]/40 transition-colors focus:border-[#0099D8] focus:bg-[#FFFFFF] focus:outline-none sm:text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-pressed={showPassword}
                          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                          className="absolute top-1/2 right-2.5 inline-flex -translate-y-1/2 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#0099D8] transition-colors hover:bg-[#0099D8]/10"
                        >
                          {showPassword ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              <span>Ocultar</span>
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              <span>Mostrar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full cursor-pointer rounded-xl bg-[#1B335D] px-5 py-3.5 text-sm font-bold text-[#FFFFFF] shadow-md shadow-[#1B335D]/20 transition-all hover:bg-[#0A74A6] disabled:opacity-60"
                    >
                      {busy ? "Verificando..." : "Ingresar"}
                    </button>
                  </form>

                  {/* Separador "o" estilo ReikiOnline */}
                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-[#1B335D]/15" />
                    <span className="text-xs font-medium text-[#1B335D]/60">o</span>
                    <div className="h-px flex-1 bg-[#1B335D]/15" />
                  </div>

                  {/* Dos botones inferiores en paralelo: Google | Registrarme */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleGoogleContinueClick}
                      disabled={busy}
                      className="inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-[#0099D8]/30 bg-[#FFFFFF] px-4 py-3 text-xs font-semibold text-[#1B335D] transition-all hover:border-[#0099D8] hover:bg-[#F4F9FC] disabled:opacity-60 sm:text-sm"
                    >
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="#4285F4"
                          d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                        />
                      </svg>
                      <span>Google</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMsg(null);
                        setShowGoogleFallback(false);
                        setAuthTab("register");
                      }}
                      className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-[#1B335D] bg-[#A6CA0E]/25 px-4 py-3 text-xs font-bold text-[#1B335D] transition-all hover:bg-[#A6CA0E]/45 sm:text-sm"
                    >
                      <span>Registrarme</span>
                    </button>
                  </div>

                  {/* Acceso rápido con Google (desplegable al hacer clic en Google) */}
                  {showGoogleFallback && (
                    <div className="mt-4 rounded-2xl border border-[#0099D8]/25 bg-[#F4F9FC] p-4">
                      {googleClientId ? (
                        <div id="cemep-google-btn-slot" className="flex justify-center" />
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
                          className="grid gap-2.5 sm:grid-cols-2"
                        >
                          <input
                            type="email"
                            required
                            value={googleEmailQuick}
                            onChange={(e) => setGoogleEmailQuick(e.target.value)}
                            placeholder="tu.correo@gmail.com"
                            className="rounded-xl border border-[#0099D8]/30 bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#1B335D] focus:border-[#0099D8] focus:outline-none"
                          />
                          <input
                            type="text"
                            value={googleNameQuick}
                            onChange={(e) => setGoogleNameQuick(e.target.value)}
                            placeholder="Tu Nombre y Apellido"
                            className="rounded-xl border border-[#0099D8]/30 bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#1B335D] focus:border-[#0099D8] focus:outline-none"
                          />
                          <button
                            type="submit"
                            disabled={busy}
                            className="cursor-pointer rounded-xl bg-[#0099D8] py-2.5 text-sm font-bold text-[#FFFFFF] transition hover:bg-[#0A74A6] sm:col-span-2"
                          >
                            {busy ? "Ingresando..." : "Continuar con cuenta Google"}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 2. MODO REGISTRARME */}
              {authTab === "register" && (
                <div>
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
                    className="grid gap-3.5 sm:grid-cols-2"
                  >
                    <div>
                      <label className="block text-xs font-semibold text-[#1B335D] sm:text-sm">
                        Apellido/s *
                      </label>
                      <input
                        required
                        value={regApellidos}
                        onChange={(e) => setRegApellidos(e.target.value)}
                        placeholder="Tu apellido"
                        className="mt-1.5 w-full rounded-xl border border-[#0099D8]/30 bg-[#F4F9FC] px-4 py-2.5 text-sm text-[#1B335D] placeholder:text-[#1B335D]/40 focus:border-[#0099D8] focus:bg-[#FFFFFF] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1B335D] sm:text-sm">
                        Nombre/s *
                      </label>
                      <input
                        required
                        value={regNombres}
                        onChange={(e) => setRegNombres(e.target.value)}
                        placeholder="Tu nombre"
                        className="mt-1.5 w-full rounded-xl border border-[#0099D8]/30 bg-[#F4F9FC] px-4 py-2.5 text-sm text-[#1B335D] placeholder:text-[#1B335D]/40 focus:border-[#0099D8] focus:bg-[#FFFFFF] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1B335D] sm:text-sm">
                        DNI * (vincula tus estudios e historia)
                      </label>
                      <input
                        required
                        value={regDni}
                        onChange={(e) => setRegDni(e.target.value)}
                        placeholder="Ej. 35123456"
                        className="mt-1.5 w-full rounded-xl border border-[#0099D8]/30 bg-[#F4F9FC] px-4 py-2.5 text-sm text-[#1B335D] placeholder:text-[#1B335D]/40 focus:border-[#0099D8] focus:bg-[#FFFFFF] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1B335D] sm:text-sm">
                        WhatsApp
                      </label>
                      <input
                        value={regWhatsapp}
                        onChange={(e) => setRegWhatsapp(e.target.value)}
                        placeholder="358..."
                        className="mt-1.5 w-full rounded-xl border border-[#0099D8]/30 bg-[#F4F9FC] px-4 py-2.5 text-sm text-[#1B335D] placeholder:text-[#1B335D]/40 focus:border-[#0099D8] focus:bg-[#FFFFFF] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1B335D] sm:text-sm">
                        Obra Social / Prepaga
                      </label>
                      <input
                        value={regObraSocial}
                        onChange={(e) => setRegObraSocial(e.target.value)}
                        placeholder="APROSS, OSDE, PAMI, Particular..."
                        className="mt-1.5 w-full rounded-xl border border-[#0099D8]/30 bg-[#F4F9FC] px-4 py-2.5 text-sm text-[#1B335D] placeholder:text-[#1B335D]/40 focus:border-[#0099D8] focus:bg-[#FFFFFF] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1B335D] sm:text-sm">
                        Nº de Afiliado
                      </label>
                      <input
                        value={regNroAfiliado}
                        onChange={(e) => setRegNroAfiliado(e.target.value)}
                        placeholder="Opcional"
                        className="mt-1.5 w-full rounded-xl border border-[#0099D8]/30 bg-[#F4F9FC] px-4 py-2.5 text-sm text-[#1B335D] placeholder:text-[#1B335D]/40 focus:border-[#0099D8] focus:bg-[#FFFFFF] focus:outline-none"
                      />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#57B7B8]/40 bg-[#F0FBF9] px-3.5 py-2.5 text-xs font-bold text-[#1B335D] sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={regPlus}
                        onChange={(e) => setRegPlus(e.target.checked)}
                      />
                      Soy afiliado/a a CEMEP Plus
                    </label>
                    <div>
                      <label className="block text-xs font-semibold text-[#1B335D] sm:text-sm">
                        Correo electrónico *
                      </label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="tucorreo@ejemplo.com"
                        className="mt-1.5 w-full rounded-xl border border-[#0099D8]/30 bg-[#F4F9FC] px-4 py-2.5 text-sm text-[#1B335D] placeholder:text-[#1B335D]/40 focus:border-[#0099D8] focus:bg-[#FFFFFF] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1B335D] sm:text-sm">
                        Contraseña *
                      </label>
                      <div className="relative mt-1.5">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          minLength={4}
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-xl border border-[#0099D8]/30 bg-[#F4F9FC] py-2.5 pr-11 pl-4 text-sm text-[#1B335D] placeholder:text-[#1B335D]/40 focus:border-[#0099D8] focus:bg-[#FFFFFF] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-pressed={showPassword}
                          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                          className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded-lg p-1 text-[#0099D8] hover:bg-[#0099D8]/10"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="mt-1 w-full cursor-pointer rounded-xl bg-[#1B335D] px-5 py-3.5 text-sm font-bold text-[#FFFFFF] shadow-md shadow-[#1B335D]/20 transition-all hover:bg-[#0A74A6] disabled:opacity-60 sm:col-span-2"
                    >
                      {busy ? "Creando cuenta..." : "Registrarme"}
                    </button>
                  </form>

                  <div className="mt-4 flex items-center justify-between border-t border-[#1B335D]/15 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setMsg(null);
                        setAuthTab("login");
                      }}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[#0099D8] hover:underline"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Volver</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab("login");
                        setShowGoogleFallback(true);
                      }}
                      className="cursor-pointer text-xs font-semibold text-[#1B335D] underline underline-offset-4 hover:text-[#0099D8]"
                    >
                      Google
                    </button>
                  </div>
                </div>
              )}

              {/* 3. MODO RECUPERAR CONTRASEÑA */}
              {authTab === "recover" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#0099D8]/25 bg-[#F4F9FC] p-3.5 text-xs text-[#1B335D]">
                    <KeyRound className="mr-1.5 mb-0.5 inline h-4 w-4 text-[#0099D8]" />
                    Ingresá tu correo electrónico registrado y te generaremos un código automático de
                    6 dígitos para restablecer tu contraseña.
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
                      className="space-y-4"
                    >
                      <div>
                        <label
                          htmlFor="cemep-patient-recover-email"
                          className="block text-xs font-semibold text-[#1B335D] sm:text-sm"
                        >
                          Correo electrónico
                        </label>
                        <input
                          id="cemep-patient-recover-email"
                          type="email"
                          required
                          autoComplete="email"
                          spellCheck={false}
                          value={recEmail}
                          onChange={(e) => setRecEmail(e.target.value)}
                          placeholder="tucorreo@ejemplo.com"
                          className="mt-1.5 w-full rounded-xl border border-[#0099D8]/30 bg-[#F4F9FC] px-4 py-3 text-base text-[#1B335D] placeholder:text-[#1B335D]/40 focus:border-[#0099D8] focus:bg-[#FFFFFF] focus:outline-none sm:text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full cursor-pointer rounded-xl bg-[#1B335D] px-5 py-3.5 text-sm font-bold text-[#FFFFFF] shadow-md transition-colors hover:bg-[#0A74A6] disabled:opacity-60"
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
                      className="space-y-3.5"
                    >
                      <input
                        required
                        value={recCode}
                        onChange={(e) => setRecCode(e.target.value)}
                        placeholder="Código de 6 dígitos"
                        className="w-full rounded-xl border border-[#0099D8]/30 bg-[#F4F9FC] px-4 py-3 text-center text-lg font-black tracking-widest text-[#1B335D] focus:border-[#0099D8] focus:bg-[#FFFFFF] focus:outline-none"
                      />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={4}
                        value={recNewPass}
                        onChange={(e) => setRecNewPass(e.target.value)}
                        placeholder="Nueva contraseña (mín. 4 caracteres)"
                        className="w-full rounded-xl border border-[#0099D8]/30 bg-[#F4F9FC] px-4 py-3 text-sm text-[#1B335D] focus:border-[#0099D8] focus:bg-[#FFFFFF] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full cursor-pointer rounded-xl bg-[#1B335D] px-5 py-3.5 text-sm font-bold text-[#FFFFFF] shadow-md transition-colors hover:bg-[#0A74A6] disabled:opacity-60"
                      >
                        Confirmar nueva contraseña
                      </button>
                    </form>
                  )}

                  <div className="border-t border-[#1B335D]/15 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setMsg(null);
                        setAuthTab("login");
                      }}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[#0099D8] hover:underline"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Volver</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Navegación interna del paciente */}
              <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] pb-3">
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
                          ? "bg-[#1B335D] text-[#FFFFFF] shadow"
                          : "bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0]"
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
                    <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-3.5 text-xs font-semibold text-[#78350F]">
                      Completá tu <strong>DNI</strong> en «Mi Perfil» para vincular automáticamente
                      todos tus estudios médicos e historial de turnos de CEMEP.
                    </div>
                  )}
                  {bundle.estudios.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#CBD5E1] p-8 text-center">
                      <FileHeart className="mx-auto h-10 w-10 text-[#CBD5E1]" />
                      <h3 className="mt-2 text-base font-extrabold text-[#1B335D]">
                        Aún no tenés estudios cargados
                      </h3>
                      <p className="mt-1 text-xs text-[#64748B]">
                        Cuando tu profesional cargue ecografías, laboratorios, informes cardiológicos
                        o resultados de circuito, aparecerán aquí para ver y descargar.
                      </p>
                    </div>
                  ) : (
                    bundle.estudios.map((est) => (
                      <div
                        key={est.id}
                        className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-[#0099D8]/15 px-2.5 py-0.5 text-[11px] font-extrabold text-[#0A74A6]">
                                {est.tipoEstudio}
                              </span>
                              <span className="text-xs font-semibold text-[#64748B]">
                                {est.fechaEstudio}
                              </span>
                            </div>
                            <h4 className="mt-1 text-base font-extrabold text-[#1B335D]">
                              {est.titulo}
                            </h4>
                            <p className="text-xs text-[#475569]">
                              Profesional: <strong>{est.profesionalNombre}</strong>
                              {est.especialidadNombre ? ` · ${est.especialidadNombre}` : ""}
                            </p>
                          </div>
                          {est.archivoDataUrl && (
                            <a
                              href={est.archivoDataUrl}
                              download={est.archivoNombre || `${est.titulo}.pdf`}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B335D] px-3.5 py-2 text-xs font-extrabold text-[#FFFFFF] hover:bg-[#0A74A6]"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Descargar estudio
                            </a>
                          )}
                        </div>
                        {est.descripcionInforme && (
                          <p className="mt-2.5 whitespace-pre-wrap rounded-xl bg-[#FFFFFF] p-3 text-xs leading-relaxed text-[#334155]">
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
                      <label className="mb-1 block text-xs font-bold text-[#334155]">
                        Medicamento/s y dosis *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={recMeds}
                        onChange={(e) => setRecMeds(e.target.value)}
                        placeholder="Ej: Enalapril 10mg x 30 comp., Metformina 850mg..."
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[#334155]">
                        Profesional tratante (opcional)
                      </label>
                      <input
                        value={recProf}
                        onChange={(e) => setRecProf(e.target.value)}
                        placeholder="Ej: Dra. Lucrecia Valdatta"
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-[#334155]">
                          Obra Social
                        </label>
                        <input
                          value={recOs}
                          onChange={(e) => setRecOs(e.target.value)}
                          className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-[#334155]">
                          Nº Afiliado
                        </label>
                        <input
                          value={recAfiliado}
                          onChange={(e) => setRecAfiliado(e.target.value)}
                          className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[#334155]">
                        Diagnóstico / Observaciones
                      </label>
                      <input
                        value={recNotas}
                        onChange={(e) => setRecNotas(e.target.value)}
                        placeholder="Tratamiento habitual, renovación mensual..."
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full cursor-pointer rounded-xl bg-[#1B335D] py-2.5 text-xs font-extrabold text-[#FFFFFF] hover:bg-[#0A74A6]"
                    >
                      {busy ? "Enviando..." : "Enviar solicitud de receta"}
                    </button>
                  </form>

                  <div className="space-y-3 lg:col-span-3">
                    <h3 className="text-sm font-black text-[#1B335D]">
                      Historial de Recetas Digitales
                    </h3>
                    {bundle.recetas.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#CBD5E1] p-6 text-center text-xs text-[#64748B]">
                        Todavía no solicitaste recetas digitales. Usá el formulario de la izquierda
                        para pedir una renovación o emisión.
                      </div>
                    ) : (
                      bundle.recetas.map((r) => {
                        const badge = recetaEstadoBadge(r.estado);
                        return (
                          <div
                            key={r.id}
                            className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-black text-[#1B335D]">{r.codigo}</span>
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${badge.cls}`}
                              >
                                {badge.label}
                              </span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-xs font-semibold text-[#1E293B]">
                              {r.medicamentosSolicitados}
                            </p>
                            <div className="mt-1.5 text-[11px] text-[#64748B]">
                              {r.obraSocialNombre}
                              {r.profesionalNombre ? ` · ${r.profesionalNombre}` : ""} ·{" "}
                              {r.createdAt.slice(0, 10)}
                            </div>
                            {r.observacionesAdmin && (
                              <div className="mt-2 rounded-xl bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155]">
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
                                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#059669] px-3.5 py-2 text-xs font-extrabold text-[#FFFFFF] hover:bg-[#047857]"
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
                    <p className="text-xs text-[#475569]">
                      Turnos vinculados en tiempo real con el Turnero Web de CEMEP.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onJumpToTurnero();
                      }}
                      className="cursor-pointer rounded-xl bg-[#0099D8] px-4 py-2 text-xs font-extrabold text-[#FFFFFF] hover:bg-[#0A74A6]"
                    >
                      + Sacar Nuevo Turno Online
                    </button>
                  </div>
                  {bundle.turnos.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#CBD5E1] p-8 text-center text-xs text-[#64748B]">
                      No encontramos turnos asociados a tu DNI o correo todavía.
                    </div>
                  ) : (
                    bundle.turnos.map((t) => (
                      <div
                        key={t.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-4"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-[#1B335D] px-2 py-0.5 text-[11px] font-black text-[#FFFFFF]">
                              {t.fecha} · {t.horaInicio}
                            </span>
                            <span className="text-xs font-bold text-[#64748B]">{t.codigo}</span>
                          </div>
                          <div className="mt-1 text-sm font-extrabold text-[#1B335D]">
                            {t.especialidadNombre} — {t.profesionalNombre}
                          </div>
                          <div className="text-xs text-[#475569]">
                            Modalidad: {t.modalidad === "videollamada" ? "Videollamada" : "Presencial"} ·{" "}
                            {t.coberturaTipo === "particular"
                              ? "Particular"
                              : t.obraSocialNombre || "Obra Social"}
                          </div>
                        </div>
                        <span className="rounded-full bg-[#E0F2FE] px-3 py-1 text-xs font-extrabold uppercase text-[#1B335D]">
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
                    <label className="mb-1 block text-xs font-bold text-[#334155]">DNI</label>
                    <input
                      value={profDni}
                      onChange={(e) => setProfDni(e.target.value)}
                      className="w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#334155]">WhatsApp</label>
                    <input
                      value={profWhatsapp}
                      onChange={(e) => setProfWhatsapp(e.target.value)}
                      className="w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#334155]">Apellido/s</label>
                    <input
                      value={profApellidos}
                      onChange={(e) => setProfApellidos(e.target.value)}
                      className="w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#334155]">Nombre/s</label>
                    <input
                      value={profNombres}
                      onChange={(e) => setProfNombres(e.target.value)}
                      className="w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#334155]">Obra Social</label>
                    <input
                      value={profObraSocial}
                      onChange={(e) => setProfObraSocial(e.target.value)}
                      className="w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#334155]">Nº Afiliado</label>
                    <input
                      value={profNroAfiliado}
                      onChange={(e) => setProfNroAfiliado(e.target.value)}
                      className="w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-sm"
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
                    className="w-full cursor-pointer rounded-xl bg-[#1B335D] py-2.5 text-sm font-extrabold text-[#FFFFFF] hover:bg-[#0A74A6] sm:col-span-2"
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
