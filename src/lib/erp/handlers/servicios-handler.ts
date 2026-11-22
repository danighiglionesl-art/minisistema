import { NextRequest, NextResponse } from "next/server";
import { buildCleanTenantSeed } from "../seed-clean-tenant";
import {
  buildCleanServiciosDb,
  buildComodoroEndDemoPayload,
  buildDefaultServicioConfig,
} from "../servicios-seed";
import type {
  AbonoRecurrente,
  ActividadNegocioMode,
  ClienteServicioPerfil,
  DocumentoTecnicoServicio,
  EstadoAbono,
  EstadoOrdenTrabajo,
  EstadoPresupuesto,
  FacturaVinculadaServicio,
  FrecuenciaAbono,
  GastoAdicionalServicio,
  MonedaServicio,
  OrdenTrabajo,
  OrdenTrabajoLinea,
  ParteServicio,
  PersonalServicioExt,
  PresupuestoServicio,
  ServicioCatalogoItem,
  ServicioLineaComercial,
  ServiciosDatabase,
  TipoDocumentoTecnico,
} from "../servicios-types";
import { DEFAULT_UNIDADES_FACTURACION } from "../servicios-types";
import { getPlatformSupabase, getTenantDoc, putTenantDoc } from "../supabase-server";
import type { ErpTenantRecord } from "../types";

type AnyObj = Record<string, any>;

