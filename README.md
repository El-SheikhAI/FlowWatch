<p align="center">
  <img src="https://img.shields.io/badge/built%20for-n8n-4a4a4a?style=flat&logo=n8n&logoColor=white" />
  <img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial-purple?style=flat" />
  <img src="https://img.shields.io/badge/docker-single%20container-blue?style=flat&logo=docker" />
  <img src="https://img.shields.io/badge/status-active-brightgreen?style=flat" />
  <br /><br />
  <img src="https://i.ibb.co/TD6FYNts/readme.png" alt="FlowWatch" width="100%" />
</p>

<br />

# FlowWatch

**Self-hosted status page for n8n workflows.** Give every client their own live dashboard — no n8n login, no screenshots, no weekly "it's working" emails.

<br />

## Why

You run n8n for clients. A workflow fails. The client asks "is everything working?" You open n8n, dig through executions, take a screenshot. Every. Single. Time.

FlowWatch sits next to n8n. Each workflow pings it on success or failure. Your client gets a URL — they see live status dots, run history, and 30-day uptime. You stop explaining and start building.

<br />

## Quick Start

```bash
git clone https://github.com/El-SheikhAI/FlowWatch.git
cd FlowWatch
docker compose up -d
```

Open `http://localhost:3000`. Create your admin account on the first visit.

### Expose with Cloudflare Tunnel (optional)

Create a `.env` file next to `docker-compose.yml`:

```bash
cp .env.example .env
```

Then edit `.env` and paste your Cloudflare tunnel token:

```
CF_TUNNEL_TOKEN=eyJhIjoi...
```

Create a tunnel at [Cloudflare Zero Trust](https://one.dash.cloudflare.com) → Networks → Tunnels. Copy the token, paste it, then `docker compose up -d` again. Add a public hostname pointing to `127.0.0.1:3000`.

<br />

## How it works

```
n8n workflow runs
    ↓
HTTP Request node POSTs to /api/ping
    ↓
FlowWatch detects the workflow (auto-registers on first ping)
    ↓
Client opens their status page → live dots, run history, uptime
```

**One import per client.** Paste the success node into every workflow. Import the error workflow once — it catches failures from ALL your workflows.

<br />

## Features

- **Auto-detection** — paste our node once per workflow. FlowWatch discovers and registers it on first ping. No manual form-filling on our side.
- **Client-facing status page** — dots, uptime bars, run history. Dark & light mode.
- **Per-client isolation** — each client sees only their workflows.
- **Error workflow** — one global error handler catches failures from all workflows.
- **Web dashboard** — create clients, copy tokens, get the exact n8n JSON to import.
- **One container** — Hono.js + React + SQLite. No external database.
- **Security hardened** — CSP headers, rate limiting, input sanitization, 0 npm vulnerabilities.

<br />

## n8n Integration

Every client gets two tokens from the dashboard — a **read token** (share with the client) and a **write token** (paste into n8n).

### Success node

Drop this at the end of any workflow. Copy the JSON from the dashboard's Integration tab, or paste into n8n manually:

```
POST /api/ping
Authorization: Bearer YOUR_WRITE_TOKEN
Content-Type: application/json

{
  "workflow_id": "{{ $workflow.id }}",
  "workflow_name": "{{ $workflow.name }}",
  "status": "{{'success'}}"
}
```

### Error workflow

Import once as a separate workflow. It uses n8n's Error Trigger node to catch failures from all workflows:

```
Error Trigger → HTTP Request → POST /api/ping
                                 status: failed
                                 error_message: {{ $json.execution.error.message }}
```

Full importable JSON is available in the dashboard's Integration tab for each client.

<br />

## Dashboard

The admin dashboard at `http://localhost:3000` lets you:

- **Create clients** — name, slug, auto-generated tokens
- **Copy integration JSON** — success node, error workflow, curl commands per client
- **Open status pages** — one-click link to each client's live dashboard
- **Change account** — username, password from the header dropdown
- **How it works** — built-in guide explaining the integration

<br />

## Status Page (client view)

Clients see at `/:slug?token=READ_TOKEN`:

| Section | Content |
|---------|---------|
| **Status banner** | "All operational" or "X workflows need attention" |
| **Workflow cards** | Name, green/red/gray dot, last run time, success/failed/never-run pill |
| **30-day uptime** | Colored bars: green (success), red (failed), gray (no data) |
| **Recent runs** | Last 10 runs across all workflows with timestamp |

<p align="center">
  <img src="https://i.ibb.co/5gXWFZyS/Geist.png" alt="Client status page - dark mode" width="48%" />
  <img src="https://i.ibb.co/XfgkC5K1/Geist-1.png" alt="Client status page - light mode" width="48%" />
</p>

<br />

## Development

```bash
npm install
npm run dev          # Backend on :3000 with hot reload
npm run build        # Production build (backend + frontend)
```

Frontend: Vite + React in `frontend/`. Backend: Hono.js + SQLite (Drizzle ORM) in `src/`.

<br />

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3000`  | Server port |

<br />

## Security

- `crypto.scryptSync` for password hashing with random salt
- `crypto.timingSafeEqual` for constant-time password comparison
- `crypto.getRandomValues` for all token and password generation
- Rate limiting on `/api/ping` (per-client) and `/api/admin/login` (per-IP)
- Content-Security-Policy, X-Frame-Options, Referrer-Policy headers
- Path traversal protection on static file serving
- 64KB request body limit
- All user input sanitized and length-capped
- Drizzle ORM (parameterized queries) — no SQL injection vectors
- Docker runs as non-root user
- 0 known npm vulnerabilities

<br />

## License

**PolyForm Noncommercial License 1.0.0**

You may use, modify, and distribute this software for **noncommercial purposes only**. Commercial use — including selling, licensing, or offering FlowWatch as a paid service — is prohibited without explicit permission.

See [LICENSE](./LICENSE) for the full terms.

For commercial licensing inquiries: contact@nodatx.com

<br />

---

<p align="center">Built by <a href="https://github.com/El-SheikhAI">El-SheikhAI</a> · <a href="https://nodatx.com">Nodatx</a> · <a href="mailto:mostafa@nodatx.com">mostafa@nodatx.com</a></p>
