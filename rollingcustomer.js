
window.initRollingCustomerView = async function () {
  renderPreviewEmpty();
  renderSuggestEmpty();
};

window.rollingState = {
  hari: null,
  kurir: null,
  alasan: "",
  alasanKurir: ""
};

// ─── Helpers ────────────────────────────────────────────────

function renderPreviewEmpty() {
  const el = document.getElementById("customerPreviewCard");
  if (!el) return;
  el.innerHTML = `
    <div class="rollingcustomer-preview-empty">
      Pilih customer untuk melihat detail
    </div>
  `;
}

function renderSuggestEmpty() {
  const el = document.getElementById("customerSuggestList");
  if (!el) return;
  el.innerHTML = "";
}

// ─── Search & Select Customer ────────────────────────────
let _searchCustomerTimer = null;

window.searchCustomerRolling = async function (keyword) {
  const box = document.getElementById("customerSuggestList");
  if (!box) return;

  if (!keyword || keyword.length < 2) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = `<div class="rollingcustomer-suggest-item">Mencari...</div>`;

  clearTimeout(_searchCustomerTimer);
  _searchCustomerTimer = setTimeout(async () => {
    try {
      const user     = window.currentUser;
      const uid      = window.auth?.currentUser?.uid;
      const idCabang = user?.idCabang;
      if (!idCabang || !uid) return;

      const snap = await window.getDocs(
        window.query(
          window.collection(window.db, "customer"),
          window.where("idCabang", "==", idCabang),
          window.where("pemilik",  "==", uid),
          window.where("status",   "==", true)
        )
      );

      const kw = keyword.toLowerCase();
      const filtered = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => (c.namaCustomer || "").toLowerCase().includes(kw))
        .slice(0, 7);

      if (filtered.length === 0) {
        box.innerHTML = `<div class="rollingcustomer-suggest-item">Tidak ditemukan</div>`;
        return;
      }

      box.innerHTML = filtered.map(c => `
        <div class="rollingcustomer-suggest-item"
          onclick="selectCustomerRolling('${c.id}')">
          ${c.namaCustomer || "Tanpa Nama"}
        </div>
      `).join("");

      // Cache hasil untuk selectCustomerRolling
      window._customerSearchCache = filtered;

    } catch (err) {
      console.error("searchCustomerRolling error:", err);
      box.innerHTML = `<div class="rollingcustomer-suggest-item">Gagal mencari</div>`;
    }
  }, 400);
};

window.selectCustomerRolling = async function (id) {
  const boxPreview = document.getElementById("customerPreviewCard");
  const boxSuggest = document.getElementById("customerSuggestList");

  // Cari dari cache search dulu, fallback getDoc Firestore
  let data = (window._customerSearchCache || []).find(c => c.id === id);

  if (!data) {
    try {
      const snap = await window.getDoc(window.doc(window.db, "customer", id));
      if (!snap.exists()) return;
      data = { id: snap.id, ...snap.data() };
    } catch (err) {
      console.error("selectCustomerRolling getDoc error:", err);
      return;
    }
  }

  // Cek apakah customer ini sudah punya pengajuan pending
  try {
    const user = window.currentUser;
    const q = window.query(
      window.collection(window.db, "rolling"),
      window.where("idCabang", "==", user.idCabang),
      window.where("idCustomer", "==", String(data.idCustomer || data.id)),
      window.where("status", "==", "pending")
    );
    const snap = await window.getDocs(q);
    window.selectedCustomerHasPending = !snap.empty;
  } catch (err) {
    console.error("Cek pending error:", err);
    window.selectedCustomerHasPending = false;
  }

  // ✅ Set global state supaya submitRolling bisa akses
  window.selectedCustomerId   = data.idCustomer || data.id;
  window.selectedCustomerNama = data.namaCustomer || data.nama || "-";
  window.currentCustomerHari  = data.hari || null;

  // Owner (untuk rolling pemilik)
  window.currentCustomerOwnerId   = data.idUser   || data.ownerId   || null;
  window.currentCustomerOwnerName = data.namaUser  || data.ownerName || "-";

  // Reset state rolling setiap ganti customer
  window.rollingState = { hari: null, kurir: null, alasan: "" };

  const foto = data.foto || "https://i.imgur.com/1X5Q9Wv.png";

  boxPreview.innerHTML = `
    <div class="rc-header">
      <img class="rc-avatar" src="${foto}" onclick="openPhotoPreview('${foto}')" />
      <div class="rc-info">
        <div class="rc-name">${data.namaCustomer || data.nama || "-"}</div>
        <div class="rc-meta">ID: ${data.idCustomer || data.id || "-"}</div>
      </div>
    </div>

    <div class="rc-row">
      <div class="rc-label">Hari</div>
      <div class="rc-value">${data.hari || "-"}</div>
    </div>
    <div class="rc-row">
      <div class="rc-label">Alamat</div>
      <div class="rc-value">${data.alamatCustomer || data.alamat || "-"}</div>
    </div>

    <div class="rc-tab">
      <button class="rc-tab-btn active" onclick="openRollingTab('hari')">Rolling Hari</button>
      <button class="rc-tab-btn"        onclick="openRollingTab('pemilik')">Rolling Pemilik</button>
    </div>

    <div id="rcTabContent" class="rc-tab-content">
      <div class="rc-placeholder">Form Rolling Hari (placeholder)</div>
    </div>
  `;

  if (boxSuggest) boxSuggest.innerHTML = "";
};

