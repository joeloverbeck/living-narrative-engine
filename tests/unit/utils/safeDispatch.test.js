import { describe, test, expect, jest } from '@jest/globals';
import { safeDispatch } from '../../../src/utils/eventHelpers.js';

describe('safeDispatch utility', () => {
  test('logs error when dispatch rejects', async () => {
    const bus = { dispatch: jest.fn().mockRejectedValue(new Error('boom')) };
    const logger = { error: jest.fn(), warn: jest.fn() };
    await safeDispatch(bus, 'evt', { ok: true }, logger);
    expect(logger.error).toHaveBeenCalledWith(
      'Dispatch evt failed: boom',
      expect.any(Error)
    );
  });

  test('does not log when dispatch succeeds', async () => {
    const bus = { dispatch: jest.fn().mockResolvedValue(true) };
    const logger = { error: jest.fn(), warn: jest.fn() };
    await safeDispatch(bus, 'evt', { ok: true }, logger);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('logs warning when dispatch returns false', async () => {
    const bus = { dispatch: jest.fn().mockResolvedValue(false) };
    const logger = { error: jest.fn(), warn: jest.fn() };

    await safeDispatch(bus, 'evt', { ok: true }, logger);

    expect(logger.warn).toHaveBeenCalledWith(
      'Dispatch evt was rejected by the dispatcher.',
      { payload: { ok: true } }
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('logs warning when dispatch returns unexpected value', async () => {
    const bus = { dispatch: jest.fn().mockResolvedValue('maybe') };
    const logger = { error: jest.fn(), warn: jest.fn() };

    await safeDispatch(bus, 'evt', { ok: true }, logger);

    expect(logger.warn).toHaveBeenCalledWith(
      'Dispatch evt returned unexpected result: maybe.',
      { payload: { ok: true } }
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});
