# MOULOCSYS-014: Create Performance and Edge Case Tests

**Phase**: Testing & Validation  
**Priority**: Medium  
**Complexity**: High  
**Dependencies**: MOULOCSYS-012 (unit tests), MOULOCSYS-013 (integration tests)  
**Estimated Time**: 6-8 hours

## Summary

Create specialized test suites for performance benchmarks and edge case scenarios for the mouth engagement system. Ensure the system performs well under stress conditions and handles unusual or boundary cases gracefully. This completes the comprehensive testing strategy for the mouth locking system.

## Technical Requirements

### Test Files to Create

1. `tests/performance/mods/core/mouthEngagementPerformance.test.js`
2. `tests/memory/mods/core/mouthEngagementMemory.test.js`
3. `tests/edge-cases/mods/core/mouthEngagementEdgeCases.test.js`
4. `tests/stress/system/mouthEngagementStress.test.js`
5. `tests/boundary/mods/core/mouthEngagementBoundary.test.js`

### Test Architecture

#### Performance Test Pattern
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { createTestGameEngine } from '../../../common/testGameEngine.js';

describe('Mouth Engagement Performance', () => {
  let gameEngine;
  let startTime;
  let endTime;

  beforeEach(async () => {
    gameEngine = await createTestGameEngine();
  });

  const measurePerformance = async (operation) => {
    startTime = performance.now();
    await operation();
    endTime = performance.now();
    return endTime - startTime;
  };

  const expectPerformance = (duration, maxMs, operationDescription) => {
    expect(duration).toBeLessThan(maxMs);
    console.log(`${operationDescription}: ${duration.toFixed(2)}ms`);
  };
});
```

## Performance Test Suites

### 1. Core Performance Tests

File: `tests/performance/mods/core/mouthEngagementPerformance.test.js`

```javascript
describe('Mouth Engagement - Performance Tests', () => {
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

  describe('Operation Performance', () => {
    it('should lock mouth engagement in <10ms', async () => {
      const actor = await createTestActor(entityManager, { hasMouth: true });
      
      const duration = await measurePerformance(async () => {
        await operationInterpreter.execute({
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id }
        });
      });
      
      expectPerformance(duration, 10, 'Lock mouth engagement');
    });

    it('should unlock mouth engagement in <10ms', async () => {
      const actor = await createTestActor(entityManager, { 
        hasMouth: true,
        mouthLocked: true 
      });
      
      const duration = await measurePerformance(async () => {
        await operationInterpreter.execute({
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id }
        });
      });
      
      expectPerformance(duration, 10, 'Unlock mouth engagement');
    });

    it('should handle bulk lock operations efficiently', async () => {
      const actors = [];
      for (let i = 0; i < 100; i++) {
        actors.push(await createTestActor(entityManager, { hasMouth: true }));
      }
      
      const duration = await measurePerformance(async () => {
        await Promise.all(actors.map(actor =>
          operationInterpreter.execute({
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor.id }
          })
        ));
      });
      
      expectPerformance(duration, 1000, '100 parallel lock operations');
      expect(duration / actors.length).toBeLessThan(10); // <10ms per operation
    });

    it('should handle rapid lock/unlock cycles efficiently', async () => {
      const actor = await createTestActor(entityManager, { hasMouth: true });
      
      const duration = await measurePerformance(async () => {
        for (let i = 0; i < 50; i++) {
          await operationInterpreter.execute({
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor.id }
          });
          
          await operationInterpreter.execute({
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor.id }
          });
        }
      });
      
      expectPerformance(duration, 500, '50 lock/unlock cycles');
    });
  });

  describe('Condition Evaluation Performance', () => {
    it('should evaluate actor-mouth-available in <5ms', async () => {
      const actor = await createTestActor(entityManager, { hasMouth: true });
      
      const duration = await measurePerformance(async () => {
        await conditionEvaluator.evaluate(
          'core:actor-mouth-available',
          { actor: actor.id }
        );
      });
      
      expectPerformance(duration, 5, 'Mouth availability condition');
    });

    it('should handle bulk condition evaluations efficiently', async () => {
      const actors = [];
      for (let i = 0; i < 100; i++) {
        actors.push(await createTestActor(entityManager, { hasMouth: true }));
      }
      
      const duration = await measurePerformance(async () => {
        await Promise.all(actors.map(actor =>
          conditionEvaluator.evaluate(
            'core:actor-mouth-available',
            { actor: actor.id }
          )
        ));
      });
      
      expectPerformance(duration, 500, '100 parallel condition evaluations');
    });

    it('should scale linearly with entity count', async () => {
      const entityCounts = [10, 50, 100];
      const durations = [];
      
      for (const count of entityCounts) {
        const actors = [];
        for (let i = 0; i < count; i++) {
          actors.push(await createTestActor(entityManager, { hasMouth: true }));
        }
        
        const duration = await measurePerformance(async () => {
          await Promise.all(actors.map(actor =>
            conditionEvaluator.evaluate(
              'core:actor-mouth-available',
              { actor: actor.id }
            )
          ));
        });
        
        durations.push(duration / count); // Duration per entity
      }
      
      // Should not show significant performance degradation
      const degradation = durations[2] / durations[0];
      expect(degradation).toBeLessThan(2); // <2x slower at 10x scale
    });
  });

  describe('Complex Anatomy Performance', () => {
    it('should handle complex body structures efficiently', async () => {
      // Create actor with complex anatomy (multiple body parts)
      const actor = await createComplexAnatomyActor(entityManager, {
        bodyParts: 50, // Lots of body parts
        mouthParts: 3  // Multiple mouths
      });
      
      const duration = await measurePerformance(async () => {
        await operationInterpreter.execute({
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id }
        });
      });
      
      expectPerformance(duration, 50, 'Complex anatomy lock operation');
    });
  });
});
```

### 2. Memory Usage Tests

File: `tests/memory/mods/core/mouthEngagementMemory.test.js`

```javascript
describe('Mouth Engagement - Memory Tests', () => {
  let gameEngine;
  let entityManager;
  let operationInterpreter;

  beforeEach(async () => {
    gameEngine = await createTestGameEngine();
    entityManager = gameEngine.entityManager;
    operationInterpreter = gameEngine.operationInterpreter;
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during repeated operations', async () => {
      const actor = await createTestActor(entityManager, { hasMouth: true });
      
      // Measure baseline memory
      if (global.gc) global.gc();
      const baselineMemory = process.memoryUsage().heapUsed;
      
      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        await operationInterpreter.execute({
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id }
        });
        
        await operationInterpreter.execute({
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id }
        });
        
        // Force GC every 100 operations
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }
      
      // Measure final memory
      if (global.gc) global.gc();
      const finalMemory = process.memoryUsage().heapUsed;
      
      const memoryIncrease = (finalMemory - baselineMemory) / (1024 * 1024);
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)} MB`);
      
      // Should not increase memory by more than 10MB
      expect(memoryIncrease).toBeLessThan(10);
    });

    it('should clean up component objects properly', async () => {
      const actors = [];
      for (let i = 0; i < 100; i++) {
        actors.push(await createTestActor(entityManager, { hasMouth: true }));
      }
      
      // Lock all actors
      for (const actor of actors) {
        await operationInterpreter.execute({
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id }
        });
      }
      
      if (global.gc) global.gc();
      const midpointMemory = process.memoryUsage().heapUsed;
      
      // Unlock all actors
      for (const actor of actors) {
        await operationInterpreter.execute({
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id }
        });
      }
      
      // Clean up actors
      for (const actor of actors) {
        await entityManager.destroyEntity(actor.id);
      }
      
      if (global.gc) global.gc();
      const finalMemory = process.memoryUsage().heapUsed;
      
      const memoryCleanup = (midpointMemory - finalMemory) / (1024 * 1024);
      console.log(`Memory cleaned up: ${memoryCleanup.toFixed(2)} MB`);
      
      // Should clean up most of the memory
      expect(memoryCleanup).toBeGreaterThan(0);
    });
  });

  describe('Memory Efficiency', () => {
    it('should use minimal memory per mouth engagement component', async () => {
      const startMemory = process.memoryUsage().heapUsed;
      
      const actors = [];
      for (let i = 0; i < 1000; i++) {
        const actor = await createTestActor(entityManager, { hasMouth: true });
        actors.push(actor);
      }
      
      if (global.gc) global.gc();
      const endMemory = process.memoryUsage().heapUsed;
      
      const memoryPerActor = (endMemory - startMemory) / actors.length;
      const memoryPerActorKB = memoryPerActor / 1024;
      
      console.log(`Memory per actor: ${memoryPerActorKB.toFixed(2)} KB`);
      
      // Should use less than 5KB per actor (including mouth engagement)
      expect(memoryPerActorKB).toBeLessThan(5);
    });
  });
});
```

