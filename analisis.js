
/* ── HELPER: cari semua tanggal untuk hari tertentu dalam 1 bulan ── */
function getHariListAnalisis(hari, bulan, tahun) {
  const namaHari  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const targetDay = namaHari.indexOf(hari);
  const totalHari = new Date(tahun, bulan + 1, 0).getDate();
  const list = [];
  for (let d = 1; d <= totalHari; d++) {
    const date = new Date(tahun, bulan, d);
    if (date.getDay() === targetDay) list.push(date);
  }
  return list;
}

/* ── HELPER: N tanggal referensi, mundur dari minggu SEBELUM hari ini ── */
function getReferenceDatesAnalisis(count) {
  const today = new Date();
  const namaHari  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const hariAktif = namaHari[today.getDay()];

  let curBulan = today.getMonth();
  let curTahun = today.getFullYear();
  let list = getHariListAnalisis(hariAktif, curBulan, curTahun);

  let idx = list.findIndex(d => d.toDateString() === today.toDateString()) - 1;

  const result = [];
  let guard = 0;
  while (result.length < count && guard < 120) {
    guard++;
    if (idx >= 0 && idx < list.length) {
      result.push(list[idx]);
      idx--;
    } else {
      curBulan--;
      if (curBulan < 0) { curBulan = 11; curTahun--; }
      list = getHariListAnalisis(hariAktif, curBulan, curTahun);
      idx = list.length - 1;
      if (!list.length) break;
    }
  }
  return result; // paling baru (minggu lalu) duluan
}

/* ── SETTING TRIKOTOMI — langsung Firestore, bukan IDB ── */
const TRI_DEFAULT_ANALISIS = {
  produktif:    { return: { min:0, max:1    }, expired: { min:0, max:0    } },
  stabil:       { return: { min:2, max:2    }, expired: { min:0, max:1    } },
  nonProduktif: { return: { min:3, max:9999 }, expired: { min:2, max:9999 } }
};
function triInRangeAnalisis(val, min, max) { return val >= min && val <= max; }
function triKlasifikasiAnalisis(returnTotal, expiredTotal, tri) {
  function getK(val, field) {
    if (triInRangeAnalisis(val, tri.produktif[field].min,    tri.produktif[field].max))    return 1;
    if (triInRangeAnalisis(val, tri.stabil[field].min,       tri.stabil[field].max))       return 2;
    if (triInRangeAnalisis(val, tri.nonProduktif[field].min, tri.nonProduktif[field].max)) return 3;
    return 0;
  }
  const worst = Math.max(getK(returnTotal, "return"), getK(expiredTotal, "expired"));
  return worst === 3 ? "red" : worst === 2 ? "yellow" : worst === 1 ? "green" : "grey";
}
async function loadTrikotomiSettingAnalisis(idCabang) {
  try {
    if (!idCabang) return TRI_DEFAULT_ANALISIS;
    const snap = await window.getDoc(window.doc(window.db, "kantorCabang", idCabang));
    const tri = snap.exists() ? (snap.data()?.trikotomi || null) : null;
    return tri ? { ...TRI_DEFAULT_ANALISIS, ...tri } : TRI_DEFAULT_ANALISIS;
  } catch (err) {
    return TRI_DEFAULT_ANALISIS;
  }
}

window.analisisPeriode = 1;
window.analisisFilter  = "default";

