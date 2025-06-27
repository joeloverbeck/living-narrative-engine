// src/initializers/services/scopeRegistryUtils.js

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IScopeRegistry.js').IScopeRegistry} IScopeRegistry */

import { SCOPES_KEY } from '../../constants/dataRegistryKeys.js';

/**
 * @description Loads scope definitions using the provided data source and
 * initializes the given ScopeRegistry with them.
 *
 * The `dataSource` function should accept a single key parameter and return
 * either an object map of scopes or an array of scope objects. This allows the
 * utility to work with both `IGameDataRepository#get` and `IDataRegistry#getAll`.
 * @param {object} params - Dependency parameters.
 * @param {(key: string) => any} params.dataSource - Function to retrieve scope
 *   data. Can be `IGameDataRepository#get` or `IDataRegistry#getAll`.
 * @param {IScopeRegistry} params.scopeRegistry - Registry instance to
 *   initialize.
 * @param {ILogger} params.logger - Logger for debug and error output.
 * @returns {Promise<void>} Resolves when initialization completes.
 */
export async function loadAndInitScopes({ dataSource, scopeRegistry, logger }) {
  logger?.debug('Initializing ScopeRegistry...');
  try {
    const rawScopes =
      typeof dataSource === 'function' ? dataSource(SCOPES_KEY) : undefined;
    const scopes = await Promise.resolve(rawScopes);

    let scopeMap = {};
    if (Array.isArray(scopes)) {
      scopes.forEach((scope) => {
        if (scope && scope.id) {
          scopeMap[scope.id] = scope;
        }
      });
    } else if (scopes && typeof scopes === 'object') {
      scopeMap = scopes;
    }

    scopeRegistry.initialize(scopeMap);
    logger?.debug(
      `ScopeRegistry initialized with ${Object.keys(scopeMap).length} scopes.`
    );
  } catch (error) {
    logger?.error('Failed to initialize ScopeRegistry:', error);
  }
}

export default loadAndInitScopes;
