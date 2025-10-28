import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { AvailableActionsProvider } from '../../../../src/data/providers/availableActionsProvider.js';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../../../src/constants/core.js';
import {
  COMPONENT_ADDED_ID,
  COMPONENTS_BATCH_ADDED_ID,
} from '../../../../src/constants/eventIds.js';
import { ServiceSetup } from '../../../../src/utils/serviceInitializerUtils.js';

const createLogger = (withTable = false) => {
  const logger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  };
  if (withTable) {
    logger.table = jest.fn();
    logger.groupCollapsed = jest.fn();
    logger.groupEnd = jest.fn();
  }
  return logger;
};

class MockEntity {
  constructor(id, components = {}) {
    this.id = id;
    this._components = components;
  }
  getComponentData(id) {
    return this._components[id];
  }
}

describe('AvailableActionsProvider additional branches', () => {
  let provider;
  let logger;
  let entityManager;
  let actionDiscoveryService;
  let actionIndexer;
  let serviceSetup;
  let actor;
  let subscriptions;
  let componentChangeHandler;
  let batchChangeHandler;
  let eventBus;
  const turnContext = { game: { turn: 1 } };

  beforeEach(() => {
    serviceSetup = {
      setupService: jest.fn((name, logger) => logger),
    };
    logger = createLogger(true);
    entityManager = { getEntityInstance: jest.fn() };
    entityManager.getEntityInstance.mockResolvedValue(null);
    actionDiscoveryService = { getValidActions: jest.fn() };
    actionDiscoveryService.getValidActions.mockResolvedValue({
      actions: [
        { id: 'core:wait', command: 'wait', params: {}, description: 'Wait' },
      ],
      errors: [],
      trace: null,
    });
    actionIndexer = { index: jest.fn() };
    actionIndexer.index.mockReturnValue([
      {
        index: 1,
        actionId: 'core:wait',
        commandString: 'wait',
        params: {},
        description: 'Wait',
      },
    ]);
    actor = new MockEntity('actor1', {});
    subscriptions = [];
    eventBus = {
      subscribe: jest.fn((eventId, handler) => {
        const unsubscribeFn = jest.fn();
        subscriptions.push({ eventId, handler, unsubscribe: unsubscribeFn });
        return unsubscribeFn;
      }),
      unsubscribe: jest.fn(),
    };
    provider = new AvailableActionsProvider({
      actionDiscoveryService,
      actionIndexingService: actionIndexer,
      entityManager,
      eventBus,
      logger,
      serviceSetup,
    });
    componentChangeHandler = subscriptions.find(
      (sub) => sub.eventId === COMPONENT_ADDED_ID
    )?.handler;
    batchChangeHandler = subscriptions.find(
      (sub) => sub.eventId === COMPONENTS_BATCH_ADDED_ID
    )?.handler;
  });

  it('handles missing position component gracefully', async () => {
    actionDiscoveryService.getValidActions.mockResolvedValue({
      actions: [],
      errors: [],
    });
    entityManager.getEntityInstance.mockResolvedValue(null);
    await provider.get(actor, { game: {} }, logger);
    const context = actionDiscoveryService.getValidActions.mock.calls[0][1];
    expect(context.currentLocation).toBeNull();
  });

  it('logs discovery trace when supported by logger', async () => {
    const trace = { logs: [{ id: 1 }] };
    actionDiscoveryService.getValidActions.mockResolvedValue({
      actions: [],
      errors: [],
      trace,
    });
    actionIndexer.index.mockReturnValue([]);
    await provider.get(actor, { game: {} }, logger);
    expect(logger.groupCollapsed).toHaveBeenCalledWith(
      'Action Discovery Trace for actor1'
    );
    expect(logger.table).toHaveBeenCalledWith(trace.logs);
    expect(logger.groupEnd).toHaveBeenCalled();
  });

  it('logs formatting errors', async () => {
    const errors = [{ actionId: 'a', targetId: 't', error: 'bad' }];
    actionDiscoveryService.getValidActions.mockResolvedValue({
      actions: [],
      errors,
    });
    actionIndexer.index.mockReturnValue([]);
    await provider.get(actor, { game: {} }, logger);
    expect(logger.warn).toHaveBeenCalledWith(
      `Encountered ${errors.length} formatting error(s) during action discovery for actor ${actor.id}. These actions will not be available.`
    );
    expect(logger.warn).toHaveBeenCalledWith(
      `  - Action '${errors[0].actionId}' (Target: ${errors[0].targetId}): ${errors[0].error}`
    );
  });

  it('uses "N/A" when formatting error targetId is missing', async () => {
    const errors = [{ actionId: 'b', error: 'missing target' }];
    actionDiscoveryService.getValidActions.mockResolvedValue({
      actions: [],
      errors,
    });
    actionIndexer.index.mockReturnValue([]);

    await provider.get(actor, { game: {} }, logger);

    expect(logger.warn).toHaveBeenCalledWith(
      `Encountered ${errors.length} formatting error(s) during action discovery for actor ${actor.id}. These actions will not be available.`
    );
    expect(logger.warn).toHaveBeenCalledWith(
      `  - Action '${errors[0].actionId}' (Target: N/A): ${errors[0].error}`
    );
  });

  it('does not warn when below overflow threshold', async () => {
    const actions = Array.from(
      { length: MAX_AVAILABLE_ACTIONS_PER_TURN - 1 },
      (_, i) => ({ id: `a${i}` })
    );
    actionDiscoveryService.getValidActions.mockResolvedValue({
      actions,
      errors: [],
    });
    actionIndexer.index.mockReturnValue(actions);
    await provider.get(actor, { game: {} }, logger);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('subscribes to component change events and cleans up on destroy', () => {
    expect(eventBus.subscribe).toHaveBeenCalledTimes(2);
    expect(subscriptions.map((sub) => sub.eventId)).toEqual([
      COMPONENT_ADDED_ID,
      COMPONENTS_BATCH_ADDED_ID,
    ]);

    provider.destroy();

    // The eventBus.subscribe returns unsubscribe functions
    // The destroy() method should call each unsubscribe function
    expect(subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscriptions[1].unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('falls back to the default ServiceSetup when none is provided', () => {
    const setupSpy = jest
      .spyOn(ServiceSetup.prototype, 'setupService')
      .mockReturnValue(logger);

    const localEventBus = {
      subscribe: jest.fn().mockReturnValue({}),
      unsubscribe: jest.fn(),
    };

    let defaultProvider;
    try {
      defaultProvider = new AvailableActionsProvider({
        actionDiscoveryService,
        actionIndexingService: actionIndexer,
        entityManager,
        eventBus: localEventBus,
        logger,
      });

      expect(setupSpy).toHaveBeenCalledWith(
        'AvailableActionsProvider',
        logger,
        expect.objectContaining({
          actionDiscoveryService: expect.any(Object),
          actionIndexer: expect.any(Object),
          entityManager: expect.any(Object),
        })
      );
    } finally {
      defaultProvider?.destroy();
      setupSpy.mockRestore();
    }
  });

  it('keeps cache when component event lacks a type', async () => {
    expect(componentChangeHandler).toBeDefined();
    await provider.get(actor, turnContext, logger);
    actionDiscoveryService.getValidActions.mockClear();
    actionIndexer.index.mockClear();

    componentChangeHandler({ payload: {} });
    componentChangeHandler({});

    await provider.get(actor, turnContext, logger);

    expect(actionDiscoveryService.getValidActions).not.toHaveBeenCalled();
    expect(actionIndexer.index).not.toHaveBeenCalled();
  });

  it('invalidates cache when component event affects availability', async () => {
    expect(componentChangeHandler).toBeDefined();
    await provider.get(actor, turnContext, logger);
    actionDiscoveryService.getValidActions.mockClear();
    actionIndexer.index.mockClear();

    componentChangeHandler({
      payload: { componentTypeId: 'core:position' },
    });

    await provider.get(actor, turnContext, logger);

    expect(actionDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);
    expect(actionIndexer.index).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('core:position component change')
    );
  });

  it('does not invalidate cache for unrelated component events', async () => {
    expect(componentChangeHandler).toBeDefined();
    await provider.get(actor, turnContext, logger);
    actionDiscoveryService.getValidActions.mockClear();
    actionIndexer.index.mockClear();

    componentChangeHandler({
      payload: { componentTypeId: 'npc:emotion' },
    });

    await provider.get(actor, turnContext, logger);

    expect(actionDiscoveryService.getValidActions).not.toHaveBeenCalled();
    expect(actionIndexer.index).not.toHaveBeenCalled();
  });

  it('ignores batch events without component lists', async () => {
    expect(batchChangeHandler).toBeDefined();
    await provider.get(actor, turnContext, logger);
    actionDiscoveryService.getValidActions.mockClear();
    actionIndexer.index.mockClear();

    batchChangeHandler({ payload: null });
    batchChangeHandler({ payload: { componentTypeIds: 'not-an-array' } });

    await provider.get(actor, turnContext, logger);

    expect(actionDiscoveryService.getValidActions).not.toHaveBeenCalled();
    expect(actionIndexer.index).not.toHaveBeenCalled();
  });

  it('invalidates cache when batch event contains affecting component', async () => {
    expect(batchChangeHandler).toBeDefined();
    await provider.get(actor, turnContext, logger);
    actionDiscoveryService.getValidActions.mockClear();
    actionIndexer.index.mockClear();

    batchChangeHandler({
      payload: {
        componentTypeIds: ['npc:emotion', 'items:inventory'],
      },
    });

    await provider.get(actor, turnContext, logger);

    expect(actionDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);
    expect(actionIndexer.index).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('batch component changes')
    );
  });

  it('retains cache when batch component change does not affect availability', async () => {
    expect(batchChangeHandler).toBeDefined();
    await provider.get(actor, turnContext, logger);
    actionDiscoveryService.getValidActions.mockClear();
    actionIndexer.index.mockClear();

    batchChangeHandler({
      payload: {
        componentTypeIds: ['npc:emotion', 'world:time'],
      },
    });

    await provider.get(actor, turnContext, logger);

    expect(actionDiscoveryService.getValidActions).not.toHaveBeenCalled();
    expect(actionIndexer.index).not.toHaveBeenCalled();
  });
});