// ─── Photo Preview ───────────────────────────────────────────

let zoomState = {
  scale: 1, startScale: 1, startDistance: 0,
  translateX: 0, translateY: 0,
  startX: 0, startY: 0, dragging: false
};

function getDistance(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function applyTransform() {
  const img = document.getElementById("photoPreviewImg");
  if (!img) return;
  img.style.transform = `translate(${zoomState.translateX}px, ${zoomState.translateY}px) scale(${zoomState.scale})`;
}

window.openPhotoPreview = function (src) {
  const modal = document.getElementById("photoPreviewModal");
  const img   = document.getElementById("photoPreviewImg");
  if (!modal || !img) return;
  img.src = src;
  modal.classList.add("active");
  zoomState = { scale:1, startScale:1, startDistance:0, translateX:0, translateY:0, startX:0, startY:0, dragging:false };
  applyTransform();

  // Pasang listener sekali saja lewat flag
  if (!img._zoomListenersAttached) {
    img._zoomListenersAttached = true;

    img.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        zoomState.dragging = true;
        zoomState.startX = e.touches[0].clientX - zoomState.translateX;
        zoomState.startY = e.touches[0].clientY - zoomState.translateY;
      }
      if (e.touches.length === 2) {
        zoomState.dragging = false;
        zoomState.startDistance = getDistance(e.touches[0], e.touches[1]);
        zoomState.startScale = zoomState.scale;
      }
    }, { passive: false });

    img.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && zoomState.dragging) {
        zoomState.translateX = e.touches[0].clientX - zoomState.startX;
        zoomState.translateY = e.touches[0].clientY - zoomState.startY;
      }
      if (e.touches.length === 2) {
        const newDist = getDistance(e.touches[0], e.touches[1]);
        zoomState.scale = Math.max(1, Math.min(4, zoomState.startScale * (newDist / zoomState.startDistance)));
      }
      applyTransform();
    }, { passive: false });

    img.addEventListener("touchend", () => {
      zoomState.dragging = false;
      if (zoomState.scale < 1) {
        zoomState.scale = 1;
        zoomState.translateX = 0;
        zoomState.translateY = 0;
        applyTransform();
      }
    });
  }
};

window.closePhotoPreview = function () {
  const modal = document.getElementById("photoPreviewModal");
  if (!modal) return;
  modal.classList.remove("active");
};

// ─── Tab ─────────────────────────────────────────────────────

