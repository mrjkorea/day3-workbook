# MRJ English · Day 3 (map)

Static phone-first **map of links** to live MRJ games. Open **`index.html`** in a browser or serve this folder with any static file server. No build step, no `node_modules`.

Homemade in-page games were removed. **Later** doors (Hotspot, Hangman, Word search, Crossword, Sentence order, Golden Bell) are placeholders — they do not play and do not block the path.

## Login

Shared MRJ sign-in. This page does not ask for a first name or a PIN. The lesson starts only after the `mrj-auth-ready` window event. `event.detail.id` is the student id on the map and the only id on score posts. An empty id does not save a record bucket and does not post a score.

## Units

Word packs come from [day2-words](https://mrjkorea.github.io/day2-words/). The catalog is in `packs/units.json` (built from live `packs/*.json` on the day2-words repo).

## Path and 80% lock

Stations on one map: Hotspot (Later) → Choice → Spelling → Memory → Sentence order (Later) → Golden Bell (Later).

**80%** is the pass line (79% does not pass). Made stations, in order: **Choice → Spelling (Spellfire only) → Memory**. The next made station stays locked until the previous has a real best score ≥ 80% for this student and unit. Later doors never count as a pass and never block.

Real scores are read from each game’s own saved records when the student returns to the map (same browser on `mrjkorea.github.io`), or from a return URL with `score`, `max`, `station`, `unit`, and `game`. There is no manual “I passed” control.

**Frog**, **Snow**, and **Spellfire** can unlock the path when their storage records match. **Space Ranger** and **Memory** are linked but do not unlock the path until those games expose a trusted name-matched score.

## Records

Attempts are saved under per-student keys `mrj.day3.records.v1:<id_key>` (and matching stamps / sheet-queue keys). Progress packs sync through MRJ sign-in `loadPack` / `savePack` for program `day3-workbook`. Legacy device-wide `mrj.day3.records.v1` (no suffix) is left on the phone and is not uploaded. Build: **20261007-pack-2** (`version.json`). Metrics retry queue (`mrj.day3.sheetQueue`) stays on the device only. Use **Records** on any screen.

## Tests

```bash
node scripts/gate_test.js
```

Prints `GATE_OK` when pass/lock rules satisfy the gate.
