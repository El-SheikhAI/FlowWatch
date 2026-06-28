import { Hono } from "hono";
import { db, schema } from "../db/client.js";
import { eq, and, desc } from "drizzle-orm";
import {
  computeWorkflowStatus,
  computeDayStatuses,
} from "../lib/computeStatus.js";
import type { StatusResponse, WorkflowStatusItem, RecentRun } from "../types.js";
import { clientWatchers, getChangeCounter } from "../lib/events.js";

const statusRoute = new Hono();

statusRoute.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  if (!slug || slug.length > 60 || !/^[a-z0-9-]+$/.test(slug)) {
    return c.json({ error: "Invalid slug" }, 400);
  }

  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization" }, 401);
  }

  const readToken = auth.slice(7);
  if (!readToken) {
    return c.json({ error: "Missing or invalid authorization" }, 401);
  }
  const client = db
    .select()
    .from(schema.clients)
    .where(
      and(
        eq(schema.clients.slug, slug),
        eq(schema.clients.read_token, readToken)
      )
    )
    .get();

  if (!client) {
    return c.json({ error: "Client not found or invalid token" }, 404);
  }

  const wfs = db
    .select()
    .from(schema.workflows)
    .where(eq(schema.workflows.client_id, client.id))
    .all();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const workflows: WorkflowStatusItem[] = wfs.map((wf) => {
    const allRuns = db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.workflow_id, wf.id))
      .orderBy(desc(schema.runs.executed_at))
      .all();

    const lastRun = allRuns[0] ?? null;
    const status = computeWorkflowStatus(
      lastRun
        ? {
            status: lastRun.status,
            executed_at: lastRun.executed_at!,
          }
        : null
    );

    const recent30d = allRuns.filter(
      (r) => r.executed_at && new Date(r.executed_at) >= thirtyDaysAgo
    ) as { status: string; executed_at: string }[];

    const uptime = recent30d.length === 0 ? 100
      : Math.round((recent30d.filter((r) => r.status === "success").length / recent30d.length) * 1000) / 10;

    const recent_runs: RecentRun[] = allRuns.slice(0, 10).map((r) => ({
      status: r.status,
      duration_ms: r.duration_ms,
      executed_at: r.executed_at!,
      workflow_name: wf.name,
    }));

    return {
      id: wf.id,
      name: wf.name,
      description: wf.description,
      status,
      last_run_at: lastRun?.executed_at ?? null,
      last_run_duration_ms: lastRun?.duration_ms ?? null,
      last_run_status: lastRun?.status ?? null,
      last_error: lastRun?.error_message ?? null,
      uptime_30d: uptime,
      day_statuses: computeDayStatuses(recent30d),
      recent_runs,
    };
  });

  const allRecentRuns: RecentRun[] = [];
  for (const wf of workflows) {
    allRecentRuns.push(...wf.recent_runs);
  }
  allRecentRuns.sort(
    (a, b) =>
      new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime()
  );

  const response: StatusResponse = {
    client: client.name,
    generated_at: new Date().toISOString(),
    workflows,
  };

  return c.json({
    ...response,
    all_recent_runs: allRecentRuns.slice(0, 10),
  });
});

statusRoute.get("/:slug/watch", async (c) => {
  const slug = c.req.param("slug");
  if (!slug || slug.length > 60 || !/^[a-z0-9-]+$/.test(slug)) {
    return c.json({ error: "Invalid slug" }, 400);
  }

  const token = c.req.query("token");
  if (!token || token.length > 50) return c.json({ error: "Unauthorized" }, 401);

  const client = db.select().from(schema.clients)
    .where(and(eq(schema.clients.slug, slug), eq(schema.clients.read_token, token)))
    .get();
  if (!client) return c.json({ error: "Client not found" }, 404);

  let lastCounter = getChangeCounter(client.id);
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(async () => {
        if (closed) { clearInterval(interval); return; }
        const current = getChangeCounter(client.id);
        if (current === lastCounter) return;
        lastCounter = current;

        try {
          const res = await fetchData(client);
          const data = `data: ${JSON.stringify(res)}\n\n`;
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

async function fetchData(client: any) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const wfs = db.select().from(schema.workflows)
    .where(eq(schema.workflows.client_id, client.id)).all();

  const workflows: WorkflowStatusItem[] = wfs.map((wf) => {
    const allRuns = db.select().from(schema.runs)
      .where(eq(schema.runs.workflow_id, wf.id))
      .orderBy(desc(schema.runs.executed_at)).all();
    const lastRun = allRuns[0] ?? null;
    const status = computeWorkflowStatus(lastRun ? { status: lastRun.status, executed_at: lastRun.executed_at! } : null);
    const recent30d = allRuns.filter((r) => r.executed_at && new Date(r.executed_at) >= thirtyDaysAgo) as { status: string; executed_at: string }[];
    const uptime = recent30d.length === 0 ? 100 : Math.round((recent30d.filter((r) => r.status === "success").length / recent30d.length) * 1000) / 10;
    return {
      id: wf.id, name: wf.name, description: wf.description, status,
      last_run_at: lastRun?.executed_at ?? null, last_run_duration_ms: lastRun?.duration_ms ?? null,
      last_run_status: lastRun?.status ?? null, last_error: lastRun?.error_message ?? null,
      uptime_30d: uptime, day_statuses: computeDayStatuses(recent30d),
      recent_runs: allRuns.slice(0, 10).map((r) => ({ status: r.status, duration_ms: r.duration_ms, executed_at: r.executed_at!, workflow_name: wf.name })),
    };
  });

  const allRecentRuns: RecentRun[] = [];
  for (const wf of workflows) allRecentRuns.push(...wf.recent_runs);
  allRecentRuns.sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime());

  return { client: client.name, generated_at: new Date().toISOString(), workflows, all_recent_runs: allRecentRuns.slice(0, 10) };
}

export default statusRoute;
