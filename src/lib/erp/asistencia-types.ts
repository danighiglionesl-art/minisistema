export type AsistenciaAuthProvider = "google" | "email" | "employer_managed";

export interface AsistenciaSchedule {
  horaIngreso: string; // "HH:MM" 24h
  horaEgreso: string; // "HH:MM" 24h
  toleranciaIngresoMin: number; // minutos de gracia para llegada tarde
  toleranciaEgresoMin: number; // minutos de gracia para salida temprana / tarde / extras
  diasLaborales: number[]; // 0=Dom, 1=Lun, ..., 6=Sab
}

export interface AsistenciaWorkplaceGeo {
  enabled: boolean;
  label: string;
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
}

export interface AsistenciaConfig {
  googleClientId: string;
  allowSelfRegistration: boolean;
  trackingIntervalSec: number; // intervalo sugerido de envío GPS durante la jornada
  defaultSchedule: AsistenciaSchedule;
  workplaceGeo: AsistenciaWorkplaceGeo;
}

export interface AsistenciaEmployeeProfile {
  apellidos: string;
  nombres: string;
  nombreCompleto: string;
  dni: string;
  fechaNacimiento: string; // YYYY-MM-DD
  whatsappPais: string;
  whatsappPrefijo: string;
  whatsappNumero: string;
  whatsappCompleto: string;
  calle: string;
  numero: string;
  piso: string;
  dpto: string;
  torre: string;
  barrio: string;
  provincia: string;
  localidad: string;
  domicilioCompleto: string;
  whatsappUrgenciasPais: string;
  whatsappUrgenciasPrefijo: string;
  whatsappUrgenciasNumero: string;
  whatsappUrgenciasCompleto: string;
  whatsappUrgenciasContacto?: string;
}

export interface AsistenciaBiometricCredential {
  credentialId: string;
  method: "webauthn_platform" | "face_capture_verified";
  deviceLabel: string;
  registeredAt: string;
  lastUsedAt: string;
  authenticatorAttachment?: string;
  faceTemplateHash?: string;
}

export interface AsistenciaEmployeeScheduleOverride extends AsistenciaSchedule {
  useCustom: boolean;
}

