import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const loaderCapture = { current: null };

jest.mock('ajv', () => {
  const actual = jest.requireActual('ajv');
  const RealAjv = actual.default || actual;
  class CapturingAjv extends RealAjv {
    constructor(options = {}) {
      const capture = { before: options.loadSchema };
      super(options);
      capture.after = this.opts?.loadSchema;
      loaderCapture.current = capture;
    }
  }
  return {
    __esModule: true,
    default: CapturingAjv,
  };
});

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

describe('AjvSchemaValidator schema loader advanced integration', () => {
  let logger;

  beforeEach(() => {
    loaderCapture.current = null;
    logger = new RecordingLogger();
  });

  it('resolves encoded pointer fragments and fallback matches for relative references', async () => {
    const validator = new AjvSchemaValidator({ logger });
    expect(loaderCapture.current).toBeTruthy();

    const loader = loaderCapture.current.after || loaderCapture.current.before;
    expect(typeof loader).toBe('function');

    const encodedDefinitionsSchema = {
      $id: 'schema://living-narrative-engine/shared/encoded.schema.json',
      definitions: {
        'encoded~name': {
          type: 'string',
          minLength: 3,
        },
        'path/segment': {
          type: 'integer',
          minimum: 1,
        },
      },
    };

    const fallbackSchema = {
      $id: 'schema://living-narrative-engine/library/deeper/nested.schema.json',
      type: 'object',
      properties: {
        'allowed/items': {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1 },
          },
          required: ['limit'],
        },
      },
    };

    await validator.addSchema(
      encodedDefinitionsSchema,
      encodedDefinitionsSchema.$id
    );
    await validator.addSchema(fallbackSchema, fallbackSchema.$id);

    const fragmentResult = await loader(
      '../shared/encoded.schema.json#/definitions/encoded~0name'
    );
    expect(fragmentResult).toEqual({ type: 'string', minLength: 3 });

    const slashResult = await loader(
      '../shared/encoded.schema.json#/definitions/path~1segment'
    );
    expect(slashResult).toEqual({ type: 'integer', minimum: 1 });

    const fullSchema = await loader('../shared/encoded.schema.json');
    expect(fullSchema.definitions).toHaveProperty('encoded~name');

    const fallbackResult = await loader(
      '../../deeper/nested.schema.json#/properties/allowed~1items'
    );
    expect(fallbackResult).toEqual({
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1 } },
      required: ['limit'],
    });

    const absoluteResult = await loader(
      'schema://living-narrative-engine/library/deeper/nested.schema.json#/properties/allowed~1items'
    );
    expect(absoluteResult).toEqual(fallbackResult);

    const referencingSchema = {
      $id: 'schema://living-narrative-engine/components/example.schema.json',
      type: 'object',
      properties: {
        name: {
          $ref: '../shared/encoded.schema.json#/definitions/encoded~0name',
        },
        bundle: {
          $ref: '../../deeper/nested.schema.json#/properties/allowed~1items',
        },
      },
      required: ['name', 'bundle'],
    };

    await validator.addSchema(referencingSchema, referencingSchema.$id);

    const debugMessages = logger.debugMessages.map((args) => String(args[0]));
    expect(
      debugMessages.some((message) =>
        message.includes(
          'Attempting to load schema from URI: ../shared/encoded.schema.json'
        )
      )
    ).toBe(true);
    expect(
      debugMessages.some((message) =>
        message.includes(
          "Found schema 'schema://living-narrative-engine/library/deeper/nested.schema.json' matching relative path 'deeper/nested.schema.json#/properties/allowed~1items'"
        )
      )
    ).toBe(true);
  });

  it('warns and surfaces errors when a normalized fragment cannot be resolved', async () => {
    const validator = new AjvSchemaValidator({ logger });
    const loader = loaderCapture.current.after || loaderCapture.current.before;
    expect(typeof loader).toBe('function');

    const encodedDefinitionsSchema = {
      $id: 'schema://living-narrative-engine/shared/encoded.schema.json',
      definitions: {
        'encoded~name': { type: 'string', minLength: 3 },
      },
    };

    await validator.addSchema(
      encodedDefinitionsSchema,
      encodedDefinitionsSchema.$id
    );

    await expect(
      loader('../shared/encoded.schema.json#/definitions/does-not-exist')
    ).rejects.toThrow(
      'Cannot resolve schema reference: ../shared/encoded.schema.json#/definitions/does-not-exist'
    );

    await expect(loader('./#')).rejects.toThrow(
      'Cannot resolve schema reference: ./#'
    );

    const warnMessages = logger.warnMessages.map((args) => String(args[0]));
    expect(
      warnMessages.some((message) =>
        message.includes(
          "AjvSchemaValidator: Could not resolve schema reference '../shared/encoded.schema.json#/definitions/does-not-exist'"
        )
      )
    ).toBe(true);
    expect(
      warnMessages.some((message) =>
        message.includes(
          "AjvSchemaValidator: Could not resolve schema reference './#' (absolute: '(unresolved base path)')"
        )
      )
    ).toBe(true);
  });
});
