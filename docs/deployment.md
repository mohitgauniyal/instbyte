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

The fastest way to run Instbyte with Docker:
```bash
docker compose up -d
```

Or with plain Docker:
```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/instbyte-data:/data \
  -e INSTBYTE_DATA=/data \
  -e INSTBYTE_UPLOADS=/data/uploads \
  --name instbyte \
  mohitgauniyal/instbyte
```

Data persists in `./instbyte-data` on your host. The same folder used by `npx instbyte` — so switching between the two preserves all your data.

### With a config file

Mount your config file into the container:
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

### Changing the port

Edit the host port in `docker-compose.yml`:
```yaml
ports:
  - "8080:3000"  # now runs on port 8080
```

> **Note:** File uploads may not work correctly on Windows Docker Desktop due to network limitations. For Windows, use `npx instbyte` directly or deploy on a Linux server.

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