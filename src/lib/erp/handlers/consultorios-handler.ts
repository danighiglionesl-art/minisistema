import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildDefaultCemepWebContent,
  buildInitialGestionWebDb,
  buildInitialHistoriaClinicaDb,
  type CemepProfAccessRecord,
  type CemepWebContentConfig,
  type CemepWebUserRecord,
  computeImc,
  type EstudioMedicoRecord,
  type EstudioTipo,
  type EvolucionClinicaRecord,
  type FichaClinicaRecord,
  type GestionWebDbDoc,
  type HistoriaClinicaDbDoc,
  type RecetaDigitalRecord,
  type RecetaEstado,
} from "../consultorios-types";
import { extractErpSessionFromRequest, verifyErpUserPassword } from "../erp-session";
import { getTenantDoc, putTenantDoc, listTenantUsersFromDb } from "../supabase-server";
import { loadTurnosDb, TURNOS_DOC_KEY } from "./turnos-handler";
import { normalizeDni, type TurnoEstado, type TurnosDbDoc } from "../turnos-types";
import { type ErpTenantRecord, GENERAL_ADMIN_USERNAME } from "../types";

type AnyObj = Record<string, any>;

export const HISTORIA_CLINICA_DOC_KEY = "historia_clinica_db";
export const GESTION_WEB_DOC_KEY = "gestion_web_db";

const PATIENT_SESSION_COOKIE = "ms_cemep_patient_session";
const PROF_SESSION_COOKIE = "ms_cemep_prof_session";

function getSessionSecret(): string {
  return (
    process.env.ERP_SESSION_SECRET ||
    process.env.MP_CLIENT_SECRET ||
    "minisistema-cemep-consultorios-session-2026"
  );
}

