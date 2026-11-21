"use client";

import React, { useEffect, useMemo, useState } from "react";
import type {
  InmoBannerRecord,
  InmoClienteRecord,
  InmoContratoRecord,
  InmoPortalConfig,
  InmoPropiedadRecord,
  OperacionInmobiliaria,
} from "@/lib/erp/inmobiliaria-types";
import {
  FacebookIcon,
  InstagramIcon,
  WhatsAppIcon,
} from "@/components/icons/SocialIcons";
import InmoClientPortalModal from "./InmoClientPortalModal";

interface PaisItem {
  id: number;
  nombre: string;
}

interface LocalidadItem {
  nombre: string;
  cp?: string;
}

export interface PublicInmobiliariaPortalProps {
  tenantSlug: string;
  fantasyName: string;
  businessName: string;
  primaryHex: string;
  accentHex: string;
  logoHorizontalUrl: string;
  logo1x1Url: string;
  isMiniSistemaBrand: boolean;
  defaultProvincia: string;
  defaultLocalidad: string;
  defaultCp: string;
  initialConfig: InmoPortalConfig;
  initialBanners: InmoBannerRecord[];
  initialPropiedades: InmoPropiedadRecord[];
  catalogs: {
    paises: PaisItem[];
    provincias: string[];
    localidadesPorProvincia: Record<string, LocalidadItem[]>;
  };
}

