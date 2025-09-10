/**
 * @file Integration test reproducing game.html initialization failure
 * @description Tests the dependency injection issue that occurs when accessing game.html
 * in a browser environment where IModValidationOrchestrator is not available.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

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
    container.register(tokens.IValidatedEventDispatcher, { dispatch: () => Promise.resolve() });
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
        error: () => {}
      });

      // Act & Assert: Try to resolve IModValidationOrchestrator - should fail in browser
      expect(() => {
        simpleContainer.resolve(tokens.IModValidationOrchestrator);
      }).toThrow(/No service registered for key "IModValidationOrchestrator"/);
      
      // This demonstrates the exact error from the original logs
    });

    it('should reproduce the ManifestPhase initialization failure cascade', async () => {
      // Arrange: Same setup as above
      
      const { registerLoaders } = await import(
        '../../../src/dependencyInjection/registrations/loadersRegistrations.js'
      );
      
      await registerLoaders(container);

      // Act & Assert: Try to resolve ManifestPhase - should fail due to ModManifestProcessor dependency
      expect(() => {
        container.resolve('ManifestPhase');
      }).toThrow(/Failed to create instance for "ModManifestProcessor"/);
    });

    it('should reproduce the ModsLoader initialization failure cascade', async () => {
      // Arrange: Same setup as above
      
      const { registerLoaders } = await import(
        '../../../src/dependencyInjection/registrations/loadersRegistrations.js'
      );
      
      await registerLoaders(container);

      // Act & Assert: Try to resolve ModsLoader - should fail due to ManifestPhase dependency
      expect(() => {
        container.resolve('ModsLoader');
      }).toThrow(/Failed to resolve ManifestPhase/);
    });
  });

  describe('Expected Behavior After Fix', () => {
    it('should successfully create ModManifestProcessor without orchestrator', async () => {
      // This test will pass after we implement the fix
      // For now, it documents the expected behavior
      
      const { registerLoaders } = await import(
        '../../../src/dependencyInjection/registrations/loadersRegistrations.js'
      );
      
      await registerLoaders(container);

      // After fix: This should succeed
      expect(() => {
        const processor = container.resolve('ModManifestProcessor');
        expect(processor).toBeDefined();
      }).not.toThrow();
    });

    it('should successfully initialize full mod loading pipeline', async () => {
      // This test will pass after we implement the fix
      
      const { registerLoaders } = await import(
        '../../../src/dependencyInjection/registrations/loadersRegistrations.js'
      );
      
      await registerLoaders(container);

      // After fix: Full pipeline should work
      expect(() => {
        const modsLoader = container.resolve('ModsLoader');
        expect(modsLoader).toBeDefined();
      }).not.toThrow();
    });
  });
});