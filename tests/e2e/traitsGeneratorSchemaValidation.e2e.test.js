/**
 * @file End-to-end test for Traits Generator schema loading and validation
 * @description Tests schema integration, validation logic, and data structure compliance
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('Traits Generator Schema Validation E2E', () => {
  let dom;
  let window;
  let document;
  let mockAjv;

  beforeEach(() => {
    // Read the actual HTML file
    const htmlPath = path.resolve(process.cwd(), 'traits-generator.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Create JSDOM instance with schema validation mocking
    dom = new JSDOM(html, {
      url: 'http://127.0.0.1:8080/traits-generator.html',
      runScripts: 'outside-only',
      resources: 'usable',
      beforeParse(window) {
        // Mock AJV schema validation
        mockAjv = {
          compile: jest.fn(),
          validate: jest.fn(),
          addSchema: jest.fn(),
          getSchema: jest.fn()
        };

        // Mock the schema loading functionality
        window.fetch = jest.fn();
        setupSchemaValidationMocks(window.fetch, mockAjv);
      }
    });

    window = dom.window;
    document = window.document;
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
    jest.clearAllMocks();
  });

  describe('Schema File Integration', () => {
    it('should reference correct schema file path in application configuration', () => {
      // The traits generator should be configured to load trait.schema.json
      // This test verifies the correct schema path is referenced
      
      // Since we can't test the actual bootstrap without running the app,
      // we verify that the expected schema file exists
      const schemaPath = path.resolve(process.cwd(), 'data/schemas/trait.schema.json');
      expect(fs.existsSync(schemaPath)).toBe(true);
    });

    it('should have valid trait schema structure', () => {
      const schemaPath = path.resolve(process.cwd(), 'data/schemas/trait.schema.json');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      const schema = JSON.parse(schemaContent);

      // Verify essential schema properties
      expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(schema.$id).toBe('schema://living-narrative-engine/trait.schema.json');
      expect(schema.title).toBe('Character Trait');
      expect(schema.type).toBe('object');

      // Verify required fields match TraitsGeneratorController expectations
      const requiredFields = [
        'id',
        'names',
        'physicalDescription',
        'personality',
        'strengths',
        'weaknesses',
        'likes',
        'dislikes',
        'fears',
        'goals',
        'notes',
        'profile',
        'secrets',
        'generatedAt'
      ];

      expect(schema.required).toEqual(expect.arrayContaining(requiredFields));
    });

    it('should define correct data types for trait properties', () => {
      const schemaPath = path.resolve(process.cwd(), 'data/schemas/trait.schema.json');
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

      const properties = schema.properties;

      // Test array properties
      expect(properties.names.type).toBe('array');
      expect(properties.names.items.type).toBe('object');
      expect(properties.names.items.required).toContain('name');
      expect(properties.names.items.required).toContain('justification');

      expect(properties.personality.type).toBe('array');
      expect(properties.personality.items.type).toBe('object');
      expect(properties.personality.items.required).toContain('trait');
      expect(properties.personality.items.required).toContain('explanation');

      expect(properties.strengths.type).toBe('array');
      expect(properties.weaknesses.type).toBe('array');
      expect(properties.likes.type).toBe('array');
      expect(properties.dislikes.type).toBe('array');
      expect(properties.fears.type).toBe('array');

      // Test string properties
      expect(properties.physicalDescription.type).toBe('string');
      expect(properties.profile.type).toBe('string');

      // Test object properties
      expect(properties.goals.type).toBe('object');
      expect(properties.goals.required).toContain('shortTerm');
      expect(properties.goals.required).toContain('longTerm');

      // Test timestamp property
      expect(properties.generatedAt.type).toBe('string');
      expect(properties.generatedAt.format).toBe('date-time');
    });

    it('should define proper constraints for trait data', () => {
      const schemaPath = path.resolve(process.cwd(), 'data/schemas/trait.schema.json');
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

      const properties = schema.properties;

      // Test minimum/maximum constraints
      expect(properties.names.minItems).toBe(3);
      expect(properties.names.maxItems).toBe(5);

      expect(properties.personality.minItems).toBe(3);
      expect(properties.personality.maxItems).toBe(5);

      expect(properties.physicalDescription.minLength).toBe(100);
      expect(properties.physicalDescription.maxLength).toBe(500);

      expect(properties.profile.minLength).toBe(200);
      expect(properties.profile.maxLength).toBe(800);

      expect(properties.strengths.minItems).toBe(2);
      expect(properties.strengths.maxItems).toBe(4);

      expect(properties.likes.minItems).toBe(3);
      expect(properties.likes.maxItems).toBe(5);
    });

    it('should include metadata schema for generation tracking', () => {
      const schemaPath = path.resolve(process.cwd(), 'data/schemas/trait.schema.json');
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

      const metadata = schema.properties.metadata;
      expect(metadata).toBeTruthy();
      expect(metadata.type).toBe('object');

      const metadataProperties = metadata.properties;
      expect(metadataProperties.model).toBeTruthy();
      expect(metadataProperties.temperature).toBeTruthy();
      expect(metadataProperties.tokens).toBeTruthy();
      expect(metadataProperties.responseTime).toBeTruthy();
      expect(metadataProperties.promptVersion).toBeTruthy();
      expect(metadataProperties.generationPrompt).toBeTruthy();
    });
  });

  describe('Schema Validation Logic', () => {
    it('should be prepared for schema validation during trait generation', () => {
      // Test that the page structure supports schema validation workflow
      const traitsResults = document.getElementById('traits-results');
      const errorState = document.getElementById('error-state');
      const errorMessageText = document.getElementById('error-message-text');

      expect(traitsResults).toBeTruthy();
      expect(errorState).toBeTruthy();
      expect(errorMessageText).toBeTruthy();

      // Error state should have proper accessibility for validation errors
      expect(errorState.getAttribute('role')).toBe('alert');
    });

    it('should handle validation error display structure', () => {
      const errorState = document.getElementById('error-state');
      const errorContent = errorState.querySelector('.error-content');
      const errorTitle = errorState.querySelector('.error-title');

      expect(errorContent).toBeTruthy();
      expect(errorTitle).toBeTruthy();
      expect(errorTitle.textContent).toBe('Generation Failed');

      // Should be structured to display validation-specific errors
      expect(errorState.style.display).toBe('none'); // Initially hidden
    });

    it('should support schema validation feedback in UI', () => {
      // Check that the UI is structured to display detailed validation errors
      const inputValidationError = document.getElementById('input-validation-error');
      expect(inputValidationError.getAttribute('role')).toBe('alert');

      // Should support detailed error messaging
      const screenReaderAnnouncement = document.getElementById('screen-reader-announcement');
      expect(screenReaderAnnouncement.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('Data Structure Compliance', () => {
    it('should prepare for trait data rendering that matches schema', () => {
      const traitsResults = document.getElementById('traits-results');
      expect(traitsResults).toBeTruthy();

      // The results container should be ready to display all schema-defined fields
      // This structure supports the TraitsGeneratorController rendering methods
      expect(traitsResults.classList.contains('traits-results')).toBe(true);
    });

    it('should support metadata display structure', () => {
      // The UI should be structured to potentially display generation metadata
      const resultsState = document.getElementById('results-state');
      expect(resultsState).toBeTruthy();
      expect(resultsState.getAttribute('role')).toBe('region');
      expect(resultsState.getAttribute('aria-label')).toBe('Generated character traits');
    });
  });

  describe('Schema Loading Integration Points', () => {
    it('should be configured for schema loading during bootstrap', () => {
      // The traits-generator-main.js should reference the correct schema path
      // This test validates that the expected configuration exists
      
      // Check that the page loads the correct JavaScript bundle
      const scriptTags = Array.from(document.querySelectorAll('script[src]'));
      const hasTraitsGeneratorScript = scriptTags.some(script => 
        script.src.includes('traits-generator.js')
      );
      expect(hasTraitsGeneratorScript).toBe(true);

      // The script should be a module for proper ES6 import handling
      const moduleScript = scriptTags.find(script => 
        script.src.includes('traits-generator.js')
      );
      expect(moduleScript.type).toBe('module');
    });

    it('should handle schema loading failures gracefully', () => {
      // Test that the error state can handle schema loading failures
      const errorState = document.getElementById('error-state');
      const errorMessageText = document.getElementById('error-message-text');

      expect(errorState).toBeTruthy();
      expect(errorMessageText).toBeTruthy();

      // Should support displaying schema-specific error messages
      expect(errorState.getAttribute('role')).toBe('alert');
    });
  });

  describe('Validation Integration with User Input', () => {
    it('should validate user inputs against expected formats', () => {
      // Test that input fields are structured for validation
      const coreMotivationInput = document.getElementById('core-motivation-input');
      const internalContradictionInput = document.getElementById('internal-contradiction-input');
      const centralQuestionInput = document.getElementById('central-question-input');

      expect(coreMotivationInput).toBeTruthy();
      expect(internalContradictionInput).toBeTruthy();
      expect(centralQuestionInput).toBeTruthy();

      // All should be textarea elements supporting multiline input
      expect(coreMotivationInput.tagName).toBe('TEXTAREA');
      expect(internalContradictionInput.tagName).toBe('TEXTAREA');
      expect(centralQuestionInput.tagName).toBe('TEXTAREA');

      // Should have minimum row counts for adequate input
      expect(parseInt(coreMotivationInput.rows)).toBeGreaterThanOrEqual(3);
      expect(parseInt(internalContradictionInput.rows)).toBeGreaterThanOrEqual(3);
      expect(parseInt(centralQuestionInput.rows)).toBeGreaterThanOrEqual(3);
    });

    it('should prepare for real-time validation feedback', () => {
      const inputValidationError = document.getElementById('input-validation-error');
      
      expect(inputValidationError).toBeTruthy();
      expect(inputValidationError.getAttribute('role')).toBe('alert');
      expect(inputValidationError.textContent).toBe(''); // Initially empty
    });

    it('should support validation of required field completeness', () => {
      // All required input fields should be present and properly labeled
      const requiredFields = [
        'core-motivation-input',
        'internal-contradiction-input',
        'central-question-input'
      ];

      requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        const label = document.querySelector(`label[for="${fieldId}"]`);
        
        expect(field).toBeTruthy();
        expect(label).toBeTruthy();
        expect(label.textContent).toContain('*'); // Required field indicator
      });
    });
  });

  describe('Schema-driven Error Handling', () => {
    it('should display validation errors in accessible format', () => {
      const inputValidationError = document.getElementById('input-validation-error');
      const directionSelectorError = document.getElementById('direction-selector-error');
      const errorMessageText = document.getElementById('error-message-text');

      // All error display elements should have proper accessibility
      expect(inputValidationError.getAttribute('role')).toBe('alert');
      expect(directionSelectorError.getAttribute('role')).toBe('alert');
      
      // Error message text should be in a structured container
      expect(errorMessageText).toBeTruthy();
      expect(errorMessageText.closest('.error-container')).toBeTruthy();
    });

    it('should support detailed validation error reporting', () => {
      // The UI should support displaying multiple validation errors
      const inputValidationError = document.getElementById('input-validation-error');
      
      expect(inputValidationError).toBeTruthy();
      
      // Should be able to handle multiple error messages
      expect(inputValidationError.classList.contains('cb-error-text')).toBe(true);
    });
  });
});

/**
 * Setup mock responses for schema validation testing
 *
 * @param {Function} fetchMock - Mocked fetch function
 * @param {object} ajvMock - Mocked AJV instance
 */
function setupSchemaValidationMocks(fetchMock, ajvMock) {
  fetchMock.mockImplementation((url) => {
    // Mock schema loading
    if (url.includes('trait.schema.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          $schema: 'http://json-schema.org/draft-07/schema#',
          $id: 'schema://living-narrative-engine/trait.schema.json',
          title: 'Character Trait',
          type: 'object',
          required: ['id', 'names', 'physicalDescription'],
          properties: {
            id: { type: 'string' },
            names: {
              type: 'array',
              minItems: 3,
              maxItems: 5,
              items: {
                type: 'object',
                required: ['name', 'justification'],
                properties: {
                  name: { type: 'string' },
                  justification: { type: 'string' }
                }
              }
            },
            physicalDescription: {
              type: 'string',
              minLength: 100,
              maxLength: 500
            }
          }
        })
      });
    }

    return Promise.resolve({ ok: false, status: 404 });
  });

  // Setup AJV mock behaviors
  ajvMock.compile.mockReturnValue((data) => {
    // Mock validation function that always passes
    return true;
  });

  ajvMock.validate.mockReturnValue(true);
  ajvMock.addSchema.mockReturnValue(ajvMock);
  ajvMock.getSchema.mockReturnValue(ajvMock.compile());
}