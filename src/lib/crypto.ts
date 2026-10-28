import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

// Field-level encryption for customer PII: AES-256-GCM, random 96-bit IV per value.
// Format: "v1:<keyId>:<base64(iv | authTag | ciphertext)>". keyId lets us rotate keys:
// set DATA_ENCRYPTION_KEY_PREVIOUS to the old key while re-encrypting.

function parseKey(b64: string): Buffer {
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return key;
}

function keyId(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 8);
}

function keys(): Map<string, Buffer> {
  const map = new Map<string, Buffer>();
  const current = parseKey(env.dataEncryptionKey);
  map.set(keyId(current), current);
  const prev = env.dataEncryptionKeyPrevious;
  if (prev) {
    const k = parseKey(prev);
    map.set(keyId(k), k);
  }
  return map;
}

export function encrypt(plaintext: string): string {
  const key = parseKey(env.dataEncryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${keyId(key)}:${Buffer.concat([iv, tag, ct]).toString("base64")}`;
}

export function decrypt(value: string): string {
  const [version, kid, data] = value.split(":");
  if (version !== "v1" || !kid || !data) throw new Error("Unrecognised ciphertext format");
  const key = keys().get(kid);
  if (!key) throw new Error("No decryption key available for this value");
  const raw = Buffer.from(data, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function encryptOptional(value: string | null | undefined): string | null {
  return value === null || value === undefined || value === "" ? null : encrypt(value);
}

export function decryptOptional(value: string | null | undefined): string | null {
  return value ? decrypt(value) : null;
}

export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value));
}

export function decryptJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  return JSON.parse(decrypt(value)) as T;
}

/** Keyed, non-reversible hash for equality lookups on encrypted fields (e.g. email). */
export function lookupHash(value: string): string {
  return createHmac("sha256", env.hashPepper).update(value.trim().toLowerCase()).digest("hex");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Crockford base32 without ambiguous characters.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Human-friendly, non-sequential enrollment reference, e.g. SCI-7K3M9Q2X. */
export function generatePublicId(): string {
  const bytes = randomBytes(10);
  let id = "";
  for (let i = 0; i < 10; i++) id += ALPHABET[bytes[i] % ALPHABET.length];
  return `SCI-${id}`;
}
