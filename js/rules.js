const STATIONS = ["hotspot", "choice", "spelling", "memory", "order", "bell"];

function pass(scorePct) {
  return scorePct >= 80;
}

function nextLocked(bestByStation) {
  for (let i = 0; i < STATIONS.length; i++) {
    const sid = STATIONS[i];
    const best = bestByStation[sid];
    if (best === undefined || best < 80) {
      if (best !== undefined && best < 80) {
        for (let j = i + 1; j < STATIONS.length; j++) {
          const prevStation = STATIONS[j - 1];
          const prevBest = bestByStation[prevStation];
          if (prevBest === undefined || prevBest < 80) {
            return STATIONS[j];
          }
        }
        return STATIONS[i + 1] || null;
      }
      return sid;
    }
  }
  return null;
}

function tryNumber(attempts, unitId, stationId) {
  const n = attempts.filter(
    (a) => a.unit_id === unitId && a.activity_id === stationId
  ).length;
  return n + 1;
}

function scorePct(correct, total) {
  if (!total) return 0;
  return Math.round((correct / total) * 100);
}

function outsidePack(itemIds, packIds) {
  const set = new Set(packIds);
  return itemIds.filter((id) => !set.has(id));
}

const rulesApi = {
  STATIONS,
  pass,
  nextLocked,
  tryNumber,
  scorePct,
  outsidePack,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = rulesApi;
}

if (typeof window !== "undefined") {
  window.MRJRules = rulesApi;
}
