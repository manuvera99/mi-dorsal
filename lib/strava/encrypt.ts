// =============================================================================
// mi-dorsal — Cifrado AES-256-GCM para tokens de Strava
// =============================================================================
// Los tokens de acceso de Strava son credenciales. RGPD: deben estar cifrados
// en reposo. Usamos AES-256-GCM con una clave de 32 bytes derivada de la env
// var STRAVA_TOKEN_KEY.
//
// Formato del ciphertext (base64): <iv 12 bytes>:<auth tag 16 bytes>:<datos>
//
// Si STRAVA_TOKEN_KEY no está definida (dev local), los tokens se guardan
// en claro con un warning en logs. Esto es INTENCIONAL: en producción la
// variable DEBE estar definida. El check se hace en runtime.
// =============================================================================

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

let cachedKey: Buffer | null = null;
let keyWarningLogged = false;

function getKey(): Buffer | null {
  if (cachedKey) return cachedKey;

  const secret = process.env.STRAVA_TOKEN_KEY;
  if (!secret) {
    if (!keyWarningLogged) {
      console.warn(
        "⚠️ STRAVA_TOKEN_KEY no definida. Los tokens se guardarán sin cifrar. " +
          "DEFINE LA VARIABLE EN PRODUCCIÓN (genera una con `npm run strava:gen-key`).",
      );
      keyWarningLogged = true;
    }
    return null;
  }

  // Aceptamos base64 o hex. Si no, derivamos con scrypt.
  try {
    if (/^[A-Za-z0-9+/]+=*$/.test(secret) && secret.length % 4 === 0) {
      const buf = Buffer.from(secret, "base64");
      if (buf.length === KEY_LENGTH) {
        cachedKey = buf;
        return cachedKey;
      }
    }
    if (/^[0-9a-fA-F]+$/.test(secret)) {
      const buf = Buffer.from(secret, "hex");
      if (buf.length === KEY_LENGTH) {
        cachedKey = buf;
        return cachedKey;
      }
    }
  } catch {
    // fallthrough to scrypt
  }

  // Fallback: derivar 32 bytes de la secret con scrypt
  cachedKey = scryptSync(secret, "mi-dorsal-strava-salt", KEY_LENGTH);
  return cachedKey;
}

/**
 * Cifra un string. Devuelve base64: <iv>:<authTag>:<ciphertext>.
 * Si no hay key, devuelve el texto en claro (con prefijo "plain:" para detectar).
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  if (!key) return `plain:${plaintext}`;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Descifra un string. Si el input empieza con "plain:", lo devuelve tal cual
 * (modo dev sin key).
 */
export function decryptToken(ciphertext: string): string {
  if (ciphertext.startsWith("plain:")) {
    return ciphertext.slice("plain:".length);
  }

  const key = getKey();
  if (!key) {
    throw new Error(
      "STRAVA_TOKEN_KEY no definida pero hay tokens cifrados. " +
        "Configura la variable antes de descifrar.",
    );
  }

  const [ivB64, authTagB64, dataB64] = ciphertext.split(":");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Ciphertext con formato inválido");
  }

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  if (iv.length !== IV_LENGTH) throw new Error("IV inválido");
  if (authTag.length !== AUTH_TAG_LENGTH) throw new Error("AuthTag inválido");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

/** ¿Está habilitado el cifrado? (para checks de runtime) */
export function isEncryptionEnabled(): boolean {
  return getKey() !== null;
}
