// src/core/services/workspaceDataFetcher.js

/**
 * @file Implements the IDataFetcher interface using the global fetch API
 * to retrieve data from URLs or file paths accessible via fetch.
 */

/**
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 */

/**
 * Fetches raw data from a specified source (URL or accessible file path)
 * using the global fetch API. Assumes the response should be JSON.
 * @implements {IDataFetcher}
 */
class WorkspaceDataFetcher {
  /**
   * Fetches data identified by the given string (typically a URL or file path).
   * It uses the global `Workspace` function available in the environment.
   * The promise resolves with the parsed JSON data if the request is successful and the content type indicates JSON.
   * @param {string} identifier - The URL or path string identifying the resource to fetch.
   * @returns {Promise<any>} A promise that resolves with the parsed JSON object from the response body.
   * @throws {Error} Throws an error if the identifier is invalid, the network request fails, the HTTP response status indicates an error (not ok), or if parsing as JSON fails.
   */
  async fetch(identifier) {
    // AC: fetch method throws an error for invalid input identifier.
    if (
      !identifier ||
      typeof identifier !== 'string' ||
      identifier.trim() === ''
    ) {
      throw new Error(
        'WorkspaceDataFetcher: fetch requires a valid non-empty string identifier (URL or path).'
      );
    }

    try {
      // AC: fetch method uses the global fetch API to make the request.
      const response = await fetch(identifier);

      // AC: fetch method checks if response.ok is true.
      // Check if the request was successful (status code in the range 200-299)
      if (!response.ok) {
        // AC: Throws an error if response.ok is false, including status and identifier.
        // Attempt to get response text for more context, if available
        let responseBody = '';
        try {
          responseBody = await response.text(); // Read body as text for error reporting
        } catch (textError) {
          responseBody = `(Could not read response body: ${textError.message})`;
        }
        throw new Error(
          `HTTP error! status: ${response.status} (${response.statusText}) fetching ${identifier}. Response body: ${responseBody.substring(0, 500)}${responseBody.length > 500 ? '...' : ''}`
        );
      }

      // AC: fetch method calls response.json() to parse the body.
      // Parse the response body as JSON
      // response.json() returns a promise that resolves with the result of parsing the body text as JSON
      // It throws if the body is not valid JSON.
      const jsonData = await response.json();
      // AC: fetch method returns the parsed JSON data on success.
      return jsonData;
    } catch (error) {
      // AC: fetch method catches errors (network, HTTP, JSON parsing).
      // Handle potential network errors (e.g., DNS resolution failure, refused connection)
      // or errors thrown from the !response.ok check, or JSON parsing errors.
      console.error(
        `WorkspaceDataFetcher: Error fetching or parsing ${identifier}:`,
        error
      );

      // AC: fetch method logs and re-throws caught errors.
      // Re-throw the error to allow calling code to handle it
      // Ensure it's an Error object
      if (error instanceof Error) {
        // Add context if the original error message is too generic (e.g., 'Failed to fetch')
        if (
          error.message.includes('Failed to fetch') ||
          error.message.includes('invalid json')
        ) {
          throw new Error(
            `WorkspaceDataFetcher failed for ${identifier}: ${error.message}`
          );
        }
        throw error; // Re-throw original error if it's already specific
      } else {
        throw new Error(
          `WorkspaceDataFetcher encountered an unknown error fetching ${identifier}: ${error}`
        );
      }
    }
  }
}

// AC: workspaceDataFetcher.js exists and exports the WorkspaceDataFetcher class.
// Export the class for use in other modules
export default WorkspaceDataFetcher;
