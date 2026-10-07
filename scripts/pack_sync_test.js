const pack = require("../js/pack-sync.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

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

assert(pack.idKey("  Jay  ") === "jay", "idKey normalizes");

const a1 = {
  unit_id: "u1",
  station: "choice",
  game: "frog",
  started_at: "t1",
  score_pct: 70,
  sheet: "pending",
};
const a2 = {
  unit_id: "u1",
  station: "choice",
  game: "frog",
  started_at: "t1",
  score_pct: 85,
  sheet: "saved",
};
const mergedAttempts = pack.mergeAttempts([a1], [a2]);
assert(mergedAttempts.length === 1, "mergeAttempts unions by key");
assert(mergedAttempts[0].score_pct === 85, "mergeAttempts keeps max score");
assert(mergedAttempts[0].sheet === "saved", "mergeAttempts keeps best sheet");

const local = pack.emptyPackBlob();
local.records.attempts.push({
  unit_id: "u1",
  station: "choice",
  game: "frog",
  started_at: "only-local",
  score_pct: 90,
});
const remote = pack.emptyPackBlob();
remote.records.attempts.push({
  unit_id: "u2",
  station: "spelling",
  game: "spellfire",
  started_at: "only-remote",
  score_pct: 80,
});
const merged = pack.mergePackBlob(local, remote);
assert(merged.records.attempts.length === 2, "mergePackBlob unions attempts");

const gate = pack.createSaveGate();
const noAuth = {};
assert(pack.canRemoteSave(gate, noAuth) === false, "cannot save before load finishes");
gate.loadFinished = true;
gate.loadOk = true;
const authNoReady = {
  savePack() {
    return Promise.resolve({ ok: true });
  },
  packReady() {
    return false;
  },
};
assert(
  pack.canRemoteSave(gate, authNoReady) === false,
  "cannot save when packReady is false"
);
const authReady = {
  savePack() {
    return Promise.resolve({ ok: true });
  },
  packReady() {
    return true;
  },
};
assert(pack.canRemoteSave(gate, authReady) === true, "can save when loaded and packReady");

const store = mockStorage();
const OLD_RECORDS = pack.RECORDS_KEY_BASE;
store.setItem(
  OLD_RECORDS,
  JSON.stringify({
    shared: { attempts: [{ unit_id: "old", station: "x", game: "y", started_at: "z" }], opens: [] },
  })
);
const keyed = pack.readLocalPackBlob(store, "jay");
assert(keyed.records.attempts.length === 0, "unkeyed legacy records are not imported");
assert(store.getItem(OLD_RECORDS) != null, "legacy records key left untouched");

const studentKey = "jay";
pack.writeLocalPackBlob(store, studentKey, merged);
const keyedAfter = pack.readLocalPackBlob(store, studentKey);
assert(keyedAfter.records.attempts.length === 2, "per-student keyed storage round-trips");

assert(
  pack.packRicherThan(merged, remote) === true,
  "merged blob is richer than server-only baseline"
);

const bad = pack.parsePackJson("{not json");
assert(pack.packWeight(bad) === 0, "unparseable server JSON becomes empty pack");

const withQueue = pack.emptyPackBlob();
withQueue.sheetQueue = [{ attempt: { unit_id: "u", station: "c", game: "f", started_at: "q" } }];
const serialized = pack.serializePackBlob(withQueue);
assert(serialized.indexOf("sheetQueue") < 0, "serializePackBlob excludes sheet queue");

const serverWithQueue = pack.parsePackJson(
  JSON.stringify({
    records: { attempts: [{ unit_id: "srv", station: "x", game: "y", started_at: "s1" }], opens: [] },
    stamps: [],
    sheetQueue: [{ attempt: { unit_id: "ghost", station: "q", game: "q", started_at: "gone" } }],
  })
);
const localOnlyQueue = pack.readLocalPackBlob(store, studentKey);
store.setItem(
  pack.keyedStorageKey(pack.SHEET_QUEUE_KEY_BASE, studentKey),
  JSON.stringify([{ queued_at: "device-only" }])
);
const mergedNoQueue = pack.mergePackBlob(localOnlyQueue, serverWithQueue);
assert(
  mergedNoQueue.records.attempts.some(function (a) {
    return a.unit_id === "srv";
  }),
  "server attempts still merge"
);
assert(
  !mergedNoQueue.records.attempts.some(function (a) {
    return a.unit_id === "ghost";
  }),
  "server sheetQueue items are not merged into records"
);
pack.writeLocalPackBlob(store, studentKey, mergedNoQueue);
const queueAfterWrite = JSON.parse(
  store.getItem(pack.keyedStorageKey(pack.SHEET_QUEUE_KEY_BASE, studentKey)) || "[]"
);
assert(queueAfterWrite.length === 1 && queueAfterWrite[0].queued_at === "device-only", "writeLocalPackBlob preserves device sheet queue");

const serverMid = pack.emptyPackBlob();
serverMid.records.attempts.push({
  unit_id: "remote",
  station: "choice",
  game: "frog",
  started_at: "r1",
  score_pct: 50,
});
const staleLocal = pack.emptyPackBlob();
staleLocal.records.attempts.push({
  unit_id: "before-load",
  station: "choice",
  game: "frog",
  started_at: "b1",
  score_pct: 60,
});
const freshLocal = pack.emptyPackBlob();
freshLocal.records.attempts.push({
  unit_id: "before-load",
  station: "choice",
  game: "frog",
  started_at: "b1",
  score_pct: 60,
});
freshLocal.records.attempts.push({
  unit_id: "during-load",
  station: "spelling",
  game: "spellfire",
  started_at: "d1",
  score_pct: 90,
});
const wrongMerge = pack.mergePackBlob(staleLocal, serverMid);
const rightMerge = pack.mergePackBlob(freshLocal, serverMid);
assert(
  !wrongMerge.records.attempts.some(function (a) {
    return a.unit_id === "during-load";
  }),
  "stale pre-load snapshot loses in-flight work"
);
assert(
  rightMerge.records.attempts.some(function (a) {
    return a.unit_id === "during-load";
  }),
  "re-read local after load keeps in-flight work"
);

const saved = pack.serializePackBlob(rightMerge);
assert(pack.remotePackDirty(rightMerge, saved) === false, "not dirty after marking saved snapshot");
assert(pack.remotePackDirty(freshLocal, saved) === true, "dirty when local differs from last saved");

console.log("PACK_SYNC_OK");
