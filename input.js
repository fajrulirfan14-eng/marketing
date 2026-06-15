// INIT VIEW
window.initInputView = async function(){
  if(window._inputViewCleanup){
    window._inputViewCleanup();
  }
  console.log("📝 Input View");
  const hariEl = document.getElementById("inputHari");
  const bawaEl = document.getElementById("inputBawaBarang");
  const listCustomerEl = document.getElementById("listCustomer");
  const inputDetailBtn = document.getElementById("inputDetailBtn");
  const popupHeaderDetailOverlay = document.getElementById("popupHeaderDetailOverlay");
  const popupHeaderDetailBody = document.getElementById("popupHeaderDetailBody");  
  const progressBarEl = document.getElementById("inputProgressBar");
  const progressToggleEl = document.getElementById("inputProgressToggle");
  const progressTextEl = document.getElementById("inputProgressText");
  const progressFillEl = document.getElementById("inputProgressFill");
  const searchCustomerEl = document.getElementById("inputSearchCustomer");
  const popupCatatanOverlay = document.getElementById("popupCatatanCustomer");
  const popupCatatanNama = document.getElementById("popupCatatanNama");
  const popupCatatanUpdate = document.getElementById("popupCatatanUpdate");
  const popupCatatanText = document.getElementById("popupCatatanText");
  const btnSimpanCatatan = document.getElementById("btnSimpanCatatan");
  const inputAnalysisBtn = document.getElementById("inputAnalysisBtn");
  const analysisDropdown = document.getElementById("analysisDropdown");
  const popupInputFdSheet = document.getElementById("popupInputFdSheet");
  const popupInputFdOverlay = document.getElementById("popupInputFdOverlay");
  const popupHeaderDetailSheet = document.getElementById("popupHeaderDetailSheet");
  
  // =========================
  // LOAD STATE DARI LOCALSTORAGE
  // =========================
  window.inputFilterMode = localStorage.getItem("inputFilterMode") || "all";
  window.inputTampilanBersih = localStorage.getItem("inputTampilanBersih") === "true";

  // Apply tampilan bersih saat load
  function applyTampilanBersih(bersih) {
    const styleId = "tampilan-bersih-style";
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    if (bersih) {
      styleEl.innerHTML = `
        .customer-badge,
        .customer-badge-new,
        .customer-note-badge,
        .input-customer-jarak { display: none !important; }
      `;
    } else {
      styleEl.innerHTML = "";
    }
  }

  applyTampilanBersih(window.inputTampilanBersih);

  // Bersihkan listener lama dulu supaya tidak numpuk
  const newAnalysisBtn = inputAnalysisBtn.cloneNode(true);
  inputAnalysisBtn.parentNode.replaceChild(newAnalysisBtn, inputAnalysisBtn);
  const inputAnalysisBtnClean = newAnalysisBtn;

  inputAnalysisBtnClean.addEventListener("click", (e) => {
    e.stopPropagation();
    analysisDropdown.classList.toggle("active");
  });

  if (window._analysisDocClickHandler) {
    document.removeEventListener("click", window._analysisDocClickHandler);
  }
  window._analysisDocClickHandler = function(e) {
    if (!e.target.closest("#analysisDropdown") && !e.target.closest("#inputAnalysisBtn")) {
      analysisDropdown.classList.remove("active");
    }
  };
  document.addEventListener("click", window._analysisDocClickHandler);

  document.querySelectorAll(".analysis-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = item.dataset.action;

      // Filter biasa — toggle
      if (["keterangan", "fee_disable", "penyesuaian", "produktif", "stabil", "non_produktif"].includes(action)) {
        window.inputFilterMode = window.inputFilterMode === action ? "all" : action;
        localStorage.setItem("inputFilterMode", window.inputFilterMode);
        updateFilterUI();
        renderCustomerList();
        // Tidak tutup dropdown
        return;
      }

      // Tampilan bersih/lengkap — bukan filter
      if (action === "tampilan") {
        window.inputTampilanBersih = !window.inputTampilanBersih;
        localStorage.setItem("inputTampilanBersih", window.inputTampilanBersih);
        applyTampilanBersih(window.inputTampilanBersih);
        updateFilterUI();
        // Tidak tutup dropdown
        return;
      }

      // Tampilan bersih/lengkap — bukan filter
      if (action === "tampilan") {
        window.inputTampilanBersih = !window.inputTampilanBersih;
        localStorage.setItem("inputTampilanBersih", window.inputTampilanBersih);
        applyTampilanBersih(window.inputTampilanBersih);
        updateFilterUI();
        return;
      }
    });
  });

  function updateFilterUI() {  
    document.querySelectorAll(".analysis-item").forEach(item => {  
      const action = item.dataset.action;  
  
      if (action === "tampilan") {  
        item.textContent = window.inputTampilanBersih
          ? "Tampilan Lengkap"
          : "Tampilan Bersih";
  
        // 🔥 INI YANG KURANG
        if (window.inputTampilanBersih) {
          item.classList.add("active");
        } else {
          item.classList.remove("active");
        }
  
        return;  
      }  
  
      if (window.inputFilterMode === action) {  
        item.classList.add("active");  
      } else {  
        item.classList.remove("active");  
      }  
    });  
  }
  updateFilterUI();
  let progressClosed = false;
  const hariNama = [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu"
  ];
  const now = new Date();
  const hariAktif = hariNama[now.getDay()];
  hariEl.innerText = hariAktif;
  try{
    const uid = window.auth.currentUser.uid;
    let userData = null;
    try {
      const db = await window.openAppDB();
      const tx = db.transaction("usersDB", "readonly");
      const store = tx.objectStore("usersDB");
      const req = store.get(uid);
      userData = await new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.log("IndexedDB error:", e);
    }
    if(!userData || !userData.data){
      if(navigator.onLine){
        try{
          const userRef = window.doc(window.db, "users", uid);
          const userSnap = await window.getDoc(userRef);
          if(!userSnap.exists()){
            bawaEl.innerHTML = `
              <div class="input-bawa-item expired">
                Data user tidak ditemukan
              </div>
            `;
            return;
          }
          const firestoreData = userSnap.data();
          const db = await window.openAppDB();
          const tx = db.transaction("usersDB","readwrite");
          const store = tx.objectStore("usersDB");
          store.put({
            id: uid,
            data: firestoreData
          });
          userData = {
            id: uid,
            data: firestoreData
          };
        } catch(err){
          console.log(err);
          bawaEl.innerHTML = `
            <div class="input-bawa-item expired">
              Gagal load user
            </div>
          `;
          return;
        }
      } else {
        bawaEl.innerHTML = `
          <div class="input-bawa-item expired">
            Offline & data belum tersedia
          </div>
        `;
        return;
      }
    }
    const data = userData.data || userData;
    const varian = data.varian || [];

    // Merge bawaBarang + varian supaya isAktif selalu ada
    const varianMap = {};
    varian.forEach(v => {
      const key = Object.keys(v)[0];
      if (key) varianMap[key] = v[key];
    });

    const rawBawaBarang = data.bawaBarang || [];
    const bawaBarang = rawBawaBarang.length > 0
      ? rawBawaBarang.map(item => {
          const key = Object.keys(item)[0];
          if (!key) return item;
          return { [key]: { ...varianMap[key], ...item[key] } };
        })
      : varian.map(v => {
          const key = Object.keys(v)[0];
          return { [key]: { ...v[key], bawa: 0 } };
        });

    // GLOBAL
    window.globalBawaBarang = bawaBarang;
    window.globalVarian = varian;
    try {
      const dbTri = await window.openAppDB();
      const triRaw = await new Promise(resolve => {
        const tx = dbTri.transaction("usersDB", "readonly");
        const store = tx.objectStore("usersDB");
        const req = store.get(uid);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (triRaw?.trikotomiResult) {
        window.trikotomiResult = triRaw.trikotomiResult;
        console.log("✅ trikotomiResult loaded:", Object.keys(window.trikotomiResult).length, "customer");
      }
    } catch(e) {
      console.log("Gagal load trikotomiResult:", e);
    }
    if(navigator.onLine){
      window.syncOfflineDataHarian?.();
      await window.syncCustomerHarian?.();
    }
    let isToday = false;
    const rawUpdate =
      userData?.data?.bawaBarangUpdate ||
      userData?.bawaBarangUpdate || null;

    if(rawUpdate?.seconds){
      const updateDate = new Date(rawUpdate.seconds * 1000);
      isToday = updateDate.toDateString() === now.toDateString();
    }
    let html = "";
    bawaBarang.forEach(item=>{
      Object.keys(item).forEach(key=>{
        const data = item[key];
        if(data?.isAktif === true){
          html += `
            <div class="input-bawa-item ${!isToday ? 'expired' : ''}">
              ${key}: ${
                data.bawa || 0
              }
            </div>
          `;
        }
      });
    });
    if(!html){
      html = `
        <div class="input-bawa-item">
          Belum ada barang aktif
        </div>
      `;
    }
    if(!isToday){
      html += `
        <div class="input-warning">
          ⚠ Bawa barang belum di perbarui,
          hubungi admin
        </div>
      `;
    }
    bawaEl.innerHTML = html;
    const db = await window.openAppDB();
    const tx = db.transaction("customerHarianDB", "readonly");
    const store = tx.objectStore("customerHarianDB");
    const customerSnap = await new Promise((resolve, reject) => {
      const cacheKey = `${uid}_${hariAktif}`;
      const req = store.get(cacheKey);
      req.onsuccess = function() {
        const raw = req.result;
        let allCustomers = [];

        if (raw && Array.isArray(raw.data)) {
          allCustomers = raw.data;
        }

        // FILTER HARI AKTIF (double check)
        allCustomers = allCustomers.filter(x => x.hari === hariAktif);

        // DEDUPE berdasarkan id
        const seen = new Set();
        allCustomers = allCustomers.filter(x => {
          const cid = x.idCustomer || x.id;
          if (seen.has(cid)) return false;
          seen.add(cid);
          return true;
        });
    
        resolve({
          empty: allCustomers.length === 0,
          docs: allCustomers.map(item => ({
            id: item.id,
            data: () => item
          }))
        });
      };
      req.onerror = function() { reject(req.error); };
    });
    console.log("Customer IndexedDB:", customerSnap);
    if(customerSnap.empty){
      listCustomerEl.innerHTML = `
        <div class="input-customer-empty">
          Belum ada customer
        </div>
      `;
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    function updateProgress(list){
      const done  = list.filter(x=>x.sudahInput).length;
      const total = list.length;
      progressTextEl.innerText   = `${done} / ${total} Toko`;
      progressFillEl.style.width = (total === 0 ? 0 : (done/total)*100) + "%";
    }
    function updateProgressFromDOM(){
      const doneCount  = document.querySelectorAll(".input-customer-item.done").length;
      const totalCount = document.querySelectorAll(".input-customer-item").length;
      progressTextEl.innerText   = `${doneCount} / ${totalCount} Toko`;
      progressFillEl.style.width = (totalCount === 0 ? 0 : (doneCount/totalCount)*100) + "%";
    }
    function getCustomerId(d){
      return d.idCustomer || d.id || "";
    }
    window.getCustomerId = getCustomerId;
    function escapeHtml(str){
      return String(str || "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;");
    }
    window.inputSummaryData = {
      pembayaran: 0,
      expired: {},
      fee: {},
      disable: {}
    };    
    const allCustomerIds = customerSnap.docs.map(d => {
      const dd = d.data();
      return dd.idCustomer || dd.id || d.id;
    });
    const dataHarianMap = {};
    window._dataHarianMap = dataHarianMap;
    try{
      const txPre = db.transaction("dataHarianDB","readonly");
      const storePre = txPre.objectStore("dataHarianDB");
      await Promise.all(allCustomerIds.map(cid =>
        new Promise((resolve)=>{
          const r = storePre.get(`${cid}_${today}`);
          r.onsuccess = ()=>{
            if(r.result) dataHarianMap[cid] = r.result;
            resolve();
          };
          r.onerror = ()=> resolve();
        })
      ));
    }catch(e){
      console.log("preload dataHarianMap error", e);
    }

    const customerList = [];
    for(const docSnap of customerSnap.docs){
      const data = docSnap.data();
      const customerId = getCustomerId(data);   // ← Pindah ke atas!

      let sudahInput = false;
      let hasFee = false;
      let hasDisable = false;
      let statusBadge = "";
      let hasKonsinyasiDiff = false;
    
      const dataHarian = dataHarianMap[customerId] || null;
      
      // Data Kemarin
      let dataKemarin = data.dataKemarin || {};
      if(dataHarian?.dataKemarin && Object.keys(dataHarian.dataKemarin).length > 0){
        dataKemarin = dataHarian.dataKemarin;
      }

      // === CEK PERBEDAAN KONSINYASI ===
      if(dataHarian?.konsinyasi){
        const kemarinKeys = new Set(Object.keys(dataKemarin));
        const konsinyasiKeys = new Set(Object.keys(dataHarian.konsinyasi));
      
        const sameKeys =
          kemarinKeys.size === konsinyasiKeys.size &&
          [...kemarinKeys].every(key => konsinyasiKeys.has(key));
      
        if(!sameKeys){
          hasKonsinyasiDiff = true;
        } else {
          // CEK NILAI QTY JUGA
          hasKonsinyasiDiff = [...kemarinKeys].some(key =>
            Number(dataHarian.konsinyasi[key]) !== Number(dataKemarin[key]?.qty || 0)
          );
        }
      }

      if(dataHarian){
        sudahInput = true;
        const dh = dataHarian;
        window.inputSummaryData.pembayaran += Number(dh?.pembayaran?.bayarKonsumen || 0);

        Object.entries(dh.expired || {}).forEach(([key,val])=>{
          window.inputSummaryData.expired[key] = (window.inputSummaryData.expired[key] || 0) + Number(val);
        });
        Object.entries(dh.fee || {}).forEach(([key,val])=>{
          window.inputSummaryData.fee[key] = (window.inputSummaryData.fee[key] || 0) + Number(val);
        });
        Object.entries(dh.disable || {}).forEach(([key,val])=>{
          window.inputSummaryData.disable[key] = (window.inputSummaryData.disable[key] || 0) + Number(val);
        });

        hasFee     = Object.keys(dh.fee     || {}).length > 0;
        hasDisable = Object.keys(dh.disable  || {}).length > 0;

        const status = String(dh?.keterangan?.status || "").trim().toLowerCase();
        if      (status === "pending") statusBadge = "PN";
        else if (status === "tutup")   statusBadge = "TP";
        else if (status === "putus")   statusBadge = "PT";
      }

      customerList.push({
        ...data,
        id: customerId,
        sudahInput,
        hasFee,
        hasDisable,
        statusBadge,
        hasKonsinyasiDiff,      // ← penting
        dataKemarin,
        jarak: Number(data.jarak || 999999)
      });
    }
    updateProgress(customerList);
    window.listCustomerData = customerList;
    customerList.sort((a,b)=>{
      if(a.sudahInput !== b.sudahInput){
        return a.sudahInput ? 1 : -1;
      }
      return a.jarak - b.jarak;
    });
    
    let customerHtml =
      "";
    function renderCustomerList(){
    
      let customerHtml = "";
    
      customerList.forEach(data => {
    
        // =========================
        // FILTER MODE
        // =========================
        if (window.inputFilterMode === "keterangan") {
          const status = (data.statusBadge || "").trim();
          // hanya TP / PN / PT
          if (!status) return;
          if (!["TP", "PN", "PT"].includes(status)) return;
        }
        if (window.inputFilterMode === "fee_disable") {
          const hasF = data.hasFee;
          const hasD = data.hasDisable;
          if (!(hasF || hasD)) return;
        }
        if (window.inputFilterMode === "penyesuaian") {
          if (!data.hasKonsinyasiDiff) return;
        }
        // =========================
        // BUILD CUSTOMER ID
        // =========================
        const customerId = getCustomerId(data);

        if (window.inputFilterMode === "produktif") {
          const status = (window.trikotomiResult || {})[customerId];
          if (status !== "green") return;
        }
        if (window.inputFilterMode === "stabil") {
          const status = (window.trikotomiResult || {})[customerId];
          if (status !== "yellow") return;
        }
        if (window.inputFilterMode === "non_produktif") {
          const status = (window.trikotomiResult || {})[customerId];
          if (status !== "red") return;
        }
        customerHtml += `
          <div class=" input-customer-item
              ${
                data.sudahInput
                  ? "done"
                  : ""
              }
            "
            data-customer-id="${
              customerId
            }"
            onclick='openPopupInputData(
              window.customerDataMap["${customerId}"]
            )'>
            <div class="input-customer-left">
              <div class=" input-customer-foto-wrapper">
                ${
                  data.catatan?.pesan?.trim()
                  ? `
                    <div class=" customer-note-badge" onclick=" event.stopPropagation();
                     openPopupCatatanCustomer(
                          '${customerId}',
                          '${
                            (
                              data.namaCustomer ||
                              '-'
                            ).replace(/'/g,"\\'")
                          }');">
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style=" color:#fff;">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </div>
                  `
                  : ''
                }
              
                <img src="${
                    data.foto ||
                    'https://ui-avatars.com/api/?name=' +
                    encodeURIComponent(
                      data.namaCustomer ||
                      'C'
                    )
                  }"
                  class=" input-customer-foto"
                  onclick=" event.stopPropagation(); openPreviewFoto(
                      '${
                        (
                          data.foto ||
                          'https://ui-avatars.com/api/?name=' +
                          encodeURIComponent(
                            data.namaCustomer ||
                            'C'
                          )
                        ).replace(/'/g, "\\'")
                      }'
                    );">
                ${
                  data.isNew === true
                  ? `
                    <div class=" customer-badge-new">
                      NEW
                    </div>
                  `
                  : ''
                }
              
              </div>
              <div class=" input-customer-info">
                <div class=" input-customer-nama-wrapper">
                  <div class=" input-customer-nama">
                    ${
                      data.namaCustomer
                      || "-"
                    }
                  </div>
                  <div class=" input-customer-badge-wrap"
                    id="badge-${
                      customerId
                    }"
                  >
                    ${
                      data.hasFee
                      ? `
                        <div class=" customer-badge fee">
                          F
                        </div>
                      `
                      : ''
                    }
                    ${
                      data.hasDisable
                      ? `
                        <div class=" customer-badge disable">
                          D
                        </div>
                      `
                      : ''
                    }
                    ${
                      data.statusBadge
                      ? `
                        <div class=" customer-badge
                            ${
                              data.statusBadge === "PN"
                                ? "pending"
                                : data.statusBadge === "TP"
                                ? "tutup"
                                : "putus"
                            }
                          ">
                          ${
                            data.statusBadge
                          }
                        </div>
                      `
                      : ''
                    }
                    ${data.hasKonsinyasiDiff 
                      ? `<div class="customer-badge konsinyasi-diff">K</div>` 
                      : ''}
                      ${(function() {
                      const result = window.trikotomiResult || {};
                      const status = result[customerId];
                      if (!status || status === "grey") return "";
                      const colorMap = {
                        green: "#2eaf62",
                        yellow: "#f0a500",
                        red: "#e74c3c"
                      };
                      const labelMap = {
                        green: "P",
                        yellow: "S",
                        red: "NP"
                      };
                      return `<div class="customer-badge" style="background:${colorMap[status]};color:#fff;">${labelMap[status]}</div>`;
                    })()}
                  </div>
                </div>
                
                <!-- DATA KEMARIN -->
                <div class="input-customer-kemarin">
                
                  ${
                    (()=>{
                      let kemarinHtml = "";
                      (
                        window.globalBawaBarang || []
                      ).forEach(item=>{
                        Object.keys(item).forEach(key=>{
                          const barang = item[key];
                          if(
                            barang?.isAktif === true
                          ){
                            const qty = Number(data?.dataKemarin?.[key]?.qty || 0);  
                            
                            const highlightClass = qty > 0 ? "highlight" : "";  
                            
                            kemarinHtml += `  
                              <div class="input-customer-kemarin-item ${highlightClass}">  
                                ${key}: ${qty}  
                              </div>  
                            `;
                          }
                        });
                      });
                      return kemarinHtml;
                    })()
                  }
                </div>
                <div class=" input-customer-jarak">
                  ${Number(
                    data.jarak || 0
                  ).toFixed(2)}
                  km
                </div>
              </div>
            </div>
        
            <!-- RIGHT ACTION -->
            <div class="input-action-right">
            
              <!-- CATATAN -->
              <button class="input-catatan-btn" onclick="
                  event.stopPropagation();
                  openPopupCatatanCustomer(
                    '${customerId}',
                    '${
                      (
                        data.namaCustomer ||
                        '-'
                      ).replace(/'/g,'\\\'')
                    }'
                  );
                ">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
                  <path d="M7.5 3.375c0-1.036.84-1.875 1.875-1.875h.375a3.75 3.75 0 0 1 3.75 3.75v1.875C13.5 8.161 14.34 9 15.375 9h1.875A3.75 3.75 0 0 1 21 12.75v3.375C21 17.16 20.16 18 19.125 18h-9.75A1.875 1.875 0 0 1 7.5 16.125V3.375Z" />
                  <path d="M15 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 17.25 7.5h-1.875A.375.375 0 0 1 15 7.125V5.25ZM4.875 6H6v10.125A3.375 3.375 0 0 0 9.375 19.5H16.5v1.125c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 0 1 3 20.625V7.875C3 6.839 3.84 6 4.875 6Z" />
                </svg>
              </button>
              
              <!-- LOKASI -->
              <button class="input-lokasi-btn" onclick="
                event.stopPropagation();
                window.openPopupLokasiCustomer('${customerId}', '${(data.namaCustomer||'').replace(/'/g,"\\'")}');
              " title="Input Alamat & Lokasi">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
                  <path d="M15.75 8.25a.75.75 0 0 1 .75.75c0 1.12-.492 2.126-1.27 2.812a.75.75 0 1 1-.992-1.124A2.243 2.243 0 0 0 15 9a.75.75 0 0 1 .75-.75Z" />
                  <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM4.575 15.6a8.25 8.25 0 0 0 9.348 4.425 1.966 1.966 0 0 0-1.84-1.275.983.983 0 0 1-.97-.822l-.073-.437c-.094-.565.25-1.11.8-1.267l.99-.282c.427-.123.783-.418.982-.816l.036-.073a1.453 1.453 0 0 1 2.328-.377L16.5 15h.628a2.25 2.25 0 0 1 1.983 1.186 8.25 8.25 0 0 0-6.345-12.4c.044.262.18.503.389.676l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 0 1-1.161.886l-.143.048a1.107 1.107 0 0 0-.57 1.664c.369.555.169 1.307-.427 1.605L9 13.125l.423 1.059a.956.956 0 0 1-1.652.928l-.679-.906a1.125 1.125 0 0 0-1.906.172L4.575 15.6Z" clip-rule="evenodd" />
                </svg>

              </button>
            
              <!-- MAP -->
              <button class="input-map-btn" onclick="
                event.stopPropagation();
                window.openMapRouting('${customerId}', 'customerHarianDB');
              ">
              
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
                  <path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
                </svg>

              </button>
            </div>
          </div>
        `;
      });
      listCustomerEl.innerHTML = customerHtml;
    }
    renderCustomerList();

    window.customerDataMap = {};
    customerList.forEach(data => {
      const customerId = getCustomerId(data);
      window.customerDataMap[customerId] = data;

      // Buat fungsi refreshBadge dinamis
      window[`refreshBadge_${customerId}`] = async function(){
        const badgeEl = document.getElementById(`badge-${customerId}`);
        if(!badgeEl) return;

        let hasFee = false, hasDisable = false, statusBadge = "", statusClass = "", hasKonsinyasiDiff = false;

        try{
          let dh = (window._dataHarianMap || {})[customerId] || null;
          if(!dh){
            const dbB = await window.openAppDB();
            const txB = dbB.transaction("dataHarianDB","readonly");
            const storeB = txB.objectStore("dataHarianDB");
            const reqB = storeB.get(`${customerId}_${today}`);
            dh = await new Promise((resolve, reject)=>{
              reqB.onsuccess = () => resolve(reqB.result || null);
              reqB.onerror  = () => reject(reqB.error);
            });
          }

          if(dh){
            hasFee = Object.keys(dh.fee || {}).length > 0;
            hasDisable = Object.keys(dh.disable || {}).length > 0;

            const status = String(dh?.keterangan?.status || "").trim().toLowerCase();
            if(status === "pending"){ statusBadge = "PN"; statusClass = "pending"; }
            else if(status === "tutup") { statusBadge = "TP"; statusClass = "tutup"; }
            else if(status === "putus") { statusBadge = "PT"; statusClass = "putus"; }

            // CEK KONSINYASI DIFF
          if(dh.konsinyasi){
            const customerData = window.customerDataMap?.[customerId] || {};
            let dataKemarin = customerData.dataKemarin || {};
            if(dh.dataKemarin && Object.keys(dh.dataKemarin).length > 0){
              dataKemarin = dh.dataKemarin;
            }

            const kemarinKeys = new Set(Object.keys(dataKemarin));
            const konsKeys = new Set(Object.keys(dh.konsinyasi));

            const sameKeys =
              kemarinKeys.size === konsKeys.size &&
              [...kemarinKeys].every(k => konsKeys.has(k));

            if(!sameKeys){
              hasKonsinyasiDiff = true;
            } else {
              // CEK NILAI QTY JUGA
              hasKonsinyasiDiff = [...kemarinKeys].some(k =>
                Number(dh.konsinyasi[k]) !== Number(dataKemarin[k]?.qty || 0)
              );
            }
          }
          }
        }catch(err){
          console.log("refreshBadge error", err);
        }

        // Tambah badge trikotomi
        const trikotomiStatus = (window.trikotomiResult || {})[customerId];
        const trikotomiBadge = (function() {
          if (!trikotomiStatus || trikotomiStatus === "grey") return "";
          const colorMap = { green: "#2eaf62", yellow: "#f0a500", red: "#e74c3c" };
          const labelMap = { green: "P", yellow: "S", red: "NP" };
          return `<div class="customer-badge" style="background:${colorMap[trikotomiStatus]};color:#fff;">${labelMap[trikotomiStatus]}</div>`;
        })();

        badgeEl.innerHTML = 
          (hasFee ? `<div class="customer-badge fee">F</div>` : "") +
          (hasDisable ? `<div class="customer-badge disable">D</div>` : "") +
          (statusBadge ? `<div class="customer-badge ${statusClass}">${statusBadge}</div>` : "") +
          (hasKonsinyasiDiff ? `<div class="customer-badge konsinyasi-diff">≠</div>` : "") +
          trikotomiBadge;
      };

      // Panggil sekali
      window[`refreshBadge_${customerId}`]();
    });
    // LONG PRESS CUSTOMER
    document.querySelectorAll(".input-customer-item").forEach(item=>{
      let pressTimer;
      item.addEventListener("touchstart",
        function(){
          pressTimer = setTimeout(()=>{
              const cid = this.dataset.customerId;
              const data = window.customerDataMap[cid];
              if(data) openPopupInputFd(data);
            },600);
        }
      );
      item.addEventListener("touchend", ()=>{
          clearTimeout(pressTimer);
        }
      );
      item.addEventListener("touchmove", ()=>{
          clearTimeout(pressTimer);
        }
      );
    });
    
    let fdStartY = 0;
    let fdCurrentY = 0;
    let fdDragging = false;
    
    popupInputFdSheet ?.addEventListener("touchstart",
      function(e){
        fdStartY = e.touches[0].clientY;
        fdDragging = true;
        popupInputFdSheet.style.transition = "none";
      }
    );
    popupInputFdSheet ?.addEventListener("touchmove",
      function(e){
        if(!fdDragging) return;
        fdCurrentY = e.touches[0].clientY - fdStartY;
        if(fdCurrentY > 0){
          popupInputFdSheet.style.transform = `translateY(${fdCurrentY}px)`;
        }
      }
    );
    popupInputFdSheet ?.addEventListener("touchend",
      function(){
        fdDragging = false;
        popupInputFdSheet.style.transition = "transform .18s ease";
        if(fdCurrentY > 90){
          popupInputFdOverlay.classList.remove("active");
          setTimeout(()=>{
            popupInputFdSheet.style.transform = "";
          },180);
        }else{
          popupInputFdSheet.style.transform = "";
        }
        fdCurrentY = 0;
      }
    );
    if (window.visualViewport) {
      const vv = window.visualViewport;
      const updateKeyboard = () => {
        const keyboardHeight =
          window.innerHeight - vv.height - vv.offsetTop;
        if (keyboardHeight > 80) {
          progressBarEl.style.position = "fixed";
          progressBarEl.style.bottom = `${keyboardHeight}px`;
        } else {
          progressBarEl.style.position = "fixed";
          progressBarEl.style.bottom = "0px";
        }
      };
    
      vv.addEventListener("resize", updateKeyboard);
      vv.addEventListener("scroll", updateKeyboard);
    
      updateKeyboard();
    } 
    searchCustomerEl.oninput = function(){
      const keyword = this.value
        .toLowerCase()
        .trim();
      const items = document.querySelectorAll(".input-customer-item");
      items.forEach(item=>{
        const nama = item.innerText.toLowerCase();
        item.style.display = nama.includes(keyword)
            ? "flex"
            : "none";
      });
    };
    progressToggleEl.onclick = function(){
      progressClosed = !progressClosed;
      progressBarEl.classList.toggle(
          "closed",
          progressClosed
        );
    };
  }catch(err){
    console.log(err);
    bawaEl.innerHTML = `
      <div class="input-bawa-item expired">
        Gagal memuat data
      </div>
    `;
  }
  
  window.compressImageInput = function(file, maxWidth = 800, quality = 0.75) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          canvas.toBlob(blob => resolve(blob), "image/jpeg", quality);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };
  
  window.openPreviewFoto = function(src){
    const overlay = document.getElementById("previewFotoOverlay");
    const img = document.getElementById("previewFotoImg");
    img.src = src;
    overlay.classList.add("active");
  };
  popupCatatanOverlay ?.addEventListener("click",
    function(e){
      if(
        e.target ===
        popupCatatanOverlay
      ){
        popupCatatanOverlay.classList.remove("active");
        if(window.catatanUnsubscribe){
          window.catatanUnsubscribe();
          window.catatanUnsubscribe = null;
        }
      }
    }
  ); 
  if(window._onDocClickPreviewFoto){
    document.removeEventListener("click", window._onDocClickPreviewFoto);
  }
  window._onDocClickPreviewFoto = function(e){
    const overlay = document.getElementById("previewFotoOverlay");
    if(e.target === overlay) overlay.classList.remove("active");
  };
  document.addEventListener("click", window._onDocClickPreviewFoto);
  
  // POPUP INPUT DATA, FD CATATAN, RINGKASAN
  window.catatanUnsubscribe = null;
  window.openPopupCatatanCustomer = async function(customerId,namaCustomer){
    popupCatatanOverlay.classList.add("active");
    popupCatatanNama.innerText = namaCustomer || "-";
    popupCatatanText.value = "";
    popupCatatanUpdate.innerText = "Update: -";
    if(window.catatanUnsubscribe){
      window.catatanUnsubscribe();
    }
    const customerRef = window.doc(window.db, "customer", customerId);
    const uid = window.auth.currentUser.uid;
    let loadedFromIndexedDB = false;
    try{
      const db = await window.openAppDB();
      const tx = db.transaction("customerHarianDB", "readonly");
      const store = tx.objectStore("customerHarianDB");
      const req = store.get(uid);
      const localData = await new Promise(
          (resolve,reject)=>{
            req.onsuccess = ()=> resolve(req.result || null);
            req.onerror = ()=> reject(req.error);
          }
        );
      const customer = localData?.data?.find(
        item => getCustomerId(item) === customerId
      );
      if(customer?.catatan){
        loadedFromIndexedDB = true;
        popupCatatanText.value = customer.catatan.pesan || "";
        if(customer.catatan.updateAt){
          const date = new Date(customer.catatan.updateAt);
          popupCatatanUpdate.innerText = "Update: " + date.toLocaleString("id-ID");
        }
      }
    }catch(err){
      console.log("Load catatan IndexedDB error:", err);
    }
    // FALLBACK FIRESTORE
    if(!loadedFromIndexedDB && navigator.onLine){
      try{
        const snap = await window.getDoc(customerRef);
        if(snap.exists()){
          const data = snap.data();
          const catatan = data.catatan || {};
          popupCatatanText.value = catatan.pesan || "";
          if(catatan.updateAt ?.seconds){
            const date = new Date(catatan.updateAt.seconds * 1000);
            popupCatatanUpdate.innerText = "Update: " + date.toLocaleString("id-ID");
          }
          // CACHE KE INDEXEDDB
          try{
            const db = await window.openAppDB();
            const tx = db.transaction("customerHarianDB","readwrite");
            const store = tx.objectStore("customerHarianDB");
            const req = store.get(uid);
            const userData = await new Promise(
                (
                  resolve,
                  reject
                )=>{
                  req.onsuccess = ()=> resolve(req.result || {});
                  req.onerror = ()=> reject(req.error);
                }
              );
            const list = userData.data || [];
            const index = list.findIndex(item =>
              getCustomerId(item) === customerId
            );
            if(index !== -1){
              list[index] = {
                ...list[index],
                catatan:{
                  pesan: catatan.pesan || "",
                  updateAt: catatan.updateAt
                    ?.seconds
                    ? catatan.updateAt.seconds * 1000 : Date.now()
                }
              };
            }
            store.put({
              ...userData,
              id: uid,
              data: list
            });
          }catch(err){
            console.log("Cache catatan error:", err);
          }
        }
      }catch(err){
        console.log("Load catatan Firestore error:", err);
      }
    }
  
    // REALTIME SNAPSHOT
    if(navigator.onLine){
      window.catatanUnsubscribe = window.onSnapshot(
          customerRef,
          async snap=>{
            if(!snap.exists())
              return;
            const data = snap.data();
            const catatan = data.catatan || {};
            popupCatatanText.value = catatan.pesan || "";
            if(catatan.updateAt ?.seconds){
              const date = new Date(catatan.updateAt.seconds * 1000);
              popupCatatanUpdate.innerText = "Update: " + date.toLocaleString("id-ID");
            }else{
              popupCatatanUpdate.innerText = "Update: -";
            }
            try{
              const db = await window.openAppDB();
              const tx = db.transaction("customerHarianDB", "readwrite");
              const store = tx.objectStore("customerHarianDB");
              const req = store.get(uid);
              const userData = await new Promise(
                  (resolve, reject)=>{
                    req.onsuccess = ()=> resolve(req.result || {});
                    req.onerror = ()=> reject(req.error);
                  }
                );
              const list = userData.data || [];
              const index = list.findIndex(item =>
              getCustomerId(item) === customerId
              );
              if(index !== -1){
                list[index] = {
                  ...list[index],
                  catatan:{
                    pesan: catatan.pesan || "",
                    updateAt:
                      catatan
                      .updateAt
                      ?.seconds
                      ? catatan
                        .updateAt
                        .seconds
                        * 1000
                      : Date.now()
                  }
                };
              }
              store.put({
                ...userData,
                id: uid,
                data: list
              });
            }catch(err){
              console.log("Cache catatan error:", err);
            }
          }
        );
    }
  
    btnSimpanCatatan.onclick = async function(){
      const now = Date.now();
      const db = await window.openAppDB();
      try{
        btnSimpanCatatan.disabled = true;
        document.getElementById("btnSimpanCatatanText").innerText = "Menyimpan...";
        const pesan = popupCatatanText.value.trim();
        const tx = db.transaction("customerHarianDB", "readwrite");
        const store = tx.objectStore("customerHarianDB");
        const req = store.get(uid);
        const userData = await new Promise(
          (resolve, reject)=>{
            req.onsuccess = ()=> resolve(req.result || {});
            req.onerror = ()=> reject(req.error);
          }
        );
        const list = userData.data || [];
        const index = list.findIndex(item => getCustomerId(item) === customerId);
        if(index !== -1){
          list[index] = {
            ...list[index],
            catatan:{
              pesan,
              updateAt: now
            }
          };
        }
        store.put({
          ...userData,
          id: uid,
          data: list,
        
          // selalu false dulu
          isSync: false,
          updatedAt: Date.now()
        });
  
        let syncSuccess = false;
        if(navigator.onLine){
          try{
            await window.updateDoc(customerRef,{
              catatan:{
                pesan,
                updateAt: window.serverTimestamp()
              }
            });
        
            syncSuccess = true;
          }catch(err){
            console.log("Sync catatan gagal:", err);
            syncSuccess = false;
          }
        }

        // Update memory listCustomerData
        const customerEntry = window.listCustomerData?.find(
          x => (x.idCustomer || x.id) === customerId
        );
        if (customerEntry) {
          if (!customerEntry.catatan) customerEntry.catatan = {};
          customerEntry.catatan.pesan = pesan;
          // Update juga di customerDataMap
          if (window.customerDataMap?.[customerId]) {
            if (!window.customerDataMap[customerId].catatan) {
              window.customerDataMap[customerId].catatan = {};
            }
            window.customerDataMap[customerId].catatan.pesan = pesan;
          }
        }

        // Re-render supaya badge catatan muncul/hilang
        renderCustomerList();

        // Re-attach long press
        document.querySelectorAll(".input-customer-item").forEach(item => {
          let pressTimer;
          item.addEventListener("touchstart", function () {
            pressTimer = setTimeout(() => {
              const cid = this.dataset.customerId;
              const d = window.customerDataMap[cid];
              if (d) openPopupInputFd(d);
            }, 600);
          });
          item.addEventListener("touchend", () => clearTimeout(pressTimer));
          item.addEventListener("touchmove", () => clearTimeout(pressTimer));
        });

        popupCatatanOverlay.classList.remove("active");
        if (window.catatanUnsubscribe) {
          window.catatanUnsubscribe();
          window.catatanUnsubscribe = null;
        }

      }catch(err){
        console.log(err); alert("Gagal update catatan");
        try{
          const db2 = await window.openAppDB();
          const tx2 = db2.transaction("customerHarianDB","readwrite");
          const store2 = tx2.objectStore("customerHarianDB");
        
          const req2 = store2.get(uid);
        
          const userData2 = await new Promise((resolve,reject)=>{
            req2.onsuccess = ()=> resolve(req2.result || {});
            req2.onerror = ()=> reject(req2.error);
          });
        
          const list2 = userData2.data || [];
        
          const index2 = list2.findIndex(
            item => getCustomerId(item) === customerId
          );
        
          if(index2 !== -1){
            list2[index2] = {
              ...list2[index2],
              catatan:{
                pesan,
                updateAt: now
              }
            };
          }
        
          store2.put({
            ...userData2,
            id: uid,
            data: list2,
            isSync: syncSuccess,
            updatedAt: Date.now()
          });
        
        }catch(err){
          console.log("Update sync catatan gagal:", err);
        }        
      }finally{
        btnSimpanCatatan.disabled = false;
        document.getElementById("btnSimpanCatatanText").innerText = "Simpan";
      }
    };
  };
  window.openPopupInputFd = async function(data){
    const overlay = document.getElementById("popupInputFdOverlay");
    const sheet = document.getElementById("popupInputFdSheet");
    const namaEl = document.getElementById("popupInputFdNama");
    const bodyEl = document.getElementById("popupInputFdBody");
    const submitBtn = document.getElementById("popupInputFdSubmit");
  
    namaEl.innerText = data.namaCustomer || "-";
    const today = new Date().toISOString().split("T")[0];
    
    // NILAI KEY POPUP INPUT
    let existingData = {};
    try{
      const db = await window.openAppDB();
      const tx = db.transaction("dataHarianDB", "readonly");
      const store = tx.objectStore("dataHarianDB");
      const customerId = getCustomerId(data);
      const req = store.get(`${customerId}_${today}`);
      existingData = await new Promise(
          (resolve,reject)=>{
            req.onsuccess = ()=> resolve(req.result || {});
            req.onerror = ()=> reject(req.error);
          }
        );
    }catch(err){
      console.log("load fd indexeddb error", err);
      existingData = {};
    }
  
    const bawaBarang = window.globalBawaBarang || [];
    console.log("bawaBarang:", bawaBarang);
    let html = "";
    ["Fee","Disable"].forEach(group=>{
      const keyGroup = group.toLowerCase();
      html += `
        <div class="popup-group ${keyGroup}">
          <div class="popup-group-title">
            ${group}
          </div>
          <div class="popup-group-list">
      `;
      bawaBarang.forEach(item=>{
        Object.keys(item).forEach(key=>{
          const barang = item[key];
          if(barang?.isAktif === true){
            const preload = existingData?.[keyGroup]?.[key];
            html += `
              <div class="popup-input-item">
                <input type="number" min="0" placeholder="${key}" value="${preload ?? ""}"
                  class="popup-input-number popup-fd-input">
              </div>
            `;
          }
        });
      });
      html += `
          </div>
        </div>
      `;
    });
  
    bodyEl.innerHTML = html;
    function validate(){
      const hasInput = [
          ...bodyEl.querySelectorAll(".popup-fd-input")
        ].some(input => input.value !== "");
      submitBtn.disabled = !hasInput;
    }
    bodyEl.querySelectorAll(".popup-fd-input").forEach(input=>{
        input.addEventListener("input", validate);
    });
    validate();
  
    submitBtn.onclick = async function () {
      try {
        submitBtn.disabled = true;
        submitBtn.innerText = "Menyimpan...";
    
        const fee = {};
        const disable = {};
    
        bodyEl.querySelectorAll(".popup-group").forEach(group => {
          const groupName = [...group.classList].find(cls =>
            ["fee", "disable"].includes(cls)
          );
    
          group.querySelectorAll("input").forEach(input => {
            if (input.value !== "") {
              const value = Number(input.value);
    
              if (groupName === "fee") {
                fee[input.placeholder] = value;
              }
    
              if (groupName === "disable") {
                disable[input.placeholder] = value;
              }
            }
          });
        });
    
        const customerId = getCustomerId(data);
    
        const payload = {
          fee,
          disable,
          updatedAt: window.serverTimestamp()
        };
    
        // =========================
        // SAVE INDEXEDDB (SOURCE OF TRUTH)
        // =========================
        const db = await window.openAppDB();
        const tx = db.transaction("dataHarianDB", "readwrite");
        const store = tx.objectStore("dataHarianDB");
    
        const key = `${customerId}_${today}`;
    
        const oldData = await new Promise((resolve, reject) => {
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result || {});
          req.onerror = () => reject(req.error);
        });
    
        store.put({
          ...oldData,
          id: key,
          tanggal: today,
          idCustomer: customerId,
          fee,
          disable,
          payload,
        
          // source of truth offline
          isSync: false,
        
          updatedAt: Date.now()
        });
    
        // =========================
        // FIRESTORE (HANYA JIKA ONLINE)
        // =========================
        let syncSuccess = false;
        if (navigator.onLine) {
          try {
            const docRef = window.doc(
              window.db,
              "customer",
              customerId,
              "dataHarian",
              today
            );
    
            await window.setDoc(docRef, payload, { merge: true });
    
            // OPTIONAL: kalau mau langsung update status sync
            const tx2 = db.transaction("dataHarianDB", "readwrite");
            const store2 = tx2.objectStore("dataHarianDB");
    
            syncSuccess = true;
            store2.put({
              ...oldData,
              id: key,
              tanggal: today,
              idCustomer: customerId,
              fee,
              disable,
              payload,
              isSync: syncSuccess,
              updatedAt: Date.now()
            });
    
          } catch (err) {
            console.log("Firestore sync gagal:", err);
            syncSuccess = false;
          }
        }
    
        // =========================
        // MEMORY UPDATE
        // =========================
        if (window._dataHarianMap) {
          window._dataHarianMap[customerId] = {
            ...window._dataHarianMap[customerId],
            fee,
            disable
          };
        }

        // Refresh badge F dan D realtime
        if (window[`refreshBadge_${customerId}`]) {
          await window[`refreshBadge_${customerId}`]();
        }

        overlay.classList.remove("active");
    
      } catch (err) {
        console.log(err);
        alert("Gagal simpan");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Simpan";
      }
    };
    overlay.classList.add("active");
  
    let overlayClickReady = false;
    setTimeout(()=>{
      overlayClickReady = true;
    }, 350);
  
    overlay.onclick = function(e){
      if(!overlayClickReady) return;
      if(e.target === overlay){
        overlay.classList.remove("active");
      }
    };
  };
  window.openPopupInputData = async function(data){
    const overlay = document.getElementById("popupInputOverlay");
    const sheet = document.getElementById("popupInputSheet");
    const namaEl = document.getElementById("popupInputNama");
    const barangEl = document.getElementById("popupInputBarang");
    namaEl.innerText = data.namaCustomer || "-";
    const bawaBarang = window.globalBawaBarang || [];
  
    const today = new Date().toISOString().split("T")[0];
    const customerId = getCustomerId(data);
    let existingData = null;
    let isExistingDoc = false;
    let dataKemarin = {};

    try{
      const db = await window.openAppDB();
      const tx = db.transaction("dataHarianDB", "readonly");
      const store = tx.objectStore("dataHarianDB");
      const req = store.get(`${customerId}_${today}`);
      existingData = await new Promise(
        (resolve,reject)=>{
          req.onsuccess = ()=> resolve(req.result || null);
          req.onerror = ()=> reject(req.error);
        }
      );

      if(existingData){
        isExistingDoc = true;
        console.log("Edit mode IndexedDB:", existingData);
        // ambil dataKemarin sekalian dari hasil yang sama
        if(existingData.dataKemarin && Object.keys(existingData.dataKemarin).length > 0){
          dataKemarin = existingData.dataKemarin;
        }
      }

      // fallback ke root customer
      if(Object.keys(dataKemarin).length === 0){
        dataKemarin = data.dataKemarin || {};
      }

    }catch(err){
      console.log("Gagal load IndexedDB:", err);
      dataKemarin = data.dataKemarin || {};
    }
  
    let kemarinHtml = "";
    bawaBarang.forEach(item => {
      Object.keys(item).forEach(key => {
        const barang = item[key];
        if (barang?.isAktif === true) {
          const qty = Number(dataKemarin?.[key]?.qty ?? 0);
          const highlightClass = qty > 0 ? "highlight" : "";
          kemarinHtml += `
            <div class="popup-kemarin-item ${highlightClass}">
              ${key}: ${qty}
            </div>
          `;
        }
      });
    });
    
    const kemarinEl = document.getElementById("popupDataKemarin");
    function formatTanggalIndo(dateStr){
      const date = new Date(dateStr);
      const hari = [
        "Minggu","Senin","Selasa","Rabu",
        "Kamis","Jumat","Sabtu"
      ];
      const bulan = [
        "Januari","Februari","Maret","April","Mei","Juni",
        "Juli","Agustus","September","Oktober","November","Desember"
      ];
      return `${hari[date.getDay()]}, ${date.getDate()} ${bulan[date.getMonth()]} ${date.getFullYear()}`;
    }
    function getLatestAvailableDate(customerId, today) {
      return new Promise(async (resolve) => {
        try {
          const db = await window.openAppDB();
          const tx = db.transaction("dataHarianDB", "readonly");
          const store = tx.objectStore("dataHarianDB");
          const req = store.getAll();
          req.onsuccess = () => {
            const all = req.result || [];
            const latest = all
              .filter(x =>
                x.idCustomer === customerId &&
                x.tanggal &&
                x.tanggal < today
              )
              .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))[0];
            resolve(latest?.tanggal || null);
          };
    
          req.onerror = () => resolve(null);
        } catch (err) {
          resolve(null);
        }
      });
    }
    let tanggalKemarin =
      existingData?.dataKemarinTanggal ||
      data?.dataKemarinTanggal ||
      await getLatestAvailableDate(customerId, today);
    if (!tanggalKemarin) {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      tanggalKemarin = d.toISOString().split("T")[0];
    }
    
    const tanggalEl = document.getElementById("popupDataKemarinTanggal");
    if(tanggalEl){
      // Cari tanggal terakhir customer ini diinput (sebelum hari ini)
      const lastInputTanggal = await getLatestAvailableDate(customerId, today);
      if(lastInputTanggal){
        tanggalEl.innerText = "Terakhir input: " + formatTanggalIndo(lastInputTanggal);
      } else {
        tanggalEl.innerText = "Belum pernah diinput";
      }
    }
    
    kemarinEl.innerHTML = kemarinHtml;
  
    const tipeList = [
      "Return",
      "Expired",
      "Konsinyasi",
      "Cash",
      "Lainnya"
    ];
    let html = "";
    tipeList.forEach(tipe=>{
      const className = tipe.toLowerCase();
  
      html += `
        <div class="popup-group ${className}">
          <div class="popup-group-title">
            ${tipe}
          </div>
          <div class="popup-group-list">
      `;
      bawaBarang.forEach(item=>{
        Object.keys(item).forEach(key=>{
          const barang = item[key];
          if(barang?.isAktif === true){
            const qtyKemarin = dataKemarin?.[key]?.qty || 0;
            const hasKemarin = qtyKemarin > 0;
            const preloadValue = existingData?.[
              tipe.toLowerCase()
            ]?.[key];
  
            html += `
              <div class="popup-input-item">
                <input type="number" min="0" placeholder="${key}" value="${preloadValue ?? ""}"
                  class="popup-input-number ${hasKemarin ? 'active-kemarin' : ''}">
              </div>
            `;
          }
        });
      });
  
      html += `
          </div>
        </div>
      `;
    });
  
  
    barangEl.innerHTML =
      html +
      `
      <!-- FOTO -->
      <div class="popup-foto-wrapper" id="popupFotoWrapper" style="display:none;">
        <div class="popup-foto-card" id="popupFotoCard">
  
          <img id="popupFotoPreview" class="popup-foto-preview">
          <div class="popup-foto-placeholder" id="popupFotoPlaceholder">
  
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19V7a2 2 0 0 0-2-2h-3l-2-2H8L6 5H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            <div>Tambah Foto Bukti</div>
          </div>
        </div>
  
        <input type="file" id="popupCameraInput" accept="image/*" capture="environment" hidden>
      </div>
  
      <!-- STATUS -->
      <div class="popup-status-wrapper" id="popupStatusWrapper" style="display:none;">
        <label class="popup-status-item tutup">
          <input type="radio" name="customerStatus" value="tutup">
          <span>Tutup</span>
        </label>
  
        <label class="popup-status-item pending">
          <input type="radio" name="customerStatus" value="pending">
          <span>Pending</span>
        </label>
  
        <label class="popup-status-item putus">
          <input type="radio" name="customerStatus" value="putus">
          <span>Putus</span>
        </label>
      </div>
    `;
  
    const lainnyaInputs = barangEl.querySelectorAll(".popup-group.lainnya .popup-input-number");
    const fotoWrapper = document.getElementById("popupFotoWrapper");
    const fotoCard = document.getElementById("popupFotoCard");
    const cameraInput = document.getElementById("popupCameraInput");
    const fotoPreview = document.getElementById("popupFotoPreview");
    const fotoPlaceholder = document.getElementById("popupFotoPlaceholder");
    const statusWrapper = document.getElementById("popupStatusWrapper");
    const statusItems = barangEl.querySelectorAll(".popup-status-item");
    const statusRadios = barangEl.querySelectorAll('input[name="customerStatus"]');
    const submitBtn = document.getElementById("popupSubmitBtn");
    const allInputs = barangEl.querySelectorAll(".popup-input-number");
  
    function updateRealtimePreview(){
      const previewPay = document.getElementById("previewPay");
      const groupData = {
        return:{},
        expired:{},
        konsinyasi:{},
        cash:{},
        lainnya:{}
      };
      barangEl.querySelectorAll(".popup-group").forEach(group=>{
        const groupName =
          [...group.classList]
          .find(cls=>
            [
              "return","expired",
              "konsinyasi","cash","lainnya"
            ].includes(cls)
          );
        if(!groupName) return;
        group.querySelectorAll(".popup-input-number").forEach(input=>{
          const key = input.placeholder;
          const value = Number(input.value || 0);
          if(value > 0){
            groupData[groupName][key] = value;
          }
        });
      });
      const varianMap = {};
      (window.globalVarian || []).forEach(item=>{
        Object.keys(item).forEach(key=>{
          varianMap[key] = item[key];
        });
      });
  
      let totalClosing = 0;
      const closingKeys = new Set([
          ...Object.keys(groupData.konsinyasi),
          ...Object.keys(groupData.return),
          ...Object.keys(groupData.cash)
        ]);
      closingKeys.forEach(key=>{
        const qty =
          Number(groupData.konsinyasi?.[key] || 0) -
          Number(groupData.return?.[key] || 0) +
          Number(groupData.cash?.[key] || 0);
        const harga =
          Number(varianMap[key]?.hargaProduksi || 0);
        totalClosing += qty * harga;
      });
      
      let totalPay = 0;
      const payKeys = new Set([
        ...Object.keys(dataKemarin || {}),
        ...Object.keys(groupData.return),
        ...Object.keys(groupData.expired),
        ...Object.keys(groupData.cash),
        ...Object.keys(groupData.lainnya)
      ]);
  
      payKeys.forEach(key=>{
        const payQty =
          Number(dataKemarin?.[key]?.qty || 0) -
          Number(groupData.return?.[key] || 0) -
          Number(groupData.expired?.[key] || 0) +
          Number(groupData.cash?.[key] || 0) -
          Number(groupData.lainnya?.[key] || 0);
        const harga =
          Number(varianMap[key]?.hargaKonsumen || 0);
        totalPay += payQty * harga;
      });
      previewPay.innerText = "Rp" + totalPay.toLocaleString("id-ID");
    }
    async function compressImage(file){
      return new Promise(resolve=>{
        const reader = new FileReader();
        reader.onload = function(e){
          const img = new Image();
          img.onload = function(){
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            let width = img.width;
            let height = img.height;
            const maxSize = 800;
            if(width > height){
              if(width > maxSize){
                height *= maxSize / width;
                width = maxSize;
              }
            }else{
              if(height > maxSize){
                width *= maxSize / height;
                height = maxSize;
              }
            }
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            resolve(
              canvas.toDataURL("image/jpeg", 0.6)
            );
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }
    async function saveToFirestore(groupData) {
      let syncSuccess = false;
    
      try {
        submitBtn.disabled = true;
        submitBtn.innerText = "Menyimpan...";
    
        const uid = window.auth.currentUser?.uid;
        if (!uid) throw new Error("User not logged in");
    
        const userData = window.currentUser || {};
        const today = new Date().toISOString().split("T")[0];
        const deleteField = window.deleteField;
    
        const payload = {
          createdAt: window.serverTimestamp(),
          tanggal: today,
          idCabang: userData.idCabang || "",
          pemilik: uid,
          idCustomer: getCustomerId(data),
          namaCustomer: data.namaCustomer || ""
        };
    
        // merge group data
        Object.keys(groupData).forEach(key => {
          if (Object.keys(groupData[key] || {}).length > 0) {
            payload[key] = groupData[key];
          }
        });
    
        // closing
        payload.closing = {};
        const allKeys = new Set([
          ...Object.keys(groupData.konsinyasi || {}),
          ...Object.keys(groupData.return || {}),
          ...Object.keys(groupData.cash || {})
        ]);
    
        allKeys.forEach(key => {
          payload.closing[key] =
            Number(groupData.konsinyasi?.[key] || 0) -
            Number(groupData.return?.[key] || 0) +
            Number(groupData.cash?.[key] || 0);
        });
    
        // pay
        payload.pay = {};
        const payKeys = new Set([
          ...Object.keys(dataKemarin || {}),
          ...Object.keys(groupData.return || {}),
          ...Object.keys(groupData.expired || {}),
          ...Object.keys(groupData.cash || {}),
          ...Object.keys(groupData.lainnya || {})
        ]);
    
        payKeys.forEach(key => {
          const total =
            Number(dataKemarin?.[key]?.qty || 0) -
            Number(groupData.return?.[key] || 0) -
            Number(groupData.expired?.[key] || 0) +
            Number(groupData.cash?.[key] || 0) -
            Number(groupData.lainnya?.[key] || 0);
    
          if (total !== 0) payload.pay[key] = total;
        });
    
        if (Object.keys(payload.pay).length === 0) {
          delete payload.pay;
        }
    
        // pembayaran
        payload.pembayaran = {
          bayarKonsumen: 0,
          bayarProduksi: 0
        };
    
        const varianMap = {};
        (window.globalVarian || []).forEach(item => {
          Object.keys(item).forEach(k => {
            varianMap[k] = item[k];
          });
        });
    
        Object.keys(payload.pay || {}).forEach(key => {
          payload.pembayaran.bayarKonsumen +=
            Number(payload.pay?.[key] || 0) *
            Number(varianMap?.[key]?.hargaKonsumen || 0);
        });
    
        Object.keys(payload.closing || {}).forEach(key => {
          payload.pembayaran.bayarProduksi +=
            Number(payload.closing?.[key] || 0) *
            Number(varianMap?.[key]?.hargaProduksi || 0);
        });
    
        // keterangan
        const hasLainnya = Object.keys(groupData.lainnya || {}).length > 0;
        if (hasLainnya) {
          payload.keterangan = {};
    
          if (window.popupStatus) {
            payload.keterangan.status = window.popupStatus;
          }
    
          if (window.popupFotoLainnya) {
            payload.keterangan.foto =
              typeof window.popupFotoLainnya === "string"
                ? window.popupFotoLainnya
                : await compressImage(window.popupFotoLainnya);
          }
        }
    
        // dataKemarin logic
        // Hanya simpan dataKemarin jika belum ada di record existing
        const sudahAdaDataKemarin =
          existingData?.dataKemarin &&
          Object.keys(existingData.dataKemarin).length > 0;
    
        if (!sudahAdaDataKemarin) {
          payload.dataKemarin = dataKemarin;
          // tanggal kemarin yang sebenarnya, bukan today
          payload.dataKemarinTanggal = tanggalKemarin;
        }
    
        // =========================
        // SAVE KE INDEXEDDB (SOURCE OF TRUTH OFFLINE)
        // =========================
        const db = await window.openAppDB();
        const tx = db.transaction("dataHarianDB", "readwrite");
        const store = tx.objectStore("dataHarianDB");
    
        const idKey = `${payload.idCustomer}_${today}`;
    
        await new Promise((resolve, reject) => {
          const req = store.put({
            id: idKey,
            tanggal: today,
            idCustomer: payload.idCustomer,
            ...payload,
            payload,
            isSync: false,
            updatedAt: Date.now()
          });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });

        // =========================
        // FIRESTORE SYNC
        // =========================
        const docRef = window.doc(
          window.db,
          "customer",
          payload.idCustomer,
          "dataHarian",
          today
        );
        syncSuccess = false;    
        if (navigator.onLine) {
          try {
            if (isExistingDoc) {
              await window.setDoc(
                docRef,
                {
                  return: window.deleteField(),
                  expired: window.deleteField(),
                  konsinyasi: window.deleteField(),
                  cash: window.deleteField(),
                  lainnya: window.deleteField(),
                  closing: window.deleteField(),
                  pay: window.deleteField(),
                  pembayaran: window.deleteField(),
                  keterangan: window.deleteField(),
                  dataKemarin: window.deleteField(),
                  ...payload
                },
                { merge: true }
              );
            } else {
              await window.setDoc(docRef, payload, { merge: true });
            }
    
            syncSuccess = true;
          } catch (err) {
            console.log("Firestore sync failed:", err);
            syncSuccess = false;
          }
        }
    
        // =========================
        // UPDATE INDEXEDDB SYNC STATUS (FINAL TRUTH)
        // =========================
        const db2 = await window.openAppDB();
        const tx2 = db2.transaction("dataHarianDB", "readwrite");
        const store2 = tx2.objectStore("dataHarianDB");
        
        // ambil data lama dulu
        const oldRecord = await new Promise((resolve,reject)=>{
          const req = store2.get(idKey);
        
          req.onsuccess = ()=> resolve(req.result || {});
          req.onerror = ()=> reject(req.error);
        });
        
        store2.put({
          ...oldRecord,
          ...payload,
        
          id: idKey,
          tanggal: today,
          idCustomer: payload.idCustomer,
        
          isSync: syncSuccess,
          updatedAt: Date.now()
        });
    
        // =========================
        // UPDATE MEMORY CACHE
        // =========================
        const customerId = payload.idCustomer;
    
        if (window._dataHarianMap) {
          window._dataHarianMap[customerId] = {
            ...window._dataHarianMap[customerId],
            ...payload
          };
        }
    
        // =========================
        // UI UPDATE
        // =========================

        // Update memory
        const customerEntry = window.listCustomerData?.find(
          x => (x.idCustomer || x.id) === customerId
        );
        if (customerEntry) {
          customerEntry.sudahInput = true;
        }

        // Sort ulang: belum input dulu, lalu by jarak
        if (window.listCustomerData) {
          window.listCustomerData.sort((a, b) => {
            if (a.sudahInput !== b.sudahInput) {
              return a.sudahInput ? 1 : -1;
            }
            return a.jarak - b.jarak;
          });
        }

        // Re-render list
        renderCustomerList();

        // Re-attach long press setelah re-render
        document.querySelectorAll(".input-customer-item").forEach(item => {
          let pressTimer;
          item.addEventListener("touchstart", function () {
            pressTimer = setTimeout(() => {
              const cid = this.dataset.customerId;
              const d = window.customerDataMap[cid];
              if (d) openPopupInputFd(d);
            }, 600);
          });
          item.addEventListener("touchend", () => clearTimeout(pressTimer));
          item.addEventListener("touchmove", () => clearTimeout(pressTimer));
        });

        updateProgressFromDOM();

        if (window[`refreshBadge_${customerId}`]) {
          window[`refreshBadge_${customerId}`]();
        }

        document.getElementById("popupInputOverlay").classList.remove("active");
      } catch (err) {
        console.log(err);
    
        document.querySelectorAll(".input-customer-item").forEach(item => {
          if (item.dataset.customerId === getCustomerId(data)) {
            item.classList.remove("done");
          }
        });
    
        alert("Gagal simpan, silakan coba lagi");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Kirim";
      }
    }
    function checkWarningValidation(groupData){
      let showWarning = false;
      const kemarinData = {};
      Object.keys(dataKemarin).forEach(key=>{
        const qty = dataKemarin[key]?.qty || 0;
        if(qty > 0){
          kemarinData[key] = qty;
        }
      });
  
      const kemarinKeys = Object.keys(kemarinData);
      const returnKeys = Object.keys(groupData.return);
      if(returnKeys.length > 0){
        const sameReturnKey = kemarinKeys.length === returnKeys.length && kemarinKeys.every(key=> returnKeys.includes(key));
        if(!sameReturnKey){
          showWarning = true;
        }
      }
      const konsinyasiKeys = Object.keys(groupData.konsinyasi);
      if(konsinyasiKeys.length > 0){
        const sameKonsinyasi =
          kemarinKeys.length ===
          konsinyasiKeys.length &&
  
          kemarinKeys.every(key=>
            konsinyasiKeys.includes(key) &&
            Number(groupData.konsinyasi[key]) === Number(kemarinData[key])
          );
        if(!sameKonsinyasi){
          showWarning = true;
        }
      }
      return showWarning;
    }
    function checkLainnyaInput(){
      let hasValue = false;
      lainnyaInputs.forEach(input=>{
        if(input.value !== ""){
          hasValue = true;
        }
      });
      fotoWrapper.style.display = hasValue ? "flex" : "none";
      statusWrapper.style.display = hasValue ? "flex" : "none";
      if(!hasValue){
        fotoWrapper.style.display = "none";
        statusWrapper.style.display = "none";  
        window.popupStatus = null;
        window.popupFotoLainnya = null;
  
        fotoPreview.src = "";
        fotoPreview.style.display = "none";
        fotoPlaceholder.style.display = "flex";
        cameraInput.value = "";
  
        statusItems.forEach(item=>
          item.classList.remove("active")
        );
        statusRadios.forEach(radio=>{
          radio.checked = false;
        });
      }
      validateSubmit();
    }
    function validateSubmit(){
      let isValid = true;
      const groupData = {
        return:{},
        expired:{},
        konsinyasi:{},
        cash:{},
        lainnya:{}
      };
      barangEl.querySelectorAll(".popup-group").forEach(group=>{
        const groupName = [...group.classList].find(cls=>
            [
              "return","expired",
              "konsinyasi","cash","lainnya"
            ].includes(cls)
          );
  
        if(!groupName) return; group.querySelectorAll(".popup-input-number").forEach(input=>{
          const key = input.placeholder;
          const value = input.value;
          if(value !== ""){
            groupData[groupName][key] = Number(value);
          }
        });
      });
      const hasAnyInput = Object.values(groupData).some(group=> Object.keys(group).length > 0);
      if(!hasAnyInput) isValid = false;
  
      const hasReturn = Object.keys(groupData.return).length > 0;
      if(hasReturn){
        if(
          Object.keys(groupData.konsinyasi).length === 0 &&
          Object.keys(groupData.cash).length === 0 &&
          Object.keys(groupData.lainnya).length === 0){
          isValid = false;
        }
      }
  
      const hasLainnya =Object.keys(groupData.lainnya).length > 0;
      if(hasLainnya){
        if(!window.popupFotoLainnya) isValid = false;
        if(!window.popupStatus) isValid = false;
      }
  
      const hasExpired = Object.keys(groupData.expired).length > 0;
      if(hasExpired){
        if(
          Object.keys(groupData.konsinyasi).length === 0 &&
          Object.keys(groupData.cash).length === 0 &&
          Object.keys(groupData.lainnya).length === 0){
          isValid = false;
        }
      }
      if(hasLainnya){
        const status = window.popupStatus;
        if(status === "tutup"){
          const kemarinData = {};
          Object.keys(dataKemarin).forEach(key=>{
            const qty = dataKemarin[key]?.qty || 0;
            if(qty > 0){
              kemarinData[key] = qty;
            }
          });
          const lainnyaData = groupData.lainnya;
          const kKeys = Object.keys(kemarinData);
          const lKeys = Object.keys(lainnyaData);
          const sameLength = kKeys.length === lKeys.length;
          const sameData = kKeys.every(key=>
              lKeys.includes(key) &&
              Number(lainnyaData[key]) ===
              Number(kemarinData[key])
            );
          if(!sameLength || !sameData){
            isValid = false;
          }
        }else if(
          status === "pending" ||
          status === "putus"
        ){
          if(Object.keys(groupData.lainnya).length === 0){
            isValid = false;
          }
        }
      }
      submitBtn.disabled = !isValid;
    }
    lainnyaInputs.forEach(input=>{
      input.addEventListener("input", checkLainnyaInput);
    });
    if(existingData?.keterangan){
      const savedStatus = existingData.keterangan.status;
      const savedFoto   = existingData.keterangan.foto;

      // Jika ada status atau foto, tampilkan wrapper dulu
      const hasLainnyaExisting = Object.keys(existingData?.lainnya || {}).length > 0;
      if (hasLainnyaExisting) {
        fotoWrapper.style.display   = "flex";
        statusWrapper.style.display = "flex";
      }

      if(savedStatus){
        const radio = barangEl.querySelector(`input[name="customerStatus"][value="${savedStatus}"]`);
        if(radio){
          radio.checked = true;
          radio.closest(".popup-status-item")?.classList.add("active");
          window.popupStatus = savedStatus;
        }
      }

      if(savedFoto){
        fotoPreview.src               = savedFoto;
        fotoPreview.style.display     = "block";
        fotoPlaceholder.style.display = "none";
        window.popupFotoLainnya       = savedFoto;
        fotoWrapper.style.display     = "flex";
      }
    }
    allInputs.forEach(input=>{
      input.addEventListener("input", function(){
        validateSubmit();
        updateRealtimePreview();
      });
    });
    statusRadios.forEach(radio=>{
      radio.addEventListener("change", function(){
          statusItems.forEach(item=> item.classList.remove("active"));
          this.closest(".popup-status-item").classList.add("active");
          window.popupStatus = this.value;
          validateSubmit();
        }
      );
    });

    fotoCard.onclick = function(){
      cameraInput.click();
    };
    cameraInput.onchange = function(e){
      const file = e.target.files[0];
      if(!file) return;
      fotoPreview.src = URL.createObjectURL(file);
      fotoPreview.style.display = "block";
      fotoPlaceholder.style.display = "none";
      window.popupFotoLainnya = file;
      validateSubmit();
    };
    submitBtn.onclick = function(){
      if(submitBtn.disabled) return;
      const groupData = {
        return:{},
        expired:{},
        konsinyasi:{},
        cash:{},
        lainnya:{}
      };
      barangEl.querySelectorAll(".popup-group").forEach(group=>{
        const groupName = [...group.classList].find(cls=>
            [
              "return","expired",
              "konsinyasi","cash","lainnya"
            ].includes(cls)
          );
        if(!groupName) return;
        group.querySelectorAll(".popup-input-number").forEach(input=>{
          const key = input.placeholder;
          const value = input.value;
          if(value !== ""){
            groupData[groupName][key] = Number(value);
          }
        });
      });
      const needWarning = checkWarningValidation(groupData);
      if(needWarning){
        const warningOverlay = document.getElementById("popupWarningOverlay");
        const btnCancel = document.getElementById("popupWarningCancel");
        const btnSubmit = document.getElementById("popupWarningSubmit");
        warningOverlay.classList.add("active");
        btnCancel.onclick = function(){
          warningOverlay.classList.remove("active");
        };
        btnSubmit.onclick = function(){
          warningOverlay.classList.remove("active");
          saveToFirestore(groupData);
        };
        return;
      }
      saveToFirestore(groupData);
    };
    updateRealtimePreview();
    overlay.classList.add("active");
    let overlayClickReady = false;
    setTimeout(()=>{
      overlayClickReady = true;
    }, 350);
    overlay.onclick = function(e){
      if(!overlayClickReady) return;
      if(e.target === overlay){
        overlay.classList.remove("active");
      }
    };
    let startY = 0;
    sheet.addEventListener("touchstart", e=>{
        startY = e.touches[0].clientY;
      }
    );
    sheet.addEventListener("touchmove", e=>{
        const diff = e.touches[0].clientY - startY;
        if(diff > 0){
          sheet.style.transform = `translateY(${diff}px)`;
        }
      }
    );
    sheet.addEventListener("touchend", e=>{
        const diff = e.changedTouches[0].clientY - startY;
        if(diff > 120){
          overlay.classList.remove("active");
          sheet.style.transform = "";
        }else{sheet.style.transform = "";}
      }
    );
  };
  window.openPopupHeaderDetail = async function () {
    const today = new Date().toISOString().split("T")[0];
  
    const summary = {
      pembayaran: 0,
      expired: {},
      fee: {},
      disable: {},
      closing: {} // ✅ FIX: pakai data asli
    };
  
    try {
      const db = await window.openAppDB();
      const tx = db.transaction("dataHarianDB", "readonly");
      const store = tx.objectStore("dataHarianDB");
  
      const allData = await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
  
      allData.forEach(record => {
        if (!record.tanggal || record.tanggal !== today) return;
  
        // Pembayaran
        summary.pembayaran += Number(
          record?.pembayaran?.bayarKonsumen || 0
        );
        
        // Expired
        Object.entries(record.expired || {}).forEach(([key, val]) => {  
          summary.expired[key] =  
            (summary.expired[key] || 0) + Number(val);  
        });
        
        // Fee
        Object.entries(record.fee || {}).forEach(([key, val]) => {  
          summary.fee[key] =  
            (summary.fee[key] || 0) + Number(val);  
        });
        
        // Disable
        Object.entries(record.disable || {}).forEach(([key, val]) => {  
          summary.disable[key] =  
            (summary.disable[key] || 0) + Number(val);  
        });
        
        // Closing
        Object.entries(record.closing || {}).forEach(([key, val]) => {  
          summary.closing[key] =  
            (summary.closing[key] || 0) + Number(val);  
        });
      });
  
    } catch (err) {
      console.error("Gagal load summary dari IndexedDB:", err);
  
      const data = window.inputSummaryData || {};
      summary.pembayaran = data.pembayaran || 0;
      summary.expired = data.expired || {};
      summary.fee = data.fee || {};
      summary.disable = data.disable || {};
      summary.closing = data.closing || {}; // ✅ FIX fallback
    }
  
    const activeKeys = [];
    (window.globalBawaBarang || []).forEach(item => {
      Object.keys(item).forEach(key => {
        if (item[key]?.isAktif) activeKeys.push(key);
      });
    });
  
    // ❌ HAPUS HITUNG ULANG CLOSING
    // (tidak dipakai lagi)
  
    // Hitung Saldo Barang
    const saldoBarang = {};
    activeKeys.forEach(key => {
      let bawa = 0;
  
      (window.globalBawaBarang || []).forEach(item => {
        if (item[key]?.isAktif) {
          bawa = Number(item[key].bawa || 0);
        }
      });
  
      saldoBarang[key] =
        bawa -
        Number(summary.closing?.[key] || 0) -
        Number(summary.fee?.[key]     || 0) -
        Number(summary.disable?.[key] || 0);
    });
  
    let html = "";
  
    // Bawa Barang
    html += `
      <div class="popup-detail-section">
        <div class="popup-detail-section-title">Bawa Barang</div>
        <div class="popup-detail-inline-list">
    `;
  
    (window.globalBawaBarang || []).forEach(item => {
      Object.keys(item).forEach(key => {
        const barang = item[key];
        if (barang?.isAktif) {
          html += `
            <div class="popup-kemarin-item">
              ${key}: ${barang.bawa || 0}
            </div>
          `;
        }
      });
    });
  
    html += `</div></div>`;
  
    // Pembayaran
    html += `
      <div class="popup-detail-section">
        <div class="popup-detail-section-title">Jumlah Pembayaran</div>
        <div class="popup-detail-inline-list">
          <div class="popup-detail-chip payment">
            Rp${Number(summary.pembayaran || 0).toLocaleString("id-ID")}
          </div>
        </div>
      </div>
    `;
  
    function renderGroup(title, obj, type = "") {
      html += `
        <div class="popup-detail-section ${type}">
          <div class="popup-detail-section-title">${title}</div>
          <div class="popup-detail-inline-list">
      `;
  
      activeKeys.forEach(key => {
        const value = obj?.[key] || 0;
  
        html += `
          <div class="popup-detail-chip ${type}">
            ${key}: ${value}
          </div>
        `;
      });
  
      html += `</div></div>`;
    }
  
    renderGroup("Expired",      summary.expired,  "expired");
    renderGroup("Fee",          summary.fee,      "fee");
    renderGroup("Disable",      summary.disable,  "disable");
    renderGroup("Closing",      summary.closing,  "closing");
    renderGroup("Saldo Barang", saldoBarang,      "saldo");
  
    popupHeaderDetailBody.innerHTML = html;
    popupHeaderDetailOverlay.classList.add("active");
  };
  inputDetailBtn.onclick = async function(){
      await openPopupHeaderDetail();
  };
  popupHeaderDetailOverlay ?.addEventListener("click",
    function(e){
      if(e.target === popupHeaderDetailOverlay){
        popupHeaderDetailOverlay.classList.remove("active");
      }
    }
  );
  
  let detailStartY = 0;
  let detailCurrentY = 0;
  let detailDragging = false;
  popupHeaderDetailSheet ?.addEventListener("touchstart",
    function(e){
      detailStartY = e.touches[0].clientY;
      detailDragging = true;
      popupHeaderDetailSheet.style.transition = "none";
    }
  );
  popupHeaderDetailSheet ?.addEventListener("touchmove",
    function(e){
      if(!detailDragging) return;
      detailCurrentY = e.touches[0].clientY - detailStartY;
      if(detailCurrentY > 0){
        popupHeaderDetailSheet.style.transform = `translateY(${detailCurrentY}px)`;
      }
    }
  );
  popupHeaderDetailSheet ?.addEventListener("touchend",
    function(){
      detailDragging = false;
      popupHeaderDetailSheet.style.transition = "transform .18s ease";
      if(detailCurrentY > 90){
        popupHeaderDetailOverlay.classList.remove("active");
        popupHeaderDetailSheet.style.transform = "";
      }else{
        popupHeaderDetailSheet.style.transform = "";
      }
      detailCurrentY = 0;
    }
  );
  // ── POPUP LOKASI CUSTOMER ──────────────────────────────
  window.openPopupLokasiCustomer = async function(customerId, namaCustomer) {
    // Buat overlay
    const existing = document.getElementById("popupLokasiOverlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "popupLokasiOverlay";
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      background:rgba(0,0,0,.45);backdrop-filter:blur(4px);
      display:flex;align-items:flex-end;justify-content:center;
      opacity:0;transition:opacity .25s ease;
    `;

    overlay.innerHTML = `
      <div id="popupLokasiBox" style="
        width:100%;max-width:540px;max-height:90dvh;
        background:var(--card-bg,#fff);border-radius:28px 28px 0 0;
        display:flex;flex-direction:column;overflow:hidden;
        transform:translateY(100%);transition:transform .3s cubic-bezier(.32,1,.4,1);
        box-shadow:0 -8px 40px rgba(0,0,0,.15);
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 20px 14px;border-bottom:1px solid var(--border-color,#e8ddd0);flex-shrink:0;">
          <div style="font-size:16px;font-weight:700;color:var(--text-primary,#2d2d2d);">Lokasi: ${namaCustomer}</div>
          <button id="popupLokasiClose" style="width:34px;height:34px;border:none;background:var(--bg-soft,#f5ede3);border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px;stroke:#2d2d2d;stroke-width:2.2;stroke-linecap:round;">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div style="flex:1;overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;flex-direction:column;gap:6px;">
            <label style="font-size:11px;font-weight:700;color:var(--text-secondary,#7a6a5a);text-transform:uppercase;letter-spacing:.4px;">Alamat</label>
            <textarea id="lokasiAlamatInput" rows="2" placeholder="Tulis alamat customer" style="
              width:100%;padding:12px 14px;border:1.5px solid var(--border-color,#e8ddd0);
              border-radius:12px;background:var(--input-bg,#faf6f2);color:var(--text-primary,#2d2d2d);
              font-size:14px;font-family:inherit;outline:none;resize:none;box-sizing:border-box;
            "></textarea>
          </div>

          <button id="lokasiAmbilBtn" style="
            width:100%;padding:12px;border:1.5px solid var(--primary,#C9A67B);border-radius:12px;
            background:var(--bg-soft,#f9f3ec);color:var(--primary-dark,#a8824e);
            font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;
            transition:background .2s;
          ">
            <svg viewBox="0 0 24 24" fill="none" style="width:18px;height:18px;stroke:currentColor;stroke-width:2;stroke-linecap:round;fill:none;">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
            </svg>
            <span id="lokasiAmbilText">Ambil Lokasi GPS</span>
          </button>

          <div id="lokasiMapContainer" style="width:100%;height:220px;border-radius:14px;overflow:hidden;display:none;border:1.5px solid var(--border-color,#e8ddd0);"></div>

          <div style="display:flex;flex-direction:column;gap:6px;">
            <label style="font-size:11px;font-weight:700;color:var(--text-secondary,#7a6a5a);text-transform:uppercase;letter-spacing:.4px;">Foto Customer</label>
            <div id="lokasiPhotoPreview" style="
              width:100%;height:110px;border:2px dashed var(--primary,#C9A67B);
              border-radius:12px;background:var(--bg-soft,#f9f3ec);
              display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
              cursor:pointer;overflow:hidden;position:relative;
            ">
              <svg viewBox="0 0 24 24" fill="none" style="width:28px;height:28px;stroke:var(--primary,#C9A67B);stroke-width:1.8;stroke-linecap:round;">
                <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="13" r="3"/>
                <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              <span style="font-size:12px;color:var(--primary,#C9A67B);font-weight:600;">Ambil Foto</span>
            </div>
            <input type="file" id="lokasiPhotoInput" accept="image/*" capture="environment" style="display:none">
          </div>

          <div id="lokasiStatusText" style="font-size:13px;color:var(--text-secondary,#7a6a5a);text-align:center;"></div>
        </div>

        <div style="padding:14px 20px 24px;flex-shrink:0;border-top:1px solid var(--border-color,#e8ddd0);">
          <button id="lokasiSimpanBtn" disabled style="
            width:100%;padding:14px;border:none;border-radius:14px;
            background:var(--primary,#C9A67B);color:#fff;
            font-size:15px;font-weight:700;cursor:pointer;opacity:.5;
            transition:opacity .2s,transform .15s;
          ">Simpan</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      document.getElementById("popupLokasiBox").style.transform = "translateY(0)";
    });

    // Load data existing
    let selectedLat = null, selectedLng = null, lokasiMap = null, lokasiMarker = null;

    try {
      const idb  = await window.openAppDB();
      const uid  = window.auth.currentUser?.uid;
      const hari = new Date().toLocaleDateString("id-ID", { weekday: "long" });

      // Cari dari customerHarianDB
      const hariNamaList = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
      const hariAktif    = hariNamaList[new Date().getDay()];
      const key          = `${uid}_${hariAktif}`;

      const raw = await new Promise(resolve => {
        const tx  = idb.transaction("customerHarianDB", "readonly");
        const req = tx.objectStore("customerHarianDB").get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => resolve(null);
      });

      const customer = raw?.data?.find(c => (c.idCustomer || c.id) === customerId);
      if (customer?.alamatCustomer) {
        document.getElementById("lokasiAlamatInput").value = customer.alamatCustomer;
      }
      if (customer?.lokasiCustomer) {
        const loc = window.normalizeGeoPoint?.(customer.lokasiCustomer) || customer.lokasiCustomer;
        if (loc?.lat && loc?.lng) {
          selectedLat = loc.lat;
          selectedLng = loc.lng;
          document.getElementById("lokasiStatusText").textContent = `📍 ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`;
          document.getElementById("lokasiSimpanBtn").disabled = false;
          document.getElementById("lokasiSimpanBtn").style.opacity = "1";
          tampilkanPeta(loc.lat, loc.lng);
        }
      }
    } catch(e) { console.log("load existing lokasi error:", e); }

    function tampilkanPeta(lat, lng) {
      const mapContainer = document.getElementById("lokasiMapContainer");
      mapContainer.style.display = "block";
      if (!lokasiMap) {
        lokasiMap = new google.maps.Map(mapContainer, {
          center: { lat, lng }, zoom: 17,
          mapId: "3f6f47bf59913618a195fe2e",
          zoomControl: true, mapTypeControl: false,
          streetViewControl: false, fullscreenControl: false
        });
        lokasiMarker = new google.maps.Marker({
          position: { lat, lng }, map: lokasiMap,
          draggable: true,
          animation: google.maps.Animation.DROP,
        });
        lokasiMarker.addListener("dragend", e => {
          selectedLat = e.latLng.lat();
          selectedLng = e.latLng.lng();
          document.getElementById("lokasiStatusText").textContent = `📍 ${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)}`;
        });
      } else {
        lokasiMap.setCenter({ lat, lng });
        lokasiMarker.setPosition({ lat, lng });
      }
    }
    
    // Setup foto
    let lokasiPhotoBlob = null;
    const lokasiPhotoPreview = document.getElementById("lokasiPhotoPreview");
    const lokasiPhotoInput   = document.getElementById("lokasiPhotoInput");

    // Load foto existing dari IndexedDB
    try {
      const idbF  = await window.openAppDB();
      const uidF  = window.auth.currentUser?.uid;
      const hariF = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][new Date().getDay()];
      const rawF  = await new Promise(resolve => {
        const tx  = idbF.transaction("customerHarianDB", "readonly");
        const req = tx.objectStore("customerHarianDB").get(`${uidF}_${hariF}`);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => resolve(null);
      });
      const custF = rawF?.data?.find(c => (c.idCustomer || c.id) === customerId);
      if (custF?.foto) {
        lokasiPhotoPreview.innerHTML = `<img src="${custF.foto}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:10px;">`;
      }
    } catch(e) {}

    lokasiPhotoPreview.addEventListener("click", () => lokasiPhotoInput.click());
    lokasiPhotoInput.addEventListener("change", async () => {
      const file = lokasiPhotoInput.files[0];
      if (!file) return;
      lokasiPhotoBlob = await window.compressImageInput(file, 800, 0.75);
      const url = URL.createObjectURL(lokasiPhotoBlob);
      lokasiPhotoPreview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:10px;">`;
    });

    // Ambil GPS
    document.getElementById("lokasiAmbilBtn").onclick = function() {
      const btn  = this;
      const text = document.getElementById("lokasiAmbilText");
      btn.disabled = true;
      text.textContent = "Mengambil...";
      function onGPSSuccess(pos) {
        selectedLat = pos.coords.latitude;
        selectedLng = pos.coords.longitude;
        btn.disabled = false;
        text.textContent = "Ambil Lokasi GPS";
        document.getElementById("lokasiStatusText").textContent = `📍 ${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)}`;
        document.getElementById("lokasiSimpanBtn").disabled = false;
        document.getElementById("lokasiSimpanBtn").style.opacity = "1";
        tampilkanPeta(selectedLat, selectedLng);
      }

      function onGPSError(err) {
        console.error("GPS error:", err.code, err.message);
        // Fallback: coba tanpa high accuracy
        if (err.code === 1 || err.code === 2) {
          navigator.geolocation.getCurrentPosition(
            onGPSSuccess,
            finalErr => {
              console.error("GPS fallback error:", finalErr.code, finalErr.message);
              btn.disabled = false;
              text.textContent = "Gagal, coba lagi";
              setTimeout(() => { text.textContent = "Ambil Lokasi GPS"; }, 2000);
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
          );
        } else {
          btn.disabled = false;
          text.textContent = "Gagal, coba lagi";
          setTimeout(() => { text.textContent = "Ambil Lokasi GPS"; }, 2000);
        }
      }

      navigator.geolocation.getCurrentPosition(
        onGPSSuccess,
        onGPSError,
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    };

    // Simpan
    document.getElementById("lokasiSimpanBtn").onclick = async function() {
      const btn    = this;
      const alamat = document.getElementById("lokasiAlamatInput").value.trim();
      if (!selectedLat || !selectedLng) return;

      btn.disabled = true;
      btn.textContent = "Menyimpan...";

      try {
        // Hitung jarak dari kantorCabang
        let jarak = 0;
        try {
          const user    = window.currentUser || {};
          const idb     = await window.openAppDB();
          const kantorRaw = await new Promise(resolve => {
            const tx  = idb.transaction("kantorDB", "readonly");
            const req = tx.objectStore("kantorDB").get(user.idCabang || "");
            req.onsuccess = () => resolve(req.result || null);
            req.onerror   = () => resolve(null);
          });
          const kantor = kantorRaw?.data || kantorRaw;
          const lok    = kantor?.lokasiCabang;
          if (lok) {
            const cabangLat = lok._lat ?? lok.latitude  ?? lok.lat;
            const cabangLng = lok._long ?? lok.longitude ?? lok.lng;
            if (cabangLat && cabangLng) {
              const toRad = v => v * Math.PI / 180;
              const R = 6371;
              const dLat = toRad(selectedLat - cabangLat);
              const dLng = toRad(selectedLng - cabangLng);
              const a = Math.sin(dLat/2)**2 + Math.cos(toRad(cabangLat)) * Math.cos(toRad(selectedLat)) * Math.sin(dLng/2)**2;
              jarak = Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2));
            }
          }
        } catch(e) { console.log("hitung jarak error:", e); }

        const updatePayload = {
          alamatCustomer : alamat,
          lokasiCustomer : new window.GeoPoint(selectedLat, selectedLng),
          jarak,
        };

        // Upload foto jika ada
        if (lokasiPhotoBlob && navigator.onLine) {
          try {
            const fileName   = `fotoCustomer/${customerId}_${Date.now()}.jpg`;
            const storageRef = window.storageRef(window.storage, fileName);
            await window.uploadBytes(storageRef, lokasiPhotoBlob);
            updatePayload.foto = await window.getDownloadURL(storageRef);
          } catch(e) {
            console.error("upload foto lokasi gagal:", e?.code, e?.message, e);
          }
        }

        // Simpan ke IndexedDB pending sync dulu
        const syncKey = `lokasi_${customerId}`;
        const idbSync = await window.openAppDB();
        await new Promise((resolve, reject) => {
          const tx    = idbSync.transaction("customerBaruDB", "readwrite");
          tx.objectStore("customerBaruDB").put({
            id        : syncKey,
            customerId,
            type      : "updateLokasi",
            payload   : {
              alamatCustomer : alamat,
              lokasiCustomer : { lat: selectedLat, lng: selectedLng },
              jarak,
            },
            isSync    : false,
            updatedAt : Date.now()
          });
          tx.oncomplete = () => resolve();
          tx.onerror    = () => reject(tx.error);
        });

        // Firestore update jika online
        if (navigator.onLine) {
          try {
            await window.updateDoc(
              window.doc(window.db, "customer", customerId),
              {
                alamatCustomer : alamat,
                lokasiCustomer : new window.GeoPoint(selectedLat, selectedLng),
                jarak,
                ...(updatePayload.foto ? { foto: updatePayload.foto } : {})
              }
            );
            // Update flag isSync
            const idbSync2 = await window.openAppDB();
            await new Promise((resolve, reject) => {
              const tx    = idbSync2.transaction("customerBaruDB", "readwrite");
              tx.objectStore("customerBaruDB").put({
                id        : syncKey,
                customerId,
                type      : "updateLokasi",
                payload   : {
                  alamatCustomer : alamat,
                  lokasiCustomer : { lat: selectedLat, lng: selectedLng },
                  jarak,
                },
                isSync    : true,
                updatedAt : Date.now()
              });
              tx.oncomplete = () => resolve();
              tx.onerror    = () => reject(tx.error);
            });
            console.log("✅ lokasi synced ke Firestore");
          } catch(err) {
            console.log("❌ Firestore gagal, akan sync nanti:", err);
          }
        } else {
          console.log("📴 Offline — lokasi disimpan lokal, sync nanti");
        }

        // Update IndexedDB customerHarianDB
        const uid        = window.auth.currentUser?.uid;
        const hariNamaList = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
        const hariAktif  = hariNamaList[new Date().getDay()];
        const cacheKey   = `${uid}_${hariAktif}`;
        const idb        = await window.openAppDB();
        const existing   = await new Promise(resolve => {
          const tx  = idb.transaction("customerHarianDB", "readonly");
          const req = tx.objectStore("customerHarianDB").get(cacheKey);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror   = () => resolve(null);
        });

        if (existing && Array.isArray(existing.data)) {
          const idx = existing.data.findIndex(c => (c.idCustomer || c.id) === customerId);
          if (idx !== -1) {
            existing.data[idx] = {
              ...existing.data[idx],
              alamatCustomer : alamat,
              lokasiCustomer : { lat: selectedLat, lng: selectedLng },
              jarak,
              ...(updatePayload.foto ? { foto: updatePayload.foto } : {})
            };
            await new Promise((resolve, reject) => {
              const tx  = idb.transaction("customerHarianDB", "readwrite");
              tx.objectStore("customerHarianDB").put({ ...existing, updatedAt: Date.now() });
              tx.oncomplete = () => resolve();
              tx.onerror    = () => reject(tx.error);
            });
          }
        }

        // Update memory listCustomerData & customerDataMap
        const entry = window.listCustomerData?.find(x => (x.idCustomer || x.id) === customerId);
        if (entry) { entry.alamatCustomer = alamat; entry.lokasiCustomer = { lat: selectedLat, lng: selectedLng }; entry.jarak = jarak; }
        if (window.customerDataMap?.[customerId]) {
          window.customerDataMap[customerId].alamatCustomer = alamat;
          window.customerDataMap[customerId].lokasiCustomer = { lat: selectedLat, lng: selectedLng };
          window.customerDataMap[customerId].jarak = jarak;
        }

        btn.textContent = "Berhasil ✓";
        setTimeout(() => closeLokasi(), 1200);
      } catch(err) {
        console.error("Gagal simpan lokasi:", err);
        btn.disabled = false;
        btn.textContent = "Gagal, coba lagi";
        setTimeout(() => { btn.textContent = "Simpan"; btn.disabled = false; }, 2000);
      }
    };

    function closeLokasi() {
      const box = document.getElementById("popupLokasiBox");
      const ov  = document.getElementById("popupLokasiOverlay");
      if (!ov) return;
      ov.style.opacity = "0";
      if (box) box.style.transform = "translateY(100%)";
      setTimeout(() => ov.remove(), 300);
    }

    document.getElementById("popupLokasiClose").onclick = closeLokasi;
    overlay.addEventListener("click", e => { if (e.target === overlay) closeLokasi(); });

    // Swipe close mobile
    const box = document.getElementById("popupLokasiBox");
    let swipeStartY = 0, swipeCurY = 0, swipeActive = false;
    box.addEventListener("touchstart", e => {
      if (box.scrollTop > 10) return;
      swipeStartY = swipeCurY = e.touches[0].clientY;
      swipeActive = true; box.style.transition = "none";
    }, { passive: true });
    box.addEventListener("touchmove", e => {
      if (!swipeActive) return;
      swipeCurY = e.touches[0].clientY;
      const d = swipeCurY - swipeStartY;
      if (d < 0) return;
      box.style.transform = `translateY(${d * .9}px)`;
    }, { passive: true });
    box.addEventListener("touchend", () => {
      if (!swipeActive) return;
      swipeActive = false;
      const d = swipeCurY - swipeStartY;
      box.style.transition = "transform .28s ease";
      if (d > 120) { closeLokasi(); } else { box.style.transform = ""; }
    });
  };
  window._inputViewCleanup = function(){
    if(window.catatanUnsubscribe){
      window.catatanUnsubscribe();
      window.catatanUnsubscribe = null;
    }
    Object.keys(window).forEach(key=>{
      if(key.startsWith("refreshBadge_")) delete window[key];
    });
    if(window._onDocClickPreviewFoto){
      document.removeEventListener("click", window._onDocClickPreviewFoto);
      window._onDocClickPreviewFoto = null;
    }
    window._inputViewCleanup = null;
  };
};

window.syncQueueRunning = false;
async function syncQueueToFirestore() {
  if (window.syncQueueRunning) return;
  window.syncQueueRunning = true;

  try {
    const db = await window.openAppDB();

    // READ SEMUA DULU (bukan di dalam callback)
    const all = await new Promise((resolve, reject) => {
      const tx = db.transaction("dataHarianDB", "readonly");
      const store = tx.objectStore("dataHarianDB");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    // Filter yang belum sync, semua tanggal (bukan hanya hari ini)
    const pending = all.filter(x => x.isSync === false && x.idCustomer && x.tanggal);
    console.log(`🔄 Sync queue: ${pending.length} item pending dari ${all.length} total record`);
    console.log(`🔄 Sync queue: ${pending.length} item pending`);

    for (const item of pending) {
      try {
        if (!item.idCustomer || !item.tanggal) continue;

        const docRef = window.doc(
          window.db,
          "customer",
          item.idCustomer,
          "dataHarian",
          item.tanggal
        );

        await window.setDoc(docRef, item.payload || item, { merge: true });

        // Update sync status — buka transaksi baru setelah await selesai
        const db2 = await window.openAppDB();
        await new Promise((resolve, reject) => {
          const tx2 = db2.transaction("dataHarianDB", "readwrite");
          const store2 = tx2.objectStore("dataHarianDB");
          const req2 = store2.put({
            ...item,
            isSync: true,
            syncedAt: Date.now()
          });
          req2.onsuccess = () => resolve();
          req2.onerror = () => reject(req2.error);
        });

        console.log(`✅ Synced: ${item.idCustomer} - ${item.tanggal}`);

      } catch (err) {
        console.log(`❌ Sync gagal: ${item.idCustomer}`, err);
        // Lanjut ke item berikutnya, jangan stop semua
      }
    }

  } catch (err) {
    console.log("syncQueueToFirestore error:", err);
  } finally {
    // Selalu reset flag meski error
    window.syncQueueRunning = false;
  }
}
window.addEventListener("online", () => {
  syncQueueToFirestore();
});
window.addEventListener("load", () => {
  if (navigator.onLine) {
    syncQueueToFirestore();
  }
});