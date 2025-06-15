// -----------------------------------------------------------------------------
//  OperationRegistry  – test-compliant, DI-friendly implementation
// -----------------------------------------------------------------------------

/** @typedef {import('./defs.js').OperationHandler}           OperationHandler */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
import { initLogger } from '../utils/serviceInitializer.js';
import { initLogger as baseInitLogger } from '../utils/loggerUtils.js';

class OperationRegistry {
  /** @type {Map<string, OperationHandler>} */ #registry = new Map();
  /** @type {ILogger|null}                  */ #logger = null;

  /**
   * @param {{logger?: ILogger}|ILogger|null|undefined} [arg]
   *        Supports historical call-sites:
   *        • new OperationRegistry({ logger })
   *        • new OperationRegistry(logger)
   *        • new OperationRegistry()
   */
  constructor(arg = null) {
    const maybeLogger =
      arg && typeof arg === 'object' && 'logger' in arg ? arg.logger : arg;
    const validated = baseInitLogger('OperationRegistry', maybeLogger, {
      optional: true,
    });
    this.#logger = initLogger('OperationRegistry', validated);
    this.#logger.info('OperationRegistry initialized.');
  }

  // ---------------------------------------------------------------------------

  /**
   * Register or overwrite a handler.
   *
   * @param {string}               operationType
   * @param {OperationHandler}     handler
   */
  register(operationType, handler) {
    // --- validate ------------------------------------------------------------
    if (typeof operationType !== 'string' || !operationType.trim()) {
      const msg =
        'OperationRegistry.register: operationType must be a non-empty string.';
      this.#logger.error(msg);
      throw new Error(msg);
    }

    const trimmed = operationType.trim();

    if (typeof handler !== 'function') {
      const msg = `OperationRegistry.register: handler for type "${trimmed}" must be a function.`;
      this.#logger.error(msg);
      throw new Error(msg);
    }

    // --- overwrite warning ---------------------------------------------------
    if (this.#registry.has(trimmed)) {
      this.#logger.warn(
        `OperationRegistry: Overwriting existing handler for operation type "${trimmed}".`
      );
    }

    // --- store & debug-log ---------------------------------------------------
    this.#registry.set(trimmed, handler);
    this.#logger.debug(
      `OperationRegistry: Registered handler for operation type "${trimmed}".`
    );
  }

  // ---------------------------------------------------------------------------

  /**
   * Retrieve a handler (if any) for the given type.
   *
   * @param {string} operationType
   * @returns {OperationHandler|undefined}
   */
  getHandler(operationType) {
    if (typeof operationType !== 'string') {
      this.#logger.warn(
        `OperationRegistry.getHandler: Received non-string operationType: ${typeof operationType}. Returning undefined.`
      );
      return undefined;
    }

    const trimmed = operationType.trim();
    const handler = this.#registry.get(trimmed);

    if (!handler) {
      this.#logger.debug(
        `OperationRegistry: No handler found for operation type "${trimmed}".`
      );
    }

    return handler;
  }
}

export default OperationRegistry;
