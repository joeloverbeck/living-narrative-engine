import { describe, it, expect, jest } from '@jest/globals';
import { initializeAuxiliaryServicesStage } from '../../../src/bootstrapper/stages';
import StageError from '../../../src/bootstrapper/StageError.js';
import { setupEntityCacheInvalidation } from '../../../src/scopeDsl/core/entityHelpers.js';

jest.mock('../../../src/scopeDsl/core/entityHelpers.js', () => ({
  setupEntityCacheInvalidation: jest.fn(),
}));

/**
 * Creates a mock logger for testing.
 *
 * @returns {object} Mock logger with debug, warn, and error methods.
 */
function createLogger() {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

const tokens = {
  EngineUIManager: 'EngineUIManager',
  LlmSelectionModal: 'LlmSelectionModal',
  CurrentTurnActorRenderer: 'CurrentTurnActorRenderer',
  SpeechBubbleRenderer: 'SpeechBubbleRenderer',
  ProcessingIndicatorController: 'ProcessingIndicatorController',
  ActorParticipationController: 'ActorParticipationController',
  PerceptibleEventSenderController: 'PerceptibleEventSenderController',
  ICriticalLogNotifier: 'ICriticalLogNotifier',
  IEventBus: 'IEventBus',
};

describe('initializeAuxiliaryServicesStage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves when all helpers succeed', async () => {
    const logger = createLogger();
    const mockEventBus = { subscribe: jest.fn() };
    const container = {
      resolve: jest.fn((token) => {
        if (token === tokens.IEventBus) {
          return mockEventBus;
        }
        return { init: jest.fn(), initialize: jest.fn() };
      }),
    };

    const result = await initializeAuxiliaryServicesStage(
      container,
      {},
      logger,
      tokens
    );
    expect(result.success).toBe(true);
    expect(setupEntityCacheInvalidation).toHaveBeenCalledWith(mockEventBus);
  });

  it('throws aggregated error when a helper fails', async () => {
    const logger = createLogger();
    const mockEventBus = { subscribe: jest.fn() };
    const container = {
      resolve: jest.fn((token) => {
        if (token === tokens.EngineUIManager) return null;
        if (token === tokens.IEventBus) return mockEventBus;
        return { init: jest.fn(), initialize: jest.fn() };
      }),
    };

    const result = await initializeAuxiliaryServicesStage(
      container,
      {},
      logger,
      tokens
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(result.error.phase).toBe('Auxiliary Services Initialization');
    expect(Array.isArray(result.error.failures)).toBe(true);
  });

  it('fails when event bus cannot be resolved', async () => {
    const logger = createLogger();
    const container = {
      resolve: jest.fn((token) => {
        if (token === tokens.IEventBus) {
          return undefined;
        }
        return { init: jest.fn(), initialize: jest.fn() };
      }),
    };

    const result = await initializeAuxiliaryServicesStage(
      container,
      {},
      logger,
      tokens
    );

    expect(result.success).toBe(false);
    expect(setupEntityCacheInvalidation).not.toHaveBeenCalled();
    expect(result.error).toBeInstanceOf(StageError);
    expect(result.error.message).toBe(
      'EventBus resolution returned undefined. Cannot setup cache invalidation.'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Bootstrap Stage: Auxiliary Services Initialization - EventBus resolution returned undefined. Cannot setup cache invalidation.'
    );
  });

  it('fails when cache invalidation setup throws an error', async () => {
    const logger = createLogger();
    const mockEventBus = {};
    setupEntityCacheInvalidation.mockImplementationOnce(() => {
      throw new Error('Cache exploded');
    });

    const container = {
      resolve: jest.fn((token) => {
        if (token === tokens.IEventBus) {
          return mockEventBus;
        }
        return { init: jest.fn(), initialize: jest.fn() };
      }),
    };

    const result = await initializeAuxiliaryServicesStage(
      container,
      {},
      logger,
      tokens
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(StageError);
    expect(result.error.message).toBe(
      'Failed to setup entity cache invalidation: Cache exploded'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Bootstrap Stage: Auxiliary Services Initialization - Failed to setup entity cache invalidation:',
      expect.any(Error)
    );
  });
});
