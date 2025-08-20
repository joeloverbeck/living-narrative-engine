/**
 * @file Integration test to reproduce CoreMotivationsGenerator dependency error
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CharacterBuilderBootstrap } from '../../../src/characterBuilder/CharacterBuilderBootstrap.js';
import { CoreMotivationsGeneratorController } from '../../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js';
import { CoreMotivationsDisplayEnhancer } from '../../../src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js';

describe('CoreMotivationsGenerator Dependency Error', () => {
  let bootstrap;
  let originalFetch;
  let originalDocument;

  beforeEach(() => {
    bootstrap = new CharacterBuilderBootstrap();

    // Save original fetch
    originalFetch = global.fetch;
    
    // Mock fetch for schema loading and logger config
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('.schema.json')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              $schema: 'http://json-schema.org/draft-07/schema#',
              id: 'test-schema',
              type: 'object',
            }),
        });
      }
      // Mock logger config fetch
      if (url.includes('logger-config.json')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              logLevel: 'INFO',
            }),
        });
      }
      // Mock LLM config fetch
      if (url.includes('llm-configs.json')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              providers: [],
              configurations: [],
            }),
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    // Save original document
    originalDocument = global.document;

    // Mock document for error display setup
    global.document = {
      getElementById: jest.fn().mockReturnValue(null),
      createElement: jest.fn().mockReturnValue({
        id: '',
        className: '',
        appendChild: jest.fn(),
      }),
      body: {
        appendChild: jest.fn(),
      },
    };
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    // Restore original document
    global.document = originalDocument;
  });

  it('should fail with missing CoreMotivationsGenerator dependency error', async () => {
    // This test reproduces the exact error we see in the logs
    // The controller expects coreMotivationsGenerator but only gets displayEnhancer
    await expect(
      bootstrap.bootstrap({
        pageName: 'core-motivations-generator',
        controllerClass: CoreMotivationsGeneratorController,
        includeModLoading: false, // Skip mod loading for test
        customSchemas: [],
        services: {
          // Only providing displayEnhancer, missing coreMotivationsGenerator
          displayEnhancer: CoreMotivationsDisplayEnhancer,
        },
      })
    ).rejects.toThrow('Missing required dependency: CoreMotivationsGenerator');
  });

  it('should succeed when CoreMotivationsGenerator is properly provided', async () => {
    // Create a mock controller that doesn't need actual initialization
    const MockController = jest.fn().mockImplementation((deps) => {
      // Verify the dependency is present
      if (!deps.coreMotivationsGenerator) {
        throw new Error('Missing required dependency: CoreMotivationsGenerator');
      }
      return {
        initialize: jest.fn().mockResolvedValue(true),
        cleanup: jest.fn().mockResolvedValue(true),
        dependencies: deps,
      };
    });

    // Mock the CoreMotivationsGenerator service
    const mockCoreMotivationsGenerator = {
      generateMotivations: jest.fn().mockResolvedValue({
        motivations: [],
        tokensUsed: 0,
      }),
    };

    // This test will pass once we fix the dependency injection
    const result = await bootstrap.bootstrap({
      pageName: 'core-motivations-generator',
      controllerClass: MockController,
      includeModLoading: false,
      customSchemas: [],
      services: {
        displayEnhancer: CoreMotivationsDisplayEnhancer,
        // Properly providing the missing service
        coreMotivationsGenerator: mockCoreMotivationsGenerator,
      },
    });

    expect(result).toBeDefined();
    expect(result.controller).toBeDefined();
    // Verify the controller received the dependency
    expect(result.controller.dependencies.coreMotivationsGenerator).toBe(mockCoreMotivationsGenerator);
  });
});