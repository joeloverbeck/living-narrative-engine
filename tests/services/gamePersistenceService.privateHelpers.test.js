import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GamePersistenceService from '../../src/persistence/gamePersistenceService.js';

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 *
 */
function makeService() {
  const logger = makeLogger();
  const captureService = { captureCurrentGameState: jest.fn() };
  const saveLoadService = {
    saveManualGame: jest.fn(),
    loadGameData: jest.fn(),
  };
  const entityManager = { clearAll: jest.fn(), reconstructEntity: jest.fn() };
  const playtimeTracker = {
    getTotalPlaytime: jest.fn(),
    setAccumulatedPlaytime: jest.fn(),
  };

  const service = new GamePersistenceService({
    logger,
    saveLoadService,
    entityManager,
    playtimeTracker,
    gameStateCaptureService: captureService,
  });

  return {
    service,
    captureService,
    saveLoadService,
    entityManager,
    playtimeTracker,
    logger,
  };
}

describe('GamePersistenceService private helpers', () => {
  let context;
  beforeEach(() => {
    context = makeService();
  });

  it('_captureGameState delegates to capture service', () => {
    context.captureService.captureCurrentGameState.mockReturnValue({
      test: true,
    });
    const result = context.service._captureGameState('World');
    expect(context.captureService.captureCurrentGameState).toHaveBeenCalledWith(
      'World'
    );
    expect(result).toEqual({ test: true });
  });

  it('_setSaveMetadata ensures metadata and sets name', () => {
    const state = {};
    context.service._setSaveMetadata(state, 'Slot');
    expect(state.metadata.saveName).toBe('Slot');
  });

  it('_delegateManualSave calls SaveLoadService', async () => {
    context.saveLoadService.saveManualGame.mockResolvedValue({ success: true });
    const res = await context.service._delegateManualSave('Slot', {
      gameState: {},
    });
    expect(context.saveLoadService.saveManualGame).toHaveBeenCalledWith(
      'Slot',
      { gameState: {} }
    );
    expect(res).toEqual({ success: true });
  });

  it('_validateRestoreData fails when gameState missing', () => {
    const res = context.service._validateRestoreData({});
    expect(res.success).toBe(false);
  });

  it('_validateRestoreData passes with required fields', () => {
    const res = context.service._validateRestoreData({ gameState: {} });
    expect(res).toBeNull();
  });

  it('_clearExistingEntities returns failure on exception', () => {
    context.entityManager.clearAll.mockImplementation(() => {
      throw new Error('x');
    });
    const res = context.service._clearExistingEntities();
    expect(res.success).toBe(false);
  });

  it('_restoreEntities skips invalid data and restores valid', () => {
    const valid = { instanceId: 'e1', definitionId: 'd1', components: {} };
    context.service._restoreEntities([valid, {}]);
    expect(context.entityManager.reconstructEntity).toHaveBeenCalledWith(valid);
    expect(context.entityManager.reconstructEntity).toHaveBeenCalledTimes(1);
  });

  it('_restorePlaytime handles missing value', () => {
    context.service._restorePlaytime();
    expect(context.playtimeTracker.setAccumulatedPlaytime).toHaveBeenCalledWith(
      0
    );
  });
});
