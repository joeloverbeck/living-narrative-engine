import { describe, expect, it, beforeEach } from '@jest/globals';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';

class TestLogger {
  constructor() {
    this.debugRecords = [];
    this.infoRecords = [];
    this.warnRecords = [];
    this.errorRecords = [];
  }

  debug(message, context) {
    this.debugRecords.push({ message, context });
  }

  info(message, context) {
    this.infoRecords.push({ message, context });
  }

  warn(message, context) {
    this.warnRecords.push({ message, context });
  }

  error(message, context) {
    this.errorRecords.push({ message, context });
  }
}

class TestEventDispatcher {
  constructor() {
    this.subscribers = new Map();
  }

  subscribe(eventId, handler) {
    if (!this.subscribers.has(eventId)) {
      this.subscribers.set(eventId, new Set());
    }
    const handlers = this.subscribers.get(eventId);
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscribers.delete(eventId);
      }
    };
  }

  async emit(eventId, payload) {
    const handlers = Array.from(this.subscribers.get(eventId) ?? []);
    for (const handler of handlers) {
      await handler({ type: eventId, payload });
    }
  }
}

class FakeAnatomyGenerationService {
  constructor() {
    this.behavior = new Map();
    this.callSequence = [];
  }

  configure(entityId, { delay = 0, shouldFail = false } = {}) {
    this.behavior.set(entityId, {
      delay,
      shouldFailOnce: shouldFail,
      generated: false,
    });
  }

  async generateAnatomyIfNeeded(entityId) {
    this.callSequence.push(entityId);
    const behavior = this.behavior.get(entityId);

    if (behavior?.delay) {
      await new Promise((resolve) => setTimeout(resolve, behavior.delay));
    }

    if (behavior?.shouldFailOnce) {
      behavior.shouldFailOnce = false;
      throw new Error(`generation failed for ${entityId}`);
    }

    if (!behavior || !behavior.generated) {
      if (behavior) {
        behavior.generated = true;
      } else {
        this.behavior.set(entityId, {
          delay: 0,
          shouldFailOnce: false,
          generated: true,
        });
      }
      return true;
    }

    return false;
  }
}

