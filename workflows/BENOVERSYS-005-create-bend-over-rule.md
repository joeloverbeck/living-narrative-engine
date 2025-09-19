# BENOVERSYS-005: Create Bend Over Rule

## Overview
Create the `handle_bend_over` rule that processes bend_over action attempts. This rule will add the bending_over component to actors, establish automatic closeness relationships with other actors at the same surface, lock movement, and provide appropriate feedback.

## Prerequisites
- BENOVERSYS-001 through BENOVERSYS-004 completed
- Understanding of rule operation syntax
- Knowledge of existing positioning rule patterns (handle_sit_down)
- Familiarity with operation types (MODIFY_COMPONENT, ESTABLISH_SITTING_CLOSENESS, etc.)

## Acceptance Criteria
1. Rule correctly processes bend_over action attempts
2. Adds bending_over component with proper surface reference
3. Locks actor movement while bent over
4. Establishes automatic closeness with other actors at same surface
5. Provides appropriate log messages for feedback
6. Ends turn after successful execution
7. Validates against rule schema

## Implementation Steps

### Step 1: Create handle_bend_over Rule
Create `data/mods/positioning/rules/handle_bend_over.rule.json`:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "positioning:handle_bend_over",
  "description": "Handles actor bending over a surface",
  "conditions": ["positioning:event-is-action-bend-over"],
  "operations": [
    {
      "type": "CONDITIONAL",
      "condition": {
        "has": [
          { "var": "target.components" },
          "positioning:allows_bending_over"
        ]
      },
      "operations": [
        {
          "type": "MODIFY_COMPONENT",
          "entityId": { "var": "event.payload.actorId" },
          "componentId": "positioning:bending_over",
          "data": {
            "surface_id": { "var": "event.payload.targetId" }
          }
        },
        {
          "type": "MODIFY_COMPONENT",
          "entityId": { "var": "event.payload.actorId" },
          "componentId": "core:movement",
          "data": {
            "locked": true,
            "lockReason": "bending over"
          }
        },
        {
          "type": "ESTABLISH_SITTING_CLOSENESS",
          "actorId": { "var": "event.payload.actorId" },
          "targetId": { "var": "event.payload.targetId" },
          "findOthersAtTarget": true
        },
        {
          "type": "LOG_ENTRY",
          "message": {
            "cat": [
              { "var": "actor.components.core:name.value" },
              " bends over ",
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
          "message": "Invalid target for bending over.",
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
- Verifies target has `positioning:allows_bending_over` component
- Prevents invalid bending attempts

**MODIFY_COMPONENT (bending_over):**
- Adds the `positioning:bending_over` component to actor
- Sets `surface_id` to reference the target surface
- Creates the bidirectional relationship

**MODIFY_COMPONENT (movement):**
- Sets `locked: true` on movement component
- Adds `lockReason: "bending over"` for debugging
- Prevents actor from moving while bent over

**ESTABLISH_SITTING_CLOSENESS:**
- Reuses existing closeness operation (could be renamed in future)
- Sets `findOthersAtTarget: true` to find all actors at same surface
- Establishes automatic closeness between all actors bent over same surface

**LOG_ENTRY:**
- Provides user feedback: "[Actor] bends over [surface]."
- Uses concatenation (`cat`) for dynamic message

**END_TURN:**
- Completes the actor's turn after successful bending

### Step 3: Validate Rule Schema
```bash
npm run validate-rule data/mods/positioning/rules/handle_bend_over.rule.json
```

### Step 4: Update Positioning Mod Manifest
Add the rule to `data/mods/positioning/mod-manifest.json`:

```json
{
  "rules": [
    // ... existing rules
    "positioning:handle_bend_over"
  ]
}
```

## Testing Requirements

### Unit Tests

1. **Successful Bending Test**:
```javascript
describe('handle_bend_over rule', () => {
  it('should add bending_over component on success', async () => {
    const actor = createActor('test:actor');
    const counter = createEntity('test:counter', {
      'positioning:allows_bending_over': {}
    });

    const event = {
      type: 'ACTION_ATTEMPTED',
      payload: {
        actionId: 'positioning:bend_over',
        actorId: actor.id,
        targetId: counter.id
      }
    };

    await processRule('positioning:handle_bend_over', event);

    const updatedActor = getEntity(actor.id);
    expect(updatedActor.components['positioning:bending_over']).toEqual({
      surface_id: counter.id
    });
  });

  it('should lock movement when bending', async () => {
    // ... setup
    await processRule('positioning:handle_bend_over', event);

    const updatedActor = getEntity(actor.id);
    expect(updatedActor.components['core:movement'].locked).toBe(true);
    expect(updatedActor.components['core:movement'].lockReason).toBe('bending over');
  });
});
```

2. **Closeness Establishment Test**:
```javascript
describe('Automatic closeness', () => {
  it('should establish closeness with others at same surface', async () => {
    const actor1 = createActor('test:actor1');
    const actor2 = createActor('test:actor2', {
      'positioning:bending_over': { surface_id: 'test:counter' }
    });
    const counter = createEntity('test:counter', {
      'positioning:allows_bending_over': {}
    });

    const event = {
      type: 'ACTION_ATTEMPTED',
      payload: {
        actionId: 'positioning:bend_over',
        actorId: actor1.id,
        targetId: counter.id
      }
    };

    await processRule('positioning:handle_bend_over', event);

    const closeness = getClosenessRelationships(actor1.id);
    expect(closeness).toContain(actor2.id);
  });
});
```

3. **Invalid Target Test**:
```javascript
describe('Invalid target handling', () => {
  it('should log error for invalid target', async () => {
    const actor = createActor('test:actor');
    const nonSurface = createEntity('test:wall'); // No allows_bending_over

    const event = {
      type: 'ACTION_ATTEMPTED',
      payload: {
        actionId: 'positioning:bend_over',
        actorId: actor.id,
        targetId: nonSurface.id
      }
    };

    const logs = await processRule('positioning:handle_bend_over', event);

    expect(logs).toContainEqual(
      expect.objectContaining({
        logType: 'error',
        message: 'Invalid target for bending over.'
      })
    );
  });
});
```

### Integration Tests

1. **Complete Action Flow**:
   - User selects bend_over action in UI
   - Event dispatched through event bus
   - Condition matches and triggers rule
   - Rule processes and updates game state
   - UI reflects new positioning state

2. **Concurrent Bending**:
   - Multiple actors bend over same surface
   - Verify all get proper closeness relationships
   - No race conditions or conflicts

## Code Examples

### Example Rule Context
```javascript
// Context available during rule execution
const ruleContext = {
  event: {
    type: 'ACTION_ATTEMPTED',
    payload: {
      actionId: 'positioning:bend_over',
      actorId: 'player:001',
      targetId: 'kitchen:counter'
    }
  },
  actor: {
    id: 'player:001',
    components: {
      'core:name': { value: 'Alice' },
      'core:position': { locationId: 'kitchen:room' }
    }
  },
  target: {
    id: 'kitchen:counter',
    components: {
      'core:name': { value: 'the kitchen counter' },
      'positioning:allows_bending_over': {}
    }
  }
};
```

### Example Operation Handler Implementation
```javascript
// ESTABLISH_SITTING_CLOSENESS operation (reused for bending)
async function establishSittingCloseness(operation, context) {
  const { actorId, targetId, findOthersAtTarget } = operation;

  if (findOthersAtTarget) {
    // Find all actors with bending_over component at same surface
    const othersAtSurface = entities.filter(e =>
      e.components['positioning:bending_over']?.surface_id === targetId &&
      e.id !== actorId
    );

    // Establish closeness with each
    for (const other of othersAtSurface) {
      await establishCloseness(actorId, other.id, 'automatic');
    }
  }
}
```

## Notes
- Rule is simpler than handle_sit_down (no position allocation)
- Reuses ESTABLISH_SITTING_CLOSENESS operation (works for any proximity)
- Movement locking ensures positional consistency
- Log messages provide clear user feedback
- Turn ending prevents further actions while processing

## Dependencies
- Blocks: None (endpoint of action flow)
- Blocked by: BENOVERSYS-001 through BENOVERSYS-004 (requires all components, scopes, actions, conditions)

## Estimated Effort
- 45 minutes implementation
- 1 hour testing and validation

## Risk Assessment
- **Medium Risk**: Complex operation sequence must execute correctly
- **Mitigation**: Thorough testing of each operation
- **Recovery**: Rule can be modified without affecting other systems

## Success Metrics
- Rule file created with all required operations
- Rule validation passes
- Successful bending adds component and locks movement
- Closeness relationships established correctly
- Error handling works for invalid targets
- Turn ends properly after execution