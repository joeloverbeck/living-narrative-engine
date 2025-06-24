import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ManualSaveCoordinator from '../../../src/persistence/manualSaveCoordinator.js';
import { createMockLogger } from '../testUtils.js';

describe('ManualSaveCoordinator', () => {
  let logger;
  let captureService;
  let saveLoadService;
  let coordinator;

  beforeEach(() => {
    logger = createMockLogger();
    captureService = {
      captureCurrentGameState: jest.fn(() => ({ metadata: {}, gameState: {} })),
    };
    saveLoadService = {
      saveManualGame: jest.fn().mockResolvedValue({ success: true }),
    };
    coordinator = new ManualSaveCoordinator({
      logger,
      gameStateCaptureService: captureService,
      saveLoadService,
    });
  });

  it('saveGame delegates to saveLoadService without mutating state', async () => {
    const capturedState = {};
    captureService.captureCurrentGameState.mockReturnValueOnce(capturedState);
    await coordinator.saveGame('Slot', 'World');
    expect(captureService.captureCurrentGameState).toHaveBeenCalledWith(
      'World'
    );
    expect(saveLoadService.saveManualGame).toHaveBeenCalledWith(
      'Slot',
      capturedState
    );
  });

  it('saveGame preserves existing state fields', async () => {
    await coordinator.saveGame('Slot', 'World');
    expect(saveLoadService.saveManualGame).toHaveBeenCalledWith('Slot', {
      metadata: {},
      gameState: {},
    });
  });
});
