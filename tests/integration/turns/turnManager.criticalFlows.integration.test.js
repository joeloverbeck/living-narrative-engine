import { describe, it, expect, beforeEach } from '@jest/globals';
import TurnManager from '../../../src/turns/turnManager.js';
import { TurnOrderService } from '../../../src/turns/order/turnOrderService.js';
import EventBus from '../../../src/events/eventBus.js';
import { IScheduler } from '../../../src/scheduling/IScheduler.js';
import TurnHandlerResolver from '../../../src/turns/services/turnHandlerResolver.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
  PLAYER_TYPE_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import {
  TURN_ENDED_ID,
  TURN_PROCESSING_ENDED,
  TURN_PROCESSING_STARTED,
} from '../../../src/constants/eventIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import { IValidatedEventDispatcher } from '../../../src/interfaces/IValidatedEventDispatcher.js';

class CapturingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, ...args) {
    this.debugLogs.push({ message, args });
  }

  info(message, ...args) {
    this.infoLogs.push({ message, args });
  }

  warn(message, ...args) {
    this.warnLogs.push({ message, args });
  }

  error(message, ...args) {
    this.errorLogs.push({ message, args });
  }
}

class IntegrationValidatedEventDispatcher extends IValidatedEventDispatcher {
  constructor({ eventBus, logger, dispatchOverrides = new Map() }) {
    super();
    this.eventBus = eventBus;
    this.logger = logger;
    this.dispatchOverrides = dispatchOverrides;
    this.calls = [];
  }

  async dispatch(eventName, payload) {
    this.calls.push({ eventName, payload });
    await this.eventBus.dispatch(eventName, payload);
    if (this.dispatchOverrides.has(eventName)) {
      const override = this.dispatchOverrides.get(eventName);
      if (typeof override === 'function') {
        return override(payload, eventName);
      }
      return override;
    }
    return true;
  }

  subscribe(eventName, handler) {
    return this.eventBus.subscribe(eventName, handler);
  }

  unsubscribe(eventName, handler) {
    return this.eventBus.unsubscribe(eventName, handler);
  }
}

class RecordingTurnHandler {
  constructor({ onStart = null, errorToThrow = null }) {
    this.onStart = onStart;
    this.errorToThrow = errorToThrow;
    this.startCalls = [];
    this.destroyCount = 0;
    this.signalCount = 0;
  }

  async startTurn(actor) {
    this.startCalls.push(actor.id);
    if (this.errorToThrow) {
      throw this.errorToThrow;
    }
    if (this.onStart) {
      await this.onStart(actor, this);
    }
  }

  signalNormalApparentTermination() {
    this.signalCount += 1;
  }

  async destroy() {
    this.destroyCount += 1;
  }
}

class SingleExecutionScheduler extends IScheduler {
  constructor({ allowAdditional = false } = {}) {
    super();
    this.allowAdditional = allowAdditional;
    this.callCount = 0;
  }

  setTimeout(fn) {
    this.callCount += 1;
    if (this.callCount === 1 || this.allowAdditional) {
      fn();
    }
    return this.callCount;
  }

  clearTimeout() {}
}

/**
 *
 * @param id
 * @param root0
 * @param root0.playerType
 * @param root0.includeLegacy
 */
function createActorEntity(
  id,
  { playerType = 'human', includeLegacy = true } = {}
) {
  const components = {
    [ACTOR_COMPONENT_ID]: {},
  };
  if (playerType !== null) {
    components[PLAYER_TYPE_COMPONENT_ID] = { type: playerType };
  }
  if (includeLegacy) {
    components[PLAYER_COMPONENT_ID] = { playerId: id };
  }
  return { id, components };
}

/**
 *
 */
async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve));
}

/**
 *
 * @param condition
 * @param attempts
 */
async function waitForCondition(condition, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    if (condition()) {
      return;
    }
    await flushMicrotasks();
  }
  throw new Error('Condition not met within allotted attempts.');
}

/**
 *
 * @param root0
 * @param root0.handlerFactory
 * @param root0.fixedHandler
 * @param root0.dispatchOverrides
 * @param root0.scheduler
 * @param root0.dispatcherFactory
 * @param root0.turnOrderServiceFactory
 * @param root0.entities
 */
