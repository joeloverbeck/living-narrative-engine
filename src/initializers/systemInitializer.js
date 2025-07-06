// src/initializers/systemInitializer.js

/**
 * @file Defines the SystemInitializer class, responsible for
 * coordinating the initialization sequence of various core application systems
 * discovered via a configurable container tag.
 */

// Type imports for JSDoc
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Corrected path
/** @typedef {import('../utils/eventDispatchService.js').EventDispatchService} EventDispatchService */
import { assertFunction, assertPresent } from '../utils/dependencyUtils.js';

/**
 * Service responsible for initializing essential systems of the application.
 * It uses an IServiceResolver to find systems marked with a specific
 * initialization tag and orchestrates their startup process.
 */
class SystemInitializer {
  #resolver;
  /** @type {ILogger} */
  #logger;
  /** @type {string} */
  #initializationTag;
  /** @type {ValidatedEventDispatcher} */
  #validatedEventDispatcher; // eslint-disable-line no-unused-private-class-members
  /** @type {EventDispatchService} */
  #eventDispatchService;

  /**
   * Creates an instance of SystemInitializer.
   *
   * @param {object} dependencies - Constructor dependencies.
   * @param {ILogger} dependencies.logger - The logging service instance.
   * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher - Service for dispatching validated events.
   * @param {EventDispatchService} dependencies.eventDispatchService - Service for event dispatching with logging.
   * @param {string} dependencies.initializationTag - The tag used to identify systems for initialization.
   * @param {import('../interfaces/IServiceResolver.js').IServiceResolver} dependencies.resolver - Resolver used to locate systems.
   * @throws {Error} If resolver, logger, initializationTag, validatedEventDispatcher, or eventDispatchService is invalid or missing.
   */
  constructor({
    resolver,
    logger,
    validatedEventDispatcher,
    eventDispatchService,
    initializationTag,
  }) {
    assertFunction(
      resolver,
      'resolveByTag',
      "SystemInitializer requires a valid IServiceResolver with 'resolveByTag'."
    );
    assertPresent(logger, 'SystemInitializer requires an ILogger instance.');
    assertFunction(
      validatedEventDispatcher,
      'dispatch',
      'SystemInitializer requires a valid ValidatedEventDispatcher.'
    );
    assertFunction(
      eventDispatchService,
      'dispatchWithLogging',
      'SystemInitializer requires a valid EventDispatchService.'
    );
    if (
      !initializationTag ||
      typeof initializationTag !== 'string' ||
      initializationTag.trim() === ''
    )
      throw new Error(
        'SystemInitializer requires a non-empty string initializationTag.'
      );

    this.#resolver = resolver;
    this.#logger = logger;
    this.#initializationTag = initializationTag;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#eventDispatchService = eventDispatchService;

    this.#logger.debug(
      `SystemInitializer instance created. Tag: '${this.#initializationTag}'.`
    );
  }

  /**
   * Resolves systems tagged for initialization.
   *
   * @private
   * @async
   * @returns {Promise<Array<any>>} An array of resolved systems.
   * @throws {Error} If resolution fails critically.
   */
  async #resolveSystems() {
    let resolvedSystems = [];
    try {
      this.#logger.debug(
        `SystemInitializer: Querying resolver for tag '${this.#initializationTag}'...`
      );
      resolvedSystems = await this.#resolver.resolveByTag(
        this.#initializationTag
      );

      if (!Array.isArray(resolvedSystems)) {
        this.#logger.warn(
          `SystemInitializer: resolveByTag for tag '${this.#initializationTag}' did not return an array. Treating as empty.`
        );
        resolvedSystems = [];
      }
      this.#logger.debug(
        `SystemInitializer: Found ${resolvedSystems.length} systems tagged with '${this.#initializationTag}'.`
      );
      return resolvedSystems;
    } catch (resolveTagError) {
      this.#logger.error(
        `SystemInitializer: Failed to resolve systems by tag '${this.#initializationTag}'. Error: ${resolveTagError.message}`,
        resolveTagError
      );
      throw new Error(
        `Failed to resolve initializable systems using tag '${this.#initializationTag}': ${resolveTagError.message}`
      );
    }
  }

  /**
   * Attempts to initialize a single provided system object asynchronously.
   * Logs outcome and dispatches 'system:initialized' or 'system:initialization_failed' event.
   * Does not re-throw initialization errors.
   *
   * @private
   * @async
   * @param {any} system - The system object.
   * @returns {Promise<void>}
   */
  async #initializeSingleSystem(system) {
    const systemName = system?.constructor?.name ?? 'UnnamedSystem';

    if (system && typeof system.initialize === 'function') {
      this.#logger.debug(
        `SystemInitializer: Initializing system: ${systemName}...`
      );
      try {
        /** @type {{ initialize: () => Promise<void> | void }} */
        await system.initialize();
        this.#logger.debug(
          `SystemInitializer: System ${systemName} initialized successfully.`
        );
      } catch (initError) {
        this.#logger.error(
          `SystemInitializer: Error initializing system '${systemName}'. Continuing. Error: ${initError.message}`,
          initError
        );

        // Dispatch individual failure event
        const failurePayload = {
          systemName,
          error: initError?.message || 'Unknown error',
          stack: initError?.stack,
        };
        this.#eventDispatchService.dispatchWithLogging(
          'system:initialization_failed',
          failurePayload,
          systemName,
          { allowSchemaNotFound: true }
        );
      }
    } else {
      if (system) {
        this.#logger.debug(
          `SystemInitializer: System '${systemName}' has no initialize() method, skipping.`
        );
      } else {
        this.#logger.warn(
          `SystemInitializer: Encountered null/undefined entry for tag '${this.#initializationTag}', skipping.`
        );
      }
    }
  }

  /**
   * Initializes all systems found with the configured tag sequentially.
   * Dispatches overall 'initialization:system_initializer:started/completed/failed' events.
   * Individual system initialization errors are logged but do not halt the process.
   *
   * @async
   * @returns {Promise<void>} Resolves when all systems have been processed.
   * @throws {Error} If resolving the systems critically fails.
   */
  async initializeAll() {
    this.#logger.debug(
      `SystemInitializer: Starting initialization for systems tagged with '${this.#initializationTag}'...`
    );

    const systemsToInitialize = await this.#resolveSystems();
    this.#logger.debug(
      `SystemInitializer: Proceeding to initialize ${systemsToInitialize.length} resolved systems sequentially...`
    );

    for (const system of systemsToInitialize) {
      await this.#initializeSingleSystem(system); // Handles individual errors and events
    }

    this.#logger.debug(
      'SystemInitializer: Initialization loop for tagged systems completed.'
    );
  }
}

export default SystemInitializer;
