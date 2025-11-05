/**
 * @file Unit test to verify queryLookup operation schema is included in configuration.
 * This test reproduces the issue where queryLookup.schema.json exists but is not
 * included in the OPERATION_SCHEMA_FILES array in staticConfiguration.js
 */

import { describe, it, expect } from '@jest/globals';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';
import fs from 'fs';
import path from 'path';

describe('QueryLookup Schema Configuration', () => {
  let config;

  beforeEach(() => {
    config = new StaticConfiguration();
  });

  it('should include queryLookup.schema.json in the schema files list', () => {
    const schemaFiles = config.getSchemaFiles();

    // Check if queryLookup.schema.json is in the operations folder schemas
    const hasQueryLookupSchema = schemaFiles.some((file) =>
      file.includes('queryLookup.schema.json')
    );

    expect(hasQueryLookupSchema).toBe(true);
  });

  it('should verify queryLookup.schema.json file actually exists in filesystem', () => {
    const schemaPath = path.join(
      process.cwd(),
      'data',
      'schemas',
      'operations',
      'queryLookup.schema.json'
    );

    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  it('should have queryLookup referenced in operation.schema.json', () => {
    const operationSchemaPath = path.join(
      process.cwd(),
      'data',
      'schemas',
      'operation.schema.json'
    );

    const operationSchemaContent = fs.readFileSync(operationSchemaPath, 'utf8');
    const operationSchema = JSON.parse(operationSchemaContent);

    // Check if queryLookup is referenced in the Operation anyOf array
    const hasQueryLookupRef = operationSchema.$defs.Operation.anyOf.some(
      (item) =>
        item.$ref && item.$ref.includes('operations/queryLookup.schema.json')
    );

    expect(hasQueryLookupRef).toBe(true);
  });

  it('should include all operation schemas referenced in operation.schema.json', () => {
    const operationSchemaPath = path.join(
      process.cwd(),
      'data',
      'schemas',
      'operation.schema.json'
    );

    const operationSchemaContent = fs.readFileSync(operationSchemaPath, 'utf8');
    const operationSchema = JSON.parse(operationSchemaContent);

    // Extract all operation schema file names from references
    const referencedSchemas = operationSchema.$defs.Operation.anyOf
      .map((item) => item.$ref)
      .filter((ref) => ref && ref.startsWith('./operations/'))
      .map((ref) => ref.replace('./operations/', ''));

    const configuredSchemas = config.getSchemaFiles();

    // Verify each referenced schema is in the configuration
    for (const schemaFile of referencedSchemas) {
      const isConfigured = configuredSchemas.some((file) =>
        file.includes(schemaFile)
      );

      expect(isConfigured).toBe(true);
    }
  });
});
