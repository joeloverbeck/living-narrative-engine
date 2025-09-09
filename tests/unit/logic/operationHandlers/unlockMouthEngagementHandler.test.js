import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import UnlockMouthEngagementHandler from '../../../../src/logic/operationHandlers/unlockMouthEngagementHandler.js';
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

describe('UnlockMouthEngagementHandler', () => {
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
    
    handler = new UnlockMouthEngagementHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockEventDispatcher,
    });

    mockExecutionContext = {
      logger: mockLogger,
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Successful Execution', () => {
    test('should unlock locked mouth engagement', async () => {
      // Mock successful unlock operation
      mouthEngagementUtils.updateMouthEngagementLock.mockResolvedValue({
        success: true,
        updatedParts: ['mouth_1']
      });

      // Execute
      await handler.execute(
        { actor_id: 'actor_1' },
        mockExecutionContext
      );

      // Verify utility was called correctly
      expect(mouthEngagementUtils.updateMouthEngagementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1',
        false // Unlock the mouth
      );

      // Verify success event
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:mouth_engagement_unlocked',
        {
          actorId: 'actor_1',
          timestamp: expect.any(String),
        }
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully unlocked mouth engagement'),
        expect.objectContaining({ actorId: 'actor_1' })
      );
    });

    test('should handle already unlocked mouth (idempotent)', async () => {
      // Mock successful unlock operation (idempotent)
      mouthEngagementUtils.updateMouthEngagementLock.mockResolvedValue({
        success: true,
        alreadyUnlocked: true
      });

      // Execute
      await handler.execute(
        { actor_id: 'actor_1' },
        mockExecutionContext
      );

      // Should still call utility (idempotent operation)
      expect(mouthEngagementUtils.updateMouthEngagementLock).toHaveBeenCalledWith(
        mockEntityManager,
        'actor_1',
        false
      );

      // Should not error
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: SYSTEM_ERROR_OCCURRED_ID })
      );
    });

    test('should handle entity with no mouth found', async () => {
      // Mock no mouth found scenario
      mouthEngagementUtils.updateMouthEngagementLock.mockResolvedValue(null);

      // Execute
      await handler.execute(
        { actor_id: 'actor_1' },
        mockExecutionContext
      );

      // Should warn about no mouth found
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No mouth found to unlock for entity: actor_1')
      );

      // Should not dispatch success event
      expect(mockEventDispatcher.dispatch).not.toHaveBeenCalledWith(
        'core:mouth_engagement_unlocked',
        expect.any(Object)
      );
    });
  });

  describe('Error Cases', () => {
    test('should handle missing actor_id', async () => {
      await handler.execute({}, mockExecutionContext);
      
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'UNLOCK_MOUTH_ENGAGEMENT: invalid "actor_id"',
          details: expect.objectContaining({
            params: {}
          }),
        })
      );
    });

    test('should handle utility function errors', async () => {
      const mockError = new Error('Utility function failed');
      mouthEngagementUtils.updateMouthEngagementLock.mockRejectedValue(mockError);
      
      await handler.execute(
        { actor_id: 'actor_1' },
        mockExecutionContext
      );
      
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'UNLOCK_MOUTH_ENGAGEMENT: failed to unlock mouth engagement for entity actor_1',
          details: expect.objectContaining({
            actor_id: 'actor_1',
            error: 'Utility function failed'
          }),
        })
      );
    });
  });
});