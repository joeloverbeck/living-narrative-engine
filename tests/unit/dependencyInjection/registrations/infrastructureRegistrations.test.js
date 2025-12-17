/**
 * @file Test suite for infrastructureRegistrations - IStorageProvider and PlaytimeTracker.
 * @see src/dependencyInjection/registrations/infrastructureRegistrations.js
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
import { registerInfrastructure } from '../../../../src/dependencyInjection/registrations/infrastructureRegistrations.js';
import { registerLoaders } from '../../../../src/dependencyInjection/registrations/loadersRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

// Concrete Implementations for verification
import { BrowserStorageProvider } from '../../../../src/storage/browserStorageProvider.js';
import PlaytimeTracker from '../../../../src/engine/playtimeTracker.js';
import { expectSingleton } from '../../../common/containerAssertions.js';

describe('registerInfrastructure - Storage and Playtime registrations', () => {
  /** @type {AppContainer} */
  let container;
  let mockLogger;
  let mockDocumentContext;
  let mockEntityManager;
  let mockConfiguration;
  let mockSchemaValidator;
  let mockDataRegistry;

  beforeEach(async () => {
    container = new AppContainer();

    // Setup mock dependencies required by infrastructureRegistrations
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockDocumentContext = mock();
    mockEntityManager = mock();
    mockConfiguration = mock();
    mockSchemaValidator = mock();
    mockDataRegistry = mock();

    // Register dependencies required by infrastructureRegistrations
    container.register(tokens.ILogger, () => mockLogger, {
      lifecycle: 'singleton',
    });
    container.register(tokens.IDocumentContext, () => mockDocumentContext, {
      lifecycle: 'singleton',
    });
    container.register(tokens.IEntityManager, () => mockEntityManager, {
      lifecycle: 'singleton',
    });
    container.register(tokens.IConfiguration, () => mockConfiguration, {
      lifecycle: 'singleton',
    });
    container.register(tokens.ISchemaValidator, () => mockSchemaValidator, {
      lifecycle: 'singleton',
    });
    container.register(tokens.IDataRegistry, () => mockDataRegistry, {
      lifecycle: 'singleton',
    });

    // Register loaders first (required by infrastructure)
    await registerLoaders(container);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('IStorageProvider registration', () => {
    test('registers IStorageProvider as singleton', () => {
      registerInfrastructure(container);

      expectSingleton(container, tokens.IStorageProvider, BrowserStorageProvider);
    });

    test('IStorageProvider resolves without errors', () => {
      registerInfrastructure(container);

      expect(() => container.resolve(tokens.IStorageProvider)).not.toThrow();
    });

    test('IStorageProvider has required dependencies injected', () => {
      registerInfrastructure(container);

      const storageProvider = container.resolve(tokens.IStorageProvider);

      // Verify the resolved instance has the expected structure
      expect(storageProvider).toBeInstanceOf(BrowserStorageProvider);
    });

    test('logs IStorageProvider registration', () => {
      registerInfrastructure(container);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Registered ${String(tokens.IStorageProvider)}`)
      );
    });
  });

  describe('PlaytimeTracker registration', () => {
    test('registers PlaytimeTracker as singleton', () => {
      registerInfrastructure(container);

      expectSingleton(container, tokens.PlaytimeTracker, PlaytimeTracker);
    });

    test('PlaytimeTracker resolves without errors', () => {
      registerInfrastructure(container);

      expect(() => container.resolve(tokens.PlaytimeTracker)).not.toThrow();
    });

    test('PlaytimeTracker has required dependencies injected', () => {
      registerInfrastructure(container);

      const playtimeTracker = container.resolve(tokens.PlaytimeTracker);

      // Verify the resolved instance has the expected structure
      expect(playtimeTracker).toBeInstanceOf(PlaytimeTracker);
    });

    test('logs PlaytimeTracker registration', () => {
      registerInfrastructure(container);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Registered ${String(tokens.PlaytimeTracker)}`)
      );
    });
  });

  describe('registration order', () => {
    test('IStorageProvider is available before registration completes', () => {
      registerInfrastructure(container);

      // Verify both registrations occur and complete message is logged last
      const debugCalls = mockLogger.debug.mock.calls.map((call) => call[0]);
      const storageIndex = debugCalls.findIndex((msg) =>
        msg.includes(`Registered ${String(tokens.IStorageProvider)}`)
      );
      const playtimeIndex = debugCalls.findIndex((msg) =>
        msg.includes(`Registered ${String(tokens.PlaytimeTracker)}`)
      );
      const completeIndex = debugCalls.findIndex((msg) =>
        msg.includes('Infrastructure Registration: complete')
      );

      expect(storageIndex).toBeGreaterThan(-1);
      expect(playtimeIndex).toBeGreaterThan(-1);
      expect(completeIndex).toBeGreaterThan(storageIndex);
      expect(completeIndex).toBeGreaterThan(playtimeIndex);
    });
  });
});
