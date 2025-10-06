/**
 * @file Action Categorization Dependency Injection Integration Tests
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../src/utils/registrarHelpers.js';
import ActionCategorizationService from '../../src/entities/utils/ActionCategorizationService.js';
import ConsoleLogger, { LogLevel } from '../../src/logging/consoleLogger.js';

describe('Action Categorization Dependency Injection Integration', () => {
  let container;

  beforeEach(async () => {
    container = new AppContainer();
    const registrar = new Registrar(container);

    // Register logger first (required by action categorization service)
    const appLogger = new ConsoleLogger(LogLevel.ERROR); // Use ERROR level to reduce noise
    registrar.instance(tokens.ILogger, appLogger);

    // Register required dependencies for base container
    container.register(
      tokens.ISafeEventDispatcher,
      { dispatch: jest.fn() },
      { lifecycle: 'singleton' }
    );

    container.register(
      tokens.IValidatedEventDispatcher,
      { dispatch: jest.fn() },
      { lifecycle: 'singleton' }
    );

    // Configure base container which includes action categorization
    await configureBaseContainer(container, {
      includeGameSystems: false, // Minimal setup for testing
      includeUI: false,
      includeCharacterBuilder: false,
    });
  });

  afterEach(() => {
    if (container && typeof container.reset === 'function') {
      container.reset();
    }
    container = null;
  });

  describe('Service Registration', () => {
    it('should register ActionCategorizationService', () => {
      expect(container.isRegistered(tokens.IActionCategorizationService)).toBe(
        true
      );
    });

    it('should resolve ActionCategorizationService successfully', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ActionCategorizationService);
      expect(service).toHaveProperty('extractNamespace');
      expect(service).toHaveProperty('shouldUseGrouping');
      expect(service).toHaveProperty('groupActionsByNamespace');
      expect(service).toHaveProperty('getSortedNamespaces');
      expect(service).toHaveProperty('formatNamespaceDisplayName');
    });

    it('should return same instance for singleton services', () => {
      const service1 = container.resolve(tokens.IActionCategorizationService);
      const service2 = container.resolve(tokens.IActionCategorizationService);

      expect(service1).toBe(service2);
    });
  });

  describe('Service Dependencies', () => {
    it('should inject logger into services', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      // Test that logger is working by calling a method that logs
      expect(() => service.extractNamespace('invalid')).not.toThrow();
    });

    it('should handle missing dependencies gracefully', () => {
      // Create empty container without logger
      const emptyContainer = new AppContainer();

      expect(() => {
        emptyContainer.register(
          tokens.IActionCategorizationService,
          () =>
            new ActionCategorizationService({
              logger: emptyContainer.resolve(tokens.ILogger), // This should fail
            }),
          { lifecycle: 'singleton' }
        );
        emptyContainer.resolve(tokens.IActionCategorizationService);
      }).toThrow();
    });
  });

  describe('Service Functionality Integration', () => {
    it('should categorize actions correctly through DI', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      // Create enough actions to trigger grouping (default threshold is 6 actions, 2 namespaces)
      const actions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait',
        },
        {
          index: 2,
          actionId: 'kissing:kiss',
          commandString: 'kiss',
          description: 'Kiss',
        },
        {
          index: 3,
          actionId: 'movement:go',
          commandString: 'go',
          description: 'Go',
        },
        {
          index: 4,
          actionId: 'core:look',
          commandString: 'look',
          description: 'Look',
        },
        {
          index: 5,
          actionId: 'affection:hug',
          commandString: 'hug',
          description: 'Hug',
        },
        {
          index: 6,
          actionId: 'core:inventory',
          commandString: 'inventory',
          description: 'Check inventory',
        },
      ];

      // Note: Service uses internal configuration, so no config parameter needed
      expect(service.shouldUseGrouping(actions)).toBe(true);

      const grouped = service.groupActionsByNamespace(actions);
      expect(grouped.size).toBe(4);
      expect(grouped.has('core')).toBe(true);
      expect(grouped.has('kissing')).toBe(true);
      expect(grouped.has('affection')).toBe(true);
      expect(grouped.has('movement')).toBe(true);
      expect(grouped.get('core')).toHaveLength(3);
      expect(grouped.get('kissing')).toHaveLength(1);
      expect(grouped.get('affection')).toHaveLength(1);
      expect(grouped.get('movement')).toHaveLength(1);
    });

    it('should handle service method failures gracefully', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      // Test with invalid inputs - should not throw
      expect(() => service.extractNamespace(null)).not.toThrow();
      expect(() => service.shouldUseGrouping(null)).not.toThrow();
      expect(() => service.groupActionsByNamespace(null)).not.toThrow();
    });

    it('should extract namespaces correctly', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      expect(service.extractNamespace('core:wait')).toBe('core');
      expect(service.extractNamespace('kissing:kiss')).toBe('kissing');
      expect(service.extractNamespace('invalid')).toBe('unknown');
      expect(service.extractNamespace('none')).toBe('none');
      expect(service.extractNamespace('self')).toBe('self');
    });

    it('should format namespace display names correctly', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      expect(service.formatNamespaceDisplayName('core')).toBe('CORE');
      expect(service.formatNamespaceDisplayName('kissing')).toBe('KISSING');
      expect(service.formatNamespaceDisplayName('unknown')).toBe('OTHER');
      expect(service.formatNamespaceDisplayName('')).toBe('UNKNOWN');
      expect(service.formatNamespaceDisplayName(null)).toBe('UNKNOWN');
    });

    it('should sort namespaces correctly', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      const namespaces = ['unknown', 'core', 'kissing', 'custom'];
      const sorted = service.getSortedNamespaces(namespaces);

      // 'core' should come first (priority order), then alphabetical
      expect(sorted[0]).toBe('core');
      expect(sorted.includes('unknown')).toBe(true);
      expect(sorted.includes('kissing')).toBe(true);
      expect(sorted.includes('custom')).toBe(true);
    });
  });

  describe('Memory Management', () => {
    it('should not create memory leaks', () => {
      const services = [];

      // Resolve service multiple times
      for (let i = 0; i < 100; i++) {
        services.push(container.resolve(tokens.IActionCategorizationService));
      }

      // All should be the same instance (singleton)
      expect(services.every((service) => service === services[0])).toBe(true);
    });

    it('should dispose resources properly', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      expect(service).toBeDefined();

      // Container disposal should not throw
      expect(() => {
        if (container.reset) {
          container.reset();
        }
      }).not.toThrow();
    });
  });

  describe('Configuration Integration', () => {
    it('should use default configuration', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      // Test behavior with minimal actions (below default threshold)
      const minimalActions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait',
        },
      ];

      // Should not use grouping with minimal actions
      expect(service.shouldUseGrouping(minimalActions)).toBe(false);
    });

    it('should handle various action configurations', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      // Test with sufficient actions to trigger grouping
      const multipleActions = [];
      for (let i = 0; i < 10; i++) {
        multipleActions.push({
          index: i + 1,
          actionId: `mod${i % 3}:action${i}`,
          commandString: `action${i}`,
          description: `Action ${i}`,
        });
      }

      expect(service.shouldUseGrouping(multipleActions)).toBe(true);

      const grouped = service.groupActionsByNamespace(multipleActions);
      expect(grouped.size).toBe(3); // mod0, mod1, mod2
    });
  });

  describe('Error Handling', () => {
    it('should handle container resolution errors gracefully', () => {
      const service = container.resolve(tokens.IActionCategorizationService);
      expect(service).toBeDefined();

      // Service should handle various error conditions internally
      expect(() => service.shouldUseGrouping(undefined)).not.toThrow();
      expect(() => service.groupActionsByNamespace(undefined)).not.toThrow();
      expect(() => service.getSortedNamespaces(undefined)).not.toThrow();
    });

    it('should maintain service integrity after errors', () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      // Trigger error conditions
      service.extractNamespace(null);
      service.shouldUseGrouping(null);
      service.groupActionsByNamespace(null);

      // Service should still work correctly after errors
      expect(service.extractNamespace('core:test')).toBe('core');
      expect(service.formatNamespaceDisplayName('test')).toBe('TEST');
    });
  });
});
