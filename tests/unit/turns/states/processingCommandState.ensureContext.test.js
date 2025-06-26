import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ProcessingCommandState } from '../../../../src/turns/states/processingCommandState.js';

const makeLogger = () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('ProcessingCommandState._ensureContext', () => {
  let logger;
  let ctx;
  let handler;
  let commandProcessor;
  let state;

  beforeEach(() => {
    logger = makeLogger();
    ctx = {
      getLogger: () => logger,
      getActor: jest.fn(() => ({ id: 'a1' })),
      getSafeEventDispatcher: jest.fn(() => ({ dispatch: jest.fn() })),
    };
    handler = {
      getLogger: jest.fn(() => logger),
      getTurnContext: jest.fn(() => ctx),
      resetStateAndResources: jest.fn(),
      requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
    };
    commandProcessor = {
      processCommand: jest.fn(),
    };
    state = new ProcessingCommandState({
      handler: handler,
      commandProcessor: commandProcessor,
    });
  });

  test('resets to idle when required methods are missing', async () => {
    const result = await state._ensureContext('missing');
    expect(result).toBeNull();
    const expectedMsg =
      'ProcessingCommandState: ITurnContext missing required methods: getChosenAction';
    expect(logger.error).toHaveBeenCalledWith(expectedMsg);
    expect(handler.resetStateAndResources).toHaveBeenCalledWith(
      'missing-methods-ProcessingCommandState'
    );
    expect(handler.requestIdleStateTransition).toHaveBeenCalled();
  });
});
