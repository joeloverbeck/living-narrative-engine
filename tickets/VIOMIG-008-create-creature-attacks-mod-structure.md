# VIOMIG-008: Create Creature Attacks Mod Structure and Manifest

**Status**: Open
**Type**: Setup
**Priority**: High

## Summary

Create the directory structure and manifest file for the new `creature-attacks` mod, which will contain non-humanoid combat actions like beak pecks and future claw attacks.

## Files to Touch

- CREATE `data/mods/creature-attacks/mod-manifest.json`
- CREATE `data/mods/creature-attacks/actions/` (empty directory with .gitkeep)
- CREATE `data/mods/creature-attacks/rules/` (empty directory with .gitkeep)
- CREATE `data/mods/creature-attacks/conditions/` (empty directory with .gitkeep)
- CREATE `data/mods/creature-attacks/macros/` (empty directory with .gitkeep)
- CREATE `data/mods/creature-attacks/scopes/` (empty directory with .gitkeep)

## Out of Scope

- Do NOT migrate any files from violence mod
- Do NOT update `data/game.json`
- Do NOT modify any existing mods
- Do NOT create action/rule/condition content
- Do NOT update tests

## Implementation Details

### Directory Structure

```
data/mods/creature-attacks/
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
  "id": "creature-attacks",
  "version": "1.0.0",
  "name": "Creature Attacks",
  "description": "Non-humanoid combat actions like beak pecks and claw attacks",
  "dependencies": [
    "core",
    "anatomy",
    "positioning"
  ]
}
```

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
- [ ] Dependencies list only includes mods that exist

## Dependencies

- None (can run in parallel with other mod structure tickets)

## Blocks

- VIOMIG-009 (migration requires mod structure to exist)

## Verification Commands

```bash
# Verify mod-manifest.json is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/mods/creature-attacks/mod-manifest.json'))"

# Verify directory structure
ls -la data/mods/creature-attacks/
ls -la data/mods/creature-attacks/actions/
ls -la data/mods/creature-attacks/rules/
ls -la data/mods/creature-attacks/conditions/
ls -la data/mods/creature-attacks/macros/
ls -la data/mods/creature-attacks/scopes/

# Verify violence mod unchanged
git diff data/mods/violence/
```
