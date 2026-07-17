import { spawnSync } from "node:child_process";

const mode = process.argv[2];
const pnpmCli = process.env.npm_execpath;

if (!pnpmCli) {
  throw new Error("Run this script through a pnpm package script.");
}

function run(args, options = {}) {
  return spawnSync(process.execPath, [pnpmCli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options,
  });
}

function ensureLocalSupabase() {
  let status = run(["exec", "supabase", "status", "--output", "env"]);

  if (status.status !== 0) {
    const started = run(["exec", "supabase", "start"], { stdio: "inherit" });
    if (started.status !== 0) {
      process.exit(started.status ?? 1);
    }
    status = run(["exec", "supabase", "status", "--output", "env"]);
  }

  if (status.status !== 0) {
    process.stderr.write(status.stderr);
    process.exit(status.status ?? 1);
  }

  return parseEnv(status.stdout);
}

function parseEnv(output) {
  const values = {};

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(?:"(.*)"|(.*))$/);
    if (match) {
      values[match[1]] = match[2] ?? match[3] ?? "";
    }
  }

  return values;
}

function execute(args, env) {
  const result = run(args, {
    env,
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

const local = ensureLocalSupabase();
const testEnv = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY ?? local.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SECRET_KEY ?? local.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
  E2E_TEST_AUTH: "true",
  E2E_TEST_AUTH_SECRET: "local-e2e-auth-secret",
};

if (
  !testEnv.NEXT_PUBLIC_SUPABASE_URL ||
  !testEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  !testEnv.SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error(
    "Supabase local status did not return the required API keys.",
  );
}

switch (mode) {
  case "vitest":
    execute(
      ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"],
      testEnv,
    );
    break;
  case "playwright":
    execute(["exec", "playwright", "test"], testEnv);
    break;
  case "migrations":
    execute(["exec", "supabase", "db", "reset"], testEnv);
    break;
  default:
    throw new Error(`Unknown local Supabase test mode: ${mode ?? "(missing)"}`);
}
