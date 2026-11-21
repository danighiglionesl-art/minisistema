"use client";

import React, { useEffect, useMemo, useState } from "react";
import type {
  InmoClienteRecord,
  InmoContratoRecord,
  InmoCuotaContratoRecord,
} from "@/lib/erp/inmobiliaria-types";

interface PaisItem {
  id: number;
  nombre: string;
}

interface LocalidadItem {
  nombre: string;
  cp?: string;
}

const WHATSAPP_COUNTRIES = [
  { country: "Argentina", prefix: "+549", label: "🇦🇷 Argentina (+54 9)" },
  { country: "Uruguay", prefix: "+598", label: "🇺🇾 Uruguay (+598)" },
  { country: "Paraguay", prefix: "+595", label: "🇵🇾 Paraguay (+595)" },
  { country: "Chile", prefix: "+56", label: "🇨🇱 Chile (+56)" },
  { country: "Brasil", prefix: "+55", label: "🇧🇷 Brasil (+55)" },
  { country: "Bolivia", prefix: "+591", label: "🇧🇴 Bolivia (+591)" },
  { country: "Perú", prefix: "+51", label: "🇵🇪 Perú (+51)" },
  { country: "Colombia", prefix: "+57", label: "🇨🇴 Colombia (+57)" },
  { country: "España", prefix: "+34", label: "🇪🇸 España (+34)" },
  { country: "Estados Unidos / Canadá", prefix: "+1", label: "🇺🇸 EE.UU. / Canadá (+1)" },
  { country: "Italia", prefix: "+39", label: "🇮🇹 Italia (+39)" },
];

type SanitizedClient = Omit<
  InmoClienteRecord,
  "passwordHash" | "passwordPlainCompat" | "resetCode" | "resetCodeExpiresAt"
>;

export interface InmoClientPortalModalProps {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  fantasyName: string;
  primaryHex: string;
  accentHex: string;
  logo1x1Url?: string;
  googleClientId: string;
  defaultProvincia: string;
  defaultLocalidad: string;
  defaultCp: string;
  catalogs: {
    paises: PaisItem[];
    provincias: string[];
    localidadesPorProvincia: Record<string, LocalidadItem[]>;
  };
  loggedClient: SanitizedClient | null;
  loggedContracts: InmoContratoRecord[];
  onSessionUpdate: (client: SanitizedClient | null, contratos: InmoContratoRecord[]) => void;
}

