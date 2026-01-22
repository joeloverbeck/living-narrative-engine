/**
 * @file Shared utilities for component schema validation tests.
 * Provides AJV configuration and helper functions for testing component data schemas.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, test, expect } from '@jest/globals';
import commonSchema from '../../../../data/schemas/common.schema.json';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);

/**
 * Creates a configured AJV instance for schema validation.
 *
 * @returns {Ajv} Configured AJV instance
 */
export function createAjvInstance() {
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats(ajv);
  ajv.addSchema(commonSchema, commonSchema.$id);
  return ajv;
}

/**
 * Compiles a component's data schema for validation.
 *
 * @param {string} filePath - Absolute path to the component JSON file.
 * @param {Ajv} ajv - Configured Ajv instance.
 * @returns {{ id: string, validate: import('ajv').ValidateFunction }} Object with component ID and validator
 */
export function compileComponentSchema(filePath, ajv) {
  const component = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const dataSchema = { ...component.dataSchema, $id: component.id };
  return { id: component.id, validate: ajv.compile(dataSchema) };
}

/**
 * Loads all component validators from a directory.
 *
 * @param {string} componentDir - Path to components directory
 * @param {Ajv} ajv - Configured AJV instance
 * @returns {Record<string, import('ajv').ValidateFunction>} Map of component IDs to validators
 */
export function loadComponentValidators(componentDir, ajv) {
  /** @type {Record<string, import('ajv').ValidateFunction>} */
  const validators = {};

  fs.readdirSync(componentDir)
    .filter((f) => f.endsWith('.json'))
    .forEach((file) => {
      const { id, validate } = compileComponentSchema(
        path.join(componentDir, file),
        ajv
      );
      validators[id] = validate;
    });

  return validators;
}

/**
 * Generates test cases for component schema validation.
 *
 * @param {Record<string, import('ajv').ValidateFunction>} validators - Component validators
 * @param {Record<string, unknown>} validPayloads - Valid payload examples
 * @param {Record<string, unknown>} invalidPayloads - Invalid payload examples
 */
export function generateComponentTests(
  validators,
  validPayloads,
  invalidPayloads
) {
  Object.entries(validators).forEach(([id, validate]) => {
    describe(id, () => {
      test('✓ valid payload', () => {
        const payload = validPayloads[id];
        const ok = validate(payload);
        // eslint-disable-next-line no-console
        if (!ok) console.error(validate.errors);
        expect(ok).toBe(true);
      });

      test('✗ invalid payload', () => {
        const payload = invalidPayloads[id];
        expect(validate(payload)).toBe(false);
      });
    });
  });
}

/**
 * Resolves the path to a mod's components directory.
 *
 * @param {string} modName - Name of the mod (e.g., 'core', 'anatomy')
 * @returns {string} Absolute path to the components directory
 */
export function getModComponentsPath(modName) {
  return path.resolve(
    currentDir,
    `../../../../data/mods/${modName}/components`
  );
}
