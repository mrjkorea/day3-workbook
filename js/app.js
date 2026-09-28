(function () {
  "use strict";

  const ACCOUNTS_KEY = "mrj.day3.accounts";
  const RECORDS_KEY = "mrj.day3.records.v1";
  const STAMPS_KEY = "mrj.day3.stamps.v1";
  const SHEET_QUEUE_KEY = "mrj.day3.sheetQueue";
  const SESSION_KEY = "mrj.day3.session";
  const GAMEPACK_KEY = "mrj.wm.gamepack";
  // Jay 28SEP2026: ONE score book = MRJ Classroom Metrics (id below).
  const SHEET_URL =
    "https://script.google.com/macros/s/AKfycbwIBPzcmJYkJP-uURVzyt8_7iF3mzGBTCp-omNA2sF3Hk5oGusHfOlPyhEnDl2XAJu82w/exec";
  const MRJ_SCORE_SHEET = "https://docs.google.com/spreadsheets/d/1bpgekxlektvwpsef1PmIkxPiDuHrkVXFaAy-OmwqL5c";

  const MAP_STATIONS = [
    { id: "hotspot", label: "Hotspot", kind: "later" },
    { id: "choice", label: "Choice", kind: "made" },
    { id: "spelling", label: "Spelling", kind: "made" },
    { id: "memory", label: "Memory", kind: "made" },
    { id: "order", label: "Sentence order", kind: "later" },
    { id: "bell", label: "Golden Bell", kind: "later" },
  ];

  const CHOICE_UNLOCK_GAMES = ["frog", "snow"];
  const SPELLING_UNLOCK_GAMES = ["spellfire"];

  const GAME_RECORD_KEYS = {
    frog: "mrj-leap-frog-records-v1",
    snow: "mrj-ski-jump-records-v1",
    spellfire: "mrj.firefighter_spelling.records",
  };

  const state = {
    student: null,
    unit: null,
    wordPack: null,
    units: null,
    view: "login",
    backView: null,
  };

  const main = document.getElementById("main");
  const btnRecords = document.getElementById("btn-records");

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadAccounts() {
    try {
      return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveAccounts(list) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  }

  function loadRecordsRoot() {
    try {
      return JSON.parse(localStorage.getItem(RECORDS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveRecordsRoot(root) {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(root));
  }

  function studentBucket(name) {
    const root = loadRecordsRoot();
    if (!root[name]) {
      root[name] = { attempts: [], opens: [] };
    }
    if (!root[name].attempts) root[name].attempts = [];
    if (!root[name].opens) root[name].opens = [];
    return root[name];
  }

  function persistStudentBucket(name, bucket) {
    const root = loadRecordsRoot();
    root[name] = bucket;
    saveRecordsRoot(root);
  }

  function getAttempts() {
    if (!state.student) return [];
    return studentBucket(state.student.name).attempts;
  }

  function bestByStationForUnit(unitId) {
    const attempts = getAttempts().filter((a) => a.unit_id === unitId);
    const best = {};
    attempts.forEach((a) => {
      if (a.score_pct == null) return;
      if (a.station === "choice" && CHOICE_UNLOCK_GAMES.indexOf(a.game) < 0) {
        return;
      }
      if (
        a.station === "spelling" &&
        SPELLING_UNLOCK_GAMES.indexOf(a.game) < 0
      ) {
        return;
      }
      const sid = a.station;
      if (best[sid] === undefined || a.score_pct > best[sid]) {
        best[sid] = a.score_pct;
      }
    });
    return best;
  }

  function madeStationLocked(stationId) {
    if (!state.unit) return false;
    const lockedId = MRJRules.nextMadeLocked(
      bestByStationForUnit(state.unit.id)
    );
    if (!lockedId) return false;
    const madeIdx = MRJRules.MADE_ORDER.indexOf(stationId);
    const lockIdx = MRJRules.MADE_ORDER.indexOf(lockedId);
    if (madeIdx < 0) return false;
    return madeIdx >= lockIdx;
  }

  function loadStamps() {
    try {
      return JSON.parse(localStorage.getItem(STAMPS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveStamps(list) {
    localStorage.setItem(STAMPS_KEY, JSON.stringify(list));
  }

  function loadSheetQueue() {
    try {
      return JSON.parse(localStorage.getItem(SHEET_QUEUE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveSheetQueue(list) {
    localStorage.setItem(SHEET_QUEUE_KEY, JSON.stringify(list));
  }

  function localDateStr(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function rowTime(row) {
    const t =
      row.ts ??
      row.timestamp ??
      row.time ??
      row.created_at ??
      row.ended_at ??
      row.started_at;
    if (typeof t === "number") return t;
    if (typeof t === "string") {
      const p = Date.parse(t);
      return Number.isFinite(p) ? p : 0;
    }
    return 0;
  }

  function loadGameRecords(storageKey) {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (Array.isArray(raw)) return raw;
      if (raw && Array.isArray(raw.records)) return raw.records;
      if (raw && Array.isArray(raw.items)) return raw.items;
      return [];
    } catch {
      return [];
    }
  }

  function isRowCorrect(row) {
    if (row.correct === true || row.correct === 1) return true;
    if (row.correct === false || row.correct === 0) return false;
    return null;
  }

  function newRowsForStamp(storageKey, studentName, sinceMs) {
    return loadGameRecords(storageKey).filter((row) => {
      const sid = row.student_id ?? row.student ?? "";
      if (sid !== studentName) return false;
      return rowTime(row) > sinceMs;
    });
  }

  function scoreFromRows(rows) {
    let correct = 0;
    let total = 0;
    rows.forEach((row) => {
      const c = isRowCorrect(row);
      if (c === null) return;
      total += 1;
      if (c) correct += 1;
    });
    return { correct, total };
  }

  function uniqueEventId() {
    return (
      "day3-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 8)
    );
  }

  async function postSheetAttempt(attempt) {
    const name = attempt.student_name;
    const meta = JSON.stringify({
      student_name: name,
      station: attempt.station,
      game: attempt.game,
    });
    const body = {
      student_email: "unknown",
      session_id: "day3-" + name + "-" + localDateStr(new Date(attempt.ended_at)),
      events: [
        {
          event_id: uniqueEventId(),
          event_kind: "learning_result",
          source: "mrj-day3",
          curriculum_program: "conversation",
          subject: "conversation",
          app_name: "MRJ Day 3",
          book_title: attempt.unit_title,
          unit_id: attempt.unit_id,
          item_id: attempt.station + "-" + attempt.game,
          item_type: "game",
          score_value: attempt.correct,
          score_max: attempt.total,
          score_pct: attempt.score_pct,
          correctness: MRJRules.pass(attempt.score_pct) ? "correct" : "incorrect",
          completed: true,
          local_date: localDateStr(new Date(attempt.ended_at)),
          schema_version: "5.0",
          tracker_version: "day3-map-1",
          metadata_json: meta,
        },
      ],
    };

    try {
      const res = await fetch(SHEET_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        return "sent, not confirmed";
      }
      if (data && data.status === "ok") return "saved";
      return "sent, not confirmed";
    } catch {
      const q = loadSheetQueue();
      q.push({ attempt, body, queued_at: new Date().toISOString() });
      saveSheetQueue(q);
      return "on this phone only";
    }
  }

  async function flushSheetQueue() {
    const q = loadSheetQueue();
    if (!q.length) return;
    const remaining = [];
    for (const item of q) {
      try {
        const res = await fetch(SHEET_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(item.body),
        });
        let data = null;
        try {
          data = await res.json();
        } catch {
          remaining.push(item);
          continue;
        }
        if (data && data.status === "ok") {
          updateAttemptSheet(item.attempt, "saved");
        } else {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }
    saveSheetQueue(remaining);
  }

  function updateAttemptSheet(attemptRef, sheetStatus) {
    const root = loadRecordsRoot();
    const bucket = root[attemptRef.student_name];
    if (!bucket) return;
    bucket.attempts.forEach((a) => {
      if (
        a.started_at === attemptRef.started_at &&
        a.game === attemptRef.game &&
        a.unit_id === attemptRef.unit_id
      ) {
        a.sheet = sheetStatus;
      }
    });
    saveRecordsRoot(root);
  }

  function recordFinishedAttempt(stamp, correct, total, scorePctVal) {
    const name = stamp.studentName;
    const bucket = studentBucket(name);
    const tryN = MRJRules.tryNumber(
      bucket.attempts,
      stamp.unitId,
      stamp.station
    );
    const ended = new Date().toISOString();
    const attempt = {
      student_name: name,
      unit_id: stamp.unitId,
      unit_title: stamp.unitTitle,
      station: stamp.station,
      game: stamp.game,
      try_n: tryN,
      score_pct: scorePctVal,
      correct,
      total,
      started_at: stamp.startedAt,
      ended_at: ended,
      sheet: "pending",
    };
    bucket.attempts.push(attempt);
    persistStudentBucket(name, bucket);

    postSheetAttempt(attempt).then(function (status) {
      attempt.sheet = status;
      const root = loadRecordsRoot();
      const b = root[name];
      if (b) {
        b.attempts.forEach((a) => {
          if (a.started_at === attempt.started_at && a.game === attempt.game) {
            a.sheet = status;
          }
        });
        saveRecordsRoot(root);
      }
    });
  }

  function noteOpenWithoutScore(stamp) {
    const name = stamp.studentName;
    const bucket = studentBucket(name);
    const key =
      stamp.unitId +
      "|" +
      stamp.station +
      "|" +
      stamp.game +
      "|" +
      stamp.startedAt;
    const exists = bucket.opens.some((o) => o.key === key);
    if (!exists) {
      bucket.opens.push({
        key,
        unit_id: stamp.unitId,
        unit_title: stamp.unitTitle,
        station: stamp.station,
        game: stamp.game,
        opened_at: stamp.startedAt,
        note: "opened, no score came back yet",
      });
      persistStudentBucket(name, bucket);
    }
  }

  function processStamp(stamp) {
    const storageKey = GAME_RECORD_KEYS[stamp.game];
    if (!storageKey) return false;

    const rows = newRowsForStamp(
      storageKey,
      stamp.studentName,
      stamp.stampMs
    );
    if (!MRJRules.roundCounts(rows.length, stamp.wordCount)) return false;

    const { correct, total } = scoreFromRows(rows);
    if (!total) return false;
    const pct = MRJRules.scorePct(correct, total);
    if (pct == null) return false;

    recordFinishedAttempt(stamp, correct, total, pct);
    return true;
  }

  function ingestReturnQuery() {
    const params = new URLSearchParams(location.search);
    if (
      !params.has("score") ||
      !params.has("max") ||
      !params.has("station") ||
      !params.has("unit") ||
      !params.has("game")
    ) {
      return;
    }
    const session = loadSession();
    if (!session) return;

    const correct = Number(params.get("score"));
    const total = Number(params.get("max"));
    const station = params.get("station");
    const unitId = params.get("unit");
    const game = params.get("game");
    const pct = MRJRules.scorePct(correct, total);
    if (pct == null) return;

    const stamps = loadStamps().filter(
      (s) =>
        !(
          s.studentName === session.name &&
          s.unitId === unitId &&
          s.station === station &&
          s.game === game
        )
    );
    saveStamps(stamps);

    const unitTitle =
      (state.units &&
        state.units.find(function (u) {
          return u.id === unitId;
        }) &&
        state.units.find(function (u) {
          return u.id === unitId;
        }).title) ||
      unitId;

    recordFinishedAttempt(
      {
        studentName: session.name,
        unitId,
        unitTitle,
        station,
        game,
        startedAt: new Date().toISOString(),
        stampMs: 0,
        wordCount: total,
      },
      correct,
      total,
      pct
    );

    history.replaceState({}, "", location.pathname + location.hash);
  }

  function ingestPendingStamps() {
    const stamps = loadStamps();
    if (!stamps.length) return;
    const keep = [];
    stamps.forEach(function (stamp) {
      if (processStamp(stamp)) return;
      const age = Date.now() - stamp.stampMs;
      if (age > 60000) {
        noteOpenWithoutScore(stamp);
      } else {
        keep.push(stamp);
      }
    });
    saveStamps(keep);
  }

  function saveSession(name) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ name: name }));
  }

  function loadSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      return s && s.name ? s : null;
    } catch {
      return null;
    }
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  async function loadUnitsCatalog() {
    const res = await fetch("packs/units.json");
    if (!res.ok) throw new Error("units");
    state.units = await res.json();
  }

  async function fetchWordPack(packUrl) {
    const res = await fetch(packUrl);
    if (!res.ok) throw new Error("pack");
    return res.json();
  }

  function pickWrongEnglish(words, correctEn, count) {
    const pool = words
      .map(function (w) {
        return w.en;
      })
      .filter(function (en) {
        return en !== correctEn;
      });
    const shuffled = pool.slice().sort(function () {
      return Math.random() - 0.5;
    });
    return shuffled.slice(0, count);
  }

  function buildSessionGamePack(wordPack) {
    const words = wordPack.words || [];
    return {
      pack_id: wordPack.id,
      title: wordPack.title,
      items: words.map(function (w) {
        return {
          item_id: w.id,
          question: w.ko || (w.l1 && w.l1.ko) || "",
          correct: w.en,
          wrong: pickWrongEnglish(words, w.en, 2),
        };
      }),
    };
  }

  function buildSpellfirePack(wordPack) {
    return {
      pack_id: wordPack.id,
      title: wordPack.title,
      items: (wordPack.words || []).map(function (w) {
        return { item_id: w.id, word: w.en };
      }),
    };
  }

  function buildMemoryPack(wordPack) {
    return {
      pack_id: wordPack.id,
      title: wordPack.title,
      items: (wordPack.words || []).map(function (w) {
        return {
          id: w.id,
          en: w.en,
          l1: { ko: w.ko || (w.l1 && w.l1.ko) || "" },
        };
      }),
    };
  }

  function buildSpacePack(wordPack) {
    const words = wordPack.words || [];
    return {
      pack_id: wordPack.id,
      title: wordPack.title,
      module_id: "sound_invaders",
      activity_id: "hear_shoot",
      items: words.map(function (w) {
        return {
          item_id: w.id,
          prompt: w.ko || (w.l1 && w.l1.ko) || w.en,
          correct: w.en,
          wrong: pickWrongEnglish(words, w.en, 2),
        };
      }),
    };
  }

  function packDataUrl(obj) {
    return "data:application/json," + encodeURIComponent(JSON.stringify(obj));
  }

  function addStamp(station, game, wordCount) {
    const stamp = {
      studentName: state.student.name,
      unitId: state.unit.id,
      unitTitle: state.unit.title,
      station,
      game,
      stampMs: Date.now(),
      startedAt: new Date().toISOString(),
      wordCount,
    };
    const stamps = loadStamps();
    stamps.push(stamp);
    saveStamps(stamps);
  }

  function openGame(station, game, url) {
    addStamp(station, game, (state.wordPack.words || []).length);
    location.href = url;
  }

  function openSessionGame(station, game, baseUrl) {
    const words = state.wordPack.words || [];
    if (words.length < 3) {
      alert("This unit pack is too small for this game (need at least 3 words).");
      return;
    }
    const pack = buildSessionGamePack(state.wordPack);
    sessionStorage.setItem(GAMEPACK_KEY, JSON.stringify(pack));
    const name = encodeURIComponent(state.student.name);
    openGame(station, game, baseUrl + "?pack=session&student=" + name);
  }

  function openPackUrlGame(station, game, baseUrl, packObj) {
    const name = encodeURIComponent(state.student.name);
    const packUrl = encodeURIComponent(packDataUrl(packObj));
    openGame(
      station,
      game,
      baseUrl + "?pack=" + packUrl + "&student=" + name
    );
  }

  function headerBack(label) {
    return (
      '<button type="button" class="btn btn-secondary btn-back">' +
      escapeHtml(label || "Back") +
      "</button>"
    );
  }

  function bindBack(selector, fn) {
    const el = main.querySelector(selector);
    if (el) el.addEventListener("click", fn);
  }

  function renderLogin() {
    state.view = "login";
    main.innerHTML =
      '<div class="card">' +
      "<h2>Log in</h2>" +
      '<p class="sub">First name and 4-digit PIN stay on this phone only.</p>' +
      '<div id="login-err" class="err-msg hidden"></div>' +
      '<label class="field-label">First name</label>' +
      '<input type="text" id="login-name" autocomplete="given-name" class="input" />' +
      '<label class="field-label">PIN</label>' +
      '<input type="password" id="login-pin" inputmode="numeric" maxlength="4" class="input" />' +
      '<button type="button" id="login-go" class="btn btn-primary">Continue</button>' +
      "</div>";

    main.querySelector("#login-go").addEventListener("click", tryLogin);
    main.querySelector("#login-pin").addEventListener("keydown", function (e) {
      if (e.key === "Enter") tryLogin();
    });
  }

  function tryLogin() {
    const err = main.querySelector("#login-err");
    const name = main.querySelector("#login-name").value.trim();
    const pin = main.querySelector("#login-pin").value.trim();
    err.classList.add("hidden");
    if (!name || !/^\d{4}$/.test(pin)) {
      err.textContent = "Enter your first name and a 4-digit PIN.";
      err.classList.remove("hidden");
      return;
    }
    const accounts = loadAccounts();
    const found = accounts.find(function (a) {
      return a.name === name;
    });
    if (found) {
      if (found.pin !== pin) {
        err.textContent = "Wrong PIN for this name.";
        err.classList.remove("hidden");
        return;
      }
    } else {
      accounts.push({ name, pin });
      saveAccounts(accounts);
    }
    state.student = { name };
    saveSession(name);
    renderUnits();
  }

  function renderUnits() {
    state.view = "units";
    if (!state.units) {
      main.innerHTML = '<p class="sub">Loading units…</p>';
      loadUnitsCatalog()
        .then(function () {
          renderUnits();
        })
        .catch(function () {
          main.innerHTML =
            '<p class="err-msg">Could not load units. Check your connection.</p>';
        });
      return;
    }
    const items = state.units
      .map(function (u) {
        return (
          '<button type="button" class="unit-btn" data-unit="' +
          escapeHtml(u.id) +
          '"><strong>' +
          escapeHtml(u.title) +
          "</strong></button>"
        );
      })
      .join("");

    main.innerHTML =
      '<h2>Pick a unit</h2>' +
      '<p class="sub">One map — words change with the unit.</p>' +
      '<div class="unit-grid">' +
      items +
      "</div>" +
      headerBack("Log out");

    main.querySelectorAll(".unit-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-unit");
        const unit = state.units.find(function (u) {
          return u.id === id;
        });
        if (unit) startUnit(unit);
      });
    });
    bindBack(".btn-back", function () {
      state.student = null;
      clearSession();
      renderLogin();
    });
  }

  async function startUnit(unit) {
    state.unit = unit;
    main.innerHTML = '<p class="sub">Loading words…</p>';
    try {
      state.wordPack = await fetchWordPack(unit.pack_url);
      renderMap();
    } catch {
      main.innerHTML =
        '<p class="err-msg">Could not load word pack.</p>' + headerBack("Units");
      bindBack(".btn-back", renderUnits);
    }
  }

  function stationStatus(st) {
    if (st.kind === "later") return "Later";
    if (madeStationLocked(st.id)) return "Locked";
    const best = bestByStationForUnit(state.unit.id)[st.id];
    if (best != null) return "Best " + best + "%";
    return "Open";
  }

  function renderMap() {
    state.view = "map";
    const best = bestByStationForUnit(state.unit.id);
    const nextLock = MRJRules.nextMadeLocked(best);

    const nodes = MAP_STATIONS.map(function (st, idx) {
      const locked = st.kind === "made" && madeStationLocked(st.id);
      const cls =
        "path-item path-node" +
        (locked ? " locked" : "") +
        (st.kind === "later" ? " later-door" : "");
      return (
        '<li class="' +
        cls +
        '" data-station="' +
        escapeHtml(st.id) +
        '" style="--i:' +
        idx +
        '">' +
        '<div><strong>' +
        escapeHtml(st.label) +
        '</strong><div class="path-meta">' +
        escapeHtml(stationStatus(st)) +
        "</div></div>" +
        '<span class="path-chevron" aria-hidden="true">›</span></li>'
      );
    }).join("");

    main.innerHTML =
      headerBack("Units") +
      "<h2>" +
      escapeHtml(state.unit.title) +
      "</h2>" +
      '<p class="sub">Follow the path. Pass 80% on each game station to unlock the next.</p>' +
      (nextLock
        ? '<p class="sub pass-hint">Next to unlock: <strong>' +
          escapeHtml(nextLock) +
          "</strong> (need 80% on the station before).</p>"
        : "") +
      '<ol class="path-wind">' +
      nodes +
      "</ol>";

    bindBack(".btn-back", function () {
      state.unit = null;
      state.wordPack = null;
      renderUnits();
    });

    main.querySelectorAll(".path-item").forEach(function (el) {
      el.addEventListener("click", function () {
        const sid = el.getAttribute("data-station");
        openStation(sid);
      });
    });
  }

  function openStation(stationId) {
    const st = MAP_STATIONS.find(function (s) {
      return s.id === stationId;
    });
    if (!st) return;
    if (st.kind === "made" && madeStationLocked(stationId)) return;

    state.backView = "map";
    if (st.kind === "later") {
      renderLater(st);
      return;
    }
    if (stationId === "choice") {
      renderChoice();
      return;
    }
    if (stationId === "spelling") {
      renderSpelling();
      return;
    }
    if (stationId === "memory") {
      renderMemory();
    }
  }

  function renderLater(st) {
    state.view = "later";
    main.innerHTML =
      headerBack("Map") +
      "<h2>" +
      escapeHtml(st.label) +
      "</h2>" +
      '<div class="card later-card">' +
      '<p class="later-big">Later</p>' +
      "<p class=\"sub\">This station is not built yet. You can still move on along the path.</p>" +
      "</div>";
    bindBack(".btn-back", renderMap);
  }

  function renderChoice() {
    state.view = "choice";
    main.innerHTML =
      headerBack("Map") +
      "<h2>Choice</h2>" +
      '<p class="sub">Pick one game. Frog and Snow can unlock the next station at 80%.</p>' +
      '<div class="link-grid">' +
      '<button type="button" class="btn btn-primary game-link" data-game="frog">Frog jumps</button>' +
      '<button type="button" class="btn btn-primary game-link" data-game="snow">Snow jump</button>' +
      '<button type="button" class="btn btn-primary game-link" data-game="space">Space Ranger</button>' +
      "</div>";
    bindBack(".btn-back", renderMap);
    main.querySelectorAll(".game-link").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const game = btn.getAttribute("data-game");
        const name = encodeURIComponent(state.student.name);
        if (game === "frog") {
          openSessionGame(
            "choice",
            "frog",
            "https://mrjkorea.github.io/leap-frog/"
          );
        } else if (game === "snow") {
          openSessionGame(
            "choice",
            "snow",
            "https://mrjkorea.github.io/ski-jump/"
          );
        } else if (game === "space") {
          const pack = buildSpacePack(state.wordPack);
          openPackUrlGame(
            "choice",
            "space",
            "https://mrjkorea.github.io/sound-invaders/",
            pack
          );
        }
      });
    });
  }

  function renderSpelling() {
    state.view = "spelling";
    main.innerHTML =
      headerBack("Map") +
      "<h2>Spelling</h2>" +
      '<p class="sub">Spellfire is live. Other spelling games are Later doors.</p>' +
      '<div class="link-grid">' +
      '<button type="button" class="btn btn-primary" id="go-spellfire">Spellfire</button>' +
      '<button type="button" class="btn btn-secondary later-btn" data-later="hangman">Hangman · Later</button>' +
      '<button type="button" class="btn btn-secondary later-btn" data-later="wordsearch">Word search · Later</button>' +
      '<button type="button" class="btn btn-secondary later-btn" data-later="crossword">Crossword · Later</button>' +
      "</div>";
    bindBack(".btn-back", renderMap);
    main.querySelector("#go-spellfire").addEventListener("click", function () {
      const pack = buildSpellfirePack(state.wordPack);
      openPackUrlGame(
        "spelling",
        "spellfire",
        "https://mrjkorea.github.io/firefighter-spelling/",
        pack
      );
    });
    main.querySelectorAll(".later-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        renderLater({
          id: "spelling",
          label: btn.textContent.replace(" · Later", ""),
          kind: "later",
        });
      });
    });
  }

  function renderMemory() {
    state.view = "memory";
    main.innerHTML =
      headerBack("Map") +
      "<h2>Memory</h2>" +
      '<p class="sub">Opens the live memory game. Scores from this game do not unlock the path yet.</p>' +
      '<button type="button" class="btn btn-primary" id="go-memory">Memory match</button>';
    bindBack(".btn-back", renderMap);
    main.querySelector("#go-memory").addEventListener("click", function () {
      const pack = buildMemoryPack(state.wordPack);
      openPackUrlGame(
        "memory",
        "memory",
        "https://mrjkorea.github.io/memory-match/",
        pack
      );
    });
  }

  function renderRecords() {
    state.view = "records";
    const prev = state.backView || (state.unit ? "map" : "units");
    const name = state.student ? state.student.name : null;
    let body = "";
    if (!name) {
      body =
        '<p class="sub">Log in to see your tries on this phone.</p>' +
        headerBack("Back");
    } else {
      const bucket = studentBucket(name);
      const rows = bucket.attempts
        .slice()
        .reverse()
        .map(function (a) {
          return (
            "<tr><td>" +
            escapeHtml(a.unit_title || a.unit_id) +
            "</td><td>" +
            escapeHtml(a.station) +
            "</td><td>" +
            escapeHtml(a.game) +
            "</td><td>" +
            escapeHtml(String(a.try_n)) +
            "</td><td>" +
            escapeHtml(String(a.score_pct)) +
            "%</td><td>" +
            escapeHtml((a.ended_at || "").slice(0, 16)) +
            "</td><td>" +
            escapeHtml(a.sheet || "") +
            "</td></tr>"
          );
        })
        .join("");
      const openRows = bucket.opens
        .slice()
        .reverse()
        .map(function (o) {
          return (
            "<tr><td>" +
            escapeHtml(o.unit_title || o.unit_id) +
            "</td><td>" +
            escapeHtml(o.station) +
            "</td><td>" +
            escapeHtml(o.game) +
            '</td><td>—</td><td colspan="2">' +
            escapeHtml(o.note) +
            "</td><td></td></tr>"
          );
        })
        .join("");

      body =
        "<h2>Records · " +
        escapeHtml(name) +
        "</h2>" +
        '<p class="sub">Scores read from games after you return to the map. No PIN stored here.</p>' +
        headerBack("Back") +
        '<div class="table-wrap"><table class="records-table">' +
        "<thead><tr><th>Unit</th><th>Station</th><th>Game</th><th>Try</th><th>Score</th><th>Time</th><th>Sheet</th></tr></thead>" +
        "<tbody>" +
        (rows || openRows
          ? rows + openRows
          : '<tr><td colspan="7">No tries yet.</td></tr>') +
        "</tbody></table></div>";
    }

    main.innerHTML = body;
    bindBack(".btn-back", function () {
      if (prev === "map" && state.unit) renderMap();
      else if (state.student) renderUnits();
      else renderLogin();
    });
  }

  btnRecords.addEventListener("click", function () {
    if (state.view === "records") return;
    state.backView =
      state.view === "map"
        ? "map"
        : state.view === "units" || state.view === "login"
          ? "units"
          : "map";
    renderRecords();
  });

  function onResume() {
    ingestPendingStamps();
    if (state.view === "map" && state.unit) renderMap();
  }

  window.addEventListener("pageshow", onResume);
  window.addEventListener("focus", onResume);

  async function boot() {
    try {
      await loadUnitsCatalog();
    } catch {
      /* units load again on screen */
    }
    flushSheetQueue();
    const session = loadSession();
    if (session) {
      state.student = { name: session.name };
    }
    ingestReturnQuery();
    ingestPendingStamps();
    if (state.student) renderUnits();
    else renderLogin();
  }

  boot();
})();
