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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('AnatomyInitializationService queue resilience integration', () => {
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
  let originalGenerate;

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
      description: 'Queue resilience integration test event',
    });

    anatomyInitializationService = new AnatomyInitializationService({
      eventDispatcher: safeDispatcher,
      logger,
      anatomyGenerationService: testBed.anatomyGenerationService,
    });

    originalGenerate = testBed.anatomyGenerationService.generateAnatomyIfNeeded;
  });

  afterEach(async () => {
    jest.useRealTimers();
    testBed.anatomyGenerationService.generateAnatomyIfNeeded = originalGenerate;
    anatomyInitializationService?.destroy();
    await testBed.cleanup();
  });

  const createActorWithAnatomy = async () => {
    const actor =
      await testBed.entityManager.createEntityInstance('core:actor');
    await testBed.entityManager.addComponent(actor.id, 'anatomy:body', {
      recipeId: 'anatomy:human_female',
    });
    return actor;
  };

  it('reports pending counts while queue is processing', async () => {
    anatomyInitializationService.initialize();
    const actor = await createActorWithAnatomy();

    let resolveGeneration;
    testBed.anatomyGenerationService.generateAnatomyIfNeeded = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        })
    );

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: actor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await wait(5);

    expect(anatomyInitializationService.hasPendingGenerations()).toBe(true);
    expect(anatomyInitializationService.getPendingGenerationCount()).toBe(1);

    resolveGeneration(false);
    await anatomyInitializationService.waitForEntityGeneration(actor.id, 500);

    expect(anatomyInitializationService.hasPendingGenerations()).toBe(false);
    expect(anatomyInitializationService.getPendingGenerationCount()).toBe(0);
  });

  it('uses the final deadline guard when queue processing exceeds the timeout window', async () => {
    jest.useFakeTimers({ advanceTimers: true });

    anatomyInitializationService.initialize();
    const actor = await createActorWithAnatomy();

    let resolveGeneration;
    testBed.anatomyGenerationService.generateAnatomyIfNeeded = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        })
    );

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: actor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await Promise.resolve();

    const waitPromise =
      anatomyInitializationService.waitForAllGenerationsToComplete(60);

    await Promise.resolve();
    jest.advanceTimersByTime(50);
    await Promise.resolve();

    jest.advanceTimersByTime(10);
    await expect(waitPromise).rejects.toThrow(
      /Timeout waiting for anatomy generation to complete/
    );

    resolveGeneration(false);
    jest.advanceTimersByTime(1);
    jest.useRealTimers();
    await anatomyInitializationService.waitForAllGenerationsToComplete(500);
  });

  it('throws immediately when the computed deadline is already past', async () => {
    anatomyInitializationService.initialize();
    const actor = await createActorWithAnatomy();

    let resolveGeneration;
    testBed.anatomyGenerationService.generateAnatomyIfNeeded = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        })
    );

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: actor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await Promise.resolve();

    const dateSpy = jest.spyOn(Date, 'now');
    dateSpy
      .mockImplementationOnce(() => 1_000)
      .mockImplementationOnce(() => 2_000)
      .mockImplementation(() => 2_000);

    await expect(
      anatomyInitializationService.waitForAllGenerationsToComplete(5)
    ).rejects.toThrow(/Timeout waiting for anatomy generation to complete/);

    dateSpy.mockRestore();

    resolveGeneration(false);
    await anatomyInitializationService.waitForAllGenerationsToComplete(500);
  });
});
