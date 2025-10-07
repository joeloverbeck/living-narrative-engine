import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';

describe('AnatomyInitializationService uncovered guard and queue paths', () => {
  /** @type {ReturnType<typeof setupService>} */
  let setup;

  const setupService = (overrides = {}) => {
    const mockUnsubscribe = jest.fn();
    let boundHandler = null;

    const eventDispatcher =
      overrides.eventDispatcher ??
      {
        subscribe: jest.fn((eventId, handler) => {
          boundHandler = handler;
          return mockUnsubscribe;
        }),
      };

    const logger =
      overrides.logger ??
      {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

    const anatomyGenerationService =
      overrides.anatomyGenerationService ??
      {
        generateAnatomyIfNeeded: jest.fn().mockResolvedValue(true),
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
      mockUnsubscribe,
      getBoundHandler: () => boundHandler,
      initialize: () => {
        service.initialize();
        return boundHandler;
      },
    };
  };

  beforeEach(() => {
    setup = setupService();
  });

  describe('constructor guards', () => {
    it('throws when eventDispatcher dependency is missing', () => {
      expect(
        () =>
          new AnatomyInitializationService({
            eventDispatcher: undefined,
            logger: setup.logger,
            anatomyGenerationService: setup.anatomyGenerationService,
          }),
      ).toThrow(new InvalidArgumentError('eventDispatcher is required'));
    });

    it('throws when anatomyGenerationService dependency is missing', () => {
      expect(
        () =>
          new AnatomyInitializationService({
            eventDispatcher: setup.eventDispatcher,
            logger: setup.logger,
            anatomyGenerationService: undefined,
          }),
      ).toThrow(new InvalidArgumentError('anatomyGenerationService is required'));
    });
  });

  describe('initialize behaviour', () => {
    it('registers listeners only once and warns on repeated initialization', () => {
      const handler = setup.initialize();

      expect(setup.eventDispatcher.subscribe).toHaveBeenCalledWith(
        ENTITY_CREATED_ID,
        handler,
      );
      expect(setup.eventDispatcher.subscribe).toHaveBeenCalledTimes(1);

      setup.service.initialize();

      expect(setup.logger.warn).toHaveBeenCalledWith(
        'AnatomyInitializationService: Already initialized',
      );
      expect(setup.eventDispatcher.subscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('entity creation edge cases', () => {
    beforeEach(() => {
      setup.initialize();
    });

    it('ignores reconstructed entities and leaves the queue untouched', async () => {
      const handler = setup.getBoundHandler();
      expect(handler).toBeInstanceOf(Function);

      await handler({
        payload: { instanceId: 'entity-keep', wasReconstructed: true },
      });

      expect(setup.anatomyGenerationService.generateAnatomyIfNeeded).not.toHaveBeenCalled();
      expect(setup.service.getPendingGenerationCount()).toBe(0);
      expect(setup.service.hasPendingGenerations()).toBe(false);
    });

    it('warns when the entity payload omits an instanceId', async () => {
      const handler = setup.getBoundHandler();
      await handler({ payload: { wasReconstructed: false } });

      expect(setup.logger.warn).toHaveBeenCalledWith(
        'AnatomyInitializationService: Entity created event missing instanceId',
      );
      expect(setup.service.getPendingGenerationCount()).toBe(0);
    });
  });

  describe('queue management fallbacks', () => {
    beforeEach(() => {
      setup.initialize();
    });

    it('surfaces a timeout when generations never finish', async () => {
      let resolveGeneration;
      setup.anatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGeneration = resolve;
          }),
      );

      const handler = setup.getBoundHandler();
      handler({
        payload: { instanceId: 'entity-timeout', wasReconstructed: false },
      });

      await expect(
        setup.service.waitForAllGenerationsToComplete(75),
      ).rejects.toThrow(
        'AnatomyInitializationService: Timeout waiting for anatomy generation to complete. Queue: 0, Pending: 1',
      );

      resolveGeneration(true);
      await setup.service.waitForAllGenerationsToComplete();
    });

    it('cleans up subscriptions and pending work when destroyed', async () => {
      let resolveGeneration;
      setup.anatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGeneration = resolve;
          }),
      );

      const handler = setup.getBoundHandler();
      handler({
        payload: { instanceId: 'entity-destroy', wasReconstructed: false },
      });

      expect(setup.service.hasPendingGenerations()).toBe(true);

      setup.service.destroy();

      expect(setup.mockUnsubscribe).toHaveBeenCalledTimes(1);
      expect(setup.service.hasPendingGenerations()).toBe(false);
      expect(setup.service.getPendingGenerationCount()).toBe(0);
      expect(setup.logger.info).toHaveBeenCalledWith(
        'AnatomyInitializationService: Destroyed',
      );

      resolveGeneration(true);
      await setup.service.waitForAllGenerationsToComplete();

      setup.service.initialize();
      expect(setup.eventDispatcher.subscribe).toHaveBeenCalledTimes(2);
    });
  });
});
