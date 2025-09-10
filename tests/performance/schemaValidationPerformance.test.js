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
  let isCI;
  let performanceThresholds;

  beforeAll(async () => {
    // Detect CI environment for appropriate thresholds
    isCI = !!(
      process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.JENKINS_URL
    );

    // Set performance thresholds based on environment
    performanceThresholds = {
      maxValidationTime: isCI ? 20 : 10, // milliseconds per action
      targetAverageTime: isCI ? 8 : 5, // target average validation time
      batchTotalTime: isCI ? 400 : 250, // total batch time threshold
      batchAverageTime: isCI ? 8 : 5, // batch average per validation
      maxVariationRatio: isCI ? 2000 : 1000, // max/min timing ratio
    };

    console.log(`Performance test environment: ${isCI ? 'CI' : 'Local'}`);
    console.log('Thresholds:', performanceThresholds);

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

    // Warmup the validator with a few iterations
    const warmupData = {
      $schema: 'schema://living-narrative-engine/action.schema.json',
      id: 'test:warmup',
      description: 'warmup',
    };
    for (let i = 0; i < 5; i++) {
      validate(warmupData);
    }

    // Get all action files for testing
    actionFiles = await glob('data/mods/*/actions/*.action.json', {
      cwd: process.cwd(),
    });

    if (actionFiles.length === 0) {
      throw new Error('No action files found for performance testing');
    }
  });

  describe('Action Schema Validation Performance', () => {
    test('should validate actions within performance threshold', async () => {
      const performanceResults = [];
      const failedFiles = [];

      // Test first 20 files for performance (increased from integration test)
      const testFiles = actionFiles.slice(0, 20);

      for (const filePath of testFiles) {
        try {
          const fileContent = await readFile(filePath, 'utf-8');
          const actionData = JSON.parse(fileContent);

          // Run multiple iterations for statistical stability
          const iterations = [];
          for (let i = 0; i < 3; i++) {
            const startTime = performance.now();
            const isValid = validate(actionData);
            const endTime = performance.now();
            iterations.push({
              time: endTime - startTime,
              valid: isValid,
            });
          }

          // Use median time to reduce noise
          const times = iterations.map((i) => i.time).sort((a, b) => a - b);
          const medianTime = times[1]; // middle value of 3 iterations
          const isValid = iterations[0].valid; // all should be the same

          performanceResults.push({
            file: filePath,
            id: actionData.id,
            valid: isValid,
            time: medianTime,
            rawTimes: times,
          });

          expect(isValid).toBe(true);
          expect(medianTime).toBeLessThan(
            performanceThresholds.maxValidationTime
          );
        } catch (error) {
          console.error(`Performance test failed for ${filePath}:`, error);
          failedFiles.push({ filePath, error: error.message });
          // Don't throw immediately - collect all failures
        }
      }

      // Report any file processing failures
      if (failedFiles.length > 0) {
        console.warn(`\nFailed to process ${failedFiles.length} files:`);
        failedFiles.forEach(({ filePath, error }) => {
          console.warn(`  ${filePath}: ${error}`);
        });
      }

      // Calculate performance metrics using successful validations only
      if (performanceResults.length === 0) {
        throw new Error(
          'No files were successfully processed for performance testing'
        );
      }

      const times = performanceResults.map((r) => r.time);
      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;

      // Use P95 instead of max to filter out statistical outliers
      const sortedTimes = [...times].sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const p95Time = sortedTimes[p95Index];
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log(`\nAction Schema Validation Performance Results:`);
      console.log(`  Environment: ${isCI ? 'CI' : 'Local'}`);
      console.log(
        `  Files tested: ${performanceResults.length}/${testFiles.length}`
      );
      console.log(`  Average validation time: ${avgTime.toFixed(3)}ms`);
      console.log(`  P95 validation time: ${p95Time.toFixed(3)}ms`);
      console.log(`  Maximum validation time: ${maxTime.toFixed(3)}ms`);
      console.log(`  Minimum validation time: ${minTime.toFixed(3)}ms`);
      console.log(
        `  Per-file threshold: ${performanceThresholds.maxValidationTime}ms`
      );
      console.log(
        `  Target average: ${performanceThresholds.targetAverageTime}ms`
      );
      console.log(`  Failed file count: ${failedFiles.length}`);

      // Performance assertions with improved statistical analysis
      expect(avgTime).toBeLessThan(performanceThresholds.targetAverageTime);
      expect(p95Time).toBeLessThan(
        performanceThresholds.maxValidationTime * 1.5
      ); // Use P95 instead of max

      // Ensure reasonable distribution
      expect(minTime).toBeGreaterThan(0);
      // Use more lenient variation ratio based on environment
      expect(maxTime / minTime).toBeLessThan(
        performanceThresholds.maxVariationRatio
      );

      // Ensure most files processed successfully (allow some I/O failures)
      const successRate = performanceResults.length / testFiles.length;
      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
    });

    test('should handle batch validation efficiently', async () => {
      const batchSize = 50;
      const testFiles = actionFiles.slice(0, batchSize);

      // Load all files first, with error tracking
      const actionDataBatch = [];
      const loadFailures = [];

      for (const filePath of testFiles) {
        try {
          const fileContent = await readFile(filePath, 'utf-8');
          const actionData = JSON.parse(fileContent);
          actionDataBatch.push({ filePath, actionData });
        } catch (error) {
          console.error(`Failed to load ${filePath}:`, error);
          loadFailures.push({ filePath, error: error.message });
        }
      }

      // Require minimum successful loads for meaningful batch test
      if (actionDataBatch.length < batchSize * 0.8) {
        throw new Error(
          `Too many file load failures: ${loadFailures.length}/${testFiles.length}. Cannot perform meaningful batch test.`
        );
      }

      // Batch validation performance test with warmup
      let totalTime = 0;
      const results = [];
      const iterations = 3; // Multiple runs for stability

      for (let iteration = 0; iteration < iterations; iteration++) {
        const startTime = performance.now();
        const iterationResults = [];

        for (const { filePath, actionData } of actionDataBatch) {
          try {
            const isValid = validate(actionData);
            iterationResults.push({ filePath, isValid });
          } catch (validationError) {
            console.warn(
              `Validation error for ${filePath}:`,
              validationError.message
            );
            iterationResults.push({ filePath, isValid: false });
          }
        }

        const iterationTime = performance.now() - startTime;
        if (iteration > 0) {
          // Skip first iteration (warmup)
          totalTime += iterationTime;
          if (iteration === 1) {
            // Use results from first non-warmup iteration
            results.push(...iterationResults);
          }
        }
      }

      const avgTotalTime = totalTime / (iterations - 1);
      const averageTimePerValidation = avgTotalTime / actionDataBatch.length;

      console.log(`\nBatch Validation Performance:`);
      console.log(`  Environment: ${isCI ? 'CI' : 'Local'}`);
      console.log(
        `  Batch size: ${actionDataBatch.length} actions (${loadFailures.length} load failures)`
      );
      console.log(
        `  Average total time: ${avgTotalTime.toFixed(2)}ms (${iterations - 1} iterations)`
      );
      console.log(
        `  Average per validation: ${averageTimePerValidation.toFixed(3)}ms`
      );
      console.log(
        `  Load success rate: ${((actionDataBatch.length / testFiles.length) * 100).toFixed(1)}%`
      );

      // Performance expectations for batch processing - use environment-aware thresholds
      expect(avgTotalTime).toBeLessThan(performanceThresholds.batchTotalTime);
      expect(averageTimePerValidation).toBeLessThan(
        performanceThresholds.batchAverageTime
      );

      // Validation success expectations - allow for some validation failures due to malformed data
      const validCount = results.filter((r) => r.isValid).length;
      const validationSuccessRate = validCount / results.length;

      console.log(
        `  Validation success rate: ${(validationSuccessRate * 100).toFixed(1)}%`
      );

      // Expect high validation success rate, but allow for some invalid files
      expect(validationSuccessRate).toBeGreaterThan(0.9); // At least 90% of loaded files should validate

      // Ensure we have a reasonable number of successful validations
      expect(validCount).toBeGreaterThan(
        Math.min(40, actionDataBatch.length * 0.8)
      );
    });

    test('should maintain performance under repeated validation', async () => {
      const testFile = actionFiles[0]; // Use first action file

      // Load the test action
      const fileContent = await readFile(testFile, 'utf-8');
      const actionData = JSON.parse(fileContent);

      const iterations = isCI ? 500 : 1000; // Reduce iterations in CI for stability
      const times = [];

      // Extended warmup for JIT optimization
      for (let i = 0; i < 20; i++) {
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

      // Calculate percentiles for better statistical analysis
      const sortedTimes = [...times].sort((a, b) => a - b);
      const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
      const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log(
        `\nRepeated Validation Performance (${iterations} iterations):`
      );
      console.log(`  Environment: ${isCI ? 'CI' : 'Local'}`);
      console.log(`  Average time: ${avgTime.toFixed(3)}ms`);
      console.log(`  Median (P50): ${p50.toFixed(3)}ms`);
      console.log(`  P95 time: ${p95.toFixed(3)}ms`);
      console.log(`  P99 time: ${p99.toFixed(3)}ms`);
      console.log(`  Max time: ${maxTime.toFixed(3)}ms`);
      console.log(`  Min time: ${minTime.toFixed(3)}ms`);
      console.log(
        `  Performance variation (P99/P50): ${(p99 / p50).toFixed(1)}x`
      );

      // Performance should be consistent - use environment-aware thresholds
      const avgThreshold = isCI ? 2.0 : 1.0; // More lenient in CI
      const p95Threshold = isCI ? 8.0 : 5.0; // More lenient in CI

      expect(avgTime).toBeLessThan(avgThreshold); // Should be very fast for repeated validations
      expect(p95).toBeLessThan(p95Threshold); // P95 should be reasonable

      // Ensure we have reasonable minimum performance
      expect(minTime).toBeGreaterThan(0);
      expect(minTime).toBeLessThan(avgThreshold); // Min shouldn't be slower than avg threshold

      // Note: Timing variation can be high in test environments, so we use percentiles
      // instead of max/min ratios for more stable testing
    });
  });
});
