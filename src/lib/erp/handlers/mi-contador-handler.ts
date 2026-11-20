import { NextRequest, NextResponse } from "next/server";
import { extractErpSessionFromRequest } from "../erp-session";
import {
  type CompraFiscalRecord,
  type CondicionFiscalTipo,
  DEFAULT_MONOTRIBUTO_ESCALAS,
  formatArcaAmount15,
  type GastoRetiroRecord,
  mapArcaCbteTipoCode,
  type MiContadorDbDoc,
  type MonotributoActividadTipo,
  type MonotributoEscalaItem,
  padLeftNum,
  type PresentacionArcaRecord,
  r2,
  type RetencionPercepcionRecord,
} from "../mi-contador-types";
import { getTenantDoc, putTenantDoc } from "../supabase-server";
import { type ErpTenantRecord, GENERAL_ADMIN_USERNAME } from "../types";

type AnyObj = Record<string, any>;

export const MI_CONTADOR_DOC_KEY = "mi_contador_db";

function currentPeriodYm(): string {
  const iso = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
  return iso.slice(0, 7);
}

function prevPeriodYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildInitialMiContadorDb(tenant: ErpTenantRecord): MiContadorDbDoc {
  const nowIso = new Date().toISOString();
  const condRaw = String(tenant.branding?.condIva || "").toUpperCase();
  const condicionFiscal: CondicionFiscalTipo = condRaw.includes("MONOTRIB")
    ? "MONOTRIBUTO"
    : condRaw.includes("EXENT")
      ? "EXENTO"
      : "RI";

  return {
    updatedAt: nowIso,
    fiscalConfig: {
      condicionFiscal,
      cuit: String(tenant.branding?.cuitFmt || "").replace(/[^\d-]/g, ""),
      razonSocial: tenant.business_name || tenant.fantasy_name || "Mi Comercio",
      actividadPrincipal: "Venta al por menor en comercios / Servicios",
      jurisdiccionIibb: String(tenant.branding?.provincia || "CÓRDOBA").toUpperCase(),
      alicuotaIibbPct: 3.0,
      alicuotaIibbServiciosPct: 4.0,
      categoriaMonotributoActual: "D",
      tipoActividadMonotributo: "VENTA_COSAS_MUEBLES",
      saldoTecnicoIvaAnterior: 0,
      saldoLibreDispIvaAnterior: 0,
      saldoFavorIibbAnterior: 0,
      gastosFijosMensualesBase: 0,
      cuitDelegadoArca: "",
      delegacionPortalIvaActiva: false,
      delegacionSifereActiva: false,
      updatedAt: nowIso,
    },
    monotributoEscalas: DEFAULT_MONOTRIBUTO_ESCALAS.map((x) => ({ ...x })),
    compras: [],
    gastosRetiros: [],
    retenciones: [],
    presentaciones: [],
  };
}

async function loadMiContadorDb(tenant: ErpTenantRecord): Promise<MiContadorDbDoc> {
  const init = buildInitialMiContadorDb(tenant);
  const { payload } = await getTenantDoc<Partial<MiContadorDbDoc>>(
    tenant,
    MI_CONTADOR_DOC_KEY,
    init
  );
  return {
    updatedAt: payload?.updatedAt || init.updatedAt,
    fiscalConfig: { ...init.fiscalConfig, ...(payload?.fiscalConfig || {}) },
    monotributoEscalas:
      Array.isArray(payload?.monotributoEscalas) && payload.monotributoEscalas.length > 0
        ? payload.monotributoEscalas
        : init.monotributoEscalas,
    compras: Array.isArray(payload?.compras) ? payload.compras : [],
    gastosRetiros: Array.isArray(payload?.gastosRetiros) ? payload.gastosRetiros : [],
    retenciones: Array.isArray(payload?.retenciones) ? payload.retenciones : [],
    presentaciones: Array.isArray(payload?.presentaciones) ? payload.presentaciones : [],
  };
}

function classifyPaymentMethod(raw: string): {
  bucket: "EFECTIVO" | "BANCARIZADO" | "CTA_CTE";
  label: string;
} {
  const s = String(raw || "EFECTIVO").toUpperCase().trim();
  if (s.includes("CTA") || s.includes("CORRIENTE") || s.includes("FIADO")) {
    return { bucket: "CTA_CTE", label: "Cuenta Corriente" };
  }
  if (s.includes("EFECT") || s.includes("CONTADO") || s === "CASH") {
    return { bucket: "EFECTIVO", label: "Efectivo" };
  }
  if (s.includes("DEB")) return { bucket: "BANCARIZADO", label: "Tarjeta Débito" };
  if (s.includes("CRED")) return { bucket: "BANCARIZADO", label: "Tarjeta Crédito" };
  if (s.includes("QR") || s.includes("MP") || s.includes("MERCADO")) {
    return { bucket: "BANCARIZADO", label: "Mercado Pago / QR" };
  }
  if (s.includes("TRANSF") || s.includes("BANC")) {
    return { bucket: "BANCARIZADO", label: "Transferencia Bancaria" };
  }
  if (s.includes("CHEQ")) return { bucket: "BANCARIZADO", label: "Cheque" };
  return { bucket: "BANCARIZADO", label: s || "Otro Bancarizado" };
}

function getArcaCalendarForCuit(cuitRaw: string, periodoYm: string) {
  const digits = String(cuitRaw || "").replace(/\D/g, "");
  const lastDigit = digits.length > 0 ? Number(digits[digits.length - 1]) : 0;
  const [y, m] = periodoYm.split("-").map(Number);
  // El período YYYY-MM vence al mes siguiente
  const nextMonthDate = new Date(Date.UTC(y, m, 1));
  const vtoY = nextMonthDate.getUTCFullYear();
  const vtoM = String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0");

  // Cronograma habitual ARCA según terminación CUIT (referencial)
  const offset = Math.floor(lastDigit / 2); // 0-1 -> +0, 2-3 -> +1, ..., 8-9 -> +4
  const diaIva = 18 + offset;
  const diaIibb = 14 + offset;
  const diaMono = 20;

  return {
    cuitTerminacion: digits ? String(lastDigit) : "No configurado",
    periodoFiscal: periodoYm,
    vencimientos: [
      {
        formulario: "F.2083",
        nombre: "Libro de IVA Digital (Registración Electrónica)",
        fechaEstimada: `${vtoY}-${vtoM}-${String(diaIva).padStart(2, "0")}`,
        aplica: "Responsable Inscripto",
        portal: "ARCA → Clave Fiscal → Portal IVA → Registración Electrónica",
      },
      {
        formulario: "F.2051",
        nombre: "Declaración Jurada Mensual de IVA (IVA Simple)",
        fechaEstimada: `${vtoY}-${vtoM}-${String(diaIva).padStart(2, "0")}`,
        aplica: "Responsable Inscripto",
        portal: "ARCA → Clave Fiscal → Portal IVA → Determinación del impuesto",
      },
      {
        formulario: "F.5663",
        nombre: "Ingresos Brutos Locales — Provincia de Córdoba (SIFERE Locales)",
        fechaEstimada: `${vtoY}-${vtoM}-${String(diaIibb).padStart(2, "0")}`,
        aplica: "Responsable Inscripto / Local Córdoba",
        portal: "ARCA → Clave Fiscal → SIFERE Locales – Provincia de Córdoba",
      },
      {
        formulario: "MONOTRIBUTO",
        nombre: "Pago Mensual Monotributo / Recategorización Semestral (Ene/Jul)",
        fechaEstimada: `${vtoY}-${vtoM}-${String(diaMono).padStart(2, "0")}`,
        aplica: "Monotributista",
        portal: "ARCA → Clave Fiscal → Monotributo",
      },
    ],
  };
}

