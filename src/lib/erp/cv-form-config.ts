import { ALL_WORLD_LANGUAGES, LANGUAGE_LEVEL_OPTIONS } from "./world-languages";

export type CvFieldSection =
  | "personal"
  | "ubicacion"
  | "postulacion"
  | "formacion"
  | "experiencia";

export type CvFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "email"
  | "tel"
  | "select";

export interface CvFormFieldConfig {
  key: string;
  label: string;
  section: CvFieldSection;
  type: CvFieldType;
  enabled: boolean;
  required: boolean;
  isCustom?: boolean;
  locked?: boolean;
  placeholder?: string;
  options?: string[];
}

export interface CvFormConfig {
  updatedAt: string;
  updatedBy?: string;
  fields: CvFormFieldConfig[];
}

export const CV_SECTION_LABELS: Record<CvFieldSection, string> = {
  personal: "Paso 1 · Datos Personales",
  ubicacion: "Paso 2 · Ubicación y Contacto",
  postulacion: "Paso 3 · Puesto, Disponibilidad y Pretensión",
  formacion: "Paso 4 · Estudios, Sistemas e Idiomas",
  experiencia: "Paso 5 · Experiencia Laboral y PDF",
};

export const DEFAULT_CV_FORM_FIELDS: CvFormFieldConfig[] = [
  // PASO 1: DATOS PERSONALES
  {
    key: "foto",
    label: "Fotografía de Perfil",
    section: "personal",
    type: "text",
    enabled: true,
    required: false,
  },
  {
    key: "tipoDoc",
    label: "Tipo Doc.",
    section: "personal",
    type: "select",
    enabled: true,
    required: true,
    options: ["DNI", "CUIL", "CUIT", "Pasaporte", "Doc. Extranjero"],
  },
  {
    key: "nroDoc",
    label: "Número (DNI)",
    section: "personal",
    type: "text",
    enabled: true,
    required: true,
    locked: true,
    placeholder: "Ej: 38123456",
  },
  {
    key: "nombres",
    label: "Nombre(s)",
    section: "personal",
    type: "text",
    enabled: true,
    required: true,
    locked: true,
    placeholder: "Ej: María Florencia",
  },
  {
    key: "apellidos",
    label: "Apellido(s)",
    section: "personal",
    type: "text",
    enabled: true,
    required: true,
    locked: true,
    placeholder: "Ej: González",
  },
  {
    key: "fechaNacimiento",
    label: "Fecha de Nacimiento",
    section: "personal",
    type: "date",
    enabled: true,
    required: true,
  },
  {
    key: "genero",
    label: "Género",
    section: "personal",
    type: "select",
    enabled: true,
    required: true,
    options: ["Femenino", "Masculino", "No binario", "Prefiero no especificar"],
  },
  {
    key: "estadoCivil",
    label: "Estado Civil",
    section: "personal",
    type: "select",
    enabled: true,
    required: true,
    options: [
      "Soltero/a",
      "Casado/a",
      "Unión convivencial",
      "Divorciado/a",
      "Viudo/a",
    ],
  },
  {
    key: "hijosACargo",
    label: "Cargas de Familia / Hijos",
    section: "personal",
    type: "select",
    enabled: true,
    required: true,
    options: [
      "Sin cargas de familia",
      "1 persona a cargo",
      "2 personas a cargo",
      "3 o más personas a cargo",
    ],
  },
  {
    key: "nacionalidad",
    label: "Nacionalidad",
    section: "personal",
    type: "text",
    enabled: true,
    required: true,
  },

  // PASO 2: UBICACIÓN Y CONTACTO
  {
    key: "pais",
    label: "País de Residencia",
    section: "ubicacion",
    type: "text",
    enabled: true,
    required: true,
  },
  {
    key: "provincia",
    label: "Provincia / Estado",
    section: "ubicacion",
    type: "text",
    enabled: true,
    required: true,
  },
  {
    key: "localidad",
    label: "Localidad / Ciudad",
    section: "ubicacion",
    type: "text",
    enabled: true,
    required: true,
  },
  {
    key: "cp",
    label: "Código Postal",
    section: "ubicacion",
    type: "text",
    enabled: true,
    required: true,
    placeholder: "Ej: 5800",
  },
  {
    key: "domicilioCalle",
    label: "Calle",
    section: "ubicacion",
    type: "text",
    enabled: true,
    required: true,
    placeholder: "Ej: Av. San Martín",
  },
  {
    key: "domicilioNumero",
    label: "Número",
    section: "ubicacion",
    type: "text",
    enabled: true,
    required: true,
    placeholder: "Ej: 450 (o S/N)",
  },
  {
    key: "domicilioBarrio",
    label: "Barrio",
    section: "ubicacion",
    type: "text",
    enabled: true,
    required: true,
    placeholder: "Ej: Centro",
  },
  {
    key: "domicilioPiso",
    label: "Piso",
    section: "ubicacion",
    type: "text",
    enabled: true,
    required: false,
    placeholder: "Opcional",
  },
  {
    key: "domicilioDpto",
    label: "Dpto.",
    section: "ubicacion",
    type: "text",
    enabled: true,
    required: false,
    placeholder: "Opcional",
  },
  {
    key: "domicilioEdificio",
    label: "Edificio",
    section: "ubicacion",
    type: "text",
    enabled: true,
    required: false,
    placeholder: "Opcional",
  },
  {
    key: "domicilioTorre",
    label: "Torre",
    section: "ubicacion",
    type: "text",
    enabled: true,
    required: false,
    placeholder: "Opcional",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    section: "ubicacion",
    type: "tel",
    enabled: true,
    required: true,
    placeholder: "Ej: 3585095475 (sin 0 ni 15)",
  },
  {
    key: "email",
    label: "Correo Electrónico",
    section: "ubicacion",
    type: "email",
    enabled: true,
    required: true,
    placeholder: "nombre@correo.com",
  },
  {
    key: "facebookUrl",
    label: "Facebook",
    section: "ubicacion",
    type: "text",
    enabled: true,
    required: true,
    placeholder: "Usuario o enlace (o 'No tengo')",
  },
  {
    key: "instagramUrl",
    label: "Instagram",
    section: "ubicacion",
    type: "text",
    enabled: true,
    required: true,
    placeholder: "@usuario (o 'No tengo')",
  },
  {
    key: "telefonoAlternativo",
    label: "Teléfono Alternativo",
    section: "ubicacion",
    type: "text",
    enabled: true,
    required: false,
    placeholder: "Opcional (familiar / fijo)",
  },
  {
    key: "linkedinUrl",
    label: "LinkedIn / Portfolio",
    section: "ubicacion",
    type: "text",
    enabled: true,
    required: false,
    placeholder: "https://linkedin.com/in/...",
  },

  // PASO 3: PUESTO, DISPONIBILIDAD Y PRETENSIÓN
  {
    key: "puestoPrincipal",
    label: "Puesto / Área Principal",
    section: "postulacion",
    type: "select",
    enabled: true,
    required: true,
    options: [
      "Atención al Cliente / Ventas de Salón",
      "Cajero/a y Facturación POS",
      "Repositor/a y Control de Góndola",
      "Administración / Contabilidad / Tesorería",
      "Depósito / Logística / Reparto",
      "Compras y Gestión de Proveedores",
      "E-commerce / Carrito Web / Redes Sociales",
      "Sistemas / Soporte Técnico / Desarrollo",
      "Comercial / Ejecutivo de Ventas",
      "Fiambrería / Carnicería / Panadería",
      "Encargado/a / Supervisión de Sucursal",
      "Limpieza / Mantenimiento / Maestranza",
      "Pasantía / Primer Empleo",
      "Otro puesto (especificar en presentación)",
    ],
  },
  {
    key: "puestoSecundario",
    label: "Segundo Puesto de Interés",
    section: "postulacion",
    type: "select",
    enabled: true,
    required: false,
    options: [
      "Atención al Cliente / Ventas de Salón",
      "Cajero/a y Facturación POS",
      "Repositor/a y Control de Góndola",
      "Administración / Contabilidad / Tesorería",
      "Depósito / Logística / Reparto",
      "Compras y Gestión de Proveedores",
      "E-commerce / Carrito Web / Redes Sociales",
      "Sistemas / Soporte Técnico / Desarrollo",
      "Comercial / Ejecutivo de Ventas",
      "Fiambrería / Carnicería / Panadería",
      "Encargado/a / Supervisión de Sucursal",
      "Limpieza / Mantenimiento / Maestranza",
      "Pasantía / Primer Empleo",
      "Otro puesto (especificar en presentación)",
    ],
  },
  {
    key: "experienciaTotal",
    label: "Experiencia Total Laboral",
    section: "postulacion",
    type: "select",
    enabled: true,
    required: true,
    options: [
      "Sin experiencia / Primer empleo",
      "Menos de 1 año",
      "1 a 2 años",
      "3 a 5 años",
      "5 a 10 años",
      "Más de 10 años",
    ],
  },
  {
    key: "disponibilidadHoraria",
    label: "Disponibilidad Horaria",
    section: "postulacion",
    type: "select",
    enabled: true,
    required: true,
    options: [
      "Full Time — Jornada Completa",
      "Part Time — Turno Mañana",
      "Part Time — Turno Tarde",
      "Turnos Rotativos / Horario Cortado",
      "Fines de Semana / Franquero",
    ],
  },
  {
    key: "incorporacion",
    label: "Disponibilidad de Incorporación",
    section: "postulacion",
    type: "select",
    enabled: true,
    required: false,
    options: [
      "Inmediata",
      "En 7 días",
      "En 15 días (preaviso)",
      "En 30 días",
      "A convenir",
    ],
  },
  {
    key: "modalidad",
    label: "Modalidad Preferida",
    section: "postulacion",
    type: "select",
    enabled: true,
    required: true,
    options: [
      "100% Presencial",
      "Híbrida (Presencial + Remoto)",
      "100% Remota",
    ],
  },
  {
    key: "licenciaConducir",
    label: "Licencia de Conducir",
    section: "postulacion",
    type: "select",
    enabled: true,
    required: true,
    options: [
      "No posee",
      "Moto (Clase A)",
      "Auto / Utilitario (Clase B1/B2)",
      "Camión / Carga (Clase C/E)",
      "Transporte Profesional (Clase D)",
    ],
  },
  {
    key: "movilidadPropia",
    label: "Movilidad Propia",
    section: "postulacion",
    type: "select",
    enabled: true,
    required: false,
    options: [
      "No posee / Transporte público",
      "Bicicleta",
      "Moto propia",
      "Auto propio",
      "Utilitario / Camioneta propia",
    ],
  },
  {
    key: "disponibilidadViajarRotar",
    label: "Disponibilidad para rotar / viajar",
    section: "postulacion",
    type: "select",
    enabled: true,
    required: false,
    options: ["Sí", "Eventualmente", "No"],
  },
  {
    key: "pretensionSalarial",
    label: "Pretensión Salarial Mensual",
    section: "postulacion",
    type: "select",
    enabled: true,
    required: true,
    options: [
      "Según convenio / A convenir",
      "Part Time — Acorde a media jornada",
      "Hasta $ 700.000 netos",
      "$ 700.000 a $ 1.000.000 netos",
      "$ 1.000.000 a $ 1.500.000 netos",
      "Más de $ 1.500.000 netos",
    ],
  },
  {
    key: "presentacion",
    label: "Breve Presentación Personal / Objetivo",
    section: "postulacion",
    type: "textarea",
    enabled: true,
    required: false,
    placeholder:
      "Contanos brevemente sobre tu perfil, fortalezas y motivación para sumarte al equipo...",
  },

  // PASO 4: ESTUDIOS, SISTEMAS E IDIOMAS
  {
    key: "nivelEstudios",
    label: "Nivel Máximo de Estudios",
    section: "formacion",
    type: "select",
    enabled: true,
    required: true,
    options: [
      "Primario",
      "Secundario",
      "Terciario / Tecnicatura",
      "Universitario",
      "Posgrado / Especialización",
    ],
  },
  {
    key: "estadoEstudios",
    label: "Estado de Estudios",
    section: "formacion",
    type: "select",
    enabled: true,
    required: true,
    options: ["Completo / Graduado", "En curso", "Incompleto"],
  },
  {
    key: "tituloCarrera",
    label: "Título / Orientación / Carrera",
    section: "formacion",
    type: "text",
    enabled: true,
    required: true,
    placeholder: "Ej: Bachiller en Economía / Contador",
  },
  {
    key: "institucion",
    label: "Institución Educativa",
    section: "formacion",
    type: "text",
    enabled: true,
    required: true,
    placeholder: "Ej: UNRC / Instituto...",
  },
  {
    key: "nivelPosFacturacion",
    label: "Sistemas de Caja POS / Facturación",
    section: "formacion",
    type: "select",
    enabled: true,
    required: true,
    options: ["Sin experiencia previa", "Básico", "Intermedio", "Avanzado"],
  },
  {
    key: "nivelExcel",
    label: "Excel / Planillas de Cálculo",
    section: "formacion",
    type: "select",
    enabled: true,
    required: true,
    options: ["Sin manejo", "Básico", "Intermedio", "Avanzado"],
  },
  {
    key: "nivelAtencionDigital",
    label: "WhatsApp Comercial / Redes / Web",
    section: "formacion",
    type: "select",
    enabled: true,
    required: true,
    options: ["Básico", "Intermedio", "Avanzado"],
  },
  {
    key: "idiomaPrincipal",
    label: "Idioma Extra",
    section: "formacion",
    type: "select",
    enabled: true,
    required: true,
    options: ["Ninguno", ...ALL_WORLD_LANGUAGES],
  },
  {
    key: "nivelIdioma",
    label: "Nivel de Idioma",
    section: "formacion",
    type: "select",
    enabled: true,
    required: false,
    options: [...LANGUAGE_LEVEL_OPTIONS],
  },
  {
    key: "cursosAdicionales",
    label: "Cursos, Certificaciones o Carnets",
    section: "formacion",
    type: "text",
    enabled: true,
    required: false,
    placeholder:
      "Ej: Carnet de Manipulación de Alimentos vigente, Curso Atención al Cliente...",
  },

  // PASO 5: EXPERIENCIA LABORAL Y PDF
  {
    key: "experiencias",
    label: "Experiencia Laboral y Referencias",
    section: "experiencia",
    type: "textarea",
    enabled: true,
    required: true,
  },
  {
    key: "expRubroEmpresa",
    label: "Rubro de la Empresa (Experiencia)",
    section: "experiencia",
    type: "select",
    enabled: true,
    required: true,
    options: [
      "Supermercado / Autoservicio / Almacén",
      "Comercio Minorista / Tienda",
      "Mayorista / Distribuidora",
      "Gastronomía / Panadería / Alimentos",
      "Administración / Estudio Contable / Finanzas",
      "Tecnología / Software / Sistemas",
      "Logística / Transporte / Correo",
      "Salud / Farmacia",
      "Construcción / Ferretería / Industria",
      "Atención telefónica / Call Center / Ventas",
      "Servicios Generales / Independiente",
      "Otro rubro",
    ],
  },
  {
    key: "expAntiguedad",
    label: "Duración / Antigüedad (Experiencia)",
    section: "experiencia",
    type: "select",
    enabled: true,
    required: true,
    options: [
      "Temporada / Menos de 6 meses",
      "6 meses a 1 año",
      "1 a 2 años",
      "3 a 5 años",
      "Más de 5 años",
    ],
  },
  {
    key: "expMotivoEgreso",
    label: "Motivo de Desvinculación (Experiencia)",
    section: "experiencia",
    type: "select",
    enabled: true,
    required: true,
    options: [
      "Actualmente trabajando en este puesto",
      "Búsqueda de crecimiento profesional",
      "Finalización de contrato / Reemplazo temporal",
      "Cambio de localidad / Mudanza",
      "Cierre o reestructuración del comercio",
      "Estudios / Incompatibilidad horaria",
      "Acuerdo mutuo / Renuncia personal",
    ],
  },
  {
    key: "pdfAdjunto",
    label: "Adjuntar Curriculum Vitae en PDF",
    section: "experiencia",
    type: "text",
    enabled: true,
    required: false,
  },
];

