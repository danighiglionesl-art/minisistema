"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  Download,
  Fingerprint,
  History,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Satellite,
  ShieldCheck,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  ASISTENCIA_WHATSAPP_COUNTRIES,
  type AsistenciaEmployeeProfile,
  type AsistenciaSchedule,
  type AsistenciaShiftRecord,
  type AsistenciaWorkplaceGeo,
  type SafeAsistenciaEmployee,
} from "@/lib/erp/asistencia-types";

interface LocalidadItem {
  nombre: string;
  cp?: string;
}

export interface AsistenciaPwaClientProps {
  tenantSlug: string;
  fantasyName: string;
  businessName: string;
  primaryHex: string;
  accentHex: string;
  logoHorizontalUrl: string;
  defaultProvincia: string;
  defaultLocalidad: string;
  provincias: string[];
  localidadesPorProvincia: Record<string, LocalidadItem[]>;
}

interface PublicConfig {
  googleClientId: string;
  allowSelfRegistration: boolean;
  trackingIntervalSec: number;
  workplaceGeo: AsistenciaWorkplaceGeo;
}

interface GeoFixState {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  capturedAt: string;
}

interface QueuedTrackPoint {
  ts: string;
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
}

function base64UrlToUint8Array(base64url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

function arrayBufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function formatMinutesHM(totalMin: number): string {
  const abs = Math.abs(Math.round(totalMin));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatDurationSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function getDeviceShortLabel(): string {
  if (typeof navigator === "undefined") return "Dispositivo móvil";
  const ua = navigator.userAgent || "";
  if (/iPhone/i.test(ua)) return "iPhone (Face ID / Touch ID)";
  if (/iPad/i.test(ua)) return "iPad (Biometría)";
  if (/Android/i.test(ua)) return "Android (Huella / Rostro)";
  if (/Windows/i.test(ua)) return "Windows Hello";
  if (/Mac/i.test(ua)) return "Mac (Touch ID)";
  return "Dispositivo Biométrico";
}

function detectPlatformBiometrics(): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    typeof PublicKeyCredential === "undefined" ||
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !==
      "function"
  ) {
    return Promise.resolve(false);
  }
  return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(
    () => false
  );
}

