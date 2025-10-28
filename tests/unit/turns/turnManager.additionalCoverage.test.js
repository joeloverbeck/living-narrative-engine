import { jest, expect, test } from '@jest/globals';
import { describeTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import {
  TURN_ENDED_ID,
  TURN_PROCESSING_ENDED,
} from '../../../src/constants/eventIds.js';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
  PLAYER_TYPE_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';
import { createMockEntity } from '../../common/mockFactories';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => {
  const actual = jest.requireActual(
    '../../../src/utils/safeDispatchErrorUtils.js'
  );
  return {
    ...actual,
    safeDispatchError: jest.fn(actual.safeDispatchError),
  };
});

const createLegacyPlayerActor = (id) => ({
  id,
  hasComponent: jest.fn((componentId) => {
    if (componentId === ACTOR_COMPONENT_ID) return true;
    if (componentId === PLAYER_COMPONENT_ID) return true;
    if (componentId === PLAYER_TYPE_COMPONENT_ID) return false;
    return false;
  }),
  getComponentData: jest.fn((componentId) => {
    if (componentId === PLAYER_COMPONENT_ID) {
      return {};
    }
    return null;
  }),
});

const drainTimersAndMicrotasks = async (iterations = 3) => {
  for (let i = 0; i < iterations; i += 1) {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
  }
};

