import { describe, it, expect, beforeEach } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../testUtils.js';

const sampleSchema = {
  $id: 'test://schemas/sample2',
  type: 'object',
  properties: { id: { type: 'number' } },
  required: ['id'],
  additionalProperties: false,
};

/**
 * Creates a validator instance with a fresh mock logger.
 *
 * @returns {{validator: AjvSchemaValidator, logger: ReturnType<typeof createMockLogger>}}
 * Returns the validator and associated mock logger.
 */
function createValidator() {
  const logger = createMockLogger();
  const validator = new AjvSchemaValidator(logger);
  return { validator, logger };
}

describe('AjvSchemaValidator edge branch tests', () => {
  let validator;
  let logger;

  beforeEach(() => {
    ({ validator, logger } = createValidator());
  });

  it('rejects when addSchema is called with invalid schemaData', async () => {
    await expect(validator.addSchema(null, 'bad-id')).rejects.toThrow(
      'Invalid or empty schemaData'
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or empty schemaData')
    );
  });

  it('rejects when addSchema is called with invalid schemaId', async () => {
    await expect(validator.addSchema(sampleSchema, '')).rejects.toThrow(
      'Invalid or empty schemaId'
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or empty schemaId')
    );
  });

  it('returns undefined and warns for invalid schemaId in getValidator', () => {
    const result = validator.getValidator(123);
    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('getValidator called with invalid schemaId')
    );
  });

  it('returns false for invalid schemaId in isSchemaLoaded', () => {
    const result = validator.isSchemaLoaded('');
    expect(result).toBe(false);
  });

  it('logs and returns false if removeSchema throws', () => {
    const removeError = new Error('remove fail');
    const getSchema = jest.fn().mockReturnValueOnce({});
    const removeSchema = jest.fn(() => {
      throw removeError;
    });
    jest.doMock('ajv', () =>
      jest.fn(() => ({ addSchema: jest.fn(), getSchema, removeSchema }))
    );
    jest.doMock('ajv-formats', () => jest.fn());
    jest.resetModules();
    const AjvSchemaValidatorReloaded =
      require('../../../src/validation/ajvSchemaValidator.js').default;
    const logger2 = createMockLogger();
    const freshValidator = new AjvSchemaValidatorReloaded(logger2);

    const result = freshValidator.removeSchema('some-id');
    expect(result).toBe(false);
    expect(logger2.error).toHaveBeenCalledWith(
      expect.stringContaining('Error removing schema'),
      expect.objectContaining({ schemaId: 'some-id', error: removeError })
    );
  });
});