function round2(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function round3(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function padSeq(prefix: string, n: number): string {
  return `${prefix}-${String(Math.max(1, Math.floor(n))).padStart(5, "0")}`;
}

function addMonthsIso(isoDate: string, months: number): string {
  const m = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const base = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date();
  base.setMonth(base.getMonth() + months);
  const y = base.getFullYear();
  const mo = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function frequencyToMonths(f: FrecuenciaAbono): number {
  if (f === "bimestral") return 2;
  if (f === "trimestral") return 3;
  if (f === "semestral") return 6;
  if (f === "anual") return 12;
  return 1;
}

function normalizeDb(raw: AnyObj | null | undefined): ServiciosDatabase {
  const clean = buildCleanServiciosDb();
  if (!raw || typeof raw !== "object") return clean;
  return {
    version: Number(raw.version) || 1,
    updatedAt: String(raw.updatedAt || clean.updatedAt),
    config: {
      ...buildDefaultServicioConfig(),
      ...(raw.config && typeof raw.config === "object" ? raw.config : {}),
      unidadesPersonalizadas: Array.isArray(raw.config?.unidadesPersonalizadas)
        ? raw.config.unidadesPersonalizadas
        : [],
    },
    clientProfiles:
      raw.clientProfiles && typeof raw.clientProfiles === "object"
        ? raw.clientProfiles
        : {},
    catalogo: Array.isArray(raw.catalogo) ? raw.catalogo : [],
    presupuestos: Array.isArray(raw.presupuestos) ? raw.presupuestos : [],
    ordenesTrabajo: Array.isArray(raw.ordenesTrabajo) ? raw.ordenesTrabajo : [],
    partesServicio: Array.isArray(raw.partesServicio) ? raw.partesServicio : [],
    documentos: Array.isArray(raw.documentos) ? raw.documentos : [],
    personal: Array.isArray(raw.personal) ? raw.personal : [],
    abonos: Array.isArray(raw.abonos) ? raw.abonos : [],
    facturasVinculadas: Array.isArray(raw.facturasVinculadas)
      ? raw.facturasVinculadas
      : [],
  };
}

function calcLineTotals(
  cantidad: number,
  precioUnitario: number,
  descuentoPct: number,
  ivaPct: number
) {
  const q = Math.max(0, round3(cantidad));
  const p = Math.max(0, round2(precioUnitario));
  const d = Math.min(100, Math.max(0, round2(descuentoPct)));
  const iva = Math.max(0, round2(ivaPct));
  const subtotalNeto = round2(q * p * (1 - d / 100));
  const totalConIva = round2(subtotalNeto * (1 + iva / 100));
  return { subtotalNeto, totalConIva };
}

function recomputeOtTotals(ot: OrdenTrabajo, partes: ParteServicio[]) {
  const otPartes = partes.filter((p) => p.otId === ot.id);

  // Recalcular cantidad ejecutada por línea si existen partes cargados
  if (otPartes.length > 0) {
    const execByLine = new Map<string, number>();
    for (const parte of otPartes) {
      for (const pit of parte.itemsEjecutados || []) {
        const key = String(pit.otLineId || pit.servicioId || "");
        if (!key) continue;
        execByLine.set(key, round3((execByLine.get(key) || 0) + (Number(pit.cantidadEjecutada) || 0)));
      }
    }
    for (const line of ot.items) {
      const byId = execByLine.get(line.id);
      const bySrv = execByLine.get(line.servicioId);
      if (byId !== undefined) {
        line.cantidadEjecutada = round3(byId);
      } else if (bySrv !== undefined) {
        line.cantidadEjecutada = round3(bySrv);
      }
    }
  }

  let totalPrevisto = 0;
  let totalEjecutado = 0;
  let totalFacturadoLineas = 0;

  for (const line of ot.items) {
    const prev = calcLineTotals(
      line.cantidadPrevista,
      line.precioUnitario,
      line.descuentoPct,
      line.ivaPct
    );
    const exec = calcLineTotals(
      line.cantidadEjecutada,
      line.precioUnitario,
      line.descuentoPct,
      line.ivaPct
    );
    const fact = calcLineTotals(
      line.cantidadFacturada,
      line.precioUnitario,
      line.descuentoPct,
      line.ivaPct
    );
    totalPrevisto = round2(totalPrevisto + prev.totalConIva);
    totalEjecutado = round2(totalEjecutado + exec.totalConIva);
    totalFacturadoLineas = round2(totalFacturadoLineas + fact.totalConIva);
  }

  let gastosTotal = 0;
  for (const g of ot.gastosAdicionales || []) {
    const gt = calcLineTotals(g.cantidad, g.precioUnitario, 0, g.ivaPct);
    g.totalConIva = gt.totalConIva;
    gastosTotal = round2(gastosTotal + gt.totalConIva);
  }

  // Sumar movilidad/viáticos/materiales registrados en partes
  let partesExtras = 0;
  let partesCostoDirecto = 0;
  for (const p of otPartes) {
    partesExtras = round2(
      partesExtras +
        (Number(p.movilidadCosto) || 0) +
        (Number(p.viaticosCosto) || 0) +
        (Number(p.materialesCosto) || 0)
    );
    partesCostoDirecto = round2(
      partesCostoDirecto +
        (Number(p.movilidadCosto) || 0) +
        (Number(p.viaticosCosto) || 0) +
        (Number(p.materialesCosto) || 0)
    );
  }

  ot.totalPrevisto = round2(totalPrevisto + gastosTotal);
  ot.totalEjecutado = round2(
    totalEjecutado + (partesExtras > 0 ? partesExtras : gastosTotal)
  );

  // Total facturado respeta lo vinculado por facturas reales (o suma de líneas)
  const baseTarget = ot.totalEjecutado > 0 ? ot.totalEjecutado : ot.totalPrevisto;
  if (ot.totalFacturado <= 0 && totalFacturadoLineas > 0) {
    ot.totalFacturado = totalFacturadoLineas;
  }
  ot.saldoPendienteFacturar = Math.max(0, round2(baseTarget - ot.totalFacturado));

  const allLinesBilled =
    ot.items.length > 0 &&
    ot.items.every((l) => {
      const targetQty = l.cantidadEjecutada > 0 ? l.cantidadEjecutada : l.cantidadPrevista;
      return l.cantidadFacturada >= Math.max(0, targetQty - 0.001);
    });

  if (ot.totalFacturado <= 0.01) {
    ot.estadoFacturacion = "pendiente";
  } else if (allLinesBilled && ot.saldoPendienteFacturar <= 1) {
    ot.estadoFacturacion = "facturada";
    ot.saldoPendienteFacturar = 0;
  } else {
    ot.estadoFacturacion = "parcial";
  }

  if (partesCostoDirecto > 0 && ot.costoDirectoEstimado < partesCostoDirecto) {
    ot.costoDirectoEstimado = partesCostoDirecto;
  }
}

function buildInformes(
  db: ServiciosDatabase,
  movimientosCtaCte: AnyObj[]
) {
  const nowIso = new Date().toISOString();
  const ymActual = nowIso.slice(0, 7);

  const presTotal = db.presupuestos.length;
  const presAprobados = db.presupuestos.filter((p) => p.estado === "aprobado").length;
  const montoPresupuestado = round2(
    db.presupuestos
      .filter((p) => p.estado !== "cancelado")
      .reduce((a, p) => a + (Number(p.totalGeneral) || 0), 0)
  );
  const montoAprobado = round2(
    db.presupuestos
      .filter((p) => p.estado === "aprobado")
      .reduce((a, p) => a + (Number(p.totalGeneral) || 0), 0)
  );

  const otsPendientes = db.ordenesTrabajo.filter(
    (o) => o.estado === "pendiente" || o.estado === "programada"
  ).length;
  const otsEnEjecucion = db.ordenesTrabajo.filter(
    (o) => o.estado === "en_ejecucion"
  ).length;
  const otsFinalizadas = db.ordenesTrabajo.filter(
    (o) => o.estado === "finalizada"
  ).length;

  const otsPendFact = db.ordenesTrabajo.filter(
    (o) => o.estado !== "cancelada" && o.estadoFacturacion !== "facturada" && o.saldoPendienteFacturar > 0
  );
  const montoPendienteFacturar = round2(
    otsPendFact.reduce((a, o) => a + (Number(o.saldoPendienteFacturar) || 0), 0)
  );

  let facturacionPeriodo = 0;
  let facturacionHistorica = 0;
  for (const f of db.facturasVinculadas) {
    const sign = f.esNotaCredito ? -1 : 1;
    const m = round2((Number(f.montoFacturado) || 0) * sign);
    facturacionHistorica = round2(facturacionHistorica + m);
    if (String(f.fechaIso || "").startsWith(ymActual)) {
      facturacionPeriodo = round2(facturacionPeriodo + m);
    }
  }

  // Cobranzas pendientes en Cuenta Corriente originadas en Servicios / Mixta
  let cobranzasPendientesServicios = 0;
  let cobranzasPendientesCount = 0;
  for (const m of movimientosCtaCte) {
    const orig = String(m.origen || "").toUpperCase();
    if (orig !== "SERVICIOS" && orig !== "MIXTA") continue;
    const pend = round2(Number(m.pend ?? m.imp ?? 0));
    if (Number(m.dh) === 1 && pend > 0.01) {
      cobranzasPendientesServicios = round2(cobranzasPendientesServicios + pend);
      cobranzasPendientesCount += 1;
    }
  }

  // Ventas por tipo de servicio
  const srvMap = new Map<
    string,
    { servicioId: string; codigo: string; nombre: string; cantidad: number; monto: number }
  >();
  for (const ot of db.ordenesTrabajo) {
    if (ot.estado === "cancelada") continue;
    for (const line of ot.items || []) {
      const key = line.servicioId || line.codigo || line.nombre;
      const qty = line.cantidadEjecutada > 0 ? line.cantidadEjecutada : line.cantidadPrevista;
      const tot = calcLineTotals(qty, line.precioUnitario, line.descuentoPct, line.ivaPct).totalConIva;
      const prev = srvMap.get(key) || {
        servicioId: line.servicioId,
        codigo: line.codigo,
        nombre: line.nombre,
        cantidad: 0,
        monto: 0,
      };
      prev.cantidad = round3(prev.cantidad + qty);
      prev.monto = round2(prev.monto + tot);
      srvMap.set(key, prev);
    }
  }
  const ventasPorServicio = Array.from(srvMap.values()).sort((a, b) => b.monto - a.monto);

  // Facturación por cliente
  const cliMap = new Map<
    number,
    { clientId: number; nombre: string; ots: number; montoFacturado: number; saldoPendiente: number }
  >();
  for (const ot of db.ordenesTrabajo) {
    if (ot.estado === "cancelada") continue;
    const cid = Number(ot.billingClientId || ot.clientId || 0);
    const prev = cliMap.get(cid) || {
      clientId: cid,
      nombre: ot.billingClientNombre || ot.clientNombre || `Cliente #${cid}`,
      ots: 0,
      montoFacturado: 0,
      saldoPendiente: 0,
    };
    prev.ots += 1;
    prev.montoFacturado = round2(prev.montoFacturado + (Number(ot.totalFacturado) || 0));
    prev.saldoPendiente = round2(prev.saldoPendiente + (Number(ot.saldoPendienteFacturar) || 0));
    cliMap.set(cid, prev);
  }
  const facturacionPorCliente = Array.from(cliMap.values()).sort(
    (a, b) => b.montoFacturado + b.saldoPendiente - (a.montoFacturado + a.saldoPendiente)
  );

  // Productividad por técnico
  const tecMap = new Map<
    string,
    {
      personalId: string;
      nombre: string;
      especialidad: string;
      otsAsignadas: number;
      otsFinalizadas: number;
      partesRegistrados: number;
      horasTrabajadas: number;
    }
  >();
  for (const p of db.personal) {
    tecMap.set(p.id, {
      personalId: p.id,
      nombre: p.nombre,
      especialidad: p.especialidad || "Técnico / Prestador",
      otsAsignadas: 0,
      otsFinalizadas: 0,
      partesRegistrados: 0,
      horasTrabajadas: 0,
    });
  }
  for (const ot of db.ordenesTrabajo) {
    if (ot.estado === "cancelada") continue;
    for (const pid of ot.personalAsignadoIds || []) {
      const row = tecMap.get(pid) || {
        personalId: pid,
        nombre: pid,
        especialidad: "Personal",
        otsAsignadas: 0,
        otsFinalizadas: 0,
        partesRegistrados: 0,
        horasTrabajadas: 0,
      };
      row.otsAsignadas += 1;
      if (ot.estado === "finalizada") row.otsFinalizadas += 1;
      tecMap.set(pid, row);
    }
  }
  for (const parte of db.partesServicio) {
    const hrs = Number(parte.horasTrabajadas) || 0;
    const ids = Array.isArray(parte.personalIntervinienteIds) ? parte.personalIntervinienteIds : [];
    const shareHrs = ids.length > 0 ? round2(hrs / ids.length) : 0;
    for (const pid of ids) {
      const row = tecMap.get(pid);
      if (row) {
        row.partesRegistrados += 1;
        row.horasTrabajadas = round2(row.horasTrabajadas + shareHrs);
      }
    }
  }
  const productividadPorTecnico = Array.from(tecMap.values()).sort(
    (a, b) => b.horasTrabajadas - a.horasTrabajadas || b.otsAsignadas - a.otsAsignadas
  );

  // Rentabilidad por trabajo
  const rentabilidadPorTrabajo = db.ordenesTrabajo
    .filter((o) => o.estado !== "cancelada")
    .map((o) => {
      const ingreso = o.totalFacturado > 0 ? o.totalFacturado : o.totalEjecutado > 0 ? o.totalEjecutado : o.totalPrevisto;
      // Sumar costo directo estimado + horas × costoHora de personal en partes
      let costoHoras = 0;
      const otPartes = db.partesServicio.filter((p) => p.otId === o.id);
      for (const p of otPartes) {
        const hrs = Number(p.horasTrabajadas) || 0;
        const ids = Array.isArray(p.personalIntervinienteIds) ? p.personalIntervinienteIds : [];
        if (ids.length > 0) {
          const perTechHrs = hrs / ids.length;
          for (const pid of ids) {
            const tech = db.personal.find((x) => x.id === pid);
            costoHoras += perTechHrs * (Number(tech?.costoHora) || 0);
          }
        }
      }
      const costoTotal = round2((Number(o.costoDirectoEstimado) || 0) + costoHoras);
      const margenMonto = round2(ingreso - costoTotal);
      const margenPct = ingreso > 0 ? round2((margenMonto / ingreso) * 100) : 0;
      return {
        otId: o.id,
        numero: o.numero,
        clientNombre: o.clientNombre,
        estado: o.estado,
        totalPrevisto: o.totalPrevisto,
        totalFacturado: o.totalFacturado,
        ingresoBase: ingreso,
        costoDirecto: costoTotal,
        margenMonto,
        margenPct,
      };
    });

  return {
    periodoActual: ymActual,
    presupuestosTotal: presTotal,
    presupuestosAprobados: presAprobados,
    montoPresupuestado,
    montoAprobado,
    otsPendientes,
    otsEnEjecucion,
    otsFinalizadas,
    pendientesFacturarCount: otsPendFact.length,
    montoPendienteFacturar,
    facturacionPeriodo,
    facturacionHistorica,
    cobranzasPendientesServicios,
    cobranzasPendientesCount,
    abonosActivos: db.abonos.filter((a) => a.estado === "activo").length,
    ventasPorServicio,
    facturacionPorCliente,
    productividadPorTecnico,
    rentabilidadPorTrabajo,
  };
}

export async function handleErpServicios(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const cleanFallback = buildCleanServiciosDb(tenant.deployment?.actividadNegocio);
  const seedDocs = buildCleanTenantSeed({ businessName: tenant.business_name }).docs;

  if (req.method === "GET") {
    const [{ payload: rawDb }, { payload: cliDb }, { payload: asisDb }] =
      await Promise.all([
        getTenantDoc<AnyObj>(tenant, "servicios_db", cleanFallback),
        getTenantDoc<AnyObj>(tenant, "clientes_db", seedDocs.clientes_db as AnyObj),
        getTenantDoc<AnyObj>(tenant, "asistencia_db", { employees: [] }),
      ]);

    const db = normalizeDb(rawDb);
    const clientesRaw = Array.isArray(cliDb?.clientes) ? cliDb.clientes : [];
    const clientes = clientesRaw
      .filter((c: AnyObj) => c && !c.bajaLogica && String(c.estado || "A") !== "B")
      .map((c: AnyObj) => ({
        id: Number(c.id),
        codigo: Number(c.codigo || 0),
        nombre: String(c.nombre || ""),
        razonSocial: String(c.razonSocial || c.nombre || ""),
        nroDoc: String(c.nroDoc || ""),
        respIva: String(c.respIva || "CONSUMIDOR FINAL"),
        email: String(c.email || ""),
        telefono: String(c.telefono || c.whatsapp || ""),
        localidad: String(c.localidad || ""),
        provincia: String(c.provincia || ""),
        direccion: [c.calle, c.numero].filter(Boolean).join(" ").trim(),
        saldoActual: round2(c.saldoActual || 0),
        esCliente: c.esCliente !== false,
      }));

    const movimientosCtaCte = Array.isArray(cliDb?.movimientosCtaCte)
      ? cliDb.movimientosCtaCte
      : [];

    const empleadosAsistencia = (Array.isArray(asisDb?.employees) ? asisDb.employees : [])
      .filter((e: AnyObj) => e && !e.deleted && e.active !== false)
      .map((e: AnyObj) => ({
        id: String(e.id),
        nombre: String(e.profile?.nombreCompleto || e.username || ""),
        dni: String(e.profile?.dni || ""),
        puesto: String(e.puesto || ""),
        sector: String(e.sector || ""),
        telefono: String(e.profile?.whatsappCompleto || ""),
        email: String(e.email || ""),
      }));

    const unidadesDisponibles = Array.from(
      new Set([
        ...DEFAULT_UNIDADES_FACTURACION,
        ...(db.config.unidadesPersonalizadas || []),
      ])
    );

    const informes = buildInformes(db, movimientosCtaCte);

    return NextResponse.json({
      ok: true,
      db,
      unidadesDisponibles,
      clientes,
      empleadosAsistencia,
      informes,
    });
  }

  if (req.method === "POST") {
    const body = ((await req.json().catch(() => null)) || null) as AnyObj | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, message: "JSON inválido" },
        { status: 400 }
      );
    }

    const action = String(body.action || "").trim();
    const actor = String(
      body.usuario || body.actor || req.headers.get("x-erp-user") || "sistema"
    );
    const now = new Date().toISOString();

    const { payload: rawDb } = await getTenantDoc<AnyObj>(
      tenant,
      "servicios_db",
      cleanFallback
    );
    const db = normalizeDb(rawDb);

    const commit = async (tag: string, extra: AnyObj = {}) => {
      db.updatedAt = new Date().toISOString();
      const saved = await putTenantDoc(tenant, "servicios_db", db, actor, tag);
      return NextResponse.json({ ok: true, rev: saved.rev, db, ...extra });
    };

    // 1. CONFIGURACIÓN GENERAL Y MODALIDAD DE ACTIVIDAD
    if (action === "save_config") {
      const cfg = (body.config || body) as AnyObj;
      const validModes: ActividadNegocioMode[] = ["comercial", "servicios", "mixta"];
      if (validModes.includes(cfg.actividadNegocio)) {
        db.config.actividadNegocio = cfg.actividadNegocio;
      }
      if (Array.isArray(cfg.unidadesPersonalizadas)) {
        db.config.unidadesPersonalizadas = cfg.unidadesPersonalizadas
          .map((u: unknown) => String(u || "").trim())
          .filter((u: string, i: number, arr: string[]) => Boolean(u) && arr.indexOf(u) === i);
      }
      if (cfg.monedaDefault === "ARS" || cfg.monedaDefault === "USD") {
        db.config.monedaDefault = cfg.monedaDefault;
      }
      if (cfg.ivaDefaultPct !== undefined) {
        db.config.ivaDefaultPct = Math.max(0, round2(cfg.ivaDefaultPct));
      }
      if (cfg.validezPresupuestoDias !== undefined) {
        db.config.validezPresupuestoDias = Math.max(1, Math.round(Number(cfg.validezPresupuestoDias) || 15));
      }
      if (cfg.condicionesComercialesDefault !== undefined) {
        db.config.condicionesComercialesDefault = String(cfg.condicionesComercialesDefault || "").trim();
      }
      if (cfg.requiereAprobacionAdminFacturacion !== undefined) {
        db.config.requiereAprobacionAdminFacturacion = Boolean(cfg.requiereAprobacionAdminFacturacion);
      }
      db.config.updatedAt = now;
      db.config.updatedBy = actor;
      if (validModes.includes(cfg.actividadNegocio)) {
        try {
          const sb = await getPlatformSupabase();
          await sb
            .from("erp_tenants")
            .update({
              deployment: {
                ...(tenant.deployment || {}),
                actividadNegocio: db.config.actividadNegocio,
              },
              updated_at: now,
            })
            .eq("slug", tenant.slug);
        } catch {
          // Non-fatal: servicios_db already stores the canonical mode
        }
      }
      return commit("save_config", {
        message: "Configuración de Gestión de Servicios guardada.",
      });
    }

    // 2. PERFIL COMPLEMENTARIO DE CLIENTE (REUTILIZA clientId DE clientes_db)
    if (action === "save_client_profile") {
      const p = (body.profile || body) as AnyObj;
      const clientId = Number(p.clientId || 0);
      if (clientId <= 0) {
        return NextResponse.json(
          { ok: false, message: "Debe seleccionar un cliente válido del padrón." },
          { status: 400 }
        );
      }
      const prev = db.clientProfiles[String(clientId)];
      const profile: ClienteServicioPerfil = {
        clientId,
        contactoTecnicoNombre: String(p.contactoTecnicoNombre ?? prev?.contactoTecnicoNombre ?? "").trim(),
        contactoTecnicoTel: String(p.contactoTecnicoTel ?? prev?.contactoTecnicoTel ?? "").trim(),
        contactoTecnicoEmail: String(p.contactoTecnicoEmail ?? prev?.contactoTecnicoEmail ?? "").trim(),
        contactoAdminNombre: String(p.contactoAdminNombre ?? prev?.contactoAdminNombre ?? "").trim(),
        contactoAdminTel: String(p.contactoAdminTel ?? prev?.contactoAdminTel ?? "").trim(),
        contactoAdminEmail: String(p.contactoAdminEmail ?? prev?.contactoAdminEmail ?? "").trim(),
        condicionesContratacion: String(p.condicionesContratacion ?? prev?.condicionesContratacion ?? "").trim(),
        condicionesPago: String(p.condicionesPago ?? prev?.condicionesPago ?? "").trim(),
        plazoPagoDias: Math.max(0, Math.round(Number(p.plazoPagoDias ?? prev?.plazoPagoDias ?? 30))),
        codigoInternoCliente: String(p.codigoInternoCliente ?? prev?.codigoInternoCliente ?? "").trim(),
        ordenesCompraRef: String(p.ordenesCompraRef ?? prev?.ordenesCompraRef ?? "").trim(),
        defaultBillingClientId:
          p.defaultBillingClientId !== undefined
            ? Number(p.defaultBillingClientId) || null
            : prev?.defaultBillingClientId ?? null,
        ubicaciones: Array.isArray(p.ubicaciones)
          ? p.ubicaciones.map((u: AnyObj) => ({
              id: String(u.id || uid("loc")),
              nombre: String(u.nombre || "").trim(),
              direccion: String(u.direccion || "").trim(),
              localidad: String(u.localidad || "").trim(),
              provincia: String(u.provincia || "").trim(),
              contactoSitio: String(u.contactoSitio || "").trim(),
              telefonoSitio: String(u.telefonoSitio || "").trim(),
              notas: String(u.notas || "").trim(),
            }))
          : prev?.ubicaciones || [],
        tarifasEspeciales: Array.isArray(p.tarifasEspeciales)
          ? p.tarifasEspeciales.map((t: AnyObj) => ({
              id: String(t.id || uid("tar")),
              servicioId: String(t.servicioId || ""),
              precioEspecial: round2(t.precioEspecial || 0),
              moneda: t.moneda === "USD" ? "USD" : "ARS",
              vigenteDesde: String(t.vigenteDesde || now.slice(0, 10)),
              vigenteHasta: String(t.vigenteHasta || ""),
              notas: String(t.notas || "").trim(),
              updatedAt: now,
              updatedBy: actor,
            }))
          : prev?.tarifasEspeciales || [],
        updatedAt: now,
        updatedBy: actor,
      };
      db.clientProfiles[String(clientId)] = profile;
      return commit("save_client_profile", {
        profile,
        message: "Datos complementarios de Servicios del cliente guardados.",
      });
    }

    // 3. CATÁLOGO DE SERVICIOS
    if (action === "save_service") {
      const s = (body.service || body) as AnyObj;
      const nombre = String(s.nombre || "").trim();
      if (!nombre) {
        return NextResponse.json(
          { ok: false, message: "El nombre del servicio es obligatorio." },
          { status: 400 }
        );
      }
      const existingIdx = s.id
        ? db.catalogo.findIndex((x) => x.id === String(s.id))
        : -1;
      const prev = existingIdx >= 0 ? db.catalogo[existingIdx] : null;
      const nextPrice = Math.max(0, round2(s.precioBase));
      const nextMoneda: MonedaServicio = s.moneda === "USD" ? "USD" : "ARS";
      const historial = Array.isArray(prev?.historialTarifas)
        ? [...prev!.historialTarifas]
        : [];
      if (!prev || prev.precioBase !== nextPrice || prev.moneda !== nextMoneda) {
        historial.unshift({
          at: now,
          by: actor,
          precioAnterior: prev ? prev.precioBase : 0,
          precioNuevo: nextPrice,
          moneda: nextMoneda,
          motivo: String(s.motivoCambioTarifa || (prev ? "Actualización de tarifa" : "Alta inicial")),
        });
      }
      const item: ServicioCatalogoItem = {
        id: prev ? prev.id : uid("srv"),
        codigo:
          String(s.codigo || "").trim().toUpperCase() ||
          `SRV-${String(db.catalogo.length + 1).padStart(4, "0")}`,
        nombre,
        descripcion: String(s.descripcion || "").trim(),
        categoria: String(s.categoria || "Servicios Generales").trim(),
        unidadMedida: String(s.unidadMedida || "Unidad").trim(),
        precioBase: nextPrice,
        costoEstimado: Math.max(0, round2(s.costoEstimado ?? prev?.costoEstimado ?? 0)),
        moneda: nextMoneda,
        ivaPct: Math.max(0, round2(s.ivaPct ?? db.config.ivaDefaultPct ?? 21)),
        duracionEstimadaMin: Math.max(0, Math.round(Number(s.duracionEstimadaMin) || 60)),
        activo: s.activo !== false,
        observaciones: String(s.observaciones || "").trim(),
        formasCotizacion: Array.isArray(s.formasCotizacion)
          ? s.formasCotizacion
              .filter((fc: AnyObj) => fc && String(fc.unidad || "").trim())
              .map((fc: AnyObj) => ({
                unidad: String(fc.unidad).trim(),
                precio: Math.max(0, round2(fc.precio)),
                moneda: fc.moneda === "USD" ? "USD" : "ARS",
              }))
          : prev?.formasCotizacion || [],
        historialTarifas: historial.slice(0, 50),
        createdAt: prev ? prev.createdAt : now,
        updatedAt: now,
      };
      if (existingIdx >= 0) db.catalogo[existingIdx] = item;
      else db.catalogo.unshift(item);
      return commit("save_service", {
        service: item,
        message: prev ? "Servicio actualizado." : "Servicio agregado al catálogo.",
      });
    }

    if (action === "delete_service") {
      const id = String(body.id || "");
      db.catalogo = db.catalogo.filter((x) => x.id !== id);
      return commit("delete_service", { message: "Servicio eliminado del catálogo." });
    }

    // 4. PRESUPUESTOS Y COTIZACIONES
    if (action === "save_presupuesto") {
      const p = (body.presupuesto || body) as AnyObj;
      const clientId = Number(p.clientId || 0);
      if (clientId <= 0) {
        return NextResponse.json(
          { ok: false, message: "Seleccioná un cliente solicitante." },
          { status: 400 }
        );
      }
      const existingIdx = p.id
        ? db.presupuestos.findIndex((x) => x.id === String(p.id))
        : -1;
      const prev = existingIdx >= 0 ? db.presupuestos[existingIdx] : null;
      const billingClientId = Number(p.billingClientId || clientId) || clientId;
      const moneda: MonedaServicio = p.moneda === "USD" ? "USD" : "ARS";
      const descGlobal = Math.min(100, Math.max(0, round2(p.descuentoGlobalPct || 0)));

      const items: ServicioLineaComercial[] = (Array.isArray(p.items) ? p.items : [])
        .filter((it: AnyObj) => it && String(it.nombre || "").trim())
        .map((it: AnyObj) => {
          const cantidad = Math.max(0, round3(it.cantidad ?? 1));
          const precioUnitario = Math.max(0, round2(it.precioUnitario ?? 0));
          const descuentoPct = Math.min(100, Math.max(0, round2(it.descuentoPct ?? 0)));
          const ivaPct = Math.max(0, round2(it.ivaPct ?? db.config.ivaDefaultPct ?? 21));
          const t = calcLineTotals(cantidad, precioUnitario, descuentoPct, ivaPct);
          return {
            id: String(it.id || uid("pl")),
            servicioId: String(it.servicioId || ""),
            codigo: String(it.codigo || "SRV").trim().toUpperCase(),
            nombre: String(it.nombre).trim(),
            descripcion: String(it.descripcion || "").trim(),
            unidadMedida: String(it.unidadMedida || "Unidad").trim(),
            cantidad,
            precioUnitario,
            descuentoPct,
            ivaPct,
            subtotalNeto: t.subtotalNeto,
            totalConIva: t.totalConIva,
          };
        });

      const gastosAdicionales: GastoAdicionalServicio[] = (
        Array.isArray(p.gastosAdicionales) ? p.gastosAdicionales : []
      )
        .filter((g: AnyObj) => g && String(g.concepto || "").trim())
        .map((g: AnyObj) => {
          const cantidad = Math.max(0, round3(g.cantidad ?? 1));
          const precioUnitario = Math.max(0, round2(g.precioUnitario ?? 0));
          const ivaPct = Math.max(0, round2(g.ivaPct ?? db.config.ivaDefaultPct ?? 21));
          const t = calcLineTotals(cantidad, precioUnitario, 0, ivaPct);
          return {
            id: String(g.id || uid("ga")),
            concepto: String(g.concepto).trim(),
            cantidad,
            precioUnitario,
            ivaPct,
            totalConIva: t.totalConIva,
          };
        });

      const itemsNeto = items.reduce((a, x) => a + x.subtotalNeto, 0);
      const itemsTotal = items.reduce((a, x) => a + x.totalConIva, 0);
      const gastosNeto = gastosAdicionales.reduce(
        (a, g) => a + round2(g.cantidad * g.precioUnitario),
        0
      );
      const gastosTotal = gastosAdicionales.reduce((a, g) => a + g.totalConIva, 0);
      const factorGlobal = 1 - descGlobal / 100;
      const subtotalNeto = round2((itemsNeto + gastosNeto) * factorGlobal);
      const totalGeneral = round2((itemsTotal + gastosTotal) * factorGlobal);
      const totalIva = round2(totalGeneral - subtotalNeto);

      const estado: EstadoPresupuesto = [
        "borrador",
        "enviado",
        "aprobado",
        "rechazado",
        "vencido",
        "cancelado",
      ].includes(p.estado)
        ? p.estado
        : prev?.estado || "borrador";

      const isNewVersion = Boolean(body.bumpVersion) && Boolean(prev);
      const version = prev ? (isNewVersion ? prev.version + 1 : prev.version) : 1;
      const versionHistory = Array.isArray(prev?.versionHistory)
        ? [...prev!.versionHistory]
        : [];
      if (!prev || isNewVersion) {
        versionHistory.unshift({
          version,
          savedAt: now,
          savedBy: actor,
          total: totalGeneral,
          estado,
          nota: String(body.versionNota || (prev ? `Revisión v${version}` : "Versión inicial")),
        });
      }

      const numero = prev
        ? prev.numero
        : padSeq(db.config.prefijoPresupuesto || "PRES", db.config.nextPresupuestoSeq++);

      const auditLog = Array.isArray(prev?.auditLog) ? [...prev!.auditLog] : [];
      auditLog.unshift({
        at: now,
        by: actor,
        action: prev ? (isNewVersion ? "new_version" : "updated") : "created",
        detail: `${numero} v${version} · Estado: ${estado} · Total: ${moneda} ${totalGeneral}`,
      });

      const rec: PresupuestoServicio = {
        id: prev ? prev.id : uid("pres"),
        numero,
        version,
        fecha: String(p.fecha || prev?.fecha || now.slice(0, 10)),
        vigenteHasta: String(
          p.vigenteHasta ||
            prev?.vigenteHasta ||
            new Date(Date.now() + (db.config.validezPresupuestoDias || 15) * 86400000)
              .toISOString()
              .slice(0, 10)
        ),
        estado,
        clientId,
        clientNombre: String(p.clientNombre || prev?.clientNombre || `Cliente #${clientId}`),
        billingClientId,
        billingClientNombre: String(
          p.billingClientNombre || p.clientNombre || prev?.billingClientNombre || `Cliente #${billingClientId}`
        ),
        establecimientoNombre: String(p.establecimientoNombre || "").trim(),
        establecimientoDireccion: String(p.establecimientoDireccion || "").trim(),
        moneda,
        items,
        gastosAdicionales,
        descuentoGlobalPct: descGlobal,
        subtotalNeto,
        totalIva,
        totalGeneral,
        condicionesComerciales: String(
          p.condicionesComerciales ?? db.config.condicionesComercialesDefault
        ).trim(),
        observaciones: String(p.observaciones || "").trim(),
        adjuntos: Array.isArray(p.adjuntos) ? p.adjuntos : prev?.adjuntos || [],
        convertedOtId: prev?.convertedOtId || null,
        versionHistory: versionHistory.slice(0, 30),
        auditLog: auditLog.slice(0, 50),
        createdAt: prev ? prev.createdAt : now,
        createdBy: prev ? prev.createdBy : actor,
        updatedAt: now,
      };

      if (existingIdx >= 0) db.presupuestos[existingIdx] = rec;
      else db.presupuestos.unshift(rec);

      return commit("save_presupuesto", {
        presupuesto: rec,
        message: prev ? `Presupuesto ${rec.numero} actualizado.` : `Presupuesto ${rec.numero} creado.`,
      });
    }

    if (action === "change_presupuesto_status") {
      const id = String(body.id || "");
      const estado = String(body.estado || "") as EstadoPresupuesto;
      const pres = db.presupuestos.find((x) => x.id === id);
      if (!pres) {
        return NextResponse.json({ ok: false, message: "Presupuesto no encontrado." }, { status: 404 });
      }
      pres.estado = estado;
      pres.updatedAt = now;
      pres.auditLog.unshift({
        at: now,
        by: actor,
        action: "status_change",
        detail: `Cambio de estado a "${estado}"`,
      });
      return commit("change_presupuesto_status", {
        presupuesto: pres,
        message: `Presupuesto ${pres.numero} marcado como ${estado}.`,
      });
    }

    if (action === "convert_presupuesto_to_ot") {
      const id = String(body.presupuestoId || body.id || "");
      const pres = db.presupuestos.find((x) => x.id === id);
      if (!pres) {
        return NextResponse.json({ ok: false, message: "Presupuesto no encontrado." }, { status: 404 });
      }
      if (pres.convertedOtId) {
        const existingOt = db.ordenesTrabajo.find((o) => o.id === pres.convertedOtId);
        if (existingOt) {
          return NextResponse.json({
            ok: true,
            alreadyConverted: true,
            ot: existingOt,
            db,
            message: `Este presupuesto ya fue convertido en ${existingOt.numero}.`,
          });
        }
      }
      if (pres.estado !== "aprobado") {
        pres.estado = "aprobado";
      }

      const otNumero = padSeq(db.config.prefijoOt || "OT", db.config.nextOtSeq++);
      const otItems: OrdenTrabajoLinea[] = pres.items.map((it) => ({
        id: uid("otl"),
        servicioId: it.servicioId,
        codigo: it.codigo,
        nombre: it.nombre,
        unidadMedida: it.unidadMedida,
        cantidadPrevista: it.cantidad,
        cantidadEjecutada: 0,
        cantidadFacturada: 0,
        precioUnitario: it.precioUnitario,
        descuentoPct: it.descuentoPct,
        ivaPct: it.ivaPct,
      }));

      let costoEst = 0;
      for (const l of otItems) {
        const srv = db.catalogo.find((c) => c.id === l.servicioId);
        if (srv) costoEst += round2(srv.costoEstimado * l.cantidadPrevista);
      }

      const ot: OrdenTrabajo = {
        id: uid("ot"),
        numero: otNumero,
        estado: "pendiente",
        estadoFacturacion: "pendiente",
        presupuestoId: pres.id,
        presupuestoNumero: pres.numero,
        clientId: pres.clientId,
        clientNombre: pres.clientNombre,
        billingClientId: pres.billingClientId,
        billingClientNombre: pres.billingClientNombre,
        ordenCompraCliente: String(body.ordenCompraCliente || "").trim(),
        fechaSolicitud: now.slice(0, 10),
        fechaPrevista: String(body.fechaPrevista || now.slice(0, 10)),
        lugarTrabajo: pres.establecimientoNombre || "",
        domicilioTrabajo: pres.establecimientoDireccion || "",
        equipoInstalacion: String(body.equipoInstalacion || "").trim(),
        descripcionTrabajo:
          pres.observaciones ||
          pres.items.map((x) => `${x.cantidad} ${x.unidadMedida} — ${x.nombre}`).join(" · "),
        personalAsignadoIds: Array.isArray(body.personalAsignadoIds)
          ? body.personalAsignadoIds.map(String)
          : [],
        duracionEstimadaHoras: round2(
          pres.items.reduce((acc, it) => {
            const srv = db.catalogo.find((c) => c.id === it.servicioId);
            return acc + ((srv?.duracionEstimadaMin || 60) * it.cantidad) / 60;
          }, 0)
        ),
        materialesRecursos: "",
        instruccionesEspeciales: "",
        moneda: pres.moneda,
        items: otItems,
        gastosAdicionales: (pres.gastosAdicionales || []).map((g) => ({ ...g })),
        condicionesComerciales: pres.condicionesComerciales,
        totalPrevisto: pres.totalGeneral,
        totalEjecutado: 0,
        totalFacturado: 0,
        saldoPendienteFacturar: pres.totalGeneral,
        costoDirectoEstimado: round2(costoEst),
        facturasIds: [],
        auditLog: [
          {
            at: now,
            by: actor,
            action: "created_from_presupuesto",
            detail: `Generada desde ${pres.numero} v${pres.version}`,
          },
        ],
        createdAt: now,
        createdBy: actor,
        updatedAt: now,
      };

      recomputeOtTotals(ot, db.partesServicio);
      pres.convertedOtId = ot.id;
      pres.updatedAt = now;
      pres.auditLog.unshift({
        at: now,
        by: actor,
        action: "converted_to_ot",
        detail: `Convertido a ${ot.numero}`,
      });
      db.ordenesTrabajo.unshift(ot);

      return commit("convert_presupuesto_to_ot", {
        ot,
        presupuesto: pres,
        message: `Orden de Trabajo ${ot.numero} creada desde ${pres.numero}.`,
      });
    }

    // 5. ÓRDENES DE TRABAJO (OT)
    if (action === "save_ot") {
      const o = (body.ot || body) as AnyObj;
      const clientId = Number(o.clientId || 0);
      if (clientId <= 0) {
        return NextResponse.json(
          { ok: false, message: "Debe seleccionar un cliente solicitante." },
          { status: 400 }
        );
      }
      const existingIdx = o.id
        ? db.ordenesTrabajo.findIndex((x) => x.id === String(o.id))
        : -1;
      const prev = existingIdx >= 0 ? db.ordenesTrabajo[existingIdx] : null;
      const billingClientId = Number(o.billingClientId || clientId) || clientId;
      const numero = prev
        ? prev.numero
        : padSeq(db.config.prefijoOt || "OT", db.config.nextOtSeq++);

      const items: OrdenTrabajoLinea[] = (Array.isArray(o.items) ? o.items : [])
        .filter((it: AnyObj) => it && String(it.nombre || "").trim())
        .map((it: AnyObj) => {
          const prevLine = prev?.items.find((x) => x.id === String(it.id || ""));
          return {
            id: String(it.id || uid("otl")),
            servicioId: String(it.servicioId || ""),
            codigo: String(it.codigo || "SRV").trim().toUpperCase(),
            nombre: String(it.nombre).trim(),
            unidadMedida: String(it.unidadMedida || "Unidad").trim(),
            cantidadPrevista: Math.max(0, round3(it.cantidadPrevista ?? it.cantidad ?? 1)),
            cantidadEjecutada: Math.max(
              0,
              round3(it.cantidadEjecutada ?? prevLine?.cantidadEjecutada ?? 0)
            ),
            cantidadFacturada: Math.max(
              0,
              round3(prevLine?.cantidadFacturada ?? it.cantidadFacturada ?? 0)
            ),
            precioUnitario: Math.max(0, round2(it.precioUnitario ?? 0)),
            descuentoPct: Math.min(100, Math.max(0, round2(it.descuentoPct ?? 0))),
            ivaPct: Math.max(0, round2(it.ivaPct ?? db.config.ivaDefaultPct ?? 21)),
          };
        });

      const gastosAdicionales: GastoAdicionalServicio[] = (
        Array.isArray(o.gastosAdicionales) ? o.gastosAdicionales : []
      )
        .filter((g: AnyObj) => g && String(g.concepto || "").trim())
        .map((g: AnyObj) => {
          const cantidad = Math.max(0, round3(g.cantidad ?? 1));
          const precioUnitario = Math.max(0, round2(g.precioUnitario ?? 0));
          const ivaPct = Math.max(0, round2(g.ivaPct ?? db.config.ivaDefaultPct ?? 21));
          return {
            id: String(g.id || uid("ga")),
            concepto: String(g.concepto).trim(),
            cantidad,
            precioUnitario,
            ivaPct,
            totalConIva: calcLineTotals(cantidad, precioUnitario, 0, ivaPct).totalConIva,
          };
        });

      const estado: EstadoOrdenTrabajo = [
        "pendiente",
        "programada",
        "en_ejecucion",
        "finalizada",
        "cancelada",
      ].includes(o.estado)
        ? o.estado
        : prev?.estado || "pendiente";

      const auditLog = Array.isArray(prev?.auditLog) ? [...prev!.auditLog] : [];
      auditLog.unshift({
        at: now,
        by: actor,
        action: prev ? "updated" : "created",
        detail: `${numero} · Estado: ${estado}`,
      });

      const ot: OrdenTrabajo = {
        id: prev ? prev.id : uid("ot"),
        numero,
        estado,
        estadoFacturacion: prev?.estadoFacturacion || "pendiente",
        presupuestoId: o.presupuestoId ?? prev?.presupuestoId ?? null,
        presupuestoNumero: String(o.presupuestoNumero ?? prev?.presupuestoNumero ?? ""),
        clientId,
        clientNombre: String(o.clientNombre || prev?.clientNombre || `Cliente #${clientId}`),
        billingClientId,
        billingClientNombre: String(
          o.billingClientNombre || o.clientNombre || prev?.billingClientNombre || `Cliente #${billingClientId}`
        ),
        ordenCompraCliente: String(o.ordenCompraCliente || "").trim(),
        fechaSolicitud: String(o.fechaSolicitud || prev?.fechaSolicitud || now.slice(0, 10)),
        fechaPrevista: String(o.fechaPrevista || prev?.fechaPrevista || now.slice(0, 10)),
        lugarTrabajo: String(o.lugarTrabajo || "").trim(),
        domicilioTrabajo: String(o.domicilioTrabajo || "").trim(),
        equipoInstalacion: String(o.equipoInstalacion || "").trim(),
        descripcionTrabajo: String(o.descripcionTrabajo || "").trim(),
        personalAsignadoIds: Array.isArray(o.personalAsignadoIds)
          ? o.personalAsignadoIds.map(String)
          : prev?.personalAsignadoIds || [],
        duracionEstimadaHoras: Math.max(0, round2(o.duracionEstimadaHoras ?? prev?.duracionEstimadaHoras ?? 0)),
        materialesRecursos: String(o.materialesRecursos || "").trim(),
        instruccionesEspeciales: String(o.instruccionesEspeciales || "").trim(),
        moneda: o.moneda === "USD" ? "USD" : "ARS",
        items,
        gastosAdicionales,
        condicionesComerciales: String(o.condicionesComerciales || "").trim(),
        totalPrevisto: 0,
        totalEjecutado: 0,
        totalFacturado: prev?.totalFacturado || 0,
        saldoPendienteFacturar: 0,
        costoDirectoEstimado: Math.max(0, round2(o.costoDirectoEstimado ?? prev?.costoDirectoEstimado ?? 0)),
        facturasIds: prev?.facturasIds || [],
        auditLog: auditLog.slice(0, 50),
        createdAt: prev ? prev.createdAt : now,
        createdBy: prev ? prev.createdBy : actor,
        updatedAt: now,
      };

      recomputeOtTotals(ot, db.partesServicio);
      if (existingIdx >= 0) db.ordenesTrabajo[existingIdx] = ot;
      else db.ordenesTrabajo.unshift(ot);

      return commit("save_ot", {
        ot,
        message: prev ? `Orden de Trabajo ${ot.numero} actualizada.` : `Orden de Trabajo ${ot.numero} creada.`,
      });
    }

    if (action === "change_ot_status") {
      const id = String(body.id || "");
      const estado = String(body.estado || "") as EstadoOrdenTrabajo;
      const ot = db.ordenesTrabajo.find((x) => x.id === id);
      if (!ot) {
        return NextResponse.json({ ok: false, message: "Orden de Trabajo no encontrada." }, { status: 404 });
      }
      ot.estado = estado;
      ot.updatedAt = now;
      ot.auditLog.unshift({
        at: now,
        by: actor,
        action: "status_change",
        detail: `Estado cambiado a "${estado}"`,
      });
      return commit("change_ot_status", { ot, message: `${ot.numero} marcada como ${estado}.` });
    }

    // 6. PARTES DE SERVICIO (REGISTRO DE PRESTACIÓN REAL + CONFORMIDAD)
    if (action === "save_parte") {
      const ps = (body.parte || body) as AnyObj;
      const otId = String(ps.otId || "");
      const ot = db.ordenesTrabajo.find((x) => x.id === otId);
      if (!ot) {
        return NextResponse.json(
          { ok: false, message: "Debe vincular el parte a una Orden de Trabajo válida." },
          { status: 400 }
        );
      }
      const existingIdx = ps.id
        ? db.partesServicio.findIndex((x) => x.id === String(ps.id))
        : -1;
      const prev = existingIdx >= 0 ? db.partesServicio[existingIdx] : null;
      const numero = prev
        ? prev.numero
        : padSeq(db.config.prefijoParte || "PS", db.config.nextParteSeq++);

      const itemsEjecutados = (Array.isArray(ps.itemsEjecutados) ? ps.itemsEjecutados : []).map(
        (it: AnyObj) => ({
          otLineId: String(it.otLineId || ""),
          servicioId: String(it.servicioId || ""),
          codigo: String(it.codigo || "SRV"),
          nombre: String(it.nombre || ""),
          unidadMedida: String(it.unidadMedida || "Unidad"),
          cantidadPresupuestada: Math.max(0, round3(it.cantidadPresupuestada ?? 0)),
          cantidadEjecutada: Math.max(0, round3(it.cantidadEjecutada ?? 0)),
          precioUnitario: Math.max(0, round2(it.precioUnitario ?? 0)),
          ivaPct: Math.max(0, round2(it.ivaPct ?? db.config.ivaDefaultPct ?? 21)),
        })
      );

      const confIn = (ps.conformidad || {}) as AnyObj;
      const parte: ParteServicio = {
        id: prev ? prev.id : uid("ps"),
        numero,
        otId: ot.id,
        otNumero: ot.numero,
        clientId: ot.clientId,
        clientNombre: ot.clientNombre,
        fechaInicio: String(ps.fechaInicio || now.slice(0, 16)),
        fechaFin: String(ps.fechaFin || now.slice(0, 16)),
        horasTrabajadas: Math.max(0, round2(ps.horasTrabajadas ?? 0)),
        personalIntervinienteIds: Array.isArray(ps.personalIntervinienteIds)
          ? ps.personalIntervinienteIds.map(String)
          : ot.personalAsignadoIds,
        itemsEjecutados,
        movilidadKm: Math.max(0, round2(ps.movilidadKm ?? 0)),
        movilidadCosto: Math.max(0, round2(ps.movilidadCosto ?? 0)),
        viaticosCosto: Math.max(0, round2(ps.viaticosCosto ?? 0)),
        materialesUtilizados: String(ps.materialesUtilizados || "").trim(),
        materialesCosto: Math.max(0, round2(ps.materialesCosto ?? 0)),
        observaciones: String(ps.observaciones || "").trim(),
        incidencias: String(ps.incidencias || "").trim(),
        fotografias: Array.isArray(ps.fotografias) ? ps.fotografias.slice(0, 12) : prev?.fotografias || [],
        adjuntos: Array.isArray(ps.adjuntos) ? ps.adjuntos.slice(0, 10) : prev?.adjuntos || [],
        conformidad: {
          conforme: Boolean(confIn.conforme || confIn.nombreReceptor || confIn.firmaDataUrl),
          nombreReceptor: String(confIn.nombreReceptor || "").trim(),
          cargoDniReceptor: String(confIn.cargoDniReceptor || "").trim(),
          fechaConformidad: String(confIn.fechaConformidad || (confIn.nombreReceptor ? now.slice(0, 16).replace("T", " ") : "")),
          observaciones: String(confIn.observaciones || "").trim(),
          firmaDataUrl: String(confIn.firmaDataUrl || ""),
          avisoLegal:
            "Constancia operativa de conformidad de recepción del servicio mediante trazo digitalizado simple (no constituye firma digital con certificado criptográfico bajo Ley 25.506).",
        },
        facturado: prev?.facturado || false,
        facturaIds: prev?.facturaIds || [],
        createdAt: prev ? prev.createdAt : now,
        createdBy: prev ? prev.createdBy : actor,
        updatedAt: now,
      };

      if (existingIdx >= 0) db.partesServicio[existingIdx] = parte;
      else db.partesServicio.unshift(parte);

      // Si la OT estaba pendiente/programada pasa a en_ejecucion o finalizada si el usuario marcó finalizar
      if (body.marcarOtFinalizada) {
        ot.estado = "finalizada";
      } else if (ot.estado === "pendiente" || ot.estado === "programada") {
        ot.estado = "en_ejecucion";
      }
      recomputeOtTotals(ot, db.partesServicio);
      ot.updatedAt = now;
      ot.auditLog.unshift({
        at: now,
        by: actor,
        action: "parte_registrado",
        detail: `Parte ${parte.numero} registrado (${parte.horasTrabajadas} hs)`,
      });

      return commit("save_parte", {
        parte,
        ot,
        message: `Parte de Servicio ${parte.numero} guardado y sincronizado con ${ot.numero}.`,
      });
    }

    // 7. DOCUMENTACIÓN TÉCNICA
    if (action === "save_documento") {
      const d = (body.documento || body) as AnyObj;
      const otId = String(d.otId || "");
      const ot = db.ordenesTrabajo.find((x) => x.id === otId);
      const validTypes: TipoDocumentoTecnico[] = [
        "informe_tecnico",
        "certificado",
        "fotografia",
        "planilla",
        "protocolo",
        "pdf",
        "cliente",
      ];
      const doc: DocumentoTecnicoServicio = {
        id: String(d.id || uid("doc")),
        otId: ot ? ot.id : otId,
        otNumero: ot ? ot.numero : String(d.otNumero || ""),
        parteId: d.parteId ? String(d.parteId) : null,
        clientId: ot ? ot.clientId : Number(d.clientId || 0),
        clientNombre: ot ? ot.clientNombre : String(d.clientNombre || ""),
        tipo: validTypes.includes(d.tipo) ? d.tipo : "informe_tecnico",
        titulo: String(d.titulo || d.nombreArchivo || "Documento Técnico").trim(),
        nombreArchivo: String(d.nombreArchivo || "documento.pdf").trim(),
        mimeType: String(d.mimeType || "application/pdf"),
        dataUrl: String(d.dataUrl || ""),
        fechaDocumento: String(d.fechaDocumento || now.slice(0, 10)),
        notas: String(d.notas || "").trim(),
        visibilidadRoles: Array.isArray(d.visibilidadRoles) && d.visibilidadRoles.length > 0
          ? d.visibilidadRoles
          : ["Administrador General", "Administrador", "Usuario"],
        uploadedAt: now,
        uploadedBy: actor,
      };
      const idx = db.documentos.findIndex((x) => x.id === doc.id);
      if (idx >= 0) db.documentos[idx] = doc;
      else db.documentos.unshift(doc);
      return commit("save_documento", {
        documento: doc,
        message: `Documento "${doc.titulo}" adjuntado correctamente.`,
      });
    }

    if (action === "delete_documento") {
      const id = String(body.id || "");
      db.documentos = db.documentos.filter((x) => x.id !== id);
      return commit("delete_documento", { message: "Documento eliminado." });
    }

    // 8. PERSONAL TÉCNICO / PRESTADORES
    if (action === "save_personal") {
      const p = (body.personal || body) as AnyObj;
      const nombre = String(p.nombre || "").trim();
      if (!nombre) {
        return NextResponse.json({ ok: false, message: "El nombre del técnico/personal es obligatorio." }, { status: 400 });
      }
      const existingIdx = p.id ? db.personal.findIndex((x) => x.id === String(p.id)) : -1;
      const prev = existingIdx >= 0 ? db.personal[existingIdx] : null;
      const rec: PersonalServicioExt = {
        id: prev ? prev.id : uid("pers"),
        linkedAsistenciaEmployeeId: p.linkedAsistenciaEmployeeId
          ? String(p.linkedAsistenciaEmployeeId)
          : prev?.linkedAsistenciaEmployeeId || null,
        nombre,
        dni: String(p.dni || "").trim(),
        especialidad: String(p.especialidad || "").trim(),
        matricula: String(p.matricula || "").trim(),
        habilitaciones: String(p.habilitaciones || "").trim(),
        certificaciones: String(p.certificaciones || "").trim(),
        costoHora: Math.max(0, round2(p.costoHora ?? 0)),
        telefono: String(p.telefono || "").trim(),
        email: String(p.email || "").trim(),
        activo: p.activo !== false,
        createdAt: prev ? prev.createdAt : now,
        updatedAt: now,
      };
      if (existingIdx >= 0) db.personal[existingIdx] = rec;
      else db.personal.unshift(rec);
      return commit("save_personal", { personal: rec, message: "Perfil técnico guardado." });
    }

    if (action === "delete_personal") {
      const id = String(body.id || "");
      db.personal = db.personal.filter((x) => x.id !== id);
      return commit("delete_personal", { message: "Perfil técnico eliminado." });
    }

    // 9. ABONOS Y SERVICIOS RECURRENTES
    if (action === "save_abono") {
      const a = (body.abono || body) as AnyObj;
      const clientId = Number(a.clientId || 0);
      if (clientId <= 0) {
        return NextResponse.json({ ok: false, message: "Seleccioná un cliente para el abono." }, { status: 400 });
      }
      const existingIdx = a.id ? db.abonos.findIndex((x) => x.id === String(a.id)) : -1;
      const prev = existingIdx >= 0 ? db.abonos[existingIdx] : null;
      const billingClientId = Number(a.billingClientId || clientId) || clientId;
      const codigo = prev
        ? prev.codigo
        : padSeq(db.config.prefijoAbono || "AB", db.config.nextAbonoSeq++);
      const freq: FrecuenciaAbono = [
        "mensual",
        "bimestral",
        "trimestral",
        "semestral",
        "anual",
      ].includes(a.frecuencia)
        ? a.frecuencia
        : "mensual";
      const estado: EstadoAbono = ["activo", "pausado", "finalizado"].includes(a.estado)
        ? a.estado
        : prev?.estado || "activo";

      const rec: AbonoRecurrente = {
        id: prev ? prev.id : uid("ab"),
        codigo,
        clientId,
        clientNombre: String(a.clientNombre || prev?.clientNombre || `Cliente #${clientId}`),
        billingClientId,
        billingClientNombre: String(
          a.billingClientNombre || a.clientNombre || prev?.billingClientNombre || `Cliente #${billingClientId}`
        ),
        servicioId: String(a.servicioId || ""),
        servicioNombre: String(a.servicioNombre || "Abono de Servicio").trim(),
        descripcion: String(a.descripcion || "").trim(),
        importe: Math.max(0, round2(a.importe ?? 0)),
        moneda: a.moneda === "USD" ? "USD" : "ARS",
        ivaPct: Math.max(0, round2(a.ivaPct ?? db.config.ivaDefaultPct ?? 21)),
        frecuencia: freq,
        fechaInicio: String(a.fechaInicio || now.slice(0, 10)),
        proximoVencimiento: String(a.proximoVencimiento || a.fechaInicio || now.slice(0, 10)),
        condicionesActualizacion: String(a.condicionesActualizacion || "").trim(),
        estado,
        periodosGenerados: prev?.periodosGenerados || {},
        createdAt: prev ? prev.createdAt : now,
        updatedAt: now,
      };
      if (existingIdx >= 0) db.abonos[existingIdx] = rec;
      else db.abonos.unshift(rec);
      return commit("save_abono", { abono: rec, message: `Abono ${rec.codigo} guardado.` });
    }

    if (action === "generate_abono_period_drafts") {
      // Idempotente por período YYYY-MM: jamás duplica aunque se ejecute N veces
      const periodo = String(body.periodo || now.slice(0, 7)).slice(0, 7);
      const created: string[] = [];
      const skipped: string[] = [];
      for (const ab of db.abonos) {
        if (ab.estado !== "activo") continue;
        if (ab.periodosGenerados[periodo]) {
          skipped.push(ab.codigo);
          continue;
        }
        ab.periodosGenerados[periodo] = {
          generatedAt: now,
          generatedBy: actor,
          status: "borrador",
          importe: ab.importe,
        };
        ab.updatedAt = now;
        created.push(ab.codigo);
      }
      return commit("generate_abono_period_drafts", {
        periodo,
        created,
        skipped,
        message:
          created.length > 0
            ? `Se generaron ${created.length} borrador(es) de abono para ${periodo} (${skipped.length} omitidos por ya existir).`
            : `Todos los abonos activos ya tenían generado el período ${periodo} (sin duplicaciones).`,
      });
    }

    // 10. VÍNCULO CON FACTURACIÓN NATIVA ARCA / POS (CON ANTI-DOBLE-FACTURACIÓN Y REVERSIÓN NC)
    if (action === "register_invoice_link") {
      const inv = (body.invoice || body) as AnyObj;
      const saleId = String(inv.saleId || "").trim();
      const numeroCompleto = String(inv.numeroCompleto || "").trim();
      const esNotaCredito = Boolean(inv.esNotaCredito);

      if (!saleId && !numeroCompleto) {
        return NextResponse.json(
          { ok: false, message: "Falta identificador del comprobante emitido." },
          { status: 400 }
        );
      }

      // Idempotencia estricta: no aplicar dos veces el mismo comprobante
      const duplicate = db.facturasVinculadas.find(
        (f) => (saleId && f.saleId === saleId) || (numeroCompleto && f.numeroCompleto === numeroCompleto && f.tipoBase === String(inv.tipoBase || "Factura"))
      );
      if (duplicate) {
        return NextResponse.json({
          ok: true,
          duplicate: true,
          factura: duplicate,
          db,
          message: "Comprobante ya vinculado previamente (sin duplicación).",
        });
      }

      const links = Array.isArray(inv.lineasFacturadas) ? inv.lineasFacturadas : [];
      const sign = esNotaCredito ? -1 : 1;
      const touchedOtIds = new Set<string>();

      for (const lk of links) {
        const qtyDelta = round3((Number(lk.cantidad) || 0) * sign);
        const montoDelta = round2((Number(lk.monto) || 0) * sign);

        if (lk.otId) {
          const ot = db.ordenesTrabajo.find((o) => o.id === String(lk.otId));
          if (ot) {
            touchedOtIds.add(ot.id);
            const line = ot.items.find(
              (l) => l.id === String(lk.lineId || "") || l.servicioId === String(lk.servicioId || "")
            );
            if (line) {
              const targetQty = line.cantidadEjecutada > 0 ? line.cantidadEjecutada : line.cantidadPrevista;
              const nextBilled = Math.max(0, round3(line.cantidadFacturada + qtyDelta));
              // Control anti-doble-facturación (tope en targetQty si no es NC y no se forzó)
              if (!esNotaCredito && !body.allowOverbill && targetQty > 0 && nextBilled > targetQty + 0.001) {
                return NextResponse.json(
                  {
                    ok: false,
                    message: `Bloqueo anti-duplicación: la línea "${line.nombre}" de ${ot.numero} solo tiene ${round3(targetQty - line.cantidadFacturada)} ${line.unidadMedida} pendientes de facturar.`,
                  },
                  { status: 409 }
                );
              }
              line.cantidadFacturada = nextBilled;
            }
            ot.totalFacturado = Math.max(0, round2(ot.totalFacturado + montoDelta));
            if (saleId && !ot.facturasIds.includes(saleId)) {
              ot.facturasIds.push(saleId);
            }
            ot.auditLog.unshift({
              at: now,
              by: actor,
              action: esNotaCredito ? "nota_credito_vinculada" : "factura_vinculada",
              detail: `${inv.tipoBase || "Factura"} ${inv.letra || ""} ${numeroCompleto} · $${Math.abs(montoDelta)}`,
            });
          }
        }

        if (lk.parteId) {
          const parte = db.partesServicio.find((p) => p.id === String(lk.parteId));
          if (parte) {
            parte.facturado = !esNotaCredito;
            if (saleId && !parte.facturaIds.includes(saleId)) {
              parte.facturaIds.push(saleId);
            }
          }
        }

        if (lk.abonoId && lk.periodo) {
          const ab = db.abonos.find((x) => x.id === String(lk.abonoId));
          if (ab) {
            const perKey = String(lk.periodo);
            ab.periodosGenerados[perKey] = {
              generatedAt: ab.periodosGenerados[perKey]?.generatedAt || now,
              generatedBy: actor,
              status: esNotaCredito ? "borrador" : "facturado",
              saleId,
              numeroCompleto,
              importe: Math.abs(montoDelta) || ab.importe,
            };
            if (!esNotaCredito) {
              ab.proximoVencimiento = addMonthsIso(
                ab.proximoVencimiento || now.slice(0, 10),
                frequencyToMonths(ab.frecuencia)
              );
            }
            ab.updatedAt = now;
          }
        }
      }

      for (const otId of touchedOtIds) {
        const ot = db.ordenesTrabajo.find((o) => o.id === otId);
        if (ot) {
          recomputeOtTotals(ot, db.partesServicio);
          ot.updatedAt = now;
        }
      }

      const facturaRec: FacturaVinculadaServicio = {
        id: uid("fsv"),
        saleId: saleId || uid("sale"),
        numeroCompleto,
        tipoBase: String(inv.tipoBase || "Factura"),
        letra: String(inv.letra || "A"),
        fechaIso: String(inv.fechaIso || now.slice(0, 10)),
        billingClientId: Number(inv.billingClientId || 0),
        billingClientNombre: String(inv.billingClientNombre || ""),
        montoFacturado: round2(inv.montoFacturado || 0),
        origenOperacion: inv.origenOperacion === "MIXTA" ? "MIXTA" : "SERVICIOS",
        esNotaCredito,
        lineasFacturadas: links.map((lk: AnyObj) => ({
          otId: lk.otId ? String(lk.otId) : undefined,
          parteId: lk.parteId ? String(lk.parteId) : undefined,
          abonoId: lk.abonoId ? String(lk.abonoId) : undefined,
          presupuestoId: lk.presupuestoId ? String(lk.presupuestoId) : undefined,
          lineId: String(lk.lineId || ""),
          descripcion: String(lk.descripcion || ""),
          cantidad: round3(lk.cantidad || 0),
          monto: round2(lk.monto || 0),
        })),
        aprobacionAdminEstado: db.config.requiereAprobacionAdminFacturacion
          ? "pendiente"
          : "aprobada",
        retenciones: [],
        createdAt: now,
        createdBy: actor,
      };

      db.facturasVinculadas.unshift(facturaRec);
      return commit("register_invoice_link", {
        factura: facturaRec,
        message: `Comprobante ${numeroCompleto} vinculado con trazabilidad a Gestión de Servicios.`,
      });
    }

    // 11. RETENCIONES Y APROBACIÓN ADMINISTRATIVA SOBRE FACTURAS DE SERVICIOS
    if (action === "update_invoice_admin_retencion") {
      const fId = String(body.facturaId || body.id || "");
      const fac = db.facturasVinculadas.find((f) => f.id === fId || f.saleId === fId);
      if (!fac) {
        return NextResponse.json({ ok: false, message: "Factura vinculada no encontrada." }, { status: 404 });
      }
      if (body.aprobacionAdminEstado === "aprobada" || body.aprobacionAdminEstado === "pendiente") {
        fac.aprobacionAdminEstado = body.aprobacionAdminEstado;
        fac.aprobacionAdminFecha = body.aprobacionAdminEstado === "aprobada" ? now.slice(0, 10) : "";
      }
      if (body.retencion && typeof body.retencion === "object") {
        if (!Array.isArray(fac.retenciones)) fac.retenciones = [];
        fac.retenciones.push({
          id: uid("ret"),
          tipo: String(body.retencion.tipo || "IIBB"),
          certificado: String(body.retencion.certificado || "").trim(),
          importe: Math.max(0, round2(body.retencion.importe || 0)),
          fecha: String(body.retencion.fecha || now.slice(0, 10)),
        });
      }
      return commit("update_invoice_admin_retencion", {
        factura: fac,
        message: "Seguimiento administrativo / retención registrada.",
      });
    }

    // 12. ESCENARIO DE VALIDACIÓN INICIAL: INSPECCIONES NO DESTRUCTIVAS (COMODORO RIVADAVIA)
    if (action === "load_demo_end_comodoro") {
      const { payload: cliDb } = await getTenantDoc<AnyObj>(
        tenant,
        "clientes_db",
        seedDocs.clientes_db as AnyObj
      );
      if (!Array.isArray(cliDb.clientes)) cliDb.clientes = [];

      const ensureDemoClient = (
        nombre: string,
        cuit: string,
        localidad: string,
        provincia: string
      ) => {
        const found = cliDb.clientes.find(
          (c: AnyObj) => String(c.nroDoc || "").replace(/\D/g, "") === cuit.replace(/\D/g, "")
        );
        if (found) return found;
        const maxId = cliDb.clientes.reduce(
          (mx: number, c: AnyObj) => Math.max(mx, Number(c.id || 0)),
          1
        );
        const maxCod = cliDb.clientes.reduce(
          (mx: number, c: AnyObj) => Math.max(mx, Number(c.codigo || 0)),
          1
        );
        const created = {
          id: maxId + 1,
          codigo: maxCod + 1,
          codigoProveedor: maxCod + 1,
          nombre: nombre.toUpperCase(),
          razonSocial: nombre.toUpperCase(),
          nombreFantasia: nombre.toUpperCase(),
          tipoDoc: "CUIT",
          nroDoc: cuit,
          respIva: "INSCRIPTO",
          pais: "ARGENTINA",
          provincia: provincia.toUpperCase(),
          localidad: localidad.toUpperCase(),
          cp: "9000",
          calle: "RUTA NACIONAL 3 KM 1832",
          numero: "S/N",
          telefono: "2974551200",
          email: "compras@patagoniaenergia.com.ar",
          esCliente: true,
          esProveedor: false,
          estado: "A",
          saldoActual: 0,
          fechaAlta: new Date().toLocaleDateString("es-AR"),
        };
        cliDb.clientes.push(created);
        return created;
      };

      const cliSolicitante = ensureDemoClient(
        "OPERADORA PETROLERA GOLFO SAN JORGE S.A.",
        "30-71548920-4",
        "COMODORO RIVADAVIA",
        "CHUBUT"
      );
      const cliFacturarA = ensureDemoClient(
        "ADMINISTRACION CENTRAL ENERGIA PATAGONIA S.A.",
        "30-71548999-9",
        "COMODORO RIVADAVIA",
        "CHUBUT"
      );
      cliDb.updatedAt = now;
      await putTenantDoc(tenant, "clientes_db", cliDb, actor, "servicios_demo_clients");

      const demo = buildComodoroEndDemoPayload({
        solicitanteClientId: Number(cliSolicitante.id),
        solicitanteNombre: String(cliSolicitante.nombre),
        facturarAClientId: Number(cliFacturarA.id),
        facturarANombre: String(cliFacturarA.nombre),
        actor,
      });

      for (const s of demo.servicios) {
        if (!db.catalogo.some((x) => x.id === s.id)) db.catalogo.push(s);
      }
      if (!db.personal.some((x) => x.id === demo.inspector.id)) {
        db.personal.push(demo.inspector);
      }
      if (!db.presupuestos.some((x) => x.id === demo.presupuesto.id)) {
        db.presupuestos.unshift(demo.presupuesto);
        db.config.nextPresupuestoSeq = Math.max(db.config.nextPresupuestoSeq, 2);
      }
      if (!db.ordenesTrabajo.some((x) => x.id === demo.ordenTrabajo.id)) {
        db.ordenesTrabajo.unshift(demo.ordenTrabajo);
        db.config.nextOtSeq = Math.max(db.config.nextOtSeq, 2);
      }
      if (!db.abonos.some((x) => x.id === demo.abono.id)) {
        db.abonos.unshift(demo.abono);
        db.config.nextAbonoSeq = Math.max(db.config.nextAbonoSeq, 2);
      }

      db.clientProfiles[String(cliSolicitante.id)] = {
        clientId: Number(cliSolicitante.id),
        contactoTecnicoNombre: "Ing. Laura Morales (Jefa de Integridad)",
        contactoTecnicoTel: "+54 9 297 501-4420",
        contactoTecnicoEmail: "l.morales@golfosanjorge.com.ar",
        contactoAdminNombre: "Cdor. Rodrigo Paz (Cuentas a Pagar)",
        contactoAdminTel: "+54 9 297 446-9100",
        contactoAdminEmail: "facturacion@energiapatagonia.com.ar",
        condicionesContratacion: "Contrato Marco END 2026 — Requiere informe técnico PDF + conformidad firmada en campo.",
        condicionesPago: "30 días fecha factura con aprobación administrativa de certificado de servicio",
        plazoPagoDias: 30,
        codigoInternoCliente: "PROV-END-084",
        ordenesCompraRef: "OC-CR-2026-0418",
        defaultBillingClientId: Number(cliFacturarA.id),
        ubicaciones: [
          {
            id: "loc_demo_km8",
            nombre: "Planta Compresora Kilómetro 8",
            direccion: "Ruta Nacional 3 Km 1832",
            localidad: "Comodoro Rivadavia",
            provincia: "Chubut",
            contactoSitio: "Supervisor Carlos Díaz",
            telefonoSitio: "+54 9 297 480-1122",
            notas: "Ingreso por Portería Norte con ropa ignífuga y permiso de trabajo.",
          },
        ],
        tarifasEspeciales: [],
        updatedAt: now,
        updatedBy: actor,
      };

      return commit("load_demo_end_comodoro", {
        message:
          "Escenario de validación END Comodoro Rivadavia cargado (15 soldaduras UT, cliente solicitante ≠ establecimiento ≠ razón social destinataria de factura).",
      });
    }

    return NextResponse.json(
      { ok: false, message: `Acción no soportada en servicios: ${action}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: false, message: "Método no permitido" }, { status: 405 });
}
