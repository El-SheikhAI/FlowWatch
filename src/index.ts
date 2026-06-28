import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { readFileSync, existsSync } from "fs";
import { join, resolve, normalize } from "path";
import pingRoute from "./routes/ping.js";
import statusRoute from "./routes/status.js";
import adminRoute from "./routes/admin.js";
import { runMigrations } from "./db/migrate.js";
import { db, schema } from "./db/client.js";
import { lt, sql } from "drizzle-orm";

runMigrations();

setInterval(() => {
  try {
    db.delete(schema.sessions).where(lt(schema.sessions.expires_at, sql`datetime('now')`)).run();
  } catch {}
}, 60 * 60 * 1000);

function isPathSafe(base: string, target: string): boolean {
  const normalized = target.replace(/^\/+/, "").replace(/\\/g, "/");
  const baseNorm = normalize(resolve(base)).replace(/\\/g, "/");
  const targetNorm = normalize(resolve(base, normalized)).replace(/\\/g, "/");
  return targetNorm === baseNorm || targetNorm.startsWith(baseNorm + "/");
}

const MAX_BODY_SIZE = 64 * 1024;
const app = new Hono();

app.use("*", async (c, next) => {
  const cl = c.req.header("content-length");
  if (cl && parseInt(cl) > MAX_BODY_SIZE) {
    return new Response("Payload too large", { status: 413 });
  }
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Referrer-Policy", "no-referrer");
  c.res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://i.ibb.co; connect-src 'self';"
  );
  c.res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  await next();
});

app.route("/api/ping", pingRoute);
app.route("/api/status", statusRoute);
app.route("/api/admin", adminRoute);

app.get("/health", (c) => c.json({ status: "ok" }));

const frontendDir = join(process.cwd(), "dist", "frontend");
const indexPath = join(frontendDir, "index.html");

const mimeTypes: Record<string, string> = {
  js: "application/javascript",
  css: "text/css",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  woff: "font/woff",
  woff2: "font/woff2",
};

app.get("*", async (c) => {
  const url = new URL(c.req.url);
  const pathname = url.pathname;

  if (pathname.startsWith("/assets/")) {
    if (!isPathSafe(join(process.cwd(), "dist", "frontend"), pathname)) {
      return new Response("Forbidden", { status: 403 });
    }
    const filePath = join(process.cwd(), "dist", "frontend", pathname);
    if (existsSync(filePath)) {
      const ext = pathname.split(".").pop()?.toLowerCase();
      const body = readFileSync(filePath);
      return new Response(body, {
        headers: {
          "Content-Type": mimeTypes[ext ?? ""] ?? "text/plain",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
    return c.notFound();
  }

  const staticFile = pathname.match(/\/(logo-[a-z-]+\.(png|ico|svg))$/);
  if (staticFile) {
    const filePath = join(process.cwd(), "dist", "frontend", staticFile[1]);
    if (existsSync(filePath)) {
      const body = readFileSync(filePath);
      const ext = staticFile[2];
      return new Response(body, {
        headers: {
          "Content-Type": mimeTypes[ext] ?? "text/plain",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
    return c.notFound();
  }

  if (!existsSync(indexPath)) {
    return c.text(
      "Frontend not built. Run `npm run build:frontend` first.",
      404
    );
  }

  const html = readFileSync(indexPath, "utf-8");
  return c.html(html);
});

const port = parseInt(process.env.PORT ?? "3000");

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`FlowWatch running on http://localhost:${info.port}`);
});
