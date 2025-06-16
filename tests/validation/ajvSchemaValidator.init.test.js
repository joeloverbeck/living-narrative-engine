/**
 * @file Test suite for AjvSchemaValidator initialization edge cases.
 * @returns {void}
 */
/**
 * Creates a mock logger.
 *
 * @returns {object} mock logger
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('AjvSchemaValidator initialization edge cases', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('ajv');
    jest.dontMock('ajv-formats');
  });

  it('throws when Ajv constructor fails', () => {
    jest.doMock('ajv', () => {
      return jest.fn(() => {
        throw new Error('boom');
      });
    });
    jest.doMock('ajv-formats', () => jest.fn());
    const logger = createMockLogger();
    const AjvSchemaValidator =
      require('../../src/validation/ajvSchemaValidator.js').default;
    expect(() => new AjvSchemaValidator(logger)).toThrow(
      'AjvSchemaValidator: Failed to initialize Ajv.'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'AjvSchemaValidator: CRITICAL - Failed to instantiate Ajv or add formats:',
      expect.any(Error)
    );
  });

  it('does not add schema if it already exists', () => {
    const addSchema = jest.fn();
    const getSchema = jest.fn(() => ({}));
    jest.doMock('ajv', () =>
      jest.fn(() => ({ addSchema, getSchema, removeSchema: jest.fn() }))
    );
    jest.doMock('ajv-formats', () => jest.fn());
    const logger = createMockLogger();
    const AjvSchemaValidator =
      require('../../src/validation/ajvSchemaValidator.js').default;
    new AjvSchemaValidator(logger);
    expect(addSchema).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('already loaded. Skipping.')
    );
  });

  it('logs an error when preloading schema fails', () => {
    const getSchema = jest.fn(() => null);
    const addSchema = jest.fn(() => {
      throw new Error('add fail');
    });
    jest.doMock('ajv', () =>
      jest.fn(() => ({ addSchema, getSchema, removeSchema: jest.fn() }))
    );
    jest.doMock('ajv-formats', () => jest.fn());
    const logger = createMockLogger();
    const AjvSchemaValidator =
      require('../../src/validation/ajvSchemaValidator.js').default;
    new AjvSchemaValidator(logger);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to preload schema'),
      expect.objectContaining({
        schemaId: expect.any(String),
        error: expect.any(Error),
      })
    );
  });
});
