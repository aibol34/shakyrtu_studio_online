#!/bin/bash
# Запуск на Ubuntu: bash server-setup.sh
# Перед этим: scp credentials.json root@СЕРВЕР:/var/www/shakyrtu_studio_online/
set -e
APP_DIR="/var/www/shakyrtu_studio_online"
REPO="https://github.com/aibol34/shakyrtu_studio_online.git"

cd /var/www
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull origin main
else
  git clone "$REPO" shakyrtu_studio_online
  cd "$APP_DIR"
fi

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

if [ ! -f credentials.json ]; then
  echo "ВНИМАНИЕ: положите credentials.json в $APP_DIR (Google service account)"
fi

if [ ! -f .env ]; then
  echo "Создайте $APP_DIR/.env с FLASK_SECRET_KEY и ADMIN_KEY (см. deploy/env.example)"
fi

chown -R www-data:www-data "$APP_DIR" 2>/dev/null || true

echo "Готово. Дальше: sudo cp deploy/shakyrtu-gallery.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now shakyrtu-gallery"
echo "Nginx: см. deploy/nginx-snippet.conf"
