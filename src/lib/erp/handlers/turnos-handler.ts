import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractErpSessionFromRequest } from "../erp-session";
import { getTenantDoc, putTenantDoc } from "../supabase-server";
import { enforceOptionBranding } from "../tenant-service";
import {
  buildSeedEspecialidades,
  buildSeedObrasSocialesAndPlanes,
  inferEspecialidadCategoria,
} from "../turnos-catalogs";
import { encryptProfesionalMpTokens } from "../turnos-mp-server";
import {
  type AgendaBloqueoRecord,
  calculateTurnosSplit,
  clampPct,
  computeAge,
  computeProfessionalDaySlots,
  type EspecialidadRecord,
  type HorarioRangoAtencion,
  minutesToTime,
  normalizeDni,
  normalizeTurnoDuration,
  type ObraSocialRecord,
  type ObraSocialTipo,
  type OrganizadorTipo,
  type PacienteRecord,
  type PlanObraSocialRecord,
  type ProfesionalRecord,
  resolveTurnosCommission,
  round2,
  timeToMinutes,
  type TurnoCoberturaTipo,
  type TurnoEstado,
  type TurnoModalidad,
  type TurnoRecord,
  type TurnosDbDoc,
  type TurnosSplitTransaction,
} from "../turnos-types";
import { type ErpTenantRecord, GENERAL_ADMIN_USERNAME } from "../types";

type AnyObj = Record<string, any>;

export const TURNOS_DOC_KEY = "turnos_db";

export function buildInitialTurnosDb(tenant: ErpTenantRecord): TurnosDbDoc {
  const nowIso = new Date().toISOString();
  const brand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );
  const { obrasSociales, planes } = buildSeedObrasSocialesAndPlanes(nowIso);
  const especialidades = buildSeedEspecialidades(nowIso);

  return {
    updatedAt: nowIso,
    lastTurnoSeq: 0,
    portalConfig: {
      tituloPortal: `Turnero Web · ${tenant.fantasy_name || "MiniSistema"}`,
      subtituloPortal:
        "Sacá tu turno médico online las 24 hs, elegí modalidad presencial o por videollamada y recibí tu comprobante al instante.",
      direccionConsultorio: brand.address || "Consultorios Centrales",
      whatsappRecepcion: brand.whatsappDisplay || "+54 9 358 509-5475",
      emailRecepcion: brand.emailInfo || "contacto@minisistema.com.ar",
      diasAnticipacionMax: 60,
      minutosAnticipacionMin: 15,
      permitirCancelacionPacienteHoras: 4,
      mensajeConfirmacion:
        "Te esperamos 10 minutos antes con tu DNI y credencial de obra social (si corresponde).",
      updatedAt: nowIso,
    },
    splitConfig: {
      organizadorNombre: tenant.fantasy_name || tenant.business_name || "Clínica / Consultorios",
      organizadorTipo: "Clínica",
      habilitarPagoOnlineParticular: true,
      pagoObligatorioParaConfirmarParticular: false,
      defaultOrganizadorPct: 20,
      presencialOrganizadorPct: 20,
      videollamadaOrganizadorPct: 15,
      profesionalExceptions: {},
      mpOrganizadorAlias: "",
      auditLog: [
        {
          id: "split_init_1",
          actor: "Sistema",
          targetLabel: "Distribución Inicial (20% Organizador / 80% Profesional)",
          previousOrganizadorPct: null,
          newOrganizadorPct: 20,
          newProfesionalPct: 80,
          changedAt: nowIso,
        },
      ],
      updatedAt: nowIso,
    },
    obrasSociales,
    planes,
    especialidades,
    profesionales: [],
    bloqueos: [],
    pacientes: [],
    turnos: [],
    transaccionesMp: [],
  };
}

export async function loadTurnosDb(tenant: ErpTenantRecord): Promise<TurnosDbDoc> {
  const initial = buildInitialTurnosDb(tenant);
  const { payload } = await getTenantDoc<Partial<TurnosDbDoc>>(
    tenant,
    TURNOS_DOC_KEY,
    initial
  );

  // Merge defensivo para garantizar estructura completa incluso en tenants previos
  const db: TurnosDbDoc = {
    updatedAt: payload?.updatedAt || initial.updatedAt,
    lastTurnoSeq: Number(payload?.lastTurnoSeq || 0),
    portalConfig: { ...initial.portalConfig, ...(payload?.portalConfig || {}) },
    splitConfig: {
      ...initial.splitConfig,
      ...(payload?.splitConfig || {}),
      profesionalExceptions: payload?.splitConfig?.profesionalExceptions || {},
      auditLog: Array.isArray(payload?.splitConfig?.auditLog)
        ? payload.splitConfig.auditLog
        : initial.splitConfig.auditLog,
    },
    obrasSociales:
      Array.isArray(payload?.obrasSociales) && payload.obrasSociales.length > 0
        ? payload.obrasSociales
        : initial.obrasSociales,
    planes:
      Array.isArray(payload?.planes) && payload.planes.length > 0
        ? payload.planes
        : initial.planes,
    especialidades: (
      Array.isArray(payload?.especialidades) && payload.especialidades.length > 0
        ? payload.especialidades
        : initial.especialidades
    )
      .map((e) => ({
        ...e,
        categoria:
          String(e.categoria || "").trim() || inferEspecialidadCategoria(e.nombre),
      }))
      .sort((a, b) =>
        String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {
          sensitivity: "base",
        })
      ),
    profesionales: Array.isArray(payload?.profesionales) ? payload.profesionales : [],
    bloqueos: Array.isArray(payload?.bloqueos) ? payload.bloqueos : [],
    pacientes: Array.isArray(payload?.pacientes) ? payload.pacientes : [],
    turnos: Array.isArray(payload?.turnos) ? payload.turnos : [],
    transaccionesMp: Array.isArray(payload?.transaccionesMp)
      ? payload.transaccionesMp
      : [],
  };

  return db;
}

export function sanitizeProfesionalForClient(p: ProfesionalRecord): ProfesionalRecord {
  if (!p.mpAccount) return p;
  return {
    ...p,
    mpAccount: {
      linked: Boolean(p.mpAccount.linked),
      mpUserId: p.mpAccount.mpUserId || null,
      mpPublicKey: p.mpAccount.mpPublicKey || null,
      mpAccountAlias: p.mpAccount.mpAccountAlias || null,
      tokenStatus: p.mpAccount.tokenStatus || "disconnected",
      tokenExpiresAt: p.mpAccount.tokenExpiresAt || null,
      linkedAt: p.mpAccount.linkedAt || null,
      lastRefreshedAt: p.mpAccount.lastRefreshedAt || null,
    },
  };
}

function splitFullName(rawFull: string): { apellidos: string; nombres: string } {
  const clean = String(rawFull || "").trim();
  if (!clean) return { apellidos: "", nombres: "" };
  if (clean.includes(",")) {
    const [ap, nom] = clean.split(",").map((s) => s.trim());
    return { apellidos: ap || "", nombres: nom || "" };
  }
  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) return { apellidos: tokens[0], nombres: "" };
  return {
    apellidos: tokens.slice(-1).join(" "),
    nombres: tokens.slice(0, -1).join(" "),
  };
}

export async function lookupPersonByDni(
  tenant: ErpTenantRecord,
  db: TurnosDbDoc,
  dniRaw: string
): Promise<{
  found: boolean;
  source: "pacientes_turnero" | "clientes_erp" | "cv_erp" | null;
  paciente: Partial<PacienteRecord> | null;
}> {
  const target = normalizeDni(dniRaw);
  if (!target || target.length < 6) {
    return { found: false, source: null, paciente: null };
  }

  // 1. Buscar en Padrón de Pacientes del Turnero Web
  const existingPac = db.pacientes.find(
    (p) => p.activo !== false && normalizeDni(p.dni) === target
  );
  if (existingPac) {
    return { found: true, source: "pacientes_turnero", paciente: existingPac };
  }

  // 2. Buscar en Clientes del ERP del comercio (clientes_db)
  try {
    const { payload: cliDb } = await getTenantDoc<AnyObj>(tenant, "clientes_db", {
      clientes: [],
    });
    const cli = (Array.isArray(cliDb?.clientes) ? cliDb.clientes : []).find(
      (c: AnyObj) => {
        const cd = normalizeDni(String(c.nroDoc || ""));
        return cd && (cd === target || (cd.length === 11 && cd.slice(2, 10) === target));
      }
    );
    if (cli) {
      const split = splitFullName(String(cli.nombre || cli.razonSocial || ""));
      return {
        found: true,
        source: "clientes_erp",
        paciente: {
          dni: target,
          apellidos: split.apellidos,
          nombres: split.nombres,
          nombreCompleto: `${split.apellidos.toUpperCase()}, ${split.nombres}`.trim(),
          fechaNacimiento: String(cli.fechaNacimiento || ""),
          whatsapp: String(cli.celular || cli.telefono || ""),
          email: String(cli.email || ""),
          domicilio: `${cli.calle || ""} ${cli.numero || ""}`.trim(),
          localidad: String(cli.localidad || ""),
          provincia: String(cli.provincia || ""),
        },
      };
    }
  } catch {
    // Ignorar si clientes_db no está inicializado
  }

  // 3. Buscar en base de CVs del comercio (cv_db)
  try {
    const { payload: cvDb } = await getTenantDoc<AnyObj>(tenant, "cv_db", {
      items: [],
    });
    const cv = (Array.isArray(cvDb?.items) ? cvDb.items : []).find(
      (x: AnyObj) => !x.deleted && normalizeDni(String(x.personal?.nroDoc || "")) === target
    );
    if (cv) {
      const ap = String(cv.personal?.apellidos || "").trim();
      const nom = String(cv.personal?.nombres || "").trim();
      return {
        found: true,
        source: "cv_erp",
        paciente: {
          dni: target,
          apellidos: ap,
          nombres: nom,
          nombreCompleto: `${ap.toUpperCase()}, ${nom}`,
          fechaNacimiento: String(cv.personal?.fechaNacimiento || ""),
          genero: String(cv.personal?.genero || ""),
          whatsapp: String(cv.ubicacionContacto?.whatsappCompleto || ""),
          email: String(cv.ubicacionContacto?.email || ""),
          domicilio: String(cv.ubicacionContacto?.domicilio || ""),
          localidad: String(cv.ubicacionContacto?.localidad || ""),
          provincia: String(cv.ubicacionContacto?.provincia || ""),
        },
      };
    }
  } catch {
    // Ignorar si cv_db no existe
  }

  return { found: false, source: null, paciente: null };
}

