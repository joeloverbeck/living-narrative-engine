import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import loadAndInitScopes from '../../../../src/initializers/services/scopeRegistryUtils.js';
import { SCOPES_KEY } from '../../../../src/constants/dataRegistryKeys.js';

describe('loadAndInitScopes', () => {
  let scopeRegistry;
  let logger;

  beforeEach(() => {
    scopeRegistry = { initialize: jest.fn() };
    logger = { debug: jest.fn(), error: jest.fn() };
  });

  it('initializes the registry using scope arrays returned from the data source', async () => {
    const dataSource = jest
      .fn()
      .mockResolvedValue([
        { id: 'scope-1', name: 'Scope One' },
        null,
        { id: 'scope-2', name: 'Scope Two' },
        { name: 'missing-id' },
      ]);

    await loadAndInitScopes({ dataSource, scopeRegistry, logger });

    expect(dataSource).toHaveBeenCalledWith(SCOPES_KEY);
    expect(scopeRegistry.initialize).toHaveBeenCalledWith({
      'scope-1': { id: 'scope-1', name: 'Scope One' },
      'scope-2': { id: 'scope-2', name: 'Scope Two' },
    });
    expect(logger.debug).toHaveBeenNthCalledWith(
      1,
      'Initializing ScopeRegistry...'
    );
    expect(logger.debug).toHaveBeenNthCalledWith(
      2,
      'ScopeRegistry initialized with 2 scopes.'
    );
  });

  it('passes through objects returned by the data source', async () => {
    const scopes = {
      alpha: { id: 'alpha' },
      beta: { id: 'beta' },
    };
    const dataSource = jest.fn().mockReturnValue(scopes);

    await loadAndInitScopes({ dataSource, scopeRegistry, logger });

    expect(scopeRegistry.initialize).toHaveBeenCalledWith(scopes);
    expect(logger.debug).toHaveBeenNthCalledWith(
      2,
      'ScopeRegistry initialized with 2 scopes.'
    );
  });

  it('initializes with an empty map when no data source is provided', async () => {
    await loadAndInitScopes({ scopeRegistry, logger });

    expect(scopeRegistry.initialize).toHaveBeenCalledWith({});
    expect(logger.debug).toHaveBeenNthCalledWith(
      2,
      'ScopeRegistry initialized with 0 scopes.'
    );
  });

  it('logs an error when data source throws', async () => {
    const error = new Error('failure');
    const dataSource = jest.fn(() => {
      throw error;
    });

    await loadAndInitScopes({ dataSource, scopeRegistry, logger });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to initialize ScopeRegistry:',
      error
    );
    expect(scopeRegistry.initialize).not.toHaveBeenCalled();
  });

  it('handles missing logger gracefully', async () => {
    const dataSource = jest.fn().mockReturnValue([{ id: 'scope-1' }]);

    await expect(
      loadAndInitScopes({ dataSource, scopeRegistry })
    ).resolves.toBeUndefined();

    expect(scopeRegistry.initialize).toHaveBeenCalledWith({
      'scope-1': { id: 'scope-1' },
    });
  });
});
