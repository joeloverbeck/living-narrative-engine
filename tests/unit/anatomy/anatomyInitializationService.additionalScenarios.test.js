import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

function createService(overrides = {}) {
  const unsubscribeSpy = jest.fn();
  let capturedHandler;

  const eventDispatcher =
    overrides.eventDispatcher ||
    {
      subscribe: jest.fn((_eventId, callback) => {
        capturedHandler = callback;
        return () => unsubscribeSpy();
      }),
    };

  const logger =
    overrides.logger ||
    {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

  const anatomyGenerationService =
    overrides.anatomyGenerationService ||
    {
      generateAnatomyIfNeeded: jest.fn().mockResolvedValue(false),
    };

  const service = new AnatomyInitializationService({
    eventDispatcher,
    logger,
    anatomyGenerationService,
  });

  return {
    service,
    logger,
    eventDispatcher,
    anatomyGenerationService,
    unsubscribeSpy,
    getEntityCreatedHandler() {
      if (!capturedHandler) {
        throw new Error('Entity created handler not registered. Call initialize() first.');
      }
      return capturedHandler;
    },
  };
}

describe('AnatomyInitializationService additional coverage scenarios', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('validates required constructor dependencies', () => {
    const baseLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const baseDispatcher = { subscribe: jest.fn() };
    const baseGeneration = { generateAnatomyIfNeeded: jest.fn() };

    expect(
      () =>
        new AnatomyInitializationService({
          logger: baseLogger,
          anatomyGenerationService: baseGeneration,
        }),
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: baseDispatcher,
          anatomyGenerationService: baseGeneration,
        }),
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: baseDispatcher,
          logger: baseLogger,
        }),
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: baseDispatcher,
          logger: baseLogger,
          anatomyGenerationService: baseGeneration,
        }),
    ).not.toThrow();
  });

  it('warns when initialize is invoked more than once', () => {
    const { service, eventDispatcher, logger } = createService();

    service.initialize();
    service.initialize();

    expect(eventDispatcher.subscribe).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'AnatomyInitializationService: Already initialized',
    );
  });

  it('ignores reconstructed entities when handling creation events', async () => {
    const { service, anatomyGenerationService, getEntityCreatedHandler } = createService();

    service.initialize();
    const handler = getEntityCreatedHandler();
    await handler({ payload: { instanceId: 'entity-1', wasReconstructed: true } });

    expect(anatomyGenerationService.generateAnatomyIfNeeded).not.toHaveBeenCalled();
    expect(service.hasPendingGenerations()).toBe(false);
  });

  it('logs a warning when the creation event is missing an instanceId', async () => {
    const { service, logger, getEntityCreatedHandler } = createService();

    service.initialize();
    const handler = getEntityCreatedHandler();
    await handler({ payload: { definitionId: 'def-1' } });

    expect(logger.warn).toHaveBeenCalledWith(
      'AnatomyInitializationService: Entity created event missing instanceId',
    );
    expect(service.hasPendingGenerations()).toBe(false);
  });

  it('rejects waitForAllGenerationsToComplete when the queue never clears', async () => {
    jest.useFakeTimers();

    let resolveGeneration;
    const anatomyGenerationService = {
      generateAnatomyIfNeeded: jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGeneration = resolve;
          }),
      ),
    };

    const { service, getEntityCreatedHandler } = createService({ anatomyGenerationService });

    service.initialize();
    const handler = getEntityCreatedHandler();
    await handler({ payload: { instanceId: 'stuck-entity' } });

    const waitPromise = service.waitForAllGenerationsToComplete(60);
    await jest.advanceTimersByTimeAsync(200);

    await expect(waitPromise).rejects.toThrow(
      'AnatomyInitializationService: Timeout waiting for anatomy generation to complete',
    );

    resolveGeneration(false);
    await Promise.resolve();
    const cleanup = service.waitForAllGenerationsToComplete(200);
    await jest.advanceTimersByTimeAsync(200);
    await cleanup;
  });

  it('destroys listeners and resets internal state', async () => {
    const { service, logger, unsubscribeSpy, getEntityCreatedHandler } = createService();

    service.initialize();
    const handler = getEntityCreatedHandler();
    await handler({ payload: { instanceId: 'entity-cleanup' } });
    await service.waitForAllGenerationsToComplete(200);

    service.destroy();
    service.destroy();

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(logger.info.mock.calls.map(([msg]) => msg)).toContain(
      'AnatomyInitializationService: Destroyed',
    );
    expect(service.hasPendingGenerations()).toBe(false);
  });
});
