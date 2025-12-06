import { describe, it, expect, beforeEach } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import {
  registerSchema,
  registerInlineSchema,
} from '../../../src/utils/schemaUtils.js';

class RecordingLogger {
  constructor() {
    this.debugCalls = [];
    this.infoCalls = [];
    this.warnCalls = [];
    this.errorCalls = [];
  }

  debug(message, ...args) {
    this.debugCalls.push([message, ...args]);
  }

  info(message, ...args) {
    this.infoCalls.push([message, ...args]);
  }

  warn(message, ...args) {
    this.warnCalls.push([message, ...args]);
  }

  error(message, ...args) {
    this.errorCalls.push([message, ...args]);
  }
}

describe('schemaUtils integration with AjvSchemaValidator', () => {
  /** @type {AjvSchemaValidator} */
  let validator;
  /** @type {RecordingLogger} */
  let logger;

  beforeEach(() => {
    logger = new RecordingLogger();
    validator = new AjvSchemaValidator({ logger });
  });

  it('registerSchema replaces existing schemas using the real validator', async () => {
    const firstSchema = {
      $id: 'schema://living-narrative-engine/tests/schema-utils/first.schema.json',
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    };

    const secondSchema = {
      $id: 'schema://living-narrative-engine/tests/schema-utils/second.schema.json',
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    };

    const schemaId =
      'schema://living-narrative-engine/tests/schema-utils/active.schema.json';

    await registerSchema(validator, firstSchema, schemaId, logger);

    const initialValidation = validator.validate(schemaId, { id: 'abc' });
    expect(initialValidation.isValid).toBe(false);

    await registerSchema(validator, secondSchema, schemaId, logger);

    const warnings = logger.warnCalls.map(([message]) => message);
    expect(warnings).toContain(
      "Schema 'schema://living-narrative-engine/tests/schema-utils/active.schema.json' already loaded. Overwriting."
    );

    const afterReplacement = validator.validate(schemaId, { id: 'abc' });
    expect(afterReplacement.isValid).toBe(true);
    const stillInvalid = validator.validate(schemaId, { name: 'Alice' });
    expect(stillInvalid.isValid).toBe(false);
  });

  it('registerInlineSchema logs success when provided and keeps the validator usable', async () => {
    const schemaId =
      'schema://living-narrative-engine/tests/schema-utils/inline.schema.json';
    const schema = {
      type: 'object',
      properties: {
        payload: { type: 'number' },
      },
    };

    await registerInlineSchema(validator, schema, schemaId, logger, {
      successDebugMessage: 'inline schema registered',
    });

    expect(logger.debugCalls).toContainEqual(['inline schema registered']);

    const ok = validator.validate(schemaId, { payload: 42 });
    expect(ok.isValid).toBe(true);
    const bad = validator.validate(schemaId, { payload: 'oops' });
    expect(bad.isValid).toBe(false);

    const noMessageSchemaId =
      'schema://living-narrative-engine/tests/schema-utils/inline-no-message.schema.json';
    await registerInlineSchema(validator, schema, noMessageSchemaId, logger);
    const inlineMessages = logger.debugCalls.filter(
      ([message]) => message === 'inline schema registered'
    );
    expect(inlineMessages).toHaveLength(1);
  });

  it('registerInlineSchema propagates validator errors with contextual logging', async () => {
    const faultySchema = { type: 'object' };

    await expect(
      registerInlineSchema(validator, faultySchema, '', logger, {
        errorLogMessage: 'failed to register schema',
        errorContext: () => {
          throw new Error('context failure');
        },
        throwErrorMessage: 'Schema registration wrapper failed',
      })
    ).rejects.toThrow('Schema registration wrapper failed');

    expect(logger.errorCalls.length).toBeGreaterThanOrEqual(1);
    const [message, context, originalError] = logger.errorCalls.at(-1);
    expect(message).toBe('failed to register schema');
    expect(context).toMatchObject({
      error:
        'AjvSchemaValidator: Invalid or empty schemaId provided. Expected a non-empty string.',
    });
    expect(originalError).toBeInstanceOf(Error);
    expect(originalError.message).toContain('Invalid or empty schemaId');
  });

  it('registerInlineSchema preserves provided error context when rethrowing the original error', async () => {
    const schemaWithIssue = { type: 'object' };

    await expect(
      registerInlineSchema(validator, schemaWithIssue, '', logger, {
        errorLogMessage: 'captured failure',
        errorContext: {
          source: 'integration-test',
          error: 'pre-provided context message',
        },
      })
    ).rejects.toThrow(
      'AjvSchemaValidator: Invalid or empty schemaId provided. Expected a non-empty string.'
    );

    const [message, context, originalError] = logger.errorCalls.at(-1);
    expect(message).toBe('captured failure');
    expect(context).toMatchObject({
      source: 'integration-test',
      error: 'pre-provided context message',
    });
    expect(originalError).toBeInstanceOf(Error);
    expect(originalError.message).toContain(
      'Invalid or empty schemaId provided'
    );
  });

  it('registerInlineSchema leaves logging to the validator when no error log message is provided', async () => {
    const failingSchema = { type: 'object' };
    const initialErrorCount = logger.errorCalls.length;

    await expect(
      registerInlineSchema(validator, failingSchema, '', logger)
    ).rejects.toThrow(
      'AjvSchemaValidator: Invalid or empty schemaId provided. Expected a non-empty string.'
    );

    expect(logger.errorCalls.length).toBe(initialErrorCount + 1);
    const [message] = logger.errorCalls.at(-1);
    expect(message).toMatch(/AjvSchemaValidator\.addSchema:/);
  });
});
