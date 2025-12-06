import { describe, it, expect, jest } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
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

/**
 *
 */
async function createService() {
  const testBed = new AnatomyIntegrationTestBed();
  await testBed.loadAnatomyModData();

  const logger = new RecordingLogger();
  const schemaValidator = new TestSchemaValidator();
  const eventBus = new EventBus({ logger });
  const gameDataRepository = new GameDataRepository(testBed.registry, logger);

  const validatedDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository,
    schemaValidator,
    logger,
  });

  const safeDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: validatedDispatcher,
    logger,
  });

  testBed.registry.store('events', ENTITY_CREATED_ID, {
    id: ENTITY_CREATED_ID,
    name: 'entity created',
    description: 'Integration test entity creation event',
  });

  const service = new AnatomyInitializationService({
    eventDispatcher: safeDispatcher,
    logger,
    anatomyGenerationService: testBed.anatomyGenerationService,
  });

  const originalGenerate =
    testBed.anatomyGenerationService.generateAnatomyIfNeeded.bind(
      testBed.anatomyGenerationService
    );

  const restoreGenerator = () => {
    testBed.anatomyGenerationService.generateAnatomyIfNeeded = originalGenerate;
  };

  const cleanup = async () => {
    restoreGenerator();
    service.destroy();
    await testBed.cleanup();
  };

  return {
    service,
    logger,
    safeDispatcher,
    schemaValidator,
    testBed,
    cleanup,
    restoreGenerator,
  };
}

const waitForTick = () => new Promise((resolve) => setImmediate(resolve));

