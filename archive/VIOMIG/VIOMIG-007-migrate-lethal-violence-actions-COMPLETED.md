# VIOMIG-007: Migrate Lethal Violence Actions and Supporting Files

**Status**: Completed
**Type**: Migration
**Priority**: High

## Summary

Migrate tear_out_throat action with supporting rule/condition from violence mod to lethal-violence mod. Update all IDs from `violence:` to `lethal-violence:` namespace (including condition refs) and apply Dark Red Alert color scheme.

## Files to Touch

### Move and Update

| Source | Destination |
|--------|-------------|
| `data/mods/violence/actions/tear_out_throat.action.json` | `data/mods/lethal-violence/actions/tear_out_throat.action.json` |
| `data/mods/violence/rules/handle_tear_out_throat.rule.json` | `data/mods/lethal-violence/rules/handle_tear_out_throat.rule.json` |
| `data/mods/violence/conditions/event-is-action-tear-out-throat.condition.json` | `data/mods/lethal-violence/conditions/event-is-action-tear-out-throat.condition.json` |
| `data/mods/violence/mod-manifest.json` | `data/mods/violence/mod-manifest.json` |
| `data/mods/lethal-violence/mod-manifest.json` | `data/mods/lethal-violence/mod-manifest.json` |

## Out of Scope

- Do NOT modify striking, grabbing, or creature-attacks content
- Do NOT update `data/game.json`
- Do NOT modify files in other mods (cross-references handled in VIOMIG-010)
- Do NOT delete violence mod directory

## Implementation Details

### ID Replacements (in all moved files)

| Old ID | New ID |
|--------|--------|
| `violence:tear_out_throat` | `lethal-violence:tear_out_throat` |

### Color Scheme Update (action files only)

Update `visual` property in action file to Dark Red Alert:

```json
"visual": {
  "backgroundColor": "#b71c1c",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#c62828",
  "hoverTextColor": "#ffffff"
}
```

### Migration Process

1. Copy files to new location (preserve originals until verified)
2. Update all `violence:` references to `lethal-violence:` in copied files
3. Update color scheme in action file
4. Update mod manifests to remove/add file listings and dependencies
5. Validate all JSON files
6. Delete original files from violence mod

## Acceptance Criteria

### Tests
- [ ] All action JSON files validate against action schema
- [ ] All rule JSON files validate against rule schema
- [ ] All condition JSON files validate against condition schema
- [ ] No `violence:` prefixes remain in any lethal-violence mod files
- [ ] All files removed from `data/mods/violence/`
- [ ] New/updated tests cover manifest updates and migrated IDs

### Invariants
- [ ] 3 files total moved (1 action, 1 rule, 1 condition)
- [ ] All internal references updated consistently
- [ ] Color scheme matches Dark Red Alert specification
- [ ] File names unchanged (only content and location changed)

## Dependencies

- VIOMIG-001 (color schemes documented)
- VIOMIG-006 (lethal-violence mod structure exists)

## Blocks

- VIOMIG-010 (cross-references need new IDs to reference)
- VIOMIG-012 (violence mod deletion)

## Verification Commands

```bash
# Verify no violence: references in lethal-violence mod
grep -r "violence:" data/mods/lethal-violence/

# Verify files removed from violence mod
ls data/mods/violence/actions/tear_out_throat.action.json 2>/dev/null && echo "ERROR: File not removed"

# Validate JSON files
for f in data/mods/lethal-violence/**/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f'))"; done

# Verify color scheme in actions
grep -A 5 '"visual"' data/mods/lethal-violence/actions/*.json

# Verify mod dependencies
npm run validate
```

## Outcome

- Migrated tear_out_throat action/rule/condition into lethal-violence with updated IDs and Dark Red Alert visuals, and removed the originals from violence.
- Updated both mod manifests to add/remove the migrated files and declare the biting-states dependency.
- Updated integration tests to reference the lethal-violence mod and its visual scheme.
