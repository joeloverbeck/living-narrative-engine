/**
 * @file Simple test to verify UNLOCK_MOVEMENT schema exists and validates
 * This test addresses the specific issue found in error_logs.txt
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';

describe('UNLOCK_MOVEMENT Schema Simple Test', () => {
  it('should have a valid unlockMovement.schema.json file', () => {
    const schemaPath = path.join(
      process.cwd(),
      'data/schemas/operations/unlockMovement.schema.json'
    );

    expect(fs.existsSync(schemaPath)).toBe(true);

    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaContent);

    // Verify the schema has the expected structure (uses allOf pattern)
    expect(schema.$id).toBe('schema://living-narrative-engine/operations/unlockMovement.schema.json');
    expect(schema.title).toBe('UNLOCK_MOVEMENT Operation');
    expect(schema.allOf).toBeDefined();
    expect(schema.allOf.length).toBe(2);
    
    // Check that it references base-operation.schema.json
    expect(schema.allOf[0].$ref).toBe('../base-operation.schema.json');
    
    // Check the operation-specific properties
    expect(schema.allOf[1].properties.type.const).toBe('UNLOCK_MOVEMENT');
    
    // Check the $defs structure
    expect(schema.$defs.Parameters.properties.actor_id.type).toBe('string');
    expect(schema.$defs.Parameters.required).toEqual(['actor_id']);
  });

  it('should be referenced in operation.schema.json', () => {
    const operationSchemaPath = path.join(
      process.cwd(),
      'data/schemas/operation.schema.json'
    );

    const schemaContent = fs.readFileSync(operationSchemaPath, 'utf8');
    const schema = JSON.parse(schemaContent);

    // Check that unlockMovement.schema.json is referenced
    const unlockMovementRef = schema.$defs.Operation.anyOf.find(
      (ref) => ref.$ref === './operations/unlockMovement.schema.json'
    );

    expect(unlockMovementRef).toBeDefined();
  });

  it('should validate a valid UNLOCK_MOVEMENT operation', () => {
    // Load all dependency schemas to resolve references
    const commonSchema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/schemas/common.schema.json'), 'utf8'));
    const jsonLogicSchema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/schemas/json-logic.schema.json'), 'utf8'));
    const conditionSchema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/schemas/condition-container.schema.json'), 'utf8'));
    const baseSchema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/schemas/base-operation.schema.json'), 'utf8'));
    const unlockSchema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/schemas/operations/unlockMovement.schema.json'), 'utf8'));

    const ajv = new Ajv({
      schemas: [commonSchema, jsonLogicSchema, conditionSchema, baseSchema, unlockSchema]
    });

    const validate = ajv.compile(unlockSchema);

    const validOperation = {
      type: 'UNLOCK_MOVEMENT',
      parameters: {
        actor_id: 'test_actor_123',
      },
    };

    const isValid = validate(validOperation);

    expect(isValid).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('should reject an invalid UNLOCK_MOVEMENT operation', () => {
    // Load all dependency schemas to resolve references
    const commonSchema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/schemas/common.schema.json'), 'utf8'));
    const jsonLogicSchema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/schemas/json-logic.schema.json'), 'utf8'));
    const conditionSchema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/schemas/condition-container.schema.json'), 'utf8'));
    const baseSchema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/schemas/base-operation.schema.json'), 'utf8'));
    const unlockSchema = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/schemas/operations/unlockMovement.schema.json'), 'utf8'));

    const ajv = new Ajv({
      schemas: [commonSchema, jsonLogicSchema, conditionSchema, baseSchema, unlockSchema]
    });

    const validate = ajv.compile(unlockSchema);

    const invalidOperation = {
      type: 'UNLOCK_MOVEMENT',
      parameters: {}, // Missing required actor_id
    };

    const isValid = validate(invalidOperation);

    expect(isValid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          instancePath: '/parameters',
          keyword: 'required',
          message: "must have required property 'actor_id'",
        }),
      ])
    );
  });

  it('should validate the stand_up rule content that was failing', async () => {
    const { default: AjvSchemaValidator } = await import(
      '../../../src/validation/ajvSchemaValidator.js'
    );
    const { default: ConsoleLogger } = await import('../../../src/logging/consoleLogger.js');
    
    // Create logger and validator using production classes
    const logger = new ConsoleLogger('error'); // Reduce noise during test
    const validator = new AjvSchemaValidator({ logger });

    // Load all schemas - both operations and main schemas
    const allSchemas = [];
    
    // Load all operation schemas
    const operationSchemaDir = path.join(process.cwd(), 'data/schemas/operations');
    const operationSchemaFiles = fs.readdirSync(operationSchemaDir).filter(file => file.endsWith('.schema.json'));
    
    for (const file of operationSchemaFiles) {
      const schemaPath = path.join(operationSchemaDir, file);
      const schemaData = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      allSchemas.push(schemaData);
    }
    
    // Load all main schemas
    const mainSchemaDir = path.join(process.cwd(), 'data/schemas');
    const mainSchemaFiles = fs.readdirSync(mainSchemaDir).filter(file => 
      file.endsWith('.schema.json') && !file.startsWith('README')
    );
    
    for (const file of mainSchemaFiles) {
      const schemaPath = path.join(mainSchemaDir, file);
      const schemaData = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      allSchemas.push(schemaData);
    }
    await validator.addSchemas(allSchemas);

    // This is the operation that was failing (removed comment to match schema)
    const unlockMovementAction = {
      type: 'UNLOCK_MOVEMENT',
      parameters: {
        actor_id: '{event.payload.actorId}',
      },
    };

    // Validate using the production validator
    const result = validator.validate(
      'schema://living-narrative-engine/operation.schema.json',
      unlockMovementAction
    );

    if (!result.isValid) {
      console.error('Validation failed with errors:', JSON.stringify(result.errors, null, 2));
    }

    expect(result.isValid).toBe(true);
    expect(result.errors).toBeNull();
  });
});
