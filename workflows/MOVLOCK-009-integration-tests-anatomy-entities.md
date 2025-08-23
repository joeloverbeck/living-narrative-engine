# MOVLOCK-009: Integration Tests for Anatomy-Based Entities

**Status**: NOT_STARTED  
**Priority**: MEDIUM  
**Dependencies**: MOVLOCK-001 through MOVLOCK-006  
**Estimated Effort**: 2 hours

## Context

Integration tests are needed to verify that movement locking works correctly with anatomy-based entities where movement components are attached to individual leg body parts. These tests ensure the complete flow from action execution through rule processing to movement component updates.

## Implementation Steps

### 1. Create Test Directory and File

**Directory**: `tests/integration/positioning/` (needs to be created)
**File**: `tests/integration/positioning/movementLockAnatomyEntities.test.js`

### 2. Test Structure Template

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedFactory } from '../../common/testbedFactory.js';
import {
  createAnatomyEntity,
  createLegEntity,
} from '../../common/anatomyTestHelpers.js';
import { executeAction } from '../../common/actionTestHelpers.js';

describe('Movement Lock - Anatomy-Based Entities', () => {
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

#### 3.1 Basic Movement Lock on Kneel

```javascript
describe('kneeling locks movement', () => {
  it('should lock all leg movement components when anatomy entity kneels', async () => {
    // Setup: Create anatomy-based actor with legs
    const actorId = 'test-actor-001';
    const targetId = 'test-target-001';

    // Create main actor entity
    await entityManager.createEntity(actorId);

    // Create anatomy structure
    const leftLegId = `${actorId}-left-leg`;
    const rightLegId = `${actorId}-right-leg`;

    await entityManager.addComponent(actorId, 'anatomy:body', {
      recipe: 'humanoid',
      parts: {
        left_leg: leftLegId,
        right_leg: rightLegId,
      },
    });

    // Create leg entities with movement components
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

    // Create target entity
    await entityManager.createEntity(targetId);

    // Execute: Kneel before action
    await actionExecutor.execute('positioning:kneel_before', {
      actorId: actorId,
      targetId: targetId,
    });

    // Assert: Both leg movement components are locked
    const leftLegMovement = await entityManager.getComponentData(
      leftLegId,
      'core:movement'
    );
    const rightLegMovement = await entityManager.getComponentData(
      rightLegId,
      'core:movement'
    );

    expect(leftLegMovement.locked).toBe(true);
    expect(rightLegMovement.locked).toBe(true);

    // Assert: Kneeling component was added
    const kneelingComponent = await entityManager.getComponentData(
      actorId,
      'positioning:kneeling'
    );
    expect(kneelingComponent).toBeDefined();
    expect(kneelingComponent.target_id).toBe(targetId);
  });

  it('should prevent movement actions while kneeling', async () => {
    // Setup: Create kneeling anatomy entity
    const actorId = await createKneelingAnatomyActor();
    const destinationId = 'test-location-001';

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

#### 3.2 Movement Unlock on Stand

```javascript
describe('standing unlocks movement', () => {
  it('should unlock all leg movement components when anatomy entity stands', async () => {
    // Setup: Create kneeling anatomy entity
    const actorId = await createKneelingAnatomyActor();
    const leftLegId = `${actorId}-left-leg`;
    const rightLegId = `${actorId}-right-leg`;

    // Verify locked state
    let leftLegMovement = await entityManager.getComponentData(
      leftLegId,
      'core:movement'
    );
    let rightLegMovement = await entityManager.getComponentData(
      rightLegId,
      'core:movement'
    );
    expect(leftLegMovement.locked).toBe(true);
    expect(rightLegMovement.locked).toBe(true);

    // Execute: Stand up action
    await actionExecutor.execute('positioning:stand_up', {
      actorId: actorId,
    });

    // Assert: Both leg movement components are unlocked
    leftLegMovement = await entityManager.getComponentData(
      leftLegId,
      'core:movement'
    );
    rightLegMovement = await entityManager.getComponentData(
      rightLegId,
      'core:movement'
    );

    expect(leftLegMovement.locked).toBe(false);
    expect(rightLegMovement.locked).toBe(false);

    // Assert: Kneeling component was removed
    const kneelingComponent = await entityManager.getComponentData(
      actorId,
      'positioning:kneeling'
    );
    expect(kneelingComponent).toBeUndefined();
  });

  it('should allow movement after standing up', async () => {
    // Setup: Create kneeling anatomy entity then stand
    const actorId = await createKneelingAnatomyActor();
    await actionExecutor.execute('positioning:stand_up', {
      actorId: actorId,
    });

    // Attempt: Try to move after standing
    const destinationId = 'test-location-001';
    const moveResult = await actionExecutor.execute('core:go', {
      actorId: actorId,
      destinationId: destinationId,
    });

    // Assert: Movement should be allowed
    expect(moveResult.success).toBe(true);
  });
});
```

#### 3.3 Complex Anatomy Scenarios

```javascript
describe('complex anatomy scenarios', () => {
  it('should handle entities with multiple leg pairs', async () => {
    // Setup: Create entity with 4 legs (e.g., centaur)
    const actorId = 'centaur-001';
    const legIds = [
      'front-left-leg',
      'front-right-leg',
      'rear-left-leg',
      'rear-right-leg',
    ];

    await createMultiLegEntity(actorId, legIds);

    // Execute: Kneel action
    await actionExecutor.execute('positioning:kneel_before', {
      actorId: actorId,
      targetId: 'target-001',
    });

    // Assert: All leg movement components are locked
    for (const legId of legIds) {
      const movement = await entityManager.getComponentData(
        legId,
        'core:movement'
      );
      expect(movement.locked).toBe(true);
    }
  });

  it('should handle asymmetric anatomy (single leg)', async () => {
    // Setup: Create entity with only one leg
    const actorId = 'one-legged-001';
    const legId = `${actorId}-leg`;

    await entityManager.createEntity(actorId);
    await entityManager.addComponent(actorId, 'anatomy:body', {
      recipe: 'custom',
      parts: {
        leg: legId,
      },
    });

    await entityManager.createEntity(legId);
    await entityManager.addComponent(legId, 'core:movement', {
      locked: false,
    });

    // Execute: Kneel action
    await actionExecutor.execute('positioning:kneel_before', {
      actorId: actorId,
      targetId: 'target-001',
    });

    // Assert: Single leg is locked
    const movement = await entityManager.getComponentData(
      legId,
      'core:movement'
    );
    expect(movement.locked).toBe(true);
  });

  it('should handle entities with non-standard leg names', async () => {
    // Setup: Create entity with custom leg naming
    const actorId = 'alien-001';
    const tentacle1 = `${actorId}-locomotor-1`;
    const tentacle2 = `${actorId}-locomotor-2`;

    await entityManager.createEntity(actorId);
    await entityManager.addComponent(actorId, 'anatomy:body', {
      recipe: 'alien',
      parts: {
        locomotor_1: tentacle1,
        locomotor_2: tentacle2,
      },
    });

    // Create locomotor entities with movement
    await createLegEntity(tentacle1);
    await createLegEntity(tentacle2);

    // Execute: Kneel action
    await actionExecutor.execute('positioning:kneel_before', {
      actorId: actorId,
      targetId: 'target-001',
    });

    // Assert: All locomotors are locked
    const movement1 = await entityManager.getComponentData(
      tentacle1,
      'core:movement'
    );
    const movement2 = await entityManager.getComponentData(
      tentacle2,
      'core:movement'
    );
    expect(movement1.locked).toBe(true);
    expect(movement2.locked).toBe(true);
  });
});
```

#### 3.4 Helper Functions

```javascript
// Helper function to create a kneeling anatomy actor
async function createKneelingAnatomyActor() {
  const actorId = 'test-actor-' + Date.now();
  const targetId = 'test-target-' + Date.now();

  // Create actor with anatomy
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

  // Create legs
  await createLegEntity(leftLegId);
  await createLegEntity(rightLegId);

  // Create target
  await entityManager.createEntity(targetId);

  // Make actor kneel
  await actionExecutor.execute('positioning:kneel_before', {
    actorId: actorId,
    targetId: targetId,
  });

  return actorId;
}

// Helper to create a leg entity with movement
async function createLegEntity(legId) {
  await entityManager.createEntity(legId);
  await entityManager.addComponent(legId, 'core:movement', {
    locked: false,
    forcedOverride: false,
  });
  await entityManager.addComponent(legId, 'anatomy:body_part', {
    type: 'leg',
    side: legId.includes('left') ? 'left' : 'right',
  });
}
```

### 4. Implementation Checklist

- [ ] Create directory `tests/integration/positioning/`
- [ ] Create test file `movementLockAnatomyEntities.test.js`
- [ ] Import required test utilities and helpers
- [ ] Setup test bed with positioning mod loaded
- [ ] Test basic kneel locks movement
- [ ] Test movement is prevented while kneeling
- [ ] Test stand unlocks movement
- [ ] Test movement allowed after standing
- [ ] Test multiple leg pairs (4+ legs)
- [ ] Test single leg entity
- [ ] Test non-standard leg naming
- [ ] Create helper functions for common setup
- [ ] Run tests and verify all pass

## Validation Criteria

1. **All tests pass**: Green test suite
2. **Anatomy handling**: Correctly identifies and locks all leg entities
3. **Action integration**: Actions trigger proper rule execution
4. **Movement blocking**: Movement actions fail when locked
5. **State consistency**: Component states match expected values

## Testing Requirements

```bash
# Run integration tests for anatomy entities
npm run test:integration tests/integration/positioning/movementLockAnatomyEntities.test.js

# Run all positioning integration tests
npm run test:integration tests/integration/positioning/

# Run with coverage
npm run test:integration -- --coverage
```

## Notes

- These tests verify the complete integration from action to component update
- The tests should use actual rule processing, not mocked operations
- Helper functions reduce duplication and improve readability
- Consider testing with various anatomy configurations from actual game data
- The updateMovementLock utility should handle the complexity transparently

## References

- Spec anatomy details: Section 2.3 of movement lock spec
- Similar integration tests: `tests/integration/closenessCircle/`
- Test helpers: `tests/common/testbedFactory.js`
- Anatomy test utilities: May need to create if not existing
