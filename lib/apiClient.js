"use client";

const SESSION_KEY = "adstream_session";

export function getStoredSession() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function setStoredSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Fetches a JSON API route, attaching the stored session token and
 * throwing a plain Error with the server's message on failure.
 */
export async function apiFetch(path, options = {}) {
  const session = getStoredSession();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  const response = await fetch(path, { ...options, headers });
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || !body?.success) {
    const message = body?.error || `Request to ${path} failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return body;
}
