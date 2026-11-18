import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/server/crypto-auth";
import {
  assertRoleManagementPermission,
  extractErpSessionFromRequest,
  getErpCookieName,
  signErpSession,
  verifyErpUserPassword,
} from "../erp-session";
import {
  getTenantDoc,
  listTenantUsersFromDb,
  putTenantDoc,
  softDeleteTenantUserInDb,
  upsertTenantUserInDb,
} from "../supabase-server";
import {
  ALL_ERP_MODULE_KEYS,
  type ErpTenantRecord,
  type ErpUserRecord,
  GENERAL_ADMIN_DEFAULT_PASS,
  GENERAL_ADMIN_USERNAME,
  normalizeErpRole,
} from "../types";

function buildPublicUserProfile(
  record: ErpUserRecord,
  tenant: ErpTenantRecord,
  loginAt?: string
) {
  const cleanRole = normalizeErpRole(record.role, record.username);
  const tenantAllowed = new Set([
    ...(Array.isArray(tenant.enabled_modules) && tenant.enabled_modules.length > 0
      ? tenant.enabled_modules
      : ALL_ERP_MODULE_KEYS),
    "perfil",
    "tema",
    "atajos",
    "manual_usuario",
  ]);

  let effectiveModules: string[];
  if (cleanRole === "Administrador General") {
    effectiveModules = [...ALL_ERP_MODULE_KEYS];
  } else if (cleanRole === "Administrador") {
    effectiveModules = Array.from(tenantAllowed);
  } else {
    const rawMods =
      Array.isArray(record.modules) && record.modules.length > 0
        ? record.modules
        : Array.from(tenantAllowed);
    effectiveModules = rawMods.filter((m) => tenantAllowed.has(m));
    if (!effectiveModules.includes("perfil")) effectiveModules.push("perfil");
    if (!effectiveModules.includes("manual_usuario")) effectiveModules.push("manual_usuario");
  }

  return {
    username: record.username,
    name: record.name,
    vendedor: record.vendedor || record.name.toUpperCase(),
    role: cleanRole,
    isGeneralAdmin: cleanRole === "Administrador General",
    active: record.active !== false,
    branch: record.branch || tenant.fantasy_name || "Casa Central",
    whatsapp: record.whatsapp || "",
    avatar: record.avatar || "",
    modules: effectiveModules,
    tenantAllowedModules: Array.from(tenantAllowed),
    tenantSlug: tenant.slug,
    cajaAbierta: record.cajaAbierta ?? null,
    cajaAbiertaAt: record.cajaAbiertaAt ?? null,
    loginAt: loginAt || new Date().toISOString(),
  };
}

async function ensureGeneralAdminPresent(
  tenant: ErpTenantRecord,
  users: ErpUserRecord[]
): Promise<ErpUserRecord[]> {
  const hasDaniel = users.some(
    (u) => u.username.toLowerCase() === GENERAL_ADMIN_USERNAME
  );
  if (hasDaniel) return users;

  const created = await upsertTenantUserInDb(tenant, {
    username: GENERAL_ADMIN_USERNAME,
    password_hash: hashPassword(GENERAL_ADMIN_DEFAULT_PASS),
    plain_compat: GENERAL_ADMIN_DEFAULT_PASS,
    name: "Daniel G.",
    vendedor: "DANIEL G.",
    role: "Administrador General",
    branch: "Casa Central",
    whatsapp: "+5493585095475",
    avatar: "",
    modules: ALL_ERP_MODULE_KEYS,
    active: true,
    actor: "system",
  });
  return [created, ...users];
}

