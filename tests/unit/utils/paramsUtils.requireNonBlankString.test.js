import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

import { requireNonBlankString } from '../../../src/utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

describe('requireNonBlankString', () => {
  it('returns trimmed string when valid', () => {
    const logger = { warn: jest.fn() };
    const result = requireNonBlankString('  hi  ', 'name', logger);
    expect(result).toBe('hi');
    expect(logger.warn).not.toHaveBeenCalled();
    expect(safeDispatchError).not.toHaveBeenCalled();
  });

  it('dispatches error when dispatcher provided', () => {
    const logger = { warn: jest.fn() };
    const dispatcher = { dispatch: jest.fn() };
    const result = requireNonBlankString('  ', 'foo', logger, dispatcher);
    expect(result).toBeNull();
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'Invalid or missing "foo" parameter',
      { foo: '  ' },
      logger
    );
  });

  it('logs warning when dispatcher missing', () => {
    const logger = { warn: jest.fn() };
    const result = requireNonBlankString('', 'bar', logger);
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'Invalid or missing "bar" parameter',
      { bar: '' }
    );
  });
});
