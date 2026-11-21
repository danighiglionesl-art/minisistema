"use client";

import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarCheck2,
  ClipboardList,
  Download,
  FilePlus2,
  FileUp,
  LogOut,
  Pill,
  Printer,
  Search,
  Stethoscope,
  Trash2,
  UserCheck,
  Video,
  X,
} from "lucide-react";
import type {
  EstudioMedicoRecord,
  EstudioTipo,
  EvolucionClinicaRecord,
  FichaClinicaRecord,
  RecetaDigitalRecord,
} from "@/lib/erp/consultorios-types";
import type { EspecialidadRecord, TurnoEstado, TurnoRecord } from "@/lib/erp/turnos-types";

export interface ProfPatientItem {
  pacienteId: string;
  dni: string;
  nombreCompleto: string;
  whatsapp: string;
  email: string;
  fechaNacimiento: string;
  obraSocial: string;
  esUsuarioRegistrado: boolean;
  webUserId?: string;
  esAfiliadoCemepPlus: boolean;
}

export interface ProfBundleData {
  profesional: {
    profesionalId: string;
    nombre: string;
    titulo: string;
    matriculaNacional: string;
    matriculaProvincial: string;
    dni: string;
    email: string;
    isAdminAllView: boolean;
  };
  turnos: TurnoRecord[];
  pacientes: ProfPatientItem[];
  fichas: FichaClinicaRecord[];
  evoluciones: EvolucionClinicaRecord[];
  estudios: EstudioMedicoRecord[];
  recetas: RecetaDigitalRecord[];
  especialidades: EspecialidadRecord[];
}

interface ProfessionalPortalModalProps {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  bundle: ProfBundleData | null;
  onBundleChange: (next: ProfBundleData | null) => void;
}

