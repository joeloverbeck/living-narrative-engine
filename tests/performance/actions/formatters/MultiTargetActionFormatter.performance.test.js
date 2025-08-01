/**
 * @file Performance and memory tests for MultiTargetActionFormatter
 * @description Benchmarks for handling large entity sets and memory efficiency
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import { EntityManagerTestBed } from '../../../common/entities/entityManagerTestBed.js';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';

describe('MultiTargetActionFormatter - Performance and Memory Tests', () => {
  let testBed;
  let formatter;
  let mockLogger;
  let entityManager;

  beforeEach(() => {
    mockLogger = new ConsoleLogger();
    testBed = new EntityManagerTestBed();
    entityManager = testBed.entityManager;

    // Create mock base formatter
    const mockBaseFormatter = {
      format: jest.fn().mockReturnValue({ ok: true, value: 'formatted' }),
    };

    formatter = new MultiTargetActionFormatter(mockBaseFormatter, mockLogger);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Performance and Memory Tests', () => {
    it('should handle memory efficiently with large entity sets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create a moderate number of entities
      const entities = [];
      for (let i = 0; i < 100; i++) {
        const def = new EntityDefinition(`test:perf${i}`, {
          description: `Performance test entity ${i}`,
          components: {
            'core:name': { value: `Entity ${i}` },
          },
        });
        testBed.setupDefinitions(def);
        const entity = await testBed.entityManager.createEntityInstance(
          `test:perf${i}`,
          {
            instanceId: `perf-${i}`,
          }
        );
        entities.push(entity);
      }

      const actionDef = {
        id: 'test:performance',
        name: 'Performance Test',
        template: 'process {item}',
        generateCombinations: true,
      };

      const resolvedTargets = {
        primary: entities.slice(0, 50).map((e, i) => ({
          id: e.id,
          displayName: `Entity ${i}`,
        })),
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50);
    });
  });
});