import { describe, it, expect } from '@jest/globals';
import { safeResolvePath } from '../../../src/utils/objectUtils.js';
import { createMockLogger } from '../testUtils.js';

describe('safeResolvePath', () => {
  it('returns undefined and logs when resolvePath throws', () => {
    const logger = createMockLogger();
    const result = safeResolvePath({}, null, logger, 'unit-test');
    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('unit-test'),
      expect.any(Error)
    );
  });
});
