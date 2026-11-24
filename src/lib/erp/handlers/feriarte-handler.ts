import { NextRequest, NextResponse } from "next/server";
import { extractErpSessionFromRequest } from "../erp-session";
import { getPlatformSupabase } from "../supabase-server";
import {
  type ErpTenantRecord,
  GENERAL_ADMIN_USERNAME,
  normalizeErpRole,
} from "../types";

type AnyObj = Record<string, unknown>;

function slugifyCategory(input: string): string {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function isGeneralAdmin(session: { username: string; role: string } | null): boolean {
  if (!session) return false;
  const user = String(session.username || "").trim().toLowerCase();
  if (user === GENERAL_ADMIN_USERNAME) return true;
  return normalizeErpRole(session.role, user) === "Administrador General";
}

export async function handleErpFeriarte(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const session = extractErpSessionFromRequest(req, tenant.slug);
  if (!isGeneralAdmin(session)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Acceso exclusivo del Administrador General de MiniSistema para gestionar FeriARTE.",
      },
      { status: 403 }
    );
  }

  const actor = session?.username || GENERAL_ADMIN_USERNAME;
  const sb = await getPlatformSupabase();

  if (req.method === "GET") {
    const [
      usersRes,
      rolesRes,
      orgsRes,
      fairsRes,
      storesRes,
      productsRes,
      categoriesRes,
      ordersRes,
      paymentsRes,
      rulesRes,
      ledgerRes,
      settlementsRes,
      claimsRes,
      reportsRes,
      settingsRes,
      auditRes,
      qrScansRes,
    ] = await Promise.all([
      sb
        .from("fa_users")
        .select("id, email, full_name, phone, province, locality, active_profile, status, email_verified_at, is_test_data, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      sb.from("fa_user_roles").select("user_id, role, status"),
      sb
        .from("fa_organizer_profiles")
        .select("id, user_id, organization_name, cuit_cuil, province, locality, approval_status, invite_code, commission_override_pct, approved_by, approved_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      sb
        .from("fa_fairs")
        .select("id, organizer_id, slug, name, modality, province, locality, status, is_featured, starts_at, ends_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      sb
        .from("fa_stores")
        .select("id, owner_user_id, slug, name, artisan_name, province, locality, status, verified_artisan_badge, is_featured, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      sb
        .from("fa_products")
        .select("id, store_id, category_id, slug, title, description, materials, suggested_category_note, price_cents, stock_qty, craft_type, status, moderation_status, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      sb
        .from("fa_categories")
        .select("id, slug, name, description, icon, sort_order, is_active")
        .order("sort_order", { ascending: true }),
      sb
        .from("fa_orders")
        .select("id, order_number, buyer_user_id, store_id, attributed_fair_id, attributed_organizer_id, attribution_source, total_cents, status, paid_at, is_test_data, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      sb
        .from("fa_payment_transactions")
        .select("id, order_id, provider, sandbox_mode, mp_payment_id, gross_amount_cents, marketplace_fee_cents, seller_net_estimated_cents, status, webhook_verified_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      sb
        .from("fa_commission_rules")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      sb
        .from("fa_commission_ledger")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      sb
        .from("fa_organizer_settlements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      sb
        .from("fa_disputes_claims")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      sb
        .from("fa_content_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      sb.from("fa_platform_settings").select("*"),
      sb
        .from("fa_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150),
      sb.from("fa_qr_scan_events").select("id", { count: "exact", head: true }),
    ]);

    const users = usersRes.data || [];
    const roles = rolesRes.data || [];
    const organizers = orgsRes.data || [];
    const fairs = fairsRes.data || [];
    const stores = storesRes.data || [];
    const products = productsRes.data || [];
    const rawCategories = categoriesRes.data || [];
    const orders = ordersRes.data || [];
    const ledger = ledgerRes.data || [];
    const settlements = settlementsRes.data || [];
    const claims = claimsRes.data || [];

    const storeById = new Map<string, (typeof stores)[number]>();
    for (const s of stores) storeById.set(s.id, s);

    const productCountByCategory = new Map<string, number>();
    for (const p of products) {
      if (p.category_id && p.status !== "archived") {
        productCountByCategory.set(
          p.category_id,
          (productCountByCategory.get(p.category_id) || 0) + 1
        );
      }
    }

    const categories = rawCategories.map((c) => ({
      ...c,
      products_count: productCountByCategory.get(c.id) || 0,
    }));

    const otrosCategory = rawCategories.find((c) => c.slug === "otros") || null;
    const productsInOtros = otrosCategory
      ? products
          .filter((p) => p.category_id === otrosCategory.id && p.status !== "archived")
          .map((p) => {
            const st = storeById.get(p.store_id);
            return {
              ...p,
              store_name: st?.name || "Tienda",
              artisan_name: st?.artisan_name || "",
              store_slug: st?.slug || "",
              province: st?.province || "",
              locality: st?.locality || "",
            };
          })
      : [];

    const rolesByUser = new Map<string, Array<{ role: string; status: string }>>();
    for (const r of roles) {
      const list = rolesByUser.get(r.user_id) || [];
      list.push({ role: r.role, status: r.status });
      rolesByUser.set(r.user_id, list);
    }

    const enrichedUsers = users.map((u) => ({
      ...u,
      roles: rolesByUser.get(u.id) || [],
    }));

    const paidOrders = orders.filter((o) =>
      ["paid", "preparing", "ready_for_pickup", "shipped", "delivered"].includes(o.status)
    );
    const grossSalesCents = paidOrders.reduce((acc, o) => acc + Number(o.total_cents || 0), 0);
    const platformCommCents = ledger
      .filter((l) => l.beneficiary_type === "platform" && l.status !== "voided_adjusted")
      .reduce((acc, l) => acc + Number(l.net_payable_cents || 0), 0);
    const organizerCommCents = ledger
      .filter((l) => l.beneficiary_type === "organizer" && l.status !== "voided_adjusted")
      .reduce((acc, l) => acc + Number(l.net_payable_cents || 0), 0);
    const pendingSettlementsCents = settlements
      .filter((s) => s.status === "draft" || s.status === "approved")
      .reduce((acc, s) => acc + Number(s.net_payout_cents || 0), 0);
    const qrConvertedOrders = paidOrders.filter((o) =>
      ["qr_product", "qr_store", "qr_fair"].includes(o.attribution_source)
    ).length;

    const kpis = {
      usersRegistered: users.length,
      clientsActive: roles.filter((r) => r.role === "caminante" && r.status === "active").length,
      feriantesActive: roles.filter((r) => r.role === "feriante" && r.status === "active").length,
      organizersActive: organizers.filter((o) => o.approval_status === "approved").length,
      organizersPending: organizers.filter((o) => o.approval_status === "pending").length,
      fairsPublished: fairs.filter((f) => f.status !== "draft" && f.status !== "suspended").length,
      storesEnabled: stores.filter((s) => s.status === "active").length,
      productsAvailable: products.filter((p) => p.status === "published" && p.moderation_status === "approved").length,
      productsInOtrosCount: productsInOtros.length,
      grossSalesCents,
      netSalesCents: Math.max(0, grossSalesCents - platformCommCents - organizerCommCents),
      platformCommissionCents: platformCommCents,
      organizerCommissionCents: organizerCommCents,
      pendingSettlementsCents,
      pendingOrdersCount: orders.filter((o) => ["pending_payment", "payment_in_process", "paid", "preparing"].includes(o.status)).length,
      openClaimsCount: claims.filter((c) => ["open", "in_review"].includes(c.status)).length,
      qrScansTotal: qrScansRes.count ?? 0,
      qrConvertedOrders,
    };

    const settingsMap: Record<string, unknown> = {};
    for (const row of settingsRes.data || []) {
      settingsMap[row.key] = row.value;
    }

    return NextResponse.json({
      ok: true,
      kpis,
      users: enrichedUsers,
      organizers,
      fairs,
      stores,
      products,
      productsInOtros,
      otrosCategoryId: otrosCategory?.id || null,
      categories,
      orders,
      payments: paymentsRes.data || [],
      commissionRules: rulesRes.data || [],
      commissionLedger: ledger,
      settlements,
      claims,
      contentReports: reportsRes.data || [],
      settings: settingsMap,
      auditLogs: auditRes.data || [],
    });
  }

  if (req.method === "POST") {
    const body = (await req.json()) as AnyObj;
    const action = String(body.action || "").trim();
    const nowIso = new Date().toISOString();

    const logAction = async (
      actionName: string,
      entityType: string,
      entityId: string,
      beforeState: unknown,
      afterState: unknown
    ) => {
      await sb.from("fa_audit_logs").insert({
        actor_type: "admin_general",
        actor_id: actor,
        action: actionName,
        entity_type: entityType,
        entity_id: entityId,
        before_state: beforeState ?? null,
        after_state: afterState ?? null,
      });
    };

    if (action === "review_organizer") {
      const id = String(body.organizerProfileId || "");
      const decision = String(body.decision || "");
      if (!id || !["approved", "rejected", "suspended"].includes(decision)) {
        return NextResponse.json({ ok: false, message: "Parámetros inválidos." }, { status: 400 });
      }
      const { data: org } = await sb
        .from("fa_organizer_profiles")
        .select("id, user_id, approval_status")
        .eq("id", id)
        .maybeSingle();
      if (!org) {
        return NextResponse.json({ ok: false, message: "Organizador no encontrado." }, { status: 404 });
      }
      await Promise.all([
        sb
          .from("fa_organizer_profiles")
          .update({
            approval_status: decision,
            approved_by: actor,
            approved_at: decision === "approved" ? nowIso : null,
            updated_at: nowIso,
          })
          .eq("id", org.id),
        sb.from("fa_user_roles").upsert(
          {
            user_id: org.user_id,
            role: "organizador",
            status: decision === "approved" ? "active" : decision,
            approved_by: actor,
            approved_at: decision === "approved" ? nowIso : null,
            updated_at: nowIso,
          },
          { onConflict: "user_id,role" }
        ),
      ]);
      await logAction(`organizer.${decision}`, "organizer_profile", org.id, org, { approval_status: decision });
      return NextResponse.json({ ok: true, message: `Organizador actualizado a estado: ${decision}.` });
    }

    if (action === "update_user_status") {
      const userId = String(body.userId || "");
      const status = String(body.status || "");
      const reason = String(body.reason || "");
      if (!userId || !["active", "suspended", "disabled"].includes(status)) {
        return NextResponse.json({ ok: false, message: "Estado de usuario inválido." }, { status: 400 });
      }
      await sb
        .from("fa_users")
        .update({ status, suspended_reason: reason || null, updated_at: nowIso })
        .eq("id", userId);
      if (status !== "active") {
        await sb.from("fa_sessions").update({ revoked_at: nowIso }).eq("user_id", userId).is("revoked_at", null);
      }
      await logAction("user.update_status", "user", userId, null, { status, reason });
      return NextResponse.json({ ok: true, message: `Usuario actualizado a estado ${status}.` });
    }

    if (action === "update_store_status") {
      const storeId = String(body.storeId || "");
      const status = String(body.status || "");
      const verified = typeof body.verifiedArtisanBadge === "boolean" ? body.verifiedArtisanBadge : undefined;
      if (!storeId || !["active", "paused", "suspended"].includes(status)) {
        return NextResponse.json({ ok: false, message: "Datos de tienda inválidos." }, { status: 400 });
      }
      const patch: Record<string, unknown> = { status, updated_at: nowIso };
      if (verified !== undefined) patch.verified_artisan_badge = verified;
      await sb.from("fa_stores").update(patch).eq("id", storeId);
      await logAction("store.admin_update", "store", storeId, null, patch);
      return NextResponse.json({ ok: true, message: "Estado de la tienda actualizado." });
    }

    if (action === "update_fair_status") {
      const fairId = String(body.fairId || "");
      const status = String(body.status || "");
      if (!fairId || !["upcoming", "active", "finished", "suspended"].includes(status)) {
        return NextResponse.json({ ok: false, message: "Estado de feria inválido." }, { status: 400 });
      }
      await sb.from("fa_fairs").update({ status, updated_at: nowIso }).eq("id", fairId);
      await logAction("fair.admin_update", "fair", fairId, null, { status });
      return NextResponse.json({ ok: true, message: "Estado de feria actualizado." });
    }

    if (action === "save_commission_rule") {
      const name = String(body.name || "Regla Global FeriARTE").trim();
      const platformSharePct = Number(body.platformSharePct);
      const organizerSharePct = Number(body.organizerSharePct);
      const attributionWindowDays = Number(body.attributionWindowDays || 30);
      const marketplaceTotalPct = Number((platformSharePct + organizerSharePct).toFixed(2));

      if (
        !Number.isFinite(platformSharePct) ||
        !Number.isFinite(organizerSharePct) ||
        platformSharePct < 0 ||
        organizerSharePct < 0 ||
        marketplaceTotalPct > 50
      ) {
        return NextResponse.json({ ok: false, message: "Porcentajes de comisión inválidos." }, { status: 400 });
      }

      // Desactivar regla global previa (nunca afecta ventas pasadas que tienen snapshot inmutable)
      await sb
        .from("fa_commission_rules")
        .update({ is_active: false, effective_to: nowIso })
        .eq("scope", "global")
        .eq("is_active", true);

      const { data: created, error } = await sb
        .from("fa_commission_rules")
        .insert({
          scope: "global",
          name,
          marketplace_total_pct: marketplaceTotalPct,
          platform_share_pct: platformSharePct,
          organizer_share_pct: organizerSharePct,
          attribution_window_days: Math.max(1, Math.min(365, Math.round(attributionWindowDays))),
          effective_from: nowIso,
          is_active: true,
          created_by: actor,
          notes: String(body.notes || "Actualizada desde Administrador General de MiniSistema."),
        })
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
      }

      await logAction("commission_rule.create_global", "commission_rule", created.id, null, created);
      return NextResponse.json({
        ok: true,
        rule: created,
        message: `Nueva regla vigente: ${marketplaceTotalPct}% total (${platformSharePct}% FeriARTE + ${organizerSharePct}% Organizador). No altera ventas pasadas.`,
      });
    }

    if (action === "save_platform_setting") {
      const key = String(body.key || "").trim();
      const value = body.value;
      if (!key || !value || typeof value !== "object") {
        return NextResponse.json({ ok: false, message: "Configuración inválida." }, { status: 400 });
      }
      await sb.from("fa_platform_settings").upsert({
        key,
        value,
        updated_by: actor,
        updated_at: nowIso,
      });
      await logAction("settings.update", "platform_setting", key, null, value);
      return NextResponse.json({ ok: true, message: `Configuración «${key}» guardada.` });
    }

    if (action === "release_available_commissions") {
      const forceAll = Boolean(body.forceAll);
      let query = sb
        .from("fa_commission_ledger")
        .update({ status: "available", updated_at: nowIso })
        .eq("beneficiary_type", "organizer")
        .eq("status", "accrued");
      if (!forceAll) {
        query = query.lte("available_at", nowIso);
      }
      const { data: released, error } = await query.select("id");
      if (error) {
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
      }
      await logAction("settlements.release_available", "commission_ledger", "batch", null, {
        count: released?.length || 0,
        forceAll,
      });
      return NextResponse.json({
        ok: true,
        releasedCount: released?.length || 0,
        message: `Se habilitaron ${released?.length || 0} comisiones como disponibles para liquidación.`,
      });
    }

    if (action === "generate_organizer_settlement") {
      const organizerId = String(body.organizerId || "");
      const cadence = ["weekly", "biweekly", "monthly", "on_demand"].includes(String(body.cadence))
        ? String(body.cadence)
        : "monthly";
      if (!organizerId) {
        return NextResponse.json({ ok: false, message: "Seleccioná un organizador." }, { status: 400 });
      }

      const [{ data: org }, { data: availRows }] = await Promise.all([
        sb
          .from("fa_organizer_profiles")
          .select("id, organization_name, payout_method, payout_cbu_cvu, payout_alias, payout_holder_name")
          .eq("id", organizerId)
          .maybeSingle(),
        sb
          .from("fa_commission_ledger")
          .select("id, commission_cents, adjustment_cents, net_payable_cents, created_at")
          .eq("organizer_id", organizerId)
          .eq("beneficiary_type", "organizer")
          .eq("status", "available"),
      ]);

      if (!org) {
        return NextResponse.json({ ok: false, message: "Organizador no encontrado." }, { status: 404 });
      }
      if (!availRows || availRows.length === 0) {
        return NextResponse.json(
          { ok: false, message: "El organizador no tiene comisiones disponibles para liquidar." },
          { status: 400 }
        );
      }

      const totalComm = availRows.reduce((acc, r) => acc + Number(r.commission_cents || 0), 0);
      const totalAdj = availRows.reduce((acc, r) => acc + Number(r.adjustment_cents || 0), 0);
      const netPayout = availRows.reduce((acc, r) => acc + Number(r.net_payable_cents || 0), 0);
      const dates = availRows.map((r) => new Date(r.created_at).getTime()).sort((a, b) => a - b);
      const settlementNumber = `LIQ-FA-${Date.now().toString(36).toUpperCase()}`;

      const { data: settlement, error: sErr } = await sb
        .from("fa_organizer_settlements")
        .insert({
          settlement_number: settlementNumber,
          organizer_id: org.id,
          period_start: new Date(dates[0] || Date.now()).toISOString(),
          period_end: nowIso,
          cadence,
          orders_count: availRows.length,
          total_commissions_cents: totalComm,
          total_adjustments_cents: totalAdj,
          net_payout_cents: netPayout,
          status: "approved",
          payout_destination_snapshot: {
            method: org.payout_method,
            cbuCvu: org.payout_cbu_cvu,
            alias: org.payout_alias,
            holderName: org.payout_holder_name,
          },
          created_by: actor,
        })
        .select("*")
        .single();

      if (sErr || !settlement) {
        return NextResponse.json({ ok: false, message: sErr?.message || "Error creando liquidación." }, { status: 500 });
      }

      await sb.from("fa_settlement_items").insert(
        availRows.map((r) => ({
          settlement_id: settlement.id,
          commission_ledger_id: r.id,
          amount_cents: Number(r.net_payable_cents || 0),
        }))
      );

      await sb
        .from("fa_commission_ledger")
        .update({ status: "in_settlement", updated_at: nowIso })
        .in(
          "id",
          availRows.map((r) => r.id)
        );

      await logAction("settlement.generate", "organizer_settlement", settlement.id, null, settlement);
      return NextResponse.json({
        ok: true,
        settlement,
        message: `Liquidación ${settlementNumber} emitida por ${availRows.length} ventas.`,
      });
    }

    if (action === "mark_settlement_paid") {
      const settlementId = String(body.settlementId || "");
      const transferReference = String(body.transferReference || "").trim();
      if (!settlementId || !transferReference) {
        return NextResponse.json(
          { ok: false, message: "Ingresá el número o referencia de transferencia bancaria." },
          { status: 400 }
        );
      }

      await sb
        .from("fa_organizer_settlements")
        .update({
          status: "paid",
          paid_at: nowIso,
          transfer_reference: transferReference,
          updated_at: nowIso,
        })
        .eq("id", settlementId);

      const { data: items } = await sb
        .from("fa_settlement_items")
        .select("commission_ledger_id")
        .eq("settlement_id", settlementId);

      if (items && items.length > 0) {
        await sb
          .from("fa_commission_ledger")
          .update({ status: "paid", updated_at: nowIso })
          .in(
            "id",
            items.map((i) => i.commission_ledger_id)
          );
      }

      await logAction("settlement.mark_paid", "organizer_settlement", settlementId, null, {
        transferReference,
        paidAt: nowIso,
      });
      return NextResponse.json({
        ok: true,
        message: `Liquidación marcada como pagada (Ref: ${transferReference}).`,
      });
    }

    if (action === "process_refund") {
      const orderId = String(body.orderId || "");
      const reason = String(body.reason || "Devolución administrativa desde MiniSistema").trim();
      if (!orderId) {
        return NextResponse.json({ ok: false, message: "Pedido inválido." }, { status: 400 });
      }
      const { data: order } = await sb
        .from("fa_orders")
        .select("id, total_cents, status")
        .eq("id", orderId)
        .maybeSingle();
      if (!order) {
        return NextResponse.json({ ok: false, message: "Pedido no encontrado." }, { status: 404 });
      }
      const refundAmountCents = Number(body.refundAmountCents || order.total_cents);
      const isFull = refundAmountCents >= Number(order.total_cents);

      const { data: ledgerRows } = await sb
        .from("fa_commission_ledger")
        .select("id, beneficiary_type, commission_cents, adjustment_cents")
        .eq("order_id", order.id);

      let platformDelta = 0;
      let organizerDelta = 0;
      for (const row of ledgerRows || []) {
        const orig = Number(row.commission_cents || 0);
        const reversed = isFull
          ? orig
          : Math.round((orig * refundAmountCents) / Math.max(1, Number(order.total_cents)));
        const delta = -reversed;
        if (row.beneficiary_type === "platform") platformDelta = delta;
        if (row.beneficiary_type === "organizer") organizerDelta = delta;

        await sb
          .from("fa_commission_ledger")
          .update({
            adjustment_cents: Number(row.adjustment_cents || 0) + delta,
            net_payable_cents: Math.max(0, orig - reversed),
            status: isFull ? "voided_adjusted" : undefined,
            updated_at: nowIso,
            notes: `Ajuste reembolso (${reason})`,
          })
          .eq("id", row.id);
      }

      await sb.from("fa_refunds_adjustments").insert({
        order_id: order.id,
        refund_type: isFull ? "full" : "partial",
        refund_amount_cents: refundAmountCents,
        platform_commission_delta_cents: platformDelta,
        organizer_commission_delta_cents: organizerDelta,
        reason,
        status: "completed",
        processed_by: actor,
        processed_at: nowIso,
      });

      if (isFull) {
        await sb.from("fa_orders").update({ status: "refunded", updated_at: nowIso }).eq("id", order.id);
      }

      await logAction("refund.admin_processed", "order", order.id, null, {
        refundAmountCents,
        isFull,
        platformDelta,
        organizerDelta,
      });
      return NextResponse.json({
        ok: true,
        message: `Reembolso ${isFull ? "total" : "parcial"} registrado y comisiones recalculadas.`,
      });
    }

    if (action === "resolve_claim") {
      const claimId = String(body.claimId || "");
      const status = String(body.status || "");
      const resolutionNote = String(body.resolutionNote || "").trim();
      if (
        !claimId ||
        !["in_review", "resolved_buyer", "resolved_seller", "resolved_partial", "closed"].includes(status)
      ) {
        return NextResponse.json({ ok: false, message: "Resolución de reclamo inválida." }, { status: 400 });
      }
      await sb
        .from("fa_disputes_claims")
        .update({
          status,
          resolution_note: resolutionNote || null,
          resolved_by: actor,
          resolved_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", claimId);
      await logAction("claim.resolve", "dispute_claim", claimId, null, { status, resolutionNote });
      return NextResponse.json({ ok: true, message: `Reclamo actualizado a ${status}.` });
    }

    if (action === "create_category") {
      const name = String(body.name || "").trim();
      const description = String(body.description || "").trim();
      const icon = String(body.icon || "tag").trim() || "tag";
      const assignProductIds = Array.isArray(body.assignProductIds)
        ? body.assignProductIds.map((id) => String(id || "").trim()).filter(Boolean)
        : body.assignProductId
          ? [String(body.assignProductId).trim()]
          : [];

      if (name.length < 2 || name.length > 80) {
        return NextResponse.json(
          { ok: false, message: "El nombre de la categoría debe tener entre 2 y 80 caracteres." },
          { status: 400 }
        );
      }

      const baseSlug = slugifyCategory(name);
      if (!baseSlug) {
        return NextResponse.json(
          { ok: false, message: "No se pudo generar un identificador válido para esa categoría." },
          { status: 400 }
        );
      }

      const { data: existingCats } = await sb
        .from("fa_categories")
        .select("id, slug, name, sort_order");

      const duplicate = (existingCats || []).find(
        (c) =>
          c.slug === baseSlug ||
          String(c.name || "").trim().toLowerCase() === name.toLowerCase()
      );
      if (duplicate) {
        return NextResponse.json(
          { ok: false, message: `Ya existe una categoría llamada «${duplicate.name}».` },
          { status: 409 }
        );
      }

      // Colocar antes de «Otros» (sort_order 999) automáticamente
      const maxNormalOrder = (existingCats || [])
        .filter((c) => c.slug !== "otros" && Number(c.sort_order) < 900)
        .reduce((max, c) => Math.max(max, Number(c.sort_order || 0)), 0);

      const requestedSort = Number(body.sortOrder);
      const sortOrder =
        Number.isFinite(requestedSort) && requestedSort > 0
          ? Math.round(requestedSort)
          : maxNormalOrder + 1;

      const { data: createdCat, error: catErr } = await sb
        .from("fa_categories")
        .insert({
          slug: baseSlug,
          name,
          description: description || null,
          icon,
          sort_order: sortOrder,
          is_active: true,
        })
        .select("*")
        .single();

      if (catErr || !createdCat) {
        return NextResponse.json(
          { ok: false, message: catErr?.message || "No se pudo crear la categoría." },
          { status: 500 }
        );
      }

      await logAction("category.create", "category", createdCat.id, null, createdCat);

      let movedCount = 0;
      if (assignProductIds.length > 0) {
        const { data: movedRows } = await sb
          .from("fa_products")
          .update({
            category_id: createdCat.id,
            suggested_category_note: null,
            updated_at: nowIso,
          })
          .in("id", assignProductIds)
          .select("id");
        movedCount = movedRows?.length || 0;
        for (const row of movedRows || []) {
          await logAction("product.recategorize", "product", row.id, null, {
            category_id: createdCat.id,
            category_name: createdCat.name,
            via: "new_category_from_otros",
          });
        }
      }

      return NextResponse.json({
        ok: true,
        category: createdCat,
        movedCount,
        message:
          movedCount > 0
            ? `Categoría «${createdCat.name}» creada y asignada a ${movedCount} producto(s).`
            : `Categoría «${createdCat.name}» creada correctamente y ya disponible en FeriARTE.`,
      });
    }

    if (action === "recategorize_product") {
      const productId = String(body.productId || "").trim();
      const categoryId = String(body.categoryId || "").trim();
      if (!productId || !categoryId) {
        return NextResponse.json(
          { ok: false, message: "Seleccioná un producto y una categoría destino." },
          { status: 400 }
        );
      }

      const [{ data: prod }, { data: targetCat }] = await Promise.all([
        sb
          .from("fa_products")
          .select("id, title, category_id, suggested_category_note")
          .eq("id", productId)
          .maybeSingle(),
        sb
          .from("fa_categories")
          .select("id, slug, name, is_active")
          .eq("id", categoryId)
          .maybeSingle(),
      ]);

      if (!prod) {
        return NextResponse.json({ ok: false, message: "Producto no encontrado." }, { status: 404 });
      }
      if (!targetCat) {
        return NextResponse.json({ ok: false, message: "Categoría destino no encontrada." }, { status: 404 });
      }

      const { error: updErr } = await sb
        .from("fa_products")
        .update({
          category_id: targetCat.id,
          suggested_category_note: targetCat.slug === "otros" ? prod.suggested_category_note : null,
          updated_at: nowIso,
        })
        .eq("id", prod.id);

      if (updErr) {
        return NextResponse.json({ ok: false, message: updErr.message }, { status: 500 });
      }

      await logAction(
        "product.recategorize",
        "product",
        prod.id,
        { category_id: prod.category_id, suggested_category_note: prod.suggested_category_note },
        { category_id: targetCat.id, category_name: targetCat.name }
      );

      return NextResponse.json({
        ok: true,
        message: `«${prod.title}» reasignado a «${targetCat.name}».`,
      });
    }

    if (action === "toggle_category_active") {
      const categoryId = String(body.categoryId || "").trim();
      const isActive = Boolean(body.isActive);
      if (!categoryId) {
        return NextResponse.json({ ok: false, message: "Categoría inválida." }, { status: 400 });
      }
      const { data: cat } = await sb
        .from("fa_categories")
        .select("id, slug, name, is_active")
        .eq("id", categoryId)
        .maybeSingle();
      if (!cat) {
        return NextResponse.json({ ok: false, message: "Categoría no encontrada." }, { status: 404 });
      }
      await sb.from("fa_categories").update({ is_active: isActive }).eq("id", cat.id);
      await logAction("category.toggle_active", "category", cat.id, { is_active: cat.is_active }, { is_active: isActive });
      return NextResponse.json({
        ok: true,
        message: `Categoría «${cat.name}» ${isActive ? "activada" : "desactivada"}.`,
      });
    }

    if (action === "review_report") {
      const reportId = String(body.reportId || "");
      const status = String(body.status || "");
      if (!reportId || !["reviewing", "action_taken", "dismissed"].includes(status)) {
        return NextResponse.json({ ok: false, message: "Estado de denuncia inválido." }, { status: 400 });
      }
      await sb
        .from("fa_content_reports")
        .update({ status, reviewed_by: actor, reviewed_at: nowIso })
        .eq("id", reportId);
      await logAction("moderation.review_report", "content_report", reportId, null, { status });
      return NextResponse.json({ ok: true, message: `Denuncia actualizada a ${status}.` });
    }

    if (action === "save_shipping_tariffs") {
      const localArs = Number(body.localArs);
      const provincialArs = Number(body.provincialArs);
      const nationalArs = Number(body.nationalArs);
      const multChico = Number(body.multChico ?? 1);
      const multMediano = Number(body.multMediano ?? 1.35);
      const multGrande = Number(body.multGrande ?? 1.8);
      const fragileArs = Number(body.fragileArs ?? 0);
      const referenceProvider =
        String(body.referenceProvider || "Correo Argentino / Paq.ar (Referencial)")
          .trim()
          .slice(0, 120) || "Correo Argentino / Paq.ar (Referencial)";

      if (
        !Number.isFinite(localArs) ||
        localArs < 0 ||
        !Number.isFinite(provincialArs) ||
        provincialArs < 0 ||
        !Number.isFinite(nationalArs) ||
        nationalArs < 0 ||
        !Number.isFinite(fragileArs) ||
        fragileArs < 0
      ) {
        return NextResponse.json(
          { ok: false, message: "Ingresá importes válidos en ARS (mayores o iguales a 0)." },
          { status: 400 }
        );
      }

      if (
        !Number.isFinite(multChico) ||
        multChico < 0.5 ||
        multChico > 5 ||
        !Number.isFinite(multMediano) ||
        multMediano < 0.5 ||
        multMediano > 5 ||
        !Number.isFinite(multGrande) ||
        multGrande < 0.5 ||
        multGrande > 5
      ) {
        return NextResponse.json(
          { ok: false, message: "Los multiplicadores de paquete deben estar entre 0.5 y 5.0." },
          { status: 400 }
        );
      }

      const nextValue = {
        referenceProvider,
        zones: {
          localCents: Math.round(localArs * 100),
          provincialCents: Math.round(provincialArs * 100),
          nationalCents: Math.round(nationalArs * 100),
        },
        packageMultipliers: {
          chico: Number(multChico.toFixed(2)),
          mediano: Number(multMediano.toFixed(2)),
          grande: Number(multGrande.toFixed(2)),
        },
        fragileSurchargeCents: Math.round(fragileArs * 100),
        commissionOnShipping: false,
      };

      const { data: prevSetting } = await sb
        .from("fa_platform_settings")
        .select("value")
        .eq("key", "shipping_tariffs")
        .maybeSingle();

      const { error: upsertErr } = await sb.from("fa_platform_settings").upsert(
        {
          key: "shipping_tariffs",
          value: nextValue,
          updated_by: actor,
          updated_at: nowIso,
        },
        { onConflict: "key" }
      );

      if (upsertErr) {
        return NextResponse.json({ ok: false, message: upsertErr.message }, { status: 500 });
      }

      await logAction(
        "settings.save_shipping_tariffs",
        "platform_setting",
        "shipping_tariffs",
        (prevSetting?.value as AnyObj) || null,
        nextValue
      );

      return NextResponse.json({
        ok: true,
        message: "Tarifario Nacional de Envíos FeriARTE actualizado en tiempo real.",
      });
    }

    return NextResponse.json({ ok: false, message: `Acción no soportada: ${action}` }, { status: 400 });
  }

  return NextResponse.json({ ok: false, message: "Método no permitido." }, { status: 405 });
}
