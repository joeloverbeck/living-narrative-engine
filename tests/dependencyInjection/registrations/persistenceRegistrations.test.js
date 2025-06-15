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
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { registerPersistence } from '../../../src/dependencyInjection/registrations/persistenceRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

// Concrete Implementations
import PlaytimeTracker from '../../../src/engine/playtimeTracker.js';
import ComponentCleaningService from '../../../src/persistence/componentCleaningService.js';
import GamePersistenceService from '../../../src/persistence/gamePersistenceService.js';
import ReferenceResolver from '../../../src/initializers/services/referenceResolver.js';
import SaveMetadataBuilder from '../../../src/persistence/saveMetadataBuilder.js';
import SaveLoadService from '../../../src/persistence/saveLoadService.js';
import { BrowserStorageProvider } from '../../../src/storage/browserStorageProvider.js';

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
    mockDataRegistry = mock();

    // Register required pre-existing services
    container.register(tokens.ILogger, () => mockLogger);
    container.register(tokens.IEntityManager, () => mockEntityManager);
    container.register(tokens.IDataRegistry, () => mockDataRegistry);
    container.register(tokens.ISafeEventDispatcher, () => ({
      dispatch: jest.fn(),
    }));
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
      `Persistence Registration: Registered ${String(tokens.GamePersistenceService)}.`
    );
    expect(logs).toContain(
      `Persistence Registration: Registered ${String(tokens.IReferenceResolver)}.`
    );
    expect(logs[logs.length - 1]).toBe('Persistence Registration: Completed.');
  });

  describe('service registrations', () => {
    const specs = [
      {
        token: tokens.IStorageProvider,
        Class: BrowserStorageProvider,
        lifecycle: 'singleton',
        deps: [tokens.ILogger],
      },
      {
        token: tokens.ISaveLoadService,
        Class: SaveLoadService,
        lifecycle: 'singleton',
        deps: [tokens.ILogger, tokens.IStorageProvider],
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
        lifecycle: 'singleton',
        deps: [tokens.ILogger],
      },
      {
        token: tokens.SaveMetadataBuilder,
        Class: SaveMetadataBuilder,
        lifecycle: 'singleton',
        deps: [tokens.ILogger],
      },
      {
        token: tokens.GamePersistenceService,
        Class: GamePersistenceService,
        lifecycle: 'singletonFactory',
      },
      {
        token: tokens.IReferenceResolver,
        Class: ReferenceResolver,
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
        if (deps) {
          expect(options.dependencies).toEqual(deps);
        } else {
          expect(options.dependencies).toBeUndefined();
        }
      }
    );
  });
});
