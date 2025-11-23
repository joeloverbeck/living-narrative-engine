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
    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
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
    expect(logger.debug).toHaveBeenCalled();
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

  describe('_isContextValid method', () => {
    it('should return false when turnCtx is null', () => {
      const result = workflow._isContextValid(null, 'actor1');
      expect(result).toBe(false);
    });

    it('should return false when turnCtx is undefined', () => {
      const result = workflow._isContextValid(undefined, 'actor1');
      expect(result).toBe(false);
    });

    it('should return false when getActor is not a function', () => {
      const invalidCtx = { getLogger: () => logger };
      const result = workflow._isContextValid(invalidCtx, 'actor1');
      expect(result).toBe(false);
    });

    it('should return false when actor IDs do not match', () => {
      const differentCtx = {
        getLogger: () => logger,
        getActor: () => ({ id: 'differentActor' }),
      };
      const result = workflow._isContextValid(differentCtx, 'actor1');
      expect(result).toBe(false);
    });

    it('should return false when getActor returns null', () => {
      const nullActorCtx = {
        getLogger: () => logger,
        getActor: () => null,
      };
      const result = workflow._isContextValid(nullActorCtx, 'actor1');
      expect(result).toBe(false);
    });

    it('should return true when context is valid and actor IDs match', () => {
      const result = workflow._isContextValid(turnCtx, 'actor1');
      expect(result).toBe(true);
    });
  });

  describe('processCommand finally block', () => {
    it('should force processing to false when still processing at end', async () => {
      // Mock the workflow to complete successfully but keep processing true
      jest.spyOn(workflow, '_dispatchAction').mockResolvedValue({
        activeTurnCtx: turnCtx,
        commandResult: { success: true },
      });
      jest.spyOn(workflow, '_interpretCommandResult').mockResolvedValue({
        directiveType: 'TEST_DIRECTIVE',
      });
      jest.spyOn(workflow, '_executeDirectiveStrategy').mockResolvedValue();

      const finishSpy = jest.spyOn(errorUtils, 'finishProcessing');

      await workflow.processCommand(turnCtx, actor, {
        actionDefinitionId: 'a1',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'TestState: isProcessing was unexpectedly true at the end of _processCommandInternal for actor1. Forcing to false.'
      );
      expect(finishSpy).toHaveBeenCalledWith(state);
    });

    it('should not warn when processing is already false', async () => {
      // Mock workflow to set processing to false
      jest.spyOn(workflow, '_dispatchAction').mockImplementation(async () => {
        state._setProcessing(false);
        return null;
      });

      await workflow.processCommand(turnCtx, actor, {
        actionDefinitionId: 'a1',
      });

      // Should not warn about unexpected processing state
      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('isProcessing was unexpectedly true')
      );
    });

    it('should not warn when state has changed', async () => {
      const newState = { getStateName: () => 'NewState' };

      jest.spyOn(workflow, '_dispatchAction').mockResolvedValue({
        activeTurnCtx: turnCtx,
        commandResult: { success: true },
      });
      jest.spyOn(workflow, '_interpretCommandResult').mockResolvedValue({
        directiveType: 'TEST_DIRECTIVE',
      });
      jest
        .spyOn(workflow, '_executeDirectiveStrategy')
        .mockImplementation(async () => {
          state._handler.getCurrentState.mockReturnValue(newState);
        });

      await workflow.processCommand(turnCtx, actor, {
        actionDefinitionId: 'a1',
      });

      // Should not warn about unexpected processing state when state changed
      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('isProcessing was unexpectedly true')
      );
    });
  });

  describe('processCommand edge cases', () => {
    it('should handle when interpretCommandResult returns null', async () => {
      jest.spyOn(workflow, '_dispatchAction').mockResolvedValue({
        activeTurnCtx: turnCtx,
        commandResult: { success: true },
      });
      jest.spyOn(workflow, '_interpretCommandResult').mockResolvedValue(null);

      const finishSpy = jest.spyOn(errorUtils, 'finishProcessing');

      await workflow.processCommand(turnCtx, actor, {
        actionDefinitionId: 'a1',
      });

      expect(finishSpy).toHaveBeenCalledWith(state);
    });
  });

  describe('_executeDirectiveStrategy fallback branch', () => {
    it('should log debug when state remains same after strategy execution', async () => {
      // Create a new workflow without directiveExecutor to test fallback path
      const workflowNoExecutor = new CommandProcessingWorkflow({
        state,
        exceptionHandler,
        commandProcessor,
        commandOutcomeInterpreter: outcomeInterpreter,
        directiveStrategyResolver,
      });

      const strategy = {
        execute: jest.fn(),
        constructor: { name: 'TestStrategy' },
      };
      directiveStrategyResolver.resolveStrategy.mockReturnValue(strategy);

      const finishSpy = jest.spyOn(errorUtils, 'finishProcessing');

      await workflowNoExecutor._executeDirectiveStrategy(
        turnCtx,
        'TEST_DIRECTIVE',
        { success: true }
      );

      expect(logger.debug).toHaveBeenCalledWith(
        'TestState: Directive strategy executed for actor1, state remains TestState.'
      );
      expect(finishSpy).toHaveBeenCalledWith(state);
    });
  });
});