function fmtMoney(val: number, moneda: "ARS" | "USD"): string {
  const n = Number(val || 0);
  if (moneda === "USD") {
    return `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  }
  return `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function opLabel(op: OperacionInmobiliaria): string {
  if (op === "venta") return "Venta";
  if (op === "alquiler") return "Alquiler";
  return "Alquiler Temporario";
}

function regimenLabel(reg: string): string {
  const map: Record<string, string> = {
    propiedad_individual: "Propiedad Individual",
    propiedad_horizontal: "Propiedad Horizontal (PH)",
    condominio: "Condominio",
    barrio_privado_country: "Barrio Privado / Country",
    fideicomiso: "Fideicomiso",
  };
  return map[reg] || reg;
}

function construccionLabel(est: string): string {
  const map: Record<string, string> = {
    con_construccion: "Con Construcción",
    sin_construccion: "Sin Construcción (Lote/Campo)",
    en_construccion: "En Construcción / Pozo",
    a_reciclar: "A Reciclar",
  };
  return map[est] || est;
}

function ribbonBgColor(text: string, customBg?: string): string {
  if (customBg && /^#/.test(customBg)) return customBg;
  const low = text.toLowerCase();
  if (low.includes("liquid")) return "#D90202";
  if (low.includes("oportunidad")) return "#FC8006";
  if (low.includes("oferta")) return "#0284c7";
  if (low.includes("reserv")) return "#7c3aed";
  return "#D90202";
}

type InmoIconName =
  | "sparkle"
  | "garage"
  | "pool"
  | "grill"
  | "balcony"
  | "bank"
  | "pet"
  | "price"
  | "homeSearch"
  | "heart"
  | "heartFilled"
  | "compare"
  | "camera"
  | "pin"
  | "area"
  | "field"
  | "bed"
  | "bath"
  | "building"
  | "clock"
  | "phone";

function InmoIcon({
  name,
  size = 15,
  className = "shrink-0",
}: {
  name: InmoIconName;
  size?: number;
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "sparkle":
      return (
        <svg {...common}>
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
          <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
        </svg>
      );
    case "garage":
      return (
        <svg {...common}>
          <path d="M3 10l9-6 9 6v10H3V10z" />
          <path d="M7 20v-7h10v7" />
          <path d="M7 16h10" />
        </svg>
      );
    case "pool":
      return (
        <svg {...common}>
          <path d="M2 16c1.5 1.2 3.5 1.2 5 0s3.5-1.2 5 0 3.5 1.2 5 0 3.5-1.2 5 0" />
          <path d="M2 20c1.5 1.2 3.5 1.2 5 0s3.5-1.2 5 0 3.5 1.2 5 0 3.5-1.2 5 0" />
          <path d="M8 13V6a2 2 0 0 1 4 0" />
          <path d="M16 13V6a2 2 0 0 1 4 0" />
          <path d="M8 9h8" />
        </svg>
      );
    case "grill":
      return (
        <svg {...common}>
          <path d="M12 3c2.5 2.5 4 5.2 4 8a4 4 0 1 1-8 0c0-1.6.6-3.2 1.6-4.5.2 1.3.9 2 1.9 2.2C11.1 7 11.4 4.8 12 3z" />
          <path d="M5 19h14" />
        </svg>
      );
    case "balcony":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="9" rx="1" />
          <path d="M12 4v9" />
          <path d="M2 13h20" />
          <path d="M4 13v7h16v-7" />
          <path d="M8 13v7M12 13v7M16 13v7" />
        </svg>
      );
    case "bank":
      return (
        <svg {...common}>
          <path d="M3 10h18L12 4 3 10z" />
          <path d="M5 10v8M10 10v8M14 10v8M19 10v8" />
          <path d="M3 20h18" />
        </svg>
      );
    case "pet":
      return (
        <svg {...common}>
          <circle cx="7" cy="9" r="1.7" />
          <circle cx="12" cy="7" r="1.7" />
          <circle cx="17" cy="9" r="1.7" />
          <path d="M12 12c-3 0-5.5 2.4-5.5 5 0 1.4 1.1 2.2 2.5 2.2 1.2 0 2-.5 3-.5s1.8.5 3 .5c1.4 0 2.5-.8 2.5-2.2 0-2.6-2.5-5-5.5-5z" />
        </svg>
      );
    case "price":
      return (
        <svg {...common}>
          <line x1="12" y1="2" x2="12" y2="22" />
          <path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case "homeSearch":
      return (
        <svg {...common} strokeWidth={1.7}>
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5 9.5V19a2 2 0 0 0 2 2h4" />
          <circle cx="16.5" cy="16.5" r="3.5" />
          <path d="M19.2 19.2L22 22" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M19.5 12.6L12 20l-7.5-7.4a5 5 0 0 1 7.1-7.1L12 6l.4-.5a5 5 0 0 1 7.1 7.1z" />
        </svg>
      );
    case "heartFilled":
      return (
        <svg {...common} fill="currentColor">
          <path d="M19.5 12.6L12 20l-7.5-7.4a5 5 0 0 1 7.1-7.1L12 6l.4-.5a5 5 0 0 1 7.1 7.1z" />
        </svg>
      );
    case "compare":
      return (
        <svg {...common}>
          <path d="M16 3h5v5" />
          <path d="M8 21H3v-5" />
          <path d="M21 3l-7 7" />
          <path d="M3 21l7-7" />
        </svg>
      );
    case "camera":
      return (
        <svg {...common}>
          <path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      );
    case "pin":
      return (
        <svg {...common}>
          <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "area":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="1.5" />
          <path d="M9 4v4M15 4v4M4 9h4M4 15h4" />
        </svg>
      );
    case "field":
      return (
        <svg {...common}>
          <path d="M3 19c4-3 14-3 18 0" />
          <path d="M4 15c4-2.2 12-2.2 16 0" />
          <path d="M12 13V4" />
          <path d="M12 7c2-2 4.5-2 6-1-1 2-3.5 3-6 2" />
          <path d="M12 10c-2-2-4.5-2-6-1 1 2 3.5 3 6 2" />
        </svg>
      );
    case "bed":
      return (
        <svg {...common}>
          <path d="M3 7v11" />
          <path d="M3 14h18v4" />
          <path d="M21 14v-3a2 2 0 0 0-2-2H8v5" />
          <circle cx="6.5" cy="11" r="1.5" />
        </svg>
      );
    case "bath":
      return (
        <svg {...common}>
          <path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3z" />
          <path d="M7 12V6a2 2 0 0 1 4 0" />
          <path d="M7 19l-1 2M17 19l1 2" />
        </svg>
      );
    case "building":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="1.5" />
          <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15.5 14" />
        </svg>
      );
    case "phone":
      return (
        <svg {...common}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      );
  }
}

export default function PublicInmobiliariaPortal(props: PublicInmobiliariaPortalProps) {
  const [banners] = useState<InmoBannerRecord[]>(props.initialBanners);
  const [propiedades] = useState<InmoPropiedadRecord[]>(props.initialPropiedades);
  const [config] = useState<InmoPortalConfig>(props.initialConfig);

  // Carrusel de banners 1530x370
  const [bannerIdx, setBannerIdx] = useState(0);

  // Pestaña estilo Mercado Pago: Ventas | Alquileres | Alquileres Temporarios
  const [activeTab, setActiveTab] = useState<OperacionInmobiliaria>("venta");

  // Búsqueda rápida + Filtros inteligentes
  const [quickQuery, setQuickQuery] = useState("");
  const [filterAmbito, setFilterAmbito] = useState<"" | "urbana" | "rural">("");
  const [filterRegimen, setFilterRegimen] = useState("");
  const [filterConstruccion, setFilterConstruccion] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterMinHab, setFilterMinHab] = useState(0);
  const [filterMinBanos, setFilterMinBanos] = useState(0);
  const [filterGarage, setFilterGarage] = useState(false);
  const [filterPileta, setFilterPileta] = useState(false);
  const [filterQuincho, setFilterQuincho] = useState(false);
  const [filterBalcon, setFilterBalcon] = useState(false);
  const [filterAptoCredito, setFilterAptoCredito] = useState(false);
  const [filterMascotas, setFilterMascotas] = useState(false);
  const [filterSoloPrecio, setFilterSoloPrecio] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "price_asc" | "price_desc">("recent");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Motor de búsqueda con IA
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    summary: string;
    matchedIds: string[];
    source: string;
  } | null>(null);

  // Favoritos y Comparador (mejoras de portales líderes)
  const [favorites, setFavorites] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Modal de detalle de propiedad (galería, mapa geosatelital Google Maps, características, visita/consulta, calculadora hipotecaria)
  const [selectedProp, setSelectedProp] = useState<InmoPropiedadRecord | null>(null);
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);
  const [mapMode, setMapMode] = useState<"satellite" | "roadmap">("satellite");

  // Formulario de consulta / agendar visita dentro del modal de propiedad
  const [leadNombre, setLeadNombre] = useState("");
  const [leadWhatsapp, setLeadWhatsapp] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadMensaje, setLeadMensaje] = useState("");
  const [leadFechaVisita, setLeadFechaVisita] = useState("");
  const [leadSending, setLeadSending] = useState(false);
  const [leadSuccessMsg, setLeadSuccessMsg] = useState("");

  // Calculadora estimativa de cuota (Ventas)
  const [calcAnticipoPct, setCalcAnticipoPct] = useState(30);
  const [calcAnios, setCalcAnios] = useState(20);
  const [calcTna, setCalcTna] = useState(8);

  // Portal de Acceso a Clientes (modal)
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [loggedClient, setLoggedClient] = useState<Omit<
    InmoClienteRecord,
    "passwordHash" | "passwordPlainCompat" | "resetCode" | "resetCodeExpiresAt"
  > | null>(null);
  const [loggedContracts, setLoggedContracts] = useState<InmoContratoRecord[]>([]);

  // Cargar favoritos locales y sesión activa de cliente si existe
  useEffect(() => {
    try {
      const savedFavs = localStorage.getItem(`ms_inmo_favs_${props.tenantSlug}`);
      if (savedFavs) setFavorites(JSON.parse(savedFavs));
    } catch {}
    fetch(`/api/inmobiliaria?tenant=${encodeURIComponent(props.tenantSlug)}&action=client_me`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d.authenticated && d.client) {
          setLoggedClient(d.client);
          setLoggedContracts(Array.isArray(d.contratos) ? d.contratos : []);
        }
      })
      .catch(() => {});
  }, [props.tenantSlug]);

  // Rotación automática del carrusel de banners 1530x370
  useEffect(() => {
    if (banners.length <= 1) return;
    const id = setInterval(() => {
      setBannerIdx((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(id);
  }, [banners.length]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(`ms_inmo_favs_${props.tenantSlug}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const destacadas = useMemo(
    () => propiedades.filter((p) => p.destacada),
    [propiedades]
  );

  const destacadasTrack = useMemo(() => {
    if (destacadas.length === 0) return [];
    const repeatCount = Math.max(1, Math.ceil(8 / destacadas.length));
    const out: InmoPropiedadRecord[] = [];
    for (let r = 0; r < repeatCount; r++) {
      for (const p of destacadas) out.push(p);
    }
    return out;
  }, [destacadas]);

  const featuredMarqueeSeconds = Math.max(24, Math.round(destacadasTrack.length * 4.5));

  const tabCounts = useMemo(() => {
    return {
      venta: propiedades.filter((p) => p.operacion === "venta").length,
      alquiler: propiedades.filter((p) => p.operacion === "alquiler").length,
      alquiler_temporario: propiedades.filter((p) => p.operacion === "alquiler_temporario").length,
    };
  }, [propiedades]);

  const handleClickFeatured = (prop: InmoPropiedadRecord) => {
    setActiveTab(prop.operacion);
    setAiResult(null);
    setOnlyFavorites(false);
    setTimeout(() => {
      const cardEl = document.getElementById(`prop-card-${prop.id}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
        cardEl.classList.add("ring-4", "ring-[#FC8006]");
        setTimeout(() => cardEl.classList.remove("ring-4", "ring-[#FC8006]"), 2400);
      } else {
        const sec = document.getElementById("propiedades-tabs");
        if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 80);
  };

  const openPropertyDetail = (prop: InmoPropiedadRecord) => {
    setSelectedProp(prop);
    setSelectedPhotoIdx(0);
    setLeadSuccessMsg("");
    setLeadMensaje(`Hola, quiero recibir más información sobre ${prop.titulo} (${prop.codigo}).`);
    fetch(`/api/inmobiliaria?tenant=${encodeURIComponent(props.tenantSlug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "track_view", propiedadId: prop.id }),
    }).catch(() => {});
  };

  const handleRunAiSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = aiQuery.trim();
    if (!q) {
      setAiResult(null);
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch(`/api/inmobiliaria?tenant=${encodeURIComponent(props.tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ai_search", query: q }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAiResult({
          summary: data.summary,
          matchedIds: Array.isArray(data.matchedIds) ? data.matchedIds : [],
          source: data.source || "smart-nlp-local",
        });
        if (data.extractedFilters?.operacion) {
          setActiveTab(data.extractedFilters.operacion);
        }
        const sec = document.getElementById("propiedades-tabs");
        if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleSendLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProp) return;
    setLeadSending(true);
    setLeadSuccessMsg("");
    try {
      const res = await fetch(`/api/inmobiliaria?tenant=${encodeURIComponent(props.tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_inquiry",
          propiedadId: selectedProp.id,
          propiedadTitulo: selectedProp.titulo,
          nombre: leadNombre,
          whatsapp: leadWhatsapp,
          email: leadEmail,
          mensaje: leadMensaje,
          fechaVisitaDeseada: leadFechaVisita,
          tipo: leadFechaVisita ? "agendar_visita" : "consulta_propiedad",
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setLeadSuccessMsg(data.message);
        setLeadNombre("");
        setLeadWhatsapp("");
        setLeadEmail("");
        setLeadFechaVisita("");
      }
    } finally {
      setLeadSending(false);
    }
  };

  const filteredPropiedades = useMemo(() => {
    let list = aiResult
      ? propiedades.filter((p) => aiResult.matchedIds.includes(p.id))
      : propiedades.filter((p) => p.operacion === activeTab);

    if (onlyFavorites) {
      list = list.filter((p) => favorites.includes(p.id));
    }
    if (filterAmbito) list = list.filter((p) => p.ambito === filterAmbito);
    if (filterRegimen) list = list.filter((p) => p.regimen === filterRegimen);
    if (filterConstruccion) list = list.filter((p) => p.estadoConstruccion === filterConstruccion);
    if (filterTipo) list = list.filter((p) => p.tipoPropiedad === filterTipo);
    if (filterMinHab > 0) list = list.filter((p) => p.caracteristicas.cantidadHabitaciones >= filterMinHab);
    if (filterMinBanos > 0) list = list.filter((p) => p.caracteristicas.cantidadBanos >= filterMinBanos);
    if (filterGarage) list = list.filter((p) => p.caracteristicas.tieneGarage);
    if (filterPileta) list = list.filter((p) => p.caracteristicas.tienePileta);
    if (filterQuincho) list = list.filter((p) => p.caracteristicas.tieneQuincho);
    if (filterBalcon) list = list.filter((p) => p.caracteristicas.tieneBalcon);
    if (filterAptoCredito) list = list.filter((p) => p.caracteristicas.aptoCredito);
    if (filterMascotas) list = list.filter((p) => p.caracteristicas.permiteMascotas);
    if (filterSoloPrecio) list = list.filter((p) => p.mostrarPrecio && p.precio > 0);

    if (quickQuery.trim()) {
      const q = quickQuery
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      list = list.filter((p) => {
        const hay = [
          p.codigo,
          p.titulo,
          p.descripcion,
          p.tipoPropiedad,
          p.barrio,
          p.localidad,
          p.provincia,
          p.direccion,
          p.cartelCruzado,
          p.caracteristicas.tipoCalefaccion,
          p.caracteristicas.tipoRefrigeracion,
        ]
          .join(" ")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    if (sortBy === "price_asc") {
      list = [...list].sort((a, b) => (a.mostrarPrecio ? a.precio : 9e12) - (b.mostrarPrecio ? b.precio : 9e12));
    } else if (sortBy === "price_desc") {
      list = [...list].sort((a, b) => (b.mostrarPrecio ? b.precio : -1) - (a.mostrarPrecio ? a.precio : -1));
    }
    return list;
  }, [
    propiedades,
    activeTab,
    aiResult,
    onlyFavorites,
    favorites,
    filterAmbito,
    filterRegimen,
    filterConstruccion,
    filterTipo,
    filterMinHab,
    filterMinBanos,
    filterGarage,
    filterPileta,
    filterQuincho,
    filterBalcon,
    filterAptoCredito,
    filterMascotas,
    filterSoloPrecio,
    quickQuery,
    sortBy,
  ]);

  const compareProps = useMemo(
    () => propiedades.filter((p) => compareIds.includes(p.id)),
    [propiedades, compareIds]
  );

  const rawWaDigits = (config.whatsappNumero || "5493585615820").replace(/\D/g, "");
  const waBaseDigits =
    rawWaDigits.length === 10 && !rawWaDigits.startsWith("54")
      ? `549${rawWaDigits}`
      : rawWaDigits || "5493585615820";
  const waDisplay =
    waBaseDigits === "5493585615820"
      ? "358 561-5820"
      : waBaseDigits.replace(/^549/, "").replace(/^(\d{3})(\d{3})(\d{4})$/, "$1 $2-$3");
  const buildWaHref = (msg: string) =>
    `https://wa.me/${waBaseDigits}?text=${encodeURIComponent(msg)}`;

  const officeAddress = config.direccionOficina || "Rivadavia 476, Alcira Gigena, Córdoba";
  const officeMapsHref =
    config.googleMapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(officeAddress)}`;
  const officeHours =
    config.horariosAtencion || "Lunes a Viernes · 9:00 a 13:00 hs · 16:30 a 19:30 hs";
  const officeInstagramUrl =
    config.instagramUrl || "https://www.instagram.com/p/DeubjQUx1Mb/";
  const officeInstagramLabel = config.instagramLabel || "inmobiliariadegiovanni";
  const officeFacebookUrl =
    config.facebookUrl || "https://www.facebook.com/search/top?q=Inmobiliaria%20Degiovanni";
  const officeFacebookLabel = config.facebookLabel || "Inmobiliaria Degiovanni";
  const officeEmail = config.emailContacto || "inmobiliariadegiovanni@hotmail.com";

  const primary = props.primaryHex || "#1F1F1F";
  const accent = props.accentHex || "#FC8006";

  const activeBanner = banners[bannerIdx] || null;

  // Cálculo cuota estimativa hipotecaria (sistema francés)
  const calcEstimatedQuota = useMemo(() => {
    if (!selectedProp || !selectedProp.mostrarPrecio || selectedProp.precio <= 0) return 0;
    const principal = selectedProp.precio * (1 - calcAnticipoPct / 100);
    const r = calcTna / 100 / 12;
    const n = calcAnios * 12;
    if (r <= 0 || n <= 0) return principal / Math.max(1, n);
    return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
  }, [selectedProp, calcAnticipoPct, calcAnios, calcTna]);

  return (
    <div className="min-h-screen bg-[#F6F5F3] text-[#1F1F1F] flex flex-col">
      {/* CABECERA INSTITUCIONAL CON ACCESO A CLIENTES Y WHATSAPP */}
      <header
        className="sticky top-0 z-40 border-b-4 shadow-md"
        style={{ backgroundColor: primary, borderColor: accent }}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-3">
            <img
              src={props.logoHorizontalUrl}
              alt={props.fantasyName}
              className={
                props.isMiniSistemaBrand ||
                props.logoHorizontalUrl.includes("degiovanni-logo-horizontal")
                  ? "h-11 w-auto object-contain sm:h-12"
                  : "h-11 w-auto rounded-lg bg-[#FFFFFF] px-2.5 py-1 object-contain"
              }
            />
            {!props.isMiniSistemaBrand &&
              !props.logoHorizontalUrl.includes("degiovanni-logo-horizontal") && (
                <div className="hidden sm:block">
                  <div className="text-sm font-black text-[#FFFFFF]">{props.fantasyName}</div>
                  <div className="text-[11px] font-bold" style={{ color: accent }}>
                    {config.matriculaCorredor || "Portal Inmobiliario"}
                  </div>
                </div>
              )}
          </a>

          <div className="flex flex-wrap items-center gap-2.5">
            {favorites.length > 0 && (
              <button
                type="button"
                onClick={() => setOnlyFavorites((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold transition"
                style={{
                  borderColor: accent,
                  backgroundColor: onlyFavorites ? accent : "rgba(255,255,255,0.08)",
                  color: onlyFavorites ? primary : "#FFFFFF",
                }}
              >
                <InmoIcon name="heartFilled" size={14} />
                <span>Favoritos ({favorites.length})</span>
              </button>
            )}

            {compareIds.length >= 2 && (
              <button
                type="button"
                onClick={() => setShowCompareModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#FFFFFF]/30 bg-[#FFFFFF]/15 px-3 py-2 text-xs font-extrabold text-[#FFFFFF] hover:bg-[#FFFFFF]/25"
              >
                <InmoIcon name="compare" size={14} />
                <span>Comparar ({compareIds.length})</span>
              </button>
            )}

            <button
              type="button"
              id="acceso-clientes"
              onClick={() => setClientModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-xs font-black shadow transition hover:brightness-110 sm:text-sm"
              style={{ backgroundColor: "#2A2A2A", borderColor: accent, color: "#FFFFFF" }}
            >
              <img
                src={props.logo1x1Url || "/inmobiliaria/degiovanni-logo-symbol.png"}
                alt=""
                aria-hidden="true"
                className="h-6 w-6 rounded-full object-contain shrink-0"
              />
              <span>
                {loggedClient
                  ? `Mi Portal (${loggedClient.nombres})`
                  : "Acceso a Clientes"}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto w-full flex-1 max-w-7xl px-4 pt-5 sm:px-6 space-y-8">
        {/* 1. CARRUSEL DE BANNERS 1530x370 */}
        {banners.length > 0 && activeBanner && (
          <section
            aria-label="Banners institucionales y promociones"
            className="relative overflow-hidden rounded-3xl border-2 shadow-xl"
            style={{ borderColor: accent, backgroundColor: primary }}
          >
            <div className="relative w-full aspect-[1530/370] min-h-[190px] max-h-[390px] overflow-hidden bg-[#1F1F1F]">
              <img
                src={activeBanner.imageUrl}
                alt={activeBanner.titulo}
                className="h-full w-full object-cover transition-all duration-700"
              />
              <div
                className="absolute inset-0 flex flex-col justify-end p-5 pl-12 sm:p-8 sm:pl-14"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(22,22,22,0.92) 0%, rgba(28,28,28,0.52) 55%, rgba(31,31,31,0.04) 100%)",
                }}
              >
                <div className="max-w-xl">
                  <span
                    className="inline-block rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider"
                    style={{ backgroundColor: accent, color: primary }}
                  >
                    {config.matriculaCorredor || props.fantasyName}
                  </span>
                  <h1
                    className={`mt-2 text-lg font-black leading-tight text-[#FFFFFF] sm:text-2xl lg:text-3xl ${
                      activeBanner.titulo.length <= 38 ? "sm:whitespace-nowrap" : ""
                    }`}
                  >
                    {activeBanner.titulo}
                  </h1>
                  {activeBanner.subtitulo && (
                    <p className="mt-1.5 hidden max-w-lg text-sm font-medium text-[#FFFFFF]/90 sm:block">
                      {activeBanner.subtitulo}
                    </p>
                  )}
                  {activeBanner.linkUrl && (
                    <div className="mt-3">
                      <a
                        href={activeBanner.linkUrl}
                        onClick={(ev) => {
                          if (activeBanner.linkUrl === "#acceso-clientes") {
                            ev.preventDefault();
                            setClientModalOpen(true);
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black shadow hover:brightness-95 sm:text-sm"
                        style={{ backgroundColor: accent, color: primary }}
                      >
                        {activeBanner.ctaLabel || "Ver más"} →
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {banners.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Banner anterior"
                    onClick={() =>
                      setBannerIdx((prev) => (prev - 1 + banners.length) % banners.length)
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-[#1F1F1F]/80 px-3 py-2 text-lg font-black text-[#FFFFFF] hover:bg-[#1F1F1F]"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Banner siguiente"
                    onClick={() => setBannerIdx((prev) => (prev + 1) % banners.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[#1F1F1F]/80 px-3 py-2 text-lg font-black text-[#FFFFFF] hover:bg-[#1F1F1F]"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-3 right-5 flex items-center gap-1.5">
                    {banners.map((b, i) => (
                      <button
                        key={b.id}
                        type="button"
                        aria-label={`Ir al banner ${i + 1}`}
                        onClick={() => setBannerIdx(i)}
                        className="h-2.5 rounded-full transition-all"
                        style={{
                          width: i === bannerIdx ? "26px" : "10px",
                          backgroundColor: i === bannerIdx ? accent : "rgba(255,255,255,0.5)",
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* 2. CARRUSEL VIVO DE SELECCIÓN DESTACADA (MARQUEE INFINITO ESTILO CAMPODIRECTO.AR) */}
        {destacadasTrack.length > 0 && (
          <section
            aria-label="Selección Destacada"
            className="overflow-hidden rounded-2xl border border-[#1F1F1F]/10 bg-[#FFFFFF] p-4 shadow-md sm:rounded-3xl sm:p-5"
          >
            {/* Cabecera mejorada de Selección Destacada */}
            <div className="mb-4 flex items-center justify-center sm:mb-5">
              <div
                className="inline-flex items-center gap-2.5 rounded-full border-2 px-5 py-2 shadow-sm"
                style={{ backgroundColor: primary, borderColor: accent }}
              >
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black"
                  style={{ backgroundColor: accent, color: primary }}
                  aria-hidden="true"
                >
                  ★
                </span>
                <h2 className="text-xs font-black uppercase tracking-[0.16em] text-[#FFFFFF] sm:text-sm">
                  Selección Destacada
                </h2>
                <span
                  className="h-2 w-2 rounded-full animate-pulse"
                  style={{ backgroundColor: accent }}
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Riel del Carrusel Vivo Infinito con Máscaras de Gradiente Lateral */}
            <div className="inmo-marquee-viewport relative w-full overflow-hidden">
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-r from-[#FFFFFF] via-[#FFFFFF]/80 to-transparent sm:w-20" />
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-l from-[#FFFFFF] via-[#FFFFFF]/80 to-transparent sm:w-20" />

              <div
                className="inmo-marquee-track py-1.5"
                style={
                  {
                    "--inmo-marquee-duration": `${featuredMarqueeSeconds}s`,
                  } as React.CSSProperties
                }
              >
                {[0, 1].map((trackIdx) => (
                  <div
                    key={`dest-track-${trackIdx}`}
                    aria-hidden={trackIdx === 1 ? true : undefined}
                    className="flex shrink-0 items-center gap-4 pr-4 sm:gap-5 sm:pr-5"
                  >
                    {destacadasTrack.map((prop, itemIdx) => {
                      const cover = prop.fotos?.[0] || "/photos/ref-01.png";
                      return (
                        <button
                          key={`dest-${trackIdx}-${itemIdx}-${prop.id}`}
                          type="button"
                          tabIndex={trackIdx === 1 ? -1 : 0}
                          onClick={() => handleClickFeatured(prop)}
                          title={`Ver ${prop.titulo} (${opLabel(prop.operacion)})`}
                          className="group relative h-52 w-52 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-[#1F1F1F]/12 bg-[#1F1F1F] shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-[#FC8006] hover:shadow-xl sm:h-60 sm:w-60"
                        >
                          <img
                            src={cover}
                            alt={prop.titulo}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                          {prop.cartelCruzado && (
                            <div
                              className="pointer-events-none absolute -left-10 top-5 w-44 -rotate-45 py-1 text-center text-[10px] font-black uppercase tracking-wider shadow-lg"
                              style={{
                                backgroundColor: ribbonBgColor(prop.cartelCruzado, prop.cartelColorBg),
                                color:
                                  ribbonBgColor(prop.cartelCruzado, prop.cartelColorBg) === "#FC8006"
                                    ? "#1F1F1F"
                                    : "#FFFFFF",
                              }}
                            >
                              {prop.cartelCruzado}
                            </div>
                          )}
                          {prop.mostrarPrecio && prop.precio > 0 && (
                            <div className="pointer-events-none absolute right-2.5 top-2.5 rounded-full border border-[#FFFFFF]/20 bg-[#1F1F1F]/80 px-2.5 py-0.5 text-[11px] font-black text-[#FFFFFF] backdrop-blur-sm shadow">
                              {fmtMoney(prop.precio, prop.moneda)}
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1F1F1F]/95 via-[#1F1F1F]/65 to-transparent p-3 text-left">
                            <span
                              className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase"
                              style={{ backgroundColor: accent, color: primary }}
                            >
                              {opLabel(prop.operacion)} · {prop.localidad}
                            </span>
                            <div className="mt-1 line-clamp-1 text-xs font-extrabold text-[#FFFFFF]">
                              {prop.titulo}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 3. MOTOR DE BÚSQUEDA POR IA + BÚSQUEDA RÁPIDA */}
        {config.habilitarIaBuscador !== false && (
          <section
            className="rounded-3xl border-2 p-5 shadow-lg sm:p-6"
            style={{ backgroundColor: primary, borderColor: accent }}
          >
            <form onSubmit={handleRunAiSearch} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{ backgroundColor: accent, color: primary }}
                  >
                    <InmoIcon name="sparkle" size={17} />
                  </span>
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider" style={{ color: accent }}>
                      Buscador Inteligente con IA Inmobiliaria
                    </div>
                    <div className="text-xs text-[#FFFFFF]/80">
                      Describí con tus palabras lo que buscás (ej: &ldquo;Casa en venta con 3 dormitorios, pileta y garage para 2 autos&rdquo; o &ldquo;Depto con balcón en alquiler&rdquo;)
                    </div>
                  </div>
                </div>
                {aiResult && (
                  <button
                    type="button"
                    onClick={() => {
                      setAiResult(null);
                      setAiQuery("");
                    }}
                    className="rounded-lg border border-[#FFFFFF]/30 px-3 py-1 text-xs font-bold text-[#FFFFFF] hover:bg-[#FFFFFF]/10"
                  >
                    ✕ Limpiar búsqueda IA
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="Ej: Busco casa con pileta, quincho, 3 habitaciones y apta crédito en Río Cuarto..."
                  className="w-full flex-1 rounded-2xl border-2 border-[#FFFFFF]/20 bg-[#FFFFFF] px-4 py-3 text-sm font-semibold text-[#1F1F1F] shadow-inner focus:border-[#FC8006] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={aiLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-black shadow-lg transition hover:brightness-95 disabled:opacity-60"
                  style={{ backgroundColor: accent, color: primary }}
                >
                  <InmoIcon name="sparkle" size={16} />
                  <span>{aiLoading ? "Analizando con IA..." : "Buscar con IA"}</span>
                </button>
              </div>

              {aiResult && (
                <div className="rounded-2xl border border-[#FC8006]/50 bg-[#FFFFFF]/10 p-3.5 text-sm text-[#FFFFFF]">
                  <div className="inline-flex items-center gap-1.5 font-bold" style={{ color: accent }}>
                    <InmoIcon name="sparkle" size={15} />
                    <span>Recomendación IA ({aiResult.matchedIds.length} resultados):</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#FFFFFF]/95 sm:text-sm">
                    {aiResult.summary}
                  </p>
                </div>
              )}
            </form>
          </section>
        )}

        {/* 4. PESTAÑAS ESTILO MERCADO PAGO / CEMEP (VENTAS / ALQUILERES / ALQUILERES TEMPORARIOS) */}
        {(() => {
          const opTabs: Array<{
            key: OperacionInmobiliaria;
            label: string;
            shortLabel: string;
            sub: string;
            icon: React.ReactNode;
            count: number;
          }> = [
            {
              key: "venta",
              label: "Ventas",
              shortLabel: "Ventas",
              sub: "Casas, Deptos, Lotes y Campos",
              icon: (
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 10.5L12 3l9 7.5" />
                  <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
                  <path d="M9.5 21v-6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6" />
                </svg>
              ),
              count: tabCounts.venta,
            },
            {
              key: "alquiler",
              label: "Alquileres",
              shortLabel: "Alquileres",
              sub: "Vivienda y Comerciales",
              icon: (
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="7.5" cy="15.5" r="4.5" />
                  <path d="M11 12l9-9" />
                  <path d="M15.5 7.5L18 10" />
                  <path d="M18 5l2.5 2.5" />
                </svg>
              ),
              count: tabCounts.alquiler,
            },
            {
              key: "alquiler_temporario",
              label: "Alquileres Temporarios",
              shortLabel: "Temporarios",
              sub: "Por día, semana o quincena",
              icon: (
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="17" rx="2" />
                  <path d="M16 2v4" />
                  <path d="M8 2v4" />
                  <path d="M3 10h18" />
                  <path d="M9 15l2 2 4-4" />
                </svg>
              ),
              count: tabCounts.alquiler_temporario,
            },
          ];

          const currentVisualTab: OperacionInmobiliaria = activeTab;

          const tabsHeaderBg =
            currentVisualTab === "venta"
              ? `linear-gradient(90deg, ${primary} 0%, color-mix(in srgb, ${primary} 74%, ${accent}) 62%, ${accent} 100%)`
              : currentVisualTab === "alquiler"
              ? `linear-gradient(90deg, ${primary} 0%, color-mix(in srgb, ${primary} 58%, ${accent}) 55%, color-mix(in srgb, ${accent} 86%, ${primary}) 100%)`
              : `linear-gradient(90deg, color-mix(in srgb, ${primary} 88%, #000000) 0%, color-mix(in srgb, ${primary} 48%, ${accent}) 55%, ${accent} 100%)`;

          return (
            <section
              id="propiedades-tabs"
              className="w-full overflow-hidden rounded-[28px] border border-[#1F1F1F]/10 bg-[#FFFFFF] shadow-xl"
            >
              {/* Franja superior donde descansan las 3 pestañas estilo carpeta */}
              <div
                className="w-full pt-4 transition-all duration-300 sm:pt-5"
                style={{ background: tabsHeaderBg }}
              >
                <div className="px-5 sm:px-7">
                  <div
                    role="tablist"
                    aria-label="Operaciones inmobiliarias: Ventas, Alquileres y Alquileres Temporarios"
                    className="relative flex items-end gap-1.5 sm:gap-2.5"
                  >
                    {opTabs.map((tab) => {
                      const isActive = !aiResult && activeTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          role="tab"
                          id={`tab-inmo-${tab.key}`}
                          aria-selected={isActive}
                          aria-controls={`panel-inmo-${tab.key}`}
                          onClick={() => {
                            setActiveTab(tab.key);
                            setAiResult(null);
                          }}
                          style={{
                            backgroundColor: isActive ? "#FFFFFF" : "transparent",
                            color: isActive ? primary : "#FFFFFF",
                            outline: "none",
                          }}
                          className={`relative flex shrink-0 cursor-pointer items-center gap-2 px-3.5 py-3 text-xs font-black tracking-tight transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FC8006] sm:gap-2.5 sm:px-6 sm:py-3.5 sm:text-base ${
                            isActive
                              ? "-mb-px z-20 rounded-t-[20px]"
                              : "z-10 rounded-t-[18px] hover:bg-[#FFFFFF]/12"
                          }`}
                        >
                          {/* Curva cóncava invertida inferior izquierda */}
                          {isActive && (
                            <svg
                              aria-hidden="true"
                              width="20"
                              height="20"
                              viewBox="0 0 20 20"
                              className="pointer-events-none absolute -left-[20px] bottom-0 block h-[20px] w-[20px]"
                            >
                              <path d="M20 0 L20 20 L0 20 A20 20 0 0 0 20 0 Z" fill="#FFFFFF" />
                            </svg>
                          )}

                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors sm:h-8 sm:w-8"
                            style={{
                              backgroundColor: isActive
                                ? `color-mix(in srgb, ${accent} 16%, #FFFFFF)`
                                : "rgba(255,255,255,0.14)",
                              borderColor: isActive
                                ? `color-mix(in srgb, ${accent} 42%, transparent)`
                                : "rgba(255,255,255,0.28)",
                              color: isActive ? primary : "#FFFFFF",
                            }}
                          >
                            {tab.icon}
                          </span>

                          <span className="whitespace-nowrap">
                            <span className="sm:hidden">{tab.shortLabel}</span>
                            <span className="hidden sm:inline">{tab.label}</span>
                          </span>

                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider sm:px-2.5 sm:text-[11px]"
                            style={{
                              backgroundColor: isActive ? accent : "rgba(255,255,255,0.22)",
                              color: isActive ? primary : "#FFFFFF",
                            }}
                          >
                            {tab.count}
                          </span>

                          {/* Curva cóncava invertida inferior derecha */}
                          {isActive && (
                            <svg
                              aria-hidden="true"
                              width="20"
                              height="20"
                              viewBox="0 0 20 20"
                              className="pointer-events-none absolute -right-[20px] bottom-0 block h-[20px] w-[20px]"
                            >
                              <path d="M0 0 L0 20 L20 20 A20 20 0 0 1 0 0 Z" fill="#FFFFFF" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Cuerpo principal blanco a ancho completo, sin bordes negros sobresalientes */}
              <div
                role="tabpanel"
                id={`panel-inmo-${activeTab}`}
                aria-labelledby={`tab-inmo-${activeTab}`}
                style={{ backgroundColor: "#FFFFFF" }}
                className="relative z-10 w-full space-y-6 bg-[#FFFFFF] p-4 sm:p-6"
              >
                    {/* BARRA DE BÚSQUEDA RÁPIDA + FILTROS RÁPIDOS (URBANA/RURAL, PH, GARAGE, PILETA, QUINCHO...) */}
                    <div className="rounded-2xl border border-[#1F1F1F]/10 bg-[#FAF8F6] p-4 sm:p-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-12">
              <div className="md:col-span-5">
                <label className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#1F1F1F]/70">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <span>Búsqueda Rápida</span>
                </label>
                <input
                  type="search"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  placeholder="Barrio, localidad, calle, código o palabra clave..."
                  className="w-full rounded-xl border border-[#1F1F1F]/20 px-3.5 py-2.5 text-sm font-medium focus:border-[#FC8006] focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-extrabold uppercase text-[#1F1F1F]/70">
                  Ámbito
                </label>
                <select
                  value={filterAmbito}
                  onChange={(e) => setFilterAmbito(e.target.value as any)}
                  className="w-full rounded-xl border border-[#1F1F1F]/20 px-3 py-2.5 text-sm font-semibold"
                >
                  <option value="">Urbana y Rural</option>
                  <option value="urbana">Urbana</option>
                  <option value="rural">Rural</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-extrabold uppercase text-[#1F1F1F]/70">
                  Tipo
                </label>
                <select
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                  className="w-full rounded-xl border border-[#1F1F1F]/20 px-3 py-2.5 text-sm font-semibold"
                >
                  <option value="">Todos los tipos</option>
                  {[
                    "Casa",
                    "Departamento",
                    "Dúplex / Tríplex",
                    "PH",
                    "Terreno / Lote",
                    "Campo / Fracción Rural",
                    "Quinta / Chacra",
                    "Local Comercial",
                    "Oficina / Consultorio",
                    "Galpón / Depósito",
                    "Cochera",
                    "Cabaña / Temporario",
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-extrabold uppercase text-[#1F1F1F]/70">
                  Ordenar
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full rounded-xl border border-[#1F1F1F]/20 px-3 py-2.5 text-sm font-semibold"
                >
                  <option value="recent">Más recientes</option>
                  <option value="price_asc">Menor precio</option>
                  <option value="price_desc">Mayor precio</option>
                </select>
              </div>
              <div className="flex items-end md:col-span-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters((v) => !v)}
                  className="w-full rounded-xl border-2 border-[#1F1F1F] px-2 py-2.5 text-xs font-extrabold text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-[#FFFFFF]"
                >
                  {showAdvancedFilters ? "− Filtros" : "+ Filtros"}
                </button>
              </div>
            </div>

            {/* Chips de filtros rápidos */}
            <div className="flex flex-wrap gap-2">
              {([
                { label: "Garage", icon: "garage" as InmoIconName, active: filterGarage, toggle: () => setFilterGarage((v) => !v) },
                { label: "Pileta", icon: "pool" as InmoIconName, active: filterPileta, toggle: () => setFilterPileta((v) => !v) },
                { label: "Quincho", icon: "grill" as InmoIconName, active: filterQuincho, toggle: () => setFilterQuincho((v) => !v) },
                { label: "Balcón", icon: "balcony" as InmoIconName, active: filterBalcon, toggle: () => setFilterBalcon((v) => !v) },
                { label: "Apto Crédito", icon: "bank" as InmoIconName, active: filterAptoCredito, toggle: () => setFilterAptoCredito((v) => !v) },
                { label: "Mascotas", icon: "pet" as InmoIconName, active: filterMascotas, toggle: () => setFilterMascotas((v) => !v) },
                { label: "Con Precio Visible", icon: "price" as InmoIconName, active: filterSoloPrecio, toggle: () => setFilterSoloPrecio((v) => !v) },
              ]).map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.toggle}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold transition"
                  style={{
                    backgroundColor: chip.active ? primary : "#FFFFFF",
                    color: chip.active ? accent : "#1F1F1F",
                    border: chip.active ? `1.5px solid ${accent}` : "1.5px solid #cbd5e1",
                  }}
                >
                  <InmoIcon name={chip.icon} size={14} />
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>

            {showAdvancedFilters && (
              <div className="grid gap-3 border-t border-[#1F1F1F]/10 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-[#1F1F1F]/70">
                    Régimen de Propiedad
                  </label>
                  <select
                    value={filterRegimen}
                    onChange={(e) => setFilterRegimen(e.target.value)}
                    className="w-full rounded-xl border border-[#1F1F1F]/20 px-3 py-2 text-xs font-semibold"
                  >
                    <option value="">Todos</option>
                    <option value="propiedad_individual">Propiedad Individual</option>
                    <option value="propiedad_horizontal">Propiedad Horizontal (PH)</option>
                    <option value="condominio">Condominio</option>
                    <option value="barrio_privado_country">Barrio Privado / Country</option>
                    <option value="fideicomiso">Fideicomiso</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-[#1F1F1F]/70">
                    Construcción
                  </label>
                  <select
                    value={filterConstruccion}
                    onChange={(e) => setFilterConstruccion(e.target.value)}
                    className="w-full rounded-xl border border-[#1F1F1F]/20 px-3 py-2 text-xs font-semibold"
                  >
                    <option value="">Con y Sin construcción</option>
                    <option value="con_construccion">Con construcción</option>
                    <option value="sin_construccion">Sin construcción</option>
                    <option value="en_construccion">En construcción / Pozo</option>
                    <option value="a_reciclar">A reciclar</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-[#1F1F1F]/70">
                    Habitaciones mínimas
                  </label>
                  <select
                    value={filterMinHab}
                    onChange={(e) => setFilterMinHab(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#1F1F1F]/20 px-3 py-2 text-xs font-semibold"
                  >
                    <option value={0}>Cualquiera</option>
                    <option value={1}>1+ dormitorios</option>
                    <option value={2}>2+ dormitorios</option>
                    <option value={3}>3+ dormitorios</option>
                    <option value={4}>4+ dormitorios</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-[#1F1F1F]/70">
                    Baños mínimos
                  </label>
                  <select
                    value={filterMinBanos}
                    onChange={(e) => setFilterMinBanos(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#1F1F1F]/20 px-3 py-2 text-xs font-semibold"
                  >
                    <option value={0}>Cualquiera</option>
                    <option value={1}>1+ baños</option>
                    <option value={2}>2+ baños</option>
                    <option value={3}>3+ baños</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* GRILLA DE PROPIEDADES PUBLICADAS */}
          {filteredPropiedades.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-[#1F1F1F]/18 bg-[#FFFFFF] p-12 text-center">
              <div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm"
                style={{
                  backgroundColor: `color-mix(in srgb, ${accent} 12%, #FFFFFF)`,
                  borderColor: `color-mix(in srgb, ${accent} 38%, transparent)`,
                  color: primary,
                }}
              >
                <InmoIcon name="homeSearch" size={28} />
              </div>
              <h3 className="mt-3 text-lg font-extrabold text-[#1F1F1F]">
                No encontramos propiedades con esos filtros
              </h3>
              <p className="mt-1 text-sm text-[#1F1F1F]/70">
                Probá limpiar algún filtro o escribinos por WhatsApp para que te avisemos apenas ingrese una propiedad a tu medida.
              </p>
              <a
                href={buildWaHref(
                  `Hola ${props.fantasyName}, busco una propiedad en ${opLabel(activeTab)}: ${quickQuery || aiQuery || "me gustaría asesoramiento"}.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black shadow transition hover:brightness-95"
                style={{ backgroundColor: accent, color: primary }}
              >
                <WhatsAppIcon size={17} className="shrink-0" />
                <span>Consultar por WhatsApp</span>
              </a>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredPropiedades.map((prop) => {
                const c = prop.caracteristicas;
                const cover = prop.fotos?.[0] || "/photos/ref-01.png";
                const isFav = favorites.includes(prop.id);
                const isComp = compareIds.includes(prop.id);
                const rColor = ribbonBgColor(prop.cartelCruzado, prop.cartelColorBg);

                return (
                  <article
                    key={prop.id}
                    id={`prop-card-${prop.id}`}
                    className="group flex flex-col overflow-hidden rounded-3xl border border-[#1F1F1F]/12 bg-[#FFFFFF] shadow-md transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    {/* 1RA FOTOGRAFÍA CON CARTEL CRUZADO DIAGONAL */}
                    <div
                      onClick={() => openPropertyDetail(prop)}
                      className="relative aspect-square w-full cursor-pointer overflow-hidden bg-[#1F1F1F]"
                    >
                      <img
                        src={cover}
                        alt={prop.titulo}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />

                      {prop.cartelCruzado && (
                        <div
                          className="pointer-events-none absolute -left-11 top-6 z-10 w-48 -rotate-45 py-1.5 text-center text-[11px] font-black uppercase tracking-wider shadow-lg"
                          style={{
                            backgroundColor: rColor,
                            color: rColor === "#FC8006" ? "#1F1F1F" : "#FFFFFF",
                          }}
                        >
                          {prop.cartelCruzado}
                        </div>
                      )}

                      <div className="absolute right-3 top-3 flex gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(prop.id);
                          }}
                          title="Guardar en favoritos"
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFFFFF]/92 shadow transition hover:scale-110"
                          style={{ color: isFav ? "#dc2626" : primary }}
                        >
                          <InmoIcon name={isFav ? "heartFilled" : "heart"} size={16} />
                        </button>
                        {config.habilitarComparador !== false && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCompare(prop.id);
                            }}
                            title="Comparar propiedad"
                            className="flex h-9 w-9 items-center justify-center rounded-full shadow transition hover:scale-110"
                            style={{
                              backgroundColor: isComp ? accent : "rgba(255,255,255,0.92)",
                              color: primary,
                            }}
                          >
                            <InmoIcon name="compare" size={16} />
                          </button>
                        )}
                      </div>

                      <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
                        <span
                          className="rounded-lg px-2.5 py-1 text-[11px] font-black uppercase shadow"
                          style={{ backgroundColor: primary, color: accent }}
                        >
                          {prop.tipoPropiedad} · {prop.ambito === "rural" ? "Rural" : "Urbana"}
                        </span>
                        {prop.fotos.length > 1 && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#1F1F1F]/85 px-2 py-1 text-[11px] font-bold text-[#FFFFFF]">
                            <InmoIcon name="camera" size={12} />
                            <span>{prop.fotos.length}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CUERPO DE LA TARJETA */}
                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xl font-black" style={{ color: primary }}>
                            {prop.mostrarPrecio && prop.precio > 0
                              ? fmtMoney(prop.precio, prop.moneda)
                              : prop.textoConsulta || "Consultar"}
                            {prop.mostrarPrecio && prop.precio > 0 && prop.operacion === "alquiler" && (
                              <span className="text-xs font-bold text-[#1F1F1F]/60"> / mes</span>
                            )}
                            {prop.mostrarPrecio &&
                              prop.precio > 0 &&
                              prop.operacion === "alquiler_temporario" && (
                                <span className="text-xs font-bold text-[#1F1F1F]/60"> / estadía</span>
                              )}
                          </div>
                          <span className="rounded-md bg-[#1F1F1F]/8 px-2 py-0.5 text-[11px] font-extrabold text-[#1F1F1F]/70">
                            {prop.codigo}
                          </span>
                        </div>

                        {c.expensasMensualesArs && c.expensasMensualesArs > 0 && (
                          <div className="text-xs font-semibold text-[#1F1F1F]/65">
                            + Expensas aprox. {fmtMoney(c.expensasMensualesArs, "ARS")}
                          </div>
                        )}

                        <h3
                          onClick={() => openPropertyDetail(prop)}
                          className="mt-2 cursor-pointer text-base font-extrabold leading-snug text-[#1F1F1F] hover:underline"
                        >
                          {prop.titulo}
                        </h3>

                        <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#1F1F1F]/70">
                          <InmoIcon name="pin" size={13} />
                          <span>
                            {prop.mostrarDireccionExacta && prop.direccion ? `${prop.direccion}, ` : ""}
                            {prop.barrio ? `${prop.barrio}, ` : ""}
                            {prop.localidad} ({prop.provincia})
                          </span>
                        </div>

                        {/* Badges rápidos de características */}
                        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold text-[#1F1F1F]">
                          {c.superficieHectareas ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#f1f5f9] px-2 py-1">
                              <InmoIcon name="field" size={12} />
                              <span>{c.superficieHectareas} ha</span>
                            </span>
                          ) : c.superficieTotalM2 ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#f1f5f9] px-2 py-1">
                              <InmoIcon name="area" size={12} />
                              <span>{c.superficieTotalM2} m²</span>
                            </span>
                          ) : null}
                          {c.cantidadHabitaciones > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#f1f5f9] px-2 py-1">
                              <InmoIcon name="bed" size={12} />
                              <span>{c.cantidadHabitaciones} dorm.</span>
                            </span>
                          )}
                          {c.cantidadBanos > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#f1f5f9] px-2 py-1">
                              <InmoIcon name="bath" size={12} />
                              <span>{c.cantidadBanos} baño{c.cantidadBanos > 1 ? "s" : ""}</span>
                            </span>
                          )}
                          {c.tieneGarage && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#f1f5f9] px-2 py-1">
                              <InmoIcon name="garage" size={12} />
                              <span>{c.cantidadVehiculosGarage || 1} veh.</span>
                            </span>
                          )}
                          {c.tienePileta && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#dcfce7] px-2 py-1 text-[#065f46]">
                              <InmoIcon name="pool" size={12} />
                              <span>Pileta</span>
                            </span>
                          )}
                          {c.tieneQuincho && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#fef3c7] px-2 py-1 text-[#92400e]">
                              <InmoIcon name="grill" size={12} />
                              <span>Quincho</span>
                            </span>
                          )}
                          {c.esDepartamento && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#e0f2fe] px-2 py-1 text-[#075985]">
                              <InmoIcon name="building" size={12} />
                              <span>
                                {c.esInterno ? "Interno" : "Externo"}
                                {c.tieneBalcon ? " · Balcón" : ""}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex items-stretch gap-2 border-t border-[#1F1F1F]/10 pt-3.5">
                        <button
                          type="button"
                          onClick={() => openPropertyDetail(prop)}
                          className="flex-1 rounded-xl px-4 py-2.5 text-xs font-black transition hover:brightness-110"
                          style={{ backgroundColor: primary, color: "#FFFFFF" }}
                        >
                          Ver Ficha y Mapa Satelital
                        </button>
                        <a
                          href={buildWaHref(
                            `¡Hola ${props.fantasyName}! Consulto por la propiedad ${prop.codigo}: "${prop.titulo}" (${opLabel(prop.operacion)}).`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Consultar por WhatsApp"
                          aria-label={`Consultar por WhatsApp sobre ${prop.titulo}`}
                          className="inline-flex w-11 shrink-0 items-center justify-center rounded-xl shadow transition hover:scale-105 hover:brightness-95"
                          style={{ backgroundColor: accent, color: primary }}
                        >
                          <WhatsAppIcon size={20} className="shrink-0" />
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
              </div>
            </section>
          );
        })()}
      </main>

      {/* PIE INSTITUCIONAL: DIRECCIÓN + GOOGLE MAPS, HORARIOS DE ATENCIÓN, REDES Y CONTACTO */}
      <footer
        className="mt-14 border-t-4 text-[#FFFFFF] pb-24 pt-10"
        style={{ backgroundColor: primary, borderColor: accent }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-8 md:grid-cols-3">
            {/* Dirección y Google Maps (rectángulo alineado con Horarios, dirección debajo) */}
            <div className="space-y-3">
              <div
                className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider"
                style={{ color: accent }}
              >
                <InmoIcon name="pin" size={14} />
                <span>Dirección y Ubicación</span>
              </div>
              <div
                className="relative h-40 w-full overflow-hidden rounded-2xl border-2 shadow-lg bg-[#171717]"
                style={{ borderColor: accent }}
              >
                <iframe
                  title={`Mapa de ${officeAddress}`}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(
                    officeAddress
                  )}&t=m&z=16&output=embed`}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <a
                  href={officeMapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black shadow-lg transition hover:scale-105"
                  style={{ backgroundColor: primary, color: "#FFFFFF", border: `1px solid ${accent}` }}
                >
                  <span>Abrir en Maps</span>
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
              <p className="text-sm font-extrabold text-[#FFFFFF] leading-snug">
                {officeAddress}
              </p>
            </div>

            {/* Horarios de Atención */}
            <div className="space-y-3">
              <div
                className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider"
                style={{ color: accent }}
              >
                <InmoIcon name="clock" size={14} />
                <span>Horarios de Atención</span>
              </div>
              <div className="flex min-h-40 flex-col justify-center gap-1 rounded-2xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/5 p-5 text-sm font-bold text-[#FFFFFF]/95 leading-relaxed">
                {officeHours.split("·").map((segment, idx) => (
                  <div
                    key={idx}
                    className={idx === 0 ? "font-black text-[#FFFFFF]" : "text-[#FFFFFF]/90"}
                  >
                    {segment.trim()}
                  </div>
                ))}
              </div>
            </div>

            {/* Redes Sociales y Contacto Directo (solo botones con sus colores) */}
            <div className="space-y-3">
              <div
                className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider"
                style={{ color: accent }}
              >
                <InmoIcon name="phone" size={14} />
                <span>Redes y Contacto</span>
              </div>
              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <a
                  href={buildWaHref(
                    config.whatsappMensajeDefault ||
                      `¡Hola ${props.fantasyName}! Quiero consultar por propiedades disponibles.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`WhatsApp · ${waDisplay}`}
                  aria-label={`Contactar por WhatsApp (${waDisplay})`}
                  className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-[#FFFFFF] shadow-lg transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#FC8006]"
                >
                  <WhatsAppIcon size={24} className="shrink-0" />
                  <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#141414] px-2.5 py-1 text-[11px] font-bold text-[#FFFFFF] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                    WhatsApp · {waDisplay}
                  </span>
                </a>

                {officeInstagramUrl && (
                  <a
                    href={officeInstagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Instagram · ${officeInstagramLabel}`}
                    aria-label={`Instagram ${officeInstagramLabel}`}
                    style={{
                      background:
                        "linear-gradient(135deg, #f9ce34 0%, #ee2a7b 50%, #6228d7 100%)",
                    }}
                    className="group relative flex h-12 w-12 items-center justify-center rounded-full text-[#FFFFFF] shadow-lg transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#FC8006]"
                  >
                    <InstagramIcon size={23} className="shrink-0" />
                    <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#141414] px-2.5 py-1 text-[11px] font-bold text-[#FFFFFF] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                      Instagram · {officeInstagramLabel}
                    </span>
                  </a>
                )}

                {officeFacebookUrl && (
                  <a
                    href={officeFacebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Facebook · ${officeFacebookLabel}`}
                    aria-label={`Facebook ${officeFacebookLabel}`}
                    className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-[#1877F2] text-[#FFFFFF] shadow-lg transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#FC8006]"
                  >
                    <FacebookIcon size={23} className="shrink-0" />
                    <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#141414] px-2.5 py-1 text-[11px] font-bold text-[#FFFFFF] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                      Facebook · {officeFacebookLabel}
                    </span>
                  </a>
                )}

                {officeEmail && (
                  <a
                    href={`mailto:${officeEmail}`}
                    title={`Email · ${officeEmail}`}
                    aria-label={`Enviar correo a ${officeEmail}`}
                    className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-[#EA4335] text-[#FFFFFF] shadow-lg transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#FC8006]"
                  >
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      aria-hidden="true"
                    >
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-10 6L2 7" />
                    </svg>
                    <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#141414] px-2.5 py-1 text-[11px] font-bold text-[#FFFFFF] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                      {officeEmail}
                    </span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* BOTÓN RÁPIDO ACCESO A CLIENTES + BOTÓN REDONDO DE WHATSAPP AL LADO */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-row items-center gap-3">
        <button
          type="button"
          onClick={() => setClientModalOpen(true)}
          className="inline-flex h-12 items-center gap-2 rounded-full border-2 px-4 text-xs font-black shadow-xl transition hover:scale-105"
          style={{ backgroundColor: primary, borderColor: accent, color: "#FFFFFF" }}
        >
          <img
            src={props.logo1x1Url || "/inmobiliaria/degiovanni-logo-symbol.png"}
            alt=""
            aria-hidden="true"
            className="h-6 w-6 rounded-full object-contain shrink-0"
          />
          <span>Acceso a Clientes</span>
        </button>
        <a
          href={buildWaHref(
            config.whatsappMensajeDefault ||
              `¡Hola ${props.fantasyName}! Quiero consultar por propiedades disponibles.`
          )}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contactar por WhatsApp"
          title="Contactar por WhatsApp"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-[#FFFFFF] shadow-2xl transition hover:scale-105"
        >
          <WhatsAppIcon size={25} className="shrink-0" />
        </a>
      </div>

      {/* MODAL DETALLE COMPLETO DE PROPIEDAD + GOOGLE MAPS GEOSATELITAL + CONSULTA + CALCULADORA */}
      {selectedProp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#141414]/80 p-3 backdrop-blur-sm sm:p-5"
          onClick={() => setSelectedProp(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border-2 bg-[#FFFFFF] shadow-2xl"
            style={{ borderColor: accent }}
          >
            {/* Header Modal */}
            <div
              className="sticky top-0 z-20 flex items-center justify-between gap-3 px-5 py-4 text-[#FFFFFF]"
              style={{ backgroundColor: primary }}
            >
              <div>
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase"
                  style={{ backgroundColor: accent, color: primary }}
                >
                  {selectedProp.codigo} · {opLabel(selectedProp.operacion)} · {selectedProp.tipoPropiedad}
                </span>
                <h2 className="mt-1 text-base font-black sm:text-lg">{selectedProp.titulo}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProp(null)}
                className="rounded-xl bg-[#FFFFFF]/15 px-3.5 py-2 text-sm font-black text-[#FFFFFF] hover:bg-[#FFFFFF]/25"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="p-5 sm:p-7 space-y-6">
              {/* Galería fotográfica con cartel cruzado en foto 0 */}
              <div className="space-y-2.5">
                <div className="relative h-80 w-full overflow-hidden rounded-2xl bg-[#1F1F1F] sm:h-[420px]">
                  <img
                    src={selectedProp.fotos?.[selectedPhotoIdx] || selectedProp.fotos?.[0] || "/photos/ref-01.png"}
                    alt={selectedProp.titulo}
                    className="h-full w-full object-contain"
                  />
                  {selectedPhotoIdx === 0 && selectedProp.cartelCruzado && (
                    <div
                      className="pointer-events-none absolute -left-11 top-7 w-52 -rotate-45 py-1.5 text-center text-xs font-black uppercase tracking-wider shadow-lg"
                      style={{
                        backgroundColor: ribbonBgColor(
                          selectedProp.cartelCruzado,
                          selectedProp.cartelColorBg
                        ),
                        color:
                          ribbonBgColor(
                            selectedProp.cartelCruzado,
                            selectedProp.cartelColorBg
                          ) === "#FC8006"
                            ? "#1F1F1F"
                            : "#FFFFFF",
                      }}
                    >
                      {selectedProp.cartelCruzado}
                    </div>
                  )}
                </div>
                {selectedProp.fotos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {selectedProp.fotos.map((f, idx) => (
                      <button
                        key={`${f}-${idx}`}
                        type="button"
                        onClick={() => setSelectedPhotoIdx(idx)}
                        className="h-16 w-24 flex-shrink-0 overflow-hidden rounded-xl border-2"
                        style={{
                          borderColor: idx === selectedPhotoIdx ? accent : "transparent",
                        }}
                      >
                        <img src={f} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Precio + Clasificación + Descripción */}
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#F6F5F3] p-4 border border-[#1F1F1F]/10">
                    <div>
                      <div className="text-xs font-extrabold uppercase text-[#1F1F1F]/65">
                        Valor de {opLabel(selectedProp.operacion)}
                      </div>
                      <div className="text-3xl font-black" style={{ color: primary }}>
                        {selectedProp.mostrarPrecio && selectedProp.precio > 0
                          ? fmtMoney(selectedProp.precio, selectedProp.moneda)
                          : selectedProp.textoConsulta || "Consultar"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs font-extrabold">
                      <span className="rounded-lg bg-[#1F1F1F] px-2.5 py-1 text-[#FC8006]">
                        {selectedProp.ambito === "rural" ? "🌾 Rural" : "🏙️ Urbana"}
                      </span>
                      <span className="rounded-lg bg-[#FFFFFF] border border-[#1F1F1F]/20 px-2.5 py-1">
                        {regimenLabel(selectedProp.regimen)}
                      </span>
                      <span className="rounded-lg bg-[#FFFFFF] border border-[#1F1F1F]/20 px-2.5 py-1">
                        {construccionLabel(selectedProp.estadoConstruccion)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-[#1F1F1F]">Descripción</h3>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-[#1F1F1F]/85">
                      {selectedProp.descripcion || "Consultanos para recibir la ficha completa."}
                    </p>
                  </div>

                  {/* Ficha completa de ambientes y características solicitadas */}
                  <div className="rounded-2xl border border-[#1F1F1F]/12 p-4 space-y-3">
                    <h3 className="text-base font-black text-[#1F1F1F]">
                      📋 Características, Ambientes y Comodidades
                    </h3>
                    <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-xl bg-[#FAF8F6] p-2.5">
                        <strong>Garage:</strong>{" "}
                        {selectedProp.caracteristicas.tieneGarage
                          ? `Sí (${selectedProp.caracteristicas.cantidadVehiculosGarage || 1} vehículo/s · ${
                              selectedProp.caracteristicas.garageCubierto ? "Cubierto" : "Descubierto"
                            })`
                          : "No"}
                      </div>
                      <div className="rounded-xl bg-[#FAF8F6] p-2.5">
                        <strong>Habitaciones:</strong> {selectedProp.caracteristicas.cantidadHabitaciones}
                      </div>
                      <div className="rounded-xl bg-[#FAF8F6] p-2.5">
                        <strong>Baños / Toilettes:</strong> {selectedProp.caracteristicas.cantidadBanos}
                        {selectedProp.caracteristicas.cantidadToilettes > 0
                          ? ` (+ ${selectedProp.caracteristicas.cantidadToilettes} toil.)`
                          : ""}
                      </div>
                      <div className="rounded-xl bg-[#FAF8F6] p-2.5">
                        <strong>Pileta:</strong> {selectedProp.caracteristicas.tienePileta ? "✅ Sí" : "No"}
                      </div>
                      <div className="rounded-xl bg-[#FAF8F6] p-2.5">
                        <strong>Quincho:</strong> {selectedProp.caracteristicas.tieneQuincho ? "✅ Sí" : "No"}
                      </div>
                      <div className="rounded-xl bg-[#FAF8F6] p-2.5">
                        <strong>Placares:</strong> {selectedProp.caracteristicas.tienePlacares ? "✅ Con placares" : "Sin placares"}
                      </div>
                      <div className="rounded-xl bg-[#FAF8F6] p-2.5">
                        <strong>Cocina:</strong>{" "}
                        {selectedProp.caracteristicas.tieneCocinaComedor
                          ? "Cocina-Comedor"
                          : selectedProp.caracteristicas.tieneCocina
                            ? "Cocina separada"
                            : "No"}
                      </div>
                      <div className="rounded-xl bg-[#FAF8F6] p-2.5">
                        <strong>Living:</strong>{" "}
                        {selectedProp.caracteristicas.tieneLivingComedor
                          ? "Living-Comedor"
                          : selectedProp.caracteristicas.tieneLiving
                            ? "Living separado"
                            : "No"}
                      </div>
                      <div className="rounded-xl bg-[#FAF8F6] p-2.5">
                        <strong>Lavadero / Dependencias:</strong>{" "}
                        {[
                          selectedProp.caracteristicas.tieneLavadero ? "Lavadero" : "",
                          selectedProp.caracteristicas.tieneDependencias ? "Dependencias" : "",
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No"}
                      </div>
                      <div className="rounded-xl bg-[#FAF8F6] p-2.5">
                        <strong>Calefacción:</strong> {selectedProp.caracteristicas.tipoCalefaccion || "Sin especificar"}
                      </div>
                      <div className="rounded-xl bg-[#FAF8F6] p-2.5">
                        <strong>Refrigeración:</strong> {selectedProp.caracteristicas.tipoRefrigeracion || "Sin especificar"}
                      </div>
                      {selectedProp.caracteristicas.esDepartamento && (
                        <div className="rounded-xl bg-[#e0f2fe]/60 p-2.5">
                          <strong>Departamento:</strong>{" "}
                          {selectedProp.caracteristicas.esInterno ? "Interno" : "Externo (Frente/Contrafrente)"} ·{" "}
                          {selectedProp.caracteristicas.tieneBalcon ? "Con Balcón" : "Sin Balcón"}
                          {selectedProp.caracteristicas.pisoDepartamento
                            ? ` · ${selectedProp.caracteristicas.pisoDepartamento}`
                            : ""}
                        </div>
                      )}
                    </div>

                    {/* Requisitos de alquiler (Garantías y Mes de Depósito) */}
                    {(selectedProp.operacion !== "venta" ||
                      selectedProp.caracteristicas.garantiasSolicitadas ||
                      selectedProp.caracteristicas.mesDeposito) && (
                      <div className="mt-3 rounded-xl border border-[#FC8006]/50 bg-[#FC8006]/10 p-3 text-xs space-y-1">
                        <div className="font-black text-[#1F1F1F]">📄 Condiciones de Locación:</div>
                        {selectedProp.caracteristicas.garantiasSolicitadas && (
                          <div>
                            <strong>Garantías solicitadas:</strong>{" "}
                            {selectedProp.caracteristicas.garantiasSolicitadas}
                          </div>
                        )}
                        {selectedProp.caracteristicas.mesDeposito && (
                          <div>
                            <strong>Mes de depósito:</strong> {selectedProp.caracteristicas.mesDeposito}
                          </div>
                        )}
                        {selectedProp.caracteristicas.ajusteContrato && (
                          <div>
                            <strong>Actualización / Ajuste:</strong>{" "}
                            {selectedProp.caracteristicas.ajusteContrato}
                          </div>
                        )}
                        {selectedProp.caracteristicas.plazoMinimo && (
                          <div>
                            <strong>Plazo:</strong> {selectedProp.caracteristicas.plazoMinimo}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* UBICACIÓN GEOSATELITAL GOOGLE MAPS */}
                  <div className="rounded-2xl border border-[#1F1F1F]/12 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-black text-[#1F1F1F]">
                          🛰️ Ubicación Geosatelital (Google Maps)
                        </h3>
                        <p className="text-xs text-[#1F1F1F]/70">
                          {selectedProp.mostrarDireccionExacta && selectedProp.direccion
                            ? `${selectedProp.direccion}, `
                            : ""}
                          {selectedProp.barrio ? `${selectedProp.barrio}, ` : ""}
                          {selectedProp.localidad}, {selectedProp.provincia}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMapMode("satellite")}
                          className="rounded-lg px-3 py-1.5 text-xs font-extrabold"
                          style={{
                            backgroundColor: mapMode === "satellite" ? primary : "#e2e8f0",
                            color: mapMode === "satellite" ? accent : "#1F1F1F",
                          }}
                        >
                          🛰️ Satelital
                        </button>
                        <button
                          type="button"
                          onClick={() => setMapMode("roadmap")}
                          className="rounded-lg px-3 py-1.5 text-xs font-extrabold"
                          style={{
                            backgroundColor: mapMode === "roadmap" ? primary : "#e2e8f0",
                            color: mapMode === "roadmap" ? accent : "#1F1F1F",
                          }}
                        >
                          🗺️ Mapa
                        </button>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-[#1F1F1F]/15 h-64">
                      <iframe
                        title="Ubicación Google Maps"
                        className="h-full w-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(
                          selectedProp.lat != null && selectedProp.lng != null
                            ? `${selectedProp.lat},${selectedProp.lng}`
                            : `${selectedProp.direccion}, ${selectedProp.localidad}, ${selectedProp.provincia}, Argentina`
                        )}&t=${mapMode === "satellite" ? "k" : "m"}&z=16&output=embed`}
                      />
                    </div>
                    {selectedProp.googleMapsUrl && (
                      <a
                        href={selectedProp.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs font-extrabold underline"
                        style={{ color: primary }}
                      >
                        Abrir ubicación en Google Maps ↗
                      </a>
                    )}
                  </div>

                  {/* CALCULADORA ESTIMATIVA DE CRÉDITO HIPOTECARIO (MEJORA EN VENTAS) */}
                  {config.habilitarCalculadoraCredito !== false &&
                    selectedProp.operacion === "venta" &&
                    selectedProp.mostrarPrecio &&
                    selectedProp.precio > 0 && (
                      <div className="rounded-2xl border border-[#1F1F1F]/12 bg-[#FAF8F6] p-4 space-y-3">
                        <h3 className="text-sm font-black text-[#1F1F1F]">
                          🏦 Simulador Estimativo de Crédito / Financiación
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-3 text-xs">
                          <div>
                            <label className="font-bold">Anticipo ({calcAnticipoPct}%)</label>
                            <input
                              type="range"
                              min={10}
                              max={70}
                              step={5}
                              value={calcAnticipoPct}
                              onChange={(e) => setCalcAnticipoPct(Number(e.target.value))}
                              className="w-full accent-[#FC8006]"
                            />
                          </div>
                          <div>
                            <label className="font-bold">Plazo ({calcAnios} años)</label>
                            <input
                              type="range"
                              min={5}
                              max={30}
                              step={5}
                              value={calcAnios}
                              onChange={(e) => setCalcAnios(Number(e.target.value))}
                              className="w-full accent-[#FC8006]"
                            />
                          </div>
                          <div>
                            <label className="font-bold">Tasa anual estimada ({calcTna}%)</label>
                            <input
                              type="range"
                              min={4}
                              max={16}
                              step={0.5}
                              value={calcTna}
                              onChange={(e) => setCalcTna(Number(e.target.value))}
                              className="w-full accent-[#FC8006]"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#1F1F1F] p-3 text-[#FFFFFF]">
                          <span className="text-xs">Cuota mensual referencial:</span>
                          <span className="text-lg font-black" style={{ color: accent }}>
                            {fmtMoney(Math.round(calcEstimatedQuota), selectedProp.moneda)} / mes
                          </span>
                        </div>
                      </div>
                    )}
                </div>

                {/* COLUMNA DERECHA: CONSULTA + AGENDAR VISITA + WHATSAPP */}
                <div className="space-y-4">
                  <div className="rounded-2xl border-2 p-4 space-y-3" style={{ borderColor: accent }}>
                    <h3 className="text-base font-black text-[#1F1F1F]">
                      📅 Consultar o Agendar Visita
                    </h3>
                    <a
                      href={buildWaHref(
                        `¡Hola ${props.fantasyName}! Me interesa la propiedad ${selectedProp.codigo}: ${selectedProp.titulo} (${opLabel(selectedProp.operacion)}). ¿Podemos coordinar una visita?`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-black text-[#FFFFFF] shadow hover:brightness-95"
                    >
                      <WhatsAppIcon size={18} className="shrink-0" />
                      <span>Consultar por WhatsApp</span>
                    </a>

                    <form onSubmit={handleSendLead} className="space-y-2.5 pt-2 border-t border-[#1F1F1F]/10">
                      <input
                        required
                        value={leadNombre}
                        onChange={(e) => setLeadNombre(e.target.value)}
                        placeholder="Tu Nombre y Apellido *"
                        className="w-full rounded-xl border border-[#1F1F1F]/20 px-3 py-2 text-xs font-medium"
                      />
                      <input
                        required
                        value={leadWhatsapp}
                        onChange={(e) => setLeadWhatsapp(e.target.value)}
                        placeholder="Tu WhatsApp (ej: 3585095475) *"
                        className="w-full rounded-xl border border-[#1F1F1F]/20 px-3 py-2 text-xs font-medium"
                      />
                      <input
                        type="email"
                        value={leadEmail}
                        onChange={(e) => setLeadEmail(e.target.value)}
                        placeholder="Correo electrónico"
                        className="w-full rounded-xl border border-[#1F1F1F]/20 px-3 py-2 text-xs font-medium"
                      />
                      <div>
                        <label className="mb-0.5 block text-[11px] font-bold text-[#1F1F1F]/70">
                          Día deseado para visita (opcional)
                        </label>
                        <input
                          type="date"
                          value={leadFechaVisita}
                          onChange={(e) => setLeadFechaVisita(e.target.value)}
                          className="w-full rounded-xl border border-[#1F1F1F]/20 px-3 py-2 text-xs font-medium"
                        />
                      </div>
                      <textarea
                        rows={3}
                        value={leadMensaje}
                        onChange={(e) => setLeadMensaje(e.target.value)}
                        className="w-full rounded-xl border border-[#1F1F1F]/20 px-3 py-2 text-xs font-medium"
                      />
                      <button
                        type="submit"
                        disabled={leadSending}
                        className="w-full rounded-xl px-4 py-2.5 text-xs font-black shadow hover:brightness-95"
                        style={{ backgroundColor: primary, color: accent }}
                      >
                        {leadSending ? "Enviando..." : "📩 Enviar Consulta / Solicitar Visita"}
                      </button>
                      {leadSuccessMsg && (
                        <div className="rounded-xl bg-[#dcfce7] p-2.5 text-xs font-bold text-[#065f46]">
                          ✅ {leadSuccessMsg}
                        </div>
                      )}
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COMPARADOR DE PROPIEDADES */}
      {showCompareModal && compareProps.length >= 2 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#141414]/80 p-4 backdrop-blur-sm"
          onClick={() => setShowCompareModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-3xl border-2 bg-[#FFFFFF] p-6 shadow-2xl"
            style={{ borderColor: accent }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-[#1F1F1F]">
                ⚖️ Comparador Lado a Lado ({compareProps.length} propiedades)
              </h3>
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                className="rounded-xl bg-[#1F1F1F] px-3.5 py-1.5 text-xs font-black text-[#FFFFFF]"
              >
                ✕ Cerrar
              </button>
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-[#FC8006]">
                  <th className="p-2 text-left">Atributo</th>
                  {compareProps.map((p) => (
                    <th key={p.id} className="p-2 text-left font-black">
                      {p.codigo} · {p.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    lbl: "Precio",
                    val: (p: InmoPropiedadRecord) =>
                      p.mostrarPrecio ? fmtMoney(p.precio, p.moneda) : p.textoConsulta,
                  },
                  { lbl: "Operación", val: (p: InmoPropiedadRecord) => opLabel(p.operacion) },
                  { lbl: "Ámbito / Régimen", val: (p: InmoPropiedadRecord) => `${p.ambito} · ${regimenLabel(p.regimen)}` },
                  { lbl: "Ubicación", val: (p: InmoPropiedadRecord) => `${p.barrio}, ${p.localidad}` },
                  { lbl: "Dormitorios / Baños", val: (p: InmoPropiedadRecord) => `${p.caracteristicas.cantidadHabitaciones} dorm. / ${p.caracteristicas.cantidadBanos} baños` },
                  { lbl: "Garage", val: (p: InmoPropiedadRecord) => (p.caracteristicas.tieneGarage ? `Sí (${p.caracteristicas.cantidadVehiculosGarage} veh.)` : "No") },
                  { lbl: "Pileta / Quincho", val: (p: InmoPropiedadRecord) => `${p.caracteristicas.tienePileta ? "Pileta Sí" : "Pileta No"} · ${p.caracteristicas.tieneQuincho ? "Quincho Sí" : "Quincho No"}` },
                  { lbl: "Calefacción / Refrig.", val: (p: InmoPropiedadRecord) => `${p.caracteristicas.tipoCalefaccion} / ${p.caracteristicas.tipoRefrigeracion}` },
                ].map((row) => (
                  <tr key={row.lbl} className="border-b border-[#1F1F1F]/10">
                    <td className="p-2 font-extrabold text-[#1F1F1F]">{row.lbl}</td>
                    {compareProps.map((p) => (
                      <td key={p.id} className="p-2">
                        {row.val(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL PORTAL DE ACCESO A CLIENTES (GOOGLE / EMAIL / RECUPERO / CONTRATOS PDF / CTA CTE / PAGO SPLIT) */}
      <InmoClientPortalModal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        tenantSlug={props.tenantSlug}
        fantasyName={props.fantasyName}
        primaryHex={primary}
        accentHex={accent}
        logo1x1Url={props.logo1x1Url}
        googleClientId={
          config.googleClientId ||
          process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
          "384115038053-ktejh22ce4f9hkun4nba8qajnf3g0euh.apps.googleusercontent.com"
        }
        defaultProvincia={props.defaultProvincia}
        defaultLocalidad={props.defaultLocalidad}
        defaultCp={props.defaultCp}
        catalogs={props.catalogs}
        loggedClient={loggedClient}
        loggedContracts={loggedContracts}
        onSessionUpdate={(cli, ctrs) => {
          setLoggedClient(cli);
          setLoggedContracts(ctrs);
        }}
      />
    </div>
  );
}
