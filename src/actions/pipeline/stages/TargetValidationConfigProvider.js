/**
 * @file Target validation configuration snapshot provider
 * @description Provides a cached configuration snapshot for the target component validation stage
 *              to avoid repeated deep merges when reading pipeline configuration.
 */

import { getActionPipelineConfig } from '../../../config/actionPipelineConfig.js';

/**
 * @typedef {import('../../../interfaces/IGameDataRepository.js').ActionDefinition} ActionDefinition
 */

/**
 * @typedef {object} TargetValidationConfigSnapshot
 * @property {boolean} validationEnabled - Indicates whether validation should run.
 * @property {boolean} skipValidation - Convenience flag mirroring the inverse of validationEnabled.
 * @property {'strict'|'lenient'|'off'} strictness - Validation strictness level.
 * @property {boolean} logDetails - Whether additional debug logging should be emitted.
 * @property {number|undefined} performanceThreshold - Threshold (ms) for logging slow stage executions.
 * @property {string[]} skipForActionTypes - Action types that should bypass validation.
 * @property {string[]} skipForMods - Mod identifiers that should bypass validation.
 * @property {boolean} performanceModeEnabled - Whether performance mode is active.
 * @property {boolean} skipNonCriticalStages - Whether non-critical stages should be skipped in performance mode.
 * @property {(action: ActionDefinition) => boolean} shouldSkipAction - Predicate deciding if a specific action should skip validation.
 */

/**
 * Provides cached configuration snapshots for target validation.
 *
 * @class TargetValidationConfigProvider
 * @description Resolves the action pipeline configuration once and exposes a focused
 *              snapshot tailored for the target validation stage.
 */
export class TargetValidationConfigProvider {
  #configLoader;
  #snapshot;

  /**
   * @description Create a new provider instance.
   * @param {object} [options] - Provider configuration options.
   * @param {() => object} [options.configLoader] - Optional loader overriding the default config resolution.
   * @returns {void}
   */
  constructor({ configLoader = getActionPipelineConfig } = {}) {
    this.#configLoader = configLoader;
    this.#snapshot = null;
  }

  /**
   * @description Resolve and cache the configuration snapshot.
   * @returns {TargetValidationConfigSnapshot} Cached snapshot for the validation stage.
   */
  getSnapshot() {
    if (this.#snapshot) {
      return this.#snapshot;
    }

    const rawConfig = this.#configLoader() || {};
    const targetValidation = rawConfig.targetValidation || {};
    const performance = rawConfig.performance || {};

    const strictness = targetValidation.strictness || 'strict';
    const validationEnabled =
      Boolean(targetValidation.enabled) && strictness !== 'off';
    const skipForActionTypes = Array.isArray(
      targetValidation.skipForActionTypes
    )
      ? [...targetValidation.skipForActionTypes]
      : [];
    const skipForMods = Array.isArray(targetValidation.skipForMods)
      ? [...targetValidation.skipForMods]
      : [];
    const performanceModeEnabled = Boolean(performance.enabled);
    const skipNonCriticalStages = Boolean(performance.skipNonCriticalStages);

    /**
     * @description Decide whether validation should be skipped for a specific action.
     * @param {ActionDefinition} action - Action definition being evaluated.
     * @returns {boolean} Whether validation should be skipped.
     */
    const shouldSkipAction = (action) => {
      if (!validationEnabled) {
        return true;
      }

      if (!action || typeof action !== 'object') {
        return false;
      }

      if (action.type && skipForActionTypes.includes(action.type)) {
        return true;
      }

      const modId =
        typeof action.id === 'string' ? action.id.split(':')[0] : null;
      if (modId && skipForMods.includes(modId)) {
        return true;
      }

      if (performanceModeEnabled && skipNonCriticalStages) {
        return true;
      }

      return false;
    };

    this.#snapshot = Object.freeze({
      validationEnabled,
      skipValidation: !validationEnabled,
      strictness,
      logDetails: Boolean(targetValidation.logDetails),
      performanceThreshold: targetValidation.performanceThreshold,
      skipForActionTypes,
      skipForMods,
      performanceModeEnabled,
      skipNonCriticalStages,
      shouldSkipAction,
    });

    return this.#snapshot;
  }

  /**
   * @description Invalidate the cached configuration snapshot so the next request reloads it.
   * @returns {void}
   */
  invalidateCache() {
    this.#snapshot = null;
  }
}

export default TargetValidationConfigProvider;
