// src/tests/services/workspaceDataFetcher.test.js

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import WorkspaceDataFetcher from '../../../src/data/workspaceDataFetcher.js'; // Adjust path as needed

describe('WorkspaceDataFetcher', () => {
  let fetcher;
  let fetchSpy; // To hold the spy for the global fetch
  let consoleErrorSpy;

  // Task 1: Setup Mocking (Setup)
  beforeEach(() => {
    // Create a new instance for each test to ensure isolation
    fetcher = new WorkspaceDataFetcher();
    // Spy on window.fetch because we are in the jsdom environment
    fetchSpy = jest.spyOn(window, 'fetch');
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // Task 1: Setup Mocking (Teardown)
  afterEach(() => {
    // Restore the original fetch implementation after each test
    fetchSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // Task 2: Test `Workspace` Success
  it('should fetch and parse JSON data successfully when response is ok', async () => {
    const mockData = { data: 'test-value' };
    const identifier = '/api/data/success';

    // Mock the Response object that fetch resolves with
    const mockResponse = {
      ok: true, // Indicate success
      status: 200,
      statusText: 'OK',
      json: jest.fn().mockResolvedValue(mockData), // Mock the json() method to return parsed data
    };

    // Configure the fetch spy to resolve with our mock Response
    fetchSpy.mockResolvedValue(mockResponse);

    // Call the method under test
    const result = await fetcher.fetch(identifier);

    // Assertions
    expect(result).toEqual(mockData); // Check if the resolved data is correct
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Check if fetch was called once
    expect(fetchSpy).toHaveBeenCalledWith(identifier); // Check if fetch was called with the correct URL
    expect(mockResponse.json).toHaveBeenCalledTimes(1); // Check if response.json() was called
  });

  // Task 3: Test `Workspace` HTTP Error
  describe('HTTP Error Handling', () => {
    it('should reject with an error for HTTP errors (e.g., 404)', async () => {
      const identifier = '/api/data/notfound';
      const mockResponse = {
        ok: false, // Indicate failure
        status: 404,
        statusText: 'Not Found',
        json: jest.fn(), // json() should not be called in this case
      };

      fetchSpy.mockResolvedValue(mockResponse);

      // Assert that the promise rejects and check the error message
      await expect(fetcher.fetch(identifier)).rejects.toThrow(
        `HTTP error! status: 404 (Not Found) fetching ${identifier}`
      );

      // Verify fetch was called, but response.json() was not
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(identifier);
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should reject with an error for other HTTP errors (e.g., 500)', async () => {
      const identifier = '/api/data/servererror';
      const mockResponse = {
        ok: false, // Indicate failure
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn(),
      };

      fetchSpy.mockResolvedValue(mockResponse);

      await expect(fetcher.fetch(identifier)).rejects.toThrow(
        `HTTP error! status: 500 (Internal Server Error) fetching ${identifier}`
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(identifier);
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  // Task 4: Test `Workspace` Network Error
  it('should reject with an error for network failures', async () => {
    const identifier = '/api/data/networkfail';
    const networkError = new Error('Failed to fetch'); // Simulate network error

    // Configure fetch spy to reject
    fetchSpy.mockRejectedValue(networkError);

    // Assert that the promise rejects with the specific network error
    await expect(fetcher.fetch(identifier)).rejects.toThrow(
      'WorkspaceDataFetcher failed for /api/data/networkfail: Failed to fetch'
    );

    // Verify fetch was called
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(identifier);
  });

  // Task 5: Test Invalid Identifier Input
  describe('Invalid Identifier Input', () => {
    // Test multiple invalid inputs efficiently
    it.each([
      null,
      undefined,
      '', // Empty string
      123, // Number
      {}, // Object
      [], // Array
    ])(
      'should reject with an error for invalid identifier: %p',
      async (invalidIdentifier) => {
        // Use rejects.toThrow because the function is async, even if the error is synchronous
        await expect(fetcher.fetch(invalidIdentifier)).rejects.toThrow(
          'WorkspaceDataFetcher: fetch requires a valid non-empty string identifier (URL or path).'
        );

        // Crucially, ensure fetch itself was never called
        expect(fetchSpy).not.toHaveBeenCalled();
      }
    );
  });

  // Task 6: Test `Workspace` JSON Parsing Error
  it('should reject with an error if JSON parsing fails', async () => {
    const identifier = '/api/data/badjson';
    const jsonParseError = new SyntaxError(
      'Unexpected token < in JSON at position 0'
    );

    // Mock a successful HTTP response
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      // Mock json() method to REJECT with a parsing error
      json: jest.fn().mockRejectedValue(jsonParseError),
    };

    fetchSpy.mockResolvedValue(mockResponse);

    // Assert that the promise rejects with the JSON parsing error
    await expect(fetcher.fetch(identifier)).rejects.toThrow(jsonParseError);

    // Verify fetch and response.json were called
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(identifier);
    expect(mockResponse.json).toHaveBeenCalledTimes(1);
  });

  it('should reject identifiers that are purely whitespace', async () => {
    await expect(fetcher.fetch('   ')).rejects.toThrow(
      'WorkspaceDataFetcher: fetch requires a valid non-empty string identifier (URL or path).'
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('includes the response body when an HTTP error provides textual content', async () => {
    const identifier = '/api/data/bad-request';
    const responseBody = '{"error":"bad request"}';

    const mockResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: jest.fn(),
      text: jest.fn().mockResolvedValue(responseBody),
    };

    fetchSpy.mockResolvedValue(mockResponse);

    await expect(fetcher.fetch(identifier)).rejects.toThrow(
      `HTTP error! status: 400 (Bad Request) fetching ${identifier}. Response body: ${responseBody}`
    );

    expect(mockResponse.text).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `WorkspaceDataFetcher: Error fetching or parsing ${identifier}:`,
      expect.any(Error)
    );
  });

  it('truncates long response bodies when reporting HTTP errors', async () => {
    const identifier = '/api/data/large-error';
    const longBody = 'x'.repeat(520);
    const mockResponse = {
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: jest.fn(),
      text: jest.fn().mockResolvedValue(longBody),
    };

    fetchSpy.mockResolvedValue(mockResponse);

    const expectedSnippet = longBody.substring(0, 500);

    await expect(fetcher.fetch(identifier)).rejects.toThrow(
      `HTTP error! status: 503 (Service Unavailable) fetching ${identifier}. Response body: ${expectedSnippet}...`
    );

    expect(mockResponse.text).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `WorkspaceDataFetcher: Error fetching or parsing ${identifier}:`,
      expect.any(Error)
    );
  });

  it('adds identifier context when JSON parsing errors mention invalid json', async () => {
    const identifier = '/api/data/invalid-json';
    const parseError = new Error('invalid json payload from upstream');

    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: jest.fn().mockRejectedValue(parseError),
    };

    fetchSpy.mockResolvedValue(mockResponse);

    await expect(fetcher.fetch(identifier)).rejects.toThrow(
      `WorkspaceDataFetcher failed for ${identifier}: ${parseError.message}`
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `WorkspaceDataFetcher: Error fetching or parsing ${identifier}:`,
      parseError
    );
  });

  it('wraps non-Error rejections with a descriptive Error instance', async () => {
    const identifier = '/api/data/non-error';

    fetchSpy.mockRejectedValue('catastrophic failure');

    await expect(fetcher.fetch(identifier)).rejects.toThrow(
      `WorkspaceDataFetcher encountered an unknown error fetching ${identifier}: catastrophic failure`
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `WorkspaceDataFetcher: Error fetching or parsing ${identifier}:`,
      'catastrophic failure'
    );
  });

  it('registers comprehensive coverage for workspaceDataFetcher.js', () => {
    const coverageEntries = Object.entries(globalThis.__coverage__ ?? {});
    const coverageEntry = coverageEntries.find(([key]) =>
      key.endsWith('src/data/workspaceDataFetcher.js')
    );

    expect(coverageEntry).toBeDefined();

    const [, fileCoverage] = coverageEntry;

    const statementHits = Object.values(fileCoverage.s ?? {});
    const functionHits = Object.values(fileCoverage.f ?? {});
    const branchHits = Object.values(fileCoverage.b ?? {}).flat();

    expect(statementHits.length).toBeGreaterThan(0);
    expect(functionHits.length).toBeGreaterThan(0);
    expect(branchHits.length).toBeGreaterThan(0);

    expect(statementHits.every((count) => count > 0)).toBe(true);
    expect(functionHits.every((count) => count > 0)).toBe(true);
    expect(branchHits.every((count) => count > 0)).toBe(true);
  });
});
