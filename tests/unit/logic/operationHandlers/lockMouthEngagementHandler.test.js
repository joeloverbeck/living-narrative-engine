import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import LockMouthEngagementHandler from '../../../../src/logic/operationHandlers/lockMouthEngagementHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';
import * as mouthEngagementUtils from '../../../../src/utils/mouthEngagementUtils.js';

// Mock the mouthEngagementUtils module
jest.mock('../../../../src/utils/mouthEngagementUtils.js', () => ({
  updateMouthEngagementLock: jest.fn(),
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

describe('LockMouthEngagementHandler', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockEventDispatcher;
  let mockExecutionContext;

  beforeEach(() => {
    // Create fresh mocks
    mockLogger = makeLogger();
    mockEntityManager = makeEntityManager();
    mockEventDispatcher = makeEventDispatcher();

    handler = new LockMouthEngagementHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockEventDispatcher,
    });

    mockExecutionContext = {
      logger: mockLogger,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create instance with valid dependencies', () => {
      expect(handler).toBeInstanceOf(LockMouthEngagementHandler);
    });

    test('should have execute method', () => {
      expect(typeof handler.execute).toBe('function');
    });
  });

  describe('Parameter Validation', () => {
    test('should reject missing actor_id', async () => {
      await handler.execute({}, mockExecutionContext);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'LOCK_MOUTH_ENGAGEMENT: invalid "actor_id"',
          details: expect.objectContaining({
            params: {},
          }),
        })
      );
      expect(
        mouthEngagementUtils.updateMouthEngagementLock
      ).not.toHaveBeenCalled();
    });

    test('should reject empty actor_id', async () => {
      await handler.execute({ actor_id: '  ' }, mockExecutionContext);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'LOCK_MOUTH_ENGAGEMENT: invalid "actor_id"',
        })
      );
      expect(
        mouthEngagementUtils.updateMouthEngagementLock
      ).not.toHaveBeenCalled();
    });

    test('should reject null actor_id', async () => {
      await handler.execute({ actor_id: null }, mockExecutionContext);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'LOCK_MOUTH_ENGAGEMENT: invalid "actor_id"',
        })
      );
      expect(
        mouthEngagementUtils.updateMouthEngagementLock
      ).not.toHaveBeenCalled();
    });

    test('should reject non-string actor_id', async () => {
      await handler.execute({ actor_id: 123 }, mockExecutionContext);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'LOCK_MOUTH_ENGAGEMENT: invalid "actor_id"',
        })
      );
      expect(
        mouthEngagementUtils.updateMouthEngagementLock
      ).not.toHaveBeenCalled();
    });
  });

  describe('Successful Execution', () => {
    test('should lock mouth engagement for valid actor_id', async () => {
      const params = { actor_id: 'test-actor-123' };
      mouthEngagementUtils.updateMouthEngagementLock.mockResolvedValue({
        locked: true,
        updatedParts: [{ partId: 'mouth_1', engagement: { locked: true } }],
      });

      await handler.execute(params, mockExecutionContext);

      expect(
        mouthEngagementUtils.updateMouthEngagementLock
      ).toHaveBeenCalledWith(mockEntityManager, 'test-actor-123', true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully locked mouth engagement'),
        expect.objectContaining({
          actorId: 'test-actor-123',
          result: 'Updated 1 mouth parts',
        })
      );
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('should handle when no mouth found', async () => {
      const params = { actor_id: 'no-mouth-actor' };
      mouthEngagementUtils.updateMouthEngagementLock.mockResolvedValue(null);

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No mouth found to lock')
      );
      // Should not dispatch error
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('should handle legacy entity update', async () => {
      const params = { actor_id: 'legacy-actor' };
      mouthEngagementUtils.updateMouthEngagementLock.mockResolvedValue({
        locked: true,
      });

      await handler.execute(params, mockExecutionContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully locked mouth engagement'),
        expect.objectContaining({
          actorId: 'legacy-actor',
          result: 'Direct component updated',
        })
      );
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    test('should trim actor_id before processing', async () => {
      const params = { actor_id: '  test-actor  ' };
      mouthEngagementUtils.updateMouthEngagementLock.mockResolvedValue({
        locked: true,
      });

      await handler.execute(params, mockExecutionContext);

      expect(
        mouthEngagementUtils.updateMouthEngagementLock
      ).toHaveBeenCalledWith(mockEntityManager, 'test-actor', true);
    });

    test('should handle different actor_id formats', async () => {
      const params = { actor_id: 'core:actor:player' };
      mouthEngagementUtils.updateMouthEngagementLock.mockResolvedValue({
        locked: true,
      });

      await handler.execute(params, mockExecutionContext);

      expect(
        mouthEngagementUtils.updateMouthEngagementLock
      ).toHaveBeenCalledWith(mockEntityManager, 'core:actor:player', true);
    });
  });

  describe('Error Handling', () => {
    test('should handle utility function failure', async () => {
      const params = { actor_id: 'actor_1' };
      mouthEngagementUtils.updateMouthEngagementLock.mockRejectedValue(
        new Error('Utility error')
      );

      // Execute
      await handler.execute(params, mockExecutionContext);

      // Verify error was dispatched
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('failed to lock mouth engagement'),
          details: expect.objectContaining({
            actor_id: 'actor_1',
            error: 'Utility error',
          }),
        })
      );
    });

    test('should handle entity manager errors', async () => {
      const params = { actor_id: 'actor_1' };
      mouthEngagementUtils.updateMouthEngagementLock.mockRejectedValue(
        new Error('EntityManager is required')
      );

      await handler.execute(params, mockExecutionContext);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('failed to lock mouth engagement'),
          details: expect.objectContaining({
            error: 'EntityManager is required',
          }),
        })
      );
    });

    test('should include stack trace in error details', async () => {
      const params = { actor_id: 'actor_1' };
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      mouthEngagementUtils.updateMouthEngagementLock.mockRejectedValue(error);

      await handler.execute(params, mockExecutionContext);

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          details: expect.objectContaining({
            stack: 'Error stack trace',
          }),
        })
      );
    });
  });

  describe('Execution Context', () => {
    test('should use execution context logger when available', async () => {
      const contextLogger = makeLogger();
      const contextWithLogger = {
        logger: contextLogger,
      };

      const params = { actor_id: 'test-actor' };
      mouthEngagementUtils.updateMouthEngagementLock.mockResolvedValue({
        locked: true,
      });

      await handler.execute(params, contextWithLogger);

      expect(contextLogger.debug).toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test('should use default logger when no context logger', async () => {
      const params = { actor_id: 'test-actor' };
      mouthEngagementUtils.updateMouthEngagementLock.mockResolvedValue({
        locked: true,
      });

      await handler.execute(params, {});

      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });
});
