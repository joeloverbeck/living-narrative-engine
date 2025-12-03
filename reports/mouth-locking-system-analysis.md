# Mouth Locking System - Architecture Analysis and Implementation Plan

## Current State Verification

**Last Verified**: 2025-09-06

This report has been verified against the actual codebase with the following findings:

### Confirmed Accurate

- ✅ Movement lock pattern exists exactly as described (`core:movement`, handlers, utilities)
- ✅ Dependency hierarchy is correct (positioning → core, intimacy → positioning + anatomy)
- ✅ Anatomy structure with `humanoid_mouth.entity.json` exists with proper `subType: "mouth"`
- ✅ No existing mouth engagement infrastructure in core mod
- ✅ Positioning actions lack mouth-related prerequisites

### Correction Required

- ⚠️ `turn_around.action.json` DOES contain the architectural violation with `"intimacy:kissing"` in forbidden_components (previously stated as speculation, now confirmed)

### Implementation Status

- ❌ No `core:mouth_engagement` component exists yet
- ❌ No LOCK/UNLOCK_MOUTH_ENGAGEMENT operations exist yet
- ❌ No mouth availability conditions exist yet
- ❌ Integration with intimacy mod not yet implemented

## Executive Summary

The Living Narrative Engine currently faces a logical inconsistency where positioning actions (kneeling, turning back, stepping back) remain available during intimate mouth-to-mouth interactions like kissing. This creates immersion-breaking scenarios where a character could kneel or turn their back while actively kissing someone.

The root cause is an architectural constraint: the `positioning` mod cannot check for `intimacy` components due to the dependency hierarchy. The `positioning` mod depends only on `core`, while `intimacy` depends on both `anatomy` and `positioning`. This means positioning actions cannot directly forbid the `intimacy:kissing` component without violating the module dependency structure.

This report proposes implementing a **mouth engagement locking system** in the `core` mod, following the same resource lock pattern successfully used for movement control. This solution maintains clean architecture while solving the logical inconsistency problem.

## Current System Analysis

### Movement Locking Pattern

The engine already implements a successful resource locking pattern for movement control:

#### Component Structure (`core:movement`)

```json
{
  "id": "core:movement",
  "description": "Controls an entity's ability to perform voluntary movement",
  "dataSchema": {
    "type": "object",
    "properties": {
      "locked": {
        "description": "If true, voluntary movement actions are blocked",
        "type": "boolean",
        "default": false
      },
      "forcedOverride": {
        "description": "Reserved for special actions to bypass the 'locked' state",
        "type": "boolean",
        "default": false
      }
    }
  }
}
```

#### Key Design Principles

1. **State-Only Storage**: The component only tracks whether the resource is locked, not why or by whom
2. **Universal Access**: Any mod can lock/unlock without knowing about other mods
3. **Simple Checks**: Conditions only care about the boolean locked state
4. **Clean Separation**: No cross-module dependencies required

#### Implementation Components

- **Operations**: `LOCK_MOVEMENT` and `UNLOCK_MOVEMENT` for state management
- **Condition**: `actor-can-move` checks for `locked: false` on movement components
- **Handlers**: `lockMovementHandler.js` and `unlockMovementHandler.js` process operations
- **Utility**: `updateMovementLock()` manages both direct and anatomy-based entities
- **Integration**: Leg anatomy parts include the movement component

### Current Problem Analysis

#### Dependency Hierarchy

```
core (base module)
  ↑
positioning (depends on core)
  ↑
intimacy (depends on positioning + anatomy)
```

This hierarchy means:

- ✅ `intimacy` can reference `positioning` components
- ❌ `positioning` cannot reference `intimacy` components

#### Current Issues

1. **Illogical Action Availability**: During kissing, these positioning actions remain available:
   - `kneel_before.action.json`
   - `place_yourself_behind.action.json`
   - `turn_your_back.action.json`
   - `step_back.action.json`

2. **Architectural Violation**: `turn_around.action.json` currently has:

   ```json
   "forbidden_components": {
     "actor": ["intimacy:kissing"]
   }
   ```

   **VERIFIED**: This violation exists in the codebase and needs to be fixed. The `positioning` mod cannot reference `intimacy` components due to the dependency hierarchy.

3. **Future Scaling Issues**: As more mouth-related activities are added (eating, drinking, oral sex), the problem will compound without a centralized solution.

