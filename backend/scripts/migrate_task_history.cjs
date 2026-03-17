// Migration script to update task_history table to allow multiple entries per task
// This removes the unique constraint on taskId and adds an index for (taskId, date)

const { createClient } = require("@libsql/client");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const databaseUrl = process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!databaseUrl) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

async function migrate() {
  let client;

  // Check for Turso (libsql://) vs local (file://)
  if (databaseUrl.startsWith("libsql://") || databaseUrl.startsWith("libsql:")) {
    if (!authToken) {
      console.error("TURSO_AUTH_TOKEN not found in .env.local (required for remote Turso)");
      process.exit(1);
    }
    client = createClient({ url: databaseUrl, authToken });
    console.log("Connected to remote Turso database");
  } else {
    const dbPath = databaseUrl.replace(/^file:/, "");
    client = createClient({ url: `file:${dbPath}` });
    console.log("Connected to local database:", dbPath);
  }

  try {
    console.log("Starting migration of task_history table...");

    // Step 1: Create a backup of existing data
    console.log("Step 1: Backing up existing task_history data...");
    const existingData = await client.execute("SELECT * FROM task_history");
    console.log(`Found ${existingData.rows.length} existing history entries`);

    // Step 2: Drop the old table
    console.log("Step 2: Dropping old task_history table...");
    await client.execute("DROP TABLE IF EXISTS task_history");

    // Step 3: Create the new table without the unique constraint on taskId
    console.log("Step 3: Creating new task_history table...");
    await client.execute(`
      CREATE TABLE task_history (
        id TEXT PRIMARY KEY NOT NULL,
        userId TEXT NOT NULL,
        taskId TEXT NOT NULL,
        date TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        minutesWorked INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    // Step 4: Create indexes
    console.log("Step 4: Creating indexes...");
    await client.execute("CREATE INDEX userIdDateIdx ON task_history(userId, date)");
    await client.execute("CREATE INDEX taskIdDateIdx ON task_history(taskId, date)");

    // Step 5: Restore the backed up data
    if (existingData.rows.length > 0) {
      console.log("Step 5: Restoring backed up data...");
      for (const row of existingData.rows) {
        await client.execute({
          sql: `INSERT INTO task_history (id, userId, taskId, date, completed, minutesWorked, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [row.id, row.userId, row.taskId, row.date, row.completed, row.minutesWorked, row.createdAt]
        });
      }
      console.log(`Restored ${existingData.rows.length} history entries`);
    } else {
      console.log("Step 5: No data to restore (table was empty)");
    }

    // Step 6: Verify the migration
    console.log("Step 6: Verifying migration...");
    const tableInfo = await client.execute("PRAGMA table_info(task_history)");
    console.log("New table schema:");
    tableInfo.rows.forEach(col => {
      console.log(`  - ${col.name}: ${col.type} ${col.notnull ? "NOT NULL" : ""} ${col.pk ? "PRIMARY KEY" : ""}`);
    });

    const indexInfo = await client.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='task_history'");
    console.log("Indexes:");
    indexInfo.rows.forEach(idx => {
      console.log(`  - ${idx.name}`);
    });

    const finalCount = await client.execute("SELECT COUNT(*) as count FROM task_history");
    console.log(`Final row count: ${finalCount.rows[0].count}`);

    console.log("\n✅ Migration completed successfully!");
    console.log("The task_history table now supports multiple entries per task (one per day).");

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();

