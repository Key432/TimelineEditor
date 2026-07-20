import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const workflowPath = resolve(
  process.cwd(),
  ".github/workflows/deploy-database.yml",
);
const workflow = readFileSync(workflowPath, "utf8");
const vercelIgnorePath = resolve(process.cwd(), ".vercelignore");
const vercelIgnore = readFileSync(vercelIgnorePath, "utf8");

describe("production database deployment workflow", () => {
  it("is manual, protected by production confirmation, and uses encrypted credentials", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("name: production");
    expect(workflow).toContain('"deploy-production"');
    expect(workflow).toContain("secrets.SUPABASE_ACCESS_TOKEN");
    expect(workflow).toContain("secrets.SUPABASE_DB_PASSWORD");
    expect(workflow).toContain("vars.SUPABASE_PROJECT_ID");
  });

  it("previews before applying migrations and never deploys seed data", () => {
    const previewIndex = workflow.indexOf(
      "supabase db push --linked --dry-run",
    );
    const applyIndex = workflow.indexOf(
      "supabase db push --linked",
      previewIndex + 1,
    );

    expect(previewIndex).toBeGreaterThan(-1);
    expect(applyIndex).toBeGreaterThan(previewIndex);
    expect(workflow).not.toContain("--include-seed");
  });
});

describe("Vercel deployment files", () => {
  it("excludes only the root Supabase directory", () => {
    const patterns = vercelIgnore.split(/\r?\n/);

    expect(patterns).toContain("/supabase");
    expect(patterns).not.toContain("supabase");
  });
});
