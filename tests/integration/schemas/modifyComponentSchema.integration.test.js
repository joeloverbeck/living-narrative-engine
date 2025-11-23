/**
 * @file Integration tests for MODIFY_COMPONENT schema validation
 * @description Validates that the MODIFY_COMPONENT operation schema correctly
 * accepts all three modes (set, increment, decrement) as specified in the
 * GOAP system specification.
 */

import { describe, it, expect } from '@jest/globals';
import { validateAgainstSchema } from '../../../src/validation/ajvSchemaValidator.js';

describe('MODIFY_COMPONENT Schema Validation', () => {
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

    const result = validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result.valid).toBe(true);
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

    const result = validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result.valid).toBe(true);
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

    const result = validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result.valid).toBe(true);
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

    const result = validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('enum'),
        }),
      ])
    );
  });

  it('should reject missing required fields', () => {
    const operation = {
      type: 'MODIFY_COMPONENT',
      parameters: {
        entity_ref: 'actor',
        // Missing component_type, field, value, mode
      },
    };

    const result = validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result.valid).toBe(false);
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

    const result = validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result.valid).toBe(true);
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

    const result = validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result.valid).toBe(true);
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

    const result = validateAgainstSchema(
      operation,
      'schema://living-narrative-engine/operation.schema.json'
    );
    expect(result.valid).toBe(true);
  });
});