window.openRollingTab = function (type) {
  const el = document.getElementById("rcTabContent");
  if (!el) return;

  document.querySelectorAll(".rc-tab-btn").forEach(b => b.classList.remove("active"));

  if (type === "hari") {
    document.querySelectorAll(".rc-tab-btn")[0].classList.add("active");
    el.innerHTML = `
      <div class="rc-hint">
        <div class="rc-flow"><span></span><span></span><span></span></div>
        <div class="rc-hint-text">Pilih hari tujuan perpindahan</div>
      </div>

      <div class="rc-field" onclick="toggleHariDropdown()">
        <div class="rc-field-value" id="selectedHariText">Pilih Hari</div>
        <i class="fa-solid fa-chevron-down rc-chevron"></i>
      </div>

      <div id="hariDropdown" class="rc-dropdown">
        ${["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"]
          .map(h => `<div class="rc-dropdown-item" onclick="selectHari('${h}')">${h}</div>`)
          .join("")}
      </div>

      <div class="rc-form-group">
        <textarea class="rc-textarea"
          placeholder="Alasan pengajuan"
          oninput="updateAlasanHari(this)"></textarea>
      </div>

      <button id="submitRollingHariBtn" class="rc-btn" onclick="submitRollingHari()" disabled>
        <span id="submitText">Kirim Pengajuan</span>
        <span id="submitSpinner" class="rc-spinner" style="display:none"></span>
      </button>

      ${window.selectedCustomerHasPending
        ? `<div class="rc-msg rc-msg--warn">⚠️ Customer ini masih memiliki pengajuan pending</div>`
        : `<div id="submitMsg" class="rc-msg"></div>`
      }
    `;
    // Tidak perlu setTimeout — tombol sudah disabled by default di HTML
  }

  if (type === "pemilik") {
    document.querySelectorAll(".rc-tab-btn")[1].classList.add("active");
    el.innerHTML = `
      <div class="rc-hint">
        <div class="rc-flow"><span></span><span></span><span></span></div>
        <div class="rc-hint-text">Pilih kurir pengganti customer</div>
      </div>

      <div class="rc-field" onclick="toggleKurirDropdown()">
        <div class="rc-field-value" id="selectedKurirText">Pilih Kurir</div>
        <i class="fa-solid fa-chevron-down rc-chevron"></i>
      </div>

      <div id="kurirDropdown" class="rc-dropdown"></div>

      <div class="rc-form-group">
        <textarea class="rc-textarea"
          placeholder="Alasan pengajuan"
          oninput="updateAlasanKurir(this)"></textarea>
      </div>

      <button id="submitRollingKurirBtn" class="rc-btn" onclick="submitRollingKurir()" disabled>
        <span id="submitTextKurir">Kirim Pengajuan</span>
        <span id="submitSpinnerKurir" class="rc-spinner" style="display:none"></span>
      </button>

      ${window.selectedCustomerHasPending
        ? `<div class="rc-msg rc-msg--warn">⚠️ Customer ini masih memiliki pengajuan pending</div>`
        : `<div id="submitMsgKurir" class="rc-msg"></div>`
      }
    `;
    renderKurirDropdown();
  }
};

// ─── Rolling Hari ─────────────────────────────────────────────

function validateRollingHari() {
  const btn = document.getElementById("submitRollingHariBtn");
  if (!btn) return;
  btn.disabled = window.selectedCustomerHasPending
    || !window.rollingState.hari
    || !window.rollingState.alasan.trim();
}

window.toggleHariDropdown = function () {
  document.getElementById("hariDropdown")?.classList.toggle("active");
};

window.selectHari = function (h) {
  document.getElementById("selectedHariText").innerText = h;
  document.getElementById("hariDropdown").classList.remove("active");
  window.rollingState.hari = h;
  validateRollingHari();
};

window.updateAlasanHari = function (el) {
  window.rollingState.alasan = el.value;
  validateRollingHari();
};

