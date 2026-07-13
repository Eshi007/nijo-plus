// Savana AI credentials — fill these in to make "Talk to Nijo" live.
// When left empty, the chat falls back to canned empathetic replies.
//
// ⚠️ If this repo is public / deployed, do NOT commit real keys here.
// On the deployed site, open the browser console and run:
//   localStorage.setItem("SAVANA_API_URL", "https://…/chat/completions");
//   localStorage.setItem("SAVANA_API_KEY", "sk-…");
//   localStorage.setItem("SAVANA_MODEL", "savana-chat-1");
// then reload. localStorage values (kept only in your browser) override
// the placeholders below. localStorage.clear() removes them.
window.SAVANA_CONFIG = {
  SAVANA_API_URL: localStorage.getItem("SAVANA_API_URL") || "",
  SAVANA_API_KEY: localStorage.getItem("SAVANA_API_KEY") || "",
  SAVANA_MODEL: localStorage.getItem("SAVANA_MODEL") || ""
};
