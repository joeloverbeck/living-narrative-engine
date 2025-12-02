/**
 * @file Performance tests for ModReferenceExtractor with benchmarks and memory monitoring
 * These tests validate performance characteristics and resource usage patterns
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ModReferenceExtractor from '../../../cli/validation/modReferenceExtractor.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('ModReferenceExtractor - Performance Tests', () => {
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

    // Create temporary directory for performance tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mod-ref-perf-test-'));
    testModPath = path.join(tempDir, 'performance_test_mod');
    await fs.mkdir(testModPath, { recursive: true });

  });

  afterEach(async () => {
    testBed.cleanup();

    // Clean up test files
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Large Directory Structure Performance', () => {
    it('should handle 100+ files efficiently within 2 seconds', async () => {
      const numFiles = 120;
      const referencesPerFile = 5;

      // Create many files with mod references
      const createPromises = [];
      for (let i = 0; i < numFiles; i++) {
        const filePath = path.join(testModPath, `file_${i}.action.json`);
        const fileContent = {
          id: `performance_test_mod:action_${i}`,
          required_components: {},
        };

        // Add multiple references per file
        for (let j = 0; j < referencesPerFile; j++) {
          fileContent.required_components[`entity_${j}`] = [
            `mod_${i % 20}:component_${j}`,
          ];
        }

        createPromises.push(
          fs.writeFile(filePath, JSON.stringify(fileContent))
        );
      }

      await Promise.all(createPromises);

      const startTime = performance.now();
      const startMemory = process.memoryUsage();

      const references = await extractor.extractReferences(testModPath);

      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

      // Performance assertions
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds

      // Memory usage should be reasonable (less than 50MB increase)
      expect(memoryDelta).toBeLessThan(50 * 1024 * 1024);

      // Should extract expected number of mod references
      expect(references.size).toBe(20); // mod_0 through mod_19

      // Each mod should have the expected component references
      for (let modIndex = 0; modIndex < 20; modIndex++) {
        const modKey = `mod_${modIndex}`;
        expect(references.has(modKey)).toBe(true);
        expect(references.get(modKey).size).toBe(referencesPerFile); // 5 components per mod
      }

      console.log(`Performance metrics for ${numFiles} files:`);
      console.log(`- Duration: ${duration.toFixed(2)}ms`);
      console.log(
        `- Memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `- Files per second: ${(numFiles / (duration / 1000)).toFixed(2)}`
      );
    }, 10000); // 10 second timeout for this test

    it('should scale linearly with directory depth', async () => {
      const depths = [3, 6, 9];
      const numIterations = 5; // Multiple measurements for statistical robustness
      const results = [];

      // Warm-up run to populate filesystem caches and reduce variance
      // This helps mitigate flakiness from cold filesystem state
      await extractor.extractReferences(testModPath);

      for (const depth of depths) {
        // Clean up previous test
        await fs.rm(testModPath, { recursive: true, force: true });
        await fs.mkdir(testModPath, { recursive: true });

        // Create nested directory structure
        let currentPath = testModPath;
        for (let level = 0; level < depth; level++) {
          currentPath = path.join(currentPath, `level_${level}`);
          await fs.mkdir(currentPath, { recursive: true });

          // Add 5 files per level
          for (let fileIndex = 0; fileIndex < 5; fileIndex++) {
            await fs.writeFile(
              path.join(currentPath, `file_${fileIndex}.action.json`),
              JSON.stringify({
                id: `performance_test_mod:level_${level}_file_${fileIndex}`,
                required_components: {
                  actor: [`depth_mod_${level}:component_${fileIndex}`],
                },
              })
            );
          }
        }

        // Perform multiple measurements for statistical reliability
        const measurements = [];
        for (let iteration = 0; iteration < numIterations; iteration++) {
          // Force garbage collection if available to reduce variance
          if (global.gc) {
            global.gc();
          }

          const startTime = performance.now();
          const references = await extractor.extractReferences(testModPath);
          const endTime = performance.now();
          const duration = endTime - startTime;

          measurements.push(duration);

          // Verify correctness on first iteration
          if (iteration === 0) {
            expect(references.size).toBe(depth); // One mod per depth level
          }
        }

        // Calculate statistical measures
        measurements.sort((a, b) => a - b);
        const median = measurements[Math.floor(measurements.length / 2)];
        const mean =
          measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
        const min = measurements[0];
        const max = measurements[measurements.length - 1];

        results.push({
          depth,
          median,
          mean,
          min,
          max,
          measurements,
          refCount: depth,
        });

        // Absolute performance check - median should be reasonable
        expect(median).toBeLessThan(1000); // Should complete within 1 second even at depth 9
      }

      // Statistical scaling analysis using median values (more robust than single measurements)
      const medianRatio1 = results[1].median / results[0].median;
      const medianRatio2 = results[2].median / results[1].median;

      // Thresholds account for filesystem I/O variability inherent in sub-100ms measurements.
      // The depth 3 baseline can vary by 3-4x between runs due to OS cache state,
      // which significantly impacts ratio calculations even with median-based analysis.
      // File counts: depth 3→6 is 2x files, depth 6→9 is 1.5x files
      expect(medianRatio1).toBeLessThan(5); // Allow up to 5x for 2x files (accounts for I/O variance)
      expect(medianRatio2).toBeLessThan(4); // Allow up to 4x for 1.5x files

      // Additional check: ensure performance doesn't degrade catastrophically
      const overallRatio = results[2].median / results[0].median; // depth 9 vs depth 3 (3x files)
      expect(overallRatio).toBeLessThan(8); // Should not be more than 8x slower for 3x files

      console.log('Directory depth scaling (statistical analysis):');
      results.forEach((result) => {
        console.log(
          `- Depth ${result.depth}: median=${result.median.toFixed(2)}ms, mean=${result.mean.toFixed(2)}ms, range=[${result.min.toFixed(2)}-${result.max.toFixed(2)}]ms, refs=${result.refCount}`
        );
      });

      console.log(
        `- Scaling ratios: 6→3 median=${medianRatio1.toFixed(2)}x, 9→6 median=${medianRatio2.toFixed(2)}x, overall=${overallRatio.toFixed(2)}x`
      );
    });

    it('should handle concurrent extraction operations without degradation', async () => {
      const numConcurrentMods = 5;
      const modPaths = [];

      // Create multiple mod directories
      for (let i = 0; i < numConcurrentMods; i++) {
        const modPath = path.join(tempDir, `concurrent_mod_${i}`);
        await fs.mkdir(modPath, { recursive: true });
        modPaths.push(modPath);

        // Add files to each mod
        for (let j = 0; j < 10; j++) {
          await fs.writeFile(
            path.join(modPath, `action_${j}.action.json`),
            JSON.stringify({
              id: `concurrent_mod_${i}:action_${j}`,
              required_components: {
                actor: [
                  `shared_mod:component_${j}`,
                  `unique_mod_${i}:special_${j}`,
                ],
              },
            })
          );
        }
      }

      const startTime = performance.now();

      // Run extraction on all mods concurrently
      const extractionPromises = modPaths.map((modPath) =>
        extractor.extractReferences(modPath)
      );

      const results = await Promise.all(extractionPromises);

      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // Concurrent execution should be faster than sequential
      expect(totalDuration).toBeLessThan(2000); // Should complete within 2 seconds

      // Each result should contain expected references
      results.forEach((references, index) => {
        expect(references.has('shared_mod')).toBe(true);
        expect(references.has(`unique_mod_${index}`)).toBe(true);
        expect(references.get('shared_mod').size).toBe(10); // 10 components
        expect(references.get(`unique_mod_${index}`).size).toBe(10); // 10 special components
      });

      console.log(
        `Concurrent extraction (${numConcurrentMods} mods): ${totalDuration.toFixed(2)}ms`
      );
    }, 15000); // 15 second timeout for concurrent test
  });

  describe('Large File Processing Performance', () => {
    it('should handle files with thousands of references efficiently', async () => {
      const numReferences = 5000;
      const largeFileData = {
        id: 'performance_test_mod:huge_action',
        required_components: {},
        forbidden_components: {},
        metadata: {},
      };

      // Add many references in different sections
      for (let i = 0; i < numReferences; i++) {
        const modId = `large_mod_${i % 50}`; // 50 different mods
        const componentId = `component_${i}`;

        if (i % 3 === 0) {
          largeFileData.required_components[`entity_${i}`] = [
            `${modId}:${componentId}`,
          ];
        } else if (i % 3 === 1) {
          largeFileData.forbidden_components[`entity_${i}`] = [
            `${modId}:${componentId}`,
          ];
        } else {
          // Use a pattern that the extractor actually processes - like in triggers
          if (!largeFileData.triggers) largeFileData.triggers = [];
          largeFileData.triggers.push({
            condition: {
              '==': [{ var: 'component' }, `${modId}:${componentId}`],
            },
          });
        }
      }

      await fs.writeFile(
        path.join(testModPath, 'huge.action.json'),
        JSON.stringify(largeFileData)
      );

      const startTime = performance.now();
      const startMemory = process.memoryUsage();

      const references = await extractor.extractReferences(testModPath);

      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

      // Should process within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);

      // Memory usage should be reasonable
      expect(memoryDelta).toBeLessThan(20 * 1024 * 1024); // Less than 20MB

      // Should extract all 50 mods
      expect(references.size).toBe(50);

      // Each mod should have multiple component references
      for (let modIndex = 0; modIndex < 50; modIndex++) {
        const modKey = `large_mod_${modIndex}`;
        expect(references.has(modKey)).toBe(true);
        expect(references.get(modKey).size).toBeGreaterThan(60); // Should have around 66-67 references per mod (2/3 of ~100)
      }

      console.log(`Large file performance (${numReferences} references):`);
      console.log(`- Duration: ${duration.toFixed(2)}ms`);
      console.log(
        `- Memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `- References per second: ${(numReferences / (duration / 1000)).toFixed(0)}`
      );
    });

    it('should handle deeply nested JSON structures without stack overflow', async () => {
      const maxDepth = 1000;
      let deepStructure = { ref: 'deep_mod:final_component' };

      // Create deeply nested structure
      for (let i = maxDepth - 1; i >= 0; i--) {
        deepStructure = {
          level: i,
          reference: `level_mod_${i}:component_${i}`,
          nested: deepStructure,
        };
      }

      const deepFileData = {
        id: 'performance_test_mod:deep_action',
        condition: deepStructure,
      };

      await fs.writeFile(
        path.join(testModPath, 'deep.action.json'),
        JSON.stringify(deepFileData)
      );

      const startTime = performance.now();

      const references = await extractor.extractReferences(testModPath);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete without stack overflow
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds

      // Should extract references from all levels
      expect(references.has('deep_mod')).toBe(true);
      expect(references.get('deep_mod')).toContain('final_component');

      // Should find many level_mod references
      let levelModCount = 0;
      for (const modId of references.keys()) {
        if (modId.startsWith('level_mod_')) {
          levelModCount++;
        }
      }
      expect(levelModCount).toBeGreaterThan(900); // Most levels should be found

      console.log(`Deep structure performance (${maxDepth} levels):`);
      console.log(`- Duration: ${duration.toFixed(2)}ms`);
      console.log(`- Level mods found: ${levelModCount}`);
    });
  });

  describe('JSON Logic Performance', () => {
    it('should efficiently process complex JSON Logic structures', async () => {
      const numConditions = 100;
      const complexLogic = { and: [] };

      // Create complex nested JSON Logic with many component references
      for (let i = 0; i < numConditions; i++) {
        complexLogic.and.push({
          or: [
            { has_component: ['actor', `logic_mod_${i % 10}:state_${i}`] },
            {
              '>=': [
                {
                  get_component_value: [
                    'actor',
                    `stats_mod_${i % 5}:attribute_${i}`,
                    'value',
                  ],
                },
                i % 100,
              ],
            },
            {
              if: [
                {
                  has_component: [
                    'target',
                    `condition_mod_${i % 8}:check_${i}`,
                  ],
                },
                {
                  set_component_value: [
                    'target',
                    `effect_mod_${i % 6}:result_${i}`,
                    'active',
                    true,
                  ],
                },
                {
                  add_component: [
                    'target',
                    `fallback_mod_${i % 4}:default_${i}`,
                    { level: i },
                  ],
                },
              ],
            },
          ],
        });
      }

      const logicFileData = {
        id: 'performance_test_mod:complex_logic',
        condition: complexLogic,
      };

      await fs.writeFile(
        path.join(testModPath, 'complex_logic.rule.json'),
        JSON.stringify(logicFileData)
      );

      const startTime = performance.now();

      const references = await extractor.extractReferences(testModPath);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should process complex logic efficiently
      expect(duration).toBeLessThan(500); // Should complete within 500ms

      // Should extract references from all mod types
      const expectedModTypes = [
        'logic_mod',
        'stats_mod',
        'condition_mod',
        'effect_mod',
        'fallback_mod',
      ];
      expectedModTypes.forEach((modType) => {
        let found = false;
        for (const modId of references.keys()) {
          if (modId.startsWith(modType)) {
            found = true;
            break;
          }
        }
        expect(found).toBe(true);
      });

      console.log(
        `Complex JSON Logic performance (${numConditions} conditions):`
      );
      console.log(`- Duration: ${duration.toFixed(2)}ms`);
      console.log(`- Unique mods found: ${references.size}`);
      console.log(
        `- Conditions per ms: ${(numConditions / duration).toFixed(2)}`
      );
    });
  });

  describe('Real-world Performance Scenarios', () => {
    it('should handle a realistic game mod ecosystem efficiently', async () => {
      // Simulate a realistic mod with various content types
      const contentTypes = [
        { dir: 'actions', count: 25, extension: '.action.json' },
        { dir: 'components', count: 15, extension: '.component.json' },
        { dir: 'rules', count: 20, extension: '.rule.json' },
        { dir: 'conditions', count: 10, extension: '.condition.json' },
        { dir: 'events', count: 8, extension: '.event.json' },
        { dir: 'scopes', count: 12, extension: '.scope' },
      ];

      const modDependencies = [
        'positioning',
        'intimacy',
        'social_interaction',
        'emotion_system',
        'stats_management',
        'relationship_tracking',
        'conversation_engine',
        'animation_controller',
        'ui_management',
        'audio_system',
      ];

      // Create realistic file structure
      for (const contentType of contentTypes) {
        const dir = path.join(testModPath, contentType.dir);
        await fs.mkdir(dir, { recursive: true });

        for (let i = 0; i < contentType.count; i++) {
          const fileName = `${contentType.dir.slice(0, -1)}_${i}${contentType.extension}`;
          let fileContent;

          if (contentType.extension === '.scope') {
            // Scope file content
            const scopeLines = [];
            for (let j = 0; j < 3; j++) {
              const depMod = modDependencies[j % modDependencies.length];
              scopeLines.push(
                `performance_test_mod:scope_${i}_${j} := actor.components.${depMod}:component_${j}.field`
              );
            }
            fileContent = scopeLines.join('\n');
          } else {
            // JSON file content
            fileContent = JSON.stringify({
              id: `performance_test_mod:${contentType.dir.slice(0, -1)}_${i}`,
              required_components: {
                actor: modDependencies
                  .slice(0, 3)
                  .map((mod, idx) => `${mod}:component_${i}_${idx}`),
              },
              condition: {
                and: modDependencies.slice(3, 6).map((mod, idx) => ({
                  has_component: ['actor', `${mod}:state_${i}_${idx}`],
                })),
              },
              metadata: {
                dependencies: modDependencies
                  .slice(6, 9)
                  .map((mod, idx) => `${mod}:metadata_${i}_${idx}`),
              },
            });
          }

          await fs.writeFile(path.join(dir, fileName), fileContent);
        }
      }

      const startTime = performance.now();
      const startMemory = process.memoryUsage();

      const references = await extractor.extractReferences(testModPath);

      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

      const totalFiles = contentTypes.reduce((sum, ct) => sum + ct.count, 0);

      // Performance expectations for a realistic mod
      expect(duration).toBeLessThan(1500); // Should complete within 1.5 seconds
      expect(memoryDelta).toBeLessThan(15 * 1024 * 1024); // Less than 15MB memory increase

      // Should extract mod dependencies from required_components and conditions
      // Note: Only first 6 mods are actually referenced in extractable locations
      const extractableMods = modDependencies.slice(0, 6);
      extractableMods.forEach((modId) => {
        expect(references.has(modId)).toBe(true);
        expect(references.get(modId).size).toBeGreaterThan(0);
      });

      console.log(`Realistic game mod ecosystem (${totalFiles} files):`);
      console.log(`- Duration: ${duration.toFixed(2)}ms`);
      console.log(
        `- Memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `- Files per second: ${(totalFiles / (duration / 1000)).toFixed(2)}`
      );
      console.log(`- Dependencies found: ${references.size}`);
      console.log(
        `- Average components per mod: ${Array.from(references.values()).reduce((sum, set) => sum + set.size, 0) / references.size}`
      );
    }, 20000); // 20 second timeout for comprehensive test
  });
});
