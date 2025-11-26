import { describe, it, expect, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Action Validation Integration', () => {
  let testFixture;

  afterEach(() => {
    testFixture?.cleanup();
  });

  it('should catch typos in action definition during test setup', async () => {
    // This test intentionally provides an invalid action with typo
    const invalidAction = {
      action_id: 'positioning:test_action', // Typo: should be 'id'
      name: 'Test Action',
    };

    const mockRule = {
      rule_id: 'handle_test_action',
      event_type: 'core:attempt_action',
      condition: { condition_ref: 'positioning:event-is-action-test-action' },
      actions: [
        {
          type: 'LOG',
          parameters: { message: 'Test action', level: 'info' },
        },
      ],
    };

    const mockCondition = {
      id: 'positioning:event-is-action-test-action',
      description: 'Test condition for action validation',
      logic: { '==': [true, true] },
    };

    await expect(async () => {
      testFixture = await ModTestFixture.forAction(
        'positioning',
        'test_action',
        mockRule,
        mockCondition,
        { actionDefinition: invalidAction }
      );
    }).rejects.toThrow(/Invalid property 'action_id'.*Did you mean 'id'/);
  });

  it('should provide helpful suggestions for typos', async () => {
    const invalidAction = {
      id: 'positioning:test_action',
      requiredComponents: {
        // Typo: should be 'required_components'
        actor: ['positioning:sitting_on'],
      },
    };

    const mockRule = {
      rule_id: 'handle_test_action_typo',
      event_type: 'core:attempt_action',
      condition: { condition_ref: 'positioning:event-is-action-test-action' },
      actions: [
        {
          type: 'LOG',
          parameters: { message: 'Test action', level: 'info' },
        },
      ],
    };

    const mockCondition = {
      id: 'positioning:event-is-action-test-action',
      description: 'Test condition for typo validation',
      logic: { '==': [true, true] },
    };

    await expect(async () => {
      testFixture = await ModTestFixture.forAction(
        'positioning',
        'test_action',
        mockRule,
        mockCondition,
        { actionDefinition: invalidAction }
      );
    }).rejects.toThrow(/Invalid property 'requiredComponents'.*Did you mean 'required_components'/);
  });
});
