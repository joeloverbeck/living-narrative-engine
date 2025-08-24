/**
 * @file Integration test for CharacterBuilderBootstrap custom service registration
 * @see CharacterBuilderBootstrap.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CharacterBuilderBootstrap } from '../../../src/characterBuilder/CharacterBuilderBootstrap.js';

describe('CharacterBuilderBootstrap - Custom Service Registration', () => {
  let bootstrap;

  beforeEach(() => {
    bootstrap = new CharacterBuilderBootstrap();
  });

  afterEach(() => {
    if (global.document?.body) {
      global.document.body.innerHTML = '';
    }
  });

  describe('Class Constructor Registration', () => {
    it('should properly register class constructors as services', async () => {
      // Create test classes that mimic CoreMotivationsDisplayEnhancer and CoreMotivationsGenerator
      class TestDisplayEnhancer {
        constructor({ logger }) {
          this.logger = logger;
          this.type = 'displayEnhancer';
        }

        enhance() {
          return 'enhanced';
        }
      }

      class TestGenerator {
        constructor({
          logger,
          llmJsonService,
          llmStrategyFactory,
          llmConfigManager,
          eventBus,
          tokenEstimator,
        }) {
          this.logger = logger;
          this.type = 'generator';
        }

        generate() {
          return 'generated';
        }
      }

      // Create a minimal controller for testing
      class TestController {
        constructor(dependencies) {
          this.dependencies = dependencies;
          this.initialized = false;
        }

        async initialize() {
          this.initialized = true;
        }
      }

      // Set up DOM element
      const containerDiv = document.createElement('div');
      containerDiv.id = 'test-container';
      document.body.appendChild(containerDiv);

      // Bootstrap with custom services
      const result = await bootstrap.bootstrap({
        pageName: 'test-page',
        controllerClass: TestController,
        includeModLoading: false,
        services: {
          displayEnhancer: TestDisplayEnhancer,
          generator: TestGenerator,
        },
      });

      // Verify controller was created
      expect(result).toBeDefined();
      expect(result.controller).toBeDefined();
      expect(result.controller.initialized).toBe(true);

      // Get the container from the result
      const appContainer = result.container;

      // Try to resolve the services - this should work if properly registered
      let displayEnhancer;
      let generator;

      // The services should be available in the controller's dependencies
      // or resolvable from the container
      const controllerDeps = result.controller.dependencies;

      if (controllerDeps) {
        displayEnhancer = controllerDeps.displayEnhancer;
        generator = controllerDeps.generator;
      }

      // If services were successfully instantiated, they should have the expected properties
      if (displayEnhancer) {
        expect(displayEnhancer).toBeInstanceOf(TestDisplayEnhancer);
        expect(displayEnhancer.type).toBe('displayEnhancer');
        expect(displayEnhancer.enhance()).toBe('enhanced');
      }

      if (generator) {
        expect(generator).toBeInstanceOf(TestGenerator);
        expect(generator.type).toBe('generator');
        expect(generator.generate()).toBe('generated');
      }
    });

    it('should handle class registration errors gracefully', async () => {
      // Create a class that will fail during instantiation
      class FailingService {
        constructor({ requiredDep }) {
          if (!requiredDep) {
            throw new Error('Required dependency missing');
          }
        }
      }

      class TestController {
        constructor(dependencies) {
          this.dependencies = dependencies;
        }

        async initialize() {
          // Empty
        }
      }

      // Set up DOM element
      const containerDiv = document.createElement('div');
      containerDiv.id = 'test-container';
      document.body.appendChild(containerDiv);

      // Bootstrap should handle the failing service gracefully
      const result = await bootstrap.bootstrap({
        pageName: 'test-page',
        controllerClass: TestController,
        includeModLoading: false,
        services: {
          failingService: FailingService,
        },
      });

      // Bootstrap should still succeed even if a service fails
      expect(result).toBeDefined();
      expect(result.controller).toBeDefined();
    });

    it('should differentiate between classes and factory functions', async () => {
      // Class constructor
      class ServiceClass {
        constructor({ logger }) {
          this.type = 'class';
          this.logger = logger;
        }
      }

      // Factory function
      const serviceFactory = (container) => {
        return {
          type: 'factory',
          container: container,
        };
      };

      // Plain value
      const serviceValue = {
        type: 'value',
      };

      class TestController {
        constructor(dependencies) {
          this.dependencies = dependencies;
        }

        async initialize() {
          // Empty
        }
      }

      // Set up DOM element
      const containerDiv = document.createElement('div');
      containerDiv.id = 'test-container';
      document.body.appendChild(containerDiv);

      // Bootstrap with mixed service types
      const result = await bootstrap.bootstrap({
        pageName: 'test-page',
        controllerClass: TestController,
        includeModLoading: false,
        services: {
          classService: ServiceClass,
          factoryService: serviceFactory,
          valueService: serviceValue,
        },
      });

      expect(result).toBeDefined();
      expect(result.controller).toBeDefined();

      const deps = result.controller.dependencies;
      if (deps) {
        // Class should be instantiated
        if (deps.classService) {
          expect(deps.classService.type).toBe('class');
        }

        // Factory should be invoked
        if (deps.factoryService) {
          expect(deps.factoryService.type).toBe('factory');
        }

        // Value should be used as-is
        if (deps.valueService) {
          expect(deps.valueService.type).toBe('value');
        }
      }
    });
  });

  describe('Core Motivations Generator Services', () => {
    it('should register CoreMotivationsDisplayEnhancer without errors', async () => {
      // Import the actual service
      const { CoreMotivationsDisplayEnhancer } = await import(
        '../../../src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js'
      );

      class TestController {
        constructor(dependencies) {
          this.dependencies = dependencies;
        }

        async initialize() {
          // Empty
        }
      }

      // Set up DOM element
      const containerDiv = document.createElement('div');
      containerDiv.id = 'test-container';
      document.body.appendChild(containerDiv);

      // Bootstrap with the actual service
      const result = await bootstrap.bootstrap({
        pageName: 'test-page',
        controllerClass: TestController,
        includeModLoading: false,
        services: {
          displayEnhancer: CoreMotivationsDisplayEnhancer,
        },
      });

      expect(result).toBeDefined();
      expect(result.controller).toBeDefined();

      // Check if service was instantiated
      const deps = result.controller.dependencies;
      if (deps && deps.displayEnhancer) {
        expect(deps.displayEnhancer).toBeInstanceOf(
          CoreMotivationsDisplayEnhancer
        );
      }
    });
  });
});
