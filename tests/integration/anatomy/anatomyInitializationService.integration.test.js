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
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

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

describe('AnatomyInitializationService integration', () => {
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

  it('requires all dependencies', () => {
    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: null,
          logger,
          anatomyGenerationService: generationService,
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: eventBus,
          logger: null,
          anatomyGenerationService: generationService,
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: eventBus,
          logger,
          anatomyGenerationService: null,
        })
    ).toThrow(InvalidArgumentError);
  });

  it('processes entity-created events sequentially and resolves waiters', async () => {
    service.initialize();

    await eventBus.dispatch(ENTITY_CREATED_ID, {
      instanceId: 'entity-1',
      definitionId: 'core:actor',
    });
    await flushMicrotasks();

    const firstWait = service.waitForEntityGeneration('entity-1', 500);

    expect(generationService.calls).toEqual(['entity-1']);
    expect(service.hasPendingGenerations()).toBe(true);
    expect(service.getPendingGenerationCount()).toBe(1);

    await eventBus.dispatch(ENTITY_CREATED_ID, {
      instanceId: 'entity-2',
      definitionId: 'core:actor',
    });
    await flushMicrotasks();

    // second entity should be queued but not processed yet
    expect(generationService.calls).toEqual(['entity-1']);
    expect(service.getPendingGenerationCount()).toBe(2);

    generationService.resolve('entity-1', true);
    await flushMicrotasks();

    const secondWaitPromise = service.waitForEntityGeneration('entity-2', 500);
    expect(generationService.calls).toEqual(['entity-1', 'entity-2']);

    generationService.resolve('entity-2', false);
    await service.waitForAllGenerationsToComplete();

    expect(await firstWait).toBe(true);
    expect(await secondWaitPromise).toBe(false);
    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Generated anatomy for entity 'entity-1'")
    );
  });

  it('ignores reconstructed entities and warns about missing instanceId', async () => {
    service.initialize();

    await eventBus.dispatch(ENTITY_CREATED_ID, {
      instanceId: 'reconstructed',
      wasReconstructed: true,
    });
    await flushMicrotasks();

    expect(generationService.calls).toHaveLength(0);

    await eventBus.dispatch(ENTITY_CREATED_ID, { definitionId: 'core:actor' });
    await flushMicrotasks();

    expect(generationService.calls).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('missing instanceId')
    );
  });

  it('propagates generation errors to waiters and continues queue processing', async () => {
    service.initialize();

    await eventBus.dispatch(ENTITY_CREATED_ID, {
      instanceId: 'entity-error',
      definitionId: 'core:actor',
    });
    await eventBus.dispatch(ENTITY_CREATED_ID, {
      instanceId: 'entity-success',
      definitionId: 'core:actor',
    });
    await flushMicrotasks();

    const failingWait = service.waitForEntityGeneration('entity-error', 500);
    const failure = new Error('boom');
    generationService.reject('entity-error', failure);
    await expect(failingWait).rejects.toThrow('boom');
    await flushMicrotasks();

    const succeedingWait = service.waitForEntityGeneration(
      'entity-success',
      500
    );
    generationService.resolve('entity-success', true);
    await expect(succeedingWait).resolves.toBe(true);

    await service.waitForAllGenerationsToComplete();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to generate anatomy for entity'),
      expect.objectContaining({ error: failure })
    );
  });

  it('waitForEntityGeneration returns false when no generation is pending', async () => {
    service.initialize();
    const result = await service.waitForEntityGeneration('unknown-entity');
    expect(result).toBe(false);
  });

  it('waitForEntityGeneration rejects on timeout if generation never completes', async () => {
    jest.useFakeTimers();
    service.initialize();

    await eventBus.dispatch(ENTITY_CREATED_ID, {
      instanceId: 'stalled-entity',
    });
    await flushMicrotasks();

    const waitPromise = service.waitForEntityGeneration('stalled-entity', 20);
    jest.advanceTimersByTime(25);
    await expect(waitPromise).rejects.toThrow(
      'Timeout waiting for anatomy generation for entity'
    );
  });

  it('waitForAllGenerationsToComplete rejects when pending work never clears', async () => {
    jest.useFakeTimers();
    service.__TEST_ONLY__setInternalState({
      queue: ['stalled-1'],
      pending: ['stalled-2'],
      processing: true,
    });

    const waitPromise = service.waitForAllGenerationsToComplete(30);

    jest.advanceTimersByTime(35);
    await expect(waitPromise).rejects.toThrow(
      'Timeout waiting for anatomy generation to complete'
    );
  });

  it('generateAnatomy delegates to generation service and logs outcomes', async () => {
    service.initialize();
    generationService.queueImmediateResult(true);
    const success = await service.generateAnatomy('actor-1', 'blueprint-1');
    expect(success).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        "Successfully generated anatomy for entity 'actor-1'"
      )
    );

    const failure = new Error('generation failed');
    generationService.queueImmediateError(failure);
    await expect(
      service.generateAnatomy('actor-2', 'blueprint-2')
    ).rejects.toThrow('generation failed');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to generate anatomy for entity 'actor-2'"
      ),
      expect.objectContaining({ error: failure })
    );
  });

  it('destroy unsubscribes listeners and resets internal state', async () => {
    service.initialize();
    await eventBus.dispatch(ENTITY_CREATED_ID, { instanceId: 'to-destroy' });
    await flushMicrotasks();

    service.destroy();

    expect(eventBus.listenerCount(ENTITY_CREATED_ID)).toBe(0);
    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);

    // Events after destroy should be ignored
    await eventBus.dispatch(ENTITY_CREATED_ID, { instanceId: 'after-destroy' });
    await flushMicrotasks();

    expect(generationService.calls).toContain('to-destroy');
    expect(generationService.calls).not.toContain('after-destroy');
  });

  it('logs a warning when initialized twice', () => {
    service.initialize();
    service.initialize();

    expect(logger.warn).toHaveBeenCalledWith(
      'AnatomyInitializationService: Already initialized'
    );
  });

  it('processQueue helper ensures processing flag consistency', async () => {
    generationService.queueImmediateResult(true);
    service.__TEST_ONLY__setInternalState({ queue: ['helper-entity'] });
    await service.__TEST_ONLY__processQueue({ ensureProcessingFlag: true });

    expect(generationService.calls).toEqual(['helper-entity']);
  });
});
