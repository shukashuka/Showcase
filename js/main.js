/* ============================================================
   Logic utama situs. Biasanya tidak perlu diedit —
   semua data yang perlu diganti ada di js/data.js
============================================================= */
(function(){
  const isMobile = window.matchMedia('(max-width: 900px)').matches;

  /* ---------- Background images per panel (fallback ke gradient CSS jika file belum ada) ---------- */
  document.querySelectorAll('.panel[data-bg]').forEach(p=>{
    p.style.backgroundImage = `url('${p.dataset.bg}')`;
  });

  /* ---------- 3D animated background (Three.js) ---------- */
  let scene, camera, renderer, mesh;
  function initBG3D(){
    const canvas = document.getElementById('bg3d');
    if(!window.THREE || !canvas) return;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, .1, 100);
    camera.position.z = 6;
    renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setSize(innerWidth, innerHeight);

    const geo = new THREE.IcosahedronGeometry(2.2, 0);
    const mat = new THREE.MeshBasicMaterial({color:0xc8983f, wireframe:true, transparent:true, opacity:.5});
    mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    window.addEventListener('resize', ()=>{
      camera.aspect = innerWidth/innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
    animateBG();
  }
  function animateBG(){
    requestAnimationFrame(animateBG);
    if(mesh){ mesh.rotation.x += .0016; mesh.rotation.y += .0022; }
    renderer.render(scene, camera);
  }
  // Ganti warna & bentuk background 3D setiap pindah section
  const bgColors = [0xc8983f, 0x2f7a6d, 0xe2703b];
  function setBGColorForPanel(i){
    if(mesh) mesh.material.color.setHex(bgColors[i % bgColors.length]);
  }
  initBG3D();

  /* ---------- Fullpage scroll (desktop only) ---------- */
  const container = document.getElementById('fp-container');
  const panels = Array.from(document.querySelectorAll('.panel'));
  let current = 0, animating = false;

  function goToPanel(i){
    if(i < 0 || i >= panels.length || animating) return;
    animating = true;
    current = i;
    container.style.transform = `translateY(-${i * 100}vh)`;
    setBGColorForPanel(i);
    setTimeout(()=>{ animating = false; }, 850);
  }

  if(!isMobile){
    window.addEventListener('wheel', (e)=>{
      if(e.deltaY > 30) goToPanel(current+1);
      else if(e.deltaY < -30) goToPanel(current-1);
    }, {passive:true});
    window.addEventListener('keydown', (e)=>{
      if(e.key === 'ArrowDown' || e.key === 'PageDown') goToPanel(current+1);
      if(e.key === 'ArrowUp' || e.key === 'PageUp') goToPanel(current-1);
    });
    let touchStartY = null;
    window.addEventListener('touchstart', e=> touchStartY = e.touches[0].clientY, {passive:true});
    window.addEventListener('touchend', e=>{
      if(touchStartY===null) return;
      const dy = touchStartY - e.changedTouches[0].clientY;
      if(dy > 50) goToPanel(current+1);
      else if(dy < -50) goToPanel(current-1);
      touchStartY = null;
    }, {passive:true});
  }

  /* ---------- Skill infographic ---------- */
  const infEl = document.getElementById('skill-infographic');
  if(infEl && window.SKILLS){
    SKILLS.forEach(s=>{
      const row = document.createElement('div');
      row.className = 'skill-row';
      row.innerHTML = `<span class="skill-name">${s.name}</span>
        <span class="skill-bar"><span class="skill-fill" style="width:0"></span></span>
        <span class="skill-lvl">${s.level}/10</span>`;
      infEl.appendChild(row);
      requestAnimationFrame(()=>{
        setTimeout(()=>{
          row.querySelector('.skill-fill').style.width = (s.level*10) + '%';
        }, 300);
      });
    });
  }

  /* ---------- Profile section ---------- */
  const profileEl = document.getElementById('profile-content');
  if(profileEl && window.PROFILE){
    profileEl.innerHTML = `
      <div class="profile-cat">
        <h3>Skill</h3>
        ${PROFILE.skills.map(s=>`<span class="chip">${s}</span>`).join('')}
      </div>
      <div class="profile-cat">
        <h3>Bahasa</h3>
        ${PROFILE.languages.map(l=>`<span class="chip">${l}</span>`).join('')}
      </div>
      <div class="profile-cat">
        <h3>Kontak</h3>
        <div class="contact-list">
          ${PROFILE.contacts.map(c=>`<a href="${c.href}" target="_blank" rel="noopener">
            <span class="icon3d">${c.icon}</span> ${c.label}</a>`).join('')}
        </div>
      </div>`;
  }

  /* ---------- Projects: auto-load from /Projects via GitHub API ---------- */
  const IMG_EXT = /\.(jpe?g|png|webp|gif)$/i;
  const grid = document.getElementById('projects-grid');

  async function loadProjects(){
    if(!window.GITHUB_CONFIG){ grid.innerHTML = '<p class="loading-note">GITHUB_CONFIG belum diisi di js/data.js</p>'; return; }
    const {user, repo, branch} = GITHUB_CONFIG;
    const base = `https://api.github.com/repos/${user}/${repo}/contents/Projects?ref=${branch}`;
    try{
      const res = await fetch(base);
      if(!res.ok) throw new Error('Gagal mengambil folder Projects (' + res.status + ')');
      const items = await res.json();
      const folders = items.filter(i => i.type === 'dir');
      if(folders.length === 0){
        grid.innerHTML = '<p class="loading-note">Folder Projects masih kosong. Tambahkan folder project di dalamnya, lalu commit & push.</p>';
        return;
      }
      grid.innerHTML = '';
      for(const folder of folders){
        const imgRes = await fetch(folder.url + `?ref=${branch}`);
        const files = await imgRes.json();
        const images = (Array.isArray(files) ? files : [])
          .filter(f => IMG_EXT.test(f.name))
          .map(f => f.download_url);
        if(images.length === 0) continue;
        grid.appendChild(buildProjectCard(folder.name, images));
      }
    }catch(err){
      grid.innerHTML = `<p class="loading-note">Tidak bisa memuat project otomatis (${err.message}).
        Pastikan repo bersifat publik dan GITHUB_CONFIG di js/data.js sudah benar. Lihat GUIDE.md.</p>`;
    }
  }

  function buildProjectCard(name, images){
    const card = document.createElement('div');
    card.className = 'proj-card';
    const stack = images.slice(0,3).map(src => `<img src="${src}" alt="${name}" loading="lazy">`).join('');
    card.innerHTML = `<div class="stack">${stack}</div><div class="proj-name">${name}</div>`;
    card.addEventListener('click', () => openOverlay(name, images));
    return card;
  }

  /* ---------- Overlay gallery + lightbox ---------- */
  const overlay = document.getElementById('project-overlay');
  const overlayGrid = document.getElementById('overlay-grid');
  const overlayTitle = document.getElementById('overlay-title');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');

  function openOverlay(name, images){
    overlayTitle.textContent = name;
    overlayGrid.innerHTML = images.map(src => `<img src="${src}" alt="${name}" loading="lazy">`).join('');
    overlayGrid.querySelectorAll('img').forEach(img=>{
      img.addEventListener('click', () => { lightboxImg.src = img.src; lightbox.classList.add('open'); });
    });
    overlay.classList.add('open');
  }
  document.getElementById('overlay-close').addEventListener('click', ()=> overlay.classList.remove('open'));
  document.getElementById('lightbox-close').addEventListener('click', ()=> lightbox.classList.remove('open'));
  lightbox.addEventListener('click', e=>{ if(e.target===lightbox) lightbox.classList.remove('open'); });
  window.addEventListener('keydown', e=>{
    if(e.key==='Escape'){ overlay.classList.remove('open'); lightbox.classList.remove('open'); }
  });

  loadProjects();
})();
