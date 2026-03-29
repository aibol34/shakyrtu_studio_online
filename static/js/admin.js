(function () {
  function appPath(p) {
    const r = typeof window.APP_ROOT === "string" ? window.APP_ROOT : "";
    if (!p.startsWith("/")) p = "/" + p;
    return r + p;
  }

  const folderLink = document.getElementById("folderLink");
  const addBtn = document.getElementById("addAlbumBtn");
  const addResult = document.getElementById("addResult");
  const refreshBtn = document.getElementById("refreshBtn");
  const albumsList = document.getElementById("albumsList");
  const statTotal = document.getElementById("statTotal");
  const statActive = document.getElementById("statActive");
  const statExpired = document.getElementById("statExpired");
  const logoutBtn = document.getElementById("logoutBtn");

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  addBtn.addEventListener("click", async () => {
    const link = folderLink.value.trim();
    if (!link) {
      addResult.className = "admin-result err";
      addResult.textContent = "Вставьте ссылку на папку";
      addResult.classList.remove("hidden");
      return;
    }
    addBtn.disabled = true;
    addResult.classList.add("hidden");
    try {
      const res = await fetch(appPath("/add-album"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_link: link }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!data.success) {
        addResult.className = "admin-result err";
        addResult.textContent = data.message || "Ошибка";
        addResult.classList.remove("hidden");
        return;
      }
      addResult.className = "admin-result ok";
      addResult.innerHTML =
        "<strong>Готово.</strong> Галерея: <a href=\"" +
        data.album_url +
        '" style="color:#6ee7ff">' +
        data.album_url +
        "</a>";
      addResult.classList.remove("hidden");
      folderLink.value = "";
      loadAlbums();
    } catch {
      addResult.className = "admin-result err";
      addResult.textContent = "Сеть недоступна";
      addResult.classList.remove("hidden");
    } finally {
      addBtn.disabled = false;
    }
  });

  async function loadAlbums() {
    albumsList.innerHTML = '<div class="admin-loading">Загрузка…</div>';
    try {
      const res = await fetch(appPath("/albums"), { credentials: "same-origin" });
      if (res.status === 401) {
        window.location.href = appPath("/admin/login");
        return;
      }
      const data = await res.json();
      if (!data.success) {
        albumsList.innerHTML = '<div class="admin-loading">' + (data.message || "Ошибка") + "</div>";
        return;
      }
      statTotal.textContent = data.total;
      statActive.textContent = data.active;
      statExpired.textContent = data.expired;

      if (!data.albums.length) {
        albumsList.innerHTML = '<div class="admin-loading">Альбомов пока нет</div>';
        return;
      }

      albumsList.innerHTML = data.albums
        .map((a) => {
          const pct = Math.min(100, (a.days_passed / 30) * 100);
          const expired = a.expired;
          return (
            '<div class="admin-album' +
            (expired ? " is-expired" : "") +
            '">' +
            '<div class="admin-album-main">' +
            '<div class="admin-album-title">' +
            escapeHtml(a.folder_name) +
            (expired
              ? '<span class="admin-tag admin-tag--exp">Просрочен</span>'
              : '<span class="admin-tag admin-tag--ok">Активен · ' +
                a.days_left +
                " дн.</span>") +
            "</div>" +
            '<div class="admin-album-meta">Добавлен: ' +
            escapeHtml(a.added_at) +
            " · прошло дней: " +
            a.days_passed +
            "</div>" +
            '<div class="admin-timer" aria-hidden="true"><div class="admin-timer-bar" style="width:' +
            pct +
            '%"></div></div>' +
            "</div>" +
            '<div class="admin-album-actions">' +
            '<a class="admin-link-btn" href="' +
            a.album_url +
            '" target="_blank" rel="noopener">Галерея</a>' +
            '<a class="admin-link-btn" href="' +
            escapeHtml(a.drive_url) +
            '" target="_blank" rel="noopener">Drive</a>' +
            '<button type="button" class="admin-del" data-id="' +
            escapeHtml(a.folder_id) +
            '">Удалить</button>' +
            "</div></div>"
          );
        })
        .join("");

      albumsList.querySelectorAll(".admin-del").forEach((btn) => {
        btn.addEventListener("click", () => removeAlbum(btn.dataset.id));
      });
    } catch {
      albumsList.innerHTML = '<div class="admin-loading">Ошибка загрузки</div>';
    }
  }

  async function removeAlbum(id) {
    if (!confirm("Убрать этот альбом с сайта? Папка на Google Drive не удалится.")) return;
    try {
      const res = await fetch(appPath("/remove-album/" + id), {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = appPath("/admin/login");
        return;
      }
      if (!data.success) {
        alert(data.message || "Ошибка");
        return;
      }
      loadAlbums();
    } catch {
      alert("Ошибка сети");
    }
  }

  refreshBtn.addEventListener("click", loadAlbums);

  logoutBtn.addEventListener("click", async () => {
    await fetch(appPath("/admin/logout"), { method: "POST", credentials: "same-origin" });
    window.location.href = appPath("/admin/login");
  });

  loadAlbums();
})();
