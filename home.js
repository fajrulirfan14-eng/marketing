
// ── NOTIFIKASI ────────────────────────────────────────────────────────────────
window.initNotifikasi = async function() {
  const btn     = document.getElementById("homeNotifBtn");
  const badge   = document.getElementById("homeNotifBadge");
  if (!btn) return;

  const uid  = window.auth?.currentUser?.uid;
  const role = (window.currentUser?.role || "").toLowerCase();
  if (!uid) return;

  // Load notifikasi dari Firestore
  async function loadNotifikasi() {
    try {
      const q = window.query(
        window.collection(window.db, "notifikasi"),
        window.where("type", "==", "kurir")
      );
      const snap = await window.getDocs(q);
      const all  = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Filter yang uid ada di dibaca
      const milik = all.filter(n => n.dibaca && uid in n.dibaca);
      // Badge — belum dibaca
      const belumDibaca = milik.filter(n => n.dibaca[uid] === false);
      if (badge) {
        if (belumDibaca.length > 0) {
          badge.textContent = belumDibaca.length > 99 ? "99+" : belumDibaca.length;
          badge.style.display = "flex";
        } else {
          badge.style.display = "none";
        }
      }

      return { belumDibaca, history: milik.filter(n => n.dibaca[uid] === true) };
    } catch(e) {
      return { belumDibaca: [], history: [] };
    }
  }

  // Render popup
  async function openPopupNotif() {
    const existing = document.getElementById("popupNotifOverlay");
    if (existing) existing.remove();

    const { belumDibaca, history } = await loadNotifikasi();

    const overlay = document.createElement("div");
    overlay.id = "popupNotifOverlay";
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      background:rgba(0,0,0,.5);
      display:flex;align-items:flex-end;justify-content:center;
      opacity:0;transition:opacity .25s ease;
    `;

    function renderNotifItem(n, sudahDibaca) {
      const createdAt = n.createdAt?.toDate
        ? n.createdAt.toDate().toLocaleDateString("id-ID", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
        : n.createdAt ? new Date(n.createdAt).toLocaleDateString("id-ID", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "-";
      return `
        <div class="notif-item ${sudahDibaca ? "notif-read" : "notif-unread"}" data-id="${n.id}">
          ${n.foto ? `<img class="notif-foto" src="${n.foto}" alt="">` : `<div class="notif-foto-empty"></div>`}
          <div class="notif-content">
            <div class="notif-judul">${n.judul || "-"}</div>
            <div class="notif-pesan">${n.pesan || "-"}</div>
            <div class="notif-waktu">${createdAt}</div>
          </div>
          ${!sudahDibaca ? `<div class="notif-dot"></div>` : ""}
        </div>
      `;
    }

    overlay.innerHTML = `
      <div id="popupNotifBox" style="
        width:100%;max-width:540px;max-height:88dvh;
        background:var(--card-bg,#fff);border-radius:28px 28px 0 0;
        display:flex;flex-direction:column;
        transform:translateY(100%);transition:transform .3s cubic-bezier(.32,1,.4,1);
        box-shadow:0 -8px 40px rgba(0,0,0,.15);
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 20px 0;flex-shrink:0;">
          <div style="font-size:17px;font-weight:700;color:var(--text-primary,#2d2d2d);">Notifikasi</div>
          <button id="popupNotifClose" style="width:34px;height:34px;border:none;background:var(--bg-soft,#f5ede3);border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;stroke:#2d2d2d;stroke-width:2.2;stroke-linecap:round;">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Tab -->
        <div style="display:flex;gap:0;padding:14px 20px 0;border-bottom:1.5px solid var(--border-color,#e8ddd0);flex-shrink:0;">
          <button class="notif-tab active" data-tab="belum" style="flex:1;padding:8px 0;border:none;background:none;font-size:14px;font-weight:600;color:var(--primary,#C9A67B);border-bottom:2.5px solid var(--primary,#C9A67B);cursor:pointer;transition:.2s;">
            Belum Dibaca <span style="background:var(--primary,#C9A67B);color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;margin-left:4px;">${belumDibaca.length}</span>
          </button>
          <button class="notif-tab" data-tab="history" style="flex:1;padding:8px 0;border:none;background:none;font-size:14px;font-weight:600;color:var(--text-secondary,#7a6a5a);border-bottom:2.5px solid transparent;cursor:pointer;transition:.2s;">
            History
          </button>
        </div>

        <!-- Content -->
        <div id="notifContent" style="flex:1;overflow-y:auto;padding:4px 0 24px;">
          <div id="notifTabBelum">
            ${belumDibaca.length === 0
              ? `<div style="text-align:center;padding:40px 20px;color:var(--text-secondary,#7a6a5a);font-size:14px;">Tidak ada notifikasi baru</div>`
              : `<div style="padding:12px 20px 0;display:flex;justify-content:flex-end;">
                  <button id="btnTandaiSemua" style="font-size:12px;font-weight:600;color:var(--primary,#C9A67B);background:none;border:none;cursor:pointer;text-decoration:underline;">Tandai semua dibaca</button>
                </div>` + belumDibaca.map(n => renderNotifItem(n, false)).join("")
            }
          </div>
          <div id="notifTabHistory" style="display:none;">
            ${history.length === 0
              ? `<div style="text-align:center;padding:40px 20px;color:var(--text-secondary,#7a6a5a);font-size:14px;">Belum ada history</div>`
              : history.map(n => renderNotifItem(n, true)).join("")
            }
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      document.getElementById("popupNotifBox").style.transform = "translateY(0)";
    });

    function closeNotif() {
      overlay.style.opacity = "0";
      document.getElementById("popupNotifBox").style.transform = "translateY(100%)";
      setTimeout(() => overlay.remove(), 300);
    }

    document.getElementById("popupNotifClose").onclick = closeNotif;
    overlay.addEventListener("click", e => { if (e.target === overlay) closeNotif(); });

    // Tab switch
    overlay.querySelectorAll(".notif-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        overlay.querySelectorAll(".notif-tab").forEach(t => {
          t.style.color = "var(--text-secondary,#7a6a5a)";
          t.style.borderBottom = "2.5px solid transparent";
        });
        tab.style.color = "var(--primary,#C9A67B)";
        tab.style.borderBottom = "2.5px solid var(--primary,#C9A67B)";
        document.getElementById("notifTabBelum").style.display   = tab.dataset.tab === "belum"   ? "block" : "none";
        document.getElementById("notifTabHistory").style.display = tab.dataset.tab === "history" ? "block" : "none";
      });
    });

    // Tandai satu notif saat klik
    overlay.querySelectorAll(".notif-item.notif-unread").forEach(item => {
      item.addEventListener("click", async () => {
        const id = item.dataset.id;
        try {
          await window.updateDoc(
            window.doc(window.db, "notifikasi", id),
            { [`dibaca.${uid}`]: true }
          );
          item.classList.remove("notif-unread");
          item.classList.add("notif-read");
          item.querySelector(".notif-dot")?.remove();
          await loadNotifikasi(); // refresh badge
        } catch(e) {}
      });
    });

    // Tandai semua dibaca
    document.getElementById("btnTandaiSemua")?.addEventListener("click", async () => {
      try {
        await Promise.all(belumDibaca.map(n =>
          window.updateDoc(
            window.doc(window.db, "notifikasi", n.id),
            { [`dibaca.${uid}`]: true }
          )
        ));
        closeNotif();
        await loadNotifikasi();
        setTimeout(openPopupNotif, 350);
      } catch(e) {}
    });

    // Swipe close
    const box = document.getElementById("popupNotifBox");
    let swipeY = 0, swipeCur = 0, swipeActive = false;
    box.addEventListener("touchstart", e => {
      if (box.scrollTop > 0) return;
      swipeY = swipeCur = e.touches[0].clientY;
      swipeActive = true; box.style.transition = "none";
    }, { passive: true });
    box.addEventListener("touchmove", e => {
      if (!swipeActive) return;
      swipeCur = e.touches[0].clientY;
      const d = swipeCur - swipeY;
      if (d < 0) return;
      box.style.transform = `translateY(${d * .9}px)`;
    }, { passive: true });
    box.addEventListener("touchend", () => {
      if (!swipeActive) return;
      swipeActive = false;
      const d = swipeCur - swipeY;
      box.style.transition = "transform .28s ease";
      if (d > 100) { closeNotif(); } else { box.style.transform = ""; }
    });
  }

  // Init badge saat load
  await loadNotifikasi();

  // Klik tombol buka popup
  btn.onclick = openPopupNotif;
};
window.initHomeView = async function(){
  const user = window.currentUser;
  if(!user) return;
  if (typeof window.initFCM === 'function') {
    window.initFCM();
  }
  
  const avatar = document.getElementById("homeAvatar");
  const nama = document.getElementById("homeNama");
  const motivasi = document.getElementById("homeMotivasi");
  const kantor = document.getElementById("homeKantor");
  const tanggal = document.getElementById("homeTanggal");
  const waktu = document.getElementById("homeWaktu");
  const reloadBtn = document.getElementById("homeReloadCustomerBtn");
  const role = (user.role || "").toLowerCase();

  // Sync foto sampul ke header home
  const headerHome = document.querySelector(".headerHome");
  const savedCover = localStorage.getItem("ttn_cover_photo");
  if (headerHome) {
    if (savedCover) {
      headerHome.style.backgroundImage = `url(${savedCover})`;
      headerHome.style.backgroundSize = "cover";
      headerHome.style.backgroundPosition = "center";
      headerHome.style.backgroundRepeat = "no-repeat";
      headerHome.classList.add("has-cover");
    } else {
      headerHome.style.backgroundImage = "";
      headerHome.style.backgroundSize = "";
      headerHome.style.backgroundPosition = "";
      headerHome.style.backgroundRepeat = "";
      headerHome.classList.remove("has-cover");
    }
  }
  
  const roleContent    = document.getElementById("homeRoleContent");
  const popupContainer = document.getElementById("homePopupContainer");

  // Inject HTML per role
  if (role === "hunter") {
    roleContent.innerHTML = `
      <div class="home-customer-wrapper">
        <div class="home-customer-top">
          <div class="home-customer-left">
            <div class="home-customer-label">Jumlah Customer</div>
            <div class="home-customer-total"><span id="homeCustomerTotal">0</span></div>
          </div>
          <div class="home-customer-actions">
            <button class="home-customer-plus secondary" onclick="showView('rolling')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/>
                <path d="M20 8v6"/><path d="M17 11h6"/>
              </svg>
            </button>
            <button class="home-customer-plus" onclick="window.openHomeCustomerPopup()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14"/><path d="M5 12h14"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="home-customer-grid">
          <div class="home-customer-box closing"><div class="box-label">Closing</div><div class="box-value" id="homeClosingTotal">0</div></div>
          <div class="home-customer-box konsinyasi"><div class="box-label">Konsinyasi</div><div class="box-value" id="homeKonsinyasiTotal">0</div></div>
          <div class="home-customer-box cash"><div class="box-label">Cash</div><div class="box-value" id="homeCashTotal">0</div></div>
        </div>
        <div class="home-customer-payment">
          <div class="payment-label">Jumlah Bayaran</div>
          <div class="payment-value" id="homeTotalBayaran">Rp 0</div>
        </div>
      </div>

      <div class="home-sales-wrapper" id="homeSalesWrapper">
        <div class="home-sales-top">
          <div class="home-sales-title">Laporan Hari Ini</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="home-sales-plus secondary" id="homeSalesLaporanBtn" onclick="window.showView('laporanharian')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="home-sales-table" id="homeSalesTable"></div>
        <div class="home-sales-payment">
          <div class="home-sales-payment-label">Total Pembayaran</div>
          <div class="home-sales-payment-value" id="salesTotalPembayaran">Rp 0</div>
          <div class="sales-status-badge" id="salesStatusBayar" style="display:none;"></div>
        </div>
      </div>
    `;

    popupContainer.innerHTML = `
      <div class="hunter-popup-overlay" id="popupHomeCustomer">
        <div class="hunter-popup-content" id="popupHomeCustomerContent">
          <div class="hunter-popup-handle"></div>
          <div class="hunter-popup-group">
            <label>Nama Customer</label>
            <input type="text" id="inputNamaCustomerHome" placeholder="Masukkan nama customer">
          </div>
          <div id="stokContainerHome"></div>
        </div>
      </div>
    `;

  } else if (role === "sales") {
    roleContent.innerHTML = `
      <div class="home-sales-wrapper" id="homeSalesWrapper">
        <div class="home-sales-top">
          <div class="home-sales-title">Laporan Hari Ini</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="home-sales-plus secondary" id="homeSalesLaporanBtn" onclick="window.showView('laporanharian')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </button>
            <button class="home-sales-plus secondary" id="homeSalesCustomerBtn" onclick="window.showView('customersales')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </button>
            <button class="home-sales-plus" id="homeSalesPlusBtn" onclick="window.openHomeCustomerPopup()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14"/><path d="M5 12h14"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="home-sales-table" id="homeSalesTable"></div>
        <div class="home-sales-payment">
          <div class="home-sales-payment-label">Total Pembayaran</div>
          <div class="home-sales-payment-value" id="salesTotalPembayaran">Rp 0</div>
          <div class="sales-status-badge" id="salesStatusBayar" style="display:none;"></div>
        </div>
      </div>
    `;

    popupContainer.innerHTML = `
      <div class="hunter-popup-overlay" id="popupHomeCustomer">
        <div class="hunter-popup-content" id="popupHomeCustomerContent">
          <div class="hunter-popup-handle"></div>
          <div class="hunter-popup-group">
            <label>Nama Customer</label>
            <input type="text" id="inputNamaCustomerHome" placeholder="Masukkan nama customer">
          </div>
          <div id="stokContainerHome"></div>
        </div>
      </div>
    `;

  } else {
    // Kurir / Marketing / lainnya
    roleContent.innerHTML = `
      <div id="cardLaporanKemarin">
        <div class="home-menu">
          <button class="menu-btn" onclick="showView('input')">
            <i class="fa-solid fa-pen-to-square"></i><span>Input Data</span>
          </button>
          <button class="menu-btn" onclick="showView('customer')">
            <i class="fa-solid fa-users"></i><span>Customer</span>
          </button>
          <button class="menu-btn" onclick="showView('analisis')">
            <i class="fa-solid fa-chart-line"></i><span>Analisis</span>
          </button>
        </div>
        <div class="extra-title">Laporan Kemarin</div>
        <div class="extra-subtitle" id="laporanKemarinTanggal">-</div>
        <div class="laporan-kemarin-grid">
          <div class="laporan-kemarin-box omzet"><div class="laporan-kemarin-label">Omset</div><div class="laporan-kemarin-value" id="laporanKemarinOmset">-</div></div>
          <div class="laporan-kemarin-box kasbon"><div class="laporan-kemarin-label">Kasbon</div><div class="laporan-kemarin-value" id="laporanKemarinKasbon">-</div></div>
          <div class="laporan-kemarin-box potongan"><div class="laporan-kemarin-label">Potongan</div><div class="laporan-kemarin-value" id="laporanKemarinPotongan">-</div></div>
          <div class="laporan-kemarin-box bonus"><div class="laporan-kemarin-label">Bonus</div><div class="laporan-kemarin-value" id="laporanKemarinBonus">-</div></div>
        </div>
      </div>
      <div class="home-extra-wrapper">
        <div class="home-extra-card">
          <div class="extra-title">Customer Per Hari</div>
          <div class="extra-subtitle">Data dari IndexedDB</div>
          <div class="extra-body" id="ringkasanCustomerBody">
            <div class="extra-item"><span>Memuat...</span></div>
          </div>
        </div>
      </div>
    `;
  }
  // Footer
  const footerEl = document.getElementById("homeFooterText");
  if (footerEl) {
    const roleLabel = {
      kurir: "Kurir", hunter: "Hunter", sales: "Sales",
      marketing: "Marketing", admincabang: "Admin Cabang"
    };
    const roleStr = roleLabel[role] || role;
    const tahun = new Date().getFullYear();
    footerEl.textContent = `${roleStr} · Teh Tarik Nusantara ${tahun} ©`;
  }
  // Tombol kantor khusus hunter
  const kantorBtn = document.getElementById("homeKantorBtn");
  if (kantorBtn) {
    kantorBtn.style.display = role === "hunter" ? "flex" : "none";
  }
  // Card sales
  const salesWrapper = document.getElementById("homeSalesWrapper");
  const salesPlus    = document.getElementById("homeSalesPlusBtn");
  if (salesWrapper) {
    salesWrapper.style.display = (role === "sales" || role === "hunter") ? "block" : "none";
  }
  if (salesPlus) {
    salesPlus.style.display = role === "sales" ? "flex" : "none";
  }
  const salesCustomerBtn = document.getElementById("homeSalesCustomerBtn");
  if (salesCustomerBtn) {
    salesCustomerBtn.style.display = role === "sales" ? "flex" : "none";
  }
  if(nama){
    nama.innerText = user.nama || "Marketing";
  }
  if(motivasi){
    motivasi.innerText = user.motivasi || "Selamat bekerja dan semangat hari ini 🚀";
  }
  if(kantor){
    kantor.innerHTML = `
      <svg class="kantor-icon" viewBox="0 0 24 24">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13 c0-3.87-3.13-7-7-7zm0 9.5 c-1.38 0-2.5-1.12-2.5-2.5 S10.62 6.5 12 6.5 14.5 7.62 14.5 9 13.38 11.5 12 11.5z"/>
      </svg>
      Kantor:
      ${user.kantorCabang || "-"}
    `;
  }
  if(avatar){
    const inisial =
      (user.nama || "A")
      .split(" ")
      .map(n => n[0])
      .join("")
      .substring(0,2);
    if(user.fotoURL){
      avatar.classList.add("has-photo");
      avatar.innerHTML = `
        <img src="${user.fotoURL} alt="${user.nama}">
        <div class="avatar-inisial">
          ${inisial}
        </div>
      `;
      const img = avatar.querySelector("img");
      img.onerror = () => {
        avatar.classList.remove("has-photo");
        avatar.innerHTML = `
          <div class="avatar-inisial">
            ${inisial}
          </div>
        `;
      };

    }else{

      // TANPA FOTO
      avatar.classList.remove(
        "has-photo"
      );

      avatar.innerHTML = `
        <div class="avatar-inisial">
          ${inisial}
        </div>
      `;
    }
  }

  // JAM REALTIME
  function updateDateTime(){
    const now = new Date();
    const hariNama = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu"
    ];
    const bulanNama = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember"
    ];
    if(tanggal){
      tanggal.innerText =
        `${hariNama[now.getDay()]}, ${now.getDate()} ${bulanNama[now.getMonth()]} ${now.getFullYear()}`;
    }
    if(waktu){
      waktu.innerText = now.toLocaleTimeString(
        "id-ID",
        {
          hour:"2-digit",
          minute:"2-digit"
        }
      );
    }
  }
  if (reloadBtn) {
    reloadBtn.onclick = async function () {
      try {
        reloadBtn.disabled = true;
        reloadBtn.classList.add("loading");
        const uid = window.auth.currentUser.uid;
        const saveToIndexDB = async function (store, key, data) {
          const db = await window.openAppDB();
          return new Promise(
            (resolve, reject) => {
              const tx = db.transaction(store, "readwrite");
              const os = tx.objectStore(store);
              const req = os.put({
                  id: key,
                  data,
                  updatedAt: Date.now()
                });
  
              req.onsuccess = function () {};
              req.onerror = function () {};
              tx.oncomplete = () => resolve(true);
              tx.onerror = () => reject(tx.error);
            }
          );
        };
        const hariNama = [
          "Minggu",
          "Senin",
          "Selasa",
          "Rabu",
          "Kamis",
          "Jumat",
          "Sabtu"
        ];
  
        const hariAktif = hariNama[new Date().getDay()];
        const customerCacheKey = `${uid}_${hariAktif}`;
        const userRef = window.doc(window.db, "users", uid);
        const userSnap = await window.getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        window.globalUser = userData;
        window.globalBawaBarang = userData.bawaBarang || [];
        window.globalVarian = userData.varian || [];
        await saveToIndexDB("usersDB", uid, userData);
        // FETCH KANTOR CABANG
        const idCabang = userData.idCabang || "";
        if (idCabang) {
          try {
            const kantorRef = window.doc(window.db, "kantorCabang", idCabang);
            const kantorSnap = await window.getDoc(kantorRef);
            if (kantorSnap.exists()) {
              const kantorData = kantorSnap.data();
              await saveToIndexDB("kantorDB", idCabang, kantorData);
              window.globalKantor = kantorData;
            }
          } catch { }
        } else { }        
        const roleUser = (userData.role || "").toLowerCase();
        if (roleUser !== "hunter" && roleUser !== "sales") {
          const customerQuery =
            window.query(
              window.collection(window.db, "customer"),
              window.where("pemilik", "==", uid),
              window.where("status", "==", true),
              window.where("hari", "==", hariAktif)
            );

          const snap = await window.getDocs(customerQuery);
          const customerData = snap.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              lokasiCustomer: window.normalizeGeoPoint(data.lokasiCustomer)
            };
          });
          window.customerCache = customerData;

          try {
            const idb = await window.openAppDB();
            const existingAll = await new Promise((resolve, reject) => {
              const tx = idb.transaction("customerHarianDB", "readonly");
              const store = tx.objectStore("customerHarianDB");
              const req = store.getAll();
              req.onsuccess = () => resolve(req.result || []);
              req.onerror = () => reject(req.error);
            });

            const existingMap = {};
            existingAll.forEach(item => { existingMap[item.id] = item; });

            const existingEntry = existingMap[customerCacheKey] || null;
            const existingData  = existingEntry?.data || [];
            const customerHariIni = customerData.filter(c => c.hari === hariAktif);
            const semuaKeys = Object.keys(existingMap);

            await new Promise((resolve, reject) => {
              const tx = idb.transaction("customerHarianDB", "readwrite");
              const store = tx.objectStore("customerHarianDB");
              semuaKeys.forEach(k => { if (k.startsWith(uid)) store.delete(k); });
              tx.oncomplete = () => resolve();
              tx.onerror    = () => reject(tx.error);
            });

            const customerHariLain = existingData.filter(c => c.hari !== hariAktif);
            const hariNama = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
            const perHari  = {};
            hariNama.forEach(h => perHari[h] = []);
            customerHariLain.forEach(c => { if (perHari[c.hari]) perHari[c.hari].push(c); });

            await new Promise((resolve, reject) => {
              const tx = idb.transaction("customerHarianDB", "readwrite");
              const store = tx.objectStore("customerHarianDB");
              hariNama.forEach(h => {
                if (h !== hariAktif && perHari[h].length > 0) {
                  store.put({ id: `${uid}_${h}`, data: perHari[h], updatedAt: Date.now() });
                }
              });
              store.put({ id: customerCacheKey, data: customerHariIni, updatedAt: Date.now() });
              tx.oncomplete = () => resolve();
              tx.onerror    = () => reject(tx.error);
            });
          } catch { }
        }
      } catch {
        const t = document.createElement("div");
        t.textContent = "Gagal reload data";
        t.style.cssText = "position:fixed;bottom:200px;left:50%;transform:translateX(-50%);background:#e53935;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;z-index:99999;white-space:nowrap;";
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3000);
      } finally {
        reloadBtn.disabled = false;
        reloadBtn.classList.remove("loading");
      }
    };
  }
  window.initNotifikasi?.();
  updateDateTime();
  if(window.homeClock){
    clearInterval(window.homeClock);
    window.homeClock = null;
  }
  window.homeClock = setInterval(updateDateTime, 1000);
  const sk = document.getElementById('skeletonHomeCards');

  if (role === "hunter") {
    await Promise.all([
      window.updateHomeStats?.(),
      window.loadSalesCard?.(),
    ]);
  } else if (role === "sales") {
    await window.loadSalesCard?.();
  } else {
    await Promise.all([
      window.loadLaporanKemarin?.(),
      window.loadRingkasanCustomer?.(),
    ]);
  }

  if (sk) sk.style.display = 'none';
};

