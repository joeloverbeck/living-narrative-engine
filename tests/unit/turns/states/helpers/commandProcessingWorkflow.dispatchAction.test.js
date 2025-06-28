import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CommandProcessingWorkflow } from '../../../../../src/turns/states/helpers/commandProcessingWorkflow.js';
import { ServiceLookupError } from '../../../../../src/turns/states/helpers/getServiceFromContext.js';
import * as errorUtils from '../../../../../src/turns/states/helpers/processingErrorUtils.js';

describe('CommandProcessingWorkflow _dispatchAction and processCommand', () => {
  let logger;
  let state;
  let actor;
  let turnCtx;
  let exceptionHandler;
  let commandProcessor;
  let outcomeInterpreter;
  let directiveStrategyResolver;
  let workflow;

  beforeEach(() => {
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    actor = { id: 'actor1' };
    turnCtx = { getLogger: () => logger, getActor: () => actor };
    state = {
      _flag: true,
      _setProcessing(v) {
        this._flag = v;
      },
      get isProcessing() {
        return this._flag;
      },
      _handler: { getCurrentState: jest.fn(() => state) },
      _getTurnContext: jest.fn(() => turnCtx),
      getStateName: () => 'TestState',
    };
    exceptionHandler = { handle: jest.fn() };
    commandProcessor = {
      dispatchAction: jest.fn(async () => ({ success: true })),
    };
    outcomeInterpreter = { interpret: jest.fn(async () => 'SOME_DIRECTIVE') };
    directiveStrategyResolver = {
      resolveStrategy: jest.fn(() => ({ execute: jest.fn() })),
    };
    workflow = new CommandProcessingWorkflow({
      state,
      exceptionHandler,
      commandProcessor,
      commandOutcomeInterpreter: outcomeInterpreter,
      directiveStrategyResolver,
    });
  });

  it('handles missing commandProcessor', async () => {
    workflow._commandProcessor = null;
    const result = await workflow._dispatchAction(turnCtx, actor, {
      actionDefinitionId: 'a1',
    });
    expect(result).toBeNull();
    expect(exceptionHandler.handle).toHaveBeenCalledWith(
      turnCtx,
      expect.any(ServiceLookupError),
      'actor1'
    );
  });

  it('returns null when processing flag cleared during dispatch', async () => {
    commandProcessor.dispatchAction.mockImplementation(async () => {
      state._setProcessing(false);
      return { success: true };
    });
    const result = await workflow._dispatchAction(turnCtx, actor, {
      actionDefinitionId: 'a1',
    });
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('handles context change after dispatch', async () => {
    const invalidCtx = {
      getLogger: () => logger,
      getActor: () => ({ id: 'other' }),
    };
    state._getTurnContext.mockReturnValueOnce(invalidCtx);
    const result = await workflow._dispatchAction(turnCtx, actor, {
      actionDefinitionId: 'a1',
    });
    expect(result).toBeNull();
    expect(exceptionHandler.handle).toHaveBeenCalledWith(
      invalidCtx,
      expect.any(Error),
      'actor1',
      false
    );
  });

  it('returns context and result on success', async () => {
    const res = await workflow._dispatchAction(turnCtx, actor, {
      actionDefinitionId: 'a1',
    });
    expect(res).toEqual({
      activeTurnCtx: turnCtx,
      commandResult: { success: true },
    });
  });

  it('processCommand cleans up when dispatchAction returns null', async () => {
    jest.spyOn(workflow, '_dispatchAction').mockResolvedValue(null);
    const finishSpy = jest.spyOn(errorUtils, 'finishProcessing');
    await workflow.processCommand(turnCtx, actor, { actionDefinitionId: 'a1' });
    expect(finishSpy).toHaveBeenCalledWith(state);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('processCommand handles dispatch errors and finalizes state', async () => {
    jest
      .spyOn(workflow, '_dispatchAction')
      .mockRejectedValue(new Error('boom'));
    const finishSpy = jest.spyOn(errorUtils, 'finishProcessing');
    await workflow.processCommand(turnCtx, actor, { actionDefinitionId: 'a1' });
    expect(exceptionHandler.handle).toHaveBeenCalled();
    expect(finishSpy).toHaveBeenCalledWith(state);
  });
});
