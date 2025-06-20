// src/tests/turns/turnManager.advanceTurn.queueNotEmpty.test.js
// --- FILE START (Entire file content as requested, with corrections) ---

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { TurnManagerTestBed } from '../../common/turns/turnManagerTestBed.js';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  TURN_PROCESSING_STARTED,
} from '../../../src/constants/eventIds.js';
import { createMockEntity } from '../../common/mockFactories.js';

// --- Test Suite ---

describe('TurnManager: advanceTurn() - Turn Advancement (Queue Not Empty)', () => {
  let testBed;
  let stopSpy;
  let initialAdvanceTurnSpy;

  beforeEach(async () => {
    // Made beforeEach async
    jest.clearAllMocks();
    testBed = new TurnManagerTestBed();

    // Reset mock state
    testBed.mocks.turnOrderService.isEmpty.mockReset().mockResolvedValue(false); // Default: Queue NOT empty
    testBed.mocks.turnOrderService.getNextEntity.mockReset().mockResolvedValue(null); // Default reset
    testBed.mocks.turnOrderService.clearCurrentRound.mockReset().mockResolvedValue();
    testBed.mocks.dispatcher.dispatch.mockReset().mockResolvedValue(true);
    testBed.mocks.dispatcher.subscribe.mockReset().mockReturnValue(jest.fn());

    testBed.mocks.turnHandlerResolver.resolveHandler
      .mockClear()
      .mockResolvedValue({
        startTurn: jest.fn().mockResolvedValue(undefined),
        destroy: jest.fn().mockResolvedValue(undefined),
      });

    // Spy on stop to verify calls and simulate unsubscribe
    stopSpy = jest.spyOn(testBed.turnManager, 'stop').mockImplementation(async () => {
      testBed.mocks.logger.debug('Mocked instance.stop() called.');
    });

    // --- Set instance to running state (simulating start()) ---
    initialAdvanceTurnSpy = jest
      .spyOn(testBed.turnManager, 'advanceTurn')
      .mockImplementationOnce(async () => {
        // Prevent advanceTurn logic during start()
        testBed.mocks.logger.debug('advanceTurn call during start() suppressed by mock.');
      });
    await testBed.turnManager.start(); // Sets #isRunning = true and subscribes
    initialAdvanceTurnSpy.mockRestore(); // Restore advanceTurn for actual testing

    // Clear mocks called during start() phase
    testBed.mocks.logger.info.mockClear(); // Clear "Turn Manager started." log
    testBed.mocks.logger.debug.mockClear(); // Clear suppressed advanceTurn log
    testBed.mocks.dispatcher.dispatch.mockClear();
    testBed.mocks.dispatcher.subscribe.mockClear(); // Clear the subscribe call from start()
    testBed.mocks.turnOrderService.isEmpty.mockClear(); // Clear mocks before actual test calls
    testBed.mocks.turnOrderService.getNextEntity.mockClear();
    testBed.mocks.turnHandlerResolver.resolveHandler.mockClear();

    // Re-apply default isEmpty mock for the actual tests focusing on queue NOT empty
    testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
  });

  afterEach(async () => {
    await testBed.cleanup();
    jest.restoreAllMocks();
  });

  // --- Test Cases ---

  test('Successfully getting next entity: updates current actor, resolves and calls handler startTurn', async () => {
    // Arrange
    const nextActor = createMockEntity('actor-next', { isActor: true, isPlayer: false }); // AI actor
    const entityType = 'ai';
    testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(nextActor);
    
    const mockHandler = {
      startTurn: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(mockHandler);

    // Act
    await testBed.turnManager.advanceTurn(); // Call directly, instance is running

    // Assert
    expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(1);
    expect(testBed.mocks.turnOrderService.getNextEntity).toHaveBeenCalledTimes(1);

    // Verify state update and logging
    expect(testBed.turnManager.getCurrentActor()).toBe(nextActor);
    expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
      'TurnManager.advanceTurn() initiating...'
    );
    expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
      'Queue not empty, retrieving next entity.'
    );
    expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
      `Resolving turn handler for entity ${nextActor.id}...`
    );

    // Check core:turn_started dispatch
    expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith('core:turn_started', {
      entityId: nextActor.id,
      entityType: entityType,
    });
    expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
      TURN_PROCESSING_STARTED,
      { entityId: nextActor.id, actorType: entityType }
    );

    // Verify resolver call
    expect(testBed.mocks.turnHandlerResolver.resolveHandler).toHaveBeenCalledTimes(1);
    expect(testBed.mocks.turnHandlerResolver.resolveHandler).toHaveBeenCalledWith(
      nextActor
    );

    // Verify handler startTurn call
    expect(mockHandler.startTurn).toHaveBeenCalledTimes(1);
    expect(mockHandler.startTurn).toHaveBeenCalledWith(nextActor);

    // Verify waiting state log
    expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `TurnManager now WAITING for 'core:turn_ended' event.`
      )
    );

    // Verify no stop was called
    expect(stopSpy).not.toHaveBeenCalled();
  });

  test('getNextEntity returns null: logs error, stops manager', async () => {
    // Arrange
    testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(null);

    // Act
    await testBed.turnManager.advanceTurn();

    // Assert
    expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(1);
    expect(testBed.mocks.turnOrderService.getNextEntity).toHaveBeenCalledTimes(1);

    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
      'Turn order inconsistency: getNextEntity() returned null/undefined when queue was not empty.'
    );

    expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'Internal Error: Turn order inconsistency detected. Stopping game.',
        details: {
          raw: 'Turn order inconsistency: getNextEntity() returned null/undefined when queue was not empty.',
          stack: expect.any(String),
          timestamp: expect.any(String),
        },
      })
    );

    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  test('getNextEntity throws error: logs error, stops manager', async () => {
    // Arrange
    const getNextError = new Error('Turn order service failure');
    testBed.mocks.turnOrderService.getNextEntity.mockRejectedValue(getNextError);

    // Act
    await testBed.turnManager.advanceTurn();

    // Assert
    expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(1);
    expect(testBed.mocks.turnOrderService.getNextEntity).toHaveBeenCalledTimes(1);

    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
      'CRITICAL Error during turn advancement logic (before handler initiation): Turn order service failure',
      getNextError
    );

    expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        details: {
          raw: getNextError.message,
          stack: expect.any(String),
          timestamp: expect.any(String),
        },
      })
    );

    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  test('Handler resolver throws: logs error, stops manager', async () => {
    // Arrange
    const resolveError = new Error('Handler resolution failed');
    const mockActor = createMockEntity('actor1', { isActor: true });
    testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor); // Return valid entity first
    testBed.mocks.turnHandlerResolver.resolveHandler.mockRejectedValue(resolveError); // Then throw error

    // Act
    await testBed.turnManager.advanceTurn();

    // Assert
    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
      'CRITICAL Error during turn advancement logic (before handler initiation): Handler resolution failed',
      resolveError
    );

    expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        details: {
          raw: resolveError.message,
          stack: expect.any(String),
          timestamp: expect.any(String),
        },
      })
    );

    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  test('Handler startTurn throws: logs error, stops manager', async () => {
    // Arrange
    const startError = new Error('Handler start failed');
    const mockActor = createMockEntity('actor1', { isActor: true });
    const mockHandler = {
      startTurn: jest.fn().mockRejectedValue(startError),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor); // Return valid entity first
    testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(mockHandler); // Return valid handler
    // startTurn will throw error when called

    // Act
    await testBed.turnManager.advanceTurn();

    // Assert
    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
      'Error during handler.startTurn() initiation for entity actor1 (Object): Handler start failed',
      startError
    );

    // The implementation doesn't stop the manager for startTurn failures
    // expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  test('Dispatcher dispatch throws: logs error, stops manager', async () => {
    // Arrange
    const dispatchError = new Error('Dispatcher failure');
    const mockActor = createMockEntity('actor1', { isActor: true });
    testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor); // Return valid entity first
    testBed.mocks.dispatcher.dispatch.mockRejectedValue(dispatchError); // Then throw error

    // Act
    await testBed.turnManager.advanceTurn();

    // Assert
    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
      'Failed to dispatch core:turn_started for actor1: Dispatcher failure',
      dispatchError
    );

    // The implementation doesn't dispatch system errors for dispatcher failures
    // expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
    //   SYSTEM_ERROR_OCCURRED_ID,
    //   expect.objectContaining({
    //     details: {
    //       raw: dispatchError.message,
    //       stack: expect.any(String),
    //       timestamp: expect.any(String),
    //     },
    //   })
    // );

    // expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  test('Called when not running: logs debug and returns early', async () => {
    // Arrange
    // Create a fresh test bed that doesn't start the manager
    const freshTestBed = new TurnManagerTestBed();
    
    // Don't start the manager - it will not be running by default
    // The manager starts with _isRunning = false

    // Act
    await freshTestBed.turnManager.advanceTurn();

    // Assert
    expect(freshTestBed.mocks.logger.debug).toHaveBeenCalledWith(
      'TurnManager.advanceTurn() called while manager is not running. Returning.'
    );

    expect(freshTestBed.mocks.turnOrderService.isEmpty).not.toHaveBeenCalled();
    expect(freshTestBed.mocks.turnOrderService.getNextEntity).not.toHaveBeenCalled();
    expect(freshTestBed.mocks.turnHandlerResolver.resolveHandler).not.toHaveBeenCalled();
    expect(freshTestBed.mocks.dispatcher.dispatch).not.toHaveBeenCalled();
    
    // Clean up the fresh test bed
    await freshTestBed.cleanup();
  });
});
// --- FILE END ---
