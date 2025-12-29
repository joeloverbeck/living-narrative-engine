# VIOMIG-002: Create Striking Mod Structure and Manifest

**Status**: Completed
**Type**: Setup
**Priority**: High

## Summary

Create the directory structure and manifest file for the new `striking` mod, which will contain arm-based impact attacks (punch, slap, sucker punch).

## Assumptions (Reassessed)

- `mod-manifest.json` should include `"$schema": "schema://living-narrative-engine/mod-manifest.schema.json"` for editor/validator support.
- `dependencies` must be an array of `{ "id", "version" }` objects if any are listed; an empty array is acceptable.
- `content` is optional, but if present must be an object whose keys match `mod-manifest.schema.json`.

## Files to Touch

- CREATE `data/mods/striking/mod-manifest.json`
- CREATE `data/mods/striking/actions/` (empty directory with .gitkeep)
- CREATE `data/mods/striking/rules/` (empty directory with .gitkeep)
- CREATE `data/mods/striking/conditions/` (empty directory with .gitkeep)
- CREATE `data/mods/striking/macros/` (empty directory with .gitkeep)
- CREATE `data/mods/striking/scopes/` (empty directory with .gitkeep)

## Out of Scope

- Do NOT migrate any files from violence mod
- Do NOT update `data/game.json`
- Do NOT modify any existing mods
- Do NOT create action/rule/condition content
- No new tests unless validation gaps are discovered

## Implementation Details

### Directory Structure

```
data/mods/striking/
├── mod-manifest.json
├── actions/
│   └── .gitkeep
├── rules/
│   └── .gitkeep
├── conditions/
│   └── .gitkeep
├── macros/
│   └── .gitkeep
└── scopes/
    └── .gitkeep
```

### mod-manifest.json Content

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "striking",
  "version": "1.0.0",
  "name": "Striking",
  "description": "Arm-based impact attacks including punches and slaps",
  "dependencies": [],
  "content": {}
}
```

## Acceptance Criteria

### Tests
- [x] `mod-manifest.json` is valid JSON
- [x] `mod-manifest.json` validates against mod manifest schema
- [x] Directory structure matches project conventions
- [x] All subdirectories exist

### Invariants
- [x] Violence mod remains completely unchanged
- [x] No entries added to `data/game.json`
- [x] No other mods modified
- [x] Dependencies list only includes mods that exist

## Dependencies

- None (can run in parallel with VIOMIG-001)

## Blocks

- VIOMIG-003 (migration requires mod structure to exist)

## Verification Commands

```bash
# Verify mod-manifest.json is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/mods/striking/mod-manifest.json'))"

# Verify directory structure
ls -la data/mods/striking/
ls -la data/mods/striking/actions/
ls -la data/mods/striking/rules/
ls -la data/mods/striking/conditions/
ls -la data/mods/striking/macros/
ls -la data/mods/striking/scopes/

# Verify violence mod unchanged
git diff data/mods/violence/

# Verify that the mod dependencies validate.
npm run validate
```

## Outcome

- Created `data/mods/striking/` with the empty subdirectories and `mod-manifest.json` matching the schema.
- No changes were needed to existing mods or `data/game.json`; scope stayed focused on the new mod scaffold.
