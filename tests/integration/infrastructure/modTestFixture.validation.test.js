/**
 * @file Deep validation tests for ModTestFixture
 * @description TSTAIMIG-002: Comprehensive validation of auto-loading capabilities and integration patterns
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  ModTestFixture,
  ModActionTestFixture,
  ModRuleTestFixture,
} from '../../common/mods/ModTestFixture.js';
import { promises as fs } from 'fs';

// Mock file system for auto-loading tests
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    readdir: jest.fn(),
  },
}));

describe('ModTestFixture - Deep Validation (TSTAIMIG-002)', () => {
  let mockRuleFile;
  let mockConditionFile;

  beforeEach(() => {
    mockRuleFile = {
      $schema: 'schema://living-narrative-engine/rule.schema.json',
      rule_id: 'handle_test_action',
      event_type: 'core:attempt_action',
      condition: { condition_ref: 'test_mod:event-is-action-test-action' },
      actions: [
        {
          type: 'DISPATCH_PERCEPTIBLE_EVENT',
          parameters: {
            perception_type: 'narration',
            description_text: 'Test action executed',
          },
        },
      ],
    };

    mockConditionFile = {
      $schema: 'schema://living-narrative-engine/condition.schema.json',
      id: 'test_mod:event-is-action-test-action',
      description: 'Matches the test action event.',
      logic: {
        '==': [{ var: 'event.payload.actionId' }, 'test_mod:test_action'],
      },
    };

    fs.readFile.mockReset();
    fs.readdir.mockReset();
    fs.readdir.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Enhanced Auto-Loading Capabilities', () => {
    describe('forAction() method auto-loading', () => {
      it('should exist and work with manual file parameters (backward compatibility)', async () => {
        const fixture = await ModTestFixture.forAction(
          'test_mod',
          'test_action',
          mockRuleFile,
          mockConditionFile
        );

        expect(fixture).toBeDefined();
        expect(fixture).toBeInstanceOf(ModActionTestFixture);
        expect(fixture.modId).toBe('test_mod');
        expect(fixture.actionId).toBe('test_action');
        expect(fixture.ruleFile).toEqual(mockRuleFile);
        expect(fixture.conditionFile).toEqual(mockConditionFile);
      });

      it('should auto-load files when not provided', async () => {
        // Mock successful file loading
        fs.readFile
          .mockResolvedValueOnce(JSON.stringify(mockRuleFile)) // rule file
          .mockResolvedValueOnce(JSON.stringify(mockConditionFile)); // condition file

        const fixture = await ModTestFixture.forAction(
          'test_mod',
          'test_action'
        );

        expect(fixture).toBeDefined();
        expect(fixture).toBeInstanceOf(ModActionTestFixture);
        expect(fs.readFile).toHaveBeenCalledTimes(2);
      });

      it('should handle partial auto-loading (one file provided, one auto-loaded)', async () => {
        // Mock successful file loading for condition file
        fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConditionFile));

        const fixture = await ModTestFixture.forAction(
          'test_mod',
          'test_action',
          mockRuleFile, // provided
          null // auto-load
        );

        expect(fixture).toBeDefined();
        expect(fixture.ruleFile).toEqual(mockRuleFile);
        expect(fs.readFile).toHaveBeenCalledTimes(1);
      });

      it('should throw clear errors when auto-loading fails', async () => {
        // Mock file loading failure
        fs.readFile.mockRejectedValue(new Error('File not found'));

        await expect(
          ModTestFixture.forAction('test_mod', 'test_action')
        ).rejects.toThrow(
          'ModTestFixture.forAction failed for test_mod:test_action'
        );
      });
    });

    describe('forRule() method auto-loading', () => {
      it('should exist and work with auto-loading capabilities', async () => {
        // Mock successful file loading
        fs.readFile
          .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
          .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

        const fixture = await ModTestFixture.forRule('test_mod', 'test_rule');

        expect(fixture).toBeDefined();
        expect(fixture).toBeInstanceOf(ModRuleTestFixture);
        expect(fixture.modId).toBe('test_mod');
        expect(fixture.ruleId).toBe('test_rule');
      });

      it('should handle mixed auto-loading and manual parameters', async () => {
        // Mock condition file loading
        fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConditionFile));

        const fixture = await ModTestFixture.forRule(
          'test_mod',
          'test_rule',
          mockRuleFile,
          null // auto-load condition
        );

        expect(fixture).toBeDefined();
        expect(fixture.ruleFile).toEqual(mockRuleFile);
      });
    });

    describe('Explicit auto-loading methods', () => {
      it('should provide forActionAutoLoad for explicit auto-loading', async () => {
        // Mock successful file loading
        fs.readFile
          .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
          .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

        const fixture = await ModTestFixture.forActionAutoLoad(
          'test_mod',
          'test_action'
        );

        expect(fixture).toBeDefined();
        expect(fixture).toBeInstanceOf(ModActionTestFixture);
        expect(fs.readFile).toHaveBeenCalledTimes(2); // Rule and condition files loaded
      });

      it('should provide forRuleAutoLoad for explicit auto-loading', async () => {
        // Mock successful file loading
        fs.readFile
          .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
          .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

        const fixture = await ModTestFixture.forRuleAutoLoad(
          'test_mod',
          'test_rule'
        );

        expect(fixture).toBeDefined();
        expect(fixture).toBeInstanceOf(ModRuleTestFixture);
        expect(fs.readFile).toHaveBeenCalledTimes(2);
      });

      it('should throw clear errors when explicit auto-loading fails', async () => {
        fs.readFile.mockRejectedValue(
          new Error('ENOENT: no such file or directory')
        );

        await expect(
          ModTestFixture.forActionAutoLoad(
            'nonexistent_mod',
            'nonexistent_action'
          )
        ).rejects.toThrow();
      });
    });
  });

  describe('Multiple File Naming Conventions Support', () => {
    describe('Rule file naming conventions', () => {
      it('should try multiple rule file patterns', () => {
        const paths = ModTestFixture.getConventionalPaths(
          'kissing',
          'kiss_cheek'
        );

        expect(paths.rulePaths).toContain(
          'data/mods/kissing/rules/kiss_cheek.rule.json'
        );
        expect(paths.rulePaths).toContain(
          'data/mods/kissing/rules/handle_kiss_cheek.rule.json'
        );
        expect(paths.rulePaths).toContain(
          'data/mods/kissing/rules/kissing_kiss_cheek.rule.json'
        );
      });

      it('should handle namespaced action IDs correctly', () => {
        const paths = ModTestFixture.getConventionalPaths(
          'kissing',
          'kissing:kiss_cheek'
        );

        // Should extract action name from full ID
        expect(paths.rulePaths).toContain(
          'data/mods/kissing/rules/kiss_cheek.rule.json'
        );
        expect(paths.rulePaths).toContain(
          'data/mods/kissing/rules/handle_kiss_cheek.rule.json'
        );
      });
    });

    describe('Condition file naming conventions', () => {
      it('should try multiple condition file patterns with hyphen conversion', () => {
        const paths = ModTestFixture.getConventionalPaths(
          'kissing',
          'kiss_cheek'
        );

        expect(paths.conditionPaths).toContain(
          'data/mods/kissing/conditions/event-is-action-kiss-cheek.condition.json'
        );
        expect(paths.conditionPaths).toContain(
          'data/mods/kissing/conditions/kiss-cheek.condition.json'
        );
        expect(paths.conditionPaths).toContain(
          'data/mods/kissing/conditions/event-is-action-kissing-kiss-cheek.condition.json'
        );
      });

      it('should convert underscores to hyphens for condition files', () => {
        const paths = ModTestFixture.getConventionalPaths(
          'positioning',
          'kneel_before'
        );

        // All condition paths should use hyphens
        paths.conditionPaths.forEach((path) => {
          expect(path).not.toContain('kneel_before'); // No underscores in filename part
          expect(path).toContain('kneel-before'); // Should have hyphens
        });
      });

      it('should handle complex action names with multiple underscores', () => {
        const paths = ModTestFixture.getConventionalPaths(
          'sex-breastplay',
          'fondle_breasts_over_clothes'
        );

        expect(paths.conditionPaths).toContain(
          'data/mods/sex-breastplay/conditions/event-is-action-fondle-breasts-over-clothes.condition.json'
        );
        expect(paths.conditionPaths).toContain(
          'data/mods/sex-breastplay/conditions/fondle-breasts-over-clothes.condition.json'
        );
      });
    });

    describe('Fallback patterns when primary paths not found', () => {
      it('should attempt all patterns in sequence when loading fails', async () => {
        // Mock file reading to fail for first attempts, succeed on last
        fs.readFile
          .mockRejectedValueOnce(new Error('ENOENT')) // First rule pattern fails
          .mockRejectedValueOnce(new Error('ENOENT')) // Second rule pattern fails
          .mockResolvedValueOnce(JSON.stringify(mockRuleFile)) // Third rule pattern succeeds
          .mockRejectedValueOnce(new Error('ENOENT')) // First condition pattern fails
          .mockResolvedValueOnce(JSON.stringify(mockConditionFile)); // Second condition pattern succeeds

        const fixture = await ModTestFixture.forAction(
          'test_mod',
          'test_action'
        );

        expect(fixture).toBeDefined();
        expect(fs.readFile).toHaveBeenCalledTimes(5); // Multiple attempts were made across rule and condition patterns
      });

      it('should provide detailed error messages with attempted paths', async () => {
        fs.readFile.mockRejectedValue(
          new Error('ENOENT: no such file or directory')
        );

        await expect(
          ModTestFixture.forActionAutoLoad('missing_mod', 'missing_action')
        ).rejects.toThrow('Could not load rule file');
      });
    });
  });

  describe('Data Access Methods Through Test Environment', () => {
    let fixture;

    beforeEach(async () => {
      fixture = await ModTestFixture.forAction(
        'test_mod',
        'test_action',
        mockRuleFile,
        mockConditionFile
      );
    });

    afterEach(() => {
      if (fixture) {
        fixture.cleanup();
      }
    });

    it('should provide data access through testEnv properties', () => {
      expect(fixture.testEnv).toBeDefined();
      expect(fixture.testEnv).toHaveProperty('entityManager');
      expect(fixture.testEnv).toHaveProperty('eventBus');
      expect(fixture.testEnv).toHaveProperty('logger');
      expect(fixture.testEnv).toHaveProperty('events');
    });

    it('should provide rule data access through test environment setup', () => {
      expect(fixture.ruleFile).toEqual(mockRuleFile);
      expect(fixture.conditionFile).toEqual(mockConditionFile);

      // Rule should be accessible through the test environment
      expect(fixture.testEnv.dataRegistry).toBeDefined();
      expect(typeof fixture.testEnv.dataRegistry.getAllSystemRules).toBe(
        'function'
      );
    });

    it('should provide condition data access through test environment setup', () => {
      expect(typeof fixture.testEnv.dataRegistry.getConditionDefinition).toBe(
        'function'
      );

      // Test condition access
      const condition = fixture.testEnv.dataRegistry.getConditionDefinition(
        mockConditionFile.id
      );
      expect(condition).toBeDefined();
      expect(condition).toEqual(mockConditionFile);
    });

    it('should provide access to loaded configurations through fixture instances', () => {
      // Fixture should maintain references to loaded files
      expect(fixture.modId).toBe('test_mod');
      expect(fixture.actionId).toBe('test_action');
      expect(fixture.ruleFile).toEqual(mockRuleFile);
      expect(fixture.conditionFile).toEqual(mockConditionFile);

      // Should also provide access through convenient getters
      expect(fixture.entityManager).toBe(fixture.testEnv.entityManager);
      expect(fixture.eventBus).toBe(fixture.testEnv.eventBus);
      expect(fixture.logger).toBe(fixture.testEnv.logger);
      expect(fixture.events).toBe(fixture.testEnv.events);
    });
  });

  describe('Integration Patterns', () => {
    it('should work with createRuleTestEnvironment()', async () => {
      const fixture = await ModTestFixture.forAction(
        'test_mod',
        'test_action',
        mockRuleFile,
        mockConditionFile
      );

      // Fixture should have created a rule test environment
      expect(fixture.testEnv).toBeDefined();
      expect(fixture.testEnv).toHaveProperty('entityManager');
      expect(fixture.testEnv).toHaveProperty('eventBus');
      expect(fixture.testEnv).toHaveProperty('handlers');
      expect(fixture.testEnv).toHaveProperty('reset');
      expect(fixture.testEnv).toHaveProperty('cleanup');

      fixture.cleanup();
    });

    it('should integrate with ModTestHandlerFactory', async () => {
      const fixture = await ModTestFixture.forAction(
        'positioning', // Category that needs ADD_COMPONENT
        'kneel_before',
        mockRuleFile,
        mockConditionFile
      );

      // Should have created handlers appropriate for the category
      expect(fixture.testEnv.handlers).toBeDefined();
      expect(fixture.testEnv.handlers).toHaveProperty('ADD_COMPONENT'); // positioning category

      fixture.cleanup();
    });

    it('should support entity setup and management', async () => {
      const fixture = await ModTestFixture.forAction(
        'test_mod',
        'test_action',
        mockRuleFile,
        mockConditionFile
      );

      // Should provide entity management through scenarios
      const scenario = fixture.createStandardActorTarget(['Alice', 'Bob']);

      expect(scenario).toHaveProperty('actor');
      expect(scenario).toHaveProperty('target');
      expect(scenario.actor).toHaveProperty('id');
      expect(scenario.target).toHaveProperty('id');

      fixture.cleanup();
    });

    it('should provide proper cleanup mechanisms', async () => {
      const fixture = await ModTestFixture.forAction(
        'test_mod',
        'test_action',
        mockRuleFile,
        mockConditionFile
      );

      // Should have cleanup methods
      expect(typeof fixture.cleanup).toBe('function');
      expect(typeof fixture.reset).toBe('function');

      // Cleanup should not throw
      expect(() => fixture.cleanup()).not.toThrow();
    });
  });

  describe('Advanced Scenario Creation', () => {
    let fixture;

    beforeEach(async () => {
      fixture = await ModTestFixture.forAction(
        'test_mod',
        'test_action',
        mockRuleFile,
        mockConditionFile
      );
    });

    afterEach(() => {
      if (fixture) {
        fixture.cleanup();
      }
    });

    it('should create close actors scenario', () => {
      const scenario = fixture.createCloseActors(['Alice', 'Bob']);

      expect(scenario).toHaveProperty('actor');
      expect(scenario).toHaveProperty('target');

      // Both entities should have closeness components
      expect(scenario.actor.components).toHaveProperty('positioning:closeness');
      expect(scenario.target.components).toHaveProperty(
        'positioning:closeness'
      );
    });

    it('should create anatomy scenario for body-related actions', () => {
      const scenario = fixture.createAnatomyScenario(
        ['Alice', 'Bob'],
        ['torso', 'breast', 'breast']
      );

      expect(scenario).toHaveProperty('actor');
      expect(scenario).toHaveProperty('target');
      expect(scenario).toHaveProperty('bodyParts');
      expect(scenario).toHaveProperty('allEntities');

      expect(scenario.bodyParts).toHaveLength(3);
      expect(scenario.target.components).toHaveProperty('anatomy:body');
    });

    it('should create multi-actor scenario with observers', () => {
      const scenario = fixture.createMultiActorScenario([
        'Alice',
        'Bob',
        'Charlie',
      ]);

      expect(scenario).toHaveProperty('actor');
      expect(scenario).toHaveProperty('target');
      expect(scenario).toHaveProperty('observers');
      expect(scenario).toHaveProperty('allEntities');

      expect(scenario.observers).toHaveLength(1); // Charlie as observer
      expect(scenario.allEntities).toHaveLength(3);
    });
  });

  describe('Error Handling for Missing Files', () => {
    it('should provide detailed diagnostics when files cannot be found', async () => {
      fs.readFile.mockRejectedValue(
        new Error('ENOENT: no such file or directory')
      );

      await expect(
        ModTestFixture.loadModFiles('nonexistent_mod', 'nonexistent_action')
      ).rejects.toMatchObject({
        message: expect.stringContaining('Could not load rule file'),
      });
    });

    it('should gracefully handle partial loading failures', async () => {
      // Rule loads successfully, condition fails
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(
        ModTestFixture.loadModFiles('test_mod', 'test_action')
      ).rejects.toMatchObject({
        message: expect.stringContaining('Could not load condition file'),
      });
    });

    it('should provide useful error context for invalid JSON files', async () => {
      fs.readFile
        .mockResolvedValueOnce('invalid json{')
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

      await expect(
        ModTestFixture.loadModFiles('test_mod', 'test_action')
      ).rejects.toThrow();
    });
  });

  describe('Utility Methods', () => {
    it('should provide getConventionalPaths for debugging', () => {
      const paths = ModTestFixture.getConventionalPaths(
        'intimacy',
        'kiss_cheek'
      );

      expect(paths).toHaveProperty('rulePaths');
      expect(paths).toHaveProperty('conditionPaths');
      expect(Array.isArray(paths.rulePaths)).toBe(true);
      expect(Array.isArray(paths.conditionPaths)).toBe(true);

      expect(paths.rulePaths.length).toBeGreaterThan(0);
      expect(paths.conditionPaths.length).toBeGreaterThan(0);
    });

    it('should handle tryAutoLoadFiles for backward compatibility', async () => {
      // Mock successful loading
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

      const result = await ModTestFixture.tryAutoLoadFiles(
        'test_mod',
        'test_action'
      );

      expect(result).toHaveProperty('ruleFile');
      expect(result).toHaveProperty('conditionFile');
      expect(result.ruleFile).toEqual(mockRuleFile);
      expect(result.conditionFile).toEqual(mockConditionFile);
    });

    it('should return null values when tryAutoLoadFiles fails', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await ModTestFixture.tryAutoLoadFiles(
        'missing_mod',
        'missing_action'
      );

      expect(result).toEqual({
        ruleFile: null,
        conditionFile: null,
      });
    });
  });
});
