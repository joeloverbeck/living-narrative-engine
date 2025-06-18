// src/types/stageResult.js

/**
 * @file Defines the StageResult type used for bootstrap stages.
 */

/**
 * @typedef {object} StageResult
 * @property {boolean} success - Indicates whether the stage completed successfully.
 * @property {any} [payload] - Optional value produced by the stage.
 * @property {Error} [error] - Populated when success is false with the error.
 */

/**
 * @description Factory for a successful StageResult.
 * @param {any} [payload] - Optional value produced by the stage.
 * @returns {StageResult}
 */
export function stageSuccess(payload) {
  return { success: true, payload };
}

/**
 * @description Factory for a failed StageResult.
 * @param {Error} error - Error describing the failure.
 * @returns {StageResult}
 */
export function stageFailure(error) {
  return { success: false, error };
}

export {};
