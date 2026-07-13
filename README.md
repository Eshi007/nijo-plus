# Nijo Plus — clickable MVP prototype

A mental-wellness companion app for Indian users (Hindi / Hinglish / Malayalam /
English). This is a **front-end-only prototype** for validating the user journey:
plain HTML/CSS/JS, no build step, all data mocked in memory. The one live
integration is the Savana AI LLM powering the "Talk to Nijo" chat.

## Run it

```bash
python3 -m http.server 4173   # from the repo root (any static server works)
# open http://localhost:4173
```

## Savana AI credentials

The chat works without credentials (it falls back to canned empathetic
replies). To make it live:

- **Locally:** fill in `SAVANA_API_URL`, `SAVANA_API_KEY`, `SAVANA_MODEL`
  in `config.js`. Don't commit real keys.
- **On the deployed site:** open the browser devtools console and run
  ```js
  localStorage.setItem("SAVANA_API_URL", "https://…/chat/completions");
  localStorage.setItem("SAVANA_API_KEY", "sk-…");
  localStorage.setItem("SAVANA_MODEL", "savana-chat-1");
  ```
  then reload. The key stays in your browser only.

The entire integration is one function — `getNijoReply(messages)` in
`app.js`. It POSTs OpenAI-style `{model, messages}` with a Bearer header and
reads `choices[0].message.content` (a few alternate shapes tolerated). Swap
providers by editing just that function.

> Note: the browser calls the API directly, so the Savana endpoint must allow
> CORS from the page's origin. If it doesn't, you'll silently get fallback
> replies — check the network tab.

## What's real and what's mocked

- Phone/OTP accept anything; no auth, no backend, no database.
- Journal entries, community posts, mood check-ins persist in memory for the
  session and feed the Mood insights chart.
- Helpline numbers on the Get help screen are real (iCall, Tele-MANAS 14416,
  emergency 112).
