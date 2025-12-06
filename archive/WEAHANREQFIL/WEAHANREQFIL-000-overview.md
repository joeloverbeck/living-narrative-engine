# WEAHANREQFIL-000: Weapon Hand Requirements Filtering - Overview

## Epic Summary

Implement weapon hand requirements filtering for the `wield_threateningly` action using custom JSON Logic operators. This ensures weapons requiring multiple hands (e.g., longswords) are only shown when the actor has sufficient free grabbing appendages.

## Problem Statement

The `wield_threateningly` action currently shows all weapons in inventory regardless of hand requirements:

- A longsword requiring 2 hands appears even when actor only has 1 free hand
- Items already being grabbed still appear in the weapon selection

## Solution Approach

Create two new JSON Logic operators and a new scope that filters weapons appropriately:

1. **`canActorGrabItem`** - Compares actor's free appendages against item's `handsRequired`
2. **`isItemBeingGrabbed`** - Checks if item is currently held by actor
3. **`weapons:grabbable_weapons_in_inventory`** - New scope combining both filters

## Ticket Dependency Graph

```
WEAHANREQFIL-001 (CanActorGrabItemOperator) ─┐
                                             ├─→ WEAHANREQFIL-003 (Register) ─→ WEAHANREQFIL-004 (Scope) ─→ WEAHANREQFIL-005 (Action)
WEAHANREQFIL-002 (IsItemBeingGrabbedOperator) ─┘
```

### Implementation Order

| Order | Ticket           | Description                       | Dependencies             |
| ----- | ---------------- | --------------------------------- | ------------------------ |
| 1a    | WEAHANREQFIL-001 | Create CanActorGrabItemOperator   | None (parallel with 002) |
| 1b    | WEAHANREQFIL-002 | Create IsItemBeingGrabbedOperator | None (parallel with 001) |
| 2     | WEAHANREQFIL-003 | Register both operators           | 001, 002                 |
| 3     | WEAHANREQFIL-004 | Create scope and update manifest  | 003                      |
| 4     | WEAHANREQFIL-005 | Update wield_threateningly action | 004                      |

## Files Affected (Complete List)

| File                                                                         | Ticket | Action |
| ---------------------------------------------------------------------------- | ------ | ------ |
| `src/logic/operators/canActorGrabItemOperator.js`                            | 001    | CREATE |
| `tests/unit/logic/operators/canActorGrabItemOperator.test.js`                | 001    | CREATE |
| `src/logic/operators/isItemBeingGrabbedOperator.js`                          | 002    | CREATE |
| `tests/unit/logic/operators/isItemBeingGrabbedOperator.test.js`              | 002    | CREATE |
| `src/logic/jsonLogicCustomOperators.js`                                      | 003    | MODIFY |
| `src/logic/jsonLogicEvaluationService.js`                                    | 003    | MODIFY |
| `data/mods/weapons/scopes/grabbable_weapons_in_inventory.scope`              | 004    | CREATE |
| `data/mods/weapons/mod-manifest.json`                                        | 004    | MODIFY |
| `tests/integration/mods/weapons/grabbable_weapons_scope.integration.test.js` | 004    | CREATE |
| `data/mods/weapons/actions/wield_threateningly.action.json`                  | 005    | MODIFY |
| `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`   | 005    | MODIFY |

## Reference Files (Read-Only)

These files inform the implementation but should NOT be modified:

- `src/logic/operators/hasFreeGrabbingAppendagesOperator.js` - Pattern reference
- `src/utils/grabbingUtils.js` - Utility functions to use
- `src/logic/operators/utils/entityPathResolver.js` - Entity resolution utilities
- `src/logic/operators/base/BaseEquipmentOperator.js` - Base class pattern
- `data/mods/weapons/scopes/weapons_in_inventory.scope` - Existing scope (preserved)

## Design Decisions

1. **New scope, not modified**: Create `grabbable_weapons_in_inventory` to preserve backward compatibility
2. **Default handsRequired = 1**: Weapons without `anatomy:requires_grabbing` default to requiring 1 hand
3. **Operator signature `["actor", "entity"]`**: Follows existing two-argument operator patterns
4. **Filter context uses `"entity"`**: Explicit about what's being evaluated in scope filters

## Edge Cases

| Scenario                                   | Expected Behavior                        |
| ------------------------------------------ | ---------------------------------------- |
| Actor without `anatomy:body`               | No weapons wieldable (0 free appendages) |
| Weapon without `anatomy:requires_grabbing` | Defaults to 1 hand required              |
| Item with `handsRequired: 0`               | Always wieldable (rings, etc.)           |
| Already-held item                          | Excluded by `isItemBeingGrabbed` check   |

## Success Criteria

1. All tickets completed in order
2. All unit tests pass with >80% coverage
3. All integration tests pass
4. `npm run validate:mod:weapons` passes
5. `npm run scope:lint` passes
6. Existing functionality unaffected
7. Manual verification:
   - 1-hand weapon appears when actor has 1 free hand
   - 2-hand weapon hidden when actor has only 1 free hand
   - 2-hand weapon appears when actor has 2 free hands
   - Wielded weapons don't appear in selection

## Estimated Total Effort

- WEAHANREQFIL-001: ~350 lines (operator + tests)
- WEAHANREQFIL-002: ~300 lines (operator + tests)
- WEAHANREQFIL-003: ~15 lines (registration)
- WEAHANREQFIL-004: ~160 lines (scope + tests)
- WEAHANREQFIL-005: ~60 lines (action + test updates)

**Total**: ~885 lines across 5 tickets
