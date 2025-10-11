import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AnatomyInitializationService queue processing', () => {
  let dispatcher;
  let logger;
  let generationService;
  let unsubscribe;
  let service;
  let boundHandler;

  const setupService = () => {
    unsubscribe = jest.fn();
    dispatcher = {
      subscribe: jest.fn((eventId, handler) => {
        if (eventId === ENTITY_CREATED_ID) {
          boundHandler = handler;
        }
        return unsubscribe;
      }),
    };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    generationService = {
      generateAnatomyIfNeeded: jest.fn(),
    };

    service = new AnatomyInitializationService({
      eventDispatcher: dispatcher,
      logger,
      anatomyGenerationService: generationService,
    });

    service.initialize();
  };

  const emitEntityCreated = async (payload) => {
    await boundHandler({
      type: ENTITY_CREATED_ID,
      payload: { wasReconstructed: false, ...payload },
    });
  };

  beforeEach(() => {
    setupService();
  });

  it('processes queued entities sequentially and resolves waiters', async () => {
    const resolvers = new Map();
    generationService.generateAnatomyIfNeeded.mockImplementation(
      (entityId) =>
        new Promise((resolve) => {
          resolvers.set(entityId, resolve);
        })
    );

    await emitEntityCreated({ instanceId: 'alpha' });
    await emitEntityCreated({ instanceId: 'beta' });

    await flushMicrotasks();

    expect(generationService.generateAnatomyIfNeeded).toHaveBeenCalledTimes(1);
    expect(service.hasPendingGenerations()).toBe(true);
    expect(service.getPendingGenerationCount()).toBe(2);

    const waitAlpha = service.waitForEntityGeneration('alpha', 50);

    resolvers.get('alpha')(true);
    await flushMicrotasks();

    await expect(waitAlpha).resolves.toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      "AnatomyInitializationService: Generated anatomy for entity 'alpha'"
    );

    await flushMicrotasks();
    expect(generationService.generateAnatomyIfNeeded).toHaveBeenCalledTimes(2);

    const waitBeta = service.waitForEntityGeneration('beta', 50);
    resolvers.get('beta')(false);
    await flushMicrotasks();

    await expect(waitBeta).resolves.toBe(false);

    await flushMicrotasks();
    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);
  });

  it('rejects waiters when generation fails and logs the error', async () => {
    const failure = new Error('generation failed');
    generationService.generateAnatomyIfNeeded.mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(failure), 5);
        })
    );

    await emitEntityCreated({ instanceId: 'omega' });
    await flushMicrotasks();

    const waitOmega = service.waitForEntityGeneration('omega', 50);

    await expect(waitOmega).rejects.toBe(failure);
    expect(logger.error).toHaveBeenCalledWith(
      "AnatomyInitializationService: Failed to generate anatomy for entity 'omega'",
      { error: failure }
    );
  });

  it('waits for active generations before resolving waitForAllGenerationsToComplete', async () => {
    const resolvers = new Map();
    generationService.generateAnatomyIfNeeded.mockImplementation(
      (entityId) =>
        new Promise((resolve) => {
          resolvers.set(entityId, resolve);
        })
    );

    await emitEntityCreated({ instanceId: 'queued' });
    await flushMicrotasks();

    const waitPromise = service.waitForAllGenerationsToComplete(200);

    expect(service.hasPendingGenerations()).toBe(true);

    setTimeout(() => {
      resolvers.get('queued')(true);
    }, 5);

    await expect(waitPromise).resolves.toBeUndefined();
    expect(logger.debug).toHaveBeenCalledWith(
      'AnatomyInitializationService: All anatomy generations completed'
    );
  });

  it('throws when waitForAllGenerationsToComplete exceeds its timeout', async () => {
    generationService.generateAnatomyIfNeeded.mockReturnValue(
      new Promise(() => {})
    );

    await emitEntityCreated({ instanceId: 'stalled' });
    await flushMicrotasks();

    const waitPromise = service.waitForAllGenerationsToComplete(30);

    await expect(waitPromise).rejects.toThrow(
      'AnatomyInitializationService: Timeout waiting for anatomy generation to complete'
    );

    service.destroy();
  });

  it('delegates generateAnatomy to the generation service and propagates errors', async () => {
    generationService.generateAnatomyIfNeeded
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(service.generateAnatomy('entity-7', 'blueprint-1')).resolves.toBe(
      true
    );

    expect(generationService.generateAnatomyIfNeeded).toHaveBeenCalledWith(
      'entity-7'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "AnatomyInitializationService: Generating anatomy for entity 'entity-7' with blueprint 'blueprint-1'"
    );
    expect(logger.info).toHaveBeenCalledWith(
      "AnatomyInitializationService: Successfully generated anatomy for entity 'entity-7' with blueprint 'blueprint-1'"
    );

    const noChangeResult = await service.generateAnatomy(
      'entity-9',
      'blueprint-3'
    );
    expect(noChangeResult).toBe(false);

    const failure = new Error('bad blueprint');
    generationService.generateAnatomyIfNeeded.mockRejectedValueOnce(failure);

    await expect(
      service.generateAnatomy('entity-8', 'blueprint-2')
    ).rejects.toBe(failure);
    expect(logger.error).toHaveBeenCalledWith(
      "AnatomyInitializationService: Failed to generate anatomy for entity 'entity-8' with blueprint 'blueprint-2'",
      { error: failure }
    );
  });

  it('clears internal state on destroy and unsubscribes listeners', async () => {
    const resolvers = new Map();
    generationService.generateAnatomyIfNeeded.mockImplementation(
      (entityId) =>
        new Promise((resolve) => {
          resolvers.set(entityId, resolve);
        })
    );

    await emitEntityCreated({ instanceId: 'gamma' });
    await flushMicrotasks();

    expect(service.hasPendingGenerations()).toBe(true);

    service.destroy();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);
    expect(logger.info).toHaveBeenCalledWith(
      'AnatomyInitializationService: Destroyed'
    );
  });

  it('validates constructor dependencies and initialization guard rails', () => {
    const loggerOnly = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const generationOnly = { generateAnatomyIfNeeded: jest.fn() };

    expect(
      () =>
        new AnatomyInitializationService({
          logger: loggerOnly,
          anatomyGenerationService: generationOnly,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: dispatcher,
          anatomyGenerationService: generationOnly,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: dispatcher,
          logger: loggerOnly,
        })
    ).toThrow(InvalidArgumentError);

    service.initialize();

    expect(logger.warn).toHaveBeenCalledWith(
      'AnatomyInitializationService: Already initialized'
    );
  });

  it('ignores reconstructed events and warns about missing instance identifiers', async () => {
    await emitEntityCreated({ instanceId: 'restored', wasReconstructed: true });
    expect(generationService.generateAnatomyIfNeeded).not.toHaveBeenCalled();

    await emitEntityCreated({ definitionId: 'def-1', instanceId: undefined });
    expect(logger.warn).toHaveBeenCalledWith(
      'AnatomyInitializationService: Entity created event missing instanceId'
    );
  });

  it('handles waitForEntityGeneration edge cases', async () => {
    expect(await service.waitForEntityGeneration('unknown')).toBe(false);

    const resolvers = new Map();
    generationService.generateAnatomyIfNeeded.mockImplementation(
      (entityId) =>
        new Promise((resolve) => {
          resolvers.set(entityId, resolve);
        })
    );

    await emitEntityCreated({ instanceId: 'delta' });
    await flushMicrotasks();

    const firstWait = service.waitForEntityGeneration('delta', 50);
    const secondWait = service.waitForEntityGeneration('delta', 50);

    resolvers.get('delta')(true);
    await flushMicrotasks();

    await expect(firstWait).resolves.toBe(true);
    await expect(secondWait).resolves.toBe(true);
  });

  it('destroys safely when no listeners were registered', () => {
    const freshService = new AnatomyInitializationService({
      eventDispatcher: dispatcher,
      logger,
      anatomyGenerationService: generationService,
    });

    freshService.destroy();

    expect(logger.info).toHaveBeenCalledWith(
      'AnatomyInitializationService: Destroyed'
    );
  });
});
