import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';

/**
 *
 * @param root0
 * @param root0.generationImplementation
 */
function createServiceFixture({ generationImplementation } = {}) {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const unsubscribe = jest.fn();
  let capturedHandler = null;
  const eventDispatcher = {
    subscribe: jest.fn((eventId, handler) => {
      if (eventId === ENTITY_CREATED_ID) {
        capturedHandler = handler;
      }
      return unsubscribe;
    }),
  };

  const anatomyGenerationService = {
    generateAnatomyIfNeeded: jest.fn(
      generationImplementation || (() => Promise.resolve(false))
    ),
  };

  const service = new AnatomyInitializationService({
    eventDispatcher,
    logger,
    anatomyGenerationService,
  });

  return {
    logger,
    eventDispatcher,
    anatomyGenerationService,
    service,
    unsubscribe,
    getEntityCreatedHandler: () => capturedHandler,
  };
}

describe('AnatomyInitializationService test helper integration', () => {
  let fixture;

  beforeEach(() => {
    fixture = createServiceFixture();
  });

  afterEach(() => {
    fixture.service.destroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('processes queued entities when invoked through the test helper override', async () => {
    const processed = [];
    fixture.anatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
      async (entityId) => {
        processed.push(entityId);
        return entityId === 'entity-1';
      }
    );

    fixture.service.__TEST_ONLY__setInternalState({
      queue: ['entity-1', 'entity-2'],
      pending: [],
      processing: true,
    });

    await fixture.service.__TEST_ONLY__processQueue({
      ensureProcessingFlag: true,
    });

    expect(processed).toEqual(['entity-1', 'entity-2']);
    expect(fixture.logger.info).toHaveBeenCalledWith(
      "AnatomyInitializationService: Generated anatomy for entity 'entity-1'"
    );
    expect(fixture.service.hasPendingGenerations()).toBe(false);
    expect(fixture.service.getPendingGenerationCount()).toBe(0);
  });

  it('no-ops when helpers are invoked without overrides', async () => {
    fixture.service.__TEST_ONLY__setInternalState();
    await fixture.service.__TEST_ONLY__processQueue();

    expect(fixture.logger.info).not.toHaveBeenCalled();
    expect(fixture.service.hasPendingGenerations()).toBe(false);
    expect(fixture.service.getPendingGenerationCount()).toBe(0);
  });

  it('surfaces immediate deadline expiration when processing flag is stuck', async () => {
    fixture.service.__TEST_ONLY__setInternalState({ processing: true });

    const nowSequence = [0, 10, 10];
    jest.spyOn(Date, 'now').mockImplementation(() => {
      return nowSequence.shift() ?? 10;
    });

    await expect(
      fixture.service.waitForAllGenerationsToComplete(5)
    ).rejects.toThrow(
      /AnatomyInitializationService: Timeout waiting for anatomy generation to complete/
    );
  });

  it('handles zero remaining time without entering the delay branch', async () => {
    fixture.service.__TEST_ONLY__setInternalState({ processing: true });

    const nowSequence = [100, 100, 100];
    jest.spyOn(Date, 'now').mockImplementation(() => {
      return nowSequence.shift() ?? 100;
    });

    await expect(
      fixture.service.waitForAllGenerationsToComplete(0)
    ).rejects.toThrow(
      /AnatomyInitializationService: Timeout waiting for anatomy generation to complete/
    );
  });

  it('rejects waiters when waitForEntityGeneration times out', async () => {
    fixture.service.__TEST_ONLY__setInternalState({
      pending: ['stuck-entity'],
    });

    await expect(
      fixture.service.waitForEntityGeneration('stuck-entity', 5)
    ).rejects.toThrow(
      "AnatomyInitializationService: Timeout waiting for anatomy generation for entity 'stuck-entity'"
    );
    // Reset the manual pending marker to avoid leaking state into subsequent tests.
    fixture.service.__TEST_ONLY__setInternalState({ pending: [] });
  });
});
