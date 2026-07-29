import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const distDirectory = resolve(process.cwd(), ".next-e2e");
const serverEnv = { ...process.env, NEXT_DIST_DIR: ".next-e2e" };
rmSync(distDirectory, { force: true, recursive: true });

const build = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  {
    cwd: process.cwd(),
    env: serverEnv,
    stdio: "inherit",
  },
);
if (build.status !== 0) process.exit(build.status ?? 1);

const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  {
    cwd: process.cwd(),
    env: serverEnv,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
