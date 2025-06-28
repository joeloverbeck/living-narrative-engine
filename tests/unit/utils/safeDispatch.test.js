import { describe, test, expect, jest } from '@jest/globals';
import { dispatchWithLogging } from '../../../src/utils/eventDispatchUtils.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('dispatchWithLogging utility', () => {
  test('logs error when dispatch rejects', async () => {
    const bus = { dispatch: jest.fn().mockRejectedValue(new Error('boom')) };
    const logger = createMockLogger();
    await dispatchWithLogging(bus, 'evt', { ok: true }, logger);
    expect(logger.error).toHaveBeenCalledWith(
      "Failed dispatching 'evt' event.",
      expect.any(Error)
    );
  });

  test('does not log when dispatch succeeds', async () => {
    const bus = { dispatch: jest.fn().mockResolvedValue(true) };
    const logger = createMockLogger();
    await dispatchWithLogging(bus, 'evt', { ok: true }, logger);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
