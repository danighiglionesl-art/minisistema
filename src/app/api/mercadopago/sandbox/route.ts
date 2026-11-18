import { NextRequest, NextResponse } from "next/server";
import { getPlatformSupabase } from "@/lib/erp/supabase-server";
import { getTenantBySlug } from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("tenant") || "").trim().toLowerCase();
  const confirm = req.nextUrl.searchParams.get("confirm") === "1";
  const tenant = slug ? await getTenantBySlug(slug) : null;

  if (!tenant) {
    return new NextResponse("Comercio no encontrado", { status: 404 });
  }

  if (confirm) {
    const sb = await getPlatformSupabase();
    const nextSub = {
      ...tenant.subscription,
      mpStatus: "authorized" as const,
      lastSyncAt: new Date().toISOString(),
    };
    await sb
      .from("erp_tenants")
      .update({ subscription: nextSub, updated_at: new Date().toISOString() })
      .eq("slug", tenant.slug);
    await sb.from("erp_subscription_events").insert({
      tenant_slug: tenant.slug,
      event_type: "SANDBOX_ADHESION_AUTHORIZED",
      mp_preapproval_id: tenant.subscription.mpPreapprovalId,
      amount: tenant.subscription.activeMonthlyAmount,
      payload: { simulated: true },
    });
  }

  const fmtArs = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  const sub = tenant.subscription;
  const html = `<!DOCTYPE html>
<html lang="es-AR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Adhesión Débito Automático — ${tenant.fantasy_name} | MiniSistema</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #112D3A; color: #FFFFFF; display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 1.5rem; }
    .card { max-width: 520px; width: 100%; background: #FFFFFF; color: #112D3A; border-radius: 20px; padding: 2rem; box-shadow: 0 24px 60px rgba(0,0,0,0.4); border-top: 6px solid #56D7A1; }
    .badge { display: inline-block; background: rgba(86,215,161,0.2); color: #0c5337; font-weight: 700; font-size: 0.78rem; padding: 0.3rem 0.75rem; border-radius: 999px; margin-bottom: 0.9rem; }
    h1 { margin: 0 0 0.4rem; font-size: 1.45rem; }
    p { margin: 0.35rem 0; color: #3a5564; line-height: 1.5; }
    .price-box { background: #f3f9f7; border: 1.5px solid #56D7A1; border-radius: 14px; padding: 1.15rem; margin: 1.25rem 0; }
    .price-main { font-size: 2rem; font-weight: 800; color: #112D3A; }
    .btn { display: inline-flex; width: 100%; justify-content: center; align-items: center; padding: 0.9rem 1.2rem; border-radius: 12px; background: #56D7A1; color: #112D3A; font-weight: 800; font-size: 1rem; text-decoration: none; border: none; cursor: pointer; box-sizing: border-box; margin-top: 0.6rem; }
    .btn-outline { background: transparent; border: 1.5px solid #112D3A; color: #112D3A; margin-top: 0.65rem; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">MODO PRUEBA · SUSCRIPCIÓN MERCADO PAGO</span>
    <h1>Abono Mensual — ${tenant.fantasy_name}</h1>
    <p>Adhesión al débito automático mensual de tu sistema ERP provisto por <strong>MiniSistema</strong>.</p>
    <div class="price-box">
      <div style="font-size:0.82rem; font-weight:700; text-transform:uppercase; color:#1f6e50;">Valor Mensual a Debitar</div>
      <div class="price-main">${fmtArs.format(sub.activeMonthlyAmount || 0)} <span style="font-size:0.95rem;font-weight:600;">/ mes</span></div>
      ${
        sub.globalDiscountType === "temporary" && sub.temporaryMonths > 0
          ? `<p style="font-size:0.85rem; margin-top:0.5rem;">Incluye descuento promocional durante <strong>${sub.temporaryMonths} meses</strong>. Valor regular posterior: <strong>${fmtArs.format(sub.monthlyRegularAmount || 0)}/mes</strong>.</p>`
          : sub.globalDiscountType === "permanent" && (sub.globalDiscountPct > 0 || sub.globalDiscountFixed > 0)
            ? `<p style="font-size:0.85rem; margin-top:0.5rem;">Incluye bonificación permanente aplicada sobre tus módulos contratados.</p>`
            : ""
      }
    </div>
    ${
      confirm || sub.mpStatus === "authorized"
        ? `<p style="color:#0c6b43; font-weight:700;">✅ ¡Adhesión simulada confirmada exitosamente! El estado del abono ya figura como Activo / Al día en el Panel de Administrador General.</p>
           <a class="btn" href="${tenant.deployment.publicErpUrl}">Ir al Sistema ERP</a>`
        : `<p style="font-size:0.85rem;"><em>Nota para @danielg:</em> Cuando cargues tu <code>MP_ACCESS_TOKEN</code> en el Panel de Administrador General, este enlace redirigirá directamente al checkout oficial de Suscripciones de Mercado Pago.</p>
           <a class="btn" href="/api/mercadopago/sandbox?tenant=${encodeURIComponent(tenant.slug)}&confirm=1">Simular Adhesión Aprobada con Mercado Pago</a>`
    }
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
