import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

function createTestLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('AjvSchemaValidator integration', () => {
  /** @type {ReturnType<typeof createTestLogger>} */
  let logger;

  beforeEach(() => {
    logger = createTestLogger();
    jest.clearAllMocks();
  });

  test('constructs with real Ajv, preloads schemas, and resolves relative references', async () => {
    const baseOperationSchema = {
      $id: 'schema://living-narrative-engine/operations/shared/baseOperation.schema.json',
      type: 'object',
      required: ['id', 'difficulty'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', minLength: 1 },
        difficulty: { type: 'integer', minimum: 1 },
      },
    };

    const validator = new AjvSchemaValidator({
      logger,
      preloadSchemas: [
        {
          id: baseOperationSchema.$id,
          schema: baseOperationSchema,
        },
      ],
    });

    const attackOperationSchema = {
      $id: 'schema://living-narrative-engine/operations/combat/attack.schema.json',
      type: 'object',
      required: ['name', 'base'],
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        base: { $ref: '../shared/baseOperation.schema.json' },
      },
    };

    await validator.addSchema(attackOperationSchema, attackOperationSchema.$id);

    const validResult = validator.validate(attackOperationSchema.$id, {
      name: 'flurry',
      base: { id: 'base-001', difficulty: 3 },
    });

    expect(validResult.isValid).toBe(true);

    const invalidResult = validator.validate(attackOperationSchema.$id, {
      name: 'flurry',
      base: { id: 'base-001' },
    });

    expect(invalidResult.isValid).toBe(false);
    expect(Array.isArray(invalidResult.errors)).toBe(true);

    expect(logger.debug).toHaveBeenCalledWith(
      'AjvSchemaValidator: Ajv instance created and formats added.'
    );
  });

  test('throws when constructed without a valid logger implementation', () => {
    expect(
      () => new AjvSchemaValidator({ logger: /** @type {any} */ ({}) })
    ).toThrow(
      "AjvSchemaValidator: Missing or invalid 'logger' dependency (ILogger). Requires info, warn, error, debug."
    );
  });

  test('removeSchema gracefully handles invalid input and successful removal', async () => {
    const validator = new AjvSchemaValidator({ logger });

    expect(validator.removeSchema('')).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      "AjvSchemaValidator: removeSchema called with invalid schemaId: ''"
    );

    const schema = {
      $id: 'schema://living-narrative-engine/tests/simple.schema.json',
      type: 'object',
      properties: { value: { type: 'number' } },
    };

    await validator.addSchema(schema, schema.$id);
    expect(validator.removeSchema(schema.$id)).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      "AjvSchemaValidator: Successfully removed schema 'schema://living-narrative-engine/tests/simple.schema.json'."
    );

    expect(validator.removeSchema(schema.$id)).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      "AjvSchemaValidator: Schema 'schema://living-narrative-engine/tests/simple.schema.json' not found. Cannot remove."
    );
  });

  test('addSchema prevents duplicates and surfaces Ajv errors', async () => {
    const validator = new AjvSchemaValidator({ logger });
    const schema = {
      $id: 'schema://living-narrative-engine/tests/addSchemaDuplicate.schema.json',
      type: 'object',
      properties: { label: { type: 'string' } },
    };

    await validator.addSchema(schema, schema.$id);

    await expect(validator.addSchema(schema, schema.$id)).rejects.toThrow(
      "AjvSchemaValidator: Schema with ID 'schema://living-narrative-engine/tests/addSchemaDuplicate.schema.json' already exists. Ajv does not overwrite. Use removeSchema first if replacement is intended."
    );

    const failingAjv = {
      addSchema: jest.fn(() => {
        throw Object.assign(new Error('synthetic failure'), {
          errors: [{ instancePath: '#', message: 'bad schema' }],
        });
      }),
      getSchema: jest.fn(() => undefined),
      removeSchema: jest.fn(),
      compile: jest.fn(),
    };

    const validatorWithFailingAjv = new AjvSchemaValidator({
      logger,
      ajvInstance: /** @type {any} */ (failingAjv),
    });

    await expect(
      validatorWithFailingAjv.addSchema(schema, schema.$id)
    ).rejects.toThrow('synthetic failure');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "AjvSchemaValidator: Error adding schema with ID 'schema://living-narrative-engine/tests/addSchemaDuplicate.schema.json'"
      ),
      expect.objectContaining({ schemaId: schema.$id })
    );
  });

  test('addSchemas validates input, skips duplicates, and returns successfully', async () => {
    const validator = new AjvSchemaValidator({ logger });

    await expect(validator.addSchemas([])).rejects.toThrow(
      'AjvSchemaValidator: addSchemas called with empty or non-array input.'
    );

    await expect(validator.addSchemas([null])).rejects.toThrow(
      'AjvSchemaValidator: All schemas must be objects with a valid $id.'
    );

    const schemaA = {
      $id: 'schema://living-narrative-engine/tests/batchA.schema.json',
      type: 'object',
    };
    const schemaB = {
      $id: 'schema://living-narrative-engine/tests/batchB.schema.json',
      type: 'object',
    };

    await validator.addSchemas([schemaA, schemaB]);

    await expect(
      validator.addSchemas([schemaA, schemaB])
    ).resolves.toBeUndefined();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'schema://living-narrative-engine/tests/batchA.schema.json'
      )
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'schema://living-narrative-engine/tests/batchB.schema.json'
      )
    );
  });

  test('validateSchemaRefs detects missing schemas and unresolved references', async () => {
    const validator = new AjvSchemaValidator({ logger });
    expect(validator.validateSchemaRefs('schema://missing')).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      "AjvSchemaValidator: Cannot validate refs for schema 'schema://missing' - schema not found."
    );

    const unresolvedSchema = {
      $id: 'schema://living-narrative-engine/tests/unresolved.schema.json',
      $ref: 'schema://living-narrative-engine/tests/does-not-exist.schema.json',
    };

    await validator.addSchema(unresolvedSchema, unresolvedSchema.$id);

    expect(validator.validateSchemaRefs(unresolvedSchema.$id)).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "AjvSchemaValidator: Schema 'schema://living-narrative-engine/tests/unresolved.schema.json' has unresolved $refs or other issues"
      ),
      expect.objectContaining({ schemaId: unresolvedSchema.$id })
    );
  });

  test('validate returns runtime error metadata when an Ajv validator throws', () => {
    const runtimeError = new Error('validator boom');
    const throwingValidator = jest.fn(() => {
      throw runtimeError;
    });
    throwingValidator.errors = undefined;

    const fakeAjv = {
      getSchema: jest.fn(() => throwingValidator),
      addSchema: jest.fn(),
      removeSchema: jest.fn(),
      schemas: {
        'schema://living-narrative-engine/tests/runtime-error.schema.json': {
          schema: {},
        },
      },
      compile: jest.fn(),
    };

    const validator = new AjvSchemaValidator({
      logger,
      ajvInstance: /** @type {any} */ (fakeAjv),
    });

    const result = validator.validate(
      'schema://living-narrative-engine/tests/runtime-error.schema.json',
      { answer: 42 }
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ keyword: 'runtimeError' }),
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "AjvSchemaValidator: Runtime error during validation with schema 'schema://living-narrative-engine/tests/runtime-error.schema.json'"
      ),
      expect.objectContaining({ error: runtimeError })
    );
  });

  test('getValidator handles Ajv access errors and missing schemas', () => {
    const brokenAjv = {
      getSchema: jest.fn(() => {
        throw new Error('boom');
      }),
      addSchema: jest.fn(),
      removeSchema: jest.fn(),
      schemas: {},
      compile: jest.fn(),
    };

    const validator = new AjvSchemaValidator({
      logger,
      ajvInstance: /** @type {any} */ (brokenAjv),
    });

    expect(
      validator.getValidator(
        'schema://living-narrative-engine/tests/missing.schema.json'
      )
    ).toBeUndefined();

    const emptyAjv = {
      getSchema: jest.fn(() => undefined),
      addSchema: jest.fn(),
      removeSchema: jest.fn(),
      schemas: {},
      compile: jest.fn(),
    };

    const validatorWithEmptyAjv = new AjvSchemaValidator({
      logger,
      ajvInstance: /** @type {any} */ (emptyAjv),
    });

    expect(
      validatorWithEmptyAjv.getValidator(
        'schema://living-narrative-engine/tests/absent.schema.json'
      )
    ).toBeUndefined();
  });

  test('isSchemaLoaded covers happy path, invalid input, and Ajv errors', async () => {
    const validator = new AjvSchemaValidator({ logger });

    expect(validator.isSchemaLoaded('')).toBe(false);

    const schema = {
      $id: 'schema://living-narrative-engine/tests/load-state.schema.json',
      type: 'object',
    };

    await validator.addSchema(schema, schema.$id);
    expect(validator.isSchemaLoaded(schema.$id)).toBe(true);

    const throwingAjv = {
      getSchema: jest.fn(() => {
        throw new Error('cannot compile');
      }),
      addSchema: jest.fn(),
      removeSchema: jest.fn(),
      schemas: {
        'schema://living-narrative-engine/tests/uncompilable.schema.json': {
          schema: {},
        },
      },
      compile: jest.fn(),
    };

    const validatorWithThrowingAjv = new AjvSchemaValidator({
      logger,
      ajvInstance: /** @type {any} */ (throwingAjv),
    });

    expect(
      validatorWithThrowingAjv.isSchemaLoaded(
        'schema://living-narrative-engine/tests/uncompilable.schema.json'
      )
    ).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "AjvSchemaValidator: Schema 'schema://living-narrative-engine/tests/uncompilable.schema.json' is registered but cannot be compiled"
      ),
      expect.objectContaining({
        schemaId:
          'schema://living-narrative-engine/tests/uncompilable.schema.json',
      })
    );
  });

  test('getLoadedSchemaIds enumerates schemas and handles access errors', () => {
    const validator = new AjvSchemaValidator({ logger });

    expect(validator.getLoadedSchemaIds()).toEqual(
      expect.arrayContaining(['http://json-schema.org/draft-07/schema'])
    );

    const problematicAjv = {
      getSchema: jest.fn(),
      addSchema: jest.fn(),
      removeSchema: jest.fn(),
      compile: jest.fn(),
    };

    Object.defineProperty(problematicAjv, 'schemas', {
      get() {
        throw new Error('schema map unavailable');
      },
    });

    const validatorWithProblematicAjv = new AjvSchemaValidator({
      logger,
      ajvInstance: /** @type {any} */ (problematicAjv),
    });

    expect(validatorWithProblematicAjv.getLoadedSchemaIds()).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      'AjvSchemaValidator: Error getting loaded schema IDs',
      expect.objectContaining({ error: expect.any(Error) })
    );
  });

  test('validateAgainstSchema integrates with shared helpers and reports failures', async () => {
    const validator = new AjvSchemaValidator({ logger });

    const schema = {
      $id: 'schema://living-narrative-engine/tests/integration-helper.schema.json',
      type: 'object',
      properties: {
        title: { type: 'string' },
        rating: { type: 'integer', minimum: 1, maximum: 5 },
      },
      required: ['title', 'rating'],
      additionalProperties: false,
    };

    await validator.addSchema(schema, schema.$id);

    expect(
      validator.validateAgainstSchema(
        { title: 'Valid item', rating: 4 },
        schema.$id,
        { validationDebugMessage: 'Validating item schema' }
      )
    ).toBe(true);

    const failedValidation = validator.validateAgainstSchema(
      { title: 'Invalid rating', rating: 9 },
      schema.$id,
      {
        validationDebugMessage: 'Validating item schema',
        failureMessage: 'Validation failed for item schema',
      }
    );
    expect(failedValidation).toBe(false);

    expect(logger.debug).toHaveBeenCalledWith('Validating item schema');
    expect(logger.error).toHaveBeenCalledWith(
      'Validation failed for item schema',
      expect.objectContaining({ schemaId: schema.$id })
    );

    expect(
      validator.validateAgainstSchema(
        { title: 'Skip missing schema', rating: 2 },
        'schema://living-narrative-engine/tests/not-loaded.schema.json',
        {
          skipIfSchemaNotLoaded: true,
          notLoadedMessage: 'Schema not yet available',
          notLoadedLogLevel: 'warn',
        }
      )
    ).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith('Schema not yet available');
  });

  test('formatAjvErrors delegates to the enhanced formatter', () => {
    const validator = new AjvSchemaValidator({ logger });
    const errors = [
      {
        instancePath: '/rating',
        schemaPath: '#/properties/rating/minimum',
        keyword: 'minimum',
        params: { comparison: '>=', limit: 1 },
        message: 'must be >= 1',
      },
    ];

    const formatted = validator.formatAjvErrors(errors, { rating: 0 });
    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('rating');
  });
});
