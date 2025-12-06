/**
 * @file Entity Manager Test Factory
 * @description Factory for creating test entity managers with correct API
 */

import TestEntityManagerAdapter from './TestEntityManagerAdapter.js';
import SimpleEntityManager from './simpleEntityManager.js';

/**
 * Create entity manager for tests.
 *
 * @param {object} config - Configuration
 * @param {object} config.logger - Logger instance
 * @param {boolean} config.useAdapter - Use adapter (recommended)
 * @param {Array<object>} config.initialEntities - Initial entities
 * @returns {TestEntityManagerAdapter|SimpleEntityManager} Entity manager
 */
export function createTestEntityManager(config) {
  const { logger, useAdapter = true, initialEntities = [] } = config;

  if (useAdapter) {
    const adapter = new TestEntityManagerAdapter({ logger, initialEntities });
    return adapter;
  } else {
    // Legacy mode - direct SimpleEntityManager
    if (logger && logger.warn) {
      logger.warn('Using SimpleEntityManager directly is deprecated', {
        hint: 'Set useAdapter: true to use TestEntityManagerAdapter for production API compatibility',
      });
    }

    // SimpleEntityManager constructor takes array of entities directly
    const manager = new SimpleEntityManager(initialEntities);
    return manager;
  }
}

/**
 * Create entity manager adapter (recommended).
 *
 * @param {object} config - Configuration
 * @param {object} config.logger - Logger instance
 * @param {Array<object>} config.initialEntities - Initial entities
 * @returns {TestEntityManagerAdapter} Adapter with production API
 */
export function createEntityManagerAdapter(config) {
  return createTestEntityManager({ ...config, useAdapter: true });
}

/**
 * Create simple entity manager (legacy).
 *
 * @deprecated Use createEntityManagerAdapter instead
 * @param {object} config - Configuration
 * @returns {SimpleEntityManager} Simple manager
 */
export function createSimpleEntityManager(config) {
  config.logger.warn('createSimpleEntityManager is deprecated', {
    hint: 'Use createEntityManagerAdapter for production API compatibility',
  });
  return createTestEntityManager({ ...config, useAdapter: false });
}
