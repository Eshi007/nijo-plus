/* NiJo Plus — clickable MVP prototype.

   Journey and data model follow the build spec: Splash → LanguageSelect →
   PhoneEntry → OtpEntry → ConsentAndMood → NameCompanion → (auto first thread)
   → Chat, with ThreadList, Settings and the CareCard overlay.

   Everything the spec puts in Postgres lives in `db` below, shaped like the
   real tables so the export payload and the flows are honest. It's persisted to
   sessionStorage so the Splash session check has something to check.

   The one live integration is Sarvam behind getNijoReply(). In production the
   phone never talks to Sarvam — the app calls the `chat` Edge Function, which
   holds the key. This is a browser-only prototype, so it calls directly and the
   key stays in the tester's own browser. */

(function () {
  "use strict";

  // ---------- constants ----------
  const TERMS_VERSION = "1.0";
  const DAILY_MESSAGE_LIMIT = 30; // server-side in production (step 3 of the chat sequence)
  const SUMMARISE_EVERY = 10;
  const RECENT_TURNS = 12;
  const DORMANT_AFTER_DAYS = 7;
  const STORE_KEY = "nijo.prototype.v2";

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nowIso = () => new Date().toISOString();
  const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () => dateKey(new Date());
  const uid = (p) => p + "-" + Math.random().toString(36).slice(2, 10);

  function truncate(s, n) {
    const t = String(s ?? "").replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
  }

  function relTime(iso) {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m";
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + "h";
    const days = Math.round(hrs / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return days + "d";
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2200);
  }

  // ---------- icons (line style, stroke = currentColor) ----------
  const stroke = (paths, extra) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}${extra || ""}</svg>`;
  const I = {
    back: stroke('<path d="M15 5l-7 7 7 7" stroke-width="2.2"/>'),
    phone: stroke('<path d="M21.5 16.9v3a1.8 1.8 0 0 1-2 1.8 18.8 18.8 0 0 1-8.2-2.9 18.4 18.4 0 0 1-5.7-5.7A18.8 18.8 0 0 1 2.7 4.9a1.8 1.8 0 0 1 1.8-2h3a1.8 1.8 0 0 1 1.8 1.5c.1.9.3 1.8.6 2.7a1.8 1.8 0 0 1-.4 1.9L8.2 10.3a14.7 14.7 0 0 0 5.5 5.5l1.3-1.3a1.8 1.8 0 0 1 1.9-.4c.9.3 1.8.5 2.7.6a1.8 1.8 0 0 1 1.9 2.2z"/>'),
    info: stroke('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.2"/>'),
    up: stroke('<path d="M12 19V5.5M5.5 12 12 5.5 18.5 12" stroke-width="2.2"/>'),
    check: stroke('<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.4"/>'),
    plus: stroke('<path d="M12 5v14M5 12h14" stroke-width="2.2"/>'),
    gear: stroke('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.7-1.3-1.8-3.1-2 .8a7.7 7.7 0 0 0-2.6-1.5L14.4 3h-3.6l-.3 2.4a7.7 7.7 0 0 0-2.6 1.5l-2-.8L4 9.2l1.7 1.3a7.7 7.7 0 0 0 0 3L4 14.8l1.8 3.1 2-.8a7.7 7.7 0 0 0 2.6 1.5l.3 2.4h3.6l.3-2.4a7.7 7.7 0 0 0 2.6-1.5l2 .8 1.8-3.1z"/>'),
  };
  // brand smile: arc + dot
  const smile = (color) =>
    `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7" r="2" fill="${color}"/><path d="M6 12c1.7 2.8 3.9 4.2 6 4.2s4.3-1.4 6-4.2" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/></svg>`;

  // mood faces, one per score: frown → big smile
  const MOODS = ["Rough", "Low", "Okay", "Good", "Great"];
  const MOOD_MOUTHS = [
    '<path d="M8.4 16.6c1-1.7 2.2-2.5 3.6-2.5s2.6.8 3.6 2.5"/>',
    '<path d="M8.6 16c1-.9 2.1-1.3 3.4-1.3s2.4.4 3.4 1.3"/>',
    '<path d="M8.8 15.4h6.4"/>',
    '<path d="M8.6 14.6c1 .9 2.1 1.3 3.4 1.3s2.4-.4 3.4-1.3"/>',
    '<path d="M8.2 14.2c1 1.8 2.3 2.7 3.8 2.7s2.8-.9 3.8-2.7"/>',
  ];
  const moodFace = (i) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M8.6 9.7v.01M15.4 9.7v.01" stroke-width="2.5"/>${MOOD_MOUTHS[i]}</svg>`;

  // ---------- language ----------
  // Each option in its own script, never transliterated — someone should be
  // able to find their language without reading English first.
  const LANGUAGES = [
    { value: "Hinglish", label: "Hinglish" },
    { value: "Hindi", label: "हिन्दी" },
    { value: "Malayalam", label: "മലയാളം" },
    { value: "English", label: "English" },
  ];

  const OPENERS = {
    Hinglish: "Hi, main yahin hoon. Aaj mann mein kya chal raha hai?",
    Hindi: "नमस्ते, मैं यहीं हूँ। आज मन में क्या चल रहा है?",
    Malayalam: "ഹായ്, ഞാൻ ഇവിടെയുണ്ട്. ഇന്ന് മനസ്സിൽ എന്താണ്?",
    English: "Hi, I'm here. What's on your mind today?",
  };

  // Used when Sarvam isn't configured, so the journey stays walkable offline.
  const FALLBACKS = {
    Hinglish: [
      "Main sun raha hoon. Thoda aur batao — kab se aisa lag raha hai?",
      "Ye kaafi heavy lagta hai. Koi jaldi nahi, apne time pe bolo.",
      "Samajh sakta hoon. Aaj din ka sabse mushkil part kya tha?",
    ],
    Hindi: [
      "मैं सुन रहा हूँ। थोड़ा और बताइए — यह कब से चल रहा है?",
      "यह भारी लग रहा है। कोई जल्दी नहीं, अपने समय पर कहिए।",
      "समझ सकता हूँ। आज का सबसे मुश्किल हिस्सा क्या था?",
    ],
    Malayalam: [
      "ഞാൻ കേൾക്കുന്നുണ്ട്. കുറച്ചുകൂടി പറയാമോ?",
      "ഇത് വളരെ ഭാരമുള്ളതായി തോന്നുന്നു. തിരക്കില്ല, സാവധാനം പറയൂ.",
      "മനസ്സിലാകുന്നു. ഇന്നത്തെ ഏറ്റവും പ്രയാസമുള്ള ഭാഗം എന്തായിരുന്നു?",
    ],
    English: [
      "I'm listening. Tell me a little more — how long has it felt like this?",
      "That sounds like a lot to carry. There's no rush here.",
      "I hear you. What was the hardest part of today?",
    ],
  };

  const SAMPLE_THREADS = [
    { hoursAgo: 2, turns: [["Work has been relentless this month. Third weekend in a row on calls.", "That's three weekends your body never got back. What would it take for the next one to stay yours?"]] },
    { hoursAgo: 50, turns: [["Amma keeps asking when I'll move back home and I don't know how to answer.", "It sounds like you love her and also want your own life — both can be true. What would you say if you knew it wouldn't hurt her?"]] },
    { hoursAgo: 264, turns: [["Couldn't sleep again. Kept thinking about the EMI.", "2am thoughts are rarely kind. Is the worry about the money, or about what it would mean if the money ran out?"]] },
  ];

  // ---------- store (mirrors the Postgres schema) ----------
  function emptyDb() {
    return {
      user: null, // { id, phone, language, companion_name, daily_message_count, daily_count_reset_at, distress_flag_at, created_at }
      consents: [],
      threads: [],
      messages: [],
      thread_memory: {}, // thread_id → { summary, summarised_upto }
      person_memory: { facts: "", updated_at: null },
      mood_checks: [],
      distress_events: [],
    };
  }

  let db = emptyDb();

  const ui = {
    screen: "splash",
    params: {},
    pendingLanguage: null, // chosen before auth exists; written to users after
    phoneDraft: "",
    phoneError: "",
    otpDigits: ["", "", "", "", "", ""],
    otpError: "",
    termsAccepted: false,
    dataConsent: false,
    firstMood: null,
    activeThreadId: null,
    typing: false,
    streaming: null, // partial assistant text while it streams in
    careCard: false,
    limitHit: false,
    resendLeft: 30,
    deleteConfirm: "",
    exporting: false,
    fallbackIdx: 0,
  };

  function persist() {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(db));
    } catch (e) {
      /* private mode — the prototype still works, the session check just won't survive a reload */
    }
  }

  function hydrate() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null");
      if (parsed && parsed.user) db = Object.assign(emptyDb(), parsed);
    } catch (e) {
      /* ignore a corrupt blob and start fresh */
    }
  }

  function clearStore() {
    db = emptyDb();
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch (e) {}
  }

  // ---------- derived ----------
  const threadsByRecency = () =>
    db.threads.slice().sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
  const messagesIn = (threadId) => db.messages.filter((m) => m.thread_id === threadId);
  const activeThread = () => db.threads.find((t) => t.id === ui.activeThreadId) || null;
  const companion = () => (db.user && db.user.companion_name) || "Nijo";
  const language = () => (db.user && db.user.language) || ui.pendingLanguage || "Hinglish";

  function threadPreview(t) {
    if (t.title) return t.title;
    const first = messagesIn(t.id).find((m) => m.role === "user");
    return first ? truncate(first.content, 64) : "New problem";
  }

  const isDormant = (t) => Date.now() - new Date(t.last_message_at).getTime() > DORMANT_AFTER_DAYS * 86400000;

  // ---------- writes ----------
  function createThread() {
    const t = { id: uid("thr"), user_id: db.user.id, title: null, status: "active", created_at: nowIso(), last_message_at: nowIso() };
    db.threads.push(t);
    ui.activeThreadId = t.id;
    persist();
    return t;
  }

  function addMessage(threadId, role, content) {
    const m = { id: uid("msg"), thread_id: threadId, user_id: db.user.id, role, content, created_at: nowIso() };
    db.messages.push(m);
    const t = db.threads.find((x) => x.id === threadId);
    if (t) t.last_message_at = m.created_at;
    persist();
    return m;
  }

  function resetDailyCountIfNeeded() {
    if (db.user.daily_count_reset_at !== today()) {
      db.user.daily_count_reset_at = today();
      db.user.daily_message_count = 0;
      ui.limitHit = false;
    }
  }

  // ---------- Sarvam ----------
  // Byte-identical for every user — this is the cache boundary. Companion name,
  // language and personal facts go BELOW it, never inside it.
  const STATIC_SYSTEM_PROMPT =
    "You are a warm, steady companion inside a mental-wellness app used in India. " +
    "You are a caring presence, not a therapist and not a doctor. " +
    "Reply briefly — two to four short sentences, and at most one gentle question. " +
    "Never diagnose, never prescribe, never give medical advice. " +
    "Do not moralise, do not cheerlead, do not hand out generic self-care tips. " +
    "Reflect back what the person actually said before you ask anything. " +
    "If they sound like they may be in danger, stay with them and say plainly that talking to someone who can help — a helpline or a person they trust — is worth doing now.";

  function personMemoryBlock() {
    const bits = [`They call you ${companion()}.`, `Reply in ${language()}.`];
    if (db.person_memory.facts) bits.push(db.person_memory.facts);
    return bits.join(" ");
  }

  // Prompt assembly in the spec's order: static block, person memory, thread
  // summary, recent turns.
  function assemblePrompt(thread) {
    const msgs = [
      { role: "system", content: STATIC_SYSTEM_PROMPT }, // ← cache boundary
      { role: "system", content: personMemoryBlock() },
    ];
    const mem = db.thread_memory[thread.id];
    if (mem && mem.summary) msgs.push({ role: "system", content: "Earlier in this conversation: " + mem.summary });
    messagesIn(thread.id)
      .slice(-RECENT_TURNS)
      .forEach((m) => msgs.push({ role: m.role, content: m.content }));
    return msgs;
  }

  function sarvamConfig() {
    const cfg = window.SARVAM_CONFIG || {};
    return { url: cfg.SARVAM_API_URL, key: cfg.SARVAM_API_KEY, model: cfg.SARVAM_MODEL || "sarvam-105b" };
  }

  // The one live integration. Swap the provider by changing this function.
  async function getNijoReply(messages) {
    const cfg = sarvamConfig();
    if (!cfg.url || !cfg.key) throw new Error("Sarvam not configured");
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
      body: JSON.stringify({ model: cfg.model, messages }),
    });
    if (!res.ok) throw new Error("Sarvam error " + res.status);
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? data.message?.content ?? data.content ?? data.reply;
    if (typeof reply !== "string" || !reply.trim()) throw new Error("Sarvam returned an empty reply");
    return reply.trim();
  }

  // CALL 1 of the chat sequence. In production this is a short, cheap Sarvam
  // call with reasoning effort off; here it's a keyword pass so the care card is
  // demonstrable offline. It runs BEFORE generation, always.
  const DISTRESS_PATTERNS = [
    /kill myself/i, /killing myself/i, /end my life/i, /end it all/i, /take my (own )?life/i,
    /suicid/i, /self.?harm/i, /hurt myself/i, /cut myself/i, /no reason to live/i,
    /don'?t want to (live|be here|wake up)/i, /better off without me/i, /want to die/i,
    /marna chahta/i, /marna chahti/i, /jeena nahi/i, /khatam kar d/i,
    /आत्महत्या/, /मरना चाहत/, /जीना नहीं/,
  ];
  const classifyDistress = (text) => DISTRESS_PATTERNS.some((re) => re.test(text));

  // Async, never blocks a reply. In production this is a Sarvam call that folds
  // new messages into the existing summary and moves summarised_upto forward.
  function summariseThread(threadId) {
    const msgs = messagesIn(threadId);
    const firstUser = msgs.find((m) => m.role === "user");
    const lastUser = msgs.filter((m) => m.role === "user").pop();
    db.thread_memory[threadId] = {
      summary:
        `They opened with: ${truncate(firstUser && firstUser.content, 90)} ` +
        `${msgs.length} messages since. Most recently: ${truncate(lastUser && lastUser.content, 90)}`,
      summarised_upto: nowIso(),
    };
    persist();
  }

  // ---------- the chat sequence (spec §2.4) ----------
  async function sendMessage() {
    const box = $("#chat-text");
    if (!box || ui.typing) return;
    const text = box.value.trim();
    const thread = activeThread();
    if (!text || !thread) return;

    resetDailyCountIfNeeded(); // 2
    if (db.user.daily_message_count >= DAILY_MESSAGE_LIMIT) {
      ui.limitHit = true; // 3 — a 429 from the Edge Function
      render();
      return;
    }

    box.value = "";
    addMessage(thread.id, "user", text); // 4 — optimistic render
    ui.typing = true;
    render();

    if (classifyDistress(text)) {
      // 5, 6 — distress is person-level, so every other thread knows too
      db.distress_events.push({ id: uid("dst"), user_id: db.user.id, thread_id: thread.id, signal: "self_harm", created_at: nowIso() });
      db.user.distress_flag_at = nowIso();
      ui.careCard = true;
      persist();
      render();
    }

    let reply;
    try {
      reply = await getNijoReply(assemblePrompt(thread)); // 7, 8, 9
    } catch (e) {
      const set = FALLBACKS[language()] || FALLBACKS.English;
      reply = set[ui.fallbackIdx % set.length];
      ui.fallbackIdx++;
      await sleep(700);
    }

    ui.typing = false;
    await streamReply(reply); // 10

    addMessage(thread.id, "assistant", reply); // 11
    db.user.daily_message_count++; // 12
    persist();
    if (messagesIn(thread.id).length % SUMMARISE_EVERY === 0) summariseThread(thread.id); // 13 — fire and forget
    render();
  }

  // The real client streams tokens off the Edge Function response. Here the
  // reply arrives whole and is revealed word by word, so the pacing is honest.
  async function streamReply(full) {
    ui.streaming = "";
    render();
    const parts = full.split(/(\s+)/);
    for (let i = 0; i < parts.length; i++) {
      if (ui.screen !== "chat") break;
      ui.streaming += parts[i];
      const el = $("#stream-bubble");
      if (!el) break;
      el.textContent = ui.streaming;
      scrollChat();
      await sleep(26);
    }
    ui.streaming = null;
  }

  function scrollChat() {
    const s = $("#chat-scroll");
    if (s) s.scrollTop = s.scrollHeight;
  }

  // ---------- navigation ----------
  function go(screen, params) {
    ui.screen = screen;
    ui.params = params || {};
    render();
  }

  const backBtn = (js) => `<button class="back-btn" onclick="${js}">${I.back}</button>`;
  function header(backJs, title, action) {
    return `<div class="screen-header">
      ${backJs ? backBtn(backJs) : ""}
      ${title ? `<span class="header-title">${title}</span>` : ""}
      ${action || ""}
    </div>`;
  }

  // ---------- screens ----------
  const screens = {};

  // The wordmark, centred, on cream. Nothing else — no tagline, no spinner. If
  // the session check takes long enough to notice, that's a performance problem,
  // not something to paper over with animation.
  screens.splash = () => `
    <div class="screen centered">
      <p class="wordmark">NiJo<span class="plus"> Plus</span></p>
    </div>`;

  // Language before terms: DPDP requires the notice to be understandable to the
  // person giving consent.
  screens.language = () => {
    const fromSettings = ui.params.from === "settings";
    const selected = fromSettings ? language() : ui.pendingLanguage;
    return `
    <div class="screen">
      ${header(fromSettings ? "A.go('settings')" : null)}
      <h1>Which language feels like home?</h1>
      <div class="stack-12">
        ${LANGUAGES.map(
          (l) => `
          <div class="select-row ${selected === l.value ? "selected" : ""}" onclick="A.setLang('${l.value}')">
            <span>${l.label}</span>
            <span class="check">${I.check.replace("<svg", '<svg width="20" height="20"')}</span>
          </div>`
        ).join("")}
      </div>
      <div class="spacer"></div>
      <button class="btn" ${selected ? "" : "disabled"} onclick="A.langContinue()">Continue</button>
    </div>`;
  };

  screens.phone = () => `
    <div class="screen">
      ${header("A.go('language')")}
      <div class="stack-4">
        <h1>What's your number?</h1>
        <p class="sub">We'll text you a six-digit code to sign you in.</p>
      </div>
      <div class="stack-8">
        <div class="phone-input ${ui.phoneError ? "errored" : ""}" id="phone-wrap">
          <span>+91</span>
          <input id="phone" type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit number"
                 value="${esc(ui.phoneDraft)}" oninput="A.phoneInput(this)" onblur="A.phoneBlur()" />
        </div>
        ${ui.phoneError ? `<p class="field-error" id="phone-error">${esc(ui.phoneError)}</p>` : ""}
      </div>
      <div class="spacer"></div>
      <button class="btn" id="phone-continue" ${ui.phoneDraft.length === 10 ? "" : "disabled"} onclick="A.submitPhone()">Continue</button>
      <p class="caption center">Only used to sign you in. It is never shown to anyone else, and never posted anywhere.</p>
      <p class="caption center">Prototype — any ten digits work and no SMS is sent.</p>
    </div>`;

  screens.otp = () => `
    <div class="screen">
      ${header("A.go('phone')")}
      <div class="stack-4">
        <h1>Enter the code</h1>
        <p class="sub">Sent to +91 ${esc(ui.phoneDraft || "your number")} · <button class="link-inline" onclick="A.editNumber()">change</button></p>
      </div>
      <div class="stack-8">
        <div class="otp-row ${ui.otpError ? "errored" : ""}">
          ${[0, 1, 2, 3, 4, 5]
            .map(
              (i) =>
                `<input class="otp-box ${ui.otpDigits[i] ? "filled" : ""}" id="otp${i}" maxlength="1" inputmode="numeric"
                        value="${esc(ui.otpDigits[i])}" oninput="A.otpInput(${i})" onkeydown="A.otpKey(event, ${i})" />`
            )
            .join("")}
        </div>
        ${ui.otpError ? `<p class="field-error">${esc(ui.otpError)}</p>` : ""}
      </div>
      <p class="caption" id="resend"></p>
      <div class="spacer"></div>
      <button class="btn" onclick="A.verifyOtp()">Verify</button>
    </div>`;

  // Terms and data consent are separately affirmable — a single blanket tick is
  // the pattern the DPDP Act was written against. Plain summary first, both
  // boxes above the fold, then the mood question.
  screens.consent = () => `
    <div class="screen">
      <h1>Before we start</h1>
      <p class="sub">Nijo is someone to talk to, not a therapist or a doctor. What you write is stored so it can remember your conversations. It is never sold, never used for ads, and never shown to anyone else. You can take all of it with you, or delete all of it, whenever you want.</p>

      <label class="checkbox-row">
        <input type="checkbox" id="c-terms" ${ui.termsAccepted ? "checked" : ""} onchange="A.setTerms(this.checked)" />
        <span class="grow small">I accept the terms of use.
          <button class="link-inline" onclick="event.preventDefault(); A.showFullText('terms')">Read them</button>
        </span>
      </label>
      <label class="checkbox-row">
        <input type="checkbox" id="c-data" ${ui.dataConsent ? "checked" : ""} onchange="A.setDataConsent(this.checked)" />
        <span class="grow small">I agree to my conversations being stored so Nijo can remember them.
          <button class="link-inline" onclick="event.preventDefault(); A.showFullText('data')">What's stored</button>
        </span>
      </label>

      <hr class="divider" />

      <div class="stack-12">
        <h3>How are you doing right now?</h3>
        <div class="mood-pick-row">
          ${MOODS.map(
            (m, i) => `
          <button class="mood-pick ${ui.firstMood === i ? "selected" : ""}" onclick="A.pickFirstMood(${i})">
            <span class="face">${moodFace(i)}</span><span>${m}</span>
          </button>`
          ).join("")}
        </div>
      </div>

      <div class="spacer"></div>
      <button class="btn" ${ui.termsAccepted && ui.dataConsent && ui.firstMood !== null ? "" : "disabled"} onclick="A.acceptConsent()">Continue</button>
    </div>`;

  // The moment the product becomes personal. Pre-filled, so tapping straight
  // through is as intended a path as naming it yourself. Companion green.
  screens.nameCompanion = () => {
    const fromSettings = ui.params.from === "settings";
    return `
    <div class="screen">
      ${header(fromSettings ? "A.go('settings')" : null)}
      <div class="spacer"></div>
      <div class="companion-mark">${smile("currentColor")}</div>
      <div class="stack-8 center">
        <h1>${fromSettings ? "What should we call them?" : "Every companion needs a name"}</h1>
        <p class="sub">Nijo is a good one. So is anything else you'd rather say.</p>
      </div>
      <input type="text" id="companion-name" class="name-field" maxlength="24"
             value="${esc(fromSettings ? companion() : "Nijo")}" />
      <div class="spacer"></div>
      <button class="btn companion" onclick="A.saveCompanionName()">${fromSettings ? "Save" : "Start talking"}</button>
    </div>`;
  };

  // Sorted by last_message_at. No badges, no counts, no "you haven't spoken
  // about this in a while" — that's a streak wearing different clothes.
  screens.threads = () => {
    const list = threadsByRecency();
    return `
    <div class="screen">
      <div class="hrow">
        <div class="stack-4 grow">
          <h1>${esc(companion())}</h1>
          <p class="caption">One thread for each thing on your mind.</p>
        </div>
        <button class="icon-btn" onclick="A.go('settings')" aria-label="Settings">${I.gear}</button>
      </div>
      <div class="stack-12">
        ${list
          .map(
            (t) => `
          <div class="thread-row ${isDormant(t) ? "dormant" : ""}" onclick="A.openThread('${t.id}')">
            <div class="grow">
              <p class="thread-preview">${esc(threadPreview(t))}</p>
              <p class="caption">${relTime(t.last_message_at)}</p>
            </div>
            <span class="chev">›</span>
          </div>`
          )
          .join("")}
      </div>
      ${list.length ? `<button class="btn ghost" onclick="A.newThread()">${I.plus.replace("<svg", '<svg width="15" height="15"')} New problem</button>` : ""}
      <div class="spacer"></div>
    </div>`;
  };

  screens.chat = () => {
    const thread = activeThread();
    if (!thread) return screens.threads();
    const msgs = messagesIn(thread.id);
    const flagged = !!(db.user && db.user.distress_flag_at);
    return `
    <div class="screen" style="gap:8px">
      ${header(
        "A.go('threads')",
        esc(thread.title || "Untitled"),
        flagged ? `<button class="header-action" onclick="A.openCareCard()">Get help</button>` : ""
      )}
      <div class="chat-scroll" id="chat-scroll">
        ${
          msgs.length
            ? ""
            : /* an invitation, not an instruction — and no prompt chips, which
                 teach people to pick from a menu instead of saying the true thing */
              `<p class="chat-opener">${esc(OPENERS[language()] || OPENERS.English)}</p>`
        }
        ${msgs.map((m) => `<div class="bubble ${m.role === "user" ? "user" : "nijo"}">${esc(m.content)}</div>`).join("")}
        ${ui.typing ? '<div class="typing"><span></span><span></span><span></span></div>' : ""}
        ${ui.streaming !== null ? `<div class="bubble nijo" id="stream-bubble">${esc(ui.streaming)}</div>` : ""}
      </div>
      ${
        ui.limitHit
          ? `<div class="callout">${I.info}<span>That's all the messages for today. ${esc(companion())} will be here tomorrow — and the helplines are open all night if you need someone now.</span></div>`
          : ""
      }
      <div class="chat-input-row">
        <textarea id="chat-text" rows="1" placeholder="Message ${esc(companion())}…"
                  oninput="A.chatInput(this)" onkeydown="A.chatKey(event)"></textarea>
        <button class="send-btn" id="send-btn" onclick="A.sendMessage()" disabled>${I.up}</button>
      </div>
    </div>`;
  };

  screens.settings = () => `
    <div class="screen">
      ${header("A.go('threads')", "Settings")}
      <div class="stack-12" style="margin-top:6px">
        <button class="row-item" onclick="A.go('language', {from:'settings'})">
          <div class="grow">Language</div>
          <span class="value">${esc(language())}</span><span class="chev">›</span>
        </button>
        <button class="row-item" onclick="A.go('nameCompanion', {from:'settings'})">
          <div class="grow">Companion name</div>
          <span class="value">${esc(companion())}</span><span class="chev">›</span>
        </button>
        <button class="row-item" onclick="A.openCareCard()">
          <div class="grow">Someone to talk to</div>
          <span class="value">Helplines</span><span class="chev">›</span>
        </button>
        <button class="row-item" ${ui.exporting ? "disabled" : ""} onclick="A.exportData()">
          <div class="grow">
            <h3 class="row-title">Export my data</h3>
            <p class="caption">${ui.exporting ? "Preparing your file…" : "Every thread, every message, what " + esc(companion()) + " remembers, and your mood check-ins, as one JSON file."}</p>
          </div>
          <span class="chev">${ui.exporting ? "…" : "›"}</span>
        </button>
      </div>
      <div class="spacer"></div>
      <button class="row-item" onclick="A.go('deleteAccount')">
        <div class="grow danger">Delete my account</div><span class="chev">›</span>
      </button>
      <div class="stack-8 center" style="margin-top:4px">
        <button class="link quiet" onclick="A.loadSamples()">Load sample threads (prototype only)</button>
        <button class="link quiet" onclick="A.signOut()">Sign out</button>
        <p class="caption">NiJo Plus · prototype 0.2 · terms v${TERMS_VERSION}</p>
      </div>
    </div>`;

  screens.deleteAccount = () => `
    <div class="screen">
      ${header("A.go('settings')")}
      <h1>Delete your account</h1>
      <p class="sub">This removes every conversation, everything ${esc(companion())} remembers about you, your mood check-ins, and the account itself. It happens immediately and it cannot be undone.</p>
      <p class="sub small">Type <strong>delete</strong> below to confirm.</p>
      <input type="text" id="del-confirm" placeholder="delete" value="${esc(ui.deleteConfirm)}" oninput="A.setDeleteConfirm(this.value)" />
      <div class="spacer"></div>
      <button class="btn danger-btn" ${ui.deleteConfirm.trim().toLowerCase() === "delete" ? "" : "disabled"} onclick="A.deleteAccount()">Delete my account</button>
      <button class="link quiet" onclick="A.go('settings')">Cancel</button>
    </div>`;

  // The care card is an overlay, never a replacement — the conversation stays
  // visible underneath it.
  function careCard() {
    // Three India-specific resources. No warning triangles, no sirens, no
    // emergency iconography, and the word "crisis" appears nowhere — alarm is
    // the wrong register for someone who has just been honest.
    const lines = [
      ["Tele-MANAS", "Government mental-health line · free, 24×7, 20 languages", "14416", "14416"],
      ["KIRAN", "Government helpline · free, 24×7", "1800-599-0019", "18005990019"],
      ["iCall", "Counsellors at TISS · Mon–Sat, 10am–8pm", "9152987821", "9152987821"],
    ];
    return `
    <div class="overlay" onclick="A.closeCareCard(event)">
      <div class="care-card" onclick="event.stopPropagation()">
        <div class="care-grip"></div>
        <div class="stack-8">
          <h2>I'm still here</h2>
          <p class="sub small">What you just said matters, and I don't want you holding it on your own. These are people who pick up, at any hour.</p>
        </div>
        <div class="stack-10">
          ${lines
            .map(
              ([name, what, num, tel]) => `
            <div class="row-item static">
              <div class="grow"><h3 class="row-title">${name}</h3><p class="caption">${what}</p></div>
              <a href="tel:${tel}" class="call-btn" aria-label="Call ${name} on ${num}">${I.phone}</a>
            </div>`
            )
            .join("")}
        </div>
        <button class="btn ghost" onclick="A.closeCareCard()">Keep talking to ${esc(companion())}</button>
      </div>
    </div>`;
  }

  // ---------- actions ----------
  const A = {
    go,
    toast,
    sendMessage,
    setLang(l) {
      if (ui.params.from === "settings") {
        db.user.language = l;
        persist();
      } else ui.pendingLanguage = l;
      render();
    },
    langContinue() {
      if (ui.params.from === "settings") {
        toast(companion() + " will reply in " + language());
        go("settings");
      } else if (ui.pendingLanguage) go("phone");
    },
    // Typed straight into the DOM rather than through render(), so the field
    // keeps focus while the button gate updates.
    phoneInput(el) {
      const digits = el.value.replace(/\D/g, "").slice(0, 10);
      if (el.value !== digits) el.value = digits;
      ui.phoneDraft = digits;
      $("#phone-continue").disabled = digits.length !== 10;
      if (ui.phoneError && digits.length === 10) {
        ui.phoneError = "";
        $("#phone-error")?.remove();
        $("#phone-wrap").classList.remove("errored");
      }
    },
    phoneBlur() {
      if (ui.phoneDraft.length === 0 || ui.phoneDraft.length === 10) return;
      ui.phoneError = `That's ${ui.phoneDraft.length} digit${ui.phoneDraft.length === 1 ? "" : "s"} — Indian mobile numbers have 10. Add the rest.`;
      render();
      $("#phone").focus();
    },
    submitPhone() {
      if (ui.phoneDraft.length !== 10) return;
      ui.phoneError = "";
      ui.otpDigits = ["", "", "", "", "", ""];
      ui.otpError = "";
      ui.resendLeft = 30;
      go("otp");
    },
    editNumber() {
      go("phone");
      $("#phone")?.focus();
    },
    otpInput(i) {
      const box = $("#otp" + i);
      box.value = box.value.replace(/\D/g, "");
      ui.otpDigits[i] = box.value;
      box.classList.toggle("filled", !!box.value);
      if (box.value && i < 5) $("#otp" + (i + 1)).focus();
    },
    otpKey(e, i) {
      if (e.key === "Backspace" && !e.target.value && i > 0) {
        e.preventDefault();
        const prev = $("#otp" + (i - 1));
        prev.value = "";
        ui.otpDigits[i - 1] = "";
        prev.classList.remove("filled");
        prev.focus();
      }
    },
    resend() {
      ui.resendLeft = 30;
      toast("Code sent again");
      render();
    },
    // Verify creates the session. The language picked before auth is written to
    // the users row now that there's a user to write it to.
    verifyOtp() {
      // An error must never clear what they typed — re-entering five correct
      // digits because one was wrong is the most irritating thing here.
      if (ui.otpDigits.some((d) => !d)) {
        ui.otpError = "That's not all six digits yet. Fill the empty boxes and try again.";
        render();
        return;
      }
      ui.otpError = "";
      db.user = {
        id: uid("usr"),
        phone: ui.phoneDraft,
        language: ui.pendingLanguage,
        companion_name: "Nijo",
        daily_message_count: 0,
        daily_count_reset_at: today(),
        distress_flag_at: null,
        created_at: nowIso(),
      };
      persist();
      go("consent");
    },
    setTerms(v) {
      ui.termsAccepted = v;
      render();
    },
    setDataConsent(v) {
      ui.dataConsent = v;
      render();
    },
    pickFirstMood(i) {
      ui.firstMood = i;
      render();
    },
    showFullText(which) {
      toast(which === "terms" ? "The full terms open here in the real app." : "The full data notice opens here in the real app.");
    },
    // Consent writes before mood writes — mood is personal data, and recording
    // it before consent is logged inverts what consent is for.
    acceptConsent() {
      if (!ui.termsAccepted || !ui.dataConsent) return;
      db.consents.push({
        id: uid("con"),
        user_id: db.user.id,
        terms_version: TERMS_VERSION,
        terms_accepted: true,
        data_processing_consent: true,
        accepted_at: nowIso(),
      });
      if (ui.firstMood !== null) {
        db.mood_checks.push({ id: uid("mod"), user_id: db.user.id, thread_id: null, score: ui.firstMood, captured_at: nowIso() });
      }
      persist();
      go("nameCompanion");
    },
    // Writes companion_name, auto-creates the first thread untitled, and drops
    // straight into it. Nobody in distress wants to file a ticket first.
    saveCompanionName() {
      const name = ($("#companion-name").value || "").trim() || "Nijo";
      db.user.companion_name = name;
      persist();
      if (ui.params.from === "settings") {
        toast("Renamed to " + name);
        go("settings");
        return;
      }
      createThread();
      go("chat");
    },
    openThread(id) {
      ui.activeThreadId = id;
      go("chat");
    },
    newThread() {
      createThread();
      go("chat");
    },
    // Multiline input that grows with content; send stays inactive while empty.
    chatInput(el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
      $("#send-btn").disabled = !el.value.trim() || ui.typing;
    },
    chatKey(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    openCareCard() {
      ui.careCard = true;
      render();
    },
    closeCareCard(e) {
      if (e && e.target !== e.currentTarget) return;
      ui.careCard = false;
      render();
    },
    exportData() {
      if (ui.exporting) return;
      ui.exporting = true;
      render();
      setTimeout(() => {
        const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "nijo-data.json";
        a.click();
        URL.revokeObjectURL(a.href);
        ui.exporting = false;
        render();
        toast("Downloaded as nijo-data.json");
      }, 600);
    },
    setDeleteConfirm(v) {
      const wasReady = ui.deleteConfirm.trim().toLowerCase() === "delete";
      ui.deleteConfirm = v;
      if (wasReady !== (v.trim().toLowerCase() === "delete")) render();
    },
    deleteAccount() {
      if (ui.deleteConfirm.trim().toLowerCase() !== "delete") return;
      clearStore();
      Object.assign(ui, {
        activeThreadId: null, termsAccepted: false, dataConsent: false, firstMood: null,
        phoneDraft: "", phoneError: "", otpDigits: ["", "", "", "", "", ""], otpError: "",
        deleteConfirm: "", careCard: false, limitHit: false, pendingLanguage: null,
      });
      go("language");
      toast("Deleted. Nothing of yours is left.");
    },
    signOut() {
      ui.activeThreadId = null;
      ui.careCard = false;
      go("splash");
      toast("Signed out. Take care.");
      setTimeout(() => go(db.user ? "threads" : "language"), 900);
    },
    // Prototype affordance: the thread list only shows its behaviour once there
    // is more than the single thread onboarding creates.
    loadSamples() {
      if (!db.user) return;
      SAMPLE_THREADS.forEach((s) => {
        const when = new Date(Date.now() - s.hoursAgo * 3600000).toISOString();
        const t = { id: uid("thr"), user_id: db.user.id, title: null, status: "active", created_at: when, last_message_at: when };
        db.threads.push(t);
        s.turns.forEach(([u, a]) => {
          db.messages.push({ id: uid("msg"), thread_id: t.id, user_id: db.user.id, role: "user", content: u, created_at: when });
          db.messages.push({ id: uid("msg"), thread_id: t.id, user_id: db.user.id, role: "assistant", content: a, created_at: when });
        });
      });
      persist();
      toast("Sample threads added");
      go("threads");
    },
  };
  window.A = A;

  // ---------- render ----------
  let resendTimer = null;
  function render() {
    const fn = screens[ui.screen] || screens.threads;
    $("#app").innerHTML = fn();
    if (ui.screen === "chat") scrollChat();

    // Mounted only on the transition, so the sheet animates in once and then
    // sits still while the conversation behind it keeps updating.
    const overlayRoot = $("#overlay-root");
    const mounted = !!overlayRoot.firstChild;
    if (ui.careCard && !mounted) overlayRoot.innerHTML = careCard();
    else if (!ui.careCard && mounted) overlayRoot.innerHTML = "";

    clearInterval(resendTimer);
    if (ui.screen === "otp") {
      const firstEmpty = ui.otpDigits.findIndex((d) => !d);
      $("#otp" + (firstEmpty === -1 ? 5 : firstEmpty))?.focus();
      const tick = () => {
        if (ui.screen !== "otp") return clearInterval(resendTimer);
        const el = $("#resend");
        if (!el) return;
        if (ui.resendLeft > 0) {
          el.textContent = "Resend code in 0:" + String(ui.resendLeft).padStart(2, "0");
          ui.resendLeft--;
        } else {
          clearInterval(resendTimer);
          el.innerHTML = `<button class="link" style="font-size:13px" onclick="A.resend()">Resend code</button>`;
        }
      };
      tick();
      resendTimer = setInterval(tick, 1000);
    }
  }

  // ---------- boot: Splash checks the session and routes ----------
  hydrate();
  render();
  setTimeout(() => {
    if (ui.screen !== "splash") return;
    if (db.user) {
      resetDailyCountIfNeeded();
      go(db.threads.length ? "threads" : "chat");
    } else {
      go("language");
    }
  }, 900);
})();
