![Home screen](home-screen.png)

# OpenClaw Studio

[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/VEpdKJ9e)

OpenClaw Studio is a Next.js dashboard for managing OpenClaw agents via the OpenClaw Gateway (WebSocket).

## How Studio Connects (Read This If You Use A Phone / Remote Host)

There are **two separate network paths** involved:

1. **Your browser -> Studio** (HTTP) at `http://<studio-host>:3000`
2. **Your browser -> Studio** (WebSocket) at `ws(s)://<studio-host>:3000/api/gateway/ws`, then **Studio -> OpenClaw Gateway** (WebSocket) at the configured **Gateway URL**

Important consequences:
- The upstream **Gateway URL is dialed from the Studio host**, not from your browser device.
- `ws://localhost:18789` means “connect to a gateway on the same machine as Studio”.
  - If Studio is running on a VPS, `localhost` is the VPS.
  - If Studio is running on your laptop and you browse it from your phone, `localhost` is still your laptop (the Studio host).
- Studio **persists** the Gateway URL/token under `~/.openclaw/openclaw-studio/settings.json`. Once set in the UI, this will be used on future runs and will override the default `NEXT_PUBLIC_GATEWAY_URL`.
- If you access Studio over `https://`, the browser-side bridge is `wss://.../api/gateway/ws`. The upstream Gateway URL can be `ws://...` (local/private) or `wss://...` (recommended for remote gateways).

## Requirements

- Node.js 18+ (LTS recommended)
- OpenClaw Gateway running (local or remote)
- Tailscale (optional, recommended for tailnet access)

## Quick start

### Start the gateway (required)

If you don't already have OpenClaw installed:
```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

Start a gateway (foreground):
```bash
openclaw gateway run --bind loopback --port 18789 --verbose
```

Helpful checks:
```bash
openclaw gateway probe
openclaw config get gateway.auth.token
```

### Remote access (VPS, Tailscale, SSH)

For remote access recipes and troubleshooting, see `docs/remote-access.md`.

### Install + run Studio (recommended)
```bash
npx -y openclaw-studio@latest
cd openclaw-studio
npm run dev
```

Open http://localhost:3000 and set:
- Token: `openclaw config get gateway.auth.token`
- Gateway URL: `ws://localhost:18789` (gateway runs on the same machine as Studio)
- Gateway URL: `wss://gateway-host.your-tailnet.ts.net` (remote gateway via Tailscale Serve)
- Gateway URL: `ws://gateway-host:18789` (remote gateway reachable from the Studio host)

Notes:
- If the gateway rejects insecure origins (for example `INVALID_REQUEST ... control ui requires HTTPS or localhost (secure context)`), use `ws://localhost:...` for local gateways or `wss://...` for remote gateways.
- When Studio is on a VPS, `ws://localhost:18789` connects to the VPS-local gateway even if you're browsing Studio from a phone/tablet.

### Install (manual)
```bash
git clone https://github.com/grp06/openclaw-studio.git
cd openclaw-studio
npm install
npm run dev
```

## Configuration

Paths and key settings:
- OpenClaw config: `~/.openclaw/openclaw.json` (or `OPENCLAW_CONFIG_PATH` / `OPENCLAW_STATE_DIR`)
- Studio settings: `~/.openclaw/openclaw-studio/settings.json`
- Default gateway URL: `ws://localhost:18789` (override via Studio Settings or `NEXT_PUBLIC_GATEWAY_URL`)

## Cron jobs in Agent Settings

- Open an agent and go to **Settings -> Cron jobs**.
- If no jobs exist, use the empty-state **Create** button.
- If jobs already exist, use the header **Create** button.
- The modal is agent-scoped and walks through template selection, task text, schedule, and review.
- Submitting creates the job via gateway `cron.add` and refreshes that same agent's cron list.

## Agent creation workflow

- Click **New Agent** in the fleet sidebar.
- Pick a **Preset bundle** (for example Research Analyst, PR Engineer, Autonomous Engineer, Growth Operator, Coordinator, or Blank).
- Each preset card shows capability chips and risk level (`Exec`, `Internet`, `File tools`, `Sandbox`, `Heartbeat`, plus caveats when relevant).
- Optionally override the **Control level** (Conservative, Balanced, or Autopilot).
- Add optional customization (agent name, first task, notes, and advanced control toggles).
- Review the behavior summary, then create.
- Studio compiles this setup into per-agent artifacts only:
  - per-agent sandbox/tool overrides in `agents.list[]`
  - per-agent exec approval policy in `exec-approvals.json`
  - core agent files (`AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `TOOLS.md`, `HEARTBEAT.md`, `MEMORY.md`)
  - additive tool policy (`tools.alsoAllow`) so preset selections do not remove base profile tools
- If setup fails after `agents.create`, Studio keeps the created agent, stores a pending setup in tab-scoped session storage keyed by gateway URL, and shows `Retry setup` / `Discard pending setup` in chat.
- Auto-retry is deduplicated across reconnect and restart flows, so one pending setup is applied at most once at a time per agent.
- Studio does not modify global defaults during creation.

## Exec approvals in chat

- When a run requires exec approval, chat shows an **Exec approval required** card with:
  - command preview
  - host and cwd
  - expiration timestamp
- Resolve directly in chat with:
  - **Allow once**
  - **Always allow**
  - **Deny**
- The fleet row displays **Needs approval** while approvals are pending for that agent.
- Expired approvals are pruned automatically, so stale cards and stale **Needs approval** badges clear without a manual resolve event.

## Troubleshooting

See `docs/remote-access.md` for VPS/Tailscale/SSH recipes and a troubleshooting checklist (including TLS `EPROTO` errors, path-prefix asset issues, and missing-token errors).

## Architecture

See `ARCHITECTURE.md` for details on modules and data flow.
