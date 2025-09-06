# PROXBASCLOS-010: Create Integration Tests for Sitting Proximity Workflows

**Phase**: Testing Layer  
**Priority**: High  
**Complexity**: High  
**Dependencies**: PROXBASCLOS-005, PROXBASCLOS-006, PROXBASCLOS-007  
**Estimated Time**: 8-10 hours

## Summary

Create comprehensive integration tests that validate the complete sitting proximity workflows from user actions through rule execution to final component states. These tests ensure the entire system works correctly across all integration points.

## Technical Requirements

### Files to Create

#### 1. `tests/integration/mods/positioning/sittingProximityWorkflow.integration.test.js`
- Complete workflow validation from sit down to closeness establishment
- Multi-actor scenarios with complex adjacency patterns
- Integration with existing closeness and movement systems
- Error handling and edge case scenarios

#### 2. `tests/integration/mods/positioning/furnitureCapacityAndProximity.integration.test.js`  
- Edge cases with furniture capacity limits
- Single-spot furniture scenarios
- Dynamic furniture configurations
- Performance testing with maximum capacity

#### 3. `tests/integration/mods/positioning/mixedClosenessScenarios.integration.test.js`
- Mixed automatic and manual closeness relationships
- Complex standing/sitting sequences
- Closeness circle preservation and merging
- Cross-furniture relationship management

### Integration Test Architecture

#### Test Environment Setup
- **Real Components**: Use actual game engine components and systems
- **Mocked External**: Mock external dependencies like AI services, file I/O
- **Event-Driven**: Test complete event flows from action to final state
- **State Validation**: Verify component states and relationship consistency

#### Key Integration Points
- **Action → Rule → Handler**: Complete action execution pipeline
- **Component Management**: EntityManager component CRUD operations
- **Event System**: Event bus dispatching and handling
- **Service Integration**: ClosenessCircleService and movement utilities
- **Movement Locks**: Movement lock coordination across systems

## SittingProximityWorkflow Integration Tests

### Test Structure and Setup

#### Test Environment Configuration
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createIntegrationTestEnvironment } from '../../../common/integrationTestEnvironment.js';
import { createTestMod } from '../../../common/testModFactory.js';

