import { describe, test, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Import the schemas
import lockMouthEngagementSchema from '../../../data/schemas/operations/lockMouthEngagement.schema.json';
import unlockMouthEngagementSchema from '../../../data/schemas/operations/unlockMouthEngagement.schema.json';
import baseOperationSchema from '../../../data/schemas/base-operation.schema.json';
import conditionContainerSchema from '../../../data/schemas/condition-container.schema.json';
import jsonLogicSchema from '../../../data/schemas/json-logic.schema.json';
import commonSchema from '../../../data/schemas/common.schema.json';

describe('Mouth Engagement Operation Schemas', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validateLock;
  /** @type {import('ajv').ValidateFunction} */
  let validateUnlock;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    // Add dependent schemas so AJV can resolve $ref pointers
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
    ajv.addSchema(
      baseOperationSchema,
      'schema://living-narrative-engine/base-operation.schema.json'
    );

    // Compile the schemas to be tested
    validateLock = ajv.compile(lockMouthEngagementSchema);
    validateUnlock = ajv.compile(unlockMouthEngagementSchema);
  });

  describe('LOCK_MOUTH_ENGAGEMENT Operation Schema', () => {
    test('✓ should validate correct LOCK_MOUTH_ENGAGEMENT operation', () => {
      const validOp = {
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: {
          actor_id: 'game:character_bob',
        },
      };
      const ok = validateLock(validOp);
      if (!ok) {
        console.error('Validation Errors:', validateLock.errors);
      }
      expect(ok).toBe(true);
    });

    test('✓ should validate with namespaced actor ID', () => {
      const validOp = {
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: {
          actor_id: 'core:player',
        },
      };
      expect(validateLock(validOp)).toBe(true);
    });

    test('✓ should validate with simple actor ID', () => {
      const validOp = {
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: {
          actor_id: 'alice',
        },
      };
      expect(validateLock(validOp)).toBe(true);
    });

    test('✗ should reject operations with missing actor_id', () => {
      const invalidOp = {
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: {},
      };
      expect(validateLock(invalidOp)).toBe(false);
      expect(validateLock.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'actor_id'",
        })
      );
    });

    test('✗ should reject operations with empty actor_id', () => {
      const invalidOp = {
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: {
          actor_id: '',
        },
      };
      expect(validateLock(invalidOp)).toBe(false);
      expect(validateLock.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/parameters/actor_id',
          message: 'must NOT have fewer than 1 characters',
        })
      );
    });

    test('✗ should reject operations with wrong type', () => {
      const invalidOp = {
        type: 'WRONG_TYPE',
        parameters: {
          actor_id: 'game:character_bob',
        },
      };
      expect(validateLock(invalidOp)).toBe(false);
      expect(validateLock.errors).toContainEqual(
        expect.objectContaining({
          message: 'must be equal to constant',
        })
      );
    });

    test('✗ should reject operations with non-string actor_id', () => {
      const invalidOp = {
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: {
          actor_id: 123,
        },
      };
      expect(validateLock(invalidOp)).toBe(false);
      expect(validateLock.errors).toContainEqual(
        expect.objectContaining({
          message: 'must be string',
        })
      );
    });

    test('✗ should reject operations with additional properties', () => {
      const invalidOp = {
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: {
          actor_id: 'game:character_bob',
          extra_field: 'not allowed',
        },
      };
      expect(validateLock(invalidOp)).toBe(false);
      expect(validateLock.errors).toContainEqual(
        expect.objectContaining({
          message: 'must NOT have additional properties',
        })
      );
    });

    test('✗ should reject operations without parameters', () => {
      const invalidOp = {
        type: 'LOCK_MOUTH_ENGAGEMENT',
      };
      expect(validateLock(invalidOp)).toBe(false);
      expect(validateLock.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'parameters'",
        })
      );
    });
  });

  describe('UNLOCK_MOUTH_ENGAGEMENT Operation Schema', () => {
    test('✓ should validate correct UNLOCK_MOUTH_ENGAGEMENT operation', () => {
      const validOp = {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: {
          actor_id: 'game:character_alice',
        },
      };
      const ok = validateUnlock(validOp);
      if (!ok) {
        console.error('Validation Errors:', validateUnlock.errors);
      }
      expect(ok).toBe(true);
    });

    test('✓ should validate with namespaced actor ID', () => {
      const validOp = {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: {
          actor_id: 'intimacy:lover',
        },
      };
      expect(validateUnlock(validOp)).toBe(true);
    });

    test('✓ should validate with simple actor ID', () => {
      const validOp = {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: {
          actor_id: 'bob',
        },
      };
      expect(validateUnlock(validOp)).toBe(true);
    });

    test('✗ should reject operations with missing actor_id', () => {
      const invalidOp = {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: {},
      };
      expect(validateUnlock(invalidOp)).toBe(false);
      expect(validateUnlock.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'actor_id'",
        })
      );
    });

    test('✗ should reject operations with empty actor_id', () => {
      const invalidOp = {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: {
          actor_id: '',
        },
      };
      expect(validateUnlock(invalidOp)).toBe(false);
      expect(validateUnlock.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/parameters/actor_id',
          message: 'must NOT have fewer than 1 characters',
        })
      );
    });

    test('✗ should reject operations with wrong type', () => {
      const invalidOp = {
        type: 'WRONG_TYPE',
        parameters: {
          actor_id: 'game:character_alice',
        },
      };
      expect(validateUnlock(invalidOp)).toBe(false);
      expect(validateUnlock.errors).toContainEqual(
        expect.objectContaining({
          message: 'must be equal to constant',
        })
      );
    });

    test('✗ should reject operations with non-string actor_id', () => {
      const invalidOp = {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: {
          actor_id: null,
        },
      };
      expect(validateUnlock(invalidOp)).toBe(false);
      expect(validateUnlock.errors).toContainEqual(
        expect.objectContaining({
          message: 'must be string',
        })
      );
    });

    test('✗ should reject operations with additional properties', () => {
      const invalidOp = {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: {
          actor_id: 'game:character_alice',
          unexpected: true,
        },
      };
      expect(validateUnlock(invalidOp)).toBe(false);
      expect(validateUnlock.errors).toContainEqual(
        expect.objectContaining({
          message: 'must NOT have additional properties',
        })
      );
    });

    test('✗ should reject operations without parameters', () => {
      const invalidOp = {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
      };
      expect(validateUnlock(invalidOp)).toBe(false);
      expect(validateUnlock.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'parameters'",
        })
      );
    });
  });

  describe('Cross-Schema Consistency', () => {
    test('should have consistent parameter structures', () => {
      // Both schemas should have the same parameter structure (except descriptions)
      const lockParams = lockMouthEngagementSchema.$defs.Parameters;
      const unlockParams = unlockMouthEngagementSchema.$defs.Parameters;

      // Check structure consistency
      expect(lockParams.properties.actor_id.type).toBe(
        unlockParams.properties.actor_id.type
      );
      expect(lockParams.properties.actor_id.minLength).toBe(
        unlockParams.properties.actor_id.minLength
      );
      expect(lockParams.required).toEqual(unlockParams.required);
      expect(lockParams.additionalProperties).toEqual(
        unlockParams.additionalProperties
      );

      // Verify both have descriptions (content can differ)
      expect(lockParams.properties.actor_id.description).toBeDefined();
      expect(unlockParams.properties.actor_id.description).toBeDefined();
    });

    test('should both extend base operation schema', () => {
      expect(lockMouthEngagementSchema.allOf[0].$ref).toBe(
        '../base-operation.schema.json'
      );
      expect(unlockMouthEngagementSchema.allOf[0].$ref).toBe(
        '../base-operation.schema.json'
      );
    });

    test('should have proper schema metadata', () => {
      expect(lockMouthEngagementSchema.$schema).toBe(
        'http://json-schema.org/draft-07/schema#'
      );
      expect(unlockMouthEngagementSchema.$schema).toBe(
        'http://json-schema.org/draft-07/schema#'
      );

      expect(lockMouthEngagementSchema.$id).toBe(
        'schema://living-narrative-engine/operations/lockMouthEngagement.schema.json'
      );
      expect(unlockMouthEngagementSchema.$id).toBe(
        'schema://living-narrative-engine/operations/unlockMouthEngagement.schema.json'
      );
    });
  });
});
