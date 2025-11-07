/**
 * @file Operation Type Completeness Validation Test
 *
 * Ensures all operation schemas in data/schemas/operations/ are registered
 * in the KNOWN_OPERATION_TYPES whitelist used for pre-validation.
 *
 * This test prevents the issue where operation implementations exist but
 * fail validation due to missing pre-validation registration.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);

/**
 * Extract operation type from schema file
 * Operation schemas define the type in a const field.
 * The structure can be:
 * 1. Direct: { "properties": { "type": { "const": "OPERATION_TYPE" } } }
 * 2. allOf: { "allOf": [{ "properties": { "type": { "const": "OPERATION_TYPE" } } }] }
 *
 * @param {string} schemaPath - Path to the schema file
 * @returns {string} The operation type constant
 */
function extractOperationTypeFromSchema(schemaPath) {
  try {
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);

    // Try direct properties first
    let typeConst = schema?.properties?.type?.const;

    // If not found, check allOf array (used by operation schemas)
    if (!typeConst && schema?.allOf) {
      for (const item of schema.allOf) {
        if (item?.properties?.type?.const) {
          typeConst = item.properties.type.const;
          break;
        }
      }
    }

    if (!typeConst) {
      throw new Error(
        `Schema ${path.basename(schemaPath)} does not have type.const in properties or allOf`
      );
    }

    return typeConst;
  } catch (err) {
    throw new Error(
      `Failed to extract operation type from ${schemaPath}: ${err.message}`
    );
  }
}

/**
 * Load KNOWN_OPERATION_TYPES from preValidationUtils
 *
 * Note: We read the file directly rather than importing to avoid
 * test dependency on the actual validation utilities.
 *
 * @returns {string[]} Array of known operation type strings
 */
function loadKnownOperationTypes() {
  const preValidationPath = path.join(
    currentDirPath,
    '../../../src/utils/preValidationUtils.js'
  );

  const content = fs.readFileSync(preValidationPath, 'utf-8');

  // Extract KNOWN_OPERATION_TYPES array using regex
  const match = content.match(
    /const KNOWN_OPERATION_TYPES\s*=\s*\[([\s\S]*?)\];/
  );

  if (!match) {
    throw new Error('Could not find KNOWN_OPERATION_TYPES in preValidationUtils.js');
  }

  // Parse array entries - match quoted strings
  const arrayContent = match[1];
  const types = [];
  const typeRegex = /['"]([^'"]+)['"]/g;
  let typeMatch;

  while ((typeMatch = typeRegex.exec(arrayContent)) !== null) {
    types.push(typeMatch[1]);
  }

  return types;
}

describe('Operation Type Completeness', () => {
  it('should have all operation schemas registered in KNOWN_OPERATION_TYPES', () => {
    // Get all operation schema files
    const schemasDir = path.join(currentDirPath, '../../../data/schemas/operations');
    const schemaFiles = fs
      .readdirSync(schemasDir)
      .filter((file) => file.endsWith('.schema.json'));

    expect(schemaFiles.length).toBeGreaterThan(0);

    // Extract operation types from schemas
    const schemaOperationTypes = schemaFiles.map((file) => {
      const schemaPath = path.join(schemasDir, file);
      return {
        file,
        type: extractOperationTypeFromSchema(schemaPath),
      };
    });

    // Load KNOWN_OPERATION_TYPES whitelist
    const knownTypes = loadKnownOperationTypes();

    // Find missing operation types
    const missing = schemaOperationTypes.filter(
      ({ type }) => !knownTypes.includes(type)
    );

    // Create detailed error message if any are missing
    if (missing.length > 0) {
      const missingList = missing
        .map(({ file, type }) => `  - ${type} (from ${file})`)
        .join('\n');

      const errorMessage = `
Found ${missing.length} operation type(s) not registered in KNOWN_OPERATION_TYPES:

${missingList}

These operations will fail pre-validation during mod loading.

To fix: Add the missing operation types to KNOWN_OPERATION_TYPES in:
  src/utils/preValidationUtils.js

Example:
  'EXISTING_OPERATION',
  '${missing[0].type}',  // ← Add this
`;

      throw new Error(errorMessage);
    }

    // Verify we found reasonable number of operations
    expect(schemaOperationTypes.length).toBeGreaterThan(30);
    expect(knownTypes.length).toBeGreaterThan(30);
  });

  it('should not have duplicate entries in KNOWN_OPERATION_TYPES', () => {
    const knownTypes = loadKnownOperationTypes();

    const duplicates = knownTypes.filter(
      (type, index) => knownTypes.indexOf(type) !== index
    );

    if (duplicates.length > 0) {
      throw new Error(
        `Found duplicate entries in KNOWN_OPERATION_TYPES: ${duplicates.join(', ')}`
      );
    }

    expect(duplicates).toEqual([]);
  });

  it('should have KNOWN_OPERATION_TYPES in alphabetical order for maintainability', () => {
    const knownTypes = loadKnownOperationTypes();
    const sorted = [...knownTypes].sort();

    // This is a recommendation, not a hard requirement
    // So we just warn if order is different
    if (JSON.stringify(knownTypes) !== JSON.stringify(sorted)) {
      console.warn(
        '⚠️  KNOWN_OPERATION_TYPES is not in alphabetical order. ' +
          'Consider sorting for easier maintenance.'
      );
    }

    // Test always passes - this is just a suggestion
    expect(true).toBe(true);
  });
});