function generateF2083TxtFiles(params: {
  periodo: string;
  ventasCbtes: AnyObj[];
  compras: CompraFiscalRecord[];
}) {
  const { ventasCbtes, compras } = params;

  // 1. LIBRO_IVA_DIGITAL_VENTAS_CBTE.txt (diseño simplificado oficial de longitud fija ARCA RG 4597)
  const ventasCbteLines: string[] = [];
  const ventasAlicLines: string[] = [];

  for (const v of ventasCbtes) {
    const fechaYmd = String(v.fechaIso || "").replace(/\D/g, "").slice(0, 8).padEnd(8, "0");
    const tipoCod = mapArcaCbteTipoCode(v.tipoBase || "Factura", v.letra || "B");
    const pv = padLeftNum(v.pv || "0002", 5);
    const nro = padLeftNum(v.nro || 1, 20);
    const docTipo = v.letra === "A" ? "80" : "99";
    const docNro = padLeftNum(v.clienteDoc || "0", 20);
    const denom = String(v.clienteNombre || "CONSUMIDOR FINAL")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9 .,-]/g, "")
      .slice(0, 30)
      .padEnd(30, " ");
    const total = Math.abs(Number(v.importe || 0));
    const neto21 = r2(total / 1.21);
    const iva21 = r2(total - neto21);

    ventasCbteLines.push(
      `${fechaYmd}${tipoCod}${pv}${nro}${nro}${docTipo}${docNro}${denom}` +
        `${formatArcaAmount15(total)}${formatArcaAmount15(0)}${formatArcaAmount15(0)}` +
        `${formatArcaAmount15(0)}${formatArcaAmount15(0)}${formatArcaAmount15(0)}` +
        `${formatArcaAmount15(0)}${formatArcaAmount15(0)}PES000100000010${formatArcaAmount15(0)}${fechaYmd}`
    );

    ventasAlicLines.push(
      `${tipoCod}${pv}${nro}${formatArcaAmount15(neto21)}0005${formatArcaAmount15(iva21)}`
    );
  }

  // 2. LIBRO_IVA_DIGITAL_COMPRAS_CBTE.txt y ALICUOTAS
  const comprasCbteLines: string[] = [];
  const comprasAlicLines: string[] = [];

  for (const c of compras) {
    const fechaYmd = String(c.fecha || "").replace(/\D/g, "").slice(0, 8).padEnd(8, "0");
    const tipoCod = mapArcaCbteTipoCode(c.tipoComprobante, c.tipoComprobante.slice(-1));
    const pv = padLeftNum(c.puntoVenta || "0001", 5);
    const nro = padLeftNum(c.numero || "1", 20);
    const cuitProv = padLeftNum(c.cuitProveedor || "0", 20);
    const denom = String(c.razonSocialProveedor || "PROVEEDOR")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9 .,-]/g, "")
      .slice(0, 30)
      .padEnd(30, " ");

    const alicCount =
      (c.netoGravado21 > 0 ? 1 : 0) +
      (c.netoGravado105 > 0 ? 1 : 0) +
      (c.netoGravado27 > 0 ? 1 : 0);

    comprasCbteLines.push(
      `${fechaYmd}${tipoCod}${pv}${nro}${" ".repeat(16)}80${cuitProv}${denom}` +
        `${formatArcaAmount15(c.total)}${formatArcaAmount15(c.exentoNoGravado)}` +
        `${formatArcaAmount15(0)}${formatArcaAmount15(c.percepcionIva)}` +
        `${formatArcaAmount15(c.otrosImpuestos)}${formatArcaAmount15(c.percepcionIibb)}` +
        `${formatArcaAmount15(0)}${formatArcaAmount15(0)}PES0001000000${Math.max(1, alicCount)}0` +
        `${formatArcaAmount15(c.ivaTotal)}${formatArcaAmount15(0)}${"0".repeat(11)}${" ".repeat(30)}${formatArcaAmount15(0)}`
    );

    if (c.netoGravado21 > 0) {
      comprasAlicLines.push(
        `${tipoCod}${pv}${nro}80${cuitProv}${formatArcaAmount15(c.netoGravado21)}0005${formatArcaAmount15(c.iva21)}`
      );
    }
    if (c.netoGravado105 > 0) {
      comprasAlicLines.push(
        `${tipoCod}${pv}${nro}80${cuitProv}${formatArcaAmount15(c.netoGravado105)}0004${formatArcaAmount15(c.iva105)}`
      );
    }
    if (c.netoGravado27 > 0) {
      comprasAlicLines.push(
        `${tipoCod}${pv}${nro}80${cuitProv}${formatArcaAmount15(c.netoGravado27)}0006${formatArcaAmount15(c.iva27)}`
      );
    }
  }

  return {
    ventasCbteTxt: ventasCbteLines.join("\r\n"),
    ventasAlicuotasTxt: ventasAlicLines.join("\r\n"),
    comprasCbteTxt: comprasCbteLines.join("\r\n"),
    comprasAlicuotasTxt: comprasAlicLines.join("\r\n"),
    counts: {
      ventasCbtes: ventasCbteLines.length,
      ventasAlicuotas: ventasAlicLines.length,
      comprasCbtes: comprasCbteLines.length,
      comprasAlicuotas: comprasAlicLines.length,
    },
  };
}