export default function AsistenciaPwaClient({
  tenantSlug,
  fantasyName,
  primaryHex,
  accentHex,
  logoHorizontalUrl,
  defaultProvincia,
  defaultLocalidad,
  provincias,
  localidadesPorProvincia,
}: AsistenciaPwaClientProps) {
  const apiUrl = `/api/asistencia?tenant=${encodeURIComponent(tenantSlug)}`;
  const queueKey = `ms_asist_track_queue_${tenantSlug}`;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; isErr: boolean } | null>(
    null
  );

  // Session & data
  const [employee, setEmployee] = useState<SafeAsistenciaEmployee | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [effectiveSchedule, setEffectiveSchedule] =
    useState<AsistenciaSchedule | null>(null);
  const [activeShift, setActiveShift] = useState<AsistenciaShiftRecord | null>(
    null
  );
  const [recentShifts, setRecentShifts] = useState<AsistenciaShiftRecord[]>([]);
  const [publicConfig, setPublicConfig] = useState<PublicConfig>({
    googleClientId: "",
    allowSelfRegistration: true,
    trackingIntervalSec: 60,
    workplaceGeo: {
      enabled: false,
      label: "Sede Principal",
      lat: null,
      lng: null,
      radiusMeters: 150,
    },
  });
  const [lastCompletedShift, setLastCompletedShift] =
    useState<AsistenciaShiftRecord | null>(null);

  // Navigation tabs (when logged in & profile complete)
  const [activeTab, setActiveTab] = useState<"fichar" | "historial" | "datos">(
    "fichar"
  );

  // Login state
  const [loginMode, setLoginMode] = useState<"google" | "email" | "empresa">(
    "google"
  );
  const [emailIsRegister, setEmailIsRegister] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [empresaPassInput, setEmpresaPassInput] = useState("");
  const [googleFallbackEmail, setGoogleFallbackEmail] = useState("");
  const [googleFallbackName, setGoogleFallbackName] = useState("");
  const googleBtnRef = useRef<HTMLDivElement | null>(null);

  // PWA install prompt
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosInstallTip, setShowIosInstallTip] = useState(false);

  // Profile form state (all mandatory fields)
  const [prof, setProf] = useState<AsistenciaEmployeeProfile>({
    apellidos: "",
    nombres: "",
    nombreCompleto: "",
    dni: "",
    fechaNacimiento: "",
    whatsappPais: "Argentina",
    whatsappPrefijo: "+549",
    whatsappNumero: "",
    whatsappCompleto: "",
    calle: "",
    numero: "",
    piso: "",
    dpto: "",
    torre: "",
    barrio: "",
    provincia: defaultProvincia || "CÓRDOBA",
    localidad: defaultLocalidad || "RÍO CUARTO",
    domicilioCompleto: "",
    whatsappUrgenciasPais: "Argentina",
    whatsappUrgenciasPrefijo: "+549",
    whatsappUrgenciasNumero: "",
    whatsappUrgenciasCompleto: "",
    whatsappUrgenciasContacto: "",
  });

  // Biometric & GPS live state
  const [platformBioAvailable, setPlatformBioAvailable] = useState<
    boolean | null
  >(null);
  const [geoFix, setGeoFix] = useState<GeoFixState | null>(null);
  const [geoStatus, setGeoStatus] = useState<
    "idle" | "locating" | "locked" | "error"
  >("idle");
  const [geoError, setGeoError] = useState("");
  const [trackingStats, setTrackingStats] = useState<{
    points: number;
    distanceKm: number;
    lastPingAt: string | null;
    queuedCount: number;
  }>({ points: 0, distanceKm: 0, lastPingAt: null, queuedCount: 0 });

  // Live clock & shift timer
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Live Facial Biometric Fallback Modal (only when device lacks platform WebAuthn hardware)
  const [faceModal, setFaceModal] = useState<{
    open: boolean;
    purpose: "enroll" | "checkin" | "checkout";
    challenge: string;
    resolve?: (payload: Record<string, unknown> | null) => void;
  }>({ open: false, purpose: "checkin", challenge: "" });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [faceError, setFaceError] = useState("");
  const [faceReady, setFaceReady] = useState(false);

  // Refs for continuous tracking
  const watchIdRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<any>(null);
  const latestGeoRef = useRef<GeoFixState | null>(null);
  const lastSentAtRef = useRef<number>(0);

  const showMsg = useCallback((text: string, isErr = false) => {
    setToast({ text, isErr });
  }, []);

  // Register Service Worker & PWA install handler
  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ua = navigator.userAgent || "";
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    if (isIos && !standalone) {
      setShowIosInstallTip(true);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/asistencia/sw.js", { scope: "/asistencia" })
        .catch(() => {});
    }

    const onBeforeInstall = (ev: Event) => {
      ev.preventDefault();
      setDeferredInstallPrompt(ev);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    detectPlatformBiometrics().then((avail) => setPlatformBioAvailable(avail));

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  // 1-second clock tick
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const syncProfileFormFromEmployee = useCallback(
    (emp: SafeAsistenciaEmployee | null) => {
      if (!emp) return;
      const p = emp.profile || ({} as AsistenciaEmployeeProfile);
      setProf({
        apellidos: p.apellidos || "",
        nombres: p.nombres || "",
        nombreCompleto: p.nombreCompleto || "",
        dni: p.dni || "",
        fechaNacimiento: p.fechaNacimiento || "",
        whatsappPais: p.whatsappPais || "Argentina",
        whatsappPrefijo: p.whatsappPrefijo || "+549",
        whatsappNumero: p.whatsappNumero || "",
        whatsappCompleto: p.whatsappCompleto || "",
        calle: p.calle || "",
        numero: p.numero || "",
        piso: p.piso || "",
        dpto: p.dpto || "",
        torre: p.torre || "",
        barrio: p.barrio || "",
        provincia: p.provincia || defaultProvincia || "CÓRDOBA",
        localidad: p.localidad || defaultLocalidad || "",
        domicilioCompleto: p.domicilioCompleto || "",
        whatsappUrgenciasPais: p.whatsappUrgenciasPais || "Argentina",
        whatsappUrgenciasPrefijo: p.whatsappUrgenciasPrefijo || "+549",
        whatsappUrgenciasNumero: p.whatsappUrgenciasNumero || "",
        whatsappUrgenciasCompleto: p.whatsappUrgenciasCompleto || "",
        whatsappUrgenciasContacto: p.whatsappUrgenciasContacto || "",
      });
    },
    [defaultProvincia, defaultLocalidad]
  );

  const applyServerBundle = useCallback(
    (data: any) => {
      if (data.publicConfig) setPublicConfig(data.publicConfig);
      if (data.authenticated && data.employee) {
        setEmployee(data.employee);
        setMissingFields(Array.isArray(data.missingProfileFields) ? data.missingProfileFields : []);
        setEffectiveSchedule(data.effectiveSchedule || null);
        setActiveShift(data.activeShift || null);
        setRecentShifts(Array.isArray(data.recentShifts) ? data.recentShifts : []);
        syncProfileFormFromEmployee(data.employee);
        if (data.activeShift) {
          setTrackingStats((prev) => ({
            ...prev,
            points: data.activeShift.trackPoints?.length || 1,
            distanceKm: data.activeShift.totalDistanceKm || 0,
            lastPingAt: data.activeShift.lastPingAt || data.activeShift.checkInAt,
          }));
        }
      } else {
        setEmployee(null);
        setMissingFields([]);
        setEffectiveSchedule(null);
        setActiveShift(null);
        setRecentShifts([]);
      }
    },
    [syncProfileFormFromEmployee]
  );

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        applyServerBundle(data);
      }
    } catch {
      showMsg("No se pudo conectar con el servidor de Asistencia.", true);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, applyServerBundle, showMsg]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Google Identity Services initialization
  useEffect(() => {
    if (employee || loginMode !== "google" || !publicConfig.googleClientId) {
      return;
    }
    const scriptId = "ms-asist-google-gsi";
    const initGsi = () => {
      const g = (window as unknown as { google?: any }).google;
      if (!g?.accounts?.id || !googleBtnRef.current) return;
      g.accounts.id.initialize({
        client_id: publicConfig.googleClientId,
        callback: async (resp: { credential?: string }) => {
          if (!resp?.credential) return;
          setBusy(true);
          setToast(null);
          try {
            const r = await fetch(apiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "login_google",
                credential: resp.credential,
              }),
            });
            const d = await r.json();
            if (!d.ok) {
              showMsg(d.message || "Error al validar cuenta de Google.", true);
            } else {
              setLastCompletedShift(null);
              applyServerBundle(d);
              showMsg(d.message || "Sesión iniciada con Google.");
            }
          } catch {
            showMsg("Error de red al iniciar con Google.", true);
          } finally {
            setBusy(false);
          }
        },
      });
      googleBtnRef.current.innerHTML = "";
      g.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: 300,
        locale: "es",
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
      initGsi();
    }
  }, [employee, loginMode, publicConfig.googleClientId, apiUrl, applyServerBundle, showMsg]);

  // Geolocation helper: acquire fresh satellite fix
  const acquireFreshGeo = useCallback((): Promise<GeoFixState> => {
    return new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        reject(
          new Error(
            "Este navegador no soporta geoposición satelital (GPS)."
          )
        );
        return;
      }
      setGeoStatus("locating");
      setGeoError("");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const fix: GeoFixState = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy || 0),
            speed: pos.coords.speed,
            heading: pos.coords.heading,
            capturedAt: new Date(pos.timestamp || Date.now()).toISOString(),
          };
          latestGeoRef.current = fix;
          setGeoFix(fix);
          setGeoStatus("locked");
          resolve(fix);
        },
        (err) => {
          setGeoStatus("error");
          const msg =
            err.code === 1
              ? "Permiso de ubicación denegado. Activá el GPS y permití la ubicación para fichar."
              : err.code === 2
                ? "Señal satelital GPS no disponible. Movete a un espacio abierto o activá la ubicación de alta precisión."
                : "Tiempo de espera agotado al obtener señal GPS. Reintentá.";
          setGeoError(msg);
          reject(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15000,
        }
      );
    });
  }, []);

  // Auto-acquire GPS preview once user is logged in and profile is complete
  useEffect(() => {
    if (employee && !employee.mustCompleteProfile && geoStatus === "idle") {
      acquireFreshGeo().catch(() => {});
    }
  }, [employee, geoStatus, acquireFreshGeo]);

  // Offline queue helpers for continuous shift GPS tracking
  const readTrackQueue = useCallback((): QueuedTrackPoint[] => {
    try {
      const raw = localStorage.getItem(queueKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [queueKey]);

  const writeTrackQueue = useCallback(
    (pts: QueuedTrackPoint[]) => {
      try {
        localStorage.setItem(queueKey, JSON.stringify(pts.slice(-200)));
      } catch {}
      setTrackingStats((prev) => ({ ...prev, queuedCount: pts.length }));
    },
    [queueKey]
  );

  const flushTrackPoints = useCallback(
    async (extraPoint?: QueuedTrackPoint) => {
      const current = readTrackQueue();
      if (extraPoint) current.push(extraPoint);
      if (current.length === 0) return;

      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "track_point",
            points: current,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          writeTrackQueue([]);
          lastSentAtRef.current = Date.now();
          setTrackingStats({
            points: data.totalPoints ?? 0,
            distanceKm: data.totalDistanceKm ?? 0,
            lastPingAt: data.lastPingAt || new Date().toISOString(),
            queuedCount: 0,
          });
        } else {
          writeTrackQueue(current);
        }
      } catch {
        // Offline: keep buffered in localStorage for retry
        writeTrackQueue(current);
      }
    },
    [apiUrl, readTrackQueue, writeTrackQueue]
  );

  // Continuous satellite tracking while activeShift is running
  useEffect(() => {
    if (!employee || !activeShift || activeShift.status !== "active") {
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release?.().catch(() => {});
        wakeLockRef.current = null;
      }
      return;
    }

    const intervalMs = Math.max(15, publicConfig.trackingIntervalSec || 60) * 1000;

    // Request Screen Wake Lock so mobile browsers keep tracking reliably
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch {}
    };
    requestWakeLock();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
        flushTrackPoints();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onOnline = () => {
      flushTrackPoints();
    };
    window.addEventListener("online", onOnline);

    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const fix: GeoFixState = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy || 0),
            speed: pos.coords.speed,
            heading: pos.coords.heading,
            capturedAt: new Date(pos.timestamp || Date.now()).toISOString(),
          };
          latestGeoRef.current = fix;
          setGeoFix(fix);
          setGeoStatus("locked");

          if (Date.now() - lastSentAtRef.current >= intervalMs) {
            flushTrackPoints({
              ts: fix.capturedAt,
              lat: fix.lat,
              lng: fix.lng,
              accuracy: fix.accuracy,
              speed: fix.speed,
              heading: fix.heading,
            });
          }
        },
        () => {},
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 20000,
        }
      );
    }

    pingIntervalRef.current = setInterval(() => {
      const fix = latestGeoRef.current;
      if (fix) {
        flushTrackPoints({
          ts: new Date().toISOString(),
          lat: fix.lat,
          lng: fix.lng,
          accuracy: fix.accuracy,
          speed: fix.speed,
          heading: fix.heading,
        });
      } else {
        acquireFreshGeo()
          .then((fresh) =>
            flushTrackPoints({
              ts: fresh.capturedAt,
              lat: fresh.lat,
              lng: fresh.lng,
              accuracy: fresh.accuracy,
              speed: fresh.speed,
              heading: fresh.heading,
            })
          )
          .catch(() => {});
      }
    }, intervalMs);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release?.().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [
    employee,
    activeShift,
    publicConfig.trackingIntervalSec,
    flushTrackPoints,
    acquireFreshGeo,
  ]);

  // Facial biometric fallback camera modal lifecycle
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setFaceReady(false);
  }, []);

  useEffect(() => {
    if (!faceModal.open) {
      stopCameraStream();
      return;
    }
    setFaceError("");
    setFaceReady(false);
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: 480, height: 480 }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setFaceReady(true);
      })
      .catch(() => {
        setFaceError(
          "No se pudo acceder a la cámara frontal. Permití el acceso a la cámara o usá un teléfono con huella/Face ID."
        );
      });
    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [faceModal.open, stopCameraStream]);

  const requestFacialBiometricCapture = useCallback(
    (purpose: "enroll" | "checkin" | "checkout", challenge: string) => {
      return new Promise<Record<string, unknown> | null>((resolve) => {
        setFaceModal({ open: true, purpose, challenge, resolve });
      });
    },
    []
  );

  const handleConfirmFaceCapture = async () => {
    if (!videoRef.current || !faceReady) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas no disponible");
      ctx.drawImage(videoRef.current, 0, 0, 240, 240);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      const encoded = new TextEncoder().encode(`${faceModal.challenge}:${dataUrl}`);
      const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
      const captureHash = arrayBufferToBase64Url(hashBuf);
      const resolver = faceModal.resolve;
      setFaceModal({ open: false, purpose: "checkin", challenge: "" });
      stopCameraStream();
      resolver?.({
        method: "face_capture_verified",
        challenge: faceModal.challenge,
        captureHash,
        livenessConfirmed: true,
        deviceLabel: `${getDeviceShortLabel()} · Biometría Facial`,
      });
    } catch {
      setFaceError("Error al capturar biometría facial. Reintentá.");
    }
  };

  const handleCancelFaceModal = () => {
    const resolver = faceModal.resolve;
    setFaceModal({ open: false, purpose: "checkin", challenge: "" });
    stopCameraStream();
    resolver?.(null);
  };

  // Unified Biometric Verification Runner (WebAuthn Platform first, Facial Camera fallback if hardware unavailable)
  const runBiometricFlow = useCallback(
    async (
      purpose: "enroll" | "checkin" | "checkout"
    ): Promise<Record<string, unknown> | null> => {
      const chRes = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "biometric_challenge", purpose }),
      });
      const chData = await chRes.json();
      if (!chData.ok || !chData.challenge) {
        throw new Error(
          chData.message || "No se pudo iniciar la verificación biométrica."
        );
      }

      const canUseWebAuthn =
        (await detectPlatformBiometrics()) &&
        (purpose === "enroll" ||
          (Array.isArray(chData.allowCredentials) &&
            chData.allowCredentials.length > 0));

      if (canUseWebAuthn) {
        const challengeBytes = base64UrlToUint8Array(chData.challenge);

        if (purpose === "enroll") {
          const cred = (await navigator.credentials.create({
            publicKey: {
              challenge: challengeBytes as unknown as BufferSource,
              rp: {
                name: `${fantasyName} · Control de Asistencia`,
                id: window.location.hostname,
              },
              user: {
                id: base64UrlToUint8Array(chData.user.id) as unknown as BufferSource,
                name: chData.user.name,
                displayName: chData.user.displayName,
              },
              pubKeyCredParams: [
                { type: "public-key", alg: -7 },
                { type: "public-key", alg: -257 },
              ],
              authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required",
                residentKey: "preferred",
              },
              timeout: 60000,
              attestation: "none",
            },
          })) as PublicKeyCredential | null;

          if (!cred) {
            throw new Error("Verificación biométrica cancelada.");
          }
          const resp = cred.response as AuthenticatorAttestationResponse;
          return {
            method: "webauthn_platform",
            credentialId: arrayBufferToBase64Url(cred.rawId),
            clientDataJSON: arrayBufferToBase64Url(resp.clientDataJSON),
            deviceLabel: getDeviceShortLabel(),
          };
        }

        // Assertion for checkin / checkout
        const allowCredentials: PublicKeyCredentialDescriptor[] = (
          chData.allowCredentials as string[]
        ).map((id) => ({
          type: "public-key",
          id: base64UrlToUint8Array(id) as unknown as BufferSource,
          transports: ["internal"],
        }));

        const assertion = (await navigator.credentials.get({
          publicKey: {
            challenge: challengeBytes as unknown as BufferSource,
            rpId: window.location.hostname,
            allowCredentials,
            userVerification: "required",
            timeout: 60000,
          },
        })) as PublicKeyCredential | null;

        if (!assertion) {
          throw new Error("Verificación biométrica cancelada.");
        }
        const resp = assertion.response as AuthenticatorAssertionResponse;
        return {
          method: "webauthn_platform",
          credentialId: arrayBufferToBase64Url(assertion.rawId),
          clientDataJSON: arrayBufferToBase64Url(resp.clientDataJSON),
          authenticatorData: arrayBufferToBase64Url(resp.authenticatorData),
          signature: arrayBufferToBase64Url(resp.signature),
          deviceLabel: getDeviceShortLabel(),
        };
      }

      // Fallback to live facial capture when platform WebAuthn is unavailable
      return requestFacialBiometricCapture(purpose, chData.challenge);
    },
    [apiUrl, fantasyName, requestFacialBiometricCapture]
  );

  // Handlers: Login / Register
  const handleEmailSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: emailIsRegister ? "register_email" : "login_email",
          email: emailInput.trim(),
          password: passwordInput,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showMsg(data.message || "Error al autenticar.", true);
      } else {
        setLastCompletedShift(null);
        applyServerBundle(data);
        showMsg(data.message || "Sesión iniciada.");
      }
    } catch {
      showMsg("Error de conexión.", true);
    } finally {
      setBusy(false);
    }
  };

  const handleEmployerLogin = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login_username",
          username: usernameInput.trim(),
          password: empresaPassInput,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showMsg(data.message || "Credenciales inválidas.", true);
      } else {
        setLastCompletedShift(null);
        applyServerBundle(data);
        showMsg(data.message || "Sesión iniciada.");
      }
    } catch {
      showMsg("Error de conexión.", true);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleFallbackLogin = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!googleFallbackEmail.includes("@")) {
      showMsg("Ingresá tu correo de Google válido.", true);
      return;
    }
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login_google",
          fallbackEmail: googleFallbackEmail.trim(),
          fallbackName: googleFallbackName.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showMsg(data.message || "No se pudo iniciar con Google.", true);
      } else {
        setLastCompletedShift(null);
        applyServerBundle(data);
        showMsg(data.message || "Acceso con Google confirmado.");
      }
    } catch {
      showMsg("Error de conexión.", true);
    } finally {
      setBusy(false);
    }
  };

  // Handler: Save Mandatory Basic Profile
  const handleSaveProfile = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_profile",
          profile: prof,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showMsg(data.message || "Revisá los campos obligatorios.", true);
      } else {
        applyServerBundle(data);
        setActiveTab("fichar");
        showMsg(data.message || "Datos básicos guardados correctamente.");
      }
    } catch {
      showMsg("Error de conexión al guardar tus datos.", true);
    } finally {
      setBusy(false);
    }
  };

  // Handler: Enroll Biometrics
  const handleEnrollBiometrics = async () => {
    setBusy(true);
    setToast(null);
    try {
      const bioPayload = await runBiometricFlow("enroll");
      if (!bioPayload) {
        showMsg("Vinculación biométrica cancelada.", true);
        return;
      }
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "biometric_enroll",
          biometric: bioPayload,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showMsg(data.message || "No se pudo vincular la biometría.", true);
      } else {
        applyServerBundle(data);
        showMsg(data.message || "Biometría vinculada correctamente.");
      }
    } catch (err) {
      showMsg(
        err instanceof Error
          ? err.message
          : "No se pudo completar la vinculación biométrica.",
        true
      );
    } finally {
      setBusy(false);
    }
  };

  // Handler: Check-In (BOTH Biometrics + Satellite GPS together)
  const handleCheckIn = async () => {
    setBusy(true);
    setToast(null);
    try {
      // If not enrolled yet, enroll first seamlessly
      if (!employee?.biometrics?.enrolled) {
        const enrollPayload = await runBiometricFlow("enroll");
        if (!enrollPayload) {
          showMsg("Debés vincular tu biometría para registrar ingreso.", true);
          return;
        }
        const enrollRes = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "biometric_enroll",
            biometric: enrollPayload,
          }),
        });
        const enrollData = await enrollRes.json();
        if (!enrollData.ok) {
          showMsg(enrollData.message || "Error al vincular biometría.", true);
          return;
        }
        applyServerBundle(enrollData);
      }

      // Variable 1: Fresh high-accuracy Satellite GPS
      const freshGeo = await acquireFreshGeo();

      // Variable 2: Fresh Biometric Verification
      const bioPayload = await runBiometricFlow("checkin");
      if (!bioPayload) {
        showMsg("Ingreso cancelado: se requiere verificación biométrica.", true);
        return;
      }

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkin",
          geo: freshGeo,
          biometric: bioPayload,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showMsg(data.message || "No se pudo registrar el ingreso.", true);
      } else {
        writeTrackQueue([]);
        lastSentAtRef.current = Date.now();
        applyServerBundle(data);
        showMsg(data.message || "Ingreso registrado correctamente.");
      }
    } catch (err) {
      showMsg(
        err instanceof Error
          ? err.message
          : "Error al registrar presencia biométrica y satelital.",
        true
      );
    } finally {
      setBusy(false);
    }
  };

  // Handler: Check-Out & Mandatory Biometric Logout
  const handleCheckOutAndLogout = async () => {
    setBusy(true);
    setToast(null);
    try {
      // Flush any buffered offline points first
      await flushTrackPoints();

      // Variable 1: Closing Satellite GPS
      let closingGeo: GeoFixState;
      try {
        closingGeo = await acquireFreshGeo();
      } catch (e) {
        if (latestGeoRef.current) {
          closingGeo = latestGeoRef.current;
        } else {
          throw e;
        }
      }

      // Variable 2: Mandatory Biometric Verification for Logout
      const bioPayload = await runBiometricFlow("checkout");
      if (!bioPayload) {
        showMsg(
          "Para finalizar la jornada y desloguearte debés validar tus datos biométricos.",
          true
        );
        return;
      }

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout_and_logout",
          geo: closingGeo,
          biometric: bioPayload,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showMsg(data.message || "No se pudo finalizar la jornada.", true);
      } else {
        writeTrackQueue([]);
        setLastCompletedShift(data.completedShift || null);
        setEmployee(null);
        setActiveShift(null);
        setRecentShifts([]);
        showMsg(
          data.message || "Jornada finalizada con biometría y sesión cerrada."
        );
      }
    } catch (err) {
      showMsg(
        err instanceof Error
          ? err.message
          : "No se pudo completar el deslogueo biométrico.",
        true
      );
    } finally {
      setBusy(false);
    }
  };

  // Handler: Plain logout (only when NO active shift)
  const handlePlainLogout = async () => {
    if (activeShift) {
      showMsg(
        "Tenés una jornada laboral activa. Usá 'Finalizar Jornada y Desloguearse' aplicando tus datos biométricos.",
        true
      );
      setActiveTab("fichar");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      const data = await res.json();
      if (!data.ok) {
        showMsg(data.message || "No se pudo cerrar sesión.", true);
      } else {
        setEmployee(null);
        setActiveShift(null);
        setRecentShifts([]);
        showMsg("Sesión cerrada correctamente.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleInstallPwa = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => {});
    setDeferredInstallPrompt(null);
  };

  // Localidades filtered by selected Provincia
  const localidadesForProvincia = useMemo(() => {
    const provKey = (prof.provincia || "").toUpperCase();
    const list =
      localidadesPorProvincia[prof.provincia] ||
      localidadesPorProvincia[provKey] ||
      [];
    return list;
  }, [prof.provincia, localidadesPorProvincia]);

  // Live Argentina clock string
  const liveClockStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(nowTick));
    } catch {
      return "";
    }
  }, [nowTick]);

  const liveDateStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date(nowTick));
    } catch {
      return "";
    }
  }, [nowTick]);

  const activeElapsedSec = useMemo(() => {
    if (!activeShift?.checkInAt) return 0;
    return Math.max(
      0,
      Math.floor((nowTick - new Date(activeShift.checkInAt).getTime()) / 1000)
    );
  }, [activeShift, nowTick]);

  const mustFillProfile = Boolean(employee && employee.mustCompleteProfile);

  return (
    <div className="min-h-dvh bg-[#f2f7f9] text-[#112D3A] pb-12">
      {/* Top App Bar */}
      <header
        className="sticky top-0 z-30 border-b-2 shadow-sm"
        style={{ backgroundColor: primaryHex, borderColor: accentHex }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoHorizontalUrl}
              alt={fantasyName}
              className="h-9 w-auto rounded-md bg-white/95 px-2 py-1 object-contain"
            />
            <div className="min-w-0">
              <div
                className="text-[11px] font-extrabold uppercase tracking-wider truncate"
                style={{ color: accentHex }}
              >
                Control de Asistencia · PWA
              </div>
              <div className="text-sm font-bold text-white truncate">
                {fantasyName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isStandalone && deferredInstallPrompt && (
              <button
                type="button"
                onClick={handleInstallPwa}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold transition hover:opacity-90"
                style={{ backgroundColor: accentHex, color: "#112D3A" }}
              >
                <Download className="h-3.5 w-3.5" />
                Instalar
              </button>
            )}
            {employee && (
              <button
                type="button"
                onClick={handlePlainLogout}
                disabled={busy}
                title={
                  activeShift
                    ? "Finalizá tu jornada con biometría para salir"
                    : "Cerrar sesión"
                }
                className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-5">
        {/* iOS Install Tip */}
        {showIosInstallTip && !isStandalone && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#112D3A]/15 bg-white px-4 py-3 text-xs text-[#112D3A] shadow-sm">
            <span>
              <strong>Instalá la App en iPhone:</strong> tocá{" "}
              <span className="font-bold">Compartir</span> y luego{" "}
              <span className="font-bold">Agregar a pantalla de inicio</span>.
            </span>
            <button
              type="button"
              onClick={() => setShowIosInstallTip(false)}
              className="rounded-lg p-1 hover:bg-slate-100"
              aria-label="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Toast feedback */}
        {toast && (
          <div
            role="status"
            className={`mb-4 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm ${
              toast.isErr
                ? "border-rose-300 bg-rose-50 text-rose-900"
                : "border-emerald-300 bg-emerald-50 text-emerald-950"
            }`}
          >
            <div className="flex items-start gap-2.5">
              {toast.isErr ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              )}
              <span>{toast.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded-lg p-0.5 opacity-70 hover:opacity-100"
              aria-label="Cerrar notificación"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm border border-[#112D3A]/10">
            <RefreshCw className="mx-auto h-7 w-7 animate-spin text-[#112D3A]" />
            <p className="mt-3 text-sm font-semibold text-[#112D3A]/75">
              Iniciando App de Control de Asistencia...
            </p>
          </div>
        )}

        {/* ==================== 1. LOGIN SCREEN ==================== */}
        {!loading && !employee && (
          <div className="space-y-4">
            {/* Completed Shift Receipt Banner (after Biometric Check-Out & Logout) */}
            {lastCompletedShift && (
              <div className="rounded-3xl border-2 border-emerald-400 bg-emerald-50 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Jornada finalizada y sesión cerrada con biometría
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-4">
                  <div className="rounded-xl bg-white p-2.5 border border-emerald-200">
                    <div className="text-slate-500">Ingreso</div>
                    <div className="font-extrabold text-[#112D3A] text-sm">
                      {lastCompletedShift.checkInLocalTime} hs
                    </div>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 border border-emerald-200">
                    <div className="text-slate-500">Egreso</div>
                    <div className="font-extrabold text-[#112D3A] text-sm">
                      {lastCompletedShift.checkOutLocalTime} hs
                    </div>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 border border-emerald-200">
                    <div className="text-slate-500">Trabajado</div>
                    <div className="font-extrabold text-[#112D3A] text-sm">
                      {formatMinutesHM(lastCompletedShift.metrics.workedMinutes)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 border border-emerald-200">
                    <div className="text-slate-500">Recorrido GPS</div>
                    <div className="font-extrabold text-[#112D3A] text-sm">
                      {lastCompletedShift.totalDistanceKm.toFixed(2)} km
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-3xl bg-white shadow-lg border border-[#112D3A]/10">
              <div
                className="p-6 text-white"
                style={{ backgroundColor: primaryHex }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider"
                    style={{ backgroundColor: accentHex, color: "#112D3A" }}
                  >
                    <Fingerprint className="h-3.5 w-3.5" />
                    Biometría + GPS Satelital
                  </span>
                  <span className="text-xs font-bold text-white/80 tabular-nums">
                    {liveClockStr} hs
                  </span>
                </div>
                <h1 className="mt-3 text-2xl font-black tracking-tight">
                  Acceso de Empleados
                </h1>
                <p className="mt-1 text-sm text-white/80">
                  Ingresá con Google, tu correo electrónico o con el usuario y
                  contraseña gestionados por tu empleador.
                </p>
              </div>

              {/* 3 Auth Mode Tabs */}
              <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 p-1.5 gap-1">
                <button
                  type="button"
                  onClick={() => setLoginMode("google")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold transition ${
                    loginMode === "google"
                      ? "bg-[#112D3A] text-white shadow-sm"
                      : "text-[#112D3A]/75 hover:bg-white"
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMode("email")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold transition ${
                    loginMode === "email"
                      ? "bg-[#112D3A] text-white shadow-sm"
                      : "text-[#112D3A]/75 hover:bg-white"
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  Correo
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMode("empresa")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold transition ${
                    loginMode === "empresa"
                      ? "bg-[#112D3A] text-white shadow-sm"
                      : "text-[#112D3A]/75 hover:bg-white"
                  }`}
                >
                  <KeyRound className="h-4 w-4" />
                  Usuario Empresa
                </button>
              </div>

              <div className="p-6">
                {loginMode === "google" && (
                  <div className="space-y-4">
                    {publicConfig.googleClientId ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-3">
                        <p className="text-center text-sm text-slate-600">
                          Autenticate con tu cuenta de Google en un toque.
                        </p>
                        <div ref={googleBtnRef} className="min-h-[44px]" />
                      </div>
                    ) : (
                      <form
                        onSubmit={handleGoogleFallbackLogin}
                        className="space-y-3"
                      >
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
                          Ingresá con tu cuenta de Google. Si sos nuevo, luego
                          de ingresar completarás tus datos básicos obligatorios.
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#112D3A] mb-1">
                            Correo de Google (Gmail / Workspace)
                          </label>
                          <input
                            type="email"
                            required
                            autoComplete="email"
                            placeholder="nombre@gmail.com"
                            value={googleFallbackEmail}
                            onChange={(e) =>
                              setGoogleFallbackEmail(e.target.value)
                            }
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#112D3A] focus:ring-2 focus:ring-[#56D7A1]/40"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#112D3A] mb-1">
                            Nombre y Apellido (opcional si ya ingresaste antes)
                          </label>
                          <input
                            type="text"
                            autoComplete="name"
                            placeholder="Ej: Juan Pérez"
                            value={googleFallbackName}
                            onChange={(e) =>
                              setGoogleFallbackName(e.target.value)
                            }
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#112D3A] focus:ring-2 focus:ring-[#56D7A1]/40"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={busy}
                          className="w-full rounded-xl py-3 text-sm font-extrabold text-[#112D3A] shadow-sm transition hover:opacity-95 disabled:opacity-60"
                          style={{ backgroundColor: accentHex }}
                        >
                          {busy ? "Verificando..." : "Continuar con Google"}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {loginMode === "email" && (
                  <form onSubmit={handleEmailSubmit} className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-[#112D3A]">
                        {emailIsRegister
                          ? "Crear cuenta con correo"
                          : "Ingresar con correo electrónico"}
                      </span>
                      {publicConfig.allowSelfRegistration && (
                        <button
                          type="button"
                          onClick={() => setEmailIsRegister((v) => !v)}
                          className="text-xs font-bold text-[#112D3A] underline underline-offset-2"
                        >
                          {emailIsRegister
                            ? "Ya tengo cuenta"
                            : "Crear cuenta nueva"}
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#112D3A] mb-1">
                        Correo electrónico
                      </label>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="empleado@correo.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#112D3A] focus:ring-2 focus:ring-[#56D7A1]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#112D3A] mb-1">
                        Contraseña
                      </label>
                      <input
                        type="password"
                        required
                        minLength={4}
                        autoComplete={
                          emailIsRegister ? "new-password" : "current-password"
                        }
                        placeholder="Mínimo 4 caracteres"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#112D3A] focus:ring-2 focus:ring-[#56D7A1]/40"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-xl py-3 text-sm font-extrabold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                      style={{ backgroundColor: primaryHex }}
                    >
                      {busy
                        ? "Procesando..."
                        : emailIsRegister
                          ? "Registrarme y Continuar"
                          : "Ingresar con Correo"}
                    </button>
                  </form>
                )}

                {loginMode === "empresa" && (
                  <form onSubmit={handleEmployerLogin} className="space-y-3.5">
                    <div className="rounded-2xl border border-[#112D3A]/15 bg-[#f2f7f9] p-3 text-xs text-[#112D3A]/85">
                      Ingresá el <strong>usuario (o DNI)</strong> y la{" "}
                      <strong>contraseña</strong> asignados por el administrador
                      de tu empleador.
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#112D3A] mb-1">
                        Usuario o DNI
                      </label>
                      <input
                        type="text"
                        required
                        autoComplete="username"
                        placeholder="Ej: jperez o 35123456"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#112D3A] focus:ring-2 focus:ring-[#56D7A1]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#112D3A] mb-1">
                        Contraseña
                      </label>
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        placeholder="Contraseña gestionada por el empleador"
                        value={empresaPassInput}
                        onChange={(e) => setEmpresaPassInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#112D3A] focus:ring-2 focus:ring-[#56D7A1]/40"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-xl py-3 text-sm font-extrabold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                      style={{ backgroundColor: primaryHex }}
                    >
                      {busy ? "Ingresando..." : "Ingresar con Usuario Empresa"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 2. MANDATORY BASIC DATA GATE OR PROFILE TAB ==================== */}
        {!loading && employee && (mustFillProfile || activeTab === "datos") && (
          <div className="space-y-4">
            {!mustFillProfile && (
              <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-white p-1.5 shadow-sm border border-[#112D3A]/10">
                <button
                  type="button"
                  onClick={() => setActiveTab("fichar")}
                  className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold text-[#112D3A]/75 hover:bg-slate-50"
                >
                  <Fingerprint className="h-4 w-4" />
                  Asistencia
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("historial")}
                  className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold text-[#112D3A]/75 hover:bg-slate-50"
                >
                  <History className="h-4 w-4" />
                  Historial
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("datos")}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#112D3A] py-2.5 text-xs font-extrabold text-white shadow-sm"
                >
                  <UserRound className="h-4 w-4" />
                  Mis Datos
                </button>
              </div>
            )}

            <form
              onSubmit={handleSaveProfile}
              className="rounded-3xl bg-white p-6 shadow-md border border-[#112D3A]/10 space-y-5"
            >
              <div>
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-[#112D3A]" />
                  <h2 className="text-lg font-black text-[#112D3A]">
                    {mustFillProfile
                      ? "Datos Básicos Obligatorios"
                      : "Mis Datos Personales y Contacto"}
                  </h2>
                </div>
                {mustFillProfile ? (
                  <p className="mt-1 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    Completá <strong>todos los campos obligatorios</strong> para
                    habilitar el registro de asistencia biométrica y satelital.
                    {missingFields.length > 0 && (
                      <span className="block mt-1 opacity-90">
                        Pendientes: {missingFields.join(", ")}.
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-600">
                    Todos los campos son obligatorios para tu legajo de
                    asistencia. Si un dato de domicilio (Piso, Dpto. o Torre) no
                    aplica, indicá <strong>-</strong> o <strong>PB</strong>.
                  </p>
                )}
              </div>

              {/* Identificación personal */}
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-[#112D3A] mb-1">
                    Apellido/s *
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="family-name"
                    value={prof.apellidos}
                    onChange={(e) =>
                      setProf((p) => ({ ...p, apellidos: e.target.value }))
                    }
                    placeholder="Ej: González"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#112D3A] focus:ring-2 focus:ring-[#56D7A1]/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#112D3A] mb-1">
                    Nombre/s *
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="given-name"
                    value={prof.nombres}
                    onChange={(e) =>
                      setProf((p) => ({ ...p, nombres: e.target.value }))
                    }
                    placeholder="Ej: María Laura"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#112D3A] focus:ring-2 focus:ring-[#56D7A1]/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#112D3A] mb-1">
                    DNI *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    minLength={6}
                    value={prof.dni}
                    onChange={(e) =>
                      setProf((p) => ({
                        ...p,
                        dni: e.target.value.replace(/\D/g, "").slice(0, 12),
                      }))
                    }
                    placeholder="Sin puntos (ej: 35123456)"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#112D3A] focus:ring-2 focus:ring-[#56D7A1]/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#112D3A] mb-1">
                    Fecha de Nacimiento *
                  </label>
                  <input
                    type="date"
                    required
                    autoComplete="bday"
                    value={prof.fechaNacimiento}
                    onChange={(e) =>
                      setProf((p) => ({
                        ...p,
                        fechaNacimiento: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#112D3A] focus:ring-2 focus:ring-[#56D7A1]/40"
                  />
                </div>
              </div>

              {/* WhatsApp personal con desplegable de país */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#112D3A]">
                  <Phone className="h-3.5 w-3.5" />
                  WhatsApp Personal *
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Código de País *
                    </label>
                    <select
                      required
                      value={prof.whatsappPrefijo}
                      onChange={(e) => {
                        const chosen = ASISTENCIA_WHATSAPP_COUNTRIES.find(
                          (c) => c.prefix === e.target.value
                        );
                        setProf((p) => ({
                          ...p,
                          whatsappPrefijo: e.target.value,
                          whatsappPais: chosen?.country || p.whatsappPais,
                        }));
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#112D3A]"
                    >
                      {ASISTENCIA_WHATSAPP_COUNTRIES.map((c) => (
                        <option key={c.prefix} value={c.prefix}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Número (sin 0 ni 15) *
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      required
                      minLength={6}
                      value={prof.whatsappNumero}
                      onChange={(e) =>
                        setProf((p) => ({
                          ...p,
                          whatsappNumero: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      placeholder="Ej: 3585095475"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#112D3A]"
                    />
                  </div>
                </div>
              </div>

              {/* Domicilio completo obligatorio */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#112D3A]">
                  <MapPin className="h-3.5 w-3.5" />
                  Domicilio Completo *
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-bold text-[#112D3A] mb-1">
                      Calle *
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="street-address"
                      value={prof.calle}
                      onChange={(e) =>
                        setProf((p) => ({ ...p, calle: e.target.value }))
                      }
                      placeholder="Nombre de la calle"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#112D3A]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#112D3A] mb-1">
                      Número *
                    </label>
                    <input
                      type="text"
                      required
                      value={prof.numero}
                      onChange={(e) =>
                        setProf((p) => ({ ...p, numero: e.target.value }))
                      }
                      placeholder="Ej: 450 o S/N"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#112D3A]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#112D3A] mb-1">
                      Piso *
                    </label>
                    <input
                      type="text"
                      required
                      value={prof.piso}
                      onChange={(e) =>
                        setProf((p) => ({ ...p, piso: e.target.value }))
                      }
                      placeholder="Ej: PB, 2 o -"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#112D3A]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#112D3A] mb-1">
                      Dpto. *
                    </label>
                    <input
                      type="text"
                      required
                      value={prof.dpto}
                      onChange={(e) =>
                        setProf((p) => ({ ...p, dpto: e.target.value }))
                      }
                      placeholder="Ej: B o -"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#112D3A]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#112D3A] mb-1">
                      Torre *
                    </label>
                    <input
                      type="text"
                      required
                      value={prof.torre}
                      onChange={(e) =>
                        setProf((p) => ({ ...p, torre: e.target.value }))
                      }
                      placeholder="Ej: 1, Norte o -"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#112D3A]"
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <label className="block text-xs font-bold text-[#112D3A] mb-1">
                      Barrio *
                    </label>
                    <input
                      type="text"
                      required
                      value={prof.barrio}
                      onChange={(e) =>
                        setProf((p) => ({ ...p, barrio: e.target.value }))
                      }
                      placeholder="Ej: Centro, Alberdi, Banda Norte"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#112D3A]"
                    />
                  </div>

                  {/* Provincia desplegable */}
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-[#112D3A] mb-1">
                      Provincia *
                    </label>
                    <select
                      required
                      value={prof.provincia}
                      onChange={(e) => {
                        const nextProv = e.target.value;
                        const locs =
                          localidadesPorProvincia[nextProv] ||
                          localidadesPorProvincia[nextProv.toUpperCase()] ||
                          [];
                        setProf((p) => ({
                          ...p,
                          provincia: nextProv,
                          localidad: locs[0]?.nombre || "",
                        }));
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#112D3A]"
                    >
                      <option value="">Seleccioná una provincia...</option>
                      {provincias.map((pr) => (
                        <option key={pr} value={pr}>
                          {pr}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Localidad desplegable */}
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-[#112D3A] mb-1">
                      Localidad *
                    </label>
                    <select
                      required
                      value={prof.localidad}
                      onChange={(e) =>
                        setProf((p) => ({ ...p, localidad: e.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#112D3A]"
                    >
                      <option value="">Seleccioná una localidad...</option>
                      {localidadesForProvincia.map((loc) => (
                        <option key={loc.nombre} value={loc.nombre}>
                          {loc.nombre}
                        </option>
                      ))}
                      {prof.localidad &&
                        !localidadesForProvincia.some(
                          (l) => l.nombre === prof.localidad
                        ) && (
                          <option value={prof.localidad}>
                            {prof.localidad}
                          </option>
                        )}
                    </select>
                  </div>
                </div>
              </div>

              {/* WhatsApp para Urgencias */}
              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-rose-900">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  WhatsApp para Urgencias *
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Código de País *
                    </label>
                    <select
                      required
                      value={prof.whatsappUrgenciasPrefijo}
                      onChange={(e) => {
                        const chosen = ASISTENCIA_WHATSAPP_COUNTRIES.find(
                          (c) => c.prefix === e.target.value
                        );
                        setProf((p) => ({
                          ...p,
                          whatsappUrgenciasPrefijo: e.target.value,
                          whatsappUrgenciasPais:
                            chosen?.country || p.whatsappUrgenciasPais,
                        }));
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#112D3A]"
                    >
                      {ASISTENCIA_WHATSAPP_COUNTRIES.map((c) => (
                        <option key={c.prefix} value={c.prefix}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Número de WhatsApp de Urgencias *
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      required
                      minLength={6}
                      value={prof.whatsappUrgenciasNumero}
                      onChange={(e) =>
                        setProf((p) => ({
                          ...p,
                          whatsappUrgenciasNumero: e.target.value.replace(
                            /\D/g,
                            ""
                          ),
                        }))
                      }
                      placeholder="Ej: 3584112233"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#112D3A]"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nombre / Parentesco del contacto de urgencia (opcional)
                    </label>
                    <input
                      type="text"
                      value={prof.whatsappUrgenciasContacto || ""}
                      onChange={(e) =>
                        setProf((p) => ({
                          ...p,
                          whatsappUrgenciasContacto: e.target.value,
                        }))
                      }
                      placeholder="Ej: Carlos González (Padre / Pareja)"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#112D3A]"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-2xl py-3.5 text-sm font-extrabold text-[#112D3A] shadow-md transition hover:opacity-95 disabled:opacity-60"
                style={{ backgroundColor: accentHex }}
              >
                {busy
                  ? "Guardando datos..."
                  : mustFillProfile
                    ? "Guardar Datos Obligatorios y Continuar"
                    : "Actualizar Mis Datos"}
              </button>
            </form>
          </div>
        )}

        {/* ==================== 3. MAIN ATTENDANCE DASHBOARD ==================== */}
        {!loading && employee && !mustFillProfile && activeTab !== "datos" && (
          <div className="space-y-4">
            {/* Employee Navigation Tabs */}
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-white p-1.5 shadow-sm border border-[#112D3A]/10">
              <button
                type="button"
                onClick={() => setActiveTab("fichar")}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold transition ${
                  activeTab === "fichar"
                    ? "bg-[#112D3A] text-white shadow-sm"
                    : "text-[#112D3A]/75 hover:bg-slate-50"
                }`}
              >
                <Fingerprint className="h-4 w-4" />
                Asistencia
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("historial")}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold transition ${
                  activeTab === "historial"
                    ? "bg-[#112D3A] text-white shadow-sm"
                    : "text-[#112D3A]/75 hover:bg-slate-50"
                }`}
              >
                <History className="h-4 w-4" />
                Historial
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("datos")}
                className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold text-[#112D3A]/75 hover:bg-slate-50"
              >
                <UserRound className="h-4 w-4" />
                Mis Datos
              </button>
            </div>

            {activeTab === "fichar" && (
              <div className="space-y-4">
                {/* Clock & Employee Schedule Hero */}
                <div
                  className="rounded-3xl p-6 text-white shadow-lg"
                  style={{ backgroundColor: primaryHex }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-white/70">
                        {liveDateStr}
                      </div>
                      <div className="mt-1 text-4xl font-black tracking-tight tabular-nums">
                        {liveClockStr}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-extrabold text-white">
                        {employee.profile.nombreCompleto}
                      </div>
                      <div className="text-[11px] text-white/75">
                        DNI {employee.profile.dni}
                      </div>
                    </div>
                  </div>

                  {effectiveSchedule && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-white/10 px-3.5 py-2.5 text-xs">
                      <Clock
                        className="h-4 w-4 shrink-0"
                        style={{ color: accentHex }}
                      />
                      <span>
                        Horario asignado:{" "}
                        <strong>
                          {effectiveSchedule.horaIngreso} hs a{" "}
                          {effectiveSchedule.horaEgreso} hs
                        </strong>
                      </span>
                      <span className="ml-auto text-[11px] text-white/75">
                        Tolerancia: {effectiveSchedule.toleranciaIngresoMin} min
                      </span>
                    </div>
                  )}
                </div>

                {/* ACTIVE SHIFT LIVE TRACKING CARD */}
                {activeShift ? (
                  <div className="rounded-3xl border-2 border-emerald-400 bg-white p-6 shadow-md space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3.5 py-1.5 text-xs font-black text-emerald-900">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        JORNADA LABORAL ACTIVA
                      </span>
                      <span className="text-xs font-bold text-slate-600">
                        Ingreso: <strong>{activeShift.checkInLocalTime} hs</strong>
                      </span>
                    </div>

                    <div className="text-center py-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Tiempo transcurrido en jornada
                      </div>
                      <div className="mt-1 text-4xl font-black text-[#112D3A] tabular-nums">
                        {formatDurationSeconds(activeElapsedSec)}
                      </div>
                      {activeShift.metrics.lateArrivalMinutes > 0 && (
                        <span className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-900">
                          Llegada tarde: +{activeShift.metrics.lateArrivalMinutes} min
                        </span>
                      )}
                    </div>

                    {/* Live Satellite Tracking Telemetry */}
                    <div className="rounded-2xl border border-[#112D3A]/15 bg-[#f2f7f9] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-[#112D3A]">
                          <Navigation className="h-4 w-4 text-emerald-600" />
                          Seguimiento Satelital GPS Activo
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            acquireFreshGeo()
                              .then((f) =>
                                flushTrackPoints({
                                  ts: f.capturedAt,
                                  lat: f.lat,
                                  lng: f.lng,
                                  accuracy: f.accuracy,
                                  speed: f.speed,
                                  heading: f.heading,
                                })
                              )
                              .catch(() => {})
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-[#112D3A] border border-slate-200 hover:bg-slate-50"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Registrar punto
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-white p-2.5 border border-slate-200/80">
                          <div className="text-[11px] text-slate-500">Puntos Track</div>
                          <div className="text-base font-black text-[#112D3A]">
                            {trackingStats.points}
                          </div>
                        </div>
                        <div className="rounded-xl bg-white p-2.5 border border-slate-200/80">
                          <div className="text-[11px] text-slate-500">Recorrido</div>
                          <div className="text-base font-black text-[#112D3A]">
                            {trackingStats.distanceKm.toFixed(2)} km
                          </div>
                        </div>
                        <div className="rounded-xl bg-white p-2.5 border border-slate-200/80">
                          <div className="text-[11px] text-slate-500">Precisión GPS</div>
                          <div className="text-base font-black text-[#112D3A]">
                            {geoFix ? `±${geoFix.accuracy}m` : "Buscando..."}
                          </div>
                        </div>
                      </div>

                      {geoFix && (
                        <div className="text-[11px] text-slate-600 flex items-center justify-between">
                          <span>
                            Lat {geoFix.lat.toFixed(5)} · Lng {geoFix.lng.toFixed(5)}
                          </span>
                          {trackingStats.queuedCount > 0 && (
                            <span className="font-bold text-amber-700">
                              {trackingStats.queuedCount} en cola offline
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950">
                      Mantené la App abierta durante tu jornada para registrar el
                      track de recorrido. Al finalizar, presioná el botón de
                      egreso y validá nuevamente tus <strong>datos biométricos</strong>{" "}
                      para desloguearte.
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleCheckOutAndLogout}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-rose-600 py-4 text-sm font-black text-white shadow-lg transition hover:bg-rose-700 disabled:opacity-60"
                    >
                      <Fingerprint className="h-5 w-5" />
                      {busy
                        ? "Validando biometría y GPS..."
                        : "Finalizar Jornada y Desloguearse (Biometría + GPS)"}
                    </button>
                  </div>
                ) : (
                  /* CHECK-IN PANEL (DUAL VARIABLES: BIOMETRICS + SATELLITE GPS) */
                  <div className="rounded-3xl bg-white p-6 shadow-md border border-[#112D3A]/10 space-y-5">
                    <div>
                      <h2 className="text-lg font-black text-[#112D3A]">
                        Registrar Presencia (Ingreso)
                      </h2>
                      <p className="mt-1 text-xs text-slate-600">
                        El registro exige las <strong>dos variables juntas</strong>:
                        verificación biométrica y geoposición satelital activa.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {/* Variable 1: Biometría */}
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#112D3A] text-[#56D7A1]">
                              <Fingerprint className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-xs font-extrabold text-[#112D3A]">
                                1. Datos Biométricos
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {platformBioAvailable
                                  ? "Huella / Face ID del dispositivo"
                                  : "Verificación facial en vivo"}
                              </div>
                            </div>
                          </div>
                          {employee.biometrics?.enrolled ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                              Vinculado
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">
                              Sin vincular
                            </span>
                          )}
                        </div>

                        {!employee.biometrics?.enrolled ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={handleEnrollBiometrics}
                            className="w-full rounded-xl border border-[#112D3A] bg-white py-2 text-xs font-extrabold text-[#112D3A] hover:bg-slate-100"
                          >
                            Vincular Biometría Ahora
                          </button>
                        ) : (
                          <div className="text-[11px] font-semibold text-emerald-700">
                            ✓ Listo para validar identidad al ingresar y salir.
                          </div>
                        )}
                      </div>

                      {/* Variable 2: Geoposición Satelital */}
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#112D3A] text-[#56D7A1]">
                              <Satellite className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-xs font-extrabold text-[#112D3A]">
                                2. Geoposición Satelital
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {geoStatus === "locked" && geoFix
                                  ? `Señal GPS ±${geoFix.accuracy} m`
                                  : geoStatus === "locating"
                                    ? "Buscando satélites GPS..."
                                    : "GPS requerido"}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => acquireFreshGeo().catch(() => {})}
                            className="rounded-lg p-1.5 text-[#112D3A] hover:bg-slate-200/70"
                            title="Actualizar señal GPS"
                          >
                            <Compass className="h-4 w-4" />
                          </button>
                        </div>

                        {geoFix ? (
                          <div className="text-[11px] font-semibold text-emerald-700">
                            ✓ {geoFix.lat.toFixed(5)}, {geoFix.lng.toFixed(5)}
                          </div>
                        ) : (
                          <div className="text-[11px] font-semibold text-rose-700">
                            {geoError || "Tocá para activar ubicación GPS."}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleCheckIn}
                      className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-4 text-sm font-black text-[#112D3A] shadow-lg transition hover:opacity-95 disabled:opacity-60"
                      style={{ backgroundColor: accentHex }}
                    >
                      <Fingerprint className="h-5 w-5" />
                      {busy
                        ? "Capturando GPS y validando biometría..."
                        : "Iniciar Jornada Laboral (Biometría + GPS)"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ==================== HISTORY TAB ==================== */}
            {activeTab === "historial" && (
              <div className="rounded-3xl bg-white p-5 shadow-md border border-[#112D3A]/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-black text-[#112D3A]">
                    Mis Últimas Jornadas
                  </h2>
                  <button
                    type="button"
                    onClick={loadSession}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#112D3A] hover:bg-slate-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Actualizar
                  </button>
                </div>

                {recentShifts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    Todavía no tenés jornadas registradas.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {recentShifts.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-2xl border border-slate-200 p-3.5 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-[#112D3A] text-sm">
                            {s.fecha}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              s.status === "active"
                                ? "bg-emerald-100 text-emerald-800"
                                : s.metrics.lateArrivalMinutes > 0 ||
                                    s.metrics.earlyDepartureMinutes > 0
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {s.status === "active"
                              ? "En curso"
                              : s.metrics.overtimeMinutes > 0
                                ? `Extras +${formatMinutesHM(s.metrics.overtimeMinutes)}`
                                : s.metrics.lateArrivalMinutes > 0
                                  ? `Tarde +${s.metrics.lateArrivalMinutes}m`
                                  : "Completada"}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-slate-600">
                          <div>
                            Ingreso:{" "}
                            <strong className="text-[#112D3A]">
                              {s.checkInLocalTime}
                            </strong>
                          </div>
                          <div>
                            Egreso:{" "}
                            <strong className="text-[#112D3A]">
                              {s.checkOutLocalTime || "—"}
                            </strong>
                          </div>
                          <div>
                            Track:{" "}
                            <strong className="text-[#112D3A]">
                              {s.totalDistanceKm.toFixed(2)} km
                            </strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ==================== LIVE FACIAL BIOMETRIC FALLBACK MODAL ==================== */}
      {faceModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Verificación Biométrica Facial"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-[#112D3A]">
                <Fingerprint className="h-5 w-5 text-emerald-600" />
                Verificación Biométrica Facial
              </div>
              <button
                type="button"
                onClick={handleCancelFaceModal}
                className="rounded-lg p-1 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Este equipo no cuenta con lector nativo de huella/Face ID. Ubicá tu
              rostro centrado en la cámara frontal para validar tu presencia.
            </p>
            <div className="relative overflow-hidden rounded-2xl bg-[#112D3A] aspect-square">
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover scale-x-[-1]"
              />
              <div className="pointer-events-none absolute inset-6 rounded-full border-2 border-dashed border-[#56D7A1]/80" />
            </div>
            {faceError && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {faceError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelFaceModal}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-xs font-bold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!faceReady}
                onClick={handleConfirmFaceCapture}
                className="flex-1 rounded-xl py-2.5 text-xs font-extrabold text-[#112D3A] disabled:opacity-50"
                style={{ backgroundColor: accentHex }}
              >
                Confirmar Identidad
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
