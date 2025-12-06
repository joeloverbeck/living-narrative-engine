import { describe, it, expect } from '@jest/globals';
import AutoMoveFollowersHandler from '../../../../src/logic/operationHandlers/autoMoveFollowersHandler.js';
import SystemMoveEntityHandler from '../../../../src/logic/operationHandlers/systemMoveEntityHandler.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  LEADING_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, ...args) {
    this.debugLogs.push([message, ...args]);
  }

  info(message, ...args) {
    this.infoLogs.push([message, ...args]);
  }

  warn(message, ...args) {
    this.warnLogs.push([message, ...args]);
  }

  error(message, ...args) {
    this.errorLogs.push([message, ...args]);
  }
}

class RecordingValidatedDispatcher {
  constructor() {
    this.events = [];
    this.behaviors = new Map();
  }

  setBehavior(eventName, behavior) {
    this.behaviors.set(eventName, behavior);
  }

  dispatch(eventName, payload, options = {}) {
    this.events.push({ eventName, payload, options });
    const behavior = this.behaviors.get(eventName);
    if (behavior) {
      return behavior(payload, options, eventName);
    }
    return true;
  }

  subscribe() {
    return () => {};
  }

  unsubscribe() {}
}

class PassThroughDispatcher {
  constructor({ validatedEventDispatcher, logger }) {
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#logger = logger;
  }

  #validatedEventDispatcher;
  #logger;

  dispatch(eventName, payload, options = {}) {
    try {
      return this.#validatedEventDispatcher.dispatch(
        eventName,
        payload,
        options
      );
    } catch (error) {
      this.#logger.error(
        `PassThroughDispatcher: Exception caught while dispatching event '${eventName}'. Error: ${error.message}`,
        { error, payload }
      );
      throw error;
    }
  }

  subscribe(...args) {
    return this.#validatedEventDispatcher.subscribe(...args);
  }

  unsubscribe(...args) {
    return this.#validatedEventDispatcher.unsubscribe(...args);
  }
}

/**
 *
 * @param root0
 * @param root0.entities
 * @param root0.dispatcherSetup
 * @param root0.failingMoveIds
 * @param root0.dispatcherFactory
 */
function createEnvironment({
  entities,
  dispatcherSetup,
  failingMoveIds = [],
  dispatcherFactory,
}) {
  const logger = new RecordingLogger();
  const entityManager = new SimpleEntityManager(entities);
  const validatedDispatcher = new RecordingValidatedDispatcher();
  if (dispatcherSetup) {
    dispatcherSetup(validatedDispatcher);
  }
  const safeEventDispatcher = dispatcherFactory
    ? dispatcherFactory({
        validatedDispatcher,
        logger,
      })
    : new SafeEventDispatcher({
        validatedEventDispatcher: validatedDispatcher,
        logger,
      });

  const baseMoveHandler = new SystemMoveEntityHandler({
    entityManager,
    safeEventDispatcher,
    logger,
  });

  const moveEntityHandler = failingMoveIds.length
    ? {
        async execute(params, context) {
          const entityId = params?.entity_ref?.entityId;
          if (entityId && failingMoveIds.includes(entityId)) {
            throw new Error(`move failed for ${entityId}`);
          }
          return baseMoveHandler.execute(params, context);
        },
      }
    : baseMoveHandler;

  const handler = new AutoMoveFollowersHandler({
    logger,
    entityManager,
    moveEntityHandler,
    safeEventDispatcher,
  });

  const executionContext = {
    logger,
    event: { payload: { previousLocationId: null } },
  };

  return {
    handler,
    entityManager,
    validatedDispatcher,
    safeEventDispatcher,
    logger,
    executionContext,
  };
}

