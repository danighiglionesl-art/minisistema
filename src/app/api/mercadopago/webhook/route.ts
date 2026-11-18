import { NextRequest, NextResponse } from "next/server";
import { getPlatformSupabase } from "@/lib/erp/supabase-server";
import { getPlatformSecretsMap, getTenantBySlug } from "@/lib/erp/tenant-service";

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

    if (!dataId || !topic.includes("preapproval")) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const secrets = await getPlatformSecretsMap();
    if (!secrets.mp_access_token) {
      return NextResponse.json({ ok: true, mode: "sandbox_no_token" });
    }

    const mpRes = await fetch(
      `https://api.mercadopago.com/preapproval/${encodeURIComponent(dataId)}`,
      {
        headers: {
          Authorization: `Bearer ${secrets.mp_access_token}`,
        },
      }
    );

    if (!mpRes.ok) {
      return NextResponse.json({ ok: false }, { status: 502 });
    }

    const preapproval = (await mpRes.json()) as Record<string, any>;
    const slug = String(preapproval.external_reference || "").trim().toLowerCase();
    if (!slug) {
      return NextResponse.json({ ok: true, noExternalRef: true });
    }

    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json({ ok: true, tenantNotFound: true });
    }

    const rawStatus = String(preapproval.status || "pending");
    const mappedStatus =
      rawStatus === "authorized"
        ? "authorized"
        : rawStatus === "paused"
          ? "paused"
          : rawStatus === "cancelled"
            ? "cancelled"
            : "pending";

    const sb = await getPlatformSupabase();
    const nextSub = {
      ...tenant.subscription,
      mpPreapprovalId: String(preapproval.id || dataId),
      mpStatus: mappedStatus,
      lastSyncAt: new Date().toISOString(),
    };

    await sb
      .from("erp_tenants")
      .update({
        subscription: nextSub,
        updated_at: new Date().toISOString(),
      })
      .eq("slug", slug);

    await sb.from("erp_subscription_events").insert({
      tenant_slug: slug,
      event_type: `MP_WEBHOOK_${rawStatus.toUpperCase()}`,
      mp_preapproval_id: String(preapproval.id || dataId),
      amount: Number(preapproval.auto_recurring?.transaction_amount || tenant.subscription.activeMonthlyAmount || 0),
      payload: preapproval,
    });

    return NextResponse.json({ ok: true, status: mappedStatus });
  } catch (err) {
    console.error("[MP Webhook Error]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