function fmtMoney(val: number, moneda: "ARS" | "USD"): string {
  const n = Number(val || 0);
  if (moneda === "USD") return `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
  return `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

export default function InmoClientPortalModal(props: InmoClientPortalModalProps) {
  const [authTab, setAuthTab] = useState<"login" | "register" | "recover">("login");
  const [dashTab, setDashTab] = useState<"vigente" | "pasado" | "futuro" | "perfil">("vigente");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; isErr: boolean } | null>(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [googleEmailQuick, setGoogleEmailQuick] = useState("");
  const [showGoogleFallback, setShowGoogleFallback] = useState(false);

  // Recover form
  const [recEmail, setRecEmail] = useState("");
  const [recStep, setRecStep] = useState<1 | 2>(1);
  const [recCode, setRecCode] = useState("");
  const [recNewPass, setRecNewPass] = useState("");

  // Register / Profile form (mismos campos que el resto de portales + cascada localidad/provincia/WA)
  const [apellidos, setApellidos] = useState("");
  const [nombres, setNombres] = useState("");
  const [tipoDoc, setTipoDoc] = useState("DNI");
  const [nroDoc, setNroDoc] = useState("");
  const [cuitCuil, setCuitCuil] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("Soltero/a");
  const [nacionalidad, setNacionalidad] = useState("ARGENTINA");
  const [pais, setPais] = useState("ARGENTINA");
  const [provincia, setProvincia] = useState(props.defaultProvincia || "CÓRDOBA");
  const [localidad, setLocalidad] = useState(props.defaultLocalidad || "RÍO CUARTO");
  const [cp, setCp] = useState(props.defaultCp || "5800");
  const [domicilioCalle, setDomicilioCalle] = useState("");
  const [domicilioNumero, setDomicilioNumero] = useState("");
  const [domicilioPiso, setDomicilioPiso] = useState("");
  const [domicilioDpto, setDomicilioDpto] = useState("");
  const [domicilioBarrio, setDomicilioBarrio] = useState("");
  const [waCountryIdx, setWaCountryIdx] = useState(0);
  const [whatsappNumero, setWhatsappNumero] = useState("");
  const [telefonoAlternativo, setTelefonoAlternativo] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // Contrato seleccionado para ver PDF / Cuenta Corriente
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [payingCuotaId, setPayingCuotaId] = useState<string>("");

  // Sincronizar campos de perfil cuando hay cliente logueado
  useEffect(() => {
    if (!props.loggedClient) return;
    const c = props.loggedClient;
    setApellidos(c.apellidos || "");
    setNombres(c.nombres || "");
    setTipoDoc(c.tipoDoc || "DNI");
    setNroDoc(c.nroDoc || "");
    setCuitCuil(c.cuitCuil || "");
    setFechaNacimiento(c.fechaNacimiento || "");
    setEstadoCivil(c.estadoCivil || "Soltero/a");
    setNacionalidad(c.nacionalidad || "ARGENTINA");
    setPais(c.pais || "ARGENTINA");
    setProvincia(c.provincia || props.defaultProvincia || "CÓRDOBA");
    setLocalidad(c.localidad || props.defaultLocalidad || "RÍO CUARTO");
    setCp(c.cp || props.defaultCp || "5800");
    setDomicilioCalle(c.domicilioCalle || "");
    setDomicilioNumero(c.domicilioNumero || "");
    setDomicilioPiso(c.domicilioPiso || "");
    setDomicilioDpto(c.domicilioDpto || "");
    setDomicilioBarrio(c.domicilioBarrio || "");
    const wIdx = WHATSAPP_COUNTRIES.findIndex(
      (w) => w.prefix === c.whatsappPrefijo || w.country === c.whatsappPais
    );
    if (wIdx >= 0) setWaCountryIdx(wIdx);
    setWhatsappNumero(c.whatsappNumero || "");
    setTelefonoAlternativo(c.telefonoAlternativo || "");
  }, [props.loggedClient, props.defaultProvincia, props.defaultLocalidad, props.defaultCp]);

  const resolvedGoogleClientId =
    props.googleClientId ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    "384115038053-ktejh22ce4f9hkun4nba8qajnf3g0euh.apps.googleusercontent.com";

  // Precargar script oficial de Google Identity Services al abrir el modal
  useEffect(() => {
    if (!props.open || props.loggedClient || !resolvedGoogleClientId) return;
    const scriptId = "google-gsi-client";
    const initGsi = () => {
      const g = (window as any).google;
      if (!g?.accounts?.id) return;
      g.accounts.id.initialize({
        client_id: resolvedGoogleClientId,
        callback: async (resp: { credential?: string }) => {
          if (!resp?.credential) return;
          setBusy(true);
          setMsg(null);
          try {
            const res = await fetch(
              `/api/inmobiliaria?tenant=${encodeURIComponent(props.tenantSlug)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "client_google_login",
                  credential: resp.credential,
                }),
              }
            );
            const data = await res.json();
            if (res.ok && data.ok) {
              props.onSessionUpdate(data.client, data.contratos || []);
            } else {
              setMsg({ text: data.message || "Error con Google Sign-In.", isErr: true });
            }
          } finally {
            setBusy(false);
          }
        },
      });
    };

    if (!document.getElementById(scriptId)) {
      const s = document.createElement("script");
      s.id = scriptId;
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = initGsi;
      document.head.appendChild(s);
    } else {
      setTimeout(initGsi, 120);
    }
  }, [props.open, props.loggedClient, resolvedGoogleClientId, props.tenantSlug, props.onSessionUpdate]);

  // Flujo OAuth 2.0 oficial (igual que Campo Directo): abre selector de cuenta Google del navegador
  const handleGoogleOAuthPopup = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await new Promise<void>((resolve, reject) => {
        if ((window as any).google?.accounts?.oauth2) {
          resolve();
          return;
        }
        const existing = document.getElementById("google-gsi-client");
        if (existing) {
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", () => reject(new Error("No se pudo cargar Google Sign-In")), { once: true });
          setTimeout(() => {
            if ((window as any).google?.accounts?.oauth2) resolve();
            else reject(new Error("Google Identity Services no terminó de cargar."));
          }, 3000);
          return;
        }
        const s = document.createElement("script");
        s.id = "google-gsi-client";
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.defer = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("No se pudo cargar la librería de Google Sign-In."));
        document.head.appendChild(s);
      });

      const g = (window as any).google;
      if (!g?.accounts?.oauth2) {
        throw new Error("La librería de autenticación de Google no está disponible.");
      }

      const tokenClient = g.accounts.oauth2.initTokenClient({
        client_id: resolvedGoogleClientId,
        scope: "email profile openid",
        callback: async (tokenResponse: { access_token?: string; error?: string; error_description?: string }) => {
          if (tokenResponse?.error || !tokenResponse?.access_token) {
            setMsg({
              text:
                tokenResponse?.error_description ||
                "No se completó el inicio de sesión con Google.",
              isErr: true,
            });
            setBusy(false);
            return;
          }
          try {
            const res = await fetch(
              `/api/inmobiliaria?tenant=${encodeURIComponent(props.tenantSlug)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "client_google_login",
                  accessToken: tokenResponse.access_token,
                }),
              }
            );
            const data = await res.json();
            if (res.ok && data.ok) {
              props.onSessionUpdate(data.client, data.contratos || []);
            } else {
              setMsg({ text: data.message || "Error al validar tu cuenta de Google.", isErr: true });
            }
          } catch {
            setMsg({ text: "Error de conexión al validar tu cuenta de Google.", isErr: true });
          } finally {
            setBusy(false);
          }
        },
        error_callback: () => {
          setShowGoogleFallback(true);
          setMsg({
            text: "La ventana de Google fue cerrada o este dominio aún no está autorizado en Google Cloud Console (verificá https://www.minisistema.com.ar en Orígenes de JavaScript autorizados).",
            isErr: true,
          });
          setBusy(false);
        },
      });

      tokenClient.requestAccessToken({ prompt: "select_account" });
    } catch (err: any) {
      setMsg({
        text: err?.message || "No se pudo abrir el selector de cuentas de Google.",
        isErr: true,
      });
      setBusy(false);
    }
  };

  const localidadesDisponibles = useMemo(() => {
    if (pais !== "ARGENTINA") return [];
    return props.catalogs.localidadesPorProvincia[provincia] || [];
  }, [pais, provincia, props.catalogs.localidadesPorProvincia]);

  useEffect(() => {
    if (pais !== "ARGENTINA") return;
    const list = props.catalogs.localidadesPorProvincia[provincia] || [];
    if (list.length > 0 && !list.some((l) => l.nombre.toUpperCase() === localidad.toUpperCase())) {
      setLocalidad(list[0].nombre);
      if (list[0].cp) setCp(list[0].cp);
    }
  }, [pais, provincia, localidad, props.catalogs.localidadesPorProvincia]);

  if (!props.open) return null;

  const primary = props.primaryHex || "#1F1F1F";
  const accent = props.accentHex || "#FC8006";
  const inputCls =
    "w-full rounded-xl border border-[#1F1F1F]/20 bg-[#FFFFFF] px-3 py-2 text-xs font-medium text-[#1F1F1F] focus:border-[#FC8006] focus:outline-none";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/inmobiliaria?tenant=${encodeURIComponent(props.tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "client_login",
          email: loginEmail,
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg({ text: data.message || "Credenciales inválidas.", isErr: true });
      } else {
        props.onSessionUpdate(data.client, data.contratos || []);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/inmobiliaria?tenant=${encodeURIComponent(props.tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "client_google_login",
          googleEmail: googleEmailQuick,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg({ text: data.message || "No se pudo ingresar con Google.", isErr: true });
      } else {
        props.onSessionUpdate(data.client, data.contratos || []);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const wa = WHATSAPP_COUNTRIES[waCountryIdx] || WHATSAPP_COUNTRIES[0];
    try {
      const res = await fetch(`/api/inmobiliaria?tenant=${encodeURIComponent(props.tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "client_register",
          apellidos,
          nombres,
          tipoDoc,
          nroDoc,
          cuitCuil,
          fechaNacimiento,
          estadoCivil,
          nacionalidad,
          pais,
          provincia,
          localidad,
          cp,
          domicilioCalle,
          domicilioNumero,
          domicilioPiso,
          domicilioDpto,
          domicilioBarrio,
          whatsappPais: wa.country,
          whatsappPrefijo: wa.prefix,
          whatsappNumero,
          telefonoAlternativo,
          email: regEmail,
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg({ text: data.message || "No se pudo completar el registro.", isErr: true });
      } else {
        props.onSessionUpdate(data.client, data.contratos || []);
        setMsg({ text: data.message, isErr: false });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRecoverRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/inmobiliaria?tenant=${encodeURIComponent(props.tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "client_request_reset", email: recEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg({ text: data.message || "Correo no encontrado.", isErr: true });
      } else {
        setRecStep(2);
        setMsg({ text: data.message, isErr: false });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRecoverConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/inmobiliaria?tenant=${encodeURIComponent(props.tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "client_confirm_reset",
          email: recEmail,
          code: recCode,
          newPassword: recNewPass,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg({ text: data.message || "Código inválido.", isErr: true });
      } else {
        setAuthTab("login");
        setLoginEmail(recEmail);
        setRecStep(1);
        setMsg({ text: data.message, isErr: false });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const wa = WHATSAPP_COUNTRIES[waCountryIdx] || WHATSAPP_COUNTRIES[0];
    try {
      const res = await fetch(`/api/inmobiliaria?tenant=${encodeURIComponent(props.tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "client_update_profile",
          apellidos,
          nombres,
          tipoDoc,
          nroDoc,
          cuitCuil,
          fechaNacimiento,
          estadoCivil,
          nacionalidad,
          pais,
          provincia,
          localidad,
          cp,
          domicilioCalle,
          domicilioNumero,
          domicilioPiso,
          domicilioDpto,
          domicilioBarrio,
          whatsappPais: wa.country,
          whatsappPrefijo: wa.prefix,
          whatsappNumero,
          telefonoAlternativo,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        props.onSessionUpdate(data.client, props.loggedContracts);
        setMsg({ text: "Tus datos personales fueron actualizados correctamente.", isErr: false });
      } else {
        setMsg({ text: data.message || "Error al guardar datos.", isErr: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await fetch(`/api/inmobiliaria?tenant=${encodeURIComponent(props.tenantSlug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "client_logout" }),
    });
    props.onSessionUpdate(null, []);
    setMsg(null);
  };

  const handlePayCuotaSplit = async (contrato: InmoContratoRecord, cuota: InmoCuotaContratoRecord) => {
    setPayingCuotaId(cuota.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/inmobiliaria?tenant=${encodeURIComponent(props.tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "client_pay_cuota_split",
          contratoId: contrato.id,
          cuotaId: cuota.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg({ text: data.message || "No se pudo iniciar el pago.", isErr: true });
        return;
      }
      if (data.initPointUrl) {
        window.open(data.initPointUrl, "_blank", "noopener,noreferrer");
        setMsg({ text: data.message, isErr: false });
      } else if (data.contrato) {
        const nextList = props.loggedContracts.map((c) =>
          c.id === data.contrato.id ? data.contrato : c
        );
        props.onSessionUpdate(props.loggedClient, nextList);
        setMsg({ text: data.message, isErr: false });
      }
    } finally {
      setPayingCuotaId("");
    }
  };

  const openCompiledContractPrint = (ctr: InmoContratoRecord) => {
    const win = window.open("", "_blank", "width=900,height=780");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8"><title>${ctr.codigo} — ${ctr.titulo}</title></head><body style="padding:28px;">${
      ctr.contenidoCompiladoHtml || `<p>Contrato ${ctr.codigo}</p>`
    }<script>window.onload=function(){window.print();};</script></body></html>`);
    win.document.close();
  };

  const filteredContracts = props.loggedContracts.filter((c) => {
    if (dashTab === "vigente") return c.estado === "vigente";
    if (dashTab === "pasado") return c.estado === "pasado" || c.estado === "rescindido";
    if (dashTab === "futuro") return c.estado === "futuro";
    return false;
  });

  const activeContract =
    filteredContracts.find((c) => c.id === selectedContractId) || filteredContracts[0] || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#141414]/80 p-3 backdrop-blur-sm sm:p-5"
      onClick={props.onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border-2 bg-[#FFFFFF] shadow-2xl"
        style={{ borderColor: accent }}
      >
        <div
          className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-[#FFFFFF]"
          style={{ backgroundColor: primary }}
        >
          <div className="flex items-center gap-3">
            {props.logo1x1Url && (
              <img
                src={props.logo1x1Url}
                alt={props.fantasyName}
                className="h-10 w-10 rounded-full object-contain shrink-0"
              />
            )}
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider" style={{ color: accent }}>
                Portal de Arrendamientos · {props.fantasyName}
              </div>
              <h2 className="text-lg font-black">
                {props.loggedClient
                  ? `Hola, ${props.loggedClient.nombres} ${props.loggedClient.apellidos}`
                  : "Acceso a Clientes (Inquilinos y Propietarios)"}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {props.loggedClient && (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-[#FFFFFF]/30 px-3 py-1.5 text-xs font-extrabold text-[#FFFFFF] hover:bg-[#FFFFFF]/15"
              >
                Cerrar sesión
              </button>
            )}
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-xl bg-[#FFFFFF]/15 px-3.5 py-1.5 text-xs font-black text-[#FFFFFF] hover:bg-[#FFFFFF]/25"
            >
              ✕ Cerrar
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-7 space-y-5">
          {msg && (
            <div
              className="rounded-2xl border p-3.5 text-xs font-bold"
              style={{
                backgroundColor: msg.isErr ? "#fee2e2" : "#dcfce7",
                color: msg.isErr ? "#991b1b" : "#065f46",
                borderColor: msg.isErr ? "#f87171" : "#34d399",
              }}
            >
              {msg.isErr ? "⚠️ " : "✅ "}
              {msg.text}
            </div>
          )}

          {/* VISTA NO LOGUEADO: LOGIN (GOOGLE / EMAIL), REGISTRO COMPLETO Y RECUPERO */}
          {!props.loggedClient ? (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2 border-b border-[#1F1F1F]/10 pb-3">
                {[
                  { k: "login", l: "🔐 Iniciar Sesión" },
                  { k: "register", l: "📝 Crear Cuenta de Cliente" },
                  { k: "recover", l: "🔄 Recuperar Contraseña" },
                ].map((t) => (
                  <button
                    key={t.k}
                    type="button"
                    onClick={() => {
                      setAuthTab(t.k as any);
                      setMsg(null);
                    }}
                    className="rounded-xl px-4 py-2 text-xs font-black transition"
                    style={{
                      backgroundColor: authTab === t.k ? primary : "#f1f5f9",
                      color: authTab === t.k ? accent : "#1F1F1F",
                    }}
                  >
                    {t.l}
                  </button>
                ))}
              </div>

              {authTab === "login" && (
                <div className="grid gap-6 md:grid-cols-2">
                  <form onSubmit={handleLogin} className="space-y-3 rounded-2xl border border-[#1F1F1F]/12 p-5">
                    <h3 className="text-sm font-black text-[#1F1F1F]">Ingreso con Correo Electrónico</h3>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase text-[#1F1F1F]/70">
                        Correo Electrónico o DNI
                      </label>
                      <input
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="cliente@correo.com"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase text-[#1F1F1F]/70">
                        Contraseña
                      </label>
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Tu contraseña"
                        className={inputCls}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-xl py-2.5 text-sm font-black shadow"
                      style={{ backgroundColor: accent, color: primary }}
                    >
                      {busy ? "Ingresando..." : "Ingresar al Portal"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthTab("recover")}
                      className="block w-full text-center text-xs font-bold text-[#1F1F1F]/75 underline"
                    >
                      ¿Olvidaste tu contraseña? Recuperala acá
                    </button>
                  </form>

                  <div className="flex flex-col justify-between rounded-2xl border-2 border-[#FC8006]/50 bg-[#FAF8F6] p-5 space-y-4">
                    <div>
                      <h3 className="text-sm font-black text-[#1F1F1F]">
                        Ingreso Automático con Google
                      </h3>
                      <p className="mt-1 text-xs text-[#1F1F1F]/75">
                        Accedé en un clic con tu cuenta de Google para consultar contratos PDF, cuenta corriente y pagar tus alquileres con acreditación Split.
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleGoogleOAuthPopup}
                        className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border-2 border-[#1F1F1F]/15 bg-[#FFFFFF] px-4 py-3 text-xs font-black text-[#1F1F1F] shadow-sm transition hover:border-[#FC8006] hover:bg-[#FAF8F6] disabled:opacity-60"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="#4285F4"
                            d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                          />
                          <path
                            fill="#34A853"
                            d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                          />
                        </svg>
                        <span>{busy ? "Conectando con Google..." : "Continuar con Google"}</span>
                      </button>
                      {showGoogleFallback && (
                        <form onSubmit={handleGoogleQuickSubmit} className="space-y-2 pt-1">
                          <input
                            type="email"
                            required
                            value={googleEmailQuick}
                            onChange={(e) => setGoogleEmailQuick(e.target.value)}
                            placeholder="Ingresá tu cuenta @gmail.com"
                            className={inputCls}
                          />
                          <button
                            type="submit"
                            disabled={busy}
                            className="w-full rounded-xl py-2 text-xs font-black"
                            style={{ backgroundColor: primary, color: accent }}
                          >
                            Acceder con mi correo Google
                          </button>
                        </form>
                      )}
                    </div>

                    <div className="rounded-xl bg-[#1F1F1F] p-3 text-[11px] text-[#FFFFFF]/85">
                      <strong style={{ color: accent }}>¿Qué podés hacer en el portal?</strong>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5">
                        <li>Descargar PDFs de contratos vigentes, pasados y futuros.</li>
                        <li>Consultar duración, vencimientos y valores actualizados.</li>
                        <li>Revisar tu cuenta corriente y pagar online con Split automático (Propietario + Inmobiliaria).</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {authTab === "register" && (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">Apellido(s) *</label>
                      <input required value={apellidos} onChange={(e) => setApellidos(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">Nombre(s) *</label>
                      <input required value={nombres} onChange={(e) => setNombres(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">Tipo Doc. *</label>
                      <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)} className={inputCls}>
                        <option value="DNI">DNI</option>
                        <option value="CUIT">CUIT</option>
                        <option value="CUIL">CUIL</option>
                        <option value="Pasaporte">Pasaporte</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">N° Documento *</label>
                      <input required value={nroDoc} onChange={(e) => setNroDoc(e.target.value)} className={inputCls} placeholder="38123456" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">CUIT / CUIL</label>
                      <input value={cuitCuil} onChange={(e) => setCuitCuil(e.target.value)} className={inputCls} placeholder="20-38123456-7" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">Fecha de Nacimiento</label>
                      <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">Estado Civil</label>
                      <select value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value)} className={inputCls}>
                        <option>Soltero/a</option>
                        <option>Casado/a</option>
                        <option>Unión convivencial</option>
                        <option>Divorciado/a</option>
                        <option>Viudo/a</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">Nacionalidad</label>
                      <select value={nacionalidad} onChange={(e) => setNacionalidad(e.target.value)} className={inputCls}>
                        {props.catalogs.paises.map((p) => (
                          <option key={`n-${p.id}-${p.nombre}`} value={p.nombre}>{p.nombre}</option>
                        ))}
                      </select>
                    </div>

                    {/* Despliegue de País, Provincia, Localidad y CP */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">País *</label>
                      <select value={pais} onChange={(e) => setPais(e.target.value)} className={inputCls}>
                        {props.catalogs.paises.map((p) => (
                          <option key={`p-${p.id}-${p.nombre}`} value={p.nombre}>{p.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">Provincia *</label>
                      {pais === "ARGENTINA" ? (
                        <select value={provincia} onChange={(e) => setProvincia(e.target.value)} className={inputCls}>
                          {props.catalogs.provincias.map((pr) => (
                            <option key={pr} value={pr}>{pr}</option>
                          ))}
                        </select>
                      ) : (
                        <input value={provincia} onChange={(e) => setProvincia(e.target.value)} className={inputCls} />
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">Localidad *</label>
                      {pais === "ARGENTINA" && localidadesDisponibles.length > 0 ? (
                        <select
                          value={localidad}
                          onChange={(e) => {
                            setLocalidad(e.target.value);
                            const m = localidadesDisponibles.find((l) => l.nombre === e.target.value);
                            if (m?.cp) setCp(m.cp);
                          }}
                          className={inputCls}
                        >
                          {localidadesDisponibles.map((l, idx) => (
                            <option key={`${l.nombre}-${idx}`} value={l.nombre}>{l.nombre}</option>
                          ))}
                        </select>
                      ) : (
                        <input value={localidad} onChange={(e) => setLocalidad(e.target.value)} className={inputCls} />
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">Código Postal</label>
                      <input value={cp} onChange={(e) => setCp(e.target.value)} className={inputCls} />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-bold uppercase">Calle</label>
                      <input value={domicilioCalle} onChange={(e) => setDomicilioCalle(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">Número</label>
                      <input value={domicilioNumero} onChange={(e) => setDomicilioNumero(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">Barrio</label>
                      <input value={domicilioBarrio} onChange={(e) => setDomicilioBarrio(e.target.value)} className={inputCls} />
                    </div>

                    {/* País de WhatsApp + Número */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">País de WhatsApp *</label>
                      <select
                        value={waCountryIdx}
                        onChange={(e) => setWaCountryIdx(Number(e.target.value))}
                        className={inputCls}
                      >
                        {WHATSAPP_COUNTRIES.map((w, i) => (
                          <option key={w.prefix} value={i}>{w.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">N° WhatsApp *</label>
                      <input required value={whatsappNumero} onChange={(e) => setWhatsappNumero(e.target.value)} className={inputCls} placeholder="3585095475" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">Correo Electrónico *</label>
                      <input type="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase">Contraseña *</label>
                      <input type="password" required minLength={4} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className={inputCls} placeholder="Mín. 4 caracteres" />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl px-6 py-3 text-sm font-black shadow"
                    style={{ backgroundColor: accent, color: primary }}
                  >
                    {busy ? "Registrando..." : "Registrarme y Entrar al Portal"}
                  </button>
                </form>
              )}

              {authTab === "recover" && (
                <div className="max-w-md rounded-2xl border border-[#1F1F1F]/12 p-5 space-y-3">
                  <h3 className="text-sm font-black text-[#1F1F1F]">Recuperar Contraseña</h3>
                  {recStep === 1 ? (
                    <form onSubmit={handleRecoverRequest} className="space-y-3">
                      <p className="text-xs text-[#1F1F1F]/75">
                        Ingresá tu correo registrado y te enviaremos un código de 6 dígitos para crear una nueva contraseña.
                      </p>
                      <input
                        type="email"
                        required
                        value={recEmail}
                        onChange={(e) => setRecEmail(e.target.value)}
                        placeholder="tu-correo@ejemplo.com"
                        className={inputCls}
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full rounded-xl py-2.5 text-xs font-black"
                        style={{ backgroundColor: primary, color: accent }}
                      >
                        {busy ? "Enviando código..." : "Enviar código de recuperación"}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleRecoverConfirm} className="space-y-3">
                      <input
                        required
                        value={recCode}
                        onChange={(e) => setRecCode(e.target.value)}
                        placeholder="Código de 6 dígitos"
                        className={inputCls}
                      />
                      <input
                        type="password"
                        required
                        minLength={4}
                        value={recNewPass}
                        onChange={(e) => setRecNewPass(e.target.value)}
                        placeholder="Nueva contraseña"
                        className={inputCls}
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full rounded-xl py-2.5 text-xs font-black"
                        style={{ backgroundColor: accent, color: primary }}
                      >
                        Guardar nueva contraseña
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* VISTA LOGUEADO: CONTRATOS VIGENTES / PASADOS / FUTUROS, PDF, CTA CTE Y PAGO SPLIT */
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2 border-b border-[#1F1F1F]/10 pb-3">
                {[
                  {
                    k: "vigente",
                    l: `📄 Contratos Vigentes (${props.loggedContracts.filter((c) => c.estado === "vigente").length})`,
                  },
                  {
                    k: "pasado",
                    l: `🗂️ Contratos Pasados (${props.loggedContracts.filter((c) => c.estado === "pasado" || c.estado === "rescindido").length})`,
                  },
                  {
                    k: "futuro",
                    l: `🗓️ Contratos Futuros (${props.loggedContracts.filter((c) => c.estado === "futuro").length})`,
                  },
                  { k: "perfil", l: "👤 Mis Datos Personales" },
                ].map((t) => (
                  <button
                    key={t.k}
                    type="button"
                    onClick={() => setDashTab(t.k as any)}
                    className="rounded-xl px-4 py-2 text-xs font-black transition"
                    style={{
                      backgroundColor: dashTab === t.k ? primary : "#f1f5f9",
                      color: dashTab === t.k ? accent : "#1F1F1F",
                    }}
                  >
                    {t.l}
                  </button>
                ))}
              </div>

              {dashTab === "perfil" ? (
                <form onSubmit={handleUpdateProfile} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase">Apellidos</label>
                    <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase">Nombres</label>
                    <input value={nombres} onChange={(e) => setNombres(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase">DNI</label>
                    <input value={nroDoc} onChange={(e) => setNroDoc(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase">Provincia</label>
                    <select value={provincia} onChange={(e) => setProvincia(e.target.value)} className={inputCls}>
                      {props.catalogs.provincias.map((pr) => (
                        <option key={pr} value={pr}>{pr}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase">Localidad</label>
                    <select value={localidad} onChange={(e) => setLocalidad(e.target.value)} className={inputCls}>
                      {localidadesDisponibles.map((l, idx) => (
                        <option key={`${l.nombre}-${idx}`} value={l.nombre}>{l.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase">WhatsApp</label>
                    <input value={whatsappNumero} onChange={(e) => setWhatsappNumero(e.target.value)} className={inputCls} />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl px-5 py-2.5 text-xs font-black"
                      style={{ backgroundColor: accent, color: primary }}
                    >
                      💾 Guardar Mis Datos
                    </button>
                  </div>
                </form>
              ) : filteredContracts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#1F1F1F]/20 p-8 text-center text-sm text-[#1F1F1F]/70">
                  No tenés contratos registrados en esta categoría ({dashTab}). Cuando la inmobiliaria cargue tu contrato con tu DNI o correo, aparecerá automáticamente acá.
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredContracts.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {filteredContracts.map((ctr) => (
                        <button
                          key={ctr.id}
                          type="button"
                          onClick={() => setSelectedContractId(ctr.id)}
                          className="rounded-xl border px-3 py-1.5 text-xs font-extrabold"
                          style={{
                            borderColor: activeContract?.id === ctr.id ? accent : "#cbd5e1",
                            backgroundColor: activeContract?.id === ctr.id ? primary : "#fff",
                            color: activeContract?.id === ctr.id ? "#fff" : "#1F1F1F",
                          }}
                        >
                          {ctr.codigo} · {ctr.propiedadTitulo}
                        </button>
                      ))}
                    </div>
                  )}

                  {activeContract && (
                    <div className="space-y-4">
                      {/* Resumen del contrato + PDF */}
                      <div
                        className="rounded-2xl p-5 text-[#FFFFFF]"
                        style={{ backgroundColor: primary }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <span
                              className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase"
                              style={{ backgroundColor: accent, color: primary }}
                            >
                              {activeContract.codigo} · {activeContract.estado.toUpperCase()}
                            </span>
                            <h3 className="mt-1 text-lg font-black">{activeContract.titulo}</h3>
                            <div className="text-xs text-[#FFFFFF]/80">
                              📍 {activeContract.propiedadDireccion || activeContract.propiedadTitulo}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {activeContract.pdfUrl && (
                              <a
                                href={activeContract.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-xl px-4 py-2 text-xs font-black"
                                style={{ backgroundColor: accent, color: primary }}
                              >
                                📄 Descargar PDF Oficial
                              </a>
                            )}
                            {activeContract.contenidoCompiladoHtml && (
                              <button
                                type="button"
                                onClick={() => openCompiledContractPrint(activeContract)}
                                className="rounded-xl border border-[#FFFFFF]/30 bg-[#FFFFFF]/10 px-4 py-2 text-xs font-black text-[#FFFFFF]"
                              >
                                🖨️ Ver / Imprimir Contrato PDF
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                          <div className="rounded-xl bg-[#FFFFFF]/10 p-3">
                            <div className="opacity-75">Duración y Vigencia</div>
                            <div className="mt-0.5 font-black">
                              {activeContract.duracionMeses} meses ({activeContract.fechaInicio} → {activeContract.fechaFin})
                            </div>
                          </div>
                          <div className="rounded-xl bg-[#FFFFFF]/10 p-3">
                            <div className="opacity-75">Valor Mensual Actual</div>
                            <div className="mt-0.5 text-base font-black" style={{ color: accent }}>
                              {fmtMoney(activeContract.valorMensualActual, activeContract.moneda)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-[#FFFFFF]/10 p-3">
                            <div className="opacity-75">Actualización / Depósito</div>
                            <div className="mt-0.5 font-bold">
                              {activeContract.indiceAjuste} · {activeContract.mesDeposito}
                            </div>
                          </div>
                          <div className="rounded-xl bg-[#FFFFFF]/10 p-3">
                            <div className="opacity-75">Modalidad Split (ReikiOnline)</div>
                            <div className="mt-0.5 font-black" style={{ color: accent }}>
                              {activeContract.propietarioPct}% Propietario · {activeContract.inmobiliariaPct}% Inmobiliaria
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CUENTA CORRIENTE Y PAGOS CON SPLIT AUTOMÁTICO */}
                      <div className="rounded-2xl border border-[#1F1F1F]/15 p-4">
                        <h4 className="mb-3 text-sm font-black text-[#1F1F1F]">
                          💳 Cuenta Corriente y Pagos con Distribución Split Automática
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="border-b-2 border-[#FC8006] text-left">
                                <th className="p-2">Período</th>
                                <th className="p-2">Vencimiento</th>
                                <th className="p-2 text-right">Total</th>
                                <th className="p-2 text-right">Propietario ({activeContract.propietarioPct}%)</th>
                                <th className="p-2 text-right">Inmobiliaria ({activeContract.inmobiliariaPct}%)</th>
                                <th className="p-2">Estado</th>
                                <th className="p-2 text-right">Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeContract.cuotas.map((q) => (
                                <tr key={q.id} className="border-b border-[#1F1F1F]/10">
                                  <td className="p-2 font-bold">
                                    #{q.numeroCuota} · {q.concepto}
                                  </td>
                                  <td className="p-2">{q.vencimiento}</td>
                                  <td className="p-2 text-right font-black">
                                    {fmtMoney(q.montoTotal, q.moneda)}
                                  </td>
                                  <td className="p-2 text-right text-[#0f5d3f] font-bold">
                                    {fmtMoney(q.montoPropietario, q.moneda)}
                                  </td>
                                  <td className="p-2 text-right text-[#1F1F1F] font-bold">
                                    {fmtMoney(q.montoInmobiliaria, q.moneda)}
                                  </td>
                                  <td className="p-2">
                                    <span
                                      className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase"
                                      style={{
                                        backgroundColor:
                                          q.estado === "pagado"
                                            ? "#dcfce7"
                                            : q.estado === "vencido"
                                              ? "#fee2e2"
                                              : "#fef3c7",
                                        color:
                                          q.estado === "pagado"
                                            ? "#065f46"
                                            : q.estado === "vencido"
                                              ? "#991b1b"
                                              : "#92400e",
                                      }}
                                    >
                                      {q.estado}
                                    </span>
                                  </td>
                                  <td className="p-2 text-right">
                                    {q.estado === "pagado" ? (
                                      <span className="text-[11px] font-bold text-[#065f46]">
                                        ✅ {q.comprobanteRef || "Pagado"}
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={payingCuotaId === q.id}
                                        onClick={() => handlePayCuotaSplit(activeContract, q)}
                                        className="rounded-xl px-3 py-1.5 text-[11px] font-black shadow hover:brightness-95"
                                        style={{ backgroundColor: accent, color: primary }}
                                      >
                                        {payingCuotaId === q.id
                                          ? "Procesando..."
                                          : "💳 Pagar (Split MP)"}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
