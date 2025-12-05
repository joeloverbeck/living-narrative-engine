import { describe, expect, it } from '@jest/globals';
import { validateOperatorWhitelist } from '../../../src/logic/operatorRegistrationValidator.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

describe('operatorRegistrationValidator helper operators', () => {
  it('does not warn when helper option operators are whitelisted but not registered', () => {
    const logger = createMockLogger();
    const registeredOperators = new Set(['hasPartSubTypeContaining']);
    const allowedOperations = new Set([
      'hasPartSubTypeContaining',
      'matchAtEnd',
      'matchWholeWord',
    ]);

    validateOperatorWhitelist(registeredOperators, allowedOperations, logger);

    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining(
        'Operators in ALLOWED_OPERATIONS whitelist but not registered'
      ),
      expect.anything()
    );
  });
});
