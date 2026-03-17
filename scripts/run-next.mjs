import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRootEnv } from "./load-root-env.mjs";

const [appName, command, port] = process.argv.slice(2);

if (!appName || !command) {
  console.error("Usage: node scripts/run-next.mjs <frontend|backend> <command> [port]");
  process.exit(1);
}

if (!["frontend", "backend"].includes(appName)) {
  console.error(`Unknown app "${appName}". Expected "frontend" or "backend".`);
  process.exit(1);
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(rootDir, appName);
const env = loadRootEnv(rootDir);

if (appName === "frontend" && !env.BACKEND_URL) {
  env.BACKEND_URL = "http://localhost:4000";
}

const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
const args = [nextBin, command, "."];

if (port) {
  args.push("-p", port);
}

if (command === "dev" || command === "build") {
  args.push("--webpack");
}

const child = spawn(process.execPath, args, {
  cwd: appDir,
  env,
  stdio: "inherit",
});

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
