// ============================================================================
// MINISISTEMA — CATÁLOGOS OFICIALES ARGENTINA PARA TURNERO WEB
// Obras Sociales (SSSalud RNOS: CCT / Sindicales, Prepagas, Provinciales, PAMI)
// + Planes reales asociados + Especialidades Médicas con duración (5..60 min)
// ============================================================================

import type {
  EspecialidadRecord,
  ObraSocialRecord,
  ObraSocialTipo,
  PlanObraSocialRecord,
  TurnoDurationMinutes,
} from "./turnos-types";

export interface ObraSocialSeedEntry {
  id: string;
  codigoRnos: string;
  sigla: string;
  nombre: string;
  tipo: ObraSocialTipo;
  web?: string;
  planes: Array<{
    nombre: string;
    codigo?: string;
    requiereAutorizacion?: boolean;
  }>;
}

export const ARGENTINA_OBRAS_SOCIALES_CATALOG: ObraSocialSeedEntry[] = [
  // ===================== PREPAGAS =====================
  {
    id: "os_osde",
    codigoRnos: "400800",
    sigla: "OSDE",
    nombre: "OSDE — Organización de Servicios Directos Empresarios",
    tipo: "PREPAGA",
    web: "https://www.osde.com.ar",
    planes: [
      { nombre: "Plan 210", codigo: "210" },
      { nombre: "Plan 310", codigo: "310" },
      { nombre: "Plan 410", codigo: "410" },
      { nombre: "Plan 450", codigo: "450" },
      { nombre: "Plan 510", codigo: "510" },
      { nombre: "Plan Neo / Jóvenes", codigo: "NEO" },
    ],
  },
  {
    id: "os_sancor",
    codigoRnos: "EMP-SANCOR",
    sigla: "Sancor Salud",
    nombre: "Asociación Mutual Sancor Salud",
    tipo: "PREPAGA",
    web: "https://www.sancorsalud.com.ar",
    planes: [
      { nombre: "Plan 1000B", codigo: "1000B" },
      { nombre: "Plan 1500B", codigo: "1500B" },
      { nombre: "Plan 2000", codigo: "2000" },
      { nombre: "Plan 3000", codigo: "3000" },
      { nombre: "Plan 3500", codigo: "3500" },
      { nombre: "Plan 4000", codigo: "4000" },
      { nombre: "Plan 4500", codigo: "4500" },
      { nombre: "Plan 5000 Exclusive", codigo: "5000" },
      { nombre: "Plan 6000 Exclusive", codigo: "6000" },
    ],
  },
  {
    id: "os_swiss",
    codigoRnos: "EMP-SWISS",
    sigla: "Swiss Medical",
    nombre: "Swiss Medical Medicina Privada",
    tipo: "PREPAGA",
    web: "https://www.swissmedical.com.ar",
    planes: [
      { nombre: "SMG02", codigo: "SMG02" },
      { nombre: "SMG10", codigo: "SMG10" },
      { nombre: "SMG20", codigo: "SMG20" },
      { nombre: "SMG30", codigo: "SMG30" },
      { nombre: "SMG40", codigo: "SMG40" },
      { nombre: "SMG50", codigo: "SMG50" },
      { nombre: "SMG60 Black", codigo: "SMG60" },
    ],
  },
  {
    id: "os_galeno",
    codigoRnos: "EMP-GALENO",
    sigla: "Galeno",
    nombre: "Galeno Argentina S.A.",
    tipo: "PREPAGA",
    web: "https://www.galeno.com.ar",
    planes: [
      { nombre: "Azul 220", codigo: "220" },
      { nombre: "Plata 330", codigo: "330" },
      { nombre: "Oro 440", codigo: "440" },
      { nombre: "Blanco 550", codigo: "550" },
    ],
  },
  {
    id: "os_medicus",
    codigoRnos: "EMP-MEDICUS",
    sigla: "Medicus",
    nombre: "Medicus S.A. de Asistencia Médica",
    tipo: "PREPAGA",
    web: "https://www.medicus.com.ar",
    planes: [
      { nombre: "Plan Flex", codigo: "FLEX" },
      { nombre: "Plan Family", codigo: "FAMILY" },
      { nombre: "Plan Celeste", codigo: "CELESTE" },
      { nombre: "Plan Azul", codigo: "AZUL" },
      { nombre: "Plan One", codigo: "ONE" },
    ],
  },
  {
    id: "os_federada",
    codigoRnos: "EMP-FEDERADA",
    sigla: "Federada Salud",
    nombre: "Federada Salud — Mutual Federada 25 de Junio",
    tipo: "PREPAGA",
    web: "https://www.federada.com",
    planes: [
      { nombre: "Plan 1000 / Plan 1", codigo: "P1" },
      { nombre: "Plan 2000 / Plan 2", codigo: "P2" },
      { nombre: "Plan 3000 / Plan 3", codigo: "P3" },
      { nombre: "Plan 4000", codigo: "P4000" },
      { nombre: "Plan Flex", codigo: "FLEX" },
    ],
  },
  {
    id: "os_medife",
    codigoRnos: "EMP-MEDIFE",
    sigla: "Medifé",
    nombre: "Medifé Asociación Civil",
    tipo: "PREPAGA",
    web: "https://www.medife.com.ar",
    planes: [
      { nombre: "Bronce", codigo: "BRONCE" },
      { nombre: "Plata", codigo: "PLATA" },
      { nombre: "Oro", codigo: "ORO" },
      { nombre: "Platinum", codigo: "PLATINUM" },
    ],
  },
  {
    id: "os_avalian",
    codigoRnos: "EMP-AVALIAN",
    sigla: "Avalian",
    nombre: "Avalian (ex ACA Salud)",
    tipo: "PREPAGA",
    web: "https://www.avalian.com",
    planes: [
      { nombre: "Plan Cerca", codigo: "CERCA" },
      { nombre: "Plan Integral", codigo: "INTEGRAL" },
      { nombre: "Plan Superior", codigo: "SUPERIOR" },
      { nombre: "Plan Selecta", codigo: "SELECTA" },
    ],
  },
  {
    id: "os_prevencion",
    codigoRnos: "EMP-PREVENCION",
    sigla: "Prevención Salud",
    nombre: "Prevención Salud (Grupo Sancor Seguros)",
    tipo: "PREPAGA",
    web: "https://www.prevencionsalud.com.ar",
    planes: [
      { nombre: "Plan A1", codigo: "A1" },
      { nombre: "Plan A2", codigo: "A2" },
      { nombre: "Plan A4", codigo: "A4" },
      { nombre: "Plan A6", codigo: "A6" },
    ],
  },
  {
    id: "os_omint",
    codigoRnos: "EMP-OMINT",
    sigla: "Omint",
    nombre: "Omint S.A. de Servicios",
    tipo: "PREPAGA",
    web: "https://www.omint.com.ar",
    planes: [
      { nombre: "Plan 1500", codigo: "1500" },
      { nombre: "Plan 2500", codigo: "2500" },
      { nombre: "Plan 4500", codigo: "4500" },
      { nombre: "Plan 6500", codigo: "6500" },
      { nombre: "Plan 8500", codigo: "8500" },
    ],
  },
  {
    id: "os_accord",
    codigoRnos: "EMP-ACCORD",
    sigla: "Accord Salud",
    nombre: "Accord Salud (Plan Superador Unión Personal)",
    tipo: "PREPAGA",
    web: "https://www.accordsalud.com.ar",
    planes: [
      { nombre: "Accord 110", codigo: "110" },
      { nombre: "Accord 210", codigo: "210" },
      { nombre: "Accord 310", codigo: "310" },
      { nombre: "Accord Dorado", codigo: "DORADO" },
    ],
  },
  {
    id: "os_jerarquicos",
    codigoRnos: "EMP-JERARQUICOS",
    sigla: "Jerárquicos Salud",
    nombre: "Asociación Mutual del Personal Jerárquico de Bancos Oficiales",
    tipo: "PREPAGA",
    web: "https://www.jerarquicos.com",
    planes: [
      { nombre: "PMI 2000", codigo: "PMI2000" },
      { nombre: "PMI 3000", codigo: "PMI3000" },
      { nombre: "Plan Sanatorio / Integral", codigo: "INT" },
    ],
  },
  {
    id: "os_osdepym",
    codigoRnos: "401704",
    sigla: "OSDEPYM",
    nombre: "Obra Social de Empresarios, Profesionales y Monotributistas",
    tipo: "PREPAGA",
    web: "https://www.osdepym.com.ar",
    planes: [
      { nombre: "Plan Base / PMO", codigo: "PMO" },
      { nombre: "Plan 800", codigo: "800" },
      { nombre: "Plan 1000", codigo: "1000" },
      { nombre: "Plan 2500", codigo: "2500" },
      { nombre: "Plan 4000", codigo: "4000" },
    ],
  },
  {
    id: "os_hospital_italiano",
    codigoRnos: "EMP-HIBA",
    sigla: "Plan de Salud HIBA",
    nombre: "Plan de Salud del Hospital Italiano",
    tipo: "PREPAGA",
    web: "https://www.hospitalitaliano.org.ar",
    planes: [
      { nombre: "Plan 200", codigo: "200" },
      { nombre: "Plan 202", codigo: "202" },
      { nombre: "Plan 300", codigo: "300" },
      { nombre: "Plan 305", codigo: "305" },
    ],
  },
  {
    id: "os_luis_pasteur",
    codigoRnos: "400404",
    sigla: "Luis Pasteur",
    nombre: "Obra Social del Personal de Dirección de Sanidad Luis Pasteur",
    tipo: "PREPAGA",
    web: "https://www.oslpasteur.com.ar",
    planes: [
      { nombre: "Plan N", codigo: "N" },
      { nombre: "Plan S", codigo: "S" },
      { nombre: "Plan M", codigo: "M" },
      { nombre: "Plan V", codigo: "V" },
    ],
  },

  // ===================== CONVENIO COLECTIVO DE TRABAJO (SSSALUD RNOS) =====================
  {
    id: "os_osecac",
    codigoRnos: "126205",
    sigla: "OSECAC",
    nombre: "Obra Social de Empleados de Comercio y Actividades Civiles",
    tipo: "CCT",
    web: "https://www.osecac.org.ar",
    planes: [
      { nombre: "Plan Obligatorio (PMO)", codigo: "PMO", requiereAutorizacion: true },
      { nombre: "Plan Materno Infantil", codigo: "PMI" },
      { nombre: "Plan Superador / Adherente", codigo: "SUP" },
    ],
  },
  {
    id: "os_osprera",
    codigoRnos: "119302",
    sigla: "OSPRERA",
    nombre: "Obra Social del Personal Rural y Estibadores de la Rep. Argentina",
    tipo: "CCT",
    web: "https://www.osprera.org.ar",
    planes: [
      { nombre: "Plan General (PMO)", codigo: "PMO", requiereAutorizacion: true },
      { nombre: "Plan Materno Infantil", codigo: "PMI" },
    ],
  },
  {
    id: "os_up",
    codigoRnos: "104307",
    sigla: "Unión Personal",
    nombre: "Obra Social de la Unión del Personal Civil de la Nación (UPCN)",
    tipo: "CCT",
    web: "https://www.unionpersonal.com.ar",
    planes: [
      { nombre: "Plan Classic", codigo: "CLASSIC" },
      { nombre: "Plan Familiar", codigo: "FAMILIAR" },
      { nombre: "Plan Platino", codigo: "PLATINO" },
    ],
  },
  {
    id: "os_uom",
    codigoRnos: "112103",
    sigla: "OSUOMRA (UOM)",
    nombre: "Obra Social de la Unión Obrera Metalúrgica",
    tipo: "CCT",
    web: "https://www.uom.org.ar",
    planes: [
      { nombre: "Plan General (PMO)", codigo: "PMO", requiereAutorizacion: true },
      { nombre: "Plan Familiar", codigo: "FAM" },
    ],
  },
  {
    id: "os_ospecon",
    codigoRnos: "105409",
    sigla: "OSPECON (UOCRA)",
    nombre: "Obra Social del Personal de la Construcción",
    tipo: "CCT",
    web: "https://www.construirsalud.com.ar",
    planes: [
      { nombre: "Construir Salud PMO", codigo: "PMO", requiereAutorizacion: true },
      { nombre: "Plan Materno Infantil", codigo: "PMI" },
    ],
  },
  {
    id: "os_osba_bancaria",
    codigoRnos: "101809",
    sigla: "OSBA / Bancaria",
    nombre: "Obra Social Bancaria Argentina",
    tipo: "CCT",
    web: "https://www.osba.org.ar",
    planes: [
      { nombre: "Plan General", codigo: "GEN" },
      { nombre: "Plan Superador", codigo: "SUP" },
    ],
  },
  {
    id: "os_oschoca",
    codigoRnos: "103205",
    sigla: "OSCHOCA",
    nombre: "Obra Social de Choferes de Camiones",
    tipo: "CCT",
    web: "https://www.oschoca.org.ar",
    planes: [
      { nombre: "Plan General (PMO)", codigo: "PMO", requiereAutorizacion: true },
    ],
  },
  {
    id: "os_ospedyc",
    codigoRnos: "106006",
    sigla: "OSPEDYC",
    nombre: "Obra Social del Personal de Entidades Deportivas y Civiles (UTEDYC)",
    tipo: "CCT",
    web: "https://www.ospedyc.org.ar",
    planes: [
      { nombre: "Plan Integral", codigo: "INT" },
      { nombre: "Plan Familia", codigo: "FAM" },
      { nombre: "Plan Superior", codigo: "SUP" },
    ],
  },
  {
    id: "os_ospia",
    codigoRnos: "101205",
    sigla: "OSPIA",
    nombre: "Obra Social del Personal de Industrias de la Alimentación",
    tipo: "CCT",
    web: "https://www.ospia.org.ar",
    planes: [
      { nombre: "Plan Obligatorio (PMO)", codigo: "PMO" },
      { nombre: "Plan Complementario", codigo: "COMP" },
    ],
  },
  {
    id: "os_ospe",
    codigoRnos: "115300",
    sigla: "OSPE",
    nombre: "Obra Social de Petroleros",
    tipo: "CCT",
    web: "https://www.ospesalud.com.ar",
    planes: [
      { nombre: "Plan A-404", codigo: "A404" },
      { nombre: "Plan A-425", codigo: "A425" },
      { nombre: "Plan A-606", codigo: "A606" },
      { nombre: "Plan A-704", codigo: "A704" },
    ],
  },
  {
    id: "os_ospsa",
    codigoRnos: "119500",
    sigla: "OSPSA (Sanidad)",
    nombre: "Obra Social del Personal de la Sanidad Argentina",
    tipo: "CCT",
    web: "https://www.sanidad.org.ar",
    planes: [
      { nombre: "Plan General (PMO)", codigo: "PMO" },
    ],
  },
  {
    id: "os_osmata",
    codigoRnos: "111704",
    sigla: "OSMATA",
    nombre: "Obra Social del Sindicato de Mecánicos y Afines (SMATA)",
    tipo: "CCT",
    web: "https://www.osmata.com.ar",
    planes: [
      { nombre: "Plan General (PMO)", codigo: "PMO" },
      { nombre: "Plan Superador", codigo: "SUP" },
    ],
  },
  {
    id: "os_osuthgra",
    codigoRnos: "108804",
    sigla: "OSUTHGRA",
    nombre: "Obra Social de Trabajadores Hoteleros y Gastronómicos",
    tipo: "CCT",
    web: "https://www.osuthgra.org.ar",
    planes: [
      { nombre: "Plan Base (PMO)", codigo: "PMO" },
    ],
  },
  {
    id: "os_osplad",
    codigoRnos: "106501",
    sigla: "OSPLAD",
    nombre: "Obra Social para la Actividad Docente",
    tipo: "CCT",
    web: "https://www.osplad.org.ar",
    planes: [
      { nombre: "Plan Base / Obligatorio", codigo: "PMO" },
      { nombre: "Plan Óptimo", codigo: "OPT" },
    ],
  },
  {
    id: "os_osseg",
    codigoRnos: "119708",
    sigla: "OSSEG",
    nombre: "Obra Social de Seguros",
    tipo: "CCT",
    web: "https://www.osseg.org.ar",
    planes: [
      { nombre: "Plan Integral", codigo: "INT" },
      { nombre: "Plan Especial", codigo: "ESP" },
    ],
  },
  {
    id: "os_osfatlyf",
    codigoRnos: "111001",
    sigla: "OSFATLyF",
    nombre: "Obra Social de Luz y Fuerza",
    tipo: "CCT",
    web: "https://www.osfatlyf.org",
    planes: [
      { nombre: "Plan Base (PMO)", codigo: "PMO" },
      { nombre: "Plan Superador", codigo: "SUP" },
    ],
  },

  // ===================== PAMI & PROVINCIALES / ESTATALES =====================
  {
    id: "os_pami",
    codigoRnos: "500807",
    sigla: "PAMI",
    nombre: "PAMI — Instituto Nacional de Servicios Sociales para Jubilados y Pensionados",
    tipo: "PAMI",
    web: "https://www.pami.org.ar",
    planes: [
      { nombre: "Plan General (Médico de Cabecera)", codigo: "CAB", requiereAutorizacion: false },
      { nombre: "Especialistas (Con Orden / Derivación)", codigo: "ESP", requiereAutorizacion: true },
      { nombre: "Veteranos de Guerra", codigo: "VG" },
    ],
  },
  {
    id: "os_apross",
    codigoRnos: "PROV-CBA",
    sigla: "APROSS",
    nombre: "APROSS — Administración Provincial del Seguro de Salud (Córdoba)",
    tipo: "ESTATAL_PROVINCIAL",
    web: "https://www.apross.gov.ar",
    planes: [
      { nombre: "Plan Obligatorio (Afiliado Directo)", codigo: "OBL" },
      { nombre: "Plan Voluntario / Adherente", codigo: "VOL" },
      { nombre: "Plan Materno Infantil", codigo: "PMI" },
    ],
  },
  {
    id: "os_ioma",
    codigoRnos: "PROV-BA",
    sigla: "IOMA",
    nombre: "IOMA — Instituto de Obra Médico Asistencial (Buenos Aires)",
    tipo: "ESTATAL_PROVINCIAL",
    web: "https://www.ioma.gba.gob.ar",
    planes: [
      { nombre: "Plan Obligatorio", codigo: "OBL" },
      { nombre: "Plan Voluntario", codigo: "VOL" },
    ],
  },
  {
    id: "os_iapos",
    codigoRnos: "PROV-SF",
    sigla: "IAPOS",
    nombre: "IAPOS — Instituto Autárquico Provincial de Obra Social (Santa Fe)",
    tipo: "ESTATAL_PROVINCIAL",
    web: "https://www.santafe.gov.ar/iapos",
    planes: [
      { nombre: "Plan General", codigo: "GEN" },
      { nombre: "Servicio Complementario", codigo: "COMP" },
    ],
  },
  {
    id: "os_osep",
    codigoRnos: "PROV-MZA",
    sigla: "OSEP",
    nombre: "OSEP — Obra Social de Empleados Públicos (Mendoza)",
    tipo: "ESTATAL_PROVINCIAL",
    web: "https://osepmendoza.com.ar",
    planes: [
      { nombre: "Plan General", codigo: "GEN" },
    ],
  },
  {
    id: "os_daspu",
    codigoRnos: "UNIV-UNC",
    sigla: "DASPU",
    nombre: "DASPU — Dirección de Asistencia Social del Personal Universitario (UNC)",
    tipo: "ESTATAL_PROVINCIAL",
    web: "https://www.daspu.com.ar",
    planes: [
      { nombre: "Plan Básico", codigo: "BAS" },
      { nombre: "Plan Superador", codigo: "SUP" },
    ],
  },
  {
    id: "os_iosfa",
    codigoRnos: "EST-IOSFA",
    sigla: "IOSFA",
    nombre: "IOSFA — Instituto de Obra Social de las Fuerzas Armadas y de Seguridad",
    tipo: "ESTATAL_PROVINCIAL",
    web: "https://www.iosfa.gob.ar",
    planes: [
      { nombre: "Plan General", codigo: "GEN" },
    ],
  },
  {
    id: "os_ospjn",
    codigoRnos: "EST-PJN",
    sigla: "OSPJN",
    nombre: "Obra Social del Poder Judicial de la Nación",
    tipo: "ESTATAL_PROVINCIAL",
    web: "https://www.ospjn.gov.ar",
    planes: [
      { nombre: "Plan General", codigo: "GEN" },
    ],
  },
];

