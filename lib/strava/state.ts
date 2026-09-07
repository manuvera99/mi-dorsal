// =============================================================================
// mi-dorsal — State firmado para OAuth de Strava
// =============================================================================
// El parámetro `state` en OAuth previene CSRF. Lo generamos al iniciar el
// flow y lo validamos en el callback.
//
// Formato: <base64url(payload)>.<base64url(hmac)>
// Payload: { userId, nonce, issuedAt } JSON
// HMAC: HMAC-SHA256(payload, OAUTH_STATE_SECRET)
//
// La secret se deriva de STRAVA_TOKEN_KEY si no hay una dedicada, para no
// añadir una env var más.
// =============================================================================

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 min

interface StatePayload {
  userId: string;
  nonce: string;
  issuedAt: number;
}

function getSecret(): string {
  return (
    process.env.STRAVA_OAUTH_STATE_SECRET ||
    process.env.STRAVA_TOKEN_KEY ||
    "mi-dorsal-dev-only-do-not-use-in-prod"
  );
}

function b64urlEncode(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "utf8");
  return b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  return Buffer.from(padded + "=".repeat(pad ? 4 - pad : 0), "base64");
}

function sign(payload: string): string {
  return b64urlEncode(createHmac("sha256", getSecret()).update(payload).digest());
}

/** Genera un state firmado para un usuario. */
export function generateState(userId: string): string {
  const payload: StatePayload = {
    userId,
    nonce: randomBytes(16).toString("hex"),
    issuedAt: Date.now(),
  };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

/**
 * Valida y decodifica un state. Devuelve el userId si es válido, o lanza
 * error si está manipulado o expirado.
 */
export function validateState(state: string): string {
  const parts = state.split(".");
  if (parts.length !== 2) {
    throw new Error("State con formato inválido");
  }
  const [payloadB64, sig] = parts;

  const expectedSig = sign(payloadB64);
  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error("Firma del state inválida");
  }

  const payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8")) as StatePayload;
  if (Date.now() - payload.issuedAt > STATE_TTL_MS) {
    throw new Error("State expirado (más de 10 minutos)");
  }

  return payload.userId;
}
