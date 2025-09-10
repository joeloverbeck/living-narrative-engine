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
      ajvValidator: mockAjvValidator,
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
          ajvValidator: mockAjvValidator,
        });
      }).toThrow('Missing required dependency: ILogger');
    });

    it('should throw error when logger is missing required methods', () => {
      const invalidLogger = { info: jest.fn() }; // Missing debug, warn, error

      expect(() => {
        new ModReferenceExtractor({
          logger: invalidLogger,
          ajvValidator: mockAjvValidator,
        });
      }).toThrow('Invalid or missing method');
    });

    it('should throw error when ajvValidator is missing', () => {
      expect(() => {
        new ModReferenceExtractor({
          logger: mockLogger,
          ajvValidator: null,
        });
      }).toThrow('Missing required dependency: IAjvValidator');
    });

    it('should throw error when ajvValidator is missing validate method', () => {
      const invalidValidator = { someOtherMethod: jest.fn() };

      expect(() => {
        new ModReferenceExtractor({
          logger: mockLogger,
          ajvValidator: invalidValidator,
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
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Starting reference extraction for mod: path'
      );
    });

    it('should handle directory with no matching files', async () => {
      const testPath = '/test/mod/path';
      fs.readdir.mockResolvedValue([
        { name: 'README.md', isFile: () => true, isDirectory: () => false },
        { name: 'package.json', isFile: () => true, isDirectory: () => false },
      ]);

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should log error and rethrow when directory access fails', async () => {
      const testPath = '/invalid/path';
      const error = new Error('Permission denied');
      fs.readdir.mockRejectedValue(error);

      await expect(extractor.extractReferences(testPath)).rejects.toThrow(
        'Permission denied'
      );
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
        forbidden_components: {
          actor: ['intimacy:kissing', 'positioning:sitting'],
        },
        targets: {
          primary: {
            scope: 'core:nearby_actors',
          },
        },
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'test.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
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
        { name: 'invalid.json', isFile: () => true, isDirectory: () => false },
      ]);
      fs.readFile.mockResolvedValue('{ invalid json }');

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process invalid.json (.json)'),
        expect.objectContaining({
          filePath: expect.stringContaining('invalid.json'),
          fileType: '.json',
        })
      );
    });

    it('should skip unsupported file extensions', async () => {
      const testPath = '/test/mod/path';

      fs.readdir.mockResolvedValue([
        { name: 'script.js', isFile: () => true, isDirectory: () => false },
        { name: 'style.css', isFile: () => true, isDirectory: () => false },
      ]);

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping unsupported file')
      );
    });

    it('should process scope files and extract mod references', async () => {
      const testPath = '/test/mod/path';
      const scopeContent = `
        // Comment should be ignored
        positioning:close_actors := actor.components.positioning:closeness.partners
        intimacy:attracted_actors := actor.components.intimacy:attraction.targets
      `;

      fs.readdir.mockResolvedValue([
        { name: 'test.scope', isFile: () => true, isDirectory: () => false },
      ]);
      fs.readFile.mockResolvedValue(scopeContent);

      const result = await extractor.extractReferences(testPath);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('positioning')).toBe(true);
      expect(result.has('intimacy')).toBe(true);
      expect(result.get('positioning')).toContain('closeness');
      expect(result.get('intimacy')).toContain('attraction');
    });
  });

  describe('Reference Pattern Matching', () => {
    it('should extract mod references from various JSON structures', async () => {
      const testPath = '/test/mod/path';
      const jsonContent = {
        stringValue: 'intimacy:kissing',
        arrayValue: ['positioning:sitting', 'movement:walking'],
        nestedObject: {
          deepValue: 'romance:dating',
          arrayInObject: ['combat:fighting'],
        },
        multipleInString:
          'Check intimacy:hugging and romance:flirting together',
      };

      fs.readdir.mockResolvedValue([
        { name: 'test.json', isFile: () => true, isDirectory: () => false },
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
        coreRef: 'core:actor',
        noneRef: 'none',
        selfRef: 'self',
        validRef: 'intimacy:kissing',
      };

      fs.readdir.mockResolvedValue([
        { name: 'test.json', isFile: () => true, isDirectory: () => false },
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
        validPattern: 'mod1:component1',
        invalidPattern1: ':component', // No mod ID
        invalidPattern2: 'mod:', // No component ID
        invalidPattern3: '123mod:component', // Invalid mod ID (starts with number)
        validPattern2: 'a:b', // Minimal valid case
        boundaryTest: 'prefix_mod2:component_name suffix',
      };

      fs.readdir.mockResolvedValue([
        { name: 'test.json', isFile: () => true, isDirectory: () => false },
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
          { name: 'rules', isFile: () => false, isDirectory: () => true },
        ])
        .mockResolvedValueOnce([
          {
            name: 'move.action.json',
            isFile: () => true,
            isDirectory: () => false,
          },
        ])
        .mockResolvedValueOnce([
          {
            name: 'combat.rule.json',
            isFile: () => true,
            isDirectory: () => false,
          },
        ]);

      fs.readFile
        .mockResolvedValueOnce('{"target": "othermods:close"}')
        .mockResolvedValueOnce('{"condition": "violence:engaged"}');

      const result = await extractor.extractReferences(testPath);

      expect(result.has('othermods')).toBe(true);
      expect(result.has('violence')).toBe(true);
      expect(result.get('othermods')).toEqual(new Set(['close']));
      expect(result.get('violence')).toEqual(new Set(['engaged']));
    });
  });

  describe('File Type Detection', () => {
    it('should correctly identify different JSON file types', async () => {
      const testPath = '/test/mod/path';

      fs.readdir.mockResolvedValue([
        {
          name: 'move.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: 'combat.rule.json',
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: 'status.condition.json',
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: 'health.component.json',
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: 'death.event.json',
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: 'body.blueprint.json',
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: 'potion.recipe.json',
          isFile: () => true,
          isDirectory: () => false,
        },
        { name: 'unknown.json', isFile: () => true, isDirectory: () => false },
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
        $schema: 'schema://living-narrative-engine/action.schema.json',
        id: 'positioning:turn_around',
        name: 'Turn Around',
        targets: {
          primary: {
            scope:
              'positioning:close_actors_facing_each_other_or_behind_target',
          },
        },
        required_components: {
          actor: ['positioning:closeness'],
        },
        forbidden_components: {
          actor: ['intimacy:kissing'], // This is the violation!
        },
      };

      fs.readdir.mockResolvedValue([
        { name: 'actions', isFile: () => false, isDirectory: () => true },
      ]);
      fs.readdir.mockResolvedValueOnce([
        {
          name: 'turn_around.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
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
        { name: 'bad.json', isFile: () => true, isDirectory: () => false },
      ]);

      fs.readFile
        .mockResolvedValueOnce('{"ref": "test:good"}')
        .mockRejectedValueOnce(new Error('File read error'));

      const result = await extractor.extractReferences(testPath);

      expect(result.has('test')).toBe(true);
      expect(result.get('test')).toEqual(new Set(['good']));
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process bad.json (.json)'),
        expect.objectContaining({
          filePath: expect.stringContaining('bad.json'),
          fileType: '.json',
        })
      );
    });

    it('should log appropriate debug messages during processing', async () => {
      const testPath = '/test/mod/testmod';

      fs.readdir.mockResolvedValue([]);

      await extractor.extractReferences(testPath);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Starting reference extraction for mod: testmod'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Extracted references for mod 'testmod': "
      );
    });
  });

  describe('Enhanced JSON Processing - Specialized File Types', () => {
    describe('Action Files', () => {
      it('should extract required components', async () => {
        const testPath = '/test/mod/path';
        const mockActionData = {
          required_components: {
            actor: ['positioning:closeness', 'intimacy:arousal'],
            target: ['core:actor'],
          },
        };

        fs.readdir.mockResolvedValue([
          {
            name: 'test.action.json',
            isFile: () => true,
            isDirectory: () => false,
          },
        ]);
        fs.readFile.mockResolvedValue(JSON.stringify(mockActionData));

        const result = await extractor.extractReferences(testPath);

        expect(result.has('positioning')).toBe(true);
        expect(result.has('intimacy')).toBe(true);
        expect(result.has('core')).toBe(false); // Core should be filtered out
        expect(result.get('positioning')).toContain('closeness');
        expect(result.get('intimacy')).toContain('arousal');
      });

      it('should extract forbidden components', async () => {
        const testPath = '/test/mod/path';
        const mockActionData = {
          forbidden_components: {
            actor: ['intimacy:kissing', 'violence:attacking'],
          },
        };

        fs.readdir.mockResolvedValue([
          {
            name: 'test.action.json',
            isFile: () => true,
            isDirectory: () => false,
          },
        ]);
        fs.readFile.mockResolvedValue(JSON.stringify(mockActionData));

        const result = await extractor.extractReferences(testPath);

        expect(result.get('intimacy')).toContain('kissing');
        expect(result.get('violence')).toContain('attacking');
      });

      it('should extract target scopes', async () => {
        const testPath = '/test/mod/path';
        const mockActionData = {
          targets: {
            scope: 'positioning:close_actors_facing_each_other',
          },
        };

        fs.readdir.mockResolvedValue([
          {
            name: 'test.action.json',
            isFile: () => true,
            isDirectory: () => false,
          },
        ]);
        fs.readFile.mockResolvedValue(JSON.stringify(mockActionData));

        const result = await extractor.extractReferences(testPath);

        expect(result.get('positioning')).toContain(
          'close_actors_facing_each_other'
        );
      });

      it('should extract targets as string', async () => {
        const testPath = '/test/mod/path';
        const mockActionData = {
          targets: 'intimacy:close_actors_facing_each_other',
        };

        fs.readdir.mockResolvedValue([
          {
            name: 'test.action.json',
            isFile: () => true,
            isDirectory: () => false,
          },
        ]);
        fs.readFile.mockResolvedValue(JSON.stringify(mockActionData));

        const result = await extractor.extractReferences(testPath);

        expect(result.get('intimacy')).toContain(
          'close_actors_facing_each_other'
        );
      });
    });

    describe('Rule Files', () => {
      it('should extract condition references', async () => {
        const testPath = '/test/mod/path';
        const mockRuleData = {
          condition_ref: 'positioning:event-is-action-turn-around',
        };

        fs.readdir.mockResolvedValue([
          {
            name: 'test.rule.json',
            isFile: () => true,
            isDirectory: () => false,
          },
        ]);
        fs.readFile.mockResolvedValue(JSON.stringify(mockRuleData));

        const result = await extractor.extractReferences(testPath);

        expect(result.get('positioning')).toContain(
          'event-is-action-turn-around'
        );
      });

      it('should extract nested condition references', async () => {
        const testPath = '/test/mod/path';
        const mockRuleData = {
          condition: {
            condition_ref: 'intimacy:has-arousal-level',
          },
        };

        fs.readdir.mockResolvedValue([
          {
            name: 'test.rule.json',
            isFile: () => true,
            isDirectory: () => false,
          },
        ]);
        fs.readFile.mockResolvedValue(JSON.stringify(mockRuleData));

        const result = await extractor.extractReferences(testPath);

        expect(result.get('intimacy')).toContain('has-arousal-level');
      });

      it('should handle actions array with operations', async () => {
        const testPath = '/test/mod/path';
        const mockRuleData = {
          actions: [
            {
              type: 'MODIFY_COMPONENT',
              component_type: 'positioning:closeness',
              target: 'actor',
            },
          ],
        };

        fs.readdir.mockResolvedValue([
          {
            name: 'test.rule.json',
            isFile: () => true,
            isDirectory: () => false,
          },
        ]);
        fs.readFile.mockResolvedValue(JSON.stringify(mockRuleData));

        const result = await extractor.extractReferences(testPath);

        expect(result.get('positioning')).toContain('closeness');
      });
    });

    describe('Component Files', () => {
      it('should extract schema references', async () => {
        const testPath = '/test/mod/path';
        const mockComponentData = {
          dataSchema: {
            properties: {
              partner: {
                description: 'Reference to intimacy:kissing partner',
              },
            },
          },
        };

        fs.readdir.mockResolvedValue([
          {
            name: 'test.component.json',
            isFile: () => true,
            isDirectory: () => false,
          },
        ]);
        fs.readFile.mockResolvedValue(JSON.stringify(mockComponentData));

        const result = await extractor.extractReferences(testPath);

        expect(result.get('intimacy')).toContain('kissing');
      });

      it('should extract default data references', async () => {
        const testPath = '/test/mod/path';
        const mockComponentData = {
          defaultData: {
            component: 'positioning:closeness',
            value: 'close',
          },
        };

        fs.readdir.mockResolvedValue([
          {
            name: 'test.component.json',
            isFile: () => true,
            isDirectory: () => false,
          },
        ]);
        fs.readFile.mockResolvedValue(JSON.stringify(mockComponentData));

        const result = await extractor.extractReferences(testPath);

        expect(result.get('positioning')).toContain('closeness');
      });
    });
  });

  describe('JSON Logic Processing', () => {
    it('should extract component references from has_component operators', async () => {
      const testPath = '/test/mod/path';
      const mockData = {
        condition: {
          and: [
            { has_component: ['actor', 'intimacy:arousal'] },
            { has_component: ['target', 'positioning:closeness'] },
          ],
        },
      };

      fs.readdir.mockResolvedValue([
        { name: 'test.json', isFile: () => true, isDirectory: () => false },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(mockData));

      const result = await extractor.extractReferences(testPath);

      expect(result.get('intimacy')).toContain('arousal');
      expect(result.get('positioning')).toContain('closeness');
    });

    it('should extract nested JSON Logic references', async () => {
      const testPath = '/test/mod/path';
      const complexLogic = {
        condition: {
          or: [
            {
              and: [
                { has_component: ['actor', 'intimacy:kissing'] },
                {
                  '>=': [
                    {
                      get_component_value: [
                        'actor',
                        'intimacy:arousal',
                        'level',
                      ],
                    },
                    50,
                  ],
                },
              ],
            },
            { has_component: ['actor', 'violence:attacking'] },
          ],
        },
      };

      fs.readdir.mockResolvedValue([
        { name: 'test.json', isFile: () => true, isDirectory: () => false },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(complexLogic));

      const result = await extractor.extractReferences(testPath);

      expect(result.get('intimacy')).toContain('kissing');
      expect(result.get('intimacy')).toContain('arousal');
      expect(result.get('violence')).toContain('attacking');
    });

    it('should handle various component operators', async () => {
      const testPath = '/test/mod/path';
      const mockData = {
        condition: {
          and: [
            {
              set_component_value: ['actor', 'positioning:facing', 'direction'],
            },
            { remove_component: ['actor', 'intimacy:kissing'] },
            { add_component: ['actor', 'violence:fighting', { level: 1 }] },
          ],
        },
      };

      fs.readdir.mockResolvedValue([
        { name: 'test.json', isFile: () => true, isDirectory: () => false },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(mockData));

      const result = await extractor.extractReferences(testPath);

      expect(result.get('positioning')).toContain('facing');
      expect(result.get('intimacy')).toContain('kissing');
      expect(result.get('violence')).toContain('fighting');
    });
  });

  describe('Operation Handler Processing', () => {
    it('should extract references from component operations', async () => {
      const testPath = '/test/mod/path';
      const mockData = {
        actions: [
          {
            type: 'add_component',
            target: 'actor',
            component: 'intimacy:arousal',
            data: { level: 25 },
          },
          {
            type: 'set_component_value',
            target: 'actor',
            componentId: 'positioning:closeness',
            field: 'distance',
            value: 'close',
          },
        ],
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'test.rule.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(mockData));

      const result = await extractor.extractReferences(testPath);

      expect(result.get('intimacy')).toContain('arousal');
      expect(result.get('positioning')).toContain('closeness');
    });

    it('should extract from operation parameters', async () => {
      const testPath = '/test/mod/path';
      const mockData = {
        actions: [
          {
            type: 'QUERY_COMPONENT',
            parameters: {
              entity_ref: '{event.payload.actorId}',
              component_type: 'positioning:sitting_on',
              result_variable: 'sittingInfo',
            },
          },
        ],
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'test.rule.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(mockData));

      const result = await extractor.extractReferences(testPath);

      expect(result.get('positioning')).toContain('sitting_on');
    });
  });

  describe('Enhanced Pattern Matching', () => {
    it('should extract component access patterns', async () => {
      const testPath = '/test/mod/path';
      const mockData = {
        value:
          'Check intimacy:arousal.level and positioning:closeness.distance',
      };

      fs.readdir.mockResolvedValue([
        { name: 'test.json', isFile: () => true, isDirectory: () => false },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(mockData));

      const result = await extractor.extractReferences(testPath);

      expect(result.get('intimacy')).toContain('arousal');
      expect(result.get('positioning')).toContain('closeness');
    });

    it('should log context for debugging when enabled', async () => {
      const testPath = '/test/mod/path';
      const mockData = {
        required_components: {
          actor: ['positioning:closeness'],
        },
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'test.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(mockData));

      await extractor.extractReferences(testPath);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Found reference positioning:closeness in required_components'
        )
      );
    });
  });

  describe('File Type Detection', () => {
    it('should correctly identify different JSON file types', async () => {
      const testPath = '/test/mod/path';

      fs.readdir.mockResolvedValue([
        {
          name: 'move.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: 'combat.rule.json',
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: 'status.condition.json',
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: 'health.component.json',
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: 'death.event.json',
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: 'body.blueprint.json',
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: 'potion.recipe.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);

      fs.readFile.mockResolvedValue('{"ref": "test:component"}');

      const result = await extractor.extractReferences(testPath);

      // All files should be processed (7 files with same reference)
      expect(result.has('test')).toBe(true);
      expect(result.get('test')).toEqual(new Set(['component']));
      expect(fs.readFile).toHaveBeenCalledTimes(7);
    });
  });

  describe('Enhanced Error Handling', () => {
    it('should provide enhanced error context', async () => {
      const testPath = '/test/mod/path';

      fs.readdir.mockResolvedValue([
        {
          name: 'malformed.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue('{ invalid json }');

      await extractor.extractReferences(testPath);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to process malformed.action.json (.json)'
        ),
        expect.objectContaining({
          filePath: expect.stringContaining('malformed.action.json'),
          fileType: '.json',
          error: expect.any(String),
        })
      );
    });

    it('should handle null/undefined data gracefully', async () => {
      const testPath = '/test/mod/path';
      const mockData = null;

      fs.readdir.mockResolvedValue([
        {
          name: 'empty.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(mockData));

      const result = await extractor.extractReferences(testPath);

      expect(result.size).toBe(0);
    });

    it('should handle operations with missing fields', async () => {
      const testPath = '/test/mod/path';
      const mockData = {
        actions: [null, undefined, {}, { type: 'UNKNOWN' }],
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'test.rule.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(mockData));

      const result = await extractor.extractReferences(testPath);

      expect(result.size).toBe(0);
    });
  });

  describe('Real-world Integration Scenarios', () => {
    it('should detect the positioning mod intimacy dependency violation', async () => {
      const testPath = '/test/mods/positioning';
      const turnAroundContent = {
        $schema: 'schema://living-narrative-engine/action.schema.json',
        id: 'positioning:turn_around',
        name: 'Turn Around',
        targets: {
          primary: {
            scope:
              'positioning:close_actors_facing_each_other_or_behind_target',
          },
        },
        required_components: {
          actor: ['positioning:closeness'],
        },
        forbidden_components: {
          actor: ['intimacy:kissing'], // This is the violation!
        },
      };

      fs.readdir.mockResolvedValue([
        { name: 'actions', isFile: () => false, isDirectory: () => true },
      ]);
      fs.readdir.mockResolvedValueOnce([
        {
          name: 'turn_around.action.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(turnAroundContent));

      const result = await extractor.extractReferences(testPath);

      expect(result.has('intimacy')).toBe(true);
      expect(result.get('intimacy')).toEqual(new Set(['kissing']));
      // positioning references to self should be excluded
      expect(result.has('positioning')).toBe(false);
    });

    it('should handle complex rule files with multiple reference types', async () => {
      const testPath = '/test/mods/positioning';
      const complexRuleContent = {
        rule_id: 'handle_get_up_from_furniture',
        condition: {
          condition_ref: 'positioning:event-is-action-get-up-from-furniture',
        },
        actions: [
          {
            type: 'QUERY_COMPONENT',
            parameters: {
              component_type: 'positioning:sitting_on',
            },
          },
          {
            type: 'REMOVE_SITTING_CLOSENESS',
            parameters: {
              furniture_id: '{event.payload.targetId}',
            },
          },
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              component_type: 'positioning:allows_sitting',
            },
          },
        ],
      };

      fs.readdir.mockResolvedValue([
        {
          name: 'complex.rule.json',
          isFile: () => true,
          isDirectory: () => false,
        },
      ]);
      fs.readFile.mockResolvedValue(JSON.stringify(complexRuleContent));

      const result = await extractor.extractReferences(testPath);

      // Should find multiple positioning references but filter self-references
      expect(result.has('positioning')).toBe(false); // Self-references filtered
    });
  });

  describe('Scope DSL Processing', () => {
    // Mock the parseScopeDefinitions function
    beforeEach(() => {
      jest.mock('../../../src/scopeDsl/scopeDefinitionParser.js', () => ({
        parseScopeDefinitions: jest.fn(),
      }));
    });

    describe('Basic Scope Definitions', () => {
      it('should extract references from simple scope assignments', async () => {
        const testPath = '/test/mod/path';
        const scopeContent = `
          positioning:close_actors := actor.components.positioning:closeness.partners
          intimacy:attracted_actors := actor.components.intimacy:attraction.targets
        `;

        fs.readdir.mockResolvedValue([
          { name: 'test.scope', isFile: () => true, isDirectory: () => false },
        ]);
        fs.readFile.mockResolvedValue(scopeContent);

        const result = await extractor.extractReferences(testPath);

        expect(result.has('positioning')).toBe(true);
        expect(result.has('intimacy')).toBe(true);
        expect(result.get('positioning')).toContain('closeness');
        expect(result.get('intimacy')).toContain('attraction');
      });

      it('should extract component references from expressions', async () => {
        const testPath = '/test/mod/path';
        const scopeContent = `
          test:scope := actor.components.positioning:closeness.partners
        `;

        fs.readdir.mockResolvedValue([
          { name: 'test.scope', isFile: () => true, isDirectory: () => false },
        ]);
        fs.readFile.mockResolvedValue(scopeContent);

        const result = await extractor.extractReferences(testPath);

        expect(result.get('positioning')).toContain('closeness');
      });
    });

    describe('Complex Scope Expressions', () => {
      it('should handle filtered access with JSON Logic', async () => {
        const testPath = '/test/mod/path';
        const scopeContent = `
          intimacy:available_partners := actor.components.positioning:closeness.partners[
            {
              "and": [
                {"has_component": ["item", "intimacy:attraction"]},
                {">=": [{"get_component_value": ["item", "intimacy:attraction", "level"]}, 30]}
              ]
            }
          ]
        `;

        fs.readdir.mockResolvedValue([
          { name: 'test.scope', isFile: () => true, isDirectory: () => false },
        ]);
        fs.readFile.mockResolvedValue(scopeContent);

        const result = await extractor.extractReferences(testPath);

        expect(result.get('positioning')).toContain('closeness');
        expect(result.get('intimacy')).toContain('attraction');
      });

      it('should handle union expressions with pipe operator', async () => {
        const testPath = '/test/mod/path';
        const scopeContent = `
          positioning:all_nearby := actor.components.positioning:closeness.partners | actor.followers
        `;

        fs.readdir.mockResolvedValue([
          { name: 'test.scope', isFile: () => true, isDirectory: () => false },
        ]);
        fs.readFile.mockResolvedValue(scopeContent);

        const result = await extractor.extractReferences(testPath);

        expect(result.get('positioning')).toContain('closeness');
      });

      it('should handle union expressions with plus operator', async () => {
        const testPath = '/test/mod/path';
        const scopeContent = `
          intimacy:all_connections := actor.partners + actor.components.intimacy:bond.targets
        `;

        fs.readdir.mockResolvedValue([
          { name: 'test.scope', isFile: () => true, isDirectory: () => false },
        ]);
        fs.readFile.mockResolvedValue(scopeContent);

        const result = await extractor.extractReferences(testPath);

        expect(result.get('intimacy')).toContain('bond');
      });

      it('should handle array iterations', async () => {
        const testPath = '/test/mod/path';
        const scopeContent = `
          positioning:furniture_users := actor.components.positioning:sitting.furniture.users[]
        `;

        fs.readdir.mockResolvedValue([
          { name: 'test.scope', isFile: () => true, isDirectory: () => false },
        ]);
        fs.readFile.mockResolvedValue(scopeContent);

        const result = await extractor.extractReferences(testPath);

        expect(result.get('positioning')).toContain('sitting');
      });

      it('should handle condition_ref in filters', async () => {
        const testPath = '/test/mod/path';
        const scopeContent = `
          intimacy:close_actors_facing := actor.components.positioning:closeness.partners[][{
            "condition_ref": "positioning:both-actors-facing-each-other"
          }]
        `;

        fs.readdir.mockResolvedValue([
          { name: 'test.scope', isFile: () => true, isDirectory: () => false },
        ]);
        fs.readFile.mockResolvedValue(scopeContent);

        const result = await extractor.extractReferences(testPath);

        expect(result.get('positioning')).toContain('closeness');
        expect(result.get('positioning')).toContain(
          'both-actors-facing-each-other'
        );
      });
    });

    describe('Error Handling', () => {
      it('should use regex fallback when parser fails', async () => {
        const testPath = '/test/mod/path';
        const malformedContent = `
          invalid syntax without assignment but has intimacy:kissing reference
          and positioning:sitting references
        `;

        fs.readdir.mockResolvedValue([
          { name: 'test.scope', isFile: () => true, isDirectory: () => false },
        ]);
        fs.readFile.mockResolvedValue(malformedContent);

        const result = await extractor.extractReferences(testPath);

        // Should still extract references via regex fallback
        expect(result.get('intimacy')).toContain('kissing');
        expect(result.get('positioning')).toContain('sitting');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to parse scope file test.scope')
        );
      });

      it('should handle mixed valid and invalid scope definitions', async () => {
        const testPath = '/test/mod/path';
        const partialContent = `
          positioning:valid_scope := actor.components.positioning:closeness
          invalid_scope_without_assignment := 
          another:valid := actor.components.intimacy:attraction
        `;

        fs.readdir.mockResolvedValue([
          { name: 'test.scope', isFile: () => true, isDirectory: () => false },
        ]);
        fs.readFile.mockResolvedValue(partialContent);

        const result = await extractor.extractReferences(testPath);

        // Should extract what it can
        expect(result.has('positioning')).toBe(true);
        expect(result.has('intimacy')).toBe(true);
      });
    });

    describe('Real-world Scope Files', () => {
      it('should process intimacy mod scope file correctly', async () => {
        const testPath = '/test/mod/path';
        const realWorldContent = `
          // Scope for actors in closeness who are facing each other
          // Used by actions that require face-to-face interaction
          intimacy:close_actors_facing_each_other := actor.components.positioning:closeness.partners[][{
            "condition_ref": "positioning:both-actors-facing-each-other"
          }]
        `;

        fs.readdir.mockResolvedValue([
          {
            name: 'close_actors_facing_each_other.scope',
            isFile: () => true,
            isDirectory: () => false,
          },
        ]);
        fs.readFile.mockResolvedValue(realWorldContent);

        const result = await extractor.extractReferences(testPath);

        expect(result.get('intimacy')).toContain(
          'close_actors_facing_each_other'
        );
        expect(result.get('positioning')).toContain('closeness');
        expect(result.get('positioning')).toContain(
          'both-actors-facing-each-other'
        );
      });

      it('should handle complex union examples', async () => {
        const testPath = '/test/mod/path';
        const unionExamples = `
          # Union Operator Examples
          all_connections := actor.followers | actor.partners | actor.components.intimacy:friends
          close_connections := actor.partners + actor.components.intimacy:family
          mixed_example := actor.followers + actor.friends | actor.partners
        `;

        fs.readdir.mockResolvedValue([
          {
            name: 'union-examples.scope',
            isFile: () => true,
            isDirectory: () => false,
          },
        ]);
        fs.readFile.mockResolvedValue(unionExamples);

        const result = await extractor.extractReferences(testPath);

        expect(result.get('intimacy')).toContain('friends');
        expect(result.get('intimacy')).toContain('family');
      });
    });

    describe('Performance', () => {
      it('should handle large scope files efficiently', async () => {
        const testPath = '/test/mod/path';
        const largeContent = Array.from(
          { length: 100 },
          (_, i) =>
            `mod${i}:scope${i} := actor.components.mod${i}:component${i}.field`
        ).join('\n');

        fs.readdir.mockResolvedValue([
          { name: 'large.scope', isFile: () => true, isDirectory: () => false },
        ]);
        fs.readFile.mockResolvedValue(largeContent);

        const startTime = performance.now();
        const result = await extractor.extractReferences(testPath);
        const endTime = performance.now();

        expect(endTime - startTime).toBeLessThan(200); // <200ms for 100 definitions
        expect(result.size).toBeGreaterThan(0);
      });
    });

    describe('Scope Reference Patterns', () => {
      it('should skip core, none, and self references in scope files', async () => {
        const testPath = '/test/mod/path';
        const scopeContent = `
          core:test := actor.components.core:actor
          none:test := none
          self:test := self
          intimacy:valid := actor.components.intimacy:attraction
        `;

        fs.readdir.mockResolvedValue([
          { name: 'test.scope', isFile: () => true, isDirectory: () => false },
        ]);
        fs.readFile.mockResolvedValue(scopeContent);

        const result = await extractor.extractReferences(testPath);

        expect(result.has('core')).toBe(false);
        expect(result.has('none')).toBe(false);
        expect(result.has('self')).toBe(false);
        expect(result.has('intimacy')).toBe(true);
      });

      it('should handle entity source references', async () => {
        const testPath = '/test/mod/path';
        const scopeContent = `
          test:all_items := entities(intimacy:special_item)
        `;

        fs.readdir.mockResolvedValue([
          { name: 'test.scope', isFile: () => true, isDirectory: () => false },
        ]);
        fs.readFile.mockResolvedValue(scopeContent);

        const result = await extractor.extractReferences(testPath);

        expect(result.get('intimacy')).toContain('special_item');
      });
    });
  });
});
