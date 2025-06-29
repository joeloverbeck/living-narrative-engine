import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { createMockLogger } from '../testUtils.js';

/**
 *
 * @param root0
 * @param root0.getSchemaReturns
 * @param root0.addSchemaImpl
 */
function setupMockAjv({ getSchemaReturns = [], addSchemaImpl } = {}) {
  const getSchema = jest.fn();
  getSchemaReturns.forEach((val) => getSchema.mockReturnValueOnce(val));
  const addSchema = jest.fn(addSchemaImpl);
  const removeSchema = jest.fn();
  const compile = jest.fn();
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
  };
}

afterEach(() => {
  jest.resetModules();
  jest.dontMock('ajv');
  jest.dontMock('ajv-formats');
});

describe('AjvSchemaValidator uncovered branches', () => {
  it('warns when schema is added but cannot be retrieved', async () => {
    const { validator, logger } = setupMockAjv({
      getSchemaReturns: [null, null],
    });
    const schema = { $id: 'test://schemas/missing', type: 'object' };
    await expect(
      validator.addSchema(schema, schema.$id)
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('was added but cannot be retrieved')
    );
  });

  it('wraps non-Error thrown by addSchema', async () => {
    const { validator } = setupMockAjv({
      getSchemaReturns: [null],
      addSchemaImpl: () => {
        throw 'boom';
      },
    });
    const schema = { $id: 'test://schemas/fail', type: 'object' };
    await expect(validator.addSchema(schema, schema.$id)).rejects.toThrow(
      `Failed to add schema '${schema.$id}': boom`
    );
  });

  it('wraps non-Error thrown by addSchemas', async () => {
    const { validator } = setupMockAjv({
      addSchemaImpl: () => {
        throw 'batch';
      },
    });
    const schemas = [{ $id: 'a' }];
    await expect(validator.addSchemas(schemas)).rejects.toThrow(
      'Failed to add schemas in batch: batch'
    );
  });
});
