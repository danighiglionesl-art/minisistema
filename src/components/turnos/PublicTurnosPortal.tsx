"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  MapPin,
  Search,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Video,
  XCircle,
} from "lucide-react";
import {
  type EspecialidadRecord,
  type ObraSocialRecord,
  parseArgentineDniPdf417,
  type PlanObraSocialRecord,
  type TurnoModalidad,
  type TurnoRecord,
  type TurnosPortalConfig,
} from "@/lib/erp/turnos-types";
import TurnosVideoCallModal from "./TurnosVideoCallModal";

export interface PublicProfesionalItem {
  id: string;
  apellidos: string;
  nombres: string;
  nombreCompleto: string;
  titulo: string;
  matriculaNacional: string;
  matriculaProvincial: string;
  especialidadIds: string[];
  obraSocialIds: string[];
  atiendeParticular: boolean;
  valorConsultaParticularArs: number;
  valorPorEspecialidadArs: Record<string, number>;
  permitePresencial: boolean;
  permiteVideollamada: boolean;
  diasAtencion: number[];
  mpLinked: boolean;
}

export interface PublicTurnosPortalProps {
  tenantSlug: string;
  fantasyName: string;
  primaryHex: string;
  accentHex: string;
  logoHorizontalUrl: string;
  logoSymbolUrl: string;
  initialSalaCode?: string;
  initialSalaRole?: "Profesional" | "Paciente";
}

interface BootstrapResponse {
  ok: boolean;
  portalConfig: TurnosPortalConfig;
  paymentConfig: {
    organizadorNombre: string;
    organizadorTipo: string;
    habilitarPagoOnlineParticular: boolean;
    pagoObligatorioParaConfirmarParticular: boolean;
  };
  especialidades: EspecialidadRecord[];
  obrasSociales: ObraSocialRecord[];
  planes: PlanObraSocialRecord[];
  profesionales: PublicProfesionalItem[];
}

interface SlotItem {
  horaInicio: string;
  horaFin: string;
  duracionMinutos: number;
  disponible: boolean;
  consultorio?: string;
}

const DIAS_SEMANA_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function formatArs(val: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(val || 0);
}

