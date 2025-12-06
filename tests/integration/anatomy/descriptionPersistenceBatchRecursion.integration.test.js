/**
 * @file Integration test for batch description persistence to prevent recursion warnings
 * @description Verifies that updateMultipleDescriptions uses batch operations to avoid
 * deep recursion chains when generating descriptions for recipes with many body parts
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { DescriptionPersistenceService } from '../../../src/anatomy/DescriptionPersistenceService.js';
import { DESCRIPTION_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import EntityManagerIntegrationTestBed from '../../common/entities/entityManagerIntegrationTestBed.js';
import { buildEntityDefinition } from '../../common/entities/index.js';

describe('DescriptionPersistenceService - Batch Operation Recursion Prevention', () => {
  let testBed;
  let descriptionPersistenceService;
  let entityManager;
  let batchAddSpy;

  beforeEach(() => {
    testBed = new EntityManagerIntegrationTestBed();
    entityManager = testBed.entityManager;

    // Register test entity definition
    const testEntityDef = buildEntityDefinition('test:entity', {
      components: [],
    });
    testBed.registry.store('entityDefinitions', 'test:entity', testEntityDef);

    descriptionPersistenceService = new DescriptionPersistenceService({
      logger: testBed.logger,
      entityManager: entityManager,
    });

    // Spy on batch operation to verify it's used
    batchAddSpy = jest.spyOn(entityManager, 'batchAddComponentsOptimized');
  });

  afterEach(async () => {
    if (batchAddSpy) {
      batchAddSpy.mockRestore();
    }
    await testBed.cleanup();
  });

  describe('Large batch updates (simulating writhing_observer)', () => {
    it('should use batch operation for 50+ entities without triggering recursion warnings', async () => {
      // Create test entities simulating a creature with many body parts
      const entityIds = [];
      const descriptionsMap = new Map();

      // Create 50 entities (similar to writhing_observer with many surface eyes, tentacles, etc.)
      for (let i = 1; i <= 50; i++) {
        await entityManager.createEntityInstance('test:entity', {
          instanceId: `part_${i}`,
        });
        const entityId = `part_${i}`;
        entityIds.push(entityId);
        descriptionsMap.set(entityId, `Description for body part ${i}`);
      }

      // Update all descriptions in batch
      const result =
        await descriptionPersistenceService.updateMultipleDescriptions(
          descriptionsMap
        );

      // Verify all updates succeeded
      expect(result.successful).toBe(50);
      expect(result.failed).toEqual([]);

      // Verify batch operation was called instead of individual adds
      expect(batchAddSpy).toHaveBeenCalledTimes(1);
      expect(batchAddSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            instanceId: expect.stringContaining('part_'),
            componentTypeId: DESCRIPTION_COMPONENT_ID,
          }),
        ]),
        true // emitBatchEvent flag
      );

      // Verify all entities have descriptions
      for (const entityId of entityIds) {
        const entity = entityManager.getEntityInstance(entityId);
        expect(entity.hasComponent(DESCRIPTION_COMPONENT_ID)).toBe(true);
        const descData = entity.getComponentData(DESCRIPTION_COMPONENT_ID);
        expect(descData.text).toContain('Description for body part');
      }

      // Cleanup
      for (const entityId of entityIds) {
        entityManager.removeEntityInstance(entityId);
      }
    });

    it('should maintain performance with 100+ entities', async () => {
      const entityIds = [];
      const descriptionsMap = new Map();

      // Create 100 entities to stress test
      for (let i = 1; i <= 100; i++) {
        await entityManager.createEntityInstance('test:entity', {
          instanceId: `large_part_${i}`,
        });
        const entityId = `large_part_${i}`;
        entityIds.push(entityId);
        descriptionsMap.set(entityId, `Description for large part ${i}`);
      }

      const startTime = performance.now();
      const result =
        await descriptionPersistenceService.updateMultipleDescriptions(
          descriptionsMap
        );
      const duration = performance.now() - startTime;

      // Verify updates succeeded
      expect(result.successful).toBe(100);
      expect(result.failed).toEqual([]);

      // Batch operation should be fast (< 100ms for 100 entities)
      expect(duration).toBeLessThan(100);

      // Verify only one batch operation was called
      expect(batchAddSpy).toHaveBeenCalledTimes(1);

      // Cleanup
      for (const entityId of entityIds) {
        entityManager.removeEntityInstance(entityId);
      }
    });

    it('should handle mixed success/failure scenarios in batch', async () => {
      const entityIds = [];
      const descriptionsMap = new Map();

      // Create 10 valid entities
      for (let i = 1; i <= 10; i++) {
        await entityManager.createEntityInstance('test:entity', {
          instanceId: `valid_part_${i}`,
        });
        const entityId = `valid_part_${i}`;
        entityIds.push(entityId);
        descriptionsMap.set(entityId, `Description for valid part ${i}`);
      }

      // Add 3 non-existent entities to the map
      descriptionsMap.set('non_existent_1', 'Invalid description 1');
      descriptionsMap.set('non_existent_2', 'Invalid description 2');
      descriptionsMap.set('non_existent_3', 'Invalid description 3');

      // Update all descriptions
      const result =
        await descriptionPersistenceService.updateMultipleDescriptions(
          descriptionsMap
        );

      // Only the valid entities should succeed
      expect(result.successful).toBe(10);
      // The non-existent entities should be in the failed array
      expect(result.failed).toEqual([
        'non_existent_1',
        'non_existent_2',
        'non_existent_3',
      ]);

      // Verify batch operation was used for the valid updates
      expect(batchAddSpy).toHaveBeenCalledTimes(1);

      // Cleanup
      for (const entityId of entityIds) {
        entityManager.removeEntityInstance(entityId);
      }
    });
  });

  describe('Batch operation verification', () => {
    it('should use single batch operation instead of multiple individual adds', async () => {
      const entityIds = [];
      const descriptionsMap = new Map();

      // Create 20 entities
      for (let i = 1; i <= 20; i++) {
        await entityManager.createEntityInstance('test:entity', {
          instanceId: `comparison_part_${i}`,
        });
        const entityId = `comparison_part_${i}`;
        entityIds.push(entityId);
        descriptionsMap.set(entityId, `Description for comparison part ${i}`);
      }

      // Clear spy to only count description update calls
      batchAddSpy.mockClear();

      // Update all descriptions using batch operation
      await descriptionPersistenceService.updateMultipleDescriptions(
        descriptionsMap
      );

      // Verify single batch operation call
      expect(batchAddSpy).toHaveBeenCalledTimes(1);

      // Verify batch contains all 20 updates
      const batchCall = batchAddSpy.mock.calls[0];
      expect(batchCall[0].length).toBe(20);
      expect(batchCall[1]).toBe(true); // emitBatchEvent flag

      // Cleanup
      for (const entityId of entityIds) {
        entityManager.removeEntityInstance(entityId);
      }
    });
  });
});
