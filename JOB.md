# Day 3 workbook — build this. Do not only describe it.

You are writing a static phone web app in THIS folder. index.html at the repo root. No React. No build step. No node_modules. No phone-OS speech (no speechSynthesis, no webkitSpeech). Spoken words are baked mp3s under audio/. If an mp3 is missing, show the English word in big type and a Replay button that tries the mp3 again — never the browser voice.

## What the student does

1. Login: first name + 4-digit PIN. Saved on this phone only (localStorage key `mrj.day3.accounts`). Same name+PIN opens the same record. Do not send the PIN anywhere.
2. Pick a unit. Two packs ship: `packs/ba_u01.json` (Numbers 1 to 10, real unit) and `packs/body_demo.json` (body picture, so Jay can see the picture changes with the unit).
3. Six stations, in this order. Next station stays locked until the previous best score is 80% or more.
   - hotspot — no choice
   - choice — student picks Frog jumps, Snow jump, or Space fighter, then plays that skin
   - spelling — student picks Spellfire, Hangman, Word search, or Crossword
   - memory — no choice
   - order — sentence building, no choice
   - bell — Golden Bell finale, no choice
4. Every finished round writes one attempt: student, unit, station, skin, try number, score percent, correct, total, each item right/wrong, started_at, ended_at. Records screen lists them. Best score and try count show on the path.

Pass line is 80. 8/10 passes. 7/10 does not. Use 10 items on hotspot, choice, spelling, and bell so 8/10 is the line. Memory: 5 pairs; score = pairs / (pairs + wrong flips); need 80. Order: 5 sentences; need 4/5.

## Look

Phone first. Cream background, navy #10243f, gold #e0a106. Big round tap targets. Short English. Korean gloss under English words. No dashboard jargon. Header: MRJ English · Day 3.

## Games (must be playable, not a form)

Hotspot: a big SVG scene. Numbers unit = a park with counted groups (1 sun, 2 birds, 3 trees, 4 flowers, 5 fish, 6 stones, 7 apples, 8 stars, 9 leaves, 10 windows on a house). Body unit = one standing kid, regions for head, eye, ear, nose, mouth, shoulder, arm, hand, leg, foot. Hear the word (mp3). Tap the spot. Right = gold pulse and next. Wrong = red shake, that item is wrong, show the right spot for 700ms, then next. Score = right / 10.

Choice skins share one engine (hear word, tap 1 of 3):
- Frog: three lily pads, frog on the bank
- Snow: three snow mounds, kid on skis
- Space: three ships, tap the right one
Wrong choice shakes. 10 rounds.

Spelling skins share the unit word list:
- Spellfire: scrambled letter tiles, tap in order, gold timer bar. Wrong tile costs a miss. Word is heard, not shown.
- Hangman: classic stick figure, 6 misses, letter keyboard. Heard word, Korean gloss shown.
- Word search: 8x8 grid, 5 words from the unit placed across or down. Find all 5. Score = found/5 (need 4/5, so this station uses 5 not 10).
- Crossword: 5 across clues. Clue is the Korean gloss. Type the English word. Score = words fully correct / 5.

Memory: 10 cards, 5 pairs. One face is the English word, the other is the Korean gloss. Tap two. Match stays. Miss flips back. No browser voice.

Order: chips for one sentence. Tap chips in order into the answer line. Undo last chip. Check. Sentences come from the pack `sentences` array. 5 sentences.

Golden Bell: dark stage, big gold bell. 10 mixed items from the pack: 4 hear-and-pick the word, 3 spell the word on a letter pad, 3 tap chips into the sentence. Correct rings the bell (CSS animation + a short local oscillator beep is OK for the bell only, not for words). Score /10. Need 8.

## Records

localStorage `mrj.day3.records.v1` map by student name. Attempt object fields:
student_id, session_id, module_id="conversation", activity_id, item_id, skill_tags, response, correct, latency_ms, accuracy, points, errors, started_at, ended_at, ui_locale="en", unit_id, skin, try_n, score_pct, total

Also a summary list on the Records screen: unit, station, try, score, time. No raw PIN on that screen.

## Files you must write

- index.html (loads css/app.css and js/rules.js then js/app.js)
- css/app.css
- js/rules.js — pure functions, also `module.exports` if `typeof module !== "undefined"`
- js/app.js
- packs/ba_u01.json
- packs/body_demo.json
- scripts/gate_test.js
- README.md (how to open, pass line, what is not the full frog/snow engine)
- CURSOR_RECEIPT.md

rules.js must export:
- pass(scorePct) → scorePct >= 80
- nextLocked(bestByStation) → id of first locked station or null
- tryNumber(attempts, unitId, stationId) → count+1
- scorePct(correct, total) → rounded integer
- outsidePack(itemIds, packIds) → ids not in the pack

scripts/gate_test.js (node) must:
- assert 79 fails and 80 passes
- assert hotspot pass unlocks choice and a 70 on choice keeps spelling locked
- assert tryNumber increments
- assert a body item id is outside the numbers pack
- print GATE_OK and exit 0

Pack shape:
```
{
  "unit_id": "ba_u01",
  "title_en": "Numbers 1 to 10",
  "title_ko": "1부터 10까지 숫자",
  "scene": "park",
  "words": [{"id":"w01","en":"one","ko":"일","audio":"audio/ba_u01/one.mp3"}],
  "sentences": [{"id":"s01","en":"I have one mother.","ko":"나는 엄마가 한 명 있다.","audio":"audio/ba_u01/s01.mp3","chips":["I","have","one","mother"]}]
}
```
Numbers words: one 일, two 이, three 삼, four 사, five 오, six 육, seven 칠, eight 팔, nine 구, ten 십.
Numbers sentences (5):
- I have one mother.
- I have five brothers.
- I have six sisters.
- I can count to ten.
- One two three four five.

Body demo scene "body". Words: head 머리, eye 눈, ear 귀, nose 코, mouth 입, shoulder 어깨, arm 팔, hand 손, leg 다리, foot 발.
Sentences:
- This is my head.
- I have two eyes.
- Touch your nose.
- Raise your hand.
- This is my foot.

Audio files may already be in audio/. Do not delete them. Do not call a speech API. Do not git commit. Do not mention billing.

After writing, run: `node scripts/gate_test.js`
It must print GATE_OK and exit 0. If it fails, fix and rerun. Append the command, model grok-4.7, files, and the test line to CURSOR_RECEIPT.md.
