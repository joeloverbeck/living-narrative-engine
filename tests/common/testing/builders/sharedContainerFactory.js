/**
 * @file sharedContainerFactory.js
 * @description Factory for creating shareable test containers with state reset.
 * Enables significant performance improvements by reusing containers across tests
 * that share the same configuration requirements.
 */

import { createE2ETestEnvironment } from '../../../e2e/common/e2eTestContainer.js';

// ============================================================================
// Module-level container cache
// ============================================================================

/**
 * @typedef {object} CachedContainer
 * @property {object} env - The E2E test environment
 * @property {number} refCount - Reference count for cleanup tracking
 * @property {object} options - Original options used to create container
 */

/** @type {Map<string, CachedContainer>} */
const cachedContainers = new Map();

// ============================================================================
// Public API
// ============================================================================

/**
 * Creates or retrieves a shared container for a test group.
 * Uses reference counting to track usage and enable proper cleanup.
 *
 * @param {string} containerKey - Unique key for this container group
 * @param {object} [options] - Container creation options
 * @param {boolean} [options.stubLLM] - Whether to stub LLM
 * @param {boolean} [options.loadMods] - Whether to load mods
 * @param {string[]} [options.mods] - Mods to load
 * @returns {Promise<object>} The E2E test environment
 * @example
 * // In beforeAll
 * const env = await getSharedContainer('turn-execution-tests', {
 *   stubLLM: true,
 *   loadMods: false,
 *   mods: ['core'],
 * });
 */
export async function getSharedContainer(containerKey, options = {}) {
  const defaultOptions = {
    stubLLM: true,
    loadMods: false,
    mods: ['core'],
  };

  const mergedOptions = { ...defaultOptions, ...options };

  if (!cachedContainers.has(containerKey)) {
    const env = await createE2ETestEnvironment(mergedOptions);
    cachedContainers.set(containerKey, {
      env,
      refCount: 0,
      options: mergedOptions,
    });
  }

  const cached = cachedContainers.get(containerKey);
  cached.refCount++;
  return cached.env;
}

/**
 * Resets container state between tests without full recreation.
 * This is a lightweight operation compared to full container teardown/setup.
 *
 * @param {string} containerKey - Container to reset
 * @returns {void}
 * @example
 * // In beforeEach
 * resetContainerState('turn-execution-tests');
 */
export function resetContainerState(containerKey) {
  const cached = cachedContainers.get(containerKey);
  if (!cached?.env) {
    return;
  }

  // Clear any entities created by previous tests
  if (cached.env.helpers?.getCreatedEntities) {
    const createdEntities = cached.env.helpers.getCreatedEntities();
    if (Array.isArray(createdEntities)) {
      for (const entityId of createdEntities) {
        try {
          if (cached.env.helpers.deleteEntity) {
            cached.env.helpers.deleteEntity(entityId);
          }
        } catch {
          // Ignore deletion errors during reset
        }
      }
    }
  }

  // Clear entity store if available
  if (cached.env.services?.entityManager?.clear) {
    try {
      cached.env.services.entityManager.clear();
    } catch {
      // Ignore clear errors during reset
    }
  }
}

/**
 * Releases a shared container (cleanup when reference count hits 0).
 * Should be called in afterAll for each test group using the container.
 *
 * @param {string} containerKey - Container to release
 * @returns {Promise<void>}
 * @example
 * // In afterAll
 * await releaseSharedContainer('turn-execution-tests');
 */
export async function releaseSharedContainer(containerKey) {
  const cached = cachedContainers.get(containerKey);
  if (!cached) {
    return;
  }

  cached.refCount--;

  if (cached.refCount <= 0) {
    try {
      if (cached.env?.cleanup) {
        await cached.env.cleanup();
      }
    } catch {
      // Ignore cleanup errors
    }
    cachedContainers.delete(containerKey);
  }
}

/**
 * Forces cleanup of all cached containers.
 * Useful for global test teardown or error recovery.
 *
 * @returns {Promise<void>}
 * @example
 * // In global afterAll or error handler
 * await cleanupAllSharedContainers();
 */
export async function cleanupAllSharedContainers() {
  const cleanupPromises = [];

  for (const [key, cached] of cachedContainers) {
    if (cached.env?.cleanup) {
      cleanupPromises.push(
        cached.env.cleanup().catch(() => {
          // Ignore individual cleanup errors
        })
      );
    }
    cachedContainers.delete(key);
  }

  await Promise.all(cleanupPromises);
}

/**
 * Gets information about currently cached containers.
 * Useful for debugging and monitoring.
 *
 * @returns {Array<{key: string, refCount: number}>} Container info
 */
export function getContainerInfo() {
  return Array.from(cachedContainers.entries()).map(([key, cached]) => ({
    key,
    refCount: cached.refCount,
  }));
}

/**
 * Checks if a container exists in the cache.
 *
 * @param {string} containerKey - Container key to check
 * @returns {boolean} True if container exists
 */
export function hasContainer(containerKey) {
  return cachedContainers.has(containerKey);
}
