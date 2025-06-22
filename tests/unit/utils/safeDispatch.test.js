import { describe, test, expect, jest } from '@jest/globals';
import { safeDispatch } from '../../../src/utils/eventHelpers.js';

describe('safeDispatch utility', () => {
  test('logs error when dispatch rejects', async () => {
    const bus = { dispatch: jest.fn().mockRejectedValue(new Error('boom')) };
    const logger = { error: jest.fn() };
    await safeDispatch(bus, 'evt', { ok: true }, logger);
    expect(logger.error).toHaveBeenCalledWith(
      'Dispatch evt failed: boom',
      expect.any(Error)
    );
  });

  test('does not log when dispatch succeeds', async () => {
    const bus = { dispatch: jest.fn().mockResolvedValue(true) };
    const logger = { error: jest.fn() };
    await safeDispatch(bus, 'evt', { ok: true }, logger);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
