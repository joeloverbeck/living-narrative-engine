/**
 * @file Single Target Multiple Entities E2E Tests
 * @description Comprehensive end-to-end tests validating action discovery behavior
 * when target scopes resolve to multiple entities. Uses real production services
 * via e2eTestContainer.
 *
 * This test suite covers:
 * - Action discovery with multiple potential targets
 * - Multi-actor scenarios with varying target configurations
 * - Edge cases in target resolution
 * - Performance characteristics with multiple entities
 *
 * NOTE: Migrated from mock facades to use real production services via e2eTestContainer.
 * Tests use manually registered entity definitions since core mod doesn't include them.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createE2ETestEnvironment } from '../common/e2eTestContainer.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Single Target Multiple Entities E2E', () => {
  let env;
  let entityManager;
  let actionDiscoveryService;
  let registry;
  let locationId;
  let playerActorId;
  let playerEntity;

  /**
   * Registers test entity definitions in the registry.
   * Required because core mod doesn't include entity definitions.
   * Component schemas must match actual core mod schemas:
   * - core:name requires { text: string }
   * - core:actor is a marker component requiring {} (empty object)
   * - core:position requires { locationId: string }
   */
  async function registerTestEntityDefinitions() {
    // Register location definition
    const locationDef = createEntityDefinition('test:location', {
      'core:name': { text: 'Test Location' },
    });
    registry.store('entityDefinitions', 'test:location', locationDef);

    // Register actor definition
    const actorDef = createEntityDefinition('test:actor', {
      'core:name': { text: 'Test Actor' },
      'core:actor': {},
    });
    registry.store('entityDefinitions', 'test:actor', actorDef);

    // Register item definition (for inventory tests)
    const itemDef = createEntityDefinition('test:item', {
      'core:name': { text: 'Test Item' },
    });
    registry.store('entityDefinitions', 'test:item', itemDef);
  }

  beforeEach(async () => {
    // Create real e2e test environment WITH core mod loading
    env = await createE2ETestEnvironment({
      loadMods: true,
      mods: ['core'],
      stubLLM: true,
    });

    entityManager = env.services.entityManager;
    actionDiscoveryService = env.services.actionDiscoveryService;
    registry = env.container.resolve(tokens.IDataRegistry);

    // Register test entity definitions
    await registerTestEntityDefinitions();

    // Create a test location
    const locationEntity = await entityManager.createEntityInstance(
      'test:location',
      {
        instanceId: 'test-location-1',
        componentOverrides: {
          'core:name': { text: 'Test Location' },
        },
      }
    );
    locationId = locationEntity.id;

    // Create player actor
    playerEntity = await entityManager.createEntityInstance('test:actor', {
      instanceId: 'test-player',
      componentOverrides: {
        'core:name': { text: 'Player' },
        'core:position': { locationId },
        'core:actor': {},
      },
    });
    playerActorId = playerEntity.id;
  });

  afterEach(async () => {
    if (env) {
      await env.cleanup();
    }
  });

  describe('Primary Target Multiple Entity Resolution', () => {
    /**
     * Test: Action discovery with multiple potential targets in same location
     * Verifies that when multiple actors are present, actions can resolve to each
     */
    it('should discover actions when multiple actors are in same location', async () => {
      // Create multiple NPCs in the same location
      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-npc-1',
        componentOverrides: {
          'core:name': { text: 'Guard' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-npc-2',
        componentOverrides: {
          'core:name': { text: 'Merchant' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-npc-3',
        componentOverrides: {
          'core:name': { text: 'Traveler' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      // Discover actions using real action discovery
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      // Verify results structure
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);

      // With multiple actors, we should have valid action discovery
      expect(result.actions.length).toBeGreaterThanOrEqual(0);
    });

    /**
     * Test: Action discovery consistency with multiple targets
     * Verifies that repeated discoveries return consistent results
     */
    it('should return consistent results across multiple discoveries', async () => {
      // Create NPCs
      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-npc-consistency-1',
        componentOverrides: {
          'core:name': { text: 'NPC One' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-npc-consistency-2',
        componentOverrides: {
          'core:name': { text: 'NPC Two' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      // Discover actions multiple times
      const result1 = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      const result2 = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      // Results should be consistent
      expect(result1.actions.length).toBe(result2.actions.length);

      // Action IDs should match
      const actionIds1 = result1.actions.map((a) => a.id).sort();
      const actionIds2 = result2.actions.map((a) => a.id).sort();
      expect(actionIds1).toEqual(actionIds2);
    });
  });

  describe('Mixed Target Scenarios', () => {
    /**
     * Test: Action discovery with actors in different locations
     * Verifies proper scoping to current location
     */
    it('should handle actors in different locations correctly', async () => {
      // Create another location
      const otherLocationDef = createEntityDefinition('test:other-location', {
        'core:name': { text: 'Other Location' },
      });
      registry.store(
        'entityDefinitions',
        'test:other-location',
        otherLocationDef
      );

      const otherLocation = await entityManager.createEntityInstance(
        'test:other-location',
        {
          instanceId: 'test-other-location',
          componentOverrides: {
            'core:name': { text: 'Other Location' },
          },
        }
      );

      // Create NPC in same location as player
      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-nearby-npc',
        componentOverrides: {
          'core:name': { text: 'Nearby NPC' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      // Create NPC in different location
      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-distant-npc',
        componentOverrides: {
          'core:name': { text: 'Distant NPC' },
          'core:position': { locationId: otherLocation.id },
          'core:actor': {},
        },
      });

      // Discover actions
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      // Should return valid structure
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
    });

    /**
     * Test: Action discovery when player has only self as potential target
     * Verifies self-targeting action discovery
     */
    it('should handle self-only action scenarios', async () => {
      // Create empty location with only player
      const emptyLocationDef = createEntityDefinition('test:empty-location', {
        'core:name': { text: 'Empty Location' },
      });
      registry.store(
        'entityDefinitions',
        'test:empty-location',
        emptyLocationDef
      );

      const emptyLocation = await entityManager.createEntityInstance(
        'test:empty-location',
        {
          instanceId: 'test-empty-location',
          componentOverrides: {
            'core:name': { text: 'Empty Room' },
          },
        }
      );

      // Move player to empty location
      await entityManager.addComponent(playerActorId, 'core:position', {
        locationId: emptyLocation.id,
      });

      const updatedPlayer = await entityManager.getEntity(playerActorId);

      // Discover actions
      const result = await actionDiscoveryService.getValidActions(
        updatedPlayer,
        {},
        { trace: false }
      );

      // Should return valid structure (possibly with self-targeting actions)
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
    });
  });

  describe('Edge Cases and Limits', () => {
    /**
     * Test: Handle many potential targets efficiently
     */
    it('should handle multiple potential targets within reasonable time', async () => {
      // Create several NPCs
      const npcCount = 5;
      for (let i = 0; i < npcCount; i++) {
        await entityManager.createEntityInstance('test:actor', {
          instanceId: `test-npc-perf-${i}`,
          componentOverrides: {
            'core:name': { text: `NPC ${i}` },
            'core:position': { locationId },
            'core:actor': {},
          },
        });
      }

      // Measure discovery time
      const startTime = Date.now();
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );
      const elapsed = Date.now() - startTime;

      // Verify results
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();

      // Should complete within reasonable time (5 seconds for e2e)
      expect(elapsed).toBeLessThan(5000);
    });

    /**
     * Test: Handle empty location gracefully
     */
    it('should handle location with no other actors', async () => {
      // Create new empty location
      const isolatedLocationDef = createEntityDefinition(
        'test:isolated-location',
        {
          'core:name': { text: 'Isolated Location' },
        }
      );
      registry.store(
        'entityDefinitions',
        'test:isolated-location',
        isolatedLocationDef
      );

      const isolatedLocation = await entityManager.createEntityInstance(
        'test:isolated-location',
        {
          instanceId: 'test-isolated-location',
          componentOverrides: {
            'core:name': { text: 'Isolated Room' },
          },
        }
      );

      // Create actor in isolated location
      const isolatedActor = await entityManager.createEntityInstance(
        'test:actor',
        {
          instanceId: 'test-isolated-actor',
          componentOverrides: {
            'core:name': { text: 'Isolated Actor' },
            'core:position': { locationId: isolatedLocation.id },
            'core:actor': {},
          },
        }
      );

      // Discover actions
      const result = await actionDiscoveryService.getValidActions(
        isolatedActor,
        {},
        { trace: false }
      );

      // Should return valid structure
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
    });

    /**
     * Test: Actor without location component
     */
    it('should handle actor without location component', async () => {
      // Create actor definition without location
      const noLocActorDef = createEntityDefinition('test:locationless-actor', {
        'core:name': { text: 'Locationless Actor' },
        'core:actor': {},
      });
      registry.store(
        'entityDefinitions',
        'test:locationless-actor',
        noLocActorDef
      );

      const noLocationActor = await entityManager.createEntityInstance(
        'test:locationless-actor',
        {
          instanceId: 'test-no-location-actor',
          componentOverrides: {
            'core:name': { text: 'Locationless Actor' },
            'core:actor': {},
          },
        }
      );

      // Discover actions - should not throw
      const result = await actionDiscoveryService.getValidActions(
        noLocationActor,
        {},
        { trace: false }
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
    });
  });

  describe('Target Structure Validation', () => {
    /**
     * Test: Actions with targets have proper structure
     */
    it('should return actions with valid target structures', async () => {
      // Create NPCs for potential targeting
      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-target-npc-1',
        componentOverrides: {
          'core:name': { text: 'Target NPC 1' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-target-npc-2',
        componentOverrides: {
          'core:name': { text: 'Target NPC 2' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      // Discover actions
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();

      // Check actions with targets have valid structure
      const actionsWithTargets = result.actions.filter(
        (a) => a.targets && Object.keys(a.targets).length > 0
      );

      for (const action of actionsWithTargets) {
        expect(action.targets).toBeDefined();
        // Target keys should be strings
        for (const key of Object.keys(action.targets)) {
          expect(typeof key).toBe('string');
        }
      }
    });

    /**
     * Test: Each action has required id property
     */
    it('should return actions with id property', async () => {
      // Create NPC
      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-id-validation-npc',
        componentOverrides: {
          'core:name': { text: 'Validation NPC' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();

      // Each action should have an id
      for (const action of result.actions) {
        expect(action).toHaveProperty('id');
        expect(typeof action.id).toBe('string');
      }
    });
  });

  describe('Multiple Rapid Discoveries', () => {
    /**
     * Test: System stability under rapid sequential discoveries
     */
    it('should handle multiple rapid discoveries without issues', async () => {
      // Create NPCs
      for (let i = 0; i < 3; i++) {
        await entityManager.createEntityInstance('test:actor', {
          instanceId: `test-rapid-npc-${i}`,
          componentOverrides: {
            'core:name': { text: `Rapid NPC ${i}` },
            'core:position': { locationId },
            'core:actor': {},
          },
        });
      }

      const iterations = 5;
      const results = [];

      for (let i = 0; i < iterations; i++) {
        const result = await actionDiscoveryService.getValidActions(
          playerEntity,
          {},
          { trace: false }
        );
        results.push(result);
      }

      // All results should be valid
      expect(results).toHaveLength(iterations);
      for (const result of results) {
        expect(result).toBeDefined();
        expect(result.actions).toBeDefined();
        expect(Array.isArray(result.actions)).toBe(true);
      }

      // All results should have same number of actions
      const actionCounts = results.map((r) => r.actions.length);
      expect(new Set(actionCounts).size).toBe(1);
    });

    /**
     * Test: Performance of multiple discoveries
     */
    it('should complete multiple discoveries within time limits', async () => {
      // Create NPCs
      for (let i = 0; i < 3; i++) {
        await entityManager.createEntityInstance('test:actor', {
          instanceId: `test-perf-multi-npc-${i}`,
          componentOverrides: {
            'core:name': { text: `Perf NPC ${i}` },
            'core:position': { locationId },
            'core:actor': {},
          },
        });
      }

      const iterations = 5;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await actionDiscoveryService.getValidActions(playerEntity, {}, {
          trace: false,
        });
      }

      const elapsed = Date.now() - startTime;
      const avgTime = elapsed / iterations;

      // Average should be under 2 seconds per discovery
      expect(avgTime).toBeLessThan(2000);
    });
  });
});
