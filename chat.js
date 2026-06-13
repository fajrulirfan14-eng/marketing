// =========================
// CHAT AI — chatai.js
// Vanilla JS + Firebase
// Siap integrasi Gemma
// =========================

// UID chat sesi aktif
let currentChatId = null;

// =========================
// INIT VIEW
// Dipanggil saat view aktif
// =========================
window.initChatAiView = function () {

  console.log("🤖 Chat AI View init");

  const input   = document.getElementById("chatAiInput");
  const sendBtn = document.getElementById("chatAiSendBtn");

  if (!input || !sendBtn) return;

  // ---
  // Auto-resize textarea
  // ---
  input.addEventListener("input", function () {

    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 120) + "px";

    // aktif/nonaktif tombol kirim
    sendBtn.disabled = !this.value.trim();

  });

  // ---
  // Enter = kirim, Shift+Enter = baris baru
  // ---
  input.addEventListener("keydown", function (e) {

    if (e.key === "Enter" && !e.shiftKey) {

      e.preventDefault();

      if (!sendBtn.disabled) {
        sendMessage();
      }
    }
  });

  // ---
  // Tombol kirim
  // ---
  sendBtn.onclick = sendMessage;

  // ---
  // Generate chat ID untuk sesi ini
  // ---
  if (!currentChatId) {

    currentChatId = generateChatId();
  }

  // ---
  // Render histori chat
  // ---
  renderChat();

};

// =========================
// GENERATE CHAT ID
// Format: UID_YYYYMMDD_HHmmss
// =========================
function generateChatId() {

  const uid = window.auth?.currentUser?.uid || "anon";

  const now = new Date();

  const stamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    "_" +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");

  return `${uid}_${stamp}`;
}

// =========================
// RENDER CHAT
// Load histori dari Firestore
// =========================
async function renderChat() {

  const wrap = document.getElementById("chatAiMessages");

  if (!wrap) return;

  /*
  ============================================
  TODO: HISTORI PERCAKAPAN
  ============================================

  Load messages dari Firestore:

    chatAi
      └─ {currentChatId}
         └─ messages (subcollection)
            └─ { role, content, createdAt }

  Contoh query:

    const q = query(
      collection(db, "chatAi", currentChatId, "messages"),
      orderBy("createdAt", "asc"),
      limit(50)    // <-- batasi data
    );

    const snap = await getDocs(q);

    snap.forEach(docSnap => {
      const { role, content } = docSnap.data();
      appendMessage(role, content, false); // false = tidak scroll
    });

    scrollToBottom();

  ============================================
  TODO: HAK AKSES ROLE
  ============================================

  Cek role user sebelum load:

    const userSnap = await getDoc(doc(db, "users", uid));
    const role = userSnap.data()?.role;

    if (!["adminCabang", "owner"].includes(role)) {
      // tampilkan pesan tidak punya akses
      return;
    }

  ============================================
  */

  // Saat ini belum ada histori — tampilkan empty state
  // (empty state sudah ada di HTML)

}

// =========================
// SEND MESSAGE
// =========================
async function sendMessage() {

  const input   = document.getElementById("chatAiInput");
  const sendBtn = document.getElementById("chatAiSendBtn");

  const text = input.value.trim();

  if (!text) return;

  // Hapus empty state
  document.getElementById("chatAiEmpty")?.remove();

  // Tampilkan bubble user
  appendMessage("user", text);

  // Reset input
  input.value = "";
  input.style.height = "auto";
  sendBtn.disabled = true;

  // ---
  // Simpan ke Firestore
  // ---
  try {

    const uid = window.auth?.currentUser?.uid;

    if (!uid) {
      throw new Error("User belum login");
    }

    /*
    ============================================
    TODO: SIMPAN PESAN USER KE FIRESTORE
    ============================================

    import { addDoc, collection, serverTimestamp } from "firebase/firestore";

    await addDoc(
      collection(db, "chatAi", currentChatId, "messages"),
      {
        role:      "user",
        content:   text,
        createdAt: serverTimestamp(),
        uid:       uid,

        // ============================================
        // TODO: PEMBATASAN DATA
        // ============================================
        // Tambahkan idCabang untuk isolasi per cabang:
        //
        //   idCabang: adminData.idCabang,
        //
        // Agar Firestore rules bisa enforce:
        //   allow read, write: if resource.data.idCabang
        //     == request.auth.token.idCabang;
        // ============================================
      }
    );

    ============================================
    */

    // Simulasi (hapus saat Gemma sudah aktif)
    await simulateAiResponse(text);

  } catch (err) {

    console.log("sendMessage error:", err);

    hideTypingIndicator();

    appendMessage(
      "assistant",
      "Terjadi kesalahan. Silakan coba lagi."
    );

  }

}

