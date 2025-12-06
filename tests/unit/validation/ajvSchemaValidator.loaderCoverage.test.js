import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { createMockLogger } from '../../common/mockFactories/index.js';

const resetModuleState = () => {
  jest.resetModules();
  jest.dontMock('ajv');
  jest.dontMock('ajv-formats');
};

describe('AjvSchemaValidator targeted loader coverage', () => {
  beforeEach(() => {
    resetModuleState();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetModuleState();
  });

  it('resolves relative and absolute schema references via the custom loader', async () => {
    const logger = createMockLogger();
    const mockAjvInstance = {
      addSchema: jest.fn(),
      getSchema: jest.fn(),
      removeSchema: jest.fn(),
      schemas: {},
    };
    let capturedLoader;

    jest.doMock('ajv', () => {
      return jest.fn((options = {}) => {
        capturedLoader = options.loadSchema;
        return mockAjvInstance;
      });
    });
    jest.doMock('ajv-formats', () => jest.fn());

    const { default: AjvSchemaValidator } = await import(
      '../../../src/validation/ajvSchemaValidator.js'
    );

    const validator = new AjvSchemaValidator({ logger });
    expect(typeof capturedLoader).toBe('function');

    const schemasById = {
      'schema://living-narrative-engine/relative.json': {
        schema: { type: 'string' },
      },
      'schema://custom/prefix/types/common.json': {
        schema: { type: 'number' },
      },
      'schema://absolute/known.json': { schema: { type: 'boolean' } },
    };
    mockAjvInstance.getSchema.mockImplementation((id) => schemasById[id]);

    mockAjvInstance.schemas = {
      'schema://custom/prefix/types/common.json': {
        schema: { type: 'number' },
      },
    };

    const directResult = await capturedLoader('./relative.json');
    expect(directResult).toEqual({ type: 'string' });
    expect(mockAjvInstance.getSchema).toHaveBeenCalledWith(
      'schema://living-narrative-engine/relative.json'
    );

    const originalGetLoadedIds = validator.getLoadedSchemaIds.bind(validator);
    const loaderSpy = jest
      .spyOn(validator, 'getLoadedSchemaIds')
      .mockImplementationOnce(originalGetLoadedIds);
    const fallbackResult = await capturedLoader('../types/common.json');
    expect(fallbackResult).toEqual({ type: 'number' });
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        "Found schema 'schema://custom/prefix/types/common.json' matching relative path"
      )
    );
    loaderSpy.mockRestore();

    await expect(capturedLoader('./missing.json')).rejects.toThrow(
      'Cannot resolve schema reference: ./missing.json'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Could not resolve schema reference './missing.json'"
      )
    );

    const absoluteResult = await capturedLoader('schema://absolute/known.json');
    expect(absoluteResult).toEqual({ type: 'boolean' });

    await expect(
      capturedLoader('schema://absolute/missing.json')
    ).rejects.toThrow(
      'Cannot resolve schema reference: schema://absolute/missing.json'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Could not resolve schema reference 'schema://absolute/missing.json'"
      )
    );

    expect(validator.getLoadedSchemaIds()).toEqual([
      'schema://custom/prefix/types/common.json',
    ]);

    Object.defineProperty(mockAjvInstance, 'schemas', {
      get() {
        throw new Error('schema map unavailable');
      },
    });
    expect(validator.getLoadedSchemaIds()).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      'AjvSchemaValidator: Error getting loaded schema IDs',
      { error: expect.any(Error) }
    );
  });

  it('resolves JSON pointer fragments and logs Ajv lookup failures in the loader', async () => {
    const logger = createMockLogger();
    const mockAjvInstance = {
      addSchema: jest.fn(),
      getSchema: jest.fn(),
      removeSchema: jest.fn(),
      schemas: {},
    };
    let capturedLoader;

    jest.doMock('ajv', () => {
      return jest.fn((options = {}) => {
        capturedLoader = options.loadSchema;
        return mockAjvInstance;
      });
    });
    jest.doMock('ajv-formats', () => jest.fn());

    const { default: AjvSchemaValidator } = await import(
      '../../../src/validation/ajvSchemaValidator.js'
    );

    // Instantiate to capture the loader and preserve existing behaviour.

    new AjvSchemaValidator({ logger });

    expect(typeof capturedLoader).toBe('function');

    const complexSchema = {
      definitions: {
        'foo/bar~baz': { type: 'integer' },
        nested: {
          properties: {
            value: { const: 42 },
          },
        },
      },
      properties: {
        info: { type: 'object' },
      },
    };

    const schemaEnvs = {
      'schema://living-narrative-engine/schemas/complex.json': {
        schema: complexSchema,
      },
    };

    mockAjvInstance.schemas = {
      'schema://living-narrative-engine/schemas/complex.json':
        schemaEnvs['schema://living-narrative-engine/schemas/complex.json'],
    };

    mockAjvInstance.getSchema.mockImplementation((id) => {
      if (id.includes('#/definitions')) {
        throw new Error('fragment candidate lookup failed');
      }
      return schemaEnvs[id] || null;
    });

    const decodedFragment = await capturedLoader(
      '../../schemas/complex.json#/definitions/foo~1bar~0baz'
    );
    expect(decodedFragment).toEqual({ type: 'integer' });
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        "AjvSchemaValidator: Error resolving schema 'schema://living-narrative-engine/schemas/complex.json#/definitions/foo~1bar~0baz'"
      )
    );

    const nestedFragment = await capturedLoader(
      'schema://living-narrative-engine/schemas/complex.json#/definitions/nested/properties/value'
    );
    expect(nestedFragment).toEqual({ const: 42 });

    const fullSchema = await capturedLoader(
      'schema://living-narrative-engine/schemas/complex.json#'
    );
    expect(fullSchema).toBe(complexSchema);

    await expect(
      capturedLoader(
        'schema://living-narrative-engine/schemas/complex.json#/definitions/missing'
      )
    ).rejects.toThrow(
      'Cannot resolve schema reference: schema://living-narrative-engine/schemas/complex.json#/definitions/missing'
    );

    await expect(capturedLoader('#/unbound/path')).rejects.toThrow(
      'Cannot resolve schema reference: #/unbound/path'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "AjvSchemaValidator: Could not resolve schema reference '#/unbound/path'"
      )
    );
  });
});
