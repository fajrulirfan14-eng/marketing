function formatRupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0
  }).format(n);
}

function getBulan(n) {
  return ["Januari","Februari","Maret","April","Mei","Juni",
          "Juli","Agustus","September","Oktober","November","Desember"][n - 1];
}

function getBulanSebelumnya() {
  const now   = new Date();
  let bulan   = now.getMonth(); // 0-based = bulan sebelumnya
  let tahun   = now.getFullYear();
  if (bulan === 0) { bulan = 12; tahun -= 1; }
  const mm = String(bulan).padStart(2, "0");
  return {
    label : `${getBulan(bulan)} ${tahun}`,
    key   : `${tahun}-${mm}`,
    bulan,
    tahun
  };
}

// ── State filter ──
const _slipFilter = { bulan: 0, tahun: 0 };

// ── Custom dropdown builder ──
function buildCustomSelect({ triggerId, title, items, selectedValue, onSelect }) {
  const trigger = document.getElementById(triggerId);
  if (!trigger) return;

  // Pakai elemen berikutnya (sudah ada di HTML)
  const btn = trigger.nextElementSibling;
  if (!btn) return;
  btn.style.display = "flex";

  // Set label awal
  function setLabel(val) {
    const found = items.find(i => String(i.value) === String(val));
    const lbl   = btn.querySelector(".slip-custom-select-label");
    if (found && found.value !== "") {
      lbl.textContent = found.label;
      lbl.classList.remove("placeholder");
    } else {
      lbl.textContent = items[0]?.label || "Pilih...";
      lbl.classList.add("placeholder");
    }
  }
  setLabel(selectedValue);

  // Buat / reuse overlay + popup
  let overlay = document.getElementById("slipDropOverlay");
  let popup   = document.getElementById("slipDropPopup");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id        = "slipDropOverlay";
    overlay.className = "slip-dropdown-overlay";
    document.body.appendChild(overlay);
  }
  if (!popup) {
    popup = document.createElement("div");
    popup.id        = "slipDropPopup";
    popup.className = "slip-dropdown-popup";
    document.body.appendChild(popup);
  }

  function openPopup() {
    // Render isi popup
    popup.innerHTML = `
      <div class="slip-dropdown-handle"></div>
      <div class="slip-dropdown-header">
        <span class="slip-dropdown-title">${title}</span>
        <button class="slip-dropdown-close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="slip-dropdown-list">
        ${items.map(it => `
          <div class="slip-dropdown-item ${String(it.value) === String(selectedValue) ? "selected" : ""} ${it.muted ? "slip-dropdown-item--muted" : ""}"
               data-value="${it.value}">
            ${it.label}
          </div>
        `).join("")}
      </div>
    `;

    overlay.classList.add("active");
    popup.classList.add("active");
    btn.classList.add("open");

      // Close
    const close = () => {
      overlay.classList.remove("active");
      popup.classList.remove("active");
      btn.classList.remove("open");
    };
    overlay.onclick = close;
    popup.querySelector(".slip-dropdown-close").onclick = close;
  
    // Swipe down to close
    let touchStartY = 0;
    popup.addEventListener("touchstart", e => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    popup.addEventListener("touchmove", e => {
      const delta = e.touches[0].clientY - touchStartY;
      if (delta > 0) popup.style.transform = `translateY(${delta}px)`;
    }, { passive: true });
    popup.addEventListener("touchend", e => {
      const delta = e.changedTouches[0].clientY - touchStartY;
      popup.style.transform = "";
      if (delta > 80) close();
    }, { passive: true });

    // Pilih item
    popup.querySelectorAll(".slip-dropdown-item").forEach(el => {
      el.addEventListener("click", () => {
        const val = el.dataset.value;
        selectedValue = val;
        setLabel(val);
        onSelect(val);
        close();
      });
    });
  }

  btn.onclick = openPopup;
}

