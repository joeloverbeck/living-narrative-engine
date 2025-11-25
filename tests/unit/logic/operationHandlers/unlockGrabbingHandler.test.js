import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import UnlockGrabbingHandler from '../../../../src/logic/operationHandlers/unlockGrabbingHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';
import * as grabbingUtils from '../../../../src/utils/grabbingUtils.js';

// Mock the grabbingUtils module
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  unlockGrabbingAppendages: jest.fn(),
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

describe('UnlockGrabbingHandler', () => {
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
    handler = new UnlockGrabbingHandler({
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

  describe('UnlockGrabbingHandler setup', () => {
    test('should create instance with valid dependencies', () => {
      expect(handler).toBeInstanceOf(UnlockGrabbingHandler);
    });

    test('should have execute method', () => {
      expect(typeof handler.execute).toBe('function');
    });
  });

  describe('execute - success cases', () => {
    test('should successfully unlock specified count of appendages', async () => {
      const params = { actor_id: 'test-actor-123', count: 2 };
      grabbingUtils.unlockGrabbingAppendages.mockResolvedValue({
        success: true,
        unlockedParts: ['left_hand', 'right_hand'],
      });

      await handler.execute(params, executionContext);

      expect(grabbingUtils.unlockGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'test-actor-123',
        2,
        null
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[UnlockGrabbingHandler] Successfully unlocked 2 appendage(s) for entity: test-actor-123'
      );
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('should filter by item_id when provided', async () => {
      const params = { actor_id: 'test-actor', count: 1, item_id: 'sword_1' };
      grabbingUtils.unlockGrabbingAppendages.mockResolvedValue({
        success: true,
        unlockedParts: ['right_hand'],
      });

      await handler.execute(params, executionContext);

      expect(grabbingUtils.unlockGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'test-actor',
        1,
        'sword_1'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[UnlockGrabbingHandler] Successfully unlocked 1 appendage(s) for entity: test-actor (filtered by item: sword_1)'
      );
    });

    test('should work correctly when item_id is omitted', async () => {
      const params = { actor_id: 'actor_1', count: 1 };
      grabbingUtils.unlockGrabbingAppendages.mockResolvedValue({
        success: true,
        unlockedParts: ['left_hand'],
      });

      await handler.execute(params, executionContext);

      expect(grabbingUtils.unlockGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1',
        1,
        null
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.not.stringContaining('filtered by item')
      );
    });

    test('should trim whitespace from actor_id', async () => {
      const params = { actor_id: '  test-actor  ', count: 1 };
      grabbingUtils.unlockGrabbingAppendages.mockResolvedValue({
        success: true,
        unlockedParts: ['hand'],
      });

      await handler.execute(params, executionContext);

      expect(grabbingUtils.unlockGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'test-actor',
        1,
        null
      );
    });

    test('should log partial unlock when fewer appendages unlocked than requested', async () => {
      const params = { actor_id: 'actor_1', count: 3 };
      // Only 1 appendage was locked (graceful degradation by utility)
      grabbingUtils.unlockGrabbingAppendages.mockResolvedValue({
        success: true,
        unlockedParts: ['left_hand'],
      });

      await handler.execute(params, executionContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[UnlockGrabbingHandler] Successfully unlocked 1 appendage(s) for entity: actor_1 (requested 3, only 1 were locked)'
      );
      // No error dispatch - graceful degradation
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('should handle zero unlocked parts gracefully', async () => {
      const params = { actor_id: 'actor_1', count: 1 };
      // No locked appendages available
      grabbingUtils.unlockGrabbingAppendages.mockResolvedValue({
        success: true,
        unlockedParts: [],
      });

      await handler.execute(params, executionContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[UnlockGrabbingHandler] Successfully unlocked 0 appendage(s) for entity: actor_1 (requested 1, only 0 were locked)'
      );
      // No error dispatch - graceful degradation is expected
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('execute - parameter validation', () => {
    test('should dispatch error when actor_id is missing', async () => {
      const params = { count: 1 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_GRABBING: invalid "actor_id"',
          details: { params: { count: 1 } },
        }
      );
      expect(grabbingUtils.unlockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when actor_id is null', async () => {
      const params = { actor_id: null, count: 1 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_GRABBING: invalid "actor_id"',
          details: { params: { actor_id: null, count: 1 } },
        }
      );
      expect(grabbingUtils.unlockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when actor_id is empty string', async () => {
      const params = { actor_id: '', count: 1 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_GRABBING: invalid "actor_id"',
          details: { params: { actor_id: '', count: 1 } },
        }
      );
      expect(grabbingUtils.unlockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when actor_id is whitespace only', async () => {
      const params = { actor_id: '   ', count: 1 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_GRABBING: invalid "actor_id"',
          details: { params: { actor_id: '   ', count: 1 } },
        }
      );
      expect(grabbingUtils.unlockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when actor_id is not a string', async () => {
      const params = { actor_id: 123, count: 1 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_GRABBING: invalid "actor_id"',
          details: { params: { actor_id: 123, count: 1 } },
        }
      );
      expect(grabbingUtils.unlockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when count is missing', async () => {
      const params = { actor_id: 'actor_1' };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_GRABBING: invalid "count" (must be integer >= 1)',
          details: { params: { actor_id: 'actor_1' } },
        }
      );
      expect(grabbingUtils.unlockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when count is less than 1', async () => {
      const params = { actor_id: 'actor_1', count: 0 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_GRABBING: invalid "count" (must be integer >= 1)',
          details: { params: { actor_id: 'actor_1', count: 0 } },
        }
      );
      expect(grabbingUtils.unlockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when count is negative', async () => {
      const params = { actor_id: 'actor_1', count: -1 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_GRABBING: invalid "count" (must be integer >= 1)',
          details: { params: { actor_id: 'actor_1', count: -1 } },
        }
      );
      expect(grabbingUtils.unlockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when count is not an integer', async () => {
      const params = { actor_id: 'actor_1', count: 1.5 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_GRABBING: invalid "count" (must be integer >= 1)',
          details: { params: { actor_id: 'actor_1', count: 1.5 } },
        }
      );
      expect(grabbingUtils.unlockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when count is not a number', async () => {
      const params = { actor_id: 'actor_1', count: 'two' };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_GRABBING: invalid "count" (must be integer >= 1)',
          details: { params: { actor_id: 'actor_1', count: 'two' } },
        }
      );
      expect(grabbingUtils.unlockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should handle when params is null', async () => {
      await handler.execute(null, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_GRABBING: invalid "actor_id"',
          details: { params: null },
        }
      );
      expect(grabbingUtils.unlockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should handle when params is undefined', async () => {
      await handler.execute(undefined, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'UNLOCK_GRABBING: invalid "actor_id"',
          details: { params: undefined },
        }
      );
      expect(grabbingUtils.unlockGrabbingAppendages).not.toHaveBeenCalled();
    });
  });

  describe('execute - error handling', () => {
    test('should handle and dispatch error when unlockGrabbingAppendages throws', async () => {
      const params = { actor_id: 'test-actor', count: 1 };
      const testError = new Error('Failed to unlock appendages');
      grabbingUtils.unlockGrabbingAppendages.mockRejectedValue(testError);

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message:
            'UNLOCK_GRABBING: failed to unlock appendages for entity test-actor',
          details: {
            actor_id: 'test-actor',
            count: 1,
            item_id: null,
            error: 'Failed to unlock appendages',
            stack: testError.stack,
          },
        }
      );
    });

    test('should handle unlockGrabbingAppendages throwing non-Error objects', async () => {
      const params = { actor_id: 'test-actor', count: 1 };
      grabbingUtils.unlockGrabbingAppendages.mockRejectedValue('string error');

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message:
            'UNLOCK_GRABBING: failed to unlock appendages for entity test-actor',
          details: {
            actor_id: 'test-actor',
            count: 1,
            item_id: null,
            error: undefined,
            stack: undefined,
          },
        }
      );
    });
  });

  describe('logger integration', () => {
    test('should use logger from execution context when available', async () => {
      const contextLogger = makeLogger();
      const customContext = { logger: contextLogger };
      const params = { actor_id: 'test-actor', count: 1 };
      grabbingUtils.unlockGrabbingAppendages.mockResolvedValue({
        success: true,
        unlockedParts: ['hand'],
      });

      await handler.execute(params, customContext);

      expect(contextLogger.debug).toHaveBeenCalledWith(
        '[UnlockGrabbingHandler] Successfully unlocked 1 appendage(s) for entity: test-actor'
      );
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test('should handle execution context without logger', async () => {
      const params = { actor_id: 'test-actor', count: 1 };
      grabbingUtils.unlockGrabbingAppendages.mockResolvedValue({
        success: true,
        unlockedParts: ['hand'],
      });

      await handler.execute(params, {});

      // Should not throw error and still execute successfully
      expect(grabbingUtils.unlockGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'test-actor',
        1,
        null
      );
    });

    test('should handle undefined execution context', async () => {
      const params = { actor_id: 'test-actor', count: 1 };
      grabbingUtils.unlockGrabbingAppendages.mockResolvedValue({
        success: true,
        unlockedParts: ['hand'],
      });

      await handler.execute(params, undefined);

      expect(grabbingUtils.unlockGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'test-actor',
        1,
        null
      );
    });
  });
});
