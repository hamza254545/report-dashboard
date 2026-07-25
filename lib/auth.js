import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;
const TOKEN_TTL = "12h";

function getAppSecret() {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "Missing or too-short APP_SECRET environment variable. Set it to a long, random string " +
        "(used to sign session tokens) — e.g. `openssl rand -hex 32`."
    );
  }
  return secret;
}

export async function hashPassword(plainPassword) {
  if (!plainPassword || typeof plainPassword !== "string" || plainPassword.length < 8) {
    throw new Error("Password must be a string of at least 8 characters.");
  }
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function verifyPassword(plainPassword, hash) {
  if (!plainPassword || !hash) return false;
  try {
    return await bcrypt.compare(plainPassword, hash);
  } catch {
    return false;
  }
}

/**
 * Issues a signed, time-limited session token. `payload` should be a small
 * object such as { role: "partner", partnerId } or { role: "admin" }.
 */
export function signSessionToken(payload) {
  return jwt.sign(payload, getAppSecret(), { expiresIn: TOKEN_TTL });
}

/**
 * Verifies and decodes a session token. Returns null (never throws) if the
 * token is missing, malformed, expired, or has a bad signature.
 */
export function verifySessionToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, getAppSecret());
  } catch {
    return null;
  }
}

function extractBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

/**
 * Reads the Authorization header from a Next.js Request, verifies it, and
 * returns the decoded session — or null if unauthenticated/invalid.
 */
export function getSession(request) {
  const token = extractBearerToken(request);
  return verifySessionToken(token);
}

export function requireAdminSession(request) {
  const session = getSession(request);
  if (!session || session.role !== "admin") return null;
  return session;
}

export function requirePartnerSession(request) {
  const session = getSession(request);
  if (!session || session.role !== "partner" || !session.partnerId) return null;
  return session;
}

/**
 * Accepts either an admin session, or a partner session scoped to
 * `partnerId`. Used by endpoints partners and admins both need (e.g.
 * fetching reports for a specific partner).
 */
export function requireAdminOrPartner(request, partnerId) {
  const session = getSession(request);
  if (!session) return null;
  if (session.role === "admin") return session;
  if (session.role === "partner" && session.partnerId === partnerId) return session;
  return null;
}
