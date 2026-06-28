window.initCustomerSalesView = async function() {
  const listEl = document.getElementById("customerSalesList");
  if (!listEl) return;

  const hariNama = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const now      = new Date();

  // Toggle bottom bar
  const btnToggle = document.getElementById("btnToggleSearchBarSales");
  const bottomBar = document.getElementById("customerSalesBottomBar");
  if (btnToggle && bottomBar) {
    btnToggle.onclick = () => bottomBar.classList.toggle("closed");
  }

  // Filter hari
  if (!window.salesFilterHari) window.salesFilterHari = "Hari Ini";

  document.querySelectorAll(".customer-sales-hari-item").forEach(item => {
    item.classList.toggle("active", item.dataset.hari === window.salesFilterHari);
    item.onclick = function() {
      window.salesFilterHari = this.dataset.hari;
      document.querySelectorAll(".customer-sales-hari-item").forEach(i => i.classList.remove("active"));
      this.classList.add("active");
      document.getElementById("customerSalesHariDropdown").classList.remove("open");
      window.initCustomerSalesView();
    };
  });

  const btnFilter  = document.getElementById("btnFilterHariSales");
  const dropdown   = document.getElementById("customerSalesHariDropdown");
  if (btnFilter) {
    btnFilter.onclick = e => { e.stopPropagation(); dropdown.classList.toggle("open"); };
  }

  // Search
  const searchInput = document.getElementById("customerSalesSearchInput");
  if (searchInput) {
    searchInput.oninput = () => window.initCustomerSalesView();
  }

  document.addEventListener("click", e => {
    if (!e.target.closest("#customerSalesHariWrapper")) dropdown?.classList.remove("open");
  });

  // Filter bulan & tahun
  const selectBulan = document.getElementById("customerSalesFilterBulan");
  const selectTahun = document.getElementById("customerSalesFilterTahun");

  window.salesFilterBulan = now.getMonth() + 1;
  window.salesFilterTahun = now.getFullYear();

  if (selectTahun && !selectTahun.options.length) {
    const tahunIni = now.getFullYear();
    for (let y = tahunIni; y >= tahunIni - 3; y--) {
      const opt = document.createElement("option");
      opt.value = y; opt.textContent = y;
      selectTahun.appendChild(opt);
    }
  }
  if (selectBulan) selectBulan.value = window.salesFilterBulan;
  if (selectTahun) selectTahun.value = window.salesFilterTahun;

  if (selectBulan) {
    selectBulan.onchange = function() {
      window.salesFilterBulan = Number(this.value);
      window.initCustomerSalesView();
    };
  }
  if (selectTahun) {
    selectTahun.onchange = function() {
      window.salesFilterTahun = Number(this.value);
      window.initCustomerSalesView();
    };
  }

  // Reload
  const btnReload = document.getElementById("btnReloadCustomerSales");
  if (btnReload) {
    btnReload.onclick = async function() {
      btnReload.classList.add("loading");
      btnReload.disabled = true;
      try {
        const uid         = window.auth.currentUser.uid;
        const bulanFilter = window.salesFilterBulan;
        const tahunFilter = window.salesFilterTahun;
        const tglAwal     = `${tahunFilter}-${String(bulanFilter).padStart(2,"0")}-01`;
        const tglAkhir    = `${tahunFilter}-${String(bulanFilter).padStart(2,"0")}-31`;

        const snap = await window.getDocs(window.query(
          window.collection(window.db, "customerSales"),
          window.where("createdBy", "==", uid),
          window.where("tanggal", ">=", tglAwal),
          window.where("tanggal", "<=", tglAkhir)
        ));

        const docs = snap.docs.map(d => {
          const data = d.data();
          if (data.lokasiCustomer) data.lokasiCustomer = window.normalizeGeoPoint(data.lokasiCustomer);
          return { ...data, id: d.id };
        });

        const idb = await window.openAppDB();
        await new Promise((resolve, reject) => {
          const tx    = idb.transaction("customerSalesDB", "readwrite");
          const store = tx.objectStore("customerSalesDB");
          docs.forEach(item => store.put(item));
          tx.oncomplete = () => resolve();
          tx.onerror    = () => reject(tx.error);
        });
      } catch(e) {
        console.log("Gagal reload sales:", e);
      } finally {
        btnReload.classList.remove("loading");
        btnReload.disabled = false;
        window.initCustomerSalesView();
      }
    };
  }

  // Load dari IndexedDB
  try {
    const idb  = await window.openAppDB();
    const data = await new Promise((resolve, reject) => {
      const tx  = idb.transaction("customerSalesDB", "readonly");
      const req = tx.objectStore("customerSalesDB").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });

    const todayStr    = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const uid         = window.auth.currentUser?.uid;
    const bulan       = window.salesFilterBulan;
    const tahun       = window.salesFilterTahun;

    function dalamBulanTahun(item) {
      if (!item.tanggal) return false;
      const [y, m] = item.tanggal.split("-").map(Number);
      return m === bulan && y === tahun;
    }

    let filtered = data.filter(item => item.diserahkan !== true && item.createdBy === uid);

    if (window.salesFilterHari === "Hari Ini") {
      filtered = filtered.filter(item => item.tanggal === todayStr);
    } else if (window.salesFilterHari !== "Semua") {
      filtered = filtered.filter(item => item.hari === window.salesFilterHari && dalamBulanTahun(item));
    } else {
      filtered = filtered.filter(item => dalamBulanTahun(item));
    }

    const elJumlah = document.getElementById("customerSalesJumlah");
    if (elJumlah) elJumlah.textContent = filtered.length;

    // Hitung modal pendam per varian dan total
    let totalModalPendam = 0;
    const modalPerVarian = {};

    filtered.forEach(item => {
      totalModalPendam += Number(item.keterangan?.modal?.hargaPendam || 0);
      // Hitung qty per varian dari konsinyasi
      Object.entries(item.konsinyasi || {}).forEach(([key, qty]) => {
        modalPerVarian[key] = (modalPerVarian[key] || 0) + Number(qty);
      });
    });
    // Aset customer — jumlah filtered × upahHunter
    let upahHunter = 0;
    try {
      const user     = window.currentUser || {};
      const idbK     = await window.openAppDB();
      const kantorRaw = await new Promise(resolve => {
        const tx = idbK.transaction("kantorDB", "readonly");
        const r  = tx.objectStore("kantorDB").get(user.idCabang || "");
        r.onsuccess = () => resolve(r.result || null);
        r.onerror   = () => resolve(null);
      });
      const kantorData = kantorRaw?.data || kantorRaw;
      upahHunter = Number(kantorData?.upahHunter || 0);
    } catch { }

    const totalAsetCustomer = filtered.length * upahHunter;
    const totalAset         = totalModalPendam + totalAsetCustomer;

    const elModal  = document.getElementById("salesModalPendam");
    const elAset   = document.getElementById("salesAsetCustomer");
    const elTotal  = document.getElementById("salesTotalAset");

    if (elModal) elModal.textContent   = "Rp " + totalModalPendam.toLocaleString("id-ID");
    if (elAset)  elAset.textContent    = "Rp " + totalAsetCustomer.toLocaleString("id-ID");
    if (elTotal) elTotal.textContent   = "Rp " + totalAset.toLocaleString("id-ID");

    // Render grid modal per varian
    const elVarianGrid = document.getElementById("salesModalVarianGrid");
    if (elVarianGrid) {
      const keys = Object.keys(modalPerVarian);
      if (keys.length) {
        elVarianGrid.innerHTML = keys.map(k => `
          <div class="cs-varian-box">
            <div class="cs-varian-label">${k}</div>
            <div class="cs-varian-value">${modalPerVarian[k]}</div>
          </div>
        `).join("");
      } else {
        elVarianGrid.innerHTML = `<div class="cs-varian-empty">Belum ada data</div>`;
      }
    }
    const searchVal = (searchInput?.value || "").toLowerCase();
    const tampil    = searchVal
      ? filtered.filter(item => (item.namaCustomer || "").toLowerCase().includes(searchVal))
      : filtered;

    if (!tampil.length) {
      listEl.innerHTML = `<div class="placeholder">Tidak ada customer</div>`;
      return;
    }

    listEl.innerHTML = tampil.map(item => {
      const foto  = item.foto || "https://via.placeholder.com/100";
      const nama  = item.namaCustomer || "-";
      const jarak = item.jarak != null ? `${item.jarak} km` : "-";
      const hari  = item.hari || "-";

      const badgeCatatan = item.catatan
        ? `<span class="cs-badge-catatan">✍︎</span>`
        : "";

      return `
        <div class="customer-sales-item" data-id="${item.id}" onclick="window.openCustomerSalesPopup('${item.id}')">
          <img class="customer-sales-avatar" src="${foto}">
          <div class="customer-sales-info">
            <div class="customer-sales-name">${nama} ${badgeCatatan}</div>
            <div class="customer-sales-distance">${jarak}</div>
            <div class="customer-sales-hari-badge">${hari}</div>
          </div>
          <div class="customer-sales-actions">
            <button class="customer-sales-action-btn" onclick="event.stopPropagation(); window.openCatatanSales('${item.id}', '${(item.namaCustomer||'').replace(/'/g,"\\'")}')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </button>
            <button class="customer-sales-action-btn" onclick="event.stopPropagation(); window.openMapFromCustomerSales('${item.id}')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join("");

  } catch(e) {
    console.log("customerSales error:", e);
    listEl.innerHTML = `<div class="placeholder">Gagal load customer</div>`;
  }
};

window.openMapFromCustomerSales = async function(idCustomer) {
  const idb  = await window.openAppDB();
  const data = await new Promise(resolve => {
    const tx  = idb.transaction("customerSalesDB", "readonly");
    const req = tx.objectStore("customerSalesDB").get(idCustomer);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => resolve(null);
  });
  if (!data) return;

  const loc = data.lokasiCustomer;
  if (!loc?.lat || !loc?.lng) return;

  window.openMapView();
  window._mapLockedToCustomer = true;

  const tryShow = (attempt) => {
    if (attempt > 20) return;
    setTimeout(async () => {
      if (!window._mapInstance) { tryShow(attempt + 1); return; }
      const pos = { lat: loc.lat, lng: loc.lng };
      window._mapInstance.panTo(pos);
      window._mapInstance.setZoom(17);

      setTimeout(async () => {
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        const color  = "#C9A67B";
        const pinEl  = document.createElement("div");
        pinEl.className = `map-pin-sales hari-${(data.hari || "").toLowerCase()}`;

        const marker = new AdvancedMarkerElement({
          map: window._mapInstance,
          position: pos,
          content: pinEl,
          zIndex: 998,
        });

        if (window._mapTempPin) {
          try { window._mapTempPin.map = null; } catch { }
        }
        window._mapTempPin = marker;

        const c = {
          id: idCustomer,
          namaCustomer: data.namaCustomer,
          foto: data.foto || "",
          lokasiCustomer: pos,
          hari: data.hari || "-",
          pemilik: data.createdBy
        };
        marker.addListener("gmp-click", () => window._mapShowPinInfo?.(c, pos, color, pinEl));
        window._mapShowPinInfo?.(c, pos, color, pinEl);
        setTimeout(() => { window._mapLockedToCustomer = false; }, 3000);
      }, 500);
    }, 300);
  };
  tryShow(0);
};
window.openCatatanSales = async function(idCustomer, namaCustomer) {
  const overlay   = document.getElementById("popupCatatanCustomer");
  const namaEl    = document.getElementById("popupCatatanNama");
  const updateEl  = document.getElementById("popupCatatanUpdate");
  const textEl    = document.getElementById("popupCatatanText");
  const simpanBtn = document.getElementById("btnSimpanCatatan");
  const simpanTxt = document.getElementById("btnSimpanCatatanText");
  if (!overlay) return;

  // Load catatan dari IndexedDB
  try {
    const idb  = await window.openAppDB();
    const data = await new Promise(resolve => {
      const tx  = idb.transaction("customerSalesDB", "readonly");
      const req = tx.objectStore("customerSalesDB").get(idCustomer);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => resolve(null);
    });
    if (namaEl)   namaEl.textContent   = namaCustomer || "-";
    if (textEl)   textEl.value         = data?.catatan || "";
    if (updateEl) updateEl.textContent = data?.catatanUpdatedAt
      ? "Update: " + new Date(data.catatanUpdatedAt).toLocaleDateString("id-ID", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
      : "Update: -";
  } catch {
    if (namaEl)   namaEl.textContent   = namaCustomer || "-";
    if (textEl)   textEl.value         = "";
    if (updateEl) updateEl.textContent = "Update: -";
  }

  overlay.classList.add("active");

  // Override tombol simpan
  simpanBtn.onclick = async function() {
    const catatan = textEl.value.trim();
    const now     = Date.now();
    simpanBtn.disabled  = true;
    simpanTxt.textContent = "Menyimpan...";

    try {
      const idb      = await window.openAppDB();
      const existing = await new Promise(resolve => {
        const tx  = idb.transaction("customerSalesDB", "readonly");
        const req = tx.objectStore("customerSalesDB").get(idCustomer);
        req.onsuccess = () => resolve(req.result || {});
        req.onerror   = () => resolve({});
      });

      await new Promise((resolve, reject) => {
        const tx    = idb.transaction("customerSalesDB", "readwrite");
        const store = tx.objectStore("customerSalesDB");
        store.put({ ...existing, catatan, catatanUpdatedAt: now });
        tx.oncomplete = () => resolve();
        tx.onerror    = () => reject(tx.error);
      });

      if (navigator.onLine) {
        try {
          await window.updateDoc(
            window.doc(window.db, "customerSales", idCustomer),
            { catatan, catatanUpdatedAt: now }
          );
        } catch { }
      }

      simpanTxt.textContent = "Tersimpan ✓";
      setTimeout(() => {
        overlay.classList.remove("active");
        simpanTxt.textContent = "Simpan";
        simpanBtn.disabled = false;

        // Update badge di list tanpa reload
        const itemEl = document.querySelector(`.customer-sales-item[data-id="${idCustomer}"]`);
        if (itemEl) {
          const nameEl = itemEl.querySelector(".customer-sales-name");
          if (nameEl) {
            const badgeExisting = nameEl.querySelector(".cs-badge-catatan");
            if (catatan && !badgeExisting) {
              nameEl.insertAdjacentHTML("beforeend", `<span class="cs-badge-catatan">✍︎</span>`);
            } else if (!catatan && badgeExisting) {
              badgeExisting.remove();
            }
          }
        }
      }, 800);
    } catch {
      simpanBtn.disabled    = false;
      simpanTxt.textContent = "Gagal, coba lagi";
      setTimeout(() => { simpanTxt.textContent = "Simpan"; }, 2000);
    }
  };
};
function compressFotoSales(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        const maxSize = 400;
        if (w > h) { if (w > maxSize) { h *= maxSize/w; w = maxSize; } }
        else { if (h > maxSize) { w *= maxSize/h; h = maxSize; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.3));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
window.openCustomerSalesPopup = async function(idCustomer) {
  // Kalau mode select aktif, jangan buka popup
  if (document.getElementById("csSelectCancel")) return;
  const popup     = document.getElementById("popupCustomerSales");
  const inputNama = document.getElementById("inputNamaCustomerSales");
  const inputAlamat = document.getElementById("alamatCustomerSales");
  const container = document.getElementById("dataAwalContainerSales");
  if (!popup || !inputNama || !inputAlamat || !container) return;

  try {
    const idb  = await window.openAppDB();
    const data = await new Promise(resolve => {
      const tx  = idb.transaction("customerSalesDB", "readonly");
      const req = tx.objectStore("customerSalesDB").get(idCustomer);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => resolve(null);
    });
    if (!data) return;

    window.salesEditId = idCustomer;
    inputNama.value   = data.namaCustomer || "";
    inputAlamat.value = data.alamatCustomer || "";
    // Init dropdown hari
    window._salesEditHari = data.hari || "Senin";
    const hariLabel  = document.getElementById("salesHariDropdownLabel");
    const hariList   = document.getElementById("salesHariDropdownList");
    const hariBtn    = document.getElementById("salesHariDropdownBtn");
    if (hariLabel) hariLabel.textContent = window._salesEditHari;

    // Set active
    hariList?.querySelectorAll(".sales-hari-dropdown-item").forEach(item => {
      item.classList.toggle("active", item.dataset.hari === window._salesEditHari);
      item.onclick = () => {
        window._salesEditHari = item.dataset.hari;
        if (hariLabel) hariLabel.textContent = item.dataset.hari;
        hariList.classList.remove("open");
        hariList.querySelectorAll(".sales-hari-dropdown-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
      };
    });

    hariBtn?.addEventListener("click", e => {
      e.stopPropagation();
      hariList?.classList.toggle("open");
    });

    document.addEventListener("click", e => {
      if (!e.target.closest("#salesHariDropdownWrap")) hariList?.classList.remove("open");
    });
    // Load varian
    const uid      = window.auth.currentUser.uid;
    const userData = await new Promise(resolve => {
      const tx  = idb.transaction("usersDB", "readonly");
      const req = tx.objectStore("usersDB").get(uid);
      req.onsuccess = () => resolve(req.result?.data || null);
      req.onerror   = () => resolve(null);
    });
    const varian = Array.isArray(userData?.varian) ? userData.varian : [];

    let htmlKonsinyasi = "";
    let htmlCash = "";
    varian.forEach(item => {
      const key = Object.keys(item)[0];
      if (!key) return;
      const valK = data.konsinyasi?.[key] ?? "";
      const valC = data.cash?.[key] ?? "";
      htmlKonsinyasi += `
        <div class="rolling-data-item">
          <input type="number" class="sales-input-konsinyasi rolling-data-input" data-key="${key}" value="${valK}" placeholder="${key}">
        </div>`;
      htmlCash += `
        <div class="rolling-data-item">
          <input type="number" class="sales-input-cash rolling-data-input" data-key="${key}" value="${valC}" placeholder="${key}">
        </div>`;
    });

    container.innerHTML = `
      <div class="rolling-popup-group">
        <label>Konsinyasi</label>
        <div class="rolling-data-container">${htmlKonsinyasi}</div>
      </div>
      <div class="rolling-popup-group">
        <label>Cash</label>
        <div class="rolling-data-container">${htmlCash}</div>
      </div>
    `;

    // Foto
    const fotoCard = document.getElementById("fotoCardSales");
    if (data.foto) {
      fotoCard.innerHTML = `<img src="${data.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">`;
    } else {
      fotoCard.innerHTML = "";
    }
    fotoCard.onclick = function() {
      const inputKamera = document.createElement("input");
      inputKamera.type = "file";
      inputKamera.accept = "image/*";
      inputKamera.capture = "environment";
      inputKamera.onchange = async function() {
        const file = inputKamera.files[0];
        if (!file) return;
        setTimeout(async () => {
          const url = URL.createObjectURL(file);
          fotoCard.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">`;
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          if (navigator.onLine) {
            window.salesFotoBaru = file;
          } else {
            const compressed = await compressFotoSales(file);
            window.salesFotoBaru = compressed;
          }
        }, 500);
      };
      inputKamera.click();
    };

    popup.classList.add("active");

  } catch(e) {
    console.log("openCustomerSalesPopup error:", e);
  }
};

