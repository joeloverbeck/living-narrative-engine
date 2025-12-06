import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
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

const createDateNowSequence = (values) => {
  let lastValue = values.length ? values[values.length - 1] : Date.now();
  return jest.spyOn(Date, 'now').mockImplementation(() => {
    if (values.length > 0) {
      lastValue = values.shift();
    }
    return lastValue;
  });
};

describe('AnatomyInitializationService queue control integration', () => {
  /** @type {AnatomyIntegrationTestBed} */
  let testBed;
  /** @type {RecordingLogger} */
  let logger;
  let schemaValidator;
  let eventBus;
  let validatedDispatcher;
  let safeDispatcher;
  /** @type {AnatomyInitializationService} */
  let anatomyInitializationService;

  beforeEach(async () => {
    jest.useRealTimers();

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
      description: 'Queue control integration event',
    });

    anatomyInitializationService = new AnatomyInitializationService({
      eventDispatcher: safeDispatcher,
      logger,
      anatomyGenerationService: testBed.anatomyGenerationService,
    });
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    anatomyInitializationService?.destroy();
    await testBed?.cleanup();
  });

  it('processes queued entities when forced and resolves waiting promises', async () => {
    const actor =
      await testBed.entityManager.createEntityInstance('core:actor');
    await testBed.entityManager.addComponent(actor.id, 'anatomy:body', {
      recipeId: 'anatomy:human_female',
    });

    anatomyInitializationService.__TEST_ONLY__setInternalState({
      queue: [actor.id],
      pending: [actor.id],
      processing: true,
    });

    expect(anatomyInitializationService.getPendingGenerationCount()).toBe(2);

    const generationSpy = jest.spyOn(
      testBed.anatomyGenerationService,
      'generateAnatomyIfNeeded'
    );

    const waiterOne = anatomyInitializationService.waitForEntityGeneration(
      actor.id,
      250
    );
    const waiterTwo = anatomyInitializationService.waitForEntityGeneration(
      actor.id,
      250
    );

    await anatomyInitializationService.__TEST_ONLY__processQueue({
      ensureProcessingFlag: true,
    });

    await expect(waiterOne).resolves.toBe(true);
    await expect(waiterTwo).resolves.toBe(true);
    expect(generationSpy).toHaveBeenCalledWith(actor.id);
    expect(anatomyInitializationService.hasPendingGenerations()).toBe(false);
    expect(anatomyInitializationService.getPendingGenerationCount()).toBe(0);
    expect(
      logger.calls.debug.some(([message]) =>
        message.includes('Finished processing anatomy generation queue')
      )
    ).toBe(true);

    // Queue the same actor again now that anatomy exists to exercise the
    // negative branch from generateAnatomyIfNeeded.
    anatomyInitializationService.__TEST_ONLY__setInternalState({
      queue: [actor.id],
      pending: [actor.id],
      processing: true,
    });

    const waiterAfterGeneration =
      anatomyInitializationService.waitForEntityGeneration(actor.id, 250);

    await anatomyInitializationService.__TEST_ONLY__processQueue({
      ensureProcessingFlag: true,
    });

    await expect(waiterAfterGeneration).resolves.toBe(false);
    expect(generationSpy).toHaveBeenCalledWith(actor.id);
    expect(anatomyInitializationService.hasPendingGenerations()).toBe(false);
    expect(anatomyInitializationService.getPendingGenerationCount()).toBe(0);

    // Calling without options covers the default branch for the test helper.
    await anatomyInitializationService.__TEST_ONLY__processQueue();
  });

  it('allows direct control of internal queue and pending state', () => {
    anatomyInitializationService.__TEST_ONLY__setInternalState({
      queue: ['first', 'second'],
      pending: ['pending-only'],
      processing: true,
    });

    expect(anatomyInitializationService.hasPendingGenerations()).toBe(true);
    expect(anatomyInitializationService.getPendingGenerationCount()).toBe(3);

    anatomyInitializationService.__TEST_ONLY__setInternalState({
      queue: [],
      pending: [],
      processing: false,
    });

    expect(anatomyInitializationService.hasPendingGenerations()).toBe(false);
    expect(anatomyInitializationService.getPendingGenerationCount()).toBe(0);

    // Calling without arguments exercises the default parameter branch and keeps
    // previous state intact.
    anatomyInitializationService.__TEST_ONLY__setInternalState();
    expect(anatomyInitializationService.hasPendingGenerations()).toBe(false);
    expect(anatomyInitializationService.getPendingGenerationCount()).toBe(0);
  });

  it('throws immediately when the deadline has already passed before waiting', async () => {
    anatomyInitializationService.__TEST_ONLY__setInternalState({
      queue: ['timed-out-entity'],
      processing: true,
    });

    const dateMock = createDateNowSequence([1000, 1002]);
    await expect(
      anatomyInitializationService.waitForAllGenerationsToComplete(0)
    ).rejects.toThrow(/Timeout waiting for anatomy generation to complete/);
    dateMock.mockRestore();
  });

  it('detects zero remaining time and throws without sleeping', async () => {
    anatomyInitializationService.__TEST_ONLY__setInternalState({
      queue: ['no-remaining-time'],
      processing: true,
    });

    const dateMock = createDateNowSequence([2000, 2000]);
    await expect(
      anatomyInitializationService.waitForAllGenerationsToComplete(0)
    ).rejects.toThrow(/Timeout waiting for anatomy generation to complete/);
    dateMock.mockRestore();
  });

  it('propagates timeout when the queue is still processing after delay', async () => {
    anatomyInitializationService.__TEST_ONLY__setInternalState({
      queue: ['delayed-entity'],
      processing: true,
    });

    jest.useFakeTimers();
    const dateMock = createDateNowSequence([3000, 3005, 3015]);

    const waitPromise =
      anatomyInitializationService.waitForAllGenerationsToComplete(10);

    await Promise.resolve();
    jest.advanceTimersByTime(5);
    await expect(waitPromise).rejects.toThrow(
      /Timeout waiting for anatomy generation to complete/
    );

    dateMock.mockRestore();
    jest.useRealTimers();
  });

  it('falls back to raw event objects and honours default wait behaviour', async () => {
    const actor =
      await testBed.entityManager.createEntityInstance('core:actor');
    await testBed.entityManager.addComponent(actor.id, 'anatomy:body', {
      recipeId: 'anatomy:human_female',
    });

    const manualDispatcher = {
      listener: null,
      subscribe(eventName, listener) {
        if (eventName === ENTITY_CREATED_ID) {
          this.listener = listener;
          return () => {
            this.listener = null;
          };
        }
        return () => {};
      },
      async dispatch(eventName, eventLike) {
        if (eventName === ENTITY_CREATED_ID && this.listener) {
          await this.listener(eventLike);
          return true;
        }
        return false;
      },
    };

    const manualService = new AnatomyInitializationService({
      eventDispatcher: manualDispatcher,
      logger,
      anatomyGenerationService: testBed.anatomyGenerationService,
    });

    manualService.initialize();

    await manualDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: actor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await manualService.waitForAllGenerationsToComplete();
    expect(manualService.hasPendingGenerations()).toBe(false);
    expect(
      logger.calls.warn.find(([message]) =>
        message.includes('Already initialized')
      )
    ).toBeUndefined();

    // Dispatch again without creating waiters to ensure rejection without
    // registered promises is gracefully ignored.
    manualService.__TEST_ONLY__setInternalState({ processing: true });
    jest
      .spyOn(testBed.anatomyGenerationService, 'generateAnatomyIfNeeded')
      .mockRejectedValueOnce(new Error('manual failure'));

    await manualDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: actor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await manualService.__TEST_ONLY__processQueue();
    await manualService.waitForAllGenerationsToComplete();
    expect(manualService.hasPendingGenerations()).toBe(false);

    manualService.destroy();
  });
});
