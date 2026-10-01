import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repository = readFileSync(path.join(process.cwd(), "lib/supabase/repository.ts"), "utf8");

describe("web repository data access", () => {
  it("does not access protected workflow tables directly", () => {
    expect(repository).not.toMatch(/\.from\(["'](student_sessions|translation_tasks|feedbacks|model_jobs)["']\)/);
  });

  it("uses session-token-aware RPCs for the web workflow", () => {
    for (const rpcName of [
      "create_student_session",
      "verify_student_session_access",
      "list_session_tasks",
      "get_session_task_bundle",
      "submit_session_translation_task",
      "submit_session_task_revision",
      "retry_failed_session_job",
      "get_session_result_bundle"
    ]) {
      expect(repository).toContain(`.rpc("${rpcName}"`);
    }
  });
});
