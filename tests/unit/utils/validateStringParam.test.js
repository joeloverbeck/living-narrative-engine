import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { validateStringParam } from '../../../src/utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

describe('validateStringParam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns trimmed string when value is valid', () => {
    const logger = { warn: jest.fn() };
    const dispatcher = { dispatch: jest.fn() };
    const result = validateStringParam('  hello  ', 'name', logger, dispatcher);
    expect(result).toBe('hello');
    expect(logger.warn).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('dispatches error when dispatcher is provided for invalid value', () => {
    const logger = { warn: jest.fn() };
    const dispatcher = { dispatch: jest.fn() };
    const result = validateStringParam('', 'name', logger, dispatcher);
    expect(result).toBeNull();
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'Invalid "name" parameter',
      { name: '' },
      logger
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs warning when dispatcher is absent and value invalid', () => {
    const logger = { warn: jest.fn() };
    const result = validateStringParam('  ', 'name', logger, null);
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('Invalid "name" parameter', {
      name: '  ',
    });
  });

  it('returns null silently when no logger or dispatcher provided', () => {
    const result = validateStringParam(null, 'name');
    expect(result).toBeNull();
    expect(safeDispatchError).not.toHaveBeenCalled();
  });
});
