/**
 * @file Integration test for anatomy visualizer bootstrap process
 * Tests the fix for VisualizerStateController registration issue
 * @see src/anatomy-visualizer.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CommonBootstrapper } from '../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { JSDOM } from 'jsdom';

describe('Anatomy Visualizer - Bootstrap Integration', () => {
  let dom;
  let cleanup;

  beforeEach(() => {
    // Setup DOM environment
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="entity-selector"></div>
          <div id="anatomy-graph-container"></div>
          <div id="entity-description-content"></div>
          <button id="back-button">Back</button>
        </body>
      </html>
    `,
      {
        url: 'http://localhost',
        pretendToBeVisual: true,
      }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
  });

  afterEach(() => {
    // Clean up DOM
    if (cleanup) {
      cleanup();
    }
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  it('should successfully register and resolve VisualizerStateController with minimal configuration', async () => {
    // This test verifies the fix for the "No service registered for key VisualizerStateController" error

    const bootstrapper = new CommonBootstrapper();
    let resolvedVisualizerStateController = null;
    let resolvedAnatomyDescriptionService = null;
    let registrationsCalled = false;

    const { container, services } = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      skipModLoading: true,
      postInitHook: async (services, container) => {
        // Import and call registerVisualizerComponents
        const { registerVisualizerComponents } = await import(
          '../../src/dependencyInjection/registrations/visualizerRegistrations.js'
        );

        registrationsCalled = true;
        registerVisualizerComponents(container);

        // Try to resolve the services that anatomy-visualizer.js needs
        resolvedAnatomyDescriptionService = container.resolve(
          tokens.AnatomyDescriptionService
        );
        resolvedVisualizerStateController = container.resolve(
          tokens.VisualizerStateController
        );
      },
    });

    // Store cleanup function
    cleanup = bootstrapper.cleanup?.bind(bootstrapper);

    // Assert that registrations were called
    expect(registrationsCalled).toBe(true);

    // Assert that services were successfully resolved
    expect(resolvedAnatomyDescriptionService).toBeDefined();
    expect(resolvedAnatomyDescriptionService).not.toBeNull();

    expect(resolvedVisualizerStateController).toBeDefined();
    expect(resolvedVisualizerStateController).not.toBeNull();

    // Verify the resolved controller has expected methods
    expect(typeof resolvedVisualizerStateController.selectEntity).toBe(
      'function'
    );
    expect(typeof resolvedVisualizerStateController.handleError).toBe(
      'function'
    );
    expect(typeof resolvedVisualizerStateController.reset).toBe('function');
  });

  it('should fail to resolve VisualizerStateController without registerVisualizerComponents', async () => {
    // This test verifies that without the fix, the error would occur

    const bootstrapper = new CommonBootstrapper();
    let errorThrown = null;

    const { container, services } = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      skipModLoading: true,
      postInitHook: async (services, container) => {
        // Try to resolve VisualizerStateController WITHOUT calling registerVisualizerComponents
        try {
          container.resolve(tokens.VisualizerStateController);
        } catch (error) {
          errorThrown = error;
        }
      },
    });

    // Store cleanup function
    cleanup = bootstrapper.cleanup?.bind(bootstrapper);

    // Assert that the expected error was thrown
    expect(errorThrown).toBeDefined();
    expect(errorThrown.message).toContain(
      'No service registered for key "VisualizerStateController"'
    );
  });

  it('should register all required visualizer dependencies', async () => {
    // This test ensures all visualizer dependencies are properly registered

    const bootstrapper = new CommonBootstrapper();
    let resolvedServices = {};

    const { container, services } = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      skipModLoading: true,
      postInitHook: async (services, container) => {
        // Import and call registerVisualizerComponents
        const { registerVisualizerComponents } = await import(
          '../../src/dependencyInjection/registrations/visualizerRegistrations.js'
        );

        registerVisualizerComponents(container);

        // Resolve all visualizer-related services
        resolvedServices.visualizerState = container.resolve(
          tokens.VisualizerState
        );
        resolvedServices.anatomyLoadingDetector = container.resolve(
          tokens.AnatomyLoadingDetector
        );
        resolvedServices.visualizerStateController = container.resolve(
          tokens.VisualizerStateController
        );
      },
    });

    // Store cleanup function
    cleanup = bootstrapper.cleanup?.bind(bootstrapper);

    // Assert all services are resolved
    expect(resolvedServices.visualizerState).toBeDefined();
    expect(resolvedServices.anatomyLoadingDetector).toBeDefined();
    expect(resolvedServices.visualizerStateController).toBeDefined();

    // Verify service relationships (controller depends on state and detector)
    expect(resolvedServices.visualizerStateController).toBeTruthy();

    // Verify the visualizer state has expected methods
    expect(typeof resolvedServices.visualizerState.getCurrentState).toBe(
      'function'
    );
    expect(typeof resolvedServices.visualizerState.getSelectedEntity).toBe(
      'function'
    );
  });

  it('should create AnatomyVisualizerUI with all required dependencies', async () => {
    // This test verifies the complete initialization flow works

    const bootstrapper = new CommonBootstrapper();
    let anatomyVisualizerUI = null;
    let initializationComplete = false;

    const { container, services } = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      skipModLoading: true,
      postInitHook: async (services, container) => {
        // Import required modules
        const { registerVisualizerComponents } = await import(
          '../../src/dependencyInjection/registrations/visualizerRegistrations.js'
        );
        const AnatomyVisualizerUI = (
          await import('../../src/domUI/AnatomyVisualizerUI.js')
        ).default;

        // Register visualizer components
        registerVisualizerComponents(container);

        // Get all required services
        const { logger, registry, entityManager, eventDispatcher } = services;
        const anatomyDescriptionService = container.resolve(
          tokens.AnatomyDescriptionService
        );
        const visualizerStateController = container.resolve(
          tokens.VisualizerStateController
        );

        // Create UI instance
        anatomyVisualizerUI = new AnatomyVisualizerUI({
          logger,
          registry,
          entityManager,
          anatomyDescriptionService,
          eventDispatcher,
          documentContext: { document: global.document },
          visualizerStateController,
        });

        // Initialize UI
        await anatomyVisualizerUI.initialize();
        initializationComplete = true;
      },
    });

    // Store cleanup function
    cleanup = bootstrapper.cleanup?.bind(bootstrapper);

    // Assert successful initialization
    expect(anatomyVisualizerUI).toBeDefined();
    expect(initializationComplete).toBe(true);
  });
});
