import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export function getSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL ve SUPABASE_SECRET_KEY tanımlı olmalıdır.");
  }

  return createClient<Database>(url, serviceKey, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" })
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
