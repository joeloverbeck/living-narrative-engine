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

// Mock global fetch
global.fetch = jest.fn();

// Mock DOM elements
document.body.innerHTML = '<div id="root"></div>';

describe('CharacterBuilderApp', () => {
  let app;
  let mockFetch;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockFetch = global.fetch;

    // Mock console methods to reduce test noise - but don't mock warn for the double init test
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});

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

      try {
        await app.initialize();
      } catch (error) {
        // We expect some initialization errors due to missing dependencies
        // But schema loading should have been attempted in correct order
      }

      // Verify schemas were fetched in the correct order
      const schemaFetchCalls = fetchCalls.filter(
        (url) =>
          url.includes('thematic-direction.schema.json') ||
          url.includes('character-concept.schema.json')
      );

      expect(schemaFetchCalls.length).toBe(2);
      expect(schemaFetchCalls[0]).toContain('thematic-direction.schema.json');
      expect(schemaFetchCalls[1]).toContain('character-concept.schema.json');
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

      await expect(app.initialize()).rejects.toThrow('Schema loading failed');
    });

    it('should handle network errors during schema fetch', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(app.initialize()).rejects.toThrow('Schema loading failed');
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
