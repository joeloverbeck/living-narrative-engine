// -----------------------------------------------------------------------------
//  OperationRegistry  – test-compliant, DI-friendly implementation
// -----------------------------------------------------------------------------

/** @typedef {import('./defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
import { BaseService } from '../utils/baseService.js';
import { getNormalizedOperationType } from '../utils/operationTypeUtils.js';

class OperationRegistry extends BaseService {
  /** @type {Map<string, OperationHandler>} */ #registry = new Map();
  /** @type {ILogger|null}                  */ #logger = null;

  /**
   * Creates a new OperationRegistry instance.
   *
   * @param {{ logger: ILogger }} [options] - Constructor options.
   * @param {ILogger} [options.logger] - Logging service.
   */
  constructor({ logger } = {}) {
    super();
    this.#logger = this._init('OperationRegistry', logger);
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
    const trimmed = getNormalizedOperationType(
      operationType,
      this.#logger,
      'OperationRegistry.register'
    );
    if (!trimmed) {
      const msg =
        'OperationRegistry.register: operationType must be a non-empty string.';
      throw new Error(msg);
    }

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
    const trimmed = getNormalizedOperationType(
      operationType,
      this.#logger,
      'OperationRegistry.getHandler'
    );
    if (!trimmed) {
      return undefined;
    }
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