describe('AutoMoveFollowersHandler integration', () => {
  it('moves followers to the destination and emits perceptible events', async () => {
    const entities = [
      {
        id: 'leader-alpha',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Aria' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc-atrium' },
          [LEADING_COMPONENT_ID]: {
            followers: ['follower-bryn', 'follower-cyra'],
          },
        },
      },
      {
        id: 'follower-bryn',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bryn' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc-atrium' },
        },
      },
      {
        id: 'follower-cyra',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Cyra' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc-atrium' },
        },
      },
      {
        id: 'loc-atrium',
        components: { [NAME_COMPONENT_ID]: { text: 'Atrium' } },
      },
      {
        id: 'loc-courtyard',
        components: { [NAME_COMPONENT_ID]: { text: 'Courtyard' } },
      },
    ];

    const {
      handler,
      entityManager,
      validatedDispatcher,
      executionContext,
      logger,
    } = createEnvironment({
      entities,
      dispatcherSetup(dispatcher) {
        dispatcher.setBehavior('core:perceptible_event', () => true);
        dispatcher.setBehavior('core:entity_moved', () =>
          Promise.resolve(true)
        );
        dispatcher.setBehavior('core:display_successful_action_result', () =>
          Promise.resolve(true)
        );
      },
    });

    executionContext.event.payload.previousLocationId = 'loc-atrium';

    await handler.execute(
      { leader_id: 'leader-alpha', destination_id: 'loc-courtyard' },
      executionContext
    );

    expect(
      entityManager.getComponentData('follower-bryn', POSITION_COMPONENT_ID)
        .locationId
    ).toBe('loc-courtyard');
    expect(
      entityManager.getComponentData('follower-cyra', POSITION_COMPONENT_ID)
        .locationId
    ).toBe('loc-courtyard');

    const perceptibleEvents = validatedDispatcher.events.filter(
      (event) => event.eventName === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(2);
    expect(perceptibleEvents[0].payload.descriptionText).toContain(
      'Bryn follows Aria to Courtyard'
    );

    const uiEvents = validatedDispatcher.events.filter(
      (event) => event.eventName === 'core:display_successful_action_result'
    );
    expect(uiEvents).toHaveLength(2);
    expect(
      validatedDispatcher.events.some(
        (event) => event.eventName === SYSTEM_ERROR_OCCURRED_ID
      )
    ).toBe(false);

    expect(
      logger.debugLogs.some(([message]) => message.includes('moved 2'))
    ).toBe(true);
  });

  it('handles move failures, dispatcher rejections, and skips out-of-position followers', async () => {
    const entities = [
      {
        id: 'leader-beta',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Leader' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc-start' },
          [LEADING_COMPONENT_ID]: {
            followers: [
              'follower-fails',
              'follower-perceptible',
              'follower-skip',
            ],
          },
        },
      },
      {
        id: 'follower-fails',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Falter' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc-start' },
        },
      },
      {
        id: 'follower-perceptible',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Perceptible Follower' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc-start' },
        },
      },
      {
        id: 'follower-skip',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Skipping Follower' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc-elsewhere' },
        },
      },
      {
        id: 'loc-start',
        components: { [NAME_COMPONENT_ID]: { text: 'Gallery' } },
      },
      {
        id: 'loc-target',
        components: { [NAME_COMPONENT_ID]: { text: 'Observatory' } },
      },
    ];

    const { handler, entityManager, validatedDispatcher, executionContext } =
      createEnvironment({
        entities,
        failingMoveIds: ['follower-fails'],
        dispatcherFactory: ({ validatedDispatcher, logger }) =>
          new PassThroughDispatcher({
            validatedEventDispatcher: validatedDispatcher,
            logger,
          }),
        dispatcherSetup(dispatcher) {
          dispatcher.setBehavior('core:entity_moved', () =>
            Promise.resolve(true)
          );
          dispatcher.setBehavior('core:perceptible_event', (payload) => {
            if (payload.actorId === 'follower-perceptible') {
              return Promise.reject(new Error('perceptible dispatch failed'));
            }
            return Promise.resolve(true);
          });
          dispatcher.setBehavior(
            'core:display_successful_action_result',
            (payload) => {
              if (payload.message.includes('Perceptible Follower')) {
                return Promise.reject(new Error('ui dispatch failed'));
              }
              return Promise.resolve(true);
            }
          );
        },
      });

    executionContext.event.payload.previousLocationId = 'loc-start';

    await handler.execute(
      { leader_id: 'leader-beta', destination_id: 'loc-target' },
      executionContext
    );

    expect(
      entityManager.getComponentData(
        'follower-perceptible',
        POSITION_COMPONENT_ID
      ).locationId
    ).toBe('loc-target');
    expect(
      entityManager.getComponentData('follower-skip', POSITION_COMPONENT_ID)
        .locationId
    ).toBe('loc-elsewhere');
    expect(
      entityManager.getComponentData('follower-fails', POSITION_COMPONENT_ID)
        .locationId
    ).toBe('loc-start');

    const errorEvents = validatedDispatcher.events.filter(
      (event) => event.eventName === SYSTEM_ERROR_OCCURRED_ID
    );
    expect(errorEvents).not.toHaveLength(0);
    expect(
      errorEvents.some(
        (event) => event.payload.details?.followerId === 'follower-fails'
      )
    ).toBe(true);
    expect(
      errorEvents.some(
        (event) => event.payload.details?.followerId === 'follower-perceptible'
      )
    ).toBe(true);
  });

  it('dispatches standardized errors for invalid parameters', async () => {
    const entities = [
      {
        id: 'leader-gamma',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Gamma' },
          [POSITION_COMPONENT_ID]: { locationId: 'loc-one' },
          [LEADING_COMPONENT_ID]: { followers: [] },
        },
      },
      {
        id: 'loc-one',
        components: { [NAME_COMPONENT_ID]: { text: 'One' } },
      },
      {
        id: 'loc-two',
        components: { [NAME_COMPONENT_ID]: { text: 'Two' } },
      },
    ];

    const { handler, validatedDispatcher, executionContext, logger } =
      createEnvironment({
        entities,
        dispatcherSetup(dispatcher) {
          dispatcher.setBehavior('core:entity_moved', () => true);
        },
      });

    executionContext.event.payload.previousLocationId = 'loc-one';

    await handler.execute(null, executionContext);
    await handler.execute(
      { leader_id: '', destination_id: 'loc-two' },
      executionContext
    );
    await handler.execute(
      { leader_id: 'leader-gamma', destination_id: '' },
      executionContext
    );

    const errorMessages = validatedDispatcher.events
      .filter((event) => event.eventName === SYSTEM_ERROR_OCCURRED_ID)
      .map((event) => event.payload.message);

    expect(
      errorMessages.some((msg) => msg.includes('Invalid "leader_id" parameter'))
    ).toBe(true);
    expect(
      errorMessages.some((msg) =>
        msg.includes('Invalid "destination_id" parameter')
      )
    ).toBe(true);
    expect(
      logger.warnLogs.some(([message]) =>
        message.includes('params missing or invalid')
      )
    ).toBe(true);
  });
});
