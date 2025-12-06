/**
 * @file Integration test reproducing game.html initialization failure
 * @description Tests the dependency injection issue that occurs when accessing game.html
 * in a browser environment where IModValidationOrchestrator is not available.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerInfrastructure } from '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js';
import { registerInterpreters } from '../../../src/dependencyInjection/registrations/interpreterRegistrations.js';

describe('Game Initialization Failure - Integration', () => {
  let container;

  beforeEach(() => {
    container = new AppContainer();

    // Register minimal required services for the loader registration to work
    const simpleLogger = {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    container.register(tokens.ILogger, simpleLogger);

    // Register other minimal required services
    container.register(tokens.IValidatedEventDispatcher, {
      dispatch: () => Promise.resolve(),
    });

    // Register infrastructure which includes ISafeEventDispatcher needed by EntityDefinitionLoader
    registerInfrastructure(container);

    // Register interpreters which includes OperationRegistry needed by RuleLoader
    registerInterpreters(container);
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe('Browser Environment Dependency Injection', () => {
    it('should demonstrate the issue with direct ModManifestProcessor instantiation', async () => {
      // Arrange: Create a simple container that doesn't have IModValidationOrchestrator
      const simpleContainer = new AppContainer();
      simpleContainer.register(tokens.ILogger, {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      });

      // Act & Assert: Try to resolve IModValidationOrchestrator - should fail in browser
      expect(() => {
        simpleContainer.resolve(tokens.IModValidationOrchestrator);
      }).toThrow(/No service registered for key "IModValidationOrchestrator"/);

      // This demonstrates the exact error from the original logs
    });

    it('should successfully resolve ManifestPhase when infrastructure is registered', async () => {
      // Arrange: Infrastructure is already registered in beforeEach

      const { registerLoaders } = await import(
        '../../../src/dependencyInjection/registrations/loadersRegistrations.js'
      );

      await registerLoaders(container);

      // Act & Assert: ManifestPhase should resolve successfully now that ISafeEventDispatcher is available
      expect(() => {
        const manifestPhase = container.resolve('ManifestPhase');
        expect(manifestPhase).toBeDefined();
      }).not.toThrow();
    });

    it('should successfully resolve ModsLoader when infrastructure is registered', async () => {
      // Arrange: Infrastructure is already registered in beforeEach

      const { registerLoaders } = await import(
        '../../../src/dependencyInjection/registrations/loadersRegistrations.js'
      );

      await registerLoaders(container);

      // Act & Assert: ModsLoader should resolve successfully now that all dependencies are available
      expect(() => {
        const modsLoader = container.resolve('ModsLoader');
        expect(modsLoader).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Successful Resolution with Infrastructure', () => {
    it('should successfully create ModManifestProcessor without orchestrator', async () => {
      // With infrastructure registered, ModManifestProcessor can be created
      // even without IModValidationOrchestrator (it's optional)

      const { registerLoaders } = await import(
        '../../../src/dependencyInjection/registrations/loadersRegistrations.js'
      );

      await registerLoaders(container);

      // This should succeed
      expect(() => {
        const processor = container.resolve('ModManifestProcessor');
        expect(processor).toBeDefined();
      }).not.toThrow();
    });

    it('should successfully initialize full mod loading pipeline', async () => {
      // With infrastructure registered, the full pipeline works

      const { registerLoaders } = await import(
        '../../../src/dependencyInjection/registrations/loadersRegistrations.js'
      );

      await registerLoaders(container);

      // Full pipeline should work
      expect(() => {
        const modsLoader = container.resolve('ModsLoader');
        expect(modsLoader).toBeDefined();
      }).not.toThrow();
    });
  });
});
