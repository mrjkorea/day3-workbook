/**
 * Day 3 workbook — ClassroomMetrics body + SSI noteScore helpers (testable).
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.MRJDay3ScoreLog = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const GAME_RECORD_KEYS = {
    frog: "mrj-leap-frog-records-v1",
    snow: "mrj-ski-jump-records-v1",
    spellfire: "mrj.firefighter_spelling.records",
  };

  function idKey(s) {
    return String(s == null ? "" : s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function studentIdKey(name, auth) {
    if (auth && typeof auth.idKey === "function") {
      return auth.idKey(name);
    }
    return idKey(name);
  }

  function localDateStr(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function itemIdFromAttempt(attempt) {
    return (
      String(attempt.unit_id || "") +
      ":" +
      String(attempt.station || "") +
      ":" +
      String(attempt.game || "")
    );
  }

  function buildCmBody(attempt, opts) {
    const name = String(
      attempt && attempt.student_name != null ? attempt.student_name : ""
    ).trim();
    const key = studentIdKey(name, opts && opts.auth);
    const endedAt = attempt.ended_at ? new Date(attempt.ended_at) : new Date();
    const dateStr = localDateStr(endedAt);
    const meta = JSON.stringify({
      student_name: name,
      station: attempt.station,
      game: attempt.game,
    });
    const appBuild = (opts && opts.appBuild) || "dev";
    const eventId =
      opts && typeof opts.makeEventId === "function"
        ? opts.makeEventId()
        : "day3-test-event";
    const passFn =
      opts && typeof opts.pass === "function"
        ? opts.pass
        : function (pct) {
            return pct >= 80;
          };

    return {
      student_email: key,
      session_id: "day3-" + key + "-" + dateStr,
      events: [
        {
          event_id: eventId,
          event_kind: "learning_result",
          source: "mrj-day3",
          curriculum_program: "conversation",
          subject: "conversation",
          app_name: "MRJ Day 3",
          book_title: attempt.unit_title,
          unit_id: attempt.unit_id,
          item_id: itemIdFromAttempt(attempt),
          item_type: "game",
          score_value: attempt.correct,
          score_max: attempt.total,
          score_pct: attempt.score_pct,
          correctness: passFn(attempt.score_pct) ? "correct" : "incorrect",
          completed: true,
          local_date: dateStr,
          identity_method: "mrj_signin",
          identity_confidence: "high",
          schema_version: "5.0",
          tracker_version: "day3-map-2-" + appBuild,
          metadata_json: meta,
        },
      ],
    };
  }

  function buildNoteScorePayload(attempt) {
    const endedAt = attempt.ended_at ? new Date(attempt.ended_at) : new Date();
    return {
      program: "day3-workbook",
      itemId: itemIdFromAttempt(attempt),
      scoreValue: attempt.correct,
      scoreMax: attempt.total,
      scorePct: attempt.score_pct,
      localDate: localDateStr(endedAt),
    };
  }

  async function invokeNoteScoreOnce(attempt, opts) {
    const auth = opts && opts.auth;
    const currentStudent =
      opts && opts.currentStudent != null ? String(opts.currentStudent).trim() : "";
    if (!auth || typeof auth.noteScore !== "function") return false;
    const name = String(
      attempt && attempt.student_name != null ? attempt.student_name : ""
    ).trim();
    if (!name || !currentStudent || name !== currentStudent) return false;
    const signed =
      opts && typeof opts.authStudent === "function"
        ? String(opts.authStudent() || "").trim()
        : auth.student
          ? String(auth.student() || "").trim()
          : name;
    if (signed && signed !== name) return false;
    await auth.noteScore(buildNoteScorePayload(attempt));
    return true;
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

  function parseGameRecords(raw) {
    if (raw == null) return [];
    let parsed = raw;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.records)) return parsed.records;
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
    return [];
  }

  function recordStorageKeys(game, studentKey) {
    const base = GAME_RECORD_KEYS[game];
    if (!base) return [];
    const k = idKey(studentKey);
    if (!k) return [base];
    return [base + "." + k, base];
  }

  function newRowsForStamp(getItem, game, studentName, studentKey, sinceMs) {
    const keys = recordStorageKeys(game, studentKey);
    const legacyKey = keys[keys.length - 1];
    for (let i = 0; i < keys.length; i++) {
      const storageKey = keys[i];
      const isKeyed = storageKey !== legacyKey;
      const rows = parseGameRecords(getItem(storageKey));
      if (!rows.length) continue;
      const filtered = rows.filter(function (row) {
        if (!isKeyed) {
          const sid = row.student_id ?? row.student ?? "";
          if (sid !== studentName) return false;
        }
        return rowTime(row) > sinceMs;
      });
      if (filtered.length) return filtered;
    }
    return [];
  }

  function isRowCorrect(row) {
    if (row.correct === true || row.correct === 1) return true;
    if (row.correct === false || row.correct === 0) return false;
    return null;
  }

  function scoreFromRows(rows) {
    let correct = 0;
    let total = 0;
    rows.forEach(function (row) {
      const c = isRowCorrect(row);
      if (c === null) return;
      total += 1;
      if (c) correct += 1;
    });
    return { correct, total };
  }

  return {
    GAME_RECORD_KEYS: GAME_RECORD_KEYS,
    idKey: idKey,
    studentIdKey: studentIdKey,
    localDateStr: localDateStr,
    itemIdFromAttempt: itemIdFromAttempt,
    buildCmBody: buildCmBody,
    buildNoteScorePayload: buildNoteScorePayload,
    invokeNoteScoreOnce: invokeNoteScoreOnce,
    recordStorageKeys: recordStorageKeys,
    parseGameRecords: parseGameRecords,
    newRowsForStamp: newRowsForStamp,
    scoreFromRows: scoreFromRows,
    rowTime: rowTime,
  };
});