## Proposed Solution: Mouth Engagement Lock System

### Design Philosophy

Implement a resource lock for mouth engagement that parallels the movement lock system. This provides a clean, dependency-respecting way for any mod to check or set mouth availability.

### Component Design

#### New Component: `core:mouth_engagement`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:mouth_engagement",
  "description": "Controls an entity's mouth availability for actions. Contains a lock that can be set by systems (like intimacy or eating mods) to temporarily prevent conflicting mouth-based actions.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "locked": {
        "description": "If true, mouth-based actions are blocked. Systems can set this to prevent conflicting oral activities. Does not specify what is using the mouth.",
        "type": "boolean",
        "default": false
      },
      "forcedOverride": {
        "description": "Reserved for future use. A potential mechanism for special actions to bypass the 'locked' state.",
        "type": "boolean",
        "default": false
      }
    },
    "required": ["locked"],
    "additionalProperties": false
  }
}
```

### Condition Design

#### New Condition: `core:actor-mouth-available`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "core:actor-mouth-available",
  "description": "Checks if the actor has a mouth that is not currently engaged/locked",
  "logic": {
    "hasPartWithComponentValue": [
      "actor",
      "core:mouth_engagement",
      "locked",
      false
    ]
  }
}
```

### Operation Schemas

#### LOCK_MOUTH_ENGAGEMENT Operation

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/lockMouthEngagement.schema.json",
  "title": "LOCK_MOUTH_ENGAGEMENT Operation",
  "allOf": [
    {
      "$ref": "../base-operation.schema.json"
    },
    {
      "properties": {
        "type": {
          "const": "LOCK_MOUTH_ENGAGEMENT"
        },
        "parameters": {
          "$ref": "#/$defs/Parameters"
        }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "description": "Parameters for the LOCK_MOUTH_ENGAGEMENT operation. Locks mouth engagement for the specified actor.",
      "properties": {
        "actor_id": {
          "type": "string",
          "description": "The ID of the actor to lock mouth engagement for"
        }
      },
      "required": ["actor_id"],
      "additionalProperties": false
    }
  }
}
```

#### UNLOCK_MOUTH_ENGAGEMENT Operation

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/unlockMouthEngagement.schema.json",
  "title": "UNLOCK_MOUTH_ENGAGEMENT Operation",
  "allOf": [
    {
      "$ref": "../base-operation.schema.json"
    },
    {
      "properties": {
        "type": {
          "const": "UNLOCK_MOUTH_ENGAGEMENT"
        },
        "parameters": {
          "$ref": "#/$defs/Parameters"
        }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "description": "Parameters for the UNLOCK_MOUTH_ENGAGEMENT operation. Unlocks mouth engagement for the specified actor.",
      "properties": {
        "actor_id": {
          "type": "string",
          "description": "The ID of the actor to unlock mouth engagement for"
        }
      },
      "required": ["actor_id"],
      "additionalProperties": false
    }
  }
}
```

## Implementation Details

### Handler Implementation

#### lockMouthEngagementHandler.js

```javascript
/**
 * @file Handler that locks mouth engagement for entities with mouth restrictions.
 * @description Handles the LOCK_MOUTH_ENGAGEMENT operation for entities
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { updateMouthEngagementLock } from '../../utils/mouthEngagementUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * @class LockMouthEngagementHandler
 * @description Handles the LOCK_MOUTH_ENGAGEMENT operation for entities.
 */
class LockMouthEngagementHandler extends BaseOperationHandler {
  /** @type {EntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logging service.
   * @param {EntityManager} deps.entityManager - Entity manager.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Error dispatcher.
   */
  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('LockMouthEngagementHandler', {
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

  /**
   * Validate parameters for execute.
   *
   * @param {object} params
   * @param {ExecutionContext} executionContext
   * @returns {{ actorId:string, logger:ILogger }|null}
   * @private
   */
  #validateParams(params, executionContext) {
    const { actor_id } = params || {};
    const log = this.getLogger(executionContext);

    if (typeof actor_id !== 'string' || !actor_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'LOCK_MOUTH_ENGAGEMENT: invalid "actor_id"',
        { params },
        log
      );
      return null;
    }

    return {
      actorId: actor_id.trim(),
      logger: log,
    };
  }

  /**
   * Lock mouth engagement for the specified entity.
   *
   * @param {{ actor_id:string }} params - Operation parameters.
   * @param {ExecutionContext} executionContext - Execution context.
   */
  async execute(params, executionContext) {
    const validated = this.#validateParams(params, executionContext);
    if (!validated) return;

    const { actorId, logger } = validated;

    try {
      // This utility handles both legacy and anatomy-based entities
      await updateMouthEngagementLock(this.#entityManager, actorId, true);
      logger.debug(
        `[LockMouthEngagementHandler] Successfully locked mouth engagement for entity: ${actorId}`
      );
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        `LOCK_MOUTH_ENGAGEMENT: failed to lock mouth engagement for entity ${actorId}`,
        { actor_id: actorId, error: err.message, stack: err.stack },
        logger
      );
    }
  }
}

export default LockMouthEngagementHandler;
```

