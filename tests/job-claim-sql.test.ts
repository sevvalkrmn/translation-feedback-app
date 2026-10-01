import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase/migrations");
const initialMigration = readdirSync(migrationsDir).find((file) => file.endsWith("_initial_schema.sql"));

if (!initialMigration) {
  throw new Error("initial_schema migration dosyası bulunamadı.");
}

const migration = readFileSync(path.join(migrationsDir, initialMigration), "utf8");

describe("model job sql", () => {
  it("uses an atomic skip-locked claim", () => {
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("claim_next_model_job");
    expect(migration).toContain("lease_expires_at < now()");
  });

  it("enables RLS and removes browser table grants", () => {
    expect(migration).toContain("alter table public.student_sessions enable row level security");
    expect(migration).toContain("revoke all on public.model_jobs from anon, authenticated");
    expect(migration).toContain("revoke execute on function public.claim_next_model_job");
  });
});
