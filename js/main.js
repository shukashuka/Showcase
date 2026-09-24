(() => {
  "use strict";

  const cfg = Object.assign(
    {
      githubUser: "", githubRepo: "", branch: "",
      imageFolder: "images",
      extensions: ["jpg", "jpeg", "png", "webp", "gif", "avif"],
      rootTitle: "Lainnya",
      projects: {}
    },
    window.PORTFOLIO_CONFIG
  );

  const $ = (sel, root = document) => root.querySelector(sel);

  const pages = $("#pages");
  const scroller = $("#projects");
  const inner = $("#projectsInner");
  const status = $("#status");
  const count = $("#count");
  const roadmapWrap = $("#roadmapWrap");
  const roadmap = $("#roadmap");

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

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

  /* ---------- Nama & urutan ---------- */
  const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  const okExt = (name) => cfg.extensions.includes(name.split(".").pop().toLowerCase());
  const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

  // Angka + pemisah di depan nama hanya untuk urutan, tidak ditampilkan.
  const stripOrder = (s) => s.replace(/^\d+[\s._-]+/, "");
  const folderTitle = (name) => stripOrder(name).replace(/_+/g, " ").trim() || name;
  const photoTitle = (file) =>
    stripOrder(file.replace(/\.[^.]+$/, "")).replace(/[-_]+/g, " ").trim();

  /* ---------- Ambil daftar project & foto dari repo ---------- */
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

  // Satu request saja: seluruh isi repo (daftar file) sekaligus.
  async function fetchTree() {
    const { user, repo } = detectRepo();
    if (!user || !repo) throw new Error("no-repo");

    const refs = cfg.branch ? [cfg.branch] : ["HEAD", "main", "master"];
    let lastErr = new Error("github-404");
    for (const ref of refs) {
      const url = `https://api.github.com/repos/${user}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
      const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
      if (res.ok) return res.json();
      lastErr = new Error("github-" + res.status);
      if (res.status !== 404) break;
    }
    throw lastErr;
  }

  function groupsFromTree(data) {
    const prefix = cfg.imageFolder.replace(/^\/+|\/+$/g, "") + "/";
    const folders = new Map();
    const rootFiles = [];

    (data.tree || []).forEach((item) => {
      if (item.type !== "blob" || !item.path.startsWith(prefix)) return;
      const rel = item.path.slice(prefix.length);
      if (!okExt(rel)) return;
      const slash = rel.indexOf("/");
      if (slash === -1) {
        rootFiles.push(rel);
      } else {
        const folder = rel.slice(0, slash);
        if (!folders.has(folder)) folders.set(folder, []);
        folders.get(folder).push(rel.slice(slash + 1));
      }
    });

    return { folders: [...folders].map(([folder, files]) => ({ folder, files })), rootFiles };
  }

  // Cadangan (mis. tes di komputer): file images/images.json
  //   { "Project A": ["1.jpg", "2.jpg"], "Project B": ["a.jpg"] }
  async function fetchManifest() {
    const res = await fetch(`${cfg.imageFolder}/images.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error("no-manifest");
    const d = await res.json();
    if (Array.isArray(d)) return { folders: [], rootFiles: d.filter(okExt) };
    return {
      folders: Object.entries(d).map(([folder, files]) => ({ folder, files: files.filter(okExt) })),
      rootFiles: []
    };
  }

  function buildProjects({ folders, rootFiles }) {
    const list = folders
      .filter((f) => f.files.length)
      .sort((a, b) => natural(a.folder, b.folder))
      .map((f) => ({ folder: f.folder, title: folderTitle(f.folder), files: f.files }));

    if (rootFiles.length) list.push({ folder: null, title: cfg.rootTitle, files: rootFiles });

    return list.map((p, i) => {
      const info = cfg.projects[p.folder] || cfg.projects[p.title] || {};
      const base = p.folder ? `${cfg.imageFolder}/${encodePath(p.folder)}` : cfg.imageFolder;
      const photos = p.files
        .slice()
        .sort(natural)
        .map((rel) => ({
          src: `${base}/${encodePath(rel)}`,
          title: photoTitle(rel.split("/").pop())
        }));
      return { id: `project-${i + 1}`, title: p.title, year: info.year || "", desc: info.desc || "", photos };
    });
  }

  function messageFor(err) {
    const code = err && err.message;
    if (code === "no-repo")
      return "Alamat repo belum terdeteksi. Isi githubUser dan githubRepo di js/config.js.";
    if (code === "github-404")
      return "Repo tidak ditemukan. Pastikan repo berstatus Public dan namanya benar.";
    if (code === "github-403" || code === "github-429")
      return "Batas akses GitHub sedang tercapai. Coba muat ulang beberapa menit lagi.";
    return "Foto belum bisa dimuat. Coba muat ulang halaman.";
  }

  /* ---------- Roadmap (bagian atas) ---------- */
  function renderRoadmap(projects) {
    roadmap.replaceChildren();

    projects.forEach((p) => {
      const li = el("li", "node");
      const a = el("a");
      a.href = "#" + p.id;
      a.setAttribute("aria-label", `Lihat project ${p.title}`);

      a.append(el("span", "node-dot"));
      a.append(el("span", "node-title", p.title));
      if (p.year) a.append(el("span", "node-meta", p.year));
      a.append(el("span", "node-meta", `${p.photos.length} foto`));
      a.firstChild.setAttribute("aria-hidden", "true");

      a.addEventListener("click", (e) => {
        e.preventDefault();
        goToProject(p.id);
      });

      li.append(a);
      roadmap.append(li);
    });

    roadmapWrap.hidden = false;
  }

  // Loncat ke project di bagian karya
  function goToProject(id) {
    const target = document.getElementById(id);
    if (!target) return;
    const top =
      target.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop;
    scroller.scrollTo({ top, behavior: "auto" });
    pages.scrollTo({ top: $("#karya").offsetTop, behavior: "auto" }); // halus lewat CSS
  }

  /* ---------- Galeri per project ---------- */
  function renderGallery(projects) {
    inner.replaceChildren();

    const total = projects.reduce((n, p) => n + p.photos.length, 0);
    count.textContent = `${projects.length} project, ${total} foto`;

    projects.forEach((p) => {
      const section = el("section", "project");
      section.id = p.id;

      const head = el("header", "project-head");
      head.append(el("h3", null, p.title));
      head.append(el("p", "project-meta", [p.year, `${p.photos.length} foto`].filter(Boolean).join(", ")));
      section.append(head);

      if (p.desc) section.append(el("p", "project-desc", p.desc));

      const mosaic = el("div", "mosaic");
      p.photos.forEach((photo, i) => {
        const tile = el("button", "tile");
        tile.type = "button";
        tile.setAttribute(
          "aria-label",
          photo.title ? `Buka foto: ${photo.title}` : `Buka foto ${i + 1} dari ${p.title}`
        );

        const img = new Image();
        img.alt = photo.title;
        img.loading = "lazy";
        img.decoding = "async";
        img.draggable = false;
        img.addEventListener("load", () => {
          // Bentuk kotak mengikuti proporsi asli foto, jadi barisnya tetap rata
          if (img.naturalWidth && img.naturalHeight) {
            tile.style.setProperty("--ar", (img.naturalWidth / img.naturalHeight).toFixed(4));
          }
          tile.classList.add("loaded");
        });
        img.addEventListener("error", () => { tile.hidden = true; });
        img.src = photo.src;
        tile.append(img);

        if (photo.title) tile.append(el("span", "cap", photo.title));
        tile.addEventListener("click", () => openLightbox(p, i));
        mosaic.append(tile);
      });

      section.append(mosaic);
      inner.append(section);
    });
  }

  /* ---------- Foto besar (lapisan di atas halaman) ---------- */
  const dlg = $("#lightbox");
  const lbImg = $("#lbImg");
  const lbCap = $("#lbCap");
  const lbNum = $("#lbNum");
  let list = [];
  let listTitle = "";
  let current = 0;

  function show(i) {
    current = (i + list.length) % list.length;
    const photo = list[current];
    lbImg.src = photo.src;
    lbImg.alt = photo.title;
    lbCap.textContent = photo.title;
    lbNum.textContent = `${listTitle}, foto ${current + 1} dari ${list.length}`;
  }

  function openLightbox(project, i) {
    list = project.photos;
    listTitle = project.title;
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
  dlg.addEventListener("close", () => { lbImg.removeAttribute("src"); });

  // Geser jari untuk pindah foto (HP)
  let touchX = null;
  dlg.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  dlg.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  /* ---------- Mulai ---------- */
  async function load() {
    let groups;
    try {
      groups = groupsFromTree(await fetchTree());
    } catch (err) {
      try {
        groups = await fetchManifest();
      } catch {
        status.textContent = messageFor(err);
        return;
      }
    }

    const projects = buildProjects(groups);
    if (!projects.length) {
      status.textContent = `Belum ada foto. Buat folder project di dalam "${cfg.imageFolder}", lalu upload fotonya ke folder itu.`;
      return;
    }

    renderRoadmap(projects);
    renderGallery(projects);
  }

  load();
})();
