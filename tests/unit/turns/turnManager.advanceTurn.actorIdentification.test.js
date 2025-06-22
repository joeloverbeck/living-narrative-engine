// tests/turns/turnManager.advanceTurn.actorIdentification.test.js
// --- FILE START (Corrected) ---

import { afterEach, beforeEach, expect, test } from '@jest/globals';
import { describeRunningTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import {
  expectSystemErrorDispatch,
  triggerTurnEndedAndFlush,
} from '../../common/turns/turnManagerTestUtils.js';

import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { PLAYER_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { createMockEntity } from '../../common/mockFactories';
import {
  createAiActor,
  createPlayerActor,
} from '../../common/turns/testActors.js';
import { createMockTurnHandler } from '../../common/mockFactories.js';

// --- Test Suite ---

describeRunningTurnManagerSuite(
  'TurnManager: advanceTurn() - Actor Identification & Handling (Queue Not Empty)',
  (getBed) => {
    let testBed;
    let stopSpy;

    beforeEach(async () => {
      testBed = getBed();
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(
        createAiActor('initial-actor-for-start')
      );
      testBed.setupMockHandlerResolver();

      stopSpy = testBed.spyOnStop();
      stopSpy.mockImplementation(async () => {});

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.dispatcher.dispatch.mockResolvedValue(true);
    });

    afterEach(async () => {
      // Timer cleanup handled by BaseTestBed
    });

    test.each([
      ['player', createPlayerActor('player-1')],
      ['ai', createAiActor('ai-goblin')],
    ])(
      'actor identified (%s) -> handler invoked and event dispatched',
      async (_, actor) => {
        const entityType = actor.hasComponent(PLAYER_COMPONENT_ID)
          ? 'player'
          : 'ai';
        testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(actor);

        const mockHandler = createMockTurnHandler({ actor });
        testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
          mockHandler
        );

        await testBed.advanceAndFlush();

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

        await triggerTurnEndedAndFlush(testBed, actor.id);

        expect(mockHandler.destroy).toHaveBeenCalledTimes(1);

        // Timer cleanup handled by BaseTestBed
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
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(null);

      await testBed.turnManager.advanceTurn();

      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'Critical error during turn advancement logic',
          details: {
            error: expect.stringContaining(
              'Cannot start a new round: No active entities with an Actor component found.'
            ),
          },
        })
      );
      expectSystemErrorDispatch(
        testBed.mocks.dispatcher.dispatch,
        'System Error: No active actors found to start a round. Stopping game.',
        'Cannot start a new round: No active entities with an Actor component found.'
      );
      expect(stopSpy).toHaveBeenCalled();
    });

    test('Handler resolution error: logs error, stops manager', async () => {
      const resolveError = new Error('Handler resolution failed');
      testBed.mocks.turnHandlerResolver.resolveHandler.mockRejectedValue(
        resolveError
      );

      await testBed.turnManager.advanceTurn();

      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'System Error during turn advancement',
          details: {
            error: resolveError.message,
          },
        })
      );
      expectSystemErrorDispatch(
        testBed.mocks.dispatcher.dispatch,
        'System Error during turn advancement. Stopping game.',
        resolveError.message
      );
      expect(stopSpy).toHaveBeenCalled();
    });

    test('Handler startTurn error: logs error, stops manager', async () => {
      const startError = new Error('Handler start failed');
      const mockHandler = createMockTurnHandler();
      mockHandler.startTurn.mockRejectedValue(startError);
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
        mockHandler
      );

      await testBed.turnManager.advanceTurn();

      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'Error initiating turn for initial-actor-for-start',
          details: {
            error: startError.message,
            handlerName: expect.any(String),
          },
        })
      );
      expectSystemErrorDispatch(
        testBed.mocks.dispatcher.dispatch,
        'Error initiating turn for initial-actor-for-start.',
        startError.message
      );
      expect(stopSpy).not.toHaveBeenCalled();
    });
  }
);
// --- FILE END ---
