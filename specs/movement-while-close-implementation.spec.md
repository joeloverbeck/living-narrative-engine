# Movement While Close Implementation Specification

**Status**: Draft
**Created**: 2025-01-26
**Related Systems**: Movement, Positioning, Closeness Circles
**Ticket**: (To be assigned)

## Problem Statement

### Current Behavior
Actors in a closeness circle (with `positioning:closeness` component) cannot use the `movement:go` action because:

1. The `movement:actor-can-move` prerequisite requires all movement-bearing body parts to have `core:movement.locked === false`
2. The `MERGE_CLOSENESS_CIRCLE` operation calls `updateMovementLock(..., true)` for all circle participants
3. Movement locks from closeness are treated identically to immobilizing locks (sitting, kneeling)
4. Even if movement were allowed, the `go.rule.json` only relocates the acting entity, leaving partners behind with inconsistent state

### Desired Behavior
Actors in a closeness circle should be able to move together:

1. The `movement:go` action should be available when the only active locks come from closeness
2. Movement should remain blocked when immobilizing components (sitting, kneeling, lying) are present
3. When an actor in a closeness circle moves, all partners should automatically move with them
4. The system should maintain closeness circle integrity across location changes

### Real-World Use Case
LLM-based characters want to get close to access proximity-dependent actions (e.g., hugging, whispering), then continue moving together while maintaining closeness, which is currently impossible.

## Architecture Overview

### Component Changes
```
core:movement (MODIFIED)
├── locked: boolean (existing)
└── lockSources: string[] (NEW)
    ├── "closeness"
    ├── "sitting"
    ├── "kneeling"
    ├── "lying"
    └── "custom_reason"
```

### Operation Flow
```
Actor in Closeness Circle
    ↓
Initiates movement:go action
    ↓
movement:actor-can-move checks lockSources
    ↓
If only "closeness" locks → ALLOW
If any immobilizing locks → BLOCK
    ↓
go.rule.json executes
    ↓
MODIFY_COMPONENT: Update actor position
    ↓
DISPATCH_EVENT: core:entity_moved
    ↓
New Rule: positioning_closeness_auto_move
    ↓
AUTO_MOVE_CLOSENESS_PARTNERS operation
    ↓
For each partner in closeness circle:
    ├── SYSTEM_MOVE_ENTITY
    ├── DISPATCH_EVENT: core:entity_moved (per partner)
    └── DISPATCH_PERCEPTIBLE_EVENT
```

## Technical Requirements

### 1. Component Schema Update

**File**: `data/mods/core/components/movement.component.json`

**Changes**:
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:movement",
  "description": "Controls an entity's ability to perform voluntary movement. Contains a lock that can be set by other systems with source tracking.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "locked": {
        "description": "If true, voluntary movement actions are blocked. This is a computed field based on lockSources array length.",
        "type": "boolean",
        "default": false
      },
      "lockSources": {
        "description": "Array of reasons why movement is locked. Empty array means unlocked. Multiple systems can add different reasons.",
        "type": "array",
        "default": [],
        "items": {
          "type": "string",
          "enum": ["closeness", "sitting", "kneeling", "lying", "straddling", "custom"]
        }
      },
      "forcedOverride": {
        "description": "Reserved for future use. A potential mechanism for special actions to bypass the 'locked' state.",
        "type": "boolean",
        "default": false
      }
    },
    "required": ["locked", "lockSources"],
    "additionalProperties": false
  }
}
```

**Migration Strategy**: Existing components with `locked: true` should be migrated to `lockSources: ["custom"]` during load.

### 2. Movement Utility Function Update

**File**: `src/utils/movementUtils.js`

**Function Signature Change**:
```javascript
/**
 * Update the locked state of an entity's movement component with source tracking.
 *
 * @param {EntityManager} entityManager - Entity manager.
 * @param {string} entityId - ID of the entity to update.
 * @param {boolean} locked - Whether movement should be locked.
 * @param {string} [lockSource='custom'] - Reason for the lock/unlock.
 * @returns {object|null} Updated movement component or null if no movement found.
 */
export async function updateMovementLock(entityManager, entityId, locked, lockSource = 'custom')
```

**Implementation Logic**:
1. Fetch existing `core:movement` component (or create if missing)
2. If `locked === true`: Add `lockSource` to `lockSources` array (if not already present)
3. If `locked === false`: Remove `lockSource` from `lockSources` array
4. Set `locked` field to `lockSources.length > 0`
5. Handle both anatomy-based (body parts with movement) and legacy entities
6. Update all relevant movement components

**Example**:
```javascript
// Lock for closeness
await updateMovementLock(entityManager, actorId, true, 'closeness');
// Result: { locked: true, lockSources: ['closeness'] }