function getPublicTurnosUrl(req: NextRequest, tenant: ErpTenantRecord): string {
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "www.minisistema.com.ar";
  const proto = host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
  return tenant.option_type === 2 && !tenant.is_base
    ? `${proto}://${host}/${tenant.slug}/turnos`
    : `${proto}://${host}/turnos`;
}

function resolveConsultaParticularPrice(
  prof: ProfesionalRecord,
  esp: EspecialidadRecord
): number {
  const byEsp = prof.valorPorEspecialidadArs?.[esp.id];
  if (typeof byEsp === "number" && byEsp > 0) return round2(byEsp);
  if (typeof prof.valorConsultaParticularArs === "number" && prof.valorConsultaParticularArs > 0) {
    return round2(prof.valorConsultaParticularArs);
  }
  return round2(esp.valorConsultaParticularSugeridoArs || 25000);
}

function buildTurnoRecord(params: {
  db: TurnosDbDoc;
  origen: "WEB" | "MANUAL";
  esSobreturno?: boolean;
  fecha: string;
  horaInicio: string;
  especialidad: EspecialidadRecord;
  profesional: ProfesionalRecord;
  paciente: PacienteRecord;
  coberturaTipo: TurnoCoberturaTipo;
  obraSocial?: ObraSocialRecord | null;
  plan?: PlanObraSocialRecord | null;
  nroAfiliado?: string;
  modalidad: TurnoModalidad;
  consultorio?: string;
  motivoConsulta?: string;
  observaciones?: string;
  createdBy?: string;
}): TurnoRecord {
  const { db, especialidad, profesional, paciente, modalidad, coberturaTipo } = params;
  const nowIso = new Date().toISOString();
  const nextSeq = Number(db.lastTurnoSeq || 0) + 1;
  db.lastTurnoSeq = nextSeq;

  const year = new Date().getFullYear();
  const codigo = `TRN-${year}-${String(nextSeq).padStart(4, "0")}`;
  const turnoId = `trn_${Date.now()}_${nextSeq}`;

  const dur = normalizeTurnoDuration(especialidad.duracionMinutos);
  const startMin = timeToMinutes(params.horaInicio);
  const horaFin = startMin >= 0 ? minutesToTime(startMin + dur) : params.horaInicio;

  const esParticular = coberturaTipo === "particular";
  const precioParticular = esParticular
    ? resolveConsultaParticularPrice(profesional, especialidad)
    : 0;

  let pago: TurnoRecord["pago"] = {
    requerido: false,
    estado: "no_aplica",
    montoTotalArs: 0,
    organizadorPct: 0,
    profesionalPct: 100,
    organizadorFeeArs: 0,
    profesionalBrutoArs: 0,
    mpProcessorFeeEstimadoArs: 0,
    profesionalNetoEstimadoArs: 0,
  };

  if (esParticular && precioParticular > 0) {
    const snap = resolveTurnosCommission(db.splitConfig, modalidad, profesional.id);
    const calc = calculateTurnosSplit(precioParticular, snap.organizadorPct);
    const onlineEnabled = Boolean(db.splitConfig.habilitarPagoOnlineParticular);
    pago = {
      requerido: onlineEnabled,
      estado: onlineEnabled ? "pending" : "no_aplica",
      montoTotalArs: calc.montoTotalArs,
      organizadorPct: calc.organizadorPct,
      profesionalPct: calc.profesionalPct,
      organizadorFeeArs: calc.organizadorFeeArs,
      profesionalBrutoArs: calc.profesionalBrutoArs,
      mpProcessorFeeEstimadoArs: calc.mpProcessorFeeEstimadoArs,
      profesionalNetoEstimadoArs: calc.profesionalNetoEstimadoArs,
      commissionSnapshot: snap,
    };
  }

  let video: TurnoRecord["video"] | undefined;
  if (modalidad === "videollamada") {
    const tokenShort = crypto
      .createHash("sha256")
      .update(`${turnoId}:${codigo}:${paciente.dni}`)
      .digest("hex")
      .slice(0, 8)
      .toUpperCase();
    const roomCode = `${codigo}-${tokenShort}`;
    video = {
      habilitada: true,
      roomCode,
      roomName: `minisistema-${roomCode.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
      status: "pendiente",
    };
  }

  const requierePagoParaConfirmar =
    esParticular &&
    pago.requerido &&
    Boolean(db.splitConfig.pagoObligatorioParaConfirmarParticular) &&
    params.origen === "WEB";

  const estadoInicial: TurnoEstado = requierePagoParaConfirmar
    ? "pendiente_pago"
    : params.origen === "MANUAL"
      ? "confirmado"
      : "pendiente";

  return {
    id: turnoId,
    seq: nextSeq,
    codigo,
    origen: params.origen,
    esSobreturno: Boolean(params.esSobreturno),
    fecha: params.fecha,
    horaInicio: params.horaInicio,
    horaFin,
    duracionMinutos: dur,
    especialidadId: especialidad.id,
    especialidadNombre: especialidad.nombre,
    profesionalId: profesional.id,
    profesionalNombre: profesional.titulo
      ? `${profesional.titulo} ${profesional.apellidos}, ${profesional.nombres}`
      : `${profesional.apellidos}, ${profesional.nombres}`,
    profesionalDni: profesional.dni,
    pacienteId: paciente.id,
    pacienteDni: paciente.dni,
    pacienteApellidos: paciente.apellidos,
    pacienteNombres: paciente.nombres,
    pacienteNombreCompleto: `${paciente.apellidos.toUpperCase()}, ${paciente.nombres}`,
    pacienteWhatsapp: paciente.whatsapp,
    pacienteEmail: paciente.email || "",
    coberturaTipo,
    obraSocialId: esParticular ? "" : params.obraSocial?.id || "",
    obraSocialNombre: esParticular ? "PARTICULAR" : params.obraSocial?.sigla || "",
    planId: esParticular ? "" : params.plan?.id || "",
    planNombre: esParticular ? "" : params.plan?.nombre || "",
    nroAfiliado: esParticular ? "" : String(params.nroAfiliado || paciente.nroAfiliado || ""),
    modalidad,
    consultorio: params.consultorio || (modalidad === "videollamada" ? "Sala Virtual" : ""),
    motivoConsulta: String(params.motivoConsulta || "").trim(),
    observaciones: String(params.observaciones || "").trim(),
    estado: estadoInicial,
    pago,
    video,
    createdBy: params.createdBy || params.origen.toLowerCase(),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function upsertPacienteInDb(
  db: TurnosDbDoc,
  input: AnyObj,
  origen: "WEB" | "MANUAL"
): PacienteRecord {
  const nowIso = new Date().toISOString();
  const dni = normalizeDni(String(input.dni || ""));
  const apellidos = String(input.apellidos || "").trim();
  const nombres = String(input.nombres || "").trim();
  const fechaNacimiento = String(input.fechaNacimiento || "").trim();

  const existingIdx = input.id
    ? db.pacientes.findIndex((p) => p.id === String(input.id))
    : db.pacientes.findIndex((p) => normalizeDni(p.dni) === dni);

  const existing = existingIdx >= 0 ? db.pacientes[existingIdx] : null;
  const record: PacienteRecord = {
    id: existing?.id || `pac_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    dni: dni || existing?.dni || "",
    apellidos: apellidos || existing?.apellidos || "",
    nombres: nombres || existing?.nombres || "",
    nombreCompleto: `${(apellidos || existing?.apellidos || "").toUpperCase()}, ${nombres || existing?.nombres || ""}`.trim(),
    fechaNacimiento: fechaNacimiento || existing?.fechaNacimiento || "",
    edad: computeAge(fechaNacimiento || existing?.fechaNacimiento || ""),
    genero: String(input.genero ?? existing?.genero ?? "").trim(),
    whatsapp: String(input.whatsapp ?? existing?.whatsapp ?? "").trim(),
    telefonoAlternativo: String(
      input.telefonoAlternativo ?? existing?.telefonoAlternativo ?? ""
    ).trim(),
    email: String(input.email ?? existing?.email ?? "").trim().toLowerCase(),
    domicilio: String(input.domicilio ?? existing?.domicilio ?? "").trim(),
    localidad: String(input.localidad ?? existing?.localidad ?? "").trim(),
    provincia: String(input.provincia ?? existing?.provincia ?? "").trim(),
    obraSocialId: String(input.obraSocialId ?? existing?.obraSocialId ?? "").trim(),
    planId: String(input.planId ?? existing?.planId ?? "").trim(),
    nroAfiliado: String(input.nroAfiliado ?? existing?.nroAfiliado ?? "").trim(),
    origenRegistro: existing?.origenRegistro || origen,
    observaciones: String(input.observaciones ?? existing?.observaciones ?? "").trim(),
    activo: input.activo !== undefined ? Boolean(input.activo) : existing?.activo ?? true,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };

  if (existingIdx >= 0) {
    db.pacientes[existingIdx] = record;
  } else {
    db.pacientes.unshift(record);
  }
  return record;
}

function buildTurnosStats(db: TurnosDbDoc) {
  const todayIso = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const activos = db.turnos.filter((t) => t.estado !== "cancelado");
  const hoy = activos.filter((t) => t.fecha === todayIso);
  const proximos = activos.filter((t) => t.fecha >= todayIso);
  const pendientes = proximos.filter(
    (t) => t.estado === "pendiente" || t.estado === "pendiente_pago"
  );
  const confirmados = proximos.filter((t) => t.estado === "confirmado");
  const atendidos = db.turnos.filter((t) => t.estado === "atendido");
  const ausentes = db.turnos.filter((t) => t.estado === "ausente");
  const videollamadasProximas = proximos.filter((t) => t.modalidad === "videollamada");

  const txsApproved = db.transaccionesMp.filter((x) => x.status === "approved");
  const totalRecaudadoParticularArs = round2(
    txsApproved.reduce((acc, x) => acc + Number(x.montoTotalArs || 0), 0)
  );
  const totalOrganizadorArs = round2(
    txsApproved.reduce((acc, x) => acc + Number(x.organizadorFeeArs || 0), 0)
  );
  const totalProfesionalesBrutoArs = round2(
    txsApproved.reduce((acc, x) => acc + Number(x.profesionalBrutoArs || 0), 0)
  );

  return {
    todayIso,
    turnosHoy: hoy.length,
    turnosProximos: proximos.length,
    turnosPendientes: pendientes.length,
    turnosConfirmados: confirmados.length,
    turnosAtendidos: atendidos.length,
    turnosAusentes: ausentes.length,
    videollamadasProximas: videollamadasProximas.length,
    profesionalesActivos: db.profesionales.filter((p) => p.activo).length,
    obrasSocialesActivas: db.obrasSociales.filter((o) => o.activa).length,
    planesActivos: db.planes.filter((p) => p.activo).length,
    especialidadesActivas: db.especialidades.filter((e) => e.activa).length,
    pacientesActivos: db.pacientes.filter((p) => p.activo !== false).length,
    totalRecaudadoParticularArs,
    totalOrganizadorArs,
    totalProfesionalesBrutoArs,
    pagosAprobadosCount: txsApproved.length,
  };
}

// ============================================================================
// 1. ENDPOINT AUTENTICADO DEL ERP (/sistema/api/turnos.php)
// ============================================================================

export async function handleErpTurnos(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const sess =
    extractErpSessionFromRequest(req, tenant.slug) ||
    extractErpSessionFromRequest(req, "minisistema");
  const actorHeader = (req.headers.get("x-erp-user") || "").trim().toLowerCase();
  const actor = sess?.username || actorHeader || "";

  if (!sess && actor !== GENERAL_ADMIN_USERNAME) {
    return NextResponse.json(
      { ok: false, message: "Sesión expirada. Iniciá sesión en el sistema." },
      { status: 401 }
    );
  }

  const db = await loadTurnosDb(tenant);
  const publicTurnosUrl = getPublicTurnosUrl(req, tenant);

  if (req.method === "GET") {
    const action = req.nextUrl.searchParams.get("action") || "state";

    if (action === "lookup_dni") {
      const dni = req.nextUrl.searchParams.get("dni") || "";
      const res = await lookupPersonByDni(tenant, db, dni);
      return NextResponse.json({ ok: true, ...res });
    }

    if (action === "slots") {
      const profesionalId = req.nextUrl.searchParams.get("profesionalId") || "";
      const especialidadId = req.nextUrl.searchParams.get("especialidadId") || "";
      const fecha = req.nextUrl.searchParams.get("fecha") || "";
      const modalidad = (req.nextUrl.searchParams.get("modalidad") || "todas") as
        | TurnoModalidad
        | "todas";

      const prof = db.profesionales.find((p) => p.id === profesionalId);
      const esp = db.especialidades.find((e) => e.id === especialidadId);
      if (!prof || !esp) {
        return NextResponse.json({ ok: true, slots: [] });
      }
      const slots = computeProfessionalDaySlots({
        profesional: prof,
        especialidad: esp,
        fechaIso: fecha,
        modalidadFiltro: modalidad,
        turnosExistentes: db.turnos,
        bloqueos: db.bloqueos,
        incluirOcupados: true,
      });
      return NextResponse.json({ ok: true, slots });
    }

    return NextResponse.json({
      ok: true,
      publicTurnosUrl,
      stats: buildTurnosStats(db),
      data: {
        ...db,
        profesionales: db.profesionales.map(sanitizeProfesionalForClient),
      },
    });
  }

  if (req.method === "POST") {
    const body = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
    const action = String(body.action || "").trim();
    const nowIso = new Date().toISOString();
    const actorName = actor || "admin";

    const persistAndReturn = async (extra: AnyObj = {}) => {
      db.updatedAt = nowIso;
      await putTenantDoc(tenant, TURNOS_DOC_KEY, db, actorName, action || "turnos_update");
      return NextResponse.json({
        ok: true,
        publicTurnosUrl,
        stats: buildTurnosStats(db),
        data: {
          ...db,
          profesionales: db.profesionales.map(sanitizeProfesionalForClient),
        },
        ...extra,
      });
    };

    // -------------------- ABM PROFESIONALES --------------------
    if (action === "save_profesional") {
      const inp = (body.profesional || body) as AnyObj;
      const dni = normalizeDni(String(inp.dni || ""));
      const apellidos = String(inp.apellidos || "").trim();
      const nombres = String(inp.nombres || "").trim();

      if (!dni || dni.length < 6) {
        return NextResponse.json(
          { ok: false, message: "Ingresá un DNI de profesional válido (mínimo 6 dígitos)." },
          { status: 400 }
        );
      }
      if (!apellidos || !nombres) {
        return NextResponse.json(
          { ok: false, message: "Completá Apellido/s y Nombre/s por separado." },
          { status: 400 }
        );
      }

      const dupDni = db.profesionales.find(
        (p) => normalizeDni(p.dni) === dni && p.id !== String(inp.id || "")
      );
      if (dupDni) {
        return NextResponse.json(
          {
            ok: false,
            message: `Ya existe un profesional registrado con el DNI ${dni} (${dupDni.apellidos}, ${dupDni.nombres}).`,
          },
          { status: 400 }
        );
      }

      const existingIdx = inp.id
        ? db.profesionales.findIndex((p) => p.id === String(inp.id))
        : -1;
      const existing = existingIdx >= 0 ? db.profesionales[existingIdx] : null;

      const record: ProfesionalRecord = {
        id: existing?.id || `prof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        dni,
        apellidos,
        nombres,
        nombreCompleto: `${apellidos.toUpperCase()}, ${nombres}`,
        titulo: String(inp.titulo ?? existing?.titulo ?? "Dr./a").trim(),
        matriculaNacional: String(
          inp.matriculaNacional ?? existing?.matriculaNacional ?? ""
        ).trim(),
        matriculaProvincial: String(
          inp.matriculaProvincial ?? existing?.matriculaProvincial ?? ""
        ).trim(),
        email: String(inp.email ?? existing?.email ?? "").trim().toLowerCase(),
        whatsapp: String(inp.whatsapp ?? existing?.whatsapp ?? "").trim(),
        especialidadIds: Array.isArray(inp.especialidadIds)
          ? inp.especialidadIds.map((x: unknown) => String(x)).filter(Boolean)
          : existing?.especialidadIds || [],
        obraSocialIds: Array.isArray(inp.obraSocialIds)
          ? inp.obraSocialIds.map((x: unknown) => String(x)).filter(Boolean)
          : existing?.obraSocialIds || [],
        atiendeParticular:
          inp.atiendeParticular !== undefined
            ? Boolean(inp.atiendeParticular)
            : existing?.atiendeParticular ?? true,
        valorConsultaParticularArs: Math.max(
          0,
          round2(
            inp.valorConsultaParticularArs !== undefined
              ? Number(inp.valorConsultaParticularArs)
              : existing?.valorConsultaParticularArs ?? 25000
          )
        ),
        valorPorEspecialidadArs:
          inp.valorPorEspecialidadArs || existing?.valorPorEspecialidadArs || {},
        permitePresencial:
          inp.permitePresencial !== undefined
            ? Boolean(inp.permitePresencial)
            : existing?.permitePresencial ?? true,
        permiteVideollamada:
          inp.permiteVideollamada !== undefined
            ? Boolean(inp.permiteVideollamada)
            : existing?.permiteVideollamada ?? true,
        horarios: Array.isArray(inp.horarios)
          ? inp.horarios
          : existing?.horarios || [],
        mpAccount: existing?.mpAccount || {
          linked: false,
          mpUserId: null,
          mpPublicKey: null,
          mpAccountAlias: String(inp.mpAccountAlias || "").trim() || null,
          tokenStatus: "disconnected",
          tokenExpiresAt: null,
          linkedAt: null,
          lastRefreshedAt: null,
        },
        observaciones: String(inp.observaciones ?? existing?.observaciones ?? "").trim(),
        activo: inp.activo !== undefined ? Boolean(inp.activo) : existing?.activo ?? true,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      if (existingIdx >= 0) db.profesionales[existingIdx] = record;
      else db.profesionales.unshift(record);

      return persistAndReturn({
        message: existing
          ? "Profesional actualizado correctamente."
          : "Profesional dado de alta correctamente.",
        profesional: sanitizeProfesionalForClient(record),
      });
    }

    if (action === "toggle_profesional" || action === "delete_profesional") {
      const id = String(body.id || "");
      const found = db.profesionales.find((p) => p.id === id);
      if (!found) {
        return NextResponse.json(
          { ok: false, message: "Profesional no encontrado." },
          { status: 404 }
        );
      }
      if (action === "delete_profesional" && body.hard === true) {
        db.profesionales = db.profesionales.filter((p) => p.id !== id);
      } else {
        found.activo = body.activo !== undefined ? Boolean(body.activo) : !found.activo;
        found.updatedAt = nowIso;
      }
      return persistAndReturn({ message: "Estado del profesional actualizado." });
    }

    // -------------------- GESTIÓN DE PROFESIONALES (HORARIOS + OBRA SOCIAL + DISPONIBILIDAD) --------------------
    if (action === "save_profesional_gestion") {
      const profId = String(body.profesionalId || "");
      const prof = db.profesionales.find((p) => p.id === profId);
      if (!prof) {
        return NextResponse.json(
          { ok: false, message: "Seleccioná un profesional válido." },
          { status: 404 }
        );
      }

      if (Array.isArray(body.horarios)) {
        const cleanedHorarios: HorarioRangoAtencion[] = [];
        for (const rawH of body.horarios) {
          const diaSemana = Number(rawH.diaSemana);
          if (diaSemana < 0 || diaSemana > 6) continue;
          const hIni = String(rawH.horaInicio || "").trim();
          const hFin = String(rawH.horaFin || "").trim();
          if (timeToMinutes(hIni) < 0 || timeToMinutes(hFin) <= timeToMinutes(hIni)) {
            continue;
          }
          cleanedHorarios.push({
            id:
              String(rawH.id || "") ||
              `rng_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            diaSemana: diaSemana as 0 | 1 | 2 | 3 | 4 | 5 | 6,
            horaInicio: hIni,
            horaFin: hFin,
            modalidad:
              rawH.modalidad === "presencial" || rawH.modalidad === "videollamada"
                ? rawH.modalidad
                : "ambas",
            consultorio: String(rawH.consultorio || "").trim(),
            especialidadId: String(rawH.especialidadId || "").trim() || undefined,
            slotsDeshabilitados: Array.isArray(rawH.slotsDeshabilitados)
              ? rawH.slotsDeshabilitados.map((s: unknown) => String(s)).filter(Boolean)
              : [],
            activo: rawH.activo !== false,
          });
        }
        prof.horarios = cleanedHorarios;
      }

      if (Array.isArray(body.obraSocialIds)) {
        prof.obraSocialIds = body.obraSocialIds
          .map((x: unknown) => String(x))
          .filter(Boolean);
      }
      if (Array.isArray(body.especialidadIds)) {
        prof.especialidadIds = body.especialidadIds
          .map((x: unknown) => String(x))
          .filter(Boolean);
      }
      if (body.atiendeParticular !== undefined) {
        prof.atiendeParticular = Boolean(body.atiendeParticular);
      }
      if (body.valorConsultaParticularArs !== undefined) {
        prof.valorConsultaParticularArs = Math.max(
          0,
          round2(Number(body.valorConsultaParticularArs))
        );
      }
      if (body.permitePresencial !== undefined) {
        prof.permitePresencial = Boolean(body.permitePresencial);
      }
      if (body.permiteVideollamada !== undefined) {
        prof.permiteVideollamada = Boolean(body.permiteVideollamada);
      }
      prof.updatedAt = nowIso;

      return persistAndReturn({
        message: `Agenda y obras sociales de ${prof.apellidos}, ${prof.nombres} guardadas correctamente.`,
        profesional: sanitizeProfesionalForClient(prof),
      });
    }

    if (action === "save_bloqueo") {
      const b = (body.bloqueo || body) as AnyObj;
      const fechaDesde = String(b.fechaDesde || "").trim();
      const fechaHasta = String(b.fechaHasta || fechaDesde).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde)) {
        return NextResponse.json(
          { ok: false, message: "Indicá una fecha válida para el bloqueo." },
          { status: 400 }
        );
      }
      const bloqueo: AgendaBloqueoRecord = {
        id: String(b.id || `blq_${Date.now()}`),
        profesionalId: String(b.profesionalId || "*"),
        fechaDesde,
        fechaHasta: /^\d{4}-\d{2}-\d{2}$/.test(fechaHasta) ? fechaHasta : fechaDesde,
        horaDesde: String(b.horaDesde || "").trim() || undefined,
        horaHasta: String(b.horaHasta || "").trim() || undefined,
        motivo: String(b.motivo || "Licencia / Feriado / Bloqueo de agenda").trim(),
        createdAt: nowIso,
      };
      db.bloqueos.unshift(bloqueo);
      return persistAndReturn({ message: "Bloqueo de agenda registrado." });
    }

    if (action === "delete_bloqueo") {
      const id = String(body.id || "");
      db.bloqueos = db.bloqueos.filter((b) => b.id !== id);
      return persistAndReturn({ message: "Bloqueo eliminado." });
    }

    // -------------------- ABM OBRAS SOCIALES --------------------
    if (action === "save_obra_social") {
      const inp = (body.obraSocial || body) as AnyObj;
      const sigla = String(inp.sigla || "").trim();
      const nombre = String(inp.nombre || sigla).trim();
      if (!sigla) {
        return NextResponse.json(
          { ok: false, message: "Ingresá la sigla o nombre de la Obra Social / Prepaga." },
          { status: 400 }
        );
      }
      const allowedTipos: ObraSocialTipo[] = [
        "CCT",
        "PREPAGA",
        "ESTATAL_PROVINCIAL",
        "PAMI",
      ];
      const tipo: ObraSocialTipo = allowedTipos.includes(inp.tipo) ? inp.tipo : "PREPAGA";
      const existingIdx = inp.id
        ? db.obrasSociales.findIndex((o) => o.id === String(inp.id))
        : -1;
      const existing = existingIdx >= 0 ? db.obrasSociales[existingIdx] : null;

      const record: ObraSocialRecord = {
        id: existing?.id || `os_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        codigoRnos: String(inp.codigoRnos ?? existing?.codigoRnos ?? "").trim(),
        sigla,
        nombre,
        tipo,
        cuit: String(inp.cuit ?? existing?.cuit ?? "").trim(),
        telefono: String(inp.telefono ?? existing?.telefono ?? "").trim(),
        web: String(inp.web ?? existing?.web ?? "").trim(),
        observaciones: String(inp.observaciones ?? existing?.observaciones ?? "").trim(),
        activa: inp.activa !== undefined ? Boolean(inp.activa) : existing?.activa ?? true,
        esCatalogoBase: existing?.esCatalogoBase || false,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      if (existingIdx >= 0) db.obrasSociales[existingIdx] = record;
      else db.obrasSociales.unshift(record);

      return persistAndReturn({
        message: existing
          ? "Obra Social actualizada correctamente."
          : "Obra Social dada de alta correctamente.",
        obraSocial: record,
      });
    }

    if (action === "toggle_obra_social" || action === "delete_obra_social") {
      const id = String(body.id || "");
      const found = db.obrasSociales.find((o) => o.id === id);
      if (!found) {
        return NextResponse.json(
          { ok: false, message: "Obra Social no encontrada." },
          { status: 404 }
        );
      }
      if (action === "delete_obra_social" && body.hard === true) {
        db.obrasSociales = db.obrasSociales.filter((o) => o.id !== id);
        db.planes = db.planes.filter((p) => p.obraSocialId !== id);
      } else {
        found.activa = body.activa !== undefined ? Boolean(body.activa) : !found.activa;
        found.updatedAt = nowIso;
      }
      return persistAndReturn({ message: "Obra Social actualizada." });
    }

    if (action === "import_sssalud_catalog") {
      const seed = buildSeedObrasSocialesAndPlanes(nowIso);
      let addedOs = 0;
      let addedPl = 0;
      for (const os of seed.obrasSociales) {
        if (!db.obrasSociales.some((x) => x.id === os.id || x.sigla.toLowerCase() === os.sigla.toLowerCase())) {
          db.obrasSociales.push(os);
          addedOs++;
        }
      }
      for (const pl of seed.planes) {
        if (
          !db.planes.some(
            (x) =>
              x.obraSocialId === pl.obraSocialId &&
              x.nombre.toLowerCase() === pl.nombre.toLowerCase()
          )
        ) {
          db.planes.push(pl);
          addedPl++;
        }
      }
      return persistAndReturn({
        message: `Catálogo SSSalud / Prepagas sincronizado: ${addedOs} obras sociales y ${addedPl} planes incorporados.`,
      });
    }

    // -------------------- ABM PLANES --------------------
    if (action === "save_plan") {
      const inp = (body.plan || body) as AnyObj;
      const obraSocialId = String(inp.obraSocialId || "").trim();
      const nombre = String(inp.nombre || "").trim();
      const os = db.obrasSociales.find((o) => o.id === obraSocialId);
      if (!os) {
        return NextResponse.json(
          { ok: false, message: "Seleccioná una Obra Social dada de alta." },
          { status: 400 }
        );
      }
      if (!nombre) {
        return NextResponse.json(
          { ok: false, message: "Ingresá el nombre del Plan." },
          { status: 400 }
        );
      }
      const existingIdx = inp.id
        ? db.planes.findIndex((p) => p.id === String(inp.id))
        : -1;
      const existing = existingIdx >= 0 ? db.planes[existingIdx] : null;
      const record: PlanObraSocialRecord = {
        id: existing?.id || `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        obraSocialId,
        nombre,
        codigo: String(inp.codigo ?? existing?.codigo ?? "").trim(),
        requiereAutorizacion:
          inp.requiereAutorizacion !== undefined
            ? Boolean(inp.requiereAutorizacion)
            : existing?.requiereAutorizacion ?? false,
        copagoSugeridoArs: Math.max(
          0,
          round2(
            inp.copagoSugeridoArs !== undefined
              ? Number(inp.copagoSugeridoArs)
              : existing?.copagoSugeridoArs ?? 0
          )
        ),
        observaciones: String(inp.observaciones ?? existing?.observaciones ?? "").trim(),
        activo: inp.activo !== undefined ? Boolean(inp.activo) : existing?.activo ?? true,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      if (existingIdx >= 0) db.planes[existingIdx] = record;
      else db.planes.unshift(record);
      return persistAndReturn({
        message: existing ? "Plan actualizado." : `Plan "${nombre}" agregado a ${os.sigla}.`,
        plan: record,
      });
    }

    if (action === "toggle_plan" || action === "delete_plan") {
      const id = String(body.id || "");
      const found = db.planes.find((p) => p.id === id);
      if (!found) {
        return NextResponse.json({ ok: false, message: "Plan no encontrado." }, { status: 404 });
      }
      if (action === "delete_plan" && body.hard === true) {
        db.planes = db.planes.filter((p) => p.id !== id);
      } else {
        found.activo = body.activo !== undefined ? Boolean(body.activo) : !found.activo;
        found.updatedAt = nowIso;
      }
      return persistAndReturn({ message: "Plan actualizado." });
    }

    // -------------------- ABM ESPECIALIDADES --------------------
    if (action === "save_especialidad") {
      const inp = (body.especialidad || body) as AnyObj;
      const nombre = String(inp.nombre || "").trim();
      if (!nombre) {
        return NextResponse.json(
          { ok: false, message: "Ingresá el nombre de la especialidad médica." },
          { status: 400 }
        );
      }
      const dur = normalizeTurnoDuration(inp.duracionMinutos);
      const existingIdx = inp.id
        ? db.especialidades.findIndex((e) => e.id === String(inp.id))
        : -1;
      const existing = existingIdx >= 0 ? db.especialidades[existingIdx] : null;

      const categoria =
        String(inp.categoria ?? existing?.categoria ?? "").trim() ||
        inferEspecialidadCategoria(nombre);

      const record: EspecialidadRecord = {
        id: existing?.id || `esp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        nombre,
        categoria,
        duracionMinutos: dur,
        permiteVideollamada:
          inp.permiteVideollamada !== undefined
            ? Boolean(inp.permiteVideollamada)
            : existing?.permiteVideollamada ?? true,
        valorConsultaParticularSugeridoArs: Math.max(
          0,
          round2(
            inp.valorConsultaParticularSugeridoArs !== undefined
              ? Number(inp.valorConsultaParticularSugeridoArs)
              : existing?.valorConsultaParticularSugeridoArs ?? 25000
          )
        ),
        colorHex: String(inp.colorHex || existing?.colorHex || "#0f766e"),
        descripcion: String(inp.descripcion ?? existing?.descripcion ?? "").trim(),
        activa: inp.activa !== undefined ? Boolean(inp.activa) : existing?.activa ?? true,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      if (existingIdx >= 0) db.especialidades[existingIdx] = record;
      else db.especialidades.unshift(record);

      return persistAndReturn({
        message: `Especialidad "${nombre}" (${dur} min) guardada correctamente.`,
        especialidad: record,
      });
    }

    if (action === "toggle_especialidad" || action === "delete_especialidad") {
      const id = String(body.id || "");
      const found = db.especialidades.find((e) => e.id === id);
      if (!found) {
        return NextResponse.json(
          { ok: false, message: "Especialidad no encontrada." },
          { status: 404 }
        );
      }
      if (action === "delete_especialidad" && body.hard === true) {
        db.especialidades = db.especialidades.filter((e) => e.id !== id);
      } else {
        found.activa = body.activa !== undefined ? Boolean(body.activa) : !found.activa;
        found.updatedAt = nowIso;
      }
      return persistAndReturn({ message: "Especialidad actualizada." });
    }

    // -------------------- GESTIÓN DE PACIENTES --------------------
    if (action === "save_paciente") {
      const inp = (body.paciente || body) as AnyObj;
      const dni = normalizeDni(String(inp.dni || ""));
      if (!dni || dni.length < 6) {
        return NextResponse.json(
          { ok: false, message: "Ingresá un DNI válido para el paciente." },
          { status: 400 }
        );
      }
      if (!String(inp.apellidos || "").trim() || !String(inp.nombres || "").trim()) {
        return NextResponse.json(
          { ok: false, message: "Completá Apellido/s y Nombre/s del paciente." },
          { status: 400 }
        );
      }
      const pac = upsertPacienteInDb(db, inp, "MANUAL");
      return persistAndReturn({
        message: "Paciente guardado correctamente.",
        paciente: pac,
      });
    }

    if (action === "delete_paciente") {
      const id = String(body.id || "");
      const found = db.pacientes.find((p) => p.id === id);
      if (found) {
        found.activo = body.activo !== undefined ? Boolean(body.activo) : false;
        found.updatedAt = nowIso;
      }
      return persistAndReturn({ message: "Paciente actualizado." });
    }

    // -------------------- GESTIÓN DE TURNOS (MANUAL + ESTADOS) --------------------
    if (action === "create_turno_manual") {
      const inp = (body.turno || body) as AnyObj;
      const prof = db.profesionales.find((p) => p.id === String(inp.profesionalId || ""));
      const esp = db.especialidades.find((e) => e.id === String(inp.especialidadId || ""));
      if (!prof || !esp) {
        return NextResponse.json(
          { ok: false, message: "Seleccioná Especialidad y Profesional." },
          { status: 400 }
        );
      }
      const fecha = String(inp.fecha || "").trim();
      const horaInicio = String(inp.horaInicio || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || timeToMinutes(horaInicio) < 0) {
        return NextResponse.json(
          { ok: false, message: "Indicá fecha y horario válidos." },
          { status: 400 }
        );
      }

      const esSobreturno = Boolean(inp.esSobreturno);
      if (!esSobreturno) {
        const dur = normalizeTurnoDuration(esp.duracionMinutos);
        const startM = timeToMinutes(horaInicio);
        const conflict = db.turnos.find(
          (t) =>
            t.profesionalId === prof.id &&
            t.fecha === fecha &&
            t.estado !== "cancelado" &&
            startM < timeToMinutes(t.horaFin) &&
            startM + dur > timeToMinutes(t.horaInicio)
        );
        if (conflict) {
          return NextResponse.json(
            {
              ok: false,
              message: `El horario ${horaInicio} ya está ocupado (${conflict.codigo} - ${conflict.pacienteNombreCompleto}). Marcá "Sobreturno" si deseás forzar la asignación.`,
            },
            { status: 409 }
          );
        }
      }

      let pac: PacienteRecord | undefined;
      if (inp.pacienteId) {
        pac = db.pacientes.find((p) => p.id === String(inp.pacienteId));
      }
      if (!pac) {
        const dniPac = normalizeDni(String(inp.pacienteDni || ""));
        if (!dniPac || !String(inp.pacienteApellidos || "").trim() || !String(inp.pacienteNombres || "").trim()) {
          return NextResponse.json(
            { ok: false, message: "Seleccioná un paciente o completá DNI, Apellido y Nombre." },
            { status: 400 }
          );
        }
        pac = upsertPacienteInDb(
          db,
          {
            dni: dniPac,
            apellidos: inp.pacienteApellidos,
            nombres: inp.pacienteNombres,
            fechaNacimiento: inp.pacienteFechaNacimiento || "",
            whatsapp: inp.pacienteWhatsapp || "",
            email: inp.pacienteEmail || "",
            obraSocialId: inp.obraSocialId || "",
            planId: inp.planId || "",
            nroAfiliado: inp.nroAfiliado || "",
          },
          "MANUAL"
        );
      }

      const coberturaTipo: TurnoCoberturaTipo =
        inp.coberturaTipo === "particular" ? "particular" : "obra_social";
      const os = coberturaTipo === "obra_social"
        ? db.obrasSociales.find((o) => o.id === String(inp.obraSocialId || pac?.obraSocialId || ""))
        : null;
      const plan = coberturaTipo === "obra_social"
        ? db.planes.find((pl) => pl.id === String(inp.planId || pac?.planId || ""))
        : null;
      const modalidad: TurnoModalidad =
        inp.modalidad === "videollamada" ? "videollamada" : "presencial";

      const turno = buildTurnoRecord({
        db,
        origen: "MANUAL",
        esSobreturno,
        fecha,
        horaInicio,
        especialidad: esp,
        profesional: prof,
        paciente: pac,
        coberturaTipo,
        obraSocial: os,
        plan,
        nroAfiliado: String(inp.nroAfiliado || pac.nroAfiliado || ""),
        modalidad,
        consultorio: String(inp.consultorio || ""),
        motivoConsulta: String(inp.motivoConsulta || ""),
        observaciones: String(inp.observaciones || ""),
        createdBy: actorName,
      });

      db.turnos.unshift(turno);
      return persistAndReturn({
        message: `Turno ${turno.codigo} asignado correctamente para ${turno.pacienteNombreCompleto}.`,
        turno,
      });
    }

    if (action === "update_turno_estado") {
      const id = String(body.id || "");
      const estado = String(body.estado || "") as TurnoEstado;
      const allowed: TurnoEstado[] = [
        "pendiente_pago",
        "pendiente",
        "confirmado",
        "en_sala",
        "atendido",
        "ausente",
        "cancelado",
      ];
      const turno = db.turnos.find((t) => t.id === id);
      if (!turno || !allowed.includes(estado)) {
        return NextResponse.json(
          { ok: false, message: "Turno o estado inválido." },
          { status: 400 }
        );
      }
      turno.estado = estado;
      if (body.observaciones !== undefined) {
        turno.observaciones = String(body.observaciones || "").trim();
      }
      if (estado === "atendido" && turno.video) {
        turno.video.status = "finalizada";
        turno.video.completedAt = nowIso;
      }
      turno.updatedAt = nowIso;
      return persistAndReturn({
        message: `Estado del turno ${turno.codigo} actualizado a ${estado.toUpperCase()}.`,
        turno,
      });
    }

    if (action === "mark_turno_paid_manual") {
      const id = String(body.id || "");
      const turno = db.turnos.find((t) => t.id === id);
      if (!turno) {
        return NextResponse.json({ ok: false, message: "Turno no encontrado." }, { status: 404 });
      }
      turno.pago.estado = "approved";
      turno.pago.paidAt = nowIso;
      turno.pago.mpPaymentId = turno.pago.mpPaymentId || `MANUAL-${Date.now()}`;
      if (turno.estado === "pendiente_pago" || turno.estado === "pendiente") {
        turno.estado = "confirmado";
      }
      turno.updatedAt = nowIso;

      // Registrar/actualizar transacción en liquidaciones Split
      const existingTx = db.transaccionesMp.find((x) => x.turnoId === turno.id);
      if (existingTx) {
        existingTx.status = "approved";
        existingTx.updatedAt = nowIso;
      } else if (turno.pago.montoTotalArs > 0) {
        db.transaccionesMp.unshift({
          id: `tx_${Date.now()}`,
          turnoId: turno.id,
          turnoCodigo: turno.codigo,
          idempotencyKey: `manual_${turno.id}`,
          preferenceId: turno.pago.preferenceId || "COBRO_RECEPCION",
          mpPaymentId: turno.pago.mpPaymentId || null,
          providerMode: "mercadopago_sandbox",
          profesionalId: turno.profesionalId,
          profesionalNombre: turno.profesionalNombre,
          profesionalMpUserId: "RECEPCION",
          pacienteDni: turno.pacienteDni,
          pacienteNombre: turno.pacienteNombreCompleto,
          especialidadNombre: turno.especialidadNombre,
          modalidad: turno.modalidad,
          fechaTurno: turno.fecha,
          horaTurno: turno.horaInicio,
          montoTotalArs: turno.pago.montoTotalArs,
          organizadorFeeArs: turno.pago.organizadorFeeArs,
          profesionalBrutoArs: turno.pago.profesionalBrutoArs,
          mpProcessorFeeEstimadoArs: turno.pago.mpProcessorFeeEstimadoArs,
          profesionalNetoEstimadoArs: turno.pago.profesionalNetoEstimadoArs,
          commissionSnapshot: turno.pago.commissionSnapshot || {
            organizadorPct: turno.pago.organizadorPct,
            profesionalPct: turno.pago.profesionalPct,
            ruleSource: "default_general",
            ruleLabel: "Liquidación registrada en recepción",
            capturedAt: nowIso,
          },
          status: "approved",
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
      return persistAndReturn({
        message: `Pago particular del turno ${turno.codigo} registrado como APROBADO.`,
        turno,
      });
    }

    // -------------------- SPLIT MERCADO PAGO & ORGANIZADOR --------------------
    if (action === "save_split_config") {
      const inp = (body.splitConfig || body) as AnyObj;
      const prevDef = db.splitConfig.defaultOrganizadorPct;
      const nextDef = clampPct(
        inp.defaultOrganizadorPct !== undefined
          ? Number(inp.defaultOrganizadorPct)
          : prevDef
      );
      const nextPres = clampPct(
        inp.presencialOrganizadorPct !== undefined
          ? Number(inp.presencialOrganizadorPct)
          : db.splitConfig.presencialOrganizadorPct
      );
      const nextVid = clampPct(
        inp.videollamadaOrganizadorPct !== undefined
          ? Number(inp.videollamadaOrganizadorPct)
          : db.splitConfig.videollamadaOrganizadorPct
      );

      const allowedOrgTipos: OrganizadorTipo[] = [
        "Clínica",
        "Consultorios Externos",
        "Sanatorio",
        "Staff de Profesionales",
        "Centro Médico",
        "Instituto / Policonsultorio",
      ];

      db.splitConfig = {
        ...db.splitConfig,
        organizadorNombre: String(
          inp.organizadorNombre ?? db.splitConfig.organizadorNombre
        ).trim(),
        organizadorTipo: allowedOrgTipos.includes(inp.organizadorTipo)
          ? inp.organizadorTipo
          : db.splitConfig.organizadorTipo,
        habilitarPagoOnlineParticular:
          inp.habilitarPagoOnlineParticular !== undefined
            ? Boolean(inp.habilitarPagoOnlineParticular)
            : db.splitConfig.habilitarPagoOnlineParticular,
        pagoObligatorioParaConfirmarParticular:
          inp.pagoObligatorioParaConfirmarParticular !== undefined
            ? Boolean(inp.pagoObligatorioParaConfirmarParticular)
            : db.splitConfig.pagoObligatorioParaConfirmarParticular,
        defaultOrganizadorPct: nextDef,
        presencialOrganizadorPct: nextPres,
        videollamadaOrganizadorPct: nextVid,
        mpOrganizadorAlias: String(
          inp.mpOrganizadorAlias ?? db.splitConfig.mpOrganizadorAlias ?? ""
        ).trim(),
        updatedAt: nowIso,
      };

      db.splitConfig.auditLog.unshift({
        id: `audit_${Date.now()}`,
        actor: actorName,
        targetLabel: `Reglas Split (${db.splitConfig.organizadorTipo}: General ${nextDef}% | Presencial ${nextPres}% | Videollamada ${nextVid}%)`,
        previousOrganizadorPct: prevDef,
        newOrganizadorPct: nextDef,
        newProfesionalPct: round2(100 - nextDef),
        changedAt: nowIso,
      });
      db.splitConfig.auditLog = db.splitConfig.auditLog.slice(0, 80);

      return persistAndReturn({
        message: "Configuración de distribución Mercado Pago guardada correctamente.",
      });
    }

    if (action === "save_profesional_split_exception") {
      const profId = String(body.profesionalId || "");
      const prof = db.profesionales.find((p) => p.id === profId);
      if (!prof) {
        return NextResponse.json(
          { ok: false, message: "Profesional no encontrado." },
          { status: 404 }
        );
      }
      const orgPct = clampPct(Number(body.organizadorPct));
      const profPct = round2(100 - orgPct);
      const prev = db.splitConfig.profesionalExceptions?.[profId]?.organizadorPct ?? null;
      db.splitConfig.profesionalExceptions[profId] = {
        profesionalId: profId,
        profesionalNombre: `${prof.apellidos}, ${prof.nombres}`,
        organizadorPct: orgPct,
        profesionalPct: profPct,
        motivo: String(body.motivo || "Acuerdo particular con el profesional").trim(),
        updatedBy: actorName,
        updatedAt: nowIso,
      };
      db.splitConfig.auditLog.unshift({
        id: `audit_${Date.now()}`,
        actor: actorName,
        targetLabel: `Excepción ${prof.apellidos}, ${prof.nombres} (${orgPct}% Org. / ${profPct}% Prof.)`,
        previousOrganizadorPct: prev,
        newOrganizadorPct: orgPct,
        newProfesionalPct: profPct,
        changedAt: nowIso,
      });
      return persistAndReturn({
        message: `Distribución individual guardada para ${prof.apellidos}, ${prof.nombres}.`,
      });
    }

    if (action === "delete_profesional_split_exception") {
      const profId = String(body.profesionalId || "");
      if (db.splitConfig.profesionalExceptions?.[profId]) {
        delete db.splitConfig.profesionalExceptions[profId];
      }
      return persistAndReturn({
        message: "Excepción eliminada. El profesional vuelve a usar la regla general.",
      });
    }

    if (action === "connect_profesional_mp") {
      const profId = String(body.profesionalId || "");
      const prof = db.profesionales.find((p) => p.id === profId);
      if (!prof) {
        return NextResponse.json(
          { ok: false, message: "Profesional no encontrado." },
          { status: 404 }
        );
      }
      const alias = String(body.mpAccountAlias || prof.mpAccount?.mpAccountAlias || "").trim();
      const mpUserId =
        String(body.mpUserId || "").trim() ||
        `MP-PROF-${Math.floor(10000000 + Math.random() * 89999999)}`;
      const bundle = encryptProfesionalMpTokens(
        `APP_USR_TURNOS_${prof.id}_${Date.now()}`,
        `TG_REF_TURNOS_${prof.id}_${Date.now()}`
      );
      prof.mpAccount = {
        linked: true,
        mpUserId,
        mpPublicKey: `APP_USR-pk-${prof.id.slice(-8)}`,
        mpAccountAlias: alias || `${prof.apellidos.toLowerCase().replace(/\W/g, "")}.mp`,
        tokenStatus: "active",
        tokenExpiresAt: bundle.expiresAt,
        linkedAt: nowIso,
        lastRefreshedAt: nowIso,
        encryptedTokenPayload: bundle.encryptedTokenPayload,
        ivHex: bundle.ivHex,
        authTagHex: bundle.authTagHex,
      };
      prof.updatedAt = nowIso;
      return persistAndReturn({
        message: `Cuenta de Mercado Pago vinculada con Split 1:1 para ${prof.apellidos}, ${prof.nombres}.`,
      });
    }

    if (action === "disconnect_profesional_mp") {
      const profId = String(body.profesionalId || "");
      const prof = db.profesionales.find((p) => p.id === profId);
      if (prof) {
        prof.mpAccount = {
          linked: false,
          mpUserId: null,
          mpPublicKey: null,
          mpAccountAlias: null,
          tokenStatus: "disconnected",
          tokenExpiresAt: null,
          linkedAt: null,
          lastRefreshedAt: null,
          encryptedTokenPayload: null,
          ivHex: null,
          authTagHex: null,
        };
        prof.updatedAt = nowIso;
      }
      return persistAndReturn({ message: "Cuenta de Mercado Pago desvinculada." });
    }

    if (action === "save_portal_config") {
      const inp = (body.portalConfig || body) as AnyObj;
      db.portalConfig = {
        ...db.portalConfig,
        tituloPortal: String(inp.tituloPortal ?? db.portalConfig.tituloPortal).trim(),
        subtituloPortal: String(
          inp.subtituloPortal ?? db.portalConfig.subtituloPortal
        ).trim(),
        direccionConsultorio: String(
          inp.direccionConsultorio ?? db.portalConfig.direccionConsultorio
        ).trim(),
        whatsappRecepcion: String(
          inp.whatsappRecepcion ?? db.portalConfig.whatsappRecepcion
        ).trim(),
        emailRecepcion: String(
          inp.emailRecepcion ?? db.portalConfig.emailRecepcion
        ).trim(),
        diasAnticipacionMax: Math.max(
          7,
          Math.min(180, Number(inp.diasAnticipacionMax || db.portalConfig.diasAnticipacionMax))
        ),
        permitirCancelacionPacienteHoras: Math.max(
          0,
          Math.min(
            72,
            Number(
              inp.permitirCancelacionPacienteHoras ??
                db.portalConfig.permitirCancelacionPacienteHoras
            )
          )
        ),
        mensajeConfirmacion: String(
          inp.mensajeConfirmacion ?? db.portalConfig.mensajeConfirmacion ?? ""
        ).trim(),
        updatedAt: nowIso,
      };
      return persistAndReturn({ message: "Configuración del Portal /turnos guardada." });
    }

    return NextResponse.json(
      { ok: false, message: `Acción desconocida en Turnero Web: ${action}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: false, message: "Método no permitido" }, { status: 405 });
}