function createTurnManagerEnvironment({
  handlerFactory = null,
  fixedHandler = null,
  dispatchOverrides = [],
  scheduler = null,
  dispatcherFactory = null,
  turnOrderServiceFactory = null,
  entities = null,
} = {}) {
  const logger = new CapturingLogger();
  const entityManager = new SimpleEntityManager();
  if (Array.isArray(entities)) {
    entityManager.setEntities(entities);
  }
  const turnOrderService = turnOrderServiceFactory
    ? turnOrderServiceFactory({ logger, entityManager })
    : new TurnOrderService({ logger });
  const eventBus = new EventBus({ logger });
  const dispatcher = dispatcherFactory
    ? dispatcherFactory({
        eventBus,
        logger,
        dispatchOverrides: new Map(dispatchOverrides),
      })
    : new IntegrationValidatedEventDispatcher({
        eventBus,
        logger,
        dispatchOverrides: new Map(dispatchOverrides),
      });

  const env = {
    logger,
    entityManager,
    turnOrderService,
    eventBus,
    dispatcher,
    handlers: [],
  };

  const resolver = new TurnHandlerResolver({
    logger,
    handlerRules: [
      {
        name: 'IntegrationHandler',
        predicate: () => true,
        factory: () => {
          let handler;
          if (handlerFactory) {
            handler = handlerFactory(env);
          } else if (fixedHandler) {
            handler = fixedHandler;
          } else {
            handler = new RecordingTurnHandler({});
          }
          env.handlers.push(handler);
          return handler;
        },
      },
    ],
  });

  const manager = new TurnManager({
    turnOrderService,
    entityManager,
    logger,
    dispatcher,
    turnHandlerResolver: resolver,
    scheduler: scheduler ?? new SingleExecutionScheduler(),
    eventBus,
  });

  env.resolver = resolver;
  env.manager = manager;
  return env;
}

