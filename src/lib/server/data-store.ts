import fs from "node:fs";
import path from "node:path";
import {
  FAQ_ITEMS,
  INITIAL_SITE_CONFIG,
  PORTFOLIO_PROJECTS,
} from "@/lib/site-data";
import {
  FaqItem,
  LeadStatus,
  PortfolioProject,
  SiteConfiguration,
} from "@/types/minisistema";
import { hashPassword, verifyPassword } from "@/lib/server/crypto-auth";

export interface InquiryObservation {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface InquiryChangeLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
}

export interface StoredInquiry {
  id: string;
  source: "configurador" | "contacto";
  createdAt: string;
  updatedAt: string;
  status: LeadStatus;
  businessActivity: string;
  selectedNeeds: string[];
  currentSystemStatus: string;
  projectDescription: string;
  preselectedCategory: string | null;
  preselectedService: string | null;
  contact: {
    fullName: string;
    businessName: string;
    city: string;
    province: string;
    whatsapp: string;
    email: string;
    privacyConsent: boolean;
  };
  observations: InquiryObservation[];
  changeLog: InquiryChangeLogEntry[];
}

export interface CommercialContentSettings {
  heroTitleLine1: string;
  heroTitleHighlight1: string;
  heroTitleLine2: string;
  heroTitleHighlight2: string;
  heroSubtitle: string;
  evolutionSlogan: string;
  finalCtaTitle: string;
  finalCtaSubtitle: string;
}

export interface ExtendedSiteConfig extends SiteConfiguration {
  institutionalDescriptor: string;
  notificationRecipients: string[];
}

interface DatabaseSchema {
  adminUser: {
    email: string;
    passwordHash: string;
    fullName: string;
  };
  inquiries: StoredInquiry[];
  projects: PortfolioProject[];
  faqs: FaqItem[];
  commercialContent: CommercialContentSettings;
  siteConfig: ExtendedSiteConfig;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "minisistema-store.json");

const DEFAULT_COMMERCIAL_CONTENT: CommercialContentSettings = {
  heroTitleLine1: "Tu negocio es",
  heroTitleHighlight1: "único",
  heroTitleLine2: "Tu sistema",
  heroTitleHighlight2: "también debería serlo",
  heroSubtitle:
    "Diseñamos sistemas digitales a medida para simplificar tu trabajo, organizar tu negocio y acompañarte en cada etapa de crecimiento.",
  evolutionSlogan: "Tu negocio evoluciona. Tu MiniSistema también.",
  finalCtaTitle: "Tu próximo gran paso puede empezar con un MiniSistema.",
  finalCtaSubtitle:
    "Contanos qué necesitás. Diseñemos una solución que se adapte a tu negocio y pueda evolucionar con vos.",
};

// El hash de contraseña se configura mediante ADMIN_PASSWORD_HASH en .env.local / variables de entorno de Vercel
const DEFAULT_ADMIN_HASH = "";

function buildInitialDatabase(): DatabaseSchema {
  const envEmail = process.env.ADMIN_INITIAL_EMAIL || "admin@minisistema.com.ar";
  const envHash = process.env.ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_HASH;

  return {
    adminUser: {
      email: envEmail,
      passwordHash: envHash,
      fullName: "Administrador MiniSistema",
    },
    inquiries: [],
    projects: PORTFOLIO_PROJECTS,
    faqs: FAQ_ITEMS,
    commercialContent: DEFAULT_COMMERCIAL_CONTENT,
    siteConfig: {
      ...INITIAL_SITE_CONFIG,
      institutionalDescriptor: "SISTEMAS A MEDIDA",
      notificationRecipients: [],
    },
  };
}

function readDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE_PATH)) {
      const initial = buildInitialDatabase();
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    const defaults = buildInitialDatabase();
    return {
      adminUser: parsed.adminUser || defaults.adminUser,
      inquiries: Array.isArray(parsed.inquiries) ? parsed.inquiries : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : defaults.projects,
      faqs: Array.isArray(parsed.faqs) ? parsed.faqs : defaults.faqs,
      commercialContent: {
        ...defaults.commercialContent,
        ...(parsed.commercialContent || {}),
      },
      siteConfig: {
        ...defaults.siteConfig,
        ...(parsed.siteConfig || {}),
      },
    };
  } catch {
    return buildInitialDatabase();
  }
}

