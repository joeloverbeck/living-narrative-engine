# VIOMIG-006: Create Lethal Violence Mod Structure and Manifest

**Status**: Completed
**Type**: Setup
**Priority**: High

## Summary

Create the directory structure and manifest file for the new `lethal-violence` mod, which will contain killing and maiming actions with lethal consequences (tear_out_throat). Dependencies are deferred until referenced content is migrated.

## Files to Touch

- CREATE `data/mods/lethal-violence/mod-manifest.json`
- CREATE `data/mods/lethal-violence/actions/` (empty directory with .gitkeep)
- CREATE `data/mods/lethal-violence/rules/` (empty directory with .gitkeep)
- CREATE `data/mods/lethal-violence/conditions/` (empty directory with .gitkeep)

## Out of Scope

- Do NOT migrate any files from violence mod
- Do NOT update `data/game.json`
- Do NOT modify any existing mods
- Do NOT create action/rule/condition content
- Do NOT create macros/ or scopes/ directories (lethal-violence mod doesn't need them)
  - Tests may be added or updated only if needed to cover validation or loader edge cases introduced by this scaffold.

## Implementation Details

### Directory Structure

```
data/mods/lethal-violence/
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
  "id": "lethal-violence",
  "version": "1.0.0",
  "name": "Lethal Violence",
  "description": "Killing and maiming actions with lethal consequences",
  "dependencies": []
}
```

**Note**: Dependency entries must include `id` and a SemVer `version` range per the mod-manifest schema. This mod will eventually depend on `grabbing` once action/rule content is migrated; until references exist, leave dependencies empty to avoid unused-dependency validation failures.

## Acceptance Criteria

### Tests
- [ ] `mod-manifest.json` is valid JSON
- [ ] `mod-manifest.json` validates against mod manifest schema
- [ ] Directory structure matches project conventions
- [ ] All required subdirectories exist

### Invariants
- [ ] Violence mod remains completely unchanged
- [ ] No entries added to `data/game.json`
- [ ] No other mods modified
- [ ] Dependencies list only includes mods that exist (and is empty until content references are present)

## Dependencies

- VIOMIG-004 (grabbing mod must exist since lethal-violence depends on it)
- VIOMIG-005 (grabbing actions must be migrated for dependency to be meaningful)

## Blocks

- VIOMIG-007 (migration requires mod structure to exist)

## Verification Commands

```bash
# Verify mod-manifest.json is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/mods/lethal-violence/mod-manifest.json'))"

# Verify directory structure
ls -la data/mods/lethal-violence/
ls -la data/mods/lethal-violence/actions/
ls -la data/mods/lethal-violence/rules/
ls -la data/mods/lethal-violence/conditions/

# Verify violence mod unchanged
git diff data/mods/violence/

# Verify mod dependencies
npm run validate
```

## Outcome

- Created `data/mods/lethal-violence/` scaffold with `actions/`, `rules/`, and `conditions/` plus `.gitkeep` placeholders.
- Added `data/mods/lethal-violence/mod-manifest.json` with `$schema` and an empty `dependencies` array; deferred the planned `grabbing` dependency until content references exist to avoid unused-dependency validation failures.
