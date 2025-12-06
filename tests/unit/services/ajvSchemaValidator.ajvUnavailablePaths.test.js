import { describe, it, beforeEach, expect } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../testUtils.js';

describe('AjvSchemaValidator when Ajv instance becomes unavailable', () => {
  let logger;
  let validator;

  beforeEach(() => {
    logger = createMockLogger();
    validator = new AjvSchemaValidator({ logger });
    validator._setAjvInstanceForTesting(null);
  });

  it('logs and rethrows when addSchema is called without an Ajv instance', async () => {
    await expect(
      validator.addSchema(
        { $id: 'schema://missing', type: 'object' },
        'schema://missing'
      )
    ).rejects.toThrow('AjvSchemaValidator: Ajv instance not available.');

    expect(logger.error).toHaveBeenCalledWith(
      'AjvSchemaValidator.addSchema: Ajv instance not available.'
    );
  });

  it('logs and rethrows when removeSchema is called without an Ajv instance', () => {
    expect(() => validator.removeSchema('schema://missing')).toThrow(
      'AjvSchemaValidator: Ajv instance not available.'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'AjvSchemaValidator.removeSchema: Ajv instance not available. Cannot remove schema.'
    );
  });

  it('logs and returns undefined when getValidator is called without Ajv', () => {
    const result = validator.getValidator('schema://missing');

    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'AjvSchemaValidator: getValidator called but Ajv instance not available.'
    );
  });

  it('returns an empty list of schema IDs when Ajv is missing', () => {
    expect(validator.getLoadedSchemaIds()).toEqual([]);
  });

  it('logs and rethrows when addSchemas is called without Ajv', async () => {
    await expect(
      validator.addSchemas([{ $id: 'schema://batch', type: 'object' }])
    ).rejects.toThrow('AjvSchemaValidator: Ajv instance not available.');

    expect(logger.error).toHaveBeenCalledWith(
      'AjvSchemaValidator.addSchemas: Ajv instance not available.'
    );
  });
});
