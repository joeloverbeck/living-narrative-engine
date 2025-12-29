# VIOMIG-003: Migrate Striking Actions and Supporting Files

**Status**: Completed
**Type**: Migration
**Priority**: High

## Summary

Migrate punch_target, slap_target, and sucker_punch actions with all supporting files (rules, conditions, macros, scopes) from violence mod to striking mod. Update all IDs from `violence:` to `striking:` namespace and apply Bold Red color scheme.

## Files to Touch

### Move and Update

| Source | Destination |
|--------|-------------|
| `data/mods/violence/actions/punch_target.action.json` | `data/mods/striking/actions/punch_target.action.json` |
| `data/mods/violence/actions/slap_target.action.json` | `data/mods/striking/actions/slap_target.action.json` |
| `data/mods/violence/actions/sucker_punch.action.json` | `data/mods/striking/actions/sucker_punch.action.json` |
| `data/mods/violence/rules/handle_punch_target.rule.json` | `data/mods/striking/rules/handle_punch_target.rule.json` |
| `data/mods/violence/rules/handle_slap_target.rule.json` | `data/mods/striking/rules/handle_slap_target.rule.json` |
| `data/mods/violence/rules/handle_sucker_punch.rule.json` | `data/mods/striking/rules/handle_sucker_punch.rule.json` |
| `data/mods/violence/conditions/actor-has-arm.condition.json` | `data/mods/striking/conditions/actor-has-arm.condition.json` |
| `data/mods/violence/conditions/event-is-action-punch-target.condition.json` | `data/mods/striking/conditions/event-is-action-punch-target.condition.json` |
| `data/mods/violence/conditions/event-is-action-slap-target.condition.json` | `data/mods/striking/conditions/event-is-action-slap-target.condition.json` |
| `data/mods/violence/conditions/event-is-action-sucker-punch.condition.json` | `data/mods/striking/conditions/event-is-action-sucker-punch.condition.json` |
| `data/mods/violence/macros/handleArmFumble.macro.json` | `data/mods/striking/macros/handleArmFumble.macro.json` |
| `data/mods/violence/scopes/actor_arm_body_parts.scope` | `data/mods/striking/scopes/actor_arm_body_parts.scope` |

### Update Manifests

- `data/mods/violence/mod-manifest.json` (remove moved files from content)
- `data/mods/striking/mod-manifest.json` (add moved files to content and required dependencies)

## Out of Scope

- Do NOT modify grabbing, lethal-violence, or creature-attacks content
- Do NOT update `data/game.json`
- Do NOT modify files in other mods (cross-references handled in VIOMIG-010)
- Do NOT delete violence mod directory
- Avoid unrelated refactors; only update manifests and migrated files

## Implementation Details

### ID Replacements (in all moved files)

| Old ID | New ID |
|--------|--------|
| `violence:punch_target` | `striking:punch_target` |
| `violence:slap_target` | `striking:slap_target` |
| `violence:sucker_punch` | `striking:sucker_punch` |
| `violence:actor-has-arm` | `striking:actor-has-arm` |
| `violence:actor_arm_body_parts` | `striking:actor_arm_body_parts` |
| `violence:handleArmFumble` | `striking:handleArmFumble` |

### Color Scheme Update (action files only)

Update `visual` property in all 3 action files to Bold Red:

```json
"visual": {
  "backgroundColor": "#c62828",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#d32f2f",
  "hoverTextColor": "#ffffff"
}
```

### Migration Process

1. Copy files to new location (preserve originals until verified)
2. Update all `violence:` references to `striking:` in copied files
3. Update color scheme in action files
4. Update `mod-manifest.json` entries for striking and violence
5. Validate all JSON files
6. Delete original files from violence mod

## Acceptance Criteria

### Tests
- [x] All action JSON files validate against action schema
- [x] All rule JSON files validate against rule schema
- [x] All condition JSON files validate against condition schema
- [x] All macro JSON files validate against macro schema
- [x] Scope file validates against scope schema
- [x] No `violence:` prefixes remain in any striking mod files
- [x] All files removed from `data/mods/violence/`
- [x] `mod-manifest.json` entries match the new file locations
- [x] Relevant tests updated/added if validation uncovers gaps (none identified)

### Invariants
- [x] 12 files total moved (3 actions, 3 rules, 4 conditions, 1 macro, 1 scope)
- [x] All internal references updated consistently
- [x] Color schemes match Bold Red specification
- [x] File names unchanged (only content and location changed)
- [x] `striking` manifest content mirrors the migrated files

## Dependencies

- VIOMIG-001 (color schemes documented)
- VIOMIG-002 (striking mod structure exists)

## Blocks

- VIOMIG-010 (cross-references need new IDs to reference)
- VIOMIG-012 (violence mod deletion)

## Verification Commands

```bash
# Verify no violence: references in striking mod
grep -r "violence:" data/mods/striking/

# Verify files removed from violence mod
ls data/mods/violence/actions/punch_target.action.json 2>/dev/null && echo "ERROR: File not removed"
ls data/mods/violence/actions/slap_target.action.json 2>/dev/null && echo "ERROR: File not removed"
ls data/mods/violence/actions/sucker_punch.action.json 2>/dev/null && echo "ERROR: File not removed"

# Validate JSON files
for f in data/mods/striking/**/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f'))"; done

# Verify color scheme in actions
grep -A 5 '"visual"' data/mods/striking/actions/*.json

# Validate the mod dependencies
npm run validate
```

## Outcome

- Added `striking` mod content and dependencies for migrated files, plus removed migrated entries from `violence` content.
- Updated migrated files to `striking:` IDs and Bold Red visuals, and removed the originals from `violence`.
- Removed now-unused `sitting-states` and `liquids-states` dependencies from `violence`.
- `npm run validate` still reports pre-existing violations in `anatomy` and `p_erotica_kern` manifests.
