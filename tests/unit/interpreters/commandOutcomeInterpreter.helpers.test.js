import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import CommandOutcomeInterpreter from '../../../src/commands/interpreters/commandOutcomeInterpreter.js';
import TurnDirective from '../../../src/turns/constants/turnDirectives.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(() => Promise.resolve()),
}));

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
    getChosenAction: jest.fn(() => ({ actionDefinitionId: 'test:action' })),
  };
});

describe('CommandOutcomeInterpreter helper logic via interpret', () => {
  it('validateTurnContext dispatches error for invalid context', async () => {
    const interpreter = new CommandOutcomeInterpreter({ dispatcher, logger });
    await expect(interpreter.interpret({}, {})).rejects.toThrow(
      'CommandOutcomeInterpreter: Invalid turnContext provided.'
    );
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'CommandOutcomeInterpreter: Invalid turnContext provided.',
      {
        raw: 'turnContext was object. Expected ITurnContext object.',
        timestamp: expect.any(String),
        stack: expect.any(String),
        receivedContextType: 'object',
      }
    );
  });

  it('validateResult dispatches error when success flag missing', async () => {
    const interpreter = new CommandOutcomeInterpreter({ dispatcher, logger });
    await expect(interpreter.interpret({}, turnContext)).rejects.toThrow(
      "CommandOutcomeInterpreter: Invalid CommandResult - 'success' boolean is missing. Actor: actor-1."
    );
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      expect.stringContaining('Invalid CommandResult'),
      {
        raw: 'Actor actor-1, Received Result: {}',
        timestamp: expect.any(String),
        stack: expect.any(String),
        receivedResult: {},
      }
    );
  });

  it('resolveActionId falls back to chosen action when actionId missing', async () => {
    const interpreter = new CommandOutcomeInterpreter({ dispatcher, logger });
    const result = {
      success: true,
      turnEnded: false,
      actionResult: { actionId: ' ' },
    };
    const directive = await interpreter.interpret(result, turnContext);
    expect(directive).toBe(TurnDirective.WAIT_FOR_EVENT);
    expect(logger.debug).toHaveBeenCalledWith(
      "CommandOutcomeInterpreter: actor actor-1: result.actionResult.actionId (' ') invalid/missing. Using action identifier: 'test:action'."
    );
  });
});
