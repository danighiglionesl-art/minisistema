import { NextRequest, NextResponse } from "next/server";
import { extractErpSessionFromRequest } from "../erp-session";
import { getPlatformSupabase } from "../supabase-server";
import {
  type ErpTenantRecord,
  GENERAL_ADMIN_USERNAME,
  normalizeErpRole,
} from "../types";

type AnyObj = Record<string, unknown>;

const ADMIN_ALLOWED_REQUEST_STATUSES = new Set([
  "recibida",
  "en_revision_documental",
  "pendiente_documentacion_adicional",
  "documentacion_completa",
  "presupuesto_pendiente_aceptacion",
  "pendiente_pago",
  "asignada_profesional",
  "suspendida",
  "cancelada",
]);

const PROFESSIONAL_ONLY_REQUEST_STATUSES = new Set([
  "en_elaboracion",
  "en_revision_profesional",
  "pendiente_firma_digital",
  "presentada_consejo",
  "observada_consejo",
  "legalizacion_aprobada",
  "documento_disponible",
  "finalizada",
  "rechazada",
]);

function isGeneralAdmin(session: { username: string; role: string } | null): boolean {
  if (!session) return false;
  const user = String(session.username || "").trim().toLowerCase();
  if (user === GENERAL_ADMIN_USERNAME) return true;
  return normalizeErpRole(session.role, user) === "Administrador General";
}

