# BENOVERSYS-006: Create Straighten Up Rule

## Overview
Create the `handle_straighten_up` rule that processes straighten_up action attempts. This rule will remove the bending_over component from actors, remove automatic closeness relationships with other actors at the same surface, unlock movement, and provide appropriate feedback.

## Prerequisites
- BENOVERSYS-001 through BENOVERSYS-005 completed
- Understanding of rule operation syntax
- Knowledge of existing positioning rule patterns (handle_get_up_from_furniture)
- Familiarity with operation types (REMOVE_COMPONENT, REMOVE_SITTING_CLOSENESS, etc.)

## Acceptance Criteria
1. Rule correctly processes straighten_up action attempts
2. Removes bending_over component from actor
3. Unlocks actor movement
4. Removes automatic closeness with other actors at same surface
5. Provides appropriate log messages for feedback
6. Ends turn after successful execution
7. Validates against rule schema

## Implementation Steps

### Step 1: Create handle_straighten_up Rule
Create `data/mods/positioning/rules/handle_straighten_up.rule.json`:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "positioning:handle_straighten_up",
  "description": "Handles actor straightening up from bending over a surface",
  "conditions": ["positioning:event-is-action-straighten-up"],
  "operations": [
    {
      "type": "CONDITIONAL",
      "condition": {
        "has": [
          { "var": "actor.components" },
          "positioning:bending_over"
        ]
      },
      "operations": [
        {
          "type": "CACHE_VALUE",
          "key": "surfaceId",
          "value": { "var": "actor.components.positioning:bending_over.surface_id" }
        },
        {
          "type": "REMOVE_SITTING_CLOSENESS",
          "actorId": { "var": "event.payload.actorId" },
          "targetId": { "var": "cached.surfaceId" },
          "removeOthersAtTarget": true
        },
        {
          "type": "REMOVE_COMPONENT",
          "entityId": { "var": "event.payload.actorId" },
          "componentId": "positioning:bending_over"
        },
        {
          "type": "MODIFY_COMPONENT",
          "entityId": { "var": "event.payload.actorId" },
          "componentId": "core:movement",
          "data": {
            "locked": false,
            "lockReason": null
          }
        },
        {
          "type": "LOG_ENTRY",
          "message": {
            "cat": [
              { "var": "actor.components.core:name.value" },
              " straightens up from ",
              { "var": "target.components.core:name.value" },
              "."
            ]
          },
          "logType": "action",
          "actorId": { "var": "event.payload.actorId" }
        },
        {
          "type": "END_TURN",
          "actorId": { "var": "event.payload.actorId" }
        }
      ],
      "elseOperations": [
        {
          "type": "LOG_ENTRY",
          "message": "Actor is not bending over anything.",
          "logType": "error",
          "actorId": { "var": "event.payload.actorId" }
        }
      ]
    }
  ]
}
```

### Step 2: Operation Breakdown

**CONDITIONAL Check:**
- Verifies actor has `positioning:bending_over` component
- Prevents invalid straighten attempts

**CACHE_VALUE:**
- Stores the surface_id before removing component
- Needed for closeness removal operation

**REMOVE_SITTING_CLOSENESS:**
- Reuses existing closeness removal operation
- Sets `removeOthersAtTarget: true` to remove closeness with all actors at surface
- Uses cached surface_id to identify relationships to remove

**REMOVE_COMPONENT:**
- Removes the `positioning:bending_over` component entirely
- Clears the positioning state

**MODIFY_COMPONENT (movement):**
- Sets `locked: false` to restore movement
- Clears `lockReason` field
- Actor can now move freely again

**LOG_ENTRY:**
- Provides user feedback: "[Actor] straightens up from [surface]."
- Uses concatenation for dynamic message

**END_TURN:**
- Completes the actor's turn after successful straightening

### Step 3: Validate Rule Schema
```bash
npm run validate-rule data/mods/positioning/rules/handle_straighten_up.rule.json
```

### Step 4: Update Positioning Mod Manifest
Add the rule to `data/mods/positioning/mod-manifest.json`:

```json
{
  "rules": [
    // ... existing rules
    "positioning:handle_straighten_up"
  ]
}
```

## Testing Requirements

### Unit Tests

1. **Successful Straightening Test**:
```javascript
describe('handle_straighten_up rule', () => {
  it('should remove bending_over component on success', async () => {
    const actor = createActor('test:actor', {
      'positioning:bending_over': { surface_id: 'test:counter' }
    });
    const counter = createEntity('test:counter', {
      'positioning:allows_bending_over': {}
    });

    const event = {
      type: 'ACTION_ATTEMPTED',
      payload: {
        actionId: 'positioning:straighten_up',
        actorId: actor.id,
        targetId: counter.id
      }
    };

    await processRule('positioning:handle_straighten_up', event);

    const updatedActor = getEntity(actor.id);
    expect(updatedActor.components['positioning:bending_over']).toBeUndefined();
  });

  it('should unlock movement when straightening', async () => {
    const actor = createActor('test:actor', {
      'positioning:bending_over': { surface_id: 'test:counter' },
      'core:movement': { locked: true, lockReason: 'bending over' }
    });

    // ... process event

    const updatedActor = getEntity(actor.id);
    expect(updatedActor.components['core:movement'].locked).toBe(false);
    expect(updatedActor.components['core:movement'].lockReason).toBeNull();
  });
});
```

2. **Closeness Removal Test**:
```javascript
describe('Automatic closeness removal', () => {
  it('should remove closeness with others at same surface', async () => {
    const actor1 = createActor('test:actor1', {
      'positioning:bending_over': { surface_id: 'test:counter' }
    });
    const actor2 = createActor('test:actor2', {
      'positioning:bending_over': { surface_id: 'test:counter' }
    });

    // Establish initial closeness
    establishCloseness(actor1.id, actor2.id, 'automatic');

    const event = {
      type: 'ACTION_ATTEMPTED',
      payload: {
        actionId: 'positioning:straighten_up',
        actorId: actor1.id,
        targetId: 'test:counter'
      }
    };

    await processRule('positioning:handle_straighten_up', event);

    const closeness = getClosenessRelationships(actor1.id);
    expect(closeness).not.toContain(actor2.id);
  });

  it('should not affect closeness with actors at other surfaces', async () => {
    const actor1 = createActor('test:actor1', {
      'positioning:bending_over': { surface_id: 'test:counter' }
    });
    const actor3 = createActor('test:actor3', {
      'positioning:bending_over': { surface_id: 'test:table' }
    });

    establishCloseness(actor1.id, actor3.id, 'manual');

    // ... process straighten_up event

    const closeness = getClosenessRelationships(actor1.id);
    expect(closeness).toContain(actor3.id); // Should remain
  });
});
```

3. **Invalid State Test**:
```javascript
describe('Invalid state handling', () => {
  it('should log error if not bending', async () => {
    const actor = createActor('test:actor'); // No bending_over component

    const event = {
      type: 'ACTION_ATTEMPTED',
      payload: {
        actionId: 'positioning:straighten_up',
        actorId: actor.id,
        targetId: 'test:counter'
      }
    };

    const logs = await processRule('positioning:handle_straighten_up', event);

    expect(logs).toContainEqual(
      expect.objectContaining({
        logType: 'error',
        message: 'Actor is not bending over anything.'
      })
    );
  });
});
```

### Integration Tests

1. **Complete Bend-Straighten Cycle**:
```javascript
describe('Full positioning cycle', () => {
  it('should handle complete bend and straighten cycle', async () => {
    const actor = createActor('test:actor');
    const counter = createEntity('test:counter', {
      'positioning:allows_bending_over': {}
    });

    // Bend over
    await performAction(actor, 'positioning:bend_over', counter);
    expect(actor.components['positioning:bending_over']).toBeDefined();
    expect(actor.components['core:movement'].locked).toBe(true);

    // Straighten up
    await performAction(actor, 'positioning:straighten_up', counter);
    expect(actor.components['positioning:bending_over']).toBeUndefined();
    expect(actor.components['core:movement'].locked).toBe(false);
  });
});
```

2. **State Restoration Test**:
   - Verify actor returns to exact pre-bending state
   - Check all component values restored properly
   - Ensure no residual effects remain

## Code Examples

### Example Rule Context
```javascript
// Context during straighten_up execution
const ruleContext = {
  event: {
    type: 'ACTION_ATTEMPTED',
    payload: {
      actionId: 'positioning:straighten_up',
      actorId: 'player:001',
      targetId: 'kitchen:counter'
    }
  },
  actor: {
    id: 'player:001',
    components: {
      'core:name': { value: 'Alice' },
      'positioning:bending_over': { surface_id: 'kitchen:counter' },
      'core:movement': { locked: true, lockReason: 'bending over' }
    }
  },
  target: {
    id: 'kitchen:counter',
    components: {
      'core:name': { value: 'the kitchen counter' },
      'positioning:allows_bending_over': {}
    }
  },
  cached: {
    surfaceId: 'kitchen:counter' // Cached from CACHE_VALUE operation
  }
};
```

### Example Operation Handler Implementation
```javascript
// REMOVE_SITTING_CLOSENESS operation (reused for bending)
async function removeSittingCloseness(operation, context) {
  const { actorId, targetId, removeOthersAtTarget } = operation;

  if (removeOthersAtTarget) {
    // Find all actors with closeness due to same surface
    const othersAtSurface = entities.filter(e =>
      e.components['positioning:bending_over']?.surface_id === targetId &&
      e.id !== actorId
    );

    // Remove closeness with each
    for (const other of othersAtSurface) {
      await removeCloseness(actorId, other.id, 'automatic');
    }
  }
}
```

## Notes
- Rule is simpler than handle_get_up_from_furniture (no position to clear)
- Uses caching to preserve surface_id before component removal
- Movement unlocking is critical for game flow
- Closeness removal maintains relationship consistency
- Turn ending ensures clean state transition

## Dependencies
- Blocks: None (endpoint of action flow)
- Blocked by: BENOVERSYS-001 through BENOVERSYS-005 (requires all previous components)

## Estimated Effort
- 45 minutes implementation
- 1 hour testing and validation

## Risk Assessment
- **Medium Risk**: State restoration must be complete and correct
- **Mitigation**: Comprehensive testing of state changes
- **Recovery**: Rule modifications don't affect stored game state

## Success Metrics
- Rule file created with all required operations
- Rule validation passes
- Component removal works correctly
- Movement unlocked after straightening
- Closeness relationships properly cleaned up
- Error handling works for invalid states
- Turn ends properly after execution