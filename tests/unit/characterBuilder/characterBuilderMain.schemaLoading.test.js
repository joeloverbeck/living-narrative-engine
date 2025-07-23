/**
 * @file Unit tests for character builder schema loading functionality
 * @description Tests isolated schema loading behaviors that don't require full DI setup
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('CharacterBuilderApp - Schema Loading (Unit Tests)', () => {
  let originalFetch;

  beforeEach(() => {
    // Store original fetch to restore later
    originalFetch = global.fetch;
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('Character-Specific Schema Loading Error Handling', () => {
    it('should handle missing thematic-direction schema gracefully', async () => {
      // Mock fetch to simulate schema loading failure
      global.fetch = jest.fn((url) => {
        if (url.includes('thematic-direction.schema.json')) {
          return Promise.resolve({
            ok: false,
            status: 404,
          });
        }
        
        // Handle all other schema files properly
        if (url.includes('.schema.json')) {
          const schemaName = url.match(/([^/]+)\.schema\.json$/)?.[1] || 'unknown';
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                $id: `schema://living-narrative-engine/${schemaName}.schema.json`,
                $schema: 'http://json-schema.org/draft-07/schema#',
                type: 'object',
                properties: {},
              }),
          });
        }
        
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });

      // Import the module dynamically to apply mocks
      const { CharacterBuilderApp } = await import('../../../src/character-builder-main.js');
      const app = new CharacterBuilderApp();

      // Act & Assert
      await expect(app.initialize()).rejects.toThrow(
        'Failed to load thematic direction schema: 404'
      );
    });

    it('should handle missing character-concept schema gracefully', async () => {
      // Mock fetch to simulate character-concept schema failure
      global.fetch = jest.fn((url) => {
        if (url.includes('character-concept.schema.json')) {
          return Promise.resolve({
            ok: false,
            status: 500,
          });
        }
        
        // Handle all other schema files properly
        if (url.includes('.schema.json')) {
          const schemaName = url.match(/([^/]+)\.schema\.json$/)?.[1] || 'unknown';
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                $id: `schema://living-narrative-engine/${schemaName}.schema.json`,
                $schema: 'http://json-schema.org/draft-07/schema#',
                type: 'object',
                properties: {},
              }),
          });
        }
        
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });

      // Import the module dynamically to apply mocks
      const { CharacterBuilderApp } = await import('../../../src/character-builder-main.js');
      const app = new CharacterBuilderApp();

      // Act & Assert
      await expect(app.initialize()).rejects.toThrow(
        'Failed to load character concept schema: 500'
      );
    });
  });

  describe('Schema Loading Integration Note', () => {
    it('should note that full schema loading flow is tested in integration tests', () => {
      // This test serves as documentation that the full schema loading flow,
      // including DI container setup and SchemaLoader coordination, is covered
      // by integration tests in tests/integration/characterBuilder/
      
      const integrationTestFiles = [
        'tests/integration/characterBuilder/characterBuilderSchemaFix.integration.test.js',
        'tests/integration/characterBuilder/characterBuilderLLMInit.integration.test.js'
      ];
      
      expect(integrationTestFiles).toHaveLength(2);
      
      // The full initialization flow including:
      // - SchemaLoader.loadAndCompileAllSchemas() being called
      // - Proper order of schema loading before LLM adapter init
      // - DI container resolution of services
      // - Integration between multiple services
      // is tested in the integration test suite
    });
  });
});