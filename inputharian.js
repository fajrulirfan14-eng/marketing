window.initInputHarianView = async function() {
  const namaInput    = document.getElementById("inputharianNama");
  const suggestList  = document.getElementById("inputharianSuggestList");
  const kemarinList  = document.getElementById("inputharianKemarinList");
  const gridEl       = document.getElementById("inputharianGrid");
  const btnSimpan    = document.getElementById("inputharianBtnSimpan");
  if (!namaInput) return;

  const uid = window.auth?.currentUser?.uid;
  if (!uid) return;

  let semuaCustomerSales = [];
  window._inputHarianSelected = null;

  // ── Ambil semua customerSales milik sales ini ──
  try {
    const snap = await window.getDocs(window.query(
      window.collection(window.db, "customerSales"),
      window.where("createdBy", "==", uid)
    ));
    semuaCustomerSales = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("❌ initInputHarianView (customerSales):", err);
  }

  // ── Pastiin globalVarian keisi (fallback IDB, sama pola kayak home.js) ──
  if (!window.globalVarian || !window.globalVarian.length) {
    try {
      const idb = await window.openAppDB();
      const entry = await new Promise(resolve => {
        const tx  = idb.transaction("usersDB", "readonly");
        const req = tx.objectStore("usersDB").get(uid);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => resolve(null);
      });
      let userData = entry?.data;
      if (!userData) {
        const snapUser = await window.getDoc(window.doc(window.db, "users", uid));
        userData = snapUser.exists() ? snapUser.data() : {};
      }
      window.globalVarian     = userData.varian || [];
      window.globalBawaBarang = userData.bawaBarang || [];
    } catch (err) {
      console.error("❌ initInputHarianView (globalVarian fallback):", err);
    }
  }

  // ── Daftar varian ──
  const varianList = Array.isArray(window.globalVarian) ? window.globalVarian : [];
  const varianAktifKeys = varianList.map(item => Object.keys(item)[0]).filter(Boolean);
  window._inputHarianVarianKeys = varianAktifKeys;

  // ── Render grid input: Return/Expired/Konsinyasi/Cash/Lainnya ──
  const tipeList = ["Return", "Expired", "Konsinyasi", "Cash", "Lainnya", "Fee", "Disable"];
  let gridHtml = "";
  tipeList.forEach(tipe => {
    const className = tipe.toLowerCase();
    gridHtml += `
      <div class="popup-group ${className}">
        <div class="popup-group-title">${tipe}</div>
        <div class="popup-group-list">
    `;
    varianAktifKeys.forEach(key => {
      gridHtml += `
        <div class="popup-input-item">
          <input type="number" min="0" placeholder="${key}" class="popup-input-number inputharian-input-number" data-tipe="${className}" data-varian="${key}">
        </div>
      `;
    });
    gridHtml += `</div></div>`;
  });
  gridEl.innerHTML = gridHtml;

  renderStokSaatIni({});

  // expose buat dipakai tombol Edit di sheet Riwayat
  window._inputHarianEls = { namaInput, gridEl, kemarinList };
  window._semuaCustomerSalesCache = semuaCustomerSales;
  window._inputHarianRenderKemarin = renderStokSaatIni;

  // ── Suggest nama customer ──
  namaInput.oninput = () => {
    const val = namaInput.value.trim().toLowerCase();
    window._inputHarianSelected = null;
    renderStokSaatIni({});

    if (!val) {
      suggestList.innerHTML = "";
      suggestList.classList.remove("active");
      return;
    }

    const matches = semuaCustomerSales
      .filter(c => (c.namaCustomer || "").toLowerCase().includes(val))
      .slice(0, 8);

    if (!matches.length) {
      suggestList.innerHTML = "";
      suggestList.classList.remove("active");
      return;
    }

    suggestList.innerHTML = matches.map(c =>
      `<div class="inputharian-suggest-item" data-id="${c.id}">${c.namaCustomer || "-"}</div>`
    ).join("");
    suggestList.classList.add("active");

    suggestList.querySelectorAll(".inputharian-suggest-item").forEach(el => {
      el.onclick = async () => {
        const cust = semuaCustomerSales.find(c => c.id === el.dataset.id);
        if (!cust) return;
        window._inputHarianSelected = cust;
        namaInput.value = cust.namaCustomer || "";
        suggestList.innerHTML = "";
        suggestList.classList.remove("active");
        renderStokSaatIni(cust.konsinyasi || {});

        // Cek udah pernah input hari ini apa belum — prefill kalau ada
        gridEl.querySelectorAll(".inputharian-input-number").forEach(i => i.value = "");
        try {
          const todayStr = new Date().toISOString().split("T")[0];
          const snapEntry = await window.getDoc(
            window.doc(window.db, "customerSales", cust.id, "inputHarian", todayStr)
          );
          if (snapEntry.exists()) {
            const entry = snapEntry.data();
            ["return", "expired", "konsinyasi", "cash", "lainnya", "fee", "disable"].forEach(tipe => {
              const tipeData = entry[tipe] || {};
              Object.keys(tipeData).forEach(varian => {
                const inputEl = gridEl.querySelector(`.inputharian-input-number[data-tipe="${tipe}"][data-varian="${varian}"]`);
                if (inputEl) {
                  const val = Number(tipeData[varian]) || 0;
                  inputEl.value = val === 0 ? "" : val;
                }
              });
            });
          }
        } catch (err) {
          console.error("❌ cek inputHarian hari ini:", err);
        }

        updateInputHarianPreview();
      };
    });
  };

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".inputharian-suggest-wrap")) {
      suggestList.classList.remove("active");
    }
  });

  function renderStokSaatIni(konsinyasi) {
    if (!kemarinList) return;
    kemarinList.innerHTML = varianAktifKeys.map(k => {
      const val = Number(konsinyasi[k]) || 0;
      return `
        <div class="popup-input-item">
          <input type="number" class="popup-input-number" placeholder="${k}" value="${val === 0 ? "" : val}" readonly disabled>
        </div>
      `;
    }).join("");
  }

  // ── Preview Total Pembayaran ──
  function updateInputHarianPreview() {
    const previewEl = document.getElementById("inputharianPreviewPay");
    if (!previewEl) return;

    const groupData = { return: {}, expired: {}, konsinyasi: {}, cash: {}, lainnya: {}, fee: {}, disable: {} };
      gridEl.querySelectorAll(".inputharian-input-number").forEach(input => {
        const tipe   = input.dataset.tipe;
        const varian = input.dataset.varian;
        groupData[tipe][varian] = Number(input.value || 0);
      });

    const varianMap = {};
    (window.globalVarian || []).forEach(item => {
      Object.keys(item).forEach(k => { varianMap[k] = item[k]; });
    });

    const dataKemarinPreview = window._inputHarianSelected?.konsinyasi || {};

    let totalPay = 0;
    const payKeys = new Set([
      ...Object.keys(dataKemarinPreview),
      ...Object.keys(groupData.return),
      ...Object.keys(groupData.expired),
      ...Object.keys(groupData.cash),
      ...Object.keys(groupData.lainnya)
    ]);
    payKeys.forEach(key => {
      const payQty =
        Number(dataKemarinPreview[key] || 0) -
        Number(groupData.return[key] || 0) -
        Number(groupData.expired[key] || 0) +
        Number(groupData.cash[key] || 0) -
        Number(groupData.lainnya[key] || 0);
      const harga = Number(varianMap[key]?.hargaKonsumen || 0);
      totalPay += payQty * harga;
    });

    previewEl.innerText = "Rp" + totalPay.toLocaleString("id-ID");
  }
  gridEl.querySelectorAll(".inputharian-input-number").forEach(input => {
    input.addEventListener("input", updateInputHarianPreview);
  });
  window._inputHarianUpdatePreview = updateInputHarianPreview;

  // ── Simpan ──
  btnSimpan.onclick = async function() {
    const namaCustomer = namaInput.value.trim();
    if (!namaCustomer) { window.showToast?.("Isi nama customer dulu", "error"); return; }

    btnSimpan.disabled  = true;
    btnSimpan.innerText = "Menyimpan...";

    try {
      const groupData = { return: {}, expired: {}, konsinyasi: {}, cash: {}, lainnya: {}, fee: {}, disable: {} };
      gridEl.querySelectorAll(".inputharian-input-number").forEach(input => {
        const tipe   = input.dataset.tipe;
        const varian = input.dataset.varian;
        groupData[tipe][varian] = Number(input.value || 0);
      });

      const cust = window._inputHarianSelected;
      const dataKemarin = cust?.konsinyasi || {};

      const closing = {};
      varianAktifKeys.forEach(k => {
        closing[k] =
          Number(groupData.konsinyasi[k] || 0) +
          Number(groupData.lainnya[k] || 0) +
          Number(groupData.fee[k] || 0) +
          Number(groupData.disable[k] || 0);
      });

      // Pay = dataKemarin - Return - Expired + Cash - Lainnya
      const pay = {};
      varianAktifKeys.forEach(k => {
        pay[k] =
          Number(dataKemarin[k] || 0) -
          Number(groupData.return[k] || 0) -
          Number(groupData.expired[k] || 0) +
          Number(groupData.cash[k] || 0) -
          Number(groupData.lainnya[k] || 0);
      });

      // Pembayaran
      const varianMap = {};
      (window.globalVarian || []).forEach(item => {
        Object.keys(item).forEach(k => { varianMap[k] = item[k]; });
      });
      let bayarKonsumen = 0, bayarProduksi = 0;
      Object.keys(pay).forEach(k => {
        bayarKonsumen += Number(pay[k] || 0) * Number(varianMap[k]?.hargaKonsumen || 0);
      });
      Object.keys(closing).forEach(k => {
        bayarProduksi += Number(closing[k] || 0) * Number(varianMap[k]?.hargaProduksi || 0);
      });

      const userData  = window.currentUser || {};
      const today     = new Date().toISOString().split("T")[0];
      const hariNama  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
      const hariIni   = hariNama[new Date().getDay()];
      const idCabang  = userData.idCabang || "";

      const inputHarianEntry = {
        namaCustomer,
        return: groupData.return,
        expired: groupData.expired,
        konsinyasi: groupData.konsinyasi,
        cash: groupData.cash,
        lainnya: groupData.lainnya,
        fee: groupData.fee,
        disable: groupData.disable,
        closing,
        pay,
        pembayaran: { bayarKonsumen, bayarProduksi },
        tanggal: today,
        idCabang,
        pemilik: uid,
        createdAt: window.serverTimestamp()
      };

      // konsinyasi di root customerSales — state terkini
      const updateRootData = {
        namaCustomer,
        konsinyasi: closing,
        idCabang,
        pemilik: uid
      };

      let customerId;
      if (cust) {
        customerId = cust.id;
        await window.setDoc(
          window.doc(window.db, "customerSales", customerId),
          updateRootData,
          { merge: true }
        );
      } else {
        customerId = crypto.randomUUID();
        await window.setDoc(
          window.doc(window.db, "customerSales", customerId),
          {
            ...updateRootData,
            idCustomer: customerId,
            hari: hariIni,
            createdBy: uid,
            createdAt: window.serverTimestamp(),
            diserahkan: false
          }
        );
      }

      // Subcollection inputHarian — riwayat per hari, docId = tanggal
      await window.setDoc(
        window.doc(window.db, "customerSales", customerId, "inputHarian", today),
        inputHarianEntry,
        { merge: true }
      );

      window.showToast?.("Data tersimpan", "success");

      // Reset form
      namaInput.value = "";
      window._inputHarianSelected = null;
      renderStokSaatIni({});
      gridEl.querySelectorAll(".inputharian-input-number").forEach(i => i.value = "");
      updateInputHarianPreview();

    } catch (err) {
      console.error("❌ simpan inputharian:", err);
      window.showToast?.("Gagal menyimpan", "error");
    } finally {
      btnSimpan.disabled  = false;
      btnSimpan.innerText = "Simpan";
    }
  };
};