window.initAnalisisView = async function(){

  document.body.style.overscrollBehavior = "none";
  document.documentElement.style.overscrollBehavior = "none";

  const container = document.getElementById("accordionContainer");
  const uid       = window.auth.currentUser?.uid;
  const idCabang  = window.currentUser?.idCabang || "";

  container.innerHTML = `<div class="analisis-loading">Memuat data...</div>`;

  try {
    const namaHari  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    const hariAktif = namaHari[new Date().getDay()];

    // ── PERIODE DROPDOWN — dibangun sesuai jumlah minggu hari ini di bulan ini ──
    const totalMingguBulanIni = getHariListAnalisis(hariAktif, new Date().getMonth(), new Date().getFullYear()).length;
    buildAnalisisPeriodeDropdown(Math.max(totalMingguBulanIni, 1));

    // ── 1. LOAD CUSTOMER LIST (langsung Firestore) ──
    const custSnap = await window.getDocs(window.query(
      window.collection(window.db, "customer"),
      window.where("pemilik",  "==", uid),
      window.where("idCabang", "==", idCabang),
      window.where("hari",     "==", hariAktif),
      window.where("status",   "==", true)
    ));
    const customerList = custSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // ── 2. TANGGAL REFERENSI SESUAI PERIODE ──
    const refDates = getReferenceDatesAnalisis(window.analisisPeriode);

    const subtitleEl = document.querySelector(".analisis-header-subtitle");
    if (subtitleEl) {
      const refLabel = refDates.map(d => d.toLocaleDateString("id-ID", { day:"numeric", month:"short" })).join(" & ");
      subtitleEl.textContent = refLabel ? `Referensi: ${refLabel}` : "Belum ada data referensi";
    }

    // ── 3. FETCH dataHarian utk tiap tanggal referensi ──
    const refMaps = await Promise.all(refDates.map(async d => {
      const tglStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      try {
        const snap = await window.getDocs(window.query(
          window.collectionGroup(window.db, "dataHarian"),
          window.where("pemilik",  "==", uid),
          window.where("tanggal",  "==", tglStr),
          window.where("idCabang", "==", idCabang)
        ));
        const map = {};
        snap.forEach(docSnap => {
          const data = docSnap.data();
          const cid  = data.idCustomer || "";
          if (cid) map[cid] = data;
        });
        return map;
      } catch (err) {
        return {};
      }
    }));

    // ── 4. SETTING TRIKOTOMI ──
    const tri = await loadTrikotomiSettingAnalisis(idCabang);

    // ── 5. BUILD & KLASIFIKASI ──
    const customers = customerList.map(c => {
      const docs = refMaps.map(m => m[c.id]).filter(Boolean);

      let retTotal = 0, expTotal = 0, closingTotal = 0, statusKet = "";
      if (docs.length) {
        if (window.analisisPeriode === 1) {
          const dh = docs[0];
          retTotal     = Object.values(dh.return  || {}).reduce((a,v)=>a+(Number(v)||0),0);
          expTotal     = Object.values(dh.expired || {}).reduce((a,v)=>a+(Number(v)||0),0);
          closingTotal = Object.values(dh.closing || {}).reduce((a,v)=>a+(Number(v)||0),0);
          statusKet    = dh.keterangan?.status?.toLowerCase() || "";
        } else {
          const sums = docs.map(dh => ({
            r: Object.values(dh.return  || {}).reduce((a,v)=>a+(Number(v)||0),0),
            e: Object.values(dh.expired || {}).reduce((a,v)=>a+(Number(v)||0),0),
            c: Object.values(dh.closing || {}).reduce((a,v)=>a+(Number(v)||0),0),
          }));
          retTotal     = Math.round(sums.reduce((a,s)=>a+s.r,0) / docs.length);
          expTotal     = Math.round(sums.reduce((a,s)=>a+s.e,0) / docs.length);
          closingTotal = Math.round(sums.reduce((a,s)=>a+s.c,0) / docs.length);
          statusKet    = docs[docs.length-1].keterangan?.status?.toLowerCase() || "";
        }
      }

      const tutupCount   = docs.filter(dh => (dh.keterangan?.status?.toLowerCase()||"") === "tutup").length;
      const pendingCount = docs.filter(dh => (dh.keterangan?.status?.toLowerCase()||"") === "pending").length;
      const putusCount   = docs.filter(dh => (dh.keterangan?.status?.toLowerCase()||"") === "putus").length;
      const combinedTutupPending = tutupCount + pendingCount;

      let status = docs.length ? triKlasifikasiAnalisis(retTotal, expTotal, tri) : "grey";
      if (combinedTutupPending >= 3) status = "red";
      else if (combinedTutupPending >= 1 && status !== "red") status = "yellow";
      if (putusCount >= 1) status = "red";

      return {
        id: c.id,
        name: c.namaCustomer || "-",
        retTotal, expTotal, closingTotal,
        tutupCount, pendingCount, putusCount,
        catatan: c.catatanAnalisa || "",
        status,
        hasData: docs.length > 0
      };
    });

    window._trikotomiResult = {};
    customers.forEach(c => { window._trikotomiResult[c.id] = c.status; });

    // ── 6. RENDER ──
    function createGroup(title, color, data) {
      return `
        <div class="analisis-group ${color}">
          <div class="analisis-group-header">
            <div class="analisis-group-title">${title}</div>
            <div class="analisis-group-subtitle">${data.length} Customer</div>
          </div>
          <div class="analisis-group-body">
            ${data.length === 0
              ? `<div class="analisis-empty">Tidak ada customer</div>`
              : data.map(c => `
                <div class="customer-item">
                  <div style="flex:1;min-width:0">
                    <div class="customer-name">${escAnalisis(c.name)}</div>
                    <div class="customer-detail">
                      ${c.hasData
                        ? `Return: ${c.retTotal} • Expired: ${c.expTotal} • Closing: ${c.closingTotal}`
                        : `Belum ada data`}
                    </div>
                    ${c.hasData ? `<div class="customer-detail">
                      Tutup: ${c.tutupCount} • Pending: ${c.pendingCount} • Putus: ${c.putusCount}
                    </div>` : ""}
                    ${c.catatan ? `<div class="customer-catatan"><i class="fa-solid fa-note-sticky"></i> ${escAnalisis(c.catatan)}</div>` : ""}
                  </div>
                  <div class="customer-score ${color}">
                    ${c.retTotal + c.expTotal}
                  </div>
                </div>
              `).join("")
            }
          </div>
        </div>
      `;
    }

    function render(keyword = "") {
      const key = keyword.toLowerCase().trim();
      let filtered = customers;

      if (window.analisisFilter === "return")  filtered = filtered.filter(c => c.retTotal > 0);
      if (window.analisisFilter === "expired") filtered = filtered.filter(c => c.expTotal > 0);
      if (window.analisisFilter === "tutup")   filtered = filtered.filter(c => c.tutupCount > 0);
      if (window.analisisFilter === "pending") filtered = filtered.filter(c => c.pendingCount > 0);
      if (window.analisisFilter === "putus")   filtered = filtered.filter(c => c.putusCount > 0);
      if (window.analisisFilter === "catatan") filtered = filtered.filter(c => !!c.catatan);
      if (key) filtered = filtered.filter(x => x.name.toLowerCase().includes(key));

      const g  = filtered.filter(x => x.status === "green");
      const y  = filtered.filter(x => x.status === "yellow");
      const r  = filtered.filter(x => x.status === "red");
      const gr = filtered.filter(x => x.status === "grey");

      document.getElementById("totalCustomer").textContent = filtered.length;
      document.getElementById("greenCount").textContent  = g.length;
      document.getElementById("yellowCount").textContent = y.length;
      document.getElementById("redCount").textContent    = r.length;

      container.innerHTML = `
        <div class="analisis-horizontal">
          ${createGroup("🟢 Produktif", "green", g)}
          ${createGroup("🟡 Stabil", "yellow", y)}
          ${createGroup("🔴 Non Produktif", "red", r)}
          ${gr.length > 0 ? createGroup("⚪ Belum Ada Data", "grey", gr) : ""}
        </div>
      `;
    }

    render();

    const searchInput = document.getElementById("customerSearch");
    searchInput.addEventListener("input", e => render(e.target.value));

    document.querySelectorAll(".analisis-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const isActive = chip.classList.contains("active");
        document.querySelectorAll(".analisis-chip").forEach(c => c.classList.remove("active"));
        if (isActive) {
          window.analisisFilter = "default";
        } else {
          chip.classList.add("active");
          window.analisisFilter = chip.dataset.filter;
        }
        render(searchInput.value);
      });
    });

  } catch(err) {
    console.log("initAnalisisView error:", err);
    container.innerHTML = `<div class="analisis-empty">Gagal memuat data</div>`;
  }
};

