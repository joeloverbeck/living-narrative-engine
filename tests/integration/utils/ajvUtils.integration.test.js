import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { validateAgainstSchema } from '../../../src/utils/schemaValidationUtils.js';
import { formatAjvErrors } from '../../../src/utils/ajvUtils.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message, context) {
    this.debugMessages.push({ message, context });
  }

  info(message, context) {
    this.infoMessages.push({ message, context });
  }

  warn(message, context) {
    this.warnMessages.push({ message, context });
  }

  error(message, context) {
    this.errorMessages.push({ message, context });
  }
}

class TestSchemaValidator {
  constructor(schema) {
    this.schemaId = schema.$id;
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
    this.validator = this.ajv.compile(schema);
    this.nextResult = null;
    this.lastErrors = null;
  }

  setNextResult(result) {
    this.nextResult = result;
  }

  isSchemaLoaded(schemaId) {
    return schemaId === this.schemaId;
  }

  validate(schemaId, data) {
    if (schemaId !== this.schemaId) {
      throw new Error(`Unknown schema: ${schemaId}`);
    }

    if (this.nextResult) {
      const result = this.nextResult;
      this.nextResult = null;
      this.lastErrors = result.errors ?? null;
      return result;
    }

    const isValid = this.validator(data);
    const errors = this.validator.errors ?? null;
    this.lastErrors = errors;
    return { isValid, errors };
  }
}

const baseSchema = {
  $id: 'schema://ajv-utils-integration',
  type: 'object',
  properties: {
    mods: {
      type: 'array',
      items: { type: 'string' },
    },
    type: { type: 'string' },
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string' },
      },
      additionalProperties: true,
    },
  },
  required: ['mods'],
  additionalProperties: true,
};

const schemaId = baseSchema.$id;

const createError = (overrides = {}) => ({
  instancePath: overrides.instancePath ?? '/operation',
  schemaPath: overrides.schemaPath ?? '#/properties/operation/type',
  keyword: overrides.keyword ?? 'type',
  params: overrides.params ?? { type: 'string' },
  message: overrides.message ?? 'must be string',
});

