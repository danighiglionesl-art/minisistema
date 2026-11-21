"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import {
  type CvFieldSection,
  type CvFormConfig,
  getCvFieldMap,
  mergeCvFormConfig,
} from "@/lib/erp/cv-form-config";
import {
  ALL_WORLD_LANGUAGES,
  COMMON_WORLD_LANGUAGES,
  LANGUAGE_LEVEL_OPTIONS,
  OTHER_WORLD_LANGUAGES,
} from "@/lib/erp/world-languages";

interface PaisItem {
  id: number;
  nombre: string;
  abreviatura?: string;
}

interface LocalidadItem {
  nombre: string;
  cp?: string;
}

export interface PublicCvFormProps {
  tenantSlug: string;
  fantasyName: string;
  businessName: string;
  primaryHex: string;
  accentHex: string;
  logoHorizontalUrl: string;
  defaultProvincia: string;
  defaultLocalidad: string;
  defaultCp: string;
  paises: PaisItem[];
  provincias: string[];
  localidadesPorProvincia: Record<string, LocalidadItem[]>;
  formConfig?: CvFormConfig;
}

interface ExperienceRow {
  empresa: string;
  rubroEmpresa: string;
  puesto: string;
  antiguedad: string;
  desdeAnio: string;
  hastaAnio: string;
  motivoEgreso: string;
  referenciaNombre: string;
  referenciaTelefono: string;
  tareas: string;
}

interface LanguageRow {
  idioma: string;
  nivel: string;
}

const WHATSAPP_COUNTRIES = [
  { country: "Argentina", prefix: "+549", label: "🇦🇷 Argentina (+54 9)" },
  { country: "Uruguay", prefix: "+598", label: "🇺🇾 Uruguay (+598)" },
  { country: "Paraguay", prefix: "+595", label: "🇵🇾 Paraguay (+595)" },
  { country: "Chile", prefix: "+56", label: "🇨🇱 Chile (+56)" },
  { country: "Brasil", prefix: "+55", label: "🇧🇷 Brasil (+55)" },
  { country: "Bolivia", prefix: "+591", label: "🇧🇴 Bolivia (+591)" },
  { country: "Perú", prefix: "+51", label: "🇵🇪 Perú (+51)" },
  { country: "Colombia", prefix: "+57", label: "🇨🇴 Colombia (+57)" },
  { country: "Ecuador", prefix: "+593", label: "🇪🇨 Ecuador (+593)" },
  { country: "Venezuela", prefix: "+58", label: "🇻🇪 Venezuela (+58)" },
  { country: "México", prefix: "+52", label: "🇲🇽 México (+52)" },
  { country: "España", prefix: "+34", label: "🇪🇸 España (+34)" },
  { country: "Estados Unidos / Canadá", prefix: "+1", label: "🇺🇸 EE.UU. / Canadá (+1)" },
  { country: "Italia", prefix: "+39", label: "🇮🇹 Italia (+39)" },
];

const PUESTOS_OPTIONS = [
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
];

const RUBROS_EMPRESA_OPTIONS = [
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
];

const MOTIVOS_EGRESO_OPTIONS = [
  "Actualmente trabajando en este puesto",
  "Búsqueda de crecimiento profesional",
  "Finalización de contrato / Reemplazo temporal",
  "Cambio de localidad / Mudanza",
  "Cierre o reestructuración del comercio",
  "Estudios / Incompatibilidad horaria",
  "Acuerdo mutuo / Renuncia personal",
];

const YEARS_LIST = Array.from({ length: 42 }, (_, idx) =>
  String(new Date().getFullYear() - idx)
);

function emptyExperience(): ExperienceRow {
  return {
    empresa: "",
    rubroEmpresa: "",
    puesto: "",
    antiguedad: "",
    desdeAnio: "",
    hastaAnio: "",
    motivoEgreso: "",
    referenciaNombre: "",
    referenciaTelefono: "",
    tareas: "",
  };
}

function resizePhotoToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 480;
        const canvas = document.createElement("canvas");
        canvas.width = maxSide;
        canvas.height = maxSide;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result || ""));
          return;
        }
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, maxSide, maxSide);
        const scale = Math.max(maxSide / img.width, maxSide / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (maxSide - w) / 2;
        const y = (maxSide - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      img.onerror = reject;
      img.src = String(reader.result || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readPdfAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PublicCvForm(props: PublicCvFormProps) {
  const resolvedConfig = useMemo(
    () => mergeCvFormConfig(props.formConfig),
    [props.formConfig]
  );
  const fieldMap = useMemo(
    () => getCvFieldMap(resolvedConfig),
    [resolvedConfig]
  );

  const isEnabled = (key: string) =>
    fieldMap[key] ? fieldMap[key].enabled : true;
  const isReq = (key: string) =>
    Boolean(fieldMap[key]?.enabled && fieldMap[key]?.required);
  const fldLabel = (key: string, fallback: string) => {
    const lbl = fieldMap[key]?.label || fallback;
    return isReq(key) ? `${lbl} *` : lbl;
  };
  const fldPlaceholder = (key: string, fallback: string) =>
    fieldMap[key]?.placeholder ?? fallback;
  const fldOptions = (
    key: string,
    fallback: string[],
    currentVal?: string
  ) => {
    const cfgOpts = fieldMap[key]?.options;
    const base =
      Array.isArray(cfgOpts) && cfgOpts.length > 0 ? cfgOpts : fallback;
    if (
      currentVal &&
      currentVal !== "Sin segundo puesto" &&
      !base.includes(currentVal)
    ) {
      return [...base, currentVal];
    }
    return base;
  };

  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [tipoDoc, setTipoDoc] = useState(
    () =>
      (fieldMap.tipoDoc?.options && fieldMap.tipoDoc.options[0]) || "DNI"
  );
  const [nroDoc, setNroDoc] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [genero, setGenero] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [hijosACargo, setHijosACargo] = useState("");
  const [nacionalidad, setNacionalidad] = useState("ARGENTINA");

  const [pais, setPais] = useState("ARGENTINA");
  const [provincia, setProvincia] = useState(props.defaultProvincia || "CÓRDOBA");
  const [localidad, setLocalidad] = useState(props.defaultLocalidad || "RÍO CUARTO");
  const [cp, setCp] = useState(props.defaultCp || "5800");
  const [domicilioCalle, setDomicilioCalle] = useState("");
  const [domicilioNumero, setDomicilioNumero] = useState("");
  const [domicilioPiso, setDomicilioPiso] = useState("");
  const [domicilioDpto, setDomicilioDpto] = useState("");
  const [domicilioEdificio, setDomicilioEdificio] = useState("");
  const [domicilioTorre, setDomicilioTorre] = useState("");
  const [domicilioBarrio, setDomicilioBarrio] = useState("");

  const [waCountryIdx, setWaCountryIdx] = useState(0);
  const [whatsappNumero, setWhatsappNumero] = useState("");
  const [telefonoAlternativo, setTelefonoAlternativo] = useState("");
  const [email, setEmail] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  const [puestoPrincipal, setPuestoPrincipal] = useState(
    () =>
      (fieldMap.puestoPrincipal?.options &&
        fieldMap.puestoPrincipal.options[0]) ||
      PUESTOS_OPTIONS[0]
  );
  const [puestoSecundario, setPuestoSecundario] = useState("Sin segundo puesto");
  const [disponibilidadHoraria, setDisponibilidadHoraria] = useState("");
  const [incorporacion, setIncorporacion] = useState(
    () =>
      (fieldMap.incorporacion?.options && fieldMap.incorporacion.options[0]) ||
      "Inmediata"
  );
  const [modalidad, setModalidad] = useState("");
  const [experienciaTotal, setExperienciaTotal] = useState("");
  const [licenciaConducir, setLicenciaConducir] = useState("");
  const [movilidadPropia, setMovilidadPropia] = useState(
    () =>
      (fieldMap.movilidadPropia?.options &&
        fieldMap.movilidadPropia.options[0]) ||
      "No posee / Transporte público"
  );
  const [disponibilidadViajarRotar, setDisponibilidadViajarRotar] = useState(
    () =>
      (fieldMap.disponibilidadViajarRotar?.options &&
        fieldMap.disponibilidadViajarRotar.options[0]) ||
      "Sí"
  );
  const [pretensionSalarial, setPretensionSalarial] = useState("");
  const [presentacion, setPresentacion] = useState("");

  const [nivelEstudios, setNivelEstudios] = useState("");
  const [estadoEstudios, setEstadoEstudios] = useState("");
  const [tituloCarrera, setTituloCarrera] = useState("");
  const [institucion, setInstitucion] = useState("");
  const [nivelPosFacturacion, setNivelPosFacturacion] = useState("");
  const [nivelExcel, setNivelExcel] = useState("");
  const [nivelAtencionDigital, setNivelAtencionDigital] = useState("");
  const defaultLanguageLevel =
    (fieldMap.nivelIdioma?.options && fieldMap.nivelIdioma.options[0]) ||
    LANGUAGE_LEVEL_OPTIONS[0];
  const [idiomas, setIdiomas] = useState<LanguageRow[]>([
    { idioma: "", nivel: defaultLanguageLevel },
  ]);
  const [cursosAdicionales, setCursosAdicionales] = useState("");

  const extraCustomLanguages = useMemo(() => {
    const cfgOpts = fieldMap.idiomaPrincipal?.options;
    if (!Array.isArray(cfgOpts)) return [];
    const known = new Set<string>(ALL_WORLD_LANGUAGES);
    return cfgOpts.filter(
      (opt) => opt && opt !== "Ninguno" && !known.has(opt)
    );
  }, [fieldMap]);

  const updateIdioma = (idx: number, nextIdioma: string) => {
    setIdiomas((prev) => {
      if (idx === 0 && (!nextIdioma || nextIdioma === "Ninguno")) {
        return [{ idioma: nextIdioma, nivel: defaultLanguageLevel }];
      }
      return prev.map((row, i) =>
        i === idx ? { ...row, idioma: nextIdioma } : row
      );
    });
  };

  const updateIdiomaNivel = (idx: number, nextNivel: string) => {
    setIdiomas((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, nivel: nextNivel } : row))
    );
  };

  const addIdiomaRow = () => {
    setIdiomas((prev) =>
      prev.length >= 10
        ? prev
        : [...prev, { idioma: "", nivel: defaultLanguageLevel }]
    );
  };

  const removeIdiomaRow = (idx: number) => {
    setIdiomas((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length > 0
        ? next
        : [{ idioma: "Ninguno", nivel: defaultLanguageLevel }];
    });
  };

  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const [sinExperienciaPrevia, setSinExperienciaPrevia] = useState(false);
  const [experiencias, setExperiencias] = useState<ExperienceRow[]>([emptyExperience()]);

  const [fotoBase64, setFotoBase64] = useState("");
  const [clearPhoto, setClearPhoto] = useState(false);
  const [pdfBase64, setPdfBase64] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfSizeKb, setPdfSizeKb] = useState(0);
  const [existingPdfUrl, setExistingPdfUrl] = useState("");
  const [clearPdf, setClearPdf] = useState(false);

  const [lookupLoading, setLookupLoading] = useState(false);
  const [existingCvCode, setExistingCvCode] = useState("");
  const [lastLookedUpDoc, setLastLookedUpDoc] = useState("");
  const [dniFoundToast, setDniFoundToast] = useState(false);
  const dniToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (dniToastTimerRef.current) clearTimeout(dniToastTimerRef.current);
    };
  }, []);

  const toUpperText = (val: unknown) => String(val || "").toUpperCase();

  const handleUpperChange =
    (setter: (val: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const target = e.target;
      const upper = target.value.toUpperCase();
      let start: number | null = null;
      let end: number | null = null;
      try {
        if (target.tagName === "TEXTAREA" || target.type === "text" || target.type === "tel") {
          start = target.selectionStart;
          end = target.selectionEnd;
        }
      } catch {
        // ignore selection API errors on unsupported input types
      }
      setter(upper);
      if (start !== null && end !== null) {
        const s = start;
        const en = end;
        requestAnimationFrame(() => {
          try {
            target.setSelectionRange(s, en);
          } catch {
            // ignore
          }
        });
      }
    };

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    isUpdate?: boolean;
    codigo: string;
    submittedAt: string;
    candidateName: string;
    puesto: string;
    message: string;
  } | null>(null);

  const localidadesDisponibles = useMemo(() => {
    if (pais !== "ARGENTINA") return [];
    const list = props.localidadesPorProvincia[provincia] || [];
    return list;
  }, [pais, provincia, props.localidadesPorProvincia]);

  useEffect(() => {
    if (pais !== "ARGENTINA") return;
    const list = props.localidadesPorProvincia[provincia] || [];
    if (list.length > 0) {
      const exists = list.find(
        (l) => l.nombre.toUpperCase() === localidad.toUpperCase()
      );
      if (!exists) {
        setLocalidad(list[0].nombre);
        if (list[0].cp) setCp(list[0].cp);
      }
    }
  }, [pais, provincia, props.localidadesPorProvincia, localidad]);

  const handleLocalidadChange = (nextLoc: string) => {
    setLocalidad(nextLoc);
    const match = localidadesDisponibles.find((l) => l.nombre === nextLoc);
    if (match && match.cp) {
      setCp(match.cp);
    }
  };

  const applyExistingCvData = (cv: Record<string, any>) => {
    const p = cv.personal || {};
    const u = cv.ubicacionContacto || {};
    const post = cv.postulacion || {};
    const fh = cv.formacionHabilidades || {};
    const arch = cv.archivos || {};
    const exps = Array.isArray(cv.experiencias) ? cv.experiencias : [];

    setExistingCvCode(String(cv.codigo || ""));

    if (p.nombres) setNombres(toUpperText(p.nombres));
    if (p.apellidos) setApellidos(toUpperText(p.apellidos));
    if (p.tipoDoc) setTipoDoc(String(p.tipoDoc));
    if (p.nroDoc) setNroDoc(toUpperText(p.nroDoc));
    if (p.fechaNacimiento) setFechaNacimiento(String(p.fechaNacimiento));
    if (p.genero) setGenero(String(p.genero));
    if (p.estadoCivil) setEstadoCivil(String(p.estadoCivil));
    if (p.hijosACargo) setHijosACargo(String(p.hijosACargo));
    if (p.nacionalidad) setNacionalidad(String(p.nacionalidad));

    if (u.pais) setPais(String(u.pais));
    if (u.provincia) setProvincia(toUpperText(u.provincia));
    if (u.localidad) setLocalidad(toUpperText(u.localidad));
    if (u.cp) setCp(toUpperText(u.cp));
    setDomicilioCalle(toUpperText(u.domicilioCalle || u.domicilio || ""));
    setDomicilioNumero(toUpperText(u.domicilioNumero || ""));
    setDomicilioPiso(toUpperText(u.domicilioPiso || ""));
    setDomicilioDpto(toUpperText(u.domicilioDpto || ""));
    setDomicilioEdificio(toUpperText(u.domicilioEdificio || ""));
    setDomicilioTorre(toUpperText(u.domicilioTorre || ""));
    setDomicilioBarrio(toUpperText(u.domicilioBarrio || ""));

    if (u.whatsappPrefijo || u.whatsappPais) {
      const idx = WHATSAPP_COUNTRIES.findIndex(
        (w) =>
          w.prefix === String(u.whatsappPrefijo || "").trim() ||
          w.country.toLowerCase() === String(u.whatsappPais || "").toLowerCase()
      );
      if (idx >= 0) setWaCountryIdx(idx);
    }
    setWhatsappNumero(toUpperText(u.whatsappNumero || ""));
    setTelefonoAlternativo(toUpperText(u.telefonoAlternativo || ""));
    setEmail(toUpperText(u.email || ""));
    setFacebookUrl(toUpperText(u.facebookUrl || ""));
    setInstagramUrl(toUpperText(u.instagramUrl || ""));
    setLinkedinUrl(toUpperText(u.linkedinUrl || ""));

    if (post.puestoPrincipal) setPuestoPrincipal(String(post.puestoPrincipal));
    setPuestoSecundario(
      post.puestoSecundario ? String(post.puestoSecundario) : "Sin segundo puesto"
    );
    if (post.disponibilidadHoraria) setDisponibilidadHoraria(String(post.disponibilidadHoraria));
    if (post.incorporacion) setIncorporacion(String(post.incorporacion));
    if (post.modalidad) setModalidad(String(post.modalidad));
    if (post.experienciaTotal) {
      setExperienciaTotal(String(post.experienciaTotal));
      setSinExperienciaPrevia(
        post.experienciaTotal === "Sin experiencia / Primer empleo" || exps.length === 0
      );
    }
    if (post.licenciaConducir) setLicenciaConducir(String(post.licenciaConducir));
    if (post.movilidadPropia) setMovilidadPropia(String(post.movilidadPropia));
    if (post.disponibilidadViajarRotar) {
      setDisponibilidadViajarRotar(String(post.disponibilidadViajarRotar));
    }
    if (post.pretensionSalarial) setPretensionSalarial(String(post.pretensionSalarial));
    setPresentacion(toUpperText(post.presentacion || ""));

    if (fh.nivelEstudios) setNivelEstudios(String(fh.nivelEstudios));
    if (fh.estadoEstudios) setEstadoEstudios(String(fh.estadoEstudios));
    setTituloCarrera(toUpperText(fh.tituloCarrera || ""));
    setInstitucion(toUpperText(fh.institucion || ""));
    if (fh.nivelPosFacturacion) setNivelPosFacturacion(String(fh.nivelPosFacturacion));
    if (fh.nivelExcel) setNivelExcel(String(fh.nivelExcel));
    if (fh.nivelAtencionDigital) setNivelAtencionDigital(String(fh.nivelAtencionDigital));
    if (Array.isArray(fh.idiomas) && fh.idiomas.length > 0) {
      setIdiomas(
        fh.idiomas.map((it: Record<string, unknown>) => ({
          idioma: String(it?.idioma || ""),
          nivel: String(it?.nivel || defaultLanguageLevel),
        }))
      );
    } else if (fh.idiomaPrincipal) {
      setIdiomas([
        {
          idioma: String(fh.idiomaPrincipal),
          nivel: String(fh.nivelIdioma || defaultLanguageLevel),
        },
      ]);
    }
    setCursosAdicionales(toUpperText(fh.cursosAdicionales || ""));

    if (exps.length > 0) {
      setSinExperienciaPrevia(false);
      setExperiencias(
        exps.map((e: Record<string, any>) => ({
          empresa: toUpperText(e.empresa || ""),
          rubroEmpresa: String(e.rubroEmpresa || "Comercio Minorista / Tienda"),
          puesto: toUpperText(e.puesto || ""),
          antiguedad: String(e.antiguedad || "1 a 2 años"),
          desdeAnio: String(e.desdeAnio || String(new Date().getFullYear() - 2)),
          hastaAnio: String(e.hastaAnio || "Actualidad"),
          motivoEgreso: String(e.motivoEgreso || "Búsqueda de crecimiento profesional"),
          referenciaNombre: toUpperText(e.referenciaNombre || ""),
          referenciaTelefono: toUpperText(e.referenciaTelefono || ""),
          tareas: toUpperText(e.tareas || ""),
        }))
      );
    } else {
      setSinExperienciaPrevia(true);
      setExperiencias([emptyExperience()]);
    }

    if (arch.fotoUrl) {
      setFotoBase64(String(arch.fotoUrl));
      setClearPhoto(false);
    }
    if (arch.pdfUrl) {
      setExistingPdfUrl(String(arch.pdfUrl));
      setPdfFileName(String(arch.pdfNombreOriginal || "CV_registrado.pdf"));
      setPdfBase64("");
      setClearPdf(false);
    }
    if (Array.isArray(cv.customFields)) {
      const nextCustom: Record<string, string> = {};
      for (const cf of cv.customFields as Array<{ key?: string; value?: string }>) {
        if (cf && cf.key) nextCustom[String(cf.key)] = String(cf.value || "");
      }
      setCustomValues(nextCustom);
    }
  };

  const lookupCvByDni = async (rawDocValue: string) => {
    const cleanDigits = String(rawDocValue || "").replace(/\D/g, "");
    const lookupKey = cleanDigits.length >= 6 ? cleanDigits : String(rawDocValue || "").trim().toUpperCase();
    if (!lookupKey || lookupKey.length < 6) {
      setExistingCvCode("");
      setLastLookedUpDoc("");
      return;
    }
    if (lookupKey === lastLookedUpDoc) return;
    setLastLookedUpDoc(lookupKey);
    setLookupLoading(true);
    try {
      const [res] = await Promise.all([
        fetch(
          `/api/cv?tenant=${encodeURIComponent(props.tenantSlug)}&nroDoc=${encodeURIComponent(lookupKey)}`,
          { cache: "no-store" }
        ),
        new Promise((resolve) => setTimeout(resolve, 1600)),
      ]);
      const data = await res.json();
      if (res.ok && data && data.ok && data.found && data.cv) {
        applyExistingCvData(data.cv);
        setDniFoundToast(true);
        if (dniToastTimerRef.current) clearTimeout(dniToastTimerRef.current);
        dniToastTimerRef.current = setTimeout(() => {
          setDniFoundToast(false);
        }, 6500);
      } else {
        setExistingCvCode("");
      }
    } catch {
      // ignore network error on automatic lookup
    } finally {
      setLookupLoading(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg("La fotografía debe ser una imagen JPG, PNG o WEBP.");
      return;
    }
    try {
      const resized = await resizePhotoToDataUrl(file);
      setFotoBase64(resized);
      setClearPhoto(false);
      setErrorMsg("");
    } catch {
      setErrorMsg("No se pudo procesar la fotografía seleccionada.");
    }
  };

  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("El archivo adjunto de CV debe estar en formato PDF (.pdf).");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg("El archivo PDF supera el límite de 3 MB.");
      return;
    }
    try {
      const dataUrl = await readPdfAsDataUrl(file);
      setPdfBase64(dataUrl);
      setPdfFileName(file.name);
      setPdfSizeKb(Math.max(1, Math.round(file.size / 1024)));
      setExistingPdfUrl("");
      setClearPdf(false);
      setErrorMsg("");
    } catch {
      setErrorMsg("No se pudo leer el archivo PDF seleccionado.");
    }
  };

  const EXP_UPPER_KEYS: Array<keyof ExperienceRow> = [
    "empresa",
    "puesto",
    "referenciaNombre",
    "referenciaTelefono",
    "tareas",
  ];

  const updateExpField = (idx: number, key: keyof ExperienceRow, val: string) => {
    const nextVal = EXP_UPPER_KEYS.includes(key) ? val.toUpperCase() : val;
    setExperiencias((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [key]: nextVal } : row))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    const waCountry = WHATSAPP_COUNTRIES[waCountryIdx] || WHATSAPP_COUNTRIES[0];
    const domicilioParts = [
      `${domicilioCalle.trim()} ${domicilioNumero.trim()}`.trim(),
      domicilioPiso.trim() ? `Piso ${domicilioPiso.trim()}` : "",
      domicilioDpto.trim() ? `Dpto. ${domicilioDpto.trim()}` : "",
      domicilioEdificio.trim() ? `Edificio ${domicilioEdificio.trim()}` : "",
      domicilioTorre.trim() ? `Torre ${domicilioTorre.trim()}` : "",
      domicilioBarrio.trim() ? `B° ${domicilioBarrio.trim()}` : "",
    ].filter(Boolean);
    const domicilioCompuesto = domicilioParts.join(", ");

    const validIdiomas = idiomas
      .map((r) => ({
        idioma: String(r.idioma || "").trim(),
        nivel: String(r.nivel || defaultLanguageLevel).trim() || defaultLanguageLevel,
      }))
      .filter((r) => r.idioma && r.idioma !== "Ninguno");
    const primaryIdiomaVal =
      validIdiomas.length > 0
        ? validIdiomas[0].idioma
        : String(idiomas[0]?.idioma || "").trim();
    const primaryIdiomaNivel =
      validIdiomas.length > 0 ? validIdiomas[0].nivel : "";

    try {
      const res = await fetch(
        `/api/cv?tenant=${encodeURIComponent(props.tenantSlug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombres,
            apellidos,
            tipoDoc,
            nroDoc,
            fechaNacimiento,
            genero,
            estadoCivil,
            hijosACargo,
            nacionalidad,
            pais,
            provincia,
            localidad,
            cp,
            domicilio: domicilioCompuesto,
            domicilioCalle,
            domicilioNumero,
            domicilioPiso,
            domicilioDpto,
            domicilioEdificio,
            domicilioTorre,
            domicilioBarrio,
            whatsappPais: waCountry.country,
            whatsappPrefijo: waCountry.prefix,
            whatsappNumero,
            telefonoAlternativo,
            email,
            facebookUrl,
            instagramUrl,
            linkedinUrl,
            puestoPrincipal,
            puestoSecundario:
              puestoSecundario === "Sin segundo puesto" ? "" : puestoSecundario,
            disponibilidadHoraria,
            incorporacion,
            modalidad,
            experienciaTotal,
            licenciaConducir,
            movilidadPropia,
            disponibilidadViajarRotar,
            pretensionSalarial,
            presentacion,
            nivelEstudios,
            estadoEstudios,
            tituloCarrera,
            institucion,
            nivelPosFacturacion,
            nivelExcel,
            nivelAtencionDigital,
            idiomaPrincipal: primaryIdiomaVal,
            nivelIdioma: primaryIdiomaNivel,
            idiomas: validIdiomas,
            cursosAdicionales,
            sinExperienciaPrevia,
            experiencias: sinExperienciaPrevia ? [] : experiencias,
            customFields: customValues,
            fotoBase64,
            clearPhoto,
            pdfBase64,
            pdfFileName,
            clearPdf,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.message || "No se pudo enviar tu CV. Revisá los campos.");
        setSubmitting(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      setSubmittedReceipt({
        isUpdate: Boolean(data.isUpdate),
        codigo: data.codigo,
        submittedAt: data.submittedAt,
        candidateName: data.candidateName,
        puesto: data.puesto,
        message: data.message,
      });
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErrorMsg("Error de conexión al enviar tu CV. Intentá nuevamente.");
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-[#112D3A]/20 bg-[#FFFFFF] px-3.5 py-2.5 text-sm uppercase text-[#112D3A] shadow-sm focus:border-[#56D7A1] focus:outline-none focus:ring-2 focus:ring-[#56D7A1]/40";
  const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#112D3A]/80";

  const renderCustomFieldsForSection = (section: CvFieldSection) => {
    const customList = resolvedConfig.fields.filter(
      (f) => f.isCustom && f.enabled && f.section === section
    );
    if (customList.length === 0) return null;
    return customList.map((cf) => {
      const val = customValues[cf.key] || "";
      const setVal = (next: string) =>
        setCustomValues((prev) => ({ ...prev, [cf.key]: next }));
      const lbl = cf.required ? `${cf.label} *` : cf.label;
      if (cf.type === "select") {
        const opts = fldOptions(cf.key, [], val);
        return (
          <div key={cf.key}>
            <label className={labelCls}>{lbl}</label>
            <select
              className={inputCls}
              required={cf.required}
              value={val}
              onChange={(e) => setVal(e.target.value)}
            >
              <option value="" disabled={cf.required}>
                Seleccionar...
              </option>
              {opts.map((opt) => (
                <option key={`${cf.key}-${opt}`} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        );
      }
      if (cf.type === "textarea") {
        return (
          <div key={cf.key} className="sm:col-span-2">
            <label className={labelCls}>{lbl}</label>
            <textarea
              rows={2}
              className={inputCls}
              required={cf.required}
              value={val}
              onChange={(e) => setVal(e.target.value.toUpperCase())}
              placeholder={cf.placeholder || ""}
            />
          </div>
        );
      }
      return (
        <div key={cf.key}>
          <label className={labelCls}>{lbl}</label>
          <input
            type={cf.type}
            className={inputCls}
            required={cf.required}
            value={val}
            onChange={(e) =>
              setVal(
                cf.type === "date" || cf.type === "number"
                  ? e.target.value
                  : e.target.value.toUpperCase()
              )
            }
            placeholder={cf.placeholder || ""}
          />
        </div>
      );
    });
  };

  if (submittedReceipt) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto max-w-2xl rounded-3xl border-2 border-[#56D7A1] bg-[#FFFFFF] p-8 text-[#112D3A] shadow-2xl"
      >
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#56D7A1]/25 text-3xl">
          ✅
        </div>
        <div className="mb-1 text-xs font-extrabold uppercase tracking-wider text-[#0f6845]">
          {submittedReceipt.isUpdate
            ? "Actualización de CV Registrada · Alerta Enviada al Administrador"
            : "Notificación de Recepción Exitosa"}
        </div>
        <h2 className="text-2xl font-extrabold text-[#112D3A]">
          {submittedReceipt.isUpdate
            ? "¡Tus datos de Curriculum Vitae fueron actualizados!"
            : "¡Tu Curriculum Vitae fue enviado correctamente!"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#112D3A]/80">
          Gracias <strong>{submittedReceipt.candidateName}</strong>.{" "}
          {submittedReceipt.isUpdate
            ? `Tus nuevos datos actualizaron tu ficha existente sin duplicar tu postulación y se envió un alerta de nuevos datos al administrador de `
            : `Tus datos, perfil laboral y archivos adjuntos ya ingresaron al módulo de selección de `}
          {/^minisistema\.?$/i.test((props.fantasyName || "").trim()) ? (
            <BrandWordmark onMintSurface className="h-[0.95em]" />
          ) : (
            <strong>{props.fantasyName}</strong>
          )}
          .
        </p>

        <div className="my-6 rounded-2xl border border-[#56D7A1] bg-[#112D3A] p-5 text-[#FFFFFF]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#56D7A1]">
            Comprobante de Postulación
          </div>
          <div className="mt-1 text-2xl font-black tracking-wide text-[#FFFFFF]">
            {submittedReceipt.codigo}
          </div>
          <div className="mt-2 grid gap-1 text-xs text-[#FFFFFF]/85 sm:grid-cols-2">
            <div>
              <strong>Puesto postulado:</strong> {submittedReceipt.puesto}
            </div>
            <div>
              <strong>Fecha y hora:</strong>{" "}
              {new Date(submittedReceipt.submittedAt).toLocaleString("es-AR")}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-[#56D7A1] px-5 py-3 text-sm font-extrabold text-[#112D3A] shadow hover:brightness-95"
          >
            🖨️ Imprimir / Guardar Comprobante
          </button>
          <a
            href="/"
            className="rounded-xl border-2 border-[#112D3A] px-5 py-3 text-sm font-extrabold text-[#112D3A] hover:bg-[#112D3A] hover:text-[#FFFFFF]"
          >
            Volver al Inicio
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {dniFoundToast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-4"
        >
          <div className="pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-2xl border-2 border-[#56D7A1] bg-[#112D3A] px-5 py-4 text-[#FFFFFF] shadow-2xl">
            <span
              className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#56D7A1] text-sm font-black text-[#112D3A]"
              aria-hidden="true"
            >
              ✓
            </span>
            <p className="flex-1 text-sm font-semibold leading-snug text-[#FFFFFF]">
              Tu CV ya está cargado, te mostramos los datos que informaste. Si necesitas actualizar algún dato puedes hacerlo.
            </p>
            <button
              type="button"
              onClick={() => setDniFoundToast(false)}
              aria-label="Cerrar aviso"
              className="flex-shrink-0 rounded-lg px-2 py-0.5 text-xs font-extrabold text-[#FFFFFF]/70 transition hover:bg-[#FFFFFF]/10 hover:text-[#FFFFFF]"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-[#dc2626] bg-[#fef2f2] p-4 text-sm font-bold text-[#991b1b]"
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {/* SECCIÓN 1: FOTOGRAFÍA Y DATOS PERSONALES */}
      <section className="rounded-3xl border border-[#112D3A]/15 bg-[#FFFFFF] p-6 shadow-md sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#112D3A]/10 pb-4">
          <div>
            <span className="inline-block rounded-full bg-[#56D7A1]/25 px-3 py-1 text-xs font-extrabold text-[#112D3A]">
              PASO 1 DE 5
            </span>
            <h2 className="mt-1 text-xl font-extrabold text-[#112D3A]">
              Datos Personales y Fotografía
            </h2>
          </div>

          {isEnabled("foto") && (
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-2 border-[#56D7A1] bg-[#112D3A]/5">
              {fotoBase64 ? (
                <img
                  src={fotoBase64}
                  alt="Vista previa foto postulante"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-center text-[11px] font-bold text-[#112D3A]/60">
                  Sin foto
                </span>
              )}
            </div>
            <div>
              <label className="inline-block cursor-pointer rounded-xl bg-[#112D3A] px-4 py-2 text-xs font-extrabold text-[#56D7A1] shadow hover:brightness-110">
                📷 Subir Fotografía
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
              {fotoBase64 && (
                <button
                  type="button"
                  onClick={() => {
                    setFotoBase64("");
                    setClearPhoto(true);
                  }}
                  className="ml-2 text-xs font-bold text-[#dc2626] underline"
                >
                  Quitar
                </button>
              )}
              <p className="mt-1 text-[11px] text-[#112D3A]/60">
                JPG o PNG (rostro claro / frente)
              </p>
            </div>
          </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid grid-cols-5 gap-2">
            {isEnabled("tipoDoc") && (
            <div className="col-span-2">
              <label className={labelCls}>{fldLabel("tipoDoc", "Tipo Doc.")}</label>
              <select
                className={inputCls}
                required={isReq("tipoDoc")}
                value={tipoDoc}
                onChange={(e) => setTipoDoc(e.target.value)}
              >
                {fldOptions("tipoDoc", ["DNI", "CUIL", "CUIT", "Pasaporte", "Doc. Extranjero"], tipoDoc).map((opt) => (
                  <option key={`td-${opt}`} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            )}
            <div className={isEnabled("tipoDoc") ? "col-span-3" : "col-span-5"}>
              <label className={labelCls}>{fldLabel("nroDoc", "Número (DNI)")}</label>
              <div className="relative">
                <input
                  className={lookupLoading ? `${inputCls} pr-9` : inputCls}
                  required
                  value={nroDoc}
                  onChange={handleUpperChange(setNroDoc)}
                  onBlur={() => void lookupCvByDni(nroDoc)}
                  placeholder={fldPlaceholder("nroDoc", "Ej: 38123456")}
                />
                {lookupLoading && (
                  <span
                    aria-label="Buscando..."
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-[#56D7A1] border-t-transparent"
                  />
                )}
              </div>
            </div>
          </div>
          <div>
            <label className={labelCls}>{fldLabel("nombres", "Nombre(s)")}</label>
            <input
              className={inputCls}
              required
              value={nombres}
              onChange={handleUpperChange(setNombres)}
              placeholder={fldPlaceholder("nombres", "Ej: María Florencia")}
            />
          </div>
          <div>
            <label className={labelCls}>{fldLabel("apellidos", "Apellido(s)")}</label>
            <input
              className={inputCls}
              required
              value={apellidos}
              onChange={handleUpperChange(setApellidos)}
              placeholder={fldPlaceholder("apellidos", "Ej: González")}
            />
          </div>

          {isEnabled("fechaNacimiento") && (
          <div>
            <label className={labelCls}>{fldLabel("fechaNacimiento", "Fecha de Nacimiento")}</label>
            <input
              type="date"
              required={isReq("fechaNacimiento")}
              className={inputCls}
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
            />
          </div>
          )}
          {isEnabled("genero") && (
          <div>
            <label className={labelCls}>{fldLabel("genero", "Género")}</label>
            <select
              className={inputCls}
              required={isReq("genero")}
              value={genero}
              onChange={(e) => setGenero(e.target.value)}
            >
              <option value="" disabled={isReq("genero")}>
                Seleccionar...
              </option>
              {fldOptions("genero", ["Femenino", "Masculino", "No binario", "Prefiero no especificar"], genero).map((opt) => (
                <option key={`gen-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          )}
          {isEnabled("estadoCivil") && (
          <div>
            <label className={labelCls}>{fldLabel("estadoCivil", "Estado Civil")}</label>
            <select
              className={inputCls}
              required={isReq("estadoCivil")}
              value={estadoCivil}
              onChange={(e) => setEstadoCivil(e.target.value)}
            >
              <option value="" disabled={isReq("estadoCivil")}>
                Seleccionar...
              </option>
              {fldOptions("estadoCivil", ["Soltero/a", "Casado/a", "Unión convivencial", "Divorciado/a", "Viudo/a"], estadoCivil).map((opt) => (
                <option key={`ec-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          )}

          {isEnabled("hijosACargo") && (
          <div>
            <label className={labelCls}>{fldLabel("hijosACargo", "Cargas de Familia / Hijos")}</label>
            <select
              className={inputCls}
              required={isReq("hijosACargo")}
              value={hijosACargo}
              onChange={(e) => setHijosACargo(e.target.value)}
            >
              <option value="" disabled={isReq("hijosACargo")}>
                Seleccionar...
              </option>
              {fldOptions("hijosACargo", ["Sin cargas de familia", "1 persona a cargo", "2 personas a cargo", "3 o más personas a cargo"], hijosACargo).map((opt) => (
                <option key={`hc-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          )}
          {isEnabled("nacionalidad") && (
          <div className="sm:col-span-2">
            <label className={labelCls}>{fldLabel("nacionalidad", "Nacionalidad")}</label>
            <select
              className={inputCls}
              required={isReq("nacionalidad")}
              value={nacionalidad}
              onChange={(e) => setNacionalidad(e.target.value)}
            >
              <option value="" disabled={isReq("nacionalidad")}>
                Seleccionar...
              </option>
              {props.paises.map((p) => (
                <option key={`nac-${p.id}-${p.nombre}`} value={p.nombre}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          )}
          {renderCustomFieldsForSection("personal")}
        </div>
      </section>

      {/* SECCIÓN 2: UBICACIÓN Y CONTACTO CON DESPLEGABLES EN CASCADA */}
      <section className="rounded-3xl border border-[#112D3A]/15 bg-[#FFFFFF] p-6 shadow-md sm:p-8">
        <div className="mb-5 border-b border-[#112D3A]/10 pb-4">
          <span className="inline-block rounded-full bg-[#56D7A1]/25 px-3 py-1 text-xs font-extrabold text-[#112D3A]">
            PASO 2 DE 5
          </span>
          <h2 className="mt-1 text-xl font-extrabold text-[#112D3A]">
            Ubicación, WhatsApp y Contacto
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isEnabled("pais") && (
          <div>
            <label className={labelCls}>{fldLabel("pais", "País de Residencia")}</label>
            <select
              className={inputCls}
              required={isReq("pais")}
              value={pais}
              onChange={(e) => setPais(e.target.value)}
            >
              {props.paises.map((p) => (
                <option key={`res-${p.id}-${p.nombre}`} value={p.nombre}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          )}

          {isEnabled("provincia") && (
          <div>
            <label className={labelCls}>{fldLabel("provincia", "Provincia / Estado")}</label>
            {pais === "ARGENTINA" ? (
              <select
                className={inputCls}
                required={isReq("provincia")}
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
              >
                {props.provincias.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={inputCls}
                required={isReq("provincia")}
                value={provincia}
                onChange={handleUpperChange(setProvincia)}
                placeholder="Estado / Región"
              />
            )}
          </div>
          )}

          {isEnabled("localidad") && (
          <div>
            <label className={labelCls}>{fldLabel("localidad", "Localidad / Ciudad")}</label>
            {pais === "ARGENTINA" && localidadesDisponibles.length > 0 ? (
              <select
                className={inputCls}
                required={isReq("localidad")}
                value={localidad}
                onChange={(e) => handleLocalidadChange(e.target.value)}
              >
                {localidadesDisponibles.map((loc, idx) => (
                  <option key={`${loc.nombre}-${idx}`} value={loc.nombre}>
                    {loc.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={inputCls}
                required={isReq("localidad")}
                value={localidad}
                onChange={handleUpperChange(setLocalidad)}
                placeholder="Ciudad / Localidad"
              />
            )}
          </div>
          )}

          {isEnabled("cp") && (
          <div>
            <label className={labelCls}>{fldLabel("cp", "Código Postal")}</label>
            <input
              className={inputCls}
              required={isReq("cp")}
              value={cp}
              onChange={handleUpperChange(setCp)}
              placeholder={fldPlaceholder("cp", "Ej: 5800")}
            />
          </div>
          )}

          {/* Domicilio dividido */}
          {isEnabled("domicilioCalle") && (
          <div className="sm:col-span-2">
            <label className={labelCls}>{fldLabel("domicilioCalle", "Calle")}</label>
            <input
              className={inputCls}
              required={isReq("domicilioCalle")}
              value={domicilioCalle}
              onChange={handleUpperChange(setDomicilioCalle)}
              placeholder={fldPlaceholder("domicilioCalle", "Ej: Av. San Martín")}
            />
          </div>
          )}

          {isEnabled("domicilioNumero") && (
          <div>
            <label className={labelCls}>{fldLabel("domicilioNumero", "Número")}</label>
            <input
              className={inputCls}
              required={isReq("domicilioNumero")}
              value={domicilioNumero}
              onChange={handleUpperChange(setDomicilioNumero)}
              placeholder={fldPlaceholder("domicilioNumero", "Ej: 450 (o S/N)")}
            />
          </div>
          )}

          {isEnabled("domicilioBarrio") && (
          <div>
            <label className={labelCls}>{fldLabel("domicilioBarrio", "Barrio")}</label>
            <input
              className={inputCls}
              required={isReq("domicilioBarrio")}
              value={domicilioBarrio}
              onChange={handleUpperChange(setDomicilioBarrio)}
              placeholder={fldPlaceholder("domicilioBarrio", "Ej: Centro")}
            />
          </div>
          )}

          {isEnabled("domicilioPiso") && (
          <div>
            <label className={labelCls}>{fldLabel("domicilioPiso", "Piso")}</label>
            <input
              className={inputCls}
              required={isReq("domicilioPiso")}
              value={domicilioPiso}
              onChange={handleUpperChange(setDomicilioPiso)}
              placeholder={fldPlaceholder("domicilioPiso", "Opcional")}
            />
          </div>
          )}

          {isEnabled("domicilioDpto") && (
          <div>
            <label className={labelCls}>{fldLabel("domicilioDpto", "Dpto.")}</label>
            <input
              className={inputCls}
              required={isReq("domicilioDpto")}
              value={domicilioDpto}
              onChange={handleUpperChange(setDomicilioDpto)}
              placeholder={fldPlaceholder("domicilioDpto", "Opcional")}
            />
          </div>
          )}

          {isEnabled("domicilioEdificio") && (
          <div>
            <label className={labelCls}>{fldLabel("domicilioEdificio", "Edificio")}</label>
            <input
              className={inputCls}
              required={isReq("domicilioEdificio")}
              value={domicilioEdificio}
              onChange={handleUpperChange(setDomicilioEdificio)}
              placeholder={fldPlaceholder("domicilioEdificio", "Opcional")}
            />
          </div>
          )}

          {isEnabled("domicilioTorre") && (
          <div>
            <label className={labelCls}>{fldLabel("domicilioTorre", "Torre")}</label>
            <input
              className={inputCls}
              required={isReq("domicilioTorre")}
              value={domicilioTorre}
              onChange={handleUpperChange(setDomicilioTorre)}
              placeholder={fldPlaceholder("domicilioTorre", "Opcional")}
            />
          </div>
          )}

          {isEnabled("whatsapp") && (
          <>
          <div>
            <label className={labelCls}>País de WhatsApp{isReq("whatsapp") ? " *" : ""}</label>
            <select
              className={inputCls}
              required={isReq("whatsapp")}
              value={waCountryIdx}
              onChange={(e) => setWaCountryIdx(Number(e.target.value))}
            >
              {WHATSAPP_COUNTRIES.map((w, idx) => (
                <option key={w.prefix} value={idx}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>{fldLabel("whatsapp", "Número de WhatsApp")}</label>
            <input
              className={inputCls}
              required={isReq("whatsapp")}
              type="tel"
              value={whatsappNumero}
              onChange={handleUpperChange(setWhatsappNumero)}
              placeholder={fldPlaceholder("whatsapp", "Ej: 3585095475 (sin 0 ni 15)")}
            />
          </div>
          </>
          )}

          {isEnabled("email") && (
          <div className="sm:col-span-2">
            <label className={labelCls}>{fldLabel("email", "Correo Electrónico")}</label>
            <input
              type="email"
              required={isReq("email")}
              className={inputCls}
              value={email}
              onChange={handleUpperChange(setEmail)}
              placeholder={fldPlaceholder("email", "nombre@correo.com")}
            />
          </div>
          )}

          {isEnabled("facebookUrl") && (
          <div>
            <label className={labelCls}>{fldLabel("facebookUrl", "Facebook")}</label>
            <input
              className={inputCls}
              required={isReq("facebookUrl")}
              value={facebookUrl}
              onChange={handleUpperChange(setFacebookUrl)}
              placeholder={fldPlaceholder("facebookUrl", "Usuario o enlace (o 'No tengo')")}
            />
          </div>
          )}

          {isEnabled("instagramUrl") && (
          <div>
            <label className={labelCls}>{fldLabel("instagramUrl", "Instagram")}</label>
            <input
              className={inputCls}
              required={isReq("instagramUrl")}
              value={instagramUrl}
              onChange={handleUpperChange(setInstagramUrl)}
              placeholder={fldPlaceholder("instagramUrl", "@usuario (o 'No tengo')")}
            />
          </div>
          )}

          {isEnabled("telefonoAlternativo") && (
          <div>
            <label className={labelCls}>{fldLabel("telefonoAlternativo", "Teléfono Alternativo")}</label>
            <input
              className={inputCls}
              required={isReq("telefonoAlternativo")}
              value={telefonoAlternativo}
              onChange={handleUpperChange(setTelefonoAlternativo)}
              placeholder={fldPlaceholder("telefonoAlternativo", "Opcional (familiar / fijo)")}
            />
          </div>
          )}

          {isEnabled("linkedinUrl") && (
          <div>
            <label className={labelCls}>{fldLabel("linkedinUrl", "LinkedIn / Portfolio")}</label>
            <input
              className={inputCls}
              required={isReq("linkedinUrl")}
              value={linkedinUrl}
              onChange={handleUpperChange(setLinkedinUrl)}
              placeholder={fldPlaceholder("linkedinUrl", "https://linkedin.com/in/...")}
            />
          </div>
          )}
          {renderCustomFieldsForSection("ubicacion")}
        </div>
      </section>

      {/* SECCIÓN 3: PUESTO, DISPONIBILIDAD Y MOVILIDAD */}
      <section className="rounded-3xl border border-[#112D3A]/15 bg-[#FFFFFF] p-6 shadow-md sm:p-8">
        <div className="mb-5 border-b border-[#112D3A]/10 pb-4">
          <span className="inline-block rounded-full bg-[#56D7A1]/25 px-3 py-1 text-xs font-extrabold text-[#112D3A]">
            PASO 3 DE 5
          </span>
          <h2 className="mt-1 text-xl font-extrabold text-[#112D3A]">
            Puesto al que Postula, Disponibilidad y Movilidad
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isEnabled("puestoPrincipal") && (
          <div>
            <label className={labelCls}>{fldLabel("puestoPrincipal", "Puesto / Área Principal")}</label>
            <select
              className={inputCls}
              required={isReq("puestoPrincipal")}
              value={puestoPrincipal}
              onChange={(e) => setPuestoPrincipal(e.target.value)}
            >
              {fldOptions("puestoPrincipal", PUESTOS_OPTIONS, puestoPrincipal).map((p) => (
                <option key={`p1-${p}`} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          )}

          {isEnabled("puestoSecundario") && (
          <div>
            <label className={labelCls}>{fldLabel("puestoSecundario", "Segundo Puesto de Interés")}</label>
            <select
              className={inputCls}
              required={isReq("puestoSecundario")}
              value={puestoSecundario}
              onChange={(e) => setPuestoSecundario(e.target.value)}
            >
              <option value="Sin segundo puesto">Sin segundo puesto</option>
              {fldOptions("puestoSecundario", PUESTOS_OPTIONS, puestoSecundario).map((p) => (
                <option key={`p2-${p}`} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          )}

          {isEnabled("experienciaTotal") && (
          <div>
            <label className={labelCls}>{fldLabel("experienciaTotal", "Experiencia Total Laboral")}</label>
            <select
              className={inputCls}
              required={isReq("experienciaTotal")}
              value={experienciaTotal}
              onChange={(e) => {
                const val = e.target.value;
                setExperienciaTotal(val);
                if (val === "Sin experiencia / Primer empleo") {
                  setSinExperienciaPrevia(true);
                } else if (val) {
                  setSinExperienciaPrevia(false);
                }
              }}
            >
              <option value="" disabled={isReq("experienciaTotal")}>
                Seleccionar...
              </option>
              {fldOptions(
                "experienciaTotal",
                [
                  "Sin experiencia / Primer empleo",
                  "Menos de 1 año",
                  "1 a 2 años",
                  "3 a 5 años",
                  "5 a 10 años",
                  "Más de 10 años",
                ],
                experienciaTotal
              ).map((opt) => (
                <option key={`exp-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          )}

          {isEnabled("disponibilidadHoraria") && (
          <div>
            <label className={labelCls}>{fldLabel("disponibilidadHoraria", "Disponibilidad Horaria")}</label>
            <select
              className={inputCls}
              required={isReq("disponibilidadHoraria")}
              value={disponibilidadHoraria}
              onChange={(e) => setDisponibilidadHoraria(e.target.value)}
            >
              <option value="" disabled={isReq("disponibilidadHoraria")}>
                Seleccionar...
              </option>
              {fldOptions(
                "disponibilidadHoraria",
                [
                  "Full Time — Jornada Completa",
                  "Part Time — Turno Mañana",
                  "Part Time — Turno Tarde",
                  "Turnos Rotativos / Horario Cortado",
                  "Fines de Semana / Franquero",
                ],
                disponibilidadHoraria
              ).map((opt) => (
                <option key={`dh-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          )}

          {isEnabled("incorporacion") && (
          <div>
            <label className={labelCls}>{fldLabel("incorporacion", "Disponibilidad de Incorporación")}</label>
            <select
              className={inputCls}
              required={isReq("incorporacion")}
              value={incorporacion}
              onChange={(e) => setIncorporacion(e.target.value)}
            >
              {fldOptions(
                "incorporacion",
                ["Inmediata", "En 7 días", "En 15 días (preaviso)", "En 30 días", "A convenir"],
                incorporacion
              ).map((opt) => (
                <option key={`inc-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          )}

          {isEnabled("modalidad") && (
          <div>
            <label className={labelCls}>{fldLabel("modalidad", "Modalidad Preferida")}</label>
            <select
              className={inputCls}
              required={isReq("modalidad")}
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value)}
            >
              <option value="" disabled={isReq("modalidad")}>
                Seleccionar...
              </option>
              {fldOptions(
                "modalidad",
                ["100% Presencial", "Híbrida (Presencial + Remoto)", "100% Remota"],
                modalidad
              ).map((opt) => (
                <option key={`mod-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          )}

          {isEnabled("licenciaConducir") && (
          <div>
            <label className={labelCls}>{fldLabel("licenciaConducir", "Licencia de Conducir")}</label>
            <select
              className={inputCls}
              required={isReq("licenciaConducir")}
              value={licenciaConducir}
              onChange={(e) => setLicenciaConducir(e.target.value)}
            >
              <option value="" disabled={isReq("licenciaConducir")}>
                Seleccionar...
              </option>
              {fldOptions(
                "licenciaConducir",
                [
                  "No posee",
                  "Moto (Clase A)",
                  "Auto / Utilitario (Clase B1/B2)",
                  "Camión / Carga (Clase C/E)",
                  "Transporte Profesional (Clase D)",
                ],
                licenciaConducir
              ).map((opt) => (
                <option key={`lic-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          )}

          {isEnabled("movilidadPropia") && (
          <div>
            <label className={labelCls}>{fldLabel("movilidadPropia", "Movilidad Propia")}</label>
            <select
              className={inputCls}
              required={isReq("movilidadPropia")}
              value={movilidadPropia}
              onChange={(e) => setMovilidadPropia(e.target.value)}
            >
              {fldOptions(
                "movilidadPropia",
                [
                  "No posee / Transporte público",
                  "Bicicleta",
                  "Moto propia",
                  "Auto propio",
                  "Utilitario / Camioneta propia",
                ],
                movilidadPropia
              ).map((opt) => (
                <option key={`mov-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          )}

          {isEnabled("disponibilidadViajarRotar") && (
          <div>
            <label className={labelCls}>{fldLabel("disponibilidadViajarRotar", "Disponibilidad para rotar / viajar")}</label>
            <select
              className={inputCls}
              required={isReq("disponibilidadViajarRotar")}
              value={disponibilidadViajarRotar}
              onChange={(e) => setDisponibilidadViajarRotar(e.target.value)}
            >
              {fldOptions("disponibilidadViajarRotar", ["Sí", "Eventualmente", "No"], disponibilidadViajarRotar).map((opt) => (
                <option key={`dvr-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          )}

          {isEnabled("pretensionSalarial") && (
          <div>
            <label className={labelCls}>{fldLabel("pretensionSalarial", "Pretensión Salarial Mensual")}</label>
            <select
              className={inputCls}
              required={isReq("pretensionSalarial")}
              value={pretensionSalarial}
              onChange={(e) => setPretensionSalarial(e.target.value)}
            >
              <option value="" disabled={isReq("pretensionSalarial")}>
                Seleccionar...
              </option>
              {fldOptions(
                "pretensionSalarial",
                [
                  "Según convenio / A convenir",
                  "Part Time — Acorde a media jornada",
                  "Hasta $ 700.000 netos",
                  "$ 700.000 a $ 1.000.000 netos",
                  "$ 1.000.000 a $ 1.500.000 netos",
                  "Más de $ 1.500.000 netos",
                ],
                pretensionSalarial
              ).map((opt) => (
                <option key={`sal-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          )}

          {isEnabled("presentacion") && (
          <div className="sm:col-span-2">
            <label className={labelCls}>{fldLabel("presentacion", "Breve Presentación Personal / Objetivo")}</label>
            <textarea
              rows={2}
              className={inputCls}
              required={isReq("presentacion")}
              value={presentacion}
              onChange={handleUpperChange(setPresentacion)}
              placeholder={fldPlaceholder(
                "presentacion",
                "Contanos brevemente sobre tu perfil, fortalezas y motivación para sumarte al equipo..."
              )}
            />
          </div>
          )}
          {renderCustomFieldsForSection("postulacion")}
        </div>
      </section>

      {/* SECCIÓN 4: ESTUDIOS, SISTEMAS E IDIOMAS */}
      <section className="rounded-3xl border border-[#112D3A]/15 bg-[#FFFFFF] p-6 shadow-md sm:p-8">
        <div className="mb-5 border-b border-[#112D3A]/10 pb-4">
          <span className="inline-block rounded-full bg-[#56D7A1]/25 px-3 py-1 text-xs font-extrabold text-[#112D3A]">
            PASO 4 DE 5
          </span>
          <h2 className="mt-1 text-xl font-extrabold text-[#112D3A]">
            Estudios, Manejo de Sistemas e Idiomas
          </h2>
        </div>

        <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isEnabled("nivelEstudios") && (
          <div>
            <label className={labelCls}>{fldLabel("nivelEstudios", "Nivel Máximo de Estudios")}</label>
            <select
              className={inputCls}
              required={isReq("nivelEstudios")}
              value={nivelEstudios}
              onChange={(e) => setNivelEstudios(e.target.value)}
            >
              <option value="" disabled={isReq("nivelEstudios")}>
                Seleccionar...
              </option>
              {fldOptions(
                "nivelEstudios",
                ["Primario", "Secundario", "Terciario / Tecnicatura", "Universitario", "Posgrado / Especialización"],
                nivelEstudios
              ).map((opt) => (
                <option key={`ne-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          )}

          {isEnabled("estadoEstudios") && (
          <div>
            <label className={labelCls}>{fldLabel("estadoEstudios", "Estado de Estudios")}</label>
            <select
              className={inputCls}
              required={isReq("estadoEstudios")}
              value={estadoEstudios}
              onChange={(e) => setEstadoEstudios(e.target.value)}
            >
              <option value="" disabled={isReq("estadoEstudios")}>
                Seleccionar...
              </option>
              {fldOptions("estadoEstudios", ["Completo / Graduado", "En curso", "Incompleto"], estadoEstudios).map((opt) => (
                <option key={`ee-${opt}`} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          )}

          {isEnabled("tituloCarrera") && (
          <div>
            <label className={labelCls}>{fldLabel("tituloCarrera", "Título / Orientación / Carrera")}</label>
            <input
              className={inputCls}
              required={isReq("tituloCarrera")}
              value={tituloCarrera}
              onChange={handleUpperChange(setTituloCarrera)}
              placeholder={fldPlaceholder("tituloCarrera", "Ej: Bachiller en Economía / Contador")}
            />
          </div>
          )}

          {isEnabled("institucion") && (
          <div>
            <label className={labelCls}>{fldLabel("institucion", "Institución Educativa")}</label>
            <input
              className={inputCls}
              required={isReq("institucion")}
              value={institucion}
              onChange={handleUpperChange(setInstitucion)}
              placeholder={fldPlaceholder("institucion", "Ej: UNRC / Instituto...")}
            />
          </div>
          )}

          {(isEnabled("nivelPosFacturacion") ||
            isEnabled("nivelExcel") ||
            isEnabled("nivelAtencionDigital")) && (
            <div className="grid items-end gap-4 sm:col-span-2 sm:grid-cols-3 lg:col-span-4">
              {isEnabled("nivelPosFacturacion") && (
                <div>
                  <label className={labelCls}>
                    {fldLabel("nivelPosFacturacion", "Sistemas de Caja POS / Facturación")}
                  </label>
                  <select
                    className={inputCls}
                    required={isReq("nivelPosFacturacion")}
                    value={nivelPosFacturacion}
                    onChange={(e) => setNivelPosFacturacion(e.target.value)}
                  >
                    <option value="" disabled={isReq("nivelPosFacturacion")}>
                      Seleccionar...
                    </option>
                    {fldOptions(
                      "nivelPosFacturacion",
                      ["Sin experiencia previa", "Básico", "Intermedio", "Avanzado"],
                      nivelPosFacturacion
                    ).map((opt) => (
                      <option key={`pos-${opt}`} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isEnabled("nivelExcel") && (
                <div>
                  <label className={labelCls}>
                    {fldLabel("nivelExcel", "Excel / Planillas de Cálculo")}
                  </label>
                  <select
                    className={inputCls}
                    required={isReq("nivelExcel")}
                    value={nivelExcel}
                    onChange={(e) => setNivelExcel(e.target.value)}
                  >
                    <option value="" disabled={isReq("nivelExcel")}>
                      Seleccionar...
                    </option>
                    {fldOptions(
                      "nivelExcel",
                      ["Sin manejo", "Básico", "Intermedio", "Avanzado"],
                      nivelExcel
                    ).map((opt) => (
                      <option key={`exc-${opt}`} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isEnabled("nivelAtencionDigital") && (
                <div>
                  <label className={labelCls}>
                    {fldLabel("nivelAtencionDigital", "WhatsApp Comercial / Redes / Web")}
                  </label>
                  <select
                    className={inputCls}
                    required={isReq("nivelAtencionDigital")}
                    value={nivelAtencionDigital}
                    onChange={(e) => setNivelAtencionDigital(e.target.value)}
                  >
                    <option value="" disabled={isReq("nivelAtencionDigital")}>
                      Seleccionar...
                    </option>
                    {fldOptions(
                      "nivelAtencionDigital",
                      ["Básico", "Intermedio", "Avanzado"],
                      nivelAtencionDigital
                    ).map((opt) => (
                      <option key={`dig-${opt}`} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {isEnabled("idiomaPrincipal") && (
            <div className="rounded-2xl border border-[#112D3A]/12 bg-[#f7fafb] p-4 sm:col-span-2 lg:col-span-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wide text-[#112D3A]/85">
                    {fldLabel("idiomaPrincipal", "Idioma Extra")}
                  </span>
                  <span className="text-[11px] text-[#112D3A]/60">
                    Si hablás más de un idioma, podés sumar todos los que domines con su nivel.
                  </span>
                </div>
                {idiomas[0]?.idioma &&
                  idiomas[0].idioma !== "Ninguno" &&
                  idiomas.length < 10 && (
                    <button
                      type="button"
                      onClick={addIdiomaRow}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#112D3A] px-3.5 py-2 text-xs font-extrabold text-[#56D7A1] shadow-sm transition hover:brightness-110"
                    >
                      + Agregar otro idioma
                    </button>
                  )}
              </div>

              <div className="space-y-3">
                {idiomas.map((row, idx) => {
                  const chosenElsewhere = new Set(
                    idiomas
                      .filter((_, i) => i !== idx)
                      .map((r) => r.idioma)
                      .filter(Boolean)
                  );
                  const hasLang = Boolean(row.idioma && row.idioma !== "Ninguno");
                  const otherLangsMerged = [
                    ...OTHER_WORLD_LANGUAGES,
                    ...extraCustomLanguages,
                  ];
                  const isLegacyUnknown =
                    Boolean(row.idioma) &&
                    row.idioma !== "Ninguno" &&
                    !ALL_WORLD_LANGUAGES.includes(row.idioma) &&
                    !extraCustomLanguages.includes(row.idioma);
                  const levelOpts = fldOptions(
                    "nivelIdioma",
                    [...LANGUAGE_LEVEL_OPTIONS],
                    row.nivel
                  );

                  return (
                    <div
                      key={`idioma-row-${idx}`}
                      className={
                        idiomas.length > 1
                          ? "grid items-end gap-3 sm:grid-cols-[1fr_210px_auto]"
                          : "grid items-end gap-3 sm:grid-cols-[1fr_220px]"
                      }
                    >
                      <div>
                        <label className={labelCls}>
                          {idx === 0
                            ? `Idioma${isReq("idiomaPrincipal") ? " *" : ""}`
                            : `Idioma #${idx + 1} *`}
                        </label>
                        <select
                          className={inputCls}
                          required={idx === 0 ? isReq("idiomaPrincipal") : true}
                          value={row.idioma}
                          onChange={(e) => updateIdioma(idx, e.target.value)}
                        >
                          <option value="" disabled={idx === 0 ? isReq("idiomaPrincipal") : true}>
                            Seleccionar idioma...
                          </option>
                          {idx === 0 && (
                            <option value="Ninguno">Ninguno (solo español)</option>
                          )}
                          {isLegacyUnknown && (
                            <option value={row.idioma}>{row.idioma}</option>
                          )}
                          <optgroup label="Más frecuentes">
                            {COMMON_WORLD_LANGUAGES.map((lang) => (
                              <option
                                key={`c-${idx}-${lang}`}
                                value={lang}
                                disabled={chosenElsewhere.has(lang)}
                              >
                                {lang}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Todos los idiomas del mundo (A–Z)">
                            {otherLangsMerged.map((lang) => (
                              <option
                                key={`w-${idx}-${lang}`}
                                value={lang}
                                disabled={chosenElsewhere.has(lang)}
                              >
                                {lang}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      {isEnabled("nivelIdioma") && (
                        <div>
                          <label className={labelCls}>
                            {fieldMap.nivelIdioma?.label || "Nivel"}
                          </label>
                          <select
                            className={inputCls}
                            disabled={!hasLang}
                            required={hasLang}
                            value={row.nivel}
                            onChange={(e) => updateIdiomaNivel(idx, e.target.value)}
                          >
                            {levelOpts.map((opt) => (
                              <option key={`nidi-${idx}-${opt}`} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {idiomas.length > 1 && (
                        <div>
                          <button
                            type="button"
                            onClick={() => removeIdiomaRow(idx)}
                            className="h-[42px] w-full rounded-xl border border-[#dc2626]/30 bg-[#FFFFFF] px-3.5 text-xs font-extrabold text-[#dc2626] transition hover:bg-[#fef2f2] sm:w-auto"
                          >
                            Quitar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isEnabled("cursosAdicionales") && (
          <div className="sm:col-span-2 lg:col-span-4">
            <label className={labelCls}>{fldLabel("cursosAdicionales", "Cursos, Certificaciones o Carnets")}</label>
            <input
              className={inputCls}
              required={isReq("cursosAdicionales")}
              value={cursosAdicionales}
              onChange={handleUpperChange(setCursosAdicionales)}
              placeholder={fldPlaceholder(
                "cursosAdicionales",
                "Ej: Carnet de Manipulación de Alimentos vigente, Curso Atención al Cliente, Liquidación..."
              )}
            />
          </div>
          )}
          {renderCustomFieldsForSection("formacion")}
        </div>
      </section>

      {/* SECCIÓN 5: EXPERIENCIA LABORAL + ADJUNTAR CV EN PDF */}
      <section className="rounded-3xl border border-[#112D3A]/15 bg-[#FFFFFF] p-6 shadow-md sm:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#112D3A]/10 pb-4">
          <div>
            <span className="inline-block rounded-full bg-[#56D7A1]/25 px-3 py-1 text-xs font-extrabold text-[#112D3A]">
              PASO 5 DE 5
            </span>
            <h2 className="mt-1 text-xl font-extrabold text-[#112D3A]">
              Experiencia Laboral, Referencias y CV en PDF
            </h2>
          </div>

          {isEnabled("experiencias") && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#112D3A]/5 px-3.5 py-2 text-xs font-bold text-[#112D3A]">
            <input
              type="checkbox"
              checked={sinExperienciaPrevia}
              onChange={(e) => {
                const checked = e.target.checked;
                setSinExperienciaPrevia(checked);
                if (checked && !experienciaTotal) {
                  setExperienciaTotal("Sin experiencia / Primer empleo");
                }
              }}
              className="h-4 w-4 accent-[#56D7A1]"
            />
            Postulación a Primer Empleo (sin experiencia laboral previa)
          </label>
          )}
        </div>

        {isEnabled("experiencias") && !sinExperienciaPrevia && (
          <div className="space-y-4">
            {experiencias.map((exp, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-[#112D3A]/15 bg-[#f7fafb] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase text-[#112D3A]">
                    Experiencia Laboral #{idx + 1}
                  </span>
                  {experiencias.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExperiencias((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-xs font-bold text-[#dc2626] hover:underline"
                    >
                      Eliminar experiencia
                    </button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className={labelCls}>Empresa / Comercio *</label>
                    <input
                      className={inputCls}
                      required={isReq("experiencias")}
                      value={exp.empresa}
                      onChange={(e) => updateExpField(idx, "empresa", e.target.value)}
                      placeholder="Nombre del comercio"
                    />
                  </div>
                  {isEnabled("expRubroEmpresa") && (
                  <div>
                    <label className={labelCls}>{fldLabel("expRubroEmpresa", "Rubro de la Empresa")}</label>
                    <select
                      className={inputCls}
                      required={isReq("experiencias") && isReq("expRubroEmpresa")}
                      value={exp.rubroEmpresa}
                      onChange={(e) =>
                        updateExpField(idx, "rubroEmpresa", e.target.value)
                      }
                    >
                      <option value="" disabled={isReq("expRubroEmpresa")}>
                        Seleccionar...
                      </option>
                      {fldOptions("expRubroEmpresa", RUBROS_EMPRESA_OPTIONS, exp.rubroEmpresa).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  )}
                  <div>
                    <label className={labelCls}>Puesto Ocupado *</label>
                    <input
                      className={inputCls}
                      required={isReq("experiencias")}
                      value={exp.puesto}
                      onChange={(e) => updateExpField(idx, "puesto", e.target.value)}
                      placeholder="Ej: Cajera / Vendedor"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Desde *</label>
                      <select
                        className={inputCls}
                        required={isReq("experiencias")}
                        value={exp.desdeAnio}
                        onChange={(e) =>
                          updateExpField(idx, "desdeAnio", e.target.value)
                        }
                      >
                        <option value="" disabled>
                          Seleccionar...
                        </option>
                        {YEARS_LIST.map((y) => (
                          <option key={`d-${y}`} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Hasta *</label>
                      <select
                        className={inputCls}
                        required={isReq("experiencias")}
                        value={exp.hastaAnio}
                        onChange={(e) =>
                          updateExpField(idx, "hastaAnio", e.target.value)
                        }
                      >
                        <option value="" disabled>
                          Seleccionar...
                        </option>
                        <option value="Actualidad">Actualidad</option>
                        {YEARS_LIST.map((y) => (
                          <option key={`h-${y}`} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {isEnabled("expAntiguedad") && (
                  <div>
                    <label className={labelCls}>{fldLabel("expAntiguedad", "Duración / Antigüedad")}</label>
                    <select
                      className={inputCls}
                      required={isReq("experiencias") && isReq("expAntiguedad")}
                      value={exp.antiguedad}
                      onChange={(e) =>
                        updateExpField(idx, "antiguedad", e.target.value)
                      }
                    >
                      <option value="" disabled={isReq("expAntiguedad")}>
                        Seleccionar...
                      </option>
                      {fldOptions(
                        "expAntiguedad",
                        [
                          "Temporada / Menos de 6 meses",
                          "6 meses a 1 año",
                          "1 a 2 años",
                          "3 a 5 años",
                          "Más de 5 años",
                        ],
                        exp.antiguedad
                      ).map((opt) => (
                        <option key={`ant-${opt}`} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  )}

                  {isEnabled("expMotivoEgreso") && (
                  <div>
                    <label className={labelCls}>{fldLabel("expMotivoEgreso", "Motivo de Desvinculación")}</label>
                    <select
                      className={inputCls}
                      required={isReq("experiencias") && isReq("expMotivoEgreso")}
                      value={exp.motivoEgreso}
                      onChange={(e) =>
                        updateExpField(idx, "motivoEgreso", e.target.value)
                      }
                    >
                      <option value="" disabled={isReq("expMotivoEgreso")}>
                        Seleccionar...
                      </option>
                      {fldOptions("expMotivoEgreso", MOTIVOS_EGRESO_OPTIONS, exp.motivoEgreso).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  )}

                  <div>
                    <label className={labelCls}>Contacto de Referencia *</label>
                    <input
                      className={inputCls}
                      required={isReq("experiencias")}
                      value={exp.referenciaNombre}
                      onChange={(e) =>
                        updateExpField(idx, "referenciaNombre", e.target.value)
                      }
                      placeholder="Nombre encargado / dueño"
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Teléfono de Referencia *</label>
                    <input
                      className={inputCls}
                      required={isReq("experiencias")}
                      value={exp.referenciaTelefono}
                      onChange={(e) =>
                        updateExpField(idx, "referenciaTelefono", e.target.value)
                      }
                      placeholder="Ej: 3584..."
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-4">
                    <label className={labelCls}>Principales Tareas Realizadas *</label>
                    <input
                      className={inputCls}
                      required={isReq("experiencias")}
                      value={exp.tareas}
                      onChange={(e) => updateExpField(idx, "tareas", e.target.value)}
                      placeholder="Ej: Apertura y cierre de caja, atención al público, control de stock..."
                    />
                  </div>
                </div>
              </div>
            ))}

            {experiencias.length < 6 && (
              <button
                type="button"
                onClick={() =>
                  setExperiencias((prev) => [...prev, emptyExperience()])
                }
                className="rounded-xl border-2 border-dashed border-[#112D3A]/30 px-4 py-2.5 text-xs font-extrabold text-[#112D3A] hover:border-[#56D7A1] hover:bg-[#56D7A1]/10"
              >
                + Agregar otra experiencia laboral
              </button>
            )}
          </div>
        )}

        {resolvedConfig.fields.some((f) => f.isCustom && f.enabled && f.section === "experiencia") && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {renderCustomFieldsForSection("experiencia")}
          </div>
        )}

        {/* ADJUNTO CV EN PDF */}
        {isEnabled("pdfAdjunto") && (
        <div className="mt-6 rounded-2xl border-2 border-[#56D7A1] bg-[#112D3A]/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-[#112D3A]">
                📄 {fieldMap.pdfAdjunto?.label || "Adjuntar Curriculum Vitae en PDF"} {isReq("pdfAdjunto") ? "*" : "(Opcional / Recomendado)"}
              </h3>
              <p className="text-xs text-[#112D3A]/70">
                Podés adjuntar tu archivo PDF original (máximo 3 MB) para respaldar tu
                postulación.
              </p>
            </div>
            <label className="cursor-pointer rounded-xl bg-[#112D3A] px-4 py-2.5 text-xs font-extrabold text-[#56D7A1] shadow hover:brightness-110">
              📎 Seleccionar Archivo PDF
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={handlePdfChange}
                className="hidden"
              />
            </label>
          </div>

          {pdfFileName && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FFFFFF] px-4 py-2.5 text-xs font-bold text-[#112D3A] shadow-sm">
              <span>
                ✅ {pdfFileName}
                {pdfSizeKb > 0 ? ` (${pdfSizeKb} KB)` : " (PDF ya registrado)"}
              </span>
              <div className="flex items-center gap-3">
                {existingPdfUrl && !pdfBase64 && (
                  <a
                    href={existingPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-extrabold text-[#0b5e3e] underline"
                  >
                    Ver PDF actual ↗
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPdfBase64("");
                    setPdfFileName("");
                    setPdfSizeKb(0);
                    setExistingPdfUrl("");
                    setClearPdf(true);
                  }}
                  className="text-[#dc2626] underline"
                >
                  Quitar PDF
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        <div className="mt-7 flex flex-col items-end gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-[#56D7A1] px-8 py-4 text-base font-black text-[#112D3A] shadow-lg transition hover:brightness-95 disabled:opacity-60 sm:w-auto"
          >
            {submitting
              ? existingCvCode
                ? "Actualizando tu Curriculum Vitae..."
                : "Enviando tu Curriculum Vitae..."
              : existingCvCode
                ? `🔄 Actualizar mis datos de CV (${existingCvCode})`
                : "🚀 Enviar mi Curriculum Vitae"}
          </button>
          <span className="text-[11px] text-[#112D3A]/60">
            {existingCvCode
              ? "Se actualizará tu CV existente sin duplicarlo y el administrador recibirá un alerta con tus nuevos datos."
              : "Al enviar recibirás en pantalla tu comprobante inmediato de recepción."}
          </span>
        </div>
      </section>
    </form>
  );
}
