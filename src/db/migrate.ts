import { db, schema } from "./client.js";
import { v4 as uuid } from "uuid";

export function runMigrations() {
  const sqlite = (db as any).session?.client;
  if (!sqlite) return;

  const queries = [
    `CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      read_token TEXT NOT NULL UNIQUE,
      write_token TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id),
      workflow_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      stale_after_minutes INTEGER DEFAULT 1440,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(client_id, workflow_id)
    )`,
    `CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id),
      status TEXT NOT NULL CHECK(status IN ('success','failed','running')),
      duration_ms INTEGER,
      error_message TEXT,
      executed_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ];

  for (const q of queries) {
    sqlite.exec(q);
  }

  seedDemoClient();
}

export function seedDemoClient() {
  const sqlite = (db as any).session?.client;
  if (!sqlite) return;

  const existing = sqlite.prepare("SELECT id FROM clients WHERE slug = ?").get("acme-corp");
  if (existing) return;

  const clientId = uuid();
  const readToken = uuid();
  const writeToken = uuid();

  db.insert(schema.clients).values({
    id: clientId,
    name: "Acme Corp",
    slug: "acme-corp",
    read_token: readToken,
    write_token: writeToken,
  }).run();

  const demoWfs = [
    { wfid: "demo-invoice", name: "Invoice Processing", status: "success", ms: 1240, minAgo: 2 },
    { wfid: "demo-sales", name: "Daily Sales Report", status: "success", ms: 4700, minAgo: 360 },
    { wfid: "demo-stock", name: "Stock Alert", status: "failed", ms: 400, minAgo: 143 },
    { wfid: "demo-hr", name: "HR Onboarding", status: "success", ms: 8300, minAgo: 1440 },
    { wfid: "demo-reminder", name: "Client Invoice Reminder", status: "success", ms: 2100, minAgo: 660 },
    { wfid: "demo-email", name: "Email Sync", status: "never_run", ms: null, minAgo: 0 },
  ];

  for (const d of demoWfs) {
    const wfId = uuid();
    db.insert(schema.workflows).values({
      id: wfId,
      client_id: clientId,
      workflow_id: d.wfid,
      name: d.name,
      description: null,
    }).run();

    if (d.status === "never_run") continue;

    const ts = new Date(Date.now() - d.minAgo * 60000).toISOString();

    db.insert(schema.runs).values({
      id: uuid(),
      workflow_id: wfId,
      status: d.status as "success" | "failed" | "running",
      duration_ms: d.ms,
      error_message: d.status === "failed" ? "Connection refused" : null,
      executed_at: ts,
    }).run();
  }
}
