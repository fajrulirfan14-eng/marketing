window.openMapRouting = async function(idCustomer, dbName = "customerBaruDB", autoStart = false) {
  try {
    const db = await window.openAppDB();

    let data = null;

    if (dbName === "customerBaruDB") {
      data = await new Promise(resolve => {
        const tx = db.transaction("customerBaruDB", "readonly");
        const store = tx.objectStore("customerBaruDB");
        const req = store.get(idCustomer);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } else {
      const allRaw = await new Promise(resolve => {
        const tx = db.transaction("customerHarianDB", "readonly");
        const store = tx.objectStore("customerHarianDB");
        const r = store.getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => resolve([]);
      });
      for (const item of allRaw) {
        const arr = Array.isArray(item.data) ? item.data : [item];
        const found = arr.find(x => (x.idCustomer || x.id) === idCustomer);
        if (found) { data = found; break; }
      }
    }

    if (!data || !data.lokasiCustomer) {
      alert("Lokasi customer tidak tersedia");
      return;
    }

    const loc = data.lokasiCustomer;
    const lat = Number(loc.lat ?? loc.latitude ?? loc._lat ?? null);
    const lng = Number(loc.lng ?? loc.longitude ?? loc._long ?? null);

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      alert("Koordinat customer tidak valid");
      return;
    }

    const mapPopup = document.getElementById("mapPopupRouting");
    mapPopup.style.display = "flex";

    setTimeout(async () => {
      const mapEl = document.getElementById("mapFullRouting");
      mapEl.innerHTML = "";

      const savedMapType = localStorage.getItem("routingMapType") || "roadmap";

      const map = new google.maps.Map(mapEl, {
        center: { lat, lng },
        zoom: 18,
        mapId: "3f6f47bf59913618a195fe2e",
        tilt: 0,
        heading: 0,
        mapTypeId: savedMapType,
        zoomControl: false,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
          position: google.maps.ControlPosition.TOP_RIGHT,
        },
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false,
        gestureHandling: "greedy",
        clickableIcons: false,
      });

      // Simpan saat user ganti tipe peta
      map.addListener("maptypeid_changed", () => {
        localStorage.setItem("routingMapType", map.getMapTypeId());
      });

      const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

      const tujuanEl = document.createElement("div");
      tujuanEl.style.cssText = `
        width: 36px; height: 36px;
        background: #e53935;
        border: 3px solid #fff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 8px #0005;
      `;
      new AdvancedMarkerElement({
        position: { lat, lng },
        map,
        content: tujuanEl,
        title: data.namaCustomer || "Customer",
      });

      const blueDotEl = document.createElement("div");
      blueDotEl.className = "map-pin-user map-pin-user-off";
      let userMarker = new AdvancedMarkerElement({
        position: { lat, lng },
        map,
        content: blueDotEl,
        title: "Posisi Kamu",
      });

      let fullPath = [];
      let traversedPolyline = new google.maps.Polyline({
        path: [],
        map,
        strokeColor: "#9E9E9E",
        strokeWeight: 5,
        strokeOpacity: 0.6,
        zIndex: 1,
      });
      let remainingPolyline = new google.maps.Polyline({
        path: [],
        map,
        strokeColor: "#4285F4",
        strokeWeight: 6,
        strokeOpacity: 1,
        zIndex: 2,
      });

      async function fetchRoute(userLat, userLng) {
        try {
          const response = await fetch(
            `https://routes.googleapis.com/directions/v2:computeRoutes`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": "AIzaSyAqRO5D9ttXiGhxyYv1h8QQHxpoXLNO-AQ",
                "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration",
              },
              body: JSON.stringify({
                origin: {
                  location: { latLng: { latitude: userLat, longitude: userLng } }
                },
                destination: {
                  location: { latLng: { latitude: lat, longitude: lng } }
                },
                travelMode: "DRIVE",
              }),
            }
          );
          const result = await response.json();
          const route = result?.routes?.[0];
          const encoded = route?.polyline?.encodedPolyline;
          if (encoded) {
            fullPath = google.maps.geometry.encoding.decodePath(encoded);
            remainingPolyline.setPath(fullPath);
            traversedPolyline.setPath([]);

            // Ambil jarak & durasi
            const distanceM = route?.legs?.[0]?.distanceMeters || 0;
            const durationStr = route?.legs?.[0]?.duration || "0s";
            const durationSec = parseInt(durationStr.replace("s", "")) || 0;

            const km = (distanceM / 1000).toFixed(1);
            const menit = Math.ceil(durationSec / 60);

            const infoEl = document.getElementById("infoJarakRouting");
            if (infoEl) {
              document.getElementById("infoJarakKm").textContent = `${km} km`;
              document.getElementById("infoJarakMenit").textContent = `~${menit} menit`;
              infoEl.style.display = "flex";
            }
          }
        } catch(e) {
          console.log("fetchRoute error:", e);
        }
      }

      function findClosestIndex(path, userLatLng) {
        let minDist = Infinity;
        let idx = 0;
        path.forEach((p, i) => {
          const d = google.maps.geometry.spherical.computeDistanceBetween(p, userLatLng);
          if (d < minDist) { minDist = d; idx = i; }
        });
        return idx;
      }

      let isPanning = false;
      function updateUserPosition(userLat, userLng) {
        const userLatLng = new google.maps.LatLng(userLat, userLng);
        userMarker.position = { lat: userLat, lng: userLng };

        // Smooth pan tanpa interrupt gesture user
        if (!isPanning && !headingModeAktif) {
          isPanning = true;
          map.panTo(userLatLng);
          setTimeout(() => { isPanning = false; }, 800);
        }

        if (fullPath.length > 1) {
          const idx = findClosestIndex(fullPath, userLatLng);
          traversedPolyline.setPath(fullPath.slice(0, idx + 1));
          remainingPolyline.setPath(fullPath.slice(idx));
        }
      }

      navigator.geolocation.getCurrentPosition(
        pos => {
          map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          userMarker.position = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        },
        err => console.log("GPS awal error:", err),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
      );

      const btnMulai = document.getElementById("btnMulaiNavigasiRouting");
      let navigasiAktif = false;

      async function mulaiNavigasi() {
        if (navigasiAktif) return;
        if (!navigator.geolocation) { alert("GPS tidak tersedia"); return; }
        btnMulai.textContent = "⏹ Stop";
        btnMulai.style.background = "#e53935";
        navigasiAktif = true;
        blueDotEl.classList.remove("map-pin-user-off");
        blueDotEl.classList.add("map-pin-user-on");

        navigator.geolocation.getCurrentPosition(async pos => {
          await fetchRoute(pos.coords.latitude, pos.coords.longitude);
          updateUserPosition(pos.coords.latitude, pos.coords.longitude);
        });

        window._rollingWatchId = navigator.geolocation.watchPosition(
          pos => updateUserPosition(pos.coords.latitude, pos.coords.longitude),
          err => console.log("GPS error:", err),
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
        );
      }

      function stopNavigasi() {
        if (window._rollingWatchId) {
          navigator.geolocation.clearWatch(window._rollingWatchId);
          window._rollingWatchId = null;
        }
        traversedPolyline.setPath([]);
        remainingPolyline.setPath([]);
        fullPath = [];
        btnMulai.textContent = "▶ Mulai";
        btnMulai.style.background = "";
        navigasiAktif = false;
        blueDotEl.classList.remove("map-pin-user-on");
        blueDotEl.classList.add("map-pin-user-off");
        const infoEl = document.getElementById("infoJarakRouting");
        if (infoEl) infoEl.style.display = "none";
      }

      btnMulai.onclick = async function() {
        if (navigasiAktif) {
          stopNavigasi();
        } else {
          await mulaiNavigasi();
        }
      };

      // Auto start jika dipanggil dari popup pin
      if (autoStart) {
        setTimeout(() => mulaiNavigasi(), 300);
      }

      document.getElementById("btnTutupMapRouting").onclick = function() {
        mapPopup.style.display = "none";
        if (window._rollingWatchId) {
          navigator.geolocation.clearWatch(window._rollingWatchId);
          window._rollingWatchId = null;
        }
        traversedPolyline.setMap(null);
        remainingPolyline.setMap(null);
        btnMulai.textContent = "▶ Mulai";
        btnMulai.style.background = "";
        navigasiAktif = false;
        stopHeadingMode();
        window._rollingMapInstance = null;
      };
      
      // TOMBOL TAMPILKAN PIN
      let pinMarkers = [];

      // BADGE JUMLAH CUSTOMER
      const badgeCustomer = document.createElement("div");
      badgeCustomer.className = "map-badge-customer";
      badgeCustomer.style.display = "none";

      const badgeJumlah = document.createElement("div");
      badgeJumlah.className = "map-badge-jumlah";

      const dropdownHariPin = document.createElement("div");
      dropdownHariPin.className = "map-dropdown-hari-pin";

      const hariList = ["Semua Hari", "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const savedHariPin = localStorage.getItem("routingHariPin") || "Semua Hari";

      hariList.forEach(h => {
        const hItem = document.createElement("div");
        hItem.innerText = h;
        hItem.className = "map-dropdown-hari-pin-item";
        if (savedHariPin === h) hItem.classList.add("map-dropdown-hari-pin-aktif");
        hItem.dataset.hari = h;
        hItem.onclick = () => {
          localStorage.setItem("routingHariPin", h);
          dropdownHariPin.querySelectorAll(".map-dropdown-hari-pin-item").forEach(el => {
            el.classList.remove("map-dropdown-hari-pin-aktif");
          });
          hItem.classList.add("map-dropdown-hari-pin-aktif");
          dropdownHariPin.style.display = "none";

          // Filter ulang pin yang sudah tampil
          filterPinByHari(h);
        };
        dropdownHariPin.appendChild(hItem);
      });

      badgeJumlah.onclick = (e) => {
        e.stopPropagation();
        dropdownHariPin.style.display =
          dropdownHariPin.style.display === "none" ? "block" : "none";
      };

      badgeCustomer.appendChild(badgeJumlah);
      badgeCustomer.appendChild(dropdownHariPin);

      // Fungsi filter pin by hari
      let allPinData = [];

      async function filterPinByHari(hari) {
        // Hapus pin lama
        pinMarkers.forEach(m => m.map = null);
        pinMarkers = [];

        let filtered = hari === "Semua Hari"
          ? allPinData
          : allPinData.filter(x => x.hari === hari);

        badgeJumlah.textContent = filtered.length;

        for (const c of filtered) {
          const loc = window.normalizeGeoPoint(c.lokasiCustomer);
          if (!loc?.lat || !loc?.lng) continue;

          const hariColor = {
            "Minggu": "#e53935", "Senin": "#1a73e8", "Selasa": "#43a047",
            "Rabu": "#fb8c00", "Kamis": "#8e24aa", "Jumat": "#00897b", "Sabtu": "#f4511e",
          };
          const pinColor = hariColor[c.hari] || "#757575";

          const pinWrapper = document.createElement("div");
          pinWrapper.className = "map-pin-wrapper";
          const pinLabel = document.createElement("div");
          pinLabel.className = "map-pin-label";
          pinLabel.innerText = c.namaCustomer || "";
          const pinEl = document.createElement("div");
          pinEl.className = "map-pin-customer";
          pinEl.style.background = pinColor;
          pinWrapper.appendChild(pinLabel);
          pinWrapper.appendChild(pinEl);

          const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
          const pinMarker = new AdvancedMarkerElement({
            position: { lat: loc.lat, lng: loc.lng },
            map,
            content: pinWrapper,
            title: c.namaCustomer || "Customer",
          });

          pinMarker.addListener("click", () => {
            const cid = c.idCustomer || c.id;
            const currentDbName = localStorage.getItem("routingPinFilter") || "customerBaruDB";
            const foto = c.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.namaCustomer || 'C')}`;
            document.getElementById("rincianPinFoto").src = foto;
            document.getElementById("rincianPinNama").innerText = c.namaCustomer || "-";
            document.getElementById("rincianPinAlamat").innerText = c.alamatCustomer || "-";

            const kemarin = c.dataKemarin || {};
            const kemarinKeys = Object.keys(kemarin);
            if (kemarinKeys.length) {
              const teks = kemarinKeys.map(k => {
                const qty = kemarin[k]?.qty ?? kemarin[k] ?? 0;
                return `${k} ${qty}`;
              }).join(", ");
              document.getElementById("rincianPinKemarin").innerText = `Kemarin: ${teks}`;
            } else {
              document.getElementById("rincianPinKemarin").innerText = "";
            }

            const jarakEl = document.getElementById("rincianPinJarak");
            jarakEl.style.display = "none";
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(async pos => {
                try {
                  const resp = await fetch(`https://routes.googleapis.com/directions/v2:computeRoutes`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "X-Goog-Api-Key": "AIzaSyAqRO5D9ttXiGhxyYv1h8QQHxpoXLNO-AQ",
                      "X-Goog-FieldMask": "routes.legs.distanceMeters,routes.legs.duration",
                    },
                    body: JSON.stringify({
                      origin: { location: { latLng: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } } },
                      destination: { location: { latLng: { latitude: loc.lat, longitude: loc.lng } } },
                      travelMode: "DRIVE",
                    }),
                  });
                  const result = await resp.json();
                  const leg = result?.routes?.[0]?.legs?.[0];
                  if (leg) {
                    const km = (leg.distanceMeters / 1000).toFixed(1);
                    const menit = Math.ceil(parseInt(leg.duration.replace("s", "")) / 60);
                    document.getElementById("rincianPinJarakKm").textContent = `${km} km`;
                    document.getElementById("rincianPinJarakMenit").textContent = `~${menit} menit`;
                    jarakEl.style.display = "flex";
                  }
                } catch(e) { console.log("Gagal hitung jarak:", e); }
              });
            }

            document.getElementById("btnRincianMulaiRouting").onclick = () => {
              document.getElementById("popupRincianPin").style.display = "none";
              window.openMapRouting(cid, currentDbName, true);
            };

            document.getElementById("popupRincianPin").style.display = "flex";
          });

          pinMarkers.push(pinMarker);
        }
      }

      const btnTampilPin = document.createElement("button");
      btnTampilPin.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
        </svg>
      `;
      btnTampilPin.className = "map-btn-tampil-pin";

      // Restore state filter pin terakhir
      const savedPinFilter = localStorage.getItem("routingPinFilter");

      const dropdownPin = document.createElement("div");
      dropdownPin.className = "map-dropdown-pin";

      const dbOptions = [
        { label: "Kurir", value: "customerHarianDB" },
        { label: "Hunter", value: "customerBaruDB" },
        { label: "Sales", value: "customerSalesDB" },
      ];

      dbOptions.forEach(opt => {
        const item = document.createElement("div");
        item.innerText = opt.label;
        item.className = "map-dropdown-pin-item";
        if (savedPinFilter === opt.value) {
          item.classList.add("map-dropdown-pin-item-aktif");
        }
        item.dataset.value = opt.value;
        item.onclick = async () => {
          dropdownPin.style.display = "none";

          // Update state aktif di semua item
          dropdownPin.querySelectorAll(".map-dropdown-pin-item").forEach(el => {
            el.classList.remove("map-dropdown-pin-item-aktif");
          });
          item.classList.add("map-dropdown-pin-item-aktif");

          // Simpan filter ke localStorage
          localStorage.setItem("routingPinFilter", opt.value);

          // Hapus pin lama
          pinMarkers.forEach(m => m.map = null);
          pinMarkers = [];

          try {
            const idb = await window.openAppDB();
            let customers = [];

            if (opt.value === "customerHarianDB") {
              const allRaw = await new Promise(resolve => {
                const tx = idb.transaction("customerHarianDB", "readonly");
                const store = tx.objectStore("customerHarianDB");
                const r = store.getAll();
                r.onsuccess = () => resolve(r.result || []);
                r.onerror = () => resolve([]);
              });
              allRaw.forEach(item => {
                const arr = Array.isArray(item.data) ? item.data : [item];
                customers.push(...arr);
              });
            } else {
              customers = await new Promise(resolve => {
                const tx = idb.transaction(opt.value, "readonly");
                const store = tx.objectStore(opt.value);
                const r = store.getAll();
                r.onsuccess = () => resolve(r.result || []);
                r.onerror = () => resolve([]);
              });
            }

            for (const c of customers) {
              const loc = window.normalizeGeoPoint(c.lokasiCustomer);
              if (!loc?.lat || !loc?.lng) continue;

              const hariColor = {
                "Minggu": "#e53935",
                "Senin":  "#1a73e8",
                "Selasa": "#43a047",
                "Rabu":   "#fb8c00",
                "Kamis":  "#8e24aa",
                "Jumat":  "#00897b",
                "Sabtu":  "#f4511e",
              };
              const pinColor = hariColor[c.hari] || "#757575";

              const pinWrapper = document.createElement("div");
              pinWrapper.className = "map-pin-wrapper";

              const pinLabel = document.createElement("div");
              pinLabel.className = "map-pin-label";
              pinLabel.innerText = c.namaCustomer || "";

              const pinEl = document.createElement("div");
              pinEl.className = "map-pin-customer";
              pinEl.style.background = pinColor;

              pinWrapper.appendChild(pinLabel);
              pinWrapper.appendChild(pinEl);

              const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
              const pinMarker = new AdvancedMarkerElement({
                position: { lat: loc.lat, lng: loc.lng },
                map,
                content: pinWrapper,
                title: c.namaCustomer || "Customer",
              });

              pinMarker.addListener("click", () => {
                const cid = c.idCustomer || c.id;

                // Isi popup rincian
                const foto = c.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.namaCustomer || 'C')}`;
                document.getElementById("rincianPinFoto").src = foto;
                document.getElementById("rincianPinNama").innerText = c.namaCustomer || "-";
                document.getElementById("rincianPinAlamat").innerText = c.alamatCustomer || "-";

                // Hitung jarak & estimasi waktu ke customer
                const jarakEl = document.getElementById("rincianPinJarak");
                const jarakKmEl = document.getElementById("rincianPinJarakKm");
                const jarakMenitEl = document.getElementById("rincianPinJarakMenit");
                jarakEl.style.display = "none";
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(async pos => {
                    try {
                      const resp = await fetch(
                        `https://routes.googleapis.com/directions/v2:computeRoutes`,
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            "X-Goog-Api-Key": "AIzaSyAqRO5D9ttXiGhxyYv1h8QQHxpoXLNO-AQ",
                            "X-Goog-FieldMask": "routes.legs.distanceMeters,routes.legs.duration",
                          },
                          body: JSON.stringify({
                            origin: {
                              location: { latLng: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } }
                            },
                            destination: {
                              location: { latLng: { latitude: loc.lat, longitude: loc.lng } }
                            },
                            travelMode: "DRIVE",
                          }),
                        }
                      );
                      const result = await resp.json();
                      const leg = result?.routes?.[0]?.legs?.[0];
                      if (leg) {
                        const km = (leg.distanceMeters / 1000).toFixed(1);
                        const menit = Math.ceil(parseInt(leg.duration.replace("s","")) / 60);
                        jarakKmEl.textContent = `${km} km`;
                        jarakMenitEl.textContent = `~${menit} menit`;
                        jarakEl.style.display = "flex";
                      }
                    } catch(e) {
                      console.log("Gagal hitung jarak:", e);
                    }
                  });
                }

                // Data kemarin
                const kemarin = c.dataKemarin || {};
                const kemarinKeys = Object.keys(kemarin);
                if (kemarinKeys.length) {
                  const teks = kemarinKeys.map(k => {
                    const qty = kemarin[k]?.qty ?? kemarin[k] ?? 0;
                    return `${k} ${qty}`;
                  }).join(", ");
                  document.getElementById("rincianPinKemarin").innerText = `Kemarin: ${teks}`;
                } else {
                  document.getElementById("rincianPinKemarin").innerText = "";
                }

                // Tombol routing
                document.getElementById("btnRincianMulaiRouting").onclick = () => {
                  document.getElementById("popupRincianPin").style.display = "none";
                  window.openMapRouting(cid, opt.value, true);
                };

                document.getElementById("popupRincianPin").style.display = "flex";
              });

              pinMarkers.push(pinMarker);
            }

            btnTampilPin.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1a73e8" width="20" height="20">
                <path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
              </svg>
            `;

            // Update badge & simpan data untuk filter hari
            allPinData = customers;
            const hariAktif = localStorage.getItem("routingHariPin") || "Semua Hari";
            const jumlahAktif = hariAktif === "Semua Hari"
              ? customers.length
              : customers.filter(x => x.hari === hariAktif).length;
            badgeJumlah.textContent = jumlahAktif;
            badgeCustomer.style.display = "flex";

          } catch(e) {
            console.log("Gagal load pin:", e);
          }
        };
        dropdownPin.appendChild(item);
      });

      // Tambah opsi hapus pin
      const itemHapus = document.createElement("div");
      itemHapus.innerText = "✕ Hapus Semua Pin";
      itemHapus.className = "map-dropdown-pin-hapus";
      itemHapus.onclick = () => {
        pinMarkers.forEach(m => m.map = null);
        pinMarkers = [];
        localStorage.removeItem("routingPinFilter");
        dropdownPin.querySelectorAll(".map-dropdown-pin-item").forEach(el => {
          el.classList.remove("map-dropdown-pin-item-aktif");
        });
        allPinData = [];
        badgeCustomer.style.display = "none";
        btnTampilPin.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
          </svg>
        `;
        dropdownPin.style.display = "none";
      };
      dropdownPin.appendChild(itemHapus);

      btnTampilPin.onclick = (e) => {
        e.stopPropagation();
        dropdownPin.style.display =
          dropdownPin.style.display === "none" ? "block" : "none";
      };

      map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(badgeCustomer);
      map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(btnTampilPin);
      map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(dropdownPin);

      // Auto restore pin filter terakhir
      if (savedPinFilter) {
        const savedOpt = dbOptions.find(o => o.value === savedPinFilter);
        if (savedOpt) {
          const savedItem = dropdownPin.querySelector(`[data-value="${savedPinFilter}"]`);
          if (savedItem) savedItem.click();
        }
      }

      // TOMBOL KOMPAS
      let headingModeAktif = false;
      let deviceOrientationHandler = null;
      let compassDragHandler = null;

      const btnKompas = document.createElement("button");
      btnKompas.className = "map-btn-kompas";
      btnKompas.title = "Kompas / Heading Mode";
      btnKompas.innerHTML = `
        <div class="kompas-ring">
          <div class="kompas-jarum" id="kompasJarumRouting">
            <span class="kompas-n">N</span>
          </div>
        </div>
      `;

      function stopHeadingMode() {
        if (deviceOrientationHandler) {
          window.removeEventListener("deviceorientation", deviceOrientationHandler, true);
          deviceOrientationHandler = null;
        }
        if (compassDragHandler) {
          google.maps.event.removeListener(compassDragHandler);
          compassDragHandler = null;
        }
        // Kembali ke default 2D seperti pertama buka
        map.setHeading(0);
        map.setTilt(0);
        headingModeAktif = false;
        btnKompas.classList.remove("kompas-aktif");
        const jarum = document.getElementById("kompasJarumRouting");
        if (jarum) jarum.style.transform = "rotate(0deg)";
      }

      btnKompas.onclick = async function () {
        if (!headingModeAktif) {
          // Minta izin sensor (iOS 13+)
          if (
            typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function"
          ) {
            try {
              const perm = await DeviceOrientationEvent.requestPermission();
              if (perm !== "granted") {
                alert("Izin sensor kompas ditolak.");
                return;
              }
            } catch (e) {
              alert("Tidak bisa akses sensor kompas.");
              return;
            }
          }

          headingModeAktif = true;
          btnKompas.classList.add("kompas-aktif");
          map.setTilt(45);

          let lastHeading = 0;
          let rafPending = false;

          deviceOrientationHandler = function (e) {
            let heading = null;
            if (typeof e.webkitCompassHeading === "number") {
              heading = e.webkitCompassHeading;
            } else if (e.alpha !== null) {
              heading = (360 - e.alpha) % 360;
            }
            if (heading === null) return;

            // Smooth interpolasi heading
            let delta = heading - lastHeading;
            if (delta > 180) delta -= 360;
            if (delta < -180) delta += 360;
            lastHeading += delta * 0.2; // easing factor
            lastHeading = (lastHeading + 360) % 360;

            if (!rafPending) {
              rafPending = true;
              requestAnimationFrame(() => {
                const jarum = document.getElementById("kompasJarumRouting");
                if (jarum) jarum.style.transform = `rotate(${-lastHeading}deg)`;
                if (headingModeAktif) map.setHeading(lastHeading);
                rafPending = false;
              });
            }
          };
          window.addEventListener("deviceorientation", deviceOrientationHandler, true);

          // Auto off saat user geser peta dengan jari
          compassDragHandler = map.addListener("dragstart", () => {
            stopHeadingMode();
          });

        } else {
          stopHeadingMode();
        }
      };

      map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(btnKompas);

      map.addListener("click", () => {
        dropdownPin.style.display = "none";
        dropdownHariPin.style.display = "none";
        document.getElementById("popupRincianPin").style.display = "none";
      });

      // Cegah touch pada kontrol map menyebar ke gesture peta
      [badgeCustomer, btnTampilPin, btnKompas].forEach(el => {
        el.addEventListener("touchstart", e => e.stopPropagation(), { passive: true });
        el.addEventListener("touchmove", e => e.stopPropagation(), { passive: true });
        el.addEventListener("touchend", e => e.stopPropagation(), { passive: true });
      });

      document.getElementById("btnTutupRincianPin").onclick = () => {
        document.getElementById("popupRincianPin").style.display = "none";
      };

      window._rollingMapInstance = map;
    }, 200);

  } catch(err) {
    console.log("Gagal buka map:", err);
  }
};