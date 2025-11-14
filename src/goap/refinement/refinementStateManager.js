/**
 * @file RefinementStateManager - State accumulation service for GOAP refinement execution
 * @description Manages refinement.localState during task refinement, enabling state accumulation
 * across sequential steps via storeResultAs. Provides mutable access for updates and immutable
 * snapshots for safe condition evaluation.
 * @see docs/goap/refinement-parameter-binding.md - Parameter resolution from state
 * @see specs/goap-system-specs.md - GOAP system architecture
 * @see tickets/GOAPIMPL-010-refinement-state-manager.md - Implementation requirements
 */

import { deepFreeze } from '../../utils/cloneUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import RefinementError from '../errors/refinementError.js';

/**
 * Manages state accumulation during GOAP refinement execution.
 *
 * Provides:
 * - State lifecycle management (initialize, clear)
 * - State accumulation via store() when steps use storeResultAs
 * - Mutable access for updates (getState)
 * - Immutable snapshots for condition evaluation (getSnapshot)
 * - Key-based access (get, has)
 *
 * State Scoping:
 * - State is scoped to a single refinement method execution
 * - State does NOT persist across different method executions
 * - State is NOT shared between different actors
 *
 * Stored Result Structure:
 * {
 *   success: boolean,
 *   data: object,
 *   error: string | null,
 *   timestamp: number,
 *   actionId: string
 * }
 *
 * @class
 * @example
 * // Initialize state for new refinement
 * manager.initialize();
 *
 * // Store step result
 * manager.store('pickupResult', {
 *   success: true,
 *   data: { item: 'apple_7' },
 *   error: null,
 *   timestamp: Date.now(),
 *   actionId: 'items:pick_up_item'
 * });
 *
 * // Access for parameter resolution (mutable)
 * const state = manager.getState();
 * const itemId = state.pickupResult.data.item;
 *
 * // Get snapshot for condition evaluation (immutable)
 * const snapshot = manager.getSnapshot();
 * // snapshot is frozen, safe for condition evaluation
 *
 * // Clean up after refinement
 * manager.clear();
 */
class RefinementStateManager {
  /** @type {object} Current refinement state */
  #state;

  /** @type {import('../../utils/loggerUtils.js').ILogger} */
  #logger;

  /** @type {boolean} Whether state has been initialized */
  #initialized;