export async function handleErpAuth(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  if (tenant.status === "suspended" || tenant.status === "cancelled") {
    // Permitir únicamente a @danielg (Administrador General) ingresar a sistemas suspendidos
    const sessCheck = extractErpSessionFromRequest(req, tenant.slug);
    if (req.method === "GET" && sessCheck?.username !== GENERAL_ADMIN_USERNAME) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Este sistema se encuentra temporalmente suspendido por administración.",
        },
        { status: 403 }
      );
    }
  }

  let users = await listTenantUsersFromDb(tenant);
  users = await ensureGeneralAdminPresent(tenant, users);
  const byKey = new Map<string, ErpUserRecord>();
  for (const u of users) {
    byKey.set(u.username.toLowerCase(), {
      ...u,
      role: normalizeErpRole(u.role, u.username),
    });
  }

  const currentSess = extractErpSessionFromRequest(req, tenant.slug);
  const actorFromHeader = (req.headers.get("x-erp-user") || "").trim().toLowerCase();
  const effectiveActorKey =
    currentSess?.username?.toLowerCase() || actorFromHeader || "";
  const effectiveActorRecord = effectiveActorKey
    ? byKey.get(effectiveActorKey) || null
    : null;

  if (req.method === "GET") {
    const action = req.nextUrl.searchParams.get("action") || "session";

    if (action === "logout") {
      if (effectiveActorRecord && effectiveActorRecord.cajaAbierta) {
        await upsertTenantUserInDb(tenant, {
          ...effectiveActorRecord,
          cajaAbierta: null,
          cajaAbiertaAt: null,
          actor: effectiveActorRecord.username,
        });
      }
      const res = NextResponse.json({ ok: true });
      res.cookies.set(getErpCookieName(tenant.slug), "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
      return res;
    }

    if (action === "get_global_atajos") {
      const { payload: customDb } = await getTenantDoc<Record<string, unknown>>(
        tenant,
        "users_custom",
        {}
      );
      const rawAtajos =
        (customDb._global_atajos as Record<string, unknown>) || null;
      return NextResponse.json({
        ok: true,
        atajos: rawAtajos && typeof rawAtajos === "object" ? rawAtajos.map || {} : {},
        updatedBy:
          rawAtajos && typeof rawAtajos === "object"
            ? String(rawAtajos.updatedBy || "")
            : "",
        updatedAt:
          rawAtajos && typeof rawAtajos === "object"
            ? String(rawAtajos.updatedAt || "")
            : "",
      });
    }

    if (action === "list_users") {
      const actorIsGeneralAdmin =
        effectiveActorRecord?.username === GENERAL_ADMIN_USERNAME ||
        currentSess?.role === "Administrador General";

      const usersMap: Record<string, unknown> = {};
      for (const [uKey, uRec] of byKey.entries()) {
        // Si quien consulta NO es @danielg (Administrador General), no exponer nunca la clave ni permitir editar a @danielg
        if (uKey === GENERAL_ADMIN_USERNAME && !actorIsGeneralAdmin) {
          continue;
        }
        const canSeePass =
          actorIsGeneralAdmin ||
          (effectiveActorRecord?.role === "Administrador" &&
            uRec.role === "Usuario");

        usersMap[uKey] = {
          username: uRec.username,
          pass: canSeePass ? uRec.plain_compat || "" : "",
          name: uRec.name,
          vendedor: uRec.vendedor,
          role: normalizeErpRole(uRec.role, uRec.username),
          active: uRec.active !== false,
          branch: uRec.branch,
          whatsapp: uRec.whatsapp || "",
          avatar: uRec.avatar || "",
          modules:
            uRec.role === "Administrador General" || uKey === GENERAL_ADMIN_USERNAME
              ? ALL_ERP_MODULE_KEYS
              : Array.from(
                  new Set([
                    ...(uRec.modules || tenant.enabled_modules || ALL_ERP_MODULE_KEYS),
                    "perfil",
                    "tema",
                    "atajos",
                    "manual_usuario",
                  ])
                ),
          cajaAbierta: uRec.cajaAbierta ?? null,
          cajaAbiertaAt: uRec.cajaAbiertaAt ?? null,
        };
      }
      return NextResponse.json({ ok: true, users: usersMap });
    }

    if (currentSess) {
      const found = byKey.get(currentSess.username.toLowerCase());
      if (found && (found.active !== false || found.username === GENERAL_ADMIN_USERNAME)) {
        return NextResponse.json({
          ok: true,
          user: buildPublicUserProfile(found, tenant, currentSess.loginAt),
        });
      }
    }

    return NextResponse.json(
      { ok: false, message: "Sin sesión activa" },
      { status: 401 }
    );
  }

  if (req.method === "POST") {
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    let payload: Record<string, unknown> = {};
    let isNativeForm = false;

    if (contentType.includes("application/json")) {
      payload = ((await req.json().catch(() => ({}))) || {}) as Record<
        string,
        unknown
      >;
    } else {
      isNativeForm = true;
      const fd = await req.formData().catch(() => null);
      if (fd) {
        fd.forEach((v, k) => {
          payload[k] = typeof v === "string" ? v : "";
        });
      }
    }

    const action = String(payload.action || "login").trim();

    if (action === "save_global_atajos") {
      const incoming = payload.atajos;
      if (!incoming || typeof incoming !== "object") {
        return NextResponse.json(
          { ok: false, message: "Mapa de atajos inválido." },
          { status: 400 }
        );
      }
      const cleanMap: Record<string, string> = {};
      for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
        const cleanK = String(k).trim().toLowerCase();
        const cleanV = String(v ?? "").trim();
        if (cleanK && cleanV) cleanMap[cleanK] = cleanV;
      }
      const { payload: customDb } = await getTenantDoc<Record<string, unknown>>(
        tenant,
        "users_custom",
        {}
      );
      const updatedBy = String(
        payload.username || currentSess?.username || "federicod"
      )
        .trim()
        .toLowerCase();
      customDb._global_atajos = {
        map: cleanMap,
        updatedBy,
        updatedAt: new Date().toISOString(),
      };
      await putTenantDoc(
        tenant,
        "users_custom",
        customDb,
        updatedBy,
        "save_global_atajos"
      );
      return NextResponse.json({ ok: true, atajos: cleanMap, updatedBy });
    }

    if (action === "update_profile") {
      const username = String(
        payload.username || currentSess?.username || ""
      )
        .trim()
        .toLowerCase();
      const rec = byKey.get(username);
      if (!rec) {
        return NextResponse.json(
          { ok: false, message: "Usuario inválido." },
          { status: 400 }
        );
      }
      const name = String(payload.name ?? rec.name).trim();
      if (!name) {
        return NextResponse.json(
          { ok: false, message: "El Nombre y Apellido es obligatorio." },
          { status: 400 }
        );
      }
      const updated = await upsertTenantUserInDb(tenant, {
        username: rec.username,
        password_hash: rec.password_hash || "",
        plain_compat: rec.plain_compat || "",
        name,
        vendedor: name.toUpperCase(),
        role: normalizeErpRole(rec.role, rec.username),
        branch: String(payload.branch ?? rec.branch).trim() || "Casa Central",
        whatsapp: String(payload.whatsapp ?? rec.whatsapp ?? "").trim(),
        avatar:
          "avatar" in payload
            ? String(payload.avatar || "").trim()
            : rec.avatar || "",
        modules: rec.modules,
        active: rec.active !== false,
        cajaAbierta: rec.cajaAbierta,
        cajaAbiertaAt: rec.cajaAbiertaAt,
        actor: username,
      });

      return NextResponse.json({
        ok: true,
        message: "Datos de perfil actualizados correctamente.",
        user: buildPublicUserProfile(updated, tenant, currentSess?.loginAt),
      });
    }

    if (action === "admin_save_user") {
      const actorRec =
        effectiveActorRecord ||
        (String(payload.actorUsername || "").toLowerCase()
          ? byKey.get(String(payload.actorUsername || "").toLowerCase()) || null
          : null);

      if (!actorRec) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Sesión expirada o sin permisos para gestionar usuarios. Volvé a iniciar sesión.",
          },
          { status: 401 }
        );
      }

      const prevUser = String(payload.previousUsername || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "");
      const targetUser = String(payload.targetUsername || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "");

      if (!targetUser || targetUser.length < 3) {
        return NextResponse.json(
          { ok: false, message: "Nombre de usuario (@login) no válido." },
          { status: 400 }
        );
      }

      const existingTarget = byKey.get(prevUser || targetUser) || byKey.get(targetUser) || null;
      const requestedRole = normalizeErpRole(
        payload.role ?? existingTarget?.role ?? "Usuario",
        targetUser
      );

      const perm = assertRoleManagementPermission({
        actorUsername: actorRec.username,
        actorRole: normalizeErpRole(actorRec.role, actorRec.username),
        targetUsername: targetUser,
        targetCurrentRole: existingTarget
          ? normalizeErpRole(existingTarget.role, existingTarget.username)
          : null,
        targetNextRole: requestedRole,
      });

      if (!perm.allowed) {
        return NextResponse.json(
          { ok: false, message: perm.reason || "Operación no autorizada por jerarquía de roles." },
          { status: 403 }
        );
      }

      const name = String(payload.name ?? existingTarget?.name ?? targetUser).trim();
      const newPass = String(payload.pass ?? "").trim();
      if (!existingTarget && newPass.length < 4) {
        return NextResponse.json(
          {
            ok: false,
            message: "Ingresá una contraseña inicial de al menos 4 caracteres.",
          },
          { status: 400 }
        );
      }

      const tenantAllowed = new Set([
        ...(tenant.enabled_modules || ALL_ERP_MODULE_KEYS),
        "perfil",
        "tema",
        "atajos",
        "manual_usuario",
      ]);

      const rawModules = Array.isArray(payload.modules)
        ? payload.modules.map((m) => String(m))
        : existingTarget?.modules || Array.from(tenantAllowed);

      const finalModules =
        targetUser === GENERAL_ADMIN_USERNAME
          ? ALL_ERP_MODULE_KEYS
          : Array.from(
              new Set([
                ...rawModules.filter((m) => tenantAllowed.has(m)),
                "perfil",
                "manual_usuario",
              ])
            );

      const nextActive =
        targetUser === GENERAL_ADMIN_USERNAME
          ? true
          : payload.active !== undefined
            ? Boolean(payload.active)
            : existingTarget?.active !== false;

      const saved = await upsertTenantUserInDb(tenant, {
        previousUsername: prevUser,
        username: targetUser,
        password_hash:
          newPass.length >= 4
            ? hashPassword(newPass)
            : existingTarget?.password_hash || "",
        plain_compat:
          newPass.length >= 4 ? newPass : existingTarget?.plain_compat || "",
        name,
        vendedor: name.toUpperCase(),
        role: requestedRole,
        branch:
          String(payload.branch ?? existingTarget?.branch ?? "").trim() ||
          tenant.fantasy_name ||
          "Casa Central",
        whatsapp: String(payload.whatsapp ?? existingTarget?.whatsapp ?? "").trim(),
        avatar:
          "avatar" in payload
            ? String(payload.avatar || "").trim()
            : existingTarget?.avatar || "",
        modules: finalModules,
        active: nextActive,
        cajaAbierta: existingTarget?.cajaAbierta ?? null,
        cajaAbiertaAt: existingTarget?.cajaAbiertaAt ?? null,
        actor: actorRec.username,
      });

      return NextResponse.json({
        ok: true,
        message: `Usuario @${saved.username} (${saved.role}) guardado por @${actorRec.username}.`,
        user: {
          username: saved.username,
          pass: saved.plain_compat || "",
          name: saved.name,
          vendedor: saved.vendedor,
          role: normalizeErpRole(saved.role, saved.username),
          active: saved.active !== false,
          branch: saved.branch,
          whatsapp: saved.whatsapp || "",
          avatar: saved.avatar || "",
          modules: saved.modules || finalModules,
          cajaAbierta: saved.cajaAbierta ?? null,
          cajaAbiertaAt: saved.cajaAbiertaAt ?? null,
        },
      });
    }

    if (action === "toggle_user_active" || action === "delete_user") {
      const actorRec = effectiveActorRecord;
      if (!actorRec) {
        return NextResponse.json(
          { ok: false, message: "Sin sesión activa." },
          { status: 401 }
        );
      }
      const targetUser = String(payload.targetUsername || payload.username || "")
        .trim()
        .toLowerCase();
      const targetRec = byKey.get(targetUser);
      if (!targetRec) {
        return NextResponse.json(
          { ok: false, message: "Usuario no encontrado." },
          { status: 404 }
        );
      }
      const targetRole = normalizeErpRole(targetRec.role, targetRec.username);
      const perm = assertRoleManagementPermission({
        actorUsername: actorRec.username,
        actorRole: normalizeErpRole(actorRec.role, actorRec.username),
        targetUsername: targetUser,
        targetCurrentRole: targetRole,
        targetNextRole: targetRole,
      });
      if (!perm.allowed) {
        return NextResponse.json(
          { ok: false, message: perm.reason || "No autorizado." },
          { status: 403 }
        );
      }

      if (action === "delete_user") {
        await softDeleteTenantUserInDb(tenant, targetUser);
        return NextResponse.json({
          ok: true,
          message: `Usuario @${targetUser} dado de baja.`,
        });
      }

      const nextActive = Boolean(payload.active);
      await upsertTenantUserInDb(tenant, {
        ...targetRec,
        active: nextActive,
        actor: actorRec.username,
      });
      return NextResponse.json({
        ok: true,
        active: nextActive,
        message: nextActive
          ? `Usuario @${targetUser} habilitado.`
          : `Usuario @${targetUser} deshabilitado.`,
      });
    }

    if (action === "restore_session") {
      const username = String(payload.username || "").trim().toLowerCase();
      const rec = byKey.get(username);
      if (!rec || (rec.active === false && username !== GENERAL_ADMIN_USERNAME)) {
        return NextResponse.json(
          { ok: false, message: "Usuario inválido o deshabilitado." },
          { status: 401 }
        );
      }
      // Si había cookie válida, refrescar; si no, requerir login salvo sesión activa
      if (!currentSess || currentSess.username.toLowerCase() !== username) {
        return NextResponse.json(
          { ok: false, message: "Sesión expirada. Ingresá nuevamente." },
          { status: 401 }
        );
      }
      const profile = buildPublicUserProfile(
        rec,
        tenant,
        String(payload.loginAt || currentSess.loginAt || new Date().toISOString())
      );
      return NextResponse.json({ ok: true, user: profile });
    }

    if (action === "set_active_caja") {
      const username = String(
        payload.username || currentSess?.username || ""
      )
        .trim()
        .toLowerCase();
      const rec = byKey.get(username);
      if (!rec) {
        return NextResponse.json(
          { ok: false, message: "Usuario inválido." },
          { status: 400 }
        );
      }
      const cajaId =
        payload.cajaId && String(payload.cajaId).trim() !== ""
          ? String(payload.cajaId).trim()
          : null;
      await upsertTenantUserInDb(tenant, {
        ...rec,
        whatsapp: payload.whatsapp
          ? String(payload.whatsapp).trim()
          : rec.whatsapp,
        cajaAbierta: cajaId,
        cajaAbiertaAt: cajaId ? new Date().toISOString() : null,
        actor: username,
      });
      return NextResponse.json({ ok: true, username, cajaAbierta: cajaId });
    }

    if (action === "change_password") {
      const username = String(
        payload.username || currentSess?.username || ""
      )
        .trim()
        .toLowerCase();
      const rec = byKey.get(username);
      const currentPassword = String(payload.currentPassword || "");
      const newPassword = String(payload.newPassword || "");
      if (!rec) {
        return NextResponse.json(
          { ok: false, message: "Usuario inválido." },
          { status: 400 }
        );
      }
      if (!verifyErpUserPassword(currentPassword, rec)) {
        return NextResponse.json(
          { ok: false, message: "La contraseña actual ingresada es incorrecta." },
          { status: 401 }
        );
      }
      if (newPassword.length < 4) {
        return NextResponse.json(
          {
            ok: false,
            message: "La nueva contraseña debe tener al menos 4 caracteres.",
          },
          { status: 400 }
        );
      }
      await upsertTenantUserInDb(tenant, {
        ...rec,
        password_hash: hashPassword(newPassword),
        plain_compat: newPassword,
        actor: username,
      });
      return NextResponse.json({
        ok: true,
        message: "Contraseña actualizada correctamente.",
      });
    }

    // Default POST action: LOGIN
    const username = String(payload.username || "").trim().toLowerCase();
    const password = String(payload.password || "");

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, message: "Por favor ingresá tu usuario y contraseña." },
        { status: 400 }
      );
    }

    const rec = byKey.get(username);
    if (!rec || !verifyErpUserPassword(password, rec)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Usuario o contraseña incorrectos. Verificá las mayúsculas y números.",
        },
        { status: 401 }
      );
    }

    if (rec.active === false && username !== GENERAL_ADMIN_USERNAME) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Tu usuario aún no está habilitado o fue suspendido. Consultá con el Administrador.",
        },
        { status: 403 }
      );
    }

    if (
      (tenant.status === "suspended" || tenant.status === "cancelled") &&
      username !== GENERAL_ADMIN_USERNAME
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El sistema de este comercio se encuentra suspendido. Contactate con MiniSistema.",
        },
        { status: 403 }
      );
    }

    const loginAt = new Date().toISOString();
    const profile = buildPublicUserProfile(rec, tenant, loginAt);
    const sessionToken = signErpSession({
      tenantSlug: tenant.slug,
      username: rec.username,
      role: profile.role,
      loginAt,
    });

    if (isNativeForm) {
      const storageKey = `ms_${tenant.slug}_erp_active_admin_v1`;
      const html = `<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=../"><title>Ingresando a ${tenant.fantasy_name}...</title></head><body><script>try{var _u=JSON.stringify(${JSON.stringify(profile)});sessionStorage.setItem(${JSON.stringify(storageKey)},_u);localStorage.setItem(${JSON.stringify(storageKey)},_u);}catch(e){}window.location.replace("../");</script></body></html>`;
      const htmlRes = new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
      htmlRes.cookies.set(getErpCookieName(tenant.slug), sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return htmlRes;
    }

    const res = NextResponse.json({
      ok: true,
      user: profile,
    });
    res.cookies.set(getErpCookieName(tenant.slug), sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  return NextResponse.json(
    { ok: false, message: "Método no permitido" },
    { status: 405 }
  );
}
