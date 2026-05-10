# kali-v0

agentic context layer for nonprofits. one chat interface, eleven SaaS tools unified, plain-english queries across the whole stack. v1 prototype for HackDavis 2026.

> read [`data/v1-prototype-scope.md`](./data/v1-prototype-scope.md) for the full build spec. that's the contract.

---

## the demo flow

**Public demo** (judges, no signup): `http://localhost:3000/chat?demo=rivertown` — drops you into the chat dashboard with the canonical Rivertown Community Foundation tenant. All 13 connectors visible, all the wow-queries work end-to-end.

**Real onboarding flow** (customer-discovery prop): `http://localhost:3000/` → click "Get started" → 6-step wizard:
1. **Sign up** — email + password (real Supabase auth)
2. **Profile** — your nonprofit's name, EIN, mission, budget bracket
3. **Stack** — pick which of the 13 SaaS tools you actually use (min 3)
4. **Connect** — walk the mock OAuth flow for each
5. **Drop data** — drag in any files; theater progress bar + canned record counts
6. **Welcome** — animated stats + finalize → land on `/dashboard`

`/dashboard` shows: personalized greeting, 4 stat cards, recent activity feed, sources grid (only the ones you picked), and an "Ask Kali" composer that hands off to `/chat?seed=<question>`.

After onboarding, `/chat` and `/dashboard` are gated — visit them while logged-out and you bounce to `/onboarding`.

---

## first time setup (read this carefully)

if you've barely touched a terminal — that's fine. follow these steps in order. each fenced block is one command. paste it, hit enter, wait for it to finish.

### 1. install the tools you need

#### on a mac

open the **Terminal** app (cmd+space → type "terminal" → enter).

```sh
# 1. install homebrew (a tool installer for mac) if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. install git
brew install git

# 3. install bun (a fast js runtime + package manager — we use this instead of npm)
curl -fsSL https://bun.sh/install | bash
```

after bun installs, **close terminal and reopen it** so it picks up bun.

verify it all works:

```sh
git --version
bun --version
```

if both print version numbers, you're good.

### 2. clone the repo

```sh
cd ~/Documents
git clone https://github.com/stephenhungg/kali-v0.git
cd kali-v0
```

### 3. install dependencies

```sh
bun install
```

downloads everything the project needs. ~30 seconds first time.

### 4. set up Supabase (for the onboarding flow + chat history)

The 6-step onboarding wizard at `/onboarding` uses real Supabase auth, and chat history is persisted to Supabase Postgres so users see their past conversations on each visit. Without Supabase, you can still demo `/chat?demo=rivertown` — auth + history just fall back to in-memory.

1. Create a free project at [app.supabase.com](https://app.supabase.com).
2. **Disable email confirmation** for the demo: project → Auth → Providers → Email → toggle "Confirm email" off. (Otherwise step 1 stalls waiting for a confirmation link.)
3. **Run the chat schema** once: project → SQL Editor → New query → paste contents of [`scripts/supabase-schema.sql`](./scripts/supabase-schema.sql) → Run. Creates `kali_conversations` + `kali_messages` tables with row-level security so each user only sees their own threads.
4. Copy keys from project → Settings → API:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (optional — onboarding writes work via the user session)
5. Paste into `.env.local`:

```sh
cp .env.example .env.local
# edit .env.local — fill ANTHROPIC_API_KEY + the 3 supabase keys (others optional)
```

### 5. run it

```sh
bun dev
```

open your browser to **http://localhost:3000** — you should see the kali landing page. click "Get started" to walk the onboarding flow, or jump straight to `http://localhost:3000/chat?demo=rivertown` for the no-signup demo.

to stop the server: hit `ctrl+c` in the terminal.

---

## what's in this repo

```
kali-v0/
├── app/              # next.js pages — UI work starts here
│   ├── page.tsx      # the landing page
│   └── layout.tsx    # root layout (fonts, html shell)
├── components/       # reusable react components
├── lib/              # utility functions, api clients
│   └── connectors/   # the 11 SaaS connectors (to build out)
├── hooks/            # react hooks
├── types/            # shared TS types
├── public/           # static assets (images, fonts)
├── data/             # ALL the kali context docs — READ THESE
│   ├── v1-prototype-scope.md   # ← the build spec. read first.
│   ├── idea.md                 # what kali is + why
│   ├── tech.md                 # tech decisions
│   ├── plan.md                 # execution plan
│   ├── decisions.md
│   ├── team.md
│   └── ...
├── package.json
├── tsconfig.json     # strict mode on
└── tailwind config
```

---

## getting help (in this order)

1. **search the `data/` docs** — most "what is X / how does Y work" answers live there
2. **ask matty** (matthew kim) — senior dev on the team, knows the stack
3. **DM stephen** — only for things that genuinely need him (auth issues, scope decisions, account access)

don't burn an hour stuck. ask.

---

## conventions

- **bun, not npm**. always
- **typescript strict mode**. no `any` without a comment explaining why
- **conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- **never commit `.env`** or anything with secrets
- match the style of nearby files when adding new code

see [CONTRIBUTING.md](./CONTRIBUTING.md) for the git workflow.