// ── TAB Input / Riwayat ──
window.setInputHarianTab = function(tab) {
  const inputSection   = document.getElementById("inputharianInputSection");
  const riwayatSection = document.getElementById("inputharianRiwayatSection");
  const tabInput   = document.getElementById("inputharianTabInput");
  const tabRiwayat = document.getElementById("inputharianTabRiwayat");

  if (tab === "riwayat") {
    inputSection.style.display   = "none";
    riwayatSection.style.display = "block";
    tabInput.classList.remove("active");
    tabRiwayat.classList.add("active");

    const filterEl = document.getElementById("riwayatTanggalFilterTab");
    if (!filterEl.value) filterEl.value = new Date().toISOString().split("T")[0];
    if (!filterEl.dataset.bound) {
      filterEl.dataset.bound = "1";
      filterEl.addEventListener("change", () => loadRiwayatListTab(filterEl.value));
    }
    loadRiwayatListTab(filterEl.value);
  } else {
    inputSection.style.display   = "block";
    riwayatSection.style.display = "none";
    tabRiwayat.classList.remove("active");
    tabInput.classList.add("active");
  }
};

window._riwayatEntriesCache = [];

async function loadRiwayatHeaderCard(tanggal, entries) {
  const wrap = document.getElementById("riwayatHeaderCard");
  if (!wrap) return;

  const uid = window.auth?.currentUser?.uid;
  const varianKeys = window._inputHarianVarianKeys || [];

  // Bawa Barang — sum dari konsinyasi yang diinput (bukan laporanMarketing, itu gak dipakai sales)
  const bawaMap = {};
  varianKeys.forEach(k => { bawaMap[k] = 0; });
  entries.forEach(e => {
    const konsinyasi = e.konsinyasi || {};
    varianKeys.forEach(k => { bawaMap[k] += Number(konsinyasi[k] || 0); });
  });

  // Closing — sum dari semua entry inputHarian tanggal ini
  const closingMap = {};
  varianKeys.forEach(k => { closingMap[k] = 0; });
  entries.forEach(e => {
    const closing = e.closing || {};
    varianKeys.forEach(k => { closingMap[k] += Number(closing[k] || 0); });
  });

  // Return, Expired, Fee, Disable — sum dari semua entry
  const returnMap = {}, expiredMap = {}, feeMap = {}, disableMap = {};
  varianKeys.forEach(k => { returnMap[k] = 0; expiredMap[k] = 0; feeMap[k] = 0; disableMap[k] = 0; });
  entries.forEach(e => {
    const ret     = e.return || {};
    const expired = e.expired || {};
    const fee     = e.fee || {};
    const disable = e.disable || {};
    varianKeys.forEach(k => {
      returnMap[k]  += Number(ret[k] || 0);
      expiredMap[k] += Number(expired[k] || 0);
      feeMap[k]     += Number(fee[k] || 0);
      disableMap[k] += Number(disable[k] || 0);
    });
  });

  // Saldo = Bawa - Closing
  const saldoMap = {};
  varianKeys.forEach(k => { saldoMap[k] = Number(bawaMap[k] || 0) - closingMap[k]; });

  // Penjualan Langsung — dari users/{uid}/penjualanLangsung/{tanggal}
  const penjualanLangsungMap = {};
  varianKeys.forEach(k => { penjualanLangsungMap[k] = 0; });
  try {
    const snapPL = await window.getDoc(
      window.doc(window.db, "users", uid, "penjualanLangsung", tanggal)
    );
    if (snapPL.exists()) {
      const pl = snapPL.data()?.penjualanLangsung || {};
      varianKeys.forEach(k => { penjualanLangsungMap[k] = Number(pl[k] || 0); });
    }
  } catch (err) {
    console.error("❌ loadRiwayatHeaderCard (penjualanLangsung):", err);
  }

  // Total Jumlah Pembayaran — sum dari semua entry
  let totalBayar = 0;
  entries.forEach(e => { totalBayar += Number(e.pembayaran?.bayarKonsumen || 0); });

  function renderRow(label, map) {
    const cells = varianKeys.map(k => {
      const val = Number(map[k] || 0);
      return `
        <div class="popup-input-item">
          <input type="number" class="popup-input-number" placeholder="${k}" value="${val === 0 ? "" : val}" readonly disabled>
        </div>
      `;
    }).join("");
    return `
      <div class="popup-group">
        <div class="popup-group-title">${label}</div>
        <div class="popup-group-list">${cells}</div>
      </div>
    `;
  }

  wrap.innerHTML =
    renderRow("Bawa Barang", bawaMap) +
    `<div class="riwayat-collapse-detail" id="riwayatCollapseDetail">` +
      renderRow("Return", returnMap) +
      renderRow("Expired", expiredMap) +
      renderRow("Fee", feeMap) +
      renderRow("Disable", disableMap) +
      renderRow("Penjualan Langsung", penjualanLangsungMap) +
    `</div>` +
    renderRow("Closing", closingMap) +
    renderRow("Saldo", saldoMap) +
    `<div class="popup-preview-pay-wrapper">
      <span class="popup-preview-pay-label">Jumlah Pembayaran</span>
      <span class="popup-preview-pay">Rp${totalBayar.toLocaleString("id-ID")}</span>
    </div>
    <button class="riwayat-expand-btn" id="riwayatExpandBtn">
      <span>Selengkapnya</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>`;

  document.getElementById("riwayatExpandBtn").onclick = function() {
    const detail    = document.getElementById("riwayatCollapseDetail");
    const isOpening = !detail.classList.contains("open");
    this.classList.toggle("open", isOpening);

    if (isOpening) {
      detail.classList.add("open");
      detail.style.maxHeight = detail.scrollHeight + "px";
    } else {
      detail.style.maxHeight = detail.scrollHeight + "px";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          detail.style.maxHeight = "0px";
          detail.classList.remove("open");
        });
      });
    }
  };
}

