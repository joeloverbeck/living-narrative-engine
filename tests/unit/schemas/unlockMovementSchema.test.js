/**
 * @file Unit tests for unlockMovement operation schema validation
 * Tests the schema definition that was missing and causing mod loading failures.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../common/entities/testBed.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import fs from 'fs';

describe('unlockMovement Schema Unit Tests', () => {
  let testBed;
  let schemaValidator;
  const schemaId =
    'schema://living-narrative-engine/operations/unlockMovement.schema.json';

  beforeEach(async () => {
    testBed = new TestBedClass();
    const logger = new ConsoleLogger();
    schemaValidator = new AjvSchemaValidator({ logger });

    // Load the unlockMovement schema
    try {
      const unlockSchemaPath = process.cwd() + '/data/schemas/operations/unlockMovement.schema.json';
      const unlockSchemaContent = fs.readFileSync(unlockSchemaPath, 'utf8');
      const unlockSchema = JSON.parse(unlockSchemaContent);
      await schemaValidator.loadSchemaObject(
        'schema://living-narrative-engine/operations/unlockMovement.schema.json',
        unlockSchema
      );

      // Load the lockMovement schema for consistency test
      const lockSchemaPath = process.cwd() + '/data/schemas/operations/lockMovement.schema.json';
      const lockSchemaContent = fs.readFileSync(lockSchemaPath, 'utf8');
      const lockSchema = JSON.parse(lockSchemaContent);
      await schemaValidator.loadSchemaObject(
        'schema://living-narrative-engine/operations/lockMovement.schema.json',
        lockSchema
      );
    } catch (err) {
      // Schema loading issues will be caught in the tests
    }
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  describe('Valid UNLOCK_MOVEMENT operations', () => {
    it('should validate with required fields', async () => {
      const operation = {
        type: 'UNLOCK_MOVEMENT',
        parameters: {
          actor_id: 'actor_123',
        },
      };

      const result = schemaValidator.validate(schemaId, operation);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should validate with string actor_id', async () => {
      const operation = {
        type: 'UNLOCK_MOVEMENT',
        parameters: {
          actor_id: 'some_actor_entity_id',
        },
      };

      const result = schemaValidator.validate(schemaId, operation);
      expect(result.isValid).toBe(true);
    });

    it('should validate with template string actor_id', async () => {
      const operation = {
        type: 'UNLOCK_MOVEMENT',
        parameters: {
          actor_id: '{event.payload.actorId}',
        },
      };

      const result = schemaValidator.validate(schemaId, operation);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Invalid UNLOCK_MOVEMENT operations', () => {
    it('should reject operation without type field', async () => {
      const operation = {
        parameters: {
          actor_id: 'actor_123',
        },
      };

      const result = schemaValidator.validate(schemaId, operation);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            instancePath: '',
            keyword: 'required',
            message: expect.stringContaining(
              "must have required property 'type'"
            ),
          }),
        ])
      );
    });

    it('should reject operation with wrong type value', async () => {
      const operation = {
        type: 'LOCK_MOVEMENT', // Wrong type
        parameters: {
          actor_id: 'actor_123',
        },
      };

      const result = schemaValidator.validate(schemaId, operation);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            instancePath: '/type',
            keyword: 'const',
            message: expect.stringContaining('must be equal to constant'),
          }),
        ])
      );
    });

    it('should reject operation without parameters field', async () => {
      const operation = {
        type: 'UNLOCK_MOVEMENT',
      };

      const result = schemaValidator.validate(schemaId, operation);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '',
          schemaPath: '#/required',
          keyword: 'required',
          message: "must have required property 'parameters'",
        })
      );
    });

    it('should reject operation without actor_id parameter', async () => {
      const operation = {
        type: 'UNLOCK_MOVEMENT',
        parameters: {},
      };

      const result = schemaValidator.validate(schemaId, operation);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/parameters',
          schemaPath: '#/properties/parameters/required',
          keyword: 'required',
          message: "must have required property 'actor_id'",
        })
      );
    });

    it('should reject operation with non-string actor_id', async () => {
      const operation = {
        type: 'UNLOCK_MOVEMENT',
        parameters: {
          actor_id: 42, // Should be string
        },
      };

      const result = schemaValidator.validate(schemaId, operation);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/parameters/actor_id',
          schemaPath: '#/properties/parameters/properties/actor_id/type',
          keyword: 'type',
          message: 'must be string',
        })
      );
    });

    it('should reject operation with null actor_id', async () => {
      const operation = {
        type: 'UNLOCK_MOVEMENT',
        parameters: {
          actor_id: null,
        },
      };

      const result = schemaValidator.validate(schemaId, operation);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/parameters/actor_id',
          schemaPath: '#/properties/parameters/properties/actor_id/type',
          keyword: 'type',
          message: 'must be string',
        })
      );
    });

    it('should reject operation with additional properties at root level', async () => {
      const operation = {
        type: 'UNLOCK_MOVEMENT',
        parameters: {
          actor_id: 'actor_123',
        },
        extra_field: 'should not be allowed',
      };

      const result = schemaValidator.validate(schemaId, operation);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'additionalProperties',
          message: 'must NOT have additional properties',
        })
      );
    });
  });

  describe('Schema consistency', () => {
    it('should match the pattern of lockMovement schema', async () => {
      // Verify our schema follows the same pattern as lockMovement
      const lockOperation = {
        type: 'LOCK_MOVEMENT',
        parameters: {
          actor_id: 'test_actor',
        },
      };

      const unlockOperation = {
        type: 'UNLOCK_MOVEMENT',
        parameters: {
          actor_id: 'test_actor',
        },
      };

      const lockResult = schemaValidator.validate(
        'schema://living-narrative-engine/operations/lockMovement.schema.json',
        lockOperation
      );

      const unlockResult = schemaValidator.validate(schemaId, unlockOperation);

      // Both should validate successfully with the same structure
      expect(lockResult.isValid).toBe(true);
      expect(unlockResult.isValid).toBe(true);
    });
  });
});
