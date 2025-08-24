import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import UnlockMovementHandler from '../../../../src/logic/operationHandlers/unlockMovementHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';
import * as movementUtils from '../../../../src/utils/movementUtils.js';

// Mock the movementUtils module
jest.mock('../../../../src/utils/movementUtils.js', () => ({
  updateMovementLock: jest.fn(),
}));

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeEntityManager = () => ({
  getComponentData: jest.fn(),
  addComponent: jest.fn(),
});

const makeEventDispatcher = () => ({
  dispatch: jest.fn(),
});

describe('UnlockMovementHandler', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockSafeEventDispatcher;
  let executionContext;

  beforeEach(() => {
    // Create fresh mocks
    mockLogger = makeLogger();
    mockEntityManager = makeEntityManager();
    mockSafeEventDispatcher = makeEventDispatcher();

    // Create handler instance
    handler = new UnlockMovementHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockSafeEventDispatcher,
    });

    // Setup execution context
    executionContext = {
      logger: mockLogger,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('UnlockMovementHandler setup', () => {
    test('should create instance with valid dependencies', () => {
      expect(handler).toBeInstanceOf(UnlockMovementHandler);
    });

    test('should have execute method', () => {
      expect(typeof handler.execute).toBe('function');
    });
  });

  describe('execute - success cases', () => {
    test('should successfully unlock movement for valid actor_id', async () => {
      const params = { actor_id: 'test-actor-123' };
      movementUtils.updateMovementLock.mockResolvedValue();

      await handler.execute(params, executionContext);

      expect(movementUtils.updateMovementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'test-actor-123',
        false // Note: false for unlocking
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[UnlockMovementHandler] Successfully unlocked movement for entity: test-actor-123'
      );
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('should handle different actor_id formats', async () => {
      const params = { actor_id: 'core:actor:player' };
      movementUtils.updateMovementLock.mockResolvedValue();

      await handler.execute(params, executionContext);

      expect(movementUtils.updateMovementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'core:actor:player',
        false
      );
    });

    test('should trim whitespace from actor_id', async () => {
      const params = { actor_id: '  test-actor  ' };
      movementUtils.updateMovementLock.mockResolvedValue();

      await handler.execute(params, executionContext);

      expect(movementUtils.updateMovementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'test-actor',
        false
      );
    });
  });

  describe('execute - error cases', () => {
    test('should dispatch error when actor_id is missing', async () => {
      const params = {};

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_MOVEMENT: invalid "actor_id"',
          details: { params: {} },
        }
      );
      expect(movementUtils.updateMovementLock).not.toHaveBeenCalled();
    });

    test('should dispatch error when actor_id is null', async () => {
      const params = { actor_id: null };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_MOVEMENT: invalid "actor_id"',
          details: { params: { actor_id: null } },
        }
      );
      expect(movementUtils.updateMovementLock).not.toHaveBeenCalled();
    });

    test('should dispatch error when actor_id is empty string', async () => {
      const params = { actor_id: '' };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_MOVEMENT: invalid "actor_id"',
          details: { params: { actor_id: '' } },
        }
      );
      expect(movementUtils.updateMovementLock).not.toHaveBeenCalled();
    });

    test('should dispatch error when actor_id is whitespace only', async () => {
      const params = { actor_id: '   ' };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_MOVEMENT: invalid "actor_id"',
          details: { params: { actor_id: '   ' } },
        }
      );
      expect(movementUtils.updateMovementLock).not.toHaveBeenCalled();
    });

    test('should dispatch error when actor_id is not a string', async () => {
      const params = { actor_id: 123 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_MOVEMENT: invalid "actor_id"',
          details: { params: { actor_id: 123 } },
        }
      );
      expect(movementUtils.updateMovementLock).not.toHaveBeenCalled();
    });

    test('should handle and dispatch error when updateMovementLock throws', async () => {
      const params = { actor_id: 'test-actor' };
      const testError = new Error('Failed to update movement lock');
      movementUtils.updateMovementLock.mockRejectedValue(testError);

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message:
            'UNLOCK_MOVEMENT: failed to unlock movement for entity test-actor',
          details: {
            actor_id: 'test-actor',
            error: 'Failed to update movement lock',
            stack: testError.stack,
          },
        }
      );
    });

    test('should handle when params is null', async () => {
      await handler.execute(null, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_MOVEMENT: invalid "actor_id"',
          details: { params: null },
        }
      );
      expect(movementUtils.updateMovementLock).not.toHaveBeenCalled();
    });

    test('should handle when params is undefined', async () => {
      await handler.execute(undefined, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_MOVEMENT: invalid "actor_id"',
          details: { params: undefined },
        }
      );
      expect(movementUtils.updateMovementLock).not.toHaveBeenCalled();
    });
  });

  describe('logger integration', () => {
    test('should use logger from execution context when available', async () => {
      const contextLogger = makeLogger();
      const customContext = { logger: contextLogger };
      const params = { actor_id: 'test-actor' };
      movementUtils.updateMovementLock.mockResolvedValue();

      await handler.execute(params, customContext);

      expect(contextLogger.debug).toHaveBeenCalledWith(
        '[UnlockMovementHandler] Successfully unlocked movement for entity: test-actor'
      );
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test('should handle execution context without logger', async () => {
      const params = { actor_id: 'test-actor' };
      movementUtils.updateMovementLock.mockResolvedValue();

      await handler.execute(params, {});

      // Should not throw error and still execute successfully
      expect(movementUtils.updateMovementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'test-actor',
        false
      );
    });

    test('should fall back to instance logger when execution context has no logger', async () => {
      const params = { actor_id: 'test-actor' };
      movementUtils.updateMovementLock.mockResolvedValue();

      await handler.execute(params, {});

      expect(movementUtils.updateMovementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'test-actor',
        false
      );
      // Should still log success with instance logger (includes handler name prefix)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'UnlockMovementHandler: [UnlockMovementHandler] Successfully unlocked movement for entity: test-actor'
      );
    });

    test('should handle undefined execution context', async () => {
      const params = { actor_id: 'test-actor' };
      movementUtils.updateMovementLock.mockResolvedValue();

      await handler.execute(params, undefined);

      expect(movementUtils.updateMovementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'test-actor',
        false
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'UnlockMovementHandler: [UnlockMovementHandler] Successfully unlocked movement for entity: test-actor'
      );
    });
  });

  describe('error handling edge cases', () => {
    test('should handle updateMovementLock throwing non-Error objects', async () => {
      const params = { actor_id: 'test-actor' };
      movementUtils.updateMovementLock.mockRejectedValue('string error');

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message:
            'UNLOCK_MOVEMENT: failed to unlock movement for entity test-actor',
          details: {
            actor_id: 'test-actor',
            error: undefined, // Non-Error objects don't have message property
            stack: undefined,
          },
        }
      );
    });

    test('should handle errors without message property', async () => {
      const params = { actor_id: 'test-actor' };
      const errorWithoutMessage = { code: 'WEIRD_ERROR' };
      movementUtils.updateMovementLock.mockRejectedValue(errorWithoutMessage);

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message:
            'UNLOCK_MOVEMENT: failed to unlock movement for entity test-actor',
          details: {
            actor_id: 'test-actor',
            error: undefined,
            stack: undefined,
          },
        }
      );
    });
  });
});