const waitForLog = async (records, substring, timeout = 200) => {
  const start = Date.now();
  const hasMatch = () =>
    records.some(({ message }) => message?.includes(substring));
  if (hasMatch()) {
    return;
  }

  while (!hasMatch()) {
    if (Date.now() - start > timeout) {
      throw new Error(`Timeout waiting for log containing: ${substring}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

describe('AnatomyInitializationService integration queue coverage', () => {
  let logger;
  let eventDispatcher;
  let generationService;
  let service;

  beforeEach(() => {
    logger = new TestLogger();
    eventDispatcher = new TestEventDispatcher();
    generationService = new FakeAnatomyGenerationService();
    service = new AnatomyInitializationService({
      eventDispatcher,
      logger,
      anatomyGenerationService: generationService,
    });
  });

  it('validates required dependencies before initialization', () => {
    expect(
      () =>
        new AnatomyInitializationService({
          logger,
          anatomyGenerationService: generationService,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher,
          anatomyGenerationService: generationService,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () => new AnatomyInitializationService({ eventDispatcher, logger })
    ).toThrow(InvalidArgumentError);
  });

  it('processes entity creation queue, resolves waits, and supports manual orchestration', async () => {
    service.initialize();
    service.initialize();
    expect(
      logger.warnRecords.some(({ message }) =>
        message.includes('Already initialized')
      )
    ).toBe(true);

    await eventDispatcher.emit(ENTITY_CREATED_ID, { instanceId: undefined });
    expect(
      logger.warnRecords.some(({ message }) =>
        message.includes('missing instanceId')
      )
    ).toBe(true);

    await eventDispatcher.emit(ENTITY_CREATED_ID, {
      instanceId: 'reconstructed',
      wasReconstructed: true,
    });

    generationService.configure('entity-1', { delay: 20 });
    generationService.configure('entity-2', { delay: 10 });
    generationService.configure('entity-error', {
      delay: 30,
      shouldFail: true,
    });

    await eventDispatcher.emit(ENTITY_CREATED_ID, { instanceId: 'entity-1' });
    await waitForLog(
      logger.debugRecords,
      "Processing anatomy generation for entity 'entity-1'"
    );
    const waitEntityOne = service.waitForEntityGeneration('entity-1', 500);

    await eventDispatcher.emit(ENTITY_CREATED_ID, { instanceId: 'entity-2' });
    await eventDispatcher.emit(ENTITY_CREATED_ID, {
      instanceId: 'entity-error',
    });

    const immediateFalse = await service.waitForEntityGeneration('no-pending');
    expect(immediateFalse).toBe(false);

    const firstGenerated = await waitEntityOne;
    expect(firstGenerated).toBe(true);

    await waitForLog(
      logger.debugRecords,
      "Processing anatomy generation for entity 'entity-2'"
    );
    const waitEntityTwo = service.waitForEntityGeneration('entity-2', 500);
    const secondGenerated = await waitEntityTwo;
    expect(secondGenerated).toBe(true);

    await waitForLog(
      logger.debugRecords,
      "Processing anatomy generation for entity 'entity-error'"
    );
    await expect(
      service.waitForEntityGeneration('entity-error', 500)
    ).rejects.toThrow('generation failed');

    await expect(
      service.waitForAllGenerationsToComplete(1000)
    ).resolves.toBeUndefined();
    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);

    const manualFirst = await service.generateAnatomy(
      'entity-manual',
      'humanoid'
    );
    expect(manualFirst).toBe(true);
    const manualSecond = await service.generateAnatomy(
      'entity-manual',
      'humanoid'
    );
    expect(manualSecond).toBe(false);

    generationService.configure('entity-failure', { shouldFail: true });
    await expect(
      service.generateAnatomy('entity-failure', 'humanoid')
    ).rejects.toThrow('generation failed');

    generationService.configure('manual-queue', { delay: 0 });
    service.__TEST_ONLY__setInternalState({
      queue: ['manual-queue'],
      pending: [],
    });
    await service.__TEST_ONLY__processQueue({ ensureProcessingFlag: true });

    service.__TEST_ONLY__setInternalState({
      queue: ['stuck'],
      pending: ['stuck'],
      processing: true,
    });
    await expect(service.waitForAllGenerationsToComplete(10)).rejects.toThrow(
      'Timeout waiting for anatomy generation'
    );
    service.__TEST_ONLY__setInternalState({ queue: [], pending: [] });

    const originalNow = Date.now;
    try {
      let callIndex = 0;
      Date.now = () => {
        callIndex += 1;
        if (callIndex === 1) return 10_000; // start time
        if (callIndex === 2) return 10_000; // now equals deadline so remaining becomes zero
        return 10_001;
      };
      service.__TEST_ONLY__setInternalState({
        queue: ['deadline-zero'],
        pending: [],
        processing: true,
      });
      await expect(service.waitForAllGenerationsToComplete(0)).rejects.toThrow(
        'Timeout waiting for anatomy generation'
      );
    } finally {
      Date.now = originalNow;
      service.__TEST_ONLY__setInternalState({
        queue: [],
        pending: [],
        processing: false,
      });
    }

    const realNow = Date.now;
    try {
      let callCount = 0;
      Date.now = () => {
        callCount += 1;
        if (callCount === 1) return 20_000; // start
        if (callCount === 2) return 20_000; // first now
        if (callCount === 3) return 20_000; // before delay completes
        return 20_002; // after sleep, exceed deadline
      };
      service.__TEST_ONLY__setInternalState({
        queue: ['post-sleep'],
        pending: [],
        processing: true,
      });
      await expect(service.waitForAllGenerationsToComplete(1)).rejects.toThrow(
        'Timeout waiting for anatomy generation'
      );
    } finally {
      Date.now = realNow;
      service.__TEST_ONLY__setInternalState({
        queue: [],
        pending: [],
        processing: false,
      });
    }

    service.__TEST_ONLY__setInternalState({ pending: ['stalling'] });
    await expect(
      service.waitForEntityGeneration('stalling', 10)
    ).rejects.toThrow('Timeout waiting for anatomy generation');
    service.__TEST_ONLY__setInternalState({ pending: [] });

    const recordedCalls = generationService.callSequence.join(',');
    expect(recordedCalls).toContain('entity-1');
    expect(recordedCalls).toContain('entity-2');
    expect(recordedCalls).toContain('entity-error');
    expect(recordedCalls).toContain('entity-manual');
    expect(recordedCalls).toContain('entity-failure');
    expect(recordedCalls).toContain('manual-queue');

    const warnMessages = logger.warnRecords.map(({ message }) => message);
    expect(
      warnMessages.some((message) => message.includes('missing instanceId'))
    ).toBe(true);

    service.destroy();
    expect(
      logger.infoRecords.some(({ message }) => message.includes('Destroyed'))
    ).toBe(true);

    const callCountBefore = generationService.callSequence.length;
    await eventDispatcher.emit(ENTITY_CREATED_ID, {
      instanceId: 'post-destroy',
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(generationService.callSequence.length).toBe(callCountBefore);
  }, 30000);
});
