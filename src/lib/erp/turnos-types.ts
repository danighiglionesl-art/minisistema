// ============================================================================
// MINISISTEMA — MÓDULO "TURNERO WEB" — TIPOS Y MOTOR DE CÁLCULO
// ============================================================================

export const TURNO_DURATION_OPTIONS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60,
] as const;

export type TurnoDurationMinutes = (typeof TURNO_DURATION_OPTIONS)[number];

export type ObraSocialTipo =
  | "CCT" // Convenio Colectivo de Trabajo / Sindical (RNOS SSSalud)
  | "PREPAGA" // Empresa de Medicina Prepaga
  | "ESTATAL_PROVINCIAL" // Obras Sociales Provinciales / Estatales / Universitarias
  | "PAMI"; // INSSJP / Jubilados y Pensionados

export type TurnoModalidad = "presencial" | "videollamada";

export type TurnoCoberturaTipo = "obra_social" | "particular";

export type TurnoEstado =
  | "pendiente_pago"
  | "pendiente"
  | "confirmado"
  | "en_sala"
  | "atendido"
  | "ausente"
  | "cancelado";

export type OrganizadorTipo =
  | "Clínica"
  | "Consultorios Externos"
  | "Sanatorio"
  | "Staff de Profesionales"
  | "Centro Médico"
  | "Instituto / Policonsultorio";

