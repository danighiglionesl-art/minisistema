export type SolutionCategoryId =
  | "gestion"
  | "tiendas"
  | "pwa"
  | "reservas"
  | "institucional"
  | "automatizaciones"
  | "especializadas"
  | "idea-propia";

export interface SolutionCategory {
  id: SolutionCategoryId;
  number: string;
  title: string;
  description: string;
  iconName: string;
  defaultNeedPreselect: string[];
  previewLabel: string;
}

export interface WorkflowStep {
  number: string;
  title: string;
  description: string;
  highlight: string;
}

export interface AccompanimentPillar {
  id: string;
  title: string;
  description: string;
  stageLabel: string;
  modulesAdded: string[];
}

export interface CommercialService {
  id: string;
  number: string;
  badge: string;
  title: string;
  headline: string;
  description: string;
  itemsLabel: string;
  items: string[];
  commercialModality: string;
  ctaLabel: string;
  preselectedNeed?: string;
}

export interface PortfolioProject {
  id: string;
  name: string;
  logoUrl?: string;
  description: string;
  activity: string;
  problemSolved: string;
  features: string[];
  screenshots: string[];
  status: "En preparación de caso" | "En desarrollo" | "Implementado" | "Ejemplo ilustrativo";
  publicUrl?: string;
  published: boolean;
  isIllustrativeExample?: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export type LeadStatus =
  | "Nueva"
  | "Contactada"
  | "En análisis"
  | "Propuesta enviada"
  | "Aprobada"
  | "No concretada";

export interface ProjectConfiguratorSubmission {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: LeadStatus;
  businessActivity: string;
  selectedNeeds: string[];
  currentSystemStatus: string;
  projectDescription: string;
  preselectedCategory?: SolutionCategoryId | null;
  contact: {
    fullName: string;
    businessName: string;
    city: string;
    province: string;
    whatsapp: string;
    email: string;
    privacyConsent: boolean;
  };
}

export interface SiteConfiguration {
  whatsappNumber: string;
  whatsappDisplay: string;
  whatsappUrl: string;
  defaultWhatsappMessage: string;
  instagramUrl: string;
  facebookUrl: string;
  commercialEmail: string | null;
  physicalAddress: string | null;
}
