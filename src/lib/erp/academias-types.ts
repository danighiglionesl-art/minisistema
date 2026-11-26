export type AcademiaTipoNegocio =
  | "academia_danza"
  | "capacitaciones"
  | "escuela_negocios"
  | "idiomas"
  | "arte_musica"
  | "deportes"
  | "cursos_oficios"
  | "mixta";

export type AcademiaModalidad = "presencial" | "online" | "hibrida";

export type AcademiaEstadoAlumno = "activo" | "pausado" | "egresado" | "baja";

export type AcademiaEstadoAsistencia = "P" | "A" | "T" | "J";

export type AcademiaEstadoCuota = "pendiente" | "parcial" | "pagada" | "anulada" | "bonificada";

export type AcademiaMedioPago =
  | "efectivo"
  | "transferencia"
  | "debito"
  | "credito"
  | "qr"
  | "mercadopago"
  | "ctacte";

export type AcademiaEsquemaDocente = "porcentaje" | "valor_clase" | "fijo_mensual";

export interface AcademiaOpcionalesConfig {
  pagosOnlineMp: boolean;
  certificadosAuto: boolean;
  aulaVirtualClassroom: boolean;
  clasesOnlineDaily: boolean;
  inscripcionPublicaWeb: boolean;
  fichaSaludAptoFisico: boolean;
  integrarClientesCtaCte: boolean;
}

export interface AcademiaConfig {
  nombreAcademia: string;
  tipoNegocio: AcademiaTipoNegocio;
  logoUrl: string;
  direccion: string;
  localidad: string;
  whatsapp: string;
  email: string;
  diaVencimientoCuota: number;
  recargoMoraPct: number;
  asistenciaMinimaCertificadoPct: number;
  firmante1Nombre: string;
  firmante1Cargo: string;
  firmante2Nombre: string;
  firmante2Cargo: string;
  textoCertificado: string;
  reglamentoInterno: string;
  dailyDomain: string;
  opcionales: AcademiaOpcionalesConfig;
}

