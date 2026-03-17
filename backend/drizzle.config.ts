import { defineConfig } from "drizzle-kit";

// Support both Turso (cloud) and local SQLite (self-hosted)
const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
const isTurso =
  databaseUrl.startsWith("libsql://") || databaseUrl.startsWith("libsql:");

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  ...(isTurso
    ? {
        // Turso (cloud) configuration
        dbCredentials: {
          url: databaseUrl,
          authToken: process.env.TURSO_AUTH_TOKEN || "",
        },
      }
    : {
        // Local SQLite (self-hosted) configuration
        dbCredentials: {
          url: databaseUrl.replace(/^file:/, ""),
        },
      }),
});