export interface ObraSocialRecord {
  id: string;
  codigoRnos: string; // Código RNOS oficial SSSalud (o código interno prepaga)
  sigla: string;
  nombre: string;
  tipo: ObraSocialTipo;
  cuit?: string;
  telefono?: string;
  web?: string;
  observaciones?: string;
  activa: boolean;
  esCatalogoBase?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlanObraSocialRecord {
  id: string;
  obraSocialId: string;
  nombre: string;
  codigo?: string;
  requiereAutorizacion?: boolean;
  copagoSugeridoArs?: number;
  observaciones?: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EspecialidadRecord {
  id: string;
  nombre: string;
  categoria?: string;
  duracionMinutos: TurnoDurationMinutes;
  permiteVideollamada: boolean;
  valorConsultaParticularSugeridoArs: number;
  colorHex: string;
  descripcion?: string;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HorarioRangoAtencion {
  id: string;
  diaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Dom, 1=Lun ... 6=Sab
  horaInicio: string; // "08:00"
  horaFin: string; // "12:00"
  modalidad: "ambas" | "presencial" | "videollamada";
  consultorio?: string;
  especialidadId?: string; // Opcional: limitar rango a una especialidad específica
  slotsDeshabilitados?: string[]; // ej: ["10:00", "10:15"] dentro de este rango
  activo: boolean;
}

export interface AgendaBloqueoRecord {
  id: string;
  profesionalId: string; // "*" para feriado institucional
  fechaDesde: string; // YYYY-MM-DD
  fechaHasta: string; // YYYY-MM-DD
  horaDesde?: string; // Opcional HH:MM
  horaHasta?: string; // Opcional HH:MM
  motivo: string;
  createdAt: string;
}

export interface ProfesionalMpAccount {
  linked: boolean;
  mpUserId: string | null;
  mpPublicKey: string | null;
  mpAccountAlias: string | null;
  tokenStatus: "active" | "expired" | "disconnected";
  tokenExpiresAt: string | null;
  linkedAt: string | null;
  lastRefreshedAt: string | null;
  // Credenciales cifradas en servidor (nunca se envían al frontend)
  encryptedTokenPayload?: string | null;
  ivHex?: string | null;
  authTagHex?: string | null;
}

export interface ProfesionalRecord {
  id: string;
  dni: string;
  apellidos: string; // Separado según requerimiento
  nombres: string; // Separado según requerimiento
  nombreCompleto: string;
  titulo?: string; // Dr., Dra., Lic., Klgo., Od., etc.
  matriculaNacional?: string;
  matriculaProvincial?: string;
  email?: string;
  whatsapp?: string;
  especialidadIds: string[];
  obraSocialIds: string[]; // Obras sociales que atiende
  atiendeParticular: boolean;
  valorConsultaParticularArs: number; // Valor consulta particular general
  valorPorEspecialidadArs?: Record<string, number>; // Opcional por especialidad
  permitePresencial: boolean;
  permiteVideollamada: boolean;
  horarios: HorarioRangoAtencion[];
  mpAccount?: ProfesionalMpAccount;
  observaciones?: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PacienteRecord {
  id: string;
  dni: string;
  apellidos: string;
  nombres: string;
  nombreCompleto: string;
  fechaNacimiento: string; // YYYY-MM-DD
  edad?: number | null;
  genero?: string;
  whatsapp: string;
  telefonoAlternativo?: string;
  email?: string;
  domicilio?: string;
  localidad?: string;
  provincia?: string;
  obraSocialId?: string;
  planId?: string;
  nroAfiliado?: string;
  origenRegistro: "WEB" | "MANUAL";
  observaciones?: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SplitCommissionSnapshot {
  organizadorPct: number;
  profesionalPct: number;
  ruleSource: "profesional_exception" | "modality_preset" | "default_general";
  ruleLabel: string;
  capturedAt: string;
}

export interface TurnoPagoInfo {
  requerido: boolean;
  estado: "no_aplica" | "pending" | "approved" | "rejected" | "refunded" | "cancelled";
  montoTotalArs: number;
  organizadorPct: number;
  profesionalPct: number;
  organizadorFeeArs: number; // marketplace_fee en ARS
  profesionalBrutoArs: number;
  mpProcessorFeeEstimadoArs: number;
  profesionalNetoEstimadoArs: number;
  commissionSnapshot?: SplitCommissionSnapshot;
  preferenceId?: string | null;
  mpPaymentId?: string | null;
  initPointUrl?: string | null;
  idempotencyKey?: string | null;
  paidAt?: string | null;
  providerMode?: "mercadopago_live" | "mercadopago_sandbox";
}

export interface TurnoVideoInfo {
  habilitada: boolean;
  roomCode: string;
  roomName: string;
  roomUrl?: string;
  providerMode?: "daily_api" | "daily_sandbox";
  status: "pendiente" | "activa" | "finalizada";
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface TurnoRecord {
  id: string;
  seq: number;
  codigo: string; // TRN-2026-0001
  origen: "WEB" | "MANUAL";
  esSobreturno?: boolean;
  fecha: string; // YYYY-MM-DD
  horaInicio: string; // HH:MM
  horaFin: string; // HH:MM
  duracionMinutos: number;
  especialidadId: string;
  especialidadNombre: string;
  profesionalId: string;
  profesionalNombre: string;
  profesionalDni: string;
  pacienteId: string;
  pacienteDni: string;
  pacienteApellidos: string;
  pacienteNombres: string;
  pacienteNombreCompleto: string;
  pacienteWhatsapp: string;
  pacienteEmail?: string;
  coberturaTipo: TurnoCoberturaTipo;
  obraSocialId?: string;
  obraSocialNombre?: string;
  planId?: string;
  planNombre?: string;
  nroAfiliado?: string;
  modalidad: TurnoModalidad;
  consultorio?: string;
  motivoConsulta?: string;
  observaciones?: string;
  estado: TurnoEstado;
  pago: TurnoPagoInfo;
  video?: TurnoVideoInfo;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfesionalSplitException {
  profesionalId: string;
  profesionalNombre: string;
  organizadorPct: number;
  profesionalPct: number;
  motivo: string;
  updatedBy: string;
  updatedAt: string;
}

export interface SplitAuditEntry {
  id: string;
  actor: string;
  targetLabel: string;
  previousOrganizadorPct: number | null;
  newOrganizadorPct: number;
  newProfesionalPct: number;
  changedAt: string;
}

export interface TurnosSplitConfig {
  organizadorNombre: string;
  organizadorTipo: OrganizadorTipo;
  habilitarPagoOnlineParticular: boolean;
  pagoObligatorioParaConfirmarParticular: boolean;
  defaultOrganizadorPct: number; // ej: 20% Organizador / 80% Profesional
  presencialOrganizadorPct: number;
  videollamadaOrganizadorPct: number;
  profesionalExceptions: Record<string, ProfesionalSplitException>;
  mpMarketplaceClientId?: string;
  mpOrganizadorAlias?: string;
  auditLog: SplitAuditEntry[];
  updatedAt: string;
}

export interface TurnosSplitTransaction {
  id: string;
  turnoId: string;
  turnoCodigo: string;
  idempotencyKey: string;
  preferenceId: string;
  mpPaymentId: string | null;
  providerMode: "mercadopago_live" | "mercadopago_sandbox";
  profesionalId: string;
  profesionalNombre: string;
  profesionalMpUserId: string;
  pacienteDni: string;
  pacienteNombre: string;
  especialidadNombre: string;
  modalidad: TurnoModalidad;
  fechaTurno: string;
  horaTurno: string;
  montoTotalArs: number;
  organizadorFeeArs: number;
  profesionalBrutoArs: number;
  mpProcessorFeeEstimadoArs: number;
  profesionalNetoEstimadoArs: number;
  commissionSnapshot: SplitCommissionSnapshot;
  status: "pending" | "approved" | "rejected" | "refunded" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface TurnosPortalConfig {
  tituloPortal: string;
  subtituloPortal: string;
  direccionConsultorio: string;
  whatsappRecepcion: string;
  emailRecepcion: string;
  diasAnticipacionMax: number; // ej: 60 días
  minutosAnticipacionMin: number; // ej: 30 min antes
  permitirCancelacionPacienteHoras: number; // ej: hasta 4 hs antes
  mensajeConfirmacion?: string;
  updatedAt: string;
}

export interface TurnosDbDoc {
  updatedAt: string;
  lastTurnoSeq: number;
  portalConfig: TurnosPortalConfig;
  splitConfig: TurnosSplitConfig;
  obrasSociales: ObraSocialRecord[];
  planes: PlanObraSocialRecord[];
  especialidades: EspecialidadRecord[];
  profesionales: ProfesionalRecord[];
  bloqueos: AgendaBloqueoRecord[];
  pacientes: PacienteRecord[];
  turnos: TurnoRecord[];
  transaccionesMp: TurnosSplitTransaction[];
}

export const ESTIMATED_MP_FEE_RATE = 0.0499; // 4.99% estimado Mercado Pago

export function round2(val: number): number {
  return Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;
}

export function clampPct(val: number): number {
  const n = Number(val);
  if (Number.isNaN(n) || n < 0) return 0;
  if (n > 100) return 100;
  return round2(n);
}

export function normalizeDni(raw: string): string {
  return String(raw || "").replace(/\D/g, "").slice(0, 12);
}

export function computeAge(isoDate: string): number | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) {
    age--;
  }
  return age >= 0 && age <= 120 ? age : null;
}

export function timeToMinutes(hhmm: string): number {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return -1;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return -1;
  return h * 60 + min;
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.floor(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function normalizeTurnoDuration(raw: unknown): TurnoDurationMinutes {
  const n = Number(raw);
  if ((TURNO_DURATION_OPTIONS as readonly number[]).includes(n)) {
    return n as TurnoDurationMinutes;
  }
  // Redondear al múltiplo de 5 más cercano entre 5 y 60
  const snapped = Math.max(5, Math.min(60, Math.round((n || 20) / 5) * 5));
  return snapped as TurnoDurationMinutes;
}

export function resolveTurnosCommission(
  splitConfig: TurnosSplitConfig,
  modalidad: TurnoModalidad,
  profesionalId?: string
): SplitCommissionSnapshot {
  const nowIso = new Date().toISOString();

  if (profesionalId && splitConfig.profesionalExceptions?.[profesionalId]) {
    const exc = splitConfig.profesionalExceptions[profesionalId];
    const orgPct = clampPct(exc.organizadorPct);
    return {
      organizadorPct: orgPct,
      profesionalPct: round2(100 - orgPct),
      ruleSource: "profesional_exception",
      ruleLabel: `Acuerdo individual (${exc.profesionalNombre}): ${orgPct}% ${splitConfig.organizadorTipo} / ${round2(100 - orgPct)}% Profesional`,
      capturedAt: nowIso,
    };
  }

  const presetPct =
    modalidad === "videollamada"
      ? splitConfig.videollamadaOrganizadorPct
      : splitConfig.presencialOrganizadorPct;

  if (typeof presetPct === "number" && !Number.isNaN(presetPct)) {
    const orgPct = clampPct(presetPct);
    return {
      organizadorPct: orgPct,
      profesionalPct: round2(100 - orgPct),
      ruleSource: "modality_preset",
      ruleLabel:
        modalidad === "videollamada"
          ? `Modalidad Videollamada Particular (${orgPct}% ${splitConfig.organizadorTipo} / ${round2(100 - orgPct)}% Profesional)`
          : `Modalidad Presencial Particular (${orgPct}% ${splitConfig.organizadorTipo} / ${round2(100 - orgPct)}% Profesional)`,
      capturedAt: nowIso,
    };
  }

  const defOrg = clampPct(splitConfig.defaultOrganizadorPct ?? 20);
  return {
    organizadorPct: defOrg,
    profesionalPct: round2(100 - defOrg),
    ruleSource: "default_general",
    ruleLabel: `Distribución General (${defOrg}% ${splitConfig.organizadorTipo} / ${round2(100 - defOrg)}% Profesional)`,
    capturedAt: nowIso,
  };
}

export function calculateTurnosSplit(
  montoTotalArs: number,
  organizadorPct: number
): {
  montoTotalArs: number;
  organizadorPct: number;
  profesionalPct: number;
  organizadorFeeArs: number;
  profesionalBrutoArs: number;
  mpProcessorFeeEstimadoArs: number;
  profesionalNetoEstimadoArs: number;
} {
  const safeTotal = Math.max(0, round2(montoTotalArs));
  const safeOrgPct = clampPct(organizadorPct);
  const safeProfPct = round2(100 - safeOrgPct);
  const organizadorFeeArs = round2((safeTotal * safeOrgPct) / 100);
  const profesionalBrutoArs = round2(safeTotal - organizadorFeeArs);
  const mpProcessorFeeEstimadoArs = round2(safeTotal * ESTIMATED_MP_FEE_RATE);
  const profesionalNetoEstimadoArs = Math.max(
    0,
    round2(profesionalBrutoArs - mpProcessorFeeEstimadoArs)
  );
  return {
    montoTotalArs: safeTotal,
    organizadorPct: safeOrgPct,
    profesionalPct: safeProfPct,
    organizadorFeeArs,
    profesionalBrutoArs,
    mpProcessorFeeEstimadoArs,
    profesionalNetoEstimadoArs,
  };
}

export interface ComputedSlotItem {
  horaInicio: string;
  horaFin: string;
  duracionMinutos: number;
  disponible: boolean;
  motivoNoDisponible?: string;
  modalidadPermitida: "ambas" | "presencial" | "videollamada";
  consultorio?: string;
  rangoId: string;
}

/**
 * Genera todos los slots horarios de un profesional para una fecha (YYYY-MM-DD)
 * respetando:
 * - Lapso horario exacto de la especialidad (5, 10, 15, ..., 60 min)
 * - Rangos horarios configurados para ese día de la semana
 * - Slots deshabilitados manualmente dentro del rango
 * - Bloqueos de agenda / feriados / licencias
 * - Turnos ya asignados (no cancelados)
 */
export function computeProfessionalDaySlots(params: {
  profesional: ProfesionalRecord;
  especialidad: EspecialidadRecord;
  fechaIso: string; // YYYY-MM-DD
  modalidadFiltro?: TurnoModalidad | "todas";
  turnosExistentes: TurnoRecord[];
  bloqueos: AgendaBloqueoRecord[];
  incluirOcupados?: boolean;
}): ComputedSlotItem[] {
  const {
    profesional,
    especialidad,
    fechaIso,
    modalidadFiltro = "todas",
    turnosExistentes,
    bloqueos,
    incluirOcupados = true,
  } = params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIso)) return [];
  const d = new Date(`${fechaIso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return [];
  const diaSemana = d.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const dur = normalizeTurnoDuration(especialidad.duracionMinutos);

  const dayRanges = (profesional.horarios || []).filter((h) => {
    if (!h.activo) return false;
    if (Number(h.diaSemana) !== diaSemana) return false;
    if (h.especialidadId && h.especialidadId !== especialidad.id) return false;
    if (modalidadFiltro !== "todas") {
      if (h.modalidad !== "ambas" && h.modalidad !== modalidadFiltro) return false;
    }
    return true;
  });

  if (dayRanges.length === 0) return [];

  // Verificar bloqueos que cubren esta fecha
  const activeBloqueos = (bloqueos || []).filter((b) => {
    if (b.profesionalId !== "*" && b.profesionalId !== profesional.id) return false;
    return fechaIso >= b.fechaDesde && fechaIso <= b.fechaHasta;
  });

  // Turnos ya ocupados ese día para ese profesional (que no estén cancelados)
  const busyTurnos = (turnosExistentes || []).filter(
    (t) =>
      t.profesionalId === profesional.id &&
      t.fecha === fechaIso &&
      t.estado !== "cancelado"
  );

  const slotsMap = new Map<string, ComputedSlotItem>();

  for (const r of dayRanges) {
    const startMin = timeToMinutes(r.horaInicio);
    const endMin = timeToMinutes(r.horaFin);
    if (startMin < 0 || endMin <= startMin) continue;

    const disabledSet = new Set(r.slotsDeshabilitados || []);

    for (let cursor = startMin; cursor + dur <= endMin; cursor += dur) {
      const slotStart = minutesToTime(cursor);
      const slotEnd = minutesToTime(cursor + dur);
      if (slotsMap.has(slotStart)) continue;

      let disponible = true;
      let motivoNoDisponible: string | undefined;

      if (disabledSet.has(slotStart)) {
        disponible = false;
        motivoNoDisponible = "Horario bloqueado en agenda";
      }

      if (disponible && activeBloqueos.length > 0) {
        for (const b of activeBloqueos) {
          if (!b.horaDesde || !b.horaHasta) {
            disponible = false;
            motivoNoDisponible = b.motivo || "Día no laborable / Licencia";
            break;
          }
          const bStart = timeToMinutes(b.horaDesde);
          const bEnd = timeToMinutes(b.horaHasta);
          if (bStart >= 0 && bEnd > bStart && cursor < bEnd && cursor + dur > bStart) {
            disponible = false;
            motivoNoDisponible = b.motivo || "Franja bloqueada";
            break;
          }
        }
      }

      if (disponible) {
        const overlapping = busyTurnos.find((t) => {
          const ts = timeToMinutes(t.horaInicio);
          const te = timeToMinutes(t.horaFin);
          return ts >= 0 && te > ts && cursor < te && cursor + dur > ts;
        });
        if (overlapping) {
          disponible = false;
          motivoNoDisponible = `Ocupado (${overlapping.codigo})`;
        }
      }

      if (disponible || incluirOcupados) {
        slotsMap.set(slotStart, {
          horaInicio: slotStart,
          horaFin: slotEnd,
          duracionMinutos: dur,
          disponible,
          motivoNoDisponible,
          modalidadPermitida: r.modalidad,
          consultorio: r.consultorio || "",
          rangoId: r.id,
        });
      }
    }
  }

  return Array.from(slotsMap.values()).sort((a, b) =>
    a.horaInicio.localeCompare(b.horaInicio)
  );
}

/**
 * Parsea la cadena cruda del código de barras PDF417 del DNI tarjeta argentino.
 * Formato habitual (nuevo ejemplar 2012+):
 * NRO_TRAMITE@APELLIDO@NOMBRE@SEXO@DNI@EJEMPLAR@DD/MM/YYYY@FECHA_EMISION@...
 */
export function parseArgentineDniPdf417(raw: string): {
  dni: string;
  apellidos: string;
  nombres: string;
  fechaNacimiento: string;
  genero: string;
} | null {
  const parts = String(raw || "").split("@").map((p) => p.trim());
  if (parts.length < 7) return null;

  // Formato nuevo (empieza con N° trámite de 11 dígitos)
  let apellidos = "";
  let nombres = "";
  let sexo = "";
  let dni = "";
  let rawBirth = "";

  if (/^\d{8,15}$/.test(parts[0]) && /^\d{7,9}$/.test(parts[4].replace(/\D/g, ""))) {
    apellidos = parts[1];
    nombres = parts[2];
    sexo = parts[3];
    dni = parts[4].replace(/\D/g, "");
    rawBirth = parts[6];
  } else if (parts.length >= 8 && /^\d{7,9}$/.test(parts[1].replace(/\D/g, ""))) {
    // Formato anterior: ""@DNI@EJEMPLAR@1@APELLIDO@NOMBRE@NACIONALIDAD@DD/MM/YYYY@SEXO
    dni = parts[1].replace(/\D/g, "");
    apellidos = parts[4] || "";
    nombres = parts[5] || "";
    rawBirth = parts[7] || "";
    sexo = parts[8] || "";
  } else {
    return null;
  }

  let fechaNacimiento = "";
  const mDate = rawBirth.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mDate) {
    fechaNacimiento = `${mDate[3]}-${mDate[2]}-${mDate[1]}`;
  }

  const genero =
    sexo.toUpperCase() === "M"
      ? "Masculino"
      : sexo.toUpperCase() === "F"
        ? "Femenino"
        : sexo.toUpperCase() === "X"
          ? "No binario (X)"
          : "";

  if (!dni || !apellidos || !nombres) return null;
  return { dni, apellidos, nombres, fechaNacimiento, genero };
}
