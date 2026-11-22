import type {
  ServiciosDatabase,
  ServicioCatalogoItem,
  ServicioConfig,
} from "./servicios-types";

export function buildDefaultServicioConfig(): ServicioConfig {
  return {
    actividadNegocio: "mixta",
    unidadesPersonalizadas: [],
    monedaDefault: "ARS",
    ivaDefaultPct: 21,
    validezPresupuestoDias: 15,
    condicionesComercialesDefault:
      "Precios expresados en moneda indicada. Plazo de pago: 30 días fecha factura. Validez de oferta: 15 días corridos.",
    requiereAprobacionAdminFacturacion: false,
    prefijoPresupuesto: "PRES",
    prefijoOt: "OT",
    prefijoParte: "PS",
    prefijoAbono: "AB",
    nextPresupuestoSeq: 1,
    nextOtSeq: 1,
    nextParteSeq: 1,
    nextAbonoSeq: 1,
  };
}

export function buildCleanServiciosDb(): ServiciosDatabase {
  const now = new Date().toISOString();
  return {
    version: 1,
    updatedAt: now,
    config: buildDefaultServicioConfig(),
    clientProfiles: {},
    catalogo: [],
    presupuestos: [],
    ordenesTrabajo: [],
    partesServicio: [],
    documentos: [],
    personal: [],
    abonos: [],
    facturasVinculadas: [],
  };
}

/**
 * Escenario inicial de validación (Sección 6):
 * Empresa de Inspecciones y Ensayos No Destructivos (END) en Comodoro Rivadavia.
 * NO sobreescribe registros existentes; solo agrega los registros de prueba si aún no existen.
 */
