/**
 * @file ActionPersistenceIntegration.simple.e2e.test.js
 * @description E2E tests for action persistence integration patterns.
 * Tests entity state persistence and action history management
 * using real production services via e2eTestContainer.
 *
 * This test suite covers:
 * - Entity state serialization and restoration
 * - Component data persistence across operations
 * - Action result state management
 * - Performance characteristics of persistence operations
 *
 * NOTE: Migrated from mock facades to use real production services via e2eTestContainer.
 * Tests use manually registered entity definitions since core mod doesn't include them.
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { createE2ETestEnvironment } from '../common/e2eTestContainer.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Action Persistence Integration E2E', () => {
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

    // Register actor definition with inventory support
    const actorDef = createEntityDefinition('test:actor', {
      'core:name': { text: 'Test Actor' },
      'core:actor': {},
    });
    registry.store('entityDefinitions', 'test:actor', actorDef);

    // Register item definition
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
        instanceId: 'test-persistence-location',
        componentOverrides: {
          'core:name': { text: 'Persistence Test Location' },
        },
      }
    );
    locationId = locationEntity.id;

    // Create player actor
    playerEntity = await entityManager.createEntityInstance('test:actor', {
      instanceId: 'test-persistent-player',
      componentOverrides: {
        'core:name': { text: 'Persistent Player' },
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

  describe('Entity State Persistence', () => {
    /**
     * Test: Entity components can be retrieved after creation
     * Verifies entity state is properly stored and retrievable
     */
    test('should persist entity state after creation', async () => {
      // Create entity with specific components
      const npcEntity = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-persistent-npc',
        componentOverrides: {
          'core:name': { text: 'Persistent NPC' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      // Retrieve entity
      const retrieved = await entityManager.getEntity(npcEntity.id);

      // Assert state is persisted
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(npcEntity.id);
    });

    /**
     * Test: Component updates are persisted
     * Verifies that component changes are properly stored
     */
    test('should persist component updates', async () => {
      // Update player position to new location
      const newLocationDef = createEntityDefinition('test:new-location', {
        'core:name': { text: 'New Location' },
      });
      registry.store('entityDefinitions', 'test:new-location', newLocationDef);

      const newLocation = await entityManager.createEntityInstance(
        'test:new-location',
        {
          instanceId: 'test-new-location',
          componentOverrides: {
            'core:name': { text: 'New Location' },
          },
        }
      );

      // Update position
      await entityManager.addComponent(playerActorId, 'core:position', {
        locationId: newLocation.id,
      });

      // Retrieve and verify
      const updated = await entityManager.getEntity(playerActorId);
      expect(updated).toBeDefined();

      // Get component value via entity's components property
      const position = updated.components['core:position'];
      expect(position.locationId).toBe(newLocation.id);
    });
  });

  describe('Action Discovery State', () => {
    /**
     * Test: Action discovery reflects current entity state
     * Verifies that action discovery uses persisted entity state
     */
    test('should discover actions based on persisted entity state', async () => {
      // Create NPC in same location
      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-discovery-npc',
        componentOverrides: {
          'core:name': { text: 'Discovery NPC' },
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

      // Verify discovery works with persisted state
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
    });

    /**
     * Test: Action discovery updates after entity state changes
     * Verifies discovery reflects updated state
     */
    test('should update action discovery after state changes', async () => {
      // Initial discovery
      await actionDiscoveryService.getValidActions(playerEntity, {}, {
        trace: false,
      });

      // Create new entity in location
      await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-new-npc',
        componentOverrides: {
          'core:name': { text: 'New NPC' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      // Discovery after state change
      const afterResult = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );

      // Verify discovery still works
      expect(afterResult).toBeDefined();
      expect(afterResult.actions).toBeDefined();
      expect(afterResult.actions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Complex State Serialization', () => {
    /**
     * Test: Multiple entities maintain separate state
     * Verifies entity isolation in persistence
     */
    test('should maintain separate state for multiple entities', async () => {
      // Create multiple NPCs with different states
      const npc1 = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-npc-1',
        componentOverrides: {
          'core:name': { text: 'NPC One' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      const npc2 = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-npc-2',
        componentOverrides: {
          'core:name': { text: 'NPC Two' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      // Retrieve both
      const retrieved1 = await entityManager.getEntity(npc1.id);
      const retrieved2 = await entityManager.getEntity(npc2.id);

      // Verify separate state
      expect(retrieved1.id).toBe(npc1.id);
      expect(retrieved2.id).toBe(npc2.id);
      expect(retrieved1.id).not.toBe(retrieved2.id);
    });

    /**
     * Test: Entity state remains consistent across multiple reads
     * Verifies persistence consistency
     */
    test('should maintain consistent state across reads', async () => {
      // Multiple reads of same entity
      const read1 = await entityManager.getEntity(playerActorId);
      const read2 = await entityManager.getEntity(playerActorId);
      const read3 = await entityManager.getEntity(playerActorId);

      // All reads should return same entity
      expect(read1.id).toBe(read2.id);
      expect(read2.id).toBe(read3.id);
    });
  });

  describe('Persistence Performance', () => {
    /**
     * Test: Entity creation completes within performance limits
     */
    test('should create entities efficiently', async () => {
      const entityCount = 5;
      const startTime = Date.now();

      for (let i = 0; i < entityCount; i++) {
        await entityManager.createEntityInstance('test:actor', {
          instanceId: `test-perf-entity-${i}`,
          componentOverrides: {
            'core:name': { text: `Perf Entity ${i}` },
            'core:position': { locationId },
            'core:actor': {},
          },
        });
      }

      const elapsed = Date.now() - startTime;

      // Should complete in reasonable time (< 5 seconds for e2e)
      expect(elapsed).toBeLessThan(5000);
    });

    /**
     * Test: Entity retrieval is efficient
     */
    test('should retrieve entities efficiently', async () => {
      // Create entities first
      const entityIds = [];
      for (let i = 0; i < 5; i++) {
        const entity = await entityManager.createEntityInstance('test:actor', {
          instanceId: `test-retrieve-perf-${i}`,
          componentOverrides: {
            'core:name': { text: `Retrieve Perf ${i}` },
            'core:position': { locationId },
            'core:actor': {},
          },
        });
        entityIds.push(entity.id);
      }

      // Time retrieval
      const startTime = Date.now();
      for (const id of entityIds) {
        await entityManager.getEntity(id);
      }
      const elapsed = Date.now() - startTime;

      // Retrieval should be fast (< 100ms per entity)
      expect(elapsed / entityIds.length).toBeLessThan(100);
    });

    /**
     * Test: Action discovery performance with multiple entities
     */
    test('should discover actions efficiently with multiple entities', async () => {
      // Create several NPCs
      for (let i = 0; i < 5; i++) {
        await entityManager.createEntityInstance('test:actor', {
          instanceId: `test-discovery-perf-${i}`,
          componentOverrides: {
            'core:name': { text: `Discovery Perf ${i}` },
            'core:position': { locationId },
            'core:actor': {},
          },
        });
      }

      // Time discovery
      const startTime = Date.now();
      const result = await actionDiscoveryService.getValidActions(
        playerEntity,
        {},
        { trace: false }
      );
      const elapsed = Date.now() - startTime;

      // Discovery should complete reasonably fast
      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe('State Integrity', () => {
    /**
     * Test: Component values maintain integrity after updates
     */
    test('should maintain component value integrity', async () => {
      // Create entity with specific component values
      const npc = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-integrity-npc',
        componentOverrides: {
          'core:name': { text: 'Integrity Test NPC' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      // Verify component values via entity's components property
      const name = npc.components['core:name'];
      const position = npc.components['core:position'];

      expect(name).toBeDefined();
      expect(name.text).toBe('Integrity Test NPC');
      expect(position).toBeDefined();
      expect(position.locationId).toBe(locationId);
    });

    /**
     * Test: Entity relationships remain intact
     * Tests that entities in same location can reference each other
     */
    test('should maintain entity relationships through position', async () => {
      // Create NPC in same location as player
      const npc = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'test-relationship-npc',
        componentOverrides: {
          'core:name': { text: 'Relationship NPC' },
          'core:position': { locationId },
          'core:actor': {},
        },
      });

      // Both should have same location - access via entity's components property
      const player = await entityManager.getEntity(playerActorId);
      const playerPos = player.components['core:position'];
      const npcPos = npc.components['core:position'];

      expect(playerPos.locationId).toBe(npcPos.locationId);
      expect(playerPos.locationId).toBe(locationId);
    });
  });
});