### 3. Edge Cases Tests

File: `tests/edge-cases/mods/core/mouthEngagementEdgeCases.test.js`

```javascript
describe('Mouth Engagement - Edge Cases', () => {
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

  describe('Entity Edge Cases', () => {
    it('should handle entity without anatomy gracefully', async () => {
      const entity = await entityManager.createEntity('basic_entity');
      
      // Should not throw
      await expect(
        operationInterpreter.execute({
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: entity.id }
        })
      ).not.toThrow();
      
      // Should create basic mouth engagement component
      const component = entityManager.getComponentData(
        entity.id,
        'core:mouth_engagement'
      );
      expect(component).toEqual({
        locked: true,
        forcedOverride: false
      });
    });

    it('should handle entity with malformed anatomy', async () => {
      const entity = await entityManager.createEntity('malformed_entity');
      
      // Add malformed anatomy
      await entityManager.addComponent(entity.id, 'anatomy:body', {
        body: {
          // Missing root
          parts: null // Invalid parts
        }
      });
      
      // Should not throw and fall back to legacy handling
      await expect(
        operationInterpreter.execute({
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: entity.id }
        })
      ).not.toThrow();
    });

    it('should handle entity with multiple mouth parts', async () => {
      const actor = await createMultiMouthActor(entityManager, {
        mouthCount: 5
      });
      
      // Lock should affect all mouths
      await operationInterpreter.execute({
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actor.id }
      });
      
      const mouthParts = getMouthParts(entityManager, actor.id);
      expect(mouthParts).toHaveLength(5);
      
      for (const mouth of mouthParts) {
        expect(mouth.engagement.locked).toBe(true);
      }
    });

    it('should handle circular anatomy references', async () => {
      const entity = await entityManager.createEntity('circular_entity');
      const part1 = await entityManager.createEntity('part_1');
      const part2 = await entityManager.createEntity('part_2');
      
      // Create circular reference
      await entityManager.addComponent(entity.id, 'anatomy:body', {
        body: {
          root: part1.id,
          parts: { mouth: part1.id, head: part2.id }
        }
      });
      
      await entityManager.addComponent(part1.id, 'anatomy:part', {
        subType: 'mouth',
        parent: part2.id
      });
      
      await entityManager.addComponent(part2.id, 'anatomy:part', {
        subType: 'head',
        parent: part1.id // Circular reference
      });
      
      // Should not hang or crash
      await expect(
        operationInterpreter.execute({
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: entity.id }
        })
      ).not.toThrow();
    });
  });

  describe('Component Edge Cases', () => {
    it('should handle existing mouth engagement with extra properties', async () => {
      const actor = await createTestActor(entityManager, { hasMouth: true });
      
      // Add mouth engagement with extra properties
      const mouthParts = getMouthParts(entityManager, actor.id);
      await entityManager.addComponent(
        mouthParts[0].partId,
        'core:mouth_engagement',
        {
          locked: false,
          forcedOverride: false,
          customProperty: 'should be preserved',
          timestamp: Date.now()
        }
      );
      
      // Lock operation should preserve extra properties
      await operationInterpreter.execute({
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actor.id }
      });
      
      const updatedComponent = entityManager.getComponentData(
        mouthParts[0].partId,
        'core:mouth_engagement'
      );
      
      expect(updatedComponent.locked).toBe(true);
      expect(updatedComponent.customProperty).toBe('should be preserved');
      expect(updatedComponent.timestamp).toBeDefined();
    });

    it('should handle forcedOverride edge cases', async () => {
      const actor = await createTestActor(entityManager, { hasMouth: true });
      const mouthParts = getMouthParts(entityManager, actor.id);
      
      // Set forcedOverride to true
      await entityManager.addComponent(
        mouthParts[0].partId,
        'core:mouth_engagement',
        {
          locked: true,
          forcedOverride: true
        }
      );
      
      // Condition should still consider mouth available due to forcedOverride
      // Note: This depends on final implementation decision
      const available = await conditionEvaluator.evaluate(
        'core:actor-mouth-available',
        { actor: actor.id }
      );
      
      // Test based on final forcedOverride implementation
      // expect(available).toBe(true); // If forcedOverride bypasses lock
      // expect(available).toBe(false); // If forcedOverride is ignored by condition
    });
  });

  describe('Concurrent Access Edge Cases', () => {
    it('should handle simultaneous lock/unlock operations', async () => {
      const actor = await createTestActor(entityManager, { hasMouth: true });
      
      // Start multiple operations simultaneously
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          operationInterpreter.execute({
            type: i % 2 === 0 ? 'LOCK_MOUTH_ENGAGEMENT' : 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor.id }
          })
        );
      }
      
      // All should complete without throwing
      await expect(Promise.all(operations)).not.toThrow();
      
      // Final state should be consistent (last operation wins)
      const finalLocked = isMouthLocked(entityManager, actor.id);
      expect(typeof finalLocked).toBe('boolean');
    });

    it('should handle rapid condition evaluations during state changes', async () => {
      const actor = await createTestActor(entityManager, { hasMouth: true });
      
      const evaluations = [];
      const operations = [];
      
      // Start condition evaluations
      for (let i = 0; i < 20; i++) {
        evaluations.push(
          conditionEvaluator.evaluate(
            'core:actor-mouth-available',
            { actor: actor.id }
          )
        );
      }
      
      // Start state changes
      for (let i = 0; i < 10; i++) {
        operations.push(
          operationInterpreter.execute({
            type: i % 2 === 0 ? 'LOCK_MOUTH_ENGAGEMENT' : 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor.id }
          })
        );
      }
      
      // All should complete
      const [evalResults, opResults] = await Promise.all([
        Promise.all(evaluations),
        Promise.all(operations)
      ]);
      
      // All evaluations should return boolean
      for (const result of evalResults) {
        expect(typeof result).toBe('boolean');
      }
    });
  });

  describe('Invalid Input Edge Cases', () => {
    it('should handle extremely long entity IDs', async () => {
      const longId = 'a'.repeat(10000);
      
      await expect(
        operationInterpreter.execute({
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: longId }
        })
      ).not.toThrow();
    });

    it('should handle entity IDs with special characters', async () => {
      const specialIds = [
        'entity:with:colons',
        'entity-with-dashes',
        'entity_with_underscores',
        'entity.with.dots',
        'entity with spaces',
        'entity\nwith\nnewlines',
        'entity\twith\ttabs',
        'entity"with"quotes',
        'entity\\with\\backslashes'
      ];
      
      for (const id of specialIds) {
        await expect(
          operationInterpreter.execute({
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: id }
          })
        ).not.toThrow();
      }
    });
  });
});
```

