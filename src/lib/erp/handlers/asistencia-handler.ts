import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/server/crypto-auth";
import {
  ASISTENCIA_DOC_KEY,
  type AsistenciaBiometricCredential,
  type AsistenciaBiometricProof,
  type AsistenciaConfig,
  type AsistenciaDbDoc,
  type AsistenciaEmployeeProfile,
  type AsistenciaEmployeeRecord,
  type AsistenciaGeoFix,
  type AsistenciaShiftRecord,
  type AsistenciaTrackPoint,
  buildDefaultSchedule,
  buildEmptyProfile,
  buildInitialAsistenciaDb,
  composeDomicilio,
  computeShiftMetrics,
  computeTrackDistanceKm,
  getArgentinaDateParts,
  getEffectiveSchedule,
  getMissingProfileFields,
  haversineMeters,
  isProfileComplete,
  isValidTimeHHMM,
  normalizeDni,
  normalizeUsername,
  type SafeAsistenciaEmployee,
} from "../asistencia-types";
import { extractErpSessionFromRequest } from "../erp-session";
import {
  getTenantDoc,
  listTenantUsersFromDb,
  putTenantDoc,
} from "../supabase-server";
import { type ErpTenantRecord, GENERAL_ADMIN_USERNAME } from "../types";

type AnyObj = Record<string, any>;

const EMP_SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14; // 14 días
const BIO_CHALLENGE_TTL_MS = 1000 * 60 * 5; // 5 minutos

function getSigningSecret(): string {
  return (
    process.env.ADMIN_AUTH_SECRET ||
    "minisistema_asistencia_hmac_secret_2026_prod"
  );
}

function getEmpCookieName(tenantSlug: string): string {
  const safe = tenantSlug.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  return `ms_asist_emp_${safe}`;
}

function getBioCookieName(tenantSlug: string): string {
  const safe = tenantSlug.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  return `ms_asist_bio_${safe}`;
}

interface EmpSessionPayload {
  employeeId: string;
  tenantSlug: string;
  exp: number;
}

interface BioChallengePayload {
  challenge: string; // base64url
  employeeId: string;
  tenantSlug: string;
  purpose: "enroll" | "checkin" | "checkout";
  exp: number;
}

