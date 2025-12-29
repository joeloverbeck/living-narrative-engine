# VIOMIG-004: Create Grabbing Mod Structure and Manifest

**Status**: Completed
**Type**: Setup
**Priority**: High

## Summary

Create the directory structure and manifest file for the new `grabbing` mod, which will contain close-range restraint and grappling actions (grab_neck, squeeze_neck).

## Files to Touch

- CREATE `data/mods/grabbing/mod-manifest.json`
- CREATE `data/mods/grabbing/actions/` (empty directory with .gitkeep)
- CREATE `data/mods/grabbing/rules/` (empty directory with .gitkeep)
- CREATE `data/mods/grabbing/conditions/` (empty directory with .gitkeep)

## Out of Scope

- Do NOT migrate any files from violence mod
- Do NOT update `data/game.json`
- Do NOT modify any existing mods
- Do NOT create action/rule/condition content
- Do NOT create macros/ or scopes/ directories (grabbing mod doesn't need them)

## Implementation Details

### Directory Structure

```
data/mods/grabbing/
├── mod-manifest.json
├── actions/
│   └── .gitkeep
├── rules/
│   └── .gitkeep
└── conditions/
    └── .gitkeep
```

### mod-manifest.json Content

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "grabbing",
  "version": "1.0.0",
  "name": "Grabbing",
  "description": "Close-range restraint and grappling actions",
  "dependencies": [],
  "content": {
    "actions": [],
    "rules": [],
    "conditions": []
  }
}
```

## Acceptance Criteria

### Tests
- [x] `mod-manifest.json` is valid JSON
- [x] `mod-manifest.json` validates against mod manifest schema
- [x] Directory structure matches project conventions
- [x] All required subdirectories exist
- [x] `npm run validate` completes without errors
- [x] `npm run test:integration -- --runInBand tests/integration/validation/manifestFileExistence.integration.test.js` completes without errors

### Invariants
- [x] Violence mod remains completely unchanged
- [x] No entries added to `data/game.json`
- [x] No other mods modified
- [x] Dependencies list only includes mods that exist

## Dependencies

- None (can run in parallel with VIOMIG-001, VIOMIG-002)

## Blocks

- VIOMIG-005 (migration requires mod structure to exist)
- VIOMIG-006 (lethal-violence depends on grabbing)

## Verification Commands

```bash
# Verify mod-manifest.json is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/mods/grabbing/mod-manifest.json'))"

# Verify directory structure
ls -la data/mods/grabbing/
ls -la data/mods/grabbing/actions/
ls -la data/mods/grabbing/rules/
ls -la data/mods/grabbing/conditions/

# Verify violence mod unchanged
git diff data/mods/violence/

# Verify mod dependencies
npm run validate

# Targeted validation integration test
npm run test:integration -- --runInBand tests/integration/validation/manifestFileExistence.integration.test.js
```

# Outcome

- Created `data/mods/grabbing/` with `actions/`, `rules/`, and `conditions/` plus `.gitkeep` placeholders.
- Created `data/mods/grabbing/mod-manifest.json` with `$schema`, empty `dependencies`, and empty `content` arrays for actions/rules/conditions.
- Updated scope to include running validation and a targeted integration test (previously excluded).
