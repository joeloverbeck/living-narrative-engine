# CLOLAYMIG-001: Infrastructure Setup

## Status: COMPLETED

**Completed**: 2025-11-25

## Summary

Create the directory structure and mod manifests for all 4 new layer-specific clothing mods, and update `game.json` to include them in the load order.

## Dependencies

- None (this is the first ticket)

## Files Created

### Directory Structure

```
data/mods/accessories/
├── mod-manifest.json
└── entities/
    └── definitions/
        (empty)

data/mods/underwear/
├── mod-manifest.json
└── entities/
    └── definitions/
        (empty)

data/mods/outer-clothing/
├── mod-manifest.json
└── entities/
    └── definitions/
        (empty)

data/mods/base-clothing/
├── mod-manifest.json
└── entities/
    └── definitions/
        (empty)
```

### Mod Manifest Template

Each manifest follows the `armor` mod pattern:

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "<mod-id>",
  "version": "1.0.0",
  "name": "<Display Name>",
  "description": "<layer> clothing entities",
  "author": "Living Narrative Engine",
  "dependencies": [
    { "id": "core", "version": "^1.0.0" },
    { "id": "descriptors", "version": "^1.0.0" },
    { "id": "items", "version": "^1.0.0" },
    { "id": "clothing", "version": "^1.0.0" }
  ],
  "gameVersion": ">=0.0.1",
  "content": {
    "entities": {
      "definitions": [],
      "instances": []
    }
  }
}
```

## Files Modified

### `data/game.json`

**Change**: Added 4 new mods after `clothing` and before `armor`:

```json
{
  "mods": [
    ...
    "clothing",
    "underwear",
    "base-clothing",
    "outer-clothing",
    "accessories",
    "armor",
    ...
  ]
}
```

**Rationale for load order**: Layer mods depend on `clothing` but must load before content mods (like `armor`) that might reference them.

## Out of Scope

- **DO NOT** move any entity files yet
- **DO NOT** modify any entity JSON files
- **DO NOT** modify the `clothing` mod manifest
- **DO NOT** modify any recipe files
- **DO NOT** modify any other mod manifests
- **DO NOT** add any actual entity definitions to the new mods

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run validate        # All schema validation passes
npm run test:ci         # Full test suite passes
```

### Invariants That Must Remain True

1. All existing tests continue to pass unchanged
2. The `clothing` mod still contains all 125 entity definitions
3. All 5 recipe files (`threadscar_melissa`, `bertram_the_muddy`, `vespera_nightwhisper`, `dylan_crace`, `len_amezua`) continue to work
4. The game can start successfully with `npm run start`
5. The new mods load without errors (empty but valid)

### Manual Verification

1. Run `npm run start` and verify the game loads without errors
2. Verify all 4 new mod directories exist with correct structure
3. Verify `game.json` has correct mod order

## Rollback

```bash
rm -rf data/mods/accessories data/mods/underwear data/mods/outer-clothing data/mods/base-clothing
git checkout data/game.json
```

---

## Outcome

**Implementation matched original plan exactly.**

### What was actually changed:

1. **Created 4 new mod directories** with empty `entities/definitions/` subdirectories:
   - `data/mods/accessories/`
   - `data/mods/underwear/`
   - `data/mods/outer-clothing/`
   - `data/mods/base-clothing/`

2. **Created mod manifests** for each new mod following the `armor` mod pattern with dependencies on `core`, `descriptors`, `items`, and `clothing`.

3. **Updated `data/game.json`** to include the 4 new mods between `clothing` and `armor` in the correct load order.

### Verification results:

- `npm run validate`: PASSED (0 violations across 42 mods)
- Unit tests: 36,868 passed
- Integration tests: 13,569 passed
- All ticket invariants maintained:
  - `clothing` mod still has 125 entity definitions
  - No recipe files were modified
  - New mods load without errors
