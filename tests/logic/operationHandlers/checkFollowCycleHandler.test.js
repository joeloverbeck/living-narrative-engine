/**
 * @file Test suite that proves the behavior of CheckFollowCycleHandler.
 * @see tests/logic/operationHandlers/checkFollowCycleHandler.test.js
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import CheckFollowCycleHandler from '../../../src/logic/operationHandlers/checkFollowCycleHandler.js';
// Assuming the constant is exported from a known path
import { FOLLOWING_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { DISPLAY_ERROR_ID } from '../../../src/constants/eventIds.js';

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
 * Creates a simple mock Entity. It only needs a `getComponentData` method for these tests.
 *
 * @param {object} [components] - A map of component IDs to their data.
 * @returns {{ getComponentData: jest.Mock }}
 */
const makeMockEntity = (components = {}) => ({
  getComponentData: jest.fn((componentTypeId) => components[componentTypeId]),
});

/**
 * Creates a mock IEntityManager.
 *
 * @returns {jest.Mocked<import('../../../src/entities/entityManager.js').default>}
 */
const makeMockEntityManager = () => ({
  getEntityInstance: jest.fn(),
  // Add other methods to satisfy the interface if needed, even if they do nothing.
  getEntityDefinition: jest.fn(),
  validate: jest.fn(),
  getComponentData: jest.fn(),
});

