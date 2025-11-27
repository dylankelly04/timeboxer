import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text("email").notNull().unique(),
  name: text("name"),
  password: text("password"), // null for OAuth users
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tasks = sqliteTable("tasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"), // Optional description
  startDate: text("startDate").notNull(), // ISO date string
  dueDate: text("dueDate").notNull(), // ISO date string
  timeRequired: integer("timeRequired").notNull(), // in minutes
  scheduledTime: text("scheduledTime"), // ISO datetime string for calendar placement
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  completedAt: integer("completedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export const taskHistory = sqliteTable(
  "task_history",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: text("taskId")
      .notNull()
      .unique()
      .references(() => tasks.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // ISO date string (YYYY-MM-DD)
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdDateIdx: index("userIdDateIdx").on(table.userId, table.date),
  })
);

export const outlookIntegrations = sqliteTable("outlook_integrations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("userId")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  calendarId: text("calendarId"), // Outlook calendar ID
  subscriptionId: text("subscriptionId"), // Webhook subscription ID
  subscriptionExpiresAt: integer("subscriptionExpiresAt", { mode: "timestamp" }), // When subscription expires
  syncEnabled: integer("syncEnabled", { mode: "boolean" })
    .notNull()
    .default(true),
  lastSyncAt: integer("lastSyncAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$onUpdate(() => new Date()),
});
