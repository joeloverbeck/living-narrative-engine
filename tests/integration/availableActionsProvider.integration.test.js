import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AvailableActionsProvider } from '../../src/data/providers/availableActionsProvider.js';
import { ActionIndexingService } from '../../src/turns/services/actionIndexingService.js';
import { ActionIndexerAdapter } from '../../src/turns/adapters/actionIndexerAdapter.js';
import { TurnActionChoicePipeline } from '../../src/turns/pipeline/turnActionChoicePipeline.js';

/**
 * @class StubEntity
 * @description Minimal entity used for tests. Provides an ID and a
 *              getComponentData method returning a fake position component.
 */
class StubEntity {
  /**
   * @param {string} id - Unique identifier for the entity.
   */
  constructor(id) {
    this.id = id;
  }

  /**
   * @returns {{ locationId: null }} Position component stub.
   */
  getComponentData() {
    return { locationId: null };
  }
}

describe('Integration – AvailableActionsProvider caching', () => {
  /** @type {import('../../src/interfaces/coreServices.js').ILogger} */
  let logger;
  let discoverySvc;
  let indexingService;
  let provider;
  let entityManager;
  let pipeline;
  let actor;
  let context;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    discoverySvc = { getValidActions: jest.fn() };
    indexingService = new ActionIndexerAdapter(
      new ActionIndexingService({ logger })
    );
    entityManager = { getEntityInstance: jest.fn().mockResolvedValue(null) };

    provider = new AvailableActionsProvider({
      actionDiscoveryService: discoverySvc,
      actionIndexingService: indexingService,
      entityManager,
    });

    pipeline = new TurnActionChoicePipeline({
      availableActionsProvider: provider,
      logger,
    });

    actor = new StubEntity('actor');
    context = { game: { turn: 1 }, getActor: () => actor };
  });

  it('reuses cached actions within a single turn', async () => {
    const discovered = [{ id: 'core:wait', command: 'Wait', params: {} }];
    discoverySvc.getValidActions.mockResolvedValue(discovered);

    const first = await pipeline.buildChoices(actor, context);
    const second = await pipeline.buildChoices(actor, context);

    expect(first).toEqual(second);
    expect(discoverySvc.getValidActions).toHaveBeenCalledTimes(1);
  });

  it('clears cache when turn context changes', async () => {
    discoverySvc.getValidActions.mockResolvedValue([
      { id: 'core:wait', command: 'Wait', params: {} },
    ]);

    await pipeline.buildChoices(actor, context);
    const newContext = { game: { turn: 2 }, getActor: () => actor };
    await pipeline.buildChoices(actor, newContext);

    expect(discoverySvc.getValidActions).toHaveBeenCalledTimes(2);
  });
});
