import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AvailableActionsProvider } from '../../../src/data/providers/availableActionsProvider.js';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { ActionIndexerAdapter } from '../../../src/turns/adapters/actionIndexerAdapter.js';
import { ActionIndexingService } from '../../../src/turns/services/actionIndexingService.js';
import EventBus from '../../../src/events/eventBus.js';
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import {
  COMPONENT_ADDED_ID,
  COMPONENTS_BATCH_ADDED_ID,
} from '../../../src/constants/eventIds.js';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../../src/constants/core.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

class CapturingLogger {
  constructor() {
    this.logs = {
      debug: [],
      info: [],
      warn: [],
      error: [],
      table: [],
      groupCollapsed: [],
      groupEnd: 0,
    };
  }

  debug(...args) {
    this.logs.debug.push(args);
  }

  info(...args) {
    this.logs.info.push(args);
  }

  warn(...args) {
    this.logs.warn.push(args);
  }

  error(...args) {
    this.logs.error.push(args);
  }

  table(data) {
    this.logs.table.push(data);
  }

  groupCollapsed(label) {
    this.logs.groupCollapsed.push(label);
  }

  groupEnd() {
    this.logs.groupEnd += 1;
  }
}

class TrackingEntityManager extends SimpleEntityManager {
  constructor(entities = []) {
    super(entities);
    this.instanceRequests = [];
  }

  getEntityInstance(id) {
    this.instanceRequests.push(id);
    return super.getEntityInstance(id);
  }
}

class DeterministicOrchestrator {
  constructor(entityManager) {
    this.entityManager = entityManager;
    this.callHistory = [];
  }

  async discoverActions(actor, context, options = {}) {
    const locationId = context?.currentLocation?.id ?? null;
    this.callHistory.push({
      actorId: actor.id,
      locationId,
      traceRequested: !!options.trace,
    });

    if (this.callHistory.length === 1) {
      const baseAction = {
        id: 'core:wait',
        command: 'Wait patiently',
        params: { stance: 'neutral' },
        description: 'Wait patiently',
        visual: { icon: 'hourglass' },
      };
      const duplicateAction = { ...baseAction };
      const locationAction = {
        id: 'core:inspect_location',
        command: `Inspect ${locationId}`,
        params: { locationId },
        description: `Inspect ${locationId}`,
        visual: null,
      };

      const overflowActions = Array.from(
        { length: MAX_AVAILABLE_ACTIONS_PER_TURN + 1 },
        (_, idx) => ({
          id: `integration:test_action_${idx}`,
          command: `Generated ${idx}`,
          params: { order: idx },
          description: `Generated ${idx}`,
          visual: idx % 2 === 0 ? { emoji: '✨', order: idx } : null,
        })
      );

      const actions = [
        baseAction,
        duplicateAction,
        locationAction,
        ...overflowActions,
      ];
      return {
        actions,
        errors: [
          {
            actionId: 'broken:action',
            targetId: 'target-99',
            error: 'Formatting failed',
          },
        ],
        trace: {
          logs: [
            { stage: 'prepare', message: 'Collected base actions' },
            {
              stage: 'generate',
              message: `Generated ${actions.length} actions for ${actor.id} in ${locationId}`,
            },
          ],
        },
      };
    }

    return {
      actions: [
        {
          id: 'core:wait',
          command: 'Wait patiently',
          params: { stance: 'neutral' },
          description: 'Wait patiently',
        },
        {
          id: 'social:wave',
          command: 'Wave hello',
          params: { target: 'friend' },
          description: 'Wave to a nearby friend',
        },
      ],
      errors: [],
      trace: {
        logs: [{ stage: 'generate', message: 'Secondary call' }],
      },
    };
  }
}

class ThrowingOrchestrator {
  constructor() {
    this.calls = 0;
  }

  async discoverActions() {
    this.calls += 1;
    throw new Error('discovery failed');
  }
}

