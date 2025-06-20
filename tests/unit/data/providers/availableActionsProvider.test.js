/**
 * @file Test suite for AvailableActionsProvider.
 * @see tests/data/providers/availableActionsProvider.test.js
 */

import {
  jest,
  describe,
  beforeEach,
  test,
  expect,
  afterEach,
} from '@jest/globals';
import { AvailableActionsProvider } from '../../../../src/data/providers/availableActionsProvider.js';
import { POSITION_COMPONENT_ID } from '../../../../src/constants/componentIds.js';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../../../src/constants/core.js';

// --- Mock Implementations ---

const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

class MockEntity {
  constructor(id, componentsData = {}) {
    this.id = id;
    this._componentsData = componentsData;
    this.getComponentData = jest.fn((compId) => this._componentsData[compId]);
  }
}

const mockEntityManager = () => ({
  getEntityInstance: jest.fn(),
});

const mockActionDiscoveryService = () => ({
  getValidActions: jest.fn(),
});

const mockActionIndexer = () => ({
  index: jest.fn(),
});

// --- Test Suite ---

describe('AvailableActionsProvider', () => {
  // The System Under Test (SUT)
  let provider;

  // Mocks for all dependencies
  let logger;
  let mockActor;
  let entityManager;
  let actionDiscoveryService;
  let actionIndexer;

  beforeEach(() => {
    // 1. Arrange: Instantiate all mocks
    logger = mockLogger();
    entityManager = mockEntityManager();
    actionDiscoveryService = mockActionDiscoveryService();
    actionIndexer = mockActionIndexer();

    mockActor = new MockEntity('actor-1', {
      [POSITION_COMPONENT_ID]: { locationId: 'location-1' },
    });

    // 2. Arrange: Instantiate the SUT with mocked dependencies
    provider = new AvailableActionsProvider({
      actionDiscoveryService,
      actionIndexingService: actionIndexer,
      entityManager,
    });

    // 3. Arrange: Set default behaviors for mocks
    const mockLocationEntity = new MockEntity('location-1');
    entityManager.getEntityInstance.mockResolvedValue(mockLocationEntity);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should create an instance when all dependencies are provided', () => {
      expect(provider).toBeInstanceOf(AvailableActionsProvider);
    });
  });

  // --- Feature Tests based on Ticket ---
  describe('Feature: Action List Provision', () => {
    const turnContext1 = { game: { worldId: 'test-world-1', turn: 1 } };
    const turnContext2 = { game: { worldId: 'test-world-1', turn: 2 } };

    test('AC1: should return the same cached list when get() is called twice in the same turn', async () => {
      // Arrange: Set up the expected data flow for the first call
      const discoveredActions = [
        {
          id: 'core:wait',
          command: 'wait command',
          params: {},
          description: 'Wait a turn',
        },
      ];
      const indexedActions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait command',
          params: {},
          description: 'Wait a turn',
        },
      ];
      actionDiscoveryService.getValidActions.mockResolvedValue(
        discoveredActions
      );
      actionIndexer.index.mockReturnValue(indexedActions);

      // Act: Call the provider twice within the same turn context
      const result1 = await provider.get(mockActor, turnContext1, logger);
      const result2 = await provider.get(mockActor, turnContext1, logger);

      // Assert: Verify that caching prevented redundant service calls
      expect(actionDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);
      expect(actionIndexer.index).toHaveBeenCalledTimes(1);
      expect(result1).toBe(indexedActions); // Should be the exact same object from cache
      expect(result2).toBe(indexedActions);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Cache Hit]')
      );
    });

    test('AC2: should re-index actions and restart indices in a new turn', async () => {
      // Arrange: Mock services for two separate turns
      const discoveredActions = [
        { id: 'core:wait', command: 'wait command', description: 'desc' },
      ];
      actionDiscoveryService.getValidActions.mockResolvedValue(
        discoveredActions
      );
      // The indexing service will be called for each turn, returning a fresh list
      actionIndexer.index
        .mockReturnValueOnce([
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait command',
            description: 'desc',
            params: {},
          },
        ]) // Turn 1
        .mockReturnValueOnce([
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait command',
            description: 'desc',
            params: {},
          },
        ]); // Turn 2 (indices restart)

      // Act: Call the provider across two different turn contexts
      await provider.get(mockActor, turnContext1, logger);
      await provider.get(mockActor, turnContext2, logger);

      // Assert: Verify the cache was flushed and services were called again
      expect(logger.debug).toHaveBeenCalledWith(
        'New turn detected. Clearing AvailableActionsProvider cache.'
      );
      expect(actionDiscoveryService.getValidActions).toHaveBeenCalledTimes(2);
      expect(actionIndexer.index).toHaveBeenCalledTimes(2);
    });

    test('AC3: should cap the action list and log a warning on overflow', async () => {
      // Arrange: Discover more actions than the allowed maximum
      const requestedCount = MAX_AVAILABLE_ACTIONS_PER_TURN + 5;
      const discoveredActions = Array.from(
        { length: requestedCount },
        (_, i) => ({
          id: `action-${i}`,
          command: `command-${i}`,
          params: { p: i },
          description: `desc-${i}`,
        })
      );
      // Mock the indexing service to return a capped list
      const cappedActions = discoveredActions
        .slice(0, MAX_AVAILABLE_ACTIONS_PER_TURN)
        .map((a, i) => ({
          index: i + 1,
          actionId: a.id,
          commandString: a.command,
          params: a.params,
          description: a.description,
        }));

      actionDiscoveryService.getValidActions.mockResolvedValue(
        discoveredActions
      );
      actionIndexer.index.mockReturnValue(cappedActions);

      // Act
      const result = await provider.get(mockActor, turnContext1, logger);

      // Assert: Verify the list is capped and a warning was logged
      expect(result.length).toBe(MAX_AVAILABLE_ACTIONS_PER_TURN);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        `[Overflow] actor=${mockActor.id} requested=${requestedCount} capped=${MAX_AVAILABLE_ACTIONS_PER_TURN}`
      );
    });

    test('AC4: should suppress duplicate actions from the final list', async () => {
      // Arrange: Discover a list containing duplicate actions
      const duplicateDiscoveredActions = [
        {
          id: 'core:attack',
          command: 'attack goblin',
          params: { targetId: 'goblin-1' },
          description: 'Attack the goblin',
        },
        {
          id: 'core:wait',
          command: 'wait',
          params: {},
          description: 'Wait a turn',
        },
        {
          id: 'core:attack',
          command: 'attack goblin',
          params: { targetId: 'goblin-1' },
          description: 'Attack the goblin',
        }, // Duplicate
      ];
      // Mock the indexing service to return the de-duplicated and indexed list
      const dedupedIndexedActions = [
        {
          index: 1,
          actionId: 'core:attack',
          commandString: 'attack goblin',
          params: { targetId: 'goblin-1' },
          description: 'Attack the goblin',
        },
        {
          index: 2,
          actionId: 'core:wait',
          commandString: 'wait',
          params: {},
          description: 'Wait a turn',
        },
      ];
      actionDiscoveryService.getValidActions.mockResolvedValue(
        duplicateDiscoveredActions
      );
      actionIndexer.index.mockReturnValue(dedupedIndexedActions);

      // Act
      const result = await provider.get(mockActor, turnContext1, logger);

      // Assert: Verify the final list is de-duplicated
      expect(result.length).toBe(2);
      expect(actionIndexer.index).toHaveBeenCalledWith(
        duplicateDiscoveredActions,
        'actor-1'
      );
      expect(result).toEqual(dedupedIndexedActions);
    });
  });

  // --- General & Error Case Tests ---
  describe('General Behavior', () => {
    const turnContext = { game: { worldId: 'test-world-1' } };

    test('should return an empty array and log an error if action discovery fails', async () => {
      // Arrange
      const discoveryError = new Error('Discovery Service Offline');
      actionDiscoveryService.getValidActions.mockRejectedValue(discoveryError);

      // Act
      const result = await provider.get(mockActor, turnContext, logger);

      // Assert
      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Error discovering/indexing actions for ${mockActor.id}`
        ),
        discoveryError
      );
      expect(actionIndexer.index).not.toHaveBeenCalled();
    });

    test('should NOT log an overflow warning if list is reduced but not capped', async () => {
      // Arrange
      const discoveredCount = MAX_AVAILABLE_ACTIONS_PER_TURN + 5;
      const finalCount = MAX_AVAILABLE_ACTIONS_PER_TURN - 5; // De-duplicated below cap

      const discoveredActions = Array.from(
        { length: discoveredCount },
        (_, i) => ({
          id: `action-${i}`,
          command: `command-${i}`,
          params: {},
          description: `desc-${i}`,
        })
      );
      const reducedActions = discoveredActions
        .slice(0, finalCount)
        .map((a, i) => ({
          index: i + 1,
          actionId: a.id,
          commandString: a.command,
          params: a.params,
          description: a.description,
        }));

      actionDiscoveryService.getValidActions.mockResolvedValue(
        discoveredActions
      );
      actionIndexer.index.mockReturnValue(reducedActions);

      // Act
      await provider.get(mockActor, turnContext, logger);

      // Assert
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
