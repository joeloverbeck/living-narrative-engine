/**
 * @file Unit tests for CharacterBuilderApp
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterBuilderApp } from '../../../src/character-builder-main.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

// Mock the DI container and its dependencies
jest.mock('../../../src/dependencyInjection/appContainer.js');
jest.mock('../../../src/dependencyInjection/baseContainerConfig.js');

// Mock global fetch
global.fetch = jest.fn();

// Mock DOM elements
document.body.innerHTML = '<div id="root"></div>';

describe('CharacterBuilderApp', () => {
  let app;
  let mockFetch;
  let mockContainer;
  let mockSchemaLoader;
  let mockSchemaValidator;
  let mockLlmAdapter;
  let mockController;
  let mockConfigureBaseContainer;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    mockFetch = global.fetch;

    // Mock console methods to reduce test noise - but don't mock warn for the double init test
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});

    // Setup DI container mocks
    mockSchemaLoader = {
      loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
    };

    mockSchemaValidator = {
      addSchema: jest.fn().mockResolvedValue(undefined),
    };

    mockLlmAdapter = {
      init: jest.fn().mockResolvedValue(undefined),
    };

    mockController = {
      initialize: jest.fn().mockResolvedValue(undefined),
    };

    mockContainer = {
      register: jest.fn(),
      resolve: jest.fn((token) => {
        if (token.toString().includes('SchemaLoader')) return mockSchemaLoader;
        if (token.toString().includes('ISchemaValidator')) return mockSchemaValidator;
        if (token.toString().includes('LLMAdapter')) return mockLlmAdapter;
        if (token.toString().includes('Controller')) return mockController;
        return {};
      }),
    };

    mockConfigureBaseContainer = jest
      .fn()
      .mockResolvedValue(undefined);

    // Mock the imports
    const { default: AppContainer } = await import(
      '../../../src/dependencyInjection/appContainer.js'
    );
    AppContainer.mockImplementation(() => mockContainer);

    const { configureBaseContainer } = await import(
      '../../../src/dependencyInjection/baseContainerConfig.js'
    );
    configureBaseContainer.mockImplementation(mockConfigureBaseContainer);

    app = new CharacterBuilderApp();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Schema Loading', () => {
    const mockThematicDirectionSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'schema://living-narrative-engine/thematic-direction.schema.json',
      title: 'Thematic Direction',
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
    };

    const mockCharacterConceptSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'schema://living-narrative-engine/character-concept.schema.json',
      title: 'Character Concept',
      type: 'object',
      properties: {
        id: { type: 'string' },
        thematicDirections: {
          type: 'array',
          items: {
            $ref: 'schema://living-narrative-engine/thematic-direction.schema.json',
          },
        },
      },
    };

    it('should load schemas in correct order - thematic-direction first, then character-concept', async () => {
      const fetchCalls = [];

      mockFetch.mockImplementation((url) => {
        fetchCalls.push(url);

        if (url.includes('thematic-direction.schema.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockThematicDirectionSchema),
          });
        }

        if (url.includes('character-concept.schema.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCharacterConceptSchema),
          });
        }

        // Mock other required resources for initialization
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      await app.initialize();

      // Verify SchemaLoader was called to load all schemas
      expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalledTimes(1);

      // Verify character-specific schemas were loaded in correct order
      const schemaFetchCalls = fetchCalls.filter(
        (url) =>
          url.includes('thematic-direction.schema.json') ||
          url.includes('character-concept.schema.json')
      );

      expect(schemaFetchCalls.length).toBe(2);
      expect(schemaFetchCalls[0]).toContain('thematic-direction.schema.json');
      expect(schemaFetchCalls[1]).toContain('character-concept.schema.json');

      // Verify the schemas were added to the validator in correct order
      expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(2);
      expect(mockSchemaValidator.addSchema).toHaveBeenNthCalledWith(
        1,
        mockThematicDirectionSchema,
        'thematic-direction'
      );
      expect(mockSchemaValidator.addSchema).toHaveBeenNthCalledWith(
        2,
        mockCharacterConceptSchema,
        'character-concept'
      );
    });

    it('should handle schema loading failure gracefully', async () => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('thematic-direction.schema.json')) {
          return Promise.resolve({
            ok: false,
            status: 404,
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      await expect(app.initialize()).rejects.toThrow(
        'Failed to load thematic direction schema: 404'
      );
    });

    it('should handle network errors during schema fetch', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(app.initialize()).rejects.toThrow(
        'Schema loading failed: Network error'
      );
    });
  });

  describe('Error Display', () => {
    it('should display initialization error to user', async () => {
      mockFetch.mockRejectedValue(new Error('Test initialization error'));

      try {
        await app.initialize();
      } catch (error) {
        // Expected error
      }

      // Check that error UI was rendered
      expect(document.body.innerHTML).toContain(
        'Character Builder Failed to Start'
      );
      expect(document.body.innerHTML).toContain('Test initialization error');
    });
  });
});