function countUp(el, target, duration = 600) {
  if (!el) return;
  const start = parseInt(el.innerText.replace(/\D/g, "")) || 0;
  const diff = target - start;
  if (diff === 0) return;
  const startTime = performance.now();
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.innerText = Math.round(start + diff * ease);
    if (progress < 1) requestAnimationFrame(step);
    else el.innerText = target;
  }
  requestAnimationFrame(step);
}
function countUpRupiah(el, target, duration = 600) {
  if (!el) return;
  const raw = el.innerText.replace(/[^\d]/g, "");
  const start = parseInt(raw) || 0;
  const diff = target - start;
  if (diff === 0) return;
  const startTime = performance.now();
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + diff * ease);
    el.innerText = "Rp " + current.toLocaleString("id-ID");
    if (progress < 1) requestAnimationFrame(step);
    else el.innerText = "Rp " + target.toLocaleString("id-ID");
  }
  requestAnimationFrame(step);
}
window.loadSalesCard = async function() {
  try {
    const uid      = window.auth.currentUser?.uid;
    if (!uid) return;
    const idb      = await window.openAppDB();
    const userData = await new Promise(resolve => {
      const tx  = idb.transaction("usersDB", "readonly");
      const req = tx.objectStore("usersDB").get(uid);
      req.onsuccess = () => resolve(req.result?.data || null);
      req.onerror   = () => resolve(null);
    });

    const varian = (userData?.varian || []).filter(v => {
      const key = Object.keys(v)[0];
      return v[key]?.isAktif === true;
    });

    const today = new Date().toISOString().split("T")[0];
    let laporanData = null;
    try {
      const snap = await window.getDocs(window.query(
        window.collection(window.db, "users", uid, "laporanMarketing"),
        window.where("tanggal", "==", today),
        window.where("idMarketing", "==", uid)
      ));
      if (!snap.empty) laporanData = snap.docs[0].data();
    } catch { }

    const orderMap        = laporanData?.order || {};
    const sisaMap         = laporanData?.sisaBarang || laporanData?.pembayaran?.sisaBarang || {};
    const closingMap      = laporanData?.pembayaran?.closing || {};
    const bayar           = laporanData?.pembayaran?.nota?.bayar || 0;
    const statusBayar     = laporanData?.pembayaran?.nota?.status || null;
    const keteranganBayar = laporanData?.pembayaran?.nota?.keterangan || 0;

    const tableEl = document.getElementById("homeSalesTable");
    if (tableEl && varian.length) {
      const keys = varian.map(v => Object.keys(v)[0]);
      function cellVal(map, key) {
        const val = map[key];
        return (val != null && val !== 0) ? val : "-";
      }
      function sisaClass(map, key) {
        const val = map[key];
        return (val != null && val !== 0 && val < 0) ? "sales-cell-kurang" : "";
      }
      tableEl.innerHTML = `
        <table>
          <thead>
            <tr>
              <th></th>
              ${keys.map(k => `<th>${k}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Bawa</td>
              ${keys.map(k => `<td>${cellVal(orderMap, k)}</td>`).join("")}
            </tr>
            <tr>
              <td>Sisa</td>
              ${keys.map(k => `<td class="${sisaClass(sisaMap, k)}">${cellVal(sisaMap, k)}</td>`).join("")}
            </tr>
            <tr>
              <td>Closing</td>
              ${keys.map(k => `<td>${cellVal(closingMap, k)}</td>`).join("")}
            </tr>
          </tbody>
        </table>
      `;
    }

    const elBayar  = document.getElementById("salesTotalPembayaran");
    const elStatus = document.getElementById("salesStatusBayar");
    if (elBayar) elBayar.textContent = "Rp " + bayar.toLocaleString("id-ID");
    if (elStatus) {
      if (statusBayar) {
        elStatus.style.display = "inline-block";
        elStatus.textContent   = statusBayar + (keteranganBayar ? ` (${keteranganBayar < 0 ? "-" : "+"}Rp ${Math.abs(keteranganBayar).toLocaleString("id-ID")})` : "");
        elStatus.className     = "sales-status-badge " + (statusBayar === "Kurang" ? "kurang" : "lunas");
      } else {
        elStatus.style.display = "none";
      }
    }
  } catch { }
};
window.loadLaporanKemarin = async function() {
  try {
    // Hitung tanggal kemarin
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tanggalKemarin = yesterday.toISOString().split("T")[0];

    const bulanNama = [
      "Januari","Februari","Maret","April","Mei","Juni",
      "Juli","Agustus","September","Oktober","November","Desember"
    ];
    const hariNama = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

    const tanggalLabel = `${hariNama[yesterday.getDay()]}, ${yesterday.getDate()} ${bulanNama[yesterday.getMonth()]} ${yesterday.getFullYear()}`;

    const tanggalEl = document.getElementById("laporanKemarinTanggal");
    if (tanggalEl) tanggalEl.innerText = tanggalLabel;

    const omzetEl    = document.getElementById("laporanKemarinOmset");
    const kasbonEl   = document.getElementById("laporanKemarinKasbon");
    const potonganEl = document.getElementById("laporanKemarinPotongan");
    const bonusEl    = document.getElementById("laporanKemarinBonus");

    function renderLaporan(data) {
      if (omzetEl)    omzetEl.innerText    = Number(data?.distribusi?.keuangan?.inputOmset || 0).toLocaleString("id-ID");
      if (kasbonEl)   kasbonEl.innerText   = Number(data?.distribusi?.keuangan?.Kasbon || 0).toLocaleString("id-ID");
      if (potonganEl) potonganEl.innerText = Number(data?.distribusi?.infoTarget?.potongan?.jumlahPotongan || 0).toLocaleString("id-ID");
      if (bonusEl)    bonusEl.innerText    = Number(data?.distribusi?.keuangan?.bonus?.jumlahBonus || 0).toLocaleString("id-ID");
    }

    function renderTidakTersedia() {
      if (omzetEl)    omzetEl.innerText    = "Laporan belum tersedia";
      if (kasbonEl)   kasbonEl.innerText   = "-";
      if (potonganEl) potonganEl.innerText = "-";
      if (bonusEl)    bonusEl.innerText    = "-";
    }

    // Cek IDB dulu
    const idb = await window.openAppDB();
    const dataIdb = await new Promise((resolve) => {
      const tx  = idb.transaction("laporanMarketingDB", "readonly");
      const req = tx.objectStore("laporanMarketingDB").get(tanggalKemarin);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => resolve(null);
    });

    if (dataIdb) {
      renderLaporan(dataIdb);
      return;
    }

    // IDB kosong — fetch Firestore
    if (!navigator.onLine) {
      renderTidakTersedia();
      return;
    }

    try {
      const uid    = window.auth.currentUser?.uid;
      const docRef = window.doc(window.db, "users", uid, "laporanMarketing", tanggalKemarin);
      const snap   = await window.getDoc(docRef);

      if (!snap.exists()) {
        renderTidakTersedia();
        return;
      }

      const fresh = snap.data();

      // Simpan ke IDB
      const idb2 = await window.openAppDB();
      await new Promise((resolve, reject) => {
        const tx    = idb2.transaction("laporanMarketingDB", "readwrite");
        const store = tx.objectStore("laporanMarketingDB");
        store.put({ id: tanggalKemarin, tanggal: tanggalKemarin, idMarketing: uid, ...fresh, cachedAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror    = () => reject(tx.error);
      });

      renderLaporan(fresh);
    } catch {
      renderTidakTersedia();
    }

  } catch { }
};
window.loadRingkasanCustomer = async function() {
  const bodyEl = document.getElementById("ringkasanCustomerBody");
  if (!bodyEl) return;

  const hariNama = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  try {
    const idb = await window.openAppDB();
    const allRaw = await new Promise((resolve, reject) => {
      const tx = idb.transaction("customerHarianDB", "readonly");
      const store = tx.objectStore("customerHarianDB");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    // Flatten semua customer
    let allCustomer = [];
    allRaw.forEach(item => {
      if (Array.isArray(item.data)) {
        allCustomer.push(...item.data);
      }
    });

    // Hitung per hari, dedupe by idCustomer per hari
    const countPerHari = {};
    hariNama.forEach(h => countPerHari[h] = new Set());

    allCustomer.forEach(c => {
      const hari = c.hari || "";
      const cid = c.idCustomer || c.id || "";
      if (hariNama.includes(hari) && cid) {
        countPerHari[hari].add(cid);
      }
    });
    // TOTAL SEMUA CUSTOMER (semua hari, tanpa duplikat)
    const totalAllCustomer = new Set(
      allCustomer
        .map(c => c.idCustomer || c.id)
        .filter(Boolean)
    );
    // Render — urut Senin-Minggu
    const urutan = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
    const hariAktif = hariNama[new Date().getDay()];

    bodyEl.innerHTML = `
      <div class="extra-item total-customer-box">
        <span>
          <i class="dot gold"></i>
          Total Semua Customer
        </span>
        <b>${totalAllCustomer.size} Customer</b>
      </div>
    ` + urutan.map(hari => {
      const count = countPerHari[hari]?.size || 0;
      const isToday = hari === hariAktif;
      let statusClass = "";
      let dotColor = "";
      
      if (count < 60) {
        statusClass = "status-low";
        dotColor = "red";
      } 
      else if (count <= 65) {
        statusClass = "status-warning";
        dotColor = "orange";
      } 
      else {
        statusClass = "status-good";
        dotColor = "green";
      }      
      return `
        <div class="extra-item ${isToday ? "extra-item-today" : ""} ${statusClass}">
          <span>
            <i class="dot ${dotColor}"></i>
            ${hari}
          </span>
          <b>${count} Customer</b>
        </div>
      `;
    }).join("");

  } catch {
    bodyEl.innerHTML = `<div class="extra-item"><span>Gagal memuat</span></div>`;
  }
};
window.updateHomeStats = async function() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const uid = window.auth.currentUser?.uid;
    if (!uid) return;

    const db = await window.openAppDB();
    const tx = db.transaction("customerBaruDB", "readonly");
    const store = tx.objectStore("customerBaruDB");

    const allData = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    // FILTER HARI INI
    const todayData = allData.filter(x => x.tanggal === today);

    // JUMLAH CUSTOMER
    const jumlahCustomer = todayData.length;

    // KONSINYASI & CASH
    let totalKonsinyasi = 0;
    let totalCash = 0;

    todayData.forEach(item => {
      // JUMLAH SEMUA VALUE DI konsinyasi
      Object.values(item.konsinyasi || {}).forEach(val => {
        totalKonsinyasi += Number(val || 0);
      });
      // JUMLAH SEMUA VALUE DI cash
      Object.values(item.cash || {}).forEach(val => {
        totalCash += Number(val || 0);
      });
    });

    // CLOSING
    const totalClosing = totalKonsinyasi + totalCash;

    // UPAH HUNTER DARI KANTORDB
    let upahHunter = 0;
    try {
      const user = window.currentUser || {};
      const dbK = await window.openAppDB();
      const txK = dbK.transaction("kantorDB", "readonly");
      const storeK = txK.objectStore("kantorDB");
      const kantorRaw = await new Promise(resolve => {
        const r = storeK.get(user.idCabang || "");
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => resolve(null);
      });
      const kantorData = kantorRaw?.data || kantorRaw;
      upahHunter = Number(kantorData?.upahHunter || 0);
    } catch { }
    // TOTAL BAYARAN
    const totalBayaran = jumlahCustomer * upahHunter;

    // UPDATE DOM
    const elTotal = document.getElementById("homeCustomerTotal");
    const elClosing = document.getElementById("homeClosingTotal");
    const elKonsinyasi = document.getElementById("homeKonsinyasiTotal");
    const elCash = document.getElementById("homeCashTotal");
    const elBayaran = document.getElementById("homeTotalBayaran");

    countUp(elTotal, jumlahCustomer);
    countUp(elClosing, totalClosing);
    countUp(elKonsinyasi, totalKonsinyasi);
    countUp(elCash, totalCash);
    countUpRupiah(elBayaran, totalBayaran);

  } catch { }
};
window.syncPendingSales = async function() {
  try {
    if (!navigator.onLine) return;
    const uid = window.auth?.currentUser?.uid;
    if (!uid) return;

    const idb = await window.openAppDB();
    const all = await new Promise(resolve => {
      const tx  = idb.transaction("customerSalesDB", "readonly");
      const req = tx.objectStore("customerSalesDB").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => resolve([]);
    });

    const pending = all.filter(x => (x.isSync === false || x.isSync === undefined) && x.createdBy === uid);

    for (const item of pending) {
      try {
        let foto = item.foto || "";
        if (!foto && item.fotoLokal) {
          try {
            const arr   = item.fotoLokal.split(",");
            const mime  = arr[0].match(/:(.*?);/)[1];
            const bstr  = atob(arr[1]);
            let n       = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            const blob  = new Blob([u8arr], { type: mime });
            const sRef  = window.storageRef(window.storage, `fotoCustomerSales/${item.id}`);
            await window.uploadBytes(sRef, blob, { contentType: "image/jpeg" });
            foto = await window.getDownloadURL(sRef);
          } catch { }
        }

        const { fotoLokal: _removed, ...itemClean } = item;
        await window.setDoc(
          window.doc(window.db, "customerSales", item.id),
          {
            ...itemClean,
            foto,
            lokasiCustomer: new window.GeoPoint(
              item.lokasiCustomer?.lat || 0,
              item.lokasiCustomer?.lng || 0
            ),
            createdAt: window.serverTimestamp()
          }
        );

        const idb2 = await window.openAppDB();
        await new Promise((resolve, reject) => {
          const tx2 = idb2.transaction("customerSalesDB", "readwrite");
          tx2.objectStore("customerSalesDB").put({ ...item, foto, fotoLokal: null, isSync: true });
          tx2.oncomplete = () => resolve();
          tx2.onerror   = () => reject(tx2.error);
        });
      } catch { }
    }
  } catch { }
};
window.syncPendingHunter = async function() {
  try {
    if (!navigator.onLine) return;
    const uid = window.auth?.currentUser?.uid;
    if (!uid) return;

    const idb = await window.openAppDB();
    const all = await new Promise(resolve => {
      const tx  = idb.transaction("customerBaruDB", "readonly");
      const req = tx.objectStore("customerBaruDB").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => resolve([]);
    });

    const pending    = all.filter(x => (x.isSync === false || x.isSync === undefined) && x.createdBy === uid && !x.type && !x.isEdit);
    const pendingEdit = all.filter(x => x.isSync === false && x.createdBy === uid && x.isEdit === true);

    // Sync data edit
    for (const item of pendingEdit) {
      try {
        let foto = item.foto || "";

        // Upload foto lokal jika ada
        if (item.fotoLokal) {
          try {
            const arr   = item.fotoLokal.split(",");
            const mime  = arr[0].match(/:(.*?);/)[1];
            const bstr  = atob(arr[1]);
            let n       = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            const blob  = new Blob([u8arr], { type: mime });
            const sRef  = window.storageRef(window.storage, `fotoCustomer/${item.id}`);
            await window.uploadBytes(sRef, blob, { contentType: "image/jpeg" });
            foto = await window.getDownloadURL(sRef);
          } catch { }
        }

        const konsinyasi = item.konsinyasi || {};
        const cash       = item.cash || {};

        const updatePayload = {
          namaCustomer:   item.namaCustomer,
          alamatCustomer: item.alamatCustomer,
          foto,
          keterangan:     item.keterangan || {},
          konsinyasi:     Object.keys(konsinyasi).length ? konsinyasi : window.deleteField(),
          cash:           Object.keys(cash).length ? cash : window.deleteField(),
          ...(item.lokasiCustomer?.lat ? {
            lokasiCustomer: new window.GeoPoint(item.lokasiCustomer.lat, item.lokasiCustomer.lng)
          } : {})
        };

        await window.updateDoc(
          window.doc(window.db, "users", uid, "customerBaruHunter", item.id),
          updatePayload
        );

        // Update IndexedDB — tandai sync
        const idb2 = await window.openAppDB();
        await new Promise((resolve, reject) => {
          const tx2 = idb2.transaction("customerBaruDB", "readwrite");
          tx2.objectStore("customerBaruDB").put({ ...item, foto, fotoLokal: null, isSync: true, isEdit: false });
          tx2.oncomplete = () => resolve();
          tx2.onerror   = () => reject(tx2.error);
        });
      } catch { }
    }
    for (const item of pending) {
      try {
        let foto = item.foto || "";

        // Upload foto lokal jika ada
        if (!foto && item.fotoLokal) {
          try {
            const arr   = item.fotoLokal.split(",");
            const mime  = arr[0].match(/:(.*?);/)[1];
            const bstr  = atob(arr[1]);
            let n       = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            const blob  = new Blob([u8arr], { type: mime });
            const sRef  = window.storageRef(window.storage, `fotoCustomer/${item.id}`);
            await window.uploadBytes(sRef, blob, { contentType: "image/jpeg" });
            foto = await window.getDownloadURL(sRef);
          } catch { }
        }

        const colRef = window.collection(window.db, "users", uid, "customerBaruHunter");
        const { fotoLokal: _removed, ...itemClean } = item;
        await window.setDoc(
          window.doc(colRef, item.id),
          {
            ...itemClean,
            foto,
            lokasiCustomer: new window.GeoPoint(
              item.lokasiCustomer?.lat || 0,
              item.lokasiCustomer?.lng || 0
            ),
            createdAt: window.serverTimestamp()
          }
        );

        // Update IndexedDB
        const idb2 = await window.openAppDB();
        await new Promise((resolve, reject) => {
          const tx2    = idb2.transaction("customerBaruDB", "readwrite");
          const store2 = tx2.objectStore("customerBaruDB");
          store2.put({ ...item, foto, fotoLokal: null, isSync: true });
          tx2.oncomplete = () => resolve();
          tx2.onerror   = () => reject(tx2.error);
        });
      } catch { }
    }
  } catch { }
};
window.openKantorPopup = async function() {
  const existing = document.getElementById("kantorPopupOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "kantorPopupOverlay";
  overlay.className = "kantor-popup-overlay";
  document.body.appendChild(overlay);

  overlay.innerHTML = `
    <div id="kantorPopupBox" class="kantor-popup-box">
      <div class="kantor-popup-header">
        <div class="kantor-popup-title">Pilih Kantor Cabang</div>
        <button id="kantorPopupClose" class="kantor-popup-close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" width="16" height="16"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div id="kantorPopupList" class="kantor-popup-list">
        <div class="kantor-popup-loading">Memuat...</div>
      </div>
    </div>
  `;

  requestAnimationFrame(() => overlay.classList.add("active"));

  function closePopup() {
    overlay.classList.remove("active");
    setTimeout(() => overlay.remove(), 300);
  }

  document.getElementById("kantorPopupClose").onclick = closePopup;
  overlay.addEventListener("click", e => { if (e.target === overlay) closePopup(); });

  try {
    const uid      = window.auth.currentUser.uid;
    const user     = window.currentUser || {};
    const idAktif  = user.idCabang || "";

    // Cek request pending milik hunter ini
    let idCabangPending = null;
    try {
      const reqSnap = await window.getDoc(window.doc(window.db, "requestCabang", uid));
      if (reqSnap.exists() && reqSnap.data().status === "pending") {
        idCabangPending = reqSnap.data().idCabangTujuan;
      }
    } catch { }

    const snap = await window.getDocs(window.collection(window.db, "kantorCabang"));
    const listEl = document.getElementById("kantorPopupList");
    if (!listEl) return;

    if (snap.empty) {
      listEl.innerHTML = `<div class="kantor-popup-loading">Tidak ada kantor tersedia</div>`;
      return;
    }

    const kantorList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    listEl.innerHTML = kantorList.map(k => {
      const isAktif   = k.id === idAktif;
      const isPending = k.id === idCabangPending;
      return `
        <div class="kantor-list-item ${isAktif ? "aktif" : ""}">
          <div class="kantor-list-info">
            <div class="kantor-list-nama">${k.namaCabang || k.nama || "-"}</div>
            ${isAktif   ? `<div class="kantor-list-badge aktif-badge">Aktif</div>` : ""}
            ${isPending ? `<div class="kantor-list-badge pending-badge">Menunggu ACC</div>` : ""}
          </div>
          ${!isAktif ? `
            <button class="kantor-request-btn ${isPending ? "pending" : ""}" 
              data-id="${k.id}" 
              data-nama="${k.namaCabang || k.nama || "-"}"
              ${isPending ? "disabled" : ""}>
              ${isPending ? "Pending" : "Request"}
            </button>
          ` : ""}
        </div>
      `;
    }).join("");

    // Klik tombol request
    listEl.querySelectorAll(".kantor-request-btn:not([disabled])").forEach(btn => {
      btn.onclick = function() {
        const idTujuan   = this.dataset.id;
        const namaTujuan = this.dataset.nama;
        openKonfirmasiRequest(idTujuan, namaTujuan, closePopup);
      };
    });

  } catch {
    const listEl = document.getElementById("kantorPopupList");
    if (listEl) listEl.innerHTML = `<div class="kantor-popup-loading">Gagal memuat kantor</div>`;
  }
};
function openKonfirmasiRequest(idTujuan, namaTujuan, onClose) {
  const existing = document.getElementById("kantorKonfirmasiOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "kantorKonfirmasiOverlay";
  overlay.className = "kantor-popup-overlay";
  document.body.appendChild(overlay);

  overlay.innerHTML = `
    <div class="kantor-popup-box kantor-konfirmasi-box">
      <div class="kantor-konfirmasi-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="32" height="32">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <div class="kantor-konfirmasi-title">Request Pindah Cabang</div>
      <div class="kantor-konfirmasi-desc">
        Kamu akan mengajukan request untuk bergabung ke kantor cabang<br>
        <strong>${namaTujuan}</strong>.<br><br>
        Request akan diproses oleh admin cabang tujuan.
      </div>
      <div class="kantor-konfirmasi-actions">
        <button id="kantorKonfirmasiCancel" class="kantor-konfirmasi-btn cancel">Batal</button>
        <button id="kantorKonfirmasiOk" class="kantor-konfirmasi-btn ok">Kirim Request</button>
      </div>
    </div>
  `;

  requestAnimationFrame(() => overlay.classList.add("active"));

  function closeKonfirmasi() {
    overlay.classList.remove("active");
    setTimeout(() => overlay.remove(), 300);
  }

  document.getElementById("kantorKonfirmasiCancel").onclick = closeKonfirmasi;

  document.getElementById("kantorKonfirmasiOk").onclick = async function() {
    const btn = this;
    btn.textContent = "Mengirim...";
    btn.disabled = true;

    try {
      const uid  = window.auth.currentUser.uid;
      const user = window.currentUser || {};

      await window.setDoc(
        window.doc(window.db, "requestCabang", uid),
        {
          idHunter:        uid,
          namaHunter:      user.nama || "-",
          idCabangAsal:    user.idCabang || "",
          namaCabangAsal:  user.kantorCabang || "-",
          idCabangTujuan:  idTujuan,
          namaCabangTujuan: namaTujuan,
          status:          "pending",
          createdAt:       window.serverTimestamp(),
        }
      );

      btn.textContent = "Terkirim ✓";
      btn.style.background = "#2eaf62";

      setTimeout(() => {
        closeKonfirmasi();
        onClose();
      }, 800);

    } catch {
      btn.textContent = "Gagal, Coba Lagi";
      btn.style.background = "#e74c3c";
      btn.disabled = false;
      setTimeout(() => {
        btn.textContent = "Kirim Request";
        btn.style.background = "";
      }, 2000);
    }
  };
}

window.openHomeCustomerPopup = async function() {
  const popup = document.getElementById("popupHomeCustomer");
  const stokContainer = document.getElementById("stokContainerHome");

  if (!popup || !stokContainer)
    return;
  
  // BODY POPUP
  stokContainer.innerHTML = `
    <div class="hunter-form">
        <div class="hunter-popup-group">
          <label>Alamat</label>
          <input type="text" id="alamatCustomerHome" placeholder="Blok dan desa">
        </div>
        <div class="hunter-popup-group">
          <label>Konsinyasi</label>
          <div id="dataKonsinyasiHome" class="data-awal-container"></div>
        </div>
        <div class="hunter-popup-group">
          <label>Cash</label>
          <div id="dataCashHome" class="data-awal-container"></div>
        </div>
        <button type="button" class="hunter-btn-lokasi" id="btnLokasiHome">
          <span id="btnLokasiSpinnerHome" style="display:none;width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;"></span>
          <span id="btnLokasiTextHome">Ambil Lokasi Sekarang</span>
        </button>
        <div class="hunter-foto-wrapper">
          <label class="hunter-foto-card" id="fotoCardHome">
            <input type="file" accept="image/*" capture="environment" id="fotoInputHome" hidden>
            <div class="hunter-foto-placeholder">
              <i class="fa-solid fa-camera"></i>
              <span>Ambil Foto</span>
            </div>
          </label>
        </div>
        <button type="button" class="hunter-btn-simpan" id="btnSimpanCustomerHome">
          <span id="btnSimpanTextHome">Simpan</span>
        </button>
      </div>
  `;

  window.selectedPaymentType = null;

  try {
    const db = await window.openAppDB();
    const tx = db.transaction("usersDB", "readonly");
    const store = tx.objectStore("usersDB");
    const uid = window.auth.currentUser.uid;
    const userData = await new Promise(resolve => {
      const req = store.get(uid);
      req.onsuccess = () => resolve(
          req.result?.data ||
          null
        );
      req.onerror = () => resolve(null);
    });
    const varian = Array.isArray(userData?.varian) ? userData.varian : [];
    const konsinyasiContainer = document.getElementById("dataKonsinyasiHome");
    const cashContainer       = document.getElementById("dataCashHome");

    if (varian.length) {
      let html = "";
      varian.forEach(item => {
        const key = Object.keys(item)[0];
        if (!key) return;
        html += `
          <div class="data-awal-item">
            <input type="number" class="data-awal-input-konsinyasi" data-key="${key}" placeholder="${key}">
          </div>
        `;
      });
      if (konsinyasiContainer) konsinyasiContainer.innerHTML = html;

      let htmlCash = "";
      varian.forEach(item => {
        const key = Object.keys(item)[0];
        if (!key) return;
        htmlCash += `
          <div class="data-awal-item">
            <input type="number" class="data-awal-input-cash" data-key="${key}" placeholder="${key}">
          </div>
        `;
      });
      if (cashContainer) cashContainer.innerHTML = htmlCash;
    } else {
      if (konsinyasiContainer) konsinyasiContainer.innerHTML = `<div class="customer-empty">Tidak ada data varian</div>`;
      if (cashContainer) cashContainer.innerHTML = `<div class="customer-empty">Tidak ada data varian</div>`;
    }

  } catch { }
  window.selectedPaymentType = null;
  popup.classList.add("active");
  // BUTTON LOKASI + GOOGLE MAPS FULLSCREEN
  let customerLat = null;
  let customerLng = null;
  let lokasiSuccess = false;
  let fullMap = null;

  const btnLokasiHome = document.getElementById("btnLokasiHome");
  const btnLokasiTextHome = document.getElementById("btnLokasiTextHome");
  const btnLokasiSpinnerHome = document.getElementById("btnLokasiSpinnerHome");

  let lokasiMapHome    = null;
  let lokasiMarkerHome = null;

  function tampilkanPetaHome(lat, lng) {
    const existingMap = document.getElementById("customerMapOverlayHome");
    if (existingMap) existingMap.remove();

    const mapOverlay = document.createElement("div");
    mapOverlay.id = "customerMapOverlayHome";
    mapOverlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,.45);backdrop-filter:blur(4px);
      display:flex;align-items:flex-end;justify-content:center;
      opacity:0;transition:opacity .25s ease;
    `;
    mapOverlay.innerHTML = `
      <div id="customerMapBoxHome" style="
        width:100%;max-width:540px;
        background:var(--bg-primary);border-radius:24px 24px 0 0;
        display:flex;flex-direction:column;overflow:hidden;
        transform:translateY(100%);transition:transform .3s cubic-bezier(.32,1,.4,1);
        box-shadow:0 -8px 40px rgba(0,0,0,.15);
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border-color);flex-shrink:0;">
          <button id="customerMapTutupHome" style="width:34px;height:34px;border:none;border-radius:10px;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;cursor:pointer;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" width="16" height="16"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
          <div style="font-size:15px;font-weight:700;color:var(--text-heading);">Pilih Lokasi</div>
          <button id="customerMapPilihHome" style="padding:8px 18px;border:none;border-radius:20px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Pilih</button>
        </div>
        <div id="customerMapElHome" style="height:55dvh;"></div>
        <div style="padding:10px 20px 24px;font-size:12px;color:var(--text-secondary);text-align:center;">
          Seret pin untuk memilih lokasi yang tepat
        </div>
      </div>
    `;
    document.body.appendChild(mapOverlay);

    requestAnimationFrame(() => {
      mapOverlay.style.opacity = "1";
      document.getElementById("customerMapBoxHome").style.transform = "translateY(0)";
    });

    const mapEl = document.getElementById("customerMapElHome");
    const savedMapType = localStorage.getItem("mapType") || "roadmap";
    lokasiMapHome = new google.maps.Map(mapEl, {
      center: { lat, lng }, zoom: 17,
      mapTypeId: savedMapType,
      zoomControl: true, mapTypeControl: false,
      streetViewControl: false, fullscreenControl: false,
      gestureHandling: "greedy",
      disableDefaultUI: true,
    });
    lokasiMarkerHome = new google.maps.Marker({
      position: { lat, lng }, map: lokasiMapHome,
      draggable: true,
      animation: google.maps.Animation.DROP,
    });

    function closeMapHome() {
      mapOverlay.style.opacity = "0";
      document.getElementById("customerMapBoxHome").style.transform = "translateY(100%)";
      setTimeout(() => {
        if (lokasiMarkerHome) lokasiMarkerHome.setMap(null);
        if (lokasiMapHome) google.maps.event.clearInstanceListeners(lokasiMapHome);
        mapOverlay.remove();
        lokasiMapHome = null;
        lokasiMarkerHome = null;
      }, 300);
    }

    document.getElementById("customerMapTutupHome").onclick = closeMapHome;
    mapOverlay.addEventListener("click", e => { if (e.target === mapOverlay) closeMapHome(); });

    document.getElementById("customerMapPilihHome").onclick = () => {
      const pos = lokasiMarkerHome.getPosition();
      customerLat   = pos.lat();
      customerLng   = pos.lng();
      lokasiSuccess = true;
      closeMapHome();
      btnLokasiHome.classList.add("success");
      btnLokasiTextHome.innerText = "✓ Lokasi Dipilih";
    };
  }

  // KLIK AMBIL LOKASI
  btnLokasiHome.onclick = function() {
    if (!navigator.geolocation) {
      btnLokasiTextHome.innerText = "GPS tidak didukung";
      return;
    }
    btnLokasiHome.disabled = true;
    btnLokasiSpinnerHome.style.display = "inline-block";
    btnLokasiTextHome.innerText = "Mendeteksi sinyal GPS...";

    // Ambil GPS beberapa kali, pakai yang paling akurat
    let bestPos = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    const ACCURACY_THRESHOLD = 20; // meter — stop lebih awal kalau sudah akurat

    function tryGetPosition() {
      navigator.geolocation.getCurrentPosition(
        pos => {
          attempts++;
          // Update progress
          const pesanProgress = [
            "Mendeteksi sinyal GPS...",
            "Mencari titik terbaik...",
            "Mengunci lokasi akurat...",
          ];
          btnLokasiTextHome.innerText = pesanProgress[attempts - 1] || "Mengambil...";
          // Simpan posisi terbaik (akurasi terkecil = lebih akurat)
          if (!bestPos || pos.coords.accuracy < bestPos.coords.accuracy) {
            bestPos = pos;
          }

          // Stop kalau sudah cukup akurat atau sudah max attempts
          if (pos.coords.accuracy <= ACCURACY_THRESHOLD || attempts >= MAX_ATTEMPTS) {
            btnLokasiSpinnerHome.style.display = "none";
            btnLokasiHome.disabled = false;
            tampilkanPetaHome(bestPos.coords.latitude, bestPos.coords.longitude);
          } else {
            // Tunggu sebentar lalu coba lagi
            setTimeout(tryGetPosition, 1000);
          }
        },
        err => {
          attempts++;
          if (bestPos && attempts >= MAX_ATTEMPTS) {
            // Ada hasil sebelumnya — pakai saja
            btnLokasiSpinnerHome.style.display = "none";
            btnLokasiHome.disabled = false;
            tampilkanPetaHome(bestPos.coords.latitude, bestPos.coords.longitude);
          } else if (attempts >= MAX_ATTEMPTS) {
            btnLokasiHome.disabled = false;
            btnLokasiSpinnerHome.style.display = "none";
            btnLokasiTextHome.innerText = "Gagal, Coba Lagi";
            setTimeout(() => { btnLokasiTextHome.innerText = "Ambil Lokasi Sekarang"; }, 2500);
          } else {
            setTimeout(tryGetPosition, 1000);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    tryGetPosition();
  };

  // FOTO PREVIEW
  const fotoInputHome = document.getElementById("fotoInputHome");
  const fotoCardHome = document.getElementById("fotoCardHome");

  fotoInputHome.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setTimeout(async () => {
      const url = URL.createObjectURL(file);
      fotoCardHome.innerHTML = `
        <img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">
      `;
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      if (navigator.onLine) {
        window.fotoBase64Home = file;
      } else {
        window.fotoBase64Home = await compressImageHome(url);
      }
    }, 500);
  });

  // COMPRESS IMAGE
  async function compressImageHome(base64) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        const maxSize = 400;
        if (w > h) { if (w > maxSize) { h *= maxSize / w; w = maxSize; } }
        else { if (h > maxSize) { w *= maxSize / h; h = maxSize; } }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.3));
      };
      img.src = base64;
    });
  }
  // BUTTON SIMPAN
  const btnSimpanHome = document.getElementById("btnSimpanCustomerHome");
  const btnSimpanTextHome = document.getElementById("btnSimpanTextHome");

  btnSimpanHome.onclick = async function() {
    try {
      btnSimpanHome.disabled = true;
      btnSimpanTextHome.innerText = "Menyimpan...";

      const uid = window.auth.currentUser.uid;
      const user = window.currentUser || {};
      const today = new Date().toISOString().split("T")[0];
      const hariNama = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
      const hari = hariNama[new Date().getDay()];

      // NAMA
      const namaCustomer = document.getElementById("inputNamaCustomerHome")?.value.trim() || "";
      if (!namaCustomer) throw new Error("Nama customer kosong");

      // ALAMAT
      const alamatCustomer = document.getElementById("alamatCustomerHome")?.value.trim() || "";

      // DATA KONSINYASI
      const konsinyasi = {};
      document.querySelectorAll(".data-awal-input-konsinyasi").forEach(input => {
        const key = input.dataset.key;
        const val = input.value.trim();
        if (key && val !== "") konsinyasi[key] = Number(val);
      });

      // DATA CASH
      const cash = {};
      document.querySelectorAll(".data-awal-input-cash").forEach(input => {
        const key = input.dataset.key;
        const val = input.value.trim();
        if (key && val !== "") cash[key] = Number(val);
      });

      // Minimal satu harus diisi
      if (!Object.keys(konsinyasi).length && !Object.keys(cash).length) {
        throw new Error("Isi minimal konsinyasi atau cash");
      }

      // LOAD VARIAN DARI INDEXDB
      let varianMap = {};
      try {
        const idbV = await window.openAppDB();
        const txV = idbV.transaction("usersDB", "readonly");
        const storeV = txV.objectStore("usersDB");
        const userDataV = await new Promise(resolve => {
          const r = storeV.get(uid);
          r.onsuccess = () => resolve(r.result?.data || null);
          r.onerror = () => resolve(null);
        });
        (userDataV?.varian || []).forEach(item => {
          const key = Object.keys(item)[0];
          if (key) varianMap[key] = item[key];
        });
      } catch { }
      // HITUNG KETERANGAN
      let hargaPendam = 0;
      let hargaJual   = 0;
      let hargaPay    = 0;

      Object.entries(konsinyasi).forEach(([key, qty]) => {
        const v = varianMap[key] || {};
        hargaPendam += qty * Number(v.hargaProduksi || 0);
        hargaJual   += qty * Number(v.hargaKonsumen || 0);
      });

      Object.entries(cash).forEach(([key, qty]) => {
        const v = varianMap[key] || {};
        hargaPay += qty * Number(v.hargaKonsumen || 0);
      });

      const keterangan = {};
      if (Object.keys(konsinyasi).length) {
        keterangan.modal = { hargaPendam, hargaJual };
      }
      if (Object.keys(cash).length) {
        keterangan.pay = { hargaPay };
      }

      // HITUNG JARAK pakai Google Distance Matrix
      let jarak = 0;
      try {
        const idbK = await window.openAppDB();
        const txK = idbK.transaction("kantorDB", "readonly");
        const storeK = txK.objectStore("kantorDB");
        const kantorRaw = await new Promise(resolve => {
          const r = storeK.get(user.idCabang || "");
          r.onsuccess = () => resolve(r.result || null);
          r.onerror = () => resolve(null);
        });
        const kantorData = kantorRaw?.data || kantorRaw;

        if (kantorData && customerLat && customerLng) {
          const locRaw = kantorData.lokasiCabang;
          const loc = window.normalizeGeoPoint(locRaw);

          if (loc) {
            // Coba Distance Matrix dulu, fallback ke Haversine
            jarak = await new Promise(async resolve => {
              try {
                const { RoutesClient } = await google.maps.importLibrary("routes");
                const result = await new RoutesClient().computeRouteMatrix({
                  origins: [{
                    waypoint: { location: { latLng: { latitude: loc.lat, longitude: loc.lng } } }
                  }],
                  destinations: [{
                    waypoint: { location: { latLng: { latitude: customerLat, longitude: customerLng } } }
                  }],
                  travelMode: "DRIVE"
                });
                const meters = result?.[0]?.distanceMeters || 0;
                resolve(Number((meters / 1000).toFixed(2)));
              } catch(e) {
                // Fallback Haversine
                const toRad = v => v * Math.PI / 180;
                const R = 6371;
                const dLat = toRad(customerLat - loc.lat);
                const dLng = toRad(customerLng - loc.lng);
                const a = Math.sin(dLat/2)**2 + Math.cos(toRad(loc.lat)) * Math.cos(toRad(customerLat)) * Math.sin(dLng/2)**2;
                resolve(Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2)));
              }
            });
          }
        }
      } catch(e) { }

      let foto = "";
      const roleUser = (user.role || "").toLowerCase();
      const idCustomer = crypto.randomUUID();

      const dataCustomer = {
        idCustomer,
        namaCustomer,
        alamatCustomer,
        tanggal: today,
        hari,
        foto,
        idCabang: user.idCabang || "",
        createdBy: uid,
        pemilik: uid,
        jarak,
        ...(Object.keys(konsinyasi).length ? { konsinyasi } : {}),
        ...(Object.keys(cash).length ? { cash } : {}),
        keterangan,
        diserahkan: false
      };

      // Compress foto
      let fotoBase64Compressed = null;
      if (window.fotoBase64Home) {
        if (typeof window.fotoBase64Home === "string") {
          // Sudah base64 (offline) — pakai langsung
          fotoBase64Compressed = window.fotoBase64Home;
        } else {
          // File object (online) — compress
          fotoBase64Compressed = await compressImageHome(
            URL.createObjectURL(window.fotoBase64Home)
          );
        }
      }

      const storeNama    = roleUser === "sales" ? "customerSalesDB" : "customerBaruDB";
      const fotoFolder   = roleUser === "sales" ? "fotoCustomerSales" : "fotoCustomer";
      const firestoreCol = roleUser === "sales"
        ? window.collection(window.db, "customerSales")
        : window.collection(window.db, "users", uid, "customerBaruHunter");

      // SAVE INDEXDB DULU (offline-first)
      const idb = await window.openAppDB();
      await new Promise((resolve, reject) => {
        const txIdb    = idb.transaction(storeNama, "readwrite");
        const storeIdb = txIdb.objectStore(storeNama);
        storeIdb.put({
          ...dataCustomer,
          id: idCustomer,
          idCustomer,
          foto: "",
          fotoLokal: fotoBase64Compressed || null,
          lokasiCustomer: { lat: customerLat || 0, lng: customerLng || 0 },
          isSync: false,
          createdAt: Date.now()
        });
        txIdb.oncomplete = () => resolve();
        txIdb.onerror   = () => reject(txIdb.error);
      });

      // SYNC KE FIRESTORE JIKA ONLINE
      if (navigator.onLine) {
        try {
          if (fotoBase64Compressed) {
            try {
              const arr   = fotoBase64Compressed.split(",");
              const mime  = arr[0].match(/:(.*?);/)[1];
              const bstr  = atob(arr[1]);
              let n       = bstr.length;
              const u8arr = new Uint8Array(n);
              while (n--) u8arr[n] = bstr.charCodeAt(n);
              const blob  = new Blob([u8arr], { type: mime });
              const sRef  = window.storageRef(window.storage, `${fotoFolder}/${idCustomer}`);
              await window.uploadBytes(sRef, blob, { contentType: "image/jpeg" });
              foto = await window.getDownloadURL(sRef);
            } catch { }
          }

          await window.setDoc(
            window.doc(firestoreCol, idCustomer),
            {
              ...dataCustomer,
              idCustomer,
              foto,
              lokasiCustomer: new window.GeoPoint(customerLat || 0, customerLng || 0),
              createdAt: window.serverTimestamp()
            }
          );

          const idb2 = await window.openAppDB();
          await new Promise((resolve, reject) => {
            const tx2    = idb2.transaction(storeNama, "readwrite");
            const store2 = tx2.objectStore(storeNama);
            store2.put({
              ...dataCustomer,
              id: idCustomer,
              idCustomer,
              foto,
              fotoLokal: null,
              lokasiCustomer: { lat: customerLat || 0, lng: customerLng || 0 },
              isSync: true,
              createdAt: Date.now()
            });
            tx2.oncomplete = () => resolve();
            tx2.onerror   = () => reject(tx2.error);
          });
        } catch { }
      }
      window.updateHomeStats();
      btnSimpanTextHome.innerText = "Sukses ✓";
      btnSimpanHome.style.background = "#4caf50";

      setTimeout(() => {
        popup.classList.remove("active");
        btnSimpanHome.style.background = "";
        btnSimpanTextHome.innerText = "Simpan";
        btnSimpanHome.disabled = false;
        window.fotoBase64Home = null;
      }, 800);

    } catch(err) {
      btnSimpanHome.disabled = false;
      btnSimpanHome.style.background = "#e53935";
      btnSimpanTextHome.innerText = err.message || "Gagal";
      setTimeout(() => {
        btnSimpanHome.style.background = "";
        btnSimpanTextHome.innerText = "Simpan";
      }, 2000);
    }
  };
};
// Swipe close popup home customer — pasang sekali saja
if (!window._homeSwipeListenerAttached) {
  window._homeSwipeListenerAttached = true;

  let startY = 0, currentY = 0, isDragging = false, canSwipe = false;

  document.addEventListener("touchstart", function(e) {
    const popup   = document.getElementById("popupHomeCustomer");
    const content = document.getElementById("popupHomeCustomerContent");
    if (!popup || !content || !popup.classList.contains("active")) return;
    if (e.target.closest("#customerMapOverlayHome")) { canSwipe = false; return; }
    if (e.target.closest("input, textarea, select")) { canSwipe = false; return; }
    if (content.scrollTop > 0) { canSwipe = false; return; }
    canSwipe = true; isDragging = true;
    startY = currentY = e.touches[0].clientY;
    content.style.transition = "none";
  }, { passive: true });

  document.addEventListener("touchmove", function(e) {
    if (!isDragging || !canSwipe) return;
    const content = document.getElementById("popupHomeCustomerContent");
    if (!content) return;
    currentY = e.touches[0].clientY;
    const moveY = currentY - startY;
    if (moveY > 0) content.style.transform = `translateY(${moveY}px)`;
  }, { passive: true });

  document.addEventListener("touchend", function() {
    if (!isDragging || !canSwipe) return;
    const popup   = document.getElementById("popupHomeCustomer");
    const content = document.getElementById("popupHomeCustomerContent");
    if (!content) return;
    const moveY = currentY - startY;
    content.style.transition = "0.3s ease";
    if (moveY > 120) {
      content.style.transform = "translateY(100%)";
      setTimeout(() => {
        popup.classList.remove("active");
        content.style.transform = "";
        window.fotoBase64Home = null;
      }, 250);
    } else {
      content.style.transform = "";
    }
    isDragging = false; canSwipe = false;
  });
}
