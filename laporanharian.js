window.initLaporanHarianView = async function() {
  const listEl = document.getElementById("laporanHarianList");
  if (!listEl) return;

  const now   = new Date();
  const bulanNama = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const hariNama  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

  window.laporanFilterBulan = now.getMonth() + 1;
  window.laporanFilterTahun = now.getFullYear();

  // Init dropdown bulan
  const bulanListEl  = document.getElementById("laporanDropdownBulanList");
  const bulanBtnEl   = document.getElementById("laporanDropdownBulanBtn");
  const bulanLabelEl = document.getElementById("laporanDropdownBulanLabel");

  bulanNama.forEach((b, i) => {
    const item = document.createElement("div");
    item.className = "laporan-dropdown-item" + (i + 1 === window.laporanFilterBulan ? " active" : "");
    item.textContent = b;
    item.onclick = () => {
      window.laporanFilterBulan = i + 1;
      bulanLabelEl.textContent = b;
      bulanListEl.classList.remove("open");
      bulanListEl.querySelectorAll(".laporan-dropdown-item").forEach(el => el.classList.remove("active"));
      item.classList.add("active");
      loadLaporan();
    };
    bulanListEl.appendChild(item);
  });
  if (bulanLabelEl) bulanLabelEl.textContent = bulanNama[window.laporanFilterBulan - 1];
  bulanBtnEl?.addEventListener("click", e => {
    e.stopPropagation();
    bulanListEl.classList.toggle("open");
    tahunListEl?.classList.remove("open");
  });

  // Init dropdown tahun
  const tahunListEl  = document.getElementById("laporanDropdownTahunList");
  const tahunBtnEl   = document.getElementById("laporanDropdownTahunBtn");
  const tahunLabelEl = document.getElementById("laporanDropdownTahunLabel");
  const tahunIni     = now.getFullYear();

  for (let y = tahunIni; y >= tahunIni - 3; y--) {
    const item = document.createElement("div");
    item.className = "laporan-dropdown-item" + (y === window.laporanFilterTahun ? " active" : "");
    item.textContent = y;
    item.onclick = () => {
      window.laporanFilterTahun = y;
      tahunLabelEl.textContent = y;
      tahunListEl.classList.remove("open");
      tahunListEl.querySelectorAll(".laporan-dropdown-item").forEach(el => el.classList.remove("active"));
      item.classList.add("active");
      loadLaporan();
    };
    tahunListEl.appendChild(item);
  }
  if (tahunLabelEl) tahunLabelEl.textContent = window.laporanFilterTahun;
  tahunBtnEl?.addEventListener("click", e => {
    e.stopPropagation();
    tahunListEl.classList.toggle("open");
    bulanListEl?.classList.remove("open");
  });

  // Klik luar tutup dropdown
  document.addEventListener("click", function closeDropdown(e) {
    if (!e.target.closest("#laporanDropdownBulanWrap")) bulanListEl?.classList.remove("open");
    if (!e.target.closest("#laporanDropdownTahunWrap")) tahunListEl?.classList.remove("open");
  });

  async function loadLaporan() {
    listEl.innerHTML = `<div class="laporan-harian-empty">Memuat...</div>`;

    try {
      const uid    = window.auth.currentUser.uid;
      const bulan  = window.laporanFilterBulan;
      const tahun  = window.laporanFilterTahun;
      const tglAwal  = `${tahun}-${String(bulan).padStart(2,"0")}-01`;
      const tglAkhir = `${tahun}-${String(bulan).padStart(2,"0")}-31`;

      const snap = await window.getDocs(window.query(
        window.collection(window.db, "users", uid, "laporanMarketing"),
        window.where("idMarketing", "==", uid),
        window.where("tanggal", ">=", tglAwal),
        window.where("tanggal", "<=", tglAkhir)
      ));

      if (snap.empty) {
        listEl.innerHTML = `<div class="laporan-harian-empty">Tidak ada laporan bulan ini</div>`;
        return;
      }

      // Load varian dari usersDB
      let varianKeys = [];
      try {
        const idb      = await window.openAppDB();
        const userData = await new Promise(resolve => {
          const tx  = idb.transaction("usersDB", "readonly");
          const req = tx.objectStore("usersDB").get(uid);
          req.onsuccess = () => resolve(req.result?.data || null);
          req.onerror   = () => resolve(null);
        });
        varianKeys = (userData?.varian || [])
          .filter(v => { const k = Object.keys(v)[0]; return v[k]?.isAktif === true; })
          .map(v => Object.keys(v)[0]);
      } catch { }

      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

      function cellVal(map, key) {
        const val = map?.[key];
        return (val != null && val !== 0) ? val : "-";
      }
      // Hitung total closing per varian
      const totalClosing = {};
      docs.forEach(item => {
        const closingMap = item.pembayaran?.closing || {};
        Object.entries(closingMap).forEach(([k, v]) => {
          totalClosing[k] = (totalClosing[k] || 0) + Number(v || 0);
        });
      });
      const summaryHtml = varianKeys.length ? `
        <div class="laporan-harian-summary">
          <div class="laporan-harian-summary-title">Total Closing ${bulanNama[bulan-1]}</div>
          <div class="laporan-harian-summary-row">
            ${varianKeys.map(k => `
              <div class="laporan-harian-summary-box">
                <div class="laporan-harian-summary-label">${k}</div>
                <div class="laporan-harian-summary-value">${totalClosing[k] || 0}</div>
              </div>
            `).join("")}
          </div>
        </div>
      ` : "";

      listEl.innerHTML = summaryHtml + docs.map(item => {
        const tgl      = new Date(item.tanggal);
        const hariStr  = hariNama[tgl.getDay()];
        const tglStr   = `${hariStr}, ${tgl.getDate()} ${bulanNama[tgl.getMonth()]} ${tgl.getFullYear()}`;
        const orderMap   = item.order || {};
        const sisaMap    = item.sisaBarang || item.pembayaran?.sisaBarang || {};
        const closingMap = item.pembayaran?.closing || {};
        const bayar      = item.pembayaran?.nota?.bayar || 0;
        const status     = item.pembayaran?.nota?.status || null;
        const keterangan = item.pembayaran?.nota?.keterangan || 0;

        const tableHtml = varianKeys.length ? `
          <div class="laporan-harian-table">
            <table>
              <thead>
                <tr>
                  <th></th>
                  ${varianKeys.map(k => `<th>${k}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Bawa</td>
                  ${varianKeys.map(k => `<td>${cellVal(orderMap, k)}</td>`).join("")}
                </tr>
                <tr>
                  <td>Sisa</td>
                  ${varianKeys.map(k => `<td>${cellVal(sisaMap, k)}</td>`).join("")}
                </tr>
                <tr>
                  <td>Closing</td>
                  ${varianKeys.map(k => `<td>${cellVal(closingMap, k)}</td>`).join("")}
                </tr>
              </tbody>
            </table>
          </div>
        ` : "";

        const role = (window.currentUser?.role || "").toLowerCase();
        const bayarHtml = bayar && role !== "hunter" ? `
          <div class="laporan-harian-bayar">
            <div class="laporan-harian-bayar-label">Pembayaran</div>
            <div class="laporan-harian-bayar-value">
              Rp ${bayar.toLocaleString("id-ID")}
              ${keterangan ? `<span style="font-size:11px;color:${keterangan < 0 ? '#e53935' : '#2eaf62'};">
                (${keterangan < 0 ? "-" : "+"}Rp ${Math.abs(keterangan).toLocaleString("id-ID")})
              </span>` : ""}
            </div>
          </div>
        ` : "";

        return `
          <div class="laporan-harian-item">
            <div class="laporan-harian-item-header">
              <div class="laporan-harian-tanggal">${tglStr}</div>
              ${status && role !== "hunter" ? `<div class="laporan-harian-status ${status === 'Kurang' ? 'kurang' : 'lunas'}">${status}</div>` : ""}
            </div>
            ${tableHtml}
            ${bayarHtml}
          </div>
        `;
      }).join("");

    } catch(e) {
      console.log("loadLaporan error:", e);
      listEl.innerHTML = `<div class="laporan-harian-empty">Gagal memuat laporan</div>`;
    }
  }

  loadLaporan();
};