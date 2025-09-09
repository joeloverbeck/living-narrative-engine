/**
 * @file Performance tests for ModReferenceExtractor with benchmarks and memory monitoring
 * These tests validate performance characteristics and resource usage patterns
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ModReferenceExtractor from '../../../src/validation/modReferenceExtractor.js';
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
  let memoryBaseline;

  beforeEach(async () => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockAjvValidator = testBed.createMock('ajvValidator', ['validate']);
    
    extractor = new ModReferenceExtractor({
      logger: mockLogger,
      ajvValidator: mockAjvValidator
    });
    
    // Create temporary directory for performance tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mod-ref-perf-test-'));
    testModPath = path.join(tempDir, 'performance_test_mod');
    await fs.mkdir(testModPath, { recursive: true });

    // Capture memory baseline
    if (global.gc) {
      global.gc();
    }
    memoryBaseline = process.memoryUsage();
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
          required_components: {}
        };
        
        // Add multiple references per file
        for (let j = 0; j < referencesPerFile; j++) {
          fileContent.required_components[`entity_${j}`] = [`mod_${i % 20}:component_${j}`];
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
      console.log(`- Memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Files per second: ${(numFiles / (duration / 1000)).toFixed(2)}`);
    }, 10000); // 10 second timeout for this test

    it('should scale linearly with directory depth', async () => {
      const depths = [3, 6, 9];
      const results = [];
      
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
                  actor: [`depth_mod_${level}:component_${fileIndex}`]
                }
              })
            );
          }
        }
        
        const startTime = performance.now();
        const references = await extractor.extractReferences(testModPath);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        results.push({ depth, duration, refCount: references.size });
        
        expect(references.size).toBe(depth); // One mod per depth level
        expect(duration).toBeLessThan(1000); // Should complete within 1 second even at depth 9
      }
      
      // Check for reasonable scaling (duration shouldn't grow exponentially)
      const ratio1 = results[1].duration / results[0].duration;
      const ratio2 = results[2].duration / results[1].duration;
      
      expect(ratio1).toBeLessThan(3); // At most 3x slower for 2x depth
      expect(ratio2).toBeLessThan(3); // Linear-ish scaling
      
      console.log('Directory depth scaling:');
      results.forEach(result => {
        console.log(`- Depth ${result.depth}: ${result.duration.toFixed(2)}ms, ${result.refCount} refs`);
      });
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
                actor: [`shared_mod:component_${j}`, `unique_mod_${i}:special_${j}`]
              }
            })
          );
        }
      }
      
      const startTime = performance.now();
      
      // Run extraction on all mods concurrently
      const extractionPromises = modPaths.map(modPath => 
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
      
      console.log(`Concurrent extraction (${numConcurrentMods} mods): ${totalDuration.toFixed(2)}ms`);
    }, 15000); // 15 second timeout for concurrent test
  });

  describe('Large File Processing Performance', () => {
    it('should handle files with thousands of references efficiently', async () => {
      const numReferences = 5000;
      const largeFileData = {
        id: 'performance_test_mod:huge_action',
        required_components: {},
        forbidden_components: {},
        metadata: {}
      };
      
      // Add many references in different sections
      for (let i = 0; i < numReferences; i++) {
        const modId = `large_mod_${i % 50}`; // 50 different mods
        const componentId = `component_${i}`;
        
        if (i % 3 === 0) {
          largeFileData.required_components[`entity_${i}`] = [`${modId}:${componentId}`];
        } else if (i % 3 === 1) {
          largeFileData.forbidden_components[`entity_${i}`] = [`${modId}:${componentId}`];
        } else {
          // Use a pattern that the extractor actually processes - like in triggers
          if (!largeFileData.triggers) largeFileData.triggers = [];
          largeFileData.triggers.push({
            condition: { "==": [{ "var": "component" }, `${modId}:${componentId}`] }
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
      console.log(`- Memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- References per second: ${(numReferences / (duration / 1000)).toFixed(0)}`);
    });

    it('should handle deeply nested JSON structures without stack overflow', async () => {
      const maxDepth = 1000;
      let deepStructure = { ref: 'deep_mod:final_component' };
      
      // Create deeply nested structure
      for (let i = maxDepth - 1; i >= 0; i--) {
        deepStructure = {
          level: i,
          reference: `level_mod_${i}:component_${i}`,
          nested: deepStructure
        };
      }
      
      const deepFileData = {
        id: 'performance_test_mod:deep_action',
        condition: deepStructure
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

  describe('Memory Management Performance', () => {
    it('should not exhibit memory leaks during repeated extractions', async () => {
      const numIterations = 20;
      const memoryReadings = [];
      
      // Create a moderate-sized test directory
      for (let i = 0; i < 20; i++) {
        await fs.writeFile(
          path.join(testModPath, `file_${i}.action.json`),
          JSON.stringify({
            id: `performance_test_mod:action_${i}`,
            required_components: {
              actor: [`test_mod_${i % 5}:component_${i}`]
            }
          })
        );
      }
      
      // Perform repeated extractions
      for (let iteration = 0; iteration < numIterations; iteration++) {
        if (global.gc) {
          global.gc(); // Force garbage collection if available
        }
        
        const memBefore = process.memoryUsage();
        
        const references = await extractor.extractReferences(testModPath);
        
        const memAfter = process.memoryUsage();
        
        memoryReadings.push({
          iteration,
          heapUsed: memAfter.heapUsed,
          heapTotal: memAfter.heapTotal,
          deltaHeap: memAfter.heapUsed - memBefore.heapUsed
        });
        
        // Verify extraction worked correctly
        expect(references.size).toBe(5); // test_mod_0 through test_mod_4
      }
      
      // Analyze memory trend
      const firstHalf = memoryReadings.slice(0, numIterations / 2);
      const secondHalf = memoryReadings.slice(numIterations / 2);
      
      const avgFirstHalf = firstHalf.reduce((sum, reading) => sum + reading.heapUsed, 0) / firstHalf.length;
      const avgSecondHalf = secondHalf.reduce((sum, reading) => sum + reading.heapUsed, 0) / secondHalf.length;
      
      const memoryGrowth = avgSecondHalf - avgFirstHalf;
      const growthPercentage = (memoryGrowth / avgFirstHalf) * 100;
      
      // Memory growth should be minimal (less than 10% increase)
      expect(growthPercentage).toBeLessThan(10);
      
      console.log(`Memory leak test (${numIterations} iterations):`);
      console.log(`- Average memory first half: ${(avgFirstHalf / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Average memory second half: ${(avgSecondHalf / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Memory growth: ${growthPercentage.toFixed(2)}%`);
    }, 30000); // 30 second timeout for memory test

    it('should efficiently handle string processing with many duplicates', async () => {
      const numFiles = 50;
      const duplicateReferences = ['common_mod:shared', 'utility_mod:helper', 'base_mod:foundation'];
      
      // Create many files with duplicate references
      for (let i = 0; i < numFiles; i++) {
        const fileData = {
          id: `performance_test_mod:duplicate_test_${i}`,
          required_components: {
            actor: duplicateReferences.concat([`unique_mod_${i}:special`])
          },
          metadata: {
            shared_refs: duplicateReferences,
            unique_ref: `unique_mod_${i}:metadata`
          }
        };
        
        await fs.writeFile(
          path.join(testModPath, `duplicate_${i}.action.json`),
          JSON.stringify(fileData)
        );
      }
      
      const startTime = performance.now();
      const startMemory = process.memoryUsage();
      
      const references = await extractor.extractReferences(testModPath);
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      
      // Should process efficiently despite many duplicates
      expect(duration).toBeLessThan(1000);
      
      // Memory should not grow excessively due to duplicate string handling
      expect(memoryDelta).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
      
      // Should extract the correct unique references
      expect(references.has('common_mod')).toBe(true);
      expect(references.has('utility_mod')).toBe(true);
      expect(references.has('base_mod')).toBe(true);
      expect(references.get('common_mod')).toContain('shared');
      expect(references.get('utility_mod')).toContain('helper');
      expect(references.get('base_mod')).toContain('foundation');
      
      // Should have all unique mod references
      for (let i = 0; i < numFiles; i++) {
        expect(references.has(`unique_mod_${i}`)).toBe(true);
        expect(references.get(`unique_mod_${i}`)).toContain('special');
        // Note: metadata references are not extracted by ModReferenceExtractor
      }
      
      console.log(`Duplicate reference handling (${numFiles} files with duplicates):`);
      console.log(`- Duration: ${duration.toFixed(2)}ms`);
      console.log(`- Memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Unique mods: ${references.size}`);
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
                { get_component_value: ['actor', `stats_mod_${i % 5}:attribute_${i}`, 'value'] },
                i % 100
              ]
            },
            {
              if: [
                { has_component: ['target', `condition_mod_${i % 8}:check_${i}`] },
                { set_component_value: ['target', `effect_mod_${i % 6}:result_${i}`, 'active', true] },
                { add_component: ['target', `fallback_mod_${i % 4}:default_${i}`, { level: i }] }
              ]
            }
          ]
        });
      }
      
      const logicFileData = {
        id: 'performance_test_mod:complex_logic',
        condition: complexLogic
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
      const expectedModTypes = ['logic_mod', 'stats_mod', 'condition_mod', 'effect_mod', 'fallback_mod'];
      expectedModTypes.forEach(modType => {
        let found = false;
        for (const modId of references.keys()) {
          if (modId.startsWith(modType)) {
            found = true;
            break;
          }
        }
        expect(found).toBe(true);
      });
      
      console.log(`Complex JSON Logic performance (${numConditions} conditions):`);
      console.log(`- Duration: ${duration.toFixed(2)}ms`);
      console.log(`- Unique mods found: ${references.size}`);
      console.log(`- Conditions per ms: ${(numConditions / duration).toFixed(2)}`);
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
        { dir: 'scopes', count: 12, extension: '.scope' }
      ];
      
      const modDependencies = [
        'positioning', 'intimacy', 'social_interaction', 'emotion_system',
        'stats_management', 'relationship_tracking', 'conversation_engine',
        'animation_controller', 'ui_management', 'audio_system'
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
              scopeLines.push(`performance_test_mod:scope_${i}_${j} := actor.components.${depMod}:component_${j}.field`);
            }
            fileContent = scopeLines.join('\n');
          } else {
            // JSON file content
            fileContent = JSON.stringify({
              id: `performance_test_mod:${contentType.dir.slice(0, -1)}_${i}`,
              required_components: {
                actor: modDependencies.slice(0, 3).map((mod, idx) => `${mod}:component_${i}_${idx}`)
              },
              condition: {
                and: modDependencies.slice(3, 6).map((mod, idx) => ({
                  has_component: ['actor', `${mod}:state_${i}_${idx}`]
                }))
              },
              metadata: {
                dependencies: modDependencies.slice(6, 9).map((mod, idx) => `${mod}:metadata_${i}_${idx}`)
              }
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
      extractableMods.forEach(modId => {
        expect(references.has(modId)).toBe(true);
        expect(references.get(modId).size).toBeGreaterThan(0);
      });
      
      console.log(`Realistic game mod ecosystem (${totalFiles} files):`);
      console.log(`- Duration: ${duration.toFixed(2)}ms`);
      console.log(`- Memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Files per second: ${(totalFiles / (duration / 1000)).toFixed(2)}`);
      console.log(`- Dependencies found: ${references.size}`);
      console.log(`- Average components per mod: ${Array.from(references.values()).reduce((sum, set) => sum + set.size, 0) / references.size}`);
    }, 20000); // 20 second timeout for comprehensive test
  });
});