export function hashPasswordScrypt(plain: string): string {
  const salt = crypto.randomBytes(12).toString("hex");
  const hash = crypto.scryptSync(plain, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPasswordScrypt(plain: string, stored?: string): boolean {
  if (!plain || !stored) return false;
  if (stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    if (parts.length === 3) {
      try {
        const derived = crypto.scryptSync(plain, parts[1], 32).toString("hex");
        return crypto.timingSafeEqual(
          Buffer.from(derived, "hex"),
          Buffer.from(parts[2], "hex")
        );
      } catch {
        return false;
      }
    }
  }
  return false;
}

function signToken(payload: Record<string, unknown>, days = 14): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * days;
  const data = Buffer.from(JSON.stringify({ ...payload, exp }), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

function verifyToken<T = Record<string, any>>(token?: string | null): T | null {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  const expected = crypto
    .createHmac("sha256", getSessionSecret())
    .update(data)
    .digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (Number(parsed?.exp || 0) < Date.now()) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

async function trySendEmail(params: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY || "";
  if (!resendKey || !params.to) return false;
  try {
    const fromEmail =
      process.env.RESEND_FROM_EMAIL ||
      process.env.NOTIFICATION_FROM_EMAIL ||
      "no-reply@minisistema.com.ar";
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${params.fromName || "CEMEP · Centro Médico Paulucci"} <${fromEmail}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

function deepMergeWebContent(
  base: CemepWebContentConfig,
  partial?: Partial<CemepWebContentConfig> | null
): CemepWebContentConfig {
  if (!partial) return JSON.parse(JSON.stringify(base));
  return {
    general: { ...base.general, ...(partial.general || {}) },
    cemep: {
      ...base.cemep,
      ...(partial.cemep || {}),
      especialidadesDestacadas:
        Array.isArray(partial.cemep?.especialidadesDestacadas) &&
        partial.cemep.especialidadesDestacadas.length > 0
          ? partial.cemep.especialidadesDestacadas
          : base.cemep.especialidadesDestacadas,
      profesionalesDestacados:
        Array.isArray(partial.cemep?.profesionalesDestacados) &&
        partial.cemep.profesionalesDestacados.length > 0
          ? partial.cemep.profesionalesDestacados
          : base.cemep.profesionalesDestacados,
      tipsSalud:
        Array.isArray(partial.cemep?.tipsSalud) && partial.cemep.tipsSalud.length > 0
          ? partial.cemep.tipsSalud
          : base.cemep.tipsSalud,
    },
    cemepPlus: {
      ...base.cemepPlus,
      ...(partial.cemepPlus || {}),
      pilares:
        Array.isArray(partial.cemepPlus?.pilares) && partial.cemepPlus.pilares.length > 0
          ? partial.cemepPlus.pilares
          : base.cemepPlus.pilares,
      campanasDestacadas:
        Array.isArray(partial.cemepPlus?.campanasDestacadas) &&
        partial.cemepPlus.campanasDestacadas.length > 0
          ? partial.cemepPlus.campanasDestacadas
          : base.cemepPlus.campanasDestacadas,
      comerciosAdheridos:
        Array.isArray(partial.cemepPlus?.comerciosAdheridos) &&
        partial.cemepPlus.comerciosAdheridos.length > 0
          ? partial.cemepPlus.comerciosAdheridos
          : base.cemepPlus.comerciosAdheridos,
    },
  };
}

export async function loadHistoriaClinicaDb(
  tenant: ErpTenantRecord
): Promise<HistoriaClinicaDbDoc> {
  const initial = buildInitialHistoriaClinicaDb();
  const { payload } = await getTenantDoc<Partial<HistoriaClinicaDbDoc>>(
    tenant,
    HISTORIA_CLINICA_DOC_KEY,
    initial
  );
  return {
    updatedAt: payload?.updatedAt || initial.updatedAt,
    lastRecetaSeq: Number(payload?.lastRecetaSeq || 0),
    fichas: Array.isArray(payload?.fichas) ? payload.fichas : [],
    evoluciones: Array.isArray(payload?.evoluciones) ? payload.evoluciones : [],
    estudios: Array.isArray(payload?.estudios) ? payload.estudios : [],
    recetas: Array.isArray(payload?.recetas) ? payload.recetas : [],
  };
}

export async function loadGestionWebDb(
  tenant: ErpTenantRecord
): Promise<GestionWebDbDoc> {
  const initial = buildInitialGestionWebDb();
  const defaults = buildDefaultCemepWebContent();
  const { payload } = await getTenantDoc<Partial<GestionWebDbDoc>>(
    tenant,
    GESTION_WEB_DOC_KEY,
    initial
  );
  const LEGACY_GOOGLE_CLIENT_ID =
    "384115038053-ktejh22ce4f9hkun4nba8qajnf3g0euh.apps.googleusercontent.com";
  const savedGoogleClientId = String(payload?.googleClientId || "").trim();
  const effectiveSavedClientId =
    savedGoogleClientId && savedGoogleClientId !== LEGACY_GOOGLE_CLIENT_ID
      ? savedGoogleClientId
      : "";

  return {
    updatedAt: payload?.updatedAt || initial.updatedAt,
    googleClientId:
      effectiveSavedClientId ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      initial.googleClientId ||
      "",
    publishedAt: payload?.publishedAt || initial.publishedAt,
    publishedBy: payload?.publishedBy || initial.publishedBy,
    hasUnpublishedChanges: Boolean(payload?.hasUnpublishedChanges),
    draftContent: deepMergeWebContent(defaults, payload?.draftContent),
    publishedContent: deepMergeWebContent(defaults, payload?.publishedContent),
    webUsers: Array.isArray(payload?.webUsers) ? payload.webUsers : [],
    profesionalAccounts: Array.isArray(payload?.profesionalAccounts)
      ? payload.profesionalAccounts
      : [],
  };
}

export function sanitizeWebUser(u: CemepWebUserRecord) {
  const { passwordHash: _p, resetCode: _r, resetCodeExpiresAt: _re, ...safe } = u;
  return safe;
}

export function sanitizeProfAccount(a: CemepProfAccessRecord) {
  const { passwordHash: _p, ...safe } = a;
  return safe;
}

function buildPublicCemepStats(
  hc: HistoriaClinicaDbDoc,
  web: GestionWebDbDoc,
  turnos: TurnosDbDoc
) {
  return {
    totalFichas: hc.fichas.length,
    totalEvoluciones: hc.evoluciones.length,
    totalEstudios: hc.estudios.length,
    totalRecetas: hc.recetas.length,
    recetasPendientes: hc.recetas.filter(
      (r) => r.estado === "solicitada" || r.estado === "en_proceso"
    ).length,
    recetasEmitidas: hc.recetas.filter((r) => r.estado === "emitida").length,
    totalUsuariosWeb: web.webUsers.length,
    usuariosWebActivos: web.webUsers.filter((u) => u.activo !== false).length,
    totalProfesionalesTurnero: turnos.profesionales.filter((p) => p.activo !== false).length,
    totalPacientesTurnero: turnos.pacientes.filter((p) => p.activo !== false).length,
    totalTurnos: turnos.turnos.length,
    hasUnpublishedChanges: web.hasUnpublishedChanges,
  };
}

async function canAccessConsultoriosErp(
  session: ReturnType<typeof extractErpSessionFromRequest>,
  tenant: ErpTenantRecord
): Promise<boolean> {
  if (!session) return false;
  if (
    session.username.toLowerCase() === GENERAL_ADMIN_USERNAME ||
    session.role === "Administrador General" ||
    session.role === "Administrador"
  ) {
    return true;
  }
  const users = await listTenantUsersFromDb(tenant);
  const found = users.find(
    (u) => u.active !== false && u.username.toLowerCase() === session.username.toLowerCase()
  );
  const mods: string[] = Array.isArray(found?.modules) ? found.modules.map(String) : [];
  return mods.some(
    (m: string) =>
      m === "gestion_consultorios" ||
      m === "historia_clinica" ||
      m === "gestion_web" ||
      m === "turnos" ||
      m.startsWith("historia_clinica:") ||
      m.startsWith("gestion_web:") ||
      m.startsWith("turnos:")
  );
}

function buildPatientPortalBundle(
  user: CemepWebUserRecord,
  hc: HistoriaClinicaDbDoc,
  turnosDb: TurnosDbDoc
) {
  const cleanDni = normalizeDni(user.dni);
  const lowEmail = user.email.toLowerCase();

  const misTurnos = turnosDb.turnos
    .filter(
      (t) =>
        (cleanDni && normalizeDni(t.pacienteDni) === cleanDni) ||
        (user.pacienteId && t.pacienteId === user.pacienteId) ||
        (t.pacienteEmail && t.pacienteEmail.toLowerCase() === lowEmail)
    )
    .sort((a, b) => `${b.fecha} ${b.horaInicio}`.localeCompare(`${a.fecha} ${a.horaInicio}`));

  const misEstudios = hc.estudios
    .filter(
      (e) =>
        e.visibleParaPaciente !== false &&
        ((e.webUserId && e.webUserId === user.id) ||
          (cleanDni && normalizeDni(e.pacienteDni) === cleanDni) ||
          (user.pacienteId && e.pacienteId === user.pacienteId))
    )
    .sort((a, b) => b.fechaEstudio.localeCompare(a.fechaEstudio) || b.createdAt.localeCompare(a.createdAt));

  const misRecetas = hc.recetas
    .filter(
      (r) =>
        (r.webUserId && r.webUserId === user.id) ||
        (cleanDni && normalizeDni(r.pacienteDni) === cleanDni) ||
        r.pacienteEmail.toLowerCase() === lowEmail
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const miFicha = hc.fichas.find(
    (f) =>
      (cleanDni && normalizeDni(f.pacienteDni) === cleanDni) ||
      (user.pacienteId && f.pacienteId === user.pacienteId)
  );

  return {
    user: sanitizeWebUser(user),
    turnos: misTurnos,
    estudios: misEstudios,
    recetas: misRecetas,
    resumenClinico: miFicha
      ? {
          grupoSanguineo: miFicha.grupoSanguineo || "",
          alergias: miFicha.alergias || "",
          obraSocialNombre: miFicha.obraSocialNombre || user.obraSocial || "",
          esAfiliadoCemepPlus: Boolean(miFicha.esAfiliadoCemepPlus || user.esAfiliadoCemepPlus),
        }
      : null,
  };
}

function buildProfessionalPortalBundle(
  profSession: {
    profAccountId: string;
    profesionalId: string;
    nombre: string;
    dni: string;
    email: string;
    isAdminFallback?: boolean;
  },
  hc: HistoriaClinicaDbDoc,
  webDb: GestionWebDbDoc,
  turnosDb: TurnosDbDoc
) {
  const isAll = Boolean(profSession.isAdminFallback || profSession.profesionalId === "*");
  const profRec = turnosDb.profesionales.find((p) => p.id === profSession.profesionalId);

  const turnos = (isAll
    ? turnosDb.turnos
    : turnosDb.turnos.filter(
        (t) =>
          t.profesionalId === profSession.profesionalId ||
          (profSession.dni && normalizeDni(t.profesionalDni) === normalizeDni(profSession.dni))
      )
  ).sort((a, b) => `${b.fecha} ${b.horaInicio}`.localeCompare(`${a.fecha} ${a.horaInicio}`));

  // Unificar lista de pacientes (Turnero Web + Usuarios Web registrados + Fichas HC)
  const patientMap = new Map<
    string,
    {
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
  >();

  for (const p of turnosDb.pacientes) {
    const key = normalizeDni(p.dni) || p.id;
    const os = turnosDb.obrasSociales.find((o) => o.id === p.obraSocialId);
    patientMap.set(key, {
      pacienteId: p.id,
      dni: p.dni,
      nombreCompleto: p.nombreCompleto,
      whatsapp: p.whatsapp || "",
      email: p.email || "",
      fechaNacimiento: p.fechaNacimiento || "",
      obraSocial: os ? `${os.sigla} · ${os.nombre}` : "",
      esUsuarioRegistrado: false,
      esAfiliadoCemepPlus: false,
    });
  }

  for (const u of webDb.webUsers) {
    const key = normalizeDni(u.dni) || u.id;
    const prev = patientMap.get(key);
    patientMap.set(key, {
      pacienteId: prev?.pacienteId || u.pacienteId || u.id,
      dni: u.dni || prev?.dni || "",
      nombreCompleto: u.nombreCompleto || prev?.nombreCompleto || u.email,
      whatsapp: u.whatsapp || prev?.whatsapp || "",
      email: u.email || prev?.email || "",
      fechaNacimiento: u.fechaNacimiento || prev?.fechaNacimiento || "",
      obraSocial: u.obraSocial || prev?.obraSocial || "",
      esUsuarioRegistrado: true,
      webUserId: u.id,
      esAfiliadoCemepPlus: Boolean(u.esAfiliadoCemepPlus),
    });
  }

  for (const f of hc.fichas) {
    const key = normalizeDni(f.pacienteDni) || f.pacienteId;
    if (!patientMap.has(key)) {
      patientMap.set(key, {
        pacienteId: f.pacienteId,
        dni: f.pacienteDni,
        nombreCompleto: f.pacienteNombre,
        whatsapp: f.whatsapp || "",
        email: f.email || "",
        fechaNacimiento: f.fechaNacimiento || "",
        obraSocial: f.obraSocialNombre || "",
        esUsuarioRegistrado: false,
        esAfiliadoCemepPlus: Boolean(f.esAfiliadoCemepPlus),
      });
    }
  }

  const pacientes = Array.from(patientMap.values()).sort((a, b) =>
    a.nombreCompleto.localeCompare(b.nombreCompleto, "es")
  );

  return {
    profesional: {
      profesionalId: profSession.profesionalId,
      nombre: profRec?.nombreCompleto || profSession.nombre,
      titulo: profRec?.titulo || "",
      matriculaNacional: profRec?.matriculaNacional || "",
      matriculaProvincial: profRec?.matriculaProvincial || "",
      dni: profRec?.dni || profSession.dni,
      email: profRec?.email || profSession.email,
      isAdminAllView: isAll,
    },
    turnos,
    pacientes,
    fichas: hc.fichas,
    evoluciones: hc.evoluciones.sort((a, b) =>
      `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`)
    ),
    estudios: hc.estudios.sort((a, b) =>
      b.fechaEstudio.localeCompare(a.fechaEstudio) || b.createdAt.localeCompare(a.createdAt)
    ),
    recetas: hc.recetas.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    especialidades: turnosDb.especialidades.filter((e) => e.activa !== false),
  };
}

// ============================================================================
// 1. HANDLER ERP PRIVADO (/sistema/api/consultorios.php)
//    Sirve a los módulos "Historia Clínica" y "Gestión Web" en MiniSistema ERP
// ============================================================================

export async function handleErpConsultorios(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const session = extractErpSessionFromRequest(req, tenant.slug);
  if (!session || !(await canAccessConsultoriosErp(session, tenant))) {
    return NextResponse.json(
      { ok: false, message: "No tenés permisos para operar Gestión Consultorios / Gestión Web." },
      { status: 403 }
    );
  }

  const [hc, webDb, turnosDb] = await Promise.all([
    loadHistoriaClinicaDb(tenant),
    loadGestionWebDb(tenant),
    loadTurnosDb(tenant),
  ]);

  const cemepPath =
    tenant.option_type === 2 && !tenant.is_base ? `/${tenant.slug}/cemep` : "/cemep";

  const buildErpPayload = () => {
    const unifiedPatients = buildProfessionalPortalBundle(
      {
        profAccountId: "erp_admin",
        profesionalId: "*",
        nombre: String((session as AnyObj).name || session.username),
        dni: "",
        email: "",
        isAdminFallback: true,
      },
      hc,
      webDb,
      turnosDb
    ).pacientes;

    return {
      publicCemepUrl: cemepPath,
      stats: buildPublicCemepStats(hc, webDb, turnosDb),
      historiaClinica: {
        updatedAt: hc.updatedAt,
        fichas: hc.fichas,
        evoluciones: hc.evoluciones.sort((a, b) =>
          `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`)
        ),
        estudios: hc.estudios.sort((a, b) =>
          b.fechaEstudio.localeCompare(a.fechaEstudio) || b.createdAt.localeCompare(a.createdAt)
        ),
        recetas: hc.recetas.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      },
      gestionWeb: {
        updatedAt: webDb.updatedAt,
        googleClientId: webDb.googleClientId || "",
        publishedAt: webDb.publishedAt,
        publishedBy: webDb.publishedBy,
        hasUnpublishedChanges: webDb.hasUnpublishedChanges,
        draftContent: webDb.draftContent,
        publishedContent: webDb.publishedContent,
        webUsers: webDb.webUsers.map(sanitizeWebUser),
        profesionalAccounts: webDb.profesionalAccounts.map(sanitizeProfAccount),
      },
      turnosRef: {
        pacientes: unifiedPatients,
        profesionales: turnosDb.profesionales.map((p) => ({
          id: p.id,
          dni: p.dni,
          nombreCompleto: p.nombreCompleto,
          titulo: p.titulo || "",
          email: p.email || "",
          whatsapp: p.whatsapp || "",
          matriculaProvincial: p.matriculaProvincial || "",
          matriculaNacional: p.matriculaNacional || "",
          especialidadIds: p.especialidadIds || [],
          activo: p.activo !== false,
        })),
        especialidades: turnosDb.especialidades.filter((e) => e.activa !== false),
        turnosRecientes: turnosDb.turnos.slice(0, 200),
      },
    };
  };

  if (req.method === "GET") {
    return NextResponse.json({ ok: true, ...buildErpPayload() });
  }

  let body: AnyObj = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = String(body.action || "").trim();
  const nowIso = new Date().toISOString();
  const actor = String((session as AnyObj).name || session.username || "Administrador");

  // -------------------- HISTORIA CLÍNICA --------------------

  if (action === "save_ficha") {
    const raw = (body.ficha || body) as AnyObj;
    const dni = normalizeDni(raw.pacienteDni || raw.dni);
    const pacienteId = String(raw.pacienteId || (dni ? `pac_dni_${dni}` : `pac_${crypto.randomUUID().slice(0, 8)}`)).trim();
    const pacienteNombre = String(raw.pacienteNombre || "").trim();
    if (!pacienteNombre && !dni) {
      return NextResponse.json(
        { ok: false, message: "Indicá al menos el DNI o nombre del paciente." },
        { status: 400 }
      );
    }

    const idx = hc.fichas.findIndex(
      (f) =>
        (raw.id && f.id === raw.id) ||
        (dni && normalizeDni(f.pacienteDni) === dni) ||
        f.pacienteId === pacienteId
    );
    const prev = idx >= 0 ? hc.fichas[idx] : null;
    const record: FichaClinicaRecord = {
      id: prev?.id || `ficha_${crypto.randomUUID().slice(0, 10)}`,
      pacienteId: prev?.pacienteId || pacienteId,
      pacienteDni: dni || prev?.pacienteDni || "",
      pacienteNombre: pacienteNombre || prev?.pacienteNombre || `DNI ${dni}`,
      fechaNacimiento: String(raw.fechaNacimiento ?? prev?.fechaNacimiento ?? "").trim(),
      genero: String(raw.genero ?? prev?.genero ?? "").trim(),
      whatsapp: String(raw.whatsapp ?? prev?.whatsapp ?? "").trim(),
      email: String(raw.email ?? prev?.email ?? "").trim(),
      obraSocialNombre: String(raw.obraSocialNombre ?? prev?.obraSocialNombre ?? "").trim(),
      planNombre: String(raw.planNombre ?? prev?.planNombre ?? "").trim(),
      nroAfiliado: String(raw.nroAfiliado ?? prev?.nroAfiliado ?? "").trim(),
      esAfiliadoCemepPlus: Boolean(raw.esAfiliadoCemepPlus ?? prev?.esAfiliadoCemepPlus),
      grupoSanguineo: String(raw.grupoSanguineo ?? prev?.grupoSanguineo ?? "").trim(),
      alergias: String(raw.alergias ?? prev?.alergias ?? "").trim(),
      antecedentesPersonales: String(raw.antecedentesPersonales ?? prev?.antecedentesPersonales ?? "").trim(),
      antecedentesFamiliares: String(raw.antecedentesFamiliares ?? prev?.antecedentesFamiliares ?? "").trim(),
      antecedentesQuirurgicos: String(raw.antecedentesQuirurgicos ?? prev?.antecedentesQuirurgicos ?? "").trim(),
      medicacionCronica: String(raw.medicacionCronica ?? prev?.medicacionCronica ?? "").trim(),
      habitos: String(raw.habitos ?? prev?.habitos ?? "").trim(),
      alertasClinicas: String(raw.alertasClinicas ?? prev?.alertasClinicas ?? "").trim(),
      notasGenerales: String(raw.notasGenerales ?? prev?.notasGenerales ?? "").trim(),
      updatedBy: actor,
      createdAt: prev?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    if (idx >= 0) hc.fichas[idx] = record;
    else hc.fichas.unshift(record);
    hc.updatedAt = nowIso;
    await putTenantDoc(tenant, HISTORIA_CLINICA_DOC_KEY, hc, actor, "hc_save_ficha");
    return NextResponse.json({
      ok: true,
      message: `Ficha clínica de ${record.pacienteNombre} guardada correctamente.`,
      ficha: record,
      ...buildErpPayload(),
    });
  }

  if (action === "save_evolucion") {
    const raw = (body.evolucion || body) as AnyObj;
    const dni = normalizeDni(raw.pacienteDni);
    const pacienteNombre = String(raw.pacienteNombre || "").trim();
    const motivoConsulta = String(raw.motivoConsulta || "").trim();
    const diagnostico = String(raw.diagnostico || "").trim();
    if (!pacienteNombre && !dni) {
      return NextResponse.json(
        { ok: false, message: "Seleccioná un paciente para registrar la evolución." },
        { status: 400 }
      );
    }
    if (!motivoConsulta && !diagnostico && !String(raw.subjetivo || "").trim()) {
      return NextResponse.json(
        { ok: false, message: "Completá al menos el motivo de consulta, anamnesis o diagnóstico." },
        { status: 400 }
      );
    }

    const svRaw = raw.signosVitales || {};
    const pesoKg = String(svRaw.pesoKg || "").trim();
    const tallaCm = String(svRaw.tallaCm || "").trim();
    const imc = String(svRaw.imc || "").trim() || computeImc(pesoKg, tallaCm);

    const record: EvolucionClinicaRecord = {
      id: raw.id ? String(raw.id) : `evo_${crypto.randomUUID().slice(0, 10)}`,
      pacienteId: String(raw.pacienteId || (dni ? `pac_dni_${dni}` : "")).trim(),
      pacienteDni: dni,
      pacienteNombre: pacienteNombre || `DNI ${dni}`,
      turnoId: String(raw.turnoId || "").trim() || undefined,
      turnoCodigo: String(raw.turnoCodigo || "").trim() || undefined,
      profesionalId: String(raw.profesionalId || "erp").trim(),
      profesionalNombre: String(raw.profesionalNombre || actor).trim(),
      profesionalMatricula: String(raw.profesionalMatricula || "").trim() || undefined,
      especialidadNombre: String(raw.especialidadNombre || "Clínica Médica").trim(),
      fecha: String(raw.fecha || nowIso.slice(0, 10)).trim(),
      hora: String(raw.hora || nowIso.slice(11, 16)).trim(),
      motivoConsulta,
      subjetivo: String(raw.subjetivo || "").trim(),
      objetivo: String(raw.objetivo || "").trim(),
      signosVitales: {
        ta: String(svRaw.ta || "").trim(),
        fc: String(svRaw.fc || "").trim(),
        temp: String(svRaw.temp || "").trim(),
        pesoKg,
        tallaCm,
        imc,
        satO2: String(svRaw.satO2 || "").trim(),
      },
      diagnostico,
      codigoCie10: String(raw.codigoCie10 || "").trim() || undefined,
      planTerapeutico: String(raw.planTerapeutico || "").trim(),
      indicacionesPaciente: String(raw.indicacionesPaciente || "").trim() || undefined,
      privadaSoloProfesional: Boolean(raw.privadaSoloProfesional),
      createdBy: actor,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const idx = hc.evoluciones.findIndex((e) => e.id === record.id);
    if (idx >= 0) {
      record.createdAt = hc.evoluciones[idx].createdAt;
      hc.evoluciones[idx] = record;
    } else {
      hc.evoluciones.unshift(record);
    }
    hc.updatedAt = nowIso;
    await putTenantDoc(tenant, HISTORIA_CLINICA_DOC_KEY, hc, actor, "hc_save_evolucion");
    return NextResponse.json({
      ok: true,
      message: "Evolución clínica registrada correctamente.",
      evolucion: record,
      ...buildErpPayload(),
    });
  }

  if (action === "delete_evolucion") {
    const id = String(body.id || "").trim();
    hc.evoluciones = hc.evoluciones.filter((e) => e.id !== id);
    hc.updatedAt = nowIso;
    await putTenantDoc(tenant, HISTORIA_CLINICA_DOC_KEY, hc, actor, "hc_delete_evolucion");
    return NextResponse.json({ ok: true, message: "Evolución eliminada.", ...buildErpPayload() });
  }

  if (action === "save_estudio") {
    const raw = (body.estudio || body) as AnyObj;
    const dni = normalizeDni(raw.pacienteDni);
    const titulo = String(raw.titulo || "").trim();
    if (!titulo || (!dni && !raw.pacienteNombre)) {
      return NextResponse.json(
        { ok: false, message: "Completá paciente y título del estudio." },
        { status: 400 }
      );
    }
    const matchedWebUser = webDb.webUsers.find(
      (u) => (raw.webUserId && u.id === raw.webUserId) || (dni && normalizeDni(u.dni) === dni)
    );

    const record: EstudioMedicoRecord = {
      id: raw.id ? String(raw.id) : `est_${crypto.randomUUID().slice(0, 10)}`,
      pacienteId: String(raw.pacienteId || matchedWebUser?.pacienteId || `pac_dni_${dni}`).trim(),
      pacienteDni: dni || matchedWebUser?.dni || "",
      pacienteNombre: String(raw.pacienteNombre || matchedWebUser?.nombreCompleto || `DNI ${dni}`).trim(),
      webUserId: matchedWebUser?.id || (raw.webUserId ? String(raw.webUserId) : undefined),
      profesionalId: String(raw.profesionalId || "erp").trim(),
      profesionalNombre: String(raw.profesionalNombre || actor).trim(),
      especialidadNombre: String(raw.especialidadNombre || "").trim() || undefined,
      fechaEstudio: String(raw.fechaEstudio || nowIso.slice(0, 10)).trim(),
      tipoEstudio: (String(raw.tipoEstudio || "Informe Médico") as EstudioTipo),
      titulo,
      descripcionInforme: String(raw.descripcionInforme || "").trim(),
      archivoNombre: String(raw.archivoNombre || "").trim() || undefined,
      archivoMime: String(raw.archivoMime || "").trim() || undefined,
      archivoDataUrl: String(raw.archivoDataUrl || "").trim() || undefined,
      visibleParaPaciente: raw.visibleParaPaciente !== false,
      createdBy: actor,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const idx = hc.estudios.findIndex((e) => e.id === record.id);
    if (idx >= 0) {
      record.createdAt = hc.estudios[idx].createdAt;
      hc.estudios[idx] = record;
    } else {
      hc.estudios.unshift(record);
    }
    hc.updatedAt = nowIso;
    await putTenantDoc(tenant, HISTORIA_CLINICA_DOC_KEY, hc, actor, "hc_save_estudio");
    return NextResponse.json({
      ok: true,
      message: `Estudio "${record.titulo}" cargado para ${record.pacienteNombre}.`,
      estudio: record,
      ...buildErpPayload(),
    });
  }

  if (action === "delete_estudio") {
    const id = String(body.id || "").trim();
    hc.estudios = hc.estudios.filter((e) => e.id !== id);
    hc.updatedAt = nowIso;
    await putTenantDoc(tenant, HISTORIA_CLINICA_DOC_KEY, hc, actor, "hc_delete_estudio");
    return NextResponse.json({ ok: true, message: "Estudio eliminado.", ...buildErpPayload() });
  }

  if (action === "update_receta" || action === "upload_receta_digital") {
    const id = String(body.id || "").trim();
    const rec = hc.recetas.find((r) => r.id === id);
    if (!rec) {
      return NextResponse.json(
        { ok: false, message: "Solicitud de receta no encontrada." },
        { status: 404 }
      );
    }
    if (body.estado) rec.estado = String(body.estado) as RecetaEstado;
    if (body.observacionesAdmin !== undefined) {
      rec.observacionesAdmin = String(body.observacionesAdmin || "").trim();
    }
    if (body.profesionalNombre !== undefined && String(body.profesionalNombre).trim()) {
      rec.profesionalNombre = String(body.profesionalNombre).trim();
    }
    if (body.recetaCodigoValidacion !== undefined) {
      rec.recetaCodigoValidacion = String(body.recetaCodigoValidacion || "").trim();
    }
    if (body.recetaArchivoDataUrl) {
      rec.recetaArchivoDataUrl = String(body.recetaArchivoDataUrl);
      rec.recetaArchivoNombre = String(body.recetaArchivoNombre || `receta-${rec.codigo}.pdf`);
      rec.recetaArchivoMime = String(body.recetaArchivoMime || "application/pdf");
      if (!body.estado || body.estado === "solicitada" || body.estado === "en_proceso") {
        rec.estado = "emitida";
      }
      rec.fechaEmision = nowIso;
      rec.emitidaPor = actor;
    } else if (rec.estado === "emitida" && !rec.fechaEmision) {
      rec.fechaEmision = nowIso;
      rec.emitidaPor = actor;
    }
    rec.updatedAt = nowIso;
    hc.updatedAt = nowIso;
    await putTenantDoc(tenant, HISTORIA_CLINICA_DOC_KEY, hc, actor, "hc_update_receta");

    if (rec.estado === "emitida" && rec.pacienteEmail) {
      await trySendEmail({
        to: rec.pacienteEmail,
        subject: `Tu receta digital ${rec.codigo} ya está disponible — CEMEP`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;border-radius:16px;border:2px solid #0099D8;background:#ffffff;color:#1B335D;">
          <h2 style="margin:0 0 8px;color:#1B335D;">Receta Digital Disponible (${rec.codigo})</h2>
          <p>Hola <strong>${rec.pacienteNombre}</strong>, tu receta digital ya fue cargada y podés descargarla desde el <strong>Portal de Pacientes</strong> en <strong>www.minisistema.com.ar/cemep</strong>.</p>
          ${rec.observacionesAdmin ? `<p style="background:#f0f9ff;padding:10px 12px;border-radius:10px;"><strong>Observaciones:</strong> ${rec.observacionesAdmin}</p>` : ""}
        </div>`,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Receta ${rec.codigo} actualizada (${rec.estado}).`,
      receta: rec,
      ...buildErpPayload(),
    });
  }

  if (action === "create_receta_manual") {
    const raw = (body.receta || body) as AnyObj;
    const dni = normalizeDni(raw.pacienteDni);
    const pacienteNombre = String(raw.pacienteNombre || "").trim();
    const medicamentosSolicitados = String(raw.medicamentosSolicitados || "").trim();
    if (!pacienteNombre || !medicamentosSolicitados) {
      return NextResponse.json(
        { ok: false, message: "Indicá paciente y medicamentos de la receta." },
        { status: 400 }
      );
    }
    const matchedWebUser = webDb.webUsers.find(
      (u) => dni && normalizeDni(u.dni) === dni
    );
    hc.lastRecetaSeq = Number(hc.lastRecetaSeq || 0) + 1;
    const year = new Date().getFullYear();
    const codigo = `REC-${year}-${String(hc.lastRecetaSeq).padStart(4, "0")}`;
    const hasFile = Boolean(raw.recetaArchivoDataUrl);
    const rec: RecetaDigitalRecord = {
      id: `rec_${crypto.randomUUID().slice(0, 10)}`,
      seq: hc.lastRecetaSeq,
      codigo,
      pacienteId: matchedWebUser?.pacienteId || (dni ? `pac_dni_${dni}` : undefined),
      pacienteDni: dni,
      pacienteNombre,
      pacienteEmail: String(raw.pacienteEmail || matchedWebUser?.email || "").trim(),
      pacienteWhatsapp: String(raw.pacienteWhatsapp || matchedWebUser?.whatsapp || "").trim(),
      webUserId: matchedWebUser?.id,
      profesionalNombre: String(raw.profesionalNombre || actor).trim(),
      obraSocialNombre: String(raw.obraSocialNombre || matchedWebUser?.obraSocial || "Particular").trim(),
      nroAfiliado: String(raw.nroAfiliado || matchedWebUser?.nroAfiliado || "").trim(),
      esAfiliadoCemepPlus: Boolean(raw.esAfiliadoCemepPlus ?? matchedWebUser?.esAfiliadoCemepPlus),
      medicamentosSolicitados,
      diagnosticoMotivo: String(raw.diagnosticoMotivo || "").trim(),
      observacionesAdmin: String(raw.observacionesAdmin || "").trim(),
      estado: hasFile ? "emitida" : "en_proceso",
      recetaCodigoValidacion: String(raw.recetaCodigoValidacion || "").trim(),
      recetaArchivoNombre: hasFile ? String(raw.recetaArchivoNombre || `${codigo}.pdf`) : undefined,
      recetaArchivoMime: hasFile ? String(raw.recetaArchivoMime || "application/pdf") : undefined,
      recetaArchivoDataUrl: hasFile ? String(raw.recetaArchivoDataUrl) : undefined,
      fechaEmision: hasFile ? nowIso : undefined,
      emitidaPor: hasFile ? actor : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    hc.recetas.unshift(rec);
    hc.updatedAt = nowIso;
    await putTenantDoc(tenant, HISTORIA_CLINICA_DOC_KEY, hc, actor, "hc_create_receta_manual");
    return NextResponse.json({
      ok: true,
      message: `Receta digital ${codigo} cargada correctamente.`,
      receta: rec,
      ...buildErpPayload(),
    });
  }

  // -------------------- GESTIÓN WEB (CMS + USUARIOS + PROFESIONALES) --------------------

  if (action === "save_web_draft") {
    const incoming = body.draftContent as Partial<CemepWebContentConfig> | undefined;
    if (!incoming) {
      return NextResponse.json(
        { ok: false, message: "Faltan datos del contenido web a guardar." },
        { status: 400 }
      );
    }
    const defaults = buildDefaultCemepWebContent();
    webDb.draftContent = deepMergeWebContent(defaults, incoming);
    if (body.googleClientId !== undefined) {
      webDb.googleClientId = String(body.googleClientId || "").trim();
    }
    webDb.hasUnpublishedChanges = true;
    webDb.updatedAt = nowIso;
    await putTenantDoc(tenant, GESTION_WEB_DOC_KEY, webDb, actor, "web_save_draft");
    return NextResponse.json({
      ok: true,
      message: "Cambios guardados en borrador. Presioná «Publicar en la Web» para reflejarlos en /cemep.",
      ...buildErpPayload(),
    });
  }

  if (action === "publish_web") {
    if (body.draftContent) {
      const defaults = buildDefaultCemepWebContent();
      webDb.draftContent = deepMergeWebContent(defaults, body.draftContent);
    }
    if (body.googleClientId !== undefined) {
      webDb.googleClientId = String(body.googleClientId || "").trim();
    }
    webDb.publishedContent = JSON.parse(JSON.stringify(webDb.draftContent));
    webDb.publishedAt = nowIso;
    webDb.publishedBy = actor;
    webDb.hasUnpublishedChanges = false;
    webDb.updatedAt = nowIso;
    await putTenantDoc(tenant, GESTION_WEB_DOC_KEY, webDb, actor, "web_publish");
    return NextResponse.json({
      ok: true,
      message: "¡Cambios publicados en vivo en www.minisistema.com.ar/cemep!",
      ...buildErpPayload(),
    });
  }

  if (action === "discard_web_draft") {
    webDb.draftContent = JSON.parse(JSON.stringify(webDb.publishedContent));
    webDb.hasUnpublishedChanges = false;
    webDb.updatedAt = nowIso;
    await putTenantDoc(tenant, GESTION_WEB_DOC_KEY, webDb, actor, "web_discard_draft");
    return NextResponse.json({
      ok: true,
      message: "Borrador restaurado a la última versión publicada.",
      ...buildErpPayload(),
    });
  }

  if (action === "toggle_web_user") {
    const id = String(body.id || "").trim();
    const u = webDb.webUsers.find((x) => x.id === id);
    if (!u) {
      return NextResponse.json({ ok: false, message: "Usuario web no encontrado." }, { status: 404 });
    }
    u.activo = body.activo !== undefined ? Boolean(body.activo) : !u.activo;
    u.updatedAt = nowIso;
    webDb.updatedAt = nowIso;
    await putTenantDoc(tenant, GESTION_WEB_DOC_KEY, webDb, actor, "web_toggle_user");
    return NextResponse.json({
      ok: true,
      message: `Usuario ${u.nombreCompleto} ${u.activo ? "habilitado" : "deshabilitado"}.`,
      ...buildErpPayload(),
    });
  }

  if (action === "update_web_user_admin") {
    const id = String(body.id || "").trim();
    const u = webDb.webUsers.find((x) => x.id === id);
    if (!u) {
      return NextResponse.json({ ok: false, message: "Usuario web no encontrado." }, { status: 404 });
    }
    if (body.dni !== undefined) u.dni = normalizeDni(body.dni);
    if (body.obraSocial !== undefined) u.obraSocial = String(body.obraSocial || "").trim();
    if (body.nroAfiliado !== undefined) u.nroAfiliado = String(body.nroAfiliado || "").trim();
    if (body.esAfiliadoCemepPlus !== undefined) {
      u.esAfiliadoCemepPlus = Boolean(body.esAfiliadoCemepPlus);
    }
    if (body.newPassword && String(body.newPassword).trim().length >= 4) {
      u.passwordHash = hashPasswordScrypt(String(body.newPassword).trim());
    }
    u.updatedAt = nowIso;
    webDb.updatedAt = nowIso;
    await putTenantDoc(tenant, GESTION_WEB_DOC_KEY, webDb, actor, "web_update_user_admin");
    return NextResponse.json({
      ok: true,
      message: `Datos de ${u.nombreCompleto} actualizados.`,
      ...buildErpPayload(),
    });
  }

  if (action === "save_prof_account") {
    const profesionalId = String(body.profesionalId || "").trim();
    const prof = turnosDb.profesionales.find((p) => p.id === profesionalId);
    const dni = normalizeDni(body.dni || prof?.dni);
    const email = String(body.email || prof?.email || "").trim().toLowerCase();
    const nombre = String(body.profesionalNombre || prof?.nombreCompleto || "").trim();
    const password = String(body.password || "").trim();

    if (!nombre || (!dni && !email)) {
      return NextResponse.json(
        { ok: false, message: "Indicá profesional y DNI o correo de acceso." },
        { status: 400 }
      );
    }
    const idx = webDb.profesionalAccounts.findIndex(
      (a) =>
        (body.id && a.id === body.id) ||
        (profesionalId && a.profesionalId === profesionalId) ||
        (dni && normalizeDni(a.dni) === dni)
    );
    if (idx < 0 && password.length < 4) {
      return NextResponse.json(
        { ok: false, message: "Definí una contraseña de al menos 4 caracteres para el profesional." },
        { status: 400 }
      );
    }
    const prev = idx >= 0 ? webDb.profesionalAccounts[idx] : null;
    const acc: CemepProfAccessRecord = {
      id: prev?.id || `pacc_${crypto.randomUUID().slice(0, 10)}`,
      profesionalId: profesionalId || prev?.profesionalId || "*",
      profesionalNombre: nombre,
      dni,
      email,
      especialidadResumen: String(body.especialidadResumen || prev?.especialidadResumen || "").trim(),
      passwordHash: password.length >= 4 ? hashPasswordScrypt(password) : (prev?.passwordHash || ""),
      activo: body.activo !== undefined ? Boolean(body.activo) : true,
      ultimoAccesoAt: prev?.ultimoAccesoAt,
      createdAt: prev?.createdAt || nowIso,
      updatedAt: nowIso,
    };
    if (idx >= 0) webDb.profesionalAccounts[idx] = acc;
    else webDb.profesionalAccounts.unshift(acc);
    webDb.updatedAt = nowIso;
    await putTenantDoc(tenant, GESTION_WEB_DOC_KEY, webDb, actor, "web_save_prof_account");
    return NextResponse.json({
      ok: true,
      message: `Acceso profesional de ${acc.profesionalNombre} guardado.`,
      ...buildErpPayload(),
    });
  }

  if (action === "delete_prof_account") {
    const id = String(body.id || "").trim();
    webDb.profesionalAccounts = webDb.profesionalAccounts.filter((a) => a.id !== id);
    webDb.updatedAt = nowIso;
    await putTenantDoc(tenant, GESTION_WEB_DOC_KEY, webDb, actor, "web_delete_prof_account");
    return NextResponse.json({
      ok: true,
      message: "Acceso profesional eliminado.",
      ...buildErpPayload(),
    });
  }

  return NextResponse.json(
    { ok: false, message: `Acción no reconocida: ${action}` },
    { status: 400 }
  );
}

// ============================================================================
// 2. HANDLER PÚBLICO (/api/cemep)
//    Portal Pacientes (Google/Email + Estudios + Recetas) y Portal Profesionales
// ============================================================================

export async function handlePublicCemepGet(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const action = String(req.nextUrl.searchParams.get("action") || "bootstrap").trim();
  const [hc, webDb, turnosDb] = await Promise.all([
    loadHistoriaClinicaDb(tenant),
    loadGestionWebDb(tenant),
    loadTurnosDb(tenant),
  ]);

  if (action === "patient_me") {
    const rawCookie = req.cookies.get(PATIENT_SESSION_COOKIE)?.value;
    const sess = verifyToken<{ userId: string; tenantSlug: string; email: string }>(rawCookie);
    if (!sess || (sess.tenantSlug && sess.tenantSlug !== tenant.slug)) {
      return NextResponse.json({ ok: true, authenticated: false });
    }
    const user = webDb.webUsers.find(
      (u) => u.activo !== false && (u.id === sess.userId || u.email.toLowerCase() === sess.email.toLowerCase())
    );
    if (!user) {
      return NextResponse.json({ ok: true, authenticated: false });
    }
    return NextResponse.json({
      ok: true,
      authenticated: true,
      ...buildPatientPortalBundle(user, hc, turnosDb),
    });
  }

  if (action === "prof_me") {
    const rawCookie = req.cookies.get(PROF_SESSION_COOKIE)?.value;
    const sess = verifyToken<{
      profAccountId: string;
      profesionalId: string;
      nombre: string;
      dni: string;
      email: string;
      tenantSlug: string;
      isAdminFallback?: boolean;
    }>(rawCookie);
    if (!sess || (sess.tenantSlug && sess.tenantSlug !== tenant.slug)) {
      return NextResponse.json({ ok: true, authenticated: false });
    }
    return NextResponse.json({
      ok: true,
      authenticated: true,
      ...buildProfessionalPortalBundle(sess, hc, webDb, turnosDb),
    });
  }

  return NextResponse.json({
    ok: true,
    tenantSlug: tenant.slug,
    content: webDb.publishedContent,
    publishedAt: webDb.publishedAt,
    googleClientId: webDb.googleClientId || "",
    turnosSummary: {
      totalProfesionales: turnosDb.profesionales.filter((p) => p.activo !== false).length,
      totalEspecialidades: turnosDb.especialidades.filter((e) => e.activa !== false).length,
      especialidades: turnosDb.especialidades
        .filter((e) => e.activa !== false)
        .map((e) => ({ id: e.id, nombre: e.nombre, duracionMinutos: e.duracionMinutos })),
    },
  });
}

export async function handlePublicCemepPost(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  let body: AnyObj = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = String(body.action || "").trim();
  const nowIso = new Date().toISOString();

  const [hc, webDb, turnosDb] = await Promise.all([
    loadHistoriaClinicaDb(tenant),
    loadGestionWebDb(tenant),
    loadTurnosDb(tenant),
  ]);

  // =================== PORTAL PACIENTES: AUTH ===================

  if (action === "patient_register") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const dni = normalizeDni(body.dni);
    const apellidos = String(body.apellidos || "").trim();
    const nombres = String(body.nombres || "").trim();
    const whatsapp = String(body.whatsapp || "").trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, message: "Ingresá un correo electrónico válido." }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json(
        { ok: false, message: "La contraseña debe tener al menos 4 caracteres." },
        { status: 400 }
      );
    }
    if (!apellidos || !nombres) {
      return NextResponse.json(
        { ok: false, message: "Completá tu apellido y nombre." },
        { status: 400 }
      );
    }
    if (webDb.webUsers.some((u) => u.email.toLowerCase() === email)) {
      return NextResponse.json(
        { ok: false, message: "Ya existe una cuenta con ese correo. Iniciá sesión o recuperá tu contraseña." },
        { status: 409 }
      );
    }

    const nombreCompleto = `${apellidos}, ${nombres}`;
    // Auto-vincular o crear ficha de paciente en Turnero Web si ingresó DNI
    let matchedPac = dni
      ? turnosDb.pacientes.find((p) => normalizeDni(p.dni) === dni)
      : undefined;

    if (!matchedPac && dni) {
      matchedPac = {
        id: `pac_${crypto.randomUUID().slice(0, 10)}`,
        dni,
        apellidos,
        nombres,
        nombreCompleto,
        fechaNacimiento: String(body.fechaNacimiento || "").trim(),
        whatsapp,
        email,
        nroAfiliado: String(body.nroAfiliado || "").trim(),
        origenRegistro: "WEB",
        activo: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      turnosDb.pacientes.unshift(matchedPac);
      turnosDb.updatedAt = nowIso;
      await putTenantDoc(tenant, TURNOS_DOC_KEY, turnosDb, email, "cemep_patient_register_sync");
    }

    const newUser: CemepWebUserRecord = {
      id: `usr_${crypto.randomUUID().slice(0, 10)}`,
      email,
      authProvider: "email",
      passwordHash: hashPasswordScrypt(password),
      resetCode: null,
      resetCodeExpiresAt: null,
      dni,
      apellidos,
      nombres,
      nombreCompleto,
      fechaNacimiento: String(body.fechaNacimiento || "").trim(),
      whatsapp,
      obraSocial: String(body.obraSocial || "").trim(),
      nroAfiliado: String(body.nroAfiliado || "").trim(),
      esAfiliadoCemepPlus: Boolean(body.esAfiliadoCemepPlus),
      pacienteId: matchedPac?.id,
      activo: true,
      ultimoAccesoAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    webDb.webUsers.unshift(newUser);
    webDb.updatedAt = nowIso;
    await putTenantDoc(tenant, GESTION_WEB_DOC_KEY, webDb, email, "cemep_patient_register");

    const token = signToken({ userId: newUser.id, tenantSlug: tenant.slug, email: newUser.email });
    const res = NextResponse.json({
      ok: true,
      message: `¡Bienvenido/a ${newUser.nombres}! Tu cuenta en CEMEP fue creada con éxito.`,
      ...buildPatientPortalBundle(newUser, hc, turnosDb),
    });
    res.cookies.set(PATIENT_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  }

  if (action === "patient_login") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const user = webDb.webUsers.find(
      (u) => u.activo !== false && u.email.toLowerCase() === email
    );
    if (!user || !verifyPasswordScrypt(password, user.passwordHash)) {
      return NextResponse.json(
        { ok: false, message: "Correo o contraseña incorrectos. Si olvidaste tu clave podés recuperarla automáticamente." },
        { status: 401 }
      );
    }
    user.ultimoAccesoAt = nowIso;
    user.updatedAt = nowIso;
    await putTenantDoc(tenant, GESTION_WEB_DOC_KEY, webDb, email, "cemep_patient_login");

    const token = signToken({ userId: user.id, tenantSlug: tenant.slug, email: user.email });
    const res = NextResponse.json({
      ok: true,
      message: `¡Hola ${user.nombres}! Sesión iniciada correctamente.`,
      ...buildPatientPortalBundle(user, hc, turnosDb),
    });
    res.cookies.set(PATIENT_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  }

  if (action === "patient_google_login") {
    let googleEmail = "";
    let googleName = "";
    let googleGivenName = "";
    let googleFamilyName = "";
    let googlePicture = "";
    let googleSub = "";

    const credential = String(body.credential || "").trim();
    const accessToken = String(body.accessToken || "").trim();

    if (credential && credential.split(".").length === 3) {
      try {
        const verifyResp = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (verifyResp.ok) {
          const info = (await verifyResp.json()) as AnyObj;
          googleEmail = String(info.email || "").trim().toLowerCase();
          googleName = String(info.name || info.given_name || "").trim();
          googleGivenName = String(info.given_name || "").trim();
          googleFamilyName = String(info.family_name || "").trim();
          googlePicture = String(info.picture || "").trim();
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
          googleGivenName = String(decoded.given_name || "").trim();
          googleFamilyName = String(decoded.family_name || "").trim();
          googlePicture = String(decoded.picture || "").trim();
          googleSub = String(decoded.sub || "").trim();
        } catch {
          // ignore
        }
      }
    } else if (accessToken) {
      try {
        const uRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(5000),
        });
        if (!uRes.ok) {
          return NextResponse.json(
            { ok: false, message: "No se pudo verificar tu cuenta de Google. Intentá nuevamente." },
            { status: 401 }
          );
        }
        const uData = (await uRes.json()) as AnyObj;
        googleEmail = String(uData.email || "").trim().toLowerCase();
        googleName = String(uData.name || "").trim();
        googleGivenName = String(uData.given_name || "").trim();
        googleFamilyName = String(uData.family_name || "").trim();
        googlePicture = String(uData.picture || "").trim();
        googleSub = String(uData.sub || "").trim();
      } catch {
        return NextResponse.json(
          { ok: false, message: "Error al obtener tu perfil de Google." },
          { status: 502 }
        );
      }
    }

    if (!googleEmail || !googleEmail.includes("@")) {
      return NextResponse.json(
        { ok: false, message: "No se pudo validar tu cuenta de Google. Intentá nuevamente." },
        { status: 400 }
      );
    }

    const parts = googleName.split(/\s+/).filter(Boolean);
    const resolvedNombres =
      googleGivenName ||
      (parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "Paciente");
    const resolvedApellidos =
      googleFamilyName || (parts.length > 1 ? parts.slice(-1).join(" ") : "");

    let user = webDb.webUsers.find((u) => u.email.toLowerCase() === googleEmail);
    if (!user) {
      user = {
        id: `usr_${crypto.randomUUID().slice(0, 10)}`,
        email: googleEmail,
        authProvider: "google",
        googleSub,
        fotoUrl: googlePicture || undefined,
        dni: normalizeDni(body.dni),
        apellidos: resolvedApellidos,
        nombres: resolvedNombres,
        nombreCompleto: resolvedApellidos
          ? `${resolvedApellidos}, ${resolvedNombres}`
          : resolvedNombres,
        whatsapp: String(body.whatsapp || "").trim(),
        esAfiliadoCemepPlus: false,
        activo: true,
        ultimoAccesoAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      webDb.webUsers.unshift(user);
    } else {
      if (user.activo === false) {
        return NextResponse.json(
          { ok: false, message: "Tu cuenta se encuentra deshabilitada. Comunicate con recepción de CEMEP." },
          { status: 403 }
        );
      }
      user.googleSub = googleSub || user.googleSub;
      if (googlePicture) user.fotoUrl = googlePicture;
      if (!user.nombres && resolvedNombres) user.nombres = resolvedNombres;
      if (!user.apellidos && resolvedApellidos) user.apellidos = resolvedApellidos;
      user.nombreCompleto = user.apellidos
        ? `${user.apellidos}, ${user.nombres}`
        : user.nombres || user.email;
      user.ultimoAccesoAt = nowIso;
      user.updatedAt = nowIso;
    }

    webDb.updatedAt = nowIso;
    await putTenantDoc(tenant, GESTION_WEB_DOC_KEY, webDb, googleEmail, "cemep_patient_google_login");

    const needsProfileCompletion = !user.dni || !user.whatsapp;
    const token = signToken({ userId: user.id, tenantSlug: tenant.slug, email: user.email });
    const res = NextResponse.json({
      ok: true,
      needsProfileCompletion,
      message: needsProfileCompletion
        ? "Ingresaste con Google. Revisá tus datos y completá los campos faltantes en Mi Perfil."
        : `Sesión iniciada con Google (${googleEmail}).`,
      ...buildPatientPortalBundle(user, hc, turnosDb),
    });
    res.cookies.set(PATIENT_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  }

  if (action === "patient_request_reset") {
    const email = String(body.email || "").trim().toLowerCase();
    const user = webDb.webUsers.find(
      (u) => u.activo !== false && u.email.toLowerCase() === email
    );
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "No encontramos una cuenta registrada con ese correo electrónico." },
        { status: 404 }
      );
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.resetCode = code;
    user.resetCodeExpiresAt = new Date(Date.now() + 1000 * 60 * 20).toISOString();
    user.updatedAt = nowIso;
    await putTenantDoc(tenant, GESTION_WEB_DOC_KEY, webDb, email, "cemep_patient_request_reset");

    const sent = await trySendEmail({
      to: user.email,
      subject: "Código de recuperación de contraseña — CEMEP Portal de Pacientes",
      html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;border-radius:16px;background:#1B335D;color:#ffffff;">
        <h2 style="margin:0 0 8px;color:#57B7B8;">Recuperación Automática de Contraseña</h2>
        <p>Hola ${user.nombres}, usá este código de 6 dígitos para crear una nueva contraseña en el Portal de Pacientes de <strong>CEMEP</strong>:</p>
        <div style="font-size:30px;font-weight:900;letter-spacing:6px;background:#ffffff;color:#1B335D;padding:14px;border-radius:12px;text-align:center;margin:16px 0;">${code}</div>
        <p style="font-size:12px;opacity:0.85;">Válido por 20 minutos.</p>
      </div>`,
    });

    return NextResponse.json({
      ok: true,
      emailSent: sent,
      devCodeHint: sent ? undefined : code,
      message: sent
        ? `Te enviamos un código de 6 dígitos a ${user.email}. Ingresalo para definir tu nueva contraseña.`
        : `Código de recuperación generado (${code}). Ingresalo junto con tu nueva contraseña.`,
    });
  }

  if (action === "patient_confirm_reset") {
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    const newPassword = String(body.newPassword || "").trim();
    if (newPassword.length < 4) {
      return NextResponse.json(
        { ok: false, message: "La nueva contraseña debe tener al menos 4 caracteres." },
        { status: 400 }
      );
    }
    const user = webDb.webUsers.find(
      (u) => u.activo !== false && u.email.toLowerCase() === email
    );
    if (
      !user ||
      !user.resetCode ||
      user.resetCode !== code ||
      !user.resetCodeExpiresAt ||
      new Date(user.resetCodeExpiresAt).getTime() < Date.now()
    ) {
      return NextResponse.json(
        { ok: false, message: "El código es inválido o ya venció." },
        { status: 400 }
      );
    }
    user.passwordHash = hashPasswordScrypt(newPassword);
    user.resetCode = null;
    user.resetCodeExpiresAt = null;
    user.updatedAt = nowIso;
    await putTenantDoc(tenant, GESTION_WEB_DOC_KEY, webDb, email, "cemep_patient_confirm_reset");
    return NextResponse.json({
      ok: true,
      message: "¡Contraseña actualizada! Ya podés ingresar con tu nueva clave.",
    });
  }

  if (action === "patient_logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(PATIENT_SESSION_COOKIE);
    return res;
  }

  // =================== PORTAL PACIENTES: ACCIONES AUTENTICADAS ===================

  if (action === "patient_update_profile" || action === "patient_request_receta") {
    const rawCookie = req.cookies.get(PATIENT_SESSION_COOKIE)?.value;
    const sess = verifyToken<{ userId: string; tenantSlug: string; email: string }>(rawCookie);
    const user = sess
      ? webDb.webUsers.find(
          (u) => u.activo !== false && (u.id === sess.userId || u.email.toLowerCase() === sess.email.toLowerCase())
        )
      : undefined;

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Tu sesión expiró. Volvé a iniciar sesión." },
        { status: 401 }
      );
    }

    if (action === "patient_update_profile") {
      if (body.dni !== undefined) user.dni = normalizeDni(body.dni);
      if (body.apellidos !== undefined) user.apellidos = String(body.apellidos || "").trim();
      if (body.nombres !== undefined) user.nombres = String(body.nombres || "").trim();
      user.nombreCompleto = user.apellidos
        ? `${user.apellidos}, ${user.nombres}`
        : user.nombres || user.email;
      if (body.fechaNacimiento !== undefined) {
        user.fechaNacimiento = String(body.fechaNacimiento || "").trim();
      }
      if (body.whatsapp !== undefined) user.whatsapp = String(body.whatsapp || "").trim();
      if (body.obraSocial !== undefined) user.obraSocial = String(body.obraSocial || "").trim();
      if (body.nroAfiliado !== undefined) user.nroAfiliado = String(body.nroAfiliado || "").trim();
      if (body.esAfiliadoCemepPlus !== undefined) {
        user.esAfiliadoCemepPlus = Boolean(body.esAfiliadoCemepPlus);
      }
      if (user.dni) {
        const matched = turnosDb.pacientes.find((p) => normalizeDni(p.dni) === user.dni);
        if (matched) user.pacienteId = matched.id;
      }
      user.updatedAt = nowIso;
      webDb.updatedAt = nowIso;
      await putTenantDoc(tenant, GESTION_WEB_DOC_KEY, webDb, user.email, "cemep_patient_update_profile");
      return NextResponse.json({
        ok: true,
        message: "Perfil actualizado correctamente.",
        ...buildPatientPortalBundle(user, hc, turnosDb),
      });
    }

    if (action === "patient_request_receta") {
      const medicamentosSolicitados = String(body.medicamentosSolicitados || "").trim();
      if (!medicamentosSolicitados) {
        return NextResponse.json(
          { ok: false, message: "Detallá el o los medicamentos / indicaciones que necesitás." },
          { status: 400 }
        );
      }
      hc.lastRecetaSeq = Number(hc.lastRecetaSeq || 0) + 1;
      const year = new Date().getFullYear();
      const codigo = `REC-${year}-${String(hc.lastRecetaSeq).padStart(4, "0")}`;
      const rec: RecetaDigitalRecord = {
        id: `rec_${crypto.randomUUID().slice(0, 10)}`,
        seq: hc.lastRecetaSeq,
        codigo,
        pacienteId: user.pacienteId || (user.dni ? `pac_dni_${user.dni}` : user.id),
        pacienteDni: user.dni || normalizeDni(body.dni),
        pacienteNombre: user.nombreCompleto,
        pacienteEmail: user.email,
        pacienteWhatsapp: String(body.whatsapp || user.whatsapp || "").trim(),
        webUserId: user.id,
        profesionalNombre: String(body.profesionalNombre || "").trim() || undefined,
        obraSocialNombre: String(body.obraSocialNombre || user.obraSocial || "Particular").trim(),
        nroAfiliado: String(body.nroAfiliado || user.nroAfiliado || "").trim(),
        esAfiliadoCemepPlus: Boolean(body.esAfiliadoCemepPlus ?? user.esAfiliadoCemepPlus),
        medicamentosSolicitados,
        diagnosticoMotivo: String(body.diagnosticoMotivo || "").trim(),
        notasPaciente: String(body.notasPaciente || "").trim(),
        estado: "solicitada",
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      hc.recetas.unshift(rec);
      hc.updatedAt = nowIso;
      await putTenantDoc(tenant, HISTORIA_CLINICA_DOC_KEY, hc, user.email, "cemep_patient_request_receta");
      return NextResponse.json({
        ok: true,
        message: `¡Solicitud de receta ${codigo} enviada! Cuando el administrador cargue tu receta digital la verás aquí lista para descargar.`,
        receta: rec,
        ...buildPatientPortalBundle(user, hc, turnosDb),
      });
    }
  }

  // =================== PORTAL PROFESIONALES: AUTH ===================

  if (action === "prof_login") {
    const identifier = String(body.identifier || body.email || body.dni || "").trim();
    const password = String(body.password || "").trim();
    if (!identifier || !password) {
      return NextResponse.json(
        { ok: false, message: "Ingresá tu usuario/DNI/email y contraseña." },
        { status: 400 }
      );
    }

    const cleanIdLower = identifier.toLowerCase();
    const cleanDni = normalizeDni(identifier);

    // 1. Buscar en cuentas dedicadas de profesionales (Gestión Web)
    let profAcc = webDb.profesionalAccounts.find(
      (a) =>
        a.activo !== false &&
        ((cleanDni && normalizeDni(a.dni) === cleanDni) ||
          (a.email && a.email.toLowerCase() === cleanIdLower))
    );

    let profSessionData: {
      profAccountId: string;
      profesionalId: string;
      nombre: string;
      dni: string;
      email: string;
      tenantSlug: string;
      isAdminFallback?: boolean;
    } | null = null;

    if (profAcc && verifyPasswordScrypt(password, profAcc.passwordHash)) {
      profAcc.ultimoAccesoAt = nowIso;
      profAcc.updatedAt = nowIso;
      await putTenantDoc(tenant, GESTION_WEB_DOC_KEY, webDb, identifier, "cemep_prof_login");
      profSessionData = {
        profAccountId: profAcc.id,
        profesionalId: profAcc.profesionalId,
        nombre: profAcc.profesionalNombre,
        dni: profAcc.dni,
        email: profAcc.email,
        tenantSlug: tenant.slug,
        isAdminFallback: profAcc.profesionalId === "*",
      };
    } else {
      // 2. Compatibilidad con usuarios ERP de MiniSistema (Administrador / Profesionales con usuario ERP)
      const erpUsers = await listTenantUsersFromDb(tenant);
      const erpMatch = erpUsers.find(
        (u) => u.active !== false && u.username.toLowerCase() === cleanIdLower
      );
      let erpPasswordValid = false;
      if (erpMatch) {
        erpPasswordValid =
          verifyErpUserPassword(password, erpMatch) ||
          verifyPasswordScrypt(password, erpMatch.password_hash);
      }

      if (erpMatch && erpPasswordValid) {
        profSessionData = {
          profAccountId: `erp_${erpMatch.username}`,
          profesionalId: "*",
          nombre: erpMatch.name || erpMatch.username,
          dni: "",
          email: "",
          tenantSlug: tenant.slug,
          isAdminFallback: true,
        };
      }
    }

    if (!profSessionData) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Credenciales inválidas. Podés ingresar con tu acceso de profesional configurado en Gestión Web o con tu usuario de MiniSistema ERP.",
        },
        { status: 401 }
      );
    }

    const token = signToken(profSessionData, 7);
    const res = NextResponse.json({
      ok: true,
      message: `Bienvenido/a, ${profSessionData.nombre}.`,
      ...buildProfessionalPortalBundle(profSessionData, hc, webDb, turnosDb),
    });
    res.cookies.set(PROF_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  }

  if (action === "prof_logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(PROF_SESSION_COOKIE);
    return res;
  }

  // =================== PORTAL PROFESIONALES: ACCIONES AUTENTICADAS ===================

  if (
    action === "prof_update_turno_estado" ||
    action === "prof_save_ficha" ||
    action === "prof_save_evolucion" ||
    action === "prof_upload_estudio" ||
    action === "prof_delete_estudio" ||
    action === "prof_update_receta"
  ) {
    const rawCookie = req.cookies.get(PROF_SESSION_COOKIE)?.value;
    const profSess = verifyToken<{
      profAccountId: string;
      profesionalId: string;
      nombre: string;
      dni: string;
      email: string;
      tenantSlug: string;
      isAdminFallback?: boolean;
    }>(rawCookie);

    if (!profSess || (profSess.tenantSlug && profSess.tenantSlug !== tenant.slug)) {
      return NextResponse.json(
        { ok: false, message: "Sesión profesional expirada. Iniciá sesión nuevamente." },
        { status: 401 }
      );
    }

    const actor = profSess.nombre || "Profesional";

    if (action === "prof_update_turno_estado") {
      const turnoId = String(body.turnoId || "").trim();
      const estado = String(body.estado || "").trim() as TurnoEstado;
      const turno = turnosDb.turnos.find((t) => t.id === turnoId);
      if (!turno) {
        return NextResponse.json({ ok: false, message: "Turno no encontrado." }, { status: 404 });
      }
      turno.estado = estado;
      turno.updatedAt = nowIso;
      turnosDb.updatedAt = nowIso;
      await putTenantDoc(tenant, TURNOS_DOC_KEY, turnosDb, actor, "prof_update_turno_estado");
      return NextResponse.json({
        ok: true,
        message: `Estado del turno ${turno.codigo} actualizado a "${estado}".`,
        ...buildProfessionalPortalBundle(profSess, hc, webDb, turnosDb),
      });
    }

    if (action === "prof_save_ficha") {
      const raw = (body.ficha || body) as AnyObj;
      const dni = normalizeDni(raw.pacienteDni);
      const pacienteId = String(raw.pacienteId || `pac_dni_${dni}`).trim();
      const idx = hc.fichas.findIndex(
        (f) => (dni && normalizeDni(f.pacienteDni) === dni) || f.pacienteId === pacienteId
      );
      const prev = idx >= 0 ? hc.fichas[idx] : null;
      const record: FichaClinicaRecord = {
        id: prev?.id || `ficha_${crypto.randomUUID().slice(0, 10)}`,
        pacienteId: prev?.pacienteId || pacienteId,
        pacienteDni: dni || prev?.pacienteDni || "",
        pacienteNombre: String(raw.pacienteNombre || prev?.pacienteNombre || "").trim(),
        fechaNacimiento: String(raw.fechaNacimiento ?? prev?.fechaNacimiento ?? "").trim(),
        genero: String(raw.genero ?? prev?.genero ?? "").trim(),
        whatsapp: String(raw.whatsapp ?? prev?.whatsapp ?? "").trim(),
        email: String(raw.email ?? prev?.email ?? "").trim(),
        obraSocialNombre: String(raw.obraSocialNombre ?? prev?.obraSocialNombre ?? "").trim(),
        planNombre: String(raw.planNombre ?? prev?.planNombre ?? "").trim(),
        nroAfiliado: String(raw.nroAfiliado ?? prev?.nroAfiliado ?? "").trim(),
        esAfiliadoCemepPlus: Boolean(raw.esAfiliadoCemepPlus ?? prev?.esAfiliadoCemepPlus),
        grupoSanguineo: String(raw.grupoSanguineo ?? prev?.grupoSanguineo ?? "").trim(),
        alergias: String(raw.alergias ?? prev?.alergias ?? "").trim(),
        antecedentesPersonales: String(raw.antecedentesPersonales ?? prev?.antecedentesPersonales ?? "").trim(),
        antecedentesFamiliares: String(raw.antecedentesFamiliares ?? prev?.antecedentesFamiliares ?? "").trim(),
        antecedentesQuirurgicos: String(raw.antecedentesQuirurgicos ?? prev?.antecedentesQuirurgicos ?? "").trim(),
        medicacionCronica: String(raw.medicacionCronica ?? prev?.medicacionCronica ?? "").trim(),
        habitos: String(raw.habitos ?? prev?.habitos ?? "").trim(),
        alertasClinicas: String(raw.alertasClinicas ?? prev?.alertasClinicas ?? "").trim(),
        notasGenerales: String(raw.notasGenerales ?? prev?.notasGenerales ?? "").trim(),
        updatedBy: actor,
        createdAt: prev?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      if (idx >= 0) hc.fichas[idx] = record;
      else hc.fichas.unshift(record);
      hc.updatedAt = nowIso;
      await putTenantDoc(tenant, HISTORIA_CLINICA_DOC_KEY, hc, actor, "prof_save_ficha");
      return NextResponse.json({
        ok: true,
        message: "Ficha clínica actualizada.",
        ...buildProfessionalPortalBundle(profSess, hc, webDb, turnosDb),
      });
    }

    if (action === "prof_save_evolucion") {
      const raw = (body.evolucion || body) as AnyObj;
      const dni = normalizeDni(raw.pacienteDni);
      const svRaw = raw.signosVitales || {};
      const pesoKg = String(svRaw.pesoKg || "").trim();
      const tallaCm = String(svRaw.tallaCm || "").trim();
      const record: EvolucionClinicaRecord = {
        id: `evo_${crypto.randomUUID().slice(0, 10)}`,
        pacienteId: String(raw.pacienteId || `pac_dni_${dni}`).trim(),
        pacienteDni: dni,
        pacienteNombre: String(raw.pacienteNombre || "").trim(),
        turnoId: String(raw.turnoId || "").trim() || undefined,
        turnoCodigo: String(raw.turnoCodigo || "").trim() || undefined,
        profesionalId: profSess.profesionalId,
        profesionalNombre: actor,
        especialidadNombre: String(raw.especialidadNombre || "Consulta Médica").trim(),
        fecha: String(raw.fecha || nowIso.slice(0, 10)).trim(),
        hora: String(raw.hora || nowIso.slice(11, 16)).trim(),
        motivoConsulta: String(raw.motivoConsulta || "").trim(),
        subjetivo: String(raw.subjetivo || "").trim(),
        objetivo: String(raw.objetivo || "").trim(),
        signosVitales: {
          ta: String(svRaw.ta || "").trim(),
          fc: String(svRaw.fc || "").trim(),
          temp: String(svRaw.temp || "").trim(),
          pesoKg,
          tallaCm,
          imc: String(svRaw.imc || "").trim() || computeImc(pesoKg, tallaCm),
          satO2: String(svRaw.satO2 || "").trim(),
        },
        diagnostico: String(raw.diagnostico || "").trim(),
        codigoCie10: String(raw.codigoCie10 || "").trim() || undefined,
        planTerapeutico: String(raw.planTerapeutico || "").trim(),
        indicacionesPaciente: String(raw.indicacionesPaciente || "").trim() || undefined,
        privadaSoloProfesional: Boolean(raw.privadaSoloProfesional),
        createdBy: actor,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      hc.evoluciones.unshift(record);
      hc.updatedAt = nowIso;
      await putTenantDoc(tenant, HISTORIA_CLINICA_DOC_KEY, hc, actor, "prof_save_evolucion");
      return NextResponse.json({
        ok: true,
        message: "Evolución médica guardada en la Historia Clínica.",
        ...buildProfessionalPortalBundle(profSess, hc, webDb, turnosDb),
      });
    }

    if (action === "prof_upload_estudio") {
      const raw = (body.estudio || body) as AnyObj;
      const dni = normalizeDni(raw.pacienteDni);
      const titulo = String(raw.titulo || "").trim();
      if (!titulo || (!dni && !raw.pacienteNombre)) {
        return NextResponse.json(
          { ok: false, message: "Indicá paciente y título del estudio." },
          { status: 400 }
        );
      }
      const matchedWebUser = webDb.webUsers.find(
        (u) => (raw.webUserId && u.id === raw.webUserId) || (dni && normalizeDni(u.dni) === dni)
      );
      const record: EstudioMedicoRecord = {
        id: `est_${crypto.randomUUID().slice(0, 10)}`,
        pacienteId: String(raw.pacienteId || matchedWebUser?.pacienteId || `pac_dni_${dni}`).trim(),
        pacienteDni: dni || matchedWebUser?.dni || "",
        pacienteNombre: String(raw.pacienteNombre || matchedWebUser?.nombreCompleto || `DNI ${dni}`).trim(),
        webUserId: matchedWebUser?.id || (raw.webUserId ? String(raw.webUserId) : undefined),
        profesionalId: profSess.profesionalId,
        profesionalNombre: actor,
        especialidadNombre: String(raw.especialidadNombre || "").trim() || undefined,
        fechaEstudio: String(raw.fechaEstudio || nowIso.slice(0, 10)).trim(),
        tipoEstudio: (String(raw.tipoEstudio || "Informe Médico") as EstudioTipo),
        titulo,
        descripcionInforme: String(raw.descripcionInforme || "").trim(),
        archivoNombre: String(raw.archivoNombre || "").trim() || undefined,
        archivoMime: String(raw.archivoMime || "").trim() || undefined,
        archivoDataUrl: String(raw.archivoDataUrl || "").trim() || undefined,
        visibleParaPaciente: raw.visibleParaPaciente !== false,
        createdBy: actor,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      hc.estudios.unshift(record);
      hc.updatedAt = nowIso;
      await putTenantDoc(tenant, HISTORIA_CLINICA_DOC_KEY, hc, actor, "prof_upload_estudio");
      return NextResponse.json({
        ok: true,
        message: `Estudio "${record.titulo}" cargado. ${record.visibleParaPaciente ? "Ya es visible para el paciente en su portal." : "Guardado como uso interno."}`,
        ...buildProfessionalPortalBundle(profSess, hc, webDb, turnosDb),
      });
    }

    if (action === "prof_delete_estudio") {
      const id = String(body.id || "").trim();
      hc.estudios = hc.estudios.filter((e) => e.id !== id);
      hc.updatedAt = nowIso;
      await putTenantDoc(tenant, HISTORIA_CLINICA_DOC_KEY, hc, actor, "prof_delete_estudio");
      return NextResponse.json({
        ok: true,
        message: "Estudio eliminado.",
        ...buildProfessionalPortalBundle(profSess, hc, webDb, turnosDb),
      });
    }

    if (action === "prof_update_receta") {
      const id = String(body.id || "").trim();
      const rec = hc.recetas.find((r) => r.id === id);
      if (!rec) {
        return NextResponse.json({ ok: false, message: "Receta no encontrada." }, { status: 404 });
      }
      if (body.estado) rec.estado = String(body.estado) as RecetaEstado;
      if (body.observacionesAdmin !== undefined) {
        rec.observacionesAdmin = String(body.observacionesAdmin || "").trim();
      }
      if (body.recetaCodigoValidacion !== undefined) {
        rec.recetaCodigoValidacion = String(body.recetaCodigoValidacion || "").trim();
      }
      if (body.recetaArchivoDataUrl) {
        rec.recetaArchivoDataUrl = String(body.recetaArchivoDataUrl);
        rec.recetaArchivoNombre = String(body.recetaArchivoNombre || `receta-${rec.codigo}.pdf`);
        rec.recetaArchivoMime = String(body.recetaArchivoMime || "application/pdf");
        rec.estado = "emitida";
        rec.fechaEmision = nowIso;
        rec.emitidaPor = actor;
      }
      rec.profesionalNombre = rec.profesionalNombre || actor;
      rec.updatedAt = nowIso;
      hc.updatedAt = nowIso;
      await putTenantDoc(tenant, HISTORIA_CLINICA_DOC_KEY, hc, actor, "prof_update_receta");
      return NextResponse.json({
        ok: true,
        message: `Receta ${rec.codigo} actualizada.`,
        ...buildProfessionalPortalBundle(profSess, hc, webDb, turnosDb),
      });
    }
  }

  return NextResponse.json(
    { ok: false, message: `Acción pública no reconocida: ${action}` },
    { status: 400 }
  );
}