async function loadRiwayatListTab(tanggal) {
  const listWrap = document.getElementById("riwayatListWrapTab");
  const uid = window.auth?.currentUser?.uid;
  if (!uid) return;

  listWrap.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-secondary,#8a7a68);">Memuat...</div>`;

  try {
    const snap = await window.getDocs(window.query(
      window.collectionGroup(window.db, "inputHarian"),
      window.where("pemilik", "==", uid),
      window.where("tanggal", "==", tanggal)
    ));
    const entries = snap.docs.map(d => ({
      ...d.data(),
      _custId: d.ref.parent.parent.id,
      _entryId: d.id
    }));
    window._riwayatEntriesCache = entries;

    const jumlahEl = document.getElementById("riwayatJumlahCustomer");
    if (jumlahEl) jumlahEl.textContent = entries.length;

    await loadRiwayatHeaderCard(tanggal, entries);

    if (!entries.length) {
      listWrap.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-secondary,#8a7a68);">Belum ada riwayat di tanggal ini</div>`;
      if (jumlahEl) jumlahEl.textContent = "0";
      return;
    }

    listWrap.innerHTML = entries.map((e, i) => {
      const bayar = Number(e.pembayaran?.bayarKonsumen || 0);
      return `
        <div class="riwayat-list-item" onclick="window.openDetailRiwayatSheet(${i})">
          <span class="riwayat-list-item-nama">${e.namaCustomer || "-"}</span>
          <span class="riwayat-list-item-total">Rp${bayar.toLocaleString("id-ID")}</span>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("❌ loadRiwayatListTab:", err);
    listWrap.innerHTML = `<div style="text-align:center;padding:20px;color:#c0555a;">Gagal memuat riwayat</div>`;
  }
}

window.openDetailRiwayatSheet = function(index) {
  const e = window._riwayatEntriesCache[index];
  if (!e) return;

  const existingEl = document.getElementById("riwayatDetailOverlay");
  if (existingEl) existingEl.remove();

  const bayar = Number(e.pembayaran?.bayarKonsumen || 0);
  const varianKeys = window._inputHarianVarianKeys || [];

  function renderGroup(title, obj, type) {
    const rows = varianKeys.map(key => `
      <div class="popup-input-item">
        <div class="popup-input-number popup-detail-number ${type}">${key}: ${Number(obj?.[key] || 0)}</div>
      </div>
    `).join("");
    return `
      <div class="popup-group ${type}">
        <div class="popup-group-title">${title}</div>
        <div class="popup-group-list">${rows}</div>
      </div>
    `;
  }

  const groupsHtml =
    renderGroup("Return", e.return, "return") +
    renderGroup("Expired", e.expired, "expired") +
    renderGroup("Konsinyasi", e.konsinyasi, "konsinyasi") +
    renderGroup("Cash", e.cash, "cash") +
    renderGroup("Lainnya", e.lainnya, "lainnya") +
    renderGroup("Fee", e.fee, "fee") +
    renderGroup("Disable", e.disable, "disable");

  const overlay = document.createElement("div");
  overlay.id = "riwayatDetailOverlay";
  overlay.className = "popup-overlay active";
  overlay.innerHTML = `
    <div class="popup-content popup-pl-content">
      <div class="popup-handle"></div>
      <div class="popup-group-title popup-group-title-flex" style="padding:0 0 4px;">
        <span class="popup-title" style="padding:0;">${e.namaCustomer || "-"}</span>
        <button class="popup-detail-edit-btn" id="btnEditRiwayatEntry">Edit</button>
      </div>
      <div class="popup-group">
        <div class="popup-group-title">Jumlah Pembayaran</div>
        <div class="popup-group-list">
          <div class="popup-input-item popup-payment-item">
            <div class="popup-input-number popup-detail-number payment">Rp${bayar.toLocaleString("id-ID")}</div>
          </div>
        </div>
      </div>
      ${groupsHtml}
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("btnEditRiwayatEntry").onclick = () => {
    overlay.remove();
    window.editRiwayatEntry(index);
  };

  const content = overlay.querySelector(".popup-content");
  content.style.transform  = "translateY(100%)";
  content.style.transition = "none";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      content.style.transition = "transform .25s ease";
      content.style.transform  = "translateY(0)";
    });
  });

  let startY = 0;
  content.addEventListener("touchstart", ev => {
    startY = ev.touches[0].clientY;
    content.style.transition = "none";
  }, { passive: true });
  content.addEventListener("touchmove", ev => {
    const d = ev.touches[0].clientY - startY;
    if (d > 0) content.style.transform = `translateY(${d}px)`;
  }, { passive: true });
  content.addEventListener("touchend", ev => {
    const d = ev.changedTouches[0].clientY - startY;
    content.style.transition = "transform .25s ease";
    if (d > 120) {
      content.style.transform = `translateY(100%)`;
      setTimeout(() => overlay.remove(), 250);
    } else {
      content.style.transform = "";
    }
  });
  overlay.addEventListener("click", ev => { if (ev.target === overlay) overlay.remove(); });
};

