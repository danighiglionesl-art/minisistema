import { hashPassword } from "@/lib/server/crypto-auth";
import referenceCatalogs from "./reference-catalogs.json";
import { buildCleanServiciosDb } from "./servicios-seed";
import {
  ALL_ERP_MODULE_KEYS,
  GENERAL_ADMIN_DEFAULT_PASS,
  GENERAL_ADMIN_USERNAME,
} from "./types";

export interface CleanSeedOptions {
  businessName: string;
  actividadNegocio?: "comercial" | "servicios" | "mixta";
  localidad?: string;
  provincia?: string;
  cp?: string;
  whatsappComercio?: string;
  emailInfo?: string;
  enabledModules?: string[];
  initialAdmin?: {
    username: string;
    password: string;
    name: string;
    whatsapp?: string;
    branch?: string;
  } | null;
}

/**
 * Construye la base de datos inicial 100% LIMPIA para cada sistema:
 * - Catálogo: ÚNICAMENTE Artículo 20 ("00020" - "ART. GENERICO", id 4407 para compatibilidad POS).
 * - Clientes: ÚNICAMENTE Cliente #1 ("CONSUMIDOR FINAL") + tablas oficiales AFIP/ARCA de Argentina.
 * - Ventas, Cajas, Fondos, Ofertas, Pedidos a Proveedores, Banners y Comprobantes ARCA: vacíos y en cero.
 * - Usuarios: @danielg (Dani1926) como "Administrador General" + Administrador del comercio (opcional).
 */
