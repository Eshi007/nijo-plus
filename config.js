// Sarvam credentials — fill these in to make the chat live.
// When left empty, the chat falls back to canned empathetic replies so the
// journey is still walkable.
//
// ⚠️ This repo is public and deployed. Do NOT commit real keys here.
// On the deployed site, open the browser console and run:
//   localStorage.setItem("SARVAM_API_URL", "https://api.sarvam.ai/v1/chat/completions");
//   localStorage.setItem("SARVAM_API_KEY", "…");
//   localStorage.setItem("SARVAM_MODEL", "sarvam-105b");
// then reload. localStorage values (kept only in your browser) override the
// placeholders below. localStorage.clear() removes them.
//
// In the real app the phone never holds this key: it calls the `chat` Edge
// Function, which talks to Sarvam with the key held in Supabase secrets.
window.SARVAM_CONFIG = {
  SARVAM_API_URL: localStorage.getItem("SARVAM_API_URL") || "",
  SARVAM_API_KEY: localStorage.getItem("SARVAM_API_KEY") || "",
  SARVAM_MODEL: localStorage.getItem("SARVAM_MODEL") || "sarvam-105b"
};
