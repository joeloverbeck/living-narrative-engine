import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  dispatchFailureAndReset,
  getReadableErrorMessage,
  processOperationFailure,
} from '../../../src/utils/engineErrorUtils.js';
import { ENGINE_OPERATION_FAILED_UI } from '../../../src/constants/eventIds.js';

describe('engineErrorUtils', () => {
  let mockLogger;
  let mockDispatcher;
  let mockResetEngineState;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    mockResetEngineState = jest.fn();
  });

  describe('getReadableErrorMessage', () => {
    it('returns stringified primitives for numbers and booleans', () => {
      expect(getReadableErrorMessage(42)).toBe('42');
      expect(getReadableErrorMessage(false)).toBe('false');
    });

    it('uses custom object string representations when available', () => {
      const fancyError = {
        toString() {
          return 'Fancy failure!';
        },
      };

      expect(getReadableErrorMessage(fancyError)).toBe('Fancy failure!');
    });
  });

  describe('dispatchFailureAndReset', () => {
    it('should dispatch failure event and reset engine state when dispatcher is available', async () => {
      // Arrange
      const errorMessage = 'Test error message';
      const title = 'Test Error Title';

      // Act
      await dispatchFailureAndReset(
        mockDispatcher,
        errorMessage,
        title,
        mockResetEngineState,
        mockLogger
      );

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'engineErrorUtils.dispatchFailureAndReset: Dispatching UI event for operation failed.'
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage,
          errorTitle: title,
        }
      );
      expect(mockResetEngineState).toHaveBeenCalled();
    });

    it('should warn when dispatcher reports failure dispatching failure UI event', async () => {
      const errorMessage = 'Test error message';
      const title = 'Test Error Title';
      mockDispatcher.dispatch.mockResolvedValueOnce(false);

      await dispatchFailureAndReset(
        mockDispatcher,
        errorMessage,
        title,
        mockResetEngineState,
        mockLogger
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'engineErrorUtils.dispatchFailureAndReset: SafeEventDispatcher reported failure when dispatching ENGINE_OPERATION_FAILED_UI.'
      );
      expect(mockResetEngineState).toHaveBeenCalled();
    });

    it('should log error and reset state when dispatcher is null', async () => {
      // Arrange
      const errorMessage = 'Test error message';
      const title = 'Test Error Title';

      // Act
      await dispatchFailureAndReset(
        null,
        errorMessage,
        title,
        mockResetEngineState,
        mockLogger
      );

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'engineErrorUtils.dispatchFailureAndReset: Dispatching UI event for operation failed.'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'engineErrorUtils.dispatchFailureAndReset: ISafeEventDispatcher not available, cannot dispatch UI failure event.'
      );
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockResetEngineState).toHaveBeenCalled();
    });

    it('should log error and reset state when dispatcher is undefined', async () => {
      // Arrange
      const errorMessage = 'Test error message';
      const title = 'Test Error Title';

      // Act
      await dispatchFailureAndReset(
        undefined,
        errorMessage,
        title,
        mockResetEngineState,
        mockLogger
      );

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'engineErrorUtils.dispatchFailureAndReset: Dispatching UI event for operation failed.'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'engineErrorUtils.dispatchFailureAndReset: ISafeEventDispatcher not available, cannot dispatch UI failure event.'
      );
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockResetEngineState).toHaveBeenCalled();
    });

    it('should log and still reset when dispatcher throws', async () => {
      const errorMessage = 'Test error message';
      const title = 'Test Error Title';
      const dispatchError = new Error('Dispatch failed');
      mockDispatcher.dispatch.mockRejectedValueOnce(dispatchError);

      await dispatchFailureAndReset(
        mockDispatcher,
        errorMessage,
        title,
        mockResetEngineState,
        mockLogger
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'engineErrorUtils.dispatchFailureAndReset: Failed to dispatch UI failure event.',
        dispatchError
      );
      expect(mockResetEngineState).toHaveBeenCalledTimes(1);
    });

    it('should log when resetEngineState throws after dispatch', async () => {
      const errorMessage = 'Another error';
      const title = 'Another title';
      const resetError = new Error('Reset failed');
      mockResetEngineState.mockImplementationOnce(() => {
        throw resetError;
      });

      await expect(
        dispatchFailureAndReset(
          mockDispatcher,
          errorMessage,
          title,
          mockResetEngineState,
          mockLogger
        )
      ).rejects.toBe(resetError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'engineErrorUtils.dispatchFailureAndReset: Failed to reset engine state after failure.',
        resetError
      );
    });
  });

  describe('processOperationFailure', () => {
    it('should handle Error object and return void when returnResult is false', async () => {
      // Arrange
      const contextMessage = 'testOperation';
      const error = new Error('Test error');
      const title = 'Operation Failed';
      const userPrefix = 'Unable to complete operation';

      // Act
      const result = await processOperationFailure(
        mockLogger,
        mockDispatcher,
        contextMessage,
        error,
        title,
        userPrefix,
        mockResetEngineState,
        false
      );

      // Assert
      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `GameEngine.${contextMessage}: ${error.message}`,
        error
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: `${userPrefix}: ${error.message}`,
          errorTitle: title,
        }
      );
      expect(mockResetEngineState).toHaveBeenCalled();
    });

    it('should handle Error object and return result when returnResult is true', async () => {
      // Arrange
      const contextMessage = 'testOperation';
      const error = new Error('Test error');
      const title = 'Operation Failed';
      const userPrefix = 'Unable to complete operation';

      // Act
      const result = await processOperationFailure(
        mockLogger,
        mockDispatcher,
        contextMessage,
        error,
        title,
        userPrefix,
        mockResetEngineState,
        true
      );

      // Assert
      expect(result).toEqual({
        success: false,
        error: error.message,
        data: null,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        `GameEngine.${contextMessage}: ${error.message}`,
        error
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: `${userPrefix}: ${error.message}`,
          errorTitle: title,
        }
      );
      expect(mockResetEngineState).toHaveBeenCalled();
    });

    it('should handle string error and return void by default', async () => {
      // Arrange
      const contextMessage = 'testOperation';
      const error = 'String error message';
      const title = 'Operation Failed';
      const userPrefix = 'Unable to complete operation';

      // Act
      const result = await processOperationFailure(
        mockLogger,
        mockDispatcher,
        contextMessage,
        error,
        title,
        userPrefix,
        mockResetEngineState
      );

      // Assert
      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `GameEngine.${contextMessage}: ${error}`,
        expect.any(Error)
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: `${userPrefix}: ${error}`,
          errorTitle: title,
        }
      );
      expect(mockResetEngineState).toHaveBeenCalled();
    });

    it('should serialize object errors into readable messages', async () => {
      // Arrange
      const contextMessage = 'testOperation';
      const error = { someProperty: 'value' };
      const title = 'Operation Failed';
      const userPrefix = 'Unable to complete operation';

      // Act
      const result = await processOperationFailure(
        mockLogger,
        mockDispatcher,
        contextMessage,
        error,
        title,
        userPrefix,
        mockResetEngineState,
        true
      );

      // Assert
      const expectedErrorMessage = JSON.stringify(error);
      expect(result).toEqual({
        success: false,
        error: expectedErrorMessage,
        data: null,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        `GameEngine.${contextMessage}: ${expectedErrorMessage}`,
        expect.objectContaining({ message: expectedErrorMessage })
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: `${userPrefix}: ${expectedErrorMessage}`,
          errorTitle: title,
        }
      );
      expect(mockResetEngineState).toHaveBeenCalled();
    });

    it('should extract message from error-like objects', async () => {
      const contextMessage = 'loadOperation';
      const error = { message: 'Detailed failure occurred', code: 'E_FAIL' };
      const title = 'Operation Failed';
      const userPrefix = 'Unable to load game';

      const result = await processOperationFailure(
        mockLogger,
        mockDispatcher,
        contextMessage,
        error,
        title,
        userPrefix,
        mockResetEngineState,
        true
      );

      expect(result).toEqual({
        success: false,
        error: 'Detailed failure occurred',
        data: null,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        `GameEngine.${contextMessage}: Detailed failure occurred`,
        expect.objectContaining({ message: 'Detailed failure occurred' })
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: 'Unable to load game: Detailed failure occurred',
          errorTitle: title,
        }
      );
      expect(mockResetEngineState).toHaveBeenCalled();
    });

    it('should propagate reset errors so callers can react to cleanup failures', async () => {
      const contextMessage = 'criticalOperation';
      const operationError = new Error('operation failed');
      const resetError = new Error('reset exploded');

      mockResetEngineState.mockImplementationOnce(() => {
        throw resetError;
      });

      await expect(
        processOperationFailure(
          mockLogger,
          mockDispatcher,
          contextMessage,
          operationError,
          'Critical Failure',
          'Unable to continue',
          mockResetEngineState
        )
      ).rejects.toBe(resetError);

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_FAILED_UI,
        {
          errorMessage: 'Unable to continue: operation failed',
          errorTitle: 'Critical Failure',
        }
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'engineErrorUtils.dispatchFailureAndReset: Failed to reset engine state after failure.',
        resetError
      );
    });

    it('should handle null dispatcher gracefully', async () => {
      // Arrange
      const contextMessage = 'testOperation';
      const error = new Error('Test error');
      const title = 'Operation Failed';
      const userPrefix = 'Unable to complete operation';

      // Act
      const result = await processOperationFailure(
        mockLogger,
        null,
        contextMessage,
        error,
        title,
        userPrefix,
        mockResetEngineState,
        true
      );

      // Assert
      expect(result).toEqual({
        success: false,
        error: error.message,
        data: null,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        `GameEngine.${contextMessage}: ${error.message}`,
        error
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'engineErrorUtils.dispatchFailureAndReset: ISafeEventDispatcher not available, cannot dispatch UI failure event.'
      );
      expect(mockResetEngineState).toHaveBeenCalled();
    });

    it('attaches original error metadata when assigning cause fails', async () => {
      const contextMessage = 'metadataOperation';
      const rawError = { problem: 'disallowed' };
      const title = 'Operation Failed';
      const userPrefix = 'Unable to complete operation';
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        Error.prototype,
        'cause'
      );

      Object.defineProperty(Error.prototype, 'cause', {
        configurable: true,
        set() {
          throw new Error('setter blocked');
        },
      });

      try {
        await processOperationFailure(
          mockLogger,
          mockDispatcher,
          contextMessage,
          rawError,
          title,
          userPrefix,
          mockResetEngineState,
          true
        );

        const [, loggedError] = mockLogger.error.mock.calls[0];
        expect(loggedError.originalError).toBe(rawError);
      } finally {
        if (originalDescriptor) {
          Object.defineProperty(Error.prototype, 'cause', originalDescriptor);
        } else {
          delete Error.prototype.cause;
        }
      }
    });
  });
});
