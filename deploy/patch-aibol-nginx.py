#!/usr/bin/env python3
"""One-off: insert /gallery/ into /etc/nginx/sites-enabled/aibol.ru (run on server as root)."""
from pathlib import Path

p = Path("/etc/nginx/sites-enabled/aibol.ru")
t = p.read_text()
needle = (
    "    ssl_certificate_key /etc/letsencrypt/live/aibol.ru/privkey.pem;\n\n"
    "    location /qadamdapp {"
)
if needle not in t:
    raise SystemExit("needle not found — already patched?")
insert = """    ssl_certificate_key /etc/letsencrypt/live/aibol.ru/privkey.pem;

    location = /gallery {
        return 301 https://$host/gallery/;
    }

    location /gallery/ {
        proxy_pass http://127.0.0.1:8010/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Prefix /gallery;
        proxy_read_timeout 300s;
        client_max_body_size 50M;
    }

    location /qadamdapp {"""
p.write_text(t.replace(needle, insert))
print("ok")
