const MADE_ORDER = ["choice", "spelling", "memory"];
const PASS_LINE = 80;

function pass(scorePct) {
  return scorePct >= PASS_LINE;
}

/** First locked *made* station id, or null when choice/spelling/memory are all reachable. */
function nextMadeLocked(bestByStation) {
  for (let i = 1; i < MADE_ORDER.length; i++) {
    const prevId = MADE_ORDER[i - 1];
    const prevBest = bestByStation[prevId];
    if (prevBest === undefined || prevBest < PASS_LINE) {
      return MADE_ORDER[i];
    }
  }
  return null;
}

function tryNumber(attempts, unitId, stationId) {
  const n = attempts.filter(
    (a) => a.unit_id === unitId && a.station === stationId
  ).length;
  return n + 1;
}

function scorePct(correct, total) {
  if (!total) return null;
  return Math.round((correct / total) * 100);
}

function roundCounts(newRows, wordCount) {
  return newRows >= wordCount && wordCount >= 3;
}

const rulesApi = {
  MADE_ORDER,
  PASS_LINE,
  pass,
  nextMadeLocked,
  tryNumber,
  scorePct,
  roundCounts,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = rulesApi;
}

if (typeof window !== "undefined") {
  window.MRJRules = rulesApi;
}
