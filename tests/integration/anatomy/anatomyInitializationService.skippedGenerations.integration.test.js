import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
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

describe('AnatomyInitializationService skipped generation integration', () => {
  /** @type {AnatomyIntegrationTestBed} */
  let testBed;
  /** @type {RecordingLogger} */
  let logger;
  /** @type {TestSchemaValidator} */
  let schemaValidator;
  /** @type {SafeEventDispatcher} */
  let safeDispatcher;
  /** @type {AnatomyInitializationService} */
  let service;
  /** @type {Function} */
  let restoreGenerate;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();

    logger = new RecordingLogger();
    schemaValidator = new TestSchemaValidator();
    const eventBus = new EventBus({ logger });
    const gameDataRepository = new GameDataRepository(testBed.registry, logger);

    const validatedDispatcher = new ValidatedEventDispatcher({
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

    restoreGenerate =
      testBed.anatomyGenerationService.generateAnatomyIfNeeded.bind(
        testBed.anatomyGenerationService
      );

    testBed.anatomyGenerationService.generateAnatomyIfNeeded = async (
      entityId
    ) => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return restoreGenerate(entityId);
    };
  });

  afterEach(async () => {
    if (testBed?.anatomyGenerationService && restoreGenerate) {
      testBed.anatomyGenerationService.generateAnatomyIfNeeded =
        restoreGenerate;
    }
    service?.destroy();
    await testBed.cleanup();
  });

  const createActorWithRecipe = async () => {
    const actor =
      await testBed.entityManager.createEntityInstance('core:actor');
    await testBed.entityManager.addComponent(actor.id, 'anatomy:body', {
      recipeId: 'anatomy:human_female',
    });
    return actor;
  };

  const findGenerationLogs = (entityId) =>
    logger.calls.debug.filter(
      ([message]) =>
        typeof message === 'string' &&
        message.includes(`Generated anatomy for entity '${entityId}'`)
    );

  it('resolves waiters with false when anatomy generation skips existing data without leaving pending work', async () => {
    service.initialize();

    const actor = await createActorWithRecipe();

    const firstDispatch = safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: actor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });
    // Wait for event to be processed before creating waiter
    await new Promise((resolve) => process.nextTick(resolve));
    const firstWait = service.waitForEntityGeneration(actor.id);

    await firstDispatch;
    await expect(firstWait).resolves.toBe(true);
    await service.waitForAllGenerationsToComplete();

    const anatomyAfterFirst = testBed.entityManager.getComponentData(
      actor.id,
      'anatomy:body'
    );
    expect(anatomyAfterFirst?.body?.root).toBeTruthy();
    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);
    expect(findGenerationLogs(actor.id)).toHaveLength(1);

    const secondDispatch = safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: actor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });
    // Wait for event to be processed before creating waiter
    await new Promise((resolve) => process.nextTick(resolve));
    const skipWait = service.waitForEntityGeneration(actor.id);

    await secondDispatch;
    await expect(skipWait).resolves.toBe(false);
    await service.waitForAllGenerationsToComplete();

    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);
    expect(findGenerationLogs(actor.id)).toHaveLength(1);

    const finishLogs = logger.calls.debug.filter(
      ([message]) =>
        typeof message === 'string' &&
        message.includes('Finished processing anatomy generation queue')
    );
    expect(finishLogs.length).toBeGreaterThanOrEqual(2);
  });
});
