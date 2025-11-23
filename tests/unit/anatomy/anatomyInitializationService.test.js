import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createDispatcher = () => ({
  subscribe: jest.fn(),
});

const createGenerationService = () => ({
  generateAnatomyIfNeeded: jest.fn(),
});

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('AnatomyInitializationService', () => {
  let logger;
  let dispatcher;
  let generationService;
  let service;
  let unsubscribe;

  beforeEach(() => {
    logger = createLogger();
    dispatcher = createDispatcher();
    generationService = createGenerationService();
    unsubscribe = jest.fn();

    dispatcher.subscribe.mockImplementation((_eventId, handler) => {
      dispatcher.__handler = handler;
      return unsubscribe;
    });

    generationService.generateAnatomyIfNeeded.mockResolvedValue(true);

    service = new AnatomyInitializationService({
      eventDispatcher: dispatcher,
      logger,
      anatomyGenerationService: generationService,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const getHandler = () => {
    service.initialize();
    expect(dispatcher.subscribe).toHaveBeenCalledWith(
      ENTITY_CREATED_ID,
      expect.any(Function),
    );
    return dispatcher.__handler;
  };

  it('requires dispatcher, logger and anatomy generation service', () => {
    expect(
      () =>
        new AnatomyInitializationService({
          logger,
          anatomyGenerationService: generationService,
        }),
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: dispatcher,
          anatomyGenerationService: generationService,
        }),
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: dispatcher,
          logger,
        }),
    ).toThrow(InvalidArgumentError);
  });

  it('initialises once and logs when asked to initialise again', () => {
    const handler = getHandler();
    expect(typeof handler).toBe('function');
    expect(logger.info).toHaveBeenCalledWith(
      'AnatomyInitializationService: Initialized',
    );
    expect(logger.debug.mock.calls.some(([message]) =>
      message.includes('Registering event listeners'),
    )).toBe(true);

    logger.warn.mockClear();
    dispatcher.subscribe.mockClear();
    service.initialize();

    expect(logger.warn).toHaveBeenCalledWith(
      'AnatomyInitializationService: Already initialized',
    );
    expect(dispatcher.subscribe).not.toHaveBeenCalled();
  });

  it('ignores reconstructed entities and missing identifiers', async () => {
    const handler = getHandler();

    await handler({ payload: { instanceId: 'reconstructed', wasReconstructed: true } });
    expect(generationService.generateAnatomyIfNeeded).not.toHaveBeenCalled();

    logger.warn.mockClear();
    await handler({ payload: {} });

    expect(logger.warn).toHaveBeenCalledWith(
      'AnatomyInitializationService: Entity created event missing instanceId',
    );
  });

  it('treats the incoming event as payload when no payload wrapper is provided', async () => {
    const deferred = createDeferred();
    generationService.generateAnatomyIfNeeded.mockReturnValueOnce(deferred.promise);
    const handler = getHandler();

    await handler({ instanceId: 'raw-event' });
    const waitPromise = service.waitForEntityGeneration('raw-event');

    deferred.resolve(true);
    await expect(waitPromise).resolves.toBe(true);
  });

  it('processes queued entities sequentially and resolves waiters', async () => {
    const deferreds = new Map();
    generationService.generateAnatomyIfNeeded.mockImplementation((id) => {
      const deferred = createDeferred();
      deferreds.set(id, deferred);
      return deferred.promise;
    });

    const handler = getHandler();

    const queueResult = [
      handler({ payload: { instanceId: 'entity-one' } }),
      handler({ payload: { instanceId: 'entity-two' } }),
    ];
    await Promise.all(queueResult);

    expect(generationService.generateAnatomyIfNeeded).toHaveBeenCalledTimes(1);
    expect(generationService.generateAnatomyIfNeeded).toHaveBeenNthCalledWith(1, 'entity-one');

    const waitForOne = service.waitForEntityGeneration('entity-one');
    deferreds.get('entity-one').resolve(true);
    await expect(waitForOne).resolves.toBe(true);

    await Promise.resolve();

    expect(generationService.generateAnatomyIfNeeded).toHaveBeenCalledTimes(2);
    expect(generationService.generateAnatomyIfNeeded).toHaveBeenNthCalledWith(2, 'entity-two');

    const waitForTwo = service.waitForEntityGeneration('entity-two');
    deferreds.get('entity-two').resolve(false);
    await expect(waitForTwo).resolves.toBe(false);

    await service.waitForAllGenerationsToComplete();

    expect(logger.info).toHaveBeenCalledWith(
      "AnatomyInitializationService: Generated anatomy for entity 'entity-one'",
    );
    expect(
      logger.info.mock.calls.some(([message]) =>
        message.includes("entity 'entity-two'"),
      ),
    ).toBe(false);
    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);
  });

  it('resolves waitForAllGenerationsToComplete when the queue drains before the deadline', async () => {
    const deferred = createDeferred();
    generationService.generateAnatomyIfNeeded.mockReturnValueOnce(deferred.promise);

    const handler = getHandler();
    const handlePromise = handler({ payload: { instanceId: 'timely' } });
    const waitAllPromise = service.waitForAllGenerationsToComplete(500);

    deferred.resolve(true);
    await handlePromise;
    await expect(waitAllPromise).resolves.toBeUndefined();
  });

  it('processes the queue via the test helper when the processing flag must be reset', async () => {
    getHandler();

    generationService.generateAnatomyIfNeeded.mockResolvedValueOnce(false);

    service.__TEST_ONLY__setInternalState({
      queue: ['direct-process'],
      processing: false,
    });

    await service.__TEST_ONLY__processQueue({ ensureProcessingFlag: true });

    expect(generationService.generateAnatomyIfNeeded).toHaveBeenCalledWith(
      'direct-process',
    );
    expect(service.hasPendingGenerations()).toBe(false);
    expect(
      logger.debug.mock.calls.some(([message]) =>
        message.includes('Finished processing anatomy generation queue'),
      ),
    ).toBe(true);
  });

  it('logs failures and rejects waiters when anatomy generation fails', async () => {
    const failure = new Error('generation failed');
    const deferred = createDeferred();

    // Track when generateAnatomyIfNeeded is called
    let generationStarted = false;
    generationService.generateAnatomyIfNeeded.mockImplementation(() => {
      generationStarted = true;
      return deferred.promise;
    });

    const handler = getHandler();

    // Trigger the generation - this adds to queue and starts processing (deferred)
    const invokePromise = handler({ payload: { instanceId: 'failing-entity' } });

    // Wait one tick for entity to be added to pending generations
    await new Promise(resolve => setImmediate(resolve));

    // Now register waiter after entity is pending
    const waitPromise = service.waitForEntityGeneration('failing-entity');

    // Wait for queue processing to actually call generateAnatomyIfNeeded
    while (!generationStarted) {
      await new Promise(resolve => setImmediate(resolve));
    }

    // Now reject after generation has actually started
    deferred.reject(failure);

    await invokePromise;
    await expect(waitPromise).rejects.toBe(failure);

    expect(logger.error).toHaveBeenCalledWith(
      "AnatomyInitializationService: Failed to generate anatomy for entity 'failing-entity'",
      { error: failure },
    );
    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);
  });

  it('supports multiple waiters for the same pending entity', async () => {
    const deferred = createDeferred();
    generationService.generateAnatomyIfNeeded.mockReturnValueOnce(deferred.promise);

    const handler = getHandler();
    await handler({ payload: { instanceId: 'shared' } });

    const waitOne = service.waitForEntityGeneration('shared');
    const waitTwo = service.waitForEntityGeneration('shared');

    deferred.resolve(true);

    await expect(waitOne).resolves.toBe(true);
    await expect(waitTwo).resolves.toBe(true);
  });

  it('clears pending timeouts when generation finishes before the deadline', async () => {
    jest.useFakeTimers();

    const deferred = createDeferred();
    generationService.generateAnatomyIfNeeded.mockReturnValueOnce(deferred.promise);

    const handler = getHandler();
    await handler({ payload: { instanceId: 'timely' } });

    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      const waitPromise = service.waitForEntityGeneration('timely', 25);

      deferred.resolve(true);

      await expect(waitPromise).resolves.toBe(true);

      jest.advanceTimersByTime(50);
      await Promise.resolve();

      expect(unhandledRejections).toHaveLength(0);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
  });

  it('handles generation failures gracefully when no waiters are registered', async () => {
    const failure = new Error('silent failure');
    generationService.generateAnatomyIfNeeded.mockRejectedValueOnce(failure);

    const handler = getHandler();
    await handler({ payload: { instanceId: 'no-waiters' } });
    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.error).toHaveBeenCalledWith(
      "AnatomyInitializationService: Failed to generate anatomy for entity 'no-waiters'",
      { error: failure },
    );
    expect(await service.waitForEntityGeneration('no-waiters')).toBe(false);
  });

  it('returns false immediately when waiting for non-pending entities', async () => {
    getHandler();
    await expect(service.waitForEntityGeneration('missing')).resolves.toBe(false);
  });

  it('times out when waiting for entity generation that never resolves', async () => {
    getHandler();
    jest.useFakeTimers();

    service.__TEST_ONLY__setInternalState({ pending: ['stuck-entity'] });

    const waitPromise = service.waitForEntityGeneration('stuck-entity', 5);

    jest.advanceTimersByTime(5);
    await expect(waitPromise).rejects.toThrow(
      "AnatomyInitializationService: Timeout waiting for anatomy generation for entity 'stuck-entity'",
    );
  });

  it('throws when waiting for all generations but the queue never drains', async () => {
    getHandler();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    service.__TEST_ONLY__setInternalState({ queue: ['stalled'], processing: true });

    await expect(service.waitForAllGenerationsToComplete(0)).rejects.toThrow(
      'AnatomyInitializationService: Timeout waiting for anatomy generation to complete. Queue: 1, Pending: 0',
    );
    nowSpy.mockRestore();
  });

  it('throws immediately when the observed time already exceeds the deadline', async () => {
    getHandler();
    const timeValues = [100, 205];
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => timeValues.shift() ?? 205);

    service.__TEST_ONLY__setInternalState({ queue: ['late'], processing: true });

    await expect(service.waitForAllGenerationsToComplete(100)).rejects.toThrow(
      'AnatomyInitializationService: Timeout waiting for anatomy generation to complete. Queue: 1, Pending: 0',
    );

    nowSpy.mockRestore();
  });

  it('throws after the delay when the deadline is exceeded during the wait loop', async () => {
    getHandler();
    jest.useFakeTimers();
    const timeValues = [0, 60, 150];
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => timeValues.shift() ?? 150);

    service.__TEST_ONLY__setInternalState({ queue: ['linger'], processing: true });

    const waitPromise = service.waitForAllGenerationsToComplete(100);

    jest.advanceTimersByTime(50);

    await expect(waitPromise).rejects.toThrow(
      'AnatomyInitializationService: Timeout waiting for anatomy generation to complete. Queue: 1, Pending: 0',
    );

    nowSpy.mockRestore();
  });

  it('allows destroy to be called before initialization without an unsubscribe function', () => {
    service.destroy();

    expect(unsubscribe).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('AnatomyInitializationService: Destroyed');
  });

  it('cleans up subscriptions and state when destroyed', () => {
    getHandler();

    service.__TEST_ONLY__setInternalState({
      queue: ['entity-a'],
      pending: ['entity-b'],
      processing: true,
    });

    service.destroy();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);
    expect(logger.info).toHaveBeenCalledWith('AnatomyInitializationService: Destroyed');
  });

  it('supports invoking the state helper without overrides', () => {
    getHandler();
    service.__TEST_ONLY__setInternalState();
    expect(service.hasPendingGenerations()).toBe(false);
  });

  it('delegates generateAnatomy and logs success and failures', async () => {
    getHandler();

    generationService.generateAnatomyIfNeeded.mockResolvedValueOnce(true);
    await expect(
      service.generateAnatomy('entity-x', 'bp-1'),
    ).resolves.toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      "AnatomyInitializationService: Successfully generated anatomy for entity 'entity-x' with blueprint 'bp-1'",
    );

    generationService.generateAnatomyIfNeeded.mockResolvedValueOnce(false);
    await expect(
      service.generateAnatomy('entity-y', 'bp-2'),
    ).resolves.toBe(false);

    const error = new Error('boom');
    generationService.generateAnatomyIfNeeded.mockRejectedValueOnce(error);
    await expect(
      service.generateAnatomy('entity-z', 'bp-3'),
    ).rejects.toBe(error);
    expect(logger.error).toHaveBeenCalledWith(
      "AnatomyInitializationService: Failed to generate anatomy for entity 'entity-z' with blueprint 'bp-3'",
      { error },
    );
  });

  it('processes queues with the default test helper options', async () => {
    getHandler();
    generationService.generateAnatomyIfNeeded.mockResolvedValueOnce(false);

    service.__TEST_ONLY__setInternalState({ queue: ['default-option'], processing: true });

    await service.__TEST_ONLY__processQueue();

    expect(generationService.generateAnatomyIfNeeded).toHaveBeenCalledWith(
      'default-option',
    );
    expect(service.hasPendingGenerations()).toBe(false);
  });
});
