import { describe, it, expect, jest } from '@jest/globals';
import { registerSchema } from '../../../src/utils/schemaUtils.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */

describe('registerSchema', () => {
  /** @type {ISchemaValidator} */
  let validator;
  /** @type {ILogger} */
  let logger;

  beforeEach(() => {
    validator = {
      isSchemaLoaded: jest.fn(),
      removeSchema: jest.fn(),
      addSchema: jest.fn().mockResolvedValue(undefined),
    };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  it('adds schema when not already loaded', async () => {
    validator.isSchemaLoaded.mockReturnValue(false);

    await registerSchema(validator, { type: 'object' }, 'id', logger);

    expect(validator.removeSchema).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(validator.addSchema).toHaveBeenCalledWith({ type: 'object' }, 'id');
  });

  it('removes existing schema and logs warning when already loaded', async () => {
    validator.isSchemaLoaded.mockReturnValue(true);

    await registerSchema(validator, { type: 'object' }, 'id', logger, 'custom');

    expect(logger.warn).toHaveBeenCalledWith('custom');
    expect(validator.removeSchema).toHaveBeenCalledWith('id');
    expect(validator.addSchema).toHaveBeenCalledWith({ type: 'object' }, 'id');
  });

  it('handles missing warn logger gracefully', async () => {
    validator.isSchemaLoaded.mockReturnValue(true);
    const noWarnLogger = {};

    await registerSchema(validator, { type: 'object' }, 'id', noWarnLogger);

    expect(validator.removeSchema).toHaveBeenCalledWith('id');
    expect(validator.addSchema).toHaveBeenCalledWith({ type: 'object' }, 'id');
  });
  it('logs default warning message when warnMessage is omitted', async () => {
    validator.isSchemaLoaded.mockReturnValue(true);
    await registerSchema(validator, { type: 'object' }, 'id', logger);
    expect(logger.warn).toHaveBeenCalledWith(
      "Schema 'id' already loaded. Overwriting."
    );
  });
});
