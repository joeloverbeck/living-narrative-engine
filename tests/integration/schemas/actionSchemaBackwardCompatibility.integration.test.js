// tests/integration/schemas/actionSchemaBackwardCompatibility.integration.test.js
// -----------------------------------------------------------------------------
// Integration tests to verify all existing action files continue to validate
// with the updated multi-target schema
// -----------------------------------------------------------------------------

import { describe, test, expect, beforeAll } from '@jest/globals';
import { glob } from 'glob';
import { readFile } from 'fs/promises';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import actionSchema from '../../../data/schemas/action.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';

describe('Action Schema Backward Compatibility Integration', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  /** @type {string[]} */
  let actionFiles = [];

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

    // Find all action files in the project
    actionFiles = await glob('data/mods/*/actions/*.action.json', {
      cwd: process.cwd(),
    });
  });

  test('should find action files to validate', () => {
    expect(actionFiles.length).toBeGreaterThan(0);
    console.log(`Found ${actionFiles.length} action files to validate`);
  });

  describe('Existing Action Files Validation', () => {
    test('should validate all existing action files with updated schema', async () => {
      const validationResults = [];

      for (const filePath of actionFiles) {
        try {
          const fileContent = await readFile(filePath, 'utf-8');
          const actionData = JSON.parse(fileContent);

          const isValid = validate(actionData);

          if (!isValid) {
            const errorMessage = `Validation failed for ${filePath}: ${validate.errors?.map((e) => e.message).join(', ')}`;
            validationResults.push({
              file: filePath,
              valid: false,
              errors: validate.errors,
              action: actionData,
              errorMessage,
            });
          } else {
            validationResults.push({
              file: filePath,
              valid: true,
              action: actionData,
            });
          }
        } catch (error) {
          console.error(`Error processing ${filePath}:`, error);
          validationResults.push({
            file: filePath,
            valid: false,
            error: error.message,
          });
        }
      }

      // Report summary
      const validFiles = validationResults.filter((r) => r.valid);
      const invalidFiles = validationResults.filter((r) => !r.valid);

      console.log(`Validation Summary:`);
      console.log(
        `  Valid files: ${validFiles.length}/${validationResults.length}`
      );
      console.log(
        `  Invalid files: ${invalidFiles.length}/${validationResults.length}`
      );

      if (invalidFiles.length > 0) {
        invalidFiles.forEach((result) => {
          console.error(
            `INVALID: ${result.file} - ${result.errorMessage || result.error}`
          );
          if (result.errors) {
            result.errors.forEach((error) => {
              console.error(
                `  - ${error.message} at ${error.instancePath || 'root'}`
              );
            });
          }
        });

        // Throw error with detailed information
        const errorDetails = invalidFiles
          .map((f) => `${f.file}: ${f.errorMessage || f.error}`)
          .join('\n');
        throw new Error(
          `Schema validation failed for ${invalidFiles.length} files:\n${errorDetails}`
        );
      }

      // All files should validate successfully
      expect(invalidFiles.length).toBe(0);
      expect(validFiles.length).toBe(actionFiles.length);
    });
  });

  describe('Legacy Properties Detection', () => {
    test('should identify actions still using legacy scope property', async () => {
      const legacyActions = [];
      const newFormatActions = [];

      for (const filePath of actionFiles) {
        try {
          const fileContent = await readFile(filePath, 'utf-8');
          const actionData = JSON.parse(fileContent);

          if (actionData.scope && !actionData.targets) {
            legacyActions.push({
              file: filePath,
              id: actionData.id,
              scope: actionData.scope,
            });
          } else if (actionData.targets) {
            newFormatActions.push({
              file: filePath,
              id: actionData.id,
              targets: actionData.targets,
              isMultiTarget: typeof actionData.targets === 'object',
            });
          }
        } catch (error) {
          console.error(`Error processing ${filePath}:`, error);
        }
      }

      console.log(`\nProperty Usage Summary:`);
      console.log(`  Legacy 'scope' property: ${legacyActions.length} actions`);
      console.log(
        `  New 'targets' property: ${newFormatActions.length} actions`
      );

      const multiTargetActions = newFormatActions.filter(
        (a) => a.isMultiTarget
      );
      console.log(
        `  Multi-target format: ${multiTargetActions.length} actions`
      );

      // Log some examples for reference
      if (legacyActions.length > 0) {
        console.log(`\nLegacy actions (first 5):`);
        legacyActions.slice(0, 5).forEach((action) => {
          console.log(
            `  - ${action.id} (${action.file}): scope="${action.scope}"`
          );
        });
      }

      // This test just reports information, all existing actions should validate
      expect(legacyActions.length + newFormatActions.length).toBe(
        actionFiles.length
      );
    });
  });

  describe('Schema Compliance Verification', () => {
    test('should verify no actions have both scope and targets properties', async () => {
      const conflictingActions = [];

      for (const filePath of actionFiles) {
        try {
          const fileContent = await readFile(filePath, 'utf-8');
          const actionData = JSON.parse(fileContent);

          if (actionData.scope && actionData.targets) {
            conflictingActions.push({
              file: filePath,
              id: actionData.id,
              hasScope: !!actionData.scope,
              hasTargets: !!actionData.targets,
            });
          }
        } catch (error) {
          console.error(`Error processing ${filePath}:`, error);
        }
      }

      if (conflictingActions.length > 0) {
        console.log(`\nActions with conflicting properties:`);
        conflictingActions.forEach((action) => {
          console.log(
            `  - ${action.id} (${action.file}): has both scope and targets`
          );
        });
      }

      // No actions should have both properties
      expect(conflictingActions.length).toBe(0);
    });

    test('should verify all actions have required targeting property', async () => {
      const missingTargetingActions = [];

      for (const filePath of actionFiles) {
        try {
          const fileContent = await readFile(filePath, 'utf-8');
          const actionData = JSON.parse(fileContent);

          if (!actionData.scope && !actionData.targets) {
            missingTargetingActions.push({
              file: filePath,
              id: actionData.id,
            });
          }
        } catch (error) {
          console.error(`Error processing ${filePath}:`, error);
        }
      }

      if (missingTargetingActions.length > 0) {
        console.log(`\nActions missing targeting properties:`);
        missingTargetingActions.forEach((action) => {
          console.log(
            `  - ${action.id} (${action.file}): missing both scope and targets`
          );
        });
      }

      // All actions should have either scope or targets
      expect(missingTargetingActions.length).toBe(0);
    });
  });

  describe('Performance Verification', () => {
    test('should validate actions within performance threshold', async () => {
      const performanceResults = [];
      const maxValidationTime = 5; // milliseconds per action

      for (const filePath of actionFiles.slice(0, 10)) {
        // Test first 10 for performance
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

      const avgTime =
        performanceResults.reduce((sum, r) => sum + r.time, 0) /
        performanceResults.length;
      const maxTime = Math.max(...performanceResults.map((r) => r.time));

      console.log(`\nPerformance Results:`);
      console.log(`  Average validation time: ${avgTime.toFixed(2)}ms`);
      console.log(`  Maximum validation time: ${maxTime.toFixed(2)}ms`);
      console.log(`  Threshold: ${maxValidationTime}ms`);

      expect(avgTime).toBeLessThan(maxValidationTime);
      expect(maxTime).toBeLessThan(maxValidationTime);
    });
  });
});