describe('AnatomyInitializationService resilience scenarios', () => {
  it('validates constructor dependencies', () => {
    const logger = new RecordingLogger();
    const anatomyGenerationService = { generateAnatomyIfNeeded: jest.fn() };
    const dispatcher = { subscribe: jest.fn() };

    expect(
      () =>
        new AnatomyInitializationService({
          logger,
          anatomyGenerationService,
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: dispatcher,
          anatomyGenerationService,
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher: dispatcher,
          logger,
        })
    ).toThrow(InvalidArgumentError);
  });

  it('warns when initialized twice and ignores duplicate calls', async () => {
    const { service, logger, cleanup } = await createService();

    try {
      service.initialize();
      service.initialize();

      expect(
        logger.calls.warn.some(([message]) =>
          message.includes('Already initialized')
        )
      ).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('skips reconstructed entities without queueing them', async () => {
    const { service, safeDispatcher, cleanup } = await createService();

    try {
      service.initialize();

      await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
        instanceId: 'actor-skip',
        definitionId: 'core:actor',
        wasReconstructed: true,
      });

      await waitForTick();

      expect(service.hasPendingGenerations()).toBe(false);
      expect(service.getPendingGenerationCount()).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it('rejects waiters when anatomy generation fails and continues processing', async () => {
    const {
      service,
      safeDispatcher,
      testBed,
      logger,
      cleanup,
      restoreGenerator,
    } = await createService();

    try {
      service.initialize();

      const failingActor =
        await testBed.entityManager.createEntityInstance('core:actor');
      const succeedingActor =
        await testBed.entityManager.createEntityInstance('core:actor');

      await testBed.entityManager.addComponent(
        failingActor.id,
        'anatomy:body',
        { recipeId: 'anatomy:human_female' }
      );
      await testBed.entityManager.addComponent(
        succeedingActor.id,
        'anatomy:body',
        { recipeId: 'anatomy:human_female' }
      );

      const originalGenerate =
        testBed.anatomyGenerationService.generateAnatomyIfNeeded;

      testBed.anatomyGenerationService.generateAnatomyIfNeeded = jest.fn(
        async (entityId) => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          if (entityId === failingActor.id) {
            throw new Error('simulated generation failure');
          }
          return originalGenerate.call(
            testBed.anatomyGenerationService,
            entityId
          );
        }
      );

      await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
        instanceId: failingActor.id,
        definitionId: 'core:actor',
        wasReconstructed: false,
      });

      await waitForTick();
      const failureWait = service.waitForEntityGeneration(failingActor.id, 200);

      await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
        instanceId: succeedingActor.id,
        definitionId: 'core:actor',
        wasReconstructed: false,
      });

      await waitForTick();
      const successWait = service.waitForEntityGeneration(
        succeedingActor.id,
        200
      );

      await expect(failureWait).rejects.toThrow('simulated generation failure');
      await successWait;

      await service.waitForAllGenerationsToComplete();

      const generatedBody = testBed.entityManager.getComponentData(
        succeedingActor.id,
        'anatomy:body'
      );
      expect(generatedBody?.body?.root).toBeTruthy();

      expect(service.hasPendingGenerations()).toBe(false);
      expect(
        logger.calls.error.some(([message]) =>
          message.includes('Failed to generate anatomy for entity')
        )
      ).toBe(true);
    } finally {
      restoreGenerator();
      await cleanup();
    }
  });

  it('supports direct anatomy generation success and failure reporting', async () => {
    const { service, logger, testBed, cleanup, restoreGenerator } =
      await createService();

    try {
      const originalGenerate =
        testBed.anatomyGenerationService.generateAnatomyIfNeeded;

      testBed.anatomyGenerationService.generateAnatomyIfNeeded = jest.fn(
        async () => true
      );

      await expect(
        service.generateAnatomy('entity-success', 'blueprint-alpha')
      ).resolves.toBe(true);
      expect(
        logger.calls.info.some(([message]) =>
          message.includes('Successfully generated anatomy for entity')
        )
      ).toBe(true);

      testBed.anatomyGenerationService.generateAnatomyIfNeeded = jest.fn(
        async () => {
          throw new Error('direct failure');
        }
      );

      await expect(
        service.generateAnatomy('entity-failure', 'blueprint-beta')
      ).rejects.toThrow('direct failure');
      expect(
        logger.calls.error.some(([message]) =>
          message.includes('Failed to generate anatomy for entity')
        )
      ).toBe(true);

      testBed.anatomyGenerationService.generateAnatomyIfNeeded =
        originalGenerate;
    } finally {
      restoreGenerator();
      await cleanup();
    }
  });

  it('raises a timeout when the queue never drains', async () => {
    const { service, cleanup } = await createService();

    try {
      service.__TEST_ONLY__setInternalState({
        queue: ['actor-a', 'actor-b'],
        pending: ['actor-pending'],
        processing: true,
      });

      await expect(service.waitForAllGenerationsToComplete(25)).rejects.toThrow(
        'Timeout waiting for anatomy generation to complete'
      );

      service.__TEST_ONLY__setInternalState({
        queue: [],
        pending: [],
        processing: false,
      });
    } finally {
      await cleanup();
    }
  });

  it('times out when waiting on a specific entity that never resolves', async () => {
    const { service, cleanup } = await createService();

    try {
      service.__TEST_ONLY__setInternalState({ pending: ['ghost-entity'] });

      await expect(
        service.waitForEntityGeneration('ghost-entity', 30)
      ).rejects.toThrow('Timeout waiting for anatomy generation for entity');

      service.__TEST_ONLY__setInternalState({ pending: [], queue: [] });
    } finally {
      await cleanup();
    }
  });

  it('executes queue processing helper with ensureProcessingFlag', async () => {
    const { service, testBed, cleanup, restoreGenerator } =
      await createService();

    try {
      const processed = [];
      const originalGenerate =
        testBed.anatomyGenerationService.generateAnatomyIfNeeded;

      testBed.anatomyGenerationService.generateAnatomyIfNeeded = jest.fn(
        async (entityId) => {
          processed.push(entityId);
          return false;
        }
      );

      service.__TEST_ONLY__setInternalState({
        queue: ['queued-entity'],
        pending: [],
        processing: true,
      });

      await service.__TEST_ONLY__processQueue({ ensureProcessingFlag: true });

      expect(processed).toEqual(['queued-entity']);
      expect(service.hasPendingGenerations()).toBe(false);

      testBed.anatomyGenerationService.generateAnatomyIfNeeded =
        originalGenerate;
    } finally {
      restoreGenerator();
      await cleanup();
    }
  });
});
