export type ActividadNegocioMode = "comercial" | "servicios" | "mixta";

export type MonedaServicio = "ARS" | "USD";

export type EstadoPresupuesto =
  | "borrador"
  | "enviado"
  | "aprobado"
  | "rechazado"
  | "vencido"
  | "cancelado";

export type EstadoOrdenTrabajo =
  | "pendiente"
  | "programada"
  | "en_ejecucion"
  | "finalizada"
  | "cancelada";

export type EstadoFacturacionServicio =
  | "pendiente"
  | "parcial"
  | "facturada";

export type FrecuenciaAbono =
  | "mensual"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual";

export type EstadoAbono = "activo" | "pausado" | "finalizado";

export type TipoDocumentoTecnico =
  | "informe_tecnico"
  | "certificado"
  | "fotografia"
  | "planilla"
  | "protocolo"
  | "pdf"
  | "cliente";

export const DEFAULT_UNIDADES_FACTURACION: string[] = [
  "Unidad",
  "Hora",
  "Jornada",
  "Día",
  "Visita",
  "Kilómetro",
  "Metro",
  "Metro cuadrado",
  "Equipo",
  "Inspección",
  "Trabajo completo",
  "Abono mensual",
];

export interface ServicioAuditEntry {
  at: string;
  by: string;
  action: string;
  detail: string;
}

