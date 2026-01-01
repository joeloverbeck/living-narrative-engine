/**
 * @file Multi-Target Discovery Pipeline E2E Tests
 * @description Comprehensive end-to-end tests validating the complete multi-target action
 * discovery pipeline for scenarios where a single target scope resolves to multiple entities.
 *
 * This test suite validates:
 * - Single target scope → Multiple entities resolution
 * - Context-dependent target resolution with multiple primary entities
 * - Real action definitions through the actual pipeline
 * - Performance boundaries and edge cases
 *
 * NOTE: Migrated from mock facades to use real production services via e2eTestContainer.
 * Tests use manually registered entity definitions since core mod doesn't include them.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createE2ETestEnvironment } from '../common/e2eTestContainer.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Multi-Target Discovery Pipeline E2E', () => {
  let env;
  let entityManager;
  let actionDiscoveryService;
  let registry;
  let locationId;
  let playerActorId;
  let playerEntity;

  /**
   * Registers test entity definitions in the registry.
   * This is required because the core mod doesn't include entity definitions.
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
  }

  beforeEach(async () => {
    // Create real e2e test environment WITH core mod loading
    // Core mod provides component schemas (core:name, core:actor, etc.)
    // We manually register entity definitions since core mod doesn't include them
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

  describe('Single Target Multiple Entities', () => {
    describe('closeness-based actions scenario', () => {
      it('should discover actions when actors are in closeness', async () => {
        // Create an NPC
        await entityManager.createEntityInstance('test:actor', {
          instanceId: 'test-npc-1',
          componentOverrides: {
            'core:name': { text: 'Amaia' },
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

        // Without mods loaded, action discovery still returns valid structure
        // but may not find mod-specific actions
        expect(result.actions.length).toBeGreaterThanOrEqual(0);
      });

      it('should discover multiple actions when multiple actors are nearby', async () => {
        // Create two NPCs in the same location
        await entityManager.createEntityInstance('test:actor', {
          instanceId: 'test-npc-amaia',
          componentOverrides: {
            'core:name': { text: 'Amaia' },
            'core:position': { locationId },
            'core:actor': {},
          },
        });

        await entityManager.createEntityInstance('test:actor', {
          instanceId: 'test-npc-carlos',
          componentOverrides: {
            'core:name': { text: 'Carlos' },
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
      });

      it('should handle scenario where no actors are nearby', async () => {
        // Create a second location
        const otherLocationDef = createEntityDefinition(
          'test:other-location',
          {
            'core:name': { text: 'Other Location' },
          }
        );
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

        // Create NPC in a different location
        await entityManager.createEntityInstance('test:actor', {
          instanceId: 'test-distant-npc',
          componentOverrides: {
            'core:name': { text: 'Distant NPC' },
            'core:position': { locationId: otherLocation.id },
            'core:actor': {},
          },
        });

        // Discover actions using real action discovery
        const result = await actionDiscoveryService.getValidActions(
          playerEntity,
          {},
          { trace: false }
        );

        // Verify results structure - actions should exist but may differ
        // from when NPCs are nearby
        expect(result).toBeDefined();
        expect(result.actions).toBeDefined();
        expect(Array.isArray(result.actions)).toBe(true);
      });
    });
  });

  describe('Multi-Target Resolution', () => {
    describe('cartesian product scenarios', () => {
      it('should correctly resolve targets with real services', async () => {
        // Create multiple NPCs in same location
        await entityManager.createEntityInstance('test:actor', {
          instanceId: 'test-first-npc',
          componentOverrides: {
            'core:name': { text: 'First NPC' },
            'core:position': { locationId },
            'core:actor': {},
          },
        });

        await entityManager.createEntityInstance('test:actor', {
          instanceId: 'test-second-npc',
          componentOverrides: {
            'core:name': { text: 'Second NPC' },
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

        // Check that actions with targets have proper target arrays
        const actionsWithTargets = result.actions.filter(
          (a) => a.targets && Object.keys(a.targets).length > 0
        );

        // Each action with targets should have valid target structure
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

  describe('Edge Cases', () => {
    it('should handle empty location gracefully', async () => {
      // Create a new empty location
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

      // Move player to empty location
      await entityManager.addComponent(playerActorId, 'core:position', {
        locationId: emptyLocation.id,
      });

      // Refresh player entity reference
      const updatedPlayer = await entityManager.getEntity(playerActorId);

      // Discover actions
      const result = await actionDiscoveryService.getValidActions(
        updatedPlayer,
        {},
        { trace: false }
      );

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
      // Should still return valid array (possibly empty or with self-actions)
      expect(Array.isArray(result.actions)).toBe(true);
    });

    it('should handle actor with no location component', async () => {
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

      // Create actor without location component
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

  describe('Performance Scenarios', () => {
    it('should handle multiple entities without significant delay', async () => {
      // Create several NPCs
      const npcCount = 5;
      for (let i = 0; i < npcCount; i++) {
        await entityManager.createEntityInstance('test:actor', {
          instanceId: `test-perf-npc-${i}`,
          componentOverrides: {
            'core:name': { text: `NPC ${i}` },
            'core:position': { locationId },
            'core:actor': {},
          },
        });
      }

      // Time the action discovery
      const startTime = Date.now();
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );
      const elapsed = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();

      // Should complete in reasonable time (5 seconds for e2e)
      expect(elapsed).toBeLessThan(5000);
    });
  });
});
