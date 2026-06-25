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

    // Hitung modal pendam dari keterangan.modal.hargaPendam
    let totalModalPendam = 0;
    filtered.forEach(item => {
      totalModalPendam += Number(item.keterangan?.modal?.hargaPendam || 0);
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

      return `
        <div class="customer-sales-item" onclick="window.openCustomerSalesPopup('${item.id}')">
          <img class="customer-sales-avatar" src="${foto}">
          <div class="customer-sales-info">
            <div class="customer-sales-name">${nama}</div>
            <div class="customer-sales-distance">${jarak}</div>
            <div class="customer-sales-hari-badge">${hari}</div>
          </div>
          <div class="customer-sales-actions">
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

window.openCustomerSalesPopup = async function(idCustomer) {
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
        const reader = new FileReader();
        reader.onload = function(e) {
          window.salesFotoBaru = e.target.result;
          fotoCard.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">`;
        };
        reader.readAsDataURL(file);
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
      const compressed = await new Promise(resolve => {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement("canvas");
          let w = img.width, h = img.height;
          const maxSize = 600;
          if (w > h) { if (w > maxSize) { h *= maxSize/w; w = maxSize; } }
          else { if (h > maxSize) { w *= maxSize/h; h = maxSize; } }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.4));
        };
        img.src = window.salesFotoBaru;
      });
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