/**
 * @file Unit tests for proximity-based closeness operation schemas
 * Tests the establishSittingCloseness and removeSittingCloseness operation schemas
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../../common/entities/testBed.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';

describe('Proximity Closeness Operation Schemas', () => {
  let testBed;
  let schemaValidator;
  let logger;

  beforeEach(async () => {
    testBed = new TestBedClass();
    logger = new ConsoleLogger();

    try {
      // Load all dependency schemas
      const commonSchemaPath =
        process.cwd() + '/data/schemas/common.schema.json';
      const commonSchema = JSON.parse(
        fs.readFileSync(commonSchemaPath, 'utf8')
      );

      const jsonLogicSchemaPath =
        process.cwd() + '/data/schemas/json-logic.schema.json';
      const jsonLogicSchema = JSON.parse(
        fs.readFileSync(jsonLogicSchemaPath, 'utf8')
      );

      const conditionSchemaPath =
        process.cwd() + '/data/schemas/condition-container.schema.json';
      const conditionSchema = JSON.parse(
        fs.readFileSync(conditionSchemaPath, 'utf8')
      );

      const baseSchemaPath =
        process.cwd() + '/data/schemas/base-operation.schema.json';
      const baseSchema = JSON.parse(fs.readFileSync(baseSchemaPath, 'utf8'));

      const establishSchemaPath =
        process.cwd() +
        '/data/schemas/operations/establishSittingCloseness.schema.json';
      const establishSchema = JSON.parse(
        fs.readFileSync(establishSchemaPath, 'utf8')
      );

      const removeSchemaPath =
        process.cwd() +
        '/data/schemas/operations/removeSittingCloseness.schema.json';
      const removeSchema = JSON.parse(
        fs.readFileSync(removeSchemaPath, 'utf8')
      );

      // Create AJV instance with all schemas loaded
      const ajv = new Ajv({
        schemas: [
          commonSchema,
          jsonLogicSchema,
          conditionSchema,
          baseSchema,
          establishSchema,
          removeSchema,
        ],
      });
      addFormats(ajv);

      // Create AjvSchemaValidator with pre-configured AJV instance
      schemaValidator = new AjvSchemaValidator({ logger, ajvInstance: ajv });

      logger.debug(
        'Successfully loaded all schemas for proximity closeness tests'
      );
    } catch (err) {
      logger.error('Failed to load schema dependencies:', err);
      throw new Error(`Schema loading failed: ${err.message}`);
    }
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  describe('ESTABLISH_SITTING_CLOSENESS Schema', () => {
    const schemaId =
      'schema://living-narrative-engine/operations/establishSittingCloseness.schema.json';

    describe('Valid operations', () => {
      it('should validate operation with all required parameters', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: 2,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should validate operation with optional result_variable', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: 1,
            result_variable: 'operationResult',
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(true);
      });

      it('should accept spot_index at minimum boundary (0)', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:bench',
            actor_id: 'game:bob',
            spot_index: 0,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(true);
      });

      it('should accept spot_index at maximum boundary (9)', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:longCouch',
            actor_id: 'game:charlie',
            spot_index: 9,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(true);
      });

      it('should accept template string parameters', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: '{event.payload.furnitureId}',
            actor_id: '{event.payload.actorId}',
            spot_index: 3,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(true);
      });
    });

    describe('Invalid operations', () => {
      it('should reject operation without type field', () => {
        const operation = {
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: 2,
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

      it('should reject operation with wrong type value', () => {
        const operation = {
          type: 'WRONG_TYPE',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: 2,
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

      it('should reject operation without parameters field', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '',
            keyword: 'required',
            message: "must have required property 'parameters'",
          })
        );
      });

      it('should reject operation missing furniture_id', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            actor_id: 'game:alice',
            spot_index: 2,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters',
            keyword: 'required',
            message: "must have required property 'furniture_id'",
          })
        );
      });

      it('should reject operation missing actor_id', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            spot_index: 2,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters',
            keyword: 'required',
            message: "must have required property 'actor_id'",
          })
        );
      });

      it('should reject operation missing spot_index', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters',
            keyword: 'required',
            message: "must have required property 'spot_index'",
          })
        );
      });

      it('should reject empty string for furniture_id', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: '',
            actor_id: 'game:alice',
            spot_index: 2,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters/furniture_id',
            keyword: 'minLength',
            message: 'must NOT have fewer than 1 characters',
          })
        );
      });

      it('should reject empty string for actor_id', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: '',
            spot_index: 2,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters/actor_id',
            keyword: 'minLength',
            message: 'must NOT have fewer than 1 characters',
          })
        );
      });

      it('should reject negative spot_index', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: -1,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters/spot_index',
            keyword: 'minimum',
            message: 'must be >= 0',
          })
        );
      });

      it('should reject spot_index greater than 9', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: 10,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters/spot_index',
            keyword: 'maximum',
            message: 'must be <= 9',
          })
        );
      });

      it('should accept string spot_index for variable references', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: '2', // String is valid for variable references
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should accept string variable reference format for spot_index', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: '{context.spotIndex}',
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should reject boolean spot_index', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: true,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters/spot_index',
            keyword: 'oneOf',
            message: 'must match exactly one schema in oneOf',
          })
        );
      });

      it('should reject null spot_index', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: null,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters/spot_index',
            keyword: 'oneOf',
            message: 'must match exactly one schema in oneOf',
          })
        );
      });

      it('should reject decimal spot_index', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: 2.5,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters/spot_index',
            keyword: 'type',
            message: 'must be integer',
          })
        );
      });

      it('should reject empty string for result_variable', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: 2,
            result_variable: '',
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters/result_variable',
            keyword: 'minLength',
            message: 'must NOT have fewer than 1 characters',
          })
        );
      });

      it('should reject additional properties in parameters', () => {
        const operation = {
          type: 'ESTABLISH_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: 2,
            extra_field: 'not allowed',
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters',
            keyword: 'additionalProperties',
            message: 'must NOT have additional properties',
          })
        );
      });
    });
  });

  describe('REMOVE_SITTING_CLOSENESS Schema', () => {
    const schemaId =
      'schema://living-narrative-engine/operations/removeSittingCloseness.schema.json';

    describe('Valid operations', () => {
      it('should validate operation with all required parameters', () => {
        const operation = {
          type: 'REMOVE_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: 2,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should validate operation with optional result_variable', () => {
        const operation = {
          type: 'REMOVE_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: 1,
            result_variable: 'removeResult',
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(true);
      });

      it('should accept spot_index at minimum boundary (0)', () => {
        const operation = {
          type: 'REMOVE_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:bench',
            actor_id: 'game:bob',
            spot_index: 0,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(true);
      });

      it('should accept spot_index at maximum boundary (9)', () => {
        const operation = {
          type: 'REMOVE_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:longCouch',
            actor_id: 'game:charlie',
            spot_index: 9,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(true);
      });

      it('should accept string spot_index for variable references', () => {
        const operation = {
          type: 'REMOVE_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: '5', // String is valid for variable references
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should accept string variable reference format for spot_index', () => {
        const operation = {
          type: 'REMOVE_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: '{context.sittingInfo.spot_index}',
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
      });
    });

    describe('Invalid operations', () => {
      it('should reject operation without type field', () => {
        const operation = {
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: 2,
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

      it('should reject operation with wrong type value', () => {
        const operation = {
          type: 'WRONG_TYPE',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: 2,
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

      it('should reject operation missing furniture_id', () => {
        const operation = {
          type: 'REMOVE_SITTING_CLOSENESS',
          parameters: {
            actor_id: 'game:alice',
            spot_index: 2,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters',
            keyword: 'required',
            message: "must have required property 'furniture_id'",
          })
        );
      });

      it('should reject operation missing actor_id', () => {
        const operation = {
          type: 'REMOVE_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            spot_index: 2,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters',
            keyword: 'required',
            message: "must have required property 'actor_id'",
          })
        );
      });

      it('should reject operation missing spot_index', () => {
        const operation = {
          type: 'REMOVE_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters',
            keyword: 'required',
            message: "must have required property 'spot_index'",
          })
        );
      });

      it('should reject negative spot_index', () => {
        const operation = {
          type: 'REMOVE_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: -1,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters/spot_index',
            keyword: 'minimum',
            message: 'must be >= 0',
          })
        );
      });

      it('should reject spot_index greater than 9', () => {
        const operation = {
          type: 'REMOVE_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: 10,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters/spot_index',
            keyword: 'maximum',
            message: 'must be <= 9',
          })
        );
      });

      it('should reject boolean spot_index', () => {
        const operation = {
          type: 'REMOVE_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: false,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters/spot_index',
            keyword: 'oneOf',
            message: 'must match exactly one schema in oneOf',
          })
        );
      });

      it('should reject null spot_index', () => {
        const operation = {
          type: 'REMOVE_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: null,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters/spot_index',
            keyword: 'oneOf',
            message: 'must match exactly one schema in oneOf',
          })
        );
      });

      it('should reject decimal spot_index', () => {
        const operation = {
          type: 'REMOVE_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: 3.7,
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters/spot_index',
            keyword: 'oneOf',
            message: 'must match exactly one schema in oneOf',
          })
        );
      });

      it('should reject additional properties in parameters', () => {
        const operation = {
          type: 'REMOVE_SITTING_CLOSENESS',
          parameters: {
            furniture_id: 'furniture:couch',
            actor_id: 'game:alice',
            spot_index: 2,
            extra_field: 'not allowed',
          },
        };

        const result = schemaValidator.validate(schemaId, operation);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/parameters',
            keyword: 'additionalProperties',
            message: 'must NOT have additional properties',
          })
        );
      });
    });
  });

  describe('Schema Consistency', () => {
    it('should follow same structure pattern for both schemas', () => {
      const establishOperation = {
        type: 'ESTABLISH_SITTING_CLOSENESS',
        parameters: {
          furniture_id: 'furniture:test',
          actor_id: 'game:test',
          spot_index: 5,
          result_variable: 'testResult',
        },
      };

      const removeOperation = {
        type: 'REMOVE_SITTING_CLOSENESS',
        parameters: {
          furniture_id: 'furniture:test',
          actor_id: 'game:test',
          spot_index: 5,
          result_variable: 'testResult',
        },
      };

      const establishResult = schemaValidator.validate(
        'schema://living-narrative-engine/operations/establishSittingCloseness.schema.json',
        establishOperation
      );

      const removeResult = schemaValidator.validate(
        'schema://living-narrative-engine/operations/removeSittingCloseness.schema.json',
        removeOperation
      );

      expect(establishResult.isValid).toBe(true);
      expect(removeResult.isValid).toBe(true);
    });

    it('should both reject same invalid parameter structures', () => {
      const invalidParams = {
        furniture_id: 123, // Should be string
        actor_id: 'test', // Valid string to avoid missing field error
        spot_index: '5', // Should be integer
      };

      const establishOperation = {
        type: 'ESTABLISH_SITTING_CLOSENESS',
        parameters: invalidParams,
      };

      const removeOperation = {
        type: 'REMOVE_SITTING_CLOSENESS',
        parameters: invalidParams,
      };

      const establishResult = schemaValidator.validate(
        'schema://living-narrative-engine/operations/establishSittingCloseness.schema.json',
        establishOperation
      );

      const removeResult = schemaValidator.validate(
        'schema://living-narrative-engine/operations/removeSittingCloseness.schema.json',
        removeOperation
      );

      expect(establishResult.isValid).toBe(false);
      expect(removeResult.isValid).toBe(false);

      // Both should have errors for furniture_id and spot_index
      expect(establishResult.errors.length).toBeGreaterThan(0);
      expect(removeResult.errors.length).toBeGreaterThan(0);

      // Both should have the same number of errors
      expect(establishResult.errors.length).toBe(removeResult.errors.length);
    });
  });
});
