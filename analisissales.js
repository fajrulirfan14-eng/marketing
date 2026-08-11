window.analisisSalesPeriode = 1;
window.analisisSalesFilter  = "default";

window.initAnalisisSalesView = async function(){

  document.body.style.overscrollBehavior = "none";
  document.documentElement.style.overscrollBehavior = "none";

  const container = document.getElementById("accordionContainerSales");
  const uid       = window.auth.currentUser?.uid;
  const idCabang  = window.currentUser?.idCabang || "";

  container.innerHTML = `<div class="analisis-loading">Memuat data...</div>`;

  try {
    const namaHari  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    const hariAktif = namaHari[new Date().getDay()];

    // ── PERIODE DROPDOWN ──
    const totalMingguBulanIni = getHariListAnalisis(hariAktif, new Date().getMonth(), new Date().getFullYear()).length;
    buildAnalisisSalesPeriodeDropdown(Math.max(totalMingguBulanIni, 1));

    // ── 1. LOAD CUSTOMER SALES (belum diserahkan) ──
    const custSnap = await window.getDocs(window.query(
      window.collection(window.db, "customerSales"),
      window.where("createdBy", "==", uid),
      window.where("idCabang",  "==", idCabang),
      window.where("hari",      "==", hariAktif),
      window.where("diserahkan","==", false)
    ));
    const customerList = custSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // ── 2. TANGGAL REFERENSI SESUAI PERIODE ──
    const refDates = getReferenceDatesAnalisis(window.analisisSalesPeriode);

    const subtitleEl = document.querySelector("#view-analisissales .analisis-header-subtitle");
    if (subtitleEl) {
      const refLabel = refDates.map(d => d.toLocaleDateString("id-ID", { day:"numeric", month:"short" })).join(" & ");
      subtitleEl.textContent = refLabel ? `Referensi: ${refLabel}` : "Belum ada data referensi";
    }

    // ── 3. FETCH inputHarian utk tiap tanggal referensi ──
    const refMaps = await Promise.all(refDates.map(async d => {
      const tglStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      try {
        const snap = await window.getDocs(window.query(
          window.collectionGroup(window.db, "inputHarian"),
          window.where("pemilik",  "==", uid),
          window.where("tanggal",  "==", tglStr),
          window.where("idCabang", "==", idCabang)
        ));
        const map = {};
        snap.forEach(docSnap => {
          const data  = docSnap.data();
          const custId = docSnap.ref.parent.parent.id;
          if (custId) map[custId] = data;
        });
        return map;
      } catch (err) {
        return {};
      }
    }));

    // ── 4. SETTING TRIKOTOMI (reuse punya kurir) ──
    const tri = await loadTrikotomiSettingAnalisis(idCabang);

    // ── 5. BUILD & KLASIFIKASI ──
    const customers = customerList.map(c => {
      const docs = refMaps.map(m => m[c.id]).filter(Boolean);

      let retTotal = 0, expTotal = 0, closingTotal = 0;
      if (docs.length) {
        if (window.analisisSalesPeriode === 1) {
          const dh = docs[0];
          retTotal     = Object.values(dh.return  || {}).reduce((a,v)=>a+(Number(v)||0),0);
          expTotal     = Object.values(dh.expired || {}).reduce((a,v)=>a+(Number(v)||0),0);
          closingTotal = Object.values(dh.closing || {}).reduce((a,v)=>a+(Number(v)||0),0);
        } else {
          const sums = docs.map(dh => ({
            r: Object.values(dh.return  || {}).reduce((a,v)=>a+(Number(v)||0),0),
            e: Object.values(dh.expired || {}).reduce((a,v)=>a+(Number(v)||0),0),
            c: Object.values(dh.closing || {}).reduce((a,v)=>a+(Number(v)||0),0),
          }));
          retTotal     = Math.round(sums.reduce((a,s)=>a+s.r,0) / docs.length);
          expTotal     = Math.round(sums.reduce((a,s)=>a+s.e,0) / docs.length);
          closingTotal = Math.round(sums.reduce((a,s)=>a+s.c,0) / docs.length);
        }
      }

      const status = docs.length ? triKlasifikasiAnalisis(retTotal, expTotal, tri) : "grey";

      return {
        id: c.id,
        name: c.namaCustomer || "-",
        retTotal, expTotal, closingTotal,
        status,
        hasData: docs.length > 0
      };
    });

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

      if (window.analisisSalesFilter === "return")  filtered = filtered.filter(c => c.retTotal > 0);
      if (window.analisisSalesFilter === "expired") filtered = filtered.filter(c => c.expTotal > 0);
      if (key) filtered = filtered.filter(x => x.name.toLowerCase().includes(key));

      const g  = filtered.filter(x => x.status === "green");
      const y  = filtered.filter(x => x.status === "yellow");
      const r  = filtered.filter(x => x.status === "red");
      const gr = filtered.filter(x => x.status === "grey");

      document.getElementById("totalCustomerSales").textContent = filtered.length;
      document.getElementById("greenCountSales").textContent  = g.length;
      document.getElementById("yellowCountSales").textContent = y.length;
      document.getElementById("redCountSales").textContent    = r.length;

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

    const searchInput = document.getElementById("customerSearchSales");
    searchInput.addEventListener("input", e => render(e.target.value));

    document.querySelectorAll("#analisisSalesFilterChips .analisis-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const isActive = chip.classList.contains("active");
        document.querySelectorAll("#analisisSalesFilterChips .analisis-chip").forEach(c => c.classList.remove("active"));
        if (isActive) {
          window.analisisSalesFilter = "default";
        } else {
          chip.classList.add("active");
          window.analisisSalesFilter = chip.dataset.filter;
        }
        render(searchInput.value);
      });
    });

  } catch(err) {
    console.log("initAnalisisSalesView error:", err);
    container.innerHTML = `<div class="analisis-empty">Gagal memuat data</div>`;
  }
};

function buildAnalisisSalesPeriodeDropdown(maxPeriode) {
  const dd    = document.getElementById("analisisSalesPeriodeDropdown");
  const btn   = document.getElementById("analisisSalesPeriodeBtn");
  const label = document.getElementById("analisisSalesPeriodeLabel");
  if (!dd || !btn || !label) return;

  if (!window.analisisSalesPeriode || window.analisisSalesPeriode > maxPeriode) window.analisisSalesPeriode = 1;

  dd.innerHTML = Array.from({length: maxPeriode}, (_,i)=>i+1).map(p => `
    <div class="analisis-periode-option ${p === window.analisisSalesPeriode ? "selected" : ""}" data-periode="${p}">
      T-${p} · ${p} Minggu Terakhir
    </div>`).join("");
  label.textContent = `T-${window.analisisSalesPeriode}`;

  btn.onclick = e => {
    e.stopPropagation();
    dd.style.display = dd.style.display === "none" ? "block" : "none";
  };
  document.addEventListener("click", () => { dd.style.display = "none"; });

  dd.querySelectorAll(".analisis-periode-option").forEach(opt => {
    opt.addEventListener("click", e => {
      e.stopPropagation();
      window.analisisSalesPeriode = Number(opt.dataset.periode);
      label.textContent = `T-${window.analisisSalesPeriode}`;
      dd.querySelectorAll(".analisis-periode-option").forEach(o=>o.classList.remove("selected"));
      opt.classList.add("selected");
      dd.style.display = "none";
      window.initAnalisisSalesView();
    });
  });
}

document.getElementById("analisisSalesInfoBtn")?.addEventListener("click", () => {
  showAnalisisInfoPopup(); // reuse popup info kurir, isinya generik (gak nyebut kurir spesifik)
});