document.getElementById("btnUpdateSales")?.addEventListener("click", async function() {
  const id = window.salesEditId;
  if (!id) return;

  try {
    const idb      = await window.openAppDB();
    const existing = await new Promise(resolve => {
      const tx  = idb.transaction("customerSalesDB", "readonly");
      const req = tx.objectStore("customerSalesDB").get(id);
      req.onsuccess = () => resolve(req.result || {});
      req.onerror   = () => resolve({});
    });

    const uid      = window.auth.currentUser.uid;
    const userData = await new Promise(resolve => {
      const tx  = idb.transaction("usersDB", "readonly");
      const req = tx.objectStore("usersDB").get(uid);
      req.onsuccess = () => resolve(req.result?.data || null);
      req.onerror   = () => resolve(null);
    });

    let varianMap = {};
    (userData?.varian || []).forEach(item => {
      const key = Object.keys(item)[0];
      if (key) varianMap[key] = item[key];
    });

    existing.namaCustomer   = document.getElementById("inputNamaCustomerSales").value || existing.namaCustomer;
    existing.alamatCustomer = document.getElementById("alamatCustomerSales").value || existing.alamatCustomer;
    existing.hari = window._salesEditHari || existing.hari;
    // Foto baru
    if (window.salesFotoBaru) {
      let compressed;
      if (typeof window.salesFotoBaru === "string") {
        compressed = window.salesFotoBaru;
      } else {
        compressed = await compressFotoSales(window.salesFotoBaru);
      }
      existing.fotoLokal = compressed;
      existing.foto      = compressed;
      window.salesFotoBaru = null;
    }

    // Konsinyasi & cash
    const konsinyasi = {};
    document.querySelectorAll(".sales-input-konsinyasi").forEach(input => {
      if (input.dataset.key && input.value !== "") konsinyasi[input.dataset.key] = Number(input.value);
    });
    const cash = {};
    document.querySelectorAll(".sales-input-cash").forEach(input => {
      if (input.dataset.key && input.value !== "") cash[input.dataset.key] = Number(input.value);
    });

    let hargaPendam = 0, hargaJual = 0, hargaPay = 0;
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
    if (Object.keys(konsinyasi).length) keterangan.modal = { hargaPendam, hargaJual };
    if (Object.keys(cash).length) keterangan.pay = { hargaPay };

    existing.konsinyasi = Object.keys(konsinyasi).length ? konsinyasi : undefined;
    existing.cash       = Object.keys(cash).length ? cash : undefined;
    existing.keterangan = keterangan;

    // Save IndexedDB
    await new Promise((resolve, reject) => {
      const tx    = idb.transaction("customerSalesDB", "readwrite");
      const store = tx.objectStore("customerSalesDB");
      store.put({ ...existing, isSync: false, isEdit: true });
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });

    // Sync Firestore jika online
    if (navigator.onLine) {
      try {
        let foto = existing.fotoLokal ? "" : (existing.foto || "");
        if (existing.fotoLokal) {
          const arr   = existing.fotoLokal.split(",");
          const mime  = arr[0].match(/:(.*?);/)[1];
          const bstr  = atob(arr[1]);
          let n       = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) u8arr[n] = bstr.charCodeAt(n);
          const blob  = new Blob([u8arr], { type: mime });
          const sRef  = window.storageRef(window.storage, `fotoCustomerSales/${id}`);
          await window.uploadBytes(sRef, blob, { contentType: "image/jpeg" });
          foto = await window.getDownloadURL(sRef);
        }

        await window.updateDoc(
          window.doc(window.db, "customerSales", id),
          {
            namaCustomer:   existing.namaCustomer,
            alamatCustomer: existing.alamatCustomer,
            hari:           existing.hari,
            foto,
            keterangan:     existing.keterangan || {},
            konsinyasi:     Object.keys(konsinyasi).length ? konsinyasi : window.deleteField(),
            cash:           Object.keys(cash).length ? cash : window.deleteField(),
          }
        );
        // Tandai sync
        await new Promise((resolve, reject) => {
          const tx    = idb.transaction("customerSalesDB", "readwrite");
          const store = tx.objectStore("customerSalesDB");
          store.put({ ...existing, foto, fotoLokal: null, isSync: true, isEdit: false });
          tx.oncomplete = () => resolve();
          tx.onerror    = () => reject(tx.error);
        });
      } catch { }
    }

    document.getElementById("popupCustomerSales").classList.remove("active");
    window.initCustomerSalesView();

  } catch(e) {
    console.log("Update sales error:", e);
  }
});
// ── LONG PRESS HAPUS ──
(function() {
  let pressTimer     = null;
  let isSelectMode   = false;
  let selectedIds    = new Set();

  function enterSelectMode(id) {
    isSelectMode = true;
    selectedIds.clear();
    selectedIds.add(id);
    renderSelectMode();
  }

  function exitSelectMode() {
    isSelectMode = false;
    selectedIds.clear();

    const header    = document.getElementById("customerSalesHeader");
    const selectBar = document.getElementById("csSelectBar");

    // Sembunyikan select bar, tampilkan konten header asli
    if (selectBar) selectBar.remove();
    if (header) {
      header.classList.remove("select-mode");
      header.querySelectorAll(":scope > *:not(#csSelectBar)").forEach(el => {
        el.style.display = "";
      });
    }

    document.getElementById("customerSalesList")?.querySelectorAll(".cs-check").forEach(c => c.remove());
    document.getElementById("customerSalesList")?.querySelectorAll(".customer-sales-item").forEach(item => {
      item.classList.remove("cs-selected");
    });
  }
  function renderSelectMode() {
    const header    = document.getElementById("customerSalesHeader");
    const listEl    = document.getElementById("customerSalesList");
    if (!header) return;
    if (isSelectMode) {
      header.classList.add("select-mode");

      // Sembunyikan konten header asli
      header.querySelectorAll(":scope > *").forEach(el => {
        el.style.display = "none";
      });

      // Inject select bar
      const bar = document.createElement("div");
      bar.id        = "csSelectBar";
      bar.className = "cs-select-header";
      bar.innerHTML = `
        <button class="cs-select-cancel" id="csSelectCancel">✕</button>
        <div class="cs-select-count" id="csSelectCount">${selectedIds.size} dipilih</div>
        <button class="cs-select-hapus" id="csSelectHapus">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
          Hapus
        </button>
      `;
      header.appendChild(bar);

      document.getElementById("csSelectCancel").onclick = exitSelectMode;
      document.getElementById("csSelectHapus").onclick  = konfirmasiHapus;

      // Update tampilan item
      listEl.querySelectorAll(".customer-sales-item").forEach(item => {
        const id = item.dataset.id;
        item.classList.toggle("cs-selected", selectedIds.has(id));
        if (!item.querySelector(".cs-check")) {
          const check = document.createElement("div");
          check.className = "cs-check";
          item.prepend(check);
        }
      });

    } else {
      const selectBar = document.getElementById("csSelectBar");
      if (selectBar) selectBar.remove();
      header.classList.remove("select-mode");
      header.querySelectorAll(":scope > *:not(#csSelectBar)").forEach(el => {
        el.style.display = "";
      });
      listEl.querySelectorAll(".cs-check").forEach(c => c.remove());
      listEl.querySelectorAll(".customer-sales-item").forEach(item => {
        item.classList.remove("cs-selected");
      });
    }

    const countEl = document.getElementById("csSelectCount");
    if (countEl) countEl.textContent = `${selectedIds.size} dipilih`;

    const hapusBtn = document.getElementById("csSelectHapus");
    if (hapusBtn) hapusBtn.disabled = selectedIds.size === 0;
  }
  function konfirmasiHapus() {
    if (!navigator.onLine) {
      const toast = document.createElement("div");
      toast.textContent = "Tidak dapat menghapus, cek koneksi internet";
      toast.style.cssText = `
        position:fixed;bottom:100px;left:50%;transform:translateX(-50%);
        background:#e53935;color:#fff;padding:10px 20px;border-radius:20px;
        font-size:13px;font-weight:600;z-index:99999;
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2500);
      return;
    }

    const existing = document.getElementById("csKonfirmasiOverlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "csKonfirmasiOverlay";
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,.5);backdrop-filter:blur(4px);
      display:flex;align-items:center;justify-content:center;
      padding:24px;
    `;
    overlay.innerHTML = `
      <div style="
        background:var(--bg-card,#fff);border-radius:20px;
        padding:24px;width:100%;max-width:340px;text-align:center;
      ">
        <div style="font-size:40px;margin-bottom:12px;">🗑️</div>
        <div style="font-size:17px;font-weight:700;color:var(--text-primary,#2d2d2d);margin-bottom:8px;">
          Hapus ${selectedIds.size} Customer?
        </div>
        <div style="font-size:13px;color:var(--text-secondary,#7a6a5a);line-height:1.5;margin-bottom:20px;">
          Data yang dihapus tidak dapat dikembalikan. Pastikan kamu sudah yakin sebelum melanjutkan.
        </div>
        <div style="display:flex;gap:10px;">
          <button id="csBatalHapus" style="
            flex:1;padding:12px;border:1.5px solid var(--border-color,#e0d6cc);
            border-radius:12px;background:none;font-size:14px;font-weight:600;
            color:var(--text-primary,#2d2d2d);cursor:pointer;
          ">Batal</button>
          <button id="csOkHapus" style="
            flex:1;padding:12px;border:none;border-radius:12px;
            background:#e53935;color:#fff;font-size:14px;font-weight:700;cursor:pointer;
          ">Ya, Hapus</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("csBatalHapus").onclick = () => overlay.remove();
    document.getElementById("csOkHapus").onclick    = () => { overlay.remove(); eksekusiHapus(); };
  }
  async function eksekusiHapus() {
    const ids    = [...selectedIds];
    const uid    = window.auth?.currentUser?.uid;
    const total  = ids.length;

    // Toast progress
    const toast = document.createElement("div");
    toast.id = "csHapusToast";
    toast.style.cssText = `
      position:fixed;bottom:100px;left:50%;transform:translateX(-50%);
      background:#333;color:#fff;padding:10px 20px;border-radius:20px;
      font-size:13px;font-weight:600;z-index:99999;white-space:nowrap;
    `;
    toast.textContent = `Menghapus 0 dari ${total}...`;
    document.body.appendChild(toast);

    try {
      // Hapus Firestore pakai batch
      const batchSize = 500;
      for (let i = 0; i < ids.length; i += batchSize) {
        const chunk = ids.slice(i, i + batchSize);
        const batch = window.writeBatch(window.db);
        chunk.forEach(id => {
          batch.delete(window.doc(window.db, "customerSales", id));
        });
        await batch.commit();
        toast.textContent = `Menghapus ${Math.min(i + batchSize, total)} dari ${total}...`;
      }

      // Hapus IndexedDB
      const idb = await window.openAppDB();
      await new Promise((resolve, reject) => {
        const tx    = idb.transaction("customerSalesDB", "readwrite");
        const store = tx.objectStore("customerSalesDB");
        ids.forEach(id => store.delete(id));
        tx.oncomplete = () => resolve();
        tx.onerror    = () => reject(tx.error);
      });

      toast.style.background = "#2eaf62";
      toast.textContent = `✓ ${total} customer berhasil dihapus`;
      setTimeout(() => toast.remove(), 2000);

      exitSelectMode();
      window.initCustomerSalesView();
    } catch(e) {
      console.log("Hapus error:", e);
      toast.style.background = "#e53935";
      toast.textContent = "Gagal menghapus, coba lagi";
      setTimeout(() => toast.remove(), 2500);
    }
  }

  // Event delegation long press
  document.addEventListener("touchstart", e => {
    const item = e.target.closest(".customer-sales-item");
    if (!item) return;
    pressTimer = setTimeout(() => {
      const id = item.dataset.id;
      if (!id) return;
      if (!isSelectMode) {
        enterSelectMode(id);
      }
    }, 600);
  }, { passive: true });
  document.addEventListener("touchend",  () => clearTimeout(pressTimer), { passive: true });
  document.addEventListener("touchmove", () => clearTimeout(pressTimer), { passive: true });
  // Tap item saat mode centang
  document.addEventListener("click", e => {
    if (!isSelectMode) return;
    const item = e.target.closest(".customer-sales-item");
    if (!item) return;
    e.stopPropagation();
    const id = item.dataset.id;
    if (!id) return;
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    item.classList.toggle("cs-selected", selectedIds.has(id));

    // Auto exit kalau semua batal dicentang
    if (selectedIds.size === 0) {
      exitSelectMode();
      return;
    }

    const countEl = document.getElementById("csSelectCount");
    if (countEl) countEl.textContent = `${selectedIds.size} dipilih`;
    const hapusBtn = document.getElementById("csSelectHapus");
    if (hapusBtn) hapusBtn.disabled = false;
  });
})();
// Swipe close
(function() {
  let startY = 0, currentY = 0, isDragging = false, canSwipe = false;
  document.addEventListener("touchstart", function(e) {
    const popup   = document.getElementById("popupCustomerSales");
    const content = document.getElementById("popupCustomerSalesContent");
    if (!popup || !content || !popup.classList.contains("active")) return;
    if (e.target.closest("input, textarea, select")) { canSwipe = false; return; }
    if (content.scrollTop > 0) { canSwipe = false; return; }
    canSwipe = true; isDragging = true;
    startY = currentY = e.touches[0].clientY;
    content.style.transition = "none";
  }, { passive: true });
  document.addEventListener("touchmove", function(e) {
    if (!isDragging || !canSwipe) return;
    const content = document.getElementById("popupCustomerSalesContent");
    if (!content) return;
    currentY = e.touches[0].clientY;
    const moveY = currentY - startY;
    if (moveY > 0) content.style.transform = `translateY(${moveY}px)`;
  }, { passive: true });
  document.addEventListener("touchend", function() {
    if (!isDragging || !canSwipe) return;
    const popup   = document.getElementById("popupCustomerSales");
    const content = document.getElementById("popupCustomerSalesContent");
    if (!content) return;
    const moveY = currentY - startY;
    content.style.transition = "0.3s ease";
    if (moveY > 120) {
      content.style.transform = "translateY(100%)";
      setTimeout(() => {
        popup.classList.remove("active");
        content.style.transform = "";
        window.salesFotoBaru = null;
      }, 250);
    } else {
      content.style.transform = "";
    }
    isDragging = false; canSwipe = false;
  });
})();