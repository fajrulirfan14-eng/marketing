window.openMapView = function() {
  const popup = document.getElementById("mapPopup");
  const mapEl = document.getElementById("mapPopupFull");
  if (!popup || !mapEl) return;

  popup.style.display = "block";

  if (typeof google === "undefined") {
    setTimeout(window.openMapView, 500);
    return;
  }

  // Jika sudah ada instance, resize saja
  if (window._mapInstance) {
    setTimeout(() => {
      google.maps.event.trigger(window._mapInstance, "resize");
    }, 100);
    return;
  }
  mapEl.style.width  = "100%";
  mapEl.style.height = window.innerHeight + "px";
  const map = new google.maps.Map(mapEl, {
    center: { lat: -6.9, lng: 107.6 },
    zoom: 5,
    mapId: "3f6f47bf59913618a195fe2e",
    zoomControl: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    keyboardShortcuts: false,
    gestureHandling: "greedy",
    clickableIcons: false,
    disableDefaultUI: true,
    isFractionalZoomEnabled: true,
    tilt: 0,
    heading: 0,
  });
  window._mapInstance = map;

  let locationMode    = 0;
  let userDot         = null;
  let userCircle      = null;
  let watchId         = null;
  let orientHandler   = null;
  let lastHeading     = 0;
  let rafPending      = false;
  let userInteracting = false;
  let interactTimer   = null;
  let pinMarkers      = [];
  let pinVisible      = false;
  let pinInfoEl       = null;
  let activePinEl     = null;

  const HARI_COLOR = {
    "Minggu": "#e53935", "Senin": "#1a73e8", "Selasa": "#43a047",
    "Rabu": "#fb8c00", "Kamis": "#8e24aa", "Jumat": "#00897b", "Sabtu": "#e91e63",
  };

  async function updateUserDot(lat, lng, accuracy) {
    try {
      const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
      if (!userDot) {
        const dotEl = document.createElement("img");
        dotEl.src = "pinOf.png";
        dotEl.className = "map-pin-user map-pin-user-off";
        userDot = new AdvancedMarkerElement({ map, content: dotEl, zIndex: 999 });
      }
      userDot.position = { lat, lng };
    } catch { }
  }

  function setUserPinMode(isRouting) {
    const el = userDot?.element?.querySelector("img") || userDot?.content;
    if (!el) return;
    if (isRouting) {
      el.src = "pinOn.png";
      el.className = "map-pin-user map-pin-user-on";
    } else {
      el.src = "pinOf.png";
      el.className = "map-pin-user map-pin-user-off";
    }
  }
  function stopOrientation() {
    if (orientHandler) {
      window.removeEventListener("deviceorientation", orientHandler, true);
      window.removeEventListener("deviceorientationabsolute", orientHandler, true);
      orientHandler = null;
    }
    try { map.setHeading(0); map.setTilt(0); } catch { }
  }

  function stopWatch() {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  }

  function updateBtn() {
    const btn = document.getElementById("mapBtnLokasiku");
    if (!btn) return;
    btn.className = "map-btn-lokasiku mode-" + locationMode;
    const icons = {
      0: `<svg viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2" width="22" height="22"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`,
      1: `<svg viewBox="0 0 24 24" fill="none" width="22" height="22"><circle cx="12" cy="12" r="3" fill="#4285F4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="#4285F4" stroke-width="2"/></svg>`,
      2: `<svg viewBox="0 0 24 24" fill="none" width="22" height="22"><circle cx="12" cy="12" r="4" fill="#4285F4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="#4285F4" stroke-width="2.5"/></svg>`,
      3: `<svg viewBox="0 0 24 24" fill="none" width="22" height="22"><circle cx="12" cy="12" r="10" stroke="#4285F4" stroke-width="1.5"/><path d="M12 2 L14.5 9.5 L12 8 L9.5 9.5 Z" fill="#e53935"/><path d="M12 22 L9.5 14.5 L12 16 L14.5 14.5 Z" fill="#888"/></svg>`,
    };
    btn.innerHTML = icons[locationMode] || icons[0];
  }

  ["dragstart", "zoom_changed"].forEach(evt => {
    map.addListener(evt, () => {
      if (locationMode >= 2) {
        userInteracting = true;
        clearTimeout(interactTimer);
        interactTimer = setTimeout(() => { userInteracting = false; }, 3000);
        stopWatch(); stopOrientation(); locationMode = 0; updateBtn();
      }
    });
  });

  async function handleLocationBtn() {
    locationMode++;
    if (locationMode > 3) locationMode = 1;
    updateBtn();

    if (locationMode === 1) {
      stopWatch(); stopOrientation();
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        pos => { const {latitude:lat,longitude:lng,accuracy} = pos.coords; map.panTo({lat,lng}); map.setZoom(19); updateUserDot(lat,lng,accuracy); },
        () => { locationMode = 0; updateBtn(); },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else if (locationMode === 2) {
      stopOrientation(); map.setTilt(0); map.setHeading(0);
      if (!navigator.geolocation) return;
      watchId = navigator.geolocation.watchPosition(
        pos => { const {latitude:lat,longitude:lng,accuracy} = pos.coords; updateUserDot(lat,lng,accuracy); if (!userInteracting) map.panTo({lat,lng}); },
        () => {},
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
      );
    } else if (locationMode === 3) {
      map.setTilt(45);
      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        try { const p = await DeviceOrientationEvent.requestPermission(); if (p !== "granted") { locationMode=2; updateBtn(); return; } }
        catch { locationMode=2; updateBtn(); return; }
      }
      let usedAbs = false;
      const testAbs = e => { if (e.alpha !== null) usedAbs = true; window.removeEventListener("deviceorientationabsolute", testAbs, true); };
      window.addEventListener("deviceorientationabsolute", testAbs, true);
      await new Promise(r => setTimeout(r, 300));
      let lastOrientTime = 0;
      orientHandler = function(e) {
        const now = Date.now();
        if (now - lastOrientTime < 100) return; // throttle 100ms
        lastOrientTime = now;

        let h = null;
        if (typeof e.webkitCompassHeading === "number") h = e.webkitCompassHeading;
        else if (e.alpha !== null) h = (360 - e.alpha + (screen.orientation?.angle || window.orientation || 0)) % 360;
        if (h === null) return;
        let d = h - lastHeading;
        if (d > 180) d -= 360; if (d < -180) d += 360;
        lastHeading += d * 0.15; lastHeading = (lastHeading + 360) % 360;
        if (!rafPending) { rafPending = true; requestAnimationFrame(() => { if (!userInteracting) map.setHeading(lastHeading); rafPending = false; }); }
      };
      if (usedAbs) window.addEventListener("deviceorientationabsolute", orientHandler, true);
      else window.addEventListener("deviceorientation", orientHandler, true);
    }
  }

  const btnLokasi = document.createElement("button");
  btnLokasi.id = "mapBtnLokasiku"; btnLokasi.onclick = handleLocationBtn;
  mapEl.appendChild(btnLokasi); updateBtn();

  // ── PIN CUSTOMER ──
  async function loadPinCustomer() {
    try {
      const idb = await window.openAppDB();

      // Load customer harian
      const all = await new Promise(resolve => {
        const tx  = idb.transaction("customerHarianDB", "readonly");
        const req = tx.objectStore("customerHarianDB").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => resolve([]);
      });

      let customers = [];
      all.forEach(item => {
        if (Array.isArray(item.data)) customers.push(...item.data);
      });

      // Filter hari
      const filterHari = JSON.parse(localStorage.getItem("mapFilterHari") || "[]");
      if (filterHari.length > 0 && filterHari.length < 7) {
        customers = customers.filter(c => filterHari.includes(c.hari));
      }

      // Dedupe + validasi
      const seen = new Set();
      const customerHarian = customers.filter(c => {
        const cid = c.idCustomer || c.id;
        if (!cid || seen.has(cid)) return false;
        seen.add(cid);
        const loc = window.normalizeGeoPoint?.(c.lokasiCustomer) || c.lokasiCustomer;
        return !!(loc?.lat && loc?.lng);
      });

      // Load customer baru hunter (diserahkan: false)
      const allBaru = await new Promise(resolve => {
        const tx  = idb.transaction("customerBaruDB", "readonly");
        const req = tx.objectStore("customerBaruDB").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => resolve([]);
      });

      const uid = window.auth?.currentUser?.uid;
      const customerBaru = allBaru.filter(c => {
        if (c.diserahkan === true) return false;
        if (c.type) return false;
        const loc = c.lokasiCustomer;
        return !!(loc?.lat && loc?.lng);
      }).map(c => ({ ...c, _isNew: true, pemilik: c.pemilik || c.createdBy || "" }));
      // Load customerLainDB — filter by user yang dicentang + filter hari
      const filterUsers = JSON.parse(localStorage.getItem("mapFilterUsers") || "[]");
      const filterHariLain = JSON.parse(localStorage.getItem("mapFilterHari") || "[]");

      const allLain = await new Promise(resolve => {
        const tx  = idb.transaction("customerLainDB", "readonly");
        const req = tx.objectStore("customerLainDB").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => resolve([]);
      });
      const customerLain = allLain
        .filter(c => filterUsers.length === 0 || filterUsers.includes(c.pemilik))
        .filter(c => filterHariLain.length === 0 || filterHariLain.includes(c.hari))
        .map(c => ({ ...c, _isLain: true }));

      // Load customerHunterDB — filter by user yang dicentang + filter hari
      const allHunter = await new Promise(resolve => {
        const tx  = idb.transaction("customerHunterDB", "readonly");
        const req = tx.objectStore("customerHunterDB").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => resolve([]);
      });
      const customerHunterLain = allHunter
        .filter(c => filterUsers.length === 0 || filterUsers.includes(c.pemilik))
        .filter(c => filterHariLain.length === 0 || filterHariLain.includes(c.hari))
        .map(c => ({ ...c, _isNewLain: true }));
      // Load customerSalesDB — data sales milik sendiri
      const allSales = await new Promise(resolve => {
        const tx  = idb.transaction("customerSalesDB", "readonly");
        const req = tx.objectStore("customerSalesDB").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => resolve([]);
      });
      const customerSales = allSales
        .filter(c => !!(c.lokasiCustomer?.lat && c.lokasiCustomer?.lng))
        .map(c => ({ ...c, _isSales: true, pemilik: c.pemilik || c.createdBy || "" }));

      // Load customerSalesLainDB — data sales lain
      const allSalesLain = await new Promise(resolve => {
        const tx  = idb.transaction("customerSalesLainDB", "readonly");
        const req = tx.objectStore("customerSalesLainDB").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => resolve([]);
      });
      const customerSalesLain = allSalesLain
        .filter(c => filterUsers.length === 0 || filterUsers.includes(c.pemilik))
        .filter(c => filterHariLain.length === 0 || filterHariLain.includes(c.hari))
        .map(c => ({ ...c, _isSalesLain: true }));

      return [...customerHarian, ...customerBaru, ...customerLain, ...customerHunterLain, ...customerSales, ...customerSalesLain];
    } catch { return []; }
  }
  let routePolyline = null;

  function clearRoute() {
    if (routePolyline) { routePolyline.setMap(null); routePolyline = null; }
    if (window._routePolylinePassed) { window._routePolylinePassed.setMap(null); window._routePolylinePassed = null; }
    if (window._routePolylineAhead)  { window._routePolylineAhead.setMap(null);  window._routePolylineAhead  = null; }
    if (window._navWatchId != null) {
      navigator.geolocation.clearWatch(window._navWatchId);
      window._navWatchId = null;
    }
  }
  async function startRouting(c, loc, color, sheet, closeSheet) {
    if (!navigator.geolocation) return;

    const btnKunjungi = document.getElementById("mapBtnKunjungi");
    if (btnKunjungi) { btnKunjungi.textContent = "Memuat..."; btnKunjungi.disabled = true; }

    navigator.geolocation.getCurrentPosition(async pos => {
      const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const dest   = { lat: loc.lat, lng: loc.lng };

      try {
        const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": "AIzaSyAqRO5D9ttXiGhxyYv1h8QQHxpoXLNO-AQ",
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
          },
          body: JSON.stringify({
            origin:      { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
            destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
            travelMode:  "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
          }),
        });

        const data  = await res.json();
        const route = data.routes?.[0];
        if (!route) throw new Error("No route");

        const durasi = Math.round(parseInt(route.duration) / 60);
        const jarak  = (route.distanceMeters / 1000).toFixed(1);

        // Decode polyline
        clearRoute();
        const path = decodePolyline(route.polyline.encodedPolyline);

        // Buat dua polyline — sudah dilewati (abu) dan belum (biru)
        const polylinePassed = new google.maps.Polyline({
          path: [],
          map,
          strokeColor: "#9e9e9e",
          strokeWeight: 5,
          strokeOpacity: 0.6,
          zIndex: 1,
        });
        const polylineAhead = new google.maps.Polyline({
          path,
          map,
          strokeColor: "#1a73e8",
          strokeWeight: 5,
          strokeOpacity: 0.85,
          zIndex: 2,
        });
        routePolyline = polylineAhead;

        // Simpan referensi untuk clear
        window._routePolylinePassed = polylinePassed;
        window._routePolylineAhead  = polylineAhead;

        // Track posisi user realtime untuk update warna
        function haversineDistance(a, b) {
          const R    = 6371000;
          const dLat = (b.lat - a.lat) * Math.PI / 180;
          const dLng = (b.lng - a.lng) * Math.PI / 180;
          const x    = Math.sin(dLat/2) ** 2 +
                       Math.cos(a.lat * Math.PI/180) *
                       Math.cos(b.lat * Math.PI/180) *
                       Math.sin(dLng/2) ** 2;
          return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
        }

        function findNearestIndex(userPos, pathArr) {
          let minDist = Infinity;
          let idx     = 0;
          pathArr.forEach((p, i) => {
            const d = haversineDistance(userPos, p);
            if (d < minDist) { minDist = d; idx = i; }
          });
          return idx;
        }

        function updateRouteLine(userPos) {
          const idx     = findNearestIndex(userPos, path);
          const passed  = path.slice(0, idx + 1);
          const ahead   = path.slice(idx);
          polylinePassed.setPath(passed);
          polylineAhead.setPath(ahead);
        }

        map.setZoom(19);
        setUserPinMode(true);
        // Stop passive watch dulu, ganti dengan nav watch
        if (window._mapPassiveWatchId != null) {
          navigator.geolocation.clearWatch(window._mapPassiveWatchId);
          window._mapPassiveWatchId = null;
        }
        if (window._navWatchId != null) {
          navigator.geolocation.clearWatch(window._navWatchId);
        }
        const navMode = localStorage.getItem("mapNavMode") || "lancar";
        const navInterval = navMode === "lancar" ? 100 : navMode === "sedang" ? 1000 : 2000;

        let lastRouteUpdate = 0;
        let lastPos = null;
        let interpRaf = null;

        function interpolatePos(from, to, duration, onUpdate) {
          const start = performance.now();
          if (interpRaf) cancelAnimationFrame(interpRaf);
          function step(now) {
            const t = Math.min((now - start) / duration, 1);
            const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // easeInOut
            const lat = from.lat + (to.lat - from.lat) * ease;
            const lng = from.lng + (to.lng - from.lng) * ease;
            onUpdate({ lat, lng });
            if (t < 1) interpRaf = requestAnimationFrame(step);
          }
          interpRaf = requestAnimationFrame(step);
        }

        window._navWatchId = navigator.geolocation.watchPosition(
          pos => {
            const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            const now = Date.now();

            // Throttle updateRouteLine sesuai mode
            if (now - lastRouteUpdate >= navInterval) {
              updateRouteLine(userPos);
              lastRouteUpdate = now;
            }

            // Interpolasi posisi smooth
            const from = lastPos || userPos;
            lastPos = userPos;

            if (navMode === "lancar") {
              interpolatePos(from, userPos, 300, (interpolated) => {
                updateUserDot(interpolated.lat, interpolated.lng, pos.coords.accuracy);
                if (!userInteracting) map.panTo(interpolated);
              });
            } else {
              updateUserDot(userPos.lat, userPos.lng, pos.coords.accuracy);
              if (!userInteracting) map.panTo(userPos);
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: navInterval, timeout: 10000 }
        );
        // fitBounds dengan padding supaya ada animasi geser
        const bounds = new google.maps.LatLngBounds();
        path.forEach(p => bounds.extend(p));
        map.fitBounds(bounds, { top: 80, bottom: 200, left: 40, right: 40 });
        // Zoom in setelah fitBounds selesai
        google.maps.event.addListenerOnce(map, "idle", () => {
          const currentZoom = map.getZoom();
          map.setZoom(currentZoom + 2);
        });

        // Update bottom sheet jadi nav sheet
        sheet.innerHTML = `
          <div class="map-pin-sheet-drag"></div>
          <div class="map-nav-sheet">
            <div class="map-nav-info">
              <div class="map-nav-durasi">${durasi} mnt</div>
              <div class="map-nav-detail">${jarak} km · ${c.namaCustomer||"-"}</div>
            </div>
            <button class="map-nav-close" id="mapNavClose">✕</button>
          </div>
        `;

        document.getElementById("mapNavClose").onclick = () => {
          clearRoute();
          setUserPinMode(false);
          closeSheet();
          // Reset mode navigasi
          locationMode = 0;
          updateBtn();
          stopOrientation();
          map.setTilt(0);
          map.setHeading(0);
          map.setZoom(15);
        };
      } catch {
        if (btnKunjungi) { btnKunjungi.textContent = "Kunjungi Customer"; btnKunjungi.disabled = false; }
      }
    }, () => {
      if (btnKunjungi) { btnKunjungi.textContent = "Kunjungi Customer"; btnKunjungi.disabled = false; }
    }, { enableHighAccuracy: true, timeout: 8000 });
  }

  function decodePolyline(encoded) {
    const points = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : result >> 1;
      shift = 0; result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : result >> 1;
      points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return points;
  }
  function showPinInfo(c, loc, color, pinEl) {
    if (activePinEl && activePinEl !== pinEl) {
      activePinEl.style.transform = "scale(1)";
    }
    if (pinEl) {
      pinEl.style.transform = "scale(1.8)";
      activePinEl = pinEl;
    }
    // Hapus bottom sheet lama
    const oldSheet = document.getElementById("mapPinSheet");
    if (oldSheet) oldSheet.remove();

    const fotoSrc = c.fotoLokal || c.foto ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(c.namaCustomer||'C')}&background=C9A67B&color=fff`;

    const sheet = document.createElement("div");
    sheet.id        = "mapPinSheet";
    sheet.className = "map-pin-sheet";
    sheet.innerHTML = `
      <div class="map-pin-sheet-drag"></div>
      <button class="map-pin-sheet-close" id="mapPinSheetClose">✕</button>
      <div class="map-pin-sheet-body">
        <img class="map-pin-sheet-foto" src="${fotoSrc}" style="border-color:${color};">
        <div class="map-pin-sheet-info">
          <div class="map-pin-sheet-nama">${c.namaCustomer||"-"}</div>
          <div class="map-pin-sheet-row">Hari: <span>${c.hari||"-"}</span></div>
          <div class="map-pin-sheet-row">Jarak: <span id="pinSheetJarak">Menghitung...</span></div>
          <div class="map-pin-sheet-row">Pemilik: <span id="pinSheetPemilik">...</span></div>
        </div>
      </div>
      <button class="map-pin-sheet-btn" id="mapBtnKunjungi">Kunjungi Customer</button>
    `;
    mapEl.appendChild(sheet);

    requestAnimationFrame(() => {
      sheet.classList.add("active");
    });
    // Swipe down tutup — hanya saat bukan navigasi
    let startY = 0;
    sheet.addEventListener("touchstart", e => {
      if (sheet.querySelector(".map-nav-sheet")) return; // lock saat navigasi
      startY = e.touches[0].clientY;
      sheet.style.transition = "none";
    }, { passive: true });
    sheet.addEventListener("touchmove", e => {
      if (sheet.querySelector(".map-nav-sheet")) return; // lock saat navigasi
      const d = e.touches[0].clientY - startY;
      if (d > 0) sheet.style.transform = `translateY(${d}px)`;
    }, { passive: true });
    sheet.addEventListener("touchend", e => {
      if (sheet.querySelector(".map-nav-sheet")) return; // lock saat navigasi
      const d = e.changedTouches[0].clientY - startY;
      sheet.style.transition = "transform .3s ease";
      if (d > 80) {
        sheet.classList.remove("active");
        setTimeout(() => sheet.remove(), 300);
      } else {
        sheet.style.transform = "";
      }
    }, { passive: true });
    const closeSheet = () => {
      sheet.classList.remove("active");
      setTimeout(() => sheet.remove(), 300);
      if (activePinEl) {
        activePinEl.style.transform = "scale(1)";
        activePinEl = null;
      }
    };

    document.getElementById("mapPinSheetClose").onclick = closeSheet;
    // Tombol kunjungi
    document.getElementById("mapBtnKunjungi").onclick = () => startRouting(c, loc, color, sheet, closeSheet);
    // Listener klik map — hanya tutup jika bukan navigasi
    const mapClickListener = map.addListener("click", () => {
      if (sheet.querySelector(".map-nav-sheet")) return; // lock saat navigasi
      closeSheet();
      google.maps.event.removeListener(mapClickListener);
    });
    // Hitung jarak dari posisi user
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const R    = 6371;
        const dLat = (loc.lat - pos.coords.latitude)  * Math.PI / 180;
        const dLng = (loc.lng - pos.coords.longitude) * Math.PI / 180;
        const a    =
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(pos.coords.latitude * Math.PI/180) *
          Math.cos(loc.lat * Math.PI/180) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
        const jarak = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const el = document.getElementById("pinSheetJarak");
        if (el) el.textContent = jarak < 1
          ? Math.round(jarak * 1000) + " m"
          : jarak.toFixed(1) + " km";
      }, () => {
        const el = document.getElementById("pinSheetJarak");
        if (el) el.textContent = "-";
      }, { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 });
    }
    // Ambil nama pemilik
    const pemilikUid = c.pemilik || c.idMarketing || null;
    if (pemilikUid) {
      const elPemilik = document.getElementById("pinSheetPemilik");

      // Cek _mapUsersCabangCache dulu
      const fromCabangCache = (window._mapUsersCabangCache || []).find(u => u.id === pemilikUid || u.uid === pemilikUid);
      if (fromCabangCache) {
        if (elPemilik) elPemilik.textContent = fromCabangCache.nama || "-";
      } else {
        // Cek globalUsersCache
        const fromGlobalCache = (window.globalUsersCache || []).find(u => u.id === pemilikUid || u.uid === pemilikUid);
        if (fromGlobalCache) {
          if (elPemilik) elPemilik.textContent = fromGlobalCache.nama || "-";
        } else {
          // Cek usersDB IndexedDB
          window.openAppDB().then(idb => {
            const tx  = idb.transaction("usersDB", "readonly");
            const req = tx.objectStore("usersDB").get(pemilikUid);
            req.onsuccess = () => {
              const nama = req.result?.data?.nama || null;
              if (nama) {
                if (elPemilik) elPemilik.textContent = nama;
              } else {
                // Fallback query Firestore
                window.getDoc(window.doc(window.db, "users", pemilikUid))
                  .then(snap => {
                    const n = snap.exists() ? (snap.data().nama || "-") : "-";
                    if (elPemilik) elPemilik.textContent = n;
                    if (snap.exists()) {
                      if (!window._mapUsersCabangCache) window._mapUsersCabangCache = [];
                      const already = window._mapUsersCabangCache.find(u => u.id === pemilikUid);
                      if (!already) window._mapUsersCabangCache.push({ id: pemilikUid, ...snap.data() });
                    }
                  })
                  .catch(() => { if (elPemilik) elPemilik.textContent = "-"; });
              }
            };
            req.onerror = () => { if (elPemilik) elPemilik.textContent = "-"; };
          }).catch(() => {
            const elPemilik = document.getElementById("pinSheetPemilik");
            if (elPemilik) elPemilik.textContent = "-";
          });
        }
      }
    } else {
      const elPemilik = document.getElementById("pinSheetPemilik");
      if (elPemilik) elPemilik.textContent = "-";
    }
    map.panTo({ lat: loc.lat, lng: loc.lng });
  }
  window._mapShowPinInfo = showPinInfo;
  function updateBtnPin(active) {
    const btn = document.getElementById("mapBtnPin");
    if (!btn) return;
    btn.style.boxShadow = active ? "0 0 0 3px #C9A67B, 0 2px 8px rgba(0,0,0,.2)" : "0 2px 8px rgba(0,0,0,.25)";
  }

  async function tampilkanPinCustomer() {
    if (pinVisible) {
      pinMarkers.forEach(m => { try { m.map = null; } catch { } });
      pinMarkers = []; pinVisible = false; updateBtnPin(false);
      if (pinInfoEl) { pinInfoEl.remove(); pinInfoEl = null; }
      return;
    }
    const customers = await loadPinCustomer();
    if (!customers.length) return;
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    for (const c of customers) {
      try {
        const raw = c.lokasiCustomer;
        const loc = window.normalizeGeoPoint?.(raw) || raw;
        if (!loc?.lat || !loc?.lng) continue;
        const locNorm = { lat: Number(loc.lat), lng: Number(loc.lng) };

        let pinEl;
        let color;
        if (c._isSalesLain) {
          color = HARI_COLOR[c.hari] || "#9e9e9e";
          pinEl = document.createElement("div");
          pinEl.className = `map-pin-sales-lain hari-${(c.hari || "").toLowerCase()}`;
        } else if (c._isSales) {
          color = HARI_COLOR[c.hari] || "#757575";
          pinEl = document.createElement("div");
          pinEl.className = `map-pin-sales hari-${(c.hari || "").toLowerCase()}`;
        } else if (c._isNewLain) {
          color = "#C9A67B";
          pinEl = document.createElement("img");
          pinEl.src = "pinNewLain.png";
          pinEl.className = "map-pin-new-lain";
        } else if (c._isNew) {
          color = "#C9A67B";
          pinEl = document.createElement("img");
          pinEl.src = "pinNew.png";
          pinEl.className = "map-pin-new";
        } else if (c._isLain) {
          color = HARI_COLOR[c.hari] || "#9e9e9e";
          pinEl = document.createElement("div");
          pinEl.className = `map-pin-lain hari-${(c.hari || "").toLowerCase()}`;
        } else {
          color = HARI_COLOR[c.hari] || "#757575";
          pinEl = document.createElement("div");
          pinEl.className = `map-pin-harian hari-${(c.hari || "").toLowerCase()}`;
        }

        const marker = new AdvancedMarkerElement({ map, position: locNorm, content: pinEl, title: c.namaCustomer || "" });
        marker.addListener("gmp-click", () => showPinInfo(c, locNorm, color, pinEl));
        pinMarkers.push(marker);
      } catch { }
    }
    pinVisible = true; updateBtnPin(true);
  }

  // Auto tampilkan pin saat buka
  tampilkanPinCustomer();

  // ── GPS INIT ──
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const {latitude:lat,longitude:lng,accuracy} = pos.coords;
        updateUserDot(lat,lng,accuracy);
        if (!window._mapLockedToCustomer) {
          map.setCenter({lat,lng});
          map.setZoom(15);
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    window._mapPassiveWatchId = navigator.geolocation.watchPosition(
      pos => {
        const {latitude:lat,longitude:lng,accuracy} = pos.coords;
        updateUserDot(lat,lng,accuracy);
        if ((locationMode===2||locationMode===3)&&!userInteracting&&!window._mapLockedToCustomer) map.panTo({lat,lng});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
  }
  // ── SEARCH CUSTOMER ──
  let searchDebounce = null;
  let tempPinMarker  = null;
  let allCustomers   = [];

  // Load semua customer ke memory sekali
  window.openAppDB().then(idb => {
    const tx  = idb.transaction("customerHarianDB", "readonly");
    const req = tx.objectStore("customerHarianDB").getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      all.forEach(item => {
        if (Array.isArray(item.data)) allCustomers.push(...item.data);
      });
    };
  }).catch(() => {});

  const searchWrap = document.createElement("div");
  searchWrap.className = "map-search-wrap";
  searchWrap.innerHTML = `
    <input class="map-search-input" id="mapSearchInput" placeholder="Cari customer..." autocomplete="off">
    <div class="map-search-suggest" id="mapSearchSuggest"></div>
  `;
  mapEl.appendChild(searchWrap);

  const searchInput   = document.getElementById("mapSearchInput");
  const searchSuggest = document.getElementById("mapSearchSuggest");

  function closeSuggest() {
    searchSuggest.innerHTML = "";
    searchSuggest.style.display = "none";
  }

  function removeTempPin() {
    if (tempPinMarker) {
      try { tempPinMarker.map = null; } catch { }
      tempPinMarker = null;
    }
  }

  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    const val = searchInput.value.trim().toLowerCase();
    if (!val) { closeSuggest(); return; }

    searchDebounce = setTimeout(() => {
      const results = allCustomers
        .filter(c => (c.namaCustomer || "").toLowerCase().includes(val))
        .slice(0, 10);

      if (!results.length) { closeSuggest(); return; }

      searchSuggest.style.display = "block";
      searchSuggest.innerHTML = results.map((c, i) => `
        <div class="map-search-item" data-index="${i}">
          <div class="map-search-item-nama">${c.namaCustomer || "-"}</div>
          <span class="map-search-item-hari" style="background:${HARI_COLOR[c.hari]||'#757575'}">${c.hari||"-"}</span>
        </div>
      `).join("");

      searchSuggest.querySelectorAll(".map-search-item").forEach((el, i) => {
        el.addEventListener("click", async () => {
          const c   = results[i];
          const raw = c.lokasiCustomer;
          const loc = window.normalizeGeoPoint?.(raw) || raw;
          if (!loc?.lat || !loc?.lng) return;

          closeSuggest();
          searchInput.value = "";
          searchInput.blur();

          // Hapus temp pin lama
          removeTempPin();

          // Buat temp pin
          const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
          const color  = HARI_COLOR[c.hari] || "#757575";
          const pinEl  = document.createElement("div");
          pinEl.style.cssText = `width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:pointer;transition:transform .2s ease;transform:scale(1.8);`;
          tempPinMarker = new AdvancedMarkerElement({
            map,
            position: { lat: Number(loc.lat), lng: Number(loc.lng) },
            content: pinEl,
            zIndex: 998,
          });

          // Pan smooth ke lokasi dengan animasi
          map.panTo({ lat: Number(loc.lat), lng: Number(loc.lng) });
          setTimeout(() => map.setZoom(17), 300);

          // Delay lalu buka bottom sheet
          setTimeout(() => {
            showPinInfo(c, loc, color, pinEl);
            // Override closeSheet untuk hapus temp pin juga
            const sheet = document.getElementById("mapPinSheet");
            if (sheet) {
              const origClose = document.getElementById("mapPinSheetClose").onclick;
              document.getElementById("mapPinSheetClose").onclick = () => {
                removeTempPin();
                origClose?.();
              };
            }
          }, 700);
        });
      });
    }, 300);
  });

  // Klik luar suggest
  mapEl.addEventListener("click", e => {
    if (!e.target.closest(".map-search-wrap")) closeSuggest();
  });
  // ── TOMBOL SETTING ──
  const btnSetting = document.createElement("button");
  btnSetting.id        = "mapBtnSetting";
  btnSetting.className = "map-btn-setting";
  btnSetting.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  `;
  mapEl.appendChild(btnSetting);

  // ── SETTING BOTTOM SHEET ──
  let settingSheetEl = null;

  function openSettingSheet() {
    if (settingSheetEl) return;

    const overlay = document.createElement("div");
    overlay.id        = "mapSettingOverlay";
    overlay.className = "map-setting-overlay";

    settingSheetEl = document.createElement("div");
    settingSheetEl.className = "map-setting-sheet";
    settingSheetEl.innerHTML = `
      <div class="map-setting-header">
        <div class="map-setting-title">Pengaturan Peta</div>
      </div>
      <div class="map-setting-body">

        <!-- Filter Hari -->
        <div class="map-setting-item map-setting-expandable" id="mapSettingFilterHari">
          <span>Filter Hari</span>
          <svg class="map-setting-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        <div class="map-setting-expand-body" id="mapFilterHariBody">
          ${["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"].map(h => `
            <div class="map-setting-check-item" data-hari="${h}">
              <span>${h}</span>
              <div class="map-setting-checkbox"></div>
            </div>
          `).join("")}
        </div>

        <!-- Customer Lain -->
        <div class="map-setting-item map-setting-expandable" id="mapSettingCustomerLain">
          <span>Customer Lain</span>
          <svg class="map-setting-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        <div class="map-setting-expand-body" id="mapCustomerLainBody">
        </div>

        <!-- Tipe Peta -->
        <div class="map-setting-item map-setting-expandable" id="mapSettingTipePeta">
          <span>Tipe Peta</span>
          <svg class="map-setting-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        <div class="map-setting-expand-body" id="mapTipePetaBody">
          <div class="map-type-item ${!localStorage.getItem("mapType") || localStorage.getItem("mapType") === "roadmap" ? "active" : ""}" data-type="roadmap">
            <span>Standar</span><div class="map-type-check">✓</div>
          </div>
          <div class="map-type-item map-type-has-sub ${["satellite","hybrid"].includes(localStorage.getItem("mapType")||"") ? "active" : ""}" data-type="satellite" id="mapTypeSatelit">
            <span>Satelit</span><div class="map-type-check">✓</div>
          </div>
          <div class="map-type-sub-item ${localStorage.getItem("mapType") === "hybrid" ? "active" : ""}" id="mapTypeHybridToggle">
            <span>Tampilkan Nama Jalan</span>
            <label class="map-toggle">
              <input type="checkbox" id="mapHybridCheck" ${localStorage.getItem("mapType") === "hybrid" ? "checked" : ""}>
              <span class="map-toggle-slider"></span>
            </label>
          </div>
        </div>
        
        <!-- Mode Navigasi -->
        <div class="map-setting-item map-setting-expandable" id="mapSettingNavMode">
          <span>Mode Navigasi</span>
          <svg class="map-setting-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        <div class="map-setting-expand-body" id="mapNavModeBody">
          <div class="map-nav-mode-item ${!localStorage.getItem('mapNavMode') || localStorage.getItem('mapNavMode') === 'lancar' ? 'active' : ''}" data-mode="lancar">
            <div class="map-setting-check-info">
              <span class="map-setting-check-name">Lancar</span>
              <span class="map-setting-check-role">Smooth seperti Google Maps</span>
            </div>
            <div class="map-setting-checkbox"></div>
          </div>
          <div class="map-nav-mode-item ${localStorage.getItem('mapNavMode') === 'sedang' ? 'active' : ''}" data-mode="sedang">
            <div class="map-setting-check-info">
              <span class="map-setting-check-name">Sedang</span>
              <span class="map-setting-check-role">Seimbang performa & baterai</span>
            </div>
            <div class="map-setting-checkbox"></div>
          </div>
          <div class="map-nav-mode-item ${localStorage.getItem('mapNavMode') === 'ringan' ? 'active' : ''}" data-mode="ringan">
            <div class="map-setting-check-info">
              <span class="map-setting-check-name">Ringan</span>
              <span class="map-setting-check-role">Hemat baterai & memori</span>
            </div>
            <div class="map-setting-checkbox"></div>
          </div>
        </div>

        <!-- Tampilkan Semua Pin -->
        <button class="map-setting-sync-btn" id="mapBtnSyncAllPin">
          <svg id="mapSyncAllIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
            <path d="M23 4v6h-6"/>
            <path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.36-3.36L23 10M1 14l5.13 4.36A9 9 0 0020.49 15"/>
          </svg>
          <span id="mapSyncAllText">Tampilkan Semua Pin</span>
        </button>

      </div>
    </div>
  `;

    overlay.appendChild(settingSheetEl);
    mapEl.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add("active");
      settingSheetEl.classList.add("active");
    });

    const close = () => {
      overlay.classList.remove("active");
      settingSheetEl.classList.remove("active");
      setTimeout(() => { overlay.remove(); settingSheetEl = null; }, 300);
    };
    // Mode gelap
    const toggleDark = document.getElementById("mapToggleDark");
    if (toggleDark) {
      const applyDarkMap = (dark) => {
        if (!window._mapInstance) return;
        window._mapInstance.setOptions({
          styles: dark ? window._mapDarkStyles : []
        });
      };

      // Apply state tersimpan
      applyDarkMap(localStorage.getItem("mapDark") === "1");

      toggleDark.addEventListener("change", () => {
        const val = toggleDark.checked ? "1" : "0";
        localStorage.setItem("mapDark", val);
        applyDarkMap(toggleDark.checked);
      });
    }
    overlay.addEventListener("click", e => {
      if (e.target === overlay) close();
    });
    // Apply state tersimpan
    const savedType = localStorage.getItem("mapType") || "roadmap";
    map.setMapTypeId(savedType);
    // Ekspand filter hari
    const expandHari     = document.getElementById("mapSettingFilterHari");
    const expandHariBody = document.getElementById("mapFilterHariBody");
    expandHari.addEventListener("click", () => {
      expandHariBody.classList.toggle("open");
      expandHari.querySelector(".map-setting-arrow").style.transform =
        expandHariBody.classList.contains("open") ? "rotate(180deg)" : "";
    });

    // Init state filter hari dari localStorage
    function initFilterHari() {
      const savedHari = JSON.parse(localStorage.getItem("mapFilterHari") || "[]");
      expandHariBody.querySelectorAll(".map-setting-check-item[data-hari]").forEach(item => {
        // Set state awal
        if (savedHari.includes(item.dataset.hari)) {
          item.classList.add("active");
        } else {
          item.classList.remove("active");
        }

        // Hapus listener lama supaya tidak double
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);

        newItem.addEventListener("click", () => {
          newItem.classList.toggle("active");
          const active = [...expandHariBody.querySelectorAll(".map-setting-check-item.active")]
            .map(i => i.dataset.hari);
          localStorage.setItem("mapFilterHari", JSON.stringify(active));
          pinMarkers.forEach(m => { try { m.map = null; } catch { } });
          pinMarkers = [];
          pinVisible = false;
          tampilkanPinCustomer();
        });
      });
    }
    initFilterHari();

    // Ekspand customer lain
    const expandCust     = document.getElementById("mapSettingCustomerLain");
    const expandCustBody = document.getElementById("mapCustomerLainBody");
    let usersCabangLoaded = false;

    async function loadUsersCabang() {
      if (usersCabangLoaded) return;

      // Cek cache memory dulu
      if (window._mapUsersCabangCache?.length) {
        renderUsersCabang(window._mapUsersCabangCache);
        usersCabangLoaded = true;
        return;
      }

      expandCustBody.innerHTML = `<div class="map-setting-loading">Memuat...</div>`;

      try {
        const user     = window.currentUser;
        const idCabang = user?.idCabang;
        if (!idCabang) { expandCustBody.innerHTML = `<div class="map-setting-loading">Cabang tidak ditemukan</div>`; return; }

        const snap = await window.getDocs(window.query(
          window.collection(window.db, "users"),
          window.where("idCabang", "==", idCabang),
          window.where("role", "in", ["kurir","hunter","sales"])
        ));

        const users = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => u.id !== window.auth?.currentUser?.uid);

        // Simpan ke cache memory
        window._mapUsersCabangCache = users;

        renderUsersCabang(users);
        usersCabangLoaded = true;
      } catch {
        expandCustBody.innerHTML = `<div class="map-setting-loading">Gagal memuat</div>`;
      }
    }

    function renderUsersCabang(users) {
      const saved = JSON.parse(localStorage.getItem("mapFilterUsers") || "[]");
      if (!users.length) {
        expandCustBody.innerHTML = `<div class="map-setting-loading">Tidak ada user lain</div>`;
        return;
      }
      const roleLabel = { kurir: "Kurir", hunter: "Hunter", sales: "Sales" };
      expandCustBody.innerHTML = users.map(u => `
        <div class="map-setting-check-item ${saved.includes(u.id) ? "active" : ""}" data-user="${u.id}">
          <div class="map-setting-check-info">
            <span class="map-setting-check-name">${u.nama || u.email || "-"}</span>
            <span class="map-setting-check-role">${roleLabel[u.role?.toLowerCase()] || u.role || "-"}</span>
          </div>
          <div class="map-setting-checkbox"></div>
        </div>
      `).join("");

      expandCustBody.querySelectorAll(".map-setting-check-item[data-user]").forEach(item => {
        item.addEventListener("click", () => {
          item.classList.toggle("active");
          const active = [...expandCustBody.querySelectorAll(".map-setting-check-item.active")]
            .map(i => i.dataset.user);
          localStorage.setItem("mapFilterUsers", JSON.stringify(active));
          // Refresh pin
          pinMarkers.forEach(m => { try { m.map = null; } catch { } });
          pinMarkers = []; pinVisible = false;
          tampilkanPinCustomer();
        });
      });
    }

    expandCust.addEventListener("click", () => {
      expandCustBody.classList.toggle("open");
      expandCust.querySelector(".map-setting-arrow").style.transform =
        expandCustBody.classList.contains("open") ? "rotate(180deg)" : "";
      if (expandCustBody.classList.contains("open")) loadUsersCabang();
    });
    // Ekspand tipe peta
    const expandBtn  = document.getElementById("mapSettingTipePeta");
    const expandBody = document.getElementById("mapTipePetaBody");
    expandBtn.addEventListener("click", () => {
      expandBody.classList.toggle("open");
      expandBtn.querySelector(".map-setting-arrow").style.transform =
        expandBody.classList.contains("open") ? "rotate(180deg)" : "";
    });

    // Standar
    overlay.querySelector("[data-type='roadmap']").addEventListener("click", () => {
      localStorage.setItem("mapType", "roadmap");
      map.setMapTypeId("roadmap");
      overlay.querySelectorAll(".map-type-item").forEach(i => i.classList.remove("active"));
      overlay.querySelector("[data-type='roadmap']").classList.add("active");
      overlay.querySelector("[data-type='satellite']").classList.remove("active");
      document.getElementById("mapTypeHybridToggle").style.display = "none";
    });

    // Satelit
    overlay.querySelector("[data-type='satellite']").addEventListener("click", () => {
      const isHybrid = document.getElementById("mapHybridCheck").checked;
      const type = isHybrid ? "hybrid" : "satellite";
      localStorage.setItem("mapType", type);
      map.setMapTypeId(type);
      overlay.querySelectorAll(".map-type-item").forEach(i => i.classList.remove("active"));
      overlay.querySelector("[data-type='satellite']").classList.add("active");
      overlay.querySelector("[data-type='roadmap']").classList.remove("active");
      document.getElementById("mapTypeHybridToggle").style.display = "flex";
    });

    // Toggle hybrid
    document.getElementById("mapHybridCheck").addEventListener("change", function() {
      const type = this.checked ? "hybrid" : "satellite";
      localStorage.setItem("mapType", type);
      map.setMapTypeId(type);
    });

    // Init tampilkan sub item satelit kalau aktif
    const isSatelit = ["satellite","hybrid"].includes(savedType);
    if (isSatelit) {
      document.getElementById("mapTypeHybridToggle").style.display = "flex";
      overlay.querySelector("[data-type='satellite']").classList.add("active");
    } else {
      document.getElementById("mapTypeHybridToggle").style.display = "none";
    }
    // Mode navigasi
    const expandNav     = document.getElementById("mapSettingNavMode");
    const expandNavBody = document.getElementById("mapNavModeBody");
    expandNav.addEventListener("click", () => {
      expandNavBody.classList.toggle("open");
      expandNav.querySelector(".map-setting-arrow").style.transform =
        expandNavBody.classList.contains("open") ? "rotate(180deg)" : "";
    });
    expandNavBody.querySelectorAll(".map-nav-mode-item").forEach(item => {
      item.addEventListener("click", () => {
        expandNavBody.querySelectorAll(".map-nav-mode-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        localStorage.setItem("mapNavMode", item.dataset.mode);
      });
    });
    document.getElementById("mapBtnSyncAllPin")?.addEventListener("click", syncSemuaPin);
    btnSetting.onclick = () => {
      if (settingSheetEl) close();
      else openSettingSheet();
    };
  }
  window.syncSemuaPin = async function syncSemuaPin() {
    const btn  = document.getElementById("mapBtnSyncAllPin");
    const text = document.getElementById("mapSyncAllText");
    const icon = document.getElementById("mapSyncAllIcon");
    if (!btn) return;

    btn.classList.add("loading");
    if (text) text.textContent = "Memuat...";

    try {
      const uid      = window.auth?.currentUser?.uid;
      const user     = window.currentUser || {};
      const idCabang = user.idCabang || "";
      const role     = (user.role || "").toLowerCase();

      if (!uid || !idCabang) throw new Error("User tidak valid");

      // ── QUERY customer collection ──
      const customerSnap = await window.getDocs(window.query(
        window.collection(window.db, "customer"),
        window.where("idCabang", "==", idCabang),
        window.where("status", "==", true)
      ));

      const customerDocs = customerSnap.docs.map(d => {
        const data = d.data();
        return {
          id:            d.id,
          foto:          data.foto || "",
          namaCustomer:  data.namaCustomer || "",
          pemilik:       data.pemilik || "",
          hari:          data.hari || "",
          lokasiCustomer: window.normalizeGeoPoint(data.lokasiCustomer),
        };
      });

      // Filter berdasarkan role
      let customerLainData = [];
      if (role === "kurir") {
        customerLainData = customerDocs.filter(c => c.pemilik !== uid);
      } else if (role === "hunter" || role === "sales") {
        customerLainData = customerDocs;
      }

      // ── QUERY customerBaruHunter collectionGroup ──
      const hunterSnap = await window.getDocs(window.query(
        window.collectionGroup(window.db, "customerBaruHunter"),
        window.where("idCabang", "==", idCabang),
        window.where("diserahkan", "==", false)
      ));

      const hunterDocs = hunterSnap.docs.map(d => {
        const data = d.data();
        return {
          id:            d.id,
          foto:          data.foto || "",
          namaCustomer:  data.namaCustomer || "",
          pemilik:       data.createdBy || "",
          hari:          data.hari || "",
          lokasiCustomer: window.normalizeGeoPoint(data.lokasiCustomer),
        };
      });

      let customerHunterData = [];
      if (role === "kurir" || role === "sales") {
        customerHunterData = hunterDocs;
      } else if (role === "hunter") {
        customerHunterData = hunterDocs.filter(c => c.pemilik !== uid);
      }

      // ── QUERY customerSales collection ──
      const salesSnap = await window.getDocs(window.query(
        window.collection(window.db, "customerSales"),
        window.where("idCabang", "==", idCabang)
      ));

      const salesDocs = salesSnap.docs.map(d => {
        const data = d.data();
        return {
          id:            d.id,
          foto:          data.foto || "",
          namaCustomer:  data.namaCustomer || "",
          pemilik:       data.createdBy || "",
          hari:          data.hari || "",
          lokasiCustomer: window.normalizeGeoPoint(data.lokasiCustomer),
        };
      });

      let customerSalesLainData = [];
      if (role === "kurir" || role === "hunter") {
        customerSalesLainData = salesDocs;
      } else if (role === "sales") {
        customerSalesLainData = salesDocs.filter(c => c.pemilik !== uid);
      }

      // ── SIMPAN KE INDEXEDDB ──
      const idb = await window.openAppDB();

      // Simpan customerLainDB
      await new Promise((resolve, reject) => {
        const tx    = idb.transaction("customerLainDB", "readwrite");
        const store = tx.objectStore("customerLainDB");
        store.clear();
        customerLainData.forEach(c => {
          if (c.lokasiCustomer?.lat && c.lokasiCustomer?.lng) store.put(c);
        });
        tx.oncomplete = () => resolve();
        tx.onerror    = () => reject(tx.error);
      });

      // Simpan customerHunterDB
      await new Promise((resolve, reject) => {
        const tx    = idb.transaction("customerHunterDB", "readwrite");
        const store = tx.objectStore("customerHunterDB");
        store.clear();
        customerHunterData.forEach(c => {
          if (c.lokasiCustomer?.lat && c.lokasiCustomer?.lng) store.put(c);
        });
        tx.oncomplete = () => resolve();
        tx.onerror    = () => reject(tx.error);
      });

      // Simpan customerSalesLainDB
      await new Promise((resolve, reject) => {
        const tx    = idb.transaction("customerSalesLainDB", "readwrite");
        const store = tx.objectStore("customerSalesLainDB");
        store.clear();
        customerSalesLainData.forEach(c => {
          if (c.lokasiCustomer?.lat && c.lokasiCustomer?.lng) store.put(c);
        });
        tx.oncomplete = () => resolve();
        tx.onerror    = () => reject(tx.error);
      });

      if (text) text.textContent = `✓ ${customerLainData.length + customerHunterData.length + customerSalesLainData.length} Pin Dimuat`;
      btn.style.background = "#2eaf62";

      // Refresh pin di map
      pinMarkers.forEach(m => { try { m.map = null; } catch { } });
      pinMarkers = []; pinVisible = false;
      tampilkanPinCustomer();

      setTimeout(() => {
        btn.style.background = "";
        if (text) text.textContent = "Tampilkan Semua Pin";
        btn.classList.remove("loading");
      }, 2000);

    } catch(e) {
      console.log("syncSemuaPin error:", e);
      if (text) text.textContent = "Gagal, Coba Lagi";
      btn.style.background = "#e74c3c";
      setTimeout(() => {
        btn.style.background = "";
        if (text) text.textContent = "Tampilkan Semua Pin";
        btn.classList.remove("loading");
      }, 2000);
    }
  }
  btnSetting.onclick = openSettingSheet;
  // ── TUTUP ──
  document.getElementById("mapPopupClose").onclick = function() {
    stopWatch(); stopOrientation(); locationMode = 0;
    if (window._mapPassiveWatchId != null) {
      navigator.geolocation.clearWatch(window._mapPassiveWatchId);
      window._mapPassiveWatchId = null;
    }
    pinMarkers.forEach(m => { try { m.map = null; } catch { } });
    pinMarkers = []; pinVisible = false;
    if (pinInfoEl) { pinInfoEl.remove(); pinInfoEl = null; }
    popup.style.display = "none";
    // Reset map instance supaya bisa init ulang
    window._mapInstance = null;
    userDot = null; userCircle = null;
  };
};

