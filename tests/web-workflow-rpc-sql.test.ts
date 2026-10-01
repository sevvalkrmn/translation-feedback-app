import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase/migrations");
const webRpcMigration = readdirSync(migrationsDir).find((file) => file.endsWith("_add_web_workflow_rpcs.sql"));

if (!webRpcMigration) {
  throw new Error("add_web_workflow_rpcs migration dosyası bulunamadı.");
}

const migration = readFileSync(path.join(migrationsDir, webRpcMigration), "utf8");

const webFunctions = [
  "create_student_session(text, text, text)",
  "verify_student_session_access(uuid, text)",
  "list_session_tasks(uuid, text)",
  "get_session_task_bundle(uuid, text, integer)",
  "submit_session_translation_task(uuid, text, integer, text, text)",
  "submit_session_task_revision(uuid, text, integer, text)",
  "retry_failed_session_job(uuid, text, integer)",
  "get_session_result_bundle(uuid, text)"
];

describe("web workflow rpc sql", () => {
  it("defines security-definer RPCs without broad table grants", () => {
    expect(migration).not.toMatch(
      /grant\s+(select|insert|update|delete|all)\s+on\s+(table\s+)?public\.(student_sessions|translation_tasks|feedbacks|model_jobs)/i
    );

    for (const functionSignature of webFunctions) {
      expect(migration).toContain(`revoke execute on function public.${functionSignature} from public, anon, authenticated`);
      expect(migration).toContain(`grant execute on function public.${functionSignature} to service_role`);
    }

    expect((migration.match(/security definer/g) ?? []).length).toBe(webFunctions.length);
    expect((migration.match(/set search_path = public/g) ?? []).length).toBe(webFunctions.length);
  });

  it("creates sessions without returning the stored access-token hash", () => {
    expect(migration).toContain("create or replace function public.create_student_session");
    expect(migration).toContain("insert into public.student_sessions");
    expect(migration).toContain("access_token_hash");
    const returnTables = migration.match(/returns table\s*\([\s\S]*?\)/g) ?? [];
    expect(returnTables.length).toBeGreaterThan(0);
    expect(returnTables.every((returnTable) => !returnTable.includes("access_token_hash"))).toBe(true);
  });

  it("requires session id and token hash for session-bound reads and writes", () => {
    expect(migration).toContain("create or replace function public.verify_student_session_access");
    expect((migration.match(/sessions\.access_token_hash = p_access_token_hash/g) ?? []).length).toBeGreaterThanOrEqual(
      7
    );
    expect((migration.match(/tasks\.session_id = p_session_id/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });

  it("blocks cross-session task access and invalid workflow order", () => {
    expect(migration).toContain("tasks.task_number = p_task_number");
    expect(migration).toContain("p_task_number in (1, 2)");
    expect(migration).toContain("task 1 must be revised before task 2");
    expect(migration).toContain("tasks.status = 'feedback_ready'");
    expect(migration).toContain("sessions.status = 'active'");
  });

  it("protects result and PDF data behind completed task and feedback checks", () => {
    expect(migration).toContain("create or replace function public.get_session_result_bundle");
    expect(migration).toContain("tasks.task_number = 1");
    expect(migration).toContain("tasks.task_number = 2");
    expect((migration.match(/tasks\.status = 'revised'/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(migration).toContain("join feedback_one on true");
    expect(migration).toContain("join feedback_two on true");
  });
});
