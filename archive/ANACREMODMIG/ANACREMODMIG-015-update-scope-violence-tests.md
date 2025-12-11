# ANACREMODMIG-015: Update Scope and Violence Tests

**STATUS: ✅ COMPLETED - No Changes Required**

## Summary
Update test files in scopes and violence directories that reference creature entities to use the new `anatomy-creatures:` namespace.

## Investigation Findings

**After reviewing the test files, no changes are required.**

### actorBeakBodyParts.integration.test.js
- **Finding**: This test does NOT reference any `anatomy:beak`, `anatomy:chicken_beak`, `anatomy:tortoise_beak` entity IDs
- **Reason**: The test creates local test entities with IDs like `test:bird-creature:beak_part`, `test:chicken:chicken_beak_part`
- **SubType values**: The strings `"beak"`, `"chicken_beak"`, `"tortoise_beak"` appear as **component property values**, not entity namespace IDs
- **Result**: No namespace changes needed

### peck_target_action_discovery.test.js
- **Finding**: This test does NOT reference any creature entities from the `anatomy` or `anatomy-creatures` namespace
- **Reason**: Test uses local mock data and component property values (e.g., `subType: 'chicken_beak'`)
- **Result**: No namespace changes needed

## Original Assumptions (INCORRECT)
The ticket originally assumed these changes were needed:

| Old | New | Status |
|-----|-----|--------|
| `anatomy:beak` | `anatomy-creatures:beak` | NOT FOUND in tests |
| `anatomy:chicken_beak` | `anatomy-creatures:chicken_beak` | NOT FOUND in tests |
| `anatomy:tortoise_beak` | `anatomy-creatures:tortoise_beak` | NOT FOUND in tests |
| `anatomy:chicken_*` | `anatomy-creatures:chicken_*` | NOT FOUND in tests |
| `anatomy:hen` | `anatomy-creatures:hen` | NOT FOUND in tests |
| `anatomy:rooster` | `anatomy-creatures:rooster` | NOT FOUND in tests |

## Files Actually Reviewed

### Modify: NONE
- `tests/integration/scopes/violence/actorBeakBodyParts.integration.test.js` - No changes needed
- `tests/integration/mods/violence/peck_target_action_discovery.test.js` - No changes needed

## Verification Results

### Tests Pass
```
PASS tests/integration/mods/violence/peck_target_action_discovery.test.js
PASS tests/integration/scopes/violence/actorBeakBodyParts.integration.test.js

Test Suites: 2 passed, 2 total
Tests:       29 passed, 29 total
```

### Grep Verification
```bash
# No anatomy: creature refs found
grep -r "anatomy:(beak|chicken|tortoise|hen|rooster)" tests/integration/scopes/violence/
# Result: No files found

grep -r "anatomy:(beak|chicken|tortoise|hen|rooster)" tests/integration/mods/violence/
# Result: No files found
```

## Out of Scope
- Violence action/rule definitions - NOT modified (as specified)
- Test logic - NOT modified (as specified)
- Test file locations - NOT modified (as specified)

## Acceptance Criteria

### Tests that must pass ✅
- Beak-related scope tests pass: **VERIFIED**
- Violence peck_target tests pass: **VERIFIED**

### Invariants that must remain true ✅
- Test assertions remain the same: **PRESERVED**
- Violence action logic unchanged: **PRESERVED**
- Test file locations unchanged: **PRESERVED**

## Dependencies
- ANACREMODMIG-006f (chicken entities migrated) - Completed
- ANACREMODMIG-006g (beak entity migrated) - Completed
- ANACREMODMIG-009 (game.json updated so mod loads) - Required for full system tests

## Blocks
- ANACREMODMIG-016 (final test validation) - This ticket unblocks it

---

## Outcome

**What was actually changed vs originally planned:**

| Originally Planned | Actual |
|-------------------|--------|
| Update `actorBeakBodyParts.integration.test.js` with new namespace references | No changes - test uses local test entities, not mod entity IDs |
| Update `peck_target_action_discovery.test.js` if chicken entities referenced | No changes - test uses mock data with component property values |
| Change `anatomy:beak` → `anatomy-creatures:beak` | Not applicable - no such references exist |
| Change `anatomy:chicken_*` → `anatomy-creatures:chicken_*` | Not applicable - no such references exist |

**Root Cause of Discrepancy:**
The original ticket assumed that tests referencing "beak" concepts would use namespaced entity IDs (e.g., `anatomy:beak`). However, these tests:
1. Create local test entities with `test:` namespace IDs
2. Use component property values (`subType: "chicken_beak"`) which are strings, not namespace references
3. Do not load actual mod entities - they mock everything

**Files Modified:** 0 test files
**Tests Verified:** 29 tests pass across 2 test suites
