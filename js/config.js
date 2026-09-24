/* =====================================================
   Pengaturan website
   ===================================================== */
window.PORTFOLIO_CONFIG = {
  // Biarkan kosong: username dan nama repo dideteksi otomatis dari alamat
  // https://username.github.io/nama-repo/
  // Isi manual HANYA kalau pakai domain sendiri atau mengetes di komputer.
  githubUser: "",
  githubRepo: "",
  branch: "", // kosongkan = otomatis (branch utama repo)

  // Folder induk. Satu folder di dalamnya = satu project.
  // Contoh: images/Project A/foto1.jpg  ->  project "Project A"
  imageFolder: "images",

  // Jenis file yang ditampilkan
  extensions: ["jpg", "jpeg", "png", "webp", "gif", "avif"],

  // Judul untuk foto yang ditaruh langsung di images/ (tanpa folder project)
  rootTitle: "Lainnya",

  // Info tambahan tiap project (OPSIONAL).
  // Kunci = nama folder persis seperti di repo. Hapus contoh ini kalau tidak dipakai.
  projects: {
    "Project A": { year: "2024", desc: "Tulis deskripsi singkat project ini." },
    "Project B": { year: "2023", desc: "" }
  }
};
