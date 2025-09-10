// tests/integration/schemas/actionSchemaBackwardCompatibility.integration.test.js
// -----------------------------------------------------------------------------
// Integration tests to verify all existing action files validate with the current
// action schema. All actions now use the new 'targets' format.
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

describe('Action Schema Validation Integration', () => {
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

  describe('Action Files Schema Validation', () => {
    test('should validate all existing action files against current schema', async () => {
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

  describe('Action Format Analysis', () => {
    test('should report action format usage (all actions now use targets format)', async () => {
      const stringTargetActions = [];
      const objectTargetActions = [];

      for (const filePath of actionFiles) {
        try {
          const fileContent = await readFile(filePath, 'utf-8');
          const actionData = JSON.parse(fileContent);

          if (actionData.targets) {
            if (typeof actionData.targets === 'string') {
              stringTargetActions.push({
                file: filePath,
                id: actionData.id,
                targets: actionData.targets,
              });
            } else if (typeof actionData.targets === 'object') {
              objectTargetActions.push({
                file: filePath,
                id: actionData.id,
                targets: actionData.targets,
                targetCount: Object.keys(actionData.targets).length,
              });
            }
          }
        } catch (error) {
          console.error(`Error processing ${filePath}:`, error);
        }
      }

      console.log(`
Action Format Summary:`);
      console.log(
        `  String targets format: ${stringTargetActions.length} actions`
      );
      console.log(
        `  Object targets format: ${objectTargetActions.length} actions`
      );
      console.log(
        `  Total actions: ${stringTargetActions.length + objectTargetActions.length} actions`
      );

      const multiTargetActions = objectTargetActions.filter(
        (a) => a.targetCount > 1
      );
      console.log(
        `  Multi-target actions: ${multiTargetActions.length} actions`
      );

      // All actions should use the targets format
      expect(stringTargetActions.length + objectTargetActions.length).toBe(
        actionFiles.length
      );

      // Verify no root-level scope properties exist
      expect(
        stringTargetActions.length + objectTargetActions.length
      ).toBeGreaterThan(0);
    });
  });

  describe('Schema Compliance Verification', () => {
    test('should verify all actions have targets property (no root-level scope)', async () => {
      const actionsWithoutTargets = [];
      const actionsWithRootScope = [];

      for (const filePath of actionFiles) {
        try {
          const fileContent = await readFile(filePath, 'utf-8');
          const actionData = JSON.parse(fileContent);

          // Check for missing targets property
          if (!actionData.targets) {
            actionsWithoutTargets.push({
              file: filePath,
              id: actionData.id,
            });
          }

          // Check for deprecated root-level scope property
          if (actionData.scope && actionData.targets) {
            actionsWithRootScope.push({
              file: filePath,
              id: actionData.id,
            });
          }
        } catch (error) {
          console.error(`Error processing ${filePath}:`, error);
        }
      }

      if (actionsWithoutTargets.length > 0) {
        console.log(`
Actions missing targets property:`);
        actionsWithoutTargets.forEach((action) => {
          console.log(`  - ${action.id} (${action.file})`);
        });
      }

      if (actionsWithRootScope.length > 0) {
        console.log(`
Actions with deprecated root-level scope property:`);
        actionsWithRootScope.forEach((action) => {
          console.log(`  - ${action.id} (${action.file})`);
        });
      }

      // All actions should have targets property
      expect(actionsWithoutTargets.length).toBe(0);

      // No actions should have root-level scope property
      expect(actionsWithRootScope.length).toBe(0);
    });
  });
});
