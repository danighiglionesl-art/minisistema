import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type {
  AcademiaAlumno,
  AcademiaAsistenciaSesion,
  AcademiaCertificado,
  AcademiaClaseOnline,
  AcademiaConfig,
  AcademiaCuota,
  AcademiaCurso,
  AcademiaDocente,
  AcademiaEstadoAsistencia,
  AcademiaInscripcion,
  AcademiaMaterialAula,
  AcademiaMedioPago,
  AcademiaPagoRegistro,
  AcademiasDatabase,
} from "../academias-types";
import { buildCleanTenantSeed } from "../seed-clean-tenant";
import { getTenantDoc, putTenantDoc } from "../supabase-server";
import type { ErpTenantRecord } from "../types";

export const ACADEMIAS_DOC_KEY = "academias_db";

type AnyObj = Record<string, any>;

function round2(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function padNum(prefix: string, n: number, digits = 5): string {
  return `${prefix}-${String(Math.max(1, Math.floor(n))).padStart(digits, "0")}`;
}

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentPeriodYm(): string {
  return todayIso().slice(0, 7);
}

function buildDueDateForPeriod(ym: string, dueDay: number): string {
  const m = String(ym || "").match(/^(\d{4})-(\d{2})$/);
  const y = m ? Number(m[1]) : new Date().getFullYear();
  const mo = m ? Number(m[2]) : new Date().getMonth() + 1;
  const maxDay = new Date(y, mo, 0).getDate();
  const safeDay = Math.min(maxDay, Math.max(1, Math.floor(Number(dueDay) || 10)));
  return `${y}-${String(mo).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

export function buildDefaultAcademiaConfig(tenant?: ErpTenantRecord): AcademiaConfig {
  return {
    nombreAcademia: tenant?.fantasy_name || tenant?.business_name || "Mi Academia",
    tipoNegocio: "mixta",
    logoUrl: tenant?.branding?.logo1x1Url || tenant?.branding?.logoHorizontalUrl || "",
    direccion: tenant?.branding?.address || "",
    localidad: tenant?.branding?.localidad || "",
    whatsapp: tenant?.branding?.whatsappDigits || "",
    email: tenant?.branding?.emailInfo || "",
    diaVencimientoCuota: 10,
    recargoMoraPct: 10,
    asistenciaMinimaCertificadoPct: 75,
    firmante1Nombre: "Dirección Académica",
    firmante1Cargo: "Director/a",
    firmante2Nombre: "Coordinación Docente",
    firmante2Cargo: "Profesor/a Titular",
    textoCertificado:
      "Se certifica que el/la participante ha completado y aprobado satisfactoriamente el cursado correspondiente, cumpliendo con los requisitos académicos y de asistencia establecidos.",
    reglamentoInterno:
      "Las cuotas vencen del 1 al 10 de cada mes. Avisar inasistencias con anticipación por WhatsApp.",
    dailyDomain: "",
    opcionales: {
      pagosOnlineMp: false,
      certificadosAuto: true,
      aulaVirtualClassroom: true,
      clasesOnlineDaily: true,
      inscripcionPublicaWeb: false,
      fichaSaludAptoFisico: true,
      integrarClientesCtaCte: true,
    },
  };
}

export function buildCleanAcademiasDb(tenant?: ErpTenantRecord): AcademiasDatabase {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    seqInscripcion: 1,
    seqRecibo: 1,
    seqCertificado: 1,
    seqCuota: 1,
    config: buildDefaultAcademiaConfig(tenant),
    cursos: [],
    alumnos: [],
    inscripciones: [],
    asistencias: [],
    cuotas: [],
    pagos: [],
    docentes: [],
    materiales: [],
    clasesOnline: [],
    certificados: [],
  };
}

function normalizeDb(raw: AnyObj | null | undefined, tenant?: ErpTenantRecord): AcademiasDatabase {
  const clean = buildCleanAcademiasDb(tenant);
  if (!raw || typeof raw !== "object") return clean;
  const rawCfg = raw.config && typeof raw.config === "object" ? raw.config : {};
  const rawOpt = rawCfg.opcionales && typeof rawCfg.opcionales === "object" ? rawCfg.opcionales : {};
  return {
    version: Number(raw.version) || 1,
    updatedAt: String(raw.updatedAt || clean.updatedAt),
    seqInscripcion: Math.max(1, Number(raw.seqInscripcion) || 1),
    seqRecibo: Math.max(1, Number(raw.seqRecibo) || 1),
    seqCertificado: Math.max(1, Number(raw.seqCertificado) || 1),
    seqCuota: Math.max(1, Number(raw.seqCuota) || 1),
    config: {
      ...clean.config,
      ...rawCfg,
      opcionales: {
        ...clean.config.opcionales,
        ...rawOpt,
      },
    },
    cursos: Array.isArray(raw.cursos) ? raw.cursos : [],
    alumnos: Array.isArray(raw.alumnos) ? raw.alumnos : [],
    inscripciones: Array.isArray(raw.inscripciones) ? raw.inscripciones : [],
    asistencias: Array.isArray(raw.asistencias) ? raw.asistencias : [],
    cuotas: Array.isArray(raw.cuotas) ? raw.cuotas : [],
    pagos: Array.isArray(raw.pagos) ? raw.pagos : [],
    docentes: Array.isArray(raw.docentes) ? raw.docentes : [],
    materiales: Array.isArray(raw.materiales) ? raw.materiales : [],
    clasesOnline: Array.isArray(raw.clasesOnline) ? raw.clasesOnline : [],
    certificados: Array.isArray(raw.certificados) ? raw.certificados : [],
  };
}

function computeAlumnoAttendancePct(
  asistencias: AcademiaAsistenciaSesion[],
  alumnoId: string,
  cursoId?: string
): { total: number; presentes: number; pct: number } {
  let total = 0;
  let presentes = 0;
  for (const ses of asistencias) {
    if (cursoId && ses.cursoId !== cursoId) continue;
    const st = ses.registros?.[alumnoId];
    if (!st) continue;
    total++;
    if (st === "P" || st === "T" || st === "J") presentes++;
  }
  const pct = total > 0 ? Math.round((presentes / total) * 100) : 100;
  return { total, presentes, pct };
}

function buildDashboardSummary(db: AcademiasDatabase) {
  const ym = currentPeriodYm();
  const today = todayIso();

  const alumnosActivos = db.alumnos.filter((a) => a.estado === "activo").length;
  const cursosActivos = db.cursos.filter((c) => c.activo).length;
  const inscripcionesActivas = db.inscripciones.filter((i) => i.estado === "activa").length;

  let recaudadoMes = 0;
  let pagosMesCount = 0;
  for (const p of db.pagos) {
    if (String(p.fechaPago || "").startsWith(ym)) {
      recaudadoMes = round2(recaudadoMes + Number(p.importe || 0));
      pagosMesCount++;
    }
  }

  let totalPendiente = 0;
  let cuotasVencidasCount = 0;
  let cuotasPendientesCount = 0;
  for (const c of db.cuotas) {
    if (c.estado === "pendiente" || c.estado === "parcial") {
      cuotasPendientesCount++;
      totalPendiente = round2(totalPendiente + Number(c.saldoPendiente || 0));
      if (c.fechaVencimiento && c.fechaVencimiento < today) {
        cuotasVencidasCount++;
      }
    }
  }

  let regTotal = 0;
  let regPres = 0;
  for (const s of db.asistencias) {
    if (!String(s.fecha || "").startsWith(ym)) continue;
    for (const val of Object.values(s.registros || {})) {
      regTotal++;
      if (val === "P" || val === "T" || val === "J") regPres++;
    }
  }
  const asistenciaMesPct = regTotal > 0 ? Math.round((regPres / regTotal) * 100) : 0;

  const clasesOnlineProx = db.clasesOnline.filter(
    (c) => (c.estado === "programada" || c.estado === "en_vivo") && c.fecha >= today
  ).length;

  const aptoPendienteCount = db.config.opcionales.fichaSaludAptoFisico
    ? db.alumnos.filter((a) => a.estado === "activo" && !a.aptoFisicoOk).length
    : 0;

  return {
    periodoActual: ym,
    alumnosTotal: db.alumnos.length,
    alumnosActivos,
    cursosActivos,
    inscripcionesActivas,
    docentesActivos: db.docentes.filter((d) => d.activo).length,
    recaudadoMes,
    pagosMesCount,
    totalPendiente,
    cuotasPendientesCount,
    cuotasVencidasCount,
    asistenciaMesPct,
    clasesOnlineProx,
    certificadosEmitidos: db.certificados.length,
    aptoPendienteCount,
  };
}

/**
 * Sincroniza el alumno (o tutor responsable) con el padrón único de clientes_db
 * para que Gestión de Academias se nutra del ERP sin duplicar clientes ni cuentas corrientes.
 */
async function syncAlumnoToClientesErp(
  tenant: ErpTenantRecord,
  alumno: AcademiaAlumno,
  actor: string
): Promise<number | null> {
  try {
    const fallback = buildCleanTenantSeed({
      businessName: tenant.business_name,
      localidad: tenant.branding.localidad,
      provincia: tenant.branding.provincia,
    }).docs.clientes_db as AnyObj;
    const { payload: cliDb } = await getTenantDoc<AnyObj>(tenant, "clientes_db", fallback);
    if (!cliDb || !Array.isArray(cliDb.clientes)) return alumno.clienteId ?? null;

    const cleanDni = String(alumno.dni || "").replace(/\D/g, "");
    const targetName = String(alumno.tutorNombre || alumno.nombre || "").trim().toUpperCase();
    const targetTel = String(alumno.tutorWhatsapp || alumno.whatsapp || "").trim();

    let found: AnyObj | undefined;
    if (alumno.clienteId) {
      found = cliDb.clientes.find((c: AnyObj) => Number(c.id) === Number(alumno.clienteId));
    }
    if (!found && cleanDni.length >= 6) {
      found = cliDb.clientes.find(
        (c: AnyObj) => String(c.nroDoc || "").replace(/\D/g, "") === cleanDni
      );
    }

    if (found) {
      if (targetTel && !found.telefono) found.telefono = targetTel;
      if (alumno.email && !found.email) found.email = alumno.email;
      if (alumno.domicilio && !found.domicilio) found.domicilio = alumno.domicilio;
      await putTenantDoc(tenant, "clientes_db", cliDb, actor, "academia_sync_cliente");
      return Number(found.id);
    }

    const maxId = cliDb.clientes.reduce(
      (mx: number, c: AnyObj) => Math.max(mx, Number(c.id || 0)),
      1
    );
    const maxCod = cliDb.clientes.reduce(
      (mx: number, c: AnyObj) => Math.max(mx, Number(c.codigo || 0)),
      1
    );
    const nextId = maxId + 1;
    const nextCod = maxCod + 1;
    const newCli: AnyObj = {
      id: nextId,
      codigo: nextCod,
      nombre: targetName || "ALUMNO ACADEMIA",
      tipoDoc: cleanDni.length === 11 ? "CUIT" : "DNI",
      nroDoc: cleanDni || "00000000",
      respIva: "Consumidor Final",
      domicilio: alumno.domicilio || "",
      localidad: tenant.branding.localidad || "",
      provincia: tenant.branding.provincia || "",
      telefono: targetTel,
      email: alumno.email || "",
      esCliente: true,
      esProveedor: false,
      bajaLogica: false,
      origenModulo: "academias",
      saldoActual: 0,
      observaciones: `Sincronizado automáticamente desde Gestión de Academias (Alumno: ${alumno.nombre})`,
      createdAt: new Date().toISOString(),
    };
    cliDb.clientes.push(newCli);
    cliDb.updatedAt = new Date().toISOString();
    await putTenantDoc(tenant, "clientes_db", cliDb, actor, "academia_create_cliente");
    return nextId;
  } catch {
    return alumno.clienteId ?? null;
  }
}

async function listEmpleadosFromAsistencia(tenant: ErpTenantRecord): Promise<AnyObj[]> {
  try {
    const { payload } = await getTenantDoc<AnyObj>(tenant, "asistencia_db", { employees: [] });
    if (Array.isArray(payload?.employees)) {
      return payload.employees.map((e: AnyObj) => ({
        id: String(e.id || e.dni || ""),
        nombre: String(e.name || e.nombre || "").trim(),
        dni: String(e.dni || "").trim(),
        puesto: String(e.role || e.puesto || e.cargo || "").trim(),
        whatsapp: String(e.phone || e.whatsapp || "").trim(),
        email: String(e.email || "").trim(),
      }));
    }
  } catch {
    // Non-blocking
  }
  return [];
}

function buildDemoAcademiasDb(tenant: ErpTenantRecord): AcademiasDatabase {
  const db = buildCleanAcademiasDb(tenant);
  const nowIso = new Date().toISOString();
  const ym = currentPeriodYm();
  const today = todayIso();

  db.docentes = [
    {
      id: "doc_demo_1",
      nombre: "VALENTINA MORALES",
      dni: "34890123",
      especialidad: "Danza Contemporánea y Clásica",
      whatsapp: "5493584112233",
      email: "valentina@academia.com",
      esquemaHonorarios: "porcentaje",
      valorEsquema: 45,
      cbuAlias: "VALE.DANZA.MP",
      activo: true,
      notas: "Profesora titular de salón principal",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "doc_demo_2",
      nombre: "LIC. MARCOS FERREYRA",
      dni: "31222444",
      especialidad: "Escuela de Negocios, Finanzas y Marketing",
      whatsapp: "5493584998877",
      email: "marcos@escuelanegocios.com",
      esquemaHonorarios: "valor_clase",
      valorEsquema: 28000,
      cbuAlias: "MARCOS.NEGOCIOS",
      activo: true,
      notas: "Capacitaciones híbridas y mentorías online",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  db.cursos = [
    {
      id: "cur_demo_1",
      codigo: "DAN-01",
      nombre: "Danza Contemporánea Juvenil / Adultos",
      categoria: "Danza",
      nivel: "Inicial - Intermedio",
      modalidad: "presencial",
      docenteId: "doc_demo_1",
      docenteNombre: "VALENTINA MORALES",
      diasHorarios: "Martes y Jueves · 19:00 a 20:30 hs",
      aulaSala: "Estudio A (Espejos)",
      cupoMaximo: 20,
      arancelMatricula: 15000,
      arancelCuotaMensual: 32000,
      duracionMeses: 9,
      cargaHorariaHs: 108,
      fechaInicio: `${ym}-01`,
      fechaFin: "",
      classroomUrl: "https://classroom.google.com/c/demo-danza-01",
      classroomCodigo: "DNZ2026",
      dailyRoomUrl: "",
      activo: true,
      notas: "Requiere apto físico anual.",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "cur_demo_2",
      codigo: "NEG-01",
      nombre: "Diplomatura Práctica en Gestión Comercial y Ventas",
      categoria: "Escuela de Negocios",
      nivel: "Ejecutivo",
      modalidad: "hibrida",
      docenteId: "doc_demo_2",
      docenteNombre: "LIC. MARCOS FERREYRA",
      diasHorarios: "Miércoles · 20:00 a 22:00 hs (Presencial + Vivo Daily)",
      aulaSala: "Aula Magna / Sala Online",
      cupoMaximo: 35,
      arancelMatricula: 20000,
      arancelCuotaMensual: 48000,
      duracionMeses: 4,
      cargaHorariaHs: 48,
      fechaInicio: `${ym}-01`,
      fechaFin: "",
      classroomUrl: "https://classroom.google.com/c/demo-negocios-01",
      classroomCodigo: "NEG2026",
      dailyRoomUrl: "",
      activo: true,
      notas: "Incluye Aula Virtual Google Classroom, clases grabadas y certificado.",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  db.alumnos = [
    {
      id: "alu_demo_1",
      legajo: "ALU-0001",
      nombre: "SOFÍA PERALTA",
      dni: "42111222",
      fechaNacimiento: "2001-05-14",
      whatsapp: "5493584123456",
      email: "sofia.peralta@mail.com",
      domicilio: "Belgrano 450",
      tutorNombre: "",
      tutorWhatsapp: "",
      contactoEmergencia: "Laura Peralta · 3584123400",
      aptoFisicoOk: true,
      aptoFisicoVencimiento: "2027-03-01",
      observacionesSalud: "Sin observaciones",
      estado: "activo",
      origen: "presencial",
      notas: "",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "alu_demo_2",
      legajo: "ALU-0002",
      nombre: "LUCÍA GÓMEZ",
      dni: "45666777",
      fechaNacimiento: "2010-08-22",
      whatsapp: "5493584334455",
      email: "familia.gomez@mail.com",
      domicilio: "San Martín 120",
      tutorNombre: "CAROLINA GÓMEZ",
      tutorWhatsapp: "5493584334455",
      contactoEmergencia: "Carolina Gómez · 3584334455",
      aptoFisicoOk: false,
      aptoFisicoVencimiento: "",
      observacionesSalud: "Falta entregar certificado médico",
      estado: "activo",
      origen: "presencial",
      notas: "Beca 15% por hermana",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "alu_demo_3",
      legajo: "ALU-0003",
      nombre: "MATÍAS ROLDÁN",
      dni: "36555888",
      fechaNacimiento: "1992-02-10",
      whatsapp: "5493584776655",
      email: "matias.roldan@empresa.com",
      domicilio: "Sarmiento 890",
      tutorNombre: "",
      tutorWhatsapp: "",
      contactoEmergencia: "",
      aptoFisicoOk: true,
      aptoFisicoVencimiento: "",
      observacionesSalud: "",
      estado: "activo",
      origen: "presencial",
      notas: "Cursa modalidad online desde otra localidad",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  db.inscripciones = [
    {
      id: "ins_demo_1",
      numero: "INS-00001",
      alumnoId: "alu_demo_1",
      alumnoNombre: "SOFÍA PERALTA",
      alumnoDni: "42111222",
      cursoId: "cur_demo_1",
      cursoNombre: "Danza Contemporánea Juvenil / Adultos",
      fechaInscripcion: today,
      becaPct: 0,
      cuotaAcordada: 32000,
      matriculaImporte: 15000,
      matriculaPagada: true,
      estado: "activa",
      notas: "",
      createdBy: "demo",
      createdAt: nowIso,
    },
    {
      id: "ins_demo_2",
      numero: "INS-00002",
      alumnoId: "alu_demo_2",
      alumnoNombre: "LUCÍA GÓMEZ",
      alumnoDni: "45666777",
      cursoId: "cur_demo_1",
      cursoNombre: "Danza Contemporánea Juvenil / Adultos",
      fechaInscripcion: today,
      becaPct: 15,
      cuotaAcordada: 27200,
      matriculaImporte: 15000,
      matriculaPagada: false,
      estado: "activa",
      notas: "Descuento familiar 15%",
      createdBy: "demo",
      createdAt: nowIso,
    },
    {
      id: "ins_demo_3",
      numero: "INS-00003",
      alumnoId: "alu_demo_3",
      alumnoNombre: "MATÍAS ROLDÁN",
      alumnoDni: "36555888",
      cursoId: "cur_demo_2",
      cursoNombre: "Diplomatura Práctica en Gestión Comercial y Ventas",
      fechaInscripcion: today,
      becaPct: 0,
      cuotaAcordada: 48000,
      matriculaImporte: 20000,
      matriculaPagada: true,
      estado: "activa",
      notas: "",
      createdBy: "demo",
      createdAt: nowIso,
    },
  ];

  db.asistencias = [
    {
      id: "asi_demo_1",
      cursoId: "cur_demo_1",
      cursoNombre: "Danza Contemporánea Juvenil / Adultos",
      fecha: today,
      temaClase: "Entrada en calor, técnica de piso y secuencia coreográfica 1",
      modalidadSesion: "presencial",
      docenteId: "doc_demo_1",
      docenteNombre: "VALENTINA MORALES",
      registros: {
        alu_demo_1: "P",
        alu_demo_2: "P",
      },
      observaciones: "Excelente participación grupal",
      updatedBy: "demo",
      updatedAt: nowIso,
    },
  ];

  const due = buildDueDateForPeriod(ym, 10);
  db.cuotas = [
    {
      id: "cuo_demo_1",
      numero: "CUO-00001",
      inscripcionId: "ins_demo_1",
      alumnoId: "alu_demo_1",
      alumnoNombre: "SOFÍA PERALTA",
      alumnoWhatsapp: "5493584123456",
      cursoId: "cur_demo_1",
      cursoNombre: "Danza Contemporánea Juvenil / Adultos",
      periodo: ym,
      concepto: `Cuota ${ym} · Danza Contemporánea`,
      fechaVencimiento: due,
      importeOriginal: 32000,
      descuentoBeca: 0,
      recargoMora: 0,
      importeTotal: 32000,
      importePagado: 32000,
      saldoPendiente: 0,
      estado: "pagada",
      ultimoPagoFecha: today,
      ultimoReciboNumero: "REC-AC-00001",
      mpPaymentLink: "",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "cuo_demo_2",
      numero: "CUO-00002",
      inscripcionId: "ins_demo_2",
      alumnoId: "alu_demo_2",
      alumnoNombre: "LUCÍA GÓMEZ",
      alumnoWhatsapp: "5493584334455",
      cursoId: "cur_demo_1",
      cursoNombre: "Danza Contemporánea Juvenil / Adultos",
      periodo: ym,
      concepto: `Cuota ${ym} · Danza Contemporánea`,
      fechaVencimiento: due,
      importeOriginal: 32000,
      descuentoBeca: 4800,
      recargoMora: 0,
      importeTotal: 27200,
      importePagado: 0,
      saldoPendiente: 27200,
      estado: "pendiente",
      ultimoPagoFecha: "",
      ultimoReciboNumero: "",
      mpPaymentLink: "",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "cuo_demo_3",
      numero: "CUO-00003",
      inscripcionId: "ins_demo_3",
      alumnoId: "alu_demo_3",
      alumnoNombre: "MATÍAS ROLDÁN",
      alumnoWhatsapp: "5493584776655",
      cursoId: "cur_demo_2",
      cursoNombre: "Diplomatura Práctica en Gestión Comercial y Ventas",
      periodo: ym,
      concepto: `Cuota ${ym} · Diplomatura Gestión Comercial`,
      fechaVencimiento: due,
      importeOriginal: 48000,
      descuentoBeca: 0,
      recargoMora: 0,
      importeTotal: 48000,
      importePagado: 48000,
      saldoPendiente: 0,
      estado: "pagada",
      ultimoPagoFecha: today,
      ultimoReciboNumero: "REC-AC-00002",
      mpPaymentLink: "",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  db.pagos = [
    {
      id: "pag_demo_1",
      reciboNumero: "REC-AC-00001",
      cuotaId: "cuo_demo_1",
      alumnoId: "alu_demo_1",
      alumnoNombre: "SOFÍA PERALTA",
      cursoId: "cur_demo_1",
      cursoNombre: "Danza Contemporánea Juvenil / Adultos",
      concepto: `Cuota ${ym} · Danza Contemporánea`,
      fechaPago: today,
      importe: 32000,
      medioPago: "efectivo",
      referencia: "CAJA LOCAL",
      canal: "presencial",
      cobradoPor: "Recepción",
      observaciones: "Cobro presencial en el local",
      createdAt: nowIso,
    },
    {
      id: "pag_demo_2",
      reciboNumero: "REC-AC-00002",
      cuotaId: "cuo_demo_3",
      alumnoId: "alu_demo_3",
      alumnoNombre: "MATÍAS ROLDÁN",
      cursoId: "cur_demo_2",
      cursoNombre: "Diplomatura Práctica en Gestión Comercial y Ventas",
      concepto: `Cuota ${ym} · Diplomatura Gestión Comercial`,
      fechaPago: today,
      importe: 48000,
      medioPago: "transferencia",
      referencia: "COMP #84920",
      canal: "presencial",
      cobradoPor: "Administración",
      observaciones: "",
      createdAt: nowIso,
    },
  ];

  db.materiales = [
    {
      id: "mat_demo_1",
      cursoId: "cur_demo_2",
      cursoNombre: "Diplomatura Práctica en Gestión Comercial y Ventas",
      titulo: "Aula Virtual Google Classroom — Guías y Casos Prácticos",
      tipo: "classroom",
      url: "https://classroom.google.com/c/demo-negocios-01",
      descripcion: "Ingresar con código NEG2026 para descargar consignas semanales.",
      fechaPublicacion: today,
      publicadoPor: "LIC. MARCOS FERREYRA",
    },
  ];

  db.clasesOnline = [
    {
      id: "cls_demo_1",
      cursoId: "cur_demo_2",
      cursoNombre: "Diplomatura Práctica en Gestión Comercial y Ventas",
      titulo: "Encuentro en Vivo #1 — Estructura de Costos y Margen",
      fecha: today,
      horaInicio: "20:00",
      duracionMin: 90,
      plataforma: "daily",
      roomName: `ms-academia-${tenant.slug}-neg-01`,
      roomUrlHost: "",
      roomUrlAlumno: "",
      providerMode: "daily_sandbox",
      estado: "programada",
      grabacionUrl: "",
      docenteNombre: "LIC. MARCOS FERREYRA",
      asistentesCount: 0,
      createdBy: "demo",
      createdAt: nowIso,
    },
  ];

  db.seqInscripcion = 4;
  db.seqCuota = 4;
  db.seqRecibo = 3;
  db.seqCertificado = 1;
  return db;
}

async function createDailyMultiuserRoom(params: {
  tenantSlug: string;
  roomCode: string;
  hostName: string;
  durationMin: number;
  dailyDomain?: string;
}): Promise<{
  providerMode: "daily_api" | "daily_sandbox";
  roomName: string;
  roomUrlHost: string;
  roomUrlAlumno: string;
}> {
  const safeRoomSlug = `ms-acad-${params.tenantSlug}-${params.roomCode}`
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .toLowerCase()
    .slice(0, 48);

  const durationMinutes = Math.max(15, Math.min(300, Number(params.durationMin) || 90));
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + (durationMinutes + 180) * 60;
  const dailyApiKey = (process.env.DAILY_API_KEY || "").trim();

  if (dailyApiKey) {
    try {
      let roomUrl = "";
      let roomName = safeRoomSlug;

      const getRes = await fetch(`https://api.daily.co/v1/rooms/${safeRoomSlug}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${dailyApiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (getRes.ok) {
        const existing = await getRes.json();
        roomUrl = String(existing.url || "");
        roomName = String(existing.name || safeRoomSlug);
      } else {
        const createRes = await fetch("https://api.daily.co/v1/rooms", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${dailyApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: safeRoomSlug,
            privacy: "public",
            properties: {
              exp: expSec,
              max_participants: 50,
              enable_chat: true,
              enable_screenshare: true,
              enable_knocking: true,
              enable_prejoin_ui: true,
              lang: "es",
            },
          }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          roomUrl = String(created.url || "");
          roomName = String(created.name || safeRoomSlug);
        }
      }

      if (roomUrl) {
        let hostUrl = roomUrl;
        const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${dailyApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            properties: {
              room_name: roomName,
              user_name: `${params.hostName || "Docente"} (Docente)`,
              is_owner: true,
              enable_screenshare: true,
              exp: expSec,
            },
          }),
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData?.token) {
            hostUrl = `${roomUrl}?t=${tokenData.token}`;
          }
        }
        return {
          providerMode: "daily_api",
          roomName,
          roomUrlHost: hostUrl,
          roomUrlAlumno: roomUrl,
        };
      }
    } catch {
      // Fallback a sala sandbox
    }
  }

  const domain = (params.dailyDomain || "minisistema.daily.co")
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  const baseUrl = `https://${domain}/${safeRoomSlug}`;
  const sig = crypto
    .createHash("sha256")
    .update(`${safeRoomSlug}:${nowSec}`)
    .digest("hex")
    .slice(0, 12);
  return {
    providerMode: "daily_sandbox",
    roomName: safeRoomSlug,
    roomUrlHost: `${baseUrl}?role=docente&sig=${sig}`,
    roomUrlAlumno: `${baseUrl}?role=alumno`,
  };
}

