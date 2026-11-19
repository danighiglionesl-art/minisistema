"use client";

import React, { useEffect, useMemo, useState } from "react";

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
    rubroEmpresa: "Comercio Minorista / Tienda",
    puesto: "",
    antiguedad: "1 a 2 años",
    desdeAnio: String(new Date().getFullYear() - 2),
    hastaAnio: "Actualidad",
    motivoEgreso: "Búsqueda de crecimiento profesional",
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
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [tipoDoc, setTipoDoc] = useState("DNI");
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

  const [puestoPrincipal, setPuestoPrincipal] = useState(PUESTOS_OPTIONS[0]);
  const [puestoSecundario, setPuestoSecundario] = useState("Sin segundo puesto");
  const [disponibilidadHoraria, setDisponibilidadHoraria] = useState("");
  const [incorporacion, setIncorporacion] = useState("Inmediata");
  const [modalidad, setModalidad] = useState("");
  const [experienciaTotal, setExperienciaTotal] = useState("");
  const [licenciaConducir, setLicenciaConducir] = useState("");
  const [movilidadPropia, setMovilidadPropia] = useState("No posee / Transporte público");
  const [disponibilidadViajarRotar, setDisponibilidadViajarRotar] = useState("Sí");
  const [pretensionSalarial, setPretensionSalarial] = useState("");
  const [presentacion, setPresentacion] = useState("");

  const [nivelEstudios, setNivelEstudios] = useState("");
  const [estadoEstudios, setEstadoEstudios] = useState("");
  const [tituloCarrera, setTituloCarrera] = useState("");
  const [institucion, setInstitucion] = useState("");
  const [nivelPosFacturacion, setNivelPosFacturacion] = useState("");
  const [nivelExcel, setNivelExcel] = useState("");
  const [nivelAtencionDigital, setNivelAtencionDigital] = useState("");
  const [idiomaPrincipal, setIdiomaPrincipal] = useState("");
  const [nivelIdioma, setNivelIdioma] = useState("Básico");
  const [cursosAdicionales, setCursosAdicionales] = useState("");

  const [sinExperienciaPrevia, setSinExperienciaPrevia] = useState(false);
  const [experiencias, setExperiencias] = useState<ExperienceRow[]>([emptyExperience()]);

  const [fotoBase64, setFotoBase64] = useState("");
  const [pdfBase64, setPdfBase64] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfSizeKb, setPdfSizeKb] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [submittedReceipt, setSubmittedReceipt] = useState<{
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
      setErrorMsg("");
    } catch {
      setErrorMsg("No se pudo leer el archivo PDF seleccionado.");
    }
  };

  const updateExpField = (idx: number, key: keyof ExperienceRow, val: string) => {
    setExperiencias((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [key]: val } : row))
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
            idiomaPrincipal,
            nivelIdioma: idiomaPrincipal === "Ninguno" ? "" : nivelIdioma,
            cursosAdicionales,
            experiencias: sinExperienciaPrevia ? [] : experiencias,
            fotoBase64,
            pdfBase64,
            pdfFileName,
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
    "w-full rounded-xl border border-[#112D3A]/20 bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#112D3A] shadow-sm focus:border-[#56D7A1] focus:outline-none focus:ring-2 focus:ring-[#56D7A1]/40";
  const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#112D3A]/80";

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
          Notificación de Recepción Exitosa
        </div>
        <h2 className="text-2xl font-extrabold text-[#112D3A]">
          ¡Tu Curriculum Vitae fue enviado correctamente!
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#112D3A]/80">
          Gracias <strong>{submittedReceipt.candidateName}</strong>. Tus datos, perfil
          laboral y archivos adjuntos ya ingresaron al módulo de selección de{" "}
          <strong>{props.fantasyName}</strong>.
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
                  onClick={() => setFotoBase64("")}
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelCls}>Nombre(s) *</label>
            <input
              className={inputCls}
              required
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              placeholder="Ej: María Florencia"
            />
          </div>
          <div>
            <label className={labelCls}>Apellido(s) *</label>
            <input
              className={inputCls}
              required
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
              placeholder="Ej: González"
            />
          </div>
          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-2">
              <label className={labelCls}>Tipo Doc. *</label>
              <select
                className={inputCls}
                required
                value={tipoDoc}
                onChange={(e) => setTipoDoc(e.target.value)}
              >
                <option value="DNI">DNI</option>
                <option value="CUIL">CUIL</option>
                <option value="CUIT">CUIT</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="Doc. Extranjero">Extranjero</option>
              </select>
            </div>
            <div className="col-span-3">
              <label className={labelCls}>Número *</label>
              <input
                className={inputCls}
                required
                value={nroDoc}
                onChange={(e) => setNroDoc(e.target.value)}
                placeholder="Ej: 38123456"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Fecha de Nacimiento *</label>
            <input
              type="date"
              required
              className={inputCls}
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Género *</label>
            <select
              className={inputCls}
              required
              value={genero}
              onChange={(e) => setGenero(e.target.value)}
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              <option value="Femenino">Femenino</option>
              <option value="Masculino">Masculino</option>
              <option value="No binario">No binario</option>
              <option value="Prefiero no especificar">Prefiero no especificar</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Estado Civil *</label>
            <select
              className={inputCls}
              required
              value={estadoCivil}
              onChange={(e) => setEstadoCivil(e.target.value)}
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              <option value="Soltero/a">Soltero/a</option>
              <option value="Casado/a">Casado/a</option>
              <option value="Unión convivencial">Unión convivencial</option>
              <option value="Divorciado/a">Divorciado/a</option>
              <option value="Viudo/a">Viudo/a</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Cargas de Familia / Hijos *</label>
            <select
              className={inputCls}
              required
              value={hijosACargo}
              onChange={(e) => setHijosACargo(e.target.value)}
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              <option value="Sin cargas de familia">Sin cargas de familia</option>
              <option value="1 persona a cargo">1 persona a cargo</option>
              <option value="2 personas a cargo">2 personas a cargo</option>
              <option value="3 o más personas a cargo">3 o más personas a cargo</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Nacionalidad *</label>
            <select
              className={inputCls}
              required
              value={nacionalidad}
              onChange={(e) => setNacionalidad(e.target.value)}
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              {props.paises.map((p) => (
                <option key={`nac-${p.id}-${p.nombre}`} value={p.nombre}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
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
          <div>
            <label className={labelCls}>País de Residencia *</label>
            <select
              className={inputCls}
              required
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

          <div>
            <label className={labelCls}>Provincia / Estado *</label>
            {pais === "ARGENTINA" ? (
              <select
                className={inputCls}
                required
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
                required
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
                placeholder="Estado / Región"
              />
            )}
          </div>

          <div>
            <label className={labelCls}>Localidad / Ciudad *</label>
            {pais === "ARGENTINA" && localidadesDisponibles.length > 0 ? (
              <select
                className={inputCls}
                required
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
                required
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
                placeholder="Ciudad / Localidad"
              />
            )}
          </div>

          <div>
            <label className={labelCls}>Código Postal *</label>
            <input
              className={inputCls}
              required
              value={cp}
              onChange={(e) => setCp(e.target.value)}
              placeholder="Ej: 5800"
            />
          </div>

          {/* Domicilio dividido */}
          <div className="sm:col-span-2">
            <label className={labelCls}>Calle *</label>
            <input
              className={inputCls}
              required
              value={domicilioCalle}
              onChange={(e) => setDomicilioCalle(e.target.value)}
              placeholder="Ej: Av. San Martín"
            />
          </div>

          <div>
            <label className={labelCls}>Número *</label>
            <input
              className={inputCls}
              required
              value={domicilioNumero}
              onChange={(e) => setDomicilioNumero(e.target.value)}
              placeholder="Ej: 450 (o S/N)"
            />
          </div>

          <div>
            <label className={labelCls}>Barrio *</label>
            <input
              className={inputCls}
              required
              value={domicilioBarrio}
              onChange={(e) => setDomicilioBarrio(e.target.value)}
              placeholder="Ej: Centro"
            />
          </div>

          <div>
            <label className={labelCls}>Piso</label>
            <input
              className={inputCls}
              value={domicilioPiso}
              onChange={(e) => setDomicilioPiso(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div>
            <label className={labelCls}>Dpto.</label>
            <input
              className={inputCls}
              value={domicilioDpto}
              onChange={(e) => setDomicilioDpto(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div>
            <label className={labelCls}>Edificio</label>
            <input
              className={inputCls}
              value={domicilioEdificio}
              onChange={(e) => setDomicilioEdificio(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div>
            <label className={labelCls}>Torre</label>
            <input
              className={inputCls}
              value={domicilioTorre}
              onChange={(e) => setDomicilioTorre(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div>
            <label className={labelCls}>País de WhatsApp *</label>
            <select
              className={inputCls}
              required
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
            <label className={labelCls}>Número de WhatsApp *</label>
            <input
              className={inputCls}
              required
              type="tel"
              value={whatsappNumero}
              onChange={(e) => setWhatsappNumero(e.target.value)}
              placeholder="Ej: 3585095475 (sin 0 ni 15)"
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Correo Electrónico *</label>
            <input
              type="email"
              required
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@correo.com"
            />
          </div>

          <div>
            <label className={labelCls}>Facebook *</label>
            <input
              className={inputCls}
              required
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
              placeholder="Usuario o enlace (o 'No tengo')"
            />
          </div>

          <div>
            <label className={labelCls}>Instagram *</label>
            <input
              className={inputCls}
              required
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="@usuario (o 'No tengo')"
            />
          </div>

          <div>
            <label className={labelCls}>Teléfono Alternativo</label>
            <input
              className={inputCls}
              value={telefonoAlternativo}
              onChange={(e) => setTelefonoAlternativo(e.target.value)}
              placeholder="Opcional (familiar / fijo)"
            />
          </div>

          <div>
            <label className={labelCls}>LinkedIn / Portfolio</label>
            <input
              className={inputCls}
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/..."
            />
          </div>
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
          <div>
            <label className={labelCls}>Puesto / Área Principal *</label>
            <select
              className={inputCls}
              required
              value={puestoPrincipal}
              onChange={(e) => setPuestoPrincipal(e.target.value)}
            >
              {PUESTOS_OPTIONS.map((p) => (
                <option key={`p1-${p}`} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Segundo Puesto de Interés</label>
            <select
              className={inputCls}
              value={puestoSecundario}
              onChange={(e) => setPuestoSecundario(e.target.value)}
            >
              <option value="Sin segundo puesto">Sin segundo puesto</option>
              {PUESTOS_OPTIONS.map((p) => (
                <option key={`p2-${p}`} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Experiencia Total Laboral *</label>
            <select
              className={inputCls}
              required
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
              <option value="" disabled>
                Seleccionar...
              </option>
              <option value="Sin experiencia / Primer empleo">
                Sin experiencia / Primer empleo
              </option>
              <option value="Menos de 1 año">Menos de 1 año</option>
              <option value="1 a 2 años">1 a 2 años</option>
              <option value="3 a 5 años">3 a 5 años</option>
              <option value="5 a 10 años">5 a 10 años</option>
              <option value="Más de 10 años">Más de 10 años</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Disponibilidad Horaria *</label>
            <select
              className={inputCls}
              required
              value={disponibilidadHoraria}
              onChange={(e) => setDisponibilidadHoraria(e.target.value)}
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              <option value="Full Time — Jornada Completa">
                Full Time — Jornada Completa
              </option>
              <option value="Part Time — Turno Mañana">Part Time — Turno Mañana</option>
              <option value="Part Time — Turno Tarde">Part Time — Turno Tarde</option>
              <option value="Turnos Rotativos / Horario Cortado">
                Turnos Rotativos / Horario Cortado
              </option>
              <option value="Fines de Semana / Franquero">
                Fines de Semana / Franquero
              </option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Disponibilidad de Incorporación</label>
            <select
              className={inputCls}
              value={incorporacion}
              onChange={(e) => setIncorporacion(e.target.value)}
            >
              <option value="Inmediata">Inmediata</option>
              <option value="En 7 días">En 7 días</option>
              <option value="En 15 días (preaviso)">En 15 días (preaviso)</option>
              <option value="En 30 días">En 30 días</option>
              <option value="A convenir">A convenir</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Modalidad Preferida *</label>
            <select
              className={inputCls}
              required
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value)}
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              <option value="100% Presencial">100% Presencial</option>
              <option value="Híbrida (Presencial + Remoto)">
                Híbrida (Presencial + Remoto)
              </option>
              <option value="100% Remota">100% Remota</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Licencia de Conducir *</label>
            <select
              className={inputCls}
              required
              value={licenciaConducir}
              onChange={(e) => setLicenciaConducir(e.target.value)}
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              <option value="No posee">No posee</option>
              <option value="Moto (Clase A)">Moto (Clase A)</option>
              <option value="Auto / Utilitario (Clase B1/B2)">
                Auto / Utilitario (Clase B1/B2)
              </option>
              <option value="Camión / Carga (Clase C/E)">
                Camión / Carga (Clase C/E)
              </option>
              <option value="Transporte Profesional (Clase D)">
                Transporte Profesional (Clase D)
              </option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Movilidad Propia</label>
            <select
              className={inputCls}
              value={movilidadPropia}
              onChange={(e) => setMovilidadPropia(e.target.value)}
            >
              <option value="No posee / Transporte público">
                No posee / Transporte público
              </option>
              <option value="Bicicleta">Bicicleta</option>
              <option value="Moto propia">Moto propia</option>
              <option value="Auto propio">Auto propio</option>
              <option value="Utilitario / Camioneta propia">
                Utilitario / Camioneta propia
              </option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Disponibilidad para rotar / viajar</label>
            <select
              className={inputCls}
              value={disponibilidadViajarRotar}
              onChange={(e) => setDisponibilidadViajarRotar(e.target.value)}
            >
              <option value="Sí">Sí</option>
              <option value="Eventualmente">Eventualmente</option>
              <option value="No">No</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Pretensión Salarial Mensual *</label>
            <select
              className={inputCls}
              required
              value={pretensionSalarial}
              onChange={(e) => setPretensionSalarial(e.target.value)}
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              <option value="Según convenio / A convenir">
                Según convenio / A convenir
              </option>
              <option value="Part Time — Acorde a media jornada">
                Part Time — Acorde a media jornada
              </option>
              <option value="Hasta $ 700.000 netos">Hasta $ 700.000 netos</option>
              <option value="$ 700.000 a $ 1.000.000 netos">
                $ 700.000 a $ 1.000.000 netos
              </option>
              <option value="$ 1.000.000 a $ 1.500.000 netos">
                $ 1.000.000 a $ 1.500.000 netos
              </option>
              <option value="Más de $ 1.500.000 netos">Más de $ 1.500.000 netos</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Breve Presentación Personal / Objetivo</label>
            <textarea
              rows={2}
              className={inputCls}
              value={presentacion}
              onChange={(e) => setPresentacion(e.target.value)}
              placeholder="Contanos brevemente sobre tu perfil, fortalezas y motivación para sumarte al equipo..."
            />
          </div>
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls}>Nivel Máximo de Estudios *</label>
            <select
              className={inputCls}
              required
              value={nivelEstudios}
              onChange={(e) => setNivelEstudios(e.target.value)}
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              <option value="Primario">Primario</option>
              <option value="Secundario">Secundario</option>
              <option value="Terciario / Tecnicatura">Terciario / Tecnicatura</option>
              <option value="Universitario">Universitario</option>
              <option value="Posgrado / Especialización">
                Posgrado / Especialización
              </option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Estado de Estudios *</label>
            <select
              className={inputCls}
              required
              value={estadoEstudios}
              onChange={(e) => setEstadoEstudios(e.target.value)}
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              <option value="Completo / Graduado">Completo / Graduado</option>
              <option value="En curso">En curso</option>
              <option value="Incompleto">Incompleto</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Título / Orientación / Carrera</label>
            <input
              className={inputCls}
              value={tituloCarrera}
              onChange={(e) => setTituloCarrera(e.target.value)}
              placeholder="Ej: Bachiller en Economía / Contador"
            />
          </div>

          <div>
            <label className={labelCls}>Institución Educativa</label>
            <input
              className={inputCls}
              value={institucion}
              onChange={(e) => setInstitucion(e.target.value)}
              placeholder="Ej: UNRC / Instituto..."
            />
          </div>

          <div>
            <label className={labelCls}>Sistemas de Caja POS / Facturación *</label>
            <select
              className={inputCls}
              required
              value={nivelPosFacturacion}
              onChange={(e) => setNivelPosFacturacion(e.target.value)}
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              <option value="Sin experiencia previa">Sin experiencia previa</option>
              <option value="Básico">Básico</option>
              <option value="Intermedio">Intermedio</option>
              <option value="Avanzado">Avanzado</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Excel / Planillas de Cálculo *</label>
            <select
              className={inputCls}
              required
              value={nivelExcel}
              onChange={(e) => setNivelExcel(e.target.value)}
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              <option value="Sin manejo">Sin manejo</option>
              <option value="Básico">Básico</option>
              <option value="Intermedio">Intermedio</option>
              <option value="Avanzado">Avanzado</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>WhatsApp Comercial / Redes / Web *</label>
            <select
              className={inputCls}
              required
              value={nivelAtencionDigital}
              onChange={(e) => setNivelAtencionDigital(e.target.value)}
            >
              <option value="" disabled>
                Seleccionar...
              </option>
              <option value="Básico">Básico</option>
              <option value="Intermedio">Intermedio</option>
              <option value="Avanzado">Avanzado</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Idioma Extra *</label>
              <select
                className={inputCls}
                required
                value={idiomaPrincipal}
                onChange={(e) => setIdiomaPrincipal(e.target.value)}
              >
                <option value="" disabled>
                  Seleccionar...
                </option>
                <option value="Ninguno">Ninguno</option>
                <option value="Inglés">Inglés</option>
                <option value="Portugués">Portugués</option>
                <option value="Italiano">Italiano</option>
                <option value="Francés">Francés</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Nivel</label>
              <select
                className={inputCls}
                disabled={!idiomaPrincipal || idiomaPrincipal === "Ninguno"}
                required={Boolean(idiomaPrincipal && idiomaPrincipal !== "Ninguno")}
                value={nivelIdioma}
                onChange={(e) => setNivelIdioma(e.target.value)}
              >
                <option value="Básico">Básico</option>
                <option value="Intermedio">Intermedio</option>
                <option value="Avanzado">Avanzado</option>
                <option value="Nativo / Bilingüe">Nativo</option>
              </select>
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <label className={labelCls}>Cursos, Certificaciones o Carnets (ej. Manipulación de Alimentos)</label>
            <input
              className={inputCls}
              value={cursosAdicionales}
              onChange={(e) => setCursosAdicionales(e.target.value)}
              placeholder="Ej: Carnet de Manipulación de Alimentos vigente, Curso Atención al Cliente, Liquidación..."
            />
          </div>
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
        </div>

        {!sinExperienciaPrevia && (
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
                      required
                      value={exp.empresa}
                      onChange={(e) => updateExpField(idx, "empresa", e.target.value)}
                      placeholder="Nombre del comercio"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Rubro de la Empresa</label>
                    <select
                      className={inputCls}
                      value={exp.rubroEmpresa}
                      onChange={(e) =>
                        updateExpField(idx, "rubroEmpresa", e.target.value)
                      }
                    >
                      {RUBROS_EMPRESA_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Puesto Ocupado *</label>
                    <input
                      className={inputCls}
                      required
                      value={exp.puesto}
                      onChange={(e) => updateExpField(idx, "puesto", e.target.value)}
                      placeholder="Ej: Cajera / Vendedor"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Desde</label>
                      <select
                        className={inputCls}
                        value={exp.desdeAnio}
                        onChange={(e) =>
                          updateExpField(idx, "desdeAnio", e.target.value)
                        }
                      >
                        {YEARS_LIST.map((y) => (
                          <option key={`d-${y}`} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Hasta</label>
                      <select
                        className={inputCls}
                        value={exp.hastaAnio}
                        onChange={(e) =>
                          updateExpField(idx, "hastaAnio", e.target.value)
                        }
                      >
                        <option value="Actualidad">Actualidad</option>
                        {YEARS_LIST.map((y) => (
                          <option key={`h-${y}`} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Duración / Antigüedad</label>
                    <select
                      className={inputCls}
                      value={exp.antiguedad}
                      onChange={(e) =>
                        updateExpField(idx, "antiguedad", e.target.value)
                      }
                    >
                      <option value="Temporada / Menos de 6 meses">
                        Temporada / Menos de 6 meses
                      </option>
                      <option value="6 meses a 1 año">6 meses a 1 año</option>
                      <option value="1 a 2 años">1 a 2 años</option>
                      <option value="3 a 5 años">3 a 5 años</option>
                      <option value="Más de 5 años">Más de 5 años</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Motivo de Desvinculación</label>
                    <select
                      className={inputCls}
                      value={exp.motivoEgreso}
                      onChange={(e) =>
                        updateExpField(idx, "motivoEgreso", e.target.value)
                      }
                    >
                      {MOTIVOS_EGRESO_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Contacto de Referencia</label>
                    <input
                      className={inputCls}
                      value={exp.referenciaNombre}
                      onChange={(e) =>
                        updateExpField(idx, "referenciaNombre", e.target.value)
                      }
                      placeholder="Nombre encargado / dueño"
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Teléfono de Referencia</label>
                    <input
                      className={inputCls}
                      value={exp.referenciaTelefono}
                      onChange={(e) =>
                        updateExpField(idx, "referenciaTelefono", e.target.value)
                      }
                      placeholder="Ej: 3584..."
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-4">
                    <label className={labelCls}>Principales Tareas Realizadas</label>
                    <input
                      className={inputCls}
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

        {/* ADJUNTO CV EN PDF */}
        <div className="mt-6 rounded-2xl border-2 border-[#56D7A1] bg-[#112D3A]/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-[#112D3A]">
                📄 Adjuntar Curriculum Vitae en PDF (Opcional / Recomendado)
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
            <div className="mt-3 flex items-center justify-between rounded-xl bg-[#FFFFFF] px-4 py-2.5 text-xs font-bold text-[#112D3A] shadow-sm">
              <span>
                ✅ {pdfFileName} ({pdfSizeKb} KB)
              </span>
              <button
                type="button"
                onClick={() => {
                  setPdfBase64("");
                  setPdfFileName("");
                  setPdfSizeKb(0);
                }}
                className="text-[#dc2626] underline"
              >
                Quitar PDF
              </button>
            </div>
          )}
        </div>

        <div className="mt-7 flex flex-col items-end gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-[#56D7A1] px-8 py-4 text-base font-black text-[#112D3A] shadow-lg transition hover:brightness-95 disabled:opacity-60 sm:w-auto"
          >
            {submitting
              ? "Enviando tu Curriculum Vitae..."
              : "🚀 Enviar mi Curriculum Vitae"}
          </button>
          <span className="text-[11px] text-[#112D3A]/60">
            Al enviar recibirás en pantalla tu comprobante inmediato de recepción.
          </span>
        </div>
      </section>
    </form>
  );
}
