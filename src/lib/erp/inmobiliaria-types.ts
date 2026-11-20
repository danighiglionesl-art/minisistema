// ============================================================================
// MINISISTEMA — MÓDULO INMOBILIARIA & MARKETPLACE INMOBILIARIO
// Tipos compartidos, cálculos de Split (Propietario / Inmobiliaria) y
// reemplazo automático de variables en plantillas de contratos
// ============================================================================

export type OperacionInmobiliaria = "venta" | "alquiler" | "alquiler_temporario";

export type AmbitoPropiedad = "urbana" | "rural";

export type RegimenPropiedad =
  | "propiedad_individual"
  | "propiedad_horizontal"
  | "condominio"
  | "barrio_privado_country"
  | "fideicomiso";

export type EstadoConstruccion = "con_construccion" | "sin_construccion" | "en_construccion" | "a_reciclar";

export type TipoPropiedad =
  | "Casa"
  | "Departamento"
  | "Dúplex / Tríplex"
  | "PH"
  | "Terreno / Lote"
  | "Campo / Fracción Rural"
  | "Quinta / Chacra"
  | "Local Comercial"
  | "Oficina / Consultorio"
  | "Galpón / Depósito"
  | "Cochera"
  | "Cabaña / Temporario";

export type MonedaInmo = "ARS" | "USD";

export type RibbonEtiquetaPreset =
  | ""
  | "Nuevo Ingreso"
  | "Oportunidad"
  | "Liquidación"
  | "Escucho Ofertas"
  | "Reservado"
  | "Destacado"
  | "A Estrenar"
  | "Apto Crédito"
  | "Exclusivo";

