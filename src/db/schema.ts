import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  read_token: text("read_token").notNull().unique(),
  write_token: text("write_token").notNull().unique(),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});

export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  client_id: text("client_id")
    .notNull()
    .references(() => clients.id),
  workflow_id: text("workflow_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  stale_after_minutes: integer("stale_after_minutes").default(1440),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  workflow_id: text("workflow_id")
    .notNull()
    .references(() => workflows.id),
  status: text("status", { enum: ["success", "failed", "running"] }).notNull(),
  duration_ms: integer("duration_ms"),
  error_message: text("error_message"),
  executed_at: text("executed_at").default(sql`(datetime('now'))`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  expires_at: text("expires_at").notNull(),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});
