import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import {
  getServiceFromContext,
  ServiceLookupError,
} from '../../../../src/turns/states/helpers/getServiceFromContext.js';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

/**
 * Creates a minimal state object with mocked handler and finishProcessing.
 *
 * @param logger
 * @param dispatcher
 * @returns {object} Mock state
 */
const createState = (logger, dispatcher) => {
  const state = {
    getStateName: () => 'TestState',
    _handler: {
      getLogger: jest.fn(() => logger),
      getSafeEventDispatcher: jest.fn(() => dispatcher),
    },
    _exceptionHandler: { handle: jest.fn().mockResolvedValue(undefined) },
    isProcessing: false,
    finishProcessing: jest.fn(() => {
      state.isProcessing = false;
    }),
  };
  return state;
};

describe('getServiceFromContext', () => {
  let logger;
  let dispatcher;
  let state;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    dispatcher = { dispatch: jest.fn() };
    state = createState(logger, dispatcher);
  });

  test('returns service when context provides it', async () => {
    const service = {};
    const turnCtx = {
      getLogger: () => logger,
      getCommandProcessor: jest.fn(() => service),
    };

    const result = await getServiceFromContext(
      state,
      turnCtx,
      'getCommandProcessor',
      'ICommandProcessor',
      'actor1'
    );

    expect(result).toBe(service);
    expect(turnCtx.getCommandProcessor).toHaveBeenCalled();
    expect(state.finishProcessing).not.toHaveBeenCalled();
  });

  test('throws ServiceLookupError and finishes processing on failure', async () => {
    state.isProcessing = true;
    const turnCtx = {
      getLogger: () => logger,
      getSafeEventDispatcher: () => dispatcher,
      // method missing
    };

    await expect(
      getServiceFromContext(
        state,
        turnCtx,
        'getCommandProcessor',
        'ICommandProcessor',
        'actor2'
      )
    ).rejects.toBeInstanceOf(ServiceLookupError);

    expect(state.finishProcessing).toHaveBeenCalled();
    expect(state.isProcessing).toBe(false);
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      expect.any(String),
      expect.any(Object),
      logger
    );
  });
});
