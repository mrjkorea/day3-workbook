# Cursor receipt

Wired Day 3 to the shared MRJ sign-in. The local first-name and 4-digit PIN door is gone. The lesson waits for `mrj-auth-ready` and uses `event.detail.id` as the only student id.

## Files changed

- `index.html`
- `js/app.js`
- `css/app.css`
- `README.md`
- `CURSOR_RECEIPT.md`

## Pack sync (20261007-pack-1)

- `js/pack-sync.js`, `version.json`, `scripts/pack_sync_test.js`
- Per-student `loadPack` / `savePack` for `day3-workbook`; legacy `mrj.day3.records.v1` left untouched on device.

Command: `node scripts/gate_test.js` → `PACK_SYNC_OK` then `GATE_OK`.