export interface EspecialidadSeedEntry {
  id: string;
  nombre: string;
  duracionMinutos: TurnoDurationMinutes;
  permiteVideollamada: boolean;
  valorConsultaParticularSugeridoArs: number;
  colorHex: string;
  descripcion: string;
}

export const ARGENTINA_ESPECIALIDADES_CATALOG: EspecialidadSeedEntry[] = [
  { id: "esp_clinica", nombre: "Clínica Médica", duracionMinutos: 20, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 25000, colorHex: "#0f766e", descripcion: "Atención médica integral de adultos, chequeos y seguimiento." },
  { id: "esp_cardiologia", nombre: "Cardiología", duracionMinutos: 20, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 32000, colorHex: "#dc2626", descripcion: "Control cardiovascular, electrocardiograma y riesgo quirúrgico." },
  { id: "esp_traumatologia", nombre: "Traumatología y Ortopedia", duracionMinutos: 20, permiteVideollamada: false, valorConsultaParticularSugeridoArs: 30000, colorHex: "#2563eb", descripcion: "Lesiones osteoarticulares, columna, rodilla y traumatología deportiva." },
  { id: "esp_psicologia", nombre: "Psicología", duracionMinutos: 45, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 26000, colorHex: "#7c3aed", descripcion: "Psicoterapia individual, pareja, adolescencia y orientación." },
  { id: "esp_psiquiatria", nombre: "Psiquiatría", duracionMinutos: 30, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 36000, colorHex: "#6d28d9", descripcion: "Evaluación y seguimiento psiquiátrico y psicofarmacológico." },
  { id: "esp_urologia", nombre: "Urología", duracionMinutos: 20, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 30000, colorHex: "#0284c7", descripcion: "Salud urológica masculina y femenina, controles preventivos." },
  { id: "esp_ginecologia", nombre: "Ginecología y Obstetricia", duracionMinutos: 25, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 30000, colorHex: "#db2777", descripcion: "Control ginecológico anual, embarazo y salud reproductiva." },
  { id: "esp_pediatria", nombre: "Pediatría", duracionMinutos: 20, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 25000, colorHex: "#059669", descripcion: "Control de niño sano, vacunación y atención pediátrica." },
  { id: "esp_dermatologia", nombre: "Dermatología", duracionMinutos: 15, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 28000, colorHex: "#d97706", descripcion: "Dermatología clínica, lunares, acné y cuidado de la piel." },
  { id: "esp_neurologia", nombre: "Neurología", duracionMinutos: 30, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 35000, colorHex: "#4f46e5", descripcion: "Cefaleas, trastornos del sueño, memoria y patología neurológica." },
  { id: "esp_oftalmologia", nombre: "Oftalmología", duracionMinutos: 15, permiteVideollamada: false, valorConsultaParticularSugeridoArs: 28000, colorHex: "#0891b2", descripcion: "Control visual, fondo de ojo, presión ocular y recetas." },
  { id: "esp_orl", nombre: "Otorrinolaringología", duracionMinutos: 15, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 28000, colorHex: "#0d9488", descripcion: "Oído, nariz, garganta, vértigo y disfonías." },
  { id: "esp_gastro", nombre: "Gastroenterología", duracionMinutos: 20, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 30000, colorHex: "#ea580c", descripcion: "Aparato digestivo, hepatología y estudios endoscópicos." },
  { id: "esp_endocrinologia", nombre: "Endocrinología", duracionMinutos: 25, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 32000, colorHex: "#9333ea", descripcion: "Tiroides, metabolismo, diabetes y trastornos hormonales." },
  { id: "esp_diabetologia", nombre: "Diabetología", duracionMinutos: 25, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 30000, colorHex: "#0369a1", descripcion: "Control glucémico, educación diabetológica y seguimiento." },
  { id: "esp_neumonologia", nombre: "Neumonología", duracionMinutos: 20, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 30000, colorHex: "#1d4ed8", descripcion: "Asma, EPOC, espirometrías y enfermedades respiratorias." },
  { id: "esp_reumatologia", nombre: "Reumatología", duracionMinutos: 30, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 34000, colorHex: "#b91c1c", descripcion: "Artritis, enfermedades autoinmunes y dolor articular." },
  { id: "esp_nutricion", nombre: "Nutrición", duracionMinutos: 30, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 22000, colorHex: "#16a34a", descripcion: "Planes alimentarios, antropometría y nutrición clínica/deportiva." },
  { id: "esp_kinesiologia", nombre: "Kinesiología y Fisioterapia", duracionMinutos: 40, permiteVideollamada: false, valorConsultaParticularSugeridoArs: 20000, colorHex: "#0284c7", descripcion: "Rehabilitación traumatológica, RPG y fisioterapia." },
  { id: "esp_fonoaudiologia", nombre: "Fonoaudiología", duracionMinutos: 30, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 22000, colorHex: "#c026d3", descripcion: "Lenguaje, voz, audición y deglución." },
  { id: "esp_odontologia", nombre: "Odontología General", duracionMinutos: 30, permiteVideollamada: false, valorConsultaParticularSugeridoArs: 25000, colorHex: "#06b6d4", descripcion: "Consultas odontológicas, prevención y tratamientos dentales." },
  { id: "esp_ortodoncia", nombre: "Ortodoncia", duracionMinutos: 20, permiteVideollamada: false, valorConsultaParticularSugeridoArs: 28000, colorHex: "#0e7490", descripcion: "Control de brackets, alineadores y ortopedia maxilar." },
  { id: "esp_alergia", nombre: "Alergia e Inmunología", duracionMinutos: 20, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 30000, colorHex: "#ca8a04", descripcion: "Alergias respiratorias, cutáneas, alimentarias e inmunoterapia." },
  { id: "esp_cirugia_general", nombre: "Cirugía General", duracionMinutos: 20, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 32000, colorHex: "#334155", descripcion: "Evaluación prequirúrgica, controles postoperatorios y pared abdominal." },
  { id: "esp_flebologia", nombre: "Flebología y Linfología", duracionMinutos: 20, permiteVideollamada: false, valorConsultaParticularSugeridoArs: 28000, colorHex: "#be123c", descripcion: "Insuficiencia venosa, várices y eco-doppler vascular." },
  { id: "esp_hematologia", nombre: "Hematología", duracionMinutos: 25, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 34000, colorHex: "#991b1b", descripcion: "Anemias, coagulación y trastornos hematológicos." },
  { id: "esp_infectologia", nombre: "Infectología", duracionMinutos: 25, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 32000, colorHex: "#15803d", descripcion: "Prevención, vacunación del adulto y enfermedades infecciosas." },
  { id: "esp_nefrologia", nombre: "Nefrología", duracionMinutos: 25, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 34000, colorHex: "#1e40af", descripcion: "Salud renal, hipertensión secundaria y control nefroprotector." },
  { id: "esp_oncologia", nombre: "Oncología Clínica", duracionMinutos: 30, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 38000, colorHex: "#7e22ce", descripcion: "Evaluación y seguimiento oncológico personalizado." },
  { id: "esp_geriatria", nombre: "Geriatría", duracionMinutos: 30, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 28000, colorHex: "#475569", descripcion: "Atención integral del adulto mayor y polifarmacia." },
  { id: "esp_medicina_familiar", nombre: "Medicina Familiar y General", duracionMinutos: 20, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 24000, colorHex: "#0f766e", descripcion: "Atención primaria continua para toda la familia." },
  { id: "esp_medicina_deporte", nombre: "Medicina del Deporte", duracionMinutos: 25, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 28000, colorHex: "#16a34a", descripcion: "Aptos físicos deportivos, rendimiento y prevención de lesiones." },
  { id: "esp_psicopedagogia", nombre: "Psicopedagogía", duracionMinutos: 45, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 22000, colorHex: "#9333ea", descripcion: "Evaluación y acompañamiento en procesos de aprendizaje." },
  { id: "esp_terapia_ocupacional", nombre: "Terapia Ocupacional", duracionMinutos: 45, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 22000, colorHex: "#0d9488", descripcion: "Autonomía funcional, neurodesarrollo y rehabilitación." },
  { id: "esp_ecografia", nombre: "Ecografía y Diagnóstico por Imágenes", duracionMinutos: 15, permiteVideollamada: false, valorConsultaParticularSugeridoArs: 26000, colorHex: "#1e3a8a", descripcion: "Ecografías abdominales, tiroideas, obstétricas y doppler." },
  { id: "esp_laboratorio", nombre: "Laboratorio de Análisis Clínicos", duracionMinutos: 10, permiteVideollamada: false, valorConsultaParticularSugeridoArs: 15000, colorHex: "#0369a1", descripcion: "Extracciones de sangre, cultivos y análisis bioquímicos." },
  { id: "esp_enfermeria", nombre: "Enfermería / Vacunatorio / Inyectables", duracionMinutos: 10, permiteVideollamada: false, valorConsultaParticularSugeridoArs: 10000, colorHex: "#059669", descripcion: "Curaciones, control de tensión arterial, inyectables y vacunas." },
  { id: "esp_mastologia", nombre: "Mastología", duracionMinutos: 20, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 32000, colorHex: "#ec4899", descripcion: "Control mamario preventivo y patología mamaria." },
  { id: "esp_proctologia", nombre: "Coloproctología", duracionMinutos: 20, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 32000, colorHex: "#b45309", descripcion: "Patología anorrectal y colorrectal." },
  { id: "esp_neurocirugia", nombre: "Neurocirugía", duracionMinutos: 30, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 40000, colorHex: "#312e81", descripcion: "Evaluación neuroquirúrgica de columna y sistema nervioso." },
  { id: "esp_cirugia_plastica", nombre: "Cirugía Plástica y Reparadora", duracionMinutos: 25, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 35000, colorHex: "#be185d", descripcion: "Cirugía reconstructiva, estética y dermatología quirúrgica." },
  { id: "esp_recetas_cert", nombre: "Renovación de Recetas / Certificados", duracionMinutos: 5, permiteVideollamada: true, valorConsultaParticularSugeridoArs: 12000, colorHex: "#14b8a6", descripcion: "Trámite rápido de recetas electrónicas y certificados médicos." },
];