export async function computeMiContadorAnalytics(
  tenant: ErpTenantRecord,
  mcDb: MiContadorDbDoc,
  periodoRaw?: string
) {
  const periodo =
    periodoRaw && /^\d{4}-\d{2}$/.test(periodoRaw) ? periodoRaw : currentPeriodYm();
  const prevYm = prevPeriodYm(periodo);
  const todayIso = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const [{ payload: ventasDb }, { payload: catalogDb }, { payload: clientesDb }, { payload: arcaDb }] =
    await Promise.all([
      getTenantDoc<AnyObj>(tenant, "ventas_db", {}),
      getTenantDoc<AnyObj>(tenant, "catalog_db", {}),
      getTenantDoc<AnyObj>(tenant, "clientes_db", {}),
      getTenantDoc<AnyObj>(tenant, "arca_comprobantes_db", {}),
    ]);

  const dailyRecords: AnyObj[] = Array.isArray(ventasDb?.dailyRecords)
    ? ventasDb.dailyRecords
    : [];
  const artMonthly: AnyObj[] = Array.isArray(ventasDb?.artMonthly)
    ? ventasDb.artMonthly
    : [];
  const artRecentDaily: AnyObj[] = Array.isArray(ventasDb?.artRecentDaily)
    ? ventasDb.artRecentDaily
    : [];
  const articulos: AnyObj[] = Array.isArray(catalogDb?.articulos)
    ? catalogDb.articulos
    : [];
  const clientes: AnyObj[] = Array.isArray(clientesDb?.clientes)
    ? clientesDb.clientes
    : [];

  // Recopilar comprobantes detallados de las 3 cajas + comprobantes ARCA
  const allBoxEntries: AnyObj[] = [];
  const cajas = ventasDb?.comprobantesPorCaja || {};
  for (const ck of ["caja1", "caja2", "caja3"]) {
    if (Array.isArray(cajas[ck])) {
      for (const entry of cajas[ck]) {
        if (entry && !entry.anulado) allBoxEntries.push(entry);
      }
    }
  }

  // ---- 1. VENTAS DEL PERÍODO, MES ANTERIOR, HOY Y 12 MESES MÓVILES ----
  const [py, pm] = periodo.split("-").map(Number);
  const ym12StartDate = new Date(Date.UTC(py, (pm || 1) - 12, 1));
  const ym12Start = `${ym12StartDate.getUTCFullYear()}-${String(ym12StartDate.getUTCMonth() + 1).padStart(2, "0")}`;

  let ventasPeriodoTotal = 0;
  let costoPeriodoTotal = 0;
  let cantidadTicketsPeriodo = 0;
  let ventasMesAnterior = 0;
  let ventasHoy = 0;
  let ventas12Meses = 0;

  let ventasContado = 0;
  let ventasCtaCte = 0;
  let ventasEfectivo = 0;
  let ventasBancarizadas = 0;

  const mediosDesglose: Record<string, { label: string; bucket: string; total: number; count: number }> = {};
  const ventasPorLetra: Record<string, number> = { A: 0, B: 0, C: 0, OTROS: 0 };
  const ventasMensualesMap: Record<string, number> = {};

  for (const r of dailyRecords) {
    const dStr = String(r.d || "");
    const ym = dStr.slice(0, 7);
    const v = Number(r.v || 0);
    const c = Number(r.c || 0);
    const n = Number(r.n || 1);

    if (ym >= ym12Start && ym <= periodo) {
      ventas12Meses += v;
      ventasMensualesMap[ym] = r2((ventasMensualesMap[ym] || 0) + v);
    }
    if (ym === prevYm) {
      ventasMesAnterior += v;
    }
    if (dStr === todayIso) {
      ventasHoy += v;
    }
    if (ym === periodo) {
      ventasPeriodoTotal += v;
      costoPeriodoTotal += c;
      cantidadTicketsPeriodo += n;

      const letra = String(r.l || "B").toUpperCase();
      if (letra === "A" || letra === "B" || letra === "C") {
        ventasPorLetra[letra] = r2((ventasPorLetra[letra] || 0) + v);
      } else {
        ventasPorLetra.OTROS = r2((ventasPorLetra.OTROS || 0) + v);
      }

      const cls = classifyPaymentMethod(r.m || "EFECTIVO");
      if (cls.bucket === "CTA_CTE") {
        ventasCtaCte += v;
      } else {
        ventasContado += v;
        if (cls.bucket === "EFECTIVO") ventasEfectivo += v;
        else ventasBancarizadas += v;
      }

      if (!mediosDesglose[cls.label]) {
        mediosDesglose[cls.label] = { label: cls.label, bucket: cls.bucket, total: 0, count: 0 };
      }
      mediosDesglose[cls.label].total = r2(mediosDesglose[cls.label].total + v);
      mediosDesglose[cls.label].count += n;
    }
  }

  // Comprobantes fiscales del período para Libro IVA Ventas F.2083
  const ventasPeriodoCbtes = allBoxEntries.filter((e) => {
    const f = String(e.fechaIso || "").slice(0, 7);
    const isSale = !e.entryType || e.entryType === "venta";
    const letra = String(e.letra || "B").toUpperCase();
    return isSale && f === periodo && letra !== "X";
  });

  // Retiros registrados en las cajas POS durante el período
  let retirosCajaErpPeriodo = 0;
  let retirosCajaHoy = 0;
  for (const e of allBoxEntries) {
    if (e.entryType === "retiro") {
      const fIso = String(e.fechaIso || e.createdAt || "").slice(0, 10);
      const imp = Math.abs(Number(e.importe || e.monto || 0));
      if (fIso.slice(0, 7) === periodo) retirosCajaErpPeriodo += imp;
      if (fIso === todayIso) retirosCajaHoy += imp;
    }
  }

  // ---- 2. COMPRAS, GASTOS OPERATIVOS, RETIROS Y RETENCIONES DEL PERÍODO ----
  const comprasPeriodo = mcDb.compras.filter((c) => c.periodo === periodo);
  const compras12Meses = mcDb.compras
    .filter((c) => c.periodo >= ym12Start && c.periodo <= periodo)
    .reduce((acc, c) => acc + Number(c.total || 0), 0);

  let comprasTotalPeriodo = 0;
  let creditoFiscalIvaPeriodo = 0;
  let percepcionesIvaCompras = 0;
  let percepcionesIibbCompras = 0;
  for (const c of comprasPeriodo) {
    const sign = c.tipoComprobante.startsWith("NC") ? -1 : 1;
    comprasTotalPeriodo += Number(c.total || 0) * sign;
    creditoFiscalIvaPeriodo += Number(c.ivaTotal || 0) * sign;
    percepcionesIvaCompras += Number(c.percepcionIva || 0) * sign;
    percepcionesIibbCompras += Number(c.percepcionIibb || 0) * sign;
  }

  const gastosRetirosPeriodo = mcDb.gastosRetiros.filter((g) => g.periodo === periodo);
  let gastosOperativosPeriodo = 0;
  let gastosFijosPeriodo = 0;
  let retirosTitularManualPeriodo = 0;
  let retirosManualHoy = 0;

  for (const g of gastosRetirosPeriodo) {
    if (g.tipo === "RETIRO_TITULAR") {
      retirosTitularManualPeriodo += Number(g.monto || 0);
      if (g.fecha === todayIso) retirosManualHoy += Number(g.monto || 0);
    } else {
      gastosOperativosPeriodo += Number(g.monto || 0);
      if (g.esFijo) gastosFijosPeriodo += Number(g.monto || 0);
    }
  }

  const gastos12Meses = mcDb.gastosRetiros
    .filter((g) => g.tipo === "GASTO" && g.periodo >= ym12Start && g.periodo <= periodo)
    .reduce((acc, g) => acc + Number(g.monto || 0), 0);

  const retirosTotalesPeriodo = r2(retirosCajaErpPeriodo + retirosTitularManualPeriodo);
  const retirosHoy = r2(retirosCajaHoy + retirosManualHoy);

  const retencionesPeriodo = mcDb.retenciones.filter((r) => r.periodo === periodo);
  const retencionesIvaExtra = retencionesPeriodo
    .filter((r) => r.impuesto === "IVA")
    .reduce((acc, r) => acc + Number(r.monto || 0), 0);
  const retencionesIibbExtra = retencionesPeriodo
    .filter((r) => r.impuesto === "IIBB_CORDOBA")
    .reduce((acc, r) => acc + Number(r.monto || 0), 0);

  // ---- 3. LIQUIDACIÓN ARCA: F.2051 (IVA SIMPLE), F.2083 (LIBRO IVA DIGITAL), F.5663 (IIBB CÓRDOBA) ----
  const cfg = mcDb.fiscalConfig;
  const isRI = cfg.condicionFiscal === "RI";

  // Estimación de neto gravado y débito fiscal de ventas del período (alícuota 21% estándar; RI discrimina)
  const ventasNetoGravado21 = isRI ? r2(ventasPeriodoTotal / 1.21) : r2(ventasPeriodoTotal);
  const debitoFiscalIvaPeriodo = isRI ? r2(ventasPeriodoTotal - ventasNetoGravado21) : 0;
  const creditoFiscalTotal = r2(creditoFiscalIvaPeriodo);
  const saldoTecnicoPeriodo = r2(debitoFiscalIvaPeriodo - creditoFiscalTotal);
  const saldoTecnicoAnterior = r2(cfg.saldoTecnicoIvaAnterior || 0);
  const saldoTecnicoFinal = r2(saldoTecnicoPeriodo - saldoTecnicoAnterior);

  const retencionesPercepcionesIvaTotal = r2(percepcionesIvaCompras + retencionesIvaExtra);
  const saldoLibreDispAnterior = r2(cfg.saldoLibreDispIvaAnterior || 0);
  const saldoLibreDispTotal = r2(retencionesPercepcionesIvaTotal + saldoLibreDispAnterior);

  let ivaF2051APagar = 0;
  let ivaF2051SaldoFavorTecnico = 0;
  let ivaF2051SaldoFavorLibreDisp = 0;

  if (saldoTecnicoFinal > 0) {
    const neto = r2(saldoTecnicoFinal - saldoLibreDispTotal);
    if (neto >= 0) {
      ivaF2051APagar = neto;
    } else {
      ivaF2051SaldoFavorLibreDisp = Math.abs(neto);
    }
  } else {
    ivaF2051SaldoFavorTecnico = Math.abs(saldoTecnicoFinal);
    ivaF2051SaldoFavorLibreDisp = saldoLibreDispTotal;
  }

  // F.5663 — Ingresos Brutos Locales de Córdoba (SIFERE Locales)
  const baseImponibleIibb = isRI ? ventasNetoGravado21 : r2(ventasPeriodoTotal);
  const alicuotaIibbPct = Number(cfg.alicuotaIibbPct || 3.0);
  const iibbImpuestoDeterminado = r2((baseImponibleIibb * alicuotaIibbPct) / 100);
  const iibbRetencionesPercepciones = r2(percepcionesIibbCompras + retencionesIibbExtra);
  const iibbSaldoFavorAnterior = r2(cfg.saldoFavorIibbAnterior || 0);
  const iibbResultado = r2(
    iibbImpuestoDeterminado - iibbRetencionesPercepciones - iibbSaldoFavorAnterior
  );
  const iibbF5663APagar = iibbResultado > 0 ? iibbResultado : 0;
  const iibbF5663SaldoFavor = iibbResultado < 0 ? Math.abs(iibbResultado) : 0;

  // ---- 4. MONITOR MONOTRIBUTO (12 MESES MÓVILES + REGLA 80% / 40%) ----
  const escalas: MonotributoEscalaItem[] = (mcDb.monotributoEscalas || DEFAULT_MONOTRIBUTO_ESCALAS)
    .slice()
    .sort((a, b) => Number(a.topeIngresosAnualArs) - Number(b.topeIngresosAnualArs));

  const catActualObj =
    escalas.find((e) => e.categoria === cfg.categoriaMonotributoActual) || escalas[0];
  const catSugeridaObj =
    escalas.find((e) => ventas12Meses <= Number(e.topeIngresosAnualArs)) || null;
  const topeMaxMonotributo = escalas.length > 0 ? escalas[escalas.length - 1].topeIngresosAnualArs : 0;
  const excluidoPorFacturacion = topeMaxMonotributo > 0 && ventas12Meses > topeMaxMonotributo;
  const pctConsumidoCatActual =
    catActualObj && catActualObj.topeIngresosAnualArs > 0
      ? r2((ventas12Meses / catActualObj.topeIngresosAnualArs) * 100)
      : 0;
  const margenRestanteCatActual = catActualObj
    ? r2(catActualObj.topeIngresosAnualArs - ventas12Meses)
    : 0;
  const pctConsumidoTopeMax =
    topeMaxMonotributo > 0 ? r2((ventas12Meses / topeMaxMonotributo) * 100) : 0;

  const totalComprasGastos12m = r2(compras12Meses + gastos12Meses);
  const ratioComprasGastosSobreVentasPct =
    ventas12Meses > 0 ? r2((totalComprasGastos12m / ventas12Meses) * 100) : 0;
  const limiteLegalComprasPct =
    cfg.tipoActividadMonotributo === "SERVICIOS" ? 40 : 80;
  const alertaExclusionCompras =
    ventas12Meses > 0 && ratioComprasGastosSobreVentasPct > limiteLegalComprasPct;

  // ---- 5. INTELIGENCIA DE STOCK (ABASTECIMIENTO, ROTACIÓN ABC, STOCK MUERTO) ----
  const activeArts = articulos.filter(
    (a) => Number(a.id) !== 4407 && !a.bl && String(a.c || "") !== "00020"
  );

  // Ventas por artículo en el período y en últimos 60/90 días
  const artSalesPeriod = new Map<number, { qty: number; venta: number; costo: number }>();
  for (const m of artMonthly) {
    if (m.ym === periodo) {
      const aid = Number(m.a);
      const prev = artSalesPeriod.get(aid) || { qty: 0, venta: 0, costo: 0 };
      prev.qty += Number(m.q || 0);
      prev.venta += Number(m.v || 0);
      prev.costo += Number(m.c || 0);
      artSalesPeriod.set(aid, prev);
    }
  }

  // Fecha límite 60 días atrás para detectar Stock Muerto
  const d60 = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
  const ym60 = d60.slice(0, 7);
  const soldRecentlySet = new Set<number>();
  for (const rd of artRecentDaily) {
    if (String(rd.d || "") >= d60 && Number(rd.q || 0) > 0) {
      soldRecentlySet.add(Number(rd.a));
    }
  }
  for (const m of artMonthly) {
    if (String(m.ym || "") >= ym60 && Number(m.q || 0) > 0) {
      soldRecentlySet.add(Number(m.a));
    }
  }

  let stockValorizadoCostoTotal = 0;
  let stockValorizadoVentaTotal = 0;
  const alertasAbastecimiento: AnyObj[] = [];
  const stockMuertoLista: AnyObj[] = [];
  const rotacionLista: AnyObj[] = [];

  for (const a of activeArts) {
    const aid = Number(a.id);
    const sf = Number(a.sf || 0);
    const sm = Number(a.sm || 0);
    const costoU = Number(a.cfn || a.cn || 0);
    const precioU = Number(a.p1f || a.p || 0);

    if (sf > 0) {
      stockValorizadoCostoTotal += sf * costoU;
      stockValorizadoVentaTotal += sf * precioU;
    }

    const sp = artSalesPeriod.get(aid);
    const velocidadDiaria = sp && sp.qty > 0 ? sp.qty / 30 : 0;
    const diasCobertura = velocidadDiaria > 0 ? Math.round(sf / velocidadDiaria) : null;

    if (sf <= 0 || (sm > 0 && sf <= sm) || (diasCobertura !== null && diasCobertura <= 7 && sf > 0)) {
      alertasAbastecimiento.push({
        id: aid,
        codigo: a.c || "",
        nombre: a.n || "",
        stockActual: r2(sf),
        stockMinimo: r2(sm),
        diasCobertura,
        costoReposicionUnit: r2(costoU),
        prioridad: sf <= 0 ? "CRITICA" : sm > 0 && sf <= sm ? "ALTA" : "MEDIA",
      });
    }

    if (sf > 0 && !soldRecentlySet.has(aid)) {
      stockMuertoLista.push({
        id: aid,
        codigo: a.c || "",
        nombre: a.n || "",
        stockActual: r2(sf),
        capitalCostoInmovilizado: r2(sf * costoU),
        valorVentaPotencial: r2(sf * precioU),
      });
    }

    if (sp && sp.qty > 0) {
      rotacionLista.push({
        id: aid,
        codigo: a.c || "",
        nombre: a.n || "",
        unidades: r2(sp.qty),
        venta: r2(sp.venta),
        costo: r2(sp.costo),
        margenArs: r2(sp.venta - sp.costo),
        margenPct: sp.venta > 0 ? r2(((sp.venta - sp.costo) / sp.venta) * 100) : 0,
        stockActual: r2(sf),
      });
    }
  }

  alertasAbastecimiento.sort((a, b) => {
    const order: Record<string, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2 };
    return (order[a.prioridad] ?? 3) - (order[b.prioridad] ?? 3) || a.stockActual - b.stockActual;
  });
  stockMuertoLista.sort((a, b) => b.capitalCostoInmovilizado - a.capitalCostoInmovilizado);
  rotacionLista.sort((a, b) => b.venta - a.venta);

  const stockMuertoCapitalCosto = r2(
    stockMuertoLista.reduce((acc, x) => acc + Number(x.capitalCostoInmovilizado || 0), 0)
  );
  const stockMuertoValorVenta = r2(
    stockMuertoLista.reduce((acc, x) => acc + Number(x.valorVentaPotencial || 0), 0)
  );

  // Clasificación ABC sobre rotación
  const totalVentaRot = rotacionLista.reduce((acc, x) => acc + x.venta, 0);
  let cumVenta = 0;
  for (const item of rotacionLista) {
    cumVenta += item.venta;
    const pct = totalVentaRot > 0 ? (cumVenta / totalVentaRot) * 100 : 100;
    item.claseAbc = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
  }

  // ---- 6. CUENTAS CORRIENTES, CAJA, BANCOS Y HERRAMIENTAS FINANCIERAS ----
  let saldoACobrarClientes = 0;
  let deudaProveedores = 0;
  const topDeudores: AnyObj[] = [];

  for (const cl of clientes) {
    const sal = Number(cl.saldoActual || 0);
    if (cl.esCliente && sal > 0) {
      saldoACobrarClientes += sal;
      topDeudores.push({
        id: cl.id,
        nombre: cl.nombre || cl.razonSocial || "Cliente",
        saldo: r2(sal),
        ultimoMov: cl.ultimoMovFecha || cl.ultimoMov || "",
      });
    }
    if (cl.esProveedor && sal > 0) {
      deudaProveedores += sal;
    }
  }
  topDeudores.sort((a, b) => b.saldo - a.saldo);

  const cajaCentralSaldo = r2(ventasDb?.fondos?.cajaCentral?.saldoEfectivo || 0);
  const cajaTesoreriaSaldo = r2(ventasDb?.fondos?.cajaTesoreria?.saldoEfectivo || 0);
  const bancosCuentas: AnyObj[] = Array.isArray(ventasDb?.fondos?.bancos?.cuentas)
    ? ventasDb.fondos.bancos.cuentas
    : [];
  const saldoBancos = r2(
    bancosCuentas.reduce((acc, b) => acc + Number(b.saldo || b.saldoActual || 0), 0)
  );

  const margenBrutoArs = r2(ventasPeriodoTotal - costoPeriodoTotal);
  const margenBrutoPct =
    ventasPeriodoTotal > 0 ? r2((margenBrutoArs / ventasPeriodoTotal) * 100) : 30;
  const impuestosEstimadosMes = isRI
    ? r2(ivaF2051APagar + iibbF5663APagar)
    : r2(
        (cfg.tipoActividadMonotributo === "SERVICIOS"
          ? catActualObj?.cuotaMensualServiciosArs || 0
          : catActualObj?.cuotaMensualBienesArs || 0) + iibbF5663APagar
      );
  const gastosFijosConsiderados = Math.max(
    r2(gastosFijosPeriodo),
    r2(cfg.gastosFijosMensualesBase || 0)
  );
  const gastosTotalesMes = Math.max(r2(gastosOperativosPeriodo), gastosFijosConsiderados);
  const gananciaNetaEstimada = r2(margenBrutoArs - gastosTotalesMes - impuestosEstimadosMes);

  // Punto de Equilibrio (Break-even)
  const margenRatio = margenBrutoPct > 0 ? margenBrutoPct / 100 : 0.3;
  const puntoEquilibrioMensual =
    gastosFijosConsiderados > 0 ? r2(gastosFijosConsiderados / margenRatio) : 0;
  const puntoEquilibrioDiario = r2(puntoEquilibrioMensual / 26); // ~26 días comerciales
  const pctEquilibrioAlcanzado =
    puntoEquilibrioMensual > 0
      ? r2((ventasPeriodoTotal / puntoEquilibrioMensual) * 100)
      : 100;

  // Alerta de Descapitalización (Retiros vs Ganancia Neta)
  const excesoRetiros = r2(retirosTotalesPeriodo - Math.max(0, gananciaNetaEstimada));
  const alertaDescapitalizacion = retirosTotalesPeriodo > 0 && excesoRetiros > 0;

  // Capital de Trabajo / Liquidez
  const liquidezInmediata = r2(cajaCentralSaldo + cajaTesoreriaSaldo + saldoBancos);
  const capitalTrabajoNeto = r2(
    liquidezInmediata + saldoACobrarClientes - deudaProveedores - impuestosEstimadosMes
  );

  // Variación vs mes anterior
  const variacionMensualPct =
    ventasMesAnterior > 0
      ? r2(((ventasPeriodoTotal - ventasMesAnterior) / ventasMesAnterior) * 100)
      : null;

  const pctContado =
    ventasPeriodoTotal > 0 ? r2((ventasContado / ventasPeriodoTotal) * 100) : 0;
  const pctCtaCte =
    ventasPeriodoTotal > 0 ? r2((ventasCtaCte / ventasPeriodoTotal) * 100) : 0;
  const pctEfectivo =
    ventasContado > 0 ? r2((ventasEfectivo / ventasContado) * 100) : 0;
  const pctBancarizado =
    ventasContado > 0 ? r2((ventasBancarizadas / ventasContado) * 100) : 0;

  // Alertas ejecutivas automáticas
  const alertasEjecutivas: Array<{ nivel: "alta" | "media" | "ok"; titulo: string; detalle: string }> = [];
  if (alertaDescapitalizacion) {
    alertasEjecutivas.push({
      nivel: "alta",
      titulo: "Alerta de Descapitalización por Retiros",
      detalle: `Tus retiros del período ($${retirosTotalesPeriodo.toLocaleString("es-AR")}) superan la ganancia neta estimada ($${gananciaNetaEstimada.toLocaleString("es-AR")}) en $${excesoRetiros.toLocaleString("es-AR")}.`,
    });
  }
  if (stockMuertoCapitalCosto > 0) {
    alertasEjecutivas.push({
      nivel: "media",
      titulo: `Stock Muerto detectado (${stockMuertoLista.length} productos)`,
      detalle: `Tenés $${stockMuertoCapitalCosto.toLocaleString("es-AR")} (a costo) inmovilizados sin ventas en los últimos 60 días. Liquidar un 30% recuperaría liquidez inmediata.`,
    });
  }
  if (alertasAbastecimiento.length > 0) {
    const crit = alertasAbastecimiento.filter((x) => x.prioridad === "CRITICA").length;
    alertasEjecutivas.push({
      nivel: crit > 0 ? "alta" : "media",
      titulo: `Alertas de Abastecimiento (${alertasAbastecimiento.length} artículos)`,
      detalle: `${crit} artículos con quiebre de stock (0 o negativo) y ${alertasAbastecimiento.length - crit} próximos a agotarse.`,
    });
  }
  if (!isRI && (excluidoPorFacturacion || pctConsumidoCatActual >= 85 || alertaExclusionCompras)) {
    alertasEjecutivas.push({
      nivel: "alta",
      titulo: "Atención Monotributo ARCA",
      detalle: excluidoPorFacturacion
        ? "Tu facturación de los últimos 12 meses superó el tope máximo del Monotributo."
        : alertaExclusionCompras
          ? `Tus compras+gastos representan ${ratioComprasGastosSobreVentasPct}% de tus ventas (límite legal ${limiteLegalComprasPct}%).`
          : `Consumiste el ${pctConsumidoCatActual}% del tope de tu categoría ${cfg.categoriaMonotributoActual}.`,
    });
  }
  if (isRI && ivaF2051APagar > 0) {
    alertasEjecutivas.push({
      nivel: "media",
      titulo: `Posición Mensual IVA F.2051: $${ivaF2051APagar.toLocaleString("es-AR")} a pagar`,
      detalle: `Débito Fiscal $${debitoFiscalIvaPeriodo.toLocaleString("es-AR")} vs Crédito Fiscal $${creditoFiscalTotal.toLocaleString("es-AR")}. Cargá todas tus facturas de compra antes del vencimiento.`,
    });
  }

  return {
    periodo,
    prevYm,
    todayIso,
    arcaCuitCert: String(arcaDb?.certificado?.cuit || cfg.cuit || ""),
    ventas: {
      totalPeriodo: r2(ventasPeriodoTotal),
      totalMesAnterior: r2(ventasMesAnterior),
      variacionMensualPct,
      totalHoy: r2(ventasHoy),
      total12Meses: r2(ventas12Meses),
      cantidadTickets: cantidadTicketsPeriodo,
      ticketPromedio:
        cantidadTicketsPeriodo > 0 ? r2(ventasPeriodoTotal / cantidadTicketsPeriodo) : 0,
      costoPeriodo: r2(costoPeriodoTotal),
      margenBrutoArs,
      margenBrutoPct,
      contado: r2(ventasContado),
      ctaCte: r2(ventasCtaCte),
      pctContado,
      pctCtaCte,
      efectivo: r2(ventasEfectivo),
      bancarizado: r2(ventasBancarizadas),
      pctEfectivo,
      pctBancarizado,
      mediosDesglose: Object.values(mediosDesglose).sort((a, b) => b.total - a.total),
      porLetra: ventasPorLetra,
      evolucionMensual: Object.entries(ventasMensualesMap)
        .map(([ym, total]) => ({ ym, total }))
        .sort((a, b) => a.ym.localeCompare(b.ym)),
    },
    finanzas: {
      comprasPeriodo: r2(comprasTotalPeriodo),
      gastosOperativosPeriodo: r2(gastosOperativosPeriodo),
      gastosFijosConsiderados,
      retirosCajaErpPeriodo: r2(retirosCajaErpPeriodo),
      retirosTitularManualPeriodo: r2(retirosTitularManualPeriodo),
      retirosTotalesPeriodo,
      retirosHoy,
      impuestosEstimadosMes,
      gananciaNetaEstimada,
      alertaDescapitalizacion,
      excesoRetiros,
      puntoEquilibrioMensual,
      puntoEquilibrioDiario,
      pctEquilibrioAlcanzado,
      cajaCentralSaldo,
      cajaTesoreriaSaldo,
      saldoBancos,
      liquidezInmediata,
      saldoACobrarClientes: r2(saldoACobrarClientes),
      deudaProveedores: r2(deudaProveedores),
      capitalTrabajoNeto,
      topDeudores: topDeudores.slice(0, 15),
    },
    inventario: {
      totalArticulosActivos: activeArts.length,
      stockValorizadoCostoTotal: r2(stockValorizadoCostoTotal),
      stockValorizadoVentaTotal: r2(stockValorizadoVentaTotal),
      alertasAbastecimientoCount: alertasAbastecimiento.length,
      alertasAbastecimiento: alertasAbastecimiento.slice(0, 35),
      stockMuertoCount: stockMuertoLista.length,
      stockMuertoCapitalCosto,
      stockMuertoValorVenta,
      stockMuertoTop: stockMuertoLista.slice(0, 35),
      rotacionTop: rotacionLista.slice(0, 30),
    },
    arca: {
      f2051: {
        periodo,
        ventasTotalConIva: r2(ventasPeriodoTotal),
        ventasNetoGravado21,
        debitoFiscal: debitoFiscalIvaPeriodo,
        creditoFiscalCompras: creditoFiscalTotal,
        saldoTecnicoPeriodo,
        saldoTecnicoAnterior,
        saldoTecnicoFinal,
        percepcionesIvaCompras: r2(percepcionesIvaCompras),
        retencionesIvaExtra: r2(retencionesIvaExtra),
        saldoLibreDispAnterior,
        saldoLibreDispTotal,
        saldoAPagar: ivaF2051APagar,
        saldoFavorTecnicoSiguiente: ivaF2051SaldoFavorTecnico,
        saldoFavorLibreDispSiguiente: ivaF2051SaldoFavorLibreDisp,
      },
      f2083: {
        periodo,
        ventasCantidadCbtes: ventasPeriodoCbtes.length,
        comprasCantidadCbtes: comprasPeriodo.length,
        ventasTotal: r2(ventasPeriodoTotal),
        comprasTotal: r2(comprasTotalPeriodo),
      },
      f5663: {
        periodo,
        jurisdiccion: cfg.jurisdiccionIibb || "CÓRDOBA",
        baseImponible: baseImponibleIibb,
        alicuotaPct: alicuotaIibbPct,
        impuestoDeterminado: iibbImpuestoDeterminado,
        percepcionesIibbCompras: r2(percepcionesIibbCompras),
        retencionesIibbExtra: r2(retencionesIibbExtra),
        retencionesPercepcionesTotal: iibbRetencionesPercepciones,
        saldoFavorAnterior: iibbSaldoFavorAnterior,
        saldoAPagar: iibbF5663APagar,
        saldoFavorSiguiente: iibbF5663SaldoFavor,
      },
      monotributo: {
        categoriaActual: cfg.categoriaMonotributoActual,
        categoriaSugerida: catSugeridaObj ? catSugeridaObj.categoria : "EXCLUIDO (RI)",
        facturacion12Meses: r2(ventas12Meses),
        topeCategoriaActual: catActualObj?.topeIngresosAnualArs || 0,
        topeMaximoMonotributo: topeMaxMonotributo,
        pctConsumidoCatActual,
        pctConsumidoTopeMax,
        margenRestanteCatActual,
        excluidoPorFacturacion,
        comprasGastos12Meses: totalComprasGastos12m,
        ratioComprasGastosSobreVentasPct,
        limiteLegalComprasPct,
        alertaExclusionCompras,
        cuotaEstimadaActual:
          cfg.tipoActividadMonotributo === "SERVICIOS"
            ? catActualObj?.cuotaMensualServiciosArs || 0
            : catActualObj?.cuotaMensualBienesArs || 0,
        cuotaEstimadaSugerida: catSugeridaObj
          ? cfg.tipoActividadMonotributo === "SERVICIOS"
            ? catSugeridaObj.cuotaMensualServiciosArs
            : catSugeridaObj.cuotaMensualBienesArs
          : 0,
      },
      calendario: getArcaCalendarForCuit(cfg.cuit || String(arcaDb?.certificado?.cuit || ""), periodo),
    },
    alertasEjecutivas,
    _internalVentasCbtes: ventasPeriodoCbtes,
  };
}

