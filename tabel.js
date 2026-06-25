window.initInputTabelView = function() {
  const inner = document.getElementById("inputTabelInner");
  if (!inner) return;
  inner.innerHTML = "";

  // ── DATA ──
  const activeVarians = (window.globalBawaBarang || [])
    .filter(item => { const k = Object.keys(item)[0]; return item[k]?.isAktif === true; })
    .map(item => Object.keys(item)[0]);

  const groups = [
    { key: "kemarin",    label: "Kemarin",    bg: "#e8f5e9", th2: "#c8ebca", tc: "#2e7d32" },
    { key: "return",     label: "Return",     bg: "#fff8e1", th2: "#ffe8a3", tc: "#8f6a00" },
    { key: "expired",    label: "Expired",    bg: "#fce4ec", th2: "#ffc9c5", tc: "#c62828" },
    { key: "konsinyasi", label: "Konsinyasi", bg: "#e8f5e9", th2: "#c8ebca", tc: "#1b5e20" },
    { key: "cash",       label: "Cash",       bg: "#e3f2fd", th2: "#c4ebff", tc: "#0d47a1" },
    { key: "lainnya",    label: "Lainnya",    bg: "#f3e5f5", th2: "#e5c6ec", tc: "#6a1b9a" },
  ];

  const customerList  = window.listCustomerData || [];
  const dataHarianMap = window._dataHarianMap   || {};

  // ── BUILD TABLE HTML ──
  let thead = `<thead>`;

  // Row 1
  thead += `<tr>`;
  thead += `<th rowspan="2" class="it-th it-th-row1 it-th-accent it-col-no">No</th>`;
  thead += `<th rowspan="2" class="it-th it-th-row1 it-th-accent it-col-nama">Nama</th>`;
  groups.forEach(g => {
    thead += `<th colspan="${activeVarians.length}" class="it-th it-th-row1" style="background:${g.bg};color:${g.tc}">${g.label}</th>`;
  });
  thead += `<th rowspan="2" class="it-th it-th-row1 it-th-accent it-col-ket">Ket</th>`;
  thead += `<th rowspan="2" class="it-th it-th-row1 it-th-accent it-col-pay">Bayar</th>`;
  thead += `</tr>`;

  // Row 2 — varian
  thead += `<tr>`;
  groups.forEach(g => {
    activeVarians.forEach(v => {
      thead += `<th class="it-th it-th-row2 it-th-v" style="background:${g.th2};color:${g.tc}">${v}</th>`;
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
    const even = ri % 2 === 1;
    const rowBg = even ? "var(--bg-primary)" : "var(--bg-card)";

    tbody += `<tr class="it-row" style="--row-bg:${rowBg};background:${rowBg}">`;
    tbody += `<td class="it-td it-td-no">${ri + 1}</td>`;
    tbody += `<td class="it-td it-td-nama">${cust.namaCustomer || "-"}</td>`;

    groups.forEach(g => {
      activeVarians.forEach(v => {
        let val = "-", bgCell = "", textColor = "";

        if (g.key === "kemarin") {
          const qty = Number(cust.dataKemarin?.[v]?.qty || 0);
          val = qty > 0 ? qty : "-";
          const konVal = Number(dh?.konsinyasi?.[v] || 0);
          if (dh && dh.konsinyasi && konVal !== qty) {
            bgCell = "#dbeafe"; textColor = "#1d4ed8";
          } else if (qty > 0) {
            bgCell = "rgba(255,177,92,.18)"; textColor = "#a85a00";
          }
          sumGroups["kemarin"][v] += Number(qty);
        } else {
          const raw = dh?.[g.key]?.[v];
          val = (raw !== undefined && raw !== null) ? raw : "-";
          if (g.key === "konsinyasi") {
            const qty    = Number(cust.dataKemarin?.[v]?.qty || 0);
            const konVal = Number(raw || 0);
            if (dh && raw !== undefined && konVal !== qty) {
              bgCell = "#ffd6d6"; textColor = "#c62828";
            }
            sumGroups["konsinyasi"][v] += Number(raw || 0);
          } else {
            sumGroups[g.key][v] += Number(raw || 0);
          }
        }

        const style = `${bgCell ? `background:${bgCell};` : ""}${textColor ? `color:${textColor};` : ""}`;
        tbody += `<td class="it-td it-td-v" style="${style}">${val}</td>`;
      });
    });

    // Ket
    const st = String(dh?.keterangan?.status || "").trim().toLowerCase();
    const ketText  = st === "pending" ? "PN" : st === "tutup" ? "TP" : st === "putus" ? "PT" : "-";
    const ketColor = st === "pending" ? "#f59e0b" : st === "tutup" ? "#6b7280" : st === "putus" ? "#dc2626" : "#999";
    if (st === "pending") countPN++; else if (st === "tutup") countTP++; else if (st === "putus") countPT++;
    tbody += `<td class="it-td it-td-ket" style="color:${ketColor};font-weight:700">${ketText}</td>`;

    // Bayar
    sumPay += Number(dh?.pembayaran?.bayarKonsumen || 0);
    const pay = dh?.pembayaran?.bayarKonsumen
      ? "Rp" + Number(dh.pembayaran.bayarKonsumen).toLocaleString("id-ID")
      : "-";
    tbody += `<td class="it-td it-td-pay">${pay}</td>`;
    tbody += `</tr>`;
  });
  tbody += `</tbody>`;

  // Footer total
  let tfoot = `<tfoot><tr class="it-total">`;
  tfoot += `<td class="it-td it-td-total-label">TOTAL</td>`;
  tfoot += `<td class="it-td it-td-total-label"></td>`;
  groups.forEach(g => {
    activeVarians.forEach(v => {
      const val = sumGroups[g.key][v];
      tfoot += `<td class="it-td it-td-total">${val > 0 ? val : "-"}</td>`;
    });
  });
  const ketParts = [];
  if (countPN > 0) ketParts.push(`${countPN} PN`);
  if (countTP > 0) ketParts.push(`${countTP} TP`);
  if (countPT > 0) ketParts.push(`${countPT} PT`);
  tfoot += `<td class="it-td it-td-total">${ketParts.join(", ") || "-"}</td>`;
  tfoot += `<td class="it-td it-td-total">Rp${sumPay.toLocaleString("id-ID")}</td>`;
  tfoot += `</tr></tfoot>`;

  // Inject
  inner.innerHTML = `
    <div class="it-scroll-wrap">
      <table class="it-table">${thead}${tbody}${tfoot}</table>
    </div>
  `;
  // Search
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