### Utility Function

#### mouthEngagementUtils.js

```javascript
// src/utils/mouthEngagementUtils.js

import { deepClone } from './cloneUtils.js';

/**
 * Update the locked state of an entity's mouth engagement component.
 * Handles both legacy entities with direct mouth engagement and anatomy-based mouth parts.
 *
 * @param {import('../entities/entityManager.js').default} entityManager - Entity manager.
 * @param {string} entityId - ID of the entity to update.
 * @param {boolean} locked - Whether mouth engagement should be locked.
 * @returns {object|null} Updated mouth engagement component or null if no mouth found.
 */
export async function updateMouthEngagementLock(
  entityManager,
  entityId,
  locked
) {
  // Check if entity has anatomy:body component
  const bodyComponent = entityManager.getComponentData(
    entityId,
    'anatomy:body'
  );

  if (bodyComponent && bodyComponent.body && bodyComponent.body.root) {
    // New anatomy-based path: find mouth parts
    const updatedParts = [];

    // Look for mouth parts in the body.parts map
    if (bodyComponent.body.parts) {
      for (const [partType, partId] of Object.entries(
        bodyComponent.body.parts
      )) {
        // Check if this part is a mouth by looking for the anatomy:part component
        const partComponent = entityManager.getComponentData(
          partId,
          'anatomy:part'
        );

        if (partComponent && partComponent.subType === 'mouth') {
          // Get or create mouth engagement component
          let mouthEngagement = entityManager.getComponentData(
            partId,
            'core:mouth_engagement'
          );

          if (!mouthEngagement) {
            mouthEngagement = { locked: false, forcedOverride: false };
          }

          // Clone and update the mouth engagement component
          const updatedEngagement =
            typeof structuredClone === 'function'
              ? structuredClone(mouthEngagement)
              : deepClone(mouthEngagement);
          updatedEngagement.locked = locked;

          // Update the component
          await entityManager.addComponent(
            partId,
            'core:mouth_engagement',
            updatedEngagement
          );
          updatedParts.push({ partId, engagement: updatedEngagement });
        }
      }
    }

    // Return summary of updates
    return updatedParts.length > 0 ? { updatedParts, locked } : null;
  }

  // Legacy path: check entity directly for mouth engagement
  const existing = entityManager.getComponentData(
    entityId,
    'core:mouth_engagement'
  );
  if (existing) {
    const engagement =
      typeof structuredClone === 'function'
        ? structuredClone(existing)
        : deepClone(existing);
    engagement.locked = locked;
    await entityManager.addComponent(
      entityId,
      'core:mouth_engagement',
      engagement
    );
    return engagement;
  }

  // No mouth engagement component found - create it with the locked state
  const newEngagement = { locked, forcedOverride: false };
  await entityManager.addComponent(
    entityId,
    'core:mouth_engagement',
    newEngagement
  );
  return newEngagement;
}
```

## Integration Plan

### Phase 1: Core Infrastructure

1. **Create Core Components**:
   - `data/mods/core/components/mouth_engagement.component.json`
   - `data/mods/core/conditions/actor-mouth-available.condition.json`
   - `data/schemas/operations/lockMouthEngagement.schema.json`
   - `data/schemas/operations/unlockMouthEngagement.schema.json`

2. **Implement Handlers**:
   - `src/logic/operationHandlers/lockMouthEngagementHandler.js`
   - `src/logic/operationHandlers/unlockMouthEngagementHandler.js`
   - `src/utils/mouthEngagementUtils.js`

