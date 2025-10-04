import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
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
      'schema://living-narrative-engine/relative.json': { schema: { type: 'string' } },
      'schema://custom/prefix/types/common.json': { schema: { type: 'number' } },
      'schema://absolute/known.json': { schema: { type: 'boolean' } },
    };
    mockAjvInstance.getSchema.mockImplementation((id) => schemasById[id]);

    mockAjvInstance.schemas = {
      'schema://custom/prefix/types/common.json': { schema: { type: 'number' } },
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
      expect.stringContaining("Could not resolve schema reference './missing.json'")
    );

    const absoluteResult = await capturedLoader('schema://absolute/known.json');
    expect(absoluteResult).toEqual({ type: 'boolean' });

    await expect(
      capturedLoader('schema://absolute/missing.json')
    ).rejects.toThrow('Cannot resolve schema reference: schema://absolute/missing.json');
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
});