  /**
   * Valid JavaScript identifier pattern for state keys
   *
   * @private
   * @constant
   */
  static #KEY_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  /**
   * Creates a new RefinementStateManager
   *
   * @param {object} dependencies - Injected dependencies
   * @param {import('../../utils/loggerUtils.js').ILogger} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger);
    this.#state = null;
    this.#initialized = false;

    this.#logger.debug('RefinementStateManager initialized');
  }

  /**
   * Initialize new refinement state (empty object).
   * Should be called at the start of each refinement method execution.
   *
   * @returns {void}
   * @example
   * manager.initialize();
   * // State is now {}
   */
  initialize() {
    this.#state = {};
    this.#initialized = true;

    this.#logger.debug('Refinement state initialized (empty)');
  }

  /**
   * Store result from step execution.
   * Called when a primitive action step has a storeResultAs field.
   *
   * @param {string} key - Variable name from storeResultAs (must be valid JS identifier)
   * @param {object} value - Result object with required structure
   * @param {boolean} value.success - Whether step succeeded
   * @param {object} value.data - Action-specific result data
   * @param {string|null} value.error - Error message if failed
   * @param {number} value.timestamp - Execution timestamp
   * @param {string} value.actionId - ID of executed action
   * @returns {void}
   * @throws {RefinementError} If key is invalid or value structure is invalid
   * @example
   * manager.store('pickupResult', {
   *   success: true,
   *   data: { item: 'apple_7' },
   *   error: null,
   *   timestamp: 1638360000000,
   *   actionId: 'items:pick_up_item'
   * });
   */
  store(key, value) {
    this.#ensureInitialized('store');

    // Validate key format
    if (typeof key !== 'string' || !RefinementStateManager.#KEY_PATTERN.test(key)) {
      const error = new RefinementError(
        `Invalid state key: "${key}". Must be a valid JavaScript identifier (alphanumeric + underscore, cannot start with digit)`,
        {
          code: 'GOAP_REFINEMENT_INVALID_STATE_KEY',
          key,
          expectedPattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
        }
      );

      this.#logger.error('Invalid state key', {
        key,
        correlationId: error.correlationId,
      });

      throw error;
    }

    // Validate value structure
    this.#validateResultStructure(key, value);

    // Store the value
    this.#state[key] = value;

    this.#logger.debug('Stored refinement state', {
      key,
      success: value.success,
      actionId: value.actionId,
    });
  }

  /**
   * Get current mutable state reference.
   * Use for parameter resolution and state updates.
   *
   * WARNING: Returns mutable reference - modifications will affect stored state.
   * For condition evaluation, use getSnapshot() instead.
   *
   * @returns {object} Current localState object
   * @throws {RefinementError} If state not initialized
   * @example
   * const state = manager.getState();
   * const itemId = state.pickupResult.data.item; // Access nested values
   */
  getState() {
    this.#ensureInitialized('getState');
    return this.#state;
  }

  /**
   * Get immutable snapshot for condition evaluation.
   * Returns a deeply frozen copy of the current state.
   *
   * The snapshot is safe to pass to condition evaluation logic without risk of
   * side effects modifying the original state. Mutations will throw errors.
   *
   * @returns {object} Frozen deep copy of state
   * @throws {RefinementError} If state not initialized
   * @example
   * const snapshot = manager.getSnapshot();
   * // snapshot is frozen, cannot be modified
   * // snapshot.pickupResult.data.item = 'new_value'; // Would throw error
   */
  getSnapshot() {
    this.#ensureInitialized('getSnapshot');

    // Create deep copy to prevent mutations affecting original
    const snapshot = JSON.parse(JSON.stringify(this.#state));

    // Recursively freeze to ensure complete immutability
    deepFreeze(snapshot);

    this.#logger.debug('Created immutable state snapshot', {
      keyCount: Object.keys(snapshot).length,
    });

    return snapshot;
  }

  /**
   * Clear all state (between refinement executions).
   * Should be called after refinement completes or fails.
   *
   * @returns {void}
   * @example
   * manager.clear();
   * // State is now {} and marked as uninitialized
   */
  clear() {
    this.#state = null;
    this.#initialized = false;

    this.#logger.debug('Refinement state cleared');
  }

  /**
   * Check if key exists in state.
   *
   * @param {string} key - State key to check
   * @returns {boolean} True if key exists
   * @throws {RefinementError} If state not initialized
   * @example
   * if (manager.has('pickupResult')) {
   *   // Key exists, safe to access
   * }
   */
  has(key) {
    this.#ensureInitialized('has');

    if (typeof key !== 'string') {
      return false;
    }

    return key in this.#state;
  }

  /**
   * Get specific value from state.
   *
   * @param {string} key - State key
   * @returns {any} Value or undefined if key doesn't exist
   * @throws {RefinementError} If state not initialized
   * @example
   * const result = manager.get('pickupResult');
   * if (result) {
   *   console.log(result.data.item);
   * }
   */
  get(key) {
    this.#ensureInitialized('get');

    if (typeof key !== 'string') {
      return undefined;
    }

    return this.#state[key];
  }

  /**
   * Serialize state for debugging.
   * Returns JSON representation of current state.
   *
   * @returns {string} JSON representation
   * @throws {RefinementError} If state not initialized
   * @example
   * console.log(manager.toJSON());
   * // {"pickupResult":{"success":true,"data":{"item":"apple_7"},...}}
   */
  toJSON() {
    this.#ensureInitialized('toJSON');

    try {
      return JSON.stringify(this.#state);
    } catch (error) {
      // Handle circular references or other JSON serialization errors
      this.#logger.warn('Failed to serialize state to JSON', {
        error: error.message,
      });

      return '{}';
    }
  }

  /**
   * Ensure state has been initialized before operations
   *
   * @private
   * @param {string} operation - Name of operation being performed
   * @throws {RefinementError} If state not initialized
   */
  #ensureInitialized(operation) {
    if (!this.#initialized || this.#state === null) {
      const error = new RefinementError(
        `Cannot ${operation}: refinement state not initialized. Call initialize() first.`,
        {
          code: 'GOAP_REFINEMENT_STATE_NOT_INITIALIZED',
          operation,
        }
      );

      this.#logger.error('State operation on uninitialized state', {
        operation,
        correlationId: error.correlationId,
      });

      throw error;
    }
  }

  /**
   * Validate result structure from step execution
   *
   * @private
   * @param {string} key - Key being stored (for error context)
   * @param {any} value - Value to validate
   * @throws {RefinementError} If structure is invalid
   */
  #validateResultStructure(key, value) {
    if (!value || typeof value !== 'object') {
      throw new RefinementError(
        `Invalid result structure for key "${key}": value must be an object`,
        {
          code: 'GOAP_REFINEMENT_INVALID_RESULT_STRUCTURE',
          key,
          receivedType: typeof value,
        }
      );
    }

    const requiredFields = ['success', 'data', 'error', 'timestamp', 'actionId'];
    const missingFields = requiredFields.filter((field) => !(field in value));

    if (missingFields.length > 0) {
      throw new RefinementError(
        `Invalid result structure for key "${key}": missing required fields: ${missingFields.join(', ')}`,
        {
          code: 'GOAP_REFINEMENT_INVALID_RESULT_STRUCTURE',
          key,
          missingFields,
          requiredFields,
        }
      );
    }

    // Validate field types
    if (typeof value.success !== 'boolean') {
      throw new RefinementError(
        `Invalid result structure for key "${key}": success must be boolean`,
        {
          code: 'GOAP_REFINEMENT_INVALID_RESULT_STRUCTURE',
          key,
          field: 'success',
          expectedType: 'boolean',
          receivedType: typeof value.success,
        }
      );
    }

    if (typeof value.data !== 'object' || value.data === null) {
      throw new RefinementError(
        `Invalid result structure for key "${key}": data must be an object`,
        {
          code: 'GOAP_REFINEMENT_INVALID_RESULT_STRUCTURE',
          key,
          field: 'data',
          expectedType: 'object',
          receivedType: typeof value.data,
        }
      );
    }

    if (value.error !== null && typeof value.error !== 'string') {
      throw new RefinementError(
        `Invalid result structure for key "${key}": error must be string or null`,
        {
          code: 'GOAP_REFINEMENT_INVALID_RESULT_STRUCTURE',
          key,
          field: 'error',
          expectedType: 'string | null',
          receivedType: typeof value.error,
        }
      );
    }

    if (typeof value.timestamp !== 'number') {
      throw new RefinementError(
        `Invalid result structure for key "${key}": timestamp must be number`,
        {
          code: 'GOAP_REFINEMENT_INVALID_RESULT_STRUCTURE',
          key,
          field: 'timestamp',
          expectedType: 'number',
          receivedType: typeof value.timestamp,
        }
      );
    }

    if (typeof value.actionId !== 'string') {
      throw new RefinementError(
        `Invalid result structure for key "${key}": actionId must be string`,
        {
          code: 'GOAP_REFINEMENT_INVALID_RESULT_STRUCTURE',
          key,
          field: 'actionId',
          expectedType: 'string',
          receivedType: typeof value.actionId,
        }
      );
    }
  }
}

export default RefinementStateManager;
