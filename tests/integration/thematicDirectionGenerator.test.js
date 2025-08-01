/**
 * @file Integration tests for thematic direction generator initialization
 * @description Tests to ensure the thematic direction generator initializes without errors
 */

import { describe, it, expect, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';

describe('Thematic Direction Generator - Integration', () => {
  let dom;
  let window;
  let document;
  let mockLlmAdapter;
  let mockSchemaLoader;

  beforeEach(() => {
    // Create a DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="error-display"></div>
          <div id="concept-selector"></div>
          <div id="selected-concept-display"></div>
          <div id="generate-btn"></div>
          <div id="back-to-menu-btn"></div>
        </body>
      </html>
    `);
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.fetch = jest.fn();

    // Mock fetch for schema loading
    global.fetch.mockImplementation((url) => {
      if (url.includes('ui-state.schema.json')) {
        return Promise.reject(new Error('404'));
      }
      if (url.includes('llm-configs.schema.json')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              $schema: 'http://json-schema.org/draft-07/schema#',
              type: 'object',
            }),
        });
      }
      // Default response for other schemas
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
          }),
      });
    });

    // Mock LLM adapter with all required methods
    mockLlmAdapter = {
      init: jest.fn().mockResolvedValue(undefined),
      getAIDecision: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          thematic_directions: [
            {
              title: 'Test Direction',
              description: 'Test description',
              themes: ['test'],
              suggested_traits: ['trait'],
              potential_conflicts: ['conflict'],
              narrative_hooks: ['hook'],
            },
          ],
        }),
      }),
    };

    // Mock schema loader
    mockSchemaLoader = {
      loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.window;
    delete global.document;
    delete global.fetch;
  });

  it('should not throw "Cannot read properties of undefined" error during initialization', async () => {
    // This test checks that the main module can be imported without errors
    // The actual initialization will fail due to missing DOM elements and services,
    // but it should not throw "Cannot read properties of undefined" errors

    let error = null;
    try {
      const mainModule = await import('../../src/thematic-direction-main.js');
      // Wait for DOM ready and initialization attempt
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (e) {
      error = e;
    }

    // The initialization may fail, but it should not be due to undefined property access
    if (error) {
      expect(error.message).not.toContain(
        'Cannot read properties of undefined'
      );
    }
  });

  it('should complete bootstrap without fatal errors', async () => {
    const { CharacterBuilderBootstrap } = await import(
      '../../src/characterBuilder/CharacterBuilderBootstrap.js'
    );
    const { ThematicDirectionController } = await import(
      '../../src/thematicDirection/controllers/thematicDirectionController.js'
    );
    const { tokens } = await import('../../src/dependencyInjection/tokens.js');
    const { Registrar } = await import('../../src/utils/registrarHelpers.js');

    const bootstrap = new CharacterBuilderBootstrap();

    // Mock controller that doesn't initialize
    const MockController = class {
      initialize() {
        return Promise.resolve();
      }
    };

    const config = {
      pageName: 'Thematic Direction Generator',
      controllerClass: MockController,
      includeModLoading: false,
      customSchemas: [], // No custom schemas to avoid fetch issues
      hooks: {
        preContainer: async (container) => {
          // Mock the services that would be resolved
          container.register(tokens.SchemaLoader, () => mockSchemaLoader);
          container.register(tokens.LLMAdapter, () => mockLlmAdapter);
          container.register(tokens.LlmConfigLoader, () => ({}));
          container.register(tokens.ILLMConfigurationManager, () => ({
            loadConfiguration: jest.fn().mockResolvedValue(undefined),
            getActiveConfiguration: jest.fn().mockResolvedValue({
              configId: 'test-config',
              modelIdentifier: 'test-model',
            }),
            setActiveConfiguration: jest.fn().mockResolvedValue(undefined),
          }));
          container.register(tokens.LlmJsonService, () => ({
            clean: jest.fn((text) => text),
            parseAndRepair: jest.fn((text) => JSON.parse(text)),
          }));
        },
      },
    };

    // This should not throw the "Cannot read properties of undefined" error
    const result = await bootstrap.bootstrap(config);

    expect(result).toHaveProperty('controller');
    expect(result).toHaveProperty('container');
    expect(result).toHaveProperty('bootstrapTime');
  }, 30000); // Increase timeout to 30 seconds

  it('should not log warnings about ui-state.schema.json', async () => {
    const { CharacterBuilderBootstrap } = await import(
      '../../src/characterBuilder/CharacterBuilderBootstrap.js'
    );
    const { tokens } = await import('../../src/dependencyInjection/tokens.js');

    const warnings = [];
    const bootstrap = new CharacterBuilderBootstrap();

    // Mock controller that doesn't initialize
    const MockController = class {
      initialize() {
        return Promise.resolve();
      }
    };

    const config = {
      pageName: 'Test Page',
      controllerClass: MockController,
      includeModLoading: false,
      customSchemas: [], // No custom schemas to avoid fetch issues
      hooks: {
        preContainer: async (container) => {
          // Mock logger to capture warnings
          const mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn((message) => {
              warnings.push(message);
            }),
          };
          container.register(tokens.ILogger, () => mockLogger);

          // Mock other required services
          container.register(tokens.SchemaLoader, () => mockSchemaLoader);
          container.register(tokens.LLMAdapter, () => mockLlmAdapter);
          container.register(tokens.LlmConfigLoader, () => ({}));
          container.register(tokens.ILLMConfigurationManager, () => ({
            loadConfiguration: jest.fn().mockResolvedValue(undefined),
            getActiveConfiguration: jest.fn().mockResolvedValue({
              configId: 'test-config',
              modelIdentifier: 'test-model',
            }),
            setActiveConfiguration: jest.fn().mockResolvedValue(undefined),
          }));
          container.register(tokens.LlmJsonService, () => ({
            clean: jest.fn((text) => text),
            parseAndRepair: jest.fn((text) => JSON.parse(text)),
          }));
        },
      },
    };

    await bootstrap.bootstrap(config);

    // Should not have warnings about ui-state.schema.json since we removed it
    const uiStateWarnings = warnings.filter((w) =>
      w.includes('ui-state.schema.json')
    );
    expect(uiStateWarnings).toHaveLength(0);
  }, 30000); // Increase timeout to 30 seconds
});
