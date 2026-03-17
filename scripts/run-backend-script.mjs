import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRootEnv } from "./load-root-env.mjs";

const [scriptPath] = process.argv.slice(2);

if (!scriptPath) {
  console.error("Usage: node scripts/run-backend-script.mjs <relative-backend-script>");
  process.exit(1);
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = path.join(rootDir, "backend");
const env = loadRootEnv(rootDir);

const child = spawn(process.execPath, [scriptPath], {
  cwd: backendDir,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
