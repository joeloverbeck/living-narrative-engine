import { jest } from '@jest/globals';
import { deepClone } from '../../../src/utils/cloneUtils.js';

export const createMockDataFetcher = ({
  fromDisk = false,
  pathToResponse = {},
  errorPaths = [],
  overrides = {},
} = {}) => {
  if (fromDisk) {
    const fs = require('fs');
    return {
      fetch: jest.fn().mockImplementation(async (identifier) => {
        if (identifier.endsWith('.json')) {
          const filePath = identifier.replace(/^\.\//, '');
          return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        throw new Error('Unsupported identifier: ' + identifier);
      }),
      fetchJson: jest.fn(),
      fetchText: jest.fn(),
      ...overrides,
    };
  }

  let fetchErrorMessage = '';
  const mockFetcher = {
    fetch: jest.fn(),
    fetchJson: jest.fn(),
    fetchText: jest.fn(),
    mockSuccess: function (path, responseData) {
      pathToResponse[path] = deepClone(responseData);
      if (errorPaths.includes(path)) {
        errorPaths = errorPaths.filter((p) => p !== path);
      }
      setFetchImplementation();
    },
    mockFailure: function (
      path,
      errorMessage = `Mock Fetch Error: Failed to fetch ${path}`
    ) {
      if (!errorPaths.includes(path)) {
        errorPaths.push(path);
      }
      if (Object.prototype.hasOwnProperty.call(pathToResponse, path)) {
        delete pathToResponse[path];
      }
      fetchErrorMessage = errorMessage;
      setFetchImplementation();
    },
    ...overrides,
  };

  /**
   *
   */
  function setFetchImplementation() {
    mockFetcher.fetch.mockImplementation(async (p) => {
      if (errorPaths.includes(p)) {
        const message =
          fetchErrorMessage || `Mock Fetch Error: Failed to fetch ${p}`;
        return Promise.reject(new Error(message));
      }
      if (Object.prototype.hasOwnProperty.call(pathToResponse, p)) {
        try {
          return Promise.resolve(deepClone(pathToResponse[p]));
        } catch (e) {
          return Promise.reject(
            new Error(
              `Mock Fetcher Error: Could not clone mock data for path ${p}. Is it valid JSON?`
            )
          );
        }
      }
      if (overrides.defaultValue !== undefined) {
        return Promise.resolve(deepClone(overrides.defaultValue));
      }
      return Promise.reject(
        new Error(`Mock Fetch Error: 404 Not Found for path ${p}`)
      );
    });
  }

  setFetchImplementation();

  return mockFetcher;
};
