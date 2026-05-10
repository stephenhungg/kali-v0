# kali-v0

agentic context layer for nonprofits. one chat interface, eleven SaaS tools unified, plain-english queries across the whole stack. v1 prototype for HackDavis 2026.

> read [`data/v1-prototype-scope.md`](./data/v1-prototype-scope.md) for the full build spec. that's the contract.

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

### 4. run it

```sh
bun dev
```

open your browser to **http://localhost:3000** — you should see the kali landing page.

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