function buildLocalExpertAnswer(question: string, analytics: AnyObj, cfg: AnyObj): string {
  const q = question.toLowerCase();
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);
  const v = analytics.ventas;
  const f = analytics.finanzas;
  const inv = analytics.inventario;
  const arca = analytics.arca;

  if (q.includes("retir") || q.includes("sacar plata") || q.includes("descapital")) {
    const disponible = Math.max(0, r2(f.gananciaNetaEstimada - f.retirosTotalesPeriodo));
    return [
      `💰 **Análisis de Retiros y Capital (${analytics.periodo}):**`,
      `• Margen bruto generado: **${fmt(v.margenBrutoArs)}** (${v.margenBrutoPct}%).`,
      `• Gastos operativos: **${fmt(f.gastosOperativosPeriodo)}** | Impuestos estimados: **${fmt(f.impuestosEstimadosMes)}**.`,
      `• Ganancia neta estimada real: **${fmt(f.gananciaNetaEstimada)}**.`,
      `• Retiros ya acumulados este mes: **${fmt(f.retirosTotalesPeriodo)}** (hoy: ${fmt(f.retirosHoy)}).`,
      f.alertaDescapitalizacion
        ? `⚠️ **Alerta:** Estás retirando **${fmt(f.excesoRetiros)} por encima** de la ganancia neta real. Frená retiros personales para no consumir capital de reposición de mercadería ni plata de impuestos.`
        : `✅ **Margen seguro para retirar sin descapitalizarte:** hasta **${fmt(disponible)}** en lo que resta del mes (se sugiere dejar al menos un 20% como reserva de reposición).`,
    ].join("\n");
  }

  if (q.includes("muerto") || q.includes("clavad") || q.includes("inmoviliz")) {
    const top5 = (inv.stockMuertoTop || [])
      .slice(0, 5)
      .map((x: AnyObj, i: number) => `${i + 1}. ${x.nombre} (${x.stockActual} u.) — ${fmt(x.capitalCostoInmovilizado)} a costo`)
      .join("\n");
    return [
      `🧊 **Detector de Stock Muerto (sin ventas en últimos 60 días):**`,
      `• Cantidad de productos inmovilizados: **${inv.stockMuertoCount}** artículos.`,
      `• Capital parado a costo: **${fmt(inv.stockMuertoCapitalCosto)}** (a precio de venta: ${fmt(inv.stockMuertoValorVenta)}).`,
      top5 ? `\n**Top 5 artículos con más capital frenado:**\n${top5}` : "",
      `\n🎯 **Acción sugerida:** Armá una promo relámpago (15%–25% OFF o combos 2x1) en estos productos para convertirlos en efectivo y reinvertir en tus artículos Clase A de alta rotación.`,
    ].join("\n");
  }

  if (q.includes("reponer") || q.includes("abastec") || q.includes("faltante") || q.includes("quiebre")) {
    const top5 = (inv.alertasAbastecimiento || [])
      .slice(0, 6)
      .map((x: AnyObj, i: number) => `${i + 1}. [${x.prioridad}] ${x.nombre} — Stock: ${x.stockActual} (Mín: ${x.stockMinimo})`)
      .join("\n");
    return [
      `📦 **Alertas de Abastecimiento y Reposición:**`,
      `• Tenés **${inv.alertasAbastecimientoCount}** artículos en alerta de stock.`,
      top5 ? `\n**Prioridad de compra inmediata:**\n${top5}` : "✅ Todo tu stock activo está por encima del mínimo configurado.",
      `\n💡 Tip: Generá el pedido a proveedores priorizando los ítems marcados como CRÍTICA y los Clase A en rotación.`,
    ].join("\n");
  }

  if (q.includes("iva") || q.includes("2051") || q.includes("2083") || q.includes("5663") || q.includes("ingresos brutos") || q.includes("arca") || q.includes("impuesto")) {
    return [
      `🏛️ **Pre-liquidación ARCA (${analytics.periodo}) — Condición: ${cfg.condicionFiscal}:**`,
      `• **F.2051 (IVA Simple):** Débito Fiscal **${fmt(arca.f2051.debitoFiscal)}** − Crédito Fiscal Compras **${fmt(arca.f2051.creditoFiscalCompras)}** − Ret/Perc IVA **${fmt(arca.f2051.percepcionesIvaCompras + arca.f2051.retencionesIvaExtra)}** → ${arca.f2051.saldoAPagar > 0 ? `**Saldo a Pagar: ${fmt(arca.f2051.saldoAPagar)}**` : `**Saldo a Favor Técnico: ${fmt(arca.f2051.saldoFavorTecnicoSiguiente)}**`}.`,
      `• **F.2083 (Libro IVA Digital):** ${arca.f2083.ventasCantidadCbtes} comprobantes de venta y ${arca.f2083.comprasCantidadCbtes} de compra listos para descargar en TXT oficial.`,
      `• **F.5663 (IIBB Córdoba ${arca.f5663.alicuotaPct}%):** Base imponible **${fmt(arca.f5663.baseImponible)}** → Impuesto determinado **${fmt(arca.f5663.impuestoDeterminado)}** − Ret/Perc/SIRCREB **${fmt(arca.f5663.retencionesPercepcionesTotal)}** → **Saldo a Pagar: ${fmt(arca.f5663.saldoAPagar)}**.`,
      `\n📌 Recordá cargar todas tus facturas de compra y retenciones SIRCREB antes del vencimiento para bajar al mínimo el saldo a pagar.`,
    ].join("\n");
  }

  if (q.includes("monotrib") || q.includes("categor") || q.includes("recateg")) {
    const m = arca.monotributo;
    return [
      `📊 **Monitor de Monotributo ARCA (12 meses móviles):**`,
      `• Facturación acumulada 12 meses: **${fmt(m.facturacion12Meses)}**.`,
      `• Categoría actual: **${m.categoriaActual}** (tope ${fmt(m.topeCategoriaActual)} — consumiste **${m.pctConsumidoCatActual}%**).`,
      `• Categoría sugerida hoy: **${m.categoriaSugerida}** | Margen disponible en tu categoría: **${fmt(m.margenRestanteCatActual)}**.`,
      `• Control anti-exclusión Compras+Gastos/Ventas: **${m.ratioComprasGastosSobreVentasPct}%** (límite legal: ${m.limiteLegalComprasPct}%).`,
      m.excluidoPorFacturacion
        ? `⚠️ **URGENTE:** Superaste el tope máximo del Monotributo (${fmt(m.topeMaximoMonotributo)}). Evaluá inmediatamente el pase planificado a Responsable Inscripto.`
        : `✅ Estás dentro del régimen simplificado. Revisá la pestaña Monotributo para simular recategorización.`,
    ].join("\n");
  }

  if (q.includes("contado") || q.includes("corriente") || q.includes("deudor") || q.includes("efectivo") || q.includes("bancar")) {
    return [
      `💳 **Composición de Ventas y Cobranza (${analytics.periodo}):**`,
      `• **Contado vs. Cuenta Corriente:** Contado **${fmt(v.contado)} (${v.pctContado}%)** vs. Cta. Cte. **${fmt(v.ctaCte)} (${v.pctCtaCte}%)**.`,
      `• **Efectivo vs. Bancarizado (sobre Contado):** Efectivo **${fmt(v.efectivo)} (${v.pctEfectivo}%)** vs. Bancarizado **${fmt(v.bancarizado)} (${v.pctBancarizado}%)**.`,
      `• **Dinero en la calle (Cuentas Corrientes Clientes a cobrar):** **${fmt(f.saldoACobrarClientes)}** | Deuda con Proveedores: **${fmt(f.deudaProveedores)}**.`,
      `• **Liquidez inmediata (Caja + Bancos):** **${fmt(f.liquidezInmediata)}**.`,
      `\n🎯 **Recomendación:** ${f.saldoACobrarClientes > v.totalPeriodo * 0.25 ? "Tenés un volumen alto en Cuenta Corriente; activá cobranza prioritaria a los 5 mayores deudores." : "Tu relación contado/fiado se mantiene saludable."} Controlá las acreditaciones bancarias para prever retenciones SIRCREB en F.5663.`,
    ].join("\n");
  }

  if (q.includes("equilibrio") || q.includes("break") || q.includes("cubrir gastos")) {
    return [
      `⚖️ **Punto de Equilibrio Financiero (${analytics.periodo}):**`,
      `• Gastos fijos considerados: **${fmt(f.gastosFijosConsiderados)}** | Margen bruto real: **${v.margenBrutoPct}%**.`,
      `• Necesitás facturar **${fmt(f.puntoEquilibrioMensual)} por mes** (**${fmt(f.puntoEquilibrioDiario)} por día hábil**) para cubrir gastos fijos sin perder plata.`,
      `• Llevás cubierto el **${f.pctEquilibrioAlcanzado}%** del punto de equilibrio en el mes.`,
    ].join("\n");
  }

  // Diagnóstico ejecutivo integral por defecto
  return [
    `📈 **Diagnóstico Ejecutivo de tu Negocio (${analytics.periodo}):**`,
    `• **Ventas del período:** ${fmt(v.totalPeriodo)} (${v.cantidadTickets} tickets · ticket promedio ${fmt(v.ticketPromedio)}${v.variacionMensualPct !== null ? ` · ${v.variacionMensualPct >= 0 ? "+" : ""}${v.variacionMensualPct}% vs mes anterior` : ""}).`,
    `• **Rentabilidad:** Margen bruto ${fmt(v.margenBrutoArs)} (${v.margenBrutoPct}%) → Ganancia neta estimada **${fmt(f.gananciaNetaEstimada)}** luego de gastos (${fmt(f.gastosOperativosPeriodo)}) e impuestos (${fmt(f.impuestosEstimadosMes)}).`,
    `• **Cobranza:** Contado ${v.pctContado}% vs Cta. Cte. ${v.pctCtaCte}% | Efectivo ${v.pctEfectivo}% vs Bancarizado ${v.pctBancarizado}%.`,
    `• **Retiros:** ${fmt(f.retirosTotalesPeriodo)} acumulados ${f.alertaDescapitalizacion ? "⚠️ (superan la ganancia neta)" : "✅ (dentro de margen)"}.`,
    `• **Stock:** ${inv.alertasAbastecimientoCount} alertas de reposición y ${inv.stockMuertoCount} artículos en stock muerto (${fmt(inv.stockMuertoCapitalCosto)} inmovilizados).`,
    `• **ARCA:** F.2051 IVA estimado ${fmt(arca.f2051.saldoAPagar)} · F.5663 IIBB Córdoba ${fmt(arca.f5663.saldoAPagar)}.`,
  ].join("\n");
}

