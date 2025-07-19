import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { CommandDispatcher } from '../../../../../../src/turns/states/helpers/services/commandDispatcher.js';

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

// Note: TestableCommandDispatcher class was removed as it's not needed for the current test approach

describe('CommandDispatcher', () => {
  let mockCommandProcessor;
  let mockUnifiedErrorHandler;
  let mockLogger;
  let commandDispatcher;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCommandProcessor = {
      dispatchAction: jest.fn(),
    };

    mockUnifiedErrorHandler = {
      handleProcessingError: jest.fn(),
      logError: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
  });

  describe('Constructor', () => {
    test('should create instance with valid dependencies', () => {
      const instance = new CommandDispatcher({
        commandProcessor: mockCommandProcessor,
        unifiedErrorHandler: mockUnifiedErrorHandler,
        logger: mockLogger,
      });

      expect(instance).toBeInstanceOf(CommandDispatcher);
    });

    test('should throw error when logger is missing', () => {
      expect(() => {
        new CommandDispatcher({
          commandProcessor: mockCommandProcessor,
          unifiedErrorHandler: mockUnifiedErrorHandler,
          logger: null,
        });
      }).toThrow('Logger is required');
    });

    test('should throw error when commandProcessor is missing', () => {
      expect(() => {
        new CommandDispatcher({
          commandProcessor: null,
          unifiedErrorHandler: mockUnifiedErrorHandler,
          logger: mockLogger,
        });
      }).toThrow('commandProcessor is required');
    });

    test('should throw error when unifiedErrorHandler is missing', () => {
      expect(() => {
        new CommandDispatcher({
          commandProcessor: mockCommandProcessor,
          unifiedErrorHandler: null,
          logger: mockLogger,
        });
      }).toThrow('unifiedErrorHandler is required');
    });

    test('should throw error when commandProcessor lacks dispatchAction method', () => {
      const invalidCommandProcessor = {};

      expect(() => {
        new CommandDispatcher({
          commandProcessor: invalidCommandProcessor,
          unifiedErrorHandler: mockUnifiedErrorHandler,
          logger: mockLogger,
        });
      }).toThrow('commandProcessor must have method dispatchAction');
    });

    test('should throw error when unifiedErrorHandler lacks required methods', () => {
      const invalidErrorHandler = {
        handleProcessingError: jest.fn(),
        // missing logError method
      };

      expect(() => {
        new CommandDispatcher({
          commandProcessor: mockCommandProcessor,
          unifiedErrorHandler: invalidErrorHandler,
          logger: mockLogger,
        });
      }).toThrow('unifiedErrorHandler must have method logError');
    });
  });

  describe('dispatch()', () => {
    beforeEach(() => {
      commandDispatcher = new CommandDispatcher({
        commandProcessor: mockCommandProcessor,
        unifiedErrorHandler: mockUnifiedErrorHandler,
        logger: mockLogger,
      });
    });

    test('should successfully dispatch action and return result', async () => {
      // Arrange
      const mockTurnContext = { id: 'context1' };
      const mockActor = { id: 'actor1' };
      const mockTurnAction = {
        actionDefinitionId: 'action1',
        commandString: 'test command',
      };
      const mockCommandResult = { success: true, message: 'Action completed' };
      const stateName = 'TestState';

      mockCommandProcessor.dispatchAction.mockResolvedValue(mockCommandResult);

      // Act
      const result = await commandDispatcher.dispatch({
        turnContext: mockTurnContext,
        actor: mockActor,
        turnAction: mockTurnAction,
        stateName,
      });

      // Assert
      expect(result).toEqual({
        commandResult: mockCommandResult,
        turnContext: mockTurnContext,
      });
      expect(mockCommandProcessor.dispatchAction).toHaveBeenCalledWith(
        mockActor,
        mockTurnAction
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${stateName}: Invoking commandProcessor.dispatchAction() for actor ${mockActor.id}, actionId: ${mockTurnAction.actionDefinitionId}.`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${stateName}: Action dispatch completed for actor ${mockActor.id}. Result success: ${mockCommandResult.success}.`
      );
    });

    test('should handle commandProcessor.dispatchAction throwing error', async () => {
      // Arrange
      const mockTurnContext = { id: 'context1' };
      const mockActor = { id: 'actor1' };
      const mockTurnAction = {
        actionDefinitionId: 'action1',
        commandString: 'test command',
      };
      const stateName = 'TestState';
      const dispatchError = new Error('Dispatch failed');

      mockCommandProcessor.dispatchAction.mockRejectedValue(dispatchError);

      // Act
      const result = await commandDispatcher.dispatch({
        turnContext: mockTurnContext,
        actor: mockActor,
        turnAction: mockTurnAction,
        stateName,
      });

      // Assert
      expect(result).toBeNull();
      expect(
        mockUnifiedErrorHandler.handleProcessingError
      ).toHaveBeenCalledWith(dispatchError, {
        actorId: mockActor.id,
        stage: 'dispatch',
        actionDef: {
          id: mockTurnAction.actionDefinitionId,
          name: mockTurnAction.commandString,
        },
        additionalContext: {
          stateName,
          commandString: mockTurnAction.commandString,
        },
      });
    });

    test('should handle command result with success false', async () => {
      // Arrange
      const mockTurnContext = { id: 'context1' };
      const mockActor = { id: 'actor1' };
      const mockTurnAction = {
        actionDefinitionId: 'action1',
        commandString: 'test command',
      };
      const mockCommandResult = { success: false, message: 'Action failed' };
      const stateName = 'TestState';

      mockCommandProcessor.dispatchAction.mockResolvedValue(mockCommandResult);

      // Act
      const result = await commandDispatcher.dispatch({
        turnContext: mockTurnContext,
        actor: mockActor,
        turnAction: mockTurnAction,
        stateName,
      });

      // Assert
      expect(result).toEqual({
        commandResult: mockCommandResult,
        turnContext: mockTurnContext,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `${stateName}: Action dispatch completed for actor ${mockActor.id}. Result success: ${mockCommandResult.success}.`
      );
    });

    test('should log debug messages with correct actor ID and action ID', async () => {
      // Arrange
      const mockTurnContext = { id: 'context1' };
      const mockActor = { id: 'test-actor-123' };
      const mockTurnAction = {
        actionDefinitionId: 'move-action',
        commandString: 'move north',
      };
      const mockCommandResult = { success: true };
      const stateName = 'ProcessingCommandState';

      mockCommandProcessor.dispatchAction.mockResolvedValue(mockCommandResult);

      // Act
      await commandDispatcher.dispatch({
        turnContext: mockTurnContext,
        actor: mockActor,
        turnAction: mockTurnAction,
        stateName,
      });

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ProcessingCommandState: Invoking commandProcessor.dispatchAction() for actor test-actor-123, actionId: move-action.'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ProcessingCommandState: Action dispatch completed for actor test-actor-123. Result success: true.'
      );
    });
  });

  describe('validateContextAfterDispatch()', () => {
    beforeEach(() => {
      commandDispatcher = new CommandDispatcher({
        commandProcessor: mockCommandProcessor,
        unifiedErrorHandler: mockUnifiedErrorHandler,
        logger: mockLogger,
      });
    });

    test('should return true for valid context with matching actor', () => {
      // Arrange
      const expectedActorId = 'actor1';
      const mockActor = { id: expectedActorId };
      const mockTurnContext = {
        getActor: jest.fn(() => mockActor),
      };
      const stateName = 'TestState';

      // Act
      const result = commandDispatcher.validateContextAfterDispatch({
        turnContext: mockTurnContext,
        expectedActorId,
        stateName,
      });

      // Assert
      expect(result).toBe(true);
      expect(mockTurnContext.getActor).toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('should return false and log warning for null turnContext', () => {
      // Arrange
      const expectedActorId = 'actor1';
      const stateName = 'TestState';

      // Act
      const result = commandDispatcher.validateContextAfterDispatch({
        turnContext: null,
        expectedActorId,
        stateName,
      });

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${stateName}: Turn context is invalid after dispatch for actor ${expectedActorId}.`
      );
    });

    test('should return false and log warning for undefined turnContext', () => {
      // Arrange
      const expectedActorId = 'actor1';
      const stateName = 'TestState';

      // Act
      const result = commandDispatcher.validateContextAfterDispatch({
        turnContext: undefined,
        expectedActorId,
        stateName,
      });

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${stateName}: Turn context is invalid after dispatch for actor ${expectedActorId}.`
      );
    });

    test('should return false and log warning for turnContext without getActor method', () => {
      // Arrange
      const expectedActorId = 'actor1';
      const mockTurnContext = {}; // Missing getActor method
      const stateName = 'TestState';

      // Act
      const result = commandDispatcher.validateContextAfterDispatch({
        turnContext: mockTurnContext,
        expectedActorId,
        stateName,
      });

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${stateName}: Turn context is invalid after dispatch for actor ${expectedActorId}.`
      );
    });

    test('should return false and log warning for turnContext with non-function getActor', () => {
      // Arrange
      const expectedActorId = 'actor1';
      const mockTurnContext = {
        getActor: 'not a function',
      };
      const stateName = 'TestState';

      // Act
      const result = commandDispatcher.validateContextAfterDispatch({
        turnContext: mockTurnContext,
        expectedActorId,
        stateName,
      });

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${stateName}: Turn context is invalid after dispatch for actor ${expectedActorId}.`
      );
    });

    test('should return false and log warning when actor ID does not match', () => {
      // Arrange
      const expectedActorId = 'actor1';
      const differentActor = { id: 'actor2' };
      const mockTurnContext = {
        getActor: jest.fn(() => differentActor),
      };
      const stateName = 'TestState';

      // Act
      const result = commandDispatcher.validateContextAfterDispatch({
        turnContext: mockTurnContext,
        expectedActorId,
        stateName,
      });

      // Assert
      expect(result).toBe(false);
      expect(mockTurnContext.getActor).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${stateName}: Context actor changed after dispatch. Expected: ${expectedActorId}, Current: ${differentActor.id}.`
      );
    });

    test('should return false and log warning when getActor returns null', () => {
      // Arrange
      const expectedActorId = 'actor1';
      const mockTurnContext = {
        getActor: jest.fn(() => null),
      };
      const stateName = 'TestState';

      // Act
      const result = commandDispatcher.validateContextAfterDispatch({
        turnContext: mockTurnContext,
        expectedActorId,
        stateName,
      });

      // Assert
      expect(result).toBe(false);
      expect(mockTurnContext.getActor).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${stateName}: Context actor changed after dispatch. Expected: ${expectedActorId}, Current: N/A.`
      );
    });

    test('should return false and log warning when getActor returns undefined', () => {
      // Arrange
      const expectedActorId = 'actor1';
      const mockTurnContext = {
        getActor: jest.fn(() => undefined),
      };
      const stateName = 'TestState';

      // Act
      const result = commandDispatcher.validateContextAfterDispatch({
        turnContext: mockTurnContext,
        expectedActorId,
        stateName,
      });

      // Assert
      expect(result).toBe(false);
      expect(mockTurnContext.getActor).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${stateName}: Context actor changed after dispatch. Expected: ${expectedActorId}, Current: N/A.`
      );
    });

    test('should handle actor object without id property', () => {
      // Arrange
      const expectedActorId = 'actor1';
      const actorWithoutId = { name: 'Test Actor' }; // Missing id property
      const mockTurnContext = {
        getActor: jest.fn(() => actorWithoutId),
      };
      const stateName = 'TestState';

      // Act
      const result = commandDispatcher.validateContextAfterDispatch({
        turnContext: mockTurnContext,
        expectedActorId,
        stateName,
      });

      // Assert
      expect(result).toBe(false);
      expect(mockTurnContext.getActor).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${stateName}: Context actor changed after dispatch. Expected: ${expectedActorId}, Current: N/A.`
      );
    });

    test('should log correct state names in warning messages', () => {
      // Arrange
      const expectedActorId = 'actor1';
      const stateName = 'ProcessingCommandState';

      // Act
      commandDispatcher.validateContextAfterDispatch({
        turnContext: null,
        expectedActorId,
        stateName,
      });

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ProcessingCommandState: Turn context is invalid after dispatch for actor actor1.'
      );
    });
  });

  describe('Integration scenarios', () => {
    beforeEach(() => {
      commandDispatcher = new CommandDispatcher({
        commandProcessor: mockCommandProcessor,
        unifiedErrorHandler: mockUnifiedErrorHandler,
        logger: mockLogger,
      });
    });

    test('should handle complete workflow with successful dispatch and validation', async () => {
      // Arrange
      const mockTurnContext = {
        id: 'context1',
        getActor: jest.fn(() => ({ id: 'actor1' })),
      };
      const mockActor = { id: 'actor1' };
      const mockTurnAction = {
        actionDefinitionId: 'action1',
        commandString: 'test command',
      };
      const mockCommandResult = { success: true };
      const stateName = 'TestState';

      mockCommandProcessor.dispatchAction.mockResolvedValue(mockCommandResult);

      // Act - Dispatch
      const dispatchResult = await commandDispatcher.dispatch({
        turnContext: mockTurnContext,
        actor: mockActor,
        turnAction: mockTurnAction,
        stateName,
      });

      // Act - Validate
      const validationResult = commandDispatcher.validateContextAfterDispatch({
        turnContext: mockTurnContext,
        expectedActorId: mockActor.id,
        stateName,
      });

      // Assert
      expect(dispatchResult).toEqual({
        commandResult: mockCommandResult,
        turnContext: mockTurnContext,
      });
      expect(validationResult).toBe(true);
      expect(mockCommandProcessor.dispatchAction).toHaveBeenCalledWith(
        mockActor,
        mockTurnAction
      );
      expect(mockTurnContext.getActor).toHaveBeenCalled();
    });

    test('should handle workflow with dispatch failure and validation', async () => {
      // Arrange
      const mockTurnContext = {
        id: 'context1',
        getActor: jest.fn(() => ({ id: 'actor1' })),
      };
      const mockActor = { id: 'actor1' };
      const mockTurnAction = {
        actionDefinitionId: 'action1',
        commandString: 'test command',
      };
      const stateName = 'TestState';
      const dispatchError = new Error('Dispatch failed');

      mockCommandProcessor.dispatchAction.mockRejectedValue(dispatchError);

      // Act - Dispatch
      const dispatchResult = await commandDispatcher.dispatch({
        turnContext: mockTurnContext,
        actor: mockActor,
        turnAction: mockTurnAction,
        stateName,
      });

      // Act - Validate (context should still be valid despite dispatch failure)
      const validationResult = commandDispatcher.validateContextAfterDispatch({
        turnContext: mockTurnContext,
        expectedActorId: mockActor.id,
        stateName,
      });

      // Assert
      expect(dispatchResult).toBeNull();
      expect(validationResult).toBe(true);
      expect(
        mockUnifiedErrorHandler.handleProcessingError
      ).toHaveBeenCalledWith(dispatchError, expect.any(Object));
    });
  });
});