// routung dari input
window.openMapFromInput = function(customerId) {
  // Buka popup map
  window.openMapView();

  // Tunggu map siap lalu pan ke customer
  const tryFind = (attempt) => {
    if (attempt > 20) return;
    setTimeout(() => {
      if (!window._mapInstance) { tryFind(attempt + 1); return; }

      // Cari customer dari memory atau IndexedDB
      const find = () => {
        const list = window.listCustomerData || [];
        return list.find(c => (c.idCustomer || c.id) === customerId);
      };

      const c = find();
      if (!c) { tryFind(attempt + 1); return; }

      const loc = window.normalizeGeoPoint?.(c.lokasiCustomer) || c.lokasiCustomer;
      if (!loc?.lat || !loc?.lng) return;

      const color = {
        "Minggu":"#e53935","Senin":"#1a73e8","Selasa":"#43a047",
        "Rabu":"#fb8c00","Kamis":"#8e24aa","Jumat":"#00897b","Sabtu":"#e91e63"
      }[c.hari] || "#757575";

      // Lock supaya passive watch tidak override
      window._mapLockedToCustomer = true;

      // Pan ke lokasi
      window._mapInstance.panTo({ lat: loc.lat, lng: loc.lng });
      setTimeout(() => window._mapInstance.setZoom(17), 300);

      // Unlock setelah 3 detik
      setTimeout(() => { window._mapLockedToCustomer = false; }, 3000);

      // Buat temp pin dan buka bottom sheet
      setTimeout(async () => {
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        const pinEl = document.createElement("div");
        pinEl.style.cssText = `width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:pointer;transition:transform .2s ease;transform:scale(1.8);`;
        const marker = new AdvancedMarkerElement({
          map: window._mapInstance,
          position: { lat: Number(loc.lat), lng: Number(loc.lng) },
          content: pinEl,
          zIndex: 998,
        });
        marker.addListener("gmp-click", () => window._mapShowPinInfo?.(c, loc, color, pinEl));
        // Simpan temp pin supaya bisa dihapus
        if (window._mapTempPin) {
          try { window._mapTempPin.map = null; } catch { }
        }
        window._mapTempPin = marker;

        // Panggil showPinInfo — akses via instance
        window._mapShowPinInfo?.(c, loc, color, pinEl);
      }, 700);
    }, 300);
  };

  tryFind(0);
};

