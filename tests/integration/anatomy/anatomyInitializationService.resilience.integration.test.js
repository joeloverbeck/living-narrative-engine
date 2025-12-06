import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
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

describe('AnatomyInitializationService dependency validation', () => {
  it('throws InvalidArgumentError when required dependencies are missing', () => {
    const logger = new RecordingLogger();
    const anatomyGenerationService = { generateAnatomyIfNeeded: jest.fn() };
    const eventDispatcher = { subscribe: jest.fn() };

    expect(
      () =>
        new AnatomyInitializationService({
          logger,
          anatomyGenerationService,
        })
    ).toThrow(new InvalidArgumentError('eventDispatcher is required'));

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher,
          anatomyGenerationService,
        })
    ).toThrow(new InvalidArgumentError('logger is required'));

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher,
          logger,
        })
    ).toThrow(new InvalidArgumentError('anatomyGenerationService is required'));
  });
});

describe('AnatomyInitializationService resilience integration', () => {
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
    jest.useRealTimers();
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
      description: 'Integration event for entity creation',
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
  });

  afterEach(async () => {
    if (testBed?.anatomyGenerationService && restoreGenerate) {
      testBed.anatomyGenerationService.generateAnatomyIfNeeded =
        restoreGenerate;
    }
    service?.destroy();
    await testBed.cleanup();
  });

  it('warns when initialized twice and ignores reconstructed entities', async () => {
    service.initialize();
    service.initialize();

    const duplicateWarning = logger.calls.warn.find(
      ([message]) =>
        typeof message === 'string' &&
        message.includes('AnatomyInitializationService: Already initialized')
    );
    expect(duplicateWarning).toBeDefined();

    const actor =
      await testBed.entityManager.createEntityInstance('core:actor');
    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: actor.id,
      definitionId: 'core:actor',
      wasReconstructed: true,
    });

    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);
  });

  it('resolves successful generations and rejects failures without stopping the queue', async () => {
    service.initialize();

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

    const failure = new Error('generation failed');
    const generateSpy = jest
      .spyOn(testBed.anatomyGenerationService, 'generateAnatomyIfNeeded')
      .mockImplementation(async (entityId) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (entityId === secondActor.id) {
          throw failure;
        }
        return true;
      });

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: firstActor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });
    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: secondActor.id,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });

    await new Promise((resolve) => setImmediate(resolve));

    await expect(
      service.waitForEntityGeneration(firstActor.id, 200)
    ).resolves.toBe(true);
    await expect(
      service.waitForEntityGeneration(secondActor.id, 200)
    ).rejects.toBe(failure);

    await service.waitForAllGenerationsToComplete();

    expect(
      logger.calls.error.some(
        ([message, details]) =>
          typeof message === 'string' &&
          message.includes('Failed to generate anatomy for entity') &&
          details?.error === failure
      )
    ).toBe(true);

    generateSpy.mockRestore();
  });

  it('delegates direct generation requests and propagates errors', async () => {
    const generateSpy = jest
      .spyOn(testBed.anatomyGenerationService, 'generateAnatomyIfNeeded')
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('direct failure'));

    await expect(
      service.generateAnatomy('entity-alpha', 'blueprint-a')
    ).resolves.toBe(true);

    expect(
      logger.calls.info.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes(
            "AnatomyInitializationService: Successfully generated anatomy for entity 'entity-alpha'"
          )
      )
    ).toBe(true);

    await expect(
      service.generateAnatomy('entity-beta', 'blueprint-b')
    ).rejects.toThrow('direct failure');

    expect(
      logger.calls.error.some(
        ([message]) =>
          typeof message === 'string' &&
          message.includes(
            "AnatomyInitializationService: Failed to generate anatomy for entity 'entity-beta'"
          )
      )
    ).toBe(true);

    generateSpy.mockRestore();
  });

  it('supports timeout handling utilities and test helpers for queue management', async () => {
    service.initialize();

    await expect(service.waitForEntityGeneration('not-pending')).resolves.toBe(
      false
    );

    service.__TEST_ONLY__setInternalState({
      queue: ['stuck-entity'],
      pending: ['stuck-entity'],
      processing: true,
    });

    const realNow = Date.now;
    const baseTime = realNow();
    let callIndex = 0;
    const timeline = [baseTime, baseTime, baseTime + 10];
    Date.now = () => {
      const value =
        callIndex < timeline.length
          ? timeline[callIndex]
          : timeline[timeline.length - 1];
      callIndex += 1;
      return value;
    };

    await expect(service.waitForAllGenerationsToComplete(1)).rejects.toThrow(
      'Timeout waiting for anatomy generation'
    );

    Date.now = realNow;

    service.__TEST_ONLY__setInternalState({
      queue: ['stuck-entity'],
      pending: ['stuck-entity'],
      processing: true,
    });

    const realNowLate = Date.now;
    const lateBase = realNowLate();
    let lateIndex = 0;
    const lateTimeline = [lateBase, lateBase + 50];
    Date.now = () => {
      const value =
        lateIndex < lateTimeline.length
          ? lateTimeline[lateIndex]
          : lateTimeline[lateTimeline.length - 1];
      lateIndex += 1;
      return value;
    };

    await expect(service.waitForAllGenerationsToComplete(10)).rejects.toThrow(
      'Timeout waiting for anatomy generation'
    );

    Date.now = realNowLate;

    service.__TEST_ONLY__setInternalState({
      queue: ['stuck-entity'],
      pending: ['stuck-entity'],
      processing: true,
    });

    await expect(service.waitForAllGenerationsToComplete(0)).rejects.toThrow(
      'Timeout waiting for anatomy generation'
    );

    service.__TEST_ONLY__setInternalState({
      queue: ['helper'],
      pending: [],
      processing: false,
    });
    const helperSpy = jest
      .spyOn(testBed.anatomyGenerationService, 'generateAnatomyIfNeeded')
      .mockResolvedValue(false);

    await service.__TEST_ONLY__processQueue({ ensureProcessingFlag: true });

    helperSpy.mockRestore();

    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);

    service.__TEST_ONLY__setInternalState({ pending: ['ghost'], queue: [] });
    await expect(service.waitForEntityGeneration('ghost', 10)).rejects.toThrow(
      "Timeout waiting for anatomy generation for entity 'ghost'"
    );

    service.__TEST_ONLY__setInternalState({ pending: [], queue: [] });
    await expect(
      service.waitForAllGenerationsToComplete()
    ).resolves.toBeUndefined();
  });
});
