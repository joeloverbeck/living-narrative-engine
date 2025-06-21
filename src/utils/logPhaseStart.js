// src/utils/logPhaseStart.js

/**
 * @file Provides a standardized function for logging the start of a loader phase.
 * @module utils/logPhaseStart
 * @since 1.1.0
 */

/* ── Type-only imports ──────────────────────────────────────────────────── */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/* ── Implementation ─────────────────────────────────────────────────────── */

/**
 * @description Logs a standardized banner message to indicate the start of a specific phase.
 * This helps in centralizing the format of phase-start log entries, ensuring consistency
 * across the application's loading process.
 *
 * @param {ILogger} logger - The logger instance to use for output. Must conform to the ILogger interface.
 * @param {string} phase - The name of the phase that is starting (e.g., 'SchemaPhase', 'ContentPhase').
 *
 * @example
 * // Inside a phase's execute method:
 * import { logPhaseStart } from './logPhaseStart.js';
 *
 * class MyPhase {
 * // ... constructor ...
 * async execute(ctx) {
 * logPhaseStart(this.logger, this.constructor.name);
 * // ... rest of the phase logic
 * }
 * }
 */
export function logPhaseStart(logger, phase) {
    logger.info(`— ${phase} starting —`);
}