// ============================================================================
// 2. ENDPOINTS PÚBLICOS DEL PORTAL /turnos (/api/turnos)
// ============================================================================

export async function handlePublicTurnosGet(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const db = await loadTurnosDb(tenant);
  const action = req.nextUrl.searchParams.get("action") || "bootstrap";

  if (action === "lookup_dni") {
    const dni = req.nextUrl.searchParams.get("dni") || "";
    const target = normalizeDni(dni);
    const lookup = await lookupPersonByDni(tenant, db, target);
    const misTurnos = target
      ? db.turnos
          .filter((t) => normalizeDni(t.pacienteDni) === target)
          .sort((a, b) => `${b.fecha} ${b.horaInicio}`.localeCompare(`${a.fecha} ${a.horaInicio}`))
          .slice(0, 30)
      : [];
    return NextResponse.json({
      ok: true,
      ...lookup,
      misTurnos,
    });
  }

  if (action === "slots") {
    const profesionalId = req.nextUrl.searchParams.get("profesionalId") || "";
    const especialidadId = req.nextUrl.searchParams.get("especialidadId") || "";
    const fecha = req.nextUrl.searchParams.get("fecha") || "";
    const modalidad = (req.nextUrl.searchParams.get("modalidad") || "todas") as
      | TurnoModalidad
      | "todas";
    const prof = db.profesionales.find((p) => p.id === profesionalId && p.activo);
    const esp = db.especialidades.find((e) => e.id === especialidadId && e.activa);
    if (!prof || !esp) {
      return NextResponse.json({ ok: true, slots: [] });
    }
    const slots = computeProfessionalDaySlots({
      profesional: prof,
      especialidad: esp,
      fechaIso: fecha,
      modalidadFiltro: modalidad,
      turnosExistentes: db.turnos,
      bloqueos: db.bloqueos,
      incluirOcupados: false,
    });
    return NextResponse.json({ ok: true, slots });
  }

  if (action === "available_dates") {
    const profesionalId = req.nextUrl.searchParams.get("profesionalId") || "";
    const especialidadId = req.nextUrl.searchParams.get("especialidadId") || "";
    const modalidad = (req.nextUrl.searchParams.get("modalidad") || "todas") as
      | TurnoModalidad
      | "todas";
    const days = Math.max(
      7,
      Math.min(db.portalConfig.diasAnticipacionMax || 60, Number(req.nextUrl.searchParams.get("days") || 45))
    );

    const prof = db.profesionales.find((p) => p.id === profesionalId && p.activo);
    const esp = db.especialidades.find((e) => e.id === especialidadId && e.activa);
    if (!prof || !esp) {
      return NextResponse.json({ ok: true, dates: [] });
    }

    const dates: Array<{ fecha: string; freeCount: number }> = [];
    const base = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(base.getTime() + i * 86400_000);
      const fechaIso = d.toLocaleDateString("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
      });
      const freeSlots = computeProfessionalDaySlots({
        profesional: prof,
        especialidad: esp,
        fechaIso,
        modalidadFiltro: modalidad,
        turnosExistentes: db.turnos,
        bloqueos: db.bloqueos,
        incluirOcupados: false,
      });
      if (freeSlots.length > 0) {
        dates.push({ fecha: fechaIso, freeCount: freeSlots.length });
      }
    }
    return NextResponse.json({ ok: true, dates });
  }

  if (action === "video_lookup") {
    const code = String(req.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
    const turno = db.turnos.find(
      (t) =>
        t.modalidad === "videollamada" &&
        t.estado !== "cancelado" &&
        (t.codigo.toUpperCase() === code ||
          (t.video?.roomCode || "").toUpperCase() === code)
    );
    if (!turno) {
      return NextResponse.json(
        { ok: false, message: "No se encontró una sala de videollamada activa con ese código." },
        { status: 404 }
      );
    }
    return NextResponse.json({
      ok: true,
      turno: {
        id: turno.id,
        codigo: turno.codigo,
        fecha: turno.fecha,
        horaInicio: turno.horaInicio,
        horaFin: turno.horaFin,
        duracionMinutos: turno.duracionMinutos,
        especialidadNombre: turno.especialidadNombre,
        profesionalNombre: turno.profesionalNombre,
        pacienteNombreCompleto: turno.pacienteNombreCompleto,
        estado: turno.estado,
        video: turno.video,
      },
    });
  }

  // Bootstrap público del portal /turnos
  const brand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );

  const activeObras = db.obrasSociales.filter((o) => o.activa);
  const activeObraIds = new Set(activeObras.map((o) => o.id));
  const activePlanes = db.planes.filter(
    (p) => p.activo && activeObraIds.has(p.obraSocialId)
  );
  const activeEspecialidades = db.especialidades.filter((e) => e.activa);
  const activeProfesionales = db.profesionales
    .filter((p) => p.activo)
    .map((p) => ({
      id: p.id,
      apellidos: p.apellidos,
      nombres: p.nombres,
      nombreCompleto: p.nombreCompleto,
      titulo: p.titulo || "",
      matriculaNacional: p.matriculaNacional || "",
      matriculaProvincial: p.matriculaProvincial || "",
      especialidadIds: p.especialidadIds,
      obraSocialIds: p.obraSocialIds.filter((oid) => activeObraIds.has(oid)),
      atiendeParticular: p.atiendeParticular,
      valorConsultaParticularArs: p.valorConsultaParticularArs,
      valorPorEspecialidadArs: p.valorPorEspecialidadArs || {},
      permitePresencial: p.permitePresencial,
      permiteVideollamada: p.permiteVideollamada,
      diasAtencion: Array.from(
        new Set((p.horarios || []).filter((h) => h.activo).map((h) => h.diaSemana))
      ).sort(),
      mpLinked: Boolean(p.mpAccount?.linked),
    }));

  return NextResponse.json({
    ok: true,
    tenant: {
      slug: tenant.slug,
      fantasyName: tenant.fantasy_name,
      businessName: tenant.business_name,
      isBase: tenant.is_base,
      optionType: tenant.option_type,
      primaryHex: brand.primaryHex,
      accentHex: brand.accentHex,
      logoHorizontalUrl: brand.logoHorizontalUrl,
      logoSymbolUrl: brand.logoSymbolUrl,
      whatsappDisplay: brand.whatsappDisplay,
      whatsappDigits: brand.whatsappDigits,
      address: brand.address,
    },
    portalConfig: db.portalConfig,
    paymentConfig: {
      organizadorNombre: db.splitConfig.organizadorNombre,
      organizadorTipo: db.splitConfig.organizadorTipo,
      habilitarPagoOnlineParticular: db.splitConfig.habilitarPagoOnlineParticular,
      pagoObligatorioParaConfirmarParticular:
        db.splitConfig.pagoObligatorioParaConfirmarParticular,
    },
    especialidades: activeEspecialidades,
    obrasSociales: activeObras,
    planes: activePlanes,
    profesionales: activeProfesionales,
  });
}

