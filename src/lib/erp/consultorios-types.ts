// ============================================================================
// MINISISTEMA — MÓDULOS "GESTIÓN CONSULTORIOS" (HISTORIA CLÍNICA) Y "GESTIÓN WEB"
// Portal público integrado: /cemep (CEMEP Centro Médico Paulucci + CEMEP Plus)
// ============================================================================

export interface SignosVitalesRecord {
  ta?: string; // Tensión Arterial ej. "120/80 mmHg"
  fc?: string; // Frecuencia Cardíaca ej. "72 lpm"
  temp?: string; // Temperatura ej. "36.5 °C"
  pesoKg?: string; // Peso kg
  tallaCm?: string; // Talla cm
  imc?: string; // Índice de masa corporal
  satO2?: string; // Saturación O2 ej. "98%"
}

export interface FichaClinicaRecord {
  id: string;
  pacienteId: string;
  pacienteDni: string;
  pacienteNombre: string;
  fechaNacimiento?: string;
  genero?: string;
  whatsapp?: string;
  email?: string;
  obraSocialNombre?: string;
  planNombre?: string;
  nroAfiliado?: string;
  esAfiliadoCemepPlus?: boolean;
  grupoSanguineo?: string; // A+, O+, etc.
  alergias: string;
  antecedentesPersonales: string;
  antecedentesFamiliares: string;
  antecedentesQuirurgicos: string;
  medicacionCronica: string;
  habitos: string;
  alertasClinicas: string;
  notasGenerales: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvolucionClinicaRecord {
  id: string;
  pacienteId: string;
  pacienteDni: string;
  pacienteNombre: string;
  turnoId?: string;
  turnoCodigo?: string;
  profesionalId: string;
  profesionalNombre: string;
  profesionalMatricula?: string;
  especialidadNombre: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  motivoConsulta: string;
  subjetivo: string; // Anamnesis / relato del paciente
  objetivo: string; // Examen físico
  signosVitales?: SignosVitalesRecord;
  diagnostico: string;
  codigoCie10?: string;
  planTerapeutico: string;
  indicacionesPaciente?: string;
  privadaSoloProfesional?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type EstudioTipo =
  | "Laboratorio"
  | "Ecografía"
  | "Cardiología"
  | "Radiología"
  | "Diagnóstico por Imágenes"
  | "Circuito Integral"
  | "EMMAC"
  | "Informe Médico"
  | "Otro";

export interface EstudioMedicoRecord {
  id: string;
  pacienteId: string;
  pacienteDni: string;
  pacienteNombre: string;
  webUserId?: string;
  profesionalId: string;
  profesionalNombre: string;
  especialidadNombre?: string;
  fechaEstudio: string; // YYYY-MM-DD
  tipoEstudio: EstudioTipo;
  titulo: string;
  descripcionInforme: string;
  archivoNombre?: string;
  archivoMime?: string;
  archivoDataUrl?: string;
  visibleParaPaciente: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type RecetaEstado = "solicitada" | "en_proceso" | "emitida" | "rechazada";

export interface RecetaDigitalRecord {
  id: string;
  seq: number;
  codigo: string; // REC-2026-0001
  pacienteId?: string;
  pacienteDni: string;
  pacienteNombre: string;
  pacienteEmail: string;
  pacienteWhatsapp: string;
  webUserId?: string;
  profesionalId?: string;
  profesionalNombre?: string;
  obraSocialNombre: string;
  nroAfiliado?: string;
  esAfiliadoCemepPlus?: boolean;
  medicamentosSolicitados: string;
  diagnosticoMotivo?: string;
  notasPaciente?: string;
  estado: RecetaEstado;
  observacionesAdmin?: string;
  recetaCodigoValidacion?: string;
  recetaArchivoNombre?: string;
  recetaArchivoMime?: string;
  recetaArchivoDataUrl?: string;
  fechaEmision?: string;
  emitidaPor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoriaClinicaDbDoc {
  updatedAt: string;
  lastRecetaSeq: number;
  fichas: FichaClinicaRecord[];
  evoluciones: EvolucionClinicaRecord[];
  estudios: EstudioMedicoRecord[];
  recetas: RecetaDigitalRecord[];
}

// ----------------------------------------------------------------------------
// MÓDULO "GESTIÓN WEB" — USUARIOS REGISTRADOS, PROFESIONALES Y CMS PUBLICABLE
// ----------------------------------------------------------------------------

export interface CemepWebUserRecord {
  id: string;
  email: string;
  authProvider: "email" | "google";
  googleSub?: string;
  passwordHash?: string;
  resetCode?: string | null;
  resetCodeExpiresAt?: string | null;
  dni: string;
  apellidos: string;
  nombres: string;
  nombreCompleto: string;
  fechaNacimiento?: string;
  whatsapp: string;
  obraSocial?: string;
  nroAfiliado?: string;
  esAfiliadoCemepPlus: boolean;
  pacienteId?: string;
  activo: boolean;
  ultimoAccesoAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CemepProfAccessRecord {
  id: string;
  profesionalId: string;
  profesionalNombre: string;
  dni: string;
  email: string;
  especialidadResumen?: string;
  passwordHash: string;
  activo: boolean;
  ultimoAccesoAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CemepTipItem {
  id: string;
  categoria: string;
  autor: string;
  titulo: string;
  resumen: string;
  bullets: string[];
  tagCta?: string;
  acentoHex?: string;
  destacado?: boolean;
}

export interface CemepProfesionalDestacado {
  id: string;
  nombre: string;
  especialidad: string;
  diasAtencion: string;
  detalle: string;
  badge?: string;
}

export interface CemepComercioAdherido {
  id: string;
  nombre: string;
  rubro: string;
  beneficio: string;
  direccion: string;
  instagram?: string;
  diasVigencia?: string;
}

export interface CemepPlusPilar {
  id: string;
  titulo: string;
  subtitulo: string;
  items: string[];
}

export interface CemepWebContentConfig {
  general: {
    nombreInstitucion: string;
    direccion: string;
    localidad: string;
    horariosAtencion: string;
    emailInstitucional: string;
    instagramCemepUrl: string;
    instagramPlusUrl: string;
    farmaciaRedNombre: string;
    farmaciaRedDireccion: string;
    farmaciaRedWhatsapp: string;
    avisoSuperiorActivo: boolean;
    avisoSuperiorTexto: string;
  };
  cemep: {
    whatsappDigits: string;
    whatsappDisplay: string;
    heroBadge: string;
    heroTitle: string;
    heroSubtitle: string;
    statProfesionalesNum: string;
    statProfesionalesLabel: string;
    statRedNum: string;
    statRedLabel: string;
    statTrayectoriaNum: string;
    statTrayectoriaLabel: string;
    circuitoTitulo: string;
    circuitoSubtitulo: string;
    circuitoFechaTexto: string;
    circuitoBeneficioPlus: string;
    emmacTitulo: string;
    emmacDescripcion: string;
    especialidadesDestacadas: string[];
    profesionalesDestacados: CemepProfesionalDestacado[];
    tipsSalud: CemepTipItem[];
  };
  cemepPlus: {
    whatsappDigits: string;
    whatsappDisplay: string;
    heroBadge: string;
    heroTitle: string;
    heroSubtitle: string;
    sloganCorto: string;
    beneficioEstrellaTitulo: string;
    beneficioEstrellaTexto: string;
    pilares: CemepPlusPilar[];
    campanasDestacadas: Array<{
      id: string;
      etiqueta: string;
      titulo: string;
      descripcion: string;
    }>;
    comerciosAdheridos: CemepComercioAdherido[];
    ctaAfiliacionTitulo: string;
    ctaAfiliacionTexto: string;
  };
}

export interface GestionWebDbDoc {
  updatedAt: string;
  googleClientId?: string;
  publishedAt: string;
  publishedBy: string;
  hasUnpublishedChanges: boolean;
  draftContent: CemepWebContentConfig;
  publishedContent: CemepWebContentConfig;
  webUsers: CemepWebUserRecord[];
  profesionalAccounts: CemepProfAccessRecord[];
}

export function buildDefaultCemepWebContent(): CemepWebContentConfig {
  return {
    general: {
      nombreInstitucion: "CEMEP · Centro Médico Paulucci",
      direccion: "9 de Julio 160",
      localidad: "Alcira Gigena, Córdoba",
      horariosAtencion: "Lunes a Viernes · Atención con turno previo y circuitos programados",
      emailInstitucional: "centromedicopauluccidirectorio@gmail.com",
      instagramCemepUrl: "https://www.instagram.com/centromedicopaulucci/",
      instagramPlusUrl: "https://www.instagram.com/cemepplus/",
      farmaciaRedNombre: "Farmacia Ferrocchio",
      farmaciaRedDireccion: "Pellegrini 209 — Alcira Gigena",
      farmaciaRedWhatsapp: "+54 9 3585 709327",
      avisoSuperiorActivo: true,
      avisoSuperiorTexto:
        "🩺 Nuevo Circuito Integral de Salud y Renovación EMMAC · 50% DTO exclusivo para afiliados CEMEP Plus · Solicitá tu turno online",
    },
    cemep: {
      whatsappDigits: "5493584381009",
      whatsappDisplay: "+54 9 3584 381009",
      heroBadge: "Centro Médico Paulucci · Alcira Gigena",
      heroTitle: "Salud y bienestar para toda la familia.",
      heroSubtitle:
        "+30 profesionales unidos bajo un mismo compromiso. Consultorios médicos, diagnóstico por imágenes, cardiología, laboratorio y circuitos integrales en un solo lugar.",
      statProfesionalesNum: "+30",
      statProfesionalesLabel: "Profesionales en grilla · Un mismo compromiso",
      statRedNum: "+45",
      statRedLabel: "Personas trabajando en red por la salud",
      statTrayectoriaNum: "100%",
      statTrayectoriaLabel: "Turnos online, estudios y recetas digitales",
      circuitoTitulo: "Circuito Integral de Salud",
      circuitoSubtitulo:
        "POV: Cuando decidís hacer una pausa y poner tu salud en primer lugar. Hasta 8 consultas y estudios coordinados en una misma mañana.",
      circuitoFechaTexto: "Cupos limitados por fecha mensual · Reservá tu lugar con anticipación",
      circuitoBeneficioPlus: "50% DTO exclusivo para afiliados CEMEP Plus",
      emmacTitulo: "Renovación EMMAC — Agencia Córdoba Deportes",
      emmacDescripcion:
        "Realizá tu Examen Médico para Mediana y Alta Competencia (deportes.cba.gov.ar) con evaluación cardiológica y clínica completa en CEMEP.",
      especialidadesDestacadas: [
        "Cardiología e Imágenes Cardiovasculares",
        "Traumatología",
        "Clínica Médica · Diabetes y Obesidad",
        "Diagnóstico por Imágenes y Ecografías",
        "Kinesiología y Postura",
        "Laboratorio Clínico",
        "Radiología Digital",
        "Circuito Integral & EMMAC",
      ],
      profesionalesDestacados: [
        {
          id: "prof-miragaya",
          nombre: "Dra. Ma. Agustina Miragaya",
          especialidad: "Cardiología e Imágenes Cardiovasculares",
          diasAtencion: "Martes",
          detalle:
            "Ecocardiograma Doppler, Ecodoppler de vasos de cuello, Presurometría (MAPA), Ergometría, Electrocardiograma y Holter.",
          badge: "Nuevos estudios",
        },
        {
          id: "prof-nunez",
          nombre: "Dr. Franco Núñez",
          especialidad: "Traumatología",
          diasAtencion: "Viernes",
          detalle:
            "Diagnóstico y tratamiento osteoarticular, prevención de sobrecarga cervical y salud deportiva.",
          badge: "Tips de postura",
        },
        {
          id: "prof-valdatta",
          nombre: "Dra. Lucrecia Valdatta",
          especialidad: "Clínica Médica · Esp. en Diabetes y Obesidad",
          diasAtencion: "Lunes y Miércoles",
          detalle:
            "Consultorio abierto y seguimiento metabólico personalizado con tratamientos actualizados.",
          badge: "Consultorio abierto",
        },
        {
          id: "prof-carabajal",
          nombre: "Dra. María Elena Carabajal",
          especialidad: "Diagnóstico por Imágenes",
          diasAtencion: "Turnos programados",
          detalle:
            "Ecografía mamaria, obstétrica y general con nuestro nuevo ecógrafo de alta definición.",
          badge: "Nuevo ecógrafo",
        },
      ],
      tipsSalud: [
        {
          id: "tip-cervical",
          categoria: "Traumatología · Dr. Franco Núñez",
          autor: "Dr. Franco Núñez",
          titulo: "4 tips para reducir la sobrecarga cervical por uso del celular",
          resumen:
            "Pequeños ajustes diarios evitan contracturas, mareos y dolor de cuello al usar pantallas.",
          bullets: [
            "Usá el celular apoyando los antebrazos sobre una mesa para elevar la pantalla.",
            "Llevá el teléfono a la altura de tus ojos en lugar de bajar la cabeza.",
            "Hacé pausas activas de 2 minutos cada 30 minutos de pantalla.",
            "Fortalecé espalda alta y elongá cuello suavemente al final del día.",
          ],
          tagCta: "Atiende los viernes · Solicitá tu turno",
          acentoHex: "#0099D8",
          destacado: true,
        },
        {
          id: "tip-postura",
          categoria: "Kinesiología y Prevención",
          autor: "Equipo CEMEP",
          titulo: "5 hábitos para mejorar la postura cuando pasás mucho tiempo sentado",
          resumen:
            "Cuidá tu columna lumbar y cervical durante la jornada laboral o de estudio con estas pautas simples.",
          bullets: [
            "Apoyá ambos pies firmes en el suelo con rodillas a 90°.",
            "Mantené el monitor a la altura de la línea visual.",
            "Alineá hombros relajados hacia atrás, evitando encorvarte.",
            "Levantate a caminar brevemente cada 45-60 minutos.",
            "Consultá a tiempo ante molestias persistentes en espalda o cintura.",
          ],
          tagCta: "Cuidarte hoy es prevenir mañana",
          acentoHex: "#57B7B8",
        },
        {
          id: "tip-cardio",
          categoria: "Cardiología · Dra. Ma. Agustina Miragaya",
          autor: "Dra. Ma. Agustina Miragaya",
          titulo: "Estudios cardiológicos completos en un solo lugar",
          resumen:
            "Realizá tus chequeos cardiovasculares en Alcira Gigena sin viajar: prevención, deporte y seguimiento.",
          bullets: [
            "Ecocardiograma Doppler y Ecodoppler de vasos de cuello.",
            "Presurometría (MAPA 24 hs) y Holter de ritmo cardíaco.",
            "Ergometría y Electrocardiograma para apto físico y EMMAC.",
          ],
          tagCta: "Atiende los martes · Reservá tu estudio",
          acentoHex: "#1B335D",
        },
        {
          id: "tip-diabetes",
          categoria: "¡Consultorio abierto! · Dra. Lucrecia Valdatta",
          autor: "Dra. Lucrecia Valdatta",
          titulo: "Clínica Médica especializada en Diabetes y Obesidad",
          resumen:
            "Acompañamiento médico serio, cercano y basado en evidencia sobre hábitos y tratamientos modernos.",
          bullets: [
            "Evaluación metabólica integral y seguimiento personalizado.",
            "Información clara sobre tratamientos actuales e inyectables supervisados.",
            "Plan de controles periódicos articulado con laboratorio en CEMEP.",
          ],
          tagCta: "Atiende lunes y miércoles · Pedí tu cita",
          acentoHex: "#A6CA0E",
        },
      ],
    },
    cemepPlus: {
      whatsappDigits: "5493584124950",
      whatsappDisplay: "+54 9 358 412 4950",
      heroBadge: "CEMEP Plus · Cobertura Médica Familiar",
      heroTitle: "Cobertura médica para toda la familia.",
      heroSubtitle:
        "El respaldo que vos y tu familia necesitan en Alcira Gigena: consultas médicas, estudios, diagnóstico y beneficios exclusivos en comercios adheridos.",
      sloganCorto: "Salud con un Plus 😉",
      beneficioEstrellaTitulo: "50% de cobertura exclusiva en Circuitos Mensuales",
      beneficioEstrellaTexto:
        "Accedé con 50% OFF al Circuito Integral de Salud (8 consultas en una mañana) y al Circuito EMMAC presentando tu credencial CEMEP Plus.",
      pilares: [
        {
          id: "pilar-consultas",
          titulo: "Consultas Médicas",
          subtitulo: "Atención con más de 30 profesionales en CEMEP",
          items: [
            "Clínica médica, cardiología, traumatología y especialidades",
            "Seguimiento familiar cercano en 9 de Julio 160",
            "Gestión ágil de turnos y recetas digitales",
          ],
        },
        {
          id: "pilar-estudios",
          titulo: "Estudios Especializados",
          subtitulo: "Tecnología y prevención a tu alcance",
          items: [
            "MAPA (Presurometría), Holter, Electrocardiograma y Ergometría",
            "50% DTO en Circuito Integral de Salud",
            "50% DTO en Circuito EMMAC deportivo",
          ],
        },
        {
          id: "pilar-diagnostico",
          titulo: "Diagnóstico",
          subtitulo: "Resultados claros y seguimiento digital",
          items: [
            "Ecografías obstétricas, mamarias y generales (nuevo ecógrafo)",
            "Radiografías digitales en sede",
            "Laboratorio clínico y acceso online a tus estudios",
          ],
        },
      ],
      campanasDestacadas: [
        {
          id: "camp-embarazo",
          etiqueta: "Maternidad",
          titulo: "Tu embarazo, nuestra cobertura",
          descripcion:
            "Acompañamos cada etapa con cobertura para ecografías obstétricas y controles médicos en CEMEP.",
        },
        {
          id: "camp-corazon",
          etiqueta: "Cardiología",
          titulo: "Cobertura que llega al corazón",
          descripcion:
            "Consultas cardiológicas, Ecocardiograma Doppler, Electro, MAPA, Holter y Ergometría con respaldo CEMEP Plus.",
        },
        {
          id: "camp-prevencion",
          etiqueta: "Prevención",
          titulo: "Detección temprana y controles anuales",
          descripcion:
            "Controles ginecológicos, ecografía mamaria y chequeos preventivos con acompañamiento profesional todo el año.",
        },
      ],
      comerciosAdheridos: [
        {
          id: "com-ferrocchio",
          nombre: "Farmacia Ferrocchio",
          rubro: "Farmacia y Perfumería en Red",
          beneficio:
            "Beneficios y descuentos exclusivos para afiliados CEMEP Plus en farmacia, perfumería y campañas especiales (hasta 15% OFF en líneas seleccionadas).",
          direccion: "Pellegrini 209 — Alcira Gigena",
          instagram: "@farmacia_ferrocchio",
          diasVigencia: "Todos los días presentando credencial",
        },
        {
          id: "com-mimitos",
          nombre: "Mi Mitos",
          rubro: "Indumentaria y Accesorios Infantiles",
          beneficio:
            "15% OFF en indumentaria y 10% OFF en accesorios para afiliados CEMEP Plus.",
          direccion: "Alcira Gigena, Córdoba",
          instagram: "@mi_mito.s",
          diasVigencia: "Todos los martes presentando credencial",
        },
      ],
      ctaAfiliacionTitulo: "Si todavía no sos parte, afiliate hoy",
      ctaAfiliacionTexto:
        "Escribinos por WhatsApp al 358 412 4950 y conocé el plan ideal para vos y tu familia. Salud con un Plus 😉",
    },
  };
}

export function buildInitialHistoriaClinicaDb(): HistoriaClinicaDbDoc {
  return {
    updatedAt: new Date().toISOString(),
    lastRecetaSeq: 0,
    fichas: [],
    evoluciones: [],
    estudios: [],
    recetas: [],
  };
}

export function buildInitialGestionWebDb(): GestionWebDbDoc {
  const nowIso = new Date().toISOString();
  const initialContent = buildDefaultCemepWebContent();
  return {
    updatedAt: nowIso,
    googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
    publishedAt: nowIso,
    publishedBy: "Sistema",
    hasUnpublishedChanges: false,
    draftContent: JSON.parse(JSON.stringify(initialContent)),
    publishedContent: JSON.parse(JSON.stringify(initialContent)),
    webUsers: [],
    profesionalAccounts: [],
  };
}

export function computeImc(pesoKgRaw?: string, tallaCmRaw?: string): string {
  const peso = Number(String(pesoKgRaw || "").replace(",", "."));
  const tallaCm = Number(String(tallaCmRaw || "").replace(",", "."));
  if (!Number.isFinite(peso) || !Number.isFinite(tallaCm) || peso <= 0 || tallaCm <= 40) {
    return "";
  }
  const m = tallaCm / 100;
  return (peso / (m * m)).toFixed(1);
}
