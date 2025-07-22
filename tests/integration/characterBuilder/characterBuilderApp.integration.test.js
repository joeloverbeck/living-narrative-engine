/**
 * @file Integration tests for CharacterBuilderApp initialization
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { CharacterBuilderApp } from '../../../src/character-builder-main.js';

// Use process.cwd() instead of import.meta for Jest compatibility
const projectRoot = process.cwd();

describe('CharacterBuilderApp Integration', () => {
  let originalFetch;
  let app;

  beforeAll(() => {
    // Save original fetch
    originalFetch = global.fetch;

    // Mock fetch to read from filesystem
    global.fetch = async (url) => {
      // Convert relative URL to filesystem path
      const filePath = path.join(projectRoot, url);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return {
          ok: true,
          status: 200,
          json: async () => JSON.parse(content),
          text: async () => content,
        };
      } catch (error) {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
        };
      }
    };

    // Mock DOM
    document.body.innerHTML = `
      <div id="character-builder-root">
        <div class="concept-input-container">
          <textarea id="concept-input"></textarea>
          <button id="generate-btn">Generate</button>
        </div>
        <div id="directions-container"></div>
        <div id="saved-concepts-container"></div>
      </div>
    `;
  });

  afterAll(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('Schema Loading and Validation', () => {
    it('should successfully load and validate both schemas with proper references', async () => {
      app = new CharacterBuilderApp();

      // This should not throw if schemas are loaded correctly
      let initError = null;
      try {
        await app.initialize();
      } catch (error) {
        initError = error;
      }

      // The initialization might fail due to missing LLM services, but schema loading should succeed
      if (initError) {
        expect(initError.message).not.toContain("can't resolve reference");
        expect(initError.message).not.toContain(
          'thematic-direction.schema.json'
        );
      }
    });

    it('should properly resolve schema references between character-concept and thematic-direction', async () => {
      // Create a minimal test that focuses only on schema loading
      const { default: AjvSchemaValidator } = await import(
        '../../../src/validation/ajvSchemaValidator.js'
      );
      const { default: ConsoleLogger } = await import(
        '../../../src/logging/consoleLogger.js'
      );

      const logger = new ConsoleLogger({ level: 'error' });
      const validator = new AjvSchemaValidator({ logger });

      // Load schemas in the same order as CharacterBuilderApp
      const directionSchemaPath = path.join(
        projectRoot,
        'data/schemas/thematic-direction.schema.json'
      );
      const conceptSchemaPath = path.join(
        projectRoot,
        'data/schemas/character-concept.schema.json'
      );

      const directionSchema = JSON.parse(
        await fs.readFile(directionSchemaPath, 'utf-8')
      );
      const conceptSchema = JSON.parse(
        await fs.readFile(conceptSchemaPath, 'utf-8')
      );

      // Add schemas in correct order
      await validator.addSchema(
        directionSchema,
        'thematic-direction.schema.json'
      );
      await validator.addSchema(conceptSchema, 'character-concept.schema.json');

      // Test that we can validate data against the schemas
      const testDirection = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        conceptId: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Direction',
        description: 'This is a test thematic direction for validation',
        coreTension: 'Test tension between opposing forces',
        uniqueTwist: 'A unique twist on the archetype',
        narrativePotential: 'Rich narrative possibilities',
        createdAt: new Date().toISOString(),
      };

      const testConcept = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        concept: 'A test character concept for validation purposes',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        thematicDirections: [testDirection],
      };

      // Validate against schemas
      const directionResult = await validator.validate(
        'schema://living-narrative-engine/thematic-direction.schema.json',
        testDirection
      );
      expect(directionResult.isValid).toBe(true);

      const conceptResult = await validator.validate(
        'schema://living-narrative-engine/character-concept.schema.json',
        testConcept
      );
      expect(conceptResult.isValid).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing schema files gracefully', async () => {
      // Temporarily override fetch to simulate missing schema
      const tempFetch = global.fetch;
      global.fetch = async (url) => {
        if (url.includes('thematic-direction.schema.json')) {
          return { ok: false, status: 404 };
        }
        return tempFetch(url);
      };

      app = new CharacterBuilderApp();

      await expect(app.initialize()).rejects.toThrow(
        'Failed to load thematic direction schema: 404'
      );

      // Restore fetch
      global.fetch = tempFetch;
    });

    it('should display user-friendly error when initialization fails', async () => {
      // Override fetch to cause an error
      global.fetch = async () => {
        throw new Error('Network failure');
      };

      app = new CharacterBuilderApp();

      try {
        await app.initialize();
      } catch (error) {
        // Expected error
      }

      // Check that error UI is displayed
      expect(document.body.innerHTML).toContain(
        'Character Builder Failed to Start'
      );
      expect(document.body.innerHTML).toContain('Network failure');
      expect(document.body.innerHTML).toContain('Retry');
      expect(document.body.innerHTML).toContain('Back to Main Menu');
    });
  });
});
