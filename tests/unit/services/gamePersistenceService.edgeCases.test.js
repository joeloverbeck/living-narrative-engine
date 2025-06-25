import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GamePersistenceService from '../../../src/persistence/gamePersistenceService.js';
import GameStateCaptureService from '../../../src/persistence/gameStateCaptureService.js';
import GameStateRestorer from '../../../src/persistence/gameStateRestorer.js';
import ComponentCleaningService, {
  buildDefaultComponentCleaners,
} from '../../../src/persistence/componentCleaningService.js';
import {
  NOTES_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  PERCEPTION_LOG_COMPONENT_ID,
  CURRENT_ACTOR_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { CORE_MOD_ID } from '../../../src/constants/core.js';
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

describe('GamePersistenceService edge cases', () => {
  let logger;
  let saveLoadService;
  let entityManager;
  let playtimeTracker;
  let componentCleaningService;
  let metadataBuilder;
  let safeEventDispatcher;
  let activeModsManifestBuilder;
  let manualSaveCoordinator;
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
    gameStateRestorer = new GameStateRestorer({
      logger,
      entityManager,
      playtimeTracker,
      safeEventDispatcher,
    });
    service = new GamePersistenceService({
      logger,
      saveLoadService,
      entityManager,
      playtimeTracker,
      gameStateCaptureService: captureService,
      manualSaveCoordinator,
      gameStateRestorer,
    });
  });

  describe('captureCurrentGameState cleaning', () => {
    it('cleans empty component data and uses CORE_MOD_ID fallback', () => {
      const entity = makeEntity('e1', 'core:player', {
        [NOTES_COMPONENT_ID]: { notes: [] },
        [SHORT_TERM_MEMORY_COMPONENT_ID]: { thoughts: '   ' },
        [PERCEPTION_LOG_COMPONENT_ID]: { log: [{ action: { speech: '   ' } }] },
        [CURRENT_ACTOR_COMPONENT_ID]: { active: true },
      });
      entityManager.activeEntities.set('e1', entity);
      activeModsManifestBuilder.buildManifest.mockImplementation(() => {
        logger.warn();
        return [{ modId: CORE_MOD_ID, version: 'unknown_fallback' }];
      });

      const result = captureService.captureCurrentGameState('World');
      // FIXED: Use 'overrides' instead of 'components'
      const overrides = result.gameState.entities[0].overrides;
      expect(overrides).not.toHaveProperty(NOTES_COMPONENT_ID);
      expect(overrides).not.toHaveProperty(SHORT_TERM_MEMORY_COMPONENT_ID);
      expect(overrides).not.toHaveProperty(CURRENT_ACTOR_COMPONENT_ID);
      expect(
        overrides[PERCEPTION_LOG_COMPONENT_ID].log[0].action
      ).not.toHaveProperty('speech');
      expect(result.modManifest.activeMods).toEqual([
        { modId: CORE_MOD_ID, version: 'unknown_fallback' },
      ]);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('captures entity with no core:position component without errors', () => {
      const entity = makeEntity('door1', 'blocker:door', {});
      entityManager.activeEntities.set('door1', entity);

      const result = captureService.captureCurrentGameState('World');
      const overrides = result.gameState.entities[0].overrides;
      expect(overrides).not.toHaveProperty(POSITION_COMPONENT_ID);
    });
  });

  describe('saveGame error handling', () => {
    it('returns failure when manual save rejects', async () => {
      jest
        .spyOn(captureService, 'captureCurrentGameState')
        .mockReturnValue({ metadata: {}, gameState: {}, modManifest: {} });
      manualSaveCoordinator.saveGame.mockRejectedValue(new Error('boom'));

      const res = await service.saveGame('Save1', true, 'World');
      expect(res.success).toBe(false);
      expect(res.error.message).toMatch('boom');
      expect(logger.error).toHaveBeenCalled();
    });

    it('returns failure when manual save resolves unsuccessfully', async () => {
      jest
        .spyOn(captureService, 'captureCurrentGameState')
        .mockReturnValue({ metadata: {}, gameState: {}, modManifest: {} });
      manualSaveCoordinator.saveGame.mockResolvedValue({
        success: false,
        error: 'bad',
      });

      const res = await service.saveGame('Save1', true, 'World');
      expect(res).toEqual({ success: false, error: 'bad' });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('restoreGameState failures', () => {
    it('fails when gameState is missing', async () => {
      const res = await service.restoreGameState({});
      expect(res.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
      expect(entityManager.clearAll).not.toHaveBeenCalled();
      expect(playtimeTracker.setAccumulatedPlaytime).not.toHaveBeenCalled();
    });

    it('handles reconstructEntity throwing and null return', async () => {
      const data = {
        gameState: {
          entities: [
            // FIXED: Use 'overrides' in test data
            { instanceId: 'e1', definitionId: 'core:player', overrides: {} },
          ],
        },
      };
      entityManager.reconstructEntity.mockImplementationOnce(() => {
        throw new Error('oops');
      });
      await service.restoreGameState(data);
      expect(logger.warn).toHaveBeenCalled();

      entityManager.reconstructEntity.mockReturnValueOnce(null);
      await service.restoreGameState(data);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('loadAndRestoreGame error handling', () => {
    it('returns failure when loadGameData fails', async () => {
      saveLoadService.loadGameData.mockResolvedValue({
        success: false,
        error: 'no',
      });
      const res = await service.loadAndRestoreGame('slot1');
      expect(res.success).toBe(false);
      expect(res.error.message).toBe('no');
      expect(res.error.code).toBe(PersistenceErrorCodes.UNEXPECTED_ERROR);
    });

    it('returns failure when restoreGameState fails', async () => {
      const data = { gameState: {} };
      saveLoadService.loadGameData.mockResolvedValue({ success: true, data });
      jest
        .spyOn(service, 'restoreGameState')
        .mockResolvedValue({ success: false, error: 'bad' });
      const res = await service.loadAndRestoreGame('slot1');
      expect(res.success).toBe(false);
      expect(res.error.message).toBe('bad');
      expect(res.error.code).toBe(PersistenceErrorCodes.UNEXPECTED_ERROR);
    });
  });
});
