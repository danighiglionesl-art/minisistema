import { NextRequest, NextResponse } from "next/server";
import { extractErpSessionFromRequest } from "../erp-session";
import { getTenantDoc, putTenantDoc } from "../supabase-server";
import { ensureBaseMiniSistemaTenant } from "../tenant-service";
import {
  type ErpTenantRecord,
  GENERAL_ADMIN_USERNAME,
  normalizeErpRole,
} from "../types";

type AnyObj = Record<string, any>;

const REIKI_ONLINE_DOC_KEY = "reiki_online_site_management_v1";

export interface ReikiProfileRecord {
  id: string;
  nombre: string;
  apellido: string;
  nickname: string;
  role: "consultante" | "terapeuta";
  soyTerapeuta: boolean;
  visibleEnRed: boolean;
  dni: string;
  fechaNacimiento: string;
  genero: string;
  email: string;
  prefijoTelefono: string;
  telefono: string;
  whatsappE164: string;
  whatsappVerified: boolean;
  whatsappVerifiedAt: string | null;
  pais: string;
  provincia: string;
  localidad: string;
  codigoPostal: string;
  barrio: string;
  calle: string;
  numeroCalle: string;
  lat: number;
  lng: number;
  biometricStatus:
    | "verificada"
    | "pendiente"
    | "no_iniciada"
    | "revision_requerida"
    | "rechazada";
  biometricRiskFlag: boolean;
  therapiesOffered: string[];
  therapiesSought: string[];
  mpLinked: boolean;
  mpUserId: string | null;
  sessionPriceArs: number;
  suspension: {
    status: "activa" | "temporal" | "definitiva";
    reason: string;
    suspendedAt: string | null;
    suspendedUntil: string | null;
    suspendedBy: string | null;
  };
  updatedAt: string;
}

export interface ReikiCategoryRecord {
  id: string;
  number: number;
  title: string;
  shortSubtitle: string;
  description: string;
  options: string[];
}

export interface ReikiProposalAlertRecord {
  id: string;
  categoryId: string;
  categoryTitle: string;
  proposedOption: string;
  proposedBy: string;
  status: "pendiente" | "aprobada" | "descartada";
  createdAt: string;
}

export interface ReikiCommissionConfig {
  presencialPct: number;
  virtualTurnoPct: number;
  virtualAhoraPct: number;
  academiaPct: number;
  therapistOverrides: Record<
    string,
    {
      presencialPct: number;
      virtualTurnoPct: number;
      virtualAhoraPct: number;
      note: string;
    }
  >;
  updatedAt: string;
  updatedBy: string;
}

export interface ReikiSplitTransactionRecord {
  id: string;
  createdAt: string;
  therapistId: string;
  therapistName: string;
  therapistNickname: string;
  consultanteName: string;
  consultanteEmail: string;
  therapyName: string;
  modality: "presencial" | "virtual_turno" | "virtual_ahora";
  scheduledSlotLabel: string;
  sessionPriceArs: number;
  commissionPct: number;
  marketplaceFeeArs: number;
  therapistNetArs: number;
  status: "approved" | "refunded" | "pending";
  mpPaymentId: string;
}

export interface ReikiCourseRecord {
  id: string;
  title: string;
  discipline: string;
  instructorName: string;
  instructorNickname: string;
  modality: "Online en vivo" | "Presencial" | "Híbrido";
  priceArs: number;
  commissionPct: number;
  totalMeetings: number;
  maxStudents: number;
  enrolledCount: number;
  certificatesIssuedCount: number;
  status: "publicado" | "pausado" | "finalizado";
  scheduleLabel: string;
  createdAt: string;
}

export interface ReikiCertificateRecord {
  id: string;
  code: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  studentEmail: string;
  instructorName: string;
  issuedAt: string;
}

export interface ReikiVideoSessionRecord {
  id: string;
  therapyName: string;
  therapistName: string;
  therapistNickname: string;
  consultanteName: string;
  consultanteEmail: string;
  modality: "Online con turno" | "Online ahora" | "Presencial con turno";
  scheduledAt: string;
  roomUrl: string;
  status: "programada" | "en_curso" | "efectuada" | "cancelada";
}

export interface ReikiSiteSettingsRecord {
  portalUrl: string;
  erpUrl: string;
  supportEmail: string;
  supportWhatsApp: string;
  maxTherapiesPerFlyer: 4 | 6;
  mpSplitActive: boolean;
  twilioVerifyActive: boolean;
  dailyVideoActive: boolean;
  biometricRenaperActive: boolean;
  adminAccounts: Array<{
    username: string;
    nombre: string;
    apellido: string;
    email: string;
  }>;
}

export interface ReikiAuditLogRecord {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  detail: string;
}

export interface ReikiOnlineSiteDoc {
  updatedAt: string;
  profiles: ReikiProfileRecord[];
  categories: ReikiCategoryRecord[];
  proposals: ReikiProposalAlertRecord[];
  commissions: ReikiCommissionConfig;
  transactions: ReikiSplitTransactionRecord[];
  courses: ReikiCourseRecord[];
  certificates: ReikiCertificateRecord[];
  sessions: ReikiVideoSessionRecord[];
  settings: ReikiSiteSettingsRecord;
  auditLogs: ReikiAuditLogRecord[];
}

function isGeneralAdmin(
  session: { username: string; role: string } | null
): boolean {
  if (!session) return false;
  const user = String(session.username || "").trim().toLowerCase();
  if (user === GENERAL_ADMIN_USERNAME) return true;
  return normalizeErpRole(session.role, user) === "Administrador General";
}

