"""
ToiGallery — Flask backend: Drive galleries, admin API, secure admin panel.
"""
from __future__ import annotations

import io
import json
import os
import re
import zipfile
from datetime import datetime, timedelta, timezone
from functools import wraps

import requests
from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
    session,
    url_for,
)
from google.oauth2 import service_account
from googleapiclient.discovery import build

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-change-in-production")
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=14)

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
SERVICE_ACCOUNT_FILE = os.path.join(BASE_DIR, "credentials.json")
ALBUMS_FILE = os.path.join(BASE_DIR, "albums.json")

# Ключ админки: переменная окружения ADMIN_KEY (и пароль для формы входа)
ADMIN_KEY = os.environ.get("ADMIN_KEY", "changeme")

SITE_OWNER = {
    "brand_name": "ToiGallery",
    "photographer_name": "Aibol Photographer",
    "whatsapp": "https://wa.me/77762694965",
    "instagram": "https://instagram.com/your_instagram",
    "instagram_text": "@your_instagram",
    "phone": "",
}

creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE,
    scopes=SCOPES,
)
service = build("drive", "v3", credentials=creds)


def ensure_albums_file():
    if not os.path.exists(ALBUMS_FILE):
        with open(ALBUMS_FILE, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=2)


def load_albums():
    ensure_albums_file()
    with open(ALBUMS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_albums(albums):
    with open(ALBUMS_FILE, "w", encoding="utf-8") as f:
        json.dump(albums, f, ensure_ascii=False, indent=2)


def extract_folder_id(link: str):
    link = link.strip()
    match = re.search(r"/folders/([a-zA-Z0-9_-]+)", link)
    if match:
        return match.group(1)
    if re.fullmatch(r"[a-zA-Z0-9_-]{10,}", link):
        return link
    return None


def build_photo_links(file_id: str):
    return {
        "thumb": f"https://lh3.googleusercontent.com/d/{file_id}=w360",
        "preview": f"https://lh3.googleusercontent.com/d/{file_id}=w1400",
        "full": f"https://lh3.googleusercontent.com/d/{file_id}=w2400",
        "download": f"https://drive.google.com/uc?export=download&id={file_id}",
    }


def get_folder_info(folder_id: str):
    return service.files().get(
        fileId=folder_id,
        fields="id,name,webViewLink,createdTime",
    ).execute()


def get_all_image_files(folder_id: str):
    all_files = []
    page_token = None
    while True:
        response = (
            service.files()
            .list(
                q=f"'{folder_id}' in parents and mimeType contains 'image/' and trashed = false",
                fields="nextPageToken, files(id,name,createdTime)",
                pageSize=1000,
                orderBy="createdTime desc",
                pageToken=page_token,
            )
            .execute()
        )
        all_files.extend(response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            break
    return all_files


def admin_required(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        if not session.get("admin"):
            return jsonify({"success": False, "message": "Требуется вход в админку"}), 401
        return f(*args, **kwargs)

    return wrapped


@app.route("/")
def landing():
    return render_template("landing.html", owner=SITE_OWNER)


@app.route("/admin/auth")
def admin_auth():
    """Секретная ссылка: /admin/auth?key=ВАШ_КЛЮЧ"""
    if request.args.get("key") == ADMIN_KEY:
        session["admin"] = True
        session.permanent = True
        return redirect(url_for("admin_panel"))
    return redirect(url_for("admin_login_page"))


@app.route("/admin/login", methods=["GET"])
def admin_login_page():
    if session.get("admin"):
        return redirect(url_for("admin_panel"))
    return render_template("admin_login.html", owner=SITE_OWNER)


@app.route("/admin/login", methods=["POST"])
def admin_login_post():
    data = request.get_json(force=True) or {}
    pwd = (data.get("password") or "").strip()
    if pwd == ADMIN_KEY:
        session["admin"] = True
        session.permanent = True
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Неверный ключ доступа"}), 401


@app.route("/admin/logout", methods=["POST"])
def admin_logout():
    session.pop("admin", None)
    return jsonify({"success": True})


@app.route("/admin")
def admin_panel():
    if not session.get("admin"):
        return redirect(url_for("admin_login_page"))
    return render_template("admin.html", owner=SITE_OWNER, admin_key_hint=False)


@app.route("/add-album", methods=["POST"])
@admin_required
def add_album():
    data = request.get_json(force=True)
    folder_link = data.get("folder_link", "").strip()

    if not folder_link:
        return (
            jsonify({"success": False, "message": "Вставьте ссылку на папку Google Drive"}),
            400,
        )

    folder_id = extract_folder_id(folder_link)
    if not folder_id:
        return (
            jsonify({"success": False, "message": "Не удалось получить ID папки из ссылки"}),
            400,
        )

    try:
        folder = get_folder_info(folder_id)
    except Exception as e:
        return (
            jsonify(
                {
                    "success": False,
                    "message": f"Не удалось открыть папку. Проверьте ссылку и доступ сервис-аккаунта. {e!s}",
                }
            ),
            400,
        )

    albums = load_albums()
    if any(album["folder_id"] == folder_id for album in albums):
        return jsonify({"success": False, "message": "Эта папка уже добавлена на сайт"}), 400

    added_at = datetime.now(timezone.utc).isoformat()
    new_album = {
        "folder_id": folder["id"],
        "folder_name": folder["name"],
        "drive_url": folder.get("webViewLink", folder_link),
        "added_at": added_at,
    }
    albums.append(new_album)
    save_albums(albums)

    return jsonify(
        {
            "success": True,
            "message": "Папка добавлена",
            "folder_id": folder["id"],
            "folder_name": folder["name"],
            "album_url": f"/album/{folder['id']}",
            "google_drive_folder": folder.get("webViewLink", folder_link),
        }
    )


@app.route("/albums")
@admin_required
def list_albums():
    albums = load_albums()
    now = datetime.now(timezone.utc)
    result = []
    expired_count = 0
    active_count = 0

    for album in reversed(albums):
        added_dt = datetime.fromisoformat(album["added_at"])
        days_passed = (now - added_dt).days
        expired = days_passed >= 30
        days_left = max(0, 30 - days_passed)

        if expired:
            expired_count += 1
        else:
            active_count += 1

        result.append(
            {
                "folder_id": album["folder_id"],
                "folder_name": album["folder_name"],
                "drive_url": album["drive_url"],
                "album_url": f"/album/{album['folder_id']}",
                "added_at": added_dt.strftime("%d.%m.%Y %H:%M"),
                "days_passed": days_passed,
                "days_left": days_left,
                "expired": expired,
            }
        )

    return jsonify(
        {
            "success": True,
            "total": len(result),
            "active": active_count,
            "expired": expired_count,
            "albums": result,
        }
    )


@app.route("/remove-album/<folder_id>", methods=["DELETE"])
@admin_required
def remove_album(folder_id):
    albums = load_albums()
    new_albums = [a for a in albums if a["folder_id"] != folder_id]
    if len(new_albums) == len(albums):
        return jsonify({"success": False, "message": "Альбом не найден"}), 404
    save_albums(new_albums)
    return jsonify({"success": True, "message": "Альбом убран с сайта"})


@app.route("/album/<folder_id>")
def album_page(folder_id):
    try:
        folder = get_folder_info(folder_id)
        folder_name = folder.get("name", "Gallery")
    except Exception:
        folder_name = "Gallery"

    return render_template(
        "album.html",
        owner=SITE_OWNER,
        folder_id=folder_id,
        folder_name=folder_name,
    )


PHOTOS_PAGE_SIZE = 80
PHOTOS_SORT_ORDER = {
    "new": "createdTime desc",
    "old": "createdTime asc",
    "name": "name",
}


@app.route("/photos/<folder_id>")
def get_photos(folder_id):
    sort = request.args.get("sort", "old")
    page_token = request.args.get("page_token") or None
    order_by = PHOTOS_SORT_ORDER.get(sort, PHOTOS_SORT_ORDER["new"])

    try:
        req = {
            "q": f"'{folder_id}' in parents and mimeType contains 'image/' and trashed = false",
            "fields": "nextPageToken, files(id,name,createdTime)",
            "pageSize": PHOTOS_PAGE_SIZE,
            "orderBy": order_by,
        }
        if page_token:
            req["pageToken"] = page_token

        results = service.files().list(**req).execute()
        files = results.get("files", [])
        photos = []
        for f in files:
            links = build_photo_links(f["id"])
            photos.append(
                {
                    "id": f["id"],
                    "name": f["name"],
                    "createdTime": f.get("createdTime", ""),
                    "thumb": links["thumb"],
                    "preview": links["preview"],
                    "full": links["full"],
                    "download": links["download"],
                }
            )

        return jsonify(
            {
                "photos": photos,
                "nextPageToken": results.get("nextPageToken"),
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/download-all/<folder_id>")
def download_all(folder_id):
    try:
        folder = get_folder_info(folder_id)
        folder_name = folder.get("name", "album")
        files = get_all_image_files(folder_id)
        if not files:
            return "В папке нет фото", 404

        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, "w", zipfile.ZIP_DEFLATED) as zf:
            for file in files:
                url = f"https://drive.google.com/uc?export=download&id={file['id']}"
                response = requests.get(url, timeout=120)
                if response.status_code == 200:
                    zf.writestr(file["name"], response.content)

        memory_file.seek(0)
        safe_name = re.sub(r"[^a-zA-Z0-9а-яА-ЯёЁ._ -]+", "", folder_name).strip() or "album"

        return send_file(
            memory_file,
            as_attachment=True,
            download_name=f"{safe_name}.zip",
            mimetype="application/zip",
        )
    except Exception as e:
        return f"Ошибка скачивания архива: {e!s}", 500


if __name__ == "__main__":
    ensure_albums_file()
    app.run(debug=os.environ.get("FLASK_DEBUG", "1") == "1")
