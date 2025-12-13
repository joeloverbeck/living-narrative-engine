import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';

class RecordingLogger {
  constructor() {
    this.calls = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  debug(...args) {
    this.calls.debug.push(args);
  }

  info(...args) {
    this.calls.info.push(args);
  }

  warn(...args) {
    this.calls.warn.push(args);
  }

  error(...args) {
    this.calls.error.push(args);
  }
}

class TestSchemaValidator {
  constructor() {
    this.schemas = new Map();
  }

  isSchemaLoaded(schemaId) {
    return this.schemas.has(schemaId);
  }

  register(schemaId, result) {
    this.schemas.set(schemaId, result);
  }

  validate(schemaId, payload) {
    if (!this.schemas.has(schemaId)) {
      return { isValid: true, errors: [] };
    }

    const entry = this.schemas.get(schemaId);
    if (typeof entry === 'function') {
      return entry(payload);
    }

    return {
      isValid: entry.isValid !== false,
      errors: entry.errors || [],
    };
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nextTick = () => new Promise((resolve) => setImmediate(resolve));

describe('AnatomyInitializationService failure recovery integration', () => {
  /** @type {AnatomyIntegrationTestBed} */
  let testBed;
  /** @type {RecordingLogger} */
  let logger;
  /** @type {TestSchemaValidator} */
  let schemaValidator;
  let eventBus;
  let validatedDispatcher;
  let safeDispatcher;
  /** @type {AnatomyInitializationService} */
  let service;
  let originalGenerate;
  /** @type {Map<string, { type: 'resolve' | 'reject'; value?: boolean; error?: Error; delay?: number }>} */
  let behaviours;
  /** @type {string[]} */
  let generationCalls;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();

    logger = new RecordingLogger();
    schemaValidator = new TestSchemaValidator();
    eventBus = new EventBus({ logger });
    const gameDataRepository = new GameDataRepository(testBed.registry, logger);

    validatedDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository,
      schemaValidator,
      logger,
    });

    safeDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });

    testBed.registry.store('events', ENTITY_CREATED_ID, {
      id: ENTITY_CREATED_ID,
      name: 'entity created',
      description: 'Integration test entity creation event',
    });

    service = new AnatomyInitializationService({
      eventDispatcher: safeDispatcher,
      logger,
      anatomyGenerationService: testBed.anatomyGenerationService,
    });

    behaviours = new Map();
    generationCalls = [];
    originalGenerate =
      testBed.anatomyGenerationService.generateAnatomyIfNeeded.bind(
        testBed.anatomyGenerationService
      );
    testBed.anatomyGenerationService.generateAnatomyIfNeeded = async (
      entityId
    ) => {
      generationCalls.push(entityId);
      const behaviour = behaviours.get(entityId);
      if (behaviour) {
        if (behaviour.delay) {
          await delay(behaviour.delay);
        }

        if (behaviour.type === 'resolve') {
          return behaviour.value ?? false;
        }

        throw behaviour.error ?? new Error('behaviour rejected');
      }

      return originalGenerate(entityId);
    };
  });

  afterEach(async () => {
    if (testBed?.anatomyGenerationService && originalGenerate) {
      testBed.anatomyGenerationService.generateAnatomyIfNeeded =
        originalGenerate;
    }
    service?.destroy();
    await testBed?.cleanup();
  });

  it('processes queued entities sequentially and resolves or rejects waiters', async () => {
    service.initialize();

    const notPending = await service.waitForEntityGeneration('ghost-entity');
    expect(notPending).toBe(false);

    const successId = 'entity-success';
    const failingId = 'entity-failure';
    const skippedId = 'entity-skipped';

    behaviours.set(successId, { type: 'resolve', value: true, delay: 40 });
    behaviours.set(failingId, {
      type: 'reject',
      error: new Error('intentional failure'),
      delay: 80,
    });
    behaviours.set(skippedId, { type: 'resolve', value: false, delay: 20 });

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: successId,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });
    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: failingId,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });
    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: skippedId,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    const completionPromise = service.waitForAllGenerationsToComplete();

    await nextTick();
    await delay(5);
    const successWait = service.waitForEntityGeneration(successId);

    const successResult = await successWait;
    expect(successResult).toBe(true);

    await delay(60);
    const failingWait = service.waitForEntityGeneration(failingId);
    await expect(failingWait).rejects.toThrow('intentional failure');

    await completionPromise;

    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);

    expect(generationCalls).toEqual([successId, failingId, skippedId]);

    const successLog = logger.calls.debug.find(([message]) =>
      message.includes(`Generated anatomy for entity '${successId}'`)
    );
    expect(successLog).toBeDefined();

    const failureLog = logger.calls.error.find(([message]) =>
      message.includes(`Failed to generate anatomy for entity '${failingId}'`)
    );
    expect(failureLog).toBeDefined();

    const finishedLog = logger.calls.debug.find(([message]) =>
      message.includes('Finished processing anatomy generation queue')
    );
    expect(finishedLog).toBeDefined();
  });

  it('ignores reconstructed entities and warns when instanceId is missing', async () => {
    service.initialize();

    behaviours.set('ignored-entity', {
      type: 'resolve',
      value: true,
      delay: 10,
    });

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: 'ignored-entity',
      definitionId: 'core:actor',
      wasReconstructed: true,
    });

    await delay(30);
    expect(generationCalls).toEqual([]);

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await delay(10);
    expect(
      logger.calls.warn.some(([message]) =>
        message.includes('Entity created event missing instanceId')
      )
    ).toBe(true);
    expect(service.hasPendingGenerations()).toBe(false);
  });

  it('delegates direct generateAnatomy calls and surfaces logging', async () => {
    service.initialize();

    behaviours.set('direct-success', {
      type: 'resolve',
      value: true,
      delay: 5,
    });
    behaviours.set('direct-failure', {
      type: 'reject',
      error: new Error('direct failure'),
      delay: 5,
    });

    await expect(
      service.generateAnatomy('direct-success', 'blueprint-A')
    ).resolves.toBe(true);
    const directSuccessLog = logger.calls.debug.find(([message]) =>
      message.includes(
        "Successfully generated anatomy for entity 'direct-success' with blueprint 'blueprint-A'"
      )
    );
    expect(directSuccessLog).toBeDefined();

    await expect(
      service.generateAnatomy('direct-failure', 'blueprint-B')
    ).rejects.toThrow('direct failure');
    const directFailureLog = logger.calls.error.find(([message]) =>
      message.includes(
        "Failed to generate anatomy for entity 'direct-failure' with blueprint 'blueprint-B'"
      )
    );
    expect(directFailureLog).toBeDefined();
  });

  it('clears subscriptions and state when destroyed', async () => {
    service.initialize();

    behaviours.set('cleanup-entity', {
      type: 'resolve',
      value: true,
      delay: 10,
    });

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: 'cleanup-entity',
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await service.waitForAllGenerationsToComplete();
    expect(service.hasPendingGenerations()).toBe(false);

    const destroyedService = service;
    destroyedService.destroy();
    service = null;

    const destroyLog = logger.calls.info.find(([message]) =>
      message.includes('AnatomyInitializationService: Destroyed')
    );
    expect(destroyLog).toBeDefined();

    const resultAfterDestroy =
      await destroyedService.waitForEntityGeneration('cleanup-entity');
    expect(resultAfterDestroy).toBe(false);

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: 'after-destroy',
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await delay(20);
    expect(generationCalls).not.toContain('after-destroy');
  });
});
