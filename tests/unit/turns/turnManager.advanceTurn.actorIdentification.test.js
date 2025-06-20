// tests/turns/turnManager.advanceTurn.actorIdentification.test.js
// --- FILE START (Corrected) ---

import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import {
  describeTurnManagerSuite,
  flushPromisesAndTimers,
} from '../../common/turns/turnManagerTestBed.js';

import { TURN_ENDED_ID } from '../../../src/constants/eventIds.js';
import { PLAYER_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { createMockEntity } from '../../common/mockFactories';
import {
  createAiActor,
  createPlayerActor,
} from '../../common/turns/testActors.js';

// --- Test Suite ---

describeTurnManagerSuite(
  'TurnManager: advanceTurn() - Actor Identification & Handling (Queue Not Empty)',
  (getBed) => {
    let testBed;
    let stopSpy;
    let turnEndCapture;

    beforeEach(async () => {
      testBed = getBed();

      testBed.initializeDefaultMocks();
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(
        createAiActor('initial-actor-for-start')
      );
      turnEndCapture = testBed.captureSubscription(TURN_ENDED_ID);
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue({
        startTurn: jest.fn().mockResolvedValue(undefined),
        destroy: jest.fn().mockResolvedValue(undefined),
      });

      stopSpy = jest
        .spyOn(testBed.turnManager, 'stop')
        .mockImplementation(async () => {});

      await testBed.startRunning();

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.dispatcher.dispatch.mockResolvedValue(true);
    });

    afterEach(async () => {
      if (stopSpy) {
        stopSpy.mockRestore();
      }
      turnEndCapture.unsubscribe.mockClear();
      jest.useRealTimers();
    });

    test.each([
      ['player', createPlayerActor('player-1')],
      ['ai', createAiActor('ai-goblin')],
    ])(
      'actor identified (%s) -> handler invoked and event dispatched',
      async (_, actor) => {
        jest.useFakeTimers();

        const entityType = actor.hasComponent(PLAYER_COMPONENT_ID)
          ? 'player'
          : 'ai';
        testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(actor);

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
            entityId: actor.id,
            entityType,
          }
        );
        expect(
          testBed.mocks.turnHandlerResolver.resolveHandler
        ).toHaveBeenCalledWith(actor);
        expect(mockHandler.startTurn).toHaveBeenCalledWith(actor);
        expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `TurnManager now WAITING for 'core:turn_ended' event.`
          )
        );
        expect(stopSpy).not.toHaveBeenCalled();

        expect(turnEndCapture.handler).toBeInstanceOf(Function);
        turnEndCapture.handler({
          type: TURN_ENDED_ID,
          payload: { entityId: actor.id, success: true },
        });

        await flushPromisesAndTimers();
        expect(mockHandler.destroy).toHaveBeenCalledTimes(1);

        jest.useRealTimers();
      }
    );

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

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(null);

      await testBed.turnManager.advanceTurn();

      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        'CRITICAL Error during turn advancement logic (before handler initiation): Cannot start a new round: No active entities with an Actor component found.',
        expect.any(Error)
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
