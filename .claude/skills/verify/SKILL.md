---
name: verify
description: Build/launch/drive recipe for verifying the Nijo Plus prototype end to end in a headless browser.
---

# Verifying Nijo Plus (static web prototype)

No build step. Serve the repo root statically and drive it in a browser.

## Launch

```bash
python3 -m http.server 4173        # from repo root, background
```

## Drive

No Playwright browsers are cached on this machine; use `playwright-core`
with the installed system Chrome instead (no download):

```bash
mkdir -p /tmp/nijo-verify && cd /tmp/nijo-verify
npm init -y && npm i playwright-core
# then in the script:
#   chromium.launch({ channel: "chrome", headless: true })
```

Viewport 430×900 shows the full phone frame. All state is in-memory in
`window.A` / closures — `page.evaluate(() => window.A.go("chat"))` jumps
straight to any screen, skipping onboarding.

## Flows worth driving

- Onboarding: welcome → OTP (any input passes) → language (Hinglish
  pre-selected) → privacy (consent checkbox gates the button) → disclaimer → home.
- Chat: with empty `config.js` the Savana call is skipped and canned
  fallbacks rotate (~900 ms simulated typing). To test the live path,
  run a local OpenAI-shaped mock and inject `window.SAVANA_CONFIG` via
  `page.addInitScript` (must run after DOMContentLoaded since config.js
  loads before app.js).
- Check-in → Mood insights (new check-in must appear as "Today · <mood>").
- Journal / community post / reply / report / paywall / settings
  (delete-data uses `window.confirm` — handle `page.on("dialog")`;
  export uses a blob download — `page.waitForEvent("download")`).

## Gotchas

- Every re-render replaces `#app` innerHTML — re-query locators after
  any click.
- The toast lingers 2.2 s and can photobomb screenshots taken right
  after an action.