export interface ServicioConfig {
  actividadNegocio: ActividadNegocioMode;
  unidadesPersonalizadas: string[];
  monedaDefault: MonedaServicio;
  ivaDefaultPct: number;
  validezPresupuestoDias: number;
  condicionesComercialesDefault: string;
  requiereAprobacionAdminFacturacion: boolean;
  prefijoPresupuesto: string;
  prefijoOt: string;
  prefijoParte: string;
  prefijoAbono: string;
  nextPresupuestoSeq: number;
  nextOtSeq: number;
  nextParteSeq: number;
  nextAbonoSeq: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ClienteUbicacionServicio {
  id: string;
  nombre: string;
  direccion: string;
  localidad: string;
  provincia: string;
  contactoSitio: string;
  telefonoSitio: string;
  notas: string;
}

export interface ClienteTarifaEspecial {
  id: string;
  servicioId: string;
  precioEspecial: number;
  moneda: MonedaServicio;
  vigenteDesde: string; // YYYY-MM-DD
  vigenteHasta: string; // YYYY-MM-DD o ""
  notas: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ClienteServicioPerfil {
  clientId: number;
  contactoTecnicoNombre: string;
  contactoTecnicoTel: string;
  contactoTecnicoEmail: string;
  contactoAdminNombre: string;
  contactoAdminTel: string;
  contactoAdminEmail: string;
  condicionesContratacion: string;
  condicionesPago: string;
  plazoPagoDias: number;
  codigoInternoCliente: string;
  ordenesCompraRef: string;
  defaultBillingClientId: number | null; // Si factura a otra razón social
  ubicaciones: ClienteUbicacionServicio[];
  tarifasEspeciales: ClienteTarifaEspecial[];
  updatedAt: string;
  updatedBy: string;
}

export interface TarifaHistorialEntry {
  at: string;
  by: string;
  precioAnterior: number;
  precioNuevo: number;
  moneda: MonedaServicio;
  motivo: string;
}

export interface ServicioCatalogoItem {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  unidadMedida: string;
  precioBase: number;
  costoEstimado: number;
  moneda: MonedaServicio;
  ivaPct: number;
  duracionEstimadaMin: number;
  activo: boolean;
  observaciones: string;
  formasCotizacion: Array<{
    unidad: string;
    precio: number;
    moneda: MonedaServicio;
  }>;
  historialTarifas: TarifaHistorialEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ServicioLineaComercial {
  id: string;
  servicioId: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  unidadMedida: string;
  cantidad: number;
  precioUnitario: number;
  descuentoPct: number;
  ivaPct: number;
  subtotalNeto: number;
  totalConIva: number;
}

export interface GastoAdicionalServicio {
  id: string;
  concepto: string; // Traslado, Viáticos, Alojamiento, Consumibles, etc.
  cantidad: number;
  precioUnitario: number;
  ivaPct: number;
  totalConIva: number;
}

export interface PresupuestoVersionSnapshot {
  version: number;
  savedAt: string;
  savedBy: string;
  total: number;
  estado: EstadoPresupuesto;
  nota: string;
}

export interface PresupuestoServicio {
  id: string;
  numero: string; // PRES-00001
  version: number;
  fecha: string; // YYYY-MM-DD
  vigenteHasta: string; // YYYY-MM-DD
  estado: EstadoPresupuesto;
  clientId: number; // Solicitante
  clientNombre: string;
  billingClientId: number; // Destinatario de factura (puede ser distinto)
  billingClientNombre: string;
  establecimientoNombre: string;
  establecimientoDireccion: string;
  moneda: MonedaServicio;
  items: ServicioLineaComercial[];
  gastosAdicionales: GastoAdicionalServicio[];
  descuentoGlobalPct: number;
  subtotalNeto: number;
  totalIva: number;
  totalGeneral: number;
  condicionesComerciales: string;
  observaciones: string;
  adjuntos: Array<{ id: string; nombre: string; mimeType: string; dataUrl: string }>;
  convertedOtId: string | null;
  versionHistory: PresupuestoVersionSnapshot[];
  auditLog: ServicioAuditEntry[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface OrdenTrabajoLinea {
  id: string;
  servicioId: string;
  codigo: string;
  nombre: string;
  unidadMedida: string;
  cantidadPrevista: number;
  cantidadEjecutada: number;
  cantidadFacturada: number;
  precioUnitario: number;
  descuentoPct: number;
  ivaPct: number;
}

export interface FacturaVinculadaServicio {
  id: string;
  saleId: string;
  numeroCompleto: string;
  tipoBase: string;
  letra: string;
  fechaIso: string;
  billingClientId: number;
  billingClientNombre: string;
  montoFacturado: number;
  origenOperacion: "SERVICIOS" | "MIXTA";
  esNotaCredito: boolean;
  lineasFacturadas: Array<{
    otId?: string;
    parteId?: string;
    abonoId?: string;
    presupuestoId?: string;
    lineId: string;
    descripcion: string;
    cantidad: number;
    monto: number;
  }>;
  aprobacionAdminEstado?: "pendiente" | "aprobada";
  aprobacionAdminFecha?: string;
  retenciones?: Array<{
    id: string;
    tipo: string; // Ganancias, IIBB, SUSS, IVA
    certificado: string;
    importe: number;
    fecha: string;
  }>;
  createdAt: string;
  createdBy: string;
}

export interface OrdenTrabajo {
  id: string;
  numero: string; // OT-00001
  estado: EstadoOrdenTrabajo;
  estadoFacturacion: EstadoFacturacionServicio;
  presupuestoId: string | null;
  presupuestoNumero: string;
  // Separación explícita: Solicitante ≠ Establecimiento ≠ Destinatario de factura
  clientId: number;
  clientNombre: string;
  billingClientId: number;
  billingClientNombre: string;
  ordenCompraCliente: string;
  fechaSolicitud: string; // YYYY-MM-DD
  fechaPrevista: string; // YYYY-MM-DD
  lugarTrabajo: string;
  domicilioTrabajo: string;
  equipoInstalacion: string;
  descripcionTrabajo: string;
  personalAsignadoIds: string[];
  duracionEstimadaHoras: number;
  materialesRecursos: string;
  instruccionesEspeciales: string;
  moneda: MonedaServicio;
  items: OrdenTrabajoLinea[];
  gastosAdicionales: GastoAdicionalServicio[];
  condicionesComerciales: string;
  totalPrevisto: number;
  totalEjecutado: number;
  totalFacturado: number;
  saldoPendienteFacturar: number;
  costoDirectoEstimado: number;
  facturasIds: string[];
  auditLog: ServicioAuditEntry[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface ParteServicioConformidad {
  conforme: boolean;
  nombreReceptor: string;
  cargoDniReceptor: string;
  fechaConformidad: string; // YYYY-MM-DD HH:mm
  observaciones: string;
  firmaDataUrl: string;
  avisoLegal: string;
}

export interface ParteServicio {
  id: string;
  numero: string; // PS-00001
  otId: string;
  otNumero: string;
  clientId: number;
  clientNombre: string;
  fechaInicio: string; // YYYY-MM-DDTHH:mm
  fechaFin: string; // YYYY-MM-DDTHH:mm
  horasTrabajadas: number;
  personalIntervinienteIds: string[];
  itemsEjecutados: Array<{
    otLineId: string;
    servicioId: string;
    codigo: string;
    nombre: string;
    unidadMedida: string;
    cantidadPresupuestada: number;
    cantidadEjecutada: number;
    precioUnitario: number;
    ivaPct: number;
  }>;
  movilidadKm: number;
  movilidadCosto: number;
  viaticosCosto: number;
  materialesUtilizados: string;
  materialesCosto: number;
  observaciones: string;
  incidencias: string;
  fotografias: Array<{ id: string; nombre: string; dataUrl: string }>;
  adjuntos: Array<{ id: string; nombre: string; mimeType: string; dataUrl: string }>;
  conformidad: ParteServicioConformidad;
  facturado: boolean;
  facturaIds: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface DocumentoTecnicoServicio {
  id: string;
  otId: string;
  otNumero: string;
  parteId: string | null;
  clientId: number;
  clientNombre: string;
  tipo: TipoDocumentoTecnico;
  titulo: string;
  nombreArchivo: string;
  mimeType: string;
  dataUrl: string;
  fechaDocumento: string; // YYYY-MM-DD
  notas: string;
  visibilidadRoles: Array<"Administrador General" | "Administrador" | "Usuario">;
  uploadedAt: string;
  uploadedBy: string;
}

export interface PersonalServicioExt {
  id: string;
  linkedAsistenciaEmployeeId: string | null;
  nombre: string;
  dni: string;
  especialidad: string;
  matricula: string;
  habilitaciones: string;
  certificaciones: string;
  costoHora: number;
  telefono: string;
  email: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AbonoRecurrente {
  id: string;
  codigo: string; // AB-0001
  clientId: number;
  clientNombre: string;
  billingClientId: number;
  billingClientNombre: string;
  servicioId: string;
  servicioNombre: string;
  descripcion: string;
  importe: number;
  moneda: MonedaServicio;
  ivaPct: number;
  frecuencia: FrecuenciaAbono;
  fechaInicio: string; // YYYY-MM-DD
  proximoVencimiento: string; // YYYY-MM-DD
  condicionesActualizacion: string;
  estado: EstadoAbono;
  periodosGenerados: Record<
    string,
    {
      generatedAt: string;
      generatedBy: string;
      status: "borrador" | "facturado";
      saleId?: string;
      numeroCompleto?: string;
      importe: number;
    }
  >;
  createdAt: string;
  updatedAt: string;
}

export interface ServiciosDatabase {
  version: number;
  updatedAt: string;
  config: ServicioConfig;
  clientProfiles: Record<string, ClienteServicioPerfil>;
  catalogo: ServicioCatalogoItem[];
  presupuestos: PresupuestoServicio[];
  ordenesTrabajo: OrdenTrabajo[];
  partesServicio: ParteServicio[];
  documentos: DocumentoTecnicoServicio[];
  personal: PersonalServicioExt[];
  abonos: AbonoRecurrente[];
  facturasVinculadas: FacturaVinculadaServicio[];
}
