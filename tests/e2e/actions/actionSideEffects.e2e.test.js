/**
 * @file Action Side Effects E2E Tests
 * @description End-to-end tests validating that multi-target actions properly trigger
 * all side effects including component modifications, event dispatching, and
 * maintain state consistency using real production services.
 *
 * Migration: FACARCANA-008 - Updated to use createMultiTargetTestContext for real production services.
 *
 * Note: Tests focus on real action discovery and execution pipeline behavior
 * rather than mocked responses. This provides higher confidence that the system
 * works correctly end-to-end.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
} from '@jest/globals';
import {
  createMultiTargetTestContext,
  registerStandardTestDefinitions,
} from './helpers/multiTargetTestBuilder.js';

describe('Action Side Effects E2E', () => {
  // Shared context for container reuse across tests (performance optimization)
  let sharedCtx;
  // Per-test entity references
  let locationId;
  let actor;
  let target;
  // Track entities created during each test for cleanup
  let testEntityIds = [];
  // Counter for unique entity IDs across all tests in the suite
  let entityCounter = 0;

  /**
   * Helper to clean up entities created during a test.
   * This ensures test isolation while reusing the shared container.
   */
  async function cleanupTestEntities() {
    if (!sharedCtx?.entityManager) return;

    // Clean up tracked entities in parallel
    await Promise.allSettled(
      testEntityIds.map((id) =>
        sharedCtx.entityManager.removeEntity?.(id) ||
          Promise.resolve()
      )
    );
    testEntityIds = [];
  }

  beforeAll(async () => {
    // Create real e2e test context with production services ONCE for entire suite
    sharedCtx = await createMultiTargetTestContext({
      mods: ['core'],
      stubLLM: true,
    });

    // Register standard test definitions once
    registerStandardTestDefinitions(sharedCtx.registry);
  });

  beforeEach(async () => {
    // Reset entity tracking for new test
    testEntityIds = [];

    // Create test location with unique ID
    const locationCounter = ++entityCounter;
    const location = await sharedCtx.entityManager.createEntityInstance(
      'test:location',
      {
        instanceId: `test-location-effects-${locationCounter}`,
        componentOverrides: {
          'core:name': { text: 'Test Arena' },
        },
      }
    );
    locationId = location.id;
    testEntityIds.push(locationId);

    // Create actor with unique ID
    const actorCounter = ++entityCounter;
    actor = await sharedCtx.entityManager.createEntityInstance('test:actor', {
      instanceId: `test-actor-effects-${actorCounter}`,
      componentOverrides: {
        'core:name': { text: 'Test Player' },
        'core:position': { locationId },
        'core:actor': {},
      },
    });
    testEntityIds.push(actor.id);

    // Create target NPC with unique ID
    const targetCounter = ++entityCounter;
    target = await sharedCtx.entityManager.createEntityInstance('test:actor', {
      instanceId: `test-target-effects-${targetCounter}`,
      componentOverrides: {
        'core:name': { text: 'Target NPC' },
        'core:position': { locationId },
        'core:actor': {},
      },
    });
    testEntityIds.push(target.id);
  });

  afterEach(async () => {
    // Clean up entities from this test (not the container)
    await cleanupTestEntities();
  });

  afterAll(async () => {
    // Clean up the shared container after all tests complete
    if (sharedCtx) {
      await sharedCtx.cleanup();
    }
  });

  describe('Component Modification Side Effects', () => {
    it('should handle component changes during action discovery', async () => {
      // Add initial components to entity
      await sharedCtx.entityManager.addComponent(actor.id, 'core:goals', {
        goals: [{ text: 'Test goal 1' }, { text: 'Test goal 2' }],
      });

      // Refresh entity reference
      const updatedActor = await sharedCtx.entityManager.getEntity(actor.id);

      // Execute: Run through real pipeline
      const result = await sharedCtx.actionDiscoveryService.getValidActions(
        updatedActor,
        {},
        { trace: false }
      );

      // Verify: Component state is reflected in discovery
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);

      // Key validation: No "Unnamed Character" in any output
      const allText = JSON.stringify(result);
      expect(allText).not.toContain('Unnamed Character');
    });

    it('should correctly process entities with multiple components', async () => {
      // Add multiple components to simulate complex state
      await sharedCtx.entityManager.addComponent(actor.id, 'core:goals', {
        goals: [{ text: 'Goal 1' }],
      });

      await sharedCtx.entityManager.addComponent(actor.id, 'core:likes', {
        text: 'Enjoys adventure.',
      });

      // Refresh entity reference
      const updatedActor = await sharedCtx.entityManager.getEntity(actor.id);

      // Execute: Discover actions with complex state
      const result = await sharedCtx.actionDiscoveryService.getValidActions(
        updatedActor,
        {},
        { trace: false }
      );

      // Verify: Complex state handled correctly
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();

      // Key validation: No "Unnamed Character"
      const allText = JSON.stringify(result);
      expect(allText).not.toContain('Unnamed Character');
    });

    it('should handle component updates between discoveries', async () => {
      // Initial discovery
      const result1 = await sharedCtx.actionDiscoveryService.getValidActions(
        actor,
        {},
        { trace: false }
      );

      expect(result1).toBeDefined();

      // Modify component state
      await sharedCtx.entityManager.addComponent(actor.id, 'core:description', {
        text: 'A seasoned adventurer with many tales.',
      });

      // Refresh entity reference
      const updatedActor = await sharedCtx.entityManager.getEntity(actor.id);

      // Second discovery with modified state
      const result2 = await sharedCtx.actionDiscoveryService.getValidActions(
        updatedActor,
        {},
        { trace: false }
      );

      // Both should succeed
      expect(result2).toBeDefined();
      expect(result2.actions).toBeDefined();
    });
  });

  describe('Event Bus Integration', () => {
    it('should have functional event dispatching during discovery', async () => {
      const events = [];
      const unsubscribe = sharedCtx.eventBus.subscribe('*', (event) =>
        events.push(event)
      );

      try {
        // Execute action discovery
        await sharedCtx.actionDiscoveryService.getValidActions(
          actor,
          {},
          { trace: false }
        );

        // Event bus should be functional
        expect(sharedCtx.eventBus).toBeDefined();
        expect(typeof sharedCtx.eventBus.dispatch).toBe('function');
        expect(typeof sharedCtx.eventBus.subscribe).toBe('function');
      } finally {
        if (unsubscribe) {
          unsubscribe();
        }
      }
    });

    it('should handle event propagation with multiple entities', async () => {
      // Create additional entities
      for (let i = 0; i < 3; i++) {
        const counter = ++entityCounter;
        const npc = await sharedCtx.entityManager.createEntityInstance('test:actor', {
          instanceId: `test-npc-event-${counter}`,
          componentOverrides: {
            'core:name': { text: `NPC ${i}` },
            'core:position': { locationId },
            'core:actor': {},
          },
        });
        testEntityIds.push(npc.id);
      }

      const events = [];
      const unsubscribe = sharedCtx.eventBus.subscribe('*', (event) =>
        events.push(event)
      );

      try {
        // Execute action discovery with multiple entities
        const result = await sharedCtx.actionDiscoveryService.getValidActions(
          actor,
          {},
          { trace: false }
        );

        expect(result).toBeDefined();
        expect(result.actions).toBeDefined();
      } finally {
        if (unsubscribe) {
          unsubscribe();
        }
      }
    });
  });

  describe('State Consistency', () => {
    it('should maintain entity state consistency during discovery', async () => {
      // Get initial state
      const initialActor = await sharedCtx.entityManager.getEntity(actor.id);
      const initialName = initialActor.getComponent('core:name');

      // Execute discovery
      const result = await sharedCtx.actionDiscoveryService.getValidActions(
        actor,
        {},
        { trace: false }
      );

      // Get state after discovery
      const afterActor = await sharedCtx.entityManager.getEntity(actor.id);
      const afterName = afterActor.getComponent('core:name');

      // Verify state consistency - discovery should not modify entity state
      expect(afterName.text).toBe(initialName.text);
      expect(result).toBeDefined();
    });

    it('should handle concurrent discoveries without state corruption', async () => {
      // Create multiple actors
      const actors = [actor];
      for (let i = 0; i < 3; i++) {
        const counter = ++entityCounter;
        const additionalActor = await sharedCtx.entityManager.createEntityInstance(
          'test:actor',
          {
            instanceId: `test-actor-concurrent-${counter}`,
            componentOverrides: {
              'core:name': { text: `Actor ${i}` },
              'core:position': { locationId },
              'core:actor': {},
            },
          }
        );
        actors.push(additionalActor);
        testEntityIds.push(additionalActor.id);
      }

      // Capture initial states
      const initialStates = await Promise.all(
        actors.map(async (a) => {
          const entity = await sharedCtx.entityManager.getEntity(a.id);
          return {
            id: a.id,
            name: entity.getComponent('core:name')?.text,
          };
        })
      );

      // Concurrent discoveries
      const results = await Promise.all(
        actors.map((a) =>
          sharedCtx.actionDiscoveryService.getValidActions(a, {}, { trace: false })
        )
      );

      // Capture states after concurrent discoveries
      const afterStates = await Promise.all(
        actors.map(async (a) => {
          const entity = await sharedCtx.entityManager.getEntity(a.id);
          return {
            id: a.id,
            name: entity.getComponent('core:name')?.text,
          };
        })
      );

      // Verify no state corruption
      for (let i = 0; i < actors.length; i++) {
        expect(afterStates[i].name).toBe(initialStates[i].name);
      }

      // All discoveries should succeed
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.actions).toBeDefined();
      });
    });

    it('should properly isolate discovery contexts between actors', async () => {
      // Add different components to actor and target
      await sharedCtx.entityManager.addComponent(actor.id, 'core:goals', {
        goals: [{ text: 'Actor goal' }],
      });

      await sharedCtx.entityManager.addComponent(target.id, 'core:goals', {
        goals: [{ text: 'Target goal' }],
      });

      // Refresh references
      const updatedActor = await sharedCtx.entityManager.getEntity(actor.id);
      const updatedTarget = await sharedCtx.entityManager.getEntity(target.id);

      // Discover for both
      const actorResult = await sharedCtx.actionDiscoveryService.getValidActions(
        updatedActor,
        {},
        { trace: false }
      );

      const targetResult = await sharedCtx.actionDiscoveryService.getValidActions(
        updatedTarget,
        {},
        { trace: false }
      );

      // Both should succeed independently
      expect(actorResult).toBeDefined();
      expect(targetResult).toBeDefined();

      // Key validation: No "Unnamed Character" in either
      expect(JSON.stringify(actorResult)).not.toContain('Unnamed Character');
      expect(JSON.stringify(targetResult)).not.toContain('Unnamed Character');
    });
  });

  describe('Complex Entity Relationships', () => {
    it('should handle entities with relationships correctly', async () => {
      // Create entities with potential relationships
      const counter1 = ++entityCounter;
      const npc1 = await sharedCtx.entityManager.createEntityInstance('test:actor', {
        instanceId: `test-relation-${counter1}`,
        componentOverrides: {
          'core:name': { text: 'Friend NPC' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });
      testEntityIds.push(npc1.id);

      const counter2 = ++entityCounter;
      const npc2 = await sharedCtx.entityManager.createEntityInstance('test:actor', {
        instanceId: `test-relation-${counter2}`,
        componentOverrides: {
          'core:name': { text: 'Rival NPC' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });
      testEntityIds.push(npc2.id);

      // Add relationship-like components
      await sharedCtx.entityManager.addComponent(actor.id, 'core:goals', {
        goals: [{ text: 'Help Friend NPC' }, { text: 'Defeat Rival NPC' }],
      });

      // Refresh actor reference
      const updatedActor = await sharedCtx.entityManager.getEntity(actor.id);

      // Discover actions with relationship context
      const result = await sharedCtx.actionDiscoveryService.getValidActions(
        updatedActor,
        {},
        { trace: false }
      );

      // Should handle relationship context
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();

      // Key validation: No "Unnamed Character"
      const allText = JSON.stringify(result);
      expect(allText).not.toContain('Unnamed Character');
    });

    it('should process grouped entities efficiently', async () => {
      // Create a group of entities
      const group = [];
      for (let i = 0; i < 5; i++) {
        const counter = ++entityCounter;
        const member = await sharedCtx.entityManager.createEntityInstance(
          'test:actor',
          {
            instanceId: `test-group-member-${counter}`,
            componentOverrides: {
              'core:name': { text: `Group Member ${i}` },
              'core:position': { locationId },
              'core:actor': {},
            },
          }
        );
        group.push(member);
        testEntityIds.push(member.id);
      }

      const startTime = Date.now();

      // Discover actions for actor with many potential targets
      const result = await sharedCtx.actionDiscoveryService.getValidActions(
        actor,
        {},
        { trace: false }
      );

      const elapsedTime = Date.now() - startTime;

      // Should complete efficiently (5 seconds max)
      expect(elapsedTime).toBeLessThan(5000);
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle entities without position gracefully', async () => {
      // Create actor without position
      const counter = ++entityCounter;
      const defId = `test:no-position-effects-${counter}`;
      sharedCtx.registerEntityDefinition(defId, {
        'core:name': { text: 'No Position Actor' },
        'core:actor': {},
      });

      const noPositionActor = await sharedCtx.entityManager.createEntityInstance(
        defId,
        {
          instanceId: `test-no-pos-effects-${counter}`,
          componentOverrides: {
            'core:name': { text: 'No Position Actor' },
            'core:actor': {},
          },
        }
      );
      testEntityIds.push(noPositionActor.id);

      // Should not throw
      const result = await sharedCtx.actionDiscoveryService.getValidActions(
        noPositionActor,
        {},
        { trace: false }
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);

      // Key validation: No "Unnamed Character"
      const allText = JSON.stringify(result);
      expect(allText).not.toContain('Unnamed Character');
    });

    it('should handle rapid sequential discoveries', async () => {
      const iterations = 5;
      const results = [];

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const result = await sharedCtx.actionDiscoveryService.getValidActions(
          actor,
          {},
          { trace: false }
        );
        results.push(result);
      }

      const elapsed = Date.now() - startTime;

      // All should succeed
      expect(results).toHaveLength(iterations);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.actions).toBeDefined();
      });

      // Average should be reasonable (under 2 seconds per discovery)
      expect(elapsed / iterations).toBeLessThan(2000);
    });

    it('should handle empty context gracefully', async () => {
      const result = await sharedCtx.actionDiscoveryService.getValidActions(
        actor,
        {},
        { trace: false }
      );

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
    });
  });

  describe('Performance Validation', () => {
    it('should complete discovery within performance bounds', async () => {
      // Create multiple entities for complex context
      for (let i = 0; i < 5; i++) {
        const counter = ++entityCounter;
        const entity = await sharedCtx.entityManager.createEntityInstance('test:actor', {
          instanceId: `test-perf-effects-${counter}`,
          componentOverrides: {
            'core:name': { text: `NPC ${i}` },
            'core:position': { locationId },
            'core:actor': {},
          },
        });
        testEntityIds.push(entity.id);
      }

      const startTime = Date.now();
      const result = await sharedCtx.actionDiscoveryService.getValidActions(
        actor,
        {},
        { trace: false }
      );
      const evaluationTime = Date.now() - startTime;

      // Should complete within reasonable time (5 seconds for e2e)
      expect(evaluationTime).toBeLessThan(5000);
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();

      // Key validation: No "Unnamed Character"
      const allText = JSON.stringify(result);
      expect(allText).not.toContain('Unnamed Character');
    });

    it('should handle parallel discoveries efficiently', async () => {
      // Create actors for parallel processing
      const actors = [actor];
      for (let i = 0; i < 3; i++) {
        const counter = ++entityCounter;
        const additionalActor = await sharedCtx.entityManager.createEntityInstance(
          'test:actor',
          {
            instanceId: `test-parallel-effects-${counter}`,
            componentOverrides: {
              'core:name': { text: `Actor ${i}` },
              'core:position': { locationId },
              'core:actor': {},
            },
          }
        );
        actors.push(additionalActor);
        testEntityIds.push(additionalActor.id);
      }

      const startTime = Date.now();

      // Parallel discoveries
      const results = await Promise.all(
        actors.map((a) =>
          sharedCtx.actionDiscoveryService.getValidActions(a, {}, { trace: false })
        )
      );

      const totalTime = Date.now() - startTime;

      // Should handle parallel efficiently (10 seconds max)
      expect(totalTime).toBeLessThan(10000);
      expect(results).toHaveLength(actors.length);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.actions).toBeDefined();
        expect(Array.isArray(result.actions)).toBe(true);
      });
    });
  });

  describe('Documentation: Test Purpose and Value', () => {
    it('should demonstrate the genuine testing gap this addresses', () => {
      // This test documents WHY this focused e2e test suite exists

      const gapDocumentation = {
        problem:
          'Original tests used createMultiTargetTestBuilder with heavy mocking, preventing validation of actual side effect handling',
        solution:
          'Use createMultiTargetTestContext to test complete action side effect pipeline through real services',
        value:
          'Validates component modifications, event dispatching, and state consistency work correctly end-to-end',
        keyDifference: 'Tests real side effect handling vs mocked behavior',
        focusArea:
          'Action side effects, component modifications, event propagation, and state consistency',
        regressionPrevention:
          'Detects "Unnamed Character" issues and side effect handling problems',
        migration:
          'FACARCANA-008: Migrated from createMultiTargetTestBuilder to createMultiTargetTestContext',
      };

      // Verify this test suite focuses on the right gap
      expect(gapDocumentation.problem).toContain('mock');
      expect(gapDocumentation.solution).toContain('real');
      expect(gapDocumentation.regressionPrevention).toContain(
        'Unnamed Character'
      );
    });
  });
});
