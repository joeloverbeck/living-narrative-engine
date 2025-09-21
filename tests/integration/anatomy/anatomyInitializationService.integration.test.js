import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

function createHarness({ generationImplementation } = {}) {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const unsubscribe = jest.fn();
  let entityCreatedHandler = null;

  const eventDispatcher = {
    subscribe: jest.fn((eventId, handler) => {
      if (eventId === ENTITY_CREATED_ID) {
        entityCreatedHandler = handler;
      }
      return unsubscribe;
    }),
  };

  const anatomyGenerationService = {
    generateAnatomyIfNeeded: jest
      .fn(generationImplementation || (() => Promise.resolve(false))),
  };

  const service = new AnatomyInitializationService({
    eventDispatcher,
    logger,
    anatomyGenerationService,
  });

  return {
    logger,
    eventDispatcher,
    anatomyGenerationService,
    service,
    unsubscribe,
    getEntityCreatedHandler: () => entityCreatedHandler,
  };
}

function waitForMicrotask() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('AnatomyInitializationService integration', () => {
  let harness;

  beforeEach(() => {
    harness = createHarness();
  });

  afterEach(() => {
    harness.service.destroy();
  });

  it('validates required dependencies in the constructor', () => {
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const eventDispatcher = { subscribe: jest.fn() };
    const generationService = { generateAnatomyIfNeeded: jest.fn() };

    expect(
      () =>
        new AnatomyInitializationService({
          logger,
          anatomyGenerationService: generationService,
        })
    ).toThrow(new InvalidArgumentError('eventDispatcher is required'));

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher,
          anatomyGenerationService: generationService,
        })
    ).toThrow(new InvalidArgumentError('logger is required'));

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher,
          logger,
        })
    ).toThrow(new InvalidArgumentError('anatomyGenerationService is required'));
  });

  it('registers the entity created subscription only once and warns on reinitialization', () => {
    harness.service.initialize();

    expect(harness.eventDispatcher.subscribe).toHaveBeenCalledTimes(1);
    expect(harness.eventDispatcher.subscribe).toHaveBeenCalledWith(
      ENTITY_CREATED_ID,
      expect.any(Function)
    );
    expect(harness.logger.info).toHaveBeenCalledWith(
      'AnatomyInitializationService: Initialized'
    );

    harness.service.initialize();

    expect(harness.logger.warn).toHaveBeenCalledWith(
      'AnatomyInitializationService: Already initialized'
    );
    expect(harness.eventDispatcher.subscribe).toHaveBeenCalledTimes(1);
  });

  it('ignores reconstructed entities and missing instance identifiers', async () => {
    harness.service.initialize();
    const handler = harness.getEntityCreatedHandler();
    expect(typeof handler).toBe('function');

    await handler({ payload: { instanceId: 'entity-1', wasReconstructed: true } });
    expect(harness.anatomyGenerationService.generateAnatomyIfNeeded).not.toHaveBeenCalled();

    await handler({ payload: {} });
    expect(harness.logger.warn).toHaveBeenCalledWith(
      "AnatomyInitializationService: Entity created event missing instanceId"
    );
  });

  it('accepts raw event objects without payload wrappers', async () => {
    harness.service.initialize();
    const handler = harness.getEntityCreatedHandler();

    let resolveGeneration;
    harness.anatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        })
    );

    await handler({ instanceId: 'entity-direct' });
    await waitForMicrotask();

    const waiter = harness.service.waitForEntityGeneration('entity-direct');
    resolveGeneration(true);

    await expect(waiter).resolves.toBe(true);
  });

  it('processes queued generations sequentially and resolves waiters', async () => {
    harness.service.initialize();
    const handler = harness.getEntityCreatedHandler();

    const resolvers = {};
    harness.anatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
      (entityId) =>
        new Promise((resolve) => {
          resolvers[entityId] = resolve;
        })
    );

    await handler({ payload: { instanceId: 'entity-A' } });
    await handler({ payload: { instanceId: 'entity-B' } });

    await waitForMicrotask();

    expect(harness.service.hasPendingGenerations()).toBe(true);
    expect(harness.service.getPendingGenerationCount()).toBe(2);

    const firstWait = harness.service.waitForEntityGeneration('entity-A');
    const secondWait = harness.service.waitForEntityGeneration('entity-B');

    resolvers['entity-A'](true);
    await expect(firstWait).resolves.toBe(true);
    expect(harness.logger.info).toHaveBeenCalledWith(
      "AnatomyInitializationService: Generated anatomy for entity 'entity-A'"
    );
    expect(harness.service.hasPendingGenerations()).toBe(true);

    resolvers['entity-B'](false);
    await expect(secondWait).resolves.toBe(false);

    await harness.service.waitForAllGenerationsToComplete();
    expect(harness.service.hasPendingGenerations()).toBe(false);
    expect(harness.service.getPendingGenerationCount()).toBe(0);
  });

  it('rejects waiters when generation fails and logs the error', async () => {
    harness.service.initialize();
    const handler = harness.getEntityCreatedHandler();

    let rejectGeneration;
    const failure = new Error('generation failed');
    harness.anatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectGeneration = reject;
        })
    );

    await handler({ payload: { instanceId: 'entity-fail' } });
    await waitForMicrotask();

    const waitPromise = harness.service.waitForEntityGeneration('entity-fail');
    rejectGeneration(failure);

    await expect(waitPromise).rejects.toBe(failure);
    expect(harness.logger.error).toHaveBeenCalledWith(
      "AnatomyInitializationService: Failed to generate anatomy for entity 'entity-fail'",
      { error: failure }
    );
  });

  it('logs generation failures even when no waiters are registered', async () => {
    harness.service.initialize();
    const handler = harness.getEntityCreatedHandler();

    const failure = new Error('silent failure');
    harness.anatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValueOnce(
      failure
    );

    await handler({ payload: { instanceId: 'entity-without-waiter' } });
    await waitForMicrotask();

    expect(harness.logger.error).toHaveBeenCalledWith(
      "AnatomyInitializationService: Failed to generate anatomy for entity 'entity-without-waiter'",
      { error: failure }
    );
  });

  it('returns false immediately from waitForEntityGeneration when nothing is pending', async () => {
    harness.service.initialize();
    await expect(harness.service.waitForEntityGeneration('ghost-entity')).resolves.toBe(false);
  });

  it('allows multiple waiters to observe the same generation result', async () => {
    harness.service.initialize();
    const handler = harness.getEntityCreatedHandler();

    let resolveGeneration;
    harness.anatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        })
    );

    await handler({ payload: { instanceId: 'entity-multi' } });
    await waitForMicrotask();

    const waiterA = harness.service.waitForEntityGeneration('entity-multi');
    const waiterB = harness.service.waitForEntityGeneration('entity-multi');

    resolveGeneration(true);

    await expect(waiterA).resolves.toBe(true);
    await expect(waiterB).resolves.toBe(true);
  });

  it('supports generating anatomy explicitly and propagates failures', async () => {
    harness.service.initialize();

    harness.anatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValueOnce(false);
    await expect(harness.service.generateAnatomy('entity-W', 'blueprint-0')).resolves.toBe(
      false
    );
    expect(harness.logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining("entity 'entity-W'")
    );

    harness.anatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValueOnce(true);
    await expect(harness.service.generateAnatomy('entity-X', 'blueprint-1')).resolves.toBe(true);
    expect(harness.logger.info).toHaveBeenCalledWith(
      "AnatomyInitializationService: Successfully generated anatomy for entity 'entity-X' with blueprint 'blueprint-1'"
    );

    const failure = new Error('manual generation failed');
    harness.anatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValueOnce(failure);
    await expect(
      harness.service.generateAnatomy('entity-Y', 'blueprint-2')
    ).rejects.toBe(failure);
    expect(harness.logger.error).toHaveBeenCalledWith(
      "AnatomyInitializationService: Failed to generate anatomy for entity 'entity-Y' with blueprint 'blueprint-2'",
      { error: failure }
    );
  });

  it('times out when pending generations never resolve', async () => {
    harness.service.initialize();
    const handler = harness.getEntityCreatedHandler();

    let resolveGeneration;
    harness.anatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        })
    );

    await handler({ payload: { instanceId: 'entity-timeout' } });
    await waitForMicrotask();

    await expect(
      harness.service.waitForAllGenerationsToComplete(50)
    ).rejects.toThrow(
      /AnatomyInitializationService: Timeout waiting for anatomy generation to complete/
    );

    resolveGeneration(false);
    await harness.service.waitForAllGenerationsToComplete();
  });

  it('cleans up resources when destroyed', async () => {
    harness.service.initialize();
    const handler = harness.getEntityCreatedHandler();

    harness.anatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(false);
    await handler({ payload: { instanceId: 'entity-cleanup' } });
    await harness.service.waitForAllGenerationsToComplete();

    harness.service.destroy();

    expect(harness.unsubscribe).toHaveBeenCalledTimes(1);
    expect(harness.service.hasPendingGenerations()).toBe(false);
    expect(harness.service.getPendingGenerationCount()).toBe(0);
  });
});
