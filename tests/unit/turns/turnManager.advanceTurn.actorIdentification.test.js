// tests/turns/turnManager.advanceTurn.actorIdentification.test.js
// --- FILE START (Corrected) ---

import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { describeTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { TURN_ENDED_ID } from '../../../src/constants/eventIds.js';
import { createMockEntity } from '../../common/mockFactories.js';

// --- Test Suite ---

describeTurnManagerSuite(
  'TurnManager: advanceTurn() - Actor Identification & Handling (Queue Not Empty)',
  (getBed) => {
    let testBed;
    let stopSpy;
    let capturedTurnEndedHandler;

    beforeEach(async () => {
      jest.clearAllMocks();
      capturedTurnEndedHandler = null;
      testBed = getBed();

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(
        createMockEntity('initial-actor-for-start', {
          isActor: true,
          isPlayer: false,
        })
      );

      testBed.mocks.dispatcher.dispatch.mockClear().mockResolvedValue(true);
      testBed.mocks.dispatcher.subscribe
        .mockClear()
        .mockImplementation((eventType, handler) => {
          if (eventType === TURN_ENDED_ID) {
            capturedTurnEndedHandler = handler;
          }
          return jest.fn(); // Return mock unsubscribe
        });
      testBed.mocks.turnOrderService.clearCurrentRound.mockResolvedValue();

      // Set default resolution for the resolver
      testBed.mocks.turnHandlerResolver.resolveHandler
        .mockClear()
        .mockResolvedValue({
          startTurn: jest.fn().mockResolvedValue(undefined),
          destroy: jest.fn().mockResolvedValue(undefined),
        });

      stopSpy = jest
        .spyOn(testBed.turnManager, 'stop')
        .mockImplementation(async () => {});

      await testBed.turnManager.start();

      expect(capturedTurnEndedHandler).toBeInstanceOf(Function);

      testBed.mocks.logger.info.mockClear();
      testBed.mocks.logger.debug.mockClear();
      testBed.mocks.logger.warn.mockClear();
      testBed.mocks.logger.error.mockClear();
      testBed.mocks.dispatcher.dispatch.mockClear();
      testBed.mocks.turnOrderService.isEmpty.mockClear();
      testBed.mocks.turnOrderService.getNextEntity.mockClear();
      testBed.mocks.turnHandlerResolver.resolveHandler.mockClear();

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.dispatcher.dispatch.mockResolvedValue(true);
    });

    afterEach(async () => {
      if (stopSpy) {
        stopSpy.mockRestore();
      }
      capturedTurnEndedHandler = null;
      jest.useRealTimers();
    });

    test('Player actor identified: resolves handler, calls startTurn, dispatches event', async () => {
      jest.useFakeTimers();

      const playerActor = createMockEntity('player-1', {
        isActor: true,
        isPlayer: true,
      });
      const entityType = 'player';
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(
        playerActor
      );

      const mockHandler = {
        startTurn: jest.fn().mockResolvedValue(undefined),
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
        mockHandler
      );

      await testBed.turnManager.advanceTurn();

      expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(1);
      expect(
        testBed.mocks.turnOrderService.getNextEntity
      ).toHaveBeenCalledTimes(1);
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        'core:turn_started',
        {
          entityId: playerActor.id,
          entityType: entityType,
        }
      );
      expect(
        testBed.mocks.turnHandlerResolver.resolveHandler
      ).toHaveBeenCalledWith(playerActor);
      expect(mockHandler.startTurn).toHaveBeenCalledWith(playerActor);
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `TurnManager now WAITING for 'core:turn_ended' event.`
        )
      );
      expect(stopSpy).not.toHaveBeenCalled();

      expect(capturedTurnEndedHandler).toBeInstanceOf(Function);
      capturedTurnEndedHandler({
        type: TURN_ENDED_ID,
        payload: { entityId: playerActor.id, success: true },
      });

      await jest.runAllTimersAsync();
      expect(mockHandler.destroy).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    test('AI actor identified: resolves handler, calls startTurn, dispatches event', async () => {
      jest.useFakeTimers();

      const aiActor = createMockEntity('ai-goblin', {
        isActor: true,
        isPlayer: false,
      });
      const entityType = 'ai';
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(aiActor);

      const mockHandler = {
        startTurn: jest.fn().mockResolvedValue(undefined),
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
        mockHandler
      );

      await testBed.turnManager.advanceTurn();

      expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(1);
      expect(
        testBed.mocks.turnOrderService.getNextEntity
      ).toHaveBeenCalledTimes(1);
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        'core:turn_started',
        {
          entityId: aiActor.id,
          entityType: entityType,
        }
      );
      expect(
        testBed.mocks.turnHandlerResolver.resolveHandler
      ).toHaveBeenCalledWith(aiActor);
      expect(mockHandler.startTurn).toHaveBeenCalledWith(aiActor);
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `TurnManager now WAITING for 'core:turn_ended' event.`
        )
      );
      expect(stopSpy).not.toHaveBeenCalled();

      expect(capturedTurnEndedHandler).toBeInstanceOf(Function);
      capturedTurnEndedHandler({
        type: TURN_ENDED_ID,
        payload: { entityId: aiActor.id, success: true },
      });

      await jest.runAllTimersAsync();
      expect(mockHandler.destroy).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    test('Non-actor entity: logs warning, does not resolve handler or dispatch events', async () => {
      const nonActor = createMockEntity('non-actor', {
        isActor: false,
        isPlayer: false,
      });
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(nonActor);

      await testBed.turnManager.advanceTurn();

      expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(1);
      expect(
        testBed.mocks.turnOrderService.getNextEntity
      ).toHaveBeenCalledTimes(1);
      expect(
        testBed.mocks.turnHandlerResolver.resolveHandler
      ).toHaveBeenCalledTimes(0);
      expect(testBed.mocks.dispatcher.dispatch).not.toHaveBeenCalledWith(
        'core:turn_started',
        expect.any(Object)
      );
      expect(stopSpy).not.toHaveBeenCalled();
    });

    test('Entity manager error: logs error, stops manager', async () => {
      const entityError = new Error('Entity not found');
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(null);

      await testBed.turnManager.advanceTurn();

      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        'Turn order inconsistency: getNextEntity() returned null/undefined when queue was not empty.'
      );
      expect(stopSpy).toHaveBeenCalled();
    });

    test('Handler resolution error: logs error, stops manager', async () => {
      const resolveError = new Error('Handler resolution failed');
      testBed.mocks.turnHandlerResolver.resolveHandler.mockRejectedValue(
        resolveError
      );

      await testBed.turnManager.advanceTurn();

      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        'CRITICAL Error during turn advancement logic (before handler initiation): Handler resolution failed',
        resolveError
      );
      expect(stopSpy).toHaveBeenCalled();
    });

    test('Handler startTurn error: logs error, stops manager', async () => {
      const startError = new Error('Handler start failed');
      const mockHandler = {
        startTurn: jest.fn().mockRejectedValue(startError),
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
        mockHandler
      );

      await testBed.turnManager.advanceTurn();

      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error during handler.startTurn() initiation for entity initial-actor-for-start (Object): Handler start failed'
        ),
        startError
      );
      expect(stopSpy).not.toHaveBeenCalled();
    });
  }
);
// --- FILE END ---
