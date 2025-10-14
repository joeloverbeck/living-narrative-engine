import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('AnatomyInitializationService - high coverage agent suite', () => {
  let logger;
  let eventDispatcher;
  let generationService;
  let service;
  let subscribers;

  beforeEach(() => {
    subscribers = new Map();
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    eventDispatcher = {
      subscribe: jest.fn((eventId, handler) => {
        subscribers.set(eventId, handler);
        return () => subscribers.delete(eventId);
      }),
    };
    generationService = {
      generateAnatomyIfNeeded: jest.fn(),
    };

    service = new AnatomyInitializationService({
      eventDispatcher,
      logger,
      anatomyGenerationService: generationService,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const getEntityCreatedHandler = () => {
    expect(eventDispatcher.subscribe).toHaveBeenCalledWith(
      ENTITY_CREATED_ID,
      expect.any(Function)
    );
    return subscribers.get(ENTITY_CREATED_ID);
  };

  it('validates required dependencies', () => {
    expect(
      () =>
        new AnatomyInitializationService({
          logger,
          anatomyGenerationService: generationService,
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher,
          anatomyGenerationService: generationService,
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher,
          logger,
        })
    ).toThrow(InvalidArgumentError);
  });

  it('initializes once and warns on repeated initialization', () => {
    service.initialize();
    expect(eventDispatcher.subscribe).toHaveBeenCalledWith(
      ENTITY_CREATED_ID,
      expect.any(Function)
    );
    expect(logger.info).toHaveBeenCalledWith(
      'AnatomyInitializationService: Initialized'
    );

    service.initialize();
    expect(logger.warn).toHaveBeenCalledWith(
      'AnatomyInitializationService: Already initialized'
    );
  });

  it('ignores reconstructed entities and missing instance identifiers', async () => {
    service.initialize();
    const handler = getEntityCreatedHandler();

    await handler({ payload: { instanceId: 'restored', wasReconstructed: true } });
    expect(generationService.generateAnatomyIfNeeded).not.toHaveBeenCalled();
    expect(service.hasPendingGenerations()).toBe(false);

    await handler({ payload: {} });
    expect(logger.warn).toHaveBeenCalledWith(
      'AnatomyInitializationService: Entity created event missing instanceId'
    );
    expect(service.hasPendingGenerations()).toBe(false);

    generationService.generateAnatomyIfNeeded.mockResolvedValueOnce(false);
    await handler({ instanceId: 'direct-event' });
    await service.waitForAllGenerationsToComplete();
    expect(generationService.generateAnatomyIfNeeded).toHaveBeenCalledWith(
      'direct-event'
    );
  });

  it('processes queue sequentially, resolves waiters and tracks pending state', async () => {
    service.initialize();
    const handler = getEntityCreatedHandler();

    const callSequence = [];
    const deferreds = new Map();
    generationService.generateAnatomyIfNeeded.mockImplementation((entityId) => {
      callSequence.push(`start:${entityId}`);
      const deferred = createDeferred();
      deferreds.set(entityId, deferred);
      return deferred.promise.then((result) => {
        callSequence.push(`finish:${entityId}`);
        return result;
      });
    });

    await handler({ payload: { instanceId: 'entity-1' } });
    await handler({ payload: { instanceId: 'entity-2' } });

    expect(service.hasPendingGenerations()).toBe(true);
    expect(service.getPendingGenerationCount()).toBe(2);
    expect(callSequence).toEqual(['start:entity-1']);

    const waitFirst = service.waitForEntityGeneration('entity-1');
    deferreds.get('entity-1').resolve(true);
    expect(await waitFirst).toBe(true);

    await Promise.resolve();
    expect(callSequence).toEqual(['start:entity-1', 'finish:entity-1', 'start:entity-2']);
    expect(service.getPendingGenerationCount()).toBe(1);

    const waitSecondPrimary = service.waitForEntityGeneration('entity-2');
    const waitSecondSecondary = service.waitForEntityGeneration('entity-2');
    deferreds.get('entity-2').resolve(false);
    const [primaryResult, secondaryResult] = await Promise.all([
      waitSecondPrimary,
      waitSecondSecondary,
    ]);
    expect(primaryResult).toBe(false);
    expect(secondaryResult).toBe(false);

    await service.waitForAllGenerationsToComplete();
    expect(service.hasPendingGenerations()).toBe(false);
    expect(callSequence).toEqual([
      'start:entity-1',
      'finish:entity-1',
      'start:entity-2',
      'finish:entity-2',
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      "AnatomyInitializationService: Generated anatomy for entity 'entity-1'"
    );
  });

  it('rejects waiting promises when generation fails and logs the error', async () => {
    service.initialize();
    const handler = getEntityCreatedHandler();

    const deferred = createDeferred();
    const failure = new Error('generation failed');
    generationService.generateAnatomyIfNeeded.mockReturnValueOnce(deferred.promise);

    await handler({ payload: { instanceId: 'problem' } });
    const waitPromise = service.waitForEntityGeneration('problem');
    const secondWaiter = service.waitForEntityGeneration('problem');

    deferred.reject(failure);

    await expect(waitPromise).rejects.toBe(failure);
    await expect(secondWaiter).rejects.toBe(failure);
    await service.waitForAllGenerationsToComplete();

    expect(logger.error).toHaveBeenCalledWith(
      "AnatomyInitializationService: Failed to generate anatomy for entity 'problem'",
      { error: failure }
    );
  });

  it('wraps generateAnatomy calls with detailed logging and error propagation', async () => {
    generationService.generateAnatomyIfNeeded
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await expect(service.generateAnatomy('hero', 'default')).resolves.toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      "AnatomyInitializationService: Generating anatomy for entity 'hero' with blueprint 'default'"
    );
    expect(logger.info).toHaveBeenCalledWith(
      "AnatomyInitializationService: Successfully generated anatomy for entity 'hero' with blueprint 'default'"
    );

    await expect(service.generateAnatomy('observer', 'default')).resolves.toBe(false);

    const failure = new Error('boom');
    generationService.generateAnatomyIfNeeded.mockRejectedValueOnce(failure);
    await expect(service.generateAnatomy('villain', 'special')).rejects.toBe(failure);
    expect(logger.error).toHaveBeenCalledWith(
      "AnatomyInitializationService: Failed to generate anatomy for entity 'villain' with blueprint 'special'",
      { error: failure }
    );
  });

  it('waits for global completion using the internal loop and handles timeout', async () => {
    jest.useFakeTimers();

    service.__TEST_ONLY__setInternalState({
      queue: ['one'],
      pending: ['one'],
      processing: true,
    });

    const completionPromise = service.waitForAllGenerationsToComplete(100);

    setTimeout(() => {
      service.__TEST_ONLY__setInternalState({
        queue: [],
        pending: [],
        processing: false,
      });
    }, 25);

    jest.advanceTimersByTime(25);
    await Promise.resolve();
    jest.advanceTimersByTime(25);
    await Promise.resolve();
    await expect(completionPromise).resolves.toBeUndefined();
    expect(logger.debug).toHaveBeenCalledWith(
      'AnatomyInitializationService: All anatomy generations completed'
    );

    service.__TEST_ONLY__setInternalState({
      queue: ['stuck'],
      pending: ['stuck'],
      processing: true,
    });

    const timeoutPromise = service.waitForAllGenerationsToComplete(30);
    jest.advanceTimersByTime(35);
    await Promise.resolve();
    await expect(timeoutPromise).rejects.toThrow(
      'AnatomyInitializationService: Timeout waiting for anatomy generation to complete. Queue: 1, Pending: 1'
    );
  });

  it('throws immediately when deadlines are already exceeded or exhausted', async () => {
    service.__TEST_ONLY__setInternalState({
      queue: ['expired'],
      pending: ['expired'],
      processing: true,
    });

    await expect(service.waitForAllGenerationsToComplete(-5)).rejects.toThrow(
      'AnatomyInitializationService: Timeout waiting for anatomy generation to complete. Queue: 1, Pending: 1'
    );

    const nowSpy = jest.spyOn(Date, 'now');
    const sequence = [5000, 5000, 5000];
    nowSpy.mockImplementation(() => sequence.shift() ?? 5000);

    service.__TEST_ONLY__setInternalState({
      queue: ['no-time'],
      pending: ['no-time'],
      processing: true,
    });

    await expect(service.waitForAllGenerationsToComplete(0)).rejects.toThrow(
      'AnatomyInitializationService: Timeout waiting for anatomy generation to complete. Queue: 1, Pending: 1'
    );

    nowSpy.mockRestore();
  });

  it('waits for specific entity completion or timeout and handles immediate non-pending case', async () => {
    await expect(service.waitForEntityGeneration('unknown')).resolves.toBe(false);

    service.__TEST_ONLY__setInternalState({ pending: ['entity'] });
    jest.useFakeTimers();
    const timeoutPromise = service.waitForEntityGeneration('entity', 20);
    jest.advanceTimersByTime(25);
    await Promise.resolve();
    await expect(timeoutPromise).rejects.toThrow(
      "AnatomyInitializationService: Timeout waiting for anatomy generation for entity 'entity'"
    );
  });

  it('exposes helpers for manipulating internal queue state and processing flag', async () => {
    service.__TEST_ONLY__setInternalState({
      queue: ['a', 'b'],
      pending: ['c'],
      processing: true,
    });
    expect(service.getPendingGenerationCount()).toBe(3);
    expect(service.hasPendingGenerations()).toBe(true);

    service.__TEST_ONLY__setInternalState({ queue: ['x'], pending: [], processing: false });
    expect(service.getPendingGenerationCount()).toBe(1);

    generationService.generateAnatomyIfNeeded.mockResolvedValueOnce(true);
    await service.__TEST_ONLY__processQueue({ ensureProcessingFlag: true });
    expect(generationService.generateAnatomyIfNeeded).toHaveBeenCalledWith('x');
    expect(service.hasPendingGenerations()).toBe(false);

    service.__TEST_ONLY__setInternalState();
    service.__TEST_ONLY__setInternalState({ queue: 'not-array', pending: 'not-array' });

    const silentFailure = new Error('no watchers present');
    generationService.generateAnatomyIfNeeded.mockRejectedValueOnce(silentFailure);
    service.__TEST_ONLY__setInternalState({ queue: ['lonely'], processing: true });
    await service.__TEST_ONLY__processQueue({ ensureProcessingFlag: true });

    await service.__TEST_ONLY__processQueue();
  });

  it('cleans up listeners and internal state when destroyed', () => {
    service.initialize();
    expect(subscribers.has(ENTITY_CREATED_ID)).toBe(true);

    service.__TEST_ONLY__setInternalState({
      queue: ['queued'],
      pending: ['pending'],
      processing: true,
    });

    service.destroy();

    expect(subscribers.has(ENTITY_CREATED_ID)).toBe(false);
    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);
    expect(logger.info).toHaveBeenCalledWith(
      'AnatomyInitializationService: Destroyed'
    );

    logger.info.mockClear();
    service.destroy();
    expect(logger.info).toHaveBeenCalledWith(
      'AnatomyInitializationService: Destroyed'
    );
  });
});
