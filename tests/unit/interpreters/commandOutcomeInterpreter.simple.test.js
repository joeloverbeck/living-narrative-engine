import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import CommandOutcomeInterpreter from '../../../src/commands/interpreters/commandOutcomeInterpreter.js';
import TurnDirective from '../../../src/turns/constants/turnDirectives.js';

const mkLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('CommandOutcomeInterpreter.interpret basic cases', () => {
  let logger;
  let dispatcher;
  let interpreter;
  let turnContext;

  beforeEach(() => {
    logger = mkLogger();
    dispatcher = { dispatch: jest.fn() };
    turnContext = {
      getActor: jest.fn(() => ({ id: 'actor1' })),
      getChosenAction: jest.fn(() => ({ actionDefinitionId: 'test:action' })),
    };
    interpreter = new CommandOutcomeInterpreter({ dispatcher, logger });
    jest.clearAllMocks();
  });

  it('returns WAIT_FOR_EVENT when command result indicates success', async () => {
    const result = {
      success: true,
      turnEnded: false,
      actionResult: { actionId: 'test:action' },
    };
    const directive = await interpreter.interpret(result, turnContext);
    expect(directive).toBe(TurnDirective.WAIT_FOR_EVENT);
  });

  it('returns END_TURN_FAILURE when command result indicates failure', async () => {
    const result = {
      success: false,
      turnEnded: true,
      actionResult: { actionId: 'test:action' },
    };
    const directive = await interpreter.interpret(result, turnContext);
    expect(directive).toBe(TurnDirective.END_TURN_FAILURE);
  });

  it('throws when turn context is invalid', async () => {
    await expect(
      interpreter.interpret({ success: true, turnEnded: false }, null)
    ).rejects.toThrow(
      'CommandOutcomeInterpreter: Invalid turnContext provided.'
    );
  });
});