export function buildComodoroEndDemoPayload(params: {
  solicitanteClientId: number;
  solicitanteNombre: string;
  facturarAClientId: number;
  facturarANombre: string;
  actor: string;
}) {
  const now = new Date().toISOString();
  const todayIso = now.slice(0, 10);
  const plus15 = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
  const plus3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  const srvUltrasonido: ServicioCatalogoItem = {
    id: "srv_demo_end_ut",
    codigo: "END-UT-01",
    nombre: "Inspección por Ultrasonido (UT) en Soldaduras",
    descripcion:
      "Ensayo no destructivo por ultrasonido haz angular/normal según ASME Sec. V y API 1104 en juntas soldadas de cañerías y recipientes.",
    categoria: "Ensayos No Destructivos (END)",
    unidadMedida: "Inspección",
    precioBase: 48500,
    costoEstimado: 19500,
    moneda: "ARS",
    ivaPct: 21,
    duracionEstimadaMin: 35,
    activo: true,
    observaciones: "Incluye calibración de equipo, acoplante y emisión de informe técnico.",
    formasCotizacion: [
      { unidad: "Inspección", precio: 48500, moneda: "ARS" },
      { unidad: "Jornada", precio: 460000, moneda: "ARS" },
      { unidad: "Hora", precio: 68000, moneda: "ARS" },
    ],
    historialTarifas: [
      {
        at: now,
        by: params.actor,
        precioAnterior: 0,
        precioNuevo: 48500,
        moneda: "ARS",
        motivo: "Alta inicial en catálogo de servicios",
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const srvParticulas: ServicioCatalogoItem = {
    id: "srv_demo_end_mt",
    codigo: "END-MT-02",
    nombre: "Inspección por Partículas Magnetizables (MT)",
    descripcion:
      "Detección de discontinuidades superficiales y subsuperficiales en materiales ferromagnéticos mediante yugo electromagnético.",
    categoria: "Ensayos No Destructivos (END)",
    unidadMedida: "Inspección",
    precioBase: 36000,
    costoEstimado: 14000,
    moneda: "ARS",
    ivaPct: 21,
    duracionEstimadaMin: 25,
    activo: true,
    observaciones: "Apto para campo e instalaciones industriales.",
    formasCotizacion: [
      { unidad: "Inspección", precio: 36000, moneda: "ARS" },
      { unidad: "Jornada", precio: 380000, moneda: "ARS" },
    ],
    historialTarifas: [],
    createdAt: now,
    updatedAt: now,
  };

  const srvAbonoMensual: ServicioCatalogoItem = {
    id: "srv_demo_mant_ab",
    codigo: "MANT-AB-01",
    nombre: "Abono Mensual de Asistencia e Inspección Preventiva",
    descripcion:
      "Plan mensual de visitas técnicas programadas, medición de espesores y seguimiento de integridad mecánica.",
    categoria: "Mantenimiento e Integridad",
    unidadMedida: "Abono mensual",
    precioBase: 620000,
    costoEstimado: 250000,
    moneda: "ARS",
    ivaPct: 21,
    duracionEstimadaMin: 480,
    activo: true,
    observaciones: "Facturación recurrente mensual con actualización trimestral.",
    formasCotizacion: [{ unidad: "Abono mensual", precio: 620000, moneda: "ARS" }],
    historialTarifas: [],
    createdAt: now,
    updatedAt: now,
  };

  const inspector = {
    id: "pers_demo_inspector_1",
    linkedAsistenciaEmployeeId: null,
    nombre: "Ing. Martín Pereyra",
    dni: "32456789",
    especialidad: "Inspector END Nivel II — Ultrasonido (UT) y Partículas (MT)",
    matricula: "IRAM-ISO 9712 UT-II #4821 · ASNT SNT-TC-1A",
    habilitaciones: "Ingreso a yacimientos Cuenca del Golfo San Jorge · Trabajo en altura",
    certificaciones: "UT Nivel II vigente 2027 · MT Nivel II vigente 2027 · H2S",
    costoHora: 26500,
    telefono: "+54 9 297 412-8890",
    email: "m.pereyra@inspecciones-cr.com.ar",
    activo: true,
    createdAt: now,
    updatedAt: now,
  };

  // 15 soldaduras × $48.500 = $727.500 neto + Traslado $95.000 + Viáticos $65.000 = $887.500 neto ($1.073.875 c/IVA 21%)
  const lineaUtNeto = 15 * 48500;
  const lineaUtTotal = Math.round(lineaUtNeto * 1.21 * 100) / 100;
  const gastoTrasladoNeto = 95000;
  const gastoTrasladoTotal = Math.round(gastoTrasladoNeto * 1.21 * 100) / 100;
  const gastoViaticosNeto = 65000;
  const gastoViaticosTotal = Math.round(gastoViaticosNeto * 1.21 * 100) / 100;
  const subNeto = lineaUtNeto + gastoTrasladoNeto + gastoViaticosNeto;
  const totalGeneral = Math.round((lineaUtTotal + gastoTrasladoTotal + gastoViaticosTotal) * 100) / 100;
  const totalIva = Math.round((totalGeneral - subNeto) * 100) / 100;

  return {
    servicios: [srvUltrasonido, srvParticulas, srvAbonoMensual],
    inspector,
    presupuesto: {
      id: "pres_demo_end_15",
      numero: "PRES-00001",
      version: 1,
      fecha: todayIso,
      vigenteHasta: plus15,
      estado: "aprobado" as const,
      clientId: params.solicitanteClientId,
      clientNombre: params.solicitanteNombre,
      billingClientId: params.facturarAClientId,
      billingClientNombre: params.facturarANombre,
      establecimientoNombre: "Planta Compresora Kilómetro 8 — Comodoro Rivadavia",
      establecimientoDireccion: "Ruta Nacional 3 Km 1832, Comodoro Rivadavia, Chubut",
      moneda: "ARS" as const,
      items: [
        {
          id: "pl_demo_ut_15",
          servicioId: srvUltrasonido.id,
          codigo: srvUltrasonido.codigo,
          nombre: srvUltrasonido.nombre,
          descripcion: "Inspección de 15 soldaduras en línea de alta presión 8\" Sch 80",
          unidadMedida: "Inspección",
          cantidad: 15,
          precioUnitario: 48500,
          descuentoPct: 0,
          ivaPct: 21,
          subtotalNeto: lineaUtNeto,
          totalConIva: lineaUtTotal,
        },
      ],
      gastosAdicionales: [
        {
          id: "ga_demo_traslado",
          concepto: "Traslado camioneta 4x4 equipada a Planta Km 8 (ida y vuelta)",
          cantidad: 1,
          precioUnitario: gastoTrasladoNeto,
          ivaPct: 21,
          totalConIva: gastoTrasladoTotal,
        },
        {
          id: "ga_demo_viaticos",
          concepto: "Viáticos y refrigerio equipo técnico en campo",
          cantidad: 1,
          precioUnitario: gastoViaticosNeto,
          ivaPct: 21,
          totalConIva: gastoViaticosTotal,
        },
      ],
      descuentoGlobalPct: 0,
      subtotalNeto: subNeto,
      totalIva,
      totalGeneral,
      condicionesComerciales:
        "Orden de Compra requerida previo a facturación. Pago a 30 días fecha factura vía transferencia bancaria.",
      observaciones:
        "Caso de validación: Cliente solicitante distinto al establecimiento intervenido y a la razón social destinataria de la factura.",
      adjuntos: [],
      convertedOtId: "ot_demo_end_15",
      versionHistory: [
        {
          version: 1,
          savedAt: now,
          savedBy: params.actor,
          total: totalGeneral,
          estado: "aprobado" as const,
          nota: "Versión inicial aprobada por cliente",
        },
      ],
      auditLog: [
        {
          at: now,
          by: params.actor,
          action: "created",
          detail: "Presupuesto de validación END (15 soldaduras UT) creado y aprobado",
        },
      ],
      createdAt: now,
      createdBy: params.actor,
      updatedAt: now,
    },
    ordenTrabajo: {
      id: "ot_demo_end_15",
      numero: "OT-00001",
      estado: "en_ejecucion" as const,
      estadoFacturacion: "pendiente" as const,
      presupuestoId: "pres_demo_end_15",
      presupuestoNumero: "PRES-00001",
      clientId: params.solicitanteClientId,
      clientNombre: params.solicitanteNombre,
      billingClientId: params.facturarAClientId,
      billingClientNombre: params.facturarANombre,
      ordenCompraCliente: "OC-CR-2026-0418",
      fechaSolicitud: todayIso,
      fechaPrevista: plus3,
      lugarTrabajo: "Planta Compresora Kilómetro 8 — Comodoro Rivadavia",
      domicilioTrabajo: "Ruta Nacional 3 Km 1832, Comodoro Rivadavia, Chubut",
      equipoInstalacion: "Colector de impulsión 8\" Sch 80 — 15 juntas soldadas (J-01 a J-15)",
      descripcionTrabajo:
        "Ensayo por ultrasonido (UT) sobre 15 soldaduras circunferenciales según ASME Sec. V, emisión de informe técnico y conformidad en sitio.",
      personalAsignadoIds: [inspector.id],
      duracionEstimadaHoras: 9,
      materialesRecursos: "Equipo UT digital calibrado, bloque patrón IIW-V1, palpadores 45°/60°/70°, gel acoplante, EPP ignífugo.",
      instruccionesEspeciales: "Presentarse en portería 07:30 hs con seguro ART y habilitación de yacimiento vigente.",
      moneda: "ARS" as const,
      items: [
        {
          id: "otl_demo_ut_15",
          servicioId: srvUltrasonido.id,
          codigo: srvUltrasonido.codigo,
          nombre: srvUltrasonido.nombre,
          unidadMedida: "Inspección",
          cantidadPrevista: 15,
          cantidadEjecutada: 0,
          cantidadFacturada: 0,
          precioUnitario: 48500,
          descuentoPct: 0,
          ivaPct: 21,
        },
      ],
      gastosAdicionales: [
        {
          id: "ga_demo_traslado",
          concepto: "Traslado camioneta 4x4 equipada a Planta Km 8 (ida y vuelta)",
          cantidad: 1,
          precioUnitario: gastoTrasladoNeto,
          ivaPct: 21,
          totalConIva: gastoTrasladoTotal,
        },
        {
          id: "ga_demo_viaticos",
          concepto: "Viáticos y refrigerio equipo técnico en campo",
          cantidad: 1,
          precioUnitario: gastoViaticosNeto,
          ivaPct: 21,
          totalConIva: gastoViaticosTotal,
        },
      ],
      condicionesComerciales:
        "Facturar a razón social destinataria indicando OC-CR-2026-0418. Acepta facturación parcial por avance.",
      totalPrevisto: totalGeneral,
      totalEjecutado: 0,
      totalFacturado: 0,
      saldoPendienteFacturar: totalGeneral,
      costoDirectoEstimado: 15 * 19500 + 45000,
      facturasIds: [],
      auditLog: [
        {
          at: now,
          by: params.actor,
          action: "created_from_presupuesto",
          detail: "OT generada desde PRES-00001 (15 inspecciones UT)",
        },
      ],
      createdAt: now,
      createdBy: params.actor,
      updatedAt: now,
    },
    abono: {
      id: "ab_demo_mant_1",
      codigo: "AB-0001",
      clientId: params.solicitanteClientId,
      clientNombre: params.solicitanteNombre,
      billingClientId: params.facturarAClientId,
      billingClientNombre: params.facturarANombre,
      servicioId: srvAbonoMensual.id,
      servicioNombre: srvAbonoMensual.nombre,
      descripcion: "Abono mensual de inspección preventiva de integridad mecánica en Planta Km 8",
      importe: 620000,
      moneda: "ARS" as const,
      ivaPct: 21,
      frecuencia: "mensual" as const,
      fechaInicio: todayIso,
      proximoVencimiento: todayIso,
      condicionesActualizacion: "Actualización trimestral según IPC INDEC",
      estado: "activo" as const,
      periodosGenerados: {},
      createdAt: now,
      updatedAt: now,
    },
  };
}
