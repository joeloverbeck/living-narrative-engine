/**
 * @file BatchOperationsWorkflow.e2e.test.js
 * @description End-to-end tests for batch operations workflows
 *
 * Tests the complete batch operations system including performance validation,
 * error handling, and scalability characteristics for batch entity creation,
 * component addition, and entity removal operations.
 *
 * This addresses the Priority 3 critical gap identified in the entity workflows
 * E2E test coverage analysis for batch operations performance.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EntityWorkflowTestBed from './common/entityWorkflowTestBed.js';

describe('Batch Operations E2E Workflow', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new EntityWorkflowTestBed({
      monitorComponentEvents: true, // Required for component operation tests
    });
    await testBed.initialize();
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  describe('Batch Creation with Performance Validation', () => {
    it('should create multiple entities efficiently in batches', async () => {
      // Arrange
      const definitionId = 'test:batch_entity';
      const batchSize = 10;
      const expectedInstanceIds = Array.from(
        { length: batchSize },
        (_, i) => `batch_entity_${i + 1}`
      );

      await testBed.ensureEntityDefinitionExists(definitionId);

      const entitySpecs = expectedInstanceIds.map((instanceId) => ({
        definitionId,
        opts: { instanceId },
      }));

      const startTime = performance.now();

      // Act
      const result =
        await testBed.entityManager.batchCreateEntities(entitySpecs);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Assert batch operation results
      expect(result).toBeDefined();
      expect(result.successCount).toBe(batchSize);
      expect(result.failureCount).toBe(0);
      expect(result.totalProcessed).toBe(batchSize);
      expect(result.successes).toHaveLength(batchSize);
      expect(result.failures).toHaveLength(0);

      // Assert performance characteristics
      const avgTimePerEntity = totalTime / batchSize;
      expect(avgTimePerEntity).toBeLessThan(50); // Target: <50ms per entity
      expect(result.processingTime).toBeGreaterThan(0);

      // Assert all entities were created correctly
      for (const instanceId of expectedInstanceIds) {
        const entity =
          await testBed.entityManager.getEntityInstance(instanceId);
        expect(entity).toBeDefined();
        expect(entity.id).toBe(instanceId);
      }

      // Assert events were dispatched for all entities
      const entityCreatedEvents = testBed.getEventsByType(
        'core:entity_created'
      );
      expect(entityCreatedEvents).toHaveLength(batchSize);

      // Assert repository consistency
      await testBed.assertRepositoryConsistency();
    });

    it('should handle partial failures in batch creation gracefully', async () => {
      // Arrange
      const validDefinitionId = 'test:valid_entity';
      const invalidDefinitionId = 'test:nonexistent_entity';

      await testBed.ensureEntityDefinitionExists(validDefinitionId);
      // Intentionally don't create definition for invalidDefinitionId

      const entitySpecs = [
        {
          definitionId: validDefinitionId,
          opts: { instanceId: 'valid_entity_1' },
        },
        {
          definitionId: invalidDefinitionId,
          opts: { instanceId: 'invalid_entity_1' },
        },
        {
          definitionId: validDefinitionId,
          opts: { instanceId: 'valid_entity_2' },
        },
        {
          definitionId: invalidDefinitionId,
          opts: { instanceId: 'invalid_entity_2' },
        },
      ];

      // Act
      const result = await testBed.entityManager.batchCreateEntities(
        entitySpecs,
        {
          stopOnError: false, // Continue processing despite errors
        }
      );

      // Assert mixed success/failure results
      expect(result).toBeDefined();
      expect(result.totalProcessed).toBe(4);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(2);
      expect(result.successes).toHaveLength(2);
      expect(result.failures).toHaveLength(2);

      // Assert successful entities exist
      const validEntity1 =
        await testBed.entityManager.getEntityInstance('valid_entity_1');
      const validEntity2 =
        await testBed.entityManager.getEntityInstance('valid_entity_2');
      expect(validEntity1).toBeDefined();
      expect(validEntity2).toBeDefined();

      // Assert failed entities don't exist
      const invalidEntity1 =
        await testBed.entityManager.getEntityInstance('invalid_entity_1');
      const invalidEntity2 =
        await testBed.entityManager.getEntityInstance('invalid_entity_2');
      expect(invalidEntity1).toBeUndefined();
      expect(invalidEntity2).toBeUndefined();

      // Assert failure objects contain error information
      result.failures.forEach((failure) => {
        expect(failure.item).toBeDefined();
        expect(failure.error).toBeInstanceOf(Error);
        expect(failure.item.definitionId).toBe(invalidDefinitionId);
      });

      // Assert repository remains consistent
      await testBed.assertRepositoryConsistency();
    });

    it('should provide accurate batch operation metrics', async () => {
      // Arrange
      const definitionId = 'test:metrics_entity';
      const batchSize = 5;

      await testBed.ensureEntityDefinitionExists(definitionId);

      const entitySpecs = Array.from({ length: batchSize }, (_, i) => ({
        definitionId,
        opts: { instanceId: `metrics_entity_${i + 1}` },
      }));

      // Act
      const result =
        await testBed.entityManager.batchCreateEntities(entitySpecs);

      // Assert comprehensive metrics
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.totalProcessed).toBe(batchSize);
      expect(result.successCount).toBe(batchSize);
      expect(result.failureCount).toBe(0);

      // Assert metrics match actual results
      expect(result.successes).toHaveLength(result.successCount);
      expect(result.failures).toHaveLength(result.failureCount);
      expect(result.successCount + result.failureCount).toBe(
        result.totalProcessed
      );

      // Assert performance metrics are recorded
      // Note: During batch creation, individual entity creation metrics may not be recorded
      // but we can verify the batch operation was tracked
      expect(result.processingTime).toBeGreaterThan(0);
      expect(typeof result.processingTime).toBe('number');
    });
  });

  describe('Batch Component Operations', () => {
    it('should add components to multiple entities in sequence (simulated batch)', async () => {
      // Arrange
      const definitionId = 'test:component_batch_entity';
      const entityCount = 5;

      await testBed.ensureEntityDefinitionExists(definitionId);

      // Create entities first using batch creation
      const entitySpecs = Array.from({ length: entityCount }, (_, i) => ({
        definitionId,
        opts: { instanceId: `component_entity_${i + 1}` },
      }));

      const createResult =
        await testBed.entityManager.batchCreateEntities(entitySpecs);
      expect(createResult.successCount).toBe(entityCount);

      const startTime = performance.now();

      // Act - Add components individually (simulating batch behavior)
      const componentResults = [];
      for (const entity of createResult.successes) {
        try {
          await testBed.entityManager.addComponent(entity.id, 'core:position', {
            locationId: `location_${entity.id}`,
          });
          componentResults.push({ success: true, entityId: entity.id });
        } catch (error) {
          componentResults.push({ success: false, entityId: entity.id, error });
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Assert component addition results
      const successCount = componentResults.filter((r) => r.success).length;
      const failureCount = componentResults.filter((r) => !r.success).length;

      expect(successCount).toBe(entityCount);
      expect(failureCount).toBe(0);

      // Assert performance characteristics (relaxed for individual operations)
      const avgTimePerComponent = totalTime / entityCount;
      expect(avgTimePerComponent).toBeLessThan(50); // Relaxed target for individual operations

      // Assert components were added to all entities
      for (const entity of createResult.successes) {
        const updatedEntity = await testBed.entityManager.getEntityInstance(
          entity.id
        );
        expect(updatedEntity.hasComponent('core:position')).toBe(true);

        const componentData = updatedEntity.getComponentData('core:position');
        expect(componentData.locationId).toBe(`location_${entity.id}`);
      }

      // Assert component addition events were dispatched
      const componentAddedEvents = testBed.getEventsByType(
        'core:component_added'
      );
      expect(componentAddedEvents.length).toBeGreaterThanOrEqual(entityCount);

      // Assert repository consistency
      await testBed.assertRepositoryConsistency();
    });

    it('should handle mixed success/failure scenarios in component operations', async () => {
      // Arrange
      const definitionId = 'test:mixed_component_entity';
      const entityCount = 3;

      await testBed.ensureEntityDefinitionExists(definitionId);

      // Create entities first
      const entitySpecs = Array.from({ length: entityCount }, (_, i) => ({
        definitionId,
        opts: { instanceId: `mixed_entity_${i + 1}` },
      }));

      const createResult =
        await testBed.entityManager.batchCreateEntities(entitySpecs);
      expect(createResult.successCount).toBe(entityCount);

      // Act - Mix valid and invalid component operations
      const componentOperations = [
        {
          entityId: 'mixed_entity_1',
          componentTypeId: 'core:position',
          componentData: { locationId: 'valid_location_1' },
          shouldSucceed: true,
        },
        {
          entityId: 'nonexistent_entity',
          componentTypeId: 'core:position',
          componentData: { locationId: 'invalid_location' },
          shouldSucceed: false,
        },
        {
          entityId: 'mixed_entity_2',
          componentTypeId: 'core:position',
          componentData: { locationId: 'valid_location_2' },
          shouldSucceed: true,
        },
      ];

      const results = [];
      for (const op of componentOperations) {
        try {
          await testBed.entityManager.addComponent(
            op.entityId,
            op.componentTypeId,
            op.componentData
          );
          results.push({ success: true, operation: op });
        } catch (error) {
          results.push({ success: false, operation: op, error });
        }
      }

      // Assert mixed results
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      expect(successCount).toBe(2); // Two valid operations
      expect(failureCount).toBe(1); // One invalid entity

      // Assert successful operations worked
      const successfulResults = results.filter((r) => r.success);
      expect(successfulResults).toHaveLength(2);

      // Assert failed operations contain error information
      const failedResults = results.filter((r) => !r.success);
      expect(failedResults).toHaveLength(1);
      expect(failedResults[0].error).toBeInstanceOf(Error);

      // Assert repository remains consistent
      await testBed.assertRepositoryConsistency();
    });
  });

  describe('Performance and Scalability', () => {
    it('should complete batch operations within performance thresholds', async () => {
      // Arrange
      const definitionId = 'test:performance_entity';
      const batchSize = 50; // Larger batch for performance testing

      await testBed.ensureEntityDefinitionExists(definitionId);

      const entitySpecs = Array.from({ length: batchSize }, (_, i) => ({
        definitionId,
        opts: { instanceId: `perf_entity_${i + 1}` },
      }));

      // Act & Assert - Entity Creation Performance
      const createStartTime = performance.now();
      const createResult =
        await testBed.entityManager.batchCreateEntities(entitySpecs);
      const createEndTime = performance.now();

      const createTotalTime = createEndTime - createStartTime;
      const createAvgTimePerEntity = createTotalTime / batchSize;

      expect(createResult.successCount).toBe(batchSize);
      expect(createAvgTimePerEntity).toBeLessThan(50); // Target: <50ms per entity
      expect(createTotalTime).toBeLessThan(3000); // Total batch should complete in <3s

      // Act & Assert - Component Addition Performance (Sequential)
      const componentStartTime = performance.now();
      let componentSuccessCount = 0;

      for (const entity of createResult.successes) {
        try {
          await testBed.entityManager.addComponent(entity.id, 'core:position', {
            locationId: `perf_location_${entity.id}`,
          });
          componentSuccessCount++;
        } catch (error) {
          // Component addition failed
        }
      }

      const componentEndTime = performance.now();
      const componentTotalTime = componentEndTime - componentStartTime;
      const componentAvgTimePerOperation = componentTotalTime / batchSize;

      expect(componentSuccessCount).toBe(batchSize);
      expect(componentAvgTimePerOperation).toBeLessThan(50); // Relaxed target for sequential operations
      expect(componentTotalTime).toBeLessThan(3000); // Relaxed time limit for sequential operations

      // Assert repository consistency maintained at scale
      await testBed.assertRepositoryConsistency();
    });

    it('should handle large batch sizes without memory issues', async () => {
      // Arrange
      const definitionId = 'test:large_batch_entity';
      const largeBatchSize = 100; // Large batch to test memory management

      await testBed.ensureEntityDefinitionExists(definitionId);

      const entitySpecs = Array.from({ length: largeBatchSize }, (_, i) => ({
        definitionId,
        opts: { instanceId: `large_entity_${i + 1}` },
      }));

      // Monitor memory usage (approximate)
      const memoryBefore = performance.memory
        ? performance.memory.usedJSHeapSize
        : 0;

      // Act
      const result = await testBed.entityManager.batchCreateEntities(
        entitySpecs,
        {
          batchSize: 25, // Process in smaller chunks to test chunking behavior
        }
      );

      const memoryAfter = performance.memory
        ? performance.memory.usedJSHeapSize
        : 0;

      // Assert successful processing
      expect(result.successCount).toBe(largeBatchSize);
      expect(result.failureCount).toBe(0);
      expect(result.totalProcessed).toBe(largeBatchSize);

      // Assert reasonable memory usage (if available)
      if (performance.memory) {
        const memoryIncrease = memoryAfter - memoryBefore;
        const memoryPerEntity = memoryIncrease / largeBatchSize;

        // Memory usage should be reasonable (less than 100KB per entity)
        expect(memoryPerEntity).toBeLessThan(100000);
      }

      // Assert all entities are accessible
      const entityCount = testBed.entityManager.getEntityIds().length;
      expect(entityCount).toBeGreaterThanOrEqual(largeBatchSize);

      // Assert repository consistency maintained
      await testBed.assertRepositoryConsistency();

      // Clean up large batch to prevent test interference (sequential removal)
      for (const entity of result.successes) {
        try {
          await testBed.entityManager.removeEntityInstance(entity.id);
        } catch (error) {
          // Cleanup failed, continue with next entity
        }
      }
    });
  });
});
