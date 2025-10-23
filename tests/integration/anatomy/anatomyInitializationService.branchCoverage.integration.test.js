import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import EventBus from '../../../src/events/eventBus.js';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';

class ControlledAnatomyGenerationService {
  constructor() {
    this.calls = [];
    this.pending = new Map();
    this.immediateResults = [];
  }

  queueImmediateResult(result) {
    this.immediateResults.push({ type: 'resolve', value: result });
  }

  queueImmediateError(error) {
    this.immediateResults.push({ type: 'reject', error });
  }

  generateAnatomyIfNeeded(entityId) {
    this.calls.push(entityId);

    if (this.immediateResults.length > 0) {
      const next = this.immediateResults.shift();
      if (next.type === 'resolve') {
        return Promise.resolve(next.value);
      }
      return Promise.reject(next.error);
    }

    return new Promise((resolve, reject) => {
      this.pending.set(entityId, { resolve, reject });
    });
  }

  resolve(entityId, value = true) {
    const deferred = this.pending.get(entityId);
    if (!deferred) {
      throw new Error(`No pending generation for ${entityId}`);
    }
    this.pending.delete(entityId);
    deferred.resolve(value);
  }

  reject(entityId, error) {
    const deferred = this.pending.get(entityId);
    if (!deferred) {
      throw new Error(`No pending generation for ${entityId}`);
    }
    this.pending.delete(entityId);
    deferred.reject(error);
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('AnatomyInitializationService branch coverage integration', () => {
  let logger;
  let eventBus;
  let generationService;
  let service;

  beforeEach(() => {
    logger = createLogger();
    eventBus = new EventBus({ logger });
    generationService = new ControlledAnatomyGenerationService();
    service = new AnatomyInitializationService({
      eventDispatcher: eventBus,
      logger,
      anatomyGenerationService: generationService,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('falls back to the event object when payload is missing', async () => {
    service.initialize();

    await eventBus.dispatch(ENTITY_CREATED_ID);
    await flushMicrotasks();

    expect(generationService.calls).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('missing instanceId')
    );
  });

  it('returns false from generateAnatomy when the generation service reports no work', async () => {
    service.initialize();
    const infoCallsBefore = logger.info.mock.calls.length;

    generationService.queueImmediateResult(false);
    const generated = await service.generateAnatomy('actor-unused', 'bp-id');

    expect(generated).toBe(false);
    const newInfoMessages = logger.info.mock.calls
      .slice(infoCallsBefore)
      .map(([message]) => message);
    expect(newInfoMessages).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "Successfully generated anatomy for entity 'actor-unused'"
        ),
      ])
    );
  });

  it('waitForAllGenerationsToComplete throws immediately when timeout is zero', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(1000);
    service.__TEST_ONLY__setInternalState({
      queue: ['stalled-zero'],
      processing: true,
    });

    await expect(service.waitForAllGenerationsToComplete(0)).rejects.toThrow(
      'Timeout waiting for anatomy generation to complete'
    );
  });

  it('waitForAllGenerationsToComplete detects deadlines exceeded during polling', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    service.__TEST_ONLY__setInternalState({
      queue: ['stalled-late'],
      processing: true,
    });

    const waitPromise = service.waitForAllGenerationsToComplete(20);

    jest.setSystemTime(50);
    jest.advanceTimersByTime(20);

    await expect(waitPromise).rejects.toThrow(
      'Timeout waiting for anatomy generation to complete'
    );
  });

  it('reuses existing generation waiters when waitForEntityGeneration is called multiple times', async () => {
    service.initialize();

    await eventBus.dispatch(ENTITY_CREATED_ID, { instanceId: 'repeat-entity' });
    await flushMicrotasks();

    const waiterOne = service.waitForEntityGeneration('repeat-entity', 500);
    const waiterTwo = service.waitForEntityGeneration('repeat-entity', 500);

    generationService.resolve('repeat-entity', true);

    await expect(waiterOne).resolves.toBe(true);
    await expect(waiterTwo).resolves.toBe(true);
  });

  it('rejects generation promises gracefully when no waiters are registered', async () => {
    service.initialize();
    const failure = new Error('integrated failure');
    generationService.queueImmediateError(failure);

    await eventBus.dispatch(ENTITY_CREATED_ID, { instanceId: 'no-waiter' });
    await flushMicrotasks();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to generate anatomy for entity'),
      expect.objectContaining({ error: failure })
    );
  });

  it('allows destroy to be called safely before initialization', () => {
    service.destroy();
    expect(logger.info).toHaveBeenCalledWith(
      'AnatomyInitializationService: Destroyed'
    );
  });

  it('leaves internal state untouched when __TEST_ONLY__setInternalState receives no overrides', () => {
    service.__TEST_ONLY__setInternalState({
      queue: ['q1', 'q2'],
      pending: ['p1'],
      processing: true,
    });

    expect(service.hasPendingGenerations()).toBe(true);
    expect(service.getPendingGenerationCount()).toBe(3);

    service.__TEST_ONLY__setInternalState();

    expect(service.hasPendingGenerations()).toBe(true);
    expect(service.getPendingGenerationCount()).toBe(3);
  });

  it('processes queued entities when __TEST_ONLY__processQueue uses default options', async () => {
    generationService.queueImmediateResult(true);
    service.__TEST_ONLY__setInternalState({ queue: ['helper-default'] });

    await service.__TEST_ONLY__processQueue();

    expect(generationService.calls).toEqual(['helper-default']);
  });
});
