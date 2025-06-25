import {
  describe,
  beforeEach,
  test,
  expect,
  jest,
  beforeAll,
} from '@jest/globals';
import SaveLoadService from '../../src/persistence/saveLoadService.js';
import SaveFileRepository from '../../src/persistence/saveFileRepository.js';
import SaveFileParser from '../../src/persistence/saveFileParser.js';
import GameStateSerializer from '../../src/persistence/gameStateSerializer.js';
import GamePersistenceService from '../../src/persistence/gamePersistenceService.js';
import GameStateCaptureService from '../../src/persistence/gameStateCaptureService.js';
import ManualSaveCoordinator from '../../src/persistence/manualSaveCoordinator.js';
import GameStateRestorer from '../../src/persistence/gameStateRestorer.js';
import ComponentCleaningService, {
  buildDefaultComponentCleaners,
} from '../../src/persistence/componentCleaningService.js';
import { webcrypto } from 'crypto';
import { createMockSaveValidationService } from '../unit/testUtils.js';
import { createMemoryStorageProvider } from '../common/mockFactories';

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

describe('Integration: state fidelity after save/load', () => {
  let logger;
  let storageProvider;
  let saveLoadService;
  let entityManager;
  let playtimeTracker;
  let componentCleaningService;
  let metadataBuilder;
  let safeEventDispatcher;
  let gameStateRestorer;
  let persistence;
  const saveName = 'StateFidelityTest';
  /** @type {ReturnType<typeof makeEntity>[]} */
  let originalEntities;

  beforeEach(() => {
    logger = makeLogger();
    storageProvider = createMemoryStorageProvider();
    const saveValidationService = createMockSaveValidationService();
    const serializer = new GameStateSerializer({ logger, crypto: webcrypto });
    const parser = new SaveFileParser({ logger, storageProvider, serializer });
    const saveFileRepository = new SaveFileRepository({
      logger,
      storageProvider,
      serializer,
      parser,
    });
    saveLoadService = new SaveLoadService({
      logger,
      saveFileRepository,
      gameStateSerializer: serializer,
      saveValidationService,
    });

    const door = makeEntity('door1', {
      id: 'door-def',
      components: { 'core:openable': { isOpen: true } },
    });
    const room1 = makeEntity('room1', {
      id: 'room-def1',
      components: {
        'core:name': { text: 'Room1' },
        'core:exits': [
          { direction: 'north', target: 'room2', blocker: 'door1' },
        ],
      },
    });
    const room2 = makeEntity('room2', {
      id: 'room-def2',
      components: { 'core:name': { text: 'Room2' } },
    });
    const player = makeEntity('player1', {
      id: 'player-def',
      components: {
        'core:actor': {},
        'core:position': { locationId: 'room1' },
        'core:movement': { locked: false },
      },
    });

    originalEntities = [door, room1, room2, player];

    entityManager = {
      activeEntities: new Map(originalEntities.map((e) => [e.id, e])),
      clearAll: jest.fn(() => {
        entityManager.activeEntities.clear();
      }),
      reconstructEntity: jest.fn((data) => {
        const componentData = data.overrides || data.components || {};
        const restored = makeEntity(data.instanceId, {
          id: data.definitionId,
          components: componentData,
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
      buildManifest: jest
        .fn()
        .mockReturnValue([{ modId: 'core', version: '1.0.0' }]),
    };
    const captureService = new GameStateCaptureService({
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

  test('world state matches saved state after load', async () => {
    const saveResult = await persistence.saveGame(
      saveName,
      true,
      'FidelityWorld'
    );
    expect(saveResult.success).toBe(true);

    const filePath = `saves/manual_saves/manual_save_${saveName}.sav`;
    expect(storageProvider.writeFileAtomically).toHaveBeenCalledWith(
      filePath,
      expect.any(Uint8Array)
    );

    entityManager.activeEntities.clear();

    const loadResult = await persistence.loadAndRestoreGame(filePath);
    expect(loadResult.success).toBe(true);

    for (const original of originalEntities) {
      const restored = entityManager.activeEntities.get(original.id);
      expect(restored).toBeDefined();
      expect(restored.definitionId).toBe(original.definitionId);

      const origComponents = Object.fromEntries(original.componentEntries);
      const expectedComponents = Object.fromEntries(
        Object.entries(origComponents).filter(([key, value]) => {
          if (key === 'core:current_actor') return false;
          if (value === null || typeof value !== 'object') return true;
          return Object.keys(value).length > 0;
        })
      );
      const restoredComponents = Object.fromEntries(restored.componentEntries);
      expect(restoredComponents).toEqual(expectedComponents);
    }

    const restoredRoom1 = entityManager.activeEntities.get('room1');
    const exit = restoredRoom1.componentEntries.get('core:exits')[0];
    expect(exit.blocker).toBe('door1');
    const restoredDoor = entityManager.activeEntities.get('door1');
    expect(restoredDoor.componentEntries.get('core:openable').isOpen).toBe(
      true
    );
  });
});
