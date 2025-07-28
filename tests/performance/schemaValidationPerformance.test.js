/**
 * @file Performance tests for schema validation
 * @description Tests schema validation performance extracted from integration tests
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { readFile } from 'fs/promises';
import { glob } from 'glob';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import actionSchema from '../../data/schemas/action.schema.json';
import commonSchema from '../../data/schemas/common.schema.json';
import conditionContainerSchema from '../../data/schemas/condition-container.schema.json';
import jsonLogicSchema from '../../data/schemas/json-logic.schema.json';

describe('Schema Validation Performance Tests', () => {
  let validate;
  let actionFiles;

  beforeAll(async () => {
    // Set up AJV with all required schemas
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);

    // Add all required schemas
    ajv.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );
    ajv.addSchema(
      jsonLogicSchema,
      'schema://living-narrative-engine/json-logic.schema.json'
    );
    ajv.addSchema(
      conditionContainerSchema,
      'schema://living-narrative-engine/condition-container.schema.json'
    );

    validate = ajv.compile(actionSchema);

    // Get all action files for testing
    actionFiles = await glob('data/mods/*/actions/*.action.json', {
      cwd: process.cwd(),
    });
    expect(actionFiles.length).toBeGreaterThan(0);
  });

  describe('Action Schema Validation Performance', () => {
    test('should validate actions within performance threshold', async () => {
      const performanceResults = [];
      const maxValidationTime = 5; // milliseconds per action

      // Test first 20 files for performance (increased from integration test)
      const testFiles = actionFiles.slice(0, 20);

      for (const filePath of testFiles) {
        try {
          const fileContent = await readFile(filePath, 'utf-8');
          const actionData = JSON.parse(fileContent);

          const startTime = performance.now();
          const isValid = validate(actionData);
          const endTime = performance.now();

          const validationTime = endTime - startTime;

          performanceResults.push({
            file: filePath,
            id: actionData.id,
            valid: isValid,
            time: validationTime,
          });

          expect(isValid).toBe(true);
          expect(validationTime).toBeLessThan(maxValidationTime);
        } catch (error) {
          console.error(`Performance test failed for ${filePath}:`, error);
          throw error;
        }
      }

      // Calculate performance metrics
      const avgTime =
        performanceResults.reduce((sum, r) => sum + r.time, 0) /
        performanceResults.length;
      const maxTime = Math.max(...performanceResults.map((r) => r.time));
      const minTime = Math.min(...performanceResults.map((r) => r.time));

      console.log(`\nAction Schema Validation Performance Results:`);
      console.log(`  Files tested: ${performanceResults.length}`);
      console.log(`  Average validation time: ${avgTime.toFixed(3)}ms`);
      console.log(`  Maximum validation time: ${maxTime.toFixed(3)}ms`);
      console.log(`  Minimum validation time: ${minTime.toFixed(3)}ms`);
      console.log(`  Threshold: ${maxValidationTime}ms`);

      // Performance assertions
      expect(avgTime).toBeLessThan(maxValidationTime);
      expect(maxTime).toBeLessThan(maxValidationTime);

      // Ensure reasonable distribution
      expect(minTime).toBeGreaterThan(0);
      expect(maxTime / minTime).toBeLessThan(500); // Reasonable variation for performance tests
    });

    test('should handle batch validation efficiently', async () => {
      const batchSize = 50;
      const testFiles = actionFiles.slice(0, batchSize);

      // Load all files first
      const actionDataBatch = [];
      for (const filePath of testFiles) {
        try {
          const fileContent = await readFile(filePath, 'utf-8');
          const actionData = JSON.parse(fileContent);
          actionDataBatch.push({ filePath, actionData });
        } catch (error) {
          console.error(`Failed to load ${filePath}:`, error);
        }
      }

      // Batch validation performance test
      const startTime = performance.now();
      const results = [];

      for (const { filePath, actionData } of actionDataBatch) {
        const isValid = validate(actionData);
        results.push({ filePath, isValid });
      }

      const totalTime = performance.now() - startTime;
      const averageTimePerValidation = totalTime / actionDataBatch.length;

      console.log(`\nBatch Validation Performance:`);
      console.log(`  Batch size: ${actionDataBatch.length} actions`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(
        `  Average per validation: ${averageTimePerValidation.toFixed(3)}ms`
      );

      // Performance expectations for batch processing
      expect(totalTime).toBeLessThan(250); // Total batch should be < 250ms
      expect(averageTimePerValidation).toBeLessThan(5); // Average should still be < 5ms

      // All validations should succeed
      const validCount = results.filter((r) => r.isValid).length;
      expect(validCount).toBe(actionDataBatch.length);
    });

    test('should maintain performance under repeated validation', async () => {
      const testFile = actionFiles[0]; // Use first action file

      // Load the test action
      const fileContent = await readFile(testFile, 'utf-8');
      const actionData = JSON.parse(fileContent);

      const iterations = 1000;
      const times = [];

      // Warmup
      for (let i = 0; i < 10; i++) {
        validate(actionData);
      }

      // Measure repeated validations
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const isValid = validate(actionData);
        const time = performance.now() - start;

        times.push(time);
        expect(isValid).toBe(true);
      }

      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log(
        `\nRepeated Validation Performance (${iterations} iterations):`
      );
      console.log(`  Average time: ${avgTime.toFixed(3)}ms`);
      console.log(`  Max time: ${maxTime.toFixed(3)}ms`);
      console.log(`  Min time: ${minTime.toFixed(3)}ms`);
      console.log(`  Performance variation: ${(maxTime / minTime - 1) * 100}%`);

      // Performance should be consistent
      expect(avgTime).toBeLessThan(1); // Should be very fast for repeated validations
      expect(maxTime).toBeLessThan(5); // Even max should be reasonable
      // Note: Timing variation can be high in test environments
    });
  });
});
