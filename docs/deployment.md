# Deployment Guide

## Keeping It Running

For persistent team use, run Instbyte as a background process so it survives terminal closes and reboots.

### pm2
```bash
npm install -g pm2
pm2 start "npx instbyte" --name instbyte
pm2 save
pm2 startup  # generates a command to run — copy and run it to enable boot start
```

### systemd (Linux)
Create `/etc/systemd/system/instbyte.service`:
```ini
[Unit]
Description=Instbyte
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/instbyte
ExecStart=npx instbyte
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then enable it:
```bash
sudo systemctl daemon-reload
sudo systemctl enable instbyte
sudo systemctl start instbyte
```

### screen / tmux
```bash
screen -S instbyte
npx instbyte
# Ctrl+A then D to detach
```

---

## Docker

> **_NOTE:_**  Data persists in `./instbyte-data` on your host. The same folder used by `npx instbyte` — so switching between the two preserves all your data.

> **Important:** Create the directory and config file on your host before starting the container — otherwise Docker will create a directory in its place:
> ```bash
> touch instbyte.config.json
> ```
> If it was already created as a directory by a previous run, remove it first:
> ```bash
> rm -rf instbyte.config.json
> touch instbyte.config.json
> ```

Then use one of the methods beloww.

### With a run command

```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/instbyte-data:/data \
  -e INSTBYTE_DATA=/data \
  -e INSTBYTE_UPLOADS=/data/uploads \
  --name instbyte \
  mohitgauniyal/instbyte
```

### With a docker-compose.yml file


docker-compose.yml

```yaml
services:
  instbyte:
    image: mohitgauniyal/instbyte
    ports:
      - "3000:3000"
    volumes:
      - ./instbyte-data:/data
      - ./instbyte.config.json:/app/instbyte.config.json
    environment:
      - INSTBYTE_DATA=/data
      - INSTBYTE_UPLOADS=/data/uploads
    restart: unless-stopped
```

> **Note:**  To use a port other than the default (3000) edit the configuration.  Example: using port 1234.
```yaml
    ports:
      - "1234:3000"
```

> **Important:** 
> File uploads may not work correctly on Windows Docker Desktop due to network limitations. 
> For Windows, use `npx instbyte` directly or deploy on a Linux server.

---

## Reverse Proxy

For teams who want to access Instbyte over HTTPS or from outside their local network, running it behind a reverse proxy is the standard approach.

> **Important:** Instbyte uses WebSockets for real-time sync. Your proxy must be configured to forward WebSocket connections — otherwise the app will load but live updates will stop working.

### Nginx
```nginx
server {
    listen 80;
    server_name instbyte.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name instbyte.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/instbyte.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/instbyte.yourdomain.com/privkey.pem;

    # Increase max upload size to match Instbyte's limit
    client_max_body_size 2G;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # Required for WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Prevent proxy timeouts on large uploads
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

Get a free SSL certificate with Certbot:
```bash
certbot --nginx -d instbyte.yourdomain.com
```

### Caddy

Caddy automatically handles HTTPS certificates — no Certbot needed.
```caddy
instbyte.yourdomain.com {
    reverse_proxy localhost:3000
}
```

Caddy handles WebSocket forwarding and HTTPS automatically. That's all you need.

### With Docker

If running Instbyte via Docker, proxy to the mapped host port:
```nginx
proxy_pass http://localhost:3000;
```

Or use Docker's internal network — replace `localhost` with the container name:
```nginx
proxy_pass http://instbyte:3000;
```

### Keeping it LAN-only

If you don't want external access but still want HTTPS on your local network, tools like [Tailscale](https://tailscale.com) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) are good options that require no open ports.

## Broadcasting

### Audio

Instbyte captures your microphone alongside the screen share by default. Viewers are muted on join — click 🔇 to unmute.

To share audio playing on your screen (videos, music, system sounds), select a **browser tab** in the screen picker and enable **Share tab audio**. Window and full-screen capture do not carry system audio — this is a browser limitation.

### HTTPS requirement

Broadcasting uses `getDisplayMedia` which browsers only allow on secure connections:

- **localhost** — always works. The person running `npx instbyte` can always broadcast.
- **LAN via HTTP** — viewers can watch but cannot broadcast themselves.
- **LAN via HTTPS** — everyone on the network can broadcast.

### Enabling broadcast for everyone on your network

Run Caddy alongside Instbyte. Caddy adds HTTPS automatically — no certificate setup needed.
```bash
# Install Caddy
brew install caddy        # macOS
sudo apt install caddy    # Ubuntu / Debian

# Terminal 1
npx instbyte

# Terminal 2 — replace with your machine's local IP
caddy reverse-proxy --from https://192.168.1.x --to localhost:3000
```

First visit on each device will show a certificate warning — click **Advanced → Proceed**. After that, full HTTPS, anyone can broadcast.

### Advanced: broadcast across subnets or over the internet

WebRTC works natively on a LAN without a relay server. For VPS or cross-subnet deployments, WebRTC needs a TURN relay to punch through NAT.

Install [coturn](https://github.com/coturn/coturn):
```bash
sudo apt install coturn
```

Minimal `/etc/turnserver.conf`:
```
listening-port=3478
fingerprint
lt-cred-mech
user=instbyte:yourpassword
realm=yourdomain.com
```

Then update `STUN_SERVERS` in `client/js/app.js` to point to your TURN server.