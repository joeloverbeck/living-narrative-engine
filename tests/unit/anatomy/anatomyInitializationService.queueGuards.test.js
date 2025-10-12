import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';

const createService = () => {
  const eventDispatcher = {
    subscribe: jest.fn(() => jest.fn()),
  };

  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const anatomyGenerationService = {
    generateAnatomyIfNeeded: jest.fn().mockResolvedValue(false),
  };

  const service = new AnatomyInitializationService({
    eventDispatcher,
    logger,
    anatomyGenerationService,
  });

  return { service, eventDispatcher, logger, anatomyGenerationService };
};

describe('AnatomyInitializationService queue guard coverage', () => {
  /** @type {ReturnType<typeof createService>} */
  let context;

  beforeEach(() => {
    context = createService();
  });

  it('re-enables processing guard when queue processor invoked externally', async () => {
    context.service.__TEST_ONLY__setInternalState({
      queue: ['entity-queue-branch'],
      processing: false,
    });

    await context.service.__TEST_ONLY__processQueue();

    expect(context.anatomyGenerationService.generateAnatomyIfNeeded).toHaveBeenCalledWith(
      'entity-queue-branch',
    );
    expect(context.service.hasPendingGenerations()).toBe(false);
    expect(context.service.getPendingGenerationCount()).toBe(0);
    expect(context.logger.debug).toHaveBeenCalledWith(
      'AnatomyInitializationService: Finished processing anatomy generation queue',
    );
  });

  it('overwrites pending generation set through test helper', () => {
    context.service.__TEST_ONLY__setInternalState({
      pending: ['entity-a', 'entity-b'],
      processing: true,
    });

    expect(context.service.getPendingGenerationCount()).toBe(2);

    context.service.__TEST_ONLY__setInternalState({ pending: ['entity-c'] });

    expect(context.service.getPendingGenerationCount()).toBe(1);
    expect(context.service.hasPendingGenerations()).toBe(true);
  });

  it('resets processing flag when explicitly requested', async () => {
    context.service.__TEST_ONLY__setInternalState({
      queue: ['entity-guard-reset'],
      processing: true,
    });

    await context.service.__TEST_ONLY__processQueue({ ensureProcessingFlag: true });

    expect(context.service.hasPendingGenerations()).toBe(false);
    expect(context.anatomyGenerationService.generateAnatomyIfNeeded).toHaveBeenCalledWith(
      'entity-guard-reset',
    );
  });

  it('throws immediately when waitForAllGenerationsToComplete exceeds deadline', async () => {
    context.service.__TEST_ONLY__setInternalState({
      queue: ['entity-timeout'],
      processing: false,
    });

    const nowSpy = jest.spyOn(Date, 'now');
    const base = 1_000;
    nowSpy.mockReturnValueOnce(base); // startTime
    nowSpy.mockReturnValue(base + 5); // first loop iteration

    await expect(context.service.waitForAllGenerationsToComplete(0)).rejects.toThrow(
      /AnatomyInitializationService: Timeout waiting for anatomy generation to complete\./,
    );

    nowSpy.mockRestore();
  });
});
