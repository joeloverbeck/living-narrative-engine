import { describe, it, beforeEach, expect } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class InMemoryValidatedDispatcher {
  constructor() {
    this.listeners = new Map();
    this.unsubscribeRecords = [];
  }

  async dispatch(eventName, payload) {
    const listeners = Array.from(this.listeners.get(eventName) ?? []);
    for (const listener of listeners) {
      await listener({ type: eventName, payload });
    }
    return true;
  }

  subscribe(eventName, listener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    const eventListeners = this.listeners.get(eventName);
    eventListeners.add(listener);

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      this.unsubscribe(eventName, listener);
      this.unsubscribeRecords.push({ eventName, listener, viaReturn: true });
    };
  }

  unsubscribe(eventName, listener) {
    const eventListeners = this.listeners.get(eventName);
    if (!eventListeners) {
      return;
    }
    eventListeners.delete(listener);
    if (eventListeners.size === 0) {
      this.listeners.delete(eventName);
    }
    this.unsubscribeRecords.push({ eventName, listener, viaDirect: true });
  }
}

class ConfigurableGenerationService {
  constructor() {
    this.behaviors = new Map();
    this.calls = [];
    this.manualResolutions = new Map();
    this.callWaiters = new Map();
  }

  setBehavior(entityId, behavior) {
    this.behaviors.set(entityId, behavior);
  }

  waitForCall(entityId) {
    if (this.calls.includes(entityId)) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      if (!this.callWaiters.has(entityId)) {
        this.callWaiters.set(entityId, []);
      }
      this.callWaiters.get(entityId).push(resolve);
    });
  }

  async generateAnatomyIfNeeded(entityId) {
    this.calls.push(entityId);
    if (this.callWaiters.has(entityId)) {
      for (const resolve of this.callWaiters.get(entityId)) {
        resolve();
      }
      this.callWaiters.delete(entityId);
    }

    const behavior = this.behaviors.get(entityId) ?? { mode: 'return', result: false };

    if (behavior.delay) {
      await delay(behavior.delay);
    }

    if (behavior.mode === 'manual') {
      return new Promise((resolve, reject) => {
        this.manualResolutions.set(entityId, { resolve, reject });
      });
    }

    if (behavior.mode === 'error') {
      const error =
        behavior.error instanceof Error
          ? behavior.error
          : new Error(behavior.error ?? 'anatomy generation failed');
      throw error;
    }

    return behavior.result ?? false;
  }

  resolve(entityId, result = false) {
    const deferred = this.manualResolutions.get(entityId);
    if (deferred) {
      deferred.resolve(result);
      this.manualResolutions.delete(entityId);
    }
  }

  reject(entityId, error) {
    const deferred = this.manualResolutions.get(entityId);
    if (deferred) {
      deferred.reject(error instanceof Error ? error : new Error(error));
      this.manualResolutions.delete(entityId);
    }
  }
}

const createLogger = () => {
  const messages = { debug: [], info: [], warn: [], error: [] };
  const capture = (level) => (...args) => {
    const rendered = args
      .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join(' ');
    messages[level].push(rendered);
  };
  return {
    messages,
    debug: capture('debug'),
    info: capture('info'),
    warn: capture('warn'),
    error: capture('error'),
  };
};

const flushMicrotasks = () => delay(0);

