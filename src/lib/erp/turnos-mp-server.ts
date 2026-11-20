import crypto from "crypto";
import { getPlatformSecretsMap } from "./tenant-service";

// ============================================================================
// MINISISTEMA TURNERO WEB — SEGURIDAD Y SPLIT 1:1 MERCADO PAGO (BACKEND)
// ============================================================================

export interface EncryptedMpTokenBundle {
  encryptedTokenPayload: string;
  ivHex: string;
  authTagHex: string;
  expiresAt: string;
  updatedAt: string;
}

function getVaultKey(): Buffer {
  const secret =
    process.env.MP_TOKEN_ENCRYPTION_KEY ||
    process.env.MP_CLIENT_SECRET ||
    process.env.ERP_SESSION_SECRET ||
    "minisistema-turnero-mp-oauth-aes256-vault-2026";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptProfesionalMpTokens(
  accessToken: string,
  refreshToken: string,
  expiresInSeconds = 15552000
): EncryptedMpTokenBundle {
  const key = getVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plain = JSON.stringify({ accessToken, refreshToken });
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const nowIso = new Date().toISOString();
  return {
    encryptedTokenPayload: encrypted.toString("hex"),
    ivHex: iv.toString("hex"),
    authTagHex: authTag.toString("hex"),
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    updatedAt: nowIso,
  };
}

export function decryptProfesionalMpTokens(bundle: {
  encryptedTokenPayload?: string | null;
  ivHex?: string | null;
  authTagHex?: string | null;
}): { accessToken: string; refreshToken: string } | null {
  if (!bundle?.encryptedTokenPayload || !bundle?.ivHex || !bundle?.authTagHex) {
    return null;
  }
  try {
    const key = getVaultKey();
    const iv = Buffer.from(bundle.ivHex, "hex");
    const authTag = Buffer.from(bundle.authTagHex, "hex");
    const enc = Buffer.from(bundle.encryptedTokenPayload, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(decrypted) as {
      accessToken: string;
      refreshToken: string;
    };
    if (!parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getMpMarketplaceConfig(): Promise<{
  clientId: string;
  clientSecret: string;
  platformAccessToken: string;
  webhookSecret: string;
  configured: boolean;
}> {
  const secrets = await getPlatformSecretsMap();
  const clientId = (process.env.MP_CLIENT_ID || "").trim();
  const clientSecret = (process.env.MP_CLIENT_SECRET || "").trim();
  const platformAccessToken = (
    process.env.MP_MARKETPLACE_ACCESS_TOKEN ||
    secrets.mp_access_token ||
    ""
  ).trim();
  const webhookSecret = (
    process.env.MP_WEBHOOK_SECRET ||
    secrets.mp_webhook_secret ||
    ""
  ).trim();

  return {
    clientId,
    clientSecret,
    platformAccessToken,
    webhookSecret,
    configured: Boolean(clientId && clientSecret && platformAccessToken),
  };
}

export function verifyMpWebhookHmac(params: {
  webhookSecret: string;
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
}): { valid: boolean; mode: "verified_hmac" | "sandbox_unconfigured" } {
  if (!params.webhookSecret) {
    return { valid: true, mode: "sandbox_unconfigured" };
  }
  if (!params.xSignature) {
    return { valid: false, mode: "verified_hmac" };
  }
  let ts = "";
  let v1 = "";
  for (const part of params.xSignature.split(",")) {
    const [k, v] = part.trim().split("=");
    if (k === "ts") ts = v || "";
    if (k === "v1") v1 = v || "";
  }
  if (!ts || !v1) {
    return { valid: false, mode: "verified_hmac" };
  }
  const manifest = `id:${params.dataId};request-id:${params.xRequestId || ""};ts:${ts};`;
  const expected = crypto
    .createHmac("sha256", params.webhookSecret)
    .update(manifest)
    .digest("hex");

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(v1, "utf8");
    if (a.length !== b.length) return { valid: false, mode: "verified_hmac" };
    return { valid: crypto.timingSafeEqual(a, b), mode: "verified_hmac" };
  } catch {
    return { valid: false, mode: "verified_hmac" };
  }
}
