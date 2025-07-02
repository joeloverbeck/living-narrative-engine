import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { createMockLogger } from '../testUtils.js';

function setupWithCustomAjv() {
  jest.dontMock('ajv');
  jest.dontMock('ajv-formats');
  const AjvSchemaValidator =
    require('../../../src/validation/ajvSchemaValidator.js').default;
  const mockAjv = {
    addSchema: jest.fn(),
    getSchema: jest.fn(),
    removeSchema: jest.fn(),
  };
  const logger = createMockLogger();
  const validator = new AjvSchemaValidator({ logger, ajvInstance: mockAjv });
  return { validator, logger, mockAjv };
}

afterEach(() => {
  jest.resetModules();
  jest.dontMock('ajv');
  jest.dontMock('ajv-formats');
});

describe('AjvSchemaValidator custom Ajv and batch validation', () => {
  it('uses provided Ajv instance', async () => {
    const { validator, logger, mockAjv } = setupWithCustomAjv();
    expect(logger.debug).toHaveBeenCalledWith(
      'AjvSchemaValidator: Using provided Ajv instance.'
    );
    const schema = { $id: 'x', type: 'object' };
    await validator.addSchema(schema, 'x');
    expect(mockAjv.addSchema).toHaveBeenCalledWith(schema, 'x');
  });

  it('preloadSchemas warns on invalid entries', () => {
    const { validator, logger } = setupWithCustomAjv();
    validator.preloadSchemas([null, { schema: {}, id: '' }]);
    expect(logger.warn).toHaveBeenCalledWith(
      'AjvSchemaValidator.preloadSchemas: invalid entry encountered.'
    );
  });

  it('addSchemas rejects when entry is not object', async () => {
    const { validator, logger } = setupWithCustomAjv();
    await expect(validator.addSchemas([null])).rejects.toThrow(
      'All schemas must be objects with a valid $id.'
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('All schemas must be objects with a valid $id.')
    );
  });
});
