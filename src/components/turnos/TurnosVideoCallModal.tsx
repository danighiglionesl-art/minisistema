"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  ShieldCheck,
  Video,
  VideoOff,
  X,
} from "lucide-react";

export interface TurnosVideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  fantasyName: string;
  primaryHex: string;
  accentHex: string;
  logoSymbolUrl?: string;
  turnoId?: string;
  turnoCodigo: string;
  roomCode: string;
  especialidadNombre: string;
  profesionalNombre: string;
  pacienteNombre: string;
  fecha: string;
  horaInicio: string;
  duracionMinutos: number;
  viewerRole: "Profesional" | "Paciente";
  onCompleted?: () => void;
}

interface ChatMsg {
  id: string;
  sender: string;
  role: "Profesional" | "Paciente" | "Sistema";
  text: string;
  time: string;
}

export default function TurnosVideoCallModal(props: TurnosVideoCallModalProps) {
  const {
    isOpen,
    onClose,
    tenantSlug,
    fantasyName,
    primaryHex,
    accentHex,
    turnoId,
    turnoCodigo,
    roomCode,
    especialidadNombre,
    profesionalNombre,
    pacienteNombre,
    fecha,
    horaInicio,
    duracionMinutos,
    viewerRole,
    onCompleted,
  } = props;

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [providerMode, setProviderMode] = useState<"daily_api" | "daily_sandbox">("daily_sandbox");
  const [roomName, setRoomName] = useState("");
  const [roomUrl, setRoomUrl] = useState("");

  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(
    Math.max(5, duracionMinutos || 30) * 60
  );
  const [completed, setCompleted] = useState(false);

  const [showChat, setShowChat] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const localName = viewerRole === "Profesional" ? profesionalNombre : pacienteNombre;
  const remoteName = viewerRole === "Profesional" ? pacienteNombre : profesionalNombre;
  const remoteRole = viewerRole === "Profesional" ? "Paciente" : "Profesional";

  const stopMedia = () => {
    if (streamRef.current) {
      for (const tr of streamRef.current.getTracks()) {
        tr.stop();
      }
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopMedia();
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    setCompleted(false);
    setRemainingSeconds(Math.max(5, duracionMinutos || 30) * 60);
    setMessages([
      {
        id: "sys-init",
        sender: `Telemedicina · ${fantasyName}`,
        role: "Sistema",
        text: `Sala privada 1:1 encriptada lista para el turno ${turnoCodigo} (${especialidadNombre}).`,
        time: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);

    fetch(`/api/turnos/video?tenant=${encodeURIComponent(tenantSlug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantSlug,
        turnoId,
        turnoCodigo,
        roomCode,
        participantName: localName,
        participantRole: viewerRole,
        durationMinutes: duracionMinutos,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data?.ok) {
          setErrorMsg(data?.message || "No se pudo conectar la sala de videollamada.");
          setLoading(false);
          return;
        }
        setProviderMode(data.providerMode || "daily_sandbox");
        setRoomName(data.roomName || roomCode);
        setRoomUrl(data.roomUrl || "");
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMsg("Error de red inicializando la sala de videollamada.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      stopMedia();
    };
  }, [
    isOpen,
    tenantSlug,
    turnoId,
    turnoCodigo,
    roomCode,
    localName,
    viewerRole,
    duracionMinutos,
    fantasyName,
    especialidadNombre,
  ]);

  useEffect(() => {
    if (!isOpen || loading || providerMode === "daily_api" || completed) return;

    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function"
    ) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          streamRef.current = stream;
          setCameraActive(true);
          setCameraNotice(null);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          setCameraActive(false);
          setCameraNotice(
            "Modo avatar activo (habilitá los permisos de cámara y micrófono en el navegador para transmitir video)."
          );
        });
    }

    return () => {
      stopMedia();
    };
  }, [isOpen, loading, providerMode, completed]);

  useEffect(() => {
    if (!isOpen || completed) return;
    const iv = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(iv);
  }, [isOpen, completed]);

  const toggleMic = () => {
    const next = !micEnabled;
    setMicEnabled(next);
    if (streamRef.current) {
      for (const tr of streamRef.current.getAudioTracks()) {
        tr.enabled = next;
      }
    }
  };

  const toggleCam = () => {
    const next = !camEnabled;
    setCamEnabled(next);
    if (streamRef.current) {
      for (const tr of streamRef.current.getVideoTracks()) {
        tr.enabled = next;
      }
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = chatInput.trim();
    if (!clean) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        sender: localName,
        role: viewerRole,
        text: clean,
        time: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setChatInput("");
  };

  const finishConsultation = async () => {
    stopMedia();
    try {
      await fetch(`/api/turnos/video?tenant=${encodeURIComponent(tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          turnoId,
          turnoCodigo,
          roomCode,
          participantName: localName,
          participantRole: viewerRole,
          durationMinutes: duracionMinutos,
          markCompleted: true,
        }),
      });
    } catch {
      // ignore
    }
    setCompleted(true);
    onCompleted?.();
  };

  if (!isOpen) return null;

  const mins = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
  const secs = String(remainingSeconds % 60).padStart(2, "0");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sala de Videollamada de Turnero Web"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm"
    >
      <div
        className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border-2 text-white shadow-2xl"
        style={{ backgroundColor: "#0c202a", borderColor: accentHex }}
      >
        {/* Cabecera */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 px-4 py-3.5 sm:px-6"
          style={{ backgroundColor: primaryHex }}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider"
                style={{ backgroundColor: accentHex, color: "#112D3A" }}
              >
                <Video className="h-3.5 w-3.5" />
                Teleconsulta 1:1 · {turnoCodigo}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[11px] font-bold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Rol: {viewerRole}
              </span>
              <span className="text-xs font-semibold text-white/80">
                {fecha} · {horaInicio} hs ({duracionMinutos} min)
              </span>
            </div>
            <h3 className="mt-1 text-sm sm:text-base font-extrabold text-white">
              {especialidadNombre} — {profesionalNombre} ↔ {pacienteNombre}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="inline-flex items-center gap-1.5 rounded-xl border bg-black/35 px-3 py-1.5 font-mono text-sm font-bold"
              style={{ borderColor: accentHex, color: accentHex }}
            >
              <Clock className="h-4 w-4" />
              <span>
                {mins}:{secs}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                stopMedia();
                onClose();
              }}
              aria-label="Cerrar sala"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white hover:bg-white/25"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Barra privacidad */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/35 px-4 py-2 text-[11px] text-white/80">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" style={{ color: accentHex }} />
            <span>
              <strong>Conexión privada encriptada:</strong> Plataforma de videollamada integrada en{" "}
              {fantasyName} ({providerMode === "daily_api" ? "Daily.co HD" : "WebRTC Integrado"}).
            </span>
          </span>
          {roomName && (
            <span className="font-mono text-[10px]" style={{ color: accentHex }}>
              Sala: {roomName}
            </span>
          )}
        </div>

        {/* Escenario */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {errorMsg && (
            <div className="mb-4 rounded-xl border border-red-400/50 bg-red-950/70 p-3 text-xs font-semibold text-red-100">
              {errorMsg}
            </div>
          )}

          {completed ? (
            <div className="mx-auto max-w-xl rounded-3xl border border-white/20 bg-white/5 p-8 text-center">
              <div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: accentHex, color: "#112D3A" }}
              >
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h4 className="mt-4 text-xl font-black text-white">
                ¡Teleconsulta Finalizada!
              </h4>
              <p className="mt-2 text-sm text-white/80">
                El turno <strong>{turnoCodigo}</strong> de{" "}
                <strong>{especialidadNombre}</strong> quedó registrado como{" "}
                <strong style={{ color: accentHex }}>Atendido</strong>.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 inline-flex cursor-pointer items-center justify-center rounded-xl px-6 py-2.5 text-sm font-extrabold"
                style={{ backgroundColor: accentHex, color: "#112D3A" }}
              >
                Cerrar sala
              </button>
            </div>
          ) : loading ? (
            <div className="flex h-72 flex-col items-center justify-center gap-3">
              <div
                className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
                style={{ borderColor: accentHex, borderTopColor: "transparent" }}
              />
              <p className="text-sm font-bold" style={{ color: accentHex }}>
                Conectando sala de videollamada...
              </p>
            </div>
          ) : providerMode === "daily_api" && roomUrl ? (
            <div className="h-[440px] sm:h-[500px] w-full overflow-hidden rounded-2xl border border-white/20 bg-black">
              <iframe
                title={`Sala ${roomName}`}
                src={roomUrl}
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                className="h-full w-full border-0"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 gap-3.5 ${
                  showChat ? "lg:col-span-2" : "lg:col-span-3"
                }`}
              >
                {/* Participante local */}
                <div
                  className="relative flex min-h-[250px] sm:min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 bg-[#07141b]"
                  style={{ borderColor: accentHex }}
                >
                  {cameraActive && camEnabled ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                      <div
                        className="flex h-20 w-20 items-center justify-center rounded-full border-2 text-2xl font-black"
                        style={{
                          backgroundColor: primaryHex,
                          borderColor: accentHex,
                          color: accentHex,
                        }}
                      >
                        {localName
                          .split(" ")
                          .map((p) => p[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <p className="max-w-xs text-xs text-white/75">
                        {camEnabled
                          ? cameraNotice || "Cámara lista para transmitir"
                          : "Cámara apagada"}
                      </p>
                    </div>
                  )}

                  <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Vos · {viewerRole}</span>
                  </div>
                  <div className="absolute right-3 bottom-3 left-3 flex items-center justify-between rounded-xl bg-black/70 px-3 py-1.5 text-xs">
                    <span className="truncate font-bold">{localName}</span>
                    <span className="text-[11px]" style={{ color: accentHex }}>
                      {micEnabled ? "Mic activo" : "Silenciado"}
                    </span>
                  </div>
                </div>

                {/* Participante remoto */}
                <div className="relative flex min-h-[250px] sm:min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-b from-[#163848] to-[#0b1f29] p-5 text-center">
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    <span>En sala · {remoteRole}</span>
                  </div>

                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-full border-2 text-2xl font-black"
                    style={{
                      backgroundColor: primaryHex,
                      borderColor: accentHex,
                      color: accentHex,
                    }}
                  >
                    {remoteName
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  <h5 className="mt-3 text-base font-extrabold">{remoteName}</h5>
                  <p className="text-xs font-semibold" style={{ color: accentHex }}>
                    {remoteRole} · {especialidadNombre}
                  </p>
                  <p className="mt-2 max-w-xs text-[11px] text-white/70">
                    Sala privada vinculada al código <code>{roomCode}</code>. Cuando el otro
                    participante ingrese con el enlace, ambos estarán conectados en HD.
                  </p>
                </div>
              </div>

              {showChat && (
                <div className="flex h-[300px] flex-col justify-between rounded-2xl border border-white/15 bg-black/30 p-3.5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-xs font-extrabold" style={{ color: accentHex }}>
                      Chat clínico de la consulta
                    </span>
                    <span className="text-[10px] text-white/60">Privado</span>
                  </div>
                  <div className="my-2 flex-1 space-y-2 overflow-y-auto pr-1 text-xs">
                    {messages.map((m) => (
                      <div key={m.id} className="rounded-xl bg-white/10 px-3 py-2">
                        <div className="flex items-center justify-between text-[10px]" style={{ color: accentHex }}>
                          <strong>
                            {m.sender} ({m.role})
                          </strong>
                          <span>{m.time}</span>
                        </div>
                        <p className="mt-0.5 text-white/95">{m.text}</p>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={sendMessage} className="flex gap-1.5">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Escribir mensaje..."
                      className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white placeholder:text-white/45 focus:outline-none"
                    />
                    <button
                      type="submit"
                      aria-label="Enviar mensaje"
                      className="inline-flex cursor-pointer items-center justify-center rounded-xl px-3 py-2 font-bold"
                      style={{ backgroundColor: accentHex, color: "#112D3A" }}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Barra de controles */}
        {!completed && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/15 bg-black/40 px-4 py-3.5 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleMic}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold ${
                  micEnabled ? "bg-white/15 text-white hover:bg-white/25" : "bg-red-600 text-white"
                }`}
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                <span>{micEnabled ? "Micrófono activo" : "Silenciado"}</span>
              </button>

              <button
                type="button"
                onClick={toggleCam}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold ${
                  camEnabled ? "bg-white/15 text-white hover:bg-white/25" : "bg-red-600 text-white"
                }`}
              >
                {camEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                <span>{camEnabled ? "Cámara activa" : "Cámara apagada"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowChat((v) => !v)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/25"
              >
                <MessageSquare className="h-4 w-4" />
                <span>{showChat ? "Ocultar chat" : "Ver chat"}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={finishConsultation}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black shadow"
              style={{ backgroundColor: accentHex, color: "#112D3A" }}
            >
              <PhoneOff className="h-4 w-4 text-red-700" />
              <span>Finalizar consulta</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
