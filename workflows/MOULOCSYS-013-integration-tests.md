# MOULOCSYS-013: Create Integration Tests

**Phase**: Testing & Validation  
**Priority**: High  
**Complexity**: High  
**Dependencies**: MOULOCSYS-012 (unit tests), all implementation tickets  
**Estimated Time**: 6-8 hours

## Summary

Create comprehensive integration tests that validate the mouth engagement system working end-to-end with real game scenarios. Test complete workflows from kissing to positioning action availability, ensuring all components integrate correctly in realistic usage patterns.

## Technical Requirements

### Test Files to Create

1. `tests/integration/mods/core/mouthEngagementSystem.integration.test.js`
2. `tests/integration/workflows/kissingPositioningConflict.integration.test.js`
3. `tests/integration/mods/positioning/mouthAvailabilityActions.integration.test.js`
4. `tests/integration/mods/intimacy/kissingMouthLocks.integration.test.js`
5. `tests/integration/system/mouthEngagementOperations.integration.test.js`

### Integration Test Architecture

#### Test Environment Setup
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestGameEngine } from '../../common/testGameEngine.js';
import { createTestActor, createTestScene } from '../../common/testFactories.js';

describe('Mouth Engagement System - Integration', () => {
  let gameEngine;
  let entityManager;
  let actionSystem;
  let operationInterpreter;
  let conditionEvaluator;

  beforeEach(async () => {
    gameEngine = await createTestGameEngine({
      mods: ['core', 'positioning', 'intimacy', 'anatomy']
    });
    
    entityManager = gameEngine.entityManager;
    actionSystem = gameEngine.actionSystem;
    operationInterpreter = gameEngine.operationInterpreter;
    conditionEvaluator = gameEngine.conditionEvaluator;
  });

  afterEach(async () => {
    await gameEngine.cleanup();
  });
});
```

### Integration Test Suites

#### 1. Core System Integration

File: `tests/integration/mods/core/mouthEngagementSystem.integration.test.js`

```javascript
describe('Mouth Engagement System - Core Integration', () => {
  let gameEngine;
  let entityManager;
  let operationInterpreter;
  let conditionEvaluator;

  beforeEach(async () => {
    gameEngine = await createTestGameEngine();
    entityManager = gameEngine.entityManager;
    operationInterpreter = gameEngine.operationInterpreter;
    conditionEvaluator = gameEngine.conditionEvaluator;
  });

  describe('Component and Condition Integration', () => {
    it('should load mouth engagement component correctly', async () => {
      const componentRegistry = gameEngine.componentRegistry;
      
      expect(componentRegistry.hasComponent('core:mouth_engagement')).toBe(true);
      
      const schema = componentRegistry.getSchema('core:mouth_engagement');
      expect(schema.properties.locked).toBeDefined();
      expect(schema.properties.forcedOverride).toBeDefined();
    });

    it('should load actor-mouth-available condition correctly', async () => {
      expect(conditionEvaluator.hasCondition('core:actor-mouth-available')).toBe(true);
    });

    it('should create and use mouth engagement component', async () => {
      const entity = await entityManager.createEntity('test_entity');
      
      await entityManager.addComponent(entity, 'core:mouth_engagement', {
        locked: false,
        forcedOverride: false
      });
      
      const component = entityManager.getComponentData(entity, 'core:mouth_engagement');
      expect(component.locked).toBe(false);
      expect(component.forcedOverride).toBe(false);
    });

    it('should evaluate mouth availability condition', async () => {
      const actor = await createTestActor(entityManager, { 
        hasMouth: true,
        mouthLocked: false 
      });
      
      const result = await conditionEvaluator.evaluate(
        'core:actor-mouth-available',
        { actor: actor.id }
      );
      
      expect(result).toBe(true);
    });
  });

  describe('Operation Integration', () => {
    it('should execute LOCK_MOUTH_ENGAGEMENT through interpreter', async () => {
      const actor = await createTestActor(entityManager, { hasMouth: true });
      
      await operationInterpreter.execute({
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actor.id }
      });
      
      const mouthLocked = isMouthLocked(entityManager, actor.id);
      expect(mouthLocked).toBe(true);
    });

    it('should execute UNLOCK_MOUTH_ENGAGEMENT through interpreter', async () => {
      const actor = await createTestActor(entityManager, { 
        hasMouth: true,
        mouthLocked: true 
      });
      
      await operationInterpreter.execute({
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actor.id }
      });
      
      const mouthLocked = isMouthLocked(entityManager, actor.id);
      expect(mouthLocked).toBe(false);
    });

    it('should handle operation failures gracefully', async () => {
      // Test with non-existent entity
      await expect(
        operationInterpreter.execute({
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: 'non_existent' }
        })
      ).not.toThrow();
      
      // Should log error but not crash
    });
  });
});
```

#### 2. Kissing-Positioning Conflict Integration

File: `tests/integration/workflows/kissingPositioningConflict.integration.test.js`

```javascript
describe('Kissing-Positioning Conflict - Integration', () => {
  let gameEngine;
  let actionSystem;
  let entityManager;

  beforeEach(async () => {
    gameEngine = await createTestGameEngine({
      mods: ['core', 'positioning', 'intimacy', 'anatomy']
    });
    actionSystem = gameEngine.actionSystem;
    entityManager = gameEngine.entityManager;
  });

  describe('Complete Kissing Workflow', () => {
    it('should prevent positioning actions during entire kiss lifecycle', async () => {
      const actor1 = await createTestActor(entityManager, { 
        name: 'Alice',
        hasMouth: true 
      });
      const actor2 = await createTestActor(entityManager, { 
        name: 'Bob',
        hasMouth: true 
      });
      
      // Place in same location for kissing
      await placeActorsInSameLocation(entityManager, actor1, actor2);

      // 1. Initially both can perform positioning actions
      let availableActions1 = await actionSystem.getAvailableActions(actor1.id);
      let availableActions2 = await actionSystem.getAvailableActions(actor2.id);
      
      const positioningActions = [
        'positioning:kneel_before',
        'positioning:turn_your_back',
        'positioning:step_back',
        'positioning:place_yourself_behind'
      ];
      
      for (const actionId of positioningActions) {
        expect(availableActions1.map(a => a.id)).toContain(actionId);
        expect(availableActions2.map(a => a.id)).toContain(actionId);
      }

      // 2. Start kissing
      await actionSystem.performAction(
        actor1.id,
        'intimacy:lean_in_for_deep_kiss',
        { target_id: actor2.id }
      );

      // 3. Verify kiss established
      const kissing1 = entityManager.getComponentData(actor1.id, 'intimacy:kissing');
      const kissing2 = entityManager.getComponentData(actor2.id, 'intimacy:kissing');
      expect(kissing1.partner).toBe(actor2.id);
      expect(kissing2.partner).toBe(actor1.id);

      // 4. Verify mouths locked
      expect(isMouthLocked(entityManager, actor1.id)).toBe(true);
      expect(isMouthLocked(entityManager, actor2.id)).toBe(true);

      // 5. Verify positioning actions unavailable
      availableActions1 = await actionSystem.getAvailableActions(actor1.id);
      availableActions2 = await actionSystem.getAvailableActions(actor2.id);
      
      for (const actionId of positioningActions) {
        expect(availableActions1.map(a => a.id)).not.toContain(actionId);
        expect(availableActions2.map(a => a.id)).not.toContain(actionId);
      }

      // 6. Try to perform positioning action (should fail with clear message)
      const kneelResult = await actionSystem.canPerformAction(
        actor1.id,
        'positioning:kneel_before',
        { target_id: actor2.id }
      );
      expect(kneelResult.allowed).toBe(false);
      expect(kneelResult.reason).toContain('mouth is engaged');

      // 7. End kiss
      await actionSystem.performAction(
        actor1.id,
        'intimacy:break_kiss_gently',
        { target_id: actor2.id }
      );

      // 8. Verify kiss ended
      expect(entityManager.getComponentData(actor1.id, 'intimacy:kissing')).toBeNull();
      expect(entityManager.getComponentData(actor2.id, 'intimacy:kissing')).toBeNull();

      // 9. Verify mouths unlocked
      expect(isMouthLocked(entityManager, actor1.id)).toBe(false);
      expect(isMouthLocked(entityManager, actor2.id)).toBe(false);

      // 10. Verify positioning actions available again
      availableActions1 = await actionSystem.getAvailableActions(actor1.id);
      availableActions2 = await actionSystem.getAvailableActions(actor2.id);
      
      for (const actionId of positioningActions) {
        expect(availableActions1.map(a => a.id)).toContain(actionId);
        expect(availableActions2.map(a => a.id)).toContain(actionId);
      }
    });

    it('should handle all kiss ending variations correctly', async () => {
      const kissEndActions = [
        'intimacy:break_kiss_gently',
        'intimacy:pull_back_breathlessly', 
        'intimacy:pull_back_in_revulsion'
      ];

      for (const endAction of kissEndActions) {
        const actor1 = await createTestActor(entityManager, { hasMouth: true });
        const actor2 = await createTestActor(entityManager, { hasMouth: true });
        
        await placeActorsInSameLocation(entityManager, actor1, actor2);
        
        // Start kiss
        await actionSystem.performAction(
          actor1.id,
          'intimacy:lean_in_for_deep_kiss',
          { target_id: actor2.id }
        );
        
        // Verify locked
        expect(isMouthLocked(entityManager, actor1.id)).toBe(true);
        expect(isMouthLocked(entityManager, actor2.id)).toBe(true);
        
        // End kiss with specific action
        await actionSystem.performAction(
          actor1.id,
          endAction,
          { target_id: actor2.id }
        );
        
        // Verify unlocked
        expect(isMouthLocked(entityManager, actor1.id)).toBe(false);
        expect(isMouthLocked(entityManager, actor2.id)).toBe(false);
      }
    });
  });

  describe('Multi-Actor Scenarios', () => {
    it('should handle kisses with bystanders', async () => {
      const alice = await createTestActor(entityManager, { hasMouth: true });
      const bob = await createTestActor(entityManager, { hasMouth: true });
      const charlie = await createTestActor(entityManager, { hasMouth: true });
      
      await placeActorsInSameLocation(entityManager, alice, bob, charlie);
      
      // Alice and Bob kiss
      await actionSystem.performAction(
        alice.id,
        'intimacy:lean_in_for_deep_kiss',
        { target_id: bob.id }
      );
      
      // Alice and Bob should have locked mouths
      expect(isMouthLocked(entityManager, alice.id)).toBe(true);
      expect(isMouthLocked(entityManager, bob.id)).toBe(true);
      
      // Charlie should have unlocked mouth
      expect(isMouthLocked(entityManager, charlie.id)).toBe(false);
      
      // Charlie should be able to perform positioning actions
      const charlieActions = await actionSystem.getAvailableActions(charlie.id);
      expect(charlieActions.map(a => a.id)).toContain('positioning:kneel_before');
    });
  });
});
```

#### 3. Positioning Actions Integration

File: `tests/integration/mods/positioning/mouthAvailabilityActions.integration.test.js`

```javascript
describe('Positioning Actions - Mouth Availability Integration', () => {
  let gameEngine;
  let actionSystem;
  let entityManager;

  beforeEach(async () => {
    gameEngine = await createTestGameEngine({
      mods: ['core', 'positioning', 'anatomy']
    });
    actionSystem = gameEngine.actionSystem;
    entityManager = gameEngine.entityManager;
  });

  describe('Action Availability Based on Mouth State', () => {
    const positioningActions = [
      'positioning:kneel_before',
      'positioning:place_yourself_behind',
      'positioning:turn_your_back',
      'positioning:step_back',
      'positioning:turn_around'
    ];

    it('should allow all positioning actions when mouth is available', async () => {
      const actor = await createTestActor(entityManager, { 
        hasMouth: true,
        mouthLocked: false,
        canMove: true 
      });
      const target = await createTestActor(entityManager);
      
      for (const actionId of positioningActions) {
        const canPerform = await actionSystem.canPerformAction(
          actor.id,
          actionId,
          target ? { target_id: target.id } : {}
        );
        
        expect(canPerform.allowed).toBe(true);
      }
    });

    it('should prevent all positioning actions when mouth is engaged', async () => {
      const actor = await createTestActor(entityManager, { 
        hasMouth: true,
        mouthLocked: true,
        canMove: true 
      });
      const target = await createTestActor(entityManager);
      
      for (const actionId of positioningActions) {
        const canPerform = await actionSystem.canPerformAction(
          actor.id,
          actionId,
          target ? { target_id: target.id } : {}
        );
        
        expect(canPerform.allowed).toBe(false);
        expect(canPerform.reason).toContain('mouth is engaged');
      }
    });

    it('should allow positioning actions for mouthless entities', async () => {
      const actor = await createTestActor(entityManager, { 
        hasMouth: false,
        canMove: true 
      });
      const target = await createTestActor(entityManager);
      
      for (const actionId of positioningActions) {
        const canPerform = await actionSystem.canPerformAction(
          actor.id,
          actionId,
          target ? { target_id: target.id } : {}
        );
        
        expect(canPerform.allowed).toBe(true);
      }
    });
  });

  describe('Turn Around Architectural Fix', () => {
    it('should not reference intimacy components', async () => {
      const actionDef = await actionSystem.getActionDefinition(
        'positioning:turn_around'
      );
      
      const actionJson = JSON.stringify(actionDef);
      expect(actionJson).not.toContain('intimacy:');
      expect(actionDef.forbidden_components).toBeUndefined();
    });

    it('should use mouth availability prerequisite instead', async () => {
      const actionDef = await actionSystem.getActionDefinition(
        'positioning:turn_around'
      );
      
      const prerequisiteChecks = JSON.stringify(actionDef.prerequisites || []);
      expect(prerequisiteChecks).toContain('core:actor-mouth-available');
    });
  });
});
```

#### 4. System-Wide Operation Integration

File: `tests/integration/system/mouthEngagementOperations.integration.test.js`

```javascript
describe('Mouth Engagement Operations - System Integration', () => {
  let gameEngine;
  let operationInterpreter;
  let entityManager;
  let eventBus;

  beforeEach(async () => {
    gameEngine = await createTestGameEngine();
    operationInterpreter = gameEngine.operationInterpreter;
    entityManager = gameEngine.entityManager;
    eventBus = gameEngine.eventBus;
  });

  describe('Event System Integration', () => {
    it('should dispatch mouth lock events', async () => {
      const actor = await createTestActor(entityManager, { hasMouth: true });
      const eventsSeen = [];
      
      eventBus.subscribe('MOUTH_ENGAGEMENT_LOCKED', (event) => {
        eventsSeen.push(event);
      });
      
      await operationInterpreter.execute({
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actor.id }
      });
      
      expect(eventsSeen).toHaveLength(1);
      expect(eventsSeen[0].payload.actorId).toBe(actor.id);
    });

    it('should dispatch mouth unlock events', async () => {
      const actor = await createTestActor(entityManager, { 
        hasMouth: true,
        mouthLocked: true 
      });
      const eventsSeen = [];
      
      eventBus.subscribe('MOUTH_ENGAGEMENT_UNLOCKED', (event) => {
        eventsSeen.push(event);
      });
      
      await operationInterpreter.execute({
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actor.id }
      });
      
      expect(eventsSeen).toHaveLength(1);
      expect(eventsSeen[0].payload.actorId).toBe(actor.id);
    });
  });

  describe('Performance Integration', () => {
    it('should handle bulk operations efficiently', async () => {
      const actors = [];
      for (let i = 0; i < 10; i++) {
        actors.push(await createTestActor(entityManager, { hasMouth: true }));
      }
      
      const startTime = performance.now();
      
      // Lock all mouths
      for (const actor of actors) {
        await operationInterpreter.execute({
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id }
        });
      }
      
      // Unlock all mouths
      for (const actor of actors) {
        await operationInterpreter.execute({
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id }
        });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete 20 operations (10 locks + 10 unlocks) in reasonable time
      expect(duration).toBeLessThan(1000); // 1 second max
    });

    it('should not cause memory leaks in repeated operations', async () => {
      const actor = await createTestActor(entityManager, { hasMouth: true });
      
      // Perform many lock/unlock cycles
      for (let i = 0; i < 100; i++) {
        await operationInterpreter.execute({
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id }
        });
        
        await operationInterpreter.execute({
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id }
        });
      }
      
      // Should still be in consistent state
      expect(isMouthLocked(entityManager, actor.id)).toBe(false);
    });
  });
});
```

## Test Execution Strategy

### Test Categories

#### Workflow Tests
- Complete user scenarios from start to finish
- Multiple system interactions
- Real-world usage patterns

#### Cross-Module Tests  
- Integration between mods (core, positioning, intimacy)
- Component/condition/operation interactions
- Dependency chain validation

#### Performance Tests
- Bulk operations
- Memory usage patterns
- Response time validation

#### Error Recovery Tests
- Failed operations in integrated environment
- Partial system failures
- Graceful degradation

## Acceptance Criteria

### Integration Coverage
- [ ] **End-to-End Workflows**: Complete kissing-positioning scenarios tested
- [ ] **Cross-Module Integration**: All mod interactions tested
- [ ] **Operation Integration**: All operations work through interpreter
- [ ] **Condition Integration**: Conditions work with action system
- [ ] **Event Integration**: Events properly dispatched and handled

### Performance Requirements
- [ ] **Execution Time**: Integration tests complete in <2 minutes
- [ ] **Memory Usage**: No memory leaks in test runs
- [ ] **Bulk Operations**: Handle 10+ concurrent operations efficiently
- [ ] **System Response**: Operations complete in <50ms each

### Quality Gates
- [ ] **Real Environment**: Tests use realistic game engine setup
- [ ] **Data Consistency**: All operations maintain data integrity
- [ ] **Error Handling**: Failed operations handled gracefully
- [ ] **Event Coverage**: All relevant events tested
- [ ] **User Experience**: User-facing messages tested

## Running Integration Tests

### Test Execution Commands
```bash
# Run all integration tests
npm run test:integration

# Run mouth engagement integration tests only
npm run test:integration -- --testPathPattern="mouth|engagement"

# Run with coverage
npm run test:integration -- --coverage

# Run specific integration test suite
npm run test:integration tests/integration/workflows/kissingPositioningConflict.integration.test.js

# Run with verbose output for debugging
npm run test:integration -- --verbose
```

## Definition of Done

- [ ] All 5 integration test files created and implemented
- [ ] End-to-end kissing-positioning workflow tested
- [ ] Cross-module integration verified
- [ ] All operation types tested through interpreter
- [ ] Event system integration verified
- [ ] Performance requirements met
- [ ] All tests passing consistently
- [ ] Real game engine environment used
- [ ] Error scenarios tested
- [ ] User experience flows validated