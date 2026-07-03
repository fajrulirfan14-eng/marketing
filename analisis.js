window.initAnalisisView = async function(){

  document.body.style.overscrollBehavior = "none";
  document.documentElement.style.overscrollBehavior = "none";

  const container = document.getElementById("accordionContainer");
  const today = new Date().toISOString().split("T")[0];
  const uid = window.auth.currentUser?.uid;

  container.innerHTML = `<div class="analisis-loading">Memuat data...</div>`;

  try {
    const db = await window.openAppDB();

    // =========================
    // 1. LOAD CUSTOMER LIST
    // =========================
    const allCustomerRaw = await new Promise((resolve, reject) => {
      const tx = db.transaction("customerHarianDB", "readonly");
      const store = tx.objectStore("customerHarianDB");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    // Ambil hari aktif
    const hariNama = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    const hariAktif = hariNama[new Date().getDay()];

    // Flatten semua customer
    let customerList = [];
    allCustomerRaw.forEach(item => {
      if (Array.isArray(item.data)) {
        customerList.push(...item.data);
      }
    });

    // Filter hanya hari aktif
    customerList = customerList.filter(x => x.hari === hariAktif);

    // Dedupe by idCustomer
    const seen = new Set();
    customerList = customerList.filter(x => {
      const cid = x.idCustomer || x.id;
      if (!cid || seen.has(cid)) return false;
      seen.add(cid);
      return true;
    });

    const customerIds = customerList.map(x => x.idCustomer || x.id);

    // =========================
    // 2. LOAD dataHarianDB
    // =========================
    let allDataHarian = await new Promise((resolve, reject) => {
      const tx = db.transaction("dataHarianDB", "readonly");
      const store = tx.objectStore("dataHarianDB");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    // Filter: hanya sebelum hari ini & idCustomer ada di list
    let filtered = allDataHarian.filter(x =>
      x.tanggal &&
      x.tanggal < today &&
      customerIds.includes(x.idCustomer)
    );

    // Kalau IDB kosong → fetch Firestore tanggal minggu lalu (hari yang sama)
    console.log("[analisis] filtered dari IDB:", filtered.length);
    if (filtered.length === 0 && navigator.onLine && uid) {
      try {
        const mingguLalu = new Date();
        mingguLalu.setDate(mingguLalu.getDate() - 7);
        const tanggalMingguLalu = mingguLalu.toISOString().split("T")[0];
        console.log("[analisis] fetch Firestore tanggal:", tanggalMingguLalu);

        const snap = await window.getDocs(window.query(
          window.collectionGroup(window.db, "dataHarian"),
          window.where("pemilik", "==", uid),
          window.where("tanggal", "==", tanggalMingguLalu)
        ));
        console.log("[analisis] docs dari Firestore:", snap.docs.length);

        if (!snap.empty) {
          const records = snap.docs.map(d => d.data());

          // Simpan ke IDB dalam 1 transaction
          await new Promise((resolve, reject) => {
            const tx    = db.transaction("dataHarianDB", "readwrite");
            const store = tx.objectStore("dataHarianDB");
            records.forEach(record => {
              if (!record.idCustomer || !record.tanggal) return;
              const idKey = `${record.idCustomer}_${record.tanggal}`;
              store.put({
                ...record,
                id: idKey,
                tanggal: record.tanggal,
                idCustomer: record.idCustomer,
                payload: record,
                isSync: true,
                updatedAt: Date.now()
              });
            });
            tx.oncomplete = () => resolve();
            tx.onerror    = () => reject(tx.error);
          });

          // Update filtered dari hasil fetch
          filtered = records.filter(x =>
            x.tanggal && customerIds.includes(x.idCustomer)
          );
        }
      } catch { }
    }

    // Ambil record terbaru per customer
    const latestMap = {};
    filtered.forEach(x => {
      const cid = x.idCustomer;
      if (!latestMap[cid] || x.tanggal > latestMap[cid].tanggal) {
        latestMap[cid] = x;
      }
    });

    // =========================
    // 3. LOAD TRIKOTOMI DARI KANTORDB
    // =========================
    const user = window.currentUser || {};
    const kantorRaw = await new Promise((resolve) => {
      const tx = db.transaction("kantorDB", "readonly");
      const store = tx.objectStore("kantorDB");
      const req = store.get(user.idCabang || "");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    const kantorData = kantorRaw?.data || kantorRaw || {};
    const trikotomi = kantorData?.trikotomi || null;

    // Default trikotomi kalau tidak ada di kantorDB
    const tri = {
      produktif: {
        return: { min: 0, max: 1 },
        expired: { min: 0, max: 0 }
      },
      stabil: {
        return: { min: 2, max: 2 },
        expired: { min: 0, max: 1 }
      },
      nonProduktif: {
        return: { min: 3, max: 9999 },
        expired: { min: 2, max: 9999 }
      },
      ...trikotomi
    };

    // =========================
    // 4. KLASIFIKASI
    // =========================
    function inRange(val, min, max) {
      return val >= min && val <= max;
    }

    function getKategori(val, field) {
      // Cek produktif dulu (terbaik)
      if (inRange(val, tri.produktif[field].min, tri.produktif[field].max)) return 1;
      // Baru stabil
      if (inRange(val, tri.stabil[field].min, tri.stabil[field].max)) return 2;
      // Baru nonProduktif
      if (inRange(val, tri.nonProduktif[field].min, tri.nonProduktif[field].max)) return 3;
      return 0;
    }

    function kategoriToStatus(k) {
      if (k === 3) return "red";
      if (k === 2) return "yellow";
      if (k === 1) return "green";
      return "grey";
    }

    function classifyCustomer(dataHarian) {
      const returnTotal = Object.values(dataHarian?.return || {})
        .reduce((sum, v) => sum + Number(v || 0), 0);

      const expiredTotal = Object.values(dataHarian?.expired || {})
        .reduce((sum, v) => sum + Number(v || 0), 0);

      // Cek masing-masing field → dapat skor kategori
      const returnKategori  = getKategori(returnTotal, "return");
      const expiredKategori = getKategori(expiredTotal, "expired");

      // Ambil yang terburuk (angka terbesar)
      const worst = Math.max(returnKategori, expiredKategori);

      return kategoriToStatus(worst);
    }

    // =========================
    // 5. BUILD DATA CUSTOMER
    // =========================
    const customers = customerList.map(c => {
      const cid = c.idCustomer || c.id;
      const dataHarian = latestMap[cid] || null;

      const returnTotal = Object.values(dataHarian?.return || {})
        .reduce((sum, v) => sum + Number(v || 0), 0);
      const expiredTotal = Object.values(dataHarian?.expired || {})
        .reduce((sum, v) => sum + Number(v || 0), 0);
      const closingTotal = Object.values(dataHarian?.closing || {})
        .reduce((sum, v) => sum + Number(v || 0), 0);

      return {
        id: cid,
        name: c.namaCustomer || "-",
        tanggal: dataHarian?.tanggal || null,
        returnTotal,
        expiredTotal,
        closingTotal,
        status: dataHarian ? classifyCustomer(dataHarian) : "grey"
      };
    });

    const green  = customers.filter(x => x.status === "green");
    const yellow = customers.filter(x => x.status === "yellow");
    const red    = customers.filter(x => x.status === "red");
    const grey   = customers.filter(x => x.status === "grey");
    window._trikotomiResult = {};
    customers.forEach(c => {
      window._trikotomiResult[c.id] = c.status;
    });

    document.getElementById("totalCustomer").textContent = customers.length;
    document.getElementById("greenCount").textContent  = green.length;
    document.getElementById("yellowCount").textContent = yellow.length;
    document.getElementById("redCount").textContent    = red.length;

    // =========================
    // 6. RENDER
    // =========================
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
                  <div>
                    <div class="customer-name">${c.name}</div>
                    <div class="customer-detail">
                      Return: ${c.returnTotal} •
                      Expired: ${c.expiredTotal} •
                      Closing: ${c.closingTotal}
                    </div>
                    <div class="customer-detail">
                      ${c.tanggal
                        ? `Data: ${c.tanggal}`
                        : `Belum ada data`}
                    </div>
                  </div>
                  <div class="customer-score ${color}">
                    ${c.returnTotal + c.expiredTotal}
                  </div>
                </div>
              `).join("")
            }
          </div>
        </div>
      `;
    }

    function render(keyword = "") {
      const key = keyword.toLowerCase();
      const f = arr => arr.filter(x => x.name.toLowerCase().includes(key));

      container.innerHTML = `
        <div class="analisis-horizontal">
          ${createGroup("🟢 Produktif", "green", f(green))}
          ${createGroup("🟡 Stabil", "yellow", f(yellow))}
          ${createGroup("🔴 Non Produktif", "red", f(red))}
          ${grey.length > 0 ? createGroup("⚪ Belum Ada Data", "grey", f(grey)) : ""}
        </div>
      `;
    }

    render();

    const searchInput = document.getElementById("customerSearch");
    searchInput.addEventListener("input", e => render(e.target.value));

  } catch(err) {
    console.log("initAnalisisView error:", err);
    container.innerHTML = `<div class="analisis-empty">Gagal memuat data</div>`;
  }
};
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
