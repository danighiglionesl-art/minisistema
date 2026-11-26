import { NextRequest, NextResponse } from "next/server";
import { extractErpSessionFromRequest } from "../erp-session";
import { getTenantDoc, putTenantDoc } from "../supabase-server";
import {
  type ErpTenantRecord,
  GENERAL_ADMIN_USERNAME,
  normalizeErpRole,
} from "../types";

type AnyObj = Record<string, any>;

const APPCADI_DOC_KEY = "appcadi_site_management_v1";

export interface AppCadiInsumoRecord {
  id: string;
  vendedorId: string;
  vendedorNombre: string;
  vendedorTelefono: string;
  vendedorEstablecimiento: string;
  esProductorVecino: boolean;
  nombre: string;
  marca: string;
  categoria:
    | "agroquimicos"
    | "fertilizantes"
    | "semillas"
    | "repuestosMaquinaria"
    | "combustiblesLubricantes"
    | "boyerosAlambrados"
    | "sanidadVeterinaria";
  descripcion: string;
  precioUnitario: number;
  moneda: "ARS" | "USD";
  stockDisponible: number;
  unidadMedida: string;
  latitud: number;
  longitud: number;
  ubicacionTexto: string;
  estado: "activo" | "pausado" | "agotado" | "en_revision";
  fechaPublicacion: string;
}

