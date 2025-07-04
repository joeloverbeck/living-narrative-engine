import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GamePersistenceService from '../../../src/persistence/gamePersistenceService.js';
import GameStateCaptureService from '../../../src/persistence/gameStateCaptureService.js';
import GameStateRestorer from '../../../src/persistence/gameStateRestorer.js';
import ComponentCleaningService, {
  buildDefaultComponentCleaners,
} from '../../../src/persistence/componentCleaningService.js';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';
import { createMockEntityManager } from '../../common/mockFactories.js';

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
  let playtimeTracker;
  let componentCleaningService;
  let metadataBuilder;
  let activeModsManifestBuilder;
  let safeEventDispatcher;
  let gameStateRestorer;
  let service;
  let captureService;

  beforeEach(() => {
    logger = makeLogger();
    saveLoadService = { saveManualGame: jest.fn(), loadGameData: jest.fn() };
    entityManager = createMockEntityManager();
    playtimeTracker = {
      getTotalPlaytime: jest.fn().mockReturnValue(0),
      setAccumulatedPlaytime: jest.fn(),
    };
    safeEventDispatcher = { dispatch: jest.fn() };
    componentCleaningService = new ComponentCleaningService({
      logger,
      safeEventDispatcher,
      defaultCleaners: buildDefaultComponentCleaners(logger),
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
    activeModsManifestBuilder = {
      buildManifest: jest.fn().mockReturnValue([]),
    };
    captureService = new GameStateCaptureService({
      logger,
      entityManager,
      playtimeTracker,
      componentCleaningService,
      metadataBuilder,
      activeModsManifestBuilder,
    });
    gameStateRestorer = new GameStateRestorer({
      logger,
      entityManager,
      playtimeTracker,
    });
    service = new GamePersistenceService({
      logger,
      saveLoadService,
      entityManager,
      playtimeTracker,
      gameStateCaptureService: captureService,
      manualSaveCoordinator: { saveGame: jest.fn() },
      gameStateRestorer,
    });
  });

  describe('captureCurrentGameState deepClone failure', () => {
    it('logs error when component data has circular references', () => {
      const cyc = {};
      cyc.self = cyc;
      const entity = makeEntity('e1', 'core:player', { loop: cyc });
      entityManager.activeEntities.set('e1', entity);

      expect(() => captureService.captureCurrentGameState('World')).toThrow(
        'Failed to deep clone object data.'
      );
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
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
      expect(result.error.message).toMatch('Critical error');
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

    it('resets playtime when metadata is missing', async () => {
      const data = {
        gameState: { entities: [] },
        metadata: {},
      };
      await service.restoreGameState(data);
      expect(playtimeTracker.setAccumulatedPlaytime).toHaveBeenCalledWith(0);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('loadAndRestoreGame failures', () => {
    it('returns failure when loadGameData throws', async () => {
      saveLoadService.loadGameData.mockRejectedValue(new Error('load fail'));
      const result = await service.loadAndRestoreGame('slot');
      expect(result.success).toBe(false);
      expect(result.error.message).toBe('load fail');
      expect(result.error.code).toBe(PersistenceErrorCodes.UNEXPECTED_ERROR);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