export interface AsistenciaEmployeeRecord {
  id: string;
  authProvider: AsistenciaAuthProvider;
  googleSub?: string;
  email: string;
  username: string;
  passwordHash?: string;
  createdByEmployer: boolean;
  mustCompleteProfile: boolean;
  active: boolean;
  deleted?: boolean;
  puesto?: string;
  sector?: string;
  profile: AsistenciaEmployeeProfile;
  scheduleOverride: AsistenciaEmployeeScheduleOverride;
  biometrics: {
    enrolled: boolean;
    enrolledAt: string | null;
    credentials: AsistenciaBiometricCredential[];
  };
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export type SafeAsistenciaEmployee = Omit<
  AsistenciaEmployeeRecord,
  "passwordHash"
>;

export interface AsistenciaGeoFix {
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: string;
  distanceMeters?: number | null;
}

export interface AsistenciaBiometricProof {
  verified: boolean;
  method: "webauthn_platform" | "face_capture_verified" | "admin_close";
  credentialId?: string;
  verifiedAt: string;
  deviceInfo?: string;
}

export interface AsistenciaTrackPoint {
  ts: string; // ISO
  lat: number;
  lng: number;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
  event?: "checkin" | "track" | "checkout";
}

export interface AsistenciaShiftMetrics {
  workedMinutes: number;
  scheduledMinutes: number;
  lateArrivalMinutes: number; // > 0 si ingresó después de horaIngreso + toleranciaIngresoMin
  earlyArrivalMinutes: number; // > 0 si ingresó antes de horaIngreso
  earlyDepartureMinutes: number; // > 0 si egresó antes de horaEgreso - toleranciaEgresoMin
  lateDepartureMinutes: number; // > 0 si egresó después de horaEgreso + toleranciaEgresoMin
  overtimeMinutes: number; // minutos extras sobre jornada programada
  netDeviationMinutes: number; // workedMinutes - scheduledMinutes
  flags: string[];
}

export interface AsistenciaShiftRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeDni: string;
  fecha: string; // YYYY-MM-DD (America/Argentina/Buenos_Aires)
  status: "active" | "completed" | "closed_by_admin";
  scheduledIngreso: string; // HH:MM
  scheduledEgreso: string; // HH:MM
  toleranciaIngresoMin: number;
  toleranciaEgresoMin: number;
  checkInAt: string;
  checkInLocalTime: string; // HH:MM
  checkInGeo: AsistenciaGeoFix;
  checkInBiometric: AsistenciaBiometricProof;
  checkOutAt: string | null;
  checkOutLocalTime: string | null;
  checkOutGeo: AsistenciaGeoFix | null;
  checkOutBiometric: AsistenciaBiometricProof | null;
  metrics: AsistenciaShiftMetrics;
  trackPoints: AsistenciaTrackPoint[];
  totalDistanceKm: number;
  lastPingAt: string | null;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AsistenciaDbDoc {
  updatedAt: string;
  config: AsistenciaConfig;
  employees: AsistenciaEmployeeRecord[];
  shifts: AsistenciaShiftRecord[];
}

export const ASISTENCIA_DOC_KEY = "asistencia_db";
export const ARGENTINA_TZ = "America/Argentina/Buenos_Aires";

export const ASISTENCIA_WHATSAPP_COUNTRIES = [
  { country: "Argentina", prefix: "+549", label: "Argentina (+54 9)" },
  { country: "Uruguay", prefix: "+598", label: "Uruguay (+598)" },
  { country: "Paraguay", prefix: "+595", label: "Paraguay (+595)" },
  { country: "Chile", prefix: "+56", label: "Chile (+56)" },
  { country: "Brasil", prefix: "+55", label: "Brasil (+55)" },
  { country: "Bolivia", prefix: "+591", label: "Bolivia (+591)" },
  { country: "Perú", prefix: "+51", label: "Perú (+51)" },
  { country: "Colombia", prefix: "+57", label: "Colombia (+57)" },
  { country: "Ecuador", prefix: "+593", label: "Ecuador (+593)" },
  { country: "Venezuela", prefix: "+58", label: "Venezuela (+58)" },
  { country: "México", prefix: "+52", label: "México (+52)" },
  { country: "España", prefix: "+34", label: "España (+34)" },
  { country: "Estados Unidos / Canadá", prefix: "+1", label: "EE.UU. / Canadá (+1)" },
  { country: "Italia", prefix: "+39", label: "Italia (+39)" },
] as const;

export function buildDefaultSchedule(): AsistenciaSchedule {
  return {
    horaIngreso: "08:00",
    horaEgreso: "17:00",
    toleranciaIngresoMin: 10,
    toleranciaEgresoMin: 10,
    diasLaborales: [1, 2, 3, 4, 5],
  };
}

export function buildEmptyProfile(): AsistenciaEmployeeProfile {
  return {
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
    provincia: "",
    localidad: "",
    domicilioCompleto: "",
    whatsappUrgenciasPais: "Argentina",
    whatsappUrgenciasPrefijo: "+549",
    whatsappUrgenciasNumero: "",
    whatsappUrgenciasCompleto: "",
    whatsappUrgenciasContacto: "",
  };
}

export function buildInitialAsistenciaDb(): AsistenciaDbDoc {
  return {
    updatedAt: new Date().toISOString(),
    config: {
      googleClientId:
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
        process.env.GOOGLE_CLIENT_ID ||
        "",
      allowSelfRegistration: true,
      trackingIntervalSec: 60,
      defaultSchedule: buildDefaultSchedule(),
      workplaceGeo: {
        enabled: false,
        label: "Sede Principal",
        lat: null,
        lng: null,
        radiusMeters: 150,
      },
    },
    employees: [],
    shifts: [],
  };
}

export function normalizeDni(raw: unknown): string {
  return String(raw || "").replace(/\D/g, "").slice(0, 12);
}

export function normalizeUsername(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 40);
}

export function isValidTimeHHMM(val: unknown): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(val || "").trim());
}

