(function () {
  function appPath(p) {
    const r = typeof window.APP_ROOT === "string" ? window.APP_ROOT : "";
    if (!p.startsWith("/")) p = "/" + p;
    return r + p;
  }

  const form = document.getElementById("loginForm");
  const password = document.getElementById("password");
  const btn = document.getElementById("loginBtn");
  const err = document.getElementById("loginError");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.classList.add("hidden");
    btn.disabled = true;
    btn.textContent = "…";
    try {
      const res = await fetch(appPath("/admin/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.value }),
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        window.location.href = appPath("/admin");
        return;
      }
      err.textContent = data.message || "Неверный ключ";
      err.classList.remove("hidden");
    } catch {
      err.textContent = "Ошибка сети";
      err.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "Войти";
    }
  });
})();
