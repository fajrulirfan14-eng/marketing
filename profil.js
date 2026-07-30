
window.initProfilView = async function() {
  const user = window.currentUser;
  if (!user) return;
  const LS_KEY        = 'ttn_cover_photo';
  const heroBg        = document.getElementById('profilHeroBg');
  const btnEditCover  = document.getElementById('btnEditCover');
  const coverDropdown = document.getElementById('coverDropdown');
  const btnGanti      = document.getElementById('btnGantiCover');
  const btnHapus      = document.getElementById('btnHapusCover');
  const inputFile     = document.getElementById('inputFotoCover');

  const savedPhoto = localStorage.getItem(LS_KEY);
  if (savedPhoto && heroBg) {
    heroBg.style.background     = `url(${savedPhoto}) center/cover no-repeat`;
    heroBg.style.backgroundSize = 'cover';
  }

  if (btnEditCover && !btnEditCover.dataset.listener) {
    btnEditCover.dataset.listener = 'true';
    btnEditCover.addEventListener('click', (e) => {
      e.stopPropagation();
      coverDropdown.classList.toggle('open');
    });
  }

  if (!window._profilDropdownListener) {
    window._profilDropdownListener = true;
    document.addEventListener('click', (e) => {
      if (!document.getElementById('coverEditWrap')?.contains(e.target)) {
        document.getElementById('coverDropdown')?.classList.remove('open');
      }
    });
  }
  if (btnGanti && !btnGanti.dataset.listener) {
    btnGanti.dataset.listener = 'true';
    btnGanti.addEventListener('click', () => {
      coverDropdown.classList.remove('open');
      if (window.AndroidBridge) AndroidBridge.setCoverPhotoMode(true);
      inputFile.click();
    });
  }
  if (inputFile && !inputFile.dataset.listener) {
    inputFile.dataset.listener = 'true';
    inputFile.addEventListener('change', () => {
      const file = inputFile.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        openCropModal(e.target.result);
      };
      reader.readAsDataURL(file);
      inputFile.value = '';
    });
  }
  if (btnHapus && !btnHapus.dataset.listener) {
    btnHapus.dataset.listener = 'true';
    btnHapus.addEventListener('click', () => {
      coverDropdown.classList.remove('open');
      localStorage.removeItem(LS_KEY);
      if (heroBg) {
        heroBg.style.background = '';
      }
      // Sync hapus ke header home juga
      const headerHome = document.querySelector(".headerHome");
      if (headerHome) {
        headerHome.style.backgroundImage = "";
        headerHome.style.backgroundSize = "";
        headerHome.style.backgroundPosition = "";
        headerHome.style.backgroundRepeat = "";
      }
    });
  }

  const initial = (user.nama || "A").charAt(0).toUpperCase();
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  setText("profilAvatar",      initial);
  setText("profilName",        user.nama || "-");
  setText("profilEmail",       user.email || "-");
  setText("profilNamaDetail",  user.nama || "-");
  setText("profilEmailDetail", user.email || "-");
  setText("profilTelpon",      user.noTelpon || "-");
  setText("profilJabatan",     user.role || "-");
  setText("profilCabang",      user.kantorCabang || "-");
  setText("profilBio",         user.motivasi || "-");

  // Avatar foto
  const avatarEl = document.getElementById("profilAvatar");
  if (avatarEl) {
    if (user.fotoURL) {
      avatarEl.innerHTML = `<img src="${user.fotoURL}" class="profil-avatar-img" alt="${user.nama}">`;
    } else {
      avatarEl.innerText = initial;
    }
  }
  // Status dot online/offline
  const statusDot = document.querySelector(".profil-avatar-status");
  if (statusDot) {
    const isOnline = navigator.onLine;
    statusDot.style.background = isOnline ? "var(--color-status-online)" : "#9e9e9e";
    statusDot.title = isOnline ? "Online" : "Offline";
  }
  if (!window._profilOnlineListener) {
    window._profilOnlineListener = true;
    window.addEventListener("online",  () => {
      const dot = document.querySelector(".profil-avatar-status");
      if (dot) dot.style.background = "var(--color-status-online)";
    });
    window.addEventListener("offline", () => {
      const dot = document.querySelector(".profil-avatar-status");
      if (dot) dot.style.background = "#9e9e9e";
    });
  }
  // Hide menu sesuai role
  const role = (user.role || "").toLowerCase();
  const hideMenuLabel = ["Slip Gaji", "Rolling Customer"];
  const hideMenuRole  = ["hunter", "sales"];
  document.querySelectorAll(".profil-menu-item").forEach(item => {
    const label = item.querySelector(".profil-menu-left span")?.innerText?.trim();
    if (hideMenuLabel.includes(label)) {
      const shouldHide = hideMenuRole.includes(role);
      item.style.display = shouldHide ? "none" : "";
      const sep = item.nextElementSibling;
      if (sep?.classList.contains("profil-card-sep")) {
        sep.style.display = shouldHide ? "none" : "";
      }
    }
  });
  const logoutModal = document.getElementById("logoutModal");
  const btnLogoutCancel = document.getElementById("btnLogoutCancel");
  const btnLogoutConfirm = document.getElementById("btnLogoutConfirm");
  if (logoutModal && !logoutModal.dataset.listener){
    logoutModal.dataset.listener = "true";
    btnLogoutCancel?.addEventListener(
      "click",
      () => {
        logoutModal.classList.remove("open");
      }
    );
    btnLogoutConfirm?.addEventListener(
      "click",
      async () => {
    
        logoutModal.classList.remove("open");
    
        const action =
          btnLogoutConfirm.dataset.action || "logout";
    
        if (action === "logoutall") {
    
          try {
    
            // Refresh token agar sesi lama invalid
            await window.auth.currentUser?.getIdToken(true);
    
          } catch(e) {
            console.log(e);
          }
    
          window.logout();
    
        } else {
    
          window.logout();
    
        }
    
        btnLogoutConfirm.dataset.action = "logout";
    
      }
    );
  
    logoutModal.addEventListener(
      "click",
      (e) => {
  
        if(e.target === logoutModal){
          logoutModal.classList.remove("open");
        }
  
      }
    );
  
  }
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout && !btnLogout.dataset.listener) {
    btnLogout.dataset.listener = "true";
    btnLogout.addEventListener("click", () => {
      document.getElementById("logoutModalTitle").innerText = "Logout Akun";
      document.getElementById("logoutModalDesc").innerText = "Apakah Anda yakin ingin keluar dari aplikasi?";
      document.getElementById("btnLogoutConfirm").dataset.action = "logout";
      document.getElementById("logoutModal")?.classList.add("open");
    });
  }
  // Bottom sheet edit profil
  const btnEditProfil = document.getElementById("btnEditProfil");
  if (btnEditProfil && !btnEditProfil.dataset.listener) {
    btnEditProfil.dataset.listener = "true";
    btnEditProfil.addEventListener("click", () => openEditProfilSheet());
  }
};
async function openEditProfilSheet() {
  const existing = document.getElementById("editProfilOverlay");
  if (existing) existing.remove();

  const user = window.currentUser || {};
  const overlay = document.createElement("div");
  overlay.id = "editProfilOverlay";
  overlay.className = "edit-profil-overlay";

  overlay.innerHTML = `
    <div class="edit-profil-sheet" id="editProfilSheet">
      <div class="edit-profil-handle"></div>
      <div class="edit-profil-title">Edit Profil</div>

      <!-- Foto Profil -->
      <div class="edit-profil-foto-section">
        <div class="edit-profil-foto-wrap">
          <div class="edit-profil-foto" id="editProfilFotoPreview">
            ${user.fotoURL
              ? `<img src="${user.fotoURL}" class="edit-profil-foto-img" alt="">`
              : `<span class="edit-profil-foto-initial">${(user.nama || "A").charAt(0).toUpperCase()}</span>`
            }
          </div>
        </div>
        <div class="edit-profil-foto-actions">
          <button class="edit-profil-foto-btn" id="btnGantiFotoProfil">
            <i class="fa-solid fa-camera"></i> Ganti Foto
          </button>
          ${user.fotoURL ? `
            <button class="edit-profil-foto-btn danger" id="btnHapusFotoProfil">
              <i class="fa-solid fa-trash"></i> Hapus Foto
            </button>
          ` : ""}
        </div>
        <input type="file" id="inputFotoProfil" accept="image/*" hidden>
      </div>

      <!-- Bio -->
      <div class="edit-profil-field">
        <label class="edit-profil-label">Bio</label>
        <textarea class="edit-profil-textarea" id="editProfilBio" rows="3" placeholder="Tulis bio kamu...">${user.motivasi || ""}</textarea>
      </div>

      <button class="edit-profil-simpan" id="btnSimpanEditProfil">
        <span id="editProfilSimpanText">Simpan</span>
      </button>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("active"));

  // Swipe close
  const sheet = document.getElementById("editProfilSheet");
  let startY = 0, swipeActive = false;
  sheet.addEventListener("touchstart", e => {
    if (e.target.closest("textarea, input")) { swipeActive = false; return; }
    if (sheet.scrollTop > 0) { swipeActive = false; return; }
    startY = e.touches[0].clientY;
    swipeActive = true;
    sheet.style.transition = "none";
  }, { passive: true });
  sheet.addEventListener("touchmove", e => {
    if (!swipeActive) return;
    const d = e.touches[0].clientY - startY;
    if (d > 0) sheet.style.transform = `translateY(${d}px)`;
  }, { passive: true });
  sheet.addEventListener("touchend", e => {
    if (!swipeActive) return;
    swipeActive = false;
    const d = e.changedTouches[0].clientY - startY;
    sheet.style.transition = "transform .3s ease";
    if (d > 120) { closeEditProfilSheet(); } else { sheet.style.transform = ""; }
  });

  overlay.addEventListener("click", e => { if (e.target === overlay) closeEditProfilSheet(); });

  function closeEditProfilSheet() {
    overlay.classList.remove("active");
    setTimeout(() => overlay.remove(), 300);
  }

  // Ganti foto
  const inputFoto = document.getElementById("inputFotoProfil");
  document.getElementById("btnGantiFotoProfil").onclick = () => inputFoto.click();

  inputFoto.addEventListener("change", async () => {
    const file = inputFoto.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    document.getElementById("editProfilFotoPreview").innerHTML = `<img src="${url}" class="edit-profil-foto-img" alt="">`;
    window._editProfilFotoFile = file;
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });

  // Hapus foto
  document.getElementById("btnHapusFotoProfil")?.addEventListener("click", async () => {
    try {
      await window.updateDoc(window.doc(window.db, "users", window.auth.currentUser.uid), { fotoURL: window.deleteField() });
      window.currentUser.fotoURL = null;
      localStorage.setItem("userCache", JSON.stringify(window.currentUser));
      document.getElementById("profilAvatar").innerText = (window.currentUser.nama || "A").charAt(0).toUpperCase();
      document.getElementById("editProfilFotoPreview").innerHTML = `<span class="edit-profil-foto-initial">${(window.currentUser.nama || "A").charAt(0).toUpperCase()}</span>`;
    } catch { }
  });

  // Simpan
  document.getElementById("btnSimpanEditProfil").onclick = async () => {
    const btn     = document.getElementById("btnSimpanEditProfil");
    const btnText = document.getElementById("editProfilSimpanText");
    btn.disabled  = true;
    btnText.textContent = "Menyimpan...";

    try {
      const uid    = window.auth.currentUser?.uid;
      const bio    = document.getElementById("editProfilBio").value.trim();
      const update = { motivasi: bio };

      // Upload foto kalau ada
      if (window._editProfilFotoFile) {
        try {
          const compressed = await compressProfilFoto(window._editProfilFotoFile);
          const sRef = window.storageRef(window.storage, `fotoUsers/${uid}`);
          await window.uploadBytes(sRef, compressed, { contentType: "image/jpeg" });
          const fotoURL = await window.getDownloadURL(sRef);
          update.fotoURL = fotoURL;
          window.currentUser.fotoURL = fotoURL;
          // Update avatar di profil
          document.getElementById("profilAvatar").innerHTML = `<img src="${fotoURL}" class="profil-avatar-img" alt="">`;
        } catch { }
        window._editProfilFotoFile = null;
      }

      await window.updateDoc(window.doc(window.db, "users", uid), update);
      window.currentUser.motivasi = bio;
      localStorage.setItem("userCache", JSON.stringify(window.currentUser));

      // Update UI
      document.getElementById("profilBio").innerText = bio || "-";

      btnText.textContent = "Tersimpan ✓";
      btn.style.background = "#2eaf62";
      setTimeout(() => closeEditProfilSheet(), 800);
    } catch {
      btnText.textContent = "Gagal";
      btn.style.background = "#e53935";
      setTimeout(() => {
        btn.disabled = false;
        btnText.textContent = "Simpan";
        btn.style.background = "";
      }, 2000);
    }
  };
}
async function compressProfilFoto(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        const max = 400;
        if (w > h) { if (w > max) { h = h * max / w; w = max; } }
        else { if (h > max) { w = w * max / h; h = max; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => resolve(blob), "image/jpeg", 0.7);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

if (!window._profilMenuListener) {
  window._profilMenuListener = true;
  const MENU_MAP = {
    "Tentang Aplikasi"    : () => window.showView("tentang"),
    "Keamanan Akun"       : () => window.showView("keamanan"),
    "Perjanjian Kerja"    : () => window.showView("perjanjian"),
    "Peraturan Perusahaan": () => window.showView("peraturan"),
    "SOP"                 : () => window.showView("sop"),
    "Rolling Customer"    : () => window.showView("rollingcustomer"),
    "Aksesbilitas"        : () => window.openAksesibilitas(),
    "Slip Gaji"           : () => { window.showView("slip"); setTimeout(() => window.initSlipView?.(), 50); },
  };
  document.querySelectorAll(".profil-menu-item").forEach(item => {
    const label = item.querySelector(".profil-menu-left span")?.innerText?.trim();
    if (MENU_MAP[label]) {
      item.addEventListener("click", MENU_MAP[label]);
    }
  });
}

/* ─── AKSESIBILITAS PANEL ─── */
window.openAksesibilitas = function() {
  if (document.getElementById("aksesPanel")) {
    _showAksesPanel();
    return;
  }

  // ── Settings config — tambah/hapus item di sini ──
  const SETTINGS = [
    {
      id:      "modeDark",
      icon:    "fa-solid fa-moon",
      label:   "Mode Gelap",
      desc:    "Tampilan lebih nyaman di malam hari",
      type:    "toggle",
      value:   () => localStorage.getItem("pref_dark") === "1",
      onChange: (val) => {
        localStorage.setItem("pref_dark", val ? "1" : "0");
        applyDarkMode(val);

        // Update icon & label di panel supaya langsung berubah
        const item = document.querySelector('.aks-item[data-id="modeDark"]');
        if(item){
          item.querySelector(".aks-item-icon i").className = val
            ? "fa-solid fa-sun"
            : "fa-solid fa-moon";
          item.querySelector(".aks-item-label").innerText = val
            ? "Mode Terang"
            : "Mode Gelap";
          item.querySelector(".aks-item-desc").innerText = val
            ? "Klik untuk beralih ke mode gelap"
            : "Tampilan lebih nyaman di malam hari";
        }
      }
    },
    {
      id:      "aiToggle",
      icon:    "fa-solid fa-robot",
      label:   "Aktifkan AI Chat",
      desc:    "Tampilkan menu Chat AI di navigasi",
      type:    "toggle",
      value:   () => localStorage.getItem("pref_ai") !== "0",
      onChange: (val) => {
        localStorage.setItem("pref_ai", val ? "1" : "0");
        val ? showAiButton() : hideAiButton();
      }
    },
    {
      id:      "animasi",
      icon:    "fa-solid fa-wand-magic-sparkles",
      label:   "Animasi UI",
      desc:    "Efek transisi dan animasi halaman",
      type:    "toggle",
      value:   () => localStorage.getItem("pref_anim") !== "0",
      onChange: (val) => {
        localStorage.setItem("pref_anim", val ? "1" : "0");
        applyAnimasi(val);
      }
    },
    {
      id:      "notifSound",
      icon:    "fa-solid fa-bell",
      label:   "Suara Notifikasi",
      desc:    "Bunyi saat ada notifikasi masuk",
      type:    "toggle",
      value:   () => localStorage.getItem("pref_sound") === "1",
      onChange: (val) => {
        localStorage.setItem("pref_sound", val ? "1" : "0");
      }
    },
    {
      id:      "fontSize",
      icon:    "fa-solid fa-text-height",
      label:   "Ukuran Teks",
      desc:    "Sesuaikan ukuran font aplikasi",
      type:    "stepper",
      min:     FONT_CONFIG.min,
      max:     FONT_CONFIG.max,
      step:    FONT_CONFIG.step,
      value:   () => parseFloat(localStorage.getItem("pref_font_val") || "0"),
      onChange: (val) => {
        localStorage.setItem("pref_font_val", val);
        applyFontSizeDelta(val);
      }
    },
  ];

  // ── Build HTML ──
  function buildItem(s) {
    if (s.type === "toggle") {
      const checked = s.value() ? "checked" : "";

      // modeDark: icon & label ikut state aktif
      let icon  = s.icon;
      let label = s.label;
      let desc  = s.desc;
      if(s.id === "modeDark" && s.value()){
        icon  = "fa-solid fa-sun";
        label = "Mode Terang";
        desc  = "Klik untuk beralih ke mode gelap";
      }

      return `
        <div class="aks-item" data-id="${s.id}">
          <div class="aks-item-left">
            <div class="aks-item-icon"><i class="${icon}"></i></div>
            <div class="aks-item-text">
              <span class="aks-item-label">${label}</span>
              <span class="aks-item-desc">${desc}</span>
            </div>
          </div>
          <label class="aks-toggle">
            <input type="checkbox" data-id="${s.id}" ${checked}>
            <span class="aks-toggle-track">
              <span class="aks-toggle-thumb"></span>
            </span>
          </label>
        </div>`;
    }
    if (s.type === "stepper") {
      const val = s.value();
      const pct = ((val - s.min) / (s.max - s.min)) * 100;
      return `
        <div class="aks-item aks-item--stepper" data-id="${s.id}">
          <div class="aks-item-left">
            <div class="aks-item-icon"><i class="${s.icon}"></i></div>
            <div class="aks-item-text">
              <span class="aks-item-label">${s.label}</span>
              <span class="aks-item-desc">${s.desc}</span>
            </div>
          </div>
          <div class="aks-stepper-val" data-id="${s.id}">${val > 0 ? "+" : ""}${val}</div>
        </div>
        <div class="aks-stepper-row" data-id="${s.id}">
          <button class="aks-step-btn" data-id="${s.id}" data-dir="-1">−</button>
          <div class="aks-track-wrap">
            <div class="aks-track">
              <div class="aks-track-fill" data-id="${s.id}" style="width:${pct}%"></div>
              <div class="aks-thumb" data-id="${s.id}" style="left:${pct}%"></div>
            </div>
          </div>
          <button class="aks-step-btn" data-id="${s.id}" data-dir="1">+</button>
        </div>`;
    }
    if (s.type === "select") {
      const opts = s.options.map(o =>
        `<option value="${o}" ${s.value() === o ? "selected" : ""}>${o}</option>`
      ).join("");
      return `
        <div class="aks-item" data-id="${s.id}">
          <div class="aks-item-left">
            <div class="aks-item-icon"><i class="${s.icon}"></i></div>
            <div class="aks-item-text">
              <span class="aks-item-label">${s.label}</span>
              <span class="aks-item-desc">${s.desc}</span>
            </div>
          </div>
          <select class="aks-select" data-id="${s.id}">${opts}</select>
        </div>`;
    }
    return "";
  }

  const itemsHTML = SETTINGS.map(buildItem).join("");

  // ── Inject DOM ──
  const panel = document.createElement("div");
  panel.id = "aksesPanel";
  panel.innerHTML = `
    <div class="aks-backdrop" id="aksBackdrop"></div>
    <div class="aks-drawer" id="aksDrawer">
      <div class="aks-handle"></div>
      <div class="aks-header">
        <div class="aks-header-title">
          <i class="fa-solid fa-sliders"></i>
          <span>Aksesibilitas</span>
        </div>
        <button class="aks-close" id="aksClose">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="aks-body">${itemsHTML}</div>
      <div class="aks-footer">
        <button class="aks-reset" id="aksReset">
          <i class="fa-solid fa-rotate-left"></i> Reset ke Default
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // ── Inject CSS ──
  if (!document.getElementById("aksesCss")) {
    const link = document.createElement("link");
    link.id   = "aksesCss";
    link.rel  = "stylesheet";
    link.href = "aksesibilitas.css";
    document.head.appendChild(link);
  }
  if (!document.getElementById("aksStepperCss")) {
    const s = document.createElement("style");
    s.id = "aksStepperCss";
    s.textContent = `
      .aks-item--stepper { padding-bottom: 4px; }
      .aks-stepper-val {
        font-size: 13px; font-weight: 700;
        color: #B08A5C; min-width: 28px;
        text-align: right; flex-shrink: 0;
      }
      .aks-stepper-row {
        display: flex; align-items: center;
        gap: 10px; padding: 4px 0 14px;
      }
      .aks-step-btn {
        width: 30px; height: 30px; border-radius: 50%;
        border: none; background: #fdf0e0;
        color: #B08A5C; font-size: 18px; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: .15s; flex-shrink: 0; line-height: 1;
      }
      .aks-step-btn:active { transform: scale(.9); background: #f5e0c8; }
      .aks-step-btn:disabled { opacity: .3; cursor: not-allowed; }
      .aks-track-wrap { flex: 1; padding: 6px 0; }
      .aks-track {
        position: relative; height: 4px;
        background: #f0e6d8; border-radius: 99px;
      }
      .aks-track-fill {
        position: absolute; left: 0; top: 0; height: 100%;
        background: #B08A5C; border-radius: 99px;
        transition: width .2s ease;
      }
      .aks-thumb {
        position: absolute; top: 50%;
        transform: translate(-50%, -50%);
        width: 18px; height: 18px; border-radius: 50%;
        background: #B08A5C;
        box-shadow: 0 1px 4px rgba(176,138,92,.4);
        transition: left .15s ease;
        cursor: grab; touch-action: none;
      }
      .aks-thumb:active { cursor: grabbing; transform: translate(-50%, -50%) scale(1.2); }
    `;
    document.head.appendChild(s);
  }

  // ── Events ──
  function closePanel() {
    drawer.style.transition = "";
    drawer.style.transform  = "";
    panel.classList.remove("open");
    setTimeout(() => {
      panel.style.display = "none";
      drawer.style.transform = "";
    }, 380);
  }
  document.getElementById("aksClose").addEventListener("click", closePanel);
  document.getElementById("aksBackdrop").addEventListener("click", closePanel);
  // Swipe kanan untuk tutup
  const drawer = document.getElementById("aksDrawer");
  let swipeStartX = 0, swipeStartY = 0, swipeActive = false, swipeLocked = false;

  drawer.addEventListener("touchstart", e => {
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
    swipeActive = true;
    swipeLocked = false;
  }, { passive: true });

  drawer.addEventListener("touchmove", e => {
    if (!swipeActive || swipeLocked) return;
    const dx = e.touches[0].clientX - swipeStartX;
    const dy = Math.abs(e.touches[0].clientY - swipeStartY);

    // Kalau lebih banyak scroll vertikal — lock, jangan swipe
    if (dy > Math.abs(dx) && dy > 8) {
      swipeLocked = true;
      drawer.style.transition = "";
      drawer.style.transform = "";
      return;
    }

    if (dx > 0) {
      e.preventDefault();
      drawer.style.transition = "none";
      drawer.style.transform = `translateX(${dx}px)`;
    }
  }, { passive: false });

  drawer.addEventListener("touchend", e => {
    if (!swipeActive || swipeLocked) return;
    swipeActive = false;
    const dx = e.changedTouches[0].clientX - swipeStartX;
    drawer.style.transition = "";
    if (dx > 80) {
      closePanel();
    } else {
      drawer.style.transform = "";
    }
  }, { passive: true });
  // Stepper change
  function updateStepper(id, newVal) {
    const setting = SETTINGS.find(s => s.id === id);
    if (!setting) return;
    newVal = Math.max(setting.min, Math.min(setting.max, newVal));
    const pct = ((newVal - setting.min) / (setting.max - setting.min)) * 100;

    const display = newVal.toFixed(FONT_CONFIG.decimals);
    panel.querySelector(`.aks-stepper-val[data-id="${id}"]`).textContent =
      (newVal > 0 ? "+" : "") + display;
    panel.querySelector(`.aks-track-fill[data-id="${id}"]`).style.width = pct + "%";
    panel.querySelector(`.aks-thumb[data-id="${id}"]`).style.left = pct + "%";

    // Disable tombol di batas
    panel.querySelectorAll(`.aks-step-btn[data-id="${id}"]`).forEach(btn => {
      const dir = parseInt(btn.dataset.dir);
      btn.disabled = (dir === -1 && newVal <= setting.min) ||
                     (dir ===  1 && newVal >= setting.max);
    });

    setting.onChange(newVal);
  }

  panel.querySelectorAll(".aks-step-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id      = btn.dataset.id;
      const setting = SETTINGS.find(s => s.id === id);
      const cur     = setting.value();
      const dir     = parseInt(btn.dataset.dir);
      const next    = parseFloat((cur + dir * FONT_CONFIG.step).toFixed(FONT_CONFIG.decimals));
      updateStepper(id, next);
    });
  });
  // Drag thumb
  SETTINGS.filter(s => s.type === "stepper").forEach(s => {
    const thumb = panel.querySelector(`.aks-thumb[data-id="${s.id}"]`);
    const track = thumb.closest(".aks-track");

    function onMove(clientX) {
      const rect = track.getBoundingClientRect();
      let pct = (clientX - rect.left) / rect.width;
      pct = Math.max(0, Math.min(1, pct));
      const raw     = s.min + pct * (s.max - s.min);
      const snap    = FONT_CONFIG.snapStep;
      const snapped = Math.round(raw / snap) * snap;
      const final   = parseFloat(snapped.toFixed(FONT_CONFIG.decimals));
      updateStepper(s.id, snapped);
    }

    // Mouse
    thumb.addEventListener("mousedown", e => {
      e.preventDefault();
      const onMouseMove = e => onMove(e.clientX);
      const onMouseUp   = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup",   onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup",   onMouseUp);
    });

    // Touch
    thumb.addEventListener("touchstart", e => {
      e.preventDefault();
      const onTouchMove = e => onMove(e.touches[0].clientX);
      const onTouchEnd  = () => {
        document.removeEventListener("touchmove", onTouchMove);
        document.removeEventListener("touchend",  onTouchEnd);
      };
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend",  onTouchEnd);
    }, { passive: false });

    // Tap on track (selain thumb)
    track.addEventListener("click", e => {
      if (e.target === thumb) return;
      onMove(e.clientX);
    });
  });

  // Init disable state tombol
  SETTINGS.filter(s => s.type === "stepper").forEach(s => {
    const val = s.value();
    panel.querySelectorAll(`.aks-step-btn[data-id="${s.id}"]`).forEach(btn => {
      const dir = parseInt(btn.dataset.dir);
      btn.disabled = (dir === -1 && val <= s.min) ||
                     (dir ===  1 && val >= s.max);
    });
  });

  // Toggle change
  panel.querySelectorAll(".aks-toggle input").forEach(input => {
    input.addEventListener("change", () => {
      const setting = SETTINGS.find(s => s.id === input.dataset.id);
      setting?.onChange(input.checked);
    });
  });

  // Select change
  panel.querySelectorAll(".aks-select").forEach(select => {
    select.addEventListener("change", () => {
      const setting = SETTINGS.find(s => s.id === select.dataset.id);
      setting?.onChange(select.value);
    });
  });

  // Reset
  document.getElementById("aksReset").addEventListener("click", () => {
    SETTINGS.forEach(s => {
      localStorage.removeItem("pref_" + s.id
        .replace("modeDark","dark")
        .replace("aiToggle","ai")
        .replace("animasi","anim")
        .replace("notifSound","sound")
        .replace("fontSize","font")
        .replace("bahasa","lang")
      );
    });
    localStorage.removeItem("pref_font_val");
    applyFontSizeDelta(0);
    applyDarkMode(false);
    // Re-render
    closePanel();
    setTimeout(() => {
      panel.remove();
      window.openAksesibilitas();
    }, 400);
  });

  _showAksesPanel();
};
// ── Font Size Config — ubah di sini ──
const FONT_CONFIG = {
  min:       -2,
  max:        2,
  step:       0.2,
  snapStep:   0.2,
  decimals:   1,
};
// ── Animasi config ──
function applyAnimasi(val) {
  if (!val) {
    document.documentElement.classList.add("no-anim");
  } else {
    document.documentElement.classList.remove("no-anim");
  }
}
(function initAnimasi() {
  const saved = localStorage.getItem("pref_anim");
  if (saved === "0") applyAnimasi(false);
})();
function applyFontSizeDelta(delta) {
  let styleEl = document.getElementById("appFontStyle");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "appFontStyle";
    document.head.appendChild(styleEl);
  }

  if (delta === 0) { styleEl.textContent = ""; return; }

  const op      = delta > 0 ? "+" : "-";
  const absDelta = Math.abs(delta).toFixed(FONT_CONFIG.decimals);

  styleEl.textContent = `
    body, body * {
      font-size: calc(1em ${op} ${absDelta}px) !important;
    }

    /* List item padding */
    .extra-item,
    .home-customer-box,
    .rolling-customer-item,
    .laporan-harian-item,
    .customer-sales-item,
    .profil-card-item,
    .profil-menu-item,
    .aks-item,
    .kantor-list-item,
    .notif-item {
      padding: calc(0.75em ${op} ${absDelta}px) !important;
    }

    /* Input & button tinggi */
    .hunter-popup-group input,
    .rolling-data-input,
    .data-awal-input,
    .customer-sales-search-input,
    .map-search-input {
      height: calc(42px ${op} ${absDelta}px) !important;
    }
    .hunter-btn-simpan,
    .hunter-btn-lokasi,
    .rolling-btn-update {
      height: calc(52px ${op} ${absDelta}px) !important;
    }

    /* Avatar */
    .avatar {
      width: calc(100px ${op} ${absDelta}px) !important;
      height: calc(100px ${op} ${absDelta}px) !important;
    }
    .profil-avatar {
      width: calc(100px ${op} ${absDelta}px) !important;
      height: calc(100px ${op} ${absDelta}px) !important;
    }

    /* Icon box */
    .profil-card-icon,
    .aks-item-icon,
    .home-customer-plus,
    .home-sales-plus,
    .home-kantor-btn,
    .home-map-btn,
    .home-notif-btn,
    .home-reload-btn {
      width: calc(36px ${op} ${absDelta}px) !important;
      height: calc(36px ${op} ${absDelta}px) !important;
    }

    /* Rolling avatar */
    .rolling-avatar,
    .customer-sales-avatar {
      width: calc(42px ${op} ${absDelta}px) !important;
      height: calc(42px ${op} ${absDelta}px) !important;
    }
  `;
}
(function initFontSize() {
  const saved = parseFloat(localStorage.getItem("pref_font_val") || "0");
  if (saved !== 0) applyFontSizeDelta(saved);
})();
function _showAksesPanel() {
  const panel = document.getElementById("aksesPanel");
  panel.style.display = "block";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => panel.classList.add("open"));
  });
}