export async function loadAcademiasDb(tenant: ErpTenantRecord): Promise<AcademiasDatabase> {
  const { payload } = await getTenantDoc<AnyObj>(
    tenant,
    ACADEMIAS_DOC_KEY,
    buildCleanAcademiasDb(tenant)
  );
  return normalizeDb(payload, tenant);
}

export async function handleErpAcademias(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": req.headers.get("origin") || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-ERP-User, X-ERP-Tenant",
  };

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  const db = await loadAcademiasDb(tenant);

  if (req.method === "GET") {
    const action = String(req.nextUrl.searchParams.get("action") || "all").trim();

    if (action === "public_info") {
      const publicCourses = db.cursos
        .filter((c) => c.activo)
        .map((c) => {
          const ocupados = db.inscripciones.filter(
            (i) => i.cursoId === c.id && i.estado === "activa"
          ).length;
          return {
            id: c.id,
            codigo: c.codigo,
            nombre: c.nombre,
            categoria: c.categoria,
            nivel: c.nivel,
            modalidad: c.modalidad,
            docenteNombre: c.docenteNombre,
            diasHorarios: c.diasHorarios,
            aulaSala: c.aulaSala,
            cupoMaximo: c.cupoMaximo,
            cupoDisponible: Math.max(0, c.cupoMaximo - ocupados),
            arancelMatricula: c.arancelMatricula,
            arancelCuotaMensual: c.arancelCuotaMensual,
            duracionMeses: c.duracionMeses,
            cargaHorariaHs: c.cargaHorariaHs,
          };
        });
      return NextResponse.json(
        {
          ok: true,
          tenantSlug: tenant.slug,
          businessName: db.config.nombreAcademia || tenant.fantasy_name,
          logoUrl: db.config.logoUrl || tenant.branding.logo1x1Url,
          primaryHex: tenant.branding.primaryHex,
          accentHex: tenant.branding.accentHex,
          direccion: db.config.direccion,
          localidad: db.config.localidad,
          whatsapp: db.config.whatsapp,
          inscripcionPublicaWeb: Boolean(db.config.opcionales.inscripcionPublicaWeb),
          fichaSaludAptoFisico: Boolean(db.config.opcionales.fichaSaludAptoFisico),
          reglamentoInterno: db.config.reglamentoInterno,
          cursos: publicCourses,
        },
        { headers: corsHeaders }
      );
    }

    if (action === "verify_certificate") {
      const code = String(req.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
      const hit = db.certificados.find(
        (c) => String(c.codigoVerificacion || "").toUpperCase() === code
      );
      if (!hit) {
        return NextResponse.json(
          { ok: false, message: "No se encontró un certificado válido con ese código." },
          { status: 404, headers: corsHeaders }
        );
      }
      return NextResponse.json(
        {
          ok: true,
          academia: db.config.nombreAcademia || tenant.fantasy_name,
          certificado: hit,
        },
        { headers: corsHeaders }
      );
    }

    const empleadosAsistencia = await listEmpleadosFromAsistencia(tenant);
    return NextResponse.json(
      {
        ok: true,
        tenantSlug: tenant.slug,
        db,
        summary: buildDashboardSummary(db),
        empleadosAsistencia,
      },
      { headers: corsHeaders }
    );
  }

  if (req.method === "POST") {
    const body = ((await req.json().catch(() => null)) || null) as AnyObj | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, message: "Payload JSON inválido." },
        { status: 400, headers: corsHeaders }
      );
    }

    const action = String(body.action || "").trim();
    const actor = String(body.usuario || body.actor || req.headers.get("x-erp-user") || "sistema");

    const saveAndReply = async (tag: string, extra: AnyObj = {}) => {
      db.updatedAt = new Date().toISOString();
      await putTenantDoc(tenant, ACADEMIAS_DOC_KEY, db, actor, tag);
      return NextResponse.json(
        {
          ok: true,
          db,
          summary: buildDashboardSummary(db),
          ...extra,
        },
        { headers: corsHeaders }
      );
    };

    // 1. CONFIGURACIÓN Y OPCIONALES
    if (action === "save_config") {
      const cfgIn = (body.config || body) as AnyObj;
      const optIn = cfgIn.opcionales && typeof cfgIn.opcionales === "object" ? cfgIn.opcionales : {};
      db.config = {
        ...db.config,
        nombreAcademia: String(cfgIn.nombreAcademia ?? db.config.nombreAcademia).trim() || db.config.nombreAcademia,
        tipoNegocio: (cfgIn.tipoNegocio || db.config.tipoNegocio) as AcademiaConfig["tipoNegocio"],
        logoUrl: String(cfgIn.logoUrl ?? db.config.logoUrl).trim(),
        direccion: String(cfgIn.direccion ?? db.config.direccion).trim(),
        localidad: String(cfgIn.localidad ?? db.config.localidad).trim(),
        whatsapp: String(cfgIn.whatsapp ?? db.config.whatsapp).trim(),
        email: String(cfgIn.email ?? db.config.email).trim(),
        diaVencimientoCuota: Math.min(28, Math.max(1, Number(cfgIn.diaVencimientoCuota ?? db.config.diaVencimientoCuota) || 10)),
        recargoMoraPct: Math.max(0, round2(cfgIn.recargoMoraPct ?? db.config.recargoMoraPct)),
        asistenciaMinimaCertificadoPct: Math.min(
          100,
          Math.max(0, Number(cfgIn.asistenciaMinimaCertificadoPct ?? db.config.asistenciaMinimaCertificadoPct) || 75)
        ),
        firmante1Nombre: String(cfgIn.firmante1Nombre ?? db.config.firmante1Nombre).trim(),
        firmante1Cargo: String(cfgIn.firmante1Cargo ?? db.config.firmante1Cargo).trim(),
        firmante2Nombre: String(cfgIn.firmante2Nombre ?? db.config.firmante2Nombre).trim(),
        firmante2Cargo: String(cfgIn.firmante2Cargo ?? db.config.firmante2Cargo).trim(),
        textoCertificado: String(cfgIn.textoCertificado ?? db.config.textoCertificado).trim(),
        reglamentoInterno: String(cfgIn.reglamentoInterno ?? db.config.reglamentoInterno).trim(),
        dailyDomain: String(cfgIn.dailyDomain ?? db.config.dailyDomain).trim(),
        opcionales: {
          ...db.config.opcionales,
          ...optIn,
        },
      };
      return saveAndReply("academia_save_config", { message: "Configuración guardada correctamente." });
    }

    // 2. CARGAR DATOS DE EJEMPLO / LIMPIAR
    if (action === "load_demo") {
      const demo = buildDemoAcademiasDb(tenant);
      Object.assign(db, demo);
      return saveAndReply("academia_load_demo", {
        message: "Datos de ejemplo cargados (Danza + Escuela de Negocios + Cuotas + Asistencia + Sala Online).",
      });
    }

    if (action === "reset_empty") {
      const clean = buildCleanAcademiasDb(tenant);
      clean.config = db.config;
      Object.assign(db, clean);
      return saveAndReply("academia_reset_empty", {
        message: "Base de academia vaciada conservando tu configuración.",
      });
    }

    // 3. DOCENTES (ABM + VINCULACIÓN CON PERSONAL)
    if (action === "save_docente") {
      const dIn = (body.docente || body) as AnyObj;
      const nombre = String(dIn.nombre || "").trim().toUpperCase();
      if (!nombre) {
        return NextResponse.json(
          { ok: false, message: "El nombre del docente es obligatorio." },
          { status: 400, headers: corsHeaders }
        );
      }
      const nowIso = new Date().toISOString();
      const id = String(dIn.id || "").trim() || uid("doc");
      const idx = db.docentes.findIndex((x) => x.id === id);
      const prev = idx >= 0 ? db.docentes[idx] : null;
      const rec: AcademiaDocente = {
        id,
        empleadoAsistenciaId: dIn.empleadoAsistenciaId ? String(dIn.empleadoAsistenciaId) : prev?.empleadoAsistenciaId || null,
        nombre,
        dni: String(dIn.dni ?? prev?.dni ?? "").trim(),
        especialidad: String(dIn.especialidad ?? prev?.especialidad ?? "").trim(),
        whatsapp: String(dIn.whatsapp ?? prev?.whatsapp ?? "").trim(),
        email: String(dIn.email ?? prev?.email ?? "").trim(),
        esquemaHonorarios: (dIn.esquemaHonorarios || prev?.esquemaHonorarios || "porcentaje") as AcademiaDocente["esquemaHonorarios"],
        valorEsquema: Math.max(0, round2(dIn.valorEsquema ?? prev?.valorEsquema ?? 0)),
        cbuAlias: String(dIn.cbuAlias ?? prev?.cbuAlias ?? "").trim(),
        activo: dIn.activo !== undefined ? Boolean(dIn.activo) : prev ? prev.activo : true,
        notas: String(dIn.notas ?? prev?.notas ?? "").trim(),
        createdAt: prev?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      if (idx >= 0) db.docentes[idx] = rec;
      else db.docentes.push(rec);
      return saveAndReply("academia_save_docente", { docente: rec, message: "Docente guardado." });
    }

    if (action === "delete_docente") {
      const id = String(body.id || "").trim();
      db.docentes = db.docentes.filter((d) => d.id !== id);
      return saveAndReply("academia_delete_docente", { message: "Docente eliminado." });
    }

    // 4. CURSOS, COMISIONES Y HORARIOS
    if (action === "save_curso") {
      const cIn = (body.curso || body) as AnyObj;
      const nombre = String(cIn.nombre || "").trim();
      if (!nombre) {
        return NextResponse.json(
          { ok: false, message: "El nombre del curso/comisión es obligatorio." },
          { status: 400, headers: corsHeaders }
        );
      }
      const nowIso = new Date().toISOString();
      const id = String(cIn.id || "").trim() || uid("cur");
      const idx = db.cursos.findIndex((x) => x.id === id);
      const prev = idx >= 0 ? db.cursos[idx] : null;
      const docId = String(cIn.docenteId ?? prev?.docenteId ?? "").trim();
      const docObj = db.docentes.find((d) => d.id === docId);
      const rec: AcademiaCurso = {
        id,
        codigo:
          String(cIn.codigo ?? prev?.codigo ?? "").trim().toUpperCase() ||
          `CUR-${String(db.cursos.length + 1).padStart(2, "0")}`,
        nombre,
        categoria: String(cIn.categoria ?? prev?.categoria ?? "General").trim(),
        nivel: String(cIn.nivel ?? prev?.nivel ?? "Todos los niveles").trim(),
        modalidad: (cIn.modalidad || prev?.modalidad || "presencial") as AcademiaCurso["modalidad"],
        docenteId: docId,
        docenteNombre: docObj?.nombre || String(cIn.docenteNombre ?? prev?.docenteNombre ?? "").trim(),
        diasHorarios: String(cIn.diasHorarios ?? prev?.diasHorarios ?? "").trim(),
        aulaSala: String(cIn.aulaSala ?? prev?.aulaSala ?? "").trim(),
        cupoMaximo: Math.max(1, Math.floor(Number(cIn.cupoMaximo ?? prev?.cupoMaximo ?? 25) || 25)),
        arancelMatricula: Math.max(0, round2(cIn.arancelMatricula ?? prev?.arancelMatricula ?? 0)),
        arancelCuotaMensual: Math.max(0, round2(cIn.arancelCuotaMensual ?? prev?.arancelCuotaMensual ?? 0)),
        duracionMeses: Math.max(1, Math.floor(Number(cIn.duracionMeses ?? prev?.duracionMeses ?? 1) || 1)),
        cargaHorariaHs: Math.max(0, round2(cIn.cargaHorariaHs ?? prev?.cargaHorariaHs ?? 0)),
        fechaInicio: String(cIn.fechaInicio ?? prev?.fechaInicio ?? todayIso()).trim(),
        fechaFin: String(cIn.fechaFin ?? prev?.fechaFin ?? "").trim(),
        classroomUrl: String(cIn.classroomUrl ?? prev?.classroomUrl ?? "").trim(),
        classroomCodigo: String(cIn.classroomCodigo ?? prev?.classroomCodigo ?? "").trim().toUpperCase(),
        dailyRoomUrl: String(cIn.dailyRoomUrl ?? prev?.dailyRoomUrl ?? "").trim(),
        activo: cIn.activo !== undefined ? Boolean(cIn.activo) : prev ? prev.activo : true,
        notas: String(cIn.notas ?? prev?.notas ?? "").trim(),
        createdAt: prev?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      if (idx >= 0) db.cursos[idx] = rec;
      else db.cursos.push(rec);
      return saveAndReply("academia_save_curso", { curso: rec, message: "Curso / comisión guardado." });
    }

    if (action === "delete_curso") {
      const id = String(body.id || "").trim();
      db.cursos = db.cursos.filter((c) => c.id !== id);
      return saveAndReply("academia_delete_curso", { message: "Curso eliminado." });
    }

    // 5. FORMULARIO DE INSCRIPCIÓN CON ENVÍO AUTOMÁTICO A LAS 3 PLANILLAS:
    //    (1) Base General de Alumnos + (2) Planilla de Asistencias + (3) Control de Cuotas
    //    (+ sincronización opcional automática con Clientes/Cta.Cte. ERP)
    if (action === "inscribir_alumno" || action === "public_inscribir") {
      const isPublic = action === "public_inscribir";
      if (isPublic && !db.config.opcionales.inscripcionPublicaWeb) {
        return NextResponse.json(
          { ok: false, message: "La inscripción online pública no está habilitada para esta academia." },
          { status: 403, headers: corsHeaders }
        );
      }

      const f = (body.inscripcion || body) as AnyObj;
      const nombre = String(f.nombre || f.alumnoNombre || "").trim().toUpperCase();
      const dni = String(f.dni || "").replace(/\D/g, "");
      const cursoId = String(f.cursoId || "").trim();
      if (!nombre) {
        return NextResponse.json(
          { ok: false, message: "El nombre y apellido del alumno son obligatorios." },
          { status: 400, headers: corsHeaders }
        );
      }
      const curso = db.cursos.find((c) => c.id === cursoId);
      if (!curso) {
        return NextResponse.json(
          { ok: false, message: "Seleccioná un curso o comisión válida." },
          { status: 400, headers: corsHeaders }
        );
      }

      const ocupados = db.inscripciones.filter(
        (i) => i.cursoId === curso.id && i.estado === "activa"
      ).length;
      if (ocupados >= curso.cupoMaximo && !f.forzarCupo) {
        return NextResponse.json(
          {
            ok: false,
            message: `El curso "${curso.nombre}" alcanzó su cupo máximo (${curso.cupoMaximo} alumnos).`,
          },
          { status: 400, headers: corsHeaders }
        );
      }

      const nowIso = new Date().toISOString();
      const today = todayIso();

      // (1) BASE GENERAL DE ALUMNOS: buscar existente por ID o DNI o crear nuevo
      let alumno =
        (f.alumnoId ? db.alumnos.find((a) => a.id === String(f.alumnoId)) : undefined) ||
        (dni.length >= 6
          ? db.alumnos.find((a) => String(a.dni || "").replace(/\D/g, "") === dni)
          : undefined);

      if (!alumno) {
        alumno = {
          id: uid("alu"),
          legajo: padNum("ALU", db.alumnos.length + 1, 4),
          clienteId: null,
          nombre,
          dni,
          fechaNacimiento: String(f.fechaNacimiento || "").trim(),
          whatsapp: String(f.whatsapp || "").trim(),
          email: String(f.email || "").trim(),
          domicilio: String(f.domicilio || "").trim(),
          tutorNombre: String(f.tutorNombre || "").trim().toUpperCase(),
          tutorWhatsapp: String(f.tutorWhatsapp || "").trim(),
          contactoEmergencia: String(f.contactoEmergencia || "").trim(),
          aptoFisicoOk: Boolean(f.aptoFisicoOk),
          aptoFisicoVencimiento: String(f.aptoFisicoVencimiento || "").trim(),
          observacionesSalud: String(f.observacionesSalud || "").trim(),
          estado: "activo",
          origen: isPublic ? "web" : "presencial",
          notas: String(f.notas || "").trim(),
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        db.alumnos.unshift(alumno);
      } else {
        alumno.nombre = nombre || alumno.nombre;
        if (f.whatsapp) alumno.whatsapp = String(f.whatsapp).trim();
        if (f.email) alumno.email = String(f.email).trim();
        if (f.domicilio) alumno.domicilio = String(f.domicilio).trim();
        if (f.tutorNombre !== undefined && String(f.tutorNombre).trim()) {
          alumno.tutorNombre = String(f.tutorNombre).trim().toUpperCase();
        }
        if (f.tutorWhatsapp !== undefined && String(f.tutorWhatsapp).trim()) {
          alumno.tutorWhatsapp = String(f.tutorWhatsapp).trim();
        }
        if (f.contactoEmergencia !== undefined && String(f.contactoEmergencia).trim()) {
          alumno.contactoEmergencia = String(f.contactoEmergencia).trim();
        }
        if (f.aptoFisicoOk !== undefined) alumno.aptoFisicoOk = Boolean(f.aptoFisicoOk);
        if (f.observacionesSalud !== undefined && String(f.observacionesSalud).trim()) {
          alumno.observacionesSalud = String(f.observacionesSalud).trim();
        }
        alumno.estado = "activo";
        alumno.updatedAt = nowIso;
      }

      if (db.config.opcionales.integrarClientesCtaCte) {
        alumno.clienteId = await syncAlumnoToClientesErp(tenant, alumno, actor);
      }

      // Evitar doble inscripción activa en el mismo curso
      const dupInsc = db.inscripciones.find(
        (i) => i.alumnoId === alumno!.id && i.cursoId === curso.id && i.estado === "activa"
      );
      if (dupInsc) {
        return NextResponse.json(
          {
            ok: false,
            message: `${alumno.nombre} ya tiene una inscripción activa en "${curso.nombre}".`,
          },
          { status: 400, headers: corsHeaders }
        );
      }

      const becaPct = Math.min(100, Math.max(0, round2(f.becaPct ?? 0)));
      const cuotaBase = round2(
        f.cuotaAcordada !== undefined && f.cuotaAcordada !== ""
          ? Number(f.cuotaAcordada)
          : curso.arancelCuotaMensual
      );
      const descuentoBeca = round2((cuotaBase * becaPct) / 100);
      const cuotaFinal = Math.max(0, round2(cuotaBase - descuentoBeca));
      const matriculaImp = Math.max(
        0,
        round2(
          f.matriculaImporte !== undefined && f.matriculaImporte !== ""
            ? Number(f.matriculaImporte)
            : curso.arancelMatricula
        )
      );
      const cobrarMatriculaAhora = Boolean(f.cobrarMatriculaAhora) && matriculaImp > 0 && !isPublic;

      const insc: AcademiaInscripcion = {
        id: uid("ins"),
        numero: padNum("INS", db.seqInscripcion++),
        alumnoId: alumno.id,
        alumnoNombre: alumno.nombre,
        alumnoDni: alumno.dni,
        cursoId: curso.id,
        cursoNombre: curso.nombre,
        fechaInscripcion: today,
        becaPct,
        cuotaAcordada: cuotaFinal,
        matriculaImporte: matriculaImp,
        matriculaPagada: cobrarMatriculaAhora,
        estado: "activa",
        notas: String(f.notas || "").trim(),
        createdBy: isPublic ? "inscripcion_web" : actor,
        createdAt: nowIso,
      };
      db.inscripciones.unshift(insc);

      // (2) PLANILLA DE ASISTENCIAS: asegurar inclusión inmediata en la sesión de hoy si ya existiera
      const todaySes = db.asistencias.find((s) => s.cursoId === curso.id && s.fecha === today);
      if (todaySes && !todaySes.registros[alumno.id]) {
        todaySes.registros[alumno.id] = "P";
        todaySes.updatedAt = nowIso;
      }

      // (3) CONTROL DE CUOTAS: crear automáticamente Matrícula (si corresponde) y Primera Cuota del período
      const generatedCuotas: AcademiaCuota[] = [];
      const createdPagos: AcademiaPagoRegistro[] = [];

      if (matriculaImp > 0) {
        const reciboMat = cobrarMatriculaAhora ? padNum("REC-AC", db.seqRecibo++) : "";
        const cuoMat: AcademiaCuota = {
          id: uid("cuo"),
          numero: padNum("CUO", db.seqCuota++),
          inscripcionId: insc.id,
          alumnoId: alumno.id,
          alumnoNombre: alumno.nombre,
          alumnoWhatsapp: alumno.whatsapp || alumno.tutorWhatsapp || "",
          cursoId: curso.id,
          cursoNombre: curso.nombre,
          periodo: "MATRICULA",
          concepto: `Matrícula · ${curso.nombre}`,
          fechaVencimiento: today,
          importeOriginal: matriculaImp,
          descuentoBeca: 0,
          recargoMora: 0,
          importeTotal: matriculaImp,
          importePagado: cobrarMatriculaAhora ? matriculaImp : 0,
          saldoPendiente: cobrarMatriculaAhora ? 0 : matriculaImp,
          estado: cobrarMatriculaAhora ? "pagada" : "pendiente",
          ultimoPagoFecha: cobrarMatriculaAhora ? today : "",
          ultimoReciboNumero: reciboMat,
          mpPaymentLink: "",
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        db.cuotas.unshift(cuoMat);
        generatedCuotas.push(cuoMat);

        if (cobrarMatriculaAhora) {
          const pagoMat: AcademiaPagoRegistro = {
            id: uid("pag"),
            reciboNumero: reciboMat,
            cuotaId: cuoMat.id,
            alumnoId: alumno.id,
            alumnoNombre: alumno.nombre,
            cursoId: curso.id,
            cursoNombre: curso.nombre,
            concepto: cuoMat.concepto,
            fechaPago: today,
            importe: matriculaImp,
            medioPago: (f.medioPagoInicial || "efectivo") as AcademiaMedioPago,
            referencia: String(f.referenciaPago || "INSCRIPCIÓN PRESENCIAL").trim(),
            canal: "presencial",
            cobradoPor: actor,
            observaciones: "Cobrado al momento de la inscripción",
            createdAt: nowIso,
          };
          db.pagos.unshift(pagoMat);
          createdPagos.push(pagoMat);
        }
      }

      const generarPrimeraCuota = f.generarPrimeraCuota !== false;
      if (generarPrimeraCuota && cuotaBase > 0) {
        const periodo = String(f.periodoInicial || currentPeriodYm()).trim();
        const cobrarCuotaAhora = Boolean(f.cobrarPrimeraCuotaAhora) && cuotaFinal > 0 && !isPublic;
        const reciboCuo = cobrarCuotaAhora ? padNum("REC-AC", db.seqRecibo++) : "";
        const cuoMes: AcademiaCuota = {
          id: uid("cuo"),
          numero: padNum("CUO", db.seqCuota++),
          inscripcionId: insc.id,
          alumnoId: alumno.id,
          alumnoNombre: alumno.nombre,
          alumnoWhatsapp: alumno.whatsapp || alumno.tutorWhatsapp || "",
          cursoId: curso.id,
          cursoNombre: curso.nombre,
          periodo,
          concepto: `Cuota ${periodo} · ${curso.nombre}`,
          fechaVencimiento: buildDueDateForPeriod(periodo, db.config.diaVencimientoCuota),
          importeOriginal: cuotaBase,
          descuentoBeca,
          recargoMora: 0,
          importeTotal: cuotaFinal,
          importePagado: cobrarCuotaAhora ? cuotaFinal : 0,
          saldoPendiente: cuotaFinal === 0 ? 0 : cobrarCuotaAhora ? 0 : cuotaFinal,
          estado: cuotaFinal === 0 ? "bonificada" : cobrarCuotaAhora ? "pagada" : "pendiente",
          ultimoPagoFecha: cobrarCuotaAhora ? today : "",
          ultimoReciboNumero: reciboCuo,
          mpPaymentLink: "",
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        db.cuotas.unshift(cuoMes);
        generatedCuotas.push(cuoMes);

        if (cobrarCuotaAhora) {
          const pagoCuo: AcademiaPagoRegistro = {
            id: uid("pag"),
            reciboNumero: reciboCuo,
            cuotaId: cuoMes.id,
            alumnoId: alumno.id,
            alumnoNombre: alumno.nombre,
            cursoId: curso.id,
            cursoNombre: curso.nombre,
            concepto: cuoMes.concepto,
            fechaPago: today,
            importe: cuotaFinal,
            medioPago: (f.medioPagoInicial || "efectivo") as AcademiaMedioPago,
            referencia: String(f.referenciaPago || "INSCRIPCIÓN PRESENCIAL").trim(),
            canal: "presencial",
            cobradoPor: actor,
            observaciones: "Primera cuota abonada en inscripción",
            createdAt: nowIso,
          };
          db.pagos.unshift(pagoCuo);
          createdPagos.push(pagoCuo);
        }
      }

      return saveAndReply("academia_inscribir_alumno", {
        alumno,
        inscripcion: insc,
        cuotasGeneradas: generatedCuotas,
        pagosRegistrados: createdPagos,
        message: `Inscripción ${insc.numero} registrada y sincronizada en Base General, Planilla de Asistencias y Control de Cuotas.`,
      });
    }

    // 6. EDITAR / ACTUALIZAR ALUMNO EN BASE GENERAL
    if (action === "save_alumno") {
      const aIn = (body.alumno || body) as AnyObj;
      const id = String(aIn.id || "").trim();
      const idx = db.alumnos.findIndex((a) => a.id === id);
      if (idx < 0) {
        return NextResponse.json(
          { ok: false, message: "Alumno no encontrado." },
          { status: 404, headers: corsHeaders }
        );
      }
      const prev = db.alumnos[idx];
      const updated: AcademiaAlumno = {
        ...prev,
        nombre: String(aIn.nombre ?? prev.nombre).trim().toUpperCase(),
        dni: String(aIn.dni ?? prev.dni).replace(/\D/g, ""),
        fechaNacimiento: String(aIn.fechaNacimiento ?? prev.fechaNacimiento).trim(),
        whatsapp: String(aIn.whatsapp ?? prev.whatsapp).trim(),
        email: String(aIn.email ?? prev.email).trim(),
        domicilio: String(aIn.domicilio ?? prev.domicilio).trim(),
        tutorNombre: String(aIn.tutorNombre ?? prev.tutorNombre).trim().toUpperCase(),
        tutorWhatsapp: String(aIn.tutorWhatsapp ?? prev.tutorWhatsapp).trim(),
        contactoEmergencia: String(aIn.contactoEmergencia ?? prev.contactoEmergencia).trim(),
        aptoFisicoOk: aIn.aptoFisicoOk !== undefined ? Boolean(aIn.aptoFisicoOk) : prev.aptoFisicoOk,
        aptoFisicoVencimiento: String(aIn.aptoFisicoVencimiento ?? prev.aptoFisicoVencimiento).trim(),
        observacionesSalud: String(aIn.observacionesSalud ?? prev.observacionesSalud).trim(),
        estado: (aIn.estado || prev.estado) as AcademiaAlumno["estado"],
        notas: String(aIn.notas ?? prev.notas).trim(),
        updatedAt: new Date().toISOString(),
      };
      db.alumnos[idx] = updated;
      // Propagar nombre/whatsapp actualizado a inscripciones y cuotas abiertas
      for (const ins of db.inscripciones) {
        if (ins.alumnoId === updated.id) {
          ins.alumnoNombre = updated.nombre;
          ins.alumnoDni = updated.dni;
        }
      }
      for (const cuo of db.cuotas) {
        if (cuo.alumnoId === updated.id) {
          cuo.alumnoNombre = updated.nombre;
          cuo.alumnoWhatsapp = updated.whatsapp || updated.tutorWhatsapp || "";
        }
      }
      if (db.config.opcionales.integrarClientesCtaCte) {
        updated.clienteId = await syncAlumnoToClientesErp(tenant, updated, actor);
      }
      return saveAndReply("academia_save_alumno", { alumno: updated, message: "Ficha del alumno actualizada." });
    }

    if (action === "update_inscripcion_estado") {
      const id = String(body.id || "").trim();
      const estado = String(body.estado || "activa").trim() as AcademiaInscripcion["estado"];
      const ins = db.inscripciones.find((x) => x.id === id);
      if (!ins) {
        return NextResponse.json(
          { ok: false, message: "Inscripción no encontrada." },
          { status: 404, headers: corsHeaders }
        );
      }
      ins.estado = estado;
      return saveAndReply("academia_update_inscripcion", {
        inscripcion: ins,
        message: `Inscripción ${ins.numero} marcada como ${estado.toUpperCase()}.`,
      });
    }

    // 7. PLANILLA DE ASISTENCIAS
    if (action === "save_asistencia") {
      const sIn = (body.sesion || body) as AnyObj;
      const cursoId = String(sIn.cursoId || "").trim();
      const fecha = String(sIn.fecha || todayIso()).trim();
      const curso = db.cursos.find((c) => c.id === cursoId);
      if (!curso) {
        return NextResponse.json(
          { ok: false, message: "Seleccioná un curso válido para registrar asistencia." },
          { status: 400, headers: corsHeaders }
        );
      }
      const rawRegs = sIn.registros && typeof sIn.registros === "object" ? sIn.registros : {};
      const cleanRegs: Record<string, AcademiaEstadoAsistencia> = {};
      for (const [aid, val] of Object.entries(rawRegs)) {
        const v = String(val || "").toUpperCase();
        if (v === "P" || v === "A" || v === "T" || v === "J") {
          cleanRegs[aid] = v;
        }
      }
      const nowIso = new Date().toISOString();
      const idx = db.asistencias.findIndex(
        (s) => s.cursoId === curso.id && s.fecha === fecha
      );
      const ses: AcademiaAsistenciaSesion = {
        id: idx >= 0 ? db.asistencias[idx].id : uid("asi"),
        cursoId: curso.id,
        cursoNombre: curso.nombre,
        fecha,
        temaClase: String(sIn.temaClase || "").trim(),
        modalidadSesion: sIn.modalidadSesion === "online" ? "online" : "presencial",
        docenteId: curso.docenteId,
        docenteNombre: curso.docenteNombre,
        registros: cleanRegs,
        observaciones: String(sIn.observaciones || "").trim(),
        updatedBy: actor,
        updatedAt: nowIso,
      };
      if (idx >= 0) db.asistencias[idx] = ses;
      else db.asistencias.unshift(ses);
      return saveAndReply("academia_save_asistencia", {
        sesion: ses,
        message: `Asistencia de "${curso.nombre}" (${fecha}) guardada.`,
      });
    }

    // 8. CONTROL DE CUOTAS Y COBRANZAS PRESENCIALES / ONLINE
    if (action === "generar_cuotas_mes") {
      const periodo = String(body.periodo || currentPeriodYm()).trim();
      const cursoFilter = String(body.cursoId || "").trim();
      const nowIso = new Date().toISOString();
      const dueDate = buildDueDateForPeriod(periodo, db.config.diaVencimientoCuota);
      let createdCount = 0;

      for (const ins of db.inscripciones) {
        if (ins.estado !== "activa") continue;
        if (cursoFilter && ins.cursoId !== cursoFilter) continue;
        const curso = db.cursos.find((c) => c.id === ins.cursoId);
        if (!curso || !curso.activo) continue;
        const alumno = db.alumnos.find((a) => a.id === ins.alumnoId);
        if (!alumno || alumno.estado !== "activo") continue;

        const exists = db.cuotas.some(
          (q) =>
            q.inscripcionId === ins.id &&
            q.periodo === periodo &&
            q.estado !== "anulada"
        );
        if (exists) continue;

        const base = round2(curso.arancelCuotaMensual);
        const becaDesc = round2((base * Number(ins.becaPct || 0)) / 100);
        const total = Math.max(0, round2(ins.cuotaAcordada || base - becaDesc));
        const cuo: AcademiaCuota = {
          id: uid("cuo"),
          numero: padNum("CUO", db.seqCuota++),
          inscripcionId: ins.id,
          alumnoId: alumno.id,
          alumnoNombre: alumno.nombre,
          alumnoWhatsapp: alumno.whatsapp || alumno.tutorWhatsapp || "",
          cursoId: curso.id,
          cursoNombre: curso.nombre,
          periodo,
          concepto: `Cuota ${periodo} · ${curso.nombre}`,
          fechaVencimiento: dueDate,
          importeOriginal: base,
          descuentoBeca: becaDesc,
          recargoMora: 0,
          importeTotal: total,
          importePagado: 0,
          saldoPendiente: total,
          estado: total <= 0 ? "bonificada" : "pendiente",
          ultimoPagoFecha: "",
          ultimoReciboNumero: "",
          mpPaymentLink: "",
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        db.cuotas.unshift(cuo);
        createdCount++;
      }

      return saveAndReply("academia_generar_cuotas", {
        createdCount,
        message:
          createdCount > 0
            ? `Se generaron ${createdCount} cuota(s) para el período ${periodo}.`
            : `Todas las cuotas activas del período ${periodo} ya estaban generadas.`,
      });
    }

    if (action === "registrar_pago") {
      const pIn = (body.pago || body) as AnyObj;
      const cuotaId = String(pIn.cuotaId || "").trim();
      const cuota = db.cuotas.find((c) => c.id === cuotaId);
      if (!cuota) {
        return NextResponse.json(
          { ok: false, message: "Cuota no encontrada." },
          { status: 404, headers: corsHeaders }
        );
      }
      const recargoExtra = Math.max(0, round2(pIn.recargoMora ?? 0));
      if (recargoExtra > 0) {
        cuota.recargoMora = round2(cuota.recargoMora + recargoExtra);
        cuota.importeTotal = round2(cuota.importeOriginal - cuota.descuentoBeca + cuota.recargoMora);
        cuota.saldoPendiente = Math.max(0, round2(cuota.importeTotal - cuota.importePagado));
      }

      const importe = round2(pIn.importe ?? cuota.saldoPendiente);
      if (importe <= 0) {
        return NextResponse.json(
          { ok: false, message: "El importe a cobrar debe ser mayor a $0." },
          { status: 400, headers: corsHeaders }
        );
      }
      const fechaPago = String(pIn.fechaPago || todayIso()).trim();
      const reciboNumero = padNum("REC-AC", db.seqRecibo++);
      const nowIso = new Date().toISOString();

      const pago: AcademiaPagoRegistro = {
        id: uid("pag"),
        reciboNumero,
        cuotaId: cuota.id,
        alumnoId: cuota.alumnoId,
        alumnoNombre: cuota.alumnoNombre,
        cursoId: cuota.cursoId,
        cursoNombre: cuota.cursoNombre,
        concepto: cuota.concepto,
        fechaPago,
        importe,
        medioPago: (pIn.medioPago || "efectivo") as AcademiaMedioPago,
        referencia: String(pIn.referencia || "").trim(),
        canal: pIn.canal === "online" ? "online" : "presencial",
        cobradoPor: actor,
        observaciones: String(pIn.observaciones || "").trim(),
        createdAt: nowIso,
      };
      db.pagos.unshift(pago);

      cuota.importePagado = round2(cuota.importePagado + importe);
      cuota.saldoPendiente = Math.max(0, round2(cuota.importeTotal - cuota.importePagado));
      cuota.estado = cuota.saldoPendiente <= 0.01 ? "pagada" : "parcial";
      cuota.ultimoPagoFecha = fechaPago;
      cuota.ultimoReciboNumero = reciboNumero;
      cuota.updatedAt = nowIso;

      if (cuota.periodo === "MATRICULA" && cuota.estado === "pagada") {
        const ins = db.inscripciones.find((i) => i.id === cuota.inscripcionId);
        if (ins) ins.matriculaPagada = true;
      }

      return saveAndReply("academia_registrar_pago", {
        pago,
        cuota,
        message: `Cobro registrado (${reciboNumero}) por $${importe.toLocaleString("es-AR")}.`,
      });
    }

    if (action === "anular_cuota") {
      const cuotaId = String(body.cuotaId || body.id || "").trim();
      const cuota = db.cuotas.find((c) => c.id === cuotaId);
      if (!cuota) {
        return NextResponse.json(
          { ok: false, message: "Cuota no encontrada." },
          { status: 404, headers: corsHeaders }
        );
      }
      cuota.estado = "anulada";
      cuota.saldoPendiente = 0;
      cuota.updatedAt = new Date().toISOString();
      return saveAndReply("academia_anular_cuota", { message: `Cuota ${cuota.numero} anulada.` });
    }

    // 9. AULA VIRTUAL (GOOGLE CLASSROOM / MATERIALES) Y CLASES ONLINE MULTIUSUARIO (DAILY.CO)
    if (action === "save_material") {
      const mIn = (body.material || body) as AnyObj;
      const curso = db.cursos.find((c) => c.id === String(mIn.cursoId || ""));
      const titulo = String(mIn.titulo || "").trim();
      if (!curso || !titulo) {
        return NextResponse.json(
          { ok: false, message: "Curso y título del material son obligatorios." },
          { status: 400, headers: corsHeaders }
        );
      }
      const rec: AcademiaMaterialAula = {
        id: String(mIn.id || "").trim() || uid("mat"),
        cursoId: curso.id,
        cursoNombre: curso.nombre,
        titulo,
        tipo: (mIn.tipo || "link") as AcademiaMaterialAula["tipo"],
        url: String(mIn.url || "").trim(),
        descripcion: String(mIn.descripcion || "").trim(),
        fechaPublicacion: todayIso(),
        publicadoPor: actor,
      };
      const idx = db.materiales.findIndex((x) => x.id === rec.id);
      if (idx >= 0) db.materiales[idx] = rec;
      else db.materiales.unshift(rec);
      return saveAndReply("academia_save_material", {
        material: rec,
        message: "Material publicado en el Aula Virtual.",
      });
    }

    if (action === "delete_material") {
      const id = String(body.id || "").trim();
      db.materiales = db.materiales.filter((m) => m.id !== id);
      return saveAndReply("academia_delete_material", { message: "Material eliminado." });
    }

    if (action === "create_online_class") {
      const cIn = (body.clase || body) as AnyObj;
      const curso = db.cursos.find((c) => c.id === String(cIn.cursoId || ""));
      const titulo = String(cIn.titulo || "").trim();
      if (!curso || !titulo) {
        return NextResponse.json(
          { ok: false, message: "Curso y título de la clase online son obligatorios." },
          { status: 400, headers: corsHeaders }
        );
      }
      const plataforma = (cIn.plataforma || "daily") as AcademiaClaseOnline["plataforma"];
      const duracionMin = Math.max(15, Math.min(300, Number(cIn.duracionMin) || 90));
      let roomName = "";
      let roomUrlHost = String(cIn.roomUrl || "").trim();
      let roomUrlAlumno = roomUrlHost;
      let providerMode: AcademiaClaseOnline["providerMode"] = "external_link";

      if (plataforma === "daily") {
        const room = await createDailyMultiuserRoom({
          tenantSlug: tenant.slug,
          roomCode: `${curso.codigo}-${Date.now().toString(36).slice(-4)}`,
          hostName: curso.docenteNombre || actor,
          durationMin: duracionMin,
          dailyDomain: db.config.dailyDomain,
        });
        roomName = room.roomName;
        roomUrlHost = room.roomUrlHost;
        roomUrlAlumno = room.roomUrlAlumno;
        providerMode = room.providerMode;
        curso.dailyRoomUrl = roomUrlAlumno;
      }

      const rec: AcademiaClaseOnline = {
        id: uid("cls"),
        cursoId: curso.id,
        cursoNombre: curso.nombre,
        titulo,
        fecha: String(cIn.fecha || todayIso()).trim(),
        horaInicio: String(cIn.horaInicio || "19:00").trim(),
        duracionMin,
        plataforma,
        roomName,
        roomUrlHost,
        roomUrlAlumno,
        providerMode,
        estado: "programada",
        grabacionUrl: String(cIn.grabacionUrl || "").trim(),
        docenteNombre: curso.docenteNombre || actor,
        asistentesCount: 0,
        createdBy: actor,
        createdAt: new Date().toISOString(),
      };
      db.clasesOnline.unshift(rec);
      return saveAndReply("academia_create_online_class", {
        claseOnline: rec,
        message:
          plataforma === "daily"
            ? `Sala multiusuario Daily.co lista para "${titulo}".`
            : `Clase online "${titulo}" programada.`,
      });
    }

    if (action === "update_online_class") {
      const id = String(body.id || "").trim();
      const cls = db.clasesOnline.find((x) => x.id === id);
      if (!cls) {
        return NextResponse.json(
          { ok: false, message: "Clase online no encontrada." },
          { status: 404, headers: corsHeaders }
        );
      }
      if (body.estado) cls.estado = body.estado;
      if (body.grabacionUrl !== undefined) cls.grabacionUrl = String(body.grabacionUrl).trim();
      if (body.asistentesCount !== undefined) cls.asistentesCount = Math.max(0, Number(body.asistentesCount) || 0);
      return saveAndReply("academia_update_online_class", {
        claseOnline: cls,
        message: "Clase online actualizada.",
      });
    }

    if (action === "delete_online_class") {
      const id = String(body.id || "").trim();
      db.clasesOnline = db.clasesOnline.filter((c) => c.id !== id);
      return saveAndReply("academia_delete_online_class", { message: "Clase online eliminada." });
    }

    // 10. CERTIFICADOS Y DIPLOMAS AUTOMATIZADOS
    if (action === "emitir_certificado") {
      const cIn = (body.certificado || body) as AnyObj;
      const alumno = db.alumnos.find((a) => a.id === String(cIn.alumnoId || ""));
      const curso = db.cursos.find((c) => c.id === String(cIn.cursoId || ""));
      if (!alumno || !curso) {
        return NextResponse.json(
          { ok: false, message: "Seleccioná un alumno y un curso válidos." },
          { status: 400, headers: corsHeaders }
        );
      }
      const att = computeAlumnoAttendancePct(db.asistencias, alumno.id, curso.id);
      const seq = db.seqCertificado++;
      const hash4 = crypto
        .createHash("sha256")
        .update(`${tenant.slug}:${alumno.id}:${curso.id}:${seq}`)
        .digest("hex")
        .slice(0, 4)
        .toUpperCase();
      const code = `CERT-${String(seq).padStart(4, "0")}-${hash4}`;

      const cert: AcademiaCertificado = {
        id: uid("cert"),
        codigoVerificacion: code,
        alumnoId: alumno.id,
        alumnoNombre: alumno.nombre,
        alumnoDni: alumno.dni,
        cursoId: curso.id,
        cursoNombre: curso.nombre,
        cargaHorariaHs: Number(cIn.cargaHorariaHs ?? curso.cargaHorariaHs) || 0,
        asistenciaPct: att.pct,
        fechaEmision: String(cIn.fechaEmision || todayIso()).trim(),
        calificacion: String(cIn.calificacion || "Aprobado").trim(),
        firmante1Nombre: String(cIn.firmante1Nombre || db.config.firmante1Nombre).trim(),
        firmante1Cargo: String(cIn.firmante1Cargo || db.config.firmante1Cargo).trim(),
        firmante2Nombre: String(cIn.firmante2Nombre || curso.docenteNombre || db.config.firmante2Nombre).trim(),
        firmante2Cargo: String(cIn.firmante2Cargo || db.config.firmante2Cargo).trim(),
        textoPersonalizado: String(cIn.textoPersonalizado || db.config.textoCertificado).trim(),
        emitidoPor: actor,
        createdAt: new Date().toISOString(),
      };
      db.certificados.unshift(cert);
      return saveAndReply("academia_emitir_certificado", {
        certificado: cert,
        message: `Certificado ${code} emitido para ${alumno.nombre}.`,
      });
    }

    if (action === "emitir_certificados_lote") {
      const curso = db.cursos.find((c) => c.id === String(body.cursoId || ""));
      if (!curso) {
        return NextResponse.json(
          { ok: false, message: "Curso no encontrado." },
          { status: 404, headers: corsHeaders }
        );
      }
      const minPct = Number(body.minAsistenciaPct ?? db.config.asistenciaMinimaCertificadoPct) || 0;
      const insList = db.inscripciones.filter(
        (i) => i.cursoId === curso.id && (i.estado === "activa" || i.estado === "finalizada")
      );
      let emitted = 0;
      for (const ins of insList) {
        const alumno = db.alumnos.find((a) => a.id === ins.alumnoId);
        if (!alumno) continue;
        const already = db.certificados.some(
          (x) => x.alumnoId === alumno.id && x.cursoId === curso.id
        );
        if (already) continue;
        const att = computeAlumnoAttendancePct(db.asistencias, alumno.id, curso.id);
        if (att.total > 0 && att.pct < minPct) continue;
        const seq = db.seqCertificado++;
        const hash4 = crypto
          .createHash("sha256")
          .update(`${tenant.slug}:${alumno.id}:${curso.id}:${seq}`)
          .digest("hex")
          .slice(0, 4)
          .toUpperCase();
        db.certificados.unshift({
          id: uid("cert"),
          codigoVerificacion: `CERT-${String(seq).padStart(4, "0")}-${hash4}`,
          alumnoId: alumno.id,
          alumnoNombre: alumno.nombre,
          alumnoDni: alumno.dni,
          cursoId: curso.id,
          cursoNombre: curso.nombre,
          cargaHorariaHs: curso.cargaHorariaHs || 0,
          asistenciaPct: att.pct,
          fechaEmision: todayIso(),
          calificacion: "Aprobado",
          firmante1Nombre: db.config.firmante1Nombre,
          firmante1Cargo: db.config.firmante1Cargo,
          firmante2Nombre: curso.docenteNombre || db.config.firmante2Nombre,
          firmante2Cargo: db.config.firmante2Cargo,
          textoPersonalizado: db.config.textoCertificado,
          emitidoPor: actor,
          createdAt: new Date().toISOString(),
        });
        emitted++;
      }
      return saveAndReply("academia_emitir_certificados_lote", {
        emitted,
        message:
          emitted > 0
            ? `Se emitieron ${emitted} certificado(s) para "${curso.nombre}".`
            : `No había alumnos pendientes elegibles (>= ${minPct}% asistencia) en "${curso.nombre}".`,
      });
    }

    if (action === "delete_certificado") {
      const id = String(body.id || "").trim();
      db.certificados = db.certificados.filter((c) => c.id !== id);
      return saveAndReply("academia_delete_certificado", { message: "Certificado eliminado." });
    }

    return NextResponse.json(
      { ok: false, message: `Acción no soportada: ${action}` },
      { status: 400, headers: corsHeaders }
    );
  }

  return NextResponse.json(
    { ok: false, message: "Método no permitido." },
    { status: 405, headers: corsHeaders }
  );
}
