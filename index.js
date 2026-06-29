
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import "./fcm.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  writeBatch,
  collectionGroup,
  addDoc,
  setDoc,
  serverTimestamp,
  GeoPoint,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  getDocs,
  onSnapshot,
  deleteField
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:"AIzaSyCp32H2WeN3A4ZwwWeUWe3Qcjqh0mz_vvQ",
  authDomain:"teh-tarik-nusantara-26371.firebaseapp.com",
  projectId:"teh-tarik-nusantara-26371",
  storageBucket:"teh-tarik-nusantara-26371.firebasestorage.app",
  messagingSenderId:"354760960352",
  appId:"1:354760960352:web:7d6a6c07dace937a74d605",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
const db = getFirestore(app);
const storage = getStorage(app);

let currentView = "home";

window.auth = auth;
window.db = db;
window.serverTimestamp = serverTimestamp;
window.GeoPoint = GeoPoint;
window.collection = collection;
window.addDoc = addDoc;
window.doc = doc;
window.setDoc = setDoc;
window.getDoc = getDoc;
window.query = query;
window.where = where;
window.orderBy = orderBy;
window.limit = limit;
window.getDocs = getDocs;
window.collectionGroup = collectionGroup;
window.onSnapshot = onSnapshot;
window.updateDoc = updateDoc;
window.deleteField = deleteField;
window.writeBatch = writeBatch;
window.storage = storage;
window.storageRef = storageRef;
window.uploadBytes = uploadBytes;
window.getDownloadURL = getDownloadURL;
window.currentUser = null;
window.globalUsersCache = [];

