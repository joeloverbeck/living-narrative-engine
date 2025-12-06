import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

let processAndStoreItem;
let parseAndValidateIdSpy;

describe('processAndStoreItem helper', () => {
  beforeEach(async () => {
    jest.resetModules();
    const idUtilsModule = await import('../../../src/utils/idUtils.js');
    parseAndValidateIdSpy = jest.spyOn(idUtilsModule, 'parseAndValidateId');
    ({ processAndStoreItem } = await import(
      '../../../src/loaders/helpers/processAndStoreItem.js'
    ));
  });

  afterEach(() => {
    parseAndValidateIdSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('parses ids with provided options and stores the item result', async () => {
    const storeSpy = jest.fn().mockReturnValue({
      qualifiedId: 'mod:test-item',
      didOverride: false,
    });

    const loader = {
      _logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
      _registerItemSchema: jest.fn(),
      _storeItemInRegistry: storeSpy,
    };

    const data = { id: 'test-item' };

    parseAndValidateIdSpy.mockReturnValue({
      fullId: 'mod:test-item',
      baseId: 'test-item',
    });

    const result = await processAndStoreItem(loader, {
      data,
      idProp: 'id',
      category: 'weapons',
      modId: 'mod',
      filename: 'items.json',
      parseOptions: { allowOverrides: true },
    });

    expect(parseAndValidateIdSpy).toHaveBeenCalledWith(
      data,
      'id',
      'mod',
      'items.json',
      loader._logger,
      { allowOverrides: true }
    );
    expect(storeSpy).toHaveBeenCalledWith(
      'weapons',
      'mod',
      'test-item',
      data,
      'items.json'
    );
    expect(result).toEqual({
      qualifiedId: 'mod:test-item',
      didOverride: false,
      fullId: 'mod:test-item',
      baseId: 'test-item',
    });
  });

  it('uses EntityDefinition ids directly without calling the parser', async () => {
    const storeSpy = jest.fn().mockReturnValue({
      qualifiedId: 'core:anatomy:arm',
      didOverride: true,
    });

    const loader = {
      _logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
      _registerItemSchema: jest.fn(),
      _storeItemInRegistry: storeSpy,
    };

    const entityDefinition = {
      id: 'core:anatomy:arm',
      constructor: { name: 'EntityDefinition' },
    };

    const result = await processAndStoreItem(loader, {
      data: entityDefinition,
      idProp: 'id',
      category: 'entities',
      modId: 'core',
      filename: 'entity.json',
    });

    expect(parseAndValidateIdSpy).not.toHaveBeenCalled();
    expect(storeSpy).toHaveBeenCalledWith(
      'entities',
      'core',
      'anatomy:arm',
      entityDefinition,
      'entity.json'
    );
    expect(result).toEqual({
      qualifiedId: 'core:anatomy:arm',
      didOverride: true,
      fullId: 'core:anatomy:arm',
      baseId: 'anatomy:arm',
    });
  });

  it('retains the full id as base id when an EntityDefinition lacks namespace', async () => {
    const storeSpy = jest.fn().mockReturnValue({
      qualifiedId: 'standalone',
      didOverride: false,
    });

    const loader = {
      _logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
      _registerItemSchema: jest.fn(),
      _storeItemInRegistry: storeSpy,
    };

    const entityDefinition = {
      id: 'standalone',
      constructor: { name: 'EntityDefinition' },
    };

    const result = await processAndStoreItem(loader, {
      data: entityDefinition,
      idProp: 'id',
      category: 'entities',
      modId: 'core',
      filename: 'entity.json',
    });

    expect(parseAndValidateIdSpy).not.toHaveBeenCalled();
    expect(result.baseId).toBe('standalone');
    expect(result.fullId).toBe('standalone');
  });

  it('registers inline schemas when schema data is provided', async () => {
    const registerSpy = jest.fn().mockResolvedValue();
    const storeSpy = jest.fn().mockReturnValue({
      qualifiedId: 'mod:with-schema',
      didOverride: false,
    });

    const loader = {
      _logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
      _registerItemSchema: registerSpy,
      _storeItemInRegistry: storeSpy,
    };

    const schemaMessages = jest.fn().mockReturnValue({
      success: 'registered schema for mod:with-schema',
    });

    const data = {
      id: 'with-schema',
      inlineSchema: { type: 'object' },
    };

    parseAndValidateIdSpy.mockReturnValue({
      fullId: 'mod:with-schema',
      baseId: 'with-schema',
    });

    const result = await processAndStoreItem(loader, {
      data,
      idProp: 'id',
      category: 'items',
      modId: 'mod',
      filename: 'items.json',
      schemaProp: 'inlineSchema',
      schemaSuffix: '#defs',
      schemaMessages,
    });

    expect(schemaMessages).toHaveBeenCalledWith('mod:with-schema');
    expect(registerSpy).toHaveBeenCalledWith(
      data,
      'inlineSchema',
      'mod:with-schema#defs',
      { success: 'registered schema for mod:with-schema' }
    );
    expect(storeSpy).toHaveBeenCalledWith(
      'items',
      'mod',
      'with-schema',
      data,
      'items.json'
    );
    expect(result.fullId).toBe('mod:with-schema');
  });

  it('supports literal schema message objects without invoking helpers', async () => {
    const registerSpy = jest.fn().mockResolvedValue();
    const storeSpy = jest.fn().mockReturnValue({
      qualifiedId: 'mod:literal',
      didOverride: false,
    });

    const loader = {
      _logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
      _registerItemSchema: registerSpy,
      _storeItemInRegistry: storeSpy,
    };

    const data = { id: 'literal', inlineSchema: { type: 'object' } };
    const literalMessages = { success: 'literal path' };

    parseAndValidateIdSpy.mockReturnValue({
      fullId: 'mod:literal',
      baseId: 'literal',
    });

    await processAndStoreItem(loader, {
      data,
      idProp: 'id',
      category: 'items',
      modId: 'mod',
      filename: 'items.json',
      schemaProp: 'inlineSchema',
      schemaMessages: literalMessages,
    });

    expect(registerSpy).toHaveBeenCalledWith(
      data,
      'inlineSchema',
      'mod:literal',
      literalMessages
    );
  });

  it('skips schema registration when schema data is missing or empty', async () => {
    const registerSpy = jest.fn();
    const storeSpy = jest.fn().mockReturnValue({
      qualifiedId: 'mod:plain',
      didOverride: false,
    });

    const loader = {
      _logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
      _registerItemSchema: registerSpy,
      _storeItemInRegistry: storeSpy,
    };

    const data = {
      id: 'plain',
      inlineSchema: {},
    };

    parseAndValidateIdSpy.mockReturnValue({
      fullId: 'mod:plain',
      baseId: 'plain',
    });

    await processAndStoreItem(loader, {
      data,
      idProp: 'id',
      category: 'items',
      modId: 'mod',
      filename: 'items.json',
      schemaProp: 'inlineSchema',
    });

    expect(registerSpy).not.toHaveBeenCalled();
    expect(storeSpy).toHaveBeenCalledWith(
      'items',
      'mod',
      'plain',
      data,
      'items.json'
    );
  });
});
