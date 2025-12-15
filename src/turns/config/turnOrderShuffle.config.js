/**
 * @file Configuration for turn order shuffle behavior
 * @description Centralizes all turn order randomization settings including player detection,
 *              strategy-specific options, and environment overrides.
 * @see ../services/turnOrderShuffleService.js - Service that uses this configuration
 * @see ../order/turnOrderService.js - Main turn order service that integrates shuffling
 * @see specs/randomized-turn-ordering.md - Feature specification
 */

import { getEnvironmentMode } from '../../utils/environmentUtils.js';

/**
 * Turn order shuffle configuration
 *
 * @module turnOrderShuffleConfig
 */
export const turnOrderShuffleConfig = {
  // Global enable/disable for turn order shuffling
  enabled: true,

  // Strategy-specific shuffle settings
  strategies: {
    // Round-robin strategy: actors take turns in sequence
    'round-robin': {
      // Shuffle non-human actors at the start of each round
      shuffleNonHumans: true,
    },

    // Initiative strategy: actors ordered by initiative value
    initiative: {
      // Shuffle actors with identical initiative values
      shuffleTieBreakers: false,
    },
  },

  // Player type detection settings
  playerTypeDetection: {
    // Component ID to check for player type
    componentId: 'core:player_type',

    // Value that identifies human players
    humanTypeValue: 'human',
  },

  // Diagnostics and debugging settings
  diagnostics: {
    // Log the results of shuffle operations
    logShuffleResults: false,

    // Log the original order before shuffling
    logOriginalOrder: false,

    // Include actor names in diagnostic logs
    includeActorNames: false,
  },

  // Environment-specific overrides
  environments: {
    development: {
      diagnostics: {
        logShuffleResults: true,
        logOriginalOrder: true,
        includeActorNames: true,
      },
    },
    test: {
      enabled: true,
      diagnostics: {
        logShuffleResults: false,
        logOriginalOrder: false,
      },
    },
    production: {
      enabled: true,
      diagnostics: {
        logShuffleResults: false,
        logOriginalOrder: false,
        includeActorNames: false,
      },
    },
  },
};

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

/**
 * Get configuration for current environment
 *
 * @returns {object} Merged configuration for the current environment
 */
export function getTurnOrderShuffleConfig() {
  const env = getEnvironmentMode();
  const envConfig = turnOrderShuffleConfig.environments[env] || {};

  // Deep merge environment config with base config
  return deepMerge(turnOrderShuffleConfig, envConfig);
}

/**
 * Check if turn order shuffling is enabled
 *
 * @returns {boolean} Whether shuffling should be performed
 */
export function isShuffleEnabled() {
  const config = getTurnOrderShuffleConfig();
  return config.enabled === true;
}

/**
 * Check if shuffling is enabled for a specific strategy
 *
 * @param {string} strategyName - Name of the turn order strategy
 * @returns {boolean} Whether shuffling is enabled for this strategy
 */
export function isShuffleEnabledForStrategy(strategyName) {
  if (!isShuffleEnabled()) {
    return false;
  }

  const config = getTurnOrderShuffleConfig();
  const strategyConfig = config.strategies[strategyName];

  if (!strategyConfig) {
    return false;
  }

  // For round-robin, check shuffleNonHumans
  if (strategyName === 'round-robin') {
    return strategyConfig.shuffleNonHumans === true;
  }

  // For initiative, check shuffleTieBreakers
  if (strategyName === 'initiative') {
    return strategyConfig.shuffleTieBreakers === true;
  }

  return false;
}

/**
 * Get player type detection settings
 *
 * @returns {{componentId: string, humanTypeValue: string}} Player type detection configuration
 */
export function getPlayerTypeDetectionConfig() {
  const config = getTurnOrderShuffleConfig();
  return config.playerTypeDetection;
}

/**
 * Get diagnostics settings
 *
 * @returns {object} Diagnostics configuration
 */
export function getDiagnosticsConfig() {
  const config = getTurnOrderShuffleConfig();
  return config.diagnostics;
}

/**
 * Check if diagnostics logging is enabled
 *
 * @returns {boolean} Whether diagnostic logs should be produced
 */
export function isDiagnosticsEnabled() {
  const config = getTurnOrderShuffleConfig();
  return (
    config.diagnostics.logShuffleResults || config.diagnostics.logOriginalOrder
  );
}

export default turnOrderShuffleConfig;