describe('formatAjvErrors integration', () => {
  it('logs a placeholder when the validator supplies no detailed errors', () => {
    const validator = new TestSchemaValidator(baseSchema);
    const logger = new TestLogger();
    const data = { mods: [] };

    validator.setNextResult({ isValid: false, errors: null });

    expect(() =>
      validateAgainstSchema(validator, schemaId, data, logger, {
        skipPreValidation: true,
        appendErrorDetails: false,
        failureThrowMessage: 'Validation aborted',
        failureMessage: (errors) => formatAjvErrors(errors, data),
      })
    ).toThrow('Validation aborted');

    expect(logger.errorMessages).toHaveLength(1);
    expect(logger.errorMessages[0].message).toBe(
      'No specific error details provided.'
    );
  });

  it('prioritizes relevant errors for the detected operation type', () => {
    const validator = new TestSchemaValidator(baseSchema);
    const logger = new TestLogger();
    const data = {
      mods: [],
      parameters: { type: 'operationAlpha' },
    };

    const relevantErrors = [
      createError({
        schemaPath: '#/anyOf/operationAlpha/required',
        keyword: 'required',
        params: { missingProperty: 'parameters' },
        message: "must have required property 'parameters'",
      }),
      createError({
        schemaPath: '#/properties/parameters/properties/intensity/type',
        keyword: 'type',
        params: { type: 'integer' },
        message: 'must be integer',
      }),
    ];

    const noiseErrors = Array.from({ length: 58 }, (_, index) =>
      createError({
        schemaPath: `#/anyOf/otherOption${index}/type/const`,
        keyword: 'const',
        params: { allowedValue: `otherOption${index}` },
        message: 'should be equal to constant',
      })
    );

    const errors = [...noiseErrors, ...relevantErrors];

    validator.setNextResult({ isValid: false, errors });

    expect(() =>
      validateAgainstSchema(validator, schemaId, data, logger, {
        skipPreValidation: true,
        appendErrorDetails: false,
        failureThrowMessage: 'Validation aborted',
        failureMessage: (validationErrors) =>
          formatAjvErrors(validationErrors, data),
      })
    ).toThrow('Validation aborted');

    const expectedMessage =
      "Validation failed for operation type 'operationAlpha':\\n" +
      JSON.stringify(relevantErrors, null, 2);

    expect(logger.errorMessages).toHaveLength(1);
    expect(logger.errorMessages[0].message).toBe(expectedMessage);
  });

  it('highlights invalid operation types when they are not allowed by the schema', () => {
    const validator = new TestSchemaValidator(baseSchema);
    const logger = new TestLogger();
    const data = {
      mods: [],
      type: 'UNKNOWN_OPERATION',
    };

    const allowedValues = Array.from(
      { length: 12 },
      (_, index) => `TYPE_${index}`
    );
    const typeErrors = allowedValues.map((value, index) =>
      createError({
        schemaPath: `#/anyOf/${index}/type/const`,
        keyword: 'const',
        params: { allowedValue: value },
        message: 'should be equal to constant',
      })
    );

    const fillerErrors = Array.from({ length: 48 }, (_, index) =>
      createError({
        schemaPath: `#/anyOf/branch${index}/properties/value`,
        keyword: 'required',
        params: { missingProperty: 'value' },
        message: `must have required property 'value_${index}'`,
      })
    );

    const errors = [...typeErrors, ...fillerErrors];

    validator.setNextResult({ isValid: false, errors });

    expect(() =>
      validateAgainstSchema(validator, schemaId, data, logger, {
        skipPreValidation: true,
        appendErrorDetails: false,
        failureThrowMessage: 'Validation aborted',
        failureMessage: (validationErrors) =>
          formatAjvErrors(validationErrors, data),
      })
    ).toThrow('Validation aborted');

    const validTypesSummary = `${allowedValues.slice(0, 10).join(', ')}...`;
    const expectedMessage =
      "Invalid operation type 'UNKNOWN_OPERATION'. Valid types are: " +
      validTypesSummary;

    expect(logger.errorMessages).toHaveLength(1);
    expect(logger.errorMessages[0].message).toBe(expectedMessage);
  });

  it('provides a focused slice of errors when the operation type is valid but malformed', () => {
    const validator = new TestSchemaValidator(baseSchema);
    const logger = new TestLogger();
    const data = {
      mods: [],
      type: 'SCAN',
    };

    const typeErrors = [
      createError({
        schemaPath: '#/anyOf/0/type/const',
        keyword: 'const',
        params: { allowedValue: 'MOVE' },
        message: 'should be equal to constant',
      }),
      createError({
        schemaPath: '#/anyOf/1/type/const',
        keyword: 'const',
        params: { allowedValue: 'SCAN' },
        message: 'should be equal to constant',
      }),
      createError({
        schemaPath: '#/anyOf/2/type/const',
        keyword: 'const',
        params: { allowedValue: 'ATTACK' },
        message: 'should be equal to constant',
      }),
    ];

    const additionalErrors = Array.from({ length: 57 }, (_, index) =>
      createError({
        schemaPath: `#/anyOf/branch${index}/required`,
        keyword: 'required',
        params: { missingProperty: `field_${index}` },
        message: `must have required property 'field_${index}'`,
      })
    );

    const errors = [...typeErrors, ...additionalErrors];

    validator.setNextResult({ isValid: false, errors });

    expect(() =>
      validateAgainstSchema(validator, schemaId, data, logger, {
        skipPreValidation: true,
        appendErrorDetails: false,
        failureThrowMessage: 'Validation aborted',
        failureMessage: (validationErrors) =>
          formatAjvErrors(validationErrors, data),
      })
    ).toThrow('Validation aborted');

    const relevantSlice = errors.slice(1, 2);
    const expectedMessage =
      "Validation failed for 'SCAN' operation:\\n" +
      JSON.stringify(relevantSlice, null, 2);

    expect(logger.errorMessages).toHaveLength(1);
    expect(logger.errorMessages[0].message).toBe(expectedMessage);
  });

  it('summarizes cascading anyOf errors when no specific branch matches', () => {
    const validator = new TestSchemaValidator(baseSchema);
    const logger = new TestLogger();
    const data = { mods: [] };

    const errors = Array.from({ length: 60 }, (_, index) =>
      createError({
        schemaPath: `#/anyOf/branch${index}/required`,
        keyword: 'required',
        params: { missingProperty: `property_${index}` },
        message: `must have required property 'property_${index}'`,
      })
    );

    validator.setNextResult({ isValid: false, errors });

    expect(() =>
      validateAgainstSchema(validator, schemaId, data, logger, {
        skipPreValidation: true,
        appendErrorDetails: false,
        failureThrowMessage: 'Validation aborted',
        failureMessage: (validationErrors) =>
          formatAjvErrors(validationErrors, data),
      })
    ).toThrow('Validation aborted');

    const expectedMessage =
      `Warning: ${errors.length} validation errors detected (likely cascading from anyOf validation).\\n` +
      `Showing first 10 errors:\\n${JSON.stringify(errors.slice(0, 10), null, 2)}\\n\\n` +
      'This usually indicates a structural issue with the operation. Check that:\\n' +
      '1. The operation type is valid\\n' +
      '2. The parameters are at the correct nesting level\\n' +
      '3. Required fields are present for the operation type';

    expect(logger.errorMessages).toHaveLength(1);
    expect(logger.errorMessages[0].message).toBe(expectedMessage);
  });

  it('falls back to JSON formatting for smaller sets of validation errors', () => {
    const validator = new TestSchemaValidator(baseSchema);
    const logger = new TestLogger();
    const data = { mods: 'not-an-array' };

    expect(() =>
      validateAgainstSchema(validator, schemaId, data, logger, {
        skipPreValidation: true,
        appendErrorDetails: false,
        failureThrowMessage: 'Validation aborted',
        failureMessage: (validationErrors) =>
          formatAjvErrors(validationErrors, data),
      })
    ).toThrow('Validation aborted');

    expect(Array.isArray(validator.lastErrors)).toBe(true);
    const expectedMessage = JSON.stringify(validator.lastErrors, null, 2);

    expect(logger.errorMessages).toHaveLength(1);
    expect(logger.errorMessages[0].message).toBe(expectedMessage);
  });
});
