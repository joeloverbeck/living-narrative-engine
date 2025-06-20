// src/tests/turns/strategies/endTurnFailureStrategy.test.js

import EndTurnFailureStrategy from '../../../../src/turns/strategies/endTurnFailureStrategy.js'; // Adjust path as needed
import TurnDirective from '../../../../src/turns/constants/turnDirectives.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals'; // Adjust path as needed
// Mock ITurnContext, ILogger, and Entity for testing
// We'll create simple mocks directly in the tests.

describe('EndTurnFailureStrategy', () => {
  let mockTurnContext;
  let mockLogger;
  let strategy;
  let mockActor;

  beforeEach(() => {
    // Reset mocks for each test
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockActor = {
      id: 'player1',
      // Add other actor properties if needed by the strategy indirectly
    };

    mockTurnContext = {
      getLogger: jest.fn().mockReturnValue(mockLogger),
      getActor: jest.fn().mockReturnValue(mockActor),
      endTurn: jest.fn(),
      // Add other ITurnContext methods if the strategy starts using them
    };

    strategy = new EndTurnFailureStrategy();
  });

  describe('execute', () => {
    it('should throw an error if the directive is not END_TURN_FAILURE', async () => {
      const directive = TurnDirective.END_TURN_SUCCESS; // Incorrect directive
      const cmdProcResult = { success: false, error: null };

      await expect(
        strategy.execute(mockTurnContext, directive, cmdProcResult)
      ).rejects.toThrow(
        'EndTurnFailureStrategy: Wrong directive (END_TURN_SUCCESS). Expected END_TURN_FAILURE.'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'EndTurnFailureStrategy: Wrong directive (END_TURN_SUCCESS). Expected END_TURN_FAILURE.'
      );
      expect(mockTurnContext.endTurn).not.toHaveBeenCalled();
    });

    it('should call turnContext.endTurn with an error if contextActor is null', async () => {
      mockTurnContext.getActor.mockReturnValue(null); // Simulate no actor in context
      const directive = TurnDirective.END_TURN_FAILURE;
      const cmdProcResult = { success: false, error: 'Some minor issue.' };
      const expectedErrorMsg =
        'EndTurnFailureStrategy: No actor found in ITurnContext for END_TURN_FAILURE. Critical issue.';

      await strategy.execute(mockTurnContext, directive, cmdProcResult);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expectedErrorMsg +
          ' Ending turn with a generic error indicating missing actor.'
      );
      expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
      expect(mockTurnContext.endTurn.mock.calls[0][0].message).toBe(
        expectedErrorMsg
      );
    });

    it('should use cmdProcResult.error if it is an Error instance', async () => {
      const directive = TurnDirective.END_TURN_FAILURE;
      const specificError = new Error(
        'Command processing failed specifically!'
      );
      const cmdProcResult = { success: false, error: specificError };

      await strategy.execute(mockTurnContext, directive, cmdProcResult);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `EndTurnFailureStrategy: Executing END_TURN_FAILURE for actor ${mockActor.id}. Error: ${specificError.message}`
      );
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(specificError);
    });

    it('should wrap cmdProcResult.error in a new Error if it is a string', async () => {
      const directive = TurnDirective.END_TURN_FAILURE;
      const errorString = 'A simple error message from command processor.';
      const cmdProcResult = { success: false, error: errorString };

      await strategy.execute(mockTurnContext, directive, cmdProcResult);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `EndTurnFailureStrategy: Executing END_TURN_FAILURE for actor ${mockActor.id}. Error: ${errorString}`
      );
      expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
      expect(mockTurnContext.endTurn.mock.calls[0][0].message).toBe(
        errorString
      );
    });

    it('should wrap cmdProcResult.error in a new Error if it is a non-Error, non-string, non-null value', async () => {
      const directive = TurnDirective.END_TURN_FAILURE;
      const errorObject = { code: 500, detail: 'Internal server issue' };
      const cmdProcResult = { success: false, error: errorObject };
      const expectedWrappedErrorMessage = String(errorObject); // How Node's new Error(obj) stringifies it

      await strategy.execute(mockTurnContext, directive, cmdProcResult);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `EndTurnFailureStrategy: Executing END_TURN_FAILURE for actor ${mockActor.id}. Error: ${expectedWrappedErrorMessage}`
      );
      expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
      expect(mockTurnContext.endTurn.mock.calls[0][0].message).toBe(
        expectedWrappedErrorMessage
      );
    });

    it('should create a default error if cmdProcResult.error is null', async () => {
      const directive = TurnDirective.END_TURN_FAILURE;
      const cmdProcResult = { success: false, error: null }; // Explicitly null
      const expectedDefaultErrorMessage = `Turn for actor ${mockActor.id} ended by directive '${directive}' (failure).`;

      await strategy.execute(mockTurnContext, directive, cmdProcResult);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `EndTurnFailureStrategy: Executing END_TURN_FAILURE for actor ${mockActor.id}. Error: ${expectedDefaultErrorMessage}`
      );
      expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
      expect(mockTurnContext.endTurn.mock.calls[0][0].message).toBe(
        expectedDefaultErrorMessage
      );
    });

    it('should create a default error if cmdProcResult.error is undefined', async () => {
      const directive = TurnDirective.END_TURN_FAILURE;
      const cmdProcResult = { success: false }; // Error property is undefined
      const expectedDefaultErrorMessage = `Turn for actor ${mockActor.id} ended by directive '${directive}' (failure).`;

      await strategy.execute(mockTurnContext, directive, cmdProcResult);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `EndTurnFailureStrategy: Executing END_TURN_FAILURE for actor ${mockActor.id}. Error: ${expectedDefaultErrorMessage}`
      );
      expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
      expect(mockTurnContext.endTurn.mock.calls[0][0].message).toBe(
        expectedDefaultErrorMessage
      );
    });

    it('should create a default error if cmdProcResult itself is null', async () => {
      const directive = TurnDirective.END_TURN_FAILURE;
      const cmdProcResult = null; // cmdProcResult is null
      const expectedDefaultErrorMessage = `Turn for actor ${mockActor.id} ended by directive '${directive}' (failure).`;

      await strategy.execute(mockTurnContext, directive, cmdProcResult);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `EndTurnFailureStrategy: Executing END_TURN_FAILURE for actor ${mockActor.id}. Error: ${expectedDefaultErrorMessage}`
      );
      expect(mockTurnContext.endTurn).toHaveBeenCalledTimes(1);
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(expect.any(Error));
      expect(mockTurnContext.endTurn.mock.calls[0][0].message).toBe(
        expectedDefaultErrorMessage
      );
    });

    it('should log correctly and call endTurn when execution is successful', async () => {
      const directive = TurnDirective.END_TURN_FAILURE;
      const specificError = new Error('A specific failure occurred.');
      const cmdProcResult = { success: false, error: specificError };

      await strategy.execute(mockTurnContext, directive, cmdProcResult);

      expect(mockTurnContext.getLogger).toHaveBeenCalled();
      expect(mockTurnContext.getActor).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        `EndTurnFailureStrategy: Executing END_TURN_FAILURE for actor ${mockActor.id}. Error: ${specificError.message}`
      );
      expect(mockTurnContext.endTurn).toHaveBeenCalledWith(specificError);
    });
  });
});
