# GitHub Command Center

A **single-file, zero-dependency** web app for managing two GitHub accounts from one PC — with an encrypted secrets vault, a leak scanner, and plain-English help on **every single control**.

**Live:** https://len-golani.github.io/New_Stuff/

## What it is

`index.html` *is* the application. There is no build step, no package manager, no bundler, no CDN, and no network access at all. Open the file in any modern browser and it works — offline, from a USB stick, from a file share.

That constraint is deliberate: an app that explains how to keep secrets safe should not itself phone home.

## What it does

Thirteen views, all reachable from the left sidebar:

| View | Purpose |
|---|---|
| **Dashboard** | Starting point: your checklist, current status, and the first steps |
| **Two-Account Setup** | Run two GitHub identities on one machine — per-account SSH keys, SSH host aliases, `gh auth login` |
| **Learn Step-by-Step** | Guided lessons from "install Git" to "my first pull request" |
| **My Repositories** | Track each project: path, remote, branch, visibility, and per-repo notes |
| **Sync Centre** | The day-to-day `add` / `commit` / `push` / `pull` loop, explained |
| **Secrets Vault** | Store tokens and keys encrypted in the browser — WebCrypto (`crypto.subtle` + `crypto.getRandomValues`), never in plain text |
| **Tools: Scanner & .gitignore** | Scan text or files for credentials; generate `.gitignore` files by project type |
| **Privacy & Leak Scan** | Audit a repository or pasted content for leaked secrets and risky filenames |
| **Secret Guards** | Pre-commit style guards that stop a secret before it reaches a remote |
| **Setup Health Check** | Verify SSH keys, host aliases, remotes and account wiring are actually correct |
| **Cheat Sheet** | Everyday Git and GitHub commands, one page |
| **Print One-Page Sheet** | A printable summary you can keep next to the keyboard |
| **Backup & Wipe** | Export or clear everything the app stores locally |

### Beginner-friendly help everywhere

Every one of the **304 interactive controls** carries a `data-help` key that resolves to a written explanation — what the control does, when to use it, and what it will change. Help appears on hover, on keyboard focus, and on touch. There are **123 help entries** and an automated audit enforces that none are missing, dangling, or unused.

## Privacy

- **No network requests.** No `fetch`, no `XMLHttpRequest`, no WebSocket, no external `<script>`, `<link>` or font. (The only `https://` strings in the file are inside instructional text.)
- **All state is local.** Everything is stored in your browser via `localStorage`.
- **Vault contents are encrypted** before storage using the browser's built-in WebCrypto API.
- **No analytics, no telemetry, no accounts.**

If you want to be certain, search the file for `fetch` — you will find none.

## Running it

```bash
# Simplest: just open it
start index.html          # Windows
open index.html           # macOS
xdg-open index.html       # Linux
```

Or serve it over HTTP if you prefer a normal origin:

```bash
python -m http.server 8000
# then visit http://127.0.0.1:8000/
```

## Maintenance gate

`tools/audit-help.mjs` is an offline coverage checker. It parses `index.html`, finds every interactive control, and fails if any control lacks help text, if a help key points at nothing, or if a help entry is never used.

```bash
node tools/audit-help.mjs           # exit 0 = clean
node tools/audit-help.mjs --list    # list every control, grouped by view
```

Current status: **exit 0** — 304/304 controls covered, 123 help entries, 0 dangling, 0 unused.

Run it after editing `index.html`. A non-zero exit means a beginner would meet a control with no explanation.

## Repository contents

```
index.html                                  the entire application
tools/audit-help.mjs                        help-coverage gate (offline, no deps)
executive-summary-github-command-center.html  project summary / rationale
.nojekyll                                   tells GitHub Pages to serve files as-is
```

## Deployment

GitHub Pages, deployed straight from the `main` branch root — no Actions workflow needed, because there is nothing to build. `.nojekyll` disables Jekyll processing so files are served exactly as committed.

Any push to `main` is live within a minute.

## Notes

- The app is written for a non-developer audience first. Where a technical concept is unavoidable, it is explained in place rather than linked away.
- `main` is protected against force-pushes and deletion. History is append-only by design.
- This is a personal tool, published openly so it can be inspected.

## License

Personal project — see the repository owner for reuse.
