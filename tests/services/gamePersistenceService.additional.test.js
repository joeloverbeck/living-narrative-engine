import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GamePersistenceService from '../../src/persistence/gamePersistenceService.js';
import { CURRENT_ACTOR_COMPONENT_ID } from '../../src/constants/componentIds.js';

// Helpers to create minimal mocks
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

describe('GamePersistenceService additional coverage', () => {
  let logger;
  let saveLoadService;
  let entityManager;
  let dataRegistry;
  let playtimeTracker;
  let container;
  let service;

  beforeEach(() => {
    logger = makeLogger();
    saveLoadService = { saveManualGame: jest.fn(), loadGameData: jest.fn() };
    entityManager = {
      activeEntities: new Map(),
      clearAll: jest.fn(),
      reconstructEntity: jest.fn().mockReturnValue({}),
    };
    dataRegistry = { getAll: jest.fn() };
    playtimeTracker = {
      getTotalPlaytime: jest.fn().mockReturnValue(42),
      setAccumulatedPlaytime: jest.fn(),
    };
    container = {};
    service = new GamePersistenceService({
      logger,
      saveLoadService,
      entityManager,
      dataRegistry,
      playtimeTracker,
      container,
    });
  });

  describe('captureCurrentGameState', () => {
    it('captures entities and mod manifests', () => {
      const entity = makeEntity('e1', 'core:player', {
        name: { value: 'Hero' },
        [CURRENT_ACTOR_COMPONENT_ID]: { active: true },
      });
      entityManager.activeEntities.set('e1', entity);
      dataRegistry.getAll.mockReturnValue([{ id: 'core', version: '1.0.0' }]);

      const result = service.captureCurrentGameState('World');

      expect(result.gameState.entities).toHaveLength(1);
      const components = result.gameState.entities[0].components;
      expect(components).toHaveProperty('name');
      expect(components).not.toHaveProperty(CURRENT_ACTOR_COMPONENT_ID);
      expect(result.metadata.gameTitle).toBe('World');
      expect(result.metadata.playtimeSeconds).toBe(42);
      expect(result.modManifest.activeMods).toEqual([
        { modId: 'core', version: '1.0.0' },
      ]);
    });

    it('warns and defaults title when world name missing', () => {
      dataRegistry.getAll.mockReturnValue([]);
      const result = service.captureCurrentGameState();
      expect(logger.warn).toHaveBeenCalled();
      expect(result.metadata.gameTitle).toBe('Unknown Game');
    });
  });

  describe('saveGame', () => {
    it('skips saving when engine not initialized', async () => {
      const res = await service.saveGame('Save1', false, 'World');
      expect(saveLoadService.saveManualGame).not.toHaveBeenCalled();
      expect(res.success).toBe(false);
    });

    it('saves using SaveLoadService when allowed', async () => {
      const state = { metadata: {}, gameState: {}, modManifest: {} };
      jest.spyOn(service, 'captureCurrentGameState').mockReturnValue(state);
      saveLoadService.saveManualGame.mockResolvedValue({ success: true });
      const res = await service.saveGame('Save1', true, 'World');
      expect(service.captureCurrentGameState).toHaveBeenCalledWith('World');
      expect(saveLoadService.saveManualGame).toHaveBeenCalledWith(
        'Save1',
        state
      );
      expect(res.success).toBe(true);
    });
  });

  describe('restoreGameState and loadAndRestoreGame', () => {
    it('restores entities and playtime', async () => {
      const data = {
        gameState: {
          entities: [
            { instanceId: 'e1', definitionId: 'core:player', components: {} },
          ],
        },
        metadata: { playtimeSeconds: 99 },
      };
      const res = await service.restoreGameState(data);
      expect(entityManager.clearAll).toHaveBeenCalled();
      expect(entityManager.reconstructEntity).toHaveBeenCalledWith(
        data.gameState.entities[0]
      );
      expect(playtimeTracker.setAccumulatedPlaytime).toHaveBeenCalledWith(99);
      expect(res.success).toBe(true);
    });

    it('returns error when load fails', async () => {
      saveLoadService.loadGameData.mockResolvedValue({
        success: false,
        error: 'no',
      });
      const res = await service.loadAndRestoreGame('slot1');
      expect(res.success).toBe(false);
      expect(res.error).toBe('no');
    });

    it('loads and restores on success', async () => {
      const data = { gameState: {}, metadata: {} };
      saveLoadService.loadGameData.mockResolvedValue({ success: true, data });
      jest
        .spyOn(service, 'restoreGameState')
        .mockResolvedValue({ success: true });
      const res = await service.loadAndRestoreGame('slot1');
      expect(service.restoreGameState).toHaveBeenCalledWith(data);
      expect(res).toEqual({ success: true, data });
    });
  });
});
