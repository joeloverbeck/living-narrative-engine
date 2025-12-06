# GRAPREFORACT-000: Grabbing Prerequisites for Actions - Overview

## Status: ✅ COMPLETED (All 8 tickets)

## Summary

This epic adds anatomy-based grabbing prerequisites to 9 action files across 4 mods. The grabbing limitation system ensures that actions requiring hands (or other grabbing appendages) are only available when the actor has sufficient free appendages.

**Example Use Case**: An actor wielding a longsword (which locks both hands) should not be able to brush back their hair, remove clothing, or pick up items until they unwield the weapon.

## Specification Source

`archive/appendage-grabbing-system/grabbing-prerequisites-for-actions-spec.md`

## Ticket List

### Implementation Tickets (Action File Modifications)

| Ticket                                                                         | Mod      | Actions                                                               | Appendages | Status |
| ------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------- | ---------- | ------ |
| [GRAPREFORACT-001](./GRAPREFORACT-001-clothing-mod-prerequisites.md)           | clothing | `remove_clothing`, `remove_others_clothing`                           | 2          | ✅     |
| [GRAPREFORACT-002](./GRAPREFORACT-002-distress-mod-prerequisites-COMPLETED.md) | distress | `bury_face_in_hands`, `clutch_onto_upper_clothing`                    | 2, 1       | ✅     |
| [GRAPREFORACT-003](./GRAPREFORACT-003-exercise-mod-prerequisites-COMPLETED.md) | exercise | `show_off_biceps`                                                     | 2 (append) | ✅     |
| [GRAPREFORACT-004](./GRAPREFORACT-004-items-mod-prerequisites-COMPLETED.md)    | items    | `drink_entirely`, `drink_from`, `pick_up_item`, `take_from_container` | 1          | ✅     |

### Test Tickets (Integration Test Creation)

| Ticket                                                                 | Mod      | Test Files                     | Status |
| ---------------------------------------------------------------------- | -------- | ------------------------------ | ------ |
| [GRAPREFORACT-005](./GRAPREFORACT-005-clothing-mod-tests-COMPLETED.md) | clothing | 2 test files                   | ✅     |
| [GRAPREFORACT-006](./GRAPREFORACT-006-distress-mod-tests-COMPLETED.md) | distress | 2 test files                   | ✅     |
| [GRAPREFORACT-007](./GRAPREFORACT-007-exercise-mod-tests-COMPLETED.md) | exercise | 1 test file (combined prereqs) | ✅     |
| [GRAPREFORACT-008](./GRAPREFORACT-008-items-mod-tests-COMPLETED.md)    | items    | 4 test files                   | ✅     |

## Dependency Graph

```
GRAPREFORACT-001 (clothing actions) ──────► GRAPREFORACT-005 (clothing tests) ✅
GRAPREFORACT-002 (distress actions) ──────► GRAPREFORACT-006 (distress tests) ✅
GRAPREFORACT-003 (exercise actions) ──────► GRAPREFORACT-007 (exercise tests) ✅
GRAPREFORACT-004 (items actions) ──────────► GRAPREFORACT-008 (items tests) ✅
```

## Execution Summary

**Phase 1: Implementation (all completed)**

1. ✅ GRAPREFORACT-001 - Clothing mod prerequisites
2. ✅ GRAPREFORACT-002 - Distress mod prerequisites
3. ✅ GRAPREFORACT-003 - Exercise mod prerequisites (append, not replace)
4. ✅ GRAPREFORACT-004 - Items mod prerequisites

**Phase 2: Testing (all completed)** 5. ✅ GRAPREFORACT-005 - Clothing mod tests 6. ✅ GRAPREFORACT-006 - Distress mod tests 7. ✅ GRAPREFORACT-007 - Exercise mod tests (combined prerequisites) 8. ✅ GRAPREFORACT-008 - Items mod tests

## File Summary

### Files Modified (9 action files)

| File                                                                | Change Type                          | Appendages |
| ------------------------------------------------------------------- | ------------------------------------ | ---------- |
| `data/mods/clothing/actions/remove_clothing.action.json`            | Populate empty prerequisites         | 2          |
| `data/mods/clothing/actions/remove_others_clothing.action.json`     | Populate empty prerequisites         | 2          |
| `data/mods/distress/actions/bury_face_in_hands.action.json`         | Populate empty prerequisites         | 2          |
| `data/mods/distress/actions/clutch_onto_upper_clothing.action.json` | Populate empty prerequisites         | 1          |
| `data/mods/exercise/actions/show_off_biceps.action.json`            | **Append** to existing prerequisites | 2          |
| `data/mods/items/actions/drink_entirely.action.json`                | Populate empty prerequisites         | 1          |
| `data/mods/items/actions/drink_from.action.json`                    | Populate empty prerequisites         | 1          |
| `data/mods/items/actions/pick_up_item.action.json`                  | Populate empty prerequisites         | 1          |
| `data/mods/items/actions/take_from_container.action.json`           | **Add** prerequisites key            | 1          |

### Files Created (9 test files)

| Test File                                                                          | Status |
| ---------------------------------------------------------------------------------- | ------ |
| `tests/integration/mods/clothing/remove_clothing_prerequisites.test.js`            | ✅     |
| `tests/integration/mods/clothing/remove_others_clothing_prerequisites.test.js`     | ✅     |
| `tests/integration/mods/distress/bury_face_in_hands_prerequisites.test.js`         | ✅     |
| `tests/integration/mods/distress/clutch_onto_upper_clothing_prerequisites.test.js` | ✅     |
| `tests/integration/mods/exercise/show_off_biceps_prerequisites.test.js`            | ✅     |
| `tests/integration/mods/items/drink_entirely_prerequisites.test.js`                | ✅     |
| `tests/integration/mods/items/drink_from_prerequisites.test.js`                    | ✅     |
| `tests/integration/mods/items/pick_up_item_prerequisites.test.js`                  | ✅     |
| `tests/integration/mods/items/take_from_container_prerequisites.test.js`           | ✅     |

### Existing Files (No Changes Required)

| File                                                                                 | Purpose                    |
| ------------------------------------------------------------------------------------ | -------------------------- |
| `data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json`      | Condition for 1 appendage  |
| `data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json` | Condition for 2 appendages |
| `src/logic/operators/hasFreeGrabbingAppendagesOperator.js`                           | Operator implementation    |
| `src/utils/grabbingUtils.js`                                                         | Utility functions          |

### Reference Files

| File                                                                       | Purpose                |
| -------------------------------------------------------------------------- | ---------------------- |
| `data/mods/weapons/actions/wield_threateningly.action.json`                | Implementation pattern |
| `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js` | Test pattern           |

## Condition Reference Quick Guide

| Appendages Required | Condition ID                                     |
| ------------------- | ------------------------------------------------ |
| 1                   | `anatomy:actor-has-free-grabbing-appendage`      |
| 2                   | `anatomy:actor-has-two-free-grabbing-appendages` |

## Special Cases Handled

1. **GRAPREFORACT-003** (show_off_biceps): Successfully **appended** to existing prerequisites, not replaced
2. **GRAPREFORACT-004** (take_from_container): Successfully **added** new prerequisites key
3. **GRAPREFORACT-007** (show_off_biceps test): Successfully tested **combined prerequisites** behavior

## Outcome

All 8 tickets in this epic have been successfully completed:

- 9 action files modified with grabbing prerequisites
- 9 integration test files created following the established pattern
- All tests pass (total: 100+ tests across all prerequisite test files)
- No regressions introduced
