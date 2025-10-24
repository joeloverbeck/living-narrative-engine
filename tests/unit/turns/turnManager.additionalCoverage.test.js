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
  }
);
