import "server-only";

import { createClient } from "@supabase/supabase-js";

export function getSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL ve SUPABASE_SECRET_KEY tanımlı olmalıdır.");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
