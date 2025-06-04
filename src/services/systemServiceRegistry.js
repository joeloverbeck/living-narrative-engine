// src/core/systemServiceRegistry.js

/**
 * @file Defines the SystemServiceRegistry class, responsible for
 * managing the lifecycle and access to shared system services.
 */

// Import necessary types (using JSDoc for typedef)
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */

/**
 * A central registry for accessing shared system-level services like logging,
 * configuration, data fetching, etc. This promotes decoupling by allowing
 * components to request services by interface type rather than importing
 * concrete implementations directly.
 *
 * Services are registered using unique string keys and can be retrieved using
 * the same key.
 */
export class SystemServiceRegistry {
  /**
   * The logger instance used by the registry itself.
   *
   * @private
   * @type {ILogger}
   */
  #logger;

  /**
   * Internal storage for registered service instances.
   * The key is a unique string identifier for the service, and the value
   * is the service instance itself.
   *
   * @private
   * @type {Map<string, any>}
   */
  #services;

  /**
   * Creates an instance of the SystemServiceRegistry.
   * Requires a valid logger instance for internal logging and potential
   * logging by registered services.
   *
   * @param {ILogger} logger - An object conforming to the ILogger interface.
   * @throws {TypeError} If the provided logger is missing or invalid (does not have info, warn, error, debug methods).
   */
  constructor(logger) {
    // 1. Validate the logger *before* trying to use or store it.
    if (
      !logger ||
      typeof logger.info !== 'function' ||
      typeof logger.warn !== 'function' ||
      typeof logger.error !== 'function' ||
      typeof logger.debug !== 'function'
    ) {
      // Throw error immediately if logger is invalid. Cannot log this error yet.
      throw new TypeError(
        'SystemServiceRegistry requires a valid ILogger instance with info, warn, error, and debug methods.'
      );
    }

    // 2. Store the validated logger instance.
    this.#logger = logger;

    // 3. Initialize the internal map for storing services.
    this.#services = new Map();
  }

  /**
   * Registers a service instance with the registry under a unique ID.
   *
   * @param {string} serviceId - A unique, non-empty string identifier for the service.
   * @param {any} serviceInstance - The actual service instance to register. Must not be null or undefined.
   * @returns {void}
   */
  registerService(serviceId, serviceInstance) {
    const methodName = 'SystemServiceRegistry.registerService'; // Helper for consistent log messages

    // --- Input Validation ---
    if (typeof serviceId !== 'string' || serviceId.trim() === '') {
      this.#logger.warn(
        `${methodName}: Invalid serviceId provided. Must be a non-empty string. Received:`,
        serviceId
      );
      return; // AC 6.2.2
    }

    // Using == null checks for both null and undefined
    if (serviceInstance == null) {
      this.#logger.warn(
        `${methodName}: Invalid serviceInstance provided for serviceId '${serviceId}'. Must not be null or undefined.`
      );
      return; // AC 6.2.3
    }

    // --- Overwrite Check & Logging ---
    if (this.#services.has(serviceId)) {
      this.#logger.warn(
        `${methodName}: Overwriting existing service registration for serviceId '${serviceId}'.`
      ); // AC 6.2.4
    }

    // --- Storage ---
    this.#services.set(serviceId, serviceInstance); // AC 6.2.5

    // --- Success Logging ---
    this.#logger.debug(
      `${methodName}: Successfully registered service with serviceId '${serviceId}'.`
    ); // AC 6.2.6
  }

  /**
   * Retrieves a registered service instance by its ID.
   *
   * @template T The expected type of the service instance.
   * @param {string} serviceId - The unique, non-empty string identifier for the service.
   * @returns {T | undefined} The registered service instance if found, otherwise undefined.
   * The caller is responsible for ensuring the type T matches the
   * actual registered service type.
   */
  getService(serviceId) {
    // AC 6.3.1: Method exists
    const methodName = 'SystemServiceRegistry.getService';

    // --- Input Validation ---
    if (typeof serviceId !== 'string' || serviceId.trim() === '') {
      this.#logger.warn(
        `${methodName}: Invalid serviceId provided. Must be a non-empty string. Received:`,
        serviceId
      );
      return undefined; // AC 6.3.2
    }

    // --- Lookup ---
    const serviceInstance = this.#services.get(serviceId);

    // --- Not Found Handling ---
    if (serviceInstance === undefined) {
      // Don't warn on 'get' if not found, as checking existence is a valid use case.
      // Log at debug level if needed, but warning might be too noisy.
      // this.#logger.debug(
      //     `${methodName}: Service with serviceId '${serviceId}' not found.`
      // );
      return undefined; // AC 6.3.4
    }

    // --- Return Instance ---
    // The type assertion happens implicitly by the caller due to the @template T
    return serviceInstance; // AC 6.3.3
  }

  /**
   * Checks if a service with the specified ID has been registered.
   *
   * @param {string} serviceId - The unique, non-empty string identifier for the service.
   * @returns {boolean} True if a service with the given ID is registered, false otherwise.
   */
  hasService(serviceId) {
    // AC 6.4.1: Method exists
    const methodName = 'SystemServiceRegistry.hasService';

    // --- Input Validation ---
    if (typeof serviceId !== 'string' || serviceId.trim() === '') {
      this.#logger.warn(
        // AC 6.4.2: Logs warning
        `${methodName}: Invalid serviceId provided. Must be a non-empty string. Received:`,
        serviceId
      );
      return false; // AC 6.4.2: Returns false
    }

    // --- Check Existence ---
    const exists = this.#services.has(serviceId);

    // --- Return Result ---
    return exists; // AC 6.4.3 (true if exists), AC 6.4.4 (false if not exists)
  }

  // --- Placeholder for future methods ---
  // removeService(key: string): boolean
}
