---
name: verify
description: Build/launch/drive recipe for verifying the NiJo Plus prototype end to end in a headless browser.
---

# Verifying NiJo Plus (static web prototype)

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

Viewport 430×900 shows the full phone frame. Navigation is exposed as
`window.A` — `page.evaluate(() => window.A.go("threads"))` jumps to any
screen. App state lives in the module-scoped `db`, mirrored into
`sessionStorage["nijo.prototype.v2"]` on every write, so assertions can
read it with `page.evaluate(() => JSON.parse(sessionStorage.getItem(...)))`.

## Flows worth driving

- Onboarding, in this order: splash (auto-routes after ~900 ms) → language
  (Hinglish preselected) → phone (any 6+ digits) → OTP (any input passes) →
  consent (button gated on **both** checkboxes; mood optional) →
  name companion → auto-created untitled thread → chat.
- Ordering assertions: `consents[0].accepted_at <= mood_checks[0].captured_at`,
  and `threads.length === 1` with `title === null` after onboarding.
- Chat: with no Sarvam config the call is skipped and localised fallbacks
  rotate (~700 ms, then a word-by-word reveal — allow ~3.5 s per turn).
  To test the live path, run an OpenAI-shaped mock and inject
  `window.SARVAM_CONFIG` via `page.addInitScript` (config.js loads before
  app.js, so set it after DOMContentLoaded or overwrite the global).
- Care card: send a message matching `DISTRESS_PATTERNS` (e.g. "I don't
  want to live"). Assert `.overlay` exists **and** `.chat-scroll` is still
  visible — it must never replace the chat. Dismisses by scrim click or
  the ghost button; afterwards `user.distress_flag_at` is set and a
  "Get help" action appears in the chat header on every thread.
- Thread list: Settings → "Load sample threads" seeds 3 more, one of them
  older than 7 days so `.thread-row.dormant` renders.
- Settings: rename companion, change language, export (blob download —
  `page.waitForEvent("download")`), delete account (typed "DELETE" gate,
  no `window.confirm`), sign out.
- Session check: `page.reload()` after onboarding should land on the
  thread list, not the language screen.

## Gotchas

- Every re-render replaces `#app` innerHTML — re-query locators after
  any click.
- The toast lingers 2.2 s and can photobomb screenshots taken right
  after an action.
- `A.go(...)` mid-stream aborts the word-by-word reveal by design.
