/**
 * @file Integration tests for Core Motivations Generator page loading
 * @description Tests that verify the page can be loaded without dependency injection errors
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CharacterBuilderBootstrap } from '../../../src/characterBuilder/CharacterBuilderBootstrap.js';
import { CoreMotivationsGeneratorController } from '../../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js';
import { CoreMotivationsDisplayEnhancer } from '../../../src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js';
import { CoreMotivationsGenerator } from '../../../src/characterBuilder/services/CoreMotivationsGenerator.js';

describe('Core Motivations Generator Page Loading', () => {
  let bootstrap;
  let result;
  let originalConsoleError;
  let consoleErrors;

  beforeEach(() => {
    // Set up DOM structure
    document.body.innerHTML = `
      <div id="core-motivations-container">
        <div id="loading-indicator"></div>
        <div id="main-content" style="display:none;">
          <h1>Core Motivations Generator</h1>
          <div id="generator-content">
            <div id="controls-section">
              <div id="no-directions-message" style="display:none;"></div>
              <select id="direction-selector" style="display:none;">
                <option value="">Select a thematic direction...</option>
              </select>
              <button id="generate-btn" disabled>Generate Core Motivations</button>
            </div>
            <div id="results-section">
              <h2>Generated Motivations</h2>
              <div id="motivations-container"></div>
              <div id="no-motivations-message">No motivations generated yet.</div>
            </div>
            <div id="export-section">
              <button id="export-btn" disabled>Export All</button>
              <button id="clear-all-btn" disabled>Clear All</button>
            </div>
          </div>
        </div>
        <div id="error-display" style="display:none;"></div>
      </div>
    `;

    // Capture console errors
    consoleErrors = [];
    originalConsoleError = console.error;
    console.error = (...args) => {
      consoleErrors.push(args.join(' '));
      originalConsoleError(...args);
    };

    bootstrap = new CharacterBuilderBootstrap();
  });

  afterEach(async () => {
    // Clean up
    if (result && result.controller && result.controller.cleanup) {
      await result.controller.cleanup();
    }

    // Restore console.error
    console.error = originalConsoleError;

    // Clear DOM
    document.body.innerHTML = '';

    bootstrap = null;
    result = null;
  });

  it('should bootstrap without dependency injection errors', async () => {
    // Act
    result = await bootstrap.bootstrap({
      pageName: 'core-motivations-generator',
      controllerClass: CoreMotivationsGeneratorController,
      includeModLoading: true,
      customSchemas: ['/data/schemas/core-motivation.schema.json'],
      services: {
        displayEnhancer: CoreMotivationsDisplayEnhancer,
        coreMotivationsGenerator: CoreMotivationsGenerator,
      },
    });

    // Assert
    expect(result).toBeDefined();
    expect(result.controller).toBeDefined();
    expect(result.container).toBeDefined();

    // Verify no dependency injection errors occurred
    const diErrors = consoleErrors.filter(
      (error) =>
        error.includes('Missing required dependency') ||
        error.includes('not found in container') ||
        error.includes('Failed to instantiate')
    );
    expect(diErrors).toEqual([]);
  });

  it('should resolve all required services', async () => {
    // Act
    result = await bootstrap.bootstrap({
      pageName: 'core-motivations-generator',
      controllerClass: CoreMotivationsGeneratorController,
      includeModLoading: true,
      customSchemas: ['/data/schemas/core-motivation.schema.json'],
      services: {
        displayEnhancer: CoreMotivationsDisplayEnhancer,
        coreMotivationsGenerator: CoreMotivationsGenerator,
      },
    });

    // Assert - Check that services were resolved from DI container
    const warnings = consoleErrors.filter(
      (error) =>
        error.includes('Service') && error.includes('not found in container')
    );

    // There should be no warnings about services not being found
    expect(warnings).toEqual([]);
  });

  it('should create controller with all dependencies', async () => {
    // Act
    result = await bootstrap.bootstrap({
      pageName: 'core-motivations-generator',
      controllerClass: CoreMotivationsGeneratorController,
      includeModLoading: true,
      customSchemas: ['/data/schemas/core-motivation.schema.json'],
      services: {
        displayEnhancer: CoreMotivationsDisplayEnhancer,
        coreMotivationsGenerator: CoreMotivationsGenerator,
      },
    });

    // Assert
    expect(result.controller).toBeInstanceOf(
      CoreMotivationsGeneratorController
    );
    expect(typeof result.controller.initialize).toBe('function');
  });

  it('should initialize controller without errors', async () => {
    // Act
    result = await bootstrap.bootstrap({
      pageName: 'core-motivations-generator',
      controllerClass: CoreMotivationsGeneratorController,
      includeModLoading: true,
      customSchemas: ['/data/schemas/core-motivation.schema.json'],
      services: {
        displayEnhancer: CoreMotivationsDisplayEnhancer,
        coreMotivationsGenerator: CoreMotivationsGenerator,
      },
    });

    // Assert - Controller should be initialized
    expect(result.controller).toBeDefined();

    // Check that initialization didn't throw any critical errors
    const criticalErrors = consoleErrors.filter(
      (error) =>
        error.includes('Failed to initialize') || error.includes('Fatal error')
    );
    expect(criticalErrors).toEqual([]);
  });

  it('should report bootstrap time', async () => {
    // Act
    result = await bootstrap.bootstrap({
      pageName: 'core-motivations-generator',
      controllerClass: CoreMotivationsGeneratorController,
      includeModLoading: true,
      customSchemas: ['/data/schemas/core-motivation.schema.json'],
      services: {
        displayEnhancer: CoreMotivationsDisplayEnhancer,
        coreMotivationsGenerator: CoreMotivationsGenerator,
      },
    });

    // Assert
    expect(result.bootstrapTime).toBeDefined();
    expect(typeof result.bootstrapTime).toBe('number');
    expect(result.bootstrapTime).toBeGreaterThan(0);
  });

  it('should handle missing DOM elements gracefully', async () => {
    // Arrange - Remove some elements
    document.body.innerHTML = '<div id="core-motivations-container"></div>';

    // Act
    result = await bootstrap.bootstrap({
      pageName: 'core-motivations-generator',
      controllerClass: CoreMotivationsGeneratorController,
      includeModLoading: true,
      customSchemas: ['/data/schemas/core-motivation.schema.json'],
      services: {
        displayEnhancer: CoreMotivationsDisplayEnhancer,
        coreMotivationsGenerator: CoreMotivationsGenerator,
      },
    });

    // Assert - Should still bootstrap without crashing
    expect(result).toBeDefined();
    expect(result.controller).toBeDefined();
  });

  it('should use correct service tokens for resolution', async () => {
    // Act
    result = await bootstrap.bootstrap({
      pageName: 'core-motivations-generator',
      controllerClass: CoreMotivationsGeneratorController,
      includeModLoading: true,
      customSchemas: ['/data/schemas/core-motivation.schema.json'],
      services: {
        displayEnhancer: CoreMotivationsDisplayEnhancer,
        coreMotivationsGenerator: CoreMotivationsGenerator,
      },
    });

    // Assert - Check that the correct services were resolved
    // This is verified by the absence of fallback instantiation messages
    const fallbackMessages = consoleErrors.filter((error) =>
      error.includes('Attempting to instantiate')
    );

    // The services should be resolved from DI container, not instantiated as fallback
    expect(fallbackMessages).toEqual([]);
  });
});
