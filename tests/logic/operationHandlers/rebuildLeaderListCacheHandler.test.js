/**
 * @file Test suite that proves the behavior of RebuildLeaderListCacheHandler.
 * @see tests/logic/operationHandlers/rebuildLeaderListCacheHandler.test.js
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import RebuildLeaderListCacheHandler from '../../../src/logic/operationHandlers/rebuildLeaderListCacheHandler.js';
import { DISPLAY_ERROR_ID } from '../../../src/constants/eventIds.js';

// --- Constants ---
const FOLLOWING_COMPONENT_ID = 'core:following';
const LEADING_COMPONENT_ID = 'core:leading';

// --- Mocks ---

/**
 * Creates a mock ILogger.
 *
 * @returns {import('../../../src/interfaces/coreServices.js').ILogger}
 */
const makeMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Creates a simple mock Entity.
 *
 * @param {string} id - The entity ID.
 * @param {object} [components] - A map of component IDs to their data.
 * @returns {{ id: string, getComponentData: jest.Mock, hasComponent: jest.Mock }}
 */
const makeMockEntity = (id, components = {}) => ({
  id,
  getComponentData: jest.fn((componentTypeId) => components[componentTypeId]),
  hasComponent: jest.fn((componentTypeId) => !!components[componentTypeId]),
});

/**
 * Creates a mock IEntityManager.
 *
 * @returns {jest.Mocked<import('../../../src/entities/entityManager.js').default>}
 */
const makeMockEntityManager = () => ({
  getEntitiesWithComponent: jest.fn(),
  getEntityInstance: jest.fn(),
  addComponent: jest.fn(),
  removeComponent: jest.fn(),
});

const makeMockDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(true),
});

// --- Test Suite ---

