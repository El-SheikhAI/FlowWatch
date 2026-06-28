import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db/client.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { getGlobalCounter } from "../lib/events.js";

const adminRoute = new Hono();

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 15 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT) return false;
  return true;
}

async function parseJson(c: any) {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

function sanitize(val: unknown, maxLen = 200): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxLen);
}

function getClientIp(c: any): string {
  const forwarded = c.req.header("x-forwarded-for");
  const realIp = c.req.header("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || realIp || "direct";
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const verify = crypto
    .scryptSync(password, salt, 64)
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(verify), Buffer.from(hash));
}

async function requireSession(c: any, next: any) {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = auth.slice(7);
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const session = db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.token, token))
    .get();

  if (!session || new Date(session.expires_at) < new Date()) {
    return c.json({ error: "Session expired" }, 401);
  }
  await next();
}

adminRoute.get("/check-setup", async (c) => {
  const row = db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "admin_password_hash"))
    .get();
  return c.json({ setup: !row || !row.value });
});

adminRoute.post("/setup", async (c) => {
  const ip = getClientIp(c);
  if (!checkRateLimit(ip)) {
    return c.json({ error: "Too many attempts. Try again later." }, 429);
  }
  const row = db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "admin_password_hash"))
    .get();

  if (row && row.value) {
    return c.json({ error: "Admin account already exists" }, 409);
  }

  const body = await parseJson(c);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const { username, password } = body;
  const user = sanitize(username, 60);
  const pass = sanitize(password, 128);

  if (!user || !pass) {
    return c.json({ error: "Username and password are required" }, 400);
  }

  if (pass.length < 4) {
    return c.json({ error: "Password must be at least 4 characters" }, 400);
  }

  const hash = hashPassword(pass);

  db.insert(schema.settings)
    .values({ key: "admin_username", value: user })
    .run();

  db.insert(schema.settings)
    .values({ key: "admin_password_hash", value: hash })
    .run();

  const token = uuid();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.insert(schema.sessions)
    .values({ id: uuid(), token, expires_at: expiresAt })
    .run();

  return c.json({ token, username: user, expires_at: expiresAt });
});

adminRoute.post("/login", async (c) => {
  const ip = getClientIp(c);
  if (!checkRateLimit(ip)) {
    return c.json({ error: "Too many attempts. Try again later." }, 429);
  }

  const body = await parseJson(c);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const { username, password } = body;
  const user = sanitize(username, 60);
  const pass = sanitize(password, 128);

  if (!user || !pass) {
    return c.json({ error: "Username and password are required" }, 400);
  }

  const userRow = db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "admin_username"))
    .get();

  const hashRow = db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "admin_password_hash"))
    .get();

  if (!userRow || !hashRow) {
    return c.json({ error: "No admin account found" }, 401);
  }

  if (userRow.value !== user || !verifyPassword(pass, hashRow.value)) {
    return c.json({ error: "Invalid username or password" }, 401);
  }

  const token = uuid();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.insert(schema.sessions)
    .values({ id: uuid(), token, expires_at: expiresAt })
    .run();

  return c.json({ token, username: user, expires_at: expiresAt });
});

adminRoute.get("/clients", requireSession, async (c) => {
  const clients = db.select().from(schema.clients).all();
  const result = clients.map((client) => {
    const wfCount = db
      .select()
      .from(schema.workflows)
      .where(eq(schema.workflows.client_id, client.id))
      .all().length;
    return { ...client, workflow_count: wfCount };
  });
  return c.json(result);
});

adminRoute.post("/clients", requireSession, async (c) => {
  const body = await parseJson(c);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const { name, slug } = body;
  const safeName = sanitize(name, 100);
  const safeSlug = sanitize(slug, 60).replace(/[^a-z0-9-]/g, "").toLowerCase();

  if (!safeName || !safeSlug) {
    return c.json({ error: "Name and slug are required" }, 400);
  }

  const existing = db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.slug, safeSlug))
    .get();

  if (existing) {
    return c.json({ error: "Slug already taken" }, 409);
  }

  const id = uuid();
  const readToken = uuid();
  const writeToken = uuid();

  try {
    db.insert(schema.clients)
      .values({ id, name: safeName, slug: safeSlug, read_token: readToken, write_token: writeToken })
      .run();
  } catch {
    return c.json({ error: "Slug already taken" }, 409);
  }

  return c.json({
    id, name: safeName, slug: safeSlug,
    read_token: readToken,
    write_token: writeToken,
    created_at: new Date().toISOString(),
    workflow_count: 0,
  });
});

adminRoute.delete("/clients/:id", requireSession, async (c) => {
  const id = c.req.param("id");
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(id)) {
    return c.json({ error: "Invalid client ID" }, 400);
  }

  const wfs = db.select({ id: schema.workflows.id }).from(schema.workflows).where(eq(schema.workflows.client_id, id)).all();
  for (const wf of wfs) {
    db.delete(schema.runs).where(eq(schema.runs.workflow_id, wf.id)).run();
  }
  db.delete(schema.workflows).where(eq(schema.workflows.client_id, id)).run();
  db.delete(schema.clients).where(eq(schema.clients.id, id)).run();
  return c.json({ ok: true });
});

adminRoute.post("/change-password", requireSession, async (c) => {
  const body = await parseJson(c);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const { new_password } = body;
  if (!new_password || new_password.length < 4 || new_password.length > 128) {
    return c.json({ error: "Password must be between 4 and 128 characters" }, 400);
  }
  const hash = hashPassword(new_password);
  db.update(schema.settings)
    .set({ value: hash })
    .where(eq(schema.settings.key, "admin_password_hash"))
    .run();
  db.delete(schema.sessions).run();
  return c.json({ ok: true });
});

adminRoute.post("/change-username", requireSession, async (c) => {
  const body = await parseJson(c);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  const { new_username } = body;
  const safeUser = sanitize(new_username, 60);
  if (!safeUser) {
    return c.json({ error: "Username is required" }, 400);
  }
  db.update(schema.settings)
    .set({ value: safeUser })
    .where(eq(schema.settings.key, "admin_username"))
    .run();
  return c.json({ ok: true, username: safeUser });
});

adminRoute.get("/watch", async (c) => {
  const token = c.req.query("token");
  if (!token || token.length > 50) return c.json({ error: "Unauthorized" }, 401);

  const session = db.select().from(schema.sessions).where(eq(schema.sessions.token, token)).get();
  if (!session || new Date(session.expires_at) < new Date()) {
    return c.json({ error: "Session expired" }, 401);
  }
  let lastCounter = getGlobalCounter();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(async () => {
        if (closed) { clearInterval(interval); return; }
        const current = getGlobalCounter();
        if (current === lastCounter) return;
        lastCounter = current;

        try {
          const clients = db.select().from(schema.clients).all();
          const result = clients.map((client) => {
            const wfCount = db.select().from(schema.workflows).where(eq(schema.workflows.client_id, client.id)).all().length;
            return { ...client, workflow_count: wfCount };
          });
          const data = `data: ${JSON.stringify(result)}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        } catch {}
      }, 1000);

      c.req.raw.signal?.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

export default adminRoute;
