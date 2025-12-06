/**
 * @file Configuration for action pipeline behavior and validation settings
 * @description Centralizes all action pipeline configuration including validation stages,
 *              performance modes, and debugging options. Supports environment-specific overrides.
 * @see ../actions/actionPipelineOrchestrator.js - Main pipeline orchestrator that uses this configuration
 * @see ../actions/pipeline/stages/TargetComponentValidationStage.js - Validation stage that uses this config
 */

import { getEnvironmentMode } from '../utils/environmentUtils.js';

/**
 * Action pipeline configuration
 *
 * @module actionPipelineConfig
 */
export const actionPipelineConfig = {
  // Target component validation settings
  targetValidation: {
    // Enable or disable target component validation
    enabled: true,

    // Validation strictness level
    // 'strict' - All forbidden components must be validated
    // 'lenient' - Skip validation for certain non-critical cases
    // 'off' - Disable validation entirely (same as enabled: false)
    strictness: 'strict',

    // Log detailed validation information
    logDetails: false,

    // Performance threshold for logging slow validations (in ms)
    performanceThreshold: 5,

    // Skip validation for specific action types (optional)
    skipForActionTypes: [],

    // Skip validation for specific mod IDs (optional)
    skipForMods: [],
  },

  // Performance optimization settings
  performance: {
    // Enable performance mode (reduces validation for speed)
    enabled: false,

    // Skip non-critical stages in performance mode
    skipNonCriticalStages: false,

    // Maximum time allowed for validation (ms)
    maxValidationTime: 100,

    // Enable caching of validation results
    enableCaching: true,

    // Cache TTL in milliseconds
    cacheTTL: 60000, // 1 minute
  },

  // Debugging and diagnostics
  diagnostics: {
    // Enable detailed trace logging
    traceEnabled: false,

    // Log pipeline stage execution times
    logStageTiming: false,

    // Log action filtering reasons
    logFilterReasons: false,

    // Include full action data in logs
    includeActionData: false,

    // Maximum number of actions to log in detail
    maxDetailedLogs: 10,
  },

  // Stage-specific settings
  stages: {
    // Component filtering stage settings
    componentFiltering: {
      enabled: true,
      strictMode: true,
    },

    // Prerequisite evaluation stage settings
    prerequisiteEvaluation: {
      enabled: true,
      allowPartialSuccess: false,
    },

    // Target component validation stage settings
    targetComponentValidation: {
      enabled: true,
      validateMultiTargets: true,
      validateLegacyFormat: true,
    },

    // Multi-target resolution stage settings
    multiTargetResolution: {
      enabled: true,
      maxTargetsPerAction: 10,
    },

    // Action formatting stage settings
    actionFormatting: {
      enabled: true,
      includeDisplayNames: true,
    },
  },

  // Environment-specific overrides
  environments: {
    development: {
      targetValidation: {
        logDetails: true,
      },
      diagnostics: {
        traceEnabled: true,
        logStageTiming: true,
      },
    },
    test: {
      targetValidation: {
        enabled: true,
        strictness: 'strict',
      },
      performance: {
        enabled: false,
      },
    },
    production: {
      targetValidation: {
        logDetails: false,
      },
      performance: {
        enabled: true,
        enableCaching: true,
      },
      diagnostics: {
        traceEnabled: false,
        logStageTiming: false,
      },
    },
  },
};

/**
 * Get configuration for current environment
 *
 * @returns {object} Merged configuration for the current environment
 */
export function getActionPipelineConfig() {
  const env = getEnvironmentMode();
  const envConfig = actionPipelineConfig.environments[env] || {};

  // Deep merge environment config with base config
  return deepMerge(actionPipelineConfig, envConfig);
}

/**
 * Check if target validation is enabled
 *
 * @returns {boolean} Whether target validation should be performed
 */
export function isTargetValidationEnabled() {
  const config = getActionPipelineConfig();
  return (
    config.targetValidation.enabled &&
    config.targetValidation.strictness !== 'off'
  );
}

/**
 * Check if a specific pipeline stage is enabled
 *
 * @param {string} stageName - Name of the stage to check
 * @returns {boolean} Whether the stage is enabled
 */
export function isStageEnabled(stageName) {
  const config = getActionPipelineConfig();
  const stageConfig = config.stages[stageName];
  return stageConfig?.enabled !== false;
}

/**
 * Get validation strictness level
 *
 * @returns {'strict'|'lenient'|'off'} Current strictness level
 */
export function getValidationStrictness() {
  const config = getActionPipelineConfig();
  return config.targetValidation.strictness;
}

/**
 * Check if performance mode is enabled
 *
 * @returns {boolean} Whether performance optimizations should be applied
 */
export function isPerformanceModeEnabled() {
  const config = getActionPipelineConfig();
  return config.performance.enabled;
}

/**
 * Check if validation should be skipped for a specific action
 *
 * @param {object} action - Action definition to check
 * @returns {boolean} Whether to skip validation for this action
 */
export function shouldSkipValidation(action) {
  const config = getActionPipelineConfig();

  // Check if validation is disabled globally
  if (!isTargetValidationEnabled()) {
    return true;
  }

  // Check if action type is in skip list
  if (
    action.type &&
    config.targetValidation.skipForActionTypes.includes(action.type)
  ) {
    return true;
  }

  // Check if mod ID is in skip list
  const modId = action.id?.split(':')[0];
  if (modId && config.targetValidation.skipForMods.includes(modId)) {
    return true;
  }

  // Check performance mode
  if (isPerformanceModeEnabled() && config.performance.skipNonCriticalStages) {
    return true;
  }

  return false;
}

/**
 * Deep merge utility for configuration objects
 *
 * @private
 * @param {object} target - Target object
 * @param {object} source - Source object to merge
 * @returns {object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

// Export individual config sections for convenience
export const targetValidationConfig = () =>
  getActionPipelineConfig().targetValidation;
export const performanceConfig = () => getActionPipelineConfig().performance;
export const diagnosticsConfig = () => getActionPipelineConfig().diagnostics;
export const stagesConfig = () => getActionPipelineConfig().stages;

export default actionPipelineConfig;