export async function handleErpMiContador(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const sess =
    extractErpSessionFromRequest(req, tenant.slug) ||
    extractErpSessionFromRequest(req, "minisistema");
  const actorHeader = (req.headers.get("x-erp-user") || "").trim().toLowerCase();
  const actor = sess?.username || actorHeader || "";

  if (!sess && actor !== GENERAL_ADMIN_USERNAME) {
    return NextResponse.json(
      { ok: false, message: "Sesión expirada. Iniciá sesión en el sistema." },
      { status: 401 }
    );
  }

  const mcDb = await loadMiContadorDb(tenant);
  const periodoParam = req.nextUrl.searchParams.get("periodo") || currentPeriodYm();

  if (req.method === "GET") {
    const action = req.nextUrl.searchParams.get("action") || "dashboard";
    const analytics = await computeMiContadorAnalytics(tenant, mcDb, periodoParam);

    if (action === "export_f2083") {
      const files = generateF2083TxtFiles({
        periodo: analytics.periodo,
        ventasCbtes: analytics._internalVentasCbtes,
        compras: mcDb.compras.filter((c) => c.periodo === analytics.periodo),
      });
      return NextResponse.json({ ok: true, periodo: analytics.periodo, files });
    }

    const { _internalVentasCbtes: _omit, ...publicAnalytics } = analytics;
    return NextResponse.json({
      ok: true,
      periodo: analytics.periodo,
      data: mcDb,
      analytics: publicAnalytics,
    });
  }

  if (req.method === "POST") {
    const body = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
    const action = String(body.action || "").trim();
    const periodo = String(body.periodo || periodoParam || currentPeriodYm());
    const nowIso = new Date().toISOString();
    const actorName = actor || "admin";

    const commitAndRespond = async (message: string, extra: AnyObj = {}) => {
      mcDb.updatedAt = nowIso;
      await putTenantDoc(tenant, MI_CONTADOR_DOC_KEY, mcDb, actorName, action);
      const analytics = await computeMiContadorAnalytics(tenant, mcDb, periodo);
      const { _internalVentasCbtes: _omit, ...publicAnalytics } = analytics;
      return NextResponse.json({
        ok: true,
        message,
        periodo: analytics.periodo,
        data: mcDb,
        analytics: publicAnalytics,
        ...extra,
      });
    };

    if (action === "save_fiscal_config") {
      const inp = (body.fiscalConfig || body) as AnyObj;
      mcDb.fiscalConfig = {
        ...mcDb.fiscalConfig,
        condicionFiscal:
          inp.condicionFiscal === "MONOTRIBUTO" || inp.condicionFiscal === "EXENTO"
            ? inp.condicionFiscal
            : "RI",
        cuit: String(inp.cuit ?? mcDb.fiscalConfig.cuit).trim(),
        razonSocial: String(inp.razonSocial ?? mcDb.fiscalConfig.razonSocial).trim(),
        actividadPrincipal: String(
          inp.actividadPrincipal ?? mcDb.fiscalConfig.actividadPrincipal
        ).trim(),
        jurisdiccionIibb: String(
          inp.jurisdiccionIibb ?? mcDb.fiscalConfig.jurisdiccionIibb
        )
          .trim()
          .toUpperCase(),
        alicuotaIibbPct: Math.max(
          0,
          Math.min(25, r2(inp.alicuotaIibbPct ?? mcDb.fiscalConfig.alicuotaIibbPct))
        ),
        categoriaMonotributoActual: String(
          inp.categoriaMonotributoActual ?? mcDb.fiscalConfig.categoriaMonotributoActual
        )
          .trim()
          .toUpperCase(),
        tipoActividadMonotributo: (inp.tipoActividadMonotributo === "SERVICIOS"
          ? "SERVICIOS"
          : "VENTA_COSAS_MUEBLES") as MonotributoActividadTipo,
        saldoTecnicoIvaAnterior: Math.max(
          0,
          r2(inp.saldoTecnicoIvaAnterior ?? mcDb.fiscalConfig.saldoTecnicoIvaAnterior)
        ),
        saldoLibreDispIvaAnterior: Math.max(
          0,
          r2(inp.saldoLibreDispIvaAnterior ?? mcDb.fiscalConfig.saldoLibreDispIvaAnterior)
        ),
        saldoFavorIibbAnterior: Math.max(
          0,
          r2(inp.saldoFavorIibbAnterior ?? mcDb.fiscalConfig.saldoFavorIibbAnterior)
        ),
        gastosFijosMensualesBase: Math.max(
          0,
          r2(inp.gastosFijosMensualesBase ?? mcDb.fiscalConfig.gastosFijosMensualesBase)
        ),
        cuitDelegadoArca: String(
          inp.cuitDelegadoArca ?? mcDb.fiscalConfig.cuitDelegadoArca
        ).trim(),
        delegacionPortalIvaActiva:
          inp.delegacionPortalIvaActiva !== undefined
            ? Boolean(inp.delegacionPortalIvaActiva)
            : mcDb.fiscalConfig.delegacionPortalIvaActiva,
        delegacionSifereActiva:
          inp.delegacionSifereActiva !== undefined
            ? Boolean(inp.delegacionSifereActiva)
            : mcDb.fiscalConfig.delegacionSifereActiva,
        updatedAt: nowIso,
      };
      return commitAndRespond("Configuración fiscal ARCA guardada correctamente.");
    }

    if (action === "save_monotributo_escalas") {
      const rawList = Array.isArray(body.escalas) ? body.escalas : [];
      if (rawList.length > 0) {
        mcDb.monotributoEscalas = rawList.map((e: AnyObj) => ({
          categoria: String(e.categoria || "A").toUpperCase().slice(0, 2),
          topeIngresosAnualArs: Math.max(0, r2(e.topeIngresosAnualArs)),
          cuotaMensualServiciosArs: Math.max(0, r2(e.cuotaMensualServiciosArs)),
          cuotaMensualBienesArs: Math.max(0, r2(e.cuotaMensualBienesArs)),
        }));
      }
      return commitAndRespond("Tabla de escalas de Monotributo ARCA actualizada.");
    }

    if (action === "save_compra") {
      const inp = (body.compra || body) as AnyObj;
      const fecha = String(inp.fecha || nowIso.slice(0, 10)).slice(0, 10);
      const neto21 = Math.max(0, r2(inp.netoGravado21));
      const neto105 = Math.max(0, r2(inp.netoGravado105));
      const neto27 = Math.max(0, r2(inp.netoGravado27));
      const exento = Math.max(0, r2(inp.exentoNoGravado));
      const iva21 = r2(neto21 * 0.21);
      const iva105 = r2(neto105 * 0.105);
      const iva27 = r2(neto27 * 0.27);
      const ivaTotal = r2(iva21 + iva105 + iva27);
      const percIva = Math.max(0, r2(inp.percepcionIva));
      const percIibb = Math.max(0, r2(inp.percepcionIibb));
      const otros = Math.max(0, r2(inp.otrosImpuestos));
      const total = r2(neto21 + neto105 + neto27 + exento + ivaTotal + percIva + percIibb + otros);

      if (total <= 0) {
        return NextResponse.json(
          { ok: false, message: "Ingresá al menos un importe neto o exento mayor a $0." },
          { status: 400 }
        );
      }

      const rec: CompraFiscalRecord = {
        id: String(inp.id || `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`),
        fecha,
        periodo: fecha.slice(0, 7),
        tipoComprobante: inp.tipoComprobante || "FA",
        puntoVenta: padLeftNum(inp.puntoVenta || "1", 4),
        numero: padLeftNum(inp.numero || "1", 8),
        cuitProveedor: String(inp.cuitProveedor || "").replace(/[^\d-]/g, ""),
        razonSocialProveedor: String(inp.razonSocialProveedor || "PROVEEDOR").trim().toUpperCase(),
        netoGravado21: neto21,
        netoGravado105: neto105,
        netoGravado27: neto27,
        exentoNoGravado: exento,
        iva21,
        iva105,
        iva27,
        ivaTotal,
        percepcionIva: percIva,
        percepcionIibb: percIibb,
        otrosImpuestos: otros,
        total,
        observaciones: String(inp.observaciones || "").trim(),
        createdAt: nowIso,
      };
      mcDb.compras.unshift(rec);
      return commitAndRespond("Comprobante de compra incorporado al Crédito Fiscal y F.2083.");
    }

    if (action === "delete_compra") {
      mcDb.compras = mcDb.compras.filter((c) => c.id !== String(body.id || ""));
      return commitAndRespond("Comprobante de compra eliminado.");
    }

    if (action === "save_gasto_retiro") {
      const inp = (body.item || body) as AnyObj;
      const fecha = String(inp.fecha || nowIso.slice(0, 10)).slice(0, 10);
      const monto = Math.max(0, r2(inp.monto));
      if (monto <= 0) {
        return NextResponse.json({ ok: false, message: "El monto debe ser mayor a $0." }, { status: 400 });
      }
      const rec: GastoRetiroRecord = {
        id: String(inp.id || `gr_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`),
        fecha,
        periodo: fecha.slice(0, 7),
        tipo: inp.tipo === "RETIRO_TITULAR" ? "RETIRO_TITULAR" : "GASTO",
        categoria: String(inp.categoria || "Otros Gastos Operativos").trim(),
        descripcion: String(inp.descripcion || "").trim() || "Registro operativo",
        medioPago: inp.medioPago || "EFECTIVO",
        monto,
        esFijo: Boolean(inp.esFijo),
        createdAt: nowIso,
      };
      mcDb.gastosRetiros.unshift(rec);
      return commitAndRespond(
        rec.tipo === "RETIRO_TITULAR"
          ? "Retiro diario / del titular registrado."
          : "Gasto operativo registrado."
      );
    }

    if (action === "delete_gasto_retiro") {
      mcDb.gastosRetiros = mcDb.gastosRetiros.filter((g) => g.id !== String(body.id || ""));
      return commitAndRespond("Registro eliminado.");
    }

    if (action === "save_retencion") {
      const inp = (body.retencion || body) as AnyObj;
      const fecha = String(inp.fecha || nowIso.slice(0, 10)).slice(0, 10);
      const monto = Math.max(0, r2(inp.monto));
      if (monto <= 0) {
        return NextResponse.json({ ok: false, message: "El monto debe ser mayor a $0." }, { status: 400 });
      }
      const rec: RetencionPercepcionRecord = {
        id: String(inp.id || `ret_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`),
        fecha,
        periodo: fecha.slice(0, 7),
        impuesto: inp.impuesto === "IVA" ? "IVA" : "IIBB_CORDOBA",
        origen: inp.origen || "SIRCREB",
        comprobanteRef: String(inp.comprobanteRef || "").trim(),
        cuitAgente: String(inp.cuitAgente || "").trim(),
        monto,
        observaciones: String(inp.observaciones || "").trim(),
        createdAt: nowIso,
      };
      mcDb.retenciones.unshift(rec);
      return commitAndRespond("Retención / Percepción registrada.");
    }

    if (action === "delete_retencion") {
      mcDb.retenciones = mcDb.retenciones.filter((r) => r.id !== String(body.id || ""));
      return commitAndRespond("Retención eliminada.");
    }

    if (action === "save_presentacion") {
      const inp = (body.presentacion || body) as AnyObj;
      const form = inp.formulario || "F2051";
      const per = String(inp.periodo || periodo);
      const existingIdx = mcDb.presentaciones.findIndex(
        (p) => p.periodo === per && p.formulario === form
      );
      const rec: PresentacionArcaRecord = {
        id:
          existingIdx >= 0
            ? mcDb.presentaciones[existingIdx].id
            : `pres_${per}_${form}`,
        periodo: per,
        formulario: form,
        estado: inp.estado || "PRESENTADA",
        montoDeterminado: r2(inp.montoDeterminado || 0),
        nroTransaccionArca: String(inp.nroTransaccionArca || "").trim(),
        fechaPresentacion:
          String(inp.fechaPresentacion || "").trim() || nowIso.slice(0, 10),
        observaciones: String(inp.observaciones || "").trim(),
        updatedBy: actorName,
        updatedAt: nowIso,
      };
      if (existingIdx >= 0) mcDb.presentaciones[existingIdx] = rec;
      else mcDb.presentaciones.unshift(rec);
      return commitAndRespond(`Estado de ${form} (${per}) actualizado a ${rec.estado}.`);
    }

    if (action === "ask_ai") {
      const question = String(body.question || "").trim();
      if (!question) {
        return NextResponse.json(
          { ok: false, message: "Escribí tu consulta para Mi Contador IA." },
          { status: 400 }
        );
      }

      const analytics = await computeMiContadorAnalytics(tenant, mcDb, periodo);
      const { _internalVentasCbtes: _omit, ...publicAnalytics } = analytics;

      const geminiKey = (process.env.GEMINI_API_KEY || "").trim();
      if (geminiKey) {
        try {
          const systemPrompt =
            `Sos "Mi Contador IA", el Director Financiero (CFO) y Asesor Impositivo Argentino (ARCA) integrado en el ERP de ${tenant.fantasy_name || "el comercio"}.\n` +
            `Respondé SIEMPRE en español argentino claro, ejecutivo, práctico y accionable.\n` +
            `Usá EXCLUSIVAMENTE los datos reales del ERP incluidos en el JSON de contexto. JAMÁS inventes cifras.\n` +
            `Conocés a fondo F.2051 (IVA Simple), F.2083 (Libro IVA Digital), F.5663 (SIFERE Locales Ingresos Brutos Córdoba), Monotributo, retiros del titular, punto de equilibrio, rotación ABC y stock muerto.\n` +
            `Cuando des consejos impositivos críticos (Ganancias, exclusiones, inspecciones), recordá validar la presentación definitiva con un Contador Público.`;

          const compactContext = JSON.stringify({
            comercio: tenant.fantasy_name,
            fiscalConfig: mcDb.fiscalConfig,
            periodo: publicAnalytics.periodo,
            ventas: publicAnalytics.ventas,
            finanzas: publicAnalytics.finanzas,
            inventarioResumen: {
              totalArticulosActivos: publicAnalytics.inventario.totalArticulosActivos,
              stockValorizadoCostoTotal: publicAnalytics.inventario.stockValorizadoCostoTotal,
              alertasAbastecimientoCount: publicAnalytics.inventario.alertasAbastecimientoCount,
              topFaltantes: publicAnalytics.inventario.alertasAbastecimiento.slice(0, 10),
              stockMuertoCount: publicAnalytics.inventario.stockMuertoCount,
              stockMuertoCapitalCosto: publicAnalytics.inventario.stockMuertoCapitalCosto,
              topStockMuerto: publicAnalytics.inventario.stockMuertoTop.slice(0, 10),
              topRotacion: publicAnalytics.inventario.rotacionTop.slice(0, 10),
            },
            arca: publicAnalytics.arca,
            alertasEjecutivas: publicAnalytics.alertasEjecutivas,
          });

          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
            geminiKey
          )}`;
          const aiRes = await fetch(apiUrl, {
            method: "POST",
            signal: AbortSignal.timeout(15000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `DATOS REALES DEL ERP:\n${compactContext}\n\nPREGUNTA DEL EMPRESARIO:\n${question}`,
                    },
                  ],
                },
              ],
              generationConfig: { temperature: 0.25, maxOutputTokens: 1200 },
            }),
          });
          if (aiRes.ok) {
            const j = (await aiRes.json().catch(() => null)) as AnyObj | null;
            const txt = String(
              j?.candidates?.[0]?.content?.parts?.[0]?.text || ""
            ).trim();
            if (txt) {
              return NextResponse.json({
                ok: true,
                source: "gemini-cloud",
                answer: txt,
              });
            }
          }
        } catch {
          // Fallback automático al motor experto determinístico local
        }
      }

      const fallbackAnswer = buildLocalExpertAnswer(
        question,
        publicAnalytics,
        mcDb.fiscalConfig
      );
      return NextResponse.json({
        ok: true,
        source: "local-cfo-engine",
        answer: fallbackAnswer,
      });
    }

    return NextResponse.json(
      { ok: false, message: `Acción desconocida en Mi Contador: ${action}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: false, message: "Método no permitido" }, { status: 405 });
}
