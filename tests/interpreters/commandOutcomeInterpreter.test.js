// src/tests/interpreters/commandOutcomeInterpreter.test.js

import CommandOutcomeInterpreter from '../../src/commands/interpreters/commandOutcomeInterpreter.js';
import TurnDirective from '../../src/turns/constants/turnDirectives.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mocks
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
const mockDispatcher = {
  dispatch: jest.fn(),
};

let mockTurnContext;
let mockActor;

describe('CommandOutcomeInterpreter', () => {
  let interpreter;
  const defaultActorIdForTests = 'defaultTestActorId';

  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatcher.dispatch.mockImplementation(() => Promise.resolve(true));

    mockActor = { id: defaultActorIdForTests };
    mockTurnContext = {
      getActor: jest.fn(() => mockActor),
    };

    interpreter = new CommandOutcomeInterpreter({
      dispatcher: mockDispatcher,
      logger: mockLogger,
    });
  });

  describe('interpret - input validation', () => {
    it('should throw if turnContext is invalid or actor cannot be retrieved from turnContext', async () => {
      // Test for null turnContext
      await expect(interpreter.interpret({}, null)).rejects.toThrow(
        'CommandOutcomeInterpreter: Invalid turnContext provided.'
      );

      // Test for turnContext without getActor method
      await expect(interpreter.interpret({}, {})).rejects.toThrow(
        'CommandOutcomeInterpreter: Invalid turnContext provided.'
      );

      // Test for turnContext.getActor() returning null
      mockTurnContext.getActor.mockReturnValue(null);
      await expect(interpreter.interpret({}, mockTurnContext)).rejects.toThrow(
        'CommandOutcomeInterpreter: Could not retrieve a valid actor or actor ID from turnContext.'
      );

      // Test for turnContext.getActor() returning an actor without an id
      mockTurnContext.getActor.mockReturnValue({});
      await expect(interpreter.interpret({}, mockTurnContext)).rejects.toThrow(
        'CommandOutcomeInterpreter: Could not retrieve a valid actor or actor ID from turnContext.'
      );

      // Test for turnContext.getActor() returning an actor with a null id
      mockTurnContext.getActor.mockReturnValue({ id: null });
      await expect(interpreter.interpret({}, mockTurnContext)).rejects.toThrow(
        'CommandOutcomeInterpreter: Could not retrieve a valid actor or actor ID from turnContext.'
      );

      // Test for turnContext.getActor() returning an actor with an empty string id
      mockTurnContext.getActor.mockReturnValue({ id: '' });
      await expect(interpreter.interpret({}, mockTurnContext)).rejects.toThrow(
        'CommandOutcomeInterpreter: Could not retrieve a valid actor or actor ID from turnContext.'
      );
    });
  });

  describe('interpret - success path (removed core:action_executed)', () => {
    const successActorId = 'player:1_success';
    beforeEach(() => {
      mockActor.id = successActorId;
    });

    it('should return WAIT_FOR_EVENT without dispatching any event', async () => {
      const commandResult = {
        success: true,
        turnEnded: false,
        message: 'This message is ignored.',
        actionResult: {
          actionId: 'test:action',
          messages: [{ text: 'Test message.', type: 'info' }],
        },
      };

      const directive = await interpreter.interpret(
        commandResult,
        mockTurnContext
      );
      expect(directive).toBe(TurnDirective.WAIT_FOR_EVENT);
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });
});
