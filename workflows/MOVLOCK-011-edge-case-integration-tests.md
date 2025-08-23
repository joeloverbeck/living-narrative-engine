# MOVLOCK-011: Edge Case Integration Tests

**Status**: NOT_STARTED  
**Priority**: LOW  
**Dependencies**: MOVLOCK-001 through MOVLOCK-006, MOVLOCK-009, MOVLOCK-010  
**Estimated Effort**: 2 hours

## Context

Edge case integration tests ensure the movement lock system handles unusual and boundary conditions gracefully. These tests cover entities without legs, asymmetric anatomy, multiple simultaneous operations, and error conditions.

## Implementation Steps

### 1. Create Test File

**File**: `tests/integration/positioning/movementLockEdgeCases.test.js`

### 2. Test Structure Template

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedFactory } from '../../common/testbedFactory.js';
import { executeAction } from '../../common/actionTestHelpers.js';

describe('Movement Lock - Edge Cases', () => {
  let testBed;
  let entityManager;
  let actionExecutor;
  let eventBus;
  let logger;

  beforeEach(async () => {
    testBed = TestBedFactory.create('positioning');
    await testBed.initialize();

    entityManager = testBed.getService('IEntityManager');
    actionExecutor = testBed.getService('IActionExecutor');
    eventBus = testBed.getService('IEventBus');
    logger = testBed.getService('ILogger');
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  // Test cases go here...
});
```

### 3. Required Test Cases

#### 3.1 Entities Without Legs

```javascript
describe('entities without legs', () => {
  it('should handle anatomy entity with no leg parts gracefully', async () => {
    // Setup: Create entity with anatomy but no legs (e.g., ghost, snake)
    const actorId = 'legless-entity';
    const targetId = 'target-001';

    await entityManager.createEntity(actorId);
    await entityManager.addComponent(actorId, 'anatomy:body', {
      recipe: 'ghost',
      parts: {
        head: `${actorId}-head`,
        torso: `${actorId}-torso`,
        // No leg parts
      },
    });

    // Create non-leg body parts
    await entityManager.createEntity(`${actorId}-head`);
    await entityManager.createEntity(`${actorId}-torso`);

    await entityManager.createEntity(targetId);

    // Execute: Should not throw error
    await expect(
      actionExecutor.execute('positioning:kneel_before', {
        actorId: actorId,
        targetId: targetId,
      })
    ).resolves.not.toThrow();

    // Assert: Kneeling component still added despite no legs
    const kneelingData = await entityManager.getComponentData(
      actorId,
      'positioning:kneeling'
    );
    expect(kneelingData).toBeDefined();
    expect(kneelingData.target_id).toBe(targetId);
  });

  it('should handle snake-like entity with alternative locomotion', async () => {
    // Setup: Entity with tail instead of legs
    const actorId = 'snake-entity';
    const tailId = `${actorId}-tail`;
    const targetId = 'target-001';

    await entityManager.createEntity(actorId);
    await entityManager.addComponent(actorId, 'anatomy:body', {
      recipe: 'serpent',
      parts: {
        tail: tailId,
      },
    });

    // Tail has movement but isn't a leg
    await entityManager.createEntity(tailId);
    await entityManager.addComponent(tailId, 'core:movement', {
      locked: false,
    });
    await entityManager.addComponent(tailId, 'anatomy:body_part', {
      type: 'tail',
    });

    await entityManager.createEntity(targetId);

    // Execute: Kneel (coil?) action
    await actionExecutor.execute('positioning:kneel_before', {
      actorId: actorId,
      targetId: targetId,
    });

    // Assert: Movement component on tail should be locked
    // (assuming utility checks for movement components regardless of part type)
    const tailMovement = await entityManager.getComponentData(
      tailId,
      'core:movement'
    );
    expect(tailMovement.locked).toBe(true);
  });
});
```

#### 3.2 Asymmetric Anatomy

```javascript
describe('asymmetric anatomy', () => {
  it('should handle entity with single leg', async () => {
    // Setup: One-legged entity
    const actorId = 'peg-leg-pete';
    const legId = `${actorId}-leg`;
    const targetId = 'target-001';

    await entityManager.createEntity(actorId);
    await entityManager.addComponent(actorId, 'anatomy:body', {
      recipe: 'pirate',
      parts: {
        left_leg: legId,
        // right_leg missing/wooden
      },
    });

    await entityManager.createEntity(legId);
    await entityManager.addComponent(legId, 'core:movement', {
      locked: false,
    });

    await entityManager.createEntity(targetId);

    // Execute: Kneel on one leg
    await actionExecutor.execute('positioning:kneel_before', {
      actorId: actorId,
      targetId: targetId,
    });

    // Assert: Single leg is locked
    const legMovement = await entityManager.getComponentData(
      legId,
      'core:movement'
    );
    expect(legMovement.locked).toBe(true);

    // Execute: Stand up
    await actionExecutor.execute('positioning:stand_up', {
      actorId: actorId,
    });

    // Assert: Single leg is unlocked
    const updatedMovement = await entityManager.getComponentData(
      legId,
      'core:movement'
    );
    expect(updatedMovement.locked).toBe(false);
  });

  it('should handle entity with uneven number of legs', async () => {
    // Setup: Three-legged entity
    const actorId = 'tripod-creature';
    const leg1 = `${actorId}-leg-1`;
    const leg2 = `${actorId}-leg-2`;
    const leg3 = `${actorId}-leg-3`;
    const targetId = 'target-001';

    await entityManager.createEntity(actorId);
    await entityManager.addComponent(actorId, 'anatomy:body', {
      recipe: 'tripod',
      parts: {
        front_leg: leg1,
        back_left_leg: leg2,
        back_right_leg: leg3,
      },
    });

    // Create all three legs
    for (const legId of [leg1, leg2, leg3]) {
      await entityManager.createEntity(legId);
      await entityManager.addComponent(legId, 'core:movement', {
        locked: false,
      });
    }

    await entityManager.createEntity(targetId);

    // Execute: Kneel
    await actionExecutor.execute('positioning:kneel_before', {
      actorId: actorId,
      targetId: targetId,
    });

    // Assert: All three legs locked
    for (const legId of [leg1, leg2, leg3]) {
      const movement = await entityManager.getComponentData(
        legId,
        'core:movement'
      );
      expect(movement.locked).toBe(true);
    }
  });
});
```

#### 3.3 Timing and State Issues

```javascript
describe('timing and state issues', () => {
  it('should handle standing without being kneeled', async () => {
    // Setup: Standing entity
    const actorId = 'standing-actor';
    await createAnatomyActor(actorId);

    // Execute: Stand up without kneeling first
    await expect(
      actionExecutor.execute('positioning:stand_up', {
        actorId: actorId,
      })
    ).resolves.not.toThrow();

    // Assert: Movement components remain unlocked
    const leftLeg = await entityManager.getComponentData(
      `${actorId}-left-leg`,
      'core:movement'
    );
    const rightLeg = await entityManager.getComponentData(
      `${actorId}-right-leg`,
      'core:movement'
    );
    expect(leftLeg.locked).toBe(false);
    expect(rightLeg.locked).toBe(false);
  });

  it('should handle multiple actors kneeling to same target simultaneously', async () => {
    // Setup: Multiple actors, one target
    const actors = ['actor-1', 'actor-2', 'actor-3'];
    const targetId = 'popular-target';

    await entityManager.createEntity(targetId);

    // Create all actors
    for (const actorId of actors) {
      await createAnatomyActor(actorId);
    }

    // Execute: All kneel simultaneously (parallel execution)
    const kneelPromises = actors.map((actorId) =>
      actionExecutor.execute('positioning:kneel_before', {
        actorId: actorId,
        targetId: targetId,
      })
    );

    await Promise.all(kneelPromises);

    // Assert: All actors have locked movement
    for (const actorId of actors) {
      const leftLeg = await entityManager.getComponentData(
        `${actorId}-left-leg`,
        'core:movement'
      );
      const rightLeg = await entityManager.getComponentData(
        `${actorId}-right-leg`,
        'core:movement'
      );
      expect(leftLeg.locked).toBe(true);
      expect(rightLeg.locked).toBe(true);
    }

    // Execute: All stand simultaneously
    const standPromises = actors.map((actorId) =>
      actionExecutor.execute('positioning:stand_up', {
        actorId: actorId,
      })
    );

    await Promise.all(standPromises);

    // Assert: All actors have unlocked movement
    for (const actorId of actors) {
      const leftLeg = await entityManager.getComponentData(
        `${actorId}-left-leg`,
        'core:movement'
      );
      const rightLeg = await entityManager.getComponentData(
        `${actorId}-right-leg`,
        'core:movement'
      );
      expect(leftLeg.locked).toBe(false);
      expect(rightLeg.locked).toBe(false);
    }
  });

  it('should handle rapid kneel-stand-kneel sequences', async () => {
    // Setup: Single actor
    const actorId = 'rapid-actor';
    const targetId = 'target-001';

    await createAnatomyActor(actorId);
    await entityManager.createEntity(targetId);

    // Execute: Rapid state changes
    await actionExecutor.execute('positioning:kneel_before', {
      actorId: actorId,
      targetId: targetId,
    });

    await actionExecutor.execute('positioning:stand_up', {
      actorId: actorId,
    });

    await actionExecutor.execute('positioning:kneel_before', {
      actorId: actorId,
      targetId: targetId,
    });

    // Assert: Final state is kneeling with locked movement
    const leftLeg = await entityManager.getComponentData(
      `${actorId}-left-leg`,
      'core:movement'
    );
    const rightLeg = await entityManager.getComponentData(
      `${actorId}-right-leg`,
      'core:movement'
    );
    const kneeling = await entityManager.getComponentData(
      actorId,
      'positioning:kneeling'
    );

    expect(leftLeg.locked).toBe(true);
    expect(rightLeg.locked).toBe(true);
    expect(kneeling).toBeDefined();
  });
});
```

#### 3.4 Error Conditions

```javascript
describe('error conditions', () => {
  it('should handle non-existent actor gracefully', async () => {
    // Execute: Kneel with non-existent actor
    const result = await actionExecutor.execute('positioning:kneel_before', {
      actorId: 'non-existent-actor',
      targetId: 'target-001',
    });

    // Assert: Should fail gracefully
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle corrupted anatomy data', async () => {
    // Setup: Entity with invalid anatomy structure
    const actorId = 'corrupted-actor';
    const targetId = 'target-001';

    await entityManager.createEntity(actorId);
    await entityManager.addComponent(actorId, 'anatomy:body', {
      recipe: 'invalid',
      parts: {
        left_leg: 'non-existent-entity-id',
        right_leg: null,
      },
    });

    await entityManager.createEntity(targetId);

    // Execute: Should handle gracefully
    await expect(
      actionExecutor.execute('positioning:kneel_before', {
        actorId: actorId,
        targetId: targetId,
      })
    ).resolves.not.toThrow();
  });

  it('should handle movement component with invalid data', async () => {
    // Setup: Entity with malformed movement component
    const actorId = 'invalid-movement-actor';
    const legId = `${actorId}-leg`;
    const targetId = 'target-001';

    await entityManager.createEntity(actorId);
    await entityManager.addComponent(actorId, 'anatomy:body', {
      recipe: 'test',
      parts: { leg: legId },
    });

    await entityManager.createEntity(legId);
    await entityManager.addComponent(legId, 'core:movement', {
      locked: 'not-a-boolean', // Invalid type
      forcedOverride: null,
    });

    await entityManager.createEntity(targetId);

    // Execute: Should handle type coercion or validation
    await actionExecutor.execute('positioning:kneel_before', {
      actorId: actorId,
      targetId: targetId,
    });

    // Assert: Movement should be updated despite initial invalid data
    const movement = await entityManager.getComponentData(
      legId,
      'core:movement'
    );
    expect(typeof movement.locked).toBe('boolean');
    expect(movement.locked).toBe(true);
  });
});
```

#### 3.5 Helper Functions

```javascript
// Helper to create anatomy actor with standard legs
async function createAnatomyActor(actorId) {
  await entityManager.createEntity(actorId);

  const leftLegId = `${actorId}-left-leg`;
  const rightLegId = `${actorId}-right-leg`;

  await entityManager.addComponent(actorId, 'anatomy:body', {
    recipe: 'humanoid',
    parts: {
      left_leg: leftLegId,
      right_leg: rightLegId,
    },
  });

  await entityManager.createEntity(leftLegId);
  await entityManager.addComponent(leftLegId, 'core:movement', {
    locked: false,
    forcedOverride: false,
  });

  await entityManager.createEntity(rightLegId);
  await entityManager.addComponent(rightLegId, 'core:movement', {
    locked: false,
    forcedOverride: false,
  });

  return actorId;
}
```

### 4. Implementation Checklist

- [ ] Create test file `movementLockEdgeCases.test.js`
- [ ] Import required dependencies
- [ ] Test entities without legs
- [ ] Test snake-like entities
- [ ] Test single leg entities
- [ ] Test odd number of legs (3)
- [ ] Test standing without kneeling
- [ ] Test multiple simultaneous operations
- [ ] Test rapid state changes
- [ ] Test non-existent entities
- [ ] Test corrupted anatomy data
- [ ] Test invalid movement component data
- [ ] Create helper functions
- [ ] Run tests and verify all pass

## Validation Criteria

1. **Graceful handling**: No unhandled errors or crashes
2. **Predictable behavior**: Edge cases produce expected results
3. **Data integrity**: Invalid data doesn't corrupt system state
4. **Performance**: Concurrent operations don't cause race conditions
5. **Error messages**: Clear feedback for invalid operations

## Testing Requirements

```bash
# Run edge case tests
npm run test:integration tests/integration/positioning/movementLockEdgeCases.test.js

# Run all movement lock integration tests
npm run test:integration tests/integration/positioning/

# Run with verbose output for debugging
npm run test:integration -- --verbose
```

## Notes

- Edge cases test the robustness of the implementation
- The updateMovementLock utility should handle most edge cases gracefully
- Focus on scenarios that could occur in real gameplay
- Consider adding performance tests for many simultaneous operations
- Error handling should be informative but not crash the system

## References

- Spec section 4.2.3: Edge Case Tests
- Spec section 7.1: Risk Mitigation
- Similar edge case tests: Look for other integration test edge cases
- Error handling patterns: `src/utils/safeDispatchErrorUtils.js`
