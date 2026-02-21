# Task board (vault-backed)

The task board in OpenClaw Studio shows tasks stored in an Obsidian vault. Each task is one markdown file with YAML frontmatter. The board polls the vault so edits from you or any agent appear without reload.

## Configuration

- **Vault path**: Set in Studio (Task board page when not configured) or via `OPENCLAW_TASK_BOARD_VAULT_PATH`. Use an absolute path or `~` for home (e.g. `~/Documents/MyVault`).
- **Task folder**: Tasks live under `{vault}/TaskBoard/`. That folder is created automatically when the first task is added via the API.

## Task format

One markdown file per task in `TaskBoard/`. Filename: `{slug}.md` (e.g. `fix-login-flow.md`).

### Frontmatter (YAML)

| Field       | Required | Description |
|------------|----------|-------------|
| `title`    | Yes      | Short title. |
| `status`   | No       | `todo`, `in_progress`, `blocked`, or `done`. Default: `todo`. |
| `assignee` | No       | `"me"` for you, or an agent id/name. Default: `me`. |
| `id`       | No       | Stable id; if omitted, the filename stem is used. |
| `createdAt` | No      | ISO 8601 string. |
| `updatedAt` | No      | ISO 8601 string. |
| `description` | No     | Optional short description. |

Body: freeform markdown for notes.

### Example

```markdown
---
title: Fix login flow
status: in_progress
assignee: me
createdAt: "2026-02-20T12:00:00Z"
updatedAt: "2026-02-20T14:30:00Z"
---

- [ ] Add rate limiting
- [ ] Update tests
```

## How agents can add or update tasks

Any process with access to the same vault can update the board.

### Option 1: Write files in the vault

1. **Add a task**: Create a new `.md` file in `{vault}/TaskBoard/` with the frontmatter above. Use a safe filename (e.g. slug from title).
2. **Update a task**: Edit the existing `.md` (frontmatter and/or body). Change `status` or `assignee` as needed; set `updatedAt` to current time if you like.

No Studio API required. The board will show changes on the next poll (every few seconds).

### Option 2: Use the Studio API

If the agent cannot write to the vault directly (e.g. runs elsewhere), it can call the Studio API when the app is reachable (e.g. localhost):

- **Create**: `POST /api/task-board/tasks` with body `{ "title": "...", "status": "todo", "assignee": "me" }`. Returns the created task (including `id`).
- **Update**: `PATCH /api/task-board/tasks/:id` with body `{ "title": "...", "status": "in_progress", "assignee": "agent-1" }`.
- **Delete**: `DELETE /api/task-board/tasks/:id`. Returns 204 on success.

Same-origin or localhost only; no auth beyond normal Studio access.

## Task management (UI)

In the Task board page you can:

- **Move a task**: Drag a card by its handle into another column. The task’s status is updated via `PATCH` and the board refetches.
- **Edit a task**: Click the edit icon on a card to open the edit modal. Change title, status, or assignee and save (`PATCH`), or delete the task (confirm, then `DELETE`).
- **Create a task**: Use **New task** and the create modal (`POST`).

Agents use the same API: create/update/delete via the endpoints above or by writing/deleting files in the vault. Last write wins if user and agent both change a task.

## Board behavior

- **Columns**: Todo, In progress, Blocked, Done.
- **Polling**: When the Task board page is open, Studio fetches `GET /api/task-board` every 8 seconds.
- **Refresh**: Use the Refresh button for an immediate reload.
