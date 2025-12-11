/**
 * @file Integration test for anatomy visualizer bootstrap process
 * Tests the fix for VisualizerStateController registration issue
 * @see src/anatomy-visualizer.js
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CommonBootstrapper } from '../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { JSDOM } from 'jsdom';

describe('Anatomy Visualizer - Bootstrap Integration', () => {
  let dom;
  let sharedBootstrapper;
  let sharedContainer;
  let sharedServices;
  let registerVisualizerComponents;

  beforeAll(async () => {
    // Setup DOM environment once for all tests
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

    // Pre-load the visualizer registration module
    const visualizerModule = await import(
      '../../src/dependencyInjection/registrations/visualizerRegistrations.js'
    );
    registerVisualizerComponents = visualizerModule.registerVisualizerComponents;

    // Bootstrap once for shared tests
    sharedBootstrapper = new CommonBootstrapper();
    const result = await sharedBootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      skipModLoading: true,
    });

    if (!result?.container || !result?.services) {
      throw new Error(
        'Bootstrap failed: container or services not initialized'
      );
    }

    sharedContainer = result.container;
    sharedServices = result.services;

    // Register IDocumentContext for shared container
    sharedContainer.register(tokens.IDocumentContext, {
      document: global.document,
    });

    // Register visualizer components on shared container
    registerVisualizerComponents(sharedContainer);
  });

  afterAll(() => {
    // Clean up shared resources
    if (sharedContainer?.cleanup) {
      sharedContainer.cleanup();
    }
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  it('should successfully register and resolve VisualizerStateController with minimal configuration', () => {
    // This test verifies the fix for the "No service registered for key VisualizerStateController" error

    // Try to resolve the services that anatomy-visualizer.js needs
    const resolvedAnatomyDescriptionService = sharedContainer.resolve(
      tokens.AnatomyDescriptionService
    );
    const resolvedVisualizerStateController = sharedContainer.resolve(
      tokens.VisualizerStateController
    );

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
    // This test requires a fresh bootstrapper to verify the negative case
    const freshBootstrapper = new CommonBootstrapper();
    let errorThrown = null;

    const { container } = await freshBootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      skipModLoading: true,
    });

    // Try to resolve VisualizerStateController WITHOUT calling registerVisualizerComponents
    try {
      container.resolve(tokens.VisualizerStateController);
    } catch (error) {
      errorThrown = error;
    }

    // Clean up the fresh bootstrapper
    if (freshBootstrapper.cleanup) {
      freshBootstrapper.cleanup();
    }

    // Assert that the expected error was thrown
    expect(errorThrown).toBeDefined();
    expect(errorThrown.message).toContain(
      'No service registered for key "VisualizerStateController"'
    );
  });

  it('should register all required visualizer dependencies', () => {
    // This test ensures all visualizer dependencies are properly registered
    const resolvedServices = {};

    // Resolve all visualizer-related services from shared container
    resolvedServices.visualizerState = sharedContainer.resolve(
      tokens.VisualizerState
    );
    resolvedServices.anatomyLoadingDetector = sharedContainer.resolve(
      tokens.AnatomyLoadingDetector
    );
    resolvedServices.visualizerStateController = sharedContainer.resolve(
      tokens.VisualizerStateController
    );

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
    const AnatomyVisualizerUI = (
      await import('../../src/domUI/AnatomyVisualizerUI.js')
    ).default;

    // Get all required services from shared container
    const { logger, registry, entityManager, eventDispatcher } = sharedServices;
    const anatomyDescriptionService = sharedContainer.resolve(
      tokens.AnatomyDescriptionService
    );
    const visualizerStateController = sharedContainer.resolve(
      tokens.VisualizerStateController
    );
    const visualizationComposer = sharedContainer.resolve(
      tokens.VisualizationComposer
    );

    // Create UI instance
    const anatomyVisualizerUI = new AnatomyVisualizerUI({
      logger,
      registry,
      entityManager,
      anatomyDescriptionService,
      eventDispatcher,
      documentContext: { document: global.document },
      visualizerStateController,
      visualizationComposer,
    });

    // Initialize UI
    await anatomyVisualizerUI.initialize();

    // Assert successful initialization
    expect(anatomyVisualizerUI).toBeDefined();
  });
});
