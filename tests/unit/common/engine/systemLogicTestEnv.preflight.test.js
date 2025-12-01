import { describe, it, expect } from '@jest/globals';
import { createBaseRuleEnvironment } from '../../../common/engine/systemLogicTestEnv.js';

describe('createBaseRuleEnvironment preflight validation', () => {
  it('fails fast with missing handler details', () => {
    let caughtError;

    try {
      createBaseRuleEnvironment({
        createHandlers: () => ({}),
        rules: [
          {
            rule_id: 'test-rule',
            actions: [{ type: 'MISSING_OP' }],
          },
        ],
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError.message).toMatch(/Preflight operation handler validation failed/);
    expect(caughtError.message).toMatch(/MISSING_OP/);
    expect(caughtError.message).toMatch(/test-rule/);
  });

  it('allows setup when handlers cover referenced operations', () => {
    const env = createBaseRuleEnvironment({
      createHandlers: () => ({
        SUPPORTED_OP: { execute: jest.fn() },
      }),
      rules: [
        {
          rule_id: 'valid-rule',
          actions: [{ type: 'SUPPORTED_OP' }],
        },
      ],
    });

    expect(() => env.initializeEnv([])).not.toThrow();
    env.cleanup();
  });
});
