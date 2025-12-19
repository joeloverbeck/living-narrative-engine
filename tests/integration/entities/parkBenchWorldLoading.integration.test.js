/**
 * @file Integration test for park bench loading from world data
 * Tests that park bench entity loaded from world data is properly indexed
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import Entity from '../../../src/entities/entity.js';
import EntityRepositoryAdapter from '../../../src/entities/services/entityRepositoryAdapter.js';
import EntityQueryManager from '../../../src/entities/managers/EntityQueryManager.js';
import { MapManager } from '../../../src/utils/mapManagerUtils.js';
import { createTestBed } from '../../common/testBed.js';

describe('Park Bench World Loading - Integration', () => {
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

  describe('World loading simulation', () => {
    it('should index park bench with sitting:allows_sitting when loaded from world data', () => {
      // Step 1: Load entity definition (simulating what entityDefinitionLoader does)
      const parkBenchDefinition = new EntityDefinition('p_erotica:park_bench', {
        name: 'Park Bench',
        description: 'A simple park bench',
        components: {
          'core:name': { value: 'Park Bench' },
          'core:description': { value: 'A wooden park bench' },
          'sitting:allows_sitting': {
            spots: [null, null], // Two available spots
          },
        },
      });

      // Step 2: Create entity instance from world data (simulating worldInitializer)
      // This simulates loading from park_bench.entity.json with only position override
      const componentOverrides = {
        'core:position': { locationId: 'p_erotica:park_instance' },
      };

      const parkBenchInstanceData = new EntityInstanceData(
        'p_erotica:park_bench_instance',
        parkBenchDefinition,
        componentOverrides,
        logger
      );

      // Verify instance data has the component from definition
      expect(
        parkBenchInstanceData.hasComponent('sitting:allows_sitting')
      ).toBe(true);
      expect(parkBenchInstanceData.allComponentTypeIds).toContain(
        'sitting:allows_sitting'
      );

      // Step 3: Create entity wrapper
      const parkBenchEntity = new Entity(parkBenchInstanceData);

      // Verify entity has the component
      expect(parkBenchEntity.componentTypeIds).toContain(
        'sitting:allows_sitting'
      );
      expect(parkBenchEntity.hasComponent('sitting:allows_sitting')).toBe(
        true
      );

      // Get the actual component data
      const allowsSittingData = parkBenchEntity.getComponentData(
        'sitting:allows_sitting'
      );
      expect(allowsSittingData).toBeDefined();
      expect(allowsSittingData.spots).toEqual([null, null]);

      // Step 4: Add entity to repository (simulating EntityLifecycleManager)
      entityRepository.add(parkBenchEntity);

      // Step 5: Verify the component index was updated
      const entitiesWithAllowsSitting =
        entityRepository.getEntityIdsByComponent('sitting:allows_sitting');
      expect(entitiesWithAllowsSitting).toBeInstanceOf(Set);
      expect(entitiesWithAllowsSitting.size).toBe(1);
      expect(
        entitiesWithAllowsSitting.has('p_erotica:park_bench_instance')
      ).toBe(true);

      // Step 6: Verify EntityQueryManager can find the entity (simulating scope resolution)
      const foundEntities = entityQueryManager.getEntitiesWithComponent(
        'sitting:allows_sitting'
      );
      expect(foundEntities).toHaveLength(1);
      expect(foundEntities[0].id).toBe('p_erotica:park_bench_instance');

      // Step 7: Verify the found entity has the correct component data
      const foundEntity = foundEntities[0];
      expect(foundEntity.hasComponent('sitting:allows_sitting')).toBe(true);
      expect(
        foundEntity.getComponentData('sitting:allows_sitting')
      ).toEqual({
        spots: [null, null],
      });

      // Step 8: Verify position override was applied
      expect(foundEntity.hasComponent('core:position')).toBe(true);
      expect(foundEntity.getComponentData('core:position')).toEqual({
        locationId: 'p_erotica:park_instance',
      });
    });

    it('should handle entities with only overrides (no definition components)', () => {
      // Create an entity that only has override components
      const minimalDefinition = new EntityDefinition('test:minimal', {
        name: 'Minimal',
        description: 'Minimal entity',
        components: {}, // No components in definition
      });

      const instanceData = new EntityInstanceData(
        'test:minimal_instance',
        minimalDefinition,
        {
          'sitting:allows_sitting': { spots: [null] },
          'core:position': { locationId: 'test_location' },
        },
        logger
      );

      const entity = new Entity(instanceData);

      // Verify entity has the override components
      expect(entity.componentTypeIds).toContain('sitting:allows_sitting');
      expect(entity.componentTypeIds).toContain('core:position');

      // Add to repository
      entityRepository.add(entity);

      // Verify indexing works for override components
      const entitiesWithAllowsSitting =
        entityRepository.getEntityIdsByComponent('sitting:allows_sitting');
      expect(entitiesWithAllowsSitting.has('test:minimal_instance')).toBe(true);
    });
  });
});
