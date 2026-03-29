/**
 * Gallery: загрузка всех фото с API, превью thumb, lightbox.
 */
(function () {
  "use strict";

  const cfgEl = document.getElementById("gallery-config");
  if (!cfgEl) return;

  const cfg = JSON.parse(cfgEl.textContent.trim());
  const folderId = cfg.folderId;
  const appRoot = typeof cfg.appRoot === "string" ? cfg.appRoot : "";

  function appPath(p) {
    if (!p.startsWith("/")) p = "/" + p;
    return appRoot + p;
  }

  const CHUNK = 36;
  const SWIPE_THR = 42;
  const SWIPE_COOLDOWN = 300;

  let photos = [];
  let sortKey = "old";
  let fetching = false;
  let rendered = 0;
  let modalIndex = 0;

  const galleryEl = document.getElementById("gallery-masonry");
  const statusEl = document.getElementById("gallery-status");
  const countEl = document.getElementById("photo-count-num");
  const sortSelect = document.getElementById("sort-select");
  const header = document.getElementById("site-header");
  const fab = document.getElementById("fab-top");
  const fabDown = document.getElementById("fab-down");

  if (sortSelect) sortKey = sortSelect.value || "old";

  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lightbox-img");
  const lbLoader = document.getElementById("lightbox-loader");
  const lbCaption = document.getElementById("lightbox-caption");
  const lbDate = document.getElementById("lightbox-date");
  const lbDownload = document.getElementById("lightbox-download");

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  function setStatus(text, show) {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.classList.toggle("hidden", !show);
  }

  function updateCount() {
    if (countEl) countEl.textContent = String(photos.length);
  }

  async function loadAllPhotos() {
    if (fetching) return;
    fetching = true;
    setStatus("Загружаем все фото…", true);
    photos = [];
    let token = null;

    try {
      do {
        const p = new URLSearchParams({ sort: sortKey });
        if (token) p.set("page_token", token);
        const res = await fetch(appPath(`/photos/${folderId}`) + "?" + p.toString());
        const data = await res.json();
        if (data.error) {
          setStatus("Ошибка: " + data.error, true);
          return;
        }
        photos.push(...(data.photos || []));
        token = data.nextPageToken || null;
      } while (token);

      document.getElementById("gallery-skeletons")?.remove();

      if (!photos.length) {
        setStatus("В этой папке пока нет фотографий", true);
        return;
      }

      updateCount();
      setStatus("", false);
      galleryEl.innerHTML = "";
      rendered = 0;

      while (rendered < photos.length) {
        await new Promise((r) => requestAnimationFrame(r));
        renderChunk();
      }

      onScroll();
    } catch {
      setStatus("Не удалось загрузить фото", true);
    } finally {
      fetching = false;
    }
  }

  function renderChunk() {
    const part = photos.slice(rendered, rendered + CHUNK);
    if (!part.length) return;

    const frag = document.createDocumentFragment();
    const start = rendered;

    part.forEach((p, i) => {
      const idx = start + i;
      const card = document.createElement("article");
      card.className = "gallery-card";
      card.style.setProperty("--stagger", String(Math.min(idx, 24)));
      card.dataset.index = String(idx);

      const inner = document.createElement("div");
      inner.className = "gallery-card-inner";
      const shine = document.createElement("div");
      shine.className = "gallery-card-shine";
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      if (idx < 6) img.setAttribute("fetchpriority", "high");
      img.src = p.thumb;
      img.addEventListener(
        "load",
        () => {
          img.classList.add("is-loaded");
        },
        { once: true }
      );
      img.addEventListener(
        "error",
        () => {
          img.classList.add("is-loaded");
        },
        { once: true }
      );

      inner.appendChild(img);
      inner.appendChild(shine);
      card.appendChild(inner);
      card.addEventListener("click", () => openModal(idx));
      frag.appendChild(card);
    });

    galleryEl.appendChild(frag);
    rendered += part.length;
  }

  function onScroll() {
    const y = window.scrollY || 0;
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    header && header.classList.toggle("is-scrolled", y > 24);
    fab && fab.classList.toggle("is-visible", y > 400);
    if (fabDown) {
      const canDown = max > 48 && y < max - 32;
      fabDown.classList.toggle("is-visible", canDown);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  if (fab) {
    fab.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
  if (fabDown) {
    fabDown.addEventListener("click", () => {
      const footer = document.querySelector(".site-footer");
      if (footer) {
        footer.scrollIntoView({ behavior: "smooth", block: "end" });
      } else {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
      }
    });
  }

  sortSelect &&
    sortSelect.addEventListener("change", () => {
      sortKey = sortSelect.value;
      loadAllPhotos();
    });

  function prefetchNeighbors() {
    if (!photos.length) return;
    const n = (modalIndex + 1) % photos.length;
    const pr = (modalIndex - 1 + photos.length) % photos.length;
    new Image().src = photos[n].preview;
    new Image().src = photos[pr].preview;
  }

  function refreshModal() {
    const p = photos[modalIndex];
    if (!p) return;
    lbCaption.textContent = p.name;
    lbDate.textContent = formatDate(p.createdTime);
    lbDownload.href = p.download;

    lbImg.classList.remove("is-visible");
    lbImg.classList.add("is-blur");
    lbLoader.classList.remove("hidden");
    lbImg.removeAttribute("src");

    const low = new Image();
    low.onload = () => {
      lbImg.src = p.preview;
      lbImg.classList.add("is-visible");
      lbImg.classList.remove("is-blur");
    };
    low.src = p.preview;

    const hi = new Image();
    hi.onload = () => {
      lbImg.src = p.full;
      lbLoader.classList.add("hidden");
    };
    hi.onerror = () => lbLoader.classList.add("hidden");
    hi.src = p.full;

    prefetchNeighbors();
  }

  function openModal(i) {
    if (!photos[i]) return;
    modalIndex = i;
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    refreshModal();
  }

  function closeModal() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    lbImg.removeAttribute("src");
    lbImg.classList.remove("is-visible", "is-blur");
  }

  function showPrev() {
    if (!photos.length) return;
    modalIndex = (modalIndex - 1 + photos.length) % photos.length;
    refreshModal();
  }

  function showNext() {
    if (!photos.length) return;
    modalIndex = (modalIndex + 1) % photos.length;
    refreshModal();
  }

  document.getElementById("lightbox-close")?.addEventListener("click", closeModal);
  document.getElementById("lightbox-prev")?.addEventListener("click", (e) => {
    e.stopPropagation();
    showPrev();
  });
  document.getElementById("lightbox-next")?.addEventListener("click", (e) => {
    e.stopPropagation();
    showNext();
  });

  lightbox.querySelector(".lightbox-backdrop")?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("is-open")) return;
    if (e.key === "Escape") closeModal();
    if (e.key === "ArrowLeft") showPrev();
    if (e.key === "ArrowRight") showNext();
  });

  function attachSwipe(el, onPrev, onNext) {
    let sx = 0;
    let sy = 0;
    let active = false;
    let lastNav = 0;

    function tryNav(cx, cy) {
      if (!active) return;
      active = false;
      const dx = cx - sx;
      const dy = cy - sy;
      if (Math.abs(dx) < SWIPE_THR || Math.abs(dx) < Math.abs(dy) * 1.08) return;
      if (Date.now() - lastNav < SWIPE_COOLDOWN) return;
      lastNav = Date.now();
      if (dx < 0) onNext();
      else onPrev();
    }

    el.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== 0) return;
        active = true;
        sx = e.clientX;
        sy = e.clientY;
        try {
          el.setPointerCapture(e.pointerId);
        } catch (_) {}
      },
      { passive: true }
    );
    el.addEventListener(
      "pointerup",
      (e) => {
        if (!active) return;
        try {
          el.releasePointerCapture(e.pointerId);
        } catch (_) {}
        tryNav(e.clientX, e.clientY);
      },
      { passive: true }
    );
    el.addEventListener("pointercancel", () => {
      active = false;
    });
    el.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        active = true;
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
      },
      { passive: true }
    );
    el.addEventListener(
      "touchend",
      (e) => {
        if (!e.changedTouches.length) return;
        const t = e.changedTouches[0];
        tryNav(t.clientX, t.clientY);
      },
      { passive: true }
    );
  }

  const stage = document.getElementById("lightbox-stage");
  if (stage) attachSwipe(stage, showPrev, showNext);

  loadAllPhotos().then(() => {
    onScroll();
  });

  window.__galleryOpenModal = openModal;
})();
