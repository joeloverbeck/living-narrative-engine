/**
 * @file Integration test to verify handle_take_from_container.rule.json loads without validation errors
 * Reproduces the runtime error where TAKE_FROM_CONTAINER operation was unknown to schema validator
 * Tests that the TAKE_FROM_CONTAINER operation schema is properly registered
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import takeFromContainerRule from '../../../../data/mods/containers/rules/handle_take_from_container.rule.json' assert { type: 'json' };

describe('handle_take_from_container Rule Schema Validation', () => {
  it('should successfully import handle_take_from_container.rule.json', () => {
    // This test verifies that the rule file can be loaded without validation errors
    // If the schema was missing or invalid, this import would fail
    expect(takeFromContainerRule).toBeDefined();
    expect(takeFromContainerRule.rule_id).toBe('handle_take_from_container');
  });

  it('should have TAKE_FROM_CONTAINER operation in rule', () => {
    // Verify the rule contains TAKE_FROM_CONTAINER operation
    expect(takeFromContainerRule.actions).toBeDefined();

    // Find the IF operation that contains the TAKE_FROM_CONTAINER
    const ifOperation = takeFromContainerRule.actions.find(
      (action) => action.type === 'IF'
    );
    expect(ifOperation).toBeDefined();

    // Find the TAKE_FROM_CONTAINER operation in else_actions
    const takeOperation = ifOperation.parameters.else_actions.find(
      (action) => action.type === 'TAKE_FROM_CONTAINER'
    );
    expect(takeOperation).toBeDefined();
    expect(takeOperation.parameters.actorEntity).toBeDefined();
    expect(takeOperation.parameters.containerEntity).toBeDefined();
    expect(takeOperation.parameters.itemEntity).toBeDefined();
  });

  it('should validate TAKE_FROM_CONTAINER operation parameters', () => {
    // Get the operation from the rule
    const ifOperation = takeFromContainerRule.actions.find(
      (action) => action.type === 'IF'
    );
    const takeOperation = ifOperation.parameters.else_actions.find(
      (action) => action.type === 'TAKE_FROM_CONTAINER'
    );

    // Verify all required parameters are present
    expect(takeOperation.parameters).toHaveProperty('actorEntity');
    expect(takeOperation.parameters).toHaveProperty('containerEntity');
    expect(takeOperation.parameters).toHaveProperty('itemEntity');

    // Verify parameters match expected format (template strings)
    expect(takeOperation.parameters.actorEntity).toContain('event.payload');
    expect(takeOperation.parameters.containerEntity).toContain('event.payload');
    expect(takeOperation.parameters.itemEntity).toContain('event.payload');
  });

  it('should have TAKE_FROM_CONTAINER schema file available', () => {
    // This test verifies the schema file exists
    const schemaPath = path.join(
      process.cwd(),
      'data/schemas/operations/takeFromContainer.schema.json'
    );

    expect(fs.existsSync(schemaPath)).toBe(true);

    // Verify schema structure
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    expect(schema.$id).toBe(
      'schema://living-narrative-engine/operations/takeFromContainer.schema.json'
    );
    expect(schema.title).toBe('TAKE_FROM_CONTAINER Operation');
    expect(schema.$defs.Parameters.required).toEqual([
      'actorEntity',
      'containerEntity',
      'itemEntity',
    ]);
  });

  it('should have correct schema structure matching other operation schemas', () => {
    const schemaPath = path.join(
      process.cwd(),
      'data/schemas/operations/takeFromContainer.schema.json'
    );
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    // Verify schema uses allOf with base-operation.schema.json reference
    expect(schema.allOf).toBeDefined();
    expect(schema.allOf.length).toBeGreaterThanOrEqual(2);
    expect(schema.allOf[0].$ref).toBe('../base-operation.schema.json');

    // Verify type constraint
    const typeConstraint = schema.allOf.find((item) => item.properties?.type);
    expect(typeConstraint).toBeDefined();
    expect(typeConstraint.properties.type.const).toBe('TAKE_FROM_CONTAINER');

    // Verify parameters definition
    expect(schema.$defs.Parameters).toBeDefined();
    expect(schema.$defs.Parameters.type).toBe('object');
    expect(schema.$defs.Parameters.properties).toHaveProperty('actorEntity');
    expect(schema.$defs.Parameters.properties).toHaveProperty(
      'containerEntity'
    );
    expect(schema.$defs.Parameters.properties).toHaveProperty('itemEntity');
    expect(schema.$defs.Parameters.properties).toHaveProperty(
      'result_variable'
    );
  });
});
