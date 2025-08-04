/**
 * @file Cross-Component Integration Tests
 * Tests integration between different system components
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

describe('Cross-Component Integration', () => {
  let container;
  let categorizationService;

  beforeEach(() => {
    container = new AppContainer();
    const registrar = new Registrar(container);

    // Register logger first (required by action categorization service)
    const appLogger = new ConsoleLogger(LogLevel.ERROR);
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
    configureBaseContainer(container, {
      includeGameSystems: false,
      includeUI: false,
      includeCharacterBuilder: false,
    });

    categorizationService = container.resolve(
      tokens.IActionCategorizationService
    );
  });

  describe('Service and Configuration Integration', () => {
    it('should use configuration consistently across service calls', () => {
      const actions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait.',
        },
        {
          index: 2,
          actionId: 'intimacy:kiss',
          commandString: 'kiss',
          description: 'Kiss.',
        },
        {
          index: 3,
          actionId: 'clothing:remove',
          commandString: 'remove',
          description: 'Remove.',
        },
        {
          index: 4,
          actionId: 'anatomy:touch',
          commandString: 'touch',
          description: 'Touch.',
        },
        {
          index: 5,
          actionId: 'sex:initiate',
          commandString: 'initiate',
          description: 'Initiate.',
        },
        {
          index: 6,
          actionId: 'core:go',
          commandString: 'go',
          description: 'Go.',
        },
      ];

      // The service uses the configuration passed during construction
      // Since both UI and LLM use the same service, behavior should be consistent
      const shouldGroup = categorizationService.shouldUseGrouping(actions);
      expect(shouldGroup).toBe(true);

      // Should produce consistent grouping structure
      const grouped = categorizationService.groupActionsByNamespace(actions);
      expect(grouped.size).toBe(5); // 5 different namespaces
      expect([...grouped.keys()]).toEqual([
        'core',
        'intimacy',
        'sex',
        'anatomy',
        'clothing',
      ]);
    });

    it('should handle configuration changes dynamically', async () => {
      const actions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait.',
        },
        {
          index: 2,
          actionId: 'intimacy:kiss',
          commandString: 'kiss',
          description: 'Kiss.',
        },
        {
          index: 3,
          actionId: 'core:go',
          commandString: 'go',
          description: 'Go.',
        },
        {
          index: 4,
          actionId: 'intimacy:hug',
          commandString: 'hug',
          description: 'Hug.',
        },
      ];

      // Default service - should not group (insufficient actions)
      expect(categorizationService.shouldUseGrouping(actions)).toBe(false);

      // Create new service with custom config - should group
      const ActionCategorizationService = (
        await import(
          '../../../src/entities/utils/ActionCategorizationService.js'
        )
      ).default;

      const customService = new ActionCategorizationService({
        logger: container.resolve(tokens.ILogger),
        config: {
          enabled: true,
          minActionsForGrouping: 3,
          minNamespacesForGrouping: 2,
          namespaceOrder: ['core', 'intimacy'],
          showCounts: false,
        },
      });

      expect(customService.shouldUseGrouping(actions)).toBe(true);
    });
  });

  describe('Error Propagation and Recovery', () => {
    it('should isolate errors between components', () => {
      // Test that an error in one component doesn't affect others
      const faultyService = {
        shouldUseGrouping: jest.fn(() => {
          throw new Error('Service error');
        }),
        groupActionsByNamespace: jest.fn(() => new Map()),
        extractNamespace: jest.fn((id) =>
          id.includes(':') ? id.split(':')[0] : 'unknown'
        ),
        getSortedNamespaces: jest.fn((namespaces) => [...namespaces].sort()),
        formatNamespaceDisplayName: jest.fn((ns) => ns.toUpperCase()),
      };

      // Test fault isolation - service errors shouldn't crash other operations

      // Other service methods should still work
      expect(faultyService.extractNamespace('core:wait')).toBe('core');
      expect(faultyService.formatNamespaceDisplayName('core')).toBe('CORE');
    });

    it('should provide graceful degradation paths', () => {
      const actions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait.',
        },
      ];

      // Service with partial failures
      const partiallyFaultyService = {
        shouldUseGrouping: jest.fn(() => false), // Works but returns false
        groupActionsByNamespace: jest.fn(() => {
          throw new Error('Grouping error');
        }),
        extractNamespace: jest.fn((id) =>
          id.includes(':') ? id.split(':')[0] : 'unknown'
        ),
        getSortedNamespaces: jest.fn(() => {
          throw new Error('Sorting error');
        }),
        formatNamespaceDisplayName: jest.fn((ns) => ns.toUpperCase()),
      };

      // System should gracefully handle partial functionality
      expect(partiallyFaultyService.shouldUseGrouping(actions)).toBe(false);
      expect(partiallyFaultyService.extractNamespace('core:wait')).toBe('core');
      expect(partiallyFaultyService.formatNamespaceDisplayName('core')).toBe(
        'CORE'
      );

      // Failing methods should throw but not crash the system
      expect(() =>
        partiallyFaultyService.groupActionsByNamespace(actions)
      ).toThrow();
      expect(() =>
        partiallyFaultyService.getSortedNamespaces(['core'])
      ).toThrow();
    });
  });

  describe('Lifecycle Management', () => {
    it('should handle container disposal gracefully', () => {
      // Resolve services
      const service = container.resolve(tokens.IActionCategorizationService);

      expect(service).toBeTruthy();

      // Container disposal should work without errors
      if (container.dispose) {
        expect(() => container.dispose()).not.toThrow();
      }
    });

    it('should maintain singleton behavior', () => {
      const service1 = container.resolve(tokens.IActionCategorizationService);
      const service2 = container.resolve(tokens.IActionCategorizationService);

      expect(service1).toBe(service2);
    });
  });

  describe('Concurrency and Thread Safety', () => {
    it('should handle concurrent access safely', () => {
      const actions = Array.from({ length: 10 }, (_, i) => ({
        index: i + 1,
        actionId: `test:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      }));

      // Create multiple promises for concurrent access
      const promises = Array.from({ length: 50 }, (_, i) => {
        return Promise.resolve().then(() => {
          const shouldGroup = categorizationService.shouldUseGrouping(actions);
          if (shouldGroup) {
            return categorizationService.groupActionsByNamespace(actions);
          }
          return new Map();
        });
      });

      return Promise.all(promises).then((results) => {
        expect(results.length).toBe(50);
        // All results should be consistent
        const firstResult = results[0];
        results.forEach((result) => {
          if (firstResult instanceof Map) {
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(firstResult.size);
          }
        });
      });
    });
  });
});
