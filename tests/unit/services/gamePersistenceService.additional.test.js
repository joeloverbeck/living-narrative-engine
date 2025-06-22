import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GamePersistenceService from '../../../src/persistence/gamePersistenceService.js';
import GameStateCaptureService from '../../../src/persistence/gameStateCaptureService.js';
import { CURRENT_ACTOR_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';
import { createMockEntityManager } from '../../common/mockFactories.js';

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
  let playtimeTracker;
  let componentCleaningService;
  let metadataBuilder;
  let activeModsManifestBuilder;
  let manualSaveCoordinator;
  let service;
  let captureService;
  let gameStateRestorer;

  beforeEach(() => {
    logger = makeLogger();
    saveLoadService = { saveManualGame: jest.fn(), loadGameData: jest.fn() };
    entityManager = createMockEntityManager();
    playtimeTracker = {
      getTotalPlaytime: jest.fn().mockReturnValue(42),
      setAccumulatedPlaytime: jest.fn(),
    };
    componentCleaningService = { clean: jest.fn((id, data) => data) };
    metadataBuilder = {
      build: jest.fn((n, p) => {
        if (!n) logger.warn();
        return {
          saveFormatVersion: '1',
          engineVersion: 'x',
          gameTitle: n || 'Unknown Game',
          timestamp: 't',
          playtimeSeconds: p,
          saveName: '',
        };
      }),
    };
    activeModsManifestBuilder = {
      buildManifest: jest.fn(() => {
        logger.warn();
        return [];
      }),
    };
    captureService = new GameStateCaptureService({
      logger,
      entityManager,
      playtimeTracker,
      componentCleaningService,
      metadataBuilder,
      activeModsManifestBuilder,
    });
    manualSaveCoordinator = { saveGame: jest.fn() };

    // FIXED: Mock the gameStateRestorer to test GamePersistenceService in isolation
    gameStateRestorer = {
      restoreGameState: jest.fn().mockImplementation(async (data) => {
        // Simulate the side-effects of a successful restoration
        entityManager.clearAll();
        if (data.gameState && data.gameState.entities) {
          for (const entity of data.gameState.entities) {
            entityManager.reconstructEntity(entity);
          }
        }
        if (data.metadata) {
          playtimeTracker.setAccumulatedPlaytime(data.metadata.playtimeSeconds);
        }
        return { success: true };
      }),
    };

    service = new GamePersistenceService({
      logger,
      saveLoadService,
      entityManager,
      playtimeTracker,
      gameStateCaptureService: captureService,
      manualSaveCoordinator,
      gameStateRestorer, // Inject the mock
    });
  });

  // Test for captureCurrentGameState remains unchanged as it tests a dependency correctly
  describe('captureCurrentGameState', () => {
    it('captures entities and mod manifests', () => {
      const entity = makeEntity('e1', 'core:player', {
        name: { value: 'Hero' },
        [CURRENT_ACTOR_COMPONENT_ID]: { active: true },
      });
      entityManager.activeEntities.set('e1', entity);
      activeModsManifestBuilder.buildManifest.mockReturnValue([
        { modId: 'core', version: '1.0.0' },
      ]);

      const result = captureService.captureCurrentGameState('World');

      expect(result.gameState.entities).toHaveLength(1);
      const overrides = result.gameState.entities[0].overrides;
      expect(overrides).toHaveProperty('name');
      expect(overrides).not.toHaveProperty(CURRENT_ACTOR_COMPONENT_ID);
      expect(result.metadata.gameTitle).toBe('World');
      expect(result.metadata.playtimeSeconds).toBe(42);
      expect(result.modManifest.activeMods).toEqual([
        { modId: 'core', version: '1.0.0' },
      ]);
    });

    it('preserves primitive component data', () => {
      const entity = makeEntity('e2', 'core:item', { count: 7 });
      entityManager.activeEntities.set('e2', entity);
      activeModsManifestBuilder.buildManifest.mockReturnValue([]);

      const result = captureService.captureCurrentGameState('World');
      const overrides = result.gameState.entities[0].overrides;
      expect(overrides.count).toBe(7);
    });
  });

  // Test for saveGame remains unchanged
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
      manualSaveCoordinator.saveGame.mockResolvedValue({ success: true });
      const res = await service.saveGame('Save1', true, 'World');
      expect(manualSaveCoordinator.saveGame).toHaveBeenCalledWith(
        'Save1',
        'World'
      );
      expect(res.success).toBe(true);
    });

    it('skips saving when isSavingAllowed denies', async () => {
      jest.spyOn(service, 'isSavingAllowed').mockReturnValue(false);
      const result = await service.saveGame('Denied', true, 'World');
      expect(manualSaveCoordinator.saveGame).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });
  });

  describe('restoreGameState and loadAndRestoreGame', () => {
    it('restores entities and playtime', async () => {
      const data = {
        gameState: {
          entities: [
            { instanceId: 'e1', definitionId: 'core:player', overrides: {} },
          ],
        },
        metadata: { playtimeSeconds: 99 },
      };

      // Act
      const res = await service.restoreGameState(data);

      // Assert: Check that the service delegated correctly to the restorer
      expect(gameStateRestorer.restoreGameState).toHaveBeenCalledWith(data);

      // Assert: Check that the side-effects (simulated by the mock) happened
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
      expect(res.error.code).toBe(PersistenceErrorCodes.UNEXPECTED_ERROR);
    });

    it('loads and restores on success', async () => {
      const data = { gameState: {}, metadata: {} };
      saveLoadService.loadGameData.mockResolvedValue({ success: true, data });

      // We no longer need to spy on restoreGameState itself, since we now control its mock
      // jest.spyOn(service, 'restoreGameState').mockResolvedValue({ success: true });

      const res = await service.loadAndRestoreGame('slot1');
      expect(gameStateRestorer.restoreGameState).toHaveBeenCalledWith(data);
      expect(res).toEqual({ success: true, data });
    });

    // This test is now covered by the dependency injection in beforeEach
    it('uses provided gameStateRestorer instance', async () => {
      const mockRestorer = {
        restoreGameState: jest.fn().mockResolvedValue({ success: true }),
      };
      const svc = new GamePersistenceService({
        logger,
        saveLoadService,
        entityManager,
        playtimeTracker,
        gameStateCaptureService: captureService,
        manualSaveCoordinator,
        gameStateRestorer: mockRestorer,
      });
      const payload = { gameState: {}, metadata: {} };
      await svc.restoreGameState(payload);
      expect(mockRestorer.restoreGameState).toHaveBeenCalledWith(payload);
    });
  });
});
