/**
 * @file Memory tests for anyOf validation
 * @description Tests memory stability of anyOf-based operation validation
 * to ensure no memory leaks during repeated validations.
 * @see src/validation/ajvSchemaValidator.js
 * @see tests/performance/validation/anyOfPerformance.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Ajv from 'ajv';

/**
 * Creates a simplified operation schema for memory testing
 *
 * @param operationCount
 */
function createSimplifiedOperationSchema(operationCount = 59) {
  const operations = [];

  // Add common operations
  operations.push(
    {
      type: 'object',
      properties: {
        type: { const: 'QUERY_COMPONENT' },
        parameters: {
          type: 'object',
          properties: {
            entity_ref: { type: 'string' },
            component_id: { type: 'string' },
            output_var: { type: 'string' },
          },
          required: ['entity_ref', 'component_id', 'output_var'],
          additionalProperties: false,
        },
      },
      required: ['type', 'parameters'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'MODIFY_COMPONENT' },
        parameters: {
          type: 'object',
          properties: {
            entity_ref: { type: 'string' },
            component_id: { type: 'string' },
            updates: { type: 'object' },
          },
          required: ['entity_ref', 'component_id', 'updates'],
          additionalProperties: false,
        },
      },
      required: ['type', 'parameters'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'LOG' },
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            level: { enum: ['debug', 'info', 'warn', 'error'] },
          },
          required: ['message', 'level'],
          additionalProperties: false,
        },
      },
      required: ['type', 'parameters'],
      additionalProperties: false,
    }
  );

  // Add synthetic operations to reach desired count
  for (let i = operations.length; i < operationCount; i++) {
    operations.push({
      type: 'object',
      properties: {
        type: { const: `OPERATION_${i}` },
        parameters: { type: 'object', additionalProperties: true },
      },
      required: ['type', 'parameters'],
      additionalProperties: false,
    });
  }

  return {
    $id: 'test-operation-schema',
    anyOf: [
      {
        type: 'object',
        properties: {
          macro: { type: 'string', pattern: '^[a-z0-9_]+:[a-z0-9_]+$' },
        },
        required: ['macro'],
        additionalProperties: false,
      },
      {
        anyOf: operations,
      },
    ],
  };
}

describe('anyOf Validation Memory Usage', () => {
  let ajv;
  let validate;

  beforeEach(async () => {
    // Force GC before each test if available
    if (global.memoryTestUtils) {
      await global.memoryTestUtils.forceGCAndWait();
    }

    ajv = new Ajv({ strict: false, allErrors: true });
    const schema = createSimplifiedOperationSchema(59);
    ajv.addSchema(schema);
    validate = ajv.getSchema('test-operation-schema');
  });

  afterEach(async () => {
    // Clean up and force GC after each test
    ajv = null;
    validate = null;

    if (global.memoryTestUtils) {
      await global.memoryTestUtils.forceGCAndWait();
    }
  });

  describe('Memory Leak Prevention', () => {
    it('should not leak memory during repeated validations', async () => {
      if (global.memoryTestUtils) {
        await global.memoryTestUtils.forceGCAndWait();
      }

      const baselineMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const operation = {
        type: 'QUERY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_id: 'core:actor',
          output_var: 'data',
        },
      };

      // Reduced operation count for faster testing while maintaining validity
      const operationCount =
        global.memoryTestUtils && global.memoryTestUtils.isCI() ? 1000 : 2000;

      for (let i = 0; i < operationCount; i++) {
        validate(operation);
      }

      if (global.memoryTestUtils) {
        await global.memoryTestUtils.forceGCAndWait();
      } else if (global.gc) {
        global.gc();
      }

      const finalMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const memoryIncrease = finalMemory - baselineMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      console.log(
        `  ✓ Memory stability: ${memoryIncreaseMB >= 0 ? '+' : ''}${memoryIncreaseMB.toFixed(2)}MB after ${operationCount} validations`
      );

      // Memory increase should be minimal (<1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });

    it('should handle large schemas without memory growth', async () => {
      if (global.memoryTestUtils) {
        await global.memoryTestUtils.forceGCAndWait();
      }

      // Create large schema with 100 operation types
      const largeAjv = new Ajv({ strict: false, allErrors: true });
      const largeSchema = createSimplifiedOperationSchema(100);
      largeAjv.addSchema(largeSchema);
      const largeValidate = largeAjv.getSchema('test-operation-schema');

      const baselineMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const operation = {
        type: 'QUERY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_id: 'core:actor',
          output_var: 'data',
        },
      };

      // Validate 500 times with large schema
      const operationCount =
        global.memoryTestUtils && global.memoryTestUtils.isCI() ? 500 : 1000;

      for (let i = 0; i < operationCount; i++) {
        largeValidate(operation);
      }

      if (global.memoryTestUtils) {
        await global.memoryTestUtils.forceGCAndWait();
      } else if (global.gc) {
        global.gc();
      }

      const finalMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const memoryIncrease = finalMemory - baselineMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      console.log(
        `  ✓ Large schema memory: ${memoryIncreaseMB >= 0 ? '+' : ''}${memoryIncreaseMB.toFixed(2)}MB after ${operationCount} validations`
      );

      // Memory increase should still be minimal (<1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });

    it('should maintain stable memory with macro validations', async () => {
      if (global.memoryTestUtils) {
        await global.memoryTestUtils.forceGCAndWait();
      }

      const baselineMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const macroRef = {
        macro: 'core:testmacro',
      };

      const operationCount =
        global.memoryTestUtils && global.memoryTestUtils.isCI() ? 1000 : 2000;

      for (let i = 0; i < operationCount; i++) {
        validate(macroRef);
      }

      if (global.memoryTestUtils) {
        await global.memoryTestUtils.forceGCAndWait();
      } else if (global.gc) {
        global.gc();
      }

      const finalMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const memoryIncrease = finalMemory - baselineMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      console.log(
        `  ✓ Macro validation memory: ${memoryIncreaseMB >= 0 ? '+' : ''}${memoryIncreaseMB.toFixed(2)}MB after ${operationCount} validations`
      );

      // Memory increase should be minimal (<1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });
  });
});
