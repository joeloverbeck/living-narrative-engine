import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import SaveLoadService from '../../src/persistence/saveLoadService.js';
import SaveFileRepository from '../../src/persistence/saveFileRepository.js';
import GameStateSerializer from '../../src/persistence/gameStateSerializer.js';
import GamePersistenceService from '../../src/persistence/gamePersistenceService.js';
import GameStateCaptureService from '../../src/persistence/gameStateCaptureService.js';
import ManualSaveCoordinator from '../../src/persistence/manualSaveCoordinator.js';
import ComponentCleaningService, {
  buildDefaultComponentCleaners,
} from '../../src/persistence/componentCleaningService.js';
import receptionistDef from '../../data/mods/isekai/entities/definitions/receptionist.character.json';
import { webcrypto } from 'crypto';
import { createMockSaveValidationService } from '../testUtils.js';

beforeAll(() => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
  }
  Object.defineProperty(global, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
});

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Creates an in-memory storage provider implementation for testing.
 *
 * @returns {import('../../src/interfaces/IStorageProvider.js').IStorageProvider} In-memory provider
 */
const createMemoryStorageProvider = () => {
  const files = {};
  return {
    writeFileAtomically: jest.fn(async (path, data) => {
      files[path] = data;
      return { success: true };
    }),
    readFile: jest.fn(async (path) => files[path]),
    listFiles: jest.fn(async () => Object.keys(files)),
    deleteFile: jest.fn(async (path) => {
      delete files[path];
      return { success: true };
    }),
    fileExists: jest.fn(async (path) => path in files),
    ensureDirectoryExists: jest.fn(async () => {}),
  };
};

const makeEntity = (id, def) => ({
  id,
  definitionId: def.id,
  componentEntries: new Map(Object.entries(def.components)),
});

describe('Persistence round-trip', () => {
  let logger;
  let storageProvider;
  let saveLoadService;
  let entityManager;
  let playtimeTracker;
  let componentCleaningService;
  let metadataBuilder;
  let safeEventDispatcher;
  let persistence;
  let entity;
  const saveName = 'RoundTripTest';

  beforeEach(() => {
    logger = makeLogger();
    storageProvider = createMemoryStorageProvider();
    const saveValidationService = createMockSaveValidationService();
    const serializer = new GameStateSerializer({ logger, crypto: webcrypto });
    const saveFileRepository = new SaveFileRepository({
      logger,
      storageProvider,
      serializer,
    });
    saveLoadService = new SaveLoadService({
      logger,
      saveFileRepository,
      gameStateSerializer: serializer,
      saveValidationService,
    });

    entity = makeEntity('e1', receptionistDef);

    entityManager = {
      activeEntities: new Map([[entity.id, entity]]),
      clearAll: jest.fn(() => {
        entityManager.activeEntities.clear();
      }),
      reconstructEntity: jest.fn((data) => {
        const restored = makeEntity(data.instanceId, {
          id: data.definitionId,
          components: data.components,
        });
        entityManager.activeEntities.set(restored.id, restored);
        return restored;
      }),
    };

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

    const activeModsManifestBuilder = {
      build: jest.fn().mockReturnValue([{ modId: 'core', version: '1.0.0' }]),
    };
    const captureService = new GameStateCaptureService({
      logger,
      entityManager,
      playtimeTracker,
      componentCleaningService,
      metadataBuilder,
      activeModsManifestBuilder,
    });
    const manualSaveCoordinator = new ManualSaveCoordinator({
      logger,
      gameStateCaptureService: captureService,
      saveLoadService,
    });
    persistence = new GamePersistenceService({
      logger,
      saveLoadService,
      entityManager,
      playtimeTracker,
      gameStateCaptureService: captureService,
      manualSaveCoordinator,
    });
  });

  test('entity with many components survives save and load', async () => {
    const saveResult = await persistence.saveGame(saveName, true, 'TestWorld');
    expect(saveResult.success).toBe(true);

    // ensure the file was written
    const filePath = `saves/manual_saves/manual_save_${saveName}.sav`;
    expect(storageProvider.writeFileAtomically).toHaveBeenCalledWith(
      filePath,
      expect.any(Uint8Array)
    );

    // wipe entities before load
    entityManager.activeEntities.clear();

    const loadResult = await persistence.loadAndRestoreGame(filePath);
    expect(loadResult.success).toBe(true);

    const restored = entityManager.activeEntities.get('e1');
    expect(restored).toBeDefined();
    expect(restored.definitionId).toBe(entity.definitionId);
    const originalComponents = Object.fromEntries(entity.componentEntries);
    const expectedComponents = Object.fromEntries(
      Object.entries(originalComponents).filter(([key, value]) => {
        if (key === 'core:current_actor') return false;
        if (value === null || typeof value !== 'object') return true;
        return Object.keys(value).length > 0;
      })
    );
    const restoredComponents = Object.fromEntries(restored.componentEntries);
    expect(restoredComponents).toEqual(expectedComponents);

    expect(loadResult.data.metadata.gameTitle).toBe('TestWorld');
    expect(loadResult.data.metadata.playtimeSeconds).toBe(0);
    expect(loadResult.data.modManifest.activeMods).toEqual([
      { modId: 'core', version: '1.0.0' },
    ]);
  });
});
