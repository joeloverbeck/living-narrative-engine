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

describe('AnatomyInitializationService failure propagation integration', () => {
  /** @type {AnatomyIntegrationTestBed} */
  let testBed;
  let logger;
  let eventBus;
  let validatedDispatcher;
  let safeDispatcher;
  /** @type {AnatomyInitializationService} */
  let anatomyInitializationService;
  let originalGenerate;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();

    logger = new RecordingLogger();
    eventBus = new EventBus({ logger });
    const schemaValidator = new TestSchemaValidator();
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

    anatomyInitializationService = new AnatomyInitializationService({
      eventDispatcher: safeDispatcher,
      logger,
      anatomyGenerationService: testBed.anatomyGenerationService,
    });

    originalGenerate =
      testBed.anatomyGenerationService.generateAnatomyIfNeeded.bind(
        testBed.anatomyGenerationService
      );
  });

  afterEach(async () => {
    if (testBed?.anatomyGenerationService && originalGenerate) {
      testBed.anatomyGenerationService.generateAnatomyIfNeeded =
        originalGenerate;
    }

    anatomyInitializationService?.destroy();
    await testBed?.cleanup();
  });

  it('rejects queued waiters and clears state when anatomy generation fails', async () => {
    anatomyInitializationService.initialize();

    const failingActor =
      await testBed.entityManager.createEntityInstance('core:actor');
    await testBed.entityManager.addComponent(failingActor.id, 'anatomy:body', {
      recipeId: 'anatomy:human_female',
    });

    const unobservedFailureActor =
      await testBed.entityManager.createEntityInstance('core:actor');
    await testBed.entityManager.addComponent(
      unobservedFailureActor.id,
      'anatomy:body',
      {
        recipeId: 'anatomy:human_female',
      }
    );

    const recoveryActor =
      await testBed.entityManager.createEntityInstance('core:actor');
    await testBed.entityManager.addComponent(recoveryActor.id, 'anatomy:body', {
      recipeId: 'anatomy:human_female',
    });

    const failureError = new Error('Simulated generation failure');
    const silentError = new Error('Silent failure without waiters');

    const generationPlan = new Map([
      [failingActor.id, 'fail-with-waiters'],
      [unobservedFailureActor.id, 'fail-without-waiters'],
      [recoveryActor.id, 'succeed'],
    ]);

    testBed.anatomyGenerationService.generateAnatomyIfNeeded = async (
      entityId
    ) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      const behavior = generationPlan.get(entityId);

      if (behavior === 'fail-with-waiters') {
        throw failureError;
      }

      if (behavior === 'fail-without-waiters') {
        throw silentError;
      }

      if (behavior === 'succeed') {
        return originalGenerate(entityId);
      }

      return originalGenerate(entityId);
    };

    const failingDispatch = safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: failingActor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    // Wait for event to be processed before creating waiters
    await new Promise((resolve) => process.nextTick(resolve));

    const firstWaiter = anatomyInitializationService.waitForEntityGeneration(
      failingActor.id,
      250
    );
    const secondWaiter = anatomyInitializationService.waitForEntityGeneration(
      failingActor.id,
      250
    );

    await expect(firstWaiter).rejects.toThrow('Simulated generation failure');
    await expect(secondWaiter).rejects.toThrow('Simulated generation failure');
    await expect(failingDispatch).resolves.toBe(true);

    expect(anatomyInitializationService.hasPendingGenerations()).toBe(false);
    expect(anatomyInitializationService.getPendingGenerationCount()).toBe(0);
    expect(
      logger.calls.error.some(([message]) =>
        message.includes(
          `Failed to generate anatomy for entity '${failingActor.id}'`
        )
      )
    ).toBe(true);

    const unobservedDispatch = safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: unobservedFailureActor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await expect(unobservedDispatch).resolves.toBe(true);
    await anatomyInitializationService.waitForAllGenerationsToComplete(500);

    expect(
      logger.calls.error.some(([message]) =>
        message.includes(
          `Failed to generate anatomy for entity '${unobservedFailureActor.id}'`
        )
      )
    ).toBe(true);

    const recoveryDispatch = safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: recoveryActor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    // Wait for event to be processed before creating waiter
    await new Promise((resolve) => process.nextTick(resolve));

    await expect(
      anatomyInitializationService.waitForEntityGeneration(
        recoveryActor.id,
        500
      )
    ).resolves.toBe(true);
    await expect(recoveryDispatch).resolves.toBe(true);
    expect(
      logger.calls.info.some(([message]) =>
        message.includes(`Generated anatomy for entity '${recoveryActor.id}'`)
      )
    ).toBe(true);
  });
});
