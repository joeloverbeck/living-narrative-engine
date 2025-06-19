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

  it('_validateRestoreInput fails when gameState missing', () => {
    const res = context.restorer._validateRestoreInput({});
    expect(res.success).toBe(false);
  });

  it('_validateRestoreInput passes with required fields', () => {
    const res = context.restorer._validateRestoreInput({ gameState: {} });
    expect(res.success).toBe(true);
  });

  it('_clearEntities returns failure on exception', () => {
    context.entityManager.clearAll.mockImplementation(() => {
      throw new Error('x');
    });
    const res = context.restorer._clearEntities();
    expect(res.success).toBe(false);
  });

  it('_restoreEntities skips invalid data and restores valid', () => {
    const valid = { instanceId: 'e1', definitionId: 'd1', components: {} };
    const res = context.restorer._restoreEntities([valid, {}]);
    expect(context.entityManager.reconstructEntity).toHaveBeenCalledWith(valid);
    expect(context.entityManager.reconstructEntity).toHaveBeenCalledTimes(1);
    expect(res.success).toBe(true);
  });

  it('_restorePlaytime handles missing value', () => {
    const res = context.restorer._restorePlaytime();
    expect(context.playtimeTracker.setAccumulatedPlaytime).toHaveBeenCalledWith(
      0
    );
    expect(res.success).toBe(true);
  });

  it('_finalizeRestore logs completion', () => {
    const res = context.restorer._finalizeRestore();
    expect(context.logger.debug).toHaveBeenCalled();
    expect(res.success).toBe(true);
  });
});
