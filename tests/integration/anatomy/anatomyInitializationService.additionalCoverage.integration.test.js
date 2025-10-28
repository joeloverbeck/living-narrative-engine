import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
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

describe('AnatomyInitializationService additional integration coverage', () => {
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

    originalGenerate = testBed.anatomyGenerationService.generateAnatomyIfNeeded;
  });

  afterEach(async () => {
    testBed.anatomyGenerationService.generateAnatomyIfNeeded = originalGenerate;
    anatomyInitializationService?.destroy();
    await testBed.cleanup();
  });

  const createActorWithAnatomy = async () => {
    const actor = await testBed.entityManager.createEntityInstance('core:actor');
    await testBed.entityManager.addComponent(actor.id, 'anatomy:body', {
      recipeId: 'anatomy:human_female',
    });
    return actor;
  };

  it('validates required dependencies at construction time', () => {
    expect(
      () =>
        new AnatomyInitializationService({
          logger,
          anatomyGenerationService: testBed.anatomyGenerationService,
        })
    ).toThrow(/eventDispatcher is required/);

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: safeDispatcher,
          anatomyGenerationService: testBed.anatomyGenerationService,
        })
    ).toThrow(/logger is required/);

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: safeDispatcher,
          logger,
        })
    ).toThrow(/anatomyGenerationService is required/);
  });

  it('warns when initialize is invoked twice and does not resubscribe', () => {
    anatomyInitializationService.initialize();
    anatomyInitializationService.initialize();

    const duplicateWarning = logger.calls.warn.find(([message]) =>
      message.includes('Already initialized')
    );
    expect(duplicateWarning).toBeDefined();
  });

  it('ignores reconstructed entities and leaves queue untouched', async () => {
    anatomyInitializationService.initialize();
    const spy = jest.spyOn(
      testBed.anatomyGenerationService,
      'generateAnatomyIfNeeded'
    );

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: 'actor:reconstructed',
      definitionId: 'core:actor',
      wasReconstructed: true,
    });

    await wait(10);
    expect(spy).not.toHaveBeenCalled();
    expect(anatomyInitializationService.hasPendingGenerations()).toBe(false);
    spy.mockRestore();
  });

  it('warns when an entity creation event is missing its identifier', async () => {
    anatomyInitializationService.initialize();

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await wait(10);
    expect(anatomyInitializationService.hasPendingGenerations()).toBe(false);
    expect(
      logger.calls.warn.some(([message]) =>
        message.includes('Entity created event missing instanceId')
      )
    ).toBe(true);
  });

  it('returns false immediately when waiting for non-pending entities', async () => {
    anatomyInitializationService.initialize();
    await expect(
      anatomyInitializationService.waitForEntityGeneration('missing')
    ).resolves.toBe(false);
  });

  it('delegates generateAnatomy and logs successful generations', async () => {
    anatomyInitializationService.initialize();
    const actor = await createActorWithAnatomy();

    const generated = await anatomyInitializationService.generateAnatomy(
      actor.id,
      'anatomy:human_female'
    );

    expect(generated).toBe(true);
    expect(
      logger.calls.debug.some(([message]) =>
        message.includes(`Generating anatomy for entity '${actor.id}'`)
      )
    ).toBe(true);
    expect(
      logger.calls.info.some(([message]) =>
        message.includes(`Successfully generated anatomy for entity '${actor.id}'`)
      )
    ).toBe(true);

    testBed.anatomyGenerationService.generateAnatomyIfNeeded = jest
      .fn()
      .mockResolvedValue(false);
    const notGenerated = await anatomyInitializationService.generateAnatomy(
      actor.id,
      'anatomy:human_female'
    );
    expect(notGenerated).toBe(false);
    expect(
      logger.calls.info.filter(([message]) =>
        message.includes(`Successfully generated anatomy for entity '${actor.id}'`)
      ).length
    ).toBe(1);
  });

  it('rethrows errors from generateAnatomy when the generation service fails', async () => {
    anatomyInitializationService.initialize();
    const actor = await createActorWithAnatomy();

    const failure = new Error('deliberate generation failure');
    testBed.anatomyGenerationService.generateAnatomyIfNeeded = jest
      .fn()
      .mockRejectedValue(failure);

    await expect(
      anatomyInitializationService.generateAnatomy(
        actor.id,
        'anatomy:human_female'
      )
    ).rejects.toThrow('deliberate generation failure');

    expect(
      logger.calls.error.some(([message]) =>
        message.includes(
          `Failed to generate anatomy for entity '${actor.id}' with blueprint`
        )
      )
    ).toBe(true);
  });

  it('rejects waiters and logs when generation fails asynchronously', async () => {
    anatomyInitializationService.initialize();
    const actor = await createActorWithAnatomy();

    const generationError = new Error('synthetic generation failure');
    testBed.anatomyGenerationService.generateAnatomyIfNeeded = jest.fn(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(generationError), 20);
        })
    );

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: actor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await wait(5);
    await expect(
      anatomyInitializationService.waitForEntityGeneration(actor.id, 200)
    ).rejects.toThrow('synthetic generation failure');

    await wait(30);
    expect(anatomyInitializationService.hasPendingGenerations()).toBe(false);
    expect(
      logger.calls.error.some(([message]) =>
        message.includes(`Failed to generate anatomy for entity '${actor.id}'`)
      )
    ).toBe(true);
  });

  it('propagates timeouts from wait helpers while the queue is still processing', async () => {
    anatomyInitializationService.initialize();
    const actor = await createActorWithAnatomy();

    testBed.anatomyGenerationService.generateAnatomyIfNeeded = jest.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(async () => {
            resolve(await originalGenerate.call(testBed.anatomyGenerationService, actor.id));
          }, 60);
        })
    );

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: actor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await wait(5);
    const allGenerationsTimeoutPromise =
      anatomyInitializationService.waitForAllGenerationsToComplete(5);

    await expect(
      anatomyInitializationService.waitForEntityGeneration(actor.id, 5)
    ).rejects.toThrow(/Timeout waiting for anatomy generation/);

    await expect(allGenerationsTimeoutPromise).rejects.toThrow(
      /Timeout waiting for anatomy generation to complete/
    );

    // Allow additional time for instrumentation overhead before verifying
    // that the queue has fully drained.
    await anatomyInitializationService.waitForAllGenerationsToComplete(1500);
    expect(
      logger.calls.debug.some(([message]) =>
        message.includes('All anatomy generations completed')
      )
    ).toBe(true);
  });

  it('cleans up listeners and internal state on destroy', async () => {
    anatomyInitializationService.initialize();
    const actor = await createActorWithAnatomy();

    const spy = jest.spyOn(
      testBed.anatomyGenerationService,
      'generateAnatomyIfNeeded'
    );

    anatomyInitializationService.destroy();

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: actor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await wait(20);
    expect(spy).not.toHaveBeenCalled();
    expect(anatomyInitializationService.hasPendingGenerations()).toBe(false);
    expect(
      logger.calls.info.some(([message]) =>
        message.includes('AnatomyInitializationService: Destroyed')
      )
    ).toBe(true);
    spy.mockRestore();
  });
});
