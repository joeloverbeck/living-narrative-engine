/**
 * @file Memory-focused tests for ModReferenceExtractor
 * @description Ensures ModReferenceExtractor scales without excessive memory usage
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../common/testBed.js';
import ModReferenceExtractor from '../../cli/validation/modReferenceExtractor.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('ModReferenceExtractor - Memory Tests', () => {
  // Grant memory tests extra time for GC stabilization
  jest.setTimeout(120000);

  let testBed;
  let extractor;
  let mockLogger;
  let mockAjvValidator;
  let testModPath;
  let tempDir;

  beforeEach(async () => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockAjvValidator = testBed.createMock('ajvValidator', ['validate']);

    extractor = new ModReferenceExtractor({
      logger: mockLogger,
      ajvValidator: mockAjvValidator,
    });

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mod-ref-memory-test-'));
    testModPath = path.join(tempDir, 'memory_test_mod');
    await fs.mkdir(testModPath, { recursive: true });

    await global.memoryTestUtils.addPreTestStabilization(60);
  });

  afterEach(async () => {
    testBed.cleanup();

    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    await global.memoryTestUtils.forceGCAndWait();
  });

  describe('Memory stability scenarios', () => {
    it('should avoid leaks during repeated extractions', async () => {
      const numIterations = 20;
      const memoryReadings = [];

      for (let i = 0; i < 20; i++) {
        await fs.writeFile(
          path.join(testModPath, `file_${i}.action.json`),
          JSON.stringify({
            id: `memory_test_mod:action_${i}`,
            required_components: {
              actor: [`test_mod_${i % 5}:component_${i}`],
            },
          })
        );
      }

      for (let iteration = 0; iteration < numIterations; iteration++) {
        await global.memoryTestUtils.forceGCAndWait();
        const references = await extractor.extractReferences(testModPath);
        expect(references.size).toBe(5);

        await global.memoryTestUtils.forceGCAndWait();
        const stabilizedMemory =
          await global.memoryTestUtils.getStableMemoryUsage(3);

        memoryReadings.push({
          iteration,
          heapUsed: stabilizedMemory,
        });
      }

      const halfPoint = Math.floor(memoryReadings.length / 2);
      const firstHalf = memoryReadings.slice(0, halfPoint);
      const secondHalf = memoryReadings.slice(halfPoint);

      const avgFirstHalf =
        firstHalf.reduce((sum, reading) => sum + reading.heapUsed, 0) /
        firstHalf.length;
      const avgSecondHalf =
        secondHalf.reduce((sum, reading) => sum + reading.heapUsed, 0) /
        secondHalf.length;

      global.memoryTestUtils.assertMemoryGrowthPercentage(
        avgFirstHalf,
        avgSecondHalf,
        10,
        'Repeated ModReferenceExtractor extractions'
      );

      console.log(`Memory leak test (${numIterations} iterations):`);
      console.log(
        `- Average first half: ${(avgFirstHalf / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `- Average second half: ${(avgSecondHalf / 1024 / 1024).toFixed(2)}MB`
      );
    }, 60000);

    it('should efficiently handle duplicate-heavy string processing', async () => {
      const numFiles = 50;
      const duplicateReferences = [
        'common_mod:shared',
        'utility_mod:helper',
        'base_mod:foundation',
      ];

      for (let i = 0; i < numFiles; i++) {
        const fileData = {
          id: `memory_test_mod:duplicate_test_${i}`,
          required_components: {
            actor: duplicateReferences.concat([`unique_mod_${i}:special`]),
          },
          metadata: {
            shared_refs: duplicateReferences,
            unique_ref: `unique_mod_${i}:metadata`,
          },
        };

        await fs.writeFile(
          path.join(testModPath, `duplicate_${i}.action.json`),
          JSON.stringify(fileData)
        );
      }

      const startTime = performance.now();
      await global.memoryTestUtils.forceGCAndWait();
      const startMemory = await global.memoryTestUtils.getStableMemoryUsage(3);

      const references = await extractor.extractReferences(testModPath);

      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage(3);
      const duration = performance.now() - startTime;
      const memoryDelta = Math.max(0, finalMemory - startMemory);

      expect(duration).toBeLessThan(2000);

      const memoryThreshold = global.memoryTestUtils.getMemoryThreshold(10);
      expect(memoryDelta).toBeLessThan(memoryThreshold);

      expect(references.has('common_mod')).toBe(true);
      expect(references.has('utility_mod')).toBe(true);
      expect(references.has('base_mod')).toBe(true);
      expect(references.get('common_mod')).toContain('shared');
      expect(references.get('utility_mod')).toContain('helper');
      expect(references.get('base_mod')).toContain('foundation');

      for (let i = 0; i < numFiles; i++) {
        expect(references.has(`unique_mod_${i}`)).toBe(true);
        expect(references.get(`unique_mod_${i}`)).toContain('special');
      }

      console.log(
        `Duplicate reference handling (${numFiles} files with duplicates):`
      );
      console.log(`- Duration: ${duration.toFixed(2)}ms`);
      console.log(
        `- Memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB (limit ${(memoryThreshold / 1024 / 1024).toFixed(2)}MB)`
      );
      console.log(`- Unique mods: ${references.size}`);
    }, 60000);
  });
});
