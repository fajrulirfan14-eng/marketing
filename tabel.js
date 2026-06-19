window.initInputTabelView = function() {
  const inner   = document.getElementById("inputTabelInner");
  const tabelEl = document.getElementById("inputTabelEl");
  if (!tabelEl) return;

  const activeVarians = (window.globalBawaBarang || [])
    .filter(item => {
      const key = Object.keys(item)[0];
      return item[key]?.isAktif === true;
    })
    .map(item => Object.keys(item)[0]);

  const groups = [
    { key: "kemarin",    label: "Data Kemarin" },
    { key: "return",     label: "Return"       },
    { key: "expired",    label: "Expired"      },
    { key: "konsinyasi", label: "Konsinyasi"   },
    { key: "cash",       label: "Cash"         },
    { key: "lainnya",    label: "Lainnya"      },
  ];

  const vCount = activeVarians.length || 1;

  const thead = `<thead>
    <tr>
      <th class="th-nama" rowspan="2">Nama Customer</th>
      ${groups.map(g =>
        `<th class="th-group" colspan="${vCount}">${g.label}</th>`
      ).join("")}
      <th class="th-ket" rowspan="2">Ket</th>
      <th class="th-pay" rowspan="2">Pembayaran</th>
    </tr>
    <tr>
      ${groups.map(() =>
        activeVarians.map(v => `<th class="th-varian">${v}</th>`).join("")
      ).join("")}
    </tr>
  </thead>`;

  const customerList  = window.listCustomerData  || [];
  const dataHarianMap = window._dataHarianMap    || {};

  let tbodyHtml = "<tbody>";

  if (customerList.length === 0) {
    tbodyHtml += `<tr><td colspan="${1 + groups.length * vCount + 2}" style="padding:20px;color:var(--text-secondary);">Belum ada customer</td></tr>`;
  } else {
    customerList.forEach(cust => {
      const cid = cust.idCustomer || cust.id || "";
      const dh  = dataHarianMap[cid] || null;
      const rowClass = dh ? "" : "td-empty-row";

      const ket = (() => {
        const s = String(dh?.keterangan?.status || "").trim().toLowerCase();
        if (s === "pending") return { text: "PN", cls: "td-ket-pn" };
        if (s === "tutup")   return { text: "TP", cls: "td-ket-tp" };
        if (s === "putus")   return { text: "PT", cls: "td-ket-pt" };
        return { text: "-", cls: "" };
      })();

      const pay = dh?.pembayaran?.bayarKonsumen
        ? "Rp" + Number(dh.pembayaran.bayarKonsumen).toLocaleString("id-ID")
        : "-";

      tbodyHtml += `<tr class="${rowClass}">`;
      tbodyHtml += `<td class="td-nama">${cust.namaCustomer || "-"}</td>`;

      // Data Kemarin
      activeVarians.forEach(v => {
        const qty = Number(cust.dataKemarin?.[v]?.qty || 0);
        tbodyHtml += `<td class="${qty > 0 ? "td-highlight" : ""}">${qty || "-"}</td>`;
      });
      // Return
      activeVarians.forEach(v => {
        const val = dh?.return?.[v];
        tbodyHtml += `<td>${val ?? "-"}</td>`;
      });
      // Expired
      activeVarians.forEach(v => {
        const val = dh?.expired?.[v];
        tbodyHtml += `<td>${val ?? "-"}</td>`;
      });
      // Konsinyasi
      activeVarians.forEach(v => {
        const val = dh?.konsinyasi?.[v];
        tbodyHtml += `<td>${val ?? "-"}</td>`;
      });
      // Cash
      activeVarians.forEach(v => {
        const val = dh?.cash?.[v];
        tbodyHtml += `<td>${val ?? "-"}</td>`;
      });
      // Lainnya
      activeVarians.forEach(v => {
        const val = dh?.lainnya?.[v];
        tbodyHtml += `<td>${val ?? "-"}</td>`;
      });

      tbodyHtml += `<td class="td-ket ${ket.cls}">${ket.text}</td>`;
      tbodyHtml += `<td class="td-pay">${pay}</td>`;
      tbodyHtml += `</tr>`;
    });
  }

  tbodyHtml += "</tbody>";
  tabelEl.innerHTML = thead + tbodyHtml;

  // ── ZOOM pakai CSS zoom (bukan transform) supaya scroll ikut ──
  let scale     = 1;
  let lastScale = 1;
  let startDist = 0;
  let minScale  = 1;

  tabelEl.style.zoom = "1";

  // Fit ke lebar inner setelah render
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const innerW = inner?.offsetWidth || window.innerWidth;
      const tabelW = tabelEl.offsetWidth;
      if (tabelW > innerW && tabelW > 0) {
        minScale  = innerW / tabelW;
        scale     = minScale;
        lastScale = minScale;
        tabelEl.style.zoom = scale;
      }
    });
  });

  // ── PINCH ZOOM ──
  inner?.addEventListener("touchstart", e => {
    if (e.touches.length === 2) {
      startDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastScale = scale;
    }
  }, { passive: true });

  inner?.addEventListener("touchmove", e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      scale = Math.min(3, Math.max(minScale, lastScale * (dist / startDist)));
      tabelEl.style.zoom = scale;
    }
  }, { passive: false });

  inner?.addEventListener("touchend", () => {
    if (scale < minScale) scale = minScale;
    if (scale > 3)        scale = 3;
    tabelEl.style.zoom = scale;
  }, { passive: true });
};