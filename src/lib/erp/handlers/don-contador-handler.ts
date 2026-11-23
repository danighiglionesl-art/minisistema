import { NextRequest, NextResponse } from "next/server";
import { extractErpSessionFromRequest } from "../erp-session";
import { getPlatformSupabase } from "../supabase-server";
import {
  type ErpTenantRecord,
  GENERAL_ADMIN_USERNAME,
  normalizeErpRole,
} from "../types";

type AnyObj = Record<string, unknown>;

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
        .select("id, email, full_name, phone, status, email_verified_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      sb
        .from("dc_organizations")
        .select("id, legal_name, cuit, entity_type, activity, status, created_at")
        .order("created_at", { ascending: false })
        .limit(150),
      sb
        .from("dc_organization_members")
        .select("id, organization_id, user_id, role_in_org, can_request_acts, authorization_status, created_at")
        .order("created_at", { ascending: false })
        .limit(150),
      sb
        .from("dc_professionals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      sb.from("dc_professional_licenses").select("*").limit(200),
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
        .select("id, request_id, title, original_filename, is_legalized, legalization_council, external_reference, issued_at, download_count")
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

    const users = usersRes.data || [];
    const requests = requestsRes.data || [];
    const quotes = quotesRes.data || [];
    const payments = paymentsRes.data || [];
    const pros = prosRes.data || [];

    const observedCount = requests.filter(
      (r) =>
        r.status === "pendiente_documentacion_adicional" ||
        r.status === "observada_consejo"
    ).length;

    const kpis = {
      clientsRegistered: users.length,
      organizationsRegistered: (orgsRes.data || []).length,
      professionalsActive: pros.filter((p) => p.active).length,
      servicesCatalogCount: (servicesRes.data || []).length,
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
      organizationMembers: orgMembersRes.data || [],
      professionals: pros,
      licenses: licensesRes.data || [],
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

    // Segregación estricta de roles (Sección 17 y 26): un administrador nunca aprueba técnicamente
    if (
      action === "approve_technical_act" ||
      action === "sign_certification" ||
      action === "issue_deliverable"
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
      afterState: unknown
    ) => {
      await sb.from("dc_audit_logs").insert({
        actor_type: "admin_general",
        actor_id: actor,
        action: actionName,
        entity_type: entityType,
        entity_id: entityId,
        after_state: afterState ?? null,
      });
    };

    if (action === "assign_professional") {
      const requestId = String(body.requestId || "");
      const professionalId = String(body.professionalId || "");
      if (!requestId || !professionalId) {
        return NextResponse.json({ ok: false, message: "Faltan datos de asignación." }, { status: 400 });
      }
      await Promise.all([
        sb
          .from("dc_requests")
          .update({
            assigned_professional_id: professionalId,
            status: "asignada_profesional",
            professional_status: "asignada",
            updated_at: nowIso,
          })
          .eq("id", requestId),
        sb.from("dc_professional_assignments").insert({
          request_id: requestId,
          professional_id: professionalId,
          assigned_by: actor,
          role_in_request: "responsable",
          status: "active",
        }),
      ]);
      await logAction("don_contador.assign_professional", "request", requestId, { professionalId });
      return NextResponse.json({ ok: true, message: "Profesional asignado al expediente." });
    }

    if (action === "update_service_status") {
      const serviceId = String(body.serviceId || "");
      const commercialStatus = String(body.commercialStatus || "");
      const validityStatus = String(body.validityStatus || "");
      if (!serviceId) {
        return NextResponse.json({ ok: false, message: "Falta serviceId." }, { status: 400 });
      }
      const patch: Record<string, unknown> = { updated_at: nowIso };
      if (commercialStatus) patch.commercial_status = commercialStatus;
      if (validityStatus) patch.validity_status = validityStatus;
      if (body.baseFeeArs !== undefined) patch.base_fee_ars = Number(body.baseFeeArs);
      await sb.from("dc_services").update(patch).eq("id", serviceId);
      await logAction("don_contador.update_service", "service", serviceId, patch);
      return NextResponse.json({ ok: true, message: "Servicio del catálogo actualizado." });
    }

    if (action === "verify_license") {
      const licenseId = String(body.licenseId || "");
      const habilitationStatus = String(body.habilitationStatus || "habilitada");
      if (!licenseId) {
        return NextResponse.json({ ok: false, message: "Falta licenseId." }, { status: 400 });
      }
      await sb
        .from("dc_professional_licenses")
        .update({
          habilitation_status: habilitationStatus,
          verified_by: actor,
          verified_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", licenseId);
      await logAction("don_contador.verify_license", "license", licenseId, { habilitationStatus });
      return NextResponse.json({ ok: true, message: `Matrícula actualizada a ${habilitationStatus}.` });
    }

    if (action === "approve_org_membership") {
      const membershipId = String(body.membershipId || "");
      const status = String(body.status || "approved");
      if (!membershipId) {
        return NextResponse.json({ ok: false, message: "Falta membershipId." }, { status: 400 });
      }
      await sb
        .from("dc_organization_members")
        .update({
          authorization_status: status,
          can_request_acts: status === "approved",
          verified_by: actor,
          verified_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", membershipId);
      await logAction("don_contador.approve_org_member", "organization_member", membershipId, { status });
      return NextResponse.json({ ok: true, message: `Representación societaria actualizada a ${status}.` });
    }

    if (action === "save_setting") {
      const key = String(body.key || "").trim();
      const value = body.value;
      if (!key || !value || typeof value !== "object") {
        return NextResponse.json({ ok: false, message: "Configuración inválida." }, { status: 400 });
      }
      await sb.from("dc_settings").upsert({
        key,
        value,
        updated_by: actor,
        updated_at: nowIso,
      });
      await logAction("don_contador.save_setting", "setting", key, value);
      return NextResponse.json({ ok: true, message: `Configuración «${key}» guardada.` });
    }

    return NextResponse.json({ ok: false, message: `Acción no soportada: ${action}` }, { status: 400 });
  }

  return NextResponse.json({ ok: false, message: "Método no permitido." }, { status: 405 });
}
