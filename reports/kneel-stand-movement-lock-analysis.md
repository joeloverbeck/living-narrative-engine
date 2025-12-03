# Movement Lock Analysis for Kneel/Stand Actions (Corrected)

## Executive Summary

This report analyzes the current implementation of the `kneel_before` and `stand_up` actions and provides a specification for implementing movement locking, similar to how the `get_close` and `step_back` actions handle it. The core issue is that actors can move to other locations while kneeling, which is physically unrealistic.

**Important Architecture Note**: This system uses an anatomy-based entity structure where movement components are attached to individual body parts (specifically legs), NOT to the root entity. This is a critical distinction that affects the implementation approach.

## Current State Analysis

### Kneel_Before Action

**File**: `data/mods/deference/actions/kneel_before.action.json`

- **Purpose**: Allows an actor to kneel before another actor
- **Components Added**: `positioning:kneeling_before` with target entity ID
- **Movement Lock**: ❌ **NOT IMPLEMENTED**

**Rule**: `data/mods/deference/rules/kneel_before.rule.json`

- Adds the `positioning:kneeling_before` component
- Dispatches perception event
- Ends turn
- **Missing**: Movement locking mechanism

### Stand_Up Action

**File**: `data/mods/deference/actions/stand_up.action.json`

- **Purpose**: Allows an actor to stand up from kneeling position
- **Required Components**: `positioning:kneeling_before`
- **Components Removed**: `positioning:kneeling_before`
- **Movement Unlock**: ❌ **NOT IMPLEMENTED**

**Rule**: `data/mods/deference/rules/stand_up.rule.json`

- Removes the `positioning:kneeling_before` component
- Dispatches perception event
- Ends turn
- **Missing**: Movement unlocking mechanism

## Reference Implementation Analysis

### Get_Close/Step_Back Pattern

The `get_close` and `step_back` actions use a sophisticated movement locking system:

#### Get_Close Implementation

1. **Operation Used**: `MERGE_CLOSENESS_CIRCLE`
2. **Handler**: `src/logic/operationHandlers/mergeClosenessCircleHandler.js`
3. **Movement Lock Process**:
   - Merges actor and target into a closeness circle
   - Calls `updateMovementLock(entityManager, id, true)` for all members
   - Sets `core:movement.locked = true`

#### Step_Back Implementation

1. **Operation Used**: `REMOVE_FROM_CLOSENESS_CIRCLE`
2. **Handler**: `src/logic/operationHandlers/removeFromClosenessCircleHandler.js`
3. **Movement Unlock Process**:
   - Removes actor from closeness circle
   - Calls `updateMovementLock(entityManager, id, false)` for actors who are now alone
   - Sets `core:movement.locked = false`

### Movement Lock Mechanism

**Component Location in Anatomy System**:

- **Legacy Entities**: `core:movement` component directly on the actor entity
- **Anatomy-Based Entities**: `core:movement` components on individual body parts (legs)
  - Example: `anatomy:human_leg` entities have `core:movement` component
  - Root entity has `anatomy:body` component that references body parts via `body.parts` map

**Movement Component Structure**:

```json
{
  "locked": boolean,      // If true, voluntary movement is blocked
  "forcedOverride": boolean // Reserved for future forced movement
}
```

**Utility Function**: `src/utils/movementUtils.js::updateMovementLock()`

```javascript
// Key implementation details:
// 1. Checks for anatomy:body component on root entity
// 2. If found, iterates through body.parts map to find parts with movement
// 3. Updates core:movement.locked on each part (typically legs)
// 4. Falls back to direct movement component update for legacy entities
```

This utility correctly handles the anatomy system by:

- Detecting anatomy-based entities via the `anatomy:body` component
- Iterating through the `body.parts` map to find all body parts
- Checking each part for `core:movement` component (found on legs)
- Updating the `locked` field on each movement-capable part

## Implementation Specification

### Option 1: Direct Component Modification (NOT VIABLE)

**Why this approach doesn't work for anatomy-based entities:**

The `MODIFY_COMPONENT` operation can only modify components on a single specified entity. For anatomy-based entities, we need to:

1. Access the `anatomy:body` component on the root entity
2. Iterate through the `body.parts` map
3. Update `core:movement` on each leg entity