onAuthStateChanged(auth, async(user)=>{
  if(user){
    try{
      const docRef = doc(db,"users",user.uid);
      const docSnap = await getDoc(docRef);
      if(docSnap.exists()){
        const userData =
          docSnap.data();
        window.currentUser = {
          uid: user.uid,
          email: user.email,
          ...userData
        };
        // simpan cache
        localStorage.setItem("userCache", JSON.stringify(window.currentUser)
        );
      }
    }catch(err){
      // OFFLINE MODE
      const cache = localStorage.getItem("userCache");
      if(cache){
        window.currentUser = JSON.parse(cache);
      }else{
        window.location.href = "login.html";
        return;
      }
    }
    // Sync customer hari ini ke IndexedDB saat online
    if(navigator.onLine && window.currentUser?.uid){
      window.syncCustomerHarian?.();
    }
    // Sync kantor cabang ke IDB saat online
    if (navigator.onLine && window.currentUser?.idCabang) {
      try {
        const idCabang  = window.currentUser.idCabang;
        const idbK      = await window.openAppDB();
        const existing  = await new Promise(resolve => {
          const tx  = idbK.transaction("kantorDB", "readonly");
          const req = tx.objectStore("kantorDB").get(idCabang);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror   = () => resolve(null);
        });
        if (!existing) {
          const kantorSnap = await window.getDoc(window.doc(window.db, "kantorCabang", idCabang));
          if (kantorSnap.exists()) {
            const kantorData = kantorSnap.data();
            const idbK2 = await window.openAppDB();
            await new Promise((resolve, reject) => {
              const tx    = idbK2.transaction("kantorDB", "readwrite");
              tx.objectStore("kantorDB").put({ id: idCabang, data: kantorData, updatedAt: Date.now() });
              tx.oncomplete = () => resolve();
              tx.onerror    = () => reject(tx.error);
            });
            window.globalKantor = kantorData;
          }
        } else {
          window.globalKantor = existing.data;
        }
      } catch { }
    }
    initNavbar();
    showView("home");
  } else {
    // Cek cache dulu sebelum redirect
    const cache = localStorage.getItem("userCache");
    if (cache && !navigator.onLine) {
      // Offline dan ada cache — jangan logout
      window.currentUser = JSON.parse(cache);
      initNavbar();
      showView("home");
    } else {
      localStorage.clear();
      window.location.href = "login.html";
    }
  }
});
window.logout = async function(){
  try{
    if (window.homeClock) { clearInterval(window.homeClock); window.homeClock = null; }
    await signOut(auth);
    localStorage.clear();
    window.location.href = "login.html";
  }catch(err){  }
};
// PULL TO REFRESH
(function() {
  const indicator = document.getElementById("pullRefreshIndicator");
  const circle    = document.getElementById("ptrCircle");
  const THRESHOLD = 250;
  const FULL_DASH = 226;

  let startY     = 0;
  let pulling    = false;
  let refreshing = false;
  let hasPulled  = false;

  function isPopupOpen() {
    return [...document.querySelectorAll(
      "[id*='popup'],[id*='Popup'],[id*='overlay'],[id*='Overlay'],[id*='Panel'],[id*='Dropdown']"
    )].some(el =>
      el.classList.contains("active") ||
      el.classList.contains("open") ||
      el.style.display === "flex"
    );
  }

  function canPull() {
    if (isPopupOpen()) return false;
    if (window.currentView === "map") return false;
    if (window.currentView === "inputTabel") return false;
    const app = document.getElementById("app");
    if (app.scrollTop > 0) return false;
    const activeView = document.querySelector(".view.active");
    if (activeView && activeView.scrollTop > 0) return false;
    // Cek semua elemen scrollable di dalam view aktif
    if (activeView) {
      const scrollables = activeView.querySelectorAll("*");
      for (const el of scrollables) {
        if (el.scrollTop > 0) return false;
      }
    }
    return true;
  }
  window.addEventListener("touchstart", (e) => {
    if (refreshing || !canPull()) return;
    startY    = e.touches[0].clientY;
    pulling   = true;
    hasPulled = false;
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (!pulling || refreshing) return;
    const deltaY = e.touches[0].clientY - startY;

    if (deltaY <= 0) {
      // Blokir scroll naik HANYA jika sebelumnya sudah pernah tarik ke bawah
      if (hasPulled) e.preventDefault();
      indicator.style.transition = "transform 0.3s cubic-bezier(0.25,1,0.5,1)";
      indicator.style.transform  = "translateY(-60px)";
      circle.style.strokeDashoffset = FULL_DASH;
      return;
    }

    // Sudah tarik ke bawah — set flag & blokir scroll
    hasPulled = true;
    e.preventDefault();

    const damped   = Math.min(deltaY * 0.45, 100);
    const raw      = Math.min(deltaY / THRESHOLD, 1);
    const progress = Math.pow(raw, 1.4);

    indicator.style.transition = "none";
    indicator.style.transform  = `translateY(${damped - 70}px)`;
    // Circle penuh (100%) saat threshold tercapai
    circle.style.strokeDashoffset = FULL_DASH - (FULL_DASH * progress);
  }, { passive: false });

  window.addEventListener("touchend", (e) => {
    if (!pulling || refreshing) return;
    pulling   = false;
    hasPulled = false;

    const deltaY = e.changedTouches[0].clientY - startY;
    if (deltaY >= THRESHOLD) {
      refreshing = true;
      // Snap ke posisi tetap saat loading
      indicator.style.transition = "transform 0.3s cubic-bezier(0.25,1,0.5,1)";
      indicator.style.transform  = "translateY(4px)";
      indicator.classList.add("ptr-loading");

      setTimeout(() => {
        window.showView?.(window.currentView || "home");
        setTimeout(() => {
          // Animasi balik ke atas
          indicator.style.transition = "transform 0.4s cubic-bezier(0.25,1,0.5,1)";
          indicator.style.transform  = "translateY(-60px)";
          indicator.classList.remove("ptr-loading");
          circle.style.strokeDashoffset = FULL_DASH;
          setTimeout(() => {
            indicator.style.transition = "none";
            refreshing = false;
          }, 400);
        }, 600);
      }, 800);
    } else {
      // Tidak sampai threshold — balik halus
      indicator.style.transition = "transform 0.35s cubic-bezier(0.25,1,0.5,1)";
      indicator.style.transform  = "translateY(-60px)";
      circle.style.strokeDashoffset = FULL_DASH;
      setTimeout(() => {
        indicator.style.transition = "none";
      }, 350);
    }
  }, { passive: true });
})();
window.openAppDB = function () {
  return new Promise( (resolve, reject) => {
    const request = indexedDB.open("appDB", 10);
    request.onupgradeneeded = function (event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("customerHarianDB")) {
        db.createObjectStore("customerHarianDB", {keyPath: "id"});
      }
      if (!db.objectStoreNames.contains("usersDB")) {
        db.createObjectStore("usersDB", {keyPath: "id"});
      }
      if (!db.objectStoreNames.contains("kantorDB")) {
        db.createObjectStore("kantorDB", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("customerBaruDB")) {
        db.createObjectStore("customerBaruDB", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("dataHarianDB")) {
        const store = db.createObjectStore("dataHarianDB", { keyPath: "id" }
          );
        store.createIndex("customerId", "customerId",
          { unique: false }
        );
        store.createIndex("tanggal", "tanggal",
          { unique: false }
        );
      }
      if (!db.objectStoreNames.contains("laporanMarketingDB")) {
        const store = db.createObjectStore("laporanMarketingDB", { keyPath: "id" });
        store.createIndex("tanggal", "tanggal", { unique: false });
        store.createIndex("idMarketing", "idMarketing", { unique: false });
      }
      if (!db.objectStoreNames.contains("customerLainDB")) {
        db.createObjectStore("customerLainDB", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("customerHunterDB")) {
        db.createObjectStore("customerHunterDB", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("customerSalesDB")) {
        db.createObjectStore("customerSalesDB", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("customerSalesLainDB")) {
        db.createObjectStore("customerSalesLainDB", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("slipGajiDB")) {
        const store = db.createObjectStore("slipGajiDB", { keyPath: "id" });
        store.createIndex("idUsers", "idUsers", { unique: false });
        store.createIndex("bulanKey", "bulanKey", { unique: false });
      }
      if (!db.objectStoreNames.contains("penjualanLangsungDB")) {
        const store = db.createObjectStore("penjualanLangsungDB", { keyPath: "id" });
        store.createIndex("tanggal", "tanggal", { unique: false });
        store.createIndex("uid", "uid", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};
function showSyncToast(pesan, sukses = true) {
  const existing = document.getElementById("syncToastEl");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "syncToastEl";
  toast.textContent = pesan;
  toast.style.cssText = `
    position:fixed;bottom:120px;left:50%;transform:translateX(-50%);
    background:${sukses ? "#2eaf62" : "#e53935"};
    color:#fff;padding:10px 20px;border-radius:20px;
    font-size:13px;font-weight:600;z-index:99999;
    white-space:nowrap;max-width:90vw;text-align:center;
    animation:csToastIn .3s cubic-bezier(.34,1.56,.64,1) both;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), sukses ? 2000 : 5000);
}
async function doSyncAll(pendingHarian, pendingPenjualan, db) {
  const BATCH_SIZE = 500;
  const allPending = [...pendingHarian, ...pendingPenjualan];

  for (let i = 0; i < allPending.length; i += BATCH_SIZE) {
    const chunk = allPending.slice(i, i + BATCH_SIZE);
    const batch = window.writeBatch(window.db);

    chunk.forEach(item => {
      let docRef;
      if (item._type === "penjualan") {
        docRef = window.doc(window.db, "users", item.uid, "penjualanLangsung", item.tanggal);
        const { _type, id, isSync, updatedAt, ...payload } = item;
        batch.set(docRef, { ...payload, updatedAt: window.serverTimestamp() });
      } else {
        docRef = window.doc(window.db, "customer", item.idCustomer, "dataHarian", item.tanggal);
        batch.set(docRef, item.payload, { merge: true });
      }
    });

    await batch.commit();

    // Update IDB isSync: true untuk dataHarianDB
    const txH = db.transaction("dataHarianDB", "readwrite");
    const storeH = txH.objectStore("dataHarianDB");
    chunk.filter(x => x._type !== "penjualan").forEach(item => {
      item.isSync = true;
      item.syncedAt = Date.now();
      storeH.put(item);
    });
    await new Promise((resolve, reject) => {
      txH.oncomplete = resolve;
      txH.onerror = () => reject(txH.error);
    });

    // Update IDB isSync: true untuk penjualanLangsungDB
    const txP = db.transaction("penjualanLangsungDB", "readwrite");
    const storeP = txP.objectStore("penjualanLangsungDB");
    chunk.filter(x => x._type === "penjualan").forEach(item => {
      const { _type, ...clean } = item;
      clean.isSync = true;
      clean.syncedAt = Date.now();
      storeP.put(clean);
    });
    await new Promise((resolve, reject) => {
      txP.oncomplete = resolve;
      txP.onerror = () => reject(txP.error);
    });
  }
}
window.syncOfflineDataHarian = async function() {
  try {
    if (!navigator.onLine) return;

    const db = await window.openAppDB();

    // Load pending dataHarianDB
    const allHarian = await new Promise((resolve, reject) => {
      const tx  = db.transaction("dataHarianDB", "readonly");
      const req = tx.objectStore("dataHarianDB").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
    const pendingHarian = allHarian.filter(item =>
      item?.isSync === false && item?.payload && item?.idCustomer && item?.tanggal
    );

    // Load pending penjualanLangsungDB
    const allPenjualan = await new Promise((resolve, reject) => {
      const tx  = db.transaction("penjualanLangsungDB", "readonly");
      const req = tx.objectStore("penjualanLangsungDB").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
    const pendingPenjualan = allPenjualan
      .filter(item => item?.isSync === false && item?.uid && item?.tanggal)
      .map(item => ({ ...item, _type: "penjualan" }));

    if (pendingHarian.length === 0 && pendingPenjualan.length === 0) return;

    const total = pendingHarian.length + pendingPenjualan.length;

    try {
      await doSyncAll(pendingHarian, pendingPenjualan, db);
      showSyncToast(`✓ ${total} data berhasil tersimpan`, true);
    } catch {
      setTimeout(async () => {
        try {
          await doSyncAll(pendingHarian, pendingPenjualan, db);
          showSyncToast(`✓ ${total} data berhasil tersimpan`, true);
        } catch {
          showSyncToast("Data input gagal terkirim, cek internet atau buka aplikasi kembali", false);
        }
      }, 3000);
    }
  } catch { }
};
window.syncPendingLokasi = async function() {
  try {
    if (!navigator.onLine) return;
    const uid = window.auth?.currentUser?.uid;
    if (!uid) return;

    const idb = await window.openAppDB();
    const all = await new Promise((resolve, reject) => {
      const tx  = idb.transaction("customerBaruDB", "readonly");
      const req = tx.objectStore("customerBaruDB").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });

    const pending = all.filter(x => x.type === "updateLokasi" && x.isSync === false);

    for (const item of pending) {
      try {
        const { customerId, payload } = item;

        // Upload foto lokal jika ada dan belum di-upload
        let fotoUrl = payload.foto || null;
        if (!fotoUrl && payload.fotoLokal) {
          try {
            const base64   = payload.fotoLokal;
            const arr      = base64.split(",");
            const mime     = arr[0].match(/:(.*?);/)[1];
            const bstr     = atob(arr[1]);
            let n          = bstr.length;
            const u8arr    = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            const blob     = new Blob([u8arr], { type: mime });
            const fileName = `fotoCustomer/${customerId}_${Date.now()}.jpg`;
            const sRef     = window.storageRef(window.storage, fileName);
            await window.uploadBytes(sRef, blob);
            fotoUrl        = await window.getDownloadURL(sRef);
          } catch { }
        }

        await window.updateDoc(
          window.doc(window.db, "customer", customerId),
          {
            alamatCustomer : payload.alamatCustomer,
            lokasiCustomer : new window.GeoPoint(payload.lokasiCustomer.lat, payload.lokasiCustomer.lng),
            jarak          : payload.jarak,
            ...(fotoUrl ? { foto: fotoUrl } : {})
          }
        );

        // Update flag isSync
        const idb2 = await window.openAppDB();
        await new Promise((resolve, reject) => {
          const tx = idb2.transaction("customerBaruDB", "readwrite");
          tx.objectStore("customerBaruDB").put({ ...item, isSync: true, updatedAt: Date.now() });
          tx.oncomplete = () => resolve();
          tx.onerror    = () => reject(tx.error);
        });

        // Update customerHarianDB — ganti fotoLokal dengan URL Storage
        if (fotoUrl) {
          try {
            const uid2      = window.auth?.currentUser?.uid;
            const hariList  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
            const hariAktif = hariList[new Date().getDay()];
            const idb3      = await window.openAppDB();
            const existing3 = await new Promise(resolve => {
              const tx  = idb3.transaction("customerHarianDB", "readonly");
              const req = tx.objectStore("customerHarianDB").get(`${uid2}_${hariAktif}`);
              req.onsuccess = () => resolve(req.result || null);
              req.onerror   = () => resolve(null);
            });
            if (existing3?.data) {
              const idx = existing3.data.findIndex(c => (c.idCustomer || c.id) === customerId);
              if (idx !== -1) {
                existing3.data[idx] = {
                  ...existing3.data[idx],
                  foto      : fotoUrl,
                  fotoLokal : null  // hapus base64 lokal
                };
                const idb4 = await window.openAppDB();
                await new Promise((resolve, reject) => {
                  const tx = idb4.transaction("customerHarianDB", "readwrite");
                  tx.objectStore("customerHarianDB").put({ ...existing3, updatedAt: Date.now() });
                  tx.oncomplete = () => resolve();
                  tx.onerror    = () => reject(tx.error);
                });
                // Update memory juga
                if (window.customerDataMap?.[customerId]) {
                  window.customerDataMap[customerId].foto      = fotoUrl;
                  window.customerDataMap[customerId].fotoLokal = null;
                }
                if (window.listCustomerData) {
                  const entry = window.listCustomerData.find(x => (x.idCustomer || x.id) === customerId);
                  if (entry) { entry.foto = fotoUrl; entry.fotoLokal = null; }
                }
                // Dispatch event supaya UI update
                window.dispatchIdbUpdate?.("customerHarianDB", customerId);
              }
            }
          } catch { }
        }
      } catch { }
    }
  } catch { }
};
window.syncCustomerHarian = async function(){
  try{
    if(!navigator.onLine) return;
    const uid = window.auth?.currentUser?.uid;
    if(!uid) return;

    const hariNama  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    const hariAktif = hariNama[new Date().getDay()];

    const q = window.query(
      window.collection(window.db, "customer"),
      window.where("pemilik", "==", uid),
      window.where("status",  "==", true),
      window.where("hari",    "==", hariAktif)
    );

    const snap = await window.getDocs(q);
    if(snap.empty) return;

    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const db  = await window.openAppDB();
    const tx  = db.transaction("customerHarianDB", "readwrite");
    const store = tx.objectStore("customerHarianDB");

    store.put({ id: `${uid}_${hariAktif}`, data });
  } catch { }
};
window.addEventListener(
  "online",
  function(){
    window.syncOfflineDataHarian();
    window.syncCustomerHarian?.();
    window.syncPendingLokasi?.();
    window.syncPendingHunter?.();
    window.syncPendingSales?.();
  }
);
window.getCustomerFromIndexDB = async function(idCustomer) {
  const db = await window.openAppDB();
  const tx = db.transaction("customerHarianDB", "readonly");
  const store = tx.objectStore("customerHarianDB");

  return new Promise((resolve) => {
    const req = store.getAll();

    req.onsuccess = function() {
      const raw = req.result || [];

      let all = [];
      raw.forEach(item => {
        if (Array.isArray(item.data)) {
          all.push(...item.data);
        } else {
          all.push(item);
        }
      });

      const found = all.find(x => x.idCustomer === idCustomer || x.id === idCustomer);

      resolve(found || null);
    };

    req.onerror = function() {
      resolve(null);
    };
  });
};

// LOCK HEIGHT keyboard android tidak resize layout
function setAppHeight(){
  if(!window.initialAppHeight){
    window.initialAppHeight = window.innerHeight;
  }
  document.documentElement.style.setProperty(
      "--app-height",
      `${window.initialAppHeight}px`
    );
}
window.addEventListener("orientationchange",
  ()=>{
    setTimeout(()=>{
      window.initialAppHeight = window.innerHeight;
      setAppHeight();
    },300);
  }
);

// "navbar" | "direct" | "back"
function showView(viewName, trigger = "direct"){
  currentView = viewName;
  window.currentView = viewName;
  // Update hash tanpa trigger hashchange
  if (location.hash !== "#" + viewName) {
    history.replaceState(null, "", "#" + viewName);
  }
  document.querySelectorAll(".view").forEach(view=>{
    view.classList.remove("active","anim-slide-up","anim-slide-right","anim-slide-left");
  });

  const target = document.getElementById(`view-${viewName}`);
  if(target){
    target.classList.add("active");

    // ── Animasi config — ubah mapping di sini ──
    const ANIM_MAP = {
      navbar : "anim-navbar",
      direct : "anim-direct",
      back   : "anim-back",
    };
    const animOff  = localStorage.getItem("pref_anim") === "0";
    const animClass = (!animOff && ANIM_MAP[trigger]) ?? null;
    if (animClass) {
      target.classList.add(animClass);
      target.addEventListener("animationend", () => {
        target.classList.remove(animClass);
      }, { once: true });
    }

    target.scrollTop = 0;
  }
  // AI button: hidden saat di chatAi, tampil di view lain
  if (localStorage.getItem("pref_ai") !== "0") {
    if (viewName === "chatAi") {
      window.hideAiButton?.();
    } else {
      window.showAiButton?.();
    }
  }

  // Reset scroll container utama juga (app)
  const appEl = document.getElementById("app");
  if(appEl){
    appEl.scrollTop = 0;
  }

  const navbar = document.querySelector(".navbar-bottom") || document.getElementById("navbarBottom");

  const hideNavbarViews = [
    "customer",
    "input",
    "inputTabel",
    "analisis",
    "rolling",
    "tentang",
    "keamanan",
    "perjanjian",
    "slip",
    "rollingcustomer",
    "chatAi",
    "peraturan",
    "customersales"
  ];

  if (navbar) {
    if (hideNavbarViews.includes(viewName)) {
      navbar.classList.add("hide");
    } else {
      navbar.classList.remove("hide");
    }
  }

  // Cleanup home clock saat pindah dari home
  if (viewName !== "home" && window.homeClock) {
    clearInterval(window.homeClock);
    window.homeClock = null;
  }
  // Cleanup tabel canvas saat pindah view
  if (viewName !== "inputTabel") window._tabelCleanup?.();
  switch(viewName){
    case "home": window.initHomeView?.(); break;
    case "input": window.initInputView?.(); break;
    case "customer": window.initCustomerView?.(); break;
    case "inputTabel": window.initInputTabelView?.(); break;
    case "analisis": window.initAnalisisView?.(); break;
    case "profil": window.initProfilView?.(); break;
    case "rolling": window.initRollingView?.(); break;
    case "operasional": window.initOperasionalView?.(); break;
    case "tentang": break;
    case "keamanan": window.initKeamananView?.(); break;
    case "perjanjian": window.initPerjanjianView?.(); break;
    case "slip": window.initSlipDataView?.(); break;
    case "rollingcustomer": window.initRollingCustomerView?.(); break;
    case "chatAi": window.initChatAiView?.(); break;
    case "peraturan": window.initPeraturanView?.(); break;
    case "customersales": window.initCustomerSalesView?.(); break;
    case "laporanharian": window.initLaporanHarianView?.(); break;
  }

  // Reset scroll semua view container
  document.querySelectorAll(".view").forEach(v => {
    v.scrollTop = 0;
    // Reset scroll di dalam view juga (kalau ada nested scroll)
    v.querySelectorAll("[style*='overflow'], .scroll-container").forEach(el => {
      el.scrollTop = 0;
    });
  });
}
window.showView = showView;
function closeActivePopup(){
  const popupIds = [
    "popupInputOverlay",
    "popupInputFdOverlay",
    "popupWarningOverlay",
    "previewFotoOverlay",
    "popupHeaderDetailOverlay",
    "popupCustomer",
    "popupCatatanCustomer",
    "popupHomeCustomer",
    "analysisDropdown",
    "slipDropOverlay",
    "slipDropPopup",
    "aksesPanel",
    "mapPopupRouting",
    "mapPopupHome",
    "popupRincianPin"
  ];

  for(const id of popupIds){
    const el = document.getElementById(id);
    if(!el) continue;

    // Popup map pakai display flex/none, bukan class active
    const isMapPopup = ["mapPopupRouting", "mapPopupHome", "popupRincianPin"].includes(id);
    const isActive = isMapPopup
      ? el.style.display === "flex"
      : el.classList.contains("active") ||
        (id === "aksesPanel" && el.classList.contains("open"));

    if(isActive){
      if(isMapPopup){
        // Tutup rincian pin dulu sebelum routing
        if(id === "popupRincianPin"){
          el.style.display = "none";
        } else if(id === "mapPopupRouting"){
          // Stop navigasi & GPS dulu
          if(window._rollingWatchId){
            navigator.geolocation.clearWatch(window._rollingWatchId);
            window._rollingWatchId = null;
          }
          if(window.deviceOrientationHandler){
            window.removeEventListener("deviceorientation", window.deviceOrientationHandler, true);
            window.deviceOrientationHandler = null;
          }
          el.style.display = "none";
          // Reset tombol mulai
          const btnMulai = document.getElementById("btnMulaiNavigasiRouting");
          if(btnMulai){
            btnMulai.textContent = "▶ Mulai";
            btnMulai.style.background = "";
            btnMulai.style.display = "";
          }
          const infoEl = document.getElementById("infoJarakRouting");
          if(infoEl) infoEl.style.display = "none";
        } else if(id === "mapPopupHome"){
          el.style.display = "none";
          document.body.style.overflow = "";
        }
        return true;
      }
      // Slip dropdown: close overlay + popup sekaligus
      if(id === "aksesPanel"){
        el.classList.remove("open");
        setTimeout(() => el.style.display = "none", 380);
      } else if(id === "slipDropOverlay" || id === "slipDropPopup"){
        document.getElementById("slipDropOverlay")?.classList.remove("active");
        document.getElementById("slipDropPopup")?.classList.remove("active");
        // Reset transform kalau lagi di-swipe
        const p = document.getElementById("slipDropPopup");
        if(p) p.style.transform = "";
        // Reset arrow tombol trigger
        document.querySelectorAll(".slip-custom-select.open")
          .forEach(b => b.classList.remove("open"));
      } else {
        el.classList.remove("active");
      }
      return true;
    }
  }
  return false;
}
// Blocker supaya back tidak keluar ke login.html
history.pushState({ app: true }, "");
history.pushState({ app: true }, "");
history.pushState({ app: true }, "");
// ── ANDROID BACK via hashchange ──────────────────
// Set hash awal
location.hash = "home";

let _backLocked = false;

function _handleBack() {
  if (_backLocked) return;
  _backLocked = true;

  if (closeActivePopup()) {
    history.replaceState(null, "", "#" + currentView);
    // Push state baru supaya back berikutnya tetap ada
    setTimeout(() => {
      history.pushState({ app: true }, "", "#" + currentView);
      _backLocked = false;
    }, 300);
    return;
  }
  if (currentView !== "home") {
    const backToProfilViews = [
      "tentang", "keamanan", "perjanjian",
      "slip", "rollingcustomer", "peraturan"
    ];
    const backToInputViews = ["inputTabel"];

    const backTarget = backToProfilViews.includes(currentView)
      ? "profil"
      : backToInputViews.includes(currentView)
      ? "input"
      : "home";

    showView(backTarget, "back");

    document.querySelectorAll(".nav-item").forEach(i => {
      if (i.dataset.label) {
        i.innerHTML =
          `<i class="${i.dataset.icon}"></i>` +
          `<span>${i.dataset.label}</span>`;
      }
      i.classList.remove("active");
    });
    const targetNav = document.querySelector(`.nav-item[data-view="${backTarget}"]`);
    if (targetNav) {
      targetNav.innerHTML =
        `<span class="nav-placeholder"></span>` +
        `<span>${targetNav.dataset.label}</span>`;
      targetNav.classList.add("active");
      window._moveFab?.(targetNav);
    }
  }

  setTimeout(() => {
    history.replaceState(null, "", "#" + currentView);
    _backLocked = false;
  }, 300);
}

window.addEventListener("hashchange", function() {
  _handleBack();
});
document.addEventListener("backbutton",
  function(e){
    if(closeActivePopup()){
      e.preventDefault();
      return;
    }
    if(currentView !== "home"){
      e.preventDefault();

      const backToProfilViews = [
        "tentang", "keamanan", "perjanjian",
        "slip", "rollingcustomer"
      ];

      const backToInputViews = ["inputTabel"];

      const backTarget = backToProfilViews.includes(currentView)
        ? "profil"
        : backToInputViews.includes(currentView)
        ? "input"
        : "home";
      showView(backTarget, "back");

      // Update FAB & active state
      document.querySelectorAll(".nav-item").forEach(i => {
        if (i.dataset.label) {
          i.innerHTML =
            `<i class="${i.dataset.icon}"></i>` +
            `<span>${i.dataset.label}</span>`;
        }
        i.classList.remove("active");
      });

      const targetNav = document.querySelector(`.nav-item[data-view="${backTarget}"]`);
      if (targetNav) {
        targetNav.innerHTML =
          `<span class="nav-placeholder"></span>` +
          `<span>${targetNav.dataset.label}</span>`;
        targetNav.classList.add("active");
        window._moveFab?.(targetNav);
      }

      return;
    }
    navigator.app.exitApp?.();
  },
  false
);

function initNavbar() {
  const fab     = document.getElementById("navFab");
  const fabIcon = document.getElementById("navFabIcon");
  const svgPath = document.getElementById("navSvgPath");

  // Hitung posisi FAB dari posisi DOM aktual (tidak pakai data-index)
  function getFabLeftPercent(item) {
    const navbar   = document.getElementById("navbarBottom");
    const navRect  = navbar.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const centerX  = itemRect.left + itemRect.width / 2 - navRect.left;
    return (centerX / navRect.width) * 100;
  }

  function buildPath(leftPercent) {
    const css = getComputedStyle(document.documentElement);
    const W   = 400;
    const cx  = (leftPercent / 100) * W;
    const r   = parseFloat(css.getPropertyValue("--nav-curve-r"))   || 52;
    const dip = parseFloat(css.getPropertyValue("--nav-curve-dip")) || 32;
    const cp  = parseFloat(css.getPropertyValue("--nav-curve-cp"))  || 0.55;
    const top = 16;
    const x0  = cx - r;
    const x1  = cx + r;

    return [
      `M16 ${top}`,
      `H${x0}`,
      // Sisi kiri: CP1 tetap di atas (datar), CP2 melebar di bawah
      `C${x0 + r * cp} ${top}  ${cx - r * cp} ${top + dip}  ${cx} ${top + dip}`,
      `C${cx + r * cp} ${top + dip}  ${x1 - r * cp} ${top}  ${x1} ${top}`,
      
      `H400 V64 Q400 80 384 80`,
      `H16 Q0 80 0 64 V${top} Z`
    ].join(" ");
  }

  function moveFab(item, animate = true) {
    const leftPct = getFabLeftPercent(item);

    // Bounce FAB saat pindah
    if (animate) {
      fab.classList.remove("is-moving");
      void fab.offsetWidth; // force reflow agar animasi re-trigger
      fab.classList.add("is-moving");
    }

    fab.style.left = `${leftPct}%`;

    // Ganti icon dengan animasi
    fabIcon.className = item.dataset.icon;
    if (animate) {
      fabIcon.classList.remove("icon-anim");
      void fabIcon.offsetWidth;
      fabIcon.classList.add("icon-anim");
    }

    svgPath.setAttribute("d", buildPath(leftPct));

    const css = getComputedStyle(document.documentElement);
    fab.style.borderColor = css.getPropertyValue("--nav-fab-border").trim() || "#F7F3EE";
  }

  // Expose ke luar untuk dipakai back button handler
  window._moveFab = moveFab;
  // Navbar Laporan — kurir ke operasional, hunter/sales ke laporanharian
  const role = (window.currentUser?.role || "").toLowerCase();
  const laporanItem = document.querySelector(".nav-item[data-view='operasional']");
  if (laporanItem && role !== "kurir") {
    laporanItem.dataset.view = "laporanharian";
  }
  // Simpan label dari span terakhir ke data-label sekali saat init
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    const labelEl = item.querySelector("span:last-child");
    if (labelEl && !item.dataset.label) {
      item.dataset.label = labelEl.textContent.trim();
    }
  });

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      // Kembalikan item lama
      const prevActive = document.querySelector(".nav-item.active");
      if (prevActive && prevActive !== item) {
        prevActive.innerHTML =
          `<i class="${prevActive.dataset.icon}"></i>` +
          `<span>${prevActive.dataset.label}</span>`;
        prevActive.classList.remove("active");
      }

      // Aktifkan item baru
      item.innerHTML =
        `<span class="nav-placeholder"></span>` +
        `<span>${item.dataset.label}</span>`;
      item.classList.add("active");

      moveFab(item);
      showView(item.dataset.view, "navbar");
    });
  });

  // Auto hide navbar saat scroll ke bawah, show saat scroll ke atas
  const appEl = document.getElementById("app");
  let lastScrollY  = 0;
  let scrollTimer  = null;
  let navbarEl     = document.getElementById("navbarBottom");

  const hideNavbarViews = [
    "customer","input","inputTabel","analisis","rolling",
    "tentang","keamanan","perjanjian","slip",
    "rollingcustomer","chatAi","peraturan", "customersales"
  ];

  appEl?.addEventListener("scroll", () => {
    // Jangan proses jika view aktif memang hide navbar
    if (hideNavbarViews.includes(currentView)) return;

    const currentY = appEl.scrollTop;
    const diff     = currentY - lastScrollY;

    if (diff > 8) {
      navbarEl.classList.add("hide");
    } else if (diff < -4) {
      navbarEl.classList.remove("hide");
    }

    lastScrollY = currentY;

    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (!hideNavbarViews.includes(currentView)) {
        navbarEl.classList.remove("hide");
      }
    }, 1500);
  }, { passive: true });
  // Init posisi awal — tunggu render selesai
  const firstActive = document.querySelector(".nav-item.active");
  if (firstActive) {
    // Matikan transisi saat init agar tidak animasi dari kiri
    svgPath.style.transition = "none";
    fab.style.transition     = "none";

    setTimeout(() => {
      moveFab(firstActive, false);
      // Nyalakan kembali transisi setelah posisi terset
      setTimeout(() => {
        svgPath.style.transition = "";
        fab.style.transition     = "left .4s cubic-bezier(.34,1.3,.64,1)";
      }, 50);
    }, 80);
  }
}
function updateNavIndicator() {}

// DISABLE ZOOM
let lastTouchEnd = 0;
document.addEventListener("touchend",
  function(event){
    const now = Date.now();
    if(now - lastTouchEnd <= 300){
      event.preventDefault();
    }
    lastTouchEnd = now;
  },
  false
);
document.addEventListener("gesturestart", function(e){
    e.preventDefault();
  });

// helper
window.normalizeGeoPoint = function (geo) {
  if (!geo) return null;

  const lat =
    geo._lat ??
    geo.lat ??
    geo.latitude ??
    null;

  const lng =
    geo._long ??
    geo.lng ??
    geo.longitude ??
    null;

  if (lat == null || lng == null) return null;

  return {
    lat: Number(lat),
    lng: Number(lng)
  };
};
window.fetchUsersByCabang = async function () {
  try {
    const user = window.currentUser;
    if (!user || !user.uid) {
      return [];
    }
    const userSnap = await window.getDoc(window.doc(window.db, "users", user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};
    const idCabang = userData.idCabang;
    if (!idCabang) return [];
    const q = window.query(
      window.collection(window.db, "users"),
      window.where("idCabang", "==", idCabang)
    );
    const snap = await window.getDocs(q);
    const data = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
    const filtered = data.filter(u =>
      ["kurir", "hunter", "sales"].includes((u.role || "").toLowerCase())
    );
    window.globalUsersCache = filtered;
    return data;
  } catch (err) {
    window.globalUsersCache = [];
    return [];
  }
};
// CROP FOTO ENGINE
(function initCropEngine() {
  if (window._cropEngineReady) return;
  window._cropEngineReady = true;
  const LS_KEY = 'ttn_cover_photo';
  const state = {
    imgRect : { x: 0, y: 0, w: 0, h: 0 },
    box     : { x: 0, y: 0, w: 0, h: 0 },
    drag    : null,
  };

  function getImgRect() {
    const ws  = document.getElementById('cropWorkspace');
    const img = document.getElementById('cropImg');
    if (!ws || !img) return state.imgRect;

    const cw = ws.offsetWidth;
    const ch = ws.offsetHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) return { x: 0, y: 0, w: cw, h: ch };

    const cRatio = cw / ch;
    const iRatio = iw / ih;
    let rw, rh, rx, ry;

    if (iRatio > cRatio) {
      rw = cw; rh = cw / iRatio;
      rx = 0;  ry = (ch - rh) / 2;
    } else {
      rh = ch; rw = ch * iRatio;
      ry = 0;  rx = (cw - rw) / 2;
    }
    return { x: rx, y: ry, w: rw, h: rh };
  }

  function applyBox() {
    const el = document.getElementById('cropBox');
    if (!el) return;
    el.style.left   = state.box.x + 'px';
    el.style.top    = state.box.y + 'px';
    el.style.width  = state.box.w + 'px';
    el.style.height = state.box.h + 'px';

    // Info ukuran asli
    const img = document.getElementById('cropImg');
    if (img && img.naturalWidth) {
      const ir     = state.imgRect;
      const scaleX = img.naturalWidth  / ir.w;
      const scaleY = img.naturalHeight / ir.h;
      const realW  = Math.round(state.box.w * scaleX);
      const realH  = Math.round(state.box.h * scaleY);
      const info   = document.getElementById('cropSizeInfo');
      if (info) info.textContent = `${realW} × ${realH} px`;
    }
  }
  function clampBox(b, ir) {
    const MIN = 40;
    let { x, y, w, h } = b;
    w = Math.max(MIN, w);
    h = Math.max(MIN, h);
    x = Math.max(ir.x, Math.min(x, ir.x + ir.w - w));
    y = Math.max(ir.y, Math.min(y, ir.y + ir.h - h));
    if (x + w > ir.x + ir.w) w = ir.x + ir.w - x;
    if (y + h > ir.y + ir.h) h = ir.y + ir.h - y;
    return { x, y, w, h };
  }
  function getLocal(e) {
    const ws   = document.getElementById('cropWorkspace');
    const rect = ws.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return {
      x: src.clientX - rect.left,
      y: src.clientY - rect.top,
    };
  }
  function onDown(e) {
    e.preventDefault();
    const { x, y }  = getLocal(e);
    const handle     = e.target.dataset?.handle;
    const onBox      = e.target.id === 'cropBox' || e.target.closest?.('#cropBox');

    if (handle) {
      // Resize dari corner handle
      state.drag = { type: 'resize', handle, sx: x, sy: y, sb: { ...state.box } };
    } else if (onBox) {
      // Pindahkan seluruh box
      state.drag = { type: 'move', sx: x, sy: y, sb: { ...state.box } };
    } else {
      // Gambar crop box baru dari scratch
      const ir = state.imgRect;
      const cx = Math.max(ir.x, Math.min(x, ir.x + ir.w));
      const cy = Math.max(ir.y, Math.min(y, ir.y + ir.h));
      state.box  = { x: cx, y: cy, w: 1, h: 1 };
      state.drag = { type: 'new', sx: cx, sy: cy };
      applyBox();
    }
  }
  function onMove(e) {
    if (!state.drag) return;
    e.preventDefault();
    const { x, y } = getLocal(e);
    const ir = state.imgRect;
    const sb = state.drag.sb;
    const dx = x - state.drag.sx;
    const dy = y - state.drag.sy;
    const MIN = 40;
    let nb;

    if (state.drag.type === 'move') {
      nb = clampBox({ x: sb.x + dx, y: sb.y + dy, w: sb.w, h: sb.h }, ir);

    } else if (state.drag.type === 'resize') {
      const h = state.drag.handle;
      let { x: bx, y: by, w: bw, h: bh } = sb;

      const RATIO = 14 / 9;
      if (h === 'br') { bw = Math.max(MIN, bw + dx); bh = bw / RATIO; }
      if (h === 'bl') { const nw = Math.max(MIN, bw - dx); bx = bx + bw - nw; bw = nw; bh = bw / RATIO; }
      if (h === 'tr') { bw = Math.max(MIN, bw + dx); bh = bw / RATIO; by = by + sb.h - bh; }
      if (h === 'tl') { const nw = Math.max(MIN, bw - dx); bx = bx + bw - nw; bw = nw; bh = bw / RATIO; by = by + sb.h - bh; }

      nb = clampBox({ x: bx, y: by, w: bw, h: bh }, ir);

    } else if (state.drag.type === 'new') {
      const x1 = Math.max(ir.x, Math.min(state.drag.sx, ir.x + ir.w));
      const y1 = Math.max(ir.y, Math.min(state.drag.sy, ir.y + ir.h));
      const x2 = Math.max(ir.x, Math.min(x, ir.x + ir.w));
      const y2 = Math.max(ir.y, Math.min(y, ir.y + ir.h));
      nb = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 1, h: Math.abs(y2 - y1) || 1 };
    }

    if (nb) { state.box = nb; applyBox(); }
  }
  function onUp() { state.drag = null; }

  window.openCropModal = function(dataUrl) {
    const overlay = document.getElementById('cropOverlay');
    const img     = document.getElementById('cropImg');
    if (!overlay || !img) return;

    overlay.classList.add('open');
    img.src = dataUrl;

    img.onload = () => {
      state.imgRect = getImgRect();
      const ir = state.imgRect;
      // Init crop box dengan rasio hero 14:9
      const RATIO = 14 / 9;
      let bw = ir.w;
      let bh = bw / RATIO;
      if (bh > ir.h) { bh = ir.h; bw = bh * RATIO; }
      const bx = ir.x + (ir.w - bw) / 2;
      const by = ir.y + (ir.h - bh) / 2;
      state.box = { x: bx, y: by, w: bw, h: bh };
      applyBox();

      // Pasang event (sekali)
      const ws = document.getElementById('cropWorkspace');
      ws.onmousedown  = onDown;
      ws.ontouchstart = onDown;
      document.onmousemove  = onMove;
      document.ontouchmove  = onMove;
      document.onmouseup    = onUp;
      document.ontouchend   = onUp;
    };
  };
  function doConfirm() {
    const img = document.getElementById('cropImg');
    if (!img) return;

    const ir     = state.imgRect;
    const box    = state.box;
    const scaleX = img.naturalWidth  / ir.w;
    const scaleY = img.naturalHeight / ir.h;

    // Koordinat crop di gambar asli
    const sx = (box.x - ir.x) * scaleX;
    const sy = (box.y - ir.y) * scaleY;
    const sw = box.w * scaleX;
    const sh = box.h * scaleY;

    // Output max 1200px lebar
    const MAX_W  = 1200;
    const outW   = Math.min(Math.round(sw), MAX_W);
    const outH   = Math.round(sh * (outW / sw));

    const canvas = document.createElement('canvas');
    canvas.width  = outW;
    canvas.height = outH;
    canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

    const compressed = canvas.toDataURL('image/jpeg', 0.78);

    // Log ukuran
    const before = Math.round(img.src.length / 1024);
    const after  = Math.round(compressed.length / 1024);

    // Simpan localStorage
    try {
      localStorage.setItem(LS_KEY, compressed);
      // Sync ke header home
      const headerHome = document.querySelector(".headerHome");
      if (headerHome) {
        const newCover = localStorage.getItem(LS_KEY);
        if (newCover) {
          headerHome.style.backgroundImage = `url(${newCover})`;
          headerHome.style.backgroundSize = "cover";
          headerHome.style.backgroundPosition = "center";
          headerHome.style.backgroundRepeat = "no-repeat";
        }
      }
    } catch (err) {
      alert('Gambar terlalu besar. Coba area crop lebih kecil.');
      return;
    }

    // Update hero background
    const heroBg = document.getElementById('profilHeroBg');
    if (heroBg) {
      heroBg.style.background     = `url(${compressed}) center/cover no-repeat`;
      heroBg.style.backgroundSize = 'cover';
    }
    // Toast feedback
    const toast = document.createElement("div");
    toast.textContent = "✓ Foto sampul berhasil diperbarui";
    toast.style.cssText = `
      position:fixed;bottom:100px;left:50%;transform:translateX(-50%);
      background:#2eaf62;color:#fff;padding:10px 20px;border-radius:20px;
      font-size:13px;font-weight:600;z-index:99999;
      animation:fadeInUp .3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
    closeModal();
  }
  function closeModal() {
    const overlay = document.getElementById('cropOverlay');
    if (overlay) overlay.classList.remove('open');
    // Bersihkan event
    document.onmousemove = document.ontouchmove = null;
    document.onmouseup   = document.ontouchend  = null;
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('#cropConfirm'))              doConfirm();
    if (e.target.closest('#cropCancel'))               closeModal();
    if (e.target.closest('#cropClose'))                closeModal();
    // Klik overlay hitam di luar modal
    if (e.target.id === 'cropOverlay')                 closeModal();
  });
})();
// ── DARK MODE ──────────────────────────────
window.applyDarkMode = function(val){
  if(val){
    document.body.classList.add("dark-mode");
  }else{
    document.body.classList.remove("dark-mode");
  }

  localStorage.setItem("pref_dark", val ? "1" : "0");

  // Kirim ke Android
  if(window.AndroidBridge){
    window.AndroidBridge.setStatusBarColor(val ? true : false);
  }
};
window.isDarkMode = function(){
  return localStorage.getItem("pref_dark") === "1";
};
window.applyDarkMode(window.isDarkMode());
