# MOVLOCK-010: Integration Tests for Legacy Entities

**Status**: NOT_STARTED  
**Priority**: MEDIUM  
**Dependencies**: MOVLOCK-001 through MOVLOCK-006  
**Estimated Effort**: 1.5 hours

## Context

Integration tests for legacy entities that have the `core:movement` component directly attached to the actor entity (no anatomy system). These tests ensure backward compatibility with existing game content that doesn't use the anatomy system.

## Implementation Steps

### 1. Create Test File

**File**: `tests/integration/positioning/movementLockLegacyEntities.test.js`

### 2. Test Structure Template

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedFactory } from '../../common/testbedFactory.js';
import { executeAction } from '../../common/actionTestHelpers.js';

describe('Movement Lock - Legacy Entities', () => {
  let testBed;
  let entityManager;
  let actionExecutor;
  let eventBus;

  beforeEach(async () => {
    testBed = TestBedFactory.create('positioning');
    await testBed.initialize();

    entityManager = testBed.getService('IEntityManager');
    actionExecutor = testBed.getService('IActionExecutor');
    eventBus = testBed.getService('IEventBus');
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  // Test cases go here...
});
```

### 3. Required Test Cases

#### 3.1 Basic Movement Lock for Legacy Entity

```javascript
describe('kneeling locks movement - legacy', () => {
  it('should lock movement component when legacy entity kneels', async () => {
    // Setup: Create legacy actor (no anatomy:body component)
    const actorId = 'legacy-actor-001';
    const targetId = 'target-001';

    await entityManager.createEntity(actorId);
    await entityManager.addComponent(actorId, 'core:movement', {
      locked: false,
      forcedOverride: false,
    });

    await entityManager.createEntity(targetId);

    // Execute: Kneel before action
    await actionExecutor.execute('positioning:kneel_before', {
      actorId: actorId,
      targetId: targetId,
    });

    // Assert: Movement component is locked
    const movementData = await entityManager.getComponentData(
      actorId,
      'core:movement'
    );
    expect(movementData.locked).toBe(true);

    // Assert: Kneeling component was added
    const kneelingData = await entityManager.getComponentData(
      actorId,
      'positioning:kneeling'
    );
    expect(kneelingData).toBeDefined();
    expect(kneelingData.target_id).toBe(targetId);
  });

  it('should prevent movement while legacy entity is kneeling', async () => {
    // Setup: Create kneeling legacy entity
    const actorId = await createKneelingLegacyActor();
    const destinationId = 'location-001';

    // Attempt: Try to move while kneeling
    const moveResult = await actionExecutor.execute('core:go', {
      actorId: actorId,
      destinationId: destinationId,
    });

    // Assert: Movement should be blocked
    expect(moveResult.success).toBe(false);
    expect(moveResult.reason).toContain('movement locked');
  });
});
```

#### 3.2 Movement Unlock for Legacy Entity

```javascript
describe('standing unlocks movement - legacy', () => {
  it('should unlock movement component when legacy entity stands', async () => {
    // Setup: Create kneeling legacy entity
    const actorId = await createKneelingLegacyActor();

    // Verify locked state
    let movementData = await entityManager.getComponentData(
      actorId,
      'core:movement'
    );
    expect(movementData.locked).toBe(true);

    // Execute: Stand up action
    await actionExecutor.execute('positioning:stand_up', {
      actorId: actorId,
    });

    // Assert: Movement component is unlocked
    movementData = await entityManager.getComponentData(
      actorId,
      'core:movement'
    );
    expect(movementData.locked).toBe(false);

    // Assert: Kneeling component was removed
    const kneelingData = await entityManager.getComponentData(
      actorId,
      'positioning:kneeling'
    );
    expect(kneelingData).toBeUndefined();
  });

  it('should allow movement after legacy entity stands', async () => {
    // Setup: Create kneeling legacy entity then stand
    const actorId = await createKneelingLegacyActor();
    await actionExecutor.execute('positioning:stand_up', {
      actorId: actorId,
    });

    // Setup: Create destination
    const destinationId = 'location-001';
    await entityManager.createEntity(destinationId);

    // Attempt: Try to move after standing
    const moveResult = await actionExecutor.execute('core:go', {
      actorId: actorId,
      destinationId: destinationId,
    });

    // Assert: Movement should be allowed
    expect(moveResult.success).toBe(true);
  });
});
```

#### 3.3 Mixed Entity Scenarios

```javascript
describe('mixed entity scenarios', () => {
  it('should handle multiple legacy entities kneeling simultaneously', async () => {
    // Setup: Create three legacy actors
    const actors = ['actor-1', 'actor-2', 'actor-3'];
    const target = 'shared-target';

    await entityManager.createEntity(target);

    for (const actorId of actors) {
      await entityManager.createEntity(actorId);
      await entityManager.addComponent(actorId, 'core:movement', {
        locked: false,
      });
    }

    // Execute: All actors kneel
    for (const actorId of actors) {
      await actionExecutor.execute('positioning:kneel_before', {
        actorId: actorId,
        targetId: target,
      });
    }

    // Assert: All actors have locked movement
    for (const actorId of actors) {
      const movement = await entityManager.getComponentData(
        actorId,
        'core:movement'
      );
      expect(movement.locked).toBe(true);
    }

    // Execute: Middle actor stands
    await actionExecutor.execute('positioning:stand_up', {
      actorId: 'actor-2',
    });

    // Assert: Only standing actor has unlocked movement
    const actor1Movement = await entityManager.getComponentData(
      'actor-1',
      'core:movement'
    );
    const actor2Movement = await entityManager.getComponentData(
      'actor-2',
      'core:movement'
    );
    const actor3Movement = await entityManager.getComponentData(
      'actor-3',
      'core:movement'
    );

    expect(actor1Movement.locked).toBe(true);
    expect(actor2Movement.locked).toBe(false);
    expect(actor3Movement.locked).toBe(true);
  });

  it('should work when legacy and anatomy entities kneel together', async () => {
    // Setup: Create one legacy and one anatomy entity
    const legacyId = 'legacy-actor';
    const anatomyId = 'anatomy-actor';
    const targetId = 'shared-target';

    // Create legacy entity
    await createLegacyActor(legacyId);

    // Create anatomy entity
    await createSimpleAnatomyActor(anatomyId);

    // Create target
    await entityManager.createEntity(targetId);

    // Execute: Both kneel
    await actionExecutor.execute('positioning:kneel_before', {
      actorId: legacyId,
      targetId: targetId,
    });

    await actionExecutor.execute('positioning:kneel_before', {
      actorId: anatomyId,
      targetId: targetId,
    });

    // Assert: Legacy entity movement locked
    const legacyMovement = await entityManager.getComponentData(
      legacyId,
      'core:movement'
    );
    expect(legacyMovement.locked).toBe(true);

    // Assert: Anatomy entity legs locked
    const leftLegMovement = await entityManager.getComponentData(
      `${anatomyId}-left-leg`,
      'core:movement'
    );
    const rightLegMovement = await entityManager.getComponentData(
      `${anatomyId}-right-leg`,
      'core:movement'
    );
    expect(leftLegMovement.locked).toBe(true);
    expect(rightLegMovement.locked).toBe(true);
  });
});
```

#### 3.4 Edge Cases for Legacy Entities

```javascript
describe('legacy entity edge cases', () => {
  it('should handle legacy entity without movement component gracefully', async () => {
    // Setup: Create entity without movement component
    const actorId = 'no-movement-actor';
    const targetId = 'target-001';

    await entityManager.createEntity(actorId);
    await entityManager.createEntity(targetId);
    // Note: No movement component added

    // Execute: Should not throw error
    await expect(
      actionExecutor.execute('positioning:kneel_before', {
        actorId: actorId,
        targetId: targetId,
      })
    ).resolves.not.toThrow();

    // Assert: Kneeling component still added
    const kneelingData = await entityManager.getComponentData(
      actorId,
      'positioning:kneeling'
    );
    expect(kneelingData).toBeDefined();
  });

  it('should handle standing without kneeling for legacy entity', async () => {
    // Setup: Create standing legacy entity
    const actorId = 'standing-actor';
    await createLegacyActor(actorId);

    // Execute: Stand up without kneeling first
    await expect(
      actionExecutor.execute('positioning:stand_up', {
        actorId: actorId,
      })
    ).resolves.not.toThrow();

    // Assert: Movement remains unlocked
    const movement = await entityManager.getComponentData(
      actorId,
      'core:movement'
    );
    expect(movement.locked).toBe(false);
  });

  it('should preserve existing movement component data', async () => {
    // Setup: Legacy entity with custom movement data
    const actorId = 'custom-movement-actor';
    const targetId = 'target-001';

    await entityManager.createEntity(actorId);
    await entityManager.addComponent(actorId, 'core:movement', {
      locked: false,
      forcedOverride: false,
      customField: 'preserve-me',
      speed: 5,
    });

    await entityManager.createEntity(targetId);

    // Execute: Kneel
    await actionExecutor.execute('positioning:kneel_before', {
      actorId: actorId,
      targetId: targetId,
    });

    // Assert: Custom fields preserved, only locked changed
    const movement = await entityManager.getComponentData(
      actorId,
      'core:movement'
    );
    expect(movement.locked).toBe(true);
    expect(movement.customField).toBe('preserve-me');
    expect(movement.speed).toBe(5);
  });
});
```

#### 3.5 Helper Functions

```javascript
// Helper to create a legacy actor with movement
async function createLegacyActor(actorId) {
  await entityManager.createEntity(actorId);
  await entityManager.addComponent(actorId, 'core:movement', {
    locked: false,
    forcedOverride: false,
  });
  return actorId;
}

// Helper to create a kneeling legacy actor
async function createKneelingLegacyActor() {
  const actorId = 'legacy-actor-' + Date.now();
  const targetId = 'target-' + Date.now();

  await createLegacyActor(actorId);
  await entityManager.createEntity(targetId);

  await actionExecutor.execute('positioning:kneel_before', {
    actorId: actorId,
    targetId: targetId,
  });

  return actorId;
}

// Helper to create simple anatomy actor for comparison tests
async function createSimpleAnatomyActor(actorId) {
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
  });

  await entityManager.createEntity(rightLegId);
  await entityManager.addComponent(rightLegId, 'core:movement', {
    locked: false,
  });

  return actorId;
}
```

### 4. Implementation Checklist

- [ ] Create test file `movementLockLegacyEntities.test.js`
- [ ] Import required dependencies
- [ ] Setup test bed with positioning mod
- [ ] Test kneel locks movement for legacy entity
- [ ] Test movement blocked while kneeling
- [ ] Test stand unlocks movement
- [ ] Test movement allowed after standing
- [ ] Test multiple legacy entities
- [ ] Test mixed legacy and anatomy entities
- [ ] Test entity without movement component
- [ ] Test standing without kneeling
- [ ] Test custom field preservation
- [ ] Create helper functions
- [ ] Run tests and verify all pass

## Validation Criteria

1. **All tests pass**: Complete green test suite
2. **Backward compatibility**: Legacy entities work without modification
3. **Data preservation**: Existing component fields not lost
4. **Graceful handling**: No errors for edge cases
5. **Independent states**: Multiple entities maintain separate lock states

## Testing Requirements

```bash
# Run integration tests for legacy entities
npm run test:integration tests/integration/positioning/movementLockLegacyEntities.test.js

# Run all movement lock integration tests
npm run test:integration tests/integration/positioning/movementLock*.test.js

# Run with coverage
npm run test:integration -- --coverage
```

## Notes

- Legacy entities are the simpler case - movement component directly on actor
- Must ensure backward compatibility with existing game content
- The updateMovementLock utility should detect legacy vs anatomy automatically
- Test both success paths and edge cases for robustness

## References

- Spec section 2.1: Architecture Context (legacy entities)
- Similar tests: `tests/integration/closenessCircle/`
- MOVLOCK-009: Anatomy entity tests for comparison
- Test utilities: `tests/common/testbedFactory.js`
