import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { AvailableActionsProvider } from '../../../../src/data/providers/availableActionsProvider.js';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../../../src/constants/core.js';

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

  beforeEach(() => {
    serviceSetup = {
      setupService: jest.fn((name, logger) => logger),
    };
    logger = createLogger(true);
    entityManager = { getEntityInstance: jest.fn() };
    actionDiscoveryService = { getValidActions: jest.fn() };
    actionIndexer = { index: jest.fn() };
    actor = new MockEntity('actor1', {});
    provider = new AvailableActionsProvider({
      actionDiscoveryService,
      actionIndexingService: actionIndexer,
      entityManager,
      logger,
      serviceSetup,
    });
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
});
