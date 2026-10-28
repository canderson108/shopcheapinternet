import { compare, hash } from "bcryptjs";
import { authenticator } from "otplib";
import { decrypt, encrypt } from "../crypto";

authenticator.options = { window: 1 };

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Password must contain letters and numbers.";
  return null;
}

export function generateMfaSecret(): { secret: string; secretEnc: string } {
  const secret = authenticator.generateSecret();
  return { secret, secretEnc: encrypt(secret) };
}

export function mfaOtpauthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, "Shop Cheap Internet", secret);
}

export function verifyMfaCode(secretEnc: string, code: string): boolean {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  return authenticator.verify({ token: clean, secret: decrypt(secretEnc) });
}
