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
  if (low.includes("liquid")) return "#dc2626";
  if (low.includes("oportunidad")) return "#f59e0b";
  if (low.includes("oferta")) return "#0284c7";
  if (low.includes("reserv")) return "#7c3aed";
  return "#56D7A1";
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
        cardEl.classList.add("ring-4", "ring-[#56D7A1]");
        setTimeout(() => cardEl.classList.remove("ring-4", "ring-[#56D7A1]"), 2400);
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

  const primary = props.primaryHex || "#112D3A";
  const accent = props.accentHex || "#56D7A1";

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
    <div className="min-h-screen bg-[#f3f8fa] text-[#112D3A] flex flex-col">
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
                props.isMiniSistemaBrand
                  ? "h-10 w-auto object-contain"
                  : "h-11 w-auto rounded-lg bg-[#FFFFFF] px-2.5 py-1 object-contain"
              }
            />
            {!props.isMiniSistemaBrand && (
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
                className="rounded-xl border px-3 py-2 text-xs font-extrabold transition"
                style={{
                  borderColor: accent,
                  backgroundColor: onlyFavorites ? accent : "rgba(255,255,255,0.08)",
                  color: onlyFavorites ? primary : "#FFFFFF",
                }}
              >
                ❤️ Favoritos ({favorites.length})
              </button>
            )}

            {compareIds.length >= 2 && (
              <button
                type="button"
                onClick={() => setShowCompareModal(true)}
                className="rounded-xl border border-[#FFFFFF]/30 bg-[#FFFFFF]/15 px-3 py-2 text-xs font-extrabold text-[#FFFFFF] hover:bg-[#FFFFFF]/25"
              >
                ⚖️ Comparar ({compareIds.length})
              </button>
            )}

            <button
              type="button"
              id="acceso-clientes"
              onClick={() => setClientModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black shadow transition hover:brightness-95 sm:text-sm"
              style={{ backgroundColor: accent, color: primary }}
            >
              <span>🔑</span>
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
            <div className="relative w-full aspect-[1530/370] min-h-[190px] max-h-[390px] overflow-hidden bg-[#112D3A]">
              <img
                src={activeBanner.imageUrl}
                alt={activeBanner.titulo}
                className="h-full w-full object-cover transition-all duration-700"
              />
              <div
                className="absolute inset-0 flex flex-col justify-end p-5 sm:p-8"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(17,45,58,0.88) 0%, rgba(17,45,58,0.52) 55%, rgba(17,45,58,0.12) 100%)",
                }}
              >
                <div className="max-w-2xl">
                  <span
                    className="inline-block rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider"
                    style={{ backgroundColor: accent, color: primary }}
                  >
                    {config.matriculaCorredor || props.fantasyName}
                  </span>
                  <h1 className="mt-2 text-xl font-black leading-tight text-[#FFFFFF] sm:text-3xl lg:text-4xl">
                    {activeBanner.titulo}
                  </h1>
                  {activeBanner.subtitulo && (
                    <p className="mt-1.5 hidden text-sm font-medium text-[#FFFFFF]/90 sm:block">
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
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-[#112D3A]/80 px-3 py-2 text-lg font-black text-[#FFFFFF] hover:bg-[#112D3A]"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Banner siguiente"
                    onClick={() => setBannerIdx((prev) => (prev + 1) % banners.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[#112D3A]/80 px-3 py-2 text-lg font-black text-[#FFFFFF] hover:bg-[#112D3A]"
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

        {/* 2. CARRUSEL DE IMÁGENES DESTACADAS (CLIC LLEVA DIRECTO AL SECTOR PUBLICADO) */}
        {destacadas.length > 0 && (
          <section aria-label="Propiedades destacadas">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <span
                  className="text-xs font-extrabold uppercase tracking-wider"
                  style={{ color: primary }}
                >
                  ⭐ Selección Destacada
                </span>
                <h2 className="text-lg font-black text-[#112D3A] sm:text-xl">
                  Propiedades Destacadas (clic para ir a la publicación)
                </h2>
              </div>
              <span className="text-xs font-bold text-[#112D3A]/60">
                Deslizá →
              </span>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
              {destacadas.map((prop) => {
                const cover = prop.fotos?.[0] || "/photos/ref-01.png";
                return (
                  <button
                    key={prop.id}
                    type="button"
                    onClick={() => handleClickFeatured(prop)}
                    title={`Ir a ${prop.titulo} en ${opLabel(prop.operacion)}`}
                    className="group relative h-44 w-72 flex-shrink-0 snap-start overflow-hidden rounded-2xl border-2 border-[#112D3A]/15 bg-[#112D3A] shadow-md transition hover:scale-[1.02] hover:border-[#56D7A1] sm:h-48 sm:w-80"
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
                            ribbonBgColor(prop.cartelCruzado, prop.cartelColorBg) === "#56D7A1"
                              ? "#112D3A"
                              : "#FFFFFF",
                        }}
                      >
                        {prop.cartelCruzado}
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#112D3A]/95 via-[#112D3A]/60 to-transparent p-3 text-left">
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
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-base font-black"
                    style={{ backgroundColor: accent, color: primary }}
                  >
                    ✨
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
                  className="w-full flex-1 rounded-2xl border-2 border-[#FFFFFF]/20 bg-[#FFFFFF] px-4 py-3 text-sm font-semibold text-[#112D3A] shadow-inner focus:border-[#56D7A1] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={aiLoading}
                  className="rounded-2xl px-6 py-3 text-sm font-black shadow-lg transition hover:brightness-95 disabled:opacity-60"
                  style={{ backgroundColor: accent, color: primary }}
                >
                  {aiLoading ? "Analizando con IA..." : "✨ Buscar con IA"}
                </button>
              </div>

              {aiResult && (
                <div className="rounded-2xl border border-[#56D7A1]/50 bg-[#FFFFFF]/10 p-3.5 text-sm text-[#FFFFFF]">
                  <div className="font-bold" style={{ color: accent }}>
                    🤖 Recomendación IA ({aiResult.matchedIds.length} resultados):
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#FFFFFF]/95 sm:text-sm">
                    {aiResult.summary}
                  </p>
                </div>
              )}
            </form>
          </section>
        )}

        {/* 4. PESTAÑAS ESTILO MERCADO PAGO (VENTAS / ALQUILERES / ALQUILERES TEMPORARIOS) */}
        <section id="propiedades-tabs" className="space-y-5">
          <div className="rounded-3xl bg-[#FFFFFF] p-2 shadow-lg border border-[#112D3A]/10">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  {
                    key: "venta" as OperacionInmobiliaria,
                    label: "Ventas",
                    sub: "Casas, Deptos, Lotes y Campos",
                    icon: "🏡",
                    count: tabCounts.venta,
                  },
                  {
                    key: "alquiler" as OperacionInmobiliaria,
                    label: "Alquileres",
                    sub: "Vivienda y Comerciales",
                    icon: "🔑",
                    count: tabCounts.alquiler,
                  },
                  {
                    key: "alquiler_temporario" as OperacionInmobiliaria,
                    label: "Alquileres Temporarios",
                    sub: "Por día, semana o quincena",
                    icon: "🏖️",
                    count: tabCounts.alquiler_temporario,
                  },
                ] as const
              ).map((tab) => {
                const isActive = !aiResult && activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.key);
                      setAiResult(null);
                    }}
                    className="flex items-center justify-between rounded-2xl px-5 py-4 text-left transition-all"
                    style={{
                      backgroundColor: isActive ? primary : "#f3f8fa",
                      color: isActive ? "#FFFFFF" : "#112D3A",
                      border: isActive ? `2px solid ${accent}` : "2px solid transparent",
                      boxShadow: isActive ? "0 10px 25px rgba(17,45,58,0.18)" : "none",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl"
                        style={{
                          backgroundColor: isActive ? accent : "rgba(17,45,58,0.08)",
                          color: primary,
                        }}
                      >
                        {tab.icon}
                      </span>
                      <div>
                        <div className="text-base font-black">{tab.label}</div>
                        <div
                          className="text-[11px] font-semibold"
                          style={{ color: isActive ? "rgba(255,255,255,0.78)" : "rgba(17,45,58,0.65)" }}
                        >
                          {tab.sub}
                        </div>
                      </div>
                    </div>
                    <span
                      className="rounded-full px-3 py-1 text-xs font-black"
                      style={{
                        backgroundColor: isActive ? accent : "#FFFFFF",
                        color: primary,
                      }}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* BARRA DE BÚSQUEDA RÁPIDA + FILTROS RÁPIDOS (URBANA/RURAL, PH, GARAGE, PILETA, QUINCHO...) */}
          <div className="rounded-3xl border border-[#112D3A]/12 bg-[#FFFFFF] p-4 shadow-md sm:p-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-12">
              <div className="md:col-span-5">
                <label className="mb-1 block text-[11px] font-extrabold uppercase text-[#112D3A]/70">
                  🔎 Búsqueda Rápida
                </label>
                <input
                  type="search"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  placeholder="Barrio, localidad, calle, código o palabra clave..."
                  className="w-full rounded-xl border border-[#112D3A]/20 px-3.5 py-2.5 text-sm font-medium focus:border-[#56D7A1] focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-extrabold uppercase text-[#112D3A]/70">
                  Ámbito
                </label>
                <select
                  value={filterAmbito}
                  onChange={(e) => setFilterAmbito(e.target.value as any)}
                  className="w-full rounded-xl border border-[#112D3A]/20 px-3 py-2.5 text-sm font-semibold"
                >
                  <option value="">Urbana y Rural</option>
                  <option value="urbana">Urbana</option>
                  <option value="rural">Rural</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-extrabold uppercase text-[#112D3A]/70">
                  Tipo
                </label>
                <select
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                  className="w-full rounded-xl border border-[#112D3A]/20 px-3 py-2.5 text-sm font-semibold"
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
                <label className="mb-1 block text-[11px] font-extrabold uppercase text-[#112D3A]/70">
                  Ordenar
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full rounded-xl border border-[#112D3A]/20 px-3 py-2.5 text-sm font-semibold"
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
                  className="w-full rounded-xl border-2 border-[#112D3A] px-2 py-2.5 text-xs font-extrabold text-[#112D3A] hover:bg-[#112D3A] hover:text-[#FFFFFF]"
                >
                  {showAdvancedFilters ? "− Filtros" : "+ Filtros"}
                </button>
              </div>
            </div>

            {/* Chips de filtros rápidos */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "🚗 Garage", active: filterGarage, toggle: () => setFilterGarage((v) => !v) },
                { label: "🏊 Pileta", active: filterPileta, toggle: () => setFilterPileta((v) => !v) },
                { label: "🍖 Quincho", active: filterQuincho, toggle: () => setFilterQuincho((v) => !v) },
                { label: "🌇 Balcón", active: filterBalcon, toggle: () => setFilterBalcon((v) => !v) },
                { label: "🏦 Apto Crédito", active: filterAptoCredito, toggle: () => setFilterAptoCredito((v) => !v) },
                { label: "🐾 Mascotas", active: filterMascotas, toggle: () => setFilterMascotas((v) => !v) },
                { label: "💲 Con Precio Visible", active: filterSoloPrecio, toggle: () => setFilterSoloPrecio((v) => !v) },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.toggle}
                  className="rounded-full px-3.5 py-1.5 text-xs font-extrabold transition"
                  style={{
                    backgroundColor: chip.active ? primary : "#f1f5f9",
                    color: chip.active ? accent : "#112D3A",
                    border: chip.active ? `1.5px solid ${accent}` : "1.5px solid #cbd5e1",
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {showAdvancedFilters && (
              <div className="grid gap-3 border-t border-[#112D3A]/10 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-[#112D3A]/70">
                    Régimen de Propiedad
                  </label>
                  <select
                    value={filterRegimen}
                    onChange={(e) => setFilterRegimen(e.target.value)}
                    className="w-full rounded-xl border border-[#112D3A]/20 px-3 py-2 text-xs font-semibold"
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
                  <label className="mb-1 block text-[11px] font-bold uppercase text-[#112D3A]/70">
                    Construcción
                  </label>
                  <select
                    value={filterConstruccion}
                    onChange={(e) => setFilterConstruccion(e.target.value)}
                    className="w-full rounded-xl border border-[#112D3A]/20 px-3 py-2 text-xs font-semibold"
                  >
                    <option value="">Con y Sin construcción</option>
                    <option value="con_construccion">Con construcción</option>
                    <option value="sin_construccion">Sin construcción</option>
                    <option value="en_construccion">En construcción / Pozo</option>
                    <option value="a_reciclar">A reciclar</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-[#112D3A]/70">
                    Habitaciones mínimas
                  </label>
                  <select
                    value={filterMinHab}
                    onChange={(e) => setFilterMinHab(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#112D3A]/20 px-3 py-2 text-xs font-semibold"
                  >
                    <option value={0}>Cualquiera</option>
                    <option value={1}>1+ dormitorios</option>
                    <option value={2}>2+ dormitorios</option>
                    <option value={3}>3+ dormitorios</option>
                    <option value={4}>4+ dormitorios</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-[#112D3A]/70">
                    Baños mínimos
                  </label>
                  <select
                    value={filterMinBanos}
                    onChange={(e) => setFilterMinBanos(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#112D3A]/20 px-3 py-2 text-xs font-semibold"
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
            <div className="rounded-3xl border-2 border-dashed border-[#112D3A]/20 bg-[#FFFFFF] p-12 text-center">
              <div className="text-4xl">🏘️</div>
              <h3 className="mt-2 text-lg font-extrabold text-[#112D3A]">
                No encontramos propiedades con esos filtros
              </h3>
              <p className="mt-1 text-sm text-[#112D3A]/70">
                Probá limpiar algún filtro o escribinos por WhatsApp para que te avisemos apenas ingrese una propiedad a tu medida.
              </p>
              <a
                href={buildWaHref(
                  `Hola ${props.fantasyName}, busco una propiedad en ${opLabel(activeTab)}: ${quickQuery || aiQuery || "me gustaría asesoramiento"}.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black shadow"
                style={{ backgroundColor: accent, color: primary }}
              >
                📲 Consultar por WhatsApp
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
                    className="group flex flex-col overflow-hidden rounded-3xl border border-[#112D3A]/12 bg-[#FFFFFF] shadow-md transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    {/* 1RA FOTOGRAFÍA CON CARTEL CRUZADO DIAGONAL */}
                    <div
                      onClick={() => openPropertyDetail(prop)}
                      className="relative h-60 w-full cursor-pointer overflow-hidden bg-[#112D3A]"
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
                            color: rColor === "#56D7A1" ? "#112D3A" : "#FFFFFF",
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
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFFFFF]/90 text-sm shadow hover:scale-110"
                        >
                          {isFav ? "❤️" : "🤍"}
                        </button>
                        {config.habilitarComparador !== false && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCompare(prop.id);
                            }}
                            title="Comparar propiedad"
                            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-black shadow hover:scale-110"
                            style={{
                              backgroundColor: isComp ? accent : "rgba(255,255,255,0.92)",
                              color: primary,
                            }}
                          >
                            ⚖️
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
                          <span className="rounded-lg bg-[#112D3A]/85 px-2 py-1 text-[11px] font-bold text-[#FFFFFF]">
                            📷 {prop.fotos.length}
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
                              <span className="text-xs font-bold text-[#112D3A]/60"> / mes</span>
                            )}
                            {prop.mostrarPrecio &&
                              prop.precio > 0 &&
                              prop.operacion === "alquiler_temporario" && (
                                <span className="text-xs font-bold text-[#112D3A]/60"> / estadía</span>
                              )}
                          </div>
                          <span className="rounded-md bg-[#112D3A]/8 px-2 py-0.5 text-[11px] font-extrabold text-[#112D3A]/70">
                            {prop.codigo}
                          </span>
                        </div>

                        {c.expensasMensualesArs && c.expensasMensualesArs > 0 && (
                          <div className="text-xs font-semibold text-[#112D3A]/65">
                            + Expensas aprox. {fmtMoney(c.expensasMensualesArs, "ARS")}
                          </div>
                        )}

                        <h3
                          onClick={() => openPropertyDetail(prop)}
                          className="mt-2 cursor-pointer text-base font-extrabold leading-snug text-[#112D3A] hover:underline"
                        >
                          {prop.titulo}
                        </h3>

                        <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-[#112D3A]/70">
                          <span>📍</span>
                          <span>
                            {prop.mostrarDireccionExacta && prop.direccion ? `${prop.direccion}, ` : ""}
                            {prop.barrio ? `${prop.barrio}, ` : ""}
                            {prop.localidad} ({prop.provincia})
                          </span>
                        </div>

                        {/* Badges rápidos de características */}
                        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold text-[#112D3A]">
                          {c.superficieHectareas ? (
                            <span className="rounded-lg bg-[#f1f5f9] px-2 py-1">
                              🌾 {c.superficieHectareas} ha
                            </span>
                          ) : c.superficieTotalM2 ? (
                            <span className="rounded-lg bg-[#f1f5f9] px-2 py-1">
                              📐 {c.superficieTotalM2} m²
                            </span>
                          ) : null}
                          {c.cantidadHabitaciones > 0 && (
                            <span className="rounded-lg bg-[#f1f5f9] px-2 py-1">
                              🛏️ {c.cantidadHabitaciones} dorm.
                            </span>
                          )}
                          {c.cantidadBanos > 0 && (
                            <span className="rounded-lg bg-[#f1f5f9] px-2 py-1">
                              🚿 {c.cantidadBanos} baño{c.cantidadBanos > 1 ? "s" : ""}
                            </span>
                          )}
                          {c.tieneGarage && (
                            <span className="rounded-lg bg-[#f1f5f9] px-2 py-1">
                              🚗 {c.cantidadVehiculosGarage || 1} veh.
                            </span>
                          )}
                          {c.tienePileta && (
                            <span className="rounded-lg bg-[#dcfce7] px-2 py-1 text-[#065f46]">
                              🏊 Pileta
                            </span>
                          )}
                          {c.tieneQuincho && (
                            <span className="rounded-lg bg-[#fef3c7] px-2 py-1 text-[#92400e]">
                              🍖 Quincho
                            </span>
                          )}
                          {c.esDepartamento && (
                            <span className="rounded-lg bg-[#e0f2fe] px-2 py-1 text-[#075985]">
                              🏢 {c.esInterno ? "Interno" : "Externo"}
                              {c.tieneBalcon ? " · Balcón" : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2 border-t border-[#112D3A]/10 pt-3.5">
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
                          className="rounded-xl px-3.5 py-2.5 text-xs font-black shadow hover:brightness-95"
                          style={{ backgroundColor: accent, color: primary }}
                        >
                          💬 WA
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* PIE INSTITUCIONAL: DIRECCIÓN + GOOGLE MAPS, HORARIOS DE ATENCIÓN, REDES Y CONTACTO */}
      <footer
        className="mt-14 border-t-4 text-[#FFFFFF] pb-24 pt-10"
        style={{ backgroundColor: primary, borderColor: accent }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-8 md:grid-cols-3">
            {/* Dirección y Google Maps */}
            <div className="space-y-3">
              <div
                className="text-xs font-black uppercase tracking-wider"
                style={{ color: accent }}
              >
                📍 Dirección y Ubicación
              </div>
              <p className="text-base font-extrabold text-[#FFFFFF] leading-snug">
                {officeAddress}
              </p>
              <a
                href={officeMapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-black transition hover:brightness-110"
                style={{
                  borderColor: accent,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  color: "#FFFFFF",
                }}
              >
                <span>🗺️</span>
                <span>Abrir en Google Maps</span>
                <span aria-hidden="true">↗</span>
              </a>
            </div>

            {/* Horarios de Atención */}
            <div className="space-y-3">
              <div
                className="text-xs font-black uppercase tracking-wider"
                style={{ color: accent }}
              >
                🕒 Horarios de Atención
              </div>
              <div className="rounded-2xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/5 p-4 text-sm font-bold text-[#FFFFFF]/95 leading-relaxed">
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

            {/* Redes Sociales y Contacto Directo */}
            <div className="space-y-3">
              <div
                className="text-xs font-black uppercase tracking-wider"
                style={{ color: accent }}
              >
                📲 Redes y Contacto
              </div>
              <div className="flex flex-col gap-2.5 text-sm font-bold">
                <a
                  href={buildWaHref(
                    config.whatsappMensajeDefault ||
                      `¡Hola ${props.fantasyName}! Quiero consultar por propiedades disponibles.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 text-[#FFFFFF]/95 transition hover:text-[#56D7A1]"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-[#FFFFFF]"
                  >
                    <WhatsAppIcon size={17} />
                  </span>
                  <span>WhatsApp · {waDisplay}</span>
                </a>

                {officeInstagramUrl && (
                  <a
                    href={officeInstagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 text-[#FFFFFF]/95 transition hover:text-[#56D7A1]"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#56D7A1]/50 bg-[#FFFFFF]/10 text-[#56D7A1]"
                    >
                      <InstagramIcon size={17} />
                    </span>
                    <span>{officeInstagramLabel}</span>
                  </a>
                )}

                {officeFacebookUrl && (
                  <a
                    href={officeFacebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 text-[#FFFFFF]/95 transition hover:text-[#56D7A1]"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#56D7A1]/50 bg-[#FFFFFF]/10 text-[#56D7A1]"
                    >
                      <FacebookIcon size={17} />
                    </span>
                    <span>{officeFacebookLabel}</span>
                  </a>
                )}

                {officeEmail && (
                  <a
                    href={`mailto:${officeEmail}`}
                    className="inline-flex items-center gap-2.5 text-[#FFFFFF]/95 transition hover:text-[#56D7A1] break-all"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#56D7A1]/50 bg-[#FFFFFF]/10 text-[#56D7A1]"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="m22 7-10 6L2 7" />
                      </svg>
                    </span>
                    <span>{officeEmail}</span>
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
          <span>🔑</span>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#091820]/80 p-3 backdrop-blur-sm sm:p-5"
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
                <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-[#112D3A] sm:h-96">
                  <img
                    src={selectedProp.fotos?.[selectedPhotoIdx] || selectedProp.fotos?.[0] || "/photos/ref-01.png"}
                    alt={selectedProp.titulo}
                    className="h-full w-full object-cover"
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
                          ) === "#56D7A1"
                            ? "#112D3A"
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
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f3f8fa] p-4 border border-[#112D3A]/10">
                    <div>
                      <div className="text-xs font-extrabold uppercase text-[#112D3A]/65">
                        Valor de {opLabel(selectedProp.operacion)}
                      </div>
                      <div className="text-3xl font-black" style={{ color: primary }}>
                        {selectedProp.mostrarPrecio && selectedProp.precio > 0
                          ? fmtMoney(selectedProp.precio, selectedProp.moneda)
                          : selectedProp.textoConsulta || "Consultar"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs font-extrabold">
                      <span className="rounded-lg bg-[#112D3A] px-2.5 py-1 text-[#56D7A1]">
                        {selectedProp.ambito === "rural" ? "🌾 Rural" : "🏙️ Urbana"}
                      </span>
                      <span className="rounded-lg bg-[#FFFFFF] border border-[#112D3A]/20 px-2.5 py-1">
                        {regimenLabel(selectedProp.regimen)}
                      </span>
                      <span className="rounded-lg bg-[#FFFFFF] border border-[#112D3A]/20 px-2.5 py-1">
                        {construccionLabel(selectedProp.estadoConstruccion)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-[#112D3A]">Descripción</h3>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-[#112D3A]/85">
                      {selectedProp.descripcion || "Consultanos para recibir la ficha completa."}
                    </p>
                  </div>

                  {/* Ficha completa de ambientes y características solicitadas */}
                  <div className="rounded-2xl border border-[#112D3A]/12 p-4 space-y-3">
                    <h3 className="text-base font-black text-[#112D3A]">
                      📋 Características, Ambientes y Comodidades
                    </h3>
                    <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-xl bg-[#f8fbfc] p-2.5">
                        <strong>Garage:</strong>{" "}
                        {selectedProp.caracteristicas.tieneGarage
                          ? `Sí (${selectedProp.caracteristicas.cantidadVehiculosGarage || 1} vehículo/s · ${
                              selectedProp.caracteristicas.garageCubierto ? "Cubierto" : "Descubierto"
                            })`
                          : "No"}
                      </div>
                      <div className="rounded-xl bg-[#f8fbfc] p-2.5">
                        <strong>Habitaciones:</strong> {selectedProp.caracteristicas.cantidadHabitaciones}
                      </div>
                      <div className="rounded-xl bg-[#f8fbfc] p-2.5">
                        <strong>Baños / Toilettes:</strong> {selectedProp.caracteristicas.cantidadBanos}
                        {selectedProp.caracteristicas.cantidadToilettes > 0
                          ? ` (+ ${selectedProp.caracteristicas.cantidadToilettes} toil.)`
                          : ""}
                      </div>
                      <div className="rounded-xl bg-[#f8fbfc] p-2.5">
                        <strong>Pileta:</strong> {selectedProp.caracteristicas.tienePileta ? "✅ Sí" : "No"}
                      </div>
                      <div className="rounded-xl bg-[#f8fbfc] p-2.5">
                        <strong>Quincho:</strong> {selectedProp.caracteristicas.tieneQuincho ? "✅ Sí" : "No"}
                      </div>
                      <div className="rounded-xl bg-[#f8fbfc] p-2.5">
                        <strong>Placares:</strong> {selectedProp.caracteristicas.tienePlacares ? "✅ Con placares" : "Sin placares"}
                      </div>
                      <div className="rounded-xl bg-[#f8fbfc] p-2.5">
                        <strong>Cocina:</strong>{" "}
                        {selectedProp.caracteristicas.tieneCocinaComedor
                          ? "Cocina-Comedor"
                          : selectedProp.caracteristicas.tieneCocina
                            ? "Cocina separada"
                            : "No"}
                      </div>
                      <div className="rounded-xl bg-[#f8fbfc] p-2.5">
                        <strong>Living:</strong>{" "}
                        {selectedProp.caracteristicas.tieneLivingComedor
                          ? "Living-Comedor"
                          : selectedProp.caracteristicas.tieneLiving
                            ? "Living separado"
                            : "No"}
                      </div>
                      <div className="rounded-xl bg-[#f8fbfc] p-2.5">
                        <strong>Lavadero / Dependencias:</strong>{" "}
                        {[
                          selectedProp.caracteristicas.tieneLavadero ? "Lavadero" : "",
                          selectedProp.caracteristicas.tieneDependencias ? "Dependencias" : "",
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No"}
                      </div>
                      <div className="rounded-xl bg-[#f8fbfc] p-2.5">
                        <strong>Calefacción:</strong> {selectedProp.caracteristicas.tipoCalefaccion || "Sin especificar"}
                      </div>
                      <div className="rounded-xl bg-[#f8fbfc] p-2.5">
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
                      <div className="mt-3 rounded-xl border border-[#56D7A1]/50 bg-[#56D7A1]/10 p-3 text-xs space-y-1">
                        <div className="font-black text-[#112D3A]">📄 Condiciones de Locación:</div>
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
                  <div className="rounded-2xl border border-[#112D3A]/12 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-black text-[#112D3A]">
                          🛰️ Ubicación Geosatelital (Google Maps)
                        </h3>
                        <p className="text-xs text-[#112D3A]/70">
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
                            color: mapMode === "satellite" ? accent : "#112D3A",
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
                            color: mapMode === "roadmap" ? accent : "#112D3A",
                          }}
                        >
                          🗺️ Mapa
                        </button>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-[#112D3A]/15 h-64">
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
                      <div className="rounded-2xl border border-[#112D3A]/12 bg-[#f8fbfc] p-4 space-y-3">
                        <h3 className="text-sm font-black text-[#112D3A]">
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
                              className="w-full accent-[#56D7A1]"
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
                              className="w-full accent-[#56D7A1]"
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
                              className="w-full accent-[#56D7A1]"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#112D3A] p-3 text-[#FFFFFF]">
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
                    <h3 className="text-base font-black text-[#112D3A]">
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
                      💬 Consultar por WhatsApp
                    </a>

                    <form onSubmit={handleSendLead} className="space-y-2.5 pt-2 border-t border-[#112D3A]/10">
                      <input
                        required
                        value={leadNombre}
                        onChange={(e) => setLeadNombre(e.target.value)}
                        placeholder="Tu Nombre y Apellido *"
                        className="w-full rounded-xl border border-[#112D3A]/20 px-3 py-2 text-xs font-medium"
                      />
                      <input
                        required
                        value={leadWhatsapp}
                        onChange={(e) => setLeadWhatsapp(e.target.value)}
                        placeholder="Tu WhatsApp (ej: 3585095475) *"
                        className="w-full rounded-xl border border-[#112D3A]/20 px-3 py-2 text-xs font-medium"
                      />
                      <input
                        type="email"
                        value={leadEmail}
                        onChange={(e) => setLeadEmail(e.target.value)}
                        placeholder="Correo electrónico"
                        className="w-full rounded-xl border border-[#112D3A]/20 px-3 py-2 text-xs font-medium"
                      />
                      <div>
                        <label className="mb-0.5 block text-[11px] font-bold text-[#112D3A]/70">
                          Día deseado para visita (opcional)
                        </label>
                        <input
                          type="date"
                          value={leadFechaVisita}
                          onChange={(e) => setLeadFechaVisita(e.target.value)}
                          className="w-full rounded-xl border border-[#112D3A]/20 px-3 py-2 text-xs font-medium"
                        />
                      </div>
                      <textarea
                        rows={3}
                        value={leadMensaje}
                        onChange={(e) => setLeadMensaje(e.target.value)}
                        className="w-full rounded-xl border border-[#112D3A]/20 px-3 py-2 text-xs font-medium"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#091820]/80 p-4 backdrop-blur-sm"
          onClick={() => setShowCompareModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-3xl border-2 bg-[#FFFFFF] p-6 shadow-2xl"
            style={{ borderColor: accent }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-[#112D3A]">
                ⚖️ Comparador Lado a Lado ({compareProps.length} propiedades)
              </h3>
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                className="rounded-xl bg-[#112D3A] px-3.5 py-1.5 text-xs font-black text-[#FFFFFF]"
              >
                ✕ Cerrar
              </button>
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-[#56D7A1]">
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
                  <tr key={row.lbl} className="border-b border-[#112D3A]/10">
                    <td className="p-2 font-extrabold text-[#112D3A]">{row.lbl}</td>
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
        googleClientId={config.googleClientId || ""}
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
