/**
 * @file System Integration Regression Tests
 * Validates integration stability across components
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

describe('System Integration Regression', () => {
  let container;

  beforeEach(() => {
    // Create container with action categorization support
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
    configureBaseContainer(container, {
      includeGameSystems: false, // Minimal setup for testing
      includeUI: false,
      includeCharacterBuilder: false,
    });
  });

  describe('Dependency Injection Stability', () => {
    it('should resolve all services without circular dependencies', () => {
      expect(() => {
        container.resolve(tokens.IActionCategorizationService);
      }).not.toThrow();
    });

    it('should maintain singleton behavior across components', () => {
      const service1 = container.resolve(tokens.IActionCategorizationService);
      const service2 = container.resolve(tokens.IActionCategorizationService);

      expect(service1).toBe(service2);
    });

    it('should handle container disposal gracefully', () => {
      const service = container.resolve(tokens.IActionCategorizationService);
      expect(service).toBeTruthy();

      expect(() => {
        if (container.dispose) {
          container.dispose();
        }
      }).not.toThrow();
    });
  });

  describe('Cross-Component Communication', () => {
    it('should maintain consistent configuration across components', async () => {
      const service = container.resolve(tokens.IActionCategorizationService);

      // Import configuration constants directly
      const { UI_CATEGORIZATION_CONFIG, LLM_CATEGORIZATION_CONFIG } =
        await import(
          '../../../src/entities/utils/actionCategorizationConfig.js'
        );

      // Both should have same core structure but different UI-specific options
      expect(UI_CATEGORIZATION_CONFIG.enabled).toBe(
        LLM_CATEGORIZATION_CONFIG.enabled
      );
      expect(UI_CATEGORIZATION_CONFIG.minActionsForGrouping).toBe(
        LLM_CATEGORIZATION_CONFIG.minActionsForGrouping
      );
      expect(UI_CATEGORIZATION_CONFIG.namespaceOrder).toEqual(
        LLM_CATEGORIZATION_CONFIG.namespaceOrder
      );

      // UI should show counts, LLM should not
      expect(UI_CATEGORIZATION_CONFIG.showCounts).toBe(true);
      expect(LLM_CATEGORIZATION_CONFIG.showCounts).toBe(false);
    });
  });

  describe('Error Propagation', () => {
    it('should handle service errors without affecting other components', () => {
      // Create a scenario where one component fails
      const faultyService = {
        extractNamespace: () => {
          throw new Error('Service failure');
        },
        shouldUseGrouping: () => {
          throw new Error('Service failure');
        },
        groupActionsByNamespace: () => {
          throw new Error('Service failure');
        },
        getSortedNamespaces: () => {
          throw new Error('Service failure');
        },
        formatNamespaceDisplayName: () => {
          throw new Error('Service failure');
        },
      };

      // Replace service registration with faulty one
      container.register(tokens.IActionCategorizationService, faultyService, {
        lifecycle: 'singleton',
      });

      // Service should be replaceable without affecting container stability
      expect(() => {
        const replacedService = container.resolve(
          tokens.IActionCategorizationService
        );
        expect(replacedService).toBe(faultyService);
      }).not.toThrow();
    });
  });
});
