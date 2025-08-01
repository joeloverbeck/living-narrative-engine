/**
 * @file ServiceRegistration.test.js - Integration tests for pipeline service registration
 *
 * Tests verify that pipeline services are properly registered in the DI container:
 * - TargetDependencyResolver, LegacyTargetCompatibilityLayer, and ScopeContextBuilder are fully implemented
 * - TargetDisplayNameResolver remains as placeholder (Ticket 06)
 * - ServiceFactory and ServiceRegistry provide infrastructure services
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AppContainer from '../../../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../../../src/dependencyInjection/tokens.js';
import { ServiceFactory } from '../../../../../src/actions/pipeline/services/ServiceFactory.js';
import { ServiceRegistry } from '../../../../../src/actions/pipeline/services/ServiceRegistry.js';
import { createMockLogger } from '../../../../common/mockFactories/index.js';

describe('Pipeline Service Registration Integration', () => {
  let container;
  let logger;

  beforeEach(async () => {
    // Create a real container
    container = new AppContainer();

    // Create mock logger for testing
    logger = createMockLogger();
    container.register(tokens.ILogger, logger, { isInstance: true });

    // Configure the container with base services
    await configureBaseContainer(container, {
      includeGameSystems: false,
      includeUI: false,
      logger,
    });
  });

  afterEach(() => {
    container = null;
    logger = null;
  });

  describe('Service Infrastructure Registration', () => {
    it('should register ServiceFactory successfully', () => {
      const factory = container.resolve(tokens.IPipelineServiceFactory);

      expect(factory).toBeInstanceOf(ServiceFactory);
      expect(factory).toBeDefined();
    });

    it('should register ServiceRegistry successfully', () => {
      const registry = container.resolve(tokens.IPipelineServiceRegistry);

      expect(registry).toBeInstanceOf(ServiceRegistry);
      expect(registry).toBeDefined();
    });

    it('should create singleton instances', () => {
      const factory1 = container.resolve(tokens.IPipelineServiceFactory);
      const factory2 = container.resolve(tokens.IPipelineServiceFactory);

      expect(factory1).toBe(factory2);

      const registry1 = container.resolve(tokens.IPipelineServiceRegistry);
      const registry2 = container.resolve(tokens.IPipelineServiceRegistry);

      expect(registry1).toBe(registry2);
    });
  });

  describe('Implemented Service Registration', () => {
    it('should register ITargetDependencyResolver successfully', () => {
      const resolver = container.resolve(tokens.ITargetDependencyResolver);

      expect(resolver).toBeDefined();
      expect(resolver.constructor.name).toBe('TargetDependencyResolver');
    });

    it('should register ILegacyTargetCompatibilityLayer successfully', () => {
      const layer = container.resolve(tokens.ILegacyTargetCompatibilityLayer);

      expect(layer).toBeDefined();
      expect(layer.constructor.name).toBe('LegacyTargetCompatibilityLayer');
    });

    it('should register IScopeContextBuilder successfully', () => {
      const builder = container.resolve(tokens.IScopeContextBuilder);

      expect(builder).toBeDefined();
      expect(builder.constructor.name).toBe('ScopeContextBuilder');
    });
  });

  describe('TargetDisplayNameResolver Service Registration', () => {
    it('should have working implementation for ITargetDisplayNameResolver', () => {
      const resolver = container.resolve(tokens.ITargetDisplayNameResolver);
      expect(resolver).toBeDefined();
      expect(resolver.constructor.name).toBe('TargetDisplayNameResolver');
    });
  });

  describe('ServiceFactory Integration', () => {
    let factory;

    beforeEach(() => {
      factory = container.resolve(tokens.IPipelineServiceFactory);
    });

    it('should check service registration status', () => {
      // Infrastructure services should be registered and instantiatable
      expect(factory.hasService(tokens.IPipelineServiceFactory)).toBe(true);
      expect(factory.hasService(tokens.IPipelineServiceRegistry)).toBe(true);

      // Implemented services should be createable
      expect(factory.hasService(tokens.ITargetDependencyResolver)).toBe(true);
      expect(factory.hasService(tokens.ILegacyTargetCompatibilityLayer)).toBe(
        true
      );
      expect(factory.hasService(tokens.IScopeContextBuilder)).toBe(true);

      // All services are now implemented - no placeholders remain
      expect(factory.hasService(tokens.ITargetDisplayNameResolver)).toBe(true);
    });

    it('should create infrastructure services', () => {
      const registry = factory.createService(tokens.IPipelineServiceRegistry);
      expect(registry).toBeInstanceOf(ServiceRegistry);
    });

    it('should create implemented pipeline services', () => {
      const resolver = factory.createService(tokens.ITargetDependencyResolver);
      expect(resolver.constructor.name).toBe('TargetDependencyResolver');

      const layer = factory.createService(
        tokens.ILegacyTargetCompatibilityLayer
      );
      expect(layer.constructor.name).toBe('LegacyTargetCompatibilityLayer');

      const builder = factory.createService(tokens.IScopeContextBuilder);
      expect(builder.constructor.name).toBe('ScopeContextBuilder');
    });

    it('should successfully create TargetDisplayNameResolver service', () => {
      const resolver = factory.createService(tokens.ITargetDisplayNameResolver);
      expect(resolver).toBeDefined();
      expect(resolver.constructor.name).toBe('TargetDisplayNameResolver');
    });
  });

  describe('Container Token Registration', () => {
    it('should have all pipeline tokens registered', () => {
      const pipelineTokens = [
        'ITargetDependencyResolver', // Implemented service
        'ILegacyTargetCompatibilityLayer', // Implemented service
        'IScopeContextBuilder', // Implemented service
        'ITargetDisplayNameResolver', // Implemented service
        'IPipelineServiceFactory', // Infrastructure service
        'IPipelineServiceRegistry', // Infrastructure service
      ];

      for (const token of pipelineTokens) {
        expect(tokens[token]).toBeDefined();
        expect(typeof tokens[token]).toBe('string');
        expect(tokens[token]).toBe(token);
      }
    });
  });

  describe('Service Dependency Chain', () => {
    it('should resolve ServiceFactory with proper dependencies', () => {
      const factory = container.resolve(tokens.IPipelineServiceFactory);

      // Factory should have access to container and logger
      expect(factory.hasService(tokens.ILogger)).toBe(true);

      // Should be able to create other infrastructure services
      const registry = factory.createService(tokens.IPipelineServiceRegistry);
      expect(registry).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should provide clear error messages for placeholder services', () => {
      const errorMessages = {
        [tokens.ITargetDisplayNameResolver]: 'Ticket 06',
      };

      for (const [token, ticketRef] of Object.entries(errorMessages)) {
        try {
          container.resolve(token);
          expect.fail(`Expected error for ${token}`);
        } catch (error) {
          expect(error.message).toContain(ticketRef);
          expect(error.message).toContain('pending');
        }
      }
    });

    it('should successfully resolve implemented services', () => {
      // These services should resolve without errors
      expect(() =>
        container.resolve(tokens.ITargetDependencyResolver)
      ).not.toThrow();
      expect(() =>
        container.resolve(tokens.ILegacyTargetCompatibilityLayer)
      ).not.toThrow();
      expect(() =>
        container.resolve(tokens.IScopeContextBuilder)
      ).not.toThrow();
    });
  });

  describe('Service Registration Order', () => {
    it('should register services in correct order', () => {
      // Logger should be available (from infrastructure)
      const logger = container.resolve(tokens.ILogger);
      expect(logger).toBeDefined();

      // Infrastructure services should be available
      const factory = container.resolve(tokens.IPipelineServiceFactory);
      const registry = container.resolve(tokens.IPipelineServiceRegistry);

      expect(factory).toBeDefined();
      expect(registry).toBeDefined();
    });
  });
});
