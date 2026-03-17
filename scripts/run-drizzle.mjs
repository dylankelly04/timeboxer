import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRootEnv } from "./load-root-env.mjs";

const [command] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/run-drizzle.mjs <generate|migrate|push>");
  process.exit(1);
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = path.join(rootDir, "backend");
const env = loadRootEnv(rootDir);
const drizzleBin = path.join(rootDir, "node_modules", "drizzle-kit", "bin.cjs");

const child = spawn(
  process.execPath,
  [drizzleBin, command, "--config=drizzle.config.ts"],
  {
    cwd: backendDir,
    env,
    stdio: "inherit",
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
