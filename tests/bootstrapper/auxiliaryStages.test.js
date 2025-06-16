import { describe, it, expect, jest } from '@jest/globals';
import { initializeAuxiliaryServicesStage } from '../../src/bootstrapper/auxiliaryStages.js';

/**
 *
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
};

describe('initializeAuxiliaryServicesStage', () => {
  it('resolves when all helpers succeed', async () => {
    const logger = createLogger();
    const container = {
      resolve: jest.fn(() => ({ init: jest.fn(), initialize: jest.fn() })),
    };

    await expect(
      initializeAuxiliaryServicesStage(container, {}, logger, tokens)
    ).resolves.toBeUndefined();
  });

  it('throws aggregated error when a helper fails', async () => {
    const logger = createLogger();
    const container = {
      resolve: jest.fn((token) => {
        if (token === tokens.EngineUIManager) return null;
        return { init: jest.fn(), initialize: jest.fn() };
      }),
    };

    await expect(
      initializeAuxiliaryServicesStage(container, {}, logger, tokens)
    ).rejects.toMatchObject({
      phase: 'Auxiliary Services Initialization',
      failures: expect.any(Array),
    });
  });
});
