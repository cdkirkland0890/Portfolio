import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password, encodedHash) {
  if (typeof encodedHash !== "string" || !/^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(encodedHash)) return false;
  const [salt, expectedHex] = encodedHash.split(":");
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashSecret(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function secureEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function parseAdminUsers(serialized) {
  if (!serialized) return [];
  let users;
  try { users = JSON.parse(serialized); } catch { throw new Error("ADMIN_USERS_JSON must be valid JSON."); }
  if (!Array.isArray(users)) throw new Error("ADMIN_USERS_JSON must be a JSON array.");
  for (const user of users) {
    if (!user || typeof user.email !== "string" || !user.email.includes("@")
      || !["admin", "reviewer"].includes(user.role)
      || !/^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(user.passwordHash || "")) {
      throw new Error("Each admin user requires an email, admin/reviewer role, and scrypt passwordHash.");
    }
  }
  return users.map((user) => ({ ...user, email: user.email.trim().toLowerCase() }));
}

export class FixedWindowRateLimiter {
  #windows = new Map();
  constructor({ limit, windowMs, maxKeys = 5000 }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
  }

  allow(key, now = Date.now()) {
    let entry = this.#windows.get(key);
    if (!entry || entry.expiresAt <= now) {
      if (this.#windows.size >= this.maxKeys) {
        for (const [candidate, value] of this.#windows) {
          if (value.expiresAt <= now) this.#windows.delete(candidate);
        }
        if (this.#windows.size >= this.maxKeys) this.#windows.delete(this.#windows.keys().next().value);
      }
      entry = { count: 0, expiresAt: now + this.windowMs };
      this.#windows.set(key, entry);
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }
}
