/**
 * @file ServiceRegistration.test.js - Integration tests for pipeline service registration
 * 
 * Tests verify that pipeline services are properly registered in the DI container:
 * - TargetDependencyResolver and LegacyTargetCompatibilityLayer are fully implemented
 * - ScopeContextBuilder and TargetDisplayNameResolver remain as placeholders (Tickets 05/06)
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
  });

  describe('Placeholder Service Registration', () => {
    it('should have placeholder for IScopeContextBuilder', () => {
      expect(() => container.resolve(tokens.IScopeContextBuilder)).toThrow(
        'ScopeContextBuilder implementation pending (Ticket 05'
      );
    });

    it('should have placeholder for ITargetDisplayNameResolver', () => {
      expect(() =>
        container.resolve(tokens.ITargetDisplayNameResolver)
      ).toThrow('TargetDisplayNameResolver implementation pending (Ticket 06');
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
      expect(factory.hasService(tokens.ILegacyTargetCompatibilityLayer)).toBe(true);

      // Only these services have placeholders that throw on instantiation
      const placeholderServices = [
        tokens.IScopeContextBuilder,
        tokens.ITargetDisplayNameResolver,
      ];

      for (const token of placeholderServices) {
        expect(() => factory.createService(token)).toThrow(/pending \(Ticket/);
      }
    });

    it('should create infrastructure services', () => {
      const registry = factory.createService(tokens.IPipelineServiceRegistry);
      expect(registry).toBeInstanceOf(ServiceRegistry);
    });

    it('should create implemented pipeline services', () => {
      const resolver = factory.createService(tokens.ITargetDependencyResolver);
      expect(resolver.constructor.name).toBe('TargetDependencyResolver');

      const layer = factory.createService(tokens.ILegacyTargetCompatibilityLayer);
      expect(layer.constructor.name).toBe('LegacyTargetCompatibilityLayer');
    });

    it('should fail to create placeholder services', () => {
      expect(() =>
        factory.createService(tokens.IScopeContextBuilder)
      ).toThrow();
      
      expect(() =>
        factory.createService(tokens.ITargetDisplayNameResolver)
      ).toThrow();
    });
  });

  describe('Container Token Registration', () => {
    it('should have all pipeline tokens registered', () => {
      const pipelineTokens = [
        'ITargetDependencyResolver',        // Implemented service
        'ILegacyTargetCompatibilityLayer',  // Implemented service
        'IScopeContextBuilder',             // Placeholder (Ticket 05)
        'ITargetDisplayNameResolver',       // Placeholder (Ticket 06)
        'IPipelineServiceFactory',          // Infrastructure service
        'IPipelineServiceRegistry',         // Infrastructure service
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
        [tokens.IScopeContextBuilder]: 'Ticket 05',
        [tokens.ITargetDisplayNameResolver]: 'Ticket 06',
      };

      for (const [token, ticketRef] of Object.entries(errorMessages)) {
        try {
          container.resolve(token);
          fail(`Expected error for ${token}`);
        } catch (error) {
          expect(error.message).toContain(ticketRef);
          expect(error.message).toContain('pending');
        }
      }
    });

    it('should successfully resolve implemented services', () => {
      // These services should resolve without errors
      expect(() => container.resolve(tokens.ITargetDependencyResolver)).not.toThrow();
      expect(() => container.resolve(tokens.ILegacyTargetCompatibilityLayer)).not.toThrow();
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
