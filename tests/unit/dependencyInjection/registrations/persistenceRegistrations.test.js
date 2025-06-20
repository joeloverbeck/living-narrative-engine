/**
 * @file Test suite for persistenceRegistrations.
 * @see tests/dependencyInjection/registrations/persistenceRegistrations.test.js
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { mock } from 'jest-mock-extended';

// DI Container and SUT
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { registerPersistence } from '../../../../src/dependencyInjection/registrations/persistenceRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

// Concrete Implementations
import PlaytimeTracker from '../../../../src/engine/playtimeTracker.js';
import ComponentCleaningService from '../../../../src/persistence/componentCleaningService.js';
import GamePersistenceService from '../../../../src/persistence/gamePersistenceService.js';
import GameStateCaptureService from '../../../../src/persistence/gameStateCaptureService.js';
import SaveMetadataBuilder from '../../../../src/persistence/saveMetadataBuilder.js';
import ActiveModsManifestBuilder from '../../../../src/persistence/activeModsManifestBuilder.js';
import SaveLoadService from '../../../../src/persistence/saveLoadService.js';
import SaveFileRepository from '../../../../src/persistence/saveFileRepository.js';
import { BrowserStorageProvider } from '../../../../src/storage/browserStorageProvider.js';

describe('registerPersistence', () => {
  /** @type {AppContainer} */
  let container;
  let mockLogger;
  let mockEntityManager;
  let mockDataRegistry;
  let registerSpy;

  beforeEach(() => {
    container = new AppContainer();
    registerSpy = jest.spyOn(container, 'register');

    // Mocks for external dependencies
    mockLogger = mock();
    mockEntityManager = mock();
    mockEntityManager.clearAll = jest.fn();
    mockEntityManager.reconstructEntity = jest.fn();
    mockDataRegistry = mock();

    // Register required pre-existing services
    container.register(tokens.ILogger, () => mockLogger);
    container.register(tokens.IEntityManager, { clearAll: jest.fn(), reconstructEntity: jest.fn() }, { lifecycle: 'singleton' });
    container.register(tokens.IDataRegistry, () => mockDataRegistry);
    container.register(tokens.ISafeEventDispatcher, { dispatch: jest.fn() }, { lifecycle: 'singleton' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('logs start, each registration, and completion in order', () => {
    registerPersistence(container);

    const logs = mockLogger.debug.mock.calls.map((call) => call[0]);

    expect(logs[0]).toBe('Persistence Registration: Starting...');
    expect(logs).toContain(
      `Persistence Registration: Registered ${String(tokens.IStorageProvider)}.`
    );
    expect(logs).toContain(
      `Persistence Registration: Registered ${String(tokens.ISaveFileRepository)}.`
    );
    expect(logs).toContain(
      `Persistence Registration: Registered ${String(tokens.ISaveLoadService)}.`
    );
    expect(logs).toContain(
      `Persistence Registration: Registered ${String(tokens.PlaytimeTracker)}.`
    );
    expect(logs).toContain(
      `Persistence Registration: Registered ${String(tokens.ComponentCleaningService)}.`
    );
    expect(logs).toContain(
      `Persistence Registration: Registered ${String(tokens.SaveMetadataBuilder)}.`
    );
    expect(logs).toContain(
      `Persistence Registration: Registered ${String(tokens.ActiveModsManifestBuilder)}.`
    );
    expect(logs).toContain(
      `Persistence Registration: Registered ${String(tokens.GameStateCaptureService)}.`
    );
    expect(logs).toContain(
      `Persistence Registration: Registered ${String(tokens.GamePersistenceService)}.`
    );
    expect(logs[logs.length - 1]).toBe('Persistence Registration: Completed.');
  });

  describe('service registrations', () => {
    const specs = [
      {
        token: tokens.IStorageProvider,
        Class: BrowserStorageProvider,
        lifecycle: 'singleton',
        deps: [tokens.ILogger, tokens.ISafeEventDispatcher],
      },
      {
        token: tokens.ISaveFileRepository,
        Class: SaveFileRepository,
        lifecycle: 'singletonFactory',
      },
      {
        token: tokens.ISaveLoadService,
        Class: SaveLoadService,
        lifecycle: 'singletonFactory',
      },
      {
        token: tokens.PlaytimeTracker,
        Class: PlaytimeTracker,
        lifecycle: 'singleton',
        deps: [tokens.ILogger, tokens.ISafeEventDispatcher],
      },
      {
        token: tokens.ComponentCleaningService,
        Class: ComponentCleaningService,
        lifecycle: 'singletonFactory',
      },
      {
        token: tokens.SaveMetadataBuilder,
        Class: SaveMetadataBuilder,
        lifecycle: 'singleton',
        deps: [tokens.ILogger],
      },
      {
        token: tokens.ActiveModsManifestBuilder,
        Class: ActiveModsManifestBuilder,
        lifecycle: 'singleton',
        deps: [tokens.ILogger, tokens.IDataRegistry],
      },
      {
        token: tokens.GameStateCaptureService,
        Class: GameStateCaptureService,
        lifecycle: 'singletonFactory',
      },
      {
        token: tokens.GamePersistenceService,
        Class: GamePersistenceService,
        lifecycle: 'singletonFactory',
      },
    ];

    test.each(specs)(
      'registers $token as $lifecycle and resolves correct instance',
      ({ token, Class, lifecycle, deps }) => {
        registerPersistence(container);

        // 1. Resolution
        const instance = container.resolve(token);
        expect(instance).toBeInstanceOf(Class);

        // 2. Singleton behavior
        expect(container.resolve(token)).toBe(instance);

        // 3. Registration call
        const call = registerSpy.mock.calls.find((c) => c[0] === token);
        expect(call).toBeDefined();
        const options = call[2] || {};
        expect(options.lifecycle).toBe(lifecycle);

        // 4. Dependencies metadata (for class registrations)
        const expectedDeps = deps || undefined;
        expect(options.dependencies).toEqual(expectedDeps);
      }
    );
  });

  it('registers all required services with correct dependencies', () => {
    const container = new AppContainer();
    // Register required dependencies first
    container.register(tokens.ILogger, {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }, { lifecycle: 'singleton' });
    container.register(tokens.IEntityManager, { clearAll: jest.fn(), reconstructEntity: jest.fn() }, { lifecycle: 'singleton' });
    container.register(tokens.ISafeEventDispatcher, { dispatch: jest.fn() }, { lifecycle: 'singleton' });
    container.register(tokens.IDataRegistry, { getAll: jest.fn() }, { lifecycle: 'singleton' });
    
    registerPersistence(container);

    // Test that services can be resolved without errors
    expect(() => container.resolve(tokens.IStorageProvider)).not.toThrow();
    expect(() => container.resolve(tokens.ISaveFileRepository)).not.toThrow();
    expect(() => container.resolve(tokens.ISaveLoadService)).not.toThrow();
    expect(() => container.resolve(tokens.PlaytimeTracker)).not.toThrow();
    expect(() => container.resolve(tokens.ComponentCleaningService)).not.toThrow();
    expect(() => container.resolve(tokens.SaveMetadataBuilder)).not.toThrow();
    expect(() => container.resolve(tokens.ActiveModsManifestBuilder)).not.toThrow();
    expect(() => container.resolve(tokens.GameStateCaptureService)).not.toThrow();
    expect(() => container.resolve(tokens.ManualSaveCoordinator)).not.toThrow();
    expect(() => container.resolve(tokens.GamePersistenceService)).not.toThrow();
  });

  it('logs registration messages', () => {
    const container = new AppContainer();
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    
    // Register required dependencies first
    container.register(tokens.ILogger, mockLogger, { lifecycle: 'singleton' });
    container.register(tokens.IEntityManager, { clearAll: jest.fn(), reconstructEntity: jest.fn() }, { lifecycle: 'singleton' });
    container.register(tokens.ISafeEventDispatcher, { dispatch: jest.fn() }, { lifecycle: 'singleton' });
    container.register(tokens.IDataRegistry, {}, { lifecycle: 'singleton' });
    
    const logSpy = jest.spyOn(mockLogger, 'debug');

    registerPersistence(container);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Persistence Registration: Starting...')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Persistence Registration: Completed.')
    );
  });
});
