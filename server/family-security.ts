import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const scrypt = promisify(scryptCallback);

export async function hashSharedPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("base64url")}`;
}

export async function verifySharedPassword(password: string, storedHash: string) {
  const [salt, encodedHash] = storedHash.split(":");
  if (!salt || !encodedHash) return false;

  const stored = Buffer.from(encodedHash, "base64url");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}
