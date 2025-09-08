import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ModReferenceExtractor from '../../../src/validation/modReferenceExtractor.js';
import fs from 'fs/promises';

// Mock the fs module for testing
jest.mock('fs/promises');

describe('ModReferenceExtractor - Core Functionality', () => {
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
      ajvValidator: mockAjvValidator
    });

    // Reset fs mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor Validation', () => {
    it('should throw error when logger is missing', () => {
      expect(() => {
        new ModReferenceExtractor({
          logger: null,
          ajvValidator: mockAjvValidator
        });
      }).toThrow('Missing required dependency: ILogger');
    });

    it('should throw error when logger is missing required methods', () => {
      const invalidLogger = { info: jest.fn() }; // Missing debug, warn, error
      
      expect(() => {
        new ModReferenceExtractor({
          logger: invalidLogger,
          ajvValidator: mockAjvValidator
        });
      }).toThrow('Invalid or missing method');
    });

    it('should throw error when ajvValidator is missing', () => {
      expect(() => {
        new ModReferenceExtractor({
          logger: mockLogger,
          ajvValidator: null
        });
      }).toThrow('Missing required dependency: IAjvValidator');
    });

    it('should throw error when ajvValidator is missing validate method', () => {
      const invalidValidator = { someOtherMethod: jest.fn() };
      
      expect(() => {
        new ModReferenceExtractor({
          logger: mockLogger,
          ajvValidator: invalidValidator
        });
      }).toThrow('Invalid or missing method');
    });

    it('should create instance successfully with valid dependencies', () => {
      expect(extractor).toBeInstanceOf(ModReferenceExtractor);
    });
  });

  describe('extractReferences', () => {
    it('should throw error for invalid modPath parameter', async () => {
      await expect(extractor.extractReferences('')).rejects.toThrow();
      await expect(extractor.extractReferences(null)).rejects.toThrow();
      await expect(extractor.extractReferences(undefined)).rejects.toThrow();
    });

    it('should handle empty directory successfully', async () => {
      const testPath = '/test/mod/path';
      fs.readdir.mockResolvedValue([]);

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('Starting reference extraction for mod: path');
    });

    it('should handle directory with no matching files', async () => {
      const testPath = '/test/mod/path';
      fs.readdir.mockResolvedValue([
        { name: 'README.md', isFile: () => true, isDirectory: () => false },
        { name: 'package.json', isFile: () => true, isDirectory: () => false }
      ]);

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should log error and rethrow when directory access fails', async () => {
      const testPath = '/invalid/path';
      const error = new Error('Permission denied');
      fs.readdir.mockRejectedValue(error);

      await expect(extractor.extractReferences(testPath)).rejects.toThrow('Permission denied');
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to extract references from ${testPath}`,
        error
      );
    });
  });

  describe('File Processing', () => {
    it('should process JSON files and extract mod references', async () => {
      const testPath = '/test/mod/path';
      const jsonContent = {
        "forbidden_components": {
          "actor": ["intimacy:kissing", "positioning:sitting"]
        },
        "targets": {
          "primary": {
            "scope": "core:nearby_actors"
          }
        }
      };

      fs.readdir.mockResolvedValue([
        { name: 'test.action.json', isFile: () => true, isDirectory: () => false }
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(jsonContent));

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('intimacy')).toBe(true);
      expect(result.has('positioning')).toBe(true);
      expect(result.get('intimacy')).toEqual(new Set(['kissing']));
      expect(result.get('positioning')).toEqual(new Set(['sitting']));
      // core references should be skipped
      expect(result.has('core')).toBe(false);
    });

    it('should handle malformed JSON gracefully', async () => {
      const testPath = '/test/mod/path';
      
      fs.readdir.mockResolvedValue([
        { name: 'invalid.json', isFile: () => true, isDirectory: () => false }
      ]);
      fs.readFile.mockResolvedValue('{ invalid json }');

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process file invalid.json')
      );
    });

    it('should skip unsupported file extensions', async () => {
      const testPath = '/test/mod/path';
      
      fs.readdir.mockResolvedValue([
        { name: 'script.js', isFile: () => true, isDirectory: () => false },
        { name: 'style.css', isFile: () => true, isDirectory: () => false }
      ]);

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping file with unsupported extension')
      );
    });

    it('should handle scope files with placeholder implementation', async () => {
      const testPath = '/test/mod/path';
      
      fs.readdir.mockResolvedValue([
        { name: 'test.scope', isFile: () => true, isDirectory: () => false }
      ]);
      fs.readFile.mockResolvedValue('some scope content');

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Scope file processing not yet implemented')
      );
    });
  });

  describe('Reference Pattern Matching', () => {
    it('should extract mod references from various JSON structures', async () => {
      const testPath = '/test/mod/path';
      const jsonContent = {
        "stringValue": "intimacy:kissing",
        "arrayValue": ["positioning:sitting", "movement:walking"],
        "nestedObject": {
          "deepValue": "romance:dating",
          "arrayInObject": ["combat:fighting"]
        },
        "multipleInString": "Check intimacy:hugging and romance:flirting together"
      };

      fs.readdir.mockResolvedValue([
        { name: 'test.json', isFile: () => true, isDirectory: () => false }
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(jsonContent));

      const result = await extractor.extractReferences(testPath);

      expect(result.has('intimacy')).toBe(true);
      expect(result.has('positioning')).toBe(true);
      expect(result.has('movement')).toBe(true);
      expect(result.has('romance')).toBe(true);
      expect(result.has('combat')).toBe(true);
      
      expect(result.get('intimacy')).toEqual(new Set(['kissing', 'hugging']));
      expect(result.get('romance')).toEqual(new Set(['dating', 'flirting']));
    });

    it('should skip core, none, and self references', async () => {
      const testPath = '/test/mod/path';
      const jsonContent = {
        "coreRef": "core:actor",
        "noneRef": "none",
        "selfRef": "self",
        "validRef": "intimacy:kissing"
      };

      fs.readdir.mockResolvedValue([
        { name: 'test.json', isFile: () => true, isDirectory: () => false }
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(jsonContent));

      const result = await extractor.extractReferences(testPath);

      expect(result.has('core')).toBe(false);
      expect(result.has('none')).toBe(false);
      expect(result.has('self')).toBe(false);
      expect(result.has('intimacy')).toBe(true);
      expect(result.get('intimacy')).toEqual(new Set(['kissing']));
    });

    it('should handle edge cases in reference patterns', async () => {
      const testPath = '/test/mod/edgetest'; // Changed to avoid mod2 self-reference filtering
      const jsonContent = {
        "validPattern": "mod1:component1",
        "invalidPattern1": ":component", // No mod ID
        "invalidPattern2": "mod:", // No component ID
        "invalidPattern3": "123mod:component", // Invalid mod ID (starts with number)
        "validPattern2": "a:b", // Minimal valid case
        "boundaryTest": "prefix_mod2:component_name suffix"
      };

      fs.readdir.mockResolvedValue([
        { name: 'test.json', isFile: () => true, isDirectory: () => false }
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(jsonContent));

      const result = await extractor.extractReferences(testPath);

      expect(result.has('mod1')).toBe(true);
      expect(result.has('a')).toBe(true);
      expect(result.has('prefix_mod2')).toBe(true); // prefix_mod2 is one word, not mod2
      expect(result.get('mod1')).toEqual(new Set(['component1']));
      expect(result.get('a')).toEqual(new Set(['b']));
      expect(result.get('prefix_mod2')).toEqual(new Set(['component_name']));
    });
  });

  describe('Directory Traversal', () => {
    it('should recursively scan nested directories', async () => {
      const testPath = '/test/mod/path';
      
      // Mock nested directory structure
      fs.readdir
        .mockResolvedValueOnce([
          { name: 'actions', isFile: () => false, isDirectory: () => true },
          { name: 'rules', isFile: () => false, isDirectory: () => true }
        ])
        .mockResolvedValueOnce([
          { name: 'move.action.json', isFile: () => true, isDirectory: () => false }
        ])
        .mockResolvedValueOnce([
          { name: 'combat.rule.json', isFile: () => true, isDirectory: () => false }
        ]);

      fs.readFile
        .mockResolvedValueOnce('{"target": "positioning:close"}')
        .mockResolvedValueOnce('{"condition": "combat:engaged"}');

      const result = await extractor.extractReferences(testPath);

      expect(result.has('positioning')).toBe(true);
      expect(result.has('combat')).toBe(true);
      expect(result.get('positioning')).toEqual(new Set(['close']));
      expect(result.get('combat')).toEqual(new Set(['engaged']));
    });
  });

  describe('File Type Detection', () => {
    it('should correctly identify different JSON file types', async () => {
      const testPath = '/test/mod/path';
      
      fs.readdir.mockResolvedValue([
        { name: 'move.action.json', isFile: () => true, isDirectory: () => false },
        { name: 'combat.rule.json', isFile: () => true, isDirectory: () => false },
        { name: 'status.condition.json', isFile: () => true, isDirectory: () => false },
        { name: 'health.component.json', isFile: () => true, isDirectory: () => false },
        { name: 'death.event.json', isFile: () => true, isDirectory: () => false },
        { name: 'body.blueprint.json', isFile: () => true, isDirectory: () => false },
        { name: 'potion.recipe.json', isFile: () => true, isDirectory: () => false },
        { name: 'unknown.json', isFile: () => true, isDirectory: () => false }
      ]);

      fs.readFile.mockResolvedValue('{"ref": "test:component"}');

      const result = await extractor.extractReferences(testPath);

      // All files should be processed (8 files with same reference)
      expect(result.has('test')).toBe(true);
      expect(result.get('test')).toEqual(new Set(['component']));
      expect(fs.readFile).toHaveBeenCalledTimes(8);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should detect the positioning mod intimacy dependency violation', async () => {
      const testPath = '/test/mods/positioning';
      const turnAroundContent = {
        "$schema": "schema://living-narrative-engine/action.schema.json",
        "id": "positioning:turn_around",
        "name": "Turn Around",
        "targets": {
          "primary": {
            "scope": "positioning:close_actors_facing_each_other_or_behind_target"
          }
        },
        "required_components": {
          "actor": ["positioning:closeness"]
        },
        "forbidden_components": {
          "actor": ["intimacy:kissing"] // This is the violation!
        }
      };

      fs.readdir.mockResolvedValue([
        { name: 'actions', isFile: () => false, isDirectory: () => true }
      ]);
      fs.readdir.mockResolvedValueOnce([
        { name: 'turn_around.action.json', isFile: () => true, isDirectory: () => false }
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(turnAroundContent));

      const result = await extractor.extractReferences(testPath);

      expect(result.has('intimacy')).toBe(true);
      expect(result.get('intimacy')).toEqual(new Set(['kissing']));
      // positioning references to self should be excluded
      expect(result.has('positioning')).toBe(false);
    });
  });

  describe('Error Handling and Logging', () => {
    it('should continue processing other files when one file fails', async () => {
      const testPath = '/test/mod/path';
      
      fs.readdir.mockResolvedValue([
        { name: 'good.json', isFile: () => true, isDirectory: () => false },
        { name: 'bad.json', isFile: () => true, isDirectory: () => false }
      ]);
      
      fs.readFile
        .mockResolvedValueOnce('{"ref": "test:good"}')
        .mockRejectedValueOnce(new Error('File read error'));

      const result = await extractor.extractReferences(testPath);

      expect(result.has('test')).toBe(true);
      expect(result.get('test')).toEqual(new Set(['good']));
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process file bad.json')
      );
    });

    it('should log appropriate debug messages during processing', async () => {
      const testPath = '/test/mod/testmod';
      
      fs.readdir.mockResolvedValue([]);

      await extractor.extractReferences(testPath);

      expect(mockLogger.debug).toHaveBeenCalledWith('Starting reference extraction for mod: testmod');
      expect(mockLogger.info).toHaveBeenCalledWith('Extracted references for mod \'testmod\': ');
    });
  });
});