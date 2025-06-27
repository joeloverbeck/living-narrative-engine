import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import {
  getServiceFromContext,
  ServiceLookupError,
} from '../../../../../src/turns/states/helpers/getServiceFromContext.js';
import { safeDispatchError } from '../../../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

describe('getServiceFromContext cause chain', () => {
  let logger;
  let dispatcher;
  let handler;
  let state;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    dispatcher = { dispatch: jest.fn() };
    handler = {
      getLogger: jest.fn(() => logger),
      getSafeEventDispatcher: jest.fn(() => dispatcher),
    };
    state = {
      getStateName: () => 'TestState',
      _handler: handler,
      _exceptionHandler: { handle: jest.fn().mockResolvedValue(undefined) },
      isProcessing: true,
      finishProcessing: jest.fn(() => {
        state.isProcessing = false;
      }),
    };
  });

  test('throws ServiceLookupError with cause when service method throws', async () => {
    const serviceError = new Error('oops');
    const turnCtx = {
      getLogger: () => logger,
      getCommandProcessor: () => {
        throw serviceError;
      },
      getSafeEventDispatcher: () => dispatcher,
    };

    let caught;
    try {
      await getServiceFromContext(
        state,
        turnCtx,
        'getCommandProcessor',
        'ICommandProcessor',
        'actorA'
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ServiceLookupError);
    expect(caught.cause).toBe(serviceError);
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      expect.any(String),
      expect.objectContaining({
        cause: serviceError.message,
        causeStack: serviceError.stack,
      }),
      logger
    );
  });
});
