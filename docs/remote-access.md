# Remote Access, VPS Deployments, and Troubleshooting

This doc focuses on getting OpenClaw Studio working when Studio and the OpenClaw Gateway are not on the same machine as your browser (for example: Studio on a VPS, used from a laptop/phone).

## Connection Model (Two Network Paths)

Studio does not have your browser connect directly to the upstream Gateway URL.

There are two separate network paths:

1. Browser -> Studio
   - HTTP for the UI, plus a WebSocket to Studio at `/api/gateway/ws`.
2. Studio -> OpenClaw Gateway (upstream)
   - A second WebSocket connection opened by the Studio Node server to the configured upstream Gateway URL.

If you want to reason about failures, always ask: is the problem Browser->Studio, or Studio->Gateway?

## What “localhost” Means

The “Upstream Gateway URL” is dialed by the machine running Studio.

- If Studio runs on your laptop: `ws://localhost:18789` means “gateway on your laptop”.
- If Studio runs on a VPS: `ws://localhost:18789` means “gateway on the VPS”, even when you open Studio from a phone.

## Where Studio Stores the Upstream URL and Token

Studio persists upstream connection settings on the Studio host:

- Settings file: `<state dir>/openclaw-studio/settings.json`
- Default `<state dir>`: `~/.openclaw` (with legacy fallbacks to `~/.moltbot` and `~/.clawdbot`)
- Override state dir: `OPENCLAW_STATE_DIR`

The UI reads/writes these via `GET/PUT /api/studio`. If you “set it once” in the UI, those values will be used on the next run on that same Studio host.

## Recipes

### A) Studio on Your Laptop, Gateway on a Remote Host

In Studio, set:

- Upstream Gateway URL: something reachable from your laptop
- Upstream Token: `openclaw config get gateway.auth.token` (on the gateway host)

Options:

1. Direct port (only if you intentionally expose it)
   - Upstream URL: `ws://<gateway-host>:18789`
   - Make sure your laptop can reach that host/port.

2. Tailscale Serve for the gateway (recommended over public exposure)
   - On the gateway host, confirm current config:
     - `tailscale serve status`
   - Configure HTTPS proxying to the gateway’s local port (example):
     - `tailscale serve --yes --bg --https 443 http://127.0.0.1:18789`
   - In Studio, use:
     - Upstream URL: `wss://<gateway-host>.ts.net`

3. SSH tunnel
   - From your laptop:
     - `ssh -L 18789:127.0.0.1:18789 user@<gateway-host>`
   - In Studio:
     - Upstream URL: `ws://localhost:18789`

### B) Studio + Gateway on the Same VPS (Use From Laptop/Phone)

This is the simplest remote setup: keep the gateway private on the VPS and only expose Studio.

1. On the VPS, run the gateway bound to loopback:
   - `openclaw gateway run --bind loopback --port 18789 --verbose`

2. On the VPS, expose Studio over HTTPS on your tailnet (example: 443):
   - Check current config:
     - `tailscale serve status`
   - Add a serve rule (example):
     - `tailscale serve --yes --bg --https 443 http://127.0.0.1:3000`

Notes:
- `tailscale serve reset` clears all Serve config. Avoid it unless you are intentionally wiping existing rules.
- If you reverse-proxy Studio under a path prefix like `/studio`, Next.js assets will usually break unless you configure `basePath` and rebuild. Prefer serving Studio at `/`.

3. From your laptop/phone, open:
   - `https://<your-vps>.ts.net`

4. In Studio, set:
   - Upstream URL: `ws://localhost:18789`
   - Token: `openclaw config get gateway.auth.token` (on the VPS)

Optional (only if you need non-Studio clients to reach the gateway):
- Expose the gateway too (example: 8443):
  - `tailscale serve --yes --bg --https 8443 http://127.0.0.1:18789`
  - Upstream URL for Studio (or other clients): `wss://<your-vps>.ts.net:8443`

### C) Studio on a VPS, Gateway Somewhere Else

In this topology, Studio must be able to reach the gateway from the VPS network.

1. Ensure the gateway is reachable from the VPS:
   - Either over the public internet (not recommended without TLS and strict auth),
   - or over Tailscale (`wss://...` via Serve),
   - or via a private network.

2. In Studio, set:
   - Upstream URL: `ws://<gateway-host>:18789` (plain)
   - or `wss://<gateway-host>...` (TLS)

## Troubleshooting

### Identify Which Side Is Broken

- If the Studio page does not load: Browser->Studio (HTTP) problem.
- If the Studio page loads but “Connect” fails: likely Studio->Gateway (upstream) problem.

### Proxy Error Codes

Studio’s WS bridge can surface upstream problems as specific codes (shown in error messages and used by retry logic):

- `studio.gateway_url_missing`: upstream URL not configured on the Studio host.
- `studio.gateway_token_missing`: upstream token not configured on the Studio host.
- `studio.gateway_url_invalid`: upstream URL is malformed (must be `ws://...` or `wss://...`).
- `studio.settings_load_failed`: Studio host failed to read settings from disk.
- `studio.upstream_error`: Studio could not establish the upstream WebSocket.
- `studio.upstream_closed`: the upstream gateway closed the connection.

### Common Symptoms

- TLS errors like `EPROTO` / “wrong version number”
  - Usually: you used `wss://...` to an endpoint that is only serving plain HTTP/WS.
  - Fix: use `ws://...` for plain endpoints, or put the gateway behind HTTPS (for example Tailscale Serve) and use `wss://...`.

- Assets 404 / blank page when reverse-proxying under `/studio`
  - Studio is not configured with a Next.js `basePath` by default.
  - Fix: serve it at `/`, or configure `basePath` in `next.config.ts` and rebuild.

- 401 “Studio access token required”
  - `STUDIO_ACCESS_TOKEN` is enabled on the Studio server.
  - Fix: open `/?access_token=...` once to set the cookie, then reload.

## Optional Hardening (Non-Tailnet Deployments)

If Studio is reachable beyond a private network, consider enabling the built-in access gate:

- Set `STUDIO_ACCESS_TOKEN` on the Studio server (environment variable).
- Open Studio once at `/?access_token=<token>` to set a cookie.

This gate blocks `/api/*` and the `/api/gateway/ws` upgrade path unless the cookie matches.

