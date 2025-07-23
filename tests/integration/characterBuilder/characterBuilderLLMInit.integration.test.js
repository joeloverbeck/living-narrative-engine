/**
 * @file Integration test for character builder LLM adapter initialization
 * @description Verifies that the character builder properly initializes with all required schemas
 * including llm-configs.schema.json, preventing validation errors
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { CharacterBuilderApp } from '../../../src/character-builder-main.js';

describe('CharacterBuilder - LLM Initialization Integration', () => {
  let dom;
  let container;
  let logger;
  let originalWindow;
  let originalDocument;
  let originalAlert;

  beforeEach(async () => {
    // Setup DOM environment
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="character-list"></div>
          <div id="character-form"></div>
          <button id="generate-concept">Generate</button>
          <button id="generate-full">Generate Full</button>
          <button id="save-character">Save</button>
          <button id="new-character">New</button>
          <div id="app-container"></div>
          <div id="status-message"></div>
          <input id="character-name" />
          <textarea id="character-description"></textarea>
          <textarea id="concept-output"></textarea>
          <textarea id="full-character-output"></textarea>
        </body>
      </html>
    `,
      {
        url: 'http://localhost',
        pretendToBeVisual: true,
      }
    );

    // Store originals
    originalWindow = global.window;
    originalDocument = global.document;
    originalAlert = global.alert;

    // Set globals
    global.window = dom.window;
    global.document = dom.window.document;
    global.alert = jest.fn();

    // Mock fetch BEFORE creating container to handle schema loading during configuration
    global.fetch = jest.fn((url) => {
      // Handle all schema files that SchemaLoader will try to fetch
      if (url.includes('.schema.json')) {
        // Extract schema name from URL, handling nested paths like operations/
        const match = url.match(/([^/]+)\.schema\.json$/);
        const schemaName = match ? match[1] : 'unknown';

        // Special handling for llm-configs schema
        if (schemaName === 'llm-configs') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                $id: 'schema://living-narrative-engine/llm-configs.schema.json',
                $schema: 'http://json-schema.org/draft-07/schema#',
                type: 'object',
                properties: {
                  configs: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        provider: { type: 'string' },
                        model: { type: 'string' },
                        temperature: { type: 'number' },
                        maxTokens: { type: 'number' },
                      },
                      required: ['id', 'provider', 'model'],
                    },
                  },
                },
                required: ['configs'],
              }),
          });
        }

        // Character-specific schemas
        if (url.includes('thematic-direction.schema.json')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                $id: 'thematic-direction',
                $schema: 'http://json-schema.org/draft-07/schema#',
                type: 'object',
                properties: {
                  theme: { type: 'string' },
                },
              }),
          });
        }
        if (url.includes('character-concept.schema.json')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                $id: 'character-concept',
                $schema: 'http://json-schema.org/draft-07/schema#',
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              }),
          });
        }

        // Generic response for all other schemas
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              $id: `schema://living-narrative-engine/${schemaName}.schema.json`,
              $schema: 'http://json-schema.org/draft-07/schema#',
              type: 'object',
            }),
        });
      }

      // LLM config file
      if (url.includes('config/llm-configs.json')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              configs: [
                {
                  id: 'test-config',
                  provider: 'test',
                  model: 'test-model',
                  temperature: 0.7,
                },
              ],
            }),
        });
      }

      // For other files
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    // Setup logger
    logger = new ConsoleLogger('error'); // Reduce noise in tests

    // Setup container
    container = new AppContainer();
    container.register(tokens.ILogger, logger);
  });

  afterEach(() => {
    // Restore globals
    global.window = originalWindow;
    global.document = originalDocument;
    global.alert = originalAlert;

    // Close JSDOM
    if (dom) {
      dom.window.close();
    }
  });

  describe('Schema Loading and LLM Initialization', () => {
    it('should successfully initialize with all required schemas including llm-configs', async () => {
      // Arrange
      // Configure container with all required services
      await configureBaseContainer(container, {
        includeGameSystems: true,
        includeCharacterBuilder: true,
        logger,
      });

      // Act - Load schemas directly to verify they can be loaded
      const schemaLoader = container.resolve(tokens.SchemaLoader);
      await schemaLoader.loadAndCompileAllSchemas();

      // Assert
      // Get the schema validator to verify schemas are loaded
      const schemaValidator = container.resolve(tokens.ISchemaValidator);

      // Verify critical schema is loaded (this was the missing one causing the error)
      const llmConfigSchemaId =
        'schema://living-narrative-engine/llm-configs.schema.json';
      expect(schemaValidator.isSchemaLoaded(llmConfigSchemaId)).toBe(true);

      // Also test that CharacterBuilderApp can initialize without errors
      const app = new CharacterBuilderApp();
      await expect(app.initialize()).resolves.not.toThrow();
    });

    it('should validate llm-configs.json against the loaded schema', async () => {
      // Arrange
      const mockLLMConfig = {
        configs: [
          {
            id: 'test-llm',
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            maxTokens: 1000,
          },
        ],
      };

      await configureBaseContainer(container, {
        includeGameSystems: true,
        includeCharacterBuilder: true,
        logger,
      });

      // Act - Load schemas first
      const schemaLoader = container.resolve(tokens.SchemaLoader);
      await schemaLoader.loadAndCompileAllSchemas();

      // Assert
      // Get services to verify validation
      const schemaValidator = container.resolve(tokens.ISchemaValidator);
      const configuration = container.resolve(tokens.IConfiguration);

      // Get the schema ID from configuration
      const schemaId = configuration.getContentTypeSchemaId('llm-configs');
      expect(schemaId).toBe(
        'schema://living-narrative-engine/llm-configs.schema.json'
      );

      // Validate the config against the schema
      const validationResult = schemaValidator.validate(
        schemaId,
        mockLLMConfig
      );
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toBeFalsy(); // errors can be null or undefined when valid
    });

    it('should handle schema loading failures gracefully', async () => {
      // Arrange - Override the default mock to simulate a failure
      global.fetch = jest.fn((url) => {
        if (url.includes('llm-configs.schema.json')) {
          return Promise.reject(new Error('Network error loading schema'));
        }
        // Default response for other schemas
        if (url.includes('.schema.json')) {
          const schemaName =
            url.match(/([^/]+)\.schema\.json$/)?.[1] || 'unknown';
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                $id: `schema://living-narrative-engine/${schemaName}.schema.json`,
                $schema: 'http://json-schema.org/draft-07/schema#',
                type: 'object',
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      await configureBaseContainer(container, {
        includeGameSystems: true,
        includeCharacterBuilder: true,
        logger,
      });

      // Act & Assert
      const app = new CharacterBuilderApp();
      await expect(app.initialize()).rejects.toThrow();
    });
  });

  describe('Post-Fix Verification', () => {
    it('should not produce the "Schema with id not found" error from the logs', async () => {
      // Arrange
      const errorMessages = [];
      const warnMessages = [];

      // Create a logger that captures messages
      const testLogger = new ConsoleLogger('debug');
      testLogger.error = jest.fn((msg, ...args) => {
        errorMessages.push(msg);
        console.error(msg, ...args); // Still log for debugging
      });
      testLogger.warn = jest.fn((msg, ...args) => {
        warnMessages.push(msg);
        console.warn(msg, ...args);
      });

      // Re-register with test logger
      container.register(tokens.ILogger, testLogger);

      await configureBaseContainer(container, {
        includeGameSystems: true,
        includeCharacterBuilder: true,
        logger: testLogger,
      });

      // Act
      const app = new CharacterBuilderApp();
      await app.initialize();

      // Assert - Verify the specific error from the logs does not appear
      const schemaNotFoundError = errorMessages.find((msg) =>
        msg.includes(
          "Schema with id 'schema://living-narrative-engine/llm-configs.schema.json' not found"
        )
      );
      expect(schemaNotFoundError).toBeUndefined();

      const schemaValidationError = errorMessages.find((msg) =>
        msg.includes(
          'LLM Prompt configuration file from config/llm-configs.json failed schema validation'
        )
      );
      expect(schemaValidationError).toBeUndefined();

      const ajvWarning = warnMessages.find((msg) =>
        msg.includes(
          "validate called for schemaId 'schema://living-narrative-engine/llm-configs.schema.json', but no validator function was found"
        )
      );
      expect(ajvWarning).toBeUndefined();
    });
  });
});