function buildAnalisisPeriodeDropdown(maxPeriode) {
  const dd    = document.getElementById("analisisPeriodeDropdown");
  const btn   = document.getElementById("analisisPeriodeBtn");
  const label = document.getElementById("analisisPeriodeLabel");
  if (!dd || !btn || !label) return;

  if (!window.analisisPeriode || window.analisisPeriode > maxPeriode) window.analisisPeriode = 1;

  dd.innerHTML = Array.from({length: maxPeriode}, (_,i)=>i+1).map(p => `
    <div class="analisis-periode-option ${p === window.analisisPeriode ? "selected" : ""}" data-periode="${p}">
      T-${p} · ${p} Minggu Terakhir
    </div>`).join("");
  label.textContent = `T-${window.analisisPeriode}`;

  btn.onclick = e => {
    e.stopPropagation();
    dd.style.display = dd.style.display === "none" ? "block" : "none";
  };
  document.addEventListener("click", () => { dd.style.display = "none"; });

  dd.querySelectorAll(".analisis-periode-option").forEach(opt => {
    opt.addEventListener("click", e => {
      e.stopPropagation();
      window.analisisPeriode = Number(opt.dataset.periode);
      label.textContent = `T-${window.analisisPeriode}`;
      dd.querySelectorAll(".analisis-periode-option").forEach(o=>o.classList.remove("selected"));
      opt.classList.add("selected");
      dd.style.display = "none";
      window.initAnalisisView();
    });
  });
}

