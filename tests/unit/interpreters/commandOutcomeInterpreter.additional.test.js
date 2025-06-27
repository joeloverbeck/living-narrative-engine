import { jest } from '@jest/globals';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(() => Promise.resolve()),
}));

import CommandOutcomeInterpreter from '../../../src/commands/interpreters/commandOutcomeInterpreter.js';
import TurnDirective from '../../../src/turns/constants/turnDirectives.js';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

let logger;
let dispatcher;
let turnContext;

beforeEach(() => {
  jest.clearAllMocks();
  logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  dispatcher = { dispatch: jest.fn() };
  turnContext = {
    getActor: jest.fn(() => ({ id: 'actor-1' })),
    getChosenAction: jest.fn(() => ({ actionDefinitionId: 'test:chosen' })),
  };
});

describe('CommandOutcomeInterpreter additional branches', () => {
  it('throws when logger is invalid', () => {
    expect(
      () => new CommandOutcomeInterpreter({ dispatcher, logger: {} })
    ).toThrow("Invalid or missing method 'info' on dependency 'logger'.");
  });

  it('throws when dispatcher is invalid', () => {
    expect(
      () => new CommandOutcomeInterpreter({ dispatcher: {}, logger })
    ).toThrow(
      "Invalid or missing method 'dispatch' on dependency 'ISafeEventDispatcher'."
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Invalid or missing method 'dispatch' on dependency 'ISafeEventDispatcher'."
    );
  });

  it('dispatches error when result lacks success flag', async () => {
    const interpreter = new CommandOutcomeInterpreter({ dispatcher, logger });
    await expect(interpreter.interpret({}, turnContext)).rejects.toThrow(
      "CommandOutcomeInterpreter: Invalid CommandResult - 'success' boolean is missing. Actor: actor-1."
    );
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      expect.stringContaining('Invalid CommandResult'),
      expect.any(Object)
    );
  });

  it('returns END_TURN_FAILURE when command fails', async () => {
    const interpreter = new CommandOutcomeInterpreter({ dispatcher, logger });
    const result = {
      success: false,
      turnEnded: false,
      actionResult: { actionId: 'fail:action' },
    };
    const directive = await interpreter.interpret(result, turnContext);
    expect(directive).toBe(TurnDirective.END_TURN_FAILURE);
  });

  it('uses chosen action when actionId missing', async () => {
    const interpreter = new CommandOutcomeInterpreter({ dispatcher, logger });
    const result = {
      success: true,
      turnEnded: false,
      actionResult: { actionId: '  ' },
    };
    const directive = await interpreter.interpret(result, turnContext);
    expect(directive).toBe(TurnDirective.WAIT_FOR_EVENT);
    expect(logger.debug).toHaveBeenCalledWith(
      "CommandOutcomeInterpreter: actor actor-1: result.actionResult.actionId ('  ') invalid/missing. Using action identifier: 'test:chosen'."
    );
  });

  it('defaults to unknown action when chosen action missing', async () => {
    const interpreter = new CommandOutcomeInterpreter({ dispatcher, logger });
    turnContext.getChosenAction.mockReturnValue(undefined);
    const result = {
      success: true,
      turnEnded: false,
      actionResult: {},
    };
    const directive = await interpreter.interpret(result, turnContext);
    expect(directive).toBe(TurnDirective.WAIT_FOR_EVENT);
    expect(logger.debug).toHaveBeenCalledWith(
      "CommandOutcomeInterpreter: actor actor-1: result.actionResult.actionId ('undefined') invalid/missing. Using action identifier: 'core:unknown_action'."
    );
  });
});
