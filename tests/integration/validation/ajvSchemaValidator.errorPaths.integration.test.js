import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

function createTestLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('AjvSchemaValidator integration error-path coverage', () => {
  /** @type {ReturnType<typeof createTestLogger>} */
  let logger;
  /** @type {AjvSchemaValidator} */
  let validator;

  beforeEach(() => {
    logger = createTestLogger();
    validator = new AjvSchemaValidator({ logger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('addSchema surfaces Ajv availability issues', async () => {
    const schema = {
      $id: 'schema://living-narrative-engine/tests/error-paths/unavailable-ajv.schema.json',
      type: 'object',
    };

    validator._setAjvInstanceForTesting(null);

    await expect(validator.addSchema(schema, schema.$id)).rejects.toThrow(
      'AjvSchemaValidator: Ajv instance not available.'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'AjvSchemaValidator.addSchema: Ajv instance not available.'
    );
  });

  test('removeSchema reports missing Ajv and removal failures', async () => {
    const schemaId =
      'schema://living-narrative-engine/tests/error-paths/remove-target.schema.json';

    validator._setAjvInstanceForTesting(null);

    expect(() => validator.removeSchema(schemaId)).toThrow(
      'AjvSchemaValidator: Ajv instance not available.'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'AjvSchemaValidator.removeSchema: Ajv instance not available. Cannot remove schema.'
    );

    const removeError = new Error('cannot remove');
    const throwingAjv = {
      getSchema: jest.fn(() => ({ schema: {} })),
      removeSchema: jest.fn(() => {
        throw removeError;
      }),
    };

    validator = new AjvSchemaValidator({ logger });
    validator._setAjvInstanceForTesting(/** @type {any} */ (throwingAjv));

    expect(validator.removeSchema(schemaId)).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "AjvSchemaValidator: Error removing schema 'schema://living-narrative-engine/tests/error-paths/remove-target.schema.json'"
      ),
      expect.objectContaining({ error: removeError })
    );
  });

  test('preloadSchemas skips invalid entries and warns when verification fails', () => {
    validator.preloadSchemas(/** @type {any} */ (null));
    expect(logger.warn).not.toHaveBeenCalled();

    const verifyingAjv = {
      getSchema: jest
        .fn()
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(undefined),
      addSchema: jest.fn(),
    };

    validator = new AjvSchemaValidator({ logger });
    validator._setAjvInstanceForTesting(/** @type {any} */ (verifyingAjv));

    validator.preloadSchemas([
      /** @type {any} */ (null),
      { id: '', schema: {} },
      {
        id: 'schema://living-narrative-engine/tests/error-paths/preload.schema.json',
        schema: { type: 'string' },
      },
    ]);

    expect(logger.warn).toHaveBeenCalledWith(
      'AjvSchemaValidator.preloadSchemas: invalid entry encountered.'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "AjvSchemaValidator: Schema 'schema://living-narrative-engine/tests/error-paths/preload.schema.json' was preloaded but cannot be retrieved. This may indicate a $ref resolution issue."
    );
  });

  test('getValidator and validate handle invalid identifiers and Ajv access errors', () => {
    validator._setAjvInstanceForTesting(null);

    expect(validator.getValidator('schema://missing')).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'AjvSchemaValidator: getValidator called but Ajv instance not available.'
    );

    logger.warn.mockClear();

    expect(validator.validate('schema://missing', {})).toEqual({
      isValid: false,
      errors: [expect.objectContaining({ keyword: 'schemaNotFound' })],
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "AjvSchemaValidator: validate called for schemaId 'schema://missing', but no validator function was found."
    );

    validator = new AjvSchemaValidator({ logger });
    const throwingAjv = {
      getSchema: jest.fn(() => {
        throw new Error('getSchema boom');
      }),
      schemas: {},
    };
    validator._setAjvInstanceForTesting(/** @type {any} */ (throwingAjv));

    expect(
      validator.getValidator(
        'schema://living-narrative-engine/tests/error-paths/access.schema.json'
      )
    ).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "AjvSchemaValidator: Error accessing schema 'schema://living-narrative-engine/tests/error-paths/access.schema.json' via ajv.getSchema"
      ),
      expect.objectContaining({ schemaId: expect.any(String) })
    );

    logger.warn.mockClear();
    expect(validator.getValidator('')).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'AjvSchemaValidator: getValidator called with invalid schemaId: '
    );
  });

  test('validateSchemaRefs and getLoadedSchemaIds react to missing Ajv', () => {
    validator._setAjvInstanceForTesting(null);

    expect(validator.validateSchemaRefs('schema://missing')).toBe(false);
    expect(validator.getLoadedSchemaIds()).toEqual([]);
  });

  test('addSchemas enforces valid input and reports Ajv errors', async () => {
    await expect(
      validator.addSchemas([
        {
          $id: '',
          type: 'object',
        },
      ])
    ).rejects.toThrow(
      'AjvSchemaValidator: All schemas must be objects with a valid $id.'
    );

    validator._setAjvInstanceForTesting(null);
    await expect(
      validator.addSchemas([
        {
          $id: 'schema://living-narrative-engine/tests/error-paths/another.schema.json',
          type: 'object',
        },
      ])
    ).rejects.toThrow('AjvSchemaValidator: Ajv instance not available.');

    const batchError = Object.assign(new Error('batch failure'), {
      errors: [{ instancePath: '#', message: 'invalid batch' }],
    });
    const failingAjv = {
      getSchema: jest.fn(() => undefined),
      addSchema: jest.fn(() => {
        throw batchError;
      }),
    };

    validator = new AjvSchemaValidator({ logger });
    validator._setAjvInstanceForTesting(/** @type {any} */ (failingAjv));

    await expect(
      validator.addSchemas([
        {
          $id: 'schema://living-narrative-engine/tests/error-paths/batch.schema.json',
          type: 'object',
        },
      ])
    ).rejects.toThrow('batch failure');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'AjvSchemaValidator: Error adding schemas in batch'
      ),
      expect.objectContaining({ error: batchError })
    );
  });
});
