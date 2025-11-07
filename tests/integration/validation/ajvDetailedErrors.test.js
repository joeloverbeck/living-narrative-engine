/**
 * @file Integration tests for detailed AJV validation error analysis
 * @description Deep-dive test to capture and analyze AJV validation errors
 * for the drinking rules that are failing in production. This test helps
 * identify the specific schema validation issues causing 956 errors per file.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { validateAgainstSchema } from '../../../src/utils/schemaValidationUtils.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);

// Load rule files
const drinkFromRulePath = join(
  currentDirPath,
  '../../../data/mods/items/rules/handle_drink_from.rule.json'
);
const drinkEntirelyRulePath = join(
  currentDirPath,
  '../../../data/mods/items/rules/handle_drink_entirely.rule.json'
);

describe('AJV Detailed Error Analysis for Drinking Rules', () => {
  describe('handle_drink_from.rule.json', () => {
    it('should capture detailed AJV validation errors', () => {
      const ruleContent = readFileSync(drinkFromRulePath, 'utf-8');
      const ruleData = JSON.parse(ruleContent);

      // Track validation result
      let validationError = null;

      try {
        // Attempt validation - this should expose the actual AJV errors
        validateAgainstSchema(
          ruleData,
          'schema://living-narrative-engine/rule.schema.json',
          {
            throwOnError: true,
            filePath: 'handle_drink_from.rule.json',
            context: { skipPreValidation: false }, // Enable pre-validation to see full flow
          }
        );
      } catch (error) {
        validationError = error;
      }

      // If validation failed, log detailed error information for debugging
      if (validationError) {
        console.error('\n=== DRINK_FROM VALIDATION ERROR ===');
        console.error('Error message:', validationError.message);
        console.error('Error stack:', validationError.stack);
        console.error('=====================================\n');

        // Test should document the error but allow us to see it
        expect(validationError).toBeDefined();
        expect(validationError.message).toBeTruthy();

        // Extract key information from error message
        const errorMsg = validationError.message;

        // Log what we learned
        console.log('\n=== ERROR ANALYSIS ===');
        console.log('Error type:', errorMsg.includes('Pre-validation') ? 'Pre-validation' : 'AJV Schema');
        console.log('Error contains operation type info:', errorMsg.includes('operation type'));
        console.log('Error contains path info:', errorMsg.includes('path') || errorMsg.includes('Location'));
        console.log('======================\n');
      } else {
        // If validation passed, that's actually what we want!
        console.log('\n✅ handle_drink_from.rule.json validated successfully!');
      }
    });

    it('should validate individual operations from the rule', () => {
      const ruleContent = readFileSync(drinkFromRulePath, 'utf-8');
      const ruleData = JSON.parse(ruleContent);

      const operations = ruleData.actions || [];
      console.log(`\n=== Validating ${operations.length} operations individually ===`);

      const operationResults = operations.map((operation, index) => {
        const hasType = operation.type !== undefined && operation.type !== '';
        const hasParameters = operation.parameters !== undefined;
        const typeInWhitelist = [
          'DRINK_FROM',
          'QUERY_COMPONENT',
          'GET_NAME',
          'SET_VARIABLE',
          'DISPATCH_PERCEPTIBLE_EVENT',
          'END_TURN',
        ].includes(operation.type);

        return {
          index,
          type: operation.type,
          hasType,
          hasParameters,
          typeInWhitelist,
          valid: hasType && hasParameters && typeInWhitelist,
        };
      });

      // Log results
      operationResults.forEach((result) => {
        const status = result.valid ? '✅' : '❌';
        console.log(
          `  ${status} Operation ${result.index}: ${result.type} (type: ${result.hasType}, params: ${result.hasParameters}, known: ${result.typeInWhitelist})`
        );
      });

      // All operations should be valid
      const invalidOperations = operationResults.filter((r) => !r.valid);
      expect(invalidOperations).toHaveLength(0);

      console.log('=================================================\n');
    });
  });

  describe('handle_drink_entirely.rule.json', () => {
    it('should capture detailed AJV validation errors', () => {
      const ruleContent = readFileSync(drinkEntirelyRulePath, 'utf-8');
      const ruleData = JSON.parse(ruleContent);

      let validationError = null;

      try {
        validateAgainstSchema(
          ruleData,
          'schema://living-narrative-engine/rule.schema.json',
          {
            throwOnError: true,
            filePath: 'handle_drink_entirely.rule.json',
            context: { skipPreValidation: false },
          }
        );
      } catch (error) {
        validationError = error;
      }

      if (validationError) {
        console.error('\n=== DRINK_ENTIRELY VALIDATION ERROR ===');
        console.error('Error message:', validationError.message);
        console.error('Error stack:', validationError.stack);
        console.error('========================================\n');

        expect(validationError).toBeDefined();
        expect(validationError.message).toBeTruthy();

        const errorMsg = validationError.message;
        console.log('\n=== ERROR ANALYSIS ===');
        console.log('Error type:', errorMsg.includes('Pre-validation') ? 'Pre-validation' : 'AJV Schema');
        console.log('Error contains operation type info:', errorMsg.includes('operation type'));
        console.log('Error contains path info:', errorMsg.includes('path') || errorMsg.includes('Location'));
        console.log('======================\n');
      } else {
        console.log('\n✅ handle_drink_entirely.rule.json validated successfully!');
      }
    });

    it('should validate individual operations from the rule', () => {
      const ruleContent = readFileSync(drinkEntirelyRulePath, 'utf-8');
      const ruleData = JSON.parse(ruleContent);

      const operations = ruleData.actions || [];
      console.log(`\n=== Validating ${operations.length} operations individually ===`);

      const operationResults = operations.map((operation, index) => {
        const hasType = operation.type !== undefined && operation.type !== '';
        const hasParameters = operation.parameters !== undefined;
        const typeInWhitelist = [
          'DRINK_ENTIRELY',
          'QUERY_COMPONENT',
          'GET_NAME',
          'SET_VARIABLE',
          'DISPATCH_PERCEPTIBLE_EVENT',
          'END_TURN',
        ].includes(operation.type);

        return {
          index,
          type: operation.type,
          hasType,
          hasParameters,
          typeInWhitelist,
          valid: hasType && hasParameters && typeInWhitelist,
        };
      });

      operationResults.forEach((result) => {
        const status = result.valid ? '✅' : '❌';
        console.log(
          `  ${status} Operation ${result.index}: ${result.type} (type: ${result.hasType}, params: ${result.hasParameters}, known: ${result.typeInWhitelist})`
        );
      });

      const invalidOperations = operationResults.filter((r) => !r.valid);
      expect(invalidOperations).toHaveLength(0);

      console.log('=================================================\n');
    });
  });

  describe('Pre-validation whitelist completeness', () => {
    it('should verify DRINK_FROM and DRINK_ENTIRELY are in KNOWN_OPERATION_TYPES', async () => {
      // Read preValidationUtils.js to check whitelist
      const preValidationUtilsPath = join(
        currentDirPath,
        '../../../src/utils/preValidationUtils.js'
      );
      const preValidationContent = readFileSync(preValidationUtilsPath, 'utf-8');

      // Check if operations are in the whitelist
      const hasDrinkFrom = preValidationContent.includes("'DRINK_FROM'");
      const hasDrinkEntirely = preValidationContent.includes("'DRINK_ENTIRELY'");

      console.log('\n=== PRE-VALIDATION WHITELIST CHECK ===');
      console.log(`DRINK_FROM in whitelist: ${hasDrinkFrom ? '✅' : '❌'}`);
      console.log(`DRINK_ENTIRELY in whitelist: ${hasDrinkEntirely ? '✅' : '❌'}`);
      console.log('=====================================\n');

      expect(hasDrinkFrom).toBe(true);
      expect(hasDrinkEntirely).toBe(true);
    });
  });
});
