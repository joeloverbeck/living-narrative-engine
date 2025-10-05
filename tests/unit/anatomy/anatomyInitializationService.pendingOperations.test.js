import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const advanceTimers = async (ms) => {
  jest.advanceTimersByTime(ms);
  await flushPromises();
};

describe('AnatomyInitializationService pending operations', () => {
  /** @type {AnatomyInitializationService} */
  let service;
  let mockEventDispatcher;
  let mockLogger;
  let mockAnatomyGenerationService;
  let unsubscribeMock;
  /** @type {(event: any) => Promise<void>} */
  let boundHandler;

  beforeEach(() => {
    unsubscribeMock = jest.fn();
    mockEventDispatcher = {
      subscribe: jest.fn((eventId, handler) => {
        expect(eventId).toBe(ENTITY_CREATED_ID);
        boundHandler = handler;
        return unsubscribeMock;
      }),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockAnatomyGenerationService = {
      generateAnatomyIfNeeded: jest.fn().mockResolvedValue(false),
    };

    service = new AnatomyInitializationService({
      eventDispatcher: mockEventDispatcher,
      logger: mockLogger,
      anatomyGenerationService: mockAnatomyGenerationService,
    });
    service.initialize();
  });

  afterEach(() => {
    service.destroy();
    jest.useRealTimers();
  });

  const emitEntityCreated = (overrides = {}) =>
    boundHandler({
      type: ENTITY_CREATED_ID,
      payload: {
        instanceId: 'entity-1',
        definitionId: 'definition-1',
        wasReconstructed: false,
        ...overrides,
      },
    });

  it('generateAnatomy delegates to the generation service and logs success', async () => {
    mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValueOnce(true);

    await expect(
      service.generateAnatomy('entity-9', 'blueprint-42')
    ).resolves.toBe(true);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      "AnatomyInitializationService: Generating anatomy for entity 'entity-9' with blueprint 'blueprint-42'"
    );
    expect(mockAnatomyGenerationService.generateAnatomyIfNeeded).toHaveBeenCalledWith(
      'entity-9'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      "AnatomyInitializationService: Successfully generated anatomy for entity 'entity-9' with blueprint 'blueprint-42'"
    );
  });

  it('generateAnatomy logs and rethrows when the generation service fails', async () => {
    const error = new Error('generation failure');
    mockAnatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValueOnce(error);

    await expect(
      service.generateAnatomy('entity-9', 'blueprint-42')
    ).rejects.toBe(error);

    expect(mockLogger.error).toHaveBeenCalledWith(
      "AnatomyInitializationService: Failed to generate anatomy for entity 'entity-9' with blueprint 'blueprint-42'",
      { error }
    );
  });

  it('waitForAllGenerationsToComplete resolves once the queue drains', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    let resolveGeneration;
    mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        })
    );

    await emitEntityCreated();
    await flushPromises();

    expect(service.hasPendingGenerations()).toBe(true);
    expect(service.getPendingGenerationCount()).toBe(1);

    const waitPromise = service.waitForAllGenerationsToComplete(500);

    resolveGeneration(true);
    await flushPromises();
    await advanceTimers(60);

    await waitPromise;

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'AnatomyInitializationService: All anatomy generations completed'
    );
    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);
  });

  it('waitForAllGenerationsToComplete rejects if the queue never drains', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    let resolveGeneration;
    mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        })
    );

    await emitEntityCreated();
    await flushPromises();

    const waitPromise = service.waitForAllGenerationsToComplete(80);

    await advanceTimers(160);
    await expect(waitPromise).rejects.toThrow(
      /Timeout waiting for anatomy generation to complete/
    );

    // Clean up so the internal queue can settle
    resolveGeneration(false);
    await flushPromises();
    await advanceTimers(60);
  });

  it('waitForEntityGeneration resolves false immediately when nothing is pending', async () => {
    await expect(
      service.waitForEntityGeneration('missing-entity', 10)
    ).resolves.toBe(false);
  });

  it('waitForEntityGeneration resolves with the generation result', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    let resolveGeneration;
    mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        })
    );

    const eventPromise = emitEntityCreated();
    await flushPromises();

    const waitPromise = service.waitForEntityGeneration('entity-1', 500);

    resolveGeneration(true);
    await flushPromises();
    await advanceTimers(60);

    await expect(waitPromise).resolves.toBe(true);
    await eventPromise;
  });

  it('waitForEntityGeneration propagates generation errors', async () => {
    const error = new Error('generation failed');
    mockAnatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValueOnce(error);

    const eventPromise = emitEntityCreated();
    const waitPromise = service.waitForEntityGeneration('entity-1', 500);

    await expect(waitPromise).rejects.toBe(error);
    await eventPromise;
  });

  it('waitForEntityGeneration rejects when the timeout elapses', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    let resolveGeneration;
    mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        })
    );

    await emitEntityCreated();
    await flushPromises();

    const waitPromise = service.waitForEntityGeneration('entity-1', 40);

    await advanceTimers(40);
    await expect(waitPromise).rejects.toThrow(
      "AnatomyInitializationService: Timeout waiting for anatomy generation for entity 'entity-1'"
    );

    resolveGeneration(false);
    await flushPromises();
    await advanceTimers(60);
  });

  it('hasPendingGenerations and getPendingGenerationCount reflect queue state', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    let resolveGeneration;
    mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        })
    );

    await emitEntityCreated();
    await flushPromises();

    expect(service.hasPendingGenerations()).toBe(true);
    expect(service.getPendingGenerationCount()).toBe(1);

    resolveGeneration(false);
    await flushPromises();
    await advanceTimers(60);

    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);
  });

  it('destroy clears pending operations and unsubscribes listeners', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);

    let resolveGeneration;
    mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGeneration = resolve;
        })
    );

    await emitEntityCreated();
    await flushPromises();

    expect(service.hasPendingGenerations()).toBe(true);

    service.destroy();

    expect(unsubscribeMock).toHaveBeenCalled();
    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'AnatomyInitializationService: Destroyed'
    );
    await expect(
      service.waitForEntityGeneration('entity-1', 5)
    ).resolves.toBe(false);

    resolveGeneration(false);
    await flushPromises();
    await advanceTimers(60);
  });
});
