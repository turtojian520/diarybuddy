# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
DiaryBuddy is an AI diary app: users jot fragments through the day, then click **Generate** to have Gemini produce a structured 4-section diary entry. Entries can be one-click exported to each user's own Notion workspace.

Stack: **Next.js 16 App Router (React 19) + TypeScript + Tailwind v4 + Supabase (Auth + Postgres) + Google Gemini 2.5 Flash + Notion OAuth (SDK ≥5, data-sources model)**.

`AGENTS.md` is a single-line `@CLAUDE.md` redirect — this file is the canonical instructions.

---

## Deployment & Workflow — cloud-first, no local dev loop

The project is deployed on **Vercel**. All code changes go through GitHub → Vercel auto-deploy; **do not run `npm run dev` locally** as part of the normal workflow.

- Production URL: **https://diarybuddy.vercel.app**
- GitHub repo: `https://github.com/turtojian520/diarybuddy.git`, branch `main`
- Hosting: Vercel (auto-deploys on every push to `main`)
- Supabase project: runs the SQL from `supabase-schema.sql` (execute in Supabase SQL Editor when schema changes)

**Standard change workflow:**
1. Edit files in this repo.
2. `git add` + `git commit` + `git push origin main`.
3. Wait ~1–2 min for Vercel to auto-deploy.
4. Verify on `https://diarybuddy.vercel.app`.

**Auto-commit & push policy (standing user authorization):** after any code change in this repo, automatically `git add` the modified files, create a commit with a clear message, and `git push origin main` — without asking for confirmation each time. This applies to every change unless the user explicitly says otherwise for a specific change. Still: never `git add -A`/`git add .` (stage files by name), never force-push, never `--no-verify`, never commit `.env*` or other secrets.

**Env vars are configured in Vercel**, not in a local `.env.local`, for production. See `Project → Settings → Environment Variables`. The list of required vars is in `.env.local.example`. All `.env*` files are in `.gitignore`.

**Local `npm run dev` is only for offline debugging** — not the normal path. If you do need it, point a separate `.env.local` at a non-production Supabase/Notion integration so local sessions don't touch production data.

---

## Commands

Run from the repo root. `package.json` is at the root — there is **no `nextjs-app/` subfolder** despite `package.json`'s `"name": "nextjs-app"`.

```bash
npm install       # install deps
npm run dev       # next dev (offline debugging only — prefer Vercel preview)
npm run build     # next build — use this to verify a change compiles + type-checks
npm run start     # next start (run the production build)
npm run lint      # eslint (flat config in eslint.config.mjs, using eslint-config-next)
```

There is **no test framework configured** (no Jest/Vitest/Playwright). "Running tests" means `npm run build` for type/lint safety plus manual verification on the Vercel deploy. Don't add a test runner unless the user explicitly asks.

TypeScript path alias: `@/*` → `./src/*` (see `tsconfig.json`).

---

## Architecture — the big picture

### Auth boundary lives in `src/middleware.ts`
Every request except `/login`, `/auth/callback`, and static assets is gated: the middleware calls `supabase.auth.getUser()`, refreshes the session cookie, and redirects unauthenticated users to `/login`. Because of this, **API route handlers and server actions can assume a logged-in user exists** — but they still re-check `supabase.auth.getUser()` before doing sensitive work (pattern used in `/api/generate` and `/api/export/notion`). RLS on every table also enforces per-user isolation at the DB layer.

### Three Supabase client factories — don't mix them up
- `src/lib/supabase.ts` — plain browser client for legacy/client-side reads.
- `src/lib/supabase/browser.ts` — SSR-aware browser client.
- `src/lib/supabase/server.ts` — `createClient()` for Server Components, Server Actions, and route handlers. Reads/writes cookies via `next/headers`.
- `src/lib/supabase/middleware.ts` — only for `middleware.ts` (needs the `NextRequest`/`NextResponse` pair).

Server-side code should import from `@/lib/supabase/server`. All CRUD for fragments/entries/templates is centralized in `src/lib/actions.ts` (`'use server'`).

### Daily capture → AI generation pipeline
1. User types fragments on `/` → `addFragment` server action → `diary_fragments` row keyed by `session_date` (YYYY-MM-DD, local time via `getTodayDate()` in `src/lib/utils.ts`).
2. **Session date lock**: the workspace stores the session's date in `sessionStorage` so a session started before midnight doesn't silently flip to the next day. `?date=YYYY-MM-DD` in the URL overrides it (used by the History page to re-open past days).
3. Click **Generate** → `POST /api/generate { date }` → fetches fragments, optionally injects the user's first template `prompt` as a style instruction, calls Gemini (`gemini-2.5-flash`), parses, saves to `diary_entries` (upsert on `session_date`), redirects to `/preview?date=...`.

### Gemini output is delimiter-parsed, not JSON
`src/app/api/generate/route.ts` builds a Chinese-language prompt that **requires** the model to emit four sections separated by literal markers:

```
---FULL_DIARY---    ---KEY_POINTS---    ---MENTOR_INSIGHTS---    ---ACTION_ITEMS---
```

