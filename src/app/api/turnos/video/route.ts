import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { loadTurnosDb, TURNOS_DOC_KEY } from "@/lib/erp/handlers/turnos-handler";
import { putTenantDoc } from "@/lib/erp/supabase-server";
import {
  getTenantBySlug,
  resolveActiveTenantFromRequest,
} from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

/**
 * Crea o recupera la sala privada 1:1 de videollamada para un Turno Web
 * (Profesional ↔ Paciente).
 * - Si DAILY_API_KEY está configurada en Vercel, crea la sala privada en api.daily.co
 *   y emite un meeting-token diferenciado (is_owner=true para Profesional, false para Paciente).
 * - Si DAILY_API_KEY aún no está configurada, opera en Entorno WebRTC Embebido (Sandbox en vivo)
 *   sin costo para probar cámara, micrófono, chat clínico y cronómetro al instante.
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

    const turnoCodigo = String(body?.turnoCodigo || body?.sessionId || `TRN-${Date.now()}`).trim();
    const roomCode = String(body?.roomCode || turnoCodigo).trim();
    const safeRoomSlug = `ms-turnos-${tenant.slug}-${roomCode}`
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .toLowerCase()
      .slice(0, 48);

    const participantName = String(body?.participantName || "Participante").trim();
    const participantRole: "Profesional" | "Paciente" =
      body?.participantRole === "Profesional" ? "Profesional" : "Paciente";
    const isOwner = participantRole === "Profesional";
    const durationMinutes = Math.max(5, Math.min(120, Number(body?.durationMinutes) || 30));

    const nowSec = Math.floor(Date.now() / 1000);
    // Margen extra de 20 minutos para pre-ingreso y cierre de consulta
    const expSec = nowSec + (durationMinutes + 20) * 60;
    const createdAtIso = new Date(nowSec * 1000).toISOString();
    const expiresAtIso = new Date(expSec * 1000).toISOString();

    const dailyApiKey = (process.env.DAILY_API_KEY || "").trim();

    let providerMode: "daily_api" | "daily_sandbox" = "daily_sandbox";
    let roomName = safeRoomSlug;
    let roomUrl = "";

    if (dailyApiKey) {
      const getRoomRes = await fetch(`https://api.daily.co/v1/rooms/${safeRoomSlug}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${dailyApiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (getRoomRes.ok) {
        const existing = await getRoomRes.json();
        roomUrl = String(existing.url || "");
        roomName = String(existing.name || safeRoomSlug);
      } else {
        const createRes = await fetch("https://api.daily.co/v1/rooms", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${dailyApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: safeRoomSlug,
            privacy: "private",
            properties: {
              exp: expSec,
              max_participants: 2,
              enable_chat: true,
              enable_screenshare: true,
              enable_prejoin_ui: false,
              lang: "es",
            },
          }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          roomUrl = String(created.url || "");
          roomName = String(created.name || safeRoomSlug);
        }
      }

      if (roomUrl) {
        providerMode = "daily_api";
        const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${dailyApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            properties: {
              room_name: roomName,
              user_name: `${participantName} (${participantRole})`,
              is_owner: isOwner,
              enable_screenshare: true,
              exp: expSec,
            },
          }),
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData?.token) {
            roomUrl = `${roomUrl}?t=${tokenData.token}`;
          }
        }
      }
    }

    if (!roomUrl) {
      const secret =
        process.env.ERP_SESSION_SECRET || "minisistema-turnos-video-secret-2026";
      const sig = crypto
        .createHmac("sha256", secret)
        .update(`${safeRoomSlug}:${participantName}:${participantRole}:${expSec}`)
        .digest("hex")
        .slice(0, 24);
      const dailyDomain = (
        process.env.NEXT_PUBLIC_DAILY_DOMAIN || "minisistema.daily.co"
      ).replace(/^https?:\/\//, "");
      roomUrl = `https://${dailyDomain}/${safeRoomSlug}?t=${sig}`;
      providerMode = "daily_sandbox";
    }

    // Marcar sala como activa en turnos_db si coincide con un turno
    if (body?.turnoId || body?.turnoCodigo) {
      try {
        const db = await loadTurnosDb(tenant);
        const found = db.turnos.find(
          (t) =>
            t.id === String(body.turnoId || "") ||
            t.codigo.toUpperCase() === turnoCodigo.toUpperCase()
        );
        if (found) {
          found.video = {
            habilitada: true,
            roomCode: found.video?.roomCode || roomCode,
            roomName,
            roomUrl,
            providerMode,
            status: body.markCompleted ? "finalizada" : "activa",
            startedAt: found.video?.startedAt || createdAtIso,
            completedAt: body.markCompleted ? new Date().toISOString() : found.video?.completedAt || null,
          };
          if (body.markCompleted && found.estado !== "cancelado") {
            found.estado = "atendido";
          } else if (found.estado === "confirmado" || found.estado === "pendiente") {
            found.estado = "en_sala";
          }
          found.updatedAt = new Date().toISOString();
          db.updatedAt = found.updatedAt;
          await putTenantDoc(
            tenant,
            TURNOS_DOC_KEY,
            db,
            participantRole.toLowerCase(),
            body.markCompleted ? "finish_video_turno" : "start_video_turno"
          );
        }
      } catch {
        // No bloquear inicio de sala si falla actualización secundaria
      }
    }

    return NextResponse.json({
      ok: true,
      providerMode,
      roomName,
      roomUrl,
      roomCode,
      durationMinutes,
      participantRole,
      isOwner,
      createdAt: createdAtIso,
      expiresAt: expiresAtIso,
    });
  } catch (err) {
    console.error("[Turnos Video API Error]", err);
    return NextResponse.json(
      { ok: false, message: "No se pudo inicializar la sala de videollamada." },
      { status: 500 }
    );
  }
}