const ESTUDIO_TIPOS: EstudioTipo[] = [
  "Laboratorio",
  "Ecografía",
  "Cardiología",
  "Radiología",
  "Diagnóstico por Imágenes",
  "Circuito Integral",
  "EMMAC",
  "Informe Médico",
  "Otro",
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ProfessionalPortalModal({
  open,
  onClose,
  tenantSlug,
  bundle,
  onBundleChange,
}: ProfessionalPortalModalProps) {
  const [dashTab, setDashTab] = useState<"turnos" | "hc" | "estudios" | "recetas">("turnos");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; isErr: boolean } | null>(null);

  // Login profesional
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // Filtros de turnos
  const [turnoFilter, setTurnoFilter] = useState<"hoy" | "proximos" | "todos">("proximos");
  const [turnoSearch, setTurnoSearch] = useState("");

  // Historia Clínica — paciente activo
  const [pacSearch, setPacSearch] = useState("");
  const [selectedPacDni, setSelectedPacDni] = useState("");
  const [selectedPacName, setSelectedPacName] = useState("");
  const [selectedPacId, setSelectedPacId] = useState("");
  const [selectedWebUserId, setSelectedWebUserId] = useState("");
  const [linkedTurnoId, setLinkedTurnoId] = useState("");
  const [linkedTurnoCode, setLinkedTurnoCode] = useState("");

  // Form ficha médica
  const [fGrupo, setFGrupo] = useState("");
  const [fAlergias, setFAlergias] = useState("");
  const [fAntPers, setFAntPers] = useState("");
  const [fAntFam, setFAntFam] = useState("");
  const [fAntQuir, setFAntQuir] = useState("");
  const [fMedCronica, setFMedCronica] = useState("");
  const [fHabitos, setFHabitos] = useState("");
  const [fAlertas, setFAlertas] = useState("");

  // Form nueva evolución
  const [evEsp, setEvEsp] = useState("Clínica Médica");
  const [evMotivo, setEvMotivo] = useState("");
  const [evSubjetivo, setEvSubjetivo] = useState("");
  const [evObjetivo, setEvObjetivo] = useState("");
  const [evTa, setEvTa] = useState("");
  const [evFc, setEvFc] = useState("");
  const [evTemp, setEvTemp] = useState("");
  const [evPeso, setEvPeso] = useState("");
  const [evTalla, setEvTalla] = useState("");
  const [evSat, setEvSat] = useState("");
  const [evDiag, setEvDiag] = useState("");
  const [evCie10, setEvCie10] = useState("");
  const [evPlan, setEvPlan] = useState("");
  const [evIndicaciones, setEvIndicaciones] = useState("");

  // Form cargar estudio
  const [estPacDni, setEstPacDni] = useState("");
  const [estTipo, setEstTipo] = useState<EstudioTipo>("Ecografía");
  const [estFecha, setEstFecha] = useState(todayIso());
  const [estTitulo, setEstTitulo] = useState("");
  const [estInforme, setEstInforme] = useState("");
  const [estVisible, setEstVisible] = useState(true);
  const [estFileName, setEstFileName] = useState("");
  const [estFileMime, setEstFileMime] = useState("");
  const [estFileDataUrl, setEstFileDataUrl] = useState("");

  const apiUrl = `/api/cemep?tenant=${encodeURIComponent(tenantSlug)}`;

  const today = todayIso();

  const filteredTurnos = useMemo(() => {
    if (!bundle) return [];
    const q = turnoSearch.trim().toLowerCase();
    return bundle.turnos.filter((t) => {
      if (turnoFilter === "hoy" && t.fecha !== today) return false;
      if (turnoFilter === "proximos" && t.fecha < today) return false;
      if (
        q &&
        !`${t.pacienteNombreCompleto} ${t.pacienteDni} ${t.especialidadNombre} ${t.codigo}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [bundle, turnoFilter, turnoSearch, today]);

  const filteredPacientes = useMemo(() => {
    if (!bundle) return [];
    const q = pacSearch.trim().toLowerCase();
    if (!q) return bundle.pacientes;
    return bundle.pacientes.filter((p) =>
      `${p.nombreCompleto} ${p.dni} ${p.email} ${p.obraSocial}`.toLowerCase().includes(q)
    );
  }, [bundle, pacSearch]);

  const activePatientEvoluciones = useMemo(() => {
    if (!bundle || (!selectedPacDni && !selectedPacId)) return [];
    return bundle.evoluciones.filter(
      (e) =>
        (selectedPacDni && e.pacienteDni === selectedPacDni) ||
        (selectedPacId && e.pacienteId === selectedPacId)
    );
  }, [bundle, selectedPacDni, selectedPacId]);

  const activePatientEstudios = useMemo(() => {
    if (!bundle || (!selectedPacDni && !selectedPacId)) return [];
    return bundle.estudios.filter(
      (e) =>
        (selectedPacDni && e.pacienteDni === selectedPacDni) ||
        (selectedPacId && e.pacienteId === selectedPacId)
    );
  }, [bundle, selectedPacDni, selectedPacId]);

  if (!open) return null;

  function loadPatientIntoHc(
    pac: {
      pacienteId: string;
      dni: string;
      nombreCompleto: string;
      webUserId?: string;
    },
    turno?: { id: string; codigo: string; especialidadNombre?: string }
  ) {
    setSelectedPacId(pac.pacienteId);
    setSelectedPacDni(pac.dni);
    setSelectedPacName(pac.nombreCompleto);
    setSelectedWebUserId(pac.webUserId || "");
    setLinkedTurnoId(turno?.id || "");
    setLinkedTurnoCode(turno?.codigo || "");
    if (turno?.especialidadNombre) setEvEsp(turno.especialidadNombre);

    const existingFicha = bundle?.fichas.find(
      (f) => (pac.dni && f.pacienteDni === pac.dni) || f.pacienteId === pac.pacienteId
    );
    setFGrupo(existingFicha?.grupoSanguineo || "");
    setFAlergias(existingFicha?.alergias || "");
    setFAntPers(existingFicha?.antecedentesPersonales || "");
    setFAntFam(existingFicha?.antecedentesFamiliares || "");
    setFAntQuir(existingFicha?.antecedentesQuirurgicos || "");
    setFMedCronica(existingFicha?.medicacionCronica || "");
    setFHabitos(existingFicha?.habitos || "");
    setFAlertas(existingFicha?.alertasClinicas || "");
    setDashTab("hc");
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
        setMsg({ text: data.message || "No se pudo completar la operación.", isErr: true });
        return null;
      }
      if (data.profesional) {
        onBundleChange({
          profesional: data.profesional,
          turnos: data.turnos || [],
          pacientes: data.pacientes || [],
          fichas: data.fichas || [],
          evoluciones: data.evoluciones || [],
          estudios: data.estudios || [],
          recetas: data.recetas || [],
          especialidades: data.especialidades || [],
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

  function handleFileRead(
    file: File | undefined,
    onDone: (name: string, mime: string, dataUrl: string) => void
  ) {
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) {
      setMsg({ text: "El archivo supera los 4.5 MB recomendados. Comprimilo e intentá de nuevo.", isErr: true });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onDone(file.name, file.type || "application/pdf", String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  }

  function handlePrintHc() {
    if (!selectedPacName) return;
    const w = window.open("", "_blank", "width=900,height=720");
    if (!w) return;
    const evRows = activePatientEvoluciones
      .map(
        (e) => `<div style="border:1px solid #cbd5e1;border-radius:10px;padding:12px;margin-bottom:10px;">
          <div style="font-weight:800;color:#1B335D;">${e.fecha} ${e.hora} · ${e.especialidadNombre} — ${e.profesionalNombre}</div>
          <div><strong>Motivo:</strong> ${e.motivoConsulta || "-"}</div>
          ${e.subjetivo ? `<div><strong>Anamnesis:</strong> ${e.subjetivo}</div>` : ""}
          ${e.objetivo ? `<div><strong>Examen físico:</strong> ${e.objetivo}</div>` : ""}
          ${e.diagnostico ? `<div><strong>Diagnóstico:</strong> ${e.diagnostico} ${e.codigoCie10 ? `(${e.codigoCie10})` : ""}</div>` : ""}
          ${e.planTerapeutico ? `<div><strong>Plan / Tratamiento:</strong> ${e.planTerapeutico}</div>` : ""}
        </div>`
      )
      .join("");
    w.document.write(`<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8"><title>Historia Clínica — ${selectedPacName}</title></head><body style="font-family:system-ui,sans-serif;padding:28px;color:#1e293b;">
      <h1 style="margin:0;color:#1B335D;">CEMEP · Centro Médico Paulucci — Historia Clínica</h1>
      <p style="margin:4px 0 16px;color:#475569;">Paciente: <strong>${selectedPacName}</strong> · DNI: <strong>${selectedPacDni || "-"}</strong> · Grupo Sanguíneo: <strong>${fGrupo || "-"}</strong></p>
      <div style="background:#fef2f2;border:1px solid #fecaca;padding:10px 12px;border-radius:10px;margin-bottom:14px;"><strong>Alergias / Alertas:</strong> ${fAlergias || "Sin alergias registradas"} ${fAlertas ? `· ${fAlertas}` : ""}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;font-size:13px;">
        <div><strong>Antecedentes Personales:</strong> ${fAntPers || "-"}</div>
        <div><strong>Medicación Crónica:</strong> ${fMedCronica || "-"}</div>
        <div><strong>Antecedentes Familiares:</strong> ${fAntFam || "-"}</div>
        <div><strong>Antecedentes Quirúrgicos:</strong> ${fAntQuir || "-"}</div>
      </div>
      <h2 style="color:#1B335D;border-bottom:2px solid #0099D8;padding-bottom:4px;">Evoluciones Clínicas (${activePatientEvoluciones.length})</h2>
      ${evRows || "<p>Sin evoluciones registradas.</p>"}
      <script>window.print();</script>
    </body></html>`);
    w.document.close();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Portal de Profesionales CEMEP"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B335D]/75 p-2 backdrop-blur-sm sm:p-4"
    >
      <div className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-[#FFFFFF] shadow-2xl">
        {/* Header */}
        <div
          className="flex items-center justify-between gap-4 px-5 py-4 text-[#FFFFFF] sm:px-7"
          style={{
            background: "linear-gradient(135deg, #1B335D 0%, #0A5E8A 55%, #57B7B8 100%)",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFFFFF]/15">
              <Stethoscope className="h-5 w-5 text-[#A6CA0E]" />
            </span>
            <div>
              <h2 className="text-lg font-black tracking-tight sm:text-xl">
                Portal de Profesionales · Gestión Consultorios
              </h2>
              <p className="text-xs text-[#FFFFFF]/85">
                {bundle
                  ? `${bundle.profesional.titulo ? `${bundle.profesional.titulo} ` : ""}${bundle.profesional.nombre}${bundle.profesional.isAdminAllView ? " · Vista Completa del Centro" : ""}`
                  : "Accedé a tus turnos dados, Historia Clínica integral y carga de estudios a pacientes"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {bundle && (
              <button
                type="button"
                onClick={async () => {
                  await postAction({ action: "prof_logout" });
                  onBundleChange(null);
                  setMsg(null);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#FFFFFF]/15 px-3 py-2 text-xs font-bold text-[#FFFFFF] hover:bg-[#FFFFFF]/25"
              >
                <LogOut className="h-3.5 w-3.5" />
                Salir
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar Portal de Profesionales"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-[#FFFFFF]/15 text-[#FFFFFF] hover:bg-[#FFFFFF]/25"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {msg && (
            <div
              className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                msg.isErr
                  ? "border-[#FECDD3] bg-[#FFF1F2] text-[#9F1239]"
                  : "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]"
              }`}
            >
              {msg.text}
            </div>
          )}

          {!bundle ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await postAction({
                  action: "prof_login",
                  identifier,
                  password,
                });
              }}
              className="mx-auto my-4 max-w-md space-y-4 rounded-3xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-6"
            >
              <div className="text-center">
                <h3 className="text-lg font-black text-[#1B335D]">
                  Ingreso de Profesionales de la Salud
                </h3>
                <p className="mt-1 text-xs text-[#475569]">
                  Ingresá con tu <strong>DNI o Correo</strong> habilitado en Gestión Web, o con tu{" "}
                  <strong>usuario de MiniSistema ERP</strong>.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">
                  DNI, Correo o Usuario ERP
                </label>
                <input
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Ej: 32456789 / medico@cemep.com / danielg"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">Contraseña</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-2.5 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full cursor-pointer rounded-xl bg-[#1B335D] py-3 text-sm font-extrabold text-[#FFFFFF] shadow-md hover:bg-[#0A74A6]"
              >
                {busy ? "Ingresando..." : "Acceder al Panel Profesional"}
              </button>
            </form>
          ) : (
            <div>
              {/* KPIs rápidos */}
              <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                  <div className="text-[11px] font-bold uppercase text-[#64748B]">Turnos Hoy</div>
                  <div className="text-2xl font-black text-[#1B335D]">
                    {bundle.turnos.filter((t) => t.fecha === today).length}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                  <div className="text-[11px] font-bold uppercase text-[#64748B]">Pacientes</div>
                  <div className="text-2xl font-black text-[#0099D8]">{bundle.pacientes.length}</div>
                </div>
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                  <div className="text-[11px] font-bold uppercase text-[#64748B]">
                    Estudios Cargados
                  </div>
                  <div className="text-2xl font-black text-[#0B7A75]">{bundle.estudios.length}</div>
                </div>
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                  <div className="text-[11px] font-bold uppercase text-[#64748B]">
                    Recetas Pendientes
                  </div>
                  <div className="text-2xl font-black text-[#D97706]">
                    {
                      bundle.recetas.filter(
                        (r) => r.estado === "solicitada" || r.estado === "en_proceso"
                      ).length
                    }
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="mb-5 flex flex-wrap gap-2 border-b border-[#E2E8F0] pb-3">
                {[
                  { id: "turnos", label: "Turnos Dados", icon: CalendarCheck2 },
                  { id: "hc", label: "Historia Clínica", icon: ClipboardList },
                  { id: "estudios", label: "Cargar Estudios", icon: FileUp },
                  { id: "recetas", label: "Recetas Digitales", icon: Pill },
                ].map((t) => {
                  const Icon = t.icon;
                  const active = dashTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDashTab(t.id as any)}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
                        active
                          ? "bg-[#1B335D] text-[#FFFFFF] shadow"
                          : "bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: TURNOS DADOS */}
              {dashTab === "turnos" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-1.5">
                      {(["hoy", "proximos", "todos"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setTurnoFilter(m)}
                          className={`cursor-pointer rounded-xl px-3 py-1.5 text-xs font-extrabold ${
                            turnoFilter === m
                              ? "bg-[#0099D8] text-[#FFFFFF]"
                              : "bg-[#F1F5F9] text-[#334155]"
                          }`}
                        >
                          {m === "hoy" ? "Hoy" : m === "proximos" ? "Próximos" : "Todos"}
                        </button>
                      ))}
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[#94A3B8]" />
                      <input
                        value={turnoSearch}
                        onChange={(e) => setTurnoSearch(e.target.value)}
                        placeholder="Buscar paciente, DNI o código..."
                        className="w-full rounded-xl border border-[#CBD5E1] py-2 pr-3 pl-9 text-xs"
                      />
                    </div>
                  </div>

                  {filteredTurnos.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#CBD5E1] p-8 text-center text-xs text-[#64748B]">
                      No hay turnos para el filtro seleccionado.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredTurnos.map((t) => (
                        <div
                          key={t.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-4"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-lg bg-[#1B335D] px-2.5 py-0.5 text-xs font-black text-[#FFFFFF]">
                                {t.fecha} · {t.horaInicio}
                              </span>
                              <span className="text-xs font-bold text-[#64748B]">{t.codigo}</span>
                              <span className="rounded-full bg-[#E0F2FE] px-2.5 py-0.5 text-[11px] font-extrabold text-[#0A74A6]">
                                {t.especialidadNombre}
                              </span>
                            </div>
                            <div className="mt-1 text-sm font-extrabold text-[#1B335D]">
                              {t.pacienteNombreCompleto}{" "}
                              <span className="text-xs font-semibold text-[#64748B]">
                                · DNI {t.pacienteDni}
                              </span>
                            </div>
                            <div className="text-xs text-[#475569]">
                              Profesional: {t.profesionalNombre} ·{" "}
                              {t.coberturaTipo === "particular"
                                ? "Particular"
                                : t.obraSocialNombre || "Obra Social"}{" "}
                              · {t.modalidad === "videollamada" ? "Videollamada" : "Presencial"}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={t.estado}
                              onChange={async (e) => {
                                await postAction({
                                  action: "prof_update_turno_estado",
                                  turnoId: t.id,
                                  estado: e.target.value as TurnoEstado,
                                });
                              }}
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs font-bold text-[#1B335D]"
                            >
                              <option value="pendiente">Pendiente</option>
                              <option value="confirmado">Confirmado</option>
                              <option value="en_sala">En sala</option>
                              <option value="atendido">Atendido</option>
                              <option value="ausente">Ausente</option>
                              <option value="cancelado">Cancelado</option>
                            </select>

                            {t.modalidad === "videollamada" && t.video?.roomCode && (
                              <a
                                href={`/turnos?sala=${encodeURIComponent(t.video.roomCode)}&rol=profesional`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-xl bg-[#4F46E5] px-3 py-1.5 text-xs font-extrabold text-[#FFFFFF] hover:bg-[#4338CA]"
                              >
                                <Video className="h-3.5 w-3.5" />
                                Videollamada
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                loadPatientIntoHc(
                                  {
                                    pacienteId: t.pacienteId,
                                    dni: t.pacienteDni,
                                    nombreCompleto: t.pacienteNombreCompleto,
                                  },
                                  {
                                    id: t.id,
                                    codigo: t.codigo,
                                    especialidadNombre: t.especialidadNombre,
                                  }
                                )
                              }
                              className="cursor-pointer rounded-xl bg-[#0099D8] px-3 py-1.5 text-xs font-extrabold text-[#FFFFFF] hover:bg-[#0A74A6]"
                            >
                              Abrir Historia Clínica →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: HISTORIA CLÍNICA */}
              {dashTab === "hc" && (
                <div className="grid gap-5 lg:grid-cols-12">
                  {/* Columna izquierda: selector de pacientes */}
                  <div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-3.5 lg:col-span-4">
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[#94A3B8]" />
                      <input
                        value={pacSearch}
                        onChange={(e) => setPacSearch(e.target.value)}
                        placeholder="Buscar paciente por nombre o DNI..."
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] py-2 pr-3 pl-9 text-xs"
                      />
                    </div>
                    <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
                      {filteredPacientes.map((p) => {
                        const isSel = selectedPacDni === p.dni && selectedPacName === p.nombreCompleto;
                        return (
                          <button
                            key={`${p.pacienteId}-${p.dni}`}
                            type="button"
                            onClick={() => loadPatientIntoHc(p)}
                            className={`w-full cursor-pointer rounded-xl border p-2.5 text-left transition ${
                              isSel
                                ? "border-[#0099D8] bg-[#EBF7FD]"
                                : "border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#CBD5E1]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate text-xs font-extrabold text-[#1B335D]">
                                {p.nombreCompleto}
                              </span>
                              {p.esUsuarioRegistrado && (
                                <span className="shrink-0 rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[10px] font-extrabold text-[#047857]">
                                  Web
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#64748B]">
                              DNI: {p.dni || "—"} {p.obraSocial ? `· ${p.obraSocial}` : ""}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Columna derecha: Ficha + Evoluciones */}
                  <div className="space-y-4 lg:col-span-8">
                    {!selectedPacName ? (
                      <div className="rounded-2xl border border-dashed border-[#CBD5E1] p-10 text-center">
                        <ClipboardList className="mx-auto h-10 w-10 text-[#CBD5E1]" />
                        <p className="mt-2 text-sm font-bold text-[#1B335D]">
                          Seleccioná un paciente a la izquierda (o desde un turno)
                        </p>
                        <p className="text-xs text-[#64748B]">
                          Podrás consultar y actualizar antecedentes, alergias, evoluciones SOAP,
                          signos vitales y estudios adjuntos.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Encabezado paciente */}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#1B335D] p-4 text-[#FFFFFF]">
                          <div>
                            <div className="text-xs font-bold text-[#A6CA0E]">
                              HISTORIA CLÍNICA {linkedTurnoCode ? `· Turno ${linkedTurnoCode}` : ""}
                            </div>
                            <h3 className="text-lg font-black">{selectedPacName}</h3>
                            <div className="text-xs text-[#FFFFFF]/80">
                              DNI: {selectedPacDni || "Sin DNI"} · {activePatientEvoluciones.length}{" "}
                              evoluciones · {activePatientEstudios.length} estudios
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEstPacDni(selectedPacDni);
                                setDashTab("estudios");
                              }}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#0099D8] px-3 py-2 text-xs font-extrabold text-[#FFFFFF]"
                            >
                              <FileUp className="h-3.5 w-3.5" />
                              Cargar Estudio
                            </button>
                            <button
                              type="button"
                              onClick={handlePrintHc}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#FFFFFF]/15 px-3 py-2 text-xs font-extrabold text-[#FFFFFF] hover:bg-[#FFFFFF]/25"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              Imprimir HC
                            </button>
                          </div>
                        </div>

                        {fAlergias && (
                          <div className="flex items-start gap-2 rounded-2xl border border-[#FECDD3] bg-[#FFF1F2] p-3 text-xs font-bold text-[#9F1239]">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>ALERGIAS REGISTRADAS: {fAlergias}</span>
                          </div>
                        )}

                        {/* Ficha Médica Base */}
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            await postAction({
                              action: "prof_save_ficha",
                              ficha: {
                                pacienteId: selectedPacId,
                                pacienteDni: selectedPacDni,
                                pacienteNombre: selectedPacName,
                                grupoSanguineo: fGrupo,
                                alergias: fAlergias,
                                antecedentesPersonales: fAntPers,
                                antecedentesFamiliares: fAntFam,
                                antecedentesQuirurgicos: fAntQuir,
                                medicacionCronica: fMedCronica,
                                habitos: fHabitos,
                                alertasClinicas: fAlertas,
                              },
                            });
                          }}
                          className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-[#1B335D]">
                              Ficha Clínica y Antecedentes
                            </h4>
                            <button
                              type="submit"
                              disabled={busy}
                              className="cursor-pointer rounded-xl bg-[#1B335D] px-3.5 py-1.5 text-xs font-extrabold text-[#FFFFFF]"
                            >
                              Guardar Ficha
                            </button>
                          </div>
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            <input
                              value={fGrupo}
                              onChange={(e) => setFGrupo(e.target.value)}
                              placeholder="Grupo sanguíneo (Ej: O+)"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                            />
                            <input
                              value={fAlergias}
                              onChange={(e) => setFAlergias(e.target.value)}
                              placeholder="Alergias conocidas (medicamentos, alimentos...)"
                              className="rounded-xl border border-[#FECDD3] bg-[#FFFFFF] px-3 py-2 text-xs"
                            />
                            <input
                              value={fAntPers}
                              onChange={(e) => setFAntPers(e.target.value)}
                              placeholder="Antecedentes personales (HTA, DBT, etc.)"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                            />
                            <input
                              value={fMedCronica}
                              onChange={(e) => setFMedCronica(e.target.value)}
                              placeholder="Medicación crónica habitual"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                            />
                            <input
                              value={fAntFam}
                              onChange={(e) => setFAntFam(e.target.value)}
                              placeholder="Antecedentes familiares"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                            />
                            <input
                              value={fAntQuir}
                              onChange={(e) => setFAntQuir(e.target.value)}
                              placeholder="Antecedentes quirúrgicos / internaciones"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                            />
                            <input
                              value={fHabitos}
                              onChange={(e) => setFHabitos(e.target.value)}
                              placeholder="Hábitos (tabaco, ejercicio, sueño)"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                            />
                            <input
                              value={fAlertas}
                              onChange={(e) => setFAlertas(e.target.value)}
                              placeholder="Alertas clínicas importantes"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                            />
                          </div>
                        </form>

                        {/* Nueva Evolución SOAP */}
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const res = await postAction({
                              action: "prof_save_evolucion",
                              evolucion: {
                                pacienteId: selectedPacId,
                                pacienteDni: selectedPacDni,
                                pacienteNombre: selectedPacName,
                                turnoId: linkedTurnoId || undefined,
                                turnoCodigo: linkedTurnoCode || undefined,
                                especialidadNombre: evEsp,
                                motivoConsulta: evMotivo,
                                subjetivo: evSubjetivo,
                                objetivo: evObjetivo,
                                signosVitales: {
                                  ta: evTa,
                                  fc: evFc,
                                  temp: evTemp,
                                  pesoKg: evPeso,
                                  tallaCm: evTalla,
                                  satO2: evSat,
                                },
                                diagnostico: evDiag,
                                codigoCie10: evCie10,
                                planTerapeutico: evPlan,
                                indicacionesPaciente: evIndicaciones,
                              },
                            });
                            if (res?.ok) {
                              setEvMotivo("");
                              setEvSubjetivo("");
                              setEvObjetivo("");
                              setEvDiag("");
                              setEvCie10("");
                              setEvPlan("");
                              setEvIndicaciones("");
                            }
                          }}
                          className="space-y-3 rounded-2xl border border-[#0099D8]/30 bg-[#F4FAFD] p-4"
                        >
                          <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#1B335D]">
                            <FilePlus2 className="h-4 w-4 text-[#0099D8]" />
                            Registrar Nueva Evolución Clínica (SOAP)
                          </h4>
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            <input
                              value={evEsp}
                              onChange={(e) => setEvEsp(e.target.value)}
                              placeholder="Especialidad"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                            />
                            <input
                              required
                              value={evMotivo}
                              onChange={(e) => setEvMotivo(e.target.value)}
                              placeholder="Motivo de consulta *"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                            />
                          </div>
                          {/* Signos vitales */}
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                            <input
                              value={evTa}
                              onChange={(e) => setEvTa(e.target.value)}
                              placeholder="TA 120/80"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs"
                            />
                            <input
                              value={evFc}
                              onChange={(e) => setEvFc(e.target.value)}
                              placeholder="FC lpm"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs"
                            />
                            <input
                              value={evTemp}
                              onChange={(e) => setEvTemp(e.target.value)}
                              placeholder="Temp °C"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs"
                            />
                            <input
                              value={evPeso}
                              onChange={(e) => setEvPeso(e.target.value)}
                              placeholder="Peso kg"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs"
                            />
                            <input
                              value={evTalla}
                              onChange={(e) => setEvTalla(e.target.value)}
                              placeholder="Talla cm"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs"
                            />
                            <input
                              value={evSat}
                              onChange={(e) => setEvSat(e.target.value)}
                              placeholder="SatO2 %"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-1.5 text-xs"
                            />
                          </div>
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            <textarea
                              rows={2}
                              value={evSubjetivo}
                              onChange={(e) => setEvSubjetivo(e.target.value)}
                              placeholder="Subjetivo / Anamnesis"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                            />
                            <textarea
                              rows={2}
                              value={evObjetivo}
                              onChange={(e) => setEvObjetivo(e.target.value)}
                              placeholder="Objetivo / Examen físico"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                            />
                          </div>
                          <div className="grid gap-2.5 sm:grid-cols-3">
                            <input
                              required
                              value={evDiag}
                              onChange={(e) => setEvDiag(e.target.value)}
                              placeholder="Diagnóstico clínico *"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs sm:col-span-2"
                            />
                            <input
                              value={evCie10}
                              onChange={(e) => setEvCie10(e.target.value)}
                              placeholder="Código CIE-10 (opc.)"
                              className="rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                            />
                          </div>
                          <textarea
                            rows={2}
                            value={evPlan}
                            onChange={(e) => setEvPlan(e.target.value)}
                            placeholder="Plan terapéutico / Estudios solicitados / Indicaciones"
                            className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                          />
                          <button
                            type="submit"
                            disabled={busy}
                            className="cursor-pointer rounded-xl bg-[#0099D8] px-5 py-2.5 text-xs font-extrabold text-[#FFFFFF] hover:bg-[#0A74A6]"
                          >
                            {busy ? "Guardando..." : "Registrar Evolución en Historia Clínica"}
                          </button>
                        </form>

                        {/* Cronología de Evoluciones */}
                        <div className="space-y-2.5">
                          <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#1B335D]">
                            <Activity className="h-4 w-4 text-[#57B7B8]" />
                            Evoluciones Anteriores ({activePatientEvoluciones.length})
                          </h4>
                          {activePatientEvoluciones.length === 0 ? (
                            <p className="text-xs text-[#64748B]">
                              Sin evoluciones registradas aún para este paciente.
                            </p>
                          ) : (
                            activePatientEvoluciones.map((ev) => (
                              <div
                                key={ev.id}
                                className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-sm"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs font-black text-[#1B335D]">
                                    {ev.fecha} {ev.hora} · {ev.especialidadNombre}
                                  </span>
                                  <span className="text-[11px] font-semibold text-[#64748B]">
                                    {ev.profesionalNombre}
                                  </span>
                                </div>
                                <div className="mt-1.5 text-xs text-[#1E293B]">
                                  <strong>Motivo:</strong> {ev.motivoConsulta}
                                </div>
                                {ev.signosVitales &&
                                  Object.values(ev.signosVitales).some(Boolean) && (
                                    <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] font-bold text-[#0A74A6]">
                                      {ev.signosVitales.ta && <span>TA: {ev.signosVitales.ta}</span>}
                                      {ev.signosVitales.fc && <span>FC: {ev.signosVitales.fc}</span>}
                                      {ev.signosVitales.temp && (
                                        <span>T°: {ev.signosVitales.temp}</span>
                                      )}
                                      {ev.signosVitales.pesoKg && (
                                        <span>Peso: {ev.signosVitales.pesoKg}kg</span>
                                      )}
                                      {ev.signosVitales.imc && (
                                        <span>IMC: {ev.signosVitales.imc}</span>
                                      )}
                                      {ev.signosVitales.satO2 && (
                                        <span>SatO2: {ev.signosVitales.satO2}</span>
                                      )}
                                    </div>
                                  )}
                                {ev.subjetivo && (
                                  <div className="mt-1 text-xs text-[#334155]">
                                    <strong>Anamnesis:</strong> {ev.subjetivo}
                                  </div>
                                )}
                                {ev.objetivo && (
                                  <div className="mt-1 text-xs text-[#334155]">
                                    <strong>Examen físico:</strong> {ev.objetivo}
                                  </div>
                                )}
                                {ev.diagnostico && (
                                  <div className="mt-1 text-xs font-bold text-[#1B335D]">
                                    Diagnóstico: {ev.diagnostico}{" "}
                                    {ev.codigoCie10 ? `(${ev.codigoCie10})` : ""}
                                  </div>
                                )}
                                {ev.planTerapeutico && (
                                  <div className="mt-1 whitespace-pre-wrap text-xs text-[#334155]">
                                    <strong>Plan:</strong> {ev.planTerapeutico}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: CARGAR ESTUDIOS AL PACIENTE */}
              {dashTab === "estudios" && (
                <div className="grid gap-5 lg:grid-cols-5">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const chosen = bundle.pacientes.find((p) => p.dni === estPacDni);
                      const res = await postAction({
                        action: "prof_upload_estudio",
                        estudio: {
                          pacienteId: chosen?.pacienteId,
                          pacienteDni: chosen?.dni || estPacDni,
                          pacienteNombre: chosen?.nombreCompleto || `DNI ${estPacDni}`,
                          webUserId: chosen?.webUserId,
                          tipoEstudio: estTipo,
                          fechaEstudio: estFecha,
                          titulo: estTitulo,
                          descripcionInforme: estInforme,
                          visibleParaPaciente: estVisible,
                          archivoNombre: estFileName || undefined,
                          archivoMime: estFileMime || undefined,
                          archivoDataUrl: estFileDataUrl || undefined,
                        },
                      });
                      if (res?.ok) {
                        setEstTitulo("");
                        setEstInforme("");
                        setEstFileName("");
                        setEstFileMime("");
                        setEstFileDataUrl("");
                      }
                    }}
                    className="space-y-3 rounded-2xl border border-[#57B7B8]/40 bg-[#F2FBF9] p-4 lg:col-span-2"
                  >
                    <h3 className="flex items-center gap-2 text-sm font-black text-[#1B335D]">
                      <FileUp className="h-4 w-4 text-[#0099D8]" />
                      Cargar Estudio a Paciente
                    </h3>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[#334155]">
                        Paciente registrado / padrón *
                      </label>
                      <select
                        required
                        value={estPacDni}
                        onChange={(e) => setEstPacDni(e.target.value)}
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                      >
                        <option value="">Seleccionar paciente...</option>
                        {bundle.pacientes.map((p) => (
                          <option key={`${p.pacienteId}-${p.dni}`} value={p.dni}>
                            {p.nombreCompleto} — DNI {p.dni || "S/D"}{" "}
                            {p.esUsuarioRegistrado ? "✓ Usuario Web" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-[#334155]">Tipo</label>
                        <select
                          value={estTipo}
                          onChange={(e) => setEstTipo(e.target.value as EstudioTipo)}
                          className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-2 text-xs"
                        >
                          {ESTUDIO_TIPOS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-[#334155]">Fecha</label>
                        <input
                          type="date"
                          value={estFecha}
                          onChange={(e) => setEstFecha(e.target.value)}
                          className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-2 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[#334155]">
                        Título del estudio *
                      </label>
                      <input
                        required
                        value={estTitulo}
                        onChange={(e) => setEstTitulo(e.target.value)}
                        placeholder="Ej: Ecocardiograma Doppler Color"
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[#334155]">
                        Informe / Conclusiones
                      </label>
                      <textarea
                        rows={3}
                        value={estInforme}
                        onChange={(e) => setEstInforme(e.target.value)}
                        placeholder="Resultados, valores principales o indicaciones..."
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[#334155]">
                        Adjuntar PDF o Imagen (máx 4.5 MB)
                      </label>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) =>
                          handleFileRead(e.target.files?.[0], (name, mime, url) => {
                            setEstFileName(name);
                            setEstFileMime(mime);
                            setEstFileDataUrl(url);
                          })
                        }
                        className="w-full rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-2 text-xs"
                      />
                      {estFileName && (
                        <div className="mt-1 text-[11px] font-bold text-[#047857]">
                          Archivo listo: {estFileName}
                        </div>
                      )}
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[#1B335D]">
                      <input
                        type="checkbox"
                        checked={estVisible}
                        onChange={(e) => setEstVisible(e.target.checked)}
                      />
                      <UserCheck className="h-4 w-4 text-[#059669]" />
                      Visible inmediatamente en el Portal del Paciente
                    </label>
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full cursor-pointer rounded-xl bg-[#1B335D] py-2.5 text-xs font-extrabold text-[#FFFFFF] hover:bg-[#0A74A6]"
                    >
                      {busy ? "Subiendo..." : "Guardar y Publicar Estudio"}
                    </button>
                  </form>

                  <div className="space-y-2.5 lg:col-span-3">
                    <h3 className="text-sm font-black text-[#1B335D]">
                      Estudios Recientes ({bundle.estudios.length})
                    </h3>
                    {bundle.estudios.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#CBD5E1] p-8 text-center text-xs text-[#64748B]">
                        Todavía no hay estudios cargados.
                      </div>
                    ) : (
                      bundle.estudios.map((est) => (
                        <div
                          key={est.id}
                          className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-3.5 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <span className="rounded-full bg-[#E0F2FE] px-2 py-0.5 text-[10px] font-extrabold text-[#0A74A6]">
                                {est.tipoEstudio}
                              </span>{" "}
                              <span className="text-xs font-bold text-[#64748B]">
                                {est.fechaEstudio}
                              </span>
                              <div className="mt-1 text-sm font-extrabold text-[#1B335D]">
                                {est.titulo}
                              </div>
                              <div className="text-xs text-[#475569]">
                                Paciente: <strong>{est.pacienteNombre}</strong> (DNI{" "}
                                {est.pacienteDni || "—"}) ·{" "}
                                {est.visibleParaPaciente ? "Visible al paciente" : "Uso interno"}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {est.archivoDataUrl && (
                                <a
                                  href={est.archivoDataUrl}
                                  download={est.archivoNombre || `${est.titulo}.pdf`}
                                  className="inline-flex items-center gap-1 rounded-xl bg-[#F1F5F9] px-2.5 py-1.5 text-xs font-bold text-[#1B335D] hover:bg-[#E2E8F0]"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Ver
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!window.confirm("¿Eliminar este estudio?")) return;
                                  await postAction({ action: "prof_delete_estudio", id: est.id });
                                }}
                                className="cursor-pointer rounded-xl bg-[#FFF1F2] p-1.5 text-[#E11D48] hover:bg-[#FFE4E6]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: RECETAS */}
              {dashTab === "recetas" && (
                <div className="space-y-3">
                  <p className="text-xs text-[#475569]">
                    Solicitudes de recetas enviadas por pacientes registrados. Podés adjuntar la
                    receta digital en PDF/imagen o dejarla en proceso para administración.
                  </p>
                  {bundle.recetas.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#CBD5E1] p-8 text-center text-xs text-[#64748B]">
                      No hay solicitudes de recetas registradas.
                    </div>
                  ) : (
                    bundle.recetas.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-[#1B335D]">{r.codigo}</span>
                              <span className="rounded-full bg-[#FFFFFF] px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-[#0A74A6]">
                                {r.estado}
                              </span>
                            </div>
                            <div className="mt-1 text-sm font-extrabold text-[#1B335D]">
                              {r.pacienteNombre} · DNI {r.pacienteDni || "—"}
                            </div>
                            <div className="text-xs text-[#475569]">
                              {r.obraSocialNombre} {r.nroAfiliado ? `· Af. ${r.nroAfiliado}` : ""} ·{" "}
                              {r.pacienteEmail}
                            </div>
                            <div className="mt-2 rounded-xl bg-[#FFFFFF] p-2.5 text-xs font-semibold text-[#1E293B]">
                              {r.medicamentosSolicitados}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#059669] px-3.5 py-2 text-xs font-extrabold text-[#FFFFFF] hover:bg-[#047857]">
                              <FileUp className="h-3.5 w-3.5" />
                              Subir Receta Digital
                              <input
                                type="file"
                                accept=".pdf,image/*"
                                className="hidden"
                                onChange={(e) =>
                                  handleFileRead(e.target.files?.[0], async (name, mime, url) => {
                                    await postAction({
                                      action: "prof_update_receta",
                                      id: r.id,
                                      estado: "emitida",
                                      recetaArchivoNombre: name,
                                      recetaArchivoMime: mime,
                                      recetaArchivoDataUrl: url,
                                    });
                                  })
                                }
                              />
                            </label>
                            {r.recetaArchivoDataUrl && (
                              <a
                                href={r.recetaArchivoDataUrl}
                                download={r.recetaArchivoNombre || `${r.codigo}.pdf`}
                                className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#1B335D] px-3 py-1.5 text-xs font-bold text-[#FFFFFF]"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Descargar adjunta
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
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
