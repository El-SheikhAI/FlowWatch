import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db/client.js";
import { eq, and } from "drizzle-orm";
import { incrementChangeCounter, notifyAdmin } from "../lib/events.js";

const pingRoute = new Hono();

const pingThrottle = new Map<string, number>();
const PING_MIN_INTERVAL = 500;
const PING_CLEANUP_INTERVAL = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pingThrottle) {
    if (now - v > PING_CLEANUP_INTERVAL) pingThrottle.delete(k);
  }
}, PING_CLEANUP_INTERVAL);

pingRoute.post("/", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization" }, 401);
  }

  const writeToken = auth.slice(7);
  if (!writeToken) {
    return c.json({ error: "Missing or invalid authorization" }, 401);
  }
  const client = db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.write_token, writeToken))
    .get();

  if (!client) {
    return c.json({ error: "Invalid write token" }, 401);
  }

  const now = Date.now();
  const last = pingThrottle.get(client.id);
  if (last && now - last < PING_MIN_INTERVAL) {
    return c.json({ error: "Rate limited" }, 429);
  }
  pingThrottle.set(client.id, now);

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const workflow_id = typeof body.workflow_id === "string" ? body.workflow_id.trim().slice(0, 100) : "";
  const workflow_name = typeof body.workflow_name === "string" ? body.workflow_name.trim().slice(0, 200) : "";
  const status = ["success", "failed", "running"].includes(body.status) ? body.status : "";
  const error_message = typeof body.error_message === "string" ? body.error_message.trim().slice(0, 500) : null;

  if (!workflow_id || !workflow_name || !status) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  let wf = db
    .select()
    .from(schema.workflows)
    .where(
      and(
        eq(schema.workflows.client_id, client.id),
        eq(schema.workflows.workflow_id, workflow_id)
      )
    )
    .get();

  if (!wf) {
    const newId = uuid();
    try {
      db.insert(schema.workflows)
        .values({
          id: newId,
          client_id: client.id,
          workflow_id,
          name: workflow_name,
          description: null,
        })
        .run();
    } catch {}
    wf = db
      .select()
      .from(schema.workflows)
      .where(
        and(
          eq(schema.workflows.client_id, client.id),
          eq(schema.workflows.workflow_id, workflow_id)
        )
      )
      .get()!;
  }

  db.insert(schema.runs)
    .values({
      id: uuid(),
      workflow_id: wf.id,
      status: status,
      error_message: error_message,
      executed_at: new Date().toISOString(),
    })
    .run();

  incrementChangeCounter(client.id);
  notifyAdmin();

  return c.json({ ok: true });
});

export default pingRoute;
