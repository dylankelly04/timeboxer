import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "@/drizzle/schema";

// Determine if we're using Turso (libsql://) or local SQLite (file://)
const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
const isTurso =
  databaseUrl.startsWith("libsql://") || databaseUrl.startsWith("libsql:");

let client;
if (isTurso) {
  // Turso connection
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!authToken) {
    throw new Error("TURSO_AUTH_TOKEN is required when using Turso database");
  }
  client = createClient({
    url: databaseUrl,
    authToken,
  });
} else {
  // Local SQLite file
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
