import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const databaseUrl = process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

if (!authToken && databaseUrl.startsWith("libsql://")) {
  console.error("❌ TURSO_AUTH_TOKEN is required for Turso database");
  process.exit(1);
}

async function createTable() {
  let client;

  if (databaseUrl.startsWith("libsql://") || databaseUrl.startsWith("libsql:")) {
    // Turso connection
    if (!authToken) {
      console.error("❌ TURSO_AUTH_TOKEN is required for Turso");
      process.exit(1);
    }
    client = createClient({
      url: databaseUrl,
      authToken,
    });
    console.log("📡 Connected to Turso database");
  } else {
    // Local SQLite
    const dbPath = databaseUrl.replace(/^file:/, "");
    client = createClient({
      url: `file:${dbPath}`,
    });
    console.log("📁 Connected to local SQLite database");
  }

  try {
    // Drop table if it exists (for testing)
    console.log("🗑️  Dropping existing table if it exists...");
    await client.execute(`
      DROP TABLE IF EXISTS task_scheduled_times
    `);

    // Create the task_scheduled_times table
    console.log("📝 Creating task_scheduled_times table...");
    await client.execute(`
      CREATE TABLE task_scheduled_times (
        id TEXT PRIMARY KEY NOT NULL,
        taskId TEXT NOT NULL,
        startTime TEXT NOT NULL,
        duration INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    // Create index on taskId
    console.log("📊 Creating index on taskId...");
    await client.execute(`
      CREATE INDEX taskIdIdx ON task_scheduled_times(taskId)
    `);

    console.log("✅ Table 'task_scheduled_times' created successfully!");

    // Verify table exists
    const result = await client.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='task_scheduled_times'
    `);

    if (result.rows.length > 0) {
      console.log("✅ Verified: table exists in database");
    } else {
      console.error("❌ Warning: table not found after creation");
    }
  } catch (error) {
    console.error("❌ Error creating table:", error);
    throw error;
  } finally {
    client.close();
  }
}

createTable()
  .then(() => {
    console.log("✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Failed:", error);
    process.exit(1);
  });