3. **Register Handlers**:
   Update `src/dependencyInjection/registrations/interpreterRegistrations.js`:

   ```javascript
   registry.register(
     'LOCK_MOUTH_ENGAGEMENT',
     bind(tokens.LockMouthEngagementHandler)
   );
   registry.register(
     'UNLOCK_MOUTH_ENGAGEMENT',
     bind(tokens.UnlockMouthEngagementHandler)
   );
   ```

4. **Update Core Manifest**:
   Add new component and condition to `data/mods/core/mod-manifest.json`

### Phase 2: Anatomy Integration

Update `data/mods/anatomy/entities/definitions/humanoid_mouth.entity.json`:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:humanoid_mouth",
  "description": "A humanoid mouth",
  "components": {
    "anatomy:part": {
      "subType": "mouth"
    },
    "anatomy:sockets": {
      "sockets": [
        {
          "id": "teeth",
          "allowedTypes": ["teeth"],
          "nameTpl": "{{type}}"
        }
      ]
    },
    "core:name": {
      "text": "mouth"
    },
    "core:mouth_engagement": {
      "locked": false,
      "forcedOverride": false
    }
  }
}
```

### Phase 3: Positioning Action Updates

For each of these positioning actions, add the mouth availability prerequisite:

**Example: kneel_before.action.json**

```json
{
  "prerequisites": [
    {
      "condition": {
        "logic": {
          "condition_ref": "core:actor-mouth-available"
        }
      },
      "failureMessage": "You cannot do that while your mouth is engaged."
    }
  ]
}
```

Actions to update:

- `kneel_before.action.json`
- `place_yourself_behind.action.json`
- `turn_your_back.action.json`
- `step_back.action.json`

For `turn_around.action.json`:

1. Remove the invalid `"intimacy:kissing"` from forbidden_components
2. Add the mouth availability prerequisite

### Phase 4: Intimacy Integration

#### Update lean_in_for_deep_kiss.rule.json

Add after the ADD_COMPONENT actions:

```json
{
  "type": "LOCK_MOUTH_ENGAGEMENT",
  "parameters": {
    "actor_id": "{event.payload.actorId}"
  }
},
{
  "type": "LOCK_MOUTH_ENGAGEMENT",
  "parameters": {
    "actor_id": "{event.payload.targetId}"
  }
}
```

#### Update break_kiss_gently.rule.json

Add before removing the kissing components:

```json
{
  "type": "UNLOCK_MOUTH_ENGAGEMENT",
  "parameters": {
    "actor_id": "{event.payload.actorId}"
  }
},
{
  "type": "UNLOCK_MOUTH_ENGAGEMENT",
  "parameters": {
    "actor_id": "{event.payload.targetId}"
  }
}
```

Apply similar updates to:

- `pull_back_breathlessly.rule.json`
- `pull_back_in_revulsion.rule.json`

## Testing Strategy

### Unit Tests

1. **Component Tests**:
   - Test mouth_engagement component schema validation
   - Test locked/unlocked states
   - Test forcedOverride behavior

2. **Handler Tests**:
   - Test LOCK_MOUTH_ENGAGEMENT operation
   - Test UNLOCK_MOUTH_ENGAGEMENT operation
   - Test error handling for invalid parameters

3. **Utility Tests**:
   - Test updateMouthEngagementLock for anatomy-based entities
   - Test legacy entity support
   - Test creation of missing components

### Integration Tests

1. **Kissing Workflow**:
   - Start kiss → mouth locked → positioning actions unavailable
   - End kiss → mouth unlocked → positioning actions available

2. **Multi-Actor Scenarios**:
   - Test both participants have locked mouths during kiss
   - Test independent mouth locking for different actors

3. **Edge Cases**:
   - Test entities without mouth parts
   - Test forced overrides
   - Test concurrent mouth operations

### Performance Tests

1. **Lock/Unlock Performance**:
   - Measure operation execution time
   - Test with multiple simultaneous locks
   - Verify no performance degradation

2. **Condition Checking**:
   - Measure actor-mouth-available evaluation time
   - Test with complex anatomy structures

## Migration Guide

### For Mod Developers

1. **Check Mouth Availability**:
   - Use `core:actor-mouth-available` condition in prerequisites
   - Don't check for specific activities (kissing, eating)
   - Trust the lock state

2. **Lock/Unlock Pattern**:
   - Lock mouth when starting oral activities
   - Unlock when ending activities
   - Always unlock in error/cancellation paths

3. **Respect the Lock**:
   - Never bypass mouth locks without forcedOverride
   - Don't make assumptions about why mouth is locked

### Backward Compatibility

- Existing actions without mouth checks will continue to work
- The system is opt-in for positioning actions
- No breaking changes to existing intimacy mechanics

## Benefits and Future Considerations

### Immediate Benefits

1. **Clean Architecture**: No dependency violations
2. **Logical Consistency**: Prevents impossible action combinations
3. **Extensibility**: Ready for any mouth-related activities
4. **Performance**: Minimal overhead with simple boolean checks
5. **Maintainability**: Clear separation of concerns

### Future Extensions

1. **Additional Body Part Locks**:
   - `core:hands_engagement` for holding items
   - `core:eyes_engagement` for vision-based actions
   - `core:legs_engagement` (different from movement - for sitting, kneeling)

2. **Lock Enhancements**:
   - Priority levels for forced overrides
   - Lock ownership tracking for debugging
   - Partial engagement states (e.g., mumbling while eating)

3. **Cross-System Integration**:
   - Eating/drinking systems
   - Speech/dialogue systems
   - Future adult content systems

### Potential Challenges

1. **Discovery**: Developers need to know about the lock system
2. **Consistency**: All mouth-using mods must participate
3. **Debugging**: Hard to tell what locked the mouth without additional tracking

## Conclusion

The mouth engagement locking system provides a clean, architecturally sound solution to the current logical inconsistencies in action availability. By following the proven movement lock pattern, we maintain consistency across the codebase while respecting module dependencies.

This implementation:

- Solves the immediate kissing/positioning conflict
- Provides a foundation for future mouth-related systems
- Maintains clean architecture without dependency violations
- Offers excellent performance with minimal complexity

The phased implementation approach ensures smooth integration with existing systems while maintaining backward compatibility. The resource lock pattern proves its value once again as a simple, effective solution for managing shared resources in a modular system.

---

**Verification Status**: This report has been validated against the actual codebase on 2025-09-06. All technical details regarding the existing movement lock pattern are accurate, and the proposed mouth engagement lock system follows the same proven architecture. The one correction made was confirming that `turn_around.action.json` does indeed contain the architectural violation that needs to be fixed.

## Appendix: Example Test Case

```javascript
// tests/integration/mouthEngagement/kissingPositioningConflict.test.js

