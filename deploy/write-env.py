#!/usr/bin/env python3
"""Write /var/www/shakyrtu_studio_online/.env with proper newlines (run on server as root)."""
import grp
import os
import pwd
import secrets

path = "/var/www/shakyrtu_studio_online/.env"
body = (
    f"FLASK_SECRET_KEY={secrets.token_hex(32)}\n"
    f"ADMIN_KEY={secrets.token_hex(16)}\n"
    "FLASK_DEBUG=0\n"
    "BEHIND_REVERSE_PROXY=1\n"
)
with open(path, "w", encoding="utf-8") as f:
    f.write(body)
os.chmod(path, 0o600)
uid = pwd.getpwnam("www-data").pw_uid
gid = grp.getgrnam("www-data").gr_gid
os.chown(path, uid, gid)
print("ADMIN_KEY=" + body.split("ADMIN_KEY=", 1)[1].split("\n", 1)[0])
