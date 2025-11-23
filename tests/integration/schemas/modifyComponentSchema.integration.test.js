/**
 * @file Integration tests for MODIFY_COMPONENT schema validation
 * @description Validates that the MODIFY_COMPONENT operation schema correctly
 * accepts all three modes (set, increment, decrement) as specified in the
 * GOAP system specification.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import path from 'path';
import fs from 'fs';

describe('MODIFY_COMPONENT Schema Validation', () => {
  let schemaValidator;

  beforeEach(async () => {
    // Create logger and validator
    const logger = new ConsoleLogger('error');
    schemaValidator = new AjvSchemaValidator({ logger });

    // Load all schema files recursively from the schemas directory
    // This ensures all $ref dependencies are available
    const schemasDir = path.resolve('data/schemas');
    const schemaFiles = fs.readdirSync(schemasDir, { recursive: true });

    for (const file of schemaFiles) {
      if (typeof file === 'string' && file.endsWith('.json')) {
        const schemaPath = path.join(schemasDir, file);
        try {
          const schemaContent = fs.readFileSync(schemaPath, 'utf8');
          const schema = JSON.parse(schemaContent);

          if (schema.$id) {
            await schemaValidator.addSchema(schema, schema.$id);
          }
        } catch (error) {
          // Skip invalid JSON files or files without $id
        }
      }
    }
  });

  it('should validate set mode', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entity_ref: 'actor',
        component_type: 'core:needs',
        field: 'hunger',
        value: 20,
        mode: 'set',
      },
    };

    const result = schemaValidator.validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result).toBe(true);
  });

  it('should validate increment mode', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entity_ref: 'actor',
        component_type: 'core:stats',
        field: 'health',
        value: 30,
        mode: 'increment',
      },
    };

    const result = schemaValidator.validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result).toBe(true);
  });

  it('should validate decrement mode', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entity_ref: 'actor',
        component_type: 'core:needs',
        field: 'hunger',
        value: 60,
        mode: 'decrement',
      },
    };

    const result = schemaValidator.validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result).toBe(true);
  });

  it('should reject invalid mode', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entity_ref: 'actor',
        component_type: 'core:needs',
        field: 'hunger',
        value: 20,
        mode: 'multiply', // invalid
      },
    };

    const result = schemaValidator.validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result).toBe(false);
  });

  it('should reject missing required fields', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entity_ref: 'actor',
        // Missing component_type, field, value, mode
      },
    };

    const result = schemaValidator.validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result).toBe(false);
  });

  it('should validate numeric value', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entity_ref: 'actor',
        component_type: 'core:needs',
        field: 'hunger',
        value: 42,
        mode: 'set',
      },
    };

    const result = schemaValidator.validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result).toBe(true);
  });

  it('should validate string value (for set mode flexibility)', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entity_ref: 'actor',
        component_type: 'core:needs',
        field: 'status',
        value: 'satisfied',
        mode: 'set',
      },
    };

    const result = schemaValidator.validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result).toBe(true);
  });

  it('should validate component_type pattern', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entity_ref: 'actor',
        component_type: 'core:needs',
        field: 'hunger',
        value: 50,
        mode: 'set',
      },
    };

    const result = schemaValidator.validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result).toBe(true);
  });
});
