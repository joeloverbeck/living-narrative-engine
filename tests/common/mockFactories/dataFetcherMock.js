import { jest } from '@jest/globals';
import fs from 'fs';
import { deepClone } from '../../../src/utils/cloneUtils.js';

/**
 * @class
 * @description Simple in-memory data fetcher used for tests. Supports
 * mapping specific paths to responses, forcing failures, and optionally
 * reading JSON from disk.
 */
export class MockDataFetcher {
  /**
   * @param {object} [options]
   * @param {boolean} [options.fromDisk=false] Read data from disk instead.
   * @param {Record<string, any>} [options.pathToResponse] Map of paths to data.
   * @param {string[]} [options.errorPaths] Paths that should reject on fetch.
   * @param {object} [options.overrides] Extra properties/mocks to assign.
   */
  constructor({
    fromDisk = false,
    pathToResponse = {},
    errorPaths = [],
    overrides = {},
  } = {}) {
    this.fromDisk = fromDisk;
    this.pathToResponse = { ...pathToResponse };
    this.errorPaths = [...errorPaths];
    this.fetchErrorMessage = '';
    /** @type {jest.Mock<any, [string]>} */
    this.fetch = jest.fn();
    this.fetchJson = jest.fn();
    this.fetchText = jest.fn();
    Object.assign(this, overrides);
    this.#setFetchImplementation();
  }

  /**
   * Maps a path to a successful response and removes any existing failure.
   *
   * @param {string} path Path identifier to resolve.
   * @param {any} responseData Response that should be returned.
   * @returns {void}
   */
  mockSuccess(path, responseData) {
    this.pathToResponse[path] = deepClone(responseData);
    this.errorPaths = this.errorPaths.filter((p) => p !== path);
    this.#setFetchImplementation();
  }

  /**
   * Forces the given path to reject with an optional message.
   *
   * @param {string} path Path identifier that should fail.
   * @param {string} [errorMessage]
   * @returns {void}
   */
  mockFailure(
    path,
    errorMessage = `Mock Fetch Error: Failed to fetch ${path}`
  ) {
    if (!this.errorPaths.includes(path)) {
      this.errorPaths.push(path);
    }
    if (Object.prototype.hasOwnProperty.call(this.pathToResponse, path)) {
      delete this.pathToResponse[path];
    }
    this.fetchErrorMessage = errorMessage;
    this.#setFetchImplementation();
  }

  /**
   * Internal helper to update the fetch mock implementation.
   *
   * @private
   * @returns {void}
   */
  #setFetchImplementation() {
    if (this.fromDisk) {
      this.fetch.mockImplementation(async (identifier) => {
        if (identifier.endsWith('.json')) {
          const filePath = identifier.replace(/^\.\//, '');
          return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        throw new Error('Unsupported identifier: ' + identifier);
      });
      return;
    }

    this.fetch.mockImplementation(async (p) => {
      if (this.errorPaths.includes(p)) {
        const message =
          this.fetchErrorMessage || `Mock Fetch Error: Failed to fetch ${p}`;
        return Promise.reject(new Error(message));
      }
      if (Object.prototype.hasOwnProperty.call(this.pathToResponse, p)) {
        try {
          return Promise.resolve(deepClone(this.pathToResponse[p]));
        } catch (e) {
          return Promise.reject(
            new Error(
              `Mock Fetcher Error: Could not clone mock data for path ${p}. Is it valid JSON?`
            )
          );
        }
      }
      if (this.defaultValue !== undefined) {
        return Promise.resolve(deepClone(this.defaultValue));
      }
      return Promise.reject(
        new Error(`Mock Fetch Error: 404 Not Found for path ${p}`)
      );
    });
  }
}

export { createMockDataFetcher } from './coreServices.js';
