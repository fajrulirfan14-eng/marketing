
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
  
  const customerWrapper = document.querySelector(".home-customer-wrapper");
  const laporanKemarin = document.getElementById("cardLaporanKemarin");
  const extraWrapper = document.querySelector(".home-extra-wrapper");
  
  // Customer hanya hunter
  if (customerWrapper) {
    customerWrapper.style.display =
      role === "hunter"
        ? "block"
        : "none";
  }
  
  // Laporan & Extra disembunyikan untuk hunter dan sales
  const hideLaporanExtra =
    role === "hunter" ||
    role === "sales";
  
  if (laporanKemarin) {
    laporanKemarin.style.display =
      hideLaporanExtra
        ? "none"
        : "";
  }
  
  if (extraWrapper) {
    extraWrapper.style.display =
      hideLaporanExtra
        ? "none"
        : "";
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
              req.onerror = function () {
                  console.log(
                    `IndexedDB save gagal → ${store}`,
                    req.error
                  );
                };
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
            } else {
              console.log("Kantor tidak ditemukan:", idCabang);
            }
          } catch(err) {
            console.log("Gagal fetch kantorCabang:", err);
          }
        } else { }        
        const customerQuery =
          window.query(
            window.collection(
              window.db,
              "customer"
            ),
            window.where(
              "pemilik",
              "==",
              uid
            ),
            window.where(
              "status",
              "==",
              true
            ),
            window.where(
              "hari",
              "==",
              hariAktif
            )
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

        // Hanya update customerHarianDB jika hari customer == hari aktif
        // Supaya data hari lain tetap tersimpan dan tidak tertimpa
        try {
          const idb = await window.openAppDB();

          // Baca semua data existing dulu
          const existingAll = await new Promise((resolve, reject) => {
            const tx = idb.transaction("customerHarianDB", "readonly");
            const store = tx.objectStore("customerHarianDB");
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
          });

          // Buat map dari existing (key: id)
          const existingMap = {};
          existingAll.forEach(item => {
            existingMap[item.id] = item;
          });

          // Cek existing untuk key ini
          const existingEntry = existingMap[customerCacheKey] || null;
          const existingData = existingEntry?.data || [];

          // Filter customer dari hasil fetch yang harinya == hariAktif
          const customerHariIni = customerData.filter(c => c.hari === hariAktif);

          // Clear semua key dulu, lalu simpan ulang per hari
          const semuaKeys = Object.keys(existingMap);
          await new Promise((resolve, reject) => {
            const tx = idb.transaction("customerHarianDB", "readwrite");
            const store = tx.objectStore("customerHarianDB");
            // Hapus semua key yang mengandung uid ini
            semuaKeys.forEach(k => {
              if (k.startsWith(uid)) store.delete(k);
            });
            tx.oncomplete = () => resolve();
            tx.onerror    = () => reject(tx.error);
          });

          // Kelompokkan semua existing per hari (selain hari ini)
          const customerHariLain = existingData.filter(c => c.hari !== hariAktif);

          // Simpan hari lain dengan key masing-masing
          const hariNama = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
          const perHari = {};
          hariNama.forEach(h => perHari[h] = []);
          customerHariLain.forEach(c => {
            if (perHari[c.hari]) perHari[c.hari].push(c);
          });

          await new Promise((resolve, reject) => {
            const tx = idb.transaction("customerHarianDB", "readwrite");
            const store = tx.objectStore("customerHarianDB");
            // Simpan hari lain
            hariNama.forEach(h => {
              if (h !== hariAktif && perHari[h].length > 0) {
                store.put({ id: `${uid}_${h}`, data: perHari[h], updatedAt: Date.now() });
              }
            });
            // Simpan hari ini (fresh dari Firestore)
            store.put({ id: customerCacheKey, data: customerHariIni, updatedAt: Date.now() });
            tx.oncomplete = () => resolve();
            tx.onerror    = () => reject(tx.error);
          });
        } catch { }
      } catch (err) {
        console.log(err); alert("Gagal reload data");
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
  // Skeleton
  const sk = document.getElementById('skeletonHomeCards');
  if (customerWrapper) customerWrapper.style.display = 'none';
  if (laporanKemarin)  laporanKemarin.style.display  = 'none';
  if (extraWrapper)    extraWrapper.style.display    = 'none';

  await Promise.all([
    window.updateHomeStats?.(),
    window.loadLaporanKemarin?.(),
    window.loadRingkasanCustomer?.(),
  ]);

  if (sk) sk.style.display = 'none';
  if (customerWrapper) customerWrapper.style.display = role === 'hunter' ? 'block' : 'none';
  if (laporanKemarin)  laporanKemarin.style.display  = hideLaporanExtra ? 'none' : '';
  if (extraWrapper)    extraWrapper.style.display    = hideLaporanExtra ? 'none' : '';
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

    // Baca dari IndexedDB laporanMarketingDB
    const idb = await window.openAppDB();
    const data = await new Promise((resolve) => {
      const tx = idb.transaction("laporanMarketingDB", "readonly");
      const store = tx.objectStore("laporanMarketingDB");
      const req = store.get(tanggalKemarin);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    const omzetEl   = document.getElementById("laporanKemarinOmset");
    const kasbonEl  = document.getElementById("laporanKemarinKasbon");
    const potonganEl= document.getElementById("laporanKemarinPotongan");
    const bonusEl   = document.getElementById("laporanKemarinBonus");

    if (!data) {
      if (omzetEl)   omzetEl.innerText   = "0";
      if (kasbonEl)  kasbonEl.innerText  = "0";
      if (potonganEl)potonganEl.innerText = "0";
      if (bonusEl)   bonusEl.innerText   = "0";
      return;
    }

    if (omzetEl)    omzetEl.innerText    = Number(data?.distribusi?.keuangan?.inputOmset || 0).toLocaleString("id-ID");
    if (kasbonEl)   kasbonEl.innerText   = Number(data?.distribusi?.keuangan?.Kasbon || 0).toLocaleString("id-ID");
    if (potonganEl) potonganEl.innerText = Number(data?.distribusi?.infoTarget?.potongan?.jumlahPotongan || 0).toLocaleString("id-ID");
    if (bonusEl)    bonusEl.innerText    = Number(data?.distribusi?.keuangan?.bonus?.jumlahBonus || 0).toLocaleString("id-ID");

  } catch(e) {
    console.log("loadLaporanKemarin error:", e);
  }
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

  } catch(e) {
    console.log("loadRingkasanCustomer error:", e);
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
    } catch(e) {
      console.log("Gagal load upahHunter:", e);
    }

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

  } catch(err) {
    console.log("updateHomeStats error:", err);
  }
};
window.openHomeCustomerPopup = async function() {
  const popup = document.getElementById("popupHomeCustomer");
  const stokContainer = document.getElementById("stokContainerHome");

  if (!popup || !stokContainer)
    return;

  // =========================
  // BODY POPUP
  // =========================
  stokContainer.innerHTML = `
    <div class="customer-form">
      <!-- ALAMAT -->
      <div class="popup-group">
        <label>Alamat</label>
        <input type="text" id="alamatCustomerHome" placeholder="Blok dan desa">
      </div>

      <!-- DATA AWAL -->
      <div class="popup-group">
        <label>Data Awal</label>
        <div id="dataAwalContainerHome" class="data-awal-container">
        </div>
      </div>

      <!-- PAYMENT TYPE -->
      <div class="payment-type-wrapper">
        <button type="button" class="payment-type-btn" data-value="Konsinyasi">
          Konsinyasi
        </button>
        <button type="button" class="payment-type-btn" data-value="Cash">
          Cash
        </button>
      </div>

      <!-- LOKASI -->
      <button type="button" class="btn-lokasi" id="btnLokasiHome">
        <span id="btnLokasiSpinnerHome" style="display:none;width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;"></span>
        <span id="btnLokasiTextHome">Ambil Lokasi Sekarang</span>
      </button>

      <!-- FOTO -->
      <div class="foto-wrapper">
        <label class="foto-card" id="fotoCardHome">
          <input type="file" accept="image/*" capture="environment" id="fotoInputHome" hidden>
          <div class="foto-placeholder">
            <i class="fa-solid fa-camera"></i>
            <span>Ambil Foto</span>
          </div>
        </label>
      </div>

      <!-- BUTTON -->
      <button type="button" class="btn-simpan-customer" id="btnSimpanCustomerHome">
        <span id="btnSimpanTextHome">
          Simpan
        </span>
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
    const container = document.getElementById("dataAwalContainerHome");
    const varian = Array.isArray(userData?.varian)
     ? userData.varian : [];

    if (container && varian.length) {
      let html = "";
      varian.forEach(item => {
        const key = Object.keys(item)[0];
        if (!key) return;

        html += `
          <div class="data-awal-item">
            <input type="number" class="data-awal-input" data-key="${key}" placeholder="${key}">
          </div>
        `;
      });
      container.innerHTML = html;
    } else {
      container.innerHTML = `
        <div class="customer-empty">
          Tidak ada data varian
        </div>
      `;
    }

  } catch(err) {
    console.log("Gagal load varian:", err);
  }

  const paymentBtns = document.querySelectorAll(".payment-type-btn");
  paymentBtns.forEach(btn => {
    btn.onclick = function() {
        paymentBtns.forEach(item =>
          item.classList.remove("active")
        );
        this.classList.add("active");
        window.selectedPaymentType = this.dataset.value;
        console.log("Payment:",
          window.selectedPaymentType
        );
      };
  });
  popup.classList.add("active");
  // BUTTON LOKASI + GOOGLE MAPS FULLSCREEN
  let customerLat = null;
  let customerLng = null;
  let lokasiSuccess = false;
  let fullMap = null;

  const btnLokasiHome = document.getElementById("btnLokasiHome");
  const btnLokasiTextHome = document.getElementById("btnLokasiTextHome");
  const btnLokasiSpinnerHome = document.getElementById("btnLokasiSpinnerHome");
  const mapPopupHome = document.getElementById("mapPopupHome");
  const btnSelectLocationHome = document.getElementById("btnSelectLocationHome");
  const btnTutupMapHome = document.getElementById("btnTutupMapHome");

  function openFullMap(lat, lng) {
    mapPopupHome.style.display = "flex";
    document.body.style.overflow = "hidden";

    if (!fullMap) {
      fullMap = new google.maps.Map(document.getElementById("mapFullHome"), {
        center: { lat, lng },
        zoom: 18,
        mapId: "3f6f47bf59913618a195fe2e",
        tilt: 0,
        zoomControl: true,
        mapTypeControl: true,
        streetViewControl: true,
        rotateControl: true,
        fullscreenControl: false
      });
      
      // PIN MARKER
      if (!window.customerMarkerHome) {
        window.customerMarkerHome = new google.maps.Marker({
          position: { lat, lng },
          map: fullMap,
          draggable: true,
          animation: google.maps.Animation.DROP,
          icon: {
            url: "pin.png",
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 40)
          }
        });
      } else {
        window.customerMarkerHome.setPosition({ lat, lng });
        window.customerMarkerHome.setMap(fullMap);
      }
      
      // LONG PRESS HANDLER
      const mapDiv = document.getElementById("mapFullHome");
      let lpTimer = null;
      let lpMoved = false;
      
      mapDiv.addEventListener("touchstart", (e) => {
        if (e.touches.length !== 1) return;
        lpMoved = false;
        const touch = e.touches[0];
        lpTimer = setTimeout(() => {
          if (lpMoved) return;
          // Konversi pixel touch ke LatLng
          const mapRect = mapDiv.getBoundingClientRect();
          const x = touch.clientX - mapRect.left;
          const y = touch.clientY - mapRect.top;
          const overlay = new google.maps.OverlayView();
          overlay.draw = function(){};
          overlay.setMap(fullMap);
          google.maps.event.addListenerOnce(overlay, "add", () => {
            const proj = overlay.getProjection();
            const point = new google.maps.Point(x, y);
            const latLng = proj.fromContainerPixelToLatLng(point);
            if (latLng) {
              window.customerMarkerHome.setPosition(latLng);
              fullMap.panTo(latLng);
            }
            overlay.setMap(null);
          });
        }, 600);
      }, { passive: true });
      
      mapDiv.addEventListener("touchmove", () => {
        lpMoved = true;
        clearTimeout(lpTimer);
      }, { passive: true });
      
      mapDiv.addEventListener("touchend", () => {
        clearTimeout(lpTimer);
      }, { passive: true });
      
      // TOMBOL BALIK KE POSISI GPS
      const btnMyLocation = document.createElement("button");
      btnMyLocation.innerHTML = `<img src="https://maps.gstatic.com/tactile/mylocation/mylocation-sprite-2x.png" style="width:18px;height:18px;background-size:cover;">`;
      btnMyLocation.style.cssText = `
        width:40px;height:40px;background:#fff;border:0;
        border-radius:4px;box-shadow:0 2px 6px #0003;
        cursor:pointer;display:flex;align-items:center;justify-content:center;
        margin:10px;
      `;
      btnMyLocation.onclick = () => {
        fullMap.panTo({ lat, lng });
        fullMap.setZoom(18);
        window.customerMarkerHome.setPosition({ lat, lng });
      };
      fullMap.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(btnMyLocation);
    } else {
      fullMap.setCenter({ lat, lng });
    }
  }

  // KLIK AMBIL LOKASI
  btnLokasiHome.onclick = function() {
    if (!navigator.geolocation) {
      btnLokasiTextHome.innerText = "GPS tidak didukung";
      return;
    }

    btnLokasiHome.disabled = true;
    btnLokasiSpinnerHome.style.display = "inline-block";
    btnLokasiTextHome.innerText = "Mengambil...";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        btnLokasiSpinnerHome.style.display = "none";
        btnLokasiHome.disabled = false;
        // Buka map fullscreen
        openFullMap(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        btnLokasiHome.disabled = false;
        btnLokasiSpinnerHome.style.display = "none";
        btnLokasiHome.style.background = "#e53935";
        const pesanError = {
          1: "Izin lokasi ditolak",
          2: "Lokasi tidak tersedia",
          3: "Timeout, coba lagi"
        };
        btnLokasiTextHome.innerText = pesanError[err.code] || "Gagal, Coba Lagi";
        setTimeout(() => {
          btnLokasiHome.style.background = "";
          btnLokasiTextHome.innerText = "📍 Ambil Lokasi Sekarang";
          btnLokasiHome.disabled = false;
        }, 2500);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // KLIK "PILIH LOKASI" — ambil center map sebagai koordinat
  btnSelectLocationHome.onclick = function(e) {
    e.stopPropagation();
    const pos = window.customerMarkerHome.getPosition();
    customerLat = pos.lat();
    customerLng = pos.lng();
    lokasiSuccess = true;
    mapPopupHome.style.display = "none";
    document.body.style.overflow = "";
    btnLokasiHome.style.background = "#4caf50";
    btnLokasiTextHome.innerText = "✓ Lokasi Dipilih";
    // Destroy map setelah lokasi dipilih
    window.customerMarkerHome?.setMap(null);
    window.customerMarkerHome = null;
    fullMap = null;
    const mapDiv = document.getElementById("mapFullHome");
    if (mapDiv) mapDiv.innerHTML = "";
  };
  // KLIK ✕ TUTUP MAP
  btnTutupMapHome.onclick = function() {
    mapPopupHome.style.display = "none";
    document.body.style.overflow = "";
    btnLokasiHome.disabled = false;
    btnLokasiSpinnerHome.style.display = "none";
    btnLokasiTextHome.innerText = "📍 Ambil Lokasi Sekarang";
    // Destroy map instance supaya tidak memory leak
    if (fullMap) {
      window.customerMarkerHome?.setMap(null);
      window.customerMarkerHome = null;
      fullMap = null;
      const mapDiv = document.getElementById("mapFullHome");
      if (mapDiv) mapDiv.innerHTML = "";
    }
  };
  // FOTO PREVIEW
  const fotoInputHome = document.getElementById("fotoInputHome");
  const fotoCardHome = document.getElementById("fotoCardHome");

  fotoInputHome.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      fotoCardHome.innerHTML = `
        <img src="${ev.target.result}"
          style="width:100%;height:100%;object-fit:cover;border-radius:16px;">
      `;
      window.fotoBase64Home = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  // COMPRESS IMAGE
  async function compressImageHome(base64) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        const maxSize = 800;
        if (w > h) { if (w > maxSize) { h *= maxSize / w; w = maxSize; } }
        else { if (h > maxSize) { w *= maxSize / h; h = maxSize; } }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
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

      // PAYMENT TYPE
      const paymentType = window.selectedPaymentType || "";
      if (!paymentType) throw new Error("Pilih tipe pembayaran");

      // DATA AWAL
      const dataAwalInputs = document.querySelectorAll(".data-awal-input");
      const dataAwal = {};
      dataAwalInputs.forEach(input => {
        const key = input.dataset.key;
        const val = input.value.trim();
        if (key && val !== "") dataAwal[key] = Number(val);
      });

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
      } catch(e) {
        console.log("Gagal load varian:", e);
      }

      // HITUNG KETERANGAN
      let hargaPendam = 0;
      let hargaJual = 0;
      let cashback = 0;

      Object.entries(dataAwal).forEach(([key, qty]) => {
        const varian = varianMap[key] || {};
        hargaPendam += qty * Number(varian.hargaProduksi || 0);
        hargaJual   += qty * Number(varian.hargaKonsumen || 0);
        cashback    += qty * Number(varian.hargaKonsumen || 0);
      });

      const keterangan = {};
      if (paymentType === "Konsinyasi") {
        keterangan.modal = { hargaPendam, hargaJual };
      } else if (paymentType === "Cash") {
        keterangan.cashback = cashback;
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
      } catch(e) {
        console.log("Gagal hitung jarak:", e);
      }

      // Siapkan compressed foto (upload setelah dapat idCustomer)
      let compressedFoto = null;
      if (window.fotoBase64Home) {
        compressedFoto = await compressImageHome(window.fotoBase64Home);
      }

      // ID CUSTOMER dibuat setelah addDoc
      let idCustomer = "";
      let foto = "";

      // DATA CUSTOMER (tanpa foto dulu)
      const dataCustomer = {
        idCustomer,
        namaCustomer,
        alamatCustomer,
        tanggal: today,
        hari,
        foto,
        idCabang: user.idCabang || "",
        createdBy: uid,
        jarak,
        [paymentType.toLowerCase()]: dataAwal,
        keterangan,
        diserahkan: false
      };

      // SAVE FIRESTORE
      const colRef = window.collection(
        window.db,
        "users", uid,
        "customerBaruHunter"
      );
      const docRef = await window.addDoc(colRef, {
        ...dataCustomer,
        lokasiCustomer: new window.GeoPoint(customerLat || 0, customerLng || 0),
        createdAt: window.serverTimestamp()
      });
      idCustomer = docRef.id;

      // UPLOAD FOTO KE STORAGE setelah dapat idCustomer
      if (compressedFoto) {
        const storageRef = window.storageRef(
          window.storage,
          `fotoCustomer/${idCustomer}`
        );
        const blob = await fetch(compressedFoto).then(r => r.blob());
        await window.uploadBytes(storageRef, blob, {
          contentType: "image/jpeg"
        });
        foto = await window.getDownloadURL(storageRef);
      }

      // UPDATE idCustomer + foto URL ke Firestore
      await window.updateDoc(docRef, { idCustomer, foto });
      // SAVE INDEXDB
      const idb = await window.openAppDB();
      const txIdb = idb.transaction("customerBaruDB", "readwrite");
      const storeIdb = txIdb.objectStore("customerBaruDB");
      storeIdb.put({
        ...dataCustomer,
        id: idCustomer,
        foto,
        lokasiCustomer: window.normalizeGeoPoint(
          new window.GeoPoint(customerLat || 0, customerLng || 0)
        ),
        createdAt: Date.now()
      });
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
      console.log(err);
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

(function() {
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let canSwipe = false;

  document.addEventListener("touchstart",
    function(e) {
      const popup = document.getElementById("popupHomeCustomer");
      const content = document.getElementById("popupHomeCustomerContent");
      if (!popup || !content)
        return;
      if (!popup.classList.contains("active"))
        return;
      if (e.target.closest("#mapPopupHome")) {
        canSwipe = false;
        return;
      }
      if (e.target.closest("input, textarea, select")){
        canSwipe = false;
        return;
      }
      if (content.scrollTop > 0) {
        canSwipe = false;
        return;
      }
      canSwipe = true;
      isDragging = true;
      startY = e.touches[0].clientY;
      currentY = startY;
      content.style.transition = "none";
    },
    { passive: true }
  );

  document.addEventListener("touchmove", function(e) {
      if (
        !isDragging ||
        !canSwipe
      ) return;
      const content = document.getElementById("popupHomeCustomerContent");
      if (!content) return;
      currentY = e.touches[0].clientY;
      const moveY = currentY - startY;
      if (moveY > 0) {
        content.style.transform = `translateY(${moveY}px)`;
      }
    },
    { passive: true }
  );
  document.addEventListener("touchend",
    function() {
      if (
        !isDragging ||
        !canSwipe
      ) return;
      const popup = document.getElementById("popupHomeCustomer");
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
          customerLat = null;
          customerLng = null;
        }, 250);
      } else {
        content.style.transform = "";
      }
      isDragging = false;
      canSwipe = false;
    }
  );
})();