describe('CheckFollowCycleHandler', () => {
  let mockEntityManager;
  let mockLogger;
  let handler;
  let mockExecutionContext;
  let mockDispatcher;

  beforeEach(() => {
    mockLogger = makeMockLogger();
    mockEntityManager = makeMockEntityManager();
    mockDispatcher = { dispatch: jest.fn() };
    handler = new CheckFollowCycleHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
    });
    mockExecutionContext = {
      evaluationContext: {
        context: {},
      },
      logger: mockLogger,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1. Constructor Tests
  // -----------------------------------------------------------------------------
  describe('Constructor', () => {
    test('should throw an error if the logger dependency is missing or invalid', () => {
      expect(
        () =>
          new CheckFollowCycleHandler({
            entityManager: mockEntityManager,
            safeEventDispatcher: mockDispatcher,
          })
      ).toThrow('CheckFollowCycleHandler requires a valid ILogger');
      expect(
        () =>
          new CheckFollowCycleHandler({
            logger: {},
            entityManager: mockEntityManager,
            safeEventDispatcher: mockDispatcher,
          })
      ).toThrow('CheckFollowCycleHandler requires a valid ILogger');
    });

    test('should throw an error if the entity manager dependency is missing or invalid', () => {
      expect(
        () =>
          new CheckFollowCycleHandler({
            logger: mockLogger,
            safeEventDispatcher: mockDispatcher,
          })
      ).toThrow('CheckFollowCycleHandler requires a valid EntityManager');
      expect(
        () =>
          new CheckFollowCycleHandler({ logger: mockLogger, entityManager: {} })
      ).toThrow('CheckFollowCycleHandler requires a valid EntityManager');
    });

    test('should throw an error if safeEventDispatcher dependency is missing or invalid', () => {
      expect(
        () =>
          new CheckFollowCycleHandler({
            logger: mockLogger,
            entityManager: mockEntityManager,
          })
      ).toThrow(/ISafeEventDispatcher/);
      expect(
        () =>
          new CheckFollowCycleHandler({
            logger: mockLogger,
            entityManager: mockEntityManager,
            safeEventDispatcher: {},
          })
      ).toThrow(/ISafeEventDispatcher/);
    });

    test('should initialize successfully with valid dependencies', () => {
      expect(
        () =>
          new CheckFollowCycleHandler({
            logger: mockLogger,
            entityManager: mockEntityManager,
            safeEventDispatcher: mockDispatcher,
          })
      ).not.toThrow();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[CheckFollowCycleHandler] Initialized'
      );
    });
  });

  // 2. Parameter Validation Tests
  // -----------------------------------------------------------------------------
  describe('Parameter Validation', () => {
    const invalidParams = [
      ['follower_id', { leader_id: 'leader1', result_variable: 'res' }],
      [
        'follower_id',
        { follower_id: ' ', leader_id: 'leader1', result_variable: 'res' },
      ],
      ['leader_id', { follower_id: 'follower1', result_variable: 'res' }],
      [
        'leader_id',
        { follower_id: 'follower1', leader_id: null, result_variable: 'res' },
      ],
      ['result_variable', { follower_id: 'follower1', leader_id: 'leader1' }],
      [
        'result_variable',
        { follower_id: 'follower1', leader_id: 'leader1', result_variable: '' },
      ],
    ];

    test.each(invalidParams)(
      'should dispatch an error and return if "%s" parameter is invalid',
      (paramName, params) => {
        handler.execute(params, mockExecutionContext);
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          DISPLAY_ERROR_ID,
          expect.objectContaining({
            message: `CHECK_FOLLOW_CYCLE: Invalid "${paramName}" parameter`,
          })
        );
        expect(mockExecutionContext.evaluationContext.context).toEqual({});
      }
    );

    test('should dispatch an error and return if params object itself is missing', () => {
      handler.execute(null, mockExecutionContext);
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        DISPLAY_ERROR_ID,
        expect.objectContaining({
          message: 'CHECK_FOLLOW_CYCLE: Invalid "follower_id" parameter',
        })
      );
    });
  });

  // 3. Cycle Detection Logic
  // -----------------------------------------------------------------------------
  describe('Cycle Detection Logic', () => {
    test('should detect a direct cycle (A wants to follow B, B follows A)', () => {
      // Arrange: B is already following A.
      const entityA = makeMockEntity({
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'entityB' },
      });
      mockEntityManager.getEntityInstance.mockReturnValueOnce(entityA);
      const params = {
        follower_id: 'entityB',
        leader_id: 'entityA',
        result_variable: 'cycleCheck',
      };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      const result = mockExecutionContext.evaluationContext.context.cycleCheck;
      expect(result).toEqual({ success: true, cycleDetected: true });
    });

    test('should detect a long cycle (C wants to follow A, where A -> B -> C)', () => {
      // Arrange: A follows B, B follows C. C now wants to follow A, closing the loop.
      const entityA = makeMockEntity({
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'entityB' },
      });
      const entityB = makeMockEntity({
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'entityC' },
      });

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entityA') return entityA;
        if (id === 'entityB') return entityB;
        return undefined; // C is not following anyone yet
      });

      const params = {
        follower_id: 'entityC',
        leader_id: 'entityA',
        result_variable: 'cycleCheck',
      };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      const result = mockExecutionContext.evaluationContext.context.cycleCheck;
      expect(result).toEqual({ success: true, cycleDetected: true });
    });

    test('should detect a self-follow cycle (A wants to follow A)', () => {
      const params = {
        follower_id: 'entityA',
        leader_id: 'entityA',
        result_variable: 'cycleCheck',
      };
      handler.execute(params, mockExecutionContext);
      const result = mockExecutionContext.evaluationContext.context.cycleCheck;
      expect(result).toEqual({ success: true, cycleDetected: true });
    });

    test('should return "false" when no cycle is created (C wants to follow A, where A -> B)', () => {
      // Arrange: A follows B, B follows no one. C wants to follow A.
      const entityA = makeMockEntity({
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'entityB' },
      });
      const entityB = makeMockEntity({}); // No following component
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entityA') return entityA;
        if (id === 'entityB') return entityB;
        return undefined;
      });
      const params = {
        follower_id: 'entityC',
        leader_id: 'entityA',
        result_variable: 'cycleCheck',
      };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      const result = mockExecutionContext.evaluationContext.context.cycleCheck;
      expect(result).toEqual({ success: true, cycleDetected: false });
    });

    test('should return "false" if the follow chain is broken by a non-existent entity', () => {
      // Arrange: A wants to follow B, but B's leader 'entityC' does not exist.
      const entityB = makeMockEntity({
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'entityC' },
      });
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entityB') return entityB;
        return undefined; // entityC does not resolve
      });
      const params = {
        follower_id: 'entityA',
        leader_id: 'entityB',
        result_variable: 'cycleCheck',
      };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      const result = mockExecutionContext.evaluationContext.context.cycleCheck;
      expect(result).toEqual({ success: true, cycleDetected: false });
    });

    test('should return "false" if the chain ends with an entity not following anyone', () => {
      // Arrange: A wants to follow B, B follows C, C follows no one.
      const entityB = makeMockEntity({
        [FOLLOWING_COMPONENT_ID]: { leaderId: 'entityC' },
      });
      const entityC = makeMockEntity({}); // No 'following' component
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entityB') return entityB;
        if (id === 'entityC') return entityC;
        return undefined;
      });
      const params = {
        follower_id: 'entityA',
        leader_id: 'entityB',
        result_variable: 'cycleCheck',
      };

      // Act
      handler.execute(params, mockExecutionContext);

      // Assert
      const result = mockExecutionContext.evaluationContext.context.cycleCheck;
      expect(result).toEqual({ success: true, cycleDetected: false });
    });
  });

  // 4. Context Writing and Edge Cases
  // -----------------------------------------------------------------------------
  describe('Context Writing and Edge Cases', () => {
    test('should correctly write the result to the specified result_variable', () => {
      const params = {
        follower_id: 'follower',
        leader_id: 'leader',
        result_variable: 'my_custom_result',
      };
      handler.execute(params, mockExecutionContext);

      expect(mockExecutionContext.evaluationContext.context).toHaveProperty(
        'my_custom_result'
      );
      expect(
        mockExecutionContext.evaluationContext.context.my_custom_result
      ).toEqual({
        success: true,
        cycleDetected: false,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CHECK_FOLLOW_CYCLE: Stored result in "my_custom_result": {"success":true,"cycleDetected":false}'
      );
    });

    test('should dispatch an error if writing to the execution context fails', () => {
      // Arrange: create an invalid execution context
      const invalidExecCtx = {
        evaluationContext: null, // This will cause a TypeError
        logger: mockLogger,
      };
      const params = {
        follower_id: 'follower',
        leader_id: 'leader',
        result_variable: 'res',
      };

      // Act
      handler.execute(params, invalidExecCtx);

      // Assert
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        DISPLAY_ERROR_ID,
        expect.objectContaining({
          message: expect.stringContaining('cannot store result'),
        })
      );
    });
  });
});
