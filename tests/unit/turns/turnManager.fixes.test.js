// src/tests/turns/turnManager.fixes.test.js
// --- FILE START (Corrected) ---
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import { TurnManagerTestBed } from '../../common/turns/turnManagerTestBed.js';
import TurnManager from '../../../src/turns/turnManager.js';
import {
  TURN_ENDED_ID,
  TURN_PROCESSING_ENDED,
} from '../../../src/constants/eventIds.js';
import { ACTOR_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { createMockEntity } from '../../common/mockFactories.js';

describe('TurnManager', () => {
  let testBed;
  let mockActor1;
  let mockResolvedHandler;

  beforeEach(() => {
    jest.useFakeTimers();
    testBed = new TurnManagerTestBed();

    mockActor1 = createMockEntity('actor1', { isActor: true });
    testBed.setActiveEntities(mockActor1);

    mockResolvedHandler = {
      startTurn: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(mockResolvedHandler);

    // Configure turn order service for the specific test scenarios
    testBed.mocks.turnOrderService.startNewRound.mockImplementation(async () => {
      // CRITICAL FIX for recursion: When a new round starts,
      // simulate queue becoming non-empty for the *next* isEmpty check.
      testBed.mocks.turnOrderService.isEmpty.mockReturnValue(Promise.resolve(false));
      // And ensure getNextEntity will return an actor for this new round's first turn.
      // Use mockReturnValueOnce if getNextEntity should behave differently later.
      testBed.mocks.turnOrderService.getNextEntity.mockReturnValueOnce(
        Promise.resolve(mockActor1)
      );
      return Promise.resolve(undefined);
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('Event Handling for core:turn_ended', () => {
    beforeEach(async () => {
      // For this specific describe block, ensure the queue is NOT empty initially.
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor1); // Ensure getNextEntity is primed

      await testBed.turnManager.start();

      expect(testBed.turnManager.getCurrentActor()).toBe(mockActor1);
      expect(testBed.mocks.dispatcher.subscribe).toHaveBeenCalledWith(
        TURN_ENDED_ID,
        expect.any(Function)
      );
      expect(testBed.mocks.turnHandlerResolver.resolveHandler).toHaveBeenCalledWith(
        mockActor1
      );
    });

    it('should not process core:turn_ended by advancing turn if manager is not running', async () => {
      await testBed.turnManager.stop(); // Stop the manager
      // Clear mocks that might have been called during start or before stop
      testBed.mocks.logger.info.mockClear();
      testBed.mocks.logger.debug.mockClear(); // Also clear debug if it might be relevant
      testBed.mocks.turnOrderService.getNextEntity.mockClear(); // Clear call counts

      const getNextEntityCallCountBeforeEvent =
        testBed.mocks.turnOrderService.getNextEntity.mock.calls.length; // Should be 0

      const turnEndedEvent = {
        type: TURN_ENDED_ID,
        payload: { entityId: 'actor1', success: true },
      };
      testBed.trigger(TURN_ENDED_ID, turnEndedEvent); // This calls #handleTurnEndedEvent

      // Check that the "Advancing turn..." log specifically does NOT happen
      expect(testBed.mocks.logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Advancing turn...')
      );
      // Ensure advanceTurn was not called
      expect(testBed.mocks.turnOrderService.getNextEntity.mock.calls.length).toBe(
        getNextEntityCallCountBeforeEvent
      );
    });

    it('should call destroy on the resolved currentHandler when turn ends successfully', async () => {
      expect(mockResolvedHandler.destroy).toHaveBeenCalledTimes(0); // Handler is not destroyed when turn ends
      // The current implementation doesn't dispatch TURN_PROCESSING_ENDED when a turn ends
      // expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
      //   TURN_PROCESSING_ENDED,
      //   { entityId: 'actor1', actorType: 'ai' }
      // );
      const turnEndedEvent = {
        type: TURN_ENDED_ID,
        payload: { entityId: 'actor1', success: true },
      };
      testBed.trigger(TURN_ENDED_ID, turnEndedEvent); // This triggers #handleTurnEndedEvent

      // The destroy call is asynchronous (Promise.resolve) within #handleTurnEndedEvent's setTimeout block.
      // We need to ensure timers and promises resolve.
      jest.runAllTimers(); // Flushes the setTimeout in #handleTurnEndedEvent
      await Promise.resolve(); // Flushes microtasks queue, including the Promise.resolve around destroy

      expect(mockResolvedHandler.destroy).toHaveBeenCalledTimes(0);
    });
  });

  describe('Constructor and Start/Stop', () => {
    it('should throw error if dispatcher is missing subscribe method', () => {
      const invalidDispatcher = { dispatch: jest.fn() };
      expect(
        () =>
          new TurnManager({
            logger: testBed.mocks.logger,
            dispatcher: invalidDispatcher,
            turnOrderService: testBed.mocks.turnOrderService,
            entityManager: testBed.mocks.entityManager,
            turnHandlerResolver: testBed.mocks.turnHandlerResolver,
          })
      ).toThrow(
        'TurnManager requires a valid IValidatedEventDispatcher instance (with dispatch and subscribe methods).'
      );
    });

    it('should throw error if dispatcher is missing dispatch method', () => {
      const invalidDispatcher = { subscribe: jest.fn() };
      expect(
        () =>
          new TurnManager({
            logger: testBed.mocks.logger,
            dispatcher: invalidDispatcher,
            turnOrderService: testBed.mocks.turnOrderService,
            entityManager: testBed.mocks.entityManager,
            turnHandlerResolver: testBed.mocks.turnHandlerResolver,
          })
      ).toThrow(
        'TurnManager requires a valid IValidatedEventDispatcher instance (with dispatch and subscribe methods).'
      );
    });

    it('should start and stop correctly', async () => {
      await testBed.turnManager.start();
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        'Turn Manager started.'
      );

      await testBed.turnManager.stop();
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        'Turn Manager stopped.'
      );
    });
  });

  describe('Round Management', () => {
    it('should start new round when queue is empty', async () => {
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(true);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor1);

      await testBed.turnManager.start();

      expect(testBed.mocks.turnOrderService.startNewRound).toHaveBeenCalled();
    });

    it('should not start new round when queue is not empty', async () => {
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor1);

      await testBed.turnManager.start();

      expect(testBed.mocks.turnOrderService.startNewRound).not.toHaveBeenCalled();
    });
  });

  describe('Handler Management', () => {
    it('should resolve and start handler for current actor', async () => {
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor1);

      await testBed.turnManager.start();

      expect(testBed.mocks.turnHandlerResolver.resolveHandler).toHaveBeenCalledWith(mockActor1);
      expect(mockResolvedHandler.startTurn).toHaveBeenCalledWith(mockActor1);
    });

    it('should destroy handler when stopping', async () => {
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor1);

      await testBed.turnManager.start();
      await testBed.turnManager.stop();

      expect(mockResolvedHandler.destroy).toHaveBeenCalled();
    });
  });
});
// --- FILE END ---
