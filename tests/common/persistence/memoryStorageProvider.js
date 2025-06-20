/**
 * @file Provides an in-memory implementation of the storage provider interface for tests.
 * @see tests/common/persistence/memoryStorageProvider.js
 */
import { jest } from '@jest/globals';
/** @typedef {import('../../../src/interfaces/IStorageProvider.js').IStorageProvider} IStorageProvider */

/**
 * Creates a simple in-memory storage provider.
 *
 * @description Returns a mock implementation of {@link IStorageProvider} that
 * stores file data in an object and exposes asynchronous methods used by the
 * persistence layer.
 * @returns {IStorageProvider} In-memory provider
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

export default createMemoryStorageProvider;