export async function handleErpDonContador(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const session = extractErpSessionFromRequest(req, tenant.slug);
  if (!isGeneralAdmin(session)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Acceso exclusivo del Administrador General de MiniSistema para gestionar Don Contador.",
      },
      { status: 403 }
    );
  }

  const actor = session?.username || GENERAL_ADMIN_USERNAME;
  const sb = await getPlatformSupabase();

  if (req.method === "GET") {
    const [
      usersRes,
      userRolesRes,
      orgsRes,
      orgMembersRes,
      prosRes,
      licensesRes,
      servicesRes,
      requestsRes,
      quotesRes,
      paymentsRes,
      invoicesRes,
      legalRes,
      delivRes,
      consultsRes,
      apptsRes,
      settingsRes,
      auditRes,
    ] = await Promise.all([
      sb
        .from("dc_users")
        .select("id, email, full_name, phone, status, suspended_reason, email_verified_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      sb
        .from("dc_user_roles")
        .select("user_id, role, status")
        .limit(400),
      sb
        .from("dc_organizations")
        .select("id, legal_name, cuit, entity_type, activity, status, created_at")
        .order("created_at", { ascending: false })
        .limit(150),
      sb
        .from("dc_organization_members")
        .select("id, organization_id, user_id, role_in_org, can_request_acts, authorization_status, verified_by, verified_at, created_at")
        .order("created_at", { ascending: false })
        .limit(150),
      sb
        .from("dc_professionals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      sb
        .from("dc_professional_licenses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      sb
        .from("dc_services")
        .select("id, code, slug, commercial_name, technical_name, act_type, jurisdiction, validity_status, commercial_status, pricing_mode, base_fee_ars, estimated_legalization_fee_ars, requires_legalization")
        .order("sort_order", { ascending: true })
        .limit(120),
      sb
        .from("dc_requests")
        .select("id, request_number, client_user_id, service_id, status, documentation_status, professional_status, legalization_status, payment_status, recipient_name, jurisdiction, assigned_professional_id, submitted_at, completed_at, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(200),
      sb
        .from("dc_quotes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150),
      sb
        .from("dc_payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150),
      sb
        .from("dc_invoices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150),
      sb
        .from("dc_legalization_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150),
      sb
        .from("dc_deliverables")
        .select("id, request_id, professional_id, title, original_filename, is_legalized, legalization_council, external_reference, official_validation_url, issued_at, download_count")
        .order("created_at", { ascending: false })
        .limit(150),
      sb
        .from("dc_consultations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      sb
        .from("dc_appointments")
        .select("*")
        .order("scheduled_start", { ascending: false })
        .limit(100),
      sb.from("dc_settings").select("*"),
      sb
        .from("dc_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150),
    ]);

    if (usersRes.error && usersRes.error.message.includes("does not exist")) {
      return NextResponse.json({
        ok: true,
        schemaPending: true,
        message:
          "Falta ejecutar la migración SQL 001_dc_core_schema_and_rls.sql de Don Contador en Supabase.",
        kpis: {},
      });
    }

    const rawUsers = usersRes.data || [];
    const rawRoles = userRolesRes.data || [];
    const rolesByUser = new Map<string, Array<{ role: string; status: string }>>();
    for (const r of rawRoles) {
      const list = rolesByUser.get(r.user_id) || [];
      list.push({ role: r.role, status: r.status });
      rolesByUser.set(r.user_id, list);
    }

    const users = rawUsers.map((u) => ({
      ...u,
      roles: rolesByUser.get(u.id) || [],
    }));

    const requests = requestsRes.data || [];
    const quotes = quotesRes.data || [];
    const payments = paymentsRes.data || [];
    const pros = prosRes.data || [];
    const orgMembers = orgMembersRes.data || [];
    const licenses = licensesRes.data || [];

    const observedCount = requests.filter(
      (r) =>
        r.status === "pendiente_documentacion_adicional" ||
        r.status === "observada_consejo"
    ).length;

    const kpis = {
      clientsRegistered: users.length,
      organizationsRegistered: (orgsRes.data || []).length,
      orgMembersPending: orgMembers.filter((m) => m.authorization_status === "pending_review").length,
      professionalsActive: pros.filter((p) => p.active).length,
      licensesPending: licenses.filter((l) => l.habilitation_status === "pending_verification").length,
      servicesCatalogCount: (servicesRes.data || []).length,
      servicesEnabledCount: (servicesRes.data || []).filter(
        (s) => s.commercial_status === "habilitado_contratacion"
      ).length,
      requestsTotal: requests.length,
      requestsInProgress: requests.filter(
        (r) => !["borrador", "finalizada", "cancelada", "rechazada"].includes(r.status)
      ).length,
      requestsPendingDocs: requests.filter(
        (r) => r.status === "pendiente_documentacion_adicional"
      ).length,
      requestsObservedRatePct:
        requests.length > 0
          ? Number(((observedCount / requests.length) * 100).toFixed(1))
          : 0,
      deliverablesIssued: (delivRes.data || []).length,
      quotedTotalArs: quotes.reduce((acc, q) => acc + Number(q.total_ars || 0), 0),
      collectedFeesArs: payments
        .filter((p) => p.status === "approved")
        .reduce((acc, p) => acc + Number(p.professional_fee_part_ars || 0), 0),
      collectedLegalizationArs: payments
        .filter((p) => p.status === "approved")
        .reduce((acc, p) => acc + Number(p.legalization_part_ars || 0), 0),
      pendingTransfersCount: payments.filter(
        (p) => p.provider === "transferencia_bancaria" && ["pending", "in_process"].includes(p.status)
      ).length,
      pendingPaymentsArs: quotes
        .filter((q) => q.status === "aceptado")
        .reduce((acc, q) => acc + Number(q.total_ars || 0), 0),
    };

    const settingsMap: Record<string, unknown> = {};
    for (const row of settingsRes.data || []) {
      settingsMap[row.key] = row.value;
    }

    return NextResponse.json({
      ok: true,
      kpis,
      users,
      organizations: orgsRes.data || [],
      organizationMembers: orgMembers,
      professionals: pros,
      licenses,
      services: servicesRes.data || [],
      requests,
      quotes,
      payments,
      invoices: invoicesRes.data || [],
      legalizations: legalRes.data || [],
      deliverables: delivRes.data || [],
      consultations: consultsRes.data || [],
      appointments: apptsRes.data || [],
      settings: settingsMap,
      auditLogs: auditRes.data || [],
    });
  }

  if (req.method === "POST") {
    const body = (await req.json()) as AnyObj;
    const action = String(body.action || "").trim();
    const nowIso = new Date().toISOString();

    // Segregación estricta de roles: un administrador nunca aprueba técnicamente, firma ni emite entregables
    if (
      action === "approve_technical_act" ||
      action === "sign_certification" ||
      action === "issue_deliverable" ||
      action === "technical_approval" ||
      action === "sign_document" ||
      action === "approve_certification"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Segregación de roles: la aprobación técnica, firma digital y emisión profesional son exclusivas de Contadores Públicos matriculados desde el Panel Profesional.",
        },
        { status: 403 }
      );
    }

    const logAction = async (
      actionName: string,
      entityType: string,
      entityId: string,
      afterState: unknown,
      beforeState?: unknown
    ) => {
      await sb.from("dc_audit_logs").insert({
        actor_type: "admin_general",
        actor_id: actor,
        action: actionName,
        entity_type: entityType,
        entity_id: entityId,
        before_state: beforeState ?? null,
        after_state: afterState ?? null,
      });
    };

    if (action === "assign_professional") {
      const requestId = String(body.requestId || "").trim();
      const professionalId = String(body.professionalId || "").trim();
      if (!requestId || !professionalId) {
        return NextResponse.json({ ok: false, message: "Faltan datos de asignación." }, { status: 400 });
      }
      const { data: prevReq } = await sb
        .from("dc_requests")
        .select("status, assigned_professional_id")
        .eq("id", requestId)
        .maybeSingle();

      const { error: updErr } = await sb
        .from("dc_requests")
        .update({
          assigned_professional_id: professionalId,
          status: "asignada_profesional",
          professional_status: "asignada",
          updated_at: nowIso,
        })
        .eq("id", requestId);
      if (updErr) {
        return NextResponse.json({ ok: false, message: updErr.message }, { status: 500 });
      }

      await Promise.all([
        sb.from("dc_professional_assignments").insert({
          request_id: requestId,
          professional_id: professionalId,
          assigned_by: actor,
          role_in_request: "responsable",
          status: "active",
        }),
        sb.from("dc_request_status_history").insert({
          request_id: requestId,
          from_status: prevReq?.status || null,
          to_status: "asignada_profesional",
          changed_by_label: `minisistema:@${actor}`,
          actor_role: "admin_general",
          notes: "Expediente asignado a Contador Público matriculado desde MiniSistema.",
          client_visible: true,
        }),
      ]);
      await logAction("don_contador.assign_professional", "request", requestId, { professionalId }, prevReq);
      return NextResponse.json({ ok: true, message: "Profesional asignado al expediente." });
    }

    if (action === "update_request_status") {
      const requestId = String(body.requestId || "").trim();
      const status = String(body.status || "").trim();
      const notes = String(body.notes || "").trim();
      if (!requestId || !status) {
        return NextResponse.json({ ok: false, message: "Indicá el expediente y el nuevo estado." }, { status: 400 });
      }
      if (PROFESSIONAL_ONLY_REQUEST_STATUSES.has(status)) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Segregación de roles: los estados técnicos, de firma digital, legalización CPCE o emisión final corresponden exclusivamente al Contador Público matriculado en /profesional.",
          },
          { status: 403 }
        );
      }
      if (!ADMIN_ALLOWED_REQUEST_STATUSES.has(status)) {
        return NextResponse.json({ ok: false, message: `Estado administrativo inválido: ${status}` }, { status: 400 });
      }

      const { data: prevReq } = await sb
        .from("dc_requests")
        .select("status")
        .eq("id", requestId)
        .maybeSingle();

      const { error: updErr } = await sb
        .from("dc_requests")
        .update({ status, updated_at: nowIso })
        .eq("id", requestId);
      if (updErr) {
        return NextResponse.json({ ok: false, message: updErr.message }, { status: 500 });
      }

      await sb.from("dc_request_status_history").insert({
        request_id: requestId,
        from_status: prevReq?.status || null,
        to_status: status,
        changed_by_label: `minisistema:@${actor}`,
        actor_role: "admin_general",
        notes: notes || `Estado administrativo actualizado a ${status} desde MiniSistema.`,
        client_visible: true,
      });

      await logAction("don_contador.update_request_status", "request", requestId, { status, notes }, prevReq);
      return NextResponse.json({ ok: true, message: `Expediente actualizado a «${status}».` });
    }

    if (action === "update_service_status") {
      const serviceId = String(body.serviceId || "").trim();
      const commercialStatus = String(body.commercialStatus || "").trim();
      const validityStatus = String(body.validityStatus || "").trim();
      const pricingMode = String(body.pricingMode || "").trim();
      if (!serviceId) {
        return NextResponse.json({ ok: false, message: "Falta serviceId." }, { status: 400 });
      }
      const patch: Record<string, unknown> = { updated_at: nowIso };
      if (commercialStatus) {
        if (!["habilitado_contratacion", "consultar_disponibilidad", "pausado"].includes(commercialStatus)) {
          return NextResponse.json({ ok: false, message: "Estado comercial inválido." }, { status: 400 });
        }
        patch.commercial_status = commercialStatus;
      }
      if (validityStatus) {
        if (!["vigente_verificado", "pendiente_validacion", "en_revision", "discontinuado"].includes(validityStatus)) {
          return NextResponse.json({ ok: false, message: "Estado de vigencia inválido." }, { status: 400 });
        }
        patch.validity_status = validityStatus;
      }
      if (pricingMode) {
        if (!["precio_fijo", "presupuesto", "por_complejidad", "abono_mensual", "recurrente"].includes(pricingMode)) {
          return NextResponse.json({ ok: false, message: "Modalidad de precio inválida." }, { status: 400 });
        }
        patch.pricing_mode = pricingMode;
      }
      if (body.baseFeeArs !== undefined && body.baseFeeArs !== "") {
        const fee = Number(body.baseFeeArs);
        if (!Number.isFinite(fee) || fee < 0) {
          return NextResponse.json({ ok: false, message: "Honorario base inválido." }, { status: 400 });
        }
        patch.base_fee_ars = fee;
      } else if (body.baseFeeArs === "") {
        patch.base_fee_ars = null;
      }
      if (body.estimatedLegalizationFeeArs !== undefined && body.estimatedLegalizationFeeArs !== "") {
        const leg = Number(body.estimatedLegalizationFeeArs);
        if (!Number.isFinite(leg) || leg < 0) {
          return NextResponse.json({ ok: false, message: "Arancel estimado de legalización inválido." }, { status: 400 });
        }
        patch.estimated_legalization_fee_ars = leg;
      } else if (body.estimatedLegalizationFeeArs === "") {
        patch.estimated_legalization_fee_ars = null;
      }
      if (typeof body.requiresLegalization === "boolean") {
        patch.requires_legalization = body.requiresLegalization;
      }

      const { error: updErr } = await sb.from("dc_services").update(patch).eq("id", serviceId);
      if (updErr) {
        return NextResponse.json({ ok: false, message: updErr.message }, { status: 500 });
      }
      await logAction("don_contador.update_service", "service", serviceId, patch);
      return NextResponse.json({ ok: true, message: "Servicio del catálogo actualizado." });
    }

    if (action === "create_professional") {
      const userId = String(body.userId || "").trim();
      const fullName = String(body.fullName || "").trim();
      const degreeTitle = String(body.degreeTitle || "Contador Público").trim() || "Contador Público";
      const university = String(body.university || "").trim();
      const professionalEmail = String(body.professionalEmail || "").trim() || null;
      const professionalPhone = String(body.professionalPhone || "").trim() || null;
      const licenseNumber = String(body.licenseNumber || "").trim();
      const councilName = String(body.councilName || "CPCE Córdoba").trim() || "CPCE Córdoba";
      const jurisdiction = String(body.jurisdiction || "Córdoba").trim() || "Córdoba";

      if (!userId || fullName.length < 3) {
        return NextResponse.json(
          { ok: false, message: "Seleccioná un usuario registrado e ingresá el nombre completo del profesional." },
          { status: 400 }
        );
      }

      const { data: pro, error: proErr } = await sb
        .from("dc_professionals")
        .upsert(
          {
            user_id: userId,
            full_name: fullName,
            degree_title: degreeTitle,
            university,
            professional_email: professionalEmail,
            professional_phone: professionalPhone,
            active: true,
            accepts_assignments: true,
            updated_at: nowIso,
          },
          { onConflict: "user_id" }
        )
        .select("*")
        .single();

      if (proErr || !pro) {
        return NextResponse.json({ ok: false, message: proErr?.message || "No se pudo registrar el profesional." }, { status: 500 });
      }

      await sb.from("dc_user_roles").upsert(
        {
          user_id: userId,
          role: "contador_profesional",
          status: "active",
          granted_by: `minisistema:@${actor}`,
          updated_at: nowIso,
        },
        { onConflict: "user_id,role" }
      );

      if (licenseNumber) {
        await sb.from("dc_professional_licenses").upsert(
          {
            professional_id: pro.id,
            council_name: councilName,
            jurisdiction,
            license_number: licenseNumber,
            habilitation_status: "pending_verification",
            updated_at: nowIso,
          },
          { onConflict: "council_name,license_number" }
        );
      }

      await logAction("don_contador.create_professional", "professional", pro.id, {
        userId,
        fullName,
        licenseNumber: licenseNumber || null,
      });
      return NextResponse.json({ ok: true, professional: pro, message: `Profesional «${fullName}» dado de alta y habilitado con rol contador_profesional.` });
    }

    if (action === "update_professional") {
      const professionalId = String(body.professionalId || "").trim();
      if (!professionalId) {
        return NextResponse.json({ ok: false, message: "Falta professionalId." }, { status: 400 });
      }
      const patch: Record<string, unknown> = { updated_at: nowIso };
      if (typeof body.active === "boolean") patch.active = body.active;
      if (typeof body.acceptsAssignments === "boolean") patch.accepts_assignments = body.acceptsAssignments;
      if (body.maxConcurrentRequests !== undefined) {
        const m = Math.max(1, Math.min(200, Math.round(Number(body.maxConcurrentRequests) || 25)));
        patch.max_concurrent_requests = m;
      }

      const { error: updErr } = await sb.from("dc_professionals").update(patch).eq("id", professionalId);
      if (updErr) {
        return NextResponse.json({ ok: false, message: updErr.message }, { status: 500 });
      }
      await logAction("don_contador.update_professional", "professional", professionalId, patch);
      return NextResponse.json({ ok: true, message: "Estado del profesional actualizado." });
    }

    if (action === "add_license") {
      const professionalId = String(body.professionalId || "").trim();
      const councilName = String(body.councilName || "CPCE Córdoba").trim();
      const jurisdiction = String(body.jurisdiction || "Córdoba").trim();
      const licenseNumber = String(body.licenseNumber || "").trim();
      const tomo = String(body.tomo || "").trim() || null;
      const folio = String(body.folio || "").trim() || null;
      const validUntil = String(body.validUntil || "").trim() || null;
      const habilitationStatus = ["habilitada", "pending_verification", "suspendida", "vencida"].includes(
        String(body.habilitationStatus || "")
      )
        ? String(body.habilitationStatus)
        : "pending_verification";

      if (!professionalId || !licenseNumber) {
        return NextResponse.json({ ok: false, message: "Seleccioná un profesional e ingresá el número de matrícula." }, { status: 400 });
      }

      const { data: lic, error: licErr } = await sb
        .from("dc_professional_licenses")
        .insert({
          professional_id: professionalId,
          council_name: councilName,
          jurisdiction,
          license_number: licenseNumber,
          tomo,
          folio,
          valid_until: validUntil,
          habilitation_status: habilitationStatus,
          verified_by: habilitationStatus === "habilitada" ? actor : null,
          verified_at: habilitationStatus === "habilitada" ? nowIso : null,
        })
        .select("*")
        .single();

      if (licErr || !lic) {
        return NextResponse.json({ ok: false, message: licErr?.message || "No se pudo registrar la matrícula." }, { status: 500 });
      }

      await logAction("don_contador.add_license", "license", lic.id, lic);
      return NextResponse.json({ ok: true, license: lic, message: `Matrícula ${licenseNumber} (${councilName}) registrada.` });
    }

    if (action === "verify_license") {
      const licenseId = String(body.licenseId || "").trim();
      const habilitationStatus = String(body.habilitationStatus || "habilitada").trim();
      if (
        !licenseId ||
        !["habilitada", "pending_verification", "suspendida", "vencida"].includes(habilitationStatus)
      ) {
        return NextResponse.json({ ok: false, message: "Parámetros de matrícula inválidos." }, { status: 400 });
      }
      const { error: updErr } = await sb
        .from("dc_professional_licenses")
        .update({
          habilitation_status: habilitationStatus,
          verified_by: actor,
          verified_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", licenseId);
      if (updErr) {
        return NextResponse.json({ ok: false, message: updErr.message }, { status: 500 });
      }
      await logAction("don_contador.verify_license", "license", licenseId, { habilitationStatus });
      return NextResponse.json({ ok: true, message: `Matrícula actualizada a ${habilitationStatus}.` });
    }

    if (action === "update_user_status") {
      const userId = String(body.userId || "").trim();
      const status = String(body.status || "").trim();
      const reason = String(body.reason || "").trim();
      if (!userId || !["active", "suspended", "disabled"].includes(status)) {
        return NextResponse.json({ ok: false, message: "Estado de usuario inválido." }, { status: 400 });
      }
      const { error: updErr } = await sb
        .from("dc_users")
        .update({
          status,
          suspended_reason: status === "active" ? null : reason || "Actualizado desde MiniSistema",
          updated_at: nowIso,
        })
        .eq("id", userId);
      if (updErr) {
        return NextResponse.json({ ok: false, message: updErr.message }, { status: 500 });
      }
      if (status !== "active") {
        await sb.from("dc_sessions").update({ revoked_at: nowIso }).eq("user_id", userId).is("revoked_at", null);
      }
      await logAction("don_contador.update_user_status", "user", userId, { status, reason });
      return NextResponse.json({ ok: true, message: `Cuenta de usuario actualizada a «${status}».` });
    }

    if (action === "approve_org_membership") {
      const membershipId = String(body.membershipId || "").trim();
      const status = String(body.status || "approved").trim();
      if (!membershipId || !["approved", "rejected", "revoked", "pending_review"].includes(status)) {
        return NextResponse.json({ ok: false, message: "Parámetros de representación inválidos." }, { status: 400 });
      }
      const { error: updErr } = await sb
        .from("dc_organization_members")
        .update({
          authorization_status: status,
          can_request_acts: status === "approved",
          verified_by: actor,
          verified_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", membershipId);
      if (updErr) {
        return NextResponse.json({ ok: false, message: updErr.message }, { status: 500 });
      }
      await logAction("don_contador.approve_org_member", "organization_member", membershipId, { status });
      return NextResponse.json({ ok: true, message: `Representación societaria actualizada a ${status}.` });
    }

    if (action === "create_quote") {
      const requestId = String(body.requestId || "").trim();
      const pricingMode = ["precio_fijo", "presupuesto", "por_complejidad", "abono_mensual", "recurrente"].includes(
        String(body.pricingMode || "")
      )
        ? String(body.pricingMode)
        : "presupuesto";
      const professionalFeeArs = Number(body.professionalFeeArs || 0);
      const legalizationFeeArs = Number(body.legalizationFeeArs || 0);
      const taxesAndExpensesArs = Number(body.taxesAndExpensesArs || 0);
      const description = String(body.description || "").trim();
      const validUntil = String(body.validUntil || "").trim() || null;

      if (
        !requestId ||
        !Number.isFinite(professionalFeeArs) ||
        professionalFeeArs < 0 ||
        !Number.isFinite(legalizationFeeArs) ||
        legalizationFeeArs < 0 ||
        !Number.isFinite(taxesAndExpensesArs) ||
        taxesAndExpensesArs < 0 ||
        description.length < 3
      ) {
        return NextResponse.json(
          { ok: false, message: "Completá el expediente, importes válidos (>= 0) y descripción del presupuesto." },
          { status: 400 }
        );
      }

      const { data: reqRow } = await sb
        .from("dc_requests")
        .select("id, request_number, client_user_id")
        .eq("id", requestId)
        .maybeSingle();

      if (!reqRow) {
        return NextResponse.json({ ok: false, message: "Expediente no encontrado." }, { status: 404 });
      }

      const totalArs = Number((professionalFeeArs + legalizationFeeArs + taxesAndExpensesArs).toFixed(2));
      const quoteNumber = `PRES-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 89999)}`;

      const { data: quote, error: qErr } = await sb
        .from("dc_quotes")
        .insert({
          quote_number: quoteNumber,
          request_id: reqRow.id,
          client_user_id: reqRow.client_user_id,
          pricing_mode: pricingMode,
          professional_fee_ars: professionalFeeArs,
          legalization_fee_ars: legalizationFeeArs,
          taxes_and_expenses_ars: taxesAndExpensesArs,
          total_ars: totalArs,
          fee_scale_checked: true,
          description,
          valid_until: validUntil,
          status: "enviado",
          created_by: `minisistema:@${actor}`,
        })
        .select("*")
        .single();

      if (qErr || !quote) {
        return NextResponse.json({ ok: false, message: qErr?.message || "No se pudo emitir el presupuesto." }, { status: 500 });
      }

      await Promise.all([
        sb
          .from("dc_requests")
          .update({
            status: "presupuesto_pendiente_aceptacion",
            payment_status: "pendiente_presupuesto",
            updated_at: nowIso,
          })
          .eq("id", reqRow.id),
        sb.from("dc_notifications").insert({
          user_id: reqRow.client_user_id,
          channel: "in_app",
          event_type: "presupuesto_disponible",
          title: `Presupuesto ${quoteNumber} disponible`,
          body: `Tenés un presupuesto detallado para el trámite ${reqRow.request_number} por ARS ${totalArs.toLocaleString("es-AR")}.`,
          action_url: `/oficina/solicitudes/${reqRow.id}`,
          delivery_status: "queued",
        }),
      ]);

      await logAction("don_contador.create_quote", "quote", quote.id, {
        quoteNumber,
        requestId: reqRow.id,
        totalArs,
      });
      return NextResponse.json({
        ok: true,
        quote,
        message: `Presupuesto ${quoteNumber} emitido y enviado al cliente por ARS ${totalArs.toLocaleString("es-AR")}.`,
      });
    }

    if (action === "reconcile_payment") {
      const paymentId = String(body.paymentId || "").trim();
      const decision = String(body.decision || "").trim();
      if (!paymentId || !["approved", "rejected"].includes(decision)) {
        return NextResponse.json({ ok: false, message: "Parámetros de conciliación inválidos." }, { status: 400 });
      }

      const { data: payment } = await sb
        .from("dc_payments")
        .select("*")
        .eq("id", paymentId)
        .maybeSingle();

      if (!payment) {
        return NextResponse.json({ ok: false, message: "Pago no encontrado." }, { status: 404 });
      }
      if (payment.provider === "mercadopago") {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Los pagos de Mercado Pago se confirman exclusivamente por webhook verificado en el servidor.",
          },
          { status: 400 }
        );
      }

      const { error: updErr } = await sb
        .from("dc_payments")
        .update({
          status: decision,
          server_verified: decision === "approved",
          verified_by: `minisistema:@${actor}`,
          paid_at: decision === "approved" ? nowIso : null,
          updated_at: nowIso,
        })
        .eq("id", payment.id);
      if (updErr) {
        return NextResponse.json({ ok: false, message: updErr.message }, { status: 500 });
      }

      if (decision === "approved" && payment.request_id) {
        await Promise.all([
          sb
            .from("dc_requests")
            .update({ payment_status: "pagado", updated_at: nowIso })
            .eq("id", payment.request_id),
          sb.from("dc_notifications").insert({
            user_id: payment.client_user_id,
            channel: "in_app",
            event_type: "pago_recibido",
            title: "Pago acreditado en Don Contador",
            body: `Confirmamos la acreditación de tu transferencia por ARS ${Number(payment.amount_ars).toLocaleString("es-AR")}.`,
            action_url: `/oficina/solicitudes/${payment.request_id}`,
            delivery_status: "queued",
          }),
        ]);
      }

      await logAction(`don_contador.payment_${decision}`, "payment", payment.id, { decision });
      return NextResponse.json({
        ok: true,
        message: decision === "approved" ? "Transferencia conciliada y aprobada." : "Transferencia marcada como rechazada.",
      });
    }

    if (action === "update_consultation") {
      const consultationId = String(body.consultationId || "").trim();
      if (!consultationId) {
        return NextResponse.json({ ok: false, message: "Falta consultationId." }, { status: 400 });
      }
      const patch: Record<string, unknown> = { updated_at: nowIso };
      if (body.status) {
        const st = String(body.status);
        if (!["abierta", "asignada", "presupuestada", "en_curso", "respondida", "cerrada"].includes(st)) {
          return NextResponse.json({ ok: false, message: "Estado de consulta inválido." }, { status: 400 });
        }
        patch.status = st;
      }
      if (body.billingMode) {
        const bm = String(body.billingMode);
        if (!["gratuita", "arancelada", "incluida_abono", "a_presupuestar"].includes(bm)) {
          return NextResponse.json({ ok: false, message: "Modalidad de cobro inválida." }, { status: 400 });
        }
        patch.billing_mode = bm;
      }
      if (body.assignedProfessionalId !== undefined) {
        patch.assigned_professional_id = String(body.assignedProfessionalId || "").trim() || null;
      }
      if (body.feeArs !== undefined && body.feeArs !== "") {
        const f = Number(body.feeArs);
        if (!Number.isFinite(f) || f < 0) {
          return NextResponse.json({ ok: false, message: "Arancel inválido." }, { status: 400 });
        }
        patch.fee_ars = f;
      }

      const { error: updErr } = await sb.from("dc_consultations").update(patch).eq("id", consultationId);
      if (updErr) {
        return NextResponse.json({ ok: false, message: updErr.message }, { status: 500 });
      }
      await logAction("don_contador.update_consultation", "consultation", consultationId, patch);
      return NextResponse.json({ ok: true, message: "Consulta actualizada." });
    }

    if (action === "update_appointment") {
      const appointmentId = String(body.appointmentId || "").trim();
      if (!appointmentId) {
        return NextResponse.json({ ok: false, message: "Falta appointmentId." }, { status: 400 });
      }
      const patch: Record<string, unknown> = { updated_at: nowIso };
      if (body.status) {
        const st = String(body.status);
        if (!["solicitada", "confirmada", "reprogramada", "completada", "cancelada"].includes(st)) {
          return NextResponse.json({ ok: false, message: "Estado de reunión inválido." }, { status: 400 });
        }
        patch.status = st;
      }
      if (body.professionalId !== undefined) {
        patch.professional_id = String(body.professionalId || "").trim() || null;
      }
      if (body.meetingUrl !== undefined) {
        patch.meeting_url = String(body.meetingUrl || "").trim() || null;
      }
      if (body.notes !== undefined) {
        patch.notes = String(body.notes || "").trim() || null;
      }

      const { error: updErr } = await sb.from("dc_appointments").update(patch).eq("id", appointmentId);
      if (updErr) {
        return NextResponse.json({ ok: false, message: updErr.message }, { status: 500 });
      }
      await logAction("don_contador.update_appointment", "appointment", appointmentId, patch);
      return NextResponse.json({ ok: true, message: "Reunión actualizada." });
    }

    if (action === "save_setting") {
      const key = String(body.key || "").trim();
      const value = body.value;
      if (!key || !value || typeof value !== "object") {
        return NextResponse.json({ ok: false, message: "Configuración inválida." }, { status: 400 });
      }
      const { error: upsErr } = await sb.from("dc_settings").upsert(
        {
          key,
          value,
          updated_by: actor,
          updated_at: nowIso,
        },
        { onConflict: "key" }
      );
      if (upsErr) {
        return NextResponse.json({ ok: false, message: upsErr.message }, { status: 500 });
      }
      await logAction("don_contador.save_setting", "setting", key, value);
      return NextResponse.json({ ok: true, message: `Configuración «${key}» guardada.` });
    }

    return NextResponse.json({ ok: false, message: `Acción no soportada: ${action}` }, { status: 400 });
  }

  return NextResponse.json({ ok: false, message: "Método no permitido." }, { status: 405 });
}
