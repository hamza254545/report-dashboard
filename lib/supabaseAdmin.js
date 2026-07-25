import { createClient } from "@supabase/supabase-js";

// IMPORTANT: this file must not read process.env or construct the Supabase
// client at module load time. Next.js imports route modules while building
// (to collect route metadata), and on Vercel that build step may run
// before/without runtime environment variables being available — reading
// process.env or calling createClient() at the top level would throw and
// fail the build. Everything here is deferred until the client is actually
// used inside a request handler.
//
// This client uses the Supabase service role key, which bypasses Row Level
// Security. It must only ever be used from server-side code (API routes,
// server actions, services) — never imported from a "use client" file.

let cachedClient = null;

function createSupabaseAdminClient() {
  if (cachedClient) return cachedClient;

  // Either var name works — NEXT_PUBLIC_SUPABASE_URL if you also want the
  // URL available client-side for other tooling, or a server-only
  // SUPABASE_URL. The URL itself isn't secret; the service role key is.
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable(s). " +
        "Set both in your Vercel project (or .env.local for local dev)."
    );
  }

  cachedClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}

// A lazy proxy so every existing call site (`supabaseAdmin.from(...)`,
// `supabaseAdmin.auth...`, etc.) keeps working unchanged, while the real
// client — and the env var reads it needs — is only created the first time
// a property is actually accessed at request time, not at import time.
export const supabaseAdmin = new Proxy(
  {},
  {
    get(_target, prop, receiver) {
      const client = createSupabaseAdminClient();
      const value = Reflect.get(client, prop, client);
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);