window.submitRollingHari = async function () {
  const btn     = document.getElementById("submitRollingHariBtn");
  const spinner = document.getElementById("submitSpinner");
  const text    = document.getElementById("submitText");
  const msg     = document.getElementById("submitMsg");

  if (window.selectedCustomerHasPending) {
    msg.innerText = "❌ Customer masih ada pengajuan pending";
    return;
  }
  if (!window.rollingState.hari) {
    msg.innerText = "❌ Pilih hari dulu";
    return;
  }

  btn.disabled          = true;
  spinner.style.display = "inline-block";
  text.innerText        = "Mengirim...";
  msg.innerText         = "";

  await new Promise(r => setTimeout(r, 2000));

  try {
    const user = window.currentUser;
    await window.addDoc(window.collection(window.db, "rolling"), {
      type      : "hari",
      status    : "pending",
      createdAt : window.serverTimestamp(),
      idCabang  : user.idCabang,
      idCustomer  : window.selectedCustomerId,
      namaCustomer: window.selectedCustomerNama,
      from: {
        hari       : window.currentCustomerHari,
        idCustomer : window.selectedCustomerId,
        namaCustomer: window.selectedCustomerNama,
        idCabang   : user.idCabang
      },
      to  : { hari: window.rollingState.hari },
      requestedBy: { uid: user.uid, nama: user.nama },
      alasan     : window.rollingState.alasan || "",
      approvedBy : null,
      approvedAt : null
    });
    msg.innerText          = "✅ Pengajuan berhasil dikirim";
    window.rollingState.hari   = null;
    window.rollingState.alasan = "";
  } catch (err) {
    console.error(err);
    msg.innerText = "❌ Gagal mengirim";
  }

  spinner.style.display = "none";
  text.innerText        = "Kirim Pengajuan";
  btn.disabled          = false;
};

// ─── Rolling Kurir / Pemilik ──────────────────────────────────

function validateRollingKurir() {
  const btn = document.getElementById("submitRollingKurirBtn");
  if (!btn) return;
  btn.disabled = window.selectedCustomerHasPending
    || !window.rollingState.kurir
    || !window.rollingState.alasanKurir?.trim();
}

window.updateAlasanKurir = function (el) {
  window.rollingState.alasanKurir = el.value;
  validateRollingKurir();
};

function renderKurirDropdown() {
  const el = document.getElementById("kurirDropdown");
  if (!el) return;
  const users = window.globalUsersCache || [];
  el.innerHTML = users.length === 0
    ? `<div class="rc-dropdown-item">Tidak ada kurir</div>`
    : users.map(u => `
        <div class="rc-dropdown-item"
          onclick="selectKurir('${u.id}', '${(u.nama || "-").replace(/'/g, "\\'")}')">
          ${u.nama || "Tanpa Nama"}
        </div>
      `).join("");
}

window.toggleKurirDropdown = async function () {
  const el = document.getElementById("kurirDropdown");
  if (!el) return;
  el.classList.toggle("active");
  if (!window.globalUsersCache || window.globalUsersCache.length === 0) {
    el.innerHTML = `<div class="rc-dropdown-item">Loading kurir...</div>`;
    await window.fetchUsersByCabang();
    renderKurirDropdown();
  }
};

window.selectKurir = function (id, nama) {
  window.rollingState.kurir = { id, nama };
  document.getElementById("selectedKurirText").innerText = nama;
  document.getElementById("kurirDropdown").classList.remove("active");
  validateRollingKurir();
};

