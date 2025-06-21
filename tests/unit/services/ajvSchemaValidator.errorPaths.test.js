import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { createMockLogger } from '../testUtils.js';

/** Utility to reset module mocks after each test */
afterEach(() => {
  jest.resetModules();
  jest.dontMock('ajv');
  jest.dontMock('ajv-formats');
});

describe('AjvSchemaValidator error paths', () => {
  it('logs details when Ajv.addSchema throws with validation errors', async () => {
    const error = new Error('add fail');
    error.errors = [{ message: 'bad schema' }];
    const addSchema = jest.fn(() => {
      throw error;
    });
    const getSchema = jest.fn(() => null);
    const removeSchema = jest.fn();
    jest.doMock('ajv', () =>
      jest.fn(() => ({ addSchema, getSchema, removeSchema }))
    );
    jest.doMock('ajv-formats', () => jest.fn());
    const AjvSchemaValidator =
      require('../../../src/validation/ajvSchemaValidator.js').default;
    const logger = createMockLogger();
    const validator = new AjvSchemaValidator(logger);

    const schema = { $id: 'test://schemas/err', type: 'object' };
    await expect(validator.addSchema(schema, schema.$id)).rejects.toThrow(
      'add fail'
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(`Error adding schema with ID '${schema.$id}'`),
      expect.objectContaining({ schemaId: schema.$id, error })
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Ajv Validation Errors (during addSchema):',
      JSON.stringify(error.errors, null, 2)
    );
  });

  it('returns undefined and logs when Ajv.getSchema throws in getValidator', () => {
    const getSchema = jest.fn(() => {
      throw new Error('get fail');
    });
    jest.doMock('ajv', () =>
      jest.fn(() => ({
        addSchema: jest.fn(),
        getSchema,
        removeSchema: jest.fn(),
      }))
    );
    jest.doMock('ajv-formats', () => jest.fn());
    const AjvSchemaValidator =
      require('../../../src/validation/ajvSchemaValidator.js').default;
    const logger = createMockLogger();
    const validator = new AjvSchemaValidator(logger);

    const result = validator.getValidator('bad-id');
    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Error accessing schema'),
      expect.objectContaining({ schemaId: 'bad-id', error: expect.any(Error) })
    );
  });

  it('wraps validator errors into runtimeError results', () => {
    const mockValidate = jest.fn(() => {
      throw new Error('runtime');
    });
    const getSchema = jest.fn(() => mockValidate);
    jest.doMock('ajv', () =>
      jest.fn(() => ({
        addSchema: jest.fn(),
        getSchema,
        removeSchema: jest.fn(),
      }))
    );
    jest.doMock('ajv-formats', () => jest.fn());
    const AjvSchemaValidator =
      require('../../../src/validation/ajvSchemaValidator.js').default;
    const logger = createMockLogger();
    const validator = new AjvSchemaValidator(logger);

    const validate = validator.getValidator('runtime-id');
    const result = validate({});
    expect(result.isValid).toBe(false);
    expect(result.errors[0].keyword).toBe('runtimeError');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Runtime error during validation'),
      expect.objectContaining({
        schemaId: 'runtime-id',
        error: expect.any(Error),
      })
    );
  });

  it('logs and returns false when Ajv.getSchema throws in isSchemaLoaded', () => {
    const getSchema = jest.fn(() => {
      throw new Error('boom');
    });
    jest.doMock('ajv', () =>
      jest.fn(() => ({
        addSchema: jest.fn(),
        getSchema,
        removeSchema: jest.fn(),
      }))
    );
    jest.doMock('ajv-formats', () => jest.fn());
    const AjvSchemaValidator =
      require('../../../src/validation/ajvSchemaValidator.js').default;
    const logger = createMockLogger();
    const validator = new AjvSchemaValidator(logger);

    const result = validator.isSchemaLoaded('my-schema');
    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Error accessing schema'),
      expect.objectContaining({
        schemaId: 'my-schema',
        error: expect.any(Error),
      })
    );
  });

  it('logs error when schema persists after removeSchema', () => {
    const getSchema = jest
      .fn()
      .mockReturnValueOnce({}) // constructor preload check
      .mockReturnValueOnce({}) // existence check
      .mockReturnValueOnce({}); // still present after removal
    const removeSchema = jest.fn();
    jest.doMock('ajv', () =>
      jest.fn(() => ({ addSchema: jest.fn(), getSchema, removeSchema }))
    );
    jest.doMock('ajv-formats', () => jest.fn());
    const AjvSchemaValidator =
      require('../../../src/validation/ajvSchemaValidator.js').default;
    const logger = createMockLogger();
    const validator = new AjvSchemaValidator(logger);

    const result = validator.removeSchema('leftover');
    expect(removeSchema).toHaveBeenCalledWith('leftover');
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('still appears present')
    );
  });
});
