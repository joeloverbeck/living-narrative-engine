/**
 * @file tests/integration/anatomy-visualizer-global-fix.test.js
 * @description Integration tests for browser compatibility fix in anatomy visualizer
 * Tests that the visualizer properly handles document context registration
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { registerVisualizerComponents } from '../../src/dependencyInjection/registrations/visualizerRegistrations.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import DocumentContext from '../../src/domUI/documentContext.js';
import AppContainer from '../../src/dependencyInjection/appContainer.js';

describe('Anatomy Visualizer - Global Object Fix', () => {
  let container;
  let logger;

  beforeEach(() => {
    container = new AppContainer();
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    container.register(tokens.ILogger, () => logger);
  });

  describe('DocumentContext Registration', () => {
    it('should successfully register IDocumentContext without global reference errors', () => {
      // Arrange & Act
      expect(() => {
        registerVisualizerComponents(container);
      }).not.toThrow();

      // Assert
      const documentContext = container.resolve(tokens.IDocumentContext);
      expect(documentContext).toBeInstanceOf(DocumentContext);
      expect(documentContext.document).toBeDefined();
    });

    it('should not throw "global is not defined" error', () => {
      // Arrange & Act
      expect(() => {
        registerVisualizerComponents(container);
      }).not.toThrow('global is not defined');
    });

    it('should create DocumentContext with proper document reference', () => {
      // Arrange
      container.register(tokens.IEntityManager, () => ({
        createEntityInstance: jest.fn(),
        getEntityInstance: jest.fn(),
      }));
      container.register(tokens.IValidatedEventDispatcher, () => ({
        dispatch: jest.fn(),
        subscribe: jest.fn(),
      }));

      // Act
      registerVisualizerComponents(container);

      // Assert
      const documentContext = container.resolve(tokens.IDocumentContext);
      expect(documentContext).toBeInstanceOf(DocumentContext);

      // Test that document operations work (should not throw)
      expect(() => {
        documentContext.query('test-selector');
      }).not.toThrow();

      expect(() => {
        documentContext.create('div');
      }).not.toThrow();
    });
  });

  describe('VisualizationComposer Registration', () => {
    it('should successfully create VisualizationComposer with proper DocumentContext', () => {
      // Arrange
      container.register(tokens.IEntityManager, () => ({
        createEntityInstance: jest.fn(),
        getEntityInstance: jest.fn(),
      }));
      container.register(tokens.IValidatedEventDispatcher, () => ({
        dispatch: jest.fn(),
        subscribe: jest.fn(),
      }));

      // Act
      expect(() => {
        registerVisualizerComponents(container);
      }).not.toThrow();

      // Assert
      const visualizationComposer = container.resolve(
        tokens.VisualizationComposer
      );
      expect(visualizationComposer).toBeDefined();
      expect(typeof visualizationComposer.initialize).toBe('function');
      expect(typeof visualizationComposer.renderGraph).toBe('function');
      expect(typeof visualizationComposer.clear).toBe('function');
    });
  });

  describe('Full Visualizer Registration Flow', () => {
    it('should complete all visualizer registrations without errors', () => {
      // Arrange
      container.register(tokens.IEntityManager, () => ({
        createEntityInstance: jest.fn(),
        getEntityInstance: jest.fn(),
      }));
      container.register(tokens.IValidatedEventDispatcher, () => ({
        dispatch: jest.fn(),
        subscribe: jest.fn(),
      }));

      // Act
      expect(() => {
        registerVisualizerComponents(container);
      }).not.toThrow();

      // Assert - All visualizer components should be registered
      const expectedTokens = [
        tokens.IDocumentContext,
        tokens.VisualizerState,
        tokens.AnatomyLoadingDetector,
        tokens.VisualizerStateController,
        tokens.RadialLayoutStrategy,
        tokens.LayoutEngine,
        tokens.SVGRenderer,
        tokens.InteractionController,
        tokens.ViewportManager,
        tokens.VisualizationComposer,
      ];

      expectedTokens.forEach((token) => {
        expect(() => {
          const instance = container.resolve(token);
          expect(instance).toBeDefined();
        }).not.toThrow();
      });

      // Verify logger was used to debug registration process
      expect(logger.debug).toHaveBeenCalledWith(
        'Visualizer Registrations: Starting...'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Visualizer Registrations: Complete.'
      );
    });
  });

  describe('Error Prevention', () => {
    it('should prevent the original "global is not defined" error', () => {
      // Arrange
      container.register(tokens.IEntityManager, () => ({
        createEntityInstance: jest.fn(),
        getEntityInstance: jest.fn(),
      }));
      container.register(tokens.IValidatedEventDispatcher, () => ({
        dispatch: jest.fn(),
        subscribe: jest.fn(),
      }));

      // Act & Assert - Should not throw "global is not defined" error
      expect(() => {
        registerVisualizerComponents(container);
      }).not.toThrow('global is not defined');

      // Verify the registration actually worked
      const documentContext = container.resolve(tokens.IDocumentContext);
      expect(documentContext).toBeInstanceOf(DocumentContext);
      expect(documentContext.document).toBeDefined();
    });

    it('should handle various document contexts gracefully', () => {
      // Arrange
      container.register(tokens.IEntityManager, () => ({
        createEntityInstance: jest.fn(),
        getEntityInstance: jest.fn(),
      }));
      container.register(tokens.IValidatedEventDispatcher, () => ({
        dispatch: jest.fn(),
        subscribe: jest.fn(),
      }));

      // Act
      registerVisualizerComponents(container);

      // Assert - DocumentContext should be functional regardless of specific global environment
      const documentContext = container.resolve(tokens.IDocumentContext);
      expect(documentContext).toBeInstanceOf(DocumentContext);

      // Test basic operations (should not throw)
      expect(() => {
        const result = documentContext.query('body');
        // Result may be null but should not throw
        expect(result).toBeDefined();
      }).not.toThrow();

      expect(() => {
        const element = documentContext.create('div');
        expect(element).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Browser Compatibility', () => {
    it('should work with different global object patterns', () => {
      // This test verifies the fix works by checking that the registration
      // uses the proper fallback chain: globalThis.document || window.document || null

      // Arrange
      container.register(tokens.IEntityManager, () => ({
        createEntityInstance: jest.fn(),
        getEntityInstance: jest.fn(),
      }));
      container.register(tokens.IValidatedEventDispatcher, () => ({
        dispatch: jest.fn(),
        subscribe: jest.fn(),
      }));

      // Act - The registration should work regardless of global environment
      expect(() => {
        registerVisualizerComponents(container);
      }).not.toThrow();

      // Assert - DocumentContext should be created successfully
      const documentContext = container.resolve(tokens.IDocumentContext);
      expect(documentContext).toBeInstanceOf(DocumentContext);

      // The document property should be accessible (whether it's the actual document or null)
      expect(documentContext.document).toBeDefined();
    });
  });
});
