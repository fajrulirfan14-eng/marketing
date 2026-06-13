
window.initRollingView = async function () {
  console.log("Rolling view ready");

  const customerList = document.getElementById("rollingCustomerList");

  // Toggle bottom bar
  const btnToggleBar = document.getElementById("btnToggleSearchBar");
  const bottomBar = document.getElementById("rollingBottomBar");
  if (btnToggleBar && bottomBar) {
    btnToggleBar.onclick = function() {
      bottomBar.classList.toggle("closed");
    };
  }

  // FILTER HARI INIT
  const hariNama = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const hariHariIni = hariNama[new Date().getDay()];

  if (!window.rollingFilterHari) {
    window.rollingFilterHari = "CustomerBaru";
  }

  // Set active item dropdown
  document.querySelectorAll(".rolling-hari-item").forEach(item => {
    item.classList.toggle("active", item.dataset.hari === window.rollingFilterHari);
    item.onclick = function() {
      window.rollingFilterHari = this.dataset.hari;
      document.querySelectorAll(".rolling-hari-item").forEach(i => i.classList.remove("active"));
      this.classList.add("active");
      document.getElementById("rollingHariDropdown").classList.remove("open");
      window.initRollingView();
    };
  });

  // Toggle dropdown
  const btnFilterHari = document.getElementById("btnFilterHari");
  const dropdown = document.getElementById("rollingHariDropdown");
  if (btnFilterHari) {
    btnFilterHari.onclick = function(e) {
      e.stopPropagation();
      dropdown.classList.toggle("open");
    };
  }
  const searchInput = document.getElementById("rollingSearchInput");
  if (searchInput) {
    searchInput.oninput = function() {
      window.initRollingView();
    };
  }
  document.addEventListener("click", function closeDropdown(e) {
    if (!e.target.closest("#rollingHariWrapper")) {
      dropdown?.classList.remove("open");
    }
  });

  // =========================
  // TOMBOL RELOAD (SYNC FIRESTORE)
  // =========================
  const btnReload = document.getElementById("btnReloadRolling");
  if (btnReload) {
    btnReload.onclick = async function() {
      btnReload.classList.add("loading");
      btnReload.disabled = true;
      try {
        const uid = window.auth.currentUser.uid;
        const filterHari = window.rollingFilterHari;

        // Query Firestore
        let q;
        const colRef = window.collection(
          window.db, "users", uid, "customerBaruHunter"
        );
        console.log("🔍 UID:", uid);
        console.log("🔍 Path:", `users/${uid}/customerBaruHunter`);
        const uid2 = window.auth.currentUser.uid;
        if (filterHari && filterHari !== "Semua") {
          q = window.query(
            colRef,
            window.where("createdBy", "==", uid2),
            window.where("hari", "==", filterHari)
          );
        } else {
          q = window.query(
            colRef,
            window.where("createdBy", "==", uid2)
          );
        }

        const snapshot = await window.getDocs(q);
        const docs = [];
        snapshot.forEach(d => docs.push({ ...d.data(), id: d.id }));
        console.log("📦 Docs dari Firestore:", docs.length, docs);

        // Simpan ke IndexedDB (replace semua yang di-query)
        const idb = await window.openAppDB();
        const tx = idb.transaction("customerBaruDB", "readwrite");
        const store = tx.objectStore("customerBaruDB");

        // Kalau filter semua → clear dulu, kalau filter hari → put saja
        if (filterHari === "Semua") {
          await new Promise(r => { store.clear().onsuccess = r; });
        }
        console.log("💾 Mau disimpan ke IDB:", docs.length, "item");
        docs.forEach(item => {
          // Normalize GeoPoint
          if (item.lokasiCustomer) {
            item.lokasiCustomer = window.normalizeGeoPoint(item.lokasiCustomer);
          }
          store.put({ ...item });
        });

        await new Promise((res, rej) => {
          tx.oncomplete = res;
          tx.onerror = () => rej(tx.error);
        });

        console.log(`✅ Sync ${docs.length} customer (${filterHari})`);
      } catch(err) {
        console.log("Gagal sync:", err);
      } finally {
        btnReload.classList.remove("loading");
        btnReload.disabled = false;
        window.initRollingView();
      }
    };
  }

  // LEFT PANEL (INDEXEDDB)
  try {
    const db = await window.openAppDB();
    const tx = db.transaction("customerBaruDB", "readonly");
    const store = tx.objectStore("customerBaruDB");

    const data = await new Promise((resolve, reject) => {
      const req = store.getAll();
    
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    
    // =========================
    // DEBUG CUSTOMERBARUDB
    // =========================
    console.log("Semua customerBaruDB:", data);
    
    console.table(data);
    
    data.forEach((item, index) => {
      console.log(`Customer ${index + 1}`, item);
    });
    
    // APPLY FILTER HARI
    const todayStr = new Date().toISOString().split("T")[0]; // "2026-06-12"

    let filtered;
    if (window.rollingFilterHari === "CustomerBaru") {
      filtered = data.filter(item => item.tanggal === todayStr);
    } else if (window.rollingFilterHari === "Semua") {
      filtered = data;
    } else {
      filtered = data.filter(item => item.hari === window.rollingFilterHari);
    }

    // Update jumlah customer
    const elJumlah = document.getElementById("rollingJumlahCustomer");
    if (elJumlah) elJumlah.textContent = `${filtered.length} Customer`;

    // Search filter
    const searchVal = (document.getElementById("rollingSearchInput")?.value || "").toLowerCase();
    const tampil = searchVal
      ? filtered.filter(item => (item.namaCustomer || "").toLowerCase().includes(searchVal))
      : filtered;

    // kosong
    if (!tampil.length) {
      customerList.innerHTML = `
        <div class="placeholder">Tidak ada customer</div>
      `;
      return;
    }

    // render list customer
    customerList.innerHTML = tampil.map(item => {

      const foto =
        item.foto ||
        "https://via.placeholder.com/100";

      const nama =
        item.namaCustomer ||
        "-";

      const jarak =
        item.jarak != null
          ? `${item.jarak} km`
          : "-";

      const hari = item.hari || "-";
      const badgeCatatan = item.catatan
        ? `<span class="rolling-badge-catatan">𓂃✍︎</span>`
        : "";

      return `
        <div class="rolling-customer-item" onclick="openRollingCustomerPopup('${item.id}')">
          <img class="rolling-avatar" src="${foto}" />
          
          <div class="rolling-info">
            <div class="rolling-name">${nama} ${badgeCatatan}</div>
            <div class="rolling-distance">${jarak}</div>
            <div class="rolling-hari">${hari}</div>
          </div>

          <div class="rolling-actions">
            <button class="rolling-action-btn" onclick="event.stopPropagation(); window.openMapRouting('${item.id}')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </button>
            <button class="rolling-action-btn" onclick="event.stopPropagation(); openCatatanPopup('${item.id}')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.log("Rolling view error:", err);

    customerList.innerHTML = `
      <div class="placeholder">
        Gagal load customer
      </div>
    `;
  }
};
window.openRollingCustomerPopup = async function (idCustomer) {
  console.log("Open rolling popup:", idCustomer);

  const popup = document.getElementById("popupRollingCustomer");
  const inputNama = document.getElementById("inputNamaCustomerRolling");
  const inputAlamat = document.getElementById("alamatCustomerRolling");
  const container = document.getElementById("dataAwalContainerRolling");

  if (!popup || !inputNama || !inputAlamat || !container) return;

  try {
    const db = await window.openAppDB();

    // =========================
    // 1. AMBIL CUSTOMER
    // =========================
    const tx = db.transaction("customerBaruDB", "readonly");
    const store = tx.objectStore("customerBaruDB");

    const data = await new Promise((resolve) => {
      const req = store.get(idCustomer);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    if (!data) return;

    window.rollingEditId = idCustomer;

    inputNama.value = data.namaCustomer || "";
    inputAlamat.value = data.alamatCustomer || "";

    // =========================
    // 2. AMBIL VARIAN MASTER (usersDB)
    // =========================
    const tx2 = db.transaction("usersDB", "readonly");
    const store2 = tx2.objectStore("usersDB");

    const uid = window.auth.currentUser.uid;

    const userData = await new Promise(resolve => {
      const req = store2.get(uid);
      req.onsuccess = () => resolve(req.result?.data || null);
      req.onerror = () => resolve(null);
    });

    const varian = Array.isArray(userData?.varian) ? userData.varian : [];

    // =========================
    // 3. DETECT PAYMENT
    // =========================
    const paymentKey =
      data.konsinyasi ? "konsinyasi" :
      data.cash ? "cash" : null;

    const dataAwal = data[paymentKey] || {};

    // =========================
    // 4. BUILD MAP VALUE
    // =========================
    const valueMap = {};
    Object.entries(dataAwal).forEach(([k, v]) => {
      valueMap[k] = v;
    });

    // =========================
    // 5. RENDER DATA AWAL (WAJIB URUT VARIAN)
    // =========================
    let html = "";

    varian.forEach(item => {
      const key = Object.keys(item)[0];
      if (!key) return;

      const val = valueMap[key] ?? "";

      html += `
        <div class="data-awal-item">
          <input
            type="number"
            class="data-awal-input"
            data-key="${key}"
            value="${val}"
            placeholder="${key}">
        </div>
      `;
    });

    container.innerHTML = html || `
      <div class="customer-empty">Tidak ada data varian</div>
    `;

    // =========================
    // 6. PAYMENT ACTIVE STATE
    // =========================
    document.querySelectorAll(".payment-type-btn").forEach(btn => {
      btn.classList.remove("active");

      if (btn.dataset.value.toLowerCase() === paymentKey) {
        btn.classList.add("active");
      }

      btn.onclick = function () {
        document.querySelectorAll(".payment-type-btn")
          .forEach(b => b.classList.remove("active"));

        this.classList.add("active");
        // Samakan ke lowercase supaya konsisten dengan key IndexedDB
        window.selectedPaymentTypeRolling = this.dataset.value.toLowerCase();
      };
    });

    window.selectedPaymentTypeRolling = paymentKey; // sudah lowercase

    const fotoCard = document.getElementById("fotoCardRolling");
    if (data.foto) {
      fotoCard.innerHTML = `
        <img src="${data.foto}"
          style="width:100%;height:100%;object-fit:cover;border-radius:16px;">
      `;
    } else {
      fotoCard.innerHTML = "";
    }
    
    // Klik foto → buka kamera
    fotoCard.onclick = function () {
      const inputKamera = document.createElement("input");
      inputKamera.type = "file";
      inputKamera.accept = "image/*";
      inputKamera.capture = "environment";
    
      inputKamera.onchange = async function () {
        const file = inputKamera.files[0];
        if (!file) return;
    
        const reader = new FileReader();
        reader.onload = function (e) {
        const base64 = e.target.result;
  
        // Simpan sementara di variable, belum ke IndexedDB
        window.rollingFotoBaru = base64;
  
        // Tampilkan preview saja
        fotoCard.innerHTML = `
          <img src="${base64}"
            style="width:100%;height:100%;object-fit:cover;border-radius:16px;">
        `;
      };
    
        reader.readAsDataURL(file);
      };
    
      inputKamera.click();
    };

    popup.classList.add("active");

  } catch (err) {
    console.log("Rolling popup error:", err);
  }
};
document.getElementById("btnUpdateRolling")?.addEventListener("click", async function () {
  const id = window.rollingEditId;
  if (!id) return;

  try {
    // =========================
    // STEP 1: SEMUA READ DULU
    // =========================

    // Read existing customer
    const db = await window.openAppDB();
    const existing = await new Promise(resolve => {
      const tx = db.transaction("customerBaruDB", "readonly");
      const store = tx.objectStore("customerBaruDB");
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || {});
      req.onerror = () => resolve({});
    });

    // Read varianMap dari usersDB
    let varianMap = {};
    try {
      const uid = window.auth.currentUser.uid;
      const db2 = await window.openAppDB();
      const tx2 = db2.transaction("usersDB", "readonly");
      const store2 = tx2.objectStore("usersDB");
      const userData = await new Promise(resolve => {
        const req = store2.get(uid);
        req.onsuccess = () => resolve(req.result?.data || null);
        req.onerror = () => resolve(null);
      });
      (userData?.varian || []).forEach(item => {
        const key = Object.keys(item)[0];
        if (key) varianMap[key] = item[key];
      });
    } catch(e) {
      console.log("Gagal load varianMap:", e);
    }

    // =========================
    // STEP 2: PROSES DATA
    // =========================

    // Update nama & alamat
    existing.namaCustomer = document.getElementById("inputNamaCustomerRolling").value || existing.namaCustomer;
    existing.alamatCustomer = document.getElementById("alamatCustomerRolling").value || existing.alamatCustomer;

    // Update foto kalau ada foto baru
    if (window.rollingFotoBaru) {
      existing.foto = window.rollingFotoBaru;
      window.rollingFotoBaru = null;
    }

    // Update payment type & varian
    const paymentKey = window.selectedPaymentTypeRolling;
    if (paymentKey) {

      // Kumpulkan input varian
      const inputs = document.querySelectorAll("#dataAwalContainerRolling .data-awal-input");
      const varianData = {};
      inputs.forEach(input => {
        const key = input.dataset.key;
        const val = input.value;
        if (key) varianData[key] = val !== "" ? Number(val) : 0;
      });

      // Hitung ulang keterangan
      let hargaPendam = 0;
      let hargaJual = 0;
      let cashback = 0;

      Object.entries(varianData).forEach(([key, qty]) => {
        const v = varianMap[key] || {};
        hargaPendam += qty * Number(v.hargaProduksi || 0);
        hargaJual   += qty * Number(v.hargaKonsumen || 0);
        cashback    += qty * Number(v.hargaKonsumen || 0);
      });

      const keterangan = {};
      if (paymentKey === "konsinyasi") {
        keterangan.modal = { hargaPendam, hargaJual };
      } else if (paymentKey === "cash") {
        keterangan.cashback = cashback;
      }

      // Hapus payment lama, set yang baru
      delete existing.konsinyasi;
      delete existing.cash;
      existing[paymentKey] = varianData;
      existing.keterangan = keterangan;
    }

    // =========================
    // STEP 3: UPDATE FIRESTORE
    // =========================
    const uid = window.auth.currentUser.uid;
    const docRef = window.doc(
      window.db,
      "users", uid,
      "customerBaruHunter", existing.id
    );

    // Hapus field payment lama, set yang baru (sama seperti saat Simpan)
    const updatePayload = {
      namaCustomer: existing.namaCustomer,
      alamatCustomer: existing.alamatCustomer,
      foto: existing.foto || "",
      keterangan: existing.keterangan || {},
      konsinyasi: window.deleteField(),
      cash: window.deleteField(),
      [existing.konsinyasi ? "konsinyasi" : "cash"]:
        existing.konsinyasi || existing.cash,
    };

    await window.updateDoc(docRef, updatePayload);
    console.log("☁️ Firestore update berhasil");

    // =========================
    // STEP 4: WRITE INDEXEDDB
    // =========================
    const dbWrite = await window.openAppDB();
    await new Promise((resolve, reject) => {
      const tx = dbWrite.transaction("customerBaruDB", "readwrite");
      const store = tx.objectStore("customerBaruDB");
      const req = store.put(existing);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    console.log("Update berhasil");

    // Tutup popup & refresh list
    document.getElementById("popupRollingCustomer").classList.remove("active");
    window.initRollingView();

  } catch (err) {
    console.log("Gagal update:", err);
  }
});
window.openCatatanPopup = async function(idCustomer) {
  try {
    const db = await window.openAppDB();
    const tx = db.transaction("customerBaruDB", "readonly");
    const store = tx.objectStore("customerBaruDB");
    const data = await new Promise(resolve => {
      const req = store.get(idCustomer);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    if (!data) return;

    window.catatanEditId = idCustomer;

    document.getElementById("popupCatatanNama").textContent = data.namaCustomer || "-";
    document.getElementById("popupCatatanText").value = data.catatan || "";

    const updateStr = data.catatanUpdatedAt
      ? `Update: ${new Date(data.catatanUpdatedAt).toLocaleDateString("id-ID", { day:"2-digit", month:"short", year:"numeric" })}`
      : "Update: -";
    document.getElementById("popupCatatanUpdate").textContent = updateStr;

    document.getElementById("popupCatatanCustomer").classList.add("active");

  } catch(err) {
    console.log("Gagal buka catatan:", err);
  }
};
document.getElementById("btnSimpanCatatan")?.addEventListener("click", async function() {
  const id = window.catatanEditId;
  if (!id) return;

  const btnText = document.getElementById("btnSimpanCatatanText");
  btnText.textContent = "Menyimpan...";

  try {
    const catatan = document.getElementById("popupCatatanText").value;
    const now = Date.now();

    // Update Firestore
    const uid = window.auth.currentUser.uid;
    const docRef = window.doc(window.db, "users", uid, "customerBaruHunter", id);
    await window.updateDoc(docRef, { catatan, catatanUpdatedAt: now });

    // Update IndexedDB
    const db = await window.openAppDB();
    const existing = await new Promise(resolve => {
      const tx = db.transaction("customerBaruDB", "readonly");
      const store = tx.objectStore("customerBaruDB");
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || {});
      req.onerror = () => resolve({});
    });

    existing.catatan = catatan;
    existing.catatanUpdatedAt = now;

    await new Promise((resolve, reject) => {
      const tx = db.transaction("customerBaruDB", "readwrite");
      const store = tx.objectStore("customerBaruDB");
      const req = store.put(existing);
      req.onsuccess = resolve;
      req.onerror = () => reject(req.error);
    });

    btnText.textContent = "Tersimpan ✓";
    setTimeout(() => {
      document.getElementById("popupCatatanCustomer").classList.remove("active");
      btnText.textContent = "Simpan";
    }, 800);

  } catch(err) {
    console.log("Gagal simpan catatan:", err);
    btnText.textContent = "Simpan";
  }
});
document.getElementById("popupCatatanCustomer")?.addEventListener("click", function(e) {
  if (e.target.id === "popupCatatanCustomer") {
    this.classList.remove("active");
  }
});
document.getElementById("popupRollingCustomer")?.addEventListener("click", function (e) {
    if (e.target.id === "popupRollingCustomer") {
      this.classList.remove("active");
      window.rollingFotoBaru = null;
    }
  });
(function() {
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let canSwipe = false;

  document.addEventListener("touchstart", function(e) {
    const popup = document.getElementById("popupRollingCustomer");
    const content = document.getElementById("popupRollingCustomerContent");

    if (!popup || !content) return;
    if (!popup.classList.contains("active")) return;

    // jangan swipe kalau lagi input
    if (e.target.closest("input, textarea, select")) {
      canSwipe = false;
      return;
    }

    // kalau scroll belum di atas
    if (content.scrollTop > 0) {
      canSwipe = false;
      return;
    }

    canSwipe = true;
    isDragging = true;
    startY = e.touches[0].clientY;
    currentY = startY;

    content.style.transition = "none";
  }, { passive: true });

  document.addEventListener("touchmove", function(e) {
    if (!isDragging || !canSwipe) return;

    const content = document.getElementById("popupRollingCustomerContent");
    if (!content) return;

    currentY = e.touches[0].clientY;
    const moveY = currentY - startY;

    if (moveY > 0) {
      content.style.transform = `translateY(${moveY}px)`;
    }

  }, { passive: true });

  document.addEventListener("touchend", function() {
    if (!isDragging || !canSwipe) return;

    const popup = document.getElementById("popupRollingCustomer");
    const content = document.getElementById("popupRollingCustomerContent");

    if (!content) return;

    const moveY = currentY - startY;
    content.style.transition = "0.3s ease";

    if (moveY > 120) {
      content.style.transform = "translateY(100%)";

      setTimeout(() => {
        popup.classList.remove("active");
        content.style.transform = "";
        window.rollingFotoBaru = null;
      }, 250);

    } else {
      content.style.transform = "";
    }

    isDragging = false;
    canSwipe = false;
  });
})();
