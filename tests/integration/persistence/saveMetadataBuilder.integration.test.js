// tests/integration/persistence/saveMetadataBuilder.integration.test.js
import {
  describe,
  beforeAll,
  beforeEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { webcrypto } from 'crypto';
import SaveLoadService from '../../../src/persistence/saveLoadService.js';
import SaveFileRepository from '../../../src/persistence/saveFileRepository.js';
import SaveFileParser from '../../../src/persistence/saveFileParser.js';
import GameStateSerializer from '../../../src/persistence/gameStateSerializer.js';
import ChecksumService from '../../../src/persistence/checksumService.js';
import GamePersistenceService from '../../../src/persistence/gamePersistenceService.js';
import GameStateCaptureService from '../../../src/persistence/gameStateCaptureService.js';
import ManualSaveCoordinator from '../../../src/persistence/manualSaveCoordinator.js';
import GameStateRestorer from '../../../src/persistence/gameStateRestorer.js';
import ComponentCleaningService, {
  buildDefaultComponentCleaners,
} from '../../../src/persistence/componentCleaningService.js';
import ActiveModsManifestBuilder from '../../../src/persistence/activeModsManifestBuilder.js';
import SaveMetadataBuilder from '../../../src/persistence/saveMetadataBuilder.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import PlaytimeTracker from '../../../src/engine/playtimeTracker.js';
import receptionistDef from '../../../data/mods/isekai/entities/definitions/receptionist.character.json';
import { createMockSaveValidationService } from '../../unit/testUtils.js';
import { createMemoryStorageProvider } from '../../common/mockFactories/index.js';
import { ENGINE_VERSION } from '../../../src/engine/engineVersion.js';

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

const makeEntity = (id, def) => ({
  id,
  definitionId: def.id,
  componentEntries: new Map(Object.entries(def.components)),
});

describe('SaveMetadataBuilder integration', () => {
  const fixedTimestamp = '2024-02-03T04:05:06.789Z';
  let logger;
  let storageProvider;
  let saveLoadService;
  let persistence;
  let entityManager;
  let playtimeTracker;
  let activeModsManifestBuilder;
  let metadataBuilder;
  let safeEventDispatcher;

  beforeEach(() => {
    logger = makeLogger();
    storageProvider = createMemoryStorageProvider();
    const saveValidationService = createMockSaveValidationService();
    const checksumService = new ChecksumService({ logger, crypto: webcrypto });
    const serializer = new GameStateSerializer({ logger, checksumService });
    const parser = new SaveFileParser({
      logger,
      storageProvider,
      serializer,
    });
    const saveFileRepository = new SaveFileRepository({
      logger,
      storageProvider,
      parser,
    });
    saveLoadService = new SaveLoadService({
      logger,
      saveFileRepository,
      gameStateSerializer: serializer,
      saveValidationService,
    });

    const entity = makeEntity('entity-1', receptionistDef);
    entityManager = {
      activeEntities: new Map([[entity.id, entity]]),
      clearAll: jest.fn(() => {
        entityManager.activeEntities.clear();
      }),
      reconstructEntity: jest.fn((data) => {
        const restored = makeEntity(data.instanceId, {
          id: data.definitionId,
          components: data.overrides || {},
        });
        entityManager.activeEntities.set(restored.id, restored);
        return restored;
      }),
    };

    safeEventDispatcher = { dispatch: jest.fn() };
    playtimeTracker = new PlaytimeTracker({
      logger,
      safeEventDispatcher,
    });
    playtimeTracker.setAccumulatedPlaytime(321);

    const componentCleaningService = new ComponentCleaningService({
      logger,
      safeEventDispatcher,
      defaultCleaners: buildDefaultComponentCleaners(logger),
    });

    const dataRegistry = new InMemoryDataRegistry({ logger });
    dataRegistry.store('mod_manifests', 'core', {
      id: 'core',
      version: '9.9.9',
      modId: 'core',
    });
    dataRegistry.store('mod_manifests', 'expansion', {
      id: 'expansion',
      version: '2.0.0',
      modId: 'expansion',
    });
    activeModsManifestBuilder = new ActiveModsManifestBuilder({
      logger,
      dataRegistry,
    });

    metadataBuilder = new SaveMetadataBuilder({
      logger,
      timeProvider: () => new Date(fixedTimestamp),
    });

    const captureService = new GameStateCaptureService({
      logger,
      entityManager,
      playtimeTracker,
      componentCleaningService,
      metadataBuilder,
      activeModsManifestBuilder,
    });

    const gameStateRestorer = new GameStateRestorer({
      logger,
      entityManager,
      playtimeTracker,
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
      gameStateRestorer,
    });
  });

  test('captures metadata with provided world name', async () => {
    const saveResult = await persistence.saveGame(
      'MetaIntegration',
      true,
      'IntegrationWorld'
    );

    expect(saveResult.success).toBe(true);
    expect(saveResult.filePath).toBeDefined();

    const loadResult = await saveLoadService.loadGameData(saveResult.filePath);
    expect(loadResult.success).toBe(true);
    const metadata = loadResult.data?.metadata;
    expect(metadata).toBeDefined();
    expect(metadata).toMatchObject({
      gameTitle: 'IntegrationWorld',
      playtimeSeconds: 321,
      saveFormatVersion: '1.0.0',
      engineVersion: ENGINE_VERSION,
      timestamp: fixedTimestamp,
    });
    expect(loadResult.data?.modManifest.activeMods).toEqual([
      { modId: 'core', version: '9.9.9' },
      { modId: 'expansion', version: '2.0.0' },
    ]);
    expect(
      logger.warn.mock.calls.find((call) =>
        String(call[0]).includes('No worldName provided')
      )
    ).toBeUndefined();
  });

  test('falls back to Unknown Game when world name missing', async () => {
    const saveResult = await persistence.saveGame(
      'MetaIntegrationFallback',
      true,
      undefined
    );

    expect(saveResult.success).toBe(true);

    const loadResult = await saveLoadService.loadGameData(saveResult.filePath);
    expect(loadResult.success).toBe(true);
    const metadata = loadResult.data?.metadata;
    expect(metadata).toBeDefined();
    expect(metadata.gameTitle).toBe('Unknown Game');
    expect(metadata.playtimeSeconds).toBe(321);
    expect(metadata.engineVersion).toBe(ENGINE_VERSION);
    expect(metadata.timestamp).toBe(fixedTimestamp);
    expect(logger.warn).toHaveBeenCalledWith(
      "SaveMetadataBuilder.build: No worldName provided. Defaulting to 'Unknown Game'."
    );
  });
});
