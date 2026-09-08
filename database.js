
// ── VIEW DATABASE CUSTOMER (list kurir + jumlah customer aktif, expand per hari) ──
window.initDatabaseView = async function () {
  const listEl = document.getElementById("databaseKurirList");
  if (!listEl) return;

  const idCabang = window.currentUser?.idCabang;
  if (!idCabang) {
    listEl.innerHTML = '<div class="database-empty">Data cabang tidak ditemukan.</div>';
    return;
  }

  const HARI_LIST = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

  listEl.innerHTML = `
    <div class="database-skeleton"><div class="sk-row" style="height:56px;border-radius:16px;"></div></div>
    <div class="database-skeleton"><div class="sk-row" style="height:56px;border-radius:16px;"></div></div>
    <div class="database-skeleton"><div class="sk-row" style="height:56px;border-radius:16px;"></div></div>
  `;

  try {
    // ── Ambil semua kurir di cabang yang sama ──
    const qKurir = window.query(
      window.collection(window.db, "users"),
      window.where("role", "==", "kurir"),
      window.where("idCabang", "==", idCabang)
    );
    const snapKurir = await window.getDocs(qKurir);
    const kurirList = snapKurir.docs.map((d) => ({ uid: d.id, ...d.data() }));

    if (!kurirList.length) {
      listEl.innerHTML = '<div class="database-empty">Belum ada kurir di cabang ini.</div>';
      return;
    }

    // ── Hitung total customer aktif per kurir (aggregation, paralel) ──
    const totalCounts = await Promise.all(
      kurirList.map(async (k) => {
        try {
          const qCount = window.query(
            window.collection(window.db, "customer"),
            window.where("pemilik", "==", k.uid),
            window.where("status", "==", true),
            window.where("idCabang", "==", idCabang)
          );
          const snap = await window.getCountFromServer(qCount);
          return snap.data().count || 0;
        } catch (e) {
          console.error("❌ count customer kurir:", k.uid, e);
          return 0;
        }
      })
    );

    listEl.innerHTML = kurirList
      .map(
        (k, i) => `
      <div class="database-kurir-item" data-uid="${k.uid}">
        <div class="database-kurir-header">
          <div class="database-kurir-info">
            <div class="database-kurir-avatar">${(k.nama || "?").charAt(0).toUpperCase()}</div>
            <div class="database-kurir-name">${k.nama || "-"}</div>
          </div>
          <div class="database-kurir-right">
            <div class="database-kurir-total">${totalCounts[i]}</div>
            <svg class="database-kurir-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
        </div>
        <div class="database-kurir-hari-list" id="databaseHari-${k.uid}"></div>
        <button class="database-map-btn" onclick="window.openDatabaseKurirMap('${k.uid}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 20l-6-3V4l6 3 6-3 6 3v13l-6-3-6 3z"/><path d="M9 4v13"/><path d="M15 7v13"/>
          </svg>
          Lihat Map
        </button>
      </div>
    `
      )
      .join("");

    // ── Pasang klik expand per kurir (lazy load breakdown per hari) ──
    kurirList.forEach((k) => {
      const itemEl = listEl.querySelector(`.database-kurir-item[data-uid="${k.uid}"]`);
      const headerEl = itemEl?.querySelector(".database-kurir-header");
      const hariEl = itemEl?.querySelector(".database-kurir-hari-list");
      if (!headerEl || !hariEl) return;

      let loaded = false;

      headerEl.addEventListener("click", async () => {
        const isOpen = itemEl.classList.contains("open");
        if (isOpen) {
          itemEl.classList.remove("open");
          return;
        }
        itemEl.classList.add("open");
        if (loaded) return;
        loaded = true;

        hariEl.innerHTML = HARI_LIST.map(
          (h) => `
          <div class="database-hari-row">
            <span class="database-hari-label">${h}</span>
            <span class="database-hari-value" data-hari="${h}">...</span>
          </div>
        `
        ).join("");

        await Promise.all(
          HARI_LIST.map(async (h) => {
            const valEl = hariEl.querySelector(`.database-hari-value[data-hari="${h}"]`);
            try {
              const qHari = window.query(
                window.collection(window.db, "customer"),
                window.where("pemilik", "==", k.uid),
                window.where("status", "==", true),
                window.where("idCabang", "==", idCabang),
                window.where("hari", "==", h)
              );
              const snap = await window.getCountFromServer(qHari);
              if (valEl) valEl.textContent = snap.data().count || 0;
            } catch (e) {
              console.error("❌ count customer per hari:", k.uid, h, e);
              if (valEl) valEl.textContent = "-";
            }
          })
        );
      });
    });
  } catch (err) {
    console.error("❌ initDatabaseView:", err);
    listEl.innerHTML = '<div class="database-empty">Gagal memuat data.</div>';
  }
};

// ── Buka map global, pin cuma customer aktif milik kurir tertentu ──
window.openDatabaseKurirMap = function (kurirUid) {
  try {
    localStorage.setItem("mapFilterUsers", JSON.stringify([kurirUid]));
    localStorage.setItem("mapFilterHari", JSON.stringify([]));
  } catch (e) {}

  window.openMapView();

  // Kalau map udah pernah dibuka sebelumnya (instance masih ada), paksa refresh pin
  setTimeout(() => {
    if (window._mapInstance && typeof window._mapRefreshPins === "function") {
      window._mapRefreshPins();
    }
  }, 150);
};
