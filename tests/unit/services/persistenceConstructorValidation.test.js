import { describe, it, expect, jest } from '@jest/globals';
import GameStateCaptureService from '../../../src/persistence/gameStateCaptureService.js';
import ManualSaveCoordinator from '../../../src/persistence/manualSaveCoordinator.js';
import SaveLoadService from '../../../src/persistence/saveLoadService.js';
import SaveFileRepository from '../../../src/persistence/saveFileRepository.js';
import GameStateRestorer from '../../../src/persistence/gameStateRestorer.js';
import GamePersistenceService from '../../../src/persistence/gamePersistenceService.js';
import { BaseService } from '../../../src/utils/serviceBase.js';
import {
  createMockLogger,
  createMockSaveValidationService,
} from '../testUtils.js';

/**
 * Minimal serializer stub for SaveLoadService and SaveFileRepository.
 */
const serializer = {};

describe('Persistence service constructor validation', () => {
  it('GameStateCaptureService validates required methods', () => {
    const logger = createMockLogger();
    const entityManager = { activeEntities: new Map() };
    const playtimeTracker = {}; // missing getTotalPlaytime
    const componentCleaningService = { clean: jest.fn() };
    const metadataBuilder = { build: jest.fn() };
    const activeModsManifestBuilder = { buildManifest: jest.fn() };
    expect(
      () =>
        new GameStateCaptureService({
          logger,
          entityManager,
          playtimeTracker,
          componentCleaningService,
          metadataBuilder,
          activeModsManifestBuilder,
        })
    ).toThrow();
  });

  it('ManualSaveCoordinator validates dependencies', () => {
    const logger = createMockLogger();
    const gameStateCaptureService = {}; // missing captureCurrentGameState
    const saveLoadService = { saveManualGame: jest.fn() };
    expect(
      () =>
        new ManualSaveCoordinator({
          logger,
          gameStateCaptureService,
          saveLoadService,
        })
    ).toThrow();
  });

  it('SaveLoadService validates repository methods', () => {
    const logger = createMockLogger();
    const saveFileRepository = {}; // missing required methods
    const validationService = createMockSaveValidationService();
    expect(
      () =>
        new SaveLoadService({
          logger,
          saveFileRepository,
          gameStateSerializer: serializer,
          saveValidationService: validationService,
        })
    ).toThrow();
  });

  it('SaveFileRepository validates storage provider', () => {
    const logger = createMockLogger();
    const storageProvider = {}; // missing required methods
    const parser = { parseManualSaveFile: jest.fn() };
    expect(
      () =>
        new SaveFileRepository({
          logger,
          storageProvider,
          parser,
        })
    ).toThrow();
  });

  it('GameStateRestorer extends BaseService', () => {
    const restorer = new GameStateRestorer({
      logger: createMockLogger(),
      entityManager: { clearAll: jest.fn(), reconstructEntity: jest.fn() },
      playtimeTracker: { setAccumulatedPlaytime: jest.fn() },
    });
    expect(restorer).toBeInstanceOf(BaseService);
  });

  it('GamePersistenceService extends BaseService', () => {
    const service = new GamePersistenceService({
      logger: createMockLogger(),
      saveLoadService: { saveManualGame: jest.fn(), loadGameData: jest.fn() },
      entityManager: { clearAll: jest.fn(), reconstructEntity: jest.fn() },
      playtimeTracker: {
        getTotalPlaytime: jest.fn(),
        setAccumulatedPlaytime: jest.fn(),
      },
      gameStateCaptureService: { captureCurrentGameState: jest.fn() },
      manualSaveCoordinator: { saveGame: jest.fn() },
      gameStateRestorer: { restoreGameState: jest.fn() },
    });
    expect(service).toBeInstanceOf(BaseService);
  });
});
