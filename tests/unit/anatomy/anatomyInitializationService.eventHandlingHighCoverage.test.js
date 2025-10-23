import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const flushAsyncOperations = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

const createContext = () => {
  let capturedHandler = null;

  const eventDispatcher = {
    subscribe: jest.fn((eventId, handler) => {
      capturedHandler = handler;
      return jest.fn();
    }),
  };

  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const anatomyGenerationService = {
    generateAnatomyIfNeeded: jest.fn().mockResolvedValue(false),
  };

  const service = new AnatomyInitializationService({
    eventDispatcher,
    logger,
    anatomyGenerationService,
  });

  return {
    service,
    eventDispatcher,
    logger,
    anatomyGenerationService,
    getEntityCreatedHandler: () => capturedHandler,
  };
};

describe('AnatomyInitializationService constructor and event handling', () => {
  /** @type {ReturnType<typeof createContext>} */
  let context;

  beforeEach(() => {
    context = createContext();
  });

  it('validates required dependencies in the constructor', () => {
    expect(
      () =>
        new AnatomyInitializationService({
          logger: context.logger,
          anatomyGenerationService: context.anatomyGenerationService,
        }),
    ).toThrow(new InvalidArgumentError('eventDispatcher is required'));

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: context.eventDispatcher,
          anatomyGenerationService: context.anatomyGenerationService,
        }),
    ).toThrow(new InvalidArgumentError('logger is required'));

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: context.eventDispatcher,
          logger: context.logger,
        }),
    ).toThrow(new InvalidArgumentError('anatomyGenerationService is required'));
  });

  it('subscribes to entity creation events exactly once and warns on duplicate initialization', () => {
    context.service.initialize();
    expect(context.eventDispatcher.subscribe).toHaveBeenCalledWith(
      ENTITY_CREATED_ID,
      expect.any(Function),
    );
    expect(context.logger.info).toHaveBeenCalledWith(
      'AnatomyInitializationService: Initialized',
    );

    context.service.initialize();
    expect(context.logger.warn).toHaveBeenCalledWith(
      'AnatomyInitializationService: Already initialized',
    );
    expect(context.eventDispatcher.subscribe).toHaveBeenCalledTimes(1);
  });

  it('ignores reconstructed entities without scheduling generation', async () => {
    context.service.initialize();
    const handler = context.getEntityCreatedHandler();

    await handler({
      payload: {
        instanceId: 'entity-123',
        wasReconstructed: true,
      },
    });

    await flushAsyncOperations();

    expect(context.anatomyGenerationService.generateAnatomyIfNeeded).not.toHaveBeenCalled();
    expect(context.service.hasPendingGenerations()).toBe(false);
  });

  it('logs a warning when entity creation events omit the instanceId', async () => {
    context.service.initialize();
    const handler = context.getEntityCreatedHandler();

    await handler({ payload: {} });

    expect(context.logger.warn).toHaveBeenCalledWith(
      'AnatomyInitializationService: Entity created event missing instanceId',
    );
    expect(context.service.getPendingGenerationCount()).toBe(0);
  });

  it('queues new entities and processes anatomy generation successfully', async () => {
    context.anatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValueOnce(true);

    context.service.initialize();
    const handler = context.getEntityCreatedHandler();

    await handler({ payload: { instanceId: 'fresh-entity' } });

    await flushAsyncOperations();

    expect(context.anatomyGenerationService.generateAnatomyIfNeeded).toHaveBeenCalledWith(
      'fresh-entity',
    );
    expect(context.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Added entity 'fresh-entity' to generation queue"),
    );
    expect(context.logger.info).toHaveBeenCalledWith(
      "AnatomyInitializationService: Generated anatomy for entity 'fresh-entity'",
    );
    expect(context.service.hasPendingGenerations()).toBe(false);
  });

  it('logs failures from the anatomy generation service and clears pending state', async () => {
    const generationError = new Error('generation failed');
    context.anatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValueOnce(
      generationError,
    );

    context.service.initialize();
    const handler = context.getEntityCreatedHandler();

    await handler({ payload: { instanceId: 'problematic-entity' } });

    await flushAsyncOperations();

    expect(context.anatomyGenerationService.generateAnatomyIfNeeded).toHaveBeenCalledWith(
      'problematic-entity',
    );
    expect(context.logger.error).toHaveBeenCalledWith(
      "AnatomyInitializationService: Failed to generate anatomy for entity 'problematic-entity'",
      { error: generationError },
    );
    expect(context.service.hasPendingGenerations()).toBe(false);
  });
});
