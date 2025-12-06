import { describe, it, expect } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

class RecordingLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(...args) {
    this.debugMessages.push(args);
  }

  info(...args) {
    this.infoMessages.push(args);
  }

  warn(...args) {
    this.warnMessages.push(args);
  }

  error(...args) {
    this.errorMessages.push(args);
  }
}

describe('AjvSchemaValidator schema loader integration', () => {
  it('resolves relative and absolute references while managing schema lifecycle', async () => {
    const logger = new RecordingLogger();

    const baseSchema = {
      $id: 'schema://living-narrative-engine/common/base.schema.json',
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 1 },
        tag: { type: 'string', minLength: 1 },
      },
      required: ['id'],
    };

    const absoluteBaseSchema = {
      $id: 'schema://living-narrative-engine/absolute/base.schema.json',
      type: 'object',
      properties: {
        count: { type: 'integer', minimum: 0 },
      },
      required: ['count'],
    };

    const validator = new AjvSchemaValidator({
      logger,
      preloadSchemas: [
        { id: baseSchema.$id, schema: baseSchema },
        { id: absoluteBaseSchema.$id, schema: absoluteBaseSchema },
        null,
      ],
    });

    const relativeSchema = {
      $id: 'schema://living-narrative-engine/actions/forms/example.schema.json',
      type: 'object',
      allOf: [
        { $ref: '../../common/base.schema.json' },
        {
          properties: {
            tag: { type: 'string', minLength: 3 },
          },
          required: ['tag'],
        },
      ],
    };

    const absoluteRefSchema = {
      $id: 'schema://living-narrative-engine/actions/forms/countWrapper.schema.json',
      $ref: 'schema://living-narrative-engine/absolute/base.schema.json',
    };

    await validator.addSchema(relativeSchema, relativeSchema.$id);
    await validator.addSchema(absoluteRefSchema, absoluteRefSchema.$id);

    expect(validator.validateSchemaRefs(relativeSchema.$id)).toBe(true);
    expect(validator.validateSchemaRefs(absoluteRefSchema.$id)).toBe(true);

    expect(validator.isSchemaLoaded(relativeSchema.$id)).toBe(true);
    expect(validator.isSchemaLoaded(absoluteRefSchema.$id)).toBe(true);

    const successResult = validator.validate(relativeSchema.$id, {
      id: 'hero-123',
      tag: 'ally',
    });
    expect(successResult.isValid).toBe(true);

    const failureResult = validator.validate(relativeSchema.$id, {
      tag: 'al',
    });
    expect(failureResult.isValid).toBe(false);
    expect(Array.isArray(failureResult.errors)).toBe(true);
    const formatted = validator.formatAjvErrors(failureResult.errors, {
      tag: 'al',
    });
    expect(formatted).toContain('tag');

    expect(
      validator.validateAgainstSchema(
        {
          id: 'hero-123',
          tag: 'alliance',
        },
        relativeSchema.$id,
        {
          validationDebugMessage: 'validating relative schema',
          failureMessage: 'relative schema validation failed',
          failureContext: { scenario: 'integration' },
        }
      )
    ).toBe(true);

    const validatorFn = validator.getValidator(relativeSchema.$id);
    expect(typeof validatorFn).toBe('function');
    const directResult = validatorFn({
      id: 'hero-999',
      tag: 'mentor',
    });
    expect(directResult.isValid).toBe(true);

    expect(validator.removeSchema(relativeSchema.$id)).toBe(true);
    expect(validator.isSchemaLoaded(relativeSchema.$id)).toBe(false);
    expect(
      validator.removeSchema(
        'schema://living-narrative-engine/missing.schema.json'
      )
    ).toBe(false);
    expect(validator.removeSchema('   ')).toBe(false);

    await validator.addSchema(relativeSchema, relativeSchema.$id);

    await validator.addSchemas([
      { $id: absoluteBaseSchema.$id, type: 'object' },
      {
        $id: 'schema://living-narrative-engine/batch/new.schema.json',
        type: 'object',
        properties: {
          value: { type: 'number', minimum: 0 },
        },
      },
    ]);

    expect(validator.getLoadedSchemaIds()).toEqual(
      expect.arrayContaining([
        baseSchema.$id,
        absoluteBaseSchema.$id,
        'schema://living-narrative-engine/batch/new.schema.json',
      ])
    );

    const duplicateError = `AjvSchemaValidator: Schema with ID '${relativeSchema.$id}' already exists. Ajv does not overwrite. Use removeSchema first if replacement is intended.`;
    await expect(
      validator.addSchema(relativeSchema, relativeSchema.$id)
    ).rejects.toThrow(duplicateError);

    await expect(
      validator.addSchema(
        {},
        'schema://living-narrative-engine/empty.schema.json'
      )
    ).rejects.toThrow(/Invalid or empty schemaData provided for ID/);

    await expect(
      validator.addSchema(
        {
          $id: 'schema://living-narrative-engine/blank-id.schema.json',
          type: 'object',
        },
        '   '
      )
    ).rejects.toThrow(/Invalid or empty schemaId provided/);

    expect(
      logger.warnMessages.some((args) =>
        String(args[0]).includes('invalid entry')
      )
    ).toBe(true);
    expect(
      logger.debugMessages.some((args) =>
        String(args[0]).includes('Successfully added')
      )
    ).toBe(true);
  });

  it('reports unresolved references and handles batch loading edge cases', async () => {
    const logger = new RecordingLogger();
    const validator = new AjvSchemaValidator({ logger });

    const baseSchema = {
      $id: 'schema://living-narrative-engine/common/base.schema.json',
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    };

    await validator.addSchema(baseSchema, baseSchema.$id);

    await expect(validator.addSchemas([])).rejects.toThrow(
      'addSchemas called with empty or non-array input.'
    );

    const unresolvedSchema = {
      $id: 'schema://living-narrative-engine/operations/unresolved.schema.json',
      allOf: [{ $ref: '../missing/missing.schema.json' }],
    };

    await validator.addSchema(unresolvedSchema, unresolvedSchema.$id);
    expect(validator.validateSchemaRefs(unresolvedSchema.$id)).toBe(false);

    const missingResult = validator.validate(
      'schema://living-narrative-engine/does-not-exist.schema.json',
      { id: 'x' }
    );
    expect(missingResult.isValid).toBe(false);
    expect(missingResult.errors?.[0]?.keyword).toBe('schemaNotFound');

    expect(validator.getValidator('')).toBeUndefined();
    expect(
      validator.getValidator(
        'schema://living-narrative-engine/unknown.schema.json'
      )
    ).toBeUndefined();

    await expect(
      validator.addSchemas([{ $id: baseSchema.$id, type: 'object' }])
    ).resolves.toBeUndefined();

    // The validateSchemaRefs() call logs an ERROR (not warning) about unresolved $refs
    // The async schema loader's warning "Could not resolve schema reference" is only
    // triggered during compileAsync(), which is not used in this test flow.
    expect(
      logger.errorMessages.some((args) =>
        String(args[0]).includes('has unresolved $refs or other issues')
      )
    ).toBe(true);

    // The validate() call for a non-existent schema logs this warning
    expect(
      logger.warnMessages.some((args) =>
        String(args[0]).includes('validate called for schemaId')
      )
    ).toBe(true);
  });
});
