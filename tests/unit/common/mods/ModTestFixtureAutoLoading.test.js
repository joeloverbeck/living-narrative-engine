/**
 * @file Unit tests for ModTestFixture auto-loading functionality
 * @description Comprehensive tests for the enhanced ModTestFixture with auto-loading capabilities
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import { ModTestFixture, ModActionTestFixture, ModRuleTestFixture } from '../../../common/mods/ModTestFixture.js';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
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
      const { rulePaths, conditionPaths } = ModTestFixture.getConventionalPaths('intimacy', 'kiss_cheek');

      expect(rulePaths).toEqual([
        'data/mods/intimacy/rules/kiss_cheek.rule.json',
        'data/mods/intimacy/rules/handle_kiss_cheek.rule.json',
        'data/mods/intimacy/rules/intimacy_kiss_cheek.rule.json', // fullActionId uses modId_actionName pattern for simple IDs
      ]);

      expect(conditionPaths).toEqual([
        'data/mods/intimacy/conditions/event-is-action-kiss-cheek.condition.json',
        'data/mods/intimacy/conditions/kiss-cheek.condition.json',
        'data/mods/intimacy/conditions/event-is-action-intimacy-kiss-cheek.condition.json', // fullActionId uses modId-actionName pattern for simple IDs
      ]);
    });

    it('should generate correct paths for namespaced action IDs', () => {
      const { rulePaths, conditionPaths } = ModTestFixture.getConventionalPaths('intimacy', 'intimacy:kiss_cheek');

      expect(rulePaths).toEqual([
        'data/mods/intimacy/rules/kiss_cheek.rule.json',
        'data/mods/intimacy/rules/handle_kiss_cheek.rule.json',
        'data/mods/intimacy/rules/intimacy_kiss_cheek.rule.json',
      ]);

      expect(conditionPaths).toEqual([
        'data/mods/intimacy/conditions/event-is-action-kiss-cheek.condition.json',
        'data/mods/intimacy/conditions/kiss-cheek.condition.json',
        'data/mods/intimacy/conditions/event-is-action-intimacy-kiss-cheek.condition.json',
      ]);
    });

    it('should handle positioning actions correctly', () => {
      const { rulePaths, conditionPaths } = ModTestFixture.getConventionalPaths('positioning', 'positioning:kneel_before');

      expect(rulePaths).toEqual([
        'data/mods/positioning/rules/kneel_before.rule.json',
        'data/mods/positioning/rules/handle_kneel_before.rule.json',
        'data/mods/positioning/rules/positioning_kneel_before.rule.json',
      ]);

      expect(conditionPaths).toEqual([
        'data/mods/positioning/conditions/event-is-action-kneel-before.condition.json',
        'data/mods/positioning/conditions/kneel-before.condition.json',
        'data/mods/positioning/conditions/event-is-action-positioning-kneel-before.condition.json',
      ]);
    });

    it('should convert underscores to hyphens for condition file names', () => {
      const { conditionPaths } = ModTestFixture.getConventionalPaths('violence', 'violence:sucker_punch');

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
      condition: { condition_ref: 'intimacy:event-is-action-kiss-cheek' },
      actions: [{ type: 'GET_NAME', parameters: {} }],
    };

    const mockConditionFile = {
      id: 'intimacy:event-is-action-kiss-cheek',
      description: 'Checks if the triggering event is for the intimacy:kiss_cheek action.',
      logic: { '==': [{ var: 'event.payload.actionId' }, 'intimacy:kiss_cheek'] },
    };

    it('should load rule and condition files successfully', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))  // First call for rule file
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile)); // Second call for condition file

      const result = await ModTestFixture.loadModFiles('intimacy', 'intimacy:kiss_cheek');

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
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))  // Rule file found on third try
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile)); // Condition file found

      const result = await ModTestFixture.loadModFiles('intimacy', 'intimacy:kiss_cheek');

      expect(result.ruleFile).toEqual(mockRuleFile);
      expect(fs.readFile).toHaveBeenCalledTimes(4); // 3 rule attempts + 1 condition success
    });

    it('should try multiple condition file patterns', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))    // Rule file found immediately
        .mockRejectedValueOnce(new Error('ENOENT: no such file'))  // First condition attempt fails
        .mockRejectedValueOnce(new Error('ENOENT: no such file'))  // Second condition attempt fails
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile)); // Third condition attempt succeeds

      const result = await ModTestFixture.loadModFiles('intimacy', 'intimacy:kiss_cheek');

      expect(result.conditionFile).toEqual(mockConditionFile);
      expect(fs.readFile).toHaveBeenCalledTimes(4); // 1 rule success + 3 condition attempts
    });

    it('should throw descriptive error when rule file not found', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(
        ModTestFixture.loadModFiles('intimacy', 'intimacy:kiss_cheek')
      ).rejects.toThrow(/Could not load rule file for intimacy:intimacy:kiss_cheek/);
    });

    it('should throw descriptive error when condition file not found', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))  // Rule file found
        .mockRejectedValue(new Error('ENOENT: no such file')); // All condition attempts fail

      await expect(
        ModTestFixture.loadModFiles('intimacy', 'intimacy:kiss_cheek')
      ).rejects.toThrow(/Could not load condition file for intimacy:intimacy:kiss_cheek/);
    });

    it('should handle JSON parsing errors gracefully', async () => {
      // First attempt fails with invalid JSON, second attempt with ENOENT, third attempt with ENOENT
      fs.readFile
        .mockResolvedValueOnce('invalid json')  // Invalid JSON for first rule attempt
        .mockRejectedValueOnce(new Error('ENOENT: no such file'))  // Second rule attempt fails
        .mockRejectedValueOnce(new Error('ENOENT: no such file'))  // Third rule attempt fails
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));  // Condition file succeeds (won't reach)

      await expect(
        ModTestFixture.loadModFiles('intimacy', 'intimacy:kiss_cheek')
      ).rejects.toThrow(/Could not load rule file/);
    });

    it('should handle different action ID formats correctly', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

      // Test with simple action ID (no namespace)
      await ModTestFixture.loadModFiles('intimacy', 'kiss_cheek');
      
      // Should work fine - the method handles both formats
      expect(fs.readFile).toHaveBeenCalled();
    });
  });

  describe('tryAutoLoadFiles', () => {
    const mockRuleFile = { rule_id: 'test_rule' };
    const mockConditionFile = { id: 'test:condition' };

    it('should return loaded files when successful', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

      const result = await ModTestFixture.tryAutoLoadFiles('intimacy', 'intimacy:kiss_cheek');

      expect(result).toEqual({
        ruleFile: mockRuleFile,
        conditionFile: mockConditionFile,
      });
    });

    it('should return null values when loading fails', async () => {
      fs.readFile.mockRejectedValue(new Error('Files not found'));

      const result = await ModTestFixture.tryAutoLoadFiles('intimacy', 'intimacy:kiss_cheek');

      expect(result).toEqual({
        ruleFile: null,
        conditionFile: null,
      });
    });

    it('should not throw errors when files cannot be loaded', async () => {
      fs.readFile.mockRejectedValue(new Error('Files not found'));

      // Should not throw
      await expect(
        ModTestFixture.tryAutoLoadFiles('intimacy', 'intimacy:kiss_cheek')
      ).resolves.toBeDefined();
    });
  });

  describe('enhanced forAction', () => {
    const mockRuleFile = {
      rule_id: 'handle_kiss_cheek',
      event_type: 'core:attempt_action',
      condition: { condition_ref: 'intimacy:event-is-action-kiss-cheek' },
      actions: [{ type: 'GET_NAME', parameters: {} }],
    };

    const mockConditionFile = {
      id: 'intimacy:event-is-action-kiss-cheek',
      logic: { '==': [{ var: 'event.payload.actionId' }, 'intimacy:kiss_cheek'] },
    };

    it('should maintain backward compatibility with existing signature', async () => {
      const fixture = await ModTestFixture.forAction(
        'intimacy',
        'intimacy:kiss_cheek',
        mockRuleFile,
        mockConditionFile
      );

      expect(fixture).toBeInstanceOf(ModActionTestFixture);
      expect(fixture.modId).toBe('intimacy');
      expect(fixture.actionId).toBe('intimacy:kiss_cheek');
      expect(fixture.ruleFile).toEqual(mockRuleFile);
      expect(fixture.conditionFile).toEqual(mockConditionFile);
    });

    it('should auto-load files when not provided', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

      const fixture = await ModTestFixture.forAction('intimacy', 'intimacy:kiss_cheek');

      expect(fixture).toBeInstanceOf(ModActionTestFixture);
      expect(fixture.ruleFile).toEqual(mockRuleFile);
      expect(fixture.conditionFile).toEqual(mockConditionFile);
    });

    it('should prefer provided files over auto-loaded ones', async () => {
      const providedRule = { rule_id: 'provided_rule' };
      const providedCondition = { id: 'provided:condition' };

      // Auto-loading should not be triggered since files are provided
      const fixture = await ModTestFixture.forAction(
        'intimacy',
        'intimacy:kiss_cheek',
        providedRule,
        providedCondition
      );

      expect(fixture.ruleFile).toEqual(providedRule);
      expect(fixture.conditionFile).toEqual(providedCondition);
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should auto-load only missing files', async () => {
      // When only condition needs to be loaded, mock only condition file attempts
      // The production code will try multiple paths for the condition file
      fs.readFile
        .mockRejectedValueOnce(new Error('ENOENT: no such file'))  // First condition attempt fails
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile)); // Second condition attempt succeeds

      const providedRule = { rule_id: 'provided_rule' };

      const fixture = await ModTestFixture.forAction(
        'intimacy',
        'intimacy:kiss_cheek',
        providedRule,
        null // condition file should be auto-loaded
      );

      expect(fixture.ruleFile).toEqual(providedRule);
      expect(fixture.conditionFile).toEqual(mockConditionFile);
    });

    it('should throw descriptive error when auto-loading fails', async () => {
      fs.readFile.mockRejectedValue(new Error('Files not found'));

      await expect(
        ModTestFixture.forAction('intimacy', 'intimacy:kiss_cheek')
      ).rejects.toThrow(/ModTestFixture.forAction failed for intimacy:intimacy:kiss_cheek/);
    });
  });

  describe('enhanced forRule', () => {
    const mockRuleFile = { rule_id: 'test_rule' };
    const mockConditionFile = { id: 'test:condition' };

    it('should maintain backward compatibility with existing signature', async () => {
      const fixture = await ModTestFixture.forRule(
        'intimacy',
        'intimacy:kiss_cheek',
        mockRuleFile,
        mockConditionFile
      );

      expect(fixture).toBeInstanceOf(ModRuleTestFixture);
      expect(fixture.modId).toBe('intimacy');
      expect(fixture.ruleFile).toEqual(mockRuleFile);
      expect(fixture.conditionFile).toEqual(mockConditionFile);
    });

    it('should auto-load files when not provided', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

      const fixture = await ModTestFixture.forRule('intimacy', 'intimacy:kiss_cheek');

      expect(fixture).toBeInstanceOf(ModRuleTestFixture);
      expect(fixture.ruleFile).toEqual(mockRuleFile);
      expect(fixture.conditionFile).toEqual(mockConditionFile);
    });

    it('should throw descriptive error when auto-loading fails', async () => {
      fs.readFile.mockRejectedValue(new Error('Files not found'));

      await expect(
        ModTestFixture.forRule('intimacy', 'intimacy:kiss_cheek')
      ).rejects.toThrow(/ModTestFixture.forRule failed for intimacy:intimacy:kiss_cheek/);
    });
  });

  describe('forActionAutoLoad', () => {
    const mockRuleFile = { rule_id: 'test_rule' };
    const mockConditionFile = { id: 'test:condition' };

    it('should create fixture with auto-loaded files', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

      const fixture = await ModTestFixture.forActionAutoLoad('intimacy', 'intimacy:kiss_cheek');

      expect(fixture).toBeInstanceOf(ModActionTestFixture);
      expect(fixture.ruleFile).toEqual(mockRuleFile);
      expect(fixture.conditionFile).toEqual(mockConditionFile);
    });

    it('should throw clear error when files missing', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(
        ModTestFixture.forActionAutoLoad('intimacy', 'intimacy:kiss_cheek')
      ).rejects.toThrow(/Could not load rule file/);
    });

    it('should work with various action ID formats', async () => {
      // First call for 'kiss_cheek' (simple format)
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile))
        // Second call for 'intimacy:kiss_cheek' (namespaced format) 
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

      // Should work with simple format
      const fixture1 = await ModTestFixture.forActionAutoLoad('intimacy', 'kiss_cheek');
      expect(fixture1).toBeInstanceOf(ModActionTestFixture);

      // Should work with namespaced format
      const fixture2 = await ModTestFixture.forActionAutoLoad('intimacy', 'intimacy:kiss_cheek');
      expect(fixture2).toBeInstanceOf(ModActionTestFixture);
    });
  });

  describe('forRuleAutoLoad', () => {
    const mockRuleFile = { rule_id: 'test_rule' };
    const mockConditionFile = { id: 'test:condition' };

    it('should create fixture with auto-loaded files', async () => {
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockRuleFile))
        .mockResolvedValueOnce(JSON.stringify(mockConditionFile));

      const fixture = await ModTestFixture.forRuleAutoLoad('intimacy', 'intimacy:kiss_cheek');

      expect(fixture).toBeInstanceOf(ModRuleTestFixture);
      expect(fixture.ruleFile).toEqual(mockRuleFile);
      expect(fixture.conditionFile).toEqual(mockConditionFile);
    });

    it('should throw clear error when files missing', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(
        ModTestFixture.forRuleAutoLoad('intimacy', 'intimacy:kiss_cheek')
      ).rejects.toThrow(/Could not load rule file/);
    });
  });

  describe('file path conventions', () => {
    it('should generate correct paths for intimacy actions', () => {
      const { rulePaths, conditionPaths } = ModTestFixture.getConventionalPaths('intimacy', 'intimacy:kiss_cheek');

      expect(rulePaths).toContain('data/mods/intimacy/rules/kiss_cheek.rule.json');
      expect(rulePaths).toContain('data/mods/intimacy/rules/handle_kiss_cheek.rule.json');
      expect(conditionPaths).toContain('data/mods/intimacy/conditions/event-is-action-kiss-cheek.condition.json');
    });

    it('should generate correct paths for positioning actions', () => {
      const { rulePaths, conditionPaths } = ModTestFixture.getConventionalPaths('positioning', 'positioning:kneel_before');

      expect(rulePaths).toContain('data/mods/positioning/rules/kneel_before.rule.json');
      expect(rulePaths).toContain('data/mods/positioning/rules/handle_kneel_before.rule.json');
      expect(conditionPaths).toContain('data/mods/positioning/conditions/event-is-action-kneel-before.condition.json');
    });

    it('should handle action name transformations (underscore/hyphen)', () => {
      const { conditionPaths } = ModTestFixture.getConventionalPaths('intimacy', 'intimacy:kiss_neck_sensually');

      // Should convert underscores to hyphens for condition files
      expect(conditionPaths).toContain('data/mods/intimacy/conditions/event-is-action-kiss-neck-sensually.condition.json');
      expect(conditionPaths).toContain('data/mods/intimacy/conditions/kiss-neck-sensually.condition.json');
    });

    it('should handle violence actions correctly', () => {
      const { rulePaths, conditionPaths } = ModTestFixture.getConventionalPaths('violence', 'violence:sucker_punch');

      expect(rulePaths).toContain('data/mods/violence/rules/sucker_punch.rule.json');
      expect(rulePaths).toContain('data/mods/violence/rules/handle_sucker_punch.rule.json');
      expect(conditionPaths).toContain('data/mods/violence/conditions/event-is-action-sucker-punch.condition.json');
    });

    it('should handle sex actions correctly', () => {
      const { rulePaths, conditionPaths } = ModTestFixture.getConventionalPaths('sex', 'sex:fondle_breasts');

      expect(rulePaths).toContain('data/mods/sex/rules/fondle_breasts.rule.json');
      expect(rulePaths).toContain('data/mods/sex/rules/handle_fondle_breasts.rule.json');
      expect(conditionPaths).toContain('data/mods/sex/conditions/event-is-action-fondle-breasts.condition.json');
    });
  });
});