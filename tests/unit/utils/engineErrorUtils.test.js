import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  dispatchFailureAndReset,
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
  });
});