// =========================
// SIMULASI RESPONS AI
// Hapus fungsi ini saat
// Gemma sudah diintegrasikan
// =========================
async function simulateAiResponse(userText) {

  showTypingIndicator();

  // Delay simulasi jaringan
  await delay(1200);

  hideTypingIndicator();

  /*
  ============================================
  TODO: INTEGRASI GEMMA
  ============================================

  Ganti simulasi ini dengan panggilan ke
  endpoint Gemma, contoh:

    const response = await fetch("/api/gemma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId:  currentChatId,
        message: userText,
        uid:     window.auth.currentUser.uid,

        // Sertakan konteks data operasional
        // dari Firestore jika diperlukan:
        // context: await buildOperationalContext(uid),
      })
    });

    const data = await response.json();
    const aiText = data.reply;

    // Simpan respons AI ke Firestore:
    await addDoc(
      collection(db, "chatAi", currentChatId, "messages"),
      {
        role:      "assistant",
        content:   aiText,
        createdAt: serverTimestamp(),
      }
    );

    appendMessage("assistant", aiText);

  ============================================
  */

  // Respons sementara
  appendMessage(
    "assistant",
    "Fitur AI sedang dalam pengembangan."
  );

}

// =========================
// APPEND MESSAGE
// role: "user" | "assistant"
// animate: true/false
// =========================
function appendMessage(
  role,
  text,
  animate = true
) {

  const wrap = document.getElementById("chatAiMessages");

  if (!wrap) return;

  const box = document.createElement("div");

  const time = new Date().toLocaleTimeString("id-ID", {
    hour:   "2-digit",
    minute: "2-digit"
  });

  box.className =
    role === "user"
      ? "chat-bubble chat-bubble-user"
      : "chat-bubble chat-bubble-ai";

  if (!animate) {
    box.style.animation = "none";
  }

  // Escape HTML untuk keamanan
  const safeText = escapeHtml(text);

  box.innerHTML = `
    <div>${safeText}</div>
    <div class="chat-message-time">${time}</div>
  `;

  wrap.appendChild(box);

  scrollToBottom();

}

// =========================
// SCROLL KE BAWAH
// =========================
function scrollToBottom() {

  const wrap = document.getElementById("chatAiMessages");

  if (!wrap) return;

  wrap.scrollTop = wrap.scrollHeight;

}

// =========================
// TYPING INDICATOR
// =========================
function showTypingIndicator() {

  const wrap = document.getElementById("chatAiMessages");

  if (!wrap) return;

  // Hapus dulu kalau ada
  hideTypingIndicator();

  const div = document.createElement("div");

  div.id        = "typingIndicator";
  div.className = "chat-typing";

  div.innerHTML = `
    <span></span>
    <span></span>
    <span></span>
  `;

  wrap.appendChild(div);

  scrollToBottom();

}

function hideTypingIndicator() {

  document.getElementById("typingIndicator")?.remove();

}

// =========================
// SUGGESTION CHIP
// Isi textarea dari chip
// =========================
window.useSuggestion = function (chipEl) {

  const input   = document.getElementById("chatAiInput");
  const sendBtn = document.getElementById("chatAiSendBtn");

  if (!input) return;

  input.value = chipEl.innerText.trim();

  // Trigger resize & enable button
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 120) + "px";
  sendBtn.disabled   = false;

  input.focus();

};

// =========================
// HELPER: ESCAPE HTML
// Cegah XSS dari konten chat
// =========================
function escapeHtml(text) {

  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>");

}

// =========================
// HELPER: DELAY
// =========================
function delay(ms) {

  return new Promise(resolve => setTimeout(resolve, ms));

}

// =========================
// AUTO INIT
// Jika halaman dimuat langsung
// =========================
document.addEventListener("DOMContentLoaded", () => {

  // Cek apakah view ini aktif
  const view = document.getElementById("view-chatAi");

  if (view && view.classList.contains("active")) {
    window.initChatAiView();
  }

});
