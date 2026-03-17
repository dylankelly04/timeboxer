import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function stripInlineComment(value) {
  let result = "";
  let quote = null;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];

    if ((char === '"' || char === "'") && value[i - 1] !== "\\") {
      quote = quote === char ? null : quote ?? char;
    }

    if (char === "#" && !quote) {
      break;
    }

    result += char;
  }

  return result.trim();
}

function parseEnv(content) {
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = stripInlineComment(line.slice(separator + 1));

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

export function loadRootEnv(rootDir) {
  const env = { ...process.env };

  for (const fileName of [".env", ".env.local"]) {
    const filePath = path.join(rootDir, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    const parsed = parseEnv(readFileSync(filePath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (env[key] === undefined) {
        env[key] = value;
      }
    }
  }

  return env;
}
