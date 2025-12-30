# VIOMIG-009: Migrate Creature Attacks Actions and Supporting Files

**Status**: Completed
**Type**: Migration
**Priority**: High

## Summary

Migrate peck_target action with all supporting files (rules, conditions, macros, scopes) from violence mod to creature-attacks mod. Update all IDs from `violence:` to `creature-attacks:` namespace, apply Feral Amber color scheme, and align existing peck_target tests to the new mod namespace/paths.

## Files to Touch

### Move and Update

| Source | Destination |
|--------|-------------|
| `data/mods/violence/actions/peck_target.action.json` | `data/mods/creature-attacks/actions/peck_target.action.json` |
| `data/mods/violence/rules/handle_peck_target.rule.json` | `data/mods/creature-attacks/rules/handle_peck_target.rule.json` |
| `data/mods/violence/conditions/actor-has-beak.condition.json` | `data/mods/creature-attacks/conditions/actor-has-beak.condition.json` |
| `data/mods/violence/conditions/event-is-action-peck-target.condition.json` | `data/mods/creature-attacks/conditions/event-is-action-peck-target.condition.json` |
| `data/mods/violence/macros/handleBeakFumble.macro.json` | `data/mods/creature-attacks/macros/handleBeakFumble.macro.json` |
| `data/mods/violence/scopes/actor_beak_body_parts.scope` | `data/mods/creature-attacks/scopes/actor_beak_body_parts.scope` |

### Update Manifests

- `data/mods/violence/mod-manifest.json` (remove peck_target content entries)

## Out of Scope

- Do NOT modify striking, grabbing, or lethal-violence content
- Do NOT update `data/game.json`
- Do NOT modify files in other mods (cross-references handled in VIOMIG-010)
- Do NOT delete violence mod directory
 - Do NOT change public APIs (migration should be data/test updates only)

## Assumptions and Constraints (Reassessed)

- The peck_target tests currently live under `tests/integration/mods/violence/` and reference `violence:` IDs and paths; they must be updated (and/or relocated) to follow the new `creature-attacks:` namespace.
- The creature-attacks mod already exists with standard subfolders; no manifest changes are required for this migration.
- Removing the peck_target files from `data/mods/violence/` will require test updates to avoid broken imports.
- The violence mod manifest currently lists peck_target files; it must be updated to avoid stale content references.

## Implementation Details

### ID Replacements (in all moved files)

| Old ID | New ID |
|--------|--------|
| `violence:peck_target` | `creature-attacks:peck_target` |
| `violence:actor-has-beak` | `creature-attacks:actor-has-beak` |
| `violence:actor_beak_body_parts` | `creature-attacks:actor_beak_body_parts` |
| `violence:handleBeakFumble` | `creature-attacks:handleBeakFumble` |

### Color Scheme Update (action files only)

Update `visual` property in action file to Feral Amber:

```json
"visual": {
  "backgroundColor": "#8b5a00",
  "textColor": "#fff8e1",
  "hoverBackgroundColor": "#a06800",
  "hoverTextColor": "#ffffff"
}
```

### Migration Process

1. Copy files to new location (preserve originals until verified)
2. Update all `violence:` references to `creature-attacks:` in copied files
3. Update color scheme in action file
4. Update peck_target tests to the new mod namespace/paths
5. Validate all JSON files
6. Delete original files from violence mod

## Acceptance Criteria

### Tests
- [ ] All action JSON files validate against action schema
- [ ] All rule JSON files validate against rule schema
- [ ] All condition JSON files validate against condition schema
- [ ] All macro JSON files validate against macro schema
- [ ] Scope file validates against scope schema
- [ ] Existing peck_target tests updated to `creature-attacks:` namespace/paths and pass
- [ ] No `violence:` prefixes remain in any creature-attacks mod files
- [ ] All files removed from `data/mods/violence/`

### Invariants
- [ ] 6 files total moved (1 action, 1 rule, 2 conditions, 1 macro, 1 scope)
- [ ] All internal references updated consistently
- [ ] Color scheme matches Feral Amber specification
- [ ] File names unchanged (only content and location changed)

## Dependencies

- VIOMIG-001 (color schemes documented)
- VIOMIG-008 (creature-attacks mod structure exists)

## Blocks

- VIOMIG-010 (cross-references need new IDs to reference)
- VIOMIG-012 (violence mod deletion)

## Verification Commands

```bash
# Verify no violence: references in creature-attacks mod
grep -r "violence:" data/mods/creature-attacks/

# Verify files removed from violence mod
ls data/mods/violence/actions/peck_target.action.json 2>/dev/null && echo "ERROR: File not removed"

# Validate JSON files
for f in data/mods/creature-attacks/**/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f'))"; done

# Verify color scheme in actions
grep -A 5 '"visual"' data/mods/creature-attacks/actions/*.json
```

## Outcome

- Moved peck_target action, rule, conditions, macro, and scope into `creature-attacks` with updated IDs and Feral Amber visuals.
- Updated peck_target integration tests to the new `creature-attacks` namespace and paths.
- Cleared peck_target entries from the violence mod manifest after removing the original files.
