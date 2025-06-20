import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GamePersistenceService from '../../../src/persistence/gamePersistenceService.js';
import GameStateRestorer from '../../../src/persistence/gameStateRestorer.js';

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

  it('restoreGameState fails validation when gameState missing', async () => {
    const res = await context.restorer.restoreGameState({});
    expect(res.success).toBe(false);
  });

  it('restoreGameState passes with required fields', async () => {
    const res = await context.restorer.restoreGameState({
      gameState: { entities: [] },
    });
    expect(res.success).toBe(true);
  });

  it('restoreGameState returns failure when entity clearing throws', async () => {
    context.entityManager.clearAll.mockImplementation(() => {
      throw new Error('x');
    });
    const res = await context.restorer.restoreGameState({
      gameState: { entities: [] },
    });
    expect(res.success).toBe(false);
  });

  it('restoreGameState skips invalid entity data and restores valid entities', async () => {
    const valid = { instanceId: 'e1', definitionId: 'd1', components: {} };
    const res = await context.restorer.restoreGameState({
      gameState: { entities: [valid, {}] },
    });
    expect(context.entityManager.reconstructEntity).toHaveBeenCalledWith({
      instanceId: 'e1',
      definitionId: 'd1',
      overrides: {},
    });
    expect(context.entityManager.reconstructEntity).toHaveBeenCalledTimes(1);
    expect(res.success).toBe(true);
  });

  it('restoreGameState handles missing playtime metadata', async () => {
    const res = await context.restorer.restoreGameState({
      gameState: { entities: [] },
    });
    expect(context.playtimeTracker.setAccumulatedPlaytime).toHaveBeenCalledWith(
      0
    );
    expect(res.success).toBe(true);
  });

  it('restoreGameState logs completion', async () => {
    const res = await context.restorer.restoreGameState({
      gameState: { entities: [] },
    });
    expect(context.logger.debug).toHaveBeenCalled();
    expect(res.success).toBe(true);
  });
});
