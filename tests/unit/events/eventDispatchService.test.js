import { describe, it, expect, jest } from '@jest/globals';
import EventDispatchService from '../../../src/events/eventDispatchService.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

describe('EventDispatchService.dispatch', () => {
  it('logs success when dispatcher resolves true', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    const logger = createMockLogger();
    const service = new EventDispatchService();

    const result = await service.dispatch(
      dispatcher,
      'evt',
      { a: 1 },
      { logger, context: 'ctx' }
    );

    expect(result).toBe(true);
    expect(dispatcher.dispatch).toHaveBeenCalledWith('evt', { a: 1 }, {});
    expect(logger.debug).toHaveBeenCalledWith(
      "EventDispatchService: Attempting dispatch: ctx ('evt')"
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'EventDispatchService: Dispatch successful ctx.'
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs warning when dispatcher returns false', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(false) };
    const logger = createMockLogger();
    const service = new EventDispatchService();

    const result = await service.dispatch(
      dispatcher,
      'evt',
      { b: 2 },
      { logger }
    );

    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'EventDispatchService: Dispatcher reported failure'
      )
    );
    expect(safeDispatchError).not.toHaveBeenCalled();
  });

  it('handles exception by logging and dispatching system error', async () => {
    const error = new Error('boom');
    const dispatcher = { dispatch: jest.fn().mockRejectedValue(error) };
    const logger = createMockLogger();
    const service = new EventDispatchService();

    const result = await service.dispatch(
      dispatcher,
      'evt',
      { c: 3 },
      { logger, errorDetails: { foo: 'bar' } }
    );

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      "EventDispatchService: CRITICAL - Error during dispatch ('evt'). Error: boom",
      error
    );
    expect(safeDispatchError).toHaveBeenCalled();
  });
});