export interface AppCadiPedidoRecord {
  id: string;
  numeroPedido: string;
  insumoId: string;
  insumoNombre: string;
  marca: string;
  categoria: string;
  cantidad: number;
  unidadMedida: string;
  precioUnitario: number;
  subtotalInsumo: number;
  costoFlete: number;
  total: number;
  moneda: "ARS" | "USD";
  compradorId: string;
  compradorNombre: string;
  compradorTelefono: string;
  compradorEstablecimiento: string;
  compradorLat: number;
  compradorLng: number;
  destinoTexto: string;
  vendedorId: string;
  vendedorNombre: string;
  vendedorTelefono: string;
  vendedorEstablecimiento: string;
  vendedorLat: number;
  vendedorLng: number;
  origenTexto: string;
  vendedorEsVecino: boolean;
  distanciaKm: number;
  tiempoEstimadoMinutos: number;
  estado: "solicitado" | "confirmado" | "enCamino" | "entregado" | "cancelado";
  motivoCancelacion?: string;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface AppCadiUsuarioRecord {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  tipo: "productor" | "vendedor" | "mixto";
  nivel: "general" | "administrador";
  nombreEstablecimiento: string;
  localidad: string;
  provincia: string;
  cuitRenspa: string;
  latitud: number;
  longitud: number;
  estado: "activo" | "suspendido";
  fechaRegistro: string;
}

export interface AppCadiTarifasFlete {
  costoBaseFleteArs: number;
  costoPorKmArs: number;
  radioMaximoKm: number;
  comisionPlataformaPct: number;
}

export interface AppCadiConfiguracion {
  nombreApp: string;
  slogan: string;
  soporteWhatsApp: string;
  notificacionesPushActivas: boolean;
  monedaDefault: "ARS" | "USD";
  modoOperativo: "online" | "mantenimiento";
  actualizadoEl: string;
  actualizadoPor: string;
}

export interface AppCadiAuditRecord {
  id: string;
  fecha: string;
  usuario: string;
  accion: string;
  detalle: string;
}

export interface AppCadiDoc {
  updatedAt: string;
  insumos: AppCadiInsumoRecord[];
  pedidos: AppCadiPedidoRecord[];
  usuarios: AppCadiUsuarioRecord[];
  tarifasFlete: AppCadiTarifasFlete;
  configuracion: AppCadiConfiguracion;
  auditoria: AppCadiAuditRecord[];
}

function isGeneralAdmin(session: { username: string; role: string } | null): boolean {
  if (!session) return false;
  const user = String(session.username || "").trim().toLowerCase();
  if (user === GENERAL_ADMIN_USERNAME) return true;
  return normalizeErpRole(session.role, user) === "Administrador General";
}

function buildInitialAppCadiDoc(): AppCadiDoc {
  const nowIso = new Date().toISOString();

  return {
    updatedAt: nowIso,
    tarifasFlete: {
      costoBaseFleteArs: 18000,
      costoPorKmArs: 1400,
      radioMaximoKm: 180,
      comisionPlataformaPct: 3.5,
    },
    configuracion: {
      nombreApp: "AppCaDi - Campo Directo",
      slogan: "El DiDi Rural de los Insumos Agropecuarios",
      soporteWhatsApp: "+5493585095475",
      notificacionesPushActivas: true,
      monedaDefault: "ARS",
      modoOperativo: "online",
      actualizadoEl: nowIso,
      actualizadoPor: "danielg",
    },
    usuarios: [
      {
        id: "usr-prod-01",
        nombre: "Esteban Rossi",
        telefono: "+54 9 358 4112233",
        email: "esteban.rossi@elombu.com.ar",
        tipo: "productor",
        nivel: "general",
        nombreEstablecimiento: "Estancia El Ombú",
        localidad: "Río Cuarto",
        provincia: "Córdoba",
        cuitRenspa: "20-28945612-4 / 04.056.0.01234",
        latitud: -33.1235,
        longitud: -64.3492,
        estado: "activo",
        fechaRegistro: "2026-09-10T14:20:00Z",
      },
      {
        id: "usr-agro-02",
        nombre: "Agronomía del Sur S.A.",
        telefono: "+54 9 358 5556677",
        email: "ventas@agronomiasur.com.ar",
        tipo: "vendedor",
        nivel: "general",
        nombreEstablecimiento: "Casa Central Agronomía del Sur",
        localidad: "Sampacho",
        provincia: "Córdoba",
        cuitRenspa: "30-71123456-9",
        latitud: -33.3831,
        longitud: -64.7214,
        estado: "activo",
        fechaRegistro: "2026-09-08T09:15:00Z",
      },
      {
        id: "usr-vecino-03",
        nombre: "Mariano Carrizo",
        telefono: "+54 9 358 6334455",
        email: "marianocarrizo@campo.com.ar",
        tipo: "mixto",
        nivel: "general",
        nombreEstablecimiento: "La Rinconada (Productor Vecino)",
        localidad: "Holmberg",
        provincia: "Córdoba",
        cuitRenspa: "20-31456789-3 / 04.056.0.05678",
        latitud: -33.2081,
        longitud: -64.4456,
        estado: "activo",
        fechaRegistro: "2026-09-12T11:45:00Z",
      },
      {
        id: "usr-prod-04",
        nombre: "Federico Benítez",
        telefono: "+54 9 358 4998877",
        email: "benitez.f@laprimavera.com",
        tipo: "productor",
        nivel: "general",
        nombreEstablecimiento: "Establecimiento La Primavera",
        localidad: "Coronel Moldes",
        provincia: "Córdoba",
        cuitRenspa: "20-25678901-2 / 04.078.0.09876",
        latitud: -33.6212,
        longitud: -64.5982,
        estado: "activo",
        fechaRegistro: "2026-09-14T16:10:00Z",
      },
    ],
    insumos: [
      {
        id: "ins-01",
        vendedorId: "usr-agro-02",
        vendedorNombre: "Agronomía del Sur S.A.",
        vendedorTelefono: "+54 9 358 5556677",
        vendedorEstablecimiento: "Casa Central Agronomía del Sur",
        esProductorVecino: false,
        nombre: "Glifosato 66% Granulado Premium",
        marca: "Roundup Controlmax",
        categoria: "agroquimicos",
        descripcion: "Herbicida sistémico no selectivo para control de malezas en barbecho químico. Bolsas de 15 kg hidrosolubles.",
        precioUnitario: 145000,
        moneda: "ARS",
        stockDisponible: 120,
        unidadMedida: "Bolsas 15kg",
        latitud: -33.3831,
        longitud: -64.7214,
        ubicacionTexto: "Ruta 8 Km 650, Sampacho (Córdoba)",
        estado: "activo",
        fechaPublicacion: "2026-09-15T10:00:00Z",
      },
      {
        id: "ins-02",
        vendedorId: "usr-vecino-03",
        vendedorNombre: "Mariano Carrizo",
        vendedorTelefono: "+54 9 358 6334455",
        vendedorEstablecimiento: "La Rinconada (Productor Vecino)",
        esProductorVecino: true,
        nombre: "Semillas de Maíz DK 72-10 VT3P",
        marca: "Dekalb",
        categoria: "semillas",
        descripcion: "Excedente de siembra de 1ra. Excelente germinación y vigor comprobado. Almacenadas en galpón seco.",
        precioUnitario: 240,
        moneda: "USD",
        stockDisponible: 45,
        unidadMedida: "Bolsas 80.000 semillas",
        latitud: -33.2081,
        longitud: -64.4456,
        ubicacionTexto: "Camino rural a 12 km de Holmberg",
        estado: "activo",
        fechaPublicacion: "2026-09-15T14:30:00Z",
      },
      {
        id: "ins-03",
        vendedorId: "usr-agro-02",
        vendedorNombre: "Agronomía del Sur S.A.",
        vendedorTelefono: "+54 9 358 5556677",
        vendedorEstablecimiento: "Casa Central Agronomía del Sur",
        esProductorVecino: false,
        nombre: "Fertilizante UREA Granulada 46-0-0",
        marca: "Profertil",
        categoria: "fertilizantes",
        descripcion: "Fertilizante nitrogenado de alta concentración. Granulometría uniforme para aplicación al voleo o en línea.",
        precioUnitario: 620000,
        moneda: "ARS",
        stockDisponible: 28,
        unidadMedida: "Big Bags 1.000 kg",
        latitud: -33.3831,
        longitud: -64.7214,
        ubicacionTexto: "Ruta 8 Km 650, Sampacho (Córdoba)",
        estado: "activo",
        fechaPublicacion: "2026-09-16T08:15:00Z",
      },
      {
        id: "ins-04",
        vendedorId: "usr-vecino-03",
        vendedorNombre: "Mariano Carrizo",
        vendedorTelefono: "+54 9 358 6334455",
        vendedorEstablecimiento: "La Rinconada (Productor Vecino)",
        esProductorVecino: true,
        nombre: "Electrificador Solar Dual 40 km",
        marca: "Boyero Rural Boy",
        categoria: "boyerosAlambrados",
        descripcion: "Boyero solar con panel de 10W y batería incorporada. Impecable estado, usado solo 1 campaña.",
        precioUnitario: 215000,
        moneda: "ARS",
        stockDisponible: 2,
        unidadMedida: "Unidades",
        latitud: -33.2081,
        longitud: -64.4456,
        ubicacionTexto: "Camino rural a 12 km de Holmberg",
        estado: "activo",
        fechaPublicacion: "2026-09-17T11:00:00Z",
      },
      {
        id: "ins-05",
        vendedorId: "usr-agro-02",
        vendedorNombre: "Agronomía del Sur S.A.",
        vendedorTelefono: "+54 9 358 5556677",
        vendedorEstablecimiento: "Casa Central Agronomía del Sur",
        esProductorVecino: false,
        nombre: "Aceite Agrícola Coadyuvante Metilado",
        marca: "Rizobacter Rizospray",
        categoria: "combustiblesLubricantes",
        descripcion: "Aceite vegetal metilado emulsionable para aplicaciones terrestres y aéreas. Antievaporante y penetrante.",
        precioUnitario: 98000,
        moneda: "ARS",
        stockDisponible: 60,
        unidadMedida: "Bidones 20 Litros",
        latitud: -33.3831,
        longitud: -64.7214,
        ubicacionTexto: "Ruta 8 Km 650, Sampacho (Córdoba)",
        estado: "activo",
        fechaPublicacion: "2026-09-17T15:20:00Z",
      },
      {
        id: "ins-06",
        vendedorId: "usr-agro-02",
        vendedorNombre: "Agronomía del Sur S.A.",
        vendedorTelefono: "+54 9 358 5556677",
        vendedorEstablecimiento: "Casa Central Agronomía del Sur",
        esProductorVecino: false,
        nombre: "Ivermectina 3.15% Larga Acción",
        marca: "Biogénesis Bagó",
        categoria: "sanidadVeterinaria",
        descripcion: "Endectocida inyectable para bovinos. Tratamiento y control prolongado de parásitos internos y externos.",
        precioUnitario: 84000,
        moneda: "ARS",
        stockDisponible: 35,
        unidadMedida: "Frascos 500 ml",
        latitud: -33.3831,
        longitud: -64.7214,
        ubicacionTexto: "Ruta 8 Km 650, Sampacho (Córdoba)",
        estado: "activo",
        fechaPublicacion: "2026-09-18T09:30:00Z",
      },
    ],
    pedidos: [
      {
        id: "ped-101",
        numeroPedido: "CD-2026-00101",
        insumoId: "ins-02",
        insumoNombre: "Semillas de Maíz DK 72-10 VT3P",
        marca: "Dekalb",
        categoria: "semillas",
        cantidad: 10,
        unidadMedida: "Bolsas 80.000 semillas",
        precioUnitario: 240,
        subtotalInsumo: 2400,
        costoFlete: 42000,
        total: 2400,
        moneda: "USD",
        compradorId: "usr-prod-01",
        compradorNombre: "Esteban Rossi",
        compradorTelefono: "+54 9 358 4112233",
        compradorEstablecimiento: "Estancia El Ombú",
        compradorLat: -33.1235,
        compradorLng: -64.3492,
        destinoTexto: "Ruta 30 Km 45, Río Cuarto",
        vendedorId: "usr-vecino-03",
        vendedorNombre: "Mariano Carrizo",
        vendedorTelefono: "+54 9 358 6334455",
        vendedorEstablecimiento: "La Rinconada (Productor Vecino)",
        vendedorLat: -33.2081,
        vendedorLng: -64.4456,
        origenTexto: "Camino rural a 12 km de Holmberg",
        vendedorEsVecino: true,
        distanciaKm: 18.4,
        tiempoEstimadoMinutos: 35,
        estado: "enCamino",
        fechaCreacion: "2026-09-18T10:15:00Z",
        fechaActualizacion: "2026-09-18T11:00:00Z",
      },
      {
        id: "ped-102",
        numeroPedido: "CD-2026-00102",
        insumoId: "ins-01",
        insumoNombre: "Glifosato 66% Granulado Premium",
        marca: "Roundup Controlmax",
        categoria: "agroquimicos",
        cantidad: 8,
        unidadMedida: "Bolsas 15kg",
        precioUnitario: 145000,
        subtotalInsumo: 1160000,
        costoFlete: 62000,
        total: 1222000,
        moneda: "ARS",
        compradorId: "usr-prod-04",
        compradorNombre: "Federico Benítez",
        compradorTelefono: "+54 9 358 4998877",
        compradorEstablecimiento: "Establecimiento La Primavera",
        compradorLat: -33.6212,
        compradorLng: -64.5982,
        destinoTexto: "Acceso Coronel Moldes Sur",
        vendedorId: "usr-agro-02",
        vendedorNombre: "Agronomía del Sur S.A.",
        vendedorTelefono: "+54 9 358 5556677",
        vendedorEstablecimiento: "Casa Central Agronomía del Sur",
        vendedorLat: -33.3831,
        vendedorLng: -64.7214,
        origenTexto: "Ruta 8 Km 650, Sampacho (Córdoba)",
        vendedorEsVecino: false,
        distanciaKm: 34.6,
        tiempoEstimadoMinutos: 50,
        estado: "confirmado",
        fechaCreacion: "2026-09-18T14:40:00Z",
        fechaActualizacion: "2026-09-18T15:05:00Z",
      },
      {
        id: "ped-103",
        numeroPedido: "CD-2026-00103",
        insumoId: "ins-04",
        insumoNombre: "Electrificador Solar Dual 40 km",
        marca: "Boyero Rural Boy",
        categoria: "boyerosAlambrados",
        cantidad: 1,
        unidadMedida: "Unidades",
        precioUnitario: 215000,
        subtotalInsumo: 215000,
        costoFlete: 25000,
        total: 240000,
        moneda: "ARS",
        compradorId: "usr-prod-01",
        compradorNombre: "Esteban Rossi",
        compradorTelefono: "+54 9 358 4112233",
        compradorEstablecimiento: "Estancia El Ombú",
        compradorLat: -33.1235,
        compradorLng: -64.3492,
        destinoTexto: "Ruta 30 Km 45, Río Cuarto",
        vendedorId: "usr-vecino-03",
        vendedorNombre: "Mariano Carrizo",
        vendedorTelefono: "+54 9 358 6334455",
        vendedorEstablecimiento: "La Rinconada (Productor Vecino)",
        vendedorLat: -33.2081,
        vendedorLng: -64.4456,
        origenTexto: "Camino rural a 12 km de Holmberg",
        vendedorEsVecino: true,
        distanciaKm: 18.4,
        tiempoEstimadoMinutos: 35,
        estado: "entregado",
        fechaCreacion: "2026-09-17T09:20:00Z",
        fechaActualizacion: "2026-09-17T12:45:00Z",
      },
    ],
    auditoria: [
      {
        id: "aud-01",
        fecha: "2026-09-15T10:00:00Z",
        usuario: "danielg",
        accion: "Inicialización del Módulo",
        detalle: "Se activó el Módulo Maestro de Gestión AppCaDi en MiniSistema.",
      },
      {
        id: "aud-02",
        fecha: "2026-09-18T11:00:00Z",
        usuario: "danielg",
        accion: "Despacho de Pedido CD-2026-00101",
        detalle: "El pedido de semillas cambió a estado 'En Camino al Campo'.",
      },
    ],
  };
}

export async function handleErpAppCadi(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const session = extractErpSessionFromRequest(req, tenant.slug);
  if (!isGeneralAdmin(session)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Acceso exclusivo del Administrador General de MiniSistema para gestionar AppCaDi.",
      },
      { status: 403 }
    );
  }

  const actor = session?.username || GENERAL_ADMIN_USERNAME;
  const initialDoc = buildInitialAppCadiDoc();

  let docPayload: AppCadiDoc;
  try {
    const fetched = await getTenantDoc<AppCadiDoc>(tenant, APPCADI_DOC_KEY, initialDoc);
    docPayload = fetched && fetched.payload ? fetched.payload : initialDoc;
    if (!docPayload.insumos || !docPayload.pedidos) {
      docPayload = initialDoc;
      await putTenantDoc(tenant, APPCADI_DOC_KEY, docPayload);
    }
  } catch (_e) {
    docPayload = initialDoc;
  }

  if (req.method === "GET") {
    // Calcular estadísticas en tiempo real
    const insumosTotales = docPayload.insumos.length;
    const insumosActivos = docPayload.insumos.filter((i) => i.estado === "activo").length;
    const pedidosTotales = docPayload.pedidos.length;
    const pedidosEnCurso = docPayload.pedidos.filter(
      (p) => p.estado === "solicitado" || p.estado === "confirmado" || p.estado === "enCamino"
    ).length;
    const pedidosEntregados = docPayload.pedidos.filter((p) => p.estado === "entregado").length;
    const usuariosTotales = docPayload.usuarios.length;
    const productoresCount = docPayload.usuarios.filter(
      (u) => u.tipo === "productor" || u.tipo === "mixto"
    ).length;
    const agronomiasCount = docPayload.usuarios.filter(
      (u) => u.tipo === "vendedor" || u.tipo === "mixto"
    ).length;

    let volumenArs = 0;
    let volumenUsd = 0;
    for (const ped of docPayload.pedidos) {
      if (ped.estado === "entregado" || ped.estado === "enCamino" || ped.estado === "confirmado") {
        if (ped.moneda === "USD") {
          volumenUsd += ped.subtotalInsumo;
        } else {
          volumenArs += ped.total;
        }
      }
    }

    const comisionArs = (volumenArs * (docPayload.tarifasFlete.comisionPlataformaPct || 3.5)) / 100;
    const comisionUsd = (volumenUsd * (docPayload.tarifasFlete.comisionPlataformaPct || 3.5)) / 100;

    return NextResponse.json({
      ok: true,
      data: docPayload,
      metrics: {
        insumosTotales,
        insumosActivos,
        pedidosTotales,
        pedidosEnCurso,
        pedidosEntregados,
        usuariosTotales,
        productoresCount,
        agronomiasCount,
        volumenArs,
        volumenUsd,
        comisionArs,
        comisionUsd,
      },
    });
  }

  if (req.method === "POST") {
    try {
      const body = (await req.json()) as AnyObj;
      const action = String(body.action || "").trim();
      const nowIso = new Date().toISOString();

      switch (action) {
        case "save_insumo": {
          const insumoData = body.insumo as Partial<AppCadiInsumoRecord>;
          if (!insumoData || !insumoData.nombre || !insumoData.categoria) {
            return NextResponse.json(
              { ok: false, message: "Faltan datos obligatorios del insumo agropecuario." },
              { status: 400 }
            );
          }

          const id = insumoData.id || `ins-${Date.now()}`;
          const index = docPayload.insumos.findIndex((i) => i.id === id);

          const nuevoInsumo: AppCadiInsumoRecord = {
            id,
            vendedorId: String(insumoData.vendedorId || "usr-agro-02"),
            vendedorNombre: String(insumoData.vendedorNombre || "Vendedor CaDi"),
            vendedorTelefono: String(insumoData.vendedorTelefono || "+54 9 358 5095475"),
            vendedorEstablecimiento: String(insumoData.vendedorEstablecimiento || "Establecimiento Rural"),
            esProductorVecino: Boolean(insumoData.esProductorVecino),
            nombre: String(insumoData.nombre).trim(),
            marca: String(insumoData.marca || "Genérica").trim(),
            categoria: insumoData.categoria as AppCadiInsumoRecord["categoria"],
            descripcion: String(insumoData.descripcion || "").trim(),
            precioUnitario: Number(insumoData.precioUnitario) || 0,
            moneda: insumoData.moneda === "USD" ? "USD" : "ARS",
            stockDisponible: Number(insumoData.stockDisponible) || 0,
            unidadMedida: String(insumoData.unidadMedida || "Unidades").trim(),
            latitud: Number(insumoData.latitud) || -33.1235,
            longitud: Number(insumoData.longitud) || -64.3492,
            ubicacionTexto: String(insumoData.ubicacionTexto || "Zona Rural").trim(),
            estado: (insumoData.estado as AppCadiInsumoRecord["estado"]) || "activo",
            fechaPublicacion: insumoData.fechaPublicacion || nowIso,
          };

          if (index >= 0) {
            docPayload.insumos[index] = nuevoInsumo;
          } else {
            docPayload.insumos.unshift(nuevoInsumo);
          }

          docPayload.auditoria.unshift({
            id: `aud-${Date.now()}`,
            fecha: nowIso,
            usuario: actor,
            accion: index >= 0 ? "Actualización de Insumo" : "Alta de Insumo",
            detalle: `${nuevoInsumo.nombre} (${nuevoInsumo.marca}) - ${nuevoInsumo.categoria}`,
          });

          docPayload.updatedAt = nowIso;
          await putTenantDoc(tenant, APPCADI_DOC_KEY, docPayload);
          return NextResponse.json({ ok: true, insumo: nuevoInsumo, message: "Insumo guardado correctamente." });
        }

        case "toggle_insumo_estado": {
          const id = String(body.id || "");
          const target = docPayload.insumos.find((i) => i.id === id);
          if (!target) {
            return NextResponse.json({ ok: false, message: "Insumo no encontrado." }, { status: 404 });
          }

          target.estado = target.estado === "activo" ? "pausado" : "activo";
          docPayload.auditoria.unshift({
            id: `aud-${Date.now()}`,
            fecha: nowIso,
            usuario: actor,
            accion: "Cambio de Estado Insumo",
            detalle: `Insumo ${target.nombre} pasó a estado '${target.estado}'.`,
          });

          docPayload.updatedAt = nowIso;
          await putTenantDoc(tenant, APPCADI_DOC_KEY, docPayload);
          return NextResponse.json({ ok: true, estado: target.estado, message: `Insumo ${target.estado}.` });
        }

        case "delete_insumo": {
          const id = String(body.id || "");
          const prevLen = docPayload.insumos.length;
          docPayload.insumos = docPayload.insumos.filter((i) => i.id !== id);
          if (docPayload.insumos.length === prevLen) {
            return NextResponse.json({ ok: false, message: "Insumo no encontrado." }, { status: 404 });
          }

          docPayload.auditoria.unshift({
            id: `aud-${Date.now()}`,
            fecha: nowIso,
            usuario: actor,
            accion: "Eliminación de Insumo",
            detalle: `Se dio de baja el insumo con ID ${id}.`,
          });

          docPayload.updatedAt = nowIso;
          await putTenantDoc(tenant, APPCADI_DOC_KEY, docPayload);
          return NextResponse.json({ ok: true, message: "Insumo eliminado del catálogo." });
        }

        case "update_pedido_estado": {
          const id = String(body.id || "");
          const nuevoEstado = String(body.estado || "") as AppCadiPedidoRecord["estado"];
          const motivo = String(body.motivo || "").trim();

          const target = docPayload.pedidos.find((p) => p.id === id);
          if (!target) {
            return NextResponse.json({ ok: false, message: "Pedido no encontrado." }, { status: 404 });
          }

          const estadoAnterior = target.estado;
          target.estado = nuevoEstado;
          target.fechaActualizacion = nowIso;
          if (motivo) target.motivoCancelacion = motivo;

          docPayload.auditoria.unshift({
            id: `aud-${Date.now()}`,
            fecha: nowIso,
            usuario: actor,
            accion: `Avance Pedido ${target.numeroPedido}`,
            detalle: `Estado cambió de '${estadoAnterior}' a '${nuevoEstado}'. ${motivo ? "Motivo: " + motivo : ""}`,
          });

          docPayload.updatedAt = nowIso;
          await putTenantDoc(tenant, APPCADI_DOC_KEY, docPayload);
          return NextResponse.json({ ok: true, pedido: target, message: `Pedido actualizado a ${nuevoEstado}.` });
        }

        case "save_usuario": {
          const usrData = body.usuario as Partial<AppCadiUsuarioRecord>;
          if (!usrData || !usrData.nombre || !usrData.telefono) {
            return NextResponse.json(
              { ok: false, message: "Faltan datos obligatorios del usuario." },
              { status: 400 }
            );
          }

          const id = usrData.id || `usr-${Date.now()}`;
          const index = docPayload.usuarios.findIndex((u) => u.id === id);

          const nuevoUsuario: AppCadiUsuarioRecord = {
            id,
            nombre: String(usrData.nombre).trim(),
            telefono: String(usrData.telefono).trim(),
            email: String(usrData.email || "").trim(),
            tipo: (usrData.tipo as AppCadiUsuarioRecord["tipo"]) || "productor",
            nivel: (usrData.nivel as AppCadiUsuarioRecord["nivel"]) || "general",
            nombreEstablecimiento: String(usrData.nombreEstablecimiento || "Campo / Local").trim(),
            localidad: String(usrData.localidad || "Zona Rural").trim(),
            provincia: String(usrData.provincia || "Córdoba").trim(),
            cuitRenspa: String(usrData.cuitRenspa || "").trim(),
            latitud: Number(usrData.latitud) || -33.1235,
            longitud: Number(usrData.longitud) || -64.3492,
            estado: (usrData.estado as AppCadiUsuarioRecord["estado"]) || "activo",
            fechaRegistro: usrData.fechaRegistro || nowIso,
          };

          if (index >= 0) {
            docPayload.usuarios[index] = nuevoUsuario;
          } else {
            docPayload.usuarios.unshift(nuevoUsuario);
          }

          docPayload.auditoria.unshift({
            id: `aud-${Date.now()}`,
            fecha: nowIso,
            usuario: actor,
            accion: index >= 0 ? "Actualización de Usuario" : "Alta de Usuario",
            detalle: `${nuevoUsuario.nombre} (${nuevoUsuario.nombreEstablecimiento}) - Rol: ${nuevoUsuario.tipo}`,
          });

          docPayload.updatedAt = nowIso;
          await putTenantDoc(tenant, APPCADI_DOC_KEY, docPayload);
          return NextResponse.json({ ok: true, usuario: nuevoUsuario, message: "Usuario guardado correctamente." });
        }

        case "toggle_usuario_estado": {
          const id = String(body.id || "");
          const target = docPayload.usuarios.find((u) => u.id === id);
          if (!target) {
            return NextResponse.json({ ok: false, message: "Usuario no encontrado." }, { status: 404 });
          }

          target.estado = target.estado === "activo" ? "suspendido" : "activo";
          docPayload.auditoria.unshift({
            id: `aud-${Date.now()}`,
            fecha: nowIso,
            usuario: actor,
            accion: "Cambio de Estado Usuario",
            detalle: `Usuario ${target.nombre} pasó a estado '${target.estado}'.`,
          });

          docPayload.updatedAt = nowIso;
          await putTenantDoc(tenant, APPCADI_DOC_KEY, docPayload);
          return NextResponse.json({ ok: true, estado: target.estado, message: `Usuario ${target.estado}.` });
        }

        case "save_config": {
          if (body.tarifasFlete) {
            docPayload.tarifasFlete = {
              costoBaseFleteArs: Number(body.tarifasFlete.costoBaseFleteArs) || 18000,
              costoPorKmArs: Number(body.tarifasFlete.costoPorKmArs) || 1400,
              radioMaximoKm: Number(body.tarifasFlete.radioMaximoKm) || 180,
              comisionPlataformaPct: Number(body.tarifasFlete.comisionPlataformaPct) || 3.5,
            };
          }

          if (body.configuracion) {
            docPayload.configuracion = {
              ...docPayload.configuracion,
              nombreApp: String(body.configuracion.nombreApp || docPayload.configuracion.nombreApp),
              slogan: String(body.configuracion.slogan || docPayload.configuracion.slogan),
              soporteWhatsApp: String(body.configuracion.soporteWhatsApp || docPayload.configuracion.soporteWhatsApp),
              notificacionesPushActivas: Boolean(body.configuracion.notificacionesPushActivas),
              monedaDefault: body.configuracion.monedaDefault === "USD" ? "USD" : "ARS",
              modoOperativo: body.configuracion.modoOperativo === "mantenimiento" ? "mantenimiento" : "online",
              actualizadoEl: nowIso,
              actualizadoPor: actor,
            };
          }

          docPayload.auditoria.unshift({
            id: `aud-${Date.now()}`,
            fecha: nowIso,
            usuario: actor,
            accion: "Configuración Actualizada",
            detalle: `Se actualizaron las tarifas de flete y parámetros operativos de AppCaDi.`,
          });

          docPayload.updatedAt = nowIso;
          await putTenantDoc(tenant, APPCADI_DOC_KEY, docPayload);
          return NextResponse.json({ ok: true, message: "Configuración y tarifas guardadas correctamente." });
        }

        case "reset_demo_data": {
          docPayload = buildInitialAppCadiDoc();
          docPayload.auditoria.unshift({
            id: `aud-${Date.now()}`,
            fecha: nowIso,
            usuario: actor,
            accion: "Restablecer Datos Demo",
            detalle: "Se restableció el catálogo de insumos, pedidos y productores de demostración.",
          });
          await putTenantDoc(tenant, APPCADI_DOC_KEY, docPayload);
          return NextResponse.json({ ok: true, message: "Datos de AppCaDi restablecidos a valores iniciales." });
        }

        default:
          return NextResponse.json(
            { ok: false, message: `Acción no soportada en AppCaDi: ${action}` },
            { status: 400 }
          );
      }
    } catch (err) {
      console.error("[AppCaDi Handler POST Error]", err);
      return NextResponse.json(
        { ok: false, message: err instanceof Error ? err.message : "Error procesando solicitud de AppCaDi." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: false, message: "Método no permitido." }, { status: 405 });
}