export function timeToMinutes(hhmm: string): number {
  const m = String(hhmm || "").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function getArgentinaDateParts(isoOrDate: string | Date): {
  fecha: string;
  time: string;
  minutesOfDay: number;
} {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const hourNum = Number(map.hour || "0") % 24;
  const minNum = Number(map.minute || "0");
  const hh = String(hourNum).padStart(2, "0");
  const mm = String(minNum).padStart(2, "0");
  return {
    fecha: `${map.year}-${map.month}-${map.day}`,
    time: `${hh}:${mm}`,
    minutesOfDay: hourNum * 60 + minNum,
  };
}

export function composeDomicilio(p: Partial<AsistenciaEmployeeProfile>): string {
  const parts = [
    `${String(p.calle || "").trim()} ${String(p.numero || "").trim()}`.trim(),
    p.piso && p.piso !== "-" ? `Piso ${p.piso}` : "",
    p.dpto && p.dpto !== "-" ? `Dpto. ${p.dpto}` : "",
    p.torre && p.torre !== "-" ? `Torre ${p.torre}` : "",
    p.barrio ? `B° ${p.barrio}` : "",
    p.localidad ? p.localidad : "",
    p.provincia ? p.provincia : "",
  ].filter(Boolean);
  return parts.join(", ");
}

export function getMissingProfileFields(
  p: Partial<AsistenciaEmployeeProfile> | null | undefined
): string[] {
  if (!p) {
    return [
      "Apellido/s",
      "Nombre/s",
      "DNI",
      "Fecha de Nacimiento",
      "WhatsApp",
      "Calle",
      "Número",
      "Piso",
      "Dpto.",
      "Torre",
      "Barrio",
      "Provincia",
      "Localidad",
      "WhatsApp para urgencias",
    ];
  }
  const missing: string[] = [];
  if (!String(p.apellidos || "").trim()) missing.push("Apellido/s");
  if (!String(p.nombres || "").trim()) missing.push("Nombre/s");
  if (normalizeDni(p.dni).length < 6) missing.push("DNI");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.fechaNacimiento || "").trim())) {
    missing.push("Fecha de Nacimiento");
  }
  if (
    !String(p.whatsappPrefijo || "").trim() ||
    String(p.whatsappNumero || "").replace(/\D/g, "").length < 6
  ) {
    missing.push("WhatsApp");
  }
  if (!String(p.calle || "").trim()) missing.push("Calle");
  if (!String(p.numero || "").trim()) missing.push("Número");
  if (!String(p.piso || "").trim()) missing.push("Piso");
  if (!String(p.dpto || "").trim()) missing.push("Dpto.");
  if (!String(p.torre || "").trim()) missing.push("Torre");
  if (!String(p.barrio || "").trim()) missing.push("Barrio");
  if (!String(p.provincia || "").trim()) missing.push("Provincia");
  if (!String(p.localidad || "").trim()) missing.push("Localidad");
  if (
    !String(p.whatsappUrgenciasPrefijo || "").trim() ||
    String(p.whatsappUrgenciasNumero || "").replace(/\D/g, "").length < 6
  ) {
    missing.push("WhatsApp para urgencias");
  }
  return missing;
}

export function isProfileComplete(
  p: Partial<AsistenciaEmployeeProfile> | null | undefined
): boolean {
  return getMissingProfileFields(p).length === 0;
}

export function getEffectiveSchedule(
  emp: Pick<AsistenciaEmployeeRecord, "scheduleOverride">,
  config: AsistenciaConfig
): AsistenciaSchedule {
  if (emp.scheduleOverride?.useCustom) {
    return {
      horaIngreso: isValidTimeHHMM(emp.scheduleOverride.horaIngreso)
        ? emp.scheduleOverride.horaIngreso
        : config.defaultSchedule.horaIngreso,
      horaEgreso: isValidTimeHHMM(emp.scheduleOverride.horaEgreso)
        ? emp.scheduleOverride.horaEgreso
        : config.defaultSchedule.horaEgreso,
      toleranciaIngresoMin: Math.max(
        0,
        Number(emp.scheduleOverride.toleranciaIngresoMin ?? config.defaultSchedule.toleranciaIngresoMin)
      ),
      toleranciaEgresoMin: Math.max(
        0,
        Number(emp.scheduleOverride.toleranciaEgresoMin ?? config.defaultSchedule.toleranciaEgresoMin)
      ),
      diasLaborales:
        Array.isArray(emp.scheduleOverride.diasLaborales) &&
        emp.scheduleOverride.diasLaborales.length > 0
          ? emp.scheduleOverride.diasLaborales
          : config.defaultSchedule.diasLaborales,
    };
  }
  return config.defaultSchedule;
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function computeTrackDistanceKm(points: AsistenciaTrackPoint[]): number {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let totalMeters = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (
      !Number.isFinite(prev.lat) ||
      !Number.isFinite(prev.lng) ||
      !Number.isFinite(curr.lat) ||
      !Number.isFinite(curr.lng)
    ) {
      continue;
    }
    const seg = haversineMeters(prev.lat, prev.lng, curr.lat, curr.lng);
    // Filter impossible GPS teleportation spikes (> 50km in a single jump with poor accuracy)
    if (seg >= 3 && seg < 50000) {
      totalMeters += seg;
    }
  }
  return Math.round((totalMeters / 1000) * 100) / 100;
}

