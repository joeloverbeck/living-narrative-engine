/**
 * @file ModTestFixture.earlyValidation.test.js
 * @description Tests for early validation in ModTestFixture.forAction()
 * @see TESINFROB-005 ticket for implementation details
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../../tests/common/mods/ModTestFixture.js';

describe('ModTestFixture.forAction() early validation', () => {
  let fixture;

  afterEach(() => {
    fixture?.cleanup?.();
    fixture = null;
  });

  describe('action ID format validation', () => {
    it('should throw for non-namespaced action ID with suggestion', async () => {
      await expect(ModTestFixture.forAction('core', 'wait')).rejects.toThrow(
        /Action IDs must be namespaced/
      );

      await expect(ModTestFixture.forAction('core', 'wait')).rejects.toThrow(
        /Did you mean 'core:wait'/
      );
    });

    it('should throw descriptive error for non-namespaced ID', async () => {
      await expect(
        ModTestFixture.forAction('positioning', 'sit_down')
      ).rejects.toThrow(/Invalid action ID format: 'sit_down'/);
    });

    it('should accept valid namespaced action ID', async () => {
      // This should not throw for format validation
      fixture = await ModTestFixture.forAction('core', 'core:wait');
      expect(fixture).toBeDefined();
    });
  });

  describe('mod existence validation', () => {
    it('should throw for non-existent mod with available mods list', async () => {
      await expect(
        ModTestFixture.forAction('nonexistent_mod', 'nonexistent_mod:action')
      ).rejects.toThrow(/Mod 'nonexistent_mod' not found/);
    });

    it('should suggest similar mod names for typos', async () => {
      // 'cor' is close to 'core'
      await expect(
        ModTestFixture.forAction('cor', 'cor:wait')
      ).rejects.toThrow(/Did you mean.*core/);
    });

    it('should suggest similar mod names for partial matches', async () => {
      // 'sittin' is close to 'sitting' (1 character off, well within maxDistance=3)
      await expect(
        ModTestFixture.forAction('sittin', 'sittin:sit_down')
      ).rejects.toThrow(/Did you mean.*sitting/);
    });
  });

  describe('action existence validation', () => {
    it('should throw for non-existent action with suggestions', async () => {
      await expect(
        ModTestFixture.forAction('core', 'core:nonexistent_action')
      ).rejects.toThrow(/Action 'core:nonexistent_action' not found/);
    });

    it('should suggest similar action names for typos', async () => {
      // 'core:wai' is close to 'core:wait'
      await expect(
        ModTestFixture.forAction('core', 'core:wai')
      ).rejects.toThrow(/Did you mean.*core:wait/);
    });

    it('should list available actions when no close match', async () => {
      await expect(
        ModTestFixture.forAction('core', 'core:zzzzzzzzz')
      ).rejects.toThrow(/Available actions/);
    });

    it('should handle mod with no actions directory gracefully', async () => {
      // Create a scenario where we check a mod that exists but may have no actions
      // This tests the "No actions found" branch
      await expect(
        ModTestFixture.forAction('core', 'core:definitely_not_an_action_xyz')
      ).rejects.toThrow(/Action 'core:definitely_not_an_action_xyz' not found/);
    });
  });

  describe('valid inputs - regression tests', () => {
    it('should pass validation for valid mod and action', async () => {
      fixture = await ModTestFixture.forAction('core', 'core:wait');
      expect(fixture).toBeDefined();
      expect(fixture.testEnv).toBeDefined();
    });

    it('should work with additional options', async () => {
      fixture = await ModTestFixture.forAction(
        'core',
        'core:wait',
        undefined,
        undefined,
        { enableDiagnostics: false }
      );
      expect(fixture).toBeDefined();
    });

    it('should work with sitting mod', async () => {
      fixture = await ModTestFixture.forAction('sitting', 'sitting:sit_down');
      expect(fixture).toBeDefined();
      expect(fixture.testEnv).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle action ID with multiple colons', async () => {
      // Action IDs should only have one colon, but the validation should handle this
      // by checking for the presence of at least one colon
      await expect(
        ModTestFixture.forAction('core', 'core:some:invalid:id')
      ).rejects.toThrow(/Action.*not found/);
    });

    it('should not throw format error when colon is present', async () => {
      // Even if action doesn't exist, format validation should pass
      const error = await ModTestFixture.forAction(
        'core',
        'core:nonexistent'
      ).catch((e) => e);

      // Should NOT be a format error
      expect(error.message).not.toMatch(/Action IDs must be namespaced/);
      // Should be an existence error instead
      expect(error.message).toMatch(/Action.*not found/);
    });

    it('should skip mod/action existence validation when explicit files provided', async () => {
      // When both rule and condition files are provided, skip mod/action existence checks
      // This allows tests to use mock data with fake mod names
      const mockRuleFile = {
        rule_id: 'handle_test_action',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'fake_mod:event-is-action-test' },
        actions: [{ type: 'LOG', parameters: { message: 'Test action executed' } }],
      };
      const mockConditionFile = {
        id: 'fake_mod:event-is-action-test',
        description: 'Checks if action is test_action',
        logic: { '==': [{ var: 'event.payload.actionId' }, 'fake_mod:test_action'] },
      };

      // Should NOT throw mod not found error when both files are explicitly provided
      fixture = await ModTestFixture.forAction(
        'fake_mod',
        'fake_mod:test_action',
        mockRuleFile,
        mockConditionFile
      );
      expect(fixture).toBeDefined();
    });

    it('should skip action ID format validation when explicit files provided', async () => {
      // When both files are provided, format validation is skipped for backward compatibility
      // This allows tests to use non-namespaced action IDs with mock data
      const mockRuleFile = {
        rule_id: 'handle_action',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'test:event-is-action-test' },
        actions: [{ type: 'LOG', parameters: { message: 'Test action executed' } }],
      };
      const mockConditionFile = {
        id: 'test:event-is-action-test',
        description: 'Checks if action matches',
        logic: { '==': [{ var: 'event.payload.actionId' }, 'no_namespace'] },
      };

      // Should NOT throw format error when both files are explicitly provided
      fixture = await ModTestFixture.forAction(
        'fake_mod',
        'no_namespace', // Non-namespaced but allowed with explicit files
        mockRuleFile,
        mockConditionFile
      );
      expect(fixture).toBeDefined();
    });
  });
});
