import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { CommandProcessingWorkflow } from '../../../../../src/turns/states/helpers/commandProcessingWorkflow.js';
import * as errorUtils from '../../../../../src/turns/states/helpers/processingErrorUtils.js';

describe('_executeDirectiveStrategy guard clauses', () => {
  let state;
  let resolver;
  let workflow;
  let logger;
  let ctx;
  let exceptionHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    state = {
      _flag: true,
      _setProcessing(v) {
        this._flag = v;
      },
      get isProcessing() {
        return this._flag;
      },
      _handler: { getCurrentState: jest.fn(() => state) },
      getStateName: () => 'TestState',
    };
    resolver = { resolveStrategy: jest.fn() };
    exceptionHandler = { handle: jest.fn() };
    workflow = new CommandProcessingWorkflow({
      state,
      exceptionHandler,
      commandProcessor: {},
      commandOutcomeInterpreter: {},
      directiveStrategyResolver: resolver,
    });
    ctx = { getLogger: () => logger, getActor: () => ({ id: 'a1' }) };
  });

  test('returns early when strategy lookup fails', async () => {
    const spy = jest.spyOn(errorUtils, 'finishProcessing');
    resolver.resolveStrategy.mockReturnValue(null);

    await workflow._executeDirectiveStrategy(ctx, 'missing', {});

    expect(exceptionHandler.handle).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Could not resolve ITurnDirectiveStrategy')
    );
    expect(spy).not.toHaveBeenCalled();
  });

  test('returns early when processing flag is false', async () => {
    const strategy = {
      execute: jest.fn(() => {
        state._setProcessing(false);
      }),
    };
    const spy = jest.spyOn(errorUtils, 'finishProcessing');
    resolver.resolveStrategy.mockReturnValue(strategy);

    await workflow._executeDirectiveStrategy(ctx, 'dir', {});

    expect(strategy.execute).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });

  test('finishes processing when state changes', async () => {
    const strategy = { execute: jest.fn() };
    const spy = jest.spyOn(errorUtils, 'finishProcessing');
    resolver.resolveStrategy.mockReturnValue(strategy);
    state._handler.getCurrentState.mockReturnValueOnce(null);

    await workflow._executeDirectiveStrategy(ctx, 'dir', {});

    expect(strategy.execute).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(state);
  });
});