// ── EDIT DARI RIWAYAT — pindah ke tab Input, prefill data ──
window.editRiwayatEntry = function(index) {
  const e = window._riwayatEntriesCache[index];
  const els = window._inputHarianEls;
  if (!e || !els) return;

  window.setInputHarianTab("input");

  const cust = (window._semuaCustomerSalesCache || []).find(c => c.id === e._custId)
    || { id: e._custId, namaCustomer: e.namaCustomer, konsinyasi: {} };

  window._inputHarianSelected = cust;
  els.namaInput.value = e.namaCustomer || "";
  window._inputHarianRenderKemarin(cust.konsinyasi || {});

  els.gridEl.querySelectorAll(".inputharian-input-number").forEach(inp => { inp.value = ""; });
  ["return", "expired", "konsinyasi", "cash", "lainnya", "fee", "disable"].forEach(tipe => {
    const tipeData = e[tipe] || {};
    Object.keys(tipeData).forEach(varian => {
      const inputEl = els.gridEl.querySelector(`.inputharian-input-number[data-tipe="${tipe}"][data-varian="${varian}"]`);
      if (inputEl) {
        const val = Number(tipeData[varian]) || 0;
        inputEl.value = val === 0 ? "" : val;
      }
    });
  });

  window._inputHarianUpdatePreview?.();
};

