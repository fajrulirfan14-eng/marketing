/* =========================
   AI FLOATING BUTTON
========================= */

(function() {

  // ── Config ──
  const AI_CONFIG = {
    icon      : "fa-solid fa-robot",
    size      : 52,          // px, ukuran tombol
    margin    : 16,          // jarak minimal dari tepi layar
    snapSide  : true,        // true = snap ke kiri/kanan setelah dilepas
    snapDelay : 300,         // ms animasi snap
    storageX  : "ai_btn_x",  // key posisi tersimpan
    storageY  : "ai_btn_y",
  };

  let btn       = null;
  let isDragging = false;
  let hasMoved   = false;

  // ── Inject CSS ──
  function injectCss() {
    if (document.getElementById("aiBtnCss")) return;
    const s = document.createElement("style");
    s.id = "aiBtnCss";
    s.textContent = `
      #aiBtnFloat {
        position: fixed;
        width: ${AI_CONFIG.size}px;
        height: ${AI_CONFIG.size}px;
        border-radius: 50%;
        background: linear-gradient(135deg, #7a4f2d, #B08A5C);
        box-shadow: 0 4px 16px rgba(176,138,92,.45), 0 1px 4px rgba(0,0,0,.2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 20px;
        cursor: pointer;
        z-index: 9990;
        touch-action: none;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        transition: box-shadow .2s, transform .2s;
        will-change: transform;
      }
      #aiBtnFloat.snapping {
        transition: left ${AI_CONFIG.snapDelay}ms cubic-bezier(.4,0,.2,1),
                    top  ${AI_CONFIG.snapDelay}ms cubic-bezier(.4,0,.2,1),
                    box-shadow .2s, transform .2s;
      }
      #aiBtnFloat:active {
        transform: scale(.92);
        box-shadow: 0 2px 8px rgba(176,138,92,.35);
      }
      #aiBtnFloat .ai-btn-ripple {
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        border: 2px solid rgba(176,138,92,.4);
        animation: aiBtnPulse 2s ease-out infinite;
        pointer-events: none;
      }
      @keyframes aiBtnPulse {
        0%   { transform: scale(1);   opacity: .7; }
        100% { transform: scale(1.5); opacity: 0;  }
      }
      #aiBtnFloat.hide {
        transform: scale(0);
        opacity: 0;
        pointer-events: none;
        transition: transform .25s cubic-bezier(.4,0,.2,1), opacity .25s;
      }
      #aiBtnFloat.show {
        transform: scale(1);
        opacity: 1;
        transition: transform .3s cubic-bezier(.34,1.56,.64,1), opacity .3s;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Buat tombol ──
  function createBtn() {
    if (document.getElementById("aiBtnFloat")) return;

    injectCss();

    btn = document.createElement("div");
    btn.id        = "aiBtnFloat";
    btn.innerHTML = `<i class="${AI_CONFIG.icon}"></i><span class="ai-btn-ripple"></span>`;
    document.body.appendChild(btn);

    // Posisi awal — ambil dari storage atau default kanan bawah
    const margin = AI_CONFIG.margin;
    const size   = AI_CONFIG.size;
    const savedX = localStorage.getItem(AI_CONFIG.storageX);
    const savedY = localStorage.getItem(AI_CONFIG.storageY);

    if (savedX !== null && savedY !== null) {
      btn.style.left = savedX + "px";
      btn.style.top  = savedY + "px";
    } else {
      btn.style.right  = margin + "px";
      btn.style.bottom = (margin + 80) + "px"; // di atas bottom nav
    }

    // Animasi masuk
    btn.classList.add("hide");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => btn.classList.replace("hide", "show"));
    });

    // ── Drag logic ──
    let startX, startY, startLeft, startTop;

    function getPos() {
      const rect = btn.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    }

    function clamp(val, min, max) {
      return Math.max(min, Math.min(max, val));
    }

    function snapToSide() {
      if (!AI_CONFIG.snapSide) return;
      const margin = AI_CONFIG.margin;
      const size   = AI_CONFIG.size;
      const midX   = window.innerWidth / 2;
      const curLeft = parseInt(btn.style.left);

      btn.classList.add("snapping");
      if (curLeft + size / 2 < midX) {
        btn.style.left = margin + "px";
      } else {
        btn.style.left = (window.innerWidth - size - margin) + "px";
      }
      setTimeout(() => btn.classList.remove("snapping"), AI_CONFIG.snapDelay);

      // Simpan posisi
      localStorage.setItem(AI_CONFIG.storageX, parseInt(btn.style.left));
      localStorage.setItem(AI_CONFIG.storageY, parseInt(btn.style.top));
    }

    function onStart(clientX, clientY) {
      isDragging = true;
      hasMoved   = false;
      const pos  = getPos();
      startX     = clientX;
      startY     = clientY;
      startLeft  = pos.left;
      startTop   = pos.top;

      // Hapus right/bottom supaya pakai left/top saja
      btn.style.left   = startLeft + "px";
      btn.style.top    = startTop  + "px";
      btn.style.right  = "auto";
      btn.style.bottom = "auto";
      btn.classList.remove("snapping");
    }

    function onMove(clientX, clientY) {
      if (!isDragging) return;
      const dx   = clientX - startX;
      const dy   = clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasMoved = true;

      const margin = AI_CONFIG.margin;
      const size   = AI_CONFIG.size;
      const maxX   = window.innerWidth  - size - margin;
      const maxY   = window.innerHeight - size - margin;

      btn.style.left = clamp(startLeft + dx, margin, maxX) + "px";
      btn.style.top  = clamp(startTop  + dy, margin, maxY) + "px";
    }

    function onEnd() {
      if (!isDragging) return;
      isDragging = false;
      if (hasMoved) {
        snapToSide();
      } else {
        // Tap → buka AI chat
        if (typeof window.showView === "function") {
          window.showView("chatAi");
          hideAiButton();
        }
      }
    }

    // Mouse
    btn.addEventListener("mousedown", e => {
      e.preventDefault();
      onStart(e.clientX, e.clientY);
      const onMove_ = e => onMove(e.clientX, e.clientY);
      const onEnd_  = () => {
        onEnd();
        document.removeEventListener("mousemove", onMove_);
        document.removeEventListener("mouseup",   onEnd_);
      };
      document.addEventListener("mousemove", onMove_);
      document.addEventListener("mouseup",   onEnd_);
    });

    // Touch
    btn.addEventListener("touchstart", e => {
      e.preventDefault();
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    btn.addEventListener("touchmove", e => {
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    btn.addEventListener("touchend", () => onEnd());
  }

  // ── Public ──
  window.showAiButton = function() {
    if (!document.getElementById("aiBtnFloat")) {
      createBtn();
    } else {
      btn = document.getElementById("aiBtnFloat");
      btn.classList.remove("hide");
      btn.classList.add("show");
      btn.style.pointerEvents = "all";
    }
  };

  window.hideAiButton = function() {
    btn = document.getElementById("aiBtnFloat");
    if (!btn) return;
    btn.classList.remove("show");
    btn.classList.add("hide");
  };

  // ── Auto init saat load ──
  document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("pref_ai") !== "0") {
      window.showAiButton();
    }
  });

})();