import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GamePersistenceService from '../../src/persistence/gamePersistenceService.js';
import GameStateRestorer from '../../src/persistence/gameStateRestorer.js';

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
  const manualSaveCoordinator = { saveGame: jest.fn() };

  const service = new GamePersistenceService({
    logger,
    saveLoadService,
    entityManager,
    playtimeTracker,
    gameStateCaptureService: captureService,
    manualSaveCoordinator,
  });
  const restorer = new GameStateRestorer({
    logger,
    entityManager,
    playtimeTracker,
  });

  return {
    service,
    restorer,
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

  it('_validateRestoreData fails when gameState missing', () => {
    const res = context.restorer._validateRestoreData({});
    expect(res.success).toBe(false);
  });

  it('_validateRestoreData passes with required fields', () => {
    const res = context.restorer._validateRestoreData({ gameState: {} });
    expect(res).toBeNull();
  });

  it('_clearExistingEntities returns failure on exception', () => {
    context.entityManager.clearAll.mockImplementation(() => {
      throw new Error('x');
    });
    const res = context.restorer._clearExistingEntities();
    expect(res.success).toBe(false);
  });

  it('_restoreEntities skips invalid data and restores valid', () => {
    const valid = { instanceId: 'e1', definitionId: 'd1', components: {} };
    context.restorer._restoreEntities([valid, {}]);
    expect(context.entityManager.reconstructEntity).toHaveBeenCalledWith(valid);
    expect(context.entityManager.reconstructEntity).toHaveBeenCalledTimes(1);
  });

  it('_restorePlaytime handles missing value', () => {
    context.restorer._restorePlaytime();
    expect(context.playtimeTracker.setAccumulatedPlaytime).toHaveBeenCalledWith(
      0
    );
  });
});
