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
      id: 'positioning:test_rule',
      operations: [],
    };

    const mockCondition = {
      id: 'positioning:event-is-action-test-action',
      logic: { '==': [true, true] },
    };

    await expect(async () => {
      testFixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:test_action',
        mockRule,
        mockCondition,
        { actionDefinition: invalidAction }
      );
    }).rejects.toThrow(/Invalid property 'action_id'/);
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
      id: 'positioning:test_rule',
      operations: [],
    };

    const mockCondition = {
      id: 'positioning:event-is-action-test-action',
      logic: { '==': [true, true] },
    };

    await expect(async () => {
      testFixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:test_action',
        mockRule,
        mockCondition,
        { actionDefinition: invalidAction }
      );
    }).rejects.toThrow(/Invalid property/);
  });
});
