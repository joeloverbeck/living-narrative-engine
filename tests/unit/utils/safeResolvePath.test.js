import { describe, it, expect } from '@jest/globals';
import { safeResolvePath } from '../../../src/utils/objectUtils.js';
import { createMockLogger } from '../testUtils.js';

describe('safeResolvePath', () => {
  it('dispatches error when dispatcher provided', () => {
    const logger = createMockLogger();
    const dispatcher = { dispatch: jest.fn() };
    const result = safeResolvePath({}, null, logger, 'unit-test', dispatcher);
    expect(result).toBeUndefined();
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ message: expect.stringContaining('unit-test') })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs error when dispatcher not provided', () => {
    const logger = createMockLogger();
    const result = safeResolvePath({}, null, logger, 'unit-test');
    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('unit-test'),
      expect.any(Error)
    );
  });
});