### 4. Stress Tests

File: `tests/stress/system/mouthEngagementStress.test.js`

```javascript
describe('Mouth Engagement - Stress Tests', () => {
  let gameEngine;
  let entityManager;
  let operationInterpreter;

  beforeEach(async () => {
    gameEngine = await createTestGameEngine();
    entityManager = gameEngine.entityManager;
    operationInterpreter = gameEngine.operationInterpreter;
  });

  describe('High Load Scenarios', () => {
    it('should handle 1000+ entities with mouth engagement', async () => {
      const actors = [];
      
      console.log('Creating 1000 actors...');
      for (let i = 0; i < 1000; i++) {
        actors.push(await createTestActor(entityManager, { hasMouth: true }));
        
        if (i % 100 === 0) {
          console.log(`Created ${i} actors`);
        }
      }
      
      console.log('Locking all mouths...');
      const lockStart = performance.now();
      
      await Promise.all(actors.map(actor =>
        operationInterpreter.execute({
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id }
        })
      ));
      
      const lockEnd = performance.now();
      const lockDuration = lockEnd - lockStart;
      
      console.log(`Locked 1000 mouths in ${lockDuration.toFixed(2)}ms`);
      expect(lockDuration).toBeLessThan(5000); // 5 seconds max
      
      // Verify all are locked
      for (const actor of actors.slice(0, 10)) { // Check first 10
        expect(isMouthLocked(entityManager, actor.id)).toBe(true);
      }
      
      console.log('Unlocking all mouths...');
      const unlockStart = performance.now();
      
      await Promise.all(actors.map(actor =>
        operationInterpreter.execute({
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id }
        })
      ));
      
      const unlockEnd = performance.now();
      const unlockDuration = unlockEnd - unlockStart;
      
      console.log(`Unlocked 1000 mouths in ${unlockDuration.toFixed(2)}ms`);
      expect(unlockDuration).toBeLessThan(5000);
      
      // Verify all are unlocked
      for (const actor of actors.slice(0, 10)) {
        expect(isMouthLocked(entityManager, actor.id)).toBe(false);
      }
    }, 30000); // 30 second timeout

    it('should handle sustained operation load', async () => {
      const actor = await createTestActor(entityManager, { hasMouth: true });
      
      console.log('Starting sustained load test...');
      const startTime = performance.now();
      let operations = 0;
      
      // Run operations for 10 seconds
      while (performance.now() - startTime < 10000) {
        await operationInterpreter.execute({
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id }
        });
        
        await operationInterpreter.execute({
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id }
        });
        
        operations += 2;
        
        if (operations % 100 === 0) {
          console.log(`Completed ${operations} operations`);
        }
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const opsPerSecond = (operations / totalTime) * 1000;
      
      console.log(`Sustained ${opsPerSecond.toFixed(0)} ops/sec for ${totalTime.toFixed(0)}ms`);
      expect(opsPerSecond).toBeGreaterThan(50); // At least 50 ops/sec
      
      // System should still be in consistent state
      expect(isMouthLocked(entityManager, actor.id)).toBe(false);
    }, 15000);
  });

  describe('Memory Pressure Tests', () => {
    it('should maintain performance under memory pressure', async () => {
      // Create memory pressure
      const memoryHogs = [];
      for (let i = 0; i < 100; i++) {
        memoryHogs.push(new Array(100000).fill('memory pressure'));
      }
      
      const actor = await createTestActor(entityManager, { hasMouth: true });
      
      // Test performance under pressure
      const duration = await measurePerformance(async () => {
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
      });
      
      // Should still complete in reasonable time
      expect(duration).toBeLessThan(2000);
      
      // Clean up memory hogs
      memoryHogs.length = 0;
    });
  });
});
```