// hunter
window.openMapFromCustomerBaru = async function(idCustomer) {
  const idb = await window.openAppDB();
  const data = await new Promise(resolve => {
    const tx  = idb.transaction("customerBaruDB", "readonly");
    const req = tx.objectStore("customerBaruDB").get(idCustomer);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => resolve(null);
  });
  if (!data) return;

  const loc = data.lokasiCustomer;
  if (!loc?.lat || !loc?.lng) return;

  window.openMapView();
  window._mapLockedToCustomer = true;

  const tryShow = (attempt) => {
    if (attempt > 20) return;
    setTimeout(async () => {
      if (!window._mapInstance) { tryShow(attempt + 1); return; }
      const pos = { lat: loc.lat, lng: loc.lng };
      window._mapInstance.panTo(pos);
      window._mapInstance.setZoom(17);

      setTimeout(async () => {
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        const color = "#C9A67B";
        const pinEl = document.createElement("img");
        pinEl.src = "pinNew.png";
        pinEl.className = "map-pin-new";

        const marker = new AdvancedMarkerElement({
          map: window._mapInstance,
          position: pos,
          content: pinEl,
          zIndex: 998,
        });

        if (window._mapTempPin) {
          try { window._mapTempPin.map = null; } catch { }
        }
        window._mapTempPin = marker;

        const c = {
          id: idCustomer,
          namaCustomer: data.namaCustomer,
          foto: data.foto || "",
          lokasiCustomer: pos,
          hari: data.hari || "-",
          pemilik: data.createdBy
        };
        marker.addListener("gmp-click", () => window._mapShowPinInfo?.(c, pos, color, pinEl));
        window._mapShowPinInfo?.(c, pos, color, pinEl);
        setTimeout(() => { window._mapLockedToCustomer = false; }, 3000);
      }, 500);
    }, 300);
  };
  tryShow(0);
};