window.initSlipView = function () {
  const target = getBulanSebelumnya();
  const thn    = new Date().getFullYear();

  _slipFilter.bulan = target.bulan;
  _slipFilter.tahun = target.tahun;

  // Custom select bulan
  buildCustomSelect({
    triggerId     : "filterBulan",
    title         : "Pilih Bulan",
    items         : [
      { value: "", label: "Semua Bulan", muted: true },
      ...Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: getBulan(i + 1)
      }))
    ],
    selectedValue : target.bulan,
    onSelect      : (val) => {
      _slipFilter.bulan = Number(val);
      onFilterChange();
    }
  });

  // Custom select tahun
  const startTahun = 2025;
  const endTahun   = 2030;
  buildCustomSelect({
    triggerId     : "filterTahun",
    title         : "Pilih Tahun",
    items         : [
      { value: "", label: "Semua Tahun", muted: true },
      ...Array.from({ length: endTahun - startTahun + 1 }, (_, i) => ({
        value: startTahun + i,
        label: String(startTahun + i)
      }))
    ],
    selectedValue : target.tahun,
    onSelect      : (val) => {
      _slipFilter.tahun = Number(val);
      onFilterChange();
    }
  });

  renderSlipCard(target);
};

function onFilterChange() {
  const bulan = _slipFilter.bulan;
  const tahun = _slipFilter.tahun;

  if (!bulan || !tahun) {
    renderSlipCard(null);
    return;
  }

  const mm = String(bulan).padStart(2, "0");
  renderSlipCard({
    label : `${getBulan(bulan)} ${tahun}`,
    key   : `${tahun}-${mm}`,
    bulan,
    tahun
  });
}

/* ─── RENDER CARD ───────────────────────────────────── */
function renderSlipCard(target) {
  const container = document.getElementById("slipList");
  if (!container) return;

  if (!target) {
    container.innerHTML = `<div class="slip-empty">Pilih bulan dan tahun</div>`;
    return;
  }

  container.innerHTML = `
    <div class="slip-card">
      <div class="slip-card-label">Penerimaan Bulan</div>
      <div class="slip-card-periode">${target.label}</div>
      <div class="slip-card-nominal" id="slipNominal">...</div>
      <button class="slip-btn" id="btnLihatSlip" onclick="fetchSlipGaji('${target.key}')">
        Lihat Slip Gaji
      </button>
      <div id="slipMsg" class="slip-msg"></div>
      <div id="slipDetailContainer"></div>
    </div>
  `;
}

const _slipCache = {};
window.fetchSlipGaji = async function (periodeKey) {
  const btn       = document.getElementById("btnLihatSlip");
  const msg       = document.getElementById("slipMsg");
  const nominalEl = document.getElementById("slipNominal");
  if (btn) {
    btn.disabled   = true;
    btn.innerHTML  = `<span class="slip-spinner"></span> Memuat...`;
  }

  if (msg) msg.innerText = "";

  // Delay 2 detik untuk spinner
  await new Promise(r => setTimeout(r, 2000));

  try {

    // ── CEK RAM DULU ──────────────────────────────────
    if (_slipCache[periodeKey]) {
      console.log("Slip dari cache RAM:", periodeKey);
      const cached = _slipCache[periodeKey];
      if (nominalEl) nominalEl.innerText = formatRupiah(cached.totalPenerimaan);
      await renderSlipDetail(cached);
      return;
    }

    // ── TIDAK ADA DI RAM → FETCH FIRESTORE ───────────
    const uid = window.auth?.currentUser?.uid;

    if (!uid) {
      throw new Error("User belum login");
    }

    const ref = window.doc(
      window.db,
      "users",
      uid,
      "slipGaji",
      periodeKey
    );

    const snap = await window.getDoc(ref);
    console.log("=== DEBUG SLIP GAJI ===");
    console.log("UID:", uid);
    console.log("Periode Key:", periodeKey);
    console.log("Doc Exists:", snap.exists());

    if (snap.exists()) {
      console.log("DATA SLIP GAJI:", snap.data());
    } else {
      console.log("SLIP GAJI TIDAK DITEMUKAN DI PATH:");
      console.log(`users/${uid}/slipGaji/${periodeKey}`);
    }

    if (!snap.exists()) {

      if (nominalEl) {
        nominalEl.innerText = formatRupiah(0);
      }

      if (msg) {
        msg.innerText = "Slip gaji belum tersedia";
      }

      return;
    }

    const raw = snap.data();

    const [tahun, bulan] = periodeKey.split("-").map(Number);

    const item = {
      id                 : snap.id,
      periode            : periodeKey,
      bulan,
      tahun,

      idUser             : raw.idUser || "",
      idCabang           : raw.idCabang || "",
      createdBy          : raw.createdBy || "",
      catatan            : raw.catatan || "",

      createdAt          : raw.createdAt || null,

      totalPenerimaan    : raw.totalPenerimaan || 0,

      pendapatan         : raw.slipGaji?.[0]?.pendapatan || {},
      bonus              : raw.slipGaji?.[1]?.bonus      || {},
      potongan           : raw.slipGaji?.[2]?.potongan   || {},
      informasiKehadiran : raw.informasiKehadiran        || []
    };

    // ── SIMPAN KE RAM ─────────────────────────────────
    _slipCache[periodeKey] = item;
    console.log("Slip disimpan ke cache RAM:", periodeKey);

    const idb = await window.openAppDB();

    const tx = idb.transaction(
      "slipGajiDB",
      "readwrite"
    );

    tx.objectStore("slipGajiDB").put(item);

    if (nominalEl) {
      nominalEl.innerText = formatRupiah(item.totalPenerimaan);
    }

    await renderSlipDetail(item);

  } catch (err) {

    console.error(
      "fetchSlipGaji:",
      err?.code,
      err?.message
    );

    if (msg) {
      msg.innerText = err?.message || "Gagal memuat slip";
    }

  } finally {

    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = "Lihat Slip Gaji";
    }

  }
};

