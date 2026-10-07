const rules = require("../js/rules.js");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

assert(rules.pass(79) === false, "79 should fail");
assert(rules.pass(80) === true, "80 should pass");

const choice70 = { choice: 70 };
assert(
  rules.nextMadeLocked(choice70) === "spelling",
  "70 on choice keeps spelling locked"
);

const choice80 = { choice: 80 };
assert(
  rules.nextMadeLocked(choice80) === "memory",
  "80 on choice unlocks spelling (memory still locked until spelling passes)"
);
assert(
  rules.nextMadeLocked({ choice: 80, spelling: 80 }) === null,
  "80 on choice and spelling unlocks all made stations"
);

assert(
  rules.nextMadeLocked({}) === "spelling",
  "missing choice score keeps spelling locked"
);

assert(
  rules.nextMadeLocked({ hotspot: 80, order: 80, bell: 80 }) === "spelling",
  "hotspot / order / bell are not required to unlock choice path"
);

assert(rules.scorePct(0, 0) === null, "scorePct(0,0) is null");
assert(rules.scorePct(8, 10) === 80, "scorePct 8/10");

assert(rules.roundCounts(2, 10) === false, "roundCounts(2,10) false");
assert(rules.roundCounts(10, 10) === true, "roundCounts(10,10) true");

const attempts = [
  { unit_id: "basic_a_u1", station: "choice" },
  { unit_id: "basic_a_u1", station: "choice" },
];
assert(
  rules.tryNumber(attempts, "basic_a_u1", "choice") === 3,
  "tryNumber increments"
);

require("./pack_sync_test.js");

console.log("GATE_OK");
process.exit(0);
