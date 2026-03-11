# Terminal Usage

Since Instbyte exposes a simple HTTP API, you can push content directly from your terminal using `curl` — no browser needed.

Replace `192.168.x.x:3000` with the URL shown when Instbyte starts. If auth is enabled, add `-b "instbyte_auth=your-token"` to each request.

---

## Send text or a link
```bash
curl -X POST http://192.168.x.x:3000/text \
  -H "Content-Type: application/json" \
  -d '{"content": "hello from terminal", "channel": "general", "uploader": "terminal"}'
```

## Send a file's contents as text
```bash
curl -X POST http://192.168.x.x:3000/text \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"$(cat error.log)\", \"channel\": \"general\", \"uploader\": \"terminal\"}"
```

## Pipe command output directly
```bash
npm run build 2>&1 | curl -X POST http://192.168.x.x:3000/text \
  -H "Content-Type: application/json" \
  --data-binary @- \
  -H "X-Channel: general" \
  -H "X-Uploader: CI"
```

## Upload a file
```bash
curl -X POST http://192.168.x.x:3000/upload \
  -F "file=@./build.log" \
  -F "channel=general" \
  -F "uploader=terminal"
```

## With auth enabled

Add the auth cookie to any request:
```bash
curl -X POST http://192.168.x.x:3000/text \
  -b "instbyte_auth=yourpassphrase" \
  -H "Content-Type: application/json" \
  -d '{"content": "authenticated push", "channel": "general", "uploader": "terminal"}'
```

---

## Use cases

- Pipe stack traces or build logs from CI straight into a shared channel
- Send environment dumps or config snapshots from a remote server
- Push deployment notifications to a team channel
- Share curl-accessible API responses without leaving the terminal