async function renderSlipDetail(d) {

  const container = document.getElementById("slipDetailContainer");
  if (!container) return;

  const idb = await window.openAppDB();

  // Baca kantorDB
  const kantorData = await new Promise(resolve => {
    try {
      const tx  = idb.transaction("kantorDB", "readonly");
      const req = tx.objectStore("kantorDB").getAll();
      req.onsuccess = () => {
        const raw = req.result?.[0] || {};
        resolve(raw.data || raw);
      };
      req.onerror = () => resolve({});
    } catch { resolve({}); }
  });

  const userData = window.currentUser || {};

  function renderSection(title, obj) {

    if (!obj || typeof obj !== "object" || Object.keys(obj).length === 0) {
      return "";
    }

    let totalPembayaran = 0;

    const rows = Object.entries(obj).map(([key, val]) => {

      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, s => s.toUpperCase());

      const hari       = val?.hari       || 0;
      const pembayaran = val?.pembayaran || 0;

      totalPembayaran += pembayaran;

      return `
        <div class="slip-section-row">
          <span class="slip-col-kiri">${label}</span>
          <span class="slip-col-tengah">${hari} Hari</span>
          <span class="slip-col-kanan">${formatRupiah(pembayaran)}</span>
        </div>
      `;

    }).join("");

    return `
      <div class="slip-detail-section">

        <div class="slip-section-title">${title}</div>

        <div class="slip-section-header">
          <span class="slip-col-kiri">Keterangan</span>
          <span class="slip-col-tengah">Hari</span>
          <span class="slip-col-kanan">Pembayaran</span>
        </div>

        ${rows}

        <div class="slip-section-total">
          <span class="slip-col-kiri">Total ${title}</span>
          <span class="slip-col-tengah"></span>
          <span class="slip-col-kanan">${formatRupiah(totalPembayaran)}</span>
        </div>

      </div>
    `;
  }

  container.innerHTML = `
    <div class="slip-detail-card">

      <!-- HEADER -->
      <div class="slip-detail-header-card">

        <div class="slip-detail-company">
          <img src="logoTTN.png" class="slip-detail-logo" alt="Logo">
          <div class="slip-detail-company-info">
            <div class="slip-detail-company-name">${kantorData.namaPt || "-"}</div>
            <div class="slip-detail-company-address">${kantorData.alamatCabang || "-"}</div>
          </div>
        </div>

        <div class="slip-detail-divider"></div>

        <div class="slip-detail-employee">
          <div class="slip-detail-info-row">
            <span>Nama</span>
            <strong>${userData.nama || "-"}</strong>
          </div>
          <div class="slip-detail-info-row">
            <span>NIK</span>
            <strong>${userData.nik || "-"}</strong>
          </div>
          <div class="slip-detail-info-row">
            <span>Divisi</span>
            <strong>${userData.role || "-"}</strong>
          </div>
          <div class="slip-detail-info-row">
            <span>Periode Gaji</span>
            <strong>${getBulan(d.bulan)} ${d.tahun}</strong>
          </div>
        </div>

      

        <!-- BODY -->
        <div class="slip-detail-body">
  
          ${renderSection("Pendapatan", d.pendapatan)}
  
          ${renderSection("Bonus", d.bonus)}
  
          ${renderSection("Potongan", d.potongan)}
  
          <div class="slip-detail-total">
            <span>Total Penerimaan Bulan Ini</span>
            <strong>
              ${formatRupiah(
                d.totalPenerimaan || 0
              )}
            </strong>
          </div>
  
          <div class="slip-detail-catatan">
            ${d.catatan || "Gaji telah diberikan kepada karyawan secara tunai."}
          </div>

          <button class="slip-btn-pdf" onclick="downloadSlipPDF()">
            ⬇ Download PDF
          </button>

        </div>

      </div>
    </div>
  `;
}
window.downloadSlipPDF = async function () {
  const { jsPDF } = window.jspdf;

  const el = document.querySelector(".slip-detail-card");
  if (!el) return;

  const userData = window.currentUser || {};
  const nama   = userData.nama  || "-";
  const nik    = userData.nik   || "-";
  const divisi = userData.role  || "-";

  const infoRows = el.querySelectorAll(".slip-detail-info-row");
  let periode = "-";
  infoRows.forEach(r => {
    if (r.querySelector("span")?.innerText?.includes("Periode"))
      periode = r.querySelector("strong")?.innerText || "-";
  });

  const namaPt     = el.querySelector(".slip-detail-company-name")?.innerText  || "-";
  const alamat     = el.querySelector(".slip-detail-company-address")?.innerText || "-";
  const catatan    = el.querySelector(".slip-detail-catatan")?.innerText        || "-";
  const grandTotal = el.querySelector(".slip-detail-total strong")?.innerText   || "-";

  function parseSection(titleKeyword) {
    const sections = el.querySelectorAll(".slip-detail-section");
    let found = null;
    sections.forEach(s => {
      const t = s.querySelector(".slip-section-title")?.innerText || "";
      if (t.toLowerCase().includes(titleKeyword.toLowerCase())) found = s;
    });
    if (!found) return { rows: [], total: "" };
    const rows = [];
    found.querySelectorAll(".slip-section-row").forEach(r => {
      const cols = r.querySelectorAll("span");
      if (cols.length === 3)
        rows.push({ label: cols[0].innerText, hari: cols[1].innerText, nilai: cols[2].innerText });
    });
    const total = found.querySelector(".slip-section-total .slip-col-kanan")?.innerText || "";
    return { rows, total };
  }

  const pendapatan = parseSection("Pendapatan");
  const bonus      = parseSection("Bonus");
  const potongan   = parseSection("Potongan");

  const doc = new jsPDF("p", "mm", "a4");
  const PW = 210, ML = 14, MR = 14, CW = PW - ML - MR;
  let y = 0;

  // ── PALET WARNA #B08A5C ──────────────────────────────────────────
  const C_HEADER      = [176, 138, 92];   // #B08A5C  — header utama
  const C_HEADER_DARK = [148, 112, 68];   // versi gelap untuk aksen
  const C_HEADER_DEEP = [120,  88, 48];   // paling gelap (grand total bar)
  const C_CREAM_BG    = [253, 249, 243];  // background kertas
  const C_CREAM_ROW   = [248, 241, 230];  // baris zebra
  const C_CREAM_SEC   = [243, 235, 220];  // section header
  const C_CREAM_TOTAL = [235, 224, 205];  // baris total section
  const C_TEXT_DARK   = [ 60,  42,  20];  // teks utama
  const C_TEXT_MID    = [120,  96,  64];  // teks sekunder / label
  const C_TEXT_LIGHT  = [170, 148, 115];  // teks muted
  const C_BORDER      = [210, 192, 165];  // garis border
  const C_WHITE_WARM  = [255, 252, 245];  // putih hangat
  const C_GOLD_TEXT   = [155, 115,  55];  // teks nominal highlight

  function sf(c){ doc.setFillColor(...c); }
  function sd(c){ doc.setDrawColor(...c); }
  function st(c){ doc.setTextColor(...c); }
  function fn(s,z){ doc.setFont("helvetica", s); doc.setFontSize(z); }

  // ── BACKGROUND KERTAS ────────────────────────────────────────────
  sf(C_CREAM_BG);
  doc.rect(0, 0, PW, 297, "F");

  // ── HEADER UTAMA ─────────────────────────────────────────────────
  // Blok utama #B08A5C
  sf(C_HEADER);
  doc.rect(0, 0, PW, 38, "F");

  // Strip gelap di bawah header sebagai shadow tipis
  sf(C_HEADER_DARK);
  doc.rect(0, 37, PW, 1.5, "F");

  // LOGO
  try {
    const logoEl = el.querySelector(".slip-detail-logo");
    if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {
      const cvs = document.createElement("canvas");
      cvs.width  = logoEl.naturalWidth;
      cvs.height = logoEl.naturalHeight;
      cvs.getContext("2d").drawImage(logoEl, 0, 0);
      doc.addImage(cvs.toDataURL("image/png"), "PNG", ML, 7, 20, 20);
    }
  } catch (_) {}

  // Nama PT
  fn("bold", 14);
  st(C_WHITE_WARM);
  doc.text(namaPt, ML + 25, 17);

  // Alamat
  fn("normal", 7.5);
  st([240, 225, 200]);
  const alamatLines = doc.splitTextToSize(alamat, CW - 80);
  doc.text(alamatLines, ML + 25, 24);

  // Label kanan atas
  fn("bold", 9);
  st([255, 245, 225]);
  doc.text("SLIP GAJI KARYAWAN", PW - MR, 13, { align: "right" });

  fn("normal", 7.5);
  st([240, 220, 185]);
  doc.text(periode, PW - MR, 20, { align: "right" });
  doc.text(
    `Dicetak: ${new Date().toLocaleDateString("id-ID",{ day:"2-digit", month:"long", year:"numeric" })}`,
    PW - MR, 27, { align: "right" }
  );

  y = 46;

  // ── CARD INFO KARYAWAN ───────────────────────────────────────────
  // Shadow tipis (kotak sedikit lebih besar + warna border)
  sf(C_BORDER);
  doc.roundedRect(ML, y + 0.5, CW, 28, 2, 2, "F");

  sf(C_WHITE_WARM);
  sd(C_BORDER);
  doc.setLineWidth(0.25);
  doc.roundedRect(ML, y, CW, 28, 2, 2, "FD");

  // Strip warna #B08A5C di kiri card
  sf(C_HEADER);
  doc.rect(ML, y, 3, 28, "F");

  function field(label, value, x, yy) {
    fn("normal", 7);
    st(C_TEXT_LIGHT);
    doc.text(label, x, yy);
    fn("bold", 9);
    st(C_TEXT_DARK);
    doc.text(value, x, yy + 5.5);
  }

  const c1 = ML + 8, c2 = ML + 56, c3 = ML + 110, c4 = ML + 150;

  field("Nama Karyawan", nama,    c1, y + 8);
  field("NIK",           nik,     c2, y + 8);
  field("Divisi / Jabatan", divisi, c3, y + 8);
  field("Periode Gaji",  periode, c4, y + 8);

  // Garis vertikal pemisah field
  sd(C_BORDER);
  doc.setLineWidth(0.2);
  [c2 - 4, c3 - 4, c4 - 4].forEach(x => doc.line(x, y + 5, x, y + 23));

  y += 34;

  // ── FUNGSI SECTION ───────────────────────────────────────────────
  function drawHeader(title) {
    sf(C_CREAM_SEC);
    sd(C_BORDER);
    doc.setLineWidth(0.2);
    doc.rect(ML, y, CW, 7, "FD");

    // aksen strip kiri
    sf(C_HEADER);
    doc.rect(ML, y, 3, 7, "F");

    fn("bold", 8.5);
    st(C_TEXT_DARK);
    doc.text(title, ML + 6, y + 5);

    fn("normal", 7.5);
    st(C_TEXT_LIGHT);
    doc.text("Hari",    ML + CW - 50, y + 5, { align: "right" });
    doc.text("Nominal", ML + CW - 2,  y + 5, { align: "right" });

    y += 7;
  }

  function drawRows(rowsArr) {
    rowsArr.forEach((r, i) => {
      if (i % 2 === 0) {
        sf(C_CREAM_ROW);
        doc.rect(ML, y, CW, 6, "F");
      }
      fn("normal", 8.5);
      st(C_TEXT_DARK);
      doc.text(r.label, ML + 6, y + 4.2);

      fn("normal", 8);
      st(C_TEXT_MID);
      doc.text(r.hari, ML + CW - 50, y + 4.2, { align: "right" });

      fn("normal", 8.5);
      st(C_TEXT_DARK);
      doc.text(r.nilai, ML + CW - 2, y + 4.2, { align: "right" });

      y += 6;
    });

    // garis bawah rows
    sd(C_BORDER);
    doc.setLineWidth(0.15);
    doc.line(ML, y, ML + CW, y);
  }

  function drawTotal(label, value) {
    sf(C_CREAM_TOTAL);
    doc.rect(ML, y, CW, 7, "F");

    fn("bold", 8.5);
    st(C_TEXT_MID);
    doc.text(label, ML + 6, y + 5);

    fn("bold", 9);
    st(C_GOLD_TEXT);
    doc.text(value, ML + CW - 2, y + 5, { align: "right" });

    y += 9;
  }

  function drawSection(title, data) {
    if (!data.rows.length) return;
    drawHeader(title);
    drawRows(data.rows);
    drawTotal("Total " + title, data.total);
  }

  drawSection("Pendapatan", pendapatan);
  drawSection("Bonus",      bonus);
  drawSection("Potongan",   potongan);

  y += 5;

  // ── GRAND TOTAL ──────────────────────────────────────────────────
  // Shadow
  sf(C_HEADER_DARK);
  doc.roundedRect(ML, y + 1, CW, 16, 2, 2, "F");

  // Bar utama
  sf(C_HEADER_DEEP);
  doc.roundedRect(ML, y, CW, 16, 2, 2, "F");

  // Strip emas kiri
  sf(C_HEADER);
  doc.rect(ML, y, 4, 16, "F");

  fn("bold", 9.5);
  st([240, 220, 190]);
  doc.text("TOTAL PENERIMAAN BULAN INI", ML + 8, y + 7);

  fn("bold", 14);
  st(C_WHITE_WARM);
  doc.text(grandTotal, ML + CW - 3, y + 11, { align: "right" });

  y += 22;

  // ── CATATAN ──────────────────────────────────────────────────────
  sf([250, 244, 232]);
  sd(C_BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(ML, y, CW, 16, 2, 2, "FD");

  sf(C_HEADER);
  doc.rect(ML, y, 3, 16, "F");

  fn("bold", 7.5);
  st(C_TEXT_MID);
  doc.text("Catatan", ML + 6, y + 6);

  fn("normal", 7.5);
  st(C_TEXT_DARK);
  const catatanLines = doc.splitTextToSize(catatan, CW - 12);
  doc.text(catatanLines, ML + 6, y + 11.5);

  y += 22;

  // ── FOOTER ───────────────────────────────────────────────────────
  const footerY = 287;
  sd(C_BORDER);
  doc.setLineWidth(0.3);
  doc.line(ML, footerY, PW - MR, footerY);

  fn("normal", 6.5);
  st(C_TEXT_LIGHT);
  doc.text(
    "Dokumen ini digenerate otomatis oleh sistem payroll perusahaan. Tidak memerlukan tanda tangan basah.",
    PW / 2, footerY + 4, { align: "center" }
  );
  doc.text(
    `Dicetak: ${new Date().toLocaleDateString("id-ID",{ day:"2-digit", month:"long", year:"numeric" })}`,
    PW - MR, footerY + 4, { align: "right" }
  );

  // ── SAVE ─────────────────────────────────────────────────────────
  const safePeriode = periode.replace(/\s+/g, "_");
  const safeNik     = nik.replace(/\s+/g, "");
  doc.save(`SlipGaji_${safeNik}_${safePeriode}.pdf`);
};
