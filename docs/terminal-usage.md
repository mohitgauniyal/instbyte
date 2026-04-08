# Terminal Usage

Instbyte has a first-class CLI for sending, watching, and checking server status — no browser needed.

---

## How it fits together

One person starts the server — that's `npx instbyte`, same as always. The CLI commands
are what everyone else (or other terminals on the same machine) uses to talk to it.

```
Machine A — runs the server:
  npx instbyte
  → Network: http://192.168.29.64:3000

Machine A, another terminal — auto-discovers the server:
  instbyte send ./build.zip       ← no --server needed
  instbyte watch
  instbyte status

Machine B — teammate on the same network:
  instbyte send ./notes.txt --server http://192.168.29.64:3000
  instbyte watch --server http://192.168.29.64:3000
```

**On the server machine:** the CLI discovers the URL automatically from
`instbyte-data/.runtime.json`, written when the server starts. No flags needed.

**On any other machine:** pass `--server` once per command, or set `INSTBYTE_URL`
in your shell profile and never type it again:

```bash
# Add to ~/.bashrc or ~/.zshrc on teammate machines
export INSTBYTE_URL=http://192.168.29.64:3000
export INSTBYTE_PASS=myteam   # only if auth is enabled
```

After that, `instbyte send`, `instbyte watch`, and `instbyte status` just work on
every terminal on every machine on the network — same as the server machine.

---

## CLI

### Send a file
```bash
instbyte send ./build.zip
instbyte send ./error.log --channel projects
instbyte send ./report.pdf --channel assets --passphrase myteam
```

### Send text or a link
```bash
instbyte send "http://staging.myapp.com"
instbyte send "quick note for the team" --channel projects
```

### Pipe anything in
```bash
npm run build 2>&1 | instbyte send
git log --oneline -20 | instbyte send
docker logs my-container | instbyte send --channel projects
cat error.log | instbyte send
```

> Windows: use PowerShell or CMD for piping. Git Bash has a known stdin limitation with native executables.

### Watch a channel — auto-copy new text to clipboard
```bash
instbyte watch                     # watches general channel
instbyte watch --channel projects  # specific channel
instbyte watch --output            # print to stdout instead of clipboard
instbyte watch --output | grep "error"  # pipeable
```

New text items are silently copied to your clipboard. File items print the download URL.

### Check server status
```bash
instbyte status
instbyte status --server http://192.168.x.x:3000
```

---

## Server auto-discovery

When the server starts, it writes a small runtime config to `instbyte-data/.runtime.json` with the server URL and passphrase. The CLI picks this up automatically by walking up from your current directory — the same way git finds `.git`.

Priority order for every CLI command:
1. `--server` / `--passphrase` flags
2. `INSTBYTE_URL` / `INSTBYTE_PASS` environment variables
3. `instbyte-data/.runtime.json` found by walking up from cwd
4. `http://localhost:3000` fallback

---

## CI/CD

Environment variables are the clean path for CI — set once as a secret, use everywhere:

```bash
# Set in CI environment
INSTBYTE_URL=http://192.168.x.x:3000
INSTBYTE_PASS=myteam
```

```yaml
# GitHub Actions
- name: Share build artifact
  run: npx instbyte send ./dist/app.zip --channel assets
```

```json
// package.json scripts
{
  "scripts": {
    "build": "webpack && instbyte send ./dist/build.zip --channel assets",
    "test": "vitest run 2>&1 | instbyte send --channel projects"
  }
}
```

---

## Options

| Flag | Commands | Default | Description |
|---|---|---|---|
| `--server <url>` | all | auto-discovered | Server URL |
| `--channel <name>` | send, watch | `general` | Target channel |
| `--passphrase <pass>` | all | auto-discovered | Passphrase if auth is enabled |
| `--uploader <name>` | send | OS username | Display name for sent items |
| `--output` | watch | — | Print to stdout instead of clipboard |
| `--quiet` | send | — | Suppress confirmation output |

---

## Raw HTTP (curl)

The HTTP API is also available directly — useful for environments without the CLI installed.

```bash
# Send text
curl -X POST http://192.168.x.x:3000/push \
  -H "Content-Type: text/plain" \
  -d "hello from terminal"

# Send to a specific channel
curl -X POST http://192.168.x.x:3000/push \
  -H "Content-Type: text/plain" \
  -H "X-Channel: projects" \
  -H "X-Uploader: mohit" \
  -d "targeted push"

# Pipe command output
npm run build 2>&1 | curl -X POST http://192.168.x.x:3000/push \
  -H "Content-Type: text/plain" \
  --data-binary @-

# Upload a file
curl -X POST http://192.168.x.x:3000/upload \
  -F "file=@./screenshot.png" \
  -F "channel=general" \
  -F "uploader=terminal"

# With auth
curl -X POST http://192.168.x.x:3000/push \
  -H "Content-Type: text/plain" \
  -H "X-Passphrase: yourpassword" \
  --data-binary @error.log
```
