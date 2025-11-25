# Specification: Weapon Hand Requirements Filtering via Custom JSON Logic Operators

## Problem Statement

The `wield_threateningly` action currently checks if the actor has at least 1 free grabbing appendage, but doesn't validate whether the actor has **enough** appendages for the specific weapon being targeted. For example:
- A longsword requiring 2 hands should not appear as wieldable when the actor only has 1 free hand
- Items already being grabbed should be excluded from weapon selection

## Chosen Approach: Custom JSON Logic Operators

Create two new operators:
1. **`canActorGrabItem`** - Compares actor's free appendages against item's `handsRequired`
2. **`isItemBeingGrabbed`** - Checks if item is currently held by actor

### Rationale
- Most explicit approach - scope definitions clearly show filtering logic
- Isolated from core scopeDSL engine - no changes to FilterResolver or entityHelpers
- Operators can be reused in conditions, not just scopes
- Zero overhead for scopes that don't use grabbing logic

## Implementation Plan

### Phase 1: Create `CanActorGrabItemOperator`

**File**: `src/logic/operators/canActorGrabItemOperator.js` (NEW)

```javascript
// Usage: { "canActorGrabItem": ["actor", "entity"] }
// Returns: true if actor has >= handsRequired free appendages
// Default: Items without anatomy:requires_grabbing default to 1 hand
```

Key logic:
1. Resolve actor and item entity IDs from context
2. Get item's `anatomy:requires_grabbing.handsRequired` (default: 1)
3. Get actor's free appendage count via `countFreeGrabbingAppendages()`
4. Return `freeAppendages >= handsRequired`

### Phase 2: Create `IsItemBeingGrabbedOperator`

**File**: `src/logic/operators/isItemBeingGrabbedOperator.js` (NEW)

```javascript
// Usage: { "isItemBeingGrabbed": ["actor", "entity"] }
// Returns: true if item is in actor's heldItemIds
```

Key logic:
1. Resolve actor and item entity IDs
2. Get held items via `getHeldItems(entityManager, actorId)`
3. Return `heldItemIds.includes(itemId)`

### Phase 3: Register Operators

**File**: `src/logic/jsonLogicCustomOperators.js` (MODIFY)

Add imports and register both operators following the existing pattern.

**File**: `src/logic/jsonLogicEvaluationService.js` (MODIFY)

Add operators to `#allowedOperations` whitelist.

### Phase 4: Create New Scope

**File**: `data/mods/weapons/scopes/grabbable_weapons_in_inventory.scope` (NEW)

```
weapons:grabbable_weapons_in_inventory := actor.components.items:inventory.items[][{"and": [{"!!": {"var": "entity.components.weapons:weapon"}}, {"canActorGrabItem": ["actor", "entity"]}, {"not": {"isItemBeingGrabbed": ["actor", "entity"]}}]}]
```

**File**: `data/mods/weapons/mod-manifest.json` (MODIFY)

Add new scope file to manifest.

### Phase 5: Update Action

**File**: `data/mods/weapons/actions/wield_threateningly.action.json` (MODIFY)

Change target scope from `weapons:weapons_in_inventory` to `weapons:grabbable_weapons_in_inventory`.

### Phase 6: Testing

Create comprehensive tests:
- `tests/unit/logic/operators/canActorGrabItemOperator.test.js`
- `tests/unit/logic/operators/isItemBeingGrabbedOperator.test.js`
- `tests/integration/mods/weapons/grabbable_weapons_scope.integration.test.js`

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/logic/operators/canActorGrabItemOperator.js` | CREATE | New operator |
| `src/logic/operators/isItemBeingGrabbedOperator.js` | CREATE | New operator |
| `src/logic/jsonLogicCustomOperators.js` | MODIFY | Register operators |
| `src/logic/jsonLogicEvaluationService.js` | MODIFY | Add to whitelist |
| `data/mods/weapons/scopes/grabbable_weapons_in_inventory.scope` | CREATE | New scope |
| `data/mods/weapons/mod-manifest.json` | MODIFY | Add scope file |
| `data/mods/weapons/actions/wield_threateningly.action.json` | MODIFY | Use new scope |

## Critical Files to Read Before Implementation

1. `src/logic/operators/hasFreeGrabbingAppendagesOperator.js` - Pattern for grabbing operators
2. `src/logic/jsonLogicCustomOperators.js` - Registration pattern (lines 97-390)
3. `src/utils/grabbingUtils.js` - Existing utilities to reuse
4. `src/logic/operators/base/BaseEquipmentOperator.js` - Base class pattern
5. `src/logic/operators/utils/entityPathResolver.js` - Entity resolution utilities

## Design Decisions

1. **Default handsRequired = 1**: Weapons without `anatomy:requires_grabbing` default to requiring 1 hand
2. **New scope**: Create `weapons:grabbable_weapons_in_inventory` to preserve backward compatibility
3. **Operator signature**: `["actor", "entity"]` - follows existing two-argument operator patterns
4. **Filter context**: Uses `"entity"` (not `"."`) to be explicit about what's being evaluated

## Edge Cases

- Actor without anatomy:body → `countFreeGrabbingAppendages` returns 0 → no weapons wieldable
- Weapon without `anatomy:requires_grabbing` → defaults to 1 hand required
- Item with `handsRequired: 0` → always wieldable (rings, etc.)
- Already-held item → excluded by `isItemBeingGrabbed` check
