import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { createMockLogger } from '../testUtils.js';

/**
 * Helper to create a validator instance with mocked Ajv internals.
 *
 * @param {object} [options] - Setup options.
 * @param {object} [options.ajv] - Ajv instance to use.
 * @returns {{validator: any, logger: any, ajv: any}} - The constructed validator and mocks.
 */
function setup({ ajv } = {}) {
  jest.doMock('ajv', () =>
    jest.fn(
      () =>
        ajv || {
          addSchema: jest.fn(),
          getSchema: jest.fn(),
          removeSchema: jest.fn(),
        }
    )
  );
  jest.doMock('ajv-formats', () => jest.fn());
  const AjvSchemaValidator =
    require('../../../src/validation/ajvSchemaValidator.js').default;
  const logger = createMockLogger();
  const validator = new AjvSchemaValidator({ logger, ajvInstance: ajv });
  return { validator, logger, ajv };
}

afterEach(() => {
  jest.resetModules();
  jest.dontMock('ajv');
  jest.dontMock('ajv-formats');
});

describe('AjvSchemaValidator additional branch coverage', () => {
  it('throws when constructed without params (default arg branch)', () => {
    const AjvSchemaValidator =
      require('../../../src/validation/ajvSchemaValidator.js').default;
    expect(() => new AjvSchemaValidator()).toThrow(/logger/);
  });

  it('preloadSchemas ignores non-array input', () => {
    const addSchema = jest.fn();
    const ajv = { addSchema, getSchema: jest.fn(), removeSchema: jest.fn() };
    const { validator, logger } = setup({ ajv });
    validator.preloadSchemas(null);
    expect(addSchema).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('getLoadedSchemaIds handles missing schema map', () => {
    const ajv = {
      addSchema: jest.fn(),
      getSchema: jest.fn(),
      removeSchema: jest.fn(),
    };
    Object.defineProperty(ajv, 'schemas', { get: () => undefined });
    const { validator } = setup({ ajv });
    expect(validator.getLoadedSchemaIds()).toEqual([]);
  });

  it('validate handles undefined error list', () => {
    const validationFn = jest.fn(() => false);
    validationFn.errors = undefined;
    const ajv = {
      addSchema: jest.fn(),
      getSchema: jest.fn(() => validationFn),
      removeSchema: jest.fn(),
    };
    const { validator } = setup({ ajv });
    const result = validator.validate('id', {});
    expect(result).toEqual({ isValid: false, errors: [] });
  });
});
