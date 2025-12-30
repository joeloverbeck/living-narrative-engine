# GRA001CHABASGRANECACT-009: Update game.json Mod List

**STATUS: COMPLETED**

## Summary
Add the new `grabbing-states` mod to the `game.json` mods list. It must be positioned BEFORE the `grabbing` mod so that its components are loaded first.

## File List (Files to Touch)

### Files to Modify
- `data/game.json`

## Out of Scope

**DO NOT modify or touch:**
- Any mod files in `data/mods/`
- Any source code in `src/`
- Any schema files
- The `startWorld` field in game.json
- Any other fields in game.json besides the `mods` array

**Conditional allowance:** If the change exposes a validation or mod-load invariant not covered by tests, add or adjust the minimal relevant test(s) to capture it.

## Implementation Details

### Current Relevant Section of game.json

```json
{
  "mods": [
    "core",
    // ... other mods ...
    "striking",
    "grabbing",
    "lethal-violence",
    // ... other mods ...
  ]
}
```

### Required Change

Add `"grabbing-states"` immediately BEFORE `"grabbing"`:

```json
{
  "mods": [
    "core",
    // ... other mods ...
    "striking",
    "grabbing-states",
    "grabbing",
    "lethal-violence",
    // ... other mods ...
  ]
}
```

### Position Rationale
- `grabbing` depends on `grabbing-states` (per ticket 004)
- Mods are loaded in list order
- Dependencies must be loaded before dependents
- The states mod must be available when the grabbing mod loads

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` completes without errors
- `npm run test:integration -- --runInBand --coverage=false tests/integration/mods/grabbing` passes

### Invariants That Must Remain True
- All existing mods remain in the list
- No mods are removed or reordered except for the insertion
- `grabbing-states` appears exactly once
- `grabbing-states` appears immediately before `grabbing`
- `startWorld` field is unchanged
- JSON is syntactically valid with proper commas

## Verification Steps

1. `data/game.json` contains `"grabbing-states"` in mods array
2. `grabbing-states` appears before `grabbing` in the array
3. `npm run validate` passes
4. `npm run test:integration -- --runInBand --coverage=false tests/integration/mods/grabbing` passes

## Dependencies
- GRA001CHABASGRANECACT-001 (grabbing-states mod structure must exist)

## Blocked By
- GRA001CHABASGRANECACT-001

## Blocks
- None (this can be done in parallel with other tickets after 001)

## Notes
This is a simple, low-risk change but critical for mod loading order. The change is a single line insertion.

## Outcome
- Added `grabbing-states` to `data/game.json` immediately before `grabbing`.
- Updated validation/test commands to match the scoped integration test run used for this change.