Since rules cannot iterate through dynamic collections or modify multiple entities based on runtime data, we cannot use `MODIFY_COMPONENT` for anatomy-based entities. The operation would only work for legacy entities that have `core:movement` directly on the actor.

### Option 2: Create Custom Operations (RECOMMENDED)

This approach follows the proven pattern used by `get_close` and `step_back` actions, leveraging the existing `updateMovementLock` utility that properly handles anatomy-based entities.

#### 1. Create `LOCK_MOVEMENT` Operation Handler

**File**: `src/logic/operationHandlers/lockMovementHandler.js`

```javascript
import BaseOperationHandler from './baseOperationHandler.js';
import { updateMovementLock } from '../../utils/movementUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

class LockMovementHandler extends BaseOperationHandler {
  #entityManager;
  #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('LockMovementHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  async execute(params, executionContext) {
    const logger = this.getLogger(executionContext);
    const { actor_id } = params || {};

    if (!actor_id) {
      safeDispatchError(
        this.#dispatcher,
        'LOCK_MOVEMENT: missing actor_id',
        { params },
        logger
      );
      return;
    }

    try {
      // This utility handles both legacy and anatomy-based entities
      await updateMovementLock(this.#entityManager, actor_id, true);
      logger.debug(`[LockMovementHandler] Locked movement for ${actor_id}`);
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        'LOCK_MOVEMENT: failed to lock movement',
        { actor_id, error: err.message },
        logger
      );
    }
  }
}
```

#### 2. Create `UNLOCK_MOVEMENT` Operation Handler

**File**: `src/logic/operationHandlers/unlockMovementHandler.js`

Similar structure to `lockMovementHandler.js`, but calls `updateMovementLock` with `false`.

#### 3. Register Operations

Add to `src/dependencyInjection/registrations/interpreterRegistrations.js`:

```javascript
import LockMovementHandler from '../../logic/operationHandlers/lockMovementHandler.js';
import UnlockMovementHandler from '../../logic/operationHandlers/unlockMovementHandler.js';

// In the registration section:
container.register('LockMovementHandler', LockMovementHandler);
container.register('UnlockMovementHandler', UnlockMovementHandler);

// In the operation mapping:
operationMap.set('LOCK_MOVEMENT', 'LockMovementHandler');
operationMap.set('UNLOCK_MOVEMENT', 'UnlockMovementHandler');
```

#### 4. Update Rules

**kneel_before.rule.json** - Add after line 33 (after ADD_COMPONENT):

```json
{
  "type": "LOCK_MOVEMENT",
  "comment": "Lock movement while kneeling (handles both legacy and anatomy entities)",
  "parameters": {
    "actor_id": "{event.payload.actorId}"
  }
}
```

**stand_up.rule.json** - Add after line 26 (after REMOVE_COMPONENT):

```json
{
  "type": "UNLOCK_MOVEMENT",
  "comment": "Unlock movement after standing (handles both legacy and anatomy entities)",
  "parameters": {
    "actor_id": "{event.payload.actorId}"
  }
}
```

## Implementation Considerations

### Anatomy System Architecture

**Critical Understanding**: The anatomy system fundamentally changes how movement is handled:

1. **Legacy Entities**:
   - Have `core:movement` component directly on the actor entity
   - Simple direct update of the movement component

2. **Anatomy-Based Entities**:
   - Actor entity has `anatomy:body` component with a `recipeId` (e.g., "anatomy:human_male")
   - Body parts are separate entities referenced in `body.parts` map
   - Movement components exist ONLY on leg entities (e.g., "anatomy:human_leg")
   - Each leg entity has its own `core:movement` component with `locked` and `forcedOverride` fields

**How `updateMovementLock` Handles This**:

```javascript
// Simplified flow:
if (entity has anatomy:body) {
  // Anatomy-based entity
  for each (partId in body.parts) {
    if (part has core:movement) {
      update movement.locked on part entity
    }
  }
} else {
  // Legacy entity
  update movement.locked on actor entity directly
}
```

This is why custom operations are necessary - the rules engine cannot iterate through dynamic entity collections or update multiple entities based on runtime data.

### Edge Cases