const VALID_SECTIONS: CvFieldSection[] = [
  "personal",
  "ubicacion",
  "postulacion",
  "formacion",
  "experiencia",
];

const VALID_TYPES: CvFieldType[] = [
  "text",
  "textarea",
  "number",
  "date",
  "email",
  "tel",
  "select",
];

export function buildDefaultCvFormConfig(): CvFormConfig {
  return {
    updatedAt: new Date().toISOString(),
    fields: DEFAULT_CV_FORM_FIELDS.map((f) => ({
      ...f,
      options: f.options ? [...f.options] : undefined,
    })),
  };
}

function cleanOptions(raw: unknown, fallback?: string[]): string[] | undefined {
  if (!Array.isArray(raw)) return fallback ? [...fallback] : undefined;
  const cleaned = raw
    .map((x) => String(x ?? "").trim())
    .filter((x, idx, arr) => Boolean(x) && arr.indexOf(x) === idx);
  return cleaned;
}

export function mergeCvFormConfig(
  saved?: Partial<CvFormConfig> | null
): CvFormConfig {
  const savedFields = Array.isArray(saved?.fields) ? saved.fields : [];
  const savedByKey = new Map<string, CvFormFieldConfig>();
  for (const f of savedFields) {
    if (f && typeof f.key === "string" && f.key.trim()) {
      savedByKey.set(f.key.trim(), f);
    }
  }

  const defaultKeys = new Set<string>();
  const merged: CvFormFieldConfig[] = DEFAULT_CV_FORM_FIELDS.map((def) => {
    defaultKeys.add(def.key);
    const ov = savedByKey.get(def.key);
    if (!ov) {
      return {
        ...def,
        options: def.options ? [...def.options] : undefined,
      };
    }
    const label = String(ov.label || "").trim() || def.label;
    const enabled = def.locked ? true : Boolean(ov.enabled);
    const required = def.locked ? true : enabled && Boolean(ov.required);
    const placeholder =
      ov.placeholder !== undefined
        ? String(ov.placeholder || "").trim()
        : def.placeholder;
    const options =
      def.type === "select"
        ? cleanOptions(ov.options, def.options) || []
        : undefined;

    return {
      ...def,
      label,
      enabled,
      required,
      placeholder,
      options:
        def.type === "select" && options && options.length === 0
          ? [...(def.options || [])]
          : options,
    };
  });

  // Preservar campos personalizados creados por el usuario
  for (const raw of savedFields) {
    if (!raw || typeof raw.key !== "string") continue;
    const key = raw.key.trim();
    if (!key || defaultKeys.has(key)) continue;
    const label = String(raw.label || "").trim();
    if (!label) continue;
    const section = VALID_SECTIONS.includes(raw.section)
      ? raw.section
      : "postulacion";
    const type = VALID_TYPES.includes(raw.type) ? raw.type : "text";
    const enabled = raw.enabled !== false;
    const required = enabled && Boolean(raw.required);
    const options =
      type === "select"
        ? cleanOptions(raw.options, ["Opción 1"]) || ["Opción 1"]
        : undefined;

    merged.push({
      key,
      label,
      section,
      type,
      enabled,
      required,
      isCustom: true,
      placeholder: String(raw.placeholder || "").trim() || undefined,
      options,
    });
  }

  return {
    updatedAt: saved?.updatedAt || new Date().toISOString(),
    updatedBy: saved?.updatedBy,
    fields: merged,
  };
}

export function getCvFieldMap(
  config?: CvFormConfig | null
): Record<string, CvFormFieldConfig> {
  const cfg = mergeCvFormConfig(config);
  const map: Record<string, CvFormFieldConfig> = {};
  for (const f of cfg.fields) {
    map[f.key] = f;
  }
  return map;
}
