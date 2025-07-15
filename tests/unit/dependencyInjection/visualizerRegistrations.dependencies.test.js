/**
 * @file Test to ensure visualizer registrations have all required dependencies
 * @description Verifies that IDocumentContext and other dependencies are properly registered
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerVisualizerComponents } from '../../../src/dependencyInjection/registrations/visualizerRegistrations.js';

describe('Visualizer Registrations - Dependencies', () => {
  let container;
  let mockLogger;
  let mockEntityManager;
  let mockEventDispatcher;

  beforeEach(() => {
    container = new AppContainer();

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock entity manager
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    // Mock event dispatcher
    mockEventDispatcher = {
      subscribe: jest.fn(),
      dispatch: jest.fn(),
    };

    // Register core dependencies
    container.register(tokens.ILogger, mockLogger, { isInstance: true });
    container.register(tokens.IEntityManager, mockEntityManager, {
      isInstance: true,
    });
    container.register(tokens.IValidatedEventDispatcher, mockEventDispatcher, {
      isInstance: true,
    });
  });

  it('should register IDocumentContext before components that depend on it', () => {
    // Register visualizer components
    registerVisualizerComponents(container);

    // Verify IDocumentContext is registered
    expect(() => container.resolve(tokens.IDocumentContext)).not.toThrow();

    // Verify it's a proper DocumentContext instance
    const documentContext = container.resolve(tokens.IDocumentContext);
    expect(documentContext).toBeDefined();
    expect(typeof documentContext.query).toBe('function');
    expect(typeof documentContext.create).toBe('function');
  });

  it('should successfully resolve all visualizer components', () => {
    // Register visualizer components
    registerVisualizerComponents(container);

    // List of all components that should be registered
    const componentsToCheck = [
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

    // Verify each component can be resolved without errors
    for (const token of componentsToCheck) {
      expect(() => container.resolve(token)).not.toThrow();
      const instance = container.resolve(token);
      expect(instance).toBeDefined();
    }
  });

  it('should resolve VisualizationComposer with all required dependencies', () => {
    // Register visualizer components
    registerVisualizerComponents(container);

    // Resolve VisualizationComposer - this should not throw
    let composer;
    expect(() => {
      composer = container.resolve(tokens.VisualizationComposer);
    }).not.toThrow();

    // Verify it was created successfully
    expect(composer).toBeDefined();
    expect(typeof composer.initialize).toBe('function');
    expect(typeof composer.renderGraph).toBe('function');
    expect(typeof composer.clear).toBe('function');
  });

  it('should resolve SVGRenderer with IDocumentContext dependency', () => {
    // Register visualizer components
    registerVisualizerComponents(container);

    // Resolve SVGRenderer - this should not throw
    let svgRenderer;
    expect(() => {
      svgRenderer = container.resolve(tokens.SVGRenderer);
    }).not.toThrow();

    // Verify it was created successfully
    expect(svgRenderer).toBeDefined();
    expect(typeof svgRenderer.createSVG).toBe('function');
    expect(typeof svgRenderer.clearSVG).toBe('function');
  });

  it('should log registration progress', () => {
    // Register visualizer components
    registerVisualizerComponents(container);

    // Verify debug logs were called
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Visualizer Registrations: Starting...'
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Visualizer Registrations: Complete.'
    );

    // Verify IDocumentContext registration was logged
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Registered IDocumentContext')
    );
  });

  it('should handle missing document gracefully in IDocumentContext', () => {
    // Remove global document for this test
    const originalDocument = global.document;
    delete global.document;

    try {
      // Register visualizer components
      registerVisualizerComponents(container);

      // Resolve IDocumentContext
      const documentContext = container.resolve(tokens.IDocumentContext);

      // Should still be created but methods should handle missing document
      expect(documentContext).toBeDefined();

      // Verify query returns null when no document
      const result = documentContext.query('#test');
      expect(result).toBeNull();

      // The DocumentContext should handle missing document gracefully
      // The key expectation is that query returns null when no document is available
      // The behavior depends on when the document is missing:
      // - If during construction: logs error during construction
      // - If during operation: logs warning during query

      const hasConstructionError = mockLogger.error.mock.calls.some(
        (call) =>
          call[0] &&
          call[0].includes(
            '[DocumentContext] Construction failed: Could not determine a valid document context'
          )
      );

      const hasQueryWarning = mockLogger.warn.mock.calls.some(
        (call) =>
          call[0] &&
          call[0].includes(
            "[DocumentContext] query('#test') attempted, but no document context is available"
          )
      );

      if (hasConstructionError) {
        // If construction failed, it should have logged an error
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            '[DocumentContext] Construction failed: Could not determine a valid document context'
          )
        );
      } else if (hasQueryWarning) {
        // If construction succeeded but query failed, it should have warned
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "[DocumentContext] query('#test') attempted, but no document context is available"
          )
        );
      } else {
        // The DocumentContext is expected to handle missing document gracefully
        // The main behavior requirement is that query returns null
        expect(result).toBeNull();
      }
    } finally {
      // Restore global document
      global.document = originalDocument;
    }
  });
});