export function buildSeedObrasSocialesAndPlanes(nowIso: string): {
  obrasSociales: ObraSocialRecord[];
  planes: PlanObraSocialRecord[];
} {
  const obrasSociales: ObraSocialRecord[] = [];
  const planes: PlanObraSocialRecord[] = [];

  for (const item of ARGENTINA_OBRAS_SOCIALES_CATALOG) {
    obrasSociales.push({
      id: item.id,
      codigoRnos: item.codigoRnos,
      sigla: item.sigla,
      nombre: item.nombre,
      tipo: item.tipo,
      web: item.web || "",
      activa: true,
      esCatalogoBase: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    item.planes.forEach((p, idx) => {
      planes.push({
        id: `plan_${item.id}_${idx + 1}`,
        obraSocialId: item.id,
        nombre: p.nombre,
        codigo: p.codigo || "",
        requiereAutorizacion: Boolean(p.requiereAutorizacion),
        copagoSugeridoArs: 0,
        activo: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    });
  }

  return { obrasSociales, planes };
}

export function inferEspecialidadCategoria(nombre: string): string {
  const n = String(nombre || "").toLowerCase();
  if (/(psicol|psiquiat|psicopedag|terapia ocupacional|fonoaudiol|neurolog)/.test(n)) {
    return "Salud Mental y Neurociencias";
  }
  if (/(cirug|traumatolog|ortoped|neurocirug|proctolog|urolog|flebolog)/.test(n)) {
    return "Quirúrgicas y Traumatología";
  }
  if (/(pediatr|ginecolog|obstetric|mastolog)/.test(n)) {
    return "Materno-Infantil y Mujer";
  }
  if (/(ecograf|imágen|imagen|laboratorio)/.test(n)) {
    return "Diagnóstico y Laboratorio";
  }
  if (/(kinesiol|fisioterap|nutrici|deporte)/.test(n)) {
    return "Rehabilitación y Bienestar";
  }
  if (/(odontolog|ortodoncia)/.test(n)) {
    return "Odontología";
  }
  if (/(enfermer|vacunat|receta|certificado)/.test(n)) {
    return "Enfermería y Trámites";
  }
  return "Clínica y Especialidades Médicas";
}

export function buildSeedEspecialidades(nowIso: string): EspecialidadRecord[] {
  return ARGENTINA_ESPECIALIDADES_CATALOG.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    categoria: inferEspecialidadCategoria(e.nombre),
    duracionMinutos: e.duracionMinutos,
    permiteVideollamada: e.permiteVideollamada,
    valorConsultaParticularSugeridoArs: e.valorConsultaParticularSugeridoArs,
    colorHex: e.colorHex,
    descripcion: e.descripcion,
    activa: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
}
