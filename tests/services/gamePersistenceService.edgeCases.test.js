import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GamePersistenceService from '../../src/persistence/gamePersistenceService.js';
import GameStateCaptureService from '../../src/persistence/gameStateCaptureService.js';
import ComponentCleaningService from '../../src/persistence/componentCleaningService.js';
import {
  NOTES_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  PERCEPTION_LOG_COMPONENT_ID,
  CURRENT_ACTOR_COMPONENT_ID,
} from '../../src/constants/componentIds.js';
import { CORE_MOD_ID } from '../../src/constants/core.js';

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
      build: jest.fn(() => {
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
    service = new GamePersistenceService({
      logger,
      saveLoadService,
      entityManager,
      playtimeTracker,
      gameStateCaptureService: captureService,
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
      activeModsManifestBuilder.build.mockImplementation(() => {
        logger.warn();
        return [{ modId: CORE_MOD_ID, version: 'unknown_fallback' }];
      });

      const result = captureService.captureCurrentGameState('World');
      const comps = result.gameState.entities[0].components;
      expect(comps).not.toHaveProperty(NOTES_COMPONENT_ID);
      expect(comps).not.toHaveProperty(SHORT_TERM_MEMORY_COMPONENT_ID);
      expect(comps).not.toHaveProperty(CURRENT_ACTOR_COMPONENT_ID);
      expect(
        comps[PERCEPTION_LOG_COMPONENT_ID].log[0].action
      ).not.toHaveProperty('speech');
      expect(result.modManifest.activeMods).toEqual([
        { modId: CORE_MOD_ID, version: 'unknown_fallback' },
      ]);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('saveGame error handling', () => {
    it('returns failure when saveManualGame rejects', async () => {
      jest
        .spyOn(captureService, 'captureCurrentGameState')
        .mockReturnValue({ metadata: {}, gameState: {}, modManifest: {} });
      saveLoadService.saveManualGame.mockRejectedValue(new Error('boom'));

      const res = await service.saveGame('Save1', true, 'World');
      expect(res.success).toBe(false);
      expect(res.error.message).toMatch('boom');
      expect(logger.error).toHaveBeenCalled();
    });

    it('returns failure when saveManualGame resolves unsuccessfully', async () => {
      jest
        .spyOn(captureService, 'captureCurrentGameState')
        .mockReturnValue({ metadata: {}, gameState: {}, modManifest: {} });
      saveLoadService.saveManualGame.mockResolvedValue({
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
            { instanceId: 'e1', definitionId: 'core:player', components: {} },
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
    });
  });
});