function signPayload(obj: object): string {
  const data = Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

function verifySignedPayload<T extends { exp?: number }>(
  token: string | undefined | null
): T | null {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = crypto
    .createHmac("sha256", getSigningSecret())
    .update(data)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as T;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setEmpSessionCookie(
  res: NextResponse,
  tenantSlug: string,
  employeeId: string
): void {
  const token = signPayload({
    employeeId,
    tenantSlug,
    exp: Date.now() + EMP_SESSION_DURATION_MS,
  } satisfies EmpSessionPayload);
  res.cookies.set(getEmpCookieName(tenantSlug), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: EMP_SESSION_DURATION_MS / 1000,
  });
}

function clearEmpSessionCookie(res: NextResponse, tenantSlug: string): void {
  res.cookies.set(getEmpCookieName(tenantSlug), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function setBioChallengeCookie(
  res: NextResponse,
  tenantSlug: string,
  payload: BioChallengePayload
): void {
  const token = signPayload(payload);
  res.cookies.set(getBioCookieName(tenantSlug), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.ceil(BIO_CHALLENGE_TTL_MS / 1000),
  });
}

function clearBioChallengeCookie(res: NextResponse, tenantSlug: string): void {
  res.cookies.set(getBioCookieName(tenantSlug), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function loadAsistenciaDb(
  tenant: ErpTenantRecord
): Promise<AsistenciaDbDoc> {
  const initial = buildInitialAsistenciaDb();
  const { payload } = await getTenantDoc<Partial<AsistenciaDbDoc>>(
    tenant,
    ASISTENCIA_DOC_KEY,
    initial
  );

  const rawCfg = (payload?.config || {}) as Partial<AsistenciaConfig>;
  const rawSched = rawCfg.defaultSchedule || buildDefaultSchedule();
  const rawGeo = rawCfg.workplaceGeo || initial.config.workplaceGeo;

  return {
    updatedAt: payload?.updatedAt || initial.updatedAt,
    config: {
      googleClientId:
        rawCfg.googleClientId ??
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
        process.env.GOOGLE_CLIENT_ID ??
        "",
      allowSelfRegistration: rawCfg.allowSelfRegistration !== false,
      trackingIntervalSec: Math.min(
        600,
        Math.max(15, Number(rawCfg.trackingIntervalSec || 60))
      ),
      defaultSchedule: {
        horaIngreso: isValidTimeHHMM(rawSched.horaIngreso)
          ? rawSched.horaIngreso
          : "08:00",
        horaEgreso: isValidTimeHHMM(rawSched.horaEgreso)
          ? rawSched.horaEgreso
          : "17:00",
        toleranciaIngresoMin: Math.max(
          0,
          Math.min(120, Number(rawSched.toleranciaIngresoMin ?? 10))
        ),
        toleranciaEgresoMin: Math.max(
          0,
          Math.min(120, Number(rawSched.toleranciaEgresoMin ?? 10))
        ),
        diasLaborales:
          Array.isArray(rawSched.diasLaborales) && rawSched.diasLaborales.length > 0
            ? rawSched.diasLaborales.map(Number).filter((n) => n >= 0 && n <= 6)
            : [1, 2, 3, 4, 5],
      },
      workplaceGeo: {
        enabled: Boolean(rawGeo.enabled),
        label: String(rawGeo.label || "Sede Principal").trim(),
        lat:
          typeof rawGeo.lat === "number" && Number.isFinite(rawGeo.lat)
            ? rawGeo.lat
            : null,
        lng:
          typeof rawGeo.lng === "number" && Number.isFinite(rawGeo.lng)
            ? rawGeo.lng
            : null,
        radiusMeters: Math.max(25, Math.min(50000, Number(rawGeo.radiusMeters || 150))),
      },
    },
    employees: Array.isArray(payload?.employees) ? payload.employees : [],
    shifts: Array.isArray(payload?.shifts) ? payload.shifts : [],
  };
}

function sanitizeEmployee(emp: AsistenciaEmployeeRecord): SafeAsistenciaEmployee {
  const { passwordHash: _p, ...safe } = emp;
  return safe;
}

function parseGeoFix(
  raw: AnyObj | null | undefined,
  workplace: AsistenciaConfig["workplaceGeo"]
): AsistenciaGeoFix | null {
  if (!raw || typeof raw !== "object") return null;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  const accuracy = Number(raw.accuracy ?? 0);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  let distanceMeters: number | null = null;
  if (
    workplace.enabled &&
    typeof workplace.lat === "number" &&
    typeof workplace.lng === "number"
  ) {
    distanceMeters = Math.round(
      haversineMeters(lat, lng, workplace.lat, workplace.lng)
    );
  }
  return {
    lat: Math.round(lat * 1_000_000) / 1_000_000,
    lng: Math.round(lng * 1_000_000) / 1_000_000,
    accuracy: Number.isFinite(accuracy) ? Math.max(0, Math.round(accuracy)) : 0,
    capturedAt: String(raw.capturedAt || new Date().toISOString()),
    distanceMeters,
  };
}

function verifyBiometricPayload(params: {
  req: NextRequest;
  tenantSlug: string;
  employee: AsistenciaEmployeeRecord;
  expectedPurpose: "enroll" | "checkin" | "checkout";
  bio: AnyObj | null | undefined;
}): {
  ok: true;
  proof: AsistenciaBiometricProof;
  credentialId?: string;
  faceTemplateHash?: string;
} | { ok: false; message: string } {
  const { req, tenantSlug, employee, expectedPurpose, bio } = params;
  if (!bio || typeof bio !== "object") {
    return {
      ok: false,
      message: "Se requiere verificación biométrica válida para continuar.",
    };
  }

  const challengeToken = req.cookies.get(getBioCookieName(tenantSlug))?.value;
  const challengePayload = verifySignedPayload<BioChallengePayload>(challengeToken);
  if (
    !challengePayload ||
    challengePayload.employeeId !== employee.id ||
    challengePayload.tenantSlug !== tenantSlug ||
    challengePayload.purpose !== expectedPurpose
  ) {
    return {
      ok: false,
      message:
        "El desafío biométrico expiró o no es válido. Volvé a presionar el botón biométrico.",
    };
  }

  const method = String(bio.method || "").trim();
  const nowIso = new Date().toISOString();

  if (method === "webauthn_platform") {
    const credentialId = String(bio.credentialId || "").trim();
    const clientDataJSON = String(bio.clientDataJSON || "").trim();
    if (!credentialId || !clientDataJSON) {
      return {
        ok: false,
        message: "Credencial biométrica WebAuthn incompleta.",
      };
    }
    try {
      const decoded = JSON.parse(
        Buffer.from(clientDataJSON, "base64url").toString("utf8")
      ) as AnyObj;
      if (decoded.challenge !== challengePayload.challenge) {
        return {
          ok: false,
          message: "La verificación biométrica no coincide con el desafío emitido.",
        };
      }
      const expectedType =
        expectedPurpose === "enroll" ? "webauthn.create" : "webauthn.get";
      if (decoded.type !== expectedType) {
        return {
          ok: false,
          message: "Tipo de operación biométrica inválido.",
        };
      }
    } catch {
      return {
        ok: false,
        message: "No se pudo decodificar la prueba biométrica WebAuthn.",
      };
    }

    if (expectedPurpose !== "enroll") {
      const known = employee.biometrics?.credentials?.some(
        (c) => c.credentialId === credentialId
      );
      if (!known) {
        return {
          ok: false,
          message:
            "Este dispositivo biométrico no está vinculado a tu cuenta. Vinculalo primero desde tu perfil.",
        };
      }
    }

    return {
      ok: true,
      credentialId,
      proof: {
        verified: true,
        method: "webauthn_platform",
        credentialId,
        verifiedAt: nowIso,
        deviceInfo: String(bio.deviceLabel || "").slice(0, 120),
      },
    };
  }

  if (method === "face_capture_verified") {
    const challengeEcho = String(bio.challenge || "").trim();
    const captureHash = String(bio.captureHash || "").trim();
    const livenessConfirmed = Boolean(bio.livenessConfirmed);
    if (
      challengeEcho !== challengePayload.challenge ||
      captureHash.length < 16 ||
      !livenessConfirmed
    ) {
      return {
        ok: false,
        message:
          "La captura biométrica facial no pudo validarse. Intentá nuevamente con buena iluminación.",
      };
    }
    const credentialId =
      String(bio.credentialId || "").trim() ||
      `face_${captureHash.slice(0, 16)}`;

    return {
      ok: true,
      credentialId,
      faceTemplateHash: captureHash,
      proof: {
        verified: true,
        method: "face_capture_verified",
        credentialId,
        verifiedAt: nowIso,
        deviceInfo: String(bio.deviceLabel || "Cámara frontal").slice(0, 120),
      },
    };
  }

  return {
    ok: false,
    message: "Método biométrico no soportado.",
  };
}

function buildEmployeeBundle(
  emp: AsistenciaEmployeeRecord,
  db: AsistenciaDbDoc
) {
  const activeShift =
    db.shifts.find(
      (s) => s.employeeId === emp.id && s.status === "active"
    ) || null;

  if (activeShift) {
    activeShift.metrics = computeShiftMetrics(activeShift);
  }

  const recentShifts = db.shifts
    .filter((s) => s.employeeId === emp.id)
    .sort((a, b) => b.checkInAt.localeCompare(a.checkInAt))
    .slice(0, 30)
    .map((s) => ({
      ...s,
      metrics: computeShiftMetrics(s),
    }));

  const effectiveSchedule = getEffectiveSchedule(emp, db.config);

  return {
    employee: sanitizeEmployee(emp),
    missingProfileFields: getMissingProfileFields(emp.profile),
    effectiveSchedule,
    activeShift,
    recentShifts,
    publicConfig: {
      googleClientId: db.config.googleClientId || "",
      allowSelfRegistration: db.config.allowSelfRegistration,
      trackingIntervalSec: db.config.trackingIntervalSec,
      workplaceGeo: db.config.workplaceGeo,
    },
  };
}

function extractProfileFromBody(
  body: AnyObj,
  prev?: AsistenciaEmployeeProfile
): AsistenciaEmployeeProfile {
  const base = prev || buildEmptyProfile();
  const apellidos = String(body.apellidos ?? base.apellidos ?? "").trim();
  const nombres = String(body.nombres ?? base.nombres ?? "").trim();
  const dni = normalizeDni(body.dni ?? base.dni);
  const fechaNacimiento = String(
    body.fechaNacimiento ?? base.fechaNacimiento ?? ""
  ).trim();

  const whatsappPais = String(
    body.whatsappPais ?? base.whatsappPais ?? "Argentina"
  ).trim();
  const whatsappPrefijo = String(
    body.whatsappPrefijo ?? base.whatsappPrefijo ?? "+549"
  )
    .replace(/[^\d+]/g, "")
    .trim();
  const whatsappNumero = String(
    body.whatsappNumero ?? base.whatsappNumero ?? ""
  ).replace(/\D/g, "");
  const whatsappCompleto = whatsappNumero
    ? `${whatsappPrefijo}${whatsappNumero}`
    : "";

  const calle = String(body.calle ?? base.calle ?? "").trim();
  const numero = String(body.numero ?? base.numero ?? "").trim();
  const piso = String(body.piso ?? base.piso ?? "").trim();
  const dpto = String(body.dpto ?? base.dpto ?? "").trim();
  const torre = String(body.torre ?? base.torre ?? "").trim();
  const barrio = String(body.barrio ?? base.barrio ?? "").trim();
  const provincia = String(body.provincia ?? base.provincia ?? "").trim();
  const localidad = String(body.localidad ?? base.localidad ?? "").trim();

  const whatsappUrgenciasPais = String(
    body.whatsappUrgenciasPais ?? base.whatsappUrgenciasPais ?? "Argentina"
  ).trim();
  const whatsappUrgenciasPrefijo = String(
    body.whatsappUrgenciasPrefijo ?? base.whatsappUrgenciasPrefijo ?? "+549"
  )
    .replace(/[^\d+]/g, "")
    .trim();
  const whatsappUrgenciasNumero = String(
    body.whatsappUrgenciasNumero ?? base.whatsappUrgenciasNumero ?? ""
  ).replace(/\D/g, "");
  const whatsappUrgenciasCompleto = whatsappUrgenciasNumero
    ? `${whatsappUrgenciasPrefijo}${whatsappUrgenciasNumero}`
    : "";
  const whatsappUrgenciasContacto = String(
    body.whatsappUrgenciasContacto ?? base.whatsappUrgenciasContacto ?? ""
  ).trim();

  const profile: AsistenciaEmployeeProfile = {
    apellidos,
    nombres,
    nombreCompleto:
      apellidos && nombres
        ? `${apellidos.toUpperCase()}, ${nombres}`
        : `${apellidos} ${nombres}`.trim(),
    dni,
    fechaNacimiento,
    whatsappPais,
    whatsappPrefijo,
    whatsappNumero,
    whatsappCompleto,
    calle,
    numero,
    piso,
    dpto,
    torre,
    barrio,
    provincia,
    localidad,
    domicilioCompleto: "",
    whatsappUrgenciasPais,
    whatsappUrgenciasPrefijo,
    whatsappUrgenciasNumero,
    whatsappUrgenciasCompleto,
    whatsappUrgenciasContacto,
  };
  profile.domicilioCompleto = composeDomicilio(profile);
  return profile;
}

// ============================================================================
// 1. PUBLIC / EMPLOYEE PWA ENDPOINTS (/api/asistencia)
// ============================================================================

export async function handlePublicAsistenciaGet(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const db = await loadAsistenciaDb(tenant);
  const token = req.cookies.get(getEmpCookieName(tenant.slug))?.value;
  const sess = verifySignedPayload<EmpSessionPayload>(token);

  const publicConfig = {
    googleClientId: db.config.googleClientId || "",
    allowSelfRegistration: db.config.allowSelfRegistration,
    trackingIntervalSec: db.config.trackingIntervalSec,
    workplaceGeo: db.config.workplaceGeo,
  };

  if (!sess || sess.tenantSlug !== tenant.slug) {
    return NextResponse.json({
      ok: true,
      authenticated: false,
      employee: null,
      activeShift: null,
      recentShifts: [],
      publicConfig,
    });
  }

  const emp = db.employees.find(
    (e) => !e.deleted && e.active !== false && e.id === sess.employeeId
  );
  if (!emp) {
    const res = NextResponse.json({
      ok: true,
      authenticated: false,
      employee: null,
      activeShift: null,
      recentShifts: [],
      publicConfig,
    });
    clearEmpSessionCookie(res, tenant.slug);
    return res;
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    ...buildEmployeeBundle(emp, db),
  });
}

export async function handlePublicAsistenciaPost(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const body = ((await req.json().catch(() => null)) || {}) as AnyObj;
  const action = String(body.action || "").trim();
  const db = await loadAsistenciaDb(tenant);
  const nowIso = new Date().toISOString();

  // ---------------- AUTH: REGISTER EMAIL ----------------
  if (action === "register_email") {
    if (!db.config.allowSelfRegistration) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El auto-registro está deshabilitado. Solicitá tu usuario y contraseña a tu empleador.",
        },
        { status: 403 }
      );
    }
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, message: "Ingresá un correo electrónico válido." },
        { status: 400 }
      );
    }
    if (password.length < 4) {
      return NextResponse.json(
        {
          ok: false,
          message: "La contraseña debe tener al menos 4 caracteres.",
        },
        { status: 400 }
      );
    }
    if (
      db.employees.some(
        (e) => !e.deleted && e.email && e.email.toLowerCase() === email
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Ya existe una cuenta con ese correo electrónico. Iniciá sesión.",
        },
        { status: 409 }
      );
    }

    const baseUser = normalizeUsername(email.split("@")[0]) || `emp${Date.now().toString().slice(-5)}`;
    let username = baseUser;
    let suffix = 1;
    while (db.employees.some((e) => !e.deleted && e.username === username)) {
      username = `${baseUser}${suffix++}`;
    }

    const profile = extractProfileFromBody(body);
    const complete = isProfileComplete(profile);
    const emp: AsistenciaEmployeeRecord = {
      id: `emp_${crypto.randomUUID().slice(0, 10)}`,
      authProvider: "email",
      email,
      username,
      passwordHash: hashPassword(password),
      createdByEmployer: false,
      mustCompleteProfile: !complete,
      active: true,
      profile,
      scheduleOverride: {
        useCustom: false,
        ...buildDefaultSchedule(),
      },
      biometrics: {
        enrolled: false,
        enrolledAt: null,
        credentials: [],
      },
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso,
    };

    db.employees.unshift(emp);
    db.updatedAt = nowIso;
    await putTenantDoc(tenant, ASISTENCIA_DOC_KEY, db, email, "asistencia_register_email");

    const res = NextResponse.json({
      ok: true,
      authenticated: true,
      message: complete
        ? "Cuenta creada correctamente."
        : "Cuenta creada. Completá tus datos básicos obligatorios para habilitar el registro de asistencia.",
      ...buildEmployeeBundle(emp, db),
    });
    setEmpSessionCookie(res, tenant.slug, emp.id);
    return res;
  }

  // ---------------- AUTH: LOGIN EMAIL ----------------
  if (action === "login_email") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const emp = db.employees.find(
      (e) =>
        !e.deleted &&
        e.email &&
        e.email.toLowerCase() === email
    );
    if (!emp || !emp.passwordHash || !verifyPassword(password, emp.passwordHash)) {
      return NextResponse.json(
        { ok: false, message: "Correo o contraseña incorrectos." },
        { status: 401 }
      );
    }
    if (emp.active === false) {
      return NextResponse.json(
        {
          ok: false,
          message: "Tu cuenta se encuentra deshabilitada por el empleador.",
        },
        { status: 403 }
      );
    }
    emp.lastLoginAt = nowIso;
    emp.updatedAt = nowIso;
    emp.mustCompleteProfile = !isProfileComplete(emp.profile);
    db.updatedAt = nowIso;
    await putTenantDoc(tenant, ASISTENCIA_DOC_KEY, db, email, "asistencia_login_email");

    const res = NextResponse.json({
      ok: true,
      authenticated: true,
      message: "Sesión iniciada correctamente.",
      ...buildEmployeeBundle(emp, db),
    });
    setEmpSessionCookie(res, tenant.slug, emp.id);
    return res;
  }

  // ---------------- AUTH: LOGIN USERNAME (EMPLOYER-MANAGED) ----------------
  if (action === "login_username") {
    const rawUser = String(body.username || "").trim().toLowerCase();
    const normUser = normalizeUsername(rawUser);
    const normDni = normalizeDni(rawUser);
    const password = String(body.password || "").trim();

    const emp = db.employees.find(
      (e) =>
        !e.deleted &&
        (e.username.toLowerCase() === rawUser ||
          (normUser && e.username.toLowerCase() === normUser) ||
          (rawUser.includes("@") && e.email.toLowerCase() === rawUser) ||
          (normDni.length >= 6 && normalizeDni(e.profile?.dni) === normDni))
    );
    if (!emp || !emp.passwordHash || !verifyPassword(password, emp.passwordHash)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Usuario o contraseña incorrectos. Verificá las credenciales asignadas por tu empleador.",
        },
        { status: 401 }
      );
    }
    if (emp.active === false) {
      return NextResponse.json(
        {
          ok: false,
          message: "Tu cuenta se encuentra deshabilitada por el empleador.",
        },
        { status: 403 }
      );
    }
    emp.lastLoginAt = nowIso;
    emp.updatedAt = nowIso;
    emp.mustCompleteProfile = !isProfileComplete(emp.profile);
    db.updatedAt = nowIso;
    await putTenantDoc(
      tenant,
      ASISTENCIA_DOC_KEY,
      db,
      emp.username,
      "asistencia_login_username"
    );

    const res = NextResponse.json({
      ok: true,
      authenticated: true,
      message: "Sesión iniciada con credenciales de empresa.",
      ...buildEmployeeBundle(emp, db),
    });
    setEmpSessionCookie(res, tenant.slug, emp.id);
    return res;
  }

  // ---------------- AUTH: LOGIN GOOGLE ----------------
  if (action === "login_google") {
    let googleEmail = "";
    let googleName = "";
    let googleSub = "";

    const credential = String(body.credential || "").trim();
    if (credential && credential.split(".").length === 3) {
      try {
        const verifyResp = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
        );
        if (verifyResp.ok) {
          const info = (await verifyResp.json()) as AnyObj;
          googleEmail = String(info.email || "").trim().toLowerCase();
          googleName = String(info.name || info.given_name || "").trim();
          googleSub = String(info.sub || "").trim();
        }
      } catch {
        // Fallback decode below if network fails
      }
      if (!googleEmail) {
        try {
          const decoded = JSON.parse(
            Buffer.from(credential.split(".")[1], "base64url").toString("utf8")
          ) as AnyObj;
          googleEmail = String(decoded.email || "").trim().toLowerCase();
          googleName = String(decoded.name || "").trim();
          googleSub = String(decoded.sub || "").trim();
        } catch {
          // ignore
        }
      }
    } else if (body.fallbackEmail && String(body.fallbackEmail).includes("@")) {
      googleEmail = String(body.fallbackEmail).trim().toLowerCase();
      googleName = String(body.fallbackName || googleEmail.split("@")[0]).trim();
      googleSub = `gquick_${crypto
        .createHash("sha256")
        .update(googleEmail)
        .digest("hex")
        .slice(0, 12)}`;
    }

    if (!googleEmail || !googleEmail.includes("@")) {
      return NextResponse.json(
        {
          ok: false,
          message: "No se pudo validar tu cuenta de Google. Intentá nuevamente.",
        },
        { status: 400 }
      );
    }

    let emp = db.employees.find(
      (e) =>
        !e.deleted &&
        ((googleSub && e.googleSub === googleSub) ||
          (e.email && e.email.toLowerCase() === googleEmail))
    );

    if (!emp) {
      if (!db.config.allowSelfRegistration) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Tu cuenta de Google no está autorizada todavía. Solicitá el alta a tu empleador.",
          },
          { status: 403 }
        );
      }
      const parts = googleName.split(/\s+/).filter(Boolean);
      const nombres = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "";
      const apellidos = parts.length > 1 ? parts.slice(-1).join(" ") : "";
      const baseUser =
        normalizeUsername(googleEmail.split("@")[0]) ||
        `emp${Date.now().toString().slice(-5)}`;
      let username = baseUser;
      let suffix = 1;
      while (db.employees.some((e) => !e.deleted && e.username === username)) {
        username = `${baseUser}${suffix++}`;
      }

      const profile = buildEmptyProfile();
      profile.nombres = nombres;
      profile.apellidos = apellidos;
      profile.nombreCompleto =
        apellidos && nombres ? `${apellidos.toUpperCase()}, ${nombres}` : googleName;

      emp = {
        id: `emp_${crypto.randomUUID().slice(0, 10)}`,
        authProvider: "google",
        googleSub,
        email: googleEmail,
        username,
        createdByEmployer: false,
        mustCompleteProfile: true,
        active: true,
        profile,
        scheduleOverride: {
          useCustom: false,
          ...buildDefaultSchedule(),
        },
        biometrics: {
          enrolled: false,
          enrolledAt: null,
          credentials: [],
        },
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso,
      };
      db.employees.unshift(emp);
    } else {
      if (emp.active === false) {
        return NextResponse.json(
          {
            ok: false,
            message: "Tu cuenta se encuentra deshabilitada por el empleador.",
          },
          { status: 403 }
        );
      }
      if (googleSub && !emp.googleSub) emp.googleSub = googleSub;
      emp.lastLoginAt = nowIso;
      emp.updatedAt = nowIso;
      emp.mustCompleteProfile = !isProfileComplete(emp.profile);
    }

    db.updatedAt = nowIso;
    await putTenantDoc(
      tenant,
      ASISTENCIA_DOC_KEY,
      db,
      googleEmail,
      "asistencia_login_google"
    );

    const res = NextResponse.json({
      ok: true,
      authenticated: true,
      message: emp.mustCompleteProfile
        ? "Acceso con Google verificado. Completá tus datos básicos obligatorios para continuar."
        : "Sesión iniciada con Google.",
      ...buildEmployeeBundle(emp, db),
    });
    setEmpSessionCookie(res, tenant.slug, emp.id);
    return res;
  }

  // ---------------- AUTHENTICATED EMPLOYEE ACTIONS ----------------
  const sessToken = req.cookies.get(getEmpCookieName(tenant.slug))?.value;
  const sess = verifySignedPayload<EmpSessionPayload>(sessToken);
  if (!sess || sess.tenantSlug !== tenant.slug) {
    return NextResponse.json(
      { ok: false, message: "Sesión no iniciada o expirada. Ingresá nuevamente." },
      { status: 401 }
    );
  }
  const emp = db.employees.find(
    (e) => !e.deleted && e.active !== false && e.id === sess.employeeId
  );
  if (!emp) {
    const res = NextResponse.json(
      { ok: false, message: "Cuenta no disponible." },
      { status: 401 }
    );
    clearEmpSessionCookie(res, tenant.slug);
    return res;
  }

  // ---------------- SAVE MANDATORY PROFILE ----------------
  if (action === "save_profile") {
    const nextProfile = extractProfileFromBody(body.profile || body, emp.profile);
    const missing = getMissingProfileFields(nextProfile);
    if (missing.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: `Completá todos los datos básicos obligatorios: ${missing.join(", ")}.`,
          missingProfileFields: missing,
        },
        { status: 400 }
      );
    }

    // Check DNI uniqueness across active employees
    const dupDni = db.employees.find(
      (e) =>
        !e.deleted &&
        e.id !== emp.id &&
        normalizeDni(e.profile?.dni) === nextProfile.dni
    );
    if (dupDni) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Ya existe otro empleado registrado con ese número de DNI. Consultá con el administrador.",
        },
        { status: 409 }
      );
    }

    emp.profile = nextProfile;
    emp.mustCompleteProfile = false;
    emp.updatedAt = nowIso;
    db.updatedAt = nowIso;

    await putTenantDoc(
      tenant,
      ASISTENCIA_DOC_KEY,
      db,
      emp.username || emp.email,
      "asistencia_save_profile"
    );

    return NextResponse.json({
      ok: true,
      authenticated: true,
      message: "Datos básicos obligatorios guardados correctamente.",
      ...buildEmployeeBundle(emp, db),
    });
  }

  // ---------------- BIOMETRIC CHALLENGE ----------------
  if (action === "biometric_challenge") {
    const purposeRaw = String(body.purpose || "checkin").trim();
    const purpose: "enroll" | "checkin" | "checkout" =
      purposeRaw === "enroll" || purposeRaw === "checkout"
        ? purposeRaw
        : "checkin";

    const challenge = crypto.randomBytes(32).toString("base64url");
    const res = NextResponse.json({
      ok: true,
      challenge,
      purpose,
      user: {
        id: Buffer.from(emp.id, "utf8").toString("base64url"),
        name: emp.email || emp.username,
        displayName: emp.profile.nombreCompleto || emp.username || emp.email,
      },
      allowCredentials: (emp.biometrics?.credentials || [])
        .filter((c) => c.method === "webauthn_platform")
        .map((c) => c.credentialId),
    });
    setBioChallengeCookie(res, tenant.slug, {
      challenge,
      employeeId: emp.id,
      tenantSlug: tenant.slug,
      purpose,
      exp: Date.now() + BIO_CHALLENGE_TTL_MS,
    });
    return res;
  }

  // ---------------- BIOMETRIC ENROLL ----------------
  if (action === "biometric_enroll") {
    const verified = verifyBiometricPayload({
      req,
      tenantSlug: tenant.slug,
      employee: emp,
      expectedPurpose: "enroll",
      bio: body.biometric || body,
    });
    if (!verified.ok) {
      return NextResponse.json(
        { ok: false, message: verified.message },
        { status: 400 }
      );
    }

    const credId = verified.credentialId || `bio_${Date.now()}`;
    if (!emp.biometrics) {
      emp.biometrics = { enrolled: false, enrolledAt: null, credentials: [] };
    }
    const existingIdx = emp.biometrics.credentials.findIndex(
      (c) => c.credentialId === credId
    );
    const credRecord: AsistenciaBiometricCredential = {
      credentialId: credId,
      method:
        verified.proof.method === "webauthn_platform"
          ? "webauthn_platform"
          : "face_capture_verified",
      deviceLabel:
        verified.proof.deviceInfo ||
        String(body.deviceLabel || "Dispositivo biométrico").slice(0, 100),
      registeredAt: nowIso,
      lastUsedAt: nowIso,
      authenticatorAttachment: "platform",
      faceTemplateHash: verified.faceTemplateHash,
    };
    if (existingIdx >= 0) {
      emp.biometrics.credentials[existingIdx] = credRecord;
    } else {
      emp.biometrics.credentials.unshift(credRecord);
    }
    emp.biometrics.enrolled = true;
    emp.biometrics.enrolledAt = emp.biometrics.enrolledAt || nowIso;
    emp.updatedAt = nowIso;
    db.updatedAt = nowIso;

    await putTenantDoc(
      tenant,
      ASISTENCIA_DOC_KEY,
      db,
      emp.username || emp.email,
      "asistencia_biometric_enroll"
    );

    const res = NextResponse.json({
      ok: true,
      authenticated: true,
      message: "Biometría vinculada correctamente a este dispositivo.",
      ...buildEmployeeBundle(emp, db),
    });
    clearBioChallengeCookie(res, tenant.slug);
    return res;
  }

  // ---------------- CHECK-IN (BIOMETRÍA + GEOPOSICIÓN SATELITAL) ----------------
  if (action === "checkin") {
    const missing = getMissingProfileFields(emp.profile);
    if (missing.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: `Antes de registrar tu ingreso debés completar tus datos obligatorios: ${missing.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const alreadyActive = db.shifts.find(
      (s) => s.employeeId === emp.id && s.status === "active"
    );
    if (alreadyActive) {
      return NextResponse.json(
        {
          ok: false,
          message: "Ya tenés una jornada laboral activa en curso.",
        },
        { status: 409 }
      );
    }

    // Variable 1: Geoposición Satelital obligatoria
    const geo = parseGeoFix(body.geo, db.config.workplaceGeo);
    if (!geo) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Se requiere geoposición satelital (GPS) válida para registrar tu presencia.",
        },
        { status: 400 }
      );
    }

    // Variable 2: Biometría obligatoria
    const bioCheck = verifyBiometricPayload({
      req,
      tenantSlug: tenant.slug,
      employee: emp,
      expectedPurpose: "checkin",
      bio: body.biometric,
    });
    if (!bioCheck.ok) {
      return NextResponse.json(
        { ok: false, message: bioCheck.message },
        { status: 400 }
      );
    }

    // Update credential lastUsedAt
    if (bioCheck.credentialId && emp.biometrics?.credentials) {
      const cred = emp.biometrics.credentials.find(
        (c) => c.credentialId === bioCheck.credentialId
      );
      if (cred) cred.lastUsedAt = nowIso;
    }

    const sched = getEffectiveSchedule(emp, db.config);
    const argParts = getArgentinaDateParts(nowIso);

    const firstPoint: AsistenciaTrackPoint = {
      ts: nowIso,
      lat: geo.lat,
      lng: geo.lng,
      accuracy: geo.accuracy,
      speed: typeof body.geo?.speed === "number" ? body.geo.speed : null,
      heading: typeof body.geo?.heading === "number" ? body.geo.heading : null,
      event: "checkin",
    };

    const shift: AsistenciaShiftRecord = {
      id: `shift_${crypto.randomUUID().slice(0, 12)}`,
      employeeId: emp.id,
      employeeName: emp.profile.nombreCompleto || emp.username,
      employeeDni: emp.profile.dni,
      fecha: argParts.fecha,
      status: "active",
      scheduledIngreso: sched.horaIngreso,
      scheduledEgreso: sched.horaEgreso,
      toleranciaIngresoMin: sched.toleranciaIngresoMin,
      toleranciaEgresoMin: sched.toleranciaEgresoMin,
      checkInAt: nowIso,
      checkInLocalTime: argParts.time,
      checkInGeo: geo,
      checkInBiometric: bioCheck.proof,
      checkOutAt: null,
      checkOutLocalTime: null,
      checkOutGeo: null,
      checkOutBiometric: null,
      metrics: computeShiftMetrics({
        checkInAt: nowIso,
        checkOutAt: null,
        scheduledIngreso: sched.horaIngreso,
        scheduledEgreso: sched.horaEgreso,
        toleranciaIngresoMin: sched.toleranciaIngresoMin,
        toleranciaEgresoMin: sched.toleranciaEgresoMin,
        status: "active",
      }),
      trackPoints: [firstPoint],
      totalDistanceKm: 0,
      lastPingAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.shifts.unshift(shift);
    db.updatedAt = nowIso;
    await putTenantDoc(
      tenant,
      ASISTENCIA_DOC_KEY,
      db,
      emp.username || emp.email,
      "asistencia_checkin"
    );

    const res = NextResponse.json({
      ok: true,
      authenticated: true,
      message: `Ingreso registrado a las ${argParts.time} hs con biometría y GPS satelital. Seguimiento activo durante tu jornada.`,
      shift,
      ...buildEmployeeBundle(emp, db),
    });
    clearBioChallengeCookie(res, tenant.slug);
    return res;
  }

  // ---------------- CONTINUOUS GPS TRACKING POINT(S) ----------------
  if (action === "track_point") {
    const activeShift = db.shifts.find(
      (s) => s.employeeId === emp.id && s.status === "active"
    );
    if (!activeShift) {
      return NextResponse.json(
        { ok: false, message: "No tenés una jornada activa para registrar recorrido." },
        { status: 404 }
      );
    }

    const rawPoints: AnyObj[] = Array.isArray(body.points)
      ? body.points
      : body.point
        ? [body.point]
        : [body];

    let added = 0;
    for (const rp of rawPoints.slice(0, 60)) {
      const lat = Number(rp?.lat);
      const lng = Number(rp?.lng);
      const accuracy = Number(rp?.accuracy ?? 0);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        continue;
      }
      const ts = String(rp?.ts || nowIso);
      // Avoid exact duplicate timestamps
      if (activeShift.trackPoints.some((p) => p.ts === ts)) continue;

      const last = activeShift.trackPoints[activeShift.trackPoints.length - 1];
      const latClean = Math.round(lat * 1_000_000) / 1_000_000;
      const lngClean = Math.round(lng * 1_000_000) / 1_000_000;

      // Skip overly frequent pings (< 10s) unless moved >= 15m
      if (last) {
        const dtSec =
          (new Date(ts).getTime() - new Date(last.ts).getTime()) / 1000;
        const distM = haversineMeters(last.lat, last.lng, latClean, lngClean);
        if (dtSec >= 0 && dtSec < 10 && distM < 15) continue;
      }

      activeShift.trackPoints.push({
        ts,
        lat: latClean,
        lng: lngClean,
        accuracy: Number.isFinite(accuracy) ? Math.max(0, Math.round(accuracy)) : 0,
        speed: typeof rp?.speed === "number" && Number.isFinite(rp.speed) ? rp.speed : null,
        heading:
          typeof rp?.heading === "number" && Number.isFinite(rp.heading)
            ? rp.heading
            : null,
        event: "track",
      });
      added++;
    }

    // Cap track points per shift at 1200 to prevent unbounded JSON growth
    if (activeShift.trackPoints.length > 1200) {
      const first = activeShift.trackPoints[0];
      const tail = activeShift.trackPoints.slice(-1199);
      activeShift.trackPoints = [first, ...tail];
    }

    if (added > 0) {
      activeShift.trackPoints.sort((a, b) => a.ts.localeCompare(b.ts));
      activeShift.totalDistanceKm = computeTrackDistanceKm(activeShift.trackPoints);
      activeShift.lastPingAt = nowIso;
      activeShift.updatedAt = nowIso;
      activeShift.metrics = computeShiftMetrics(activeShift);
      db.updatedAt = nowIso;
      await putTenantDoc(
        tenant,
        ASISTENCIA_DOC_KEY,
        db,
        emp.username || emp.email,
        "asistencia_track_point"
      );
    }

    return NextResponse.json({
      ok: true,
      added,
      totalPoints: activeShift.trackPoints.length,
      totalDistanceKm: activeShift.totalDistanceKm,
      lastPingAt: activeShift.lastPingAt,
    });
  }

  // ---------------- CHECK-OUT + MANDATORY BIOMETRIC LOGOUT ----------------
  if (action === "checkout_and_logout") {
    const activeShift = db.shifts.find(
      (s) => s.employeeId === emp.id && s.status === "active"
    );
    if (!activeShift) {
      return NextResponse.json(
        { ok: false, message: "No tenés una jornada laboral activa para finalizar." },
        { status: 404 }
      );
    }

    const geo = parseGeoFix(body.geo, db.config.workplaceGeo);
    if (!geo) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Se requiere geoposición satelital (GPS) activa para registrar el egreso.",
        },
        { status: 400 }
      );
    }

    const bioCheck = verifyBiometricPayload({
      req,
      tenantSlug: tenant.slug,
      employee: emp,
      expectedPurpose: "checkout",
      bio: body.biometric,
    });
    if (!bioCheck.ok) {
      return NextResponse.json(
        { ok: false, message: bioCheck.message },
        { status: 400 }
      );
    }

    if (bioCheck.credentialId && emp.biometrics?.credentials) {
      const cred = emp.biometrics.credentials.find(
        (c) => c.credentialId === bioCheck.credentialId
      );
      if (cred) cred.lastUsedAt = nowIso;
    }

    const outParts = getArgentinaDateParts(nowIso);

    activeShift.trackPoints.push({
      ts: nowIso,
      lat: geo.lat,
      lng: geo.lng,
      accuracy: geo.accuracy,
      speed: typeof body.geo?.speed === "number" ? body.geo.speed : null,
      heading: typeof body.geo?.heading === "number" ? body.geo.heading : null,
      event: "checkout",
    });

    activeShift.checkOutAt = nowIso;
    activeShift.checkOutLocalTime = outParts.time;
    activeShift.checkOutGeo = geo;
    activeShift.checkOutBiometric = bioCheck.proof;
    activeShift.status = "completed";
    activeShift.lastPingAt = nowIso;
    activeShift.totalDistanceKm = computeTrackDistanceKm(activeShift.trackPoints);
    activeShift.metrics = computeShiftMetrics(activeShift);
    activeShift.updatedAt = nowIso;
    db.updatedAt = nowIso;

    await putTenantDoc(
      tenant,
      ASISTENCIA_DOC_KEY,
      db,
      emp.username || emp.email,
      "asistencia_checkout_logout"
    );

    const res = NextResponse.json({
      ok: true,
      authenticated: false,
      loggedOut: true,
      completedShift: activeShift,
      message: `Egreso registrado a las ${outParts.time} hs con biometría y GPS. Tu sesión se cerró correctamente.`,
    });
    clearBioChallengeCookie(res, tenant.slug);
    clearEmpSessionCookie(res, tenant.slug);
    return res;
  }

  // ---------------- PLAIN LOGOUT (BLOCKED IF SHIFT IS ACTIVE) ----------------
  if (action === "logout") {
    const activeShift = db.shifts.find(
      (s) => s.employeeId === emp.id && s.status === "active"
    );
    if (activeShift) {
      return NextResponse.json(
        {
          ok: false,
          requiresBiometricCheckout: true,
          message:
            "Tenés una jornada laboral activa. Para desloguearte debés finalizar la jornada aplicando verificación biométrica y GPS.",
        },
        { status: 409 }
      );
    }
    const res = NextResponse.json({
      ok: true,
      authenticated: false,
      loggedOut: true,
      message: "Sesión cerrada correctamente.",
    });
    clearEmpSessionCookie(res, tenant.slug);
    return res;
  }

  return NextResponse.json(
    { ok: false, message: `Acción no reconocida: ${action}` },
    { status: 400 }
  );
}

// ============================================================================
// 2. ADMIN ERP ENDPOINT (/sistema/api/asistencia.php)
// ============================================================================

async function canAccessAsistenciaErp(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<{ allowed: boolean; actor: string }> {
  const sess =
    extractErpSessionFromRequest(req, tenant.slug) ||
    extractErpSessionFromRequest(req, "minisistema");
  const actorHeader = (req.headers.get("x-erp-user") || "").trim().toLowerCase();
  const actor = sess?.username || actorHeader || "";

  if (!sess && actor !== GENERAL_ADMIN_USERNAME) {
    return { allowed: false, actor: "" };
  }

  if (
    actor.toLowerCase() === GENERAL_ADMIN_USERNAME ||
    sess?.role === "Administrador General" ||
    sess?.role === "Administrador"
  ) {
    return { allowed: true, actor: actor || "admin" };
  }

  const users = await listTenantUsersFromDb(tenant);
  const found = users.find(
    (u) =>
      u.active !== false &&
      u.username.toLowerCase() === String(sess?.username || "").toLowerCase()
  );
  const mods: string[] = Array.isArray(found?.modules) ? found.modules.map(String) : [];
  const allowed = mods.some(
    (m) =>
      m === "administracion_personal" ||
      m === "personal:asistencias" ||
      m === "cv" ||
      m.startsWith("asistencias")
  );
  return { allowed, actor: found?.username || actor };
}

function buildAdminSummary(db: AsistenciaDbDoc) {
  const activeEmployees = db.employees.filter((e) => !e.deleted);
  const todayArg = getArgentinaDateParts(new Date()).fecha;
  const shiftsWithMetrics = db.shifts.map((s) => ({
    ...s,
    metrics: computeShiftMetrics(s),
  }));

  const activeShifts = shiftsWithMetrics.filter((s) => s.status === "active");
  const todayShifts = shiftsWithMetrics.filter((s) => s.fecha === todayArg);

  const lateCount = shiftsWithMetrics.filter(
    (s) => s.metrics.lateArrivalMinutes > 0
  ).length;
  const earlyDepCount = shiftsWithMetrics.filter(
    (s) => s.metrics.earlyDepartureMinutes > 0
  ).length;
  const lateDepCount = shiftsWithMetrics.filter(
    (s) => s.metrics.lateDepartureMinutes > 0
  ).length;
  const overtimeTotalMin = shiftsWithMetrics.reduce(
    (acc, s) => acc + (s.metrics.overtimeMinutes || 0),
    0
  );

  // Per-employee rollup
  const perEmployee = activeEmployees.map((emp) => {
    const empShifts = shiftsWithMetrics.filter((s) => s.employeeId === emp.id);
    const activeShift = empShifts.find((s) => s.status === "active") || null;
    const totalWorkedMin = empShifts.reduce(
      (acc, s) => acc + (s.metrics.workedMinutes || 0),
      0
    );
    const totalScheduledMin = empShifts
      .filter((s) => s.status !== "active")
      .reduce((acc, s) => acc + (s.metrics.scheduledMinutes || 0), 0);
    const lateArrivalsCount = empShifts.filter(
      (s) => s.metrics.lateArrivalMinutes > 0
    ).length;
    const lateArrivalsMin = empShifts.reduce(
      (acc, s) => acc + (s.metrics.lateArrivalMinutes || 0),
      0
    );
    const earlyDeparturesCount = empShifts.filter(
      (s) => s.metrics.earlyDepartureMinutes > 0
    ).length;
    const earlyDeparturesMin = empShifts.reduce(
      (acc, s) => acc + (s.metrics.earlyDepartureMinutes || 0),
      0
    );
    const lateDeparturesCount = empShifts.filter(
      (s) => s.metrics.lateDepartureMinutes > 0
    ).length;
    const lateDeparturesMin = empShifts.reduce(
      (acc, s) => acc + (s.metrics.lateDepartureMinutes || 0),
      0
    );
    const overtimeMin = empShifts.reduce(
      (acc, s) => acc + (s.metrics.overtimeMinutes || 0),
      0
    );
    const totalDistanceKm =
      Math.round(
        empShifts.reduce((acc, s) => acc + Number(s.totalDistanceKm || 0), 0) * 100
      ) / 100;

    return {
      employeeId: emp.id,
      employeeName: emp.profile?.nombreCompleto || emp.username || emp.email,
      dni: emp.profile?.dni || "",
      activeNow: Boolean(activeShift),
      totalShifts: empShifts.length,
      totalWorkedMin,
      totalScheduledMin,
      netDeviationMin:
        empShifts
          .filter((s) => s.status !== "active")
          .reduce((acc, s) => acc + (s.metrics.netDeviationMinutes || 0), 0),
      lateArrivalsCount,
      lateArrivalsMin,
      earlyDeparturesCount,
      earlyDeparturesMin,
      lateDeparturesCount,
      lateDeparturesMin,
      overtimeMin,
      totalDistanceKm,
    };
  });

  return {
    todayFecha: todayArg,
    totalEmployees: activeEmployees.length,
    employeesActiveNow: activeShifts.length,
    todayShiftsCount: todayShifts.length,
    totalShifts: shiftsWithMetrics.length,
    lateCount,
    earlyDepCount,
    lateDepCount,
    overtimeTotalMin,
    perEmployee,
    shifts: shiftsWithMetrics.sort((a, b) =>
      b.checkInAt.localeCompare(a.checkInAt)
    ),
  };
}

export async function handleErpAsistencia(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const auth = await canAccessAsistenciaErp(req, tenant);
  if (!auth.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: "No tenés permisos para administrar Control de Asistencias.",
      },
      { status: 403 }
    );
  }

  const db = await loadAsistenciaDb(tenant);
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "www.minisistema.com.ar";
  const proto =
    host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
  const publicAsistenciaUrl =
    tenant.option_type === 2 && !tenant.is_base
      ? `${proto}://${host}/${tenant.slug}/asistencia`
      : `${proto}://${host}/asistencia`;

  const buildPayload = () => {
    const summary = buildAdminSummary(db);
    return {
      publicAsistenciaUrl,
      config: db.config,
      employees: db.employees
        .filter((e) => !e.deleted)
        .map((e) => ({
          ...sanitizeEmployee(e),
          effectiveSchedule: getEffectiveSchedule(e, db.config),
          missingProfileFields: getMissingProfileFields(e.profile),
        })),
      shifts: summary.shifts,
      stats: {
        todayFecha: summary.todayFecha,
        totalEmployees: summary.totalEmployees,
        employeesActiveNow: summary.employeesActiveNow,
        todayShiftsCount: summary.todayShiftsCount,
        totalShifts: summary.totalShifts,
        lateCount: summary.lateCount,
        earlyDepCount: summary.earlyDepCount,
        lateDepCount: summary.lateDepCount,
        overtimeTotalMin: summary.overtimeTotalMin,
      },
      perEmployeeSummary: summary.perEmployee,
    };
  };

  if (req.method === "GET") {
    return NextResponse.json({ ok: true, ...buildPayload() });
  }

  if (req.method !== "POST") {
    return NextResponse.json(
      { ok: false, message: "Método no permitido." },
      { status: 405 }
    );
  }

  const body = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
  const action = String(body.action || "").trim();
  const nowIso = new Date().toISOString();

  // ---------------- SAVE GENERAL CONFIG & SCHEDULE ----------------
  if (action === "save_config") {
    const c = (body.config || body) as AnyObj;
    const sched = (c.defaultSchedule || c) as AnyObj;
    const geo = (c.workplaceGeo || {}) as AnyObj;

    if (sched.horaIngreso && !isValidTimeHHMM(sched.horaIngreso)) {
      return NextResponse.json(
        { ok: false, message: "Hora de ingreso inválida (formato HH:MM)." },
        { status: 400 }
      );
    }
    if (sched.horaEgreso && !isValidTimeHHMM(sched.horaEgreso)) {
      return NextResponse.json(
        { ok: false, message: "Hora de egreso inválida (formato HH:MM)." },
        { status: 400 }
      );
    }

    db.config = {
      googleClientId: String(c.googleClientId ?? db.config.googleClientId ?? "").trim(),
      allowSelfRegistration:
        c.allowSelfRegistration !== undefined
          ? Boolean(c.allowSelfRegistration)
          : db.config.allowSelfRegistration,
      trackingIntervalSec: Math.min(
        600,
        Math.max(15, Number(c.trackingIntervalSec ?? db.config.trackingIntervalSec ?? 60))
      ),
      defaultSchedule: {
        horaIngreso: isValidTimeHHMM(sched.horaIngreso)
          ? String(sched.horaIngreso)
          : db.config.defaultSchedule.horaIngreso,
        horaEgreso: isValidTimeHHMM(sched.horaEgreso)
          ? String(sched.horaEgreso)
          : db.config.defaultSchedule.horaEgreso,
        toleranciaIngresoMin: Math.max(
          0,
          Math.min(
            120,
            Number(
              sched.toleranciaIngresoMin ??
                db.config.defaultSchedule.toleranciaIngresoMin
            )
          )
        ),
        toleranciaEgresoMin: Math.max(
          0,
          Math.min(
            120,
            Number(
              sched.toleranciaEgresoMin ??
                db.config.defaultSchedule.toleranciaEgresoMin
            )
          )
        ),
        diasLaborales:
          Array.isArray(sched.diasLaborales) && sched.diasLaborales.length > 0
            ? sched.diasLaborales.map(Number).filter((n: number) => n >= 0 && n <= 6)
            : db.config.defaultSchedule.diasLaborales,
      },
      workplaceGeo: {
        enabled:
          geo.enabled !== undefined
            ? Boolean(geo.enabled)
            : db.config.workplaceGeo.enabled,
        label: String(geo.label ?? db.config.workplaceGeo.label ?? "Sede Principal").trim(),
        lat:
          geo.lat !== undefined && geo.lat !== "" && geo.lat !== null && Number.isFinite(Number(geo.lat))
            ? Number(geo.lat)
            : db.config.workplaceGeo.lat,
        lng:
          geo.lng !== undefined && geo.lng !== "" && geo.lng !== null && Number.isFinite(Number(geo.lng))
            ? Number(geo.lng)
            : db.config.workplaceGeo.lng,
        radiusMeters: Math.max(
          25,
          Math.min(50000, Number(geo.radiusMeters ?? db.config.workplaceGeo.radiusMeters ?? 150))
        ),
      },
    };

    db.updatedAt = nowIso;
    await putTenantDoc(tenant, ASISTENCIA_DOC_KEY, db, auth.actor, "asistencia_save_config");
    return NextResponse.json({
      ok: true,
      message: "Configuración general y horarios guardados correctamente.",
      ...buildPayload(),
    });
  }

  // ---------------- CREATE / UPDATE EMPLOYEE (EMPLOYER-MANAGED) ----------------
  if (action === "save_employee") {
    const raw = (body.employee || body) as AnyObj;
    const empId = String(raw.id || "").trim();
    const existing = empId
      ? db.employees.find((e) => !e.deleted && e.id === empId)
      : undefined;

    const username = normalizeUsername(raw.username || existing?.username || "");
    const email = String(raw.email ?? existing?.email ?? "").trim().toLowerCase();
    const password = String(raw.password || "").trim();

    if (!existing && !username) {
      return NextResponse.json(
        {
          ok: false,
          message: "Indicá un nombre de usuario para la cuenta gestionada del empleado.",
        },
        { status: 400 }
      );
    }
    if (!existing && password.length < 4) {
      return NextResponse.json(
        {
          ok: false,
          message: "Ingresá una contraseña inicial de al menos 4 caracteres.",
        },
        { status: 400 }
      );
    }

    if (
      username &&
      db.employees.some(
        (e) =>
          !e.deleted &&
          e.id !== existing?.id &&
          e.username.toLowerCase() === username
      )
    ) {
      return NextResponse.json(
        { ok: false, message: `El usuario "${username}" ya está en uso.` },
        { status: 409 }
      );
    }
    if (
      email &&
      db.employees.some(
        (e) =>
          !e.deleted &&
          e.id !== existing?.id &&
          e.email &&
          e.email.toLowerCase() === email
      )
    ) {
      return NextResponse.json(
        { ok: false, message: `El correo "${email}" ya pertenece a otro empleado.` },
        { status: 409 }
      );
    }

    const schedRaw = (raw.scheduleOverride || {}) as AnyObj;
    const scheduleOverride = {
      useCustom: Boolean(
        schedRaw.useCustom ?? existing?.scheduleOverride?.useCustom ?? false
      ),
      horaIngreso: isValidTimeHHMM(schedRaw.horaIngreso)
        ? String(schedRaw.horaIngreso)
        : existing?.scheduleOverride?.horaIngreso || db.config.defaultSchedule.horaIngreso,
      horaEgreso: isValidTimeHHMM(schedRaw.horaEgreso)
        ? String(schedRaw.horaEgreso)
        : existing?.scheduleOverride?.horaEgreso || db.config.defaultSchedule.horaEgreso,
      toleranciaIngresoMin: Math.max(
        0,
        Math.min(
          120,
          Number(
            schedRaw.toleranciaIngresoMin ??
              existing?.scheduleOverride?.toleranciaIngresoMin ??
              db.config.defaultSchedule.toleranciaIngresoMin
          )
        )
      ),
      toleranciaEgresoMin: Math.max(
        0,
        Math.min(
          120,
          Number(
            schedRaw.toleranciaEgresoMin ??
              existing?.scheduleOverride?.toleranciaEgresoMin ??
              db.config.defaultSchedule.toleranciaEgresoMin
          )
        )
      ),
      diasLaborales:
        Array.isArray(schedRaw.diasLaborales) && schedRaw.diasLaborales.length > 0
          ? schedRaw.diasLaborales.map(Number).filter((n: number) => n >= 0 && n <= 6)
          : existing?.scheduleOverride?.diasLaborales || db.config.defaultSchedule.diasLaborales,
    };

    const profile = extractProfileFromBody(raw.profile || raw, existing?.profile);
    const complete = isProfileComplete(profile);

    if (existing) {
      if (username) existing.username = username;
      existing.email = email;
      if (password.length >= 4) {
        existing.passwordHash = hashPassword(password);
      }
      if (raw.active !== undefined) existing.active = Boolean(raw.active);
      existing.puesto = String(raw.puesto ?? existing.puesto ?? "").trim();
      existing.sector = String(raw.sector ?? existing.sector ?? "").trim();
      existing.profile = profile;
      existing.mustCompleteProfile = !complete;
      existing.scheduleOverride = scheduleOverride;
      existing.updatedAt = nowIso;
    } else {
      const created: AsistenciaEmployeeRecord = {
        id: `emp_${crypto.randomUUID().slice(0, 10)}`,
        authProvider: "employer_managed",
        email,
        username,
        passwordHash: hashPassword(password),
        createdByEmployer: true,
        mustCompleteProfile: !complete,
        active: raw.active !== false,
        puesto: String(raw.puesto || "").trim(),
        sector: String(raw.sector || "").trim(),
        profile,
        scheduleOverride,
        biometrics: {
          enrolled: false,
          enrolledAt: null,
          credentials: [],
        },
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: null,
      };
      db.employees.unshift(created);
    }

    db.updatedAt = nowIso;
    await putTenantDoc(tenant, ASISTENCIA_DOC_KEY, db, auth.actor, "asistencia_save_employee");
    return NextResponse.json({
      ok: true,
      message: existing
        ? "Datos del empleado y horario actualizados correctamente."
        : `Empleado "${username}" creado correctamente.`,
      ...buildPayload(),
    });
  }

  // ---------------- RESET EMPLOYEE BIOMETRICS ----------------
  if (action === "reset_employee_biometrics") {
    const empId = String(body.employeeId || "").trim();
    const emp = db.employees.find((e) => !e.deleted && e.id === empId);
    if (!emp) {
      return NextResponse.json(
        { ok: false, message: "Empleado no encontrado." },
        { status: 404 }
      );
    }
    emp.biometrics = { enrolled: false, enrolledAt: null, credentials: [] };
    emp.updatedAt = nowIso;
    db.updatedAt = nowIso;
    await putTenantDoc(
      tenant,
      ASISTENCIA_DOC_KEY,
      db,
      auth.actor,
      "asistencia_reset_biometrics"
    );
    return NextResponse.json({
      ok: true,
      message:
        "Biometría reiniciada. El empleado podrá vincular su huella o rostro en el nuevo dispositivo.",
      ...buildPayload(),
    });
  }

  // ---------------- TOGGLE EMPLOYEE ACTIVE ----------------
  if (action === "toggle_employee_active") {
    const empId = String(body.employeeId || "").trim();
    const emp = db.employees.find((e) => !e.deleted && e.id === empId);
    if (!emp) {
      return NextResponse.json(
        { ok: false, message: "Empleado no encontrado." },
        { status: 404 }
      );
    }
    emp.active = emp.active === false;
    emp.updatedAt = nowIso;
    db.updatedAt = nowIso;
    await putTenantDoc(
      tenant,
      ASISTENCIA_DOC_KEY,
      db,
      auth.actor,
      "asistencia_toggle_employee"
    );
    return NextResponse.json({
      ok: true,
      message: emp.active ? "Empleado activado." : "Empleado deshabilitado.",
      ...buildPayload(),
    });
  }

  // ---------------- DELETE EMPLOYEE ----------------
  if (action === "delete_employee") {
    const empId = String(body.employeeId || "").trim();
    const emp = db.employees.find((e) => !e.deleted && e.id === empId);
    if (!emp) {
      return NextResponse.json(
        { ok: false, message: "Empleado no encontrado." },
        { status: 404 }
      );
    }
    emp.deleted = true;
    emp.active = false;
    emp.updatedAt = nowIso;
    db.updatedAt = nowIso;
    await putTenantDoc(
      tenant,
      ASISTENCIA_DOC_KEY,
      db,
      auth.actor,
      "asistencia_delete_employee"
    );
    return NextResponse.json({
      ok: true,
      message: "Empleado eliminado del padrón activo.",
      ...buildPayload(),
    });
  }

  // ---------------- ADMIN CLOSE SHIFT ----------------
  if (action === "admin_close_shift") {
    const shiftId = String(body.shiftId || "").trim();
    const shift = db.shifts.find((s) => s.id === shiftId);
    if (!shift) {
      return NextResponse.json(
        { ok: false, message: "Jornada no encontrada." },
        { status: 404 }
      );
    }

    const customIso = body.checkOutAt ? String(body.checkOutAt) : nowIso;
    const outDate = new Date(customIso);
    const validOutIso = Number.isNaN(outDate.getTime())
      ? nowIso
      : outDate.toISOString();
    const outParts = getArgentinaDateParts(validOutIso);
    const lastPt =
      shift.trackPoints[shift.trackPoints.length - 1] || null;

    shift.checkOutAt = validOutIso;
    shift.checkOutLocalTime = outParts.time;
    shift.checkOutGeo = lastPt
      ? {
          lat: lastPt.lat,
          lng: lastPt.lng,
          accuracy: lastPt.accuracy,
          capturedAt: validOutIso,
          distanceMeters: shift.checkInGeo?.distanceMeters ?? null,
        }
      : shift.checkInGeo;
    shift.checkOutBiometric = {
      verified: false,
      method: "admin_close",
      verifiedAt: nowIso,
      deviceInfo: `Cierre administrativo por ${auth.actor}`,
    };
    shift.status = "closed_by_admin";
    if (body.adminNotes !== undefined) {
      shift.adminNotes = String(body.adminNotes || "").trim();
    }
    shift.metrics = computeShiftMetrics(shift);
    shift.totalDistanceKm = computeTrackDistanceKm(shift.trackPoints);
    shift.updatedAt = nowIso;
    db.updatedAt = nowIso;

    await putTenantDoc(
      tenant,
      ASISTENCIA_DOC_KEY,
      db,
      auth.actor,
      "asistencia_admin_close_shift"
    );
    return NextResponse.json({
      ok: true,
      message: `Jornada cerrada administrativamente a las ${outParts.time} hs.`,
      ...buildPayload(),
    });
  }

  // ---------------- UPDATE SHIFT NOTES ----------------
  if (action === "update_shift_notes") {
    const shiftId = String(body.shiftId || "").trim();
    const shift = db.shifts.find((s) => s.id === shiftId);
    if (!shift) {
      return NextResponse.json(
        { ok: false, message: "Jornada no encontrada." },
        { status: 404 }
      );
    }
    shift.adminNotes = String(body.adminNotes || "").trim();
    shift.updatedAt = nowIso;
    db.updatedAt = nowIso;
    await putTenantDoc(
      tenant,
      ASISTENCIA_DOC_KEY,
      db,
      auth.actor,
      "asistencia_shift_notes"
    );
    return NextResponse.json({
      ok: true,
      message: "Observación guardada.",
      ...buildPayload(),
    });
  }

  return NextResponse.json(
    { ok: false, message: `Acción administrativa no reconocida: ${action}` },
    { status: 400 }
  );
}
