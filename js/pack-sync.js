/**
 * Day 3 workbook — local pack blob + merge for MRJ_AUTH loadPack/savePack.
 * Program key: day3-workbook
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.MRJDay3PackSync = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PACK_PROGRAM = "day3-workbook";
  const PACK_BLOB_VERSION = 1;
  const SAVE_THROTTLE_MS = 17000;

  const RECORDS_KEY_BASE = "mrj.day3.records.v1";
  const STAMPS_KEY_BASE = "mrj.day3.stamps.v1";
  const SHEET_QUEUE_KEY_BASE = "mrj.day3.sheetQueue";

  function idKey(id) {
    return String(id == null ? "" : id)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function keyedStorageKey(base, studentKey) {
    const k = idKey(studentKey);
    if (!k) return base;
    return base + ":" + k;
  }

  function emptyPackBlob() {
    return {
      v: PACK_BLOB_VERSION,
      records: { attempts: [], opens: [] },
      stamps: [],
      sheetQueue: [],
    };
  }

  function normalizeRecords(records) {
    if (!records || typeof records !== "object") {
      return { attempts: [], opens: [] };
    }
    return {
      attempts: Array.isArray(records.attempts) ? records.attempts : [],
      opens: Array.isArray(records.opens) ? records.opens : [],
    };
  }

  function normalizePackBlob(raw) {
    if (!raw || typeof raw !== "object") return emptyPackBlob();
    return {
      v: PACK_BLOB_VERSION,
      records: normalizeRecords(raw.records),
      stamps: Array.isArray(raw.stamps) ? raw.stamps : [],
      sheetQueue: Array.isArray(raw.sheetQueue) ? raw.sheetQueue : [],
    };
  }

  function parsePackJson(progressJson) {
    const text = progressJson == null ? "" : String(progressJson).trim();
    if (!text) return emptyPackBlob();
    try {
      return normalizePackBlob(JSON.parse(text));
    } catch {
      return emptyPackBlob();
    }
  }

  function attemptKey(a) {
    if (!a) return "";
    return [
      a.unit_id,
      a.station,
      a.game,
      a.started_at,
    ]
      .map(function (x) {
        return x == null ? "" : String(x);
      })
      .join("|");
  }

  function sheetRank(status) {
    if (status === "saved") return 3;
    if (status === "sent, not confirmed") return 2;
    if (status === "pending") return 1;
    return 0;
  }

  function mergeAttemptRow(a, b) {
    if (!a) return b;
    if (!b) return a;
    const out = Object.assign({}, a, b);
    const scoreA = a.score_pct == null ? -1 : Number(a.score_pct);
    const scoreB = b.score_pct == null ? -1 : Number(b.score_pct);
    if (scoreB > scoreA) {
      out.score_pct = b.score_pct;
      out.correct = b.correct;
      out.total = b.total;
    } else if (scoreA > scoreB) {
      out.score_pct = a.score_pct;
      out.correct = a.correct;
      out.total = a.total;
    }
    if (sheetRank(b.sheet) > sheetRank(a.sheet)) out.sheet = b.sheet;
    else if (sheetRank(a.sheet) > sheetRank(b.sheet)) out.sheet = a.sheet;
    return out;
  }

  function mergeAttempts(localList, remoteList) {
    const map = {};
    function add(row) {
      const key = attemptKey(row);
      if (!key) return;
      map[key] = mergeAttemptRow(map[key], row);
    }
    (localList || []).forEach(add);
    (remoteList || []).forEach(add);
    return Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      .sort(function (a, b) {
        const ta = Date.parse(a.ended_at || a.started_at || "") || 0;
        const tb = Date.parse(b.ended_at || b.started_at || "") || 0;
        return ta - tb;
      });
  }

  function openKey(o) {
    if (!o) return "";
    if (o.key) return String(o.key);
    return [o.unit_id, o.station, o.game, o.opened_at].join("|");
  }

  function mergeOpens(localList, remoteList) {
    const map = {};
    function add(row) {
      const key = openKey(row);
      if (!key) return;
      map[key] = map[key] ? Object.assign({}, map[key], row) : Object.assign({}, row);
    }
    (localList || []).forEach(add);
    (remoteList || []).forEach(add);
    return Object.values(map);
  }

  function stampKey(s) {
    if (!s) return "";
    return [
      s.studentName,
      s.unitId,
      s.station,
      s.game,
      s.startedAt,
    ]
      .map(function (x) {
        return x == null ? "" : String(x);
      })
      .join("|");
  }

  function mergeStamps(localList, remoteList) {
    const map = {};
    function add(row) {
      const key = stampKey(row);
      if (!key) return;
      const prev = map[key];
      if (!prev) {
        map[key] = Object.assign({}, row);
        return;
      }
      const keep =
        Number(row.stampMs || 0) >= Number(prev.stampMs || 0) ? row : prev;
      map[key] = Object.assign({}, prev, row, keep);
    }
    (localList || []).forEach(add);
    (remoteList || []).forEach(add);
    return Object.values(map);
  }

  function queueKey(item) {
    if (!item || !item.attempt) return "";
    const a = item.attempt;
    return attemptKey(a) + "|" + String(item.queued_at || "");
  }

  function mergeSheetQueue(localList, remoteList) {
    const map = {};
    function add(row) {
      const key = queueKey(row) || JSON.stringify(row);
      map[key] = row;
    }
    (localList || []).forEach(add);
    (remoteList || []).forEach(add);
    return Object.values(map);
  }

  function mergePackBlob(localBlob, remoteBlob) {
    const local = normalizePackBlob(localBlob);
    const remote = normalizePackBlob(remoteBlob);
    return {
      v: PACK_BLOB_VERSION,
      records: {
        attempts: mergeAttempts(local.records.attempts, remote.records.attempts),
        opens: mergeOpens(local.records.opens, remote.records.opens),
      },
      stamps: mergeStamps(local.stamps, remote.stamps),
      sheetQueue: mergeSheetQueue(local.sheetQueue, remote.sheetQueue),
    };
  }

  function packWeight(blob) {
    const b = normalizePackBlob(blob);
    return (
      b.records.attempts.length +
      b.records.opens.length +
      b.stamps.length +
      b.sheetQueue.length
    );
  }

  function packRicherThan(candidate, baseline) {
    return packWeight(candidate) > packWeight(baseline);
  }

  function serializePackBlob(blob) {
    return JSON.stringify(normalizePackBlob(blob));
  }

  function readLocalPackBlob(storage, studentKey) {
    const store = storage || null;
    if (!store || !studentKey) return emptyPackBlob();
    const recordsKey = keyedStorageKey(RECORDS_KEY_BASE, studentKey);
    const stampsKey = keyedStorageKey(STAMPS_KEY_BASE, studentKey);
    const queueKeyName = keyedStorageKey(SHEET_QUEUE_KEY_BASE, studentKey);
    let records = { attempts: [], opens: [] };
    let stamps = [];
    let sheetQueue = [];
    try {
      const rawRec = store.getItem(recordsKey);
      if (rawRec) {
        const parsed = JSON.parse(rawRec);
        if (parsed && parsed.attempts) {
          records = normalizeRecords(parsed);
        } else if (parsed && typeof parsed === "object") {
          const name = String(studentKey).trim();
          const bucket = parsed[name] || parsed[idKey(name)];
          if (bucket) records = normalizeRecords(bucket);
        }
      }
    } catch {
      records = { attempts: [], opens: [] };
    }
    try {
      stamps = JSON.parse(store.getItem(stampsKey) || "[]");
      if (!Array.isArray(stamps)) stamps = [];
    } catch {
      stamps = [];
    }
    try {
      sheetQueue = JSON.parse(store.getItem(queueKeyName) || "[]");
      if (!Array.isArray(sheetQueue)) sheetQueue = [];
    } catch {
      sheetQueue = [];
    }
    return normalizePackBlob({
      records: records,
      stamps: stamps,
      sheetQueue: sheetQueue,
    });
  }

  function writeLocalPackBlob(storage, studentKey, blob) {
    const store = storage || null;
    if (!store || !studentKey) return;
    const b = normalizePackBlob(blob);
    const recordsKey = keyedStorageKey(RECORDS_KEY_BASE, studentKey);
    const stampsKey = keyedStorageKey(STAMPS_KEY_BASE, studentKey);
    const queueKeyName = keyedStorageKey(SHEET_QUEUE_KEY_BASE, studentKey);
    store.setItem(recordsKey, JSON.stringify(b.records));
    store.setItem(stampsKey, JSON.stringify(b.stamps));
    store.setItem(queueKeyName, JSON.stringify(b.sheetQueue));
  }

  function createSaveGate() {
    return {
      loadFinished: false,
      loadOk: false,
      program: PACK_PROGRAM,
    };
  }

  function canRemoteSave(gate, auth) {
    if (!gate || !gate.loadFinished || !gate.loadOk) return false;
    if (!auth || typeof auth.savePack !== "function") return false;
    if (typeof auth.packReady === "function" && !auth.packReady(gate.program)) {
      return false;
    }
    return true;
  }

  function authIdKey(auth, displayId) {
    if (auth && auth._test && auth._test.idKey) {
      return auth._test.idKey(displayId);
    }
    if (typeof globalThis !== "undefined" && globalThis.MRJAuthRules && globalThis.MRJAuthRules.idKey) {
      return globalThis.MRJAuthRules.idKey(displayId);
    }
    return idKey(displayId);
  }

  return {
    PACK_PROGRAM: PACK_PROGRAM,
    SAVE_THROTTLE_MS: SAVE_THROTTLE_MS,
    RECORDS_KEY_BASE: RECORDS_KEY_BASE,
    STAMPS_KEY_BASE: STAMPS_KEY_BASE,
    SHEET_QUEUE_KEY_BASE: SHEET_QUEUE_KEY_BASE,
    idKey: idKey,
    keyedStorageKey: keyedStorageKey,
    emptyPackBlob: emptyPackBlob,
    parsePackJson: parsePackJson,
    normalizePackBlob: normalizePackBlob,
    mergePackBlob: mergePackBlob,
    packRicherThan: packRicherThan,
    packWeight: packWeight,
    serializePackBlob: serializePackBlob,
    readLocalPackBlob: readLocalPackBlob,
    writeLocalPackBlob: writeLocalPackBlob,
    createSaveGate: createSaveGate,
    canRemoteSave: canRemoteSave,
    authIdKey: authIdKey,
    mergeAttempts: mergeAttempts,
  };
});