export function buildCleanTenantSeed(opts: CleanSeedOptions): {
  docs: Record<string, unknown>;
  users: Array<Record<string, unknown>>;
} {
  const nowIso = new Date().toISOString();
  const todayIso = nowIso.slice(0, 10);
  const localidad = (opts.localidad || "RÍO CUARTO").trim().toUpperCase();
  const provincia = (opts.provincia || "CÓRDOBA").trim().toUpperCase();
  const cp = (opts.cp || "5800").trim();
  const businessUpper = (opts.businessName || "MINISISTEMA").trim().toUpperCase();

  const catalogDb = {
    updatedAt: nowIso,
    totalArticulos: 1,
    totalActivos: 1,
    totalCarritoWeb: 0,
    revision: 1,
    lastModifiedBy: "danielg",
    lastAction: "clean_seed",
    alicuotasIva: [
      { id: 1, codigo: "1", descripcion: "No Gravado", porcentaje: 0 },
      { id: 2, codigo: "2", descripcion: "Exento", porcentaje: 0 },
      { id: 3, codigo: "3", descripcion: "0%", porcentaje: 0 },
      { id: 4, codigo: "4", descripcion: "10,5%", porcentaje: 10.5 },
      { id: 5, codigo: "5", descripcion: "21%", porcentaje: 21 },
      { id: 6, codigo: "6", descripcion: "27%", porcentaje: 27 },
      { id: 8, codigo: "8", descripcion: "5%", porcentaje: 5 },
      { id: 9, codigo: "9", descripcion: "2,5%", porcentaje: 2.5 },
    ],
    rubros: [{ id: 3, codigo: 1, nombre: "GENERAL" }],
    marcas: [],
    proveedores: [],
    configuracionesPrecios: [
      {
        id: 1,
        nombre: "GENERAL 21%",
        margenMinorista: 40,
        margenMayorista: 20,
        idAlicuotaIva: 5,
        iva: 21,
      },
    ],
    configCodBarras: [
      {
        prefijo: "21",
        primerosCinco: "CODIGO",
        ultimosCinco: "CANTIDAD",
        divisorCantidad: 1000,
      },
      {
        prefijo: "23",
        primerosCinco: "CODIGO",
        ultimosCinco: "CANTIDAD",
        divisorCantidad: 1000,
      },
    ],
    gondolaQueue: [],
    fpSupplierConfigs: {},
    articulos: [
      {
        id: 4407,
        c: "00020",
        n: "ART. GENERICO",
        cf: "",
        r: 3,
        p: 0,
        pr: [],
        bc: [],
        bl: 0,
        fb: null,
        fr: 1,
        iv: 5,
        iva: 21,
        cn: 0,
        cfn: 0,
        cp: 0,
        ucp: 0,
        m1: 0,
        m2: 0,
        p1n: 0,
        p1f: 0,
        p2n: 0,
        p2f: 0,
        si: 0,
        sc: 0,
        sf: 0,
        im: "",
        ims: "sis",
        mk: 0,
        cw: 0,
        sm: 0,
      },
    ],
  };

  const consumidorFinal = {
    id: 1,
    codigo: 1,
    estado: "A",
    fechaAlta: new Date().toLocaleDateString("es-AR"),
    nombre: "CONSUMIDOR FINAL",
    calle: "S/D",
    numero: "S/N",
    piso: "",
    depto: "",
    torre: "",
    barrio: "",
    pais: "ARGENTINA",
    provincia,
    localidad,
    cp,
    telefono: "",
    celular: "",
    email: "",
    contacto: "",
    fechaNacimiento: "",
    idCategoria: 0,
    subCat1: "",
    subCat2: "",
    codigoBarra: "",
    razonSocial: "CONSUMIDOR FINAL",
    calleFiscal: "S/D",
    numeroFiscal: "S/N",
    pisoFiscal: "",
    deptoFiscal: "",
    torreFiscal: "",
    barrioFiscal: "",
    paisFiscal: "ARGENTINA",
    provinciaFiscal: provincia,
    localidadFiscal: localidad,
    cpFiscal: cp,
    idRespIva: 1,
    condicionIva: "CONSUMIDOR FINAL",
    idTipoDoc: 6,
    tipoDoc: "DNI",
    nroDoc: "00.000.000",
    idTributariaExt: "",
    tipoPersonaExt: "FISICA",
    observacion: "",
    listaPrecios: 1,
    listaPreciosSecundaria: 1,
    descuento1: 0,
    descuento2: 0,
    descuento3: 0,
    usuarioWeb: "",
    claveWeb: "",
    accesoWebHabilitado: 0,
    origenRegistro: "SISTEMA",
    solicitarIibb: 1,
    nroIibb: "",
    fechaVencIibb: "",
    idRegimenIibb: 1,
    jurisdiccionIibb: provincia,
    exencionIibb: 0,
    idMotivoExencionIibb: 0,
    idRegimenConvenio: 0,
    idCondicionContado: 1,
    condicionPagoContado: "EFECTIVO",
    habilitaCtaCte: 0,
    idVencimientoCtaCte: 0,
    vencimientoCtaCte: "VENCIMIENTO: CERO DÍAS DE PLAZO",
    idReferencia: 1,
    referencia: "BUENO",
    idFormaPago: 1,
    creditoMaximo: 0,
    creditoIlimitado: 0,
    boletaContraBoleta: 0,
    controlValoresPendientes: 0,
    cantMovs: 0,
    totalDebe: 0,
    totalHaber: 0,
    saldoActual: 0,
    ultimoMovFecha: "",
    esCliente: true,
    esProveedor: false,
    codigoProveedor: 1,
    idProveedor: 0,
    tipoProveedor: "",
    nombreFantasia: "CONSUMIDOR FINAL",
    contactoViajante: "",
    tel0800: "",
    plazoDiasCtaCteProv: 0,
    descuentoProntoPago: 0,
    ultimoMov: "",
    listaPrecioId: 1,
    listaPrecio: "MINORISTA",
    listaPrecioSecId: 1,
    listaPrecioSec: "MINORISTA",
    habilitarCtaCte: false,
    formaPagoPredeterminada: "CONTADO",
  };

  const clientesDb = {
    updatedAt: nowIso,
    totalClientes: 1,
    totalProveedores: 0,
    totalMovimientosCtaCte: 0,
    revision: 1,
    lastModifiedBy: "danielg",
    lastAction: "clean_seed",
    catalogs: referenceCatalogs.catalogs,
    tiposDoc: referenceCatalogs.tiposDoc,
    tiposProveedor: referenceCatalogs.tiposProveedor,
    clientes: [consumidorFinal],
    movimientosCtaCte: [],
    movimientosFidelizacion: [],
    pedidosWeb: [],
    soyCajeroTickets: [],
    stats: {
      totalActivos: 1,
      conCtaCte: 0,
      conSaldoDeudor: 0,
    },
    googleOAuthConfig: {
      enabled: false,
      clientId: "",
    },
    fidelizacionConfig: {
      porcentajeCompra: 0.8,
      diasVigencia: 365,
      factorCanje: 1.12,
      canalPredeterminado: "WHATSAPP",
      autoAbrirWhatsapp: true,
      whatsappComercio: opts.whatsappComercio || "+5493585095475",
      emailRemitente: opts.emailInfo || "contacto@minisistema.com.ar",
      webhookWhatsappUrl: "",
    },
  };

  const correlativoKeys = [
    "0002", "0002-A", "0002-NC-B", "0002-NC-A", "0002-ND-B", "0002-ND-A",
    "0099", "0099-A", "0099-NC-B", "0099-NC-A",
    "0003", "0003-A", "0003-NC-B", "0003-NC-A", "0003-ND-B", "0003-ND-A",
    "0100", "0100-A", "0100-NC-B", "0100-NC-A",
    "0004", "0004-A", "0004-NC-B", "0004-NC-A", "0004-ND-B", "0004-ND-A",
    "0101", "0101-A", "0101-NC-B", "0101-NC-A", "0101-ND-A",
  ];
  const nextCorrelativos: Record<string, number> = {};
  for (const k of correlativoKeys) {
    nextCorrelativos[k] = 1;
  }

  const ventasDb = {
    updatedAt: nowIso,
    todayIso,
    nextCorrelativos,
    lastEmitidosDetalle: {},
    dailyRecords: [],
    artMonthly: [],
    artRecentDaily: [],
    comprobantesPorCaja: {
      caja1: [],
      caja2: [],
      caja3: [],
    },
    cierresCaja: [],
    cierresCajaCentral: [],
    aperturasCaja: [],
    aperturasCajaCentral: [],
    efectivoInicialPorCaja: { caja1: 0, caja2: 0, caja3: 0 },
    turnosActivos: {},
    fondosDb: null,
    fondos: {
      cajaCentral: {
        saldoEfectivo: 0,
        movimientos: [],
      },
      cajaTesoreria: {
        saldoEfectivo: 0,
        movimientos: [],
      },
      bancos: {
        cuentas: [],
        movimientos: [],
        chequesCartera: [],
      },
    },
  };

  const ofertasDb = {
    updatedAt: nowIso,
    ofertas: [],
  };

  const pedidosProveedoresDb = {
    updatedAt: nowIso,
    lastSeq: 0,
    items: [],
  };

  const bannersHomepageDb = {
    intervalSec: 5,
    recommendedSize: "1530x370",
    popupDurationSec: 6,
    popupRecommendedSize: "1080x1350",
    appCarouselIntervalSec: 4,
    appCarouselRecommendedSize: "1080x360",
    appCarouselMaxItems: 10,
    updatedAt: nowIso,
    items: [],
    popups: [],
    appCarousel: [],
  };

  const arcaComprobantesDb = {
    updatedAt: nowIso,
    servicioArcaEstado: "contingencia",
    certificado: {
      cuit: "00-00000000-0",
      titular: businessUpper,
      emision: "—",
      vencimiento: "—",
      entorno: "Pendiente de Certificado ARCA",
    },
    comprobantes: [],
    auditoria: [],
  };

  const mpPointDb = {
    mode: "simulated",
    accessToken: "",
    devices: {
      caja1: "",
      caja2: "",
      caja3: "",
    },
    orders: {},
    updatedAt: nowIso,
  };

  const whatsappCloudDb = {
    provider: "meta",
    phoneNumberId: "",
    wabaId: "",
    accessToken: "",
    verifyToken: "",
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioFromNumber: "",
    templates: [],
    campaigns: [],
    optouts: [],
    updatedAt: nowIso,
  };

  const users: Array<Record<string, unknown>> = [
    {
      username: GENERAL_ADMIN_USERNAME,
      password_hash: hashPassword(GENERAL_ADMIN_DEFAULT_PASS),
      plain_compat: GENERAL_ADMIN_DEFAULT_PASS,
      name: "Daniel G.",
      vendedor: "DANIEL G.",
      role: "Administrador General",
      branch: "Casa Central",
      whatsapp: "+5493585095475",
      avatar: "",
      modules: ALL_ERP_MODULE_KEYS,
      active: true,
      created_by: "system",
    },
  ];

  if (
    opts.initialAdmin &&
    opts.initialAdmin.username &&
    opts.initialAdmin.username.trim().toLowerCase() !== GENERAL_ADMIN_USERNAME &&
    opts.initialAdmin.password.length >= 4
  ) {
    const cleanAdminUser = opts.initialAdmin.username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "");
    if (cleanAdminUser.length >= 3) {
      const adminMods =
        Array.isArray(opts.enabledModules) && opts.enabledModules.length > 0
          ? opts.enabledModules
          : ALL_ERP_MODULE_KEYS;
      users.push({
        username: cleanAdminUser,
        password_hash: hashPassword(opts.initialAdmin.password),
        plain_compat: opts.initialAdmin.password,
        name: opts.initialAdmin.name.trim() || cleanAdminUser,
        vendedor: (opts.initialAdmin.name.trim() || cleanAdminUser).toUpperCase(),
        role: "Administrador",
        branch: opts.initialAdmin.branch?.trim() || opts.businessName || "Casa Central",
        whatsapp: opts.initialAdmin.whatsapp?.trim() || "",
        avatar: "",
        modules: adminMods,
        active: true,
        created_by: GENERAL_ADMIN_USERNAME,
      });
    }
  }

  const serviciosDb = buildCleanServiciosDb(
    opts.actividadNegocio === "servicios" || opts.actividadNegocio === "mixta"
      ? opts.actividadNegocio
      : "comercial"
  );

  return {
    docs: {
      catalog_db: catalogDb,
      clientes_db: clientesDb,
      ventas_db: ventasDb,
      ofertas_db: ofertasDb,
      pedidos_proveedores: pedidosProveedoresDb,
      banners_homepage: bannersHomepageDb,
      arca_comprobantes_db: arcaComprobantesDb,
      mp_point_db: mpPointDb,
      whatsapp_cloud_db: whatsappCloudDb,
      servicios_db: serviciosDb,
    },
    users,
  };
}
