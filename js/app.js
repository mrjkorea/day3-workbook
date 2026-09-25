(function () {
  "use strict";

  const ACCOUNTS_KEY = "mrj.day3.accounts";
  const RECORDS_KEY = "mrj.day3.records.v1";
  const STATIONS = MRJRules.STATIONS;
  const STATION_LABELS = {
    hotspot: "Hotspot",
    choice: "Choice",
    spelling: "Spelling",
    memory: "Memory",
    order: "Order",
    bell: "Golden Bell",
  };

  const PACK_URLS = {
    ba_u01: "packs/ba_u01.json",
    body_demo: "packs/body_demo.json",
  };

  const state = {
    student: null,
    sessionId: null,
    pack: null,
    packCache: {},
  };

  const main = document.getElementById("main");
  const btnRecords = document.getElementById("btn-records");

  function uid() {
    return "s_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
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

  function loadRecordsMap() {
    try {
      return JSON.parse(localStorage.getItem(RECORDS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveRecordsMap(map) {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(map));
  }

  function getStudentRecords() {
    const map = loadRecordsMap();
    const key = state.student.name;
    if (!map[key]) map[key] = { attempts: [], summary: [] };
    return map[key];
  }

  function persistStudentRecords(rec) {
    const map = loadRecordsMap();
    map[state.student.name] = rec;
    saveRecordsMap(map);
  }

  function bestByStation(unitId) {
    const rec = getStudentRecords();
    const best = {};
    rec.attempts
      .filter((a) => a.unit_id === unitId)
      .forEach((a) => {
        const id = a.activity_id;
        if (best[id] === undefined || a.score_pct > best[id]) {
          best[id] = a.score_pct;
        }
      });
    return best;
  }

  function stationLocked(stationId, unitId) {
    const idx = STATIONS.indexOf(stationId);
    if (idx <= 0) return false;
    const best = bestByStation(unitId);
    for (let i = 0; i < idx; i++) {
      const prev = STATIONS[i];
      if ((best[prev] || 0) < 80) return true;
    }
    return false;
  }

  function tryCount(unitId, stationId) {
    const rec = getStudentRecords();
    return MRJRules.tryNumber(rec.attempts, unitId, stationId);
  }

  function saveAttempt(payload) {
    const rec = getStudentRecords();
    rec.attempts.push(payload);
    rec.summary.unshift({
      unit: payload.unit_id,
      station: payload.activity_id,
      try: payload.try_n,
      score: payload.score_pct,
      time: payload.ended_at,
    });
    persistStudentRecords(rec);
  }

  function playAudio(src, wordEn, container) {
    return new Promise(function (resolve) {
      if (container) {
        container.innerHTML =
          '<button type="button" class="btn btn-secondary replay-audio">Hear again</button>';
        container.querySelector(".replay-audio").addEventListener("click", function () {
          const again = new Audio(src);
          again.play().catch(function () {});
        });
      }
      const audio = new Audio(src);
      audio.play().then(function () {
        resolve({ failed: false, word: wordEn });
      }).catch(function () {
        resolve({ failed: true, word: wordEn });
      });
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bellBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.15;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(function () {
        o.stop();
        ctx.close();
      }, 180);
    } catch (_) {}
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function renderLogin() {
    btnRecords.classList.add("hidden");
    main.innerHTML =
      '<div class="card">' +
      "<h2>Login</h2>" +
      '<p class="sub">First name and 4-digit PIN stay on this phone only.</p>' +
      '<div id="login-err" class="err-msg hidden"></div>' +
      '<label for="name">First name</label>' +
      '<input id="name" type="text" autocomplete="given-name" />' +
      '<label for="pin">4-digit PIN</label>' +
      '<input id="pin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" />' +
      '<button type="button" class="btn" id="login-go">Start</button></div>';

    document.getElementById("login-go").addEventListener("click", function () {
      const name = document.getElementById("name").value.trim();
      const pin = document.getElementById("pin").value.trim();
      const err = document.getElementById("login-err");
      if (!name || !/^\d{4}$/.test(pin)) {
        err.textContent = "Enter your name and a 4-digit PIN.";
        err.classList.remove("hidden");
        return;
      }
      const accounts = loadAccounts();
      let acc = accounts.find(function (a) {
        return a.name.toLowerCase() === name.toLowerCase() && a.pin === pin;
      });
      if (!acc) {
        acc = { id: uid(), name: name, pin: pin };
        accounts.push(acc);
        saveAccounts(accounts);
      }
      state.student = acc;
      state.sessionId = uid();
      btnRecords.classList.remove("hidden");
      renderUnits();
    });
  }

  function renderUnits() {
    main.innerHTML =
      '<div class="card">' +
      "<h2>Pick a unit</h2>" +
      '<p class="sub">Hi, ' +
      escapeHtml(state.student.name) +
      "!</p>" +
      '<div class="unit-grid">' +
      '<button type="button" class="unit-btn" data-unit="ba_u01"><strong>Numbers 1 to 10</strong><span class="ko-gloss">1부터 10까지 숫자</span></button>' +
      '<button type="button" class="unit-btn" data-unit="body_demo"><strong>My Body</strong><span class="ko-gloss">내 몸 · picture demo</span></button>' +
      "</div>" +
      '<button type="button" class="btn btn-secondary" id="logout">Log out</button></div>';

    main.querySelectorAll(".unit-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openUnit(btn.getAttribute("data-unit"));
      });
    });
    document.getElementById("logout").addEventListener("click", function () {
      state.student = null;
      renderLogin();
    });
  }

  function fetchPack(unitId) {
    if (state.packCache[unitId]) {
      return Promise.resolve(state.packCache[unitId]);
    }
    return fetch(PACK_URLS[unitId])
      .then(function (r) {
        return r.json();
      })
      .then(function (json) {
        state.packCache[unitId] = json;
        return json;
      });
  }

  function openUnit(unitId) {
    fetchPack(unitId).then(function (pack) {
      state.pack = pack;
      renderPath();
    });
  }

  function renderPath() {
    const pack = state.pack;
    const best = bestByStation(pack.unit_id);
    const lockedNext = MRJRules.nextLocked(best);

    let items = "";
    STATIONS.forEach(function (sid) {
      const locked = stationLocked(sid, pack.unit_id);
      const bestScore = best[sid];
      const tries = tryCount(pack.unit_id, sid) - 1;
      items +=
        '<li class="path-item' +
        (locked ? " locked" : "") +
        '" data-station="' +
        sid +
        '">' +
        "<div><strong>" +
        STATION_LABELS[sid] +
        "</strong>" +
        '<div class="path-meta">' +
        (bestScore !== undefined ? "Best " + bestScore + "%" : "Not played") +
        (tries > 0 ? " · Tries " + tries : "") +
        (locked ? " · Locked" : "") +
        "</div></div><span>→</span></li>";
    });

    main.innerHTML =
      '<div class="card">' +
      "<h2>" +
      escapeHtml(pack.title_en) +
      "</h2>" +
      '<p class="ko-gloss">' +
      escapeHtml(pack.title_ko) +
      "</p>" +
      '<p class="sub">Pass line 80%. Finish each station to unlock the next.</p>' +
      '<ul class="path-list">' +
      items +
      "</ul>" +
      '<button type="button" class="btn btn-secondary" id="back-units">Units</button></div>';

    main.querySelectorAll(".path-item").forEach(function (li) {
      li.addEventListener("click", function () {
        const sid = li.getAttribute("data-station");
        if (stationLocked(sid, pack.unit_id)) return;
        startStation(sid);
      });
    });
    document.getElementById("back-units").addEventListener("click", renderUnits);

    if (lockedNext) {
      /* hint only */
    }
  }

  function finishRound(stationId, skin, correct, total, itemResults, startedAt) {
    const score = MRJRules.scorePct(correct, total);
    const tryN = tryCount(state.pack.unit_id, stationId);
    const endedAt = new Date().toISOString();
    saveAttempt({
      student_id: state.student.id,
      session_id: state.sessionId,
      module_id: "conversation",
      activity_id: stationId,
      item_id: stationId + "_" + tryN,
      skill_tags: [stationId, state.pack.unit_id],
      response: JSON.stringify(itemResults),
      correct: correct,
      latency_ms: Date.now() - startedAt,
      accuracy: total ? correct / total : 0,
      points: correct * 10,
      errors: total - correct,
      started_at: new Date(startedAt).toISOString(),
      ended_at: endedAt,
      ui_locale: "en",
      unit_id: state.pack.unit_id,
      skin: skin || "",
      try_n: tryN,
      score_pct: score,
      total: total,
    });
    renderResult(stationId, score, correct, total);
  }

  function renderResult(stationId, score, correct, total) {
    const passed = MRJRules.pass(score);
    main.innerHTML =
      '<div class="card result-banner">' +
      "<h2>Round done</h2>" +
      '<p class="score-big">' +
      score +
      "%</p>" +
      "<p>" +
      correct +
      " / " +
      total +
      " correct</p>" +
      '<span class="pass-tag ' +
      (passed ? "pass" : "fail") +
      '">' +
      (passed ? "Pass · next station unlocked" : "Need 80% to unlock next") +
      "</span>" +
      '<button type="button" class="btn" id="to-path">Back to path</button>' +
      '<button type="button" class="btn btn-secondary" id="retry">Try again</button></div>';

    document.getElementById("to-path").addEventListener("click", renderPath);
    document.getElementById("retry").addEventListener("click", function () {
      startStation(stationId);
    });
  }

  function startStation(stationId) {
    const pack = state.pack;
    if (stationId === "hotspot") runHotspot(pack);
    else if (stationId === "choice") runChoicePick(pack);
    else if (stationId === "spelling") runSpellingPick(pack);
    else if (stationId === "memory") runMemory(pack);
    else if (stationId === "order") runOrder(pack);
    else if (stationId === "bell") runBell(pack);
  }

  function gameShell(title, sub, inner) {
    return (
      '<div class="game-top"><span>' +
      escapeHtml(title) +
      '</span><button type="button" class="btn-text" id="quit-game">Quit</button></div>' +
      (sub ? '<p class="sub">' + escapeHtml(sub) + "</p>" : "") +
      inner
    );
  }

  function progressDots(i, total) {
    let h = '<div class="progress-dots">';
    for (let n = 0; n < total; n++) {
      h += '<span class="dot' + (n < i ? " done" : "") + (n === i ? " now" : "") + '"></span>';
    }
    return h + "</div>";
  }

  /* ——— Hotspot ——— */
  function hotspotRegions(pack) {
    if (pack.scene === "body") {
      return [
        { id: "b01", cx: 200, cy: 58, r: 36 },
        { id: "b02", cx: 186, cy: 54, r: 14 },
        { id: "b03", cx: 162, cy: 60, r: 12 },
        { id: "b04", cx: 200, cy: 70, r: 12 },
        { id: "b05", cx: 200, cy: 84, r: 12 },
        { id: "b06", cx: 156, cy: 112, r: 16 },
        { id: "b07", cx: 124, cy: 156, r: 18 },
        { id: "b08", cx: 108, cy: 196, r: 16 },
        { id: "b09", cx: 176, cy: 248, r: 20 },
        { id: "b10", cx: 164, cy: 318, r: 18 },
      ];
    }
    return [
      { id: "w01", cx: 78, cy: 48, r: 28 },
      { id: "w02", cx: 150, cy: 62, r: 30 },
      { id: "w03", cx: 330, cy: 118, r: 36 },
      { id: "w04", cx: 62, cy: 300, r: 34 },
      { id: "w05", cx: 318, cy: 312, r: 36 },
      { id: "w06", cx: 168, cy: 348, r: 26 },
      { id: "w07", cx: 228, cy: 168, r: 34 },
      { id: "w08", cx: 340, cy: 36, r: 28 },
      { id: "w09", cx: 36, cy: 168, r: 28 },
      { id: "w10", cx: 200, cy: 248, r: 42 },
    ];
  }

  function hotspotHits(pack) {
    return hotspotRegions(pack)
      .map(function (r) {
        return (
          '<circle class="hotspot" data-wid="' +
          r.id +
          '" cx="' +
          r.cx +
          '" cy="' +
          r.cy +
          '" r="' +
          r.r +
          '" fill="transparent" stroke="transparent"/>'
        );
      })
      .join("");
  }

  function parkScene() {
    return (
      '<rect width="400" height="380" fill="#8fd0f0"/>' +
      '<rect y="210" width="400" height="170" fill="#7dce6a"/>' +
      '<circle cx="78" cy="48" r="22" fill="#ffd54f" stroke="#e0a106"/>' +
      '<ellipse cx="138" cy="58" rx="10" ry="6" fill="#37474f"/>' +
      '<ellipse cx="162" cy="54" rx="10" ry="6" fill="#37474f"/>' +
      '<rect x="312" y="150" width="8" height="40" fill="#6d4c41"/>' +
      '<circle cx="316" cy="138" r="16" fill="#2e7d32"/>' +
      '<rect x="332" y="142" width="8" height="46" fill="#6d4c41"/>' +
      '<circle cx="336" cy="128" r="18" fill="#388e3c"/>' +
      '<rect x="350" y="146" width="8" height="42" fill="#6d4c41"/>' +
      '<circle cx="354" cy="134" r="15" fill="#1b5e20"/>' +
      '<circle cx="40" cy="292" r="7" fill="#f48fb1"/>' +
      '<circle cx="58" cy="308" r="7" fill="#f06292"/>' +
      '<circle cx="74" cy="290" r="7" fill="#ec407a"/>' +
      '<circle cx="90" cy="306" r="7" fill="#ad1457"/>' +
      '<ellipse cx="318" cy="318" rx="40" ry="22" fill="#4fc3f7"/>' +
      '<circle cx="296" cy="312" r="4" fill="#0277bd"/>' +
      '<circle cx="308" cy="322" r="4" fill="#01579b"/>' +
      '<circle cx="320" cy="310" r="4" fill="#0288d1"/>' +
      '<circle cx="332" cy="322" r="4" fill="#0277bd"/>' +
      '<circle cx="344" cy="314" r="4" fill="#01579b"/>' +
      '<circle cx="140" cy="348" r="6" fill="#9e9e9e"/>' +
      '<circle cx="154" cy="352" r="5" fill="#757575"/>' +
      '<circle cx="166" cy="346" r="6" fill="#bdbdbd"/>' +
      '<circle cx="178" cy="352" r="5" fill="#616161"/>' +
      '<circle cx="190" cy="346" r="6" fill="#9e9e9e"/>' +
      '<circle cx="202" cy="352" r="5" fill="#757575"/>' +
      '<rect x="214" y="188" width="8" height="36" fill="#6d4c41"/>' +
      '<circle cx="218" cy="176" r="18" fill="#2e7d32"/>' +
      '<circle cx="210" cy="168" r="4" fill="#e53935"/>' +
      '<circle cx="220" cy="162" r="4" fill="#c62828"/>' +
      '<circle cx="228" cy="170" r="4" fill="#e53935"/>' +
      '<circle cx="214" cy="178" r="4" fill="#b71c1c"/>' +
      '<circle cx="224" cy="180" r="4" fill="#e53935"/>' +
      '<circle cx="206" cy="174" r="4" fill="#c62828"/>' +
      '<circle cx="230" cy="160" r="4" fill="#e53935"/>' +
      '<text x="318" y="22" font-size="14" fill="#fff59d">★★★★★★★★</text>' +
      '<ellipse cx="36" cy="168" rx="22" ry="16" fill="#43a047"/>' +
      '<rect x="168" y="214" width="64" height="52" fill="#c9a66b" stroke="#6d4c41"/>' +
      '<polygon points="160,214 200,186 240,214" fill="#8d6e63"/>' +
      '<rect x="176" y="222" width="8" height="8" fill="#fff8e1"/>' +
      '<rect x="188" y="222" width="8" height="8" fill="#fff8e1"/>' +
      '<rect x="200" y="222" width="8" height="8" fill="#fff8e1"/>' +
      '<rect x="212" y="222" width="8" height="8" fill="#fff8e1"/>' +
      '<rect x="176" y="234" width="8" height="8" fill="#fff8e1"/>' +
      '<rect x="188" y="234" width="8" height="8" fill="#fff8e1"/>' +
      '<rect x="200" y="234" width="8" height="8" fill="#fff8e1"/>' +
      '<rect x="212" y="234" width="8" height="8" fill="#fff8e1"/>' +
      '<rect x="194" y="246" width="12" height="20" fill="#5d4037"/>' +
      '<rect x="176" y="248" width="8" height="8" fill="#fff8e1"/>' +
      '<rect x="212" y="248" width="8" height="8" fill="#fff8e1"/>'
    );
  }

  function bodyScene() {
    return (
      '<rect width="400" height="380" fill="#f3efe6"/>' +
      '<circle cx="200" cy="58" r="34" fill="#f5c99a" stroke="#10243f"/>' +
      '<circle cx="186" cy="54" r="4" fill="#10243f"/>' +
      '<circle cx="214" cy="54" r="4" fill="#10243f"/>' +
      '<ellipse cx="162" cy="60" rx="8" ry="12" fill="#e7b48a" stroke="#10243f"/>' +
      '<ellipse cx="200" cy="70" rx="5" ry="7" fill="#e7b48a"/>' +
      '<path d="M188 84 Q200 92 212 84" fill="none" stroke="#10243f" stroke-width="2"/>' +
      '<rect x="176" y="96" width="48" height="70" rx="16" fill="#5c6bc0"/>' +
      '<circle cx="156" cy="112" r="10" fill="#f5c99a" stroke="#10243f"/>' +
      '<rect x="118" y="120" width="22" height="52" rx="10" fill="#5c6bc0"/>' +
      '<circle cx="108" cy="196" r="12" fill="#f5c99a" stroke="#10243f"/>' +
      '<rect x="166" y="164" width="18" height="78" rx="8" fill="#3949ab"/>' +
      '<ellipse cx="164" cy="318" rx="18" ry="10" fill="#10243f"/>' +
      '<text x="250" y="200" font-size="13" fill="#10243f">Tap the part you hear</text>'
    );
  }

  function buildHotspotSvg(pack) {
    const art = pack.scene === "body" ? bodyScene() : parkScene();
    return (
      '<div class="scene-wrap"><svg viewBox="0 0 400 380" xmlns="http://www.w3.org/2000/svg">' +
      art +
      hotspotHits(pack) +
      "</svg></div>"
    );
  }

  function runHotspot(pack) {
    const words = pack.words.slice(0, 10);
    let index = 0;
    let correct = 0;
    const results = [];
    const startedAt = Date.now();
    const audioBox = document.createElement("div");

    function draw() {
      const w = words[index];
      main.innerHTML =
        gameShell("Hotspot", "Listen and tap the picture.", progressDots(index, 10)) +
        buildHotspotSvg(pack) +
        '<div id="audio-slot"></div>';
      main.querySelector("#audio-slot").appendChild(audioBox);
      audioBox.innerHTML = "";
      bindQuit();

      main.querySelectorAll(".hotspot").forEach(function (el) {
        el.addEventListener("click", function onTap() {
          const wid = el.getAttribute("data-wid");
          const right = wid === w.id;
          results.push({ id: w.id, ok: right });
          if (right) {
            correct++;
            el.classList.add("pulse-gold");
            nextItem();
          } else {
            main.querySelector(".scene-wrap").classList.add("shake-red");
            const target = main.querySelector('.hotspot[data-wid="' + w.id + '"]');
            if (target) target.classList.add("highlight-correct");
            setTimeout(nextItem, 700);
          }
        });
      });

      playAudio(w.audio, w.en, audioBox);
    }

    function nextItem() {
      index++;
      if (index >= words.length) {
        finishRound("hotspot", "", correct, 10, results, startedAt);
      } else draw();
    }

    draw();
  }

  /* ——— Choice ——— */
  function runChoicePick(pack) {
    main.innerHTML =
      gameShell("Choice", "Pick a game skin.") +
      '<div class="skin-grid">' +
      '<button type="button" class="skin-card" data-skin="frog">Frog jumps</button>' +
      '<button type="button" class="skin-card" data-skin="snow">Snow jump</button>' +
      '<button type="button" class="skin-card" data-skin="space">Space fighter</button>' +
      "</div>";
    bindQuit();
    main.querySelectorAll(".skin-card").forEach(function (btn) {
      btn.addEventListener("click", function () {
        runChoiceGame(pack, btn.getAttribute("data-skin"));
      });
    });
  }

  function runChoiceGame(pack, skin) {
    const words = shuffle(pack.words.slice(0, 10));
    let index = 0;
    let correct = 0;
    const results = [];
    const startedAt = Date.now();
    const audioBox = document.createElement("div");

    function layoutOptions(options) {
      const positions = [
        { left: "8%", top: "55%" },
        { left: "38%", top: "62%" },
        { left: "62%", top: "48%" },
      ];
      let html = '<div class="choice-stage ' + skin + '-scene">';
      if (skin === "frog") html += '<div style="position:absolute;left:10%;top:20%;font-size:2rem">🐸</div>';
      if (skin === "snow") html += '<div style="position:absolute;left:12%;top:25%;font-size:2rem">⛷️</div>';
      if (skin === "space") html += '<div style="position:absolute;left:8%;top:15%;font-size:1.5rem">🚀</div>';
      options.forEach(function (opt, i) {
        html +=
          '<button type="button" class="choice-option" data-id="' +
          opt.id +
          '" style="left:' +
          positions[i].left +
          ";top:" +
          positions[i].top +
          '">' +
          escapeHtml(opt.en) +
          '<span class="ko-gloss">' +
          escapeHtml(opt.ko) +
          "</span></button>";
      });
      html += "</div>";
      return html;
    }

    function round() {
      const target = words[index];
      const pool = shuffle(pack.words.slice(0, 10)).slice(0, 3);
      if (!pool.find(function (p) {
        return p.id === target.id;
      })) {
        pool[0] = target;
      }
      const options = shuffle(pool);

      main.innerHTML =
        gameShell("Choice · " + skin, "Tap the word you hear.", progressDots(index, 10)) +
        layoutOptions(options) +
        '<div id="audio-slot"></div>';
      main.querySelector("#audio-slot").appendChild(audioBox);
      audioBox.innerHTML = "";
      bindQuit();

      main.querySelectorAll(".choice-option").forEach(function (btn) {
        btn.addEventListener("click", function () {
          const ok = btn.getAttribute("data-id") === target.id;
          results.push({ id: target.id, ok: ok });
          if (ok) {
            correct++;
            btn.classList.add("pulse-gold");
            advance();
          } else {
            btn.classList.add("shake-red");
            advance();
          }
        });
      });

      playAudio(target.audio, target.en, audioBox);
    }

    function advance() {
      index++;
      if (index >= 10) finishRound("choice", skin, correct, 10, results, startedAt);
      else setTimeout(round, 400);
    }

    round();
  }

  /* ——— Spelling ——— */
  function runSpellingPick(pack) {
    main.innerHTML =
      gameShell("Spelling", "Pick a spelling game.") +
      '<div class="skin-grid">' +
      '<button type="button" class="skin-card" data-skin="spellfire">Spellfire</button>' +
      '<button type="button" class="skin-card" data-skin="hangman">Hangman</button>' +
      '<button type="button" class="skin-card" data-skin="wordsearch">Word search</button>' +
      '<button type="button" class="skin-card" data-skin="crossword">Crossword</button>' +
      "</div>";
    bindQuit();
    main.querySelectorAll(".skin-card").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const skin = btn.getAttribute("data-skin");
        if (skin === "spellfire") runSpellfire(pack);
        else if (skin === "hangman") runHangman(pack);
        else if (skin === "wordsearch") runWordsearch(pack);
        else runCrossword(pack);
      });
    });
  }

  function runSpellfire(pack) {
    const words = pack.words.slice(0, 10);
    let wi = 0;
    let correct = 0;
    let misses = 0;
    const results = [];
    const startedAt = Date.now();
    const audioBox = document.createElement("div");
    let timerId;

    function round() {
      const w = words[wi];
      const letters = shuffle(w.en.split(""));
      let picked = [];
      let timeLeft = 100;

      main.innerHTML =
        gameShell("Spellfire", "Tap letters in order.", progressDots(wi, 10)) +
        '<div class="timer-bar"><div class="timer-fill" id="timer-fill"></div></div>' +
        '<div class="spell-answer" id="spell-ans"></div>' +
        '<div class="spell-tiles" id="tiles"></div>' +
        '<div id="audio-slot"></div>';
      main.querySelector("#audio-slot").appendChild(audioBox);
      bindQuit();

      const tilesEl = main.querySelector("#tiles");
      letters.forEach(function (ch, idx) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tile";
        b.textContent = ch;
        b.dataset.ch = ch;
        b.dataset.idx = String(idx);
        b.addEventListener("click", function () {
          if (b.classList.contains("used")) return;
          const expect = w.en[picked.length];
          if (ch === expect) {
            b.classList.add("used");
            picked.push(ch);
            main.querySelector("#spell-ans").textContent = picked.join("");
            if (picked.length === w.en.length) {
              clearInterval(timerId);
              correct++;
              results.push({ id: w.id, ok: true });
              nextWord();
            }
          } else {
            misses++;
            b.classList.add("shake-red");
          }
        });
        tilesEl.appendChild(b);
      });

      playAudio(w.audio, w.en, audioBox);
      const fill = main.querySelector("#timer-fill");
      timerId = setInterval(function () {
        timeLeft -= 2;
        fill.style.width = timeLeft + "%";
        if (timeLeft <= 0) {
          clearInterval(timerId);
          results.push({ id: w.id, ok: false });
          nextWord();
        }
      }, 200);
    }

    function nextWord() {
      wi++;
      if (wi >= words.length) {
        const scoreCorrect = correct;
        finishRound("spelling", "spellfire", scoreCorrect, 10, results, startedAt);
      } else round();
    }

    round();
  }

  function runHangman(pack) {
    const words = shuffle(pack.words.slice(0, 10));
    let wi = 0;
    let correctWords = 0;
    const results = [];
    const startedAt = Date.now();
    const audioBox = document.createElement("div");
    const art = ["", "  |", "  O", " /|", " /|\\", " /|\\", " /|\\\\n /", " /|\\\\n / \\"];

    function round() {
      const w = words[wi];
      let misses = 0;
      let guessed = new Set();
      const unique = Array.from(new Set(w.en.split("")));

      function drawBoard() {
        let display = w.en
          .split("")
          .map(function (c) {
            return guessed.has(c) ? c : "_";
          })
          .join(" ");
        const won = unique.every(function (c) {
          return guessed.has(c);
        });
        main.innerHTML =
          gameShell("Hangman", w.ko, progressDots(wi, 10)) +
          '<pre class="hangman-drawing">' +
          art[misses] +
          "</pre>" +
          '<p class="spell-answer">' +
          display +
          "</p>" +
          '<div class="keyboard" id="kb"></div>' +
          '<div id="audio-slot"></div>';
        main.querySelector("#audio-slot").appendChild(audioBox);
        bindQuit();
        const kb = main.querySelector("#kb");
        "abcdefghijklmnopqrstuvwxyz".split("").forEach(function (letter) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "key" + (guessed.has(letter) ? " guessed" : "");
          btn.textContent = letter;
          btn.disabled = guessed.has(letter);
          btn.addEventListener("click", function () {
            guessed.add(letter);
            if (!w.en.includes(letter)) misses++;
            if (misses >= 6) {
              results.push({ id: w.id, ok: false });
              setTimeout(nextWord, 600);
              return;
            }
            drawBoard();
            if (unique.every(function (c) {
              return guessed.has(c);
            })) {
              correctWords++;
              results.push({ id: w.id, ok: true });
              setTimeout(nextWord, 500);
            }
          });
          kb.appendChild(btn);
        });
        if (won) return;
      }

      audioBox.innerHTML = "";
      playAudio(w.audio, w.en, audioBox);
      drawBoard();
    }

    function nextWord() {
      wi++;
      if (wi >= 10) finishRound("spelling", "hangman", correctWords, 10, results, startedAt);
      else round();
    }

    round();
  }

  function runWordsearch(pack) {
    const pick = pack.words.slice(0, 5);
    const size = 8;
    const grid = Array.from({ length: size }, function () {
      return Array(size).fill("");
    });
    const dirs = [
      [0, 1],
      [1, 0],
    ];

    function placeWord(word) {
      for (let t = 0; t < 80; t++) {
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        const r = Math.floor(Math.random() * size);
        const c = Math.floor(Math.random() * size);
        const len = word.en.length;
        if (r + dir[0] * (len - 1) >= size || c + dir[1] * (len - 1) >= size) continue;
        if (r + dir[0] * (len - 1) < 0 || c + dir[1] * (len - 1) < 0) continue;
        let ok = true;
        for (let i = 0; i < len; i++) {
          const ch = grid[r + dir[0] * i][c + dir[1] * i];
          if (ch && ch !== word.en[i]) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        for (let i = 0; i < len; i++) {
          grid[r + dir[0] * i][c + dir[1] * i] = word.en[i];
        }
        return true;
      }
      return false;
    }

    pick.forEach(function (w) {
      placeWord(w);
    });
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!grid[r][c]) grid[r][c] = "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
      }
    }

    const found = new Set();
    let selecting = null;
    const startedAt = Date.now();

    function render() {
      let cells = "";
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          cells +=
            '<div class="ws-cell" data-r="' +
            r +
            '" data-c="' +
            c +
            '">' +
            grid[r][c].toUpperCase() +
            "</div>";
        }
      }
      main.innerHTML =
        gameShell("Word search", "Find 5 words (" + found.size + "/5).", "") +
        '<div class="wordsearch-grid" id="ws">' +
        cells +
        "</div>" +
        '<button type="button" class="btn" id="ws-done">Done</button>';
      bindQuit();
      main.querySelectorAll(".ws-cell").forEach(function (cell) {
        cell.addEventListener("click", function () {
          const r = +cell.dataset.r;
          const c = +cell.dataset.c;
          if (!selecting) {
            selecting = { r: r, c: c, path: [[r, c]] };
            cell.classList.add("sel");
          } else {
            selecting.path.push([r, c]);
            cell.classList.add("sel");
            const letters = selecting.path
              .map(function (p) {
                return grid[p[0]][p[1]];
              })
              .join("");
            const rev = letters.split("").reverse().join("");
            pick.forEach(function (w) {
              if ((letters === w.en || rev === w.en) && !found.has(w.id)) {
                found.add(w.id);
                main.querySelectorAll(".ws-cell.sel").forEach(function (x) {
                  x.classList.add("found");
                });
              }
            });
            selecting = null;
            if (found.size >= 5) finishWs();
            else render();
          }
        });
      });
      document.getElementById("ws-done").addEventListener("click", finishWs);
    }

    function finishWs() {
      const c = found.size;
      const results = pick.map(function (w) {
        return { id: w.id, ok: found.has(w.id) };
      });
      finishRound("spelling", "wordsearch", c, 5, results, startedAt);
    }

    render();
  }

  function runCrossword(pack) {
    const words = pack.words.slice(0, 5);
    const startedAt = Date.now();
    main.innerHTML =
      gameShell("Crossword", "Type the English word for each Korean clue.") +
      '<ol class="crossword-list" id="cw-list"></ol>' +
      '<button type="button" class="btn" id="cw-check">Check</button>';
    bindQuit();
    const list = main.querySelector("#cw-list");
    words.forEach(function (w, i) {
      const li = document.createElement("li");
      li.innerHTML =
        escapeHtml(w.ko) +
        '<input type="text" data-answer="' +
        escapeHtml(w.en) +
        '" autocomplete="off" />';
      list.appendChild(li);
    });
    document.getElementById("cw-check").addEventListener("click", function () {
      let correct = 0;
      const results = [];
      list.querySelectorAll("input").forEach(function (inp, i) {
        const ans = inp.getAttribute("data-answer").toLowerCase();
        const val = inp.value.trim().toLowerCase();
        const ok = val === ans;
        if (ok) correct++;
        results.push({ id: words[i].id, ok: ok });
      });
      finishRound("spelling", "crossword", correct, 5, results, startedAt);
    });
  }

  /* ——— Memory ——— */
  function runMemory(pack) {
    const pairs = pack.words.slice(0, 5);
    const cards = shuffle(
      pairs
        .map(function (w) {
          return { key: w.id, face: w.en, type: "en" };
        })
        .concat(
          pairs.map(function (w) {
            return { key: w.id, face: w.ko, type: "ko" };
          })
        )
    );
    let flipped = [];
    let matched = 0;
    let wrongFlips = 0;
    const startedAt = Date.now();
    const matchedSet = new Set();

    function render() {
      let html = gameShell("Memory", "Match English and Korean.", "") + '<div class="memory-grid">';
      cards.forEach(function (card, idx) {
        const isMatched = matchedSet.has(card.key + card.type);
        const isFlipped = flipped.indexOf(idx) >= 0 || isMatched;
        html +=
          '<button type="button" class="mem-card' +
          (isFlipped ? " flipped" : "") +
          (isMatched ? " matched" : "") +
          '" data-i="' +
          idx +
          '">' +
          (isFlipped ? escapeHtml(card.face) : "?") +
          "</button>";
      });
      html += "</div>";
      main.innerHTML = html;
      bindQuit();

      main.querySelectorAll(".mem-card").forEach(function (btn) {
        btn.addEventListener("click", function () {
          const i = +btn.dataset.i;
          const card = cards[i];
          if (matchedSet.has(card.key + card.type)) return;
          if (flipped.indexOf(i) >= 0) return;
          if (flipped.length === 1) {
            flipped.push(i);
            render();
            const a = cards[flipped[0]];
            const b = cards[flipped[1]];
            if (a.key === b.key && a.type !== b.type) {
              matchedSet.add(a.key + a.type);
              matchedSet.add(b.key + b.type);
              matched++;
              flipped = [];
              render();
              if (matched >= 5) {
                const denom = 5 + wrongFlips;
                finishRound(
                  "memory",
                  "",
                  5,
                  denom,
                  [{ pairs: 5, wrongFlips: wrongFlips }],
                  startedAt
                );
              }
            } else {
              wrongFlips++;
              setTimeout(function () {
                flipped = [];
                render();
              }, 700);
            }
          } else {
            flipped = [i];
            render();
          }
        });
      });
    }

    render();
  }

  /* ——— Order ——— */
  function runOrder(pack) {
    const sentences = pack.sentences.slice(0, 5);
    let si = 0;
    let correct = 0;
    const results = [];
    const startedAt = Date.now();
    let answer = [];

    function render() {
      const s = sentences[si];
      const chips = shuffle(s.chips.slice());
      answer = [];

      main.innerHTML =
        gameShell("Order", "Tap words in order.", progressDots(si, 5)) +
        '<p class="ko-gloss">' +
        escapeHtml(s.ko) +
        "</p>" +
        '<div class="answer-line" id="ans-line"></div>' +
        '<div class="chip-row" id="chips"></div>' +
        '<div class="order-actions">' +
        '<button type="button" class="btn btn-secondary" id="undo">Undo</button>' +
        '<button type="button" class="btn" id="check">Check</button></div>';
      bindQuit();

      const chipsEl = main.querySelector("#chips");
      chips.forEach(function (word) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = word;
        b.addEventListener("click", function () {
          if (b.classList.contains("used")) return;
          b.classList.add("used");
          answer.push(word);
          redrawAnswer();
        });
        chipsEl.appendChild(b);
      });

      document.getElementById("undo").addEventListener("click", function () {
        if (!answer.length) return;
        answer.pop();
        redrawChips();
        redrawAnswer();
      });

      document.getElementById("check").addEventListener("click", function () {
        const ok = answer.join(" ") === s.chips.join(" ");
        results.push({ id: s.id, ok: ok });
        if (ok) correct++;
        si++;
        if (si >= 5) finishRound("order", "", correct, 5, results, startedAt);
        else render();
      });
    }

    function redrawAnswer() {
      main.querySelector("#ans-line").innerHTML = answer
        .map(function (w) {
          return '<span class="chip">' + escapeHtml(w) + "</span>";
        })
        .join("");
    }

    function redrawChips() {
      const chipsEl = main.querySelector("#chips");
      const used = answer.slice();
      chipsEl.querySelectorAll(".chip").forEach(function (btn) {
        const t = btn.textContent;
        const idx = used.indexOf(t);
        if (idx >= 0) {
          btn.classList.add("used");
          used.splice(idx, 1);
        } else btn.classList.remove("used");
      });
    }

    render();
  }

  /* ——— Golden Bell ——— */
  function runBell(pack) {
    const words = pack.words.slice(0, 10);
    const sentences = pack.sentences.slice(0, 3);
    const items = [];
    shuffle(words)
      .slice(0, 4)
      .forEach(function (w) {
        items.push({ type: "pick", word: w });
      });
    shuffle(words)
      .slice(0, 3)
      .forEach(function (w) {
        items.push({ type: "spell", word: w });
      });
    sentences.slice(0, 3).forEach(function (s) {
      items.push({ type: "order", sentence: s });
    });
    const queue = shuffle(items).slice(0, 10);
    let qi = 0;
    let correct = 0;
    const results = [];
    const startedAt = Date.now();
    const audioBox = document.createElement("div");

    function ringBell() {
      const bell = main.querySelector(".bell-icon");
      if (bell) bell.classList.add("bell-ring");
      bellBeep();
    }

    function next() {
      qi++;
      if (qi >= 10) finishRound("bell", "bell", correct, 10, results, startedAt);
      else showItem();
    }

    function showItem() {
      const item = queue[qi];
      let inner =
        '<div class="bell-stage"><span class="bell-icon">🔔</span><div id="bell-body"></div><div id="audio-slot"></div></div>';
      main.innerHTML = gameShell("Golden Bell", "Finale round " + (qi + 1) + "/10", progressDots(qi, 10)) + inner;
      const body = main.querySelector("#bell-body");
      main.querySelector("#audio-slot").appendChild(audioBox);
      audioBox.innerHTML = "";
      bindQuit();

      if (item.type === "pick") {
        const target = item.word;
        const opts = shuffle(pack.words.slice(0, 10)).slice(0, 3);
        if (!opts.find(function (o) {
          return o.id === target.id;
        }))
          opts[0] = target;
        body.innerHTML = opts
          .map(function (o) {
            return (
              '<button type="button" class="btn" style="margin:0.35rem" data-id="' +
              o.id +
              '">' +
              escapeHtml(o.en) +
              "</button>"
            );
          })
          .join("");
        body.querySelectorAll("button").forEach(function (btn) {
          btn.addEventListener("click", function () {
            const ok = btn.getAttribute("data-id") === target.id;
            results.push({ type: "pick", id: target.id, ok: ok });
            if (ok) {
              correct++;
              ringBell();
            }
            setTimeout(next, ok ? 600 : 400);
          });
        });
        playAudio(target.audio, target.en, audioBox);
      } else if (item.type === "spell") {
        const w = item.word;
        let typed = "";
        body.innerHTML = '<p class="spell-answer" id="spell-out"></p><div class="bell-pad" id="pad"></div>';
        "abcdefghijklmnopqrstuvwxyz"
          .split("")
          .concat(["⌫", "OK"])
          .forEach(function (key) {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = key;
            b.addEventListener("click", function () {
              if (key === "⌫") typed = typed.slice(0, -1);
              else if (key === "OK") {
                const ok = typed.toLowerCase() === w.en.toLowerCase();
                results.push({ type: "spell", id: w.id, ok: ok });
                if (ok) {
                  correct++;
                  ringBell();
                }
                setTimeout(next, 500);
                return;
              } else typed += key;
              main.querySelector("#spell-out").textContent = typed;
            });
            main.querySelector("#pad").appendChild(b);
          });
        playAudio(w.audio, w.en, audioBox);
      } else {
        const s = item.sentence;
        let ans = [];
        const chips = shuffle(s.chips.slice());
        body.innerHTML =
          '<div class="answer-line" id="b-ans"></div><div class="chip-row" id="b-chips"></div>' +
          '<button type="button" class="btn" id="b-check">Check</button>';
        const row = main.querySelector("#b-chips");
        chips.forEach(function (word) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "chip";
          b.textContent = word;
          b.addEventListener("click", function () {
            if (b.classList.contains("used")) return;
            b.classList.add("used");
            ans.push(word);
            main.querySelector("#b-ans").innerHTML = ans
              .map(function (x) {
                return '<span class="chip">' + escapeHtml(x) + "</span>";
              })
              .join("");
          });
          row.appendChild(b);
        });
        main.querySelector("#b-check").addEventListener("click", function () {
          const ok = ans.join(" ") === s.chips.join(" ");
          results.push({ type: "order", id: s.id, ok: ok });
          if (ok) {
            correct++;
            ringBell();
          }
          setTimeout(next, 500);
        });
      }
    }

    showItem();
  }

  function bindQuit() {
    const q = document.getElementById("quit-game");
    if (q) q.addEventListener("click", renderPath);
  }

  function renderRecords() {
    if (!state.student) {
      renderLogin();
      return;
    }
    const rec = getStudentRecords();
    let rows = rec.summary
      .slice(0, 50)
      .map(function (s) {
        return (
          "<tr><td>" +
          escapeHtml(s.unit) +
          "</td><td>" +
          escapeHtml(s.station) +
          "</td><td>" +
          s.try +
          "</td><td>" +
          s.score +
          "%</td><td>" +
          escapeHtml(String(s.time).slice(0, 19)) +
          "</td></tr>"
        );
      })
      .join("");
    if (!rows) rows = '<tr><td colspan="5">No rounds yet.</td></tr>';

    main.innerHTML =
      '<div class="card">' +
      "<h2>Records</h2>" +
      '<p class="sub">' +
      escapeHtml(state.student.name) +
      " · no PIN shown</p>" +
      '<table class="records-table"><thead><tr><th>Unit</th><th>Station</th><th>Try</th><th>Score</th><th>Time</th></tr></thead><tbody>' +
      rows +
      "</tbody></table>" +
      '<button type="button" class="btn" id="rec-back">Back</button></div>';

    document.getElementById("rec-back").addEventListener("click", function () {
      if (state.pack) renderPath();
      else renderUnits();
    });
  }

  btnRecords.addEventListener("click", renderRecords);

  if (loadAccounts().length && !state.student) {
    renderLogin();
  } else {
    renderLogin();
  }
})();
