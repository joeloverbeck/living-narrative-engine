import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GamePersistenceService from '../../src/persistence/gamePersistenceService.js';
import GameStateCaptureService from '../../src/persistence/gameStateCaptureService.js';
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
  let componentCleaningService;
  let metadataBuilder;
  let service;
  let captureService;

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
    componentCleaningService = { clean: jest.fn((id, data) => data) };
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
    captureService = new GameStateCaptureService({
      logger,
      entityManager,
      dataRegistry,
      playtimeTracker,
      componentCleaningService,
      metadataBuilder,
    });
    service = new GamePersistenceService({
      logger,
      saveLoadService,
      entityManager,
      playtimeTracker,
      gameStateCaptureService: captureService,
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

      const result = captureService.captureCurrentGameState('World');

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

    it('captures core mod version when present', () => {
      dataRegistry.getAll.mockReturnValue([{ id: 'core', version: '1.2.3' }]);
      const result = captureService.captureCurrentGameState('World');
      expect(result.modManifest.activeMods).toEqual([
        { modId: 'core', version: '1.2.3' },
      ]);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('warns and defaults title when world name missing', () => {
      dataRegistry.getAll.mockReturnValue([]);
      const result = captureService.captureCurrentGameState();
      expect(logger.warn).toHaveBeenCalled();
      expect(result.metadata.gameTitle).toBe('Unknown Game');
    });

    it('falls back to unknown version when manifest undefined', () => {
      dataRegistry.getAll.mockReturnValue(undefined);
      const result = captureService.captureCurrentGameState('World');
      expect(result.modManifest.activeMods).toEqual([
        { modId: 'core', version: 'unknown_fallback' },
      ]);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('preserves primitive component data', () => {
      const entity = makeEntity('e2', 'core:item', { count: 7 });
      entityManager.activeEntities.set('e2', entity);
      dataRegistry.getAll.mockReturnValue([]);

      const result = captureService.captureCurrentGameState('World');
      const components = result.gameState.entities[0].components;
      expect(components.count).toBe(7);
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
      jest
        .spyOn(captureService, 'captureCurrentGameState')
        .mockReturnValue(state);
      saveLoadService.saveManualGame.mockResolvedValue({ success: true });
      const res = await service.saveGame('Save1', true, 'World');
      expect(captureService.captureCurrentGameState).toHaveBeenCalledWith(
        'World'
      );
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
      expect(res.error.message).toBe('no');
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