describe('Sitting Proximity Workflow Integration', () => {
  let testEnv;
  let gameEngine;
  let entityManager;
  let eventBus;
  let actionExecutor;

  beforeEach(async () => {
    testEnv = await createIntegrationTestEnvironment();
    gameEngine = testEnv.gameEngine;
    entityManager = testEnv.entityManager;
    eventBus = testEnv.eventBus;
    actionExecutor = testEnv.actionExecutor;

    // Load positioning mod with proximity closeness features
    await testEnv.loadMod(createTestMod({
      id: 'proximity_test',
      components: ['allows_sitting', 'sitting_on', 'closeness'],
      actions: ['sit_down', 'get_up_from_furniture'],
      rules: ['handle_sit_down', 'handle_get_up_from_furniture']
    }));
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });
});
```

### Basic Proximity Establishment Tests

#### Alice-Bob Adjacent Scenario
```javascript
describe('Basic Proximity Establishment', () => {
  it('should establish closeness when Bob sits adjacent to Alice', async () => {
    // Phase 1: Setup furniture and initial actor
    const furnitureId = await testEnv.createEntity('furniture:test_couch', {
      'positioning:allows_sitting': {
        spots: [null, null, null, null, null]
      }
    });

    const aliceId = await testEnv.createEntity('game:alice', {});
    const bobId = await testEnv.createEntity('game:bob', {});

    // Phase 2: Alice sits down (should claim spot 0)
    await actionExecutor.executeAction({
      type: 'sit_down',
      actorId: aliceId,
      targetId: furnitureId
    });

    // Verify Alice's sitting state
    const aliceSitting = entityManager.getComponent(aliceId, 'positioning:sitting_on');
    expect(aliceSitting).toEqual({
      furniture_id: furnitureId,
      spot_index: 0
    });

    // Verify furniture state
    const furnitureComponent = entityManager.getComponent(furnitureId, 'positioning:allows_sitting');
    expect(furnitureComponent.spots[0]).toBe(aliceId);

    // Alice should have no closeness yet
    const aliceCloseness = entityManager.getComponent(aliceId, 'positioning:closeness');
    expect(aliceCloseness).toBeNull();

    // Phase 3: Bob sits down (should claim spot 1, adjacent to Alice)
    await actionExecutor.executeAction({
      type: 'sit_down',
      actorId: bobId,
      targetId: furnitureId
    });

    // Verify Bob's sitting state
    const bobSitting = entityManager.getComponent(bobId, 'positioning:sitting_on');
    expect(bobSitting).toEqual({
      furniture_id: furnitureId,
      spot_index: 1
    });

    // Phase 4: Verify automatic closeness establishment
    const aliceClosenessAfter = entityManager.getComponent(aliceId, 'positioning:closeness');
    const bobClosenessAfter = entityManager.getComponent(bobId, 'positioning:closeness');

    expect(aliceClosenessAfter).toEqual({
      partners: [bobId]
    });

    expect(bobClosenessAfter).toEqual({
      partners: [aliceId]
    });

    // Phase 5: Verify movement locks
    const aliceMovement = entityManager.getComponent(aliceId, 'positioning:movement_locked');
    const bobMovement = entityManager.getComponent(bobId, 'positioning:movement_locked');

    expect(aliceMovement).toBeTruthy();
    expect(bobMovement).toBeTruthy();
  });
});
```

#### Middle Position Bridging Scenario
```javascript
describe('Middle Position Bridging', () => {
  it('should create bridging relationships when actor sits between two others', async () => {
    // Setup furniture and actors
    const furnitureId = await testEnv.createEntity('furniture:bench', {
      'positioning:allows_sitting': {
        spots: [null, null, null]
      }
    });

    const aliciaId = await testEnv.createEntity('game:alicia', {});
    const bobId = await testEnv.createEntity('game:bob', {});
    const zeldaId = await testEnv.createEntity('game:zelda', {});

    // Phase 1: Alicia and Zelda sit on opposite ends
    await actionExecutor.executeAction({
      type: 'sit_down',
      actorId: aliciaId,
      targetId: furnitureId
    });

    await actionExecutor.executeAction({
      type: 'sit_down', 
      actorId: zeldaId,
      targetId: furnitureId
    });

    // Verify they are in spots 0 and 1 (not adjacent)
    const aliciaSitting = entityManager.getComponent(aliciaId, 'positioning:sitting_on');
    const zeldaSitting = entityManager.getComponent(zeldaId, 'positioning:sitting_on');

    expect(aliciaSitting.spot_index).toBe(0);
    expect(zeldaSitting.spot_index).toBe(1);

    // Verify no closeness between Alicia and Zelda (not adjacent)
    expect(entityManager.getComponent(aliciaId, 'positioning:closeness')).toBeNull();
    expect(entityManager.getComponent(zeldaId, 'positioning:closeness')).toBeNull();

    // Phase 2: Bob sits in middle (spot 1 - but Zelda is there, so spot 2 if available)
    // Actually, let's set up correctly: spots should be [Alicia, null, Zelda]
    
    // Reset furniture state for correct scenario
    entityManager.upsertComponent(furnitureId, 'positioning:allows_sitting', {
      spots: [aliciaId, null, zeldaId]
    });
    
    // Update sitting components to match
    entityManager.upsertComponent(aliciaId, 'positioning:sitting_on', {
      furniture_id: furnitureId,
      spot_index: 0
    });
    
    entityManager.upsertComponent(zeldaId, 'positioning:sitting_on', {
      furniture_id: furnitureId,
      spot_index: 2
    });

    // Bob sits in middle spot (spot 1)
    await actionExecutor.executeAction({
      type: 'sit_down',
      actorId: bobId,
      targetId: furnitureId
    });

    // Phase 3: Verify Bob is close to both, but Alicia and Zelda are NOT close to each other
    const aliciaCloseness = entityManager.getComponent(aliciaId, 'positioning:closeness');
    const bobCloseness = entityManager.getComponent(bobId, 'positioning:closeness');
    const zeldaCloseness = entityManager.getComponent(zeldaId, 'positioning:closeness');

    // Bob should be close to both Alicia and Zelda
    expect(bobCloseness.partners).toContain(aliciaId);
    expect(bobCloseness.partners).toContain(zeldaId);

    // Alicia should be close to Bob only
    expect(aliciaCloseness.partners).toEqual([bobId]);

    // Zelda should be close to Bob only  
    expect(zeldaCloseness.partners).toEqual([bobId]);
  });
});
```

### Standing Up and Closeness Removal Tests

#### Basic Closeness Removal
```javascript
describe('Standing Up and Closeness Removal', () => {
  it('should remove closeness when Alice stands up from adjacent position', async () => {
    // Setup: Alice and Bob sitting adjacent with established closeness
    const furnitureId = await testEnv.createEntity('furniture:couch', {
      'positioning:allows_sitting': {
        spots: ['game:alice', 'game:bob', null]
      }
    });

    const aliceId = 'game:alice';
    const bobId = 'game:bob';

    await testEnv.createEntity(aliceId, {
      'positioning:sitting_on': {
        furniture_id: furnitureId,
        spot_index: 0
      },
      'positioning:closeness': {
        partners: [bobId]
      }
    });

    await testEnv.createEntity(bobId, {
      'positioning:sitting_on': {
        furniture_id: furnitureId,
        spot_index: 1
      },
      'positioning:closeness': {
        partners: [aliceId]
      }
    });

    // Action: Alice stands up
    await actionExecutor.executeAction({
      type: 'get_up_from_furniture',
      actorId: aliceId
    });

    // Verify Alice no longer sitting
    const aliceSitting = entityManager.getComponent(aliceId, 'positioning:sitting_on');
    expect(aliceSitting).toBeNull();

    // Verify furniture spot cleared
    const furnitureComponent = entityManager.getComponent(furnitureId, 'positioning:allows_sitting');
    expect(furnitureComponent.spots[0]).toBeNull();

    // Verify closeness removed from both actors
    const aliceCloseness = entityManager.getComponent(aliceId, 'positioning:closeness');
    const bobCloseness = entityManager.getComponent(bobId, 'positioning:closeness');

    expect(aliceCloseness).toBeNull();
    expect(bobCloseness).toBeNull();

    // Verify movement unlocked
    const aliceMovement = entityManager.getComponent(aliceId, 'positioning:movement_locked');
    const bobMovement = entityManager.getComponent(bobId, 'positioning:movement_locked');

    expect(aliceMovement).toBeNull();
    expect(bobMovement).toBeNull();
  });
});
```

### Complex Multi-Actor Scenarios

#### Chain Standing Scenario
```javascript
describe('Complex Multi-Actor Scenarios', () => {
  it('should handle complex standing sequence with multiple relationships', async () => {
    // Setup: Alice-Bob-Charlie-Diana all sitting in a row
    const furnitureId = await testEnv.createEntity('furniture:long_bench', {
      'positioning:allows_sitting': {
        spots: ['game:alice', 'game:bob', 'game:charlie', 'game:diana', null]
      }
    });

    const actors = [
      { id: 'game:alice', spot: 0, partners: ['game:bob'] },
      { id: 'game:bob', spot: 1, partners: ['game:alice', 'game:charlie'] },
      { id: 'game:charlie', spot: 2, partners: ['game:bob', 'game:diana'] },
      { id: 'game:diana', spot: 3, partners: ['game:charlie'] }
    ];

    // Create all actors with initial closeness relationships
    for (const actor of actors) {
      await testEnv.createEntity(actor.id, {
        'positioning:sitting_on': {
          furniture_id: furnitureId,
          spot_index: actor.spot
        },
        'positioning:closeness': {
          partners: actor.partners
        }
      });
    }

    // Action: Bob stands up (affects Alice and Charlie)
    await actionExecutor.executeAction({
      type: 'get_up_from_furniture',
      actorId: 'game:bob'
    });

    // Verify Bob is no longer sitting
    expect(entityManager.getComponent('game:bob', 'positioning:sitting_on')).toBeNull();

    // Verify furniture state updated
    const furniture = entityManager.getComponent(furnitureId, 'positioning:allows_sitting');
    expect(furniture.spots[1]).toBeNull();

    // Verify closeness relationships updated
    const aliceCloseness = entityManager.getComponent('game:alice', 'positioning:closeness');
    const bobCloseness = entityManager.getComponent('game:bob', 'positioning:closeness');
    const charlieCloseness = entityManager.getComponent('game:charlie', 'positioning:closeness');
    const dianaCloseness = entityManager.getComponent('game:diana', 'positioning:closeness');

    // Alice should no longer be close to Bob
    expect(aliceCloseness).toBeNull();

    // Bob should have no closeness relationships
    expect(bobCloseness).toBeNull();

    // Charlie should no longer be close to Bob, but still close to Diana
    expect(charlieCloseness.partners).toEqual(['game:diana']);

    // Diana should still be close to Charlie  
    expect(dianaCloseness.partners).toEqual(['game:charlie']);
  });
});
```

## FurnitureCapacityAndProximity Integration Tests

### Edge Cases and Boundary Conditions

#### Single-Spot Furniture
```javascript
describe('Furniture Capacity Edge Cases', () => {
  it('should handle single-spot furniture with no adjacency possible', async () => {
    const furnitureId = await testEnv.createEntity('furniture:chair', {
      'positioning:allows_sitting': {
        spots: [null] // Only one spot
      }
    });

    const aliceId = await testEnv.createEntity('game:alice', {});

    // Alice sits on single-spot furniture
    await actionExecutor.executeAction({
      type: 'sit_down',
      actorId: aliceId,
      targetId: furnitureId
    });

    // Verify Alice is sitting
    const aliceSitting = entityManager.getComponent(aliceId, 'positioning:sitting_on');
    expect(aliceSitting).toEqual({
      furniture_id: furnitureId,
      spot_index: 0
    });

    // Verify no closeness established (no adjacent spots possible)
    const aliceCloseness = entityManager.getComponent(aliceId, 'positioning:closeness');
    expect(aliceCloseness).toBeNull();

    // Verify movement still locked (from sitting, not closeness)
    const aliceMovement = entityManager.getComponent(aliceId, 'positioning:movement_locked');
    expect(aliceMovement).toBeTruthy();
  });

  it('should handle full furniture scenarios gracefully', async () => {
    const furnitureId = await testEnv.createEntity('furniture:small_couch', {
      'positioning:allows_sitting': {
        spots: ['game:alice', 'game:bob'] // Fully occupied
      }
    });

    const aliceId = 'game:alice';
    const bobId = 'game:bob';
    const charlieId = await testEnv.createEntity('game:charlie', {});

    // Create Alice and Bob as already sitting
    await testEnv.createEntity(aliceId, {
      'positioning:sitting_on': { furniture_id: furnitureId, spot_index: 0 },
      'positioning:closeness': { partners: [bobId] }
    });

    await testEnv.createEntity(bobId, {
      'positioning:sitting_on': { furniture_id: furnitureId, spot_index: 1 },
      'positioning:closeness': { partners: [aliceId] }
    });

    // Charlie tries to sit on full furniture
    const result = await actionExecutor.executeAction({
      type: 'sit_down',
      actorId: charlieId,
      targetId: furnitureId
    });

    // Action should fail
    expect(result.success).toBe(false);

    // Verify Charlie is not sitting
    const charlieSitting = entityManager.getComponent(charlieId, 'positioning:sitting_on');
    expect(charlieSitting).toBeNull();

    // Verify existing relationships unchanged
    const aliceCloseness = entityManager.getComponent(aliceId, 'positioning:closeness');
    const bobCloseness = entityManager.getComponent(bobId, 'positioning:closeness');

    expect(aliceCloseness.partners).toEqual([bobId]);
    expect(bobCloseness.partners).toEqual([aliceId]);
  });
});
```

## MixedClosenessScenarios Integration Tests

### Manual and Automatic Closeness Mixing

#### Preserving Manual Relationships
```javascript
describe('Mixed Manual and Automatic Closeness', () => {
  it('should preserve manual closeness when automatic closeness is removed', async () => {
    const furnitureId = await testEnv.createEntity('furniture:couch', {
      'positioning:allows_sitting': {
        spots: [null, null, null]
      }
    });

    const aliceId = await testEnv.createEntity('game:alice', {});
    const bobId = await testEnv.createEntity('game:bob', {});
    const charlieId = await testEnv.createEntity('game:charlie', {});

    // Phase 1: Alice and Charlie establish manual closeness
    await actionExecutor.executeAction({
      type: 'get_close',
      actorId: aliceId,
      targetId: charlieId
    });

    // Verify manual closeness established
    let aliceCloseness = entityManager.getComponent(aliceId, 'positioning:closeness');
    let charlieCloseness = entityManager.getComponent(charlieId, 'positioning:closeness');

    expect(aliceCloseness.partners).toEqual([charlieId]);
    expect(charlieCloseness.partners).toEqual([aliceId]);

    // Phase 2: Alice and Bob sit adjacent (automatic closeness)
    entityManager.upsertComponent(furnitureId, 'positioning:allows_sitting', {
      spots: [aliceId, bobId, null]
    });

    entityManager.upsertComponent(aliceId, 'positioning:sitting_on', {
      furniture_id: furnitureId,
      spot_index: 0
    });

    entityManager.upsertComponent(bobId, 'positioning:sitting_on', {
      furniture_id: furnitureId,
      spot_index: 1
    });

    // Trigger closeness establishment
    await actionExecutor.executeAction({
      type: 'sit_down',
      actorId: bobId,
      targetId: furnitureId
    });

    // Verify Alice now has both manual (Charlie) and automatic (Bob) closeness
    aliceCloseness = entityManager.getComponent(aliceId, 'positioning:closeness');
    expect(aliceCloseness.partners).toContain(charlieId); // Manual
    expect(aliceCloseness.partners).toContain(bobId); // Automatic

    // Phase 3: Alice stands up (should remove automatic but preserve manual)
    await actionExecutor.executeAction({
      type: 'get_up_from_furniture',
      actorId: aliceId
    });

    // Verify Alice retains manual closeness with Charlie but loses automatic with Bob
    aliceCloseness = entityManager.getComponent(aliceId, 'positioning:closeness');
    charlieCloseness = entityManager.getComponent(charlieId, 'positioning:closeness');
    const bobCloseness = entityManager.getComponent(bobId, 'positioning:closeness');

    expect(aliceCloseness.partners).toEqual([charlieId]); // Only manual remains
    expect(charlieCloseness.partners).toEqual([aliceId]); // Manual preserved
    expect(bobCloseness).toBeNull(); // Automatic removed
  });
});
```

## Performance and Stress Testing

### High-Capacity Scenarios
```javascript
describe('Performance and Stress Testing', () => {
  it('should handle maximum capacity furniture efficiently', async () => {
    const furnitureId = await testEnv.createEntity('furniture:huge_bench', {
      'positioning:allows_sitting': {
        spots: new Array(10).fill(null) // Maximum spots
      }
    });

    const actors = [];
    for (let i = 0; i < 10; i++) {
      actors.push(await testEnv.createEntity(`game:actor_${i}`, {}));
    }

    const startTime = performance.now();

    // All actors sit down sequentially
    for (const actorId of actors) {
      await actionExecutor.executeAction({
        type: 'sit_down',
        actorId: actorId,
        targetId: furnitureId
      });
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should complete all sits in reasonable time
    expect(duration).toBeLessThan(1000); // <1 second for 10 actors

    // Verify all closeness relationships established correctly
    for (let i = 0; i < 10; i++) {
      const actorCloseness = entityManager.getComponent(actors[i], 'positioning:closeness');
      
      if (i === 0) {
        // First actor: only adjacent to second
        expect(actorCloseness.partners).toEqual([actors[1]]);
      } else if (i === 9) {
        // Last actor: only adjacent to previous
        expect(actorCloseness.partners).toEqual([actors[8]]);
      } else {
        // Middle actors: adjacent to both neighbors
        expect(actorCloseness.partners).toContain(actors[i - 1]);
        expect(actorCloseness.partners).toContain(actors[i + 1]);
      }
    }
  });
});
```

## Test Utilities and Helpers

### Integration Test Environment Factory
```javascript
// tests/common/integrationTestEnvironment.js
export async function createIntegrationTestEnvironment() {
  const container = createTestContainer();
  const gameEngine = container.resolve('IGameEngine');
  const entityManager = container.resolve('IEntityManager');
  const eventBus = container.resolve('IEventBus');
  const actionExecutor = container.resolve('IActionExecutor');

  return {
    gameEngine,
    entityManager,
    eventBus,
    actionExecutor,
    
    async createEntity(entityId, components = {}) {
      await entityManager.createEntity(entityId);
      
      for (const [componentType, data] of Object.entries(components)) {
        entityManager.upsertComponent(entityId, componentType, data);
      }
      
      return entityId;
    },
    
    async loadMod(modData) {
      await gameEngine.loadMod(modData);
    },
    
    async cleanup() {
      await gameEngine.shutdown();
      container.dispose();
    }
  };
}
```

## Implementation Checklist

### Phase 1: Test Environment Setup
- [ ] Create integration test environment factory
- [ ] Set up test mod creation utilities
- [ ] Implement entity and component creation helpers
- [ ] Configure event bus and action executor integration

### Phase 2: Basic Workflow Tests
- [ ] Implement Alice-Bob adjacency scenario test
- [ ] Implement middle position bridging test  
- [ ] Implement basic standing up and closeness removal test
- [ ] Implement complex multi-actor chain scenarios

### Phase 3: Edge Case and Capacity Tests
- [ ] Implement single-spot furniture tests
- [ ] Implement full furniture scenarios
- [ ] Implement dynamic furniture configuration tests
- [ ] Implement maximum capacity stress tests

### Phase 4: Mixed Closeness Scenarios
- [ ] Implement manual + automatic closeness mixing tests
- [ ] Implement closeness preservation scenarios
- [ ] Implement complex relationship chain tests
- [ ] Implement cross-furniture relationship tests

## Definition of Done
- [ ] All integration test files created with comprehensive scenarios
- [ ] Complete workflow validation from action to final state
- [ ] Edge cases and boundary conditions thoroughly tested
- [ ] Mixed manual/automatic closeness scenarios validated
- [ ] Performance benchmarks meet requirements (<1s for max capacity)
- [ ] Error handling and failure scenarios tested
- [ ] Test environment utilities created and reusable
- [ ] All tests pass consistently in CI/CD environment
- [ ] Integration points validated across all systems
- [ ] Documentation covers test scenarios and expected behavior