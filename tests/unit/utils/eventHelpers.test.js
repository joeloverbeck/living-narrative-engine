import { describe, test, expect, jest } from '@jest/globals';
import { safeDispatch } from '../../../src/utils/eventHelpers.js';

describe('safeDispatch', () => {
  test('logs error when dispatch rejects and does not throw', async () => {
    const bus = { dispatch: jest.fn().mockRejectedValue(new Error('boom')) };
    const logger = { error: jest.fn() };
    await expect(
      safeDispatch(bus, 'evt', { foo: 'bar' }, logger)
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