function slugifyId(raw: string): string {
  return (
    String(raw || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || `id-${Date.now()}`
  );
}

function buildInitialReikiSiteDoc(): ReikiOnlineSiteDoc {
  const nowIso = new Date().toISOString();
  return {
    updatedAt: nowIso,
    profiles: [
      {
        id: "admin-reikionline",
        nombre: "Daniel Alejandro",
        apellido: "Ghiglione",
        nickname: "danielghiglione",
        role: "terapeuta",
        soyTerapeuta: true,
        visibleEnRed: true,
        dni: "22523947",
        fechaNacimiento: "1972-07-11",
        genero: "Hombre",
        email: "danighiglione@gmail.com",
        prefijoTelefono: "+54",
        telefono: "3584244165",
        whatsappE164: "+5493584244165",
        whatsappVerified: true,
        whatsappVerifiedAt: nowIso,
        pais: "Argentina",
        provincia: "Córdoba",
        localidad: "Alcira Gigena",
        codigoPostal: "5813",
        barrio: "Centro",
        calle: "San Martin",
        numeroCalle: "362",
        lat: -32.75472,
        lng: -64.33648,
        biometricStatus: "verificada",
        biometricRiskFlag: false,
        therapiesOffered: [
          "Reiki Usui",
          "Alineación de chakras",
          "Armonización energética",
        ],
        therapiesSought: [],
        mpLinked: true,
        mpUserId: "MP-USR-87292169",
        sessionPriceArs: 30000,
        suspension: {
          status: "activa",
          reason: "",
          suspendedAt: null,
          suspendedUntil: null,
          suspendedBy: null,
        },
        updatedAt: nowIso,
      },
      {
        id: "ter-martinarrieta",
        nombre: "Martín",
        apellido: "Arrieta",
        nickname: "martinarrieta",
        role: "terapeuta",
        soyTerapeuta: true,
        visibleEnRed: true,
        dni: "31458920",
        fechaNacimiento: "1985-03-14",
        genero: "Hombre",
        email: "martin.arrieta@reikionline.com.ar",
        prefijoTelefono: "+54",
        telefono: "3584112233",
        whatsappE164: "+5493584112233",
        whatsappVerified: true,
        whatsappVerifiedAt: nowIso,
        pais: "Argentina",
        provincia: "Córdoba",
        localidad: "Río Cuarto",
        codigoPostal: "5800",
        barrio: "Centro",
        calle: "Sobremonte",
        numeroCalle: "845",
        lat: -33.12315,
        lng: -64.34934,
        biometricStatus: "verificada",
        biometricRiskFlag: false,
        therapiesOffered: [
          "Reiki Karuna",
          "Lectura de registros akáshicos",
          "Tarot",
        ],
        therapiesSought: [],
        mpLinked: true,
        mpUserId: "MP-USR-64120983",
        sessionPriceArs: 28000,
        suspension: {
          status: "activa",
          reason: "",
          suspendedAt: null,
          suspendedUntil: null,
          suspendedBy: null,
        },
        updatedAt: nowIso,
      },
      {
        id: "ter-valeriamendez",
        nombre: "Valeria",
        apellido: "Méndez",
        nickname: "valeriamendez",
        role: "terapeuta",
        soyTerapeuta: true,
        visibleEnRed: true,
        dni: "33902114",
        fechaNacimiento: "1988-09-22",
        genero: "Mujer",
        email: "valeria.mendez@reikionline.com.ar",
        prefijoTelefono: "+54",
        telefono: "3516223344",
        whatsappE164: "+5493516223344",
        whatsappVerified: true,
        whatsappVerifiedAt: nowIso,
        pais: "Argentina",
        provincia: "Córdoba",
        localidad: "Córdoba",
        codigoPostal: "5000",
        barrio: "Nueva Córdoba",
        calle: "Hipólito Yrigoyen",
        numeroCalle: "420",
        lat: -31.42528,
        lng: -64.18621,
        biometricStatus: "verificada",
        biometricRiskFlag: false,
        therapiesOffered: [
          "Reiki Usui",
          "Alineación de chakras",
          "Limpieza y armonización energética",
        ],
        therapiesSought: [],
        mpLinked: true,
        mpUserId: "MP-USR-51908411",
        sessionPriceArs: 32000,
        suspension: {
          status: "activa",
          reason: "",
          suspendedAt: null,
          suspendedUntil: null,
          suspendedBy: null,
        },
        updatedAt: nowIso,
      },
      {
        id: "ter-luciafernandez",
        nombre: "Lucía",
        apellido: "Fernández",
        nickname: "luciafernandez",
        role: "terapeuta",
        soyTerapeuta: true,
        visibleEnRed: true,
        dni: "35811209",
        fechaNacimiento: "1991-05-19",
        genero: "Mujer",
        email: "lucia.fernandez@reikionline.com.ar",
        prefijoTelefono: "+54",
        telefono: "1156778899",
        whatsappE164: "+5491156778899",
        whatsappVerified: true,
        whatsappVerifiedAt: nowIso,
        pais: "Argentina",
        provincia: "Ciudad Autónoma de Buenos Aires",
        localidad: "Palermo",
        codigoPostal: "1425",
        barrio: "Palermo",
        calle: "Av. Santa Fe",
        numeroCalle: "3420",
        lat: -34.58891,
        lng: -58.41522,
        biometricStatus: "verificada",
        biometricRiskFlag: false,
        therapiesOffered: [
          "Mindfulness",
          "Sonoterapia",
          "Cuencos tibetanos",
          "Flores de Bach",
        ],
        therapiesSought: [],
        mpLinked: true,
        mpUserId: "MP-USR-99812340",
        sessionPriceArs: 35000,
        suspension: {
          status: "activa",
          reason: "",
          suspendedAt: null,
          suspendedUntil: null,
          suspendedBy: null,
        },
        updatedAt: nowIso,
      },
      {
        id: "con-carolinagomez",
        nombre: "Carolina",
        apellido: "Gómez",
        nickname: "carolinagomez",
        role: "consultante",
        soyTerapeuta: false,
        visibleEnRed: true,
        dni: "37112490",
        fechaNacimiento: "1993-11-04",
        genero: "Mujer",
        email: "carolina.gomez@gmail.com",
        prefijoTelefono: "+54",
        telefono: "3584889900",
        whatsappE164: "+5493584889900",
        whatsappVerified: true,
        whatsappVerifiedAt: nowIso,
        pais: "Argentina",
        provincia: "Córdoba",
        localidad: "Río Cuarto",
        codigoPostal: "5800",
        barrio: "Alberdi",
        calle: "9 de Julio",
        numeroCalle: "1120",
        lat: -33.128,
        lng: -64.341,
        biometricStatus: "verificada",
        biometricRiskFlag: false,
        therapiesOffered: [],
        therapiesSought: ["Reiki Usui", "Meditación guiada"],
        mpLinked: false,
        mpUserId: null,
        sessionPriceArs: 0,
        suspension: {
          status: "activa",
          reason: "",
          suspendedAt: null,
          suspendedUntil: null,
          suspendedBy: null,
        },
        updatedAt: nowIso,
      },
      {
        id: "con-santiagoruiz",
        nombre: "Santiago",
        apellido: "Ruiz",
        nickname: "santiagoruiz",
        role: "consultante",
        soyTerapeuta: false,
        visibleEnRed: true,
        dni: "38901234",
        fechaNacimiento: "1995-02-28",
        genero: "Hombre",
        email: "santiago.ruiz@gmail.com",
        prefijoTelefono: "+54",
        telefono: "3415776655",
        whatsappE164: "+5493415776655",
        whatsappVerified: true,
        whatsappVerifiedAt: nowIso,
        pais: "Argentina",
        provincia: "Santa Fe",
        localidad: "Rosario",
        codigoPostal: "2000",
        barrio: "Centro",
        calle: "Córdoba",
        numeroCalle: "1540",
        lat: -32.94682,
        lng: -60.63932,
        biometricStatus: "no_iniciada",
        biometricRiskFlag: false,
        therapiesOffered: [],
        therapiesSought: ["Alineación de chakras", "Astrología"],
        mpLinked: false,
        mpUserId: null,
        sessionPriceArs: 0,
        suspension: {
          status: "activa",
          reason: "",
          suspendedAt: null,
          suspendedUntil: null,
          suspendedBy: null,
        },
        updatedAt: nowIso,
      },
    ],
    categories: [
      {
        id: "terapias-energeticas",
        number: 1,
        title: "Terapias energéticas",
        shortSubtitle:
          "Reiki Usui, Reiki Karuna, Alineación de chakras y Armonización",
        description:
          "Canalización de energía vital universal, equilibrio del campo áurico y desbloqueo de centros energéticos.",
        options: [
          "Reiki Usui",
          "Reiki Karuna",
          "Reiki Angélico",
          "Reiki Kundalini",
          "Reiki Egipcio / Sekhem",
          "Reiki Tibetano",
          "Limpieza y armonización energética",
          "Alineación de chakras",
          "Sanación pránica",
          "Toque terapéutico",
          "Imposición de manos",
          "Armonización energética",
          "Sanación reconectiva",
          "Tameana",
          "Magnified Healing",
          "Terapia con péndulo",
          "Radiestesia",
        ],
      },
      {
        id: "meditacion-bienestar-mental",
        number: 2,
        title: "Meditación y bienestar mental",
        shortSubtitle:
          "Meditación guiada, Mindfulness, Respiración consciente y Relajación",
        description:
          "Prácticas de presencia plena, regulación emocional, calma mental y reducción del estrés.",
        options: [
          "Meditación guiada",
          "Mindfulness",
          "Respiración consciente",
          "Pranayama",
          "Relajación profunda",
          "Yoga Nidra",
          "Visualización creativa",
          "Meditación con mantras",
          "Meditación de chakras",
          "Gestión emocional holística",
          "Reducción de estrés y ansiedad",
        ],
      },
      {
        id: "terapias-vibracionales-sonoras",
        number: 3,
        title: "Terapias vibracionales y sonoras",
        shortSubtitle:
          "Cuencos tibetanos, Cuencos de cuarzo, Gemoterapia y Flores de Bach",
        description:
          "Armonización celular y emocional a través de frecuencias sonoras, cristales y esencias florales.",
        options: [
          "Sonoterapia",
          "Cuencos tibetanos",
          "Cuencos de cuarzo",
          "Baño de gong",
          "Diapasones terapéuticos",
          "Gemoterapia / Cristaloterapia",
          "Terapia floral (Flores de Bach)",
          "Aromaterapia energética",
          "Cromoterapia",
        ],
      },
      {
        id: "terapias-espirituales-orientacion",
        number: 4,
        title: "Terapias espirituales y de orientación",
        shortSubtitle:
          "Registros akáshicos, Tarot, Astrología, Numerología y Canalización",
        description:
          "Guía evolutiva, autoconocimiento profundo y lectura de lenguajes simbólicos y espirituales.",
        options: [
          "Lectura de registros akáshicos",
          "Tarot",
          "Astrología",
          "Numerología",
          "Canalización espiritual",
          "Sanación con ángeles",
          "Oráculos terapéuticos",
          "Péndulo hebreo",
          "Limpieza energética de espacios",
        ],
      },
      {
        id: "terapias-corporales-complementarias",
        number: 5,
        title: "Terapias corporales y complementarias",
        shortSubtitle:
          "Reflexología, Masaje holístico, Acupresión, Ayurveda y Yoga",
        description:
          "Integración cuerpo-mente-energía para aliviar tensiones físicas y restaurar la vitalidad orgánica.",
        options: [
          "Reflexología holística",
          "Masaje holístico / descontracturante",
          "Masaje metamórfico",
          "Acupresión / Digitopuntura",
          "Shiatsu",
          "Ayurveda",
          "Yoga terapéutico",
          "Stretching consciente",
          "Drenaje energético corporal",
        ],
      },
      {
        id: "desarrollo-personal-emocional",
        number: 6,
        title: "Desarrollo personal y emocional",
        shortSubtitle:
          "Bioneuroemoción, Biodescodificación, Constelaciones y Coaching",
        description:
          "Procesos de transformación interior, liberación de memorias sistémicas y acompañamiento consciente.",
        options: [
          "Bioneuroemoción",
          "Biodescodificación",
          "Constelaciones familiares",
          "Constelaciones individuales",
          "Coaching holístico / ontológico",
          "Eneagrama",
          "Sanación del niño interior",
          "Árbol transgeneracional",
          "Acompañamiento en duelo",
        ],
      },
    ],
    proposals: [
      {
        id: "prop-1",
        categoryId: "terapias-vibracionales-sonoras",
        categoryTitle: "Terapias vibracionales y sonoras",
        proposedOption: "Armonización con campanas tubulares",
        proposedBy: "Lucía Fernández (@luciafernandez)",
        status: "pendiente",
        createdAt: nowIso,
      },
    ],
    commissions: {
      presencialPct: 10,
      virtualTurnoPct: 10,
      virtualAhoraPct: 12,
      academiaPct: 10,
      therapistOverrides: {},
      updatedAt: nowIso,
      updatedBy: "danielg",
    },
    transactions: [
      {
        id: "MP-SPLIT-901",
        createdAt: nowIso,
        therapistId: "admin-reikionline",
        therapistName: "Daniel Alejandro Ghiglione",
        therapistNickname: "danielghiglione",
        consultanteName: "Carolina Gómez",
        consultanteEmail: "carolina.gomez@gmail.com",
        therapyName: "Reiki Usui",
        modality: "virtual_turno",
        scheduledSlotLabel: "Jueves 18:00 hs",
        sessionPriceArs: 30000,
        commissionPct: 10,
        marketplaceFeeArs: 3000,
        therapistNetArs: 27000,
        status: "approved",
        mpPaymentId: "89412055120",
      },
      {
        id: "MP-SPLIT-902",
        createdAt: nowIso,
        therapistId: "ter-martinarrieta",
        therapistName: "Martín Arrieta",
        therapistNickname: "martinarrieta",
        consultanteName: "Santiago Ruiz",
        consultanteEmail: "santiago.ruiz@gmail.com",
        therapyName: "Lectura de registros akáshicos",
        modality: "virtual_ahora",
        scheduledSlotLabel: "Atención inmediata Online ahora",
        sessionPriceArs: 28000,
        commissionPct: 12,
        marketplaceFeeArs: 3360,
        therapistNetArs: 24640,
        status: "approved",
        mpPaymentId: "89412055499",
      },
    ],
    courses: [
      {
        id: "curso-reiki-usui-1",
        title: "Formación e Iniciación en Reiki Usui Nivel I (Shoden)",
        discipline: "Reiki Usui",
        instructorName: "Daniel Alejandro Ghiglione",
        instructorNickname: "danielghiglione",
        modality: "Online en vivo",
        priceArs: 45000,
        commissionPct: 10,
        totalMeetings: 4,
        maxStudents: 20,
        enrolledCount: 8,
        certificatesIssuedCount: 6,
        status: "publicado",
        scheduleLabel: "Sábados 10:00 a 12:30 hs",
        createdAt: nowIso,
      },
      {
        id: "curso-registros-akashicos",
        title: "Curso Intensivo de Lectura de Registros Akáshicos Nivel I y II",
        discipline: "Lectura de registros akáshicos",
        instructorName: "Martín Arrieta",
        instructorNickname: "martinarrieta",
        modality: "Online en vivo",
        priceArs: 52000,
        commissionPct: 10,
        totalMeetings: 4,
        maxStudents: 15,
        enrolledCount: 5,
        certificatesIssuedCount: 4,
        status: "publicado",
        scheduleLabel: "Miércoles 19:00 a 21:00 hs",
        createdAt: nowIso,
      },
      {
        id: "curso-cuencos-sonoterapia",
        title: "Taller Práctico de Sonoterapia y Armonización con Cuencos",
        discipline: "Sonoterapia",
        instructorName: "Lucía Fernández",
        instructorNickname: "luciafernandez",
        modality: "Híbrido",
        priceArs: 48000,
        commissionPct: 10,
        totalMeetings: 3,
        maxStudents: 12,
        enrolledCount: 6,
        certificatesIssuedCount: 5,
        status: "publicado",
        scheduleLabel: "Viernes 18:00 a 20:00 hs",
        createdAt: nowIso,
      },
    ],
    certificates: [
      {
        id: "cert-001",
        code: "RO-CERT-2026-0001",
        courseId: "curso-reiki-usui-1",
        courseTitle: "Formación e Iniciación en Reiki Usui Nivel I (Shoden)",
        studentName: "Carolina Gómez",
        studentEmail: "carolina.gomez@gmail.com",
        instructorName: "Daniel Alejandro Ghiglione",
        issuedAt: nowIso,
      },
    ],
    sessions: [
      {
        id: "ses-daily-101",
        therapyName: "Reiki Usui",
        therapistName: "Daniel Alejandro Ghiglione",
        therapistNickname: "danielghiglione",
        consultanteName: "Carolina Gómez",
        consultanteEmail: "carolina.gomez@gmail.com",
        modality: "Online con turno",
        scheduledAt: "Jueves 18:00 hs",
        roomUrl: "https://reikionline.daily.co/ro-sala-101",
        status: "programada",
      },
      {
        id: "ses-daily-102",
        therapyName: "Lectura de registros akáshicos",
        therapistName: "Martín Arrieta",
        therapistNickname: "martinarrieta",
        consultanteName: "Santiago Ruiz",
        consultanteEmail: "santiago.ruiz@gmail.com",
        modality: "Online ahora",
        scheduledAt: "Finalizada (45 min)",
        roomUrl: "https://reikionline.daily.co/ro-sala-102",
        status: "efectuada",
      },
    ],
    settings: {
      portalUrl: "https://www.reikionline.com.ar",
      erpUrl: "https://www.reikionline.com.ar/sistema",
      supportEmail: "contacto@reikionline.com.ar",
      supportWhatsApp: "+5493584244165",
      maxTherapiesPerFlyer: 4,
      mpSplitActive: true,
      twilioVerifyActive: true,
      dailyVideoActive: true,
      biometricRenaperActive: true,
      adminAccounts: [
        {
          username: "danielg",
          nombre: "Daniel Alejandro",
          apellido: "Ghiglione",
          email: "danighiglione@gmail.com",
        },
        {
          username: "federicod",
          nombre: "Federico",
          apellido: "D.",
          email: "federicod@reikionline.com.ar",
        },
        {
          username: "josem",
          nombre: "José",
          apellido: "M.",
          email: "josem@reikionline.com.ar",
        },
        {
          username: "miltonv",
          nombre: "Milton",
          apellido: "V.",
          email: "miltonv@reikionline.com.ar",
        },
      ],
    },
    auditLogs: [
      {
        id: "log-init",
        createdAt: nowIso,
        actor: "danielg",
        action: "reiki_online.init",
        detail:
          "Módulo de gestión integral de Reiki Online conectado en MiniSistema.",
      },
    ],
  };
}

async function loadReikiDoc(
  baseTenant: ErpTenantRecord
): Promise<ReikiOnlineSiteDoc> {
  const seed = buildInitialReikiSiteDoc();
  const { payload } = await getTenantDoc<ReikiOnlineSiteDoc>(
    baseTenant,
    REIKI_ONLINE_DOC_KEY,
    seed
  );
  if (!payload || !Array.isArray(payload.categories) || !Array.isArray(payload.profiles)) {
    await putTenantDoc(
      baseTenant,
      REIKI_ONLINE_DOC_KEY,
      seed,
      GENERAL_ADMIN_USERNAME,
      "seed_reiki_online_doc"
    );
    return seed;
  }
  return {
    ...seed,
    ...payload,
    commissions: { ...seed.commissions, ...(payload.commissions || {}) },
    settings: { ...seed.settings, ...(payload.settings || {}) },
  };
}

async function saveReikiDoc(
  baseTenant: ErpTenantRecord,
  doc: ReikiOnlineSiteDoc,
  actor: string,
  action: string,
  detail: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  doc.updatedAt = nowIso;
  doc.auditLogs = [
    {
      id: `log-${Date.now()}`,
      createdAt: nowIso,
      actor,
      action,
      detail,
    },
    ...(doc.auditLogs || []).slice(0, 149),
  ];
  await putTenantDoc(baseTenant, REIKI_ONLINE_DOC_KEY, doc, actor, action);
}

function computeKpis(doc: ReikiOnlineSiteDoc) {
  const profiles = doc.profiles || [];
  const categories = doc.categories || [];
  const txs = doc.transactions || [];
  const courses = doc.courses || [];
  const certs = doc.certificates || [];
  const sessions = doc.sessions || [];
  const proposals = doc.proposals || [];

  const terapeutas = profiles.filter((p) => p.soyTerapeuta || p.role === "terapeuta").length;
  const consultantes = profiles.length - terapeutas;
  const suspendidos = profiles.filter((p) => p.suspension?.status !== "activa").length;
  const bioVerificados = profiles.filter((p) => p.biometricStatus === "verificada").length;
  const whatsappVerificados = profiles.filter((p) => p.whatsappVerified).length;
  const mpVinculados = profiles.filter((p) => p.mpLinked).length;

  const totalTherapies = categories.reduce(
    (acc, c) => acc + (Array.isArray(c.options) ? c.options.length : 0),
    0
  );
  const pendingProposals = proposals.filter((p) => p.status === "pendiente").length;

  const approvedTxs = txs.filter((t) => t.status === "approved");
  const grossSessionsArs = approvedTxs.reduce((a, t) => a + Number(t.sessionPriceArs || 0), 0);
  const platformFeeSessionsArs = approvedTxs.reduce(
    (a, t) => a + Number(t.marketplaceFeeArs || 0),
    0
  );

  const totalEnrollments = courses.reduce((a, c) => a + Number(c.enrolledCount || 0), 0);
  const grossCoursesArs = courses.reduce(
    (a, c) => a + Number(c.priceArs || 0) * Number(c.enrolledCount || 0),
    0
  );
  const platformFeeCoursesArs = courses.reduce(
    (a, c) =>
      a +
      Math.round(
        (Number(c.priceArs || 0) *
          Number(c.enrolledCount || 0) *
          Number(c.commissionPct || 10)) /
          100
      ),
    0
  );

  return {
    totalUsers: profiles.length,
    terapeutas,
    consultantes,
    suspendidos,
    bioVerificados,
    whatsappVerificados,
    mpVinculados,
    totalCategories: categories.length,
    totalTherapies,
    pendingProposals,
    sessionsTotal: sessions.length,
    sessionsCompleted: sessions.filter((s) => s.status === "efectuada").length,
    coursesCount: courses.length,
    totalEnrollments,
    certificatesCount: certs.length,
    grossSessionsArs,
    platformFeeSessionsArs,
    grossCoursesArs,
    platformFeeCoursesArs,
    totalPlatformRevenueArs: platformFeeSessionsArs + platformFeeCoursesArs,
  };
}

export async function handleErpReikiOnline(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const session =
    extractErpSessionFromRequest(req, tenant.slug) ||
    extractErpSessionFromRequest(req, "minisistema");
  if (!isGeneralAdmin(session)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Acceso exclusivo del Administrador General de MiniSistema para gestionar Reiki online.",
      },
      { status: 403 }
    );
  }

  const actor = session?.username || GENERAL_ADMIN_USERNAME;
  const baseTenant = await ensureBaseMiniSistemaTenant();
  const doc = await loadReikiDoc(baseTenant);

  if (req.method === "GET") {
    return NextResponse.json({
      ok: true,
      kpis: computeKpis(doc),
      ...doc,
    });
  }

  if (req.method === "POST") {
    const body = (await req.json()) as AnyObj;
    const action = String(body.action || "").trim();
    const nowIso = new Date().toISOString();

    // 1. ALTA / EDICIÓN DE PERFIL DE CONSULTANTE O TERAPEUTA
    if (action === "upsert_profile") {
      const id = String(body.id || "").trim() || `usr-${Date.now()}`;
      const nombre = String(body.nombre || "").trim();
      const apellido = String(body.apellido || "").trim();
      const rawNick = String(body.nickname || `${nombre}${apellido}`)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase()
        .slice(0, 16);
      if (!nombre || !apellido || rawNick.length < 4) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Nombre, Apellido y Nickname (4 a 16 caracteres alfanuméricos) son obligatorios.",
          },
          { status: 400 }
        );
      }

      const soyTerapeuta = Boolean(body.soyTerapeuta || body.role === "terapeuta");
      const existingIdx = doc.profiles.findIndex((p) => p.id === id);
      const existing = existingIdx >= 0 ? doc.profiles[existingIdx] : null;

      const therapiesOffered = Array.isArray(body.therapiesOffered)
        ? body.therapiesOffered.map((x: unknown) => String(x).trim()).filter(Boolean)
        : String(body.therapiesOfferedCsv || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);

      const record: ReikiProfileRecord = {
        id,
        nombre,
        apellido,
        nickname: rawNick,
        role: soyTerapeuta ? "terapeuta" : "consultante",
        soyTerapeuta,
        visibleEnRed: body.visibleEnRed !== false,
        dni: String(body.dni || existing?.dni || "").trim(),
        fechaNacimiento: String(
          body.fechaNacimiento || existing?.fechaNacimiento || ""
        ).trim(),
        genero: String(body.genero || existing?.genero || "").trim(),
        email: String(body.email || existing?.email || "").trim(),
        prefijoTelefono: String(
          body.prefijoTelefono || existing?.prefijoTelefono || "+54"
        ).trim(),
        telefono: String(body.telefono || existing?.telefono || "").trim(),
        whatsappE164: String(
          body.whatsappE164 ||
            existing?.whatsappE164 ||
            `+549${String(body.telefono || "").replace(/\D/g, "")}`
        ).trim(),
        whatsappVerified:
          body.whatsappVerified !== undefined
            ? Boolean(body.whatsappVerified)
            : Boolean(existing?.whatsappVerified),
        whatsappVerifiedAt: body.whatsappVerified
          ? existing?.whatsappVerifiedAt || nowIso
          : null,
        pais: String(body.pais || existing?.pais || "Argentina").trim(),
        provincia: String(body.provincia || existing?.provincia || "").trim(),
        localidad: String(body.localidad || existing?.localidad || "").trim(),
        codigoPostal: String(
          body.codigoPostal || existing?.codigoPostal || ""
        ).trim(),
        barrio: String(body.barrio || existing?.barrio || "").trim(),
        calle: String(body.calle || existing?.calle || "").trim(),
        numeroCalle: String(
          body.numeroCalle || existing?.numeroCalle || ""
        ).trim(),
        lat: Number(body.lat ?? existing?.lat ?? -32.75472),
        lng: Number(body.lng ?? existing?.lng ?? -64.33648),
        biometricStatus: (body.biometricStatus ||
          existing?.biometricStatus ||
          "no_iniciada") as ReikiProfileRecord["biometricStatus"],
        biometricRiskFlag: Boolean(
          body.biometricRiskFlag ?? existing?.biometricRiskFlag
        ),
        therapiesOffered:
          therapiesOffered.length > 0
            ? therapiesOffered
            : existing?.therapiesOffered || [],
        therapiesSought: existing?.therapiesSought || [],
        mpLinked: Boolean(body.mpLinked ?? existing?.mpLinked),
        mpUserId: body.mpUserId ?? existing?.mpUserId ?? null,
        sessionPriceArs: Number(
          body.sessionPriceArs ?? existing?.sessionPriceArs ?? 30000
        ),
        suspension: existing?.suspension || {
          status: "activa",
          reason: "",
          suspendedAt: null,
          suspendedUntil: null,
          suspendedBy: null,
        },
        updatedAt: nowIso,
      };

      if (existingIdx >= 0) {
        doc.profiles[existingIdx] = record;
      } else {
        doc.profiles.unshift(record);
      }

      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "profile.upsert",
        `Perfil ${nombre} ${apellido} (@${rawNick}) guardado.`
      );
      return NextResponse.json({
        ok: true,
        message: `Perfil de ${nombre} ${apellido} (@${rawNick}) actualizado correctamente.`,
      });
    }

    // 2. SUSPENSIÓN TEMPORAL O DEFINITIVA DE PERFIL
    if (action === "suspend_profile") {
      const profileId = String(body.profileId || "").trim();
      const mode = body.mode === "definitiva" ? "definitiva" : "temporal";
      const days = Math.max(1, Number(body.days || 7));
      const reason =
        String(body.reason || "").trim() ||
        "Incumplimiento de las normas de convivencia de la comunidad Reiki Online";

      const target = doc.profiles.find((p) => p.id === profileId);
      if (!target) {
        return NextResponse.json(
          { ok: false, message: "Perfil no encontrado." },
          { status: 404 }
        );
      }

      const untilIso =
        mode === "temporal"
          ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
          : null;

      target.visibleEnRed = false;
      target.suspension = {
        status: mode,
        reason,
        suspendedAt: nowIso,
        suspendedUntil: untilIso,
        suspendedBy: actor,
      };
      target.updatedAt = nowIso;

      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        `profile.suspend_${mode}`,
        `Perfil @${target.nickname} suspendido (${mode}). Motivo: ${reason}`
      );
      return NextResponse.json({
        ok: true,
        message:
          mode === "definitiva"
            ? `Perfil de ${target.nombre} ${target.apellido} (@${target.nickname}) suspendido DEFINITIVAMENTE.`
            : `Perfil de ${target.nombre} ${target.apellido} (@${target.nickname}) suspendido temporalmente por ${days} día(s).`,
      });
    }

    // 3. LEVANTAR SUSPENSIÓN
    if (action === "lift_suspension") {
      const profileId = String(body.profileId || "").trim();
      const target = doc.profiles.find((p) => p.id === profileId);
      if (!target) {
        return NextResponse.json(
          { ok: false, message: "Perfil no encontrado." },
          { status: 404 }
        );
      }
      target.visibleEnRed = true;
      target.suspension = {
        status: "activa",
        reason: "",
        suspendedAt: null,
        suspendedUntil: null,
        suspendedBy: actor,
      };
      target.updatedAt = nowIso;

      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "profile.lift_suspension",
        `Suspensión levantada para @${target.nickname}.`
      );
      return NextResponse.json({
        ok: true,
        message: `Suspensión levantada: @${target.nickname} se encuentra nuevamente activo.`,
      });
    }

    // 4. ABM DE CATEGORÍAS (CREAR, EDITAR, REORDENAR, ELIMINAR CON REASIGNACIÓN)
    if (action === "create_category") {
      const title = String(body.title || "").trim();
      if (!title) {
        return NextResponse.json(
          { ok: false, message: "El título de la categoría es obligatorio." },
          { status: 400 }
        );
      }
      const baseId = slugifyId(title);
      const id = doc.categories.some((c) => c.id === baseId)
        ? `${baseId}-${Date.now().toString().slice(-4)}`
        : baseId;
      const options = String(body.initialTherapiesCsv || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const newCat: ReikiCategoryRecord = {
        id,
        number: doc.categories.length + 1,
        title,
        shortSubtitle:
          String(body.shortSubtitle || "").trim() ||
          options.slice(0, 4).join(", ") ||
          `Especialidades de ${title}`,
        description:
          String(body.description || "").trim() ||
          `Sesiones y especialidades de ${title} disponibles online y presencial.`,
        options,
      };
      doc.categories.push(newCat);

      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "category.create",
        `Categoría «${title}» creada con ${options.length} terapia(s).`
      );
      return NextResponse.json({
        ok: true,
        message: `Categoría «${title}» creada y vinculada al catálogo.`,
      });
    }

    if (action === "update_category") {
      const catId = String(body.categoryId || "").trim();
      const title = String(body.title || "").trim();
      const target = doc.categories.find((c) => c.id === catId);
      if (!target || !title) {
        return NextResponse.json(
          { ok: false, message: "Categoría o título inválido." },
          { status: 400 }
        );
      }
      target.title = title;
      if (body.shortSubtitle !== undefined) {
        target.shortSubtitle = String(body.shortSubtitle).trim();
      }
      if (body.description !== undefined) {
        target.description = String(body.description).trim();
      }

      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "category.update",
        `Categoría «${title}» actualizada.`
      );
      return NextResponse.json({
        ok: true,
        message: `Categoría «${title}» actualizada.`,
      });
    }

    if (action === "move_category") {
      const catId = String(body.categoryId || "").trim();
      const dir = Number(body.direction) === -1 ? -1 : 1;
      const idx = doc.categories.findIndex((c) => c.id === catId);
      const targetIdx = idx + dir;
      if (idx >= 0 && targetIdx >= 0 && targetIdx < doc.categories.length) {
        const tmp = doc.categories[idx];
        doc.categories[idx] = doc.categories[targetIdx];
        doc.categories[targetIdx] = tmp;
        doc.categories.forEach((c, i) => {
          c.number = i + 1;
        });
        await saveReikiDoc(
          baseTenant,
          doc,
          actor,
          "category.reorder",
          "Orden de categorías actualizado."
        );
      }
      return NextResponse.json({
        ok: true,
        message: "Orden de categorías actualizado.",
      });
    }

    if (action === "delete_category") {
      const catId = String(body.categoryId || "").trim();
      const reassignToCatId = String(body.reassignToCategoryId || "").trim();
      if (doc.categories.length <= 1) {
        return NextResponse.json(
          {
            ok: false,
            message: "Debe existir al menos 1 categoría activa en el catálogo.",
          },
          { status: 400 }
        );
      }
      const source = doc.categories.find((c) => c.id === catId);
      if (!source) {
        return NextResponse.json(
          { ok: false, message: "Categoría no encontrada." },
          { status: 404 }
        );
      }
      if (reassignToCatId && reassignToCatId !== catId) {
        const dest = doc.categories.find((c) => c.id === reassignToCatId);
        if (dest) {
          dest.options = Array.from(
            new Set([...dest.options, ...source.options])
          );
        }
      }
      doc.categories = doc.categories
        .filter((c) => c.id !== catId)
        .map((c, idx) => ({ ...c, number: idx + 1 }));

      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "category.delete",
        `Categoría «${source.title}» eliminada.`
      );
      return NextResponse.json({
        ok: true,
        message: `Categoría «${source.title}» dada de baja correctamente.`,
      });
    }

    // 5. ABM DE TERAPIAS VINCULADAS A CATEGORÍAS + PROPUESTAS «OTRA -> ¿CUÁL?»
    if (action === "add_therapy") {
      const catId = String(body.categoryId || "").trim();
      const therapyName = String(body.therapyName || "").trim();
      const cat = doc.categories.find((c) => c.id === catId);
      if (!cat || !therapyName) {
        return NextResponse.json(
          { ok: false, message: "Seleccioná una categoría y escribí el nombre de la terapia." },
          { status: 400 }
        );
      }
      if (
        cat.options.some(
          (o) => o.toLowerCase() === therapyName.toLowerCase()
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            message: `La terapia «${therapyName}» ya existe en «${cat.title}».`,
          },
          { status: 400 }
        );
      }
      cat.options.push(therapyName);
      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "therapy.create",
        `Terapia «${therapyName}» vinculada a «${cat.title}».`
      );
      return NextResponse.json({
        ok: true,
        message: `Terapia «${therapyName}» dada de alta y vinculada a «${cat.title}».`,
      });
    }

    if (action === "update_therapy") {
      const sourceCatId = String(body.sourceCategoryId || "").trim();
      const oldName = String(body.oldName || "").trim();
      const newName = String(body.newName || "").trim();
      const targetCatId = String(body.targetCategoryId || sourceCatId).trim();

      const sourceCat = doc.categories.find((c) => c.id === sourceCatId);
      const targetCat = doc.categories.find((c) => c.id === targetCatId);
      if (!sourceCat || !targetCat || !oldName || !newName) {
        return NextResponse.json(
          { ok: false, message: "Datos de terapia o categoría inválidos." },
          { status: 400 }
        );
      }

      if (sourceCatId === targetCatId) {
        sourceCat.options = sourceCat.options.map((o) =>
          o === oldName ? newName : o
        );
      } else {
        sourceCat.options = sourceCat.options.filter((o) => o !== oldName);
        if (
          !targetCat.options.some(
            (o) => o.toLowerCase() === newName.toLowerCase()
          )
        ) {
          targetCat.options.push(newName);
        }
      }

      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "therapy.update",
        `Terapia «${oldName}» actualizada a «${newName}» (${targetCat.title}).`
      );
      return NextResponse.json({
        ok: true,
        message: `Terapia «${newName}» actualizada y vinculada a «${targetCat.title}».`,
      });
    }

    if (action === "delete_therapy") {
      const catId = String(body.categoryId || "").trim();
      const therapyName = String(body.therapyName || "").trim();
      const cat = doc.categories.find((c) => c.id === catId);
      if (!cat) {
        return NextResponse.json(
          { ok: false, message: "Categoría no encontrada." },
          { status: 404 }
        );
      }
      cat.options = cat.options.filter((o) => o !== therapyName);
      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "therapy.delete",
        `Terapia «${therapyName}» eliminada de «${cat.title}».`
      );
      return NextResponse.json({
        ok: true,
        message: `Terapia «${therapyName}» dada de baja de «${cat.title}».`,
      });
    }

    if (action === "resolve_proposal") {
      const proposalId = String(body.proposalId || "").trim();
      const decision =
        body.decision === "aprobada" ? "aprobada" : "descartada";
      const targetCatId = String(body.targetCategoryId || "").trim();

      const prop = doc.proposals.find((p) => p.id === proposalId);
      if (!prop) {
        return NextResponse.json(
          { ok: false, message: "Propuesta no encontrada." },
          { status: 404 }
        );
      }

      prop.status = decision;
      if (decision === "aprobada") {
        const destCat =
          doc.categories.find((c) => c.id === (targetCatId || prop.categoryId)) ||
          doc.categories[0];
        if (
          destCat &&
          !destCat.options.some(
            (o) => o.toLowerCase() === prop.proposedOption.toLowerCase()
          )
        ) {
          destCat.options.push(prop.proposedOption);
        }
      }

      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        `proposal.${decision}`,
        `Propuesta «${prop.proposedOption}» ${decision}.`
      );
      return NextResponse.json({
        ok: true,
        message:
          decision === "aprobada"
            ? `Propuesta «${prop.proposedOption}» aprobada e incorporada al catálogo.`
            : `Propuesta «${prop.proposedOption}» descartada.`,
      });
    }

    // 6. COMISIONES Y PAGOS SPLIT 1:1 MERCADO PAGO
    if (action === "save_commission_config") {
      doc.commissions = {
        ...doc.commissions,
        presencialPct: Math.max(0, Math.min(50, Number(body.presencialPct ?? 10))),
        virtualTurnoPct: Math.max(
          0,
          Math.min(50, Number(body.virtualTurnoPct ?? 10))
        ),
        virtualAhoraPct: Math.max(
          0,
          Math.min(50, Number(body.virtualAhoraPct ?? 12))
        ),
        academiaPct: Math.max(0, Math.min(50, Number(body.academiaPct ?? 10))),
        updatedAt: nowIso,
        updatedBy: actor,
      };

      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "commissions.update",
        `Comisiones actualizadas: Presencial ${doc.commissions.presencialPct}%, Virtual Turno ${doc.commissions.virtualTurnoPct}%, Virtual Ahora ${doc.commissions.virtualAhoraPct}%, Academia ${doc.commissions.academiaPct}%.`
      );
      return NextResponse.json({
        ok: true,
        message: "Porcentajes de comisión Split 1:1 actualizados correctamente.",
      });
    }

    if (action === "refund_transaction") {
      const txId = String(body.transactionId || "").trim();
      const tx = doc.transactions.find((t) => t.id === txId);
      if (!tx) {
        return NextResponse.json(
          { ok: false, message: "Transacción no encontrada." },
          { status: 404 }
        );
      }
      tx.status = "refunded";
      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "transaction.refund",
        `Devolución 100% registrada para operación ${tx.id} (${tx.consultanteName}).`
      );
      return NextResponse.json({
        ok: true,
        message: `Devolución 100% registrada para la operación ${tx.id}.`,
      });
    }

    // 7. ACADEMIA Y CAPACITACIONES
    if (action === "upsert_course") {
      const id = String(body.id || "").trim() || `curso-${Date.now()}`;
      const title = String(body.title || "").trim();
      const discipline = String(body.discipline || "Reiki Usui").trim();
      const instructorName = String(
        body.instructorName || "Daniel Alejandro Ghiglione"
      ).trim();
      const instructorNickname = String(
        body.instructorNickname || "danielghiglione"
      ).trim();
      if (!title) {
        return NextResponse.json(
          { ok: false, message: "El título de la capacitación es obligatorio." },
          { status: 400 }
        );
      }

      const idx = doc.courses.findIndex((c) => c.id === id);
      const prev = idx >= 0 ? doc.courses[idx] : null;
      const course: ReikiCourseRecord = {
        id,
        title,
        discipline,
        instructorName,
        instructorNickname,
        modality: (body.modality ||
          prev?.modality ||
          "Online en vivo") as ReikiCourseRecord["modality"],
        priceArs: Math.max(0, Number(body.priceArs ?? prev?.priceArs ?? 45000)),
        commissionPct: Math.max(
          0,
          Number(body.commissionPct ?? prev?.commissionPct ?? doc.commissions.academiaPct)
        ),
        totalMeetings: Math.max(
          1,
          Number(body.totalMeetings ?? prev?.totalMeetings ?? 4)
        ),
        maxStudents: Math.max(
          1,
          Number(body.maxStudents ?? prev?.maxStudents ?? 20)
        ),
        enrolledCount: Math.max(
          0,
          Number(body.enrolledCount ?? prev?.enrolledCount ?? 0)
        ),
        certificatesIssuedCount: Math.max(
          0,
          Number(
            body.certificatesIssuedCount ?? prev?.certificatesIssuedCount ?? 0
          )
        ),
        status: (body.status ||
          prev?.status ||
          "publicado") as ReikiCourseRecord["status"],
        scheduleLabel: String(
          body.scheduleLabel || prev?.scheduleLabel || "Sábados 10:00 hs"
        ).trim(),
        createdAt: prev?.createdAt || nowIso,
      };

      if (idx >= 0) {
        doc.courses[idx] = course;
      } else {
        doc.courses.unshift(course);
      }

      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "course.upsert",
        `Capacitación «${title}» guardada.`
      );
      return NextResponse.json({
        ok: true,
        message: `Capacitación «${title}» actualizada correctamente.`,
      });
    }

    if (action === "delete_course") {
      const courseId = String(body.courseId || "").trim();
      doc.courses = doc.courses.filter((c) => c.id !== courseId);
      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "course.delete",
        `Capacitación ${courseId} eliminada.`
      );
      return NextResponse.json({
        ok: true,
        message: "Capacitación eliminada del catálogo.",
      });
    }

    if (action === "issue_certificate") {
      const courseId = String(body.courseId || "").trim();
      const studentName = String(body.studentName || "").trim();
      const studentEmail = String(body.studentEmail || "").trim();
      const course = doc.courses.find((c) => c.id === courseId);
      if (!course || !studentName) {
        return NextResponse.json(
          { ok: false, message: "Seleccioná un curso e ingresá el nombre del alumno." },
          { status: 400 }
        );
      }
      const code = `RO-CERT-2026-${String(doc.certificates.length + 1).padStart(
        4,
        "0"
      )}`;
      doc.certificates.unshift({
        id: `cert-${Date.now()}`,
        code,
        courseId: course.id,
        courseTitle: course.title,
        studentName,
        studentEmail: studentEmail || "alumno@reikionline.com.ar",
        instructorName: course.instructorName,
        issuedAt: nowIso,
      });
      course.certificatesIssuedCount += 1;

      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "certificate.issue",
        `Certificado ${code} emitido para ${studentName} (${course.title}).`
      );
      return NextResponse.json({
        ok: true,
        message: `Certificado oficial ${code} emitido con éxito para ${studentName}.`,
      });
    }

    // 8. BIOMETRÍA Y WHATSAPP OFICIAL
    if (action === "update_biometric_status") {
      const profileId = String(body.profileId || "").trim();
      const target = doc.profiles.find((p) => p.id === profileId);
      if (!target) {
        return NextResponse.json(
          { ok: false, message: "Usuario no encontrado." },
          { status: 404 }
        );
      }
      if (body.biometricStatus) {
        target.biometricStatus =
          body.biometricStatus as ReikiProfileRecord["biometricStatus"];
      }
      if (body.toggleRisk) {
        target.biometricRiskFlag = !target.biometricRiskFlag;
      }
      target.updatedAt = nowIso;

      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "biometric.update",
        `Estado biométrico de @${target.nickname} actualizado a ${target.biometricStatus}.`
      );
      return NextResponse.json({
        ok: true,
        message: `Estado biométrico de ${target.nombre} ${target.apellido} actualizado a «${target.biometricStatus}».`,
      });
    }

    if (action === "update_whatsapp_status") {
      const profileId = String(body.profileId || "").trim();
      const target = doc.profiles.find((p) => p.id === profileId);
      if (!target) {
        return NextResponse.json(
          { ok: false, message: "Usuario no encontrado." },
          { status: 404 }
        );
      }
      target.whatsappVerified = Boolean(body.verified);
      target.whatsappVerifiedAt = target.whatsappVerified ? nowIso : null;
      if (body.whatsappE164) {
        target.whatsappE164 = String(body.whatsappE164).trim();
      }
      target.updatedAt = nowIso;

      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "whatsapp.update",
        `WhatsApp E.164 de @${target.nickname} actualizado (${
          target.whatsappVerified ? "Verificado" : "Sin verificar"
        }).`
      );
      return NextResponse.json({
        ok: true,
        message: `Estado de WhatsApp de ${target.nombre} ${target.apellido} actualizado.`,
      });
    }

    // 9. VIDEOLLAMADAS Y TURNOS DAILY.CO 1:1
    if (action === "update_session_status") {
      const sessionId = String(body.sessionId || "").trim();
      const status = String(body.status || "efectuada") as ReikiVideoSessionRecord["status"];
      const ses = doc.sessions.find((s) => s.id === sessionId);
      if (!ses) {
        return NextResponse.json(
          { ok: false, message: "Sesión no encontrada." },
          { status: 404 }
        );
      }
      ses.status = status;
      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "session.update",
        `Sesión ${ses.id} actualizada a ${status}.`
      );
      return NextResponse.json({
        ok: true,
        message: `Sesión ${ses.id} actualizada a estado «${status}».`,
      });
    }

    // 10. CONFIGURACIÓN GENERAL DEL SITIO
    if (action === "save_site_settings") {
      doc.settings = {
        ...doc.settings,
        portalUrl: String(body.portalUrl || doc.settings.portalUrl).trim(),
        erpUrl: String(body.erpUrl || doc.settings.erpUrl).trim(),
        supportEmail: String(
          body.supportEmail || doc.settings.supportEmail
        ).trim(),
        supportWhatsApp: String(
          body.supportWhatsApp || doc.settings.supportWhatsApp
        ).trim(),
        maxTherapiesPerFlyer: Number(body.maxTherapiesPerFlyer) === 6 ? 6 : 4,
      };
      await saveReikiDoc(
        baseTenant,
        doc,
        actor,
        "settings.update",
        "Configuración general de Reiki Online actualizada."
      );
      return NextResponse.json({
        ok: true,
        message: "Configuración del sitio Reiki Online guardada.",
      });
    }

    return NextResponse.json(
      { ok: false, message: `Acción no reconocida: ${action}` },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { ok: false, message: "Método HTTP no soportado." },
    { status: 405 }
  );
}
