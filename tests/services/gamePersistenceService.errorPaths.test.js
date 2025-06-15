import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GamePersistenceService from '../../src/persistence/gamePersistenceService.js';
import ComponentCleaningService from '../../src/persistence/componentCleaningService.js';

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const makeEntity = (id, defId, components) => ({
  id,
  definitionId: defId,
  componentEntries: new Map(Object.entries(components)),
});

describe('GamePersistenceService error paths', () => {
  let logger;
  let saveLoadService;
  let entityManager;
  let dataRegistry;
  let playtimeTracker;
  let componentCleaningService;
  let metadataBuilder;
  let safeEventDispatcher;
  let service;

  beforeEach(() => {
    logger = makeLogger();
    saveLoadService = { saveManualGame: jest.fn(), loadGameData: jest.fn() };
    entityManager = {
      activeEntities: new Map(),
      clearAll: jest.fn(),
      reconstructEntity: jest.fn().mockReturnValue({}),
    };
    dataRegistry = { getAll: jest.fn().mockReturnValue([]) };
    playtimeTracker = {
      getTotalPlaytime: jest.fn().mockReturnValue(0),
      setAccumulatedPlaytime: jest.fn(),
    };
    safeEventDispatcher = { dispatch: jest.fn() };
    componentCleaningService = new ComponentCleaningService({
      logger,
      safeEventDispatcher,
    });
    metadataBuilder = {
      build: jest.fn((n, p) => ({
        saveFormatVersion: '1',
        engineVersion: 'x',
        gameTitle: n || 'Unknown Game',
        timestamp: 't',
        playtimeSeconds: p,
        saveName: '',
      })),
    };
    service = new GamePersistenceService({
      logger,
      saveLoadService,
      entityManager,
      dataRegistry,
      playtimeTracker,
      componentCleaningService,
      metadataBuilder,
    });
  });

  describe('captureCurrentGameState deepClone failure', () => {
    it('logs error when component data has circular references', () => {
      const cyc = {};
      cyc.self = cyc;
      const entity = makeEntity('e1', 'core:player', { loop: cyc });
      entityManager.activeEntities.set('e1', entity);

      expect(() => service.captureCurrentGameState('World')).toThrow(
        'Failed to deep clone object data.'
      );
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:display_error',
        expect.objectContaining({
          message: 'ComponentCleaningService.clean deepClone failed',
          details: expect.objectContaining({ componentId: 'loop' }),
        })
      );
    });
  });

  describe('restoreGameState clearing errors', () => {
    it('returns failure when entityManager.clearAll throws', async () => {
      entityManager.clearAll.mockImplementation(() => {
        throw new Error('boom');
      });
      const result = await service.restoreGameState({
        gameState: { entities: [] },
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch('Critical error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('restoreGameState playtime errors', () => {
    it('logs and resets playtime when setAccumulatedPlaytime throws', async () => {
      playtimeTracker.setAccumulatedPlaytime
        .mockImplementationOnce(() => {
          throw new Error('fail');
        })
        .mockImplementationOnce(() => {});
      const data = {
        gameState: { entities: [] },
        metadata: { playtimeSeconds: 5 },
      };
      await service.restoreGameState(data);
      expect(logger.error).toHaveBeenCalled();
      expect(playtimeTracker.setAccumulatedPlaytime).toHaveBeenCalledWith(0);
    });
  });

  describe('loadAndRestoreGame failures', () => {
    it('returns failure when loadGameData throws', async () => {
      saveLoadService.loadGameData.mockRejectedValue(new Error('load fail'));
      const result = await service.loadAndRestoreGame('slot');
      expect(result.success).toBe(false);
      expect(result.error).toMatch('Unexpected error');
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