`parseResponse` uses regex to slice these into the four columns of `diary_entries` (`full_diary`, `key_points`, `mentor_insights`, `action_items`) and extracts `title` from the `# 📝 <date> 完整日记：<title>` heading of `full_diary`. If you change the prompt's heading or delimiter format, update `parseResponse` in lockstep — silent title/section loss is the failure mode.

The prompt and the default seeded templates (`DEFAULT_TEMPLATES` in `actions.ts`) are written in Chinese. The emitted diary is Chinese-language markdown with emoji headings. Don't "translate" these casually — they are the product's voice.

### Notion export — per-user OAuth, not a shared integration
- `@notionhq/client` v5 uses the **data-sources** model: pages are created with `parent: { data_source_id }`, not `{ database_id }`. The codebase is already on this model; don't regress it.
- Each user completes their own OAuth flow from `/settings`. Endpoints in `src/app/api/notion/`:
  - `oauth/start` → redirect to Notion authorize URL; `state` is HMAC-signed (10-min TTL) via `signState`/`verifyState` in `src/lib/crypto.ts`.
  - `oauth/callback` → exchange code, AES-256-GCM encrypt the access token with `encryptSecret`, upsert into `notion_connections.access_token_enc`.
  - `databases` → list the user's data sources; `select-database` → `dataSources.retrieve` to resolve and cache `title_prop_name` and optional `date_prop_name` on the row.
  - `status`, `disconnect` → UI helpers.
- `NOTION_TOKEN_ENCRYPTION_KEY` (32 bytes, base64) is **both** the AES key for tokens **and** the HMAC key for OAuth state. Rotating it invalidates every stored Notion token and any in-flight OAuth state.
- Export: `/preview` calls `POST /api/export/notion { date }` → `buildDiaryBlocks` (markdown-to-Notion-blocks converter) → `pages.create` with `parent.data_source_id`. Notion caps `children` at 100 per call, so the code appends overflow via `blocks.children.append` in chunks of `NOTION_CHILDREN_PAGE_LIMIT` (100). Long text is chunked at 2000 chars. The converter handles `heading_1/2/3`, `paragraph`, `bulleted_list_item`, `numbered_list_item`, `to_do` (from `- [ ]`), `quote`, `divider`, plus inline `**bold**` / `*italic*` / `` `code` ``.

---

## Database Schema (see `supabase-schema.sql`)
All tables: `user_id uuid references auth.users(id) on delete cascade`, **RLS enabled**, policies restrict to `auth.uid() = user_id`. `user_id` defaults to `auth.uid()` so inserts don't need to set it explicitly.

- **`diary_fragments`** — `id, content, created_at, session_date` (YYYY-MM-DD)
- **`diary_entries`** — `id, session_date, title, full_diary, key_points, mentor_insights, action_items, generated_at, is_highlighted`. Unique on `session_date` per user (upsert target).
- **`diary_templates`** — `id, user_id, name, description, prompt, created_at, updated_at`. Only the **first** template (oldest `created_at`) is injected into the Gemini prompt today — see `/api/generate`.
- **`notion_connections`** — one row per user (`unique(user_id)`). Stores encrypted token + resolved `data_source_id`, `data_source_title`, `title_prop_name`, `date_prop_name`.

---

## Environment Variables (set in Vercel Project Settings, never commit)
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

# Google Gemini
GEMINI_API_KEY

# Notion OAuth (Public integration)
NOTION_OAUTH_CLIENT_ID
NOTION_OAUTH_CLIENT_SECRET
NOTION_OAUTH_REDIRECT_URI   # must exactly match the integration's registered redirect
NOTION_TOKEN_ENCRYPTION_KEY # 32 bytes, base64 — AES key AND HMAC key for OAuth state
```

Generate the encryption key with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Directory map (source of truth)

```
/                               # repo root — package.json, tsconfig, eslint, supabase-schema.sql live here
├── src/
│   ├── middleware.ts           # Supabase auth guard (redirects unauth → /login)
│   ├── app/
│   │   ├── page.tsx            # Workspace (fragment input + Generate)
│   │   ├── history/            # Past entries list
│   │   ├── preview/            # 4-section diary view + Notion export button
│   │   ├── settings/           # Templates CRUD + Notion connect UI
│   │   ├── login/  auth/callback/   # Supabase Auth
│   │   └── api/
│   │       ├── generate/       # POST — Gemini call + parse + save
│   │       ├── export/notion/  # POST { date } — create Notion page
│   │       └── notion/         # OAuth + data-source selection endpoints
│   ├── components/TopNav.tsx
│   └── lib/
│       ├── actions.ts          # 'use server' — fragments/entries/templates CRUD + DEFAULT_TEMPLATES
│       ├── crypto.ts           # AES-256-GCM + HMAC-signed state (shared key)
│       ├── utils.ts            # getTodayDate, formatDateDisplay
│       ├── supabase.ts         # browser client + TS types for rows
│       ├── supabase/{browser,server,middleware}.ts
│       └── notion/{client,markdown-to-blocks}.ts
├── supabase-schema.sql         # run in Supabase SQL Editor on schema changes
└── .env.local.example
```
