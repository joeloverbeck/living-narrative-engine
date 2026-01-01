/**
 * @file Integration test for damage simulator shared services registration
 * @description Verifies that shared services (RecipeSelectorService, EntityLoadingService,
 *              AnatomyDataExtractor) are properly registered when initializing the damage simulator.
 *
 * This test reproduces the bug where damage-simulator.js failed to call registerVisualizerComponents(),
 * causing "No service registered for key IRecipeSelectorService" errors at runtime.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerDamageSimulatorComponents } from '../../../src/dependencyInjection/registrations/damageSimulatorRegistrations.js';
import { registerVisualizerComponents } from '../../../src/dependencyInjection/registrations/visualizerRegistrations.js';

/**
 * Creates a minimal mock data registry for testing
 *
 * @returns {object} Mock data registry
 */
function createMockDataRegistry() {
  return {
    getComponent: () => null,
    getEntity: () => null,
    getEntityDefinition: () => null,
    getAllComponents: () => [],
    getAllEntities: () => [],
    getAllEntityDefinitions: () => [],
    setEventDefinition: () => {},
    getEventDefinition: () => null,
  };
}

describe('Damage Simulator Shared Services Integration', () => {
  let container;
  let mockLogger;

  beforeEach(() => {
    container = new AppContainer();

    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    // Register minimal core services needed for the test
    container.register(tokens.ILogger, mockLogger);
    container.register(tokens.IConfiguration, { get: () => ({}) });
  });

  afterEach(() => {
    container = null;
  });

  describe('Bug reproduction: Missing registerVisualizerComponents call', () => {
    it('should throw when resolving IRecipeSelectorService without visualizer components registered', () => {
      // Arrange: Only register damage simulator components (the bug scenario)
      // This simulates what damage-simulator.js was doing before the fix

      // We need some minimal setup to avoid other errors
      container.register(tokens.IDataRegistry, createMockDataRegistry());
      container.register(tokens.IValidatedEventDispatcher, {
        dispatch: () => {},
        subscribe: () => ({ unsubscribe: () => {} }),
      });
      container.register(tokens.IEntityManager, {
        getEntity: () => null,
        createEntity: () => 'test-entity',
      });
      container.register(tokens.OperationInterpreter, {
        execute: () => Promise.resolve({}),
      });

      // Act: Register damage simulator components (which are lazy)
      // The error only happens when we try to RESOLVE DamageSimulatorUI,
      // because that's when it tries to resolve its dependencies
      registerDamageSimulatorComponents(container);

      // Act & Assert: Actually resolve DamageSimulatorUI to trigger the missing dependency error
      expect(() => {
        container.resolve(tokens.DamageSimulatorUI);
      }).toThrow(/No service registered for key.*IRecipeSelectorService/);
    });

    it('should throw when resolving IEntityLoadingService without visualizer components registered', () => {
      // Arrange: Set up minimal container without visualizer components
      container.register(tokens.IDataRegistry, createMockDataRegistry());
      container.register(tokens.IValidatedEventDispatcher, {
        dispatch: () => {},
        subscribe: () => ({ unsubscribe: () => {} }),
      });
      container.register(tokens.IEntityManager, {
        getEntity: () => null,
        createEntity: () => 'test-entity',
      });

      // Act & Assert: Directly try to resolve the service
      expect(() => {
        container.resolve(tokens.IEntityLoadingService);
      }).toThrow(/No service registered for key.*IEntityLoadingService/);
    });

    it('should throw when resolving IAnatomyDataExtractor without visualizer components registered', () => {
      // Arrange: Set up minimal container without visualizer components
      container.register(tokens.IDataRegistry, createMockDataRegistry());
      container.register(tokens.IValidatedEventDispatcher, {
        dispatch: () => {},
        subscribe: () => ({ unsubscribe: () => {} }),
      });
      container.register(tokens.IEntityManager, {
        getEntity: () => null,
        createEntity: () => 'test-entity',
      });

      // Act & Assert: Directly try to resolve the service
      expect(() => {
        container.resolve(tokens.IAnatomyDataExtractor);
      }).toThrow(/No service registered for key.*IAnatomyDataExtractor/);
    });
  });

  describe('Fix verification: With registerVisualizerComponents call', () => {
    it('should successfully resolve IRecipeSelectorService when visualizer components are registered', () => {
      // Arrange: Register visualizer components first (the fix)
      container.register(tokens.IDataRegistry, createMockDataRegistry());
      container.register(tokens.IValidatedEventDispatcher, {
        dispatch: () => {},
        subscribe: () => ({ unsubscribe: () => {} }),
      });
      container.register(tokens.IEventBus, {
        dispatch: () => {},
        subscribe: () => ({ unsubscribe: () => {} }),
      });
      container.register(tokens.IEntityManager, {
        getEntity: () => null,
        createEntity: () => 'test-entity',
        getAllEntities: () => [],
        getEntityInstance: () => null,
        createEntityInstance: () => Promise.resolve('test-entity'),
        removeEntityInstance: () => Promise.resolve(),
      });

      // Register the visualizer components (this includes the shared services)
      registerVisualizerComponents(container);

      // Act: Resolve the service
      const service = container.resolve(tokens.IRecipeSelectorService);

      // Assert
      expect(service).toBeDefined();
      expect(typeof service.populateWithComponent).toBe('function');
    });

    it('should successfully resolve IAnatomyDataExtractor when visualizer components are registered', () => {
      // Arrange
      container.register(tokens.IDataRegistry, createMockDataRegistry());
      container.register(tokens.IValidatedEventDispatcher, {
        dispatch: () => {},
        subscribe: () => ({ unsubscribe: () => {} }),
      });
      container.register(tokens.IEventBus, {
        dispatch: () => {},
        subscribe: () => ({ unsubscribe: () => {} }),
      });
      container.register(tokens.IEntityManager, {
        getEntity: () => null,
        createEntity: () => 'test-entity',
        getAllEntities: () => [],
        getEntityInstance: () => null,
        createEntityInstance: () => Promise.resolve('test-entity'),
        removeEntityInstance: () => Promise.resolve(),
      });

      // Register the visualizer components
      registerVisualizerComponents(container);

      // Act: Resolve the service
      const extractor = container.resolve(tokens.IAnatomyDataExtractor);

      // Assert
      expect(extractor).toBeDefined();
      expect(typeof extractor.extractFromEntity).toBe('function');
    });

    it('should allow registering damage simulator components after visualizer components', () => {
      // Arrange: Set up full dependency chain
      container.register(tokens.IDataRegistry, createMockDataRegistry());
      container.register(tokens.IValidatedEventDispatcher, {
        dispatch: () => {},
        subscribe: () => ({ unsubscribe: () => {} }),
      });
      container.register(tokens.IEventBus, {
        dispatch: () => {},
        subscribe: () => ({ unsubscribe: () => {} }),
      });
      container.register(tokens.IEntityManager, {
        getEntity: () => null,
        createEntity: () => 'test-entity',
        getAllEntities: () => [],
        hasComponent: () => false,
        getEntityInstance: () => null,
        createEntityInstance: () => Promise.resolve('test-entity'),
        removeEntityInstance: () => Promise.resolve(),
      });
      container.register(tokens.ISchemaValidator, {
        validate: () => ({ valid: true }),
      });
      container.register(tokens.OperationInterpreter, {
        execute: () => Promise.resolve({}),
      });

      // Act: Register in the correct order (visualizer first, then damage simulator)
      registerVisualizerComponents(container);

      expect(() => {
        registerDamageSimulatorComponents(container);
      }).not.toThrow();

      // Assert: All services should be resolvable
      expect(container.resolve(tokens.IRecipeSelectorService)).toBeDefined();
      expect(container.resolve(tokens.IAnatomyDataExtractor)).toBeDefined();
      expect(container.resolve(tokens.DamageSimulatorUI)).toBeDefined();
    });
  });
});
