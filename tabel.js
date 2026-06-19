window.initInputTabelView = function() {
  const inner   = document.getElementById("inputTabelInner");
  const scroller = document.getElementById("inputTabelScroller");
  if (!inner) return;

  // Bersihkan canvas lama
  inner.innerHTML = "";
  inner.style.overflow = "hidden";
  inner.style.position = "relative";

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;touch-action:none;";
  inner.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  // ── DATA ──
  const activeVarians = (window.globalBawaBarang || [])
    .filter(item => {
      const key = Object.keys(item)[0];
      return item[key]?.isAktif === true;
    })
    .map(item => Object.keys(item)[0]);

  const groups = [
    { key: "kemarin",    label: "Data Kemarin", bg: "#e8f5e9", bgRow: "#f1faf2", th2: "#c8ebca" },
    { key: "return",     label: "Return",       bg: "#fff8e1", bgRow: "#fffde7", th2: "#ffe8a3" },
    { key: "expired",    label: "Expired",      bg: "#fce4ec", bgRow: "#fdf0f4", th2: "#ffc9c5" },
    { key: "konsinyasi", label: "Konsinyasi",   bg: "#e8f5e9", bgRow: "#f1faf2", th2: "#c8ebca" },
    { key: "cash",       label: "Cash",         bg: "#e3f2fd", bgRow: "#f0f8ff", th2: "#c4ebff" },
    { key: "lainnya",    label: "Lainnya",      bg: "#f3e5f5", bgRow: "#faf0fc", th2: "#e5c6ec" },
  ];

  const customerList  = window.listCustomerData  || [];
  const dataHarianMap = window._dataHarianMap    || {};

  // ── UKURAN KOLOM ──
  const COL_NO    = 32;
  const COL_NAMA  = 130;
  const COL_VAR   = 52;
  const COL_KET   = 60;
  const COL_PAY   = 90;
  const ROW_H1    = 28; // header row 1
  const ROW_H2    = 22; // header row 2
  const ROW_H     = 28; // data row
  const HEADER_H  = ROW_H1 + ROW_H2;

  // Hitung total kolom
  const vCount = activeVarians.length;
  const cols = [COL_NO, COL_NAMA];
  groups.forEach(() => {
    activeVarians.forEach(() => cols.push(COL_VAR));
  });
  cols.push(COL_KET, COL_PAY);

  const totalW = cols.reduce((a, b) => a + b, 0);
  const totalH = HEADER_H + customerList.length * ROW_H;

  // ── SCROLL & ZOOM STATE ──
  let offsetX = 0, offsetY = 0;
  let scale   = 1, minScale = 1;
  let panStartX = 0, panStartY = 0;
  let panOX = 0, panOY = 0;
  let isPanning = false;
  let pinchStartDist = 0, pinchLastScale = 1;
  let isPinching = false;
  let rafId = null;

  function clampOffset() {
    const cw = canvas.width  / window.devicePixelRatio;
    const ch = canvas.height / window.devicePixelRatio;
    const maxX = Math.max(0, totalW * scale - cw);
    const maxY = Math.max(0, totalH * scale - ch);
    offsetX = Math.min(Math.max(offsetX, 0), maxX);
    offsetY = Math.min(Math.max(offsetY, 0), maxY);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w   = inner.offsetWidth;
    const h   = inner.offsetHeight;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);

    // Hitung minScale supaya tabel fit lebar
    minScale = Math.min(1, w / totalW);
    if (scale < minScale) scale = minScale;
    clampOffset();
    draw();
  }

  // ── DRAW ──
  function colX(ci) {
    let x = 0;
    for (let i = 0; i < ci; i++) x += cols[i];
    return x;
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const cw  = canvas.width  / dpr;
    const ch  = canvas.height / dpr;

    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(-offsetX, -offsetY);
    ctx.scale(scale, scale);

    const visX1 = offsetX / scale;
    const visX2 = visX1 + cw / scale;
    const visY1 = offsetY / scale;
    const visY2 = visY1 + ch / scale;

    // ── HEADER ROW 1 ──
    let cx = 0;
    // No (rowspan 2)
    ctx.fillStyle = "#C9A67B";
    ctx.fillRect(cx, 0, COL_NO, HEADER_H);
    drawText("No", cx, 0, COL_NO, HEADER_H, "#fff", "700 11px Poppins,sans-serif", true);
    cx += COL_NO;
    // Nama Customer (rowspan 2)
    ctx.fillStyle = "#C9A67B";
    ctx.fillRect(cx, 0, COL_NAMA, HEADER_H);
    drawText("Nama Customer", cx, 0, COL_NAMA, HEADER_H, "#fff", "700 11px Poppins,sans-serif", true);
    cx += COL_NAMA;

    groups.forEach(g => {
      const gw = vCount * COL_VAR;
      ctx.fillStyle = g.bg;
      ctx.fillRect(cx, 0, gw, ROW_H1);
      drawText(g.label, cx, 0, gw, ROW_H1, "#333", "700 9px Poppins,sans-serif");
      cx += gw;
    });

    // Ket & Pay (rowspan 2)
    ctx.fillStyle = "#C9A67B";
    ctx.fillRect(cx, 0, COL_KET, HEADER_H);
    drawText("Ket", cx, 0, COL_KET, HEADER_H, "#fff", "700 10px Poppins,sans-serif", true);
    cx += COL_KET;
    ctx.fillStyle = "#C9A67B";
    ctx.fillRect(cx, 0, COL_PAY, HEADER_H);
    drawText("Pembayaran", cx, 0, COL_PAY, HEADER_H, "#fff", "700 10px Poppins,sans-serif", true);

    // ── HEADER ROW 2 (varian) ──
    cx = COL_NO + COL_NAMA;
    groups.forEach(g => {
      activeVarians.forEach(v => {
        ctx.fillStyle = g.th2;
        ctx.fillRect(cx, ROW_H1, COL_VAR, ROW_H2);
        drawText(v, cx, ROW_H1, COL_VAR, ROW_H2, "#444", "600 9px Poppins,sans-serif");
        cx += COL_VAR;
      });
    });

    // ── GRID LINES HEADER ──
    drawGrid(0, 0, totalW, HEADER_H, cols, [ROW_H1, ROW_H2]);

    // ── ROWS ──
    const rowStart = Math.max(0, Math.floor((visY1 - HEADER_H) / ROW_H));
    const rowEnd   = Math.min(customerList.length, Math.ceil((visY2 - HEADER_H) / ROW_H));

    for (let ri = rowStart; ri < rowEnd; ri++) {
      const cust = customerList[ri];
      const cid  = cust.idCustomer || cust.id || "";
      const dh   = dataHarianMap[cid] || null;
      const y    = HEADER_H + ri * ROW_H;
      const even = ri % 2 === 1;

      // BG row
      ctx.fillStyle = even ? "#f7f3ee" : "#fff";
      ctx.fillRect(0, y, totalW, ROW_H);
      // No
      ctx.fillStyle = even ? "#f7f3ee" : "#fff";
      ctx.fillRect(0, y, COL_NO, ROW_H);
      drawText(String(ri + 1), 0, y, COL_NO, ROW_H, "#888", "500 10px Poppins,sans-serif");
      // Nama
      ctx.fillStyle = even ? "#f7f3ee" : "#fff";
      ctx.fillRect(COL_NO, y, COL_NAMA, ROW_H);
      drawText(cust.namaCustomer || "-", COL_NO + 4, y, COL_NAMA - 4, ROW_H, "#333", "600 10px Poppins,sans-serif", false, true);

      // Data per group
      let gci = COL_NO + COL_NAMA;
      groups.forEach(g => {
        activeVarians.forEach(v => {
          let val = "-";
          let bgCell = even ? g.bgRow : "#fff";
          let textColor = "#444";

          if (g.key === "kemarin") {
            const qty = Number(cust.dataKemarin?.[v]?.qty || 0);
            val = qty > 0 ? String(qty) : "-";
            const konVal = Number(dh?.konsinyasi?.[v] || 0);
            const isDiff = dh && dh.konsinyasi && konVal !== qty;
            if (isDiff) { bgCell = "#dbeafe"; textColor = "#1d4ed8"; }
            else if (qty > 0) { bgCell = "rgba(255,177,92,.18)"; textColor = "#a85a00"; }
          } else {
            const raw = dh?.[g.key]?.[v];
            val = raw !== undefined && raw !== null ? String(raw) : "-";

            if (g.key === "konsinyasi") {
              const qty    = Number(cust.dataKemarin?.[v]?.qty || 0);
              const konVal = Number(raw || 0);
              if (dh && raw !== undefined && konVal !== qty) {
                bgCell = "#ffd6d6"; textColor = "#c62828";
              } else {
                bgCell = even ? g.bgRow : "#fff";
              }
            } else {
              bgCell = even ? g.bgRow : "#fff";
            }
          }

          ctx.fillStyle = bgCell;
          ctx.fillRect(gci, y, COL_VAR, ROW_H);
          drawText(val, gci, y, COL_VAR, ROW_H, textColor, "500 10px Poppins,sans-serif");
          gci += COL_VAR;
        });
      });

      // Keterangan
      const st = String(dh?.keterangan?.status || "").trim().toLowerCase();
      const ketText = st === "pending" ? "PN" : st === "tutup" ? "TP" : st === "putus" ? "PT" : "-";
      const ketColor = st === "pending" ? "#f59e0b" : st === "tutup" ? "#6b7280" : st === "putus" ? "#dc2626" : "#999";
      ctx.fillStyle = even ? "#f7f3ee" : "#fff";
      ctx.fillRect(gci, y, COL_KET, ROW_H);
      drawText(ketText, gci, y, COL_KET, ROW_H, ketColor, "700 10px Poppins,sans-serif");
      gci += COL_KET;

      // Pembayaran
      const pay = dh?.pembayaran?.bayarKonsumen
        ? "Rp" + Number(dh.pembayaran.bayarKonsumen).toLocaleString("id-ID")
        : "-";
      ctx.fillStyle = even ? "#f7f3ee" : "#fff";
      ctx.fillRect(gci, y, COL_PAY, ROW_H);
      drawText(pay, gci, y, COL_PAY, ROW_H, "#a8824e", "600 9px Poppins,sans-serif");

      // Grid row
      drawGrid(0, y, totalW, ROW_H, cols, [ROW_H]);
    }

    ctx.restore();
  }

  function drawText(text, x, y, w, h, color, font, wrap = false, leftAlign = false) {
    ctx.font      = font;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    const tx = leftAlign ? x + 4 : x + w / 2;
    ctx.textAlign = leftAlign ? "left" : "center";

    // Clip teks supaya tidak overflow
    ctx.save();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillText(text, tx, y + h / 2);
    ctx.restore();
  }

  function drawGrid(x, y, w, h, colWidths, rowHeights) {
    ctx.strokeStyle = "#e0d6cc";
    ctx.lineWidth   = 0.5;

    // Vertical lines
    let cx = x;
    colWidths.forEach(cw => {
      cx += cw;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + h);
      ctx.stroke();
    });

    // Horizontal lines
    let cy = y;
    rowHeights.forEach(rh => {
      cy += rh;
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(x + w, cy);
      ctx.stroke();
    });

    // Border luar
    ctx.strokeRect(x, y, w, h);
  }

  // ── TOUCH EVENTS ──
  canvas.addEventListener("touchstart", e => {
    if (e.touches.length === 1) {
      isPanning   = true;
      isPinching  = false;
      panStartX   = e.touches[0].clientX;
      panStartY   = e.touches[0].clientY;
      panOX       = offsetX;
      panOY       = offsetY;
    } else if (e.touches.length === 2) {
      isPinching  = true;
      isPanning   = false;
      pinchStartDist  = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchLastScale = scale;
    }
  }, { passive: true });

  canvas.addEventListener("touchmove", e => {
    e.preventDefault();

    if (isPanning && e.touches.length === 1) {
      offsetX = panOX - (e.touches[0].clientX - panStartX);
      offsetY = panOY - (e.touches[0].clientY - panStartY);
      clampOffset();
    } else if (isPinching && e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      scale = Math.min(3, Math.max(minScale, pinchLastScale * (dist / pinchStartDist)));
      clampOffset();
    }

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => { draw(); rafId = null; });
  }, { passive: false });

  canvas.addEventListener("touchend", e => {
    if (e.touches.length === 0) {
      isPanning  = false;
      isPinching = false;
    } else if (e.touches.length === 1) {
      isPinching = false;
      isPanning  = true;
      panStartX  = e.touches[0].clientX;
      panStartY  = e.touches[0].clientY;
      panOX      = offsetX;
      panOY      = offsetY;
    }
  }, { passive: true });

  // Init
  resize();
  window.addEventListener("resize", resize);
};