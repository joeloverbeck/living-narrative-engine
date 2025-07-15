/**
 * @file Integration test for anatomy-visualizer bootstrap process
 * @description Verifies that the anatomy visualizer bootstraps correctly without errors
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CommonBootstrapper } from '../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { registerVisualizerComponents } from '../../src/dependencyInjection/registrations/visualizerRegistrations.js';

describe('Anatomy Visualizer - Bootstrap Integration', () => {
  let bootstrapper;
  let originalDocument;
  let mockDocument;
  let consoleWarnSpy;
  let consoleErrorSpy;
  let originalSetTimeout;
  let originalSetInterval;

  beforeEach(() => {
    // Save original timers
    originalSetTimeout = global.setTimeout;
    originalSetInterval = global.setInterval;

    // Use fake timers to avoid JSDOM event issues
    jest.useFakeTimers();

    bootstrapper = new CommonBootstrapper();

    // Create mock document
    mockDocument = {
      querySelector: jest.fn(() => null),
      createElement: jest.fn((tag) => ({
        tagName: tag.toUpperCase(),
        setAttribute: jest.fn(),
        addEventListener: jest.fn(),
        appendChild: jest.fn(),
        style: {},
      })),
      getElementById: jest.fn(() => null),
    };

    // Save original document and replace with mock
    originalDocument = global.document;
    global.document = mockDocument;

    // Mock fetch to prevent network requests
    global.fetch = jest.fn().mockImplementation((url) => {
      // Mock game data response
      if (url.includes('game.json')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              name: 'Test Game',
              mods: ['core'],
            }),
        });
      }
      // Default mock response for other requests
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    // Spy on console methods to check for warnings/errors
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    // Restore original document
    global.document = originalDocument;

    // Restore fetch
    delete global.fetch;

    // Restore console methods
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    // Restore real timers
    jest.useRealTimers();
    global.setTimeout = originalSetTimeout;
    global.setInterval = originalSetInterval;
  });

  it('should bootstrap without double initialization warning', async () => {
    let postInitHookCalled = false;

    // Bootstrap with minimal config (similar to anatomy-visualizer.js)
    const result = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      skipModLoading: true, // Skip mod loading for tests
      postInitHook: async (services, container) => {
        postInitHookCalled = true;
        // Register visualizer components
        registerVisualizerComponents(container);
      },
    });

    // Verify bootstrap succeeded
    expect(result).toBeDefined();
    expect(result.container).toBeDefined();
    expect(result.services).toBeDefined();
    expect(postInitHookCalled).toBe(true);

    // Verify no "Already initialized" warning
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(
        'AnatomyInitializationService: Already initialized'
      )
    );
  });

  it('should register all required dependencies for VisualizationComposer', async () => {
    let container;
    let visualizationComposer;

    // Bootstrap with visualizer components
    await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      skipModLoading: true, // Skip mod loading for tests
      postInitHook: async (services, containerInstance) => {
        container = containerInstance;
        // Register visualizer components
        registerVisualizerComponents(container);

        // Try to resolve VisualizationComposer
        visualizationComposer = container.resolve(tokens.VisualizationComposer);
      },
    });

    // Verify VisualizationComposer was created successfully
    expect(visualizationComposer).toBeDefined();
    expect(typeof visualizationComposer.initialize).toBe('function');
    expect(typeof visualizationComposer.renderGraph).toBe('function');

    // Verify no errors about missing IDocumentContext
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(
        'No service registered for key "IDocumentContext"'
      )
    );
  });

  it('should initialize AnatomyInitializationService only once', async () => {
    let anatomyInitService;
    const initializeCalls = [];

    await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      skipModLoading: true, // Skip mod loading for tests
      postInitHook: async (services, container) => {
        // Get the AnatomyInitializationService
        anatomyInitService = container.resolve(
          tokens.AnatomyInitializationService
        );

        // Spy on its initialize method
        const originalInitialize =
          anatomyInitService.initialize.bind(anatomyInitService);
        anatomyInitService.initialize = jest.fn(() => {
          initializeCalls.push(new Date().toISOString());
          return originalInitialize();
        });
      },
    });

    // The service should have been initialized by SystemInitializer
    // Check that initialize was called (by checking internal state or effects)
    // Since we can't easily spy on it before initialization, check for no warnings
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(
        'AnatomyInitializationService: Already initialized'
      )
    );

    // If we manually call initialize again, it should warn
    if (anatomyInitService && anatomyInitService.initialize) {
      anatomyInitService.initialize();
      // Now it should have warned
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'AnatomyInitializationService: Already initialized'
        )
      );
    }
  });

  it('should successfully create all visualizer UI components', async () => {
    const resolvedComponents = {};

    await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      skipModLoading: true, // Skip mod loading for tests
      postInitHook: async (services, container) => {
        // Register visualizer components
        registerVisualizerComponents(container);

        // Resolve key components needed for AnatomyVisualizerUI
        resolvedComponents.anatomyDescriptionService = container.resolve(
          tokens.AnatomyDescriptionService
        );
        resolvedComponents.visualizerStateController = container.resolve(
          tokens.VisualizerStateController
        );
        resolvedComponents.visualizationComposer = container.resolve(
          tokens.VisualizationComposer
        );
      },
    });

    // Verify all components were resolved successfully
    expect(resolvedComponents.anatomyDescriptionService).toBeDefined();
    expect(resolvedComponents.visualizerStateController).toBeDefined();
    expect(resolvedComponents.visualizationComposer).toBeDefined();

    // Verify no errors during resolution
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Failed to create instance')
    );
  });

  it('should handle missing document gracefully', async () => {
    // Remove document entirely
    delete global.document;

    try {
      await bootstrapper.bootstrap({
        containerConfigType: 'minimal',
        worldName: 'default',
        includeAnatomyFormatting: true,
        skipModLoading: true, // Skip mod loading for tests
        postInitHook: async (_, container) => {
          registerVisualizerComponents(container);

          // Should still be able to resolve components
          const documentContext = container.resolve(tokens.IDocumentContext);
          expect(documentContext).toBeDefined();

          // But operations should handle missing document
          const result = documentContext.query('#test');
          expect(result).toBeNull();
        },
      });
    } finally {
      // Restore mock document
      global.document = mockDocument;
    }
  });
});
