# MOULOCSYS-009: Update Positioning Actions Prerequisites

**Phase**: Action Updates  
**Priority**: High  
**Complexity**: Medium  
**Dependencies**: MOULOCSYS-002 (condition), MOULOCSYS-007 (manifest)  
**Estimated Time**: 4-5 hours

## Summary

Add mouth availability prerequisites to positioning actions that would be illogical during mouth-engaging activities like kissing. This prevents actions like kneeling, turning back, or stepping back while the actor's mouth is engaged.

## Technical Requirements

### Files to Modify

1. `data/mods/positioning/actions/kneel_before.action.json`
2. `data/mods/positioning/actions/place_yourself_behind.action.json`
3. `data/mods/positioning/actions/turn_your_back.action.json`
4. `data/mods/positioning/actions/step_back.action.json`

### Prerequisite Pattern

#### Mouth Availability Prerequisite
```json
{
  "prerequisites": [
    // ... existing prerequisites ...
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

### Action Updates

#### kneel_before.action.json
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:kneel_before",
  "name": "Kneel before",
  "description": "Kneel in front of another character",
  "prerequisites": [
    {
      "condition": {
        "logic": {
          "condition_ref": "core:actor-can-move"
        }
      },
      "failureMessage": "You cannot move right now."
    },
    {
      "condition": {
        "logic": {
          "condition_ref": "core:actor-mouth-available"
        }
      },
      "failureMessage": "You cannot do that while your mouth is engaged."
    }
    // ... other prerequisites ...
  ],
  // ... rest of action definition unchanged ...
}
```

#### place_yourself_behind.action.json
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:place_yourself_behind",
  "name": "Place yourself behind",
  "description": "Move to position yourself behind another character",
  "prerequisites": [
    {
      "condition": {
        "logic": {
          "condition_ref": "core:actor-can-move"
        }
      },
      "failureMessage": "You cannot move right now."
    },
    {
      "condition": {
        "logic": {
          "condition_ref": "core:actor-mouth-available"
        }
      },
      "failureMessage": "You cannot do that while your mouth is engaged."
    }
    // ... other prerequisites ...
  ],
  // ... rest of action definition unchanged ...
}
```

#### turn_your_back.action.json
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:turn_your_back",
  "name": "Turn your back",
  "description": "Turn around to face away from another character",
  "prerequisites": [
    {
      "condition": {
        "logic": {
          "condition_ref": "core:actor-can-move"
        }
      },
      "failureMessage": "You cannot move right now."
    },
    {
      "condition": {
        "logic": {
          "condition_ref": "core:actor-mouth-available"
        }
      },
      "failureMessage": "You cannot do that while your mouth is engaged."
    }
    // ... other prerequisites ...
  ],
  // ... rest of action definition unchanged ...
}
```

