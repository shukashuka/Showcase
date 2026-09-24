(() => {
  "use strict";

  const cfg = Object.assign(
    { githubUser: "", githubRepo: "", imageFolder: "images",
      extensions: ["jpg", "jpeg", "png", "webp", "gif", "avif"] },
    window.PORTFOLIO_CONFIG
  );

  const $ = (sel, root = document) => root.querySelector(sel);

  const pages = $("#pages");
  const strip = $("#strip");
  const status = $("#status");
  const count = $("#count");
  const prevBtn = $("#prev");
  const nextBtn = $("#next");

  /* ---------- Background ikut bergeser saat scroll ---------- */
  const updateProgress = () => {
    const max = pages.scrollHeight - pages.clientHeight;
    const p = max > 0 ? pages.scrollTop / max : 0;
    document.documentElement.style.setProperty("--p", p.toFixed(4));
  };
  pages.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
  updateProgress();

  /* ---------- Titik navigasi aktif ---------- */
  const dots = [...document.querySelectorAll(".dot")];
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        dots.forEach((d) =>
          d.setAttribute("aria-current", String(d.hash === "#" + entry.target.id))
        );
      });
    },
    { root: pages, threshold: 0.6 }
  );
  document.querySelectorAll(".page").forEach((s) => observer.observe(s));

  $("#year").textContent = new Date().getFullYear();

  /* ---------- Ambil daftar foto dari folder ---------- */
  function detectRepo() {
    let user = cfg.githubUser;
    let repo = cfg.githubRepo;
    const host = location.hostname;

    if (!user && host.endsWith(".github.io")) user = host.split(".")[0];

    if (user && !repo) {
      const first = location.pathname.split("/").filter(Boolean)[0];
      // /nama-repo/  -> project site. Selain itu -> repo username.github.io
      repo = first && !first.includes(".") ? first : user + ".github.io";
    }
    return { user, repo };
  }

  async function listFromGithub() {
    const { user, repo } = detectRepo();
    if (!user || !repo) throw new Error("no-repo");

    const url = `https://api.github.com/repos/${user}/${repo}/contents/${cfg.imageFolder}`;
    const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error("github-" + res.status);

    const data = await res.json();
    return data.filter((f) => f.type === "file").map((f) => f.name);
  }

  // Cadangan: kalau ada file images/images.json berisi ["a.jpg","b.jpg"]
  async function listFromManifest() {
    const res = await fetch(`${cfg.imageFolder}/images.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error("no-manifest");
    return res.json();
  }

  function messageFor(err) {
    const code = err && err.message;
    if (code === "no-repo")
      return "Alamat repo belum terdeteksi. Isi githubUser dan githubRepo di js/config.js.";
    if (code === "github-404")
      return `Folder "${cfg.imageFolder}" tidak ditemukan di repo. Pastikan namanya benar dan sudah di-upload.`;
    if (code === "github-403" || code === "github-429")
      return "Batas akses GitHub sedang tercapai. Coba muat ulang beberapa menit lagi.";
    return "Foto belum bisa dimuat. Coba muat ulang halaman.";
  }

  const okExt = (name) => cfg.extensions.includes(name.split(".").pop().toLowerCase());
  const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  const titleFrom = (name) =>
    name
      .replace(/\.[^.]+$/, "")
      .replace(/^\d+[\s._-]*/, "") // angka di depan hanya untuk urutan
      .replace(/[-_]+/g, " ")
      .trim();

  /* ---------- Tampilkan galeri ---------- */
  const photos = [];

  function render(names) {
    names = names.filter(okExt).sort(natural);

    if (!names.length) {
      status.textContent = `Belum ada foto. Upload foto ke folder "${cfg.imageFolder}".`;
      return;
    }

    status.hidden = true;
    count.textContent = `${names.length} foto`;

    names.forEach((name, i) => {
      const src = `${cfg.imageFolder}/${encodeURIComponent(name)}`;
      const title = titleFrom(name);
      photos.push({ src, title });

      const shot = document.createElement("button");
      shot.type = "button";
      shot.className = "shot";
      shot.setAttribute("aria-label", title ? `Buka foto: ${title}` : `Buka foto ${i + 1}`);

      const img = new Image();
      img.alt = title;
      img.loading = "lazy";
      img.decoding = "async";
      img.draggable = false;
      img.addEventListener("load", () => { shot.classList.add("loaded"); updateArrows(); });
      img.addEventListener("error", () => { shot.hidden = true; });
      img.src = src;
      shot.appendChild(img);

      if (title) {
        const cap = document.createElement("span");
        cap.className = "cap";
        cap.textContent = title;
        shot.appendChild(cap);
      }

      shot.addEventListener("click", () => {
        if (moved) return; // abaikan klik setelah drag
        openLightbox(i);
      });
      strip.appendChild(shot);
    });

    updateArrows();
  }

  async function load() {
    let names;
    try {
      names = await listFromGithub();
    } catch (err) {
      try {
        names = await listFromManifest();
      } catch {
        status.textContent = messageFor(err);
        return;
      }
    }
    render(names);
  }

  /* ---------- Geser galeri: tombol + drag ---------- */
  function updateArrows() {
    prevBtn.disabled = strip.scrollLeft <= 2;
    nextBtn.disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2;
  }
  const step = () => Math.max(240, strip.clientWidth * 0.8);
  prevBtn.addEventListener("click", () => strip.scrollBy({ left: -step(), behavior: "smooth" }));
  nextBtn.addEventListener("click", () => strip.scrollBy({ left: step(), behavior: "smooth" }));
  strip.addEventListener("scroll", updateArrows, { passive: true });
  window.addEventListener("resize", updateArrows);

  let down = false, moved = false, startX = 0, startLeft = 0;
  strip.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    down = true;
    moved = false;
    startX = e.clientX;
    startLeft = strip.scrollLeft;
  });
  window.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) {
      moved = true;
      strip.classList.add("dragging");
    }
    if (moved) strip.scrollLeft = startLeft - dx;
  });
  window.addEventListener("pointerup", () => {
    if (!down) return;
    down = false;
    strip.classList.remove("dragging");
    setTimeout(() => { moved = false; }, 0);
  });

  /* ---------- Lightbox ---------- */
  const dlg = $("#lightbox");
  const lbImg = $("#lbImg");
  const lbCap = $("#lbCap");
  const lbNum = $("#lbNum");
  let current = 0;

  function show(i) {
    current = (i + photos.length) % photos.length;
    const p = photos[current];
    lbImg.src = p.src;
    lbImg.alt = p.title;
    lbCap.textContent = p.title;
    lbNum.textContent = `${current + 1} / ${photos.length}`;
  }

  function openLightbox(i) {
    show(i);
    if (!dlg.open) dlg.showModal();
  }

  $("#lbPrev").addEventListener("click", () => show(current - 1));
  $("#lbNext").addEventListener("click", () => show(current + 1));
  $("#lbClose").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.classList.contains("lb-stage")) dlg.close();
  });
  dlg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });

  load();
})();
