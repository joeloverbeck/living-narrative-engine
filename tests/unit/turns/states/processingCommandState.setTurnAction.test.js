import { describe, test, expect, jest } from '@jest/globals';
import { ProcessingCommandState } from '../../../../src/turns/states/processingCommandState.js';
import TurnDirectiveStrategyResolver from '../../../../src/turns/strategies/turnDirectiveStrategyResolver.js';

describe('ProcessingCommandState _setTurnAction usage', () => {
  test('action updates occur via _setTurnAction', async () => {
    const setTurnActionSpy = jest.spyOn(
      ProcessingCommandState.prototype,
      '_setTurnAction'
    );

    const handler = {
      getLogger: () => ({
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }),
    };
    const commandProcessor = { dispatchAction: jest.fn() };
    const commandOutcomeInterpreter = { interpret: jest.fn() };

    const initialAction = { actionDefinitionId: 'init', commandString: 'cmd' };
    const updatedAction = {
      actionDefinitionId: 'update',
      commandString: 'new',
    };

    const processingWorkflowFactory = (state, cmd, action, setAction) => {
      setAction(updatedAction);
      return { run: jest.fn().mockResolvedValue(undefined) };
    };

    const state = new ProcessingCommandState({
      handler,
      commandProcessor,
      commandOutcomeInterpreter,
      commandString: initialAction.commandString,
      turnAction: initialAction,
      directiveResolver: TurnDirectiveStrategyResolver.default,
      processingWorkflowFactory,
    });

    await state.enterState(handler, null);

    expect(setTurnActionSpy).toHaveBeenNthCalledWith(1, initialAction);
    expect(setTurnActionSpy).toHaveBeenNthCalledWith(2, updatedAction);
    expect(setTurnActionSpy).toHaveBeenCalledTimes(2);
  });
});
