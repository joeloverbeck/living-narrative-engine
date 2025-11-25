import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import LockGrabbingHandler from '../../../../src/logic/operationHandlers/lockGrabbingHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';
import * as grabbingUtils from '../../../../src/utils/grabbingUtils.js';

// Mock the grabbingUtils module
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  lockGrabbingAppendages: jest.fn(),
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

describe('LockGrabbingHandler', () => {
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
    handler = new LockGrabbingHandler({
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

  describe('LockGrabbingHandler setup', () => {
    test('should create instance with valid dependencies', () => {
      expect(handler).toBeInstanceOf(LockGrabbingHandler);
    });

    test('should have execute method', () => {
      expect(typeof handler.execute).toBe('function');
    });
  });

  describe('execute - success cases', () => {
    test('should successfully lock specified count of appendages', async () => {
      const params = { actor_id: 'test-actor-123', count: 2 };
      grabbingUtils.lockGrabbingAppendages.mockResolvedValue({
        success: true,
        lockedParts: ['left_hand', 'right_hand'],
      });

      await handler.execute(params, executionContext);

      expect(grabbingUtils.lockGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'test-actor-123',
        2,
        null
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[LockGrabbingHandler] Successfully locked 2 appendage(s) for entity: test-actor-123'
      );
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('should associate item_id with locked appendages when provided', async () => {
      const params = { actor_id: 'test-actor', count: 1, item_id: 'sword_1' };
      grabbingUtils.lockGrabbingAppendages.mockResolvedValue({
        success: true,
        lockedParts: ['right_hand'],
      });

      await handler.execute(params, executionContext);

      expect(grabbingUtils.lockGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'test-actor',
        1,
        'sword_1'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[LockGrabbingHandler] Successfully locked 1 appendage(s) for entity: test-actor (holding item: sword_1)'
      );
    });

    test('should work correctly when item_id is omitted', async () => {
      const params = { actor_id: 'actor_1', count: 1 };
      grabbingUtils.lockGrabbingAppendages.mockResolvedValue({
        success: true,
        lockedParts: ['left_hand'],
      });

      await handler.execute(params, executionContext);

      expect(grabbingUtils.lockGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1',
        1,
        null
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.not.stringContaining('holding item')
      );
    });

    test('should trim whitespace from actor_id', async () => {
      const params = { actor_id: '  test-actor  ', count: 1 };
      grabbingUtils.lockGrabbingAppendages.mockResolvedValue({
        success: true,
        lockedParts: ['hand'],
      });

      await handler.execute(params, executionContext);

      expect(grabbingUtils.lockGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'test-actor',
        1,
        null
      );
    });
  });

  describe('execute - parameter validation', () => {
    test('should dispatch error when actor_id is missing', async () => {
      const params = { count: 1 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'LOCK_GRABBING: invalid "actor_id"',
          details: { params: { count: 1 } },
        }
      );
      expect(grabbingUtils.lockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when actor_id is null', async () => {
      const params = { actor_id: null, count: 1 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'LOCK_GRABBING: invalid "actor_id"',
          details: { params: { actor_id: null, count: 1 } },
        }
      );
      expect(grabbingUtils.lockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when actor_id is empty string', async () => {
      const params = { actor_id: '', count: 1 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'LOCK_GRABBING: invalid "actor_id"',
          details: { params: { actor_id: '', count: 1 } },
        }
      );
      expect(grabbingUtils.lockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when actor_id is whitespace only', async () => {
      const params = { actor_id: '   ', count: 1 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'LOCK_GRABBING: invalid "actor_id"',
          details: { params: { actor_id: '   ', count: 1 } },
        }
      );
      expect(grabbingUtils.lockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when actor_id is not a string', async () => {
      const params = { actor_id: 123, count: 1 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'LOCK_GRABBING: invalid "actor_id"',
          details: { params: { actor_id: 123, count: 1 } },
        }
      );
      expect(grabbingUtils.lockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when count is missing', async () => {
      const params = { actor_id: 'actor_1' };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'LOCK_GRABBING: invalid "count" (must be integer >= 1)',
          details: { params: { actor_id: 'actor_1' } },
        }
      );
      expect(grabbingUtils.lockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when count is less than 1', async () => {
      const params = { actor_id: 'actor_1', count: 0 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'LOCK_GRABBING: invalid "count" (must be integer >= 1)',
          details: { params: { actor_id: 'actor_1', count: 0 } },
        }
      );
      expect(grabbingUtils.lockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when count is negative', async () => {
      const params = { actor_id: 'actor_1', count: -1 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'LOCK_GRABBING: invalid "count" (must be integer >= 1)',
          details: { params: { actor_id: 'actor_1', count: -1 } },
        }
      );
      expect(grabbingUtils.lockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when count is not an integer', async () => {
      const params = { actor_id: 'actor_1', count: 1.5 };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'LOCK_GRABBING: invalid "count" (must be integer >= 1)',
          details: { params: { actor_id: 'actor_1', count: 1.5 } },
        }
      );
      expect(grabbingUtils.lockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should dispatch error when count is not a number', async () => {
      const params = { actor_id: 'actor_1', count: 'two' };

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'LOCK_GRABBING: invalid "count" (must be integer >= 1)',
          details: { params: { actor_id: 'actor_1', count: 'two' } },
        }
      );
      expect(grabbingUtils.lockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should handle when params is null', async () => {
      await handler.execute(null, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'LOCK_GRABBING: invalid "actor_id"',
          details: { params: null },
        }
      );
      expect(grabbingUtils.lockGrabbingAppendages).not.toHaveBeenCalled();
    });

    test('should handle when params is undefined', async () => {
      await handler.execute(undefined, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'LOCK_GRABBING: invalid "actor_id"',
          details: { params: undefined },
        }
      );
      expect(grabbingUtils.lockGrabbingAppendages).not.toHaveBeenCalled();
    });
  });

  describe('execute - insufficient appendages', () => {
    test('should dispatch error when not enough free appendages', async () => {
      const params = { actor_id: 'actor_1', count: 3 };
      grabbingUtils.lockGrabbingAppendages.mockResolvedValue({
        success: false,
        lockedParts: [],
        error: 'Not enough free appendages: need 3, have 2',
      });

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'LOCK_GRABBING: Not enough free appendages: need 3, have 2',
          details: { actor_id: 'actor_1', count: 3, item_id: null },
        }
      );
    });

    test('should dispatch error from utility when locking fails', async () => {
      const params = { actor_id: 'actor_1', count: 1, item_id: 'sword_1' };
      grabbingUtils.lockGrabbingAppendages.mockResolvedValue({
        success: false,
        lockedParts: [],
        error: 'Invalid arguments',
      });

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message: 'LOCK_GRABBING: Invalid arguments',
          details: { actor_id: 'actor_1', count: 1, item_id: 'sword_1' },
        }
      );
    });
  });

  describe('execute - error handling', () => {
    test('should handle and dispatch error when lockGrabbingAppendages throws', async () => {
      const params = { actor_id: 'test-actor', count: 1 };
      const testError = new Error('Failed to lock appendages');
      grabbingUtils.lockGrabbingAppendages.mockRejectedValue(testError);

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message:
            'LOCK_GRABBING: failed to lock appendages for entity test-actor',
          details: {
            actor_id: 'test-actor',
            count: 1,
            item_id: null,
            error: 'Failed to lock appendages',
            stack: testError.stack,
          },
        }
      );
    });

    test('should handle lockGrabbingAppendages throwing non-Error objects', async () => {
      const params = { actor_id: 'test-actor', count: 1 };
      grabbingUtils.lockGrabbingAppendages.mockRejectedValue('string error');

      await handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message:
            'LOCK_GRABBING: failed to lock appendages for entity test-actor',
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
      grabbingUtils.lockGrabbingAppendages.mockResolvedValue({
        success: true,
        lockedParts: ['hand'],
      });

      await handler.execute(params, customContext);

      expect(contextLogger.debug).toHaveBeenCalledWith(
        '[LockGrabbingHandler] Successfully locked 1 appendage(s) for entity: test-actor'
      );
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test('should handle execution context without logger', async () => {
      const params = { actor_id: 'test-actor', count: 1 };
      grabbingUtils.lockGrabbingAppendages.mockResolvedValue({
        success: true,
        lockedParts: ['hand'],
      });

      await handler.execute(params, {});

      // Should not throw error and still execute successfully
      expect(grabbingUtils.lockGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'test-actor',
        1,
        null
      );
    });

    test('should handle undefined execution context', async () => {
      const params = { actor_id: 'test-actor', count: 1 };
      grabbingUtils.lockGrabbingAppendages.mockResolvedValue({
        success: true,
        lockedParts: ['hand'],
      });

      await handler.execute(params, undefined);

      expect(grabbingUtils.lockGrabbingAppendages).toHaveBeenCalledWith(
        mockEntityManager,
        'test-actor',
        1,
        null
      );
    });
  });
});