function formatFechaBonita(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function downloadTurnoIcs(turno: TurnoRecord, fantasyName: string, address: string) {
  const startDt = `${turno.fecha.replace(/-/g, "")}T${turno.horaInicio.replace(":", "")}00`;
  const endDt = `${turno.fecha.replace(/-/g, "")}T${turno.horaFin.replace(":", "")}00`;
  const loc =
    turno.modalidad === "videollamada"
      ? `Videollamada (${turno.video?.roomCode || turno.codigo})`
      : address || turno.consultorio || fantasyName;
  const desc = [
    `Turno ${turno.codigo} — ${fantasyName}`,
    `Especialidad: ${turno.especialidadNombre} (${turno.duracionMinutos} min)`,
    `Profesional: ${turno.profesionalNombre}`,
    `Cobertura: ${turno.coberturaTipo === "particular" ? "Particular" : `${turno.obraSocialNombre || ""} ${turno.planNombre || ""}`}`,
    `Modalidad: ${turno.modalidad === "videollamada" ? "Videollamada" : "Presencial"}`,
  ].join("\\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MiniSistema//TurneroWeb//ES",
    "BEGIN:VEVENT",
    `UID:${turno.id}@minisistema.com.ar`,
    `DTSTART:${startDt}`,
    `DTEND:${endDt}`,
    `SUMMARY:Turno ${turno.especialidadNombre} - ${turno.profesionalNombre}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${loc}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${turno.codigo}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function PublicTurnosPortal(props: PublicTurnosPortalProps) {
  const {
    tenantSlug,
    fantasyName,
    primaryHex,
    accentHex,
    logoSymbolUrl,
    initialSalaCode = "",
    initialSalaRole = "Paciente",
  } = props;

  const [activeTab, setActiveTab] = useState<"reservar" | "mis_turnos" | "videollamada">(
    initialSalaCode ? "videollamada" : "reservar"
  );

  // Datos catálogo
  const [loadingInit, setLoadingInit] = useState(true);
  const [portalConfig, setPortalConfig] = useState<TurnosPortalConfig | null>(null);
  const [paymentConfig, setPaymentConfig] = useState({
    organizadorNombre: fantasyName,
    organizadorTipo: "Clínica",
    habilitarPagoOnlineParticular: true,
    pagoObligatorioParaConfirmarParticular: false,
  });
  const [especialidades, setEspecialidades] = useState<EspecialidadRecord[]>([]);
  const [obrasSociales, setObrasSociales] = useState<ObraSocialRecord[]>([]);
  const [planes, setPlanes] = useState<PlanObraSocialRecord[]>([]);
  const [profesionales, setProfesionales] = useState<PublicProfesionalItem[]>([]);

  // Datos Paciente (Registro Web por DNI)
  const [dni, setDni] = useState("");
  const [dniLookupLoading, setDniLookupLoading] = useState(false);
  const [dniLookupMsg, setDniLookupMsg] = useState<string | null>(null);
  const [dniFoundSource, setDniFoundSource] = useState<string | null>(null);
  const [apellidos, setApellidos] = useState("");
  const [nombres, setNombres] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [domicilio, setDomicilio] = useState("");

  // Escáner DNI PDF417 (opcional con cámara o lector de barras)
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerRawInput, setScannerRawInput] = useState("");
  const [scannerStatus, setScannerStatus] = useState<string | null>(null);
  const scanVideoRef = useRef<HTMLVideoElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);

  // Selección de Turno
  const [especialidadId, setEspecialidadId] = useState("");
  const [profesionalId, setProfesionalId] = useState("");
  const [modalidad, setModalidad] = useState<TurnoModalidad>("presencial");
  const [coberturaTipo, setCoberturaTipo] = useState<"obra_social" | "particular">("obra_social");
  const [obraSocialId, setObraSocialId] = useState("");
  const [planId, setPlanId] = useState("");
  const [nroAfiliado, setNroAfiliado] = useState("");
  const [motivoConsulta, setMotivoConsulta] = useState("");

  // Fechas y horarios
  const [availableDates, setAvailableDates] = useState<Array<{ fecha: string; freeCount: number }>>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [selectedFecha, setSelectedFecha] = useState("");
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedHora, setSelectedHora] = useState("");

  // Reserva y Pago MP
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmedTurno, setConfirmedTurno] = useState<TurnoRecord | null>(null);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpPrefResult, setMpPrefResult] = useState<{
    providerMode: "mercadopago_live" | "mercadopago_sandbox";
    preferenceId: string;
    initPointUrl: string;
    organizadorNombre: string;
    organizadorTipo: string;
  } | null>(null);

  // Mis Turnos
  const [misTurnosDni, setMisTurnosDni] = useState("");
  const [misTurnosList, setMisTurnosList] = useState<TurnoRecord[]>([]);
  const [misTurnosLoading, setMisTurnosLoading] = useState(false);
  const [misTurnosSearched, setMisTurnosSearched] = useState(false);

  // Sala de Videollamada
  const [videoSearchCode, setVideoSearchCode] = useState(initialSalaCode);
  const [videoRole, setVideoRole] = useState<"Profesional" | "Paciente">(initialSalaRole);
  const [videoLookupError, setVideoLookupError] = useState<string | null>(null);
  const [activeVideoTurno, setActiveVideoTurno] = useState<{
    id?: string;
    codigo: string;
    roomCode: string;
    especialidadNombre: string;
    profesionalNombre: string;
    pacienteNombreCompleto: string;
    fecha: string;
    horaInicio: string;
    duracionMinutos: number;
  } | null>(null);

  // Cargar catálogo público inicial
  useEffect(() => {
    let active = true;
    fetch(`/api/turnos?tenant=${encodeURIComponent(tenantSlug)}`)
      .then((r) => r.json())
      .then((data: BootstrapResponse) => {
        if (!active || !data?.ok) return;
        setPortalConfig(data.portalConfig);
        if (data.paymentConfig) setPaymentConfig(data.paymentConfig);
        setEspecialidades(data.especialidades || []);
        setObrasSociales(data.obrasSociales || []);
        setPlanes(data.planes || []);
        setProfesionales(data.profesionales || []);
        setLoadingInit(false);
      })
      .catch(() => {
        if (active) setLoadingInit(false);
      });
    return () => {
      active = false;
    };
  }, [tenantSlug]);

  // Si llega con ?sala=CODE abrir búsqueda directa
  useEffect(() => {
    if (initialSalaCode) {
      handleLookupVideoRoom(initialSalaCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSalaCode]);

  // Especialidades que realmente tienen al menos un profesional asignado (o todas si aún no cargaron profesionales)
  const especialidadesDisponibles = useMemo(() => {
    const withProf = especialidades.filter((e) =>
      profesionales.some((p) => p.especialidadIds.includes(e.id))
    );
    return withProf.length > 0 ? withProf : especialidades;
  }, [especialidades, profesionales]);

  const selectedEsp = useMemo(
    () => especialidades.find((e) => e.id === especialidadId) || null,
    [especialidades, especialidadId]
  );

  const profesionalesFiltrados = useMemo(() => {
    if (!especialidadId) return profesionales;
    return profesionales.filter((p) => p.especialidadIds.includes(especialidadId));
  }, [profesionales, especialidadId]);

  const selectedProf = useMemo(
    () => profesionales.find((p) => p.id === profesionalId) || null,
    [profesionales, profesionalId]
  );

  const obrasSocialesDelProf = useMemo(() => {
    if (!selectedProf) return obrasSociales;
    return obrasSociales.filter((o) => selectedProf.obraSocialIds.includes(o.id));
  }, [obrasSociales, selectedProf]);

  const planesDeObraSocial = useMemo(() => {
    if (!obraSocialId) return [];
    return planes.filter((p) => p.obraSocialId === obraSocialId);
  }, [planes, obraSocialId]);

  const valorParticularActual = useMemo(() => {
    if (!selectedProf) return selectedEsp?.valorConsultaParticularSugeridoArs || 0;
    if (selectedEsp && selectedProf.valorPorEspecialidadArs?.[selectedEsp.id]) {
      return selectedProf.valorPorEspecialidadArs[selectedEsp.id];
    }
    return (
      selectedProf.valorConsultaParticularArs ||
      selectedEsp?.valorConsultaParticularSugeridoArs ||
      0
    );
  }, [selectedProf, selectedEsp]);

  // Ajustar modalidad y cobertura cuando cambia el profesional o especialidad
  useEffect(() => {
    if (!selectedProf) return;
    const allowVid =
      selectedProf.permiteVideollamada && (selectedEsp?.permiteVideollamada ?? true);
    if (modalidad === "videollamada" && !allowVid) {
      setModalidad("presencial");
    } else if (modalidad === "presencial" && !selectedProf.permitePresencial && allowVid) {
      setModalidad("videollamada");
    }
    if (
      coberturaTipo === "obra_social" &&
      selectedProf.obraSocialIds.length === 0 &&
      selectedProf.atiendeParticular
    ) {
      setCoberturaTipo("particular");
    } else if (coberturaTipo === "particular" && !selectedProf.atiendeParticular) {
      setCoberturaTipo("obra_social");
    }
  }, [selectedProf, selectedEsp, modalidad, coberturaTipo]);

  // Cargar fechas disponibles al seleccionar profesional + especialidad + modalidad
  useEffect(() => {
    if (!profesionalId || !especialidadId) {
      setAvailableDates([]);
      setSelectedFecha("");
      setSlots([]);
      setSelectedHora("");
      return;
    }
    let active = true;
    setLoadingDates(true);
    setSelectedFecha("");
    setSlots([]);
    setSelectedHora("");
    fetch(
      `/api/turnos?tenant=${encodeURIComponent(tenantSlug)}&action=available_dates&profesionalId=${encodeURIComponent(
        profesionalId
      )}&especialidadId=${encodeURIComponent(especialidadId)}&modalidad=${encodeURIComponent(
        modalidad
      )}&days=45`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data?.dates) ? data.dates : [];
        setAvailableDates(list);
        if (list.length > 0) {
          setSelectedFecha(list[0].fecha);
        }
        setLoadingDates(false);
      })
      .catch(() => {
        if (active) setLoadingDates(false);
      });
    return () => {
      active = false;
    };
  }, [tenantSlug, profesionalId, especialidadId, modalidad]);

  // Cargar horarios disponibles de la fecha elegida
  useEffect(() => {
    if (!profesionalId || !especialidadId || !selectedFecha) {
      setSlots([]);
      setSelectedHora("");
      return;
    }
    let active = true;
    setLoadingSlots(true);
    setSelectedHora("");
    fetch(
      `/api/turnos?tenant=${encodeURIComponent(tenantSlug)}&action=slots&profesionalId=${encodeURIComponent(
        profesionalId
      )}&especialidadId=${encodeURIComponent(especialidadId)}&fecha=${encodeURIComponent(
        selectedFecha
      )}&modalidad=${encodeURIComponent(modalidad)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setSlots(Array.isArray(data?.slots) ? data.slots : []);
        setLoadingSlots(false);
      })
      .catch(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, [tenantSlug, profesionalId, especialidadId, selectedFecha, modalidad]);

  // Motor de búsqueda por DNI del paciente
  const handleLookupDni = async () => {
    const clean = dni.replace(/\D/g, "");
    if (clean.length < 6) {
      setDniLookupMsg("Ingresá un DNI válido (al menos 6 números).");
      return;
    }
    setDniLookupLoading(true);
    setDniLookupMsg(null);
    setDniFoundSource(null);
    try {
      const res = await fetch(
        `/api/turnos?tenant=${encodeURIComponent(tenantSlug)}&action=lookup_dni&dni=${encodeURIComponent(clean)}`
      );
      const data = await res.json();
      if (data?.found && data?.paciente) {
        const p = data.paciente;
        if (p.apellidos) setApellidos(p.apellidos);
        if (p.nombres) setNombres(p.nombres);
        if (p.fechaNacimiento) setFechaNacimiento(p.fechaNacimiento);
        if (p.whatsapp) setWhatsapp(p.whatsapp);
        if (p.email) setEmail(p.email);
        if (p.domicilio) setDomicilio(p.domicilio);
        if (p.obraSocialId) setObraSocialId(p.obraSocialId);
        if (p.planId) setPlanId(p.planId);
        if (p.nroAfiliado) setNroAfiliado(p.nroAfiliado);
        setDniFoundSource(data.source || "sistema");
        const isExternal =
          data.source === "cuitonline" ||
          data.source === "bcra_oficial" ||
          data.source === "buscador_publico";
        setDniLookupMsg(
          isExternal
            ? `✅ ¡Datos encontrados en ${data.sourceLabel || "padrón externo"}! Trajimos tu nombre (${p.apellidos}, ${p.nombres}). Completá tu WhatsApp y correo para finalizar el registro.`
            : `✅ ¡Datos encontrados! Recuperamos automáticamente tu ficha (${p.apellidos}, ${p.nombres}) para que no tengas que volver a cargar todo.`
        );
      } else {
        setDniLookupMsg(
          "No encontramos un registro previo con ese DNI. Completá tus datos abajo (o escaneá el código de barras de tu DNI) para quedar registrado."
        );
      }
    } catch {
      setDniLookupMsg("No se pudo verificar el DNI en este momento. Podés completar tus datos manualmente.");
    } finally {
      setDniLookupLoading(false);
    }
  };

  // Escaneo del código PDF417 del DNI argentino
  const stopScannerCamera = () => {
    if (scanStreamRef.current) {
      for (const tr of scanStreamRef.current.getTracks()) tr.stop();
      scanStreamRef.current = null;
    }
  };

  const applyPdf417Raw = (raw: string) => {
    const parsed = parseArgentineDniPdf417(raw);
    if (!parsed) {
      setScannerStatus("No se reconoció el formato del código PDF417 del DNI argentino.");
      return false;
    }
    setDni(parsed.dni);
    setApellidos(parsed.apellidos);
    setNombres(parsed.nombres);
    if (parsed.fechaNacimiento) setFechaNacimiento(parsed.fechaNacimiento);
    setDniLookupMsg(
      `✅ Datos leídos del DNI físico: ${parsed.apellidos}, ${parsed.nombres} (DNI ${parsed.dni}).`
    );
    stopScannerCamera();
    setScannerOpen(false);
    setScannerRawInput("");
    return true;
  };

  const startDniCameraScanner = async () => {
    setScannerOpen(true);
    setScannerStatus("Apuntá la cámara al código de barras del frente de tu DNI tarjeta...");
    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    if (!BarcodeDetectorCtor || !navigator.mediaDevices?.getUserMedia) {
      setScannerStatus(
        "Tu navegador no soporta escaneo PDF417 directo por cámara. Si tenés un lector de código de barras 2D, escaneá en el cuadro de texto de abajo."
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      scanStreamRef.current = stream;
      if (scanVideoRef.current) {
        scanVideoRef.current.srcObject = stream;
      }
      const detector = new BarcodeDetectorCtor({ formats: ["pdf417"] });
      const tick = async () => {
        if (!scanStreamRef.current || !scanVideoRef.current) return;
        try {
          const codes = await detector.detect(scanVideoRef.current);
          if (codes && codes.length > 0 && codes[0].rawValue) {
            if (applyPdf417Raw(codes[0].rawValue)) return;
          }
        } catch {
          // continuar
        }
        if (scanStreamRef.current) {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    } catch {
      setScannerStatus("No se pudo acceder a la cámara. Podés ingresar los datos manualmente.");
    }
  };

  useEffect(() => {
    return () => stopScannerCamera();
  }, []);

  // Reservar Turno Web
  const handleBookTurno = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!dni.replace(/\D/g, "") || !apellidos.trim() || !nombres.trim()) {
      setFormError("Completá DNI, Apellido/s y Nombre/s del paciente.");
      return;
    }
    if (!whatsapp.replace(/\D/g, "")) {
      setFormError("Ingresá tu número de WhatsApp para recibir la confirmación.");
      return;
    }
    if (!especialidadId || !profesionalId || !selectedFecha || !selectedHora) {
      setFormError("Elegí Especialidad, Profesional, Fecha y Horario disponible.");
      return;
    }
    if (coberturaTipo === "obra_social" && !obraSocialId) {
      setFormError("Seleccioná tu Obra Social o elegí modalidad Particular.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/turnos?tenant=${encodeURIComponent(tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "book_turno",
          especialidadId,
          profesionalId,
          fecha: selectedFecha,
          horaInicio: selectedHora,
          modalidad,
          coberturaTipo,
          obraSocialId: coberturaTipo === "obra_social" ? obraSocialId : "",
          planId: coberturaTipo === "obra_social" ? planId : "",
          nroAfiliado,
          motivoConsulta,
          paciente: {
            dni,
            apellidos,
            nombres,
            fechaNacimiento,
            whatsapp,
            email,
            domicilio,
          },
        }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setFormError(data?.message || "No se pudo confirmar la reserva.");
        return;
      }
      setConfirmedTurno(data.turno);
      setMpPrefResult(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setFormError("Error de conexión al reservar el turno. Intentá nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  // Iniciar pago online Mercado Pago (Particular Split 1:1)
  const handleStartMpPayment = async (turno: TurnoRecord) => {
    setMpLoading(true);
    try {
      const res = await fetch(`/api/turnos/mp/preference?tenant=${encodeURIComponent(tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, turnoId: turno.id }),
      });
      const data = await res.json();
      if (!data?.ok) {
        alert(data?.message || "No se pudo iniciar el pago online.");
        return;
      }
      if (data.turno) setConfirmedTurno(data.turno);
      setMpPrefResult({
        providerMode: data.providerMode,
        preferenceId: data.preferenceId,
        initPointUrl: data.initPointUrl || "",
        organizadorNombre: data.organizadorNombre || paymentConfig.organizadorNombre,
        organizadorTipo: data.organizadorTipo || paymentConfig.organizadorTipo,
      });
      if (data.providerMode === "mercadopago_live" && data.initPointUrl) {
        window.open(data.initPointUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setMpLoading(false);
    }
  };

  const handleConfirmSandboxPayment = async (turnoId: string) => {
    setMpLoading(true);
    try {
      const res = await fetch(`/api/turnos?tenant=${encodeURIComponent(tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_sandbox_payment", turnoId }),
      });
      const data = await res.json();
      if (data?.ok && data.turno) {
        setConfirmedTurno(data.turno);
        setMpPrefResult(null);
      }
    } finally {
      setMpLoading(false);
    }
  };

  // Mis Turnos por DNI
  const handleSearchMisTurnos = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = misTurnosDni.replace(/\D/g, "");
    if (clean.length < 6) return;
    setMisTurnosLoading(true);
    setMisTurnosSearched(true);
    try {
      const res = await fetch(
        `/api/turnos?tenant=${encodeURIComponent(tenantSlug)}&action=lookup_dni&dni=${encodeURIComponent(clean)}`
      );
      const data = await res.json();
      setMisTurnosList(Array.isArray(data?.misTurnos) ? data.misTurnos : []);
    } finally {
      setMisTurnosLoading(false);
    }
  };

  const handleCancelPacienteTurno = async (turno: TurnoRecord) => {
    if (!window.confirm(`¿Confirmás cancelar el turno ${turno.codigo} del ${turno.fecha} a las ${turno.horaInicio} hs?`)) {
      return;
    }
    const res = await fetch(`/api/turnos?tenant=${encodeURIComponent(tenantSlug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "cancel_turno_paciente",
        codigo: turno.codigo,
        dni: turno.pacienteDni,
      }),
    });
    const data = await res.json();
    if (data?.ok) {
      handleSearchMisTurnos();
    } else {
      alert(data?.message || "No se pudo cancelar el turno.");
    }
  };

  // Sala de Videollamada por código
  const handleLookupVideoRoom = async (codeOverride?: string) => {
    const clean = (codeOverride ?? videoSearchCode).trim().toUpperCase();
    if (!clean) return;
    setVideoLookupError(null);
    try {
      const res = await fetch(
        `/api/turnos?tenant=${encodeURIComponent(tenantSlug)}&action=video_lookup&code=${encodeURIComponent(clean)}`
      );
      const data = await res.json();
      if (!data?.ok || !data?.turno) {
        setVideoLookupError(data?.message || "No encontramos una teleconsulta con ese código.");
        return;
      }
      setActiveVideoTurno({
        id: data.turno.id,
        codigo: data.turno.codigo,
        roomCode: data.turno.video?.roomCode || data.turno.codigo,
        especialidadNombre: data.turno.especialidadNombre,
        profesionalNombre: data.turno.profesionalNombre,
        pacienteNombreCompleto: data.turno.pacienteNombreCompleto,
        fecha: data.turno.fecha,
        horaInicio: data.turno.horaInicio,
        duracionMinutos: data.turno.duracionMinutos,
      });
    } catch {
      setVideoLookupError("Error buscando la sala de videollamada.");
    }
  };

  if (loadingInit) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-lg">
        <div
          className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: accentHex, borderTopColor: "transparent" }}
        />
        <p className="mt-3 text-sm font-bold text-[#112D3A]">Cargando Turnero Web...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navegación de pestañas del Portal */}
      <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-sm border border-[#dbe7ec]">
        <button
          type="button"
          onClick={() => {
            setActiveTab("reservar");
            setConfirmedTurno(null);
          }}
          className="flex flex-1 min-w-[160px] cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold transition"
          style={
            activeTab === "reservar"
              ? { backgroundColor: primaryHex, color: "#FFFFFF" }
              : { backgroundColor: "transparent", color: "#112D3A" }
          }
        >
          <Calendar className="h-4 w-4" />
          <span>Sacar Turno Online</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("mis_turnos")}
          className="flex flex-1 min-w-[160px] cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold transition"
          style={
            activeTab === "mis_turnos"
              ? { backgroundColor: primaryHex, color: "#FFFFFF" }
              : { backgroundColor: "transparent", color: "#112D3A" }
          }
        >
          <Search className="h-4 w-4" />
          <span>Mis Turnos (por DNI)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("videollamada")}
          className="flex flex-1 min-w-[160px] cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold transition"
          style={
            activeTab === "videollamada"
              ? { backgroundColor: primaryHex, color: "#FFFFFF" }
              : { backgroundColor: "transparent", color: "#112D3A" }
          }
        >
          <Video className="h-4 w-4" />
          <span>Sala de Videollamada</span>
        </button>
      </div>

      {/* ===================== TAB 1: RESERVAR TURNO ===================== */}
      {activeTab === "reservar" && (
        <>
          {confirmedTurno ? (
            <div className="rounded-3xl border-2 bg-white p-6 sm:p-8 shadow-xl" style={{ borderColor: accentHex }}>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e2ecf0] pb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: accentHex, color: "#112D3A" }}
                  >
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <div>
                    <span className="inline-block rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-black text-emerald-900">
                      COMPROBANTE {confirmedTurno.codigo}
                    </span>
                    <h2 className="mt-1 text-2xl font-black text-[#112D3A]">
                      {confirmedTurno.estado === "confirmado"
                        ? "¡Turno Confirmado!"
                        : confirmedTurno.estado === "pendiente_pago"
                          ? "Turno Reservado — Pendiente de Pago Online"
                          : "¡Turno Registrado con Éxito!"}
                    </h2>
                  </div>
                </div>
                <span className="rounded-xl bg-[#f3f8fa] px-3.5 py-2 text-xs font-extrabold uppercase text-[#112D3A]">
                  {confirmedTurno.modalidad === "videollamada" ? "📹 Videollamada" : "🏥 Presencial"}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#f7fbfc] p-4 border border-[#e2ecf0] space-y-1.5 text-sm">
                  <div className="text-xs font-black uppercase text-[#546e7a]">Detalle del Turno</div>
                  <div><strong>Especialidad:</strong> {confirmedTurno.especialidadNombre} ({confirmedTurno.duracionMinutos} min)</div>
                  <div><strong>Profesional:</strong> {confirmedTurno.profesionalNombre}</div>
                  <div><strong>Día y Horario:</strong> {formatFechaBonita(confirmedTurno.fecha)} · {confirmedTurno.horaInicio} a {confirmedTurno.horaFin} hs</div>
                  <div>
                    <strong>Cobertura:</strong>{" "}
                    {confirmedTurno.coberturaTipo === "particular"
                      ? `Particular (${formatArs(confirmedTurno.pago.montoTotalArs)})`
                      : `${confirmedTurno.obraSocialNombre}${confirmedTurno.planNombre ? ` · ${confirmedTurno.planNombre}` : ""}`}
                  </div>
                  {confirmedTurno.modalidad === "presencial" && portalConfig?.direccionConsultorio && (
                    <div className="flex items-center gap-1 text-xs text-[#334155]">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{portalConfig.direccionConsultorio}</span>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-[#f7fbfc] p-4 border border-[#e2ecf0] space-y-1.5 text-sm">
                  <div className="text-xs font-black uppercase text-[#546e7a]">Paciente</div>
                  <div><strong>Nombre:</strong> {confirmedTurno.pacienteNombreCompleto}</div>
                  <div><strong>DNI:</strong> {confirmedTurno.pacienteDni}</div>
                  <div><strong>WhatsApp:</strong> {confirmedTurno.pacienteWhatsapp}</div>
                  {confirmedTurno.video?.habilitada && (
                    <div className="mt-2 rounded-xl bg-[#112D3A] p-3 text-xs text-white">
                      <div className="font-black" style={{ color: accentHex }}>
                        Código de Sala Videollamada:
                      </div>
                      <div className="mt-0.5 font-mono text-sm font-bold">
                        {confirmedTurno.video.roomCode}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bloque de Pago Online Mercado Pago (Solo Particular) */}
              {confirmedTurno.coberturaTipo === "particular" && confirmedTurno.pago.requerido && (
                <div className="mt-5 rounded-2xl border-2 border-sky-200 bg-sky-50/70 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-black uppercase text-sky-900">
                        <CreditCard className="h-4 w-4" />
                        <span>Pago Online Consulta Particular · Mercado Pago Split</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">
                        Valor de la consulta: <strong>{formatArs(confirmedTurno.pago.montoTotalArs)}</strong>{" "}
                        {confirmedTurno.pago.estado === "approved" ? (
                          <span className="ml-2 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-black text-emerald-800">
                            ✅ PAGADO ({confirmedTurno.pago.mpPaymentId})
                          </span>
                        ) : (
                          <span className="ml-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-800">
                            PENDIENTE DE PAGO
                          </span>
                        )}
                      </p>
                    </div>

                    {confirmedTurno.pago.estado !== "approved" && (
                      <button
                        type="button"
                        disabled={mpLoading}
                        onClick={() => handleStartMpPayment(confirmedTurno)}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#009EE3] px-5 py-3 text-sm font-black text-white shadow hover:bg-[#0089c7] disabled:opacity-60"
                      >
                        <CreditCard className="h-4 w-4" />
                        <span>{mpLoading ? "Generando pago..." : "Pagar con Mercado Pago"}</span>
                      </button>
                    )}
                  </div>

                  {mpPrefResult && confirmedTurno.pago.estado !== "approved" && (
                    <div className="mt-4 rounded-xl border border-sky-300 bg-white p-4 text-xs space-y-2">
                      <div className="font-bold text-[#112D3A]">
                        Preferencia generada: <code>{mpPrefResult.preferenceId}</code>
                      </div>
                      <p className="text-slate-600">
                        Distribución automática configurada ({mpPrefResult.organizadorTipo} · {mpPrefResult.organizadorNombre}):{" "}
                        <strong>{confirmedTurno.pago.profesionalPct}% Profesional</strong> ({formatArs(confirmedTurno.pago.profesionalBrutoArs)}) /{" "}
                        <strong>{confirmedTurno.pago.organizadorPct}% Organizador</strong> ({formatArs(confirmedTurno.pago.organizadorFeeArs)}).
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {mpPrefResult.providerMode === "mercadopago_live" && mpPrefResult.initPointUrl ? (
                          <a
                            href={mpPrefResult.initPointUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#009EE3] px-4 py-2 font-bold text-white"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Abrir Checkout Mercado Pago</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled={mpLoading}
                            onClick={() => handleConfirmSandboxPayment(confirmedTurno.id)}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Simular Pago Aprobado (Modo Pruebas MP)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Acciones del comprobante */}
              <div className="mt-6 flex flex-wrap gap-3">
                {confirmedTurno.video?.habilitada && (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveVideoTurno({
                        id: confirmedTurno.id,
                        codigo: confirmedTurno.codigo,
                        roomCode: confirmedTurno.video!.roomCode,
                        especialidadNombre: confirmedTurno.especialidadNombre,
                        profesionalNombre: confirmedTurno.profesionalNombre,
                        pacienteNombreCompleto: confirmedTurno.pacienteNombreCompleto,
                        fecha: confirmedTurno.fecha,
                        horaInicio: confirmedTurno.horaInicio,
                        duracionMinutos: confirmedTurno.duracionMinutos,
                      })
                    }
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-5 py-3 text-sm font-black shadow"
                    style={{ backgroundColor: primaryHex, color: "#FFFFFF" }}
                  >
                    <Video className="h-4 w-4" />
                    <span>Ingresar a la Sala de Videollamada</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    downloadTurnoIcs(
                      confirmedTurno,
                      fantasyName,
                      portalConfig?.direccionConsultorio || ""
                    )
                  }
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#112D3A]/20 bg-white px-4 py-3 text-sm font-bold text-[#112D3A] hover:bg-[#f3f8fa]"
                >
                  <Download className="h-4 w-4" />
                  <span>Guardar en Calendario (.ICS)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmedTurno(null);
                    setSelectedHora("");
                  }}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold"
                  style={{ backgroundColor: accentHex, color: "#112D3A" }}
                >
                  <span>Sacar otro turno</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBookTurno} className="space-y-6">
              {/* PASO 1: IDENTIFICACIÓN POR DNI */}
              <section className="rounded-3xl border-2 bg-white p-6 shadow-sm" style={{ borderColor: accentHex }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span
                      className="inline-block rounded-full px-3 py-0.5 text-[11px] font-black uppercase"
                      style={{ backgroundColor: accentHex, color: "#112D3A" }}
                    >
                      Paso 1 · Registro Web del Paciente
                    </span>
                    <h2 className="mt-1 text-lg font-black text-[#112D3A]">
                      Ingresá tu DNI para traer tus datos automáticamente
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={startDniCameraScanner}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#112D3A]/20 bg-[#f3f8fa] px-3.5 py-2 text-xs font-extrabold text-[#112D3A] hover:bg-[#e5f1f5]"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Escanear DNI (PDF417)</span>
                  </button>
                </div>

                {scannerOpen && (
                  <div className="mt-4 rounded-2xl border border-[#112D3A]/20 bg-[#f8fbfc] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <strong className="text-xs text-[#112D3A]">📷 Lector de Código de Barras del DNI Argentino</strong>
                      <button
                        type="button"
                        onClick={() => {
                          stopScannerCamera();
                          setScannerOpen(false);
                        }}
                        className="text-xs font-bold text-red-600 cursor-pointer"
                      >
                        Cerrar
                      </button>
                    </div>
                    <video
                      ref={scanVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="max-h-48 w-full rounded-xl bg-black object-cover"
                    />
                    {scannerStatus && <p className="text-xs text-slate-600">{scannerStatus}</p>}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={scannerRawInput}
                        onChange={(e) => setScannerRawInput(e.target.value)}
                        placeholder="O pegá / escaneá aquí con lector 2D la cadena del DNI..."
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => applyPdf417Raw(scannerRawInput)}
                        className="rounded-xl px-4 py-2 text-xs font-bold cursor-pointer"
                        style={{ backgroundColor: primaryHex, color: "#FFFFFF" }}
                      >
                        Leer DNI
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/[^\d.]/g, ""))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleLookupDni();
                      }
                    }}
                    placeholder="Ej: 35123456"
                    className="flex-1 min-w-[200px] rounded-xl border-2 border-[#cbd5e1] bg-white px-4 py-3 text-base font-bold text-[#112D3A] focus:border-[#56D7A1] focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleLookupDni}
                    disabled={dniLookupLoading}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-5 py-3 text-sm font-black shadow disabled:opacity-60"
                    style={{ backgroundColor: primaryHex, color: "#FFFFFF" }}
                  >
                    <Search className="h-4 w-4" />
                    <span>{dniLookupLoading ? "Buscando..." : "Verificar DNI / Traer mis datos"}</span>
                  </button>
                </div>

                {dniLookupMsg && (
                  <div
                    className={`mt-3 rounded-xl px-4 py-2.5 text-xs font-bold ${
                      dniFoundSource
                        ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {dniLookupMsg}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-extrabold text-[#334155]">
                      Apellido/s *
                    </label>
                    <input
                      type="text"
                      value={apellidos}
                      onChange={(e) => setApellidos(e.target.value)}
                      placeholder="Ej: González"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-[#56D7A1] focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-extrabold text-[#334155]">
                      Nombre/s *
                    </label>
                    <input
                      type="text"
                      value={nombres}
                      onChange={(e) => setNombres(e.target.value)}
                      placeholder="Ej: María Laura"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-[#56D7A1] focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-extrabold text-[#334155]">
                      Fecha de Nacimiento
                    </label>
                    <input
                      type="date"
                      value={fechaNacimiento}
                      onChange={(e) => setFechaNacimiento(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-[#56D7A1] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-extrabold text-[#334155]">
                      WhatsApp (para recordatorio) *
                    </label>
                    <input
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="Ej: 3585095475"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-[#56D7A1] focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-extrabold text-[#334155]">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="paciente@email.com"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-[#56D7A1] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-extrabold text-[#334155]">
                      Domicilio (opcional)
                    </label>
                    <input
                      type="text"
                      value={domicilio}
                      onChange={(e) => setDomicilio(e.target.value)}
                      placeholder="Calle y número"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-[#56D7A1] focus:outline-none"
                    />
                  </div>
                </div>
              </section>

              {/* PASO 2: ESPECIALIDAD, PROFESIONAL, MODALIDAD Y COBERTURA */}
              <section className="rounded-3xl border border-[#dbe7ec] bg-white p-6 shadow-sm space-y-5">
                <div>
                  <span
                    className="inline-block rounded-full px-3 py-0.5 text-[11px] font-black uppercase"
                    style={{ backgroundColor: accentHex, color: "#112D3A" }}
                  >
                    Paso 2 · Especialidad, Profesional y Cobertura
                  </span>
                  <h2 className="mt-1 text-lg font-black text-[#112D3A]">
                    Elegí cómo y con quién querés atenderte
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-extrabold text-[#334155]">
                      Especialidad Médica *
                    </label>
                    <select
                      value={especialidadId}
                      onChange={(e) => {
                        setEspecialidadId(e.target.value);
                        setProfesionalId("");
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-bold text-[#112D3A]"
                      required
                    >
                      <option value="">Seleccioná una especialidad...</option>
                      {especialidadesDisponibles.map((esp) => (
                        <option key={esp.id} value={esp.id}>
                          {esp.nombre} ({esp.duracionMinutos} min)
                          {esp.permiteVideollamada ? " · Presencial / Video" : " · Presencial"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-extrabold text-[#334155]">
                      Profesional *
                    </label>
                    <select
                      value={profesionalId}
                      onChange={(e) => setProfesionalId(e.target.value)}
                      disabled={!especialidadId}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-bold text-[#112D3A] disabled:bg-slate-100"
                      required
                    >
                      <option value="">
                        {!especialidadId
                          ? "Primero elegí una especialidad"
                          : profesionalesFiltrados.length === 0
                            ? "Sin profesionales activos en esta especialidad"
                            : "Seleccioná un profesional..."}
                      </option>
                      {profesionalesFiltrados.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.titulo ? `${p.titulo} ` : ""}
                          {p.apellidos}, {p.nombres}
                          {p.matriculaProvincial ? ` (MP ${p.matriculaProvincial})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedProf && (
                  <div className="rounded-2xl bg-[#f4f9fb] p-4 border border-[#dbe7ec] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl font-black"
                        style={{ backgroundColor: primaryHex, color: accentHex }}
                      >
                        <Stethoscope className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-black text-sm text-[#112D3A]">
                          {selectedProf.titulo} {selectedProf.apellidos}, {selectedProf.nombres}
                        </div>
                        <div className="text-slate-600">
                          Atiende:{" "}
                          {selectedProf.diasAtencion.length > 0
                            ? selectedProf.diasAtencion.map((d) => DIAS_SEMANA_CORTOS[d]).join(", ")
                            : "Sin días cargados"}
                          {selectedEsp ? ` · Turnos de ${selectedEsp.duracionMinutos} min` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedProf.permitePresencial && (
                        <span className="rounded-full bg-white px-3 py-1 font-bold text-[#112D3A] border border-slate-200">
                          🏥 Presencial
                        </span>
                      )}
                      {selectedProf.permiteVideollamada && (selectedEsp?.permiteVideollamada ?? true) && (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-900">
                          📹 Videollamada
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Modalidad y Cobertura */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold text-[#334155]">
                      Modalidad de Atención
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={selectedProf ? !selectedProf.permitePresencial : false}
                        onClick={() => setModalidad("presencial")}
                        className="cursor-pointer rounded-xl border-2 px-3 py-2.5 text-xs font-extrabold transition disabled:opacity-40"
                        style={
                          modalidad === "presencial"
                            ? { backgroundColor: primaryHex, borderColor: primaryHex, color: "#FFFFFF" }
                            : { backgroundColor: "#FFFFFF", borderColor: "#cbd5e1", color: "#112D3A" }
                        }
                      >
                        🏥 Presencial
                      </button>
                      <button
                        type="button"
                        disabled={
                          selectedProf
                            ? !selectedProf.permiteVideollamada || !(selectedEsp?.permiteVideollamada ?? true)
                            : false
                        }
                        onClick={() => setModalidad("videollamada")}
                        className="cursor-pointer rounded-xl border-2 px-3 py-2.5 text-xs font-extrabold transition disabled:opacity-40"
                        style={
                          modalidad === "videollamada"
                            ? { backgroundColor: primaryHex, borderColor: primaryHex, color: "#FFFFFF" }
                            : { backgroundColor: "#FFFFFF", borderColor: "#cbd5e1", color: "#112D3A" }
                        }
                      >
                        📹 Videollamada
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold text-[#334155]">
                      Tipo de Cobertura
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCoberturaTipo("obra_social")}
                        className="cursor-pointer rounded-xl border-2 px-3 py-2.5 text-xs font-extrabold transition"
                        style={
                          coberturaTipo === "obra_social"
                            ? { backgroundColor: primaryHex, borderColor: primaryHex, color: "#FFFFFF" }
                            : { backgroundColor: "#FFFFFF", borderColor: "#cbd5e1", color: "#112D3A" }
                        }
                      >
                        🪪 Obra Social / Prepaga
                      </button>
                      <button
                        type="button"
                        disabled={selectedProf ? !selectedProf.atiendeParticular : false}
                        onClick={() => setCoberturaTipo("particular")}
                        className="cursor-pointer rounded-xl border-2 px-3 py-2.5 text-xs font-extrabold transition disabled:opacity-40"
                        style={
                          coberturaTipo === "particular"
                            ? { backgroundColor: primaryHex, borderColor: primaryHex, color: "#FFFFFF" }
                            : { backgroundColor: "#FFFFFF", borderColor: "#cbd5e1", color: "#112D3A" }
                        }
                      >
                        💳 Particular {valorParticularActual > 0 ? `(${formatArs(valorParticularActual)})` : ""}
                      </button>
                    </div>
                  </div>
                </div>

                {coberturaTipo === "obra_social" ? (
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-extrabold text-[#334155]">
                        Obra Social / Prepaga *
                      </label>
                      <select
                        value={obraSocialId}
                        onChange={(e) => {
                          setObraSocialId(e.target.value);
                          setPlanId("");
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold"
                        required
                      >
                        <option value="">Seleccioná tu Obra Social...</option>
                        {obrasSocialesDelProf.map((os) => (
                          <option key={os.id} value={os.id}>
                            {os.sigla} ({os.tipo === "CCT" ? "Sindical/CCT" : os.tipo === "PREPAGA" ? "Prepaga" : os.tipo})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-extrabold text-[#334155]">
                        Plan
                      </label>
                      <select
                        value={planId}
                        onChange={(e) => setPlanId(e.target.value)}
                        disabled={!obraSocialId}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold disabled:bg-slate-100"
                      >
                        <option value="">Seleccioná tu plan...</option>
                        {planesDeObraSocial.map((pl) => (
                          <option key={pl.id} value={pl.id}>
                            {pl.nombre}
                            {pl.requiereAutorizacion ? " (Req. autorización)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-extrabold text-[#334155]">
                        N° de Afiliado / Credencial
                      </label>
                      <input
                        type="text"
                        value={nroAfiliado}
                        onChange={(e) => setNroAfiliado(e.target.value)}
                        placeholder="Ej: 123456789/00"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-950 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-sky-700" />
                      <span>
                        <strong>Consulta Particular:</strong> Valor{" "}
                        <strong>{formatArs(valorParticularActual)}</strong>.{" "}
                        {paymentConfig.habilitarPagoOnlineParticular
                          ? "Al confirmar la reserva podrás abonarlo online con Mercado Pago de forma segura."
                          : "Se abona directamente en recepción."}
                      </span>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 font-bold text-sky-900">
                      Sin obra social
                    </span>
                  </div>
                )}
              </section>

              {/* PASO 3: DÍA Y HORARIO LIBRE */}
              <section className="rounded-3xl border border-[#dbe7ec] bg-white p-6 shadow-sm space-y-4">
                <div>
                  <span
                    className="inline-block rounded-full px-3 py-0.5 text-[11px] font-black uppercase"
                    style={{ backgroundColor: accentHex, color: "#112D3A" }}
                  >
                    Paso 3 · Fecha y Horario Disponible
                  </span>
                  <h2 className="mt-1 text-lg font-black text-[#112D3A]">
                    Elegí el día y horario de tu turno
                  </h2>
                </div>

                {!profesionalId || !especialidadId ? (
                  <p className="text-sm text-slate-500">
                    Seleccioná primero una Especialidad y un Profesional en el Paso 2 para ver sus horarios libres.
                  </p>
                ) : loadingDates ? (
                  <p className="text-sm font-semibold text-slate-600">Consultando agenda disponible...</p>
                ) : availableDates.length === 0 ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs font-bold text-amber-900">
                    Este profesional no tiene horarios disponibles en los próximos días para la modalidad seleccionada.
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="mb-2 text-xs font-extrabold text-[#334155]">
                        Próximas fechas con turnos libres:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {availableDates.slice(0, 14).map((d) => {
                          const active = selectedFecha === d.fecha;
                          return (
                            <button
                              key={d.fecha}
                              type="button"
                              onClick={() => setSelectedFecha(d.fecha)}
                              className="cursor-pointer rounded-xl border-2 px-3.5 py-2 text-left transition"
                              style={
                                active
                                  ? { backgroundColor: primaryHex, borderColor: primaryHex, color: "#FFFFFF" }
                                  : { backgroundColor: "#FFFFFF", borderColor: "#cbd5e1", color: "#112D3A" }
                              }
                            >
                              <div className="text-xs font-black capitalize">{formatFechaBonita(d.fecha)}</div>
                              <div className="text-[10px] opacity-80">{d.freeCount} libres</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {selectedFecha && (
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-[#334155]">
                          <Clock className="h-4 w-4" />
                          <span>
                            Horarios disponibles para {formatFechaBonita(selectedFecha)} (lapsos de{" "}
                            {selectedEsp?.duracionMinutos || 20} min):
                          </span>
                        </div>
                        {loadingSlots ? (
                          <p className="text-xs text-slate-500">Cargando horarios...</p>
                        ) : slots.length === 0 ? (
                          <p className="text-xs text-slate-500">No quedan horarios libres en esta fecha.</p>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
                            {slots.map((s) => {
                              const active = selectedHora === s.horaInicio;
                              return (
                                <button
                                  key={s.horaInicio}
                                  type="button"
                                  onClick={() => setSelectedHora(s.horaInicio)}
                                  className="cursor-pointer rounded-xl border-2 px-3 py-2.5 text-center text-sm font-black transition"
                                  style={
                                    active
                                      ? { backgroundColor: accentHex, borderColor: primaryHex, color: "#112D3A" }
                                      : { backgroundColor: "#f8fbfc", borderColor: "#cbd5e1", color: "#112D3A" }
                                  }
                                >
                                  {s.horaInicio}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="mb-1 block text-xs font-extrabold text-[#334155]">
                    Motivo de consulta / Notas (opcional)
                  </label>
                  <input
                    type="text"
                    value={motivoConsulta}
                    onChange={(e) => setMotivoConsulta(e.target.value)}
                    placeholder="Ej: Control anual, lectura de estudios, primera consulta..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>
              </section>

              {formError && (
                <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                  ⚠️ {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !selectedHora}
                className="w-full cursor-pointer rounded-2xl px-6 py-4 text-base font-black shadow-lg transition disabled:opacity-50"
                style={{ backgroundColor: primaryHex, color: "#FFFFFF" }}
              >
                {submitting
                  ? "Confirmando tu turno..."
                  : selectedHora
                    ? `Confirmar Turno · ${formatFechaBonita(selectedFecha)} a las ${selectedHora} hs`
                    : "Seleccioná un horario libre para confirmar"}
              </button>
            </form>
          )}
        </>
      )}

      {/* ===================== TAB 2: MIS TURNOS ===================== */}
      {activeTab === "mis_turnos" && (
        <section className="rounded-3xl border border-[#dbe7ec] bg-white p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-xl font-black text-[#112D3A]">Consultar o Cancelar Mis Turnos</h2>
            <p className="mt-1 text-sm text-slate-600">
              Ingresá tu DNI para ver tus turnos agendados, acceder a una videollamada o cancelar si no podés asistir.
            </p>
          </div>

          <form onSubmit={handleSearchMisTurnos} className="flex flex-wrap gap-3">
            <input
              type="text"
              inputMode="numeric"
              value={misTurnosDni}
              onChange={(e) => setMisTurnosDni(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Ingresá tu DNI sin puntos..."
              className="flex-1 min-w-[200px] rounded-xl border-2 border-slate-300 px-4 py-3 text-base font-bold"
              required
            />
            <button
              type="submit"
              disabled={misTurnosLoading}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-6 py-3 text-sm font-black"
              style={{ backgroundColor: primaryHex, color: "#FFFFFF" }}
            >
              <Search className="h-4 w-4" />
              <span>{misTurnosLoading ? "Buscando..." : "Buscar mis turnos"}</span>
            </button>
          </form>

          {misTurnosSearched && (
            <div className="space-y-3">
              {misTurnosList.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
                  No encontramos turnos registrados para ese DNI.
                </p>
              ) : (
                misTurnosList.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-2xl border border-[#dbe7ec] bg-[#f8fbfc] p-4 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#112D3A] px-2.5 py-0.5 text-[11px] font-black text-white">
                          {t.codigo}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-emerald-900">
                          {t.estado}
                        </span>
                        <span className="text-xs font-bold text-slate-600">
                          {t.modalidad === "videollamada" ? "📹 Videollamada" : "🏥 Presencial"}
                        </span>
                      </div>
                      <div className="text-base font-black text-[#112D3A]">
                        {t.especialidadNombre} — {t.profesionalNombre}
                      </div>
                      <div className="text-xs font-semibold text-slate-600">
                        📅 {formatFechaBonita(t.fecha)} · {t.horaInicio} a {t.horaFin} hs ·{" "}
                        {t.coberturaTipo === "particular"
                          ? `Particular (${formatArs(t.pago.montoTotalArs)} - ${t.pago.estado === "approved" ? "Pagado" : "Pendiente"})`
                          : `${t.obraSocialNombre || ""} ${t.planNombre || ""}`}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {t.modalidad === "videollamada" && t.estado !== "cancelado" && t.video && (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveVideoTurno({
                              id: t.id,
                              codigo: t.codigo,
                              roomCode: t.video!.roomCode,
                              especialidadNombre: t.especialidadNombre,
                              profesionalNombre: t.profesionalNombre,
                              pacienteNombreCompleto: t.pacienteNombreCompleto,
                              fecha: t.fecha,
                              horaInicio: t.horaInicio,
                              duracionMinutos: t.duracionMinutos,
                            })
                          }
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black"
                          style={{ backgroundColor: primaryHex, color: "#FFFFFF" }}
                        >
                          <Video className="h-3.5 w-3.5" />
                          <span>Entrar a Videollamada</span>
                        </button>
                      )}
                      {t.estado !== "cancelado" && t.estado !== "atendido" && (
                        <button
                          type="button"
                          onClick={() => handleCancelPacienteTurno(t)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-red-300 bg-white px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Cancelar</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      )}

      {/* ===================== TAB 3: SALA DE VIDEOLLAMADA ===================== */}
      {activeTab === "videollamada" && (
        <section className="rounded-3xl border border-[#dbe7ec] bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: primaryHex, color: accentHex }}
            >
              <Video className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#112D3A]">
                Plataforma de Teleconsulta por Videollamada (Profesional ↔ Paciente)
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Ingresá el código del turno (ej. <code>TRN-2026-0001</code>) o código de sala para conectarte de forma privada y encriptada.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="text"
              value={videoSearchCode}
              onChange={(e) => setVideoSearchCode(e.target.value)}
              placeholder="Código de turno o sala (ej: TRN-2026-0001)"
              className="sm:col-span-2 rounded-xl border-2 border-slate-300 px-4 py-3 text-sm font-bold uppercase"
            />
            <select
              value={videoRole}
              onChange={(e) =>
                setVideoRole(e.target.value === "Profesional" ? "Profesional" : "Paciente")
              }
              className="rounded-xl border-2 border-slate-300 bg-white px-3.5 py-3 text-sm font-bold text-[#112D3A]"
            >
              <option value="Paciente">Ingresar como Paciente</option>
              <option value="Profesional">Ingresar como Profesional</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => handleLookupVideoRoom()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-6 py-3 text-sm font-black shadow"
            style={{ backgroundColor: primaryHex, color: "#FFFFFF" }}
          >
            <UserCheck className="h-4 w-4" />
            <span>Conectar a la Sala de Videollamada</span>
          </button>

          {videoLookupError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-bold text-red-700">
              {videoLookupError}
            </div>
          )}

          <div className="rounded-2xl bg-[#f4f9fb] p-4 text-xs text-slate-600 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
            <span>
              Sala privada 1:1 con cronómetro sincronizado a la duración de la especialidad, controles de cámara/micrófono y chat clínico privado.
            </span>
          </div>
        </section>
      )}

      {/* Modal de Videollamada Activa */}
      {activeVideoTurno && (
        <TurnosVideoCallModal
          isOpen={Boolean(activeVideoTurno)}
          onClose={() => setActiveVideoTurno(null)}
          tenantSlug={tenantSlug}
          fantasyName={fantasyName}
          primaryHex={primaryHex}
          accentHex={accentHex}
          logoSymbolUrl={logoSymbolUrl}
          turnoId={activeVideoTurno.id}
          turnoCodigo={activeVideoTurno.codigo}
          roomCode={activeVideoTurno.roomCode}
          especialidadNombre={activeVideoTurno.especialidadNombre}
          profesionalNombre={activeVideoTurno.profesionalNombre}
          pacienteNombre={activeVideoTurno.pacienteNombreCompleto}
          fecha={activeVideoTurno.fecha}
          horaInicio={activeVideoTurno.horaInicio}
          duracionMinutos={activeVideoTurno.duracionMinutos}
          viewerRole={videoRole}
        />
      )}
    </div>
  );
}
