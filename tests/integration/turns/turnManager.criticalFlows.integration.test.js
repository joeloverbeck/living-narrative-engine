import {
  describe,
  it,
  expect,
  beforeEach,
} from '@jest/globals';
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
      return this.dispatchOverrides.get(eventName);
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

function createActorEntity(id, { playerType = 'human', includeLegacy = true } = {}) {
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

async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve));
}

async function waitForCondition(condition, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    if (condition()) {
      return;
    }
    await flushMicrotasks();
  }
  throw new Error('Condition not met within allotted attempts.');
}

function createTurnManagerEnvironment({
  handlerFactory = null,
  fixedHandler = null,
  dispatchOverrides = [],
  scheduler = null,
} = {}) {
  const logger = new CapturingLogger();
  const entityManager = new SimpleEntityManager();
  const turnOrderService = new TurnOrderService({ logger });
  const eventBus = new EventBus({ logger });
  const dispatcher = new IntegrationValidatedEventDispatcher({
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
      'round-robin',
    );

    await env.manager.start();

    const systemErrors = env.dispatcher.calls.filter(
      (call) => call.eventName === SYSTEM_ERROR_OCCURRED_ID,
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
        (call) => call.eventName === TURN_PROCESSING_ENDED,
      ),
    );

    await env.manager.stop();
    await startPromise;

    const startedEvent = env.dispatcher.calls.find(
      (call) => call.eventName === TURN_PROCESSING_STARTED,
    );
    expect(startedEvent.payload).toEqual({
      entityId: 'hero',
      actorType: 'player',
    });

    const processingEndedCall = env.dispatcher.calls.find(
      (call) => call.eventName === TURN_PROCESSING_ENDED,
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
      createActorEntity('legacy-player', { playerType: null, includeLegacy: true }),
    ]);

    const startPromise = env.manager.start();

    await waitForCondition(() =>
      env.dispatcher.calls.some(
        (call) => call.eventName === SYSTEM_ERROR_OCCURRED_ID,
      ),
    );

    await env.manager.stop();
    await startPromise;

    const processingEndedCall = env.dispatcher.calls.find(
      (call) => call.eventName === TURN_PROCESSING_ENDED,
    );
    expect(processingEndedCall.payload).toEqual({
      entityId: 'legacy-player',
      actorType: 'player',
    });

    const systemErrorFromDispatch = env.dispatcher.calls.find(
      (call) =>
        call.eventName === SYSTEM_ERROR_OCCURRED_ID &&
        call.payload.details?.entityId === 'legacy-player',
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
      (call) => call.eventName === TURN_PROCESSING_ENDED,
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
      ]),
    );
    expect(
      systemErrorMessages.some((msg) =>
        msg.includes('System Error: No progress made in the last round.')
      ),
    ).toBe(true);
  });
});
