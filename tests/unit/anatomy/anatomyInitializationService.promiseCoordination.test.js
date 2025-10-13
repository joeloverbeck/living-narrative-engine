import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

/**
 * These tests target the promise coordination utilities exposed by
 * AnatomyInitializationService to ensure deterministic coverage of
 * queue processing and waiting helpers.
 */
describe('AnatomyInitializationService promise coordination helpers', () => {
  let service;
  let eventDispatcher;
  let logger;
  let anatomyGenerationService;

  const createService = () =>
    new AnatomyInitializationService({
      eventDispatcher,
      logger,
      anatomyGenerationService,
    });

  beforeEach(() => {
    eventDispatcher = {
      subscribe: jest.fn(() => jest.fn()),
    };

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    anatomyGenerationService = {
      generateAnatomyIfNeeded: jest.fn(),
    };

    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('delegates anatomy generation and logs success', async () => {
    anatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValueOnce(true);

    const result = await service.generateAnatomy('actor-1', 'blueprint-7');

    expect(anatomyGenerationService.generateAnatomyIfNeeded).toHaveBeenCalledWith(
      'actor-1',
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "AnatomyInitializationService: Generating anatomy for entity 'actor-1' with blueprint 'blueprint-7'",
    );
    expect(logger.info).toHaveBeenCalledWith(
      "AnatomyInitializationService: Successfully generated anatomy for entity 'actor-1' with blueprint 'blueprint-7'",
    );
    expect(result).toBe(true);
  });

  it('logs and rethrows when anatomy generation fails', async () => {
    const failure = new Error('boom');
    anatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValueOnce(failure);

    await expect(service.generateAnatomy('actor-2', 'bp')).rejects.toBe(failure);
    expect(logger.error).toHaveBeenCalledWith(
      "AnatomyInitializationService: Failed to generate anatomy for entity 'actor-2' with blueprint 'bp'",
      { error: failure },
    );
  });

  it('immediately resolves false when waiting for a non-pending entity', async () => {
    service.__TEST_ONLY__setInternalState({ queue: [], pending: [] });

    await expect(service.waitForEntityGeneration('ghost')).resolves.toBe(false);
    expect(logger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('Processing anatomy generation'),
    );
  });

  it('resolves waiters after successful queue processing', async () => {
    anatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValueOnce(true);

    service.__TEST_ONLY__setInternalState({
      queue: ['entity-success'],
      pending: ['entity-success'],
      processing: true,
    });

    const waitPromise = service.waitForEntityGeneration('entity-success');

    await service.__TEST_ONLY__processQueue({ ensureProcessingFlag: true });

    await expect(waitPromise).resolves.toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      "AnatomyInitializationService: Generated anatomy for entity 'entity-success'",
    );
    expect(service.hasPendingGenerations()).toBe(false);
  });

  it('propagates errors to waiters when generation rejects', async () => {
    const generationError = new Error('generation failed');
    anatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValueOnce(generationError);

    service.__TEST_ONLY__setInternalState({
      queue: ['entity-failure'],
      pending: ['entity-failure'],
      processing: true,
    });

    const waitPromise = service.waitForEntityGeneration('entity-failure');

    await service.__TEST_ONLY__processQueue({ ensureProcessingFlag: true });

    await expect(waitPromise).rejects.toBe(generationError);
    expect(logger.error).toHaveBeenCalledWith(
      "AnatomyInitializationService: Failed to generate anatomy for entity 'entity-failure'",
      { error: generationError },
    );
    expect(service.hasPendingGenerations()).toBe(false);
  });

  it('rejects waiters that exceed the provided timeout', async () => {
    service.__TEST_ONLY__setInternalState({
      queue: ['slow-entity'],
      pending: ['slow-entity'],
      processing: true,
    });

    jest.useFakeTimers();

    const waitPromise = service.waitForEntityGeneration('slow-entity', 25);

    jest.advanceTimersByTime(30);

    await expect(waitPromise).rejects.toThrow(
      "AnatomyInitializationService: Timeout waiting for anatomy generation for entity 'slow-entity'",
    );
  });

  it('allows tests to manipulate internal state helpers safely', async () => {
    // Exercise default parameter path for __TEST_ONLY__processQueue
    await service.__TEST_ONLY__processQueue();

    // Exercise default parameter path for __TEST_ONLY__setInternalState
    service.__TEST_ONLY__setInternalState();
    service.__TEST_ONLY__setInternalState(undefined);

    service.__TEST_ONLY__setInternalState({
      queue: ['queued'],
      pending: ['pending'],
      processing: false,
    });

    expect(service.hasPendingGenerations()).toBe(true);
    expect(service.getPendingGenerationCount()).toBe(2);

    anatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValueOnce(false);
    service.__TEST_ONLY__setInternalState({ processing: true });
    service.__TEST_ONLY__setInternalState({ queue: ['queued'], pending: ['queued'] });

    await service.__TEST_ONLY__processQueue({ ensureProcessingFlag: true });

    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining('Successfully generated anatomy'),
    );
    expect(service.hasPendingGenerations()).toBe(false);
    expect(service.getPendingGenerationCount()).toBe(0);
  });

  it('requires dependencies in constructor', () => {
    expect(
      () =>
        new AnatomyInitializationService({
          logger,
          anatomyGenerationService,
        }),
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher,
          anatomyGenerationService,
        }),
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new AnatomyInitializationService({
          eventDispatcher,
          logger,
        }),
    ).toThrow(InvalidArgumentError);
  });
});
