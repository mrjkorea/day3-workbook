# MRJ English · Day 3 (map)

Static phone-first **map of links** to live MRJ games. Open **`index.html`** in a browser or serve this folder with any static file server. No build step, no `node_modules`.

Homemade in-page games were removed. **Later** doors (Hotspot, Hangman, Word search, Crossword, Sentence order, Golden Bell) are placeholders — they do not play and do not block the path.

## Login

First name plus 4-digit PIN. Stored only on this device under `localStorage` key `mrj.day3.accounts`. The PIN is never sent in URLs, game links, or the class sheet.

## Units

Word packs come from [day2-words](https://mrjkorea.github.io/day2-words/). The catalog is in `packs/units.json` (built from live `packs/*.json` on the day2-words repo).

## Path and 80% lock

Stations on one map: Hotspot (Later) → Choice → Spelling → Memory → Sentence order (Later) → Golden Bell (Later).

**80%** is the pass line (79% does not pass). Made stations, in order: **Choice → Spelling (Spellfire only) → Memory**. The next made station stays locked until the previous has a real best score ≥ 80% for this student and unit. Later doors never count as a pass and never block.

Real scores are read from each game’s own saved records when the student returns to the map (same browser on `mrjkorea.github.io`), or from a return URL with `score`, `max`, `station`, `unit`, and `game`. There is no manual “I passed” control.

**Frog**, **Snow**, and **Spellfire** can unlock the path when their storage records match. **Space Ranger** and **Memory** are linked but do not unlock the path until those games expose a trusted name-matched score.

## Records

Attempts are saved under `mrj.day3.records.v1` by student name (no PIN). Use **Records** on any screen.

## Tests

```bash
node scripts/gate_test.js
```

Prints `GATE_OK` when pass/lock rules satisfy the gate.
