import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { createMockLogger } from '../testUtils.js';

/**
 * Helper to create an AjvSchemaValidator that uses mocked Ajv internals.
 *
 * @param {object} [options] - Optional overrides for the mock behavior.
 * @param {Array<any>} [options.getSchemaReturns] - Values returned by the mocked getSchema in order.
 * @param {Function} [options.addSchemaImpl] - Implementation for addSchema.
 * @param {Function} [options.compileImpl] - Implementation for compile.
 * @returns {{validator: any, logger: ReturnType<typeof createMockLogger>, addSchema: jest.Mock, getSchema: jest.Mock, compile: jest.Mock}}
 * Returns a constructed validator and the mocked functions for assertions.
 */
function setupMockAjv({
  getSchemaReturns = [null],
  addSchemaImpl,
  compileImpl,
} = {}) {
  const getSchema = jest.fn();
  getSchemaReturns.forEach((val) => getSchema.mockReturnValueOnce(val));
  const addSchema = jest.fn(addSchemaImpl);
  const compile = jest.fn(compileImpl);
  const removeSchema = jest.fn();
  jest.doMock('ajv', () =>
    jest.fn(() => ({ addSchema, getSchema, removeSchema, compile }))
  );
  jest.doMock('ajv-formats', () => jest.fn());
  const AjvSchemaValidator =
    require('../../../src/validation/ajvSchemaValidator.js').default;
  const logger = createMockLogger();
  return {
    validator: new AjvSchemaValidator(logger),
    logger,
    addSchema,
    getSchema,
    compile,
  };
}

afterEach(() => {
  jest.resetModules();
  jest.dontMock('ajv');
  jest.dontMock('ajv-formats');
});

describe('AjvSchemaValidator reference and batch operations', () => {
  it('validateSchemaRefs warns and returns false when schema is missing', () => {
    const { validator, logger } = setupMockAjv({
      getSchemaReturns: [null, null],
    });
    const result = validator.validateSchemaRefs('missing');
    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('schema not found')
    );
  });

  it('validateSchemaRefs returns true when compilation succeeds', () => {
    const schemaObj = { schema: {} };
    const { validator, compile } = setupMockAjv({
      getSchemaReturns: [null, schemaObj],
      compileImpl: () => ({}),
    });
    const result = validator.validateSchemaRefs('good');
    expect(result).toBe(true);
    expect(compile).toHaveBeenCalledWith(schemaObj.schema);
  });

  it('validateSchemaRefs logs and returns false on compile error', () => {
    const error = new Error('boom');
    const schemaObj = { schema: {} };
    const { validator, logger } = setupMockAjv({
      getSchemaReturns: [null, schemaObj],
      compileImpl: () => {
        throw error;
      },
    });
    const result = validator.validateSchemaRefs('bad');
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('unresolved $refs'),
      expect.objectContaining({ schemaId: 'bad', error })
    );
  });

  it('getLoadedSchemaIds filters by loaded status', () => {
    jest.dontMock('ajv');
    jest.dontMock('ajv-formats');
    const AjvSchemaValidator =
      require('../../../src/validation/ajvSchemaValidator.js').default;
    const logger = createMockLogger();
    const validator = new AjvSchemaValidator(logger);
    jest
      .spyOn(validator, 'isSchemaLoaded')
      .mockImplementation((id) => id.includes('world.schema.json'));
    const result = validator.getLoadedSchemaIds();
    expect(result).toEqual(['http://example.com/schemas/world.schema.json']);
  });

  it('getLoadedSchemaIds logs and returns empty array on error', () => {
    jest.dontMock('ajv');
    jest.dontMock('ajv-formats');
    const AjvSchemaValidator =
      require('../../../src/validation/ajvSchemaValidator.js').default;
    const logger = createMockLogger();
    const validator = new AjvSchemaValidator(logger);
    jest.spyOn(validator, 'isSchemaLoaded').mockImplementation(() => {
      throw new Error('fail');
    });
    const result = validator.getLoadedSchemaIds();
    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      'AjvSchemaValidator: Error getting loaded schema IDs',
      { error: expect.any(Error) }
    );
  });

  it('addSchemas rejects for non-array input', async () => {
    jest.dontMock('ajv');
    jest.dontMock('ajv-formats');
    const AjvSchemaValidator =
      require('../../../src/validation/ajvSchemaValidator.js').default;
    const logger = createMockLogger();
    const validator = new AjvSchemaValidator(logger);
    await expect(validator.addSchemas(null)).rejects.toThrow(
      'addSchemas called with empty or non-array input.'
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'addSchemas called with empty or non-array input.'
      )
    );
  });

  it('addSchemas rejects when a schema lacks $id', async () => {
    jest.dontMock('ajv');
    jest.dontMock('ajv-formats');
    const AjvSchemaValidator =
      require('../../../src/validation/ajvSchemaValidator.js').default;
    const logger = createMockLogger();
    const validator = new AjvSchemaValidator(logger);
    await expect(validator.addSchemas([{}])).rejects.toThrow(
      'All schemas must be objects with a valid $id.'
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('All schemas must be objects with a valid $id.')
    );
  });

  it('addSchemas resolves and logs on success', async () => {
    const { validator, logger, addSchema } = setupMockAjv({
      getSchemaReturns: [null],
    });
    const schemas = [{ $id: 'a' }, { $id: 'b' }];
    await expect(validator.addSchemas(schemas)).resolves.toBeUndefined();
    expect(addSchema).toHaveBeenCalledWith(schemas);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Successfully added 2 schemas')
    );
  });

  it('addSchemas logs details when Ajv.addSchema throws', async () => {
    const error = new Error('batch');
    error.errors = [{ message: 'oops' }];
    const { validator, logger } = setupMockAjv({
      getSchemaReturns: [null],
      addSchemaImpl: () => {
        throw error;
      },
    });
    const schemas = [{ $id: 'a' }];
    await expect(validator.addSchemas(schemas)).rejects.toThrow('batch');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error adding schemas in batch'),
      { error }
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Ajv Validation Errors (during addSchemas):',
      JSON.stringify(error.errors, null, 2)
    );
  });
});
