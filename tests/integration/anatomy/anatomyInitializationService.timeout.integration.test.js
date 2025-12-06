import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(...args) {
    this.debugLogs.push(args);
  }

  info(...args) {
    this.infoLogs.push(args);
  }

  warn(...args) {
    this.warnLogs.push(args);
  }

  error(...args) {
    this.errorLogs.push(args);
  }
}

class NoopSchemaValidator {
  isSchemaLoaded() {
    return false;
  }

  validate() {
    return { isValid: true, errors: [] };
  }
}

class MinimalGameDataRepository {
  constructor(eventDefinitions) {
    this.definitions = new Map(eventDefinitions);
  }

  getEventDefinition(eventName) {
    return this.definitions.get(eventName) ?? null;
  }
}

class ControlledGenerationService {
  constructor() {
    this.pending = new Map();
  }

  generateAnatomyIfNeeded(entityId) {
    return new Promise((resolve, reject) => {
      this.pending.set(entityId, { resolve, reject });
    });
  }

  resolve(entityId, value) {
    const entry = this.pending.get(entityId);
    if (entry) {
      entry.resolve(value);
      this.pending.delete(entityId);
    }
  }

  reject(entityId, error) {
    const entry = this.pending.get(entityId);
    if (entry) {
      entry.reject(error);
      this.pending.delete(entityId);
    }
  }

  clear() {
    this.pending.clear();
  }
}

const waitForMicrotask = () => new Promise((resolve) => setImmediate(resolve));

describe('AnatomyInitializationService timeout behaviour', () => {
  let logger;
  let schemaValidator;
  let gameDataRepository;
  let eventBus;
  let validatedDispatcher;
  let safeDispatcher;
  let generationService;
  let service;

  beforeEach(() => {
    logger = new RecordingLogger();
    schemaValidator = new NoopSchemaValidator();
    gameDataRepository = new MinimalGameDataRepository([
      [ENTITY_CREATED_ID, { id: ENTITY_CREATED_ID, payloadSchema: null }],
    ]);
    eventBus = new EventBus({ logger });
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
    generationService = new ControlledGenerationService();
    service = new AnatomyInitializationService({
      eventDispatcher: safeDispatcher,
      logger,
      anatomyGenerationService: generationService,
    });
    service.initialize();
  });

  afterEach(async () => {
    generationService.clear();
    service.destroy();
    await waitForMicrotask();
  });

  it('rejects when a specific entity generation exceeds the timeout', async () => {
    const actorId = 'actor-timeout';

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: actorId,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });
    await waitForMicrotask();

    await expect(service.waitForEntityGeneration(actorId, 25)).rejects.toThrow(
      `AnatomyInitializationService: Timeout waiting for anatomy generation for entity '${actorId}'`
    );

    expect(service.hasPendingGenerations()).toBe(true);
    expect(service.getPendingGenerationCount()).toBe(1);

    generationService.resolve(actorId, false);
    await service.waitForAllGenerationsToComplete(200);
  });

  it('throws immediately when the deadline is already exceeded on entry', async () => {
    const actorId = 'actor-queue-timeout-now';

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: actorId,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });
    await waitForMicrotask();

    const originalNow = Date.now;
    const baseline = originalNow();
    let call = 0;
    Date.now = () => {
      call += 1;
      if (call === 1) {
        return baseline;
      }
      if (call === 2) {
        return baseline + 40; // exceed the 30ms timeout immediately
      }
      return originalNow();
    };

    try {
      await expect(service.waitForAllGenerationsToComplete(30)).rejects.toThrow(
        'AnatomyInitializationService: Timeout waiting for anatomy generation to complete.'
      );
    } finally {
      Date.now = originalNow;
    }

    generationService.resolve(actorId, false);
    await service.waitForAllGenerationsToComplete(200);
  });

  it('throws when no time remains before scheduling the delay', async () => {
    const actorId = 'actor-queue-timeout-remaining';

    await safeDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: actorId,
      definitionId: 'core:actor',
      wasReconstructed: false,
    });
    await waitForMicrotask();

    const originalNow = Date.now;
    const baseline = originalNow();
    let call = 0;
    Date.now = () => {
      call += 1;
      if (call === 1) {
        return baseline;
      }
      if (call === 2) {
        return baseline + 30; // exactly the timeout
      }
      return originalNow();
    };

    try {
      await expect(service.waitForAllGenerationsToComplete(30)).rejects.toThrow(
        'AnatomyInitializationService: Timeout waiting for anatomy generation to complete.'
      );
    } finally {
      Date.now = originalNow;
    }

    generationService.resolve(actorId, false);
    await service.waitForAllGenerationsToComplete(200);
  });
});
