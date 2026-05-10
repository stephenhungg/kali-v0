# contributing to kali-v0

step-by-step git + dev workflow. if you've never made a pull request before, follow this exactly.

## the loop

every time you sit down to work, the loop is:

1. **pull latest from main** so you don't conflict with someone else's work
2. **make a feature branch** for your task
3. **code, save, test locally**
4. **commit** in small chunks
5. **push** your branch to github
6. **open a PR** for review

## first time only — set up git identity

```sh
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

(use the email tied to your github account so commits link back to you.)

## the workflow, step by step

### 1. pull latest

before you start anything:

```sh
cd ~/Documents/kali-v0
git checkout main
git pull origin main
```

### 2. make a feature branch

name your branch `feat/<short-description>` or `fix/<short-description>`. examples:

- `feat/quickbooks-connector`
- `feat/landing-hero`
- `fix/auth-redirect`

```sh
git checkout -b feat/your-thing
```

### 3. write code

open the project in your editor (vscode is great). save files as you go. run the dev server in another terminal to see changes live:

```sh
bun dev
```

### 4. commit in small chunks

after each logical chunk of work, commit. don't wait until the end of the day to commit one giant blob.

```sh
git add .                              # stage all changes
git status                             # double-check what's staged
git commit -m "feat: add hero section"
```

**conventional commit prefixes:**

| prefix     | when to use                                      |
|------------|--------------------------------------------------|
| `feat:`    | a new feature                                    |
| `fix:`     | a bug fix                                        |
| `chore:`   | tooling, deps, config — no app behavior change   |
| `docs:`    | only docs/comments changed                       |
| `refactor:`| code restructure, no behavior change             |
| `test:`    | adding/updating tests                            |

### 5. push your branch

```sh
git push -u origin feat/your-thing
```

(the `-u` part only matters the first time you push the branch. after that, just `git push`.)

### 6. open a pull request

```sh
gh pr create --web
```

this opens github in your browser with a PR draft. fill in:

- **title** — same style as your commit messages: `feat: add hero section`
- **description** — one line on what it does, anything reviewers should know

then click "create pull request".

ask matty or stephen to review. once approved, click "squash and merge".

## things to avoid

- **never push to `main` directly** — always go through a PR
- **never commit `.env` or anything with secrets** — if you do by accident, tell stephen IMMEDIATELY so we can rotate keys
- **never `git push --force`** unless you really know what you're doing
- **never `git reset --hard`** without committing first — you'll lose work

## stuck on git?

git is its own beast. if a command does something weird, **don't run more commands trying to fix it** — that usually makes things worse. screenshot the terminal output and ask matty or stephen.

common stuck-states:

- "i committed to the wrong branch" → ask
- "merge conflict" → ask
- "i pushed something i shouldn't have" → ask immediately
- "git is asking me to merge or rebase" → ask
