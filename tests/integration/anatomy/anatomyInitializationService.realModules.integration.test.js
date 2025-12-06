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

describe('AnatomyInitializationService real module integration', () => {
  /** @type {AnatomyIntegrationTestBed} */
  let testBed;
  let logger;
  let schemaValidator;
  let eventBus;
  let validatedDispatcher;
  let safeDispatcher;
  let anatomyInitializationService;
  let originalGenerate;

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

    // Register the ENTITY_CREATED event so the validated dispatcher accepts it
    testBed.registry.store('events', ENTITY_CREATED_ID, {
      id: ENTITY_CREATED_ID,
      name: 'entity created',
      description: 'Integration test entity creation event',
    });

    anatomyInitializationService = new AnatomyInitializationService({
      eventDispatcher: safeDispatcher,
      logger,
      anatomyGenerationService: testBed.anatomyGenerationService,
    });

    // Slow down the generation slightly so pending waits observe the queue
    originalGenerate =
      testBed.anatomyGenerationService.generateAnatomyIfNeeded.bind(
        testBed.anatomyGenerationService
      );
    testBed.anatomyGenerationService.generateAnatomyIfNeeded = async (
      entityId
    ) => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return originalGenerate(entityId);
    };
  });

  afterEach(async () => {
    if (testBed?.anatomyGenerationService && originalGenerate) {
      testBed.anatomyGenerationService.generateAnatomyIfNeeded =
        originalGenerate;
    }
    anatomyInitializationService?.destroy();
    await testBed.cleanup();
  });

  const waitForTick = () => new Promise((resolve) => setImmediate(resolve));

  it('generates anatomy for new entities when the creation event is dispatched', async () => {
    anatomyInitializationService.initialize();

    const actor =
      await testBed.entityManager.createEntityInstance('core:actor');
    await testBed.entityManager.addComponent(actor.id, 'anatomy:body', {
      recipeId: 'anatomy:human_female',
    });

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: actor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await waitForTick();
    expect(anatomyInitializationService.hasPendingGenerations()).toBe(true);
    expect(anatomyInitializationService.getPendingGenerationCount()).toBe(1);

    await expect(
      anatomyInitializationService.waitForEntityGeneration(actor.id)
    ).resolves.toBe(true);
    await anatomyInitializationService.waitForAllGenerationsToComplete();

    const anatomyComponent = testBed.entityManager.getComponentData(
      actor.id,
      'anatomy:body'
    );
    expect(anatomyComponent?.body?.root).toBeTruthy();
    expect(anatomyInitializationService.hasPendingGenerations()).toBe(false);

    const generationInfoLog = logger.calls.info.find(([message]) =>
      message.includes(`Generated anatomy for entity '${actor.id}'`)
    );
    expect(generationInfoLog).toBeDefined();
  });

  it('processes multiple creation events sequentially with queue bookkeeping', async () => {
    anatomyInitializationService.initialize();

    const firstActor =
      await testBed.entityManager.createEntityInstance('core:actor');
    const secondActor =
      await testBed.entityManager.createEntityInstance('core:actor');

    await testBed.entityManager.addComponent(firstActor.id, 'anatomy:body', {
      recipeId: 'anatomy:human_female',
    });
    await testBed.entityManager.addComponent(secondActor.id, 'anatomy:body', {
      recipeId: 'anatomy:human_female',
    });

    const firstDispatch = safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: firstActor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });
    const secondDispatch = safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: secondActor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    // Wait for events to be processed before creating waiters
    await waitForTick();

    const firstResult = anatomyInitializationService.waitForEntityGeneration(
      firstActor.id
    );
    const secondResult = (async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return await anatomyInitializationService.waitForEntityGeneration(
        secondActor.id
      );
    })();

    await Promise.all([firstDispatch, secondDispatch]);
    await waitForTick();
    expect(anatomyInitializationService.getPendingGenerationCount()).toBe(2);

    await expect(firstResult).resolves.toBe(true);
    await anatomyInitializationService.waitForAllGenerationsToComplete();
    await secondResult;

    const processingLogs = logger.calls.debug.filter(([message]) =>
      message.includes('Processing anatomy generation for entity')
    );
    expect(
      processingLogs.some(([message]) => message.includes(firstActor.id))
    ).toBe(true);
    expect(
      processingLogs.some(([message]) => message.includes(secondActor.id))
    ).toBe(true);

    const secondGenerationLog = logger.calls.info.find(([message]) =>
      message.includes(`Generated anatomy for entity '${secondActor.id}'`)
    );
    expect(secondGenerationLog).toBeDefined();

    const secondBody = testBed.entityManager.getComponentData(
      secondActor.id,
      'anatomy:body'
    );
    expect(secondBody?.body?.root).toBeTruthy();

    const firstLogIndex = logger.calls.debug.findIndex(([message]) =>
      message.includes(`entity '${firstActor.id}'`)
    );
    const secondLogIndex = logger.calls.debug.findIndex(([message]) =>
      message.includes(`entity '${secondActor.id}'`)
    );
    expect(firstLogIndex).toBeGreaterThanOrEqual(0);
    expect(secondLogIndex).toBeGreaterThan(firstLogIndex);
  });

  it('logs and ignores creation events that lack an instance identifier', async () => {
    anatomyInitializationService.initialize();

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await waitForTick();
    expect(anatomyInitializationService.hasPendingGenerations()).toBe(false);
    expect(
      logger.calls.warn.some(([message]) =>
        message.includes('Entity created event missing instanceId')
      )
    ).toBe(true);
  });
});
