# VIOMIG-010: Update Cross-References in Other Mods

**Status**: Completed
**Type**: Migration
**Priority**: High

## Summary

~~Update all `violence:` references in dependent mods to point to the new mod namespaces.~~

**REVISED (2025-12-29)**: Upon investigation, **no `violence:` references exist in data/mods/** outside the violence mod itself. The previous migration tickets (VIOMIG-003 through VIOMIG-009) already created the new mods with correctly namespaced IDs.

The actual work in this ticket was:
1. **Fix creature-attacks mod manifest** - missing content arrays and dependencies
2. **Clean up violence mod manifest** - remove unused dependencies (mod is now empty)

## Original Assumptions vs Actual State

### ❌ Original Assumption
> "Update all `violence:` references in dependent mods to point to the new mod namespaces"

### ✅ Actual State Found
```bash
grep -r "violence:" data/mods/ --include="*.json" --include="*.scope" | grep -v "data/mods/violence/"
# Returns: EMPTY - no violence: references exist outside the violence mod
```

All four new mods (striking, grabbing, lethal-violence, creature-attacks) already use their correct namespaces:
- `striking:punch_target`, `striking:actor-has-arm`, etc.
- `grabbing:grab_neck`, `grabbing:squeeze_neck_with_both_hands`
- `lethal-violence:tear_out_throat`
- `creature-attacks:peck_target`, `creature-attacks:actor-has-beak`, etc.

### Validation Issues Found

Running `npm run validate` revealed:
1. **creature-attacks**: 14 cross-reference violations and 6 unregistered files
   - Cause: Incomplete mod manifest (empty dependencies, no content arrays)
2. **violence**: Unused dependencies warning
   - Cause: All content migrated out but manifest still declares dependencies

## Revised Scope

### Files Modified
1. `data/mods/creature-attacks/mod-manifest.json` - Add dependencies and content arrays
2. `data/mods/violence/mod-manifest.json` - Remove unused dependencies

### No Changes Needed
- No `violence:` references to update in any mod files
- All action/rule/condition/scope/macro files already correctly namespaced

## Implementation Details

### creature-attacks/mod-manifest.json Changes

**Before**: Empty dependencies and no content declaration
```json
{
  "id": "creature-attacks",
  "version": "1.0.0",
  "name": "Creature Attacks",
  "description": "Non-humanoid combat actions like beak pecks and claw attacks",
  "dependencies": []
}
```

**After**: Complete manifest matching the action file requirements
- Dependencies derived from `peck_target.action.json` and `handle_peck_target.rule.json`:
  - damage-types (damage_capabilities component)
  - hugging-states, sex-states, performances-states, bending-states, physical-control-states, recovery-states (forbidden components)
  - skills (melee_skill, defense_skill references)
  - weapons (macros: handleMeleeCritical, handleMeleeHit, handleMeleeMiss)
  - anatomy (body_parts for beak scope)

### violence/mod-manifest.json Changes

**Before**: 10 dependencies declared for empty mod
**After**: Empty dependencies array (mod contains no content)

## Acceptance Criteria

### Tests
- [x] `grep -r "violence:" data/mods/` returns only files in `data/mods/violence/`
- [x] All affected mods pass validation (`npm run validate`)
- [x] No broken references in any mod

### Invariants
- [x] New mod content files (actions/rules/conditions/scopes/macros) unchanged
- [x] Only manifest files updated
- [x] No logic or behavior changes

## Dependencies

- VIOMIG-003 (striking migration complete - verified)
- VIOMIG-005 (grabbing migration complete - verified)
- VIOMIG-007 (lethal-violence migration complete - verified)
- VIOMIG-009 (creature-attacks migration complete - verified)

## Blocks

- VIOMIG-012 (violence mod deletion requires all references updated)

## Verification Commands

```bash
# Verify no violence: references outside violence mod (PASSES - empty result)
grep -r "violence:" data/mods/ --include="*.json" --include="*.scope" | grep -v "data/mods/violence/"

# Validate all mods (should show reduced violations)
npm run validate

# Verify new mod references work
grep -r "creature-attacks:" data/mods/ --include="*.json" --include="*.scope" | head -20
```

## Outcome

### Originally Planned
- Update `violence:` references in other mods to new namespaces (striking, grabbing, lethal-violence, creature-attacks)
- Expected to find and modify multiple files with old references

### Actual Changes Made

**Investigation revealed the original assumptions were incorrect:**
- No `violence:` references existed outside the violence mod itself
- Previous tickets (VIOMIG-003 through VIOMIG-009) had already migrated content with correct namespaces

**Manifest fixes applied:**

1. **`data/mods/creature-attacks/mod-manifest.json`** (fixed incomplete manifest)
   - Added 10 dependencies (damage-types, hugging-states, sex-states, performances-states, bending-states, physical-control-states, recovery-states, skills, weapons, anatomy)
   - Added content arrays declaring: 1 macro, 1 action, 1 rule, 2 conditions, 1 scope
   - Result: 14 cross-reference violations → 0 violations

2. **`data/mods/violence/mod-manifest.json`** (cleaned up empty mod)
   - Removed 10 unused dependencies (mod content was already migrated)
   - Result: Unused dependencies warning → clean validation

### Tests Executed
- `tests/integration/mods/creature-attacks/` - 45 tests PASS
- `tests/integration/mods/lethal-violence/` - 24 tests PASS
- `tests/integration/mods/striking/` - ~40 tests PASS
- `tests/integration/mods/grabbing/` - ~40 tests PASS
- `tests/integration/validation/modCrossReferenceValidator.integration.test.js` - 15 tests PASS

### Validation Result
Before: 22 cross-reference violations (14 from creature-attacks)
After: 8 cross-reference violations (unrelated mods: p_erotica_gymnast, comfort)
