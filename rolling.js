window.rollingTabAktif    = "aktif";
window.rollingFilterBulan = new Date().getMonth() + 1;
window.rollingFilterTahun = new Date().getFullYear();
// ── FETCH SEMUA DATA MILIK HUNTER INI (langsung Firestore, gak ada cache) ──
async function getRollingBulanData() {
  const uid = window.auth?.currentUser?.uid;
  if (!uid) return [];

  let docs = [];
  try {
    const q = window.query(
      window.collection(window.db, "users", uid, "customerBaruHunter"),
      window.where("createdBy", "==", uid)
    );
    const snapshot = await window.getDocs(q);
    snapshot.forEach(d => {
      const data = d.data();
      docs.push({
        ...data,
        id: d.id,
        lokasiCustomer: window.normalizeGeoPoint?.(data.lokasiCustomer) || data.lokasiCustomer
      });
    });
  } catch (err) {
    console.error("❌ getRollingBulanData:", err);
  }

  return docs;
}

window.setRollingTab = function(tab) {
  window.rollingTabAktif = tab;
  document.getElementById("rollingTabAktif")?.classList.toggle("active", tab === "aktif");
  document.getElementById("rollingTabHistory")?.classList.toggle("active", tab === "history");
  window.initRollingView();
};

window.initRollingView = async function () {
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
    window.rollingFilterHari = hariHariIni;
  }

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

  // Init filter bulan & tahun
  const now = new Date();
  const selectBulan = document.getElementById("rollingFilterBulan");
  const selectTahun = document.getElementById("rollingFilterTahun");

  if (selectTahun && !selectTahun.options.length) {
    const tahunIni = now.getFullYear();
    for (let y = tahunIni; y >= tahunIni - 3; y--) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      selectTahun.appendChild(opt);
    }
  }

  if (selectBulan) selectBulan.value = window.rollingFilterBulan;
  if (selectTahun) selectTahun.value = window.rollingFilterTahun;

  if (selectBulan) {
    selectBulan.onchange = function() {
      window.rollingFilterBulan = Number(this.value);
      localStorage.setItem("rollingFilterBulan", this.value);
      window.initRollingView();
    };
  }
  if (selectTahun) {
    selectTahun.onchange = function() {
      window.rollingFilterTahun = Number(this.value);
      localStorage.setItem("rollingFilterTahun", this.value);
      window.initRollingView();
    };
  }

  try {
    const data = await getRollingBulanData();

    let filtered;
    if (window.rollingTabAktif === "history") {
      if (window.rollingFilterHari === "Semua" || window.rollingFilterHari === "CustomerBaru") {
        filtered = data.filter(item => item.diserahkan === true);
      } else {
        filtered = data.filter(item =>
          item.diserahkan === true &&
          item.hari === window.rollingFilterHari
        );
      }
    } else {
      if (window.rollingFilterHari === "Semua" || window.rollingFilterHari === "CustomerBaru") {
        filtered = data.filter(item => item.diserahkan !== true);
      } else {
        filtered = data.filter(item =>
          item.diserahkan !== true &&
          item.hari === window.rollingFilterHari
        );
      }
    }

    // Update jumlah customer
    const elJumlah = document.getElementById("rollingJumlahCustomer");
    if (elJumlah) elJumlah.textContent = filtered.length;

    // Penghasilan — semua dokumen bulan ini (aktif & history)
    let upahHunter = 0;
    try {
      upahHunter = Number(window.globalKantor?.upahHunter || 0);
    } catch { }
    const totalPenghasilan = data.length * upahHunter;
    const elPenghasilan = document.getElementById("rollingPenghasilan");
    if (elPenghasilan) elPenghasilan.textContent = "Rp " + totalPenghasilan.toLocaleString("id-ID");

    // Search filter
    const searchVal = (document.getElementById("rollingSearchInput")?.value || "").toLowerCase();
    const tampil = searchVal
      ? filtered.filter(item => (item.namaCustomer || "").toLowerCase().includes(searchVal))
      : filtered;

    if (!tampil.length) {
      customerList.innerHTML = `<div class="placeholder">Tidak ada customer</div>`;
      return;
    }

    customerList.innerHTML = tampil.map(item => {
      const foto = item.foto || "https://via.placeholder.com/100";
      const nama = item.namaCustomer || "-";
      const jarak = item.jarak != null ? `${item.jarak} km` : "-";
      const hari = item.hari || "-";
      const badgeCatatan = item.catatan ? `<span class="rolling-badge-catatan">𓂃✍︎</span>` : "";
      const badgeKonsinyasi = Object.keys(item.konsinyasi || {}).length
        ? Object.entries(item.konsinyasi).map(([k, v]) =>
            `<span class="rolling-badge rolling-badge-konsinyasi">${k}: ${v}</span>`
          ).join("")
        : "";
      const badgeCash = Object.keys(item.cash || {}).length
        ? Object.entries(item.cash).map(([k, v]) =>
            `<span class="rolling-badge rolling-badge-cash">${k}: ${v}</span>`
          ).join("")
        : "";
      return `
        <div class="rolling-customer-item" onclick="openRollingCustomerPopup('${item.id}')">
          <img class="rolling-avatar" src="${foto}" />
          <div class="rolling-info">
            <div class="rolling-name">${nama} ${badgeCatatan} ${badgeKonsinyasi} ${badgeCash}</div>
            <div class="rolling-distance">${jarak}</div>
            <div class="rolling-hari">${hari}</div>
          </div>
          <div class="rolling-actions">
            <button class="rolling-action-btn" onclick="event.stopPropagation(); window.openMapFromCustomerBaru('${item.id}')">
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
    console.error("❌ Rolling view error:", err);
    customerList.innerHTML = `<div class="placeholder">Gagal load customer</div>`;
  }
};

window.openRollingCustomerPopup = async function (idCustomer) {
  const popup = document.getElementById("popupRollingCustomer");
  const inputNama = document.getElementById("inputNamaCustomerRolling");
  const inputAlamat = document.getElementById("alamatCustomerRolling");
  const container = document.getElementById("dataAwalContainerRolling");

  if (!popup || !inputNama || !inputAlamat || !container) return;

  try {
    const data = (await getRollingBulanData()).find(c => c.id === idCustomer);
    if (!data) return;

    window.rollingEditId = idCustomer;
    inputNama.value = data.namaCustomer || "";
    inputAlamat.value = data.alamatCustomer || "";

    const varian = Array.isArray(window.globalVarian) ? window.globalVarian : [];

    let htmlKonsinyasi = "";
    let htmlCash = "";
    varian.forEach(item => {
      const key = Object.keys(item)[0];
      if (!key) return;
      const valK = data.konsinyasi?.[key] ?? "";
      const valC = data.cash?.[key] ?? "";
      htmlKonsinyasi += `
        <div class="rolling-data-item">
          <input type="number" class="rolling-input-konsinyasi rolling-data-input" data-key="${key}" value="${valK}" placeholder="${key}">
        </div>
      `;
      htmlCash += `
        <div class="rolling-data-item">
          <input type="number" class="rolling-input-cash rolling-data-input" data-key="${key}" value="${valC}" placeholder="${key}">
        </div>
      `;
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

    const fotoCard = document.getElementById("fotoCardRolling");
    if (data.foto) {
      fotoCard.innerHTML = `<img src="${data.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">`;
    } else {
      fotoCard.innerHTML = "";
    }

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
          window.rollingFotoBaru = base64;
          fotoCard.innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">`;
        };
        reader.readAsDataURL(file);
      };

      inputKamera.click();
    };

    window._rollingEditLat   = null;
    window._rollingEditLng   = null;
    window._rollingEditJarak = null;

    popup.classList.add("active");

  } catch (err) {
    console.error("❌ Rolling popup error:", err);
  }
};

