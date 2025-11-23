import { describe, it, expect } from '@jest/globals';
import {
  formatAnyOfErrors,
  formatAjvErrorsEnhanced,
} from '../../../src/utils/ajvAnyOfErrorFormatter.js';

/**
 * Creates a shallow AJV error object with sensible defaults so tests can
 * override only the pieces they care about.
 *
 * @param {Partial<import('ajv').ErrorObject>} overrides
 * @returns {import('ajv').ErrorObject}
 */
const createError = (overrides = {}) => ({
  keyword: 'anyOf',
  schemaPath: '#/anyOf/0',
  params: {},
  instancePath: '',
  data: undefined,
  ...overrides,
});

describe('formatAjvErrorsEnhanced', () => {
  it('returns a friendly message when no validation errors are provided', () => {
    expect(formatAjvErrorsEnhanced(null)).toBe('No validation errors');
    expect(formatAjvErrorsEnhanced([], {})).toBe('No validation errors');
  });

  it('detects massive anyOf failures caused by a missing type field', () => {
    const errors = Array.from({ length: 101 }, () =>
      createError({
        keyword: 'const',
        schemaPath: '#/anyOf/0/properties/type/const',
        params: { allowedValue: 'MOVE' },
      })
    );

    const message = formatAjvErrorsEnhanced(errors, {});

    // Pattern detection now provides more detailed message
    expect(message).toContain('Missing operation type');
    expect(message).toContain('this operation needs a "type" field');
  });

  it('flags non-string type fields in large anyOf error collections', () => {
    const errors = Array.from({ length: 120 }, () =>
      createError({
        keyword: 'const',
        schemaPath: '#/anyOf/0/properties/type/const',
        params: { allowedValue: 'MOVE' },
      })
    );

    const message = formatAjvErrorsEnhanced(errors, { type: 42 });

    expect(message).toContain('Invalid "type" field value');
    expect(message).toContain('must be a string');
  });

  it('falls back to standard formatting for non-anyOf validation errors', () => {
    const errors = [
      createError({
        keyword: 'required',
        schemaPath: '#/properties/parameters',
        instancePath: '/parameters',
        params: { missingProperty: 'name' },
      }),
      createError({
        keyword: 'additionalProperties',
        schemaPath: '#/properties/parameters/additionalProperties',
        instancePath: '/parameters',
        params: { additionalProperty: 'extra' },
      }),
      createError({
        keyword: 'type',
        schemaPath: '#/properties/parameters/name/type',
        instancePath: '/parameters/name',
        params: { type: 'string' },
        data: 123,
      }),
      createError({
        keyword: 'const',
        schemaPath: '#/properties/type/const',
        instancePath: '/type',
        params: { allowedValue: 'KNOWN' },
        data: 'WRONG',
      }),
      createError({
        keyword: 'enum',
        schemaPath: '#/properties/parameters/perception_type/enum',
        instancePath: '/parameters/perception_type',
        params: { allowedValues: ['A', 'B'] },
        data: 'C',
      }),
      createError({
        keyword: 'minLength',
        schemaPath: '#/properties/parameters/name/minLength',
        instancePath: '/parameters/name',
        message: 'Too short',
      }),
    ];

    const message = formatAjvErrorsEnhanced(errors, {});

    // Pattern detection now catches the enum error first
    expect(message).toContain("Invalid enum value 'C'. Allowed values: [A, B]");
    expect(message).toContain('FIX:'); // Enhanced enum error formatting
  });

  it('delegates to the anyOf formatter when many errors appear even without explicit anyOf schema paths', () => {
    const errors = Array.from({ length: 51 }, (_, index) =>
      createError({
        keyword: 'required',
        schemaPath: `#/properties/field_${index}`,
        instancePath: `/field_${index}`,
        params: { missingProperty: `prop_${index}` },
      })
    );

    const message = formatAjvErrorsEnhanced(errors, { type: 'MOVE' });

    expect(message).toContain('Validation errors:');
    expect(message).toContain("Missing required property 'prop_0'");
  });

  it('produces parameter guidance without the entity_ref hint when no entity_id property exists', () => {
    const paramErrors = [
      createError({
        keyword: 'const',
        schemaPath: '#/anyOf/0/properties/type/const',
        params: { allowedValue: 'SCAN' },
      }),
      ...Array.from({ length: 101 }, (_, index) =>
        createError({
          keyword: 'required',
          schemaPath: '#/anyOf/0/properties/parameters/required',
          instancePath: '/parameters',
          params: { missingProperty: `field_${index}` },
        })
      ),
    ];

    const message = formatAjvErrorsEnhanced(paramErrors, { type: 'SCAN' });

    expect(message).toContain("Operation type 'SCAN' has invalid parameters:");
    expect(message).not.toContain('entity_ref');
  });

  it('recognizes raw anyOf keyword errors as operation validation cues', () => {
    const message = formatAjvErrorsEnhanced(
      [
        createError({ keyword: 'anyOf', schemaPath: '#/anyOf' }),
        createError({
          keyword: 'required',
          schemaPath: '#/anyOf/0/properties/parameters/required',
          instancePath: '/parameters',
          params: { missingProperty: 'name' },
        }),
      ],
      {}
    );

    expect(message).toContain('Missing operation type - this operation needs a "type" field.');
  });
});