describe('AnatomyInitializationService queue orchestration', () => {
  let logger;
  let validatedDispatcher;
  let eventDispatcher;
  let generationService;
  let service;

  beforeEach(() => {
    logger = createLogger();
    validatedDispatcher = new InMemoryValidatedDispatcher();
    eventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
    generationService = new ConfigurableGenerationService();
    service = new AnatomyInitializationService({
      eventDispatcher,
      logger,
      anatomyGenerationService: generationService,
    });
  });

  it('processes queued events sequentially and resolves waiting helpers', async () => {
    generationService.setBehavior('entity-1', { mode: 'return', result: true, delay: 10 });
    generationService.setBehavior('entity-2', { mode: 'return', result: false, delay: 5 });
    generationService.setBehavior('entity-3', { mode: 'manual' });

    service.initialize();

    await eventDispatcher.dispatch(ENTITY_CREATED_ID, { instanceId: 'entity-1' });
    await eventDispatcher.dispatch(ENTITY_CREATED_ID, { instanceId: 'entity-2' });
    await eventDispatcher.dispatch(ENTITY_CREATED_ID, { instanceId: 'entity-3' });
    await eventDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: 'reconstructed',
      wasReconstructed: true,
    });
    await eventDispatcher.dispatch(ENTITY_CREATED_ID, { definitionId: 'missing-instance' });

    expect(service.hasPendingGenerations()).toBe(true);
    expect(service.getPendingGenerationCount()).toBeGreaterThan(0);

    await generationService.waitForCall('entity-1');
    await expect(service.waitForEntityGeneration('entity-1', 500)).resolves.toBe(true);

    await generationService.waitForCall('entity-3');
    const failingPromise = service.waitForEntityGeneration('entity-3', 200);
    generationService.reject('entity-3', new Error('synthetic failure'));
    await expect(failingPromise).rejects.toThrow('synthetic failure');

    await service.waitForAllGenerationsToComplete(500);

    expect(await service.waitForEntityGeneration('entity-2')).toBe(false);
    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);

    expect(generationService.calls).toEqual([
      'entity-1',
      'entity-2',
      'entity-3',
    ]);
    expect(generationService.calls).not.toContain('reconstructed');

    expect(logger.messages.warn.some((msg) => msg.includes('missing instanceId'))).toBe(true);
    expect(
      logger.messages.info.some((msg) =>
        msg.includes("AnatomyInitializationService: Generated anatomy for entity 'entity-1'")
      )
    ).toBe(true);
    expect(
      logger.messages.error.some((msg) =>
        msg.includes("Failed to generate anatomy for entity 'entity-3'")
      )
    ).toBe(true);

    service.destroy();
  });

  it('handles waiting timeouts, manual queue control, and teardown', async () => {
    generationService.setBehavior('stalled', { mode: 'manual' });
    generationService.setBehavior('manual-queue', { mode: 'return', result: false });
    generationService.setBehavior('blueprint-ok', { mode: 'return', result: true });
    generationService.setBehavior('blueprint-fail', {
      mode: 'error',
      error: new Error('blueprint failure'),
    });

    service.initialize();
    service.initialize();

    await eventDispatcher.dispatch(ENTITY_CREATED_ID, { instanceId: 'stalled' });
    await generationService.waitForCall('stalled');

    expect(await service.waitForEntityGeneration('unknown')).toBe(false);

    await expect(service.waitForEntityGeneration('stalled', 30)).rejects.toThrow(
      /Timeout waiting for anatomy generation/
    );
    await expect(service.waitForAllGenerationsToComplete(30)).rejects.toThrow(
      /Timeout waiting for anatomy generation/
    );
    expect(service.hasPendingGenerations()).toBe(true);

    generationService.resolve('stalled', true);
    await service.waitForAllGenerationsToComplete(500);
    expect(service.hasPendingGenerations()).toBe(false);

    service.__TEST_ONLY__setInternalState({
      queue: ['manual-queue'],
      processing: false,
    });
    await service.__TEST_ONLY__processQueue({ ensureProcessingFlag: true });

    await expect(service.generateAnatomy('blueprint-ok', 'core:humanoid')).resolves.toBe(true);
    await expect(
      service.generateAnatomy('blueprint-fail', 'core:problem')
    ).rejects.toThrow('blueprint failure');

    service.destroy();

    expect(
      validatedDispatcher.unsubscribeRecords.some(
        (record) => record.eventName === ENTITY_CREATED_ID
      )
    ).toBe(true);

    await eventDispatcher.dispatch(ENTITY_CREATED_ID, { instanceId: 'post-destroy' });
    await flushMicrotasks();
    expect(generationService.calls).not.toContain('post-destroy');

    expect(logger.messages.warn.some((msg) => msg.includes('Already initialized'))).toBe(true);
    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);
  });
});