### 5. Boundary Tests

File: `tests/boundary/mods/core/mouthEngagementBoundary.test.js`

```javascript
describe('Mouth Engagement - Boundary Tests', () => {
  describe('Parameter Boundaries', () => {
    it('should handle null parameters gracefully');
    it('should handle undefined parameters gracefully');
    it('should handle empty string actor_id');
    it('should handle whitespace-only actor_id');
    it('should handle extremely long actor_id');
    it('should handle numeric actor_id');
    it('should handle object actor_id');
  });

  describe('System Boundaries', () => {
    it('should handle maximum entity count');
    it('should handle maximum component size');
    it('should handle maximum depth anatomy structures');
    it('should handle zero-length anatomy parts arrays');
  });

  describe('State Boundaries', () => {
    it('should handle rapid state transitions');
    it('should handle state changes during evaluation');
    it('should handle component removal during operation');
    it('should handle entity destruction during operation');
  });
});
```

## Acceptance Criteria

### Performance Requirements
- [ ] **Operation Speed**: Lock/unlock operations complete in <10ms
- [ ] **Condition Speed**: Mouth availability checks complete in <5ms  
- [ ] **Bulk Operations**: 100 parallel operations complete in <1000ms
- [ ] **Scalability**: Linear performance scaling with entity count
- [ ] **Memory Efficiency**: <5KB memory per actor including mouth engagement

