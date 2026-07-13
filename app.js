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
  const fmtDate = (d) =>
    d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const fmtShort = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

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

  // ---------- mood + mock data ----------
  const MOODS = [
    { label: "Rough", emoji: "😞" },
    { label: "Low", emoji: "😕" },
    { label: "Okay", emoji: "😐" },
    { label: "Good", emoji: "🙂" },
    { label: "Great", emoji: "😄" },
  ];

  function seedCheckins() {
    // one per day for the last 7 days (index 6 = today)
    return [1, 2, 1, 3, 2, 3, 2].map((mood, i) => ({
      date: dateKey(daysAgo(6 - i)),
      mood,
      note: "",
    }));
  }

  function seedJournal() {
    let id = 1;
    return [
      { d: 1, title: "A slower evening", text: "Made chai and sat by the window for a while. No phone, no plans. It felt strange at first, then really nice. I want more evenings like this." },
      { d: 2, title: "Office was a lot today", text: "Back-to-back calls and the review got pushed again. I noticed I was holding my breath during the standup. Writing it down here so it stops circling in my head." },
      { d: 4, title: "Called Amma", text: "We talked for almost an hour. She told the same stories she always tells, and honestly I didn't mind at all. Felt lighter after." },
      { d: 5, title: "Couldn't sleep", text: "Kept thinking about the EMI and whether I should have taken the other offer. 2am thoughts are rarely kind. Tomorrow me can deal with it." },
      { d: 7, title: "Small win", text: "Went for a walk before work instead of scrolling. Just 20 minutes. The day felt a little easier to carry." },
    ].map((e) => ({ id: id++, date: daysAgo(e.d), title: e.title, text: e.text }));
  }

  function seedPosts() {
    let id = 1;
    const mk = (topic, text, likes, time, replies) => ({
      id: id++, topic, text, likes, liked: false, time,
      replies: replies.map((r) => ({ text: r, time: "earlier" })),
    });
    return [
      mk("Work", "Does anyone else feel guilty logging off at 6 even when the work is done? Like I have to be seen online to be taken seriously.", 24, "2h ago", [
        "Every single day. I started blocking my calendar after 6 and it helped a little.",
        "The guilt fades once you do it for a few weeks. Your rest is part of the job.",
      ]),
      mk("Anxiety", "My heart races before every team meeting, even ones where I don't have to speak. Just knowing it's coming ruins my morning.", 41, "5h ago", [
        "I do a slow 4-7-8 breath in the minutes before. Doesn't fix it but takes the edge off.",
        "Same here. It helped me to write one line I could say if called on, so I stop rehearsing everything.",
      ]),
      mk("Work", "Got passed over for a promotion I was promised. Smiling through the day but honestly it stings a lot.", 33, "8h ago", [
        "That's a real loss, it's okay for it to sting. You don't have to perform being fine.",
      ]),
      mk("Anxiety", "Moved to a new city for my job and the evenings are the hardest. Everyone seems to already have their people.", 56, "1d ago", [
        "Took me almost a year to find my people after moving. Be gentle with yourself.",
        "The evenings get softer. Until then, this corner of the internet counts too.",
      ]),
      mk("Sleep", "I'm exhausted all day but the moment I lie down my brain starts a full review of my life choices.", 48, "1d ago", [
        "Keeping a notepad by the bed helped me — I 'park' the thought and deal with it tomorrow.",
      ]),
      mk("Family", "Parents keep asking about marriage every single call. I love them but I've started dreading the phone ringing.", 62, "2d ago", [
        "You're allowed to set a gentle boundary. 'I'll share when there's news' worked for me.",
        "Felt this deeply. You're not alone.",
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
    authMode: "phone", // or "email"
    phone: "",
    language: "Hinglish",
    consent: false,
    plus: false,
    reminder: true,
    checkins: seedCheckins(),
    journal: seedJournal(),
    posts: seedPosts(),
    chat: [], // {role: "user"|"assistant", content}
    typing: false,
    cannedIdx: 0,
    communityTopic: "All",
    checkinMood: null,
    checkinNote: "",
    plan: "annual",
    reportReason: null,
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
  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    talk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H4l1.6-3.2A8 8 0 1 1 21 12z"/></svg>',
    journal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h13a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5z"/><path d="M5 4v17"/><path d="M9 9h6M9 13h4"/></svg>',
    you: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"/></svg>',
  };

  function bottomNav(active) {
    const items = [
      ["home", "Home", "home"],
      ["chat", "Talk", "talk"],
      ["journal", "Journal", "journal"],
      ["you", "You", "you"],
    ];
    return (
      '<div class="bottom-nav">' +
      items
        .map(
          ([scr, label, icon]) =>
            `<button class="nav-item ${active === scr ? "active" : ""}" onclick="A.go('${scr}')">${ICONS[icon]}<span>${label}</span></button>`
        )
        .join("") +
      "</div>"
    );
  }

  function header(title, backTo, extra) {
    return `<div class="screen-header">
      ${backTo ? `<button class="back-btn" onclick="A.go('${backTo}')">←</button>` : ""}
      <h2>${esc(title)}</h2>${extra || ""}
    </div>`;
  }

  // ---------- screens ----------
  const screens = {};

  screens.welcome = () => `
    <div class="screen centered">
      <div class="logo">🙂</div>
      <div class="stack-4">
        <h1>Nijo</h1>
        <p class="sub">A quiet place to be heard</p>
      </div>
      <div style="height:12px"></div>
      ${
        state.authMode === "phone"
          ? `<div class="phone-input"><span>+91</span><input id="phone" type="tel" placeholder="Your phone number" value="${esc(state.phone)}" /></div>`
          : `<input id="phone" type="email" placeholder="Your email address" />`
      }
      <button class="btn" onclick="A.continueWelcome()">Continue</button>
      <button class="link" onclick="A.toggleAuth()">${state.authMode === "phone" ? "Continue with email" : "Continue with phone"}</button>
    </div>`;

  screens.verify = () => `
    <div class="screen">
      ${header("", "welcome")}
      <div class="stack-4">
        <h1>Verify your number</h1>
        <p class="sub">We sent a 6-digit code to ${state.authMode === "phone" ? "+91 " + esc(state.phone || "your number") : "your email"}.</p>
      </div>
      <div class="otp-row">
        ${[0, 1, 2, 3, 4, 5].map((i) => `<input class="otp-box" id="otp${i}" maxlength="1" inputmode="numeric" oninput="A.otpNext(${i})" />`).join("")}
      </div>
      <button class="btn" onclick="A.go('language')">Verify</button>
      <button class="link" onclick="A.toast('Code sent again')">Resend code</button>
    </div>`;

  screens.language = () => {
    const from = state.params.from;
    const langs = [
      ["हिंदी · Hindi", "Hindi", ""],
      ["Hinglish", "Hinglish", '<span class="badge">Recommended</span>'],
      ["മലയാളം · Malayalam", "Malayalam", ""],
      ["English", "English", ""],
    ];
    return `
    <div class="screen">
      ${header("", from === "settings" ? "settings" : "verify")}
      <div class="stack-4">
        <h1>Which language feels like home?</h1>
        <p class="sub">You can switch anytime.</p>
      </div>
      <div class="stack-12">
        ${langs
          .map(
            ([label, val, badge]) => `
          <div class="select-row ${state.language === val ? "selected" : ""}" onclick="A.setLang('${val}')">
            <span>${label} ${badge}</span>
            <span class="dot-check">${state.language === val ? "✓" : ""}</span>
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
      ${header("", "language")}
      <div class="stack-4">
        <h1>Your privacy comes first</h1>
        <p class="sub">Nijo is built to comply with India's DPDP Act 2023. What you share stays yours.</p>
      </div>
      <div class="stack-12">
        <div class="row-item" style="cursor:default"><div class="icon">🔒</div><div class="grow"><strong>Private by default</strong><div class="small sub">Your conversations and journal are never shared.</div></div></div>
        <div class="row-item" style="cursor:default"><div class="icon">🕊️</div><div class="grow"><strong>You stay in control</strong><div class="small sub">Export or delete your data anytime from Settings.</div></div></div>
        <div class="row-item" style="cursor:default"><div class="icon">🇮🇳</div><div class="grow"><strong>Stored responsibly</strong><div class="small sub">Handled under India's data protection law.</div></div></div>
      </div>
      <div class="spacer"></div>
      <label class="checkbox-row">
        <input type="checkbox" ${state.consent ? "checked" : ""} onchange="A.setConsent(this.checked)" />
        <span class="small sub">I agree to Nijo's terms and understand how my data is used.</span>
      </label>
      <button class="btn" ${state.consent ? "" : "disabled"} onclick="A.go('disclaimer')">Agree &amp; continue</button>
    </div>`;

  screens.disclaimer = () => `
    <div class="screen">
      ${header("", "privacy")}
      <div class="stack-4">
        <h1>A companion, not a clinic</h1>
        <p class="sub">Nijo is here to listen and keep you company. It isn't a therapist, and it can't give medical advice or diagnosis.</p>
      </div>
      <div class="card" style="background:var(--tint); border-color:var(--primary)">
        <strong>If you're going through a crisis</strong>
        <p class="small sub" style="margin-top:4px">Please reach out to a trained person right away. Free, confidential helplines are available 24x7.</p>
        <button class="link" style="margin-top:8px; padding:0" onclick="A.go('gethelp', {from:'disclaimer'})">See helplines →</button>
      </div>
      <div class="spacer"></div>
      <button class="btn" onclick="A.go('home')">I understand</button>
    </div>`;

  screens.home = () => {
    const today = new Date();
    return `
    <div class="screen with-nav">
      <div class="stack-4">
        <h1>${greeting()}</h1>
        <p class="caption">${fmtDate(today)}</p>
      </div>
      <div class="card">
        <h2>How are you feeling right now?</h2>
        <div class="mood-dots">
          ${MOODS.map((m, i) => `<button class="mood-dot" title="${m.label}" onclick="A.startCheckin(${i})">${m.emoji}</button>`).join("")}
        </div>
      </div>
      <div class="card tappable" onclick="A.go('chat')">
        <h2>Talk to Nijo</h2>
        <p class="sub small">I'm here whenever you want to talk.</p>
      </div>
      <div class="card tappable" onclick="A.go('journal')">
        <h2>Today's journal</h2>
        <p class="sub small">Write a short reflection.</p>
      </div>
      <div class="card tappable" onclick="A.go('paywall')">
        <h2>${state.plus ? "Nijo Plus" : "Try Nijo Plus"} <span class="badge solid">Plus</span></h2>
        <p class="sub small">${state.plus ? "You're a member. Thank you for being here." : "Unlock unlimited conversations."}</p>
      </div>
    </div>
    ${bottomNav("home")}`;
  };

  screens.chat = () => `
    <div class="screen with-nav" style="gap:8px">
      ${header("Nijo", null)}
      <div class="chat-scroll" id="chat-scroll">
        <div class="bubble nijo">Hi, I'm Nijo 🙂 This is your space — what's on your mind today?</div>
        ${state.chat
          .map((m) => `<div class="bubble ${m.role === "user" ? "user" : "nijo"}">${esc(m.content)}</div>`)
          .join("")}
        ${state.typing ? '<div class="bubble nijo"><span class="typing"><span></span><span></span><span></span></span></div>' : ""}
      </div>
      <div class="chat-input-row">
        <textarea id="chat-text" rows="1" placeholder="Say anything…" onkeydown="A.chatKey(event)"></textarea>
        <button class="send-btn" onclick="A.sendChat()" ${state.typing ? "disabled" : ""}>➤</button>
      </div>
    </div>
    ${bottomNav("chat")}`;

  screens.checkin = () => `
    <div class="screen">
      ${header("", "home")}
      <h1>How are you feeling?</h1>
      <div class="chip-row">
        ${MOODS.map(
          (m, i) =>
            `<button class="chip ${state.checkinMood === i ? "selected" : ""}" onclick="A.pickMood(${i})">${m.emoji} ${m.label}</button>`
        ).join("")}
      </div>
      <textarea id="checkin-note" rows="4" placeholder="Add a note (optional)">${esc(state.checkinNote)}</textarea>
      <div class="spacer"></div>
      <button class="btn" ${state.checkinMood === null ? "disabled" : ""} onclick="A.saveCheckin()">Check in</button>
    </div>`;

  screens.checkinDone = () => `
    <div class="screen centered">
      <div class="logo">✓</div>
      <div class="stack-4">
        <h1>Checked in</h1>
        <p class="sub">Noted. Thank you for pausing with yourself today.</p>
      </div>
      <button class="btn" onclick="A.go('home')">Done</button>
    </div>`;

  screens.journal = () => `
    <div class="screen with-nav">
      ${header("Journal", null, `<button class="btn compact" onclick="A.go('journalEdit')">New</button>`)}
      <div class="stack-12">
        ${state.journal
          .slice()
          .sort((a, b) => b.date - a.date)
          .map(
            (e) => `
          <div class="card tappable" onclick="A.go('journalRead', {id:${e.id}})">
            <p class="caption">${fmtShort(e.date)}</p>
            <h2>${esc(e.title)}</h2>
            <p class="sub small" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${esc(e.text)}</p>
          </div>`
          )
          .join("")}
      </div>
    </div>
    ${bottomNav("journal")}`;

  screens.journalEdit = () => `
    <div class="screen">
      ${header("New entry", "journal")}
      <input type="text" id="j-title" placeholder="Title" />
      <textarea id="j-text" rows="10" placeholder="What's on your mind?" style="flex:1"></textarea>
      <button class="btn" onclick="A.saveJournal()">Save</button>
    </div>`;

  screens.journalRead = () => {
    const e = state.journal.find((x) => x.id === state.params.id);
    if (!e) return screens.journal();
    return `
    <div class="screen">
      ${header("", "journal")}
      <p class="caption">${fmtDate(e.date)}</p>
      <h1>${esc(e.title)}</h1>
      <p>${esc(e.text)}</p>
    </div>`;
  };

  screens.paywall = () => `
    <div class="screen">
      ${header("", "home")}
      <div class="stack-4">
        <h1>Nijo Plus</h1>
        <p class="sub">More space to be heard.</p>
      </div>
      <div class="stack-10">
        ${[
          "Unlimited conversations",
          "Deeper memory that remembers you",
          "Mood trends & journal insights",
          "Your data, always private",
        ]
          .map((b) => `<div class="check-row"><span class="check-icon">✓</span><span>${b}</span></div>`)
          .join("")}
      </div>
      <div style="height:6px"></div>
      <div class="plan-card ${state.plan === "annual" ? "selected" : ""}" onclick="A.setPlan('annual')">
        <span class="plan-badge badge solid">Best value</span>
        <div style="display:flex; justify-content:space-between; align-items:baseline">
          <strong>Annual</strong><strong>₹1,499/yr</strong>
        </div>
        <div class="small sub">₹125/mo · <span style="color:var(--primary); font-weight:600">Save 40%</span></div>
      </div>
      <div class="plan-card ${state.plan === "monthly" ? "selected" : ""}" onclick="A.setPlan('monthly')">
        <div style="display:flex; justify-content:space-between; align-items:baseline">
          <strong>Monthly</strong><strong>₹199/mo</strong>
        </div>
        <div class="small sub">Billed every month</div>
      </div>
      <div class="spacer"></div>
      <button class="btn" onclick="A.startTrial()">Start 7-day free trial</button>
      <p class="caption center">Cancel anytime · Terms apply</p>
    </div>`;

  screens.plusWelcome = () => `
    <div class="screen centered">
      <div class="logo">🧡</div>
      <div class="stack-4">
        <h1>Welcome to Nijo Plus</h1>
        <p class="sub">Your 7-day free trial has started. Take all the space you need.</p>
      </div>
      <button class="btn" onclick="A.go('home')">Continue</button>
    </div>`;

  screens.community = () => {
    const topics = ["All", "Work", "Anxiety", "More"];
    const visible = state.posts.filter((p) => {
      if (state.communityTopic === "All") return true;
      if (state.communityTopic === "More") return !["Work", "Anxiety"].includes(p.topic);
      return p.topic === state.communityTopic;
    });
    return `
    <div class="screen with-nav">
      ${header("Community", "you")}
      <p class="caption" style="margin-top:-10px">A safe, anonymous space. Be kind.</p>
      <div class="chip-row">
        ${topics
          .map((t) => `<button class="chip tint ${state.communityTopic === t ? "selected" : ""}" onclick="A.setTopic('${t}')">${t}</button>`)
          .join("")}
      </div>
      <div class="stack-12">
        ${visible
          .map(
            (p) => `
          <div class="card tappable" onclick="A.go('postDetail', {id:${p.id}})">
            <div class="post-meta"><span class="badge">${esc(p.topic)}</span><span>Anonymous · ${esc(p.time)}</span></div>
            <p style="margin-top:8px">${esc(p.text)}</p>
            <div class="post-actions">
              <button class="post-action ${p.liked ? "liked" : ""}" onclick="event.stopPropagation(); A.likePost(${p.id})">♥ ${p.likes}</button>
              <span class="post-action">💬 ${p.replies.length}</span>
            </div>
          </div>`
          )
          .join("")}
      </div>
      <div style="height:60px"></div>
    </div>
    <button class="fab" onclick="A.go('newPost')">+</button>
    ${bottomNav("you")}`;
  };

  screens.newPost = () => {
    const topics = ["Work", "Anxiety", "Sleep", "Family", "More"];
    return `
    <div class="screen">
      ${header("New post", "community")}
      <p class="sub small" style="margin-top:-10px">Posted anonymously. No name, no profile.</p>
      <div class="chip-row">
        ${topics
          .map((t) => `<button class="chip ${state.params.topic === t ? "selected" : ""}" onclick="A.setPostTopic('${t}')">${t}</button>`)
          .join("")}
      </div>
      <textarea id="post-text" rows="7" placeholder="What would you like to share?">${esc(state.params.draft || "")}</textarea>
      <div class="spacer"></div>
      <button class="btn" onclick="A.submitPost()">Post anonymously</button>
    </div>`;
  };

  screens.postShared = () => `
    <div class="screen centered">
      <div class="logo">🕊️</div>
      <div class="stack-4">
        <h1>Shared anonymously</h1>
        <p class="sub">Thank you for opening up. Someone out there needed to read that.</p>
      </div>
      <button class="btn" onclick="A.go('community')">Back to community</button>
    </div>`;

  screens.postDetail = () => {
    const p = state.posts.find((x) => x.id === state.params.id);
    if (!p) return screens.community();
    return `
    <div class="screen">
      ${header("Post", "community", `<button class="overflow-btn" onclick="A.go('report', {id:${p.id}})">⋯</button>`)}
      <div class="card">
        <div class="post-meta"><span class="badge">${esc(p.topic)}</span><span>Anonymous · ${esc(p.time)}</span></div>
        <p style="margin-top:8px">${esc(p.text)}</p>
        <div class="post-actions">
          <button class="post-action ${p.liked ? "liked" : ""}" onclick="A.likePost(${p.id})">♥ ${p.likes}</button>
          <span class="post-action">💬 ${p.replies.length}</span>
        </div>
      </div>
      <p class="caption">Replies</p>
      <div class="stack-10">
        ${p.replies.map((r) => `<div class="reply-card"><p class="small">${esc(r.text)}</p><p class="caption" style="margin-top:4px">Anonymous · ${esc(r.time)}</p></div>`).join("") || '<p class="sub small">No replies yet. Be the first kind voice.</p>'}
      </div>
      <div class="spacer"></div>
      <div class="chat-input-row">
        <textarea id="reply-text" rows="1" placeholder="Write a kind reply…"></textarea>
        <button class="send-btn" onclick="A.sendReply(${p.id})">➤</button>
      </div>
    </div>`;
  };

  screens.report = () => {
    const reasons = ["Harmful or unsafe", "Harassment or bullying", "Spam", "Someone may be in danger", "Something else"];
    return `
    <div class="screen">
      <div class="screen-header">
        <button class="back-btn" onclick="A.go('postDetail', {id:${state.params.id}})">←</button>
        <h2>Report post</h2>
      </div>
      <p class="sub small" style="margin-top:-10px">Reports are anonymous. Our team reviews every one.</p>
      <div class="stack-12">
        ${reasons
          .map(
            (r, i) => `
          <div class="select-row ${state.reportReason === i ? "selected" : ""}" onclick="A.pickReason(${i})">
            <span>${r}</span><span class="dot-check">${state.reportReason === i ? "✓" : ""}</span>
          </div>`
          )
          .join("")}
      </div>
      <div class="spacer"></div>
      <button class="btn" ${state.reportReason === null ? "disabled" : ""} onclick="A.submitReport()">Submit report</button>
    </div>`;
  };

  screens.reportDone = () => `
    <div class="screen centered">
      <div class="logo">🙏</div>
      <div class="stack-4">
        <h1>Thank you</h1>
        <p class="sub">Your report has been received. If someone may be in immediate danger, please see the helplines below.</p>
      </div>
      <button class="btn secondary" onclick="A.go('gethelp', {from:'reportDone'})">Get help</button>
      <button class="btn" onclick="A.go('community')">Back to community</button>
    </div>`;

  screens.gethelp = () => {
    const back = state.params.from || "you";
    const lines = [
      ["iCall", "Mon–Sat, 10am–8pm", "9152987821"],
      ["Tele-MANAS", "Free · 24x7 · Govt. of India", "14416"],
      ["Emergency", "Police / Ambulance", "112"],
    ];
    return `
    <div class="screen">
      ${header("", back)}
      <div class="stack-4">
        <h1>You're not alone</h1>
        <p class="sub">If things feel heavy right now, please talk to a trained person. These helplines are free and confidential.</p>
      </div>
      <div class="stack-12">
        ${lines
          .map(
            ([name, sub, num]) => `
          <div class="row-item" style="cursor:default">
            <div class="icon">📞</div>
            <div class="grow"><strong>${name}</strong><div class="small sub">${sub}</div></div>
            <a class="btn compact" style="text-decoration:none; text-align:center" href="tel:${num}">Call</a>
          </div>`
          )
          .join("")}
      </div>
      <div class="card" style="background:var(--tint); border-color:var(--tint)">
        <p class="small sub">Reaching out is a sign of strength, not weakness. Nijo will be here when you come back. 🧡</p>
      </div>
    </div>`;
  };

  screens.you = () => {
    const streak = (() => {
      let s = 0;
      for (let i = 0; ; i++) {
        if (state.checkins.some((c) => c.date === dateKey(daysAgo(i)))) s++;
        else break;
      }
      return s;
    })();
    return `
    <div class="screen with-nav">
      <div class="stack-4">
        <h1>Your space</h1>
        <p class="caption">Everything about you, in one place</p>
      </div>
      <div class="stat-grid">
        <div class="card stat-card"><div class="num">${streak}</div><div class="caption">day streak</div></div>
        <div class="card stat-card"><div class="num">${state.checkins.length}</div><div class="caption">check-ins</div></div>
        <div class="card stat-card"><div class="num">${Math.max(1, Math.ceil(state.checkins.length / 7))}</div><div class="caption">weeks</div></div>
      </div>
      <div class="stack-12">
        <button class="row-item" onclick="A.go('insights')"><div class="icon">📊</div><div class="grow">Mood insights</div><span class="chev">›</span></button>
        <button class="row-item" onclick="A.go('journal')"><div class="icon">📖</div><div class="grow">Journal</div><span class="chev">›</span></button>
        <button class="row-item" onclick="A.go('community')"><div class="icon">🫶</div><div class="grow">Community</div><span class="chev">›</span></button>
        <button class="row-item" onclick="A.go('paywall')"><div class="icon">🧡</div><div class="grow">Nijo Plus ${state.plus ? '<span class="badge solid">Active</span>' : ""}</div><span class="chev">›</span></button>
        <button class="row-item" onclick="A.go('settings')"><div class="icon">⚙️</div><div class="grow">Settings</div><span class="chev">›</span></button>
        <button class="row-item" onclick="A.go('gethelp', {from:'you'})"><div class="icon">🆘</div><div class="grow">Help &amp; resources</div><span class="chev">›</span></button>
      </div>
    </div>
    ${bottomNav("you")}`;
  };

  screens.settings = () => `
    <div class="screen">
      ${header("Settings", "you")}
      <div class="stack-12">
        <div class="row-item" style="cursor:default"><div class="icon">📱</div><div class="grow">Phone number<div class="small sub">+91 ${esc(state.phone || "not set")}</div></div></div>
        <button class="row-item" onclick="A.go('language', {from:'settings'})"><div class="icon">🌐</div><div class="grow">Language<div class="small sub">${esc(state.language)}</div></div><span class="chev">›</span></button>
        <div class="row-item" style="cursor:default">
          <div class="icon">⏰</div><div class="grow">Daily check-in reminder<div class="small sub">A gentle nudge at 9 pm</div></div>
          <label class="toggle"><input type="checkbox" ${state.reminder ? "checked" : ""} onchange="A.setReminder(this.checked)" /><span class="track"></span></label>
        </div>
        <button class="row-item" onclick="A.exportData()"><div class="icon">📤</div><div class="grow">Export my data</div><span class="chev">›</span></button>
        <button class="row-item" onclick="A.deleteData()"><div class="icon">🗑️</div><div class="grow">Delete my data</div><span class="chev">›</span></button>
        <button class="row-item" onclick="A.go('about')"><div class="icon">🙂</div><div class="grow">About Nijo</div><span class="chev">›</span></button>
      </div>
      <div class="spacer"></div>
      <button class="btn secondary" onclick="A.signOut()">Sign out</button>
    </div>`;

  screens.about = () => `
    <div class="screen centered">
      ${header("", "settings")}
      <div class="spacer"></div>
      <div class="logo">🙂</div>
      <div class="stack-4">
        <h1>Nijo</h1>
        <p class="sub">A quiet place to be heard.</p>
        <p class="caption">Version 0.1 (prototype) · Made with care in India</p>
      </div>
      <div class="spacer"></div>
    </div>`;

  screens.insights = () => {
    // latest check-in per day for the last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const key = dateKey(daysAgo(i));
      const todays = state.checkins.filter((c) => c.date === key);
      days.push({ key, d: daysAgo(i), offset: i, mood: todays.length ? todays[todays.length - 1].mood : null });
    }
    const dayName = (day) =>
      day.offset === 0 ? "Today" : day.offset === 1 ? "Yesterday" : day.d.toLocaleDateString("en-IN", { weekday: "long" });
    return `
    <div class="screen">
      ${header("Your mood", "you")}
      <p class="caption" style="margin-top:-10px">Last 7 days</p>
      <div class="card">
        <div class="bar-chart">
          ${days
            .map(
              (day) => `
            <div class="bar-col">
              <div class="bar ${day.mood === null ? "faded" : ""}" style="height:${day.mood === null ? 8 : ((day.mood + 1) / 5) * 100}%"></div>
              <span class="caption">${day.d.toLocaleDateString("en-IN", { weekday: "narrow" })}</span>
            </div>`
            )
            .join("")}
        </div>
      </div>
      <p class="caption">Recent days</p>
      <div class="stack-10">
        ${days
          .slice()
          .reverse()
          .filter((day) => day.mood !== null)
          .map(
            (day) => `
          <div class="row-item" style="cursor:default">
            <div class="icon">${MOODS[day.mood].emoji}</div>
            <div class="grow">${dayName(day)} · ${MOODS[day.mood].label}</div>
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
      go("verify");
    },
    otpNext(i) {
      const box = $("#otp" + i);
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
    saveJournal() {
      const title = $("#j-title").value.trim();
      const text = $("#j-text").value.trim();
      if (!title && !text) {
        toast("Write a little something first");
        return;
      }
      state.journal.push({
        id: state.nextJournalId++,
        date: new Date(),
        title: title || "Untitled",
        text,
      });
      toast("Saved to your journal");
      go("journal");
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
        topic: state.params.topic || "More",
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
      state.reportReason = null;
      go("reportDone");
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
      toast("Signed out. Take care 🧡");
    },
  };
  window.A = A;

  // ---------- render ----------
  function render() {
    const fn = screens[state.screen] || screens.home;
    $("#app").innerHTML = fn();
    if (state.screen === "chat") {
      const scroll = $("#chat-scroll");
      if (scroll) scroll.scrollTop = scroll.scrollHeight;
    }
    if (state.screen === "verify") $("#otp0")?.focus();
  }

  render();
})();