export function computeShiftMetrics(shift: {
  checkInAt: string;
  checkOutAt: string | null;
  scheduledIngreso: string;
  scheduledEgreso: string;
  toleranciaIngresoMin: number;
  toleranciaEgresoMin: number;
  status: "active" | "completed" | "closed_by_admin";
}): AsistenciaShiftMetrics {
  const schedInMin = timeToMinutes(shift.scheduledIngreso || "08:00");
  let schedOutMin = timeToMinutes(shift.scheduledEgreso || "17:00");
  const isOvernight = schedOutMin <= schedInMin;
  if (isOvernight) {
    schedOutMin += 24 * 60;
  }
  const scheduledMinutes = Math.max(1, schedOutMin - schedInMin);
  const tolIn = Math.max(0, Number(shift.toleranciaIngresoMin || 0));
  const tolOut = Math.max(0, Number(shift.toleranciaEgresoMin || 0));

  const inParts = getArgentinaDateParts(shift.checkInAt);
  const actualInMin = inParts.minutesOfDay;
  const arrivalDiff = actualInMin - schedInMin;

  const lateArrivalMinutes = arrivalDiff > tolIn ? arrivalDiff : 0;
  const earlyArrivalMinutes = arrivalDiff < 0 ? Math.abs(arrivalDiff) : 0;

  let workedMinutes = 0;
  let earlyDepartureMinutes = 0;
  let lateDepartureMinutes = 0;
  let overtimeMinutes = 0;
  let netDeviationMinutes = 0;

  const flags: string[] = [];
  if (lateArrivalMinutes > 0) {
    flags.push("llegada_tarde");
  }

  if (shift.checkOutAt) {
    const startMs = new Date(shift.checkInAt).getTime();
    const endMs = new Date(shift.checkOutAt).getTime();
    workedMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));

    const outParts = getArgentinaDateParts(shift.checkOutAt);
    let actualOutMin = outParts.minutesOfDay;
    if (outParts.fecha !== inParts.fecha || actualOutMin < actualInMin) {
      // Cruzó medianoche
      const dayDiffMs = endMs - startMs;
      const approxOut = actualInMin + Math.round(dayDiffMs / 60000);
      actualOutMin = approxOut;
    }

    const departDiff = actualOutMin - schedOutMin;
    if (departDiff < -tolOut) {
      earlyDepartureMinutes = Math.abs(departDiff);
      flags.push("salida_temprana");
    } else if (departDiff > tolOut) {
      lateDepartureMinutes = departDiff;
      flags.push("salida_tarde");
    }

    netDeviationMinutes = workedMinutes - scheduledMinutes;
    if (netDeviationMinutes > tolOut) {
      overtimeMinutes = netDeviationMinutes;
      flags.push("horas_extras");
    } else if (lateDepartureMinutes > 0 && netDeviationMinutes > 0) {
      overtimeMinutes = netDeviationMinutes;
      flags.push("horas_extras");
    }

    if (shift.status === "closed_by_admin") {
      flags.push("cierre_admin");
    }
    if (
      lateArrivalMinutes === 0 &&
      earlyDepartureMinutes === 0 &&
      lateDepartureMinutes === 0
    ) {
      flags.push("puntual");
    }
  } else {
    const startMs = new Date(shift.checkInAt).getTime();
    workedMinutes = Math.max(0, Math.round((Date.now() - startMs) / 60000));
    netDeviationMinutes = 0;
    flags.push("en_curso");
  }

  return {
    workedMinutes,
    scheduledMinutes,
    lateArrivalMinutes,
    earlyArrivalMinutes,
    earlyDepartureMinutes,
    lateDepartureMinutes,
    overtimeMinutes,
    netDeviationMinutes,
    flags,
  };
}
