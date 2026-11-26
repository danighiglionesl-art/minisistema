export interface LabAnalyteDef {
  id: string;
  label: string;
  subgrupo?: string; // ej. "FORMULA LEUCOCITARIA", "EXAMEN FISICO - QUIMICO", "EXAMEN MICROSCOPICO DEL SEDIMENTO"
  unidad: string;
  rangoReferencia: string; // Soporta múltiples líneas ("\n"), ej: "Masculino\t4.50 a 5.30\nFemenino\t4.10 a 5.10"
  formulaAuto?:
    | "vcm"
    | "hcm"
    | "chcm"
    | "leuco_abs"
    | "homa"
    | "tyg"
    | "riesgo_cv"
    | "no_hdl"
    | "aterogeno"
    | "bilirrubina_ind"
    | "psa_ratio";
  tipoInput?: "numero" | "texto" | "cualitativo";
  opcionesSugeridas?: string[];
  decimales?: number;
  refMinMasc?: number | null;
  refMaxMasc?: number | null;
  refMinFem?: number | null;
  refMaxFem?: number | null;
}

export interface LabPracticeCatalogItem {
  codigo: string; // Ej. "660475"
  nombre: string; // Ej. "HEMOGRAMA"
  seccion: string; // Ej. "Hematología", "Química Clínica", "Endocrinología", etc.
  metodoDefault: string; // Ej. "Citometría de flujo (FCM), Counter 29 Wiener"
  muestra: string; // Ej. "Sangre entera EDTA", "Suero", "Orina", "Plasma citratado"
  ub: number; // Unidades Bioquímicas NBU / Nomenclador
  valorParticularArs: number;
  valorObraSocialBaseArs: number;
  notaDefault?: string;
  activa: boolean;
  esCustom?: boolean;
  determinaciones: LabAnalyteDef[];
}

export interface LabPracticeOverride {
  codigo: string;
  nombre?: string;
  seccion?: string;
  metodoDefault?: string;
  muestra?: string;
  ub?: number;
  valorParticularArs?: number;
  valorObraSocialBaseArs?: number;
  notaDefault?: string;
  activa?: boolean;
  esCustom?: boolean;
  bajaLogica?: boolean;
  determinaciones?: LabAnalyteDef[];
  updatedAt?: string;
}

export interface LabProfilePreset {
  id: string;
  nombre: string;
  descripcion: string;
  codigos: string[];
}

export type LabModalidadTarifaOS =
  | "por_ub"
  | "porcentaje_particular"
  | "lista_fija";

export interface LabObraSocialTarifa {
  id: string;
  obraSocialId?: string;
  nombre: string;
  sigla: string;
  cuit?: string;
  modalidad: LabModalidadTarifaOS;
  valorUbArs: number; // Valor de 1 Unidad Bioquímica en ARS para esta Obra Social
  actoBioquimicoUb: number; // Ej. 3 UB (código 660001)
  porcentajeSobreParticular: number; // Ej. 80 (%)
  preciosPorCodigo: Record<string, number>; // Override manual por código 66xxxx para esta OS
  coseguroDefaultArs: number;
  requiereAutorizacion: boolean;
  observaciones?: string;
  activa: boolean;
  updatedAt: string;
}

export interface LabBioquimicoSignature {
  username: string;
  nombreCompleto: string; // Ej. "Pablo Borda"
  tituloProfesional: string; // Ej. "Bioquímico"
  matricula: string; // Ej. "M.P. 5504"
  especialidad?: string;
  resolucionPie?: string; // Pie institucional específico opcional
  firmaDataUrl: string; // PNG transparente en base64
  activoPorDefecto?: boolean;
  updatedAt: string;
}

export interface LabConfig {
  nombreLaboratorio: string; // Ej. "Laboratorio Clínico"
  subtituloDirector: string; // Ej. "Dr. Nombre Apellido - Bioq. M.P. 0000"
  direccion: string; // Ej. "Esteban Piacenza 62 - Alcira Gigena"
  telefono: string; // Ej. "Cel: 3584254841"
  email: string;
  logoUrl: string;
  bannerColorPrimary: string; // Ej. "#1e5aa8"
  bannerColorSecondary: string; // Ej. "#cbd5e1"
  leyendaPiePagina: string; // Ej. "Laboratorio autorizado por el Colegio de Bioquímicos..."
  proximoProtocoloNro: number; // Ej. 19929 o 1001
  valorUbBaseParticularArs: number; // Ej. 1800
  valorUbBaseObraSocialArs: number; // Ej. 1350
  incluirActoBioquimicoAuto: boolean;
  requerirDniEnPortalQr: boolean;
  mostrarQrVerificacionEnPdf: boolean;
  enviarEmailAlValidar: boolean;
  plantillaWhatsapp: string;
  updatedAt: string;
}

