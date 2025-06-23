import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { storeItemInRegistry } from '../../../../src/loaders/helpers/registryStoreUtils.js';

describe('storeItemInRegistry', () => {
  let logger;
  let registry;

  beforeEach(() => {
    logger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    registry = { store: jest.fn().mockReturnValue(false) };
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

  it('logs warning when override occurs', () => {
    registry.store.mockReturnValue(true);
    const result = storeItemInRegistry(
      logger,
      registry,
      'TestLoader',
      'items',
      'modA',
      'item1',
      {},
      'file.json'
    );
    expect(result.didOverride).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('returns error flag when category invalid', () => {
    const result = storeItemInRegistry(
      logger,
      registry,
      'TestLoader',
      '',
      'modA',
      'id',
      {},
      'file.json'
    );
    expect(result.error).toBe(true);
    expect(registry.store).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