function writeDb(db: DatabaseSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export function verifyAdminLogin(email: string, password: string): boolean {
  const db = readDb();
  const normalizedInput = email.trim().toLowerCase();
  const storedEmail = (
    process.env.ADMIN_INITIAL_EMAIL || db.adminUser.email
  )
    .trim()
    .toLowerCase();

  if (normalizedInput !== storedEmail) return false;

  if (process.env.ADMIN_PASSWORD_HASH) {
    return verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
  }
  return verifyPassword(password, db.adminUser.passwordHash);
}

export function updateAdminPassword(newPassword: string): void {
  const db = readDb();
  db.adminUser.passwordHash = hashPassword(newPassword);
  writeDb(db);
}

export function getPublicSiteState() {
  const db = readDb();
  return {
    projects: db.projects,
    faqs: db.faqs,
    commercialContent: db.commercialContent,
    siteConfig: db.siteConfig,
  };
}

export function listInquiries(): StoredInquiry[] {
  const db = readDb();
  return db.inquiries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function createInquiry(input: {
  source: "configurador" | "contacto";
  businessActivity: string;
  selectedNeeds: string[];
  currentSystemStatus: string;
  projectDescription: string;
  preselectedCategory?: string | null;
  preselectedService?: string | null;
  contact: {
    fullName: string;
    businessName: string;
    city: string;
    province: string;
    whatsapp: string;
    email: string;
    privacyConsent: boolean;
  };
}): StoredInquiry {
  const db = readDb();
  const now = new Date().toISOString();
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const prefix = input.source === "configurador" ? "MS" : "MSC";
  const id = `${prefix}-${year}-${randomSuffix}`;

  const newInquiry: StoredInquiry = {
    id,
    source: input.source,
    createdAt: now,
    updatedAt: now,
    status: "Nueva",
    businessActivity: input.businessActivity || "Consulta general",
    selectedNeeds: input.selectedNeeds || [],
    currentSystemStatus: input.currentSystemStatus || "No especificado",
    projectDescription: input.projectDescription,
    preselectedCategory: input.preselectedCategory || null,
    preselectedService: input.preselectedService || null,
    contact: input.contact,
    observations: [],
    changeLog: [
      {
        id: `log-${Date.now()}`,
        timestamp: now,
        actor: "Sistema Web",
        action: `Solicitud creada desde ${
          input.source === "configurador"
            ? "Configurador de Proyectos"
            : "Formulario de Contacto"
        } con estado inicial 'Nueva'.`,
      },
    ],
  };

  db.inquiries.unshift(newInquiry);
  writeDb(db);
  return newInquiry;
}

export function updateInquiryAdmin(
  id: string,
  updates: {
    status?: LeadStatus;
    newObservation?: string;
    actorEmail: string;
  }
): StoredInquiry | null {
  const db = readDb();
  const idx = db.inquiries.findIndex((item) => item.id === id);
  if (idx === -1) return null;

  const inquiry = db.inquiries[idx];
  const now = new Date().toISOString();

  if (updates.status && updates.status !== inquiry.status) {
    const previous = inquiry.status;
    inquiry.status = updates.status;
    inquiry.changeLog.unshift({
      id: `log-${Date.now()}-status`,
      timestamp: now,
      actor: updates.actorEmail,
      action: `Estado comercial actualizado de '${previous}' a '${updates.status}'.`,
    });
  }

  if (updates.newObservation && updates.newObservation.trim().length > 0) {
    const obsText = updates.newObservation.trim();
    inquiry.observations.unshift({
      id: `obs-${Date.now()}`,
      author: updates.actorEmail,
      text: obsText,
      createdAt: now,
    });
    inquiry.changeLog.unshift({
      id: `log-${Date.now()}-obs`,
      timestamp: now,
      actor: updates.actorEmail,
      action: `Observación registrada: "${obsText.slice(0, 80)}${
        obsText.length > 80 ? "..." : ""
      }"`,
    });
  }

  inquiry.updatedAt = now;
  db.inquiries[idx] = inquiry;
  writeDb(db);
  return inquiry;
}

export function upsertPortfolioProject(project: PortfolioProject): PortfolioProject[] {
  const db = readDb();
  const idx = db.projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    db.projects[idx] = project;
  } else {
    db.projects.push(project);
  }
  writeDb(db);
  return db.projects;
}

export function deletePortfolioProject(projectId: string): PortfolioProject[] {
  const db = readDb();
  db.projects = db.projects.filter((p) => p.id !== projectId);
  writeDb(db);
  return db.projects;
}

export function updateContentAndFaqs(payload: {
  faqs?: FaqItem[];
  commercialContent?: CommercialContentSettings;
}) {
  const db = readDb();
  if (Array.isArray(payload.faqs)) {
    db.faqs = payload.faqs;
  }
  if (payload.commercialContent) {
    db.commercialContent = {
      ...db.commercialContent,
      ...payload.commercialContent,
    };
  }
  writeDb(db);
  return {
    faqs: db.faqs,
    commercialContent: db.commercialContent,
  };
}

export function updateSiteConfiguration(newConfig: Partial<ExtendedSiteConfig>): ExtendedSiteConfig {
  const db = readDb();
  db.siteConfig = {
    ...db.siteConfig,
    ...newConfig,
  };
  writeDb(db);
  return db.siteConfig;
}
