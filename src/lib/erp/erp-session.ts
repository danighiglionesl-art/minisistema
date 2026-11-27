import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { verifyPassword } from "@/lib/server/crypto-auth";
import {
  type ErpUserRecord,
  type ErpUserRole,
  GENERAL_ADMIN_USERNAME,
  normalizeErpRole,
} from "./types";

const ERP_SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 días

function getErpAuthSecret(): string {
  return (
    process.env.ADMIN_AUTH_SECRET ||
    "minisistema_erp_hmac_secret_2026_production"
  );
}

export interface ErpSessionTokenPayload {
  tenantSlug: string;
  username: string;
  role: ErpUserRole;
  loginAt: string;
  sid?: string;
  exp: number;
}

export function getErpCookieName(tenantSlug: string): string {
  const safe = tenantSlug.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  return `ms_erp_sid_${safe}`;
}

export function signErpSession(payload: Omit<ErpSessionTokenPayload, "exp">): string {
  const full: ErpSessionTokenPayload = {
    ...payload,
    exp: Date.now() + ERP_SESSION_DURATION_MS,
  };
  const data = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getErpAuthSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

export function verifyErpSession(
  token: string | undefined | null,
  expectedTenantSlug?: string
): ErpSessionTokenPayload | null {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", getErpAuthSecret())
    .update(data)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as ErpSessionTokenPayload;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    if (
      expectedTenantSlug &&
      parsed.tenantSlug !== expectedTenantSlug &&
      parsed.username !== GENERAL_ADMIN_USERNAME
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function extractErpSessionFromRequest(
  req: NextRequest,
  tenantSlug: string
): ErpSessionTokenPayload | null {
  const cookieName = getErpCookieName(tenantSlug);
  const token =
    req.cookies.get(cookieName)?.value ||
    req.cookies.get(getErpCookieName("minisistema"))?.value ||
    req.headers.get("x-erp-session-token");

  return verifyErpSession(token, tenantSlug);
}

export function verifyErpUserPassword(
  candidatePassword: string,
  user: Pick<ErpUserRecord, "password_hash" | "plain_compat">
): boolean {
  if (!candidatePassword) return false;
  if (user.password_hash && user.password_hash.startsWith("scrypt:")) {
    if (verifyPassword(candidatePassword, user.password_hash)) {
      return true;
    }
  }
  if (user.plain_compat) {
    const a = Buffer.from(candidatePassword, "utf8");
    const b = Buffer.from(user.plain_compat, "utf8");
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }
  return false;
}

/**
 * Reglas estrictas de jerarquía de 3 niveles pedidas por Daniel:
 * 1. Administrador General (@danielg) -> está por encima de Administrador y Usuarios;
 *    habilita/crea/edita/deshabilita tanto a Administradores como a Usuarios.
 * 2. Administrador -> habilitado por el Administrador General;
 *    SOLO puede habilitar/crear/editar/deshabilitar a Usuarios (jamás a otro Administrador ni al Administrador General).
 * 3. Usuario -> habilitado por Administrador General o Administrador; no administra cuentas de terceros.
 */
export function assertRoleManagementPermission(params: {
  actorUsername: string;
  actorRole: ErpUserRole;
  targetUsername: string;
  targetCurrentRole?: ErpUserRole | null;
  targetNextRole: ErpUserRole;
}): { allowed: boolean; reason?: string } {
  const actorUser = params.actorUsername.trim().toLowerCase();
  const targetUser = params.targetUsername.trim().toLowerCase();
  const actorRole = normalizeErpRole(params.actorRole, actorUser);

  if (actorRole === "Usuario") {
    return {
      allowed: false,
      reason: "Los usuarios con rol Usuario no tienen permisos para administrar cuentas.",
    };
  }

  // @danielg es el Administrador General supremo e inamovible
  if (targetUser === GENERAL_ADMIN_USERNAME) {
    if (actorUser !== GENERAL_ADMIN_USERNAME) {
      return {
        allowed: false,
        reason: "Solo el Administrador General (@danielg) puede modificar su propio perfil.",
      };
    }
    return { allowed: true };
  }

  if (actorRole === "Administrador General") {
    // El Administrador General habilita a Administradores y Usuarios (no crea otros Administradores Generales)
    if (params.targetNextRole === "Administrador General") {
      return {
        allowed: false,
        reason: "El rol Administrador General es exclusivo de @danielg.",
      };
    }
    return { allowed: true };
  }

  // Caso actorRole === "Administrador"
  if (
    params.targetCurrentRole === "Administrador" ||
    params.targetCurrentRole === "Administrador General"
  ) {
    if (actorUser === targetUser && params.targetNextRole === "Administrador") {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason:
        "El Administrador solo puede gestionar cuentas de Usuarios. La habilitación y edición de Administradores es exclusiva del Administrador General (@danielg).",
    };
  }

  if (params.targetNextRole !== "Usuario") {
    return {
      allowed: false,
      reason:
        "Solo el Administrador General (@danielg) puede habilitar o asignar el rol de Administrador.",
    };
  }

  return { allowed: true };
}
