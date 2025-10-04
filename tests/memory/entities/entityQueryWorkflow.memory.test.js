/**
 * @file entityQueryWorkflow.memory.test.js
 * @description Memory efficiency tests for entity query workflows
 *
 * Tests memory usage patterns for large entity sets and query operations
 * to ensure the entity system doesn't leak memory or use excessive resources.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EntityWorkflowTestBed from '../../e2e/entities/common/entityWorkflowTestBed.js';

describe('Entity Query & Access - Memory Tests', () => {
  let testBed;
  let entityManager;
  let logger;

  beforeEach(async () => {
    testBed = new EntityWorkflowTestBed();
    await testBed.initialize();
    entityManager = testBed.entityManager;
    logger = testBed.logger;
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  describe('Memory Efficiency', () => {
    it('should efficiently handle memory with large entity sets', async () => {
      // Arrange - Track initial memory
      if (global.gc) global.gc();
      const initialMemory = process.memoryUsage().heapUsed;

      // Create large entity set
      const largeDef = 'test:memory_test';
      await testBed.ensureEntityDefinitionExists(largeDef, {
        id: largeDef,
        components: {
          'core:name': { text: 'Memory Test' },
          'memory:data': {
            array: new Array(100).fill(0),
            object: { nested: { deep: { value: 'test' } } },
          },
        },
      });

      const entityCount = 100;
      const entities = [];

      for (let i = 0; i < entityCount; i++) {
        const entity = await testBed.createTestEntity(largeDef, {
          instanceId: `memory_${i}`,
        });
        entities.push(entity);
      }

      // Act - Perform operations and check memory
      const afterCreation = process.memoryUsage().heapUsed;
      const creationMemory = (afterCreation - initialMemory) / (1024 * 1024); // MB

      // Perform queries
      for (let i = 0; i < 10; i++) {
        const query = entityManager.findEntities({
          withAll: ['memory:data'],
        });
        expect(query.length).toBe(entityCount);
      }

      const afterQueries = process.memoryUsage().heapUsed;
      const queryMemory = (afterQueries - afterCreation) / (1024 * 1024); // MB

      // Clear references and allow cleanup
      entities.length = 0;
      if (global.gc) global.gc();

      const afterCleanup = process.memoryUsage().heapUsed;
      const cleanupMemory = (afterCleanup - initialMemory) / (1024 * 1024); // MB

      // Assert - Memory usage should be reasonable
      logger.debug('Memory Usage:', {
        creation: `${creationMemory.toFixed(2)}MB`,
        queries: `${queryMemory.toFixed(2)}MB`,
        afterCleanup: `${cleanupMemory.toFixed(2)}MB`,
      });

      // Memory per entity should be reasonable (<2MB per entity, allowing for test overhead)
      const memoryPerEntity = creationMemory / entityCount;
      expect(memoryPerEntity).toBeLessThan(2);

      // Query operations shouldn't leak significant memory
      expect(queryMemory).toBeLessThan(10); // <10MB for query operations

      // Some memory may remain after cleanup due to caching, but should be reasonable
      // Allow more memory retention in test environment due to framework overhead
      expect(cleanupMemory).toBeLessThan(creationMemory * 2);
    });
  });
});