export interface InmoBannerRecord {
  id: string;
  titulo: string;
  subtitulo: string;
  imageUrl: string; // 1530x370 recomendado
  linkUrl: string;
  ctaLabel: string;
  orden: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InmoPropiedadCaracteristicas {
  // Generales
  superficieTotalM2: number | null;
  superficieCubiertaM2: number | null;
  superficieHectareas?: number | null; // para rurales
  antiguedadAnios: string; // "A estrenar", "5 años", etc.
  orientacion: string;
  disposicion: string; // Frente, Contrafrente, Interno, Lateral
  // Ambientes rápidos pedidos
  tieneGarage: boolean;
  cantidadVehiculosGarage: number;
  garageCubierto: boolean;
  tienePileta: boolean;
  tieneQuincho: boolean;
  cantidadBanos: number;
  cantidadToilettes: number;
  cantidadHabitaciones: number;
  tieneCocina: boolean;
  tieneCocinaComedor: boolean;
  tieneLavadero: boolean;
  tieneDependencias: boolean;
  tieneLiving: boolean;
  tieneLivingComedor: boolean;
  tienePlacares: boolean;
  tipoCalefaccion: string; // "Sin calefacción" | "Calefactores gas natural" | "Losa radiante" | "Radiadores" | "Caldera central" | "Aire frío/calor" | "Eléctrica" | "Hogar a leña"
  tipoRefrigeracion: string; // "Sin refrigeración" | "Aire acondicionado split" | "Aire central" | "Ventiladores de techo" | "Preinstalación AA"
  // Específicos departamento / PH
  esDepartamento: boolean;
  esInterno: boolean;
  tieneBalcon: boolean;
  pisoDepartamento: string;
  tieneAscensor: boolean;
  expensasMensualesArs: number | null;
  // Servicios y extras portal pro (Zonaprop / Argenprop)
  aguaCorriente: boolean;
  gasNatural: boolean;
  cloacas: boolean;
  pavimento: boolean;
  internetFibra: boolean;
  permiteMascotas: boolean;
  aptoCredito: boolean;
  amoblado: boolean;
  seguridad24hs: boolean;
  parrilla: boolean;
  jardinPatio: boolean;
  // Condiciones de alquiler
  garantiasSolicitadas: string; // ej. "Garantía propietaria + 2 recibos de sueldo o Seguro de Caución"
  mesDeposito: string; // ej. "1 mes de depósito (en USD o ARS)"
  ajusteContrato: string; // ej. "Trimestral por ICL" / "Cuatrimestral por IPC"
  plazoMinimo: string; // ej. "24 meses" / "Por día / semana"
}

export interface InmoPropiedadRecord {
  id: string;
  codigo: string; // ej. INM-0001
  titulo: string;
  descripcion: string;
  operacion: OperacionInmobiliaria;
  tipoPropiedad: TipoPropiedad;
  ambito: AmbitoPropiedad; // urbana | rural
  regimen: RegimenPropiedad; // propiedad_horizontal | condominio | etc.
  estadoConstruccion: EstadoConstruccion; // con_construccion | sin_construccion | etc.
  // Precios
  mostrarPrecio: boolean; // true = muestra precio, false = "Consultar"
  precio: number;
  moneda: MonedaInmo;
  textoConsulta: string; // ej: "Consultar precio"
  // Cartel cruzado en la 1ra fotografía
  cartelCruzado: string; // "Nuevo Ingreso" | "Oportunidad" | "Liquidación" | "Escucho Ofertas" | personalizado
  cartelColorBg: string; // hex opcional
  // Destacada para carrusel debajo del banner
  destacada: boolean;
  // Caducidad de publicación
  fechaCaducidad: string | null; // YYYY-MM-DD (null = sin caducidad)
  // Ubicación + Google Maps
  pais: string;
  provincia: string;
  localidad: string;
  cp: string;
  barrio: string;
  direccion: string;
  mostrarDireccionExacta: boolean;
  lat: number | null;
  lng: number | null;
  googleMapsUrl: string;
  // Propietario vinculado (opcional, para Split de Pagos)
  propietarioId?: string | null;
  propietarioNombre?: string;
  // Multimedia
  fotos: string[]; // URLs (1ra foto es portada con cartel cruzado)
  videoTourUrl?: string;
  // Características detalladas
  caracteristicas: InmoPropiedadCaracteristicas;
  // Estadísticas y estado
  activa: boolean;
  visitas: number;
  consultasWhatsapp: number;
  createdAt: string;
  updatedAt: string;
}

export interface InmoClienteRecord {
  id: string;
  rol: "inquilino" | "propietario" | "ambos" | "interesado";
  apellidos: string;
  nombres: string;
  nombreCompleto: string;
  tipoDoc: string;
  nroDoc: string;
  cuitCuil: string;
  fechaNacimiento: string;
  estadoCivil: string;
  nacionalidad: string;
  pais: string;
  provincia: string;
  localidad: string;
  cp: string;
  domicilioCalle: string;
  domicilioNumero: string;
  domicilioPiso: string;
  domicilioDpto: string;
  domicilioBarrio: string;
  domicilio: string;
  whatsappPais: string;
  whatsappPrefijo: string;
  whatsappNumero: string;
  whatsappCompleto: string;
  telefonoAlternativo: string;
  email: string;
  // Credenciales portal de clientes
  passwordHash?: string;
  passwordPlainCompat?: string;
  googleLinked?: boolean;
  googleEmail?: string;
  resetCode?: string | null;
  resetCodeExpiresAt?: string | null;
  // Datos bancarios / MP (cuando es propietario para Split modalidad ReikiOnline)
  cbuAlias?: string;
  mpPropietarioEmail?: string;
  mpAccount?: {
    connected: boolean;
    mpUserId: string;
    publicKey?: string;
    encryptedTokenPayload?: string;
    ivHex?: string;
    authTagHex?: string;
    connectedAt?: string;
  };
  notasInternas?: string;
  activo: boolean;
  origen: "web" | "admin";
  createdAt: string;
  updatedAt: string;
}

export interface InmoPlantillaContratoRecord {
  id: string;
  nombre: string;
  tipoOperacion: OperacionInmobiliaria | "comodato" | "reserva" | "boleto_compraventa" | "otro";
  descripcion: string;
  contenidoHtml: string; // Admite placeholders automáticos {{CLIENTE_NOMBRE}}, {{PROPIEDAD_DIRECCION}}, etc.
  camposPersonalizados: Array<{ clave: string; etiqueta: string; valorPorDefecto: string }>;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InmoCuotaContratoRecord {
  id: string;
  numeroCuota: number;
  periodo: string; // YYYY-MM (ej. "2026-11")
  concepto: string; // ej. "Alquiler Noviembre 2026"
  vencimiento: string; // YYYY-MM-DD
  moneda: MonedaInmo;
  montoBase: number;
  expensas: number;
  impuestosServicios: number;
  punitorios: number;
  descuentos: number;
  montoTotal: number;
  // Split modalidad ReikiOnline (% Propietario / % Inmobiliaria)
  propietarioPct: number;
  inmobiliariaPct: number;
  montoPropietario: number;
  montoInmobiliaria: number;
  estado: "pendiente" | "pagado" | "vencido" | "parcial";
  fechaPago: string | null;
  medioPago: string;
  comprobanteRef: string;
  mpPreferenceId?: string;
  mpPaymentId?: string;
}

export interface InmoContratoRecord {
  id: string;
  codigo: string; // ej. CTR-2026-0001
  titulo: string;
  tipoOperacion: OperacionInmobiliaria | "boleto_compraventa" | "otro";
  plantillaId?: string | null;
  propiedadId?: string | null;
  propiedadCodigo?: string;
  propiedadTitulo: string;
  propiedadDireccion: string;
  inquilinoId: string;
  inquilinoNombre: string;
  inquilinoDni: string;
  inquilinoEmail: string;
  propietarioId?: string | null;
  propietarioNombre: string;
  propietarioDni?: string;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string; // YYYY-MM-DD
  duracionMeses: number;
  moneda: MonedaInmo;
  valorMensualActual: number;
  indiceAjuste: string; // "ICL Trimestral" | "IPC Cuatrimestral" | "Fijo USD" | etc.
  mesDeposito: string;
  garantiasDetalle: string;
  // Split de pagos modalidad ReikiOnline
  propietarioPct: number; // ej. 90
  inmobiliariaPct: number; // ej. 10
  estado: "vigente" | "pasado" | "futuro" | "rescindido";
  // PDF adjunto o cuerpo compilado imprimible a PDF
  pdfUrl: string;
  pdfNombreOriginal: string;
  contenidoCompiladoHtml: string;
  cuotas: InmoCuotaContratoRecord[];
  notas: string;
  createdAt: string;
  updatedAt: string;
}

export interface InmoSplitTransaction {
  id: string;
  contratoId: string;
  contratoCodigo: string;
  cuotaId: string;
  periodo: string;
  inquilinoNombre: string;
  propietarioNombre: string;
  moneda: MonedaInmo;
  montoTotal: number;
  propietarioPct: number;
  inmobiliariaPct: number;
  montoPropietario: number;
  montoInmobiliaria: number;
  provider: "mercadopago_split" | "mercadopago_sandbox" | "manual";
  mpPreferenceId?: string;
  mpPaymentId?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

export interface InmoPortalConfig {
  tituloPortal: string;
  subtituloPortal: string;
  matriculaCorredor: string; // ej. CPI / CUCICBA / Mat. Prof.
  whatsappNumero: string;
  whatsappMensajeDefault: string;
  emailContacto: string;
  direccionOficina: string;
  googleMapsUrl?: string;
  horariosAtencion: string;
  instagramUrl?: string;
  instagramLabel?: string;
  facebookUrl?: string;
  facebookLabel?: string;
  googleClientId?: string; // Para Sign-In con Google en Acceso a Clientes
  defaultPropietarioPct: number; // ej. 90
  defaultInmobiliariaPct: number; // ej. 10
  etiquetasPersonalizadas: string[]; // además de Nuevo Ingreso, Oportunidad, Liquidación, Escucho Ofertas
  habilitarIaBuscador: boolean;
  habilitarCalculadoraCredito: boolean;
  habilitarComparador: boolean;
  updatedAt: string;
}

export interface InmoConsultaLeadRecord {
  id: string;
  propiedadId?: string | null;
  propiedadCodigo?: string;
  propiedadTitulo?: string;
  nombre: string;
  whatsapp: string;
  email: string;
  mensaje: string;
  tipo: "consulta_propiedad" | "agendar_visita" | "tasacion" | "alerta_busqueda";
  fechaVisitaDeseada?: string;
  estado: "nueva" | "contactada" | "visita_agendada" | "cerrada";
  createdAt: string;
}

export interface InmoDbDoc {
  updatedAt: string;
  lastPropSeq: number;
  lastContratoSeq: number;
  portalConfig: InmoPortalConfig;
  banners: InmoBannerRecord[];
  propiedades: InmoPropiedadRecord[];
  clientes: InmoClienteRecord[];
  plantillasContrato: InmoPlantillaContratoRecord[];
  contratos: InmoContratoRecord[];
  transaccionesSplit: InmoSplitTransaction[];
  consultas: InmoConsultaLeadRecord[];
}

export function round2Inmo(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function clampPctInmo(n: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, round2Inmo(v)));
}

export function calculateInmoSplit(montoTotal: number, inmobiliariaPctRaw: number) {
  const total = Math.max(0, round2Inmo(montoTotal));
  const inmobiliariaPct = clampPctInmo(inmobiliariaPctRaw, 10);
  const propietarioPct = round2Inmo(100 - inmobiliariaPct);
  const montoInmobiliaria = round2Inmo((total * inmobiliariaPct) / 100);
  const montoPropietario = round2Inmo(total - montoInmobiliaria);
  return {
    montoTotal: total,
    inmobiliariaPct,
    propietarioPct,
    montoInmobiliaria,
    montoPropietario,
  };
}

export function computeContractAutoStatus(
  fechaInicio: string,
  fechaFin: string,
  currentStatus?: InmoContratoRecord["estado"]
): InmoContratoRecord["estado"] {
  if (currentStatus === "rescindido") return "rescindido";
  const today = new Date().toISOString().slice(0, 10);
  if (fechaInicio && fechaInicio > today) return "futuro";
  if (fechaFin && fechaFin < today) return "pasado";
  return "vigente";
}

export function isPropertyExpired(p: Pick<InmoPropiedadRecord, "fechaCaducidad">): boolean {
  if (!p.fechaCaducidad) return false;
  const today = new Date().toISOString().slice(0, 10);
  return String(p.fechaCaducidad).slice(0, 10) < today;
}

export const CONTRACT_PLACEHOLDERS: Array<{ key: string; desc: string }> = [
  { key: "{{FECHA_HOY}}", desc: "Fecha actual formateada (DD/MM/AAAA)" },
  { key: "{{INMOBILIARIA_NOMBRE}}", desc: "Nombre comercial de la Inmobiliaria" },
  { key: "{{INMOBILIARIA_RAZON_SOCIAL}}", desc: "Razón Social de la Inmobiliaria" },
  { key: "{{INMOBILIARIA_CUIT}}", desc: "CUIT de la Inmobiliaria" },
  { key: "{{INMOBILIARIA_MATRICULA}}", desc: "Matrícula del Corredor Inmobiliario" },
  { key: "{{INMOBILIARIA_DOMICILIO}}", desc: "Domicilio de la oficina inmobiliaria" },
  { key: "{{CLIENTE_NOMBRE_COMPLETO}}", desc: "Apellido y Nombre del Inquilino / Cliente" },
  { key: "{{CLIENTE_APELLIDOS}}", desc: "Apellido(s) del Cliente" },
  { key: "{{CLIENTE_NOMBRES}}", desc: "Nombre(s) del Cliente" },
  { key: "{{CLIENTE_TIPO_DOC}}", desc: "Tipo de documento (DNI/CUIT)" },
  { key: "{{CLIENTE_DNI}}", desc: "Número de documento del Cliente" },
  { key: "{{CLIENTE_CUIT}}", desc: "CUIT / CUIL del Cliente" },
  { key: "{{CLIENTE_DOMICILIO}}", desc: "Domicilio completo del Cliente" },
  { key: "{{CLIENTE_LOCALIDAD}}", desc: "Localidad del Cliente" },
  { key: "{{CLIENTE_PROVINCIA}}", desc: "Provincia del Cliente" },
  { key: "{{CLIENTE_EMAIL}}", desc: "Email del Cliente" },
  { key: "{{CLIENTE_WHATSAPP}}", desc: "WhatsApp completo del Cliente" },
  { key: "{{CLIENTE_ESTADO_CIVIL}}", desc: "Estado civil del Cliente" },
  { key: "{{CLIENTE_NACIONALIDAD}}", desc: "Nacionalidad del Cliente" },
  { key: "{{PROPIETARIO_NOMBRE_COMPLETO}}", desc: "Apellido y Nombre del Propietario / Locador" },
  { key: "{{PROPIETARIO_DNI}}", desc: "DNI / CUIT del Propietario" },
  { key: "{{PROPIETARIO_DOMICILIO}}", desc: "Domicilio del Propietario" },
  { key: "{{PROPIETARIO_CBU}}", desc: "CBU / Alias bancario del Propietario" },
  { key: "{{PROPIEDAD_CODIGO}}", desc: "Código interno de la propiedad" },
  { key: "{{PROPIEDAD_TITULO}}", desc: "Título de la propiedad" },
  { key: "{{PROPIEDAD_TIPO}}", desc: "Tipo de propiedad (Casa, Dpto, Campo, etc.)" },
  { key: "{{PROPIEDAD_DIRECCION}}", desc: "Dirección exacta de la propiedad" },
  { key: "{{PROPIEDAD_BARRIO}}", desc: "Barrio / Zona" },
  { key: "{{PROPIEDAD_LOCALIDAD}}", desc: "Localidad de la propiedad" },
  { key: "{{PROPIEDAD_PROVINCIA}}", desc: "Provincia de la propiedad" },
  { key: "{{CONTRATO_CODIGO}}", desc: "Código del contrato (ej. CTR-2026-0001)" },
  { key: "{{CONTRATO_FECHA_INICIO}}", desc: "Fecha de inicio de vigencia" },
  { key: "{{CONTRATO_FECHA_FIN}}", desc: "Fecha de finalización" },
  { key: "{{CONTRATO_DURACION_MESES}}", desc: "Duración en meses" },
  { key: "{{CONTRATO_VALOR_MENSUAL}}", desc: "Valor mensual formateado con moneda" },
  { key: "{{CONTRATO_INDICE_AJUSTE}}", desc: "Cláusula / Índice de actualización" },
  { key: "{{CONTRATO_DEPOSITO}}", desc: "Mes de depósito en garantía" },
  { key: "{{CONTRATO_GARANTIAS}}", desc: "Detalle de garantías" },
  { key: "{{SPLIT_PROPIETARIO_PCT}}", desc: "% de cobro al Propietario" },
  { key: "{{SPLIT_INMOBILIARIA_PCT}}", desc: "% de comisión a la Inmobiliaria" },
];

export function compileContractTemplate(
  templateHtml: string,
  vars: Record<string, string | number | null | undefined>
): string {
  let out = String(templateHtml || "");
  for (const [key, val] of Object.entries(vars)) {
    const token = key.startsWith("{{") ? key : `{{${key}}}`;
    const safeVal = val == null ? "" : String(val);
    out = out.split(token).join(safeVal);
  }
  return out;
}
