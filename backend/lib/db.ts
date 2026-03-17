import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "@/drizzle/schema";

// Support both Turso (cloud) and local SQLite (self-hosted)
const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
const isTurso =
  databaseUrl.startsWith("libsql://") || databaseUrl.startsWith("libsql:");

let client;
if (isTurso) {
  // Turso (cloud) connection - requires auth token
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!authToken) {
    throw new Error("TURSO_AUTH_TOKEN is required when using Turso database");
  }
  client = createClient({
    url: databaseUrl,
    authToken,
  });
} else {
  // Local SQLite file (self-hosted) - no auth token needed
  const dbPath = databaseUrl.replace(/^file:/, "");
  client = createClient({
    url: `file:${dbPath}`,
  });
}

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle> | undefined;
};

export const db =
  globalForDb.db ??
  drizzle(client, {
    schema,
  });

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
