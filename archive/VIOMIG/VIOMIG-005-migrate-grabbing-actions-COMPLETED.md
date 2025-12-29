# VIOMIG-005: Migrate Grabbing Actions and Supporting Files

**Status**: Completed
**Type**: Migration
**Priority**: High

## Summary

Migrate grab_neck and squeeze_neck_with_both_hands actions with all supporting files (rules, conditions) from violence mod to grabbing mod. Update all IDs from `violence:` to `grabbing:` namespace, apply Grip Iron color scheme, and register the new files in the grabbing mod manifest so they load.

## Files to Touch

### Move and Update

| Source | Destination |
|--------|-------------|
| `data/mods/violence/actions/grab_neck.action.json` | `data/mods/grabbing/actions/grab_neck.action.json` |
| `data/mods/violence/actions/squeeze_neck_with_both_hands.action.json` | `data/mods/grabbing/actions/squeeze_neck_with_both_hands.action.json` |
| `data/mods/violence/rules/handle_grab_neck.rule.json` | `data/mods/grabbing/rules/handle_grab_neck.rule.json` |
| `data/mods/violence/rules/handle_squeeze_neck_with_both_hands.rule.json` | `data/mods/grabbing/rules/handle_squeeze_neck_with_both_hands.rule.json` |
| `data/mods/violence/conditions/event-is-action-grab-neck.condition.json` | `data/mods/grabbing/conditions/event-is-action-grab-neck.condition.json` |
| `data/mods/violence/conditions/event-is-action-squeeze-neck-with-both-hands.condition.json` | `data/mods/grabbing/conditions/event-is-action-squeeze-neck-with-both-hands.condition.json` |

### Update In Place

- `data/mods/grabbing/mod-manifest.json` (register new actions, rules, conditions)
- `data/mods/violence/mod-manifest.json` (remove migrated files from manifest lists)

## Out of Scope

- Do NOT modify striking, lethal-violence, or creature-attacks content
- Do NOT update `data/game.json`
- Do NOT modify files in other mods (cross-references handled in VIOMIG-010), except for removing migrated file references from the violence mod manifest
- Do NOT delete violence mod directory
- Test updates are allowed when needed to cover invariants or regressions

## Implementation Details

### ID Replacements (in all moved files)

| Old ID | New ID |
|--------|--------|
| `violence:grab_neck` | `grabbing:grab_neck` |
| `violence:squeeze_neck_with_both_hands` | `grabbing:squeeze_neck_with_both_hands` |

### Color Scheme Update (action files only)

Update `visual` property in both action files to Grip Iron:

```json
"visual": {
  "backgroundColor": "#4a4a4a",
  "textColor": "#f5f5f5",
  "hoverBackgroundColor": "#5a5a5a",
  "hoverTextColor": "#ffffff"
}
```

### Migration Process

1. Copy files to new location (preserve originals until verified)
2. Update all `violence:` references to `grabbing:` in copied files (including condition refs and comments)
3. Update color scheme in action files
4. Register the new files in `data/mods/grabbing/mod-manifest.json`
5. Add missing grabbing dependencies required by the migrated actions
6. Validate all JSON files
7. Delete original files from violence mod

## Acceptance Criteria

### Tests
- [ ] All action JSON files validate against action schema
- [ ] All rule JSON files validate against rule schema
- [ ] All condition JSON files validate against condition schema
- [ ] No `violence:` prefixes remain in any grabbing mod files
- [ ] All files removed from `data/mods/violence/`
- [ ] Grabbing mod manifest lists the new action, rule, and condition files
- [ ] Grabbing mod manifest declares dependencies introduced by migrated actions
- [ ] Violence mod manifest no longer references migrated files

### Invariants
- [ ] 6 files total moved (2 actions, 2 rules, 2 conditions)
- [ ] All internal references updated consistently
- [ ] Color schemes match Grip Iron specification
- [ ] File names unchanged (only content and location changed)

## Dependencies

- VIOMIG-001 (color schemes documented)
- VIOMIG-004 (grabbing mod structure exists)

## Blocks

- VIOMIG-006 (lethal-violence depends on grabbing being complete)
- VIOMIG-010 (cross-references need new IDs to reference)
- VIOMIG-012 (violence mod deletion)

## Verification Commands

```bash
# Verify no violence: references in grabbing mod
grep -r "violence:" data/mods/grabbing/

# Verify files removed from violence mod
ls data/mods/violence/actions/grab_neck.action.json 2>/dev/null && echo "ERROR: File not removed"
ls data/mods/violence/actions/squeeze_neck_with_both_hands.action.json 2>/dev/null && echo "ERROR: File not removed"

# Validate JSON files
for f in data/mods/grabbing/**/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f'))"; done

# Verify color scheme in actions
grep -A 5 '"visual"' data/mods/grabbing/actions/*.json

# Validate mod dependencies
npm run validate
```

## Outcome

Moved the two neck-grab actions, rules, and conditions into the grabbing mod with updated IDs and Grip Iron visuals; registered them in the grabbing manifest with new dependencies. Updated the violence manifest to drop migrated files and unused dependencies so validation passes.
