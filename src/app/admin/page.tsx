"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  StoredInquiry,
  CommercialContentSettings,
  ExtendedSiteConfig,
} from "@/lib/server/data-store";
import { FaqItem, LeadStatus, PortfolioProject } from "@/types/minisistema";
import { VALID_LEAD_STATUSES } from "@/lib/validation";
import { CONFIGURATOR_STEP1_ACTIVITIES } from "@/lib/site-data";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import {
  Lock,
  LogOut,
  Search,
  Download,
  FolderKanban,
  FileText,
  Settings,
  Inbox,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  MessageSquarePlus,
  Globe,
  ArrowLeft,
} from "lucide-react";

type AdminTab = "consultas" | "proyectos" | "contenidos" | "configuracion";

export default function AdminDashboardPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  // Estado formulario de acceso (autofill-sign-in-form)
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Estado general del panel
  const [activeTab, setActiveTab] = useState<AdminTab>("consultas");
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Datos cargados desde /api/admin/inquiries
  const [inquiries, setInquiries] = useState<StoredInquiry[]>([]);
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [commercialContent, setCommercialContent] =
    useState<CommercialContentSettings | null>(null);
  const [siteConfig, setSiteConfig] = useState<ExtendedSiteConfig | null>(null);

  // Filtros del Módulo Consultas
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActivity, setFilterActivity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [selectedInquiry, setSelectedInquiry] = useState<StoredInquiry | null>(null);
  const [newObservationText, setNewObservationText] = useState("");

  // Edición de Proyecto en Módulo Proyectos
  const [editingProject, setEditingProject] = useState<PortfolioProject | null>(null);
  const [featuresText, setFeaturesText] = useState("");
  const [screenshotsText, setScreenshotsText] = useState("");

  // Destinatarios en Módulo Configuración
  const [recipientsInput, setRecipientsInput] = useState("");

  const notifySuccess = (msg: string) => {
    setFeedbackBanner(msg);
    setErrorBanner(null);
    setTimeout(() => setFeedbackBanner(null), 4000);
  };

  const notifyError = (msg: string) => {
    setErrorBanner(msg);
    setFeedbackBanner(null);
  };

  const loadAdminData = async () => {
    try {
      const res = await fetch("/api/admin/inquiries");
      if (!res.ok) {
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      setInquiries(data.inquiries || []);
      setProjects(data.projects || []);
      setFaqs(data.faqs || []);
      setCommercialContent(data.commercialContent || null);
      setSiteConfig(data.siteConfig || null);
      setRecipientsInput((data.siteConfig?.notificationRecipients || []).join(", "));
      setIsAuthenticated(true);
    } catch {
      notifyError("No se pudieron cargar los datos administrativos.");
    }
  };

  useEffect(() => {
    fetch("/api/admin/auth")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated) {
          setAdminEmail(data.user.email);
          setIsAuthenticated(true);
          loadAdminData();
        }
      })
      .finally(() => setAuthLoading(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Credenciales inválidas.");
        setLoggingIn(false);
        return;
      }
      setAdminEmail(data.user.email);
      setIsAuthenticated(true);
      await loadAdminData();
    } catch {
      setLoginError("Error de conexión al iniciar sesión.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setIsAuthenticated(false);
    setLoginPassword("");
  };

  // Filtrado de Consultas
  const filteredInquiries = inquiries.filter((inq) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const matchesName = inq.contact.fullName.toLowerCase().includes(q);
      const matchesBiz = inq.contact.businessName.toLowerCase().includes(q);
      const matchesId = inq.id.toLowerCase().includes(q);
      if (!matchesName && !matchesBiz && !matchesId) return false;
    }
    if (filterActivity && inq.businessActivity !== filterActivity) return false;
    if (filterStatus && inq.status !== filterStatus) return false;
    if (filterDateFrom) {
      const fromTime = new Date(filterDateFrom).getTime();
      if (new Date(inq.createdAt).getTime() < fromTime) return false;
    }
    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (new Date(inq.createdAt).getTime() > toDate.getTime()) return false;
    }
    return true;
  });

  // Exportar a CSV compatible con Excel (BOM UTF-8)
  const exportToCsvOrExcel = () => {
    const headers = [
      "ID",
      "Fecha Creación",
      "Última Actualización",
      "Estado Comercial",
      "Origen",
      "Nombre y Apellido",
      "Comercio / Institución",
      "Actividad",
      "Localidad",
      "Provincia",
      "WhatsApp",
      "Email",
      "Necesidades Seleccionadas",
      "Sistema Actual",
      "Descripción del Proyecto",
      "Observaciones",
    ];

    const escapeCsv = (val: string) => `"${(val || "").replace(/"/g, '""')}"`;

    const rows = filteredInquiries.map((inq) => [
      escapeCsv(inq.id),
      escapeCsv(new Date(inq.createdAt).toLocaleString("es-AR")),
      escapeCsv(new Date(inq.updatedAt).toLocaleString("es-AR")),
      escapeCsv(inq.status),
      escapeCsv(inq.source),
      escapeCsv(inq.contact.fullName),
      escapeCsv(inq.contact.businessName),
      escapeCsv(inq.businessActivity),
      escapeCsv(inq.contact.city),
      escapeCsv(inq.contact.province),
      escapeCsv(inq.contact.whatsapp),
      escapeCsv(inq.contact.email),
      escapeCsv(inq.selectedNeeds.join(" | ")),
      escapeCsv(inq.currentSystemStatus),
      escapeCsv(inq.projectDescription),
      escapeCsv(inq.observations.map((o) => `${o.createdAt}: ${o.text}`).join(" // ")),
    ]);

    const csvContent =
      "\uFEFF" + [headers.map(escapeCsv).join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `minisistema-consultas-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleUpdateInquiry = async (
    id: string,
    status?: LeadStatus,
    observation?: string
  ) => {
    try {
      const res = await fetch("/api/admin/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, observation }),
      });
      const data = await res.json();
      if (!res.ok) {
        notifyError(data.error || "No se pudo actualizar la consulta.");
        return;
      }
      const updated = data.inquiry as StoredInquiry;
      setInquiries((prev) => prev.map((item) => (item.id === id ? updated : item)));
      if (selectedInquiry?.id === id) {
        setSelectedInquiry(updated);
      }
      setNewObservationText("");
      notifySuccess(`Consulta ${id} actualizada correctamente.`);
    } catch {
      notifyError("Error de red al actualizar la consulta.");
    }
  };

  const startEditProject = (project?: PortfolioProject) => {
    const target: PortfolioProject = project || {
      id: "",
      name: "",
      description: "",
      activity: "",
      problemSolved: "",
      features: [],
      screenshots: [],
      status: "En preparación de caso",
      publicUrl: "",
      published: false,
    };
    setEditingProject(target);
    setFeaturesText(target.features.join("\n"));
    setScreenshotsText(target.screenshots.join("\n"));
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    const payload: PortfolioProject = {
      ...editingProject,
      features: featuresText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      screenshots: screenshotsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    const res = await fetch("/api/admin/projects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      notifyError(data.error || "Error al guardar el proyecto.");
      return;
    }
    setProjects(data.projects);
    setEditingProject(null);
    notifySuccess("Proyecto guardado y actualizado en el portafolio.");
  };

  const handleTogglePublishProject = async (project: PortfolioProject) => {
    const res = await fetch("/api/admin/projects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...project, published: !project.published }),
    });
    const data = await res.json();
    if (res.ok) {
      setProjects(data.projects);
      notifySuccess(
        !project.published
          ? `Proyecto "${project.name}" publicado en el sitio.`
          : `Proyecto "${project.name}" despublicado.`
      );
    }
  };

  const handleDeleteProject = async (id: string) => {
    const res = await fetch(`/api/admin/projects?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (res.ok) {
      setProjects(data.projects);
      notifySuccess("Proyecto eliminado del portafolio.");
    }
  };

  const handleSaveContents = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ faqs, commercialContent }),
    });
    const data = await res.json();
    if (!res.ok) {
      notifyError(data.error || "No se pudieron guardar los contenidos.");
      return;
    }
    setFaqs(data.faqs);
    setCommercialContent(data.commercialContent);
    notifySuccess("Textos comerciales y preguntas frecuentes actualizados.");
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteConfig) return;

    const recipients = recipientsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...siteConfig,
        notificationRecipients: recipients,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      notifyError(data.error || "Revisá los datos de configuración antes de guardar.");
      return;
    }
    setSiteConfig(data.siteConfig);
    notifySuccess("Configuración oficial validada y publicada.");
  };

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-petroleo)] text-[var(--color-blanco)]">
        <p className="text-sm font-bold text-[var(--color-menta)]">
          Verificando sesión administrativa de <BrandWordmark className="mx-0.5" />...
        </p>
      </div>
    );
  }

  // Vista de Inicio de Sesión Privado (cumpliendo autofill-sign-in-form)
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-dvh flex-col justify-center bg-[var(--color-petroleo)] px-4 py-12 text-[var(--color-blanco)]">
        <div className="mx-auto w-full max-w-md rounded-3xl border-2 border-[var(--color-menta)] bg-[var(--color-blanco)]/[0.03] p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <img
              src="/brand/header-isologotipo.png"
              alt="minisistema. SISTEMAS A MEDIDA"
              width={210}
              height={48}
              className="h-10 w-auto object-contain"
            />
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--color-menta)]">
              <Lock className="h-3.5 w-3.5" />
              Panel Administrativo Privado
            </span>
            <h1 className="mt-3 text-2xl font-extrabold text-[var(--color-blanco)]">
              Iniciar sesión de administrador
            </h1>
          </div>

          {loginError && (
            <div
              role="alert"
              className="mt-5 flex items-center gap-2 rounded-xl border border-[var(--color-blanco)] bg-[var(--color-blanco)]/10 p-3 text-xs font-semibold text-[var(--color-blanco)]"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-[var(--color-menta)]" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-bold uppercase tracking-wider text-[var(--color-blanco)]"
              >
                Correo electrónico de administrador
              </label>
              <input
                id="admin-email"
                name="email"
                type="email"
                autoComplete="username"
                spellCheck={false}
                required
                enterKeyHint="next"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@minisistema.com.ar"
                className="mt-1.5 w-full rounded-xl border border-[var(--color-blanco)]/25 bg-[var(--color-petroleo)] px-4 py-3 text-sm text-[var(--color-blanco)] focus:border-[var(--color-menta)] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-bold uppercase tracking-wider text-[var(--color-blanco)]"
                >
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[var(--color-menta)] hover:text-[var(--color-blanco)]"
                >
                  {showPassword ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Ocultar contraseña</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span>Mostrar contraseña</span>
                    </>
                  )}
                </button>
              </div>
              <input
                id="admin-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                enterKeyHint="done"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--color-blanco)]/25 bg-[var(--color-petroleo)] px-4 py-3 text-sm text-[var(--color-blanco)] focus:border-[var(--color-menta)] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full cursor-pointer rounded-xl bg-[var(--color-menta)] px-5 py-3.5 text-sm font-extrabold uppercase tracking-wide text-[var(--color-petroleo)] transition-colors hover:bg-[var(--color-blanco)] disabled:opacity-60"
            >
              {loggingIn ? "Ingresando..." : "Iniciar sesión en Panel"}
            </button>
          </form>

          <div className="mt-6 border-t border-[var(--color-blanco)]/10 pt-4 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-menta)] hover:text-[var(--color-blanco)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="inline-flex items-center gap-1">Volver al sitio público de <BrandWordmark className="h-3.5" /></span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--color-petroleo)] text-[var(--color-blanco)]">
      {/* Encabezado del Panel Administrativo */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-blanco)]/15 bg-[var(--color-petroleo)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <img
              src="/brand/header-isologotipo.png"
              alt="minisistema."
              width={170}
              height={40}
              className="h-8 w-auto object-contain"
            />
            <span className="rounded-lg border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-2.5 py-1 text-xs font-extrabold text-[var(--color-menta)]">
              PANEL ADMINISTRATIVO
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-[var(--color-blanco)]/75">{adminEmail}</span>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-blanco)]/20 px-3 py-2 text-xs font-bold text-[var(--color-blanco)] hover:border-[var(--color-menta)] hover:text-[var(--color-menta)]"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Ver sitio</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--color-blanco)]/10 px-3 py-2 text-xs font-bold text-[var(--color-blanco)] hover:bg-[var(--color-menta)] hover:text-[var(--color-petroleo)]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Salir</span>
            </button>
          </div>
        </div>

        {/* Pestañas de los 4 módulos obligatorios (Sección 19) */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="flex flex-wrap gap-2 border-t border-[var(--color-blanco)]/10 py-2.5">
            <button
              type="button"
              onClick={() => setActiveTab("consultas")}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === "consultas"
                  ? "bg-[var(--color-menta)] text-[var(--color-petroleo)]"
                  : "text-[var(--color-blanco)]/80 hover:bg-[var(--color-blanco)]/5"
              }`}
            >
              <Inbox className="h-4 w-4" />
              <span>Consultas ({inquiries.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("proyectos")}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === "proyectos"
                  ? "bg-[var(--color-menta)] text-[var(--color-petroleo)]"
                  : "text-[var(--color-blanco)]/80 hover:bg-[var(--color-blanco)]/5"
              }`}
            >
              <FolderKanban className="h-4 w-4" />
              <span>Proyectos ({projects.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("contenidos")}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === "contenidos"
                  ? "bg-[var(--color-menta)] text-[var(--color-petroleo)]"
                  : "text-[var(--color-blanco)]/80 hover:bg-[var(--color-blanco)]/5"
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Contenidos y FAQs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("configuracion")}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-extrabold transition-all ${
                activeTab === "configuracion"
                  ? "bg-[var(--color-menta)] text-[var(--color-petroleo)]"
                  : "text-[var(--color-blanco)]/80 hover:bg-[var(--color-blanco)]/5"
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Configuración</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {feedbackBanner && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-4 py-3 text-xs sm:text-sm font-bold text-[var(--color-menta)]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
        )}

        {errorBanner && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[var(--color-blanco)] bg-[var(--color-blanco)]/10 px-4 py-3 text-xs sm:text-sm font-bold text-[var(--color-blanco)]">
            <AlertCircle className="h-4 w-4 shrink-0 text-[var(--color-menta)]" />
            <span>{errorBanner}</span>
          </div>
        )}

        {/* ===============================================================
            MÓDULO 1: CONSULTAS COMERCIALES
           =============================================================== */}
        {activeTab === "consultas" && (
          <div className="space-y-6">
            {/* Barra de búsqueda, filtros y exportación CSV/Excel */}
            <div className="rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-5">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-menta)]">
                      Buscar nombre o empresa
                    </label>
                    <div className="relative mt-1">
                      <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[var(--color-blanco)]/50" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Nombre, negocio o ID..."
                        className="w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] py-2 pr-3 pl-9 text-xs text-[var(--color-blanco)] focus:border-[var(--color-menta)] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-menta)]">
                      Filtrar por actividad
                    </label>
                    <select
                      value={filterActivity}
                      onChange={(e) => setFilterActivity(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3 py-2 text-xs text-[var(--color-blanco)]"
                    >
                      <option value="">Todas las actividades</option>
                      {CONFIGURATOR_STEP1_ACTIVITIES.map((act) => (
                        <option key={act} value={act}>
                          {act}
                        </option>
                      ))}
                      <option value="Consulta de contacto directo">
                        Consulta de contacto directo
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-menta)]">
                      Estado comercial
                    </label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3 py-2 text-xs text-[var(--color-blanco)]"
                    >
                      <option value="">Todos los estados</option>
                      {VALID_LEAD_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-menta)]">
                      Desde fecha
                    </label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3 py-2 text-xs text-[var(--color-blanco)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-menta)]">
                      Hasta fecha
                    </label>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3 py-2 text-xs text-[var(--color-blanco)]"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={exportToCsvOrExcel}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-menta)] px-4 py-2.5 text-xs font-extrabold text-[var(--color-petroleo)] transition-colors hover:bg-[var(--color-blanco)]"
                >
                  <Download className="h-4 w-4" />
                  <span>Exportar CSV / Excel ({filteredInquiries.length})</span>
                </button>
              </div>
            </div>

            {/* Tabla Responsiva de Consultas (responsive-table) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className={selectedInquiry ? "lg:col-span-7" : "lg:col-span-12"}>
                <div
                  tabIndex={0}
                  role="region"
                  aria-labelledby="inquiries-table-caption"
                  className="ms-table-wrapper rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.02] p-4"
                >
                  <table className="ms-responsive-table text-left text-xs">
                    <caption
                      id="inquiries-table-caption"
                      className="mb-3 text-left text-sm font-extrabold text-[var(--color-menta)]"
                    >
                      Listado de Consultas Comerciales Recibidas ({filteredInquiries.length})
                    </caption>
                    <thead>
                      <tr className="border-b border-[var(--color-blanco)]/15 text-[11px] uppercase tracking-wider text-[var(--color-menta)]">
                        <th className="p-3">Cliente / Negocio</th>
                        <th className="p-3">Actividad</th>
                        <th className="p-3">Necesidades</th>
                        <th className="p-3">Contacto</th>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Estado</th>
                        <th className="p-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-blanco)]/10">
                      {filteredInquiries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-sm text-[var(--color-blanco)]/65">
                            No hay consultas que coincidan con los filtros seleccionados.
                          </td>
                        </tr>
                      ) : (
                        filteredInquiries.map((inq) => (
                          <tr
                            key={inq.id}
                            className={`transition-colors hover:bg-[var(--color-blanco)]/[0.04] ${
                              selectedInquiry?.id === inq.id ? "bg-[var(--color-blanco)]/10" : ""
                            }`}
                          >
                            <th className="p-3 font-bold text-[var(--color-blanco)]">
                              <span className="block text-[var(--color-menta)]">{inq.id}</span>
                              <span>{inq.contact.fullName}</span>
                              <span className="block text-[11px] font-normal text-[var(--color-blanco)]/70">
                                {inq.contact.businessName}
                              </span>
                            </th>
                            <td className="p-3 text-[var(--color-blanco)]/85">{inq.businessActivity}</td>
                            <td className="p-3 text-[var(--color-blanco)]/80">
                              {inq.selectedNeeds.slice(0, 2).join(", ")}
                              {inq.selectedNeeds.length > 2 &&
                                ` (+${inq.selectedNeeds.length - 2})`}
                            </td>
                            <td className="p-3 text-[var(--color-blanco)]/85">
                              <span className="block">{inq.contact.whatsapp}</span>
                              <span className="block text-[11px] text-[var(--color-blanco)]/65">
                                {inq.contact.email}
                              </span>
                            </td>
                            <td className="p-3 text-[var(--color-blanco)]/75">
                              {new Date(inq.createdAt).toLocaleDateString("es-AR")}
                            </td>
                            <td className="p-3">
                              <select
                                aria-label={`Cambiar estado de ${inq.id}`}
                                value={inq.status}
                                onChange={(e) =>
                                  handleUpdateInquiry(inq.id, e.target.value as LeadStatus)
                                }
                                className="rounded-lg border border-[var(--color-menta)] bg-[var(--color-petroleo)] px-2.5 py-1 text-xs font-bold text-[var(--color-menta)]"
                              >
                                {VALID_LEAD_STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => setSelectedInquiry(inq)}
                                className="cursor-pointer rounded-lg bg-[var(--color-menta)] px-3 py-1.5 text-xs font-extrabold text-[var(--color-petroleo)] hover:bg-[var(--color-blanco)]"
                              >
                                Ver ficha
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Ficha de detalle de consulta + observaciones + historial de cambios */}
              {selectedInquiry && (
                <div className="lg:col-span-5 rounded-3xl border-2 border-[var(--color-menta)] bg-[var(--color-blanco)]/[0.03] p-6">
                  <div className="flex items-center justify-between border-b border-[var(--color-blanco)]/10 pb-3">
                    <div>
                      <span className="text-xs font-extrabold text-[var(--color-menta)]">
                        {selectedInquiry.id} · {selectedInquiry.source.toUpperCase()}
                      </span>
                      <h3 className="text-lg font-extrabold text-[var(--color-blanco)]">
                        {selectedInquiry.contact.fullName} ({selectedInquiry.contact.businessName})
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedInquiry(null)}
                      className="rounded-lg border border-[var(--color-blanco)]/20 px-2.5 py-1 text-xs text-[var(--color-blanco)]/75 hover:border-[var(--color-menta)]"
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="mt-4 space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--color-petroleo)] p-3">
                      <div>
                        <span className="text-[var(--color-menta)] font-bold block">Creada:</span>
                        <span>{new Date(selectedInquiry.createdAt).toLocaleString("es-AR")}</span>
                      </div>
                      <div>
                        <span className="text-[var(--color-menta)] font-bold block">Actualizada:</span>
                        <span>{new Date(selectedInquiry.updatedAt).toLocaleString("es-AR")}</span>
                      </div>
                      <div>
                        <span className="text-[var(--color-menta)] font-bold block">Ubicación:</span>
                        <span>
                          {selectedInquiry.contact.city}, {selectedInquiry.contact.province}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--color-menta)] font-bold block">Sistema actual:</span>
                        <span>{selectedInquiry.currentSystemStatus}</span>
                      </div>
                    </div>

                    <div>
                      <span className="font-bold text-[var(--color-menta)]">Necesidades seleccionadas:</span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {selectedInquiry.selectedNeeds.map((n) => (
                          <span
                            key={n}
                            className="rounded-md border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-menta)]"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="font-bold text-[var(--color-menta)]">Descripción del proyecto:</span>
                      <p className="mt-1 rounded-xl border border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] p-3 text-[var(--color-blanco)]/90 whitespace-pre-line">
                        {selectedInquiry.projectDescription}
                      </p>
                    </div>

                    {/* Registrar nueva observación */}
                    <div className="border-t border-[var(--color-blanco)]/10 pt-3">
                      <label className="block font-bold text-[var(--color-menta)]">
                        Registrar observación comercial
                      </label>
                      <div className="mt-1.5 flex gap-2">
                        <input
                          type="text"
                          value={newObservationText}
                          onChange={(e) => setNewObservationText(e.target.value)}
                          placeholder="Ej: Se llamó por WhatsApp, enviar propuesta el viernes..."
                          className="flex-1 rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3 py-2 text-xs text-[var(--color-blanco)]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateInquiry(
                              selectedInquiry.id,
                              undefined,
                              newObservationText
                            )
                          }
                          className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-[var(--color-menta)] px-3 py-2 text-xs font-extrabold text-[var(--color-petroleo)]"
                        >
                          <MessageSquarePlus className="h-3.5 w-3.5" />
                          <span>Guardar</span>
                        </button>
                      </div>

                      {selectedInquiry.observations.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                          {selectedInquiry.observations.map((obs) => (
                            <li
                              key={obs.id}
                              className="rounded-lg border border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)]/80 p-2.5"
                            >
                              <span className="block text-[10px] text-[var(--color-menta)]">
                                {new Date(obs.createdAt).toLocaleString("es-AR")} · {obs.author}
                              </span>
                              <p className="mt-0.5 text-xs text-[var(--color-blanco)]">{obs.text}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Registro básico de cambios (Auditoría) */}
                    <div className="border-t border-[var(--color-blanco)]/10 pt-3">
                      <span className="flex items-center gap-1.5 font-bold text-[var(--color-menta)]">
                        <Clock className="h-3.5 w-3.5" />
                        Registro de cambios
                      </span>
                      <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto pr-1">
                        {selectedInquiry.changeLog.map((log) => (
                          <li
                            key={log.id}
                            className="rounded-lg bg-[var(--color-petroleo)]/60 px-2.5 py-1.5 text-[11px] text-[var(--color-blanco)]/80"
                          >
                            <span className="font-bold text-[var(--color-menta)]">
                              {new Date(log.timestamp).toLocaleString("es-AR")}:
                            </span>{" "}
                            {log.action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===============================================================
            MÓDULO 2: PROYECTOS DEL PORTAFOLIO
           =============================================================== */}
        {activeTab === "proyectos" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-6">
              <div>
                <h2 className="text-xl font-extrabold text-[var(--color-blanco)]">
                  Portafolio Administrable de Proyectos
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-[var(--color-blanco)]/75">
                  Cargá, modificá, publicá o despublicá casos reales (como Casa Nueva, Campo Directo
                  y Biblioteca Roncedo) una vez aprobados sus textos e imágenes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => startEditProject()}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-menta)] px-4 py-2.5 text-xs font-extrabold text-[var(--color-petroleo)]"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo proyecto</span>
              </button>
            </div>

            {editingProject && (
              <form
                onSubmit={handleSaveProject}
                className="rounded-3xl border-2 border-[var(--color-menta)] bg-[var(--color-blanco)]/[0.04] p-6 space-y-4"
              >
                <h3 className="text-lg font-extrabold text-[var(--color-menta)]">
                  {editingProject.id ? `Editar: ${editingProject.name}` : "Cargar nuevo proyecto"}
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-[var(--color-blanco)]">
                      Nombre del proyecto *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingProject.name}
                      onChange={(e) =>
                        setEditingProject({ ...editingProject, name: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3 py-2 text-xs text-[var(--color-blanco)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-[var(--color-blanco)]">
                      Actividad / Rubro *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingProject.activity}
                      onChange={(e) =>
                        setEditingProject({ ...editingProject, activity: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3 py-2 text-xs text-[var(--color-blanco)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-[var(--color-blanco)]">
                      Estado del proyecto
                    </label>
                    <select
                      value={editingProject.status}
                      onChange={(e) =>
                        setEditingProject({
                          ...editingProject,
                          status: e.target.value as PortfolioProject["status"],
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3 py-2 text-xs text-[var(--color-blanco)]"
                    >
                      <option value="En preparación de caso">En preparación de caso</option>
                      <option value="En desarrollo">En desarrollo</option>
                      <option value="Implementado">Implementado</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase text-[var(--color-blanco)]">
                      Descripción comercial *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={editingProject.description}
                      onChange={(e) =>
                        setEditingProject({ ...editingProject, description: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] p-3 text-xs text-[var(--color-blanco)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-[var(--color-blanco)]">
                      Problema que resuelve *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={editingProject.problemSolved}
                      onChange={(e) =>
                        setEditingProject({ ...editingProject, problemSolved: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] p-3 text-xs text-[var(--color-blanco)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase text-[var(--color-blanco)]">
                      Funcionalidades (una por línea)
                    </label>
                    <textarea
                      rows={4}
                      value={featuresText}
                      onChange={(e) => setFeaturesText(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] p-3 text-xs text-[var(--color-blanco)]"
                    />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold uppercase text-[var(--color-blanco)]">
                        Enlace público (opcional)
                      </label>
                      <input
                        type="url"
                        value={editingProject.publicUrl || ""}
                        onChange={(e) =>
                          setEditingProject({ ...editingProject, publicUrl: e.target.value })
                        }
                        placeholder="https://..."
                        className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3 py-2 text-xs text-[var(--color-blanco)]"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        id="proj-published"
                        type="checkbox"
                        checked={editingProject.published}
                        onChange={(e) =>
                          setEditingProject({ ...editingProject, published: e.target.checked })
                        }
                        className="h-4 w-4 accent-[var(--color-menta)]"
                      />
                      <label htmlFor="proj-published" className="text-xs font-bold text-[var(--color-menta)]">
                        Publicar proyecto visiblemente en la página principal
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="cursor-pointer rounded-xl bg-[var(--color-menta)] px-5 py-2.5 text-xs font-extrabold text-[var(--color-petroleo)]"
                  >
                    Guardar proyecto
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProject(null)}
                    className="cursor-pointer rounded-xl border border-[var(--color-blanco)]/20 px-4 py-2.5 text-xs font-bold text-[var(--color-blanco)]"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className="flex flex-col justify-between rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-5"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--color-menta)]">{proj.activity}</span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          proj.published
                            ? "bg-[var(--color-menta)] text-[var(--color-petroleo)]"
                            : "border border-[var(--color-blanco)]/25 text-[var(--color-blanco)]/70"
                        }`}
                      >
                        {proj.published ? "Publicado" : "Borrador / Oculto"}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-extrabold text-[var(--color-blanco)]">{proj.name}</h3>
                    <p className="mt-1.5 text-xs text-[var(--color-blanco)]/75">{proj.description}</p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--color-blanco)]/10 pt-4">
                    <button
                      type="button"
                      onClick={() => startEditProject(proj)}
                      className="cursor-pointer rounded-lg border border-[var(--color-menta)] px-3 py-1.5 text-xs font-bold text-[var(--color-menta)] hover:bg-[var(--color-menta)] hover:text-[var(--color-petroleo)]"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePublishProject(proj)}
                      className="cursor-pointer rounded-lg bg-[var(--color-blanco)]/10 px-3 py-1.5 text-xs font-bold text-[var(--color-blanco)] hover:bg-[var(--color-menta)] hover:text-[var(--color-petroleo)]"
                    >
                      {proj.published ? "Despublicar" : "Publicar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(proj.id)}
                      aria-label={`Eliminar ${proj.name}`}
                      className="ml-auto cursor-pointer rounded-lg border border-[var(--color-blanco)]/15 p-1.5 text-[var(--color-blanco)]/60 hover:text-[var(--color-blanco)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===============================================================
            MÓDULO 3: CONTENIDOS Y PREGUNTAS FRECUENTES
           =============================================================== */}
        {activeTab === "contenidos" && commercialContent && (
          <form onSubmit={handleSaveContents} className="space-y-6">
            <div className="rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-6 space-y-4">
              <h2 className="text-xl font-extrabold text-[var(--color-blanco)]">
                Textos Comerciales Principales
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--color-menta)]">
                    Subtítulo Portada Hero
                  </label>
                  <textarea
                    rows={3}
                    value={commercialContent.heroSubtitle}
                    onChange={(e) =>
                      setCommercialContent({
                        ...commercialContent,
                        heroSubtitle: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] p-3 text-xs text-[var(--color-blanco)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[var(--color-menta)]">
                    Eslogan de Evolución
                  </label>
                  <input
                    type="text"
                    value={commercialContent.evolutionSlogan}
                    onChange={(e) =>
                      setCommercialContent({
                        ...commercialContent,
                        evolutionSlogan: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3 py-2.5 text-xs text-[var(--color-blanco)]"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold text-[var(--color-blanco)]">
                  Preguntas Frecuentes ({faqs.length})
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setFaqs([
                      ...faqs,
                      {
                        id: `faq-${Date.now()}`,
                        question: "¿Nueva pregunta frecuente?",
                        answer: "Respuesta clara para el cliente.",
                      },
                    ])
                  }
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--color-menta)] px-3.5 py-2 text-xs font-extrabold text-[var(--color-petroleo)]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Agregar pregunta</span>
                </button>
              </div>

              <div className="space-y-3">
                {faqs.map((faq, idx) => (
                  <div
                    key={faq.id}
                    className="rounded-2xl border border-[var(--color-blanco)]/15 bg-[var(--color-petroleo)] p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={faq.question}
                        onChange={(e) => {
                          const next = [...faqs];
                          next[idx] = { ...faq, question: e.target.value };
                          setFaqs(next);
                        }}
                        className="flex-1 rounded-lg border border-[var(--color-blanco)]/20 bg-[var(--color-blanco)]/5 px-3 py-1.5 text-xs font-bold text-[var(--color-blanco)]"
                      />
                      <button
                        type="button"
                        onClick={() => setFaqs(faqs.filter((_, i) => i !== idx))}
                        className="cursor-pointer rounded-lg border border-[var(--color-blanco)]/15 p-1.5 text-[var(--color-blanco)]/65 hover:text-[var(--color-blanco)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={faq.answer}
                      onChange={(e) => {
                        const next = [...faqs];
                        next[idx] = { ...faq, answer: e.target.value };
                        setFaqs(next);
                      }}
                      className="w-full rounded-lg border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.02] p-2.5 text-xs text-[var(--color-blanco)]/85"
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="cursor-pointer rounded-xl bg-[var(--color-menta)] px-6 py-3 text-xs sm:text-sm font-extrabold text-[var(--color-petroleo)]"
              >
                Guardar contenidos y preguntas frecuentes
              </button>
            </div>
          </form>
        )}

        {/* ===============================================================
            MÓDULO 4: CONFIGURACIÓN Y CANALES OFICIALES
           =============================================================== */}
        {activeTab === "configuracion" && siteConfig && (
          <form
            onSubmit={handleSaveSettings}
            className="rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-6 sm:p-8 space-y-5"
          >
            <div>
              <h2 className="text-xl font-extrabold text-[var(--color-blanco)]">
                Configuración de Canales Oficiales e Información Institucional
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[var(--color-blanco)]/75">
                Todos los cambios se validan antes de publicarse y actualizan los enlaces del sitio
                sin necesidad de editar el código fuente.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase text-[var(--color-menta)]">
                  Número de WhatsApp (solo dígitos con país) *
                </label>
                <input
                  type="text"
                  required
                  value={siteConfig.whatsappNumber}
                  onChange={(e) =>
                    setSiteConfig({ ...siteConfig, whatsappNumber: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3.5 py-2.5 text-xs text-[var(--color-blanco)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[var(--color-menta)]">
                  Formato visible de WhatsApp *
                </label>
                <input
                  type="text"
                  required
                  value={siteConfig.whatsappDisplay}
                  onChange={(e) =>
                    setSiteConfig({ ...siteConfig, whatsappDisplay: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3.5 py-2.5 text-xs text-[var(--color-blanco)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[var(--color-menta)]">
                  Instagram Oficial *
                </label>
                <input
                  type="url"
                  required
                  value={siteConfig.instagramUrl}
                  onChange={(e) =>
                    setSiteConfig({ ...siteConfig, instagramUrl: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3.5 py-2.5 text-xs text-[var(--color-blanco)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[var(--color-menta)]">
                  Facebook Oficial *
                </label>
                <input
                  type="url"
                  required
                  value={siteConfig.facebookUrl}
                  onChange={(e) =>
                    setSiteConfig({ ...siteConfig, facebookUrl: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3.5 py-2.5 text-xs text-[var(--color-blanco)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[var(--color-menta)]">
                  Correo electrónico comercial (opcional hasta confirmar)
                </label>
                <input
                  type="email"
                  value={siteConfig.commercialEmail || ""}
                  onChange={(e) =>
                    setSiteConfig({
                      ...siteConfig,
                      commercialEmail: e.target.value || null,
                    })
                  }
                  placeholder="Sin correo público hasta ser proporcionado"
                  className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3.5 py-2.5 text-xs text-[var(--color-blanco)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[var(--color-menta)]">
                  Destinatarios de notificaciones (separados por coma)
                </label>
                <input
                  type="text"
                  value={recipientsInput}
                  onChange={(e) => setRecipientsInput(e.target.value)}
                  placeholder="correo1@minisistema.com.ar, correo2@minisistema.com.ar"
                  className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] px-3.5 py-2.5 text-xs text-[var(--color-blanco)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[var(--color-menta)]">
                Mensaje inicial predeterminado de WhatsApp *
              </label>
              <textarea
                rows={2}
                required
                value={siteConfig.defaultWhatsappMessage}
                onChange={(e) =>
                  setSiteConfig({
                    ...siteConfig,
                    defaultWhatsappMessage: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] p-3 text-xs text-[var(--color-blanco)]"
              />
            </div>

            <button
              type="submit"
              className="cursor-pointer rounded-xl bg-[var(--color-menta)] px-6 py-3.5 text-xs sm:text-sm font-extrabold text-[var(--color-petroleo)]"
            >
              Validar y guardar configuración oficial
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
