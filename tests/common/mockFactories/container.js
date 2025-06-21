/**
 * @file Factory helpers related to the dependency injection container and storage providers.
 * @see tests/common/mockFactories/container.js
 */

import { jest } from '@jest/globals';

/**
 * Creates a minimal DI container mock.
 *
 * @param {Record<string | symbol, any>} mapping - Base token–to–mock map.
 * @param {Record<string | symbol, any>} [overrides] - Per-test override map.
 * @returns {{ resolve: jest.Mock }} Object with a jest.fn `resolve` method.
 */
export const createMockContainer = (mapping, overrides = {}) => ({
  resolve: jest.fn((token) => {
    if (Object.prototype.hasOwnProperty.call(overrides, token)) {
      return overrides[token];
    }
    if (Object.prototype.hasOwnProperty.call(mapping, token)) {
      return mapping[token];
    }
    const tokenName =
      typeof token === 'symbol' ? token.toString() : String(token);
    throw new Error(`createMockContainer: Unmapped token: ${tokenName}`);
  }),
});

/**
 * Creates a simple in-memory storage provider used by persistence tests.
 *
 * @returns {import('../../../src/interfaces/IStorageProvider.js').IStorageProvider} In-memory provider
 */
export function createMemoryStorageProvider() {
  const files = {};
  return {
    writeFileAtomically: jest.fn(async (path, data) => {
      files[path] = data;
      return { success: true };
    }),
    readFile: jest.fn(async (path) => files[path]),
    listFiles: jest.fn(async () => Object.keys(files)),
    deleteFile: jest.fn(async (path) => {
      if (path in files) {
        delete files[path];
        return { success: true };
      }
      return { success: false, error: 'not found' };
    }),
    fileExists: jest.fn(async (path) => path in files),
    ensureDirectoryExists: jest.fn(async () => {}),
  };
}

export default createMockContainer;
