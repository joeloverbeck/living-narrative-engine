import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

import {
  validateEntityRef,
  validateComponentType,
} from '../../../src/utils/operationValidationUtils.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

const logger = {
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

const ctx = {
  evaluationContext: { actor: { id: 'a1' }, target: { id: 't1' } },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('operationValidationUtils additional branches', () => {
  it('warns when entityRef is missing without dispatcher', () => {
    const result = validateEntityRef(null, ctx, logger);
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      '"entity_ref" parameter is required.'
    );
    expect(safeDispatchError).not.toHaveBeenCalled();
  });

  it('dispatches when entityRef is missing and dispatcher provided', () => {
    const dispatcher = { dispatch: jest.fn() };
    const result = validateEntityRef(null, ctx, logger, dispatcher, 'TEST');
    expect(result).toBeNull();
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'TEST: "entity_ref" parameter is required.',
      { entity_ref: null },
      logger
    );
  });

  it('warns when entityRef cannot be resolved and no dispatcher', () => {
    const badRef = { bad: true };
    const result = validateEntityRef(badRef, ctx, logger);
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not resolve entity id from entity_ref.',
      { entity_ref: badRef }
    );
    expect(safeDispatchError).not.toHaveBeenCalled();
  });

  it('warns when dispatcher lacks dispatch method', () => {
    const result = validateEntityRef(
      undefined,
      ctx,
      logger,
      { foo: 1 },
      'TEST'
    );
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'TEST: "entity_ref" parameter is required.'
    );
    expect(safeDispatchError).not.toHaveBeenCalled();
  });

  it('validateComponentType warns on non-string input', () => {
    const result = validateComponentType(42, logger);
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'Invalid or missing "component_type" parameter (must be non-empty string).'
    );
  });

  it('validateComponentType works without operationName', () => {
    const result = validateComponentType('stat', logger);
    expect(result).toBe('stat');
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