describeTurnManagerSuite(
  'TurnManager additional coverage scenarios',
  (getBed) => {
    test(
      'clears previous actor state, falls back to legacy player component, and handles missing handlers',
      async () => {
        const bed = getBed();
        const { turnOrderService, turnHandlerResolver, dispatcher, logger } =
          bed.mocks;

        safeDispatchError.mockClear();
        dispatcher.dispatch.mockClear();
        logger.debug.mockClear();
        logger.warn.mockClear();

        await bed.startRunning();

        const actor = createLegacyPlayerActor('legacy-actor');

        turnOrderService.isEmpty
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(false)
          .mockResolvedValue(true);

        turnOrderService.getNextEntity
          .mockReturnValueOnce(actor)
          .mockReturnValueOnce(actor)
          .mockReturnValue(null);

        const handler = {
          startTurn: jest.fn().mockResolvedValue(),
          destroy: jest.fn().mockResolvedValue(),
        };
        turnHandlerResolver.resolveHandler
          .mockResolvedValueOnce(handler)
          .mockResolvedValueOnce(null);

        await bed.turnManager.advanceTurn();
        await bed.turnManager.advanceTurn();

        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'Clearing previous actor legacy-actor and handler before advancing.'
          )
        );

        const turnStartedCall = dispatcher.dispatch.mock.calls.find(
          ([eventId]) => eventId === 'core:turn_started'
        );
        expect(turnStartedCall).toBeDefined();
        expect(turnStartedCall[1]).toMatchObject({
          entityId: actor.id,
          entityType: 'player',
        });

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'Could not resolve a turn handler for actor legacy-actor'
          )
        );
      }
    );

    test('stops and dispatches error when a non-actor reappears in the queue', async () => {
      const bed = getBed();
      const { turnOrderService, dispatcher, logger } = bed.mocks;

      await bed.startRunning();

      const nonActor = createMockEntity('looping-non-actor', {
        isActor: false,
        isPlayer: false,
      });

      turnOrderService.isEmpty.mockResolvedValue(false);
      turnOrderService.getNextEntity.mockReturnValue(nonActor);
      turnOrderService.clearCurrentRound.mockResolvedValue();

      safeDispatchError.mockClear();
      dispatcher.dispatch.mockClear();
      logger.warn.mockClear();
      logger.error.mockClear();

      const stopSpy = jest.spyOn(bed.turnManager, 'stop');

      await bed.turnManager.advanceTurn();
      await drainTimersAndMicrotasks();

      expect(logger.warn).toHaveBeenCalledWith(
        `Entity ${nonActor.id} is not an actor. Skipping turn advancement for this entity.`
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Entity ${nonActor.id} reappeared without an actor component while advancing turns.`
        )
      );

      expect(safeDispatchError).toHaveBeenCalledWith(
        dispatcher,
        expect.stringContaining('non-actor entity twice while advancing turns'),
        expect.objectContaining({ entityId: nonActor.id }),
        logger
      );

      const systemErrorCalls = dispatcher.dispatch.mock.calls.filter(
        ([eventId]) => eventId === SYSTEM_ERROR_OCCURRED_ID
      );
      expect(systemErrorCalls.length).toBeGreaterThan(0);

      const criticalSystemError = systemErrorCalls.find(([, payload]) =>
        payload.message.includes('Invalid turn queue entity encountered')
      );

      expect(criticalSystemError).toBeDefined();
      expect(criticalSystemError[1]).toMatchObject({
        details: expect.objectContaining({
          error: expect.stringContaining(nonActor.id),
        }),
      });

      expect(stopSpy).toHaveBeenCalled();
      stopSpy.mockRestore();
    });

    test(
      'dispatches TURN_PROCESSING_ENDED with player actorType when core:player_type is human',
      async () => {
        const bed = getBed();
        const { turnOrderService, turnHandlerResolver, dispatcher } =
          bed.mocks;

        await bed.startRunning();

        const humanActor = {
          id: 'player-human',
          hasComponent: jest.fn((componentId) => {
            if (componentId === ACTOR_COMPONENT_ID) return true;
            if (componentId === PLAYER_TYPE_COMPONENT_ID) return true;
            return false;
          }),
          getComponentData: jest.fn((componentId) => {
            if (componentId === PLAYER_TYPE_COMPONENT_ID) {
              return { type: 'human' };
            }
            return null;
          }),
        };

        turnOrderService.isEmpty
          .mockResolvedValueOnce(false)
          .mockResolvedValue(true);
        turnOrderService.getNextEntity
          .mockReturnValueOnce(humanActor)
          .mockReturnValue(null);

        const handler = {
          startTurn: jest.fn().mockResolvedValue(),
          destroy: jest.fn().mockResolvedValue(),
        };
        turnHandlerResolver.resolveHandler.mockResolvedValueOnce(handler);

        const realAdvance = bed.turnManager.advanceTurn.bind(bed.turnManager);
        const advanceSpy = jest
          .spyOn(bed.turnManager, 'advanceTurn')
          .mockImplementationOnce(realAdvance)
          .mockResolvedValue(undefined);

        await bed.turnManager.advanceTurn();

        dispatcher.dispatch.mockClear();

        dispatcher._triggerEvent(TURN_ENDED_ID, {
          entityId: humanActor.id,
          success: true,
        });
        await drainTimersAndMicrotasks(4);

        const processingEndedCall = dispatcher.dispatch.mock.calls.find(
          ([eventId]) => eventId === TURN_PROCESSING_ENDED
        );

        expect(processingEndedCall).toBeDefined();
        expect(processingEndedCall[1]).toMatchObject({
          entityId: humanActor.id,
          actorType: 'player',
        });
        expect(humanActor.getComponentData).toHaveBeenCalledWith(
          PLAYER_TYPE_COMPONENT_ID
        );
        expect(humanActor.hasComponent).toHaveBeenCalledWith(
          PLAYER_TYPE_COMPONENT_ID
        );

        advanceSpy.mockRestore();
      }
    );

    test('ignores turn ended events when manager is stopped', async () => {
      const bed = getBed();
      const { dispatcher, logger } = bed.mocks;

      safeDispatchError.mockClear();
      dispatcher.dispatch.mockClear();
      logger.debug.mockClear();

      const originalSubscribe = dispatcher.subscribe;
      dispatcher.subscribe = jest.fn((eventType, handler) => {
        originalSubscribe.call(dispatcher, eventType, handler);
        return () => {};
      });

      await bed.startRunning();
      dispatcher.subscribe = originalSubscribe;

      await bed.turnManager.stop();
      logger.debug.mockClear();

      dispatcher._triggerEvent(TURN_ENDED_ID, {
        entityId: 'ghost',
        success: true,
      });
      await drainTimersAndMicrotasks(2);

      expect(logger.debug).toHaveBeenCalledWith(
        `Received '${TURN_ENDED_ID}' but manager is stopped. Ignoring.`
      );
    });

    test('warns when core:turn_ended payload is missing', async () => {
      const bed = getBed();
      const { dispatcher, logger } = bed.mocks;

      safeDispatchError.mockClear();
      dispatcher.dispatch.mockClear();
      logger.warn.mockClear();

      await bed.startRunning();

      dispatcher._triggerEvent(TURN_ENDED_ID, undefined);
      await drainTimersAndMicrotasks(2);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Received '${TURN_ENDED_ID}' event but it has no payload. Ignoring.`
        ),
        expect.objectContaining({ type: TURN_ENDED_ID, payload: undefined })
      );
    });

    test(
      'handles successful turn completion with cleanup and downstream failures',
      async () => {
        const bed = getBed();
        const { turnOrderService, turnHandlerResolver, dispatcher, logger } =
          bed.mocks;

        safeDispatchError.mockClear();
        dispatcher.dispatch.mockClear();
        logger.debug.mockClear();
        logger.warn.mockClear();
        logger.error.mockClear();

        await bed.startRunning();

        const actor = {
          id: 'actor-42',
          hasComponent: jest.fn((componentId) =>
            componentId === ACTOR_COMPONENT_ID
          ),
          getComponentData: jest.fn(() => null),
        };

        turnOrderService.isEmpty
          .mockResolvedValueOnce(false)
          .mockResolvedValue(true);
        turnOrderService.getNextEntity
          .mockReturnValueOnce(actor)
          .mockReturnValue(null);

        const handler = {
          startTurn: jest.fn().mockResolvedValue(),
          signalNormalApparentTermination: jest.fn(),
          destroy: jest.fn(() => Promise.reject(new Error('destroy failure'))),
        };
        turnHandlerResolver.resolveHandler.mockResolvedValueOnce(handler);

        let systemErrorDispatchCount = 0;
        const dispatchMock = jest.fn((eventId, payload) => {
          if (eventId === TURN_PROCESSING_ENDED) {
            return Promise.reject(new Error('processing end failure'));
          }
          if (eventId === SYSTEM_ERROR_OCCURRED_ID) {
            systemErrorDispatchCount += 1;
            if (systemErrorDispatchCount === 3) {
              throw new Error('system dispatch failure');
            }
          }
          return Promise.resolve(true);
        });
        dispatcher.dispatch.mockImplementation(dispatchMock);

        const stopError = new Error('stop failure');
        const stopSpy = jest
          .spyOn(bed.turnManager, 'stop')
          .mockRejectedValueOnce(stopError);

        const realAdvance = bed.turnManager.advanceTurn.bind(bed.turnManager);
        const advanceError = new Error('advance failure');
        const advanceSpy = jest.spyOn(bed.turnManager, 'advanceTurn');
        advanceSpy.mockImplementationOnce(realAdvance);
        advanceSpy.mockImplementation(() => Promise.reject(advanceError));

        await bed.turnManager.advanceTurn();

        dispatcher._triggerEvent(TURN_ENDED_ID, {
          entityId: 'stranger',
          success: true,
        });
        await drainTimersAndMicrotasks(4);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('This event will be IGNORED by TurnManager')
        );
        logger.warn.mockClear();

        dispatcher._triggerEvent(TURN_ENDED_ID, {
          entityId: actor.id,
          success: true,
        });
        await drainTimersAndMicrotasks(6);

        expect(logger.debug).toHaveBeenCalledWith(
          `Marking round as having had a successful turn (actor: ${actor.id}).`
        );
        expect(handler.signalNormalApparentTermination).toHaveBeenCalled();
        expect(handler.destroy).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            `Error destroying handler for ${actor.id} after turn end`
          ),
          expect.any(Error)
        );

        expect(safeDispatchError).toHaveBeenCalledWith(
          dispatcher,
          `Failed to dispatch ${TURN_PROCESSING_ENDED} for ${actor.id}`,
          expect.objectContaining({ error: 'processing end failure' })
        );

        expect(safeDispatchError).toHaveBeenCalledWith(
          dispatcher,
          'Error during scheduled turn advancement',
          expect.objectContaining({
            entityId: actor.id,
            error: advanceError.message,
          })
        );

        expect(safeDispatchError).toHaveBeenCalledWith(
          dispatcher,
          'Critical error during scheduled turn advancement.',
          expect.objectContaining({ error: advanceError.message }),
          logger
        );

        expect(logger.error).toHaveBeenCalledWith(
          `Failed to stop manager after advanceTurn failure: ${stopError.message}`
        );
        expect(stopSpy).toHaveBeenCalled();

        Object.defineProperty(bed.turnManager, '_TurnManager__isRunning', {
          value: false,
          writable: true,
          configurable: true,
        });

        advanceSpy.mockRestore();
        stopSpy.mockRestore();
        dispatcher.dispatch.mockImplementation(() => Promise.resolve(true));
        jest.clearAllTimers();
      }
    );

    test('treats missing success flag as a successful turn', async () => {
      const bed = getBed();
      const stopSpy = bed.spyOnStopNoOp();

      const actor = createMockEntity('actor-missing-success', {
        isActor: true,
        isPlayer: false,
      });
      bed.setActiveEntities(actor);

      bed.mocks.turnOrderService.isEmpty
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
      bed.mocks.turnOrderService.getNextEntity
        .mockResolvedValueOnce(actor)
        .mockResolvedValue(null);
      bed.mocks.turnOrderService.startNewRound.mockResolvedValue();

      const handler = bed.setupHandlerForActor(actor);
      handler.startTurn.mockResolvedValue();

      const realAdvance = bed.turnManager.advanceTurn.bind(bed.turnManager);
      const advanceSpy = jest
        .spyOn(bed.turnManager, 'advanceTurn')
        .mockImplementationOnce(realAdvance)
        .mockImplementationOnce(realAdvance)
        .mockResolvedValue(undefined);

      await bed.turnManager.start();
      await drainTimersAndMicrotasks(4);
      const currentActorId = bed.turnManager.getCurrentActor()?.id;
      expect(currentActorId).toBe(actor.id);

      bed.trigger(TURN_ENDED_ID, { entityId: actor.id });
      await drainTimersAndMicrotasks(6);

      const systemErrorDispatches = bed.mocks.dispatcher.dispatch.mock.calls.filter(
        ([eventId]) => eventId === SYSTEM_ERROR_OCCURRED_ID
      );

      expect(stopSpy).not.toHaveBeenCalled();
      expect(systemErrorDispatches).toHaveLength(0);

      const warnMessages = bed.mocks.logger.warn.mock.calls.map(
        ([message]) => message
      );
      expect(
        warnMessages.some((message) =>
          message.includes('without a success flag')
        )
      ).toBe(true);

      advanceSpy.mockRestore();
      await bed.turnManager.stop();
      await drainTimersAndMicrotasks(2);
    });

    test(
      'defaults missing entityId to current actor when handling turn end',
      async () => {
        const bed = getBed();
        const stopSpy = bed.spyOnStopNoOp();

        const actor = createMockEntity('actor-missing-id', {
          isActor: true,
          isPlayer: false,
        });
        bed.setActiveEntities(actor);

        bed.mocks.turnOrderService.isEmpty
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false)
          .mockResolvedValue(true);
        bed.mocks.turnOrderService.getNextEntity
          .mockResolvedValueOnce(actor)
          .mockResolvedValue(null);
        bed.mocks.turnOrderService.startNewRound.mockResolvedValue();

        const handler = bed.setupHandlerForActor(actor);
        handler.startTurn.mockResolvedValue();

        const realAdvance = bed.turnManager.advanceTurn.bind(bed.turnManager);
        const advanceSpy = jest
          .spyOn(bed.turnManager, 'advanceTurn')
          .mockImplementationOnce(realAdvance)
          .mockImplementationOnce(realAdvance)
          .mockResolvedValue(undefined);

        await bed.turnManager.start();
        await drainTimersAndMicrotasks(4);

        expect(bed.turnManager.getCurrentActor()?.id).toBe(actor.id);

        bed.mocks.logger.warn.mockClear();
        bed.mocks.dispatcher.dispatch.mockClear();

        bed.trigger(TURN_ENDED_ID, { success: true });
        await drainTimersAndMicrotasks(6);

        const processingEndedCall = bed.mocks.dispatcher.dispatch.mock.calls.find(
          ([eventId]) => eventId === TURN_PROCESSING_ENDED
        );

        expect(processingEndedCall).toBeDefined();
        expect(processingEndedCall[1]).toMatchObject({ entityId: actor.id });
        expect(
          bed.mocks.logger.warn.mock.calls.some(([message]) =>
            message.includes('without an entityId')
          )
        ).toBe(true);
        expect(stopSpy).not.toHaveBeenCalled();

        advanceSpy.mockRestore();
        await bed.turnManager.stop();
        await drainTimersAndMicrotasks(2);
      }
    );
  }
);
