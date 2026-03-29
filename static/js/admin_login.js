(function () {
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
      const res = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.value }),
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        window.location.href = "/admin";
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
