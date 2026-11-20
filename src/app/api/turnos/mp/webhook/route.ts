import { NextRequest, NextResponse } from "next/server";
import { loadTurnosDb, TURNOS_DOC_KEY } from "@/lib/erp/handlers/turnos-handler";
import { putTenantDoc } from "@/lib/erp/supabase-server";
import {
  getTenantBySlug,
  resolveActiveTenantFromRequest,
} from "@/lib/erp/tenant-service";
import {
  getMpMarketplaceConfig,
  verifyMpWebhookHmac,
} from "@/lib/erp/turnos-mp-server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = ((await req.json().catch(() => ({}))) || {}) as Record<string, any>;
    const topic = String(
      body.type || body.topic || req.nextUrl.searchParams.get("type") || ""
    );
    const dataId = String(
      body.data?.id || req.nextUrl.searchParams.get("data.id") || body.id || ""
    );

    if (!dataId || (!topic.includes("payment") && topic !== "merchant_order")) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const mpCfg = await getMpMarketplaceConfig();
    const sigCheck = verifyMpWebhookHmac({
      webhookSecret: mpCfg.webhookSecret,
      xSignature: req.headers.get("x-signature"),
      xRequestId: req.headers.get("x-request-id"),
      dataId,
    });
    if (!sigCheck.valid) {
      return NextResponse.json({ ok: false, message: "Firma HMAC inválida" }, { status: 401 });
    }

    if (!mpCfg.platformAccessToken) {
      return NextResponse.json({ ok: true, mode: "sandbox_no_token" });
    }

    const payRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`,
      {
        headers: { Authorization: `Bearer ${mpCfg.platformAccessToken}` },
      }
    );
    if (!payRes.ok) {
      return NextResponse.json({ ok: false }, { status: 502 });
    }

    const payment = (await payRes.json()) as Record<string, any>;
    const extRef = String(payment.external_reference || "");
    const [refSlug, turnoId] = extRef.includes("::")
      ? extRef.split("::")
      : [req.nextUrl.searchParams.get("tenant") || "minisistema", extRef];

    if (!turnoId) {
      return NextResponse.json({ ok: true, noExternalRef: true });
    }

    const tenant =
      (await getTenantBySlug(refSlug)) || (await resolveActiveTenantFromRequest(req));
    const db = await loadTurnosDb(tenant);
    const turno = db.turnos.find((t) => t.id === turnoId || t.codigo === turnoId);
    if (!turno) {
      return NextResponse.json({ ok: true, turnoNotFound: true });
    }

    const rawStatus = String(payment.status || "pending").toLowerCase();
    const mappedStatus =
      rawStatus === "approved"
        ? "approved"
        : rawStatus === "rejected"
          ? "rejected"
          : rawStatus === "refunded"
            ? "refunded"
            : rawStatus === "cancelled"
              ? "cancelled"
              : "pending";

    const nowIso = new Date().toISOString();
    turno.pago.estado = mappedStatus;
    turno.pago.mpPaymentId = String(payment.id || dataId);
    turno.pago.providerMode = "mercadopago_live";
    if (mappedStatus === "approved") {
      turno.pago.paidAt = nowIso;
      if (turno.estado === "pendiente_pago" || turno.estado === "pendiente") {
        turno.estado = "confirmado";
      }
    }
    turno.updatedAt = nowIso;

    const tx = db.transaccionesMp.find((x) => x.turnoId === turno.id);
    if (tx) {
      tx.status = mappedStatus;
      tx.mpPaymentId = String(payment.id || dataId);
      tx.updatedAt = nowIso;
    }

    db.updatedAt = nowIso;
    await putTenantDoc(tenant, TURNOS_DOC_KEY, db, "mp_webhook", `mp_payment_${mappedStatus}`);

    return NextResponse.json({ ok: true, status: mappedStatus, turnoCodigo: turno.codigo });
  } catch (err) {
    console.error("[Turnos MP Webhook Error]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
