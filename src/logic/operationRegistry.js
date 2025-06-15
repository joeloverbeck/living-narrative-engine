// -----------------------------------------------------------------------------
//  OperationRegistry  – test-compliant, DI-friendly implementation
// -----------------------------------------------------------------------------

/** @typedef {import('./defs.js').OperationHandler}           OperationHandler */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
import { ensureValidLogger } from '../utils/loggerUtils.js';
import { validateDependency } from '../utils/validationUtils.js';

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
    if (maybeLogger) {
      validateDependency(maybeLogger, 'logger', console, {
        requiredMethods: ['info', 'warn', 'error', 'debug'],
      });
    }
    this.#logger = ensureValidLogger(maybeLogger, 'OperationRegistry');
    this.#log('info', 'OperationRegistry initialized.');
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
      this.#log('error', msg);
      throw new Error(msg);
    }

    const trimmed = operationType.trim();

    if (typeof handler !== 'function') {
      const msg = `OperationRegistry.register: handler for type "${trimmed}" must be a function.`;
      this.#log('error', msg);
      throw new Error(msg);
    }

    // --- overwrite warning ---------------------------------------------------
    if (this.#registry.has(trimmed)) {
      this.#log(
        'warn',
        `OperationRegistry: Overwriting existing handler for operation type "${trimmed}".`
      );
    }

    // --- store & debug-log ---------------------------------------------------
    this.#registry.set(trimmed, handler);
    this.#log(
      'debug',
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
      this.#log(
        'warn',
        `OperationRegistry.getHandler: Received non-string operationType: ${typeof operationType}. Returning undefined.`
      );
      return undefined;
    }

    const trimmed = operationType.trim();
    const handler = this.#registry.get(trimmed);

    if (!handler) {
      this.#log(
        'debug',
        `OperationRegistry: No handler found for operation type "${trimmed}".`
      );
    }

    return handler;
  }

  // ---------------------------------------------------------------------------
  //  Internal logging helper – resilient to faulty or missing loggers
  // ---------------------------------------------------------------------------

  /**
   * @param {'info'|'warn'|'error'|'debug'} level
   * @param message
   * @param {...any} rest
   */
  #log(level, message, ...rest) {
    const loggerFn =
      this.#logger && typeof this.#logger[level] === 'function'
        ? this.#logger[level]
        : null;

    if (loggerFn) {
      try {
        loggerFn.call(this.#logger, message, ...rest);
        return;
      } catch (err) {
        // Logger itself mis-behaved – fall through to console fallback
        try {
          console.error(
            `Error occurred in logging utility (faulty logger method for level '${level}') trying to log message: "${message}"`,
            err
          );
        } catch {}
        // continue to fallback
      }
    }

    // --- console fallback ----------------------------------------------------
    const upper = level.toUpperCase();

    // Prefer the matching console method if it exists (keeps test expectations)
    if (typeof console[level] === 'function') {
      // info/warn/error/debug flow straight through (no [LEVEL] prefix)
      console[level](message, ...rest);
      return;
    }

    // Last-ditch: console.log with [LEVEL] prefix (used by the “faulty logger” tests)
    try {
      console.log(`[${upper}] ${message}`, ...rest);
    } catch {}
  }
}

export default OperationRegistry;
