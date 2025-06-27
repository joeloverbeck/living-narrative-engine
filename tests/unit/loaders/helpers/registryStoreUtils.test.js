import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { storeItemInRegistry } from '../../../../src/loaders/helpers/registryStoreUtils.js';
import { DuplicateContentError } from '../../../../src/errors/duplicateContentError.js';

describe('storeItemInRegistry', () => {
  let logger;
  let registry;

  beforeEach(() => {
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    registry = {
      store: jest.fn().mockReturnValue(false),
      get: jest.fn().mockReturnValue(undefined),
    };
  });

  it('stores data and returns info when no override', () => {
    const data = { value: 'x' };
    const result = storeItemInRegistry(
      logger,
      registry,
      'TestLoader',
      'items',
      'modA',
      'item1',
      data,
      'item.json'
    );
    expect(registry.store).toHaveBeenCalledWith(
      'items',
      'modA:item1',
      expect.objectContaining({
        id: 'item1',
        _fullId: 'modA:item1',
        _modId: 'modA',
        _sourceFile: 'item.json',
      })
    );
    expect(result).toEqual({ qualifiedId: 'modA:item1', didOverride: false });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('throws DuplicateContentError when item already exists', () => {
    registry.get.mockReturnValue({ _modId: 'modB', value: 'existing' });

    expect(() =>
      storeItemInRegistry(
        logger,
        registry,
        'TestLoader',
        'items',
        'modA',
        'item1',
        {},
        'file.json'
      )
    ).toThrow(DuplicateContentError);

    expect(registry.store).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('throws TypeError when category invalid', () => {
    expect(() =>
      storeItemInRegistry(
        logger,
        registry,
        'TestLoader',
        '',
        'modA',
        'id',
        {},
        'file.json'
      )
    ).toThrow(TypeError);
    expect(registry.store).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
