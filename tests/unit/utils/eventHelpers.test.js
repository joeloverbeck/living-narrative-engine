import { describe, test, expect, jest } from '@jest/globals';
import { dispatchWithLogging } from '../../../src/utils/eventDispatchUtils.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('dispatchWithLogging (basic)', () => {
  test('logs error when dispatch rejects and does not throw', async () => {
    const bus = { dispatch: jest.fn().mockRejectedValue(new Error('boom')) };
    const logger = createMockLogger();
    await expect(
      dispatchWithLogging(bus, 'evt', { foo: 'bar' }, logger)
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
