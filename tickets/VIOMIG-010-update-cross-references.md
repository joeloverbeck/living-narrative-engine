# VIOMIG-010: Update Cross-References in Other Mods

**Status**: Open
**Type**: Migration
**Priority**: High

## Summary

Update all `violence:` references in dependent mods to point to the new mod namespaces. This ensures all mods that reference violence actions, conditions, macros, or scopes are updated to use the correct new IDs.

## Files to Touch

- Search and update all files in `data/mods/` containing `violence:` references
- Expected mods with potential references: any mod that references violence actions in rules, conditions, or scopes

**Note**: The exact file list will be determined by running:
```bash
grep -r "violence:" data/mods/ --include="*.json" --include="*.scope" | grep -v "data/mods/violence/"
```

## Out of Scope

- Do NOT modify the 4 new mods (striking, grabbing, lethal-violence, creature-attacks)
- Do NOT delete the violence mod yet
- Do NOT update `data/game.json` yet
- Do NOT update tests (handled in VIOMIG-011)

## Implementation Details

### Reference Mapping

| Old Reference | New Reference |
|---------------|---------------|
| `violence:punch_target` | `striking:punch_target` |
| `violence:slap_target` | `striking:slap_target` |
| `violence:sucker_punch` | `striking:sucker_punch` |
| `violence:actor-has-arm` | `striking:actor-has-arm` |
| `violence:actor_arm_body_parts` | `striking:actor_arm_body_parts` |
| `violence:handleArmFumble` | `striking:handleArmFumble` |
| `violence:grab_neck` | `grabbing:grab_neck` |
| `violence:squeeze_neck_with_both_hands` | `grabbing:squeeze_neck_with_both_hands` |
| `violence:tear_out_throat` | `lethal-violence:tear_out_throat` |
| `violence:peck_target` | `creature-attacks:peck_target` |
| `violence:actor-has-beak` | `creature-attacks:actor-has-beak` |
| `violence:actor_beak_body_parts` | `creature-attacks:actor_beak_body_parts` |
| `violence:handleBeakFumble` | `creature-attacks:handleBeakFumble` |

### Update Process

1. Run grep to find all files with `violence:` references outside violence mod
2. For each file, identify which references need updating
3. Apply the reference mapping above
4. Validate the updated JSON files
5. Verify no remaining `violence:` references exist (except in violence mod itself)

## Acceptance Criteria

### Tests
- [ ] `grep -r "violence:" data/mods/` returns only files in `data/mods/violence/`
- [ ] All affected mods pass validation (`npm run validate`)
- [ ] No broken references in any mod

### Invariants
- [ ] New mod files (striking, grabbing, lethal-violence, creature-attacks) unchanged
- [ ] Only reference IDs updated, not logic or behavior
- [ ] All ID updates match the mapping table exactly
- [ ] No files in violence mod are modified (handled in previous tickets)

## Dependencies

- VIOMIG-003 (striking migration complete - new IDs exist)
- VIOMIG-005 (grabbing migration complete - new IDs exist)
- VIOMIG-007 (lethal-violence migration complete - new IDs exist)
- VIOMIG-009 (creature-attacks migration complete - new IDs exist)

## Blocks

- VIOMIG-012 (violence mod deletion requires all references updated)

## Verification Commands

```bash
# Find all violence: references outside violence mod (should be empty after completion)
grep -r "violence:" data/mods/ --include="*.json" --include="*.scope" | grep -v "data/mods/violence/"

# Validate all mods
npm run validate

# Verify new mod references work
grep -r "striking:" data/mods/ --include="*.json" --include="*.scope" | head -20
grep -r "grabbing:" data/mods/ --include="*.json" --include="*.scope" | head -20
grep -r "lethal-violence:" data/mods/ --include="*.json" --include="*.scope" | head -20
grep -r "creature-attacks:" data/mods/ --include="*.json" --include="*.scope" | head -20
```
