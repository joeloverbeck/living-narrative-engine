import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ModReferenceExtractor from '../../../src/validation/modReferenceExtractor.js';
import fs from 'fs/promises';

// Mock the fs module for testing
jest.mock('fs/promises');

describe('ModReferenceExtractor - Enhanced Performance Tests', () => {
  let testBed;
  let extractor;
  let mockLogger;
  let mockAjvValidator;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockAjvValidator = testBed.createMock('ajvValidator', ['validate']);

    extractor = new ModReferenceExtractor({
      logger: mockLogger,
      ajvValidator: mockAjvValidator,
    });

    // Reset fs mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Specialized File Type Processing Performance', () => {
    it('should process large action files efficiently with new specialized method', async () => {
      const testPath = '/test/mod/path';
      const largeActionData = {
        required_components: {
          actor: Array.from({ length: 100 }, (_, i) => `mod${i}:component${i}`),
        },
        forbidden_components: {
          target: Array.from(
            { length: 50 },
            (_, i) => `forbidmod${i}:comp${i}`
          ),
        },
        targets: {
          scope: 'positioning:complex_scope_with_many_actors',
        },
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'large.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(largeActionData));

      const startTime = performance.now();
      const result = await extractor.extractReferences(testPath);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
      expect(result.size).toBe(151); // 100 + 50 + 1 unique mods
      expect(result.get('positioning')).toContain(
        'complex_scope_with_many_actors'
      );
    });

    it('should handle large rule files with multiple operation handlers efficiently', async () => {
      const testPath = '/test/mod/path';
      const largeRuleData = {
        condition_ref: 'positioning:complex-condition',
        actions: Array.from({ length: 200 }, (_, i) => ({
          type: 'MODIFY_COMPONENT',
          component_type: `mod${Math.floor(i / 10)}:component${i}`,
          target: 'actor',
          parameters: {
            field: `field${i}`,
            value: `value${i}`,
          },
        })),
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'large.rule.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(largeRuleData));

      const startTime = performance.now();
      const result = await extractor.extractReferences(testPath);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(150); // Should complete in <150ms
      expect(result.size).toBeGreaterThan(15); // Should find many unique mod references
      expect(result.get('positioning')).toContain('complex-condition');
    });
  });

  describe('JSON Logic Processing Performance', () => {
    it('should handle deeply nested JSON Logic efficiently with new method', async () => {
      const testPath = '/test/mod/path';

      // Create deeply nested JSON Logic structure
      let deepLogic = { has_component: ['actor', 'test:component'] };
      for (let i = 0; i < 50; i++) {
        deepLogic = {
          and: [
            deepLogic,
            { has_component: ['actor', `mod${i}:comp${i}`] },
            {
              or: [
                { get_component_value: ['actor', `mod${i}:arousal`, 'level'] },
                { set_component_value: ['target', `mod${i}:position`, 'x'] },
              ],
            },
          ],
        };
      }

      const mockData = {
        condition: deepLogic,
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'deep.rule.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(mockData));

      const startTime = performance.now();
      const result = await extractor.extractReferences(testPath);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
      expect(result.size).toBeGreaterThan(40); // Should find most references
      expect(result.get('test')).toContain('component');
    });

    it('should efficiently process wide JSON Logic trees', async () => {
      const testPath = '/test/mod/path';

      // Create wide JSON Logic structure with many parallel conditions
      const wideLogic = {
        or: Array.from({ length: 100 }, (_, i) => ({
          and: [
            { has_component: ['actor', `mod${i}:component${i}`] },
            { get_component_value: ['actor', `mod${i}:data${i}`, 'value'] },
          ],
        })),
      };

      const mockData = {
        condition: wideLogic,
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'wide.condition.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(mockData));

      const startTime = performance.now();
      const result = await extractor.extractReferences(testPath);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(75); // Should handle wide trees efficiently
      expect(result.size).toBe(100); // Should find all unique mod references
    });
  });

  describe('Operation Handler Processing Performance', () => {
    it('should efficiently process large operation handler arrays', async () => {
      const testPath = '/test/mod/path';

      const largeOperationData = {
        actions: Array.from({ length: 300 }, (_, i) => {
          const opType = [
            'add_component',
            'remove_component',
            'modify_component',
          ][i % 3];
          return {
            type: opType,
            component: `mod${Math.floor(i / 5)}:comp${i}`,
            componentId: `mod${Math.floor(i / 7)}:othComp${i}`,
            target: 'actor',
            parameters: {
              component_type: `mod${Math.floor(i / 3)}:paramComp${i}`,
              field: `field${i}`,
              value: `value${i}`,
            },
          };
        }),
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'massive.rule.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(largeOperationData));

      const startTime = performance.now();
      const result = await extractor.extractReferences(testPath);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(200); // Should handle large operation sets
      expect(result.size).toBeGreaterThan(50); // Should find many unique references
    });
  });

  describe('Enhanced Pattern Matching Performance', () => {
    it('should efficiently process strings with many mod references', async () => {
      const testPath = '/test/mod/path';

      // Create a string with many mod references using different patterns
      const manyRefsString = Array.from({ length: 200 }, (_, i) => {
        const patterns = [
          `mod${i}:component${i}`,
          `mod${i}:component${i}.field${i}`,
          `Check mod${i}:component${i} status`,
          `mod${i}:component${i} := value${i}`,
        ];
        return patterns[i % 4];
      }).join(' and ');

      const mockData = {
        description: manyRefsString,
        otherField: `Also check ${manyRefsString}`,
      };

      fs.readdir.mockResolvedValue([
        { name: 'manyRefs.json', isFile: () => true, isDirectory: () => false },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(mockData));

      const startTime = performance.now();
      const result = await extractor.extractReferences(testPath);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should handle many patterns efficiently
      expect(result.size).toBe(200); // Should find all unique mod references
    });

    it('should maintain performance with enhanced context logging disabled', async () => {
      const testPath = '/test/mod/path';

      // Disable debug logging for performance test
      mockLogger.debug.mockImplementation(() => {});

      const complexData = {
        required_components: {
          actor: Array.from({ length: 100 }, (_, i) => `mod${i}:comp${i}`),
        },
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'complex.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(complexData));

      const startTime = performance.now();
      await extractor.extractReferences(testPath);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(80); // Should be fast without debug logging
    });
  });

  describe('Error Handling Performance', () => {
    it('should maintain performance with enhanced error handling', async () => {
      const testPath = '/test/mod/path';

      // Create mix of good and bad files
      fs.readdir.mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => ({
          name: `file${i}.json`,
          isFile: () => true,
          isDirectory: () => false,
        }))
      );

      // Mock some files to be malformed, others valid
      fs.readFile.mockImplementation((filePath) => {
        if (
          filePath.includes('file5.json') ||
          filePath.includes('file15.json') ||
          filePath.includes('file25.json')
        ) {
          return Promise.resolve('{ malformed json }');
        }
        return Promise.resolve('{"ref": "test:component"}');
      });

      const startTime = performance.now();
      const result = await extractor.extractReferences(testPath);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(500); // Should handle errors efficiently
      expect(result.get('test')).toContain('component');
      expect(mockLogger.warn).toHaveBeenCalledTimes(3); // Three malformed files
    });
  });

  describe('Memory Efficiency', () => {
    it('should handle large result maps efficiently', async () => {
      const testPath = '/test/mod/path';

      // Create data that will generate large reference maps
      const massiveData = {
        components: Object.fromEntries(
          Array.from({ length: 1000 }, (_, i) => [
            `field${i}`,
            `mod${i}:comp${i}`,
          ])
        ),
      };

      fs.readdir.mockResolvedValue([
        { name: 'massive.json', isFile: () => true, isDirectory: () => false },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(massiveData));

      const startTime = performance.now();
      const result = await extractor.extractReferences(testPath);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(300); // Should handle large maps
      expect(result.size).toBe(1000); // Should create 1000 mod entries

      // Verify memory structure
      for (let i = 0; i < 10; i++) {
        expect(result.get(`mod${i}`)).toContain(`comp${i}`);
      }
    });
  });

  describe('Combined Workload Performance', () => {
    it('should handle mixed file types with various complexity levels efficiently', async () => {
      const testPath = '/test/mod/path';

      const complexAction = {
        required_components: {
          actor: Array.from(
            { length: 50 },
            (_, i) => `action_mod${i}:comp${i}`
          ),
        },
        condition: {
          and: Array.from({ length: 20 }, (_, i) => ({
            has_component: ['actor', `action_logic${i}:comp${i}`],
          })),
        },
      };

      const complexRule = {
        actions: Array.from({ length: 100 }, (_, i) => ({
          type: 'MODIFY_COMPONENT',
          component_type: `rule_mod${i}:comp${i}`,
        })),
      };

      const complexComponent = {
        dataSchema: {
          properties: Object.fromEntries(
            Array.from({ length: 30 }, (_, i) => [
              `field${i}`,
              {
                description: `Reference to comp_mod${i}:comp${i}`,
              },
            ])
          ),
        },
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'complex.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: 'complex.rule.json',
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: 'complex.component.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);

      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(complexAction))
        .mockResolvedValueOnce(JSON.stringify(complexRule))
        .mockResolvedValueOnce(JSON.stringify(complexComponent));

      const startTime = performance.now();
      const result = await extractor.extractReferences(testPath);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(250); // Should handle mixed workload
      expect(result.size).toBeGreaterThan(150); // Should find references from all file types

      // Verify different file type processing
      expect(Array.from(result.keys())).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^action_mod\d+$/),
          expect.stringMatching(/^rule_mod\d+$/),
          expect.stringMatching(/^comp_mod\d+$/),
        ])
      );
    });
  });
});
