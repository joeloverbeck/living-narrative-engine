/**
 * @file Integration test to verify core-motivations-generator page loads without errors
 * @see core-motivations-generator-main.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CharacterBuilderBootstrap } from '../../../src/characterBuilder/CharacterBuilderBootstrap.js';
import { CoreMotivationsGeneratorController } from '../../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js';
import { CoreMotivationsDisplayEnhancer } from '../../../src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js';
import { CoreMotivationsGenerator } from '../../../src/characterBuilder/services/CoreMotivationsGenerator.js';

describe('Core Motivations Generator Page - Load Test', () => {
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    // Spy on console to catch errors
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Set up required DOM elements
    document.body.innerHTML = `
      <div id="core-motivations-container"></div>
    `;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    document.body.innerHTML = '';
  });

  it('should bootstrap without "cannot be invoked without \'new\'" errors', async () => {
    const bootstrap = new CharacterBuilderBootstrap();
    
    // This mimics what happens in core-motivations-generator-main.js
    const result = await bootstrap.bootstrap({
      pageName: 'core-motivations-generator',
      controllerClass: CoreMotivationsGeneratorController,
      includeModLoading: true,
      customSchemas: [
        '/data/schemas/core-motivation.schema.json',
      ],
      services: {
        displayEnhancer: CoreMotivationsDisplayEnhancer,
        coreMotivationsGenerator: CoreMotivationsGenerator,
      },
    });

    // Check that bootstrap succeeded
    expect(result).toBeDefined();
    expect(result.controller).toBeDefined();

    // Check that no "cannot be invoked without 'new'" errors occurred
    const errorCalls = consoleErrorSpy.mock.calls;
    const criticalErrors = errorCalls.filter(call => {
      const errorMessage = call.join(' ');
      return errorMessage.includes('cannot be invoked without \'new\'') ||
             errorMessage.includes('Missing required dependency: CoreMotivationsGenerator');
    });

    expect(criticalErrors).toHaveLength(0);
  });

  it('should properly instantiate CoreMotivationsDisplayEnhancer', async () => {
    const bootstrap = new CharacterBuilderBootstrap();
    
    const result = await bootstrap.bootstrap({
      pageName: 'test-page',
      controllerClass: CoreMotivationsGeneratorController,
      includeModLoading: true, // Need this for LLM dependencies
      services: {
        displayEnhancer: CoreMotivationsDisplayEnhancer,
        coreMotivationsGenerator: CoreMotivationsGenerator, // Both services required by controller
      },
    });

    // The service should be instantiated without errors
    expect(result).toBeDefined();
    
    // Check no critical errors
    const errorCalls = consoleErrorSpy.mock.calls;
    const displayEnhancerErrors = errorCalls.filter(call => {
      const errorMessage = call.join(' ');
      return errorMessage.includes('CoreMotivationsDisplayEnhancer') &&
             errorMessage.includes('cannot be invoked');
    });

    expect(displayEnhancerErrors).toHaveLength(0);
  });

  it('should properly instantiate CoreMotivationsGenerator', async () => {
    const bootstrap = new CharacterBuilderBootstrap();
    
    const result = await bootstrap.bootstrap({
      pageName: 'test-page',
      controllerClass: CoreMotivationsGeneratorController,
      includeModLoading: true, // Need this for LLM dependencies
      services: {
        coreMotivationsGenerator: CoreMotivationsGenerator,
        displayEnhancer: CoreMotivationsDisplayEnhancer, // Both services required by controller
      },
    });

    // The service should be instantiated without errors
    expect(result).toBeDefined();
    
    // Check no critical errors
    const errorCalls = consoleErrorSpy.mock.calls;
    const generatorErrors = errorCalls.filter(call => {
      const errorMessage = call.join(' ');
      return errorMessage.includes('CoreMotivationsGenerator') &&
             errorMessage.includes('cannot be invoked');
    });

    expect(generatorErrors).toHaveLength(0);
  });
});