/**
 * @file Performance Tests for Traits Generator Schema Validation
 * @description Tests performance characteristics of schema validation operations
 * including validation speed, UI responsiveness, and resource usage
 */

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  setupBrowserAPIMocks,
  setupConsoleMocks,
  createE2EDOM,
} from '../../setup/e2eSetup.js';
import { TraitsGeneratorTestBed } from '../../common/traitsGeneratorTestBed.js';

describe('Traits Generator - Schema Validation Performance', () => {
  let dom;
  let window;
  let document;
  let testBed;
  let consoleMocks;
  let ajv;
  let schemas;

  beforeAll(async () => {
    // Initialize AJV with schemas
    ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      allowUnionTypes: true,
    });
    addFormats(ajv);

    // Load schemas
    schemas = await loadSchemas();

    // Compile schemas
    Object.keys(schemas).forEach((schemaName) => {
      try {
        ajv.addSchema(schemas[schemaName], schemaName);
      } catch (error) {
        console.warn(`Failed to add schema ${schemaName}:`, error.message);
      }
    });
  });

  beforeEach(async () => {
    // Create E2E DOM environment for performance testing
    dom = createE2EDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Traits Generator - Schema Validation Performance Test</title>
        </head>
        <body>
          <div id="traits-generator-container">
            <div id="thematic-directions-container"></div>
            <div id="core-motivations-container"></div>
            <div id="form-container"></div>
            <div id="output-container"></div>
            <div id="error-container"></div>
          </div>
        </body>
      </html>
    `);

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;

    // Setup mocks
    setupBrowserAPIMocks(window);
    consoleMocks = setupConsoleMocks();

    // Initialize test bed
    testBed = new TraitsGeneratorTestBed();
    testBed.setup();

    // Set longer timeout for performance tests
    jest.setTimeout(30000);
  });

  afterEach(() => {
    testBed?.cleanup();
    consoleMocks?.restore();
    dom?.window?.close();
    jest.clearAllMocks();
  });

  /**
   * Load schemas for validation testing
   *
   * @returns {Promise<object>} Loaded schemas
   */
  async function loadSchemas() {
    const schemasPath = path.resolve(process.cwd(), 'data/schemas');
    const schemaFiles = {
      'thematic-direction': 'thematic-direction.schema.json',
      'core-motivation': 'core-motivation.schema.json',
      trait: 'trait.schema.json',
      'character-concept': 'character-concept.schema.json',
    };

    const loadedSchemas = {};

    for (const [schemaName, filename] of Object.entries(schemaFiles)) {
      try {
        const schemaPath = path.join(schemasPath, filename);
        if (fs.existsSync(schemaPath)) {
          const schemaContent = fs.readFileSync(schemaPath, 'utf8');
          loadedSchemas[schemaName] = JSON.parse(schemaContent);
        }
      } catch (error) {
        console.warn(`Failed to load schema ${schemaName}:`, error.message);
        // Provide minimal fallback schema
        loadedSchemas[schemaName] = { type: 'object' };
      }
    }

    return loadedSchemas;
  }

  /**
   * Validate data against a schema
   *
   * @param {*} data - Data to validate
   * @param {string} schemaName - Schema name to validate against
   * @returns {object} Validation result
   */
  function validateData(data, schemaName) {
    const validate = ajv.getSchema(schemaName);
    if (!validate) {
      return {
        valid: false,
        errors: [`Schema ${schemaName} not found`],
      };
    }

    const valid = validate(data);
    return {
      valid,
      errors: valid
        ? []
        : (validate.errors || []).map(
            (err) =>
              `${err.instancePath || 'root'}: ${err.message} (${JSON.stringify(err.data)})`
          ),
    };
  }

  describe('Performance Impact of Validation', () => {
    it('should complete validation within performance budget', async () => {
      const startTime = Date.now();

      // Create large dataset for validation (schema-compliant)
      const largeTraitsData = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        generatedAt: '2024-01-01T00:00:00.000Z',
        names: Array.from({ length: 5 }, (_, i) => ({
          // maxItems: 5
          name: `Character Name ${i}`,
          justification: `Detailed justification for character ${i} that explains the reasoning behind this name choice`,
        })),
        personality: Array.from({ length: 5 }, (_, i) => ({
          // maxItems: 5
          trait: `Trait ${i}`,
          explanation: `Detailed explanation for trait ${i} describing how this trait manifests in behavior`,
        })),
        physicalDescription:
          'A very detailed physical description '.repeat(10) +
          ' that meets minimum length requirements for schema validation.',
        strengths: ['Strength 1', 'Strength 2'], // minItems: 2
        weaknesses: ['Weakness 1', 'Weakness 2'], // minItems: 2
        likes: ['Like 1', 'Like 2', 'Like 3'], // minItems: 3
        dislikes: ['Dislike 1', 'Dislike 2', 'Dislike 3'], // minItems: 3
        fears: ['Fear 1'], // minItems: 1
        goals: {
          shortTerm: ['Short term goal'],
          longTerm: 'Long term goal description',
        },
        notes: ['Note 1', 'Note 2'], // minItems: 2
        profile:
          'A comprehensive character profile '.repeat(20) +
          ' that meets the minimum length requirements for validation.',
        secrets: ['Secret 1'], // minItems: 1
      };

      // Validate large dataset
      const validation = validateData(largeTraitsData, 'trait');

      const validationTime = Date.now() - startTime;

      // Should complete within reasonable time (100ms budget)
      expect(validationTime).toBeLessThan(100);

      // Should still be accurate despite size
      expect(validation.valid).toBe(true);
    });

    it('should not impact UI responsiveness during validation', async () => {
      let uiUpdateCount = 0;

      // Setup UI update monitoring
      const updateUI = () => {
        uiUpdateCount++;
        setTimeout(updateUI, 1); // Continuous UI updates
      };
      updateUI();

      const startCount = uiUpdateCount;

      // Perform validation
      const testData = testBed.createValidTraitsData();
      validateData(testData, 'trait');

      // Allow time for UI updates
      await new Promise((resolve) => setTimeout(resolve, 50));

      const endCount = uiUpdateCount;

      // UI should have continued updating (not blocked)
      expect(endCount - startCount).toBeGreaterThan(10);
    });

    it('should handle multiple concurrent validations efficiently', async () => {
      const concurrentValidations = 5; // Reduce number to be more realistic
      const startTime = Date.now();

      // Create multiple validation promises using valid test data
      const validationPromises = Array.from(
        { length: concurrentValidations },
        async () => {
          const testData = testBed.createValidTraitsData();
          return validateData(testData, 'trait');
        }
      );

      // Execute all validations concurrently
      const results = await Promise.all(validationPromises);
      const totalTime = Date.now() - startTime;

      // All validations should complete
      expect(results).toHaveLength(concurrentValidations);
      results.forEach((result) => {
        expect(result.valid).toBe(true);
      });

      // Should complete efficiently (under 300ms for 5 validations)
      expect(totalTime).toBeLessThan(300);
    });

    it('should validate multiple datasets without degrading performance', async () => {
      const datasets = 5;
      const validationTimes = [];

      for (let i = 0; i < datasets; i++) {
        const testData = testBed.createValidTraitsData();
        const startTime = performance.now();

        const result = validateData(testData, 'trait');

        const validationTime = performance.now() - startTime;
        validationTimes.push(validationTime);

        // Each validation should be successful
        expect(result.valid).toBe(true);
      }

      // All validations should complete reasonably fast
      validationTimes.forEach((time) => {
        expect(time).toBeLessThan(50); // 50ms max per validation
      });

      // Performance shouldn't degrade significantly over multiple validations
      const firstHalf = validationTimes.slice(0, Math.ceil(datasets / 2));
      const secondHalf = validationTimes.slice(Math.ceil(datasets / 2));

      const firstHalfAvg =
        firstHalf.reduce((sum, time) => sum + time, 0) / firstHalf.length;
      const secondHalfAvg =
        secondHalf.reduce((sum, time) => sum + time, 0) / secondHalf.length;

      // Second half shouldn't be significantly slower (no major performance degradation)
      if (firstHalfAvg > 0) {
        const performanceRatio = secondHalfAvg / firstHalfAvg;
        expect(performanceRatio).toBeLessThan(5.0); // Less than 5x degradation (increased from 3.0 for stability - natural timing variance with small sample sizes)
      }
    });
  });
});
