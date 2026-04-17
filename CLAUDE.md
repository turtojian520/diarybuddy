# DiaryBuddy — CLAUDE.md

## Project Overview
DiaryBuddy is a full-stack AI-powered diary app built with **Next.js 15 App Router**, **Supabase**, and **Google Gemini 1.5 Flash**.

Users capture quick thought fragments throughout the day, then click "Generate" to let Gemini produce a structured 4-section diary entry.

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

**Local `npm run dev` is only for offline debugging** — not the normal path. If you do need it, use a separate `.env.local` pointing to a non-production Supabase/Notion integration so local sessions don't touch production data.

**Env vars are configured in Vercel**, not in a local `.env.local`, for production. See `Project → Settings → Environment Variables`. The list of required vars is in `.env.local.example`.

---

## Tech Stack
| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| AI | Google Gemini 1.5 Flash (`@google/generative-ai`) |
| Icons | lucide-react |

---

## Key File Paths
```
nextjs-app/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main workspace (fragment input + Generate)
│   │   ├── layout.tsx            # Root layout with TopNav
│   │   ├── globals.css           # Global styles
│   │   ├── api/generate/         # POST route — Gemini AI diary generation
│   │   ├── api/export/notion/    # POST { date } — one-click export to user's Notion DB
│   │   ├── api/notion/           # OAuth + data-source selection endpoints
│   │   │   ├── oauth/start/      # GET — redirect to Notion authorize URL (signed state)
│   │   │   ├── oauth/callback/   # GET — exchange code, store encrypted token
│   │   │   ├── status/           # GET — current connection + selected data source
│   │   │   ├── databases/        # GET — list user's Notion data sources
│   │   │   ├── select-database/  # POST { database_id } — bind data source
│   │   │   └── disconnect/       # POST — remove the Notion connection
│   │   ├── history/page.tsx      # History list of past diary entries
│   │   ├── preview/page.tsx      # Diary preview (4-section display)
│   │   ├── settings/page.tsx     # Templates + Notion integration UI
│   │   ├── login/page.tsx        # Login page (Supabase Auth)
│   │   └── auth/callback/        # Supabase OAuth callback
│   ├── components/
│   │   └── TopNav.tsx            # Top navigation bar
│   └── lib/
│       ├── actions.ts            # Server Actions: Supabase CRUD (fragments & entries)
│       ├── crypto.ts             # AES-256-GCM encrypt/decrypt + HMAC state for OAuth
│       ├── notion/client.ts      # Loads notion_connections row, builds Notion Client
│       ├── notion/markdown-to-blocks.ts  # Converts diary markdown → Notion blocks
│       ├── supabase.ts           # Supabase client (browser) + type definitions
│       ├── supabase/
│       │   ├── browser.ts        # Browser Supabase client
│       │   ├── server.ts         # Server Supabase client (SSR)
│       │   └── middleware.ts     # Auth middleware helper
│       └── utils.ts              # getTodayDate, formatDateDisplay
├── supabase-schema.sql           # SQL to run in Supabase dashboard
└── .env.local.example            # Environment variable template
```

---

## Database Schema
**`diary_fragments`** — raw user inputs grouped by day
- `id`, `content`, `created_at`, `session_date` (YYYY-MM-DD)

**`diary_entries`** — AI-generated structured diary per day
- `id`, `session_date`, `title`, `full_diary`, `key_points`, `mentor_insights`, `action_items`, `generated_at`, `is_highlighted`

**`diary_templates`** — user-defined style templates
- `id`, `user_id`, `name`, `description`, `prompt`, `created_at`, `updated_at`

**`notion_connections`** — per-user Notion OAuth state (1 row per user, unique on `user_id`)
- `id`, `user_id`, `access_token_enc` (AES-256-GCM), `bot_id`, `workspace_id`, `workspace_name`, `workspace_icon`
- `data_source_id`, `data_source_title` — the selected Notion data source (Notion SDK 5.x model)
- `title_prop_name`, `date_prop_name` — resolved from the data source's properties
- `connected_at`, `updated_at`

---

## Core Workflow
1. User types fragments on the main workspace (`/`)
2. Fragments saved to Supabase via `actions.ts` Server Actions
3. User clicks "Generate" → `POST /api/generate`
4. API fetches fragments, builds prompt (with optional template instructions), calls Gemini
5. Structured 4-section diary saved to `diary_entries`
6. User redirected to `/preview` to view the result

---

## Environment Variables (never commit — set in Vercel Project Settings)
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

# Google Gemini
GEMINI_API_KEY

# Notion OAuth (Public integration)
NOTION_OAUTH_CLIENT_ID
NOTION_OAUTH_CLIENT_SECRET
NOTION_OAUTH_REDIRECT_URI   # https://diarybuddy.vercel.app/api/notion/oauth/callback
NOTION_TOKEN_ENCRYPTION_KEY # 32 bytes (base64). Encrypts Notion access tokens in DB.
```
All `.env*` files are in `.gitignore`. In production these live in Vercel → Project → Settings → Environment Variables. The `NOTION_OAUTH_REDIRECT_URI` must exactly match the redirect URI registered in the Notion integration.

---

## Notion Export Feature
- One-click export from `/preview?date=YYYY-MM-DD` — the button calls `POST /api/export/notion { date }`.
- Uses official `@notionhq/client` SDK (≥5.x — data-sources model). Page parent is `{ data_source_id }`, not `database_id`.
- Per-user OAuth: each user connects their own Notion workspace from `/settings`. Access token is AES-256-GCM encrypted before being stored in `notion_connections.access_token_enc`. The encryption key is `NOTION_TOKEN_ENCRYPTION_KEY`.
- The OAuth state is HMAC-signed with the same key (10-min TTL) to prevent CSRF.
- Title and optional Date property names are resolved by `dataSources.retrieve` when the user selects a data source, and cached on the row.
- Markdown-to-blocks converter supports `heading_1/2/3`, `paragraph`, `bulleted_list_item`, `numbered_list_item`, `to_do` (from `- [ ]`), `quote`, `divider`, plus inline `**bold**` / `*italic*` / `` `code` ``. Long text is chunked at 2000 chars; children over 100 blocks are appended in chunks.

---

## Session Date Logic
- The workspace uses `sessionStorage` to lock the current date at session start, preventing midnight from silently flipping to a new day.
- URL param `?date=YYYY-MM-DD` overrides the session date (used by History page to re-open past entries).

---

## GitHub Repository
`https://github.com/turtojian520/diarybuddy.git` — branch: `main`