describe('TurnManager integration coverage', () => {
  let env;

  beforeEach(() => {
    env = null;
  });

  it('stops when a non-actor reappears in the queue and reports the failure', async () => {
    env = createTurnManagerEnvironment();

    env.entityManager.setEntities([
      { id: 'ghost', components: {} },
      createActorEntity('hero'),
    ]);

    const ghostEntity = { id: 'ghost' };
    const ghostDuplicate = { id: 'ghost' };
    const heroInstance = env.entityManager.getEntityInstance('hero');

    env.turnOrderService.startNewRound(
      [ghostEntity, ghostDuplicate, heroInstance],
      'round-robin'
    );

    await env.manager.start();

    const systemErrors = env.dispatcher.calls.filter(
      (call) => call.eventName === SYSTEM_ERROR_OCCURRED_ID
    );

    expect(systemErrors.length).toBeGreaterThanOrEqual(2);
    expect(systemErrors[0].payload.details.entityId).toBe('ghost');
    expect(env.manager.getCurrentActor()).toBeNull();

    await env.manager.stop();
  });

  it('normalises player turn metadata and cleans up handlers after a successful turn', async () => {
    let handlerInstance;
    env = createTurnManagerEnvironment({
      handlerFactory: (context) => {
        handlerInstance = new RecordingTurnHandler({
          onStart: async (actor) => {
            await context.dispatcher.dispatch(TURN_ENDED_ID, {
              entityId: `  ${actor.id}  `,
              success: 'TRUE',
            });
          },
        });
        return handlerInstance;
      },
    });

    env.entityManager.setEntities([createActorEntity('hero')]);

    const startPromise = env.manager.start();

    await waitForCondition(() =>
      env.dispatcher.calls.some(
        (call) => call.eventName === TURN_PROCESSING_ENDED
      )
    );

    await env.manager.stop();
    await startPromise;

    const startedEvent = env.dispatcher.calls.find(
      (call) => call.eventName === TURN_PROCESSING_STARTED
    );
    expect(startedEvent.payload).toEqual({
      entityId: 'hero',
      actorType: 'player',
    });

    const processingEndedCall = env.dispatcher.calls.find(
      (call) => call.eventName === TURN_PROCESSING_ENDED
    );
    expect(processingEndedCall.payload).toEqual({
      entityId: 'hero',
      actorType: 'player',
    });

    await waitForCondition(() => handlerInstance.destroyCount > 0);
    expect(handlerInstance.signalCount).toBe(1);
    expect(handlerInstance.startCalls).toEqual(['hero']);
  });

  it('falls back to legacy player metadata and reports dispatcher failures', async () => {
    env = createTurnManagerEnvironment({
      dispatchOverrides: [[TURN_PROCESSING_ENDED, false]],
      handlerFactory: (context) =>
        new RecordingTurnHandler({
          onStart: async () => {
            await context.dispatcher.dispatch(TURN_ENDED_ID, {
              entityId: undefined,
              success: 1,
            });
          },
        }),
    });

    env.entityManager.setEntities([
      createActorEntity('legacy-player', {
        playerType: null,
        includeLegacy: true,
      }),
    ]);

    const startPromise = env.manager.start();

    await waitForCondition(() =>
      env.dispatcher.calls.some(
        (call) => call.eventName === SYSTEM_ERROR_OCCURRED_ID
      )
    );

    await env.manager.stop();
    await startPromise;

    const processingEndedCall = env.dispatcher.calls.find(
      (call) => call.eventName === TURN_PROCESSING_ENDED
    );
    expect(processingEndedCall.payload).toEqual({
      entityId: 'legacy-player',
      actorType: 'player',
    });

    const systemErrorFromDispatch = env.dispatcher.calls.find(
      (call) =>
        call.eventName === SYSTEM_ERROR_OCCURRED_ID &&
        call.payload.details?.entityId === 'legacy-player'
    );
    expect(systemErrorFromDispatch).toBeDefined();
  });

  it('recovers from handler.startTurn errors by signalling failures and stopping the round', async () => {
    const startError = new Error('handler boom');

    env = createTurnManagerEnvironment({
      handlerFactory: (context) =>
        new RecordingTurnHandler({
          errorToThrow: startError,
          onStart: async () => {
            await context.dispatcher.dispatch(TURN_ENDED_ID, {
              entityId: 'unused',
            });
          },
        }),
    });

    env.entityManager.setEntities([createActorEntity('hero')]);

    await env.manager.start();

    await waitForCondition(() =>
      env.dispatcher.calls.some(
        (call) =>
          call.eventName === SYSTEM_ERROR_OCCURRED_ID &&
          call.payload.message ===
            'System Error: No progress made in the last round.'
      )
    ).catch(() => {});

    const processingEndedCall = env.dispatcher.calls.find(
      (call) => call.eventName === TURN_PROCESSING_ENDED
    );
    expect(processingEndedCall.payload).toEqual({
      entityId: 'hero',
      actorType: 'player',
    });

    const systemErrorMessages = env.dispatcher.calls
      .filter((call) => call.eventName === SYSTEM_ERROR_OCCURRED_ID)
      .map((call) => call.payload.message);

    expect(systemErrorMessages).toEqual(
      expect.arrayContaining([
        'Error initiating turn for hero',
        'Error initiating turn for hero.',
      ])
    );
    expect(
      systemErrorMessages.some((msg) =>
        msg.includes('System Error: No progress made in the last round.')
      )
    ).toBe(true);
  });

  it('handles subscription failures by reporting system errors and leaving the manager stopped', async () => {
    class SubscribeFailDispatcher extends IntegrationValidatedEventDispatcher {
      subscribe() {
        throw new Error('subscribe failed');
      }

      unsubscribe() {}
    }

    env = createTurnManagerEnvironment({
      dispatcherFactory: (deps) => new SubscribeFailDispatcher(deps),
      entities: [createActorEntity('hero')],
    });

    await env.manager.start();

    const systemErrors = env.dispatcher.calls.filter(
      (call) => call.eventName === SYSTEM_ERROR_OCCURRED_ID
    );
    expect(systemErrors.length).toBeGreaterThanOrEqual(2);
    expect(systemErrors[0].payload.message).toContain('Failed to subscribe to');
    expect(systemErrors[systemErrors.length - 1].payload.message).toContain(
      'Game cannot proceed reliably'
    );
    expect(env.manager.getCurrentActor()).toBeNull();

    await env.manager.stop();
  });

  it('prevents duplicate start and stop actions when already in the desired state', async () => {
    let resolveTurn;
    env = createTurnManagerEnvironment({
      handlerFactory: (context) =>
        new RecordingTurnHandler({
          onStart: async (actor) => {
            await context.dispatcher.dispatch(TURN_ENDED_ID, {
              entityId: actor.id,
              success: true,
            });
            if (resolveTurn) {
              resolveTurn();
            }
          },
        }),
      entities: [createActorEntity('hero')],
    });

    const turnCompleted = new Promise((resolve) => {
      resolveTurn = resolve;
    });

    const startPromise = env.manager.start();
    await env.manager.start();

    await turnCompleted;
    await env.manager.stop();
    await env.manager.stop();
    await startPromise;

    const startedEvents = env.dispatcher.calls.filter(
      (call) => call.eventName === TURN_PROCESSING_STARTED
    );
    expect(startedEvents).toHaveLength(1);
  });

  it('schedules advancement when no handler can be resolved', async () => {
    const scheduler = new SingleExecutionScheduler({ allowAdditional: false });
    env = createTurnManagerEnvironment({
      handlerFactory: () => ({}),
      scheduler,
      entities: [createActorEntity('hero')],
    });

    const startPromise = env.manager.start();

    await waitForCondition(() =>
      env.dispatcher.calls.some(
        (call) => call.eventName === TURN_PROCESSING_ENDED
      )
    );

    expect(scheduler.callCount).toBe(1);
    await env.manager.stop();
    await startPromise;
  });

  it('ignores malformed turn end events until a valid payload completes the turn', async () => {
    env = createTurnManagerEnvironment({
      handlerFactory: (context) =>
        new RecordingTurnHandler({
          onStart: async (actor) => {
            await context.dispatcher.dispatch(TURN_ENDED_ID);
            await context.dispatcher.dispatch(TURN_ENDED_ID, {
              entityId: 'villain',
              success: 'maybe',
            });
            await context.dispatcher.dispatch(TURN_ENDED_ID, {
              entityId: `  ${actor.id}  `,
              success: { uncertain: true },
            });
          },
        }),
      entities: [createActorEntity('hero')],
    });

    await env.manager.start();

    const processingEndedCall = env.dispatcher.calls.find(
      (call) => call.eventName === TURN_PROCESSING_ENDED
    );
    expect(processingEndedCall.payload).toEqual({
      entityId: 'hero',
      actorType: 'player',
    });

    await env.manager.stop();
  });

  it('dispatches system errors when a new round cannot be started', async () => {
    env = createTurnManagerEnvironment({
      entities: [{ id: 'bystander', components: {} }],
    });

    await env.manager.start();

    const systemErrorMessages = env.dispatcher.calls
      .filter((call) => call.eventName === SYSTEM_ERROR_OCCURRED_ID)
      .map((call) => call.payload.message);
    expect(systemErrorMessages).toEqual(
      expect.arrayContaining([
        'System Error: No active actors found to start a round. Stopping game.',
      ])
    );

    await env.manager.stop();
  });

  it('reports dispatcher exceptions while ensuring processing continues', async () => {
    const dispatchError = new Error('dispatch fail');
    env = createTurnManagerEnvironment({
      dispatchOverrides: [
        [
          TURN_PROCESSING_ENDED,
          () => {
            throw dispatchError;
          },
        ],
      ],
      handlerFactory: (context) =>
        new RecordingTurnHandler({
          onStart: async (actor) => {
            await context.dispatcher.dispatch(TURN_ENDED_ID, {
              entityId: actor.id,
              success: true,
            });
          },
        }),
      entities: [createActorEntity('hero')],
    });

    await env.manager.start();

    const failureDetails = env.dispatcher.calls.find(
      (call) =>
        call.eventName === SYSTEM_ERROR_OCCURRED_ID &&
        call.payload.details?.error === dispatchError.message
    );
    expect(failureDetails).toBeDefined();

    await env.manager.stop();
  });
});
