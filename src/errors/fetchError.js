/**
 * @file Error type for fetch operation failures.
 */

/**
 * Error thrown when a file or resource cannot be fetched.
 *
 * @class
 * @augments {Error}
 */
export class FetchError extends Error {
  /**
   * @param {string} message - Description of the fetch failure.
   * @param {string} [path] - Path or URL that failed to fetch.
   */
  constructor(message, path = null) {
    super(message);
    this.name = 'FetchError';
    this.path = path;
  }
}

export default FetchError;
