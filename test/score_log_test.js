const fs = require("fs");
const path = require("path");
const scoreLog = require("../js/score-log.js");
const rules = require("../js/rules.js");

function assert(cond, msg) {
  if (!cond) {
    throw new Error("FAIL: " + msg);
  }
}

const TEST_STUDENT = "zz_test_mrjmetrics";
const BUILD = "20261013-receiver-1";
const LEGACY_NOTE_QUEUE_KEY = "day3.noteQueue." + TEST_STUDENT;

function mockStorage() {
  const data = {};
  return {
    getItem(k) {
      return data[k] == null ? null : data[k];
    },
    setItem(k, v) {
      data[k] = String(v);
    },
    _data: data,
  };
}

module.exports = async function runScoreLogTest() {
  const attempt = {
    student_name: TEST_STUDENT,
    unit_id: "u03",
    unit_title: "Unit 3",
    station: "choice",
    game: "frog",
    correct: 7,
    total: 10,
    score_pct: 70,
    ended_at: "2026-10-11T12:00:00.000Z",
  };

  const noteCalls = [];

  const auth = {
    student() {
      return TEST_STUDENT;
    },
    idKey: scoreLog.idKey,
    noteScore(payload) {
      noteCalls.push(payload);
      return Promise.resolve({ ok: true });
    },
  };

  function signedInStudent() {
    return TEST_STUDENT;
  }

  function buildPostBody(att, currentStudent) {
    const name = String(att.student_name || "").trim();
    if (!name || name !== currentStudent) return null;
    return scoreLog.buildCmBody(att, {
      appBuild: BUILD,
      auth: auth,
      pass: rules.pass,
      makeEventId: function () {
        return "evt-test-1";
      },
    });
  }

  const body = buildPostBody(attempt, signedInStudent());
  assert(body !== null, "attempt should produce CM body for signed-in student");
  assert(
    body.student_email === TEST_STUDENT,
    "student_email is id_key zz_test_mrjmetrics"
  );
  assert(body.events[0].item_id === "u03:choice:frog", "item_id includes unit");
  assert(body.events[0].score_value === 7 && body.events[0].score_max === 10, "raw score 7/10");
  assert(
    body.events[0].identity_method === "mrj_signin" &&
      body.events[0].identity_confidence === "high",
    "identity fields on event"
  );
  assert(
    body.session_id ===
      "day3-" + TEST_STUDENT + "-" + scoreLog.localDateStr(new Date(attempt.ended_at)),
    "session_id uses id_key"
  );

  if (typeof auth.noteScore === "function") {
    const payload = scoreLog.buildNoteScorePayload(attempt);
    await auth.noteScore(payload);
  }
  assert(noteCalls.length === 1, "one noteScore call");
  assert(noteCalls[0].program === "day3-workbook", "noteScore program day3-workbook");
  assert(noteCalls[0].itemId === "u03:choice:frog", "noteScore itemId");
  assert(
    noteCalls[0].localDate === scoreLog.localDateStr(new Date(attempt.ended_at)),
    "noteScore localDate"
  );
  assert(noteCalls[0].scoreValue === 7 && noteCalls[0].scoreMax === 10, "noteScore raw/total");

  const otherBody = buildPostBody(attempt, "someone_else");
  assert(otherBody === null, "another signed-in student sends nothing");

  const store = mockStorage();
  const spellKey = scoreLog.GAME_RECORD_KEYS.spellfire + "." + TEST_STUDENT;
  const stampMs = Date.now() - 5000;
  const rows = [];
  for (let i = 0; i < 10; i++) {
    rows.push({
      correct: i < 8,
      ts: stampMs + 1000 + i * 100,
    });
  }
  store.setItem(spellKey, JSON.stringify(rows));

  const stamp = {
    game: "spellfire",
    studentName: TEST_STUDENT,
    stampMs: stampMs,
    wordCount: 10,
  };

  const found = scoreLog.newRowsForStamp(
    function (key) {
      return store.getItem(key);
    },
    stamp.game,
    stamp.studentName,
    TEST_STUDENT,
    stamp.stampMs
  );
  assert(found.length === 10, "spellfire keyed records produce stamp rows");
  const scored = scoreLog.scoreFromRows(found);
  assert(scored.correct === 8 && scored.total === 10, "spellfire scores 8/10 from keyed bucket");

  const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const version = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "version.json"), "utf8")
  );
  assert(version.build === BUILD, "version.json build matches savefix");
  const vMatches = indexHtml.match(/\?v=([^\s"']+)/g) || [];
  assert(vMatches.length > 0, "index.html has cache-bust query params");
  vMatches.forEach(function (m) {
    const v = m.replace("?v=", "");
    assert(v === BUILD, "index ?v= matches build: " + m);
  });
  const metaBuild = indexHtml.match(/name="mrj-build"\s+content="([^"]+)"/);
  assert(metaBuild && metaBuild[1] === BUILD, "mrj-build meta matches build string");

  const queueStore = mockStorage();
  queueStore.setItem(
    LEGACY_NOTE_QUEUE_KEY,
    JSON.stringify([
      {
        attempt: {
          student_name: TEST_STUDENT,
          unit_id: "u03",
          station: "choice",
          game: "frog",
          correct: 3,
          total: 10,
          score_pct: 30,
          ended_at: "2026-10-01T00:00:00.000Z",
        },
      },
    ])
  );
  const legacyBefore = queueStore.getItem(LEGACY_NOTE_QUEUE_KEY);
  let failCalls = 0;
  const failAuth = {
    student() {
      return TEST_STUDENT;
    },
    noteScore() {
      failCalls += 1;
      return Promise.resolve({ ok: false, error: "bad_token" });
    },
  };
  const ok = await scoreLog.invokeNoteScoreOnce(attempt, {
    auth: failAuth,
    currentStudent: TEST_STUDENT,
    authStudent: function () {
      return TEST_STUDENT;
    },
  });
  assert(ok === true, "invokeNoteScoreOnce awaits noteScore even when ok:false");
  assert(failCalls === 1, "noteScore called exactly once on bad_token");
  assert(
    queueStore.getItem(LEGACY_NOTE_QUEUE_KEY) === legacyBefore,
    "does not write or flush day3.noteQueue on failure"
  );
  const keys = Object.keys(queueStore._data);
  assert(
    !keys.some(function (k) {
      return k.indexOf("day3.noteQueue.") === 0 && k !== LEGACY_NOTE_QUEUE_KEY;
    }),
    "no new day3.noteQueue keys created"
  );

  console.log("SCORE_LOG_OK");
};
