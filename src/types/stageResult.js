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

export {};
