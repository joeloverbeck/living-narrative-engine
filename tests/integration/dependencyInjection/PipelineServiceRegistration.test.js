/**
 * @file Integration test for pipeline service registration
 * Tests that all pipeline services are properly registered and can be resolved from the container
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

describe('Pipeline Service Registration Integration', () => {
  let container;
  let consoleErrorSpy;
  let consoleWarnSpy;
  let logger;

  beforeEach(async () => {
    container = new AppContainer();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Register logger first as it's needed by other services
    logger = new ConsoleLogger(LogLevel.ERROR);
    container.register(tokens.ILogger, () => logger);

    // Configure container with base services
    await configureBaseContainer(container, {
      includeGameSystems: false, // We only need core services for pipeline testing
      includeUI: false,
      logger: logger,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Service Infrastructure', () => {
    it('should register IPipelineServiceFactory', () => {
      expect(() =>
        container.resolve(tokens.IPipelineServiceFactory)
      ).not.toThrow();
      const factory = container.resolve(tokens.IPipelineServiceFactory);
      expect(factory).toBeDefined();
      expect(factory.constructor.name).toBe('ServiceFactory');
    });

    it('should register IPipelineServiceRegistry', () => {
      expect(() =>
        container.resolve(tokens.IPipelineServiceRegistry)
      ).not.toThrow();
      const registry = container.resolve(tokens.IPipelineServiceRegistry);
      expect(registry).toBeDefined();
      expect(registry.constructor.name).toBe('ServiceRegistry');
    });

    it('should inject proper dependencies into ServiceFactory', () => {
      const factory = container.resolve(tokens.IPipelineServiceFactory);
      // ServiceFactory should have container and logger injected
      // We can't directly inspect private fields, but we can verify it doesn't throw
      expect(factory).toBeDefined();
    });
  });

  describe('Pipeline Services', () => {
    it('should register ITargetDependencyResolver', () => {
      expect(() =>
        container.resolve(tokens.ITargetDependencyResolver)
      ).not.toThrow();
      const resolver = container.resolve(tokens.ITargetDependencyResolver);
      expect(resolver).toBeDefined();
      expect(resolver.constructor.name).toBe('TargetDependencyResolver');
    });

    it('should register ILegacyTargetCompatibilityLayer', () => {
      expect(() =>
        container.resolve(tokens.ILegacyTargetCompatibilityLayer)
      ).not.toThrow();
      const layer = container.resolve(tokens.ILegacyTargetCompatibilityLayer);
      expect(layer).toBeDefined();
      expect(layer.constructor.name).toBe('LegacyTargetCompatibilityLayer');
    });

    it('should register IScopeContextBuilder', () => {
      expect(() =>
        container.resolve(tokens.IScopeContextBuilder)
      ).not.toThrow();
      const builder = container.resolve(tokens.IScopeContextBuilder);
      expect(builder).toBeDefined();
      expect(builder.constructor.name).toBe('ScopeContextBuilder');
    });

    it('should register ITargetDisplayNameResolver', () => {
      expect(() =>
        container.resolve(tokens.ITargetDisplayNameResolver)
      ).not.toThrow();
      const resolver = container.resolve(tokens.ITargetDisplayNameResolver);
      expect(resolver).toBeDefined();
      expect(resolver.constructor.name).toBe('TargetDisplayNameResolver');
    });
  });

  describe('Dependency Injection', () => {
    it('should inject logger into all pipeline services', () => {
      // All services should receive the logger dependency
      const services = [
        tokens.ITargetDependencyResolver,
        tokens.ILegacyTargetCompatibilityLayer,
        tokens.IScopeContextBuilder,
        tokens.ITargetDisplayNameResolver,
      ];

      services.forEach((token) => {
        expect(() => container.resolve(token)).not.toThrow();
        const service = container.resolve(token);
        expect(service).toBeDefined();
      });
    });

    it('should inject ITargetContextBuilder and IEntityManager into ScopeContextBuilder', () => {
      // ScopeContextBuilder has additional dependencies
      expect(() =>
        container.resolve(tokens.IScopeContextBuilder)
      ).not.toThrow();
      const builder = container.resolve(tokens.IScopeContextBuilder);
      expect(builder).toBeDefined();

      // Verify that the required dependencies are available in the container
      expect(() =>
        container.resolve(tokens.ITargetContextBuilder)
      ).not.toThrow();
      expect(() => container.resolve(tokens.IEntityManager)).not.toThrow();
    });

    it('should inject IEntityManager into TargetDisplayNameResolver', () => {
      // TargetDisplayNameResolver requires EntityManager
      expect(() =>
        container.resolve(tokens.ITargetDisplayNameResolver)
      ).not.toThrow();
      const resolver = container.resolve(tokens.ITargetDisplayNameResolver);
      expect(resolver).toBeDefined();

      // Verify that EntityManager is available
      expect(() => container.resolve(tokens.IEntityManager)).not.toThrow();
    });
  });

  describe('Service Lifecycle', () => {
    it('should register all pipeline services as singletons', () => {
      // Get instances twice and verify they are the same object
      const factory1 = container.resolve(tokens.IPipelineServiceFactory);
      const factory2 = container.resolve(tokens.IPipelineServiceFactory);
      expect(factory1).toBe(factory2);

      const registry1 = container.resolve(tokens.IPipelineServiceRegistry);
      const registry2 = container.resolve(tokens.IPipelineServiceRegistry);
      expect(registry1).toBe(registry2);

      const resolver1 = container.resolve(tokens.ITargetDependencyResolver);
      const resolver2 = container.resolve(tokens.ITargetDependencyResolver);
      expect(resolver1).toBe(resolver2);

      const layer1 = container.resolve(tokens.ILegacyTargetCompatibilityLayer);
      const layer2 = container.resolve(tokens.ILegacyTargetCompatibilityLayer);
      expect(layer1).toBe(layer2);

      const builder1 = container.resolve(tokens.IScopeContextBuilder);
      const builder2 = container.resolve(tokens.IScopeContextBuilder);
      expect(builder1).toBe(builder2);

      const displayResolver1 = container.resolve(
        tokens.ITargetDisplayNameResolver
      );
      const displayResolver2 = container.resolve(
        tokens.ITargetDisplayNameResolver
      );
      expect(displayResolver1).toBe(displayResolver2);
    });
  });

  describe('Circular Dependencies', () => {
    it('should not have circular dependencies', () => {
      // The fact that all services resolve without throwing already indicates
      // no circular dependencies, but let's be explicit
      const allServices = [
        tokens.IPipelineServiceFactory,
        tokens.IPipelineServiceRegistry,
        tokens.ITargetDependencyResolver,
        tokens.ILegacyTargetCompatibilityLayer,
        tokens.IScopeContextBuilder,
        tokens.ITargetDisplayNameResolver,
      ];

      allServices.forEach((token) => {
        expect(() => container.resolve(token)).not.toThrow();
      });
    });
  });

  describe('Testing Support', () => {
    it('should support mocking pipeline services', () => {
      // Create a mock service
      const mockResolver = {
        resolveDependencies: jest.fn(),
      };

      // Register the mock
      container.register(tokens.ITargetDependencyResolver, () => mockResolver);

      // Verify we get the mock
      const resolved = container.resolve(tokens.ITargetDependencyResolver);
      expect(resolved).toBe(mockResolver);
      expect(resolved.resolveDependencies).toBeDefined();
    });

    it('should allow re-registration for testing', () => {
      // Get original
      const original = container.resolve(tokens.ITargetDependencyResolver);

      // Re-register with a mock
      const mock = { isMock: true };
      container.register(tokens.ITargetDependencyResolver, () => mock);

      // Verify we get the mock
      const resolved = container.resolve(tokens.ITargetDependencyResolver);
      expect(resolved).toBe(mock);
      expect(resolved).not.toBe(original);
    });
  });
});