export type LabQrStatus = "DISPONIBLE" | "ASIGNADO" | "PUBLICADO" | "ANULADO";

export interface LabQrCardRecord {
  code: string; // Ej. "LAB-8F4K-29M1"
  batchId: string;
  batchLabel: string;
  seqInBatch: number;
  pinSeguridad: string; // 4 dígitos opcionales impresos en la tarjeta
  status: LabQrStatus;
  orderId?: string;
  protocoloNro?: number;
  pacienteNombre?: string;
  pacienteDni?: string;
  createdAt: string;
  assignedAt?: string;
  publishedAt?: string;
}

export interface LabOrderAnalyteResult {
  analyteId: string;
  label: string;
  subgrupo?: string;
  valor: string;
  valorSecundario?: string; // Ej. recuento absoluto "2.491 /mm3" en fórmula leucocitaria
  unidad: string;
  rangoReferencia: string;
  flag?: "" | "BAJO" | "ALTO" | "CRITICO";
}

export interface LabOrderPracticeItem {
  codigo: string;
  nombre: string;
  seccion: string;
  metodo: string;
  muestra: string;
  ub: number;
  valorParticularRefArs: number;
  valorObraSocialRefArs: number;
  precioUnitarioArs: number; // Editable en el momento de cargar el pedido / facturar
  aCargoObraSocialArs: number;
  coseguroPacienteArs: number;
  notaPractica?: string;
  resultados: LabOrderAnalyteResult[];
}

export type LabOrderStatus =
  | "PENDIENTE_MUESTRA"
  | "EN_PROCESO"
  | "VALIDADO"
  | "ENTREGADO"
  | "ANULADO";

export interface LabOrderRecord {
  id: string;
  protocoloNro: number;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  fechaEntregaEstimada?: string;
  pacienteId?: string;
  pacienteApellido: string;
  pacienteNombres: string;
  pacienteNombreCompleto: string; // Formato bioquímico "APELLIDO, Nombre"
  pacienteDni: string;
  pacienteCuit?: string;
  pacienteSexo: "M" | "F" | "X";
  pacienteFechaNac?: string;
  pacienteEdad?: number | null;
  pacienteTelefono: string;
  pacienteEmail: string;
  medicoSolicitante: string; // Formato "MINARDI, Miguel M."
  matriculaMedico?: string;
  diagnosticoPresuntivo: string;
  ayunoHoras?: string;
  observacionesInternas?: string;
  coberturaTipo: "particular" | "obra_social";
  obraSocialId?: string;
  obraSocialNombre: string;
  planObraSocial?: string;
  nroAfiliado?: string;
  nroAutorizacion?: string;
  qrCode: string; // Código QR asociado al pedido
  estado: LabOrderStatus;
  practicas: LabOrderPracticeItem[];
  subtotalParticularArs: number;
  totalObraSocialArs: number;
  totalPacienteArs: number;
  totalGeneralArs: number;
  pagadoPaciente: boolean;
  facturadoPos: boolean;
  comprobantePosRef?: string;
  validadoPorUsername?: string;
  validadoPorNombre?: string;
  validadoPorTitulo?: string;
  validadoPorMatricula?: string;
  validadoFirmaDataUrl?: string;
  validadoAt?: string;
  notificadoEmailAt?: string;
  notificadoWhatsappAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LaboratorioDbDoc {
  version: number;
  updatedAt: string;
  config: LabConfig;
  practiceOverrides: Record<string, LabPracticeOverride>;
  customProfiles: LabProfilePreset[];
  obrasSocialesTarifas: LabObraSocialTarifa[];
  firmasBioquimicos: LabBioquimicoSignature[];
  qrCards: LabQrCardRecord[];
  orders: LabOrderRecord[];
}
