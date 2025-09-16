import BaseError from './baseError.js';

/**
 * Enum of error codes for the different phases of the mods loader.
 *
 * @constant {object}
 */
export const ModsLoaderErrorCode = Object.freeze({
  SCHEMA: 'schema',
  GAME_CONFIG: 'game_config',
  MANIFEST: 'manifest',
  CONTENT: 'content',
  WORLD: 'world',
  SUMMARY: 'summary',
  UNEXPECTED: 'unexpected',
});

/**
 * Error thrown when a specific phase of the mods loader fails.
 *
 * @class ModsLoaderPhaseError
 * @augments BaseError
 */
export class ModsLoaderPhaseError extends BaseError {
  /**
   * Creates an error instance for a failed loader phase.
   *
   * @param {string} code - A ModsLoaderErrorCode value identifying the phase.
   * @param {string} message - A human readable error message.
   * @param {string} phase - Name of the loader phase that failed.
   * @param {Error} [cause] - Optional underlying error cause.
   */
  constructor(code, message, phase, cause) {
    const context = { code, phase, cause };
    super(message, code || 'MODS_LOADER_PHASE_ERROR', context);
    this.name = 'ModsLoaderPhaseError';
    // Store for backward compatibility
    this.phase = phase;
    if (cause) this.cause = cause;
  }

  /**
   * @returns {string} Severity level for mods loader phase errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Mods loader phase errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}
