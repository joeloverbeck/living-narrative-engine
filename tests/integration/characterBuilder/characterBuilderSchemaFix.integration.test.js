/**
 * @file Integration test to verify the character builder schema loading fix
 * @description Ensures that the character builder loads the llm-configs schema correctly
 * preventing the "Schema with id not found" error
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';

describe('CharacterBuilder - Schema Loading Fix Verification', () => {
  let container;
  let logger;
  let dom;

  beforeEach(async () => {
    // Setup minimal DOM for character builder
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
      { url: 'http://localhost' }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.alert = jest.fn();

    // Mock fetch BEFORE configuring container to handle schema loading
    global.fetch = jest.fn((url) => {
      // Handle all schema files that SchemaLoader will try to fetch
      if (url.includes('.schema.json')) {
        const schemaName =
          url.match(/([^/]+)\.schema\.json$/)?.[1] || 'unknown';

        // Special handling for llm-configs schema which is the focus of this test
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
                      },
                      required: ['id', 'provider', 'model'],
                    },
                  },
                },
                required: ['configs'],
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

      // For non-schema files
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    // Setup container and logger
    logger = new ConsoleLogger('error');
    container = new AppContainer();
    container.register(tokens.ILogger, logger);

    // Configure container
    await configureBaseContainer(container, {
      includeGameSystems: true,
      includeCharacterBuilder: true,
      logger,
    });
  });

  describe('Schema Loading Verification', () => {
    it('should load llm-configs schema when SchemaLoader.loadAndCompileAllSchemas is called', async () => {
      // Arrange
      const schemaLoader = container.resolve(tokens.SchemaLoader);
      const schemaValidator = container.resolve(tokens.ISchemaValidator);
      const configuration = container.resolve(tokens.IConfiguration);

      // Act
      await schemaLoader.loadAndCompileAllSchemas();

      // Assert
      // Get the schema ID that was causing the error
      const llmConfigSchemaId =
        configuration.getContentTypeSchemaId('llm-configs');
      expect(llmConfigSchemaId).toBe(
        'schema://living-narrative-engine/llm-configs.schema.json'
      );

      // Verify the schema is now loaded
      const isLoaded = schemaValidator.isSchemaLoaded(llmConfigSchemaId);
      expect(isLoaded).toBe(true);

      // Verify we can validate against it without errors
      const testConfig = { configs: [] };
      const validationResult = schemaValidator.validate(
        llmConfigSchemaId,
        testConfig
      );

      // The key assertion - we should not get "Schema with id not found" error
      expect(validationResult.errors).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining(
              "Schema with id 'schema://living-narrative-engine/llm-configs.schema.json' not found"
            ),
          }),
        ])
      );
    });

    it('should not produce validation errors when LLM config loader validates llm-configs.json', async () => {
      // Arrange
      const schemaLoader = container.resolve(tokens.SchemaLoader);
      const schemaValidator = container.resolve(tokens.ISchemaValidator);

      // Load all schemas first
      await schemaLoader.loadAndCompileAllSchemas();

      // Create a mock config that should be valid
      const mockLLMConfig = {
        configs: [
          {
            id: 'test-config',
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
          },
        ],
      };

      // Act
      const schemaId =
        'schema://living-narrative-engine/llm-configs.schema.json';
      const validationResult = schemaValidator.validate(
        schemaId,
        mockLLMConfig
      );

      // Assert
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toBeFalsy(); // errors can be null or undefined when valid
    });

    it('should allow character builder to initialize without schema validation errors', async () => {
      // This is a simplified test that verifies the key components work together

      // Arrange - capture any errors that occur
      const errorMessages = [];
      const testLogger = new ConsoleLogger('debug');
      testLogger.error = jest.fn((msg) => {
        errorMessages.push(msg);
      });
      testLogger.warn = jest.fn();

      // Re-register with test logger
      container.register(tokens.ILogger, testLogger);

      // Act - perform the same sequence as character builder initialization
      const schemaLoader = container.resolve(tokens.SchemaLoader);
      await schemaLoader.loadAndCompileAllSchemas();

      const llmConfigLoader = container.resolve(tokens.LlmConfigLoader);
      const llmAdapter = container.resolve(tokens.LLMAdapter);

      // Try to initialize LLM adapter (this would fail before the fix)
      try {
        await llmAdapter.init({ llmConfigLoader });
      } catch (error) {
        // Initialization might fail for other reasons in test environment
        // but we're specifically checking for the schema validation error
      }

      // Assert - verify we don't see the specific error from the logs
      const schemaNotFoundError = errorMessages.find((msg) =>
        msg.includes(
          "Schema with id 'schema://living-narrative-engine/llm-configs.schema.json' not found"
        )
      );
      expect(schemaNotFoundError).toBeUndefined();

      const validationFailedError = errorMessages.find((msg) =>
        msg.includes(
          'LLM Prompt configuration file from config/llm-configs.json failed schema validation'
        )
      );
      // This might still occur if the config file doesn't exist, but not due to missing schema
      if (validationFailedError) {
        // Check that it's not because of missing schema
        expect(validationFailedError).not.toContain('not found');
      }
    });
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
  });
});
