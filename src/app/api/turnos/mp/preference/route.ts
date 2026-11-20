import { NextRequest, NextResponse } from "next/server";
import { loadTurnosDb, TURNOS_DOC_KEY } from "@/lib/erp/handlers/turnos-handler";
import { putTenantDoc } from "@/lib/erp/supabase-server";
import {
  getTenantBySlug,
  resolveActiveTenantFromRequest,
} from "@/lib/erp/tenant-service";
import {
  decryptProfesionalMpTokens,
  getMpMarketplaceConfig,
} from "@/lib/erp/turnos-mp-server";
import {
  calculateTurnosSplit,
  resolveTurnosCommission,
  type TurnosSplitTransaction,
} from "@/lib/erp/turnos-types";

export const dynamic = "force-dynamic";

/**
 * Genera una Preferencia de Mercado Pago con Split de Pagos 1:1 (marketplace_fee en ARS)
 * para un Turno Web en modalidad "Particular" (sin obra social), distribuyendo
 * automáticamente el valor de la consulta entre el Profesional y el Organizador
 * (Clínica / Consultorios Externos / Sanatorio / Staff de Profesionales).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const forcedSlug =
      req.nextUrl.searchParams.get("tenant") || String(body?.tenantSlug || "");
    const tenant = forcedSlug
      ? (await getTenantBySlug(forcedSlug)) ||
        (await resolveActiveTenantFromRequest(req))
      : await resolveActiveTenantFromRequest(req);

    const turnoId = String(body?.turnoId || "").trim();
    if (!turnoId) {
      return NextResponse.json(
        { ok: false, message: "Falta indicar el turnoId para generar el pago." },
        { status: 400 }
      );
    }

    const db = await loadTurnosDb(tenant);
    const turno = db.turnos.find((t) => t.id === turnoId);
    if (!turno) {
      return NextResponse.json(
        { ok: false, message: "Turno no encontrado." },
        { status: 404 }
      );
    }
    if (turno.coberturaTipo !== "particular") {
      return NextResponse.json(
        {
          ok: false,
          message: "El pago online Mercado Pago aplica únicamente a turnos modalidad Particular.",
        },
        { status: 400 }
      );
    }

    const prof = db.profesionales.find((p) => p.id === turno.profesionalId);
    if (!prof) {
      return NextResponse.json(
        { ok: false, message: "Profesional asociado no encontrado." },
        { status: 404 }
      );
    }

    const montoTotalArs = Number(turno.pago?.montoTotalArs || prof.valorConsultaParticularArs || 0);
    if (montoTotalArs <= 0) {
      return NextResponse.json(
        { ok: false, message: "El valor de la consulta particular debe ser mayor a $0 ARS." },
        { status: 400 }
      );
    }

    // 1. Resolver comisión oficial en backend con copia inalterable (snapshot)
    const snapshot =
      turno.pago?.commissionSnapshot ||
      resolveTurnosCommission(db.splitConfig, turno.modalidad, prof.id);
    const split = calculateTurnosSplit(montoTotalArs, snapshot.organizadorPct);

    const idempotencyKey = `trn_mp_${tenant.slug}_${turno.id}`;
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "www.minisistema.com.ar";
    const proto = host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
    const origin = `${proto}://${host}`;
    const publicReturnBase =
      tenant.option_type === 2 && !tenant.is_base
        ? `${origin}/${tenant.slug}/turnos`
        : `${origin}/turnos`;

    const mpCfg = await getMpMarketplaceConfig();
    const decryptedProfTokens = prof.mpAccount
      ? decryptProfesionalMpTokens(prof.mpAccount)
      : null;

    let preferenceId = `PREF-TRN-SPLIT-${Date.now()}`;
    let initPointUrl = "";
    let providerMode: "mercadopago_live" | "mercadopago_sandbox" = "mercadopago_sandbox";

    // 2. Si existen credenciales productivas MP y el profesional vinculó su cuenta OAuth (o usa token de plataforma)
    const bearerToken =
      decryptedProfTokens?.accessToken || mpCfg.platformAccessToken || "";

    if (bearerToken && !bearerToken.startsWith("APP_USR_TURNOS_")) {
      const mpPayload: Record<string, unknown> = {
        items: [
          {
            id: turno.codigo,
            title: `Consulta Particular ${turno.especialidadNombre} — ${turno.profesionalNombre}`,
            description: `Turno ${turno.codigo} (${turno.fecha} ${turno.horaInicio} hs · ${turno.modalidad === "videollamada" ? "Videollamada" : "Presencial"})`,
            quantity: 1,
            currency_id: "ARS",
            unit_price: split.montoTotalArs,
          },
        ],
        payer: {
          name: `${turno.pacienteNombres} ${turno.pacienteApellidos}`.trim(),
          email: turno.pacienteEmail || db.portalConfig.emailRecepcion || "paciente@minisistema.com.ar",
        },
        external_reference: `${tenant.slug}::${turno.id}`,
        notification_url: `${origin}/api/turnos/mp/webhook?tenant=${encodeURIComponent(tenant.slug)}`,
        back_urls: {
          success: `${publicReturnBase}?mp_status=approved&turno=${encodeURIComponent(turno.codigo)}`,
          pending: `${publicReturnBase}?mp_status=pending&turno=${encodeURIComponent(turno.codigo)}`,
          failure: `${publicReturnBase}?mp_status=rejected&turno=${encodeURIComponent(turno.codigo)}`,
        },
        auto_return: "approved",
        metadata: {
          tenant_slug: tenant.slug,
          turno_id: turno.id,
          turno_codigo: turno.codigo,
          profesional_id: prof.id,
          organizador_tipo: db.splitConfig.organizadorTipo,
          organizador_pct: split.organizadorPct,
          profesional_pct: split.profesionalPct,
          organizador_fee_ars: split.organizadorFeeArs,
          profesional_bruto_ars: split.profesionalBrutoArs,
        },
      };

      // Solo enviar marketplace_fee cuando se usa token OAuth real del vendedor (Split 1:1 Marketplace)
      if (decryptedProfTokens?.accessToken && split.organizadorFeeArs > 0) {
        mpPayload.marketplace_fee = split.organizadorFeeArs;
      }

      const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(mpPayload),
      });

      if (mpRes.ok) {
        const mpData = (await mpRes.json()) as Record<string, any>;
        if (mpData?.id) {
          preferenceId = String(mpData.id);
          initPointUrl = String(mpData.init_point || mpData.sandbox_init_point || "");
          providerMode = "mercadopago_live";
        }
      }
    }

    const nowIso = new Date().toISOString();
    turno.pago = {
      requerido: true,
      estado: "pending",
      montoTotalArs: split.montoTotalArs,
      organizadorPct: split.organizadorPct,
      profesionalPct: split.profesionalPct,
      organizadorFeeArs: split.organizadorFeeArs,
      profesionalBrutoArs: split.profesionalBrutoArs,
      mpProcessorFeeEstimadoArs: split.mpProcessorFeeEstimadoArs,
      profesionalNetoEstimadoArs: split.profesionalNetoEstimadoArs,
      commissionSnapshot: snapshot,
      preferenceId,
      initPointUrl: initPointUrl || null,
      idempotencyKey,
      providerMode,
    };
    turno.updatedAt = nowIso;

    const txRecord: TurnosSplitTransaction = {
      id: `tx_${Date.now()}`,
      turnoId: turno.id,
      turnoCodigo: turno.codigo,
      idempotencyKey,
      preferenceId,
      mpPaymentId: null,
      providerMode,
      profesionalId: prof.id,
      profesionalNombre: turno.profesionalNombre,
      profesionalMpUserId: prof.mpAccount?.mpUserId || "SIN_VINCULAR_OAUTH",
      pacienteDni: turno.pacienteDni,
      pacienteNombre: turno.pacienteNombreCompleto,
      especialidadNombre: turno.especialidadNombre,
      modalidad: turno.modalidad,
      fechaTurno: turno.fecha,
      horaTurno: turno.horaInicio,
      montoTotalArs: split.montoTotalArs,
      organizadorFeeArs: split.organizadorFeeArs,
      profesionalBrutoArs: split.profesionalBrutoArs,
      mpProcessorFeeEstimadoArs: split.mpProcessorFeeEstimadoArs,
      profesionalNetoEstimadoArs: split.profesionalNetoEstimadoArs,
      commissionSnapshot: snapshot,
      status: "pending",
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const existingTxIdx = db.transaccionesMp.findIndex((x) => x.turnoId === turno.id);
    if (existingTxIdx >= 0) db.transaccionesMp[existingTxIdx] = txRecord;
    else db.transaccionesMp.unshift(txRecord);

    db.updatedAt = nowIso;
    await putTenantDoc(tenant, TURNOS_DOC_KEY, db, "paciente_web", "create_mp_split_pref");

    return NextResponse.json({
      ok: true,
      providerMode,
      preferenceId,
      initPointUrl,
      splitAmounts: split,
      commissionSnapshot: snapshot,
      organizadorNombre: db.splitConfig.organizadorNombre,
      organizadorTipo: db.splitConfig.organizadorTipo,
      turno,
    });
  } catch (err) {
    console.error("[Turnos MP Preference Error]", err);
    return NextResponse.json(
      { ok: false, message: "Error generando preferencia de pago con Split Mercado Pago." },
      { status: 500 }
    );
  }
}