### Stress Testing Requirements
- [ ] **High Load**: Handle 1000+ entities with mouth engagement
- [ ] **Sustained Load**: Maintain >50 ops/sec for 10+ seconds
- [ ] **Memory Pressure**: Maintain performance under memory constraints
- [ ] **Concurrent Access**: Handle simultaneous operations without corruption

### Edge Case Coverage
- [ ] **Entity Variations**: Entities without anatomy, malformed anatomy, circular references
- [ ] **Component States**: Extra properties, invalid values, missing components
- [ ] **Concurrent Operations**: Simultaneous lock/unlock, rapid state changes
- [ ] **Invalid Inputs**: Special characters, extreme values, wrong types

### Memory Requirements
- [ ] **No Memory Leaks**: Repeated operations don't increase memory
- [ ] **Efficient Cleanup**: Memory released when entities destroyed
- [ ] **Minimal Footprint**: Mouth engagement uses minimal memory per entity

## Running Performance Tests

### Test Execution Commands
```bash
# Run performance tests
npm run test:performance -- --testPathPattern="mouth|engagement"

# Run memory tests (requires --expose-gc)
npm run test:memory -- --testPathPattern="mouth|engagement"

# Run stress tests
npm run test:stress -- --testPathPattern="mouth|engagement"

# Run all edge case tests
npm run test:edge-cases -- --testPathPattern="mouth|engagement"

# Run with performance monitoring
npm run test:performance -- --verbose --forceExit
```

### Performance Monitoring
```bash
# Run with heap snapshots
npm run test:memory -- --detectOpenHandles --forceExit

# Run with CPU profiling
npm run test:performance -- --detectLeaks
```

## Definition of Done

- [ ] All 5 specialized test files created and implemented
- [ ] Performance benchmarks meet requirements (<10ms operations)
- [ ] Memory usage tests pass (no leaks, efficient cleanup)
- [ ] Edge cases handled gracefully (no crashes on invalid input)
- [ ] Stress tests validate system under high load (1000+ entities)
- [ ] Boundary tests cover parameter and system limits
- [ ] All tests passing consistently
- [ ] Performance metrics documented and within acceptable ranges
- [ ] Memory efficiency validated and optimized
- [ ] System maintains stability under stress conditions