export async function handlePublicTurnosPost(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const body = ((await req.json().catch(() => null)) || null) as AnyObj | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, message: "Solicitud inválida." }, { status: 400 });
  }

  const db = await loadTurnosDb(tenant);
  const action = String(body.action || "book_turno").trim();
  const nowIso = new Date().toISOString();

  if (action === "register_paciente") {
    const dni = normalizeDni(String(body.dni || ""));
    if (!dni || dni.length < 6) {
      return NextResponse.json(
        { ok: false, message: "Ingresá un DNI válido." },
        { status: 400 }
      );
    }
    if (!String(body.apellidos || "").trim() || !String(body.nombres || "").trim()) {
      return NextResponse.json(
        { ok: false, message: "Completá Apellido/s y Nombre/s." },
        { status: 400 }
      );
    }
    const pac = upsertPacienteInDb(db, body, "WEB");
    db.updatedAt = nowIso;
    await putTenantDoc(tenant, TURNOS_DOC_KEY, db, "paciente_web", "register_paciente");
    return NextResponse.json({
      ok: true,
      paciente: pac,
      message: "Datos del paciente registrados correctamente.",
    });
  }

  if (action === "book_turno") {
    const pacIn = (body.paciente || {}) as AnyObj;
    const dni = normalizeDni(String(pacIn.dni || body.dni || ""));
    const apellidos = String(pacIn.apellidos || body.apellidos || "").trim();
    const nombres = String(pacIn.nombres || body.nombres || "").trim();
    const whatsapp = String(pacIn.whatsapp || body.whatsapp || "").trim();

    if (!dni || dni.length < 6 || !apellidos || !nombres) {
      return NextResponse.json(
        { ok: false, message: "Completá DNI, Apellido/s y Nombre/s del paciente." },
        { status: 400 }
      );
    }
    if (!whatsapp || whatsapp.replace(/\D/g, "").length < 6) {
      return NextResponse.json(
        { ok: false, message: "Ingresá tu WhatsApp para confirmar el turno." },
        { status: 400 }
      );
    }

    const prof = db.profesionales.find(
      (p) => p.id === String(body.profesionalId || "") && p.activo
    );
    const esp = db.especialidades.find(
      (e) => e.id === String(body.especialidadId || "") && e.activa
    );
    if (!prof || !esp) {
      return NextResponse.json(
        { ok: false, message: "Especialidad o profesional no disponible." },
        { status: 400 }
      );
    }

    const fecha = String(body.fecha || "").trim();
    const horaInicio = String(body.horaInicio || "").trim();
    const modalidad: TurnoModalidad =
      body.modalidad === "videollamada" ? "videollamada" : "presencial";

    if (modalidad === "videollamada" && (!prof.permiteVideollamada || !esp.permiteVideollamada)) {
      return NextResponse.json(
        { ok: false, message: "Esta especialidad/profesional no admite videollamada." },
        { status: 400 }
      );
    }

    // Validar que el slot esté realmente libre en el servidor (anti-doble reserva)
    const freeSlots = computeProfessionalDaySlots({
      profesional: prof,
      especialidad: esp,
      fechaIso: fecha,
      modalidadFiltro: modalidad,
      turnosExistentes: db.turnos,
      bloqueos: db.bloqueos,
      incluirOcupados: false,
    });
    const matchedSlot = freeSlots.find((s) => s.horaInicio === horaInicio);
    if (!matchedSlot) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El horario elegido acaba de ocuparse o no está disponible. Elegí otro horario.",
        },
        { status: 409 }
      );
    }

    const coberturaTipo: TurnoCoberturaTipo =
      body.coberturaTipo === "particular" ? "particular" : "obra_social";
    if (coberturaTipo === "particular" && !prof.atiendeParticular) {
      return NextResponse.json(
        { ok: false, message: "Este profesional no atiende en modalidad Particular." },
        { status: 400 }
      );
    }

    let os: ObraSocialRecord | null = null;
    let plan: PlanObraSocialRecord | null = null;
    if (coberturaTipo === "obra_social") {
      os =
        db.obrasSociales.find(
          (o) => o.id === String(body.obraSocialId || "") && o.activa
        ) || null;
      if (!os || !prof.obraSocialIds.includes(os.id)) {
        return NextResponse.json(
          { ok: false, message: "Seleccioná una Obra Social aceptada por el profesional." },
          { status: 400 }
        );
      }
      plan =
        db.planes.find(
          (pl) =>
            pl.id === String(body.planId || "") &&
            pl.obraSocialId === os!.id &&
            pl.activo
        ) || null;
    }

    const paciente = upsertPacienteInDb(
      db,
      {
        dni,
        apellidos,
        nombres,
        fechaNacimiento: pacIn.fechaNacimiento || body.fechaNacimiento || "",
        genero: pacIn.genero || body.genero || "",
        whatsapp,
        email: pacIn.email || body.email || "",
        domicilio: pacIn.domicilio || body.domicilio || "",
        localidad: pacIn.localidad || body.localidad || "",
        provincia: pacIn.provincia || body.provincia || "",
        obraSocialId: os?.id || pacIn.obraSocialId || "",
        planId: plan?.id || pacIn.planId || "",
        nroAfiliado: body.nroAfiliado || pacIn.nroAfiliado || "",
      },
      "WEB"
    );

    const turno = buildTurnoRecord({
      db,
      origen: "WEB",
      fecha,
      horaInicio,
      especialidad: esp,
      profesional: prof,
      paciente,
      coberturaTipo,
      obraSocial: os,
      plan,
      nroAfiliado: String(body.nroAfiliado || paciente.nroAfiliado || ""),
      modalidad,
      consultorio: matchedSlot.consultorio || "",
      motivoConsulta: String(body.motivoConsulta || ""),
      createdBy: "paciente_web",
    });

    db.turnos.unshift(turno);
    db.updatedAt = nowIso;
    await putTenantDoc(tenant, TURNOS_DOC_KEY, db, "paciente_web", "book_turno_web");

    return NextResponse.json({
      ok: true,
      turno,
      paciente,
      message: `¡Turno ${turno.codigo} reservado correctamente!`,
    });
  }

  if (action === "cancel_turno_paciente") {
    const codigo = String(body.codigo || "").trim().toUpperCase();
    const dni = normalizeDni(String(body.dni || ""));
    const turno = db.turnos.find(
      (t) =>
        t.codigo.toUpperCase() === codigo &&
        normalizeDni(t.pacienteDni) === dni &&
        t.estado !== "cancelado"
    );
    if (!turno) {
      return NextResponse.json(
        { ok: false, message: "No se encontró el turno para ese DNI y código." },
        { status: 404 }
      );
    }
    turno.estado = "cancelado";
    turno.observaciones = `${turno.observaciones ? turno.observaciones + " · " : ""}Cancelado por paciente desde web (${new Date().toLocaleString("es-AR")})`;
    turno.updatedAt = nowIso;
    db.updatedAt = nowIso;
    await putTenantDoc(tenant, TURNOS_DOC_KEY, db, "paciente_web", "cancel_turno_web");
    return NextResponse.json({
      ok: true,
      turno,
      message: `Turno ${turno.codigo} cancelado correctamente. El horario volvió a quedar libre.`,
    });
  }

  if (action === "confirm_sandbox_payment") {
    const turnoId = String(body.turnoId || "").trim();
    const turno = db.turnos.find((t) => t.id === turnoId);
    if (!turno) {
      return NextResponse.json({ ok: false, message: "Turno no encontrado." }, { status: 404 });
    }
    const fakePayId = `MP-SANDBOX-${Date.now()}`;
    turno.pago.estado = "approved";
    turno.pago.mpPaymentId = fakePayId;
    turno.pago.paidAt = nowIso;
    turno.pago.providerMode = "mercadopago_sandbox";
    turno.estado = "confirmado";
    turno.updatedAt = nowIso;

    const tx = db.transaccionesMp.find((x) => x.turnoId === turno.id);
    if (tx) {
      tx.status = "approved";
      tx.mpPaymentId = fakePayId;
      tx.updatedAt = nowIso;
    }

    db.updatedAt = nowIso;
    await putTenantDoc(tenant, TURNOS_DOC_KEY, db, "paciente_web", "confirm_sandbox_mp");
    return NextResponse.json({
      ok: true,
      turno,
      mpPaymentId: fakePayId,
      message: `¡Pago online aprobado (${fakePayId})! Tu turno ${turno.codigo} quedó CONFIRMADO.`,
    });
  }

  return NextResponse.json({ ok: false, message: "Acción inválida." }, { status: 400 });
}
