/**
 * @file resultInterpreter.test.js
 * @description Unit tests for ResultInterpreter service.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ResultInterpreter } from '../../../../../../src/turns/states/helpers/services/resultInterpreter.js';

// Mock the BaseService to avoid its dependencies
jest.mock('../../../../../../src/utils/serviceBase.js', () => ({
  BaseService: class MockBaseService {
    _init(serviceName, logger, deps) {
      // Mock the _init method to validate dependencies and return logger
      if (!logger) {
        throw new Error('Logger is required');
      }

      // Validate dependencies if provided
      if (deps) {
        Object.entries(deps).forEach(([key, spec]) => {
          if (!spec.value) {
            throw new Error(`${key} is required`);
          }
          if (spec.requiredMethods) {
            spec.requiredMethods.forEach((method) => {
              if (typeof spec.value[method] !== 'function') {
                throw new Error(`${key} must have method ${method}`);
              }
            });
          }
        });
      }

      return logger;
    }
  },
}));

describe('ResultInterpreter', () => {
  let resultInterpreter;
  let mockCommandOutcomeInterpreter;
  let mockUnifiedErrorHandler;
  let mockLogger;
  let mockTurnContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock command outcome interpreter
    mockCommandOutcomeInterpreter = {
      interpret: jest.fn(),
    };

    // Mock unified error handler
    mockUnifiedErrorHandler = {
      handleProcessingError: jest.fn(),
      logError: jest.fn(),
    };

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    // Mock turn context
    mockTurnContext = {
      getActor: jest.fn(() => ({ id: 'test-actor-id' })),
    };

    // Create service instance
    resultInterpreter = new ResultInterpreter({
      commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
      unifiedErrorHandler: mockUnifiedErrorHandler,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(resultInterpreter).toBeInstanceOf(ResultInterpreter);
    });

    it('should require logger', () => {
      expect(() => {
        new ResultInterpreter({
          commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
          unifiedErrorHandler: mockUnifiedErrorHandler,
          logger: null,
        });
      }).toThrow('Logger is required');
    });

    it('should require commandOutcomeInterpreter', () => {
      expect(() => {
        new ResultInterpreter({
          commandOutcomeInterpreter: null,
          unifiedErrorHandler: mockUnifiedErrorHandler,
          logger: mockLogger,
        });
      }).toThrow('commandOutcomeInterpreter is required');
    });

    it('should require unifiedErrorHandler', () => {
      expect(() => {
        new ResultInterpreter({
          commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
          unifiedErrorHandler: null,
          logger: mockLogger,
        });
      }).toThrow('unifiedErrorHandler is required');
    });

    it('should validate commandOutcomeInterpreter has interpret method', () => {
      const invalidInterpreter = {};

      expect(() => {
        new ResultInterpreter({
          commandOutcomeInterpreter: invalidInterpreter,
          unifiedErrorHandler: mockUnifiedErrorHandler,
          logger: mockLogger,
        });
      }).toThrow('commandOutcomeInterpreter must have method interpret');
    });

    it('should validate unifiedErrorHandler has required methods', () => {
      const invalidErrorHandler = {
        handleProcessingError: jest.fn(),
        // missing logError method
      };

      expect(() => {
        new ResultInterpreter({
          commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
          unifiedErrorHandler: invalidErrorHandler,
          logger: mockLogger,
        });
      }).toThrow('unifiedErrorHandler must have method logError');
    });
  });

  describe('interpret', () => {
    const stateName = 'TestState';
    const actorId = 'test-actor-id';
    const mockCommandResult = { success: true, data: 'test result' };

    it('should successfully interpret command result and return directive type', async () => {
      const expectedDirective = 'END_TURN_SUCCESS';
      mockCommandOutcomeInterpreter.interpret.mockResolvedValue(
        expectedDirective
      );

      const result = await resultInterpreter.interpret({
        commandResult: mockCommandResult,
        turnContext: mockTurnContext,
        actorId,
        stateName,
      });

      expect(mockCommandOutcomeInterpreter.interpret).toHaveBeenCalledWith(
        mockCommandResult,
        mockTurnContext
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${stateName}: Actor ${actorId} - Dispatch result interpreted to directive: ${expectedDirective}`
      );
      expect(result).toEqual({ directiveType: expectedDirective });
    });

    it('should handle interpretation errors and return null', async () => {
      const interpretationError = new Error('Interpretation failed');
      mockCommandOutcomeInterpreter.interpret.mockRejectedValue(
        interpretationError
      );

      const result = await resultInterpreter.interpret({
        commandResult: mockCommandResult,
        turnContext: mockTurnContext,
        actorId,
        stateName,
      });

      expect(
        mockUnifiedErrorHandler.handleProcessingError
      ).toHaveBeenCalledWith(
        interpretationError,
        expect.objectContaining({
          actorId,
          stage: 'interpretation',
          additionalContext: expect.objectContaining({
            stateName,
            commandSuccess: mockCommandResult.success,
            commandError: mockCommandResult.error,
          }),
        })
      );
      expect(result).toBeNull();
    });

    it('should handle null directive type returned by interpreter', async () => {
      mockCommandOutcomeInterpreter.interpret.mockResolvedValue(null);

      const result = await resultInterpreter.interpret({
        commandResult: mockCommandResult,
        turnContext: mockTurnContext,
        actorId,
        stateName,
      });

      expect(
        mockUnifiedErrorHandler.handleProcessingError
      ).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          actorId,
          stage: 'interpretation',
        })
      );
      expect(result).toBeNull();
    });

    it('should handle undefined directive type returned by interpreter', async () => {
      mockCommandOutcomeInterpreter.interpret.mockResolvedValue(undefined);

      const result = await resultInterpreter.interpret({
        commandResult: mockCommandResult,
        turnContext: mockTurnContext,
        actorId,
        stateName,
      });

      expect(
        mockUnifiedErrorHandler.handleProcessingError
      ).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          actorId,
          stage: 'interpretation',
        })
      );
      expect(result).toBeNull();
    });

    it('should handle non-string directive type returned by interpreter', async () => {
      mockCommandOutcomeInterpreter.interpret.mockResolvedValue(123);

      const result = await resultInterpreter.interpret({
        commandResult: mockCommandResult,
        turnContext: mockTurnContext,
        actorId,
        stateName,
      });

      expect(
        mockUnifiedErrorHandler.handleProcessingError
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid directive type returned: 123',
        }),
        expect.objectContaining({
          actorId,
          stage: 'interpretation',
        })
      );
      expect(result).toBeNull();
    });

    it('should handle empty string directive type', async () => {
      mockCommandOutcomeInterpreter.interpret.mockResolvedValue('');

      const result = await resultInterpreter.interpret({
        commandResult: mockCommandResult,
        turnContext: mockTurnContext,
        actorId,
        stateName,
      });

      expect(
        mockUnifiedErrorHandler.handleProcessingError
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid directive type returned: ',
        }),
        expect.objectContaining({
          actorId,
          stage: 'interpretation',
        })
      );
      expect(result).toBeNull();
    });

    it('should handle command result with success false', async () => {
      const failedCommandResult = { success: false, error: 'Command failed' };
      const expectedDirective = 'END_TURN_FAILURE';
      mockCommandOutcomeInterpreter.interpret.mockResolvedValue(
        expectedDirective
      );

      const result = await resultInterpreter.interpret({
        commandResult: failedCommandResult,
        turnContext: mockTurnContext,
        actorId,
        stateName,
      });

      expect(result).toEqual({ directiveType: expectedDirective });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(expectedDirective)
      );
    });

    it('should include command error in error context when interpretation fails', async () => {
      const commandResultWithError = {
        success: false,
        error: 'Command execution error',
      };
      const interpretationError = new Error('Interpretation failed');
      mockCommandOutcomeInterpreter.interpret.mockRejectedValue(
        interpretationError
      );

      const result = await resultInterpreter.interpret({
        commandResult: commandResultWithError,
        turnContext: mockTurnContext,
        actorId,
        stateName,
      });

      expect(
        mockUnifiedErrorHandler.handleProcessingError
      ).toHaveBeenCalledWith(
        interpretationError,
        expect.objectContaining({
          additionalContext: expect.objectContaining({
            commandSuccess: false,
            commandError: 'Command execution error',
          }),
        })
      );
      expect(result).toBeNull();
    });

    it('should log with correct actor ID and state name', async () => {
      const customActorId = 'custom-actor-123';
      const customStateName = 'ProcessingCommandState';
      const expectedDirective = 'RE_PROMPT';
      mockCommandOutcomeInterpreter.interpret.mockResolvedValue(
        expectedDirective
      );

      await resultInterpreter.interpret({
        commandResult: mockCommandResult,
        turnContext: mockTurnContext,
        actorId: customActorId,
        stateName: customStateName,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${customStateName}: Actor ${customActorId} - Dispatch result interpreted to directive: ${expectedDirective}`
      );
    });
  });

  describe('validateCommandResult', () => {
    it('should return true for valid command result with success true', () => {
      const validResult = { success: true, data: 'test' };

      const result = resultInterpreter.validateCommandResult(validResult);

      expect(result).toBe(true);
    });

    it('should return true for valid command result with success false', () => {
      const validResult = { success: false, error: 'test error' };

      const result = resultInterpreter.validateCommandResult(validResult);

      expect(result).toBe(true);
    });

    it('should return false for null command result', () => {
      const result = resultInterpreter.validateCommandResult(null);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid command result: not an object',
        { commandResult: null }
      );
    });

    it('should return false for undefined command result', () => {
      const result = resultInterpreter.validateCommandResult(undefined);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid command result: not an object',
        { commandResult: undefined }
      );
    });

    it('should return false for non-object command result', () => {
      const result = resultInterpreter.validateCommandResult('not an object');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid command result: not an object',
        { commandResult: 'not an object' }
      );
    });

    it('should return false for command result missing success property', () => {
      const invalidResult = { data: 'test' };

      const result = resultInterpreter.validateCommandResult(invalidResult);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid command result: missing success property',
        { commandResult: invalidResult }
      );
    });

    it('should return false for command result with non-boolean success property', () => {
      const invalidResult = { success: 'true' };

      const result = resultInterpreter.validateCommandResult(invalidResult);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid command result: missing success property',
        { commandResult: invalidResult }
      );
    });

    it('should return true for command result with additional properties', () => {
      const validResult = {
        success: true,
        data: 'test',
        metadata: { timestamp: Date.now() },
      };

      const result = resultInterpreter.validateCommandResult(validResult);

      expect(result).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow with validation and interpretation', async () => {
      const commandResult = { success: true, data: 'test result' };
      const expectedDirective = 'END_TURN_SUCCESS';

      // Validate command result first
      const isValid = resultInterpreter.validateCommandResult(commandResult);
      expect(isValid).toBe(true);

      // Interpret result
      mockCommandOutcomeInterpreter.interpret.mockResolvedValue(
        expectedDirective
      );
      const result = await resultInterpreter.interpret({
        commandResult,
        turnContext: mockTurnContext,
        actorId: 'test-actor',
        stateName: 'TestState',
      });

      expect(result).toEqual({ directiveType: expectedDirective });
    });

    it('should handle workflow with invalid command result', async () => {
      const invalidCommandResult = { invalid: 'missing success property' };

      // Validate command result first
      const isValid =
        resultInterpreter.validateCommandResult(invalidCommandResult);
      expect(isValid).toBe(false);

      // Still attempt interpretation to test robustness (will fail due to invalid commandResult)
      mockCommandOutcomeInterpreter.interpret.mockRejectedValue(
        new Error('Cannot interpret invalid result')
      );
      const result = await resultInterpreter.interpret({
        commandResult: invalidCommandResult,
        turnContext: mockTurnContext,
        actorId: 'test-actor',
        stateName: 'TestState',
      });

      // Should handle gracefully and return null
      expect(result).toBeNull();
    });

    it('should handle workflow with failed command result and interpretation error', async () => {
      const failedCommandResult = { success: false, error: 'Command failed' };
      const interpretationError = new Error(
        'Could not interpret failed result'
      );

      // Validate command result
      const isValid =
        resultInterpreter.validateCommandResult(failedCommandResult);
      expect(isValid).toBe(true);

      // Attempt interpretation that fails
      mockCommandOutcomeInterpreter.interpret.mockRejectedValue(
        interpretationError
      );
      const result = await resultInterpreter.interpret({
        commandResult: failedCommandResult,
        turnContext: mockTurnContext,
        actorId: 'test-actor',
        stateName: 'TestState',
      });

      expect(result).toBeNull();
      expect(
        mockUnifiedErrorHandler.handleProcessingError
      ).toHaveBeenCalledWith(
        interpretationError,
        expect.objectContaining({
          additionalContext: expect.objectContaining({
            commandSuccess: false,
            commandError: 'Command failed',
          }),
        })
      );
    });
  });
});