function escAnalisis(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

async function showAnalisisInfoPopup() {
  document.getElementById("analisisInfoOverlay")?.remove();

  const idCabang = window.currentUser?.idCabang || "";
  const tri = await loadTrikotomiSettingAnalisis(idCabang);
  const rp = tri.produktif.return, ep = tri.produktif.expired;
  const rs = tri.stabil.return,    es = tri.stabil.expired;
  const rn = tri.nonProduktif.return, en = tri.nonProduktif.expired;

  const fmtRange = (min, max) => max >= 9999 ? `${min}+` : (min === max ? `${min}` : `${min}-${max}`);

  const el = document.createElement("div");
  el.id = "analisisInfoOverlay";
  el.className = "analisis-info-overlay";
  el.innerHTML = `
    <div class="analisis-info-box">
      <div class="analisis-info-header">
        <div class="analisis-info-title">Cara Kerja Analisa Trikotomi</div>
        <button class="analisis-info-close" id="analisisInfoCloseBtn"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="analisis-info-body">

        <div class="analisis-info-section">
          <div class="analisis-info-section-icon blue"><i class="fa-solid fa-calculator"></i></div>
          <div class="analisis-info-section-text">
            <div class="analisis-info-section-title">Apa yang dihitung?</div>
            <div class="analisis-info-section-desc">
              Tiap customer dicek 2 angka dalam periode yang dipilih: total <b>Return</b> dan total <b>Expired</b>.
              Sistem melihat kategori masing-masing angka, lalu <b>mengambil yang paling buruk</b> di antara keduanya sebagai hasil akhir.
            </div>
          </div>
        </div>

        <div class="analisis-info-section">
          <div class="analisis-info-section-icon green"><i class="fa-solid fa-circle-check"></i></div>
          <div class="analisis-info-section-text">
            <div class="analisis-info-section-title">🟢 Produktif</div>
            <div class="analisis-info-section-desc">
              Return <b>${fmtRange(rp.min, rp.max)}</b> dan Expired <b>${fmtRange(ep.min, ep.max)}</b>.
              Customer ini jalan lancar, hampir tidak ada barang balik atau kadaluarsa.
            </div>
          </div>
        </div>

        <div class="analisis-info-section">
          <div class="analisis-info-section-icon yellow"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div class="analisis-info-section-text">
            <div class="analisis-info-section-title">🟡 Stabil</div>
            <div class="analisis-info-section-desc">
              Return <b>${fmtRange(rs.min, rs.max)}</b> atau Expired <b>${fmtRange(es.min, es.max)}</b>.
              Masih wajar, tapi perlu dipantau. Customer juga masuk sini kalau statusnya Tutup/Pending
              sebanyak <b>1-2 hari</b> dalam periode ini.
            </div>
          </div>
        </div>

        <div class="analisis-info-section">
          <div class="analisis-info-section-icon red"><i class="fa-solid fa-circle-xmark"></i></div>
          <div class="analisis-info-section-text">
            <div class="analisis-info-section-title">🔴 Non Produktif</div>
            <div class="analisis-info-section-desc">
              Return <b>${fmtRange(rn.min, rn.max)}</b> atau Expired <b>${fmtRange(en.min, en.max)}</b>.
              Banyak barang balik/kadaluarsa, perlu perhatian khusus. Customer juga otomatis masuk sini
              kalau statusnya Tutup/Pending sudah <b>3 hari atau lebih</b> dalam periode ini, atau kalau statusnya
              pernah <b>Putus</b> minimal 1 hari — meski Return/Expired-nya sendiri rendah.
            </div>
          </div>
        </div>

        <div class="analisis-info-section">
          <div class="analisis-info-section-icon grey"><i class="fa-solid fa-circle-question"></i></div>
          <div class="analisis-info-section-text">
            <div class="analisis-info-section-title">⚪ Belum Ada Data</div>
            <div class="analisis-info-section-desc">
              Customer ini belum pernah diinput datanya sama sekali di semua tanggal periode yang dipilih (T-1, T-2, dst).
            </div>
          </div>
        </div>

        <div class="analisis-info-section">
          <div class="analisis-info-section-icon blue"><i class="fa-solid fa-calendar-week"></i></div>
          <div class="analisis-info-section-text">
            <div class="analisis-info-section-title">Soal Periode (T-1, T-2, dst)</div>
            <div class="analisis-info-section-desc">
              T-1 artinya cuma lihat 1 minggu terakhir. T-3 artinya menggabungkan 3 minggu terakhir
              (kalau kurang dari 3 minggu di bulan ini, otomatis nyambung ke bulan sebelumnya).
              Semakin besar periode, semakin akurat gambaran jangka panjangnya.
            </div>
          </div>
        </div>

      </div>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));

  document.getElementById("analisisInfoCloseBtn").onclick = () => el.classList.remove("show");
  el.onclick = e => { if (e.target === el) el.classList.remove("show"); };
}

document.getElementById("analisisInfoBtn")?.addEventListener("click", showAnalisisInfoPopup);
window.aktifkanBadgeTrikotomi = async function() {
  const btn = document.getElementById("btnAktifkanBadge");
  if (!btn || btn.disabled) return;

  // Loading
  btn.disabled = true;
  btn.classList.add("loading");
  btn.innerHTML = `
    <span style="
      display:inline-block;
      width:16px;
      height:16px;
      border:2.5px solid #fff;
      border-top-color:transparent;
      border-radius:50%;
      animation:spin .7s linear infinite;
    "></span>
  `;

  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    // Ambil hasil klasifikasi dari memory
    // window._trikotomiResult disimpan saat render analisis
    const result = window._trikotomiResult || {};

    if (Object.keys(result).length === 0) {
      throw new Error("Belum ada data klasifikasi");
    }

    // Simpan ke IndexedDB supaya persist
    const db = await window.openAppDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("usersDB", "readwrite");
      const store = tx.objectStore("usersDB");
      const uid = window.auth.currentUser?.uid;
      const req = store.get(uid);
      req.onsuccess = () => {
        const existing = req.result || { id: uid, data: {} };
        existing.trikotomiResult = result;
        existing.trikotomiUpdatedAt = Date.now();
        store.put(existing);
        resolve();
      };
      req.onerror = () => reject(req.error);
    });

    // Simpan ke window global supaya input view bisa baca
    window.trikotomiResult = result;

    // Success state
    btn.classList.remove("loading");
    btn.classList.add("success");
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;

    // Tooltip sukses
    const tooltip = document.createElement("div");
    tooltip.className = "analisis-aktifkan-tooltip";
    tooltip.innerText = "✓ Badge aktif di Input";
    btn.appendChild(tooltip);

    setTimeout(() => {
      tooltip.remove();
      btn.classList.remove("success");
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
      btn.disabled = false;
    }, 2000);

  } catch(err) {
    console.log("Aktifkan badge error:", err);
    btn.classList.remove("loading");
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    btn.disabled = false;
  }
};
