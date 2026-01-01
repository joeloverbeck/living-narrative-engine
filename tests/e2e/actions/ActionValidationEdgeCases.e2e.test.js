/**
 * @file End-to-end test for action validation edge cases
 * @description Comprehensive e2e tests validating action validation behavior
 * using real production services via e2eTestContainer.
 *
 * This test suite covers:
 * - Edge cases in action discovery and validation
 * - Handling of actors without required components
 * - Validation behavior with malformed or missing data
 * - System resilience under edge conditions
 *
 * NOTE: Migrated from mock facades to use real production services via e2eTestContainer.
 * Tests use manually registered entity definitions since core mod doesn't include them.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createE2ETestEnvironment } from '../common/e2eTestContainer.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

/**
 * E2E test suite for action validation edge cases
 * Tests the system's ability to handle various edge conditions gracefully
 */
describe('Action Validation Edge Cases E2E', () => {
  let env;
  let entityManager;
  let actionDiscoveryService;
  let eventBus;
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

    // Register minimal entity definition (no actor component)
    const minimalDef = createEntityDefinition('test:minimal', {
      'core:name': { text: 'Minimal Entity' },
    });
    registry.store('entityDefinitions', 'test:minimal', minimalDef);
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
    eventBus = env.services.eventBus;
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
        'core:name': { text: 'Test Player' },
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

  describe('Actor Without Location', () => {
    /**
     * Test: Actor without location component can still discover actions
     * Verifies that action discovery handles missing location gracefully
     */
    it('should handle actor without location component gracefully', async () => {
      // Create actor without location
      const noLocationActorDef = createEntityDefinition(
        'test:no-location-actor',
        {
          'core:name': { text: 'No Location Actor' },
          'core:actor': {},
        }
      );
      registry.store(
        'entityDefinitions',
        'test:no-location-actor',
        noLocationActorDef
      );

      const noLocationActor = await entityManager.createEntityInstance(
        'test:no-location-actor',
        {
          instanceId: 'test-no-location-actor',
          componentOverrides: {
            'core:name': { text: 'No Location Actor' },
            'core:actor': {},
          },
        }
      );

      // Action discovery should not throw
      const result = await actionDiscoveryService.getValidActions(
        noLocationActor,
        {},
        { trace: false }
      );

      // Should return valid structure
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
    });
  });

  describe('Entity Without Actor Component', () => {
    /**
     * Test: Entity without actor component handles action discovery
     * Verifies the system handles non-actor entities attempting action discovery
     */
    it('should handle entity without actor component', async () => {
      // Create a minimal entity without actor component
      const minimalEntity = await entityManager.createEntityInstance(
        'test:minimal',
        {
          instanceId: 'test-minimal',
          componentOverrides: {
            'core:name': { text: 'Minimal Entity' },
          },
        }
      );

      // Action discovery should handle this gracefully
      const result = await actionDiscoveryService.getValidActions(
        minimalEntity,
        {},
        { trace: false }
      );

      // Should return valid structure (possibly empty actions)
      expect(result).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
    });
  });

  describe('Empty Location Scenarios', () => {
    /**
     * Test: Actor in empty location can still perform self-actions
     */
    it('should handle actor in empty location', async () => {
      // Create empty location
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
            'core:name': { text: 'Empty Location' },
          },
        }
      );

      // Create actor in empty location
      const aloneActor = await entityManager.createEntityInstance(
        'test:actor',
        {
          instanceId: 'test-alone-actor',
          componentOverrides: {
            'core:name': { text: 'Alone Actor' },
            'core:position': { locationId: emptyLocation.id },
            'core:actor': {},
          },
        }
      );

      // Should discover actions without issues
      const result = await actionDiscoveryService.getValidActions(
        aloneActor,
        {},
        { trace: false }
      );

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
    });
  });

  describe('Multiple Sequential Discoveries', () => {
    /**
     * Test: Multiple rapid action discoveries in sequence
     * Verifies system stability under repeated calls
     */
    it('should handle multiple sequential action discoveries', async () => {
      const results = [];
      const iterations = 5;

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
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.actions).toBeDefined();
        expect(Array.isArray(result.actions)).toBe(true);
      });
    });

    /**
     * Test: Action discoveries return consistent results
     */
    it('should return consistent results across multiple discoveries', async () => {
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

      // Results should be structurally consistent
      expect(result1.actions.length).toBe(result2.actions.length);

      // Action IDs should match
      const actionIds1 = result1.actions.map((a) => a.id).sort();
      const actionIds2 = result2.actions.map((a) => a.id).sort();
      expect(actionIds1).toEqual(actionIds2);
    });
  });

  describe('Performance Under Edge Conditions', () => {
    /**
     * Test: Action discovery performance with empty location
     */
    it('should maintain performance with empty location', async () => {
      // Create empty location
      const emptyLocDef = createEntityDefinition('test:perf-empty-loc', {
        'core:name': { text: 'Perf Empty Location' },
      });
      registry.store(
        'entityDefinitions',
        'test:perf-empty-loc',
        emptyLocDef
      );

      const emptyLoc = await entityManager.createEntityInstance(
        'test:perf-empty-loc',
        {
          instanceId: 'test-perf-empty-loc',
          componentOverrides: {
            'core:name': { text: 'Perf Empty Location' },
          },
        }
      );

      // Move player to empty location
      await entityManager.addComponent(playerActorId, 'core:position', {
        locationId: emptyLoc.id,
      });

      const updatedPlayer = await entityManager.getEntity(playerActorId);

      const iterations = 10;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await actionDiscoveryService.getValidActions(
          updatedPlayer,
          {},
          { trace: false }
        );
      }

      const elapsed = Date.now() - startTime;
      const avgTime = elapsed / iterations;

      // Should complete quickly even with edge conditions
      expect(avgTime).toBeLessThan(500); // Under 500ms per discovery
    });
  });

  describe('Event Bus Integration', () => {
    /**
     * Test: Event bus remains functional during action discovery
     */
    it('should have functional event bus during discovery', async () => {
      // Verify event bus works
      expect(eventBus).toBeDefined();
      expect(typeof eventBus.dispatch).toBe('function');

      // Discover actions (should not throw)
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      expect(result).toBeDefined();

      // Event bus should still be functional after discovery
      expect(typeof eventBus.dispatch).toBe('function');
    });

    /**
     * Test: Multiple actors can discover actions without event bus conflicts
     */
    it('should handle multiple actors discovering actions', async () => {
      // Create additional actors
      const npc1 = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-npc-1',
        componentOverrides: {
          'core:name': { text: 'NPC 1' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      const npc2 = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-npc-2',
        componentOverrides: {
          'core:name': { text: 'NPC 2' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      // All actors should be able to discover actions
      const playerResult = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      const npc1Result = await actionDiscoveryService.getValidActions(
        npc1,
        {},
        { trace: false }
      );

      const npc2Result = await actionDiscoveryService.getValidActions(
        npc2,
        {},
        { trace: false }
      );

      expect(playerResult).toBeDefined();
      expect(npc1Result).toBeDefined();
      expect(npc2Result).toBeDefined();

      expect(Array.isArray(playerResult.actions)).toBe(true);
      expect(Array.isArray(npc1Result.actions)).toBe(true);
      expect(Array.isArray(npc2Result.actions)).toBe(true);
    });
  });

  describe('Entity State Changes', () => {
    /**
     * Test: Action discovery after entity location change
     */
    it('should handle entity location changes', async () => {
      // Initial discovery
      const initialResult = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );
      expect(initialResult).toBeDefined();

      // Create new location
      const newLocDef = createEntityDefinition('test:new-location', {
        'core:name': { text: 'New Location' },
      });
      registry.store('entityDefinitions', 'test:new-location', newLocDef);

      const newLocation = await entityManager.createEntityInstance(
        'test:new-location',
        {
          instanceId: 'test-new-location',
          componentOverrides: {
            'core:name': { text: 'New Location' },
          },
        }
      );

      // Move player to new location
      await entityManager.addComponent(playerActorId, 'core:position', {
        locationId: newLocation.id,
      });

      const updatedPlayer = await entityManager.getEntity(playerActorId);

      // Discovery after move should work
      const afterMoveResult = await actionDiscoveryService.getValidActions(
        updatedPlayer,
        {},
        { trace: false }
      );

      expect(afterMoveResult).toBeDefined();
      expect(Array.isArray(afterMoveResult.actions)).toBe(true);
    });
  });

  describe('Result Structure Validation', () => {
    /**
     * Test: Action discovery result has expected structure
     */
    it('should return properly structured results', async () => {
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      // Validate result structure
      expect(result).toBeDefined();
      expect(result).toHaveProperty('actions');
      expect(Array.isArray(result.actions)).toBe(true);

      // Each action should have basic structure
      for (const action of result.actions) {
        expect(action).toHaveProperty('id');
        expect(typeof action.id).toBe('string');
      }
    });

    /**
     * Test: Actions with targets have proper target structure
     */
    it('should return actions with valid target structures', async () => {
      // Create NPC for potential targeting
      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-target-npc',
        componentOverrides: {
          'core:name': { text: 'Target NPC' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      // Check actions with targets
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
  });
});
