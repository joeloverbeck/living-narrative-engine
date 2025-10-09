import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const advanceTimers = async (ms) => {
  jest.advanceTimersByTime(ms);
  await flushMicrotasks();
};

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

    it('throws when logger dependency is missing', () => {
      expect(
        () =>
          new AnatomyInitializationService({
            eventDispatcher: setup.eventDispatcher,
            logger: undefined,
            anatomyGenerationService: setup.anatomyGenerationService,
          }),
      ).toThrow(new InvalidArgumentError('logger is required'));
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

    it('processes event objects without payload by treating them as the payload', async () => {
      const handler = setup.getBoundHandler();

      await handler({
        type: ENTITY_CREATED_ID,
        instanceId: 'entity-direct',
        definitionId: 'definition-direct',
        wasReconstructed: false,
      });

      await flushMicrotasks();
      await setup.service.waitForAllGenerationsToComplete();

      expect(
        setup.anatomyGenerationService.generateAnatomyIfNeeded,
      ).toHaveBeenCalledWith('entity-direct');
    });
  });

  describe('queue management fallbacks', () => {
    beforeEach(() => {
      setup.initialize();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('continues processing without restarting when new events arrive mid-queue', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(0);

      const processedEntities = [];
      let resolveFirst;
      setup.anatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        (entityId) => {
          processedEntities.push(entityId);
          if (processedEntities.length === 1) {
            return new Promise((resolve) => {
              resolveFirst = resolve;
            });
          }
          return Promise.resolve(false);
        },
      );

      const handler = setup.getBoundHandler();
      handler({
        payload: { instanceId: 'entity-a', wasReconstructed: false },
      });
      await flushMicrotasks();

      handler({
        payload: { instanceId: 'entity-b', wasReconstructed: false },
      });
      await flushMicrotasks();

      expect(processedEntities).toEqual(['entity-a']);

      resolveFirst(true);
      await flushMicrotasks();
      await advanceTimers(60);

      await setup.service.waitForAllGenerationsToComplete();

      expect(processedEntities).toEqual(['entity-a', 'entity-b']);
    });

    it('performs repeated wait checks before completing successfully', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(0);

      let resolveGeneration;
      setup.anatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGeneration = resolve;
          }),
      );

      const handler = setup.getBoundHandler();
      handler({
        payload: { instanceId: 'entity-loop', wasReconstructed: false },
      });
      await flushMicrotasks();

      const waitPromise = setup.service.waitForAllGenerationsToComplete(200);

      await advanceTimers(40);
      await advanceTimers(40);

      resolveGeneration(true);
      await flushMicrotasks();
      await advanceTimers(60);

      await expect(waitPromise).resolves.toBeUndefined();
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

    it('supports multiple waiters per entity using the default timeout', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(0);

      let resolveGeneration;
      setup.anatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGeneration = resolve;
          }),
      );

      const handler = setup.getBoundHandler();
      handler({
        payload: { instanceId: 'entity-shared', wasReconstructed: false },
      });
      await flushMicrotasks();

      const waitDefault = setup.service.waitForEntityGeneration('entity-shared');
      const waitCustom = setup.service.waitForEntityGeneration(
        'entity-shared',
        400,
      );

      resolveGeneration(true);
      await flushMicrotasks();
      await advanceTimers(60);

      await expect(waitDefault).resolves.toBe(true);
      await expect(waitCustom).resolves.toBe(true);
    });

    it('gracefully handles generation failures when no listeners are waiting', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(0);

      const failure = new Error('generation-failure');
      setup.anatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValueOnce(
        failure,
      );

      const handler = setup.getBoundHandler();
      await handler({
        payload: { instanceId: 'entity-fail', wasReconstructed: false },
      });

      await flushMicrotasks();
      await advanceTimers(60);

      expect(setup.logger.error).toHaveBeenCalledWith(
        "AnatomyInitializationService: Failed to generate anatomy for entity 'entity-fail'",
        { error: failure },
      );

      await expect(
        setup.service.waitForAllGenerationsToComplete(),
      ).resolves.toBeUndefined();
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