#### step_back.action.json
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:step_back",
  "name": "Step back",
  "description": "Take a step backward to increase distance",
  "prerequisites": [
    {
      "condition": {
        "logic": {
          "condition_ref": "core:actor-can-move"
        }
      },
      "failureMessage": "You cannot move right now."
    },
    {
      "condition": {
        "logic": {
          "condition_ref": "core:actor-mouth-available"
        }
      },
      "failureMessage": "You cannot do that while your mouth is engaged."
    }
    // ... other prerequisites ...
  ],
  // ... rest of action definition unchanged ...
}
```

## Acceptance Criteria

### Action Updates
- [ ] **Prerequisites Added**: Mouth availability check in all 4 actions
- [ ] **Failure Messages**: Clear user-friendly error messages
- [ ] **JSON Valid**: All modified files parse correctly
- [ ] **Schema Valid**: All actions validate against action.schema.json
- [ ] **Existing Logic**: All existing prerequisites preserved

### Behavioral Requirements
- [ ] **Actions Unavailable**: Actions unavailable when mouth locked
- [ ] **Actions Available**: Actions available when mouth unlocked
- [ ] **Clear Feedback**: Users understand why actions unavailable
- [ ] **No False Positives**: Actions available for mouthless entities
- [ ] **Performance**: Condition checks complete quickly

## Testing Strategy

### Unit Tests

File: `tests/unit/mods/positioning/mouthEngagementPrerequisites.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Positioning Actions - Mouth Engagement Prerequisites', () => {
  let testBed;
  let actionSystem;
  let entityManager;
  let conditionEvaluator;

  beforeEach(() => {
    testBed = createTestBed();
    actionSystem = testBed.actionSystem;
    entityManager = testBed.entityManager;
    conditionEvaluator = testBed.conditionEvaluator;
  });

  const positioningActions = [
    'positioning:kneel_before',
    'positioning:place_yourself_behind', 
    'positioning:turn_your_back',
    'positioning:step_back'
  ];

  describe('Mouth Available Cases', () => {
    positioningActions.forEach(actionId => {
      it(`should allow ${actionId} when mouth is available`, async () => {
        const actor = await createTestActor(entityManager, { 
          hasMouth: true,
          mouthLocked: false 
        });
        const target = await createTestActor(entityManager);

        const canPerform = await actionSystem.canPerformAction(
          actor.id,
          actionId,
          { target_id: target.id }
        );

        expect(canPerform.allowed).toBe(true);
      });
    });

    it('should allow actions for entities without mouths', async () => {
      const actor = await createTestActor(entityManager, { 
        hasMouth: false 
      });
      const target = await createTestActor(entityManager);

      for (const actionId of positioningActions) {
        const canPerform = await actionSystem.canPerformAction(
          actor.id,
          actionId,
          { target_id: target.id }
        );

        expect(canPerform.allowed).toBe(true);
      }
    });
  });

  describe('Mouth Engaged Cases', () => {
    positioningActions.forEach(actionId => {
      it(`should prevent ${actionId} when mouth is engaged`, async () => {
        const actor = await createTestActor(entityManager, { 
          hasMouth: true,
          mouthLocked: true 
        });
        const target = await createTestActor(entityManager);

        const canPerform = await actionSystem.canPerformAction(
          actor.id,
          actionId,
          { target_id: target.id }
        );

        expect(canPerform.allowed).toBe(false);
        expect(canPerform.reason).toContain('mouth is engaged');
      });
    });
  });

  describe('Existing Prerequisites', () => {
    it('should preserve movement lock prerequisite', async () => {
      const actor = await createTestActor(entityManager, { 
        hasMouth: true,
        mouthLocked: false,
        movementLocked: true  // Movement locked
      });
      const target = await createTestActor(entityManager);

      for (const actionId of positioningActions) {
        const canPerform = await actionSystem.canPerformAction(
          actor.id,
          actionId,
          { target_id: target.id }
        );

        expect(canPerform.allowed).toBe(false);
        expect(canPerform.reason).toContain('cannot move');
      }
    });

    it('should require both movement and mouth availability', async () => {
      const actor = await createTestActor(entityManager, { 
        hasMouth: true,
        mouthLocked: false,
        movementLocked: false
      });
      const target = await createTestActor(entityManager);

      for (const actionId of positioningActions) {
        const canPerform = await actionSystem.canPerformAction(
          actor.id,
          actionId,
          { target_id: target.id }
        );

        expect(canPerform.allowed).toBe(true);
      }
    });
  });
});
```

### Integration Tests

File: `tests/integration/mods/positioning/mouthEngagementIntegration.test.js`

```javascript
describe('Positioning Actions - Mouth Engagement Integration', () => {
  let gameEngine;
  let actionSystem;
  let operationInterpreter;

  beforeEach(async () => {
    gameEngine = await createTestGameEngine();
    actionSystem = gameEngine.actionSystem;
    operationInterpreter = gameEngine.operationInterpreter;
  });

  it('should prevent positioning during kissing workflow', async () => {
    const actor1 = await createTestActor(gameEngine.entityManager, { hasMouth: true });
    const actor2 = await createTestActor(gameEngine.entityManager, { hasMouth: true });

    // Start kissing (locks mouths)
    await actionSystem.performAction(
      actor1.id,
      'intimacy:lean_in_for_deep_kiss',
      { target_id: actor2.id }
    );

    // Verify positioning actions unavailable
    const positioningActions = [
      'positioning:kneel_before',
      'positioning:turn_your_back'
    ];

    for (const actionId of positioningActions) {
      const available = await actionSystem.getAvailableActions(actor1.id);
      expect(available.map(a => a.id)).not.toContain(actionId);
    }

    // End kissing (unlocks mouths)
    await actionSystem.performAction(
      actor1.id,
      'intimacy:break_kiss_gently',
      { target_id: actor2.id }
    );

    // Verify positioning actions available again
    for (const actionId of positioningActions) {
      const canPerform = await actionSystem.canPerformAction(
        actor1.id,
        actionId,
        { target_id: actor2.id }
      );
      expect(canPerform.allowed).toBe(true);
    }
  });
});
```

## Performance Considerations

### Condition Evaluation Impact
- **Additional Check**: One extra condition per action
- **O(n) Complexity**: Where n = number of body parts
- **Early Exit**: Condition returns quickly for locked mouths
- **Caching**: Condition results may be cached by engine

### Action Availability Impact
- **Minimal Overhead**: Simple boolean check
- **UI Responsiveness**: Fast enough for real-time UI updates
- **Batch Evaluation**: Multiple actions checked efficiently

## Definition of Done

- [ ] All 4 positioning actions updated
- [ ] Mouth availability prerequisites added
- [ ] Failure messages added
- [ ] JSON syntax valid for all files
- [ ] Schema validation passes
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Actions unavailable when mouth locked
- [ ] Actions available when mouth unlocked
- [ ] Existing prerequisites preserved