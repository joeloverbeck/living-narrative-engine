import { describe, test, expect, jest } from '@jest/globals';
import {
  validateEntityRef,
  validateComponentType,
} from '../../../src/utils/operationValidationUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

const logger = {
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

const dispatcher = { dispatch: jest.fn() };

const ctx = {
  evaluationContext: { actor: { id: 'a1' }, target: { id: 't1' } },
};

describe('operationValidationUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('validateComponentType trims valid input', () => {
    const result = validateComponentType('  core:stat  ', logger, 'TEST');
    expect(result).toBe('core:stat');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('validateComponentType warns on invalid input', () => {
    const result = validateComponentType('  ', logger, 'TEST');
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'TEST: Invalid or missing "component_type" parameter (must be non-empty string).'
    );
  });

  test('validateEntityRef resolves actor keyword', () => {
    const result = validateEntityRef('actor', ctx, logger, undefined, 'TEST');
    expect(result).toBe('a1');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('validateEntityRef dispatches when unresolved and dispatcher provided', () => {
    const result = validateEntityRef(
      { bad: true },
      ctx,
      logger,
      dispatcher,
      'TEST'
    );
    expect(result).toBeNull();
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.any(String) })
    );
  });
});
