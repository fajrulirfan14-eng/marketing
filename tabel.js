window.initInputTabelView = async function() {
  const inner = document.getElementById("inputTabelInner");
  if (!inner) return;
  inner.innerHTML = "";

  // ── DATA ──
  const activeVarians = (window.globalBawaBarang || [])
    .filter(item => { const k = Object.keys(item)[0]; return item[k]?.isAktif === true; })
    .map(item => Object.keys(item)[0]);

  const groups = [
    { key: "kemarin",    label: "Kemarin",    bg: "#e8f5e9", th2: "#c8ebca", tc: "#1b5e20" },
    { key: "return",     label: "Return",     bg: "#fff8e1", th2: "#ffe8a3", tc: "#7a5200" },
    { key: "expired",    label: "Expired",    bg: "#fce4ec", th2: "#ffc9c5", tc: "#b71c1c" },
    { key: "konsinyasi", label: "Konsinyasi", bg: "#e8f5e9", th2: "#a5d6a7", tc: "#1b5e20" },
    { key: "cash",       label: "Cash",       bg: "#e3f2fd", th2: "#90caf9", tc: "#0d47a1" },
    { key: "lainnya",    label: "Lainnya",    bg: "#f3e5f5", th2: "#ce93d8", tc: "#4a148c" },
  ];

  const customerList  = [...(window.listCustomerData || [])].sort((a, b) => a.jarak - b.jarak);
  const dataHarianMap = window._dataHarianMap   || {};

  // ── ZOOM STATE ──
  let zoomLevel = 1.0;
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 2.0;
  const ZOOM_STEP = 0.1;

  function applyZoom() {
    const table = inner.querySelector(".it-table");
    const totalTable = inner.querySelector(".it-table-total");
    if (table) table.style.transform = `scale(${zoomLevel})`;
    if (totalTable) totalTable.style.transform = `scale(${zoomLevel})`;

    // Update ukuran scroll container supaya scrollbar tetap muncul
    const scrollWrap = inner.querySelector(".it-scroll-wrap");
    const totalScroll = inner.querySelector(".it-total-scroll");
    if (table && scrollWrap) {
      const w = table.offsetWidth * zoomLevel;
      const h = table.offsetHeight * zoomLevel;
      table.parentElement.style.width  = w + "px";
      table.parentElement.style.height = h + "px";
    }

    const label = document.getElementById("itZoomLabel");
    if (label) label.textContent = Math.round(zoomLevel * 100) + "%";

    // Sync scroll total bar
    syncTotalScroll();
  }

  function syncTotalScroll() {
    const scrollWrap  = inner.querySelector(".it-scroll-wrap");
    const totalScroll = inner.querySelector(".it-total-scroll");
    if (scrollWrap && totalScroll) {
      totalScroll.scrollLeft = scrollWrap.scrollLeft;
    }
  }

  // ── HELPER: tampilkan kosong jika 0 ──
  function displayVal(val) {
    const n = Number(val);
    return (n === 0 || val === null || val === undefined) ? "" : n;
  }

  // ── BUILD TABLE HTML ──
  let thead = `<thead>`;

  // Row 1
  thead += `<tr>`;
  thead += `<th rowspan="2" class="it-th it-th-row1 it-th-accent it-col-no">No</th>`;
  thead += `<th rowspan="2" class="it-th it-th-row1 it-th-accent it-col-nama">Nama</th>`;
  groups.forEach(g => {
    thead += `<th colspan="${activeVarians.length}" class="it-th it-th-row1" style="background:${g.bg};color:${g.tc};border-color:#6b584b;">${g.label}</th>`;
  });
  thead += `<th rowspan="2" class="it-th it-th-row1 it-th-accent it-col-ket">Ket</th>`;
  thead += `<th rowspan="2" class="it-th it-th-row1 it-th-accent it-col-pay">Bayar</th>`;
  thead += `</tr>`;

  // Row 2 — varian
  thead += `<tr>`;
  groups.forEach(g => {
    activeVarians.forEach(v => {
      thead += `<th class="it-th it-th-row2 it-th-v" style="background:${g.th2};color:${g.tc};border-color:#6b584b;">${v}</th>`;
    });
  });
  thead += `</tr></thead>`;

  // Hitung sum untuk footer
  const sumGroups = {};
  groups.forEach(g => { sumGroups[g.key] = {}; activeVarians.forEach(v => { sumGroups[g.key][v] = 0; }); });
  let sumPay = 0, countPN = 0, countTP = 0, countPT = 0;

  // Rows
  let tbody = `<tbody>`;
  customerList.forEach((cust, ri) => {
    const cid  = cust.idCustomer || cust.id || "";
    const dh   = dataHarianMap[cid] || null;
    const belumInput = !dh;
    const namaBg = belumInput ? "var(--bg-card)" : "var(--bg-primary)";
    tbody += `<tr class="it-row">`;
    tbody += `<td class="it-td it-td-no" style="background:${namaBg};">${ri + 1}</td>`;
    const feeBadge     = Object.values(dh?.fee     || {}).some(v => Number(v) > 0);
    const disableBadge = Object.values(dh?.disable || {}).some(v => Number(v) > 0);
    const badges = [
      feeBadge     ? `<span class="it-badge it-badge-fee">F</span>`     : "",
      disableBadge ? `<span class="it-badge it-badge-disable">D</span>` : "",
    ].join("");
    tbody += `<td class="it-td it-td-nama" style="background:${namaBg};">${badges}${cust.namaCustomer || "-"}</td>`;

    groups.forEach(g => {
      activeVarians.forEach(v => {
        let val = "", bgCell = "", textColor = "";

        if (g.key === "kemarin") {
          const qty = Number(cust.dataKemarin?.[v]?.qty || 0);
          val = displayVal(qty);
          const konVal = Number(dh?.konsinyasi?.[v] || 0);
          if (dh && dh.konsinyasi && konVal !== qty) {
            bgCell = "#dbeafe"; textColor = "#1d4ed8";
          } else if (qty > 0) {
            bgCell = "rgba(255,177,92,.25)"; textColor = "#7a4a00";
          }
          sumGroups["kemarin"][v] += qty;
        } else {
          const raw = dh?.[g.key]?.[v];
          val = displayVal(raw);
          if (g.key === "konsinyasi") {
            const qty    = Number(cust.dataKemarin?.[v]?.qty || 0);
            const konVal = Number(raw || 0);
            if (dh && raw !== undefined && konVal !== qty) {
              bgCell = "#ffd6d6"; textColor = "#b71c1c";
            }
            sumGroups["konsinyasi"][v] += Number(raw || 0);
          } else {
            sumGroups[g.key][v] += Number(raw || 0);
          }
        }

        const cellBg = bgCell || g.bg;
        const style = `background:${cellBg};${textColor ? `color:${textColor};font-weight:700;` : ""}`;
        tbody += `<td class="it-td it-td-v" style="${style}">${val}</td>`;
      });
    });

    // Ket
    const st = String(dh?.keterangan?.status || "").trim().toLowerCase();
    const ketText  = st === "pending" ? "PN" : st === "tutup" ? "TP" : st === "putus" ? "PT" : "";
    const ketColor = st === "pending" ? "#f59e0b" : st === "tutup" ? "#6b7280" : st === "putus" ? "#dc2626" : "";
    if (st === "pending") countPN++; else if (st === "tutup") countTP++; else if (st === "putus") countPT++;
    tbody += `<td class="it-td it-td-ket" style="color:${ketColor}">${ketText}</td>`;

    // Bayar
    const bayar = Number(dh?.pembayaran?.bayarKonsumen || 0);
    sumPay += bayar;
    const payText = bayar > 0 ? "Rp" + bayar.toLocaleString("id-ID") : "";
    tbody += `<td class="it-td it-td-pay">${payText}</td>`;
    tbody += `</tr>`;
  });
  // Baris penjualan langsung
  const uid = window.auth?.currentUser?.uid;
  let plData = {};
  let plBayar = 0;
  try {
    const today = new Date().toISOString().split("T")[0];
    const idb   = await window.openAppDB();
    const rawPL = await new Promise(resolve => {
      const tx  = idb.transaction("penjualanLangsungDB", "readonly");
      const req = tx.objectStore("penjualanLangsungDB").get(`${uid}_${today}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => resolve(null);
    });
    plData  = rawPL?.penjualanLangsung || {};
    plBayar = Number(rawPL?.pembayaran?.bayarKonsumen || 0);
  } catch { }

  sumPay += plBayar;
  const hasPL = Object.values(plData).some(v => Number(v) > 0);
  if (hasPL) {
    const plBg = "rgba(201,166,123,.08)";
    tbody += `<tr class="it-row">`;
    tbody += `<td class="it-td it-td-no" style="background:${plBg};">-</td>`;
    tbody += `<td class="it-td it-td-nama" style="background:${plBg};font-weight:700;color:var(--accent-dark);">Penjualan Langsung</td>`;
    groups.forEach(g => {
      activeVarians.forEach(v => {
        let val = "", cellBg = g.bg;
        if (g.key === "cash") {
          const qty = Number(plData[v] || 0);
          val = displayVal(qty);
          if (qty > 0) {
            cellBg = "#c4ebff";
            sumGroups["cash"][v] += qty;
          }
        }
        tbody += `<td class="it-td it-td-v" style="background:${cellBg};">${val}</td>`;
      });
    });
    tbody += `<td class="it-td it-td-ket"></td>`;
    tbody += `<td class="it-td it-td-pay">${plBayar > 0 ? "Rp" + Number(plBayar).toLocaleString("id-ID") : ""}</td>`;
    tbody += `</tr>`;
  }

  tbody += `</tbody>`;

  const ketParts = [];
  if (countPN > 0) ketParts.push(`${countPN}PN`);
  if (countTP > 0) ketParts.push(`${countTP}TP`);
  if (countPT > 0) ketParts.push(`${countPT}PT`);

  let tfoot = `<tfoot><tr class="it-total">`;
  tfoot += `<td class="it-td it-td-no it-td-total-label">TOTAL</td>`;
  tfoot += `<td class="it-td it-td-nama it-td-total-label"></td>`;
  groups.forEach(g => {
    activeVarians.forEach(v => {
      const val = sumGroups[g.key][v];
      tfoot += `<td class="it-td it-td-v it-td-total">${val > 0 ? val : ""}</td>`;
    });
  });
  tfoot += `<td class="it-td it-td-ket it-td-total">${ketParts.join(" ") || ""}</td>`;
  tfoot += `<td class="it-td it-td-pay it-td-total">Rp${sumPay.toLocaleString("id-ID")}</td>`;
  tfoot += `</tr></tfoot>`;

  // ── INJECT ──
  inner.innerHTML = `
    <div class="it-scroll-wrap" id="itScrollWrap">
      <div style="display:inline-block;">
        <table class="it-table" id="itMainTable">${thead}${tbody}${tfoot}</table>
      </div>
    </div>
  `;

  const scrollWrap = document.getElementById("itScrollWrap");

  // ── ZOOM BUTTONS ──
  const zoomIn  = document.getElementById("itZoomIn");
  const zoomOut = document.getElementById("itZoomOut");
  const zoomLabel = document.getElementById("itZoomLabel");

  function doZoom(delta) {
    zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((zoomLevel + delta) * 10) / 10));
    const mainTable = document.getElementById("itMainTable");
    if (mainTable) mainTable.style.transform = `scale(${zoomLevel})`;

    // Paksa scroll wrap tahu ukuran baru
    if (mainTable && scrollWrap) {
      const wrapper = mainTable.parentElement;
      wrapper.style.width  = (mainTable.offsetWidth  * zoomLevel) + "px";
      wrapper.style.height = (mainTable.offsetHeight * zoomLevel) + "px";
    }
    if (zoomLabel) zoomLabel.textContent = Math.round(zoomLevel * 100) + "%";
    if (totalScroll && scrollWrap) totalScroll.scrollLeft = scrollWrap.scrollLeft;
  }

  if (zoomIn)  zoomIn.addEventListener("click",  () => doZoom(+ZOOM_STEP));
  if (zoomOut) zoomOut.addEventListener("click", () => doZoom(-ZOOM_STEP));

  // ── PINCH TO ZOOM ──
  let pinchStartDist = 0;
  let pinchStartZoom = 1;

  inner.addEventListener("touchstart", e => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist = Math.sqrt(dx * dx + dy * dy);
      pinchStartZoom = zoomLevel;
    }
  }, { passive: true });

  inner.addEventListener("touchmove", e => {
    if (e.touches.length === 2) {
      const dx   = e.touches[0].clientX - e.touches[1].clientX;
      const dy   = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / pinchStartDist;
      zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(pinchStartZoom * ratio * 10) / 10));
      const mainTable  = document.getElementById("itMainTable");
      const totalTable = document.getElementById("itTotalTable");
      if (mainTable) mainTable.style.transform = `scale(${zoomLevel})`;
      if (zoomLabel) zoomLabel.textContent = Math.round(zoomLevel * 100) + "%";
    }
  }, { passive: true });

  inner.addEventListener("touchend", e => {
    if (e.touches.length < 2) {
      const mainTable = document.getElementById("itMainTable");
      if (mainTable && scrollWrap) {
        const wrapper = mainTable.parentElement;
        wrapper.style.width  = (mainTable.offsetWidth  * zoomLevel) + "px";
        wrapper.style.height = (mainTable.offsetHeight * zoomLevel) + "px";
      }
    }
  }, { passive: true });

  // ── SEARCH ──
  const searchInput = document.getElementById("itSearchInput");
  const searchClear = document.getElementById("itSearchClear");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      searchClear.style.display = q ? "block" : "none";
      inner.querySelectorAll(".it-row").forEach(row => {
        const nama = row.querySelector(".it-td-nama")?.textContent?.toLowerCase() || "";
        row.style.display = nama.includes(q) ? "" : "none";
      });
    });

    searchClear.addEventListener("click", () => {
      searchInput.value = "";
      searchClear.style.display = "none";
      inner.querySelectorAll(".it-row").forEach(row => {
        row.style.display = "";
      });
    });
  }
};

