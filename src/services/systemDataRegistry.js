// src/core/services/systemDataRegistry.js

/**
 * @file Defines the SystemDataRegistry class, responsible for
 * managing access to various non-ECS data sources like repositories or
 * configurations needed by query handlers or other systems.
 */

// Import necessary types (using JSDoc for typedef)
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Interface for data sources that can be queried by SystemDataRegistry.
 *
 * @typedef {object} IQueryableDataSource
 * @property {(queryDetails: string | object) => any} handleQuery - Method to process a query.
 * @property {ILogger} [logger] - Optional logger instance within the data source.
 */

/**
 * A central registry for accessing non-ECS data sources.
 * Allows systems like QuerySystemDataHandler to retrieve data from registered
 * sources using a standardized query mechanism.
 */
export class SystemDataRegistry {
  /**
   * The logger instance used by the registry itself.
   *
   * @private
   * @type {ILogger}
   */
  #logger;

  /**
   * Internal storage for registered data source instances.
   * The key is a unique string identifier for the source, and the value
   * is the source instance itself, expected to conform to IQueryableDataSource.
   *
   * @private
   * @type {Map<string, IQueryableDataSource>}
   */
  #dataSources;

  /**
   * Creates an instance of the SystemDataRegistry.
   * Requires a valid logger instance for internal operations.
   *
   * @param {ILogger} logger - An object conforming to the ILogger interface.
   * @throws {TypeError} If the provided logger is missing or invalid.
   */
  constructor(logger) {
    if (
      !logger ||
      typeof logger.info !== 'function' ||
      typeof logger.warn !== 'function' ||
      typeof logger.error !== 'function' ||
      typeof logger.debug !== 'function'
    ) {
      throw new TypeError(
        'SystemDataRegistry requires a valid ILogger instance with info, warn, error, and debug methods.'
      );
    }

    this.#logger = logger;
    this.#dataSources = new Map();
  }

  /**
   * Registers a data source instance with the registry.
   * The source instance should ideally implement a `handleQuery` method.
   *
   * @param {string} sourceId - A unique, non-empty string identifier for the data source.
   * @param {IQueryableDataSource} sourceInstance - The actual data source instance. Must not be null or undefined
   * and should have a `handleQuery` method.
   * @returns {void}
   */
  registerSource(sourceId, sourceInstance) {
    const methodName = 'SystemDataRegistry.registerSource';

    if (typeof sourceId !== 'string' || sourceId.trim() === '') {
      this.#logger.warn(
        `${methodName}: Invalid sourceId provided. Must be a non-empty string. Received:`,
        sourceId
      );
      return;
    }

    if (sourceInstance == null) {
      // Checks for both null and undefined
      this.#logger.warn(
        `${methodName}: Invalid sourceInstance provided for sourceId '${sourceId}'. Must not be null or undefined.`
      );
      return;
    }

    // --- MODIFICATION: Added validation for handleQuery method ---
    if (typeof sourceInstance.handleQuery !== 'function') {
      this.#logger.warn(
        `${methodName}: Source instance for sourceId '${sourceId}' does not have a 'handleQuery' method. ` +
          `While registration is allowed, querying this source will fail.`
      );
      // Depending on strictness, you might choose to throw an error here:
      // throw new TypeError(`Source instance for '${sourceId}' must implement 'handleQuery(queryDetails)'.`);
    }
    // --- END MODIFICATION ---

    if (this.#dataSources.has(sourceId)) {
      this.#logger.warn(
        `${methodName}: Overwriting existing source registration for sourceId '${sourceId}'.`
      );
    }

    this.#dataSources.set(sourceId, sourceInstance);
    this.#logger.debug(
      `${methodName}: Successfully registered source with sourceId '${sourceId}'.`
    );
  }

  /**
   * Queries a registered data source for specific information by delegating to its 'handleQuery' method.
   *
   * @param {string} sourceId - The unique identifier of the data source to query.
   * @param {string | object} queryDetails - Details about the query, passed directly to the source's handler.
   * @returns {any | undefined} The result of the query, or undefined if the source is not found,
   * the query is unsupported by the source, or an error occurs.
   */
  query(sourceId, queryDetails) {
    const methodName = 'SystemDataRegistry.query';
    const sourceInstance = this.#dataSources.get(sourceId);

    if (!sourceInstance) {
      this.#logger.warn(
        `${methodName}: Data source with ID '${sourceId}' not found.`
      );
      return undefined;
    }

    if (typeof sourceInstance.handleQuery !== 'function') {
      this.#logger.error(
        `${methodName}: Source '${sourceId}' is registered but does not have a callable 'handleQuery' method. ` +
          `Query details: ${JSON.stringify(queryDetails)}`
      );
      return undefined;
    }

    try {
      this.#logger.debug(
        `${methodName}: Forwarding query to '${sourceId}.handleQuery' with details: ${JSON.stringify(queryDetails)}`
      );
      // Delegate the query directly to the source instance
      return sourceInstance.handleQuery(queryDetails);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.#logger.error(
        `${methodName}: Error executing 'handleQuery' on source '${sourceId}' with details '${JSON.stringify(queryDetails)}'. Error: ${errorMessage}`,
        { sourceId, queryDetails, error: errorMessage, stack }
      );
      return undefined;
    }
  }
}
