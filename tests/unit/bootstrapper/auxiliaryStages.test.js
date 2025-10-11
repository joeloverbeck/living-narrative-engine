import { describe, it, expect, jest } from '@jest/globals';
import { initializeAuxiliaryServicesStage } from '../../../src/bootstrapper/stages';
import StageError from '../../../src/bootstrapper/StageError.js';

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
  SaveGameUI: 'SaveGameUI',
  LoadGameUI: 'LoadGameUI',
  LlmSelectionModal: 'LlmSelectionModal',
  CurrentTurnActorRenderer: 'CurrentTurnActorRenderer',
  SpeechBubbleRenderer: 'SpeechBubbleRenderer',
  ProcessingIndicatorController: 'ProcessingIndicatorController',
  IEventBus: 'IEventBus',
};

describe('initializeAuxiliaryServicesStage', () => {
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
    expect(mockEventBus.subscribe).toHaveBeenCalled();
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
});