export interface AcademiaCurso {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  nivel: string;
  modalidad: AcademiaModalidad;
  docenteId: string;
  docenteNombre: string;
  diasHorarios: string;
  aulaSala: string;
  cupoMaximo: number;
  arancelMatricula: number;
  arancelCuotaMensual: number;
  duracionMeses: number;
  cargaHorariaHs: number;
  fechaInicio: string;
  fechaFin: string;
  classroomUrl: string;
  classroomCodigo: string;
  dailyRoomUrl: string;
  activo: boolean;
  notas: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademiaAlumno {
  id: string;
  legajo: string;
  clienteId?: number | null;
  nombre: string;
  dni: string;
  fechaNacimiento: string;
  whatsapp: string;
  email: string;
  domicilio: string;
  tutorNombre: string;
  tutorWhatsapp: string;
  contactoEmergencia: string;
  aptoFisicoOk: boolean;
  aptoFisicoVencimiento: string;
  observacionesSalud: string;
  estado: AcademiaEstadoAlumno;
  origen: "presencial" | "web" | "importado";
  notas: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademiaInscripcion {
  id: string;
  numero: string;
  alumnoId: string;
  alumnoNombre: string;
  alumnoDni: string;
  cursoId: string;
  cursoNombre: string;
  fechaInscripcion: string;
  becaPct: number;
  cuotaAcordada: number;
  matriculaImporte: number;
  matriculaPagada: boolean;
  estado: "activa" | "pausada" | "finalizada" | "baja";
  notas: string;
  createdBy: string;
  createdAt: string;
}

export interface AcademiaAsistenciaSesion {
  id: string;
  cursoId: string;
  cursoNombre: string;
  fecha: string; // YYYY-MM-DD
  temaClase: string;
  modalidadSesion: "presencial" | "online";
  docenteId: string;
  docenteNombre: string;
  /** Mapa alumnoId -> P (Presente) | A (Ausente) | T (Tardanza) | J (Justificado) */
  registros: Record<string, AcademiaEstadoAsistencia>;
  observaciones: string;
  updatedBy: string;
  updatedAt: string;
}

export interface AcademiaPagoRegistro {
  id: string;
  reciboNumero: string;
  cuotaId: string;
  alumnoId: string;
  alumnoNombre: string;
  cursoId: string;
  cursoNombre: string;
  concepto: string;
  fechaPago: string;
  importe: number;
  medioPago: AcademiaMedioPago;
  referencia: string;
  canal: "presencial" | "online";
  cobradoPor: string;
  observaciones: string;
  createdAt: string;
}

export interface AcademiaCuota {
  id: string;
  numero: string;
  inscripcionId: string;
  alumnoId: string;
  alumnoNombre: string;
  alumnoWhatsapp: string;
  cursoId: string;
  cursoNombre: string;
  periodo: string; // YYYY-MM o MATRICULA
  concepto: string;
  fechaVencimiento: string;
  importeOriginal: number;
  descuentoBeca: number;
  recargoMora: number;
  importeTotal: number;
  importePagado: number;
  saldoPendiente: number;
  estado: AcademiaEstadoCuota;
  ultimoPagoFecha: string;
  ultimoReciboNumero: string;
  mpPaymentLink: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademiaDocente {
  id: string;
  empleadoAsistenciaId?: string | null;
  nombre: string;
  dni: string;
  especialidad: string;
  whatsapp: string;
  email: string;
  esquemaHonorarios: AcademiaEsquemaDocente;
  valorEsquema: number; // % si porcentaje, $ si valor_clase o fijo_mensual
  cbuAlias: string;
  activo: boolean;
  notas: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademiaMaterialAula {
  id: string;
  cursoId: string;
  cursoNombre: string;
  titulo: string;
  tipo: "pdf" | "video" | "link" | "classroom" | "tarea" | "grabacion";
  url: string;
  descripcion: string;
  fechaPublicacion: string;
  publicadoPor: string;
}

export interface AcademiaClaseOnline {
  id: string;
  cursoId: string;
  cursoNombre: string;
  titulo: string;
  fecha: string;
  horaInicio: string;
  duracionMin: number;
  plataforma: "daily" | "google_meet" | "zoom" | "classroom";
  roomName: string;
  roomUrlHost: string;
  roomUrlAlumno: string;
  providerMode: "daily_api" | "daily_sandbox" | "external_link";
  estado: "programada" | "en_vivo" | "finalizada" | "cancelada";
  grabacionUrl: string;
  docenteNombre: string;
  asistentesCount: number;
  createdBy: string;
  createdAt: string;
}

export interface AcademiaCertificado {
  id: string;
  codigoVerificacion: string;
  alumnoId: string;
  alumnoNombre: string;
  alumnoDni: string;
  cursoId: string;
  cursoNombre: string;
  cargaHorariaHs: number;
  asistenciaPct: number;
  fechaEmision: string;
  calificacion: string;
  firmante1Nombre: string;
  firmante1Cargo: string;
  firmante2Nombre: string;
  firmante2Cargo: string;
  textoPersonalizado: string;
  emitidoPor: string;
  createdAt: string;
}

export interface AcademiasDatabase {
  version: number;
  updatedAt: string;
  seqInscripcion: number;
  seqRecibo: number;
  seqCertificado: number;
  seqCuota: number;
  config: AcademiaConfig;
  cursos: AcademiaCurso[];
  alumnos: AcademiaAlumno[];
  inscripciones: AcademiaInscripcion[];
  asistencias: AcademiaAsistenciaSesion[];
  cuotas: AcademiaCuota[];
  pagos: AcademiaPagoRegistro[];
  docentes: AcademiaDocente[];
  materiales: AcademiaMaterialAula[];
  clasesOnline: AcademiaClaseOnline[];
  certificados: AcademiaCertificado[];
}
