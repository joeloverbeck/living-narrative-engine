/**
 * @file Integration tests for batch mode event handling during game loading
 * @description Tests that the game loading process correctly enables EventBus batch mode
 * to handle legitimate bulk events without triggering recursion guards
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import GameEngine from '../../../src/engine/gameEngine.js';
import createSafeErrorLogger from '../../../src/utils/safeErrorLogger.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Game Loading Batch Mode Integration', () => {
  let testBed;
  let gameEngine;
  let mockEventBus;
  let mockSafeEventDispatcher;
  let mockContainer;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    // Mock EventBus with batch mode functionality
    mockEventBus = {
      setBatchMode: jest.fn(),
      isBatchModeEnabled: jest.fn().mockReturnValue(false),
      getBatchModeOptions: jest.fn().mockReturnValue(null),
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    // Mock SafeEventDispatcher with batch mode functionality
    mockSafeEventDispatcher = {
      setBatchMode: jest.fn(),
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    // Create comprehensive mock container that resolves all required dependencies
    mockContainer = {
      resolve: jest.fn().mockImplementation((token) => {
        if (token === tokens.EventBus) return mockEventBus;
        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.IEntityManager)
          return testBed.createMock('IEntityManager', ['clearAll']);
        if (token === tokens.ITurnManager)
          return testBed.createMock('ITurnManager', ['stop', 'start']);
        if (token === tokens.GamePersistenceService)
          return testBed.createMock('GamePersistenceService', []);
        if (token === tokens.PlaytimeTracker)
          return testBed.createMock('PlaytimeTracker', [
            'reset',
            'endSessionAndAccumulate',
            'startSession',
          ]);
        if (token === tokens.ISafeEventDispatcher)
          return mockSafeEventDispatcher;
        if (token === tokens.IInitializationService)
          return {
            runInitializationSequence: jest
              .fn()
              .mockResolvedValue({ success: true }),
          };
        // Return a generic mock for any other token
        return testBed.createMock(token, [
          'dispatch',
          'subscribe',
          'unsubscribe',
        ]);
      }),
      isRegistered: jest.fn().mockReturnValue(false),
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('GameEngine Batch Mode Integration', () => {
    it('should enable batch mode during game loading', async () => {
      // Arrange
      gameEngine = new GameEngine({
        container: mockContainer,
        logger: mockLogger,
      });

      // Act
      await gameEngine.startNewGame('testWorld');

      // Assert
      expect(mockSafeEventDispatcher.setBatchMode).toHaveBeenCalledWith(true, {
        maxRecursionDepth: 25, // Base limit - EventBus will apply event-specific overrides
        maxGlobalRecursion: 200, // Higher limit for game-initialization to handle complex bulk operations
        timeoutMs: 60000,
        context: 'game-initialization',
      });
    });

    it('should disable batch mode after game loading completes', async () => {
      // Arrange
      gameEngine = new GameEngine({
        container: mockContainer,
        logger: mockLogger,
      });

      // Act
      await gameEngine.startNewGame('testWorld');

      // Assert
      expect(mockSafeEventDispatcher.setBatchMode).toHaveBeenCalledWith(false);
    });

    it('should disable batch mode even if game loading fails', async () => {
      // Arrange
      const initializationService = {
        runInitializationSequence: jest
          .fn()
          .mockRejectedValue(new Error('Initialization failed')),
      };

      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.IInitializationService)
          return initializationService;
        if (token === tokens.EventBus) return mockEventBus;
        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.IEntityManager)
          return testBed.createMock('IEntityManager', ['clearAll']);
        if (token === tokens.ITurnManager)
          return testBed.createMock('ITurnManager', ['stop', 'start']);
        if (token === tokens.GamePersistenceService)
          return testBed.createMock('GamePersistenceService', []);
        if (token === tokens.PlaytimeTracker)
          return testBed.createMock('PlaytimeTracker', [
            'reset',
            'endSessionAndAccumulate',
            'startSession',
          ]);
        if (token === tokens.ISafeEventDispatcher)
          return mockSafeEventDispatcher;
        return testBed.createMock(token, [
          'dispatch',
          'subscribe',
          'unsubscribe',
        ]);
      });

      gameEngine = new GameEngine({
        container: mockContainer,
        logger: mockLogger,
      });

      // Act & Assert
      await expect(gameEngine.startNewGame('testWorld')).rejects.toThrow();
      expect(mockSafeEventDispatcher.setBatchMode).toHaveBeenCalledWith(false);
    });
  });

  describe('SafeErrorLogger Batch Mode Configuration', () => {
    it('should use enhanced limits for game-initialization context', () => {
      // Arrange
      const safeErrorLogger = createSafeErrorLogger({
        logger: mockLogger,
        safeEventDispatcher: mockSafeEventDispatcher,
      });

      // Act
      safeErrorLogger.enableGameLoadingMode({
        context: 'game-initialization',
        timeoutMs: 60000,
      });

      // Assert
      expect(mockSafeEventDispatcher.setBatchMode).toHaveBeenCalledWith(true, {
        maxRecursionDepth: 25,
        maxGlobalRecursion: 200,
        timeoutMs: 60000,
        context: 'game-initialization',
      });
    });

    it('should use enhanced limits for game-load context', () => {
      const safeErrorLogger = createSafeErrorLogger({
        logger: mockLogger,
        safeEventDispatcher: mockSafeEventDispatcher,
      });

      safeErrorLogger.enableGameLoadingMode({
        context: 'game-load',
        timeoutMs: 45000,
      });

      expect(mockSafeEventDispatcher.setBatchMode).toHaveBeenCalledWith(true, {
        maxRecursionDepth: 25,
        maxGlobalRecursion: 200,
        timeoutMs: 45000,
        context: 'game-load',
      });
    });

    it('should use standard limits for other contexts', () => {
      // Arrange
      const safeErrorLogger = createSafeErrorLogger({
        logger: mockLogger,
        safeEventDispatcher: mockSafeEventDispatcher,
      });

      // Act
      safeErrorLogger.enableGameLoadingMode({
        context: 'bulk-operation',
        timeoutMs: 30000,
      });

      // Assert
      expect(mockSafeEventDispatcher.setBatchMode).toHaveBeenCalledWith(true, {
        maxRecursionDepth: 25,
        maxGlobalRecursion: 50,
        timeoutMs: 30000,
        context: 'bulk-operation',
      });
    });
  });

  describe('Batch Mode Error Handling', () => {
    it('should handle initialization failures gracefully with batch mode cleanup', async () => {
      // Arrange
      const initializationError = new Error('World data not found');
      const initializationService = {
        runInitializationSequence: jest
          .fn()
          .mockRejectedValue(initializationError),
      };

      mockContainer.resolve.mockImplementation((token) => {
        if (token === tokens.IInitializationService)
          return initializationService;
        if (token === tokens.EventBus) return mockEventBus;
        if (token === tokens.ILogger) return mockLogger;
        if (token === tokens.IEntityManager)
          return testBed.createMock('IEntityManager', ['clearAll']);
        if (token === tokens.ITurnManager)
          return testBed.createMock('ITurnManager', ['stop', 'start']);
        if (token === tokens.GamePersistenceService)
          return testBed.createMock('GamePersistenceService', []);
        if (token === tokens.PlaytimeTracker)
          return testBed.createMock('PlaytimeTracker', [
            'reset',
            'endSessionAndAccumulate',
            'startSession',
          ]);
        if (token === tokens.ISafeEventDispatcher)
          return mockSafeEventDispatcher;
        return testBed.createMock(token, [
          'dispatch',
          'subscribe',
          'unsubscribe',
        ]);
      });

      gameEngine = new GameEngine({
        container: mockContainer,
        logger: mockLogger,
      });

      // Act & Assert
      await expect(gameEngine.startNewGame('invalidWorld')).rejects.toThrow(
        'World data not found'
      );

      // Verify batch mode was enabled and then disabled
      expect(mockSafeEventDispatcher.setBatchMode).toHaveBeenCalledWith(
        true,
        expect.any(Object)
      );
      expect(mockSafeEventDispatcher.setBatchMode).toHaveBeenCalledWith(false);
    });

    it('should log appropriate context for batch mode operations', async () => {
      // Arrange
      gameEngine = new GameEngine({
        container: mockContainer,
        logger: mockLogger,
      });

      // Act
      await gameEngine.startNewGame('testWorld');

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'SafeErrorLogger: Enabled batch mode for game-initialization'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'maxRecursionDepth: 25, maxGlobalRecursion: 200'
        )
      );
    });
  });

  describe('Performance and Safety', () => {
    it('should set appropriate timeout for game loading batch mode', async () => {
      // Arrange
      gameEngine = new GameEngine({
        container: mockContainer,
        logger: mockLogger,
      });

      // Act
      await gameEngine.startNewGame('testWorld');

      // Assert
      const batchModeCall =
        mockSafeEventDispatcher.setBatchMode.mock.calls.find(
          (call) => call[0] === true
        );
      expect(batchModeCall[1].timeoutMs).toBe(60000); // 1 minute timeout
      expect(batchModeCall[1].context).toBe('game-initialization');
    });

    it('should properly coordinate with existing batch operations', async () => {
      // This test verifies that SafeErrorLogger's withGameLoadingMode
      // works correctly for coordinating batch mode across operations

      // Arrange
      const safeErrorLogger = createSafeErrorLogger({
        logger: mockLogger,
        safeEventDispatcher: mockSafeEventDispatcher,
      });

      // Act
      const promise = safeErrorLogger.withGameLoadingMode(
        async () => {
          // Simulate some work
          return 'success';
        },
        {
          context: 'game-initialization',
          timeoutMs: 30000,
        }
      );

      // Assert
      await expect(promise).resolves.toBe('success');
      expect(mockSafeEventDispatcher.setBatchMode).toHaveBeenCalledWith(true, {
        maxRecursionDepth: 25,
        maxGlobalRecursion: 200,
        timeoutMs: 30000,
        context: 'game-initialization',
      });
    });
  });
});
