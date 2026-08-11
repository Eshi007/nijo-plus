# NiJo Plus — clickable MVP prototype

A mental-wellness companion for Indian users (Hinglish / Hindi / Malayalam /
English). This is a **front-end-only prototype** for walking the journey before
the backend exists: plain HTML/CSS/JS, no build step, no server, no auth.

The journey and the data model follow the build spec — Sarvam-only test MVP,
threaded architecture.

## Run it

```bash
python3 -m http.server 4173   # from the repo root (any static server works)
# open http://localhost:4173
```

## The journey

```
Splash ── session? ── yes → ThreadList
                      no  → LanguageSelect → PhoneEntry → OtpEntry
                              → ConsentAndMood → NameCompanion
                              → auto-created first thread (untitled) → Chat
```

Ten screens, matching the spec: `Splash`, `LanguageSelect`, `PhoneEntry`,
`OtpEntry`, `ConsentAndMood`, `NameCompanion`, `ThreadList`, `Chat`, `Settings`,
and the `CareCard` overlay.

## Design

Follows the screen design prompts: warm cream `#FBF7F1`, orange `#F0742A` for
actions, **companion green `#5B8C7E` for the AI's presence**, and **care red
`#C75D52` for distress moments only, never decoration**. Fraunces for display,
Inter for body — with Noto Sans Devanagari and Noto Sans Malayalam behind both,
since neither Latin face covers those scripts. Sentence case everywhere; line
height left generous for taller glyphs.

No streaks, badges, counters, progress rings or unread indicators exist
anywhere in the app, by design.

Why the flow is ordered this way:

- **Language before terms.** DPDP requires the notice to be understandable to
  the person consenting. The choice is held locally and written to the user row
  once auth exists.
- **Consent writes before the mood write.** Mood is personal data.
- **Two separate checkboxes, one page.** Terms acceptance and data-processing
  consent are separately affirmable; a single blanket tick is the pattern the
  Act was written against. Both sit above the fold, and Continue needs both
  ticks *and* a mood.
- **The first thread is auto-created and untitled.** Nobody in distress wants to
  file a ticket before they can speak. "New problem" only appears once a thread
  exists.
- **The care card is an overlay, never a replacement.** The conversation stays
  visible underneath it. It mounts outside `#app` so re-rendering the chat
  behind it never restarts its entrance animation. Care red appears as a single
  accent line, not a wash; there is no emergency iconography and the word
  "crisis" appears nowhere.
- **No badges, counts, streaks or nudges** anywhere in the thread list.

## Chat sequence

`sendMessage()` in `app.js` runs the spec's order: reset the daily count, check
the budget, insert the user message optimistically, **classify distress (call 1,
before generation)**, flag it at person level if found, assemble the prompt,
generate (call 2), stream, persist, increment, and summarise every 10 messages.

Prompt assembly keeps the cache boundary honest: `STATIC_SYSTEM_PROMPT` is
byte-identical for every user, and companion name, language and personal facts
sit below it in the person-memory block.

## Sarvam credentials

The chat works without credentials — it falls back to canned replies in the
selected language. To make it live:

- **Locally:** fill in `SARVAM_API_URL`, `SARVAM_API_KEY`, `SARVAM_MODEL` in
  `config.js`. Don't commit real keys.
- **On the deployed site:** open the browser console and run
  ```js
  localStorage.setItem("SARVAM_API_URL", "https://api.sarvam.ai/v1/chat/completions");
  localStorage.setItem("SARVAM_API_KEY", "…");
  localStorage.setItem("SARVAM_MODEL", "sarvam-105b");
  ```
  then reload. The key stays in your browser only.

The whole integration is one function — `getNijoReply(messages)` in `app.js`.
It POSTs OpenAI-style `{model, messages}` with a Bearer header. Swap providers by
editing that function alone.

> In the real app the phone never holds this key: it calls the `chat` Edge
> Function, which talks to Sarvam with the key in Supabase secrets. This is a
> browser-only prototype, so it calls directly — which also means the endpoint
> must allow CORS from the page's origin, or you'll silently get fallbacks.

## What's real and what's mocked

- Phone/OTP accept anything; no SMS, no auth, no database.
- State is shaped like the Postgres schema (`users`, `consents`, `threads`,
  `messages`, `thread_memory`, `person_memory`, `mood_checks`,
  `distress_events`) and kept in `sessionStorage`, so the Splash session check
  has something to check and Export dumps something honest. Closing the tab
  resets everything.
- The distress classifier is a keyword pass, not a model call, so the care card
  is demonstrable offline. It still runs *before* generation, as it must.
- Summarisation is a local stand-in for the async `summarise-thread` function.
- Streaming reveals a whole reply word by word; the real client streams tokens
  off the Edge Function via `expo/fetch`.
- The daily message budget (30) is enforced here in the client. In production
  this is server-side only — a client-side limit is a suggestion.
- Helpline numbers on the care card are real: Tele-MANAS 14416, KIRAN
  1800-599-0019, iCall 9152987821, emergency 112.

Settings has a **Load sample threads** button so the thread list's ordering and
its receding dormant rows are visible without a week of use.