document.getElementById("btnUpdateRolling")?.addEventListener("click", async function () {
  const id = window.rollingEditId;
  if (!id) return;

  try {
    const uid = window.auth.currentUser.uid;
    const cacheArr = await getRollingBulanData();
    const existing = cacheArr.find(c => c.id === id) || {};

    const varianMap = {};
    (window.globalVarian || []).forEach(item => {
      const key = Object.keys(item)[0];
      if (key) varianMap[key] = item[key];
    });

    const namaCustomer   = document.getElementById("inputNamaCustomerRolling").value || existing.namaCustomer;
    const alamatCustomer = document.getElementById("alamatCustomerRolling").value || existing.alamatCustomer;

    let fotoUrl = existing.foto || "";
    if (window.rollingFotoBaru) {
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
          resolve(canvas.toDataURL("image/jpeg", 0.6));
        };
        img.src = window.rollingFotoBaru;
      });

      try {
        const arr   = compressed.split(",");
        const mime  = arr[0].match(/:(.*?);/)[1];
        const bstr  = atob(arr[1]);
        let n       = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        const blob  = new Blob([u8arr], { type: mime });
        const sRef  = window.storageRef(window.storage, `fotoCustomer/${id}`);
        await window.uploadBytes(sRef, blob, { contentType: "image/jpeg" });
        fotoUrl = await window.getDownloadURL(sRef);
      } catch (err) {
        console.error("❌ upload foto rolling:", err);
      }
      window.rollingFotoBaru = null;
    }

    const konsinyasi = {};
    document.querySelectorAll(".rolling-input-konsinyasi").forEach(input => {
      if (input.dataset.key && input.value !== "") konsinyasi[input.dataset.key] = Number(input.value);
    });
    const cash = {};
    document.querySelectorAll(".rolling-input-cash").forEach(input => {
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

    const updatePayload = {
      namaCustomer,
      alamatCustomer,
      foto: fotoUrl,
      keterangan,
      konsinyasi: Object.keys(konsinyasi).length ? konsinyasi : window.deleteField(),
      cash:       Object.keys(cash).length ? cash : window.deleteField(),
    };

    const docRef = window.doc(window.db, "users", uid, "customerBaruHunter", id);
    await window.updateDoc(docRef, updatePayload);

    const idx = cacheArr.findIndex(c => c.id === id);
    if (idx > -1) {
      const updated = { ...cacheArr[idx], namaCustomer, alamatCustomer, foto: fotoUrl, keterangan };
      if (Object.keys(konsinyasi).length) updated.konsinyasi = konsinyasi; else delete updated.konsinyasi;
      if (Object.keys(cash).length) updated.cash = cash; else delete updated.cash;
      cacheArr[idx] = updated;
    }

    document.getElementById("popupRollingCustomer").classList.remove("active");
    window.initRollingView();

  } catch (err) {
    console.error("❌ Gagal update:", err);
  }
});

window.openCatatanPopup = async function(idCustomer) {
  try {
    const data = (await getRollingBulanData()).find(c => c.id === idCustomer);
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
    console.error("❌ Gagal buka catatan:", err);
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

    const uid = window.auth.currentUser.uid;
    const docRef = window.doc(window.db, "users", uid, "customerBaruHunter", id);
    await window.updateDoc(docRef, { catatan, catatanUpdatedAt: now });
    
    btnText.textContent = "Tersimpan ✓";
    setTimeout(() => {
      document.getElementById("popupCatatanCustomer").classList.remove("active");
      btnText.textContent = "Simpan";
    }, 800);

  } catch(err) {
    console.error("❌ Gagal simpan catatan:", err);
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

    if (e.target.closest("input, textarea, select")) {
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
