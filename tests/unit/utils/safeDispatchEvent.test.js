import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { safeDispatchEvent } from '../../../src/utils/safeDispatchEvent.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import * as loggerUtils from '../../../src/utils/loggerUtils.js';

jest.mock('../../../src/utils/loggerUtils.js');

describe('safeDispatchEvent', () => {
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = createMockLogger();
    loggerUtils.ensureValidLogger.mockReturnValue(logger);
  });

  it('logs a warning and skips dispatch when dispatcher is missing', async () => {
    await safeDispatchEvent(null, 'story:event-missing', { foo: 'bar' }, undefined);

    expect(loggerUtils.ensureValidLogger).toHaveBeenCalledWith(
      undefined,
      'safeDispatchEvent'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'SafeEventDispatcher unavailable for story:event-missing'
    );
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs a warning when dispatcher lacks a dispatch function', async () => {
    await safeDispatchEvent({}, 'story:no-dispatch', { value: 10 }, logger);

    expect(loggerUtils.ensureValidLogger).toHaveBeenCalledWith(logger, 'safeDispatchEvent');
    expect(logger.warn).toHaveBeenCalledWith(
      'SafeEventDispatcher unavailable for story:no-dispatch'
    );
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('dispatches the event and logs success details', async () => {
    const payload = { id: 42 };
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };

    await safeDispatchEvent(dispatcher, 'story:dispatch-success', payload, logger);

    expect(loggerUtils.ensureValidLogger).toHaveBeenCalledWith(logger, 'safeDispatchEvent');
    expect(dispatcher.dispatch).toHaveBeenCalledWith('story:dispatch-success', payload);
    expect(logger.debug).toHaveBeenCalledWith('Dispatched story:dispatch-success', {
      payload,
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs a warning when the dispatcher reports a failure result', async () => {
    const payload = { id: 314 }; // 3.14 for easy spotting in logs
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(false) };

    await safeDispatchEvent(
      dispatcher,
      'story:dispatch-failed-result',
      payload,
      logger
    );

    expect(loggerUtils.ensureValidLogger).toHaveBeenCalledWith(
      logger,
      'safeDispatchEvent'
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'story:dispatch-failed-result',
      payload
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Dispatcher reported failure for story:dispatch-failed-result. Payload may have been rejected.',
      { payload }
    );
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('passes dispatcher options when provided', async () => {
    const payload = { id: 99 };
    const options = { allowSchemaNotFound: true };
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };

    await safeDispatchEvent(
      dispatcher,
      'story:dispatch-with-options',
      payload,
      logger,
      options
    );

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'story:dispatch-with-options',
      payload,
      options
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Dispatched story:dispatch-with-options',
      {
        payload,
        options,
      }
    );
  });

  it('logs an error when dispatch throws', async () => {
    const error = new Error('network failure');
    const dispatcher = { dispatch: jest.fn().mockRejectedValue(error) };

    await safeDispatchEvent(dispatcher, 'story:dispatch-error', { reason: 'timeout' }, logger);

    expect(loggerUtils.ensureValidLogger).toHaveBeenCalledWith(logger, 'safeDispatchEvent');
    expect(dispatcher.dispatch).toHaveBeenCalledWith('story:dispatch-error', {
      reason: 'timeout',
    });
    expect(logger.error).toHaveBeenCalledWith('Failed to dispatch story:dispatch-error', error);
    expect(logger.debug).not.toHaveBeenCalled();
  });
});