// ── SHEET PENJUALAN LANGSUNG ──
window.openBottomSheetPenjualanLangsungSales = async function() {
  const existingEl = document.getElementById("penjualanLangsungSalesOverlay");
  if (existingEl) existingEl.remove();

  const uid = window.auth?.currentUser?.uid;
  if (!uid) return;

  const today = new Date().toISOString().split("T")[0];

  let existingPL = null;
  try {
    const snapPL = await window.getDoc(
      window.doc(window.db, "users", uid, "penjualanLangsung", today)
    );
    if (snapPL.exists()) existingPL = snapPL.data();
  } catch (err) {
    console.error("❌ cek penjualanLangsung hari ini:", err);
  }
  const existingQty = existingPL?.penjualanLangsung || {};

  const varianList = Array.isArray(window.globalVarian) ? window.globalVarian : [];
  const activeKeys  = varianList.map(item => Object.keys(item)[0]).filter(Boolean);
  const varianMap   = {};
  varianList.forEach(item => { Object.keys(item).forEach(k => { varianMap[k] = item[k]; }); });

  const overlay = document.createElement("div");
  overlay.id = "penjualanLangsungSalesOverlay";
  overlay.className = "popup-overlay active";

  const itemsHtml = activeKeys.map(key => {
    const val = existingQty[key];
    const displayVal = (val === 0 || val === "0" || val == null) ? "" : val;
    return `
      <div class="popup-input-item">
        <input type="number" min="0" placeholder="${key}" value="${displayVal}" class="popup-input-number pl-sales-input" data-key="${key}">
      </div>
    `;
  }).join("");

  overlay.innerHTML = `
    <div class="popup-content popup-pl-content">
      <div class="popup-handle"></div>
      <div class="popup-title">Penjualan Langsung</div>
      <div class="popup-preview-pay-wrapper">
        <span class="popup-preview-pay-label">Total</span>
        <span class="popup-preview-pay" id="previewPayPLSales">Rp0</span>
      </div>
      <div class="popup-group">
        <div class="popup-group-list">${itemsHtml}</div>
      </div>
      <button class="btn-simpan-customer" id="btnSimpanPLSales">
        <span id="btnSimpanPLSalesText">Simpan</span>
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  const contentInit = overlay.querySelector(".popup-content");
  contentInit.style.transform  = "translateY(100%)";
  contentInit.style.transition = "none";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      contentInit.style.transition = "transform .25s ease";
      contentInit.style.transform  = "translateY(0)";
    });
  });

  const content = overlay.querySelector(".popup-content");
  let startY = 0;
  content.addEventListener("touchstart", e => {
    startY = e.touches[0].clientY;
    content.style.transition = "none";
  }, { passive: true });
  content.addEventListener("touchmove", e => {
    const d = e.touches[0].clientY - startY;
    if (d > 0) content.style.transform = `translateY(${d}px)`;
  }, { passive: true });
  content.addEventListener("touchend", e => {
    const d = e.changedTouches[0].clientY - startY;
    content.style.transition = "transform .25s ease";
    if (d > 120) {
      content.style.transform = `translateY(100%)`;
      setTimeout(() => overlay.remove(), 250);
    } else {
      content.style.transform = "";
    }
  });
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

  function updatePreviewPayPLSales() {
    let total = 0;
    overlay.querySelectorAll(".pl-sales-input").forEach(input => {
      const qty   = Number(input.value || 0);
      const harga = Number(varianMap[input.dataset.key]?.hargaKonsumen || 0);
      total += qty * harga;
    });
    document.getElementById("previewPayPLSales").textContent = "Rp" + total.toLocaleString("id-ID");
  }
  overlay.querySelectorAll(".pl-sales-input").forEach(input => {
    input.addEventListener("input", updatePreviewPayPLSales);
  });
  updatePreviewPayPLSales();

  document.getElementById("btnSimpanPLSales").onclick = async function() {
    const btn     = this;
    const btnText = document.getElementById("btnSimpanPLSalesText");
    btn.disabled  = true;
    btnText.textContent = "Menyimpan...";

    try {
      const user  = window.currentUser || {};
      const today = new Date().toISOString().split("T")[0];

      const penjualanLangsung = {};
      overlay.querySelectorAll(".pl-sales-input").forEach(input => {
        penjualanLangsung[input.dataset.key] = input.value !== "" ? Number(input.value) : 0;
      });

      const pay = {};
      let bayarKonsumen = 0;
      Object.entries(penjualanLangsung).forEach(([key, qty]) => {
        if (qty > 0) {
          pay[key] = qty;
          bayarKonsumen += qty * Number(varianMap[key]?.hargaKonsumen || 0);
        }
      });

      await window.setDoc(
        window.doc(window.db, "users", uid, "penjualanLangsung", today),
        {
          uid,
          pemilik: uid,
          idCabang: user.idCabang || "",
          tanggal: today,
          penjualanLangsung,
          pay,
          pembayaran: { bayarKonsumen },
          updatedAt: window.serverTimestamp()
        },
        { merge: true }
      );

      window.showToast?.("Penjualan langsung tersimpan", "success");
      overlay.remove();

      // Refresh header card Riwayat kalau lagi kebuka & tanggalnya cocok hari ini
      const filterEl = document.getElementById("riwayatTanggalFilterTab");
      if (filterEl && filterEl.value === today) {
        loadRiwayatListTab(today);
      }

    } catch (err) {
      console.error("❌ simpan penjualanLangsung sales:", err);
      window.showToast?.("Gagal menyimpan", "error");
      btn.disabled = false;
      btnText.textContent = "Simpan";
    }
  };
};