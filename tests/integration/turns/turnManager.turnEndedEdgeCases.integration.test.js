import { describe, it, expect } from '@jest/globals';
import TurnManager from '../../../src/turns/turnManager.js';
import { TurnOrderService } from '../../../src/turns/order/turnOrderService.js';
import EventBus from '../../../src/events/eventBus.js';
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

class ImmediateScheduler {
  constructor() {
    this.timeouts = new Set();
  }

  setTimeout(fn) {
    fn();
    const id = Symbol('immediate-timeout');
    this.timeouts.add(id);
    return id;
  }

  clearTimeout(id) {
    this.timeouts.delete(id);
  }
}

function createActor(id, { playerType = null, includeLegacy = true } = {}) {
  const components = { [ACTOR_COMPONENT_ID]: {} };
  if (playerType !== null) {
    components[PLAYER_TYPE_COMPONENT_ID] = { type: playerType };
  }
  if (includeLegacy) {
    components[PLAYER_COMPONENT_ID] = { playerId: id };
  }
  return { id, components };
}

function createEnvironment({
  entities,
  dispatchOverrides = new Map(),
  handlerFactory,
  scheduler = new ImmediateScheduler(),
  resolverOverrides = null,
}) {
  const logger = new CapturingLogger();
  const entityManager = new SimpleEntityManager(entities);
  const turnOrderService = new TurnOrderService({ logger });
  const eventBus = new EventBus({ logger });
  const dispatcher = new IntegrationValidatedEventDispatcher({
    eventBus,
    logger,
    dispatchOverrides,
  });
  const resolver =
    resolverOverrides ||
    new TurnHandlerResolver({
      logger,
      handlerRules: [
        {
          name: 'default',
          predicate: () => true,
          factory: handlerFactory,
        },
      ],
    });

  return {
    logger,
    entityManager,
    turnOrderService,
    eventBus,
    dispatcher,
    resolver,
    scheduler,
  };
}

async function startManager(manager) {
  await manager.start();
  await new Promise((resolve) => setImmediate(resolve));
}

describe('TurnManager integration edge cases', () => {
  it('dispatches system errors and stops when handler resolution fails', async () => {
    const entities = [createActor('hero')];
    const logger = new CapturingLogger();
    const entityManager = new SimpleEntityManager(entities);
    const turnOrderService = new TurnOrderService({ logger });
    const eventBus = new EventBus({ logger });
    const dispatcher = new IntegrationValidatedEventDispatcher({
      eventBus,
      logger,
    });
    const resolver = { resolveHandler: () => Promise.reject(new Error('boom')) };
    const scheduler = new ImmediateScheduler();

    const manager = new TurnManager({
      turnOrderService,
      entityManager,
      logger,
      dispatcher,
      turnHandlerResolver: resolver,
      scheduler,
      eventBus,
    });

    await manager.start();
    await new Promise((resolve) => setImmediate(resolve));

    expect(
      dispatcher.calls.find((call) => call.eventName === SYSTEM_ERROR_OCCURRED_ID)
    ).toBeDefined();
    expect(manager.getCurrentActor()).toBeNull();
  });

  it('normalises malformed turn end payloads and reports dispatcher anomalies', async () => {
    const dispatchOverrides = new Map();
    dispatchOverrides.set(TURN_PROCESSING_ENDED, 'maybe');

    let env;
    const handlerFactory = () => ({
      startTurn: async (actor) => {
        const payloads = [
          undefined,
          { entityId: '   ', success: 'true' },
          { entityId: `${actor.id} `, success: 'false' },
          { entityId: actor.id, success: 0 },
        ];

        for (const payload of payloads) {
          await env.dispatcher.dispatch(TURN_ENDED_ID, payload);
        }
      },
      destroy: async () => {
        throw new Error('destroy failed');
      },
    });

    env = createEnvironment({
      entities: [createActor('player-1', { playerType: 'human' })],
      dispatchOverrides,
      handlerFactory,
    });

    const manager = new TurnManager({
      turnOrderService: env.turnOrderService,
      entityManager: env.entityManager,
      logger: env.logger,
      dispatcher: env.dispatcher,
      turnHandlerResolver: env.resolver,
      scheduler: env.scheduler,
      eventBus: env.eventBus,
    });

    env.dispatcher.dispatchOverrides.set(TURN_PROCESSING_STARTED, () => true);

    await startManager(manager);

    // Allow scheduled callbacks and promise chains to resolve
    await new Promise((resolve) => setImmediate(resolve));
    await manager.stop();

    expect(
      env.logger.warnLogs.some(({ message }) =>
        message.includes('with an entityId comprised only of whitespace')
      )
    ).toBe(true);
    expect(
      env.logger.warnLogs.some(({ message }) =>
        message.includes('with surrounding whitespace')
      )
    ).toBe(true);
    expect(
      env.dispatcher.calls.filter((call) => call.eventName === TURN_PROCESSING_ENDED)
        .length
    ).toBeGreaterThan(0);
  });
});

