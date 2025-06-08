// src/tests/interpreters/commandOutcomeInterpreter.fixes.test.js

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

// New mock for TurnContext
let mockTurnContext;
let mockActor; // To store the mock actor object

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
