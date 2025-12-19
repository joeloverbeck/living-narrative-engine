/**
 * @file Integration test for park bench component indexing issue
 * Tests that entities with components from definitions are properly indexed
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import Entity from '../../../src/entities/entity.js';
import EntityRepositoryAdapter from '../../../src/entities/services/entityRepositoryAdapter.js';
import EntityQueryManager from '../../../src/entities/managers/EntityQueryManager.js';
import { MapManager } from '../../../src/utils/mapManagerUtils.js';
import { createTestBed } from '../../common/testBed.js';

describe('Park Bench Component Indexing - Integration', () => {
  let testBed;
  let entityRepository;
  let entityQueryManager;
  let logger;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.createMockLogger();

    // Create repository
    entityRepository = new EntityRepositoryAdapter({
      mapManager: new MapManager(),
      logger,
    });

    // Create query manager
    entityQueryManager = new EntityQueryManager({
      entityRepository,
      logger,
    });
  });

  describe('Component indexing from entity definitions', () => {
    it('should properly index sitting:allows_sitting component from park bench definition', () => {
      // Create park bench definition with sitting:allows_sitting component
      const parkBenchDefinition = new EntityDefinition('p_erotica:park_bench', {
        name: 'Park Bench',
        description: 'A simple park bench',
        components: {
          'core:name': { value: 'Park Bench' },
          'core:description': { value: 'A wooden park bench' },
          'core:position': { locationId: 'test_location' },
          'sitting:allows_sitting': {
            spots: [null, null], // Two available spots
          },
        },
      });

      // Create park bench instance data
      const parkBenchInstanceData = new EntityInstanceData(
        'p_erotica:park_bench_instance',
        parkBenchDefinition,
        {} // No overrides
      );

      // Verify the instance data has the component
      expect(
        parkBenchInstanceData.hasComponent('sitting:allows_sitting')
      ).toBe(true);
      expect(parkBenchInstanceData.allComponentTypeIds).toContain(
        'sitting:allows_sitting'
      );

      // Create entity from instance data
      const parkBenchEntity = new Entity(parkBenchInstanceData);

      // Verify the entity has the component in its componentTypeIds
      expect(parkBenchEntity.componentTypeIds).toContain(
        'sitting:allows_sitting'
      );
      expect(parkBenchEntity.hasComponent('sitting:allows_sitting')).toBe(
        true
      );

      // Add entity to repository
      entityRepository.add(parkBenchEntity);

      // Verify the component index was updated
      const entitiesWithAllowsSitting =
        entityRepository.getEntityIdsByComponent('sitting:allows_sitting');
      expect(entitiesWithAllowsSitting).toBeInstanceOf(Set);
      expect(entitiesWithAllowsSitting.size).toBe(1);
      expect(
        entitiesWithAllowsSitting.has('p_erotica:park_bench_instance')
      ).toBe(true);

      // Verify EntityQueryManager can find the entity
      const foundEntities = entityQueryManager.getEntitiesWithComponent(
        'sitting:allows_sitting'
      );
      expect(foundEntities).toHaveLength(1);
      expect(foundEntities[0].id).toBe('p_erotica:park_bench_instance');
    });

    it('should index multiple entities with the same component', () => {
      // Create definition for furniture that allows sitting
      const furnitureDefinition = new EntityDefinition('test:furniture', {
        name: 'Furniture',
        description: 'Generic furniture',
        components: {
          'sitting:allows_sitting': {
            spots: [null],
          },
        },
      });

      // Create multiple furniture instances
      const chair1 = new Entity(
        new EntityInstanceData('chair_1', furnitureDefinition, {})
      );

      const chair2 = new Entity(
        new EntityInstanceData('chair_2', furnitureDefinition, {})
      );

      // Add both to repository
      entityRepository.add(chair1);
      entityRepository.add(chair2);

      // Verify both are indexed
      const entitiesWithAllowsSitting =
        entityRepository.getEntityIdsByComponent('sitting:allows_sitting');
      expect(entitiesWithAllowsSitting.size).toBe(2);
      expect(entitiesWithAllowsSitting.has('chair_1')).toBe(true);
      expect(entitiesWithAllowsSitting.has('chair_2')).toBe(true);

      // Verify query manager finds both
      const foundEntities = entityQueryManager.getEntitiesWithComponent(
        'sitting:allows_sitting'
      );
      expect(foundEntities).toHaveLength(2);
      const foundIds = foundEntities.map((e) => e.id).sort();
      expect(foundIds).toEqual(['chair_1', 'chair_2']);
    });

    it('should handle entities with component overrides', () => {
      // Create park bench definition
      const parkBenchDefinition = new EntityDefinition('test:park_bench', {
        name: 'Park Bench',
        description: 'A park bench',
        components: {
          'sitting:allows_sitting': {
            spots: [null, null],
          },
        },
      });

      // Create instance with override that changes the spots
      const benchWithOverride = new Entity(
        new EntityInstanceData('bench_override', parkBenchDefinition, {
          'sitting:allows_sitting': {
            spots: [null, null, null], // Three spots instead of two
          },
        })
      );

      // Add to repository
      entityRepository.add(benchWithOverride);

      // Verify it's indexed
      const entitiesWithAllowsSitting =
        entityRepository.getEntityIdsByComponent('sitting:allows_sitting');
      expect(entitiesWithAllowsSitting.has('bench_override')).toBe(true);

      // Verify the override data is used
      const componentData = benchWithOverride.getComponentData(
        'sitting:allows_sitting'
      );
      expect(componentData.spots).toHaveLength(3);
    });

    it('should not index entities without the component', () => {
      // Create definition without sitting:allows_sitting
      const tableDefinition = new EntityDefinition('test:table', {
        name: 'Table',
        description: 'A table',
        components: {
          'core:name': { value: 'Table' },
        },
      });

      const table = new Entity(
        new EntityInstanceData('table_1', tableDefinition, {})
      );

      // Add to repository
      entityRepository.add(table);

      // Verify it's not in the sitting:allows_sitting index
      const entitiesWithAllowsSitting =
        entityRepository.getEntityIdsByComponent('sitting:allows_sitting');
      expect(entitiesWithAllowsSitting.has('table_1')).toBe(false);

      // Verify query manager doesn't find it
      const foundEntities = entityQueryManager.getEntitiesWithComponent(
        'sitting:allows_sitting'
      );
      expect(foundEntities.every((e) => e.id !== 'table_1')).toBe(true);
    });

    it('should handle component removal from index when entity is removed', () => {
      // Create and add entity with component
      const benchDefinition = new EntityDefinition('test:bench', {
        name: 'Bench',
        description: 'A bench',
        components: {
          'sitting:allows_sitting': { spots: [null] },
        },
      });

      const bench = new Entity(
        new EntityInstanceData('bench_to_remove', benchDefinition, {})
      );

      entityRepository.add(bench);

      // Verify it's indexed
      let entitiesWithAllowsSitting = entityRepository.getEntityIdsByComponent(
        'sitting:allows_sitting'
      );
      expect(entitiesWithAllowsSitting.has('bench_to_remove')).toBe(true);

      // Remove the entity
      entityRepository.remove('bench_to_remove');

      // Verify it's removed from index
      entitiesWithAllowsSitting = entityRepository.getEntityIdsByComponent(
        'sitting:allows_sitting'
      );
      expect(entitiesWithAllowsSitting.has('bench_to_remove')).toBe(false);
    });
  });

  describe('Scope resolution with indexed components', () => {
    it('should find entities with specific components for scope resolution', () => {
      // This simulates what the scope engine would do
      // Create multiple entities, some with the component
      const sittableDefinition = new EntityDefinition('test:sittable', {
        name: 'Sittable',
        description: 'Something you can sit on',
        components: {
          'core:position': { locationId: 'park' },
          'sitting:allows_sitting': { spots: [null] },
        },
      });

      const nonSittableDefinition = new EntityDefinition('test:non_sittable', {
        name: 'Non-Sittable',
        description: 'Something you cannot sit on',
        components: {
          'core:position': { locationId: 'park' },
        },
      });

      // Add entities
      const bench = new Entity(
        new EntityInstanceData('bench', sittableDefinition, {})
      );
      const chair = new Entity(
        new EntityInstanceData('chair', sittableDefinition, {})
      );
      const tree = new Entity(
        new EntityInstanceData('tree', nonSittableDefinition, {})
      );

      entityRepository.add(bench);
      entityRepository.add(chair);
      entityRepository.add(tree);

      // Simulate scope resolution: find all entities with sitting:allows_sitting
      const sittableEntities = entityQueryManager.getEntitiesWithComponent(
        'sitting:allows_sitting'
      );

      // Should find bench and chair, but not tree
      expect(sittableEntities).toHaveLength(2);
      const sittableIds = sittableEntities.map((e) => e.id).sort();
      expect(sittableIds).toEqual(['bench', 'chair']);

      // Verify all found entities have the component
      for (const entity of sittableEntities) {
        expect(entity.hasComponent('sitting:allows_sitting')).toBe(true);
        expect(entity.hasComponent('core:position')).toBe(true);
      }
    });
  });
});
