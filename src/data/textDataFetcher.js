/**
 * @file Implements the IDataFetcher interface using the global fetch API
 * to retrieve raw text data from URLs or file paths accessible via fetch.
 */

/**
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 */

/**
 * Fetches raw text data from a specified source (URL or accessible file path)
 * using the global fetch API. Returns the response as raw text content.
 *
 * @implements {IDataFetcher}
 */
class TextDataFetcher {
  /**
   * Fetches data identified by the given string (typically a URL or file path).
   * It uses the global `fetch` function available in the environment.
   * The promise resolves with the raw text content if the request is successful.
   *
   * @param {string} identifier - The URL or path string identifying the resource to fetch.
   * @returns {Promise<string>} A promise that resolves with the raw text content from the response body.
   * @throws {Error} Throws an error if the identifier is invalid, the network request fails, or the HTTP response status indicates an error (not ok).
   */
  async fetch(identifier) {
    // Validate input identifier
    if (
      !identifier ||
      typeof identifier !== 'string' ||
      identifier.trim() === ''
    ) {
      throw new Error(
        'TextDataFetcher: fetch requires a valid non-empty string identifier (URL or path).'
      );
    }

    try {
      // Use the global fetch API to make the request
      const response = await fetch(identifier);

      // Check if the request was successful (status code in the range 200-299)
      if (!response.ok) {
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

      // Parse the response body as text
      // response.text() returns a promise that resolves with the result of parsing the body text as a string
      const textData = await response.text();
      return textData;
    } catch (error) {
      // Handle potential network errors (e.g., DNS resolution failure, refused connection)
      // or errors thrown from the !response.ok check, or text parsing errors.
      console.error(
        `TextDataFetcher: Error fetching or parsing ${identifier}:`,
        error
      );

      // Re-throw the error to allow calling code to handle it
      // Ensure it's an Error object
      if (error instanceof Error) {
        // Add context if the original error message is too generic (e.g., 'Failed to fetch')
        if (error.message.includes('Failed to fetch')) {
          throw new Error(
            `TextDataFetcher failed for ${identifier}: ${error.message}`
          );
        }
        throw error; // Re-throw original error if it's already specific
      } else {
        throw new Error(
          `TextDataFetcher encountered an unknown error fetching ${identifier}: ${error}`
        );
      }
    }
  }
}

// Export the class for use in other modules
export default TextDataFetcher;
