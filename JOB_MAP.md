# Day 3 map — rewrite the page. Do not rebuild the games.

You are rewriting the static phone web app in THIS folder. `index.html` at the repo root. No React. No build step. No node_modules. No phone-OS speech. No speechSynthesis.

Jay already rejected the homemade games. Delete them from the page. Do not keep Frog / Snow / Space / Spellfire / Hangman / Word search / Crossword / Memory / Golden Bell engines in js/app.js. Those were the mistake.

## What this page is

A map students can move through. The insides that are not made yet are doors, not games. The insides that already exist are links to the live GitHub games, with that unit's words.

## Login

First name + 4-digit PIN. Saved only on this phone (`localStorage` key `mrj.day3.accounts`). Same name+PIN opens the same record. Never put the PIN in a URL, a game link, or the Google Sheet.

## Unit picker

One map. The unit changes the word pack in the links. Do not draw 73 pictures. Do not invent unit words.

Word lists already exist:

`https://mrjkorea.github.io/day2-words/packs/{id}.json`

Shape: `{ id, title, book, unit, words: [{ id, en, ko, l1 }] }`

Write `packs/units.json` by fetching the live day2 pack list (json files under `packs/*.json` on https://github.com/mrjkorea/day2-words, not the folders). Each row: `id`, `title`, `book`, `unit`, `pack_url`. If a fetch fails, skip that file. Do not invent titles.

## The map

Phone first. Cream background, navy `#10243f`, gold `#e0a106`. A winding path with big tappable stations. Short English. Header: `MRJ English · Day 3`. A **Records** button on every screen, including the map, the unit list, and a Later door.

Stations, in this order, on the path:

1. Hotspot — Later. Not a game. Not a picture you draw.
2. Choice — three real links. Student picks one.
3. Spelling — Spellfire is a real link. Hangman, Word search, Crossword are Later doors on the same station.
4. Memory — real link.
5. Sentence order — Later.
6. Golden Bell — Later.

A Later door says **Later** and does not play. It does not block the next station. If Hotspot blocked the path, no one could open the real games.

## 80% lock

Pass line is 80. 79 does not pass.

Made stations, in order: Choice → Spelling (Spellfire only) → Memory.

The next made station stays locked until the previous made station has a real best score of 80 or more for this student and this unit. Later doors never count as a pass and never block.

A score is real only if it was read from the game's own saved records after the student left this map and came back. Never type a score. Never add an "I passed" button. Never invent 80%.

How to read a real score, same browser, same site (`mrjkorea.github.io` shares localStorage):

- Before opening a game, save a stamp: student name, unit id, station, game, time.
- When the map is shown again (`pageshow` / focus), read records newer than that stamp.
- Frog: `localStorage` key `mrj-leap-frog-records-v1`. Use rows whose `student_id` is this student's name. Count `correct` true/false. A round counts only if the number of new rows is at least the unit word count. Percent = correct rows / new rows.
- Snow: key `mrj-ski-jump-records-v1`. Same rule.
- Spellfire: key `mrj.firefighter_spelling.records`. Same rule. `student_id` is the name passed as `student`. `correct` may be 1 or 0.
- Space Ranger and Memory do not write a name-matched finished score we can trust. Link them. Do not unlock from their storage. Records may say "opened, no score came back yet."
- Also accept a return query only if the page is opened with `score` and `max` and `station` and `unit` and `game`. Use those numbers. Do not add a form that lets a student type them.

If there is no real score, the station stays open and Records shows no grade for that try.

## Links — exact live games

Open in the **same tab** (so the student can come back). Never `target=_blank`.

- Frog jumps: `https://mrjkorea.github.io/leap-frog/?pack=session&student=NAME`
- Snow jump: `https://mrjkorea.github.io/ski-jump/?pack=session&student=NAME`
- Space Ranger: `https://mrjkorea.github.io/sound-invaders/?pack=PACKURL&student=NAME`
- Spellfire: `https://mrjkorea.github.io/firefighter-spelling/?pack=PACKURL&student=NAME`
- Memory: `https://mrjkorea.github.io/memory-match/?pack=PACKURL&student=NAME`

NAME is the first name only, URL-encoded. Never the PIN.

Packs:

- Frog and Snow understand `pack=session` plus `sessionStorage` key `mrj.wm.gamepack`. Write that JSON, then navigate. Shape they accept: `{ pack_id, title, items: [{ item_id, question, correct, wrong: [two other English words from the same unit] }] }`. `question` is the Korean gloss. `correct` is the English word. Wrong answers are other words from that same unit, not new words you invent. If the unit has fewer than 3 words, do not open the game; say the pack is too small.
- Spellfire pack shape: `{ pack_id, title, items: [{ item_id, word }] }`. `word` is the English word from the unit.
- Memory pack shape: `{ pack_id, title, items: [{ id, en, l1: { ko } }] }`.
- Space pack shape: `{ pack_id, title, module_id: "sound_invaders", activity_id: "hear_shoot", items: [{ item_id, prompt, correct, wrong: [two other unit words] }] }`. Do not invent mp3 files.

For Spellfire, Memory, and Space, `PACKURL` is a `data:` JSON URL of that pack (`encodeURIComponent`). Fetch the day2 pack in the browser first. Do not ship homemade game code to convert the pack into a quiz on this page.

## Records

`localStorage` key `mrj.day3.records.v1`, by student name. Every real finished round writes one attempt: student name, unit id, unit title, station, game, try number, score percent, correct, total, started_at, ended_at, sheet status. No PIN.

Records screen lists them: unit, station, game, try, score, time, and whether the class sheet accepted the row. Reachable from every screen.

## Class sheet

Only after a real score exists, POST JSON to:

`https://script.google.com/macros/s/AKfycbwIBPzcmJYkJP-uURVzyt8_7iF3mzGBTCp-omNA2sF3Hk5oGusHfOlPyhEnDl2XAJu82w/exec`

```json
{
  "student_email": "unknown",
  "session_id": "day3-NAME-DATE",
  "events": [{
    "event_id": "day3-unique",
    "event_kind": "learning_result",
    "source": "mrj-day3",
    "curriculum_program": "conversation",
    "subject": "conversation",
    "app_name": "MRJ Day 3",
    "book_title": "UNIT TITLE",
    "unit_id": "UNIT ID",
    "item_id": "choice-frog",
    "item_type": "game",
    "score_value": 8,
    "score_max": 10,
    "score_pct": 80,
    "correctness": "correct",
    "completed": true,
    "local_date": "2026-09-28",
    "schema_version": "5.0",
    "tracker_version": "day3-map-1",
    "metadata_json": "{\"student_name\":\"NAME\",\"station\":\"choice\",\"game\":\"frog\"}"
  }]
}
```

`student_email` is `unknown`. Do not invent an email. The name goes in `metadata_json` and `book_title`, not in a fake address.

Use `Content-Type: text/plain;charset=utf-8` so the browser does not preflight. If the response JSON has `status: ok`, mark the attempt `sheet: saved`. If the body cannot be read, mark `sheet: sent, not confirmed`. If the send throws, mark `sheet: on this phone only` and keep the payload in `mrj.day3.sheetQueue` to retry next visit. Never say the sheet saved unless `status` is `ok`. Never POST from the gate test. Never POST a sample score.

## Files

Rewrite:

- index.html
- css/app.css
- js/rules.js
- js/app.js
- packs/units.json
- scripts/gate_test.js
- README.md
- CURSOR_RECEIPT.md

You may leave old audio files. Do not call them from the page. Do not git commit. Do not mention billing.

`rules.js` must export, and also `module.exports` when `typeof module !== "undefined"`:

- `pass(scorePct)` → scorePct >= 80
- `nextMadeLocked(bestByStation)` → first locked made station id, or null. Made order is choice, spelling, memory. A missing previous score locks the next. Later stations are not in this list.
- `tryNumber(attempts, unitId, stationId)` → count+1
- `scorePct(correct, total)` → rounded integer. total 0 returns null, not 100.
- `roundCounts(newRows, wordCount)` → true only if newRows >= wordCount and wordCount >= 3

`scripts/gate_test.js` (node) must:

- assert 79 fails and 80 passes
- assert a 70 on choice keeps spelling locked, and 80 on choice unlocks spelling
- assert a missing choice score keeps spelling locked
- assert hotspot / order / bell are not required to unlock choice
- assert scorePct(0, 0) is null
- assert roundCounts(2, 10) is false and roundCounts(10, 10) is true
- print `GATE_OK` and exit 0

README must say: this is a map of links; homemade games were removed; Later doors are not built; Space and Memory links do not unlock the path until those games send a score back; Frog, Snow, and Spellfire can.

## Receipt

After writing, run `node scripts/gate_test.js`. It must print `GATE_OK` and exit 0. If it fails, fix and rerun.

`CURSOR_RECEIPT.md` must include the command, model `composer-2.5`, files written, and the test line `GATE_OK`.
