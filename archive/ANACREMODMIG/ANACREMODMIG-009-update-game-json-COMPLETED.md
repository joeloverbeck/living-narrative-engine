# ANACREMODMIG-009: Update game.json to Load anatomy-creatures Mod

**Status: ✅ COMPLETED**

## Summary
Add the `anatomy-creatures` mod to `data/game.json` so the shipped mod list matches the already-migrated manifests and dependencies.

## Current State (rechecked)
- `data/mods/anatomy-creatures/` exists and depends on `core` and `anatomy`.
- `data/mods/dredgers/mod-manifest.json` already lists `anatomy-creatures` as a dependency.
- `data/game.json` currently omits `anatomy-creatures`; the surrounding order is `... "descriptors", "distress", "dredgers", "first-aid", ...`.

## Files to Touch

### Modify
- `data/game.json`

## Changes Required
- Insert `"anatomy-creatures"` into the `mods` array **before** `"dredgers"` without reordering any existing entries.

### Load Order Requirements
1. Must load **after** `anatomy` (parts use `anatomy:humanoid_slots`).
2. Must load **before** `dredgers` (dredgers depends on anatomy-creatures blueprints/entities).
3. Preserve the current relative order of all other mods.

### Expected Position in Mods Array
```json
{
  "mods": [
    "core",
    "accessories",
    "activity",
    "affection",
    "anatomy",
    // ... existing mods stay in place ...
    "descriptors",
    "distress",
    "anatomy-creatures", // add here
    "dredgers",
    "first-aid",
    // ... remaining mods unchanged ...
  ]
}
```

## Out of Scope
- No other `game.json` edits
- No mod manifest or content changes
- No load-order changes for existing mods besides inserting this entry

## Acceptance Criteria
- `npm run validate:quick` passes.
- `npm run test:integration -- --runTestsByPath tests/integration/loaders/modsLoader.gameConfigPhase.integration.test.js` passes (verifies mods list from game.json loads correctly).
- `data/game.json` contains `anatomy-creatures` exactly once, positioned before `dredgers`.

## Verification Commands
```bash
rg "anatomy-creatures" data/game.json
cat data/game.json | sed -n '10,40p' # spot-check surrounding order
npm run validate:quick
npm run test:integration -- --runTestsByPath tests/integration/loaders/modsLoader.gameConfigPhase.integration.test.js --runInBand
```

## Dependencies
- Migration tickets that moved content and updated manifests (ANACREMODMIG-001 through 008) should already be completed; dredgers manifest already depends on `anatomy-creatures`.

## Risk Considerations
- Activating the mod will surface any remaining namespace mismatches; use validation/tests above to catch regressions.

## Outcome
- Inserted `anatomy-creatures` into `data/game.json` immediately before `dredgers`, leaving all other mod order intact.
- Verified with `npm run validate:quick` and targeted integration test `modsLoader.gameConfigPhase.integration.test.js`.
- Ticket assumptions adjusted to reflect existing `game.json` ordering (distress precedes dredgers) and to scope tests to validation + the mods loader integration suite.