window.submitRollingKurir = async function () {
  const btn     = document.getElementById("submitRollingKurirBtn"); // ✅ pakai ID
  const spinner = document.getElementById("submitSpinnerKurir");
  const text    = document.getElementById("submitTextKurir");
  const msg     = document.getElementById("submitMsgKurir");

  if (window.selectedCustomerHasPending) {
    msg.innerText = "❌ Customer masih ada pengajuan pending";
    return;
  }
  if (!window.rollingState.kurir) {
    msg.innerText = "❌ Pilih kurir dulu";
    return;
  }

  btn.disabled          = true;
  spinner.style.display = "inline-block";
  text.innerText        = "Mengirim...";
  msg.innerText         = "";

  await new Promise(r => setTimeout(r, 2000));

  try {
    const user = window.currentUser;
    await window.addDoc(window.collection(window.db, "rolling"), {
      type      : "pemilik",
      status    : "pending",
      createdAt : window.serverTimestamp(),
      idCabang  : user.idCabang,
      idCustomer  : window.selectedCustomerId,
      namaCustomer: window.selectedCustomerNama,
      from: {
        idUser      : window.currentCustomerOwnerId,
        namaUser    : window.currentCustomerOwnerName,
        idCustomer  : window.selectedCustomerId,
        namaCustomer: window.selectedCustomerNama,
        idCabang    : user.idCabang
      },
      to: {
        idUser  : window.rollingState.kurir.id,
        namaUser: window.rollingState.kurir.nama
      },
      requestedBy: { uid: user.uid, nama: user.nama },
      alasan     : window.rollingState.alasanKurir || "",
      approvedBy : null,
      approvedAt : null
    });
    msg.innerText              = "✅ Pengajuan berhasil dikirim";
    window.rollingState.kurir      = null;
    window.rollingState.alasanKurir = "";
  } catch (err) {
    console.error(err);
    msg.innerText = "❌ Gagal mengirim";
  }

  spinner.style.display = "none";
  text.innerText        = "Kirim Pengajuan";
  btn.disabled          = false;
};

window.openRiwayatBar = async function () {
  document.getElementById("riwayatBar").classList.add("active");
  document.getElementById("riwayatOverlay").classList.add("active");
  await loadRiwayat();
};

window.closeRiwayatBar = function () {
  document.getElementById("riwayatBar").classList.remove("active");
  document.getElementById("riwayatOverlay").classList.remove("active");
};

async function loadRiwayat() {
  const el = document.getElementById("riwayatBarContent");
  if (!el) return;
  el.innerHTML = `<div class="riwayat-loading">Memuat...</div>`;

  try {
    const user = window.currentUser;
    const q = window.query(
      window.collection(window.db, "rolling"),
      window.where("idCabang", "==", user.idCabang),
      window.where("requestedBy.uid", "==", user.uid),
      window.orderBy("createdAt", "desc"),
      window.limit(30)
    );
    const snap = await window.getDocs(q);

    if (snap.empty) {
      el.innerHTML = `<div class="riwayat-empty">Belum ada riwayat pengajuan</div>`;
      return;
    }

    el.innerHTML = snap.docs.map(doc => {
      const d = doc.data();
      const status = d.status || "pending";

      const statusLabel = {
        pending  : "⏳ Pending",
        approved : "✅ Disetujui",
        rejected : "❌ Ditolak"
      }[status] || status;

      const typeLabel = d.type === "hari" ? "Rolling Hari" : "Rolling Pemilik";

      const detail = d.type === "hari"
        ? `${d.from?.hari || "-"} → ${d.to?.hari || "-"}`
        : `${d.from?.namaUser || "-"} → ${d.to?.namaUser || "-"}`;

      const tanggal = d.createdAt?.toDate
        ? d.createdAt.toDate().toLocaleDateString("id-ID", {
            day:"2-digit", month:"short", year:"numeric",
            hour:"2-digit", minute:"2-digit"
          })
        : "-";

      return `
        <div class="riwayat-card ${status}">
          <div class="riwayat-card-top">
            <div class="riwayat-card-nama">${d.namaCustomer || "-"}</div>
            <div class="riwayat-status-badge">${statusLabel}</div>
          </div>
          <div class="riwayat-card-type">${typeLabel}</div>
          <div class="riwayat-card-detail">${detail}</div>
          ${d.alasan ? `<div class="riwayat-card-alasan">"${d.alasan}"</div>` : ""}
          <div class="riwayat-card-date">${tanggal}</div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("loadRiwayat error:", err);
    el.innerHTML = `<div class="riwayat-empty">Gagal memuat riwayat</div>`;
  }
}