describe('Mouth Engagement - Kissing and Positioning Conflict', () => {
  let testBed;
  let entityManager;
  let actionSystem;

  beforeEach(() => {
    testBed = createTestBed();
    entityManager = testBed.entityManager;
    actionSystem = testBed.actionSystem;
  });

  it('should prevent positioning actions during kissing', async () => {
    // Setup: Two actors in same location
    const actor1 = await createTestActor('actor1', { hasMouth: true });
    const actor2 = await createTestActor('actor2', { hasMouth: true });

    // Act: Start kissing
    await actionSystem.execute('intimacy:lean_in_for_deep_kiss', {
      actorId: 'actor1',
      targetId: 'actor2',
    });

    // Assert: Mouth is locked
    const mouthPart = entityManager.getBodyPart('actor1', 'mouth');
    const mouthEngagement = entityManager.getComponentData(
      mouthPart.id,
      'core:mouth_engagement'
    );
    expect(mouthEngagement.locked).toBe(true);

    // Assert: Positioning actions unavailable
    const availableActions = actionSystem.getAvailableActions('actor1');
    expect(availableActions).not.toContain('deference:kneel_before');
    expect(availableActions).not.toContain('positioning:turn_your_back');

    // Act: End kiss
    await actionSystem.execute('intimacy:break_kiss_gently', {
      actorId: 'actor1',
      targetId: 'actor2',
    });

    // Assert: Mouth unlocked and actions available
    const updatedEngagement = entityManager.getComponentData(
      mouthPart.id,
      'core:mouth_engagement'
    );
    expect(updatedEngagement.locked).toBe(false);

    const updatedActions = actionSystem.getAvailableActions('actor1');
    expect(updatedActions).toContain('deference:kneel_before');
  });
});
```