1. **Multiple Kneeling States**: If we add more kneeling variations (kneel in prayer, kneel in pain), ensure consistent movement locking
2. **Forced Movement**: The `forcedOverride` field in movement component could allow special actions to move kneeling actors
3. **Component Presence**: Always check if movement component exists before modifying
4. **Anatomy Variations**: Different creatures might have movement on different body parts

### Testing Requirements

1. **Verify Movement Lock on Kneel - Anatomy Entities**:
   - Actor with anatomy system kneels before target
   - Check that ALL leg entities have `core:movement.locked: true`
   - Attempt to use "go" action - should fail
   - Verify by checking each leg entity's movement component

2. **Verify Movement Lock on Kneel - Legacy Entities**:
   - Legacy actor (without anatomy:body) kneels
   - Check actor's direct `core:movement.locked: true`
   - Attempt to use "go" action - should fail

3. **Verify Movement Unlock on Stand - Anatomy Entities**:
   - Anatomy-based actor stands up
   - Check that ALL leg entities have `core:movement.locked: false`
   - "go" action should work
   - Verify each leg entity is properly unlocked

4. **Verify Movement Unlock on Stand - Legacy Entities**:
   - Legacy actor stands up
   - Check actor's direct `core:movement.locked: false`
   - "go" action should work

5. **Edge Case Testing**:
   - Kneel with entity that has no legs (should handle gracefully)
   - Stand without being kneeled (should not error)
   - Multiple actors kneeling simultaneously (each tracks own state)
   - Entity with asymmetric anatomy (e.g., one leg) should still lock properly

## Recommended Approach

**Use Option 2 (Custom Operations)** for the following reasons:

1. **Anatomy Support**: The only viable approach that handles anatomy-based entities correctly
2. **Proven Pattern**: Follows the exact same pattern as `get_close`/`step_back` which work correctly
3. **Reuses Existing Utility**: Leverages the battle-tested `updateMovementLock` function
4. **Maintainability**: Clear separation of concerns with dedicated handlers
5. **Consistency**: Aligns with how movement locking is already implemented in the codebase

**Why NOT Option 1**:

- `MODIFY_COMPONENT` cannot iterate through dynamic entity collections
- Cannot update multiple leg entities based on runtime data
- Would only work for legacy entities, breaking anatomy-based characters
- Rules engine lacks the capability to handle the anatomy system's complexity

## Implementation Steps

1. **Create Operation Handlers**:
   - Create `src/logic/operationHandlers/lockMovementHandler.js`
   - Create `src/logic/operationHandlers/unlockMovementHandler.js`
   - Both handlers call the existing `updateMovementLock` utility

2. **Register New Operations**:
   - Update `src/dependencyInjection/registrations/interpreterRegistrations.js`
   - Register both handlers and map operations

3. **Update `kneel_before.rule.json`**:
   - Add `LOCK_MOVEMENT` operation after adding kneeling component
   - Single operation handles both legacy and anatomy entities automatically

4. **Update `stand_up.rule.json`**:
   - Add `UNLOCK_MOVEMENT` operation after removing kneeling component
   - Single operation handles both legacy and anatomy entities automatically

5. **Create Integration Tests**:
   - Test movement restriction while kneeling for anatomy entities
   - Test movement restriction for legacy entities
   - Test movement restoration after standing for both types
   - Verify leg entity components are properly updated

6. **Update Documentation**:
   - Document the movement locking behavior
   - Explain anatomy system interaction
   - Add to positioning mod documentation

## Conclusion

The movement locking mechanism is well-established in the codebase through the closeness circle implementation. However, the anatomy system's architecture requires using custom operations rather than simple component modification.

**Key Corrections from Original Report**:

1. Movement components are NOT on the root entity for anatomy-based characters - they're on individual body parts (legs)
2. The `MODIFY_COMPONENT` approach cannot work for anatomy entities due to the need for dynamic iteration
3. Custom operations following the `MERGE_CLOSENESS_CIRCLE` pattern are the only viable solution
4. The existing `updateMovementLock` utility already handles all the complexity correctly

By creating `LOCK_MOVEMENT` and `UNLOCK_MOVEMENT` operations that leverage the existing utility function, we can ensure realistic movement restrictions while maintaining compatibility with both legacy and anatomy-based entities. This approach is consistent with existing patterns and reuses battle-tested code.
