// INIT VIEW (FINAL CLEAN)
window.initOperasionalView = async function () {
  const list = document.getElementById("operasionalList");
  if (!list) return;
  const bulanNama = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember"
  ];
  const textFilter = document.getElementById("operasionalFilterText");
  if (textFilter) {
    textFilter.textContent =
      `${bulanNama[window.operasionalFilter.bulan]} ${window.operasionalFilter.tahun}`;
  }
  const hariNama = [
    "Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"
  ];

  const dummy = [];
  const year = window.operasionalFilter.tahun;
  const month = window.operasionalFilter.bulan;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const hari = hariNama[date.getDay()];
    const bulan = bulanNama[month];
    dummy.push({
      tanggal: `${hari}, ${d} ${bulan} ${year}`,
      omzet: "0",
      kasbon: 0,
      potongan: "0",
      bonus: 0
    });
  }

  // Preload semua data dari IndexedDB laporanMarketingDB
  let laporanMap = {};
  try {
    const idb = await window.openAppDB();
    const allLaporan = await new Promise((resolve, reject) => {
      const tx = idb.transaction("laporanMarketingDB", "readonly");
      const store = tx.objectStore("laporanMarketingDB");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    allLaporan.forEach(item => {
      laporanMap[item.id] = item;
    });
  } catch { }
  list.innerHTML = dummy.map((item, index) => {
  
    const today = new Date();
    const currentDate = new Date(year, month, index + 1);
    
    const isActive =
      currentDate <= new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const hari = index + 1;

    // Ambil data dari IDB jika ada
    const day = String(index + 1).padStart(2, "0");
    const monthStr = String(month + 1).padStart(2, "0");
    const tanggalId = `${year}-${monthStr}-${day}`;
    const d = laporanMap[tanggalId] || null;

    const omzet   = d ? Number(d?.distribusi?.keuangan?.inputOmset || 0).toLocaleString("id-ID") : "0";
    const kasbon  = d ? Number(d?.distribusi?.keuangan?.Kasbon || 0).toLocaleString("id-ID") : "0";
    const potongan = d ? Number(d?.distribusi?.infoTarget?.potongan?.jumlahPotongan || 0).toLocaleString("id-ID") : "0";
    const bonus   = d ? Number(d?.distribusi?.keuangan?.bonus?.jumlahBonus || 0).toLocaleString("id-ID") : "0";
  
    return `
      <div class="op-item ${isActive ? "active" : ""}">
  
        <!-- LEFT TIMELINE -->
        <div class="op-timeline">
          <div class="op-circle">
            ${hari}
          </div>
          <div class="op-line"></div>
        </div>
  
        <!-- RIGHT CARD -->
        <div class="operasional-card" onclick="toggleOperasionalCard(${index}, this)">
  
          <div class="operasional-card-date">
            ${item.tanggal}
          </div>
  
          <div class="operasional-card-grid">
            <div class="operasional-box omzet">
              <div class="operasional-box-label">Omset</div>
              <div class="operasional-box-value">${omzet}</div>
            </div>
  
            <div class="operasional-box kasbon">
              <div class="operasional-box-label">Kasbon</div>
              <div class="operasional-box-value">${kasbon}</div>
            </div>
  
            <div class="operasional-box potongan">
              <div class="operasional-box-label">Potongan</div>
              <div class="operasional-box-value">${potongan}</div>
            </div>
  
            <div class="operasional-box bonus">
              <div class="operasional-box-label">Bonus</div>
              <div class="operasional-box-value">${bonus}</div>
            </div>
          </div>
  
        </div>
  
      </div>
    `;
  }).join("");
  window.operasionalDummyData = dummy;
  window.operasionalLaporanMap = laporanMap;
};
window.toggleOperasionalCard = function(index, el) {

  const data = window.operasionalDummyData?.[index];
  if (!data) return;

  const isActive =
    el.classList.contains("active");

  const hasDetail =
    !!el.querySelector(".operasional-detail");

  // =====================
  // KLIK PERTAMA
  // =====================
  if (!isActive) {

    document
      .querySelectorAll(".operasional-card")
      .forEach(card => {

        card.classList.remove("active");

        card
          .querySelector(".operasional-detail")
          ?.remove();

      });

    el.classList.add("active");
    return;
  }

  if (isActive && !hasDetail) {
    const day = String(index + 1).padStart(2, "0");
    const month = String(window.operasionalFilter.bulan + 1).padStart(2, "0");
    const year = window.operasionalFilter.tahun;
    const tanggalId = `${year}-${month}-${day}`;
    const d = window.operasionalLaporanMap?.[tanggalId] || null;

    const detailHTML = `
      <div class="operasional-detail">
        <div class="operasional-detail-title">Keterangan Lengkap</div>
        <div class="operasional-detail-columns">
          <div class="operasional-col kiri">
            ${buildKiriHTML(d)}
          </div>
          <div class="operasional-col kanan">
            ${buildKananHTML(d)}
          </div>
        </div>
        <div class="operasional-detail-divider"></div>
        <div class="operasional-detail-bottom">
          <div class="operasional-bottom-item">
            <span class="operasional-bottom-label">Jumlah Upah</span>
            <span class="operasional-bottom-value" id="jumlahUpahEl_${index}">-</span>
          </div>
        </div>
      </div>
    `;

    el.insertAdjacentHTML("beforeend", detailHTML);

    // Isi jumlah upah dari cache dulu
    buildJumlahUpah(d).then(val => {
      const upahEl = document.getElementById(`jumlahUpahEl_${index}`);
      if (upahEl) upahEl.innerText = val;
    });

    // Auto fetch Firestore saat expand
    if (navigator.onLine) {
      (async () => {
        try {
          const uid = window.auth.currentUser?.uid;
          if (!uid) return;

          const day2    = String(index + 1).padStart(2, "0");
          const month2  = String(window.operasionalFilter.bulan + 1).padStart(2, "0");
          const year2   = window.operasionalFilter.tahun;
          const tanggalId = `${year2}-${month2}-${day2}`;

          const docRef = window.doc(window.db, "users", uid, "laporanMarketing", tanggalId);
          const snap   = await window.getDoc(docRef);
          if (!snap.exists()) return;

          const fresh = snap.data();

          // Simpan ke IDB
          const idb = await window.openAppDB();
          await new Promise((resolve, reject) => {
            const tx    = idb.transaction("laporanMarketingDB", "readwrite");
            const store = tx.objectStore("laporanMarketingDB");
            store.put({ id: tanggalId, tanggal: tanggalId, idMarketing: uid, ...fresh, cachedAt: Date.now() });
            tx.oncomplete = () => resolve();
            tx.onerror    = () => reject(tx.error);
          });

          // Update memory
          if (!window.operasionalLaporanMap) window.operasionalLaporanMap = {};
          window.operasionalLaporanMap[tanggalId] = { id: tanggalId, tanggal: tanggalId, idMarketing: uid, ...fresh, cachedAt: Date.now() };

          // Re-render detail
          const detailEl = el.querySelector(".operasional-detail");
          if (detailEl) {
            const kiriEl  = detailEl.querySelector(".operasional-col.kiri");
            const kananEl = detailEl.querySelector(".operasional-col.kanan");
            if (kiriEl)  kiriEl.innerHTML  = buildKiriHTML(window.operasionalLaporanMap[tanggalId]);
            if (kananEl) kananEl.innerHTML = buildKananHTML(window.operasionalLaporanMap[tanggalId]);
          }

          // Update jumlah upah
          const upahEl = document.getElementById(`jumlahUpahEl_${index}`);
          if (upahEl) {
            buildJumlahUpah(window.operasionalLaporanMap[tanggalId]).then(val => {
              upahEl.innerText = val;
            });
          }

          // Update card summary
          const omzet    = Number(fresh?.distribusi?.keuangan?.inputOmset || 0).toLocaleString("id-ID");
          const kasbon   = Number(fresh?.distribusi?.keuangan?.Kasbon || 0).toLocaleString("id-ID");
          const potongan = Number(fresh?.distribusi?.infoTarget?.potongan?.jumlahPotongan || 0).toLocaleString("id-ID");
          const bonus    = Number(fresh?.distribusi?.keuangan?.bonus?.jumlahBonus || 0).toLocaleString("id-ID");

          el.querySelector(".operasional-box.omzet .operasional-box-value").innerText   = omzet;
          el.querySelector(".operasional-box.kasbon .operasional-box-value").innerText  = kasbon;
          el.querySelector(".operasional-box.potongan .operasional-box-value").innerText = potongan;
          el.querySelector(".operasional-box.bonus .operasional-box-value").innerText   = bonus;

        } catch { }
      })();
    }

    return;
  }

  // KLIK KETIGA
  el
    .querySelector(".operasional-detail")
    ?.remove();

};
async function buildJumlahUpah(d) {
  try {
    let upahHarian = 0;

    // Coba dari globalKantor dulu
    if (window.globalKantor?.upahHarian) {
      upahHarian = Number(window.globalKantor.upahHarian || 0);
    } else {
      // Fallback baca dari IndexedDB kantorDB
      try {
        const user = window.currentUser || {};
        const idb = await window.openAppDB();
        const kantorRaw = await new Promise((resolve) => {
          const tx = idb.transaction("kantorDB", "readonly");
          const store = tx.objectStore("kantorDB");
          const req = store.get(user.idCabang || "");
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });
        const kantorData = kantorRaw?.data || kantorRaw || {};
        upahHarian = Number(kantorData?.upahHarian || 0);
      } catch { }
    }

    const bonus = Number(d?.distribusi?.keuangan?.bonus?.jumlahBonus || 0);
    const potongan = Number(d?.distribusi?.infoTarget?.potongan?.jumlahPotongan || 0);
    const total = upahHarian + bonus - potongan;

    return total.toLocaleString("id-ID");
  } catch { return "-"; }
}
function buildKiriHTML(d) {
  // ORDER
  const order = d?.order || {};
  const orderKeys = Object.keys(order);
  const orderJumlah = orderKeys.reduce((sum, k) => sum + Number(order[k] || 0), 0);

  let orderHTML = orderKeys.length
    ? orderKeys.map(k => `<div class="op-row"><span>${k}</span><span>${Number(order[k] || 0).toLocaleString("id-ID")}</span></div>`).join("")
    : `<div class="op-empty">-</div>`;

  // CLOSING
  const closing = d?.pembayaran?.closing || {};
  const closingKeys = Object.keys(closing).filter(k => k !== "createdAt");
  const closingJumlah = closingKeys.reduce((sum, k) => sum + Number(closing[k] || 0), 0);

  let closingHTML = closingKeys.length
    ? closingKeys.map(k => `<div class="op-row"><span>${k}</span><span>${Number(closing[k] || 0).toLocaleString("id-ID")}</span></div>`).join("")
    : `<div class="op-empty">-</div>`;

  // PAY (exclude margin)
  const pay = d?.distribusi?.pay || {};
  const payKeys = Object.keys(pay).filter(k => k.toLowerCase() !== "margin");
  const payJumlah = payKeys.reduce((sum, k) => sum + Number(pay[k] || 0), 0);

  let payHTML = payKeys.length
    ? payKeys.map(k => `<div class="op-row"><span>${k}</span><span>${Number(pay[k] || 0).toLocaleString("id-ID")}</span></div>`).join("")
    : `<div class="op-empty">-</div>`;

  // EXPIRED
  const expired = d?.distribusi?.expired || {};
  const expiredKeys = Object.keys(expired).filter(k => k.toLowerCase() !== "margin");
  const expiredJumlah = expiredKeys.reduce((sum, k) => sum + Number(expired[k] || 0), 0);
  const expiredPersen = payJumlah > 0
    ? Math.round((expiredJumlah / payJumlah) * 100) + "%"
    : "0%";

  let expiredHTML = expiredKeys.length
    ? expiredKeys.map(k => `<div class="op-row"><span>${k}</span><span>${Number(expired[k] || 0).toLocaleString("id-ID")}</span></div>`).join("")
    : `<div class="op-empty">-</div>`;

  return `
    <div class="op-section">
      <div class="op-section-title">Order</div>
      ${orderHTML}
      <div class="op-row total"><span>Jumlah</span><span>${orderJumlah.toLocaleString("id-ID")}</span></div>
    </div>

    <div class="op-section">
      <div class="op-section-title">Closing</div>
      ${closingHTML}
      <div class="op-row total"><span>Jumlah</span><span>${closingJumlah.toLocaleString("id-ID")}</span></div>
    </div>

    <div class="op-section">
      <div class="op-section-title">Pay</div>
      ${payHTML}
      <div class="op-row total"><span>Jumlah</span><span>${payJumlah.toLocaleString("id-ID")}</span></div>
    </div>

    <div class="op-section">
      <div class="op-section-title">Expired</div>
      ${expiredHTML}
      <div class="op-row total"><span>Jumlah</span><span>${expiredJumlah.toLocaleString("id-ID")}</span></div>
      <div class="op-row total"><span>Persentase</span><span>${expiredPersen}</span></div>
    </div>
  `;
}

function buildKananHTML(d) {
  const info = d?.distribusi?.infoTarget || {};
  const pot = info?.potongan || {};
  const bonus = d?.distribusi?.keuangan?.bonus || {};

  const rows = [
    ["Kunjungan", info.kunjungan ?? "-"],
    ["Target Customer", info.targetCustomer ?? "-"],
    ["Target Data", info.targetData ?? "-"],
    ["Potongan Target Customer", Number(pot.potonganTargetCustomer || 0).toLocaleString("id-ID")],
    ["Potongan Target Data", Number(pot.potonganTargetData || 0).toLocaleString("id-ID")],
    ["Total Potongan", Number(pot.jumlahPotongan || 0).toLocaleString("id-ID")],
    ["Bonus Insentif", Number(bonus.bonusInsentif || 0).toLocaleString("id-ID")],
    ["Bonus Kunjungan", Number(bonus.bonusKunjungan || 0).toLocaleString("id-ID")],
    ["Bonus Pay", Number(bonus.bonusPay || 0).toLocaleString("id-ID")],
  ];

  return rows.map(([label, value]) => `
    <div class="op-row-kanan">
      <span class="op-label-kanan">${label}</span>
      <span class="op-value-kanan">${value}</span>
    </div>
  `).join("");
}
window.operasionalFilter = {
  bulan: new Date().getMonth(),
  tahun: new Date().getFullYear()
};
window.tempFilterOperasional = {
  bulan: window.operasionalFilter.bulan,
  tahun: window.operasionalFilter.tahun
};

document.getElementById("btnFilterOperasional")?.addEventListener("click", function () {
  const popup = document.getElementById("popupFilterOperasional");
  const bulanNama = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember"
  ];
  window.tempFilterOperasional = {
    bulan: window.operasionalFilter.bulan,
    tahun: window.operasionalFilter.tahun
  };
  document.getElementById("textBulanOperasional").textContent = bulanNama[window.tempFilterOperasional.bulan];
  document.getElementById("textTahunOperasional").textContent = window.tempFilterOperasional.tahun;
  popup?.classList.add("active");
});
document.getElementById("btnPilihBulanOperasional")?.addEventListener("click", function () {
  const bulanNama = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember"
  ];
  const list = document.getElementById("listBulanOperasional");
  if (!list) return;
  list.innerHTML = bulanNama.map((bulan, index) => `
    <div class="popup-picker-item ${window.tempFilterOperasional.bulan === index ? "active" : ""}"
      onclick="
        window.tempFilterOperasional.bulan=${index};
        document.getElementById('textBulanOperasional').textContent='${bulan}';
        document.getElementById('popupPilihBulanOperasional').classList.remove('active');
      ">
      ${bulan}
    </div>
  `).join("");

  document.getElementById("popupPilihBulanOperasional")?.classList.add("active");
});
document.getElementById("btnPilihTahunOperasional")?.addEventListener("click", function () {
  const list = document.getElementById("listTahunOperasional");
  if (!list) return;
  list.innerHTML = "";
  const START_YEAR = 2026;
  const FUTURE_YEARS = 5;
  const now = new Date().getFullYear();
  const MAX_YEAR = now + FUTURE_YEARS;
  for (let y = MAX_YEAR; y >= START_YEAR; y--) {
    list.innerHTML += `
      <div class="popup-picker-item ${window.tempFilterOperasional.tahun === y ? "active" : ""}"
        onclick="
          window.tempFilterOperasional.tahun=${y};
          document.getElementById('textTahunOperasional').textContent='${y}';
          document.getElementById('popupPilihTahunOperasional').classList.remove('active');
        ">
        ${y}
      </div>
    `;
  }
  document.getElementById("popupPilihTahunOperasional")?.classList.add("active");
});
document.getElementById("btnApplyFilterOperasional")?.addEventListener("click", function () {
  window.operasionalFilter = {
    ...window.tempFilterOperasional
  };
  document.getElementById("popupFilterOperasional")?.classList.remove("active");
  window.initOperasionalView?.();
});
[
  "popupFilterOperasional",
  "popupPilihBulanOperasional",
  "popupPilihTahunOperasional"
].forEach(id => {
  document.getElementById(id)?.addEventListener("click", function (e) {
    if (e.target.id === id) {
      this.classList.remove("active");
    }
  });
});

