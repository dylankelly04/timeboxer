const { createClient } = require("@libsql/client");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!databaseUrl) {
    console.error("DATABASE_URL not found in environment");
    process.exit(1);
  }

  console.log("Database URL:", databaseUrl);

  let client;
  if (databaseUrl.startsWith("libsql://") || databaseUrl.startsWith("libsql:")) {
    if (!authToken) {
      console.error("TURSO_AUTH_TOKEN not found for remote database");
      process.exit(1);
    }
    client = createClient({ url: databaseUrl, authToken });
  } else {
    const dbPath = databaseUrl.replace(/^file:/, "");
    client = createClient({ url: `file:${dbPath}` });
  }

  console.log("Creating reminders table...");

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
        updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    console.log("Reminders table created successfully!");

    // Verify the table exists
    const result = await client.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='reminders'
    `);

    if (result.rows.length > 0) {
      console.log("Verified: reminders table exists");
    } else {
      console.error("Error: reminders table was not created");
      process.exit(1);
    }

  } catch (error) {
    console.error("Error creating table:", error);
    process.exit(1);
  }

  console.log("Done!");
}

main();

