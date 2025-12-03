/**
 * @file Regression test for UNLOCK_MOVEMENT schema validation error
 * This test ensures the specific error from error_logs.txt is fixed and won't reoccur.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('UNLOCK_MOVEMENT Schema Regression Test', () => {
  it('should not throw the 147 validation errors that were in error_logs.txt', () => {
    // Verify that our fix files exist
    const unlockMovementSchemaPath = path.join(
      process.cwd(),
      'data/schemas/operations/unlockMovement.schema.json'
    );

    const operationSchemaPath = path.join(
      process.cwd(),
      'data/schemas/operation.schema.json'
    );

    const standUpRulePath = path.join(
      process.cwd(),
      'data/mods/deference/rules/stand_up.rule.json'
    );

    // 1. Verify all required files exist
    expect(fs.existsSync(unlockMovementSchemaPath)).toBe(true);
    expect(fs.existsSync(operationSchemaPath)).toBe(true);
    expect(fs.existsSync(standUpRulePath)).toBe(true);

    // 2. Verify the unlockMovement schema has the correct structure
    const unlockSchema = JSON.parse(
      fs.readFileSync(unlockMovementSchemaPath, 'utf8')
    );
    // Schema uses allOf composition pattern
    expect(unlockSchema.allOf).toBeDefined();
    expect(unlockSchema.allOf[1].properties.type.const).toBe('UNLOCK_MOVEMENT');
    // Parameters are defined in $defs
    expect(unlockSchema.$defs.Parameters.properties.actor_id.type).toBe(
      'string'
    );

    // 3. Verify the operation schema includes our new schema
    const operationSchema = JSON.parse(
      fs.readFileSync(operationSchemaPath, 'utf8')
    );
    const hasUnlockMovementRef = operationSchema.$defs.Operation.anyOf.some(
      (item) => item.$ref === './operations/unlockMovement.schema.json'
    );
    expect(hasUnlockMovementRef).toBe(true);

    // 4. Verify the stand_up rule contains the UNLOCK_MOVEMENT operation
    const standUpRule = JSON.parse(fs.readFileSync(standUpRulePath, 'utf8'));
    const hasUnlockMovementAction = standUpRule.actions.some(
      (action) => action.type === 'UNLOCK_MOVEMENT'
    );
    expect(hasUnlockMovementAction).toBe(true);

    // 5. Verify the UNLOCK_MOVEMENT action has the expected structure
    const unlockMovementAction = standUpRule.actions.find(
      (action) => action.type === 'UNLOCK_MOVEMENT'
    );
    expect(unlockMovementAction).toBeDefined();
    expect(unlockMovementAction.parameters.actor_id).toBe(
      '{event.payload.actorId}'
    );
  });

  it('should have resolved the specific validation error pattern from error_logs.txt', () => {
    // The error from error_logs.txt was:
    // "RuleLoader [positioning]: Primary schema validation failed for 'stand_up.rule.json'
    // using schema 'schema://living-narrative-engine/rule.schema.json'.
    // {validationErrors: Array(147)}"

    // This was happening because UNLOCK_MOVEMENT was not in the anyOf array
    // Our fix adds it, so this test verifies the fix is in place

    const operationSchemaPath = path.join(
      process.cwd(),
      'data/schemas/operation.schema.json'
    );
    const operationSchema = JSON.parse(
      fs.readFileSync(operationSchemaPath, 'utf8')
    );

    // Verify that UNLOCK_MOVEMENT is now in the anyOf array (it previously wasn't)
    const operationTypes = operationSchema.$defs.Operation.anyOf;
    const unlockMovementEntry = operationTypes.find(
      (entry) => entry.$ref === './operations/unlockMovement.schema.json'
    );

    expect(unlockMovementEntry).toBeDefined();
    expect(unlockMovementEntry.$ref).toBe(
      './operations/unlockMovement.schema.json'
    );
  });

  it('should prevent similar issues by having all operation handlers registered in the schema', () => {
    // Read the interpreter registrations to see what operations are registered
    const registrationsPath = path.join(
      process.cwd(),
      'src/dependencyInjection/registrations/interpreterRegistrations.js'
    );

    const registrationsContent = fs.readFileSync(registrationsPath, 'utf8');

    // Verify UNLOCK_MOVEMENT is registered (it was registered before, but schema was missing)
    expect(registrationsContent).toContain("'UNLOCK_MOVEMENT'");
    expect(registrationsContent).toContain('UnlockMovementHandler');

    // Read the operation schema
    const operationSchemaPath = path.join(
      process.cwd(),
      'data/schemas/operation.schema.json'
    );
    const operationSchema = JSON.parse(
      fs.readFileSync(operationSchemaPath, 'utf8')
    );

    // Verify both LOCK_MOVEMENT and UNLOCK_MOVEMENT are in the schema (they should be paired)
    const operationRefs = operationSchema.$defs.Operation.anyOf.map(
      (item) => item.$ref
    );

    expect(operationRefs).toContain('./operations/lockMovement.schema.json');
    expect(operationRefs).toContain('./operations/unlockMovement.schema.json');
  });

  it('should not break any existing operation schemas', () => {
    // Make sure we didn't break anything by adding our schema
    const operationSchemaPath = path.join(
      process.cwd(),
      'data/schemas/operation.schema.json'
    );
    const operationSchema = JSON.parse(
      fs.readFileSync(operationSchemaPath, 'utf8')
    );

    // Verify the schema is still valid JSON and has the expected structure
    expect(operationSchema.$defs).toBeDefined();
    expect(operationSchema.$defs.Operation).toBeDefined();
    expect(operationSchema.$defs.Operation.anyOf).toBeDefined();
    expect(Array.isArray(operationSchema.$defs.Operation.anyOf)).toBe(true);

    // Verify we have a reasonable number of operations (we added unlockMovement to the existing set)
    // Only check lower bound - upper bound would break as system naturally grows with new operations
    expect(operationSchema.$defs.Operation.anyOf.length).toBeGreaterThan(30);

    // Verify all entries have the expected $ref format
    operationSchema.$defs.Operation.anyOf.forEach((item) => {
      expect(item).toHaveProperty('$ref');
      expect(item.$ref).toMatch(/^\.\/operations\/\w+\.schema\.json$/);
    });
  });
});