describe('formatStandardErrors integration', () => {
  it('formats enum errors with helpful defaults and special perception_type guidance', () => {
    const message = formatAnyOfErrors(
      [
        createError({
          keyword: 'enum',
          schemaPath: '#/properties/perception_type/enum',
          instancePath: '/perception_type',
          data: 'X',
          params: { allowedValues: ['A', 'B'] },
        }),
      ],
      {}
    );

    expect(message).toContain('Validation errors:');
    expect(message).toContain("Invalid enum value 'X'. Allowed values: [A, B]");
    expect(message).toContain('perception_type');
  });

  it('falls back to generic enum messaging when location metadata is missing', () => {
    const message = formatAnyOfErrors(
      [
        createError({
          keyword: 'enum',
          schemaPath: '#/properties/mode/enum',
          data: 'legacy',
          params: {},
        }),
        createError({ keyword: 'custom' }),
      ],
      {}
    );

    expect(message).toContain("Invalid enum value 'legacy'. Allowed values: []");
    expect(message).toContain("  - root: Validation failed");
  });
});

describe('formatAnyOfErrors', () => {
  it('returns a helpful message when invoked with no errors', () => {
    expect(formatAnyOfErrors(null, {})).toBe('No validation errors');
    expect(formatAnyOfErrors([], { type: 'MOVE' })).toBe('No validation errors');
  });

  it('falls back to standard formatting when the schema is not anyOf based', () => {
    const errors = [
      createError({
        keyword: 'required',
        schemaPath: '#/properties/name',
        instancePath: '/name',
        params: { missingProperty: 'name' },
      }),
    ];

    const message = formatAnyOfErrors(errors, {});

    expect(message).toContain('Validation errors:');
    expect(message).toContain("Missing required property 'name'");
  });

  it('summarizes parameter-heavy failures and highlights common entity_ref guidance', () => {
    const typeError = createError({
      keyword: 'const',
      schemaPath: '#/anyOf/0/properties/type/const',
      params: { allowedValue: 'GET_NAME' },
    });
    const additionalPropertyError = createError({
      keyword: 'additionalProperties',
      schemaPath: '#/anyOf/0/properties/parameters/additionalProperties',
      instancePath: '/parameters',
      params: { additionalProperty: 'entity_id' },
    });
    const requiredError = createError({
      keyword: 'required',
      schemaPath: '#/anyOf/0/properties/parameters/required',
      instancePath: '/parameters',
      params: { missingProperty: 'target' },
    });
    const fillerErrors = Array.from({ length: 98 }, (_, index) =>
      createError({
        keyword: 'required',
        schemaPath: '#/anyOf/0/properties/parameters/required',
        instancePath: '/parameters',
        params: { missingProperty: `field_${index}` },
      })
    );

    const errors = [typeError, additionalPropertyError, requiredError, ...fillerErrors];
    const message = formatAnyOfErrors(errors, { type: 'GET_NAME' });

    expect(message).toContain("Operation type 'GET_NAME' has invalid parameters:");
    expect(message).toContain("Unexpected property 'entity_id'");
    expect(message).toContain("Missing required property 'target'");
    expect(message).toContain('Common issue detected: "entity_id" should be "entity_ref"');
  });

  it('lists parameter errors for the intended operation branch when it exists', () => {
    const errors = [
      createError({
        keyword: 'const',
        schemaPath: '#/anyOf/2/properties/type/const',
        params: { allowedValue: 'FETCH' },
      }),
      createError({
        keyword: 'required',
        schemaPath: '#/anyOf/2/properties/parameters/required',
        instancePath: '/parameters',
        params: { missingProperty: 'resource' },
      }),
    ];

    const message = formatAnyOfErrors(errors, { type: 'FETCH' });

    expect(message).toContain("Operation type 'FETCH' validation failed:");
    expect(message).toContain("Missing required property 'resource'");
    expect(message).not.toContain("Must be equal to 'FETCH'");
  });

  it('falls back to branch inspection when grouped errors lack the intended type', () => {
    const errors = [
      createError({
        keyword: 'const',
        schemaPath: '#/anyOf/0/properties/type/const',
        params: { allowedValue: 'CREATE' },
      }),
      createError({
        keyword: 'required',
        schemaPath: '#/anyOf/1/properties/parameters/required',
        instancePath: '/parameters',
        params: { missingProperty: 'target' },
      }),
    ];

    const message = formatAnyOfErrors(errors, { type: 'UPDATE' });

    expect(message).toContain("Operation type 'UPDATE' validation failed:");
    expect(message).toContain("Missing required property 'target'");
  });

  it('summarizes unknown operation types when nothing matches the provided type', () => {
    const errors = [
      createError({
        keyword: 'const',
        schemaPath: '#/anyOf/0/properties/type/const',
        params: { allowedValue: 'CREATE' },
      }),
      createError({
        keyword: 'const',
        schemaPath: '#/anyOf/1/properties/type/const',
        params: { allowedValue: 'DELETE' },
      }),
    ];

    const message = formatAnyOfErrors(errors, { type: 'UNKNOWN' });

    expect(message).toContain("Unknown or invalid operation type: 'UNKNOWN'");
    expect(message).toContain('  - CREATE');
    expect(message).toContain('  - DELETE');
  });

  it('offers guidance for macro references when type information is absent', () => {
    const errors = [
      createError({
        keyword: 'const',
        schemaPath: '#/anyOf/0/properties/type/const',
        params: { allowedValue: 'MOVE' },
      }),
    ];

    const message = formatAnyOfErrors(errors, { macro: 'core:action' });

    expect(message).toContain('Invalid macro reference format detected.');
    expect(message).toContain('Do NOT include a "type" field with macro references.');
  });

  it('provides actionable guidance when the type field is missing entirely', () => {
    const errors = [
      createError({
        keyword: 'const',
        schemaPath: '#/anyOf/0/properties/type/const',
        params: { allowedValue: 'MOVE' },
      }),
    ];

    const message = formatAnyOfErrors(errors, {});

    expect(message).toContain('Missing operation type - this operation needs a "type" field.');
    expect(message).toContain('  - MOVE');
  });

  it('infers the intended operation when the payload lacks a type but one branch has fewer issues', () => {
    const fetchTypeMarker = createError({
      keyword: 'pattern',
      schemaPath: '#/anyOf/0/properties/type/const',
      params: { allowedValue: 'FETCH' },
    });
    const fetchMissingParam = createError({
      keyword: 'required',
      schemaPath: '#/anyOf/0/properties/parameters/required',
      instancePath: '/parameters',
      params: { missingProperty: 'resource' },
    });
    const inspectTypeMarker = createError({
      keyword: 'pattern',
      schemaPath: '#/anyOf/2/properties/type/const',
      params: { allowedValue: 'INSPECT' },
    });
    const fetchMissingRoot = createError({
      keyword: 'required',
      schemaPath: '#/anyOf/0/properties/parameters/required',
      params: { missingProperty: 'subject' },
    });
    const inspectExtraProperty = createError({
      keyword: 'additionalProperties',
      schemaPath: '#/anyOf/2/properties/parameters/additionalProperties',
      instancePath: '/parameters',
      params: { additionalProperty: 'bonus' },
    });
    const inspectMissingSubject = createError({
      keyword: 'required',
      schemaPath: '#/anyOf/2/properties/parameters/required',
      params: { missingProperty: 'subject' },
    });
    const createTypeMismatch = createError({
      keyword: 'const',
      schemaPath: '#/anyOf/1/properties/type/const',
      params: { allowedValue: 'CREATE' },
    });

    const message = formatAnyOfErrors(
      [
        fetchTypeMarker,
        fetchMissingParam,
        fetchMissingRoot,
        inspectTypeMarker,
        inspectExtraProperty,
        inspectMissingSubject,
        createTypeMismatch,
      ],
      {}
    );

    expect(message).toContain("Operation type 'FETCH' validation failed:");
    expect(message).toContain("  - /parameters: Missing required property 'resource'");
    expect(message).toContain("  - root: Missing required property 'subject'");
    expect(message).not.toContain('CREATE');
  });

  it('lists additional suggestions when many operation types are available but the type is unknown', () => {
    const errors = Array.from({ length: 16 }, (_, index) =>
      createError({
        keyword: 'const',
        schemaPath: `#/anyOf/${index}/properties/type/const`,
        params: { allowedValue: `OP_${index}` },
      })
    );

    const message = formatAnyOfErrors(errors, { type: 'UNMAPPED' });

    expect(message).toContain("Unknown or invalid operation type: 'UNMAPPED'");
    expect(message).toContain('  - OP_0');
    expect(message).toContain('  ... and 1 more');
  });

  it('describes missing type guidance and truncates long operation lists when no type is present', () => {
    const errors = Array.from({ length: 13 }, (_, index) =>
      createError({
        keyword: 'const',
        schemaPath: `#/anyOf/${index}/properties/type/const`,
        params: { allowedValue: `ACTION_${index}` },
      })
    );

    const message = formatAnyOfErrors(errors, {});

    expect(message).toContain('Missing operation type - this operation needs a "type" field.');
    expect(message).toContain('Common operation types:');
    expect(message).toContain('  - ACTION_0');
    expect(message).toContain('  ... and 1 more');
  });
});
