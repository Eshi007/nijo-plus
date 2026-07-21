/* Nijo Plus — clickable MVP prototype. All data lives in memory; the only
   live integration is Savana AI behind getNijoReply(). */

(function () {
  "use strict";

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const DAY = 86400000;
  const daysAgo = (n) => new Date(Date.now() - n * DAY);
  const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fmtDate = (d) => d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const fmtTime = (d) =>
    d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?(am|pm)/i, " $1").toLowerCase();

  function entryLabel(d) {
    const today = dateKey(new Date());
    const yesterday = dateKey(daysAgo(1));
    if (dateKey(d) === today) return `Today · ${fmtTime(d)}`;
    if (dateKey(d) === yesterday) return "Yesterday";
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long" });
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
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
    home: stroke('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>'),
    talk: stroke('<path d="M21 12a8 8 0 0 1-8 8H4l1.6-3.2A8 8 0 1 1 21 12z"/>'),
    journal: stroke('<path d="M5 4h13a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5z"/><path d="M5 4v17"/><path d="M9 9h6M9 13h4"/>'),
    you: stroke('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"/>'),
    heart: stroke('<path d="M12 20.5s-7.5-4.7-9.5-9.3C1 7.5 3.5 4.5 6.8 4.5c2.2 0 3.9 1.2 5.2 3 1.3-1.8 3-3 5.2-3 3.3 0 5.8 3 4.3 6.7-2 4.6-9.5 9.3-9.5 9.3z"/>'),
    heartFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-7.5-4.7-9.5-9.3C1 7.5 3.5 4.5 6.8 4.5c2.2 0 3.9 1.2 5.2 3 1.3-1.8 3-3 5.2-3 3.3 0 5.8 3 4.3 6.7-2 4.6-9.5 9.3-9.5 9.3z"/></svg>',
    comment: stroke('<path d="M21 11.5a7.5 7.5 0 0 1-7.5 7.5H4.5l1.4-2.8A7.5 7.5 0 1 1 21 11.5z"/>'),
    star: stroke('<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z"/>'),
    sun: stroke('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/>'),
    ring: stroke('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.8"/><path d="M5.7 5.7l3.6 3.6M14.7 14.7l3.6 3.6M18.3 5.7l-3.6 3.6M9.3 14.7l-3.6 3.6"/>'),
    phone: stroke('<path d="M21.5 16.9v3a1.8 1.8 0 0 1-2 1.8 18.8 18.8 0 0 1-8.2-2.9 18.4 18.4 0 0 1-5.7-5.7A18.8 18.8 0 0 1 2.7 4.9a1.8 1.8 0 0 1 1.8-2h3a1.8 1.8 0 0 1 1.8 1.5c.1.9.3 1.8.6 2.7a1.8 1.8 0 0 1-.4 1.9L8.2 10.3a14.7 14.7 0 0 0 5.5 5.5l1.3-1.3a1.8 1.8 0 0 1 1.9-.4c.9.3 1.8.5 2.7.6a1.8 1.8 0 0 1 1.9 2.2z"/>'),
    lock: stroke('<rect x="5" y="11" width="14" height="9.5" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>'),
    shield: stroke('<path d="M12 3l7.5 3v5.2c0 4.8-3.5 8-7.5 10-4-2-7.5-5.2-7.5-10V6z"/>'),
    trash: stroke('<path d="M4 6.5h16M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M6.5 6.5l1 13a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-13"/>'),
    memory: stroke('<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>'),
    info: stroke('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.2"/>'),
    pencil: stroke('<path d="M16.7 3.8a2.2 2.2 0 0 1 3.1 3.1L7.5 19.2 3.5 20.5l1.3-4z"/>'),
    up: stroke('<path d="M12 19V5.5M5.5 12 12 5.5 18.5 12" stroke-width="2.2"/>'),
    check: stroke('<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.4"/>'),
    x: stroke('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke-width="2.2"/>'),
    plus: stroke('<path d="M12 5v14M5 12h14" stroke-width="2.2"/>'),
    globe: stroke('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-2.5 2.6-3.8 5.7-3.8 9s1.3 6.4 3.8 9c2.5-2.6 3.8-5.7 3.8-9S14.5 5.6 12 3z"/>'),
  };
  // brand smile: arc + dot
  const smile = (color) =>
    `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7" r="2" fill="${color}"/><path d="M6 12c1.7 2.8 3.9 4.2 6 4.2s4.3-1.4 6-4.2" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/></svg>`;
  const logoSquare = (size) =>
    `<span style="display:inline-flex; width:${size}px; height:${size}px; background:var(--primary); border-radius:${Math.round(size * 0.3)}px; align-items:center; justify-content:center"><span style="width:${Math.round(size * 0.72)}px; height:${Math.round(size * 0.72)}px; display:flex">${smile("#fff")}</span></span>`;

  // ---------- mood + mock data ----------
  const MOODS = ["Rough", "Low", "Okay", "Good", "Great"];

  // smiley faces, one per mood: frown → big smile
  const MOOD_MOUTHS = [
    '<path d="M8.4 16.6c1-1.7 2.2-2.5 3.6-2.5s2.6.8 3.6 2.5"/>',
    '<path d="M8.6 16c1-.9 2.1-1.3 3.4-1.3s2.4.4 3.4 1.3"/>',
    '<path d="M8.8 15.4h6.4"/>',
    '<path d="M8.6 14.6c1 .9 2.1 1.3 3.4 1.3s2.4-.4 3.4-1.3"/>',
    '<path d="M8.2 14.2c1 1.8 2.3 2.7 3.8 2.7s2.8-.9 3.8-2.7"/>',
  ];
  const moodFace = (i) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M8.6 9.7v.01M15.4 9.7v.01" stroke-width="2.5"/>${MOOD_MOUTHS[i]}</svg>`;

  function seedCheckins() {
    // one per day for the last 7 days (last = today)
    return [1, 2, 1, 3, 2, 3, 2].map((mood, i) => ({
      date: dateKey(daysAgo(6 - i)),
      mood,
      note: "",
    }));
  }

  function at(d, h, m) { const x = new Date(d); x.setHours(h, m, 0, 0); return x; }

  function seedJournal() {
    let id = 1;
    return [
      { date: at(daysAgo(0), 21, 40), title: "A calmer evening", mood: 2, text: "Tried the breathing thing before dinner. Four slow breaths, like Nijo suggested.\n\nFelt a bit lighter after writing it down. The day didn't change, but I did, a little. Want to try the same tomorrow before the evening rush hits." },
      { date: at(daysAgo(1), 22, 5), title: "Work spilled over again", mood: 1, text: "Long day. Back-to-back calls and the review got pushed again.\n\nNaming what drained me actually helped me let some of it go." },
      { date: at(daysAgo(2), 20, 15), title: "Small wins", mood: 3, text: "Called Amma. We laughed about nothing for an hour. Keep doing this." },
      { date: at(daysAgo(4), 1, 50), title: "Couldn't sleep", mood: 1, text: "Kept thinking about the EMI and whether I should have taken the other offer. 2am thoughts are rarely kind. Tomorrow me can deal with it." },
      { date: at(daysAgo(6), 19, 30), title: "A slower evening", mood: 3, text: "Made chai and sat by the window for a while. No phone, no plans. It felt strange at first, then really nice." },
    ].map((e) => ({ id: id++, ...e }));
  }

  function seedPosts() {
    let id = 1;
    const mk = (topic, text, likes, time, replies) => ({
      id: id++, topic, text, likes, liked: false, time,
      replies: replies.map(([text, rtime]) => ({ text, time: rtime })),
    });
    return [
      mk("Work", "Started saying no to late meetings this week. Still feels uncomfortable, but my evenings are mine again — and I think I'm sleeping better.", 24, "2h", [
        ["This is so good to hear. Boundaries are hard but worth it.", "1h"],
        ["Needed to read this today. Going to try the same.", "40m"],
        ["What helped you start? I freeze every time.", "25m"],
      ]),
      mk("Anxiety", "Reminder to anyone spiralling tonight: you've survived every hard day so far. Breathe.", 61, "5h", [
        ["Thank you. Saving this for 2am.", "3h"],
        ["Breathe in, breathe out. We've got this.", "2h"],
      ]),
      mk("Work", "Got passed over for a promotion I was promised. Smiling through the day but honestly it stings a lot.", 33, "8h", [
        ["That's a real loss, it's okay for it to sting. You don't have to perform being fine.", "6h"],
      ]),
      mk("Relationships", "Parents keep asking about marriage every single call. I love them but I've started dreading the phone ringing.", 47, "1d", [
        ["You're allowed to set a gentle boundary. 'I'll share when there's news' worked for me.", "1d"],
        ["Felt this deeply. You're not alone.", "20h"],
      ]),
      mk("Wins", "Went for a morning walk before work instead of scrolling. Small thing, but the whole day felt lighter.", 29, "1d", [
        ["The smallest wins are the realest ones.", "22h"],
      ]),
      mk("Other", "Moved to a new city for my job and the evenings are the hardest. Everyone seems to already have their people.", 56, "2d", [
        ["Took me almost a year to find my people after moving. Be gentle with yourself.", "2d"],
        ["The evenings get softer. Until then, this corner of the internet counts too.", "1d"],
      ]),
    ];
  }

  const CANNED_REPLIES = [
    "I'm here with you. That sounds like a lot to carry — do you want to tell me a little more about it?",
    "Thank you for sharing that with me. Take your time, there's no rush here.",
    "That sounds really tough. Whatever you're feeling right now is okay — I'm listening.",
  ];

  // ---------- state ----------
  const state = {
    screen: "welcome",
    params: {},
    authMode: "phone",
    phone: "",
    language: "Hinglish",
    consent: false,
    plus: false,
    reminder: true,
    checkins: seedCheckins(),
    journal: seedJournal(),
    posts: seedPosts(),
    chat: [],
    typing: false,
    cannedIdx: 0,
    communityTopic: "All",
    checkinMood: null,
    checkinNote: "",
    plan: "annual",
    reportReason: null,
    resendLeft: 30,
    nextJournalId: 100,
    nextPostId: 100,
  };

  // ---------- Savana AI ----------
  function systemPrompt() {
    return (
      "You are Nijo, a warm, gentle companion inside the Nijo Plus app for users in India. " +
      "You are a caring friend, not a therapist or doctor. Reply briefly — 2 to 4 short sentences. " +
      "Reply in the user's chosen language: " + state.language + ". " +
      "Never give medical advice, diagnoses, or treatment suggestions. " +
      "If the user sounds like they may be in crisis or a danger to themselves, gently suggest opening " +
      "the 'Get help' screen in the app, where trained helplines like Tele-MANAS are available 24x7."
    );
  }

  // The one live integration. Swap the provider by changing this function.
  async function getNijoReply(messages) {
    const cfg = window.SAVANA_CONFIG || {};
    if (!cfg.SAVANA_API_URL || !cfg.SAVANA_API_KEY) {
      throw new Error("Savana AI not configured");
    }
    const res = await fetch(cfg.SAVANA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.SAVANA_API_KEY,
      },
      body: JSON.stringify({
        model: cfg.SAVANA_MODEL,
        messages: [{ role: "system", content: systemPrompt() }, ...messages],
      }),
    });
    if (!res.ok) throw new Error("Savana AI error " + res.status);
    const data = await res.json();
    const reply =
      data.choices?.[0]?.message?.content ??
      data.message?.content ??
      data.content ??
      data.reply;
    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("Savana AI returned an empty reply");
    }
    return reply.trim();
  }

  async function sendChat() {
    const box = $("#chat-text");
    const text = box.value.trim();
    if (!text || state.typing) return;
    state.chat.push({ role: "user", content: text });
    state.typing = true;
    render();
    let reply;
    try {
      reply = await getNijoReply(state.chat.slice(-12));
    } catch (e) {
      reply = CANNED_REPLIES[state.cannedIdx % CANNED_REPLIES.length];
      state.cannedIdx++;
      await new Promise((r) => setTimeout(r, 900)); // let the typing indicator breathe
    }
    state.typing = false;
    state.chat.push({ role: "assistant", content: reply });
    if (state.screen === "chat") render();
  }

  // ---------- navigation ----------
  function go(screen, params) {
    state.screen = screen;
    state.params = params || {};
    render();
  }

  // ---------- shared pieces ----------
  function bottomNav(active) {
    const items = [
      ["home", "Home", I.home],
      ["chat", "Talk", I.talk],
      ["journal", "Journal", I.journal],
      ["you", "You", I.you],
    ];
    return (
      '<div class="bottom-nav">' +
      items
        .map(
          ([scr, label, icon]) =>
            `<button class="nav-item ${active === scr ? "active" : ""}" onclick="A.go('${scr}')">${icon}<span>${label}</span></button>`
        )
        .join("") +
      "</div>"
    );
  }

  const backBtn = (js) => `<button class="back-btn" onclick="${js}">${I.back}</button>`;

  // header: plain chevron + optional centered caption title + optional right action
  function header(backJs, title, action) {
    return `<div class="screen-header">
      ${backJs ? backBtn(backJs) : ""}
      ${title ? `<span class="header-title">${title}</span>` : ""}
      ${action || ""}
    </div>`;
  }

  const checkins7 = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const key = dateKey(daysAgo(i));
      const todays = state.checkins.filter((c) => c.date === key);
      days.push({ key, d: daysAgo(i), offset: i, mood: todays.length ? todays[todays.length - 1].mood : null });
    }
    return days;
  };

  const streak = () => {
    let s = 0;
    for (let i = 0; ; i++) {
      if (state.checkins.some((c) => c.date === dateKey(daysAgo(i)))) s++;
      else break;
    }
    return s;
  };

  // ---------- screens ----------
  const screens = {};

  screens.welcome = () => `
    <div class="screen center" style="text-align:center">
      <div class="spacer"></div>
      <div>${logoSquare(72)}</div>
      <div style="height:4px"></div>
      <h1>Whatever's on your mind,<br>Nijo is here</h1>
      <p class="sub">Talk it through, reflect, and feel a little lighter — in the language you think in.</p>
      <div class="spacer"></div>
      ${
        state.authMode === "phone"
          ? `<div class="phone-input" style="text-align:left"><span>+91</span><input id="phone" type="tel" placeholder="Phone number" value="${esc(state.phone)}" /></div>`
          : `<input id="phone" type="email" placeholder="Email address" />`
      }
      <button class="btn" onclick="A.continueWelcome()">Continue</button>
      <button class="link" onclick="A.toggleAuth()">${state.authMode === "phone" ? "Continue with email" : "Continue with phone"}</button>
      <p class="caption">By continuing, you agree to our Terms and Privacy Policy.</p>
    </div>`;

  screens.verify = () => `
    <div class="screen">
      ${header("A.go('welcome')")}
      <div class="stack-4">
        <h1>Verify your number</h1>
        <p class="sub">Enter the 6-digit code sent to ${state.authMode === "phone" ? "+91 " + esc(state.phone || "your number") : "your email"}.</p>
      </div>
      <div class="otp-row">
        ${[0, 1, 2, 3, 4, 5].map((i) => `<input class="otp-box" id="otp${i}" maxlength="1" inputmode="numeric" oninput="A.otpNext(${i})" />`).join("")}
      </div>
      <p class="caption" id="resend">${state.resendLeft > 0 ? "Resend code in 0:" + String(state.resendLeft).padStart(2, "0") : ""}</p>
      <div class="spacer"></div>
      <button class="btn" onclick="A.go('language')">Verify</button>
    </div>`;

  screens.language = () => {
    const from = state.params.from;
    const langs = [
      ["हिंदी · Hindi", "Hindi", false],
      ["Hinglish", "Hinglish", true],
      ["മലയാളം · Malayalam", "Malayalam", false],
      ["English", "English", false],
    ];
    return `
    <div class="screen">
      ${header(from === "settings" ? "A.go('settings')" : "A.go('verify')")}
      <div class="stack-4">
        <h1>Which language feels like home?</h1>
        <p class="sub">You can switch anytime.</p>
      </div>
      <div class="stack-12">
        ${langs
          .map(
            ([label, val, rec]) => `
          <div class="select-row ${state.language === val ? "selected" : ""}" onclick="A.setLang('${val}')">
            <span class="hrow" style="gap:10px">${label} ${rec ? '<span class="badge">Recommended</span>' : ""}</span>
            <span class="check">${I.check.replace("<svg", '<svg width="18" height="18"')}</span>
          </div>`
          )
          .join("")}
      </div>
      <div class="spacer"></div>
      <button class="btn" onclick="A.langContinue()">Continue</button>
    </div>`;
  };

  screens.privacy = () => `
    <div class="screen">
      ${header("A.go('language')")}
      <span class="icon-plain" style="color:var(--primary)"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7.5 3v5.2c0 4.8-3.5 8-7.5 10-4-2-7.5-5.2-7.5-10V6z"/></svg></span>
      <div class="stack-4">
        <h1>Your privacy comes first</h1>
        <p class="sub">Nijo follows India's DPDP Act. In plain words:</p>
      </div>
      <div class="card stack-12" style="padding:20px">
        ${[
          [I.lock, "Private to you", "Your conversations are encrypted and never sold."],
          [I.memory, "Store only what helps memory", "We keep just enough context to remember you."],
          [I.trash, "Delete anytime", "Erase your data whenever you choose."],
        ]
          .map(
            ([icon, t, s]) => `
          <div class="hrow" style="align-items:flex-start">
            <span class="icon-plain" style="margin-top:3px">${icon}</span>
            <div class="grow"><h3 style="font-weight:600; font-size:15px">${t}</h3><p class="small sub">${s}</p></div>
          </div>`
          )
          .join("")}
      </div>
      <div class="spacer"></div>
      <label class="checkbox-row">
        <input type="checkbox" ${state.consent ? "checked" : ""} onchange="A.setConsent(this.checked)" />
        <span class="small">I agree to the Privacy Policy and how my data is used.</span>
      </label>
      <button class="btn" ${state.consent ? "" : "disabled"} onclick="A.go('disclaimer')">Agree &amp; continue</button>
    </div>`;

  screens.disclaimer = () => `
    <div class="screen">
      ${header("A.go('privacy')")}
      <span class="icon-plain" style="color:var(--primary)">${I.heart.replace("<svg", '<svg width="30" height="30"')}</span>
      <div class="stack-4">
        <h1>A companion, not a clinic</h1>
        <p class="sub">Here's what that means, in plain words:</p>
      </div>
      <div class="card stack-12" style="padding:20px">
        <p class="caption" style="font-weight:600; letter-spacing:0.04em; text-transform:uppercase">What Nijo is</p>
        ${[
          [I.check, "A companion that listens", "A space to talk, vent, and reflect — without judgement."],
          [I.heart, "Support for everyday feelings", "Stress, low days, overthinking, and the small wins too."],
        ]
          .map(
            ([icon, t, s]) => `
          <div class="hrow" style="align-items:flex-start">
            <span class="icon-plain" style="margin-top:3px; color:var(--primary)">${icon}</span>
            <div class="grow"><h3 style="font-weight:600; font-size:15px">${t}</h3><p class="small sub">${s}</p></div>
          </div>`
          )
          .join("")}
      </div>
      <div class="card stack-12" style="padding:20px">
        <p class="caption" style="font-weight:600; letter-spacing:0.04em; text-transform:uppercase">What Nijo is not</p>
        ${[
          [I.x, "Not a therapist or doctor", "Nijo can't diagnose, treat, or give medical advice."],
          [I.x, "Not an emergency service", "It can't replace professional care in a crisis."],
        ]
          .map(
            ([icon, t, s]) => `
          <div class="hrow" style="align-items:flex-start">
            <span class="icon-plain" style="margin-top:3px">${icon}</span>
            <div class="grow"><h3 style="font-weight:600; font-size:15px">${t}</h3><p class="small sub">${s}</p></div>
          </div>`
          )
          .join("")}
      </div>
      <div class="callout tappable" onclick="A.go('gethelp', {from:'disclaimer'})">
        ${I.info}
        <span>If you're in crisis or thinking about harming yourself, please contact a local helpline or someone you trust right now.</span>
      </div>
      <div class="spacer"></div>
      <button class="btn" onclick="A.go('firstCheckin')">I understand</button>
    </div>`;

  screens.firstCheckin = () => `
    <div class="screen">
      ${header("A.go('disclaimer')")}
      <div class="stack-4">
        <h1>One last thing — how are you feeling right now?</h1>
        <p class="sub">This helps Nijo meet you where you are. You can check in anytime from home.</p>
      </div>
      <div class="mood-pick-row">
        ${MOODS.map(
          (m, i) => `
        <button class="mood-pick ${state.checkinMood === i ? "selected" : ""}" onclick="A.pickFirstMood(${i})">
          <span class="face">${moodFace(i)}</span>
          <span>${m}</span>
        </button>`
        ).join("")}
      </div>
      <div class="spacer"></div>
      <button class="btn" ${state.checkinMood === null ? "disabled" : ""} onclick="A.finishFirstCheckin()">Continue</button>
      <button class="link" onclick="A.skipFirstCheckin()">Skip for now</button>
    </div>`;

  screens.home = () => {
    const todayCheckin = state.checkins.filter((c) => c.date === dateKey(new Date())).pop();
    return `
    <div class="screen">
      <div class="hrow">
        <div class="stack-4 grow">
          <h1>${greeting()}</h1>
          <p class="caption">${fmtDate(new Date())}</p>
        </div>
        ${logoSquare(42)}
      </div>
      <div class="card">
        <h3>How are you feeling right now?</h3>
        <div class="mood-dots">
          ${MOODS.map((m, i) => `<button class="mood-dot ${todayCheckin && todayCheckin.mood === i ? "active" : ""}" title="${m}" onclick="A.startCheckin(${i})">${moodFace(i)}</button>`).join("")}
        </div>
      </div>
      ${[
        ["chat", "Talk to Nijo", "I'm here whenever you want to talk.", ""],
        ["journal", "Today's journal", "Write a short reflection.", ""],
        ["paywall", state.plus ? "Nijo Plus" : "Try Nijo Plus", state.plus ? "You're a member. Thank you for being here." : "Unlock unlimited conversations.", '<span class="badge">Plus</span>'],
      ]
        .map(
          ([scr, t, s, badge]) => `
        <div class="card tappable hrow" onclick="A.go('${scr}')">
          <div class="grow stack-4">
            <h3>${t} ${badge}</h3>
            <p class="caption" style="font-size:13px">${s}</p>
          </div>
          <span class="chev" style="color:var(--text-3)">›</span>
        </div>`
        )
        .join("")}
      <div class="spacer"></div>
    </div>
    ${bottomNav("home")}`;
  };

  screens.chat = () => `
    <div class="screen" style="gap:8px">
      ${header("A.go('home')", `Nijo<br><span style="font-size:12px">here for you</span>`)}
      <div class="chat-scroll" id="chat-scroll">
        <div class="bubble nijo">Hi, I'm really glad you're here. What's on your mind today?</div>
        ${state.chat
          .map((m) => `<div class="bubble ${m.role === "user" ? "user" : "nijo"}">${esc(m.content)}</div>`)
          .join("")}
        ${state.typing ? '<div class="bubble nijo"><span class="typing"><span></span><span></span><span></span></span></div>' : ""}
      </div>
      <div class="chat-input-row">
        <textarea id="chat-text" rows="1" placeholder="Message Nijo…" onkeydown="A.chatKey(event)"></textarea>
        <button class="send-btn" onclick="A.sendChat()" ${state.typing ? "disabled" : ""}>${I.up}</button>
      </div>
    </div>`;

  screens.checkin = () => `
    <div class="screen">
      ${header("A.go('home')")}
      <div class="stack-4">
        <h1>How are you feeling?</h1>
        <p class="sub">Right now, in this moment.</p>
      </div>
      <div class="chip-row">
        ${MOODS.map(
          (m, i) => `<button class="chip ${state.checkinMood === i ? "selected" : ""}" onclick="A.pickMood(${i})">${m}</button>`
        ).join("")}
      </div>
      <p class="caption" style="margin-top:6px">Add a note (optional)</p>
      <textarea id="checkin-note" rows="4" placeholder="What's behind that feeling?">${esc(state.checkinNote)}</textarea>
      <div class="spacer"></div>
      <button class="btn" ${state.checkinMood === null ? "disabled" : ""} onclick="A.saveCheckin()">Save check-in</button>
    </div>`;

  screens.checkinDone = () => `
    <div class="screen centered">
      <div class="spacer"></div>
      <div class="confirm-circle">${I.check}</div>
      <div class="stack-4">
        <h1>Checked in</h1>
        <p class="sub">Thanks for taking a moment for yourself.</p>
        <p class="caption">You've checked in ${streak()} day${streak() === 1 ? "" : "s"} in a row.</p>
      </div>
      <div class="spacer"></div>
      <button class="btn" style="width:100%" onclick="A.go('home')">Done</button>
    </div>`;

  screens.journal = () => {
    const entries = state.journal.slice().sort((a, b) => b.date - a.date);
    return `
    <div class="screen">
      <div class="hrow">
        <div class="stack-4 grow">
          <h1>Journal</h1>
          <p class="caption">${entries.length} entr${entries.length === 1 ? "y" : "ies"} · ${streak()}-day streak</p>
        </div>
        <button class="btn compact" onclick="A.go('journalEdit')">${I.plus.replace("<svg", '<svg width="15" height="15"')} New</button>
      </div>
      <div class="stack-12">
        ${entries
          .map(
            (e) => `
          <div class="card tappable" onclick="A.go('journalRead', {id:${e.id}})" style="position:relative">
            <span style="position:absolute; top:20px; right:20px; width:7px; height:7px; border-radius:50%; background:var(--primary)"></span>
            <p class="caption">${entryLabel(e.date)}</p>
            <h3 style="margin:2px 0">${esc(e.title)}</h3>
            <p class="sub small" style="display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden">${esc(e.text)}</p>
          </div>`
          )
          .join("")}
      </div>
      <div class="spacer"></div>
    </div>
    ${bottomNav("journal")}`;
  };

  screens.journalEdit = () => {
    const e = state.params.id ? state.journal.find((x) => x.id === state.params.id) : null;
    return `
    <div class="screen">
      ${header(
        e ? `A.go('journalRead', {id:${e.id}})` : "A.go('journal')",
        entryLabel(e ? e.date : new Date()),
        `<button class="header-action" onclick="A.saveJournal(${e ? e.id : "null"})">Save</button>`
      )}
      <span class="badge" style="align-self:flex-start; font-size:12px">Prompt · What gave you energy today?</span>
      <input type="text" id="j-title" placeholder="Title (optional)" value="${esc(e ? e.title : "")}" />
      <textarea id="j-text" rows="10" placeholder="Write freely… no one sees this but you." style="flex:1">${esc(e ? e.text : "")}</textarea>
    </div>`;
  };

  screens.journalRead = () => {
    const e = state.journal.find((x) => x.id === state.params.id);
    if (!e) return screens.journal();
    return `
    <div class="screen">
      ${header("A.go('journal')", entryLabel(e.date), `<button class="header-action" onclick="A.go('journalEdit', {id:${e.id}})">Edit</button>`)}
      <div class="hrow">
        <h1>${esc(e.title)}</h1>
        ${e.mood != null ? `<span class="chip mini selected">${MOODS[e.mood]}</span>` : ""}
      </div>
      ${e.text.split(/\n\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}
    </div>`;
  };

  screens.paywall = () => `
    <div class="screen">
      ${header(null, null, `<button class="header-action plain" onclick="A.go('home')" style="font-size:22px">✕</button>`)}
      <div class="lockup">${smile("var(--primary)")}<span class="word">Nijo</span></div>
      <div class="stack-4 center">
        <h1 style="font-size:21px">Nijo Plus</h1>
        <p class="sub">More space to be heard.</p>
      </div>
      <div class="stack-12" style="margin-top:6px">
        ${[
          "Unlimited conversations",
          "Deeper memory that remembers you",
          "Mood trends & journal insights",
          "Your data, always private",
        ]
          .map((b) => `<div class="benefit-row"><span class="icon-chip small">${I.check}</span><span>${b}</span></div>`)
          .join("")}
      </div>
      <div class="plan-card ${state.plan === "annual" ? "selected" : ""}" onclick="A.setPlan('annual')" style="margin-top:6px">
        <div class="grow">
          <div class="hrow" style="gap:8px"><h3>Annual</h3><span class="badge">Best value</span></div>
          <p class="caption">₹1,499/yr · ₹125/mo</p>
        </div>
        <strong style="font-size:14px">Save 40%</strong>
        <span class="check">${I.check.replace("<svg", '<svg width="18" height="18"')}</span>
      </div>
      <div class="plan-card ${state.plan === "monthly" ? "selected" : ""}" onclick="A.setPlan('monthly')">
        <div class="grow">
          <h3>Monthly</h3>
          <p class="caption">Billed every month</p>
        </div>
        <strong style="font-size:15px">₹199/mo</strong>
        <span class="check">${I.check.replace("<svg", '<svg width="18" height="18"')}</span>
      </div>
      <div class="spacer"></div>
      <button class="btn" onclick="A.startTrial()">Start 7-day free trial</button>
      <p class="caption center">Cancel anytime · Terms apply</p>
    </div>`;

  screens.plusWelcome = () => `
    <div class="screen centered">
      <div class="spacer"></div>
      <div class="lockup">${smile("var(--primary)")}<span class="word">Nijo</span></div>
      <div class="stack-4">
        <h1>Welcome to Nijo Plus</h1>
        <p class="sub">More room to be heard. Your 7-day trial starts today.</p>
      </div>
      <div class="stack-10" style="align-items:flex-start">
        ${["Unlimited conversations", "Deeper memory", "Mood & journal insights"]
          .map((b) => `<div class="benefit-row"><span class="icon-chip small">${I.check}</span><span>${b}</span></div>`)
          .join("")}
      </div>
      <div class="spacer"></div>
      <button class="btn" style="width:100%" onclick="A.go('home')">Start</button>
    </div>`;

  screens.community = () => {
    const topics = ["All", "Work", "Anxiety", "Wins"];
    const visible = state.posts.filter((p) => state.communityTopic === "All" || p.topic === state.communityTopic);
    return `
    <div class="screen">
      <div class="stack-4">
        <h1>Community</h1>
        <p class="caption">Anonymous · a space to feel less alone</p>
      </div>
      <div class="chip-row">
        ${topics
          .map((t) => `<button class="chip ${state.communityTopic === t ? "selected" : ""}" onclick="A.setTopic('${t}')">${t}</button>`)
          .join("")}
      </div>
      <div class="stack-12">
        ${visible
          .map(
            (p) => `
          <div class="card tappable" onclick="A.go('postDetail', {id:${p.id}})">
            <div class="post-head">
              <span class="icon-chip small">${smile("var(--primary)")}</span>
              <span class="caption">Anonymous · ${esc(p.time)}</span>
              <span class="badge">${esc(p.topic)}</span>
            </div>
            <p style="margin-top:10px">${esc(p.text)}</p>
            <div class="post-actions">
              <button class="post-action ${p.liked ? "liked" : ""}" onclick="event.stopPropagation(); A.likePost(${p.id})">${p.liked ? I.heartFill : I.heart} ${p.likes}</button>
              <span class="post-action" style="cursor:default">${I.comment} ${p.replies.length}</span>
            </div>
          </div>`
          )
          .join("")}
      </div>
      <div style="height:64px"></div>
    </div>
    <button class="fab" onclick="A.go('newPost')">${I.pencil}</button>
    ${bottomNav(null)}`;
  };

  screens.newPost = () => {
    const topics = ["Work", "Anxiety", "Relationships", "Wins", "Other"];
    return `
    <div class="screen">
      ${header("A.go('community')", "New post", `<button class="header-action" onclick="A.submitPost()">Post</button>`)}
      <div class="callout">
        ${I.lock}
        <span>You're posting anonymously. Nothing here is linked to your name or profile.</span>
      </div>
      <p class="sub small">Choose a topic</p>
      <div class="chip-row">
        ${topics
          .map((t) => `<button class="chip ${state.params.topic === t ? "selected" : ""}" onclick="A.setPostTopic('${t}')">${t}</button>`)
          .join("")}
      </div>
      <textarea id="post-text" rows="6" placeholder="Share what's on your mind…">${esc(state.params.draft || "")}</textarea>
      <p class="caption">Be kind. If you're in crisis, please reach out to a helpline or someone you trust.</p>
      <div class="spacer"></div>
      <button class="btn" onclick="A.submitPost()">Post anonymously</button>
    </div>`;
  };

  screens.postShared = () => `
    <div class="screen centered">
      <div class="spacer"></div>
      <div class="confirm-circle">${I.check}</div>
      <div class="stack-4">
        <h1>Shared anonymously</h1>
        <p class="sub">Your words are out there now — gently held by the community.</p>
      </div>
      <div class="spacer"></div>
      <button class="btn" style="width:100%" onclick="A.go('community')">Back to community</button>
    </div>`;

  screens.postDetail = () => {
    const p = state.posts.find((x) => x.id === state.params.id);
    if (!p) return screens.community();
    return `
    <div class="screen">
      ${header("A.go('community')", "Post", `<button class="header-action plain" onclick="A.go('report', {id:${p.id}})">•••</button>`)}
      <div class="card">
        <div class="post-head">
          <span class="icon-chip small">${smile("var(--primary)")}</span>
          <span class="caption">Anonymous · ${esc(p.time)}</span>
          <span class="badge">${esc(p.topic)}</span>
        </div>
        <p style="margin-top:10px">${esc(p.text)}</p>
        <div class="post-actions">
          <button class="post-action ${p.liked ? "liked" : ""}" onclick="A.likePost(${p.id})">${p.liked ? I.heartFill : I.heart} ${p.likes}</button>
          <span class="post-action" style="cursor:default">${I.comment} ${p.replies.length}</span>
        </div>
      </div>
      <p class="sub small">Replies</p>
      <div class="stack-10">
        ${p.replies
          .map(
            (r) => `<div class="card" style="border-radius:var(--radius-row); padding:14px 16px">
              <p class="caption">Anonymous · ${esc(r.time)}</p>
              <p class="small" style="margin-top:2px">${esc(r.text)}</p>
            </div>`
          )
          .join("") || '<p class="sub small">No replies yet. Be the first kind voice.</p>'}
      </div>
      <div class="spacer"></div>
      <div class="chat-input-row">
        <input type="text" id="reply-text" placeholder="Reply gently…" onkeydown="if(event.key==='Enter')A.sendReply(${p.id})" />
        <button class="send-btn" onclick="A.sendReply(${p.id})">${I.up}</button>
      </div>
    </div>`;
  };

  screens.report = () => {
    const reasons = ["Harmful or unsafe", "Harassment or bullying", "Spam", "Someone may be in danger", "Something else"];
    return `
    <div class="screen">
      ${header(`A.go('postDetail', {id:${state.params.id}})`)}
      <div class="stack-4">
        <h1>Report this post</h1>
        <p class="sub">Help us keep this a safe, kind space. Reports are anonymous.</p>
      </div>
      <div class="stack-12">
        ${reasons
          .map(
            (r, i) => `
          <div class="select-row ${state.reportReason === i ? "selected" : ""}" onclick="A.pickReason(${i})">
            <span>${r}</span>
            <span class="check">${I.check.replace("<svg", '<svg width="18" height="18"')}</span>
          </div>`
          )
          .join("")}
      </div>
      <div class="callout">
        ${I.heart}
        <span>If someone may be at risk, we'll surface support resources right away.</span>
      </div>
      <div class="spacer"></div>
      <button class="btn" ${state.reportReason === null ? "disabled" : ""} onclick="A.submitReport()">Submit report</button>
    </div>`;
  };

  screens.gethelp = () => {
    const back = state.params.from || "you";
    const lines = [
      ["KIRAN (Govt. of India)", "1800-599-0019 · 24/7", "18005990019"],
      ["Tele-MANAS", "14416", "14416"],
      ["iCall", "9152987821", "9152987821"],
    ];
    return `
    <div class="screen">
      ${header(`A.go('${back}')`)}
      <span class="icon-plain" style="color:var(--primary)">${I.ring.replace("<svg", '<svg width="30" height="30"')}</span>
      <div class="stack-4">
        <h1>You're not alone</h1>
        <p class="sub">If you're in crisis or thinking about harming yourself, please reach out now. Talking to someone can help.</p>
      </div>
      <div class="stack-12">
        ${lines
          .map(
            ([name, sub, num]) => `
          <div class="row-item static">
            <div class="grow"><h3 style="font-size:15px">${name}</h3><p class="caption" style="font-size:13px">${sub}</p></div>
            <a href="tel:${num}" style="text-decoration:none"><span class="icon-chip" style="background:var(--primary); color:#fff">${I.phone}</span></a>
          </div>`
          )
          .join("")}
      </div>
      <p class="caption">If you're in immediate danger, call your local emergency number.</p>
      <div class="spacer"></div>
      <button class="btn" onclick="A.go('${back}')">Back to safety</button>
    </div>`;
  };

  screens.you = () => `
    <div class="screen">
      <div class="hrow">
        ${logoSquare(48)}
        <div class="stack-4 grow">
          <h1>Your space</h1>
          <p class="caption">Private to you · ${esc(state.language)}</p>
        </div>
      </div>
      <div class="card stat-card">
        <div class="stat-cell"><div class="num">${streak()}</div><div class="caption">day streak</div></div>
        <div class="stat-cell"><div class="num">${state.checkins.length}</div><div class="caption">check-ins</div></div>
        <div class="stat-cell"><div class="num">${state.journal.length}</div><div class="caption">entries</div></div>
      </div>
      <div class="stack-12">
        ${[
          ["insights", I.heart, "Mood insights", "Your trends over time"],
          ["journal", I.journal, "Journal", `${state.journal.length} entries`],
          ["community", I.talk, "Community", "Anonymous · shared gently"],
          ["paywall", I.star, "Nijo Plus", state.plus ? "Active membership" : "Manage membership"],
          ["settings", I.sun, "Settings", "Account, language, privacy"],
          ["gethelp", I.ring, "Help & resources", "Get support"],
        ]
          .map(
            ([scr, icon, t, s]) => `
          <button class="row-item" onclick="A.go('${scr}'${scr === "gethelp" ? ", {from:'you'}" : ""})">
            <span class="icon-chip">${icon}</span>
            <div class="grow"><h3 style="font-size:15px">${t}</h3><p class="caption" style="font-size:13px">${s}</p></div>
            <span class="chev">›</span>
          </button>`
          )
          .join("")}
      </div>
      <div class="spacer"></div>
    </div>
    ${bottomNav("you")}`;

  screens.settings = () => `
    <div class="screen">
      ${header("A.go('you')")}
      <h1>Settings</h1>
      <div class="stack-12">
        <div class="row-item static">
          <div class="grow">Phone number</div>
          <span class="value">+91 ${esc(state.phone || "not set")}</span><span class="chev">›</span>
        </div>
        <button class="row-item" onclick="A.go('language', {from:'settings'})">
          <div class="grow">Language</div>
          <span class="value">${esc(state.language)}</span><span class="chev">›</span>
        </button>
        <div class="row-item static">
          <div class="grow">Daily check-in reminder</div>
          <label class="toggle"><input type="checkbox" ${state.reminder ? "checked" : ""} onchange="A.setReminder(this.checked)" /><span class="track"></span></label>
        </div>
        <button class="row-item" onclick="A.exportData()"><div class="grow">Export my data</div><span class="chev">›</span></button>
        <button class="row-item" onclick="A.deleteData()"><div class="grow danger">Delete my data</div><span class="chev">›</span></button>
        <button class="row-item" onclick="A.go('about')"><div class="grow">About Nijo</div><span class="chev">›</span></button>
      </div>
      <div class="spacer"></div>
      <button class="link danger" onclick="A.signOut()">Sign out</button>
    </div>`;

  screens.about = () => `
    <div class="screen centered">
      ${header("A.go('settings')")}
      <div class="spacer"></div>
      <div>${logoSquare(72)}</div>
      <div class="stack-4">
        <h1>Nijo</h1>
        <p class="sub">Here for whatever's on your mind.</p>
        <p class="caption">Version 0.1 (prototype) · Made with care in India</p>
      </div>
      <div class="spacer"></div>
    </div>`;

  screens.insights = () => {
    const days = checkins7();
    const withMood = days.filter((d) => d.mood !== null);
    const avg = withMood.length ? MOODS[Math.round(withMood.reduce((s, d) => s + d.mood, 0) / withMood.length)] : null;
    const dayName = (day) =>
      day.offset === 0 ? "Today" : day.offset === 1 ? "Yesterday" : day.d.toLocaleDateString("en-IN", { weekday: "long" });
    return `
    <div class="screen">
      ${header("A.go('you')")}
      <div class="stack-4">
        <h1>Your mood</h1>
        <p class="sub">A gentle look at how your week has felt.</p>
      </div>
      <div class="card">
        <div class="hrow">
          <h3 class="grow">Last 7 days</h3>
          ${avg ? `<span class="caption">${avg} average</span>` : ""}
        </div>
        <div class="bar-chart">
          ${days
            .map(
              (day) => `
            <div class="bar-col">
              <div class="bar ${day.offset === 0 && day.mood !== null ? "today" : ""}" style="height:${day.mood === null ? 10 : ((day.mood + 1) / 5) * 100}%"></div>
              <span class="caption">${day.d.toLocaleDateString("en-IN", { weekday: "narrow" })}</span>
            </div>`
            )
            .join("")}
        </div>
      </div>
      <p class="sub small">Recent check-ins</p>
      <div class="stack-10">
        ${withMood
          .slice()
          .reverse()
          .map(
            (day) => `
          <div class="row-item static">
            <div class="grow">${dayName(day)}</div>
            <span class="mood-pill">${MOODS[day.mood]}</span>
          </div>`
          )
          .join("")}
      </div>
    </div>`;
  };

  // ---------- actions ----------
  const A = {
    go,
    toast,
    sendChat,
    toggleAuth() {
      state.authMode = state.authMode === "phone" ? "email" : "phone";
      render();
    },
    continueWelcome() {
      const v = $("#phone");
      if (state.authMode === "phone") state.phone = v.value.trim();
      state.resendLeft = 30;
      go("verify");
    },
    resend() {
      state.resendLeft = 30;
      toast("Code sent again");
      render();
    },
    otpNext(i) {
      const box = $("#otp" + i);
      box.classList.toggle("filled", !!box.value);
      if (box.value && i < 5) $("#otp" + (i + 1)).focus();
    },
    setLang(l) {
      state.language = l;
      render();
    },
    langContinue() {
      if (state.params.from === "settings") {
        toast("Language set to " + state.language);
        go("settings");
      } else go("privacy");
    },
    setConsent(v) {
      state.consent = v;
      render();
    },
    pickFirstMood(i) {
      state.checkinMood = i;
      render();
    },
    finishFirstCheckin() {
      state.checkins.push({ date: dateKey(new Date()), mood: state.checkinMood, note: "" });
      state.checkinMood = null;
      go("home");
    },
    skipFirstCheckin() {
      state.checkinMood = null;
      go("home");
    },
    startCheckin(mood) {
      state.checkinMood = mood ?? null;
      state.checkinNote = "";
      go("checkin");
    },
    pickMood(i) {
      state.checkinNote = $("#checkin-note")?.value || "";
      state.checkinMood = i;
      render();
    },
    saveCheckin() {
      state.checkins.push({
        date: dateKey(new Date()),
        mood: state.checkinMood,
        note: $("#checkin-note").value.trim(),
      });
      go("checkinDone");
    },
    chatKey(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    },
    saveJournal(id) {
      const title = $("#j-title").value.trim();
      const text = $("#j-text").value.trim();
      if (!title && !text) {
        toast("Write a little something first");
        return;
      }
      if (id) {
        const e = state.journal.find((x) => x.id === id);
        e.title = title || "Untitled";
        e.text = text;
        toast("Entry updated");
        go("journalRead", { id });
      } else {
        const todayCheckin = state.checkins.filter((c) => c.date === dateKey(new Date())).pop();
        state.journal.push({
          id: state.nextJournalId++,
          date: new Date(),
          title: title || "Untitled",
          text,
          mood: todayCheckin ? todayCheckin.mood : null,
        });
        toast("Saved to your journal");
        go("journal");
      }
    },
    setPlan(p) {
      state.plan = p;
      render();
    },
    startTrial() {
      state.plus = true;
      go("plusWelcome");
    },
    setTopic(t) {
      state.communityTopic = t;
      render();
    },
    likePost(id) {
      const p = state.posts.find((x) => x.id === id);
      p.liked = !p.liked;
      p.likes += p.liked ? 1 : -1;
      render();
    },
    setPostTopic(t) {
      state.params.draft = $("#post-text")?.value || "";
      state.params.topic = t;
      render();
    },
    submitPost() {
      const text = $("#post-text").value.trim();
      if (!text) {
        toast("Write a little something first");
        return;
      }
      state.posts.unshift({
        id: state.nextPostId++,
        topic: state.params.topic || "Other",
        text,
        likes: 0,
        liked: false,
        time: "just now",
        replies: [],
      });
      state.communityTopic = "All";
      go("postShared");
    },
    sendReply(id) {
      const box = $("#reply-text");
      const text = box.value.trim();
      if (!text) return;
      state.posts.find((x) => x.id === id).replies.push({ text, time: "just now" });
      render();
    },
    pickReason(i) {
      state.reportReason = i;
      render();
    },
    submitReport() {
      const danger = state.reportReason === 3; // "Someone may be in danger"
      state.reportReason = null;
      if (danger) {
        toast("Report received. Support resources below.");
        go("gethelp", { from: "community" });
      } else {
        toast("Report received. Thank you for looking out.");
        go("community");
      }
    },
    setReminder(v) {
      state.reminder = v;
      toast(v ? "Daily reminder on" : "Daily reminder off");
    },
    exportData() {
      const data = {
        language: state.language,
        checkins: state.checkins,
        journal: state.journal.map((e) => ({ date: e.date, title: e.title, text: e.text })),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "nijo-data.json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Your data has been downloaded");
    },
    deleteData() {
      if (!confirm("Delete all your check-ins, journal entries and chats? This can't be undone.")) return;
      state.checkins = [];
      state.journal = [];
      state.chat = [];
      toast("Your data has been deleted");
      render();
    },
    signOut() {
      state.phone = "";
      state.consent = false;
      state.chat = [];
      state.authMode = "phone";
      go("welcome");
      toast("Signed out. Take care");
    },
  };
  window.A = A;

  // ---------- render ----------
  let resendTimer = null;
  function render() {
    const fn = screens[state.screen] || screens.home;
    $("#app").innerHTML = fn();
    if (state.screen === "chat") {
      const scroll = $("#chat-scroll");
      if (scroll) scroll.scrollTop = scroll.scrollHeight;
    }
    clearInterval(resendTimer);
    if (state.screen === "verify") {
      $("#otp0")?.focus();
      resendTimer = setInterval(() => {
        if (state.screen !== "verify") return clearInterval(resendTimer);
        state.resendLeft--;
        const el = $("#resend");
        if (!el) return;
        if (state.resendLeft > 0) {
          el.textContent = "Resend code in 0:" + String(state.resendLeft).padStart(2, "0");
        } else {
          clearInterval(resendTimer);
          el.innerHTML = `<button class="link" style="font-size:13px" onclick="A.resend()">Resend code</button>`;
        }
      }, 1000);
    }
  }

  render();
})();
