/**
 * @file Unit tests for ModTestFixture auto-loading functionality
 * @description Comprehensive tests for the enhanced ModTestFixture with auto-loading capabilities
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { promises as fs } from 'fs';
import {
  ModTestFixture,
  ModActionTestFixture,
  ModRuleTestFixture,
} from '../../../common/mods/ModTestFixture.js';

// Mock fs module (both async and sync APIs used by fixtures)
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    readdir: jest.fn().mockResolvedValue([]),
  },
  // Sync APIs are used by ModTestHandlerFactory during environment setup
  existsSync: jest.fn().mockReturnValue(false),
  readdirSync: jest.fn().mockReturnValue([]),
  readFileSync: jest.fn().mockReturnValue('{}'),
}));

describe('ModTestFixture - Auto-Loading Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConventionalPaths', () => {
    it('should generate correct paths for simple action IDs', () => {
      const { rulePaths, conditionPaths } = ModTestFixture.getConventionalPaths(
        'kissing',
        'kiss_cheek'
      );

      expect(rulePaths).toEqual([
        'data/mods/kissing/rules/kiss_cheek.rule.json',
        'data/mods/kissing/rules/handle_kiss_cheek.rule.json',
        'data/mods/kissing/rules/kissing_kiss_cheek.rule.json', // fullActionId uses modId_actionName pattern for simple IDs
      ]);

      expect(conditionPaths).toEqual([
        'data/mods/kissing/conditions/event-is-action-kiss-cheek.condition.json',
        'data/mods/kissing/conditions/kiss-cheek.condition.json',
        'data/mods/kissing/conditions/event-is-action-kissing-kiss-cheek.condition.json', // fullActionId uses modId-actionName pattern for simple IDs
      ]);
    });

    it('should generate correct paths for namespaced action IDs', () => {
      const { rulePaths, conditionPaths } = ModTestFixture.getConventionalPaths(
        'kissing',
        'kissing:kiss_cheek'
      );

      expect(rulePaths).toEqual([
        'data/mods/kissing/rules/kiss_cheek.rule.json',
        'data/mods/kissing/rules/handle_kiss_cheek.rule.json',
        'data/mods/kissing/rules/kissing_kiss_cheek.rule.json',
      ]);

      expect(conditionPaths).toEqual([
        'data/mods/kissing/conditions/event-is-action-kiss-cheek.condition.json',
        'data/mods/kissing/conditions/kiss-cheek.condition.json',
        'data/mods/kissing/conditions/event-is-action-kissing-kiss-cheek.condition.json',
      ]);
    });

    it('should handle deference actions correctly', () => {
      const { rulePaths, conditionPaths } = ModTestFixture.getConventionalPaths(
        'deference',
        'deference:kneel_before'
      );

      expect(rulePaths).toEqual([
        'data/mods/deference/rules/kneel_before.rule.json',
        'data/mods/deference/rules/handle_kneel_before.rule.json',
        'data/mods/deference/rules/deference_kneel_before.rule.json',
      ]);

      expect(conditionPaths).toEqual([
        'data/mods/deference/conditions/event-is-action-kneel-before.condition.json',
        'data/mods/deference/conditions/kneel-before.condition.json',
        'data/mods/deference/conditions/event-is-action-deference-kneel-before.condition.json',
      ]);
    });

    it('should convert underscores to hyphens for condition file names', () => {
      const { conditionPaths } = ModTestFixture.getConventionalPaths(
        'violence',
        'violence:sucker_punch'
      );

      expect(conditionPaths).toEqual([
        'data/mods/violence/conditions/event-is-action-sucker-punch.condition.json',
        'data/mods/violence/conditions/sucker-punch.condition.json',
        'data/mods/violence/conditions/event-is-action-violence-sucker-punch.condition.json',
      ]);
    });
  });

  describe('loadModFiles', () => {
    const mockRuleFile = {
      rule_id: 'handle_kiss_cheek',
      event_type: 'core:attempt_action',
      condition: { condition_ref: 'kissing:event-is-action-kiss-cheek' },
      actions: [{ type: 'GET_NAME', parameters: {} }],
    };

    const mockConditionFile = {
      id: 'kissing:event-is-action-kiss-cheek',
      description:
        'Checks if the triggering event is for the kissing:kiss_cheek action.',
      logic: {
        '==': [{ var: 'event.payload.actionId' }, 'kissing:kiss_cheek'],
      },
    };

    it('should load rule and condition files successfully', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile)) // First call for rule file
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile)); // Second call for condition file

      const result = await ModTestFixture.loadModFiles(
        'kissing',
        'kissing:kiss_cheek'
      );

      expect(result).toEqual({
        ruleFile: mockRuleFile,
        conditionFile: mockConditionFile,
      });
    });

    it('should try multiple rule file patterns', async () => {
      // First two calls fail, third succeeds
      fs.readFile
        .mockRejectedValueOnce(new Error('ENOENT: no such file'))
        .mockRejectedValueOnce(new Error('ENOENT: no such file'))
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile)) // Rule file found on third try
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile)); // Condition file found

      const result = await ModTestFixture.loadModFiles(
        'kissing',
        'kissing:kiss_cheek'
      );

      expect(result.ruleFile).toEqual(mockRuleFile);
      expect(fs.readFile).toHaveBeenCalledTimes(4); // 3 rule attempts + 1 condition success
    });

    it('should try multiple condition file patterns', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile)) // Rule file found immediately
        .mockRejectedValueOnce(new Error('ENOENT: no such file')) // First condition attempt fails
        .mockRejectedValueOnce(new Error('ENOENT: no such file')) // Second condition attempt fails
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile)); // Third condition attempt succeeds

      const result = await ModTestFixture.loadModFiles(
        'kissing',
        'kissing:kiss_cheek'
      );

      expect(result.conditionFile).toEqual(mockConditionFile);
      expect(fs.readFile).toHaveBeenCalledTimes(4); // 1 rule success + 3 condition attempts
    });

    it('should throw descriptive error when rule file not found', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(
        ModTestFixture.loadModFiles('kissing', 'kissing:kiss_cheek')
      ).rejects.toThrow(
        /Could not load rule file for kissing:kissing:kiss_cheek/
      );
    });

    it('should throw descriptive error when condition file not found', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile)) // Rule file found
        .mockRejectedValue(new Error('ENOENT: no such file')); // All condition attempts fail

      await expect(
        ModTestFixture.loadModFiles('kissing', 'kissing:kiss_cheek')
      ).rejects.toThrow(
        /Could not load condition file for kissing:kissing:kiss_cheek/
      );
    });

    it('should handle JSON parsing errors gracefully', async () => {
      // First attempt fails with invalid JSON, second attempt with ENOENT, third attempt with ENOENT
      fs.readFile
        .mockResolvedValueOnce('invalid json') // Invalid JSON for first rule attempt
        .mockRejectedValueOnce(new Error('ENOENT: no such file')) // Second rule attempt fails
        .mockRejectedValueOnce(new Error('ENOENT: no such file')) // Third rule attempt fails
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile)); // Condition file succeeds (won't reach)

      await expect(
        ModTestFixture.loadModFiles('kissing', 'kissing:kiss_cheek')
      ).rejects.toThrow(/Could not load rule file/);
    });

    it('should handle different action ID formats correctly', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

      // Test with simple action ID (no namespace)
      await ModTestFixture.loadModFiles('kissing', 'kiss_cheek');

      // Should work fine - the method handles both formats
      expect(fs.readFile).toHaveBeenCalled();
    });
  });

  describe('tryAutoLoadFiles', () => {
    const mockRuleFile = {
      rule_id: 'test_rule',
      actions: [{ type: 'GET_NAME', parameters: {} }],
    };
    const mockConditionFile = { id: 'test:condition' };

    it('should return loaded files when successful', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

      const result = await ModTestFixture.tryAutoLoadFiles(
        'kissing',
        'kissing:kiss_cheek'
      );

      expect(result).toEqual({
        ruleFile: mockRuleFile,
        conditionFile: mockConditionFile,
      });
    });

    it('should return null values when loading fails', async () => {
      fs.readFile.mockRejectedValue(new Error('Files not found'));

      const result = await ModTestFixture.tryAutoLoadFiles(
        'kissing',
        'kissing:kiss_cheek'
      );

      expect(result).toEqual({
        ruleFile: null,
        conditionFile: null,
      });
    });

    it('should not throw errors when files cannot be loaded', async () => {
      fs.readFile.mockRejectedValue(new Error('Files not found'));

      // Should not throw
      await expect(
        ModTestFixture.tryAutoLoadFiles('kissing', 'kissing:kiss_cheek')
      ).resolves.toBeDefined();
    });
  });

  describe('enhanced forAction', () => {
    const mockRuleFile = {
      rule_id: 'handle_kiss_cheek',
      event_type: 'core:attempt_action',
      condition: { condition_ref: 'kissing:event-is-action-kiss-cheek' },
      actions: [{ type: 'GET_NAME', parameters: {} }],
    };

    const mockConditionFile = {
      id: 'kissing:event-is-action-kiss-cheek',
      logic: {
        '==': [{ var: 'event.payload.actionId' }, 'kissing:kiss_cheek'],
      },
    };

    it('should maintain backward compatibility with existing signature', async () => {
      const fixture = await ModTestFixture.forAction(
        'kissing',
        'kissing:kiss_cheek',
        mockRuleFile,
        mockConditionFile
      );

      expect(fixture).toBeInstanceOf(ModActionTestFixture);
      expect(fixture.modId).toBe('kissing');
      expect(fixture.actionId).toBe('kissing:kiss_cheek');
      expect(fixture.ruleFile).toEqual(mockRuleFile);
      expect(fixture.conditionFile).toEqual(mockConditionFile);
    });

    it('should auto-load files when not provided', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

      const fixture = await ModTestFixture.forAction(
        'kissing',
        'kissing:kiss_cheek'
      );

      expect(fixture).toBeInstanceOf(ModActionTestFixture);
      expect(fixture.ruleFile).toEqual(mockRuleFile);
      expect(fixture.conditionFile).toEqual(mockConditionFile);
    });

    it('should prefer provided files over auto-loaded ones', async () => {
      const providedRule = {
        rule_id: 'provided_rule',
        actions: [{ type: 'SET_VARIABLE', parameters: {} }],
      };
      const providedCondition = { id: 'provided:condition' };

      // Auto-loading should not be triggered since files are provided
      const fixture = await ModTestFixture.forAction(
        'kissing',
        'kissing:kiss_cheek',
        providedRule,
        providedCondition
      );

      expect(fixture.ruleFile).toEqual(providedRule);
      expect(fixture.conditionFile).toEqual(providedCondition);

      const readPaths = fs.readFile.mock.calls.map(([path]) =>
        path.replace(/\\/g, '/')
      );

      expect(
        readPaths.some((path) => path.includes('/data/mods/kissing/rules/'))
      ).toBe(false);
      expect(
        readPaths.some((path) =>
          path.includes('/data/mods/kissing/conditions/')
        )
      ).toBe(false);
    });

    it('should auto-load only missing files', async () => {
      // When only condition needs to be loaded, mock only condition file attempts
      // The production code will try multiple paths for the condition file
      fs.readFile
        .mockRejectedValueOnce(new Error('ENOENT: no such file')) // First condition attempt fails
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile)); // Second condition attempt succeeds

      const providedRule = {
        rule_id: 'provided_rule',
        actions: [{ type: 'GET_NAME', parameters: {} }],
      };

      const fixture = await ModTestFixture.forAction(
        'kissing',
        'kissing:kiss_cheek',
        providedRule,
        null // condition file should be auto-loaded
      );

      expect(fixture.ruleFile).toEqual(providedRule);
      expect(fixture.conditionFile).toEqual(mockConditionFile);
    });

    it('should throw descriptive error when auto-loading fails', async () => {
      fs.readFile.mockRejectedValue(new Error('Files not found'));

      await expect(
        ModTestFixture.forAction('kissing', 'kissing:kiss_cheek')
      ).rejects.toThrow(
        /ModTestFixture.forAction failed for kissing:kissing:kiss_cheek/
      );
    });
  });

  describe('enhanced forRule', () => {
    const mockRuleFile = {
      rule_id: 'test_rule',
      actions: [{ type: 'GET_NAME', parameters: {} }],
    };
    const mockConditionFile = { id: 'test:condition' };

    it('should maintain backward compatibility with existing signature', async () => {
      const fixture = await ModTestFixture.forRule(
        'kissing',
        'kissing:kiss_cheek',
        mockRuleFile,
        mockConditionFile
      );

      expect(fixture).toBeInstanceOf(ModRuleTestFixture);
      expect(fixture.modId).toBe('kissing');
      expect(fixture.ruleFile).toEqual(mockRuleFile);
      expect(fixture.conditionFile).toEqual(mockConditionFile);
    });

    it('should auto-load files when not provided', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

      const fixture = await ModTestFixture.forRule(
        'kissing',
        'kissing:kiss_cheek'
      );

      expect(fixture).toBeInstanceOf(ModRuleTestFixture);
      expect(fixture.ruleFile).toEqual(mockRuleFile);
      expect(fixture.conditionFile).toEqual(mockConditionFile);
    });

    it('should throw descriptive error when auto-loading fails', async () => {
      fs.readFile.mockRejectedValue(new Error('Files not found'));

      await expect(
        ModTestFixture.forRule('kissing', 'kissing:kiss_cheek')
      ).rejects.toThrow(
        /ModTestFixture.forRule failed for kissing:kissing:kiss_cheek/
      );
    });
  });

  describe('forActionAutoLoad', () => {
    const mockRuleFile = {
      rule_id: 'test_rule',
      actions: [{ type: 'GET_NAME', parameters: {} }],
    };
    const mockConditionFile = { id: 'test:condition' };

    it('should create fixture with auto-loaded files', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

      const fixture = await ModTestFixture.forActionAutoLoad(
        'kissing',
        'kissing:kiss_cheek'
      );

      expect(fixture).toBeInstanceOf(ModActionTestFixture);
      expect(fixture.ruleFile).toEqual(mockRuleFile);
      expect(fixture.conditionFile).toEqual(mockConditionFile);
    });

    it('should throw clear error when files missing', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(
        ModTestFixture.forActionAutoLoad('kissing', 'kissing:kiss_cheek')
      ).rejects.toThrow(/Could not load rule file/);
    });

    it('should work with various action ID formats', async () => {
      // First call for 'kiss_cheek' (simple format)
      fs.readFile
        .mockImplementationOnce(() =>
          Promise.resolve(JSON.stringify(mockRuleFile))
        )
        .mockImplementationOnce(() =>
          Promise.resolve(JSON.stringify(mockConditionFile))
        )
        .mockImplementationOnce(() =>
          Promise.resolve(
            JSON.stringify({
              id: 'kissing:kiss_cheek',
              prerequisites: [],
            })
          )
        )
        // Second call for 'kissing:kiss_cheek' (namespaced format)
        .mockImplementationOnce(() =>
          Promise.resolve(JSON.stringify(mockRuleFile))
        )
        .mockImplementationOnce(() =>
          Promise.resolve(JSON.stringify(mockConditionFile))
        )
        .mockImplementationOnce(() =>
          Promise.resolve(
            JSON.stringify({
              id: 'kissing:kiss_cheek',
              prerequisites: [],
            })
          )
        );

      // Should work with simple format
      const fixture1 = await ModTestFixture.forActionAutoLoad(
        'kissing',
        'kiss_cheek'
      );
      expect(fixture1).toBeInstanceOf(ModActionTestFixture);

      // Should work with namespaced format
      const fixture2 = await ModTestFixture.forActionAutoLoad(
        'kissing',
        'kissing:kiss_cheek'
      );
      expect(fixture2).toBeInstanceOf(ModActionTestFixture);
    });
  });

  describe('forRuleAutoLoad', () => {
    const mockRuleFile = {
      rule_id: 'test_rule',
      actions: [{ type: 'GET_NAME', parameters: {} }],
    };
    const mockConditionFile = { id: 'test:condition' };

    it('should create fixture with auto-loaded files', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

      const fixture = await ModTestFixture.forRuleAutoLoad(
        'kissing',
        'kissing:kiss_cheek'
      );

      expect(fixture).toBeInstanceOf(ModRuleTestFixture);
      expect(fixture.ruleFile).toEqual(mockRuleFile);
      expect(fixture.conditionFile).toEqual(mockConditionFile);
    });

    it('should throw clear error when files missing', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(
        ModTestFixture.forRuleAutoLoad('kissing', 'kissing:kiss_cheek')
      ).rejects.toThrow(/Could not load rule file/);
    });
  });

  describe('file path conventions', () => {
    it('should generate correct paths for intimacy actions', () => {
      const { rulePaths, conditionPaths } = ModTestFixture.getConventionalPaths(
        'kissing',
        'kissing:kiss_cheek'
      );

      expect(rulePaths).toContain(
        'data/mods/kissing/rules/kiss_cheek.rule.json'
      );
      expect(rulePaths).toContain(
        'data/mods/kissing/rules/handle_kiss_cheek.rule.json'
      );
      expect(conditionPaths).toContain(
        'data/mods/kissing/conditions/event-is-action-kiss-cheek.condition.json'
      );
    });

    it('should generate correct paths for deference actions', () => {
      const { rulePaths, conditionPaths } = ModTestFixture.getConventionalPaths(
        'deference',
        'deference:kneel_before'
      );

      expect(rulePaths).toContain(
        'data/mods/deference/rules/kneel_before.rule.json'
      );
      expect(rulePaths).toContain(
        'data/mods/deference/rules/handle_kneel_before.rule.json'
      );
      expect(conditionPaths).toContain(
        'data/mods/deference/conditions/event-is-action-kneel-before.condition.json'
      );
    });

    it('should handle action name transformations (underscore/hyphen)', () => {
      const { conditionPaths } = ModTestFixture.getConventionalPaths(
        'kissing',
        'kissing:kiss_neck_sensually'
      );

      // Should convert underscores to hyphens for condition files
      expect(conditionPaths).toContain(
        'data/mods/kissing/conditions/event-is-action-kiss-neck-sensually.condition.json'
      );
      expect(conditionPaths).toContain(
        'data/mods/kissing/conditions/kiss-neck-sensually.condition.json'
      );
    });

    it('should handle violence actions correctly', () => {
      const { rulePaths, conditionPaths } = ModTestFixture.getConventionalPaths(
        'violence',
        'violence:sucker_punch'
      );

      expect(rulePaths).toContain(
        'data/mods/violence/rules/sucker_punch.rule.json'
      );
      expect(rulePaths).toContain(
        'data/mods/violence/rules/handle_sucker_punch.rule.json'
      );
      expect(conditionPaths).toContain(
        'data/mods/violence/conditions/event-is-action-sucker-punch.condition.json'
      );
    });

    it('should handle sex-breastplay actions correctly', () => {
      const { rulePaths, conditionPaths } = ModTestFixture.getConventionalPaths(
        'sex-breastplay',
        'sex-breastplay:fondle_breasts'
      );

      expect(rulePaths).toContain(
        'data/mods/sex-breastplay/rules/fondle_breasts.rule.json'
      );
      expect(rulePaths).toContain(
        'data/mods/sex-breastplay/rules/handle_fondle_breasts.rule.json'
      );
      expect(conditionPaths).toContain(
        'data/mods/sex-breastplay/conditions/event-is-action-fondle-breasts.condition.json'
      );
    });
  });
});
