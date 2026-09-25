# MRJ English · Day 3 (phone web app)

Static phone-first workbook. Open **`index.html`** in a browser (or serve this folder with any static file server). No build step, no `node_modules`.

## Login

First name plus 4-digit PIN. Stored only on this device under `localStorage` key `mrj.day3.accounts`. The PIN is never sent anywhere.

## Units

- **Numbers 1 to 10** — `packs/ba_u01.json`, park hotspot scene
- **My Body (demo)** — `packs/body_demo.json`, body picture scene

## Path and pass line

Six stations in order: Hotspot → Choice → Spelling → Memory → Order → Golden Bell.

**80%** unlocks the next station. Hotspot, Choice, Spelling, and Bell use **10** items (8/10 passes). Memory uses **5 pairs**; score = pairs ÷ (pairs + wrong flips). Order uses **5** sentences (4/5 passes).

Spoken words use **mp3 files** under `audio/`. If a file is missing, the app shows the English word large with a **Replay** button — no browser speech.

## Records

Attempts are saved under `mrj.day3.records.v1` by student name. The Records screen shows unit, station, try, score, and time (no PIN).

## What this is not

Choice skins (Frog / Snow / Space) share one **tap-one-of-three** engine with different backgrounds — not a full platformer or fighter game. Spelling skins are teaching mini-games, not commercial game ports.

## Tests

```bash
node scripts/gate_test.js
```

Prints `GATE_OK` when rules and packs satisfy the workbook gate.
