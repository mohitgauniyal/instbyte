# Terminal Usage

Instbyte exposes a simple HTTP API — push content directly from your terminal using `curl`, no browser needed.

Replace `192.168.x.x:3000` with the URL shown when Instbyte starts.

---

## Send text or a link
```bash
curl -X POST http://192.168.x.x:3000/push \
  -H "Content-Type: text/plain" \
  -d "hello from terminal"
```

Use `X-Channel` and `X-Uploader` headers to control where it lands. Both default to `general` and `terminal` if omitted.
```bash
curl -X POST http://192.168.x.x:3000/push \
  -H "Content-Type: text/plain" \
  -H "X-Channel: projects" \
  -H "X-Uploader: mohit" \
  -d "targeted push"
```

---

## Pipe command output

Any command output — logs, build errors, git history — pipes directly. No quoting or escaping needed.
```bash
# build output
npm run build 2>&1 | curl -X POST http://192.168.x.x:3000/push \
  -H "Content-Type: text/plain" \
  --data-binary @-

# directory listing
ls -la | curl -X POST http://192.168.x.x:3000/push \
  -H "Content-Type: text/plain" \
  --data-binary @-

# git log
git log --oneline -20 | curl -X POST http://192.168.x.x:3000/push \
  -H "Content-Type: text/plain" \
  --data-binary @-

# docker logs
docker logs my-container 2>&1 | curl -X POST http://192.168.x.x:3000/push \
  -H "Content-Type: text/plain" \
  --data-binary @-
```

---

## Send a file's contents as text
```bash
curl -X POST http://192.168.x.x:3000/push \
  -H "Content-Type: text/plain" \
  --data-binary @error.log
```

This works for any text file — logs, configs, `.env` snapshots, stack traces. The content appears in the feed with syntax highlighting if the extension is recognised.

> Use `/upload` instead if you want the file itself to be downloadable rather than read inline.

---

## Upload a file

Any file type — images, PDFs, zips, executables, media.
```bash
curl -X POST http://192.168.x.x:3000/upload \
  -F "file=@./screenshot.png" \
  -F "channel=general" \
  -F "uploader=terminal"
```

---

## With auth enabled

Pass the passphrase as a header — works from any terminal or CI environment without needing a browser session.
```bash
curl -X POST http://192.168.x.x:3000/push \
  -H "Content-Type: text/plain" \
  -H "X-Passphrase: yourpassword" \
  --data-binary @error.log
```

All endpoints accept `X-Passphrase`. Upload too:
```bash
curl -X POST http://192.168.x.x:3000/upload \
  -H "X-Passphrase: yourpassword" \
  -F "file=@./build.zip" \
  -F "channel=assets" \
  -F "uploader=CI"
```

---

## Quick reference — headers

| Header | Applies to | Default | Description |
|---|---|---|---|
| `X-Channel` | `/push`, `/text` | `general` | Channel to post into |
| `X-Uploader` | `/push`, `/text` | `terminal` | Display name in the feed |
| `X-Passphrase` | all endpoints | — | Passphrase if auth is enabled |

---

## Use cases

- Pipe stack traces or build output from CI straight into a shared channel
- Send `.env` snapshots or config dumps from a remote server
- Push deployment notifications to a team channel
- Share API responses or debug output without leaving the terminal
```