// Lock for sitting (while already locked for closeness)
await updateMovementLock(entityManager, actorId, true, 'sitting');
// Result: { locked: true, lockSources: ['closeness', 'sitting'] }

// Unlock closeness (sitting lock remains)
await updateMovementLock(entityManager, actorId, false, 'closeness');
// Result: { locked: true, lockSources: ['sitting'] }

// Unlock sitting (no locks remain)
await updateMovementLock(entityManager, actorId, false, 'sitting');
// Result: { locked: false, lockSources: [] }
```

### 3. Movement Prerequisite Condition Update

**File**: `data/mods/movement/conditions/actor-can-move.condition.json`

**Current Logic**:
```json
{
  "logic": {
    "hasPartWithComponentValue": ["actor", "core:movement", "locked", false]
  }
}
```

**New Logic**:
```json
{
  "id": "movement:actor-can-move",
  "description": "Checks if the actor can move. Movement is allowed if unlocked OR only locked for closeness.",
  "logic": {
    "or": [
      {
        "hasPartWithComponentValue": ["actor", "core:movement", "locked", false]
      },
      {
        "and": [
          {
            "comment": "Movement is locked, but check if ONLY for closeness",
            "hasPartWithComponentValue": ["actor", "core:movement", "locked", true]
          },
          {
            "comment": "All lockSources arrays must contain ONLY 'closeness'",
            "allPartsMatch": {
              "comment": "Custom logic: check that all movement components have lockSources === ['closeness']",
              "entity_ref": "actor",
              "component_type": "core:movement",
              "condition": {
                "and": [
                  {
                    "comment": "lockSources array has exactly 1 element",
                    "==": [{ "var": "lockSources.length" }, 1]
                  },
                  {
                    "comment": "That element is 'closeness'",
                    "==": [{ "var": "lockSources.0" }, "closeness"]
                  }
                ]
              }
            }
          }
        ]
      }
    ]
  }
}
```

**Note**: This assumes the existence of an `allPartsMatch` JSON Logic operation. If this doesn't exist, an alternative approach using `hasPartWithComponentValue` with complex JSON Logic may be needed, or a new condition helper operation.

### 4. Closeness Circle Handler Updates

**Files to Update**:
- `src/logic/operationHandlers/mergeClosenessCircleHandler.js`
- `src/logic/operationHandlers/removeFromClosenessCircleHandler.js`
- `src/logic/operationHandlers/breakClosenessWithTargetHandler.js`
- `src/logic/operationHandlers/establishSittingClosenessHandler.js`
- `src/logic/operationHandlers/removeSittingClosenessHandler.js`

**Change Pattern**:
```javascript
// OLD
await updateMovementLock(this.#entityManager, id, true);

// NEW
await updateMovementLock(this.#entityManager, id, true, 'closeness');
```

```javascript
// OLD
await updateMovementLock(this.#entityManager, id, false);

// NEW
await updateMovementLock(this.#entityManager, id, false, 'closeness');
```

### 5. Other Movement Lock Handler Updates

**Files to Update**:
- `src/logic/operationHandlers/lockMovementHandler.js`
- `src/logic/operationHandlers/unlockMovementHandler.js`

**Change Pattern**:
```javascript
// In lockMovementHandler.js
async execute(params, executionContext) {
  const { actor_id, lock_source = 'custom' } = params; // NEW parameter
  await updateMovementLock(this.#entityManager, actor_id, true, lock_source);
}

// In unlockMovementHandler.js
async execute(params, executionContext) {
  const { actor_id, lock_source = 'custom' } = params; // NEW parameter
  await updateMovementLock(this.#entityManager, actor_id, false, lock_source);
}
```

### 6. New Operation: AUTO_MOVE_CLOSENESS_PARTNERS

**File**: `src/logic/operationHandlers/autoMoveClosenessPartnersHandler.js`

**Purpose**: Automatically relocate all members of a closeness circle when one member moves.

**Operation Handler Interface**:
```javascript
/**
 * @class AutoMoveClosenessPartnersHandler
 * @description Moves all closeness partners when the leader moves.
 * Similar to AutoMoveFollowersHandler but for closeness circles.
 */
class AutoMoveClosenessPartnersHandler extends BaseOperationHandler {
  /**
   * @param {object} params
   * @param {string} params.actor_id - The entity that initiated movement
   * @param {string} params.destination_id - Target location ID
   * @param {string} [params.previous_location_id] - Optional previous location
   * @param {ExecutionContext} executionContext
   */
  async execute(params, executionContext)
}
```

**Implementation Logic**:
1. Validate parameters (`actor_id`, `destination_id`)
2. Fetch `positioning:closeness` component from actor
3. Extract `partners` array
4. For each partner ID:
   a. Verify partner is still at previous location (if provided)
   b. Use `SYSTEM_MOVE_ENTITY` to relocate partner
   c. Get partner and location names
   d. Dispatch `core:entity_moved` event for partner
   e. Dispatch perceptible events (exit old location, enter new location)
   f. Log success to UI
5. Log completion with partner count

**Reference**: Follow the pattern from `src/logic/operationHandlers/autoMoveFollowersHandler.js`

### 7. New Rule: Closeness Auto-Move on Entity Movement

**File**: `data/mods/positioning/rules/closeness_auto_move.rule.json`

**Rule Definition**:
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "positioning_closeness_auto_move",
  "comment": "When an entity in a closeness circle moves, automatically move all partners to maintain the circle.",
  "event_type": "core:entity_moved",
  "condition": {
    "condition_ref": "core:actor-is-not-null"
  },
  "actions": [
    {
      "type": "IF",
      "comment": "Check if the moved entity is part of a closeness circle",
      "parameters": {
        "condition": {
          "!": {
            "missing": "actor.components.positioning:closeness"
          }
        },
        "then_actions": [
          {
            "type": "QUERY_COMPONENT",
            "comment": "Get the closeness component to access partners",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "positioning:closeness",
              "result_variable": "closenessComponent"
            }
          },
          {
            "type": "IF",
            "comment": "Only proceed if there are partners to move",
            "parameters": {
              "condition": {
                "and": [
                  { "var": "context.closenessComponent" },
                  { ">": [{ "var": "context.closenessComponent.partners.length" }, 0] }
                ]
              },
              "then_actions": [
                {
                  "type": "AUTO_MOVE_CLOSENESS_PARTNERS",
                  "comment": "Move all partners in the closeness circle",
                  "parameters": {
                    "actor_id": "{event.payload.entityId}",
                    "destination_id": "{event.payload.currentLocationId}",
                    "previous_location_id": "{event.payload.previousLocationId}"
                  }
                }
              ]
            }
          }
        ]
      }
    }
  ]
}
```

**Registration**: Add to `data/mods/positioning/mod-manifest.json` in the `rules` array.

### 8. Sitting/Kneeling Lock Source Updates

**Files Using Movement Locks** (update to use specific lock sources):

1. **Sitting Actions**:
   - Rules that handle sitting should use `lock_source: 'sitting'`
   - Files: `handle_sit_down.rule.json`, `handle_sit_down_at_distance.rule.json`, etc.

2. **Kneeling Actions**:
   - Rules that handle kneeling should use `lock_source: 'kneeling'`
   - Files: `kneel_before.rule.json`, etc.

3. **Lying Actions**:
   - Rules that handle lying should use `lock_source: 'lying'`
   - Files: `handle_lie_down.rule.json`, `handle_get_up_from_lying.rule.json`, etc.

4. **Straddling Actions**:
   - Rules that handle straddling should use `lock_source: 'straddling'`
   - Files: `straddle_waist_facing.rule.json`, `straddle_waist_facing_away.rule.json`, etc.

**Pattern**:
```json
{
  "type": "LOCK_MOVEMENT",
  "parameters": {
    "actor_id": "{event.payload.actorId}",
    "lock_source": "sitting"
  }
}
```

```json
{
  "type": "UNLOCK_MOVEMENT",
  "parameters": {
    "actor_id": "{event.payload.actorId}",
    "lock_source": "sitting"
  }
}
```

## Implementation Tasks

### Phase 1: Foundation (Lock Source Tracking)
1. ✅ Update `core:movement` component schema with `lockSources` array
2. ✅ Modify `updateMovementLock()` in `movementUtils.js` to accept and handle `lockSource` parameter
3. ✅ Create migration logic for existing `locked: true` components
4. ✅ Update all closeness-related handlers to use `'closeness'` lock source
5. ✅ Write unit tests for `updateMovementLock()` with lock sources

### Phase 2: Movement Prerequisite (Allow Movement While Close)
6. ✅ Update `movement:actor-can-move` condition to allow movement when only closeness locks exist
7. ✅ Create or extend JSON Logic operations if needed (e.g., `allPartsMatch`)
8. ✅ Write integration tests for movement with closeness vs. immobilizing locks
9. ✅ Update sitting/kneeling/lying handlers to use specific lock sources

### Phase 3: Auto-Move Partners (Maintain Closeness Circle)
10. ✅ Create `AutoMoveClosenessPartnersHandler` class
11. ✅ Register `AUTO_MOVE_CLOSENESS_PARTNERS` operation in DI container
12. ✅ Create `closeness_auto_move.rule.json` rule
13. ✅ Register rule in positioning mod manifest
14. ✅ Write unit tests for `AutoMoveClosenessPartnersHandler`
15. ✅ Write integration tests for closeness circle movement

### Phase 4: Testing & Validation
16. ✅ Test movement with single closeness lock
17. ✅ Test movement blocked with sitting + closeness locks
18. ✅ Test auto-move with 2-person closeness circle
19. ✅ Test auto-move with 3+ person closeness circle
20. ✅ Test closeness circle integrity after movement
21. ✅ Test perceptible events for all moved partners
22. ✅ Test edge cases (partner already at destination, partner in different location)

### Phase 5: Documentation & Cleanup
23. ✅ Update positioning mod README with closeness movement behavior
24. ✅ Update movement mod README with lock source system
25. ✅ Add JSDoc comments to all new/modified functions
26. ✅ Create migration guide for mods using movement locks
27. ✅ Update VALIDATION_PATTERNS.md in positioning mod

## Testing Requirements

### Unit Tests

**File**: `tests/unit/utils/movementUtils.lockSources.test.js`
- `updateMovementLock()` adds lock source when locking
- `updateMovementLock()` removes lock source when unlocking
- `updateMovementLock()` handles multiple lock sources correctly
- `updateMovementLock()` sets `locked` based on `lockSources.length`
- `updateMovementLock()` handles anatomy-based entities (body parts)
- `updateMovementLock()` handles legacy entities (direct movement)

**File**: `tests/unit/logic/operationHandlers/autoMoveClosenessPartnersHandler.test.js`
- Handler validates parameters correctly
- Handler fetches closeness component
- Handler moves all partners using SYSTEM_MOVE_ENTITY
- Handler dispatches entity_moved events for each partner
- Handler dispatches perceptible events for each partner
- Handler handles missing partners gracefully
- Handler logs completion with partner count

### Integration Tests

**File**: `tests/integration/positioning/movementWhileClose.integration.test.js`
- Actor with only closeness lock can use movement:go action
- Actor with sitting + closeness locks cannot use movement:go action
- Actor with kneeling + closeness locks cannot use movement:go action
- Movement prerequisite correctly identifies closeness-only locks
- Movement prerequisite correctly blocks immobilizing locks

**File**: `tests/integration/positioning/closenessAutoMove.integration.test.js`
- Moving actor automatically relocates 1 partner in closeness circle
- Moving actor automatically relocates 2+ partners in closeness circle
- Closeness circle integrity maintained after auto-move
- Perceptible events dispatched for actor and all partners
- Partners already at destination are not moved
- Partners at different locations are not moved (edge case handling)
- Auto-move works with anatomy-based entities
- Auto-move works with legacy entities

### E2E Tests

**File**: `tests/e2e/positioning/closenessMovementWorkflow.e2e.test.js`
- Complete workflow: get close → move together → step back
- Verify UI displays correct messages for all movements
- Verify closeness-dependent actions remain available after movement
- Verify movement blocked when sitting while close
- Verify movement enabled when standing up while close

## Edge Cases & Considerations

### Edge Case 1: Partner Already at Destination
**Scenario**: Actor moves to location where a partner is already present.
**Behavior**: Skip moving that partner, log appropriately.

### Edge Case 2: Partner at Different Location
**Scenario**: Partner's location doesn't match the previous location (desync).
**Behavior**: Skip moving that partner, log warning, consider dispatching error event.

### Edge Case 3: Circular Movement Events
**Scenario**: Auto-move triggers entity_moved, which triggers another auto-move.
**Behavior**: The actor who initiated the original movement should be excluded from partner lists to prevent loops.

### Edge Case 4: Mixed Lock Sources
**Scenario**: Actor has both closeness and sitting locks, stands up (removes sitting lock).
**Behavior**: Movement should now be allowed (only closeness lock remains).

### Edge Case 5: Lock Source Migration
**Scenario**: Old saved games with `locked: true` but no `lockSources`.
**Behavior**: During load, set `lockSources: ['custom']` for any locked movement components.

### Edge Case 6: Anatomy-Based vs. Legacy Entities
**Scenario**: Closeness circle contains both entity types.
**Behavior**: `updateMovementLock()` must handle both correctly, updating body part movements for anatomy-based entities.

## Backward Compatibility

### Breaking Changes
- `core:movement` component schema extended (non-breaking if `lockSources` defaults to `[]`)
- `updateMovementLock()` signature changed (optional parameter, backward compatible)
- Movement prerequisite behavior changed (feature addition, not breaking)

### Migration Path
1. Deploy schema changes first (with defaults)
2. Update `updateMovementLock()` calls incrementally
3. Update movement prerequisite condition
4. Add auto-move functionality
5. No saved game migration required (defaults handle old data)

### Compatibility Testing
- Load saved game with old `core:movement` components → should work with defaults
- Old rules calling `LOCK_MOVEMENT` without `lock_source` → should use `'custom'` default
- Movement should remain blocked for sitting/kneeling until handlers updated

## Success Criteria

### Functional Requirements Met
- ✅ Actors in closeness circles can use `movement:go` action
- ✅ Movement remains blocked when sitting/kneeling while close
- ✅ All partners in closeness circle move together automatically
- ✅ Closeness circle integrity maintained across locations
- ✅ Perceptible events dispatched for all movements
- ✅ No loops or infinite recursion in auto-move system

### Technical Requirements Met
- ✅ Lock source tracking implemented in `core:movement` component
- ✅ `updateMovementLock()` accepts and handles lock sources
- ✅ Movement prerequisite condition updated and tested
- ✅ `AUTO_MOVE_CLOSENESS_PARTNERS` operation implemented
- ✅ Closeness auto-move rule created and registered
- ✅ All tests pass with >80% coverage

### Quality Requirements Met
- ✅ No performance degradation (auto-move is efficient)
- ✅ Code follows project conventions (DI, error handling, logging)
- ✅ Documentation complete and accurate
- ✅ No console errors or warnings in gameplay
- ✅ Edge cases handled gracefully

## Performance Considerations

### Auto-Move Efficiency
- Auto-move is O(n) where n = number of partners in circle
- Typical closeness circles: 2-4 entities
- Worst case: 10-20 entities (still acceptable)
- No recursive movement (actor excluded from partner processing)

### Lock Source Array Performance
- Array operations (push, filter, includes) are O(n) where n = number of lock sources
- Typical lock sources per entity: 1-3
- Worst case: 5-7 (still very fast)
- Alternative: Use Set for O(1) operations, but Array is more JSON-friendly

### Event Dispatching Load
- Each partner movement dispatches 3 events: entity_moved, exit location, enter location
- For 3 partners: 9 additional events
- Acceptable overhead for maintaining closeness circle integrity
- Events are already async and batched by event bus

## Open Questions

### Q1: Should movement be allowed with sitting + closeness?
**Answer**: No, sitting is an immobilizing position. Actors must stand up first, then move.

### Q2: Should closeness break when moving to different locations?
**Answer**: No, the entire point of this feature is to maintain closeness while moving.

### Q3: What happens if a partner is blocked from moving (locked door, etc.)?
**Answer**: The partner should be skipped with a warning logged. Closeness circle may become desynced, but will be repaired on next successful movement or when using `step_back` action.

### Q4: Should auto-move dispatch the same perceptible events as manual movement?
**Answer**: Yes, to maintain consistency. Observers should see all partners move together.

### Q5: Should there be a maximum closeness circle size for movement?
**Answer**: Not initially. Monitor performance and add limits if needed (suggested: 10 entities max).

## Future Enhancements

### Enhancement 1: Voluntary Stay Behind
Allow partners to "opt out" of auto-move with a component flag like `positioning:stay_behind`.

### Enhancement 2: Formation-Based Movement
Maintain relative positions when moving (leader in front, partners in specific formations).

### Enhancement 3: Movement Speed Penalties
Larger closeness circles move slower (add delay or consume more action points).

### Enhancement 4: Closeness Strain System
Long-distance movement tests closeness bonds, potentially breaking weak connections.

### Enhancement 5: Visual Indicators
UI shows closeness circle members and indicates they'll move together.

## Related Specifications
- `specs/movement-lock-implementation.spec.md` (if exists)
- `specs/positioning-mod-multi-target-migration.spec.md`
- `specs/complex-action-side-effects-propagation.spec.md`

## References
- `data/mods/movement/actions/go.action.json` - Main movement action
- `data/mods/movement/conditions/actor-can-move.condition.json` - Movement prerequisite
- `data/mods/positioning/components/closeness.component.json` - Closeness circle data
- `src/utils/movementUtils.js` - Movement lock utility
- `src/logic/operationHandlers/autoMoveFollowersHandler.js` - Reference pattern
- `data/mods/companionship/rules/follow_auto_move.rule.json` - Auto-move pattern

---

**Last Updated**: 2025-01-26
**Specification Version**: 1.0
**Implementation Status**: Not Started