describe('RebuildLeaderListCacheHandler', () => {
  let mockEntityManager;
  let mockLogger;
  let handler;
  let mockExecutionContext; // Although not used by the handler, we pass it for completeness.
  let dispatcher;

  beforeEach(() => {
    mockLogger = makeMockLogger();
    mockEntityManager = makeMockEntityManager();
    dispatcher = makeMockDispatcher();
    handler = new RebuildLeaderListCacheHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: dispatcher,
    });
    mockExecutionContext = { logger: mockLogger }; // A minimal execution context.
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1. Constructor Tests
  // -----------------------------------------------------------------------------
  describe('Constructor', () => {
    test('should throw a TypeError if the logger dependency is missing or invalid', () => {
      expect(
        () =>
          new RebuildLeaderListCacheHandler({
            entityManager: mockEntityManager,
            safeEventDispatcher: makeMockDispatcher(),
          })
      ).toThrow('RebuildLeaderListCacheHandler requires a valid ILogger.');
      expect(
        () =>
          new RebuildLeaderListCacheHandler({
            logger: {},
            entityManager: mockEntityManager,
            safeEventDispatcher: makeMockDispatcher(),
          })
      ).toThrow('RebuildLeaderListCacheHandler requires a valid ILogger.');
    });

    test('should throw a TypeError if the entity manager dependency is missing or invalid', () => {
      expect(
        () => new RebuildLeaderListCacheHandler({ logger: mockLogger })
      ).toThrow(
        'RebuildLeaderListCacheHandler requires a valid IEntityManager.'
      );
      expect(
        () =>
          new RebuildLeaderListCacheHandler({
            logger: mockLogger,
            entityManager: {},
            safeEventDispatcher: makeMockDispatcher(),
          })
      ).toThrow(
        'RebuildLeaderListCacheHandler requires a valid IEntityManager.'
      );
    });

    test('should throw if safeEventDispatcher is missing or invalid', () => {
      expect(
        () =>
          new RebuildLeaderListCacheHandler({
            logger: mockLogger,
            entityManager: mockEntityManager,
          })
      ).toThrow(/ISafeEventDispatcher/);
      expect(
        () =>
          new RebuildLeaderListCacheHandler({
            logger: mockLogger,
            entityManager: mockEntityManager,
            safeEventDispatcher: {},
          })
      ).toThrow(/ISafeEventDispatcher/);
    });

    test('should initialize successfully with valid dependencies', () => {
      expect(
        () =>
          new RebuildLeaderListCacheHandler({
            logger: mockLogger,
            entityManager: mockEntityManager,
            safeEventDispatcher: makeMockDispatcher(),
          })
      ).not.toThrow();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[RebuildLeaderListCacheHandler] Initialized.'
      );
    });
  });

  // 2. Parameter Validation Tests
  // -----------------------------------------------------------------------------
  describe('Execute Parameter Validation', () => {
    test.each([
      ['null params', null],
      ['undefined params', undefined],
      ['params with no leaderIds', {}],
      ['params with non-array leaderIds', { leaderIds: 'not-an-array' }],
      ['params with empty leaderIds array', { leaderIds: [] }],
    ])('should log debug and skip execution given %s', (caseName, params) => {
      handler.execute(params, mockExecutionContext);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[RebuildLeaderListCacheHandler] No leaderIds provided; skipping.'
      );
      expect(mockEntityManager.getEntitiesWithComponent).not.toHaveBeenCalled();
    });

    test('should filter out invalid leaderIds and skip if the resulting array is empty', () => {
      const params = { leaderIds: [null, '', '   ', undefined, 123] };
      handler.execute(params, mockExecutionContext);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[RebuildLeaderListCacheHandler] leaderIds empty after filtering; skipping.'
      );
      expect(mockEntityManager.getEntitiesWithComponent).not.toHaveBeenCalled();
    });

    test('should filter out invalid IDs but proceed with valid ones', () => {
      const params = { leaderIds: ['leader1', null, '  ', 'leader2'] };
      // Setup mock to return no followers to isolate the filtering logic
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        makeMockEntity(id)
      );

      handler.execute(params, mockExecutionContext);

      // It should attempt to process only the two valid leaders.
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(2);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'leader1'
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'leader2'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Rebuilt cache for 2/2 leader(s)')
      );
    });
  });

  // 3. Core Logic Tests
  // -----------------------------------------------------------------------------
  describe('Core Logic', () => {
    test('should add a "core:leading" component to a leader with one follower', () => {
      // Arrange
      const leader = makeMockEntity('leader1');
      const follower = makeMockEntity('follower1', {
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'leader1' },
      });
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([follower]);
      mockEntityManager.getEntityInstance.mockReturnValue(leader);

      const params = { leaderIds: ['leader1'] };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'leader1',
        LEADING_COMPONENT_ID,
        {
          followers: ['follower1'],
        }
      );
      expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[RebuildLeaderListCacheHandler] Rebuilt cache for 1/1 leader(s).'
      );
    });

    test('should add a "core:leading" component with a list of multiple followers', () => {
      // Arrange
      const leader = makeMockEntity('leader1');
      const follower1 = makeMockEntity('follower1', {
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'leader1' },
      });
      const follower2 = makeMockEntity('follower2', {
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'leader1' },
      });
      // This follower follows someone else and should be ignored for leader1
      const otherFollower = makeMockEntity('follower3', {
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'leader2' },
      });

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        follower1,
        follower2,
        otherFollower,
      ]);
      mockEntityManager.getEntityInstance.mockReturnValue(leader);

      const params = { leaderIds: ['leader1'] };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'leader1',
        LEADING_COMPONENT_ID,
        {
          followers: ['follower1', 'follower2'],
        }
      );
      expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
    });

    test('should remove "core:leading" component from a leader with no followers', () => {
      // Arrange
      const leader = makeMockEntity('leader1');
      // Simulate that no entities have the 'following' component
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);
      mockEntityManager.getEntityInstance.mockReturnValue(leader);

      const params = { leaderIds: ['leader1'] };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      expect(mockEntityManager.removeComponent).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'leader1',
        LEADING_COMPONENT_ID
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[RebuildLeaderListCacheHandler] Rebuilt cache for 1/1 leader(s).'
      );
    });

    test('should handle multiple leaders correctly in a single call', () => {
      // Arrange
      const leader1 = makeMockEntity('leader1'); // Will have followers
      const leader2 = makeMockEntity('leader2'); // Will have no followers
      const leader3 = makeMockEntity('leader3'); // Will have a follower

      const follower1a = makeMockEntity('follower1a', {
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'leader1' },
      });
      const follower1b = makeMockEntity('follower1b', {
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'leader1' },
      });
      const follower3 = makeMockEntity('follower3', {
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'leader3' },
      });

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        follower1a,
        follower1b,
        follower3,
      ]);
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'leader1') return leader1;
        if (id === 'leader2') return leader2;
        if (id === 'leader3') return leader3;
        return undefined;
      });

      const params = { leaderIds: ['leader1', 'leader2', 'leader3'] };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(2);
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'leader1',
        LEADING_COMPONENT_ID,
        {
          followers: ['follower1a', 'follower1b'],
        }
      );
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'leader3',
        LEADING_COMPONENT_ID,
        {
          followers: ['follower3'],
        }
      );

      expect(mockEntityManager.removeComponent).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'leader2',
        LEADING_COMPONENT_ID
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[RebuildLeaderListCacheHandler] Rebuilt cache for 3/3 leader(s).'
      );
    });
  });

  // 4. Edge Cases and Error Handling
  // -----------------------------------------------------------------------------
  describe('Edge Cases and Error Handling', () => {
    test('should log a warning and skip a leader that is not found', () => {
      // Arrange
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);
      // leader 'dne' (does not exist) will not be found
      mockEntityManager.getEntityInstance.mockReturnValue(undefined);

      const params = { leaderIds: ['dne'] };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[RebuildLeaderListCacheHandler] Leader 'dne' not found; skipping."
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expect(mockEntityManager.removeComponent).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[RebuildLeaderListCacheHandler] Rebuilt cache for 0/1 leader(s).'
      );
    });

    test('should ignore followers with invalid or missing leaderId data', () => {
      const leader = makeMockEntity('leader1');
      const follower1 = makeMockEntity('follower1', {
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'leader1' },
      });
      const followerInvalid1 = makeMockEntity('invalid1', {
        [FOLLOWING_COMPONENT_ID]: { leaderId: null },
      });
      const followerInvalid2 = makeMockEntity('invalid2', {
        [FOLLOWING_COMPONENT_ID]: { leaderId: '   ' },
      });
      const followerInvalid3 = makeMockEntity('invalid3', {
        [FOLLOWING_COMPONENT_ID]: {},
      }); // no leaderId key
      const followerInvalid4 = makeMockEntity('invalid4', {
        [FOLLOWING_COMPONENT_ID]: null,
      }); // component data is null

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        follower1,
        followerInvalid1,
        followerInvalid2,
        followerInvalid3,
        followerInvalid4,
      ]);
      mockEntityManager.getEntityInstance.mockReturnValue(leader);

      const params = { leaderIds: ['leader1'] };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert: Only the valid follower should be in the list.
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'leader1',
        LEADING_COMPONENT_ID,
        {
          followers: ['follower1'],
        }
      );
    });

    test('should log an error if addComponent fails but continue processing', () => {
      // Arrange
      const leader1 = makeMockEntity('leader1');
      const leader2 = makeMockEntity('leader2');
      const follower1 = makeMockEntity('follower1', {
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'leader1' },
      });
      const follower2 = makeMockEntity('follower2', {
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'leader2' },
      });
      const error = new Error('EntityManager failed');

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        follower1,
        follower2,
      ]);
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === 'leader1' ? leader1 : leader2
      );
      // Fail on the first call, succeed on the second
      mockEntityManager.addComponent
        .mockImplementationOnce(() => {
          throw error;
        })
        .mockImplementation(() => {});

      const params = { leaderIds: ['leader1', 'leader2'] };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        DISPLAY_ERROR_ID,
        expect.objectContaining({
          message:
            "[RebuildLeaderListCacheHandler] Failed updating 'core:leading' for 'leader1': EntityManager failed",
          details: { stack: error.stack, leaderId: 'leader1' },
        })
      );

      // Verify it still processed the second leader
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(2);
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'leader2',
        LEADING_COMPONENT_ID,
        {
          followers: ['follower2'],
        }
      );
      // The final count should reflect 1 successful update out of 2 attempts.
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[RebuildLeaderListCacheHandler] Rebuilt cache for 1/2 leader(s).'
      );
    });

    test('should log an error if removeComponent fails', () => {
      // Arrange
      const leader = makeMockEntity('leader1');
      const error = new Error('EntityManager remove failed');
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);
      mockEntityManager.getEntityInstance.mockReturnValue(leader);
      mockEntityManager.removeComponent.mockImplementation(() => {
        throw error;
      });

      const params = { leaderIds: ['leader1'] };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        DISPLAY_ERROR_ID,
        expect.objectContaining({
          message:
            "[RebuildLeaderListCacheHandler] Failed updating 'core:leading' for 'leader1': EntityManager remove failed",
          details: { stack: error.stack, leaderId: 'leader1' },
        })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[RebuildLeaderListCacheHandler] Rebuilt cache for 0/1 leader(s).'
      );
    });
  });
});