describe('AvailableActionsProvider integration coverage', () => {
  let logger;
  let entityManager;
  let orchestrator;
  let discoveryService;
  let indexingAdapter;
  let eventBus;
  let provider;
  let actor;
  let baseContext;

  beforeEach(() => {
    logger = new CapturingLogger();
    entityManager = new TrackingEntityManager([
      {
        id: 'room-1',
        components: {
          'core:location': { name: 'Observation Deck' },
        },
      },
      {
        id: 'actor-1',
        components: {
          [POSITION_COMPONENT_ID]: { locationId: 'room-1' },
        },
      },
    ]);
    actor = entityManager.getEntityInstance('actor-1');
    orchestrator = new DeterministicOrchestrator(entityManager);

    discoveryService = new ActionDiscoveryService({
      entityManager,
      logger,
      actionPipelineOrchestrator: orchestrator,
      traceContextFactory: () => ({
        info() {},
        step() {},
        async withSpanAsync(_name, fn) {
          return await fn();
        },
      }),
      getActorLocationFn: (actorId, mgr) => {
        const inst = mgr.getEntityInstance(actorId);
        const pos = inst?.getComponentData?.(POSITION_COMPONENT_ID);
        return pos?.locationId ? mgr.getEntityInstance(pos.locationId) : null;
      },
    });

    const indexingService = new ActionIndexingService({ logger });
    indexingAdapter = new ActionIndexerAdapter(indexingService);
    eventBus = new EventBus({ logger });

    provider = new AvailableActionsProvider({
      actionDiscoveryService: discoveryService,
      actionIndexingService: indexingAdapter,
      entityManager,
      eventBus,
      logger,
    });

    baseContext = { game: { turn: 1 } };
  });

  afterEach(() => {
    provider?.destroy();
  });

  it('discovers, indexes, caches, logs, and invalidates across turn and component changes', async () => {
    expect(eventBus.listenerCount(COMPONENT_ADDED_ID)).toBe(1);
    expect(eventBus.listenerCount(COMPONENTS_BATCH_ADDED_ID)).toBe(1);

    const initialResults = await provider.get(actor, baseContext, logger);
    expect(initialResults).toHaveLength(MAX_AVAILABLE_ACTIONS_PER_TURN);
    expect(orchestrator.callHistory).toHaveLength(1);
    expect(entityManager.instanceRequests).toContain('room-1');

    expect(
      logger.logs.warn.some(([message]) =>
        message.includes(
          'Encountered 1 formatting error(s) during action discovery'
        )
      )
    ).toBe(true);
    expect(
      logger.logs.warn.some(([message]) =>
        message.includes(
          "Action 'broken:action' (Target: target-99): Formatting failed"
        )
      )
    ).toBe(true);
    expect(
      logger.logs.warn.some(([message]) =>
        message.includes('[Overflow] actor=actor-1 requested=')
      )
    ).toBe(true);
    expect(logger.logs.groupCollapsed).toContain(
      'Action Discovery Trace for actor-1'
    );
    expect(logger.logs.table[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: 'prepare' }),
        expect.objectContaining({ stage: 'generate' }),
      ])
    );

    const cachedResults = await provider.get(actor, baseContext, logger);
    expect(cachedResults).toEqual(initialResults);
    expect(orchestrator.callHistory).toHaveLength(1);
    expect(
      logger.logs.debug.some(([message]) =>
        message.includes(
          '[Cache Hit] Returning cached actions for actor actor-1'
        )
      )
    ).toBe(true);

    const nextContext = { game: { turn: 2 } };
    const refreshedResults = await provider.get(actor, nextContext, logger);
    expect(refreshedResults).toHaveLength(2);
    expect(orchestrator.callHistory).toHaveLength(2);

    await provider.get(actor, nextContext, logger);
    expect(orchestrator.callHistory).toHaveLength(2);

    await eventBus.dispatch(COMPONENT_ADDED_ID, null);
    await provider.get(actor, nextContext, logger);
    expect(orchestrator.callHistory).toHaveLength(2);

    await eventBus.dispatch(COMPONENT_ADDED_ID, {
      componentTypeId: 'core:mood',
    });
    await provider.get(actor, nextContext, logger);
    expect(orchestrator.callHistory).toHaveLength(2);

    await eventBus.dispatch(COMPONENT_ADDED_ID, {
      componentTypeId: 'items:container.backpack',
    });
    await provider.get(actor, nextContext, logger);
    expect(orchestrator.callHistory).toHaveLength(3);

    await provider.get(actor, nextContext, logger);
    expect(orchestrator.callHistory).toHaveLength(3);

    await eventBus.dispatch(COMPONENTS_BATCH_ADDED_ID, {
      componentTypeIds: null,
    });
    await provider.get(actor, nextContext, logger);
    expect(orchestrator.callHistory).toHaveLength(3);

    await eventBus.dispatch(COMPONENTS_BATCH_ADDED_ID, {
      componentTypeIds: ['core:mood', 'stats:health'],
    });
    await provider.get(actor, nextContext, logger);
    expect(orchestrator.callHistory).toHaveLength(3);

    await eventBus.dispatch(COMPONENTS_BATCH_ADDED_ID, {
      componentTypeIds: ['items:inventory', 'stats:health'],
    });
    await provider.get(actor, nextContext, logger);
    expect(orchestrator.callHistory).toHaveLength(4);

    entityManager.createEntity('actor-2');
    const actorWithoutLocation = entityManager.getEntityInstance('actor-2');
    const thirdContext = { game: { turn: 3 } };
    const newActorResults = await provider.get(
      actorWithoutLocation,
      thirdContext,
      logger
    );
    expect(newActorResults).toHaveLength(2);
    expect(orchestrator.callHistory).toHaveLength(5);

    provider.destroy();
    expect(
      logger.logs.debug.some(([message]) =>
        message.includes('AvailableActionsProvider: Destroyed and cleaned up')
      )
    ).toBe(true);
  });

  it('logs and recovers when discovery throws errors', async () => {
    const failingLogger = new CapturingLogger();
    const failingEntityManager = new TrackingEntityManager([
      {
        id: 'actor-throw',
        components: {
          [POSITION_COMPONENT_ID]: { locationId: null },
        },
      },
    ]);
    const throwActor = failingEntityManager.getEntityInstance('actor-throw');
    const failingOrchestrator = new ThrowingOrchestrator();

    const failingService = new ActionDiscoveryService({
      entityManager: failingEntityManager,
      logger: failingLogger,
      actionPipelineOrchestrator: failingOrchestrator,
      traceContextFactory: () => ({
        info() {},
        step() {},
        async withSpanAsync(_name, fn) {
          return await fn();
        },
      }),
      getActorLocationFn: () => null,
    });

    const failingIndexer = new ActionIndexerAdapter(
      new ActionIndexingService({ logger: failingLogger })
    );
    const failingBus = new EventBus({ logger: failingLogger });

    const failingProvider = new AvailableActionsProvider({
      actionDiscoveryService: failingService,
      actionIndexingService: failingIndexer,
      entityManager: failingEntityManager,
      eventBus: failingBus,
      logger: failingLogger,
    });

    const result = await failingProvider.get(
      throwActor,
      { game: { turn: 1 } },
      failingLogger
    );
    expect(result).toEqual([]);
    expect(failingOrchestrator.calls).toBe(1);
    expect(
      failingLogger.logs.error.some(([message]) =>
        message.includes(
          'AvailableActionsProvider: Error discovering/indexing actions for actor-throw: discovery failed'
        )
      )
    ).toBe(true);

    failingProvider.destroy();
  });
});
