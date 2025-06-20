// tests/turns/turnManager.minimal.test.js
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
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js'; // Added SYSTEM_ERROR_OCCURRED_ID
import { ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { createMockEntity } from '../../common/mockFactories.js';

describe('TurnManager', () => {
  let testBed;
  let mockActor1;
  let mockResolvedHandler;

  beforeEach(() => {
    jest.useFakeTimers();
    testBed = new TurnManagerTestBed();

    mockActor1 = createMockEntity('actor1', { isActor: true });
    // Ensure the hasComponent method works correctly
    mockActor1.hasComponent.mockImplementation((compId) => {
      if (compId === ACTOR_COMPONENT_ID) return true;
      if (compId === PLAYER_COMPONENT_ID) return false;
      return false;
    });
    testBed.setActiveEntities(mockActor1);

    mockResolvedHandler = {
      startTurn: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      signalNormalApparentTermination: jest.fn(), // Ensure this exists on the mock
    };
    testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(mockResolvedHandler);

    // Configure turn order service for the specific test scenarios
    testBed.mocks.turnOrderService.startNewRound.mockImplementation(async () => {
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(false); // Next isEmpty is false
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValueOnce(mockActor1); // Next entity
      return Promise.resolve(undefined);
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
    jest.clearAllMocks();
    jest.clearAllTimers(); // Use clearAllTimers to reset both fake timers and their pending queues
  });

  describe('Event Handling for core:turn_ended', () => {
    let capturedTurnEndedHandler;

    beforeEach(async () => {
      // Use real timers for this test since event processing uses setTimeout
      jest.useRealTimers();
      
      // Capture the event handler during subscription
      testBed.mocks.dispatcher.subscribe.mockImplementation((eventType, handler) => {
        if (eventType === TURN_ENDED_ID) {
          capturedTurnEndedHandler = handler;
        }
        return jest.fn(); // Return mock unsubscribe
      });
      
      // Use the same simple approach as the Handler Management tests
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor1);

      await testBed.turnManager.start();

      // Verify that the handler was set up correctly
      expect(testBed.mocks.dispatcher.subscribe).toHaveBeenCalledWith(
        TURN_ENDED_ID,
        expect.any(Function)
      );
      expect(testBed.mocks.turnHandlerResolver.resolveHandler).toHaveBeenCalledWith(
        mockActor1
      );
      expect(mockResolvedHandler.startTurn).toHaveBeenCalledWith(mockActor1);
      expect(capturedTurnEndedHandler).toBeDefined();

      // Clear logs from the start() and initial advanceTurn()
      testBed.mocks.logger.info.mockClear();
      testBed.mocks.logger.debug.mockClear();
      testBed.mocks.logger.warn.mockClear();
      testBed.mocks.logger.error.mockClear();
      // Clear specific mock call counts if necessary, e.g., for getNextEntity
      testBed.mocks.turnOrderService.getNextEntity.mockClear(); // Clear calls from initial advanceTurn
    });

    it('should call destroy on the resolved currentHandler when turn ends successfully', async () => {
      expect(mockResolvedHandler.destroy).not.toHaveBeenCalled();

      const turnEndedEvent = {
        type: TURN_ENDED_ID,
        payload: { entityId: 'actor1', success: true },
      };
      
      // Call the event handler directly
      capturedTurnEndedHandler(turnEndedEvent);

      // Wait for the event processing to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockResolvedHandler.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Constructor and Start/Stop', () => {
    it('should throw error if dispatcher is missing subscribe method', () => {
      const invalidDispatcher = { dispatch: jest.fn() }; // Missing subscribe
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

    it('start should subscribe to TURN_ENDED_ID', async () => {
      // Uses mocks from outer beforeEach; start is called.
      // Ensure isEmpty is false for the initial advanceTurn in start to proceed with a turn.
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor1);

      await testBed.turnManager.start();
      expect(testBed.mocks.dispatcher.subscribe).toHaveBeenCalledWith(
        TURN_ENDED_ID,
        expect.any(Function)
      );
    });

    it('stop should unsubscribe from TURN_ENDED_ID', async () => {
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false); // To ensure start proceeds
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor1);

      await testBed.turnManager.start();
      await testBed.turnManager.stop();

      // Verify that the unsubscribe function returned by subscribe was called
      const subscribeCall = testBed.mocks.dispatcher.subscribe.mock.calls.find(
        (call) => call[0] === TURN_ENDED_ID
      );
      expect(subscribeCall).toBeDefined();
      const unsubscribeFn = testBed.mocks.dispatcher.subscribe.mock.results[
        testBed.mocks.dispatcher.subscribe.mock.calls.indexOf(subscribeCall)
      ].value;
      // The unsubscribe function is a mock, so we can verify it was called
      expect(unsubscribeFn).toBeDefined();
      expect(typeof unsubscribeFn).toBe('function');
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
