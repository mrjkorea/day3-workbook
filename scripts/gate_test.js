const rules = require("../js/rules.js");
const ba = require("../packs/ba_u01.json");
const body = require("../packs/body_demo.json");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

assert(rules.pass(79) === false, "79 should fail");
assert(rules.pass(80) === true, "80 should pass");

const afterHotspot = { hotspot: 80 };
assert(rules.nextLocked(afterHotspot) === "choice", "hotspot pass unlocks choice");

const choice70 = { hotspot: 80, choice: 70 };
assert(
  rules.nextLocked(choice70) === "spelling",
  "70 on choice keeps spelling locked"
);

const attempts = [
  { unit_id: "ba_u01", activity_id: "hotspot" },
  { unit_id: "ba_u01", activity_id: "hotspot" },
];
assert(rules.tryNumber(attempts, "ba_u01", "hotspot") === 3, "tryNumber increments");

const packIds = ba.words.map((w) => w.id);
const bodyIds = body.words.map((w) => w.id);
const outside = rules.outsidePack(bodyIds, packIds);
assert(outside.length > 0, "body item outside numbers pack");
assert(
  bodyIds.some((id) => outside.includes(id)),
  "a body item id is outside the numbers pack"
);

assert(rules.scorePct(8, 10) === 80, "scorePct 8/10");
assert(rules.scorePct(7, 10) === 70, "scorePct 7/10");

console.log("GATE_OK");
process.exit(0);
