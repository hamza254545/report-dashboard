import { createClient } from "@supabase/supabase-js";

// Either var name works — NEXT_PUBLIC_SUPABASE_URL if you also want the URL
// available client-side for other tooling, or a server-only SUPABASE_URL.
// The URL itself isn't secret; the service role key below is.
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  // Fail loudly at import time in server contexts rather than surfacing a
  // confusing Supabase error deep inside a request handler.
  console.warn(
    "[supabaseAdmin] Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
  );
}

// IMPORTANT: this client uses the Supabase service role key, which bypasses
// Row Level Security. It must only ever be imported from server-side code
// (API routes, server actions, services) — never from a "use client" file.
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
