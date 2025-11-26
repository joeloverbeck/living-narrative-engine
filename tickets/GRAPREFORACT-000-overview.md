# GRAPREFORACT-000: Grabbing Prerequisites for Actions - Overview

## Summary

This epic adds anatomy-based grabbing prerequisites to 9 action files across 4 mods. The grabbing limitation system ensures that actions requiring hands (or other grabbing appendages) are only available when the actor has sufficient free appendages.

**Example Use Case**: An actor wielding a longsword (which locks both hands) should not be able to brush back their hair, remove clothing, or pick up items until they unwield the weapon.

## Specification Source

`specs/grabbing-prerequisites-for-actions.md`

## Ticket List

### Implementation Tickets (Action File Modifications)

| Ticket | Mod | Actions | Appendages | Status |
|--------|-----|---------|------------|--------|
| [GRAPREFORACT-001](../archive/appendage-grabbing-system/GRAPREFORACT-001-clothing-mod-prerequisites.md) | clothing | `remove_clothing`, `remove_others_clothing` | 2 | ✅ |
| [GRAPREFORACT-002](../archive/appendage-grabbing-system/GRAPREFORACT-002-distress-mod-prerequisites-COMPLETED.md) | distress | `bury_face_in_hands`, `clutch_onto_upper_clothing` | 2, 1 | ✅ |
| [GRAPREFORACT-003](../archive/appendage-grabbing-system/GRAPREFORACT-003-exercise-mod-prerequisites-COMPLETED.md) | exercise | `show_off_biceps` | 2 (append) | ✅ |
| [GRAPREFORACT-004](./GRAPREFORACT-004-items-mod-prerequisites.md) | items | `drink_entirely`, `drink_from`, `pick_up_item`, `take_from_container` | 1 | ⬜ |

### Test Tickets (Integration Test Creation)

| Ticket | Mod | Test Files | Status |
|--------|-----|------------|--------|
| [GRAPREFORACT-005](./GRAPREFORACT-005-clothing-mod-tests.md) | clothing | 2 test files | ✅ |
| [GRAPREFORACT-006](./GRAPREFORACT-006-distress-mod-tests.md) | distress | 2 test files | ⬜ |
| [GRAPREFORACT-007](./GRAPREFORACT-007-exercise-mod-tests.md) | exercise | 1 test file (combined prereqs) | ⬜ |
| [GRAPREFORACT-008](./GRAPREFORACT-008-items-mod-tests.md) | items | 4 test files | ⬜ |

## Dependency Graph

```
GRAPREFORACT-001 (clothing actions) ──────► GRAPREFORACT-005 (clothing tests)
GRAPREFORACT-002 (distress actions) ──────► GRAPREFORACT-006 (distress tests)
GRAPREFORACT-003 (exercise actions) ──────► GRAPREFORACT-007 (exercise tests)
GRAPREFORACT-004 (items actions) ──────────► GRAPREFORACT-008 (items tests)
```

Implementation tickets (001-004) can be executed in parallel.
Test tickets (005-008) depend on their corresponding implementation ticket.

## Recommended Execution Order

**Phase 1: Implementation (parallelizable)**
1. GRAPREFORACT-001
2. GRAPREFORACT-002
3. GRAPREFORACT-003 ⚠️ (special case - append, don't replace)
4. GRAPREFORACT-004

**Phase 2: Testing (parallelizable after Phase 1)**
5. GRAPREFORACT-005
6. GRAPREFORACT-006
7. GRAPREFORACT-007 ⚠️ (special case - combined prerequisites)
8. GRAPREFORACT-008

## File Summary

### Files to Modify (9 action files)

| File | Change Type | Appendages |
|------|-------------|------------|
| `data/mods/clothing/actions/remove_clothing.action.json` | Populate empty prerequisites | 2 |
| `data/mods/clothing/actions/remove_others_clothing.action.json` | Populate empty prerequisites | 2 |
| `data/mods/distress/actions/bury_face_in_hands.action.json` | Populate empty prerequisites | 2 |
| `data/mods/distress/actions/clutch_onto_upper_clothing.action.json` | Populate empty prerequisites | 1 |
| `data/mods/exercise/actions/show_off_biceps.action.json` | **Append** to existing prerequisites | 2 |
| `data/mods/items/actions/drink_entirely.action.json` | Populate empty prerequisites | 1 |
| `data/mods/items/actions/drink_from.action.json` | Populate empty prerequisites | 1 |
| `data/mods/items/actions/pick_up_item.action.json` | Populate empty prerequisites | 1 |
| `data/mods/items/actions/take_from_container.action.json` | **Add** prerequisites key | 1 |

### Files to Create (9 test files)

| Test File |
|-----------|
| `tests/integration/mods/clothing/remove_clothing_prerequisites.test.js` |
| `tests/integration/mods/clothing/remove_others_clothing_prerequisites.test.js` |
| `tests/integration/mods/distress/bury_face_in_hands_prerequisites.test.js` |
| `tests/integration/mods/distress/clutch_onto_upper_clothing_prerequisites.test.js` |
| `tests/integration/mods/exercise/show_off_biceps_prerequisites.test.js` |
| `tests/integration/mods/items/drink_entirely_prerequisites.test.js` |
| `tests/integration/mods/items/drink_from_prerequisites.test.js` |
| `tests/integration/mods/items/pick_up_item_prerequisites.test.js` |
| `tests/integration/mods/items/take_from_container_prerequisites.test.js` |

### Existing Files (No Changes Required)

| File | Purpose |
|------|---------|
| `data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json` | Condition for 1 appendage |
| `data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json` | Condition for 2 appendages |
| `src/logic/operators/hasFreeGrabbingAppendagesOperator.js` | Operator implementation |
| `src/utils/grabbingUtils.js` | Utility functions |

### Reference Files

| File | Purpose |
|------|---------|
| `data/mods/weapons/actions/wield_threateningly.action.json` | Implementation pattern |
| `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js` | Test pattern |

## Validation Commands

```bash
# After all implementation tickets complete
npm run validate

# After all test tickets complete
npm run test:integration -- --testPathPattern="prerequisites"

# Full validation
npm run test:ci
```

## Condition Reference Quick Guide

| Appendages Required | Condition ID |
|---------------------|--------------|
| 1 | `anatomy:actor-has-free-grabbing-appendage` |
| 2 | `anatomy:actor-has-two-free-grabbing-appendages` |

## Special Cases

1. **GRAPREFORACT-003** (show_off_biceps): Must **append** to existing prerequisites, not replace
2. **GRAPREFORACT-004** (take_from_container): Must **add** new prerequisites key (doesn't exist)
3. **GRAPREFORACT-007** (show_off_biceps test): Must test **combined prerequisites** behavior
