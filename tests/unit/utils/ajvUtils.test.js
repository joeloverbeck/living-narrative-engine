import { describe, it, expect } from '@jest/globals';
import { formatAjvErrors } from '../../../src/utils/ajvUtils.js';

const createError = (overrides = {}) => ({
  instancePath: '/path',
  schemaPath: '#/properties/path',
  keyword: 'type',
  params: {},
  message: 'must satisfy schema',
  ...overrides,
});

describe('formatAjvErrors', () => {
  it('returns the placeholder message when no errors are provided', () => {
    expect(formatAjvErrors()).toBe('No specific error details provided.');
    expect(formatAjvErrors(null)).toBe('No specific error details provided.');
    expect(formatAjvErrors([])).toBe('No specific error details provided.');
  });

  it('stringifies smaller error collections verbatim', () => {
    const errors = [
      createError({
        instancePath: '/field',
        schemaPath: '#/properties/field/type',
        message: 'must be string',
      }),
    ];

    const result = formatAjvErrors(errors);

    expect(result).toBe(JSON.stringify(errors, null, 2));
  });

  it('focuses on relevant errors for large cascades when the operation type is nested in parameters', () => {
    const fillerErrors = Array.from({ length: 55 }, (_, index) =>
      createError({
        schemaPath: `#/anyOf/${index}/properties/irrelevant`,
        message: `irrelevant ${index}`,
      })
    );
    const targetedErrors = Array.from({ length: 5 }, (_, index) =>
      createError({
        schemaPath: `#/operations/operationAlpha/branch${index}`,
        message: `target ${index}`,
      })
    );
    const errors = [...fillerErrors, ...targetedErrors];

    const result = formatAjvErrors(errors, {
      parameters: { type: 'operationAlpha' },
    });

    expect(result).toBe(
      `Validation failed for operation type 'operationAlpha':\\n${JSON.stringify(targetedErrors, null, 2)}`
    );
  });

  it('summarizes invalid operation types when cascading errors reveal allowed values', () => {
    const errors = Array.from({ length: 60 }, (_, index) =>
      createError({
        schemaPath: `#/anyOf/${index}/properties/type/const`,
        keyword: 'const',
        params: { allowedValue: `operation${index}` },
        message: `must be operation${index}`,
      })
    );
    const data = { type: 'unknownOperation' };

    const result = formatAjvErrors(errors, data);
    const validTypes = errors.map((error) => error.params.allowedValue);

    expect(result).toBe(
      `Invalid operation type 'unknownOperation'. Valid types are: ${validTypes
        .slice(0, 10)
        .join(', ')}${validTypes.length > 10 ? '...' : ''}`
    );
  });

  it("provides a focused slice of errors when the declared type's schema branch fails", () => {
    const typeErrors = [
      createError({
        schemaPath: '#/anyOf/0/properties/type/const',
        keyword: 'const',
        params: { allowedValue: 'operationAlpha' },
        message: 'must equal operationAlpha',
      }),
      createError({
        schemaPath: '#/anyOf/1/properties/type/const',
        keyword: 'const',
        params: { allowedValue: 'operationBeta' },
        message: 'must equal operationBeta',
      }),
      createError({
        schemaPath: '#/anyOf/2/properties/type/const',
        keyword: 'const',
        params: { allowedValue: 'operationGamma' },
        message: 'must equal operationGamma',
      }),
    ];
    const fillerErrors = Array.from({ length: 57 }, (_, index) =>
      createError({
        schemaPath: `#/anyOf/${index + 3}/properties/extra`,
        message: `extra ${index}`,
      })
    );
    const errors = [...typeErrors, ...fillerErrors];
    const data = { type: 'operationBeta' };

    const result = formatAjvErrors(errors, data);
    const typeIndex = typeErrors.findIndex(
      (error) => error.params.allowedValue === data.type
    );
    const nextTypeIndex = typeErrors.findIndex((_, index) => index > typeIndex);
    const relevantSlice =
      nextTypeIndex > 0
        ? errors.slice(typeIndex, nextTypeIndex)
        : errors.slice(typeIndex, typeIndex + 20);

    expect(result).toBe(
      `Validation failed for 'operationBeta' operation:\\n${JSON.stringify(relevantSlice, null, 2)}`
    );
  });

  it('falls back to a helpful warning when no specific type hints are available', () => {
    const errors = Array.from({ length: 60 }, (_, index) =>
      createError({
        schemaPath: `#/anyOf/${index}/properties/subtree`,
        message: `cascade ${index}`,
      })
    );
    const data = { type: 'operationDelta' };

    const result = formatAjvErrors(errors, data);

    expect(result).toContain('Warning: 60 validation errors detected');
    expect(result).toContain('Showing first 10 errors');
    expect(result).toContain(
      'This usually indicates a structural issue with the operation.'
    );
  });
});
