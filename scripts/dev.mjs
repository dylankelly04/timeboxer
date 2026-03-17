import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2] === "start" ? "start" : "dev";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runner = path.join(rootDir, "scripts", "run-next.mjs");

const backend = spawn(process.execPath, [runner, "backend", mode, "4000"], {
  cwd: rootDir,
  stdio: "inherit",
});

const frontend = spawn(process.execPath, [runner, "frontend", mode, "3000"], {
  cwd: rootDir,
  stdio: "inherit",
});

const children = [backend, frontend];
let exiting = false;

function stopChildren(signal) {
  if (exiting) {
    return;
  }

  exiting = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => stopChildren("SIGINT"));
process.on("SIGTERM", () => stopChildren("SIGTERM"));

for (const child of children) {
  child.on("exit", (code) => {
    stopChildren("SIGTERM");
    process.exit(code ?? 0);
  });
}