(function () {
  const popupConfigs = {
    popupRollingCustomer: {
      content: "popupRollingCustomerContent",
      onClose: () => {
        window.rollingFotoBaru = null;
      }
    },
    popupFilterOperasional: {},
    popupPilihBulanOperasional: {},
    popupPilihTahunOperasional: {}
  };

  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let canSwipe = false;
  let activePopup = null;
  let activeContent = null;
  let activeConfig = null;

  document.addEventListener("touchstart",
    function (e) {
      const popup = e.target.closest(".popup-overlay.active");
      if (!popup) return;
      const popupId = popup.id;
      if (!popupConfigs[popupId]) {
        return;
      }
      const config = popupConfigs[popupId];
      const content = config.content ? document.getElementById(config.content)
          : popup.querySelector(".popup-content");
      if (!content) return;
      if (e.target.closest("input, textarea, select")) {
        canSwipe = false;
        return;
      }
      if (content.scrollTop > 0) {
        canSwipe = false;
        return;
      }
      activePopup = popup;
      activeContent = content;
      activeConfig = config;
      canSwipe = true;
      isDragging = true;
      startY = e.touches[0].clientY;
      currentY = startY;
      content.style.transition = "none";
    },
    { passive: true }
  );
  document.addEventListener("touchmove",
    function (e) {
      if (
        !isDragging ||
        !canSwipe ||
        !activeContent
      ) return;
      currentY = e.touches[0].clientY;
      const moveY = currentY - startY;
      if (moveY > 0) {
        activeContent.style.transform = `translateY(${moveY}px)`;
      }
    },
    { passive: true }
  );
  document.addEventListener("touchend",
    function () {
      if (
        !isDragging ||
        !canSwipe ||
        !activePopup ||
        !activeContent
      ) return;
      const moveY = currentY - startY;
      activeContent.style.transition = "0.25s ease";
      if (moveY > 120) {
        activeContent.style.transform = "translateY(100%)";
        setTimeout(() => {
          activePopup.classList.remove("active");
          activeContent.style.transform = "";
          activeConfig?.onClose?.();
          resetState();
        }, 220);
      } else {
        activeContent.style.transform =
          "";
        resetState();
      }
    }
  );
  function resetState() {
    isDragging = false;
    canSwipe = false;
    activePopup = null;
    activeContent = null;
    activeConfig = null;
  }
})();