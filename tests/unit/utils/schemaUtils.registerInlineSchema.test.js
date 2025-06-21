import { describe, it, expect, jest } from '@jest/globals';
import { registerInlineSchema } from '../../../src/utils/schemaUtils.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */

describe('registerInlineSchema', () => {
  /** @type {ISchemaValidator} */
  let validator;
  /** @type {ILogger} */
  let logger;

  beforeEach(() => {
    validator = {
      isSchemaLoaded: jest.fn().mockReturnValue(false),
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

  it('registers schema and logs debug message on success', async () => {
    await registerInlineSchema(validator, { type: 'object' }, 'test', logger, {
      successDebugMessage: 'success',
    });
    expect(validator.addSchema).toHaveBeenCalledWith(
      { type: 'object' },
      'test'
    );
    expect(logger.debug).toHaveBeenCalledWith('success');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs error and throws custom message on failure', async () => {
    const err = new Error('add failed');
    validator.addSchema.mockRejectedValue(err);
    await expect(
      registerInlineSchema(validator, { type: 'object' }, 'bad', logger, {
        errorLogMessage: 'failed',
        throwErrorMessage: 'boom',
      })
    ).rejects.toThrow('boom');
    expect(logger.error).toHaveBeenCalledWith(
      'failed',
      expect.objectContaining({ error: err.message }),
      err
    );
  });

  it('rethrows original error and derives context from function', async () => {
    const err = new Error('boom');
    validator.addSchema.mockRejectedValue(err);
    const ctxFn = jest.fn().mockReturnValue({ foo: 'bar' });
    await expect(
      registerInlineSchema(validator, { type: 'object' }, 'id', logger, {
        errorLogMessage: 'failed',
        errorContext: ctxFn,
      })
    ).rejects.toThrow(err);
    expect(ctxFn).toHaveBeenCalledWith(err);
    expect(logger.error).toHaveBeenCalledWith(
      'failed',
      { foo: 'bar', error: err.message },
      err
    );
  });
  it('omits debug logging when successDebugMessage is missing', async () => {
    await registerInlineSchema(validator, { type: 'object' }, 'id', logger);
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('rethrows error without logging when logger is missing', async () => {
    const err = new Error('oops');
    validator.addSchema.mockRejectedValue(err);
    await expect(
      registerInlineSchema(validator, { type: 'object' }, 'id')
    ).rejects.toThrow(err);
  });
});
